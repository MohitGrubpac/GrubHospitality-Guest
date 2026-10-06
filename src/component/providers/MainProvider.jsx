"use client";

import { Provider } from "react-redux";
import ToastProvider from "../ui/ToastProvider";
import { store } from "@/store";
import StoreEffects from "@/store/effects";

export default function MainProvider({ children }) {
  return (
    <Provider store={store}>
      <ToastProvider />
      <StoreEffects />
      {children}
    </Provider>
  );
}
