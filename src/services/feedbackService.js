import { ApiError, apiClient } from "@/lib/api-client";

/**
 * POST /guest/feedback - contract carries the order-level rating/review plus
 * per-dish ratings:
 * { restaurantId, orderId?, guestName?, rating, review,
 *   items: [{ menuItemId, rating }...] } with 1..50 entries.
 */
export function recordFeedback({ restaurantId, orderId, guestName, rating, review, items }) {
  return apiClient.post("/guest/feedback", {
    restaurantId,
    orderId,
    guestName,
    rating,
    review,
    items,
  });
}

/**
 * Flat per-dish body - automatic fallback for deployments whose DTO still
 * forbids `items` (400 "property items should not exist") and validates a
 * top-level integer rating between 1 and 5.
 */
export function recordFeedbackFlat({ restaurantId, orderId, menuItemId, guestName, rating, review }) {
  return apiClient.post("/guest/feedback", {
    restaurantId,
    orderId,
    menuItemId,
    guestName,
    rating,
    review,
  });
}

/** True when a 400 shows the server validated the flat DTO, not the batch one. */
export function isBatchRejected(error) {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    /should not exist|rating must/i.test(error.message || "")
  );
}
