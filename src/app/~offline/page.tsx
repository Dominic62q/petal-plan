import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <WifiOff className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <h1 className="mt-5 font-heading text-xl font-bold text-foreground">
        You&apos;re offline
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        This page isn&apos;t saved on your device yet. Reconnect and try again
        &mdash; anything you already opened stays available.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Back to Today
      </Link>
    </div>
  );
}
