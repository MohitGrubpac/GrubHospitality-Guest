import { apiClient } from "@/lib/api-client";

export const OTP_CHANNEL = {
  EMAIL: "EMAIL",
  PHONE: "PHONE",
};

export const OTP_PURPOSE = {
  SIGNUP: "SIGNUP",
  LOGIN: "LOGIN",
};

const authless = { auth: false, retryOnUnauthorized: false };

/** GET /guest-auth/reservation/{token} */
export function resolveSignupReservation(token) {
  return apiClient.get(`/guest-auth/reservation/${encodeURIComponent(token)}`, authless);
}

/** POST /guest-auth/otp/request */
export function requestOtp({ organizationId, channel, destination, purpose }) {
  return apiClient.post(
    "/guest-auth/otp/request",
    { organizationId, channel, destination, purpose },
    authless,
  );
}

/** POST /guest-auth/signup */
export function signupGuest(payload) {
  return apiClient.post("/guest-auth/signup", payload, authless);
}

/** POST /guest-auth/login */
export function loginGuestWithOtp({ organizationId, channel, destination, otp }) {
  return apiClient.post(
    "/guest-auth/login",
    { organizationId, channel, destination, otp },
    authless,
  );
}

/** POST /guest-auth/google */
export function loginGuestWithGoogle({ organizationId, idToken }) {
  return apiClient.post("/guest-auth/google", { organizationId, idToken }, authless);
}

/** POST /guest-auth/refresh */
export function refreshGuestSession(refreshToken) {
  return apiClient.post("/guest-auth/refresh", { refreshToken }, authless);
}

/** POST /guest-auth/logout */
export function logoutGuest() {
  return apiClient.post("/guest-auth/logout");
}
