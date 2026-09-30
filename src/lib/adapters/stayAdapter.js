import { formatDateRange, formatDateTimeShort, toDate } from "@/lib/date";
import { fromMinor } from "@/lib/money";

/**
 * List rows from GET /guest/orders only carry `totalMinor`; the hydrated entries also
 * carry a converted `totalAmount`. Accept either so the summary works from both.
 */
function orderAmount(order) {
  if (typeof order?.totalAmount === "number") return order.totalAmount;
  return fromMinor(order?.totalMinor ?? 0);
}

/** Stay status derived from the profile's own check-in / check-out instants. */
export function stayStatusLabel(checkInAt, checkOutAt) {
  if (!checkInAt) return "No active stay";

  const now = Date.now();
  const checkIn = toDate(checkInAt);
  const checkOut = toDate(checkOutAt);

  if (checkIn && now < checkIn.getTime()) return "Upcoming";
  if (checkOut && now > checkOut.getTime()) return "Completed";
  return "Current Stay";
}

/**
 * The API has no "stays" endpoint - the guest profile is the stay. Orders are the
 * ones placed inside the stay window; a small grace period covers late check-out day.
 */
export function isOrderInStay(order, checkInAt, checkOutAt) {
  const checkIn = toDate(checkInAt);
  const checkOut = toDate(checkOutAt);

  // Without both bounds we cannot scope by date, so everything is in scope.
  if (!checkIn || !checkOut) return true;

  const GRACE_MS = 24 * 60 * 60 * 1000;
  const placed = toDate(order?.placedAt);
  if (!placed) return false;

  const at = placed.getTime();
  return at >= checkIn.getTime() - GRACE_MS && at <= checkOut.getTime() + GRACE_MS;
}

export function filterOrdersToStay(orders, checkInAt, checkOutAt) {
  return (orders || []).filter((order) => isOrderInStay(order, checkInAt, checkOutAt));
}

function toStayOrder(order) {
  return {
    id: order.id,
    orderCode: order.orderCode,
    restaurantName: order.restaurantName,
    // Orders reach here from two paths (profile-embedded or the orders endpoint),
    // which label dates differently, so normalise to a date+time string.
    time: order.placedAtLabel || formatDateTimeShort(order.placedAt) || order.time || "",
    placedAt: order.placedAt,
    status: order.statusLabel,
    statusTone: order.statusTone,
    items: (order.items || []).map((line) => ({
      name: line.name,
      qty: line.qty,
      isVeg: line.item?.isVeg ?? null,
      price: line.price,
    })),
    moreCount: order.moreCount,
    totalAmount: order.totalAmount,
    totalMinor: order.totalMinor,
    currency: order.currency,
    itemCount: order.itemCount,
  };
}

/**
 * Builds the single live stay from GET /guests/me + GET /guest/orders.
 *
 * `rows` (the un-hydrated GET /guest/orders items) drives the count and spend so
 * this stays a single request, while `orders` (each hydrated with its line items)
 * only feeds the expandable list.
 */
export function buildStays(guest, orders, rows) {
  if (!guest) return [];

  const status = stayStatusLabel(guest.checkInAt, guest.checkOutAt);
  const stayOrders = filterOrdersToStay(orders, guest.checkInAt, guest.checkOutAt);
  const summaryRows = filterOrdersToStay(
    rows && rows.length > 0 ? rows : orders,
    guest.checkInAt,
    guest.checkOutAt,
  );

  return [
    {
      id: guest.id,
      dates: formatDateRange(guest.checkInAt, guest.checkOutAt),
      status,
      isCurrent: status === "Current Stay",
      hotelName: guest.hotelName,
      roomNumber: guest.roomNumber,
      reservationId: guest.reservationId,
      checkInAt: guest.checkInAt,
      checkOutAt: guest.checkOutAt,
      totalOrders: summaryRows.length,
      totalAmount: summaryRows.reduce((sum, order) => sum + orderAmount(order), 0),
      orders: stayOrders.map(toStayOrder),
    },
  ];
}
