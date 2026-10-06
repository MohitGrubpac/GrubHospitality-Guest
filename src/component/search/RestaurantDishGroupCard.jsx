"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import CartCounterButton from "@/component/ui/CartCounterButton";
import TagChips from "@/component/ui/TagChips";
import { KITCHEN_FALLBACK_IMAGE } from "@/lib/adapters/catalogAdapter";

export default function RestaurantDishGroupCard({
  restaurant,
  dishes = [],
  onSelectDish,
}) {
  const router = useRouter();
  if (!restaurant) return null;

  return (
    <div className="w-full bg-white border border-[#e0e3e1] rounded-2xl p-4 flex flex-col gap-4 shadow-xs">
      <div
        onClick={() => router.push(`/kitchen/${restaurant.slug}`)}
        className="flex items-start justify-between gap-2 border-b border-[#eff1f0] pb-3 cursor-pointer group"
      >
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-bold text-[#03130a] group-hover:text-[#fe480b] transition-colors">
            {restaurant.name}
          </h3>
          <p className="text-xs text-[#6b7971] line-clamp-2">{restaurant.description}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-red-50 group-hover:text-[#fe480b] transition-colors">
          <Image
            src="/kitchen/arrow_right.svg"
            alt="Arrow Right"
            width={16}
            height={16}
            className="w-4 h-4 object-contain"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
        {dishes.map((dish) => (
          <div
            key={dish.id}
            onClick={() => onSelectDish?.(dish)}
            className="w-[240px] border border-[#e0e3e1] rounded-xl p-3 flex flex-col gap-2 shrink-0 bg-white shadow-2xs hover:border-[#fe480b]/40 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <Image
                  src={dish.isVeg ? "/restaurant/veg_badge.svg" : "/restaurant/nonveg_badge.svg"}
                  alt={dish.isVeg ? "Veg" : "Non-Veg"}
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 object-contain"
                />
                <h4 className="text-xs font-bold text-[#03130a] line-clamp-2">{dish.name}</h4>
                {(dish.rating > 0 || (dish.tagList && dish.tagList.length > 0)) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {dish.rating > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Image src="/restaurant/star.svg" alt="Rating" width={14} height={14} className="w-3.5 h-3.5 object-contain" />
                        <span className="text-[10px] font-semibold text-[#03130a]">{dish.rating}</span>
                      </span>
                    )}
                    <TagChips tags={dish.tagList} max={3} size="sm" />
                  </div>
                )}
                <div className="text-xs font-bold text-[#03130a] mt-1">₹ {dish.price}</div>
              </div>

              <div className="w-16 h-16 relative rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-[#f4f5f4]">
                <Image
                  src={dish.image || KITCHEN_FALLBACK_IMAGE}
                  alt={dish.name}
                  fill
                  sizes="64px"
                  className="object-cover object-center"
                />
              </div>
            </div>

            <div className="flex justify-end w-full">
              <CartCounterButton menuItemId={dish.menuItemId} disabled={dish.isOutOfStock} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
