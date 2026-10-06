import { apiClient } from "@/lib/api-client";

/** GET /guest/kitchens */
export function listGuestKitchens() {
  return apiClient.get("/guest/kitchens");
}

/** GET /guest/kitchens/{kitchenId}/menu */
export function getGuestKitchenMenu(kitchenId) {
  return apiClient.get(`/guest/kitchens/${encodeURIComponent(kitchenId)}/menu`);
}
