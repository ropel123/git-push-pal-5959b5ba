import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import CTAButton from "./CTAButton";
import { NAV, SIGNUP_URL } from "@/lib/gastonContent";

/**
 * Header blanc : logo à gauche, lien « Tarif » (scroll fluide vers la
 * section tarifs), CTA jaune, menu hamburger en mobile.
 */
const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const goToPricing = () => {
    setMenuOpen(false);
    if (location.pathname !== "/") {
      navigate("/#tarifs");
      return;
    }
    document.getElementById("tarifs")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#0f1d34]/5 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1152px] items-center justify-between px-5">
        <Link to="/" aria-label="Gaston — accueil" onClick={() => setMenuOpen(false)}>
          <Logo height={36} />
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navigation principale">
          <button
            type="button"
            onClick={goToPricing}
            className="rounded-md px-2 py-1 text-base font-bold text-[#0f1d34] transition-colors hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            {NAV.pricingLabel}
          </button>
          <CTAButton to={SIGNUP_URL}>{NAV.ctaLabel}</CTAButton>
        </nav>

        {/* Mobile */}
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#0f1d34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] md:hidden"
          aria-expanded={menuOpen}
          aria-controls="gaston-mobile-menu"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="gaston-mobile-menu"
          aria-label="Navigation mobile"
          className="border-t border-[#0f1d34]/5 bg-white px-5 py-4 md:hidden"
        >
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={goToPricing}
              className="rounded-md px-2 py-2 text-left text-base font-bold text-[#0f1d34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              {NAV.pricingLabel}
            </button>
            <CTAButton to={SIGNUP_URL} className="w-full">
              {NAV.ctaLabel}
            </CTAButton>
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
