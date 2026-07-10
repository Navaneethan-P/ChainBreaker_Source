"""
Add static files serving for the generated HTML reports.
Append to main.py after FastAPI app initialization.
"""
from fastapi.staticfiles import StaticFiles
from pathlib import Path

REPORTS_DIR = Path(__file__).parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

# Mount static reports directory — called from main.py
def mount_static(app):
    app.mount("/reports", StaticFiles(directory=str(REPORTS_DIR)), name="reports")
