"use client";

import { useState, useEffect } from "react";
import { useRoom } from "@/component/providers/RoomProvider";

export default function SwitchRoomModal({
  isOpen,
  onClose,
  currentRoom,
  onConfirm,
}) {
  const { bookedRooms } = useRoom();
  const [selectedRoom, setSelectedRoom] = useState(currentRoom);

  // Only rooms the guest actually holds - never a fabricated list.
  const rooms = bookedRooms.length > 0 ? bookedRooms : currentRoom ? [currentRoom] : [];

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

  const handleConfirm = () => {
    onConfirm?.(selectedRoom);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] sm:max-w-[768px] bg-white rounded-t-2xl z-[60] flex flex-col"
        style={{ maxHeight: "90vh" }}
        role="dialog"
        aria-modal="true"
        aria-label="Switch Room"
      >
        {/* Close button */}
        <div className="flex justify-center pt-8 -mt-20 pb-2 relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e0e3e1] bg-white cursor-pointer hover:bg-slate-50 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="#03130a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Header */}
        <div className="px-5 pt-6 pb-4">
          <h2 className="text-lg font-bold text-[#03130a]">Switch Room</h2>
          <p className="text-sm text-[#6b7971] mt-0.5">
            Select a room to deliver this order
          </p>
        </div>

        {/* Room list */}
        <div className="px-5 pb-4 flex flex-col gap-4">
          {rooms.length === 0 ? (
            <p className="text-sm text-[#6b7971]">
              No room is linked to your reservation yet.
            </p>
          ) : (
            rooms.map((room) => {
              const isSelected = selectedRoom === room;
              const isCurrent = currentRoom === room;
              return (
                <label key={room} className="flex items-center gap-3 cursor-pointer">
                  <div className="relative w-5 h-5 shrink-0">
                    <input
                      type="radio"
                      name="switch-room"
                      checked={isSelected}
                      onChange={() => setSelectedRoom(room)}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 rounded-full border-2 border-[#e0e3e1] peer-checked:border-[#fe480b] transition-colors" />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#fe480b]" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-[#03130a]">
                    Room {room}
                    {isCurrent && <span className="text-[#6b7971]"> (Current)</span>}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Confirm button */}
        <div className="px-5 pb-6 pt-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedRoom}
            className="w-full py-3.5 bg-[#fe480b] text-white rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer hover:bg-[#e4450a] transition-colors disabled:opacity-50"
          >
            Confirm Room
          </button>
        </div>
      </div>
    </>
  );
}
