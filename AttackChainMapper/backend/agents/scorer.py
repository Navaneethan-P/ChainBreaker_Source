"""
Impact Scoring Agent — classifies each attack chain as Critical / High / Low
using the local Ollama LLM or a deterministic fallback heuristic.
"""
import asyncio
import json
import os

import httpx
from sqlmodel import Session

from models import AttackChain, engine

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:3b")

IMPACT_MAP = {
    "critical": "Critical",
    "high": "High",
    "medium": "High",
    "low": "Low",
}


async def score_chains(
    run_id: int,
    chains: list[dict],
    queue: asyncio.Queue,
) -> list[dict]:
    """Score each chain for impact level. Updates DB and returns scored chains."""
    scored = []

    for i, chain in enumerate(chains):
        await queue.put({
            "type": "log",
            "stage": "scoring",
            "message": f"Scoring chain {i+1}/{len(chains)}: {chain.get('title', '?')}",
            "run_id": run_id,
        })

        impact = await _score_one_chain(chain, run_id, queue)
        chain["impact"] = impact
        scored.append(chain)

        await queue.put({
            "type": "log",
            "stage": "scoring",
            "message": f"Chain {i+1} → {impact}",
            "run_id": run_id,
        })

    # Update impact in DB
    _update_chain_impacts(run_id, scored)

    return scored


async def _score_one_chain(chain: dict, run_id: int, queue: asyncio.Queue) -> str:
    """Ask the LLM to classify impact, fall back to heuristic."""
    title = chain.get("title", "")
    explanation = chain.get("explanation", "")
    steps = chain.get("steps", [])

    prompt = f"""You are a security risk assessor. Classify the impact of this attack chain.

ATTACK CHAIN: {title}
EXPLANATION: {explanation}
STEPS: {json.dumps(steps, indent=2)}

Impact classification rules:
- Critical: achieves admin access, data deletion, full database dump, or remote code execution
- High: achieves partial data access, privilege escalation, or denial of service
- Low: information disclosure only, no direct data access

Respond with ONLY valid JSON, nothing else:
{{"impact": "Critical"}}

Valid values for impact: "Critical", "High", "Low" """

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 50},
                },
            )
            response.raise_for_status()
            raw = response.json().get("response", "")

        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean[clean.find("{"):clean.rfind("}")+1]

        parsed = json.loads(clean)
        impact_raw = parsed.get("impact", "").lower()
        return IMPACT_MAP.get(impact_raw, _heuristic_score(chain))

    except Exception:
        return _heuristic_score(chain)


def _heuristic_score(chain: dict) -> str:
    """Deterministic scoring based on keywords in the chain content."""
    text = (
        chain.get("title", "") + " "
        + chain.get("explanation", "") + " "
        + json.dumps(chain.get("steps", []))
    ).lower()

    critical_keywords = [
        "delete", "drop", "admin", "takeover", "full database",
        "all records", "zero credentials", "remote code",
    ]
    high_keywords = [
        "dump", "exfiltrate", "bypass", "escalat", "denial", "crash",
        "sql injection", "injection",
    ]

    if any(kw in text for kw in critical_keywords):
        return "Critical"
    if any(kw in text for kw in high_keywords):
        return "High"
    return "Low"


def _update_chain_impacts(run_id: int, chains: list[dict]):
    with Session(engine) as session:
        db_chains = session.query(AttackChain).filter(
            AttackChain.run_id == run_id
        ).order_by(AttackChain.chain_index).all()

        for i, chain in enumerate(chains):
            if i < len(db_chains):
                db_chains[i].impact = chain.get("impact", "Low")
                session.add(db_chains[i])

        session.commit()
