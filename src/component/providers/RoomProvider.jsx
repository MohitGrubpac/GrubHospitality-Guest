"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { showError } from "@/component/ui/Toast";
import { useAuth } from "@/component/providers/AuthProvider";

const RoomContext = createContext(null);

/**
 * The guest profile carries a single `roomNumber`. Room switching therefore just
 * persists the choice through PATCH /guests/me, which is what the kitchen reads
 * when building the order.
 */
export function RoomProvider({ children }) {
  const { guest, updateProfile } = useAuth();
  const [overrideRoom, setOverrideRoom] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const profileRoom = guest?.roomNumber || "";
  const room = profileRoom ? overrideRoom || profileRoom : "";

  const bookedRooms = useMemo(() => (profileRoom ? [profileRoom] : []), [profileRoom]);
  const isMultipleRooms = bookedRooms.length > 1;

  const setSelectedRoom = useCallback(
    async (nextRoom) => {
      if (!nextRoom || nextRoom === room) return;

      setOverrideRoom(nextRoom);

      if (!profileRoom || nextRoom === profileRoom) return;

      setIsSaving(true);
      try {
        await updateProfile({ roomNumber: nextRoom });
      } catch (roomError) {
        setOverrideRoom(null);
        showError("Could not update your room. Please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [room, profileRoom, updateProfile],
  );

  const value = useMemo(
    () => ({
      selectedRoom: room,
      setSelectedRoom,
      bookedRooms,
      isMultipleRooms,
      isSavingRoom: isSaving,
    }),
    [room, setSelectedRoom, bookedRooms, isMultipleRooms, isSaving],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
}
