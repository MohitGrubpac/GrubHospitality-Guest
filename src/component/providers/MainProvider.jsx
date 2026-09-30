"use client";

import ToastProvider from "../ui/ToastProvider";
import { AuthProvider } from "./AuthProvider";
import { CartProvider } from "./CartProvider";
import { OrdersProvider } from "./OrdersProvider";
import { RoomProvider } from "./RoomProvider";

export default function MainProvider({ children }) {
  return (
    <>
      <ToastProvider />
      <AuthProvider>
        <RoomProvider>
          <CartProvider>
            <OrdersProvider>{children}</OrdersProvider>
          </CartProvider>
        </RoomProvider>
      </AuthProvider>
    </>
  );
}
