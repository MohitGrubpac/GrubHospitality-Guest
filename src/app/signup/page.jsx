"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/component/providers/AuthProvider";
import { ApiError } from "@/lib/api-client";
import { OTP_CHANNEL, OTP_PURPOSE, resolveSignupReservation } from "@/services/authService";
import { maskDestination } from "@/component/login/OtpLoginModal";
import { showOtpErrorToast, showOtpSuccessToast } from "@/component/ui/Toast";

const OTP_LENGTH = 4;

function InlineOtpInput({ value, onChange, disabled }) {
  const handleChange = (event) => {
    const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH);
    onChange(digits);
  };

  return (
    <div className="w-full">
      <label
        htmlFor="signup-otp"
        className="block text-[13px] font-semibold uppercase tracking-wide text-[#6b7971] mb-1.5"
      >
        OTP
      </label>
      <input
        id="signup-otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        placeholder="Enter the 4-digit code"
        className="w-full h-12 px-4 rounded-xl border border-[#e0e3e1] text-base text-[#03130a] placeholder:text-[#b0b8b4] outline-none focus:border-[#fe480b] transition-colors disabled:opacity-60"
      />
    </div>
  );
}

function Field({ id, label, value, onChange, disabled, placeholder }) {
  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="block text-[13px] font-semibold uppercase tracking-wide text-[#6b7971] mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full h-12 px-4 rounded-xl border border-[#e0e3e1] text-base text-[#03130a] placeholder:text-[#b0b8b4] outline-none focus:border-[#fe480b] transition-colors disabled:opacity-60"
      />
    </div>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const { requestOtp, claimReservation } = useAuth();

  const [reservation, setReservation] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isResolving, setIsResolving] = useState(Boolean(token));

  const [channel, setChannel] = useState(OTP_CHANNEL.EMAIL);
  const [name, setName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);

  // A link without a token can never be resolved, so this is derived rather than
  // pushed into state from an effect.
  const missingToken = !token;
  const error = missingToken
    ? new ApiError("This signup link is missing its reservation token.", {
        status: 400,
        code: "INVALID_SIGNUP_TOKEN",
      })
    : loadError;

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    resolveSignupReservation(token)
      .then((details) => {
        if (cancelled) return;
        setReservation(details);
        setName(details?.name || "");
        setRoomNumber(details?.roomNumber || "");
        setChannel(details?.email ? OTP_CHANNEL.EMAIL : OTP_CHANNEL.PHONE);
        setLoadError(null);
      })
      .catch((resolveError) => {
        if (!cancelled) setLoadError(resolveError);
      })
      .finally(() => {
        if (!cancelled) setIsResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const destination = reservation?.[channel === OTP_CHANNEL.EMAIL ? "email" : "phone"] || "";

  const requestCode = useCallback(async () => {
    if (!reservation || !destination) return;

    setIsSubmitting(true);
    try {
      await requestOtp({
        channel,
        destination,
        purpose: OTP_PURPOSE.SIGNUP,
      });
      setIsOtpSent(true);
      showOtpSuccessToast("OTP sent", `We sent a code to ${maskDestination(channel, destination)}.`);
    } catch (error) {
      showOtpErrorToast(
        error instanceof ApiError && error.isRateLimited ? "Too many attempts" : "Couldn't send OTP",
        error?.message || "Please try again in a moment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [reservation, destination, channel, requestOtp]);

  const handleSignup = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const guest = await claimReservation({
        token,
        otpChannel: channel,
        otp,
        name: name.trim() || undefined,
        roomNumber: roomNumber.trim() || undefined,
      });

      showOtpSuccessToast("Welcome", `Your room is all set, ${guest?.name || "guest"}.`);
      router.replace("/home");
    } catch (error) {
      showOtpErrorToast(
        "Signup failed",
        error?.message || "We could not complete your signup. Please try again.",
      );
      if (error instanceof ApiError && ["OTP_INVALID", "OTP_EXPIRED"].includes(error.code)) {
        setOtp("");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [claimReservation, token, channel, otp, name, roomNumber, router]);

  const canSubmit = Boolean(token && reservation && destination && otp.length === OTP_LENGTH);

  const hotelName = reservation?.hotelName || reservation?.hotel?.name || "your hotel";

  const header = useMemo(
    () => (
      <div className="w-full flex flex-col items-center pt-6 pb-2">
        <div className="mb-3 flex justify-center h-10 relative w-[170px]">
          <Image src="/hyatt_logo.png" alt="Hotel" fill className="object-contain" priority />
        </div>
        <h1 className="text-xl font-bold text-[#03130a] text-center mb-1">Complete your signup</h1>
        <p className="text-sm text-[#6b7971] text-center">
          {isResolving
            ? "Checking your reservation..."
            : reservation
              ? `Confirm your details to start ordering at ${hotelName}.`
              : "Enter the details from your booking confirmation."}
        </p>
      </div>
    ),
    [isResolving, reservation, hotelName],
  );

  if (error) {
    return (
      <main className="w-full min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center gap-4">
        <Image
          src="/otp_icons/guest_not_found.svg"
          alt="Warning"
          width={44}
          height={42}
          className="object-contain"
        />
        <h1 className="text-lg font-bold text-[#03130a]">This link is no longer valid</h1>
        <p className="text-sm text-[#6b7971] max-w-[320px]">
          {error.message ||
            "The reservation token is invalid, expired, or has already been claimed."}
        </p>
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="px-6 py-3 rounded-xl bg-[#fe480b] text-white text-sm font-bold uppercase cursor-pointer hover:bg-[#e4450a] transition-colors"
        >
          Back to sign in
        </button>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-white flex flex-col select-none">
      {header}

      <div className="flex-1 overflow-y-auto px-6 pb-10 flex flex-col gap-4">
        {reservation && (
          <>
            <div className="w-full bg-[#f7f8fa] border border-[#e0e3e1] rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6b7971]">Reservation</span>
                <span className="font-semibold text-[#03130a]">{reservation.reservationId}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6b7971]">Check-in</span>
                <span className="font-semibold text-[#03130a]">
                  {reservation.checkInAt ? new Date(reservation.checkInAt).toDateString() : "-"}
                </span>
              </div>
            </div>

            <Field id="signup-name" label="Name" value={name} onChange={setName} />

            <Field
              id="signup-room"
              label="Room number"
              value={roomNumber}
              onChange={setRoomNumber}
              placeholder="e.g. 1204"
            />

            <div className="w-full">
              <span className="block text-[13px] font-semibold uppercase tracking-wide text-[#6b7971] mb-1.5">
                Send OTP to
              </span>
              <div className="flex gap-2">
                {reservation.email && (
                  <button
                    type="button"
                    onClick={() => setChannel(OTP_CHANNEL.EMAIL)}
                    className={`flex-1 h-11 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                      channel === OTP_CHANNEL.EMAIL
                        ? "border-[#fe480b] bg-[#fef2f0] text-[#fe480b]"
                        : "border-[#e0e3e1] text-[#6b7971]"
                    }`}
                  >
                    Email
                  </button>
                )}
                {reservation.phone && (
                  <button
                    type="button"
                    onClick={() => setChannel(OTP_CHANNEL.PHONE)}
                    className={`flex-1 h-11 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                      channel === OTP_CHANNEL.PHONE
                        ? "border-[#fe480b] bg-[#fef2f0] text-[#fe480b]"
                        : "border-[#e0e3e1] text-[#6b7971]"
                    }`}
                  >
                    Phone
                  </button>
                )}
              </div>
            </div>

            {!isOtpSent ? (
              <button
                type="button"
                onClick={requestCode}
                disabled={isSubmitting || !destination}
                className="w-full h-12 rounded-xl bg-[#fe480b] text-white text-base font-semibold uppercase disabled:opacity-50 cursor-pointer hover:bg-[#e4450a] transition-colors"
                id="signup-send-otp"
              >
                {isSubmitting ? "Sending..." : "Send OTP"}
              </button>
            ) : (
              <>
                <InlineOtpInput value={otp} onChange={setOtp} disabled={isSubmitting} />

                <button
                  type="button"
                  onClick={handleSignup}
                  disabled={!canSubmit || isSubmitting}
                  className="w-full h-12 rounded-xl bg-[#fe480b] text-white text-base font-semibold uppercase disabled:opacity-50 cursor-pointer hover:bg-[#e4450a] transition-colors"
                  id="signup-submit"
                >
                  {isSubmitting ? "Submitting..." : "Verify & continue"}
                </button>

                <button
                  type="button"
                  onClick={requestCode}
                  disabled={isSubmitting}
                  className="w-full text-xs font-semibold text-[#fe480b] uppercase tracking-wide cursor-pointer hover:underline disabled:opacity-50"
                >
                  Resend OTP
                </button>
              </>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="w-full py-3 text-sm font-semibold text-[#6b7971] uppercase tracking-wide cursor-pointer hover:text-[#03130a] transition-colors"
        >
          Already registered? Sign in
        </button>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
