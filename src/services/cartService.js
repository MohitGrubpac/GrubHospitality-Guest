import { apiClient } from "@/lib/api-client";

export const MAX_CART_QUANTITY = 99;

/** GET /guest/cart - created server-side on first call */
export function getCart() {
  return apiClient.get("/guest/cart");
}

/** POST /guest/cart/items */
export function addCartItem({ menuItemId, quantity = 1, note = null }) {
  return apiClient.post("/guest/cart/items", {
    menuItemId,
    quantity: clampQuantity(quantity, 1),
    ...(note ? { note } : {}),
  });
}

/** PATCH /guest/cart/items/{menuItemId} - quantity 0 removes the line */
export function updateCartItem(menuItemId, { quantity, note }) {
  return apiClient.patch(`/guest/cart/items/${encodeURIComponent(menuItemId)}`, {
    quantity: clampQuantity(quantity, 0),
    ...(note !== undefined ? { note } : {}),
  });
}

/** DELETE /guest/cart/items/{menuItemId} */
export function removeCartItem(menuItemId) {
  return apiClient.delete(`/guest/cart/items/${encodeURIComponent(menuItemId)}`);
}

/** DELETE /guest/cart */
export function clearCart() {
  return apiClient.delete("/guest/cart");
}

/** POST /guest/cart/checkout - returns one order per kitchen */
export function checkoutGuestCart({ specialInstructions, roomNumber, scheduledAt } = {}) {
  return apiClient.post("/guest/cart/checkout", {
    ...(specialInstructions ? { specialInstructions } : {}),
    ...(roomNumber ? { roomNumber: String(roomNumber) } : {}),
    ...(scheduledAt ? { scheduledAt } : {}),
  });
}

function clampQuantity(value, fallback) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return fallback;
  return Math.min(MAX_CART_QUANTITY, Math.max(fallback === 1 ? 1 : 0, Math.round(quantity)));
}
