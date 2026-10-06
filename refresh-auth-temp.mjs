import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const jwt = (expSec) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ exp: expSec, sub: "guest-1" })}.sig`;
const EXPIRED = jwt(Math.floor(Date.now() / 1000) - 3600);
const VALID_A2 = jwt(Math.floor(Date.now() / 1000) + 3600);
const VALID_A3 = jwt(Math.floor(Date.now() / 1000) + 3600);

const A_KEY = "grubpac.guest.accessToken";
const R_KEY = "grubpac.guest.refreshToken";

let mode = "ok"; // ok | me401-refresh500 | me401-refresh401
const hits = { refresh: 0, refreshBody: [], meBearer: [] };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const auth = route.request().headers().authorization || "";
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  const fail = (s, b) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: EXPIRED, refreshToken: "r1", guest: { ...GUEST, orders: [] } });

  if (p === "/guest-auth/refresh") {
    hits.refresh += 1;
    try {
      hits.refreshBody.push(route.request().postDataJSON()?.refreshToken ?? null);
    } catch {
      hits.refreshBody.push(null);
    }
    if (mode === "me401-refresh500") return fail(500, { message: "boom" });
    if (mode === "me401-refresh401") return fail(401, { message: "refresh expired" });
    const n = hits.refresh;
    return ok({ accessToken: n === 1 ? VALID_A2 : VALID_A3, refreshToken: n === 1 ? "r2" : "r3" });
  }

  if (!auth) return fail(401, { message: "unauthorized" });

  if (p === "/guests/me") {
    hits.meBearer.push(auth.replace("Bearer ", ""));
    if (mode !== "ok") return fail(401, { message: "access expired" });
    return ok({ ...GUEST, orders: [] });
  }
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
  return fail(404, {});
});
await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    sessionStorage.setItem("harness-cleared", "1");
  }
});

const storage = async () => page.evaluate(([a, r]) => ({
  a: localStorage.getItem(a),
  r: localStorage.getItem(r),
}), [A_KEY, R_KEY]);

// ---- S1: login stores an EXPIRED access token -> bootstrap must proactively refresh
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
await page.locator("#get-otp-btn").click();
await page.waitForSelector('input[aria-label="OTP digit 1"]', { timeout: 20000 });
for (const [i, d] of ["1", "2", "3", "4"].entries()) {
  await page.fill(`input[aria-label="OTP digit ${i + 1}"]`, d);
}
await page.locator("#verify-otp-btn").click();
await page.waitForURL(/\/(room-selection|home)/, { timeout: 20000 });
if (page.url().includes("/room-selection")) {
  await page.waitForSelector("#room-continue", { timeout: 20000 });
  await page.locator("button:has-text('Skip')").click();
}
await page.waitForURL("**/home", { timeout: 20000 });

await page.waitForFunction(
  ([a, r, expect]) => localStorage.getItem(a) === expect[0] && localStorage.getItem(r) === expect[1],
  [A_KEY, R_KEY, [VALID_A2, "r2"]],
  { timeout: 20000 },
).catch(() => {});

let s = await storage();
rec("expired access token triggers proactive refresh", hits.refresh >= 1, `refreshHits=${hits.refresh}`);
rec("refresh sent with the stored refresh token", hits.refreshBody[0] === "r1", `body=${hits.refreshBody[0]}`);
rec("profile fetched with the refreshed bearer", hits.meBearer.includes(VALID_A2), `bearers=${JSON.stringify(hits.meBearer.map((b) => b.slice(0, 12)))}`);
rec("profile never sent the expired token", !hits.meBearer.includes(EXPIRED));
rec("rotated token pair persisted", s.a === VALID_A2 && s.r === "r2", `a=${(s.a || "").slice(0, 12)} r=${s.r}`);

// ---- S2: access token rejected + refresh 500 -> transient failure must KEEP tokens
mode = "me401-refresh500";
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
s = await storage();
rec("transient refresh failure lands on login", /\/login/.test(page.url()), page.url());
rec("transient refresh failure keeps both tokens", s.a === VALID_A2 && s.r === "r2", `a=${(s.a || "").slice(0, 12)} r=${s.r}`);

// ---- S3: backend healthy again -> kept session recovers without re-login
const refreshBefore = hits.refresh;
mode = "ok";
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForURL("**/home", { timeout: 20000 }).catch(() => {});
s = await storage();
rec("session recovers from kept tokens", /\/home/.test(page.url()), page.url());
rec("recovery reuses the stored access token (no extra refresh)", hits.refresh === refreshBefore && s.a === VALID_A2 && s.r === "r2", `refresh ${refreshBefore} -> ${hits.refresh}`);

// ---- S4: refresh definitively rejected (401) -> session cleared
mode = "me401-refresh401";
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
s = await storage();
rec("definitive refresh rejection clears both tokens", s.a === null && s.r === null, `a=${s.a} r=${s.r}`);
rec("definitive refresh rejection redirects to login", /\/login/.test(page.url()), page.url());

await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
