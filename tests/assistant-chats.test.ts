import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({}));
vi.mock("@/lib/firebase", () => ({ db: null }));

import { historyFromTurns, titleFromTurns } from "@/lib/assistant/chats";

describe("saved chats", () => {
  it("tells a resumed chat what was changed, not just what was said", () => {
    const history = historyFromTurns([
      { role: "user", text: "Delete the dinner task" },
      { role: "assistant", text: "Done.", actions: ["Deleted “Dinner”"] },
      { role: "user", text: "Thanks" },
      { role: "assistant", text: "Anytime." },
    ]);
    expect(history[1]).toEqual({
      role: "assistant",
      content: "Done.\n\n[Changes made in this step: Deleted “Dinner”]",
    });
    expect(history[3]).toEqual({ role: "assistant", content: "Anytime." });
  });

  it("titles a chat from the first question, shortened", () => {
    expect(titleFromTurns([{ role: "user", text: "  What's   due today? " }])).toBe("What's due today?");
    expect(titleFromTurns([{ role: "user", text: "x".repeat(80) }])).toHaveLength(58);
    expect(titleFromTurns([])).toBe("New chat");
  });
});
