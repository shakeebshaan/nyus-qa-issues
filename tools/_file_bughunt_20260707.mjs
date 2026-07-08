// One-shot: prepend 3 bug-hunt issues (2026-07-07 tick #2, focus: ChoosePlan / subscription surfaces)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const now = new Date().toISOString();
const author = 'shakeebshaan';
const existing = new Set(db.issues.map(i => i.id));

const mk = (id, route, description) => ({
  id,
  createdAt: now,
  author,
  tags: ['bug-hunt', 'auto'],
  route,
  description,
  imagePath: null,
  imageCommit: null,
  imagePaths: [],
  imageCommits: [],
  imagePrivate: false,
  status: 'open',
  fix: null,
  history: [],
});

const issues = [
  mk(
    'i-20260707-3ce4',
    '/choose-plan',
    "[bug-hunt] Payment amount and subscription duration are never cross-checked — an authenticated user can buy ANY subscription length for ₹1. The frontend never adopted the FIX-WARN-06 server-authoritative pricing contract: paymentsService.createRazorpayOrder (src/services/payments.service.ts:40) still sends only {amount}, so every real checkout goes through the backend's \"legacy\" client-amount path (backend.py RazorpayCreateOrderResource ~2408: any positive amount is honored except the ₹49 offer guard; the plan_id/tier resolution + echo-back is dead code for our own app). Then RazorpayVerifyPaymentResource (~2486) takes duration_months STRAIGHT FROM THE CLIENT — unvalidated, unclamped, never checked against amount_paid or the plans catalog — and grants current_period_end = now + duration_months*30 days. Exploit repro (own test account): POST /payments/razorpay/create-order {\