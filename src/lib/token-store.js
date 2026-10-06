const ACCESS_TOKEN_KEY = "grubpac.guest.accessToken";
const REFRESH_TOKEN_KEY = "grubpac.guest.refreshToken";

const cache = {
  accessToken: null,
  refreshToken: null,
  hydrated: false,
};

const listeners = new Set();

/**
 * Bumped on every token write. A refresh that started before the session was
 * ended (or replaced by a newer login) checks this before storing its result,
 * so a slow response can never resurrect a logged-out session.
 */
let generation = 0;

export function getSessionGeneration() {
  hydrate();
  return generation;
}

function emit() {
  listeners.forEach((listener) => listener());
}

/** Subscribe to session changes (login, logout, token rotation). */
export function subscribeToSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function hydrate() {
  if (cache.hydrated || typeof window === "undefined") return;
  try {
    cache.accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    cache.refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    cache.accessToken = null;
    cache.refreshToken = null;
  }
  cache.hydrated = true;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (cache.accessToken) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, cache.accessToken);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }

    if (cache.refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, cache.refreshToken);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    /* storage unavailable (private mode / quota) - keep in-memory copy only */
  }
  emit();
}

export function getAccessToken() {
  hydrate();
  return cache.accessToken;
}

export function getRefreshToken() {
  hydrate();
  return cache.refreshToken;
}

export function setTokens({ accessToken, refreshToken } = {}) {
  hydrate();
  cache.accessToken = accessToken ?? null;
  if (refreshToken !== undefined) {
    cache.refreshToken = refreshToken;
  }
  cache.hydrated = true;
  generation += 1;
  persist();
}

export function clearTokens() {
  cache.accessToken = null;
  cache.refreshToken = null;
  cache.hydrated = true;
  generation += 1;
  persist();
}

export function hasSession() {
  hydrate();
  return Boolean(cache.accessToken || cache.refreshToken);
}

function decodeJwtExp(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const { exp } = JSON.parse(atob(padded));
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/**
 * True when the stored access token is an expired JWT (within `skewSeconds` of
 * expiry). Opaque / non-JWT tokens report false - those are handled reactively
 * by the 401 -> refresh -> retry path in api-client.
 */
export function isAccessTokenExpired(skewSeconds = 30) {
  const token = getAccessToken();
  if (!token) return true;
  if (typeof atob !== "function") return false;
  const exp = decodeJwtExp(token);
  if (exp === null) return false;
  return exp * 1000 <= Date.now() + skewSeconds * 1000;
}
