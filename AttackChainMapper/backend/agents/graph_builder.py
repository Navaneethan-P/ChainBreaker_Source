"""
Graph-Builder Agent — parses Python source files using the AST module,
and JavaScript/TypeScript files using regex, to extract imports,
function definitions, route decorators, and call relationships.
Produces a node/edge graph that the Attack-Path Agent reasons over.
"""
import ast
import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any

from sqlmodel import Session

from models import GraphData, engine

# Regex for JS/TS import/require detection
_JS_IMPORT_RE = re.compile(
    r"""(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"]([^'"]+)['"]""",
    re.MULTILINE,
)

# Regex for Express/Next.js route patterns
_JS_ROUTE_RE = re.compile(
    r"""(?:app|router)\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]""",
    re.MULTILINE,
)


async def build_graph(
    run_id: int,
    work_dir: str,
    findings: list[dict],
    queue: asyncio.Queue,
) -> dict:
    """
    Parse all Python + JS/TS files in work_dir and build a component graph.
    Returns: {"nodes": [...], "edges": [...]}
    """
    loop = asyncio.get_event_loop()

    await queue.put({
        "type": "log",
        "stage": "graphing",
        "message": "Parsing Python AST + JavaScript/TypeScript imports for code structure...",
        "run_id": run_id,
    })

    graph = await loop.run_in_executor(None, lambda: _parse_project(work_dir, findings))

    await queue.put({
        "type": "log",
        "stage": "graphing",
        "message": f"Graph complete: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges.",
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
    js_files = [
        f for ext in ("*.js", "*.ts", "*.mjs", "*.jsx", "*.tsx")
        for f in Path(work_dir).rglob(ext)
    ]

    # ── Create a node for every Python file ──────────────────────────
    for py_file in py_files:
        rel = str(py_file.relative_to(work_dir)).replace("\\", "/")

        # Skip irrelevant files
        if any(skip in rel for skip in ["__pycache__", ".git", "venv", "site-packages"]):
            continue

        node_id = f"file:{rel}"
        node_map[rel] = node_id

        file_findings = [f for f in findings if rel in f.get("file_path", "")]
        severity = _worst_severity(file_findings)
        routes = _extract_python_routes(py_file)

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
            "ecosystem": "python",
        })

    # ── Create a node for every JS/TS file ───────────────────────────
    for js_file in js_files:
        rel = str(js_file.relative_to(work_dir)).replace("\\", "/")

        # Skip node_modules, build artifacts
        if any(skip in rel for skip in ["node_modules", ".next", "dist", ".git", "build"]):
            continue

        node_id = f"file:{rel}"
        node_map[rel] = node_id

        file_findings = [f for f in findings if rel in f.get("file_path", "")]
        severity = _worst_severity(file_findings)
        routes = _extract_js_routes(js_file)

        # Classify JS/TS node type
        if "route" in rel or "api" in rel.lower():
            node_type = "route"
        elif "config" in rel or rel.endswith("next.config.js") or rel.endswith("next.config.ts"):
            node_type = "config"
        elif routes:
            node_type = "route"
        else:
            node_type = "module"

        nodes.append({
            "id": node_id,
            "label": rel,
            "type": node_type,
            "file": rel,
            "severity": severity,
            "routes": routes,
            "finding_count": len(file_findings),
            "findings": [f["rule_id"] for f in file_findings],
            "ecosystem": "javascript",
        })

    # ── Parse Python imports to build edges ──────────────────────────
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
                if isinstance(node, ast.ImportFrom) and node.module:
                    candidate = node.module.replace(".", "/") + ".py"
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

    # ── Parse JS/TS imports to build edges ───────────────────────────
    for js_file in js_files:
        rel = str(js_file.relative_to(work_dir)).replace("\\", "/")
        if rel not in node_map:
            continue
        if any(skip in rel for skip in ["node_modules", ".next", "dist", ".git", "build"]):
            continue

        try:
            source = js_file.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        for match in _JS_IMPORT_RE.finditer(source):
            import_path = match.group(1)
            # Only resolve relative imports (start with . or ..)
            if not import_path.startswith("."):
                continue

            # Resolve relative path
            base_dir = Path(rel).parent
            resolved = (base_dir / import_path).as_posix()

            # Try with various extensions
            for ext in ("", ".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"):
                candidate = resolved + ext
                if candidate in node_map:
                    source_id = node_map[rel]
                    target_id = node_map[candidate]
                    if source_id != target_id:
                        edges.append({
                            "id": f"edge:{rel}->{candidate}",
                            "source": source_id,
                            "target": target_id,
                            "label": "imports",
                            "type": "import",
                        })
                    break

    # ── Add dependency node for requirements.txt (Python) ─────────────
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
            "ecosystem": "python",
        })
        node_map["requirements.txt"] = dep_node_id

        # Link the main app to dependencies
        for n in nodes:
            if n["type"] in ("entry", "route") and n.get("ecosystem") == "python":
                edges.append({
                    "id": f"edge:dep->{n['id']}",
                    "source": dep_node_id,
                    "target": n["id"],
                    "label": "depends on",
                    "type": "dependency",
                })
                break

    # ── Add dependency node for package.json (Node.js) ────────────────
    npm_findings = [f for f in findings if f["source"] == "npm-audit"]
    if npm_findings:
        pkg_node_id = "file:package.json"
        nodes.append({
            "id": pkg_node_id,
            "label": "package.json",
            "type": "dependencies",
            "file": "package.json",
            "severity": "ERROR",
            "routes": [],
            "finding_count": len(npm_findings),
            "findings": [f["rule_id"] for f in npm_findings],
            "ecosystem": "javascript",
        })
        node_map["package.json"] = pkg_node_id

        # Link to JS entry points
        for n in nodes:
            if n["type"] in ("entry", "route") and n.get("ecosystem") == "javascript":
                edges.append({
                    "id": f"edge:pkgjson->{n['id']}",
                    "source": pkg_node_id,
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


def _extract_python_routes(py_file: Path) -> list[str]:
    """Extract Flask/FastAPI route paths from Python decorators."""
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


def _extract_js_routes(js_file: Path) -> list[str]:
    """Extract Express.js route paths from JS/TS source using regex."""
    try:
        source = js_file.read_text(encoding="utf-8", errors="replace")
        return _JS_ROUTE_RE.findall(source)
    except OSError:
        return []


def _worst_severity(findings: list[dict]) -> str:
    severities = [f.get("severity", "INFO") for f in findings]
    if "ERROR" in severities:
        return "ERROR"
    if "WARNING" in severities:
        return "WARNING"
    if severities:
        return "INFO"
    return "CLEAN"
