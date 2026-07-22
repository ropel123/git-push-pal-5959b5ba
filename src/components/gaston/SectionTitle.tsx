import { cn } from "@/lib/utils";

interface SectionTitleProps {
  children: React.ReactNode;
  tone?: "dark" | "white";
  className?: string;
  id?: string;
}

/** H2 de section — ~30px/36px à 1280 selon la référence mesurée. */
const SectionTitle = ({ children, tone = "dark", className, id }: SectionTitleProps) => (
  <h2
    id={id}
    className={cn(
      "text-center text-[24px] font-extrabold leading-[30px] md:text-[30px] md:leading-[36px]",
      tone === "white" ? "text-white" : "text-[#0f1d34]",
      className,
    )}
  >
    {children}
  </h2>
);

export default SectionTitle;
