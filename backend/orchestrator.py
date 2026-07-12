"""
Pipeline Orchestrator — coordinates all 5 agents in sequence.
Streams SSE events to the frontend via the shared asyncio.Queue.
"""
import asyncio
import json
import os
import shutil
import stat
import tempfile
from datetime import datetime
from typing import Optional
from urllib.parse import unquote

from sqlmodel import Session

from models import AnalysisRun, AttackChain, GraphData, engine
from agents.scanner import run_scanner
from agents.graph_builder import build_graph
from agents.attack_path import reason_attack_paths
from agents.scorer import score_chains
from agents.deployer import deploy_report
from agents.sandbox_generator import generate_sandboxes


async def emit(queue: asyncio.Queue, event: dict):
    """Push a structured event to the SSE queue."""
    await queue.put(event)


async def run_pipeline(
    run_id: int,
    repo_url: str,
    queue: asyncio.Queue,
    model_override: str | None = None,
    provider: str | None = None,
    api_key: str | None = None,
):
    """
    Master pipeline state machine.
    Runs all agents in order, emitting SSE events at each stage.
    model_override, provider and api_key are request-scoped and never persisted.
    """
    work_dir: Optional[str] = None

    try:
        # ── Stage 1: Clone / prepare repo ──────────────────────────────
        await emit(queue, {
            "type": "stage_start",
            "stage": "cloning",
            "message": "Cloning repository...",
            "run_id": run_id,
        })
        _update_run_status(run_id, "cloning")

        work_dir = await _clone_repo(repo_url, run_id, queue)

        await emit(queue, {
            "type": "stage_done",
            "stage": "cloning",
            "message": "Repository cloned successfully.",
            "run_id": run_id,
        })

        # ── Stage 2: Scanner Agent ──────────────────────────────────────
        await emit(queue, {
            "type": "stage_start",
            "stage": "scanning",
            "message": "Scanning for vulnerabilities with Semgrep and pip-audit...",
            "run_id": run_id,
        })
        _update_run_status(run_id, "scanning")

        findings = await run_scanner(run_id, work_dir, queue)

        await emit(queue, {
            "type": "stage_done",
            "stage": "scanning",
            "message": f"Found {len(findings)} vulnerabilities.",
            "count": len(findings),
            "run_id": run_id,
        })

        # ── Stage 3: Graph-Builder Agent ───────────────────────────────
        await emit(queue, {
            "type": "stage_start",
            "stage": "graphing",
            "message": "Mapping code structure and data flows...",
            "run_id": run_id,
        })
        _update_run_status(run_id, "graphing")

        graph = await build_graph(run_id, work_dir, findings, queue)

        await emit(queue, {
            "type": "stage_done",
            "stage": "graphing",
            "message": f"Graph built: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges.",
            "graph": graph,
            "run_id": run_id,
        })

        # ── Stage 4: Attack-Path Agent ─────────────────────────────────
        await emit(queue, {
            "type": "stage_start",
            "stage": "reasoning",
            "message": "AI reasoning attack chains using local Qwen2.5-Coder model...",
            "run_id": run_id,
        })
        _update_run_status(run_id, "reasoning")

        chains = await reason_attack_paths(
            run_id, findings, graph, queue,
            model_override=model_override,
            provider=provider,
            api_key=api_key,
        )

        await emit(queue, {
            "type": "stage_done",
            "stage": "reasoning",
            "message": f"Identified {len(chains)} attack chains.",
            "count": len(chains),
            "run_id": run_id,
        })

        # ── Stage 5: Impact Scoring Agent ──────────────────────────────
        await emit(queue, {
            "type": "stage_start",
            "stage": "scoring",
            "message": "Scoring attack chain impact...",
            "run_id": run_id,
        })
        _update_run_status(run_id, "scoring")

        scored_chains = await score_chains(run_id, chains, queue)

        await emit(queue, {
            "type": "stage_done",
            "stage": "scoring",
            "message": "Impact scoring complete.",
            "run_id": run_id,
        })
        
        # ── Stage 5.5: Dynamic Sandboxing Agent ────────────────────────
        _update_run_status(run_id, "sandboxing")
        sandboxes = await generate_sandboxes(
            run_id, scored_chains, queue,
            model_override=model_override,
            provider=provider,
            api_key=api_key,
        )

        # ── Stage 6: Report Deployment Agent ───────────────────────────
        await emit(queue, {
            "type": "stage_start",
            "stage": "deploying",
            "message": "Generating and deploying live report...",
            "run_id": run_id,
        })
        _update_run_status(run_id, "deploying")

        report_data = {
            "run_id": run_id,
            "repo_url": repo_url,
            "findings": findings,
            "graph": graph,
            "chains": scored_chains,
        }
        report_url = await deploy_report(run_id, report_data, queue)

        # Store clone path so user can keep or delete via API
        _update_run_status(run_id, "done", report_url=report_url, work_dir_path=work_dir)

        await emit(queue, {
            "type": "done",
            "stage": "done",
            "message": "Analysis complete! Report is live.",
            "report_url": report_url,
            "run_id": run_id,
            "chains": scored_chains,
            "graph": graph,
        })

    except Exception as e:
        error_msg = str(e)
        _update_run_status(run_id, "error", error_message=error_msg)
        await emit(queue, {
            "type": "error",
            "stage": "error",
            "message": f"Pipeline error: {error_msg}",
            "run_id": run_id,
        })
    finally:
        # On error, always clean up the clone.
        # On success, the clone is kept until the user decides via /api/runs/{id}/clone
        pass


