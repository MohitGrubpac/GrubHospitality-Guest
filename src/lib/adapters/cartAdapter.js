import { fromMinor } from "@/lib/money";
import { enrichMenuItem } from "@/lib/menu-cache";

export const EMPTY_CART = {
  kitchens: [],
  items: [],
  itemCount: 0,
  subtotal: 0,
  subtotalMinor: 0,
  restaurantCount: 0,
};

function toCartLine(cartItem, kitchen) {
  const restaurant = {
    id: kitchen.restaurantId,
    name: kitchen.kitchenName || "",
    slug: kitchen.restaurantId,
  };

  const item = enrichMenuItem(cartItem.menuItemId, {
    id: cartItem.menuItemId,
    menuItemId: cartItem.menuItemId,
    name: cartItem.name || "",
    price: fromMinor(cartItem.unitPriceMinor),
    priceMinor: cartItem.unitPriceMinor ?? 0,
    restaurantId: kitchen.restaurantId,
    restaurantSlug: kitchen.restaurantId,
    kitchenName: kitchen.kitchenName || "",
  });

  return {
    restaurant,
    item,
    qty: cartItem.quantity ?? 0,
    note: cartItem.note || null,
    available: cartItem.available !== false,
    lineTotal: fromMinor(cartItem.lineTotalMinor),
    lineTotalMinor: cartItem.lineTotalMinor ?? 0,
  };
}

/**
 * GET /guest/cart -> the shape CartProvider and the Cart page consume.
 * Prices always come from the server, so totals here are authoritative.
 */
export function toCartView(cart) {
  if (!cart || !Array.isArray(cart.kitchens)) return EMPTY_CART;

  const kitchens = [];
  const items = [];

  cart.kitchens.forEach((kitchen) => {
    if (!kitchen) return;

    const entries = (kitchen.items || [])
      .map((cartItem) => toCartLine(cartItem, kitchen))
      .filter(Boolean);

    if (entries.length === 0) return;

    const restaurant = entries[0].restaurant;

    kitchens.push({
      restaurantId: kitchen.restaurantId,
      restaurant,
      kitchenName: kitchen.kitchenName || "",
      entries,
      subtotal: fromMinor(kitchen.subtotalMinor),
      subtotalMinor: kitchen.subtotalMinor ?? 0,
    });

    items.push(...entries);
  });

  return {
    kitchens,
    items,
    itemCount: cart.itemCount ?? items.reduce((sum, entry) => sum + entry.qty, 0),
    subtotal: fromMinor(cart.grandTotalMinor),
    subtotalMinor: cart.grandTotalMinor ?? 0,
    restaurantCount: kitchens.length,
  };
}

/** Single source of the kitchen-level note for the checkout request. */
export function resolveSpecialInstructions({ orderInstruction, kitchenNotes, kitchens }) {
  if (orderInstruction && orderInstruction.trim()) return orderInstruction.trim();

  const notes = (kitchenNotes || {})
    .filter ? Object.values(kitchenNotes) : [];
  const joined = notes
    .filter((note) => typeof note === "string" && note.trim())
    .map((note) => note.trim())
    .join(" · ");

  if (joined) return joined.slice(0, 1000);

  if (kitchens && kitchens.length > 1) {
    return `Order placed for ${kitchens.length} kitchens.`;
  }

  return "";
}
