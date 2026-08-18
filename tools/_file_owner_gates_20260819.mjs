// One-shot: file the PLAN-5/M2 owner-decision register as board review items
// (PLAN-0 M2 — start the owner clock early; each carries its autonomous default).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const existing = new Set(db.issues.map(i => i.id));

const mk = (id, description) => ({
  id, createdAt: now, author: 'shakeebshaan',
  tags: ['owner-gate', 'launch', 'auto'],
  route: null, description,
  imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
  imagePrivate: false, status: 'open',
  needsReview: true,
  reviewReason: 'Owner decision required — engineering default executes if unanswered (PLAN-0 owner-decision register).',
  fix: null, history: [],
});

const items = [
  mk('i-20260819-d1pr', '[owner-gate D1] PRICING: ₹49 founder offer vs ₹499 Active — one story across app, Play listing and landing. DEFAULT if unanswered: status quo (₹49 live offer untouched, no new marketing copy). Blocks: launch marketing copy, Play listing description.'),
  mk('i-20260819-d2as', '[owner-gate D2] STORE ASSETS (Play G4): 4-8 phone screenshots + 1024x500 feature graphic. Engineering will deliver a calm-brand capture list + draft shots for approval; only the owner can approve final art. HARD GATE for production listing.'),
  mk('i-20260819-d3ds', '[owner-gate D3] DATA-SAFETY FORM + content rating (Play G5): engineering drafts every answer from APPLICATION_FLOW Part D (data collected: email, health metrics, photos; encryption in transit; deletion path at nyus.in/account-deletion) — owner must submit in Play Console. HARD GATE.'),
  mk('i-20260819-d4vt', '[owner-gate D4] VITALS + SIGN-IN + SUPPORT (Play G3/G7/G10): (a) crash-free baseline read from Play vitals after 269+ soak; (b) Google sign-in verified on a PLAY-SIGNED build (OAuth SHA for Play App Signing key — engineering preps the SHA check); (c) support email inbox someone actually reads. HARD GATES.'),
  mk('i-20260819-d5ro', '[owner-gate D5] ROLLOUT STAGES: production rollout goes 10% -> 25% -> 50% -> 100%, each stage advanced ONLY by owner say-so after the crash-free + funnel read. DEFAULT: stay at current percentage, never auto-advance.'),
  mk('i-20260819-d6hi', '[owner-gate D6] HINDI MEDICAL COPY: the pace-gate safety messages (pregnancy/deficit warnings) get hi/hinglish translations drafted by engineering. DEFAULT if unanswered: ship drafted translations flagged for review — English-only medical copy for Hindi users is the worse failure.'),
  mk('i-20260819-d7ph', '[owner-gate D7] MEAL-PHOTO PERSISTENCE: storing user meal photos needs a schema + object-storage decision (R10 irreversible-ish). DEFAULT: photos stay discarded after estimation; filed as debt.'),
];

let added = 0;
for (const it of items) {
  if (existing.has(it.id)) continue;
  db.issues.unshift(it);
  added++;
}
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added, 'owner-gate items');
