@echo off
echo Starting Attack Chain Mapper...

start cmd /k "cd /d %~dp0\AttackChainMapper\backend && uvicorn main:app --reload --port 8000"
start cmd /k "cd /d %~dp0\AttackChainMapper\frontend && npm run dev"

echo Backend starting on http://127.0.0.1:8000
echo Frontend starting on http://localhost:3000
echo Both terminals are running in the background. Close them when done.
