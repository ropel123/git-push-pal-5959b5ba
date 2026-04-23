import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Plus, RefreshCcw, Trash2, FlaskConical, Info, Wand2, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { detectPlatform, PLATFORMS } from "@/lib/detectPlatform";

type SourcingUrl = {
  id: string;
  url: string;
  platform: string;
  display_name: string | null;
  frequency_hours: number;
  is_active: boolean;
  parser_type: string;
  last_run_at: string | null;
  last_status: string | null;
  last_items_found: number | null;
  last_items_inserted: number | null;
  last_error: string | null;
  metadata: any;
};

type ScrapeLog = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_found: number | null;
  items_inserted: number | null;
  items_updated: number | null;
  errors: string | null;
};

const Sourcing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [urls, setUrls] = useState<SourcingUrl[]>([]);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [form, setForm] = useState({ url: "", platform: "custom", display_name: "", frequency_hours: 6 });
  const [testResult, setTestResult] = useState<any>(null);
  const [editing, setEditing] = useState<SourcingUrl | null>(null);
  const [editForm, setEditForm] = useState({ url: "", platform: "custom", display_name: "", frequency_hours: 6, is_active: true });
  const [saving, setSaving] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedId) return;
    const el = document.getElementById(`row-${highlightedId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightedId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightedId, urls]);

  useEffect(() => {
    if (!adminLoading && isAdmin === false) navigate("/dashboard");
  }, [isAdmin, adminLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: u }, { data: l }] = await Promise.all([
      supabase.from("sourcing_urls").select("*").order("created_at", { ascending: false }),
      supabase.from("scrape_logs").select("*").like("source", "scrape:%").order("started_at", { ascending: false }).limit(50),
    ]);
    setUrls((u as SourcingUrl[]) || []);
    setLogs((l as ScrapeLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const addUrl = async () => {
    if (!form.url.trim()) return;
    const platform = form.platform === "custom" ? detectPlatform(form.url) : form.platform;
    const { error } = await supabase.from("sourcing_urls").insert({
      url: form.url.trim(),
      platform,
      display_name: form.display_name || null,
      frequency_hours: form.frequency_hours,
    });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      toast({ title: "URL ajoutée" });
      setOpen(false);
      setForm({ url: "", platform: "custom", display_name: "", frequency_hours: 6 });
      load();
    }
  };

  const bulkImport = async () => {
    const lines = bulkUrls.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines.map((url) => ({
      url,
      platform: detectPlatform(url),
      frequency_hours: 6,
    }));
    const { error } = await supabase.from("sourcing_urls").insert(rows);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      toast({ title: `${lines.length} URLs ajoutées` });
      setBulkOpen(false);
      setBulkUrls("");
      load();
    }
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await supabase.from("sourcing_urls").update({ is_active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette URL ?")) return;
    await supabase.from("sourcing_urls").delete().eq("id", id);
    load();
  };

  const openEdit = (u: SourcingUrl) => {
    setEditing(u);
    setEditForm({
      url: u.url,
      platform: u.platform,
      display_name: u.display_name ?? "",
      frequency_hours: u.frequency_hours,
      is_active: u.is_active,
    });
  };

  const saveEdit = async () => {
    if (!editing || saving) return;
    const newUrl = editForm.url.trim();
    if (!newUrl || !/^https?:\/\//i.test(newUrl)) {
      toast({ title: "URL invalide", description: "L'URL doit commencer par http(s)://", variant: "destructive" });
      return;
    }
    setSaving(true);
    const urlChanged = newUrl !== editing.url;
    const update: any = {
      url: newUrl,
      platform: editForm.platform,
      display_name: editForm.display_name.trim() || null,
      frequency_hours: editForm.frequency_hours,
      is_active: editForm.is_active,
    };
    if (urlChanged) {
      update.last_run_at = null;
      update.last_status = null;
      update.last_items_found = null;
      update.last_items_inserted = null;
      update.last_error = null;
    }
    const editedId = editing.id;
    const { error } = await supabase.from("sourcing_urls").update(update).eq("id", editedId);
    setSaving(false);
    if (error) {
      const msg = error.message.includes("duplicate") || error.message.includes("unique")
        ? "Cette URL existe déjà sur une autre ligne."
        : error.message;
      toast({ title: "Erreur", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "URL mise à jour" });
    setEditing(null);
    setHighlightedId(editedId);
    await load();
  };

  const runNow = async (id: string) => {
    setRunning(id);
    const { data, error } = await supabase.functions.invoke("scrape-list", {
      body: { sourcing_url_id: id },
    });
    setRunning(null);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "Run terminé", description: `${data?.items_found ?? 0} trouvés, ${data?.inserted ?? 0} insérés` });
    load();
  };

  const dryRun = async (id: string) => {
    setRunning(id);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("scrape-list", {
      body: { sourcing_url_id: id, dry_run: true },
    });
    setRunning(null);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else setTestResult(data);
  };

  const reclassifyOne = async (id: string) => {
    setRunning(id);
    const { data, error } = await supabase.functions.invoke("reclassify-sourcing-urls", {
      body: { sourcing_url_id: id },
    });
    setRunning(null);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      const r = data?.results?.[0];
      toast({
        title: "Plateforme re-détectée",
        description: r ? `${r.before} → ${r.after} (${r.source})` : "ok",
      });
      load();
    }
  };

  const reclassifyAll = async () => {
    if (!confirm("Re-détecter toutes les URLs 'custom' / 'safetender' suspects ? (peut prendre du temps)")) return;
    setRunning("__all__");
    const { data, error } = await supabase.functions.invoke("reclassify-sourcing-urls", {
      body: { only_custom: true },
    });
    setRunning(null);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Reclassement terminé", description: `${data?.processed ?? 0} URLs traitées` });
      load();
    }
  };

  if (adminLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <TooltipProvider>
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sourcing</h1>
          <p className="text-muted-foreground">URLs scrapées toutes les {urls[0]?.frequency_hours ?? 6}h pour alimenter les appels d'offres</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reclassifyAll} disabled={running === "__all__"}>
            {running === "__all__" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Re-détecter plateformes
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}><Plus className="mr-2 h-4 w-4" />Import en masse</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Ajouter une URL</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle URL de sourcing</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>URL</Label>
                  <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value, platform: detectPlatform(e.target.value) })} placeholder="https://..." />
                </div>
                <div>
                  <Label>Plateforme</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nom affiché (optionnel)</Label>
                  <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                </div>
                <div>
                  <Label>Fréquence (heures)</Label>
                  <Input type="number" value={form.frequency_hours} onChange={(e) => setForm({ ...form, frequency_hours: parseInt(e.target.value) || 6 })} />
                </div>
              </div>
              <DialogFooter><Button onClick={addUrl}>Ajouter</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import en masse</DialogTitle><DialogDescription /></DialogHeader>
          <Textarea rows={12} placeholder="Une URL par ligne…" value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} />
          <DialogFooter><Button onClick={bulkImport}>Importer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'URL de sourcing</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL</Label>
              <Input
                value={editForm.url}
                onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Plateforme</Label>
              <div className="flex gap-2">
                <Select value={editForm.platform} onValueChange={(v) => setEditForm({ ...editForm, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditForm({ ...editForm, platform: detectPlatform(editForm.url) })}
                  title="Auto-détecter depuis l'URL"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Nom affiché (optionnel)</Label>
              <Input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
            </div>
            <div>
              <Label>Fréquence (heures)</Label>
              <Input
                type="number"
                value={editForm.frequency_hours}
                onChange={(e) => setEditForm({ ...editForm, frequency_hours: parseInt(e.target.value) || 6 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Actif</Label>
              <Switch checked={editForm.is_active} onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={saveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>URLs configurées ({urls.length})</CardTitle>
          <CardDescription>Le scheduler tourne automatiquement, ou utilisez les boutons pour tester / forcer.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Plateforme</TableHead>
                <TableHead>Fréq.</TableHead>
                <TableHead>Dernier run</TableHead>
                <TableHead>Résultat</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {urls.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="min-w-[360px] align-top">
                    {u.display_name && <div className="font-medium mb-0.5">{u.display_name}</div>}
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary break-all"
                    >
                      {u.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">{u.platform}</Badge>
                      {u.metadata?.platform_evidence && Array.isArray(u.metadata.platform_evidence) && u.metadata.platform_evidence.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs space-y-1">
                              <div className="font-medium">Source : {u.metadata.platform_source ?? "?"} ({Math.round((u.metadata.platform_confidence ?? 0) * 100)}%)</div>
                              <div className="text-muted-foreground break-all">{u.metadata.platform_evidence.join(" · ")}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{u.frequency_hours}h</TableCell>
                  <TableCell className="text-xs">{u.last_run_at ? new Date(u.last_run_at).toLocaleString("fr-FR") : "—"}</TableCell>
                  <TableCell>
                    {u.last_status ? (
                      <Badge variant={u.last_status === "success" ? "default" : "destructive"}>
                        {u.last_status} · {u.last_items_inserted ?? 0}/{u.last_items_found ?? 0}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell><Switch checked={u.is_active} onCheckedChange={(v) => toggleActive(u.id, v)} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => reclassifyOne(u.id)} disabled={running === u.id} title="Re-détecter la plateforme">
                      <Wand2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)} title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dryRun(u.id)} disabled={running === u.id} title="Test (dry-run)">
                      {running === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => runNow(u.id)} disabled={running === u.id} title="Lancer maintenant">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(u.id)} title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {urls.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune URL configurée. Ajoutez-en une pour commencer.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>Résultat du test ({testResult.items_found ?? 0} items)</CardTitle>
            {testResult.error && <CardDescription className="text-destructive">{testResult.error}</CardDescription>}
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded max-h-96 overflow-auto">{JSON.stringify(testResult.items?.slice(0, 5), null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Logs récents</CardTitle>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCcw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Trouvés</TableHead>
                <TableHead>Insérés</TableHead>
                <TableHead>MAJ</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{l.source}</TableCell>
                  <TableCell><Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge></TableCell>
                  <TableCell>{l.items_found ?? 0}</TableCell>
                  <TableCell>{l.items_inserted ?? 0}</TableCell>
                  <TableCell>{l.items_updated ?? 0}</TableCell>
                  <TableCell className="text-xs">{new Date(l.started_at).toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate text-destructive" title={l.errors || ""}>{l.errors || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
};

// Tiny shim to avoid extra import
const DialogDescription = ({ children }: { children?: React.ReactNode }) => <div className="text-sm text-muted-foreground">{children}</div>;

export default Sourcing;
