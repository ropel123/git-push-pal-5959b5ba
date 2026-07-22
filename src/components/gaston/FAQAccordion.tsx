import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/gastonContent";

interface FAQAccordionProps {
  items: FaqItem[];
}

/**
 * Accordéon FAQ — une seule réponse ouverte à la fois, accessible
 * clavier (boutons natifs), aria-expanded / aria-controls, animation
 * discrète sur l'ouverture.
 */
const FAQAccordion = ({ items }: FAQAccordionProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      {items.map((item, i) => {
        const open = openIndex === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-button-${i}`;
        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-2xl border border-[#0f1d34]/10 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-bold text-[#0f1d34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]"
              >
                {item.question}
                <ChevronDown
                  aria-hidden
                  className={`h-5 w-5 shrink-0 text-[#2563eb] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-[15px] leading-relaxed text-[#0f1d34]/75">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FAQAccordion;
