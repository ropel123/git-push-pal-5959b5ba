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

  // Petal: rounded rectangle with one corner deeply curved inward — repeated 4× at 90°.
  // We build it with a path so it scales cleanly.
  const Petal = ({ rotate }: { rotate: number }) => (
    <path
      d="M0,-18 L14,-18 A6,6 0 0 1 20,-12 L20,2 A20,20 0 0 0 0,-18 Z"
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
      <Petal rotate={0} />
      <Petal rotate={90} />
      <Petal rotate={180} />
      <Petal rotate={270} />
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
