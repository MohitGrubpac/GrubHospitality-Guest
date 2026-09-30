import { toDisplayDate, toInitials } from "@/lib/adapters/shared";
import { toActiveOrder } from "@/lib/adapters/orderAdapter";

/**
 * GET /guests/me exists in two shapes:
 *
 * - flat:   { hotelName, reservationId, roomNumber, checkInAt, checkOutAt, hotel }
 * - nested: { stay: { hotelName, reservationId, roomNumber, checkInAt, checkOutAt },
 *             hotel, orders: [...] }
 *
 * Both are read here so the app works against either deployment. `stay` wins when
 * present, because it is the more specific (and newer) representation.
 */
export function toGuestUser(guest) {
  if (!guest) return null;

  const stay = guest.stay || null;
  const pick = (nestedKey, flatKey) => {
    const nested = stay?.[nestedKey];
    if (nested !== undefined && nested !== null && nested !== "") return nested;
    const flat = guest[flatKey];
    return flat === undefined || flat === null || flat === "" ? null : flat;
  };

  // `hotel.name` is the organization ("Hyatt Hotels"); `stay.hotelName` is the
  // property actually being stayed at ("Hyatt Place - Airport"). Orders report the
  // property, so that is what drives the UI.
  const propertyName = pick("hotelName", "hotelName") || guest.hotel?.name || "";
  const organizationName = guest.hotel?.name || guest.organizationName || "";

  const roomNumber = pick("roomNumber", "roomNumber") || "";
  const reservationId = pick("reservationId", "reservationId") || "";
  const checkInAt = pick("checkInAt", "checkInAt");
  const checkOutAt = pick("checkOutAt", "checkOutAt");

  return {
    id: guest.id,
    organizationId: guest.organizationId,
    status: guest.status,
    guestName: guest.name || "",
    name: guest.name || "",
    email: guest.email || "",
    mobile: guest.phone || "",
    phone: guest.phone || "",
    googleId: guest.googleId || null,

    hotel: propertyName,
    hotelName: propertyName,
    organizationName,
    location: propertyName,
    room: roomNumber,
    roomNumber,
    reservationId,

    checkInAt,
    checkOutAt,
    checkIn: toDisplayDate(checkInAt),
    checkOut: toDisplayDate(checkOutAt),

    avatarInitials: toInitials(guest.name),

    // Newer backends embed the guest's full order history (with line items) in the
    // profile, which removes the need to hydrate GET /guest/orders for the stay view.
    hasEmbeddedOrders: Array.isArray(guest.orders),
    orders: Array.isArray(guest.orders)
      ? guest.orders.map(toActiveOrder).filter(Boolean)
      : null,
  };
}

export function getInitials(name) {
  return toInitials(name);
}
