import { cn } from "@/lib/utils";

type Tone = "navy" | "white" | "gradient" | "currentColor";
type Variant = "full" | "symbol";

interface HackaoLogoProps {
  variant?: Variant;
  tone?: Tone;
  className?: string;
  /** Pixel height — width auto. */
  size?: number;
}

/**
 * HackAO brand mark — pinwheel of four rounded petals + wordmark "HackAO".
 * Inspired by the brand guideline (V2). `tone="gradient"` paints the symbol
 * with the brand blue→cream gradient; the wordmark stays solid.
 */
const HackaoLogo = ({ variant = "full", tone = "navy", className, size = 28 }: HackaoLogoProps) => {
  const fillSymbol =
    tone === "gradient"
      ? "url(#hackao-gradient)"
      : tone === "white"
        ? "#ffffff"
        : tone === "currentColor"
          ? "currentColor"
          : "hsl(var(--primary))";

  const fillWord =
    tone === "white"
      ? "#ffffff"
      : tone === "currentColor"
        ? "currentColor"
        : "hsl(var(--primary))";

  const accentWord =
    tone === "white"
      ? "#ffffff"
      : tone === "currentColor"
        ? "currentColor"
        : "hsl(var(--accent))";

  // Petal: rounded pill radiating diagonally from the center — 4 pills at 45°/135°/225°/315°
  // form a clean, symmetric pinwheel/flower mark.
  const Petal = ({ rotate }: { rotate: number }) => (
    <rect
      x={-7}
      y={-28}
      width={14}
      height={22}
      rx={7}
      ry={7}
      fill={fillSymbol}
      transform={`rotate(${rotate})`}
    />
  );

  const Symbol = (
    <svg
      viewBox="-32 -32 64 64"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id="hackao-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(224 76% 56%)" />
          <stop offset="100%" stopColor="hsl(42 90% 70%)" />
        </linearGradient>
      </defs>
      <Petal rotate={45} />
      <Petal rotate={135} />
      <Petal rotate={225} />
      <Petal rotate={315} />
    </svg>
  );

  if (variant === "symbol") {
    return <span className={cn("inline-flex", className)}>{Symbol}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {Symbol}
      <span
        className="font-bold tracking-tight"
        style={{ fontSize: size * 0.85, lineHeight: 1, color: fillWord }}
      >
        Hack<span style={{ color: accentWord }}>AO</span>
      </span>
    </span>
  );
};

export default HackaoLogo;
