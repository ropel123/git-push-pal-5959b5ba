import EmptyState from "@/components/EmptyState";
import { FileArchive } from "lucide-react";

const ArchivedTenders = () => (
  <EmptyState
    icon={FileArchive}
    title="Aucun marché archivé"
    description="Les AO que vous archivez apparaîtront ici pour référence."
  />
);

export default ArchivedTenders;
