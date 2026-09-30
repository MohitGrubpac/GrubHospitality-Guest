"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrders } from "@/component/providers/OrdersProvider";

const STEP_ICONS = {
  accepted: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="#9ca8a2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  prepared: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v6l4 2" stroke="#9ca8a2" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  ready: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z" fill="#9ca8a2" />
    </svg>
  ),
  delivery: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M3 11l19-9-9 19-2-8-8-2z" stroke="#9ca8a2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const STATUS_MESSAGES = {
  SCHEDULED: "Your order is scheduled with the kitchen.",
  NEW: "The kitchen has received your order.",
  PREPARING: "Your food is being prepared right now.",
  READY: "Your order is ready and on its way.",
  DELIVERED: "Your order has been delivered.",
  CANCELLED: "This order was cancelled.",
};

function TimelineStep({ icon, title, subtitle, isFirst, isLast, isDone, timestamp }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center" style={{ minWidth: 32 }}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 ${
            isDone ? "border-green-500 bg-white" : "border-[#e0e3e1] bg-white"
          }`}
        >
          {isDone ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            icon
          )}
        </div>
        {!isLast && (
          <div
            className="w-px flex-1 mt-1 mb-1"
            style={{ minHeight: 28, background: isDone ? "#22c55e" : "#e0e3e1" }}
          />
        )}
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-baseline justify-between">
          <span className={`text-sm font-semibold ${isDone ? "text-[#03130a]" : "text-[#6b7971]"}`}>
            {title}
          </span>
          {isFirst && timestamp && (
            <span className="text-xs text-[#6b7971] font-medium">{timestamp}</span>
          )}
        </div>
        <p className="text-xs text-[#9ca8a2] mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * Rendered inside BottomDock. Collapsed it is a plain card so it can stack above the
 * cart bar; expanded it becomes a full-screen sheet (it opts out of the stack).
 */
export default function OrderStatusPanel() {
  const router = useRouter();
  const { activeOrder } = useOrders();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeOrder) return null;

  const primaryMessage = STATUS_MESSAGES[activeOrder.status] || "Your order is in progress.";

  const steps = (activeOrder.steps || []).map((step) => ({
    ...step,
    icon: STEP_ICONS[step.id] || STEP_ICONS.accepted,
  }));

  if (isExpanded) {
    return (
      <>
        <div
          className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[1.5px]"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />

        <div className="fixed inset-0 z-[9999] bg-white flex flex-col max-w-[480px] sm:max-w-[768px] mx-auto">
          <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between border-b border-[#f0f0f0]">
            <span className="text-sm font-bold text-[#03130a]">Order Status</span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="w-9 h-9 rounded-full border border-[#e0e3e1] flex items-center justify-center cursor-pointer hover:bg-[#f7f8fa] transition-colors"
              aria-label="Close order status panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="#03130a" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-3">
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => (
                <TimelineStep
                  key={step.id}
                  icon={step.icon}
                  title={step.title}
                  subtitle={step.subtitle}
                  isFirst={index === 0}
                  isLast={index === steps.length - 1}
                  isDone={step.done}
                  timestamp={step.timestamp}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                router.push("/order-status");
              }}
              className="w-full mt-4 py-2 text-xs font-bold uppercase tracking-widest text-[#03130a] cursor-pointer hover:opacity-70 transition-opacity"
            >
              VIEW DETAILS
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="w-full bg-white border border-[#e0e3e1] rounded-xl shadow-[0px_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer"
        aria-expanded={false}
      >
        <div className="flex flex-col items-start min-w-0">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
                stroke="#6b7971"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <rect x="9" y="3" width="6" height="4" rx="1" stroke="#6b7971" strokeWidth="1.5" />
            </svg>
            <span className="text-sm font-bold text-[#03130a]">{activeOrder.statusLabel}</span>
          </div>
          <p className="text-xs text-[#6b7971] mt-0.5 pl-[26px] truncate">{primaryMessage}</p>
        </div>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="transition-transform duration-300 shrink-0 rotate-180"
        >
          <path d="M6 9L12 15L18 9" stroke="#6b7971" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
