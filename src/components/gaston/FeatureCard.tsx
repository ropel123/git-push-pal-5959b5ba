import { FileText, Receipt, Users, Library, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  FileText,
  Receipt,
  Users,
  Library,
  ShieldCheck,
  UsersRound,
};

interface FeatureCardProps {
  icon: string;
  title: string;
  text: string;
}

/** Carte fonctionnalité — coins arrondis, bordure et ombre légères. */
const FeatureCard = ({ icon, title, text }: FeatureCardProps) => {
  const Icon = ICONS[icon] ?? FileText;
  return (
    <article className="rounded-2xl border border-[#0f1d34]/8 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#2563eb]/10">
        <Icon className="h-6 w-6 text-[#2563eb]" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-bold text-[#0f1d34]">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[#0f1d34]/70">{text}</p>
    </article>
  );
};

export default FeatureCard;
