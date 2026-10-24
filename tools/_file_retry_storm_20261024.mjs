// 24 Oct 2026 (Governor 06:00 UTC): app reload loop on an expired login, root-caused and reproduced locally by the NYUS employee.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const id = 'i-20261024-expired-login-reload-loop';
if (!db.issues.some(i => i.id === id)) {
  db.issues.unshift({
    id, createdAt: now, author: 'shakeebshaan',
    tags: ['auth', 'reliability', 'performance', 'battery', 'p2'],
    route: 'any authed screen (seen on /dashboard); src/lib/api-client.ts 401 handler + src/services/auth.service.ts refreshToken',
    imagePath: 'images/2026-10-24-retry-storm/repro-c88cc020.png', imageCommit: null,
    imagePaths: ['images/2026-10-24-retry-storm/repro-c88cc020.png'], imageCommits: [],
    imagePrivate: false, status: 'open', fix: null, history: [],
    description:
      "[P2 / reliability + battery + prod load] When the server rejects the stored access token (401) and the refresh does not end in a logout, the app hard-reloads about 10 times a second, forever: ~800 API calls and ~300 full page loads in 30 s. It drains battery and data, trips our rate limit (which then makes it worse: 429 counts as transient) and loads prod. First seen 24 Oct ~05:50 UTC: a dev-box screenshot run with an expired QA login sent ~765 requests to prod in ~30 s until prod answered 429.\n\n" +
      "REPRO (local only, 0 requests to prod) [executed 24 Oct 06:05-06:15 UTC]: web build of app main c88cc020 on localhost, every API call answered by a fake server inside Playwright, all authed calls 401, 30 s, 390 px. Results (API calls / refresh calls / full page loads / tokens still stored):\n" +
      "- A no refresh token stored: 731 / 0 / 329 / yes\n" +
      "- B refresh 429 (rate limit): 810 / 101 / 305 / yes\n" +
      "- C refresh 502 (backend restart): 931 / 107 / 321 / yes\n" +
      "- D refresh 401 (revoked / admin force-logout via token_version), token in its last 7 days: 806 / 103 / 309 / yes - logout never runs\n" +
      "- F refresh 429, token 13 days left: 868 / 101 / 302 / yes\n" +
      "- E refresh 401, token 13 days left (the only correct path): 10 / 1 / 4 / no - lands on / (login)\n\n" +
      "ROOT CAUSE (file:line at c88cc020):\n" +
      "1. src/lib/api-client.ts:186-215 - on a 401 the handler calls authService.refreshToken(true). It returns false WITHOUT clearing the tokens in four cases: no refresh token stored (src/services/auth.service.ts:262-263); a transient failure 429 / 5xx / 408 / no response, kept on purpose so a network blip does not log the user out (auth.service.ts:30-34, :292); it JOINED an in-flight refreshToken(false) started at boot by the background check (src/contexts/AuthContext.tsx:91 -> auth.service.ts:332-333 when the token is in its last 7 days, willTokenExpireSoon :125-135), and the joined promise only logs out when ITS caller asked (auth.service.ts:233-234, :292); or the 5 s throttle returned the last result (auth.service.ts:242-243).\n" +
      "2. src/lib/api-client.ts:227-235 - the comment says 'refreshToken(true) already cleared localStorage', but in those four cases it did not. The handler sets isSessionExpired and calls window.location.replace('/'): a full page reload.\n" +
      "3. The reload wipes the module-level guards: isSessionExpired (api-client.ts:56) and the refresh throttle / mutex (auth.service.ts:15-18). The access token is still stored, so AuthPageGuard bounces '/' to /dashboard (src/App.tsx:287), whose ~11 boot queries 401 again -> step 1. The dead-session latch exists but cannot survive the reload it triggers.\n" +
      "4. Smaller: react-query retries every failed query once, 401s included (src/App.tsx:199 retry: 1); the chat socket reconnects 10 times at 1 s (src/services/chat.service.ts:191-192) with the same dead token.\n\n" +
      "WANTED (fix): (a) stop on the first auth error: never window.location.replace while a token is still stored; a definitive refresh rejection (401/403/422) or a missing refresh token clears the session (authService.logout) and routes to login once, in-app (no reload); (b) a joined or throttled refresh must honour the caller's forceLogout (track the strongest flag on the in-flight refresh and the kind of the last failure, definitive vs transient); (c) transient refresh failures (429/5xx/408/no response) keep the refresh token but back off: no reload, no new refresh for 30 s, then 60 s, 120 s... capped (e.g. 10 min), state kept in storage so a reload or app restart cannot reset it; screens show their normal error state meanwhile; (d) react-query: no retry on 401/403. ACCEPTANCE: a unit/integration test where every authed call returns 401 proves a cold start makes at most N calls (N = the boot set + 1 refresh, about 12) and ends on the login route, for: no refresh token, refresh 401 with the boot refresh in flight, refresh 429 (no reload, backoff respected over 60 s of fake time). Re-run the local repro (C:/tmp/retry-storm/repro.mjs on the dev box) after the fix: every scenario at or below scenario E's numbers.",
  });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
  console.log('added', id);
} else console.log('exists', id);
