"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CalendarDays, CircleUserRound, LayoutDashboard, ListChecks, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Center action button (creation), not a navigation destination. */
  primary?: boolean;
};

const tabs: Tab[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/events/new", label: "New event", icon: Plus, primary: true },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/profile", label: "Account", icon: CircleUserRound },
];

export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "signed-in") return;
    for (const tab of tabs) router.prefetch(tab.href);
  }, [router, status]);

  // The navigation only makes sense for signed-in users; login renders without it.
  if (status !== "signed-in") return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:w-64 md:border-r md:border-t-0 md:bg-[#f1ece7]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="hidden border-b border-border/80 px-6 py-7 md:block">
        <Link href="/" aria-label="Petal & Plan home" className="inline-flex focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <BrandLogo size="sm" />
        </Link>
        <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Event studio</p>
      </div>

      <ul className="mx-auto grid max-w-lg grid-cols-5 md:flex md:flex-col md:gap-1 md:p-5">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href) && !tab.primary;
          const Icon = tab.icon;

          if (tab.primary) {
            return (
              <li key={tab.href} className="flex items-end justify-center md:block">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  className={cn(
                    "-mt-3 flex h-11 w-11 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground shadow-[0_5px_18px_-8px] shadow-primary/70 transition-colors hover:bg-primary/90 active:scale-95",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    "md:mt-0 md:h-12 md:w-full md:justify-start md:gap-3 md:rounded-[0.65rem] md:px-3 md:shadow-none",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                  <span className="hidden text-sm font-semibold md:inline">{tab.label}</span>
                  <span className="sr-only md:hidden">{tab.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href} className="md:w-full">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-[0.01em] transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  "md:min-h-12 md:flex-row md:justify-start md:gap-3 md:rounded-[0.65rem] md:px-3 md:text-sm",
                  active
                    ? "text-primary md:bg-secondary/80 md:text-foreground"
                    : "text-muted-foreground hover:text-foreground md:hover:bg-background/70",
                )}
              >
                <Icon className="h-[17px] w-[17px]" aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
