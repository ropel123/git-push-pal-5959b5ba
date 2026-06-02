import React from 'react';

interface HeroProps {
  trustBadge?: {
    text: string;
    icons?: string[];
  };
  headline: {
    line1: string;
    line2: string;
  };
  subtitle: string;
  buttons?: {
    primary?: {
      text: string;
      onClick?: () => void;
      href?: string;
    };
    secondary?: {
      text: string;
      onClick?: () => void;
    };
  };
  className?: string;
}

const Hero: React.FC<HeroProps> = ({
  trustBadge,
  headline,
  subtitle,
  buttons,
  className = ""
}) => {
  return (
    <div className={`relative min-h-screen w-full overflow-hidden bg-background ${className}`}>
      <style>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, 30px) scale(1.08); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.8s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; opacity: 0; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        .animation-delay-600 { animation-delay: 0.6s; }
        .animation-delay-800 { animation-delay: 0.8s; }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient { background-size: 200% 200%; animation: gradient-shift 6s ease infinite; }
      `}</style>

      {/* Subtle brand gradient background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.14] blur-[110px]"
          style={{
            background: 'radial-gradient(circle, hsl(224 76% 56%) 0%, transparent 70%)',
            animation: 'float-slow 22s ease-in-out infinite'
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full opacity-[0.18] blur-[110px]"
          style={{
            background: 'radial-gradient(circle, hsl(42 90% 70%) 0%, transparent 70%)',
            animation: 'float-slower 26s ease-in-out infinite'
          }}
        />
        <div
          className="absolute top-[30%] right-[15%] w-[35%] h-[35%] rounded-full opacity-[0.08] blur-[90px]"
          style={{
            background: 'radial-gradient(circle, hsl(224 76% 56%) 0%, transparent 70%)',
            animation: 'float-slow 19s ease-in-out infinite reverse'
          }}
        />
      </div>

      {/* Soft bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-background z-[1]" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        {trustBadge && (
          <div className="animate-fade-in-down mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/60 shadow-sm">
              {trustBadge.icons && (
                <div className="flex -space-x-1">
                  {trustBadge.icons.map((icon, index) => (
                    <span key={index} className="text-lg">{icon}</span>
                  ))}
                </div>
              )}
              <span className="text-sm text-muted-foreground font-medium">{trustBadge.text}</span>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="animate-fade-in-up animation-delay-200 text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground">
              {headline.line1}
            </h1>
            {headline.line2 && (
              <h1 className="animate-fade-in-up animation-delay-400 text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary/70 bg-clip-text text-transparent animate-gradient">
                {headline.line2}
              </h1>
            )}
          </div>

          <div className="mb-10">
            <p className="animate-fade-in-up animation-delay-600 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          </div>

          {buttons && (
            <div className="animate-fade-in-up animation-delay-800 flex flex-col sm:flex-row items-center justify-center gap-4">
              {buttons.primary && (
                buttons.primary.href ? (
                  <a href={buttons.primary.href} target="_blank" rel="noopener noreferrer" className="btn-primary group">
                    {buttons.primary.text}
                  </a>
                ) : (
                  <button onClick={buttons.primary.onClick} className="btn-primary group">
                    {buttons.primary.text}
                  </button>
                )
              )}
              {buttons.secondary && (
                <button onClick={buttons.secondary.onClick} className="btn-outline">
                  {buttons.secondary.text}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
