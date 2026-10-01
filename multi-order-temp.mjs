import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const ORDER_LIVE = {
  id: "ord-live",
  orderCode: "GH-1001",
  status: "NEW",
  restaurantId: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7",
  hotelName: "Hyatt Place — Airport",
  guestId: "guest-1",
  guestName: "Aarav Mehta",
  roomNumber: "1204",
  items: [{ menuItemId: "m-6", itemName: "Butter Chicken", unitPriceMinor: 48000, quantity: 1 }],
  totalMinor: 48000,
  currency: "INR",
  placedAt: new Date().toISOString(),
  specialInstructions: null,
  cancelReason: null,
};
const ORDER_DONE = {
  ...ORDER_LIVE,
  id: "ord-done",
  orderCode: "GH-1002",
  status: "PREPARING",
  hotelName: "Hyatt Place — Downtown",
  items: [{ menuItemId: "m-1", itemName: "Chicken 65", unitPriceMinor: 32000, quantity: 2 }],
  totalMinor: 64000,
};

const TRACKED = JSON.stringify([ORDER_LIVE.id, ORDER_DONE.id]);

// failMode: "none" | "live" | "all"  -> transient 500s. goneDone: 404 for ord-done.
let failMode = "none";
let goneDone = false;
let liveHits = 0;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname.replace("/api/v1", "");
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  const err = (s) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify({ message: "transient" }) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [] } });
  if (!auth) return err(401);
  if (p === "/guests/me") return ok({ ...GUEST, orders: [] });
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });

  if (p === "/guest/orders/ord-live") {
    liveHits += 1;
    if (failMode === "all" || failMode === "live") return err(500);
    return ok(ORDER_LIVE);
  }
  if (p === "/guest/orders/ord-done") {
    if (goneDone) return err(404);
    if (failMode === "all") return err(500);
    return ok(ORDER_DONE);
  }
  if (p === "/guest/orders") return ok([ORDER_LIVE, ORDER_DONE]);
  return err(404);
});

await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    sessionStorage.setItem("harness-cleared", "1");
  }
});
await page.addInitScript((value) => {
  localStorage.setItem("grubpac.trackedOrderIds", value);
}, TRACKED);

const panel = () => page.locator('button[aria-expanded][class*="justify-between"]');
const panelVisible = async () => {
  try { return await panel().first().isVisible(); } catch { return false; }
};
const waitPanel = async (ms) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await panelVisible()) return true;
    await page.waitForTimeout(400);
  }
  return false;
};
const trackedIds = () => page.evaluate(() => localStorage.getItem("grubpac.trackedOrderIds"));
const idsAreBoth = async () => (await trackedIds()) === TRACKED;

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
await page.waitForSelector("text=Our Restaurants", { timeout: 20000 });

// ---- Phase 1: sibling order rows are clickable ----
await page.goto(`${BASE}/order-status`, { waitUntil: "domcontentloaded" });
try {
  await page.waitForSelector("text=Order Confirmed!", { timeout: 20000 });
} catch (error) {
  console.log("== /order-status body on failure ==\n" + (await page.locator("body").innerText()));
  console.log("url =", page.url(), "tracked =", await trackedIds());
  throw error;
}

const rows = page.locator('button[aria-pressed]:has-text("GH-100")');
const rowCount = await rows.count();
rec("multi-order checkout lists both order rows", rowCount === 2, `rows=${rowCount}`);

const rowLive = page.locator('button[aria-pressed]:has-text("GH-1001")');
const rowDone = page.locator('button[aria-pressed]:has-text("GH-1002")');

await rowDone.click();
await page.waitForSelector("text=Order GH-1002", { timeout: 10000 });
const donePressed = await rowDone.getAttribute("aria-pressed");
const showsDoneCode = await page.locator("text=Order GH-1002").count();
rec("clicking sibling order row switches to that order's details",
  donePressed === "true" && showsDoneCode >= 1,
  `pressed=${donePressed} codeHits=${showsDoneCode}`);

await rowLive.click();
await page.waitForSelector("text=Order GH-1001", { timeout: 10000 });
const livePressed = await rowLive.getAttribute("aria-pressed");
rec("clicking back restores the in-flight order", livePressed === "true", `pressed=${livePressed}`);

// ---- Phase 2: dock panel visible with an in-flight order ----
await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
const panelUp = await waitPanel(10000);
rec("bottom order panel visible while order is in flight", panelUp);
rec("both tracked ids persisted after load", await idsAreBoth(), await trackedIds());

// ---- Phase 3: transient failure during a live poll must NOT drop the panel ----
failMode = "live";
const hitsBefore = liveHits;
await page.waitForTimeout(24000); // one full 20s poll round while ord-live 500s
const polled = liveHits > hitsBefore;
const stillUp = await panelVisible();
rec("poll round happened while one order was failing", polled, `hits ${hitsBefore} -> ${liveHits}`);
rec("panel stays visible when a poll transiently fails (order not delivered yet)", stillUp);
rec("tracked ids untouched by transient poll failure", await idsAreBoth(), await trackedIds());
failMode = "none";

// ---- Phase 4: cold start where EVERY tracked fetch fails -> auto recovery ----
failMode = "all";
await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const blankAfterFail = !(await panelVisible());
rec("panel is blank only while all fetches are failing", blankAfterFail);
rec("tracked ids survive a fully failed adopt round", await idsAreBoth(), await trackedIds());

failMode = "none";
const recovered = await waitPanel(15000);
rec("panel recovers automatically after transient cold-start failure", recovered);
rec("ids intact after recovery", await idsAreBoth(), await trackedIds());

// ---- Phase 5: one of two orders fails at adopt -> the OTHER id must not be pruned ----
failMode = "live";
await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const idsAfterPartial = await trackedIds();
rec("adopt keeps both ids when one order transiently fails (no inverted pruning)",
  idsAfterPartial === TRACKED, idsAfterPartial);

failMode = "none";
const recoveredPartial = await waitPanel(15000);
rec("panel recovers once the failed order fetches again", recoveredPartial);

// ---- Phase 6: definite 404 prunes only that id ----
goneDone = true;
await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
try {
  await page.waitForFunction(
    (expected) => localStorage.getItem("grubpac.trackedOrderIds") === expected,
    JSON.stringify([ORDER_LIVE.id]),
    { timeout: 10000 },
  );
  rec("404 order id is pruned from tracking", true);
} catch {
  rec("404 order id is pruned from tracking", false, await trackedIds());
}
const panelAfterPrune = await waitPanel(8000);
rec("panel still up for the surviving in-flight order", panelAfterPrune);

await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
