"use client";

import { useCallback, useEffect, useRef } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const SCRIPT_ID = "google-identity-services";

let scriptPromise = null;

function loadGoogleIdentityServices() {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("google-identity-services-failed"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Renders Google's sign-in button and hands the ID token back for
 * POST /guest-auth/google. Renders nothing when no client id is configured.
 */
export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const buttonRef = useRef(null);
  const credentialRef = useRef(onCredential);

  useEffect(() => {
    credentialRef.current = onCredential;
  }, [onCredential]);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredential = useCallback((response) => {
    credentialRef.current?.(response?.credential);
  }, []);

  useEffect(() => {
    if (!clientId || disabled) return undefined;

    let cancelled = false;

    const render = async () => {
      try {
        const google = await loadGoogleIdentityServices();
        if (cancelled || !buttonRef.current) return;

        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
        });

        google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          width: 320,
          text: "continue_with",
        });
      } catch {
        /* Google unavailable (offline / blocked) - the rest of login still works */
      }
    };

    render();

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.cancel();
        } catch {
          /* no-op */
        }
      }
    };
  }, [clientId, disabled, handleCredential]);

  if (!clientId) return null;

  return (
    <div className="w-full flex flex-col items-center gap-2 my-3" data-google-signin="pending">
      <div ref={buttonRef} className="flex justify-center min-h-[44px]" />
    </div>
  );
}
