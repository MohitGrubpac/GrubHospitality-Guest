"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import HomeSearchBar from "@/component/Home/HomeSearchBar";
import RestaurantCard from "@/component/Home/RestaurantCard";
import { useKitchens } from "@/hooks/useCatalog";

export default function RestaurantListPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { kitchens, isLoading, error } = useKitchens();

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

  return (
    <div className="w-full h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-white h-screen shadow-sm flex flex-col overflow-hidden relative">
        <div className="shrink-0 px-5 pt-4 pb-3 flex flex-col gap-4 bg-white border-b border-[#eff1f0]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Go back"
            >
              <Image
                src="/restaurant/back.svg"
                alt="Back"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            </button>
            <h1 className="text-lg font-semibold text-[#03130a]">Kitchens</h1>
          </div>

          <HomeSearchBar
            placeholder="Search Kitchen"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {/* Restaurant Listing - scrollable area */}
        <div
          className="bg-[#f7f8fa] flex-1 px-5 py-4 flex flex-col gap-4 overflow-y-auto"
          style={{ paddingBottom: "calc(var(--bottom-dock-h, 0px) + 24px)" }}
        >
          <div className="flex flex-col gap-4">
            {error && !kitchens.length ? (
              <div className="text-center py-12 text-sm text-[#b42318]">
                Could not load kitchens. Please try again.
              </div>
            ) : isLoading && !kitchens.length ? (
              <div className="text-center py-12 text-sm text-[#6b7971]">Loading kitchens...</div>
            ) : filteredKitchens.length > 0 ? (
              filteredKitchens.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))
            ) : (
              <div className="text-center py-12 text-sm text-[#6b7971]">
                No kitchens found matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
