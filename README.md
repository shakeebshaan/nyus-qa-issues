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
node tools/qa.mjs claim <id> [--ttl <min>] [--note "<text>"] [--force]   # take the in-progress lock
node tools/qa.mjs release <id>                           # hand it back before the TTL lapses
node tools/qa.mjs archive <id> | archive --all-fixed     # move fixed issue(s) to data/archive-<year>.json
```

`resolve` enforces the live goal **before** uploading: with the satisfaction bar > 0 you must pass `--judge <n≥bar>`; with the test gate on you must pass `--tests pass`. The judge score + test result render as badges on the fix card. Every mutation does `git pull --rebase` first and `git push` last, and stamps the acting GitHub login for multi-user attribution.

`claim` is the **duplicate-tick guard**: claiming a card another agent already holds exits **2** and names the holder, `pull` withholds their cards (reporting them as `claimedByOthers`), and the board shows a **⏳ In progress** pill with the holder and time remaining. Claims self-expire after `data/loop.json.claimTtlMinutes` (default 60) so an agent that dies mid-fix can't park an issue — see LOOP.md §2.1, contracts in `tools/claims.test.mjs`.

## Owner ↔ agent review loop

When the agent can't auto-fix (ambiguous, blocked on a decision/assets) it flags the issue: `review <id> --reason "…"`. The card jumps to the top with a **User review** badge. The owner answers via **↩ Respond** on the board (text + optional screenshots) — `pull` then surfaces `reviewReply` + the attached response images locally so the agent can *see* the direction, not just read it.

## Rules

- **Never commit tokens.** The page keeps the PAT in localStorage only. Screenshots live in the **private** repo — never the public board.
- **Public repo** — anything committed here is public; QA screenshots must come from the dedicated QA account only.
- Keep the active board under ~200 issues: archive fixed ones. Archived issues live in `data/archive-<year>.json`, browsable via "View resolved".
- `data/issues.json` schema: `{version, issues: [{id, createdAt, route?, description, author?, tags?, client?: {ua, viewport}, imagePaths[], imageCommits[], imagePrivate, status: open|fixed, needsReview?, reviewReason?, reviewReply?, reviewReplyImagePaths?[], claim?: {by, at, expiresAt, note?, tookOverFrom?}, fix: {description, imagePaths[], imagePrivate, fixedAt, by?, appCommit?, tests?, judge?} | null, history: [...], thread?: [{at, who: owner|claude, kind: review|resolve|reopen|reply, text, by?}]}]}`
- `claim` is the transient in-progress lock (added i-20260717-3d27) and is the ONE field that expires on its own: it is only honoured while `expiresAt` is in the future, so a missing/unparseable `expiresAt` reads as unclaimed. `resolve`/`review`/`reopen` delete it. Never treat it as durable state — it says "an agent is on this right now", nothing more.
- `thread` is the **append-only conversation log** (added i-20260717-3d27): `qa.mjs review/resolve/reopen` and the board's Respond dialog append an entry on every call, while the legacy single-value fields (`reviewReason`, `reviewReply`) keep their old overwrite semantics for back-compat. The board's thread viewer merges both sources (a thread entry whose text duplicates a legacy-rendered message is skipped), so successive review notes / edited replies are never lost.
