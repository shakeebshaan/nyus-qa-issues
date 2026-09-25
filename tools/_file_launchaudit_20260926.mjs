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
  mk('i-20260926-del1', null, ['launch-blocker', 'privacy', 'play', 'verified'],
    "[P0 / LAUNCH BLOCKER — hand-verified] ACCOUNT DELETION DELETES NOTHING. End to end: the in-app screen and nyus.in/account-deletion both POST /api/v1/account-deletion-request, which INSERTs a row into `account_deletion_requests` (app/routes/account_deletion.py:154). Nothing in the codebase ever READS that table — grep for AccountDeletionRequest returns exactly one hit, the insert. The admin GDPR queue (app/admin_v2/audit.py:905 list_gdpr_requests / :937 process_gdpr_request) reads a DIFFERENT table, `admin_gdpr_requests`, which the user-facing flow never writes to. So the queue has a consumer with no producer, and the requests have a producer with no consumer. WORSE: even if an admin hand-creates an admin_gdpr_requests row, process_gdpr_request's delete branch only RENAMES the users row — email -> deleted-<id>@nyus.invalid, name -> 'Deleted User', clears password_hash/avatar_url/google_id, sets deleted_at, bumps token_version. Its own comment says \"We don't try to be exhaustive ... rely on FK cascades elsewhere\" — but it never issues a DELETE, so no cascade can fire, and the users-table FK was dropped for a collation reason (see learnings: MySQL FK collation gotcha). Every daily_log, meal_log, workout_log, measurement, progress photo, chat message, coach memory and payment row survives, still keyed to the same user_id. CONSEQUENCE: Play requires account deletion to actually delete, with a working web route; the D7/G6 gate was recorded PASS on evidence that only covers the REQUEST being recorded. This is a Play-review rejection and a DPDP/GDPR erasure failure. FIX: write a real purge (enumerate every user-scoped table, delete or anonymise, remove uploaded photos from storage, record an auditable receipt), point the user-facing request at the same queue the admin UI reads, and re-test G6 against actual row counts before and after."),

  mk('i-20260926-bak1', null, ['launch-blocker', 'privacy', 'security', 'verified'],
    "[P1 — hand-verified, and it is an OWNER DECISION, not a rogue implementation] The nightly backup emails the ENTIRE production database, unencrypted, to a personal inbox. backend.py:267 perform_daily_backup: mysqldump -> gzip -> base64 -> Resend email attachment to BACKUP_EMAIL (default shaan.s@chartraiders.com) -> delete the local file. The dump contains every user's PII, health and payment data. It is gzipped, not encrypted, so it sits in plaintext-at-rest in an inbox and in Resend's infrastructure and logs. This was directive i-20260624-bak1 (\"Only send me via email and delete it\") and it replaced something worse (committing the dump to GitHub), so the decision was deliberate and the improvement was real — flagging the residual risk once, per push-back duty, and then it is yours. TWO CONSEQUENCES THAT ARE NOT OBVIOUS: (1) erasure becomes unfulfillable — deleting a user from prod does not remove them from N nightly copies sitting in an inbox, which interacts directly with del1 above and with whatever the privacy policy claims about retention; (2) a single mailbox compromise is a full database breach. MINIMUM FIX IF THE EMAIL ROUTE STAYS: encrypt the dump (age/gpg to a key the mailbox does not hold) before attaching, and make the privacy policy's retention text match what actually happens."),

  mk('i-20260926-req1', null, ['privacy', 'play', 'verified'],
    "[P2 — hand-verified] The deletion-request endpoint takes any email with no proof of ownership. app/routes/account_deletion.py:119 request_account_deletion has no @jwt_required and never consults the caller's token — it accepts a bare {email} and records a pending deletion for whoever that is. Being unauthenticated is CORRECT for the web form (Play requires a deletion route reachable by someone who already uninstalled the app), so the endpoint itself is not the bug. The gap is that nothing verifies ownership before a request is FULFILLED — and today that is invisible only because fulfilment does not exist (see del1). The moment del1 is fixed and anything automated consumes this queue, an unauthenticated stranger can destroy an account by typing its email. Rate limiting is per-email, which slows repetition but does not establish ownership. FIX: email a confirmation link and require it before the purge runs; when the request arrives with a valid JWT whose email matches, mark it pre-verified and skip the round trip."),
];

let added = 0;
for (const it of items) { if (!existing.has(it.id)) { db.issues.unshift(it); added++; } }
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
console.log('added', added);
