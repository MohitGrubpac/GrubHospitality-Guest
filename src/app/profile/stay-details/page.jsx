"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import StayCard from "@/component/profile/StayCard";
import { useRoom } from "@/component/providers/RoomProvider";
import { useGuestOrders } from "@/hooks/useOrders";
import { useAuth } from "@/component/providers/AuthProvider";
import { buildStays, isDeliveredOrder, isOrderInStay } from "@/lib/adapters/stayAdapter";

/**
 * The API has no "stays" endpoint. The stay is the guest profile itself
 * (GET /guests/me) and its spend is derived from the guest's orders.
 *
 * Newer backends embed the whole order history in the profile, so that is preferred
 * and costs zero extra requests. Older ones are covered by GET /guest/orders, where
 * only the orders inside the stay window are hydrated.
 */
export default function StayDetailsPage() {
  const router = useRouter();
  const { guest, refetchProfile, isLoading: isProfileLoading } = useAuth();
  const { selectedRoom } = useRoom();

  // Re-read the profile so the stay reflects orders placed since sign-in.
  // Keyed on the guest id (not the object) - refetchProfile replaces the guest
  // object, so depending on it would refetch on every render.
  const guestId = guest?.id;
  useEffect(() => {
    if (!guestId) return undefined;

    let cancelled = false;
    refetchProfile().catch(() => {
      /* keep whatever the bootstrap already gave us */
    });

    return () => {
      cancelled = true;
    };
  }, [guestId, refetchProfile]);

  const embeddedOrders = guest?.orders ?? null;

  // Only delivered orders inside the stay window are listed, so only those are
  // hydrated with their line items.
  const hydrateFilter = useCallback(
    (row) => isOrderInStay(row, guest?.checkInAt, guest?.checkOutAt) && isDeliveredOrder(row),
    [guest?.checkInAt, guest?.checkOutAt],
  );

  const { rows, orders, isLoading: areOrdersLoading } = useGuestOrders({
    hydrateFilter,
    enabled: !embeddedOrders,
  });

  const stays = useMemo(
    () =>
      buildStays(guest, embeddedOrders || orders, embeddedOrders || rows).map((stay) => ({
        ...stay,
        // Show the room the guest has deliveries going to, not just the first booked.
        roomNumber: stay.roomNumbers?.length > 1 ? selectedRoom : stay.roomNumber,
        roomNumbers: stay.roomNumbers,
      })),
    [guest, embeddedOrders, orders, rows, selectedRoom],
  );

  const isLoading = isProfileLoading || (!embeddedOrders && areOrdersLoading);

  return (
    <div className="w-full h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden font-sans">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-[#f7f8fa] h-screen shadow-sm flex flex-col overflow-hidden relative pb-8">
        <header className="w-full px-5 py-4 bg-white border-b border-[#eff1f0] flex items-center gap-3 shrink-0 z-40">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <Image
              src="/restaurant/back.svg"
              alt="Back"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
              sizes="20px"
            />
          </button>
          <h1 className="text-lg font-bold text-[#03130a]">Stay Details</h1>
        </header>

        <main className="flex-1 px-5 pt-4 pb-12 flex flex-col gap-4 overflow-y-auto">
          {isLoading && !guest ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#fe480b] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !guest ? (
            <p className="text-sm text-[#6B7971] italic text-center py-12">
              We couldn&rsquo;t load your stay details.
            </p>
          ) : (
            stays.map((stay) => <StayCard key={stay.id} stay={stay} />)
          )}
        </main>
      </div>
    </div>
  );
}
