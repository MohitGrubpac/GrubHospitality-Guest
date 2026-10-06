"use client";

import Image from "next/image";
import CartCounterButton from "@/component/ui/CartCounterButton";
import { KITCHEN_FALLBACK_IMAGE } from "@/lib/adapters/catalogAdapter";

export default function DishDetailModal({ dish, isOpen, onClose }) {
  if (!isOpen || !dish) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in cursor-pointer"
    >
      <div
        className="w-full max-w-[480px] sm:max-w-[768px] bg-white rounded-t-3xl p-5 flex flex-col gap-4 animate-slide-up shadow-2xl relative max-h-[90vh] overflow-y-auto cursor-default"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg text-[#03130a] hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close Modal"
        >
          <Image
            src="/restaurant/close.svg"
            alt="Close"
            width={18}
            height={18}
            className="w-4 h-4 object-contain"
          />
        </button>

        <h2 className="text-lg font-bold text-[#03130a] border-b border-[#eff1f0] pb-2">
          {dish.kitchenName}
        </h2>

        <div className="w-full h-[200px] sm:h-[260px] relative rounded-2xl overflow-hidden border border-slate-100 shadow-xs bg-[#f4f5f4]">
          <Image
            src={dish.image || KITCHEN_FALLBACK_IMAGE}
            alt={dish.name}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover object-center"
          />
        </div>

        <div className="flex items-start gap-2">
          <h3 className="text-lg font-bold text-[#03130a] flex-1">{dish.name}</h3>
          {dish.isOutOfStock && (
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#b42318] bg-[#fee4e2] rounded px-[6px] py-[2px]">
              Out of stock
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-y border-[#eff1f0] py-3">
          <span className="text-lg font-bold text-[#03130a]">₹ {dish.price}</span>
          <CartCounterButton menuItemId={dish.menuItemId} disabled={dish.isOutOfStock} />
        </div>

        {dish.description && (
          <p className="text-xs text-[#6b7971] leading-relaxed font-normal pb-2">
            {dish.description}
          </p>
        )}
      </div>
    </div>
  );
}
