/**
 * Give the store-asset demo account a lived-in day.
 *
 * A freshly onboarded account renders every figure as 0 and shows a scolding
 * "Missing meals compounds fast" nudge — a bad first frame for a store listing.
 * This logs a realistic breakfast, lunch and a weigh-in THROUGH THE PUBLIC API,
 * exactly as the app would: no direct DB writes, no fabricated rows, and only
 * against the disposable demo account created for this purpose.
 *
 * Portions are ordinary and the macros are consistent with the plan's targets
 * (1847 kcal / 155P / 192C / 51F), so the screenshots show a plausible day
 * rather than a heroic one.
 */
import fs from 'node:fs';

const ROOT = 'C:/Users/Shaan/Desktop/NYUS CODE/nyus-well-tracker-00146a-75469';
const creds = JSON.parse(fs.readFileSync(`${ROOT}/.qa-report/_qa_creds.json`, 'utf8')).main;
const API = 'https://nyus.in/api/v1';

if (!/demo/i.test(creds.email)) {
  console.error(`REFUSING: main creds are ${creds.email}, not a demo account.`);
  process.exit(1);
}
console.log('seeding a day for', creds.email);

const today = new Date();
const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const post = async (path, body) => {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.access}` },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  console.log(`  ${r.status}  POST ${path}  ${txt.slice(0, 110)}`);
  return r.status;
};

// A weigh-in: slightly under the starting weight, which is what the dashboard
// hero and the weight card render.
await post('/logs/daily', {
  log_date: d,
  morning_weight_kg: 63.4,
  water_intake_liters: 1.8,
  sleep_hours: 7.5,
  sleep_rating: 8,
  energy_rating: 7,
  steps: 6420,
});

await post('/logs/meal', {
  log_date: d,
  meal_number: 1,
  meal_name: 'Poha with peanuts',
  foods: [
    { name: 'Poha', quantity: 150, unit: 'g', calories: 244, protein: 5, carbs: 46, fat: 4 },
    { name: 'Peanuts', quantity: 15, unit: 'g', calories: 87, protein: 4, carbs: 3, fat: 7 },
  ],
  total_calories: 331, total_protein: 9, total_carbs: 49, total_fat: 11,
});

await post('/logs/meal', {
  log_date: d,
  meal_number: 2,
  meal_name: 'Dal, rice and salad',
  foods: [
    { name: 'Toor dal', quantity: 200, unit: 'g', calories: 230, protein: 14, carbs: 33, fat: 4 },
    { name: 'Steamed rice', quantity: 150, unit: 'g', calories: 195, protein: 4, carbs: 43, fat: 0 },
    { name: 'Cucumber salad', quantity: 100, unit: 'g', calories: 30, protein: 1, carbs: 6, fat: 0 },
  ],
  total_calories: 455, total_protein: 19, total_carbs: 82, total_fat: 4,
});

console.log('done');
