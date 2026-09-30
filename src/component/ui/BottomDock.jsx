"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import CartCheckoutBar from "@/component/ui/CartCheckoutBar";
import OrderStatusPanel from "@/component/ui/OrderStatusPanel";
import { useCart } from "@/component/providers/CartProvider";
import { useOrders } from "@/component/providers/OrdersProvider";

/** Routes that own the bottom of the screen and must not get the dock. */
const CART_HIDDEN_ROUTES = ["/", "/login", "/cart"];
const ORDER_HIDDEN_ROUTES = ["/", "/login", "/cart", "/order-status"];

/**
 * One fixed stack for every bottom action, so the cart bar and the order tracker can
 * never overlap or guess at each other's height - they are laid out as siblings with
 * a gap, which is what the design calls for.
 *
 * The measured height is published as `--bottom-dock-h` so scrollable screens can pad
 * their content out from under it.
 */
export default function BottomDock() {
  const pathname = usePathname();
  const dockRef = useRef(null);

  const { itemCount } = useCart();
  const { hasActiveOrder } = useOrders();

  const showCart = itemCount > 0 && !CART_HIDDEN_ROUTES.includes(pathname);
  const showOrder = hasActiveOrder && !ORDER_HIDDEN_ROUTES.includes(pathname);

  useEffect(() => {
    const root = document.documentElement;

    if (!showCart && !showOrder) {
      root.style.setProperty("--bottom-dock-h", "0px");
      return undefined;
    }

    const measure = () => {
      const height = dockRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--bottom-dock-h", `${height}px`);
    };

    measure();

    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(measure);
    if (dockRef.current) observer.observe(dockRef.current);

    return () => {
      observer.disconnect();
      root.style.setProperty("--bottom-dock-h", "0px");
    };
  }, [showCart, showOrder]);

  if (!showCart && !showOrder) return null;

  return (
    <div
      ref={dockRef}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] sm:max-w-[768px] flex flex-col gap-2 px-4 pb-4 z-40 pointer-events-none"
    >
      {showOrder && (
        <div className="pointer-events-auto">
          <OrderStatusPanel />
        </div>
      )}
      {showCart && (
        <div className="pointer-events-auto">
          <CartCheckoutBar />
        </div>
      )}
    </div>
  );
}
