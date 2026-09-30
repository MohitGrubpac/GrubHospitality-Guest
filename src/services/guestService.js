import { apiClient } from "@/lib/api-client";

/** GET /guests/me */
export function getGuestProfile() {
  return apiClient.get("/guests/me");
}

/**
 * PATCH /guests/me
 * All fields optional; email and phone are not editable here.
 */
export function updateGuestProfile(patch) {
  const payload = {};

  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.roomNumber !== undefined) payload.roomNumber = patch.roomNumber;
  if (patch.checkInAt !== undefined) payload.checkInAt = patch.checkInAt;
  if (patch.checkOutAt !== undefined) payload.checkOutAt = patch.checkOutAt;

  return apiClient.patch("/guests/me", payload);
}
