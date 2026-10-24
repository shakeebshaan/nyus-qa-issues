// 24 Oct 2026 (Governor 04:45 UTC): file dev's three Hindi AI-error cards (drafted in C:/tmp/dev-qa-cards/hi-error-cards-20261024.json).
// Two are resolved right after with the landed hashes (nyu_backend 3e4432aa live, app main a4f199ab); the meal-customize page stays open.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const drafts = JSON.parse(fs.readFileSync('C:/tmp/dev-qa-cards/hi-error-cards-20261024.json', 'utf8'));
const landed = {
  'i-20261024-hi-ai-error-toasts': ['FIX ON BRANCHES (not live): app fix/hindi-ai-error-copy (toast titles + defaults through t()) + nyu_backend fix/hindi-ai-error-text (route errors translated by coach_language via coach_copy.PHRASES).',
    'FIX LANDED: nyu_backend 3e4432aa (route errors translated by coach_language via coach_copy.PHRASES; live 24 Oct 05:19 UTC) + app main a4f199ab (toast titles + defaults through t(); ships in the next app build).'],
  'i-20261024-hi-unavailable-literals': ['FIX ON BRANCH (not live): app fix/hindi-ai-error-copy',
    'FIX LANDED: app main a4f199ab, ships in the next app build'],
};
const now = new Date().toISOString();
for (const d of drafts) {
  if (db.issues.some(i => i.id === d.id)) { console.log('exists', d.id); continue; }
  let description = d.description;
  if (landed[d.id]) {
    const [from, to] = landed[d.id];
    if (!description.includes(from)) throw new Error('draft text changed for ' + d.id);
    description = description.replace(from, to);
  }
  db.issues.unshift({
    id: d.id, createdAt: now, author: d.author, tags: d.tags, route: d.route,
    imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
    imagePrivate: false, status: 'open', fix: null, history: [], description,
  });
  console.log('added', d.id);
}
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
