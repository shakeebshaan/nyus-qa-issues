#!/usr/bin/env python3
# metrics_ai_eval.py — REAL AI factual-accuracy / hallucination eval. Asks the
# live coach LLM a fixed set of health-fact questions whose ground truth is
# computable deterministically, grades each numeric answer within tolerance, and
# prints accuracy% / hallucination% as JSON. Runs ON prod (server-side LLM call,
# no Socket.IO/auth). No mock — uses the same call_openai the app uses.
import re, json, sys
from backend import nyus_app as app
app.app_context().push()
from llm_service import call_openai

# Ground truth is deterministic (Mifflin-St Jeor / macro math / universal facts).
Q = [
    {"q": "How many kilocalories are in one gram of protein? Answer with only the number.", "t": 4, "tol": 0},
    {"q": "How many kilocalories are in one gram of dietary fat? Only the number.", "t": 9, "tol": 0},
    {"q": "How many kilocalories are in one gram of carbohydrate? Only the number.", "t": 4, "tol": 0},
    {"q": "Using the Mifflin-St Jeor equation, what is the BMR in kcal/day for a 30-year-old male, 180 cm, 80 kg? Only the number.", "t": 1780, "tol": 0.04},
    {"q": "Using Mifflin-St Jeor, the BMR for a 25-year-old female, 165 cm, 60 kg? Only the number.", "t": 1345, "tol": 0.04},
    {"q": "If maintenance is 2500 kcal/day and the goal is a 20% calorie deficit, what is the daily target in kcal? Only the number.", "t": 2000, "tol": 0.02},
    {"q": "How many grams of protein per day at 2 grams per kilogram for an 80 kg person? Only the number.", "t": 160, "tol": 0.02},
    {"q": "How many millilitres are in one litre? Only the number.", "t": 1000, "tol": 0},
]
SYS = "You are a precise fitness and nutrition expert. Answer ONLY with the single numeric value requested — no words, no units, no explanation."

def first_num(s):
    m = re.search(r'-?\d[\d,]*\.?\d*', (s or "").replace(",", ""))
    return float(m.group(0)) if m else None

res, correct = [], 0
for item in Q:
    try:
        txt, _ = call_openai(
            [{"role": "system", "content": SYS}, {"role": "user", "content": item["q"]}],
            "metrics-eval", "chat", db=None, max_completion_tokens=40, temperature=0)
        n = first_num(txt)
        ok = n is not None and abs(n - item["t"]) <= max(item["tol"] * item["t"], 0.5)
        correct += 1 if ok else 0
        res.append({"q": item["q"][:46], "t": item["t"], "got": n, "ok": ok, "raw": (txt or "")[:40]})
    except Exception as e:
        res.append({"q": item["q"][:46], "t": item["t"], "got": None, "ok": False, "err": str(e)[:90]})

tot = len(Q)
print(json.dumps({
    "total": tot, "correct": correct,
    "accuracy_pct": round(100.0 * correct / tot, 1),
    "hallucination_pct": round(100.0 * (tot - correct) / tot, 1),
    "results": res,
}))
