"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAuth } from "@/components/auth-provider";
import { PETAL_PATH, ROTATIONS } from "@/components/brand-logo";

/**
 * The sign-in arrival.
 *
 * A pink sheet rises over the login screen, the logo blooms, and then the
 * logo's own petal shape opens up like a window onto the app. It lives above
 * the router so it survives the navigation to "/": the overlay covers the page
 * swap, so neither screen is ever seen half-way through.
 */

type Phase = "idle" | "cover" | "dive";

type ArrivalContext = {
  /** Runs the whole arrival; resolves once the overlay has gone. */
  play: (options: { name?: string; navigate: () => void }) => Promise<void>;
};

const Context = createContext<ArrivalContext | null>(null);

export function useArrival(): ArrivalContext {
  const value = useContext(Context);
  if (!value) throw new Error("useArrival must be used inside <ArrivalProvider>");
  return value;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

// Timeline, in ms (motion-enabled). Reduced motion collapses all of it to a short fade.
const COVER_HOLD = 2_050; // wipe + bloom + greeting, before navigating
const SETTLE = 380; // after the new route mounts, let it paint before revealing
const DIVE = 900;
const NAVIGATION_TIMEOUT = 4_000;

export function ArrivalProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [fallbackName, setFallbackName] = useState("");
  const pathRef = useRef(pathname);
  const pathWaiter = useRef<(() => void) | null>(null);
  const running = useRef(false);

  useEffect(() => {
    pathRef.current = pathname;
    pathWaiter.current?.();
  }, [pathname]);

  const play = useCallback<ArrivalContext["play"]>(
    async ({ name, navigate }) => {
      if (running.current) return;
      running.current = true;
      setFallbackName(name ?? "");
      setPhase("cover");

      await wait(reduced ? 250 : COVER_HOLD);

      const from = pathRef.current;
      const arrived = new Promise<void>((resolve) => {
        pathWaiter.current = resolve;
        window.setTimeout(resolve, NAVIGATION_TIMEOUT);
      });
      navigate();
      if (pathRef.current === from) await arrived;
      pathWaiter.current = null;
      await wait(reduced ? 60 : SETTLE);

      setPhase("dive");
      await wait(reduced ? 200 : DIVE);
      setPhase("idle");
      running.current = false;
    },
    [reduced],
  );

  const value = useMemo(() => ({ play }), [play]);

  return (
    <Context.Provider value={value}>
      {children}
      <AnimatePresence>
        {phase !== "idle" ? <ArrivalOverlay key="arrival" phase={phase} fallbackName={fallbackName} reduced={Boolean(reduced)} /> : null}
      </AnimatePresence>
    </Context.Provider>
  );
}

function ArrivalOverlay({ phase, fallbackName, reduced }: { phase: Exclude<Phase, "idle">; fallbackName: string; reduced: boolean }) {
  const { user } = useAuth();
  // Only ever mounted after a click, so reading the window here is safe.
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const name = (fallbackName || user?.displayName || "").trim().split(" ")[0];
  const diving = phase === "dive";

  const { w, h } = size;
  const cx = w / 2;
  const cy = h * 0.42;
  const mark = Math.min(168, Math.max(116, Math.min(w, h) * 0.34));

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Opening Petal and Plan"
      className="fixed inset-0 z-[100] overflow-hidden"
      initial={reduced ? { opacity: 0 } : { clipPath: "inset(100% 0% 0% 0%)" }}
      animate={reduced ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.15 : 0.01, delay: reduced ? 0 : 0.05 } }}
      transition={reduced ? { duration: 0.15 } : { duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0" aria-hidden>
          <defs>
            {/* Opaque everywhere except the petal shape, which grows to open the view onto the app. */}
            <mask id="arrival-portal" maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
              <rect width={w} height={h} fill="white" />
              <svg x={cx - mark / 2} y={cy - mark / 2} width={mark} height={mark} viewBox="0 0 64 64" overflow="visible">
                <motion.g
                  style={{ transformOrigin: "32px 32px", transformBox: "view-box" }}
                  initial={{ scale: 0, rotate: 0 }}
                  animate={diving ? (reduced ? { scale: [1, 32] } : { scale: [1, 32], rotate: [0, 90] }) : { scale: 0, rotate: 0 }}
                  transition={diving ? { duration: reduced ? 0.01 : DIVE / 1000, ease: [0.6, 0, 0.85, 0.45] } : { duration: 0 }}
                >
                  <g fill="black">
                    {ROTATIONS.map((rotation) => (
                      <path key={rotation} d={PETAL_PATH} transform={`rotate(${rotation} 32 32)`} />
                    ))}
                    <circle cx="32" cy="32" r="6.5" />
                  </g>
                </motion.g>
              </svg>
            </mask>
          </defs>

          <rect width={w} height={h} mask="url(#arrival-portal)" style={{ fill: "var(--primary)" }} />

          {/* The mark itself: petals bloom one after another and settle with a quarter turn. */}
          <svg
            x={cx - mark / 2}
            y={cy - mark / 2}
            width={mark}
            height={mark}
            viewBox="0 0 64 64"
            overflow="visible"
            style={{ opacity: diving ? 0 : 1, transition: "opacity 120ms linear" }}
          >
            <motion.g
              style={{ transformOrigin: "32px 32px", transformBox: "view-box" }}
              initial={reduced ? false : { rotate: -90 }}
              animate={{ rotate: 0 }}
              transition={{ type: "spring", stiffness: 70, damping: 15, delay: 0.3 }}
            >
              <g fill="white">
                {ROTATIONS.map((rotation, index) => (
                  <g key={rotation} transform={`rotate(${rotation} 32 32)`}>
                    <motion.path
                      d={PETAL_PATH}
                      style={{ transformOrigin: "32px 32px", transformBox: "view-box" }}
                      initial={reduced ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 150, damping: 13, delay: 0.4 + index * 0.12 }}
                    />
                  </g>
                ))}
                <motion.circle
                  cx="32"
                  cy="32"
                  r="6.5"
                  initial={reduced ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{ transformOrigin: "32px 32px", transformBox: "view-box", fill: "var(--primary)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.95 }}
                />
              </g>
            </motion.g>

            {/* A ring that leaves the mark as it finishes blooming. */}
            {reduced ? null : (
              <motion.circle
                cx="32"
                cy="32"
                r="32"
                fill="none"
                stroke="white"
                strokeWidth={1}
                style={{ transformOrigin: "32px 32px", transformBox: "view-box" }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 2.4, opacity: [0, 0.55, 0] }}
                transition={{ duration: 1.1, delay: 0.95, ease: "easeOut" }}
              />
            )}
          </svg>
        </svg>

      <motion.div
        className="absolute inset-x-0 flex flex-col items-center px-6 text-center text-white"
        style={{ top: cy + mark / 2 + 28 }}
        animate={{ opacity: diving ? 0 : 1, y: diving ? -8 : 0 }}
        transition={{ duration: 0.18 }}
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: reduced ? 0 : 1.0 }}
          className="text-sm font-semibold tracking-wide text-white/80"
        >
          {name ? "Welcome back," : "Welcome"}
        </motion.p>
        {name ? (
          <div className="overflow-hidden pb-1">
            <motion.p
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24, delay: reduced ? 0 : 1.12 }}
              className="mt-0.5 font-heading text-4xl font-semibold tracking-[-0.045em]"
            >
              {name}
            </motion.p>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
