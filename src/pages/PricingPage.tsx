import EmptyState from "@/components/EmptyState";
import { Calculator } from "lucide-react";

const PricingPage = () => (
  <EmptyState
    icon={Calculator}
    title="Aucun chiffrage"
    description="Vos chiffrages (DIE) construits avec l'assistant IA apparaîtront ici."
    cta={{ label: "Explorer les AO", to: "/tenders" }}
  />
);

export default PricingPage;
