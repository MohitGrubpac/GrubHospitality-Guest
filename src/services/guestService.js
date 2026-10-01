import { apiClient } from "@/lib/api-client";

/** GET /guests/me */
export function getGuestProfile() {
  return apiClient.get("/guests/me");
}

/**
 * PATCH /guests/me
 *
 * The endpoint validates the body strictly and currently accepts `name` only -
 * anything else (including `roomNumber`) is rejected with 400. Rooms live on the
 * reservation (`stay.roomNumbers[]`) and are chosen on the device, not patched here.
 */
export function updateGuestProfile(patch) {
  const payload = {};

  if (patch.name !== undefined) payload.name = patch.name;

  return apiClient.patch("/guests/me", payload);
}
