"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AUTH_STATUS, useAuth } from "@/component/providers/AuthProvider";
import { isTerminalStatus, toActiveOrder, toCheckoutOrders } from "@/lib/adapters/orderAdapter";
import { ApiError } from "@/lib/api-client";
import * as orderService from "@/services/orderService";

const OrdersContext = createContext(null);

const TRACKED_ORDERS_KEY = "grubpac.trackedOrderIds";
const POLL_INTERVAL_MS = 20000;
const RETRY_INTERVAL_MS = 5000;
const KICKOFF_DELAY_MS = 3000;
const MAX_TRACKED_ORDERS = 10;
const EMPTY_ORDERS = [];

/** Only a definite "backend no longer knows this order" ends tracking. */
function isGoneError(error) {
  return error instanceof ApiError && (error.isNotFound || error.isForbidden);
}

/**
 * Reconciles one fetch round against what we already show. Transient failures keep
 * the last-known copy so a flaky poll can never blank the tracker; only ids the
 * backend actually rejects (404/403) are dropped.
 */
function mergeTrackedOrders(previous, results) {
  const previousById = new Map(previous.map((order) => [order.id, order]));
  const merged = [];
  const goneIds = [];
  const seen = new Set();

  for (const result of results) {
    seen.add(result.id);
    if (result.order) {
      merged.push(result.order);
    } else if (result.gone) {
      goneIds.push(result.id);
      previousById.delete(result.id);
    } else {
      const lastKnown = previousById.get(result.id);
      if (lastKnown) merged.push(lastKnown);
    }
  }

  // Anything held in state that was not part of this round is kept as-is.
  for (const [id, order] of previousById) {
    if (!seen.has(id)) merged.push(order);
  }

  return { orders: merged, goneIds };
}

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
 * Tracks the guest's active orders: ids from this session's checkouts plus the
 * active orders embedded in GET /guests/me. Only ids are persisted locally; the
 * order itself is always re-read from GET /guest/orders/{orderId} so status, totals
 * and items stay in sync with the kitchen. Non-terminal orders are polled.
 */
