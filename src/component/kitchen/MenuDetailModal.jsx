"use client";

import Image from "next/image";
import { MdClose } from "react-icons/md";
import CartCounterButton from "@/component/ui/CartCounterButton";
import TagChips from "@/component/ui/TagChips";
import VegIndicator from "@/component/ui/VegIndicator";

export default function MenuDetailModal({ item, onClose }) {
  if (!item) return null;

  const { menuItemId, name, description, price, isVeg, image, isOutOfStock, rating } = item;
  const tagChips =
    item.tagList ??
    (Array.isArray(item.tags)
      ? item.tags.map((tag) => (typeof tag === "string" ? { name: tag, icon: "" } : tag))
      : []);
  const hasRating = Number(rating) > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute backdrop-blur-[3px] inset-0 bg-black/60" onClick={onClose} />

      {/* Bottom Sheet Content */}
      <div className="relative p-2 bg-white w-full rounded-t-[10px] z-10">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-[48px] left-1/2 -translate-x-1/2 w-[40px] h-[40px] flex items-center justify-center bg-white rounded-full cursor-pointer z-10 shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
          aria-label="Close"
        >
          <MdClose className="w-6 h-6 text-[var(--gp-color-text-neutral-primary)]" />
        </button>

        <div className="w-full bg-white rounded-t-[24px] animate-slide-up">
          {/* Food Image */}
          <div className="w-full h-[200px] relative">
            {image ? (
              <Image
                src={image}
                alt={name}
                fill
                sizes="100vw"
                className="object-cover rounded-t-[12px] p-2"
              />
            ) : (
              <div className="w-full h-full bg-[var(--gp-color-bg-neutral-secondary)] rounded-t-[24px]" />
            )}
          </div>

          {/* Item Details */}
          <div className="flex flex-col gap-[16px] p-[16px]">
            <h2 className="text-[24px] font-semibold text-[var(--gp-color-text-neutral-primary)] leading-[32px]">
              {name}
            </h2>

            {isOutOfStock && (
              <span className="self-start text-[12px] font-semibold uppercase tracking-wide text-[#b42318] bg-[#fee4e2] rounded px-[8px] py-[4px]">
                Out of stock
              </span>
            )}

            {/* Price, rating, veg and tags share the row with the ADD button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <span className="text-[18px] font-semibold text-[var(--gp-color-text-neutral-primary)]">
                  ₹{price}
                </span>
                {hasRating && (
                  <span className="flex items-center gap-[4px] shrink-0">
                    <Image
                      src="/restaurant/star.svg"
                      alt="Rating"
                      width={18}
                      height={18}
                      className="w-[18px] h-[18px] object-contain"
                    />
                    <span className="text-[15px] font-medium text-[var(--gp-color-text-neutral-primary)]">
                      {rating}
                    </span>
                  </span>
                )}
                <VegIndicator isVeg={isVeg} />
                <TagChips tags={tagChips} />
              </div>
              <CartCounterButton
                menuItemId={menuItemId}
                disabled={isOutOfStock}
                addClassName="h-[40px] px-[20px]"
              />
            </div>

            {description && (
              <p className="text-[14px] leading-[22px] text-[var(--gp-color-text-neutral-secondary)]">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
