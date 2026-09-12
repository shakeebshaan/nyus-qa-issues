/**
 * D2 — draft Play Store assets (QA i-20260819-d2as). Engineering's half.
 *
 * Play requirements honoured:
 *   phone screenshots  1080x1920 PNG  (360x640 CSS at dsf 3 — a REAL phone
 *                      layout upscaled, not a 1080-wide desktop layout)
 *   feature graphic    exactly 1024x500 PNG (own context at dsf 1)
 *
 * Shots are real app screens, so the listing shows what the app renders.
 * Auth + the gate-suppression keys are stamped directly here because a
 * hand-made context does not inherit the driver's addInitScript — without
 * them every screen captures the LanguagePicker, which is how the first
 * attempt failed.
 */
import fs from 'node:fs';

const { chromium } = await import(
  'file:///C:/Users/Shaan/Desktop/NYUS CODE/nyus-well-tracker-00146a-75469/node_modules/playwright/index.mjs'
);

const OUT = 'C:/Users/Shaan/Desktop/NYUS CODE/nyus-qa-issues/tmp/store-assets';
fs.rmSync(OUT, { recursive: true, force: true });   // no stale shots from earlier runs
fs.mkdirSync(OUT, { recursive: true });

const creds = JSON.parse(fs.readFileSync(
  'C:/Users/Shaan/Desktop/NYUS CODE/nyus-well-tracker-00146a-75469/.qa-report/_qa_creds.json', 'utf8',
)).main;

const seed = (c) => {
  const today = new Date();
  const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  try {
    localStorage.setItem('nyus_access_token', c.access);
    if (c.refresh) localStorage.setItem('nyus_refresh_token', c.refresh);
    localStorage.setItem('nyus_user_data', JSON.stringify({
      email: c.email, id: c.userId, onboarding_complete: true, subscription_active: true,
    }));
    localStorage.setItem('nyus_token_expiry', String(Date.now() + 30 * 864e5));
    localStorage.setItem('nyus_last_refresh', String(Date.now()));
    localStorage.setItem('nyus_mobile_gate_bypass', '1');
    localStorage.setItem('nyus_locale', 'en');
    localStorage.setItem('nyus_lang_picker_shown', '1');
    // Once-per-day surfaces: marketing art should show the ordinary app.
    localStorage.setItem('nyus_morning_ledger_seen', d);
    localStorage.setItem('nyus_dash_opened_on', d);
    // The cycle first-run prompt expands into a full date/slider form and eats
    // the whole dashboard fold. Its own once-per-day dismiss marker is a local
    // date string (CyclePhaseCard), so stamp it rather than racing the UI.
    localStorage.setItem('nyus_cycle_prompt_dismissed', d);
  } catch { /* ignore */ }
};

const SHOTS = [
  { id: '1-dashboard',    route: '/dashboard',    caption: 'Today, at a glance' },
  { id: '2-nutrition',    route: '/nutrition',    caption: 'Every meal, honestly counted' },
  { id: '3-activity',     route: '/activity',     caption: 'Training that progresses with you' },
  { id: '4-coach',        route: '/coach-chat',   caption: 'A coach that reads your data' },
  { id: '5-achievements', route: '/achievements', caption: 'Milestones worth marking' },
];

const browser = await chromium.launch();

