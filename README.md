# NYUS QA Issues

Personal QA board for the NYUS app. File a screenshot + description from any device; Claude fixes the issue in the app repo, recaptures the screen, and publishes the result side-by-side. Now a **snapfix loop**: every fix must clear the board's goal (LLM-as-judge satisfaction bar, optional test gate) before it can post.

- **Board**: https://shakeebshaan.github.io/nyus-qa-issues/ (fallback: https://raw.githack.com/shakeebshaan/nyus-qa-issues/main/index.html)
- **Data**: `data/issues.json` (issues) · `data/loop.json` (live goal — satisfaction bar + test gate) · **Images**: private repo `nyus-qa-private` (token-gated; never served publicly)
- **Config**: `qa.config.json` (board + app + loop settings; `config.js` themes the board). Local-only overrides go in `qa.config.local.json` (gitignored).

## Phone setup (once per device)

1. Create a fine-grained PAT with **Contents: Read and write** on `nyus-qa-issues` **and** `nyus-qa-private` (the private repo holds screenshots).
2. Open the board → tap **connect** → paste token → Save & test. Token lives only in that browser's localStorage.

## The loop (goal + trigger)

A fix only posts when it clears the **goal** set on the board:

- **LLM-as-judge** — the agent self-scores the fix 0–100; it must be ≥ the **satisfaction bar** (slider on the board, stored in `data/loop.json`). Set the bar to 0 to disable.
- **Verifiable (optional)** — when the test gate is on, the app's tests must be confirmed passing. NYUS ships this gate **off** (`testGate:false`) because the suite has a known-failing baseline; flip it on via the board toggle once `npm test` is green.

```bash
node tools/loop.mjs status                 # show loop config, open count, satisfaction bar
node tools/loop.mjs run [--agent "<cmd>"]  # one tick: invoke the agent (default: claude -p "/fix-issues")
node tools/loop.mjs watch [--until-empty]  # poll for new issues, kick the agent
node tools/loop.mjs verify                 # run the verifiable gate (npm test + coverage)
node tools/loop.mjs schedule               # print the OS-scheduler line to install
```

## Dev-machine CLI (`tools/qa.mjs`, zero deps — git + gh)

```bash
node tools/qa.mjs list [--all]
node tools/qa.mjs pull                                   # JSON manifest of open issues + local image paths + live loop goal
node tools/qa.mjs resolve <id> --image <absPath> [--image <p2> …] --desc "root cause + fix" \
                          [--app-commit <sha>] [--tests pass|fail] [--coverage <n>] \
                          [--judge <0-100>] [--judge-note "<why>"]
node tools/qa.mjs review <id> --reason "<what it needs / why blocked>" [--tags a,b,c]
node tools/qa.mjs unreview <id>
node tools/qa.mjs reopen <id> --note "still broken because…"
node tools/qa.mjs archive <id> | archive --all-fixed     # move fixed issue(s) to data/archive-<year>.json
```

`resolve` enforces the live goal **before** uploading: with the satisfaction bar > 0 you must pass `--judge <n≥bar>`; with the test gate on you must pass `--tests pass`. The judge score + test result render as badges on the fix card. Every mutation does `git pull --rebase` first and `git push` last, and stamps the acting GitHub login for multi-user attribution.

## Owner ↔ agent review loop

When the agent can't auto-fix (ambiguous, blocked on a decision/assets) it flags the issue: `review <id> --reason "…"`. The card jumps to the top with a **User review** badge. The owner answers via **↩ Respond** on the board (text + optional screenshots) — `pull` then surfaces `reviewReply` + the attached response images locally so the agent can *see* the direction, not just read it.

## Rules

- **Never commit tokens.** The page keeps the PAT in localStorage only. Screenshots live in the **private** repo — never the public board.
- **Public repo** — anything committed here is public; QA screenshots must come from the dedicated QA account only.
- Keep the active board under ~200 issues: archive fixed ones. Archived issues live in `data/archive-<year>.json`, browsable via "View resolved".
- `data/issues.json` schema: `{version, issues: [{id, createdAt, route?, description, author?, tags?, imagePaths[], imageCommits[], imagePrivate, status: open|fixed, needsReview?, reviewReason?, reviewReply?, reviewReplyImagePaths?[], fix: {description, imagePaths[], imagePrivate, fixedAt, by?, appCommit?, tests?, judge?} | null, history: [...]}]}`
