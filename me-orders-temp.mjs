import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));
const ACTIVE = GUEST.orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
const TERMINAL = GUEST.orders.filter((o) => o.status === "DELIVERED" || o.status === "CANCELLED");
const ACTIVE_IDS = JSON.stringify(ACTIVE.map((o) => o.id));

const detailHits = {};
let orderWrites = 0;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  const err = (s) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify({ message: "x" }) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: GUEST });
  if (!auth) return err(401);
  if (p === "/guests/me") return ok(GUEST);
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });

  if (p.startsWith("/guest/orders/")) {
    if (method !== "GET") { orderWrites += 1; return ok({}); }
    const id = decodeURIComponent(p.slice("/guest/orders/".length));
    detailHits[id] = (detailHits[id] || 0) + 1;
    const order = GUEST.orders.find((o) => o.id === id);
    if (!order) return err(404);
    return ok(order);
  }
  if (p === "/guest/orders") {
    if (method !== "GET") { orderWrites += 1; return ok({}); }
    return ok({ items: GUEST.orders, total: GUEST.orders.length });
  }
  return err(404);
});

await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    localStorage.setItem("grubpac.trackedOrderIds", "[]");
    sessionStorage.setItem("harness-cleared", "1");
  }
});

const panel = () => page.locator('button[aria-expanded][class*="justify-between"]');
const waitPanel = async (ms) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { if (await panel().first().isVisible()) return true; } catch {}
    await page.waitForTimeout(400);
  }
  return false;
};

// ---- Login (multi-room fixture -> room-selection -> skip) ----
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

// ---- Panel appears from profile orders even with wiped localStorage ----
const panelUp = await waitPanel(10000);
rec("bottom panel appears from /me active orders (empty localStorage)", panelUp);

try {
  await page.waitForFunction(
    (expected) => localStorage.getItem("grubpac.trackedOrderIds") === expected,
    ACTIVE_IDS,
    { timeout: 10000 },
  );
  rec("only active /me order ids are tracked", true, ACTIVE_IDS);
} catch {
  const actual = await page.evaluate(() => localStorage.getItem("grubpac.trackedOrderIds"));
  rec("only active /me order ids are tracked", false, actual);
}

const hitsFor = (id) => detailHits[id] || 0;
const allActiveFetched = ACTIVE.every((o) => hitsFor(o.id) > 0);
const terminalFetched = TERMINAL.filter((o) => hitsFor(o.id) > 0);
rec("each active order fetched via GET /guest/orders/{id}", allActiveFetched,
  JSON.stringify(Object.fromEntries(Object.entries(detailHits))));
rec("delivered/cancelled orders are never fetched", terminalFetched.length === 0,
  terminalFetched.map((o) => o.orderCode).join(","));

// ---- Status screen is confirmation-only: no inline order list ----
await page.goto(`${BASE}/order-status`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Order Placed!", { timeout: 20000 });

const defaultShown = await page.locator("text=Order ID #GUEST-DEMO-1").count();
rec("newest active order shown by default", defaultShown >= 1, `hits=${defaultShown}`);

const rows = await page.locator('button[aria-pressed]:has-text("GUEST-DEMO")').count();
rec("confirmation page has no inline order list", rows === 0, `rows=${rows}`);

// ---- Panel gains an ALL ACTIVE ORDERS button when several orders are active ----
await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
const dockBtn = page.locator('button[aria-expanded][class*="justify-between"]');
await dockBtn.waitFor({ timeout: 20000 });
await dockBtn.click();
await page.waitForSelector("text=VIEW DETAILS", { timeout: 5000 });
const viewDetailsCount = await page.locator('button:has-text("VIEW DETAILS")').count();
const allActiveCount = await page.locator('button:has-text("ALL ACTIVE ORDERS")').count();
rec("expanded panel shows VIEW DETAILS + ALL ACTIVE ORDERS",
  viewDetailsCount === 1 && allActiveCount === 1,
  `vd=${viewDetailsCount} aa=${allActiveCount}`);

await page.locator('button:has-text("ALL ACTIVE ORDERS")').click();
await page.waitForURL("**/active-orders", { timeout: 10000 });
await page.waitForSelector("text=View your orders in progress", { timeout: 10000 });

const cardButtons = page.locator('button:has-text("VIEW DETAILS")');
const cardCount = await cardButtons.count();
rec("all active orders page lists every active order", cardCount === ACTIVE.length, `cards=${cardCount}`);

const pageCopy = await page.locator("body").innerText();
rec("cards show server-driven statuses",
  pageCopy.includes("Placed") && pageCopy.includes("Preparing") && pageCopy.includes("Ready"));

await cardButtons.nth(1).click();
await page.waitForURL("**/order-status", { timeout: 10000 });
await page.waitForSelector("text=Order ID #GUEST-DEMO-2", { timeout: 10000 });
rec("card VIEW DETAILS opens that order's confirmation page", true);

rec("frontend never writes to the orders API", orderWrites === 0, `writes=${orderWrites}`);

await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
