"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  CalendarDays,
  Check,
  CircleAlert,
  Copy,
  History,
  Info,
  ListOrdered,
  SquarePen,
  Square,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { OrbitMark } from "@/components/orbit-mark";
import { RequireAuth } from "@/components/require-auth";
import { springs } from "@/components/motion-primitives";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AssistantError, runAgent, type AgentProgress } from "@/lib/assistant/agent";
import {
  deleteChat,
  historyFromTurns,
  listChats,
  saveChat,
  titleFromTurns,
  type SavedChat,
  type StoredTurn,
} from "@/lib/assistant/chats";
import { TOOL_LABELS, createToolRunner } from "@/lib/assistant/tools";
import type { ChatMessage } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; actions: string[]; used: string[]; fresh?: boolean }
  | { id: string; role: "error"; text: string; retry?: string };

const SUGGESTIONS = [
  { text: "What's due today?", icon: CalendarCheck },
  { text: "What should I do first?", icon: ListOrdered },
  { text: "Is anything overdue?", icon: CircleAlert },
  { text: "How is my next event going?", icon: CalendarDays },
] as const;

const USED_NOUNS: Record<string, string> = {
  get_overview: "your plan",
  get_profile: "your profile",
  get_event: "an event",
  list_events: "events",
  list_tasks: "tasks",
  list_schedule: "a schedule",
};

const newId = () => crypto.randomUUID();

const toStored = (turns: Turn[]): StoredTurn[] =>
  turns.flatMap((turn): StoredTurn[] =>
    turn.role === "user"
      ? [{ role: "user", text: turn.text }]
      : turn.role === "assistant"
        ? [{ role: "assistant", text: turn.text, actions: turn.actions, used: turn.used }]
        : [],
  );

const fromStored = (turns: StoredTurn[]): Turn[] =>
  turns.map((turn) =>
    turn.role === "user"
      ? { id: newId(), role: "user", text: turn.text }
      : { id: newId(), role: "assistant", text: turn.text, actions: turn.actions ?? [], used: turn.used ?? [] },
  );

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** A small subset of Markdown: paragraphs, bullet and numbered lists, **bold**. */
function RichText({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );

  return (
    <div className="space-y-3">
      {text
        .trim()
        .split(/\n{2,}/)
        .map((block, index) => {
          const lines = block.split("\n").filter(Boolean);
          const bullets = lines.length > 0 && lines.every((line) => /^\s*[-*•]\s+/.test(line));
          const numbered = lines.length > 0 && lines.every((line) => /^\s*\d+[.)]\s+/.test(line));
          if (bullets || numbered) {
            const Tag = numbered ? "ol" : "ul";
            return (
              <Tag
                key={index}
                className={cn("space-y-1.5 pl-5 marker:text-primary", numbered ? "list-decimal marker:font-semibold" : "list-disc")}
              >
                {lines.map((line, lineIndex) => (
                  <li key={lineIndex} className="pl-1">
                    {inline(line.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}
                  </li>
                ))}
              </Tag>
            );
          }
          return (
            <p key={index}>
              {lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  {inline(line)}
                </Fragment>
              ))}
            </p>
          );
        })}
    </div>
  );
}

/** Reveals a fresh reply quickly instead of dropping it in all at once. */
function useReveal(text: string, enabled: boolean, onTick: () => void) {
  const reduced = useReducedMotion();
  const animate = enabled && !reduced;
  const [count, setCount] = useState(animate ? 0 : text.length);
  const tick = useRef(onTick);
  useEffect(() => {
    tick.current = onTick;
  });

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    let shown = 0;
    // About a second and a half at most, however long the reply is.
    const step = Math.max(2, Math.ceil(text.length / 90));
    const run = () => {
      shown = Math.min(text.length, shown + step);
      setCount(shown);
      tick.current();
      if (shown < text.length) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [animate, text]);

  return animate ? text.slice(0, count) : text;
}

// ---------------------------------------------------------------------------
// Conversation pieces
// ---------------------------------------------------------------------------

