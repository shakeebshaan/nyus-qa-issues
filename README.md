# NYUS QA Issues

Personal QA board for the NYUS app. File a screenshot + description from any device; Claude fixes the issue in the app repo, recaptures the screen, and publishes the result side-by-side.

- **Board**: https://shakeebshaan.github.io/nyus-qa-issues/ (fallback: https://raw.githack.com/shakeebshaan/nyus-qa-issues/main/index.html)
- **Data**: `data/issues.json` (single source of truth) · **Images**: `images/` (commit-sha-pinned raw URLs)

## Phone setup (once per device)

1. Create a fine-grained PAT: GitHub → Settings → Developer settings → Fine-grained tokens → repository access **only `nyus-qa-issues`** → Repository permissions → **Contents: Read and write**.
2. Open the board → tap **connect** → paste token → Save & test. Token lives only in that browser's localStorage.

## Dev-machine CLI (`tools/qa.mjs`, zero deps)

```bash
node tools/qa.mjs list [--all]
node tools/qa.mjs pull                                   # JSON manifest of open issues + local image paths
node tools/qa.mjs resolve <id> --image <absPath> --desc "root cause + fix" [--app-commit <sha>]
node tools/qa.mjs reopen <id> --note "still broken because…"
node tools/qa.mjs archive <id>                           # move a fixed issue to data/archive-<year>.json
node tools/qa.mjs archive --all-fixed                    # archive every fixed issue
```

Every mutation does `git pull --rebase` first and `git push` last.

## Rules

- **Never commit tokens.** The page keeps the PAT in localStorage only.
- **Public repo** — screenshots must come from the dedicated QA account only, never a real user account.
- `data/issues.json` schema: `{version, issues: [{id, createdAt, route?, description, imagePath, imageCommit, status: open|fixed, fix: {description, imagePath, imageCommit, fixedAt, appCommit?} | null, history: [...]}]}`
- Keep the active board under ~200 issues: archive fixed ones (Archive button on the card, or the CLI). Archived issues live in `data/archive-<year>.json` and stay browsable via "View archived" on the page; their images stay in `images/`.
