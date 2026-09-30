import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://localhost:3222";
const API = "https://api-kitchen.grubpacapp.tech/api/v1";
const ORG = "858db12f-2310-45f0-8fe5-fc1403a20580";

const results = [];
const rec = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

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
const EMPTY_CART = { kitchens: [], grandTotalMinor: 0, itemCount: 0 };
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

async function open(path, { cart, order }) {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } });
  const page = await ctx.newPage();
  await page.route(`${API}/**`, (route) => {
    const p = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const auth = route.request().headers().authorization;
    const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (!auth) return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    if (p === "/guests/me") return ok(GUEST);
    if (p === "/guest/cart" && route.request().method() === "GET") return ok(cart);
    if (p === "/guest/kitchens") return ok([{ id: "k1", name: "Hyatt Place - Airport", code: "KIT-1", imageUrl: null, hotelName: "Hyatt Place - Airport", status: "ONLINE" }]);
    if (p.endsWith("/menu")) return ok(MENU);
    if (p === "/guest/orders/o1") return ok(ORDER);
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(([hasOrder]) => {
    localStorage.setItem("grubpac.guest.accessToken", "a");
    localStorage.setItem("grubpac.guest.refreshToken", "r");
    if (hasOrder) localStorage.setItem("grubpac.trackedOrderIds", JSON.stringify(["o1"]));
  }, [order]);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  return { ctx, page };
}

const measure = (page) => page.evaluate(() => {
  const bar = document.querySelector("#cart-checkout-bar");
  // The order card is the bordered wrapper around the status button.
  const statusBtn = [...document.querySelectorAll("button")].find((b) => /Accepted|Preparing|Ready|Delivered|Cancelled|Scheduled/.test(b.textContent) && b.className.includes("w-full"));
  const panelCard = statusBtn?.closest("div.rounded-xl");
  const dock = panelCard?.parentElement?.parentElement;
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height) }; };
  return {
    bar: box(bar), panel: box(panelCard), dock: box(dock),
    dockVar: getComputedStyle(document.documentElement).getPropertyValue("--bottom-dock-h").trim(),
    vh: window.innerHeight,
  };
});

/* ---- 1. order only ---- */
{
  const { ctx, page } = await open("/kitchen/k1", { cart: EMPTY_CART, order: true });
  const m = await measure(page);
  console.log("order only:", JSON.stringify(m));
  rec("order-only: panel shows", !!m.panel);
  rec("order-only: no cart bar", !m.bar);
  rec("order-only: docked to bottom", m.panel && Math.abs(m.panel.bottom - (m.vh - 16)) <= 2, `bottom=${m.panel?.bottom} vh=${m.vh}`);
  rec("order-only: dock height published", m.dockVar && m.dockVar !== "0px", m.dockVar);
  await page.screenshot({ path: "dock-order.png" });
  await ctx.close();
}

/* ---- 2. cart only ---- */
{
  const { ctx, page } = await open("/kitchen/k1", { cart: CART, order: false });
  const m = await measure(page);
  console.log("cart only:", JSON.stringify(m));
  rec("cart-only: bar shows", !!m.bar);
  rec("cart-only: no panel", !m.panel);
  rec("cart-only: docked to bottom", m.bar && Math.abs(m.bar.bottom - (m.vh - 16)) <= 2, `bottom=${m.bar?.bottom}`);
  await page.screenshot({ path: "dock-cart.png" });
  await ctx.close();
}

/* ---- 3. BOTH -> the carousel stack ---- */
{
  const { ctx, page } = await open("/kitchen/k1", { cart: CART, order: true });
  const m = await measure(page);
  console.log("both:", JSON.stringify(m));
  rec("both: panel renders", !!m.panel);
  rec("both: cart bar renders", !!m.bar);
  rec("both: no overlap", m.panel && m.bar && m.panel.bottom <= m.bar.top, `panel.bottom=${m.panel?.bottom} bar.top=${m.bar?.top}`);
  const gap = m.panel && m.bar ? m.bar.top - m.panel.bottom : -1;
  rec("both: real gap between cards (>=8px)", gap >= 8, `gap=${gap}px`);
  rec("both: dock height published", m.dockVar && m.dockVar !== "0px", m.dockVar);
  rec("both: left edges aligned", m.panel && m.bar && m.panel.left === m.bar.left, `${m.panel?.left} vs ${m.bar?.left}`);

  // content must clear the dock
  const cleared = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    const dockH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-dock-h")) || 0;
    return { padBottom: parseFloat(getComputedStyle(main).paddingBottom), dockH };
  });
  rec("both: menu content padded past the dock", cleared && cleared.padBottom >= cleared.dockH, JSON.stringify(cleared));

  await page.screenshot({ path: "dock-both.png" });

  // expanding the panel should take over the screen
  await page.locator("text=Preparing").first().click();
  await page.waitForTimeout(700);
  const expanded = await page.evaluate(() => {
    // The sheet is portalled to <body>, so look there.
    const el = [...document.body.children].find((d) => d.className?.includes?.("z-[9999]"));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), parent: el.parentElement?.tagName, hasTimeline: el.textContent.includes("Order Prepared"), hasViewDetails: el.textContent.includes("VIEW DETAILS") };
  });
  rec("expand: sheet portalled to body", expanded && expanded.parent === "BODY", JSON.stringify(expanded));
  rec("expand: full-screen sheet with timeline", expanded && expanded.hasTimeline && expanded.h > 700, JSON.stringify(expanded));
  await page.screenshot({ path: "dock-expanded.png" });
  await ctx.close();
}

/* ---- 4. dock hidden on /cart ---- */
{
  const { ctx, page } = await open("/cart", { cart: CART, order: true });
  const m = await measure(page);
  rec("/cart: dock does not stack over the cart page", !m.dock, JSON.stringify(m.dock));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n======== ${results.length - failed.length}/${results.length} passed ========`);
process.exit(failed.length ? 1 : 0);
