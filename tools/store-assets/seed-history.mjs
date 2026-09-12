/**
 * A week of prior weigh-ins for the demo account.
 *
 * Without history the dashboard hero reads "Start 63.4 · Goal 72.0 · 0% to goal
 * · No change this week" — technically correct for a day-one account and a
 * lifeless first frame for a listing. The account's goal is a GAIN (63.4 -> 72),
 * so the trend below climbs, which is what the card is built to show.
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

const iso = (daysAgo) => {
  const t = new Date();
  t.setDate(t.getDate() - daysAgo);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// 7 days, gently climbing, with the day-to-day noise a real scale shows.
const DAYS = [
  { ago: 6, kg: 62.5, water: 1.9, sleep: 7.1, steps: 7240 },
  { ago: 5, kg: 62.7, water: 2.2, sleep: 6.8, steps: 5890 },
  { ago: 4, kg: 62.6, water: 1.7, sleep: 7.6, steps: 9130 },
  { ago: 3, kg: 62.9, water: 2.4, sleep: 7.2, steps: 6605 },
  { ago: 2, kg: 63.1, water: 2.0, sleep: 6.9, steps: 8420 },
  { ago: 1, kg: 63.2, water: 2.1, sleep: 7.8, steps: 7010 },
];

for (const d of DAYS) {
  const r = await fetch(`${API}/logs/daily`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      log_date: iso(d.ago),
      morning_weight_kg: d.kg,
      water_intake_liters: d.water,
      sleep_hours: d.sleep,
      sleep_rating: 7,
      energy_rating: 7,
      steps: d.steps,
    }),
  });
  console.log(`  ${r.status}  ${iso(d.ago)}  ${d.kg} kg`);
}
