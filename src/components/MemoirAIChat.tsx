import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSaveMemoir } from "@/hooks/mutations/useMemoir";
import {
  loadOrCreateConversation,
  persistConversation,
  type ChatMessage,
  type Attachment,
  type ConversationMode,
} from "@/lib/memoirConversation";
import { createStreamAccumulator } from "@/lib/aiStream";
import { Bot, Send, Loader2, Save, Sparkles, Paperclip, X, FileText, RotateCcw, Globe } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";

// Schéma de validation des données produites par le tool-call `save_memoir` de
// l'IA. On ne persiste JAMAIS la sortie brute du LLM dans `profiles` : elle est
// d'abord validée pour rejeter des types incohérents (ex: `sectors` en string,
// `company_skills` en objet). Correspond à la forme réellement écrite en base.
const memoirReferenceSchema = z.object({
  title: z.string(),
  client: z.string(),
  amount: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
});

const memoirDataSchema = z.object({
  company_name: z.string().optional(),
  siren: z.string().optional(),
  company_size: z.string().optional(),
  sectors: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  company_website: z.string().optional(),
  company_certifications: z.array(z.string()).optional(),
  company_skills: z.string().optional(),
  company_team: z.string().optional(),
  company_equipment: z.string().optional(),
  company_past_work: z.string().optional(),
  company_references: z.array(memoirReferenceSchema).optional(),
  company_description: z.string().optional(),
});

type MemoirData = z.infer<typeof memoirDataSchema>;

