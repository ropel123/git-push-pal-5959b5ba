import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDceSourcing, useClassifyHost } from "@/hooks/queries/useDceSourcing";
import { useReclassifyJob, useStartReclassify } from "@/hooks/queries/useReclassifyJob";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDebounce } from "@/hooks/useDebounce";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ExternalLink, FileText, Sparkles, Loader2, Zap } from "lucide-react";

const KNOWN_CATEGORIES = [
  "atexo", "place", "mpi", "dematis", "achatpublic",
  "marches-securises", "klekoon", "xmarches", "safetender",
  "aws", "synapse", "centrale-marches", "francemarches", "aji",
  "eu-supply", "domino", "bravo", "adullact", "marchesonline",
  "medialex", "autre-mp", "anjou", "inconnu",
];

const normalizeCat = (c: string | null) => {
  if (!c || c === "autre" || c === "inconnu") return "inconnu";
  return c;
};

const categoryColor = (c: string | null) => {
  const n = normalizeCat(c);
  if (n === "inconnu") return "bg-muted text-muted-foreground";
  if (n === "place") return "bg-primary/10 text-primary";
  if (n === "atexo") return "bg-accent/40 text-foreground";
  return "bg-secondary text-secondary-foreground";
};

const Sourcing = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  // Debounce : la RPC ne doit pas être appelée à chaque frappe.
  const debouncedSearch = useDebounce(search, 300);
  // Fetch unfiltered by category so we can show counts everywhere
  const { data: allData, isLoading, isFetching } = useDceSourcing(debouncedSearch, "all");
  const classify = useClassifyHost();
  const startReclassify = useStartReclassify();
  const { data: lastJob } = useReclassifyJob();
  const [pendingHost, setPendingHost] = useState<string | null>(null);

  const counts = useMemo(() => {
    const rows = allData ?? [];
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = normalizeCat(r.category);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [allData]);

  const visibleData = useMemo(() => {
    const rows = allData ?? [];
    if (category === "all") return rows;
    return rows.filter((r) => normalizeCat(r.category) === category);
  }, [allData, category]);

  const kpis = useMemo(() => {
    const rows = allData ?? [];
    const totalHosts = rows.length;
    // "Classés" = hosts dont la catégorie est réellement résolue (comme les pills),
    // et non "un fingerprint existe" — un host étiqueté custom/inconnu ne compte pas.
    const unknown = rows.filter((r) => normalizeCat(r.category) === "inconnu").length;
    const classified = totalHosts - unknown;
    const boamp = rows.reduce((s, r) => s + Number(r.boamp_count), 0);
    const ted = rows.reduce((s, r) => s + Number(r.ted_count), 0);
    return { totalHosts, classified, unknown, boamp, ted };
  }, [allData]);

  const jobRunning = lastJob?.status === "running";
  const jobPct = lastJob && lastJob.total > 0
    ? Math.round((lastJob.processed / lastJob.total) * 100)
    : 0;

  const handleClassify = async (host: string, url: string) => {
    setPendingHost(host);
    try {
      const res = await classify.mutateAsync({ host, sample_url: url });
      toast.success(`${host} → ${res.platform} (${Math.round(res.confidence * 100)}%)`);
    } catch (e: any) {
      toast.error(e.message ?? "Échec de la classification");
    } finally {
      setPendingHost(null);
    }
  };

  const handleStartReclassify = async () => {
    try {
      const res = await startReclassify.mutateAsync();
      toast.success(`Reclassification lancée sur ${res.total} hosts`);
    } catch (e: any) {
      toast.error(e.message ?? "Échec du lancement");
    }
  };

  if (adminLoading) return null;
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-12 text-center text-muted-foreground">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sourcing DCE</h1>
          <p className="text-muted-foreground text-sm">
            URLs DCE issues des appels d'offres BOAMP &amp; TED, regroupées par plateforme détectée.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={jobRunning || startReclassify.isPending}>
              {jobRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  En cours…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Reclassifier tous ({kpis.totalHosts})
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reclassifier tous les hosts ?</AlertDialogTitle>
              <AlertDialogDescription>
                L'IA va analyser les {kpis.totalHosts} hosts et écraser
                les fingerprints existants. Durée estimée : 6-10 min.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartReclassify}>
                Lancer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {lastJob && (jobRunning || jobPct < 100) && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {jobRunning ? "Reclassification en cours…" : "Dernier job"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {lastJob.processed} / {lastJob.total} ({jobPct}%) ·{" "}
                {lastJob.classified} classés
              </span>
            </div>
            <Progress value={jobPct} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Hosts" value={kpis.totalHosts} />
        <KpiCard label="Classés" value={kpis.classified} />
        <KpiCard label="Inconnus" value={kpis.unknown} />
        <KpiCard label="Tenders BOAMP" value={kpis.boamp} />
        <KpiCard label="Tenders TED" value={kpis.ted} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <CategoryPill
          label="all"
          count={kpis.totalHosts}
          active={category === "all"}
          onClick={() => setCategory("all")}
        />
        {KNOWN_CATEGORIES.filter((c) => counts.get(c)).map((c) => (
          <CategoryPill
            key={c}
            label={c}
            count={counts.get(c) ?? 0}
            active={category === c}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Rechercher un host…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:max-w-xs">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Toutes les catégories ({kpis.totalHosts})
              </SelectItem>
              {KNOWN_CATEGORIES.filter((c) => counts.get(c)).map((c) => (
                <SelectItem key={c} value={c}>
                  {c} ({counts.get(c)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Hosts ({visibleData.length})
          </CardTitle>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Source FP</TableHead>
                <TableHead className="text-right">BOAMP</TableHead>
                <TableHead className="text-right">TED</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && visibleData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun host trouvé.
                  </TableCell>
                </TableRow>
              )}
              {visibleData.map((row) => (
                <TableRow key={row.host}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      to={`/sourcing/${encodeURIComponent(row.host)}`}
                      className="hover:text-primary hover:underline"
                      title="Voir tous les AO de ce host"
                    >
                      {row.host}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={categoryColor(row.category)} variant="secondary">
                      {row.category ?? "inconnu"}
                    </Badge>
                    {row.platform && row.platform !== row.category && (
                      <span className="ml-2 text-xs text-muted-foreground">{row.platform}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.fingerprint_source ? (
                      <Badge variant="outline" className="text-xs">
                        {row.fingerprint_source}
                        {row.confidence ? ` · ${Math.round(Number(row.confidence) * 100)}%` : ""}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.boamp_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.ted_count}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.total_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {row.sample_dce_url && (
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={row.sample_dce_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ouvrir la plateforme"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {row.sample_tender_id && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            to={`/tenders/${row.sample_tender_id}`}
                            title="Voir un AO d'exemple"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                      {!row.platform && row.sample_dce_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingHost === row.host}
                          onClick={() => handleClassify(row.host, row.sample_dce_url!)}
                        >
                          {pendingHost === row.host ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 mr-1" />
                              Classifier
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const KpiCard = ({ label, value }: { label: string; value: number }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString("fr-FR")}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </CardContent>
  </Card>
);

const CategoryPill = ({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background hover:bg-muted border-border"
    }`}
  >
    <span className="font-medium">{label}</span>
    <span className={`ml-1.5 tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
      {count}
    </span>
  </button>
);

export default Sourcing;
