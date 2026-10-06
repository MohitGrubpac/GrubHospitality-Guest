import { createSlice } from "@reduxjs/toolkit";
import { ORGANIZATION_ID } from "@/config/env";
import { ApiError, refreshSession } from "@/lib/api-client";
import { invalidateRequests } from "@/lib/request-cache";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasSession,
  isAccessTokenExpired,
  setTokens,
} from "@/lib/token-store";
import { toGuestUser } from "@/lib/adapters/guestAdapter";
import { toErrorInfo } from "@/store/errorInfo";
import * as authService from "@/services/authService";
import * as guestService from "@/services/guestService";

export const AUTH_STATUS = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  ANONYMOUS: "anonymous",
};

// Screens re-read the profile on every visit; a response younger than this is
// reused instead of stacking another GET /guests/me.
const PROFILE_MAX_AGE_MS = 30000;

// Session bookkeeping that must not live in reducers: a token refresh already in
// flight can resolve after logout, and the profile has a small freshness window.
let sessionEnded = false;
let profileFetchedAt = 0;

const authSlice = createSlice({
  name: "auth",
  initialState: {
    // Mirrors the token store; SessionEffects keeps it in sync.
    hasStoredSession: true,
    sessionStatus: AUTH_STATUS.LOADING,
    guest: null,
    organizationId: ORGANIZATION_ID,
    isSubmitting: false,
    error: null,
  },
  reducers: {
    sessionKnown(state, action) {
      state.hasStoredSession = action.payload;
      if (!action.payload) {
        state.guest = null;
        state.sessionStatus = AUTH_STATUS.ANONYMOUS;
      }
    },
    sessionAuthenticated(state) {
      state.sessionStatus = AUTH_STATUS.AUTHENTICATED;
      state.error = null;
    },
    guestSet(state, action) {
      state.guest = action.payload;
    },
    sessionCleared(state) {
      state.guest = null;
      state.sessionStatus = AUTH_STATUS.ANONYMOUS;
    },
    submittingSet(state, action) {
      state.isSubmitting = action.payload;
    },
    errorSet(state, action) {
      state.error = action.payload;
    },
    organizationSet(state, action) {
      state.organizationId = action.payload || "";
    },
  },
});

export const {
  sessionKnown,
  sessionAuthenticated,
  guestSet,
  sessionCleared,
  submittingSet,
  errorSet,
  organizationSet,
} = authSlice.actions;

export const selectAuthStatus = (state) =>
  state.auth.hasStoredSession ? state.auth.sessionStatus : AUTH_STATUS.ANONYMOUS;

export const selectIsAuthenticated = (state) =>
  selectAuthStatus(state) === AUTH_STATUS.AUTHENTICATED;

export default authSlice.reducer;

/** Stores the tokens of a brand-new session and drops the previous guest's caches. */
function applySession(session) {
  sessionEnded = false;
  invalidateRequests();
  setTokens({
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
  });

  const adapted = toGuestUser(session?.guest);
  profileFetchedAt = Date.now();
  return adapted;
}

/** Ends the session locally - also invalidates any refresh still in flight. */
function endSession() {
  sessionEnded = true;
  profileFetchedAt = 0;
  invalidateRequests();
  clearTokens();
}

/** Restores the stored session on app load: refresh if needed, then GET /guests/me. */
export function bootstrapSession() {
  return async (dispatch) => {
    if (!hasSession()) return;

    // Tokens reappeared after an explicit logout (a refresh that landed late):
    // drop them again instead of bootstrapping a session the guest just ended.
    if (sessionEnded) {
      clearTokens();
      return;
    }

    try {
      if (getRefreshToken() && (!getAccessToken() || isAccessTokenExpired())) {
        await refreshSession();
      }
      // Logged out while the refresh was in flight - stop before touching state.
      if (sessionEnded) return;

      // Login already hands us the profile, so the round-trip is only needed for
      // a restored (page load) session.
      const isProfileFresh =
        profileFetchedAt > 0 && Date.now() - profileFetchedAt < PROFILE_MAX_AGE_MS;

      if (!isProfileFresh) {
        const profile = await guestService.getGuestProfile();
        if (sessionEnded) return;
        profileFetchedAt = Date.now();
        dispatch(guestSet(toGuestUser(profile)));
      }

      dispatch(sessionAuthenticated());
    } catch (bootstrapError) {
      if (
        bootstrapError instanceof ApiError &&
        bootstrapError.isUnauthorized &&
        !getRefreshToken()
      ) {
        clearTokens();
      }
      dispatch(sessionCleared());
    }
  };
}

