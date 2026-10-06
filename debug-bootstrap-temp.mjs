import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { API } from "./api-base-temp.mjs";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const GUEST = JSON.parse(readFileSync("guest-me-fixture.json", "utf8"));
const ME = { ...GUEST, orders: [] };
const A_KEY = "grubpac.guest.accessToken", R_KEY = "grubpac.guest.refreshToken";
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();
const meBearers = [];
await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const auth = route.request().headers().authorization;
  const ok = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
  if (p === "/guests/me") { meBearers.push(auth || "none"); return ok(ME); }
  if (p === "/guest/kitchens") return ok([]);
  if (p === "/guest/cart") return ok({ kitchens: [], itemCount: 0, grandTotalMinor: 0 });
  if (p.startsWith("/guest/orders")) return ok([]);
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.addInitScript(([a, r, ak, rk]) => {
  localStorage.clear();
  localStorage.setItem(ak, a);
  localStorage.setItem(rk, r);
}, ["valid-access-1", "valid-refresh-1", A_KEY, R_KEY]);
await page.goto("http://localhost:3222/home", { waitUntil: "load" });
await page.waitForTimeout(5000);
console.log("profile calls with bearer:", JSON.stringify(meBearers));
console.log("url:", page.url());
console.log("body:", (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 200));
await browser.close();
