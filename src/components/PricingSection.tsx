import { Bot, Users, Check, ArrowRight } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const packs = [
  {
    icon: Bot,
    title: "Pack IA",
    price: "À partir de 490€",
    unit: "/ dossier",
    features: [
      "Analyse automatique de l'AO par l'IA",
      "Génération du mémoire technique",
      "Recommandations stratégiques",
      "Revue par notre équipe",
    ],
    cta: "Demander un devis",
    highlighted: false,
  },
  {
    icon: Users,
    title: "Accompagnement Premium",
    price: "Sur mesure",
    unit: "",
    badge: "Recommandé",
    features: [
      "Tout le Pack IA inclus",
      "Chef de projet dédié",
      "Coaching personnalisé avec un expert",
      "Rendez-vous de suivi réguliers",
      "Mise en page professionnelle",
      "Relecture et optimisation finale",
    ],
    cta: "Planifier un échange",
    highlighted: true,
  },
];

const PricingSection = () => {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section ref={ref} className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4 max-w-5xl">
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">
            Nos offres
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 text-foreground">
            Choisissez l'accompagnement adapté à vos ambitions
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            De l'analyse IA automatisée à l'accompagnement humain complet, nous vous aidons à remporter vos marchés publics.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {packs.map((pack, i) => {
            const Icon = pack.icon;
            return (
              <Card
                key={pack.title}
                className={`relative transition-all duration-700 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                } ${
                  pack.highlighted
                    ? "border-primary shadow-lg shadow-primary/10"
                    : "border-border"
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                {pack.badge && (
                  <Badge className="absolute -top-3 right-6">
                    {pack.badge}
                  </Badge>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{pack.title}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {pack.price}
                    </span>
                    {pack.unit && (
                      <span className="text-muted-foreground text-sm">
                        {pack.unit}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-8">
                    {pack.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-2"
                    variant={pack.highlighted ? "default" : "outline"}
                  >
                    {pack.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
