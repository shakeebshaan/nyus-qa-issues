import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const existing = new Set(db.issues.map(i => i.id));
const mk = (id, route, tags, description) => ({
  id, createdAt: now, author: 'shakeebshaan', tags,
  route, description, imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
  imagePrivate: false, status: 'open', fix: null, history: [],
});

const items = [
  mk('i-20260926-key1', null, ['launch-blocker', 'security', 'secrets', 'verified'],
    "[P0 / OWNER ACTION — hand-verified] A LIVE FIREBASE ADMIN PRIVATE KEY IS COMMITTED TO THE BACKEND REPO. nyu_backend/nyus-and-28394d25990f.json — type service_account, project nyus-and, client_email firebase-adminsdk-fbsvc@nyus-and.iam.gserviceaccount.com, private_key_id 28394d25990f..., RSA private key present. Tracked since 2025-11-10 (commit 227e8a3, 'Add push notification debug guide and Firebase config') — ten months. .gitignore:41 contains `nyus-and-*.json`, which LOOKS like a guard and is not one: gitignore is ignored for already-tracked files, and `git check-ignore -v` confirms the key is NOT ignored. MITIGATING: the repo is PRIVATE, so this is not a public internet leak. NOT MITIGATING: the key grants Firebase Admin on the project — arbitrary push to every user and custom-token minting (impersonate any account) — it exists in every clone and at every point in history, and no amount of deleting it today removes it from the past. ROTATION IN THE GOOGLE CONSOLE IS THE ONLY REAL FIX, and that is yours. ORDER MATTERS, GET IT WRONG AND PROD BREAKS: (1) rotate/revoke the key in the Firebase console; (2) put the new key on the VM out of band and set FIREBASE_CREDENTIALS_PATH (or FIREBASE_CREDENTIALS_JSON) in ~/nyu_backend/.env; (3) restart and verify a real push arrives; (4) only THEN `git rm --cached nyus-and-28394d25990f.json`. Do NOT untrack first: prod deploys by `git pull`, so removing it from the index deletes it from the server on the next deploy, and initialize_firebase_admin only logs a warning and returns False — push notifications would die silently. Step (2) is now possible because the hardcoded path is gone: backend.py resolves env-first as of fe27c51. Optional afterwards: history rewrite (filter-repo) — secondary, and a rotated key makes it cosmetic."),

  mk('i-20260926-pwd1', null, ['security', 'secrets', 'verified'],
    "[P1 — hand-verified] The production MySQL password is committed in tracked files. `git grep -l Activated` returns backend.py, CLAUDE.md and DB_DAILY_backups/README.md; backend.py uses the full DSN `admin:123%40Activated%21@10.0.0.88` as a literal 'production_marker' string to decide whether it is running against prod. The repo is private, so same mitigation as key1 — but the same non-mitigation too: it is in every clone and all of history, and it is the credential for the database holding every user's health and payment data. The DB listens on 10.0.0.88, a private VPC address not reachable from the internet, which is the real reason this has not already been abused. FIX: move the marker to comparing against an env var (or a hash), rotate the password, and put the new one only in ~/nyu_backend/.env. Rotating has a trap worth knowing before you start: the scheduler reads the DSN at import, so a rotation without a coordinated restart leaves 51 jobs failing silently."),
];

let added = 0;
for (const it of items) { if (!existing.has(it.id)) { db.issues.unshift(it); added++; } }
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added);
