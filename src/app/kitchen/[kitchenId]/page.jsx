"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/component/kitchen/BackButton";
import RestaurantCard from "@/component/kitchen/RestaurantCard";
import Divider from "@/component/kitchen/Divider";
import SearchBar from "@/component/kitchen/SearchBar";
import FilterButtons from "@/component/kitchen/FilterButtons";
import FilterModal, {
  DIETARY_OPTIONS,
  PRICE_OPTIONS,
  CUISINE_OPTIONS,
  getPriceRange,
} from "@/component/search/FilterModal";
import SortByModal from "@/component/search/SortByModal";
import MenuList from "@/component/kitchen/MenuList";
import MenuDetailModal from "@/component/kitchen/MenuDetailModal";
import { useKitchenMenu } from "@/hooks/useCatalog";

export default function KitchenPage() {
  const params = useParams();
  const router = useRouter();
  const kitchenId = params?.kitchenId;
  const { menu, isLoading, error } = useKitchenMenu(kitchenId);

  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState("relevance");
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [selectedPrices, setSelectedPrices] = useState([]);
  const [selectedCuisines, setSelectedCuisines] = useState([]);

  const categories = useMemo(
    () =>
      (menu?.categories || []).map((category) => ({
        id: category.id,
        name: category.name,
        count: category.items?.length || 0,
      })),
    [menu],
  );

  const handleSelectCategory = (categoryId) => {
    setActiveCategory(categoryId);
    document
      .getElementById(`category-${categoryId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredMenu = useMemo(() => {
    if (!menu) return [];

    let categories = menu.categories;

    // Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      categories = categories
        .map((category) => ({
          ...category,
          items: category.items.filter(
            (item) =>
              item.name.toLowerCase().includes(q) ||
              (item.description || "").toLowerCase().includes(q) ||
              (item.tags || []).some((tag) => String(tag ?? "").toLowerCase().includes(q)),
          ),
        }))
        .filter((category) => category.items.length > 0);
    }

    // Dietary filter
    if (selectedDietary.length > 0) {
      const wantVeg = selectedDietary.includes("Veg");
      const wantNonVeg = selectedDietary.includes("Non-Veg");

      categories = categories
        .map((category) => ({
          ...category,
          items:
            wantVeg && wantNonVeg
              ? category.items
              : category.items.filter((item) =>
                  wantVeg ? item.isVeg === true : item.isVeg === false,
                ),
        }))
        .filter((category) => category.items.length > 0);
    }

    // Price filter (prices are rupees, derived from the API minor units)
    if (selectedPrices.length > 0) {
      categories = categories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) =>
            selectedPrices.some((label) => {
              const range = getPriceRange(label);
              return range && item.price >= range.min && item.price <= range.max;
            }),
          ),
        }))
        .filter((category) => category.items.length > 0);
    }

    // Cuisine filter - the API has no cuisine field, so match the tags the kitchen
    // attaches to items plus the kitchen name.
    if (selectedCuisines.length > 0) {
      const haystack = `${menu.kitchenName || ""}`.toLowerCase();
      categories = categories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => {
            const text = [item.name, item.description, ...(item.tags || [])]
              .join(" ")
              .toLowerCase();
            return (
              haystack.includes(selectedCuisines.join(" ").toLowerCase()) ||
              selectedCuisines.some((cuisine) => text.includes(cuisine.toLowerCase()))
            );
          }),
        }))
        .filter((category) => category.items.length > 0);
    }

    // Sort each category's items
    return categories.map((category) => {
      const sorted = [...category.items];
      if (selectedSort === "price_low_high") {
        sorted.sort((a, b) => a.price - b.price);
      } else if (selectedSort === "price_high_low") {
        sorted.sort((a, b) => b.price - a.price);
      }
      return { ...category, items: sorted };
    });
  }, [menu, searchQuery, selectedDietary, selectedPrices, selectedCuisines, selectedSort]);

  if (!kitchenId) {
    return (
      <main className="w-full min-h-screen bg-[#F7F8FA] flex flex-col">
        <BackButton />
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
          <p className="text-[18px] font-medium text-[var(--gp-color-text-neutral-primary)]">
            Kitchen not found
          </p>
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="text-[16px] font-semibold text-[var(--gp-color-brand-primary)] cursor-pointer"
          >
            Back to kitchens
          </button>
        </div>
      </main>
    );
  }

  const isKitchenOffline = menu ? menu.kitchen?.status === "OFFLINE" : false;

  return (
    <div className="w-full h-screen bg-[#F7F8FA] flex flex-col items-center overflow-hidden">
      <div className="w-full max-w-[480px] sm:max-w-[768px] h-screen bg-[#F7F8FA] flex flex-col overflow-hidden relative">
        <div className="w-full shrink-0 bg-[#F7F8FA] z-40 border-b border-[#eff1f0]/60">
          <BackButton />
        </div>

        <main
          className="flex-1 overflow-y-auto flex flex-col pb-4"
          style={{ paddingBottom: "calc(var(--bottom-dock-h, 0px) + 16px)" }}
        >
          <div className="w-full">
            <RestaurantCard
              image={menu?.kitchen?.image}
              name={menu?.kitchenName || "Kitchen"}
              cuisines={menu?.kitchen?.hotelName ? [menu.kitchen.hotelName] : []}
              timing={isKitchenOffline ? "Closed" : "Open Now"}
              description={isKitchenOffline ? "This kitchen is not accepting orders right now." : ""}
              isOpen={Boolean(menu) && !isKitchenOffline}
            />
          </div>

          <Divider />

          {error && !menu ? (
            <div className="px-5 py-16 text-center text-sm text-[#b42318]">
              Could not load this menu. Please go back and try again.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-[12px]">
                <SearchBar value={searchQuery} onChange={setSearchQuery} />
                <FilterButtons
                  onOpenFilter={() => setIsFilterOpen(true)}
                  onOpenSort={() => setIsSortOpen(true)}
                  selectedDietary={selectedDietary}
                  onToggleDietary={(value) =>
                    setSelectedDietary((prev) =>
                      prev.includes(value)
                        ? prev.filter((dietary) => dietary !== value)
                        : [...prev, value],
                    )
                  }
                />
              </div>

              <div className="w-full px-[var(--gp-page-padding-x-regular)] pt-[var(--gp-page-padding-y-regular)] pb-[var(--gp-page-padding-y-regular)]">
                {isLoading && !menu ? (
                  <div className="flex flex-col gap-4">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="h-[182px] rounded-[8px] bg-[#eef0ef] animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <MenuList
                    menuData={filteredMenu}
                    categories={categories}
                    activeCategory={activeCategory}
                    onSelectCategory={handleSelectCategory}
                    onMenuItemClick={setSelectedItem}
                  />
                )}
              </div>
            </>
          )}

          <SortByModal
            isOpen={isSortOpen}
            onClose={() => setIsSortOpen(false)}
            selectedSort={selectedSort}
            onApplySort={setSelectedSort}
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

          {selectedItem && (
            <MenuDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
          )}
        </main>
      </div>
    </div>
  );
}
