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

let cartState = { kitchens: [], grandTotalMinor: 0, itemCount: 0 };
const arrayAttempts = [];
const arrayBodies = [];
const feedbackBodies = [];
const addBodies = [];
let acceptsArray = false;
let failFeedback = false;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [] } });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok({ ...GUEST, orders: [] });
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/feedback" && method === "POST") {
    const body = JSON.parse(route.request().postData() || "{}");
    const dto400 = (message) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, statusCode: 400, message, error: "BAD_REQUEST" }),
      });

    if (Array.isArray(body.items)) {
      arrayAttempts.push(body);
      const validBatch =
        Object.keys(body).every((key) => ["guestName", "items", "orderId", "restaurantId"].includes(key)) &&
        body.items.length >= 1 &&
        body.items.length <= 50 &&
        body.items.every(
          (entry) =>
            Object.keys(entry).every((key) => ["menuItemId", "rating", "review"].includes(key)) &&
            Number.isInteger(entry.rating) &&
            entry.rating >= 1 &&
            entry.rating <= 5,
        );
      if (!validBatch) return dto400("items should be an array, rating must be an integer number");
      // The live deployment currently validates the flat DTO instead.
      if (!acceptsArray) {
        return dto400("property items should not exist, rating must not be greater than 5, rating must not be less than 1, rating must be an integer number");
      }
      if (failFeedback) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "feedback unavailable" }) });
      arrayBodies.push(body);
      return ok({ ok: true });
    }

    const validFlat =
      Object.keys(body).every((key) =>
        ["guestName", "menuItemId", "orderId", "rating", "restaurantId", "review"].includes(key),
      ) &&
      Number.isInteger(body.rating) &&
      body.rating >= 1 &&
      body.rating <= 5;
    if (!validFlat) return dto400("property items should not exist, rating must be an integer number");
    if (failFeedback) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "feedback unavailable" }) });
    feedbackBodies.push(body);
    return ok({ ok: true });
  }
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
  if (p.startsWith("/guest/orders/")) {
    const id = p.slice("/guest/orders/".length);
    if (id === "ord-missing") return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return ok(order(id));
  }
  if (p === "/guest/orders") return ok([order("ord-fb-1")]);
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

// ---- Scenario 1: per-dish POST to /feedback, then reorder
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-fb-1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
rec("form visible for real order", await page.locator('textarea[placeholder="Loved the meal..."]').isVisible());

const bodyText = () => page.locator("body").innerText();
const preSubmit = (await bodyText()).toLowerCase();
rec("form shows not-yet-rated view", !preSubmit.includes("your rating"), "");

const starBtns = page.locator('button:has(img[alt="Star"])');
const starCount = await starBtns.count();
rec("overall + 2 dish rows of stars", starCount === 15, `stars=${starCount}`);

const bottomBtn = page.locator('main button').last();
const bottomText = (await bottomBtn.innerText()).trim().toLowerCase();
rec("bottom button reads reorder", bottomText === "reorder", bottomText);

// rate both dishes (5 and 3 stars, overall left at 0) -> batch array first;
// the mock deployment rejects it, so the flat per-dish fallback must land.
await starBtns.nth(9).click();
await starBtns.nth(12).click();
await page.fill('textarea[placeholder="Loved the meal..."]', "Tasty!");
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });

rec("batch array sent first", arrayAttempts.length === 1, `attempts=${arrayAttempts.length}`);
const a1 = arrayAttempts[0] || {};
rec(
  "array body keys exact",
  Object.keys(a1).sort().join(",") === "guestName,items,orderId,restaurantId",
  JSON.stringify(Object.keys(a1)),
);
rec("array carries order + restaurant", a1.orderId === "ord-fb-1" && a1.restaurantId === "kitchen-one-1", `${a1.orderId}/${a1.restaurantId}`);
rec("array carries guest", a1.guestName === "Aarav Mehta", String(a1.guestName));
rec("array items holds both dishes", Array.isArray(a1.items) && a1.items.length === 2, JSON.stringify(a1.items));
const itemKeysOk = (a1.items || []).every(
  (it) => Object.keys(it).sort().join(",") === "menuItemId,rating,review",
);
rec("array item keys exact", itemKeysOk, JSON.stringify((a1.items || []).map((it) => Object.keys(it))));
rec(
  "array ratings match the stars",
  a1.items?.[0]?.menuItemId === "m-1" &&
    a1.items?.[0]?.rating === 5 &&
    a1.items?.[1]?.menuItemId === "m-2" &&
    a1.items?.[1]?.rating === 3,
  JSON.stringify(a1.items),
);
rec("shared review in array", (a1.items || []).every((it) => it.review === "Tasty!"), JSON.stringify((a1.items || []).map((it) => it.review)));
rec("rejected array falls back to flat", feedbackBodies.length === 2, `flat=${feedbackBodies.length}`);
const f1 = feedbackBodies[0] || {};
const f2 = feedbackBodies[1] || {};
rec(
  "fallback body keys exact",
  Object.keys(f1).sort().join(",") === "guestName,menuItemId,orderId,rating,restaurantId,review",
  JSON.stringify(Object.keys(f1)),
);
rec("fallback covers both dishes", f1.menuItemId === "m-1" && f1.rating === 5 && f2.menuItemId === "m-2" && f2.rating === 3, `${f1.menuItemId}/${f1.rating} + ${f2.menuItemId}/${f2.rating}`);
rec("fallback keeps guest + review", f1.guestName === "Aarav Mehta" && f1.review === "Tasty!", `${f1.guestName}/${f1.review}`);

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

