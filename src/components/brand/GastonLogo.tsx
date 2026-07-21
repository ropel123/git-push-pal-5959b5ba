import { cn } from "@/lib/utils";

type Variant = "full" | "symbol";
type Tone = "color" | "white";

interface GastonLogoProps {
  variant?: Variant;
  tone?: Tone;
  className?: string;
  /** Hauteur du logo en px (le wordmark s'aligne dessus). */
  size?: number;
}

/* Palette du logo Gaston */
const AMBER = "#F2A51D";
const INDIGO = "#3D4EC7";
const BRIM_BLUE = "#2D6BE4";

/**
 * Casque de chantier — le « o » de Gaston.
 * Dôme ambre avec bosse sommitale, visière bleue.
 */
const Helmet = ({ size, tone }: { size: number; tone: Tone }) => (
  <svg
    viewBox="0 0 64 64"
    width={size}
    height={size}
    aria-hidden
    className="shrink-0"
    style={{ display: "inline-block" }}
  >
    {/* bosse sommitale */}
    <rect x="25" y="4" width="14" height="10" rx="4" fill={tone === "white" ? "#fff" : AMBER} />
    {/* dôme */}
    <path d="M6 36 A26 26 0 0 1 58 36 L58 37 L6 37 Z" fill={tone === "white" ? "#fff" : AMBER} />
    {/* visière */}
    <path
      d="M6 41 A26 22 0 0 0 58 41 L58 40 L6 40 Z"
      fill={tone === "white" ? "rgba(255,255,255,0.72)" : BRIM_BLUE}
    />
  </svg>
);

/**
 * Logo Gaston — wordmark « Gast[casque]n » : G ambre, lettres indigo,
 * le « o » est un casque de chantier. `variant="symbol"` = casque seul.
 */
const GastonLogo = ({ variant = "full", tone = "color", className, size = 28 }: GastonLogoProps) => {
  if (variant === "symbol") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Helmet size={size} tone={tone} />
      </span>
    );
  }

  const letter = tone === "white" ? "#fff" : INDIGO;
  const g = tone === "white" ? "#fff" : AMBER;

  return (
    <span
      className={cn("inline-flex items-baseline select-none leading-none", className)}
      style={{
        fontFamily: "'Roboto Slab', 'Georgia', serif",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "-0.01em",
      }}
      aria-label="Gaston"
    >
      <span style={{ color: g }}>G</span>
      <span style={{ color: letter }}>ast</span>
      <span className="relative inline-flex" style={{ top: `${Math.round(size * 0.08)}px` }}>
        <Helmet size={Math.round(size * 0.78)} tone={tone} />
      </span>
      <span style={{ color: letter }}>n</span>
    </span>
  );
};

export default GastonLogo;
