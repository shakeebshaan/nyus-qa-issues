// 2 Nov 2026 (Governor 22:40 UTC): one P3 card from dev's nutrition-day re-capture (r3, app main 6f584eab).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const IMG = 'images/2026-11-02-nutrition-day/';
const COMMIT = process.argv[2];
if (!COMMIT) throw new Error('usage: node tools/_file_nutriday_20261102.mjs <image-commit-sha>');
const cards = [
  {
    id: 'i-20261102-past-day-meal-tick-toast-no-undo',
    tags: ['nutrition', 'past-day', 'toast', 'p3'],
    route: 'app: src/pages/_components/nutrition/useNutritionData.tsx:397-401 (past-day tick toast: title + meal name, duration 3000, no action) vs src/pages/_components/nutrition/useTodayMealLog.tsx:53-60 (today toast: duration 5000 + ToastAction Undo that re-sends the log mutation)',
    images: ['past-day-tick-toast-no-undo.png'],
    description: '[P3 / inconsistent + no recovery] Found by dev while re-capturing the nutrition-day flow (r3) on app main 6f584eab, 2 Nov 2026 (web build, 390 x 844 at 2x, QA account; steps on branch qa/nutrition-day-recapture-nov02, commit f441dbae, all 6 steps pass). REPRO: Diet -> go to a past day (screenshot: Sun 1 Nov) -> tick a meal. RESULT: a "Meal logged" toast with the meal name and only an X; it closes after 3 s. Ticking a meal on TODAY shows the same title with an Undo button for 5 s. So a mis-tap on a past day can only be fixed by finding the meal again and un-ticking it. CAUSE (inspected): the past-day mutation onSuccess in useNutritionData.tsx:397-401 calls toast() with no action; useTodayMealLog.tsx:53-60 passes action: <ToastAction> Undo that calls logMealMutation.mutate with the flipped was_eaten. FIX: give the past-day toast the same ToastAction (undo = mutate with was_eaten flipped, same date) and the same 5000 ms duration; reuse the nutrition.toast.undo key (exists en + hi). SIDE NOTE for a real-phone check (not a defect yet): in headless Edge "Fish Roti Sabzi" draws its last letter oddly ("Sabzì" in the screenshot) although the API name is plain ASCII, so it is likely the font in headless Edge only; confirm on a phone before filing.',
  },
];
const now = new Date().toISOString();
for (const c of cards) {
  if (db.issues.some((i) => i.id === c.id)) { console.log('exists', c.id); continue; }
  const imgs = c.images.map((f) => IMG + f);
  db.issues.unshift({
    id: c.id, createdAt: now, author: 'qa', tags: c.tags, route: c.route,
    imagePath: imgs[0], imageCommit: COMMIT, imagePaths: imgs, imageCommits: imgs.map(() => COMMIT),
    imagePrivate: false, status: 'open', fix: null, history: [], description: c.description,
  });
  console.log('added', c.id);
}
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
