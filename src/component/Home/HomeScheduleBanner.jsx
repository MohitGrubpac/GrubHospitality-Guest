"use client";

import Image from "next/image";

export default function HomeScheduleBanner() {
  return (
    <div className="w-full bg-white border border-[#e0e3e1] rounded-2xl shadow-xs shrink-0 flex flex-col overflow-hidden">
      <div className="pt-4 px-4 pb-2 flex flex-col gap-0.5">
        <h3 className="text-base sm:text-lg font-bold text-[#03130a] leading-tight">
          Schedule order anytime,
        </h3>
        <h3 className="text-base sm:text-lg font-bold text-[#03130a] leading-tight">
          Still get freshly cooked food.
        </h3>
      </div>

      {/* Inset to line up with the heading, and flush with the card's bottom edge. */}
      <div className="px-4">
        <div className="relative w-full h-[180px] sm:h-[220px] overflow-hidden rounded-lg">
          <Image
            src="/banner.png"
            alt="Schedule order and get freshly cooked food"
            fill
            sizes="(max-width: 768px) calc(100vw - 64px), 704px"
            className="object-cover object-center"
          />
        </div>
      </div>
    </div>
  );
}
