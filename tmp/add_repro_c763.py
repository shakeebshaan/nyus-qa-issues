"""Repro c763: add two real no-image compound-named exercises to the QA
account's Pull Day A session (3294) so the missing-image case renders.
Idempotent. Run on prod: ./venv/bin/python /tmp/add_repro_c763.py
"""
from __future__ import annotations
import os
from pathlib import Path

SESSION_ID = 3294
ADDS = [(4052, 7), (3105, 8)]  # (exercise_id, display_order): "Pull-down or band row", "Banded pull-up (if available)"


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
        for ex_id, order in ADDS:
            row = conn.execute(text(
                "SELECT id FROM session_exercises WHERE session_id=:s AND exercise_id=:e"),
                {"s": SESSION_ID, "e": ex_id}).fetchone()
            if row:
                print(f"exists: ex {ex_id} (se {row[0]})")
                continue
            conn.execute(text(
                "INSERT INTO session_exercises (session_id, exercise_id, display_order, target_sets, target_reps) "
                "VALUES (:s,:e,:o,3,'8-12')"), {"s": SESSION_ID, "e": ex_id, "o": order})
            print(f"inserted ex {ex_id} at order {order}")
    with eng.connect() as conn:
        rows = conn.execute(text(
            "SELECT se.id, se.exercise_id, e.name, (e.image_url IS NOT NULL) has_img "
            "FROM session_exercises se JOIN exercises e ON e.id=se.exercise_id "
            "WHERE se.session_id=:s ORDER BY se.display_order"), {"s": SESSION_ID}).fetchall()
        print("--- session 3294 now ---")
        for r in rows:
            print("  " + " | ".join("" if x is None else str(x) for x in r))
    print("[done]")


if __name__ == "__main__":
    main()
