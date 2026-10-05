"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import content from "@/data/static-content.json";

import RatingFeedbackOrderCard from "@/component/profile/RatingFeedbackOrderCard";
import ShareExperienceCard from "@/component/profile/ShareExperienceCard";
import BillSummaryCard from "@/component/profile/BillSummaryCard";
import { buildReorderEntries, useGuestOrder } from "@/hooks/useOrders";
import { useFeedback } from "@/hooks/useFeedback";
import { useCart } from "@/component/providers/CartProvider";
import { showError } from "@/component/ui/Toast";

/**
 * The order is real - fetched from GET /guest/orders/{orderId} - with a static
 * sample as the fallback when it cannot be resolved. The form batch-rates the
 * dishes into one POST /guest/feedback `items` array (falling back to flat
 * per-dish calls if the deployed DTO rejects batches); the bottom button
 * reorders the order back into the cart.
 */
function RatingFeedbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const savedFeedback = useFeedback(orderId);
  const { reorderItems } = useCart();
  const [isReordering, setIsReordering] = useState(false);

  const { order, isLoading } = useGuestOrder(orderId);

  const sampleOrder = useMemo(() => {
    if (order) {
      return {
        restaurantName: order.restaurantName,
        time: order.placedAtLabel,
        status: order.statusLabel,
        items: order.items.map((line) => ({
          id: line.menuItemId,
          name: line.name,
          qty: line.qty,
          isVeg: line.item?.isVeg,
        })),
        totalAmount: order.totalAmount,
      };
    }

    const fallback = content.ratingSamples?.completedOrders?.find((entry) => entry.id === orderId);
    return fallback || content.reviewCopy?.fallbackOrder;
  }, [order, orderId]);

  const feedbackTarget = useMemo(() => {
    if (!order?.id || !order?.restaurantId) return null;
    const items = (order.items || [])
      .filter((line) => line.menuItemId)
      .map((line) => ({ menuItemId: line.menuItemId, name: line.name }));
    if (items.length === 0) return null;
    return {
      orderId: order.id,
      restaurantId: order.restaurantId,
      guestName: order.guestName,
      items,
    };
  }, [order]);

  const submitted = Boolean(savedFeedback);

  const handleReorder = async () => {
    const entries = buildReorderEntries(order ? [order] : []);
    if (entries.length === 0) {
      showError("We couldn't find these dishes on the current menu.");
      return;
    }
    setIsReordering(true);
    try {
      await reorderItems(entries);
    } finally {
      setIsReordering(false);
      router.push("/cart");
    }
  };

  if (isLoading && !order) {
    return (
      <div className="w-full h-screen bg-[#f8faf9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#fe480b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden font-sans">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-[#f7f8fa] h-screen shadow-sm flex flex-col overflow-hidden relative pb-8">
        <header className="w-full px-5 py-4 bg-white border-b border-[#eff1f0] flex items-center gap-3 shrink-0 z-40">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <Image
              src="/restaurant/back.svg"
              alt="Back"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
          </button>
          <h1 className="text-lg font-bold text-[#03130a]">Your Feedback</h1>
        </header>

        <main className="flex-1 px-4 sm:px-5 pt-4 pb-12 flex flex-col gap-4 overflow-y-auto overflow-x-hidden">
          <RatingFeedbackOrderCard order={sampleOrder} />

          {submitted ? (
            <div className="w-full bg-white rounded-lg p-4 shadow-2xs border border-[#E0E3E1] flex flex-col gap-3">
              <h3 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
                Your Rating
              </h3>
              <div className="w-full border-t border-[#E0E3E1]" />
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Image
                    key={star}
                    src={
                      star <= (savedFeedback?.overallRating || 5)
                        ? "/profile/star_filled.svg"
                        : "/profile/star_outline.svg"
                    }
                    alt={`Star ${star}`}
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain"
                  />
                ))}
              </div>
              <div className="w-full border-t border-[#E0E3E1]" />
              <div className="flex flex-col gap-1">
                <span className="text-[14px] leading-[20px] font-semibold text-[#37493F]">
                  Feedback
                </span>
                <p className="text-[14px] leading-[20px] text-[#6B7971]">
                  {savedFeedback?.feedback || "Great food!"}
                </p>
              </div>
            </div>
          ) : (
            <ShareExperienceCard
              order={sampleOrder}
              orderId={orderId}
              feedbackTarget={feedbackTarget}
            />
          )}

          <BillSummaryCard amount={sampleOrder.totalAmount || 0} />

          <div className="w-full pt-2 pb-4">
            <button
              type="button"
              onClick={handleReorder}
              disabled={isReordering}
              className="w-full h-[48px] bg-[#FF4848] border border-[#FF3333] text-white rounded-lg text-[18px] leading-[24px] font-medium uppercase tracking-normal cursor-pointer shadow-xs active:bg-[#e03d06] transition-colors disabled:opacity-60"
            >
              {isReordering ? "adding..." : "reorder"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function RatingFeedbackPage() {
  return (
    <Suspense fallback={null}>
      <RatingFeedbackContent />
    </Suspense>
  );
}
