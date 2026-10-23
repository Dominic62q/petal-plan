import { adminAuth, adminConfigured } from "@/lib/server/firebase-admin";

const cache = new Map<string, { uid: string; until: number }>();
const CACHE_MS = 5 * 60_000;

/**
 * Resolves a Firebase ID token to its user id, or throws.
 *
 * With a service account configured this uses the Admin SDK. Without one it
 * asks Google's own Identity Toolkit to validate the token using the app's
 * public web API key, so running locally needs no extra secret.
 */
export async function verifyUser(token: string): Promise<string> {
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.uid;

  let uid: string;
  if (adminConfigured()) {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } else {
    const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!key) throw new Error("Firebase web API key is not configured");
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Token rejected");
    const data = (await response.json()) as { users?: Array<{ localId?: string }> };
    const found = data.users?.[0]?.localId;
    if (!found) throw new Error("Token rejected");
    uid = found;
  }

  if (cache.size > 500) cache.clear();
  cache.set(token, { uid, until: Date.now() + CACHE_MS });
  return uid;
}
