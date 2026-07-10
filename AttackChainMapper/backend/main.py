"""
FastAPI main application — Attack Chain Mapper backend.
Exposes REST + SSE endpoints for the pipeline.
"""
import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

load_dotenv()

from fastapi.staticfiles import StaticFiles
from pathlib import Path

from models import AnalysisRun, AttackChain, Finding, GraphData, create_db_and_tables, engine
from orchestrator import run_pipeline

REPORTS_DIR = Path(__file__).parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Attack Chain Mapper API",
    description="Autonomous security sentinel — multi-agent vulnerability chain analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/reports", StaticFiles(directory=str(REPORTS_DIR)), name="reports")

# In-memory SSE queues per run_id
_sse_queues: dict[int, asyncio.Queue] = {}


class AnalyzeRequest(BaseModel):
    repo_url: str


@app.get("/", tags=["health"])
async def root():
    return {
        "service": "Attack Chain Mapper",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/analyze", tags=["pipeline"])
async def start_analysis(req: AnalyzeRequest):
    """Start a new analysis run. Returns run_id for SSE streaming."""
    if not req.repo_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid repo URL")

    with Session(engine) as session:
        run = AnalysisRun(repo_url=req.repo_url, status="pending")
        session.add(run)
        session.commit()
        session.refresh(run)
        run_id = run.id

    # Create SSE queue for this run
    queue: asyncio.Queue = asyncio.Queue()
    _sse_queues[run_id] = queue

    # Launch pipeline in background
    asyncio.create_task(run_pipeline(run_id, req.repo_url, queue))

    return {"run_id": run_id, "status": "pending"}


@app.get("/api/stream/{run_id}", tags=["pipeline"])
async def stream_events(run_id: int):
    """SSE endpoint — streams pipeline progress events in real time."""

    async def event_generator() -> AsyncGenerator[str, None]:
        # If queue doesn't exist yet, create it (in case of page refresh)
        if run_id not in _sse_queues:
            _sse_queues[run_id] = asyncio.Queue()

        queue = _sse_queues[run_id]

        # Send current status from DB immediately on connect
        with Session(engine) as session:
            run = session.get(AnalysisRun, run_id)
            if run:
                initial = json.dumps({"type": "status", "stage": run.status, "run_id": run_id})
                yield f"data: {initial}\n\n"

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"

                # Signal end of stream on terminal states
                if event.get("type") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                # Heartbeat to keep connection alive
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"

        # Cleanup queue
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


@app.get("/api/runs/{run_id}", tags=["results"])
async def get_run(run_id: int):
    """Get full analysis run with findings, graph, and chains."""
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        findings = session.exec(select(Finding).where(Finding.run_id == run_id)).all()
        graph = session.exec(select(GraphData).where(GraphData.run_id == run_id)).first()
        chains = session.exec(
            select(AttackChain).where(AttackChain.run_id == run_id).order_by(AttackChain.chain_index)
        ).all()

        return {
            "run": {
                "id": run.id,
                "repo_url": run.repo_url,
                "status": run.status,
                "report_url": run.report_url,
                "created_at": run.created_at.isoformat(),
                "error_message": run.error_message,
            },
            "findings": [
                {
                    "id": f.id,
                    "source": f.source,
                    "rule_id": f.rule_id,
                    "severity": f.severity,
                    "file_path": f.file_path,
                    "line_start": f.line_start,
                    "message": f.message,
                }
                for f in findings
            ],
            "graph": {
                "nodes": json.loads(graph.nodes_json) if graph else [],
                "edges": json.loads(graph.edges_json) if graph else [],
            },
            "chains": [
                {
                    "id": c.id,
                    "chain_index": c.chain_index,
                    "title": c.title,
                    "steps": json.loads(c.steps_json),
                    "impact": c.impact,
                    "confidence": c.confidence,
                    "explanation": c.explanation,
                    "node_ids": json.loads(c.node_ids_json),
                }
                for c in chains
            ],
        }


@app.get("/api/runs", tags=["results"])
async def list_runs():
    """List all analysis runs."""
    with Session(engine) as session:
        runs = session.exec(select(AnalysisRun).order_by(AnalysisRun.created_at.desc())).all()
        return [
            {
                "id": r.id,
                "repo_url": r.repo_url,
                "status": r.status,
                "report_url": r.report_url,
                "created_at": r.created_at.isoformat(),
            }
            for r in runs
        ]
