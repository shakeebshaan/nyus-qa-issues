"""Follow-up read-only inspection: plan 536 contents, today's weekday, log tables.
Run on prod from ~/nyu_backend:  ./venv/bin/python /tmp/inspect_qa2.py
"""
from __future__ import annotations
import os
from pathlib import Path

QA_USER = "a540c20f-2e81-4113-943c-70048c540f37"
PLAN = 536


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
        show(conn, "TODAY weekday (MySQL WEEKDAY: Mon=0..Sun=6)",
             "SELECT CURDATE(), WEEKDAY(CURDATE()) AS py_weekday, DAYNAME(CURDATE())")
        show(conn, "PLAN 536 sessions + exercises (name, has_image, sets, reps)",
             "SELECT ws.day_of_week, ws.name AS session, se.display_order, e.name AS exercise, "
             "(e.image_url IS NOT NULL) AS has_img, se.target_sets, se.target_reps "
             "FROM workout_sessions ws "
             "JOIN session_exercises se ON se.session_id=ws.id "
             "JOIN exercises e ON e.id=se.exercise_id "
             "WHERE ws.plan_id=:p ORDER BY ws.day_of_week, se.display_order", {"p": PLAN})
        # Discover tables that might hold logged sets / PRs
        show(conn, "Candidate log/record/set/pr tables",
             "SELECT table_name FROM information_schema.tables "
             "WHERE table_schema=DATABASE() AND (table_name LIKE '%log%' "
             "OR table_name LIKE '%set%' OR table_name LIKE '%record%' "
             "OR table_name LIKE '%_pr%' OR table_name LIKE '%pr_%' "
             "OR table_name LIKE '%workout%') ORDER BY table_name")
    print("\n[done]")


if __name__ == "__main__":
    main()
