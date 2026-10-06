import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const BASE_ORDER = {
  orderCode: "GH-2001",
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
  acceptedAt: null,
  cancelledAt: null,
  cancelReason: null,
  cancelComment: null,
};
const ORDER_1 = { ...BASE_ORDER, id: "ord-c1", status: "NEW" };
const ORDER_2 = {
  ...BASE_ORDER,
  id: "ord-c2",
  orderCode: "GH-2002",
  status: "SCHEDULED",
  scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const ORDER_3 = {
  ...BASE_ORDER,
  id: "ord-c3",
  orderCode: "GH-2003",
  status: "DELIVERED",
  acceptedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  deliveredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
};

const statuses = { "ord-c1": "NEW", "ord-c2": "SCHEDULED", "ord-c3": "DELIVERED" };
const cancelBodies = [];
let cancelFail = false;

const sourceFor = (id) =>
  id === "ord-c1" ? ORDER_1 : id === "ord-c2" ? ORDER_2 : ORDER_3;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
  const err = (status) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ message: "boom" }) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [] } });
  if (!auth) return err(401);
  if (p === "/guests/me") return ok({ ...GUEST, orders: [] });
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });

  const cancelMatch = p.match(/^\/guest\/orders\/([^/]+)\/cancel$/);
  if (cancelMatch && method === "POST") {
    const id = cancelMatch[1];
    const body = JSON.parse(route.request().postData() || "{}");
    cancelBodies.push(body);
    if (cancelFail) return err(500);
    const src = sourceFor(id);
    statuses[id] = "CANCELLED";
    src.cancelReason = body.reason ?? null;
    src.cancelComment = body.comment ?? null;
    src.cancelledAt = new Date().toISOString();
    return ok({ ...src, status: "CANCELLED" });
  }

  const detailMatch = p.match(/^\/guest\/orders\/(ord-c[123])$/);
  if (detailMatch) {
    const id = detailMatch[1];
    return ok({ ...sourceFor(id), status: statuses[id] });
  }
  if (p === "/guest/orders") return ok([]);
  return err(404);
});
await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    sessionStorage.setItem("harness-cleared", "1");
  }
  if (!sessionStorage.getItem("tracked-set")) {
    localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-c1"]));
    sessionStorage.setItem("tracked-set", "1");
  }
});

const doneCount = () => page.locator('img[alt="Done"]').count();
const waitPostCount = async (n) => {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (cancelBodies.length >= n) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return cancelBodies.length >= n;
};

// Footer buttons must stack (same column, second below the first) per Figma.
const stackedBelow = async (topSel, bottomSel) => {
  const a = await page.locator(topSel).first().boundingBox();
  const b = await page.locator(bottomSel).first().boundingBox();
  if (!a || !b) return { ok: false, d: `missing box top=${Boolean(a)} bottom=${Boolean(b)}` };
  const sameCol = Math.abs(a.x - b.x) < 4;
  const below = b.y >= a.y + a.height - 2;
  return {
    ok: sameCol && below,
    d: `top=(${a.x.toFixed(0)},${a.y.toFixed(0)}) bottom=(${b.x.toFixed(0)},${b.y.toFixed(0)})`,
  };
};

