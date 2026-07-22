import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CTAButtonProps {
  to: string;
  children: React.ReactNode;
  /** yellow = CTA principal, blue = action secondaire sur fond jaune. */
  variant?: "yellow" | "blue";
  size?: "md" | "lg";
  className?: string;
}

/** Bouton pilule du site Gaston (border-radius 9999px). */
const CTAButton = ({ to, children, variant = "yellow", size = "md", className }: CTAButtonProps) => {
  const isExternal = /^https?:|^mailto:|^#/.test(to);
  const cls = cn(
    "inline-flex items-center justify-center rounded-full font-bold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    size === "lg" ? "px-8 py-4 text-lg" : "px-6 py-3 text-base",
    variant === "yellow"
      ? "bg-[#fbbf24] text-[#0f1d34] shadow-[0_4px_14px_rgba(251,191,36,0.4)] hover:bg-[#f5b30d] hover:-translate-y-0.5 focus-visible:ring-[#fbbf24]"
      : "bg-[#1d4ed8] text-white shadow-[0_4px_14px_rgba(29,78,216,0.35)] hover:bg-[#1a44be] hover:-translate-y-0.5 focus-visible:ring-[#1d4ed8]",
    className,
  );

  if (isExternal) {
    return (
      <a href={to} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
};

export default CTAButton;
