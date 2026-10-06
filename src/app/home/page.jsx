"use client";

import { useMemo, useState } from "react";
import HomeHeroBanner from "@/component/Home/HomeHeroBanner";
import HomeSearchBar from "@/component/Home/HomeSearchBar";
import HomeScheduleBanner from "@/component/Home/HomeScheduleBanner";
import RestaurantListSection from "@/component/Home/RestaurantListSection";
import HomeSkeleton from "@/component/Home/HomeSkeleton";
import { useAuth } from "@/component/providers/AuthProvider";
import { useRoom } from "@/component/providers/RoomProvider";
import { useKitchens } from "@/hooks/useCatalog";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { guest } = useAuth();
  const { selectedRoom } = useRoom();
  const { kitchens, isLoading, error } = useKitchens();

  const user = guest
    ? { ...guest, room: selectedRoom || guest.room }
    : null;

  const filteredKitchens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return kitchens;

    return kitchens.filter(
      (kitchen) =>
        kitchen.name.toLowerCase().includes(q) ||
        (kitchen.hotelName || "").toLowerCase().includes(q) ||
        (kitchen.code || "").toLowerCase().includes(q),
    );
  }, [kitchens, searchQuery]);

  if (isLoading && kitchens.length === 0) {
    return <HomeSkeleton />;
  }

  return (
    <div className="w-full min-h-screen bg-[#f8faf9] flex flex-col items-center select-none">
      <div
        className="w-full max-w-[480px] sm:max-w-[768px] min-h-screen shadow-sm flex flex-col"
        style={{ paddingBottom: "calc(var(--bottom-dock-h, 0px) + 24px)" }}
      >
        <main className="flex-1 px-5 pt-4 flex flex-col gap-5 bg-[#f7f8fa] mt-2">
          <HomeHeroBanner user={user} />
          <HomeSearchBar
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search kitchens"
          />

          <HomeScheduleBanner />

          {error && !kitchens.length ? (
            <div className="text-center py-12 text-sm text-[#b42318]">
              Could not load kitchens. Pull to refresh or try again shortly.
            </div>
          ) : (
            <RestaurantListSection
              restaurants={filteredKitchens}
              searchQuery={searchQuery}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>
    </div>
  );
}
