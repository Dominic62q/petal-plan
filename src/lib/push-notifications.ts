import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, firebaseApp } from "@/lib/firebase";

export type PushSetupResult = "subscribed" | "denied" | "unsupported";

type SerializedPushSubscription = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { auth?: string; p256dh?: string };
};

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function subscriptionId(endpoint: string): Promise<string> {
  const encoded = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertPushSubscription(subscription: SerializedPushSubscription) {
  if (!subscription.endpoint || !subscription.keys?.auth || !subscription.keys.p256dh) {
    throw new Error("Your browser did not provide a complete push subscription.");
  }
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { auth: subscription.keys.auth, p256dh: subscription.keys.p256dh },
  };
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushSubscriptionCount(uid: string): Promise<number> {
  if (!db) throw new Error("Firebase is not configured");
  const snapshot = await getDocs(collection(db, "users", uid, "pushSubscriptions"));
  return snapshot.size;
}

export async function enablePushNotifications(uid: string): Promise<PushSetupResult> {
  if (!pushSupported()) return "unsupported";
  if (!db) throw new Error("Firebase is not configured");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Notifications are not configured yet.");

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const serialized = assertPushSubscription(subscription.toJSON());
  const id = await subscriptionId(serialized.endpoint);
  await setDoc(doc(db, "users", uid, "pushSubscriptions", id), {
    ...serialized,
    userAgent: navigator.userAgent,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return "subscribed";
}

export async function disablePushNotifications(uid: string): Promise<void> {
  if (!pushSupported() || !db) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const serialized = assertPushSubscription(subscription.toJSON());
  await subscription.unsubscribe();
  await deleteDoc(doc(db, "users", uid, "pushSubscriptions", await subscriptionId(serialized.endpoint)));
}

export async function sendTestPushNotification(): Promise<number> {
  if (!firebaseApp) throw new Error("Firebase is not configured");
  const functions = getFunctions(firebaseApp, "us-central1");
  const sendTest = httpsCallable<undefined, { delivered: number }>(functions, "sendTestReminder");
  const response = await sendTest();
  return response.data.delivered;
}
