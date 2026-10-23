export default function Loading() {
  return (
    <div className="min-h-dvh bg-brand" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto max-w-3xl space-y-4 px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-16">
        <div className="h-4 w-36 rounded-full bg-white/30" />
        <div className="h-10 w-32 rounded-2xl bg-white/30" />
        <div className="h-20 rounded-3xl bg-white/20" />
      </div>
      <div className="-mt-8 min-h-[60dvh] space-y-3 rounded-t-3xl bg-card px-5 pt-8">
        {[0, 1, 2].map((row) => (
          <div key={row} className="skeleton h-14 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
