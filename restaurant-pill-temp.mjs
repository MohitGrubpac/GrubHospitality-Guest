import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
import { API } from "./api-base-temp.mjs";
const ORG = "858db12f-2310-45f0-8fe5-fc1403a20580";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const GUEST = {
  id: "g1", organizationId: ORG, status: "ACTIVE",
  name: "Aarav", email: "guest.demo@hyatt.grubpac.com", phone: "+919876543210",
  hotel: { id: ORG, name: "Hyatt Hotels" },
  stay: { hotelName: "Hyatt Place", reservationId: "R1", roomNumbers: ["1204"], checkInAt: "2026-09-29T10:50:57.395Z", checkOutAt: "2026-10-02T10:50:57.395Z" },
};

const dow = new Date().getDay();
const KITCHENS = [
  { id: "k1", name: "Hyatt Place — Airport", code: null, imageUrl: null, hotelName: null, status: "ONLINE",
    type: "American", description: "Good Restra", openTime: "09:00", closeTime: "22:00", isClosed: false },
  { id: "k2", name: "Poolside Grill", code: "KIT-2", imageUrl: null, hotelName: "Hyatt Place", status: "ONLINE",
    description: "Poolside Grill", hours: [{ dayOfWeek: dow, shifts: [{ open: "10:00", close: "23:00" }] }] },
  { id: "k3", name: "Rooftop Lounge", code: "KIT-3", imageUrl: null, hotelName: null, status: "OFFLINE",
    description: "Closed for renovation" },
  { id: "k4", name: "Late Night Bites", code: "KIT-4", imageUrl: null, hotelName: null, status: "ONLINE",
    description: "Late night", closeTime: "23:30", isClosed: true },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
  if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: GUEST });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok(GUEST);
  if (p === "/guest/kitchens") return ok(KITCHENS);
  if (p === "/guest/cart") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
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
await page.waitForURL("**/home", { timeout: 20000 });
await page.waitForSelector("text=Hyatt Place — Airport", { timeout: 20000 });
await page.waitForTimeout(800);

const text = await page.locator("body").innerText();
rec("card shows API description", text.includes("Good Restra"));
rec("card footer shows kitchen type", text.includes("American"));
rec("pill formats closeTime HH:mm -> 10 pm", text.includes("Open Now | Closes 10 pm"));
rec("pill still supports hours[] shape", text.includes("Open Now | Closes 11 pm"));
rec("ONLINE + isClosed:true stays 'Closed'", /Closed\s+Late Night Bites/.test(text));
rec("offline kitchen stays 'Closed'", /Closed\s+Rooftop Lounge/.test(text));
rec("no bare 'Open Now' without closing time", !/Open Now(?!\s\|)/.test(text));

await page.locator("text=Hyatt Place — Airport").first().scrollIntoViewIfNeeded();
await page.screenshot({ path: "restaurant-pill-figma.png" });
await ctx.close();

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
