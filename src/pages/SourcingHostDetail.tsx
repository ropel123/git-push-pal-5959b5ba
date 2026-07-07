import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTendersByHost } from "@/hooks/queries/useTendersByHost";
import { useHostFingerprint } from "@/hooks/queries/useHostFingerprint";
import { useClassifyHost } from "@/hooks/queries/useDceSourcing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, FileText, Sparkles, Loader2 } from "lucide-react";
import { categoryColor } from "@/lib/sourcing";
import { toast } from "sonner";

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("fr-FR") : "—";

const SourcingHostDetail = () => {
  const { host: rawHost } = useParams<{ host: string }>();
  const host = rawHost ? decodeURIComponent(rawHost) : "";
  const { data, isLoading } = useTendersByHost(host);
  const { data: fp } = useHostFingerprint(host);
  const classify = useClassifyHost();
  const [classifying, setClassifying] = useState(false);

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      boamp: rows.filter((r) => r.source === "BOAMP").length,
      ted: rows.filter((r) => r.source === "TED").length,
    };
  }, [data]);

  const sampleDceUrl = data?.[0]?.dce_url ?? null;

  const handleClassify = async () => {
    if (!sampleDceUrl) return;
    setClassifying(true);
    try {
      const res = await classify.mutateAsync({ host, sample_url: sampleDceUrl });
      toast.success(`${host} → ${res.platform} (${Math.round(res.confidence * 100)}%)`);
    } catch (e: any) {
      toast.error(e.message ?? "Échec de la classification");
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link to="/sourcing">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour au sourcing
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold font-mono">{host}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tous les appels d'offres associés à ce host.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Badge className={categoryColor(fp?.category)} variant="secondary">
            {fp?.category ?? "inconnu"}
          </Badge>
          {fp?.platform && fp.platform !== fp.category && (
            <span className="text-xs text-muted-foreground">
              platform: <span className="font-mono">{fp.platform}</span>
            </span>
          )}
          {fp?.fingerprint_source ? (
            <Badge variant="outline" className="text-xs">
              FP: {fp.fingerprint_source}
              {fp.confidence ? ` · ${Math.round(Number(fp.confidence) * 100)}%` : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Non classifié
            </Badge>
          )}
          {fp?.last_seen_at && (
            <span className="text-xs text-muted-foreground">
              · détecté le {fmtDate(fp.last_seen_at)}
            </span>
          )}
          {!fp?.platform && sampleDceUrl && (
            <Button size="sm" variant="outline" disabled={classifying} onClick={handleClassify}>
              {classifying ? (
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
      </div>


      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total AO" value={stats.total} />
        <Stat label="BOAMP" value={stats.boamp} />
        <Stat label="TED" value={stats.ted} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Appels d'offres ({stats.total})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Acheteur</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Publié</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    Aucun AO trouvé pour ce host.
                  </TableCell>
                </TableRow>
              )}
              {data?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-md">
                    <Link
                      to={`/tenders/${row.id}`}
                      className="font-medium hover:underline line-clamp-2"
                    >
                      {row.title}
                    </Link>
                    {row.reference && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {row.reference}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.buyer_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {row.source ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {fmtDate(row.publication_date)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {fmtDate(row.deadline)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {row.dce_url && (
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={row.dce_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ouvrir le DCE"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/tenders/${row.id}`} title="Voir l'AO">
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
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

const Stat = ({ label, value }: { label: string; value: number }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="text-2xl font-semibold tabular-nums">
        {value.toLocaleString("fr-FR")}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </CardContent>
  </Card>
);

export default SourcingHostDetail;
