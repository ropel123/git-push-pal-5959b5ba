import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Bot, Play, RefreshCw, Lock, BookOpen, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Run = {
  id: string;
  platform: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  captchas_solved: number | null;
  files_downloaded: number | null;
  error_message: string | null;
  tender_id: string | null;
};

type Robot = {
  id: string;
  platform: string;
  login: string;
  password_encrypted: string;
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_used_at: string | null;
};

type Playbook = {
  id: string;
  platform: string;
  display_name: string;
  url_pattern: string;
  requires_auth: boolean;
  requires_captcha: boolean;
  steps: any;
  is_active: boolean;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    success: "bg-green-500/20 text-green-400",
    running: "bg-blue-500/20 text-blue-400",
    pending: "bg-muted text-muted-foreground",
    failed: "bg-red-500/20 text-red-400",
    no_files: "bg-yellow-500/20 text-yellow-400",
  };
  return map[s] ?? "bg-muted";
};

const AgentMonitor = () => {
  const { toast } = useToast();
  const [runs, setRuns] = useState<Run[]>([]);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [testUrl, setTestUrl] = useState("");
  const [testing, setTesting] = useState(false);

  // New robot form
  const [newRobot, setNewRobot] = useState({ platform: "", login: "", password: "" });

  const loadAll = async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("platform_robots").select("*").order("platform"),
      supabase.from("agent_playbooks").select("*").order("platform"),
    ]);
    if (r1.data) setRuns(r1.data as Run[]);
    if (r2.data) setRobots(r2.data as Robot[]);
    if (r3.data) setPlaybooks(r3.data as Playbook[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // Realtime
    const chan = supabase
      .channel("agent_runs_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, []);

  const runTest = async () => {
    if (!testUrl) return;
    setTesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("fetch-dce-agent", {
        body: { tender_id: "00000000-0000-0000-0000-000000000000", dce_url: testUrl, triggered_by: user?.id },
      });
      if (error) throw error;
      toast({ title: "Test lancé", description: `Run ${data?.run_id ?? "?"}` });
      loadAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const addRobot = async () => {
    if (!newRobot.platform || !newRobot.login || !newRobot.password) return;
    const { error } = await supabase.from("platform_robots").insert({
      platform: newRobot.platform,
      login: newRobot.login,
      password_encrypted: newRobot.password, // TODO: chiffrer côté serveur
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Robot ajouté" });
    setNewRobot({ platform: "", login: "", password: "" });
    loadAll();
  };

  const deleteRobot = async (id: string) => {
    await supabase.from("platform_robots").delete().eq("id", id);
    loadAll();
  };

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" /> Agent Monitor
          </h1>
          <p className="text-muted-foreground text-sm">Pilotage de l'agent IA navigateur (Browserbase + 2Captcha)</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Rafraîchir
        </Button>
      </div>

      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
          <TabsTrigger value="robots">Comptes robots ({robots.length})</TabsTrigger>
          <TabsTrigger value="playbooks">Playbooks ({playbooks.length})</TabsTrigger>
          <TabsTrigger value="test">Tester une URL</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Derniers runs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Captchas</TableHead>
                    <TableHead>Fichiers</TableHead>
                    <TableHead>Coût</TableHead>
                    <TableHead>Erreur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{format(new Date(r.started_at), "dd/MM HH:mm:ss", { locale: fr })}</TableCell>
                      <TableCell><Badge variant="outline">{r.platform}</Badge></TableCell>
                      <TableCell><Badge className={statusBadge(r.status)}>{r.status}</Badge></TableCell>
                      <TableCell className="text-xs">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</TableCell>
                      <TableCell>{r.captchas_solved ?? 0}</TableCell>
                      <TableCell>{r.files_downloaded ?? 0}</TableCell>
                      <TableCell className="text-xs">{r.cost_usd ? `${r.cost_usd.toFixed(3)}$` : "—"}</TableCell>
                      <TableCell className="text-xs text-red-400 max-w-xs truncate">{r.error_message}</TableCell>
                    </TableRow>
                  ))}
                  {runs.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm">Aucun run</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="robots">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Comptes robots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <Input placeholder="platform (ex: atexo_achatpublic)" value={newRobot.platform} onChange={(e) => setNewRobot({ ...newRobot, platform: e.target.value })} />
                <Input placeholder="login / email" value={newRobot.login} onChange={(e) => setNewRobot({ ...newRobot, login: e.target.value })} />
                <Input placeholder="mot de passe" type="password" value={newRobot.password} onChange={(e) => setNewRobot({ ...newRobot, password: e.target.value })} />
                <Button onClick={addRobot}>Ajouter</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead>Succès / Échecs</TableHead>
                    <TableHead>Dernière utilisation</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {robots.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="outline">{r.platform}</Badge></TableCell>
                      <TableCell className="text-xs">{r.login}</TableCell>
                      <TableCell>{r.is_active ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs">{r.success_count} / {r.failure_count}</TableCell>
                      <TableCell className="text-xs">{r.last_used_at ? format(new Date(r.last_used_at), "dd/MM HH:mm") : "—"}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => deleteRobot(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playbooks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Playbooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {playbooks.map((p) => (
                <Card key={p.id} className="border-muted">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{p.display_name} <Badge variant="outline" className="ml-2">{p.platform}</Badge></span>
                      <div className="flex gap-1">
                        {p.requires_auth && <Badge variant="secondary">auth</Badge>}
                        {p.requires_captcha && <Badge variant="secondary">captcha</Badge>}
                        {p.is_active && <Badge className="bg-green-500/20 text-green-400">actif</Badge>}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2">URL pattern: <code>{p.url_pattern}</code></p>
                    <Textarea value={JSON.stringify(p.steps, null, 2)} readOnly className="font-mono text-xs h-40" />
                  </CardContent>
                </Card>
              ))}
              {playbooks.length === 0 && <p className="text-sm text-muted-foreground">Aucun playbook</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Play className="h-4 w-4" /> Tester un playbook sur une URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="https://achatpublic.com/sdm/ent/gen/..." value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
              <Button onClick={runTest} disabled={testing || !testUrl} className="gap-2">
                {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Lancer
              </Button>
              <p className="text-xs text-muted-foreground">Le run apparaîtra en haut de l'onglet "Runs" en quelques secondes.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentMonitor;
