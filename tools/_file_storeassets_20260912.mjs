import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const existing = new Set(db.issues.map(i => i.id));
const mk = (id, route, description) => ({
  id, createdAt: now, author: 'shakeebshaan', tags: ['self-audit', 'auto'],
  route, description, imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
  imagePrivate: false, status: 'open', fix: null, history: [],
});
const items = [
  mk('i-20260912-sa1p', '/activity',
    "[found while shooting store assets] Finishing today's session advances the progressive plan straight away, so 'Today's Activity' re-renders the NEXT session at 0/6 exercises, 0/18 sets, 0 kg volume — on a day you demonstrably trained the screen reads as untouched. Only 'Workout sessions this week 1/7' shows the work happened. Repro: POST /activity/workout/start + log-set x18 + /finish, then GET /activity/overview — todays_workout is now the next session. Either keep the completed session visible for the rest of the day, or say explicitly that the next one is queued."),
];
let added = 0;
for (const it of items) { if (!existing.has(it.id)) { db.issues.unshift(it); added++; } }
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added);
