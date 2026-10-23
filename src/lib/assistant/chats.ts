import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChatMessage } from "@/lib/assistant/types";

/**
 * Saved conversations live under the signed-in user (users/{uid}/chats), which
 * the Firestore rules limit to that user. Only the visible conversation is
 * stored — questions, answers and what changed — not the raw tool results, so a
 * chat stays small and resuming it simply lets the assistant look things up again.
 */

export type StoredTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; actions?: string[]; used?: string[] };

export type SavedChat = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: StoredTurn[];
};

const MAX_CHATS = 40;
const MAX_TURNS = 100;

const chatsCollection = (uid: string) => collection(db!, "users", uid, "chats");

function requireDb() {
  if (!db) throw new Error("Firebase is not configured");
}

export function titleFromTurns(turns: StoredTurn[]): string {
  const first = turns.find((turn) => turn.role === "user")?.text.replace(/\s+/g, " ").trim() ?? "New chat";
  return first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first;
}

export async function listChats(uid: string): Promise<SavedChat[]> {
  requireDb();
  const snapshot = await getDocs(query(chatsCollection(uid), orderBy("updatedAt", "desc"), limit(MAX_CHATS)));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as Partial<SavedChat>;
    return {
      id: entry.id,
      title: data.title ?? "Chat",
      createdAt: data.createdAt ?? 0,
      updatedAt: data.updatedAt ?? 0,
      turns: Array.isArray(data.turns) ? data.turns : [],
    };
  });
}

export async function saveChat(uid: string, chat: { id: string; createdAt: number; turns: StoredTurn[] }): Promise<void> {
  requireDb();
  const turns = chat.turns.slice(-MAX_TURNS).map((turn) =>
    turn.role === "user"
      ? { role: "user" as const, text: turn.text }
      : {
          role: "assistant" as const,
          text: turn.text,
          ...(turn.actions?.length ? { actions: turn.actions } : {}),
          ...(turn.used?.length ? { used: turn.used } : {}),
        },
  );
  await setDoc(doc(chatsCollection(uid), chat.id), {
    title: titleFromTurns(chat.turns),
    createdAt: chat.createdAt,
    updatedAt: Date.now(),
    turns,
  });
}

export async function deleteChat(uid: string, chatId: string): Promise<void> {
  requireDb();
  await deleteDoc(doc(chatsCollection(uid), chatId));
}

/**
 * A saved chat as the model's conversation so far. The changes an answer made
 * are added to its text, so a resumed chat still knows what was added or deleted.
 */
export function historyFromTurns(turns: StoredTurn[]): ChatMessage[] {
  return turns.map((turn): ChatMessage => {
    if (turn.role === "user") return { role: "user", content: turn.text };
    const changes = turn.actions?.length ? `\n\n[Changes made in this step: ${turn.actions.join("; ")}]` : "";
    return { role: "assistant", content: `${turn.text}${changes}` };
  });
}
