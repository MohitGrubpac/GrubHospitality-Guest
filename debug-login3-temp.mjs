import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));
const ME = { ...GUEST, orders: (GUEST.orders || []).map((o) => ({ ...o, status: "DELIVERED" })) };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(m.type().toUpperCase() + ": " + m.text().slice(0, 500)));
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));
page.on("request", (r) => { if (r.url().includes("api")) logs.push("REQ " + r.method() + " " + new URL(r.url()).pathname); });
page.on("response", (r) => { if (r.url().includes("api")) logs.push("RES " + r.status() + " " + new URL(r.url()).pathname); });
try {
  await page.route(`${API}/**`, (route) => {
    const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
    if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: ME });
    if (p === "/guests/me") return ok(ME);
    return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(() => { localStorage.clear(); });
  await page.goto("http://localhost:3222/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
  let opened = false;
  for (let i = 0; i < 6 && !opened; i++) {
    await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
    const disabled = await page.locator("#get-otp-btn").isDisabled().catch((e) => "ERR:" + e.message);
    logs.push(`attempt ${i} disabled=${disabled}`);
    await page.locator("#get-otp-btn").click({ timeout: 5000, force: false }).catch((e) => logs.push("clickERR " + e.message));
    await page.waitForTimeout(2500);
    opened = (await page.locator('input[aria-label="OTP digit 1"]').count()) > 0;
    logs.push(`attempt ${i} opened=${opened}`);
  }
  console.log("opened:", opened);
} finally {
  console.log("BODY:", (await page.locator("body").innerText().catch(() => "n/a")).slice(0, 500));
  console.log("LOGS:\n" + logs.join("\n"));
  await browser.close();
}
