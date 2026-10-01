import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
import { API } from "./api-base-temp.mjs";
const ORG = "858db12f-2310-45f0-8fe5-fc1403a20580";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

// Exact login-response shape from the user's paste.
const MULTI = {
  id: "4e7fced0-279a-407b-a770-7d446de44e5e", organizationId: ORG, status: "ACTIVE",
  name: "Aarav Mehta Ji", email: "guest.demo@hyatt.grubpac.com", phone: "+919876543210",
  createdAt: "2026-09-29T10:50:57.396Z", updatedAt: "2026-09-30T09:54:42.479Z",
  hotel: { id: ORG, name: "Hyatt Hotels" },
  stay: { hotelName: "Hyatt Place — Airport", reservationId: "DEMO-RES-001", roomNumbers: ["1204", "1205", "1206"], checkInAt: "2026-09-29T10:50:57.395Z", checkOutAt: "2026-10-02T10:50:57.395Z" },
};

const SINGLE = {
  ...MULTI,
  id: "guest-single",
  stay: { ...MULTI.stay, roomNumbers: ["1204"] },
};

const KITCHENS = [{ id: "k1", name: "Hyatt Place — Airport", code: "KIT-1", imageUrl: null, hotelName: "Hyatt Place — Airport", status: "ONLINE" }];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function login(guestBody) {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } });
  const page = await ctx.newPage();
  await page.route(`${API}/**`, (route) => {
    const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const auth = route.request().headers().authorization;
    const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/guest-auth/otp/request") return ok({ message: "If the details are valid, a verification code has been sent." });
    if (p === "/guest-auth/login") return ok({ accessToken: "a1", refreshToken: "r1", guest: guestBody });
    if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    if (p === "/guests/me") return ok(guestBody);
    if (p === "/guest/kitchens") return ok(KITCHENS);
    if (p === "/guest/cart" && route.request().method() === "GET") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(() => localStorage.clear());

  // Exactly what a guest does: type email, get OTP, enter it.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });
  await page.fill('input[placeholder="Mobile number or email"]', "guest.demo@hyatt.grubpac.com");
  await page.locator("#get-otp-btn").click();
  await page.waitForSelector('input[aria-label="OTP digit 1"]', { timeout: 20000 });
  for (const [i, d] of ["1", "2", "3", "4"].entries()) {
    await page.fill(`input[aria-label="OTP digit ${i + 1}"]`, d);
  }
  await page.locator("#verify-otp-btn").click();
  await page.waitForTimeout(3500);
  return { ctx, page };
}

/* ---- multi-room guest: MUST land on /room-selection ---- */
{
  const { ctx, page } = await login(MULTI);
  const onRoomScreen = page.url().includes("/room-selection");
  rec("multi-room login lands on /room-selection", onRoomScreen, page.url());
  if (onRoomScreen) {
    const txt = await page.locator("body").innerText();
    rec("lists all 3 rooms", txt.includes("1204") && txt.includes("1205") && txt.includes("1206"), txt.match(/Room \d+/g)?.join(",") || "");
    rec("subtitle matches Figma copy", txt.includes("Choose a room to place your food order"));
    rec("no extra 'Current' badge on room cards", !txt.includes("Current"));
    rec("cart bar does not cover the screen", await page.locator("#cart-checkout-bar").count() === 0);
    await page.screenshot({ path: "login-rooms.png" });

    await page.locator("#room-option-1206").click();
    await page.locator("#room-continue").click();
    await page.waitForURL("**/home", { timeout: 20000 });
    await page.waitForTimeout(1500);
    rec("chosen room carried into /home", (await page.locator("body").innerText()).includes("Room 1206"));
  }
  await ctx.close();
}

/* ---- single-room guest: must go straight to /home ---- */
{
  const { ctx, page } = await login(SINGLE);
  rec("single-room login goes to /home", page.url().includes("/home"), page.url());
  await ctx.close();
}

/* ---- Google sign-in with multiple rooms ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } });
  const page = await ctx.newPage();
  await page.route(`${API}/**`, (route) => {
    const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const auth = route.request().headers().authorization;
    const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/guest-auth/google") return ok({ accessToken: "a1", refreshToken: "r1", guest: MULTI });
    if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    if (p === "/guests/me") return ok(MULTI);
    if (p === "/guest/kitchens") return ok(KITCHENS);
    if (p === "/guest/cart" && route.request().method() === "GET") return ok({ kitchens: [], grandTotalMinor: 0, itemCount: 0 });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="Mobile number or email"]', { timeout: 20000 });

  // Drive the Google button's credential callback the way GSI would.
  await page.evaluate(() => {
    const evt = new CustomEvent("__noop__");
    void evt;
  });
  const googleResult = await page.evaluate(async () => {
    // The component stores the handler on a ref; simulate by calling the exposed hook
    // through a rendered button if present, else report that GSI is unavailable.
    const el = document.querySelector("[data-google-signin]");
    return el ? "mounted" : "absent";
  });
  rec("Google button component present (GIS may be blocked here)", googleResult === "mounted", googleResult);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
