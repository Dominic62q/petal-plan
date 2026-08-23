import type { TaskPriority } from "@/lib/data";
import { labelForCategory } from "@/components/category-chip";

export { labelForCategory };

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Priority chip copy stays lowercase-soft except High, which is urgent. */
export function priorityLabel(priority: TaskPriority): string {
  if (priority === "high") return "High priority";
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;
}

export function statusLabel(status: "planning" | "confirmed"): string {
  return status === "confirmed" ? "Confirmed" : "Planning";
}
