# Play Store assets — capture harness (QA `i-20260819-d2as`)

Produces the 5 phone screenshots + the 1024×500 feature graphic from **real app
screens** on a disposable demo account. Output lands in `../../tmp/store-assets/`
(gitignored — the board repo never carries screenshots).

## Run order

Dev server on `:8080`, demo creds in
`nyus-well-tracker-00146a-75469/.qa-report/_qa_creds.json` (`main`).

```bash
node seed-day.mjs             # weigh-in + water + sleep + steps + 2 ad-hoc meals
node seed-plan-meals.mjs      # mark 2 of today's PLANNED meals eaten
node seed-history.mjs         # 6 prior days of weigh-ins (trend + streak)
node seed-workout.mjs         # complete yesterday's session  (optional)
node seed-partial-session.mjs # leave today's session 3/6 done
node capture.mjs
```

Every seed script **refuses to run** unless the `main` credentials match
`/demo/i`. All writes go through the public API exactly as the app would — no
direct DB writes anywhere in this directory.

## What each fix in here was paid for

- **1080 CSS px renders the tablet layout.** Phone shots are 360×640 CSS at
  `deviceScaleFactor: 3` — that is 1080×1920 device px of the *phone* layout.
- **A hand-made context does not inherit the driver's `addInitScript`.** Without
  the auth + locale keys stamped in `capture.mjs`, every route captures the
  `LanguagePicker`, which is an early return above `AppLockGate`.
- **The coach FAB carries `data-coach-fab` on its wrapper.** Matching on
  `aria-label` finds nothing: the label is on an inner `<button>` and the fixed
  positioning is on the wrapper, so no single element has both.
- **Dismissing a card scrolls it into view.** Playwright's auto-scroll is how one
  pass shot the dashboard mid-page with the hero off-screen. Routes scroll inside
  `PageTransition`'s own surface, so `window.scrollTo` alone is not enough —
  reset `[data-scroll-root="page"]` too.
- **Celebrations fire on the first load after new data and then latch.** Hence
  the throwaway warm-up pass; a cold capture shoots "Badge earned +50 XP" over
  the hero.
- **The cycle first-run prompt expands into a full form** and eats the fold. Its
  own once-per-day marker (`nyus_cycle_prompt_dismissed`, a local date string) is
  stamped rather than racing the UI.
- **The text heuristic is not sufficient evidence.** A pass can report `ok` on
  every shot and still be visually unusable. Look at the images.

## One product observation, worth a board item of its own

Finishing a session advances the progressive plan, so "Today's Activity"
immediately re-renders the NEXT session at 0/6 — the screen reads as untouched
on a day you actually trained. `seed-partial-session.mjs` sidesteps it for the
screenshots; the behaviour itself is unaddressed.
