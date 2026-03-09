import Hero from "@/components/ui/animated-shader-hero";

const HeroSection = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Hero
      trustBadge={{
        text: "Cabinet de conseil en appels d'offres"
      }}
      headline={{
        line1: "From sourcing to winning",
        line2: ""
      }}
      subtitle="HACKIFY combine expertise humaine et intelligence artificielle pour vous accompagner sur toute la chaîne de valeur des appels d'offres. Du sourcing IA à la victoire."
      buttons={{
        primary: {
          text: "Réserver un audit stratégique",
          href: "https://calendly.com/hackifyao"
        },
        secondary: {
          text: "Découvrir nos services",
          onClick: () => scrollToSection('services')
        }
      }}
    />
  );
};

export default HeroSection;
