"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useOrders } from "@/component/providers/OrdersProvider";

/**
 * One active order, laid out like the completed-orders cards on the Order History
 * screen: kitchen + status header, dish lines, total, and a single action - which
 * here opens that order's confirmation page instead of reordering.
 */
function ActiveOrderCard({ order, onSelect }) {
  const items = order.items || [];
  const visibleItems = items.slice(0, 3);
  const moreCount = Math.max(0, items.length - 3);

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
          <span className="text-[14px] leading-[20px] font-normal italic text-[#479F29]">
            {order.statusLabel}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full border-t border-[#E0E3E1]" />

      {/* Dishes List */}
      <div className="flex flex-col gap-2">
        {visibleItems.map((item, index) => (
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

        {moreCount > 0 && (
          <div className="flex items-center justify-end gap-1 text-[12px] leading-[16px] font-normal text-[#6B7971] text-right pt-0.5">
            <Image
              src="/profile/plus.png"
              alt="Plus"
              width={10}
              height={10}
              className="w-2.5 h-2.5 object-contain opacity-70"
            />
            <span>{moreCount} More</span>
          </div>
        )}

        {items.length === 0 && (
          <p className="text-[13px] text-[#6B7971] italic">
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ordered
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="w-full border-t border-[#E0E3E1]" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
          Total Amount
        </span>
        <span className="text-[14px] leading-[20px] font-normal italic text-[#37493F] text-right">
          ₹{order.totalAmount}
        </span>
      </div>

      {/* Divider */}
      <div className="w-full border-t border-[#E0E3E1]" />

      {/* Action */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => onSelect(order)}
          className="w-full h-[40px] bg-[#FFFFFF] border border-[#FF3333] text-[#FF3333] rounded-lg text-[16px] leading-[20px] font-medium uppercase cursor-pointer flex items-center justify-center shadow-xs"
        >
          View Details
        </button>
      </div>
    </div>
  );
}

/**
 * Every active (in-flight) order for this guest. The list is the provider's, which
 * re-reads each order from GET /guest/orders/{orderId}, so the statuses shown are
 * server-driven; the layout mirrors the Completed Orders screen in Order History.
 */
export default function ActiveOrdersPage() {
  const router = useRouter();
  const { orders, isLoading, setActiveOrderId } = useOrders();

  const activeOrders = orders.filter((order) => order && !order.isTerminal);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/home");
    }
  };

  const openOrder = (order) => {
    setActiveOrderId(order.id);
    router.push("/order-status");
  };

  return (
    <div className="w-full h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden font-sans">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-[#f7f8fa] h-screen shadow-sm flex flex-col overflow-hidden relative pb-8">
        {/* Header Bar */}
        <header className="w-full px-4 sm:px-5 py-4 bg-white border-b border-[#eff1f0] flex items-center gap-3 shrink-0 z-40">
          <button
            type="button"
            onClick={handleBack}
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
          <h1 className="text-lg font-bold text-[#03130a]">Active Orders</h1>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 px-4 sm:px-5 pt-4 pb-12 flex flex-col gap-4 overflow-y-auto">
          <div className="w-full bg-white rounded-lg p-4 sm:p-5 flex flex-col gap-3 shadow-[0px_0px_4px_rgba(0,0,0,0.08),4px_4px_8px_rgba(0,0,0,0.16)] border border-[#E0E3E1]">
            {/* Title Header */}
            <div className="flex items-start gap-3 w-full">
              <div className="w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 opacity-70">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
                    stroke="#03130a"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect x="9" y="3" width="6" height="4" rx="1" stroke="#03130a" strokeWidth="1.5" />
                </svg>
              </div>

              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <h2 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
                  Active Orders
                </h2>
                <p className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
                  View your orders in progress
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full border-t border-[#E0E3E1]" />

            {/* Orders List */}
            <div className="flex flex-col gap-3 pt-1 w-full">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-[#6B7971]">Loading orders...</div>
              ) : activeOrders.length > 0 ? (
                activeOrders.map((order) => (
                  <ActiveOrderCard key={order.id} order={order} onSelect={openOrder} />
                ))
              ) : (
                <div className="py-8 text-center text-sm font-medium text-[#6B7971] italic">
                  No active orders found.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
