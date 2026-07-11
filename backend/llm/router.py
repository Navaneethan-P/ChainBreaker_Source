"""
LLM Router — selects the best available inference provider.
Primary: local Ollama. Fallback: user-supplied OpenRouter API key.
No data is ever sent to external services unless the user explicitly
provides their own API key.
"""
import asyncio
import json
import os
from typing import AsyncGenerator

import httpx

OLLAMA_HOST  = os.getenv("OLLAMA_HOST",  "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:3b")

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_KEY  = os.getenv("OPENROUTER_API_KEY", "")


async def list_local_models() -> list[str]:
    """Return names of models available in the local Ollama instance."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []


async def is_ollama_running() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def generate(
    prompt: str,
    model: str | None = None,
    openrouter_key: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
) -> str:
    """
    Generate a completion. Tries Ollama first.
    Falls back to OpenRouter only if an API key is supplied.
    Raises RuntimeError if no provider is available.
    """
    use_model = model or OLLAMA_MODEL

    if await is_ollama_running():
        return await _ollama_generate(prompt, use_model, temperature, max_tokens)

    key = openrouter_key or OPENROUTER_KEY
    if key:
        return await _openrouter_generate(prompt, key, temperature, max_tokens)

    raise RuntimeError(
        "No LLM provider available. "
        "Start Ollama locally (ollama serve) or supply an OpenRouter API key."
    )


async def _ollama_generate(
    prompt: str,
    model: str,
    temperature: float,
    max_tokens: int,
) -> str:
    payload = {
        "model":  model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{OLLAMA_HOST}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "")


async def _openrouter_generate(
    prompt: str,
    api_key: str,
    temperature: float,
    max_tokens: int,
) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer":  "https://github.com/Navaneethan-P/Forge",
        "X-Title":       "Attack Chain Mapper",
        "Content-Type":  "application/json",
    }
    payload = {
        "model": "meta-llama/llama-3.2-3b-instruct:free",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{OPENROUTER_BASE}/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
