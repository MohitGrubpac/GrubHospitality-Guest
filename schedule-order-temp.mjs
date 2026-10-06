import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const ORDER = {
  id: "ord-sched-1",
  orderCode: "GH-4101",
  status: "NEW",
  restaurantId: "kitchen-one-1",
  hotelName: "Hyatt Place — Airport",
  guestId: GUEST.id,
  guestName: "Aarav Mehta",
  roomNumber: "1204",
  items: [{ menuItemId: "m-1", itemName: "Paneer Tikka", unitPriceMinor: 32000, quantity: 1 }],
  totalMinor: 32000,
  currency: "INR",
  placedAt: new Date().toISOString(),
  specialInstructions: null,
  scheduledAt: null,
  cancelReason: null,
};

const FULL_CART = {
  kitchens: [
    {
      restaurantId: "kitchen-one-1",
      kitchenName: "Hyatt Place — Airport",
      items: [
        { menuItemId: "m-1", name: "Paneer Tikka", unitPriceMinor: 32000, quantity: 1, lineTotalMinor: 32000, available: true, note: null },
      ],
      subtotalMinor: 32000,
    },
  ],
  itemCount: 1,
  grandTotalMinor: 32000,
};

const EMPTY_CART = { kitchens: [], grandTotalMinor: 0, itemCount: 0 };

let cartState = FULL_CART;
let lastCreated = ORDER;
const checkoutBodies = [];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [] } });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok({ ...GUEST, orders: [] });
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart" && method === "GET") return ok(cartState);
  if (p === "/guest/cart/checkout" && method === "POST") {
    const body = JSON.parse(route.request().postData() || "{}");
    checkoutBodies.push(body);
    cartState = EMPTY_CART;
    lastCreated = {
      ...ORDER,
      status: body.scheduledAt ? "SCHEDULED" : "NEW",
      scheduledAt: body.scheduledAt || null,
    };
    return ok([lastCreated]);
  }
  if (p === `/guest/orders/${lastCreated.id}`) return ok(lastCreated);
  if (p === "/guest/orders") return ok([lastCreated]);
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    sessionStorage.setItem("harness-cleared", "1");
  }
});

// Login (multi-room fixture -> room-selection -> skip)
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

// ---- Both order buttons present on the cart
cartState = FULL_CART;
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#order-now-btn", { timeout: 20000 });
rec("place order button present", await page.locator("#order-now-btn").isVisible(), "");
rec("schedule order button present", await page.locator("#schedule-order-btn").isVisible(), "");

// ---- Cancel path: open modal, close, nothing is sent
await page.locator("#schedule-order-btn").click();
await page.waitForSelector('div[role="dialog"][aria-label="Schedule Order"]', { timeout: 5000 });

const dateTabs = await page.locator('[id^="schedule-date-"]').count();
rec("modal offers 7 dates", dateTabs === 7, `tabs=${dateTabs}`);
const slotCount = await page.locator('[id^="schedule-time-"]').count();
rec("modal offers time slots", slotCount > 0, `slots=${slotCount}`);

await page.locator("#schedule-modal-close").click();
await page.waitForSelector('div[role="dialog"][aria-label="Schedule Order"]', { state: "detached", timeout: 5000 });
rec("closing modal places no order", checkoutBodies.length === 0, `calls=${checkoutBodies.length}`);

// ---- Confirm path: Tomorrow 19:30 -> scheduled checkout
await page.locator("#schedule-order-btn").click();
await page.waitForSelector('div[role="dialog"][aria-label="Schedule Order"]', { timeout: 5000 });
await page.locator("#schedule-date-1").click();
await page.locator("#schedule-time-19-30").click();
const nowBtnDisabled = await page.locator("#schedule-now-btn").isDisabled();
rec("schedule now enables after picking a slot", nowBtnDisabled === false, `disabled=${nowBtnDisabled}`);

await page.locator("#schedule-now-btn").click();
await page.waitForURL("**/order-status", { timeout: 20000 });

const b1 = checkoutBodies[0] || {};
rec("checkout body carries scheduledAt", typeof b1.scheduledAt === "string", JSON.stringify(b1.scheduledAt));

const when = b1.scheduledAt ? new Date(b1.scheduledAt) : null;
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
rec(
  "scheduledAt is tomorrow at 19:30",
  !!when &&
    when.getHours() === 19 &&
    when.getMinutes() === 30 &&
    when.getDate() === tomorrow.getDate() &&
    when.getMonth() === tomorrow.getMonth(),
  when ? when.toString() : "invalid",
);
rec("scheduled checkout keeps roomNumber", b1.roomNumber === "1204", JSON.stringify(b1.roomNumber));
rec(
  "scheduled checkout has no extra fields",
  Object.keys(b1).every((k) => ["specialInstructions", "roomNumber", "scheduledAt"].includes(k)),
  JSON.stringify(Object.keys(b1)),
);
rec(
  "scheduled body has all three curl keys",
  Object.keys(b1).sort().join(",") === "roomNumber,scheduledAt,specialInstructions",
  JSON.stringify(Object.keys(b1).sort()),
);
rec("specialInstructions is always a string", typeof b1.specialInstructions === "string", typeof b1.specialInstructions);
rec(
  "scheduledAt is ISO-8601 with Z",
  typeof b1.scheduledAt === "string" && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(b1.scheduledAt),
  String(b1.scheduledAt),
);

const statusText = (await page.locator("body").innerText()).toLowerCase();
rec("confirmation page shows scheduled state", statusText.includes("order scheduled"), "");

// ---- Instant path: Place order must NOT send scheduledAt
cartState = FULL_CART;
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#order-now-btn", { timeout: 20000 });
await page.locator("#order-now-btn").click();
await page.waitForURL("**/order-status", { timeout: 20000 });

const b2 = checkoutBodies[1] || {};
rec("instant checkout has no scheduledAt", !("scheduledAt" in b2), JSON.stringify(Object.keys(b2)));
rec("two checkouts total", checkoutBodies.length === 2, `calls=${checkoutBodies.length}`);

await page.screenshot({ path: "schedule-order.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