// ---- Scenario 2: overall-only -> single-entry array, this deployment accepts it
acceptsArray = true;
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-fb-2`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
const stars2 = page.locator('button:has(img[alt="Star"])');
await stars2.nth(3).click(); // overall 4 stars, no dish stars
await page.fill('textarea[placeholder="Loved the meal..."]', "Nice stay dinner");
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });

rec("overall submits as array batch", arrayAttempts.length === 2 && arrayBodies.length === 1, `attempts=${arrayAttempts.length} accepted=${arrayBodies.length}`);
const a2 = arrayBodies[0] || {};
rec(
  "overall array keys exact",
  Object.keys(a2).sort().join(",") === "guestName,items,orderId,restaurantId",
  JSON.stringify(Object.keys(a2)),
);
rec("overall array is single item", Array.isArray(a2.items) && a2.items.length === 1, JSON.stringify(a2.items));
rec("overall uses first dish id", a2.items?.[0]?.menuItemId === "m-1", String(a2.items?.[0]?.menuItemId));
rec("overall uses overall rating", a2.items?.[0]?.rating === 4, String(a2.items?.[0]?.rating));
rec("accepted array skips flat calls", feedbackBodies.length === 2, `flat=${feedbackBodies.length}`);

// ---- Scenario 3: failed POST keeps the form, retry succeeds
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-fb-3`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
const stars3 = page.locator('button:has(img[alt="Star"])');
failFeedback = true;
await stars3.nth(9).click();
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForTimeout(1200);
const afterFail = (await bodyText()).toLowerCase();
rec("failed submit keeps the form", afterFail.includes("drop a feedback"), "");
rec("failed submit does not record", !afterFail.includes("your rating"), "");
rec("failed attempt still went as array", arrayAttempts.length === 3, `attempts=${arrayAttempts.length}`);
rec("server error does not trigger flat fallback", feedbackBodies.length === 2, `flat=${feedbackBodies.length}`);

failFeedback = false;
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });
rec("retry posts the array", arrayAttempts.length === 4 && arrayBodies.length === 2, `attempts=${arrayAttempts.length} accepted=${arrayBodies.length}`);
rec("retry records locally", (await page.locator("body").innerText()).toLowerCase().includes("your rating"), "");

// ---- Scenario 4: unresolved order -> local-only, reorder blocked
await page.goto(`${BASE}/profile/rating-feedback?orderId=ord-missing`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea[placeholder="Loved the meal..."]', { timeout: 20000 });
const stars4 = page.locator('button:has(img[alt="Star"])');
await stars4.nth(3).click(); // overall only
await page.locator('button[aria-label="Submit feedback"]').click();
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 15000 });
rec(
  "unresolved order sends no request",
  arrayAttempts.length === 4 && feedbackBodies.length === 2,
  `attempts=${arrayAttempts.length} flat=${feedbackBodies.length}`,
);
rec("fallback order still records locally", true, "");

const urlBefore = page.url();
await page.locator('main button:has-text("reorder")').click();
await page.waitForTimeout(1000);
rec("blocked reorder stays on page", page.url() === urlBefore, page.url());
const blockedText = (await bodyText()).toLowerCase();
rec("blocked reorder shows error", blockedText.includes("couldn't find these dishes"), "");

await page.screenshot({ path: "feedback-reorder.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
