import EmptyState from "@/components/EmptyState";
import { Briefcase } from "lucide-react";

const TrackedTenders = () => (
  <EmptyState
    icon={Briefcase}
    title="Aucun marché suivi"
    description="Suivez un appel d'offres depuis la recherche pour le retrouver ici."
    cta={{ label: "Explorer les AO", to: "/tenders" }}
  />
);

export default TrackedTenders;
