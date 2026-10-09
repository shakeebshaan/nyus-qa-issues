import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const now = new Date().toISOString();

// Owner decisions given in chat, 2026-10-09. Both close as ACCEPTED RISK —
// nothing changed in code — with the engineering dissent recorded once (R9).
const decisions = {
  'i-20260926-bil1': {
    owner: 'we are using the razorpay only not google pay billing',
    record:
      'CLOSED BY OWNER DECISION 2026-10-09 — NOT FIXED IN CODE (accepted risk). Billing stays Razorpay-only; Google Play Billing will not be integrated.\n\n' +
      'Dissent, recorded once: Play\'s Payments policy names fitness subscriptions among the digital goods that must use Play Billing. India\'s User Choice Billing still requires Play Billing to be OFFERED beside the alternative (Razorpay transactions then pay ~11% instead of 15%), and Google\'s help page lists "alternative billing only" (no Play option) for the EEA only, not India. ' +
      'As shipped, the risk is a rejection at production review, or removal later (Google began removing non-compliant apps in India in 2024). Closed-testing builds 287/288 were accepted, but that is not the production review.\n\n' +
      'The one compliant route that keeps Razorpay-only: CONSUMPTION-ONLY on Android — sell the subscription on nyus.in through Razorpay; the Android app shows no prices, buy buttons or purchase links, and unlocks for anyone who subscribed on the web. Zero Google fee. Not built: it changes the paywall and conversion, so it waits for your word.\n\n' +
      'Knock-on: the public refund policy still says refunds go through Google Play, which never handles a payment here — that text is part of lgl1.',
  },
  'i-20260926-key1': {
    owner: 'ignore this "A live Firebase admin private key is still committed in the backend repo. It needs rotating."',
    record:
      'CLOSED BY OWNER DECISION 2026-10-09 — NOT FIXED (accepted risk). The Firebase admin key stays as it is; no rotation.\n\n' +
      'What the acceptance rests on: nyu_backend is a PRIVATE repo, so the key is exposed only to people and machines with repo access. What it would cost if that ever changes (repo made public, a clone leaks): full admin over Firebase project nyus-and — push notifications to every user, Firebase data read/write. ' +
      'Rotation, when wanted, is ~5 minutes: Firebase console → service accounts → new key → replace the file on prod → delete the old key. sec2 (JWT/Flask keys in history) is a separate item and is unaffected by this decision.',
  },
};

for (const [id, d] of Object.entries(decisions)) {
  const i = db.issues.find((x) => x.id === id);
  if (!i) { console.log('missing', id); continue; }
  if ((i.thread || []).some((t) => t.text === d.record)) { console.log('already', id); continue; }
  i.thread = Array.isArray(i.thread) ? i.thread : [];
  if (i.reviewReason && !i.thread.some((t) => t.text === i.reviewReason)) {
    i.thread.push({ at: i.reviewedAt || i.createdAt, who: 'claude', kind: 'review', text: i.reviewReason });
  }
  i.thread.push({ at: now, who: 'owner', kind: 'reply', text: d.owner });
  i.thread.push({ at: now, who: 'claude', kind: 'resolve', text: d.record });
  i.tags = [...new Set([...(i.tags || []).filter((t) => t !== 'launch-blocker'), 'owner-decided', 'accepted-risk'])];
  i.status = 'fixed';
  i.needsReview = false;
  i.fix = { description: d.record, fixedAt: now, by: 'shakeebshaan', imagePath: null, imagePaths: [], imageCommit: null, imageCommits: [] };
  i.history = Array.isArray(i.history) ? i.history : [];
  i.history.push({ event: 'owner-decision', at: now, note: d.record.split('\n')[0] });
  console.log('decided', id);
}
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
