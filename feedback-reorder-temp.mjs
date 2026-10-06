import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const order = (id) => ({
  id,
  orderCode: "GH-4101",
  status: "DELIVERED",
  restaurantId: "kitchen-one-1",
  hotelName: "Hyatt Place — Airport",
  guestId: GUEST.id,
  guestName: "Aarav Mehta",
  roomNumber: "1204",
  items: [
    { menuItemId: "m-1", itemName: "Paneer Tikka", unitPriceMinor: 32000, quantity: 1 },
    { menuItemId: "m-2", itemName: "Chicken Biryani", unitPriceMinor: 28000, quantity: 2 },
  ],
  totalMinor: 88000,
  currency: "INR",
  placedAt: new Date(Date.now() - 86400000).toISOString(),
});

// An order the profile already carries a server-side review for. The detail
// endpoint deliberately omits `review` - only GET /guests/me embeds it - so the
// read-only view has to resolve through the profile, never through local state.
const SERVER_ORDER = {
  id: "ord-srv-1",
  orderCode: "ODR-99",
  restaurantId: "kitchen-one-1",
  hotelName: "Hyatt Place — Airport",
  guestId: GUEST.id,
  guestName: "Aarav Mehta",
  roomNumber: "1204",
  items: [{ id: "oi-s1", menuItemId: "m-1", itemName: "Paneer Tikka", unitPriceMinor: 32000, quantity: 1, note: null }],
  totalMinor: 60000,
  currency: "INR",
  placedAt: new Date(Date.now() - 86400000).toISOString(),
  status: "DELIVERED",
  review: {
    id: "rev-srv",
    rating: 4,
    orderRating: 4,
    foodRating: 3.67,
    comment: "From the server",
    createdAt: new Date().toISOString(),
  },
};

let cartState = { kitchens: [], grandTotalMinor: 0, itemCount: 0 };
const reviewBodies = [];
const addBodies = [];
let failReviews = false;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
  const dto400 = (message) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ success: false, statusCode: 400, message, error: "BAD_REQUEST" }),
    });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [SERVER_ORDER] } });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok({ ...GUEST, orders: [SERVER_ORDER] });
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart" && method === "GET") return ok(cartState);
  if (p === "/guest/cart/items" && method === "POST") {
    const body = JSON.parse(route.request().postData() || "{}");
    addBodies.push(body);
    if (!cartState.kitchens.some((k) => k.restaurantId === "kitchen-one-1")) {
      cartState = {
        kitchens: [
          {
            restaurantId: "kitchen-one-1",
            kitchenName: "Hyatt Place — Airport",
            items: [],
            subtotalMinor: 0,
          },
        ],
        itemCount: 0,
        grandTotalMinor: 0,
      };
    }
    const kitchen = cartState.kitchens[0];
    kitchen.items.push({
      menuItemId: body.menuItemId,
      name: body.menuItemId === "m-1" ? "Paneer Tikka" : "Chicken Biryani",
      unitPriceMinor: body.menuItemId === "m-1" ? 32000 : 28000,
      quantity: body.quantity ?? 1,
      lineTotalMinor: (body.menuItemId === "m-1" ? 32000 : 28000) * (body.quantity ?? 1),
      available: true,
      note: body.note ?? null,
    });
    kitchen.subtotalMinor += kitchen.items[kitchen.items.length - 1].lineTotalMinor;
    cartState.itemCount = kitchen.items.reduce((s, i) => s + i.quantity, 0);
    cartState.grandTotalMinor = kitchen.subtotalMinor;
    return ok(cartState);
  }
  // POST /guest/reviews - the single batched feedback body the form sends.
  if (p === "/guest/reviews" && method === "POST") {
    const body = JSON.parse(route.request().postData() || "{}");
    const validKeys = Object.keys(body).every((key) =>
      ["comment", "foodRating", "items", "orderId", "orderRating"].includes(key),
    );
    const validItems =
      Array.isArray(body.items) &&
      body.items.length >= 1 &&
      body.items.length <= 50 &&
      body.items.every(
        (entry) =>
          Object.keys(entry).every((key) => ["itemName", "menuItemId", "rating"].includes(key)) &&
          Number.isInteger(entry.rating) &&
          entry.rating >= 1 &&
          entry.rating <= 5,
      );
    if (!validKeys || !validItems) return dto400("invalid feedback body");
    if (failReviews) {
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "reviews unavailable" }) });
    }
    reviewBodies.push(body);
    return ok({ ok: true });
  }
  if (p.startsWith("/guest/orders/")) {
    const id = p.slice("/guest/orders/".length);
    if (id === "ord-missing") return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return ok(order(id));
  }
  if (p === "/guest/orders") return ok([]);
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

const bodyText = () => page.locator("body").innerText();

// ---- Scenario 1: per-dish ratings -> one POST /guest/reviews, then reorder
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-fb-1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
rec("form visible for real order", await page.locator('textarea[placeholder="Loved the meal..."]').isVisible());

const preSubmit = (await bodyText()).toLowerCase();
rec("form shows not-yet-rated view", !preSubmit.includes("your rating"), "");

const starBtns = page.locator('button:has(img[alt="Star"])');
const starCount = await starBtns.count();
rec("overall + 2 dish rows of stars", starCount === 15, `stars=${starCount}`);

