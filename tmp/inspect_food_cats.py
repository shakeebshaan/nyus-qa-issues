"""Read-only: distinct category landscape in ingredients + food_database, to
build an ingredient-only allow-list for the foods search (f3f8).
Run on prod: ./venv/bin/python /tmp/inspect_food_cats.py
"""
from __future__ import annotations
import os
from pathlib import Path


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
        for r in conn.execute(text(sql)).fetchall():
            print("  " + " | ".join("" if v is None else str(v) for v in r))
    except Exception as e:
        print("ERR: " + repr(e))


def main():
    load_env()
    eng = build_engine()
    with eng.connect() as conn:
        show(conn, "ingredients categories", "SELECT category, COUNT(*) c FROM ingredients GROUP BY category ORDER BY c DESC")
        show(conn, "food_database categories", "SELECT category, COUNT(*) c FROM food_database GROUP BY category ORDER BY c DESC LIMIT 60")
        show(conn, "food_database sources", "SELECT source, COUNT(*) c FROM food_database GROUP BY source ORDER BY c DESC")
        show(conn, "ingredients ending in hex hash (dupes)", "SELECT COUNT(*) FROM ingredients WHERE name REGEXP ' [0-9a-f]{8,}$'")
        show(conn, "food_database ending in hex hash (dupes)", "SELECT COUNT(*) FROM food_database WHERE name REGEXP ' [0-9a-f]{8,}$'")
        show(conn, "ingredients ending in (NNNg) (dupes)", "SELECT COUNT(*) FROM ingredients WHERE name REGEXP '\\\\([0-9.]+ ?g\\\\)$'")
    print("\n[done]")


if __name__ == "__main__":
    main()
