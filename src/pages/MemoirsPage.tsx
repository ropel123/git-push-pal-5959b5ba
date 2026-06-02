import EmptyState from "@/components/EmptyState";
import { BookOpen } from "lucide-react";

const MemoirsPage = () => (
  <EmptyState
    icon={BookOpen}
    title="Aucun mémoire technique"
    description="Vos mémoires techniques générés à partir d'un AO apparaîtront ici."
    cta={{ label: "Explorer les AO", to: "/tenders" }}
  />
);

export default MemoirsPage;
