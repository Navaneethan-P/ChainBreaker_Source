"""
Scanner Agent — runs Semgrep (SAST) + pip-audit (Python deps) + npm audit (Node deps).
Normalises all findings into a unified structure and persists to SQLite.

Windows-compatible: uses sys.executable for Python-based tools instead of bare
command names that may not be on PATH inside a venv or frozen environment.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from sqlmodel import Session

from models import Finding, engine

# ─── Tool resolution ────────────────────────────────────────────────────────────
# On Windows, calling bare "semgrep" or "pip-audit" fails with WinError 2 when
# the venv Scripts/ directory is not in PATH. Prefer sys.executable -m <module>.

def _python_tool(*args):
    """Run a Python module tool via the current interpreter — always found."""
    return [sys.executable, "-m"] + list(args)

def _find_tool(name: str):
    """
    Find a tool executable: check shutil.which first, fall back to
    Scripts/ beside sys.executable (Windows venv layout).
    """
    found = shutil.which(name)
    if found:
        return found
    scripts = Path(sys.executable).parent
    for candidate in [name, name + ".exe", name + ".cmd"]:
        p = scripts / candidate
        if p.exists():
            return str(p)
    return None


async def run_scanner(run_id: int, work_dir: str, queue: asyncio.Queue) -> list[dict]:
    """
    Run SAST and dependency scanning across Python and Node ecosystems.
    Returns a unified list of findings.
    """
    findings: list[dict] = []

    # ── Semgrep SAST ────────────────────────────────────────────────────
    await queue.put({
        "type": "log", "stage": "scanning",
        "message": "Running Semgrep SAST scan...",
        "run_id": run_id,
    })
    semgrep_findings = await _run_semgrep(run_id, work_dir, queue)
    findings.extend(semgrep_findings)
    await queue.put({
        "type": "log", "stage": "scanning",
        "message": f"Semgrep: {len(semgrep_findings)} code-level findings.",
        "run_id": run_id,
    })

    # ── Dependency scans — parallel ──────────────────────────────────────
    has_requirements = os.path.exists(os.path.join(work_dir, "requirements.txt"))
    has_pyproject    = os.path.exists(os.path.join(work_dir, "pyproject.toml"))
    has_package_json = os.path.exists(os.path.join(work_dir, "package.json"))

    dep_tasks  = []
    task_labels = []

    if has_requirements or has_pyproject:
        label = "requirements.txt" if has_requirements else "pyproject.toml"
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": f"Detected {label} — running pip-audit...",
            "run_id": run_id,
        })
        dep_tasks.append(_run_pip_audit(run_id, work_dir))
        task_labels.append("pip-audit")
    else:
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": "No Python dependency file — skipping pip-audit.",
            "run_id": run_id,
        })

    if has_package_json:
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": "Detected package.json — running npm audit...",
            "run_id": run_id,
        })
        dep_tasks.append(_run_npm_audit(run_id, work_dir, queue))
        task_labels.append("npm-audit")
    else:
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": "No package.json — skipping npm audit.",
            "run_id": run_id,
        })

    # Supply Chain Risk Analysis (Runs concurrently with audits)
    dep_tasks.append(_analyze_supply_chain_risk(run_id, work_dir, queue))
    task_labels.append("supply-chain-risk")

    if dep_tasks:
        results = await asyncio.gather(*dep_tasks, return_exceptions=True)
        for label, result in zip(task_labels, results):
            if isinstance(result, Exception):
                await queue.put({
                    "type": "log", "stage": "scanning",
                    "message": f"{label} error: {result}",
                    "run_id": run_id,
                })
            else:
                findings.extend(result)
                await queue.put({
                    "type": "log", "stage": "scanning",
                    "message": f"{label}: {len(result)} vulnerable dependencies.",
                    "run_id": run_id,
                })

    # ── Persist ──────────────────────────────────────────────────────────
    _persist_findings(run_id, findings)
    return findings


async def _run_semgrep(run_id: int, work_dir: str, queue: asyncio.Queue) -> list[dict]:
    """Run Semgrep via sys.executable (avoids WinError 2) and return normalised findings."""
    loop = asyncio.get_event_loop()

    # Try: python -m semgrep, then fall back to bare semgrep binary
    semgrep_bin = _find_tool("semgrep")
    if semgrep_bin:
        cmd = [semgrep_bin, "--config", "auto", "--json", "--quiet", "--no-error",
               "--timeout", "60", work_dir]
    else:
        # python -m semgrep
        cmd = _python_tool("semgrep", "--config", "auto", "--json", "--quiet",
                           "--no-error", "--timeout", "60", work_dir)

    def _exec():
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
            )
            return result.stdout or result.stderr
        except FileNotFoundError as e:
            return json.dumps({"results": [], "error": str(e)})
        except subprocess.TimeoutExpired:
            return json.dumps({"results": []})

    try:
        raw = await loop.run_in_executor(None, _exec)
        # Find JSON in output (semgrep sometimes prepends warnings)
        start = raw.find("{")
        data = json.loads(raw[start:]) if start >= 0 else {"results": []}
    except (json.JSONDecodeError, ValueError):
        data = {"results": []}

    if data.get("error"):
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": f"Semgrep warning: {data['error'][:120]}",
            "run_id": run_id,
        })

    findings = []
    for r in data.get("results", []):
        rel_path = r.get("path", "").replace(work_dir, "").lstrip("/\\").replace("\\", "/")
        findings.append({
            "source":     "semgrep",
            "rule_id":    r.get("check_id", "unknown"),
            "severity":   r.get("extra", {}).get("severity", "WARNING").upper(),
            "file_path":  rel_path or r.get("path", ""),
            "line_start": r.get("start", {}).get("line", 0),
            "message":    r.get("extra", {}).get("message", r.get("check_id", "")),
            "extra":      json.dumps(r.get("extra", {})),
        })
    return findings


async def _run_pip_audit(run_id: int, work_dir: str) -> list[dict]:
    """
    Run pip-audit via sys.executable -m pip_audit (Windows-safe).
    Scans requirements.txt or the project directory.
    """
    loop = asyncio.get_event_loop()
    req_file = os.path.join(work_dir, "requirements.txt")
    has_req  = os.path.exists(req_file)

    if has_req:
        cmd = _python_tool("pip_audit", "-r", req_file, "-f", "json",
                           "--progress-spinner", "off", "--skip-editable")
    else:
        # Scan whole project (picks up pyproject.toml)
        cmd = _python_tool("pip_audit", "-f", "json",
                           "--progress-spinner", "off", "--skip-editable",
                           work_dir)

    def _exec():
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
                cwd=work_dir,
            )
            # pip-audit exits 1 when vulnerabilities found — stdout still has JSON
            return result.stdout
        except FileNotFoundError as e:
            return json.dumps({"error": f"pip_audit not found: {e}", "dependencies": []})
        except subprocess.TimeoutExpired:
            return json.dumps({"dependencies": []})

    try:
        raw  = await loop.run_in_executor(None, _exec)
        start = raw.find("{")
        data  = json.loads(raw[start:]) if start >= 0 else {"dependencies": []}
    except (json.JSONDecodeError, ValueError):
        data = {"dependencies": []}

    findings = []
    for dep in data.get("dependencies", []):
        for vuln in dep.get("vulns", []):
            findings.append({
                "source":     "pip-audit",
                "rule_id":    vuln.get("id", "CVE-UNKNOWN"),
                "severity":   "ERROR",
                "file_path":  "requirements.txt" if has_req else "pyproject.toml",
                "line_start": 0,
                "message": (
                    f"{dep.get('name', '?')} {dep.get('version', '?')} — "
                    f"{vuln.get('description', vuln.get('id', ''))}"
                ),
                "extra": json.dumps(vuln),
            })
    return findings


async def _run_npm_audit(run_id: int, work_dir: str, queue: asyncio.Queue) -> list[dict]:
    """Run npm audit against package.json — skips gracefully if npm not found."""
    loop = asyncio.get_event_loop()

    npm = _find_tool("npm") or _find_tool("npm.cmd")
    if not npm:
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": "npm not found — skipping npm audit.",
            "run_id": run_id,
        })
        return []

    def _exec():
        # npm audit requires node_modules; install deps first (offline preferred)
        subprocess.run(
            [npm, "install", "--ignore-scripts", "--prefer-offline", "--no-fund"],
            capture_output=True, text=True, timeout=120, cwd=work_dir,
        )
        result = subprocess.run(
            [npm, "audit", "--json"],
            capture_output=True, text=True, timeout=120, cwd=work_dir,
        )
        return result.stdout

    try:
        raw  = await loop.run_in_executor(None, _exec)
        data = json.loads(raw) if raw.strip() else {}
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        data = {}

    findings = []
    for pkg_name, vuln_info in data.get("vulnerabilities", {}).items():
        severity   = vuln_info.get("severity", "moderate").upper()
        sev_map    = {"CRITICAL": "ERROR", "HIGH": "ERROR", "MODERATE": "WARNING", "LOW": "INFO"}
        sev        = sev_map.get(severity, "WARNING")
        via        = vuln_info.get("via", [])
        cve_ids    = [v.get("title", v.get("url", "")) for v in via if isinstance(v, dict) and v.get("url")]
        messages   = [v.get("title", "") for v in via if isinstance(v, dict)]

        findings.append({
            "source":     "npm-audit",
            "rule_id":    cve_ids[0] if cve_ids else f"npm:{pkg_name}",
            "severity":   sev,
            "file_path":  "package.json",
            "line_start": 0,
            "message": (
                f"{pkg_name} ({vuln_info.get('range', '?')}) — "
                f"{'; '.join(messages) or vuln_info.get('severity', 'vulnerability')}"
            ),
            "extra": json.dumps({
                "severity": vuln_info.get("severity"),
                "fixAvailable": vuln_info.get("fixAvailable"),
            }),
        })
    return findings


async def _analyze_supply_chain_risk(run_id: int, work_dir: str, queue: asyncio.Queue) -> list[dict]:
    """Analyze project configuration files for structural supply chain weaknesses."""
    findings = []
    work_path = Path(work_dir)
    
    # ── Node.js Risks ───────────────────────────────────────────────────
    if (work_path / "package.json").exists():
        try:
            with open(work_path / "package.json", "r", encoding="utf-8") as f:
                pkg = json.load(f)
            
            # Missing Lockfile
            has_lock = any((work_path / lock).exists() for lock in ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"])
            if not has_lock:
                findings.append({
                    "source": "supply-chain-risk", "rule_id": "missing-lockfile", "severity": "ERROR",
                    "file_path": "package.json", "line_start": 1,
                    "message": "No lockfile found (package-lock.json / yarn.lock). This is a critical supply chain risk."
                })
            
            # Risky Install Scripts
            scripts = pkg.get("scripts", {})
            for risky in ["preinstall", "install", "postinstall"]:
                if risky in scripts:
                    findings.append({
                        "source": "supply-chain-risk", "rule_id": f"risky-script-{risky}", "severity": "WARNING",
                        "file_path": "package.json", "line_start": 1,
                        "message": f"Contains an '{risky}' script. This script executes automatically during installation and is a common vector for malicious packages."
                    })
            
            # Unpinned Dependencies
            unpinned = []
            for dep_type in ["dependencies", "devDependencies"]:
                for dep, ver in pkg.get(dep_type, {}).items():
                    if any(c in str(ver) for c in ["^", "~", "*", ">", "<"]):
                        unpinned.append(dep)
            if unpinned:
                findings.append({
                    "source": "supply-chain-risk", "rule_id": "unpinned-deps", "severity": "WARNING",
                    "file_path": "package.json", "line_start": 1,
                    "message": f"Found {len(unpinned)} unpinned dependencies (e.g., {unpinned[0]}). This allows silent installation of vulnerable updates."
                })
                
        except Exception as e:
            pass
            
    # ── Python Risks ────────────────────────────────────────────────────
    req_path = work_path / "requirements.txt"
    if req_path.exists():
        try:
            with open(req_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            unpinned = []
            for i, line in enumerate(lines):
                line = line.strip()
                if line and not line.startswith("#") and "==" not in line and ">=" not in line and "<=" not in line:
                    if not line.startswith("-e") and not line.startswith("git+"):
                        unpinned.append(line.split()[0])
            
            if unpinned:
                findings.append({
                    "source": "supply-chain-risk", "rule_id": "unpinned-python-deps", "severity": "WARNING",
                    "file_path": "requirements.txt", "line_start": 1,
                    "message": f"Found {len(unpinned)} completely unpinned dependencies (e.g., {unpinned[0]}). Use '==' to pin specific safe versions."
                })
        except Exception:
            pass

    if findings:
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": f"Supply Chain Risk Analysis: Found {len(findings)} structural weaknesses.",
            "run_id": run_id,
        })
    else:
        await queue.put({
            "type": "log", "stage": "scanning",
            "message": "Supply Chain Risk Analysis: No structural weaknesses found.",
            "run_id": run_id,
        })
        
    return findings


def _persist_findings(run_id: int, findings: list[dict]):
    with Session(engine) as session:
        for f in findings:
            session.add(Finding(
                run_id=run_id,
                source=f["source"],
                rule_id=f["rule_id"],
                severity=f["severity"],
                file_path=f["file_path"],
                line_start=f["line_start"],
                message=f["message"],
                extra=f.get("extra"),
            ))
        session.commit()
