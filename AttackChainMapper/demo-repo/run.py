"""
Demo app entry point — run.py
"""
from app import app, init_db
from app.routes import user, admin  # noqa: F401 — registers routes

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5001)
