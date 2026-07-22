import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Header from "@/components/gaston/Header";
import Footer from "@/components/gaston/Footer";
import CTAButton from "@/components/gaston/CTAButton";
import SectionTitle from "@/components/gaston/SectionTitle";
import FeatureCard from "@/components/gaston/FeatureCard";
import StepCard from "@/components/gaston/StepCard";
import PricingCard from "@/components/gaston/PricingCard";
import ComparisonTable from "@/components/gaston/ComparisonTable";
import FAQAccordion from "@/components/gaston/FAQAccordion";
import {
  SIGNUP_URL,
  HERO,
  PROMO_BAND,
  PROBLEMS_SECTION,
  SEPARATOR_TEXT,
  STEPS_SECTION,
  AI_CALLOUT,
  FEATURES_SECTION,
  COMPARISON_SECTION,
  PRICING_SECTION,
  CREDITS_TEASER,
  HOME_FAQ,
  OFFER_SECTION,
  FINAL_BAND,
} from "@/lib/gastonContent";

const Container = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1152px] px-5 ${className}`}>{children}</div>
);

/**
 * Page d'accueil du site vitrine Gaston — reproduction de
 * gaston.base44.app (spécification du propriétaire du site).
 */
const GastonLanding = () => {
  const location = useLocation();

  // Arrivée depuis /credits via « Tarif » (/#tarifs).
  useEffect(() => {
    if (location.hash === "#tarifs") {
      requestAnimationFrame(() => {
        document.getElementById("tarifs")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [location.hash]);

  return (
    <div className="gaston-site min-h-screen bg-[#f5f6fa] text-[#0f1d34]">
      <Header />

      <main id="top">
        {/* ═════ HERO ═════ */}
        <section className="bg-[#2563eb]">
          <Container className="flex flex-col items-center py-16 text-center md:py-24">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold text-white">
              <Sparkles className="h-4 w-4 text-[#fbbf24]" aria-hidden />
              {HERO.badge}
            </span>
            <h1 className="mt-7 max-w-4xl text-[24px] font-extrabold leading-[30px] text-white md:text-[48px] md:leading-[52px] lg:text-[60px] lg:leading-[60px]">
              {HERO.titleStart}{" "}
              <span className="text-[#fbbf24]">{HERO.titleHighlight}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">{HERO.intro}</p>
            <CTAButton to={SIGNUP_URL} size="lg" className="mt-9">
              {HERO.cta}
            </CTAButton>
          </Container>
        </section>

        {/* ═════ BANDEAU PROMO ═════ */}
        <section className="bg-[#fbbf24]">
          <Container className="flex flex-col items-center gap-4 py-6 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <p className="text-lg font-extrabold text-[#0f1d34]">{PROMO_BAND.title}</p>
              <p className="text-sm font-medium text-[#0f1d34]/75">{PROMO_BAND.note}</p>
            </div>
            <CTAButton to={SIGNUP_URL} variant="blue">
              {PROMO_BAND.cta}
            </CTAButton>
          </Container>
        </section>

        {/* ═════ PROBLÈMES ═════ */}
        <section className="bg-white">
          <Container className="py-16 md:py-20">
            <SectionTitle>{PROBLEMS_SECTION.title}</SectionTitle>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PROBLEMS_SECTION.items.map((p) => (
                <article key={p.title} className="rounded-2xl bg-[#f8f9fc] p-6">
                  <h3 className="text-lg font-bold text-[#0f1d34]">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#0f1d34]/70">{p.text}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        {/* ═════ SÉPARATEUR ═════ */}
        <section className="bg-[#f5f6fa]">
          <Container className="py-10 text-center">
            <p className="text-xl font-extrabold text-[#1d4ed8] md:text-2xl">{SEPARATOR_TEXT}</p>
          </Container>
        </section>

        {/* ═════ 4 ÉTAPES ═════ */}
        <section className="bg-[#f5f6fa]">
          <Container className="pb-16 md:pb-20">
            <SectionTitle>{STEPS_SECTION.title}</SectionTitle>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS_SECTION.steps.map((s, i) => (
                <StepCard key={s.title} index={i + 1} title={s.title} text={s.text} />
              ))}
            </div>

            {/* Encadré IA */}
            <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-[#2563eb]/20 bg-[#2563eb]/5 p-8 text-center">
              <h3 className="text-xl font-extrabold text-[#0f1d34] md:text-2xl">{AI_CALLOUT.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#0f1d34]/75 md:text-base">{AI_CALLOUT.text}</p>
            </div>
          </Container>
        </section>

        {/* ═════ FONCTIONNALITÉS ═════ */}
        <section className="bg-white">
          <Container className="py-16 md:py-20">
            <SectionTitle>{FEATURES_SECTION.title}</SectionTitle>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES_SECTION.items.map((f) => (
                <FeatureCard key={f.title} icon={f.icon} title={f.title} text={f.text} />
              ))}
            </div>
          </Container>
        </section>

        {/* ═════ COMPARATIF ═════ */}
        <section className="bg-[#f8f9fc]">
          <Container className="py-16 md:py-20">
            <SectionTitle>{COMPARISON_SECTION.title}</SectionTitle>
            <div className="mx-auto mt-10 max-w-3xl">
              <ComparisonTable />
              <div className="mt-6 flex flex-col gap-2 text-center">
                {COMPARISON_SECTION.gains.map((g) => (
                  <p key={g} className="text-base font-bold text-[#1d4ed8]">
                    {g}
                  </p>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* ═════ TARIFS ═════ */}
        <section id="tarifs" className="scroll-mt-20 bg-white">
          <Container className="py-16 md:py-20">
            <SectionTitle>{PRICING_SECTION.title}</SectionTitle>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-[#0f1d34]/70 md:text-base">
              {PRICING_SECTION.intro}
            </p>
            <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
              {PRICING_SECTION.tiers.map((tier) => (
                <PricingCard
                  key={tier.name}
                  name={tier.name}
                  price={tier.price}
                  period={tier.period}
                  credits={tier.credits}
                  features={tier.features}
                  popular={tier.popular}
                  popularBadge={tier.popularBadge}
                />
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center gap-2 text-center">
              {PRICING_SECTION.notes.map((n) => (
                <p key={n} className="text-sm text-[#0f1d34]/65">
                  {n}
                </p>
              ))}
              <CTAButton to={SIGNUP_URL} size="lg" className="mt-5">
                {PRICING_SECTION.cta}
              </CTAButton>
            </div>

            {/* Bloc crédits supplémentaires */}
            <div className="mx-auto mt-12 max-w-2xl rounded-3xl bg-[#f8f9fc] p-8 text-center">
              <h3 className="text-lg font-extrabold text-[#0f1d34]">{CREDITS_TEASER.title}</h3>
              <p className="mt-2 text-[15px] text-[#0f1d34]/70">{CREDITS_TEASER.text}</p>
              <Link
                to="/credits"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md font-bold text-[#1d4ed8] underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                {CREDITS_TEASER.linkLabel} →
              </Link>
            </div>
          </Container>
        </section>

        {/* ═════ FAQ ═════ */}
        <section className="bg-[#f5f6fa]">
          <Container className="py-16 md:py-20">
            <SectionTitle>Questions fréquentes</SectionTitle>
            <div className="mt-10">
              <FAQAccordion items={HOME_FAQ} />
            </div>
          </Container>
        </section>

        {/* ═════ OFFRE EXCLUSIVE ═════ */}
        <section className="bg-white">
          <Container className="py-16 md:py-20">
            <div className="mx-auto max-w-3xl rounded-3xl border-2 border-[#fbbf24] bg-white p-8 text-center shadow-[0_16px_40px_rgba(251,191,36,0.18)] md:p-12">
              <span className="inline-flex rounded-full bg-[#fbbf24] px-4 py-1.5 text-sm font-bold text-[#0f1d34]">
                {OFFER_SECTION.badge}
              </span>
              <p className="mt-6 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-extrabold text-[#0f1d34]">{OFFER_SECTION.price}</span>
                <span className="text-xl font-bold text-[#1d4ed8]">{OFFER_SECTION.priceLabel}</span>
              </p>
              <h3 className="mt-4 text-xl font-extrabold text-[#0f1d34] md:text-2xl">{OFFER_SECTION.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#0f1d34]/70 md:text-base">{OFFER_SECTION.text}</p>
              <CTAButton to={SIGNUP_URL} size="lg" className="mt-7">
                {OFFER_SECTION.cta}
              </CTAButton>
              <p className="mt-3 text-sm text-[#0f1d34]/60">{OFFER_SECTION.note}</p>
            </div>
          </Container>
        </section>

        {/* ═════ BANDEAU FINAL ═════ */}
        <section className="bg-[#2563eb]">
          <Container className="py-14 text-center md:py-16">
            <p className="mx-auto max-w-3xl text-xl font-extrabold leading-snug text-white md:text-3xl">{FINAL_BAND}</p>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default GastonLanding;
