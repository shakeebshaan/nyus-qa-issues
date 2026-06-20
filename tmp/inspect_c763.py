"""Read-only: c763 data landscape — compound exercise names, no-image catalog,
QA plan day-3 session (for a repro insert), fuzzy-target candidates.
Run on prod from ~/nyu_backend:  ./venv/bin/python /tmp/inspect_c763.py
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


def show(conn, label, sql, params=None):
    from sqlalchemy import text
    print("\n=== " + label + " ===")
    try:
        rows = conn.execute(text(sql), params or {}).fetchall()
        if not rows:
            print("(no rows)")
            return
        for r in rows:
            print(" | ".join("" if v is None else str(v) for v in r))
    except Exception as e:
        print("ERR: " + repr(e))


def main():
    load_env()
    eng = build_engine()
    with eng.connect() as conn:
        show(conn, "Exact compound names from c763 screenshot",
             "SELECT id, name, (image_url IS NOT NULL) has_img FROM exercises "
             "WHERE name LIKE '%Pull-down or band row%' OR name LIKE '%Banded pull-up%' "
             "OR name LIKE '%band row%' OR name LIKE '%Pull-down%' ORDER BY name LIMIT 30")
        show(conn, "No-image exercises that look AI-named (have ' or ' or '(')",
             "SELECT id, name FROM exercises WHERE image_url IS NULL "
             "AND (name LIKE '% or %' OR name LIKE '%(%') ORDER BY id DESC LIMIT 25")
        show(conn, "Count: total / with image / without image",
             "SELECT COUNT(*) total, SUM(image_url IS NOT NULL) with_img, "
             "SUM(image_url IS NULL) no_img FROM exercises")
        show(conn, "QA plan day-3 (Pull Day A) session + exercises",
             "SELECT ws.id sess_id, se.id se_id, se.exercise_id, e.name, (e.image_url IS NOT NULL) has_img "
             "FROM workout_sessions ws JOIN workout_plans wp ON wp.id=ws.plan_id "
             "JOIN session_exercises se ON se.session_id=ws.id JOIN exercises e ON e.id=se.exercise_id "
             "WHERE wp.user_id=:u AND wp.is_active=1 AND ws.day_of_week=3 ORDER BY se.display_order",
             {"u": QA_USER})
        show(conn, "Fuzzy-target candidates WITH images (lat/pulldown/row/pull-up)",
             "SELECT id, name FROM exercises WHERE image_url IS NOT NULL AND "
             "(name LIKE '%Pulldown%' OR name LIKE '%Pull-Up%' OR name LIKE '%Pull Up%' "
             "OR name LIKE '%Band Row%' OR name LIKE '%Lat %') ORDER BY name LIMIT 20")
    print("\n[done]")


if __name__ == "__main__":
    main()
