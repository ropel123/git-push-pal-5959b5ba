import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, MapPin, Euro, Plus, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { computeScore, getScoreColor, getScoreLabel } from "@/lib/scoring";

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

const REGIONS = [
  "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
  "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France",
  "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
  "Pays de la Loire", "Provence-Alpes-Côte d'Azur", "Outre-mer",
];

const Tenders = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [procedureFilter, setProcedureFilter] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [searchName, setSearchName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTenders();
    if (user) {
      supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  }, [user]);

  const fetchTenders = async () => {
    setLoading(true);
    const { data } = await supabase
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
    if (error?.code === "23505") {
      toast({ title: "Déjà dans le pipeline", variant: "destructive" });
    } else if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ajouté au pipeline ✓" });
    }
  };

  const saveSearch = async () => {
    if (!user || !searchName.trim()) return;
    setSavingSearch(true);
    const filters = { search, regionFilter, statusFilter, procedureFilter };
    await supabase.from("saved_searches").insert({
      user_id: user.id,
      name: searchName.trim(),
      filters,
    });
    toast({ title: "Recherche sauvegardée ✓" });
    setSearchName("");
    setSavingSearch(false);
  };

  const filteredTenders = tenders.filter((t) => {
    const q = search.toLowerCase();
    const matchText = !q || t.title.toLowerCase().includes(q) || t.buyer_name?.toLowerCase().includes(q) || t.object?.toLowerCase().includes(q) || t.region?.toLowerCase().includes(q);
    const matchRegion = !regionFilter || t.region === regionFilter;
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchProcedure = !procedureFilter || t.procedure_type === procedureFilter;
    return matchText && matchRegion && matchStatus && matchProcedure;
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "open": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "closed": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "awarded": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel: Record<string, string> = { open: "Ouvert", closed: "Clôturé", awarded: "Attribué", cancelled: "Annulé" };
  const procedures = [...new Set(tenders.map((t) => t.procedure_type).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appels d'offres</h1>
          <p className="text-muted-foreground">{filteredTenders.length} résultat(s)</p>
        </div>
      </div>

      {/* Search + toggle filters */}
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
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          Filtres {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </Button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger><SelectValue placeholder="Région" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les régions</SelectItem>
                  {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="open">Ouvert</SelectItem>
                  <SelectItem value="closed">Clôturé</SelectItem>
                  <SelectItem value="awarded">Attribué</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={procedureFilter} onValueChange={setProcedureFilter}>
                <SelectTrigger><SelectValue placeholder="Procédure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les procédures</SelectItem>
                  {procedures.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-center">
              <Input placeholder="Nom de la recherche" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="max-w-xs" />
              <Button variant="secondary" size="sm" onClick={saveSearch} disabled={savingSearch || !searchName.trim()}>
                <Save className="h-4 w-4 mr-1" /> Sauvegarder
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setRegionFilter(""); setStatusFilter(""); setProcedureFilter(""); setSearch(""); }}>
                Réinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
          {filteredTenders.map((tender) => {
            const score = profile ? computeScore(tender, profile) : null;
            return (
              <Card
                key={tender.id}
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/tenders/${tender.id}`)}
              >
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
                        {score !== null && (
                          <Badge variant="outline" className={getScoreColor(score)}>
                            {score}/100
                          </Badge>
                        )}
                      </div>
                      {tender.object && <p className="text-sm text-muted-foreground line-clamp-2">{tender.object}</p>}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {tender.buyer_name && <span className="font-medium">{tender.buyer_name}</span>}
                        {tender.region && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {tender.region}</span>}
                        {tender.estimated_amount && <span className="flex items-center gap-1"><Euro className="h-3 w-3" /> {new Intl.NumberFormat("fr-FR").format(tender.estimated_amount)} €</span>}
                        {tender.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(tender.deadline), "dd MMM yyyy", { locale: fr })}</span>}
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tenders;
