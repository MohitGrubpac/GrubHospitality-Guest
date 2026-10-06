import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

// Profile-embedded orders must be terminal so they are never adopted into the
// live tracker. Order 1 is cancelled to prove the stay lists DELIVERED only;
// the first order carries the server-side review the stay card must render.
const ME = {
  ...GUEST,
  orders: (GUEST.orders || []).map((o, index) => ({
    ...o,
    status: index === 1 ? "CANCELLED" : "DELIVERED",
    review:
      index === 0
        ? {
            id: "rev-1",
            rating: 4,
            orderRating: 4,
            foodRating: 5,
            comment: "Lovely tikka",
            createdAt: "2026-10-05T08:00:00.000Z",
          }
        : null,
  })),
};
const DELIVERED_COUNT = ME.orders.filter((o) => o.status === "DELIVERED").length;
const ORDER_1 = ME.orders[0];
const ORDER_2 = ME.orders.find((o, i) => i > 0 && (o.items || []).length > 0) || ME.orders[0];
const LINE_1 = ORDER_1?.items?.[0];
const LINE_2 = ORDER_2?.items?.[0];
if (!LINE_1 || !LINE_2) {
  console.error("fixture orders must carry at least one line item each");
  process.exit(1);
}

const NAME_BY_ID = {};
for (const order of ME.orders) {
  for (const item of order.items || []) NAME_BY_ID[item.menuItemId] = item.itemName;
}

// One kitchen whose menu contains the fixture's dish marked veg, so the stay rows
// can be checked for menu-cache enrichment of the veg/non-veg tag.
const KITCHENS = [
  {
    id: "d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc",
    name: "Hyatt Regency — Downtown",
    code: null,
    imageUrl: null,
    hotelName: null,
    type: "Italian",
    description: null,
    status: "ONLINE",
    openTime: "09:00",
    closeTime: "22:00",
    isClosed: false,
  },
];
const MENU = {
  kitchenId: KITCHENS[0].id,
  kitchenName: KITCHENS[0].name,
  categories: [
    {
      id: "cat-1",
      name: "Starters",
      items: [
        {
          id: LINE_1.menuItemId,
          name: LINE_1.itemName,
          priceMinor: 32000,
          isVeg: true,
          isOutOfStock: false,
          description: "",
          image: null,
          tags: [],
        },
      ],
    },
  ],
};

