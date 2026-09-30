import { fromMinor } from "@/lib/money";
import { formatDateTimeShort, formatTime12, formatTime24 } from "@/lib/date";
import { enrichMenuItem } from "@/lib/menu-cache";

export const ORDER_STATUS_LABELS = {
  SCHEDULED: "Scheduled",
  NEW: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_TONE = {
  SCHEDULED: "scheduled",
  NEW: "preparing",
  PREPARING: "preparing",
  READY: "preparing",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

const STEP_SEQUENCE = [
  { id: "accepted", title: "Order Accepted", doneFrom: ["NEW", "PREPARING", "READY", "DELIVERED"], subtitle: "Kitchen has your order" },
  { id: "prepared", title: "Order Prepared", doneFrom: ["PREPARING", "READY", "DELIVERED"], subtitle: "Being prepared now" },
  { id: "ready", title: "Order Ready", doneFrom: ["READY", "DELIVERED"], subtitle: "Ready for delivery" },
  { id: "delivery", title: "Order Delivery", doneFrom: ["DELIVERED"], subtitle: "On the way to your room" },
];

export function isTerminalStatus(status) {
  return status === "DELIVERED" || status === "CANCELLED";
}

export function isCancelled(status) {
  return status === "CANCELLED";
}

export function isDelivered(status) {
  return status === "DELIVERED";
}

/** Drives the timeline on the order status screen and the floating status panel. */
export function buildOrderSteps(status, order = {}) {
  const cancelled = isCancelled(status);
  const delivered = isDelivered(status);
  const scheduled = status === "SCHEDULED";

  const timestamp = formatTime12(order.placedAt);

  return STEP_SEQUENCE.map((step, index) => {
    if (cancelled && index === 0) {
      return {
        id: step.id,
        title: "Order Cancelled",
        subtitle: order.cancelReason || "This order was cancelled",
        done: false,
        cancelled: true,
        timestamp: formatTime12(order.cancelledAt) || timestamp,
      };
    }

    const done = !cancelled && step.doneFrom.includes(status);
    const isCurrent = !done && !cancelled && willAdvance(status, index);

    let subtitle = step.subtitle;
    if (scheduled && !done) {
      subtitle =
        index === 0
          ? "Waiting for the kitchen to accept"
          : "Starts shortly before your scheduled time";
    } else if (done && delivered) {
      subtitle = "Done";
    } else if (isCurrent) {
      subtitle = "In progress...";
    }

    return {
      id: step.id,
      title: step.title,
      subtitle,
      done,
      cancelled: false,
      timestamp: index === 0 ? timestamp : "",
    };
  });
}

function willAdvance(status, index) {
  if (status === "NEW") return index === 1;
  if (status === "PREPARING") return index === 2;
  if (status === "READY") return index === 3;
  return false;
}

function toOrderItem(orderItem) {
  const item = enrichMenuItem(orderItem.menuItemId, {
    id: orderItem.menuItemId,
    menuItemId: orderItem.menuItemId,
    name: orderItem.itemName || "",
    price: fromMinor(orderItem.unitPriceMinor),
    priceMinor: orderItem.unitPriceMinor ?? 0,
  });

  return {
    item,
    menuItemId: orderItem.menuItemId,
    name: orderItem.itemName || item.name,
    price: item.price,
    qty: orderItem.quantity ?? 0,
    note: orderItem.note || null,
  };
}

/**
 * GET /guest/orders/{orderId} and the POST /guest/cart/checkout response share the
 * same order shape, so both go through here.
 */
export function toActiveOrder(order) {
  if (!order) return null;

  const status = order.status || "NEW";

  return {
    id: order.id,
    orderCode: order.orderCode || "",
    orderId: order.orderCode || order.id,
    restaurantId: order.restaurantId,
    kitchenId: order.restaurantId,
    kitchenSlug: order.restaurantId,
    restaurantName: order.hotelName || "",
    guestId: order.guestId,
    guestName: order.guestName || "",
    roomNumber: order.roomNumber || "",
    hotelAddress: order.hotelAddress || "",
    status,
    statusLabel: ORDER_STATUS_LABELS[status] || status,
    statusTone: ORDER_STATUS_TONE[status] || "preparing",
    items: (order.items || []).map(toOrderItem),
    itemCount: (order.items || []).reduce((sum, entry) => sum + entry.qty, 0),
    totalAmount: fromMinor(order.totalMinor),
    totalMinor: order.totalMinor ?? 0,
    currency: order.currency || "INR",
    specialInstructions: order.specialInstructions || null,
    placedAt: order.placedAt || null,
    scheduledAt: order.scheduledAt || null,
    activationAt: order.activationAt || null,
    acceptedAt: order.acceptedAt || null,
    readyAt: order.readyAt || null,
    deliveredAt: order.deliveredAt || null,
    cancelledAt: order.cancelledAt || null,
    cancelReason: order.cancelReason || null,
    version: order.version ?? null,
    statusHistory: (order.statusHistory || []).map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      reason: entry.reason || null,
      changedBy: entry.changedBy || null,
      createdAt: entry.createdAt,
    })),
    time: formatTime24(order.placedAt),
    placedAtLabel: formatDateTimeShort(order.placedAt),
    steps: buildOrderSteps(status, order),
    isCancelled: isCancelled(status),
    isDelivered: isDelivered(status),
    isTerminal: isTerminalStatus(status),
  };
}

export function toActiveOrders(orders) {
  return (orders || []).map(toActiveOrder).filter(Boolean);
}

/** GET /guest/orders list rows (no item detail) merged with optional detail. */
export function toHistoryOrder(row, detail = null) {
  if (!row) return null;

  const status = row.status || detail?.status || "NEW";
  const items = detail?.items
    ? detail.items.map(toOrderItem)
    : [];

  return {
    id: row.id || detail?.id,
    orderCode: row.orderCode || detail?.orderCode || "",
    restaurantId: row.restaurantId || detail?.restaurantId || null,
    kitchenId: row.restaurantId || detail?.restaurantId || null,
    kitchenSlug: row.restaurantId || detail?.restaurantId || null,
    restaurantName: row.hotelName || detail?.hotelName || "",
    status,
    statusLabel: ORDER_STATUS_LABELS[status] || status,
    statusTone: ORDER_STATUS_TONE[status] || "preparing",
    items,
    itemCount: row.itemCount ?? detail?.itemCount ?? 0,
    moreCount: Math.max(0, items.length - 2),
    totalAmount: fromMinor(row.totalMinor ?? detail?.totalMinor ?? 0),
    currency: row.currency || detail?.currency || "INR",
    specialInstructions: detail?.specialInstructions || null,
    placedAt: row.placedAt || detail?.placedAt || null,
    time: formatDateTimeShort(row.placedAt || detail?.placedAt),
    cancellationReason: detail?.cancelReason || null,
    isCancelled: isCancelled(status),
    isDelivered: isDelivered(status),
    hasDetail: Boolean(detail),
  };
}

/** POST /guest/cart/checkout returns a bare array of orders. */
export function toCheckoutOrders(orders) {
  return (orders || []).map(toActiveOrder).filter(Boolean);
}
