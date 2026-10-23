import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary shadow-soft">
        <WifiOff className="h-9 w-9 text-primary" aria-hidden />
      </div>
      <h1 className="mt-6 font-heading text-2xl font-semibold tracking-tight text-foreground">
        You&apos;re offline
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        This page isn&apos;t saved on your device yet. Reconnect and try again &mdash; anything you already opened stays available.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-bold text-primary-foreground transition-transform outline-none active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/30"
      >
        Back to Today
      </Link>
    </div>
  );
}