export function OrdersProvider({ children }) {
  const { status, guest } = useAuth();
  const isAuthenticated = status === AUTH_STATUS.AUTHENTICATED;
  // GET /guests/me embeds the guest's full order list - the source of truth for
  // active orders this browser never placed (another session or device).
  const meOrders = guest?.orders;

  const [orders, setOrders] = useState(EMPTY_ORDERS);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [trackedCount, setTrackedCount] = useState(0);
  const isLoading = isAuthenticated && orders.length === 0 && trackedIdsCount() > 0;

  const trackedIdsRef = useRef([]);
  const ordersRef = useRef(EMPTY_ORDERS);

  const persistIds = useCallback((ids) => {
    trackedIdsRef.current = ids;
    setTrackedCount(ids.length);
    writeTrackedIds(ids);
  }, []);

  /** Single writer for state + ref so merge rounds always see the latest orders. */
  const commitOrders = useCallback((nextOrUpdater) => {
    setOrders((previous) => {
      const next =
        typeof nextOrUpdater === "function" ? nextOrUpdater(previous) : nextOrUpdater;
      ordersRef.current = next;
      return next;
    });
  }, []);

  const fetchTracked = useCallback(async (ids) => {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const order = toActiveOrder(await orderService.getGuestOrder(id));
          return { id, order: order || null, gone: false };
        } catch (error) {
          return { id, order: null, gone: isGoneError(error) };
        }
      }),
    );
    return results;
  }, []);

  const track = useCallback(
    async (orderIds) => {
      const unique = Array.from(new Set((orderIds || []).filter(Boolean)));
      if (unique.length === 0) return [];

      const merged = Array.from(new Set([...trackedIdsRef.current, ...unique])).slice(-MAX_TRACKED_ORDERS);
      persistIds(merged);

      const results = await fetchTracked(merged);
      const { orders: next, goneIds } = mergeTrackedOrders(ordersRef.current, results);

      // Prune only what the backend definitively no longer knows about.
      if (goneIds.length > 0) {
        persistIds(trackedIdsRef.current.filter((id) => !goneIds.includes(id)));
      }

      commitOrders(next);
      return next;
    },
    [persistIds, fetchTracked, commitOrders],
  );

  const refreshOrders = useCallback(async () => {
    const ids = trackedIdsRef.current;
    if (ids.length === 0) {
      commitOrders(EMPTY_ORDERS);
      return;
    }
    await track(ids);
  }, [track, commitOrders]);

  // Adopt any tracked orders as soon as the session becomes available, and seed the
  // tracker with the active orders the profile already embeds: the guest may hold
  // orders this browser never placed, and those must still surface in the bottom
  // tracker and on the status screen. Fresh details always come from
  // GET /guest/orders/{orderId} so status stays server-driven.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const stored = readTrackedIds();
    const meActive = (meOrders || []).filter(
      (order) => order && order.id && !isTerminalStatus(order.status),
    );
    const allIds = Array.from(
      new Set([...stored, ...meActive.map((order) => order.id)]),
    ).slice(0, MAX_TRACKED_ORDERS);

    if (allIds.length === 0) return undefined;

    trackedIdsRef.current = allIds;
    // Written outside state so the loading state sees the tracker immediately.
    writeTrackedIds(allIds);
    let cancelled = false;

    fetchTracked(allIds)
      .then((results) => {
        if (cancelled) return;

        // Start from what the profile already told us, then overlay fresh details.
        // Already-loaded state wins over the profile copy for the same order.
        const seed = meActive.filter((order) => allIds.includes(order.id));
        const { orders: merged, goneIds } = mergeTrackedOrders(
          [...seed, ...ordersRef.current],
          results,
        );

        // Forget ids the backend no longer knows about - never the ones that
        // merely failed to fetch right now.
        const kept = goneIds.length > 0 ? allIds.filter((id) => !goneIds.includes(id)) : allIds;
        persistIds(kept);

        commitOrders(merged);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, meOrders, persistIds, fetchTracked, commitOrders]);

  // Signed out -> nothing tracked, derived rather than reset from an effect.
  const visibleOrders = isAuthenticated ? orders : EMPTY_ORDERS;

  const hasLiveOrders = useMemo(
    () => visibleOrders.some((order) => order && !isTerminalStatus(order.status)),
    [visibleOrders],
  );

  // Tracked ids we have not loaded yet (fetch failure, cold start) - keep trying.
  const awaitingRecovery = trackedCount > 0 && visibleOrders.length < trackedCount;

  // Poll while any tracked order is still moving through the kitchen, and retry on a
  // faster cadence while some tracked order is missing from state, so the tracker can
  // never stay blank while the backend still has live orders for us.
  useEffect(() => {
    if (!isAuthenticated || trackedCount === 0) return undefined;
    if (!hasLiveOrders && !awaitingRecovery) return undefined;

    const pollOnce = () => {
      const ids = trackedIdsRef.current;
      if (ids.length === 0) return;

      fetchTracked(ids)
        .then((results) => {
          const { orders: merged, goneIds } = mergeTrackedOrders(ordersRef.current, results);

          if (goneIds.length > 0) {
            persistIds(trackedIdsRef.current.filter((id) => !goneIds.includes(id)));
          }

          commitOrders(merged);
        })
        .catch(() => {});
    };

    const recoveringEmpty = awaitingRecovery && visibleOrders.length === 0;
    const interval = setInterval(pollOnce, awaitingRecovery ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS);
    const kickoff = recoveringEmpty ? setTimeout(pollOnce, KICKOFF_DELAY_MS) : null;

    return () => {
      clearInterval(interval);
      if (kickoff) clearTimeout(kickoff);
    };
  }, [
    isAuthenticated,
    trackedCount,
    hasLiveOrders,
    awaitingRecovery,
    visibleOrders.length,
    fetchTracked,
    persistIds,
    commitOrders,
  ]);

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
      persistIds(Array.from(new Set([...trackedIdsRef.current, ...ids])).slice(-MAX_TRACKED_ORDERS));

      commitOrders((previous) => {
        const byId = new Map(previous.map((order) => [order.id, order]));
        created.forEach((order) => byId.set(order.id, order));
        return Array.from(byId.values());
      });

      return created;
    },
    [persistIds, commitOrders],
  );

  const activeOrder = useMemo(() => {
    const selected = activeOrderId
      ? visibleOrders.find((order) => order.id === activeOrderId)
      : null;
    if (selected) return selected;
    // With multiple orders in a checkout, prefer one still in flight over a
    // delivered/cancelled sibling so the tracker never shows the wrong order.
    return (
      visibleOrders.find((order) => order && !isTerminalStatus(order.status)) ||
      visibleOrders[0] ||
      null
    );
  }, [visibleOrders, activeOrderId]);

  const hasActiveOrder = useMemo(
    () => visibleOrders.some((order) => !isTerminalStatus(order.status)),
    [visibleOrders],
  );

  const untrackOrder = useCallback(
    (orderId) => {
      persistIds(trackedIdsRef.current.filter((id) => id !== orderId));
      commitOrders((previous) => previous.filter((order) => order.id !== orderId));
      setActiveOrderId((current) => (current === orderId ? null : current));
    },
    [persistIds, commitOrders],
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
