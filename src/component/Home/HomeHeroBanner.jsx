"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRoom } from "@/component/providers/RoomProvider";

export default function HomeHeroBanner({ user }) {
  const { bookedRooms, isMultipleRooms, setSelectedRoom } = useRoom();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close when tapping away from the pill.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const room = user.room;
  const canSwitch = Boolean(room) && isMultipleRooms;

  const pickRoom = (nextRoom) => {
    if (setSelectedRoom(nextRoom)) setIsOpen(false);
  };

  return (
    <div className="relative w-full h-[430px] sm:h-[500px] rounded-lg shadow-sm border bg-[#1c2b24]">
      {/* Clipped layer so the rounded corners crop the photo; the room menu below
          intentionally escapes this box and drops under the pill. */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        <Image
          src="/loginCrousel/Login_Crousel1.jpg"
          alt={user.hotel || "Hotel"}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      </div>

      <div className="absolute inset-x-5 bottom-5 flex flex-col gap-1 z-10 text-white">
        <span className="text-sm font-medium tracking-wide text-slate-200">
          Welcome, {user.name}
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {user.hotel}
        </h1>
        {user.location && (
          <p className="text-xs sm:text-sm text-slate-200 mb-2 font-light">{user.location}</p>
        )}

        {/* Room Pill */}
        {room && (
          <div ref={wrapperRef} className="relative self-start">
            <button
              type="button"
              onClick={canSwitch ? () => setIsOpen((open) => !open) : undefined}
              aria-haspopup={canSwitch ? "menu" : undefined}
              aria-expanded={canSwitch ? isOpen : undefined}
              aria-label={canSwitch ? "Change room" : undefined}
              className={`px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center gap-2 ${
                canSwitch ? "cursor-pointer hover:bg-black/60 transition-colors" : "cursor-default"
              }`}
            >
              <Image
                src="/restaurant/key.svg"
                alt="Room"
                width={14}
                height={14}
                className="w-3.5 h-3.5 object-contain"
              />
              <span className="text-xs font-semibold tracking-wide">Room {room}</span>
              {canSwitch && (
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  aria-hidden="true"
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <path
                    d="M1 1L5 5L9 1"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            {/* Booked rooms the guest can switch to */}
            {canSwitch && isOpen && (
              <div
                role="menu"
                aria-label="Choose room"
                className="absolute top-full left-0 mt-2 min-w-[140px] rounded-xl border border-white/20 bg-black/75 backdrop-blur-md overflow-hidden shadow-lg"
              >
                {bookedRooms.map((bookedRoom) => {
                  const isCurrent = bookedRoom === room;
                  return (
                    <button
                      key={bookedRoom}
                      type="button"
                      role="menuitem"
                      onClick={() => pickRoom(bookedRoom)}
                      className={`w-full px-3 py-2.5 flex items-center gap-2 text-left cursor-pointer transition-colors ${
                        isCurrent ? "bg-white/15" : "hover:bg-white/10"
                      }`}
                    >
                      <Image
                        src="/restaurant/key.svg"
                        alt="Room"
                        width={14}
                        height={14}
                        className="w-3.5 h-3.5 object-contain shrink-0"
                      />
                      <span className="text-xs font-semibold tracking-wide text-white flex-1">
                        Room {bookedRoom}
                      </span>
                      {isCurrent && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2 6.5L4.5 9L10 3.5"
                            stroke="white"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
