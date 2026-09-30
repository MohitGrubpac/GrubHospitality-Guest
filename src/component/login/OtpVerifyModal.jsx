"use client";

import { useRef, useState } from "react";
import Icon from "@/component/ui/Icon";
import Image from "next/image";

const OTP_LENGTH = 4;

export default function OtpVerifyModal({
  destination,
  channel = "EMAIL",
  onBack,
  onVerify,
  onResend,
  isSubmitting = false,
}) {
  const [otp, setOtp] = useState(() => Array(OTP_LENGTH).fill(""));
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  const otpString = otp.join("");
  const isDisabled = otpString.length !== OTP_LENGTH || isSubmitting;

  const setDigit = (index, value) => {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    setOtp((previous) => {
      const next = [...previous];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) otpRefs[index + 1].current?.focus();
  };

  const handleVerify = () => {
    if (isDisabled) return;
    onVerify?.(otpString);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
    if (event.key === "Enter" && !isDisabled) {
      handleVerify();
    }
  };

  return (
    <div className="w-full flex-1 bg-white rounded-t-xl -mt-5 z-30 px-6 pt-5 pb-6 flex flex-col justify-between items-center shadow-lg overflow-y-auto">
      <div className="w-full flex flex-col items-center">
        {/* Hotel Logo */}
        <div className="mb-3 flex justify-center h-10 relative w-[170px]">
          <Image src="/hyatt_logo.png" alt="Hotel" fill className="object-contain" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-[var(--color-neutral-primary)] mb-1 text-center">
          OTP Verification
        </h2>

        <p className="text-[var(--color-neutral-tertiary)] text-sm text-center mb-6 italic">
          Enter the OTP sent to{" "}
          <span className="font-semibold text-[var(--color-neutral-tertiary)]">
            {destination}
          </span>
        </p>

        {/* OTP Inputs */}
        <div className="flex gap-3 mb-6 w-full justify-center">
          {otp.map((digit, index) => (
            <div
              key={index}
              className="relative flex-1 max-w-[70px] h-[54px] rounded-xl border border-[#e0e3e1] focus-within:border-2 focus-within:border-[#FF480B] bg-white flex items-center justify-center transition-all"
            >
              <input
                ref={otpRefs[index]}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                placeholder="0"
                aria-label={`OTP digit ${index + 1}`}
                className="w-full h-full rounded-xl text-center text-base text-[var(--color-neutral-primary)] outline-none bg-transparent"
                value={digit}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={handleKeyDown(index)}
                onPaste={(event) => {
                  event.preventDefault();
                  const pasted = event.clipboardData.getData("text").replace(/[^0-9]/g, "");
                  if (!pasted) return;
                  const next = [...otp];
                  pasted
                    .slice(0, OTP_LENGTH)
                    .split("")
                    .forEach((value, offset) => {
                      next[offset] = value;
                    });
                  setOtp(next);
                  otpRefs[Math.min(pasted.length, OTP_LENGTH - 1)].current?.focus();
                }}
              />
            </div>
          ))}
        </div>

        {/* Verify button */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleVerify}
          className={`w-full h-12 font-semibold text-base rounded-xl transition-all flex items-center justify-center gap-2 mb-4 ${
            !isDisabled
              ? "bg-[#FF480B] border-[#FF480B] text-white active:bg-[#e03d06] cursor-pointer"
              : "bg-[#eff1f0] border-[#e0e3e1] text-[#c1c7c4] cursor-not-allowed"
          }`}
          id="verify-otp-btn"
        >
          <span className="uppercase">{isSubmitting ? "verifying..." : "verify"}</span>
          <Icon name="arrow_right" className="w-5 h-5" />
        </button>

        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="text-sm font-semibold text-[var(--color-neutral-secondary)] hover:text-slate-900 transition-colors uppercase tracking-wider py-1 mb-5 cursor-pointer disabled:opacity-50"
        >
          back
        </button>

        {/* Resend */}
        <div className="text-xs text-[var(--color-neutral-tertiary)] font-medium text-center mb-2">
          <span>Don&rsquo;t receive the OTP? </span>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setOtp(Array(OTP_LENGTH).fill(""));
              onResend?.();
            }}
            className="text-[#FF3333] font-semibold hover:underline cursor-pointer uppercase ml-1 disabled:opacity-50"
          >
            resend
          </button>
        </div>

        <p className="text-[11px] text-[var(--color-neutral-tertiary)] mt-2">
          Sent via {channel === "PHONE" ? "SMS" : "email"}
        </p>
      </div>
    </div>
  );
}
