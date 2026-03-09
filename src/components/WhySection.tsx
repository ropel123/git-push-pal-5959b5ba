import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Eye, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

const advantages = [
  {
    icon: Eye,
    title: "Vision end-to-end",
    description: "Nous couvrons l'intégralité du cycle, du sourcing à la livraison finale."
  },
  {
    icon: Zap,
    title: "Expertise PMO + Design",
    description: "L'alliance rare entre rigueur opérationnelle et excellence créative."
  },
  {
    icon: TrendingUp,
    title: "Approche business",
    description: "Nous raisonnons ROI et impact, pas uniquement exécution."
  },
  {
    icon: CheckCircle2,
    title: "Méthodologie éprouvée",
    description: "Des process testés sur des centaines d'appels d'offres."
  }
];

const WhySection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="section-padding bg-background relative">
      <div className="section-container" ref={ref}>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-primary font-medium uppercase tracking-wider text-sm mb-4 block">
              Pourquoi nous ?
            </span>
            <h2 className={`headline-lg mb-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              Ce qui fait la différence <span className="text-gradient-orange">HACKIFY</span>
            </h2>
            <p className={`body-lg transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              HACKIFY est un partenaire stratégique qui comprend les enjeux business et transforme chaque appel d'offres en opportunité de croissance.
            </p>
          </div>

          <div className="space-y-4">
            {advantages.map((advantage, index) => (
              <div
                key={advantage.title}
                className={`flex items-start gap-4 p-4 rounded-xl border border-transparent
                           hover:bg-card hover:border-border/50 transition-all duration-300
                           ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
                style={{ transitionDelay: `${(index + 2) * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <advantage.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-1">
                    {advantage.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {advantage.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhySection;
