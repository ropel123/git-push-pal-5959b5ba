import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Calendar, MapPin, Euro, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Tender {
  id: string;
  title: string;
  object: string | null;
  buyer_name: string | null;
  estimated_amount: number | null;
  region: string | null;
  department: string | null;
  publication_date: string | null;
  deadline: string | null;
  status: string | null;
  procedure_type: string | null;
  cpv_codes: string[] | null;
}

const Tenders = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTenders();
  }, []);

  const fetchTenders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenders")
      .select("*")
      .order("publication_date", { ascending: false })
      .limit(100);

    if (data) setTenders(data);
    setLoading(false);
  };

  const addToPipeline = async (tenderId: string) => {
    if (!user) return;
    const { error } = await supabase.from("pipeline_items").insert({
      user_id: user.id,
      tender_id: tenderId,
      stage: "spotted" as const,
    });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Déjà dans le pipeline", variant: "destructive" });
      } else {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Ajouté au pipeline ✓" });
    }
  };

  const filteredTenders = tenders.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.buyer_name?.toLowerCase().includes(q) ||
      t.object?.toLowerCase().includes(q) ||
      t.region?.toLowerCase().includes(q)
    );
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "open": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "closed": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "awarded": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel: Record<string, string> = {
    open: "Ouvert",
    closed: "Clôturé",
    awarded: "Attribué",
    cancelled: "Annulé",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appels d'offres</h1>
          <p className="text-muted-foreground">{filteredTenders.length} résultat(s)</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, acheteur, région..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : filteredTenders.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucun appel d'offres trouvé</p>
            <p className="text-sm mt-1">Les appels d'offres apparaîtront ici une fois importés dans la base.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTenders.map((tender) => (
            <Card key={tender.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{tender.title}</h3>
                      {tender.status && (
                        <Badge variant="outline" className={getStatusColor(tender.status)}>
                          {statusLabel[tender.status] ?? tender.status}
                        </Badge>
                      )}
                    </div>

                    {tender.object && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{tender.object}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {tender.buyer_name && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">{tender.buyer_name}</span>
                        </span>
                      )}
                      {tender.region && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {tender.region}
                        </span>
                      )}
                      {tender.estimated_amount && (
                        <span className="flex items-center gap-1">
                          <Euro className="h-3 w-3" /> {new Intl.NumberFormat("fr-FR").format(tender.estimated_amount)} €
                        </span>
                      )}
                      {tender.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {format(new Date(tender.deadline), "dd MMM yyyy", { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); addToPipeline(tender.id); }}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Pipeline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tenders;
