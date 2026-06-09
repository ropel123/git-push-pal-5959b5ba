import { usePlatformStatus } from "@/hooks/queries/usePlatformStatus";
import { Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const labelMap: Record<string, string> = {
  mpi: "MPI",
  aws: "AWS Achat",
  place: "PLACE",
  aura: "AURA",
  atexo: "Atexo",
  pradomarchespublics: "Prado",
};

const dotColor = (s: "success" | "stale" | "error") =>
  s === "success" ? "bg-emerald-500" : s === "stale" ? "bg-amber-500" : "bg-rose-500";

export default function PlatformStatusPanel() {
  const { data = [], isLoading } = usePlatformStatus();

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-3.5 w-3.5 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sources actives
        </h3>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune source configurée.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((p) => (
            <li key={p.platform} className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor(p.worstStatus)}`} />
              <span className="font-medium text-foreground flex-1 truncate">
                {labelMap[p.platform] ?? p.platform}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {p.ok}/{p.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
        Vert : à jour · Ambre : &gt; 48h · Rouge : en erreur
      </p>
    </div>
  );
}