function Avatar() {
  return <BrandLogo variant="mark" size="sm" decorative className="h-7 w-7" />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1_600);
        });
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function AssistantTurn({ turn, onTick }: { turn: Extract<Turn, { role: "assistant" }>; onTick: () => void }) {
  const text = useReveal(turn.text, Boolean(turn.fresh), onTick);
  const done = text.length === turn.text.length;
  const looked = turn.used.map((name) => USED_NOUNS[name]).filter(Boolean);

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0">
        <Avatar />
      </div>
      <div className="min-w-0 flex-1 text-[15px] leading-[1.65] break-words text-foreground/90">
        <RichText text={text} />
        {done && turn.actions.length > 0 ? (
          <motion.ul initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={springs.rise} className="mt-3.5 space-y-1.5">
            {turn.actions.map((action, index) => (
              <li key={index} className="flex items-center gap-2.5 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">
                <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} aria-hidden />
                {action}
              </li>
            ))}
          </motion.ul>
        ) : null}
        {done ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <CopyButton text={turn.text} />
            {looked.length > 0 ? (
              <span className="text-xs text-muted-foreground">Looked at {looked.join(", ")}</span>
            ) : null}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <Avatar />
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-1.5 w-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.16 }}
            />
          ))}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {label}…
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

function dayLabel(timestamp: number): string {
  const day = new Date(timestamp);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return "Earlier";
}

