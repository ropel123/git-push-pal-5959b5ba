import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Bell, ArrowUpRight, Bookmark, BarChart3, Newspaper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  usePipelineDistribution,
  useRecentPipeline,
} from "@/hooks/queries/useDashboard";
import { useAlerts } from "@/hooks/queries/useAlerts";

/* ── Étapes du pipeline (ordre + couleurs du prototype « nouveau design ») ── */
const STAGES = [
  { key: "spotted", name: "Repéré", donut: "#2563EB", col: "#2563EB" },
  { key: "analyzing", name: "En analyse", donut: "#818CF8", col: "#818CF8" },
  { key: "responding", name: "En réponse", donut: "#7C3AED", col: "#7C3AED" },
  { key: "won", name: "Gagné", donut: "#16A34A", col: "#16A34A" },
  { key: "lost", name: "Perdu", donut: "#D1D5DB", col: "#9CA3AF" },
] as const;

const NEWS = [
  {
    title: "La transition écologique au cœur des marchés publics français",
    excerpt:
      "Le paysage des marchés publics en France subit une transformation profonde, ancrée dans l'urgence écologique et la lutte contre le changement climatique.",
    date: "27/10/2025",
  },
  {
    title: "Naviguer avec succès dans les marchés publics : les pièges à éviter",
    excerpt:
      "Dans le paysage complexe des marchés publics français, décrocher un contrat peut être un véritable défi pour les entreprises les plus aguerries.",
    date: "26/10/2025",
  },
  {
    title: "L'impact de la crise sur les marchés publics : analyse sectorielle",
    excerpt:
      "En tant qu'expert en marchés publics, il est essentiel d'examiner les répercussions géopolitiques majeures sur les appels d'offres.",
    date: "20/10/2025",
  },
];

const R = 48;
const CIRC = 2 * Math.PI * R; // ≈ 301.6

