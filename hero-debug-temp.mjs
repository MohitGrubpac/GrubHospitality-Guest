import { chromium } from "playwright-core";
import { readFileSync } from "fs";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
import { API } from "./api-base-temp.mjs";
const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

page.on("request", (req) => {
  if (req.url().includes("api-kitchen") || req.url().includes("kitchens")) {
    console.log("REQ ", req.method(), req.url());
  }
});
page.on("response", async (res) => {
  if (res.url().includes("api-kitchen")) {
    let body = "";
    try { body = (await res.text()).slice(0, 300); } catch {}
    console.log("RES ", res.status(), res.url(), "::", body);
  }
});

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: { ...GUEST, orders: [] } });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok({ ...GUEST, orders: [] });
  if (p === "/guest/kitchens") { console.log("MOCK HIT /guest/kitchens -> []"); return ok([]); }
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
  console.log("MOCK 404", p);
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.addInitScript(() => localStorage.clear());

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
await page.waitForSelector("text=Welcome,", { timeout: 20000 });
await page.waitForTimeout(1500);

const section = await page.locator("main").innerText();
console.log("\n=== MAIN TEXT ===");
console.log(section.slice(0, 900));
console.log("\n=== HERO ===");
console.log("h1:", await page.locator("h1").first().innerText());

await page.screenshot({ path: "hero-debug-top.png" });
await browser.close();
