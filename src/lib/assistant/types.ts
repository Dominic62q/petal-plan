export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** OpenAI-compatible chat messages, as exchanged with the model. */
export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type AssistantRequest = {
  conversationId: string;
  messages: ChatMessage[];
  /** False on the last allowed step, so the model has to answer in words. */
  toolsEnabled: boolean;
  /** The user's local calendar date (YYYY-MM-DD) and IANA zone, for relative dates. */
  today: string;
  timeZone: string;
  /** First name from the user's account, so the assistant can greet them. */
  userName?: string;
};

export type AssistantResponse = {
  message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] };
};
