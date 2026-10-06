"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingScreen from "@/component/ui/LoadingScreen";
import { useRoom } from "@/component/providers/RoomProvider";

/**
 * Shown after sign-in when the reservation covers more than one room. The guest picks
 * the room deliveries should go to; the choice is remembered on the device.
 */
export default function RoomSelectionPage() {
  const router = useRouter();
  const { bookedRooms, setSelectedRoom } = useRoom();

  const [localRoom, setLocalRoom] = useState(null);
  const [showLoading, setShowLoading] = useState(false);

  const rooms = bookedRooms;

  const finish = () => {
    setShowLoading(true);
  };

  const handleContinue = () => {
    if (!localRoom) return;
    setSelectedRoom(localRoom);
    finish();
  };

  const handleSkip = () => {
    // Keep whatever is currently effective (the first booked room).
    finish();
  };

  if (showLoading) {
    return <LoadingScreen onComplete={() => router.replace("/home")} duration={1400} />;
  }

  if (rooms.length <= 1) {
    // Nothing to choose - the guest holds a single room.
    if (typeof window !== "undefined") {
      router.replace("/home");
      return null;
    }
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-[#f7f8fa] flex flex-col items-center select-none">
      <div
        className="w-full max-w-[480px] sm:max-w-[768px] min-h-screen bg-[#f7f8fa] flex flex-col px-6 pt-12 pb-8"
        style={{ paddingBottom: "calc(var(--bottom-dock-h, 0px) + 32px)" }}
      >
        <div className="mb-8">
          <h1 className="text-[26px] font-bold text-[#03130a] mb-1">Select a Room</h1>
          <p className="text-sm text-[#6b7971]">Choose a room to place your food order</p>
        </div>

        {/* Room Grid */}
        <div className="grid grid-cols-2 gap-3 mb-auto">
          {rooms.map((room) => {
            const isSelected = localRoom === room;
            return (
              <button
                key={room}
                type="button"
                onClick={() => setLocalRoom(room)}
                className={`relative flex items-center gap-3 px-4 py-5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-[#fe480b] bg-[#fef2f0]"
                    : "border-[#e0e3e1] bg-white"
                }`}
                id={`room-option-${room}`}
              >
                <Image
                  src="/home/key_red.svg"
                  alt="Key"
                  width={19}
                  height={19}
                  className="w-[19px] h-[19px] object-contain shrink-0"
                  sizes="19px"
                />
                <span className="text-sm font-semibold text-[#03130a]">Room {room}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom Section */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!localRoom}
            className={`w-full py-4 rounded-xl text-sm font-bold uppercase tracking-wide transition-all mb-4 ${
              localRoom
                ? "bg-[#fe480b] text-white cursor-pointer hover:bg-[#e4450a]"
                : "bg-[#eff1f0] text-[#c1c7c4] cursor-not-allowed"
            }`}
            id="room-continue"
          >
            Continue
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-sm font-semibold text-[#03130a] uppercase tracking-wide mb-6 cursor-pointer hover:text-[#fe480b] transition-colors"
          >
            Skip
          </button>

          <div className="h-px bg-[#e0e3e1] mb-4 -mx-6" />

          <div className="bg-[#E8EAE9] border border-[#C1C7C4] rounded-lg p-4 flex gap-3">
            <div className="shrink-0 mt-0.5">
              <Image
                src="/home/info.svg"
                alt="Info"
                width={22}
                height={22}
                className="w-[22px] h-[22px] object-contain"
                sizes="22px"
              />
            </div>
            <div>
              <p className="text-[14px] leading-[20px] font-semibold text-[#37493F] mb-0.5">
                Why choose a room?
              </p>
              <p className="text-[12px] leading-[16px] font-normal text-[#6B7971]">
                This helps us deliver your order to the right room quickly and accurately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
