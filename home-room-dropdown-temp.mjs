import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
import { API } from "./api-base-temp.mjs";
const ORG = "858db12f-2310-45f0-8fe5-fc1403a20580";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const MULTI = {
  id: "g1", organizationId: ORG, status: "ACTIVE",
  name: "Aarav", email: "guest.demo@hyatt.grubpac.com", phone: "+919876543210",
  hotel: { id: ORG, name: "Hyatt Hotels" },
  stay: { hotelName: "Hyatt Place", reservationId: "R1", roomNumbers: ["1204", "1205", "1206"], checkInAt: "2026-09-29T10:50:57.395Z", checkOutAt: "2026-10-02T10:50:57.395Z" },
};

const SINGLE = { ...MULTI, id: "guest-single", stay: { ...MULTI.stay, roomNumbers: ["1204"] } };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function login(guestBody, startRoom) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  await page.route(`${API}/**`, (route) => {
    const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const auth = route.request().headers().authorization;
    const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/guest-auth/otp/request") return ok({ message: "sent" });
    if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: guestBody });
    if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    if (p === "/guests/me") return ok(guestBody);
    if (p === "/guest/kitchens") return ok([{ id: "k1", name: "House Of Ming", code: "KIT-1", imageUrl: null, hotelName: "Hyatt Place", status: "ONLINE" }]);
    if (p === "/guest/cart" && route.request().method() === "GET") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript((room) => {
    // Clear only on the very first load - this script re-runs on reload and would
    // otherwise wipe the stored tokens the persistence check depends on.
    if (!sessionStorage.getItem("harness-init")) {
      localStorage.clear();
      sessionStorage.setItem("harness-init", "1");
      if (room) localStorage.setItem("grubpac.selectedRoom.g1", room);
    }
  }, startRoom);

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
    // Dismiss the picker while keeping whatever room is stored for this device.
    await page.waitForSelector("#room-continue", { timeout: 20000 });
    await page.locator("button:has-text('Skip')").click();
  }
  await page.waitForURL("**/home", { timeout: 20000 });
  await page.waitForSelector("text=Welcome,", { timeout: 20000 });
  return { ctx, page };
}

/* ---- multi-room guest: pill becomes a dropdown ---- */
{
  const { ctx, page } = await login(MULTI, "1204");
  const pill = page.locator('button[aria-label="Change room"]');
  rec("multi-room pill is a button", await pill.count() === 1);
  rec("multi-room pill shows chevron", await pill.locator("svg").count() === 1);
  rec("starts on Room 1204", (await pill.innerText()).includes("Room 1204"), await pill.innerText());

  await pill.click();
  const menu = page.locator('[role="menu"][aria-label="Choose room"]');
  await menu.waitFor({ timeout: 5000 });
  const items = menu.locator('[role="menuitem"]');
  rec("dropdown lists all 3 booked rooms", await items.count() === 3, String(await items.count()));
  rec("current room marked in menu", (await menu.innerText()).includes("Room 1204"));

  await menu.locator('[role="menuitem"]:has-text("Room 1206")').click();
  await page.waitForTimeout(400);
  rec("pill now shows Room 1206", (await pill.innerText()).includes("Room 1206"), await pill.innerText());
  rec("menu closes after picking", await menu.count() === 0);

  // choice must survive a reload (device-local storage)
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Welcome,", { timeout: 20000 });
  rec("choice persists after reload", (await page.locator('button[aria-label="Change room"]').innerText()).includes("Room 1206"));

  // outside tap closes the menu
  await page.locator('button[aria-label="Change room"]').click();
  await menu.waitFor({ timeout: 5000 });
  await page.locator("h1:has-text('Hyatt')").click();
  await page.waitForTimeout(300);
  rec("outside tap closes menu", await menu.count() === 0);

  await page.screenshot({ path: "home-room-dropdown.png" });
  await ctx.close();
}

/* ---- single-room guest: static pill, no dropdown ---- */
{
  const { ctx, page } = await login(SINGLE);
  const pill = page.locator('button[aria-label="Change room"]');
  rec("single-room pill is NOT a dropdown button", await pill.count() === 0);
  const anyPill = page.locator("button:has-text('Room 1204')");
  const pillText = await anyPill.count() ? await anyPill.innerText() : await page.locator("text=Room 1204").first().innerText();
  rec("single-room still shows Room 1204", pillText.includes("Room 1204"), pillText);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
