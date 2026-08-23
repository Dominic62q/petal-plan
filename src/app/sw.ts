import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & SerwistGlobalConfig;

type ReminderPushPayload = {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
};

function readPushPayload(event: PushEvent): ReminderPushPayload {
  try {
    return JSON.parse(event.data?.text() ?? "{}") as ReminderPushPayload;
  } catch {
    return {};
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // App shell + static assets are precached; runtime caching covers
  // same-origin navigations and Google Fonts while the app is live.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Petal & Plan", {
      body: payload.body ?? "You have a reminder.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag ?? "petal-plan-reminder",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => "focus" in client) as WindowClient | undefined;
      if (existing) {
        await existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
