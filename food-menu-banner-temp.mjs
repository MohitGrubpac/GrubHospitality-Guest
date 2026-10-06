import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const KITCHENS = [
  { id: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7", name: "Hyatt Place — Airport", code: null, imageUrl: null, hotelName: null, type: "American", description: "Made without meat, fish, or seafood, using only vegetarian ingredients.", status: "ONLINE", openTime: "09:00", closeTime: "22:00", isClosed: false },
  { id: "d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc", name: "Hyatt Regency — Downtown", code: null, imageUrl: null, hotelName: null, type: "Italian", description: null, status: "ONLINE", openTime: "09:00", closeTime: "22:00", isClosed: false },
];

const ICON = {
  spicy: "https://grubpac-kitchen.s3.ap-south-1.amazonaws.com/858db12f-2310-45f0-8fe5-fc1403a20580/c3efa008-3c3e-4c96-bc5b-9fcef33488da/tag-icons/2026/09/23/25678620-e3fe-4a9a-875f-cd677b8c8fd0.png",
  healthy: "https://grubpac-kitchen.s3.ap-south-1.amazonaws.com/858db12f-2310-45f0-8fe5-fc1403a20580/c3efa008-3c3e-4c96-bc5b-9fcef33488da/tag-icons/2026/09/23/df9f88c0-3ae1-4a04-a47e-5a9a3acb1703.png",
};

const MENUS = {
  "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7": {
    kitchenId: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7",
    kitchenName: "Hyatt Place — Airport",
    hotelName: null,
    imageUrl: null,
    categories: [
      { id: "cat-1", name: "Starters", description: "Small plates to begin the meal", items: [
        { id: "m-1", name: "Chicken 65", priceMinor: 36000, isVeg: false, isOutOfStock: false, description: "Crispy fried chicken tossed in curry leaves", image: null, tags: [{ name: "Spicy", icon: ICON.spicy }], rating: 5 },
        { id: "m-9", name: "Crispy Corn", priceMinor: 28000, isVeg: true, isOutOfStock: false, description: "Golden-fried corn kernels with pepper", image: null, tags: [], rating: null },
        { id: "m-10", name: "Vegetable Spring Rolls", priceMinor: 19900, isVeg: true, isOutOfStock: false, description: "Crispy rolls filled with seasoned vegetables", image: null, tags: [{ name: "Healthy", icon: ICON.healthy }, { name: "Eggless", icon: ICON.spicy }], rating: 3.5 },
      ] },
      { id: "cat-2", name: "Main Course", description: "Hearty mains served with bread or rice", items: [
        { id: "m-2", name: "Butter Chicken", priceMinor: 48000, isVeg: false, isOutOfStock: false, description: "Tandoori chicken in a rich tomato gravy", image: null, tags: [], rating: 4 },
      ] },
    ],
  },
  "d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc": {
    kitchenId: "d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc",
    kitchenName: "Hyatt Regency — Downtown",
    hotelName: null,
    imageUrl: null,
    categories: [
      { id: "cat-3", name: "Pasta", description: null, items: [
        { id: "m-3", name: "Pasta Carbonara", priceMinor: 38000, isVeg: false, isOutOfStock: false, description: "Creamy roman classic", image: null, tags: [{ name: "Healthy", icon: ICON.healthy }], rating: 4 },
      ] },
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

// ---- Kitchen 1: type + description + hours
await page.goto(`${BASE}/kitchen/56344e3b-0241-4cf2-96ca-1e85c0b9dbd7`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h2:has-text('Hyatt Place')", { timeout: 20000 });
await page.waitForSelector("text=09:00 - 22:00", { timeout: 20000 });

let text = await page.locator("main").innerText();
let lc = text.toLowerCase();
rec("banner shows kitchen name", lc.includes("hyatt place"));
rec("banner shows kitchen type (uppercase)", lc.includes("american"));
rec("banner shows open-close hours", lc.includes("09:00 - 22:00"));
rec("banner shows description", lc.includes("made without meat, fish, or seafood"));
rec("open-now badge still on image", lc.includes("open now"));

const pillKey = await page.evaluate(() => {
  const img = document.querySelector('img[alt="Key"]');
  if (!img) return null;
  const pill = img.parentElement;
  const textSpan = pill.querySelector("span");
  if (!textSpan) return null;
  const k = img.getBoundingClientRect();
  const t = textSpan.getBoundingClientRect();
  return {
    inPill: pill.textContent.includes("Open Now"),
    afterText: k.left > t.right,
    visible: k.width > 0,
  };
});
rec("open-now pill shows key icon after text", Boolean(pillKey) && pillKey.inPill && pillKey.afterText && pillKey.visible, JSON.stringify(pillKey));

const italic = await page.evaluate(() => {
  const p = [...document.querySelectorAll("p")].find((el) => el.textContent.includes("Made without meat"));
  return p ? getComputedStyle(p).fontStyle : null;
});
rec("description renders italic", italic === "italic", `fontStyle=${italic}`);

// ---- Menu item cards: star rating + tag icons
const cardMeta = async (name) =>
  page.evaluate((itemName) => {
    const h3 = [...document.querySelectorAll("h3")].find((el) => el.textContent.trim() === itemName);
    if (!h3) return null;
    const card = h3.closest("div.cursor-pointer") || h3.parentElement.parentElement;
    const star = card.querySelector('img[alt="Rating"]');
    const tagImgs = [...card.querySelectorAll('img[src*="tag-icons"]')];
    const texts = (card.innerText || "").split("\n").map((t) => t.trim()).filter(Boolean);
    return {
      hasStar: Boolean(star),
      starWidth: star ? Math.round(star.getBoundingClientRect().width) : 0,
      ratingText: star && star.parentElement ? star.parentElement.textContent.trim() : null,
      tagIconCount: tagImgs.length,
      tagAlts: tagImgs.map((img) => img.alt),
      leakNull: texts.some((t) => t === "null" || t.toLowerCase().includes("null")),
    };
  }, name);

const rated = await cardMeta("Chicken 65");
rec("rated card shows star icon", Boolean(rated) && rated.hasStar && rated.starWidth >= 16, JSON.stringify(rated));
rec("rated card shows rating value", Boolean(rated) && rated.ratingText === "5", `ratingText=${rated?.ratingText}`);
rec("rated card shows tag icon image", Boolean(rated) && rated.tagIconCount >= 1 && rated.tagAlts.includes("Spicy"), JSON.stringify(rated?.tagAlts));

const plain = await cardMeta("Crispy Corn");
rec("null-rating card hides star", Boolean(plain) && !plain.hasStar && !plain.leakNull, JSON.stringify(plain));

const half = await cardMeta("Vegetable Spring Rolls");
rec("decimal rating renders", Boolean(half) && half.hasStar && half.ratingText === "3.5", `ratingText=${half?.ratingText}`);
rec("multi-tag card shows all tag icons", Boolean(half) && half.tagIconCount === 2, JSON.stringify(half?.tagAlts));

// ---- Category banner: API description renders over the banner image
const banner = await page.evaluate(() => {
  const p = [...document.querySelectorAll("p")].find((el) =>
    el.textContent.includes("Small plates to begin the meal"),
  );
  if (!p) return null;
  const rect = p.getBoundingClientRect();
  const style = getComputedStyle(p);
  const bannerBox = p.parentElement;
  const img = bannerBox ? bannerBox.querySelector("img") : null;
  return {
    visible: rect.width > 0 && rect.height > 0,
    color: style.color,
    hasImage: Boolean(img),
    insideBanner: Boolean(img) && bannerBox.contains(img),
    text: p.textContent.trim(),
  };
});
rec(
  "category banner shows API description",
  Boolean(banner) && banner.visible && banner.text === "Small plates to begin the meal",
  JSON.stringify(banner),
);
rec("category description sits over banner image", Boolean(banner) && banner.hasImage && banner.insideBanner, JSON.stringify(banner));

// Hardcoded bike/clock icons must be gone from menu cards (star/tags are <img>)
const leftoverIcons = await page.evaluate(() => {
  const h3 = [...document.querySelectorAll("h3")].find((el) => el.textContent.trim() === "Chicken 65");
  const card = h3 ? h3.closest("div.cursor-pointer") : null;
  if (!card) return -1;
  return card.querySelectorAll("svg").length;
});
rec("no hardcoded bike/clock icons in card", leftoverIcons === 0, `count=${leftoverIcons}`);

// ---- Floating MENU button: single instance, bottom-right, popup opens upward
const menuBtnBefore = await page.locator('button:has-text("MENU")').count();
rec("single MENU button on page", menuBtnBefore === 1, `count=${menuBtnBefore}`);

const btnPos = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "MENU");
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return {
    right: Math.round(window.innerWidth - r.right),
    bottom: Math.round(window.innerHeight - r.bottom),
    inLowerHalf: r.top > window.innerHeight / 2,
    inRightHalf: r.left > window.innerWidth / 2,
  };
});
rec(
  "MENU button pinned bottom-right",
  Boolean(btnPos) && btnPos.inLowerHalf && btnPos.inRightHalf && btnPos.right <= 32,
  JSON.stringify(btnPos),
);

await page.locator('button:has-text("MENU")').click();
await page.waitForSelector("text=Main Course", { timeout: 5000 });

const popupPos = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "MENU");
  const popup = [...document.querySelectorAll("div")].find((d) => d.textContent.includes("Main Course") && d.className.includes("w-[280px]"));
  if (!btn || !popup) return null;
  const b = btn.getBoundingClientRect();
  const p = popup.getBoundingClientRect();
  return {
    opensUp: p.bottom <= b.top + 1,
    sameRightEdge: Math.abs(p.right - b.right) < 2,
    visible: p.width > 0 && p.height > 0,
  };
});
rec("MENU popup opens above the button", Boolean(popupPos) && popupPos.opensUp && popupPos.visible, JSON.stringify(popupPos));
rec("popup right-aligned with button", Boolean(popupPos) && popupPos.sameRightEdge, JSON.stringify(popupPos));

