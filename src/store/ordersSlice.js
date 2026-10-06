import { createSlice } from "@reduxjs/toolkit";
import { isTerminalStatus, toActiveOrder, toCheckoutOrders } from "@/lib/adapters/orderAdapter";
import { ApiError } from "@/lib/api-client";
import { cachedRequest, invalidateRequests } from "@/lib/request-cache";
import { selectIsAuthenticated } from "@/store/authSlice";
import * as orderService from "@/services/orderService";

const TRACKED_ORDERS_KEY = "grubpac.trackedOrderIds";
export const TRACKED_DETAIL_TTL_MS = 10000;
export const MAX_TRACKED_ORDERS = 10;
export const POLL_INTERVAL_MS = 20000;
export const RETRY_INTERVAL_MS = 5000;
export const KICKOFF_DELAY_MS = 3000;
export const MAX_FAST_RETRIES = 3;
export const EMPTY_ORDERS = [];

/** Only a definite "backend no longer knows this order" ends tracking. */
function isGoneError(error) {
  return error instanceof ApiError && (error.isNotFound || error.isForbidden);
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

export function trackedIdsCount() {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRACKED_ORDERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
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

const ordersSlice = createSlice({
  name: "orders",
  initialState: {
    orders: EMPTY_ORDERS,
    activeOrderId: null,
    trackedIds: [],
  },
  reducers: {
    trackedIdsSet(state, action) {
      state.trackedIds = action.payload;
    },
    ordersCommitted(state, action) {
      state.orders = action.payload;
    },
    ordersUpserted(state, action) {
      const byId = new Map(state.orders.map((order) => [order.id, order]));
      action.payload.forEach((order) => byId.set(order.id, order));
      state.orders = Array.from(byId.values());
    },
    activeOrderSet(state, action) {
      state.activeOrderId = action.payload;
    },
    orderUntracked(state, action) {
      const orderId = action.payload;
      state.trackedIds = state.trackedIds.filter((id) => id !== orderId);
      state.orders = state.orders.filter((order) => order.id !== orderId);
      if (state.activeOrderId === orderId) state.activeOrderId = null;
    },
    ordersCleared(state) {
      state.orders = EMPTY_ORDERS;
      state.activeOrderId = null;
      state.trackedIds = [];
    },
  },
});

export const {
  trackedIdsSet,
  ordersCommitted,
  ordersUpserted,
  activeOrderSet,
  orderUntracked,
  ordersCleared,
} = ordersSlice.actions;

export default ordersSlice.reducer;

/** Single writer for the tracked-id list: state + the localStorage mirror. */
function persistIds(dispatch, ids) {
  dispatch(trackedIdsSet(ids));
  writeTrackedIds(ids);
}

async function fetchTracked(ids) {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const detail = await cachedRequest(
          `orders:detail:${id}`,
          () => orderService.getGuestOrder(id),
          { ttlMs: TRACKED_DETAIL_TTL_MS },
        );
        return { id, order: toActiveOrder(detail) || null, gone: false };
      } catch (error) {
        return { id, order: null, gone: isGoneError(error) };
      }
    }),
  );
}

/**
 * Tracks the guest's active orders: ids from this session's checkouts plus the
 * active orders embedded in GET /guests/me. Only ids are persisted locally; the
 * order itself is always re-read from GET /guest/orders/{orderId} so status, totals
 * and items stay in sync with the kitchen.
 */
