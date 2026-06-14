#!/usr/bin/env node
// NYUS QA tracker CLI — zero deps, pure git. Run from anywhere:
//   node tools/qa.mjs list [--all]
//   node tools/qa.mjs pull
//   node tools/qa.mjs resolve <id> --image <absPath> --desc "<text>" [--app-commit <sha>]
//   node tools/qa.mjs reopen <id> --note "<text>"
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB = join(ROOT, "data", "issues.json");
const OWNER_REPO = "shakeebshaan/nyus-qa-issues";

function git(...args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}
function gitPush() {
  try { git("push"); }
  catch {
    git("pull", "--rebase");
    git("push");
  }
}
const loadDb = () => JSON.parse(readFileSync(DB, "utf8"));
const saveDb = (db) => writeFileSync(DB, JSON.stringify(db, null, 2) + "\n");
const flag = (name) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
// Collect ALL values for a repeatable flag (e.g. multiple --image for a
// multi-screen fix). Returns [] when absent.
const allFlag = (name) => {
  const out = [];
  process.argv.forEach((a, i) => { if (a === "--" + name && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
};
const rawUrl = (path, commit) => `https://raw.githubusercontent.com/${OWNER_REPO}/${commit || "main"}/${path}`;

const [, , cmd, idArg] = process.argv;

try {
  if (cmd === "list") {
    git("pull", "--rebase");
    const db = loadDb();
    const rows = db.issues
      .filter((i) => process.argv.includes("--all") || i.status === "open")
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    if (!rows.length) { console.log("No " + (process.argv.includes("--all") ? "" : "open ") + "issues."); process.exit(0); }
    for (const i of rows) {
      console.log(
        `${i.id}  ${i.status.toUpperCase().padEnd(5)}  ${(i.createdAt || "").slice(0, 10)}  ${(i.route || "-").padEnd(22)}  ${i.description.replace(/\s+/g, " ").slice(0, 60)}`
      );
    }
  } else if (cmd === "pull") {
    git("pull", "--rebase");
    const db = loadDb();
    const open = db.issues
      .filter((i) => i.status === "open")
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
      .map((i) => ({
        id: i.id,
        createdAt: i.createdAt,
        route: i.route,
        description: i.description,
        image: join(ROOT, i.imagePath),
        reopenNote: (i.history || []).filter((h) => h.event === "reopened").slice(-1)[0]?.note || null,
        needsReview: !!i.needsReview,
        reviewReason: i.reviewReason || null,
        reviewReply: i.reviewReply || null,
        tags: i.tags || null,
      }));
    console.log(JSON.stringify({ open, count: open.length }, null, 2));
  } else if (cmd === "resolve") {
    // Multiple --image flags supported: a fix that spans two screens / scroll
    // positions can submit 2+ fix images (shown side-by-side on the board).
    const id = idArg, images = allFlag("image"), desc = flag("desc"), appCommit = flag("app-commit");
    if (!id || images.length === 0 || !desc) throw new Error('Usage: resolve <id> --image <absPath> [--image <absPath2> …] --desc "<text>" [--app-commit <sha>]');
    for (const img of images) if (!existsSync(img)) throw new Error("Image not found: " + img);
    git("pull", "--rebase");
    const db = loadDb();
    const issue = db.issues.find((i) => i.id === id);
    if (!issue) throw new Error("No such issue: " + id);
    if (issue.status === "fixed") throw new Error(id + " is already fixed.");

    // First image keeps the canonical name (backward-compat); extras get -2, -3…
    const relPaths = images.map((img, idx) => {
      const ext = (extname(img) || ".png").toLowerCase();
      const rel = `images/${id}-fix${idx === 0 ? "" : "-" + (idx + 1)}${ext}`;
      copyFileSync(img, join(ROOT, rel));
      git("add", rel);
      return rel;
    });
    git("commit", "-m", `issue ${id}: fix screenshot${relPaths.length > 1 ? "s (" + relPaths.length + ")" : ""}`);
    const imageCommit = git("rev-parse", "HEAD");

    issue.fix = {
      description: desc,
      imagePath: relPaths[0],   // backward-compat: first image
      imagePaths: relPaths,     // all fix images (multi-image support)
      imageCommit,
      fixedAt: new Date().toISOString(),
      ...(appCommit ? { appCommit } : {}),
    };
    issue.status = "fixed";
    // A fix clears any pending user-review flag.
    issue.needsReview = false;
    delete issue.reviewReason;
    delete issue.reviewedAt;
    saveDb(db);
    git("add", "data/issues.json");
    git("commit", "-m", `issue ${id}: resolved`);
    gitPush();
    console.log(`Resolved ${id} (${relPaths.length} fix image${relPaths.length > 1 ? "s" : ""})`);
    relPaths.forEach((rel) => console.log(`  fix shot: ${rawUrl(rel, imageCommit)}`));
  } else if (cmd === "reopen") {
    const id = idArg, note = flag("note");
    if (!id || !note) throw new Error('Usage: reopen <id> --note "<text>"');
    git("pull", "--rebase");
    const db = loadDb();
    const issue = db.issues.find((i) => i.id === id);
    if (!issue) throw new Error("No such issue: " + id);
    if (issue.status !== "fixed") throw new Error(id + " is not fixed — nothing to reopen.");
    issue.history = issue.history || [];
    issue.history.push({ at: new Date().toISOString(), event: "reopened", note, previousFix: issue.fix });
    issue.fix = null;
    issue.status = "open";
    saveDb(db);
    git("add", "data/issues.json");
    git("commit", "-m", `issue ${id}: reopened`);
    gitPush();
    console.log(`Reopened ${id}`);
  } else if (cmd === "review") {
    // Flag an open issue as needing the owner's review (couldn't auto-fix, or
    // blocked on a decision/assets). Surfaces at the TOP of the board with a
    // "User review" badge + the reason. Optional comma-separated --tags.
    const id = idArg, reason = flag("reason"), tagsRaw = flag("tags");
    if (!id || !reason) throw new Error('Usage: review <id> --reason "<what it needs / why not fixed>" [--tags a,b,c]');
    git("pull", "--rebase");
    const db = loadDb();
    const issue = db.issues.find((i) => i.id === id);
    if (!issue) throw new Error("No such issue: " + id);
    issue.needsReview = true;
    issue.reviewReason = reason;
    issue.reviewedAt = new Date().toISOString();
    if (tagsRaw) {
      issue.tags = tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    }
    saveDb(db);
    git("add", "data/issues.json");
    git("commit", "-m", `issue ${id}: flagged for user review`);
    gitPush();
    console.log(`Flagged ${id} for user review`);
  } else if (cmd === "unreview") {
    // Clear the user-review flag (the blocker is resolved / no longer needed).
    const id = idArg;
    if (!id) throw new Error("Usage: unreview <id>");
    git("pull", "--rebase");
    const db = loadDb();
    const issue = db.issues.find((i) => i.id === id);
    if (!issue) throw new Error("No such issue: " + id);
    issue.needsReview = false;
    delete issue.reviewReason;
    delete issue.reviewedAt;
    saveDb(db);
    git("add", "data/issues.json");
    git("commit", "-m", `issue ${id}: cleared user-review flag`);
    gitPush();
    console.log(`Cleared user-review flag on ${id}`);
  } else if (cmd === "archive") {
    const all = process.argv.includes("--all-fixed");
    if (!all && !idArg) throw new Error("Usage: archive <id> | archive --all-fixed");
    git("pull", "--rebase");
    const db = loadDb();
    const targets = all
      ? db.issues.filter((i) => i.status === "fixed")
      : db.issues.filter((i) => i.id === idArg);
    if (!all && !targets.length) throw new Error("No such issue: " + idArg);
    if (!all && targets[0].status !== "fixed") throw new Error(idArg + " is not fixed — only fixed issues archive.");
    if (!targets.length) { console.log("No fixed issues to archive."); process.exit(0); }

    const year = new Date().getFullYear();
    const archPath = join(ROOT, "data", `archive-${year}.json`);
    const arch = existsSync(archPath) ? JSON.parse(readFileSync(archPath, "utf8")) : { version: 1, issues: [] };
    const now = new Date().toISOString();
    for (const t of targets) {
      if (!arch.issues.some((a) => a.id === t.id)) arch.issues.push({ ...t, archivedAt: now });
    }
    const ids = new Set(targets.map((t) => t.id));
    db.issues = db.issues.filter((i) => !ids.has(i.id));
    writeFileSync(archPath, JSON.stringify(arch, null, 2) + "\n");
    saveDb(db);
    git("add", "data");
    git("commit", "-m", all ? `archive: ${targets.length} fixed issue(s)` : `issue ${idArg}: archived`);
    gitPush();
    console.log(`Archived ${targets.length} → data/archive-${year}.json`);
  } else {
    console.log("Commands: list [--all] | pull | resolve <id> --image <p> --desc <t> [--app-commit <sha>] | review <id> --reason <t> [--tags a,b] | unreview <id> | reopen <id> --note <t> | archive <id> | archive --all-fixed");
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
