// 24 Oct 2026 (Governor 11:00 UTC): card from the post-release check of build 315 (app main f1394d22).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const COMMIT = process.argv[2];
if (!COMMIT) throw new Error('usage: node tools/_file_build315_20261024.mjs <image-commit-sha>');
const c = {
  id: 'i-20261024-route-error-screen-english-hi',
  tags: ['hindi', 'i18n', 'p3'],
  route: 'app: src/components/RouteErrorBoundary.tsx:73-85 (message, hint, actionLabel are English literals); fallbackTitle "Dashboard Error" in src/App.tsx:766-772 and other routes',
  images: ['images/2026-10-24-build315-qa/route-error-boundary-hi.png'],
  description: 'Found in a local web build of app main f1394d22 (build 315, versionCode 315; worktree C:/tmp/qa-wt-app, vite build against a mocked API, 390 x 844 at 2x). No prod call, no real account. REPRO: nyus_locale = hi, signed in with a mock user, open /dashboard while GET /dashboard/overview answers 200 with an empty data object (any render crash on a route has the same effect). EXPECTED: the route crash screen in Hindi, like the app-level ErrorBoundary that build 315 translated (error_boundary.title / body in hi.json). ACTUAL: "Dashboard Error", "This page encountered an error. Refresh to try again." and the "Refresh" button, all English, with the bottom tab bar in Hindi. The chunk-load variant ("Update available", "The app was updated while this page was loading. Refresh to get the new version.") is English too. Not a regression: this file did not change in 315 and 314 shows the same text; it is the same class of leftover as the 3cc14203 crash screen, on the route-level boundary. Fix: read all four strings (and the fallbackTitle props) through t() with keys in en, hi, hinglish, xx-AE.',
};
if (db.issues.some((i) => i.id === c.id)) { console.log('exists', c.id); process.exit(0); }
db.issues.unshift({ id: c.id, createdAt: new Date().toISOString(), author: 'qa', tags: c.tags, route: c.route,
  imagePath: c.images[0], imageCommit: COMMIT, imagePaths: c.images, imageCommits: c.images.map(() => COMMIT),
  imagePrivate: false, status: 'open', fix: null, history: [], description: c.description });
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', c.id);
