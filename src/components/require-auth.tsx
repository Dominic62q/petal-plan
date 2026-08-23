"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

/**
 * Client-side auth gate.
 *
 * While the session restores we keep rendering children behind an overlay
 * instead of a bare spinner — so navigating directly to /schedule never
 * flashes an empty screen. Unauthenticated users are pushed to /login once
 * the session resolves as signed-out. A 6s safety net catches a hung
 * session-restore (e.g. blocked storage) and treats it as signed-out.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // The safety-net timeout in AuthProvider can flip status to signed-out
    // while a signup is mid-flight on /login itself — never redirect then.
    if (status === "signed-out" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [status, pathname, router]);
  // While the session resolves we render children behind a blocking overlay
  // so direct visits to gated routes never show an empty screen. AuthProvider
  // guarantees `loading` resolves (listener or 6s safety net).
  return (
    <>
      <div
        aria-hidden={status !== "signed-in"}
        style={
          status === "loading"
            ? { pointerEvents: "none", userSelect: "none" }
            : status === "signed-out"
              ? { visibility: "hidden" }
              : undefined
        }
      >
        {children}
      </div>
      {status === "loading" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
            role="progressbar"
            aria-label="Checking your session"
          />
        </div>
      ) : null}
    </>
  );
}
