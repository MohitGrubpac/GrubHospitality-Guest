"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Input from "@/component/ui/Input";
import Icon from "@/component/ui/Icon";
import Image from "next/image";
import GoogleSignInButton from "@/component/login/GoogleSignInButton";

export const EMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;

export function detectChannel(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return null;
  if (EMAIL_PATTERN.test(trimmed)) return "EMAIL";
  if (/^\d{10}$/.test(trimmed)) return "PHONE";
  return null;
}

export function maskDestination(channel, destination) {
  const trimmed = String(destination || "").trim();
  if (!trimmed) return "";

  if (channel === "PHONE") return `+91 ${trimmed}`;
  const [local, domain] = trimmed.split("@");
  if (!domain) return trimmed;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

export default function OtpLoginModal({ onNext, onGoogleCredential, isSubmitting = false }) {
  const [value, setValue] = useState("");

  const channel = useMemo(() => detectChannel(value), [value]);
  const isValid = Boolean(channel);

  const handleGetOtp = (event) => {
    if (event) event.preventDefault();
    if (isValid && !isSubmitting && onNext) {
      onNext({ channel, destination: value.trim() });
    }
  };

  // Clamp phone numbers to 10 digits in the handler rather than via maxLength:
  // a maxLength that switches on the current value reads "" on the very first
  // change, so pasting a full email address would get truncated to 10 chars.
  const handleInputChange = (event) => {
    let next = event.target.value;
    if (!next.includes("@") && /^\d+$/.test(next)) {
      next = next.slice(0, 10);
    }
    setValue(next);
  };

  return (
    <form
      onSubmit={handleGetOtp}
      className="w-full flex-1 bg-white rounded-t-xl -mt-5 z-30 px-6 pt-4 pb-5 flex flex-col justify-between items-center shadow-lg overflow-y-auto"
    >
      <div className="w-full flex flex-col items-center">
        {/* Hotel Logo */}
        <div className="mb-2.5 flex justify-center h-10 relative w-[170px]">
          <Image
            src="/hyatt_logo.png"
            alt="Hotel"
            fill
            sizes="170px"
            className="object-contain"
            priority
          />
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-xl font-bold text-[var(--color-neutral-primary)] mb-1 text-center">
          Welcome
        </h2>
        <p className="text-[var(--color-neutral-secondary)] text-sm text-center mb-4">
          Enter your mobile number or email to continue.
        </p>

        {/* Mobile / Email Input */}
        <div className="relative w-full mb-3.5">
          <Input
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="Mobile number or email"
            value={value}
            onChange={handleInputChange}
            maxLength={100}
            className="w-full pl-12 pr-4 h-12 text-base rounded-xl text-[var(--color-neutral-secondary)] placeholder:text-[var(--color-neutral-secondary)] border border-[#e0e3e1] focus:border-[#e0e3e1] focus:outline-none focus:ring-0"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-neutral-secondary)] pointer-events-none">
            <Icon name="login_user" className="h-5 w-5" />
          </span>
        </div>

        {/* get otp */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full h-12 text-base font-semibold rounded-xl border transition-all flex items-center justify-center gap-2 mb-3.5 ${
            isValid && !isSubmitting
              ? "bg-[#FF480B] border-[#FF480B] text-white active:bg-[#e03d06] cursor-pointer"
              : "bg-[#eff1f0] border-[#e0e3e1] text-[#c1c7c4] cursor-not-allowed"
          }`}
          id="get-otp-btn"
        >
          <span className="uppercase">{isSubmitting ? "sending..." : "get otp"}</span>
          <Icon name="arrow_right" className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="relative w-full flex items-center justify-center mb-3.5">
          <div className="border-t border-[#e0e3e1] w-full" />
          <span className="absolute bg-white px-2 text-xs text-[#6b7971] uppercase tracking-wider font-medium">
            or
          </span>
        </div>

        <GoogleSignInButton onCredential={onGoogleCredential} disabled={isSubmitting} />

        {/* Footer */}
        <div className="flex items-center gap-4 text-xs text-[#6b7971] font-medium mt-1 mb-1">
          <Link href="/privacy-policy" className="hover:underline uppercase">
            privacy policy
          </Link>
          <span>|</span>
          <Link href="/terms-of-service" className="hover:underline uppercase">
            terms of services
          </Link>
        </div>
      </div>
    </form>
  );
}
