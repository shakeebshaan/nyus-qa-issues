// One-shot: prepend 1 bug-hunt issue (2026-07-08 onboarding page-guardian tick).
// Focus: weekly-pace accuracy inconsistency between onboarding plan-ready surfaces.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const now = new Date().toISOString();
const author = 'shakeebshaan';
const existing = new Set(db.issues.map((i) => i.id));

const mk = (id, route, tags, description) => ({
  id,
  createdAt: now,
  author,
  tags,
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
    'i-20260708-pc1a',
    '/onboarding/flow',
    ['bug-hunt', 'onboarding', 'accuracy', 'auto'],
    "[bug-hunt] Onboarding: the \"Weekly pace\" the plan-ready screens promise can be ~2x what the diet the app actually built delivers. Two different formulas feed the same \"Weekly pace kg/week\" label. PostPlanTour (the screen every user sees on the happy path) shows calc.weeklyChange from calcOnboardingStats (src/lib/onboarding-calc.ts:104-118), which is DATE-DRIVEN: goal_delta / weeks_to_target (weights win over calorie math). PlanReadyOverview (the failure/retry-only surface, src/pages/onboarding/custom/PlanReadyOverview.tsx:110-124,338-347) OVERRIDES that with a CALORIE-DERIVED rate off the server target: (serverTarget - tdee) * 7 / 7700. When the requested timeline needs a faster loss than the safe deficit cap allows, these diverge and BOTH the tour + overview under/over-report vs reality. Worked example (female 80kg->65kg / 165cm / 30y, 120-day plan, activity_level blank -> 1.55 mult): BMR 1520, TDEE 2356, deficit capped at min(500, tdee-bmr)=500 -> target 1856 kcal. Date-driven pace = 15kg / 17.1wk = 0.88 kg/wk (shown on PostPlanTour). Calorie-derived pace = 500*7/7700 = 0.45 kg/wk (shown on PlanReadyOverview + what the 1856-kcal plan actually delivers). So the tour promises 0.88 kg/wk (goal hit in the chosen 17 wk) while the built plan only supports 0.45 kg/wk (goal really ~33 wk out). The pace gate on Screen4 only fires 'caution' here (1.09%/wk bodyweight = acknowledge-and-continue), so it does NOT block this case. Repro: onboard with an aggressive-but-acknowledgeable timeline, finish, read Weekly pace on the tour; force a save/finalize failure to also see PlanReadyOverview and compare. Two questions for owner (product call -> filing, not auto-fixing): (1) which number is the honest \"Weekly pace\" - the achievable calorie-derived rate, or the required-to-hit-date rate? (2) whichever we pick, PostPlanTour + PlanReadyOverview should show the SAME one. Note: happy path only shows PostPlanTour, so impact is the over-promise, not a side-by-side mismatch.",
  ),
];

let added = 0;
for (const it of issues) {
  if (existing.has(it.id)) {
    console.log('skip existing', it.id);
    continue;
  }
  db.issues.unshift(it);
  added++;
  console.log('added', it.id);
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 1) + '\n', 'utf8');
console.log(`done — ${added} added, ${db.issues.length} total`);
