"use client";

import Image from "next/image";

export default function HomeHeroBanner({ user }) {
  if (!user) return null;

  return (
    <div className="relative w-full h-[430px] sm:h-[500px] rounded-lg overflow-hidden shadow-sm border bg-[#1c2b24]">
      <Image
        src="/loginCrousel/Login_Crousel1.jpg"
        alt={user.hotel || "Hotel"}
        fill
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

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
        {user.room && (
          <div className="self-start px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center gap-2">
            <Image
              src="/restaurant/key.svg"
              alt="Room"
              width={14}
              height={14}
              className="w-3.5 h-3.5 object-contain"
            />
            <span className="text-xs font-semibold tracking-wide">Room {user.room}</span>
          </div>
        )}
      </div>
    </div>
  );
}
