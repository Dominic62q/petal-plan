import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Same database id as src/lib/firebase.ts.
const FIRESTORE_DATABASE_ID = "petal-db";

// Only app and firestore are imported on purpose: firebase-admin/auth drags in
// an ESM-only dependency that fails to load on Vercel (see lib/server/auth.ts).

function readServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  // Accept raw JSON, or base64 of it (easier to paste into hosting dashboards).
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text) as Record<string, unknown>;
}

export const adminConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim());

function adminApp(): App {
  if (getApps().length) return getApp();
  const account = readServiceAccount();
  if (!account) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  return initializeApp({ credential: cert(account as Parameters<typeof cert>[0]) });
}

export const adminDb = () => getFirestore(adminApp(), FIRESTORE_DATABASE_ID);
