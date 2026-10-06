import { chromium } from "playwright-core";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
for (let run = 1; run <= 3; run++) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  const bad = [];
  const errs = [];
  page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
  page.on("requestfailed", (r) => bad.push("FAIL " + r.url() + " " + (r.failure()?.errorText || "")));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text().slice(0, 300)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));
  await page.goto("http://localhost:3222/login", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  const hydrated = await page.evaluate(() => {
    const btn = document.querySelector("#get-otp-btn");
    if (!btn) return "no-btn";
    const key = Object.keys(btn).find((k) => k.startsWith("__react"));
    return key ? "react-key:" + key.slice(0, 30) : "no-react-key";
  });
  console.log(`run${run} hydrated=${hydrated}`);
  console.log("  bad:", bad.slice(0, 8).join(" | ") || "none");
  console.log("  errs:", errs.slice(0, 6).join(" || ") || "none");
  await browser.close();
}
