"""Provision QA account a540c20f for STRENGTH rendering.
Flips user_health_profiles so the frontend stops forcing the walking-only view.
The account already has an active strength plan (#536, Push/Pull/Legs); only the
profile gate (intensity_tier='starter' / walking_only=1) hides it.
Run on prod from ~/nyu_backend:  ./venv/bin/python /tmp/provision_qa.py
"""
from __future__ import annotations
import os
from pathlib import Path

QA_USER = "a540c20f-2e81-4113-943c-70048c540f37"


def load_env(path=".env"):
    p = Path(path)
    if not p.exists():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip(); v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def build_engine():
    from sqlalchemy import create_engine
    url = os.environ.get("DATABASE_URL") or os.environ.get("SQLALCHEMY_DATABASE_URI")
    if not url:
        raise SystemExit("DATABASE_URL not set")
    if url.startswith("mysql+pymysql://"):
        url = url.replace("mysql+pymysql://", "mysql+mysqlconnector://", 1)
    return create_engine(url, pool_pre_ping=True)


def main():
    from sqlalchemy import text
    load_env()
    eng = build_engine()
    q = text("SELECT intensity_tier, walking_only, tier_locked FROM user_health_profiles WHERE user_id=:u")
    with eng.connect() as conn:
        print("BEFORE:", conn.execute(q, {"u": QA_USER}).fetchone())
    with eng.begin() as conn:
        conn.execute(text(
            "UPDATE user_health_profiles SET intensity_tier='fit', walking_only=0 "
            "WHERE user_id=:u"), {"u": QA_USER})
    with eng.connect() as conn:
        print("AFTER :", conn.execute(q, {"u": QA_USER}).fetchone())
    print("[done]")


if __name__ == "__main__":
    main()
