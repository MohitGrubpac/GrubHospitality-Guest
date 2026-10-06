"use client";

import { useCallback, useMemo } from "react";
import {
  AUTH_STATUS,
  claimReservation,
  errorSet,
  loginWithGoogle,
  loginWithOtp,
  logout,
  organizationSet,
  refetchProfile,
  requestOtp,
  selectAuthStatus,
  updateProfile,
} from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export { AUTH_STATUS };

/**
 * Auth/session state now lives in the Redux store (`store/authSlice`). The hook keeps
 * the exact shape the screens already consume, so callers did not have to change.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const guest = useAppSelector((state) => state.auth.guest);
  const organizationId = useAppSelector((state) => state.auth.organizationId);
  const isSubmitting = useAppSelector((state) => state.auth.isSubmitting);
  const error = useAppSelector((state) => state.auth.error);

  const setOrganization = useCallback(
    (nextOrganizationId) => dispatch(organizationSet(nextOrganizationId)),
    [dispatch],
  );
  const setError = useCallback((nextError) => dispatch(errorSet(nextError)), [dispatch]);
  const requestOtpAction = useCallback((args) => dispatch(requestOtp(args)), [dispatch]);
  const loginWithOtpAction = useCallback((args) => dispatch(loginWithOtp(args)), [dispatch]);
  const loginWithGoogleAction = useCallback(
    (args) => dispatch(loginWithGoogle(args)),
    [dispatch],
  );
  const claimReservationAction = useCallback(
    (args) => dispatch(claimReservation(args)),
    [dispatch],
  );
  const updateProfileAction = useCallback((patch) => dispatch(updateProfile(patch)), [dispatch]);
  const refetchProfileAction = useCallback(() => dispatch(refetchProfile()), [dispatch]);
  const logoutAction = useCallback(() => dispatch(logout()), [dispatch]);

  return useMemo(
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
      requestOtp: requestOtpAction,
      loginWithOtp: loginWithOtpAction,
      loginWithGoogle: loginWithGoogleAction,
      claimReservation: claimReservationAction,
      updateProfile: updateProfileAction,
      refetchProfile: refetchProfileAction,
      logout: logoutAction,
    }),
    [
      status,
      guest,
      organizationId,
      setOrganization,
      isSubmitting,
      error,
      setError,
      requestOtpAction,
      loginWithOtpAction,
      loginWithGoogleAction,
      claimReservationAction,
      updateProfileAction,
      refetchProfileAction,
      logoutAction,
    ],
  );
}
