import os
import json
import asyncio
import subprocess
import stat
from typing import Optional
from datetime import datetime
from models import AnalysisRun, engine
from sqlmodel import Session
from llm.router import generate_chat_response

async def inject_chaos(run_id: int):
    """
    AI-driven Chaos Engineering: Generates and injects a subtle vulnerability into the cloned repository.
    """
    with Session(engine) as session:
        run = session.get(AnalysisRun, run_id)
        if not run or not run.work_dir_path:
            return {"status": "error", "detail": "Repository clone not found."}
            
        base_path = os.path.abspath(run.work_dir_path)
        
    # Pick a random suitable file to inject into (e.g. a JS/PY/TS file)
    target_file = None
    for root, _, files in os.walk(base_path):
        if ".git" in root: continue
        for file in files:
            if file.endswith(('.js', '.py', '.ts', '.jsx', '.tsx')):
                target_file = os.path.join(root, file)
                break
        if target_file: break
        
    if not target_file:
        return {"status": "error", "detail": "No suitable file found for chaos injection."}
        
    # Read the file
    try:
        with open(target_file, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return {"status": "error", "detail": f"Failed to read target file: {e}"}

    # Ask LLM to inject a subtle vulnerability
    prompt = f"""
    You are a Chaos Engineering agent. Your task is to inject a subtle, exploitable vulnerability 
    (like command injection, SQLi, or prototype pollution) into the following source code file.
    
    IMPORTANT: 
    - The code must still run and compile.
    - Make it subtle enough that simple regex might miss it, but semantic analysis should catch it.
    - Output ONLY the modified file content. No markdown formatting or explanations.
    
    Original Code:
    {content}
    """
    
    try:
        chaos_code = await generate_chat_response([{"role": "user", "content": prompt}])
        if chaos_code.startswith("```"):
            lines = chaos_code.split("\n")
            chaos_code = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
    except Exception as e:
        return {"status": "error", "detail": f"LLM failed to generate chaos mutation: {e}"}

    # Inject it into a new branch
    branch_name = f"chaos-mutation-{int(datetime.utcnow().timestamp())}"
    
    try:
        # Lift permissions
        os.chmod(target_file, stat.S_IWRITE | stat.S_IREAD)
        
        if os.path.isdir(os.path.join(base_path, ".git")):
            subprocess.run(["git", "checkout", "-b", branch_name], cwd=base_path, check=False)
            
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(chaos_code)
            
        if os.path.isdir(os.path.join(base_path, ".git")):
            rel_path = os.path.relpath(target_file, base_path)
            subprocess.run(["git", "add", rel_path], cwd=base_path, check=False)
            subprocess.run(["git", "commit", "-m", "Chaos Engineering: Injected benign vulnerability for testing"], cwd=base_path, check=False)
            
        os.chmod(target_file, stat.S_IREAD)
        
        return {
            "status": "ok", 
            "branch": branch_name, 
            "target_file": os.path.relpath(target_file, base_path),
            "message": f"Injected vulnerability into {os.path.basename(target_file)} on branch {branch_name}"
        }
    except Exception as e:
        return {"status": "error", "detail": f"Failed to apply chaos mutation: {e}"}
