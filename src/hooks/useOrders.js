"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, AUTH_STATUS } from "@/component/providers/AuthProvider";
import { ApiError } from "@/lib/api-client";
import { enrichMenuItem } from "@/lib/menu-cache";
import { toActiveOrder, toHistoryOrder } from "@/lib/adapters/orderAdapter";
import { cachedRequest } from "@/lib/request-cache";
import * as orderService from "@/services/orderService";

// Screens refetch on every mount (tab switches, back navigation, several cards
// mounting together); these TTLs collapse that into one network call.
const LIST_TTL_MS = 30000;
const DETAIL_TTL_MS = 15000;

const EMPTY_LIST = {
  rows: [],
  orders: [],
  total: 0,
  isTruncated: false,
  loaded: false,
  error: null,
};
const EMPTY_ORDER = { order: null, loaded: false, error: null };

function selectByKey(state, key) {
  return state.key === key ? state : { key, ...EMPTY_LIST };
}

/**
 * GET /guest/orders returns summary rows (id, code, kitchen, status, totalMinor,
 * itemCount, placedAt) but no line items, so each row is then hydrated with
 * GET /guest/orders/{orderId}.
 *
 * - `hydrateFilter` limits which rows get hydrated, so screens that only display a
 *   subset (the stay card) avoid an N+1 over orders they never show.
 * - `rows` is exposed un-hydrated so callers needing only counts/totals can skip it.
 * - The endpoint only accepts `status`, so a single server-sized page is returned and
 *   `isTruncated` flags the case where the guest has more orders than were sent.
 */
export function useGuestOrders({
  status: statusFilter,
  hydrate = true,
  hydrateFilter,
  enabled = true,
} = {}) {
  const { status } = useAuth();
  const isAuthenticated = status === AUTH_STATUS.AUTHENTICATED;
  const isActive = enabled && isAuthenticated;

  const key = `${isActive ? statusFilter || "all" : "off"}|${hydrate}`;

  // `hydrateFilter` is usually an inline arrow, so keep a stable ref for it rather
  // than letting a new function identity restart the fetch on every render.
  const filterRef = useRef(hydrateFilter);
  useEffect(() => {
    filterRef.current = hydrateFilter;
  }, [hydrateFilter]);

  const [state, setState] = useState({ key: null, ...EMPTY_LIST });

  const view = selectByKey(state, key);

  // Pure fetch: returns the payload, commits nothing. Shared by the effect and refetch.
  const fetchOrders = useCallback(
    async ({ force = false } = {}) => {
      const response = await cachedRequest(
        `orders:list:${statusFilter || "all"}`,
        () => orderService.listGuestOrders({ status: statusFilter }),
        { ttlMs: LIST_TTL_MS, force },
      );

      const rows = response?.items || [];
      const total = response?.total ?? rows.length;

      const shouldHydrate = (row) => {
        if (!hydrate) return false;
        const filter = filterRef.current;
        return filter ? Boolean(filter(row)) : true;
      };

      const details = await Promise.all(
        rows.filter(shouldHydrate).map((row) =>
          cachedRequest(
            `orders:detail:${row.id}`,
            () => orderService.getGuestOrder(row.id),
            { ttlMs: DETAIL_TTL_MS, force },
          )
            .then((detail) => toHistoryOrder(row, detail))
            .catch(() => toHistoryOrder(row)),
        ),
      );

      // Un-hydrated rows still count toward totals, just without line items.
      const hydrated = new Set(details.map((order) => order.id));
      const summaryOnly = rows
        .filter((row) => !hydrated.has(row.id))
        .map((row) => toHistoryOrder(row));

      return {
        rows,
        orders: [...details, ...summaryOnly].filter(Boolean),
        total,
        isTruncated: total > rows.length,
      };
    },
    [statusFilter, hydrate],
  );

  useEffect(() => {
    if (!isActive) return undefined;

    let cancelled = false;

    fetchOrders()
      .then((payload) => {
        if (cancelled) return;
        setState({ key, ...payload, loaded: true, error: null });
      })
      .catch((ordersError) => {
        if (cancelled) return;
        if (ordersError instanceof ApiError && ordersError.isUnauthorized) {
          setState({ key, ...EMPTY_LIST });
          return;
        }
        setState({ key, ...EMPTY_LIST, error: ordersError });
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, fetchOrders, key]);

  const refetch = useCallback(async () => {
    if (!isActive) return [];
    try {
      const payload = await fetchOrders({ force: true });
      setState({ key, ...payload, loaded: true, error: null });
      return payload.orders;
    } catch (ordersError) {
      setState({ key, ...EMPTY_LIST, error: ordersError });
      return [];
    }
  }, [isActive, fetchOrders, key]);

  return {
    rows: view.rows,
    orders: view.orders,
    total: view.total,
    isTruncated: view.isTruncated,
    isLoading: isActive && !view.loaded,
    error: view.error,
    refetch,
  };
}

/** GET /guest/orders/{orderId} for a single order. */
export function useGuestOrder(orderId) {
  const { status } = useAuth();
  const isAuthenticated = status === AUTH_STATUS.AUTHENTICATED;
  const key = orderId && isAuthenticated ? orderId : "none";
  const [state, setState] = useState({ key: null, ...EMPTY_ORDER });

  const view = state.key === key ? state : { key, ...EMPTY_ORDER };

  useEffect(() => {
    if (!orderId || !isAuthenticated) return undefined;

    let cancelled = false;

    cachedRequest(
      `orders:detail:${orderId}`,
      () => orderService.getGuestOrder(orderId),
      { ttlMs: DETAIL_TTL_MS },
    )
      .then((detail) => {
        if (!cancelled) setState({ key, order: toActiveOrder(detail), loaded: true, error: null });
      })
      .catch((orderError) => {
        // Mark loaded so callers stop showing a spinner and fall back to their
        // static placeholder instead of spinning forever on a bad id.
        if (!cancelled) setState({ key, ...EMPTY_ORDER, error: orderError, loaded: true });
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, isAuthenticated, key]);

  return { order: view.order, isLoading: Boolean(key !== "none") && !view.loaded, error: view.error };
}

/**
 * Reorder payloads need `menuItemId` + quantity. Order details carry the ids, and the
 * menu cache fills in veg/image details for the cart rows.
 */
export function buildReorderEntries(orders = []) {
  const entries = [];

  orders.forEach((order) => {
    (order.items || []).forEach((line) => {
      const menuItemId = line.menuItemId || line.item?.menuItemId || line.item?.id;
      if (!menuItemId) return;

      entries.push({
        ...enrichMenuItem(menuItemId),
        menuItemId,
        name: line.name || line.item?.name,
        qty: line.qty || 1,
      });
    });
  });

  return entries;
}
