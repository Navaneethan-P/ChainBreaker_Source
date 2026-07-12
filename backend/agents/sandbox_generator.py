import json
import asyncio
from typing import List
from models import AttackChain, SandboxProfile, engine
from sqlmodel import Session
from llm.router import generate

async def generate_sandboxes(run_id: int, chains: List[AttackChain], queue: asyncio.Queue, model_override: str | None = None, provider: str | None = None, api_key: str | None = None):
    """
    Generates dynamic eBPF/seccomp and AppArmor profiles for nodes identified in high-impact attack chains.
    """
    critical_chains = [c for c in chains if c.get("impact") in ["Critical", "High"]]
    
    if not critical_chains:
        return []
        
    await queue.put({
        "type": "log",
        "stage": "sandboxing",
        "message": f"Generating micro-firewalls (seccomp/AppArmor) for {len(critical_chains)} high-impact chains...",
        "run_id": run_id
    })
    
    profiles_generated = []
    
    with Session(engine) as session:
        for chain in critical_chains:
            # We'll just generate one combined sandbox profile for the vulnerable nodes in the chain
            steps = json.loads(chain.steps_json)
            nodes = [s.get('node', '') for s in steps if s.get('node')]
            
            if not nodes:
                continue
                
            prompt = f"""
            Analyze the following files/components which are part of a critical attack chain: {json.dumps(nodes)}.
            The vulnerability context is: {chain.explanation}.
            
            Generate a strict AppArmor profile to restrict the execution context of these components. 
            Only allow necessary reads, no execute permissions, and restrict network access.
            
            Return ONLY the raw AppArmor profile text. No markdown blocks or explanations.
            """
            
            try:
                response = await generate(
                    prompt=prompt,
                    model=model_override,
                    provider=provider,
                    api_key=api_key
                )
                
                # Clean up if LLM added markdown
                if response.startswith("```"):
                    lines = response.split("\n")
                    response = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
                    
                profile = SandboxProfile(
                    run_id=run_id,
                    chain_id=chain.id,
                    profile_type="apparmor",
                    content=response
                )
                session.add(profile)
                profiles_generated.append(profile)
                
            except Exception as e:
                await queue.put({"type": "log", "stage": "sandboxing", "message": f"Failed to generate sandbox for chain {chain.id}: {str(e)}", "run_id": run_id})
                
        session.commit()
        
    return profiles_generated
