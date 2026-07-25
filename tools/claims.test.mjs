#!/usr/bin/env node
// Contracts for the in-progress claim lock (i-20260717-3d27).
//   node tools/claims.test.mjs
//
// Zero deps, matching the rest of this repo. Run it after touching activeClaim,
// claim/release, or the terminal transitions that must drop a lock.
//
// The protected contract: a claim is a SOFT, SELF-EXPIRING lock. It must
//   • hide an in-flight card from a second tick, and
//   • let go on its own when the holding agent dies (no manual cleanup).
// A claim that could ever be sticky would park an issue forever, which is worse
// than the duplicate-tick problem it exists to solve.
process.env.SNAPFIX_NO_MAIN = "1";

const { activeClaim, claimMinutesLeft, applyReview, applyReopen } = await import("./qa.mjs");

const NOW = Date.parse("2026-07-25T12:00:00Z");
const withClaim = (mins, by = "agentA") => ({
  status: "open",
  claim: { by, at: "2026-07-25T11:00:00Z", expiresAt: new Date(NOW + mins * 60000).toISOString() },
});

const results = [];
const check = (name, cond) => results.push({ name, pass: !!cond });

// ── expiry is judged at read time ───────────────────────────────────────────
check("un-claimed issue reads as free", activeClaim({ status: "open" }, NOW) === null);
check("live claim reads as held", !!activeClaim(withClaim(30), NOW));
check("lapsed claim reads as free", activeClaim(withClaim(-1), NOW) === null);
check("claim expiring exactly now reads as free", activeClaim(withClaim(0), NOW) === null);

// ── a malformed claim must never be sticky ──────────────────────────────────
check("claim without expiresAt is ignored", activeClaim({ claim: { by: "a" } }, NOW) === null);
check("claim with junk expiresAt is ignored", activeClaim({ claim: { by: "a", expiresAt: "nope" } }, NOW) === null);
check("null/undefined issue is safe", activeClaim(null, NOW) === null && activeClaim(undefined, NOW) === null);

// ── countdown ───────────────────────────────────────────────────────────────
check("minutes left is the real remainder", claimMinutesLeft(withClaim(45).claim, NOW) === 45);
check("minutes left floors at 0, never negative", claimMinutesLeft(withClaim(-99).claim, NOW) === 0);

// ── handing the card on releases the lock ───────────────────────────────────
const flagged = withClaim(30);
applyReview(flagged, "need a product call", null, "2026-07-25T12:00:00Z", "me");
check("review drops the lock (owner's turn now)", flagged.claim === undefined);

const rejected = { ...withClaim(30), status: "fixed", fix: { description: "x" } };
applyReopen(rejected, "still broken", "2026-07-25T12:00:00Z", "owner");
check("reopen drops the lock (card is fair game again)", rejected.claim === undefined);

// ── ownership comparison the duplicate-tick guard relies on ─────────────────
const held = activeClaim(withClaim(30, "agentA"), NOW);
check("holder identity is readable for the guard", held.by === "agentA");

for (const r of results) console.log((r.pass ? "PASS  " : "FAIL  ") + r.name);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
