import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
const VIEW_W = 412;

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const CART = {
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

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: VIEW_W, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: GUEST.orders } });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok({ ...GUEST, orders: GUEST.orders });
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart" && method === "GET") return ok(CART);
  if (p === "/guest/cart/checkout" && method === "POST") return ok([]);
  if (p === "/guest/orders") return ok(GUEST.orders);
  if (p.startsWith("/guest/orders/")) {
    const id = p.split("/").pop();
    const found = (GUEST.orders || []).find((o) => o.id === id);
    if (found) return ok(found);
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  }
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

// ---- Both bars present -> carousel mode
await page.waitForSelector("#cart-checkout-bar", { timeout: 20000 });
const panel = page.locator('button[aria-expanded][class*="justify-between"]');
await panel.waitFor({ timeout: 20000 });

const panelBox = await panel.boundingBox();
const barBox = await page.locator("#cart-checkout-bar").boundingBox();
rec("order card starts visible", !!panelBox && panelBox.x < 100, `x=${panelBox?.x?.toFixed(0)}`);
rec(
  "checkout card starts offscreen (not stacked)",
  !!barBox && barBox.x > VIEW_W / 2,
  `x=${barBox?.x?.toFixed(0)}`,
);

const dots = page.locator('button[aria-label^="Show "]');
const dotCount = await dots.count();
rec("carousel dots rendered", dotCount === 2, `dots=${dotCount}`);
const dot0Class = await dots.nth(0).getAttribute("class");
const dot1Class = await dots.nth(1).getAttribute("class");
rec("first dot active by default", dot0Class?.includes("fe480b") && !dot1Class?.includes("fe480b"), "");

const dockH = await page.evaluate(() =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-dock-h")),
);
rec("dock height holds a single card (not stacked)", dockH > 60 && dockH < 130, `h=${dockH}`);

// ---- Swipe left -> checkout slide
const cx = panelBox.x + panelBox.width / 2;
const cy = panelBox.y + panelBox.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx - 50, cy, { steps: 4 });
await page.mouse.move(cx - 120, cy, { steps: 4 });
await page.mouse.move(cx - 170, cy, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(400);

const panelBox2 = await panel.boundingBox();
const barBox2 = await page.locator("#cart-checkout-bar").boundingBox();
rec("swipe left reveals checkout card", !!barBox2 && barBox2.x < 100, `x=${barBox2?.x?.toFixed(0)}`);
rec("order card moved offscreen after swipe", !!panelBox2 && panelBox2.x < -50, `x=${panelBox2?.x?.toFixed(0)}`);

const dot1ClassAfter = await dots.nth(1).getAttribute("class");
rec("second dot active after swipe", dot1ClassAfter?.includes("fe480b"), "");

// ---- Swipe right -> back to order slide
const bcx = barBox2.x + barBox2.width / 2;
const bcy = barBox2.y + barBox2.height / 2;
await page.mouse.move(bcx, bcy);
await page.mouse.down();
await page.mouse.move(bcx + 60, bcy, { steps: 4 });
await page.mouse.move(bcx + 170, bcy, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(400);

const panelBox3 = await panel.boundingBox();
rec("swipe right returns to order card", !!panelBox3 && panelBox3.x < 100, `x=${panelBox3?.x?.toFixed(0)}`);

// ---- Dots jump back to checkout, then panel still expands (no click bleed)
await dots.nth(1).click();
await page.waitForTimeout(350);
const barBox3 = await page.locator("#cart-checkout-bar").boundingBox();
rec("dot click jumps to checkout slide", !!barBox3 && barBox3.x < 100, `x=${barBox3?.x?.toFixed(0)}`);

await dots.nth(0).click();
await page.waitForTimeout(400);
await panel.click();
const sheet = page.locator('[aria-label="Close order status panel"]');
const sheetVisible = await sheet.isVisible().catch(() => false);
rec("order card expands after swiping", sheetVisible, "");

if (sheetVisible) {
  await sheet.click();
  await page.waitForTimeout(250);
}

await page.screenshot({ path: "dock-carousel.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
