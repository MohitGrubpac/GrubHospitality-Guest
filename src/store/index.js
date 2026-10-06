import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/authSlice";
import cartReducer from "@/store/cartSlice";
import ordersReducer from "@/store/ordersSlice";
import roomReducer from "@/store/roomSlice";

/**
 * All guest-app state lives here: auth/session, the server cart, tracked orders
 * and the room choice. Server data stays in the store as plain serialisable
 * payloads; the side effects (fetches, polling, localStorage) run in thunks and
 * in the effects components rendered by MainProvider.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    orders: ordersReducer,
    room: roomReducer,
  },
});
