import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
const API = "https://api-kitchen.grubpacapp.tech/api/v1";
const ORG = "858db12f-2310-45f0-8fe5-fc1403a20580";

const GUEST = {
  id: "g", organizationId: ORG, status: "ACTIVE", name: "Aarav Mehta",
  email: "a@e.com", phone: "+919876543210", hotelName: "Hyatt Place - Airport",
  reservationId: "DEMO-RES-001", roomNumber: "1204",
  checkInAt: "2026-09-29T10:50:57.395Z", checkOutAt: "2026-10-02T10:50:57.395Z",
  hotel: { id: ORG, name: "Hyatt Hotels" },
};

const MENU = {
  kitchenId: "k1", kitchenName: "Hyatt Place - Airport",
  categories: [{ id: "c1", name: "Mains", items: [
    { id: "mi-1", name: "Veg Biryani", priceMinor: 38000, isVeg: true, isOutOfStock: false, description: "d", image: null, tags: [] },
    { id: "mi-2", name: "Mutton Rogan Josh", priceMinor: 64000, isVeg: false, isOutOfStock: false, description: "d", image: null, tags: [] },
  ] }],
};

const CART = {
  kitchens: [{ restaurantId: "k1", kitchenName: "Hyatt Place - Airport",
    items: [
      { menuItemId: "mi-1", name: "Veg Biryani", unitPriceMinor: 38000, quantity: 2, lineTotalMinor: 76000, note: null, available: true },
      { menuItemId: "mi-2", name: "Mutton Rogan Josh", unitPriceMinor: 64000, quantity: 2, lineTotalMinor: 128000, note: null, available: true },
    ], subtotalMinor: 204000 }],
  grandTotalMinor: 204000, itemCount: 4,
};

const ORDER = {
  id: "o1", orderCode: "ODR-57", restaurantId: "k1", guestId: "g", status: "PREPARING",
  guestName: "Aarav Mehta", roomNumber: "1204", hotelName: "Hyatt Place - Airport",
  hotelAddress: "Jhandwalan", specialInstructions: null, totalMinor: 204000, currency: "INR",
  placedAt: "2026-09-30T04:37:39.615Z", scheduledAt: null, activationAt: null,
  acceptedAt: "2026-09-30T04:38:00.000Z", readyAt: null, deliveredAt: null,
  cancelledAt: null, cancelReason: null, version: 1,
  items: [{ id: "i1", orderId: "o1", menuItemId: "mi-1", itemName: "Veg Biryani", unitPriceMinor: 38000, quantity: 2, note: null, createdAt: "2026-09-30T04:37:39.615Z" }],
  statusHistory: [],
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } });
const page = await ctx.newPage();

await page.route(`${API}/**`, (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
  const auth = route.request().headers().authorization;
  const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  if (p === "/guests/me") return ok(GUEST);
  if (p === "/guest/cart" && route.request().method() === "GET") return ok(CART);
  if (p === "/guest/kitchens") return ok([{ id: "k1", name: "Hyatt Place - Airport", code: "KIT-1", imageUrl: null, hotelName: "Hyatt Place - Airport", status: "ONLINE" }]);
  if (p.endsWith("/menu")) return ok(MENU);
  if (p === "/guest/orders/o1") return ok(ORDER);
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});

// Cart has items AND an order is being tracked -> both bottom bars render.
await page.addInitScript(() => {
  localStorage.setItem("grubpac.guest.accessToken", "a");
  localStorage.setItem("grubpac.guest.refreshToken", "r");
  localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["o1"]));
});

await page.goto(`${BASE}/kitchen/k1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Prepping", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);

const boxes = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
  };
  const panel = [...document.querySelectorAll("div")].find((d) => d.textContent.trim().startsWith("Preparing") && d.className.includes("fixed"));
  const bar = document.querySelector("#cart-checkout-bar");
  const pRect = panel ? panel.getBoundingClientRect() : null;
  return {
    panel: pRect ? { top: Math.round(pRect.top), bottom: Math.round(pRect.bottom), h: Math.round(pRect.height) } : null,
    panelStyleBottom: panel ? panel.parentElement?.style?.bottom : null,
    bar: bar ? (() => { const r = bar.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; })() : null,
    barWrapper: pick("#cart-checkout-bar") ? (() => { let e = document.querySelector("#cart-checkout-bar").parentElement; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; })() : null,
    vh: window.innerHeight,
  };
});

console.log(JSON.stringify(boxes, null, 2));
if (boxes.panel && boxes.bar) {
  const gap = boxes.bar.top - boxes.panel.bottom;
  const overlap = boxes.panel.bottom > boxes.bar.top;
  console.log(`\npanel bottom=${boxes.panel.bottom}  bar top=${boxes.bar.top}  gap=${gap}px  overlap=${overlap}`);
}

await page.screenshot({ path: "overlap-check.png" });
await browser.close();
