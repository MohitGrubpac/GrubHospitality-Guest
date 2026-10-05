import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const KITCHENS = [
  {
    id: "kitchen-one-1",
    name: "Tandoor Treat",
    hotelName: "Hyatt Place — Airport",
    type: "North Indian",
    description: "Clay-oven classics and grills",
    status: "ONLINE",
    openTime: "07:00",
    closeTime: "23:00",
    imageUrl: "/food-items/restaurant.jpg",
  },
];

const MENU = {
  kitchenId: "kitchen-one-1",
  kitchenName: "Tandoor Treat",
  hotelName: "Hyatt Place — Airport",
  imageUrl: "/food-items/restaurant.jpg",
  categories: [
    {
      id: "cat-starters",
      name: "Starters",
      description: "From the tandoor",
      items: [
        {
          id: "m-1",
          name: "Paneer Tikka",
          description: "Grilled cottage cheese with spices",
          priceMinor: 32000,
          rating: 4.4,
          isVeg: true,
          isOutOfStock: false,
          image: null,
          tags: ["Chef's Special", "Spicy"],
        },
        {
          id: "m-2",
          name: "Chicken Biryani",
          description: "Fragrant basmati rice with chicken",
          priceMinor: 28000,
          rating: 4.2,
          isVeg: false,
          isOutOfStock: false,
          image: null,
          tags: ["Biryani"],
        },
        {
          id: "m-3",
          name: "Steamed Rice",
          description: "Plain steamed basmati rice",
          priceMinor: 12000,
          rating: null,
          isVeg: true,
          isOutOfStock: false,
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
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [] } });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok({ ...GUEST, orders: [] });
  if (p === "/guest/kitchens" && method === "GET") return ok(KITCHENS);
  if (p === "/guest/kitchens/kitchen-one-1/menu") return ok(MENU);
  if (p === "/guest/cart" && method === "GET") return ok(cartState);
  if (p === "/guest/cart/items" && method === "POST") {
    const body = JSON.parse(route.request().postData() || "{}");
    addBodies.push(body);
    const meta = MENU.categories[0].items.find((it) => it.id === body.menuItemId);
    cartState = {
      kitchens: [
        {
          restaurantId: "kitchen-one-1",
          kitchenName: "Tandoor Treat",
          items: [
            {
              menuItemId: body.menuItemId,
              name: meta?.name || body.menuItemId,
              unitPriceMinor: meta?.priceMinor || 0,
              quantity: body.quantity ?? 1,
              lineTotalMinor: (meta?.priceMinor || 0) * (body.quantity ?? 1),
              available: true,
              note: body.note ?? null,
            },
          ],
          subtotalMinor: (meta?.priceMinor || 0) * (body.quantity ?? 1),
        },
      ],
      itemCount: body.quantity ?? 1,
      grandTotalMinor: (meta?.priceMinor || 0) * (body.quantity ?? 1),
    };
    return ok(cartState);
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

// ---- Open the modal from the first dish card
await page.goto(`${BASE}/kitchen/kitchen-one-1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('h3:has-text("Paneer Tikka")', { timeout: 20000 });

const modal = page.locator("div.fixed.inset-0.z-50");
await page.locator('h3:has-text("Paneer Tikka")').click();
await modal.waitFor({ state: "visible", timeout: 10000 });
rec("modal opens from dish card", await modal.isVisible());

const h2 = modal.locator("h2");
rec("title row shows dish name", (await h2.innerText()).includes("Paneer Tikka"), await h2.innerText());
const h2Imgs = await h2.locator("img").count();
rec("title row has no icons", h2Imgs === 0, `imgs=${h2Imgs}`);

const ratingImgs = modal.locator('img[alt="Rating"]');
const ratingCount = await ratingImgs.count();
rec("one rating star in modal", ratingCount === 1, `count=${ratingCount}`);

const metaRow = modal.locator("div.flex.items-center.justify-between").first();
const metaText = await metaRow.innerText();
rec("meta row carries price", metaText.includes("₹320"), metaText.replace(/\n/g, " | "));
rec("meta row carries rating value", metaText.includes("4.4"), "");
const vegBox = await metaRow.locator("div.border-green-600").count();
rec("meta row carries veg indicator", vegBox >= 1, `vegBoxes=${vegBox}`);
const chipInRow = await metaRow.locator('span[title="Chef\'s Special"]').count();
rec("meta row carries tag chip", chipInRow === 1, `chips=${chipInRow}`);
const modalAdd = metaRow.locator('button[aria-label="Add to cart"]');
rec("meta row carries ADD button", (await modalAdd.count()) === 1, "");

const totalChip = await modal.locator('span[title="Chef\'s Special"]').count();
rec("no duplicate tag row below", totalChip === 1, `chips=${totalChip}`);

const desc = modal.locator("p", { hasText: "Grilled cottage cheese" });
rec("description renders below", (await desc.count()) === 1, "");
const descBox = await desc.first().boundingBox();
const rowBox = await metaRow.boundingBox();
rec("description sits below the meta row", !!descBox && !!rowBox && descBox.y > rowBox.y, `${descBox?.y} > ${rowBox?.y}`);

// ADD inside the modal updates the server cart
await modalAdd.click();
await modal.locator('button[aria-label="Increase quantity"]').waitFor({ state: "visible", timeout: 10000 });
rec("modal ADD posts to cart", addBodies.length === 1 && addBodies[0].menuItemId === "m-1", JSON.stringify(addBodies));

// Close
await modal.locator('button[aria-label="Close"]').click();
await modal.waitFor({ state: "detached", timeout: 5000 });
rec("close button dismisses modal", !(await modal.isVisible().catch(() => false)));

// ---- Item without a rating hides the star but keeps price/veg/ADD
await page.locator('h3:has-text("Steamed Rice")').click();
await modal.waitFor({ state: "visible", timeout: 10000 });
const noRating = await modal.locator('img[alt="Rating"]').count();
rec("rating-less item hides star", noRating === 0, `count=${noRating}`);
const riceRow = modal.locator("div.flex.items-center.justify-between").first();
const riceText = await riceRow.innerText();
rec("rating-less row keeps price", riceText.includes("₹120"), riceText.replace(/\n/g, " | "));
rec(
  "rating-less row keeps ADD",
  (await riceRow.locator('button[aria-label="Add to cart"]').count()) === 1,
  "",
);
await modal.locator('button[aria-label="Close"]').click();
await modal.waitFor({ state: "detached", timeout: 5000 });

// ---- Non-veg dish shows the red indicator in the modal meta row
await page.locator('h3:has-text("Chicken Biryani")').click();
await modal.waitFor({ state: "visible", timeout: 10000 });
const redBox = await modal
  .locator("div.flex.items-center.justify-between")
  .first()
  .locator("div.border-red-600")
  .count();
rec("non-veg shows red indicator", redBox >= 1, `redBoxes=${redBox}`);
const biryaniText = await modal.locator("div.flex.items-center.justify-between").first().innerText();
rec("non-veg meta row keeps rating", biryaniText.includes("4.2"), biryaniText.replace(/\n/g, " | "));

await page.screenshot({ path: "menu-detail.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
