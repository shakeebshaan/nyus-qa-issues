/**
 * Leave today's session PART-WAY through, not finished.
 *
 * Finishing a session advances the progressive plan to the next one, so the
 * "Today's Activity" card immediately re-renders the NEXT session at 0/6 — the
 * screen reads as untouched on a day you actually trained. (Worth a board note
 * on its own; not something to fix from a screenshot script.)
 *
 * A part-way session is both the more common real state and the better frame:
 * exercises done, sets logged, volume climbing.
 */
import fs from 'node:fs';

const ROOT = 'C:/Users/Shaan/Desktop/NYUS CODE/nyus-well-tracker-00146a-75469';
const creds = JSON.parse(fs.readFileSync(`${ROOT}/.qa-report/_qa_creds.json`, 'utf8')).main;
const API = 'https://nyus.in/api/v1';
if (!/demo/i.test(creds.email)) {
  console.error(`REFUSING: main creds are ${creds.email}, not a demo account.`);
  process.exit(1);
}
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access}` };
const post = (p, b) => fetch(API + p, { method: 'POST', headers: H, body: JSON.stringify(b) });

const t = new Date();
const d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
const ov = await (await fetch(`${API}/activity/overview?date=${d}`, { headers: H })).json();
const w = ov.todays_workout;
console.log(`session ${w.session_id} "${w.session_name}" — ${w.exercises.length} exercises`);

const st = await post('/activity/workout/start', { session_id: w.session_id });
const start = await st.json();
const logId = start.session_log_id ?? w.session_log_id;
console.log(`  ${st.status}  start -> session_log_id ${logId}`);

// Loads a lower-body day plausibly carries; the jump/plyo work stays unloaded.
const LOAD = { 'Suspended Split Squat': 10, 'Squat To Overhead Reach With Twist': 6 };
const REPS = [12, 11, 10];

let n = 0;
for (const ex of w.exercises.slice(0, 3)) {          // 3 of 6 — part-way, not done
  const kg = LOAD[ex.exercise_name] ?? 0;
  for (let i = 0; i < (ex.target_sets || 3); i++) {
    const r = await post('/activity/workout/log-set', {
      session_log_id: logId,
      exercise_id: ex.exercise_id,
      set_number: i + 1,
      reps: REPS[i] ?? 10,
      weight_kg: kg,
      rest_seconds: ex.rest_seconds ?? 90,
    });
    if (r.status >= 300) console.log(`  ${r.status}  ${ex.exercise_name} #${i + 1}`, (await r.text()).slice(0, 140));
    else n++;
  }
}
console.log(`  ${n} sets logged, session deliberately left open`);
