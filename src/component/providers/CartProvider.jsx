"use client";

import { useCallback, useMemo } from "react";
import {
  addToCart as addToCartAction,
  changeQuantity,
  checkout as checkoutAction,
  clearCart as clearCartAction,
  refreshCart,
  removeItem as removeItemAction,
  reorderItems as reorderItemsAction,
  setNote as setNoteAction,
  setQuantity as setQuantityAction,
} from "@/store/cartSlice";
import { selectIsAuthenticated } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { EMPTY_CART, resolveSpecialInstructions, toCartView } from "@/lib/adapters/cartAdapter";

/**
 * The cart lives on the server (GET/POST/PATCH/DELETE /guest/cart); the raw payload
 * is kept in `store/cartSlice` and every mutation returns the full updated cart, so
 * prices and totals shown in the UI are always the ones the server will charge.
 */
export function useCart() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const rawCart = useAppSelector((state) => state.cart.rawCart);
  const mutatingId = useAppSelector((state) => state.cart.mutatingId);
  const error = useAppSelector((state) => state.cart.error);

  const cart = isAuthenticated && rawCart ? toCartView(rawCart) : EMPTY_CART;
  // The first server read has not landed yet.
  const isLoading = isAuthenticated && rawCart === null;

  const refresh = useCallback(() => dispatch(refreshCart()), [dispatch]);
  const addToCart = useCallback((args) => dispatch(addToCartAction(args)), [dispatch]);
  const setQuantity = useCallback((args) => dispatch(setQuantityAction(args)), [dispatch]);
  const increment = useCallback(
    (menuItemId, delta = 1) => dispatch(changeQuantity(menuItemId, delta)),
    [dispatch],
  );
  const removeItem = useCallback(
    (menuItemId) => dispatch(removeItemAction(menuItemId)),
    [dispatch],
  );
  const setNote = useCallback(
    (menuItemId, note) => dispatch(setNoteAction(menuItemId, note)),
    [dispatch],
  );
  const clearCart = useCallback(() => dispatch(clearCartAction()), [dispatch]);
  const checkout = useCallback((args) => dispatch(checkoutAction(args)), [dispatch]);
  const reorderItems = useCallback((entries) => dispatch(reorderItemsAction(entries)), [dispatch]);

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

  return useMemo(
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
      clearCart,
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
      clearCart,
      checkout,
      reorderItems,
      getQuantity,
      buildSpecialInstructions,
    ],
  );
}
