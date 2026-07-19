import EmptyState from "@/components/EmptyState";
import { UserCog } from "lucide-react";

const UsersPage = () => (
  <EmptyState
    icon={UserCog}
    title="Aucun utilisateur invité"
    description="Invitez les membres de votre équipe et gérez leurs rôles depuis cette page."
    cta={{ label: "Inviter un utilisateur", to: "/dashboard" }}
  />
);

export default UsersPage;
