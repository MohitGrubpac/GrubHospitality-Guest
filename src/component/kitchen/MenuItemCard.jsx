"use client";

import Image from "next/image";
import { MdOutlineDeliveryDining, MdOutlineSchedule } from "react-icons/md";
import CartCounterButton from "@/component/ui/CartCounterButton";
import VegIndicator from "@/component/ui/VegIndicator";

function ItemMeta({ rating }) {
  return (
    <div className="flex items-center gap-[var(--gp-space-s)] mt-[4px]">
      {rating > 0 && (
        <div className="flex items-center gap-[4px]">
          <span className="text-[14px] font-medium text-[var(--gp-color-text-neutral-primary)]">
            {rating}
          </span>
        </div>
      )}
      <MdOutlineDeliveryDining className="w-[16px] h-[16px] text-[var(--gp-color-text-neutral-tertiary)]" />
      <MdOutlineSchedule className="w-[16px] h-[16px] text-[var(--gp-color-text-neutral-tertiary)]" />
    </div>
  );
}

export default function MenuItemCard({
  item = null,
  isOutOfStock = false,
  onClick,
}) {
  if (!item) return null;

  const { menuItemId, name, description, price, isVeg, image } = item;

  const addButton = (
    <CartCounterButton menuItemId={menuItemId} disabled={isOutOfStock} />
  );

  return (
    <div
      onClick={onClick}
      className={`w-full flex flex-col gap-[var(--gp-space-s)] p-[var(--gp-padding-l)] md:p-[var(--gp-padding-xl)] bg-white cursor-pointer md:min-h-[220px] ${
        isOutOfStock ? "opacity-60" : ""
      }`}
      style={{ minHeight: "182px" }}
    >
      <div className="flex gap-[var(--gp-space-s)]">
        {/* Left Content */}
        <div className="flex-1 flex flex-col gap-[var(--gp-text-spacing-narrow)]">
          <VegIndicator isVeg={isVeg} />

          <div className="flex items-start gap-[8px]">
            <h3 className="text-[16px] md:text-[20px] font-semibold text-[var(--gp-color-text-neutral-primary)] leading-[24px] md:leading-[28px]">
              {name}
            </h3>
            {isOutOfStock && (
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#b42318] bg-[#fee4e2] rounded px-[6px] py-[2px]">
                Out of stock
              </span>
            )}
          </div>

          {description && (
            <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-[24px] text-[var(--gp-color-text-neutral-secondary)] line-clamp-2">
              {description}
            </p>
          )}

          <ItemMeta rating={item.rating} />

          <div className="mt-auto pt-[var(--gp-space-s)]">
            <span className="text-[16px] md:text-[18px] font-semibold text-[var(--gp-color-text-neutral-primary)]">
              ₹{price}
            </span>
          </div>
        </div>

        {/* Right Image + ADD */}
        <div className="flex flex-col items-end gap-[var(--gp-space-s)] shrink-0">
          <div className="w-[120px] h-[120px] md:w-[160px] md:h-[160px] relative rounded-[var(--gp-radius-base)] overflow-hidden bg-[var(--gp-color-bg-neutral-secondary)]">
            {image && (
              <Image
                src={image}
                alt={name}
                fill
                sizes="(min-width: 768px) 160px, 120px"
                className="object-cover"
              />
            )}
          </div>
          {addButton}
        </div>
      </div>
    </div>
  );
}
