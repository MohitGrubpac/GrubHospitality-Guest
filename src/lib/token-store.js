const ACCESS_TOKEN_KEY = "grubpac.guest.accessToken";
const REFRESH_TOKEN_KEY = "grubpac.guest.refreshToken";

const cache = {
  accessToken: null,
  refreshToken: null,
  hydrated: false,
};

const listeners = new Set();

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
  persist();
}

export function clearTokens() {
  cache.accessToken = null;
  cache.refreshToken = null;
  cache.hydrated = true;
  persist();
}

export function hasSession() {
  hydrate();
  return Boolean(cache.accessToken || cache.refreshToken);
}
