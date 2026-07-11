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

from models import AnalysisRun, AttackChain, Finding, GraphData, create_db_and_tables, engine
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
    if req.model:
        env_vars["AI_MODEL"] = req.model
    if req.api_key is not None:
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


# ─── Ollama proxy (model list for UI) ─────────────────────────────────────────

@app.get("/api/models", tags=["inference"])
async def list_models():
    """Proxy to local Ollama — returns available model names."""
    from llm.router import list_local_models
    models = await list_local_models()
    return {"models": models}
