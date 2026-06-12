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
      }));
    console.log(JSON.stringify({ open, count: open.length }, null, 2));
  } else if (cmd === "resolve") {
    const id = idArg, image = flag("image"), desc = flag("desc"), appCommit = flag("app-commit");
    if (!id || !image || !desc) throw new Error('Usage: resolve <id> --image <absPath> --desc "<text>" [--app-commit <sha>]');
    if (!existsSync(image)) throw new Error("Image not found: " + image);
    git("pull", "--rebase");
    const db = loadDb();
    const issue = db.issues.find((i) => i.id === id);
    if (!issue) throw new Error("No such issue: " + id);
    if (issue.status === "fixed") throw new Error(id + " is already fixed.");

    const ext = (extname(image) || ".png").toLowerCase();
    const rel = `images/${id}-fix${ext}`;
    copyFileSync(image, join(ROOT, rel));
    git("add", rel);
    git("commit", "-m", `issue ${id}: fix screenshot`);
    const imageCommit = git("rev-parse", "HEAD");

    issue.fix = {
      description: desc,
      imagePath: rel,
      imageCommit,
      fixedAt: new Date().toISOString(),
      ...(appCommit ? { appCommit } : {}),
    };
    issue.status = "fixed";
    saveDb(db);
    git("add", "data/issues.json");
    git("commit", "-m", `issue ${id}: resolved`);
    gitPush();
    console.log(`Resolved ${id}`);
    console.log(`  fix shot: ${rawUrl(rel, imageCommit)}`);
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
    console.log("Commands: list [--all] | pull | resolve <id> --image <p> --desc <t> [--app-commit <sha>] | reopen <id> --note <t> | archive <id> | archive --all-fixed");
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
