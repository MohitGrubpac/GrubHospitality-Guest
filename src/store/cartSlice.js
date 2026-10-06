import { createSlice } from "@reduxjs/toolkit";
import { showError } from "@/component/ui/Toast";
import { ApiError } from "@/lib/api-client";
import { EMPTY_CART, resolveSpecialInstructions, toCartView } from "@/lib/adapters/cartAdapter";
import { selectIsAuthenticated } from "@/store/authSlice";
import { toErrorInfo } from "@/store/errorInfo";
import * as cartService from "@/services/cartService";

const CHECKOUT_KEY = "__checkout__";

// Guards against out-of-order responses when the user taps quickly: only the most
// recent cart request may write state (module level - it must survive re-renders).
let requestSeq = 0;
const nextRequestId = () => ++requestSeq;
const isCurrent = (requestId) => requestId === requestSeq;

const cartSlice = createSlice({
  name: "cart",
  initialState: {
    // Raw server payload; derived into a cart view inside the useCart hook.
    rawCart: null,
    mutatingId: null,
    error: null,
  },
  reducers: {
    cartSet(state, action) {
      state.rawCart = action.payload;
    },
    cartReset(state) {
      state.rawCart = null;
      state.mutatingId = null;
      state.error = null;
    },
    mutatingSet(state, action) {
      state.mutatingId = action.payload;
    },
    cartErrorSet(state, action) {
      state.error = action.payload;
    },
  },
});

export const { cartSet, cartReset, mutatingSet, cartErrorSet } = cartSlice.actions;

export default cartSlice.reducer;

/** GET /guest/cart - the first server read after sign-in. */
export function refreshCart() {
  return async (dispatch, getState) => {
    if (!selectIsAuthenticated(getState())) return;

    const requestId = nextRequestId();
    try {
      const raw = await cartService.getCart();
      // A response that lands after sign-out must not repopulate the cart.
      if (!isCurrent(requestId) || !selectIsAuthenticated(getState())) return;
      dispatch(cartSet(raw));
      dispatch(cartErrorSet(null));
    } catch (cartError) {
      if (!isCurrent(requestId)) return;
      if (!(cartError instanceof ApiError && cartError.isUnauthorized)) {
        dispatch(cartErrorSet(toErrorInfo(cartError)));
      }
    }
  };
}

/**
 * Single writer for every cart mutation: applies the server's response, stores a
 * serialisable error and surfaces the toast the way the old context did.
 */
async function runMutation(dispatch, getState, key, action) {
  const requestId = nextRequestId();
  dispatch(mutatingSet(key));
  dispatch(cartErrorSet(null));

  try {
    const raw = await action();
    if (!isCurrent(requestId)) return raw;
    dispatch(cartSet(raw));
    return raw;
  } catch (mutationError) {
    if (mutationError instanceof ApiError) {
      dispatch(cartErrorSet(toErrorInfo(mutationError)));
      if (!mutationError.isUnauthorized) showError(mutationError.message);
    } else {
      dispatch(cartErrorSet(toErrorInfo(mutationError)));
      showError("Something went wrong. Please try again.");
    }
    return null;
  } finally {
    if (isCurrent(requestId) || getState().cart.mutatingId === key) {
      dispatch(mutatingSet(null));
    }
  }
}

export function addToCart({ menuItemId, quantity = 1, note = null }) {
  return async (dispatch, getState) => {
    if (!menuItemId) return null;
    return runMutation(dispatch, getState, menuItemId, () =>
      cartService.addCartItem({ menuItemId, quantity, note }),
    );
  };
}

export function setQuantity({ menuItemId, quantity, note }) {
  return async (dispatch, getState) => {
    if (!menuItemId) return null;
    return runMutation(dispatch, getState, menuItemId, () =>
      cartService.updateCartItem(menuItemId, { quantity, note }),
    );
  };
}

/** Absolute step (derived from the current view of the cart). */
export function changeQuantity(menuItemId, delta = 1) {
  return async (dispatch, getState) => {
    const cart = getState().cart.rawCart ? toCartView(getState().cart.rawCart) : EMPTY_CART;
    const entry = cart.items.find((item) => item.item.id === menuItemId);
    if (!entry) return null;

    const next = entry.qty + delta;
    if (next <= 0) return dispatch(removeItem(menuItemId));
    return dispatch(setQuantity({ menuItemId, quantity: next }));
  };
}

export function removeItem(menuItemId) {
  return async (dispatch, getState) => {
    if (!menuItemId) return null;
    return runMutation(dispatch, getState, menuItemId, () =>
      cartService.removeCartItem(menuItemId),
    );
  };
}

export function setNote(menuItemId, note) {
  return async (dispatch, getState) => {
    const cart = getState().cart.rawCart ? toCartView(getState().cart.rawCart) : EMPTY_CART;
    const entry = cart.items.find((item) => item.item.id === menuItemId);
    if (!entry) return null;

    return runMutation(dispatch, getState, menuItemId, () =>
      cartService.updateCartItem(menuItemId, { quantity: entry.qty, note }),
    );
  };
}

export function clearCart() {
  return async (dispatch, getState) =>
    runMutation(dispatch, getState, "__all__", () => cartService.clearCart());
}

export function checkout({ specialInstructions, roomNumber, scheduledAt } = {}) {
  return async (dispatch, getState) => {
    const requestId = nextRequestId();
    dispatch(mutatingSet(CHECKOUT_KEY));
    dispatch(cartErrorSet(null));

    try {
      const orders = await cartService.checkoutGuestCart({
        specialInstructions: specialInstructions?.trim() || undefined,
        roomNumber,
        scheduledAt,
      });

      if (isCurrent(requestId)) {
        // The server clears the cart once orders are placed; re-read it so the
        // UI reflects whatever the backend considers remaining.
        dispatch(refreshCart());
      }

      return orders || [];
    } catch (checkoutError) {
      if (checkoutError instanceof ApiError) {
        dispatch(cartErrorSet(toErrorInfo(checkoutError)));
        showError(checkoutError.message);
      } else {
        showError("Unable to place your order. Please try again.");
      }
      return [];
    } finally {
      if (isCurrent(requestId) || getState().cart.mutatingId === CHECKOUT_KEY) {
        dispatch(mutatingSet(null));
      }
    }
  };
}

/** Sequential so each response refreshes the cart with the server total. */
export function reorderItems(entries = []) {
  return async (dispatch) => {
    const results = [];
    for (const entry of entries) {
      if (!entry?.menuItemId) continue;
      results.push(
        await dispatch(addToCart({ menuItemId: entry.menuItemId, quantity: entry.qty || 1 })),
      );
    }
    return results;
  };
}
