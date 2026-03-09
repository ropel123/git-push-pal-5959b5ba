import { Sparkles } from "@/components/ui/sparkles";
import logoForvisMazars from "@/assets/logo-forvis-mazars.png";
import logoColliers from "@/assets/logo-colliers.png";
import logoNuklear from "@/assets/logo-nuklear.png";
import logoCbre from "@/assets/logo-cbre.png";
import logoJll from "@/assets/logo-jll.png";

const logos = [
  { name: 'Forvis Mazars', src: logoForvisMazars },
  { name: 'Colliers', src: logoColliers },
  { name: 'Nuklear', src: logoNuklear },
  { name: 'CBRE', src: logoCbre },
  { name: 'JLL', src: logoJll },
];

const TrustSection = () => {
  return (
    <section className="relative w-full overflow-hidden bg-black">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10" />
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)/0.15),transparent)]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center justify-center overflow-hidden rounded-lg py-20 md:py-28">
        <div className="relative z-10 flex flex-col items-center text-center px-4">
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Ils nous font confiance
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-12">
            Utilisé par les leaders du marché.
          </h2>

          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 w-full max-w-5xl">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className="group flex items-center justify-center h-20 transition-all duration-300"
              >
                <img
                  src={logo.src}
                  alt={logo.name}
                  className={`object-contain grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 ${
                    logo.name === 'Colliers' ? 'h-20 md:h-28 opacity-70' :
                    logo.name === 'JLL' ? 'h-10 md:h-14 opacity-90 brightness-150' :
                    logo.name === 'CBRE' ? 'h-8 md:h-12 opacity-90 brightness-125' :
                    'h-14 md:h-20 opacity-90 brightness-125'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 z-0">
          <Sparkles
            density={600}
            speed={0.8}
            size={1.2}
            color="hsl(24, 95%, 53%)"
            className="absolute inset-0 h-full w-full"
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-primary/10 to-transparent blur-xl" />
      </div>
    </section>
  );
};

export default TrustSection;
