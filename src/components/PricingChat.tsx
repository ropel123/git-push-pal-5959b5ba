import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, Loader2, Save, Euro, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

interface PricingData {
  global_price: number;
  margin_percentage?: number;
  strategy_summary: string;
  cost_breakdown: { label: string; amount: number; description?: string }[];
  lots_pricing?: { lot_number: string; lot_title?: string; price: number }[];
  pricing_arguments?: string;
}

interface PricingChatProps {
  tenderId: string;
  pipelineItemId: string;
  existingPricing?: PricingData | null;
  onPricingSaved: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pricing-strategy`;

export default function PricingChat({ tenderId, pipelineItemId, existingPricing, onPricingSaved }: PricingChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) sendToAI([]);
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
        body: JSON.stringify({ messages: msgs.map(m => ({ role: m.role, content: m.content })), tender_id: tenderId, pipeline_item_id: pipelineItemId }),
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

      if (hasToolCall && toolCallArgs && toolCallName === "save_pricing") {
        try {
          const data = JSON.parse(toolCallArgs) as PricingData;
          setPricingData(data);
          toast({ title: "Stratégie commerciale prête", description: "Vérifiez et sauvegardez." });
        } catch (e) {
          console.error("Failed to parse pricing tool call:", e);
        }
      }
    } catch (e) {
      console.error("Stream error:", e);
      toast({ title: "Erreur de connexion", variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    sendToAI(newMessages);
  };

  const handleSavePricing = async () => {
    if (!user || !pricingData) return;
    setSaving(true);

    const { error } = await supabase
      .from("pipeline_items")
      .update({ pricing_strategy: pricingData as any })
      .eq("id", pipelineItemId)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Stratégie commerciale sauvegardée ✓" });
      onPricingSaved();
      setOpen(false);
      setMessages([]);
      setPricingData(null);
    }
    setSaving(false);
  };

  return (
    <>
      {existingPricing && existingPricing.global_price > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Euro className="h-4 w-4" /> Réponse commerciale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {new Intl.NumberFormat("fr-FR").format(existingPricing.global_price)} €
              </span>
              {existingPricing.margin_percentage && (
                <span className="text-sm text-muted-foreground">
                  (marge : {existingPricing.margin_percentage}%)
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{existingPricing.strategy_summary}</p>
            {existingPricing.cost_breakdown?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Décomposition :</p>
                {existingPricing.cost_breakdown.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm px-2 py-1 rounded bg-secondary/50">
                    <span>{item.label}</span>
                    <span className="font-medium">{new Intl.NumberFormat("fr-FR").format(item.amount)} €</span>
                  </div>
                ))}
              </div>
            )}
            {existingPricing.lots_pricing && existingPricing.lots_pricing.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Prix par lot :</p>
                {existingPricing.lots_pricing.map((lot, i) => (
                  <div key={i} className="flex justify-between text-sm px-2 py-1 rounded bg-secondary/50">
                    <span>Lot {lot.lot_number}{lot.lot_title ? ` — ${lot.lot_title}` : ""}</span>
                    <span className="font-medium">{new Intl.NumberFormat("fr-FR").format(lot.price)} €</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {existingPricing?.global_price ? "Modifier le chiffrage" : "Préparer ma réponse commerciale"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Assistant de chiffrage IA
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6" ref={scrollRef}>
            <div className="space-y-4 pb-4 pt-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
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

          {pricingData && (
            <div className="mx-6 mb-2 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Stratégie commerciale prête !</p>
                <p className="text-xs text-muted-foreground">
                  Prix global : {new Intl.NumberFormat("fr-FR").format(pricingData.global_price)} € · {pricingData.cost_breakdown.length} postes
                </p>
              </div>
              <Button onClick={handleSavePricing} disabled={saving} size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          )}

          <div className="px-6 pb-6 pt-2 border-t border-border">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Décrivez vos coûts, marges souhaitées..."
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
