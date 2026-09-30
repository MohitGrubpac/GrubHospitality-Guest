"use client";

import { useSyncExternalStore } from "react";

/**
 * Order ratings have no endpoint yet, so feedback is stored in localStorage.
 * A tiny external store keeps the order-history cards and the feedback screen in
 * sync without setState-in-effect.
 */

const KEY_PREFIX = "feedback_";
const EMPTY = "null";

const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRaw(orderId) {
  if (!orderId || typeof window === "undefined") return EMPTY;

  try {
    return window.localStorage.getItem(`${KEY_PREFIX}${orderId}`) || EMPTY;
  } catch {
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function writeFeedback(orderId, payload) {
  if (!orderId || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(`${KEY_PREFIX}${orderId}`, JSON.stringify(payload));
    emit();
  } catch {
    /* storage unavailable - feedback just will not persist */
  }
}

/** Returns the parsed feedback for an order, or null when none was submitted. */
export function useFeedback(orderId) {
  const raw = useSyncExternalStore(subscribe, () => readRaw(orderId), () => EMPTY);

  if (!raw || raw === EMPTY) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useFeedbackSubmitted(orderId) {
  return useSyncExternalStore(
    subscribe,
    () => readRaw(orderId) !== EMPTY,
    () => false,
  );
}
