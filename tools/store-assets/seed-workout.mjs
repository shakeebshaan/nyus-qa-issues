/**
 * Give the store-asset demo account a completed training session.
 *
 * Without this the Activity screen renders 0/6 exercises, 0/18 sets and
 * 0/7 sessions — an empty state is the worst possible frame for a listing that
 * is trying to show "training that progresses with you".
 *
 * Logged THROUGH THE PUBLIC API exactly as the Floor does: start the session,
 * log each set, finish with a measured duration. No direct DB writes, and only
 * against the disposable demo account (the /demo/i guard below).
 *
 * Weights are honest: the session is a bodyweight upper-body day, so only the
 * one loaded movement carries a weight. Reps sit inside the prescribed 8-12.
 */
import fs from 'node:fs';

const ROOT = 'C:/Users/Shaan/Desktop/NYUS CODE/nyus-well-tracker-00146a-75469';
const creds = JSON.parse(fs.readFileSync(`${ROOT}/.qa-report/_qa_creds.json`, 'utf8')).main;
const API = 'https://nyus.in/api/v1';

if (!/demo/i.test(creds.email)) {
  console.error(`REFUSING: main creds are ${creds.email}, not a demo account.`);
  process.exit(1);
}

const call = async (path, body) => {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access}` },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  return { status: r.status, json: (() => { try { return JSON.parse(txt); } catch { return txt; } })() };
};

const t = new Date();
const d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

const ov = await (await fetch(`${API}/activity/overview?date=${d}`, {
  headers: { Authorization: `Bearer ${creds.access}` },
})).json();
const w = ov.todays_workout;
if (!w?.session_id) {
  console.error('no session for today — nothing to seed');
  process.exit(1);
}
console.log(`session ${w.session_id} "${w.session_name}" — ${w.exercises.length} exercises`);

const start = await call('/activity/workout/start', { session_id: w.session_id });
console.log(`  ${start.status}  start ->`, JSON.stringify(start.json).slice(0, 120));
const sessionLogId = start.json?.session_log_id ?? w.session_log_id;
if (!sessionLogId) process.exit(1);

// reps taper across sets, as real fatigue does
const REPS = [12, 11, 10];
const LOADED = /weighted/i;

let sets = 0;
for (const ex of w.exercises) {
  const kg = LOADED.test(ex.exercise_name) ? 8 : 0;
  for (let i = 0; i < (ex.target_sets || 3); i++) {
    const r = await call('/activity/workout/log-set', {
      session_log_id: sessionLogId,
      exercise_id: ex.exercise_id,
      set_number: i + 1,
      reps: REPS[i] ?? 10,
      weight_kg: kg,
      rest_seconds: ex.rest_seconds ?? 90,
    });
    if (r.status >= 300) console.log(`  ${r.status}  log-set ${ex.exercise_name} #${i + 1}`, JSON.stringify(r.json).slice(0, 160));
    else sets++;
  }
}
console.log(`  ${sets} sets logged`);

const fin = await call('/activity/workout/finish', {
  session_log_id: sessionLogId,
  rpe: 7,
  duration_min: 42,
});
console.log(`  ${fin.status}  finish ->`, JSON.stringify(fin.json).slice(0, 200));
