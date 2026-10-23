import { FieldValue } from "firebase-admin/firestore";
import { adminConfigured, adminDb } from "@/lib/server/firebase-admin";

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Model calls across every user per UTC day: the one ceiling, which protects
 * the shared plan. Individual users have no limit of their own.
 */
const globalDaily = () => num(process.env.ASSISTANT_GLOBAL_DAILY_LIMIT, 3000);

export class LimitError extends Error {
  constructor(
    message: string,
    readonly status: 429 | 503 = 429,
  ) {
    super(message);
  }
}

const dayKey = () => new Date().toISOString().slice(0, 10);

// Used when no service account is configured (running locally): the same
// budgets, counted in this process and reset on restart.
const memory = new Map<string, number>();

function reserveInMemory(uid: string) {
  const day = dayKey();
  for (const key of memory.keys()) if (!key.endsWith(day)) memory.delete(key);
  const userKey = `${uid}_${day}`;
  const globalKey = `global_${day}`;
  if ((memory.get(globalKey) ?? 0) >= globalDaily()) {
    throw new LimitError("The assistant is at capacity for today. Try again tomorrow.", 503);
  }
  memory.set(userKey, (memory.get(userKey) ?? 0) + 1);
  memory.set(globalKey, (memory.get(globalKey) ?? 0) + 1);
}

/**
 * Counts one model call against the global daily budget (and records it for
 * the user). With a service account the counters live in `assistantUsage`,
 * which no client rule exposes, so only this server can read or change them.
 */
export async function reserveCall(uid: string): Promise<void> {
  if (!adminConfigured()) return reserveInMemory(uid);
  const db = adminDb();
  const day = dayKey();
  const userRef = db.collection("assistantUsage").doc(`${uid}_${day}`);
  const globalRef = db.collection("assistantUsage").doc(`global_${day}`);

  await db.runTransaction(async (tx) => {
    const globalSnap = await tx.get(globalRef);
    const globalCalls = (globalSnap.data()?.calls as number | undefined) ?? 0;
    if (globalCalls >= globalDaily()) {
      throw new LimitError("The assistant is at capacity for today. Try again tomorrow.", 503);
    }
    tx.set(userRef, { uid, day, calls: FieldValue.increment(1) }, { merge: true });
    tx.set(globalRef, { day, calls: FieldValue.increment(1) }, { merge: true });
  });
}

/** Best-effort token accounting after a successful call; never blocks the answer. */
export async function recordTokens(uid: string, totalTokens: number | undefined): Promise<void> {
  if (!totalTokens || !adminConfigured()) return;
  const db = adminDb();
  const day = dayKey();
  const batch = db.batch();
  batch.set(db.collection("assistantUsage").doc(`${uid}_${day}`), { tokens: FieldValue.increment(totalTokens) }, { merge: true });
  batch.set(db.collection("assistantUsage").doc(`global_${day}`), { tokens: FieldValue.increment(totalTokens) }, { merge: true });
  await batch.commit();
}
