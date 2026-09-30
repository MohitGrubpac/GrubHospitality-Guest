import { fromMinor } from "@/lib/money";

export const KITCHEN_FALLBACK_IMAGE = "/food-items/restaurant.jpg";
export const CATEGORY_FALLBACK_IMAGE = "/kitchen/kitch.jpg";

export const KITCHEN_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
};

/**
 * GET /guest/kitchens -> the restaurant cards rendered on Home and Restaurant List.
 * Kitchens are addressed by id, so `slug` mirrors the id and keeps route helpers unchanged.
 */
export function toRestaurantCard(kitchen) {
  if (!kitchen) return null;

  const isOpen = kitchen.status === KITCHEN_STATUS.ONLINE;
  const hotelName = kitchen.hotelName || "";

  return {
    id: kitchen.id,
    slug: kitchen.id,
    name: kitchen.name || "",
    code: kitchen.code || "",
    hotelName,
    cuisine: hotelName,
    description: hotelName ? `Order in from ${hotelName}` : "",
    image: kitchen.imageUrl || KITCHEN_FALLBACK_IMAGE,
    status: kitchen.status || KITCHEN_STATUS.OFFLINE,
    isOpen,
    timing: isOpen ? "Open Now" : "Closed",
    isOrderable: isOpen,
  };
}

export function toRestaurantCards(kitchens) {
  return (kitchens || []).map(toRestaurantCard).filter(Boolean);
}

/** API menu item -> the item shape every dish/menu component renders. */
export function toMenuItem(item, kitchen) {
  if (!item) return null;

  const priceMinor = item.priceMinor ?? 0;

  return {
    id: item.id,
    menuItemId: item.id,
    name: item.name || "",
    description: item.description || "",
    price: fromMinor(priceMinor),
    priceMinor,
    rating: null,
    isVeg: item.isVeg !== false,
    isOutOfStock: Boolean(item.isOutOfStock),
    image: item.image || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
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