// Category jump still works from the floating menu (popup is still open above)
await page.locator("button", { hasText: /^Main Course/ }).last().click();
await page.waitForTimeout(600);
const jumped = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((el) => el.textContent.trim() === "Main Course");
  if (!h2) return false;
  const r = h2.getBoundingClientRect();
  return r.top >= -10 && r.top < window.innerHeight;
});
rec("selecting category scrolls to it", jumped, `jumped=${jumped}`);

const layout = await page.evaluate(() => {
  const typeEl = [...document.querySelectorAll("span")].find((s) => s.textContent.trim().toLowerCase() === "american");
  const timeEl = [...document.querySelectorAll("span")].find((s) => s.textContent.trim() === "09:00 - 22:00");
  if (!typeEl || !timeEl) return null;
  const t = typeEl.getBoundingClientRect();
  const m = timeEl.getBoundingClientRect();
  const row = typeEl.closest("div").parentElement.getBoundingClientRect();
  return { typeRight: Math.round(t.right), timeLeft: Math.round(m.left), timeRight: Math.round(m.right), rowRight: Math.round(row.right) };
});
rec(
  "cuisine left, hours pushed right",
  Boolean(layout) && layout.timeLeft > layout.typeRight + 20 && layout.rowRight - layout.timeRight < 24,
  JSON.stringify(layout),
);

// ---- Kitchen 2: null description must not leak, Italian + hours still render
await page.goto(`${BASE}/kitchen/d7a04a86-6e50-4bfd-84b5-df4dda1ab9cc`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h2:has-text('Hyatt Regency')", { timeout: 20000 });
await page.waitForSelector("text=09:00 - 22:00", { timeout: 20000 });

text = await page.locator("main").innerText();
lc = text.toLowerCase();
rec("null-description kitchen shows type", lc.includes("italian"));
rec("null-description kitchen shows hours", lc.includes("09:00 - 22:00"));
rec("no 'null' leaked into banner", !lc.includes("null"));

await page.screenshot({ path: "food-menu-banner.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
