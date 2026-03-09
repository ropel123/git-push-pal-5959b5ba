import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Kanban, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const STAGE_LABELS: Record<string, string> = {
  spotted: "Repéré",
  analyzing: "En analyse",
  no_go: "No Go",
  responding: "En réponse",
  won: "Gagné",
  lost: "Perdu",
};

const STAGE_COLORS = ["hsl(217,91%,60%)", "hsl(45,93%,47%)", "hsl(0,84%,60%)", "hsl(271,91%,65%)", "hsl(142,71%,45%)", "hsl(0,0%,45%)"];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalTenders: 0, pipelineItems: 0, wonItems: 0, openTenders: 0 });
  const [monthlyData, setMonthlyData] = useState<{ month: string; count: number }[]>([]);
  const [pipelineDistribution, setPipelineDistribution] = useState<{ name: string; value: number }[]>([]);
  const [recentPipeline, setRecentPipeline] = useState<any[]>([]);
  const [urgentTenders, setUrgentTenders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch stats
    Promise.all([
      supabase.from("tenders").select("id", { count: "exact", head: true }),
      supabase.from("pipeline_items").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("pipeline_items").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("stage", "won"),
      supabase.from("tenders").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]).then(([t, p, w, o]) => {
      setStats({ totalTenders: t.count ?? 0, pipelineItems: p.count ?? 0, wonItems: w.count ?? 0, openTenders: o.count ?? 0 });
    });

    // Monthly tenders chart
    supabase.from("tenders").select("publication_date").not("publication_date", "is", null).then(({ data }) => {
      if (!data) return;
      const counts: Record<string, number> = {};
      data.forEach((t) => {
        const m = format(new Date(t.publication_date!), "yyyy-MM");
        counts[m] = (counts[m] ?? 0) + 1;
      });
      const sorted = Object.entries(counts).sort().slice(-6);
      setMonthlyData(sorted.map(([m, c]) => ({ month: format(new Date(m + "-01"), "MMM yy", { locale: fr }), count: c })));
    });

    // Pipeline distribution
    supabase.from("pipeline_items").select("stage").eq("user_id", user.id).then(({ data }) => {
      if (!data) return;
      const counts: Record<string, number> = {};
      data.forEach((i) => { const s = i.stage ?? "spotted"; counts[s] = (counts[s] ?? 0) + 1; });
      setPipelineDistribution(Object.entries(counts).map(([k, v]) => ({ name: STAGE_LABELS[k] ?? k, value: v })));
    });

    // Recent pipeline items
    supabase.from("pipeline_items").select("*, tenders(title, deadline)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5).then(({ data }) => {
      if (data) setRecentPipeline(data);
    });

    // Urgent tenders (deadline < 7 days)
    supabase.from("tenders").select("id, title, deadline").eq("status", "open").not("deadline", "is", null).then(({ data }) => {
      if (!data) return;
      const now = new Date();
      const urgent = data.filter((t) => {
        const days = differenceInDays(new Date(t.deadline!), now);
        return days >= 0 && days <= 7;
      }).slice(0, 5);
      setUrgentTenders(urgent);
    });
  }, [user]);

  const cards = [
    { title: "AO disponibles", value: stats.openTenders, icon: Search, color: "text-primary", onClick: () => navigate("/tenders") },
    { title: "Dans le pipeline", value: stats.pipelineItems, icon: Kanban, color: "text-blue-400", onClick: () => navigate("/pipeline") },
    { title: "AO gagnés", value: stats.wonItems, icon: Trophy, color: "text-green-400", onClick: () => navigate("/pipeline") },
    { title: "Total AO référencés", value: stats.totalTenders, icon: TrendingUp, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className={`bg-card border-border ${card.onClick ? "cursor-pointer hover:border-primary/30 transition-colors" : ""}`} onClick={card.onClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">AO par mois</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Répartition pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pipelineDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                    {pipelineDistribution.map((_, i) => (
                      <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Ajoutez des AO au pipeline</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Urgent + Recent */}
      <div className="grid gap-4 md:grid-cols-2">
        {urgentTenders.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" /> Deadlines proches (&lt; 7j)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {urgentTenders.map((t) => (
                <div key={t.id} className="flex justify-between items-center p-2 rounded-md bg-secondary/50 text-sm cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => navigate(`/tenders/${t.id}`)}>
                  <span className="text-foreground truncate flex-1">{t.title}</span>
                  <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ml-2 shrink-0">
                    {format(new Date(t.deadline), "dd MMM", { locale: fr })}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Derniers ajouts au pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPipeline.length > 0 ? recentPipeline.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-2 rounded-md bg-secondary/50 text-sm">
                <span className="text-foreground truncate flex-1">{item.tenders?.title ?? "—"}</span>
                <Badge variant="secondary" className="ml-2 shrink-0">{STAGE_LABELS[item.stage] ?? item.stage}</Badge>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun élément</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
