import { apiClient } from "@/lib/api-client";

export const ORDER_STATUS = {
  SCHEDULED: "SCHEDULED",
  NEW: "NEW",
  PREPARING: "PREPARING",
  READY: "READY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

/**
 * GET /guest/orders accepts `status` and nothing else.
 *
 * The published contract documents `page` and `limit`, but the deployed API validates
 * the query string against a strict allow-list and answers any other key with a bare
 * 400 ("page must not be less than 1, page must be an integer number, limit must not
 * be greater than 100, ..."). So the only parameter we send is `status`; paging is
 * left to the server default and any truncation is reported via `total`.
 */
export function listGuestOrders({ status } = {}) {
  const query = {};

  if (status && Object.values(ORDER_STATUS).includes(status)) {
    query.status = status;
  }

  return apiClient.get("/guest/orders", { query });
}

/** GET /guest/orders/{orderId} */
export function getGuestOrder(orderId) {
  return apiClient.get(`/guest/orders/${encodeURIComponent(orderId)}`);
}
