import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const id = 'i-20261009-pc01';
if (!db.issues.some((i) => i.id === id)) {
  db.issues.unshift({
    id, createdAt: now, author: 'shakeebshaan',
    tags: ['onboarding', 'nutrition', 'calorie-engine', 'owner-gate', 'verified'],
    route: '/onboarding', imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
    imagePrivate: false, status: 'open', fix: null, history: [],
    description:
      '[P1 / OWNER — calorie model] The pace a user picks on the Goal tab never changes their calories. ' +
      'Found by the 2026-10-09 onboarding recapture on prod (fresh account qa.flow.r3-20261009@dosbee.com: 29F, 78 kg → 72 kg, "Standard ~11 wks").\n\n' +
      'WHAT THE USER SEES: the tour says "Your plan is ready — Lose 6.0 kg over 11 weeks … by Dec 25" next to "Weekly pace 0.42 kg/week". 0.42 × 11 = 4.6 kg, not 6. ' +
      'The saved plan agrees with the calories, not the promise: fitness_plans.weekly_weight_target_kg = -0.39, target_kcal 1858 = TDEE 2323 × 0.80.\n\n' +
      'WHY: generate-profile (_compute_plan_calc) sets the target by GOAL TYPE — a fixed ~20% deficit for every fat-loss user. The pace chips (Relaxed ~19 / Standard ~11 / Ambitious ~8 wks) only set target_completion_date. ' +
      'So Relaxed users get a bigger deficit than their pace needs, and Standard/Ambitious users are promised a date their calories cannot reach. Nothing here is unsafe — the chosen 0.7%/wk is inside the 1.0%/wk ceiling — it is a broken promise.\n\n' +
      'SECOND ENGINE (same root, latent): the weigh-in recompute (macro_calculator.compute_full_macros) uses a different rule — a flat 300-500 kcal deficit (→ ~1923 here), so the target can jump at the first weight change. This is the "three calorie engines" debt in docs/AI_COACH_SPEC_INTEGRATION.md.\n\n' +
      'RECOMMENDED FIX (engineering-ready, ~1 day both repos): the deficit follows the chosen pace — kg/week × 7700 / 7 — bounded by the existing guardrails (never below BMR or the sex floor, never past the medical/minor/pregnancy caps, never above the 1.0%/wk ceiling), computed in ONE shared function that generate-profile, plan creation and the weigh-in recompute all call, so the number can no longer drift between them. The tour and pace chips then show what the calories actually deliver.\n\n' +
      'Held for you because it changes the calorie target of every new fat-loss user (Relaxed users get MORE food, Ambitious users less), and that is a product call, not a bug fix I should make unattended. Reply "go" and it ships with tests on both repos.',
  });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
  console.log('added', id);
} else console.log('exists', id);
