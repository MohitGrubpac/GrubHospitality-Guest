import { createSlice } from "@reduxjs/toolkit";

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

const roomSlice = createSlice({
  name: "room",
  initialState: {
    // The guest's own pick; the stored choice + booked rooms decide the rest.
    preferredRoom: null,
  },
  reducers: {
    preferredRoomSet(state, action) {
      state.preferredRoom = action.payload;
    },
  },
});

export const { preferredRoomSet } = roomSlice.actions;

export default roomSlice.reducer;

const selectBookedRooms = (state) => state.auth.guest?.roomNumbers || [];
const selectGuestId = (state) => state.auth.guest?.id;

/**
 * Rooms are owned by the PMS and arrive on the profile as `stay.roomNumbers[]`.
 * Which one an order is delivered to is a device-local choice: PATCH /guests/me
 * rejects `roomNumber`, so the selection is kept in localStorage and falls back to
 * the first booked room. Only valid bookings can be selected.
 */
export function setSelectedRoom(room) {
  return (dispatch, getState) => {
    const guestId = selectGuestId(getState());
    const bookedRooms = selectBookedRooms(getState());
    if (!room || !bookedRooms.includes(room)) return false;

    dispatch(preferredRoomSet(room));
    writeStoredRoom(guestId, room);
    return true;
  };
}

export function clearSelectedRoom() {
  return (dispatch, getState) => {
    const guestId = selectGuestId(getState());
    dispatch(preferredRoomSet(null));
    writeStoredRoom(guestId, null);
  };
}

export { readStoredRoom, selectBookedRooms, selectGuestId };
