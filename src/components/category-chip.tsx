"use client";

import { useState } from "react";
import {
  Heart,
  Briefcase,
  Cake,
  Wine,
  Plus,
  Tag,
  Baby,
  GraduationCap,
  PartyPopper,
  Utensils,
  Music,
  Sparkles,
} from "lucide-react";
import type { EventCategory } from "@/lib/data";
import { slugifyCategory } from "@/lib/data";
import { cn } from "@/lib/utils";

// Built-in icons; custom categories get an auto-assigned icon from the pool
// based on name hash so they feel designed, not generic.
const BUILT_IN_ICONS: Record<string, typeof Heart> = {
  wedding: Heart,
  corporate: Briefcase,
  birthday: Cake,
  gala: Wine,
};

const CUSTOM_ICON_POOL = [Tag, Sparkles, PartyPopper, GraduationCap, Baby, Utensils, Music];

export function iconForCategory(category: EventCategory): typeof Heart {
  if (BUILT_IN_ICONS[category]) return BUILT_IN_ICONS[category];
  const hash = [...category].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CUSTOM_ICON_POOL[hash % CUSTOM_ICON_POOL.length];
}

export function labelForCategory(category: EventCategory): string {
  const labels: Record<string, string> = {
    wedding: "Wedding",
    corporate: "Corporate",
    birthday: "Birthday",
    gala: "Gala",
  };
  return (
    labels[category] ??
    category
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

export function CategoryBadge({
  category,
  className,
}: {
  category: EventCategory;
  className?: string;
}) {
  const Icon = iconForCategory(category);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground",
        className,
      )}
    >
        {/* iconForCategory returns stable module-level lucide components,
            not components created during render — safe to skip the rule. */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Icon className="h-3 w-3" aria-hidden />
        {labelForCategory(category)}
    </span>
  );
}

/**
 * Selectable tile grid + inline "create your own" flow.
 * `categories` = full list (built-ins + user's custom ones).
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate,
}: {
  categories: EventCategory[];
  value: EventCategory | null;
  onChange: (value: EventCategory) => void;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submitNew = async () => {
    const slug = slugifyCategory(draft);
    if (!slug) {
      setError("Give the category a name.");
      return;
    }
    if (!onCreate) {
      // No persistence passed — still allow selection for the current event.
      onChange(slug);
      setCreating(false);
      setDraft("");
      return;
    }
    setSaving(true);
    try {
      await onCreate(draft);
      onChange(slug);
      setCreating(false);
      setDraft("");
      setError("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => {
          const Icon = iconForCategory(category);
          const selected = value === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(category)}
              className={cn(
                "flex min-h-12 items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "border-primary/60 bg-primary/[0.05] text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-outline",
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")}
                aria-hidden
              />
              <span className="truncate text-sm font-semibold">{labelForCategory(category)}</span>
            </button>
          );
        })}

        {/* Add-category tile */}
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(
              "flex min-h-12 items-center gap-2.5 rounded-md border border-dashed border-outline/70 px-3 py-2 text-left text-muted-foreground transition-colors hover:border-primary hover:text-primary",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-sm font-semibold">New category</span>
          </button>
        ) : (
          <div className="flex min-h-12 flex-col justify-center gap-2 rounded-md border border-primary/50 bg-card px-3 py-2">
            <input
              autoFocus
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter") {
                  keyEvent.preventDefault();
                  void submitNew();
                }
                if (keyEvent.key === "Escape") {
                  setCreating(false);
                  setDraft("");
                  setError("");
                }
              }}
              placeholder="e.g. House warming"
              className="w-full border-b border-border bg-transparent pb-1 text-sm font-medium outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void submitNew()}
                disabled={saving}
                className="min-h-7 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setDraft("");
                  setError("");
                }}
                className="min-h-7 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
