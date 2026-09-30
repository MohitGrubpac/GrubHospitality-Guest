"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/component/providers/CartProvider";
import { useFeedbackSubmitted } from "@/hooks/useFeedback";
import { showError } from "@/component/ui/Toast";

export default function OrderHistoryItemCard({ order }) {
  const router = useRouter();
  const { reorderItems } = useCart();
  const [isReordering, setIsReordering] = useState(false);

  const feedbackSubmitted = useFeedbackSubmitted(order?.id);

  if (!order) return null;

  const isCanceled = order.isCancelled;
  // No rating endpoint exists yet, so the star rows stay hidden.
  const hasRatings = Boolean(order.orderRating || order.foodRating);
  const orderRating = order.orderRating || 0;
  const foodRating = order.foodRating || 0;

  const handleReorder = async () => {
    const entries = (order.items || [])
      .filter((line) => line.menuItemId)
      .map((line) => ({ menuItemId: line.menuItemId, qty: line.qty, name: line.name }));

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
      {/* Top Header: Kitchen Name & Status */}
      <div className="flex flex-col gap-1 w-full">
        <h4 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
          {order.restaurantName || "Kitchen"}
        </h4>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
            Ordered : {order.time || "-"}
          </span>
          <span
            className={`text-[14px] leading-[20px] font-normal italic ${
              isCanceled ? "text-[#FF3333]" : "text-[#479F29]"
            }`}
          >
            {order.statusLabel}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full border-t border-[#E0E3E1]" />

      {/* Dishes List */}
      <div className="flex flex-col gap-2">
        {(order.items || []).slice(0, 3).map((item, index) => (
          <div key={`${item.menuItemId}-${index}`} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-4 h-4 rounded flex items-center justify-center shrink-0">
                <Image
                  src={item.item?.isVeg ? "/restaurant/veg_badge.svg" : "/restaurant/nonveg_badge.svg"}
                  alt="Badge"
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
              />
              <span className="text-[14px] leading-[20px] font-normal text-[#6B7971]">
                {item.qty}
              </span>
            </div>
          </div>
        ))}

        {!isCanceled && order.moreCount > 0 && (
          <div className="flex items-center justify-end gap-1 text-[12px] leading-[16px] font-normal text-[#6B7971] text-right pt-0.5">
            <Image
              src="/profile/plus.png"
              alt="Plus"
              width={10}
              height={10}
              className="w-2.5 h-2.5 object-contain opacity-70"
            />
            <span>{order.moreCount} More</span>
          </div>
        )}

        {order.items?.length === 0 && (
          <p className="text-[13px] text-[#6B7971] italic">
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ordered
          </p>
        )}
      </div>

      {/* Canceled Order Reason Section */}
      {isCanceled ? (
        <>
          <div className="w-full border-t border-[#E0E3E1]" />
          <div className="flex flex-col gap-1">
            <span className="text-[14px] leading-[20px] font-normal text-[#6B7971]">
              Cancellation Reason
            </span>
            <span className="text-[14px] leading-[20px] font-semibold text-[#03130A]">
              {order.cancellationReason || "Cancelled"}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="w-full border-t border-[#E0E3E1]" />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
              Total Amount
            </span>
            <span className="text-[14px] leading-[20px] font-normal italic text-[#37493F] text-right">
              ₹{order.totalAmount}
            </span>
          </div>

          <div className="w-full border-t border-[#E0E3E1]" />

          {hasRatings && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] leading-[20px] font-normal text-[#37493F]">
                  Order Rating
                </span>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, index) => (
                    <Image
                      key={index}
                      src={
                        index < orderRating
                          ? "/profile/star_filled.svg"
                          : "/profile/star_outline.svg"
                      }
                      alt="Star"
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[14px] leading-[20px] font-normal text-[#37493F]">
                  Food Rating
                </span>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, index) => (
                    <Image
                      key={index}
                      src={
                        index < foodRating
                          ? "/profile/star_filled.svg"
                          : "/profile/star_outline.svg"
                      }
                      alt="Star"
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push(`/profile/rating-feedback?orderId=${order.id}`)}
              className="text-[16px] leading-[20px] font-medium text-[#FF3333] uppercase cursor-pointer"
            >
              {feedbackSubmitted ? "view feedback" : "share feedback"}
            </button>

            <button
              type="button"
              onClick={handleReorder}
              disabled={isReordering}
              className="w-full h-[40px] bg-[#FFFFFF] border border-[#FF3333] text-[#FF3333] rounded-lg text-[16px] leading-[20px] font-medium uppercase cursor-pointer flex items-center justify-center shadow-xs disabled:opacity-60"
            >
              {isReordering ? "adding..." : "reorder"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
