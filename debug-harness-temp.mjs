import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));
const ME = { ...GUEST, orders: (GUEST.orders || []).map((o) => ({ ...o, status: "DELIVERED" })) };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(m.type().toUpperCase() + ": " + m.text().slice(0, 300)));
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));
page.on("requestfailed", (r) => logs.push("REQFAIL: " + r.url() + " " + (r.failure()?.errorText || "")));
await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const method = route.request().method();
  const auth = route.request().headers().authorization;
  const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
  logs.push(`REQ ${method} ${p} auth=${Boolean(auth)}`);
  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: ME });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok(ME);
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart" && method === "GET") return ok({ kitchens: [], itemCount: 0, grandTotalMinor: 0 });
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
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
await page.locator("#get-otp-btn").click();
await page.waitForTimeout(4000);
console.log("digit inputs:", await page.locator('input[aria-label="OTP digit 1"]').count());
console.log("BODY:", (await page.locator("body").innerText()).slice(0, 600));
console.log("LOGS:\n" + logs.join("\n"));
await browser.close();
