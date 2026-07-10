"""
Admin route — VULNERABILITY #4: Missing authentication check.
This is an intentionally planted vulnerability for Attack Chain Mapper demo.
This route connects to the hardcoded secret (config.py) and SQL injection (user.py)
to form a complete 3-node attack chain.
"""
from flask import request
from app import app, get_db


@app.route("/admin/delete-user")
def delete_user():
    """
    DEMO VULNERABILITY: No authentication, no session check, SQL injection combined.
    Any unauthenticated request can delete any user record.
    Combined with the hardcoded ADMIN_PASSWORD in config.py,
    this is the terminal node of the attack chain:
      hardcoded secret → unauthenticated admin route → SQL injection → data deletion.
    """
    # VULNERABILITY: no @login_required, no session.get('is_admin'), nothing
    user_id = request.args.get("id", "")
    if not user_id:
        return {"error": "id required"}, 400
    db = get_db()
    # VULNERABILITY: f-string SQL — double injection risk
    db.execute(f"DELETE FROM users WHERE id={user_id}")
    db.commit()
    return {"status": "deleted", "id": user_id}


@app.route("/admin/list-users")
def list_users():
    """
    DEMO VULNERABILITY: Unauthenticated admin listing of all users.
    """
    db = get_db()
    users = db.execute("SELECT * FROM users").fetchall()
    return {"users": [{"id": u[0], "name": u[1], "email": u[2]} for u in users]}
