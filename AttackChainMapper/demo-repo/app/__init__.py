"""
Demo Flask app with 4 intentionally planted vulnerabilities for Attack Chain Mapper demo.
These are deliberate security issues for demonstration purposes ONLY.
"""
from flask import Flask, request, g
import sqlite3
import os

app = Flask(__name__)

DATABASE = "demo.db"


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    with app.app_context():
        db = get_db()
        db.execute(
            "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
        )
        db.execute("INSERT OR IGNORE INTO users VALUES (1, 'Alice', 'alice@example.com')")
        db.execute("INSERT OR IGNORE INTO users VALUES (2, 'Bob', 'bob@example.com')")
        db.commit()


@app.route("/")
def index():
    return {"status": "Demo Vulnerable App Running", "endpoints": ["/user", "/admin/delete-user", "/health"]}


@app.route("/health")
def health():
    return {"status": "ok"}
