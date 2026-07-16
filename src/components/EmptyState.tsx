import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: { label: string; to: string };
}

const EmptyState = ({ icon: Icon, title, description, cta }: EmptyStateProps) => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-2xl border border-border bg-card shadow-soft px-6 py-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-5">
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground max-w-md mb-6">{description}</p>
        {cta && (
          <Button onClick={() => navigate(cta.to)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {cta.label}
          </Button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
