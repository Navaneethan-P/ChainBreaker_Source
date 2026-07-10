# DEMO CONFIG — Intentionally Insecure for Demonstration Purposes
# This hardcoded secret is a planted vulnerability for Attack Chain Mapper demo.
# In a real app, NEVER hardcode secrets — use environment variables.

SECRET_KEY = "sk_live_51H8xJ2eZ9k3mLp"   # VULNERABILITY #3: hardcoded secret
ADMIN_PASSWORD = "admin123"                  # VULNERABILITY #3b: hardcoded credential
DEBUG = True
DATABASE = "demo.db"
