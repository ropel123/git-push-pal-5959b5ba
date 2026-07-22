import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/gaston/Header";
import Footer from "@/components/gaston/Footer";
import SectionTitle from "@/components/gaston/SectionTitle";
import PricingCard from "@/components/gaston/PricingCard";
import FAQAccordion from "@/components/gaston/FAQAccordion";
import { CREDITS_PAGE } from "@/lib/gastonContent";

/**
 * Page /credits — « Comprendre les crédits Gaston »
 * (reproduction de gaston.base44.app/credits).
 */
const CreditsPage = () => (
  <div className="gaston-site min-h-screen bg-[#f5f6fa] text-[#0f1d34]">
    <Header />

    <main>
      <div className="mx-auto w-full max-w-[1152px] px-5 py-12 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md font-bold text-[#1d4ed8] underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {CREDITS_PAGE.backLabel}
        </Link>

        <h1 className="mt-8 text-center text-[28px] font-extrabold leading-tight text-[#0f1d34] md:text-[40px]">
          {CREDITS_PAGE.title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-[#0f1d34]/70 md:text-base">
          {CREDITS_PAGE.intro}
        </p>

        {/* Packs */}
        <section className="mt-14">
          <SectionTitle>{CREDITS_PAGE.packsTitle}</SectionTitle>
          <div className="mt-10 grid items-stretch gap-6 md:grid-cols-3">
            {CREDITS_PAGE.packs.map((pack) => (
              <PricingCard
                key={pack.name}
                name={pack.name}
                price={pack.price}
                credits={pack.credits}
                popular={pack.popular}
                popularBadge={pack.popularBadge}
              />
            ))}
          </div>
          <p className="mt-6 text-center text-sm font-medium text-[#0f1d34]/65">{CREDITS_PAGE.packsNote}</p>
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <SectionTitle>Questions fréquentes</SectionTitle>
          <div className="mt-10">
            <FAQAccordion items={CREDITS_PAGE.faq} />
          </div>
        </section>

        <p className="mt-14 text-center text-sm text-[#0f1d34]/60">{CREDITS_PAGE.finalNote}</p>
      </div>
    </main>

    <Footer />
  </div>
);

export default CreditsPage;
