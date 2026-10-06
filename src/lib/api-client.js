import { API_BASE_URL, API_TIMEOUT_MS } from "@/config/env";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getSessionGeneration,
  setTokens,
} from "@/lib/token-store";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "UNKNOWN_ERROR", requestId = null, body = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.body = body;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  get isValidationError() {
    return this.status === 400;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

function buildUrl(path, query) {
  const base = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const url = new URL(base);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function readBody(response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createSignal(signal, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", forwardAbort);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", forwardAbort);
    },
  };
}

let refreshInFlight = null;

/** Accepts top-level or wrapped ({data|session|tokens}) refresh payloads. */
function extractRefreshTokens(payload) {
  if (!payload || typeof payload !== "object") return {};

  const candidates = [payload, payload.data, payload.session, payload.tokens];
  for (const source of candidates) {
    if (!source || typeof source !== "object") continue;
    const accessToken = typeof source.accessToken === "string" ? source.accessToken : null;
    const refreshToken = typeof source.refreshToken === "string" ? source.refreshToken : null;
    if (accessToken || refreshToken) return { accessToken, refreshToken };
  }
  return {};
}

async function performRefresh() {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshInFlight = (async () => {
    try {
      const generation = getSessionGeneration();
      const response = await fetch(buildUrl("/guest-auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });

      if (!response.ok) {
        // 4xx = the refresh token itself was rejected -> the session is dead.
        // Network errors / 5xx keep the tokens so a later retry can recover.
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          clearTokens();
        }
        return false;
      }

      const payload = await response.json().catch(() => null);
      const { accessToken, refreshToken: rotated } = extractRefreshTokens(payload);

      // 200 with an unusable shape: keep what we have instead of wiping it.
      if (!accessToken) return false;

      // The session ended (logout) or was replaced while this refresh was in
      // flight - storing the result would log the guest straight back in.
      if (generation !== getSessionGeneration()) return false;

      setTokens({
        accessToken,
        ...(rotated ? { refreshToken: rotated } : {}),
      });

      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request(
  path,
  {
    method = "GET",
    body,
    query,
    auth = true,
    signal,
    timeout = API_TIMEOUT_MS,
    retryOnUnauthorized = true,
  } = {},
) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const accessToken = getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const { signal: requestSignal, cleanup } = createSignal(signal, timeout);

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestSignal,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError" && !signal?.aborted) {
      throw new ApiError("The request timed out. Please try again.", { status: 0 });
    }
    throw new ApiError("Unable to reach the server. Check your connection and try again.", {
      status: 0,
      code: "NETWORK_ERROR",
    });
  } finally {
    cleanup();
  }

  const payload = await readBody(response);

  if (response.ok) return payload;

  if (response.status === 401 && auth && retryOnUnauthorized && getRefreshToken()) {
    const refreshed = await performRefresh();
    if (refreshed) {
      return request(path, { method, body, query, auth, signal, timeout, retryOnUnauthorized: false });
    }
  }

  const errorBody = payload && typeof payload === "object" ? payload : {};

  throw new ApiError(errorBody.message || `Request failed with status ${response.status}`, {
    status: response.status,
    code: errorBody.error || "UNKNOWN_ERROR",
    requestId: errorBody.requestId || null,
    body: payload,
  });
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  refresh: performRefresh,
};

export { performRefresh as refreshSession };
