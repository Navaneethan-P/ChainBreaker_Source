"""
LLM Router — selects inference provider based on user configuration.

Priority:
  1. Local Ollama (private, encrypted, zero data egress)
  2. Direct API: Anthropic Claude, Google Gemini, or OpenAI GPT
  3. OpenRouter (if user supplies key)

Provider and model are read from environment variables written by the
Installer wizard on first setup. API keys are stored in the session
vault (AES-256-GCM) and never written to disk in plaintext.
"""
import asyncio
import json
import os
from typing import AsyncGenerator

import httpx

# ── Environment config — written by Installer wizard ──────────────────────────
OLLAMA_HOST     = os.getenv("OLLAMA_HOST",     "http://127.0.0.1:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "qwen2.5-coder:3b")
AI_PROVIDER     = os.getenv("AI_PROVIDER",     "ollama")   # ollama|claude|gemini|openai|openrouter
AI_MODEL        = os.getenv("AI_MODEL",        "")
AI_API_KEY      = os.getenv("AI_API_KEY",      "")

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
ANTHROPIC_BASE  = "https://api.anthropic.com/v1"
OPENAI_BASE     = "https://api.openai.com/v1"
GEMINI_BASE     = "https://generativelanguage.googleapis.com/v1beta"


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
    api_key: str | None = None,
    provider: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
) -> str:
    """
    Generate a completion using the configured provider.
    provider and api_key can be passed per-request (from the Installer config)
    or read from environment variables.
    """
    resolved_provider = provider or os.getenv("AI_PROVIDER", "ollama")
    resolved_key      = api_key or openrouter_key or os.getenv("AI_API_KEY", "")
    resolved_model    = model or os.getenv("AI_MODEL", "")

    # ── Local Ollama (default, private) ──────────────────────────────────────
    if resolved_provider == "ollama" or (not resolved_provider and await is_ollama_running()):
        use_model = resolved_model or OLLAMA_MODEL
        return await _ollama_generate(prompt, use_model, temperature, max_tokens)

    # ── Anthropic Claude ──────────────────────────────────────────────────────
    if resolved_provider == "claude" and resolved_key:
        use_model = resolved_model or "claude-3-5-haiku-20241022"
        return await _claude_generate(prompt, resolved_key, use_model, temperature, max_tokens)

    # ── Google Gemini ─────────────────────────────────────────────────────────
    if resolved_provider == "gemini" and resolved_key:
        use_model = resolved_model or "gemini-2.0-flash"
        return await _gemini_generate(prompt, resolved_key, use_model, temperature, max_tokens)

    # ── OpenAI GPT ───────────────────────────────────────────────────────────
    if resolved_provider == "openai" and resolved_key:
        use_model = resolved_model or "gpt-4o-mini"
        return await _openai_generate(prompt, resolved_key, use_model, temperature, max_tokens)

    # ── OpenRouter (fallback) ─────────────────────────────────────────────────
    if resolved_key:
        use_model = resolved_model or "meta-llama/llama-3.2-3b-instruct:free"
        return await _openrouter_generate(prompt, resolved_key, use_model, temperature, max_tokens)

    # ── Last resort: try Ollama anyway ────────────────────────────────────────
    if await is_ollama_running():
        return await _ollama_generate(prompt, OLLAMA_MODEL, temperature, max_tokens)

    raise RuntimeError(
        "No LLM provider available. "
        "Complete the setup wizard to configure a local or cloud AI provider."
    )


async def _ollama_generate(prompt: str, model: str, temperature: float, max_tokens: int) -> str:
    payload = {
        "model":  model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(f"{OLLAMA_HOST}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "")


async def _claude_generate(prompt: str, api_key: str, model: str, temperature: float, max_tokens: int) -> str:
    headers = {
        "x-api-key":         api_key,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
    }
    payload = {
        "model":      model,
        "max_tokens": max_tokens,
        "messages":   [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{ANTHROPIC_BASE}/messages", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]


async def _gemini_generate(prompt: str, api_key: str, model: str, temperature: float, max_tokens: int) -> str:
    url = f"{GEMINI_BASE}/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _openai_generate(prompt: str, api_key: str, model: str, temperature: float, max_tokens: int) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }
    payload = {
        "model":       model,
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{OPENAI_BASE}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def _openrouter_generate(prompt: str, api_key: str, model: str, temperature: float, max_tokens: int) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer":  "https://github.com/Navaneethan-P/Forge",
        "X-Title":       "Attack Chain Mapper",
        "Content-Type":  "application/json",
    }
    payload = {
        "model":       model,
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{OPENROUTER_BASE}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
