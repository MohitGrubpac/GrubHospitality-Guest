"use client";

import Image from "next/image";

export default function ProfileCard({ user, onEditClick }) {
  const name = user?.name || user?.guestName || "Guest";
  const roomNumber = user?.room || user?.roomNumber || "-";
  const initials = user?.avatarInitials || "G";

  return (
    <div className="w-full bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e0e3e1] flex items-center justify-between gap-4">
      <div className="flex flex-col items-center gap-3 shrink-0">
        <div className="w-[107px] h-[107px] rounded-full bg-[#FF4848] border border-white flex items-center justify-center text-white text-[28px] font-semibold leading-[36px] relative overflow-hidden shadow-xs">
          <span className="text-white font-semibold text-[28px] leading-[36px]">{initials}</span>
        </div>

        <button
          type="button"
          onClick={onEditClick}
          className="flex items-center justify-end gap-[4px] h-[20px] text-xs font-medium text-[#FF3333] uppercase cursor-pointer"
        >
          <Image
            src="/profile/edit.svg"
            alt="Edit"
            width={16}
            height={16}
            className="w-4 h-4 object-contain"
          />
          <span className="text-[14px] leading-[16px] font-medium uppercase tracking-normal text-[#FF3333]">
            edit info
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-w-0 pl-1">
        <div className="flex items-start gap-3 w-full">
          <div className="w-7 h-7 flex items-center justify-center shrink-0 mt-0.5">
            <Image
              src="/profile/user.svg"
              alt="User"
              width={16}
              height={16}
              className="w-4 h-4 object-contain"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-[16px] leading-[24px] font-semibold text-[#37493F] truncate">
              {name}
            </h3>
            <span className="text-[14px] leading-[20px] font-normal text-[#6B7971]">
              Name
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3 w-full">
          <div className="w-7 h-7 flex items-center justify-center shrink-0 mt-0.5">
            <Image
              src="/profile/key.svg"
              alt="Key"
              width={16}
              height={16}
              className="w-4 h-4 object-contain"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-[16px] leading-[24px] font-semibold text-[#37493F] truncate">
              {roomNumber}
            </h3>
            <span className="text-[14px] leading-[20px] font-normal text-[#6B7971]">
              Room Number
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