// Login (multi-room fixture -> room-selection -> skip)
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
{
  const deadline = Date.now() + 30000;
  let opened = false;
  while (!opened && Date.now() < deadline) {
    await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
    await page.locator("#get-otp-btn").click({ timeout: 5000 }).catch(() => {});
    opened = await page
      .waitForSelector('input[aria-label="OTP digit 1"]', { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!opened) throw new Error("OTP step never opened");
}
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

// ---- Phase A: NEW order - placed screen with Call Reception + Cancel Order
await page.goto(`${BASE}/order-status`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Order Placed!", { timeout: 20000 });
rec("NEW order headline reads Order Placed", true);
rec("accepted step still pending at NEW", (await page.locator("text=Waiting for the kitchen to accept").count()) >= 1);
rec("no done steps at NEW", (await doneCount()) === 0, `done=${await doneCount()}`);
rec("Call Reception link present", (await page.locator('a[href^="tel:"]').count()) >= 1);
rec("Cancel Order button present at NEW", (await page.locator("#page-cancel-order").count()) === 1);
const placedStack = await stackedBelow('a[href^="tel:"]', "#page-cancel-order");
rec("placed footer buttons are stacked vertically", placedStack.ok, placedStack.d);

// ---- Cancel sheet opens with the Figma content
await page.locator("#page-cancel-order").click();
await page.waitForSelector("#cancel-order-submit", { timeout: 10000 });
const sheetText = (await page.locator("body").innerText()).toLowerCase();
rec("sheet heading shows Cancel Order?", sheetText.includes("cancel order?"), "");
rec("warning copy matches Figma", sheetText.includes("your order will be cancelled immediately"), "");
rec("reason select rendered", (await page.locator("#cancel-reason-select").count()) === 1);
const commentPlaceholder = await page.locator("#cancel-comment").getAttribute("placeholder");
rec("comments placeholder is optional", commentPlaceholder === "Additional comments (optional)", String(commentPlaceholder));
rec("submit disabled until a reason is chosen", await page.locator("#cancel-order-submit").isDisabled());
rec("Keep Order button present", (await page.locator("#cancel-order-keep").count()) === 1);

// ---- KEEP ORDER closes the sheet without any request
await page.locator("#cancel-order-keep").click();
await page.waitForSelector("#cancel-order-submit", { state: "detached", timeout: 10000 });
rec("Keep Order closes the sheet with no POST", cancelBodies.length === 0, `posts=${cancelBodies.length}`);

// ---- Failed cancel keeps the sheet (toast) and the state
await page.locator("#page-cancel-order").click();
await page.waitForSelector("#cancel-reason-select", { timeout: 10000 });
await page.selectOption("#cancel-reason-select", "Changed my mind");
await page.fill("#cancel-comment", "Wrong room");
cancelFail = true;
await page.locator("#cancel-order-submit").click();
rec("first cancel POST fired", await waitPostCount(1), `posts=${cancelBodies.length}`);
const failText = (await page.locator("body").innerText()).toLowerCase();
rec("failed cancel shows an error toast", failText.includes("couldn't cancel"), "");
rec("failed cancel keeps the sheet open", (await page.locator("#cancel-order-submit").count()) === 1);
rec(
  "cancel payload is {reason, comment}",
  JSON.stringify(Object.keys(cancelBodies[0] || {}).sort()) === JSON.stringify(["comment", "reason"]) &&
    cancelBodies[0]?.reason === "Changed my mind" &&
    cancelBodies[0]?.comment === "Wrong room",
  JSON.stringify(cancelBodies[0]),
);

// ---- Retry succeeds -> cancelled screen per Figma
cancelFail = false;
await page.locator("#cancel-order-submit").click();
rec("second cancel POST fired", await waitPostCount(2), `posts=${cancelBodies.length}`);
await page.waitForSelector("text=Order Cancelled!", { timeout: 20000 });
rec("headline flips to Order Cancelled", true);
rec("sheet closed after success", (await page.locator("#cancel-order-submit").count()) === 0);

const cancelledText = (await page.locator("body").innerText()).toLowerCase();
rec("cancelled subline matches Figma", cancelledText.includes("you can place a new order anytime"), "");
rec("timeline shows In Process for prepared", (await page.locator("text=In Process…").count()) >= 1);
rec("timeline shows Est. 15 Minutes", (await page.locator("text=Est. 15 Minutes").count()) >= 1);
rec("timeline shows Est. 25 Minutes", (await page.locator("text=Est. 25 Minutes").count()) >= 1);
rec("Delivery Details uses Order ID #", (await page.locator("text=Order ID #GH-2001").count()) >= 1);
rec("Cancel Reason card shows the reason", cancelledText.includes("changed my mind"), "");
rec("Cancel Reason card shows the comment", cancelledText.includes("wrong room"), "");
rec("cancelled screen keeps Call Reception", (await page.locator('a[href^="tel:"]').count()) >= 1);
rec("cancelled screen offers Order Again", (await page.locator("#page-order-again").count()) === 1);
rec("cancel button gone once cancelled", (await page.locator("#page-cancel-order").count()) === 0);

// ---- Phase B: SCHEDULED order still offers cancel
await page.evaluate(() => localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-c2"])));
await page.goto(`${BASE}/order-status`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Order Scheduled!", { timeout: 20000 });
rec("scheduled headline reads Order Scheduled", true);
rec("scheduled screen offers Cancel Order", (await page.locator("#page-cancel-order").count()) === 1);
rec("scheduled screen offers Call Reception", (await page.locator('a[href^="tel:"]').count()) >= 1);
const schedStack = await stackedBelow('a[href^="tel:"]', "#page-cancel-order");
rec("scheduled footer buttons are stacked vertically", schedStack.ok, schedStack.d);

// ---- Phase C: once the kitchen prepares, cancel disappears
statuses["ord-c2"] = "PREPARING";
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Order Confirmed!", { timeout: 20000 });
rec("preparing headline reads Order Confirmed", true);
rec("cancel button hidden after the kitchen accepts", (await page.locator("#page-cancel-order").count()) === 0);
rec("Back to Kitchens offered while preparing", (await page.locator("text=Back to Kitchens").count()) >= 1);

// ---- Phase D: delivered order - Rate Your Experience + View Order Summary
await page.evaluate(() => localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-c3"])));
await page.goto(`${BASE}/order-status`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Order Delivered!", { timeout: 20000 });
rec("delivered headline reads Order Delivered", true);

const deliveredText = (await page.locator("body").innerText()).toLowerCase();
rec("delivered footer offers Rate Your Experience", (await page.locator("#page-rate-experience").count()) === 1);
rec("delivered footer offers View Order Summary", (await page.locator("#page-view-summary").count()) === 1);
rec(
  "delivered footer drops Back to Kitchens / Cancel / Order Again",
  !deliveredText.includes("back to kitchens") &&
    !deliveredText.includes("order again") &&
    (await page.locator("#page-cancel-order").count()) === 0,
  "",
);
rec("no Cancel Reason card on the delivered screen", !deliveredText.includes("cancel reason"), "");
const rateStack = await stackedBelow("#page-rate-experience", "#page-view-summary");
rec("delivered footer buttons are stacked vertically", rateStack.ok, rateStack.d);

await page.locator("#page-rate-experience").click();
await page.waitForURL(/\/profile\/rating-feedback\?orderId=/, { timeout: 20000 });
rec("Rate Your Experience opens the feedback page", page.url().includes("orderId=ord-c3"), page.url());

await page.goBack();
await page.waitForSelector("text=Order Delivered!", { timeout: 20000 });
await page.locator("#page-view-summary").click();
await page.waitForURL(/\/profile\/rating-feedback\?orderId=/, { timeout: 20000 });
rec("View Order Summary opens the order details (feedback) page", page.url().includes("orderId=ord-c3"), page.url());

await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
