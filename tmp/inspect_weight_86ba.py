"""Read-only: QA account weight data for the 86ba milestone track.
Run on prod: ./venv/bin/python /tmp/inspect_weight_86ba.py
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
    if url.startswith("mysql+pymysql://"):
        url = url.replace("mysql+pymysql://", "mysql+mysqlconnector://", 1)
    return create_engine(url, pool_pre_ping=True)


def show(conn, label, sql):
    from sqlalchemy import text
    print("\n=== " + label + " ===")
    try:
        rows = conn.execute(text(sql), {"u": QA_USER}).fetchall()
        if not rows:
            print("(no rows)"); return
        for r in rows:
            print("  " + " | ".join("" if v is None else str(v) for v in r))
    except Exception as e:
        print("ERR: " + repr(e))


def main():
    load_env()
    eng = build_engine()
    with eng.connect() as conn:
        show(conn, "PROFILE current/goal weight + goal_type",
             "SELECT current_weight_kg, goal_weight_kg, goal_type FROM user_health_profiles WHERE user_id=:u")
        show(conn, "Latest 3 weight logs",
             "SELECT weight_kg, logged_at FROM weight_log WHERE user_id=:u ORDER BY logged_at DESC LIMIT 3")
        show(conn, "Earliest weight log",
             "SELECT weight_kg, logged_at FROM weight_log WHERE user_id=:u ORDER BY logged_at ASC LIMIT 1")
    print("\n[done]")


if __name__ == "__main__":
    main()
