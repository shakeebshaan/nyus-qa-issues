// One-shot: prepend 3 bug-hunt issues (2026-07-07 tick, focus: Health Score engine)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const now = new Date().toISOString();
const author = 'shakeebshaan';
const existing = new Set(db.issues.map(i => i.id));

const mk = (id, route, description) => ({
  id,
  createdAt: now,
  author,
  tags: ['bug-hunt', 'auto'],
  route,
  description,
  imagePath: null,
  imageCommit: null,
  imagePaths: [],
  imageCommits: [],
  imagePrivate: false,
  status: 'open',
  fix: null,
  history: [],
});

const issues = [
  mk(
    'i-20260707-6e2a',
    '/health-score',
    "[bug-hunt] Health Score quiz answer \">3X Day\" (tea/coffee) is silently scored 50 (neutral) instead of 30 — the heaviest tea/coffee drinker gets NO penalty. Root cause: backend app/services/health_score.py _safe_quiz_score() normalizes the incoming value with `.lower().replace(' ', '_')` (norm '>3X Day' -> '>3x_day'), then tries to match it against QUIZ_SCORE_TABLE keys. Direct lookup fails (key is literal '>3X Day'). The case-insensitive fallback compares `k.lower() == norm`, i.e. '>3x day' (key lowercased, space NOT underscored) vs '>3x_day' (value with underscore) — space vs underscore never match, so it falls through to `return 50`. Every other value matches because none of them contain a space; '>3X Day' (frontend value for tea_coffee's 'More than 3x per day' option, src/lib/healthScoreQuestions.ts:76) is the ONLY table key with a space, so it's the only one that breaks. Expected: 30 (per QUIZ_SCORE_TABLE['tea_coffee']). Actual: 50. Verified by replicating _safe_quiz_score in isolation: 'never'->70, '1xWeek'->90, '2-3xWeek'->80, '>3X Day'->50 (should be 30). Fix: normalize the table key the same way in the fallback (compare `k.lower().replace(' ', '_') == norm`), OR change the frontend value + table key to a space-free token like '>3x_day' (keep both repos in sync). Impact: inflates the Nutrition/Eat pillar for high-caffeine users.",
  ),
  mk(
    'i-20260707-9f4b',
    '/health-score',
    "[bug-hunt] Health Score Nutrition pillar 'macro balance' component is effectively a constant 55 for every normal user — it compares PER-MEAL average calories against DAILY calorie thresholds. In backend app/services/health_score.py _nutrition_pillar(): `cals = [int(m.total_calories) for m in non_skipped ...]` collects per-MEAL calories (MealLog has meal_number + one row per meal per day, db_models.py:1569-1577 — total_calories is a single meal's calories, not a daily total). Then `avg = sum(cals)/len(cals)` is the average calories PER MEAL (~300-800 kcal for real meals), and it's tested with `if avg < 1100 or avg > 3500: macro_score = 55` / `elif avg < 1300 or avg > 3000: macro_score = 75`. Since a typical meal is well under 1100 kcal, `avg < 1100` is almost always true -> macro_score is pinned at 55 for essentially all users, regardless of whether their actual DAILY intake is healthy. To ever reach macro_score=100 a user would need per-meal average >=1300 kcal (e.g. ~5200 kcal/day over 4 meals) — backwards. Repro: log 4 meals/day at ~500 kcal each (2000 kcal/day, healthy) -> per-meal avg 500 < 1100 -> macro_score=55 (treated as if dangerously under-eating). Expected: aggregate calories BY log_date, then average the DAILY totals before comparing to the 1100-3500 daily band. Actual: raw per-meal average compared to daily thresholds. Impact: the 20% macro component of the nutrition live_score is a near-constant penalty for everyone.",
  ),
  mk(
    'i-20260707-c1d7',
    '/health-score',
    "[bug-hunt] Health Score Body-Comp pillar weight-trajectory divides by a fixed /4.0 regardless of the actual gap between weigh-ins, so users with sparse weight logs get mis-classified as crash-dieting. In backend app/services/health_score.py _body_comp_pillar(): `earlier` is selected as the most recent WeightLog that is AT LEAST 28 days old (`WeightLog.logged_at <= now-28d`, order desc, first) — there is NO lower bound on how old it is. Then `weekly_pct = (delta_kg / earlier.weight_kg) / 4.0  # rough weekly avg` assumes the gap is exactly 4 weeks. If the user's previous weigh-in was, say, 100 days ago, /4.0 overstates the weekly rate ~3.5x. Repro: user weighs 80kg today and their only older log is 88kg from 100 days ago -> delta -8kg, code computes weekly_pct = (-8/88)/4 = -0.0227 -> hits `weekly_pct < -0.01` -> trajectory = -10 ('too fast', crash-diet penalty). Actual healthy rate over 100 days is -8/88/(100/7) = -0.0064 (~0.64%/wk, on-track). So a healthy, steady loser is penalized as if crash-dieting, and conversely a real fast loss over a short recent gap could be under-penalized. Expected: compute weekly_pct using the real elapsed days between `earlier.logged_at` and `latest.logged_at` (delta_kg / weight / (days/7)), not a hardcoded 4 weeks. Impact: up to -10 (or wrong-signed) points on the 15-weight Body-Comp pillar for anyone whose weigh-ins aren't ~monthly.",
  ),
];

for (const it of issues) {
  if (existing.has(it.id)) throw new Error('collision ' + it.id);
}
db.issues = [...issues, ...db.issues];
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('prepended', issues.length, 'total now', db.issues.length);
