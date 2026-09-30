"use client";

import Image from "next/image";
import CartCounterButton from "@/component/ui/CartCounterButton";
import { KITCHEN_FALLBACK_IMAGE } from "@/lib/adapters/catalogAdapter";

export default function DishCard({ dish, onSelectDish }) {
  if (!dish) return null;

  return (
    <div
      onClick={() => onSelectDish?.(dish)}
      className="w-full bg-white border border-[#e0e3e1] rounded-2xl p-4 flex items-start justify-between gap-4 shadow-xs hover:border-[#fe480b]/30 transition-all cursor-pointer"
    >
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <Image
          src={dish.isVeg ? "/restaurant/veg_badge.svg" : "/restaurant/nonveg_badge.svg"}
          alt={dish.isVeg ? "Veg" : "Non-Veg"}
          width={16}
          height={16}
          className="w-4 h-4 object-contain"
        />

        <h3 className="text-base font-bold text-[#03130a] leading-tight truncate">
          {dish.name}
        </h3>

        <span className="text-xs text-[#6b7971] font-medium truncate">
          {dish.kitchenName}
        </span>

        {dish.isOutOfStock && (
          <span className="self-start text-[11px] font-semibold uppercase tracking-wide text-[#b42318] bg-[#fee4e2] rounded px-[6px] py-[2px]">
            Out of stock
          </span>
        )}

        <div className="mt-2 text-base font-bold text-[#03130a]">₹ {dish.price}</div>
      </div>

      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="w-24 h-24 sm:w-28 sm:h-28 relative rounded-xl overflow-hidden border border-slate-100 shadow-xs bg-[#f4f5f4]">
          <Image
            src={dish.image || KITCHEN_FALLBACK_IMAGE}
            alt={dish.name}
            fill
            sizes="(max-width: 768px) 112px, 160px"
            className="object-cover object-center"
          />
        </div>

        <CartCounterButton menuItemId={dish.menuItemId} disabled={dish.isOutOfStock} />
      </div>
    </div>
  );
}
