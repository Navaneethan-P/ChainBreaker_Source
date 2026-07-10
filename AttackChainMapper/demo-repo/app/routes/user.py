"""
User route — VULNERABILITY #2: SQL Injection via string formatting.
This is an intentionally planted vulnerability for Attack Chain Mapper demo.
"""
from flask import request
from app import app, get_db
from app.config import SECRET_KEY  # imports the hardcoded secret — connects the chain


@app.route("/user")
def get_user():
    """
    DEMO VULNERABILITY: SQL Injection.
    The user_id is directly interpolated into a SQL query without sanitization.
    An attacker can pass: ?id=1 OR 1=1 to dump all records.
    """
    user_id = request.args.get("id", "1")
    # VULNERABILITY: f-string SQL construction — never do this in production
    query = f"SELECT * FROM users WHERE id = {user_id}"
    db = get_db()
    result = db.execute(query).fetchone()
    if result:
        return {"id": result[0], "name": result[1], "email": result[2]}
    return {"error": "User not found"}, 404


@app.route("/secret-check")
def secret_check():
    """
    This route uses the hardcoded SECRET_KEY from config — extends the exploit chain.
    An attacker who reads config.py gets both the secret and admin password.
    """
    key = request.args.get("key", "")
    if key == SECRET_KEY:
        return {"admin_password": "admin123", "auth": "granted"}
    return {"auth": "denied"}, 401