/** "Today, 14:02" / "Yesterday, 09:30" / "12 Mar" for a saved chat. */
function chatWhen(timestamp: number): string {
  const label = dayLabel(timestamp);
  const date = new Date(timestamp);
  if (label === "Today" || label === "Yesterday") {
    return `${label}, ${date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function HistorySheet({
  open,
  onOpenChange,
  activeId,
  onOpenChat,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string;
  onOpenChat: (chat: SavedChat) => void;
  onDeleted: (id: string) => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid;
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);

  const chats = useQuery({
    queryKey: ["assistant-chats", uid],
    enabled: Boolean(uid) && open,
    queryFn: () => listChats(uid!),
    staleTime: 0,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteChat(uid!, id),
    onSuccess: (_result, id) => {
      setConfirming(null);
      onDeleted(id);
      void queryClient.invalidateQueries({ queryKey: ["assistant-chats", uid] });
    },
  });

  const groups = useMemo(() => {
    const out: Array<{ label: string; chats: SavedChat[] }> = [];
    for (const chat of chats.data ?? []) {
      const label = dayLabel(chat.updatedAt);
      const group = out.find((entry) => entry.label === label);
      if (group) group.chats.push(chat);
      else out.push({ label, chats: [chat] });
    }
    return out;
  }, [chats.data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto h-[min(82dvh,42rem)] max-w-xl gap-0 p-0">
        <SheetHeader className="px-5 pt-1 pb-4">
          <SheetTitle>Chat history</SheetTitle>
          <SheetDescription>Your saved conversations. Only you can see them.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
          {chats.isPending ? (
            <div className="space-y-2 px-2 pt-2" aria-label="Loading chats">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : chats.isError ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">Couldn&apos;t load your chats.</p>
              <button
                type="button"
                onClick={() => void chats.refetch()}
                className="mt-3 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                Try again
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
                <History className="h-7 w-7" aria-hidden />
              </div>
              <p className="mt-4 font-heading text-lg font-semibold tracking-tight">No saved chats yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                Conversations are saved automatically once you get an answer.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label} aria-label={group.label} className="mt-2">
                <h3 className="px-3 pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</h3>
                <ul className="space-y-1">
                  {group.chats.map((chat) => {
                    const active = chat.id === activeId;
                    const asking = confirming === chat.id;
                    const count = chat.turns.filter((turn) => turn.role === "user").length;
                    return (
                      <li key={chat.id} className={cn("flex items-center gap-1 rounded-2xl pr-1.5 transition-colors", active ? "bg-secondary" : "hover:bg-muted")}>
                        <button
                          type="button"
                          onClick={() => onOpenChat(chat)}
                          className="min-w-0 flex-1 rounded-2xl px-3 py-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                        >
                          <span className="block truncate text-[15px] font-semibold">{chat.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {count} {count === 1 ? "question" : "questions"} ·{" "}
                            {new Date(chat.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </button>
                        {asking ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => remove.mutate(chat.id)}
                              disabled={remove.isPending}
                              className="h-9 rounded-lg bg-destructive px-3 text-xs font-semibold text-white outline-none focus-visible:ring-4 focus-visible:ring-destructive/30 disabled:opacity-60"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirming(null)}
                              className="h-9 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground outline-none hover:bg-card focus-visible:ring-4 focus-visible:ring-ring/30"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Delete chat: ${chat.title}`}
                            onClick={() => setConfirming(chat.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-destructive focus-visible:ring-4 focus-visible:ring-ring/30"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
          {remove.isError ? (
            <p role="alert" className="px-4 pt-3 text-sm text-destructive">
              Couldn&apos;t delete that chat. Try again.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const iconButton =
  "flex h-11 items-center justify-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-white/25 active:scale-95 focus-visible:ring-4 focus-visible:ring-white/40";

function AssistantScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Thinking");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [chatId, setChatId] = useState(newId);
  const [atBottom, setAtBottom] = useState(true);

  const history = useRef<ChatMessage[]>([]);
  const createdAt = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(true);

  const uid = user?.uid;
  const firstName = (user?.displayName || "").split(" ")[0];
  const [pending, setPending] = useState<string | null>(null);
  const resolveConfirm = useRef<((approved: boolean) => void) | null>(null);

  const answerConfirm = useCallback((approved: boolean) => {
    resolveConfirm.current?.(approved);
    resolveConfirm.current = null;
    setPending(null);
  }, []);

  // Shown when the assistant wants to delete something; it waits for the answer.
  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        resolveConfirm.current?.(false);
        resolveConfirm.current = resolve;
        setPending(message);
      }),
    [],
  );

  const title = titleFromTurns(toStored(turns));

  // Loaded up front so the empty screen can offer earlier chats right away.
  const recent = useQuery({
    queryKey: ["assistant-chats", uid],
    enabled: Boolean(uid),
    queryFn: () => listChats(uid!),
    staleTime: 30_000,
  });

  useEffect(
    () => () => {
      abort.current?.abort();
      resolveConfirm.current?.(false);
    },
    [],
  );

  const scrollToBottom = useCallback((smooth = true) => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Follow new content only while the reader is already at the bottom.
  const follow = useCallback(() => {
    if (pinned.current) scrollToBottom(false);
  }, [scrollToBottom]);

  useEffect(() => {
    if (pinned.current) scrollToBottom();
  }, [turns, busy, status, pending, scrollToBottom]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    pinned.current = near;
    setAtBottom(near);
  };

  const persist = useCallback(
    async (next: Turn[], id: string) => {
      if (!uid) return;
      try {
        if (!createdAt.current) createdAt.current = Date.now();
        await saveChat(uid, { id, createdAt: createdAt.current, turns: toStored(next) });
        setSaveFailed(false);
        void queryClient.invalidateQueries({ queryKey: ["assistant-chats", uid] });
      } catch {
        setSaveFailed(true);
      }
    },
    [uid, queryClient],
  );

  const ask = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy || !user) return;
      const tools = createToolRunner({ uid: user.uid, queryClient, confirm });
      pinned.current = true;
      setBusy(true);
      setStatus("Thinking");
      setDraft("");
      if (field.current) field.current.style.height = "auto";
      const before = turns.filter((turn) => turn.role !== "error").map((turn) => (turn.role === "assistant" ? { ...turn, fresh: false } : turn));
      const withQuestion: Turn[] = [...before, { id: newId(), role: "user", text }];
      setTurns(withQuestion);

      const controller = new AbortController();
      abort.current = controller;
      let progress: AgentProgress | null = null;
      try {
        const result = await runAgent({
          history: [...history.current, { role: "user", content: text }],
          conversationId: chatId,
          getToken: () => user.getIdToken(),
          tools,
          userName: firstName,
          onTool: (name) => setStatus(TOOL_LABELS[name] ?? "Working"),
          onProgress: (update) => {
            progress = update;
          },
          signal: controller.signal,
        });
        history.current = [...history.current, { role: "user", content: text }, ...result.messages];
        const next: Turn[] = [
          ...withQuestion,
          { id: newId(), role: "assistant", text: result.reply, actions: result.actions, used: result.used, fresh: true },
        ];
        setTurns(next);
        void persist(next, chatId);
      } catch (error) {
        const stopped = error instanceof DOMException && error.name === "AbortError";

        // Changes already made stay on the record even though the reply never arrived,
        // so the assistant (and the saved chat) still know about them.
        const done = progress as AgentProgress | null;
        let recovered: Turn[] = [];
        if (done && done.actions.length > 0) {
          const note = stopped
            ? "You stopped me, but these changes had already been made."
            : "I made these changes, but something went wrong before I could reply.";
          history.current = [
            ...history.current,
            { role: "user", content: text },
            ...done.messages,
            { role: "assistant", content: `${note} [Changes made in this step: ${done.actions.join("; ")}]` },
          ];
          recovered = [{ id: newId(), role: "assistant", text: note, actions: done.actions, used: done.used }];
          const saved: Turn[] = [...withQuestion, ...recovered];
          setTurns(saved);
          void persist(saved, chatId);
        }
        if (stopped) return;

        const message = error instanceof AssistantError ? error.message : "Something went wrong. Try again.";
        // Sign-in and limit errors won't improve on a retry, and retrying after changes
        // were made would repeat them.
        const retryable = recovered.length === 0 && (!(error instanceof AssistantError) || ![401, 429, 503].includes(error.status));
        setTurns((current) => [...current, { id: newId(), role: "error", text: message, retry: retryable ? text : undefined }]);
      } finally {
        if (abort.current === controller) {
          setBusy(false);
          abort.current = null;
        }
        field.current?.focus();
      }
    },
    [busy, user, queryClient, confirm, turns, chatId, persist, firstName],
  );

  const stop = () => {
    answerConfirm(false);
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setTurns((current) => [...current, { id: newId(), role: "error", text: "Stopped." }]);
  };

  const startNew = useCallback(() => {
    answerConfirm(false);
    abort.current?.abort();
    abort.current = null;
    history.current = [];
    createdAt.current = 0;
    pinned.current = true;
    setChatId(newId());
    setTurns([]);
    setBusy(false);
    setDraft("");
    setSaveFailed(false);
    setHistoryOpen(false);
  }, [answerConfirm]);

  const openChat = (chat: SavedChat) => {
    answerConfirm(false);
    abort.current?.abort();
    abort.current = null;
    history.current = historyFromTurns(chat.turns);
    createdAt.current = chat.createdAt || Date.now();
    pinned.current = true;
    setChatId(chat.id);
    setTurns(fromStored(chat.turns));
    setBusy(false);
    setSaveFailed(false);
    setHistoryOpen(false);
    window.setTimeout(() => scrollToBottom(false), 60);
  };

  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 136)}px`;
  };

  const empty = turns.length === 0 && !busy;
  const savedCount = recent.data?.length ?? 0;
  const latest = recent.data?.[0];
  const alsoRecent = recent.data?.slice(1, 3) ?? [];
  const canSend = draft.trim().length > 0 && !busy;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-brand">
      <header className="shrink-0 px-4 pb-9 text-primary-foreground md:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 pt-2">
          <Link href="/" aria-label="Back to Today" className={cn(iconButton, "w-11 px-0")}>
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[1.65rem] leading-tight font-bold tracking-tight">Assistant</h1>
            <p className="truncate text-sm text-white/80">
              {saveFailed ? "Couldn’t save this chat" : turns.length > 0 ? title : "Ask about your events and tasks"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label={savedCount > 0 ? `Chat history, ${savedCount} saved` : "Chat history"}
            className={cn(iconButton, "relative px-3 sm:px-3.5")}
          >
            <History className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">History</span>
            {savedCount > 0 ? (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] leading-none font-bold text-primary"
              >
                {savedCount >= 40 ? "40+" : savedCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={startNew}
            disabled={turns.length === 0 && !busy}
            aria-label="New chat"
            className={cn(iconButton, "px-3 disabled:pointer-events-none disabled:opacity-50 sm:px-3.5")}
          >
            <SquarePen className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </header>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springs.surface}
        className="relative -mt-5 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-card"
      >
        <div ref={scroller} onScroll={onScroll} role="log" aria-label="Conversation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end gap-6 px-4 pt-7 pb-5 md:px-8">
            {empty ? (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={springs.surface} className="text-center">
                <OrbitMark className={cn("mx-auto", latest ? "w-32" : "w-44 sm:w-52")} />
                <h2 className="mt-2 font-heading text-[1.75rem] leading-tight font-bold tracking-tight">
                  {firstName ? `${latest ? "Welcome back" : "Hi"} ${firstName}, what do you need?` : "What do you need?"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-[15px] leading-6 text-muted-foreground">
                  I can look through your events, schedules and tasks, and add or tick off tasks when you ask.
                </p>

                {latest ? (
                  <section aria-label="Your recent chats" className="mt-6 text-left">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pick up where you left off</h3>
                      <button
                        type="button"
                        onClick={() => setHistoryOpen(true)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-primary outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/30"
                      >
                        All chats{savedCount > 3 ? ` (${savedCount})` : ""}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => openChat(latest)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-brand px-4 py-3.5 text-left text-primary-foreground outline-none transition-transform focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-[0.99]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{latest.title}</span>
                        <span className="mt-0.5 block text-xs text-white/80">
                          {chatWhen(latest.updatedAt)} · {latest.turns.filter((turn) => turn.role === "user").length} questions
                        </span>
                      </span>
                      <span className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-white/15 px-3 text-sm font-semibold">
                        Continue
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    </button>
                    {alsoRecent.length > 0 ? (
                      <ul className="mt-1.5 space-y-1">
                        {alsoRecent.map((chat) => (
                          <li key={chat.id}>
                            <button
                              type="button"
                              onClick={() => openChat(chat)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/30"
                            >
                              <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{chat.title}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{chatWhen(chat.updatedAt)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ) : null}

                {latest ? <h3 className="mt-6 px-1 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">Or start something new</h3> : null}
                <ul className={cn("grid gap-2 text-left sm:grid-cols-2", latest ? "mt-2" : "mt-6")}>
                  {SUGGESTIONS.map(({ text, icon: Icon }, index) => (
                    <motion.li
                      key={text}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...springs.rise, delay: 0.1 + index * 0.06 }}
                    >
                      <button
                        type="button"
                        onClick={() => void ask(text)}
                        className="group flex w-full items-center gap-3 rounded-2xl bg-secondary/70 px-3.5 py-3.5 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/30 active:scale-[0.99]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className="text-[15px] font-semibold">{text}</span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
                <p className="mx-auto mt-6 flex max-w-md gap-2 text-left text-xs leading-5 text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Your question and the details needed to answer it are sent to an AI model. Chats are saved to your account.
                </p>
              </motion.div>
            ) : null}

            <AnimatePresence initial={false}>
              {turns.map((turn) => (
                <motion.div
                  key={turn.id}
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.rise}
                >
                  {turn.role === "user" ? (
                    <div className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-6 break-words whitespace-pre-wrap text-primary-foreground">
                        {turn.text}
                      </p>
                    </div>
                  ) : turn.role === "assistant" ? (
                    <AssistantTurn turn={turn} onTick={follow} />
                  ) : (
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <CircleAlert className="h-4 w-4" aria-hidden />
                      </div>
                      <div role="alert" className="min-w-0 flex-1 text-sm">
                        <p className="pt-1 font-medium text-destructive">{turn.text}</p>
                        {turn.retry ? (
                          <button
                            type="button"
                            onClick={() => void ask(turn.retry!)}
                            className="mt-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/30"
                          >
                            Try again
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              {busy && pending ? (
                <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </div>
                  <div role="alertdialog" aria-label="Confirm delete" aria-describedby="confirm-message" className="min-w-0 flex-1 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
                    <p id="confirm-message" className="text-[15px] leading-6 font-semibold break-words">
                      {pending}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => answerConfirm(true)}
                        className="h-10 rounded-xl bg-destructive px-4 text-sm font-semibold text-white outline-none focus-visible:ring-4 focus-visible:ring-destructive/30 active:scale-95"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        autoFocus
                        onClick={() => answerConfirm(false)}
                        className="h-10 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/30 active:scale-95"
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : busy ? (
                <motion.div key="thinking" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Thinking label={status} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className="relative shrink-0 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
          <AnimatePresence>
            {!atBottom && turns.length > 0 ? (
              <motion.button
                type="button"
                onClick={() => {
                  pinned.current = true;
                  scrollToBottom();
                }}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={springs.tap}
                className="absolute -top-12 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background shadow-float outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                Latest
              </motion.button>
            ) : null}
          </AnimatePresence>

          <form
            className="mx-auto max-w-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 transition-shadow focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15">
              <label htmlFor="assistant-input" className="sr-only">
                Message the assistant
              </label>
              <textarea
                id="assistant-input"
                ref={field}
                rows={1}
                value={draft}
                maxLength={2000}
                placeholder="Ask about your plans…"
                onChange={(event) => {
                  setDraft(event.target.value);
                  resize(event.target);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (!busy) void ask(draft);
                  }
                }}
                className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-6 outline-none placeholder:text-muted-foreground/70"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Stop"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background outline-none transition-transform focus-visible:ring-4 focus-visible:ring-ring/30 active:scale-95"
                >
                  <Square className="h-4 w-4 fill-current" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={!canSend}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-primary-foreground outline-none transition-[opacity,transform] focus-visible:ring-4 focus-visible:ring-ring/30 active:scale-95 disabled:opacity-35"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.6} aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-2 hidden text-center text-xs text-muted-foreground [@media(hover:hover)]:block">
              Enter to send · Shift + Enter for a new line
            </p>
          </form>
        </div>
      </motion.div>

      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        activeId={chatId}
        onOpenChat={openChat}
        onDeleted={(id) => {
          if (id === chatId) startNew();
        }}
      />
    </div>
  );
}

export default function AssistantPage() {
  return (
    <RequireAuth>
      <AssistantScreen />
    </RequireAuth>
  );
}