export function seedTrackedOrders() {
  return async (dispatch, getState) => {
    if (!selectIsAuthenticated(getState())) return;

    const stored = readTrackedIds();
    const meActive = (getState().auth.guest?.orders || []).filter(
      (order) => order && order.id && !isTerminalStatus(order.status),
    );
    const allIds = Array.from(
      new Set([...stored, ...meActive.map((order) => order.id)]),
    ).slice(0, MAX_TRACKED_ORDERS);

    if (allIds.length === 0) return;

    // Written outside the fetch so the loading state sees the tracker immediately.
    persistIds(dispatch, allIds);

    try {
      const results = await fetchTracked(allIds);

      // Start from what the profile already told us, then overlay fresh details.
      // Already-loaded state wins over the profile copy for the same order.
      const seed = meActive.filter((order) => allIds.includes(order.id));
      const { orders: merged, goneIds } = mergeTrackedOrders(
        [...seed, ...getState().orders.orders],
        results,
      );

      // Forget ids the backend no longer knows about - never the ones that
      // merely failed to fetch right now.
      if (goneIds.length > 0) {
        persistIds(
          dispatch,
          getState().orders.trackedIds.filter((id) => !goneIds.includes(id)),
        );
      }

      dispatch(ordersCommitted(merged));
    } catch {
      /* a failed seed round is retried by the poll effect */
    }
  };
}

/** One poll round over the tracked ids. */
export function pollTrackedOrders() {
  return async (dispatch, getState) => {
    const ids = getState().orders.trackedIds;
    if (ids.length === 0) return;

    try {
      const results = await fetchTracked(ids);
      const { orders: merged, goneIds } = mergeTrackedOrders(getState().orders.orders, results);

      if (goneIds.length > 0) {
        persistIds(
          dispatch,
          getState().orders.trackedIds.filter((id) => !goneIds.includes(id)),
        );
      }

      dispatch(ordersCommitted(merged));
    } catch {
      /* transient poll failure - the next round picks up where this left off */
    }
  };
}

/** Adopts additional order ids (e.g. from a checkout) and fetches them. */
export function trackOrders(orderIds) {
  return async (dispatch, getState) => {
    const unique = Array.from(new Set((orderIds || []).filter(Boolean)));
    if (unique.length === 0) return getState().orders.orders;

    const merged = Array.from(new Set([...getState().orders.trackedIds, ...unique])).slice(
      -MAX_TRACKED_ORDERS,
    );
    persistIds(dispatch, merged);

    const results = await fetchTracked(merged);
    const { orders: next, goneIds } = mergeTrackedOrders(getState().orders.orders, results);

    // Prune only what the backend definitively no longer knows about.
    if (goneIds.length > 0) {
      persistIds(
        dispatch,
        getState().orders.trackedIds.filter((id) => !goneIds.includes(id)),
      );
    }

    dispatch(ordersCommitted(next));
    return next;
  };
}

export function refreshOrders() {
  return async (dispatch, getState) => {
    const ids = getState().orders.trackedIds;
    if (ids.length === 0) {
      dispatch(ordersCommitted(EMPTY_ORDERS));
      return;
    }
    await dispatch(trackOrders(ids));
  };
}

export function untrackOrder(orderId) {
  return (dispatch, getState) => {
    const nextIds = getState().orders.trackedIds.filter((id) => id !== orderId);
    dispatch(orderUntracked(orderId));
    writeTrackedIds(nextIds);
  };
}

/**
 * Registers a freshly placed checkout: history/stay screens cache the list
 * response, so the cache is dropped, the order ids start being tracked and the
 * created orders are shown immediately while details refresh in the background.
 */
export function placeOrder(checkoutResult, preferredOrderId = null) {
  return (dispatch, getState) => {
    const created = Array.isArray(checkoutResult)
      ? toCheckoutOrders(checkoutResult)
      : checkoutResult
        ? [toActiveOrder(checkoutResult)].filter(Boolean)
        : [];

    if (created.length === 0) return [];

    // History/stay screens cache the list response - a new order must show up.
    invalidateRequests("orders:list:");

    const primaryId = preferredOrderId || created[0].id;
    dispatch(activeOrderSet(primaryId));

    const ids = created.map((order) => order.id);
    persistIds(
      dispatch,
      Array.from(new Set([...getState().orders.trackedIds, ...ids])).slice(-MAX_TRACKED_ORDERS),
    );

    dispatch(ordersUpserted(created));

    return created;
  };
}
