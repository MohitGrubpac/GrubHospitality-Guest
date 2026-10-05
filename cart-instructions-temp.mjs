import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const ORDER = {
  id: "ord-ci-1",
  orderCode: "GH-3101",
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
  cancelReason: null,
};

const TWO_CART = {
  kitchens: [
    {
      restaurantId: "kitchen-one-1",
      kitchenName: "Hyatt Place — Airport",
      items: [
        { menuItemId: "m-1", name: "Paneer Tikka", unitPriceMinor: 32000, quantity: 1, lineTotalMinor: 32000, available: true, note: null },
      ],
      subtotalMinor: 32000,
    },
    {
      restaurantId: "kitchen-two-2",
      kitchenName: "Hyatt Regency — Downtown",
      items: [
        { menuItemId: "m-2", name: "Veg Burger", unitPriceMinor: 24000, quantity: 2, lineTotalMinor: 48000, available: true, note: null },
      ],
      subtotalMinor: 48000,
    },
  ],
  itemCount: 3,
  grandTotalMinor: 80000,
};

const SINGLE_CART = {
  kitchens: [TWO_CART.kitchens[0]],
  itemCount: 1,
  grandTotalMinor: 32000,
};

const EMPTY_CART = { kitchens: [], grandTotalMinor: 0, itemCount: 0 };

let cartState = TWO_CART;
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

// ---- Scenario 1: multi-kitchen cart -> one instruction field per kitchen
cartState = TWO_CART;
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#order-now-btn", { timeout: 20000 });

const btnCount = await page.locator('[id^="add-instruction-btn-"]').count();
rec("multi-kitchen cart shows one Add Instruction per kitchen", btnCount === 2, `count=${btnCount}`);

const box = await page.locator("#add-instruction-btn-kitchen-one-1").boundingBox();
const cardBox = await page.locator("div.bg-white.rounded-2xl").first().boundingBox();
rec(
  "Add Instruction button hugs its content (not full width)",
  !!box && !!cardBox && box.width < cardBox.width - 40,
  `button=${box?.width?.toFixed(0)} card=${cardBox?.width?.toFixed(0)}`,
);

const cartText = await page.locator("body").innerText();
rec("clear button removed from cart", !cartText.includes("CLEAR"), "");
rec("per-kitchen Kitchen total rows removed", !cartText.includes("Kitchen total"), "");
rec("kitchen name headers still shown", cartText.includes("HYATT PLACE — AIRPORT"), "");

await page.locator("#add-instruction-btn-kitchen-one-1").click();
await page.waitForSelector("#order-instruction-input-kitchen-one-1", { timeout: 5000 });
await page.fill("#order-instruction-input-kitchen-one-1", "No onions");
await page.locator("button:has-text('Submit')").click();
await page.waitForSelector("#add-instruction-btn-kitchen-one-1", { timeout: 5000 });
const previewOne = await page.locator("body").innerText();
rec("entered note previews after submit", previewOne.includes("No onions"), "");

await page.locator("#add-instruction-btn-kitchen-two-2").click();
await page.waitForSelector("#order-instruction-input-kitchen-two-2", { timeout: 5000 });
await page.fill("#order-instruction-input-kitchen-two-2", "Extra spicy");
await page.locator("button:has-text('Submit')").click();
await page.waitForSelector("#add-instruction-btn-kitchen-two-2", { timeout: 5000 });

const openCount = await page.locator("textarea").count();
rec("textareas close after submit", openCount === 0, `open=${openCount}`);

await page.locator("#order-now-btn").click();
await page.waitForURL("**/order-status", { timeout: 20000 });

const b1 = checkoutBodies[0] || {};
rec(
  "multi-kitchen checkout carries both kitchen notes with names",
  b1.specialInstructions === "Hyatt Place — Airport: No onions · Hyatt Regency — Downtown: Extra spicy",
  JSON.stringify(b1.specialInstructions),
);
rec("checkout body carries roomNumber", b1.roomNumber === "1204", JSON.stringify(b1.roomNumber));
rec(
  "checkout body has no extra fields",
  Object.keys(b1).every((k) => ["specialInstructions", "roomNumber"].includes(k)),
  JSON.stringify(Object.keys(b1)),
);

// ---- Scenario 2: single-kitchen cart -> single instruction, no kitchen prefix
cartState = SINGLE_CART;
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#order-now-btn", { timeout: 20000 });

const singleCount = await page.locator('[id^="add-instruction-btn-"]').count();
rec("single-kitchen cart shows exactly one Add Instruction", singleCount === 1, `count=${singleCount}`);

await page.locator('[id^="add-instruction-btn-"]').click();
await page.locator("textarea").fill("Less spicy");
await page.locator("button:has-text('Submit')").click();
await page.waitForSelector('[id^="add-instruction-btn-"]', { timeout: 5000 });

await page.locator("#order-now-btn").click();
await page.waitForURL("**/order-status", { timeout: 20000 });

const b2 = checkoutBodies[1] || {};
rec(
  "single-kitchen note sent without kitchen prefix",
  b2.specialInstructions === "Less spicy",
  JSON.stringify(b2.specialInstructions),
);

// ---- Scenario 3: multi-kitchen cart with no notes -> default fallback line
cartState = TWO_CART;
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#order-now-btn", { timeout: 20000 });
await page.locator("#order-now-btn").click();
await page.waitForURL("**/order-status", { timeout: 20000 });

const b3 = checkoutBodies[2] || {};
rec(
  "empty notes fall back to multi-kitchen default",
  b3.specialInstructions === "Order placed for 2 kitchens.",
  JSON.stringify(b3.specialInstructions),
);
rec("three checkouts total", checkoutBodies.length === 3, `calls=${checkoutBodies.length}`);

await page.screenshot({ path: "cart-instructions.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
