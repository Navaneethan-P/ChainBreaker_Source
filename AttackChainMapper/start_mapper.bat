@echo off
echo Starting Attack Chain Mapper...

:: Start Backend
echo Starting Backend (FastAPI)...
start "ACM Backend" cmd /k "cd backend && uvicorn main:app --reload --port 8000"

:: Wait a couple of seconds for backend to initialize
timeout /t 2 /nobreak > nul

:: Start Frontend
echo Starting Frontend (Next.js)...
start "ACM Frontend" cmd /k "cd frontend && npm run dev"

echo Both services are starting up!
echo Frontend will be available at http://localhost:3000
echo Backend will be available at http://localhost:8000
