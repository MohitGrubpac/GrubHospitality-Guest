"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { showError, showSuccess } from "@/component/ui/Toast";

/**
 * PATCH /guests/me accepts name, roomNumber, checkInAt and checkOutAt only -
 * email and phone are read-only. The parent remounts this with a `key` on the
 * saved profile so the fields always start from the current values.
 */
export default function ProfileEditView({ user, onSave, onCancel }) {
  const [name, setName] = useState(user?.name || "");
  const [roomNumber, setRoomNumber] = useState(user?.roomNumber || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const patch = {};
    if (name.trim() && name.trim() !== user?.name) patch.name = name.trim();
    if (roomNumber.trim() && roomNumber.trim() !== user?.roomNumber) {
      patch.roomNumber = roomNumber.trim();
    }

    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(patch);
      showSuccess("Profile updated", "Your details have been saved.");
      onCancel();
    } catch (saveError) {
      showError(
        saveError instanceof ApiError
          ? saveError.message
          : "Could not save your profile. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex-1 flex flex-col justify-between pt-2 pb-6 px-1">
      <div className="flex flex-col gap-4 w-full">
        <div className="w-full flex flex-col items-center">
          <div className="w-[107px] h-[107px] rounded-full bg-[#FF4848] border border-white flex items-center justify-center text-white text-[28px] font-semibold leading-[36px] shadow-xs">
            <span>{user?.avatarInitials || "G"}</span>
          </div>
        </div>

        <div className="w-full bg-white rounded-2xl p-5 shadow-xs border border-[#E0E3E1] flex flex-col gap-4">
          <div className="flex flex-col gap-2 w-full">
            <label htmlFor="edit-name" className="text-[16px] leading-[24px] text-[#37493F]">
              Name
            </label>
            <div className="w-full h-[44px] px-4 py-3 bg-white border border-[#E0E3E1] rounded-lg flex items-center focus-within:border-[#FF3333] transition-colors">
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                className="w-full bg-transparent text-[14px] leading-[20px] text-[#03130A] outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label htmlFor="edit-room" className="text-[16px] leading-[24px] text-[#37493F]">
              Room Number
            </label>
            <div className="w-full h-[44px] px-4 py-3 bg-white border border-[#E0E3E1] rounded-lg flex items-center focus-within:border-[#FF3333] transition-colors">
              <input
                id="edit-room"
                type="text"
                value={roomNumber}
                onChange={(event) => setRoomNumber(event.target.value)}
                maxLength={12}
                className="w-full bg-transparent text-[14px] leading-[20px] text-[#03130A] outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <span className="text-[16px] leading-[24px] text-[#37493F]">Mobile</span>
            <div className="w-full h-[44px] px-4 py-3 bg-[#f7f8fa] border border-[#E0E3E1] rounded-lg flex items-center">
              <span className="text-[14px] leading-[20px] text-[#6B7971]">
                {user?.mobile || "Not provided"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <span className="text-[16px] leading-[24px] text-[#37493F]">Email</span>
            <div className="w-full h-[44px] px-4 py-3 bg-[#f7f8fa] border border-[#E0E3E1] rounded-lg flex items-center">
              <span className="text-[14px] leading-[20px] text-[#6B7971]">
                {user?.email || "Not provided"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full pt-6 flex flex-col gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="w-full h-[48px] bg-[#FF4848] border border-[#FF3333] text-white rounded-lg text-[18px] leading-[24px] font-medium uppercase cursor-pointer shadow-xs disabled:opacity-60"
        >
          {isSaving ? "saving..." : "update profile"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 text-sm font-semibold text-[#6b7971] uppercase cursor-pointer hover:text-[#03130a] transition-colors"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
