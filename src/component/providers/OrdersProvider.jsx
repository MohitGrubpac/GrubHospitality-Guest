"use client";

import { useCallback, useMemo } from "react";
import { isTerminalStatus } from "@/lib/adapters/orderAdapter";
import { selectIsAuthenticated } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  EMPTY_ORDERS,
  activeOrderSet,
  placeOrder as placeOrderAction,
  refreshOrders as refreshOrdersAction,
  trackedIdsCount,
  trackOrders as trackOrdersAction,
  untrackOrder as untrackOrderAction,
} from "@/store/ordersSlice";

/**
 * Tracks the guest's active orders (ids in `store/ordersSlice` + localStorage, order
 * details always re-read from GET /guest/orders/{orderId}). Side effects - the seed
 * fetch and the polling loop - live in `store/effects.jsx`.
 */
export function useOrders() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const allOrders = useAppSelector((state) => state.orders.orders);
  const activeOrderId = useAppSelector((state) => state.orders.activeOrderId);

  // Signed out -> nothing tracked, derived rather than reset from an effect.
  const orders = isAuthenticated ? allOrders : EMPTY_ORDERS;
  const isLoading = isAuthenticated && orders.length === 0 && trackedIdsCount() > 0;

  const placeOrder = useCallback(
    (checkoutResult, preferredOrderId = null) =>
      dispatch(placeOrderAction(checkoutResult, preferredOrderId)),
    [dispatch],
  );
  const refreshOrders = useCallback(() => dispatch(refreshOrdersAction()), [dispatch]);
  const trackOrders = useCallback((ids) => dispatch(trackOrdersAction(ids)), [dispatch]);
  const untrackOrder = useCallback((orderId) => dispatch(untrackOrderAction(orderId)), [dispatch]);
  const setActiveOrderId = useCallback(
    (orderId) => dispatch(activeOrderSet(orderId)),
    [dispatch],
  );

  const activeOrder = useMemo(() => {
    const selected = activeOrderId ? orders.find((order) => order.id === activeOrderId) : null;
    if (selected) return selected;
    // With multiple orders in a checkout, prefer one still in flight over a
    // delivered/cancelled sibling so the tracker never shows the wrong order.
    return (
      orders.find((order) => order && !isTerminalStatus(order.status)) || orders[0] || null
    );
  }, [orders, activeOrderId]);

  const hasActiveOrder = useMemo(
    () => orders.some((order) => !isTerminalStatus(order.status)),
    [orders],
  );

  return useMemo(
    () => ({
      orders,
      activeOrder,
      activeOrderId,
      hasActiveOrder,
      isLoading,
      placeOrder,
      refreshOrders,
      trackOrders,
      untrackOrder,
      setActiveOrderId,
    }),
    [
      orders,
      activeOrder,
      activeOrderId,
      hasActiveOrder,
      isLoading,
      placeOrder,
      refreshOrders,
      trackOrders,
      untrackOrder,
      setActiveOrderId,
    ],
  );
}
