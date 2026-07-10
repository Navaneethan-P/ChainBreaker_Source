# Attack Chain Mapper — Pitch Speech Script
## Companion to the Project Build Guide

---

## 1. The 30-Second Elevator Version (Use in R1)

Use this when a judge walks up to your workstation and asks "what does your project do?"

> "Security scanners tell you 'you have 40 vulnerabilities,' but they don't tell you how an attacker would actually chain them together to break in. Attack Chain Mapper takes a repo URL, runs it through an autonomous multi-agent pipeline — scan, map, reason, score — and ends by auto-deploying a live report showing the actual attack path. And the AI reasoning runs entirely on an open-source model on our own laptop — no paid API, no cloud dependency."

Then let them ask follow-ups. Don't over-explain unprompted — leave room for their questions.

---

## 2. The Full R2 Pitch (3–4 Minutes, Timed)

### Opening — Problem (15 seconds)
> "Every security scanner today gives you a flat list — CVE-1234, CVE-5678 — and leaves you to figure out what actually matters. But attackers don't think in lists. They think in chains: one small weakness opens the door to the next, until they've reached something valuable. Nobody's showing teams that chain — especially not for free."

### Solution (15 seconds)
> "Attack Chain Mapper does exactly that. One click on a repo URL. Zero further input. It autonomously scans, maps how the code connects, reasons out the realistic attack path, scores the impact, and deploys a live shareable report — all without a single paid API call."

### Live Demo (2 minutes) — narrate exactly what's happening as it streams
> "Watch the status feed — it's scanning right now with Semgrep and a dependency audit... now it's mapping how these files actually connect to each other... now here's the interesting part — it's reasoning about the attack chain using a model running locally on this laptop, completely offline capable, no API key..."

*(When the graph animates)*
> "Here's the story it found: this hardcoded secret combined with this missing auth check on the admin route means someone with zero credentials can reach and delete any user record. That's not a list of 40 issues — that's the one path that actually matters."

*(When the report deploys)*
> "And here — this is a real, live, hosted URL, deployed automatically, that we could send to any team right now."

*(Click the link, show it loading in front of them)*

### Technical Depth (30 seconds)
> "Under the hood this is a five-agent pipeline — scanner, graph-builder, attack-path reasoning, impact scoring, and deployment — coordinated through a custom orchestrator. The reasoning agent doesn't just guess once — it self-reports a confidence score on each proposed attack chain, and if confidence is low, it re-examines that chain with a narrower follow-up before accepting it. That's a real decision loop, not a fixed script. And the model itself is Qwen2.5-Coder, an open-weight model, running entirely local — zero cost, zero rate limits, works even offline for the reasoning step."

### Future Scope + Close (30 seconds)
> "Next steps are multi-language support, CI/CD integration so this runs on every push, and optional auto-generated fixes. But even at this stage, it proves something: you don't need an enterprise security budget or a paid AI subscription to get real attack-path intelligence. That's the whole point."

---

## 3. Anticipated Judge Questions — Rehearsed Answers

**Q: "How is this different from Dependabot or Snyk?"**
> "Those tools are excellent at finding individual issues, but they report them as a flat list. We specifically reason about how issues *chain together* into a realistic attack path — that's the gap we're filling, not competing on raw vulnerability detection."

**Q: "Why use a local model instead of GPT or Claude's API?"**
> "Three reasons: zero cost so anyone can run this without a subscription, no vendor lock-in, and no risk of hitting a rate limit or billing issue live in front of you right now. It's also a genuinely harder technical problem — getting reliable structured reasoning out of a smaller open model takes more careful prompt engineering than just calling a frontier API."

**Q: "Isn't this just calling an AI model twice — how is that 'multi-agent'?"**
> "Fair to push on that. The key difference is the reasoning agent doesn't just run once and stop — it self-evaluates its own confidence on each proposed chain, and if it's uncertain, it triggers a second, narrower reasoning pass before finalizing. That's an actual decision point in the pipeline, not a fixed script — the agent is choosing whether to trust its own output."

**Q: "What if the AI gets the attack chain wrong, or hallucinates?"**
> "Honestly — it's a prioritization aid, not a guarantee. We treat its output as a strong starting point for a human reviewer, not an automatic verdict. That's an intentional design choice, not a limitation we're hiding."

**Q: "Can this scale to real production codebases?"**
> "The current scope is intentionally focused — one language, a clear demo case — to prove the core reasoning works end-to-end. Scaling to larger, multi-language codebases is the natural next step, and the architecture doesn't need to change to get there, just the parsing layer."

**Q: "Is this project original — did you build this from scratch?"**
> "Yes — the idea, the code, and the architecture are ours. We looked at how other autonomous AI pipelines are structured for inspiration on the pattern of 'one click, fully autonomous, ends in a live deployed artifact,' but applied it to a completely different, underserved problem in security."

**Q: "What was the hardest technical challenge?"**
> "Getting a small local model to reliably return structured JSON. Larger hosted models handle that easily, but a 3B open-weight model needs firmer prompting and a retry-on-malformed-output safeguard, which we built in from the start."

---

## 4. Delivery Notes

- **Practice the full R2 pitch out loud at least 3 times**, timed — 3–4 minutes goes faster than it feels when you're reading it silently.
- **If the live demo stalls or fails:** don't apologize repeatedly or go silent. Say once, calmly, "Let me switch to a recorded run of this exact pipeline," then keep narrating over the backup video exactly as planned.
- **Make eye contact during the "story" moment** (when explaining the attack chain) — that's the emotional core of the pitch, not the technical setup before it.
- **End on the live URL, not on future scope** — the last thing judges should see is proof it's real, not a slide of ideas.
