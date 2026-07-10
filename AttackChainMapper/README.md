# ⚔️ Attack Chain Mapper — Autonomous Security Sentinel

> **BYTEFORGE 2026 Submission** — Open Track

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-yellow.svg)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![Ollama](https://img.shields.io/badge/AI-Ollama%20Local%20LLM-purple.svg)](https://ollama.com)

**One click on a GitHub repo URL → autonomous multi-agent pipeline scans for vulnerabilities, maps how they connect, reasons out realistic attack chains using a local open-source AI model, scores impact, and auto-deploys a live shareable report — zero paid APIs, zero manual triage.**

---

## 🎯 The Problem

Security scanners give you a flat list — *"you have 40 vulnerabilities"* — but they don't tell you how an attacker would actually chain them together to break in. Attack Chain Mapper fills that gap.

## 💡 What Makes This Different

| Feature | Attack Chain Mapper | Dependabot / Snyk |
|---------|--------------------|--------------------|
| Shows flat CVE list | ✅ | ✅ |
| **Reasons about attack chains** | ✅ **Core feature** | ❌ |
| Local AI, zero cost | ✅ | ❌ (paid API) |
| Auto-deploys live report | ✅ | ❌ |
| Works fully offline | ✅ | ❌ |

---

## 🏗️ Architecture — 5-Agent Pipeline

```
GitHub Repo URL (1 click)
        ↓
[1] Scanner Agent     → Semgrep SAST + pip-audit CVEs
        ↓
[2] Graph-Builder     → Python AST → code component graph
        ↓
[3] Attack-Path AI    → Ollama qwen2.5-coder:3b + confidence-check loop
        ↓
[4] Impact Scorer     → Critical / High / Low classification
        ↓
[5] Report Deployer   → Static HTML + GitHub Pages (live URL)
        ↓
Live dashboard streams every step via SSE
```

**Key differentiator — Confidence-Check Loop:** The Attack-Path Agent self-reports a confidence score for each proposed chain (0–1). If confidence < 0.6, it re-examines that chain with a narrower follow-up prompt before accepting — a genuine decision point, not a fixed script.

---

## 🛠️ Tech Stack — 100% Free & Open-Source

| Layer | Choice |
|-------|--------|
| Backend | Python 3.11 + FastAPI |
| AI Reasoning | Ollama + `qwen2.5-coder:3b` (local, no API key) |
| SAST | Semgrep Community Edition |
| Dependency Scan | pip-audit |
| Code Graph | Python `ast` module |
| Frontend | Next.js 15 + Tailwind CSS |
| Graph Visualization | D3.js (force-directed, animated) |
| Real-time Updates | Server-Sent Events (SSE) |
| Database | SQLite via SQLModel |
| Report Hosting | GitHub Pages (free, public repos) |

---

## 🚀 Quick Start

### Prerequisites

```powershell
# Check these are installed:
python --version      # 3.11+
node --version        # 18+
ollama --version      # any

# Pull the AI model (one-time, ~2GB):
ollama pull qwen2.5-coder:3b

# Start Ollama service:
ollama serve
```

### Backend Setup

```powershell
cd AttackChainMapper\backend
pip install -r requirements.txt
copy .env.example .env
# Edit .env — add your GITHUB_TOKEN for Pages deployment (optional)
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```powershell
cd AttackChainMapper\frontend
npm install
npm run dev
# Open: http://localhost:3000
```

### Run the Demo

1. Open `http://localhost:3000`
2. Paste the demo repo URL: `https://github.com/Navaneethan-P/Forge`
3. Click **⚡ Analyze**
4. Watch the 5-agent pipeline run live

---

## 🔬 Demo Vulnerabilities (Planted for Demo)

The `demo-repo/` contains 4 deliberately planted vulnerabilities:

| # | Type | Location | What it does |
|---|------|----------|--------------|
| 1 | Outdated Dependency | `requirements.txt` | Flask 0.12.2 — known CVEs |
| 2 | SQL Injection | `app/routes/user.py` | f-string query construction |
| 3 | Hardcoded Secret | `app/config.py` | `SECRET_KEY` in plaintext |
| 4 | Missing Auth | `app/routes/admin.py` | No check on `/admin/delete-user` |

**The Attack Chain the AI discovers:**
```
Hardcoded Secret (config.py)
    → Unauthenticated Admin Route (admin.py)
        → SQL Injection in DELETE query
            → Zero-credential full database takeover
```

---

## 🎨 Design System

Dark SOC (Security Operations Center) dashboard aesthetic:

| Token | Color |
|-------|-------|
| Background | `#0B0F17` |
| Panels | `#141B26` |
| Accent (cyan) | `#00D9FF` |
| Critical | `#FF3B5C` |
| High | `#FFA630` |
| Low / Safe | `#3DDC97` |

Fonts: **Space Grotesk** (headings) · **Inter** (body) · **JetBrains Mono** (code)

---

## 📁 Project Structure

```
AttackChainMapper/
├── backend/                 # FastAPI Python backend
│   ├── main.py              # App entry + REST + SSE
│   ├── orchestrator.py      # Pipeline state machine
│   ├── models.py            # SQLite models
│   ├── agents/
│   │   ├── scanner.py       # Semgrep + pip-audit
│   │   ├── graph_builder.py # AST code graph
│   │   ├── attack_path.py   # Ollama reasoning + confidence loop
│   │   ├── scorer.py        # Impact classification
│   │   └── deployer.py      # GitHub Pages deploy
│   └── reports/             # Generated HTML reports
├── frontend/                # Next.js app
│   └── src/
│       ├── app/page.tsx     # Landing page
│       ├── app/results/     # Live results page
│       └── components/      # StatusFeed, AttackGraph, ChainCards
├── demo-repo/               # Intentionally vulnerable Flask app
└── PlanB/                   # Original project plan documents
```

---

## ⚠️ Ethical Use

- Only scan repos you own or have explicit permission to scan.
- The `demo-repo/` contains deliberate vulnerabilities — **never deploy it to production**.
- This tool is a prioritization aid for security review, not an automated verdict system.

---

## 🔮 Future Scope

- Multi-language support (JavaScript, Java, Go)
- CI/CD webhook integration (block merge on Critical chains)
- Auto-generated fix suggestions (PR generation)
- Historical risk posture tracking over time
- Upgrade to `qwen2.5-coder:7b` on GPU-equipped hardware

---

*Built for BYTEFORGE 2026 · MIT License · Author: Navaneethan P*
