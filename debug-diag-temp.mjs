import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));
const ME = { ...GUEST, orders: (GUEST.orders || []).map((o) => ({ ...o, status: "DELIVERED" })) };

for (let run = 1; run <= 3; run++) {
  const logs = [];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));
  try {
    await page.route(`${API}/**`, (route) => {
      const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
      const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
      if (p === "/guest-auth/otp/request") { logs.push("REQ otp/request"); return ok({ message: "sent" }); }
      if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: ME });
      if (p === "/guests/me") return ok(ME);
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.addInitScript(() => { localStorage.clear(); });
    await page.addInitScript(() => { localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["ord-b1"])); });
    await page.goto("http://localhost:3222/login", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
    let opened = false;
    for (let i = 0; i < 6 && !opened; i++) {
      await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
      let clickErr = "";
      try { await page.locator("#get-otp-btn").click({ timeout: 4000 }); }
      catch (e) { clickErr = String(e.message).split("\n")[0]; }
      await page.waitForTimeout(2500);
      opened = (await page.locator('input[aria-label="OTP digit 1"]').count()) > 0;
      if (!opened && clickErr) {
        const diag = await page.locator("#get-otp-btn").evaluate((b) => {
          const r = b.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, disabled: b.disabled, topTag: top ? top.tagName + "." + (top.className || "").toString().slice(0, 60) : null };
        }).catch((e) => "diagERR " + e.message);
        logs.push(`attempt ${i} clickErr=${clickErr} diag=${JSON.stringify(diag)}`);
      } else {
        logs.push(`attempt ${i} opened=${opened} clickErr=${clickErr}`);
      }
    }
    console.log(`run${run} opened=${opened} :: ${logs.join(" || ")}`);
  } catch (e) {
    console.log(`run${run} FAILED ${e.message.split("\n")[0]} :: ${logs.join(" || ")}`);
  } finally {
    await browser.close();
  }
}
