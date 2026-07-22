import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  credits: string;
  features?: string[];
  popular?: boolean;
  popularBadge?: string;
  children?: React.ReactNode;
}

/** Carte tarifaire (abonnements) ou pack de crédits. */
const PricingCard = ({ name, price, period, credits, features, popular, popularBadge, children }: PricingCardProps) => (
  <article
    className={cn(
      "relative flex h-full flex-col rounded-3xl border bg-white p-7 shadow-sm transition-shadow hover:shadow-lg",
      popular ? "border-[#2563eb] shadow-[0_12px_32px_rgba(37,99,235,0.16)]" : "border-[#0f1d34]/8",
    )}
  >
    {popular && popularBadge && (
      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#2563eb] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
        {popularBadge}
      </span>
    )}
    <h3 className="text-lg font-bold text-[#0f1d34]">{name}</h3>
    <p className="mt-3 flex items-baseline gap-1">
      <span className="text-4xl font-extrabold text-[#0f1d34]">{price}</span>
      {period && <span className="text-base text-[#0f1d34]/60">{period}</span>}
    </p>
    <p className="mt-1 text-[15px] font-bold text-[#1d4ed8]">{credits}</p>
    {features && features.length > 0 && (
      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[15px] text-[#0f1d34]/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
    )}
    {children}
  </article>
);

export default PricingCard;
