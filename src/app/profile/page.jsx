"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import ProfileCard from "@/component/profile/ProfileCard";
import StayDetailsCard from "@/component/profile/StayDetailsCard";
import OrderStatusCard from "@/component/profile/OrderStatusCard";
import OrderHistoryCard from "@/component/profile/OrderHistoryCard";
import ProfileEditView from "@/component/profile/ProfileEditView";
import { useAuth } from "@/component/providers/AuthProvider";
import { useRoom } from "@/component/providers/RoomProvider";

export default function ProfilePage() {
  const router = useRouter();
  const { guest, updateProfile, logout, isLoading } = useAuth();
  const { selectedRoom } = useRoom();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (isLoading || !guest) {
    return (
      <div className="w-full min-h-screen bg-[#f8faf9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#fe480b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const userWithRoom = { ...guest, room: selectedRoom || guest.room };

  const handleBack = () => {
    if (isEditing) {
      setIsEditing(false);
      return;
    }
    router.push("/home");
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  return (
    <div className="w-full h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden font-sans">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-[#f7f8fa] h-screen shadow-sm flex flex-col overflow-hidden relative">
        {/* Header Bar: Back Button */}
        <header className="w-full px-5 py-4 bg-white border-b border-[#eff1f0] flex items-center gap-3 shrink-0 z-40">
          <button
            type="button"
            onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <Image
              src="/restaurant/back.svg"
              alt="Back"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
          </button>
          <h1 className="text-lg font-bold text-[#03130a]">Back</h1>
        </header>

        <main className="flex-1 px-5 pt-4 pb-12 flex flex-col gap-4 overflow-y-auto">
          {isEditing ? (
            <ProfileEditView
              key={`${guest.name}-${guest.roomNumber}`}              user={userWithRoom}
              onSave={updateProfile}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <ProfileCard user={userWithRoom} onEditClick={() => setIsEditing(true)} />

              <StayDetailsCard user={guest} />

              <OrderStatusCard />

              <OrderHistoryCard />

              {/* Logout Button */}
              <div className="w-full pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full py-3 bg-white border border-[#03130a]/40 text-[#445048] rounded-xl text-sm font-bold uppercase flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
                >
                  <Image
                    src="/profile/logout.svg"
                    alt="Logout"
                    width={18}
                    height={18}
                    className="w-4.5 h-4.5 object-contain"
                  />
                  <span>{isLoggingOut ? "logging out..." : "logout"}</span>
                </button>
              </div>

              {/* Footer */}
              <div className="flex flex-col items-center gap-4 py-4 mt-1 bg-transparent">
                <div className="flex items-center justify-center gap-8 text-xs font-bold text-[#6b7971]">
                  <Link href="/help" className="flex items-center gap-1.5 uppercase cursor-pointer">
                    <Image
                      src="/profile/help.svg"
                      alt="Help"
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain opacity-70"
                    />
                    <span>help</span>
                  </Link>
                  <Link href="/help" className="uppercase cursor-pointer">
                    faq
                  </Link>
                </div>

                <div className="flex items-center justify-center gap-6 text-xs font-bold text-[#6b7971] tracking-wider uppercase">
                  <Link href="/privacy-policy" className="cursor-pointer">
                    privacy policy
                  </Link>
                  <Link href="/terms-of-service" className="cursor-pointer">
                    terms of service
                  </Link>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
