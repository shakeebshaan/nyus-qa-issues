import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const existing = new Set(db.issues.map(i => i.id));
const mk = (id, tags, description) => ({
  id, createdAt: now, author: 'shakeebshaan', tags, route: '/health-alerts', description,
  imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
  imagePrivate: false, status: 'open', fix: null, history: [],
});

// PLAN-7 health vitals + threshold alerts (FE 1533d333, BE 5a2e8d4 live).
const items = [
  mk('i-20261009-hcv1', ['owner-gate', 'play', 'health-connect', 'plan-7'],
    "[OWNER — Play Console, ~10 min] Health alerts are built (FE 1533d333, BE 5a2e8d4 live and verified on prod). Sleep stages, short-night / sleep-goal / steps-goal and sustained-high-heart-rate alerts ship in the next release with NO new permission. The four new vitals — resting heart rate, HRV, blood oxygen (SpO2), breathing rate — are in the code and in debug builds, but RELEASE builds strip their permissions (android/app/src/healthVitalsStrip/AndroidManifest.xml), because Play refuses an upload that requests an undeclared Health permission (that is how versionCode 38 was burned, and it would block hotfixes too). TO SHIP THEM: (1) Play Console → App content → Health apps → add READ_RESTING_HEART_RATE, READ_HEART_RATE_VARIABILITY, READ_OXYGEN_SATURATION, READ_RESPIRATORY_RATE; paste-ready justifications are in the frontend repo's humanpending.md (2026-10-09 entry). (2) nyus.in/privacy (NYUSLANDING/static/privacy.html §1.2) must name the four; fold that into i-20261009-lgl1's legal pass. (3) Tell me 'vitals declared' and I flip healthVitalsPlayDeclared = true in android/variables.gradle for the next release."),
  mk('i-20261009-hcv2', ['owner-decision', 'health-connect', 'plan-7'],
    "[OWNER — go/no-go, not built] Skin temperature and alerts-without-opening-the-app are PLAN-7 Phase C. Skin temperature needs the Health Connect client bumped 1.1.0-alpha07 → 1.1.0: that release made record Metadata mandatory, which touches the live weight/workout write-back for every connected user, so it needs a device test, not just a compile. Background alerts additionally need READ_HEALTH_DATA_IN_BACKGROUND (a second, stricter Play declaration) plus a WorkManager job. Today alerts are checked whenever the app syncs (open/resume) — the screen says so. The backend already accepts skin temperature; only the native read is missing. Plan: docs/plans/PLAN-7-HEALTH-VITALS-ALERTS.md §5. Reply go/no-go."),
];

let added = 0;
for (const it of items) { if (!existing.has(it.id)) { db.issues.unshift(it); added++; } }
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added);
