"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, AUTH_STATUS } from "@/component/providers/AuthProvider";
import { ApiError } from "@/lib/api-client";
import { rememberMenu, rememberMenuItems } from "@/lib/menu-cache";
import { buildDishIndex, toMenu, toRestaurantCards } from "@/lib/adapters/catalogAdapter";
import * as catalogService from "@/services/catalogService";

const EMPTY = { kitchens: [], total: 0, loaded: false, error: null };

/**
 * State carries the query key it belongs to, so a change of key resets the view
 * during render instead of resetting state from inside an effect.
 */
function selectByKey(state, key) {
  return state.key === key ? state : { key, ...EMPTY };
}

/** GET /guest/kitchens */
export function useKitchens() {
  const { status } = useAuth();
  const isAuthenticated = status === AUTH_STATUS.AUTHENTICATED;
  const [state, setState] = useState({ key: null, ...EMPTY });

  const view = isAuthenticated ? selectByKey(state, "kitchens") : { key: "kitchens", ...EMPTY };

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;

    catalogService
      .listGuestKitchens()
      .then((raw) => {
        if (cancelled) return;
        setState({ key: "kitchens", kitchens: toRestaurantCards(raw), total: raw?.length ?? 0, loaded: true, error: null });
      })
      .catch((kitchensError) => {
        if (cancelled) return;
        if (kitchensError instanceof ApiError && kitchensError.isUnauthorized) {
          setState({ key: "kitchens", ...EMPTY });
          return;
        }
        setState({ key: "kitchens", ...EMPTY, error: kitchensError });
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) return [];
    try {
      const raw = await catalogService.listGuestKitchens();
      const kitchens = toRestaurantCards(raw);
      setState({ key: "kitchens", kitchens, total: kitchens.length, loaded: true, error: null });
      return kitchens;
    } catch (kitchensError) {
      setState({ key: "kitchens", ...EMPTY, error: kitchensError });
      return [];
    }
  }, [isAuthenticated]);

  return {
    kitchens: view.kitchens,
    isLoading: isAuthenticated && !view.loaded,
    error: view.error,
    refetch,
  };
}

/** GET /guest/kitchens/{kitchenId}/menu */
export function useKitchenMenu(kitchenId) {
  const key = kitchenId || "none";
  const [state, setState] = useState({ key: null, menu: null, loaded: false, error: null });

  const view = selectByKey(state, key);

  useEffect(() => {
    if (!kitchenId) return undefined;

    let cancelled = false;

    catalogService
      .getGuestKitchenMenu(kitchenId)
      .then((raw) => {
        if (cancelled) return;
        const menu = toMenu(raw);
        if (menu) rememberMenu(kitchenId, menu.categories);
        setState({ key, menu, loaded: true, error: null });
      })
      .catch((menuError) => {
        if (cancelled) return;
        if (menuError instanceof ApiError && menuError.isUnauthorized) {
          setState({ key, menu: null, loaded: true, error: null });
          return;
        }
        setState({ key, menu: null, loaded: true, error: menuError });
      });

    return () => {
      cancelled = true;
    };
  }, [kitchenId, key]);

  const refetch = useCallback(async () => {
    if (!kitchenId) return null;
    try {
      const raw = await catalogService.getGuestKitchenMenu(kitchenId);
      const menu = toMenu(raw);
      if (menu) rememberMenu(kitchenId, menu.categories);
      setState({ key, menu, loaded: true, error: null });
      return menu;
    } catch (menuError) {
      setState({ key, menu: null, loaded: true, error: menuError });
      return null;
    }
  }, [kitchenId, key]);

  return {
    menu: view.menu,
    isLoading: Boolean(kitchenId) && !view.loaded,
    error: view.error,
    refetch,
  };
}

/**
 * The API has no cross-kitchen search endpoint, so dish search loads every kitchen
 * menu once and filters locally. Items land in the menu cache so cart and order rows
 * can be enriched with the veg/image data the cart endpoints do not return.
 */
export function useDishSearch(enabled = true) {
  const { status } = useAuth();
  const isAuthenticated = status === AUTH_STATUS.AUTHENTICATED;
  const key = enabled && isAuthenticated ? "dishes" : "none";
  const [state, setState] = useState({ key: null, dishes: [], loaded: false, error: null });

  const view = selectByKey(state, key);

  useEffect(() => {
    if (!enabled || !isAuthenticated) return undefined;

    let cancelled = false;

    const run = async () => {
      try {
        const rawKitchens = await catalogService.listGuestKitchens();
        const kitchens = toRestaurantCards(rawKitchens);

        const menus = await Promise.all(
          kitchens.map(async (kitchen) => {
            try {
              const raw = await catalogService.getGuestKitchenMenu(kitchen.id);
              const menu = toMenu(raw);
              if (menu) rememberMenu(kitchen.id, menu.categories);
              return menu;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        const menus2 = menus.filter(Boolean);
        menus2.forEach((menu) => rememberMenuItems(menu.kitchenId, menu.items));
        setState({ key, dishes: buildDishIndex(menus2), loaded: true, error: null });
      } catch (searchError) {
        if (cancelled) return;
        if (searchError instanceof ApiError && searchError.isUnauthorized) {
          setState({ key, dishes: [], loaded: true, error: null });
          return;
        }
        setState({ key, dishes: [], loaded: true, error: searchError });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [enabled, isAuthenticated, key]);

  return {
    dishes: view.dishes,
    isLoading: key === "dishes" && !view.loaded,
    error: view.error,
  };
}