interface MemoirAIChatProps {
  onMemoirSaved: () => void;
  mode?: ConversationMode;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-memoir`;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";

export default function MemoirAIChat({ onMemoirSaved, mode = "dialog" }: MemoirAIChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [analyzingWebsite, setAnalyzingWebsite] = useState(false);
  const [memoirData, setMemoirData] = useState<MemoirData | null>(null);
  const saveMemoirMutation = useSaveMemoir(user?.id);
  const saving = saveMemoirMutation.isPending;
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  const displayedMessages = messages.filter((m) => !m.hidden);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initConversation = useCallback(async () => {
    if (!user) return;
    setRestoring(true);
    const conv = await loadOrCreateConversation(user.id, mode);
    setRestoring(false);
    if (!conv) {
      toast({ title: "Erreur", description: "Impossible de charger la conversation.", variant: "destructive" });
      return;
    }
    setConversationId(conv.id);
    if (conv.messages.length > 0) {
      // Reprise : on restaure l'historique et l'éventuel brouillon.
      setMessages(conv.messages);
      if (conv.memoir_draft) setMemoirData(conv.memoir_draft as MemoirData);
      toast({ title: "Conversation restaurée", description: "Vous reprenez là où vous vous étiez arrêté." });
    } else {
      sendToAI([], conv.id);
    }
    // sendToAI/toast volontairement omis : initConversation ne doit se
    // recréer qu'au changement d'utilisateur ou de mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode]);

  // Démarrage automatique — initRef évite le double appel en StrictMode.
  useEffect(() => {
    if (mode === "onboarding" && user && !initRef.current) {
      initRef.current = true;
      initConversation();
    }
  }, [mode, user, initConversation]);

  useEffect(() => {
    if (mode === "dialog" && open && user && !initRef.current) {
      initRef.current = true;
      initConversation();
    }
  }, [open, mode, user, initConversation]);

  const restartConversation = async () => {
    if (!user) return;
    if (conversationId) {
      await persistConversation(conversationId, { status: "abandoned" });
    }
    setMessages([]);
    setMemoirData(null);
    setConversationId(null);
    const conv = await loadOrCreateConversation(user.id, mode);
    if (conv) {
      setConversationId(conv.id);
      sendToAI([], conv.id);
    }
  };

  const sanitizeFileName = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-100);

  const uploadFiles = async (files: File[]): Promise<Attachment[]> => {
    if (!user || files.length === 0) return [];
    const attachments: Attachment[] = [];
    for (const file of files) {
      const path = `${user.id}/memoir-attachments/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage.from("company-assets").upload(path, file);
      if (error) {
        toast({ title: "Erreur upload", description: `${file.name}: ${error.message}`, variant: "destructive" });
        continue;
      }
      // On ne persiste PAS d'URL signée longue durée dans la conversation : seul le
      // `path` est stocké, et l'URL est re-signée à la demande (1h) au clic — voir
      // openAttachment. Évite qu'un lien valide 7 jours reste dans les messages.
      attachments.push({ name: file.name, url: "", path });
    }
    return attachments;
  };

  // Signe une URL courte durée (1h) à la volée puis ouvre la pièce jointe. Fallback
  // sur att.url pour les anciennes conversations où l'URL était encore persistée.
  const openAttachment = async (att: Attachment) => {
    if (att.path) {
      const { data } = await supabase.storage.from("company-assets").createSignedUrl(att.path, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }
    if (att.url) window.open(att.url, "_blank", "noopener,noreferrer");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: "Fichier trop volumineux", description: `${f.name} dépasse 10 MB`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const extractAttachments = async (attachments: Attachment[]): Promise<ChatMessage[]> => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const results: ChatMessage[] = [];
    for (const att of attachments) {
      if (!att.path) continue;
      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: [], extract_document_path: att.path }),
        });
        const data = await resp.json();
        if (data.document_content) {
          results.push({
            role: "user",
            content: `[Document joint « ${att.name} » — contenu extrait]\n\n${data.document_content}`,
            hidden: true,
          });
        }
      } catch (e) {
        console.error("[memoir] extraction attachment failed:", att.name, e);
      }
    }
    return results;
  };

  const toApiMessages = (history: ChatMessage[]) =>
    history.map((m) => {
      if (m.attachments?.length) {
        const attachmentText = m.attachments.map((a) => `\n[Pièce jointe : ${a.name}]`).join("");
        return { role: m.role, content: m.content + attachmentText };
      }
      return { role: m.role, content: m.content };
    });

  const sendToAI = async (history: ChatMessage[], convId: string | null = conversationId) => {
    setIsLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ messages: toApiMessages(history) }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erreur réseau" }));
        toast({ title: "Erreur", description: err.error || `Erreur ${resp.status}`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      const acc = createStreamAccumulator();

      const renderPartial = () => {
        const partial = acc.content;
        if (!partial) return;
        setMessages([...history, { role: "assistant", content: partial }]);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc.push(decoder.decode(value, { stream: true }));
        renderPartial();
      }
      acc.flush();
      renderPartial();

      // Historique final du tour : le texte de l'assistant en fait partie,
      // y compris quand un tool call suit (sinon l'IA perd son propre fil).
      let finalHistory = history;
      if (acc.content) {
        finalHistory = [...history, { role: "assistant" as const, content: acc.content }];
      }
      setMessages(finalHistory);
      if (convId) persistConversation(convId, { messages: finalHistory });

      for (const toolCall of acc.getToolCalls()) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.arguments || "{}");
        } catch (e) {
          console.error("[memoir] tool call args invalides:", toolCall.name, e);
          continue;
        }

        if (toolCall.name === "analyze_website" && typeof args.url === "string" && args.url) {
          setAnalyzingWebsite(true);
          try {
            const websiteResp = await fetch(CHAT_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              },
              body: JSON.stringify({ messages: [], analyze_website_url: args.url }),
            });
            const websiteData = await websiteResp.json();
            setAnalyzingWebsite(false);

            if (websiteData.website_content) {
              // Message de contexte masqué mais persisté : l'analyse reste
              // disponible pour toute la suite de l'entretien.
              const contextMsg: ChatMessage = {
                role: "user",
                content: `[Contenu du site web ${args.url} analysé automatiquement]\n\n${websiteData.website_content}`,
                hidden: true,
              };
              const nextHistory = [...finalHistory, contextMsg];
              setMessages(nextHistory);
              if (convId) persistConversation(convId, { messages: nextHistory });
              await sendToAI(nextHistory, convId);
              return;
            }
            toast({
              title: "Analyse du site échouée",
              description: websiteData.error || "Le site n'a pas pu être analysé, l'entretien continue.",
              variant: "destructive",
            });
          } catch (e) {
            setAnalyzingWebsite(false);
            console.error("Website analysis failed:", e);
            toast({ title: "Analyse du site échouée", description: "Le site n'a pas pu être analysé, l'entretien continue.", variant: "destructive" });
          }
        } else if (toolCall.name === "save_memoir") {
          const parsed = memoirDataSchema.safeParse(args);
          if (!parsed.success) {
            console.error("[memoir] save_memoir output invalide, écriture ignorée:", parsed.error);
            toast({
              title: "Résumé invalide",
              description: "Les données générées n'ont pas pu être validées et n'ont pas été enregistrées. Réessayez.",
              variant: "destructive",
            });
          } else {
            setMemoirData(parsed.data);
            if (convId) persistConversation(convId, { messages: finalHistory, memoir_draft: parsed.data });
            toast({ title: "Mémoire technique prêt", description: "Vérifiez le résumé et sauvegardez." });
          }
        }
      }
    } catch (e) {
      console.error("Stream error:", e);
      toast({ title: "Erreur de connexion", variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || isLoading) return;

    let attachments: Attachment[] = [];
    let contextMsgs: ChatMessage[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      attachments = await uploadFiles(pendingFiles);
      setPendingFiles([]);
      // Extraction du contenu des pièces jointes → messages de contexte cachés,
      // pour que l'IA lise réellement les documents et pas seulement leur nom.
      const extractable = attachments.filter((a) => a.path);
      if (extractable.length > 0) contextMsgs = await extractAttachments(extractable);
      setUploading(false);
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim() || (attachments.length > 0 ? "Voici mes documents." : ""),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    const newMessages = [...messages, userMsg, ...contextMsgs];
    setMessages(newMessages);
    setInput("");
    if (conversationId) persistConversation(conversationId, { messages: newMessages });
    sendToAI(newMessages);
  };

  const handleSaveMemoir = () => {
    if (!user || !memoirData) return;

    const updateData: Record<string, unknown> = {};
    if (memoirData.company_name) updateData.company_name = memoirData.company_name;
    if (memoirData.siren) updateData.siren = memoirData.siren;
    if (memoirData.company_size) updateData.company_size = memoirData.company_size;
    if (memoirData.sectors?.length) updateData.sectors = memoirData.sectors;
    if (memoirData.regions?.length) updateData.regions = memoirData.regions;
    if (memoirData.keywords?.length) updateData.keywords = memoirData.keywords;
    if (memoirData.company_website) updateData.company_website = memoirData.company_website;
    if (memoirData.company_description) updateData.company_description = memoirData.company_description;
    if (memoirData.company_certifications) updateData.company_certifications = memoirData.company_certifications;
    if (memoirData.company_skills) updateData.company_skills = memoirData.company_skills;
    if (memoirData.company_team) updateData.company_team = memoirData.company_team;
    if (memoirData.company_equipment) updateData.company_equipment = memoirData.company_equipment;
    if (memoirData.company_past_work) updateData.company_past_work = memoirData.company_past_work;
    if (memoirData.company_references) updateData.company_references = memoirData.company_references;

    if (mode === "onboarding") {
      updateData.onboarding_completed = true;
    }

    saveMemoirMutation.mutate(updateData, {
      onSuccess: () => {
        toast({ title: "Mémoire technique sauvegardé ✓" });
        if (conversationId) persistConversation(conversationId, { status: "completed" });
        onMemoirSaved();
        if (mode === "dialog") {
          setOpen(false);
          setMessages([]);
          setMemoirData(null);
          setConversationId(null);
          initRef.current = false;
        }
      },
      onError: (err) => {
        toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
      },
    });
  };


  const chatContent = (
    <>
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="space-y-4 pb-4 pt-2">
          {restoring && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {displayedMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <>
                    <p>{msg.content}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((att, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => openAttachment(att)}
                            className="flex items-center gap-1.5 text-xs opacity-80 hover:opacity-100 underline"
                          >
                            <FileText className="h-3 w-3" />
                            {att.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {analyzingWebsite && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4 animate-pulse" />
                Analyse du site web en cours...
              </div>
            </div>
          )}
          {isLoading && !analyzingWebsite && displayedMessages[displayedMessages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {memoirData && (
        <div className="mx-6 mb-2 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Mémoire technique prêt !</p>
            <p className="text-xs text-muted-foreground">
              {memoirData.company_name && `${memoirData.company_name} · `}
              {memoirData.company_certifications?.length || 0} certifications ·
              {memoirData.company_references?.length || 0} références
            </p>
          </div>
          <Button onClick={handleSaveMemoir} disabled={saving} size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Sauvegarde..." : mode === "onboarding" ? "Sauvegarder et continuer" : "Sauvegarder"}
          </Button>
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div className="mx-6 mb-1 flex flex-wrap gap-2">
          {pendingFiles.map((file, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 bg-muted text-foreground text-xs rounded-full px-3 py-1"
            >
              <FileText className="h-3 w-3" />
              {file.name.length > 25 ? file.name.slice(0, 22) + "..." : file.name}
              <button onClick={() => removePendingFile(i)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="px-6 pb-6 pt-2 border-t border-border">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || uploading}
            title="Joindre un fichier"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Votre réponse..."
            disabled={isLoading || uploading || restoring}
            autoFocus
          />
          <Button type="submit" size="icon" disabled={isLoading || uploading || restoring || (!input.trim() && pendingFiles.length === 0)}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </>
  );

  const headerActions = displayedMessages.length > 0 && !isLoading && (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground"
      onClick={restartConversation}
      title="Recommencer l'entretien depuis le début"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Recommencer
    </Button>
  );

  if (mode === "onboarding") {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground flex-1">Assistant Mémoire Technique</h2>
          {headerActions}
        </div>
        {chatContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="default">
          <Sparkles className="h-4 w-4" />
          Construire mon mémoire avec l'IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="flex-1">Assistant Mémoire Technique</span>
            {headerActions}
          </DialogTitle>
        </DialogHeader>
        {chatContent}
      </DialogContent>
    </Dialog>
  );
}
