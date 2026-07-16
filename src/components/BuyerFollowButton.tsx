import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  buyerName: string;
  buyerSiret?: string | null;
}

const BuyerFollowButton = ({ buyerName, buyerSiret }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!user || !buyerName) return;
    supabase
      .from("buyer_follows")
      .select("id")
      .eq("user_id", user.id)
      .eq("buyer_name", buyerName)
      .maybeSingle()
      .then(({ data }) => {
        setFollowing(!!data);
        setInitialized(true);
      });
  }, [user, buyerName]);

  if (!user || !buyerName) return null;

  const toggle = async () => {
    setLoading(true);
    try {
      if (following) {
        const { error } = await supabase
          .from("buyer_follows")
          .delete()
          .eq("user_id", user.id)
          .eq("buyer_name", buyerName);
        if (error) throw error;
        setFollowing(false);
        toast({ title: "Acheteur retiré du suivi" });
      } else {
        const { error } = await supabase
          .from("buyer_follows")
          .insert({ user_id: user.id, buyer_name: buyerName, buyer_siret: buyerSiret ?? null });
        if (error) throw error;
        setFollowing(true);
        toast({ title: "Acheteur suivi", description: "Vous serez notifié de ses prochains AO." });
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={following ? "secondary" : "outline"}
      onClick={toggle}
      disabled={loading || !initialized}
      className="gap-1.5 h-7 text-xs"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : following ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
      {following ? "Suivi" : "Suivre cet acheteur"}
    </Button>
  );
};

export default BuyerFollowButton;
