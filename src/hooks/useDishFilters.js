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
    (dish.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
}

/**
 * The API exposes no search or cuisine field, so dish search loads every kitchen menu
 * (see useDishSearch) and all filtering/sorting happens here, client-side.
 */
export function useDishFilters() {
  const filterDishes = useCallback(
    (dishes, { query, isVegOnly, cuisines, prices, dietary, sort } = {}) => {
      const result = (dishes || []).filter(
        (dish) =>
          matchesQuery(dish, query) &&
          (!isVegOnly || dish.isVeg === true) &&
          (dietary || []).every((tag) => matchesDietaryTag(dish, tag)) &&
          matchesCuisine(dish, cuisines || []) &&
          matchesPrice(dish, prices || []),
      );

      const sorted = [...result];
      if (sort === "price_low_high") {
        sorted.sort((a, b) => a.price - b.price);
      } else if (sort === "price_high_low") {
        sorted.sort((a, b) => b.price - a.price);
      }
      return sorted;
    },
    [],
  );

  /** Groups dishes under their kitchen for the "restaurant" tab. */
  const groupDishesByKitchen = useCallback((dishes, kitchens, query) => {
    const byKitchen = new Map();
    (dishes || []).forEach((dish) => {
      const list = byKitchen.get(dish.restaurantId) || [];
      list.push(dish);
      byKitchen.set(dish.restaurantId, list);
    });

    const q = (query || "").trim().toLowerCase();

    return (kitchens || [])
      .map((kitchen) => ({
        restaurant: kitchen,
        dishes: byKitchen.get(kitchen.id) || [],
      }))
      .filter((group) => {
        if (group.dishes.length === 0) return false;
        if (!q) return true;
        return (
          group.restaurant.name.toLowerCase().includes(q) ||
          (group.restaurant.hotelName || "").toLowerCase().includes(q)
        );
      });
  }, []);

  return { filterDishes, groupDishesByKitchen };
}
