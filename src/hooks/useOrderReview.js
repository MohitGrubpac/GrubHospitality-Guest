"use client";

import { useAuth } from "@/component/providers/AuthProvider";

/**
 * The review a guest already gave an order, read straight from the server: order
 * rows may carry `review` themselves, and GET /guests/me embeds it on every
 * order. Feedback is no longer mirrored in localStorage, so this is the single
 * source of truth for the stay cards, the history cards and the feedback screen.
 *
 * Accepts either an adapted order object or a bare order id.
 */
export function useOrderReview(orderOrId) {
  const { guest } = useAuth();

  const order = typeof orderOrId === "object" && orderOrId !== null ? orderOrId : null;
  if (order?.review) return order.review;

  const orderId = order?.id || (typeof orderOrId === "string" ? orderOrId : null);
  if (!orderId || !Array.isArray(guest?.orders)) return null;

  const embedded = guest.orders.find((entry) => entry && entry.id === orderId);
  return embedded?.review || null;
}
