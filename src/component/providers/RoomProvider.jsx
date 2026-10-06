"use client";

import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearSelectedRoom as clearSelectedRoomAction,
  readStoredRoom,
  setSelectedRoom as setSelectedRoomAction,
} from "@/store/roomSlice";

/**
 * Rooms are owned by the PMS and arrive on the profile as `stay.roomNumbers[]`.
 * Which one an order is delivered to is a device-local choice kept in localStorage
 * (PATCH /guests/me rejects `roomNumber`); the selection lives in `store/roomSlice`.
 */
const EMPTY_ROOMS = [];

export function useRoom() {
  const dispatch = useAppDispatch();
  const guestId = useAppSelector((state) => state.auth.guest?.id);
  const roomNumbers = useAppSelector((state) => state.auth.guest?.roomNumbers);
  const preferredRoom = useAppSelector((state) => state.room.preferredRoom);

  const bookedRooms = useMemo(() => roomNumbers || EMPTY_ROOMS, [roomNumbers]);

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
    (room) => dispatch(setSelectedRoomAction(room)),
    [dispatch],
  );
  const clearSelectedRoom = useCallback(
    () => dispatch(clearSelectedRoomAction()),
    [dispatch],
  );

  const isMultipleRooms = bookedRooms.length > 1;
  const hasStoredChoice = Boolean(readStoredRoom(guestId));

  return useMemo(
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
    [
      selectedRoom,
      setSelectedRoom,
      clearSelectedRoom,
      bookedRooms,
      isMultipleRooms,
      hasStoredChoice,
    ],
  );
}
