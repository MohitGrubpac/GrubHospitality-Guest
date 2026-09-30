"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AUTH_STATUS, useAuth } from "@/component/providers/AuthProvider";
import { isTerminalStatus, toActiveOrder, toCheckoutOrders } from "@/lib/adapters/orderAdapter";
import * as orderService from "@/services/orderService";

const OrdersContext = createContext(null);

const TRACKED_ORDERS_KEY = "grubpac.trackedOrderIds";
const POLL_INTERVAL_MS = 20000;
const EMPTY_ORDERS = [];

function trackedIdsCount() {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRACKED_ORDERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function readTrackedIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRACKED_ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeTrackedIds(ids) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRACKED_ORDERS_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable - tracking is best-effort */
  }
}

/**
 * Tracks the orders a guest has placed. Only ids are persisted locally; the order
 * itself is always re-read from GET /guest/orders/{orderId} so status, totals and
 * items stay in sync with the kitchen. Non-terminal orders are polled.
 */
export function OrdersProvider({ children }) {
  const { status } = useAuth();
  const isAuthenticated = status === AUTH_STATUS.AUTHENTICATED;

  const [orders, setOrders] = useState(EMPTY_ORDERS);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const isLoading = isAuthenticated && orders.length === 0 && trackedIdsCount() > 0;

  const trackedIdsRef = useRef([]);

  const persistIds = useCallback((ids) => {
    trackedIdsRef.current = ids;
    writeTrackedIds(ids);
  }, []);

  const fetchTracked = useCallback(
    async (ids) => {
      const details = await Promise.all(
        ids.map((id) =>
          orderService
            .getGuestOrder(id)
            .then((order) => toActiveOrder(order))
            .catch(() => null),
        ),
      );
      return details.filter(Boolean);
    },
    [],
  );

  const track = useCallback(
    async (orderIds) => {
      const unique = Array.from(new Set((orderIds || []).filter(Boolean)));
      if (unique.length === 0) return [];

      const merged = Array.from(new Set([...trackedIdsRef.current, ...unique])).slice(-10);
      persistIds(merged);

      const next = await fetchTracked(merged);
      setOrders(next);
      return next;
    },
    [persistIds, fetchTracked],
  );

  const refreshOrders = useCallback(async () => {
    const ids = trackedIdsRef.current;
    if (ids.length === 0) {
      setOrders([]);
      return;
    }
    await track(ids);
  }, [track]);

  // Adopt any tracked orders as soon as the session becomes available.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const stored = readTrackedIds();
    if (stored.length === 0) return undefined;

    trackedIdsRef.current = stored;
    let cancelled = false;

    fetchTracked(stored)
      .then((details) => {
        if (cancelled) return;

        const live = details.filter(Boolean);
        const missing = stored.filter((id) => !live.some((order) => order.id === id));

        // Forget ids the backend no longer knows about.
        if (missing.length > 0 && missing.length !== stored.length) persistIds(missing);

        setOrders(live);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, persistIds, fetchTracked]);

  // Signed out -> nothing tracked, derived rather than reset from an effect.
  const visibleOrders = isAuthenticated ? orders : EMPTY_ORDERS;

  const hasLiveOrders = useMemo(
    () => visibleOrders.some((order) => order && !isTerminalStatus(order.status)),
    [visibleOrders],
  );

  // Poll while any tracked order is still moving through the kitchen.
  useEffect(() => {
    if (!isAuthenticated || !hasLiveOrders) return undefined;

    const timer = setInterval(() => {
      const ids = trackedIdsRef.current;
      if (ids.length === 0) return;

      fetchTracked(ids)
        .then((next) => {
          if (next.length > 0) setOrders(next);
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isAuthenticated, hasLiveOrders, fetchTracked]);

  const placeOrder = useCallback(
    async (checkoutResult, preferredOrderId = null) => {
      const created = Array.isArray(checkoutResult)
        ? toCheckoutOrders(checkoutResult)
        : checkoutResult
          ? [toActiveOrder(checkoutResult)].filter(Boolean)
          : [];

      if (created.length === 0) return [];

      const primaryId = preferredOrderId || created[0].id;
      setActiveOrderId(primaryId);

      const ids = created.map((order) => order.id);
      persistIds(Array.from(new Set([...trackedIdsRef.current, ...ids])).slice(-10));

      setOrders((previous) => {
        const byId = new Map(previous.map((order) => [order.id, order]));
        created.forEach((order) => byId.set(order.id, order));
        return Array.from(byId.values());
      });

      return created;
    },
    [persistIds],
  );

  const activeOrder = useMemo(
    () =>
      visibleOrders.find((order) => order.id === activeOrderId) || visibleOrders[0] || null,
    [visibleOrders, activeOrderId],
  );

  const hasActiveOrder = useMemo(
    () => visibleOrders.some((order) => !isTerminalStatus(order.status)),
    [visibleOrders],
  );

  const untrackOrder = useCallback(
    (orderId) => {
      persistIds(trackedIdsRef.current.filter((id) => id !== orderId));
      setOrders((previous) => previous.filter((order) => order.id !== orderId));
      setActiveOrderId((current) => (current === orderId ? null : current));
    },
    [persistIds],
  );

  const value = useMemo(
    () => ({
      orders: visibleOrders,
      activeOrder,
      activeOrderId,
      hasActiveOrder,
      isLoading,
      placeOrder,
      refreshOrders,
      trackOrders: track,
      untrackOrder,
      setActiveOrderId,
    }),
    [
      visibleOrders,
      activeOrder,
      activeOrderId,
      hasActiveOrder,
      isLoading,
      placeOrder,
      refreshOrders,
      track,
      untrackOrder,
    ],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider");
  }
  return context;
}
