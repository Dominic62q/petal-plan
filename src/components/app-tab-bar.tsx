"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "motion/react";
import { CalendarDays, CircleUserRound, ListChecks, Plus, Sun } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { springs } from "@/components/motion-primitives";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: typeof Sun;
  /** Raised centre button (creation), not a navigation destination. */
  primary?: boolean;
};

const tabs: Tab[] = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/events/new", label: "New event", icon: Plus, primary: true },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/profile", label: "Account", icon: CircleUserRound },
];

// Full-screen flows own the whole viewport; the nav would only get in the way.
const HIDDEN_ON = ["/events/new", "/login", "/assistant"];

export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status !== "signed-in") return;
    for (const tab of tabs) router.prefetch(tab.href);
  }, [router, status]);

  // The navigation only makes sense for signed-in users; login renders without it.
  if (status !== "signed-in" || HIDDEN_ON.includes(pathname)) return null;

  const initial = (user?.displayName || user?.email || "P").charAt(0).toUpperCase();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        // Phone: a bar docked to the bottom edge. Desktop: a pink sidebar.
        "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] border-t border-border/60",
        "md:inset-y-0 md:right-auto md:w-72 md:rounded-none md:bg-brand md:px-5 md:py-7 md:pb-7 md:text-primary-foreground md:shadow-none",
      )}
    >
      <div className="hidden md:block">
        <Link
          href="/"
          aria-label="Petal & Plan home"
          className="inline-flex rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-white/40"
        >
          <BrandLogo size="sm" inverted />
        </Link>
      </div>

      <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-2 pb-1.5 md:mt-9 md:flex md:max-w-none md:flex-col md:items-stretch md:gap-1.5 md:p-0">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href) && !tab.primary;
          const Icon = tab.icon;

          if (tab.primary) {
            return (
              <li key={tab.href} className="flex items-center justify-center md:order-last md:mt-4 md:block">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  className={cn(
                    "group -mt-6 mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-primary-foreground ring-4 ring-card transition-transform active:scale-90",
                    "outline-none focus-visible:ring-ring/40",
                    "md:mt-0 md:mb-0 md:h-12 md:w-full md:gap-2 md:bg-white md:bg-none md:text-primary md:shadow-none md:ring-0",
                  )}
                >
                  <Icon className="h-6 w-6 md:h-5 md:w-5" strokeWidth={2.6} aria-hidden />
                  <span className="hidden text-sm font-semibold md:inline">{tab.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition-colors",
                  "outline-none focus-visible:ring-4 focus-visible:ring-ring/30 md:focus-visible:ring-white/40",
                  "md:min-h-12 md:flex-row md:justify-start md:gap-3 md:px-4 md:text-sm",
                  active ? "text-primary md:text-white" : "text-muted-foreground hover:text-foreground md:text-white/75 md:hover:text-white",
                )}
              >
                {active ? (
                  <>
                    <motion.span
                      layoutId="nav-bar-marker"
                      className="absolute -top-2 h-1 w-8 rounded-full bg-brand md:hidden"
                      transition={springs.rise}
                      aria-hidden
                    />
                    <motion.span
                      layoutId="nav-side-pill"
                      className="absolute inset-0 hidden rounded-2xl bg-white/20 md:block"
                      transition={springs.rise}
                      aria-hidden
                    />
                  </>
                ) : null}
                <Icon className="relative h-6 w-6 md:h-5 md:w-5" strokeWidth={active ? 2.6 : 2.1} aria-hidden />
                <span className="relative">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="absolute inset-x-5 bottom-7 hidden items-center gap-3 rounded-2xl bg-white/15 p-3 md:flex">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-heading font-bold text-primary">
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user?.displayName || "Planner"}</span>
          <span className="block truncate text-xs text-white/75">{user?.email}</span>
        </span>
      </div>
    </nav>
  );
}
