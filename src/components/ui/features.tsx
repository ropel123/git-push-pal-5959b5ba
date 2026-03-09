import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface Feature {
  id: number;
  icon: React.ElementType;
  title: string;
  description: string;
  image?: string;
  component?: React.ReactNode;
}

interface FeaturesProps {
  features: Feature[];
  title?: string;
  subtitle?: string;
  label?: string;
}

export function Features({
  features,
  title = "HACKIFY, votre allié stratégique",
  subtitle = "Nous prenons en charge l'intégralité de la chaîne de valeur des appels d'offres, du sourcing à la formation de vos équipes.",
  label = "La solution"
}: FeaturesProps) {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [progress, setProgress] = useState(0);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => prev >= 100 ? 100 : prev + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [currentFeature]);

  useEffect(() => {
    if (progress >= 100) {
      setTimeout(() => {
        setCurrentFeature(prev => (prev + 1) % features.length);
        setProgress(0);
      }, 200);
    }
  }, [progress, features.length]);

  useEffect(() => {
    const activeFeatureElement = featureRefs.current[currentFeature];
    const container = containerRef.current;
    if (activeFeatureElement && container) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = activeFeatureElement.getBoundingClientRect();
      container.scrollTo({
        left: activeFeatureElement.offsetLeft - (containerRect.width - elementRect.width) / 2,
        behavior: "smooth"
      });
    }
  }, [currentFeature]);

  const handleFeatureClick = (index: number) => {
    setCurrentFeature(index);
    setProgress(0);
  };

  return (
    <section className="section-padding bg-card relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />

      <div className="section-container relative z-10">
        <div className="text-center mb-8 md:mb-12">
          <span className="text-primary font-medium uppercase tracking-wider text-sm mb-4 block">
            {label}
          </span>
          <h2 className="headline-lg mb-4 text-xl md:text-3xl lg:text-4xl leading-tight">
            {title.includes("l'intégralité") ? (
              <>
                Nous prenons en charge <span className="text-gradient-orange">l'intégralité de la chaîne de valeur</span> des appels d'offres, du sourcing à la formation de vos équipes.
              </>
            ) : title}
          </h2>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isActive = currentFeature === index;
            return (
              <div
                key={feature.id}
                ref={el => { featureRefs.current[index] = el; }}
                className="cursor-pointer"
                onClick={() => handleFeatureClick(index)}
              >
                <div className={`p-4 rounded-xl border transition-all duration-300 ${isActive ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? "bg-primary/20" : "bg-muted"}`}>
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <h3 className={`font-display font-semibold text-sm transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {feature.title}
                    </h3>
                  </div>

                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-sm leading-relaxed text-muted-foreground mb-3">
                        {feature.description}
                      </p>
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted border border-border">
                        {feature.component ? (
                          <motion.div className="w-full h-full flex items-center justify-center p-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                            {feature.component}
                          </motion.div>
                        ) : (
                          <img src={feature.image} alt={feature.title} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="h-1 bg-muted rounded-full mt-3 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.1, ease: "linear" }}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div ref={containerRef} className="flex flex-col gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = currentFeature === index;
              return (
                <div
                  key={feature.id}
                  ref={el => { featureRefs.current[index] = el; }}
                  className="relative cursor-pointer"
                  onClick={() => handleFeatureClick(index)}
                >
                  <div className={`p-4 rounded-xl border transition-all duration-300 ${isActive ? "bg-primary/10 border-primary/30" : "bg-card border-border hover:border-primary/20 hover:bg-muted/50"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? "bg-primary/20" : "bg-muted"}`}>
                        <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <h3 className={`font-display font-semibold transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {feature.title}
                      </h3>
                    </div>
                    <p className={`text-sm leading-relaxed transition-colors ${isActive ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                      {feature.description}
                    </p>
                    <div className="h-1 bg-muted rounded-full mt-3 overflow-hidden">
                      {isActive && (
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.1, ease: "linear" }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center">
            {features[currentFeature].component ? (
              <motion.div
                key={currentFeature}
                className="w-full h-full flex items-center justify-center p-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {features[currentFeature].component}
              </motion.div>
            ) : (
              <motion.img
                key={currentFeature}
                src={features[currentFeature].image}
                alt={features[currentFeature].title}
                className="w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
