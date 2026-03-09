import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Building2, Building, Rocket, Server, Briefcase } from 'lucide-react';

const targets = [
  { icon: Building2, label: "PME & ETI" },
  { icon: Building, label: "Grands comptes" },
  { icon: Rocket, label: "Startups B2B" },
  { icon: Server, label: "ESN" },
  { icon: Briefcase, label: "Cabinets de conseil" },
];

const TargetSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-12 bg-background border-y border-white/5" ref={ref}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          <span className={`text-white/50 text-sm font-medium uppercase tracking-wider whitespace-nowrap transition-all duration-500 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}>
            Pour qui ?
          </span>

          <div className="flex flex-wrap justify-center gap-3">
            {targets.map((target, index) => (
              <div
                key={target.label}
                className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full
                           hover:border-primary/40 hover:bg-white/10 transition-all duration-300
                           ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${index * 75}ms` }}
              >
                <target.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-white/80">{target.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TargetSection;