/* ── phone screenshots ────────────────────────────────────────────────────── */
const phone = await browser.newContext({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await phone.addInitScript(seed, creds);
const page = await phone.newPage();

/* Warm-up pass. Badge toasts and level-up overlays fire on the FIRST load after
 * new data lands, and they latch once shown — so visit every route once and
 * throw the result away. Capturing on a cold pass is how two earlier attempts
 * shot a "Badge earned +50 XP" card over the dashboard hero. */
for (const s of SHOTS) {
  await page.goto(`http://localhost:8080${s.route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
}

const captured = [];
for (const s of SHOTS) {
  await page.goto(`http://localhost:8080${s.route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  // Chrome that is noise in a still: the skip-to-content link and the coach FAB.
  // Seeding a day fires one-time celebrations (badge toast, level-up overlay)
  // and prompt cards. They latch after firing, so a second pass is clean — but
  // dismiss anything still standing rather than shooting through it.
  for (const label of [/^not now$/i, /^maybe later$/i, /^skip$/i, /^dismiss$/i]) {
    const b = page.getByRole("button", { name: label }).first();
    if (await b.isVisible({ timeout: 1200 }).catch(() => false)) {
      await b.click().catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  await page.waitForTimeout(1200); // let any celebration finish leaving
  await page.evaluate(() => {
    document.querySelectorAll('a[href="#main"]').forEach((el) => el.remove());
    // The FAB carries `data-coach-fab` on its wrapper. Matching on aria-label
    // missed it entirely — the label lives on an inner <button>, and the fixed
    // positioning lives on the wrapper, so no single element had both.
    document.querySelectorAll('[data-coach-fab]').forEach((el) => { el.style.display = 'none'; });
    // Last-resort belt for a celebration that outlived the warm-up: the badge
    // toast is a fixed z-[100] card whose first line is literally "Badge earned".
    document.querySelectorAll('div[class*="z-[100]"], div[class*="z-[200]"]').forEach((el) => {
      if (/badge earned|level \d+ reached|\+\d+ XP/i.test(el.textContent || '')) el.remove();
    });
  }).catch(() => {});
  // Dismissing a card lower down makes Playwright scroll it into view, which is
  // how the first pass shot the dashboard mid-page with the hero off-screen.
  // Every route scrolls inside PageTransition's own surface, so window.scrollTo
  // is not enough — reset the page scroll roots too.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('[data-scroll-root="page"]').forEach((el) => { el.scrollTop = 0; });
  }).catch(() => {});
  // Skeletons: a lazy card was still grey in the first pass. Wait for them to
  // resolve rather than shooting placeholder bars into a store listing.
  await page
    .waitForFunction(() => !document.querySelector('[data-page-skeleton], .animate-pulse'), { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  const path = `${OUT}/${s.id}.png`;
  await page.screenshot({ path });
  const text = (await page.evaluate(() => document.body.innerText || ''))
    .replace(/\s+/g, ' ').trim();
  const empty = /no .* yet|nothing logged|get started/i.test(text.slice(0, 200));
  captured.push({ ...s, path, empty, preview: text.slice(0, 70) });
  console.log(`  ${s.id.padEnd(16)} ${empty ? 'EMPTY-STATE ' : 'ok          '} "${text.slice(0, 56)}"`);
}
await phone.close();

/* ── feature graphic — its own dsf-1 context so it is EXACTLY 1024x500 ────── */
const fgCtx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const fgPage = await fgCtx.newPage();
await fgPage.setContent(`
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1024px;height:500px;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;
       background:hsl(36 20% 98%);position:relative}
  .wrap{position:absolute;inset:0;display:flex;align-items:center;padding:0 84px}
  .mark{width:96px;height:96px;border-radius:26px;background:hsl(166 70% 47%);display:flex;
        align-items:center;justify-content:center;margin-bottom:30px;
        box-shadow:0 10px 34px hsl(166 70% 47% / .28)}
  .mark span{color:#fff;font-size:52px;font-weight:700;letter-spacing:-.03em}
  h1{font-size:60px;font-weight:700;letter-spacing:-.035em;color:hsl(20 14% 15%);line-height:1.04}
  p{font-size:25px;color:hsl(25 8% 45%);margin-top:20px;line-height:1.4;max-width:560px}
  .rule{display:flex;gap:9px;margin-top:36px}
  .rule i{display:block;height:5px;border-radius:3px}
  .teal{width:104px;background:hsl(166 70% 47%)}
  .orange{width:56px;background:hsl(20 90% 60%)}
  .pink{width:34px;background:hsl(340 70% 58%)}
  .glow{position:absolute;right:-190px;top:-190px;width:640px;height:640px;border-radius:50%;
        background:radial-gradient(circle,hsl(166 70% 47% / .13) 0%,hsl(166 70% 47% / 0) 68%)}
</style>
<div class="glow"></div>
<div class="wrap"><div>
  <div class="mark"><span>N</span></div>
  <h1>Train precisely.<br/>Eat deliberately.</h1>
  <p>Nutrition, strength and progress in one calm place — with a coach that actually reads your data.</p>
  <div class="rule"><i class="teal"></i><i class="orange"></i><i class="pink"></i></div>
</div></div>`);
await fgPage.waitForTimeout(1600);
await fgPage.screenshot({ path: `${OUT}/feature-graphic-1024x500.png` });
await fgCtx.close();
await browser.close();

fs.writeFileSync(`${OUT}/capture-list.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: 'DRAFT for owner approval (QA i-20260819-d2as). Real app screens, not mockups.',
  phoneScreenshots: captured.map(({ id, route, caption, empty }) => ({ id, route, caption, empty })),
}, null, 2));

const bad = captured.filter((c) => c.empty);
console.log(`\n${captured.length} screenshots + feature graphic -> ${OUT}`);
if (bad.length) console.log(`WARNING: ${bad.length} landed on an empty state: ${bad.map((b) => b.id).join(', ')}`);
