"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import SearchInputBar from "@/component/search/SearchInputBar";
import SearchTabs from "@/component/search/SearchTabs";
import SearchFilterBar from "@/component/search/SearchFilterBar";
import DishCard from "@/component/search/DishCard";
import RestaurantDishGroupCard from "@/component/search/RestaurantDishGroupCard";
import SortByModal from "@/component/search/SortByModal";
import FilterModal, {
  CUISINE_OPTIONS,
  DIETARY_OPTIONS,
  PRICE_OPTIONS,
} from "@/component/search/FilterModal";
import DishDetailModal from "@/component/search/DishDetailModal";
import { useDishSearch, useKitchens } from "@/hooks/useCatalog";
import { useDishFilters } from "@/hooks/useDishFilters";

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") || "";

  const { dishes, isLoading } = useDishSearch();
  const { kitchens } = useKitchens();
  const { filterDishes, groupDishesByKitchen } = useDishFilters();

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("dishes");
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [selectedSort, setSelectedSort] = useState("relevance");
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [selectedPrices, setSelectedPrices] = useState([]);
  const [selectedDietary, setSelectedDietary] = useState([]);

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeDishModal, setActiveDishModal] = useState(null);

  const filteredDishes = useMemo(
    () =>
      filterDishes(dishes, {
        query,
        isVegOnly,
        cuisines: selectedCuisines,
        prices: selectedPrices,
        dietary: selectedDietary,
        sort: selectedSort,
      }),
    [
      filterDishes,
      dishes,
      query,
      isVegOnly,
      selectedCuisines,
      selectedPrices,
      selectedDietary,
      selectedSort,
    ],
  );

  const restaurantGroups = useMemo(
    () => groupDishesByKitchen(filteredDishes, kitchens, query),
    [groupDishesByKitchen, filteredDishes, kitchens, query],
  );

  const isEmptyResult = !isLoading && filteredDishes.length === 0;

  return (
    <div className="w-full h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-white h-screen shadow-sm flex flex-col overflow-hidden relative">
        <div className="shrink-0 px-5 pt-3 pb-3 bg-white border-b border-[#eff1f0]/60 flex flex-col gap-4 z-40">
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
            <h1 className="text-lg font-bold text-[#03130a] truncate">
              Results for &ldquo;{query || "all dishes"}&rdquo;
            </h1>
          </div>

          <SearchInputBar
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            isVegOnly={isVegOnly}
            onToggleVeg={() => setIsVegOnly(!isVegOnly)}
            placeholder="Search dish or kitchen"
          />

          <SearchTabs activeTab={activeTab} onSelectTab={setActiveTab} />

          <SearchFilterBar
            onOpenFilter={() => setIsFilterOpen(true)}
            onOpenSort={() => setIsSortOpen(true)}
          />
        </div>

        {/* Scrollable Tab Content Area */}
        <main className="flex-1 px-5 pt-4 pb-20 flex flex-col gap-4 overflow-y-auto bg-[#f7f8fa]">
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="text-center py-12 text-sm text-[#6b7971]">Loading menus...</div>
            ) : activeTab === "dishes" ? (
              filteredDishes.length > 0 ? (
                filteredDishes.map((dish) => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    onSelectDish={(item) => setActiveDishModal(item)}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-sm text-[#6b7971]">
                  {isEmptyResult
                    ? `No dishes found matching \u201c${query}\u201d`
                    : "No dishes available right now."}
                </div>
              )
            ) : restaurantGroups.length > 0 ? (
              restaurantGroups.map((group) => (
                <RestaurantDishGroupCard
                  key={group.restaurant.id}
                  restaurant={group.restaurant}
                  dishes={group.dishes}
                  onSelectDish={(item) => setActiveDishModal(item)}
                />
              ))
            ) : (
              <div className="text-center py-12 text-sm text-[#6b7971]">
                No kitchens found matching &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        </main>

        {/* Modals */}
        <SortByModal
          isOpen={isSortOpen}
          onClose={() => setIsSortOpen(false)}
          selectedSort={selectedSort}
          onApplySort={(sortId) => setSelectedSort(sortId)}
        />

        <FilterModal
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          sections={[
            { id: "PRICE", label: "PRICE", options: PRICE_OPTIONS },
            { id: "DIETARY", label: "DIETARY", options: DIETARY_OPTIONS },
            { id: "CUISINES", label: "CUISINES", options: CUISINE_OPTIONS },
          ]}
          selections={{
            PRICE: selectedPrices,
            DIETARY: selectedDietary,
            CUISINES: selectedCuisines,
          }}
          onApplyFilters={(selections) => {
            setSelectedPrices(selections.PRICE || []);
            setSelectedDietary(selections.DIETARY || []);
            setSelectedCuisines(selections.CUISINES || []);
          }}
        />

        <DishDetailModal
          isOpen={Boolean(activeDishModal)}
          dish={activeDishModal}
          onClose={() => setActiveDishModal(null)}
        />
      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading search results...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}