const bottomBtn = page.locator('main button').last();
const bottomText = (await bottomBtn.innerText()).trim().toLowerCase();
rec("bottom button reads reorder", bottomText === "reorder", bottomText);

// rate both dishes (5 and 3 stars, overall left at 0) + a comment
await starBtns.nth(9).click();
await starBtns.nth(12).click();
await page.fill('textarea[placeholder="Loved the meal..."]', "Tasty!");
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });

rec("one batched POST /guest/reviews", reviewBodies.length === 1, `posts=${reviewBodies.length}`);
const r1 = reviewBodies[0] || {};
rec(
  "body keys exact",
  Object.keys(r1).sort().join(",") === "comment,foodRating,items,orderId,orderRating",
  JSON.stringify(Object.keys(r1)),
);
rec("body carries the order", r1.orderId === "ord-fb-1", String(r1.orderId));
rec(
  "derived ratings from the stars",
  r1.orderRating === 4 && r1.foodRating === 4,
  `${r1.orderRating}/${r1.foodRating}`,
);
rec("comment posted", r1.comment === "Tasty!", r1.comment);
rec(
  "items hold both dishes with their own stars",
  Array.isArray(r1.items) &&
    r1.items.length === 2 &&
    r1.items[0]?.menuItemId === "m-1" &&
    r1.items[0]?.rating === 5 &&
    r1.items[0]?.itemName === "Paneer Tikka" &&
    r1.items[1]?.menuItemId === "m-2" &&
    r1.items[1]?.rating === 3,
  JSON.stringify(r1.items),
);

// bottom button is still REORDER after submit
const postBtnText = (await page.locator('main button').last().innerText()).trim().toLowerCase();
rec("button stays reorder after submit", postBtnText === "reorder", postBtnText);

await page.locator('main button:has-text("reorder")').click();
await page.waitForURL("**/cart", { timeout: 20000 });
rec("reorder navigates to cart", page.url().includes("/cart"), page.url());
rec("reorder adds every dish", addBodies.length === 2, JSON.stringify(addBodies));
rec(
  "add payloads carry menuItemId + qty",
  addBodies[0]?.menuItemId === "m-1" && addBodies[1]?.menuItemId === "m-2" && addBodies[0]?.quantity === 1,
  JSON.stringify(addBodies),
);
const cartText = (await bodyText()).toLowerCase();
rec("cart shows reordered dish", cartText.includes("paneer tikka"), "");

// ---- Scenario 2: overall-only rating -> every dish inherits it
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-fb-2`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
const stars2 = page.locator('button:has(img[alt="Star"])');
await stars2.nth(3).click(); // overall 4 stars, no dish stars
await page.fill('textarea[placeholder="Loved the meal..."]', "Nice stay dinner");
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });

rec("second submit posts the batch", reviewBodies.length === 2, `posts=${reviewBodies.length}`);
const r2 = reviewBodies[1] || {};
rec("overall rating lands on the order", r2.orderId === "ord-fb-2" && r2.orderRating === 4 && r2.foodRating === 4, `${r2.orderRating}/${r2.foodRating}`);
rec("overall rating copied to both dishes", Array.isArray(r2.items) && r2.items.length === 2 && r2.items.every((it) => it.rating === 4), JSON.stringify(r2.items));

// ---- Scenario 3: failed POST keeps the form, retry succeeds
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-fb-3`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
const stars3 = page.locator('button:has(img[alt="Star"])');
failReviews = true;
await stars3.nth(9).click();
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForTimeout(1200);
const afterFail = (await bodyText()).toLowerCase();
rec("failed submit keeps the form", afterFail.includes("drop a feedback"), "");
rec("failed submit does not record", !afterFail.includes("your rating"), "");
rec("server error records nothing", reviewBodies.length === 2, `posts=${reviewBodies.length}`);

failReviews = false;
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });
rec("retry posts the batch", reviewBodies.length === 3, `posts=${reviewBodies.length}`);
rec("retry flips to the submitted view", (await bodyText()).toLowerCase().includes("your rating"), "");

// ---- Scenario 4: unresolved order -> no request, reorder blocked
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-missing`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
const stars4 = page.locator('button:has(img[alt="Star"])');
await stars4.nth(3).click(); // overall only
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });
rec(
  "unresolved order sends no request",
  reviewBodies.length === 3,
  `posts=${reviewBodies.length}`,
);

const urlBefore = page.url();
await page.locator('main button:has-text("reorder")').click();
await page.waitForTimeout(1000);
rec("blocked reorder stays on page", page.url() === urlBefore, page.url());
const blockedText = (await bodyText()).toLowerCase();
rec("blocked reorder shows error", blockedText.includes("couldn't find these dishes"), "");

// ---- Scenario 5: review embedded in GET /guests/me opens the read-only view
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-srv-1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 20000 });
const srvText = (await bodyText()).toLowerCase();
rec(
  "embedded review opens the submitted view with no new POST",
  reviewBodies.length === 3,
  `posts=${reviewBodies.length}`,
);
rec("submitted view shows the server comment", srvText.includes("from the server"), "");
rec("submitted view shows the order rating row", srvText.includes("order rating"), "");
rec("no form offered for an already-rated order", !srvText.includes("drop a feedback"), "");

await page.screenshot({ path: "feedback-reorder.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
