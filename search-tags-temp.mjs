import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const ICON = {
  spicy: "https://grubpac-kitchen.s3.ap-south-1.amazonaws.com/858db12f-2310-45f0-8fe5-fc1403a20580/c3efa008-3c3e-4c96-bc5b-9fcef33488da/tag-icons/2026/09/23/25678620-e3fe-4a9a-875f-cd677b8c8fd0.png",
  healthy: "https://grubpac-kitchen.s3.ap-south-1.amazonaws.com/858db12f-2310-45f0-8fe5-fc1403a20580/c3efa008-3c3e-4c96-bc5b-9fcef33488da/tag-icons/2026/09/23/df9f88c0-3ae1-4a04-a47e-5a9a3acb1703.png",
  nonVeg: "https://grubpac-kitchen.s3.ap-south-1.amazonaws.com/858db12f-2310-45f0-8fe5-fc1403a20580/c3efa008-3c3e-4c96-bc5b-9fcef33488da/tag-icons/2026/09/23/dad55af2-105c-4914-aa0f-a5d483b19ae3.png",
  vegan: "https://grubpac-kitchen.s3.ap-south-1.amazonaws.com/858db12f-2310-45f0-8fe5-fc1403a20580/c3efa008-3c3e-4c96-bc5b-9fcef33488da/tag-icons/2026/09/23/3e75d2b9-68bd-4248-bb1f-071489ae8694.png",
};

const KITCHENS = [
  { id: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7", name: "Hyatt Place — Airport", code: null, imageUrl: null, hotelName: null, type: "American", description: "Good Restra", status: "ONLINE", openTime: "09:00", closeTime: "22:00", isClosed: false },
  { id: "d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc", name: "Hyatt Regency — Downtown", code: null, imageUrl: null, hotelName: null, type: "Italian", description: null, status: "ONLINE", openTime: "09:00", closeTime: "22:00", isClosed: false },
];

const MENUS = {
  "d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc": {
    kitchenId: "d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc",
    kitchenName: "Hyatt Regency — Downtown",
    categories: [
      {
        id: "cat-1", name: "Starters",
        items: [
          { id: "m-1", name: "Chicken 65", priceMinor: 36000, isVeg: false, isOutOfStock: false, description: "Crispy fried chicken tossed in curry leaves", image: null, tags: [{ name: "Spicy", icon: ICON.spicy }], rating: 5 },
          { id: "m-2", name: "Chicken Tikka", priceMinor: 34900, isVeg: false, isOutOfStock: false, description: "Tender chicken pieces marinated in yogurt and spices", image: null, tags: [{ name: "Healthy", icon: ICON.healthy }, { name: "Non-Vegetarian", icon: ICON.nonVeg }, { name: "Spicy", icon: ICON.spicy }], rating: 3 },
          { id: "m-3", name: "Crispy Corn", priceMinor: 28000, isVeg: true, isOutOfStock: false, description: "Golden-fried corn kernels with pepper", image: null, tags: [] },
        ],
      },
      {
        id: "cat-2", name: "Desserts",
        items: [
          { id: "m-4", name: "Vegan Chocolate Mousse", priceMinor: 22000, isVeg: true, isOutOfStock: false, description: "Silky dark-chocolate mousse, dairy-free", image: null, tags: [{ name: "Vegan", icon: ICON.vegan }] },
          { id: "m-7", name: "Hyderabadi Mutton Biryani", priceMinor: 52000, isVeg: false, isOutOfStock: false, description: "Long-grain basmati layered with spiced mutton", image: null, tags: [{ name: "Spicy", icon: ICON.spicy }], rating: 4 },
        ],
      },
    ],
  },
  "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7": {
    kitchenId: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7",
    kitchenName: "Hyatt Place — Airport",
    categories: [
      {
        id: "cat-3", name: "Starters",
        items: [
          { id: "m-5", name: "Paneer Tikka", priceMinor: 32000, isVeg: true, isOutOfStock: false, description: "Chargrilled cottage cheese with spices", image: null, tags: [] },
          { id: "m-6", name: "Butter Chicken", priceMinor: 48000, isVeg: false, isOutOfStock: false, description: "Tandoori chicken in a rich tomato gravy", image: null, tags: [{ name: "Non-Vegetarian", icon: ICON.nonVeg }], rating: 4 },
          { id: "m-8", name: "Chicken Dum Biryani", priceMinor: 42000, isVeg: false, isOutOfStock: false, description: "Sealed-pot chicken biryani with fried onions", image: null, tags: [], rating: null },
        ],
      },
    ],
  },
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [] } });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok({ ...GUEST, orders: [] });
  if (p === "/guest/kitchens") return ok(KITCHENS);
  const menuMatch = p.match(/^\/guest\/kitchens\/([^/]+)\/menu$/);
  if (menuMatch && MENUS[menuMatch[1]]) return ok(MENUS[menuMatch[1]]);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    sessionStorage.setItem("harness-cleared", "1");
  }
});

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

