"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/component/providers/CartProvider";

/**
 * Rendered inside BottomDock, so it is a plain block - the dock owns the fixed
 * positioning, the horizontal inset and the spacing between stacked bars.
 */
export default function CartCheckoutBar() {
  const router = useRouter();
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/cart")}
      className="w-full flex items-center justify-between bg-white border border-[#fe480b] rounded-xl px-5 py-4 shadow-[0px_8px_30px_rgba(0,0,0,0.12)] cursor-pointer active:scale-[0.98] transition-transform"
      id="cart-checkout-bar"
    >
      {/* Left: icon + count */}
      <div className="flex items-center gap-3">
        <Image
          src="/kitchen/cloche.svg"
          alt="Cloche"
          width={22}
          height={22}
          className="w-5.5 h-5.5 object-contain shrink-0"
          sizes="22px"
        />
        <span className="text-[16px] font-bold text-[#37493F]">
          {itemCount} {itemCount === 1 ? "item" : "items"} added
        </span>
      </div>

      {/* Right: CHECKOUT */}
      <div className="flex items-center gap-2">
        <span className="text-[16px] font-semibold text-[#6B7971] uppercase tracking-wide">
          Checkout
        </span>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M6.5 13.5L11 9L6.5 4.5"
            stroke="#6B7971"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </button>
  );
}
