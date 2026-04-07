import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, Loader2, Save, Sparkles, Paperclip, X, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Attachment = { name: string; url: string };
type Message = { role: "user" | "assistant"; content: string; attachments?: Attachment[] };

interface MemoirData {
  company_name?: string;
  siren?: string;
  company_size?: string;
  sectors?: string[];
  regions?: string[];
  keywords?: string[];
  company_website?: string;
  company_certifications?: string[];
  company_skills?: string;
  company_team?: string;
  company_equipment?: string;
  company_past_work?: string;
  company_references?: { title: string; client: string; amount?: string; date?: string; description?: string }[];
  company_description?: string;
}

interface MemoirAIChatProps {
  onMemoirSaved: () => void;
  mode?: "dialog" | "onboarding";
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-memoir`;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";

export default function MemoirAIChat({ onMemoirSaved, mode = "dialog" }: MemoirAIChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memoirData, setMemoirData] = useState<MemoirData | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-start conversation
  useEffect(() => {
    if (mode === "onboarding" && messages.length === 0) {
      sendToAI([]);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "dialog" && open && messages.length === 0) {
      sendToAI([]);
    }
  }, [open]);

  const uploadFiles = async (files: File[]): Promise<Attachment[]> => {
    if (!user || files.length === 0) return [];
    const attachments: Attachment[] = [];
    for (const file of files) {
      const path = `memoir-attachments/${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("company-assets").upload(path, file);
      if (error) {
        toast({ title: "Erreur upload", description: `${file.name}: ${error.message}`, variant: "destructive" });
        continue;
      }
      const { data: urlData } = await supabase.storage.from("company-assets").createSignedUrl(path, 3600 * 24 * 7);
      if (urlData?.signedUrl) {
        attachments.push({ name: file.name, url: urlData.signedUrl });
      }
    }
    return attachments;
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

  const sendToAI = async (msgs: Message[]) => {
    setIsLoading(true);
    let assistantContent = "";

    try {
      const apiMessages = msgs.map((m) => {
        if (m.attachments?.length) {
          const attachmentText = m.attachments.map((a) => `\n[Pièce jointe : ${a.name}]`).join("");
          return { role: m.role, content: m.content + attachmentText };
        }
        return { role: m.role, content: m.content };
      });

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erreur réseau" }));
        toast({ title: "Erreur", description: err.error || `Erreur ${resp.status}`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setIsLoading(false); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let toolCallArgs = "";
      let toolCallName = "";
      let hasToolCall = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;

            const content = delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }

            if (delta?.tool_calls) {
              hasToolCall = true;
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) toolCallName = tc.function.name;
                if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
            if (parsed.choices?.[0]?.delta?.tool_calls) {
              hasToolCall = true;
              for (const tc of parsed.choices[0].delta.tool_calls) {
                if (tc.function?.name) toolCallName = tc.function.name;
                if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
              }
            }
          } catch { /* ignore */ }
        }
      }

      if (hasToolCall && toolCallArgs) {
        try {
          const data = JSON.parse(toolCallArgs);

          if (toolCallName === "analyze_website") {
            // Handle website analysis tool call
            const websiteUrl = data.url;
            if (websiteUrl) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                const analyzing = "\n\n🔍 *Analyse du site web en cours...*";
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: m.content + analyzing } : m));
                }
                return [...prev, { role: "assistant", content: analyzing }];
              });

              try {
                const websiteResp = await fetch(CHAT_URL, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                  },
                  body: JSON.stringify({ messages: [], analyze_website_url: websiteUrl }),
                });
                const websiteData = await websiteResp.json();

                if (websiteData.website_content) {
                  const contextMsg: Message = {
                    role: "user",
                    content: `[Contenu du site web ${websiteUrl} analysé automatiquement]\n\n${websiteData.website_content}`,
                  };
                  const updatedMsgs = [...msgs, contextMsg];
                  setMessages((prev) => [...prev.filter(m => !m.content.includes("Analyse du site web en cours"))]);
                  // Continue conversation with website context
                  await sendToAI(updatedMsgs);
                  return;
                }
              } catch (e) {
                console.error("Website analysis failed:", e);
                toast({ title: "Analyse du site échouée", description: "Le site n'a pas pu être analysé, l'entretien continue.", variant: "destructive" });
              }
            }
          } else if (toolCallName === "save_memoir" || !toolCallName) {
            setMemoirData(data as MemoirData);
            toast({ title: "Mémoire technique prêt", description: "Vérifiez le résumé et sauvegardez." });
          }
        } catch (e) {
          console.error("Failed to parse tool call:", e);
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
    if (pendingFiles.length > 0) {
      setUploading(true);
      attachments = await uploadFiles(pendingFiles);
      setUploading(false);
      setPendingFiles([]);
    }

    const userMsg: Message = {
      role: "user",
      content: input.trim() || (attachments.length > 0 ? "Voici mes documents." : ""),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    sendToAI(newMessages);
  };

  const handleSaveMemoir = async () => {
    if (!user || !memoirData) return;
    setSaving(true);

    const updateData: Record<string, any> = {};
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

    const { error } = await supabase.from("profiles").update(updateData as any).eq("user_id", user.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mémoire technique sauvegardé ✓" });
      onMemoirSaved();
      if (mode === "dialog") {
        setOpen(false);
        setMessages([]);
        setMemoirData(null);
      }
    }
    setSaving(false);
  };

  const chatContent = (
    <>
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="space-y-4 pb-4 pt-2">
          {messages.map((msg, i) => (
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
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <>
                    <p>{msg.content}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((att, j) => (
                          <a
                            key={j}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs opacity-80 hover:opacity-100 underline"
                          >
                            <FileText className="h-3 w-3" />
                            {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
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
            disabled={isLoading || uploading}
            autoFocus
          />
          <Button type="submit" size="icon" disabled={isLoading || uploading || (!input.trim() && pendingFiles.length === 0)}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </>
  );

  if (mode === "onboarding") {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Assistant Mémoire Technique</h2>
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
            Assistant Mémoire Technique
          </DialogTitle>
        </DialogHeader>
        {chatContent}
      </DialogContent>
    </Dialog>
  );
}
