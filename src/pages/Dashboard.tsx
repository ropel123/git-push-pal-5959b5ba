import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Kanban, Trophy, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTenders: 0,
    pipelineItems: 0,
    wonItems: 0,
    openTenders: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [tendersRes, pipelineRes, wonRes, openRes] = await Promise.all([
        supabase.from("tenders").select("id", { count: "exact", head: true }),
        supabase.from("pipeline_items").select("id", { count: "exact", head: true }).eq("user_id", user?.id),
        supabase.from("pipeline_items").select("id", { count: "exact", head: true }).eq("user_id", user?.id).eq("stage", "won"),
        supabase.from("tenders").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      setStats({
        totalTenders: tendersRes.count ?? 0,
        pipelineItems: pipelineRes.count ?? 0,
        wonItems: wonRes.count ?? 0,
        openTenders: openRes.count ?? 0,
      });
    };
    if (user) fetchStats();
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className={`bg-card border-border ${card.onClick ? "cursor-pointer hover:border-primary/30 transition-colors" : ""}`}
            onClick={card.onClick}
          >
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

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Démarrage rapide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-muted-foreground">
          <p>👋 Bienvenue sur votre plateforme de veille appels d'offres.</p>
          <p>Pour commencer, rendez-vous dans <button onClick={() => navigate("/settings")} className="text-primary hover:underline">Paramètres</button> pour configurer vos préférences de veille (secteurs, zones géographiques, mots-clés).</p>
          <p>Ensuite, explorez les <button onClick={() => navigate("/tenders")} className="text-primary hover:underline">appels d'offres</button> et ajoutez-les à votre pipeline.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
