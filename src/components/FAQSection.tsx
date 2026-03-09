import { useState } from "react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Comment fonctionne votre service de sourcing d'appels d'offres ?",
    answer: "Notre équipe effectue une veille quotidienne sur l'ensemble des plateformes de marchés publics. Chaque matin, vous recevez directement dans votre boîte mail une sélection d'opportunités qualifiées correspondant à vos critères (secteur, zone géographique, montant, mots-clés). Vous ne passez plus à côté d'aucune opportunité."
  },
  {
    question: "Quel est le rôle du chef de projet dédié ?",
    answer: "Votre chef de projet HACKIFY coordonne l'ensemble du processus de réponse : planification du rétro-planning, animation des réunions de production, rédaction et structuration du mémoire technique, préparation du discours commercial. Il est votre interlocuteur unique et garantit le respect des délais."
  },
  {
    question: "En quoi consiste le service Design & Impact ?",
    answer: "Notre graphiste intervient pour transformer votre proposition commerciale en un document à fort impact visuel. Elle structure les messages clés, crée des infographies, optimise la mise en page et s'assure que votre offre se démarque visuellement de la concurrence."
  },
  {
    question: "Qu'est-ce que la Hackademy ?",
    answer: "La Hackademy est notre programme de formation spécialisé sur les appels d'offres. Nous formons vos équipes aux meilleures pratiques : veille stratégique, rédaction de mémoires techniques, techniques de pricing, préparation aux soutenances orales. Formations inter ou intra-entreprise disponibles."
  },
  {
    question: "Quels types d'entreprises accompagnez-vous ?",
    answer: "Nous accompagnons des ETI et grands groupes de tous secteurs : BTP, IT & Digital, Conseil, Industrie, Services. Nos clients partagent un point commun : ils souhaitent professionnaliser leur approche des marchés publics et augmenter leur taux de transformation."
  },
  {
    question: "Combien de temps dure un accompagnement type ?",
    answer: "La durée varie selon vos besoins : de la mission ponctuelle sur un appel d'offres stratégique (2-4 semaines) à l'accompagnement récurrent avec sourcing quotidien et support à la demande. Nous définissons ensemble la formule la plus adaptée à votre volume et vos objectifs."
  },
  {
    question: "Travaillez-vous sur les marchés publics et privés ?",
    answer: "Nous intervenons principalement sur les marchés publics (État, collectivités, établissements publics) mais également sur les appels d'offres privés de grands comptes. Notre méthodologie s'adapte aux spécificités de chaque type de consultation."
  }
];

const FAQItemComponent = ({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) => {
  return (
    <div className="border-b border-white/10">
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-medium text-white group-hover:text-primary transition-colors pr-4">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-primary" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-white/70 leading-relaxed">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQSection = () => {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section ref={ref} className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-medium tracking-wider uppercase mb-4 block">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Questions fréquentes
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Tout ce que vous devez savoir sur nos services d'accompagnement aux appels d'offres.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          {faqs.map((faq, index) => (
            <FAQItemComponent
              key={index}
              item={faq}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-white/50 text-sm">
            Vous avez d'autres questions ?{" "}
            <a
              href="https://calendly.com/hackifyao"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Prenez rendez-vous
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
