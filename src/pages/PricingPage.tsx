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
import {
  getPlan,
  plansByCategory,
  isPriceConfigured,
  PRICING_FOOTNOTE,
  type Plan,
} from "@/lib/pricing";
import HackaoLogo from "@/components/brand/HackaoLogo";

const CONTACT_EMAIL = "contact@hackao.fr";

const PricingPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [emailSeats, setEmailSeats] = useState(1);
  const [assistantId, setAssistantId] = useState("assistant_pro");

  const veille = getPlan("sourcing_monthly");
  const emailOption = getPlan("sourcing_extra_email");
  const assistantPlans = plansByCategory("assistant");
  const assistantPlan = getPlan(assistantId);
  const expertPlans = plansByCategory("expert");
  const checkoutInFlight = loadingId !== null;

  const subscribe = async (plan: Plan, quantity = 1) => {
    if (!user) {
      window.location.href = `/auth?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    if (!isPriceConfigured(plan.priceId)) {
      toast({
        title: "Souscription en ligne bientôt disponible",
        description: `En attendant, écrivez-nous à ${CONTACT_EMAIL} : nous activons l'offre « ${plan.name} » pour vous.`,
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
        throw new Error("no checkout url");
      }
    } catch (e) {
      console.error("create-checkout failed", e);
      toast({
        title: "Le paiement n'a pas pu être initialisé",
        description: `Veuillez réessayer dans quelques instants, ou contactez-nous à ${CONTACT_EMAIL}.`,
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

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
              {user ? "Tableau de bord" : "Accueil"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <section className="text-center space-y-3">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Sparkles className="h-3 w-3 mr-1" /> Tarifs HackAO
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Surveillez, rédigez ou déléguez
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Trois offres indépendantes et cumulables : la Veille détecte vos marchés, l'Assistant IA
            analyse et rédige vos réponses, le Chef de projet AO s'occupe de tout. Sans engagement,
            annulables à tout moment.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-3 items-start">
          {/* Offre 1 — Veille */}
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Abonnement mensuel
              </p>
              <CardTitle>{veille.name}</CardTitle>
              <CardDescription>{veille.description}</CardDescription>
              <p className="pt-2 text-3xl font-bold">
                {veille.monthlyAmountEur}&nbsp;€{" "}
                <span className="text-sm font-normal text-muted-foreground">HT/mois</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {veille.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => subscribe(veille)}
                disabled={checkoutInFlight}
              >
                {loadingId === veille.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "S'abonner"}
              </Button>

              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-sm font-medium">Option : destinataires supplémentaires</p>
                <p className="text-xs text-muted-foreground">
                  {emailOption.monthlyAmountEur}&nbsp;€ HT/mois par destinataire d'alertes ajouté.
                </p>
                <div className="flex items-end gap-2">
                  <div className="space-y-1 w-24">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={emailSeats}
                      onChange={(e) =>
                        setEmailSeats(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                      }
                    />
                  </div>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => subscribe(emailOption, emailSeats)}
                    disabled={checkoutInFlight}
                  >
                    {loadingId === emailOption.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Ajouter (${emailSeats * emailOption.monthlyAmountEur} €/mois)`
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Offre 2 — Assistant IA */}
          <Card className="relative border-primary shadow-lg">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Abonnement mensuel
              </p>
              <CardTitle>Assistant IA</CardTitle>
              <CardDescription>Analysez et rédigez vos réponses 8× plus vite.</CardDescription>
              <div className="pt-2 space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Combien d'AO traitez-vous par mois ?
                </Label>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
                  {assistantPlans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAssistantId(p.id)}
                      disabled={checkoutInFlight}
                      className={`rounded-md px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        p.id === assistantId
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {p.aoPerMonth} AO
                    </button>
                  ))}
                </div>
                <p className="text-3xl font-bold">
                  {assistantPlan.monthlyAmountEur}&nbsp;€{" "}
                  <span className="text-sm font-normal text-muted-foreground">HT/mois</span>
                </p>
                <p className="text-xs text-muted-foreground">Palier {assistantPlan.name}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {assistantPlan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                onClick={() => subscribe(assistantPlan)}
                disabled={checkoutInFlight}
              >
                {loadingId === assistantPlan.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "S'abonner"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Se combine avec l'offre Veille.
              </p>
            </CardContent>
          </Card>

          {/* Offre 3 — Chef de projet AO */}
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Forfait + commission au succès
              </p>
              <CardTitle>Chef de projet AO</CardTitle>
              <CardDescription>Un expert répond à votre place, de A à Z.</CardDescription>
              <div className="pt-2 overflow-hidden rounded-lg border border-border">
                {expertPlans.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 bg-muted/50 px-3 py-2 text-sm ${
                      i < expertPlans.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="whitespace-nowrap font-semibold">
                      {p.monthlyAmountEur.toLocaleString("fr-FR")}&nbsp;€ + {p.successFeeLabel}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Le pourcentage n'est dû que si vous remportez le marché.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {expertPlans[0].features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full" variant="secondary">
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    "Accompagnement Chef de projet AO",
                  )}`}
                >
                  Demander un devis
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="text-center text-xs text-muted-foreground border-t border-border pt-6">
          {PRICING_FOOTNOTE} · Offres Chef de projet AO sur devis, facturées au dossier.
        </section>
      </main>
    </div>
  );
};

export default PricingPage;
