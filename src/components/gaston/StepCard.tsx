interface StepCardProps {
  index: number;
  title: string;
  text: string;
}

/** Étape numérotée de « De vos notes au devis client en 4 étapes ». */
const StepCard = ({ index, title, text }: StepCardProps) => (
  <article className="relative rounded-2xl border border-[#0f1d34]/8 bg-white p-6 shadow-sm">
    <span
      aria-hidden
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fbbf24] text-lg font-extrabold text-[#0f1d34]"
    >
      {index}
    </span>
    <h3 className="mt-4 text-lg font-bold text-[#0f1d34]">{title}</h3>
    <p className="mt-2 text-[15px] leading-relaxed text-[#0f1d34]/70">{text}</p>
  </article>
);

export default StepCard;
