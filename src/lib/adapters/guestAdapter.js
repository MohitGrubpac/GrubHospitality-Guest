import { toDisplayDate, toInitials } from "@/lib/adapters/shared";
import { toActiveOrder } from "@/lib/adapters/orderAdapter";

/**
 * GET /guests/me exists in two shapes:
 *
 * - flat:   { hotelName, reservationId, roomNumber, checkInAt, checkOutAt, hotel }
 * - nested: { stay: { hotelName, reservationId, roomNumbers[], checkInAt, checkOutAt },
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

  /**
   * Rooms come back as `stay.roomNumbers: string[]` on the current API, since one
   * reservation can cover several rooms. Older payloads carried a single
   * `roomNumber`, so both are accepted.
   */
  const toRoomNumbers = () => {
    const list = stay?.roomNumbers ?? guest.roomNumbers;
    if (Array.isArray(list)) {
      return list.map((room) => String(room).trim()).filter(Boolean);
    }
    const single = stay?.roomNumber ?? guest.roomNumber;
    return single ? [String(single).trim()] : [];
  };

  // `hotel.name` is the organization ("Hyatt Hotels"); `stay.hotelName` is the
  // property actually being stayed at ("Hyatt Place - Airport"). Orders report the
  // property, so that is what drives the UI.
  const propertyName = pick("hotelName", "hotelName") || guest.hotel?.name || "";
  const organizationName = guest.hotel?.name || guest.organizationName || "";
  // Where the property is: `hotel.address` on the profile, with legacy
  // `hotelAddress` copies and the guest's orders as fallbacks.
  const hotelAddress =
    guest.hotel?.address ||
    guest.hotel?.hotelAddress ||
    stay?.hotelAddress ||
    guest.hotelAddress ||
    (Array.isArray(guest.orders) ? guest.orders.find((order) => order?.hotelAddress)?.hotelAddress : null) ||
    "";

  const reservationId = pick("reservationId", "reservationId") || "";
  const checkInAt = pick("checkInAt", "checkInAt");
  const checkOutAt = pick("checkOutAt", "checkOutAt");

  const roomNumbers = toRoomNumbers();

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

    // Banner headline: the hotel group (`hotel.name`), e.g. "Hyatt Hotels".
    hotel: organizationName || propertyName,
    hotelName: propertyName,
    organizationName,
    // Banner sub-line: the property's address, e.g. "JanakPuri".
    location: hotelAddress,
    hotelAddress,

    // A guest can hold several rooms on one reservation. The profile is the source
    // of truth for which ones; which one an order goes to is chosen on the device.
    roomNumbers,
    isMultipleRooms: roomNumbers.length > 1,
    // First booked room, used as the display default before a choice is made.
    room: roomNumbers[0] || "",
    roomNumber: roomNumbers[0] || "",

    reservationId,

    checkInAt,
    checkOutAt,
    checkIn: toDisplayDate(checkInAt),
    checkOut: toDisplayDate(checkOutAt),
    organizationName,

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
