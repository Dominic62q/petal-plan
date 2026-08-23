export default function Loading() {
  return (
    <div
      className="mx-auto max-w-lg space-y-5 px-5"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
