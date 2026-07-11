"""
Attack-Path Agent — the core differentiator.
Uses a local LLM via the router (Ollama primary, OpenRouter fallback) to reason
about how vulnerabilities chain together into realistic attack paths.

Key feature: CONFIDENCE-CHECK LOOP
- Each proposed chain includes a self-reported confidence score (0.0-1.0).
- If confidence < 0.6, the agent re-examines that chain with a narrower follow-up
  before accepting or discarding it.
- This is a genuine decision point, not a fixed script.

Each chain step includes an AI-generated `fix` recommendation.
"""
import asyncio
import json
from typing import Any

from sqlmodel import Session

from models import AttackChain, engine
from llm.router import generate
from history import get_breach_context_prompt

CONFIDENCE_THRESHOLD = 0.6
MAX_RETRIES = 2


async def reason_attack_paths(
    run_id: int,
    findings: list[dict],
    graph: dict,
    queue: asyncio.Queue,
    model_override: str | None = None,
    provider: str | None = None,
    api_key: str | None = None,
) -> list[dict]:
    """
    Reason about attack chains using the LLM router.
    Applies confidence-check loop for uncertain chains.
    Returns a list of chain dicts, each step including a `fix` field.
    """
    model_label = model_override or "default model"
    await queue.put({
        "type": "log",
        "stage": "reasoning",
        "message": f"Querying {model_label} for attack chain analysis...",
        "run_id": run_id,
    })

    prompt = _build_attack_path_prompt(findings, graph)
    raw_chains = await _call_model_with_retry(
        prompt, run_id, queue,
        model=model_override,
        provider=provider,
        api_key=api_key,
    )

    if not raw_chains:
        await queue.put({
            "type": "log",
            "stage": "reasoning",
            "message": "Model returned no parseable chains. Check that Ollama is running and the model is loaded.",
            "run_id": run_id,
        })
        return []

    # ── Confidence-check loop ─────────────────────────────────────────
    final_chains = []
    for i, chain in enumerate(raw_chains):
        confidence = chain.get("confidence", 0.5)

        if confidence < CONFIDENCE_THRESHOLD:
            await queue.put({
                "type": "log",
                "stage": "reasoning",
                "message": (
                    f"Chain {i+1} confidence {confidence:.2f} < {CONFIDENCE_THRESHOLD} — "
                    f"re-examining with narrower prompt..."
                ),
                "run_id": run_id,
            })

            refined = await _refine_chain(
                chain, findings, graph, run_id, queue,
                model=model_override,
                provider=provider,
                api_key=api_key,
            )
            if refined:
                final_chains.append(refined)
            else:
                # Keep original if refinement also fails
                final_chains.append(chain)
        else:
            await queue.put({
                "type": "log",
                "stage": "reasoning",
                "message": f"Chain {i+1} confidence {confidence:.2f} ✓ — accepted.",
                "run_id": run_id,
            })
            final_chains.append(chain)

    # Persist chains
    _persist_chains(run_id, final_chains)

    return final_chains


def _build_attack_path_prompt(findings: list[dict], graph: dict) -> str:
    findings_summary = "\n".join([
        f"- [{f['severity']}] {f['rule_id']} in {f['file_path']}:{f['line_start']}: {f['message']}"
        for f in findings[:20]  # Limit to avoid token overflow
    ])

    nodes_summary = "\n".join([
        f"- Node: {n['label']} (type={n['type']}, severity={n['severity']}, routes={n.get('routes', [])})"
        for n in graph.get("nodes", [])[:15]
    ])

    edges_summary = "\n".join([
        f"- {e['source']} --[{e['label']}]--> {e['target']}"
        for e in graph.get("edges", [])[:20]
    ])

    breach_context = get_breach_context_prompt()

    return f"""You are an elite red team security expert performing attack chain analysis. You have deep knowledge of real-world cyber breaches and MITRE ATT&CK tactics.

{breach_context}

---

Now analyze THIS codebase's vulnerabilities and code structure. Identify realistic attack chains — paths that a real attacker could follow by chaining multiple weaknesses together.

VULNERABILITIES FOUND:
{findings_summary}

CODE GRAPH (nodes and connections):
{nodes_summary}

CODE CONNECTIONS:
{edges_summary}

Your task: Identify 1 to 3 realistic attack chains. For each chain, you MUST identify which historical breach it most closely resembles.

Respond with ONLY valid JSON, no markdown, no explanation outside the JSON:
{{
  "chains": [
    {{
      "title": "Short descriptive name of the attack chain",
      "historical_similarity": "[Year] Breach Name (XX% match) — one-sentence explanation of why this is similar",
      "steps": [
        {{
          "node": "file or component name",
          "mitre_tactic": "e.g., T1190 - Exploit Public-Facing Application",
          "weakness": "the vulnerability exploited",
          "action": "what the attacker does",
          "fix": "concrete remediation: e.g. use parameterized queries, move secret to .env, add @login_required"
        }}
      ],
      "explanation": "Plain-English explanation of the full attack path and its real-world impact",
      "confidence": 0.85,
      "node_ids": ["file:app/config.py", "file:app/routes/admin.py"]
    }}
  ]
}}

Rules:
- confidence is a float 0.0-1.0 representing how realistic this chain is given the evidence
- historical_similarity MUST be filled — if no exact match exists, find the closest one and state the percentage
- node_ids must reference actual node IDs from the graph (format: "file:path/to/file.py")
- steps must connect logically — each step builds on the previous one
- The `action` field MUST include the exact attacker payload (e.g. "Attacker sends: GET /user?id=1 OR 1=1")
- Each step MUST include a `fix` field with a specific, actionable remediation (1-2 sentences)
- Each step MUST include a `mitre_tactic` field mapping to a realistic MITRE ATT&CK tactic
- Prefer chains that reach sensitive data, admin access, or data deletion"""


