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
