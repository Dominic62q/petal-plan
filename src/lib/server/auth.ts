const cache = new Map<string, { uid: string; until: number }>();
const CACHE_MS = 5 * 60_000;

/**
 * Resolves a Firebase ID token to its user id, or throws.
 *
 * It asks Google's Identity Toolkit to validate the token using the app's
 * public web API key. The Admin SDK's verifyIdToken would also work, but its
 * auth module pulls in an ESM-only dependency (jose) that crashes at load time
 * on Vercel's runtime, so it is deliberately not imported here.
 */
export async function verifyUser(token: string): Promise<string> {
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.uid;

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
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error("Token rejected");

  if (cache.size > 500) cache.clear();
  cache.set(token, { uid, until: Date.now() + CACHE_MS });
  return uid;
}
