"use client";

import { useReducedMotion } from "motion/react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const C = 120;

/** A slim petal pointing up, centred on its own origin. */
const LEAF = "M0 -11C5.5 -5.5 6.5 2.5 0 9C-6.5 2.5 -5.5 -5.5 0 -11Z";

type Orbit = {
  rx: number;
  ry: number;
  tilt: number;
  /** Seconds for one lap. */
  period: number;
  /** Petals on this orbit, spread evenly around it. */
  petals: number;
  scale: number;
  reverse?: boolean;
};

const ORBITS: Orbit[] = [
  { rx: 104, ry: 40, tilt: -24, period: 16, petals: 2, scale: 1.15 },
  { rx: 88, ry: 32, tilt: 38, period: 22, petals: 2, scale: 0.95, reverse: true },
  { rx: 56, ry: 56, tilt: 0, period: 12, petals: 1, scale: 0.8 },
];

const ellipse = (rx: number, ry: number, reverse?: boolean) =>
  `M ${C - rx} ${C} a ${rx} ${ry} 0 1 ${reverse ? 1 : 0} ${2 * rx} 0 a ${rx} ${ry} 0 1 ${reverse ? 1 : 0} ${-2 * rx} 0`;

/**
 * The mark with petals circling it on tilted orbits. Plain SVG animation, so
 * it costs nothing to run; with reduced motion it holds still.
 */
export function OrbitMark({ className }: { className?: string }) {
  const still = useReducedMotion();

  return (
    <div className={cn("relative aspect-square", className)} aria-hidden>
      <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full overflow-visible" fill="none">
        <circle cx={C} cy={C} r="46" fill="var(--secondary)" opacity="0.8" />
        {!still ? (
          <circle cx={C} cy={C} r="34" stroke="var(--primary)" strokeWidth="1.5" opacity="0">
            <animate attributeName="r" values="34;70" dur="3.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.35;0" dur="3.6s" repeatCount="indefinite" />
          </circle>
        ) : null}

        {ORBITS.map((orbit, index) => {
          const path = ellipse(orbit.rx, orbit.ry, orbit.reverse);
          return (
            <g key={index} transform={`rotate(${orbit.tilt} ${C} ${C})`}>
              <path d={path} stroke="var(--primary)" strokeWidth="1" opacity="0.2" />
              {Array.from({ length: orbit.petals }, (_, petal) => {
                const offset = -(orbit.period * petal) / orbit.petals - index * 2.5;
                return (
                  <g key={petal}>
                    {!still ? (
                      <animateMotion dur={`${orbit.period}s`} begin={`${offset}s`} repeatCount="indefinite" rotate="auto" path={path} />
                    ) : null}
                    <path
                      d={LEAF}
                      fill="var(--primary)"
                      opacity={0.55 + orbit.scale * 0.35}
                      transform={`${still ? `translate(${C - orbit.rx + petal * 2 * orbit.rx} ${C}) ` : ""}rotate(90) scale(${orbit.scale})`}
                    />
                  </g>
                );
              })}
              <circle r="2.4" cx={still ? C : 0} cy={still ? C - orbit.ry : 0} fill="var(--primary)" opacity="0.45">
                {!still ? (
                  <animateMotion dur={`${orbit.period * 1.4}s`} begin={`${-index * 4}s`} repeatCount="indefinite" path={path} />
                ) : null}
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <BrandLogo variant="mark" size="lg" decorative animated className="h-[4.25rem] w-[4.25rem]" />
      </div>
    </div>
  );
}
