"use client";

import { useCallback } from "react";

const NUT_TERMS = ["nut", "peanut", "cashew", "walnut", "almond"];
const SUGAR_TERMS = ["sugar", "syrup", "honey", "caramel"];
const DAIRY_TERMS = ["cheese", "butter", "milk", "cream", "yogurt", "paneer", "ghee"];

function textOf(dish) {
  return [dish.name, dish.description, ...(dish.tags || [])].join(" ").toLowerCase();
}

function matchesDietaryTag(dish, tag) {
  if (tag === "Veg") return dish.isVeg === true;
  if (tag === "Non-Veg") return dish.isVeg === false;

  const text = textOf(dish);

  switch (tag) {
    case "Nut Free":
      return !NUT_TERMS.some((term) => text.includes(term));
    case "No Refined sugar":
      return !SUGAR_TERMS.some((term) => text.includes(term));
    case "Dairy free":
      return !DAIRY_TERMS.some((term) => text.includes(term));
    case "Low Calories":
      return text.includes("low calorie") || text.includes("light") || dish.price < 500;
    default:
      return true;
  }
}

function matchesCuisine(dish, cuisines) {
  if (cuisines.length === 0) return true;

  const haystack = `${dish.kitchenName || ""} ${(dish.tags || []).join(" ")}`.toLowerCase();
  return cuisines.some((cuisine) => haystack.includes(cuisine.toLowerCase()));
}

function matchesPrice(dish, priceRanges) {
  if (priceRanges.length === 0) return true;
  return priceRanges.some((range) => dish.price >= range.min && dish.price <= range.max);
}

function matchesQuery(dish, query) {
  if (!query) return true;

  const q = query.trim().toLowerCase();
  return (
    dish.name.toLowerCase().includes(q) ||
    (dish.kitchenName || "").toLowerCase().includes(q) ||
    (dish.description || "").toLowerCase().includes(q) ||
    (dish.tags || []).some((tag) => String(tag ?? "").toLowerCase().includes(q))
  );
}

/**
 * The API exposes no search or cuisine field, so dish search loads every kitchen menu
 * (see useDishSearch) and all filtering/sorting happens here, client-side.
 */
export function useDishFilters() {
  const filterDishes = useCallback(
    (dishes, { query, isVegOnly, cuisines, prices, dietary, sort, minRating } = {}) => {
      const result = (dishes || []).filter(
        (dish) =>
          matchesQuery(dish, query) &&
          (!isVegOnly || dish.isVeg === true) &&
          (dietary || []).every((tag) => matchesDietaryTag(dish, tag)) &&
          matchesCuisine(dish, cuisines || []) &&
          matchesPrice(dish, prices || []) &&
          (!minRating || (typeof dish.rating === "number" && dish.rating >= minRating)),
      );

      const sorted = [...result];
      if (sort === "price_low_high") {
        sorted.sort((a, b) => a.price - b.price);
      } else if (sort === "price_high_low") {
        sorted.sort((a, b) => b.price - a.price);
      } else if (sort === "rating_high_low") {
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sort === "rating_low_high") {
        sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      }
      return sorted;
    },
    [],
  );

  /**
   * Groups dishes under their kitchen for the "restaurant" tab.
   * Dishes arrive already query-filtered (see filterDishes), so a kitchen is
   * relevant when it has at least one matching dish — kitchen-name matching is
   * already covered by matchesQuery via dish.kitchenName.
   */
  const groupDishesByKitchen = useCallback((dishes, kitchens) => {
    const byKitchen = new Map();
    (dishes || []).forEach((dish) => {
      const list = byKitchen.get(dish.restaurantId) || [];
      list.push(dish);
      byKitchen.set(dish.restaurantId, list);
    });

    return (kitchens || [])
      .map((kitchen) => ({
        restaurant: kitchen,
        dishes: byKitchen.get(kitchen.id) || [],
      }))
      .filter((group) => group.dishes.length > 0);
  }, []);

  return { filterDishes, groupDishesByKitchen };
}
