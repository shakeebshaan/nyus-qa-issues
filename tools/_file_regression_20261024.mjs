// 24 Oct 2026 (Governor 09:05 UTC): four cards from the regression QA of app main 8efc9ca9 (expired-login fix, offline, Hindi/Hinglish walk, toasts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const IMG = 'images/2026-10-24-regression-qa/';
const COMMIT = process.argv[2];
if (!COMMIT) throw new Error('usage: node tools/_file_regression_20261024.mjs <image-commit-sha>');
const common = 'Found in a local web build of app main 8efc9ca9 (worktree C:/tmp/qa-wt-reg, vite build against a mocked API, served on localhost:8091, seeded Edge profile, 390 x 844 at 2x). No prod call, no real account. ';
const cards = [
  {
    id: 'i-20261024-storage-toast-english-hi',
    tags: ['hindi', 'hinglish', 'i18n', 'auth', 'p4'],
    route: 'app: src/contexts/AuthContext.tsx:169-178 (Storage unavailable toast, fired in a mount effect); src/i18n/config.ts:31-38 and :147 (hi and hinglish load on demand)',
    images: ['toast-storage-hi.png', 'toast-storage-hinglish.png'],
    description: common + 'REPRO: nyus_locale = hi (also hinglish), make localStorage.setItem throw for the key __nyus_storage_test__ (private-browsing case), open /dashboard. EXPECTED: the toast in Hindi / Hinglish. The strings exist: hi.json:7728-7729 and hinglish.json:7728-7729 (auth_toast.storage_title, auth_toast.storage_desc). OBSERVED: a red toast "Storage unavailable / Your browser\'s storage is blocked (private browsing?). You may need to log in again after each session." in English in both locales. In the same run the "Session expired" toast and the CSAT "thanks" toast, which fire later, ARE translated. LIKELY CAUSE [assumed from the code, not stepped through]: the effect at AuthContext.tsx:169 has deps [] and calls i18n.t() on mount, before the lazy hi / hinglish chunk is loaded (config.ts:31-38; changeLanguage runs after ensureLocale at :147), so t() answers with the English fallback and the toast text is fixed at that moment. The unit test test/GlobalToasts.hindi.test.tsx presumably calls t() after the locale is loaded, so it would not catch the timing [assumed]. FIX IDEA: fire the toast after the locale bundle is ready (ensureLocale / i18n "loaded"), or pass the keys and translate when the toast renders. Only affects browsers with blocked storage (rare on the Android app), so P4.',
  },
  {
    id: 'i-20261024-transient-refresh-welcome-screen',
    tags: ['auth', 'expired-login', 'p3'],
    route: 'app: src/contexts/AuthContext.tsx:58-72 (cold-start auth check: isAuthenticated() false when the access expiry has passed, then checkAndRefreshToken() fails -> setIsAuthenticated(false)); src/services/auth.service.ts:299-440 (refresh + back-off)',
    images: ['transient-refresh-welcome-screen.png'],
    description: common + 'Check 1 result: the reload loop is gone. Definitive failures (refresh 401, or no refresh token) end on the in-app Welcome / sign-in screen with 1 page load, 4 and 2 API calls in the first 30 s, 0 afterwards, tokens cleared, "Session expired" toast shown. Temporary failure with 3 days of access life left (refresh 503) keeps /dashboard, 9 API calls in the first 30 s, refresh back-off 30 s (next refresh at +33 s, step 2). So the 4a0345af goal holds. TWO GAPS around the temporary-failure path: (1) COLD START WITH AN ALREADY-EXPIRED ACCESS TOKEN (nyus_token_expiry in the past, i.e. the user was away for more than the 14-day access window while the refresh token, 60 days, is still good) and the refresh answers 503 or 429, or the phone is offline: the app ends on the Welcome / "Continue with Google / Sign in with email" screen, although nyus_access_token and nyus_refresh_token stay in storage and nyus_refresh_backoff = {"step":1,"until":+30 s} is set. The user sees what looks like a logout, and nothing retries in the next 100 s that I watched (0 API calls after the first 3). The commit text says the session is kept; the screen says otherwise. AuthContext.tsx:60-72: authenticated = isAuthenticated() is false for an expired expiry, the silent refresh throws or returns false on a transient error, and setIsAuthenticated(false) sends the guards to "/". EXPECTED: keep the app shell (error states with Retry, as with 3 days left) or show "can\'t reach the server, retry", and retry after the back-off. (2) AFTER A GOOD REFRESH, NO REFETCH: 3 days left, refresh 503 for 30 s then 200: the refresh succeeds at +32.7 s, back-off cleared, tokens replaced, but zero requests follow; Today stays on "Couldn\'t load overview data - Pull down to retry" until the user acts. EXPECTED: the failed queries refetch once the session is restored. Both are P3: a flaky network on the first open after a long absence is a normal case. Evidence JSON and counts: scenarios C, D, E, F of the harness C:/tmp/qa-reg/s1.mjs.',
  },
  {
    id: 'i-20261024-hinglish-core-screens-english',
    tags: ['hinglish', 'i18n', 'p3'],
    route: 'app: src/i18n/locales/hinglish.json (2,435 of 5,960 values identical to en.json; 66 in hi.json); screens Today, Diet, Workout, Coach, Profile',
    images: ['hinglish-today.png', 'hinglish-diet.png', 'hinglish-profile.png'],
    description: common + 'Walk in Hinglish (nyus_locale = hinglish) on Today, Diet, Workout, Coach, Profile with mock data. Lines identical to the English screen: Today 11 of 41, Diet 13 of 46, Workout 11 of 40, Coach 3 of 10, Profile 55 of 84. Hindi on the same screens has 0 untranslated sentences (only the proper nouns and two small items in card i-20261024-hi-nutrition-and-announcer-english). Many Hinglish entries are fine as loanwords (Home, Diet, Profile, Weight), so this needs the native Hinglish read to separate by-design from missing: it is NOT a missing-key problem (all 5,960 keys exist in hinglish.json, no raw key or {{placeholder}} on any screen). EXAMPLES that are whole labels or sentences still in English: hinglish.json:2739 "Log what you ate"; :4588 "Dose (optional)"; :2030 "UI language - menus, labels, onboarding"; :2790 "Fasting day:"; :2792 "Full fast"; :2793 "16:8 window"; :3395 "Daily activity"; :1874 "Customize"; :2105 "QUICK ACTIONS"; :2126 "Weekly Progress"; :2022 "Coach language"; :1998 "Help & FAQ"; :2001 "Logout"; :6548 "Skip to content" (screen-reader). Also identical on Today: "Good morning, X", "+2 logged - 820 kcal extra", "FASTING"; Diet "AI PLAN"; Profile "HYDRATION", "PREFERENCES & DATA", "SUPPORT"; screen-reader labels such as "Open diet tracking", "Customize Diet", "Diet progress: 43% complete", "Weekly insights", "Main navigation". The Hinglish toasts and the CSAT survey ARE translated (Feedback ke liye shukriya!, 5 mein se 4 dein) except the storage toast (card i-20261024-storage-toast-english-hi). ACTION: native Hinglish read (item nyus-f84785) with this list, then fill the real gaps.',
  },
  {
    id: 'i-20261024-hi-nutrition-and-announcer-english',
    tags: ['hindi', 'i18n', 'a11y', 'p4'],
    route: 'app: src/i18n/locales/hi.json:2060 and :1212; src/components/ui/toaster.tsx:10 (ToastProvider without a label)',
    images: ['hi-profile.png', 'hi-toast-session.png'],
    description: common + 'Two small English leftovers in Hindi. (1) hi.json:2060 profile hydration caption "... आमतौर पर पीते हैं। Nutrition ट्रैकर इनका उपयोग करता है।" and hi.json:1212 "... प्लान Nutrition टैब में मिलेगा।" use the English word "Nutrition" inside a Hindi sentence; the tab itself is called "डाइट" in Hindi, so the sentence points at a name that is not on the screen. (2) Every toast in hi (and hinglish) is announced to screen readers with the English prefix "Notification": the live region reads "Notification सेशन खत्म हो गया ...". It is Radix\'s default ToastProvider label; src/components/ui/toaster.tsx:10 uses <ToastProvider> without the label prop (the viewport at :24 is already localised with t("toast.region_label")). FIX: <ToastProvider label={t("toast.region_label")}> or a dedicated key. Checks that PASSED in the same walk: no raw key or {{placeholder}} text on any of the 5 screens in hi, hinglish or en; no horizontal overflow at 390 px (scrollWidth 390 = clientWidth on all 15 screens); the CSAT survey (title, five "5 में से N दें" faces, Send / Skip / Close) and its thanks toast are Hindi; the Session expired toast is Hindi.',
  },
];
const now = new Date().toISOString();
for (const c of cards) {
  if (db.issues.some((i) => i.id === c.id)) { console.log('exists', c.id); continue; }
  const imgs = c.images.map((f) => IMG + f);
  db.issues.unshift({
    id: c.id, createdAt: now, author: 'qa', tags: c.tags, route: c.route,
    imagePath: imgs[0], imageCommit: COMMIT, imagePaths: imgs, imageCommits: imgs.map(() => COMMIT),
    imagePrivate: false, status: 'open', fix: null, history: [], description: c.description,
  });
  console.log('added', c.id);
}
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
