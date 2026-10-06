"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function OrderHistoryCard() {
  const router = useRouter();

  return (
    <div className="w-full bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e0e3e1] flex flex-col gap-2">
      <div
        onClick={() => router.push("/profile/order-history")}
        className="flex items-center justify-between gap-2 cursor-pointer"
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
            Order History
          </h3>
          <p className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
            View your recently delivered orders
          </p>
        </div>

        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
          <Image
            src="/profile/external_link.svg"
            alt="View"
            width={16}
            height={16}
            className="w-4 h-4 object-contain"
          />
        </div>
      </div>
    </div>
  );
}
