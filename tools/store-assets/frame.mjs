/**
 * Frame the raw app captures as Play Store listing art.
 *
 * The listing art that was staged in android/fastlane/metadata/.../images/ had
 * the right treatment — caption headline, subtitle, device frame on a soft
 * brand gradient — but it was shot on a QA account, and screenshot 1 showed a
 * group chat named "QA Sim Crew". That would have shipped to the store.
 *
 * It also existed ONLY as output PNGs: no generator in any repo, and
 * .gitignore's blanket `*.png` meant the art was untracked, so it lived on one
 * laptop's disk. This script is the generator, and the images it writes are
 * committed.
 *
 * Input:  ../../tmp/store-assets/<id>.png   (capture.mjs output, 1080x1920)
 * Output: <frontend>/android/fastlane/metadata/android/en-US/images/
 *           phoneScreenshots/1..5.png       (1080x1920, Play phone spec)
 *           featureGraphic.png              (1024x500)
 *
 * Nothing uploads from here. The Fastfile's `beta` and `release` lanes both set
 * skip_upload_images/screenshots/metadata — only the explicit `listing` lane
 * pushes art, and that is the owner's call.
 */
import fs from 'node:fs';
import path from 'node:path';

const FE = 'C:/Users/Shaan/Desktop/NYUS CODE/nyus-well-tracker-00146a-75469';
const SRC = path.resolve(process.cwd(), '../../tmp/store-assets');
const OUT = `${FE}/android/fastlane/metadata/android/en-US/images`;

const { chromium } = await import(`file:///${FE}/node_modules/playwright/index.mjs`);

const SHOTS = [
  { src: '1-dashboard.png',    head: 'Your whole day,\nin one calm view',  sub: 'Weight, nutrition and training at a glance.' },
  { src: '2-nutrition.png',    head: 'Every meal,\nhonestly counted',      sub: 'Calories and macros, live against your targets.' },
  { src: '3-activity.png',     head: 'Training that\nprogresses with you', sub: 'Sets, volume and steps — session by session.' },
  { src: '4-coach.png',        head: 'A coach that\nreads your data',      sub: 'Plan-aware answers, not generic advice.' },
  { src: '5-achievements.png', head: 'Milestones\nworth marking',          sub: 'Calm progression. No confetti, no noise.' },
];

for (const s of SHOTS) {
  const p = `${SRC}/${s.src}`;
  if (!fs.existsSync(p)) {
    console.error(`MISSING ${p} — run capture.mjs first`);
    process.exit(1);
  }
}
fs.mkdirSync(`${OUT}/phoneScreenshots`, { recursive: true });

const dataUri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;

const page = await (await (await chromium.launch()).newContext({
  viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1,
})).newPage();

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;
     background:linear-gradient(170deg,hsl(166 45% 94%) 0%,hsl(36 20% 98%) 46%,hsl(36 20% 98%) 100%);
     display:flex;flex-direction:column;align-items:center}
.bar{width:100%;height:14px;background:hsl(166 70% 40%);flex:none}
.brand{margin-top:92px;font-size:26px;font-weight:700;letter-spacing:.34em;color:hsl(166 70% 34%)}
.brand b{font-weight:700}
h1{margin-top:38px;text-align:center;font-size:74px;line-height:1.08;font-weight:700;
   letter-spacing:-.035em;color:hsl(20 14% 13%);white-space:pre-line}
p.sub{margin-top:30px;text-align:center;font-size:30px;color:hsl(25 8% 42%)}
/* Device frame. The capture is 1080x1920 (9:16). Shown at 600px wide it is
   1067px tall, so the WHOLE screen fits inside the frame at the right phone
   aspect — the first cut used a 664x900 box, which reads as a tablet and
   cropped the shot halfway down. */
.phone{margin-top:70px;width:634px;height:1101px;border-radius:56px;background:#0b0b0c;
       padding:17px;box-shadow:0 34px 90px hsl(166 40% 20% / .19);flex:none;overflow:hidden}
.screen{width:600px;height:1067px;border-radius:42px;overflow:hidden;background:#fff;position:relative}
.screen img{position:absolute;top:0;left:0;width:600px;display:block}
.notch{position:absolute;top:13px;left:50%;transform:translateX(-50%);width:112px;height:7px;
       border-radius:5px;background:#0b0b0c;z-index:2;opacity:.85}
`;

let n = 0;
for (const s of SHOTS) {
  n++;
  await page.setContent(`<style>${CSS}</style>
    <div class="bar"></div>
    <div class="brand">N Y U S</div>
    <h1>${s.head.replace(/\n/g, '<br/>')}</h1>
    <p class="sub">${s.sub}</p>
    <div class="phone"><div class="screen">
      <div class="notch"></div>
      <img src="${dataUri(`${SRC}/${s.src}`)}"/>
    </div></div>`);
  await page.waitForTimeout(1400);   // webfont
  const dest = `${OUT}/phoneScreenshots/${n}.png`;
  await page.screenshot({ path: dest });
  console.log(`  ${n}.png  <- ${s.src}  "${s.head.replace(/\n/g, ' ')}"`);
}

// The feature graphic is already final at 1024x500 — copy it across unchanged.
fs.copyFileSync(`${SRC}/feature-graphic-1024x500.png`, `${OUT}/featureGraphic.png`);
console.log('  featureGraphic.png  <- feature-graphic-1024x500.png');

await page.context().browser().close();

// A 6th screenshot was staged before; the new set is 5. Play allows 2-8, but a
// leftover would be the old QA-contaminated art, so remove it explicitly.
const stale = `${OUT}/phoneScreenshots/6.png`;
if (fs.existsSync(stale)) {
  fs.rmSync(stale);
  console.log('  removed stale 6.png (old QA-account capture)');
}
console.log(`\nwrote ${n} phone screenshots + feature graphic -> ${OUT}`);
