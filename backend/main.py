"""
FastAPI backend — Attack Chain Mapper.
Serves the analysis pipeline for the Electron desktop app.
All connections are restricted to localhost (127.0.0.1).
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from sqlmodel import Session, select

load_dotenv()

from models import AnalysisRun, AttackChain, Finding, GraphData, ThreatIntelGraph, SandboxProfile, create_db_and_tables, engine
from orchestrator import run_pipeline
from routers import chat

REPORTS_DIR = Path(__file__).parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

# Restrict to Electron renderer and Vite dev server only
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,app://."
).split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Attack Chain Mapper",
    description="Autonomous security sentinel — local, encrypted, open-source.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.mount("/reports", StaticFiles(directory=str(REPORTS_DIR)), name="reports")

app.include_router(chat.router)

# SSE queues — one per run_id, in-memory only
_sse_queues: dict[int, asyncio.Queue] = {}


# ─── Request models ────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    repo_url: str
    model: str | None = None
    provider: str | None = None
    api_key: str | None = None


class ConfigRequest(BaseModel):
    provider: str
    model: str | None = None
    api_key: str | None = None


class InstallToolRequest(BaseModel):
    name: str


# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["health"])
async def root():
    return {"service": "Attack Chain Mapper", "version": "1.0.0", "status": "running"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ─── Pipeline ──────────────────────────────────────────────────────────────────

@app.post("/api/analyze", tags=["pipeline"])
async def start_analysis(req: AnalyzeRequest):
    """
    Start a new analysis run.
    Returns run_id for SSE streaming.
    The openrouter_key, if supplied, is held in memory for this request only
    and is never persisted to the database.
    """
    url = req.repo_url.strip()
    if not url.startswith(("http://", "https://", "file://")):
        raise HTTPException(status_code=400, detail="repo_url must be an http/https/file URL.")

    with Session(engine) as session:
        run = AnalysisRun(repo_url=url, status="pending")
        session.add(run)
        session.commit()
        session.refresh(run)
        run_id = run.id

    queue: asyncio.Queue = asyncio.Queue()
    _sse_queues[run_id] = queue

    asyncio.create_task(
        run_pipeline(
            run_id=run_id,
            repo_url=url,
            queue=queue,
            model_override=req.model,
            provider=req.provider,
            api_key=req.api_key,
        )
    )

    return {"run_id": run_id, "status": "pending"}


@app.get("/api/stream/{run_id}", tags=["pipeline"])
async def stream_events(run_id: int):
    """SSE endpoint — streams pipeline progress events in real time."""

    async def event_generator() -> AsyncGenerator[str, None]:
        if run_id not in _sse_queues:
            _sse_queues[run_id] = asyncio.Queue()

        queue = _sse_queues[run_id]

        with Session(engine) as session:
            run = session.get(AnalysisRun, run_id)
            if run:
                yield f"data: {json.dumps({'type': 'status', 'stage': run.status, 'run_id': run_id})}\n\n"

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"

        _sse_queues.pop(run_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── Results ───────────────────────────────────────────────────────────────────

@app.get("/api/runs/{run_id}", tags=["results"])
async def get_run(run_id: int):
    """Return full analysis run with findings, graph, and chains."""
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found.")

        findings = session.exec(select(Finding).where(Finding.run_id == run_id)).all()
        graph    = session.exec(select(GraphData).where(GraphData.run_id == run_id)).first()
        chains   = session.exec(
            select(AttackChain)
            .where(AttackChain.run_id == run_id)
            .order_by(AttackChain.chain_index)
        ).all()
        sandboxes = session.exec(select(SandboxProfile).where(SandboxProfile.run_id == run_id)).all()

        return {
            "run": {
                "id":           run.id,
                "repo_url":     run.repo_url,
                "status":       run.status,
                "report_url":   run.report_url,
                "created_at":   run.created_at.isoformat(),
                "error_message": run.error_message,
            },
            "findings": [
                {
                    "id":         f.id,
                    "source":     f.source,
                    "rule_id":    f.rule_id,
                    "severity":   f.severity,
                    "file_path":  f.file_path,
                    "line_start": f.line_start,
                    "message":    f.message,
                }
                for f in findings
            ],
            "graph": {
                "nodes": json.loads(graph.nodes_json) if graph else [],
                "edges": json.loads(graph.edges_json) if graph else [],
            },
            "chains": [
                {
                    "id":                    c.id,
                    "chain_index":           c.chain_index,
                    "title":                 c.title,
                    "steps":                 json.loads(c.steps_json),
                    "impact":                c.impact,
                    "confidence":            c.confidence,
                    "explanation":           c.explanation,
                    "node_ids":              json.loads(c.node_ids_json),
                    "historical_similarity": c.historical_similarity,
                }
                for c in chains
            ],
            "sandboxes": [
                {
                    "id": s.id,
                    "chain_id": s.chain_id,
                    "profile_type": s.profile_type,
                    "content": s.content
                }
                for s in sandboxes
            ]
        }


@app.get("/api/runs", tags=["results"])
async def list_runs():
    """List all analysis runs, newest first."""
    with Session(engine) as session:
        runs = session.exec(
            select(AnalysisRun).order_by(AnalysisRun.created_at.desc())
        ).all()
        return [
            {
                "id":            r.id,
                "repo_url":      r.repo_url,
                "status":        r.status,
                "report_url":    r.report_url,
                "created_at":    r.created_at.isoformat(),
                "has_clone":     bool(r.work_dir_path),
                "clone_path":    r.work_dir_path,
            }
            for r in runs
        ]


# ─── Decentralized Threat Intel (Simulated) ───────────────────────────────────

@app.post("/api/threat-intel/publish/{run_id}", tags=["threat-intel"])
async def publish_threat_intel(run_id: int):
    """Anonymize and publish attack chains as Threat Intel graphs."""
    import hashlib
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found.")
            
        chains = session.exec(select(AttackChain).where(AttackChain.run_id == run_id)).all()
        if not chains:
            return {"status": "no_chains", "published": 0}
            
        published_count = 0
        for chain in chains:
            # Simple anonymization: hash the steps to extract structural topology
            steps = json.loads(chain.steps_json)
            anon_nodes = []
            anon_edges = []
            
            for i, step in enumerate(steps):
                node_hash = hashlib.sha256(step.get('node', '').encode()).hexdigest()[:12]
                anon_nodes.append({"id": node_hash, "type": "anonymized_node", "weakness": step.get('weakness', 'unknown')})
                if i > 0:
                    prev_hash = hashlib.sha256(steps[i-1].get('node', '').encode()).hexdigest()[:12]
                    anon_edges.append({"source": prev_hash, "target": node_hash, "action": step.get('action', 'exploits')})
                    
            topology_str = json.dumps(anon_edges, sort_keys=True)
            topology_hash = hashlib.sha256(topology_str.encode()).hexdigest()
            
            intel = ThreatIntelGraph(
                run_id=run_id,
                topology_hash=topology_hash,
                nodes_json=json.dumps(anon_nodes),
                edges_json=json.dumps(anon_edges),
                impact_level=chain.impact
            )
            session.add(intel)
            published_count += 1
            
        session.commit()
        return {"status": "ok", "published": published_count}


@app.get("/api/threat-intel", tags=["threat-intel"])
async def get_threat_intel():
    """Retrieve all published Threat Intel graphs."""
    with Session(engine) as session:
        intel = session.exec(select(ThreatIntelGraph).order_by(ThreatIntelGraph.published_at.desc())).all()
        return [
            {
                "id": t.id,
                "published_at": t.published_at.isoformat(),
                "topology_hash": t.topology_hash,
                "nodes": json.loads(t.nodes_json),
                "edges": json.loads(t.edges_json),
                "impact_level": t.impact_level
            }
            for t in intel
        ]


# ─── File Preview ──────────────────────────────────────────────────────────────

@app.get("/api/runs/{run_id}/file", tags=["results"])
async def get_file_content(run_id: int, path: str):
    """Serve a file from the quarantined Security Box."""
    import os
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run or not run.work_dir_path:
            raise HTTPException(status_code=404, detail="Run or repository clone not found.")
        
        # Security: Prevent path traversal
        base_path = os.path.abspath(run.work_dir_path)
        target_path = os.path.abspath(os.path.join(base_path, path.lstrip('/\\')))
        
        if os.path.commonpath([base_path, target_path]) != base_path:
            raise HTTPException(status_code=403, detail="Path traversal attempt blocked.")
            
        if not os.path.isfile(target_path):
            raise HTTPException(status_code=404, detail="File not found in repository.")
            
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                content = f.read()
            return {"content": content}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not read file: {e}")


# ─── Auto-Fix ──────────────────────────────────────────────────────────────────

class AutoFixRequest(BaseModel):
    step_context: dict
    mode: str = "patch"  # "patch" or "shape_shift"

@app.post("/api/runs/{run_id}/autofix", tags=["results"])
async def autofix(run_id: int, req: AutoFixRequest):
    """
    Generate patched code via LLM, temporarily lift permissions in the Security Box, 
    write the fix, commit it to a new local branch, and re-lock.
    """
    import os, stat, subprocess
    from llm.router import generate_chat_response
    
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run or not run.work_dir_path:
            raise HTTPException(status_code=404, detail="Run clone not found on disk.")
            
    # 1. Ask AI for the patch
    if req.mode == "shape_shift":
        prompt = f"""Given this vulnerability context: {json.dumps(req.step_context)}, provide ONLY the fully patched source code for the affected file. 
        CRITICAL MTD REQUIREMENT: Implement Moving Target Defense (Shape-Shifting). 
        Do not just patch the bug. Heavily mutate the surrounding code structure, rename variables, alter control flows, and insert benign dummy operations to evade static signatures, while keeping the external API and logic exactly the same.
        Do not include markdown formatting or explanations."""
    else:
        prompt = f"Given this vulnerability context: {json.dumps(req.step_context)}, provide ONLY the fully patched source code for the affected file. Do not include markdown formatting or explanations."
        
    messages = [{"role": "user", "content": prompt}]
    
    try:
        patched_code = await generate_chat_response(messages)
        # Strip markdown code blocks if the LLM included them
        if patched_code.startswith("```"):
            lines = patched_code.split("\\n")
            patched_code = "\\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\\n".join(lines[1:])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI failure: {e}")

    # 2. Extract file path from context
    file_path = req.step_context.get("node", "")
    if not file_path:
        raise HTTPException(status_code=400, detail="Could not determine file path from step context.")
        
    base_path = os.path.abspath(run.work_dir_path)
    target_path = os.path.abspath(os.path.join(base_path, file_path.lstrip('/\\')))
    
    if not target_path.startswith(base_path) or not os.path.isfile(target_path):
        raise HTTPException(status_code=404, detail="Target file not found in clone.")

    # 3. Lift permissions, apply fix, git commit, re-lock
    try:
        os.chmod(target_path, stat.S_IWRITE | stat.S_IREAD)
        
        # Git operations (only works if repo is a git clone)
        branch_name = f"auto-fix-{run_id}-{int(datetime.utcnow().timestamp())}"
        if os.path.isdir(os.path.join(base_path, ".git")):
            subprocess.run(["git", "checkout", "-b", branch_name], cwd=base_path, check=False)
            
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(patched_code)
            
        if os.path.isdir(os.path.join(base_path, ".git")):
            subprocess.run(["git", "add", file_path], cwd=base_path, check=False)
            subprocess.run(["git", "commit", "-m", f"Security Auto-Fix for {file_path}"], cwd=base_path, check=False)
            
        os.chmod(target_path, stat.S_IREAD)
        return {"status": "ok", "branch": branch_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply patch: {e}")


# ─── Chaos Engineering ─────────────────────────────────────────────────────────

@app.post("/api/runs/{run_id}/chaos", tags=["results"])
async def trigger_chaos(run_id: int):
    """Inject an AI-generated vulnerability into the cloned repository."""
    from agents.chaos import inject_chaos
    result = await inject_chaos(run_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("detail"))
    return result


# ─── CI/CD Webhooks ────────────────────────────────────────────────────────────

@app.post("/api/webhooks/github", tags=["pipeline"])
async def github_webhook(payload: dict):
    """
    Listen for GitHub push events and automatically spawn analysis.
    """
    repo_url = payload.get("repository", {}).get("clone_url")
    if not repo_url:
        return {"status": "ignored", "reason": "No clone_url in payload"}
        
    # Create run
    with Session(engine) as session:
        new_run = AnalysisRun(repo_url=repo_url, status="pending")
        session.add(new_run)
        session.commit()
        session.refresh(new_run)
        
    # Start orchestrator in background
    from orchestrator import run_pipeline
    asyncio.create_task(run_pipeline(new_run.id, repo_url))
    return {"status": "started", "run_id": new_run.id}


# ─── Clone Management ─────────────────────────────────────────────────────────

class CloneAction(BaseModel):
    action: str  # "keep" | "delete"


@app.post("/api/runs/{run_id}/clone", tags=["results"])
async def manage_clone(run_id: int, body: CloneAction):
    """
    Decide what to do with the cloned repository after analysis.
    action='delete' — removes the temp directory from disk.
    action='keep'   — moves it to the user's home/acm-clones/ directory.
    """
    from orchestrator import delete_clone
    import os, shutil
    from pathlib import Path

    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found.")

        clone_path = run.work_dir_path

    if body.action == "delete":
        if clone_path and os.path.exists(clone_path):
            from orchestrator import secure_wipe_directory
            secure_wipe_directory(clone_path)
        deleted = delete_clone(run_id)
        return {"action": "deleted", "success": deleted}

    elif body.action == "keep":
        if not clone_path or not os.path.exists(clone_path):
            return {"action": "keep", "success": False, "detail": "Clone not found on disk."}

        # Move to a permanent location: ~/acm-clones/<run_id>_<repo_name>
        repo_name = run.repo_url.rstrip("/").split("/")[-1].replace(".git", "")
        dest_parent = Path.home() / "acm-clones"
        dest_parent.mkdir(exist_ok=True)
        dest = dest_parent / f"run{run_id}_{repo_name}"

        if dest.exists():
            shutil.rmtree(dest)

        import stat
        # Lift read-only permissions from Security Box before moving
        for root, dirs, files in os.walk(clone_path):
            for file in files:
                filepath = os.path.join(root, file)
                try:
                    os.chmod(filepath, stat.S_IWRITE)
                except Exception:
                    pass

        shutil.move(clone_path, str(dest))

        with Session(engine) as session:
            run2 = session.get(AnalysisRun, run_id)
            if run2:
                run2.work_dir_path = str(dest)
                session.add(run2)
                session.commit()

        return {"action": "kept", "success": True, "path": str(dest)}

    raise HTTPException(status_code=400, detail="action must be 'keep' or 'delete'.")


@app.get("/api/runs/{run_id}/clone", tags=["results"])
async def clone_status(run_id: int):
    """Check whether the cloned repo is still on disk."""
    import os
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found.")
        exists = bool(run.work_dir_path and os.path.exists(run.work_dir_path))
        return {
            "run_id":     run_id,
            "has_clone":  exists,
            "clone_path": run.work_dir_path if exists else None,
        }




@app.post("/api/config", tags=["config"])
async def save_config(req: ConfigRequest):
    """
    Save the AI provider configuration to the local .env file.
    This persists the user's choice from the Installer wizard.
    """
    env_path = Path(__file__).parent / ".env"
    
    # Read existing
    env_vars = {}
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
                    
    # Update
    env_vars["AI_PROVIDER"] = req.provider
    if req.model is not None:
        env_vars["AI_MODEL"] = req.model
    if req.api_key is not None:
        # Allow explicitly clearing the key by passing empty string
        env_vars["AI_API_KEY"] = req.api_key
        
    # Write back
    with open(env_path, "w") as f:
        for k, v in env_vars.items():
            f.write(f"{k}={v}\n")
            
    # Update current process
    os.environ["AI_PROVIDER"] = req.provider
    if req.model:
        os.environ["AI_MODEL"] = req.model
    if req.api_key is not None:
        os.environ["AI_API_KEY"] = req.api_key
        
    return {"status": "ok", "provider": req.provider}


@app.get("/api/config/status", tags=["config"])
async def get_config_status():
    """Return the currently configured AI provider and whether an API key exists."""
    provider = os.getenv("AI_PROVIDER", "ollama")
    model    = os.getenv("AI_MODEL", "qwen2.5-coder:3b" if provider == "ollama" else "")
    api_key  = os.getenv("AI_API_KEY", "")
    return {
        "provider": provider,
        "model":    model,
        "has_key":  bool(api_key and api_key.strip()),
    }


class TestConfigRequest(BaseModel):
    provider: str
    model: str | None = None
    api_key: str


@app.post("/api/config/test", tags=["config"])
async def test_config(req: TestConfigRequest):
    """
    Validate an API key by making a minimal test call to the provider.
    Returns {ok: true} on success or {ok: false, detail: str} on failure.
    """
    import httpx
    try:
        if req.provider == "ollama":
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get("http://127.0.0.1:11434/api/tags")
                return {"ok": r.status_code == 200}

        elif req.provider == "claude":
            headers = {
                "x-api-key":         req.api_key,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            }
            payload = {
                "model":      req.model or "claude-3-5-haiku-20241022",
                "max_tokens": 5,
                "messages":   [{"role": "user", "content": "hi"}],
            }
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                if r.status_code in (200, 400):  # 400 still means auth passed
                    return {"ok": True}
                return {"ok": False, "detail": f"HTTP {r.status_code}: {r.text[:200]}"}

        elif req.provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={req.api_key}"
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    return {"ok": True}
                return {"ok": False, "detail": f"HTTP {r.status_code}: {r.text[:200]}"}

        elif req.provider == "openai":
            headers = {"Authorization": f"Bearer {req.api_key}", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get("https://api.openai.com/v1/models", headers=headers)
                if r.status_code == 200:
                    return {"ok": True}
                return {"ok": False, "detail": f"HTTP {r.status_code}: {r.text[:200]}"}

        return {"ok": False, "detail": "Unknown provider"}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


# ─── Ollama proxy (model list for UI) ─────────────────────────────────────────

@app.get("/api/models", tags=["inference"])
async def list_models():
    """Proxy to local Ollama — returns available model names."""
    from llm.router import list_local_models
    models = await list_local_models()
    return {"models": models}


# ─── System Tools Detection ────────────────────────────────────────────────────

@app.get("/api/system/tools", tags=["system"])
async def get_system_tools():
    """
    Detect which analysis tools and runtimes are available on this system.
    Returns name, version, installed status for each tool.
    """
    import shutil
    import subprocess

    def check_tool(cmd: list[str], name: str) -> dict:
        exe = shutil.which(cmd[0])
        if not exe:
            return {"name": name, "installed": False, "version": None}
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=5
            )
            version_line = (result.stdout or result.stderr or "").strip().splitlines()
            version = version_line[0] if version_line else "unknown"
            return {"name": name, "installed": True, "version": version[:80]}
        except Exception as e:
            return {"name": name, "installed": bool(exe), "version": str(e)[:80]}

    tools = [
        check_tool(["semgrep", "--version"], "Semgrep"),
        check_tool(["bandit", "--version"], "Bandit"),
        check_tool(["pip-audit", "--version"], "pip-audit"),
        check_tool(["git", "--version"], "Git"),
        check_tool(["python", "--version"], "Python"),
        check_tool(["ollama", "--version"], "Ollama"),
        check_tool(["node", "--version"], "Node.js"),
    ]
    return {"tools": tools}


@app.post("/api/system/tools/install", tags=["system"])
async def install_system_tool(req: InstallToolRequest):
    import subprocess
    import sys
    
    tool_name = req.name.lower()
    
    # Python tools
    if tool_name in ["semgrep", "bandit", "pip-audit"]:
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", tool_name],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode == 0:
                return {"status": "ok", "detail": f"{req.name} installed successfully"}
            return {"status": "error", "detail": result.stderr}
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    # System tools via Winget (Windows)
    winget_map = {
        "git": "Git.Git",
        "ollama": "Ollama.Ollama",
        "node.js": "OpenJS.NodeJS"
    }

    if tool_name in winget_map:
        package_id = winget_map[tool_name]
        try:
            result = subprocess.run(
                ["winget", "install", "-e", "--id", package_id, "--accept-source-agreements", "--accept-package-agreements"],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0:
                return {"status": "ok", "detail": f"{req.name} installed successfully"}
            return {"status": "error", "detail": result.stderr or result.stdout}
        except Exception as e:
            return {"status": "error", "detail": str(e)}
            
    return {"status": "error", "detail": "Installation for this tool is not supported"}

