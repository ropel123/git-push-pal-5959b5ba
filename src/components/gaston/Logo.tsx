import GastonLogo from "@/components/brand/GastonLogo";

interface LogoProps {
  /** "color" sur fond clair, "white" sur fond bleu. */
  tone?: "color" | "white";
  height?: number;
  className?: string;
}

/**
 * Logo du site vitrine.
 *
 * Les vrais assets (media.base44.com) étaient inaccessibles depuis
 * l'environnement de build : déposer les fichiers officiels dans
 * `public/gaston-logo.png` et `public/gaston-logo-white.png` pour
 * qu'ils remplacent automatiquement le wordmark SVG de repli.
 */
const Logo = ({ tone = "color", height = 34, className }: LogoProps) => {
  const src = tone === "white" ? "/gaston-logo-white.png" : "/gaston-logo.png";
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center" }}>
      <img
        src={src}
        alt="Gaston"
        style={{ height, width: "auto", display: "block" }}
        onError={(e) => {
          // Asset absent → repli sur le wordmark SVG (fidèle au logo).
          const img = e.currentTarget;
          img.style.display = "none";
          const fallback = img.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "inline-flex";
        }}
      />
      <span style={{ display: "none" }}>
        <GastonLogo size={Math.round(height * 0.82)} tone={tone === "white" ? "white" : "color"} />
      </span>
    </span>
  );
};

export default Logo;
