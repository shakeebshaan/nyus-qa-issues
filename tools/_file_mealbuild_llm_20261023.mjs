import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const id = 'i-20261023-meal-build-llm-latency';
if (!db.issues.some(i => i.id === id)) {
  db.issues.unshift({
    id, createdAt: now, author: 'shakeebshaan',
    tags: ['diet', 'plan-builder', 'performance', 'ai', 'G9'],
    route: '/customize/diet (Coach builds all meals) -> POST /api/v1/ai/suggest-meals-batch',
    imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
    imagePrivate: false, status: 'open', fix: null, history: [],
    description:
      "[P2 / performance + error state] After the grounding fix (i-20261023-d1-prod-meal-build-slow, ground= 7.3 s -> 0.1 s, closed) the coach meal build is still slow, and a capped build comes back empty without telling the user.\n\n" +
      "EVIDENCE (prod nyus_app.log, 23 Oct, read-only):\n" +
      "- 16:02:47 `OpenAI response: domain=suggest_meal_batch, tokens=516/1892, finish=stop, content_len=6610`\n" +
      "- 16:02:48 `suggest-meals-batch timing ... ground=0.1s images=1.2s suggs=6`\n" +
      "- 16:02:48 `SLOW_REQUEST POST /api/v1/ai/suggest-meals-batch 200 23863ms db=47ms queries=17`\n" +
      "  -> 23.9 s total, about 22 s is the OpenAI call (1,892 output tokens for 6 meals, ~85 tokens/s); 516 input tokens, so the prompt is not the cost.\n" +
      "- 16:03:45 `user_cost_cap reached ... reason=daily_cost_cap_reached -> fallback`, then `suggest-meals-batch: non-JSON LLM response ... (likely fallback), returning empty`\n" +
      "  -> the 'empty' build was NOT a bad model reply: the account hit its daily AI cost cap, the fallback text failed JSON parsing and the route returned an empty list silently.\n\n" +
      "WANTED: (1) first meals on screen fast: cut the time to the first meal (e.g. stream or split the batch so meal 1 renders first, fewer output tokens per meal, a faster model for this batch if quality holds), measured before/after from the prod log; (2) a cap-reached build returns a clear 'daily AI limit reached, try again tomorrow or add meals yourself' state instead of an empty list (distinguish cap/fallback from a real non-JSON reply; retry only a real non-JSON reply, once). OpenAI spend stays inside the NYUS spend guard and the per-user cap.",
  });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
  console.log('added', id);
} else console.log('exists', id);
