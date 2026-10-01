"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "@/component/providers/AuthProvider";

const RoomContext = createContext(null);

const STORAGE_PREFIX = "grubpac.selectedRoom.";

function readStoredRoom(guestId) {
  if (!guestId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${guestId}`);
  } catch {
    return null;
  }
}

function writeStoredRoom(guestId, room) {
  if (!guestId || typeof window === "undefined") return;
  try {
    if (room) window.localStorage.setItem(`${STORAGE_PREFIX}${guestId}`, room);
    else window.localStorage.removeItem(`${STORAGE_PREFIX}${guestId}`);
  } catch {
    /* storage unavailable - the choice just will not survive a reload */
  }
}

/**
 * Rooms are owned by the PMS and arrive on the profile as `stay.roomNumbers[]`.
 * Which one an order is delivered to is a device-local choice: PATCH /guests/me now
 * rejects `roomNumber` (its schema accepts `name` only), so the selection is kept in
 * localStorage and falls back to the first booked room.
 */
export function RoomProvider({ children }) {
  const { guest } = useAuth();

  const guestId = guest?.id;
  const bookedRooms = useMemo(() => guest?.roomNumbers || [], [guest?.roomNumbers]);

  const [preferredRoom, setPreferredRoom] = useState(null);

  // Validate the stored choice against the rooms the guest actually holds - the
  // reservation can change between visits.
  const selectedRoom = useMemo(() => {
    if (bookedRooms.length === 0) return "";
    if (preferredRoom && bookedRooms.includes(preferredRoom)) return preferredRoom;

    const stored = readStoredRoom(guestId);
    if (stored && bookedRooms.includes(stored)) return stored;

    return bookedRooms[0];
  }, [bookedRooms, preferredRoom, guestId]);

  const setSelectedRoom = useCallback(
    (room) => {
      if (!room || !bookedRooms.includes(room)) return false;
      setPreferredRoom(room);
      writeStoredRoom(guestId, room);
      return true;
    },
    [bookedRooms, guestId],
  );

  const clearSelectedRoom = useCallback(() => {
    setPreferredRoom(null);
    writeStoredRoom(guestId, null);
  }, [guestId]);

  const isMultipleRooms = bookedRooms.length > 1;
  const hasStoredChoice = Boolean(readStoredRoom(guestId));

  const value = useMemo(
    () => ({
      selectedRoom,
      setSelectedRoom,
      clearSelectedRoom,
      bookedRooms,
      isMultipleRooms,
      hasSelectedRoom: Boolean(selectedRoom),
      // True when the guest has a choice to make and has not made it yet.
      needsRoomSelection: isMultipleRooms && !hasStoredChoice,
    }),
    [selectedRoom, setSelectedRoom, clearSelectedRoom, bookedRooms, isMultipleRooms, hasStoredChoice],
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
