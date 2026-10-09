import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const id = 'i-20261009-pk01';
if (!db.issues.some(i => i.id === id)) {
  db.issues.unshift({
    id, createdAt: now, author: 'shakeebshaan',
    tags: ['diet', 'plan-builder', 'schema', 'owner-gate', 'verified'],
    route: '/onboarding', imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
    imagePrivate: false, status: 'open', fix: null, history: [],
    description:
      "[P3 / OWNER — schema] The dish photo a user PICKS in the diet builder only survives week one. " +
      "This is NOT the D7 meal-photo question (user-uploaded photos — you said don't store them, and nothing here stores one): " +
      "it is the catalog image URL of the dish they chose, e.g. nyus.in/meal-media/…jpg.\n\n" +
      "Today (backend e7030d9, live): save-custom-plan carries the picked photo through _bridge_diet_to_legacy into the 7 meal rows it writes at save time, so week one shows it. " +
      "There is no column for it on DietPlan, so the following week's rollover and any single-day re-save regenerate the meal rows and the card falls back to a generated photo.\n\n" +
      "FIX: add a nullable DietPlan.image_url VARCHAR(512) (one migration, no backfill, no FK), write it on save, read it in the rollover. ~1 hour with tests. " +
      "Held only because it is a schema change made unattended. RECOMMENDATION: approve — it holds a public catalog URL, no personal data, and the column is droppable. " +
      "Reply 'go' and it ships with the next backend push.",
  });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
  console.log('added', id);
} else console.log('exists', id);
