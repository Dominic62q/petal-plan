"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { Check, Flag, Trash2 } from "lucide-react";
import { springs } from "@/components/motion-primitives";
import { formatTime } from "@/lib/datetime";
import type { TaskPriority } from "@/lib/data";
import { cn } from "@/lib/utils";

export type TaskItemRow = {
  id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  eventId: string | null;
  eventTitle: string;
  group?: string;
  dueTime?: string;
};

/** Round checkbox that draws its tick when completed. */
export function TaskCheck({
  done,
  onToggle,
  label,
  size = "md",
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
  size?: "md" | "sm";
}) {
  const dimension = size === "md" ? "h-8 w-8" : "h-6 w-6";

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={() => {
        onToggle();
      }}
      whileTap={{ scale: 0.82 }}
      transition={springs.pop}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
        "outline-none focus-visible:ring-4 focus-visible:ring-ring/30",
        dimension,
        done ? "border-transparent bg-brand text-primary-foreground" : "border-primary/35 bg-card hover:border-primary",
      )}
    >
      <AnimatePresence>
        {done ? (
          <motion.svg
            key="tick"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={springs.pop}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.25, delay: 0.05 }}
            />
          </motion.svg>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}

/**
 * Swipe right to complete, left to delete — with the same actions always
 * available as buttons, so nothing depends on the gesture.
 */
function SwipeRow({
  children,
  done,
  onComplete,
  onDelete,
}: {
  children: ReactNode;
  done: boolean;
  onComplete: () => void;
  onDelete?: () => void;
}) {
  const x = useMotionValue(0);
  const completeOpacity = useTransform(x, [0, 40, 110], [0, 0.4, 1]);
  const deleteOpacity = useTransform(x, [0, -40, -110], [0, 0.4, 1]);

  return (
    <div className="relative overflow-hidden">
      <motion.div
        aria-hidden
        style={{ opacity: completeOpacity }}
        className="absolute inset-0 flex items-center gap-2 bg-brand pl-5 text-sm font-bold text-primary-foreground"
      >
        <Check className="h-5 w-5" />
        {done ? "Reopen" : "Done"}
      </motion.div>
      {onDelete ? (
        <motion.div
          aria-hidden
          style={{ opacity: deleteOpacity }}
          className="absolute inset-0 flex items-center justify-end gap-2 bg-destructive pr-5 text-sm font-bold text-white"
        >
          Delete
          <Trash2 className="h-5 w-5" />
        </motion.div>
      ) : null}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: onDelete ? 0.45 : 0, right: 0.45 }}
        dragSnapToOrigin
        style={{ x, touchAction: "pan-y" }}
        onDragEnd={(_event, info) => {
          if (info.offset.x > 96) onComplete();
          else if (info.offset.x < -96 && onDelete) onDelete();
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}

function PriorityTag({ priority }: { priority: TaskPriority }) {
  if (priority === "low") return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
        priority === "high" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {priority === "high" ? <Flag className="h-3 w-3" aria-hidden /> : null}
      {priority === "high" ? "High" : "Med"}
    </span>
  );
}

export function TaskItem({
  row,
  onToggle,
  onDelete,
  overdue = false,
  highlighted = false,
  domId,
}: {
  row: TaskItemRow;
  onToggle: () => void;
  onDelete?: () => void;
  overdue?: boolean;
  highlighted?: boolean;
  domId?: string;
}) {
  return (
    <motion.li
      id={domId}
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
      transition={springs.rise}
      className="list-none border-b border-border/70 last:border-b-0"
    >
      <SwipeRow done={row.done} onComplete={onToggle} onDelete={onDelete}>
        <div
          className={cn(
            "flex items-center gap-3.5 bg-card px-1 py-3.5 transition-colors duration-500",
            highlighted && "rounded-2xl bg-secondary px-3",
          )}
        >
          <TaskCheck
            done={row.done}
            onToggle={onToggle}
            label={row.done ? `Reopen ${row.title}` : `Complete ${row.title}`}
          />
          <div className={cn("min-w-0 flex-1 transition-opacity", row.done && "opacity-50")}>
            <p className={cn("truncate text-base leading-snug font-semibold", row.done && "line-through decoration-primary/60")}>
              {row.title}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className={cn("font-bold", row.eventId ? "text-primary" : "text-muted-foreground")}>
                {row.eventId ? row.eventTitle : "Personal"}
              </span>
              {row.group && row.group !== "Personal" ? <span>{row.group}</span> : null}
              {row.dueTime ? (
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground tabular-nums">
                  {formatTime(row.dueTime)}
                </span>
              ) : null}
              <PriorityTag priority={row.priority} />
              {overdue ? <span className="font-semibold text-destructive">Overdue</span> : null}
            </p>
          </div>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${row.title}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              <Trash2 className="h-[18px] w-[18px]" aria-hidden />
            </button>
          ) : null}
        </div>
      </SwipeRow>
    </motion.li>
  );
}
