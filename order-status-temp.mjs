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
  guestId: "guest-1",
  guestName: "Aarav Mehta",
  roomNumber: "1204",
  items: [{ menuItemId: "m-6", itemName: "Butter Chicken", unitPriceMinor: 48000, quantity: 1 }],
  totalMinor: 48000,
  currency: "INR",
  placedAt: new Date().toISOString(),
  specialInstructions: null,
  cancelReason: null,
};

let backendStatus = "NEW";
let orderDetailHits = 0;
let orderWriteHits = 0;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });

  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: GUEST });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok(GUEST);
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
  if (p === "/guest/orders/ord-1") {
    if (method !== "GET") orderWriteHits += 1;
    orderDetailHits += 1;
    return ok({ ...ORDER, status: backendStatus });
  }
  if (p === "/guest/orders") {
    if (method !== "GET") orderWriteHits += 1;
    return ok([{ ...ORDER, status: backendStatus }]);
  }
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

const doneCount = () => page.locator('img[alt="Done"]').count();

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

// Tracked order adopted on /home; open the status screen
await page.goto(`${BASE}/order-status`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Order Confirmed!", { timeout: 20000 });

const initialHits = orderDetailHits;
const initialDone = await doneCount();
rec("placed order renders as backend status NEW", initialDone === 1, `doneChecks=${initialDone}`);
rec("timeline shows exactly the accepted step done", (await page.locator("text=Order Accepted").count()) >= 1);

// Wait through at least one full 20s poll cycle while backend still reports NEW
const pollDeadline = Date.now() + 26000;
let polled = false;
while (Date.now() < pollDeadline) {
  if (orderDetailHits > initialHits) { polled = true; break; }
  await new Promise((r) => setTimeout(r, 400));
}
rec("order is polled from the backend (>=1 refetch)", polled, `hits ${initialHits} -> ${orderDetailHits}`);

await page.waitForTimeout(1500);
const afterPollDone = await doneCount();
const afterPollText = await page.locator("body").innerText();
rec("frontend does NOT auto-advance status between polls", afterPollDone === 1 && afterPollText.includes("Order Confirmed!"), `doneChecks=${afterPollDone}`);
rec("frontend never writes to the orders API", orderWriteHits === 0, `writes=${orderWriteHits}`);

// Backend now reports PREPARING -> next poll must reflect it (real-time, server-driven)
backendStatus = "PREPARING";
let advanced = false;
try {
  await page.waitForFunction(
    () => document.querySelectorAll('img[alt="Done"]').length >= 2,
    { timeout: 26000 },
  );
  advanced = true;
} catch {
  advanced = false;
}
rec("status updates only after backend updates (PREPARING picked up)", advanced);

await ctx.close();
await browser.close();

const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
