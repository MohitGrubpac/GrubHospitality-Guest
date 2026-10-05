"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import CartCheckoutBar from "@/component/ui/CartCheckoutBar";
import OrderStatusPanel from "@/component/ui/OrderStatusPanel";
import { useCart } from "@/component/providers/CartProvider";
import { useOrders } from "@/component/providers/OrdersProvider";

/** Routes that own the bottom of the screen and must not get the dock. */
const CART_HIDDEN_ROUTES = ["/", "/login", "/signup", "/room-selection", "/cart"];
const ORDER_HIDDEN_ROUTES = ["/", "/login", "/signup", "/room-selection", "/cart", "/order-status", "/active-orders"];

const SWIPE_THRESHOLD = 50;
const TAP_SLOP = 6;
const CLICK_LOCK_MS = 350;

/**
 * One fixed slot for every bottom action. When the order tracker and the cart bar
 * are both up they become a horizontal carousel - one card visible at a time,
 * swipeable, with page dots - instead of stacking two bars on top of each other.
 * The measured height is published as `--bottom-dock-h` so scrollable screens can
 * pad their content out from under it.
 */
export default function BottomDock() {
  const pathname = usePathname();
  const dockRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, axis: null });
  const suppressClickRef = useRef(false);
  const [slide, setSlide] = useState(0);
  const [dragX, setDragX] = useState(null);

  const { itemCount } = useCart();
  const { hasActiveOrder } = useOrders();

  const showCart = itemCount > 0 && !CART_HIDDEN_ROUTES.includes(pathname);
  const showOrder = hasActiveOrder && !ORDER_HIDDEN_ROUTES.includes(pathname);
  const isCarousel = showCart && showOrder;

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

  const handlePointerDown = (event) => {
    if (!isCarousel || event.button !== 0) return;
    dragRef.current = { active: true, startX: event.clientX, startY: event.clientY, axis: null };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.active) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Vertical intent -> let the page scroll and bail out of the drag.
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.active = false;
        return;
      }
      drag.axis = "x";
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
    }

    // Rubber-band the edge so an over-drag at the first/last slide resists.
    let offset = dx;
    if ((slide === 0 && dx > 0) || (slide === 1 && dx < 0)) offset = dx * 0.3;
    setDragX(offset);
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag.active) return;

    const dx = drag.axis === "x" ? dragX ?? 0 : 0;

    if (drag.axis === "x") {
      // A real swipe must not leak into a click on the card underneath.
      if (Math.abs(dx) > TAP_SLOP) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, CLICK_LOCK_MS);
      }
      if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        if (dx < 0 && slide === 0) setSlide(1);
        else if (dx > 0 && slide === 1) setSlide(0);
      }
    }

    drag.active = false;
    drag.axis = null;
    setDragX(null);
  };

  if (!showCart && !showOrder) return null;

  return (
    <div
      ref={dockRef}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] sm:max-w-[768px] flex flex-col gap-2 px-4 pb-4 z-40 pointer-events-none"
    >
      <div
        className="pointer-events-auto overflow-hidden select-none"
        style={{ touchAction: "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(${-slide * 100}% + ${dragX ?? 0}px))`,
            transition: dragX === null ? "transform 300ms ease" : "none",
          }}
        >
          {showOrder && (
            <div className="min-w-full shrink-0">
              <OrderStatusPanel />
            </div>
          )}
          {showCart && (
            <div className="min-w-full shrink-0">
              <CartCheckoutBar />
            </div>
          )}
        </div>
      </div>

      {isCarousel && (
        <div className="pointer-events-auto flex items-center justify-center gap-1.5 -mt-1">
          <button
            type="button"
            aria-label="Show order status"
            onClick={() => setSlide(0)}
            className={`h-2 w-2 rounded-full transition-colors cursor-pointer ${
              slide === 0 ? "bg-[#fe480b]" : "bg-[#e0e3e1]"
            }`}
          />
          <button
            type="button"
            aria-label="Show checkout bar"
            onClick={() => setSlide(1)}
            className={`h-2 w-2 rounded-full transition-colors cursor-pointer ${
              slide === 1 ? "bg-[#fe480b]" : "bg-[#e0e3e1]"
            }`}
          />
        </div>
      )}
    </div>
  );
}
