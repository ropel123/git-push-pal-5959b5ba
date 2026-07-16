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
 * HackAO brand mark — squircle app-icon with blue→violet gradient,
 * white rounded square inside, soft ambient shadow. Wordmark "HackAO"
 * with "AO" in the accent color.
 */
const HackaoLogo = ({ variant = "full", tone = "navy", className, size = 28 }: HackaoLogoProps) => {
  const useGradient = tone === "navy" || tone === "gradient";
  const flatFill =
    tone === "white" ? "#ffffff" : tone === "currentColor" ? "currentColor" : undefined;

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

  // viewBox padded to allow the drop shadow to breathe
  const Symbol = (
    <svg
      viewBox="-8 -8 80 80"
      width={size * 1.15}
      height={size * 1.15}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id="hackao-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B5BFF" />
          <stop offset="100%" stopColor="#6D3BFF" />
        </linearGradient>
        <filter id="hackao-icon-shadow" x="-40%" y="-30%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
          <feOffset dx="0" dy="4" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Squircle tile */}
      <rect
        x={0}
        y={0}
        width={64}
        height={64}
        rx={18}
        ry={18}
        fill={useGradient ? "url(#hackao-icon-gradient)" : flatFill}
        filter={useGradient ? "url(#hackao-icon-shadow)" : undefined}
      />

      {/* Inner white rounded square */}
      <rect
        x={20}
        y={20}
        width={24}
        height={24}
        rx={6}
        ry={6}
        fill={useGradient ? "#ffffff" : tone === "white" ? "hsl(var(--primary))" : "#ffffff"}
      />
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
        style={{ fontSize: size * 0.95, lineHeight: 1, color: fillWord }}
      >
        Hack<span style={{ color: accentWord }}>AO</span>
      </span>
    </span>
  );
};

export default HackaoLogo;
