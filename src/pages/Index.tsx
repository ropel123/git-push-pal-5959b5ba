import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Check,
  Sparkles,
  Search,
  Brain,
  Users,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  Building2,
  FileText,
  Award,
} from "lucide-react";
import HackaoLogo from "@/components/brand/HackaoLogo";
import { PLANS } from "@/lib/pricing";

const Index = () => {
  const sourcing = PLANS.find((p) => p.id === "sourcing_monthly")!;
  const assistantPlans = PLANS.filter((p) => p.category === "assistant");
  const expertPlans = PLANS.filter((p) => p.category === "expert");

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ===== NAV ===== */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <HackaoLogo className="h-7" />
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#problem" className="text-muted-foreground hover:text-foreground">Problème</a>
            <a href="#how" className="text-muted-foreground hover:text-foreground">Comment ça marche</a>
            <a href="#offers" className="text-muted-foreground hover:text-foreground">Offres</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Connexion</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/pricing">Démarrer <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center space-y-6">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Sparkles className="h-3 w-3 mr-1" /> Plateforme IA pour la commande publique
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto">
            Gagnez plus d'<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">appels d'offres</span>, deux fois plus vite.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            HackAO unifie la veille, l'analyse IA et la rédaction de mémoires techniques pour les PME et ETI françaises. De la détection au dépôt — en un seul outil.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" asChild>
              <Link to="/pricing">Voir les tarifs <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Essayer la plateforme</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-2">Sans engagement · Annulable à tout moment · Paiement sécurisé Stripe</p>

          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto pt-10">
            {[
              { v: "22 000+", l: "AO surveillés" },
              { v: "8 h → 1 h", l: "Pour répondre à un AO" },
              { v: "100 %", l: "Conforme RGPD" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <p className="text-2xl md:text-3xl font-bold">{s.v}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PROBLEM ===== */}
      <section id="problem" className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold">Répondre à un appel d'offres,<br />c'est un parcours du combattant.</h2>
            <p className="text-muted-foreground">Vous le savez : la commande publique est une mine d'or… qui demande trop de temps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, t: "Trop de temps perdu", d: "8 h en moyenne pour analyser un DCE et rédiger un mémoire technique." },
              { icon: Search, t: "Veille éclatée", d: "BOAMP, plateformes acheteurs, TED… vos opportunités sont noyées." },
              { icon: FileText, t: "Mémoires standardisés", d: "Vous perdez en finesse, donc en notation technique." },
            ].map((p) => (
              <Card key={p.t} className="border-border">
                <CardContent className="p-6 space-y-3">
                  <p.icon className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-lg">{p.t}</h3>
                  <p className="text-sm text-muted-foreground">{p.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SOLUTION / HOW ===== */}
      <section id="how" className="py-20 bg-card/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline">La solution</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Un seul outil, du sourcing au dépôt.</h2>
            <p className="text-muted-foreground">Pensé avec des consultants AO et des PME qui répondent au quotidien.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", icon: Search, t: "Veille intelligente", d: "Scraping en continu de toutes les plateformes acheteurs publiques. Alertes filtrées sur votre profil entreprise." },
              { n: "02", icon: Brain, t: "Analyse IA", d: "Claude 3.5 Sonnet décortique le DCE et produit un scoring de pertinence, des points de vigilance et un plan de réponse." },
              { n: "03", icon: Award, t: "Rédaction & dépôt", d: "Mémoire technique généré à partir de votre mémoire d'entreprise, exporté en PDF ou PPTX prêt à déposer." },
            ].map((s) => (
              <Card key={s.n} className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <s.icon className="h-7 w-7 text-primary" />
                    <span className="text-xs font-mono text-muted-foreground">{s.n}</span>
                  </div>
                  <CardTitle className="text-lg pt-2">{s.t}</CardTitle>
                  <CardDescription>{s.d}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY HACKAO ===== */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="outline">Pourquoi HackAO</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Pensé pour la PME française.</h2>
            <p className="text-muted-foreground">
              Pas un outil générique d'IA. Un produit dédié à la commande publique, opéré par des experts AO qui répondent eux-mêmes à des marchés.
            </p>
            <ul className="space-y-3">
              {[
                "IA Claude 3.5 Sonnet, fine-tunée pour les marchés publics français",
                "Données stockées en Europe, hébergement Supabase + Lovable Cloud",
                "Onboarding conversationnel : vous parlez, on construit votre mémoire technique",
                "Accompagnement humain disponible à la demande pour les marchés stratégiques",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Zap, t: "8× plus rapide", d: "Du DCE au mémoire en 1 h." },
              { icon: TrendingUp, t: "+30 % de taux de réussite", d: "Sur les marchés analysés par l'IA." },
              { icon: Shield, t: "RGPD natif", d: "Vos données restent en France." },
              { icon: Users, t: "Support humain", d: "Chef de projet AO à la demande." },
            ].map((c) => (
              <Card key={c.t}>
                <CardContent className="p-5 space-y-2">
                  <c.icon className="h-6 w-6 text-primary" />
                  <p className="font-semibold">{c.t}</p>
                  <p className="text-xs text-muted-foreground">{c.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== OFFERS ===== */}
      <section id="offers" className="py-20 bg-card/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline">Nos offres</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Tarifs simples, sans engagement.</h2>
            <p className="text-muted-foreground">Trois briques modulables : surveillez, analysez, déléguez.</p>
          </div>

          {/* Bloc Sourcing */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-8 grid md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 space-y-2">
                <Badge>Brique 1</Badge>
                <h3 className="text-2xl font-bold">{sourcing.name}</h3>
                <p className="text-muted-foreground">{sourcing.description}</p>
                <ul className="grid sm:grid-cols-2 gap-2 text-sm pt-2">
                  {sourcing.features.map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {f}</li>
                  ))}
                </ul>
              </div>
              <div className="text-center md:text-right space-y-3">
                <p className="text-4xl font-bold">{sourcing.priceLabel}</p>
                <p className="text-xs text-muted-foreground">+ 20 € / mois par email destinataire supplémentaire</p>
                <Button size="lg" className="w-full md:w-auto" asChild>
                  <Link to="/pricing">S'abonner</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bloc Assistant IA */}
          <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <Badge variant="outline">Brique 2</Badge>
                <h3 className="text-2xl font-bold mt-2">Assistant IA — rédigez vos réponses 8× plus vite</h3>
              </div>
              <Link to="/pricing" className="text-sm text-primary hover:underline">Voir le détail →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {assistantPlans.map((p) => (
                <Card key={p.id} className={p.highlight ? "border-primary shadow-md" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                      {p.highlight && <Badge>Recommandé</Badge>}
                    </div>
                    <p className="text-2xl font-bold pt-2">{p.priceLabel}</p>
                    <CardDescription>{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-2 text-sm">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}</li>
                      ))}
                    </ul>
                    <Button asChild className="w-full" variant={p.highlight ? "default" : "outline"}>
                      <Link to="/pricing">Choisir</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Bloc Chef de projet AO */}
          <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <Badge variant="outline">Brique 3</Badge>
                <h3 className="text-2xl font-bold mt-2">Chef de projet AO — la réponse clé en main</h3>
                <p className="text-muted-foreground text-sm mt-1">Fixe + incentive uniquement si le marché est gagné. Notre intérêt est aligné avec le vôtre.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {expertPlans.map((p) => (
                <Card key={p.id} className="border-accent/40">
                  <CardHeader>
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <p className="text-xl font-bold pt-2">{p.priceLabel}</p>
                    <CardDescription>{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-2 text-sm">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}</li>
                      ))}
                    </ul>
                    <Button asChild className="w-full" variant="secondary">
                      <a href="mailto:contact@hackao.fr?subject=Accompagnement%20AO">Demander un devis</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== TARGETS ===== */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold">Pour qui ?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Building2, t: "PME et ETI", d: "Vous répondez ponctuellement et vous voulez accélérer sans embaucher un consultant à temps plein." },
              { icon: Users, t: "Cabinets conseil AO", d: "Industrialisez votre back-office pour traiter 10× plus de dossiers avec la même équipe." },
              { icon: Sparkles, t: "Startups & scale-ups", d: "Adressez la commande publique sans avoir d'expert AO en interne." },
            ].map((t) => (
              <Card key={t.t} className="border-border">
                <CardContent className="p-6 space-y-3">
                  <t.icon className="h-7 w-7 text-primary" />
                  <h3 className="font-semibold text-lg">{t.t}</h3>
                  <p className="text-sm text-muted-foreground">{t.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-20 bg-card/40 border-y border-border">
        <div className="max-w-3xl mx-auto px-4 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold">Questions fréquentes</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "Y a-t-il un engagement ?", r: "Non. Tous les abonnements sont mensuels et annulables à tout moment depuis le portail Stripe." },
              { q: "Quelles plateformes scrapez-vous ?", r: "Toutes les plateformes acheteurs publiques françaises (Atexo, Marchés-Sécurisés, Maximilien, AWS, etc.). BOAMP et TED ne sont pas utilisés comme sources." },
              { q: "Mes données restent-elles confidentielles ?", r: "Oui. Hébergement Supabase Europe, RLS au niveau ligne, buckets privés, mémoire technique chiffrée." },
              { q: "L'IA est-elle vraiment fiable pour un mémoire technique ?", r: "L'IA produit un premier jet structuré à partir de votre mémoire d'entreprise. Vous gardez la main éditoriale. C'est un accélérateur, pas un automate." },
              { q: "Quelle différence avec l'offre Chef de projet AO ?", r: "L'offre Chef de projet inclut un expert humain qui pilote la réponse de bout en bout, avec un incentive aligné sur votre gain." },
            ].map((f) => (
              <details key={f.q} className="rounded-lg border border-border bg-card p-4 group">
                <summary className="font-medium cursor-pointer flex items-center justify-between">
                  {f.q}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-muted-foreground mt-3">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
            <CardContent className="p-10 text-center space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Prêt à transformer votre commercial AO ?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Commencez par la veille à 99 € / mois. Ajoutez l'IA ou le chef de projet quand vous êtes prêt.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button size="lg" asChild>
                  <Link to="/pricing">Voir les tarifs <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="mailto:contact@hackao.fr">Parler à un expert</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <HackaoLogo className="h-6" />
            <span>© {new Date().getFullYear()} HackAO. Tous droits réservés.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/pricing" className="hover:text-foreground">Tarifs</Link>
            <Link to="/auth" className="hover:text-foreground">Connexion</Link>
            <a href="mailto:contact@hackao.fr" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Index;