await page.goto(`${BASE}/home/search`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Chicken 65", { timeout: 20000 });
await page.waitForTimeout(800);

const text = await page.locator("body").innerText();
const lc = text.toLowerCase();
rec("dishes tab renders", lc.includes("chicken 65") && lc.includes("vegan chocolate mousse"));
rec("dish card renders tag icons with accessible names", (await page.locator('img[alt="Spicy"]').count()) >= 2 && (await page.locator('img[alt="Non-Vegetarian"]').count()) >= 1 && (await page.locator('img[alt="Vegan"]').count()) >= 1);
rec("dish cards embed tag icon images", (await page.locator('img[src*="tag-icons"]').count()) >= 3);
rec("dish cards show star rating icons", (await page.locator('img[src*="star.svg"], img[src*="star%2Esvg"], img[src*="star"]').count()) >= 3);
rec("rating number rendered next to star", (await page.locator('img[alt="Rating"]').count()) >= 3);
rec("no '[object Object]' leaked into card text", !text.includes("[object Object]"));
rec("tagless dish renders without chips", lc.includes("crispy corn"));

await page.locator("button:has-text('Restaurant')").click();
await page.waitForSelector("text=Hyatt Regency", { timeout: 20000 });
await page.waitForTimeout(500);
rec("restaurant tab group shows compact tag icons", (await page.locator('img[alt="Spicy"]').count()) >= 1 && (await page.locator('img[alt="Healthy"]').count()) >= 1);
rec("restaurant tab chips have icon images", (await page.locator('img[src*="tag-icons"]').count()) >= 3);

const searchInput = 'input[placeholder="Search dish or kitchen"]';

// Dish-name query on restaurant tab: kitchen names do not contain "biryani"
await page.locator(searchInput).fill("biryani");
await page.waitForTimeout(600);
const biryaniLc = (await page.locator("body").innerText()).toLowerCase();
rec("restaurant tab groups kitchens by dish match", biryaniLc.includes("hyatt place") && biryaniLc.includes("hyatt regency"));
rec("restaurant tab shows matching biryani dishes", biryaniLc.includes("hyderabadi mutton biryani") && biryaniLc.includes("chicken dum biryani"));
rec("restaurant tab hides empty-state for dish matches", !biryaniLc.includes("no kitchens found"));

const addGeom = await page
  .locator('button[aria-label="Add to cart"]')
  .first()
  .evaluate((el) => {
    const r = el.getBoundingClientRect();
    const p = el.parentElement.getBoundingClientRect();
    return { gapRight: p.right - r.right, w: r.width, pw: p.width };
  });
rec("group card add button sits right, not full width", addGeom.gapRight < 6 && addGeom.w < addGeom.pw - 60);

// Rated 3+ quick filter on dishes tab
await page.locator(searchInput).fill("");
await page.locator("button:has-text('Dishes')").click();
await page.waitForSelector("text=Crispy Corn", { timeout: 20000 });
await page.locator("button:has-text('rated 3+')").click();
await page.waitForTimeout(400);
const ratedLc = (await page.locator("body").innerText()).toLowerCase();
rec("rated 3+ keeps dishes rated >= 3", ratedLc.includes("chicken 65") && ratedLc.includes("chicken tikka") && ratedLc.includes("hyderabadi mutton biryani") && ratedLc.includes("butter chicken"));
rec("rated 3+ hides unrated dishes", !ratedLc.includes("crispy corn") && !ratedLc.includes("paneer tikka") && !ratedLc.includes("chicken dum biryani") && !ratedLc.includes("vegan chocolate mousse"));
const ratedChipCls = (await page.locator("button:has-text('rated 3+')").getAttribute("class")) || "";
rec("rated 3+ chip shows active styling", ratedChipCls.includes("#fe480b"));
await page.locator("button:has-text('rated 3+')").click();
await page.waitForTimeout(400);
rec("rated 3+ toggles off restores unrated dishes", (await page.locator("body").innerText()).toLowerCase().includes("crispy corn"));

await page.locator("text=Chicken 65").first().scrollIntoViewIfNeeded();
await page.screenshot({ path: "search-tags.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
