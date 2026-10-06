/**
 * Tiny TTL cache with in-flight dedupe for GETs.
 *
 * Screens used to re-run the same list/detail requests on every mount (tab
 * switches, back navigation, several cards mounting at once). Identical
 * requests made inside the TTL share one network call, failures are never
 * cached so a flaky request is retried on the next attempt, and `force` skips
 * the stored value for callers that must go to the server.
 */

const DEFAULT_TTL_MS = 15000;

const entries = new Map();
const inflight = new Map();

export function cachedRequest(key, loader, { ttlMs = DEFAULT_TTL_MS, force = false } = {}) {
  if (!force) {
    const hit = entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value);

    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const promise = (async () => {
    try {
      const value = await loader();
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Drops every cached response whose key starts with `prefix` (all of them when omitted). */
export function invalidateRequests(prefix = "") {
  for (const key of Array.from(entries.keys())) {
    if (!prefix || key.startsWith(prefix)) entries.delete(key);
  }
}
