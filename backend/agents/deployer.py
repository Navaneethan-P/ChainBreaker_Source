"""
Report Deployment Agent — renders a self-contained static HTML report
and optionally pushes it to GitHub Pages via the GitHub API.

Strategy:
1. Always generate a local static HTML report (works offline / without GitHub token).
2. If GITHUB_TOKEN is set, push to gh-pages branch and return the live URL.
3. If no token, return a local file:// path (still works for demo).
"""
import asyncio
import base64
import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

import httpx

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


async def deploy_report(
    run_id: int,
    report_data: dict,
    queue: asyncio.Queue,
) -> str:
    """Generate static HTML report and optionally deploy to GitHub Pages."""

    await queue.put({
        "type": "log",
        "stage": "deploying",
        "message": "Rendering static HTML report...",
        "run_id": run_id,
    })

    html = _render_html_report(report_data)
    report_path = REPORTS_DIR / f"report_{run_id}.html"
    report_path.write_text(html, encoding="utf-8")

    await queue.put({
        "type": "log",
        "stage": "deploying",
        "message": f"Report rendered: {report_path.name}",
        "run_id": run_id,
    })

    # Try GitHub Pages deployment if token is set
    if GITHUB_TOKEN:
        try:
            live_url = await _push_to_github_pages(run_id, html, queue)
            return live_url
        except Exception as e:
            await queue.put({
                "type": "log",
                "stage": "deploying",
                "message": f"GitHub Pages deploy failed ({e}) — report served locally.",
                "run_id": run_id,
            })

    # Serve locally via FastAPI static files
    local_url = f"http://localhost:8000/reports/report_{run_id}.html"
    return local_url


