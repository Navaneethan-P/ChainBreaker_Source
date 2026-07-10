# Attack Chain Mapper — Autonomous Security Sentinel
## Complete Project Build Guide (A–Z) — 100% Free & Open-Source Stack — BYTEFORGE 2026

---

## 0. BYTEFORGE 2026 — Event Rules Alignment

| Rule | How this project handles it |
|---|---|
| Open statement track chosen | This project is submitted as-is, as your fixed, chosen solution |
| No on-spot registration | N/A — administrative |
| AI tools + open-source libraries encouraged | 100% open-source AI (local LLM via Ollama) and open-source scanning tools — no paid API required anywhere |
| Two rounds: R1 (workstation screening) and R2 (final functional prototype + pitch) | Section 13 gives a dedicated R1 checklist and R2 pitch structure |
| Judging pillars: Novelty, AI Usage, Tech Stack, Implementation, UI/UX, Pitching | Section 14 maps every pillar to a specific feature of this project |

**Cost check:** every single tool, library, model, and hosting service in this guide has a genuinely free tier with no credit card requirement and no "pro" upgrade needed to function. This is called out explicitly in Section 7 and Section 15.

**Before you touch any code:** run through Section 1A — the Pre-Build Checklist — to confirm your machine has everything installed and working.

---

## 1. Title

**Attack Chain Mapper — Autonomous Security Sentinel**

Tagline: *"One click. AI traces how weaknesses chain into a real attack — and ships a live report, automatically. Fully open-source, zero API cost."*

---

## 1A. Pre-Build Checklist — PC Requirements (Check → Install/Setup)

Run through this before opening Antigravity or writing any code. For each item: run the check command, then follow the matching branch.

### ☐ RAM
**Check:**
```powershell
Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum | ForEach-Object {"$($_.Sum / 1GB) GB"}
```
- **If ≥ 8GB:** ✅ OK — proceed using the 3B model (Section 7)
- **If < 8GB:** ⚠️ Close other heavy apps (browser tabs, IDE extensions) before running the model; consider `qwen2.5-coder:1.5b` if available instead of 3B

### ☐ Free disk space
**Check:**
```powershell
Get-PSDrive C | Select-Object Used,Free
```
- **If ≥ 10GB free:** ✅ OK
- **If < 10GB free:** ⚠️ Free up space first (uninstall unused apps, clear Downloads/Recycle Bin) — model downloads will fail or system will slow down otherwise

### ☐ CPU / GPU
**Check:**
```powershell
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores
Get-CimInstance Win32_VideoController | Select-Object Name
```
- **Any modern quad-core:** ✅ OK, no setup needed — Ollama runs on CPU fine for the 3B model
- **NVIDIA GPU present:** ✅ Bonus speed, no extra setup needed for this project's scope

