import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const existing = new Set(db.issues.map(i => i.id));
const mk = (id, route, description) => ({
  id, createdAt: now, author: 'shakeebshaan', tags: ['self-audit', 'residual', 'auto'],
  route, description, imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
  imagePrivate: false, status: 'open', fix: null, history: [],
});
const items = [
  mk('i-20260820-rs1b', '/nutrition', '[residual] BE half of the stale-composer-note fix: logging.py update_meal_log should 409 when entry.skipped is set (FE 409 handler shipped in v274; server currently still accepts the PUT).'),
  mk('i-20260820-rs2f', null, '[residual] useBlockSubmit.ts offline-flush sender still invalidates meal surfaces only — mirror App.tsx sender: invalidate activity-overview + dashboard-overview for workout-set replays.'),
  mk('i-20260820-rs3c', '/dashboard', '[residual] LevelUpWatcher/MilestoneWatcher: add the 2-line !useCelebrationActive() gate so a level-up DEFERS while the Morning Ledger takeover is up (v274 stops the z-fight; celebration still plays beneath).'),
  mk('i-20260820-rs4h', null, '[residual] backend.py get_current_cycle_and_session still derives from raw completed count — align with the F2a live-log-outranks-count rule as get_current_unlocked_session now does.'),
  mk('i-20260820-rs5d', null, '[residual] llm_service tool loop: generic idempotency/dedup for mutating coach tools (log_meal_from_text has a TTL guard; swap_meal/adjust_macros can still be re-called by the model within a turn).'),
  mk('i-20260820-rs6w', null, '[residual/data] plans rebuilt during the ~2-day window when detangle ran with the stale positional carry may have mis-pointed progress logs — unrecoverable without a manual audit; check any user complaint about progress jumps dated 2026-08-19/20 against this.'),
];
let added = 0;
for (const it of items) { if (!existing.has(it.id)) { db.issues.unshift(it); added++; } }
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added);
