import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Award, Euro, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AwardNotice {
  id: string;
  winner_name: string | null;
  winner_siren: string | null;
  awarded_amount: number | null;
  num_candidates: number | null;
  award_date: string | null;
  contract_duration: string | null;
  tenders: { title: string; buyer_name: string | null } | null;
}

const Awards = () => {
  const [awards, setAwards] = useState<AwardNotice[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("award_notices")
        .select("*, tenders(title, buyer_name)")
        .order("award_date", { ascending: false })
        .limit(100);
      if (data) setAwards(data as AwardNotice[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = awards.filter((a) => {
    const q = search.toLowerCase();
    return !q || a.winner_name?.toLowerCase().includes(q) || a.tenders?.title.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Avis d'attribution</h1>
        <p className="text-muted-foreground">{filtered.length} résultat(s)</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par titulaire, titre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucun avis d'attribution</p>
            <p className="text-sm mt-1">Les avis d'attribution apparaîtront ici une fois importés.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((award) => (
            <Card key={award.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground">{award.tenders?.title ?? "—"}</h3>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {award.winner_name && (
                    <span className="flex items-center gap-1">
                      <Award className="h-3 w-3 text-green-400" /> {award.winner_name}
                    </span>
                  )}
                  {award.awarded_amount && (
                    <span className="flex items-center gap-1">
                      <Euro className="h-3 w-3" /> {new Intl.NumberFormat("fr-FR").format(award.awarded_amount)} €
                    </span>
                  )}
                  {award.num_candidates && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {award.num_candidates} candidats
                    </span>
                  )}
                  {award.award_date && (
                    <span>{format(new Date(award.award_date), "dd MMM yyyy", { locale: fr })}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Awards;
