import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const existing = new Set(db.issues.map(i => i.id));
const mk = (id, route, description) => ({
  id, createdAt: now, author: 'shakeebshaan', tags: ['sequencing', 'auto'],
  route, description, imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
  imagePrivate: false, status: 'open', fix: null, history: [],
});
const items = [
  mk('i-20260819-sf5h', '/activity', '[sequencing F5] Heal on the RIGHT plan, all plans, all surfaces: backend.py:9023-9026 derives the stale-log heal plan from newest-by-start_date (not resolve_active_workout_plan) and only runs inside the Activity overview GET — the dashboard has no heal, and non-progressive incomplete logs are never healed. Fix per audit F5; keep the >=6h + prior-local-day guards verbatim.'),
  mk('i-20260819-sf7v', '/activity', '[sequencing F7] Log-set session-membership validation: WorkoutLogSetResource (backend.py:9733-9772) accepts any exercise_id for any log — cross-session writes land silently (RC5 decoration corruption). Reject exercise_ids with no SessionExercise row on the log session; add-exercise inserts one so legit adds pass.'),
  mk('i-20260819-sf8i', '/activity', '[sequencing F8] FE invalidation hygiene: auto-finish must invalidate activity/dashboard overviews AFTER the finish POST resolves (Activity.tsx:461-479); debounce overview invalidation on logSet settle (header Total Volume freezes all session); replace dead [workout] query key (NextSessionPreview.tsx:159, WorkoutPlanBuilder.tsx:342) with [strength-summary]; delete unused getSessionProgression client (activity.service.ts:151).'),
  mk('i-20260819-sf9c', null, '[sequencing F9] Content-quality tier: derive muscle_groups from RESOLVED exercises not the LLM claim (plan_generator.py:2302/2306); validate swap payloads (plan_edits.py:464-471 inserts client dicts verbatim — require catalog exercise_id + run _strength_exclusion_filters); apply hygiene+tier filters to get_alternatives (workout_builder_service.py:943); cap/annotate breadth top-up. Also: rest_days_per_block is written in 3 places and READ NOWHERE — either wire engine-level rest spacing or delete the field (audit RC2).'),
];
let added = 0;
for (const it of items) { if (!existing.has(it.id)) { db.issues.unshift(it); added++; } }
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added);