let cartState = { kitchens: [], grandTotalMinor: 0, itemCount: 0 };
const addBodies = [];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: ME });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok(ME);
  if (p === "/guest/kitchens") return ok(KITCHENS);
  const menuMatch = p.match(/^\/guest\/kitchens\/([^/]+)\/menu$/);
  if (menuMatch && menuMatch[1] === KITCHENS[0].id) return ok(MENU);
  if (p === "/guest/cart" && method === "GET") return ok(cartState);
  if (p === "/guest/cart/items" && method === "POST") {
    const body = JSON.parse(route.request().postData() || "{}");
    addBodies.push(body);
    if (cartState.kitchens.length === 0) {
      cartState = {
        kitchens: [
          { restaurantId: "kitchen-one-1", kitchenName: "Hyatt Place — Airport", items: [], subtotalMinor: 0 },
        ],
        itemCount: 0,
        grandTotalMinor: 0,
      };
    }
    const kitchen = cartState.kitchens[0];
    kitchen.items.push({
      menuItemId: body.menuItemId,
      name: NAME_BY_ID[body.menuItemId] || "Dish",
      unitPriceMinor: 32000,
      quantity: body.quantity ?? 1,
      lineTotalMinor: 32000 * (body.quantity ?? 1),
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
    const found = (ME.orders || []).find((o) => o.id === id);
    if (id === "ord-b1") return ok({ ...ORDER_2, id: "ord-b1", status: "DELIVERED" });
    if (!found) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return ok(found);
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
await page.addInitScript(() => {
  localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-b1"]));
});

// Login (multi-room fixture -> room-selection -> skip)
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
// The form is server-rendered, so the first click can land before React hydrates:
// keep filling + clicking until the OTP step actually opens.
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

// ---- Scenario 0: veg/non-veg tags on stay rows.
// The menu cache lives in the page's JS memory, so the flow must stay in one
// document: search page loads the menu, then client-side nav to the stay screen.
await page.goto(`${BASE}/home/search`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(`text=${LINE_1.itemName}`, { timeout: 20000 });
await page.locator('a[aria-label="Profile"]').click();
await page.waitForURL("**/profile", { timeout: 20000 });
await page.locator('h3:has-text("Stay Details")').click();
await page.waitForURL("**/profile/stay-details", { timeout: 20000 });
await page.waitForSelector('button:has-text("VIEW ORDERS")', { timeout: 20000 });
await page.locator('button:has-text("VIEW ORDERS")').click();
await page.waitForSelector('button:has-text("order again")', { timeout: 20000 });

const badgeCount = await page.locator('main img[alt="Veg"], main img[alt="Non-Veg"]').count();
rec(
  "stay rows always show a veg/non-veg tag",
  badgeCount === DELIVERED_COUNT,
  `badges=${badgeCount} expected=${DELIVERED_COUNT}`,
);
const vegBadgeCount = await page.locator('main img[alt="Veg"]').count();
rec(
  "menu-cache enrichment marks the fixture dish veg",
  vegBadgeCount === DELIVERED_COUNT,
  `veg=${vegBadgeCount} expected=${DELIVERED_COUNT}`,
);
const datesText = (await page.locator("main").innerText()).toLowerCase();
rec(
  "stay header repeats the month: '1 October - 4 October 2026'",
  datesText.includes("1 october - 4 october 2026"),
  "",
);

// ---- Scenario 1: stay-details "order again" adds the same lines and opens /cart
// (the stay screen is already open and expanded from scenario 0)
await page.waitForSelector('button:has-text("order again")', { timeout: 20000 });

const againCount = await page.locator('button:has-text("order again")').count();
rec(
  "stay lists delivered orders only",
  againCount === DELIVERED_COUNT,
  `count=${againCount} delivered=${DELIVERED_COUNT}`,
);

const stayText = (await page.locator("main").innerText()).toLowerCase();
rec(
  "embedded itemName renders on the order card",
  stayText.includes(String(LINE_1.itemName).toLowerCase()),
  LINE_1.itemName,
);
rec("cancelled order stays hidden", !stayText.includes("cancelled"), "");

// Ratings + label now come from the server review, not localStorage.
const viewCount = await page.locator('button:has-text("view feedback")').count();
const shareCount = await page.locator('button:has-text("share feedback")').count();
rec(
  "rated order offers view feedback, the rest share feedback",
  viewCount === 1 && shareCount === DELIVERED_COUNT - 1,
  `view=${viewCount} share=${shareCount}`,
);
const filledStars = await page
  .locator('img[src*="star_filled"][alt="Star 4"], img[src*="star_filled"][alt="Star 5"]')
  .count();
rec("server order + food ratings render as filled stars", filledStars >= 3, `filled=${filledStars}`);

await page.locator('button:has-text("order again")').first().click();
await page.waitForURL("**/cart", { timeout: 20000 });
rec("order again navigates to the cart", page.url().includes("/cart"), page.url());

const stayAdd = addBodies[0];
rec(
  "posts the first order's menuItemId with its quantity",
  Boolean(stayAdd) && stayAdd.menuItemId === LINE_1.menuItemId && stayAdd.quantity === LINE_1.quantity,
  JSON.stringify(stayAdd),
);

const cartText = (await page.locator("body").innerText()).toLowerCase();
rec("cart shows the reordered dish", cartText.includes(String(LINE_1.itemName).toLowerCase()), LINE_1.itemName);

// ---- Scenario 2: finished order on /order-status - "Order Again" same behaviour
await page.goto(`${BASE}/order-status`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Order Delivered!", { timeout: 20000 });

const statusText = (await page.locator("body").innerText()).toLowerCase();
rec(
  "finished order offers Order Again, not Back to Kitchens",
  statusText.includes("order again") && !statusText.includes("back to kitchens"),
  "",
);

await page.locator('button:has-text("Order Again")').click();
await page.waitForURL("**/cart", { timeout: 20000 });
rec("order-status Order Again navigates to the cart", page.url().includes("/cart"), page.url());

const statusAdd = addBodies[1];
rec(
  "posts the tracked order's menuItemId with its quantity",
  Boolean(statusAdd) && statusAdd.menuItemId === LINE_2.menuItemId && statusAdd.quantity === LINE_2.quantity,
  JSON.stringify(statusAdd),
);

const cartText2 = (await page.locator("body").innerText()).toLowerCase();
rec("cart shows the second reordered dish", cartText2.includes(String(LINE_2.itemName).toLowerCase()), LINE_2.itemName);

// ---- Scenario 3: server review drives the read-only feedback view
await page.goto(`${BASE}/profile/stay-details`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('button:has-text("VIEW ORDERS")', { timeout: 20000 });
await page.locator('button:has-text("VIEW ORDERS")').click();
await page.locator('button:has-text("view feedback")').first().click();
await page.waitForURL(/\/profile\/rating-feedback\?orderId=/, { timeout: 20000 });
await page.waitForSelector('h3:has-text("Your Rating")', { timeout: 20000 });
const reviewText = (await page.locator("body").innerText()).toLowerCase();
rec("view feedback opens the read-only rating view", reviewText.includes("your rating"), "");
rec("read-only view shows the server comment", reviewText.includes("lovely tikka"), "");

await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
