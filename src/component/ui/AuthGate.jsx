"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingScreen from "@/component/ui/LoadingScreen";
import { AUTH_STATUS, useAuth } from "@/component/providers/AuthProvider";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];

function isPublicRoute(pathname) {
  if (!pathname) return true;
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Sends anonymous visitors to /login, keeps signed-in guests off the auth screens,
 * and holds the UI on a loader while the stored session is validated via GET /guests/me.
 */
export default function AuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();

  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    if (status === AUTH_STATUS.ANONYMOUS && !isPublic) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
      return;
    }

    if (status === AUTH_STATUS.AUTHENTICATED && isPublic) {
      router.replace("/home");
    }
  }, [status, isPublic, pathname, router]);
  if (status === AUTH_STATUS.LOADING) {
    return <LoadingScreen duration={1400} />;
  }

  if (status === AUTH_STATUS.ANONYMOUS) {
    return isPublic ? children : null;
  }

  if (isPublic) return null;

  return children;
}
