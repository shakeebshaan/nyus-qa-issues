import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();
const existing = new Set(db.issues.map(i => i.id));
const mk = (id, tags, description) => ({
  id, createdAt: now, author: 'shakeebshaan', tags, route: null, description,
  imagePath: null, imageCommit: null, imagePaths: [], imageCommits: [],
  imagePrivate: false, status: 'open', fix: null, history: [],
});

// Second launch-readiness pass, 2026-10-09: 73 agents, 0 errors, every item below
// adversarially verified against the code (audit run wf_4945ead8-52b).
const items = [
  mk('i-20261009-lgl1', ['launch-blocker', 'legal', 'play', 'owner-gate', 'verified'],
    "[P0 / OWNER — legal text, nyus.in] The public legal pages state things that are false, and Play reviewers read them. (1) privacy.html:177 names payment and email processors the app does not use, omits the ones it does (Razorpay, Resend, OpenAI, Firebase, Oracle Cloud), and says Discord receives 'no PII' — it receives coach-chat text, health logs and emails (discord_logger.py:256). (2) index.html:84 Terms say NYUS is 'offered free of charge' while it charges Rs 499/month after the trial. (3) index.html:88 Refund policy tells users to refund or cancel through Google Play, which never processed their payment (Razorpay did). (4) account-deletion.html:228 says Health Connect data is not stored on NYUS servers; health-sync writes it to the database. Each is a Data-safety / deceptive-behaviour risk on its own. Engineering can draft corrected text from the code facts, but legal wording is yours to approve — say the word and I will draft all four from the actual data flows."),

  mk('i-20261009-obs1', ['launch-blocker', 'observability', 'verified'],
    "[P1] A launch-day crash would be invisible. Both client error sinks are empty in the release build: .env.production:39 VITE_SENTRY_DSN= is blank, and VITE_FE_ERROR_WEBHOOK is unset, so sentry.ts and error-reporter.ts silently no-op and RouteErrorBoundary reports to nothing. Backend: ~170 routes catch their own exception and return 500 without reaching the errors channel (backend.py:3290 is one, in payment verification), AI-coach/LLM failures are never pushed to anyone (backend.py:17553), and nothing outside the process checks liveness (health.py:29 is correct but only polled during deploys). NEED FROM YOU: either a Sentry DSN, or a go-ahead for a small backend endpoint that forwards client errors into the existing Discord errors channel (no secret in the app bundle). The uptime check needs an external pinger (UptimeRobot or similar) — 5 minutes of console work."),

  mk('i-20261009-dw01', ['infra', 'deploy', 'verified'],
    "[P2] The self-hosted deploy watcher has two failure modes that make an incident worse. deploy_watcher.py:212 — after an auto-rollback, the next 2-minute tick sees origin/main ahead again and re-deploys the SAME bad commit, so the API flaps up and down indefinitely until someone pushes a fix. deploy_watcher.py:177 — the oneshot watcher exits before its Discord daemon thread posts, so deploy-failure alerts (including 'rollback ALSO FAILED') are never sent. Fix is small (remember the rolled-back SHA and skip it; join or synchronously send the alert) but it is the deploy pipeline itself, so it should go in on its own commit with a staged test, not bundled with feature work."),

  mk('i-20261009-sec2', ['security', 'secrets', 'owner-gate', 'verified'],
    "[P2 / OWNER] The production JWT and Flask signing keys are in git history (backend.py:1392 area), and a forged refresh token bypasses the session allow-list. Same mitigation as key1 (private repo) and the same real remedy: rotate both keys in ~/nyu_backend/.env. Consequence you should know before doing it: rotating the JWT key signs EVERY user out once. Pair it with the key1 rotation so users take one sign-out, not two."),

  mk('i-20261009-pii1', ['privacy', 'data-retention', 'owner-gate', 'verified'],
    "[P1 / OWNER] Coach-chat text, health logs and user emails are mirrored into Discord (discord_logger.py:256 and the auto-mirror to logs-all), where account deletion can never reach them and retention is unlimited. This is a data-protection exposure independent of del1. Options: stop mirroring message bodies and health values (log event + id only, as Firebase now does), or keep them and declare Discord as a processor in the privacy policy with a retention period. Engineering recommendation: the first — the channels are for ops, and ops does not need the user's words."),
];

let added = 0;
for (const it of items) { if (!existing.has(it.id)) { db.issues.unshift(it); added++; } }

// Append the new deletion / backup evidence to the issues that already own them.
const append = (id, note) => {
  const i = db.issues.find(x => x.id === id);
  if (i && !(i.description || '').includes(note.slice(0, 40))) i.description += '\n\n' + note;
};
append('i-20260926-del1', "[2026-10-09 re-audit, verified] Still true after the partial work in 795204c: requests sit at 'pending' forever (account_deletion.py:7), no admin view lists them and the GDPR processor never updates status (audit.py:978), and the shipped copy promises two things no code implements — 'sign in again to cancel' and a confirmation email (AccountDeletion.tsx:116-120). Remove those promises from the copy until they exist.");
append('i-20260926-bak1', "[2026-10-09 re-audit, verified] Add: the backup has 8 return-False paths and none of them alert (backend.py:267-360), so a failing backup is silent; and no restore has ever been tested. An untested backup is a hypothesis.");

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added);
