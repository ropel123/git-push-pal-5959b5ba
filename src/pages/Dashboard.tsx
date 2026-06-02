import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Search,
  Bell,
  ArrowUpRight,
  Bookmark,
  GraduationCap,
  FileText,
  Calendar as CalendarIcon,
  Newspaper,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  usePipelineDistribution,
  useUrgentTenders,
} from "@/hooks/queries/useDashboard";
import { useSavedSearches } from "@/hooks/queries/useSavedSearches";
import { useAlerts } from "@/hooks/queries/useAlerts";

const STAGE_LABELS: Record<string, string> = {
  spotted: "Repéré",
  analyzing: "En analyse",
  no_go: "No Go",
  responding: "En réponse",
  won: "Gagné",
  lost: "Perdu",
};

// Couleurs liées aux tokens HackAO (HSL via CSS vars)
const STAGE_COLOR_VARS = [
  "hsl(var(--accent))",
  "hsl(var(--accent-soft))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(224 60% 35%)",
  "hsl(142 55% 45%)",
  "hsl(var(--muted-foreground))",
];

const NEWS = [
  {
    title: "La transition écologique au cœur des marchés publics français",
    excerpt:
      "Le paysage des marchés publics en France subit une transformation profonde, ancrée dans l'urgence écologique et la lutte contre le changement climatique.",
    date: "27/10/2025",
  },
  {
    title:
      "Naviguer avec succès dans les marchés publics : les pièges à éviter",
    excerpt:
      "Dans le paysage complexe des marchés publics français, décrocher un contrat peut être un véritable défi pour les entreprises les plus aguerries.",
    date: "26/10/2025",
  },
  {
    title:
      "L'impact de la crise sur les marchés publics français : analyse sectorielle",
    excerpt:
      "En tant qu'expert en marchés publics, il est essentiel d'examiner les répercussions géopolitiques majeures sur les appels d'offres.",
    date: "20/10/2025",
  },
];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

  const { data: distributionRaw } = usePipelineDistribution(user?.id);
  const { data: urgentTenders = [] } = useUrgentTenders();
  const { data: savedSearches = [] } = useSavedSearches(user?.id, 6);
  const { data: alerts = [] } = useAlerts(user?.id);

  const firstName = useMemo(() => {
    const meta = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];
    if (meta) return meta;
    return user?.email?.split("@")[0] ?? "";
  }, [user]);

  const pipelineDistribution = useMemo(() => {
    const entries = Object.entries(distributionRaw ?? {}).map(([k, v]) => ({
      name: STAGE_LABELS[k] ?? k,
      value: v as number,
    }));
    return entries;
  }, [distributionRaw]);

  const totalFav = pipelineDistribution.reduce((s, d) => s + d.value, 0);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/tenders${searchQ ? `?q=${encodeURIComponent(searchQ)}` : ""}`);
  };

  const recentAlerts = alerts.slice(0, 7);

  const deadlineDays = useMemo(
    () => urgentTenders.filter((t) => t.deadline).map((t) => parseISO(t.deadline!)),
    [urgentTenders],
  );

  const eventsOfSelectedDay = useMemo(() => {
    if (!selectedDay) return [];
    return urgentTenders.filter(
      (t) => t.deadline && isSameDay(parseISO(t.deadline), selectedDay),
    );
  }, [urgentTenders, selectedDay]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Hero greeting */}
      <Card
        className="relative overflow-hidden border-border rounded-2xl p-6 md:p-10"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.10] pointer-events-none"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "hsl(var(--accent))" }} />
        <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full opacity-15 blur-3xl"
          style={{ background: "hsl(var(--accent-soft))" }} />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Bonjour <span className="text-gradient-brand">{firstName}</span>&nbsp;!
            </h1>
            <p className="mt-2 text-muted-foreground">
              Voici un aperçu de votre activité sur HackAO.
            </p>
          </div>

          <form
            onSubmit={submitSearch}
            className="w-full md:w-[420px] relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Rechercher un appel d'offres…"
              className="pl-11 pr-24 h-12 rounded-xl bg-card border-border"
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg"
            >
              Chercher
            </Button>
          </form>
        </div>
      </Card>

      {/* Alertes + Favoris */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="rounded-2xl border-border p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-accent" />
              <h2 className="text-base font-semibold text-foreground">Mes dernières alertes reçues</h2>
            </div>
            <button
              onClick={() => navigate("/settings")}
              className="text-muted-foreground hover:text-accent transition-colors"
              aria-label="Voir toutes les alertes"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          {recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune alerte configurée. Créez-en une depuis vos paramètres.
            </p>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {recentAlerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("/tenders")}
                  className="text-left rounded-xl border border-border bg-background hover:bg-muted transition-colors p-3 group"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {a.frequency ?? "—"}
                  </div>
                  <div className="text-sm font-medium text-foreground line-clamp-2 mb-2">
                    {a.name}
                  </div>
                  <span className="inline-block text-[11px] font-medium text-accent bg-accent/10 rounded-full px-2 py-0.5">
                    0 non lus
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border-border p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-accent" />
              <h2 className="text-base font-semibold text-foreground">Mes favoris</h2>
            </div>
            <button
              onClick={() => navigate("/pipeline")}
              className="text-muted-foreground hover:text-accent transition-colors"
              aria-label="Voir le pipeline"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          {pipelineDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ajoutez des AO à votre pipeline.
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pipelineDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                      stroke="hsl(var(--card))"
                    >
                      {pipelineDistribution.map((_, i) => (
                        <Cell key={i} fill={STAGE_COLOR_VARS[i % STAGE_COLOR_VARS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-foreground leading-none">{totalFav}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">favoris</span>
                </div>
              </div>

              <ul className="flex-1 space-y-1.5 text-sm">
                {pipelineDistribution.map((d, i) => {
                  const pct = totalFav ? Math.round((d.value / totalFav) * 100) : 0;
                  return (
                    <li key={d.name} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: STAGE_COLOR_VARS[i % STAGE_COLOR_VARS.length] }}
                      />
                      <span className="text-foreground truncate flex-1">{d.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {d.value} · {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* Mes profils */}
      <Card className="rounded-2xl border-border p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Mes profils</h2>
          </div>
          <button
            onClick={() => navigate("/tenders")}
            className="text-muted-foreground hover:text-accent transition-colors"
            aria-label="Toutes les recherches"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {savedSearches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sauvegardez une recherche pour la retrouver ici.
          </p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {savedSearches.map((s, i) => {
              const isAccent = i % 2 === 0;
              const category = (s.filters?.category as string | undefined) ?? "Tous secteurs";
              return (
                <button
                  key={s.id}
                  onClick={() => navigate("/tenders")}
                  className="group rounded-xl border border-border bg-background hover:bg-muted transition-colors p-4 flex flex-col items-center text-center"
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center mb-2"
                    style={{
                      background: isAccent ? "hsl(var(--accent) / 0.12)" : "hsl(var(--accent-soft) / 0.35)",
                    }}
                  >
                    <FileText
                      className="h-5 w-5"
                      style={{ color: isAccent ? "hsl(var(--accent))" : "hsl(var(--primary))" }}
                    />
                  </div>
                  <div className="text-sm font-medium text-foreground line-clamp-1">{s.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{category}</div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Calendrier + Actualité */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-border p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="h-4 w-4 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Calendrier</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={setSelectedDay}
              locale={fr}
              modifiers={{ hasEvent: deadlineDays }}
              modifiersClassNames={{
                hasEvent: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-accent",
              }}
              className="rounded-xl border border-border bg-background"
            />

            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground mb-2">
                {selectedDay
                  ? format(selectedDay, "EEEE d MMMM yyyy", { locale: fr })
                  : "—"}{" "}
                <span className="text-muted-foreground">
                  ({eventsOfSelectedDay.length} évènement{eventsOfSelectedDay.length > 1 ? "s" : ""})
                </span>
              </div>

              {eventsOfSelectedDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune deadline ce jour.</p>
              ) : (
                <ul className="space-y-2">
                  {eventsOfSelectedDay.map((t) => (
                    <li
                      key={t.id}
                      onClick={() => navigate(`/tenders/${t.id}`)}
                      className="rounded-lg border border-border bg-background hover:bg-muted transition-colors p-3 cursor-pointer"
                    >
                      <div className="text-sm font-medium text-foreground line-clamp-2">{t.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Réception : {format(parseISO(t.deadline!), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="h-4 w-4 text-accent" />
            <h2 className="text-base font-semibold text-foreground">L'actualité des marchés publics</h2>
          </div>
          <ul className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {NEWS.map((n) => (
              <li key={n.title} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
                <h3 className="text-sm font-semibold text-foreground hover:text-accent transition-colors cursor-pointer">
                  {n.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{n.excerpt}</p>
                <div className="text-[11px] text-muted-foreground mt-2">{n.date}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
