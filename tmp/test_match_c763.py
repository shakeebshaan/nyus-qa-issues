"""Validate the c763 name->image fuzzy-match algorithm against the LIVE catalog
before baking it into backend.py. Run on prod: ./venv/bin/python /tmp/test_match_c763.py
"""
from __future__ import annotations
import os, re
from pathlib import Path
from difflib import get_close_matches, SequenceMatcher

OR_SPLIT = re.compile(r"\s+or\s+|\s*/\s*", re.IGNORECASE)
PAREN = re.compile(r"\(.*?\)")


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


def resolve(name, names, by_name):
    base = PAREN.sub("", name or "").strip()
    seen, terms = set(), []
    for t in [base] + OR_SPLIT.split(base):
        t = t.strip()
        if t and t.lower() not in seen:
            seen.add(t.lower()); terms.append(t)
    best_ratio, best = 0.0, None
    for term in terms:
        tl = term.lower()
        for cand in get_close_matches(term, names, n=3, cutoff=0.6):
            r = SequenceMatcher(None, tl, cand.lower()).ratio()
            if r > best_ratio:
                best_ratio, best = r, cand
    return best, best_ratio


def main():
    from sqlalchemy import text
    load_env()
    eng = build_engine()
    with eng.connect() as conn:
        rows = conn.execute(text(
            "SELECT name, image_url FROM exercises WHERE image_url IS NOT NULL AND image_url<>''")).fetchall()
    by_name = {r[0]: r[1] for r in rows if r[0] and r[1]}
    names = list(by_name)
    tests = [
        "Pull-down or band row", "Banded pull-up (if available)", "DB row or pull-down",
        "Pull-down or pull-up assist", "Pull-up assist or band pull-down",
        "Trap-bar or KB DL", "Wall push-up or DB press", "Walk or bike",
        "Pull-Downs (heavy intent)",
    ]
    for t in tests:
        b, r = resolve(t, names, by_name)
        img = (by_name.get(b) or "")[:48]
        print(f"{t:42} -> {str(b):28} ({r:.2f})  {img}")
    print("\ncandidates with image:", len(names))


if __name__ == "__main__":
    main()
