import { todayIso } from "@/lib/datetime";
import { currentTimeZone } from "@/lib/reminders";
import { describeAction, type ToolRunner } from "@/lib/assistant/tools";
import type { AssistantRequest, AssistantResponse, ChatMessage } from "@/lib/assistant/types";

/** Most model calls for one question. The last one is forced to answer in words. */
const MAX_STEPS = 8;
const MAX_RESULT_CHARS = 12_000;

export class AssistantError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

/** What has happened so far in one question, reported as the tools run. */
export type AgentProgress = { messages: ChatMessage[]; actions: string[]; used: string[] };

export type AgentResult = {
  /** Everything to append to the conversation: tool turns and the final reply. */
  messages: ChatMessage[];
  reply: string;
  /** Plain-language list of changes the assistant made. */
  actions: string[];
  /** Names of the tools it looked things up with, in order, without repeats. */
  used: string[];
};

async function callServer(token: string, body: AssistantRequest, signal?: AbortSignal): Promise<AssistantResponse> {
  let response: Response;
  try {
    response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AssistantError("Couldn't reach the assistant. Check your connection and try again.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new AssistantError(data?.error ?? "The assistant is unavailable right now.", response.status);
  }
  return (await response.json()) as AssistantResponse;
}

/**
 * Runs one question to its answer: send the conversation, run any tool calls
 * the model asks for here in the browser, send the results back, and repeat
 * until it replies in words or the step cap is reached.
 */
export async function runAgent({
  history,
  conversationId,
  getToken,
  tools,
  onTool,
  onProgress,
  signal,
  userName,
}: {
  userName?: string;
  /** Called after each round of tools, so changes made are never lost if a later step fails. */
  onProgress?: (progress: AgentProgress) => void;
  history: ChatMessage[];
  conversationId: string;
  getToken: () => Promise<string>;
  tools: ToolRunner;
  onTool?: (name: string) => void;
  signal?: AbortSignal;
}): Promise<AgentResult> {
  const added: ChatMessage[] = [];
  const actions: string[] = [];
  const used: string[] = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const { message } = await callServer(
      await getToken(),
      {
        conversationId,
        messages: [...history, ...added],
        toolsEnabled: step < MAX_STEPS,
        today: todayIso(),
        timeZone: currentTimeZone(),
        ...(userName ? { userName } : {}),
      },
      signal,
    );
    added.push(message);

    if (!message.tool_calls?.length) {
      const reply = message.content?.trim();
      if (!reply) throw new AssistantError("The assistant didn't have an answer. Try rephrasing.");
      return { messages: added, reply, actions, used };
    }

    for (const call of message.tool_calls) {
      onTool?.(call.function.name);
      if (!used.includes(call.function.name)) used.push(call.function.name);
      let content: string;
      try {
        const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        const result = await tools.run(call.function.name, args && typeof args === "object" ? args : {});
        const action = describeAction(result);
        if (action) actions.push(action);
        content = JSON.stringify(result);
      } catch (error) {
        content = JSON.stringify({ error: error instanceof Error ? error.message : "The tool failed" });
      }
      if (content.length > MAX_RESULT_CHARS) {
        content = JSON.stringify({ error: "Result too large. Narrow it with filters such as dueFrom, dueTo or limit." });
      }
      added.push({ role: "tool", tool_call_id: call.id, content });
    }
    onProgress?.({ messages: [...added], actions: [...actions], used: [...used] });
  }

  throw new AssistantError("That took too many steps. Try a more specific question.");
}
