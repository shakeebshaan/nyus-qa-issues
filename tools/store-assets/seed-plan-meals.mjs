/**
 * Mark two of today's PLANNED meals eaten.
 *
 * The earlier pass logged ad-hoc meals through /logs/meal, which the dashboard
 * counts as extras — so the Diet card read "0 of 3 meals logged · +2 logged",
 * which looks like a bug in a store screenshot even though it is the app
 * correctly distinguishing plan adherence from extra intake. Marking real plan
 * slots eaten is what an actual user does, and it is what the card is measuring.
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

const plan = await (await fetch(`${API}/diet/plan`, { headers: H })).json();
const meals = (plan.meals || plan.data?.meals || []).filter(Boolean);
console.log(`plan meals today: ${meals.length}`);
for (const m of meals.slice(0, 8)) {
  console.log(`  id=${m.id ?? m.assigned_meal_id} slot=${m.meal_type ?? m.meal_number} eaten=${!!m.eaten_at} ${m.name ?? m.meal_name}`);
}

for (const m of meals.slice(0, 2)) {
  const id = m.id ?? m.assigned_meal_id;
  const r = await fetch(`${API}/diet/log-meal`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ assigned_meal_id: id, was_eaten: false, desired_eaten: true }),
  });
  console.log(`  ${r.status}  log-meal ${id}  ${(await r.text()).slice(0, 120)}`);
}
