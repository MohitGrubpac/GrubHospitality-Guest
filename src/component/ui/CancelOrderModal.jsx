"use client";

import { useEffect, useState } from "react";

/**
 * Guest-facing cancellation reasons. This list is intentionally custom/static -
 * it does not come from the backend.
 */
export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Changed my mind",
  "Wait time too long",
  "Ordered for wrong room",
  "Other",
];

function TrashIcon({ className = "" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Bottom sheet shown when the guest taps CANCEL ORDER on the placed / scheduled
 * order screen. A reason is required; the comment is optional. Submitting calls
 * `onSubmit({ reason, comment })` - the parent performs the API call, closes the
 * sheet on success and leaves it open (with a toast) on failure.
 */
export default function CancelOrderModal({ onClose, onSubmit, submitting = false }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const handleSubmit = () => {
    if (!reason || submitting) return;
    onSubmit?.({ reason, comment: comment.trim() });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed backdrop-blur-[1.5px] inset-0 bg-black/40 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] sm:max-w-[768px] bg-white rounded-t-2xl z-[60] flex flex-col"
        style={{ maxHeight: "80vh" }}
        role="dialog"
        aria-modal="true"
        aria-label="Cancel Order"
      >
        {/* Close button floats above the sheet's top edge */}
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white border border-[#e0e3e1] shadow-md flex items-center justify-center cursor-pointer hover:bg-[#f7f8fa] transition-colors z-10 disabled:opacity-60"
          aria-label="Close cancel modal"
          id="cancel-modal-close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="#03130a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[#03130a]">
              <TrashIcon />
            </span>
            <h2 className="text-[18px] leading-[28px] font-bold text-[#03130a]">Cancel Order?</h2>
          </div>
          <p className="text-sm text-[#6b7971] italic">
            We&apos;re sorry to see you cancel. Please let us know the reason so we can do better.
          </p>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-start gap-2.5 rounded-xl bg-[#FEE2E2] border border-[#FF4B4B]/40 px-3.5 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#EF4444" />
              <path d="M12 7.5v5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="1.2" fill="#fff" />
            </svg>
            <p className="text-xs leading-relaxed text-[#B91C1C]">
              Your order will be cancelled immediately. If the food preparation has already
              started, cancellation may not be possible.
            </p>
          </div>

          <div className="relative">
            <select
              id="cancel-reason-select"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
              className="w-full appearance-none border border-[#e0e3e1] rounded-xl px-4 py-3 pr-10 text-sm text-[#03130a] bg-white cursor-pointer focus:outline-none focus:border-[#fe480b] disabled:opacity-60"
            >
              <option value="" disabled>
                Select a reason
              </option>
              {CANCEL_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" stroke="#6b7971" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <textarea
              id="cancel-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={submitting}
              maxLength={500}
              rows={4}
              placeholder="Additional comments (optional)"
              className="w-full border border-[#e0e3e1] rounded-xl px-4 py-3 text-sm text-[#03130a] bg-white resize-none placeholder:text-[#b0b8b4] focus:outline-none focus:border-[#fe480b] disabled:opacity-60"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-col gap-2 px-5 py-4 border-t border-[#eff1f0]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason || submitting}
            id="cancel-order-submit"
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors cursor-pointer ${
              reason && !submitting
                ? "bg-[#FF4B4B] text-white hover:bg-red-600"
                : "bg-[#e0e3e1] text-[#b0b8b4] cursor-not-allowed"
            }`}
          >
            <TrashIcon />
            {submitting ? "cancelling..." : "Cancel Order"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            id="cancel-order-keep"
            className="w-full flex items-center justify-center py-3.5 rounded-xl border border-[#e0e3e1] bg-white text-sm font-bold uppercase tracking-wide text-[#03130a] cursor-pointer hover:bg-[#f7f8fa] transition-colors disabled:opacity-60"
          >
            Keep Order
          </button>
        </div>
      </div>
    </>
  );
}
