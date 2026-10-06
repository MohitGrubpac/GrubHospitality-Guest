"use client";

import { useEffect } from "react";
import { isTerminalStatus } from "@/lib/adapters/orderAdapter";
import { hasSession, subscribeToSession } from "@/lib/token-store";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  bootstrapSession,
  selectIsAuthenticated,
  sessionKnown,
} from "@/store/authSlice";
import { cartReset, refreshCart } from "@/store/cartSlice";
import {
  EMPTY_ORDERS,
  KICKOFF_DELAY_MS,
  MAX_FAST_RETRIES,
  POLL_INTERVAL_MS,
  RETRY_INTERVAL_MS,
  pollTrackedOrders,
  seedTrackedOrders,
} from "@/store/ordersSlice";

/**
 * Keeps the auth slice in step with the token store (the source of truth for
 * "is there a session at all") and restores the session once on startup.
 */
function SessionEffects() {
  const dispatch = useAppDispatch();
  const hasStoredSession = useAppSelector((state) => state.auth.hasStoredSession);

  // The first client render still carries the server's snapshot; sync the real
  // token-store value right after hydration and on every later change.
  useEffect(() => {
    dispatch(sessionKnown(hasSession()));
    return subscribeToSession(() => dispatch(sessionKnown(hasSession())));
  }, [dispatch]);

  useEffect(() => {
    if (hasStoredSession) dispatch(bootstrapSession());
  }, [dispatch, hasStoredSession]);

  return null;
}

/** Loads the server cart on sign-in and drops it on sign-out. */
function CartEffects() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(cartReset());
      return;
    }
    dispatch(refreshCart());
  }, [dispatch, isAuthenticated]);

  return null;
}

/** Adopts tracked orders as soon as the session/profile provides them. */
function OrdersEffects() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  // Keyed on the embedded *ids*, not the profile object: every profile response is
  // a new object, and depending on it re-ran a full fetch round for every tracked
  // order each time GET /guests/me was refreshed.
  const meActiveIdsKey = useAppSelector((state) => {
    const orders = state.auth.guest?.orders || [];
    return orders
      .filter((order) => order && order.id && !isTerminalStatus(order.status))
      .map((order) => order.id)
      .join("|");
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(seedTrackedOrders());
  }, [dispatch, isAuthenticated, meActiveIdsKey]);

  return null;
}

/**
 * Polls while any tracked order is still moving through the kitchen, and retries on a
 * faster cadence while some tracked order is missing from state, so the tracker can
 * never stay blank while the backend still has live orders for us. Fast retries are
 * capped, so an id the backend keeps failing on cannot pin the app to the 5s cadence
 * forever, and every round shares the per-order cache with the seed fetch.
 */
function OrdersPollEffect() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const trackedCount = useAppSelector((state) => state.orders.trackedIds.length);
  const allOrders = useAppSelector((state) => state.orders.orders);
  // Signed out -> nothing tracked, derived rather than reset from an effect.
  const visibleOrders = isAuthenticated ? allOrders : EMPTY_ORDERS;

  const hasLiveOrders = visibleOrders.some((order) => order && !isTerminalStatus(order.status));
  const awaitingRecovery = trackedCount > 0 && visibleOrders.length < trackedCount;
  const recoveringEmpty = awaitingRecovery && visibleOrders.length === 0;

  useEffect(() => {
    if (!isAuthenticated || trackedCount === 0) return undefined;
    if (!hasLiveOrders && !awaitingRecovery) return undefined;

    let attempts = 0;
    let timer = null;

    const run = () => {
      dispatch(pollTrackedOrders()).finally(() => {
        attempts += 1;
        const fastRetry = awaitingRecovery && attempts <= MAX_FAST_RETRIES;
        timer = setTimeout(run, fastRetry ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS);
      });
    };

    timer = setTimeout(
      run,
      recoveringEmpty ? KICKOFF_DELAY_MS : awaitingRecovery ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS,
    );

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    dispatch,
    isAuthenticated,
    trackedCount,
    hasLiveOrders,
    awaitingRecovery,
    recoveringEmpty,
    visibleOrders.length,
  ]);

  return null;
}

/** Mounted once by MainProvider; owns every cross-cutting side effect. */
export default function StoreEffects() {
  return (
    <>
      <SessionEffects />
      <CartEffects />
      <OrdersEffects />
      <OrdersPollEffect />
    </>
  );
}
