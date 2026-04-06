import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, Loader2, Save, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

interface MemoirData {
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
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-memoir`;

export default function MemoirAIChat({ onMemoirSaved }: MemoirAIChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memoirData, setMemoirData] = useState<MemoirData | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      sendToAI([]);
    }
  }, [open]);

  const sendToAI = async (msgs: Message[]) => {
    setIsLoading(true);
    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ messages: msgs }),
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

            // Handle streamed content
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

            // Handle tool calls
            if (delta?.tool_calls) {
              hasToolCall = true;
              for (const tc of delta.tool_calls) {
                if (tc.function?.arguments) {
                  toolCallArgs += tc.function.arguments;
                }
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
                if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
              }
            }
          } catch { /* ignore */ }
        }
      }

      // If tool call was made, parse memoir data
      if (hasToolCall && toolCallArgs) {
        try {
          const data = JSON.parse(toolCallArgs) as MemoirData;
          setMemoirData(data);
          toast({ title: "Mémoire technique prêt", description: "Vérifiez le résumé et sauvegardez." });
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

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    sendToAI(newMessages);
  };

  const handleSaveMemoir = async () => {
    if (!user || !memoirData) return;
    setSaving(true);

    const updateData: Record<string, any> = {};
    if (memoirData.company_certifications) updateData.company_certifications = memoirData.company_certifications;
    if (memoirData.company_skills) updateData.company_skills = memoirData.company_skills;
    if (memoirData.company_team) updateData.company_team = memoirData.company_team;
    if (memoirData.company_equipment) updateData.company_equipment = memoirData.company_equipment;
    if (memoirData.company_past_work) updateData.company_past_work = memoirData.company_past_work;
    if (memoirData.company_references) updateData.company_references = memoirData.company_references;
    if (memoirData.company_description) updateData.company_description = memoirData.company_description;

    const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mémoire technique sauvegardé ✓" });
      onMemoirSaved();
      setOpen(false);
      setMessages([]);
      setMemoirData(null);
    }
    setSaving(false);
  };

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

        <ScrollArea className="flex-1 px-6" ref={scrollRef}>
          <div className="space-y-4 pb-4">
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
                    <p>{msg.content}</p>
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

        {/* Memoir data ready banner */}
        {memoirData && (
          <div className="mx-6 mb-2 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Mémoire technique prêt !</p>
              <p className="text-xs text-muted-foreground">
                {memoirData.company_certifications?.length || 0} certifications · 
                {memoirData.company_references?.length || 0} références
              </p>
            </div>
            <Button onClick={handleSaveMemoir} disabled={saving} size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="px-6 pb-6 pt-2 border-t border-border">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre réponse..."
              disabled={isLoading}
              autoFocus
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
