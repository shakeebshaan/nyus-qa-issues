"""Seed two weight logs for the QA account so the 86ba milestone track renders
with a real current weight + weekly change. Idempotent per (date).
Run on prod: ./venv/bin/python /tmp/seed_weight_86ba.py
"""
from __future__ import annotations
import os
from pathlib import Path

QA_USER = "a540c20f-2e81-4113-943c-70048c540f37"
# (logged_at, weight_kg): Mon + today (Thu) this week => change_this_week = -1.0
SEEDS = [("2026-06-15 08:00:00", 79.0), ("2026-06-18 08:00:00", 78.0)]


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


def main():
    from sqlalchemy import text
    load_env()
    eng = build_engine()
    with eng.begin() as conn:
        for logged_at, wkg in SEEDS:
            row = conn.execute(text(
                "SELECT id FROM weight_log WHERE user_id=:u AND DATE(logged_at)=DATE(:d)"),
                {"u": QA_USER, "d": logged_at}).fetchone()
            if row:
                conn.execute(text("UPDATE weight_log SET weight_kg=:w WHERE id=:i"), {"w": wkg, "i": row[0]})
                print(f"updated {logged_at} -> {wkg} (id {row[0]})")
            else:
                conn.execute(text(
                    "INSERT INTO weight_log (user_id, weight_kg, logged_at) VALUES (:u,:w,:d)"),
                    {"u": QA_USER, "w": wkg, "d": logged_at})
                print(f"inserted {logged_at} -> {wkg}")
    with eng.connect() as conn:
        rows = conn.execute(text(
            "SELECT weight_kg, logged_at FROM weight_log WHERE user_id=:u ORDER BY logged_at"),
            {"u": QA_USER}).fetchall()
        print("--- weight_log for QA now ---")
        for r in rows:
            print("  " + " | ".join(str(x) for x in r))
    print("[done]")


if __name__ == "__main__":
    main()
