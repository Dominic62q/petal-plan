import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg";
  inverted?: boolean;
  decorative?: boolean;
  className?: string;
};

const markSizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
} as const;

function BrandMark({ inverted, decorative, size, className }: Omit<BrandLogoProps, "variant">) {
  const surface = inverted ? "var(--background)" : "var(--primary)";
  const petal = inverted ? "var(--foreground)" : "var(--primary-foreground)";
  const center = inverted ? "var(--primary)" : "#efb35f";

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn(markSizes[size ?? "md"], "shrink-0", className)}
      fill="none"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : "Petal & Plan"}
    >
      <rect x="1" y="1" width="62" height="62" rx="18" fill={surface} />
      <g fill={petal}>
        <path d="M32 8.5c-7.3 1.2-12 5.9-12 12.2 0 6.2 4.8 10.6 12 11.3 7.2 -0.7 12 -5.1 12 -11.3 0 -6.3 -4.7 -11 -12 -12.2Z" />
        <path d="M32 8.5c-7.3 1.2-12 5.9-12 12.2 0 6.2 4.8 10.6 12 11.3 7.2 -0.7 12 -5.1 12 -11.3 0 -6.3 -4.7 -11 -12 -12.2Z" transform="rotate(90 32 32)" />
        <path d="M32 8.5c-7.3 1.2-12 5.9-12 12.2 0 6.2 4.8 10.6 12 11.3 7.2 -0.7 12 -5.1 12 -11.3 0 -6.3 -4.7 -11 -12 -12.2Z" transform="rotate(180 32 32)" />
        <path d="M32 8.5c-7.3 1.2-12 5.9-12 12.2 0 6.2 4.8 10.6 12 11.3 7.2 -0.7 12 -5.1 12 -11.3 0 -6.3 -4.7 -11 -12 -12.2Z" transform="rotate(270 32 32)" />
      </g>
      <circle cx="32" cy="32" r="6.5" fill={center} />
      <path d="m28.9 32.1 2.1 2.1 4.3-4.6" stroke={surface} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandLogo({ variant = "full", size = "md", inverted = false, decorative = false, className }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <span className="inline-flex shrink-0">
        <BrandMark size={size} inverted={inverted} decorative={decorative} className={className} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} inverted={inverted} decorative />
      <span className={cn("font-heading text-[15px] font-extrabold tracking-[-0.03em]", inverted ? "text-background" : "text-foreground")}>
        Petal <span className={inverted ? "text-background/55" : "text-primary/65"}>&amp;</span> Plan
      </span>
    </span>
  );
}
