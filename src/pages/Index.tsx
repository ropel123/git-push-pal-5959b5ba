import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustSection from "@/components/TrustSection";
import FeaturedSectionStats from "@/components/ui/featured-section-stats";
import ProblemsSection from "@/components/ProblemsSection";
import SolutionSection from "@/components/SolutionSection";
import TargetSection from "@/components/TargetSection";
import WhySection from "@/components/WhySection";
import ProcessSection from "@/components/ProcessSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import HoverFooter from "@/components/HoverFooter";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <TrustSection />
      <FeaturedSectionStats />
      <ProblemsSection />
      <SolutionSection />
      <TargetSection />
      <WhySection />
      <ProcessSection />
      <FAQSection />
      <CTASection />
      <HoverFooter />
    </main>
  );
};

export default Index;
