"""
Pipeline Orchestrator — coordinates all 5 agents in sequence.
Streams SSE events to the frontend via the shared asyncio.Queue.
"""
import asyncio
import json
import os
import shutil
import tempfile
from datetime import datetime
from typing import Optional

from sqlmodel import Session

from models import AnalysisRun, AttackChain, GraphData, engine
from agents.scanner import run_scanner
from agents.graph_builder import build_graph
from agents.attack_path import reason_attack_paths
from agents.scorer import score_chains
from agents.deployer import deploy_report


async def emit(queue: asyncio.Queue, event: dict):
    """Push a structured event to the SSE queue."""
    await queue.put(event)


async def run_pipeline(run_id: int, repo_url: str, queue: asyncio.Queue):
    """
    Master pipeline state machine.
    Runs all agents in order, emitting SSE events at each stage.
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

        chains = await reason_attack_paths(run_id, findings, graph, queue)

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

        # ── Done ────────────────────────────────────────────────────────
        _update_run_status(run_id, "done", report_url=report_url)

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
        if work_dir and os.path.exists(work_dir):
            shutil.rmtree(work_dir, ignore_errors=True)


async def _clone_repo(repo_url: str, run_id: int, queue: asyncio.Queue) -> str:
    """Clone a GitHub repo to a temp directory. Returns the local path."""
    import git

    work_dir = tempfile.mkdtemp(prefix=f"acm_run_{run_id}_")

    await emit(queue, {
        "type": "log",
        "stage": "cloning",
        "message": f"Cloning {repo_url} → {work_dir}",
        "run_id": run_id,
    })

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: git.Repo.clone_from(repo_url, work_dir, depth=1)
    )
    return work_dir


def _update_run_status(
    run_id: int,
    status: str,
    error_message: Optional[str] = None,
    report_url: Optional[str] = None,
):
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if run:
            run.status = status
            run.updated_at = datetime.utcnow()
            if error_message:
                run.error_message = error_message
            if report_url:
                run.report_url = report_url
            session.add(run)
            session.commit()