async def _push_to_github_pages(
    run_id: int,
    html: str,
    queue: asyncio.Queue,
) -> str:
    """Push the report HTML to a gh-pages branch via GitHub API."""
    # Parse repo info from environment
    github_repo = os.getenv("GITHUB_REPO", "")  # e.g. "username/repo"
    if not github_repo:
        raise ValueError("GITHUB_REPO env var not set")

    filename = f"report_{run_id}.html"
    content_b64 = base64.b64encode(html.encode()).decode()

    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check if file already exists (need SHA for update)
        sha = None
        check = await client.get(
            f"https://api.github.com/repos/{github_repo}/contents/{filename}",
            headers=headers,
            params={"ref": "gh-pages"},
        )
        if check.status_code == 200:
            sha = check.json().get("sha")

        payload = {
            "message": f"Add Attack Chain Mapper report run#{run_id}",
            "content": content_b64,
            "branch": "gh-pages",
        }
        if sha:
            payload["sha"] = sha

        resp = await client.put(
            f"https://api.github.com/repos/{github_repo}/contents/{filename}",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()

    username = github_repo.split("/")[0]
    repo_name = github_repo.split("/")[1]
    live_url = f"https://{username}.github.io/{repo_name}/{filename}"

    await queue.put({
        "type": "log",
        "stage": "deploying",
        "message": f"✓ Report live at: {live_url}",
        "run_id": run_id,
    })

    return live_url


def _render_html_report(data: dict) -> str:
    """Render a complete, self-contained HTML report."""
    run_id = data["run_id"]
    repo_url = data["repo_url"]
    findings = data.get("findings", [])
    graph = data.get("graph", {"nodes": [], "edges": []})
    chains = data.get("chains", [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    chains_html = ""
    for i, chain in enumerate(chains):
        impact = chain.get("impact", "Low")
        impact_color = {"Critical": "#FF3B5C", "High": "#FFA630", "Low": "#3DDC97"}.get(impact, "#3DDC97")
        confidence_pct = int(chain.get("confidence", 0.5) * 100)
        steps_html = "".join([
            f"""<div class="step">
                <span class="step-node">{s.get('node','?')}</span>
                <span class="step-arrow">→</span>
                <div class="step-detail">
                    <strong>{s.get('weakness','')}</strong><br/>
                    <em>{s.get('action','')}</em>
                </div>
            </div>"""
            for s in chain.get("steps", [])
        ])
        chains_html += f"""
        <div class="chain-card" data-impact="{impact}">
            <div class="chain-header">
                <span class="chain-title">{chain.get('title','Chain '+str(i+1))}</span>
                <span class="impact-badge" style="background:{impact_color}">{impact}</span>
                <span class="confidence">Confidence: {confidence_pct}%</span>
            </div>
            <div class="chain-explanation">{chain.get('explanation','')}</div>
            <div class="chain-steps">{steps_html}</div>
        </div>"""

    findings_html = "".join([
        f"""<tr>
            <td class="severity-{f.get('severity','INFO').lower()}">{f.get('severity','?')}</td>
            <td>{f.get('source','?')}</td>
            <td><code>{f.get('file_path','?')}:{f.get('line_start',0)}</code></td>
            <td>{f.get('rule_id','?')}</td>
            <td>{f.get('message','')}</td>
        </tr>"""
        for f in findings
    ])

    graph_nodes_json = json.dumps(graph.get("nodes", []))
    graph_edges_json = json.dumps(graph.get("edges", []))
    chains_json = json.dumps(chains)

    critical_count = sum(1 for c in chains if c.get("impact") == "Critical")
    high_count = sum(1 for c in chains if c.get("impact") == "High")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Attack Chain Mapper — Report #{run_id}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>
:root{{
  --bg-primary:#0B0F17;--bg-panel:#141B26;--accent:#00D9FF;
  --critical:#FF3B5C;--high:#FFA630;--low:#3DDC97;
  --text-primary:#E8EDF2;--text-muted:#8B98A9;--border:#1E2A3A;
}}
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{background:var(--bg-primary);color:var(--text-primary);font-family:'Inter',sans-serif;line-height:1.6;}}
.header{{background:var(--bg-panel);border-bottom:1px solid var(--border);padding:2rem 3rem;}}
.header h1{{font-family:'Space Grotesk',sans-serif;font-size:1.8rem;color:var(--accent);}}
.header .meta{{color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem;}}
.header .repo-url{{color:var(--accent);font-family:'JetBrains Mono',monospace;font-size:0.8rem;}}
.stats-bar{{display:flex;gap:1.5rem;padding:1.5rem 3rem;background:var(--bg-panel);border-bottom:1px solid var(--border);}}
.stat{{background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:1rem 1.5rem;text-align:center;min-width:120px;}}
.stat-value{{font-family:'Space Grotesk',sans-serif;font-size:2rem;font-weight:700;}}
.stat-label{{color:var(--text-muted);font-size:0.8rem;margin-top:0.25rem;}}
.critical-val{{color:var(--critical);}}
.high-val{{color:var(--high);}}
.low-val{{color:var(--low);}}
.cyan-val{{color:var(--accent);}}
.content{{padding:2rem 3rem;max-width:1400px;}}
.section-title{{font-family:'Space Grotesk',sans-serif;font-size:1.2rem;color:var(--accent);margin:2rem 0 1rem;display:flex;align-items:center;gap:0.5rem;}}
.section-title::before{{content:'';display:block;width:3px;height:1.2rem;background:var(--accent);border-radius:2px;}}
#graph-container{{background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;height:400px;position:relative;overflow:hidden;margin-bottom:2rem;}}
#graph-svg{{width:100%;height:100%;}}
.chain-card{{background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;transition:border-color 0.2s;}}
.chain-card:hover{{border-color:var(--accent);}}
.chain-header{{display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;}}
.chain-title{{font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:600;flex:1;}}
.impact-badge{{padding:0.25rem 0.75rem;border-radius:20px;font-size:0.75rem;font-weight:600;color:#000;}}
.confidence{{color:var(--text-muted);font-size:0.8rem;font-family:'JetBrains Mono',monospace;}}
.chain-explanation{{color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem;line-height:1.7;}}
.chain-steps{{display:flex;flex-direction:column;gap:0.75rem;}}
.step{{display:flex;align-items:flex-start;gap:0.75rem;background:var(--bg-primary);border-radius:8px;padding:0.75rem;}}
.step-node{{font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--accent);white-space:nowrap;min-width:160px;}}
.step-arrow{{color:var(--text-muted);font-size:1.2rem;}}
.step-detail{{font-size:0.85rem;}}
.step-detail strong{{color:var(--critical);}}
.step-detail em{{color:var(--text-muted);}}
.findings-table{{width:100%;border-collapse:collapse;font-size:0.85rem;}}
.findings-table th{{text-align:left;padding:0.75rem;background:var(--bg-panel);color:var(--text-muted);font-weight:500;border-bottom:1px solid var(--border);}}
.findings-table td{{padding:0.75rem;border-bottom:1px solid var(--border);}}
.findings-table code{{font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--accent);}}
.severity-error{{color:var(--critical);font-weight:600;font-family:'JetBrains Mono',monospace;font-size:0.75rem;}}
.severity-warning{{color:var(--high);font-weight:600;font-family:'JetBrains Mono',monospace;font-size:0.75rem;}}
.severity-info{{color:var(--low);font-weight:600;font-family:'JetBrains Mono',monospace;font-size:0.75rem;}}
.footer{{text-align:center;padding:2rem;color:var(--text-muted);font-size:0.8rem;border-top:1px solid var(--border);margin-top:3rem;}}
.node-clean{{fill:#2A3644;}} .node-error{{fill:#FF3B5C;opacity:0.8;}} .node-warning{{fill:#FFA630;opacity:0.8;}} .node-clean-route{{fill:#00D9FF;opacity:0.5;}}
.link{{stroke:#2A3644;stroke-width:1.5;}}
.link-active{{stroke:#00D9FF;stroke-width:2.5;animation:glow 1.5s ease-in-out infinite;}}
@keyframes glow{{0%,100%{{stroke-opacity:0.6;}}50%{{stroke-opacity:1;}}}}
.node-label{{fill:var(--text-muted);font-size:10px;font-family:'JetBrains Mono',monospace;}}
</style>
</head>
<body>
<div class="header">
  <h1>⚔️ Attack Chain Mapper — Security Report</h1>
  <div class="meta">Generated {timestamp} | Run #{run_id}</div>
  <div class="repo-url">🔗 {repo_url}</div>
</div>

<div class="stats-bar">
  <div class="stat"><div class="stat-value critical-val">{critical_count}</div><div class="stat-label">Critical Chains</div></div>
  <div class="stat"><div class="stat-value high-val">{high_count}</div><div class="stat-label">High Chains</div></div>
  <div class="stat"><div class="stat-value cyan-val">{len(chains)}</div><div class="stat-label">Total Chains</div></div>
  <div class="stat"><div class="stat-value cyan-val">{len(findings)}</div><div class="stat-label">Vulnerabilities</div></div>
  <div class="stat"><div class="stat-value low-val">{len(graph.get('nodes',[]))}</div><div class="stat-label">Components</div></div>
</div>

<div class="content">
  <div class="section-title">Attack Graph</div>
  <div id="graph-container"><svg id="graph-svg"></svg></div>

  <div class="section-title">Attack Chains (Ranked by Impact)</div>
  {chains_html if chains_html else '<p style="color:var(--text-muted)">No attack chains identified.</p>'}

  <div class="section-title">All Vulnerability Findings</div>
  <table class="findings-table">
    <thead><tr><th>Severity</th><th>Source</th><th>Location</th><th>Rule ID</th><th>Description</th></tr></thead>
    <tbody>{findings_html}</tbody>
  </table>
</div>

<div class="footer">
  Generated by <strong style="color:var(--accent)">Attack Chain Mapper</strong> — Autonomous Security Sentinel<br/>
  100% open-source · Local AI · Zero paid APIs
</div>

<script>
const graphNodes = {graph_nodes_json};
const graphEdges = {graph_edges_json};
const chains = {chains_json};

// Collect active node IDs from all chains
const activeNodeIds = new Set();
chains.forEach(c => (c.node_ids||[]).forEach(id => activeNodeIds.add(id)));

const svg = d3.select("#graph-svg");
const container = document.getElementById("graph-container");
const width = container.clientWidth;
const height = container.clientHeight;

if (graphNodes.length > 0) {{
  const sim = d3.forceSimulation(graphNodes)
    .force("link", d3.forceLink(graphEdges).id(d=>d.id).distance(120))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width/2, height/2));

  const g = svg.append("g");

  svg.call(d3.zoom().on("zoom", e => g.attr("transform", e.transform)));

  const link = g.selectAll(".link")
    .data(graphEdges).enter().append("line")
    .attr("class", d => {{
      const srcActive = activeNodeIds.has(typeof d.source==="string"?d.source:d.source.id);
      const tgtActive = activeNodeIds.has(typeof d.target==="string"?d.target:d.target.id);
      return (srcActive && tgtActive) ? "link link-active" : "link";
    }});

  const node = g.selectAll(".node-g")
    .data(graphNodes).enter().append("g").attr("class","node-g")
    .call(d3.drag()
      .on("start", (e,d)=>{{ if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }})
      .on("drag", (e,d)=>{{ d.fx=e.x; d.fy=e.y; }})
      .on("end", (e,d)=>{{ if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; }})
    );

  node.append("circle")
    .attr("r", d => activeNodeIds.has(d.id) ? 12 : 8)
    .attr("fill", d => {{
      if (activeNodeIds.has(d.id)) {{
        if (d.severity==="ERROR") return "#FF3B5C";
        if (d.severity==="WARNING") return "#FFA630";
        return "#00D9FF";
      }}
      return "#2A3644";
    }})
    .attr("stroke", d => activeNodeIds.has(d.id) ? "#fff" : "none")
    .attr("stroke-width", 1.5);

  node.append("text")
    .attr("dy","1.5em").attr("text-anchor","middle")
    .attr("class","node-label")
    .text(d => d.label.split("/").pop().substring(0,16));

  sim.on("tick", ()=>{{
    link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
        .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
    node.attr("transform",d=>`translate(${{d.x}},${{d.y}})`);
  }});
}}
</script>
</body>
</html>"""
