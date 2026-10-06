"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useOrders } from "@/component/providers/OrdersProvider";

export default function OrderStatusCard() {
  const router = useRouter();
  const { activeOrder, hasActiveOrder } = useOrders();

  if (!activeOrder) return null;

  const isLive = hasActiveOrder;

  return (
    <div className="w-full bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e0e3e1] flex flex-col gap-2">
      <div
        onClick={() => router.push("/active-orders")}
        className="flex items-center justify-between gap-2 cursor-pointer"
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
            Order Status
          </h3>
          <p className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
            {isLive ? (
              <>
                Order{" "}
                <span className="text-[#479F29] font-normal italic">
                  {activeOrder.orderCode || activeOrder.statusLabel}
                </span>{" "}
                is {activeOrder.statusLabel.toLowerCase()}
              </>
            ) : (
              <>Your last order was {activeOrder.statusLabel.toLowerCase()}.</>
            )}
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