type PipeItem = {
  id: string;
  stage?: string | null;
  tender_id?: string | null;
  tenders?: { title?: string | null } | null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");

  const { data: distributionRaw } = usePipelineDistribution(user?.id);
  const { data: recentPipeline = [] } = useRecentPipeline(user?.id);
  const { data: alerts = [] } = useAlerts(user?.id);

  const firstName = useMemo(() => {
    const meta = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];
    if (meta) return meta;
    return user?.email?.split("@")[0] ?? "Romain";
  }, [user]);

  const distribution = useMemo(() => {
    const raw = distributionRaw ?? {};
    return STAGES.map((s) => ({ ...s, value: (raw[s.key] as number) ?? 0 }));
  }, [distributionRaw]);

  const totalFav = distribution.reduce((s, d) => s + d.value, 0);

  /* Segments du donut calculés à partir des vraies données */
  const segments = useMemo(() => {
    let offset = 0;
    return distribution
      .filter((d) => d.value > 0)
      .map((d) => {
        const dash = totalFav ? (d.value / totalFav) * CIRC : 0;
        const seg = { color: d.donut, dash, offset: -offset };
        offset += dash;
        return seg;
      });
  }, [distribution, totalFav]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/tenders${searchQ ? `?q=${encodeURIComponent(searchQ)}` : ""}`);
  };

  const recentAlerts = alerts.slice(0, 4);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      {/* ═════ Greeting ═════ */}
      <section
        className="hao-anim-in relative overflow-hidden rounded-[20px] border border-border bg-card px-8 py-8 md:px-9 shadow-sm"
        style={{ animation: "hao-in 0.6s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <span
          className="hao-anim-blob pointer-events-none absolute -right-16 -top-24 h-[280px] w-[280px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(37,99,235,0.12), transparent 65%)",
            filter: "blur(20px)",
            animation: "hao-blob 14s ease-in-out infinite",
          }}
        />
        <span
          className="pointer-events-none absolute -bottom-28 -left-20 h-[280px] w-[280px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.09), transparent 65%)", filter: "blur(20px)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-extrabold leading-tight text-foreground" style={{ letterSpacing: "-0.03em" }}>
              Bonjour{" "}
              <span
                style={{
                  background: "linear-gradient(100deg, #2563EB, #4F46E5 50%, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                {firstName}
              </span>
              &nbsp;!
            </h1>
            <p className="mt-1.5 text-[14.5px] text-muted-foreground">
              Voici un aperçu de votre activité sur HackAO.
            </p>
          </div>

          <form onSubmit={submitSearch} className="relative w-full max-w-full md:w-[400px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Rechercher un appel d'offres…"
              className="h-12 w-full rounded-[13px] border border-border bg-background pl-[42px] pr-[130px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[9px] px-[18px] py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-[calc(50%+1px)]"
              style={{
                background: "linear-gradient(135deg, #2563EB, #4F46E5)",
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
              }}
            >
              Chercher
            </button>
          </form>
        </div>
      </section>


      {/* ═════ Alertes + Favoris ═════ */}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Alertes */}
        <Panel delay="0.08s">
          <PanelHeader
            icon={<Bell className="h-[14px] w-[14px]" style={{ color: "#2563EB" }} />}
            iconBg="rgba(37,99,235,0.08)"
            title="Mes dernières alertes reçues"
            onExpand={() => navigate("/alerts")}
          />
          {recentAlerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6B7280]">
              Aucune alerte configurée. Créez-en une depuis vos paramètres.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {recentAlerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("/tenders")}
                  className="group rounded-[14px] border border-black/[0.06] bg-[#F8FAFC] p-[13px_14px] text-left transition-all [transition-duration:250ms] hover:-translate-y-[3px] hover:border-[#2563EB]/25"
                  style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 10px 24px rgba(17,24,39,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
                    {a.frequency ?? "—"}
                  </div>
                  <div className="mb-[9px] line-clamp-2 text-[13px] font-semibold leading-[1.35]">
                    {a.name}
                  </div>
                  <span className="inline-block rounded-full bg-[#F3F4F6] px-[9px] py-[3px] text-[11px] font-bold text-[#6B7280]">
                    0 non lu
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* Favoris */}
        <Panel delay="0.16s">
          <PanelHeader
            icon={<Bookmark className="h-[14px] w-[14px]" style={{ color: "#7C3AED" }} />}
            iconBg="rgba(124,58,237,0.08)"
            title="Mes favoris"
            onExpand={() => navigate("/pipeline")}
          />
          {totalFav === 0 ? (
            <p className="py-8 text-center text-sm text-[#6B7280]">Ajoutez des AO à votre pipeline.</p>
          ) : (
            <div className="flex items-center gap-[18px]">
              <div className="relative h-[124px] w-[124px] flex-shrink-0">
                <svg width="124" height="124" viewBox="0 0 124 124" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="62" cy="62" r={R} fill="none" stroke="#EEF2F7" strokeWidth="16" />
                  {segments.map((s, i) => (
                    <circle
                      key={i}
                      cx="62"
                      cy="62"
                      r={R}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="16"
                      strokeDasharray={`${s.dash} ${CIRC}`}
                      strokeDashoffset={s.offset}
                      style={{ animation: "hao-donut 1.4s cubic-bezier(0.22,1,0.36,1)" }}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold leading-none">{totalFav}</span>
                  <span className="mt-[3px] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
                    favoris
                  </span>
                </div>
              </div>
              <ul className="flex flex-1 flex-col gap-[7px] text-[13px]">
                {distribution
                  .filter((d) => d.value > 0)
                  .map((d) => {
                    const pct = totalFav ? Math.round((d.value / totalFav) * 100) : 0;
                    return (
                      <li key={d.key} className="flex items-center gap-2">
                        <span className="h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ background: d.donut }} />
                        <span className="flex-1 truncate">{d.name}</span>
                        <span className="tabular-nums text-[#6B7280]">
                          {d.value} · {pct}%
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* ═════ Pipeline + Actualité ═════ */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Pipeline */}
        <Panel delay="0.24s">
          <PanelHeader
            icon={<BarChart3 className="h-[14px] w-[14px]" style={{ color: "#2563EB" }} />}
            iconBg="rgba(37,99,235,0.08)"
            title="Mon pipeline"
            onExpand={() => navigate("/pipeline")}
          />
          {totalFav === 0 ? (
            <p className="py-8 text-center text-sm text-[#6B7280]">
              Aucun AO dans votre pipeline. Ajoutez-en depuis la recherche.
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-2.5">
              {distribution.map((s) => {
                const items = (recentPipeline as PipeItem[]).filter((p) => (p.stage ?? "spotted") === s.key);
                return (
                  <div
                    key={s.key}
                    className="flex min-h-[150px] flex-col gap-2 rounded-xl border border-black/[0.06] bg-[#F8FAFC] p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[9.5px] font-bold uppercase tracking-[0.07em]"
                        style={{ color: s.col }}
                      >
                        {s.name}
                      </span>
                      <span className="text-[10px] tabular-nums text-[#9CA3AF]">{s.value}</span>
                    </div>
                    {items.slice(0, 2).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(`/tenders/${item.tender_id}`)}
                        className="rounded-[9px] border border-black/[0.07] bg-white p-[8px_9px] text-left text-[11px] font-medium leading-[1.35] transition-all duration-200 hover:-translate-y-px hover:border-[#2563EB]/40"
                      >
                        <span className="line-clamp-2">{item.tenders?.title ?? "AO"}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Actualité */}
        <Panel delay="0.32s">
          <div className="mb-4 flex items-center gap-[9px]">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-[9px]"
              style={{ background: "rgba(79,70,229,0.08)" }}
            >
              <Newspaper className="h-[14px] w-[14px]" style={{ color: "#4F46E5" }} />
            </span>
            <span className="text-[15px] font-bold">L'actualité des marchés publics</span>
          </div>
          <div className="flex flex-col">
            {NEWS.map((n) => (
              <div key={n.title} className="cursor-pointer border-b border-black/[0.05] px-0.5 py-[13px] last:border-b-0">
                <div className="text-[13.5px] font-semibold leading-[1.4] transition-colors hover:text-[#2563EB]">
                  {n.title}
                </div>
                <div className="mt-1 line-clamp-2 text-xs leading-[1.55] text-[#6B7280]">{n.excerpt}</div>
                <div className="mt-1.5 text-[11px] text-[#9CA3AF]">{n.date}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};

/* ── Carte blanche réutilisable (radius 20, ombre douce, entrée animée) ── */
function Panel({ children, delay }: { children: React.ReactNode; delay: string }) {
  return (
    <section
      className="hao-anim-in rounded-[20px] border border-black/[0.06] bg-white p-[22px_24px]"
      style={{
        boxShadow: "0 2px 8px rgba(17,24,39,0.04)",
        animation: `hao-in 0.6s cubic-bezier(0.22,1,0.36,1) ${delay} both`,
      }}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  icon,
  iconBg,
  title,
  onExpand,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  onExpand: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-[9px]">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: iconBg }}>
          {icon}
        </span>
        <span className="text-[15px] font-bold">{title}</span>
      </div>
      <button
        onClick={onExpand}
        aria-label={title}
        className="text-[#9CA3AF] transition-colors hover:text-[#2563EB]"
      >
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default Dashboard;
