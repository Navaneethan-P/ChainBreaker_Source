"""
Graph-Builder Agent — parses Python source files using the AST module
to extract imports, function definitions, route decorators, and call relationships.
Produces a node/edge graph that the Attack-Path Agent reasons over.
"""
import ast
import asyncio
import json
import os
from pathlib import Path
from typing import Any

from sqlmodel import Session

from models import GraphData, engine


async def build_graph(
    run_id: int,
    work_dir: str,
    findings: list[dict],
    queue: asyncio.Queue,
) -> dict:
    """
    Parse all Python files in work_dir and build a component graph.
    Returns: {"nodes": [...], "edges": [...]}
    """
    loop = asyncio.get_event_loop()

    await queue.put({
        "type": "log",
        "stage": "graphing",
        "message": "Parsing Python AST for code structure...",
        "run_id": run_id,
    })

    graph = await loop.run_in_executor(None, lambda: _parse_project(work_dir, findings))

    await queue.put({
        "type": "log",
        "stage": "graphing",
        "message": f"AST complete: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges.",
        "run_id": run_id,
    })

    # Persist graph
    with Session(engine) as session:
        gd = GraphData(
            run_id=run_id,
            nodes_json=json.dumps(graph["nodes"]),
            edges_json=json.dumps(graph["edges"]),
        )
        session.add(gd)
        session.commit()

    return graph


def _parse_project(work_dir: str, findings: list[dict]) -> dict:
    nodes: list[dict] = []
    edges: list[dict] = []
    node_map: dict[str, str] = {}  # file_path → node_id

    py_files = list(Path(work_dir).rglob("*.py"))

    # ── Create a node for every Python file ──────────────────────────
    for py_file in py_files:
        rel = str(py_file.relative_to(work_dir)).replace("\\", "/")

        # Skip irrelevant files
        if any(skip in rel for skip in ["__pycache__", ".git", "venv", "site-packages"]):
            continue

        node_id = f"file:{rel}"
        node_map[rel] = node_id

        # Determine if this file has findings
        file_findings = [f for f in findings if rel in f.get("file_path", "")]
        severity = _worst_severity(file_findings)

        # Detect routes from decorators
        routes = _extract_routes(py_file)

        node_type = "config" if "config" in rel else (
            "route" if routes else (
                "entry" if rel.endswith("run.py") or rel.endswith("app.py") else "module"
            )
        )

        nodes.append({
            "id": node_id,
            "label": rel,
            "type": node_type,
            "file": rel,
            "severity": severity,
            "routes": routes,
            "finding_count": len(file_findings),
            "findings": [f["rule_id"] for f in file_findings],
        })

    # ── Parse imports to build edges ──────────────────────────────────
    for py_file in py_files:
        rel = str(py_file.relative_to(work_dir)).replace("\\", "/")
        if rel not in node_map:
            continue

        try:
            source = py_file.read_text(encoding="utf-8", errors="replace")
            tree = ast.parse(source)
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                # Resolve relative import to file path
                if isinstance(node, ast.ImportFrom) and node.module:
                    candidate = node.module.replace(".", "/") + ".py"
                    # Check if this maps to a known file
                    for known_rel in node_map:
                        if known_rel.endswith(candidate) or candidate in known_rel:
                            source_id = node_map[rel]
                            target_id = node_map[known_rel]
                            if source_id != target_id:
                                edges.append({
                                    "id": f"edge:{rel}->{known_rel}",
                                    "source": source_id,
                                    "target": target_id,
                                    "label": "imports",
                                    "type": "import",
                                })

    # ── Add dependency node (requirements.txt) ─────────────────────────
    req_findings = [f for f in findings if f["source"] == "pip-audit"]
    if req_findings:
        dep_node_id = "file:requirements.txt"
        nodes.append({
            "id": dep_node_id,
            "label": "requirements.txt",
            "type": "dependencies",
            "file": "requirements.txt",
            "severity": "ERROR",
            "routes": [],
            "finding_count": len(req_findings),
            "findings": [f["rule_id"] for f in req_findings],
        })
        node_map["requirements.txt"] = dep_node_id

        # Link the main app to dependencies
        for n in nodes:
            if n["type"] in ("entry", "route"):
                edges.append({
                    "id": f"edge:dep->{n['id']}",
                    "source": dep_node_id,
                    "target": n["id"],
                    "label": "depends on",
                    "type": "dependency",
                })
                break

    # Deduplicate edges
    seen = set()
    unique_edges = []
    for e in edges:
        key = (e["source"], e["target"])
        if key not in seen:
            seen.add(key)
            unique_edges.append(e)

    return {"nodes": nodes, "edges": unique_edges}


def _extract_routes(py_file: Path) -> list[str]:
    """Extract Flask/FastAPI route paths from decorators."""
    routes = []
    try:
        source = py_file.read_text(encoding="utf-8", errors="replace")
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Call):
                        func = decorator.func
                        if (
                            isinstance(func, ast.Attribute)
                            and func.attr == "route"
                            and decorator.args
                            and isinstance(decorator.args[0], ast.Constant)
                        ):
                            routes.append(str(decorator.args[0].value))
    except SyntaxError:
        pass
    return routes


def _worst_severity(findings: list[dict]) -> str:
    severities = [f.get("severity", "INFO") for f in findings]
    if "ERROR" in severities:
        return "ERROR"
    if "WARNING" in severities:
        return "WARNING"
    if severities:
        return "INFO"
    return "CLEAN"