/** Re-reads GET /guests/me, unless a younger response is already in hand. */
export function refetchProfile() {
  return async (dispatch, getState) => {
    const isProfileFresh =
      profileFetchedAt > 0 && Date.now() - profileFetchedAt < PROFILE_MAX_AGE_MS;
    if (isProfileFresh) return getState().auth.guest;

    try {
      const profile = await guestService.getGuestProfile();
      if (sessionEnded) return null;
      const next = toGuestUser(profile);
      profileFetchedAt = Date.now();
      dispatch(guestSet(next));
      dispatch(sessionAuthenticated());
      return next;
    } catch (refetchError) {
      if (refetchError instanceof ApiError && refetchError.isUnauthorized && !getRefreshToken()) {
        clearTokens();
        dispatch(sessionCleared());
      }
      return null;
    }
  };
}

function requireOrganization(getState) {
  const organizationId = getState().auth.organizationId;
  if (organizationId) return organizationId;

  throw new ApiError("Hotel organization is not configured. Please contact the front desk.", {
    status: 0,
    code: "ORGANIZATION_NOT_CONFIGURED",
  });
}

export function requestOtp({ channel, destination, purpose }) {
  return async (_dispatch, getState) => {
    const organizationId = requireOrganization(getState);
    return authService.requestOtp({ organizationId, channel, destination, purpose });
  };
}

export function loginWithOtp({ channel, destination, otp }) {
  return async (dispatch, getState) => {
    const organizationId = requireOrganization(getState);

    dispatch(submittingSet(true));
    try {
      const session = await authService.loginGuestWithOtp({
        organizationId,
        channel,
        destination,
        otp,
      });
      const adapted = applySession(session);
      dispatch(guestSet(adapted));
      dispatch(sessionAuthenticated());
      return adapted;
    } finally {
      dispatch(submittingSet(false));
    }
  };
}

export function loginWithGoogle({ idToken }) {
  return async (dispatch, getState) => {
    const organizationId = requireOrganization(getState);

    dispatch(submittingSet(true));
    try {
      const session = await authService.loginGuestWithGoogle({ organizationId, idToken });
      const adapted = applySession(session);
      dispatch(guestSet(adapted));
      dispatch(sessionAuthenticated());
      return adapted;
    } finally {
      dispatch(submittingSet(false));
    }
  };
}

export function claimReservation({ token, otpChannel, otp, profile }) {
  return async (dispatch) => {
    dispatch(submittingSet(true));
    try {
      const session = await authService.signupGuest({
        token,
        otpChannel,
        otp,
        ...profile,
      });
      const adapted = applySession(session);
      dispatch(guestSet(adapted));
      dispatch(sessionAuthenticated());
      return adapted;
    } finally {
      dispatch(submittingSet(false));
    }
  };
}

export function updateProfile(patch) {
  return async (dispatch) => {
    const updated = await guestService.updateGuestProfile(patch);
    profileFetchedAt = Date.now();
    dispatch(guestSet(toGuestUser(updated)));
    return updated;
  };
}

export function logout() {
  return async (dispatch) => {
    try {
      await authService.logoutGuest();
    } catch {
      // The local session is dropped regardless - the token is gone either way.
    } finally {
      endSession();
      dispatch(sessionCleared());
      dispatch(errorSet(null));
    }
  };
}
