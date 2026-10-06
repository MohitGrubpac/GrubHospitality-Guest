"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import StarRating from "@/component/ui/StarRating";
import { useOrderReview } from "@/hooks/useOrderReview";
import { buildReorderEntries } from "@/hooks/useOrders";
import { useCart } from "@/component/providers/CartProvider";
import { showError } from "@/component/ui/Toast";

const STATUS_TONE = {
  scheduled: "text-[#6B7971]",
  preparing: "text-[#479F29]",
  delivered: "text-[#479F29]",
  cancelled: "text-[#FF3333]",
};

export default function StayOrderCard({ order }) {
  const router = useRouter();
  const review = useOrderReview(order);
  const { reorderItems } = useCart();
  const [isReordering, setIsReordering] = useState(false);

  if (!order) return null;

  const items = order.items || [];
  const orderRating = Math.round(review?.orderRating ?? review?.rating ?? 0);
  const foodRating = Math.round(review?.foodRating ?? 0);
  const hasRatings = orderRating > 0 || foodRating > 0;

  const handleOrderAgain = async () => {
    const entries = buildReorderEntries([order]);
    if (entries.length === 0) {
      showError("We couldn't find these dishes on the current menu.");
      return;
    }

    setIsReordering(true);
    try {
      await reorderItems(entries);
      router.push("/cart");
    } catch {
      router.push("/cart");
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-lg p-4 shadow-2xs border border-[#E0E3E1] flex flex-col gap-3 my-1">
      <div className="flex flex-col gap-1 w-full">
        <h4 className="text-[18px] leading-[28px] font-semibold text-[#03130A] truncate">
          {order.restaurantName || "Kitchen"}
        </h4>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
            Ordered : {order.time || "-"}
          </span>
          <span
            className={`text-[14px] leading-[20px] font-normal italic ${
              STATUS_TONE[order.statusTone] || "text-[#6B7971]"
            }`}
          >
            {order.status || "-"}
          </span>
        </div>
      </div>

      <div className="w-full border-t border-[#E0E3E1]" />

      <div className="flex flex-col gap-2">
        {items.slice(0, 3).map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-4 h-4 rounded flex items-center justify-center shrink-0">
                <Image
                  src={item.isVeg ? "/restaurant/veg_badge.svg" : "/restaurant/nonveg_badge.svg"}
                  alt={item.isVeg ? "Veg" : "Non-Veg"}
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain"
                />
              </div>
              <span className="text-[16px] leading-[24px] font-normal text-[#37493F] truncate">
                {item.name}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 justify-end">
              <Image
                src="/profile/x.svg"
                alt="x"
                width={12}
                height={12}
                className="w-3 h-3 object-contain opacity-70"
                sizes="12px"
              />
              <span className="text-[14px] leading-[20px] font-normal text-[#6B7971]">
                {item.qty}
              </span>
            </div>
          </div>
        ))}

        {items.length > 3 && (
          <div className="flex items-center justify-end gap-1 text-[12px] leading-[16px] font-normal text-[#6B7971] pt-0.5">
            <Image
              src="/profile/plus.png"
              alt="Plus"
              width={10}
              height={10}
              className="w-2.5 h-2.5 object-contain opacity-70"
              sizes="10px"
            />
            <span>{items.length - 3} More</span>
          </div>
        )}

        {items.length === 0 && (
          <p className="text-[13px] text-[#6B7971] italic">
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ordered
          </p>
        )}
      </div>

      <div className="w-full border-t border-[#E0E3E1]" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
          Total Amount
        </span>
        <span className="text-[14px] leading-[20px] font-normal italic text-[#37493F] text-right">
          ₹{order.totalAmount ?? 0}
        </span>
      </div>

      {/* Ratings the guest already gave this order, straight from the server. */}
      {hasRatings && (
        <>
          <div className="w-full border-t border-[#E0E3E1]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[14px] leading-[20px] font-normal text-[#37493F]">
                Order Rating
              </span>
              <StarRating value={orderRating} size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] leading-[20px] font-normal text-[#37493F]">
                Food Rating
              </span>
              <StarRating value={foodRating} size={16} />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.push("/profile/rating-feedback?orderId=" + order.id)}
          className="text-[16px] leading-[20px] font-medium text-[#FF3333] uppercase cursor-pointer"
        >
          {review ? "view feedback" : "share feedback"}
        </button>

        <button
          type="button"
          onClick={handleOrderAgain}
          disabled={isReordering}
          className="w-full h-[40px] bg-white border border-[#FF3333] text-[#FF3333] rounded-lg text-[16px] leading-[20px] font-medium uppercase cursor-pointer flex items-center justify-center shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isReordering ? "adding..." : "order again"}
        </button>
      </div>
    </div>
  );
}
