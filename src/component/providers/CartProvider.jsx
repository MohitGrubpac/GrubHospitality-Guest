"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { showError } from "@/component/ui/Toast";
import { AUTH_STATUS, useAuth } from "@/component/providers/AuthProvider";
import { ApiError } from "@/lib/api-client";
import { EMPTY_CART, resolveSpecialInstructions, toCartView } from "@/lib/adapters/cartAdapter";
import * as cartService from "@/services/cartService";

const CartContext = createContext(null);

/**
 * The cart lives on the server (GET/POST/PATCH/DELETE /guest/cart). Every mutation
 * returns the full updated cart, which replaces local state - so prices and totals
 * shown in the UI are always the ones the server will charge.
 */
export function CartProvider({ children }) {
  const { status } = useAuth();
  const isAuthenticated = status === AUTH_STATUS.AUTHENTICATED;

  const [rawCart, setRawCart] = useState(null);
  const [mutatingId, setMutatingId] = useState(null);
  const [error, setError] = useState(null);

  // Guards against out-of-order responses when the user taps quickly.
  const requestRef = useRef(0);

  // Signed out -> nothing to show, without needing to reset state from an effect.
  const cart = isAuthenticated && rawCart ? toCartView(rawCart) : EMPTY_CART;

  // The first server read has not landed yet.
  const isLoading = isAuthenticated && rawCart === null;

  const applyCart = useCallback((raw) => {
    setRawCart(raw);
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;

    const requestId = ++requestRef.current;

    try {
      const raw = await cartService.getCart();
      if (requestId !== requestRef.current) return;
      applyCart(raw);
      setError(null);
    } catch (cartError) {
      if (requestId !== requestRef.current) return;
      if (!(cartError instanceof ApiError && cartError.isUnauthorized)) {
        setError(cartError);
      }
    }
  }, [isAuthenticated, applyCart]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const requestId = ++requestRef.current;
    let cancelled = false;

    cartService
      .getCart()
      .then((raw) => {
        if (cancelled || requestId !== requestRef.current) return;
        setRawCart(raw);
        setError(null);
      })
      .catch((cartError) => {
        if (cancelled || requestId !== requestRef.current) return;
        if (!(cartError instanceof ApiError && cartError.isUnauthorized)) {
          setError(cartError);
        }
      });

    return () => {
      cancelled = true;
      requestRef.current += 1;
    };
  }, [isAuthenticated]);

  const runMutation = useCallback(
    async (key, action) => {
      const requestId = ++requestRef.current;
      setMutatingId(key);
      setError(null);

      try {
        const raw = await action();
        if (requestId !== requestRef.current) return raw;
        applyCart(raw);
        return raw;
      } catch (mutationError) {
        if (mutationError instanceof ApiError) {
          setError(mutationError);
          if (!mutationError.isUnauthorized) showError(mutationError.message);
        } else {
          setError(mutationError);
          showError("Something went wrong. Please try again.");
        }
        return null;
      } finally {
        if (requestId === requestRef.current) setMutatingId(null);
      }
    },
    [applyCart],
  );

  const addToCart = useCallback(
    ({ menuItemId, quantity = 1, note = null }) => {
      if (!menuItemId) return Promise.resolve(null);

      return runMutation(menuItemId, () =>
        cartService.addCartItem({ menuItemId, quantity, note }),
      );
    },
    [runMutation],
  );

  const setQuantity = useCallback(
    ({ menuItemId, quantity, note }) => {
      if (!menuItemId) return Promise.resolve(null);

      return runMutation(menuItemId, () =>
        cartService.updateCartItem(menuItemId, { quantity, note }),
      );
    },
    [runMutation],
  );

  const increment = useCallback(
    (menuItemId, delta = 1) => {
      const entry = cart.items.find((item) => item.item.id === menuItemId);
      if (!entry) return Promise.resolve(null);

      const next = entry.qty + delta;
      if (next <= 0) {
        return runMutation(menuItemId, () => cartService.removeCartItem(menuItemId));
      }

      return runMutation(menuItemId, () =>
        cartService.updateCartItem(menuItemId, { quantity: next }),
      );
    },
    [cart.items, runMutation],
  );

  const removeItem = useCallback(
    (menuItemId) => {
      if (!menuItemId) return Promise.resolve(null);
      return runMutation(menuItemId, () => cartService.removeCartItem(menuItemId));
    },
    [runMutation],
  );

  const setNote = useCallback(
    (menuItemId, note) => {
      const entry = cart.items.find((item) => item.item.id === menuItemId);
      if (!entry) return Promise.resolve(null);

      return runMutation(menuItemId, () =>
        cartService.updateCartItem(menuItemId, { quantity: entry.qty, note }),
      );
    },
    [cart.items, runMutation],
  );

  const clear = useCallback(() => runMutation("__all__", () => cartService.clearCart()), [runMutation]);

  const checkout = useCallback(
    async ({ specialInstructions, roomNumber } = {}) => {
      const requestId = ++requestRef.current;
      setMutatingId("__checkout__");
      setError(null);

      try {
        const orders = await cartService.checkoutGuestCart({
          specialInstructions: specialInstructions?.trim() || undefined,
          roomNumber,
        });

        if (requestId === requestRef.current) {
          // The server clears the cart once orders are placed; re-read it so the
          // UI reflects whatever the backend considers remaining.
          refresh();
        }

        return orders || [];
      } catch (checkoutError) {
        if (checkoutError instanceof ApiError) {
          setError(checkoutError);
          showError(checkoutError.message);
        } else {
          showError("Unable to place your order. Please try again.");
        }
        return [];
      } finally {
        if (requestId === requestRef.current) setMutatingId(null);
      }
    },
    [refresh],
  );

  const reorderItems = useCallback(
    async (entries = []) => {
      const results = [];
      for (const entry of entries) {
        if (!entry?.menuItemId) continue;
        // Sequential so each response refreshes the cart with the server total.
        results.push(await addToCart({ menuItemId: entry.menuItemId, quantity: entry.qty || 1 }));
      }
      return results;
    },
    [addToCart],
  );

  const getQuantity = useCallback(
    (menuItemId) => cart.items.find((entry) => entry.item.id === menuItemId)?.qty || 0,
    [cart.items],
  );

  const buildSpecialInstructions = useCallback(
    (orderInstruction, kitchenNotes) =>
      resolveSpecialInstructions({
        orderInstruction,
        kitchenNotes,
        kitchens: cart.kitchens,
      }),
    [cart.kitchens],
  );

  const value = useMemo(
    () => ({
      ...cart,
      isEmpty: cart.items.length === 0,
      isLoading,
      isCheckingOut: mutatingId === "__checkout__",
      mutatingId,
      isMutating: mutatingId !== null,
      error,
      refresh,
      addToCart,
      increment,
      setQuantity,
      removeItem,
      setNote,
      clearCart: clear,
      checkout,
      reorderItems,
      getQuantity,
      buildSpecialInstructions,
    }),
    [
      cart,
      isLoading,
      mutatingId,
      error,
      refresh,
      addToCart,
      increment,
      setQuantity,
      removeItem,
      setNote,
      clear,
      checkout,
      reorderItems,
      getQuantity,
      buildSpecialInstructions,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
