# Attack Chain Mapper — Demo Target Repository

This is the **intentionally vulnerable demo Flask application** used as the scan target for Attack Chain Mapper demonstrations.

## ⚠️ WARNING

This app contains **deliberately planted security vulnerabilities** for demonstration purposes. **Never deploy this to production.** It exists solely as a safe, controlled target for security tooling demos.

## Planted Vulnerabilities

| # | Type | Location | Description |
|---|------|----------|-------------|
| 1 | Outdated Dependency | `requirements.txt` | Flask 0.12.2 — multiple known CVEs |
| 2 | SQL Injection | `app/routes/user.py` | Unsanitized f-string query |
| 3 | Hardcoded Secret | `app/config.py` | `SECRET_KEY` and `ADMIN_PASSWORD` in plaintext |
| 4 | Missing Auth | `app/routes/admin.py` | No auth on `/admin/delete-user` route |

## The Attack Chain

```
Hardcoded SECRET_KEY (config.py)
    ↓ attacker reads source or leaked secret
Unauthenticated /admin/delete-user (admin.py)
    ↓ no credentials required
SQL Injection in DELETE query (admin.py)
    ↓ attacker can delete or read all user records
Complete database takeover with zero credentials
```

## Running (Demo Only)

```bash
pip install -r requirements.txt
python run.py
```
