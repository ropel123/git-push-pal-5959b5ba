import EmptyState from "@/components/EmptyState";
import { FileArchive } from "lucide-react";

const DcePage = () => (
  <EmptyState
    icon={FileArchive}
    title="Aucun DCE téléchargé"
    description="Les dossiers de consultation que vous récupérez apparaîtront ici."
    cta={{ label: "Voir les AO", to: "/tenders" }}
  />
);

export default DcePage;
