import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Calendar, MapPin, Euro, Plus, Save, ChevronDown, ChevronUp, Download, BookmarkCheck, Trash2, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { computeScore, getScoreColor } from "@/lib/scoring";

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

interface SavedSearch {
  id: string;
  name: string;
  filters: any;
}

const PAGE_SIZE = 20;

const REGIONS = [
  "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
  "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France",
  "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
  "Pays de la Loire", "Provence-Alpes-Côte d'Azur", "Outre-mer",
];

const Tenders = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [procedureFilter, setProcedureFilter] = useState("");
  const [dceFilter, setDceFilter] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [searchName, setSearchName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [procedures, setProcedures] = useState<string[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
      fetchSavedSearches();
      // Fetch distinct procedures for filter dropdown
      supabase.from("tenders").select("procedure_type").not("procedure_type", "is", null).then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((d) => d.procedure_type).filter(Boolean))] as string[];
          setProcedures(unique);
        }
      });
    }
  }, [user]);

  const fetchTenders = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("tenders")
      .select("*", { count: "exact" })
      .order("publication_date", { ascending: false })
      .range(from, to);

    // Filter tenders that have a dce_url (auto-fetch available)
    if (dceFilter) {
      query = query.not("dce_url", "is", null).neq("dce_url", "");
    }

    // Server-side filters
    if (search.trim()) {
      query = query.or(`title.ilike.%${search.trim()}%,buyer_name.ilike.%${search.trim()}%,object.ilike.%${search.trim()}%`);
    }
    if (regionFilter && regionFilter !== "all") {
      query = query.eq("region", regionFilter);
    }
    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter as "open" | "closed" | "awarded" | "cancelled");
    }
    if (procedureFilter && procedureFilter !== "all") {
      query = query.eq("procedure_type", procedureFilter);
    }

    const { data, count } = await query;
    if (data) setTenders(data);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [page, search, regionFilter, statusFilter, procedureFilter, dceFilter]);

  // Debounced fetch on filter/page change
  useEffect(() => {
    const timeout = setTimeout(() => fetchTenders(), 300);
    return () => clearTimeout(timeout);
  }, [fetchTenders]);

  const fetchSavedSearches = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_searches").select("id, name, filters").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setSavedSearches(data);
  };

  const applySavedSearch = (s: SavedSearch) => {
    const f = s.filters ?? {};
    setSearch(f.search ?? "");
    setRegionFilter(f.regionFilter ?? "");
    setStatusFilter(f.statusFilter ?? "");
    setProcedureFilter(f.procedureFilter ?? "");
    setDceFilter(f.dceFilter ?? false);
    setShowFilters(true);
    setPage(0);
    toast({ title: `Recherche "${s.name}" appliquée` });
  };

  const deleteSavedSearch = async (id: string) => {
    await supabase.from("saved_searches").delete().eq("id", id);
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Recherche supprimée" });
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
    const filters = { search, regionFilter, statusFilter, procedureFilter, dceFilter };
    await supabase.from("saved_searches").insert({ user_id: user.id, name: searchName.trim(), filters });
    toast({ title: "Recherche sauvegardée ✓" });
    setSearchName("");
    setSavingSearch(false);
    fetchSavedSearches();
  };

  const exportCSV = () => {
    const headers = ["Titre", "Acheteur", "Montant estimé", "Région", "Date limite", "Statut"];
    const rows = tenders.map((t) => [
      `"${(t.title ?? "").replace(/"/g, '""')}"`,
      `"${(t.buyer_name ?? "").replace(/"/g, '""')}"`,
      t.estimated_amount ?? "",
      t.region ?? "",
      t.deadline ? format(new Date(t.deadline), "dd/MM/yyyy") : "",
      t.status ?? "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appels-offres-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "open": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "closed": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "awarded": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel: Record<string, string> = { open: "Ouvert", closed: "Clôturé", awarded: "Attribué", cancelled: "Annulé" };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appels d'offres</h1>
          <p className="text-muted-foreground">{totalCount} résultat(s) — page {page + 1}/{totalPages || 1}</p>
        </div>
        <div className="flex gap-2">
          {savedSearches.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <BookmarkCheck className="h-4 w-4 mr-1" /> Recherches sauvegardées
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2">
                <div className="space-y-1">
                  {savedSearches.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 transition-colors">
                      <button className="text-sm text-foreground truncate flex-1 text-left" onClick={() => applySavedSearch(s)}>{s.name}</button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => deleteSavedSearch(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={tenders.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par titre, acheteur, objet..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-10" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          Filtres {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </Button>
      </div>

      {showFilters && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Région" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les régions</SelectItem>
                  {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="open">Ouvert</SelectItem>
                  <SelectItem value="closed">Clôturé</SelectItem>
                  <SelectItem value="awarded">Attribué</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={procedureFilter} onValueChange={(v) => { setProcedureFilter(v); setPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Procédure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les procédures</SelectItem>
                  {procedures.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch id="dce-filter" checked={dceFilter} onCheckedChange={(v) => { setDceFilter(v); setPage(0); }} />
                <Label htmlFor="dce-filter" className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <FileText className="h-4 w-4" /> DCE auto disponible
                </Label>
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Input placeholder="Nom de la recherche" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="max-w-xs" />
              <Button variant="secondary" size="sm" onClick={saveSearch} disabled={savingSearch || !searchName.trim()}>
                <Save className="h-4 w-4 mr-1" /> Sauvegarder
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setRegionFilter(""); setStatusFilter(""); setProcedureFilter(""); setDceFilter(false); setSearch(""); setPage(0); }}>
                Réinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : tenders.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucun appel d'offres trouvé</p>
            <p className="text-sm mt-1">Modifiez vos filtres ou attendez de nouveaux imports.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tenders.map((tender) => {
            const score = profile ? computeScore(tender, profile) : null;
            return (
              <Card key={tender.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/tenders/${tender.id}`)}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{tender.title}</h3>
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
                      {tender.object && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{tender.object}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {tender.buyer_name && <span className="font-medium">{tender.buyer_name}</span>}
                        {tender.region && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {tender.region}</span>}
                        {tender.estimated_amount && <span className="flex items-center gap-1"><Euro className="h-3 w-3" /> {new Intl.NumberFormat("fr-FR").format(tender.estimated_amount)} €</span>}
                        {tender.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(tender.deadline), "dd MMM yyyy", { locale: fr })}</span>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); addToPipeline(tender.id); }} className="shrink-0 self-start">
                      <Plus className="h-4 w-4 mr-1" /> Pipeline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Tenders;
