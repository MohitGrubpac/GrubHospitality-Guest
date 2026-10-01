"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ORGANIZATION_ID } from "@/config/env";
import { ApiError, refreshSession } from "@/lib/api-client";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasSession,
  isAccessTokenExpired,
  setTokens,
  subscribeToSession,
} from "@/lib/token-store";
import { toGuestUser } from "@/lib/adapters/guestAdapter";
import * as authService from "@/services/authService";
import * as guestService from "@/services/guestService";

const AuthContext = createContext(null);

export const AUTH_STATUS = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  ANONYMOUS: "anonymous",
};

export function AuthProvider({ children }) {
  // Presence of a stored session (access OR refresh token) is read as an external
  // store so the very first client render already knows whether a session is being
  // validated, instead of bouncing through a setState-in-effect reset. Refresh-only
  // sessions must enter LOADING so the refresh token can restore them.
  const hasStoredSession = useSyncExternalStore(
    subscribeToSession,
    () => hasSession(),
    () => true,
  );

  const [sessionStatus, setSessionStatus] = useState(AUTH_STATUS.LOADING);
  const [guest, setGuest] = useState(null);
  const [organizationId, setOrganizationId] = useState(ORGANIZATION_ID);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const status = hasStoredSession ? sessionStatus : AUTH_STATUS.ANONYMOUS;

  // Returns the *adapted* guest, so callers get the normalised shape
  // (e.g. `roomNumbers`) rather than the raw API payload.
  const applySession = useCallback((session) => {
    setTokens({
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
    });

    const adapted = toGuestUser(session?.guest);
    setGuest(adapted);
    setSessionStatus(AUTH_STATUS.AUTHENTICATED);
    setError(null);
    return adapted;
  }, []);

  const endSession = useCallback(() => {
    clearTokens();
    setGuest(null);
    setSessionStatus(AUTH_STATUS.ANONYMOUS);
  }, []);

  // Startup: restore the stored session, then confirm it with GET /guests/me.
  // - Refresh-only or expired-JWT sessions are proactively refreshed first, so the
  //   refresh token is actually used instead of dead-ending on a 401.
  // - Tokens are only dropped when no refresh token remains (a definitive auth
  //   failure clears them inside api-client); transient refresh failures keep the
  //   session so a reload can recover.
  useEffect(() => {
    if (!hasStoredSession) return undefined;

    let cancelled = false;

    (async () => {
      try {
        if (getRefreshToken() && (!getAccessToken() || isAccessTokenExpired())) {
          await refreshSession();
        }

        const profile = await guestService.getGuestProfile();
        if (cancelled) return;
        setGuest(toGuestUser(profile));
        setSessionStatus(AUTH_STATUS.AUTHENTICATED);
      } catch (bootstrapError) {
        if (cancelled) return;
        if (bootstrapError instanceof ApiError && bootstrapError.isUnauthorized && !getRefreshToken()) {
          clearTokens();
        }
        setGuest(null);
        setSessionStatus(AUTH_STATUS.ANONYMOUS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasStoredSession]);

  const setOrganization = useCallback((nextOrganizationId) => {
    setOrganizationId(nextOrganizationId || "");
  }, []);

  const requestOtp = useCallback(
    async ({ channel, destination, purpose }) => {
      if (!organizationId) {
        const missingOrg = new ApiError(
          "Hotel organization is not configured. Please contact the front desk.",
          { status: 0, code: "ORGANIZATION_NOT_CONFIGURED" },
        );
        throw missingOrg;
      }

      return authService.requestOtp({ organizationId, channel, destination, purpose });
    },
    [organizationId],
  );

  const loginWithOtp = useCallback(
    async ({ channel, destination, otp }) => {
      if (!organizationId) {
        throw new ApiError("Hotel organization is not configured.", {
          status: 0,
          code: "ORGANIZATION_NOT_CONFIGURED",
        });
      }

      setIsSubmitting(true);
      try {
        const session = await authService.loginGuestWithOtp({
          organizationId,
          channel,
          destination,
          otp,
        });
        return applySession(session);
      } finally {
        setIsSubmitting(false);
      }
    },
    [applySession, organizationId],
  );

  const loginWithGoogle = useCallback(
    async ({ idToken }) => {
      if (!organizationId) {
        throw new ApiError("Hotel organization is not configured.", {
          status: 0,
          code: "ORGANIZATION_NOT_CONFIGURED",
        });
      }

      setIsSubmitting(true);
      try {
        const session = await authService.loginGuestWithGoogle({ organizationId, idToken });
        return applySession(session);
      } finally {
        setIsSubmitting(false);
      }
    },
    [applySession, organizationId],
  );

  const claimReservation = useCallback(
    async ({ token, otpChannel, otp, profile }) => {
      setIsSubmitting(true);
      try {
        const session = await authService.signupGuest({
          token,
          otpChannel,
          otp,
          ...profile,
        });
        return applySession(session);
      } finally {
        setIsSubmitting(false);
      }
    },
    [applySession],
  );

  const updateProfile = useCallback(async (patch) => {
    const updated = await guestService.updateGuestProfile(patch);
    setGuest(toGuestUser(updated));
    return updated;
  }, []);

  /** Re-reads GET /guests/me, for screens that must not render a stale profile. */
  const refetchProfile = useCallback(async () => {
    try {
      const profile = await guestService.getGuestProfile();
      const next = toGuestUser(profile);
      setGuest(next);
      setSessionStatus(AUTH_STATUS.AUTHENTICATED);
      return next;
    } catch (refetchError) {
      if (refetchError instanceof ApiError && refetchError.isUnauthorized && !getRefreshToken()) {
        clearTokens();
        setGuest(null);
        setSessionStatus(AUTH_STATUS.ANONYMOUS);
      }
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logoutGuest();
    } catch (logoutError) {
      // The local session is dropped regardless - the token is gone either way.
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo(
    () => ({
      status,
      isLoading: status === AUTH_STATUS.LOADING,
      isAuthenticated: status === AUTH_STATUS.AUTHENTICATED,
      guest,
      user: guest,
      organizationId,
      setOrganization,
      isSubmitting,
      error,
      setError,
      requestOtp,
      loginWithOtp,
      loginWithGoogle,
      claimReservation,
      updateProfile,
      refetchProfile,
      logout,
    }),
    [
      status,
      guest,
      organizationId,
      setOrganization,
      isSubmitting,
      error,
      requestOtp,
      loginWithOtp,
      loginWithGoogle,
      claimReservation,
      updateProfile,
      refetchProfile,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
