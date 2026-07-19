import EmptyState from "@/components/EmptyState";
import { Users2 } from "lucide-react";

const GroupsPage = () => (
  <EmptyState
    icon={Users2}
    title="Aucun groupe"
    description="Créez des groupes pour organiser vos équipes et leurs droits d'accès."
    cta={{ label: "Créer un groupe", to: "/dashboard" }}
  />
);

export default GroupsPage;
