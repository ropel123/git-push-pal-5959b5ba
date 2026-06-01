import { useEffect, useState, useMemo } from "react";
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
import { Search, Calendar, MapPin, Euro, Plus, Save, ChevronDown, ChevronUp, Download, BookmarkCheck, Trash2, ChevronLeft, ChevronRight, FileText, Sparkles, ExternalLink, Globe, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { computeScore, getScoreColor } from "@/lib/scoring";
import { useTenders, type TenderStatus } from "@/hooks/queries/useTenders";
import { useDebounce } from "@/hooks/useDebounce";
import { useDceUploadedTenderIds } from "@/hooks/queries/useDceUploads";

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
  description?: string | null;
  award_criteria?: string | null;
  participation_conditions?: string | null;
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
const formatPlatformLabel = (source: string): string => {
  if (source === "boamp") return "BOAMP";
  if (source === "ted") return "TED";
  if (source === "manual") return "Manuel";
  const stripped = source.startsWith("scrape:") ? source.slice(7) : source;
  if (stripped === "mpi") return "MPI";
  if (stripped === "aura") return "AURA";
  if (stripped === "aws") return "AWS";
  if (stripped === "place") return "PLACE";
  return stripped
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};


const Tenders = () => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [procedureFilter, setProcedureFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [listingHostFilter, setListingHostFilter] = useState("");
  const [dceFilter, setDceFilter] = useState(false);
  const [dceReadyFilter, setDceReadyFilter] = useState(false);
  const [smartFilter, setSmartFilter] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [procedures, setProcedures] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [listingHosts, setListingHosts] = useState<{ host: string; count: number }[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
        if (data) setProfile(data);
        setProfileLoaded(true);
      });
      fetchSavedSearches();
      supabase.rpc("get_distinct_tender_procedures").then(({ data }) => {
        if (data) setProcedures((data as { procedure_type: string }[]).map((d) => d.procedure_type));
      });
      supabase.rpc("get_distinct_tender_sources").then(({ data }) => {
        if (data) setPlatforms((data as { source: string }[]).map((d) => d.source));
      });

    }
  }, [user]);

  // Smart filter metadata
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

  // Load distinct listing hosts when platform filter is a scrape source
  useEffect(() => {
    if (platformFilter && platformFilter !== "all" && platformFilter.startsWith("scrape:")) {
      (supabase.rpc as any)("get_distinct_listing_hosts", { _source: platformFilter }).then(({ data }: any) => {
        if (data) setListingHosts(data as { host: string; count: number }[]);
      });
    } else {
      setListingHosts([]);
      setListingHostFilter("");
    }
  }, [platformFilter]);

  const tendersQuery = useTenders({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    region: regionFilter,
    status: (statusFilter || undefined) as TenderStatus | undefined,
    procedure: procedureFilter,
    platform: platformFilter,
    listingHost: listingHostFilter,
    dceOnly: dceFilter,
    smart: smartFilter && profile ? { regions: profile.regions, keywords: profile.keywords } : null,
    enabled: profileLoaded,
  });

  const loading = tendersQuery.isLoading || tendersQuery.isFetching;
  const totalCount = tendersQuery.data?.count ?? 0;
  const dceReadyQuery = useDceUploadedTenderIds(user?.id);
  const dceReadyMap = dceReadyQuery.data ?? new Map<string, { viaAgent: boolean }>();
  const tenders = useMemo(() => {
    let items = tendersQuery.data?.items ?? [];
    if (dceReadyFilter) items = items.filter((t) => dceReadyMap.has(t.id));
    if (smartFilter && profile && items.length > 0) {
      return [...items]
        .map((t) => ({ ...t, _score: computeScore(t, profile) }))
        .sort((a, b) => b._score - a._score);
    }
    return items;
  }, [tendersQuery.data, smartFilter, profile, dceReadyFilter, dceReadyMap]);


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
    setPlatformFilter(f.platformFilter ?? "");
    setDceFilter(f.dceFilter ?? false);
    setDceReadyFilter(f.dceReadyFilter ?? false);
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
    const filters = { search, regionFilter, statusFilter, procedureFilter, platformFilter, dceFilter, dceReadyFilter };
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appels d'offres</h1>
          <p className="text-muted-foreground">{totalCount} résultat(s) — page {page + 1}/{totalPages || 1}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Smart filter toggle */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label htmlFor="smart-filter" className="text-sm cursor-pointer whitespace-nowrap">Mon entreprise</Label>
            <Switch id="smart-filter" checked={smartFilter} onCheckedChange={(v) => { setSmartFilter(v); setPage(0); }} />
          </div>
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

      {/* Smart filter indicator */}
      {smartFilter && smartFilterInfo && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Filtré selon votre profil ({smartFilterInfo}) — triés par pertinence</span>
        </div>
      )}
      {smartFilter && profile && !(profile.regions?.length || profile.keywords?.length) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Complétez votre profil (régions, mots-clés) dans Paramètres pour activer le filtrage intelligent.</span>
        </div>
      )}

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
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
              <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Plateforme" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les plateformes</SelectItem>
                  {platforms.map((p) => <SelectItem key={p} value={p}>{formatPlatformLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch id="dce-filter" checked={dceFilter} onCheckedChange={(v) => { setDceFilter(v); setPage(0); }} />
                <Label htmlFor="dce-filter" className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <FileText className="h-4 w-4" /> DCE auto disponible
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="dce-ready-filter" checked={dceReadyFilter} onCheckedChange={(v) => { setDceReadyFilter(v); setPage(0); }} />
                <Label htmlFor="dce-ready-filter" className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> DCE déjà récupéré
                </Label>
              </div>
            </div>
            {listingHosts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Sous-domaine ({listingHosts.length})
                </Label>
                <Select value={listingHostFilter} onValueChange={(v) => { setListingHostFilter(v); setPage(0); }}>
                  <SelectTrigger className="max-w-md"><SelectValue placeholder="Tous les sous-domaines" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les sous-domaines</SelectItem>
                    {listingHosts.map((h) => (
                      <SelectItem key={h.host} value={h.host}>{h.host} ({h.count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 items-center flex-wrap">
              <Input placeholder="Nom de la recherche" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="max-w-xs" />
              <Button variant="secondary" size="sm" onClick={saveSearch} disabled={savingSearch || !searchName.trim()}>
                <Save className="h-4 w-4 mr-1" /> Sauvegarder
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setRegionFilter(""); setStatusFilter(""); setProcedureFilter(""); setPlatformFilter(""); setListingHostFilter(""); setDceFilter(false); setDceReadyFilter(false); setSearch(""); setPage(0); }}>
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
            <p className="text-sm mt-1">
              {smartFilter ? "Essayez de désactiver le filtrage intelligent ou modifiez vos filtres." : "Modifiez vos filtres ou attendez de nouveaux imports."}
            </p>
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
                        {(() => {
                          const isPlaceholder = /^Consultation Atexo \d+$/i.test(tender.title ?? "");
                          return (
                            <h3 className={`font-semibold text-sm sm:text-base truncate ${isPlaceholder ? "text-muted-foreground italic" : "text-foreground"}`}>
                              {isPlaceholder ? "Consultation en cours d'enrichissement…" : tender.title}
                            </h3>
                          );
                        })()}
                        {/^Consultation Atexo \d+$/i.test(tender.title ?? "") && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                            Enrichissement…
                          </Badge>
                        )}
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
                          <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400 gap-1" title={dceReadyMap.get(tender.id)?.viaAgent ? "Récupéré par l'agent IA" : "Uploadé manuellement"}>
                            <CheckCircle2 className="h-3 w-3" /> DCE récupéré
                          </Badge>
                        )}
                      </div>
                      {tender.object && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{tender.object}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {tender.buyer_name && <span className="font-medium">{tender.buyer_name}</span>}
                        {tender.region && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {tender.region}</span>}
                        {tender.estimated_amount && <span className="flex items-center gap-1"><Euro className="h-3 w-3" /> {new Intl.NumberFormat("fr-FR").format(tender.estimated_amount)} €</span>}
                        {tender.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(tender.deadline), "dd MMM yyyy", { locale: fr })}</span>}
                        {(() => {
                          const t: any = tender;
                          const src = t.source as string | undefined;
                          const rawUrl = t.enriched_data?.raw?._source_url as string | undefined;
                          const host = rawUrl ? (() => { try { return new URL(rawUrl).host; } catch { return null; } })() : null;
                          if (!src && !host) return null;
                          return (
                            <span className="flex items-center gap-1.5 text-muted-foreground/80">
                              <Globe className="h-3 w-3" />
                              {src && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{formatPlatformLabel(src)}</Badge>}
                              {host && rawUrl && (
                                <a
                                  href={rawUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-primary inline-flex items-center gap-0.5"
                                  title={rawUrl}
                                >
                                  {host}<ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </span>
                          );
                        })()}
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
