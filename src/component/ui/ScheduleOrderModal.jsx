"use client";

import { useState, useEffect } from "react";

function generateDates(count = 7) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const fullDays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const dates = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      key: i,
      day: d.getDate(),
      month: months[d.getMonth()],
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : fullDays[d.getDay()],
      dateObj: d,
    });
  }
  return dates;
}

function generateTimeSlots(minDate = null) {
  // Generate time slots from 7:00 AM to 11:30 PM in 30-min intervals
  const slots = [];
  for (let h = 7; h <= 23; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (minDate) {
        const slotDate = new Date(minDate);
        slotDate.setHours(h, m, 0, 0);
        if (slotDate < minDate) continue;
      }
      const hour = h.toString().padStart(2, "0");
      const min = m.toString().padStart(2, "0");
      slots.push(`${hour}:${min}`);
    }
  }
  return slots;
}

export default function ScheduleOrderModal({ isOpen, onClose, onSchedule }) {
  const dates = generateDates(7);

  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);

  // Today only offers slots still ahead (now + 30 min lead time); a selection
  // from another day is simply not valid here, so derive instead of storing.
  const now = new Date();
  const isToday = dates[selectedDateIndex].dateObj.toDateString() === now.toDateString();
  const minDate = isToday ? new Date(now.getTime() + 30 * 60 * 1000) : null;
  const timeSlots = generateTimeSlots(minDate);
  const effectiveTime = timeSlots.includes(selectedTime) ? selectedTime : null;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  const handleSchedule = () => {
    if (!effectiveTime) return;
    const date = dates[selectedDateIndex];
    onSchedule?.({ date, time: effectiveTime });
    onClose();
  };

  if (!isOpen) return null;

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
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] sm:max-w-[768px] bg-white rounded-t-2xl z-[60] flex flex-col overflow-visible"
        style={{ maxHeight: "70vh" }}
        role="dialog"
        aria-modal="true"
        aria-label="Schedule Order"
      >
        {/* Close button ÔÇö floats above the sheet's top edge */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white border border-[#e0e3e1] shadow-md flex items-center justify-center cursor-pointer hover:bg-[#f7f8fa] transition-colors z-10"
          aria-label="Close schedule modal"
          id="schedule-modal-close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
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
        <div className="px-5 pt-6 pb-4 border-b border-[#eff1f0]">
          <h2 className="text-base font-bold text-[#03130a]">Schedule Order</h2>
          <p className="text-sm text-[#6b7971] mt-0.5 italic">
            Select when you&apos;d like to receive your order.
          </p>
        </div>

        {/* Date Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide border-b border-[#eff1f0] px-5">
          {dates.map((d, i) => {
            const isSelected = selectedDateIndex === i;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDateIndex(i)}
                className={`flex flex-col items-center py-3 px-4 shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isSelected ? "border-[#fe480b]" : "border-transparent"
                }`}
                id={`schedule-date-${i}`}
              >
                <span
                  className={`text-sm font-bold ${
                    isSelected ? "text-[#03130a]" : "text-[#6b7971]"
                  }`}
                >
                  {d.day} {d.month}
                </span>
                <span
                  className={`text-xs mt-0.5 ${
                    isSelected ? "text-[#6b7971]" : "text-[#b0b8b4]"
                  }`}
                >
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Time Slots */}
        <div className="overflow-y-auto py-1" style={{ maxHeight: "180px" }}>
          {timeSlots.length === 0 && (
            <p className="py-6 text-center text-sm text-[#b0b8b4]">
              No delivery slots left for this day. Please pick another date.
            </p>
          )}
          {timeSlots.map((slot) => {
            const isSelected = selectedTime === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                className={`w-full py-2.5 text-center text-sm font-semibold transition-colors cursor-pointer ${
                  isSelected
                    ? "text-[#fe480b]"
                    : "text-[#6b7971] hover:text-[#03130a] hover:bg-[#f7f8fa]"
                }`}
                id={`schedule-time-${slot.replace(":", "-")}`}
              >
                {slot}
              </button>
            );
          })}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-[#eff1f0]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 text-sm font-bold text-[#6b7971] uppercase tracking-wide cursor-pointer hover:text-[#03130a] transition-colors"
            id="schedule-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={!effectiveTime}
            className={`flex-1 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors cursor-pointer ${
              effectiveTime
                ? "bg-[#fe480b] text-white hover:bg-[#e4450a]"
                : "bg-[#e0e3e1] text-[#b0b8b4] cursor-not-allowed"
            }`}
            id="schedule-now-btn"
          >
            Schedule Now
          </button>
        </div>
      </div>
    </>
  );
}
