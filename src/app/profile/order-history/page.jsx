"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import OrderHistoryItemCard from "@/component/profile/OrderHistoryItemCard";
import { useGuestOrders } from "@/hooks/useOrders";
import { ORDER_STATUS } from "@/services/orderService";

const TABS = [
  { id: "completed", label: "Completed Orders", status: ORDER_STATUS.DELIVERED },
  { id: "canceled", label: "Canceled Orders", status: ORDER_STATUS.CANCELLED },
];

export default function OrderHistoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("completed");

  const tab = TABS.find((entry) => entry.id === activeTab) || TABS[0];
  const { orders, isLoading, isTruncated } = useGuestOrders({ status: tab.status });

  return (
    <div className="w-full h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden font-sans">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-[#f7f8fa] h-screen shadow-sm flex flex-col overflow-hidden relative pb-8">
        {/* Header Bar */}
        <header className="w-full px-4 sm:px-5 py-4 bg-white border-b border-[#eff1f0] flex items-center gap-3 shrink-0 z-40">
          <button
            type="button"
            onClick={() => router.push("/profile")}
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
          <h1 className="text-lg font-bold text-[#03130a]">Order History</h1>
        </header>

        <div className="w-full bg-white border-b border-[#E0E3E1] flex items-center shrink-0 z-30">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setActiveTab(entry.id)}
              className={`flex-1 py-3 text-center text-sm font-semibold transition-all cursor-pointer border-b-2 ${
                activeTab === entry.id
                  ? "border-[#FF3333] text-[#03130A]"
                  : "border-transparent text-[#6B7971]"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {/* Scrollable Main Content */}
        <main className="flex-1 px-4 sm:px-5 pt-4 pb-12 flex flex-col gap-4 overflow-y-auto">
          <div className="w-full bg-white rounded-lg p-4 sm:p-5 flex flex-col gap-3 shadow-[0px_0px_4px_rgba(0,0,0,0.08),4px_4px_8px_rgba(0,0,0,0.16)] border border-[#E0E3E1]">
            {/* Title Header */}
            <div className="flex items-start gap-3 w-full">
              <div className="w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 opacity-70">
                <Image
                  src="/profile/history.svg"
                  alt="History"
                  width={20}
                  height={20}
                  className="w-5 h-5 object-contain"
                />
              </div>

              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <h2 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
                  Order History
                </h2>
                <p className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
                  View your recently {activeTab === "completed" ? "delivered" : "cancelled"} orders
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full border-t border-[#E0E3E1]" />

            {/* Orders List */}
            <div className="flex flex-col gap-3 pt-1 w-full">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-[#6B7971]">Loading orders...</div>
              ) : orders.length > 0 ? (
                orders.map((order) => (
                  <OrderHistoryItemCard key={order.id} order={order} />
                ))
              ) : (
                <div className="py-8 text-center text-sm font-medium text-[#6B7971] italic">
                  No {activeTab} orders found.
                </div>
              )}

              {/* The endpoint takes only `status`, so the server caps the page size. */}
              {isTruncated && (
                <p className="text-[12px] leading-[16px] text-[#6B7971] italic text-center pt-1">
                  Showing your most recent orders. Contact the front desk for older ones.
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
