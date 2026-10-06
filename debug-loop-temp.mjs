import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));
const ME = { ...GUEST, orders: (GUEST.orders || []).map((o) => ({ ...o, status: "DELIVERED" })) };

for (let run = 1; run <= 3; run++) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  await page.route(`${API}/**`, (route) => {
    const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
    if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: ME });
    if (p === "/guests/me") return ok(ME);
    return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("harness-cleared")) { localStorage.clear(); sessionStorage.setItem("harness-cleared", "1"); }
  });
  await page.addInitScript(() => { localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-b1"])); });
  await page.goto("http://localhost:3222/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
  await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
  await page.locator("#get-otp-btn").click();
  let info;
  try {
    await page.waitForSelector('input[aria-label="OTP digit 1"]', { timeout: 8000 });
    const box = await page.locator('input[aria-label="OTP digit 1"]').boundingBox();
    const st = await page.locator('input[aria-label="OTP digit 1"]').evaluate((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { w: r.width, h: r.height, display: cs.display, vis: cs.visibility, op: cs.opacity };
    });
    info = `FOUND box=${JSON.stringify(box)} st=${JSON.stringify(st)}`;
  } catch (e) {
    const exists = await page.locator('input[aria-label="OTP digit 1"]').count();
    const body = (await page.locator("body").innerText()).slice(0, 200).replace(/\n/g, " | ");
    info = `TIMEOUT exists=${exists} body=${body}`;
  }
  console.log(`run${run}: ${info}`);
  await browser.close();
}
