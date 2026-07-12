from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from llm.router import generate

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    run_id: int
    step_context: dict
    messages: List[ChatMessage]
    model_override: Optional[str] = None
    openrouter_key: Optional[str] = None

@router.post("")
async def ask_ai(request: ChatRequest):
    """
    Handle a Fix-It AI query.
    Formats the context of the vulnerability step and the chat history into a single prompt.
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided.")

    # Format context
    node = request.step_context.get("node", "Unknown")
    weakness = request.step_context.get("weakness", "Unknown")
    action = request.step_context.get("action", "Unknown")
    fix = request.step_context.get("fix", "Unknown")
    mitre = request.step_context.get("mitre_tactic", "Unknown")

    context_prompt = f"""You are a senior security engineer acting as a 'Fix-It AI' assistant.
A developer is asking for help fixing a specific vulnerability in their code.

VULNERABILITY CONTEXT:
- Component/File: {node}
- Weakness: {weakness}
- Attacker Action: {action}
- MITRE Tactic: {mitre}
- Suggested Remediation: {fix}

Provide concrete, secure, and professional advice. Use markdown for code blocks.
Keep your answers concise and directly actionable.
"""

    # Format chat history
    history_prompt = "CONVERSATION HISTORY:\n"
    for msg in request.messages[:-1]:
        history_prompt += f"{msg.role.upper()}: {msg.content}\n"

    # The actual question
    last_msg = request.messages[-1].content
    current_prompt = f"USER: {last_msg}\nASSISTANT:"

    full_prompt = f"{context_prompt}\n{history_prompt}\n{current_prompt}"

    try:
        response_text = await generate(
            prompt=full_prompt,
            model=request.model_override,
            openrouter_key=request.openrouter_key,
            temperature=0.3,
            max_tokens=1000,
        )
        return {"response": response_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ActionRequest(BaseModel):
    context: dict
    model_override: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None

@router.post("/remediate")
async def auto_remediate(request: ActionRequest):
    """Generates an Auto-PR diff patch for a vulnerability."""
    node = request.context.get("node", "Unknown")
    weakness = request.context.get("weakness", "Unknown")
    fix_hint = request.context.get("fix", "Unknown")
    
    prompt = f"""You are an automated DevSecOps remediation engine.
A vulnerability was found in the codebase.
Component: {node}
Issue: {weakness}
Suggested Fix: {fix_hint}

Your task is to generate a git unified diff patch (or clear code snippet) that fixes this vulnerability.
Only return the code patch inside a markdown block. Do not provide explanations.
"""
    try:
        response_text = await generate(
            prompt=prompt,
            model=request.model_override,
            openrouter_key=request.api_key,
            temperature=0.1,
            max_tokens=1000,
        )
        return {"patch": response_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/explain")
async def explain_eli5(request: ActionRequest):
    """Explains an attack chain in simple ELI5 terms."""
    title = request.context.get("title", "Unknown chain")
    explanation = request.context.get("explanation", "")
    
    prompt = f"""You are a cybersecurity educator.
Translate the following highly technical attack chain into an "Explain Like I'm 5" (ELI5) analogy.
Chain: {title}
Technical Details: {explanation}

Use simple analogies (like locks, houses, keys). Keep it under 4 paragraphs. Be engaging and clear.
"""
    try:
        response_text = await generate(
            prompt=prompt,
            model=request.model_override,
            openrouter_key=request.api_key,
            temperature=0.7,
            max_tokens=800,
        )
        return {"explanation": response_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
