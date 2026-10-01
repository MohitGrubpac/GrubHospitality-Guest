import { fromMinor } from "./ca-stub1.mjs";

export const KITCHEN_FALLBACK_IMAGE = "/food-items/restaurant.jpg";
export const CATEGORY_FALLBACK_IMAGE = "/kitchen/kitch.jpg";

export const KITCHEN_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad2 = (value) => String(value).padStart(2, "0");

/**
 * "23:00" / "11:00 PM" / "22:30" -> "11 pm" / "11 PM" / "10:30 pm" (hotel local time).
 */
function formatClosingClock(value) {
  if (!value) return "";

  const raw = String(value);
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hasMeridiem = /(am|pm)/i.test(raw);
  const minutes = Number(match[2]);
  let hours = Number(match[1]);
  const meridiem = hasMeridiem ? (/pm/i.test(raw) ? "pm" : "am") : hours >= 12 ? "pm" : "am";
  if (!hasMeridiem) hours = hours % 12 || 12;

  return `${hours}${minutes ? `:${pad2(minutes)}` : ""} ${meridiem}`;
}

/**
 * Closing time for today from the kitchen's operating hours. The admin console
 * writes `hours: [{ dayOfWeek, shifts: [{ open, close }] }]`; several looser
 * shapes are tolerated so a payload change does not blank the pill.
 */
function resolveClosingClock(kitchen) {
  // Absolute timestamp wins when present.
  const absolute = kitchen.closesAt || kitchen.closingTime || kitchen.closeTime;
  if (absolute) {
    if (/^\d{4}-\d{2}-\d{2}/.test(String(absolute))) {
      const date = new Date(absolute);
      if (!Number.isNaN(date.getTime())) return formatClosingClock(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
    }
    return formatClosingClock(absolute);
  }

  const hours = kitchen.hours || kitchen.operatingHours || kitchen.businessHours;
  if (!Array.isArray(hours) || hours.length === 0) return null;

  const today = new Date();
  const entry =
    hours.find((row) => row && Number(row.dayOfWeek) === today.getDay()) ||
    hours.find((row) => {
      const day = row && (row.day || row.name);
      return day && String(day).toLowerCase() === DAY_NAMES[today.getDay()].toLowerCase();
    }) ||
    null;
  if (!entry || entry.isClosed) return null;

  const shifts = Array.isArray(entry.shifts) && entry.shifts.length ? entry.shifts : [entry];
  const closes = shifts
    .map((shift) => shift && (shift.close || shift.closeTime || shift.to))
    .filter(Boolean);
  if (!closes.length) return null;

  // The last shift of the day is when the kitchen stops taking orders.
  return formatClosingClock(closes[closes.length - 1]);
}

/**
 * GET /guest/kitchens -> the restaurant cards rendered on Home and Restaurant List.
 * Kitchens are addressed by id, so `slug` mirrors the id and keeps route helpers unchanged.
 */
export function toRestaurantCard(kitchen) {
  if (!kitchen) return null;

  const isOpen = kitchen.status === KITCHEN_STATUS.ONLINE && kitchen.isClosed !== true;
  const hotelName = kitchen.hotelName || "";
  const closingClock = isOpen ? resolveClosingClock(kitchen) : null;

  return {
    id: kitchen.id,
    slug: kitchen.id,
    name: kitchen.name || "",
    code: kitchen.code || "",
    hotelName,
    type: kitchen.type || "",
    cuisine: kitchen.type || hotelName,
    description: kitchen.description || (hotelName ? `Order in from ${hotelName}` : ""),
    image: kitchen.imageUrl || KITCHEN_FALLBACK_IMAGE,
    status: kitchen.status || KITCHEN_STATUS.OFFLINE,
    isOpen,
    timing: isOpen ? (closingClock ? `Open Now | Closes ${closingClock}` : "Open Now") : "Closed",
    isOrderable: isOpen,
  };
}

export function toRestaurantCards(kitchens) {
  return (kitchens || []).map(toRestaurantCard).filter(Boolean);
}

/** API tags arrive as plain strings or { name, icon } objects; icon is a badge image URL. */
function toTag(tag) {
  if (typeof tag === "string") return tag ? { name: tag, icon: "" } : null;
  if (tag && typeof tag === "object") {
    const name = String(tag.name ?? tag.label ?? tag.title ?? tag.value ?? "");
    const icon = tag.icon || tag.imageUrl || tag.image || "";
    return name || icon ? { name, icon } : null;
  }
  if (tag === null || tag === undefined) return null;
  return { name: String(tag), icon: "" };
}

/** API menu item -> the item shape every dish/menu component renders. */
export function toMenuItem(item, kitchen) {
  if (!item) return null;

  const priceMinor = item.priceMinor ?? 0;
  const tagList = (Array.isArray(item.tags) ? item.tags : []).map(toTag).filter(Boolean);

  return {
    id: item.id,
    menuItemId: item.id,
    name: item.name || "",
    description: item.description || "",
    price: fromMinor(priceMinor),
    priceMinor,
    rating: item.rating ?? null,
    isVeg: item.isVeg !== false,
    isOutOfStock: Boolean(item.isOutOfStock),
    image: item.image || null,
    tags: tagList.map((tag) => tag.name).filter(Boolean),
    tagList,
    restaurantId: kitchen?.id ?? null,
    restaurantSlug: kitchen?.id ?? null,
    kitchenName: kitchen?.name ?? "",
    cuisine: null,
  };
}

/** GET /guest/kitchens/{kitchenId}/menu */
export function toMenu(menu) {
  if (!menu) return null;

  const kitchen = {
    id: menu.kitchenId,
    name: menu.kitchenName || "",
    hotelName: menu.hotelName || "",
    image: menu.imageUrl || KITCHEN_FALLBACK_IMAGE,
  };

  const categories = (menu.categories || []).map((category) => ({
    id: category.id,
    name: category.name || "",
    description: "",
    image: CATEGORY_FALLBACK_IMAGE,
    items: (category.items || []).map((item) => toMenuItem(item, kitchen)).filter(Boolean),
  }));

  return {
    kitchenId: kitchen.id,
    kitchenName: kitchen.name,
    kitchen,
    categories,
    items: categories.flatMap((category) => category.items),
    totalItems: categories.reduce((sum, category) => sum + category.items.length, 0),
  };
}

/** Flat dish index used by the search screens. */
export function buildDishIndex(menus) {
  return (menus || [])
    .filter(Boolean)
    .flatMap((menu) => menu.items || [])
    .map((item) => ({ ...item }));
}