def delete_clone(run_id: int) -> bool:
    """Delete the cloned repo for a run. Returns True if deleted, False if not found."""
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run or not run.work_dir_path:
            return False
        path = run.work_dir_path
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
        run.work_dir_path = None
        session.add(run)
        session.commit()
    return True


async def _clone_repo(repo_url: str, run_id: int, queue: asyncio.Queue) -> str:
    """Clone a GitHub repo or copy local files to a temp Security Box directory."""
    import git

    work_dir = tempfile.mkdtemp(prefix=f"acm_run_{run_id}_")

    await emit(queue, {
        "type": "log",
        "stage": "cloning",
        "message": f"Quarantining {repo_url} into Security Box → {work_dir}",
        "run_id": run_id,
    })

    loop = asyncio.get_event_loop()
    
    def prepare_sandbox():
        if repo_url.startswith("file://"):
            local_path = unquote(repo_url[7:])
            if os.name == 'nt' and local_path.startswith("/") and ":" in local_path:
                local_path = local_path[1:]
            
            if os.path.isdir(local_path):
                # Copy folder contents
                for item in os.listdir(local_path):
                    s = os.path.join(local_path, item)
                    d = os.path.join(work_dir, item)
                    if os.path.isdir(s):
                        shutil.copytree(s, d, dirs_exist_ok=True)
                    else:
                        shutil.copy2(s, d)
            elif os.path.isfile(local_path):
                # Check for zip/tar, else copy raw
                if local_path.endswith('.zip'):
                    import zipfile
                    with zipfile.ZipFile(local_path, 'r') as zip_ref:
                        zip_ref.extractall(work_dir)
                elif local_path.endswith(('.tar.gz', '.tgz', '.tar')):
                    import tarfile
                    with tarfile.open(local_path, 'r:*') as tar_ref:
                        tar_ref.extractall(work_dir)
                else:
                    shutil.copy2(local_path, work_dir)
        else:
            if not repo_url.startswith(("http://", "https://", "git://")):
                raise ValueError("Invalid repository URL protocol. Only http, https, and git are allowed.")
            git.Repo.clone_from(repo_url, work_dir, depth=1)

        # Security Box: Enforce read-only permissions to prevent execution/spread
        for root, dirs, files in os.walk(work_dir):
            for file in files:
                filepath = os.path.join(root, file)
                try:
                    # Windows read-only flag
                    os.chmod(filepath, stat.S_IREAD)
                except Exception:
                    pass

    await loop.run_in_executor(None, prepare_sandbox)
    return work_dir



def _update_run_status(
    run_id: int,
    status: str,
    error_message: Optional[str] = None,
    report_url: Optional[str] = None,
    work_dir_path: Optional[str] = None,
):
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if run:
            run.status = status
            run.updated_at = datetime.utcnow()
            if error_message:  run.error_message = error_message
            if report_url:     run.report_url = report_url
            if work_dir_path:  run.work_dir_path = work_dir_path
            session.add(run)
            session.commit()

def secure_wipe_directory(dir_path: str, passes: int = 3):
    """
    Secure Destroy feature: Overwrites all file bytes with randomized data multiple times
    before unlink to prevent recovery.
    """
    for root, dirs, files in os.walk(dir_path, topdown=False):
        for file in files:
            filepath = os.path.join(root, file)
            try:
                # Lift read-only restriction so we can wipe
                os.chmod(filepath, stat.S_IWRITE)
                length = os.path.getsize(filepath)
                # Overwrite passes
                if length > 0:
                    with open(filepath, "br+", buffering=0) as f:
                        for _ in range(passes):
                            f.seek(0)
                            f.write(os.urandom(length))
                            f.flush()
                            os.fsync(f.fileno())
                os.remove(filepath)
            except Exception:
                pass
        for d in dirs:
            try:
                os.rmdir(os.path.join(root, d))
            except Exception:
                pass
    try:
        shutil.rmtree(dir_path, ignore_errors=True)
    except Exception:
        pass
