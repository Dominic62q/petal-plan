"use client";

import { Check, Flag } from "lucide-react";
import type { TaskPriority } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Priority chip — never colour-only: the label text carries the meaning,
 * tint is reinforcement.
 */
export function PriorityChip({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    high: "border-destructive/30 bg-destructive/10 text-destructive",
    medium: "border-border bg-muted text-muted-foreground",
    low: "border-border bg-transparent text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        styles[priority],
      )}
    >
      {priority === "high" ? (
        <Flag className="h-3 w-3" aria-hidden />
      ) : null}
      {priority === "high" ? "High" : priority === "medium" ? "Med" : "Low"}
    </span>
  );
}

/** Round checkbox with instant optimistic check-off affordance. */
export function CheckCircle({
  done,
  onToggle,
  label,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Completed: ${label}` : `Mark complete: ${label}`}
      onClick={onToggle}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-outline bg-transparent hover:border-primary",
      )}
    >
      {done ? <Check className="h-4 w-4" aria-hidden /> : null}
    </button>
  );
}
