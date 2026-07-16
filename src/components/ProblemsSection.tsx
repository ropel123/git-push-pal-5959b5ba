import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { AlertTriangle, Clock, Users, FileX } from 'lucide-react';

const problems = [
  {
    icon: AlertTriangle,
    title: "Veille non exhaustive",
    description: "Sans outils IA adaptés, vous passez à côté d'appels d'offres stratégiques invisibles sur les canaux traditionnels.",
  },
  {
    icon: Clock,
    title: "Pression des délais",
    description: "Les échéances serrées et le manque d'automatisation compromettent la qualité de vos réponses.",
  },
  {
    icon: Users,
    title: "Coordination difficile",
    description: "Vos équipes travaillent en silo sans chef de projet dédié pour animer les échanges et la production",
  },
  {
    icon: FileX,
    title: "Professionnalisation de vos concurrents",
    description: "Vos concurrents se professionnalisent et utilisent déjà l'IA pour produire des offres différenciantes.",
  },
];

const ProblemsSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="section-padding bg-background relative">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="section-container" ref={ref}>
        <div className="text-center mb-16">
          <span className="text-primary font-medium uppercase tracking-wider text-sm mb-4 block">
            Les défis
          </span>
          <h2 className={`headline-lg max-w-3xl mx-auto transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Ces problèmes freinent votre <span className="text-gradient-orange">croissance</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((problem, index) => (
            <div
              key={problem.title}
              className={`card-premium text-center transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-14 h-14 mx-auto mb-6 rounded-xl bg-primary/10 flex items-center justify-center">
                <problem.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3 text-foreground">
                {problem.title}
              </h3>
              <p className="body-md">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;
