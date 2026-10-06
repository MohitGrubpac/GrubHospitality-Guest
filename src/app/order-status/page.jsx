"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/component/providers/AuthProvider";
import { useRoom } from "@/component/providers/RoomProvider";
import { useOrders } from "@/component/providers/OrdersProvider";
import { useCart } from "@/component/providers/CartProvider";
import { buildReorderEntries } from "@/hooks/useOrders";
import CancelOrderModal from "@/component/ui/CancelOrderModal";
import { cancelGuestOrder } from "@/services/orderService";
import { invalidateRequests } from "@/lib/request-cache";
import { showError, showSuccess } from "@/component/ui/Toast";
import VegIndicator from "@/component/ui/VegIndicator";
import { formatTime12 } from "@/lib/date";

// Step circle icon
function StepCheck({ done, cancelled }) {
  if (cancelled) {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-red-500 bg-white flex items-center justify-center shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 6L6 18M6 6L18 18"
            stroke="#EF4444"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-green-500 bg-white flex items-center justify-center shrink-0">
        <Image
          src="/profile/check_circle_green.svg"
          alt="Done"
          width={18}
          height={18}
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-full border-2 border-[#e0e3e1] bg-white flex items-center justify-center shrink-0">
      <div className="w-2 h-2 rounded-full bg-[#e0e3e1]" />
    </div>
  );
}

function EmptyState() {
  const router = useRouter();

  return (
    <div className="w-full min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center px-8 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
            stroke="#6b7971"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect x="9" y="3" width="6" height="4" rx="1" stroke="#6b7971" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-[#03130a]">No active order</h2>
        <p className="text-sm text-[#6b7971]">
          Place an order and track it here in real time.
        </p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/home")}
        className="px-6 py-2.5 border border-[#fe480b] text-[#fe480b] hover:bg-red-50 rounded-xl text-sm font-bold uppercase transition-colors cursor-pointer"
      >
        Browse Kitchens
      </button>
    </div>
  );
}

export default function OrderStatusPage() {
  const router = useRouter();
  const { guest } = useAuth();
  const { selectedRoom } = useRoom();
  const { activeOrder, isLoading, hasActiveOrder, refreshOrders } = useOrders();
  const { reorderItems } = useCart();
  const [isReordering, setIsReordering] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (isLoading && !activeOrder) {
    return (
      <div className="w-full min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#fe480b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeOrder) return <EmptyState />;

  const isCancelled = activeOrder.isCancelled;
  const isDelivered = activeOrder.isDelivered;
  const isScheduled = activeOrder.status === "SCHEDULED";
  const steps = activeOrder.steps || [];

  const handleBack = () => {
    if (activeOrder.kitchenSlug) {
      router.replace(`/kitchen/${activeOrder.kitchenSlug}`);
    } else {
      router.replace("/home");
    }
  };

  // Finished orders land here from the cart - "Order Again" re-adds the same
  // lines and opens the cart instead of sending the guest back to browse.
  const handleOrderAgain = async () => {
    const entries = buildReorderEntries([activeOrder]);
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

  // Cancel is only offered while the order is NEW or SCHEDULED; the sheet stays
  // open on failure (toast) and closes once the server confirms the cancellation.
  const handleCancelOrder = async ({ reason, comment }) => {
    setIsCancelling(true);
    try {
      await cancelGuestOrder(activeOrder.id, { reason, comment });
      // The tracked-detail cache would keep serving the pre-cancel copy.
      invalidateRequests("orders:detail:");
      setIsCancelOpen(false);
      showSuccess("Order cancelled", "Your order has been cancelled.");
      await refreshOrders();
    } catch {
      showError("We couldn't cancel the order. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const scheduledDisplay = formatTime12(activeOrder.scheduledAt);

  // NEW without kitchen acceptance reads "Order Placed"; once the kitchen has
  // accepted (acceptedAt set or the status moved past NEW) it reads "Order Confirmed".
  const isPlaced = activeOrder.status === "NEW" && !activeOrder.accepted;

  const headline = isCancelled
    ? "Order Cancelled!"
    : isDelivered
      ? "Order Delivered!"
      : isScheduled
        ? "Order Scheduled!"
        : isPlaced
          ? "Order Placed!"
          : "Order Confirmed!";

  const subline = isCancelled
    ? "Your order has been cancelled, you can place a new order anytime"
    : isDelivered
      ? "Your order has been successfully delivered. Enjoy your meal!"
      : isScheduled
        ? `We will start preparing closer to ${scheduledDisplay}.`
        : isPlaced
          ? "We've received your order and it is being confirmed by our kitchen team."
          : "Your order has been successfully placed and is being prepared by our kitchen team.";

  const bannerImage = isCancelled
    ? "/profile/cancel_badge.svg"
    : isDelivered
      ? "/Delivered.png"
      : isScheduled
        ? "/profile/schedule_badge.svg"
        : "/Done.png";

  // Cancel stays available only while the order is placed-new or scheduled.
  const canCancel = activeOrder.status === "NEW" || activeOrder.status === "SCHEDULED";

  const feedbackHref = `/profile/rating-feedback?orderId=${activeOrder.id}`;

  const callReception = (widthClass) => (
    <a
      href="tel:+9111234567890"
      className={`${widthClass} flex items-center justify-center gap-2 py-3.5 bg-[#FF4B4B] text-white rounded-xl text-sm font-bold uppercase tracking-wide cursor-pointer hover:bg-red-600 transition-colors`}
    >
      <Image src="/profile/phone_white.svg" alt="" width={16} height={16} className="w-4 h-4 object-contain" />
      Call Reception
    </a>
  );

  return (
    <div className="w-full min-h-screen bg-[#f7f8fa] flex flex-col items-center select-none">
      <div className="w-full max-w-[480px] sm:max-w-[768px] min-h-screen bg-[#f7f8fa] flex flex-col pb-32 relative shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-[#eff1f0] shrink-0 z-40">
          <button
            type="button"
            onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="#03130a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span
            className="text-sm font-semibold text-[#03130a] cursor-pointer"
            onClick={handleBack}
          >
            Back
          </span>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Status banner */}
          <div className="flex flex-col items-center text-center py-4">
            <Image
              src={bannerImage}
              alt={headline}
              width={76}
              height={76}
              className="w-[76px] h-[76px] object-contain mb-3"
            />
            <h1 className="text-lg font-bold text-[#03130a]">{headline}</h1>
            <p className="text-xs text-[#6b7971] leading-relaxed max-w-[280px] mt-1">{subline}</p>
          </div>

          {/* Delivery Details */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#f0f2f1]">
            <h3 className="text-sm font-bold text-[#03130a]">Delivery Details</h3>
            <span className="text-xs text-[#6b7971] mt-0.5 block">
              Order ID #{activeOrder.orderCode || activeOrder.id}
            </span>
            <div className="h-px bg-[#f0f2f1] my-4" />
            <div className="grid grid-cols-2">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#03130a]">
                  {isCancelled
                    ? "Order Cancelled"
                    : isDelivered
                      ? "Order Delivered"
                      : isScheduled
                        ? scheduledDisplay || "Scheduled"
                        : "20-30 Minutes"}
                </span>
                <span className="text-[11px] text-[#6b7971] mt-0.5">
                  {isCancelled || isDelivered ? "Order Status" : isScheduled ? "Scheduled Time" : "Estimated Delivery"}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-sm font-bold text-[#03130a]">
                  {activeOrder.roomNumber || selectedRoom || "-"}
                </span>
                <span className="text-[11px] text-[#6b7971] mt-0.5">Room No.</span>
              </div>
              <div className="flex flex-col mt-3">
                <span className="text-sm font-bold text-[#03130a]">
                  {activeOrder.restaurantName || "-"}
                </span>
                <span className="text-[11px] text-[#6b7971] mt-0.5">Kitchen</span>
              </div>
              <div className="flex flex-col text-right mt-3">
                <span className="text-sm font-bold text-[#03130a]">
                  {activeOrder.guestName || guest?.name || "-"}
                </span>
                <span className="text-[11px] text-[#6b7971] mt-0.5">Guest Name</span>
              </div>
            </div>

            {activeOrder.specialInstructions && (
              <>
                <div className="h-px bg-[#f0f2f1] my-4" />
                <span className="text-[11px] text-[#6b7971] block mb-1">
                  Special Instructions
                </span>
                <p className="text-xs text-[#03130a] leading-relaxed">
                  {activeOrder.specialInstructions}
                </p>
              </>
            )}
          </div>

          {/* Order Status */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#f0f2f1]">
            <h3 className="text-sm font-bold text-[#03130a] mb-4">Order Status</h3>
            <div className="flex flex-col">
              {steps.map((step, index) => (
                <div key={step.id} className="flex gap-3 items-start relative">
                  {index < steps.length - 1 && (
                    <div
                      className="absolute left-[15px] top-[32px] bottom-[-20px] w-0.5"
                      style={{
                        background: step.done
                          ? "#22c55e"
                          : step.cancelled
                            ? "#EF4444"
                            : "#e0e3e1",
                      }}
                    />
                  )}
                  <StepCheck done={step.done} cancelled={step.cancelled} />
                  <div className="flex-1 pb-6 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span
                        className={`text-sm font-semibold ${
                          step.done || step.cancelled ? "text-[#03130a]" : "text-[#6b7971]"
                        }`}
                      >
                        {step.title}
                      </span>
                      {index === 0 && step.timestamp && (
                        <span className="text-xs text-[#6b7971] font-medium">
                          {step.timestamp}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs mt-0.5 ${
                        step.cancelled ? "text-red-500 font-semibold" : "text-[#9ca8a2]"
                      }`}
                    >
                      {step.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Details */}
          {activeOrder.items.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#f0f2f1]">
              <h3 className="text-sm font-bold text-[#03130a] mb-1">Order Details</h3>
              <div className="flex flex-col divide-y divide-[#f0f2f1] border-t border-[#f0f2f1]">
                {activeOrder.items.map((line) => (
                  <div key={line.menuItemId} className="flex items-center justify-between py-3.5">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="pt-0.5">
                        <VegIndicator isVeg={line.item?.isVeg} size={14} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-[#03130a] leading-tight">
                          {line.name}
                        </span>
                        <span className="text-xs text-[#6b7971] mt-0.5">₹{line.price}</span>
                        {line.note && (
                          <span className="text-[11px] text-[#6b7971] mt-0.5 italic">
                            Note: {line.note}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#6b7971] shrink-0">
                      x{line.qty}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-[#f0f2f1] pt-4 mt-1">
                <span className="text-sm font-bold text-[#03130a]">Total</span>
                <span className="text-sm font-bold text-[#03130a]">
                  ₹{activeOrder.totalAmount}
                </span>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#f0f2f1]">
              <h3 className="text-sm font-bold text-[#03130a] mb-3">Cancel Reason</h3>
              <div className="flex flex-col gap-2">
                <div className="border border-[#e0e3e1] rounded-xl px-4 py-3 text-sm text-[#03130a] bg-[#f7f8fa]">
                  {activeOrder.cancelReason || "Cancelled"}
                </div>
                {activeOrder.cancelComment && (
                  <div className="border border-[#e0e3e1] rounded-xl px-4 py-3 text-sm text-[#03130a] bg-[#f7f8fa]">
                    {activeOrder.cancelComment}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Fixed Bottom */}
        <div className="absolute bottom-0 left-0 w-full bg-[#f7f8fa] px-4 py-3 flex flex-col gap-2 z-30">
          {canCancel ? (
            <div className="flex flex-col gap-2">
              {callReception("w-full")}
              <button
                type="button"
                onClick={() => setIsCancelOpen(true)}
                id="page-cancel-order"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-[#FF4B4B] text-[#FF4B4B] rounded-xl text-sm font-bold uppercase tracking-wide cursor-pointer hover:bg-red-50 transition-colors"
              >
                Cancel Order
              </button>
            </div>
          ) : isCancelled ? (
            <div className="flex gap-2">
              {callReception("flex-1")}
              <button
                type="button"
                onClick={handleOrderAgain}
                disabled={isReordering}
                id="page-order-again"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white border border-[#FF4B4B] text-[#FF4B4B] rounded-xl text-sm font-bold uppercase tracking-wide cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {isReordering ? "adding..." : "Order Again"}
              </button>
            </div>
          ) : isDelivered ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push(feedbackHref)}
                id="page-rate-experience"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FF4B4B] text-white rounded-xl text-sm font-bold uppercase tracking-wide cursor-pointer hover:bg-red-600 transition-colors"
              >
                Rate Your Experience
              </button>
              <button
                type="button"
                onClick={() => router.push(feedbackHref)}
                id="page-view-summary"
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-wide text-[#6b7971] hover:text-[#03130a] transition-colors cursor-pointer"
              >
                View Order Summary
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={hasActiveOrder ? () => router.replace("/home") : handleOrderAgain}
              disabled={isReordering}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FF4B4B] text-white rounded-xl text-sm font-bold uppercase tracking-wide cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {hasActiveOrder ? "Back to Kitchens" : isReordering ? "adding..." : "Order Again"}
            </button>
          )}
        </div>

        {isCancelOpen && (
          <CancelOrderModal
            onClose={() => {
              if (!isCancelling) setIsCancelOpen(false);
            }}
            onSubmit={handleCancelOrder}
            submitting={isCancelling}
          />
        )}
      </div>
    </div>
  );
}
