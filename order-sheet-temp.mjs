import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const ORDER = {
  id: "ord-1",
  orderCode: "GH-1001",
  status: "NEW",
  restaurantId: "56344e3b-0241-4cf2-96ca-1e85c0b9dbd7",
  hotelName: "Hyatt Place — Airport",
  guestId: GUEST.id,
  guestName: "Aarav Mehta",
  roomNumber: "1204",
  items: [{ menuItemId: "m-6", itemName: "Butter Chicken", unitPriceMinor: 48000, quantity: 1 }],
  totalMinor: 48000,
  currency: "INR",
  placedAt: new Date().toISOString(),
  specialInstructions: null,
  cancelReason: null,
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
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
  if (p === "/guest/orders/ord-1") return ok(ORDER);
  if (p === "/guest/orders") return ok([ORDER]);
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.addInitScript(() => {
  if (!sessionStorage.getItem("harness-cleared")) {
    localStorage.clear();
    sessionStorage.setItem("harness-cleared", "1");
  }
});
await page.addInitScript(() => {
  localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-1"]));
});

// Login
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

// Expand the docked order-status panel
const dockBtn = page.locator('button[aria-expanded][class*="justify-between"]');
await dockBtn.waitFor({ timeout: 20000 });
await dockBtn.click();
await page.waitForSelector('text=VIEW DETAILS', { timeout: 5000 });

const geo = await page.evaluate(() => {
  const close = document.querySelector('button[aria-label="Close order status panel"]');
  const sheet = close?.parentElement;
  if (!close || !sheet) return null;
  const c = close.getBoundingClientRect();
  const s = sheet.getBoundingClientRect();
  return {
    centered: Math.abs((c.left + c.width / 2) - (s.left + s.width / 2)) <= 4,
    offsetAbove: Math.round(s.top - (c.top + c.height / 2)),
    sheetTop: Math.round(s.top),
    closeCenterY: Math.round(c.top + c.height / 2),
    visible: c.width > 0 && c.top >= 0,
  };
});
rec("close button horizontally centered", Boolean(geo) && geo.centered, JSON.stringify(geo));
rec("close button sits higher above sheet edge", Boolean(geo) && geo.offsetAbove >= 6, JSON.stringify(geo));

const copy = await page.locator("body").innerText();
rec("header shows highlighted received copy", copy.includes("We've successfully received your order."));
rec("step subtitles match figma", copy.includes("Done") && copy.includes("In Process...") && copy.includes("Est. 15 Minutes"));
rec("VIEW DETAILS footer present", copy.includes("VIEW DETAILS"));

await page.screenshot({ path: "order-status-sheet.png" });
await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
