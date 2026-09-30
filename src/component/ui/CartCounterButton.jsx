"use client";

import { useCart } from "@/component/providers/CartProvider";

/**
 * Server-authoritative add / increment / decrement control. Quantity is read from
 * the cart returned by the API, never from local state.
 */
export default function CartCounterButton({
  menuItemId,
  addClassName = "",
  disabled = false,
  addLabel = "ADD",
}) {
  const { items, addToCart, increment, mutatingId, isLoading } = useCart();

  const entry = items.find((item) => item.item.id === menuItemId);
  const qty = entry?.qty || 0;
  const isBusy = isLoading || mutatingId === menuItemId;

  if (disabled) {
    return (
      <span
        className={`flex items-center justify-center h-[36px] px-[16px] rounded-[8px] border border-[#d7dbd9] bg-[#f4f5f4] text-[13px] font-semibold uppercase text-[#9aa49f] ${addClassName}`}
      >
        Out of stock
      </span>
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        disabled={isBusy}
        onClick={(event) => {
          event.stopPropagation();
          addToCart({ menuItemId, quantity: 1 });
        }}
        className={`flex items-center gap-[8px] h-[36px] px-[16px] bg-white rounded-[8px] border border-[var(--gp-color-brand-primary)] cursor-pointer hover:bg-[var(--gp-color-bg-brand-secondary)] transition-colors disabled:opacity-60 ${addClassName}`}
        aria-label="Add to cart"
      >
        <span className="text-[16px] leading-none text-[var(--gp-color-brand-primary)]">
          +
        </span>
        <span className="text-[14px] font-semibold text-[var(--gp-color-brand-primary)] uppercase">
          {addLabel}
        </span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center h-[36px] rounded-[8px] border border-[var(--gp-color-brand-primary)] overflow-hidden bg-white"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={isBusy}
        onClick={() => increment(menuItemId, -1)}
        className="w-[36px] h-full flex items-center justify-center text-[var(--gp-color-brand-primary)] text-[18px] font-bold hover:bg-[var(--gp-color-bg-brand-secondary)] cursor-pointer transition-colors disabled:opacity-60"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-[36px] text-center text-[14px] font-semibold text-[var(--gp-color-text-neutral-primary)] select-none">
        {qty}
      </span>
      <button
        type="button"
        disabled={isBusy || qty >= 99}
        onClick={() => increment(menuItemId, 1)}
        className="w-[36px] h-full flex items-center justify-center text-[var(--gp-color-brand-primary)] text-[18px] font-bold hover:bg-[var(--gp-color-bg-brand-secondary)] cursor-pointer transition-colors disabled:opacity-60"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
