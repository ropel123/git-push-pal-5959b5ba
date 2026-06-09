import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { PLANS, plansByCategory, isPriceConfigured, type Plan } from "@/lib/pricing";
import HackaoLogo from "@/components/brand/HackaoLogo";

const CONTACT_EMAIL = "contact@hackao.fr";

const PricingPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [emailSeats, setEmailSeats] = useState(1);

  const subscribe = async (plan: Plan, quantity = 1) => {
    if (!user) {
      window.location.href = `/auth?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    if (!isPriceConfigured(plan.priceId)) {
      toast({
        title: "Price ID Stripe non configuré",
        description: `Renseigne le Price ID pour "${plan.name}" dans src/lib/pricing.ts.`,
        variant: "destructive",
      });
      return;
    }
    setLoadingId(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: plan.priceId,
          quantity,
          planId: plan.id,
          successUrl: `${window.location.origin}/dashboard?subscribed=1`,
          cancelUrl: `${window.location.origin}/pricing?canceled=1`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Pas d'URL de checkout retournée");
      }
    } catch (e: any) {
      toast({ title: "Erreur Stripe", description: e.message, variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  const sourcing = plansByCategory("sourcing");
  const assistant = plansByCategory("assistant");
  const expert = plansByCategory("expert");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <HackaoLogo className="h-7" />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to={user ? "/dashboard" : "/"}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {user ? "Dashboard" : "Accueil"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 space-y-16">
        <section className="text-center space-y-3">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Sparkles className="h-3 w-3 mr-1" /> Tarifs HackAO
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Choisissez la formule qui vous fait gagner des marchés
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Veille, assistant IA et accompagnement par un chef de projet AO. Sans engagement, annulable à tout moment.
          </p>
        </section>

        {/* SOURCING */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Sourcing</h2>
            <p className="text-muted-foreground">Toute la veille AO en un seul endroit.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {sourcing.map((plan) => (
              <Card key={plan.id} className={plan.highlight ? "border-primary shadow-lg" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlight && <Badge>Populaire</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="text-3xl font-bold pt-2">{plan.priceLabel}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  {plan.quantityAdjustable ? (
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs">Nombre d'emails</Label>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={emailSeats}
                          onChange={(e) => setEmailSeats(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                        />
                      </div>
                      <Button
                        className="flex-1"
                        onClick={() => subscribe(plan, emailSeats)}
                        disabled={loadingId === plan.id}
                      >
                        {loadingId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Ajouter (${emailSeats * 20} €/mois)`}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => subscribe(plan)}
                      disabled={loadingId === plan.id}
                    >
                      {loadingId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "S'abonner"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ASSISTANT IA */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Assistant IA</h2>
            <p className="text-muted-foreground">Analyse, rédaction et chiffrage assistés par Claude 3.5 Sonnet.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {assistant.map((plan) => (
              <Card key={plan.id} className={plan.highlight ? "border-primary shadow-lg" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlight && <Badge>Recommandé</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="text-3xl font-bold pt-2">{plan.priceLabel}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={() => subscribe(plan)}
                    disabled={loadingId === plan.id}
                  >
                    {loadingId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "S'abonner"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CHEF DE PROJET AO */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Chef de projet AO</h2>
            <p className="text-muted-foreground">
              Un expert humain + l'IA pour rédiger et déposer un dossier complet.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {expert.map((plan) => (
              <Card key={plan.id} className="border-accent/50">
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="text-2xl font-bold pt-2">{plan.priceLabel}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full" variant="secondary">
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                        `Accompagnement ${plan.name}`,
                      )}`}
                    >
                      {plan.cta ?? "Demander un devis"}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="text-center text-xs text-muted-foreground border-t border-border pt-6">
          Prix en euros HT. Sans engagement. Paiement sécurisé par Stripe.
        </section>
      </main>
    </div>
  );
};

export default PricingPage;
