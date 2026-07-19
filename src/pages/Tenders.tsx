import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  Calendar,
  MapPin,
  Euro,
  Plus,
  Save,
  Download,
  BookmarkCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { computeScore, getScoreColor, hasScorableProfile } from "@/lib/scoring";
import { useTenders, type TenderStatus } from "@/hooks/queries/useTenders";
import { useProfile } from "@/hooks/queries/useProfile";
import { useDebounce } from "@/hooks/useDebounce";
import { useDceUploadedTenderIds } from "@/hooks/queries/useDceUploads";

import { PROCEDURE_SYNONYMS } from "@/lib/pricing";

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

const PROCEDURES = [
  "Appel d'offres ouvert",
  "Appel d'offres restreint",
  "Procédure adaptée (MAPA)",
  "Dialogue compétitif",
  "Procédure négociée",
  "Concours",
  "Marché de gré à gré",
  "Accord-cadre",
];

const DEFAULT_PROCEDURE = "Appel d'offres ouvert";

const Tenders = () => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [procedureFilter, setProcedureFilter] = useState<string>(DEFAULT_PROCEDURE);
  const [dceFilter, setDceFilter] = useState(false);
  const [dceReadyFilter, setDceReadyFilter] = useState(false);
  const [pubDateFrom, setPubDateFrom] = useState("");
  const [pubDateTo, setPubDateTo] = useState("");
  const [includeUndatedPub, setIncludeUndatedPub] = useState(true);
  const [smartFilter, setSmartFilter] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Profil partagé via le cache React Query (useProfile) — plus de fetch ad-hoc.
  const profileQuery = useProfile(user?.id);
  const profile = (profileQuery.data as any) ?? null;
  const profileLoaded = !user || !profileQuery.isLoading;

  // Seed la recherche depuis ?q=... (ex: barre de recherche du Dashboard) au montage.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setSearch(q);
      setPage(0);
    }
    // Une seule fois au montage : on ne resynchronise pas à chaque changement d'URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) fetchSavedSearches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const smartFilterInfo = useMemo(() => {
    if (!profile || !smartFilter) return null;
    const regions = profile.regions ?? [];
    const keywords = profile.keywords ?? [];
    const hasData = regions.length > 0 || keywords.length > 0;
    if (!hasData) return null;
    const parts: string[] = [];
    if (regions.length > 0) parts.push(`${regions.length} région${regions.length > 1 ? "s" : ""}`);
    if (keywords.length > 0) parts.push(`${keywords.length} mot${keywords.length > 1 ? "s" : ""}-clé${keywords.length > 1 ? "s" : ""}`);
    return parts.join(", ");
  }, [profile, smartFilter]);

  const debouncedSearch = useDebounce(search, 300);

  const dceReadyQuery = useDceUploadedTenderIds(user?.id);
  const dceReadyMap = dceReadyQuery.data ?? new Map<string, { viaAgent: boolean }>();
  const dceReadyIds = useMemo(() => Array.from(dceReadyMap.keys()), [dceReadyMap]);

  const procedureList = useMemo(
    () =>
      procedureFilter && procedureFilter !== "all"
        ? PROCEDURE_SYNONYMS[procedureFilter] ?? [procedureFilter]
        : null,
    [procedureFilter],
  );

  const tendersQuery = useTenders({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    region: regionFilter,
    status: (statusFilter || undefined) as TenderStatus | undefined,
    procedures: procedureList,
    dceOnly: dceFilter,
    idsIn: dceReadyFilter ? dceReadyIds : null,
    publicationFrom: pubDateFrom || undefined,
    publicationTo: pubDateTo || undefined,
    includeUndatedPublication: includeUndatedPub,
    smart: smartFilter && profile ? { regions: profile.regions, keywords: profile.keywords } : null,
    enabled: profileLoaded && (!dceReadyFilter || !dceReadyQuery.isLoading),
  });

  const loading = tendersQuery.isLoading || tendersQuery.isFetching;
  const totalCount = tendersQuery.data?.count ?? 0;
  const scorable = !!(profile && hasScorableProfile(profile));
  // Score calculé UNE fois par AO (réutilisé pour le tri ET l'affichage du badge),
  // au lieu de deux appels computeScore par carte.
  const tenders = useMemo(() => {
    const items = tendersQuery.data?.items ?? [];
    const withScore = items.map((t) => ({
      ...t,
      _score: scorable ? computeScore(t, profile) : (null as number | null),
    }));
    if (smartFilter && scorable && withScore.length > 0) {
      return [...withScore].sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
    }
    return withScore;
  }, [tendersQuery.data, smartFilter, profile, scorable]);

  const fetchSavedSearches = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_searches").select("id, name, filters").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setSavedSearches(data);
  };

  const applySavedSearch = (s: SavedSearch) => {
    const f = s.filters ?? {};
    setSearch(f.search ?? "");
    setRegionFilter(f.regionFilter ?? "");
    setStatusFilter(f.statusFilter ?? "open");
    setProcedureFilter(f.procedureFilter ?? DEFAULT_PROCEDURE);
    setDceFilter(f.dceFilter ?? false);
    setDceReadyFilter(f.dceReadyFilter ?? false);
    setPubDateFrom(f.pubDateFrom ?? "");
    setPubDateTo(f.pubDateTo ?? "");
    if (typeof f.includeUndatedPub === "boolean") setIncludeUndatedPub(f.includeUndatedPub);
    if (typeof f.smartFilter === "boolean") setSmartFilter(f.smartFilter);
    setPage(0);
    toast({ title: `Profil de veille "${s.name}" appliqué` });
  };

  const deleteSavedSearch = async (id: string) => {
    await supabase.from("saved_searches").delete().eq("id", id);
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Profil de veille supprimé" });
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
    const filters = { search, regionFilter, statusFilter, procedureFilter, dceFilter, dceReadyFilter, pubDateFrom, pubDateTo, includeUndatedPub, smartFilter };
    const { error } = await supabase
      .from("saved_searches")
      .insert({ user_id: user.id, name: searchName.trim(), filters });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil de veille sauvegardé ✓" });
      setSearchName("");
      fetchSavedSearches();
    }
    setSavingSearch(false);
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

  const resetFilters = () => {
    setRegionFilter("");
    setStatusFilter("open");
    setProcedureFilter(DEFAULT_PROCEDURE);
    setDceFilter(false);
    setDceReadyFilter(false);
    setPubDateFrom("");
    setPubDateTo("");
    setIncludeUndatedPub(true);
    setSearch("");
    setPage(0);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex gap-6">
        {/* Sticky filters sidebar */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-4 space-y-3 max-h-[calc(100vh-2rem)] overflow-y-auto pr-1">
            

            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label htmlFor="smart-filter" className="text-xs cursor-pointer flex-1">
                    Mon entreprise
                  </Label>
                  <Switch
                    id="smart-filter"
                    checked={smartFilter}
                    onCheckedChange={(v) => { setSmartFilter(v); setPage(0); }}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Région</Label>
                  <Select value={regionFilter || "all"} onValueChange={(v) => { setRegionFilter(v === "all" ? "" : v); setPage(0); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Région" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les régions</SelectItem>
                      {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Statut</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Ouvert</SelectItem>
                      <SelectItem value="closed">Clôturé</SelectItem>
                      <SelectItem value="awarded">Attribué</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Procédure</Label>
                  <Select value={procedureFilter} onValueChange={(v) => { setProcedureFilter(v); setPage(0); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les procédures</SelectItem>
                      {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Date de publication</Label>
                  <div className="flex gap-2">
                    <Input type="date" aria-label="Publié à partir du" className="h-9 text-xs" value={pubDateFrom} onChange={(e) => { setPubDateFrom(e.target.value); setPage(0); }} />
                    <Input type="date" aria-label="Publié jusqu'au" className="h-9 text-xs" value={pubDateTo} onChange={(e) => { setPubDateTo(e.target.value); setPage(0); }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="undated-pub" checked={includeUndatedPub} onCheckedChange={(v) => { setIncludeUndatedPub(v); setPage(0); }} />
                    <Label htmlFor="undated-pub" className="text-xs cursor-pointer">Inclure les AO sans date</Label>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Switch id="dce-filter" checked={dceFilter} onCheckedChange={(v) => { setDceFilter(v); setPage(0); }} />
                  <Label htmlFor="dce-filter" className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <FileText className="h-3.5 w-3.5" /> DCE auto disponible
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="dce-ready-filter" checked={dceReadyFilter} onCheckedChange={(v) => { setDceReadyFilter(v); setPage(0); }} />
                  <Label htmlFor="dce-ready-filter" className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> DCE déjà récupéré
                  </Label>
                </div>

                <div className="pt-2 space-y-2">
                  <Input
                    placeholder="Nom de la recherche"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={saveSearch} disabled={savingSearch || !searchName.trim()} className="flex-1">
                      <Save className="h-3.5 w-3.5 mr-1" /> Sauver
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                      Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Appels d'offres</h1>
              <p className="text-muted-foreground text-sm">
                {totalCount} résultat(s) — page {page + 1}/{totalPages || 1}
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {savedSearches.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <BookmarkCheck className="h-4 w-4 mr-1" /> Recherches
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

          {smartFilter && smartFilterInfo && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Filtré selon votre profil ({smartFilterInfo}) — triés par pertinence sur cette page</span>
            </div>
          )}

          {profileLoaded && profile && !hasScorableProfile(profile) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                Le score de pertinence s'activera une fois votre profil renseigné (mots-clés, régions, secteurs).
              </span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate("/settings")}>
                Compléter mon profil
              </Button>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre, acheteur, objet..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-10"
            />
          </div>

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
                const score = tender._score;
                return (
                  <Card key={tender.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/tenders/${tender.id}`)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {(() => {
                              const isPlaceholder = /^Consultation Atexo \d+$/i.test(tender.title ?? "");
                              return (
                                <h3 className={`font-semibold text-sm sm:text-base truncate ${isPlaceholder ? "text-muted-foreground italic" : "text-foreground"}`}>
                                  {isPlaceholder ? "Consultation en cours d'enrichissement…" : tender.title}
                                </h3>
                              );
                            })()}
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
                            {dceReadyMap.has(tender.id) && (
                              <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> DCE récupéré
                              </Badge>
                            )}
                          </div>
                          {tender.object && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{tender.object}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {tender.buyer_name && <span className="font-medium">{tender.buyer_name}</span>}
                            {tender.region && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {tender.region}</span>}
                            {tender.estimated_amount != null && tender.estimated_amount > 0 && <span className="flex items-center gap-1"><Euro className="h-3 w-3" /> {new Intl.NumberFormat("fr-FR").format(tender.estimated_amount)} €</span>}
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
      </div>
    </div>
  );
};

export default Tenders;