### ☐ Python
**Check:**
```powershell
python --version
```
- **If 3.11+:** ✅ OK
- **If missing or older:** Install from [python.org/downloads](https://python.org/downloads) → during install, **check "Add Python to PATH"** → re-open PowerShell → re-run the check

### ☐ Node.js
**Check:**
```powershell
node --version
```
- **If 18+:** ✅ OK
- **If missing or older:** Install the LTS version from [nodejs.org](https://nodejs.org) → re-open PowerShell → re-run the check

### ☐ Git
**Check:**
```powershell
git --version
```
- **If installed:** ✅ OK
- **If missing:** Install from [git-scm.com/downloads](https://git-scm.com/downloads) → re-open PowerShell → re-run the check

### ☐ Ollama (service + model)
**Check:**
```powershell
ollama --version
ollama list
```
- **If "could not connect to a running Ollama instance":** the service isn't started — run:
  ```powershell
  ollama serve
  ```
  Leave that window open, then use a **new** PowerShell window for the next steps.
- **If Ollama not installed at all:** download and install from [ollama.com/download](https://ollama.com/download), then run `ollama serve`
- **If `qwen2.5-coder:3b` is NOT listed in `ollama list`:** pull it now, on good wifi, well before the event:
  ```powershell
  ollama pull qwen2.5-coder:3b
  ```
- **If already listed (as confirmed on this build):** ✅ OK, no action needed

### ☐ Model sanity test (structured output)
**Check:**
```powershell
ollama run qwen2.5-coder:3b
```
Then type:
```
Return only valid JSON, nothing else: {"test": "ok"}
```
- **If it returns clean JSON with no extra text:** ✅ Confirmed ready — this is the exact behavior the Attack-Path and Impact Scoring agents depend on
- **If it adds extra commentary/markdown fences:** not a blocker, but note it — build the JSON-parse-with-one-retry safeguard from Phase 3 (Section 9) from the very start, don't skip it

### ☐ Remaining Python packages (install once, not a check)
```powershell
pip install semgrep pip-audit
```
No version check needed — just confirm the install completes without errors.

---

**All checked off? You're fully ready to start building in Antigravity.** Proceed to Section 2 for the project concept, or straight to Section 9 (Phase 1) if you just want the build steps.

---

## 2. Problem Statement

Security scanners (Semgrep, npm audit, Dependabot, Snyk-lite tools) report vulnerabilities as a **flat, isolated list** — "you have 12 SAST findings and 40 CVEs." But real attackers don't exploit issues one at a time. They **chain weak points together**:

> A minor information leak → exposes an internal endpoint → combined with a weak auth check → reaches an admin token → full system compromise.

No accessible tool — especially for students, solo developers, and small teams without enterprise budgets — shows **that path**. Teams are left with a wall of CVE IDs and no sense of what actually matters or how issues connect into real risk. Existing paid security platforms solve parts of this, but require licenses most students and small teams can't access. This project proves the same reasoning is achievable with a **fully free, open-source stack** — no paid API, no cloud LLM subscription.

---

## 3. Solution / Idea

**Attack Chain Mapper** is a multi-agent AI system that:

1. Takes a single input — a GitHub repo URL
2. Autonomously scans it for vulnerabilities and weak configurations
3. Builds a map of how the code's components/services connect
4. Uses a **locally-run, open-weight LLM** to reason out **realistic attack chains** — not a flat list, but a path
5. Scores each chain by real-world impact (what does it actually reach?)
6. **Automatically deploys a live, shareable report** as a hosted URL — with zero further user effort, using free hosting

The core idea: a fully autonomous, single-input pipeline that ends in a real deployed artifact, applied to a genuinely underserved problem — **attack-path reasoning** — built entirely on tools that cost nothing and require no vendor lock-in.

**What makes this more than "another autonomous pipeline":** the Attack-Path Agent doesn't just execute a fixed sequence — it self-evaluates its own reasoning confidence and re-examines uncertain chains before finalizing them (Section 4). Most single-input-to-deployed-artifact projects apply that pattern to *generation* (build an app, build a report). This applies it to *adversarial reasoning* — modeling how a third party would exploit the system, which is a fundamentally different reasoning task, not just a different subject matter.

---

## 4. How It Works (End-to-End Flow)

```
User pastes a GitHub repo URL and clicks one button
        v
[1] Scanner Agent
    Runs SAST (Semgrep, free CLI) + dependency vulnerability audit (open source)
    -> Produces raw list of findings (CVEs, code smells, insecure patterns)
        v
[2] Graph-Builder Agent
    Parses imports, function calls, and route definitions
    -> Produces a component/service graph: nodes = files/services/endpoints,
       edges = calls / data flow between them
        v
[3] Attack-Path Agent (core differentiator)
    Local open-weight LLM (via Ollama) reasons over findings + graph together
    -> Proposes 1-3 realistic chained exploit paths:
       "Weakness A exposes X -> chained with Weakness B reaches Y"
        v
[4] Impact Scoring Agent
    Same local LLM scores each chain by what it ultimately reaches
    (data access / admin access / low-value) -> ranks Critical/High/Low
        v
[5] Report Deployment Agent
    Renders findings + animated graph as a static site
    Auto-deploys via GitHub Pages (free, unlimited for public repos) -> live URL
        v
Live dashboard streams every step in real time (SSE), ending in:
  - An animated graph showing the attack path lighting up node-by-node
  - Ranked attack-chain cards with plain-English explanations
  - A clickable, shareable, hosted report URL
```

---

## 5. System Architecture

```
+-----------------------------------------------------------------+
|                     FRONTEND (Next.js)                          |
|  - Landing page: repo URL input, single "Analyze" button        |
|  - Live pipeline status feed (SSE): Scanning -> Mapping ->       |
|    Reasoning -> Scoring -> Deploying                             |
|  - Result view: animated graph (D3.js/vis.js) + ranked cards    |
+---------------------------+---------------------------------------+
                             | REST + SSE
+---------------------------v---------------------------------------+
|                  BACKEND (FastAPI, Python)                        |
|  +---------------+  +----------------+  +-------------------+     |
|  | Scanner Agent |->| Graph-Builder  |->| Attack-Path Agent |     |
|  +---------------+  | Agent          |  +---------+---------+     |
|                      +----------------+            |               |
|  +-----------------------------------+  +----------v---------+     |
|  | Impact Scoring Agent               |->| Report Deployment  |     |
|  +-----------------------------------+  | Agent               |     |
|                                          +---------------------+     |
|  Orchestrator: custom Python state machine (no paid framework)      |
|  DB: SQLite (pipeline runs, findings, graphs, chains)                |
+---------------------------+---------------------------------------+
                             |
        +--------------------+--------------------+
        v                    v                     v
   Semgrep CLI      pip-audit / npm-audit     Ollama (local LLM)
   (SAST scan,      (dependency CVEs,         Llama 3.1 8B or
   free/open src)   free/open src)            Qwen2.5-Coder 7B
                                               (open-weight, free)
                             |
                             v
                  GitHub Pages (free static hosting)
                  (auto-publishes final report via GitHub API)
```

---

## 6. Modules Breakdown

| # | Module | Responsibility |
|---|--------|-----------------|
| 1 | **Ingestion Module** | Accepts repo URL, clones/reads it into a temp workspace |
| 2 | **Scanner Module** | Runs Semgrep + dependency audit tools, normalizes findings into structured JSON |
| 3 | **Graph Module** | Parses code structure (imports, function calls, route definitions) into a node/edge graph |
| 4 | **Reasoning Module** | Sends findings + graph to a local Ollama model, requests structured attack-chain output (JSON schema) |
| 5 | **Scoring Module** | Sends each chain to the same local model for impact classification (Critical/High/Low) |
| 6 | **Report Builder Module** | Renders results into a static HTML/JS report with animated graph |
| 7 | **Deployment Module** | Pushes the static report to a GitHub Pages branch via GitHub API, returns live URL |
| 8 | **Orchestration Module** | Coordinates all agents in sequence, streams status updates via SSE |
| 9 | **Frontend Module** | Input UI, live status feed, final animated results view |

---

---

## 6A. Demo Repo — Concrete Planted Vulnerabilities (Build This Now, Not at 2AM)

Build a small Flask (Python) app with exactly these 4 planted issues — specific and testable, not vague:

**1. Outdated dependency (dependency-audit finding)**
```
# requirements.txt
Flask==0.12.2
```
(An old Flask version with known CVEs — pip-audit will flag this immediately.)

**2. SQL injection (SAST finding)**
```python
# app/routes/user.py
@app.route("/user")
def get_user():
    user_id = request.args.get("id")
    query = f"SELECT * FROM users WHERE id = {user_id}"  # unsanitized
    return db.execute(query).fetchone()
```

**3. Hardcoded secret (SAST finding)**
```python
# app/config.py
SECRET_KEY = "sk_live_51H8xJ2eZ9k3mLp"  # hardcoded, should be env var
ADMIN_PASSWORD = "admin123"
```

**4. Missing auth check (the "chain" piece — connects to #3)**
```python
# app/routes/admin.py
@app.route("/admin/delete-user")
def delete_user():
    # no auth decorator, no session check
    user_id = request.args.get("id")
    db.execute(f"DELETE FROM users WHERE id={user_id}")
    return "deleted"
```

**Why this set is a good demo:** it lets the Attack-Path Agent build a genuinely real chain — "hardcoded secret (#3) + unauthenticated admin route (#4) + SQL injection (#2) → attacker with no credentials can read and delete any user record." That's a believable, explainable, 3-node story for your live animated graph, not an abstract list.

Build and commit this sample repo **days before** the event, and rehearse the full pipeline against it repeatedly (Phase 3, Section 9).

---

## 7. Tech Stack & Languages — 100% Free / Open-Source

| Layer | Choice | Cost | Why |
|---|---|---|---|
| Backend language | Python 3.11+ | Free, open source | Best ecosystem for AST parsing, scanning tool integration |
| Backend framework | FastAPI | Free, open source (MIT) | Async support, SSE-friendly, fast to build |
| Orchestration | Custom Python state machine (plain `if/else`/class-based flow) | Free | Avoids any paid/metered orchestration framework dependency |
| SAST scanner | Semgrep Community Edition (CLI) | Free, open source | Multi-language, no account required for CLI scans |
| Dependency scanner | pip-audit (Python) / `npm audit` (JS, built-in) / OWASP Dependency-Check (Java) | Free, open source | Pick ONE matching your demo repo's language |
| Code graph parsing | Python `ast` module | Free, built-in | No extra dependency |
| **AI model / reasoning** | **Ollama running Qwen2.5-Coder 3B-Instruct (open weights)** | **Free, runs locally, no API key, no rate limit** | Confirmed working on target hardware (8GB RAM laptop) — genuinely open-source, no cloud billing risk during demo |
| Frontend framework | Next.js + Tailwind CSS | Free, open source | Fast to build, clean styling system |
| Graph visualization | D3.js or vis-network | Free, open source | Animated node/edge graphs |
| Real-time updates | Server-Sent Events (SSE, built into HTTP/FastAPI) | Free | Simpler than WebSockets |
| Database | SQLite | Free, built-in | Zero-config, sufficient for hackathon scope |
| **Deployment target** | **GitHub Pages** (via GitHub REST API, `gh-pages` branch push) | **Free, unlimited for public repos, no card required** | Replaces Vercel/Netlify to avoid any paid-tier ambiguity |
| Version control | Git + GitHub REST API | Free | Repo ingestion + deployment |

**Why Ollama specifically:** it runs entirely on your own laptop — no API key, no internet dependency during inference, no per-token cost, and no risk of hitting a paid usage cap mid-demo in front of judges. This is also a direct strength for the "AI Usage" and "Tech Stack" judging pillars, since it shows genuine technical depth (running and prompting a local model correctly) rather than just calling a hosted API.

**Confirmed model:** `qwen2.5-coder:3b` — already installed and tested on the build machine (8GB RAM). This is the locked model for the final build; it balances reasoning quality with speed on constrained hardware, and avoids any risk of the 7B variant slowing down or stalling during a live demo. If a more powerful machine becomes available later, `qwen2.5-coder:7b` remains a valid upgrade path (see Section 12).

---

## 8. Design System (Colors, Fonts, UI Tone)

**Visual theme:** Dark, security/terminal-inspired but clean — a modern SOC (Security Operations Center) dashboard feel, not a hacker-movie cliché.

**Color palette:**
| Purpose | Color | Hex |
|---|---|---|
| Background (primary) | Deep charcoal navy | `#0B0F17` |
| Background (panels) | Slightly lighter navy | `#141B26` |
| Primary accent | Electric cyan | `#00D9FF` |
| Critical severity | Alert red | `#FF3B5C` |
| High severity | Amber orange | `#FFA630` |
| Low severity | Muted green | `#3DDC97` |
| Text (primary) | Off-white | `#E8EDF2` |
| Text (secondary/muted) | Slate gray | `#8B98A9` |
| Graph edges (default) | Soft blue-gray | `#2A3644` |
| Graph edges (active/lit path) | Electric cyan (animated glow) | `#00D9FF` |

**Typography:**
- Headings: `Space Grotesk` or `Sora` (Google Fonts, free)
- Body text: `Inter`
- Code/monospace elements (findings, CVE IDs): `JetBrains Mono` or `Fira Code`

**UI tone:** Minimal chrome, generous whitespace on dark background, glowing accent highlights only on active/critical elements — draws the eye exactly where it should go during a live demo, which directly supports the UI/UX judging pillar.

**Minimum-viable fallback (if time runs short):** if the animated D3/vis-network graph isn't finished in time, fall back to a simple ranked list of attack-chain cards (still styled with the color palette above) with a plain arrow diagram (`Entry → Weakness A → Weakness B → Target`) drawn as styled HTML/CSS boxes instead of an animated SVG graph. This still looks intentional and clean — never demo an unstyled default-browser page, even under time pressure.

---

## 9. Implementation Plan (Build Timeline, Hours 0–48)

**Phase 1 — Setup (Hours 0–4)**
- Ollama installed and running (`ollama serve`), with `qwen2.5-coder:3b` already pulled and confirmed — verify with `ollama list` and a test prompt before building further
- Repo scaffolding (backend + frontend folders)
- FastAPI skeleton with SSE endpoint
- Next.js skeleton with basic input form
- Build/select your demo target: a small sample repo with 3–4 deliberately planted vulnerabilities (outdated dependency, SQL string concatenation, hardcoded secret, missing auth check on a route)

**Phase 2 — Scanner + Graph (Hours 4–14)**
- Integrate Semgrep, run against sample repo, normalize output to JSON
- Integrate one dependency auditor
- Build graph parser (Python `ast`) — extract imports/calls between files in sample repo
- Store findings + graph in SQLite

**Phase 3 — AI Reasoning (Hours 14–24)**
- Set up local Ollama API calls (`http://localhost:11434/api/generate` or `/api/chat`) from FastAPI
- Design structured prompt for Attack-Path Agent (input: findings + graph JSON -> output: ranked chain JSON, each chain including a self-reported `confidence` field 0–1)
- Implement the confidence-check loop: if any chain's confidence is below ~0.6, re-prompt the model with a narrower, single-chain-focused follow-up before accepting or discarding it — this is the genuine agentic decision point (see Section 4)
- Design structured prompt for Impact Scoring Agent
- Add JSON-parsing retry logic (if the model returns malformed JSON, re-prompt once with the error) — important safeguard for local models
- Test against sample repo until output is consistent and demo-reliable (test at least 10–15 times, more than you'd need for a hosted API, since local model output can be less consistent)

**Priority reminder — walking skeleton first:** get one findings-in → chain-out flow fully working end-to-end (even ugly, even with dummy UI) before polishing anything. A complete, plain, working pipeline scores far better on Implementation than a beautiful UI wrapped around a broken backend. Add polish only after the whole thing runs start to finish reliably.

**Phase 4 — Frontend + Live Feed (Hours 24–34)**
- Build live status feed UI (SSE-driven)
- Build animated graph view (highlight path node-by-node)
- Build ranked attack-chain cards view
- Apply design system (colors/fonts above)

**Phase 5 — Deployment Integration (Hours 34–42)**
- Build static report generator (HTML/JS export of final results)
- Integrate GitHub API to push the static report to a `gh-pages` branch (or a dedicated results repo) and construct the live `https://<username>.github.io/<repo>/` URL
- Test full pipeline end-to-end at least 5 times for reliability

**Phase 6 — Polish + Rehearsal (Hours 42–48)**
- Record a backup demo video of a full clean run (extra important here — local LLM inference speed can vary by machine, so a backup protects against a slow run during judging)
- Rehearse the live demo script at least 3 times
- Pre-warm the model before your demo slot (`ollama run qwen2.5-coder:3b` once beforehand) so the first inference call isn't slower due to cold model loading
- Prepare fallback: if live scan fails or runs slow, switch to backup video seamlessly

---

---

## 9A. Risk Register & Mitigations (Read Before Event Day)

| Risk | Likelihood | Mitigation |
|---|---|---|
| GitHub Pages doesn't go live fast enough during demo | Medium | Pre-provision the Pages site (enable it once, days beforehand, with a placeholder page). Subsequent deploys to an already-enabled Pages site are fast (usually under a minute) |
| Venue wifi drops during repo clone or Pages push | Medium | Clone the demo repo to local disk beforehand as a fallback; if live network fails, run the pipeline against the local copy and show the backup demo video for the deploy step specifically |
| Local model (`qwen2.5-coder:3b`) returns malformed JSON mid-demo | Medium | JSON-parse-with-retry logic (Phase 3) must be built and tested, not skipped; test 15+ times before the event, not just once |
| Laptop battery dies mid-pitch | Low-Medium | Charge fully before R1 and R2, bring charger, know venue power outlet locations in advance |
| Judges ask to see the repo history / suspect it's not original | Low | Maintain real incremental git commits from day one (see Section 16A) — never one big dump commit |
| Live demo simply fails for an unknown reason | Medium | Backup video of a full clean run is mandatory — rehearsed switch-over, no panic, keep narrating |
| Model inference is slow on stage (CPU-only laptop) | Medium | Pre-warm the model before your slot; if it's still slow, narrate through the wait rather than standing silently — the live status feed UI already frames this as "the AI thinking," not a bug |

---

## 10. Event-Day Plan

1. Arrive with the full pipeline already built and tested end-to-end (per Section 9)
2. Confirm Ollama and the model are already downloaded locally — **do not rely on venue wifi to pull the model on the day**
3. Confirm GitHub Pages is already enabled and live from your pre-provisioning step (Section 9A) — do not enable it for the first time on event day
4. Have the demo repo cloned locally as a network-failure fallback
5. Do one final full rehearsal run before R1 to confirm everything still works on battery power / venue conditions
6. Proceed to R1 with the checklist in Section 13

---

## 11. Demo Script (For Judges)

1. Open the app — show the single input field and button ("one click, zero configuration, fully offline-capable AI reasoning")
2. Paste the prepared demo repo URL, click Analyze
3. Narrate the live status feed as it streams: "Scanning... Mapping structure... Reasoning about chains using a locally-run open-source model, no cloud API... Scoring impact... Deploying report..."
4. When the graph appears, let the path animate — narrate it as a story: "Here's the entry point... it reaches this weak point... which chains into this high-impact target"
5. Show the ranked cards (Critical/High/Low)
6. Click the final live report URL on screen — open it in a new tab in front of judges as proof it's real and hosted
7. Mention explicitly: "This entire AI pipeline runs on open-weight models locally — no API keys, no cloud cost, fully reproducible by anyone"
8. Close with future scope (Section 12) in one sentence

---

## 12. Future Scope

- Multi-language support beyond the single demo language
- Continuous monitoring mode — re-scan on every GitHub push via webhook
- Integration with CI/CD pipelines (block merge on Critical chains)
- Team collaboration — comment/assign chains to team members
- Historical trend tracking — risk posture over time
- Support for infrastructure-as-code scanning (Terraform, Docker configs) for cloud-level chains
- Auto-generated fix suggestions (optional PR generation) as a v2 feature, kept separate from the core MVP to avoid live-demo fragility
- Optional upgrade path: swap to `qwen2.5-coder:7b` or larger open models on more powerful/GPU-equipped hardware for deeper reasoning, while staying fully open-source

---

## 13. Round-by-Round Strategy (R1 and R2)

### Round 1 (R1) — Workstation Screening
Judges review concept, tech stack, and progress at your desk. Keep this ready:
- **30-second concept pitch** memorized: what it does, why it's different, one sentence on the architecture
- **Architecture diagram visible on screen** (Section 5) — judges often want to see structure, not just UI
- **Show real progress, not just plans** — even partial working pipeline (e.g., scanner + graph working, AI reasoning in progress) beats a polished slide deck with no code running
- **Be ready to justify tech choices** in one sentence each — especially "why local LLM over a cloud API": *"Zero cost, zero API key dependency, fully reproducible by anyone without a subscription — and it proves the reasoning works without relying on a paid third party"*

### Round 2 (R2) — Final Prototype + Pitch
Shortlisted teams present a functional prototype, UI/UX, and final pitch.
- **Live functional demo is mandatory** — follow Section 11's script exactly, rehearsed
- **Always have the backup video ready** — if live fails or the local model runs slow, switch without panic, keep narrating
- **Pitch structure (aim for 3–4 minutes):**
  1. Problem (15 sec) — the flat-list vs. attack-chain gap
  2. Solution (15 sec) — one click, autonomous, fully open-source, ends in a live URL
  3. Live demo (2 min) — the core moment
  4. Tech depth (30 sec) — multi-agent architecture, local LLM reasoning specifics
  5. Future scope + close (30 sec)
- **Anticipate judge questions:**
  - "How is this different from Dependabot/Snyk?" → attack-*chain* reasoning vs. isolated findings, plus fully autonomous zero-effort deployment
  - "Why a local model instead of GPT/Claude API?" → zero cost, no vendor lock-in, works offline, and it's a genuine technical achievement to get reliable structured reasoning out of a smaller open-weight model
  - "Is the AI reasoning reliable?" → explain the structured JSON schema + retry-on-malformed-output approach (Phase 3)
  - "What if it's wrong / hallucinates a chain?" → be honest: it's a prioritization aid, not a guarantee — flag this as a known limitation, which reads as maturity, not weakness

---

## 14. Judging Pillars — Direct Mapping

| Pillar | How this project satisfies it |
|---|---|
| **Novelty** | Attack-*chain* reasoning (not flat vulnerability lists) is a genuinely underserved angle compared to existing scanners |
| **AI Usage** | Two distinct local-LLM reasoning stages (attack-path generation + impact scoring) with structured JSON output and retry handling — genuine, technically deeper AI use than a single hosted-API wrapper prompt |
| **Tech Stack** | Every tool is free, open-source, and justified (Section 7) — no unnecessary complexity, no vendor dependency, fully reproducible |
| **Implementation** | End-to-end working pipeline, real scanner output, real deployed report URL — not mocked data |
| **UI/UX** | Dedicated design system (Section 8), live status feed, animated graph — visual clarity is a first-class feature |
| **Pitching** | Section 13's R2 structure gives a rehearsed, tight narrative with anticipated Q&A, including a strong, honest answer for "why local AI over paid API" |

---

## 15. Requirements Summary (Quick Reference — All Free)

**No paid API keys required anywhere in this stack.**

**Software confirmed installed and ready:**
- Python 3.11.9 ✅
- Node.js v25.9.0 ✅
- Git 2.54.0 ✅
- [Ollama](https://ollama.com) — running, with `qwen2.5-coder:3b` pulled and confirmed ✅

**Still to install (free):**
- Semgrep (`pip install semgrep`) — free CLI, no account needed
- pip-audit (`pip install pip-audit`) — free

**Accounts needed (all free tier, no card):**
- GitHub account (for repo cloning + GitHub Pages deployment)

**Environment variables:**
```
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b
GITHUB_TOKEN=            # personal access token, free, for API calls + Pages deploy
DATABASE_URL=sqlite:///./sentinel.db
```

**Hardware note:** build machine confirmed at 8GB RAM, running `qwen2.5-coder:3b` — tested and working. This is the right model size for this hardware; do not switch to the 7B variant on this machine, as it risks slower or stalled responses during a live demo.

---

## 16. Why This Project Stands Out

- **Original angle**: attack-*chain* reasoning, not isolated vulnerability listing — a genuinely underserved gap even against existing scanners
- **Zero-effort autonomous flow**: one input, no further human steps, ending in a real deployed artifact
- **Low live-demo risk**: no code is modified or executed dangerously; the pipeline reasons and visualizes, safer to demo live than auto-patching
- **Visually compelling**: an animated attack path tells a story in real time, memorable beyond a status list
- **Genuinely free and open-source end-to-end**: this is a real differentiator most hackathon teams skip — most competitors will be calling paid hosted LLM APIs; running a real multi-agent reasoning pipeline entirely offline on open-weight models is a harder, more impressive technical feat, and removes any risk of hitting rate limits or billing issues live in front of judges
- **Built for BYTEFORGE's actual format**: structured for both R1 (progress-focused) and R2 (pitch-focused) evaluation

---

---

## 16A. Originality & Ethical Use Notes

- **Only ever scan your own demo repo** (Section 6A) or repos you have explicit permission to scan. Never run this live against a real third-party production project — surfacing real vulnerabilities publicly, even accidentally, is an ethical and legal problem, not a demo win.
- **Commit incrementally from day one.** Real git history (small commits: "add scanner agent," "fix graph parser bug," "add SSE endpoint") is both good practice and protects you if anyone questions originality. Avoid one large initial commit dumping the whole project at once.
- **Add a LICENSE (MIT) and a clear README** to your repo — states authorship plainly, standard practice, costs nothing.
- **If asked directly what inspired the idea**, it's fine and honest to say you looked at patterns from other autonomous AI-pipeline hackathon projects and built your own original take on a different, underserved problem (attack-chain reasoning). This reads as informed, not derivative.

## 16C. Self-Evaluation Scorecard (Judge's-Eye View)

Honest scoring, re-assessed after the fixes in this section (confidence-check loop, adversarial-reasoning framing, walking-skeleton-first priority, UI fallback):

| Pillar | Score /10 | Notes |
|---|---|---|
| Novelty | 7.5 | Adversarial-reasoning framing (Section 3) distinguishes this from generation-focused autonomous pipelines, not just a different subject matter |
| AI Usage | 7.5 | Confidence-check loop (Section 4, 9) gives the pipeline a genuine decision point, not just sequential calls |
| Tech Stack | 8.5 | Free/open-source, reliable local LLM — a real technical strength |
| Implementation | 6.5→ (depends entirely on your execution) | Walking-skeleton-first priority reduces the risk of a polished-but-broken demo; actual score depends on what you build |
| UI/UX | 7.5 | Fallback spec (Section 8) ensures it never looks unfinished even under time pressure |
| Pitching | 8.5 | Rehearsed script + Q&A answers, including a direct answer to "is this really multi-agent" |

**Remaining honest risk:** Implementation is the one pillar only you can raise, and only by actually building and testing it — no amount of planning substitutes for a working, rehearsed, reliable demo.

## 16B. Companion Document

A separate, rehearsal-ready pitch speech script (30-second elevator version + full 3–4 minute R2 pitch + anticipated Q&A answers) is provided alongside this guide — see `AttackChainMapper_PitchSpeech.md`.

---

*This guide is intended as a complete build reference for your fixed, open-track submission, using only free and open-source tools throughout. Any AI coding assistant or development team can follow Sections 5–9 sequentially to implement the full system from scratch, and Sections 10–14 to prepare for the actual event format.*