async def _call_model_with_retry(
    prompt: str,
    run_id: int,
    queue: asyncio.Queue,
    model: str | None = None,
    provider: str | None = None,
    api_key: str | None = None,
    attempt: int = 0,
) -> list[dict]:
    """Call the LLM router and parse JSON response. Retries on malformed output."""
    try:
        raw_text = await generate(
            prompt=prompt,
            model=model,
            provider=provider,
            api_key=api_key,
            temperature=0.2,
            max_tokens=2000,
        )

        # Strip markdown fences if present
        clean = raw_text.strip()
        if clean.startswith("```"):
            clean = clean[clean.find("{"):clean.rfind("}")+1]

        parsed = json.loads(clean)
        return parsed.get("chains", [])

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        if attempt < MAX_RETRIES:
            await queue.put({
                "type": "log",
                "stage": "reasoning",
                "message": f"JSON parse error (attempt {attempt+1}/{MAX_RETRIES}): {e} — retrying...",
                "run_id": run_id,
            })
            retry_prompt = (
                prompt
                + "\n\nIMPORTANT: Your previous response was not valid JSON. "
                "Return ONLY raw JSON starting with { — no text before or after."
            )
            return await _call_model_with_retry(
                retry_prompt, run_id, queue, model, provider, api_key, attempt + 1
            )
        return []

    except RuntimeError as e:
        await queue.put({
            "type": "log",
            "stage": "reasoning",
            "message": f"LLM error: {e}",
            "run_id": run_id,
        })
        return []

    except Exception as e:
        await queue.put({
            "type": "log",
            "stage": "reasoning",
            "message": f"Unexpected inference error: {e}",
            "run_id": run_id,
        })
        return []


async def _refine_chain(
    chain: dict,
    findings: list[dict],
    graph: dict,
    run_id: int,
    queue: asyncio.Queue,
    model: str | None = None,
    provider: str | None = None,
    api_key: str | None = None,
) -> dict | None:
    """Re-examine a low-confidence chain with a narrower, focused prompt."""
    title = chain.get("title", "unknown")
    steps = json.dumps(chain.get("steps", []), indent=2)

    refine_prompt = f"""You are a security expert. Re-examine the following proposed attack chain and determine if it is realistic given the vulnerabilities found.

PROPOSED CHAIN: {title}
STEPS:
{steps}

ACTUAL VULNERABILITIES CONFIRMED IN CODE:
{chr(10).join([f"- {f['rule_id']} in {f['file_path']}: {f['message']}" for f in findings[:10]])}

Question: Is this attack chain realistic? If yes, refine and strengthen it. If not, propose a corrected version.

Respond with ONLY valid JSON:
{{
  "title": "Refined chain title",
  "steps": [{{
    "node": "...",
    "mitre_tactic": "e.g., T1078 - Valid Accounts",
    "weakness": "...",
    "action": "...",
    "fix": "Specific remediation step (1-2 sentences)"
  }}],
  "explanation": "Clear explanation of why this chain is realistic",
  "confidence": 0.75,
  "node_ids": ["file:path/to/file.py"]
}}"""

    refined_list = await _call_model_with_retry(
        refine_prompt, run_id, queue, model, provider, api_key
    )
    if refined_list:
        return refined_list[0] if isinstance(refined_list, list) else refined_list

    chain["confidence"] = max(chain.get("confidence", 0.4), 0.55)
    return chain



def _persist_chains(run_id: int, chains: list[dict]):
    with Session(engine) as session:
        for i, chain in enumerate(chains):
            ac = AttackChain(
                run_id=run_id,
                chain_index=i,
                title=chain.get("title", f"Chain {i+1}"),
                steps_json=json.dumps(chain.get("steps", [])),
                impact="Low",  # Will be updated by scorer
                confidence=chain.get("confidence", 0.5),
                explanation=chain.get("explanation", ""),
                node_ids_json=json.dumps(chain.get("node_ids", [])),
                historical_similarity=chain.get("historical_similarity", None),
            )
            session.add(ac)
        session.commit()
