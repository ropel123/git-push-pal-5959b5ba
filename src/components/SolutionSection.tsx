import { Search, Briefcase, PenTool, Database, GraduationCap } from 'lucide-react';
import { Features } from '@/components/ui/features';
import TenderNotifications from '@/components/ui/tender-notifications';
import BeforeAfterSlides from '@/components/ui/before-after-slides';
import BidTimeline from '@/components/ui/bid-timeline';
import KnowledgeCycle from '@/components/ui/knowledge-cycle';
import HackademyVisual from '@/components/ui/hackademy-visual';

const features = [
  {
    id: 1,
    icon: Search,
    title: "Sourcing d'appels d'offres",
    description: "Vous recevez tous les matins des opportunités sur votre boîte mail.",
    component: <TenderNotifications />,
  },
  {
    id: 2,
    icon: Briefcase,
    title: "Bid Management & PMO",
    description: "Un chef de projet dédié vous accompagne sur la rédaction de votre mémoire technique, votre discours commercial et coordonne le process de réponse.",
    component: <BidTimeline />,
  },
  {
    id: 3,
    icon: PenTool,
    title: "Design & Impact",
    description: "Une graphiste va structurer votre proposition commerciale pour structurer les messages et maximiser l'impact.",
    component: <BeforeAfterSlides />,
  },
  {
    id: 4,
    icon: Database,
    title: "Knowledge Management",
    description: "Templates réutilisables, capitalisation des contenus et industrialisation des process AO.",
    component: <KnowledgeCycle />,
  },
  {
    id: 5,
    icon: GraduationCap,
    title: "Hackademy",
    description: "Formation des équipes (Assistantes, Marketing, Commerciaux) et coaching sur mesure.",
    component: <HackademyVisual />,
  },
];

const SolutionSection = () => {
  return (
    <Features
      features={features}
      title="Nous prenons en charge l'intégralité de la chaîne de valeur des appels d'offres, du sourcing à la formation de vos équipes."
      subtitle="Nous prenons en charge l'intégralité de la chaîne de valeur des appels d'offres, du sourcing à la formation de vos équipes."
      label="Nos expertises"
    />
  );
};

export default SolutionSection;
