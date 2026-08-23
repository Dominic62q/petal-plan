"use client";

import { useEffect, useState } from "react";

/**
 * Registers the Serwist service worker in production and surfaces a
 * "new version available" toast once a waiting worker takes over.
 * Clears legacy registrations in development and registers Serwist in production.
 */
export function ServiceWorkerRegistrar() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
    if (!("serviceWorker" in navigator)) return;
      const resetDevelopmentWorker = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) return;
        const hadController = Boolean(navigator.serviceWorker.controller);
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if (hadController && sessionStorage.getItem("petal-dev-sw-reset") !== "1") {
          sessionStorage.setItem("petal-dev-sw-reset", "1");
          window.location.reload();
        }
      };
      void resetDevelopmentWorker();
      return;
    }
    if (!("serviceWorker" in navigator)) return;

    // A controller only exists if a worker is already serving the page — i.e.
    // this is an update, not the very first install. Capturing it before
    // registration prevents the "New version available" toast on first visit.
    const hadController = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      // A new worker took control after skipWaiting — offer a refresh.
      if (navigator.serviceWorker.controller) setUpdateReady(true);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && hadController) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        /* offline support unavailable — the app still works */
      });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
    >
      <p className="text-sm font-medium text-card-foreground">
        New version available
      </p>
      <button
        type="button"
        className="min-h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => window.location.reload()}
      >
        Refresh
      </button>
    </div>
  );
}
