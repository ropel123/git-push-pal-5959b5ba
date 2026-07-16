import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { ArrowRight, Calendar } from 'lucide-react';

const CTASection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="contact" className="section-padding bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />

      <div className="section-container relative z-10" ref={ref}>
        <div className="max-w-3xl mx-auto text-center">
          <span className={`text-primary font-medium uppercase tracking-wider text-sm mb-4 block transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Prêt à gagner ?
          </span>

          <h2 className={`headline-lg mb-6 transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Transformez vos appels d'offres en <span className="text-gradient-orange">succès</span>
          </h2>

          <p className={`body-lg mb-10 transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Échangeons 20 minutes pour analyser votre situation et identifier
            les leviers d'amélioration de votre performance AO.
          </p>

          <div className={`flex flex-col items-center justify-center gap-2 transition-all duration-700 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <a
              href="https://calendly.com/hackifyao"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary group text-lg"
            >
              <Calendar className="w-5 h-5" />
              Planifier un échange stratégique
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          <p className={`mt-8 text-sm text-muted-foreground transition-all duration-700 delay-400 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            ✓ Confidentiel  ·  ✓ Sans engagement  ·  ✓ Audit offert
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
