"use client";

import { useState } from "react";
import Image from "next/image";
import { ApiError } from "@/lib/api-client";
import { showError } from "@/component/ui/Toast";
import { recordFeedback } from "@/services/feedbackService";
import { useAuth } from "@/component/providers/AuthProvider";

/**
 * Rating + review form. Submit sends one POST /guest/reviews carrying
 * { orderId, orderRating, foodRating, comment, items } where `items` holds a
 * { menuItemId, itemName, rating } entry per rated dish (every dish gets the
 * overall star when only the overall rating was given). The profile is then
 * re-read so every surface shows the review the server stored, and the payload
 * is handed to `onSubmitted` so the screen can flip to its read-only view.
 */
export default function ShareExperienceCard({ order, orderId, feedbackTarget, onSubmitted }) {
  const [overallRating, setOverallRating] = useState(0);
  const [itemRatings, setItemRatings] = useState({});
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refetchProfile } = useAuth();

  const items = order?.items || [
    { id: "i1", name: "Hyderabadi Biryani" },
    { id: "i2", name: "Muradabadi Biryani" },
  ];

  const handleItemRating = (id, rating) => {
    setItemRatings((prev) => ({ ...prev, [id]: rating }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submitted || isSubmitting) return;

    const hasRating = overallRating > 0 || Object.values(itemRatings).some((value) => value > 0);
    if (!feedback.trim() && !hasRating) return;

    const review = feedback.trim();
    const targetItems = feedbackTarget?.items?.filter((item) => item.menuItemId) || [];

    const ratedItems = targetItems
      .map((item) => ({
        menuItemId: item.menuItemId,
        itemName: item.name,
        rating: itemRatings[item.menuItemId] || 0,
      }))
      .filter((entry) => entry.rating > 0);

    const items =
      ratedItems.length > 0
        ? ratedItems
        : overallRating > 0
          ? targetItems.map((item) => ({
              menuItemId: item.menuItemId,
              itemName: item.name,
              rating: overallRating,
            }))
          : [];

    const foodRating = items.length
      ? Math.round(items.reduce((sum, entry) => sum + entry.rating, 0) / items.length)
      : 0;
    const orderRating = overallRating > 0 ? overallRating : foodRating;

    const batch = {
      orderId: feedbackTarget?.orderId,
      orderRating,
      foodRating: foodRating || orderRating,
      comment: review,
      items,
    };

    setIsSubmitting(true);
    try {
      if (orderRating > 0 && batch.orderId && items.length > 0) {
        await recordFeedback(batch);
      }
      // Pull the fresh profile so the stay/history cards see the server's review.
      refetchProfile().catch(() => {
        /* the submitted view below does not depend on this */
      });
      onSubmitted?.({
        overallRating: orderRating,
        foodRating: batch.foodRating,
        feedback,
        items: items.map((entry) => ({
          menuItemId: entry.menuItemId,
          name: entry.itemName,
          rating: entry.rating,
        })),
        time: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch (submitError) {
      showError(
        submitError instanceof ApiError
          ? submitError.message
          : "Unable to record your feedback. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-lg p-4 shadow-2xs border border-[#E0E3E1] flex flex-col gap-3">
      <div className="flex flex-col gap-1 w-full">
        <h3 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
          Share Your Experience
        </h3>
        <p className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
          Share your feedback on the food quality.
        </p>
      </div>

      <div className="w-full border-t border-[#E0E3E1]" />

      <div className="flex flex-col gap-2">
        <span className="text-[14px] leading-[20px] font-normal text-[#37493F]">
          Rate Your Overall Order
        </span>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setOverallRating(star)}
              disabled={submitted || isSubmitting}
              className="cursor-pointer transition-transform hover:scale-110 disabled:opacity-50"
            >
              <Image
                src={star <= overallRating ? "/profile/star_filled.svg" : "/profile/star_outline.svg"}
                alt="Star"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="w-full border-t border-[#E0E3E1]" />

      {items.map((item, idx) => {
        const itemId = item.id || `dish-${idx}`;
        const rating = itemRatings[itemId] || 0;
        return (
          <div key={idx} className="flex flex-col gap-2">
            <span className="text-[14px] leading-[20px] font-normal text-[#37493F]">
              {item.name}
            </span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleItemRating(itemId, star)}
                  disabled={submitted || isSubmitting}
                  className="cursor-pointer transition-transform hover:scale-110 disabled:opacity-50"
                >
                  <Image
                    src={star <= rating ? "/profile/star_filled.svg" : "/profile/star_outline.svg"}
                    alt="Star"
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="w-full border-t border-[#E0E3E1]" />

      <div className="flex flex-col gap-2 w-full">
        <label className="text-[14px] leading-[20px] font-semibold text-[#37493F]">
          Drop a feedback
        </label>
        <div className="relative w-full">
          <textarea
            rows={3}
            placeholder="Loved the meal..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={submitted || isSubmitting}
            className="w-full p-3 pr-12 bg-white border border-[#E0E3E1] rounded-lg text-base font-normal text-[#37493F] placeholder:text-[#6B7971] outline-none resize-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitted || isSubmitting}
            aria-label="Submit feedback"
            className="absolute right-3 bottom-4 w-7 h-7 bg-[#FF4848] border border-[#FF3333] rounded-lg flex items-center justify-center cursor-pointer shadow-xs active:bg-[#e03d06] transition-colors disabled:opacity-60"
          >
            <Image
              src="/profile/arrow_right_white.svg"
              alt="Submit"
              width={16}
              height={16}
              className="w-4 h-4 object-contain"
            />
          </button>
        </div>
        {submitted && (
          <span className="text-xs text-[#479F29] font-medium pt-1">
            Thank you! Your feedback has been recorded.
          </span>
        )}
      </div>
    </div>
  );
}
