import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Search, Target, PenTool, Send } from 'lucide-react';

const steps = [
  {
    icon: Search,
    number: "01",
    title: "Sourcing & Qualification",
    description: "Identification des appels d'offres stratégiques et analyse de leur potentiel.",
  },
  {
    icon: Target,
    number: "02",
    title: "Cadrage & Pilotage",
    description: "Définition du rétroplanning, mobilisation des équipes et gouvernance du projet.",
  },
  {
    icon: PenTool,
    number: "03",
    title: "Production & Design",
    description: "Rédaction, structuration et mise en forme premium de votre proposition.",
  },
  {
    icon: Send,
    number: "04",
    title: "Livraison & Dépôt",
    description: "Contrôle qualité final et dépôt dans les délais impartis.",
  },
];

const ProcessSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="section-padding bg-card relative overflow-hidden">
      <div className="section-container" ref={ref}>
        <div className="text-center mb-16">
          <span className="text-primary font-medium uppercase tracking-wider text-sm mb-4 block">
            Notre approche
          </span>
          <h2 className={`headline-lg max-w-3xl mx-auto transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Un process <span className="text-gradient-orange">clair</span> et rassurant
          </h2>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className={`relative text-center transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="relative z-10 w-20 h-20 mx-auto mb-6 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center group hover:border-primary transition-colors">
                  <step.icon className="w-8 h-8 text-primary" />
                  <span className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {step.number}
                  </span>
                </div>

                <h3 className="font-display text-lg font-semibold mb-2 text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProcessSection;
