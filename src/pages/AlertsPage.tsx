import EmptyState from "@/components/EmptyState";
import { Bell } from "lucide-react";

const AlertsPage = () => (
  <EmptyState
    icon={Bell}
    title="Aucune alerte active"
    description="Créez une alerte pour être notifié des nouveaux AO correspondant à vos critères."
    cta={{ label: "Créer une alerte", to: "/settings" }}
  />
);

export default AlertsPage;
