"""Read-only inspection of QA account state for strength-plan provisioning.
Run on prod from ~/nyu_backend:  ./venv/bin/python /tmp/inspect_qa.py
Reads .env from CWD (same convention as scripts/run_pending_migrations.py).
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
        show(conn, "USER", "SELECT id, email FROM users WHERE id=:u", {"u": QA_USER})
        show(conn, "HEALTH_PROFILE",
             "SELECT id, intensity_tier, walking_only, tier_locked, goal_type, gender "
             "FROM user_health_profiles WHERE user_id=:u", {"u": QA_USER})
        show(conn, "WORKOUT_PLANS",
             "SELECT id, name, is_active, is_progressive, start_date "
             "FROM workout_plans WHERE user_id=:u ORDER BY id DESC", {"u": QA_USER})
        show(conn, "WORKOUT_SESSIONS (active plans)",
             "SELECT ws.id, ws.plan_id, ws.name, ws.day_of_week FROM workout_sessions ws "
             "JOIN workout_plans wp ON wp.id=ws.plan_id "
             "WHERE wp.user_id=:u AND wp.is_active=1 ORDER BY ws.day_of_week", {"u": QA_USER})
        show(conn, "EXERCISES back/biceps WITH image_url",
             "SELECT id, name, LEFT(image_url,60) FROM exercises "
             "WHERE image_url IS NOT NULL AND (name LIKE '%Deadlift%' OR name LIKE '%Pull-Up%' "
             "OR name LIKE '%Pull Up%' OR name LIKE '%Chin%' OR name LIKE '%Row%' "
             "OR name LIKE '%Curl%' OR name LIKE '%Pulldown%' OR name LIKE '%Lat %') "
             "ORDER BY name LIMIT 40")
        show(conn, "EXERCISES total count + with-image count",
             "SELECT COUNT(*) total, SUM(image_url IS NOT NULL) with_img FROM exercises")
    print("\n[done]")


if __name__ == "__main__":
    main()
