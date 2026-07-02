import { readFileSync, existsSync } from "node:fs";
import { createSign } from "node:crypto";

const HOME = process.env.USERPROFILE || process.env.HOME;
const GA4_SA = [process.env.GA4_SA_JSON, `${HOME}\\Desktop\\nyus-ga4-sa.json`, `${HOME}\\Desktop\\NYUSLANDING\\scripts\\ga4-sa.json`].find(p => p && existsSync(p));
console.log("GA4_SA:", GA4_SA);

const b64url = (s) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function fetchT(url, opt = {}, ms = 25000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opt, signal: ac.signal }); } finally { clearTimeout(t); }
}
async function gscToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const signed = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claim))}`;
  const sig = createSign("RSA-SHA256").update(signed).end().sign(sa.private_key);
  const jwt = `${signed}.${sig.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  const r = await fetchT("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  const j = await r.json();
  if (!j.access_token) throw new Error("gsc token: " + JSON.stringify(j).slice(0, 120));
  return j.access_token;
}
async function pullGsc() {
  if (!GA4_SA) { console.log("NO GA4_SA"); return null; }
  try {
    const sa = JSON.parse(readFileSync(GA4_SA, "utf8"));
    const token = await gscToken(sa);
    console.log("Token OK");
    const nowMs = Date.now();
    const end = new Date(nowMs).toISOString().slice(0, 10);
    const start = new Date(nowMs - 30 * 86400000).toISOString().slice(0, 10);
    for (const siteUrl of ["sc-domain:nyus.in", "https://nyus.in/"]) {
      const enc = encodeURIComponent(siteUrl);
      console.log("Checking site:", siteUrl);
      const checkR = await fetchT(`https://www.googleapis.com/webmasters/v3/sites/${enc}`,
        { headers: { Authorization: `Bearer ${token}` } });
      console.log("Check status:", checkR.status, "ok:", checkR.ok);
      if (!checkR.ok) continue;
      const totR = await fetchT(
        `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
        { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: start, endDate: end, rowLimit: 1 }) });
      const tot = await totR.json();
      console.log("tot:", JSON.stringify(tot).slice(0, 300));
      const qR = await fetchT(
        `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
        { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: start, endDate: end, rowLimit: 5, dimensions: ["query"] }) });
      const q = await qR.json();
      const row = tot.rows?.[0];
      const topQueries = (q.rows || []).slice(0, 5).map(r => ({ query: r.keys[0], impressions: Math.round(r.impressions), position: +r.position.toFixed(1) }));
      const result = { impressions: Math.round(row?.impressions || 0), clicks: Math.round(row?.clicks || 0), ctr: row?.ctr ? +(row.ctr * 100).toFixed(1) : 0, position: row?.position ? +row.position.toFixed(1) : null, topQueries };
      console.log("GSC result:", JSON.stringify(result));
      return result;
    }
    console.log("No valid site found");
    return null;
  } catch (e) { console.error("pullGsc error:", e.message, e.stack); return null; }
}

const gsc = await pullGsc();
console.log("Final gsc:", gsc ? JSON.stringify(gsc) : null);
