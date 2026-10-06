import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));
const ME = { ...GUEST, orders: (GUEST.orders || []).map((o) => ({ ...o, status: "DELIVERED" })) };
for (let run = 1; run <= 4; run++) {
  const logs = [];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() !== "log") logs.push(m.type().toUpperCase() + ": " + m.text().slice(0, 300)); });
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message.slice(0, 300)));
  try {
    await page.route(`${API}/**`, (route) => {
      const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
      const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
      if (p === "/guest-auth/otp/request") { logs.push(">>> REQ otp/request"); return ok({ message: "sent" }); }
      if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: ME });
      if (p === "/guests/me") return ok(ME);
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.addInitScript(() => { localStorage.clear(); });
    await page.addInitScript(() => { localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-b1"])); });
    await page.goto("http://localhost:3222/login", { waitUntil: "load" });
    await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
    await page.locator("#get-otp-btn").click({ timeout: 5000 });
    await page.waitForTimeout(3500);
    const opened = (await page.locator('input[aria-label="OTP digit 1"]').count()) > 0;
    const body = (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 400);
    console.log(`run${run} opened=${opened}`);
    if (!opened) {
      console.log("  body:", body);
      console.log("  logs:", logs.join(" || ") || "none");
    }
  } catch (e) {
    console.log(`run${run} FAILED ${e.message.split("\n")[0]}`);
    console.log("  logs:", logs.join(" || ") || "none");
  } finally {
    await browser.close();
  }
}
