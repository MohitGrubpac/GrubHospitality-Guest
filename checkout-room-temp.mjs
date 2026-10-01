import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const ORDER = {
  id: "ord-co-1",
  orderCode: "GH-2001",
  status: "NEW",
  restaurantId: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7",
  hotelName: "Hyatt Place — Airport",
  guestId: GUEST.id,
  guestName: "Aarav Mehta",
  roomNumber: "1204",
  items: [{ menuItemId: "m-1", itemName: "Paneer Tikka", unitPriceMinor: 32000, quantity: 1 }],
  totalMinor: 32000,
  currency: "INR",
  placedAt: new Date().toISOString(),
  specialInstructions: null,
  cancelReason: null,
};

const FULL_CART = {
  kitchens: [
    {
      restaurantId: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7",
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
    checkoutBodies.push(JSON.parse(route.request().postData() || "{}"));
    cartState = EMPTY_CART;
    return ok([ORDER]);
  }
  if (p === `/guest/orders/${ORDER.id}`) return ok(ORDER);
  if (p === "/guest/orders") return ok([ORDER]);
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    sessionStorage.setItem("harness-cleared", "1");
  }
});

// Login (multi-room fixture -> room-selection -> skip; falls back to first room)
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

// ---- Checkout 1: default room (first booked) must reach the request body
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#order-now-btn", { timeout: 20000 });

const shownRoom = await page.locator("main, body").first().innerText();
rec("cart shows default delivery room", shownRoom.includes("Room 1204"), "Room 1204");

await page.locator("#order-now-btn").click();
await page.waitForURL("**/order-status", { timeout: 20000 });

rec("checkout called once", checkoutBodies.length === 1, `calls=${checkoutBodies.length}`);
rec(
  "checkout body carries default roomNumber",
  checkoutBodies[0]?.roomNumber === "1204",
  JSON.stringify(checkoutBodies[0]),
);
rec(
  "roomNumber sent as a string",
  typeof checkoutBodies[0]?.roomNumber === "string",
  typeof checkoutBodies[0]?.roomNumber,
);

// ---- Checkout 2: switched room must replace the default
cartState = FULL_CART;
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#order-now-btn", { timeout: 20000 });

await page.locator("#change-room-btn").click();
await page.waitForSelector('[role="dialog"][aria-label="Switch Room"]', { timeout: 5000 });
await page.locator("label", { hasText: "Room 1205" }).click();
await page.locator('button:has-text("Confirm Room")').click();
await page.waitForTimeout(300);

const switched = await page.locator("body").innerText();
rec("delivery details update to switched room", switched.includes("Room 1205"), "Room 1205");

await page.locator("#order-now-btn").click();
await page.waitForURL("**/order-status", { timeout: 20000 });

rec("checkout called twice", checkoutBodies.length === 2, `calls=${checkoutBodies.length}`);
rec(
  "checkout body carries switched roomNumber",
  checkoutBodies[1]?.roomNumber === "1205",
  JSON.stringify(checkoutBodies[1]),
);
rec(
  "no other fields leak into checkout body",
  Object.keys(checkoutBodies[1] || {}).every((k) => ["specialInstructions", "roomNumber"].includes(k)),
  JSON.stringify(Object.keys(checkoutBodies[1] || {})),
);

await page.screenshot({ path: "checkout-room.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
