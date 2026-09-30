"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginHeader from "@/component/login/LoginHeader";
import OtpLoginModal, { maskDestination } from "@/component/login/OtpLoginModal";
import OtpVerifyModal from "@/component/login/OtpVerifyModal";
import { useAuth } from "@/component/providers/AuthProvider";
import { useRoom } from "@/component/providers/RoomProvider";
import { ApiError } from "@/lib/api-client";
import { OTP_PURPOSE } from "@/services/authService";
import { showError, showOtpErrorToast, showOtpSuccessToast } from "@/component/ui/Toast";

const INVALID_OTP_CODES = ["OTP_INVALID", "OTP_EXPIRED"];
const BLOCKED_CODES = ["GUEST_BLOCKED", "UNAUTHORIZED"];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { requestOtp, loginWithOtp, loginWithGoogle, organizationId, isSubmitting } = useAuth();
  const { setSelectedRoom } = useRoom();

  const [step, setStep] = useState("login");
  const [destination, setDestination] = useState(null);
  const [showGuestNotFound, setShowGuestNotFound] = useState(false);

  const nextRoute = searchParams?.get("next");

  const goHome = async () => {
    if (nextRoute && nextRoute.startsWith("/")) {
      router.replace(nextRoute);
      return;
    }
    router.replace("/home");
  };

  const handleGetOtp = async ({ channel, destination: entered }) => {
    try {
      await requestOtp({
        channel,
        destination: entered,
        purpose: OTP_PURPOSE.LOGIN,
      });
      setDestination({ channel, value: entered });
      setStep("verify");
    } catch (otpError) {
      if (otpError instanceof ApiError && otpError.isRateLimited) {
        showOtpErrorToast(
          "Too many attempts",
          otpError.message || "Please wait a moment before requesting another OTP.",
        );
        return;
      }
      if (otpError instanceof ApiError && otpError.code === "ORGANIZATION_NOT_CONFIGURED") {
        showOtpErrorToast("Hotel not configured", otpError.message);
        return;
      }
      showOtpErrorToast(
        "Couldn't send OTP",
        otpError?.message || "Please check your details and try again.",
      );
    }
  };

  const handleVerify = async (otp) => {
    if (!destination) return;

    try {
      const guest = await loginWithOtp({
        channel: destination.channel,
        destination: destination.value,
        otp,
      });

      showOtpSuccessToast("OTP Verified", `Welcome back, ${guest?.name || "guest"}.`);

      if (guest?.roomNumber) {
        await setSelectedRoom(guest.roomNumber);
      }

      goHome();
    } catch (loginError) {
      if (loginError instanceof ApiError && BLOCKED_CODES.includes(loginError.code)) {
        setShowGuestNotFound(true);
        showOtpErrorToast("Guest Details Not Found", loginError.message);
        return;
      }

      if (loginError instanceof ApiError && INVALID_OTP_CODES.includes(loginError.code)) {
        showOtpErrorToast("Invalid OTP", loginError.message || "Please try again.");
        return;
      }

      showOtpErrorToast(
        "Sign in failed",
        loginError?.message || "Please try again in a moment.",
      );
    }
  };

  const handleResend = async () => {
    if (!destination) return;

    try {
      await requestOtp({
        channel: destination.channel,
        destination: destination.value,
        purpose: OTP_PURPOSE.LOGIN,
      });
      showOtpSuccessToast("OTP sent", `We sent a new code to ${maskDestination(destination.channel, destination.value)}.`);
    } catch (resendError) {
      showError(
        resendError instanceof ApiError && resendError.isRateLimited
          ? "Please wait before requesting another OTP."
          : resendError?.message || "Could not resend the OTP.",
      );
    }
  };

  const handleGoogle = async (idToken) => {
    if (!idToken) return;

    try {
      const guest = await loginWithGoogle({ idToken });
      showOtpSuccessToast("Signed in", `Welcome, ${guest?.name || "guest"}.`);
      if (guest?.roomNumber) await setSelectedRoom(guest.roomNumber);
      goHome();
    } catch (googleError) {
      showOtpErrorToast(
        "Google sign in failed",
        googleError?.message || "Please try again.",
      );
    }
  };

  return (
    <main className="w-full min-h-screen bg-white flex flex-col justify-between select-none relative">
      {showGuestNotFound && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-[#ffcccc] border border-[#cc0101] rounded-xl p-4 flex gap-3 shadow-lg transition-all">
          <div className="flex-1">
            <h3 className="text-[14px] leading-[18px] font-bold text-[#cc0101] mb-1">
              Guest Details Not Found
            </h3>
            <p className="text-[12px] leading-[16px] font-normal text-[#cc0101]">
              We couldn&rsquo;t find your details in our system.
              <br />
              Please contact hotel staff for support.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuestNotFound(false)}
            className="self-start text-[#cc0101] text-lg leading-none cursor-pointer"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <LoginHeader />

      {step === "login" ? (
        <OtpLoginModal
          onNext={handleGetOtp}
          onGoogleCredential={handleGoogle}
          isSubmitting={isSubmitting}
        />
      ) : (
        <OtpVerifyModal
          destination={maskDestination(destination.channel, destination.value)}
          channel={destination.channel}
          onBack={() => setStep("login")}
          onVerify={handleVerify}
          onResend={handleResend}
          isSubmitting={isSubmitting}
        />
      )}

      {!organizationId && (
        <p className="px-6 pb-4 text-[11px] text-center text-[#b42318]">
          Hotel organization is not configured. Set NEXT_PUBLIC_ORGANIZATION_ID to enable sign in.
        </p>
      )}
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
