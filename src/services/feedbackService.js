import { apiClient } from "@/lib/api-client";

/**
 * POST /guest/reviews - contract carries the order-level ratings plus the
 * comment and per-dish ratings:
 * { orderId, orderRating, foodRating, comment,
 *   items: [{ menuItemId, itemName, rating }...] } with 1..50 entries.
 */
export function recordFeedback({ orderId, orderRating, foodRating, comment, items }) {
  return apiClient.post("/guest/reviews", {
    orderId,
    orderRating,
    foodRating,
    comment,
    items,
  });
}
