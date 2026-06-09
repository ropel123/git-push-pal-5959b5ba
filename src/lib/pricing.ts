/**
 * HackAO — catalogue tarifaire & mapping Stripe.
 *
 * Remplis chaque `priceId` avec ton vrai Stripe Price ID (Dashboard → Products).
 * Tant qu'un Price ID vaut une chaîne `price_TODO_*`, le bouton "S'abonner"
 * affichera une alerte plutôt que d'appeler Stripe.
 */

export type PlanCategory = "sourcing" | "assistant" | "expert";

export interface Plan {
  id: string;
  category: PlanCategory;
  name: string;
  priceLabel: string;
  monthlyAmountEur: number;
  description: string;
  features: string[];
  /** Stripe Price ID (mode subscription). */
  priceId: string;
  /** Si vrai → quantité ajustable au checkout (ex: nb de sièges email). */
  quantityAdjustable?: boolean;
  highlight?: boolean;
  /** Si vrai → pas de Checkout direct, CTA "Contact" (ex: marchés > 1M€ avec %). */
  contactOnly?: boolean;
  /** CTA personnalisé. */
  cta?: string;
}

export const PLANS: Plan[] = [
  // === Sourcing ===
  {
    id: "sourcing_monthly",
    category: "sourcing",
    name: "Sourcing",
    priceLabel: "99 € HT / mois",
    monthlyAmountEur: 99,
    description: "Veille illimitée sur toutes les plateformes acheteurs.",
    features: [
      "Alertes illimitées",
      "Accès complet à la plateforme HackAO",
      "Filtres intelligents par profil entreprise",
      "1 utilisateur inclus",
    ],
    priceId: "price_TODO_sourcing_99",
    highlight: true,
  },
  {
    id: "sourcing_extra_email",
    category: "sourcing",
    name: "Email supplémentaire",
    priceLabel: "20 € / mois / email",
    monthlyAmountEur: 20,
    description: "Ajoutez des destinataires aux alertes de veille.",
    features: [
      "Quantité ajustable au moment du paiement",
      "Mêmes filtres que l'abonnement principal",
    ],
    priceId: "price_TODO_sourcing_extra_email_20",
    quantityAdjustable: true,
  },

  // === Assistant IA ===
  {
    id: "assistant_starter",
    category: "assistant",
    name: "Starter",
    priceLabel: "99 € / mois",
    monthlyAmountEur: 99,
    description: "Pour tester la rédaction IA sur un AO.",
    features: ["1 AO traité par mois", "Mémoire technique IA", "Analyse Claude 3.5 Sonnet"],
    priceId: "price_TODO_assistant_starter_99",
  },
  {
    id: "assistant_pro",
    category: "assistant",
    name: "Pro",
    priceLabel: "250 € / mois",
    monthlyAmountEur: 250,
    description: "Le bon équilibre pour les TPE/PME qui répondent régulièrement.",
    features: ["3 AO traités par mois", "Génération mémoire technique", "Assistant chiffrage IA"],
    priceId: "price_TODO_assistant_pro_250",
    highlight: true,
  },
  {
    id: "assistant_business",
    category: "assistant",
    name: "Business",
    priceLabel: "450 € / mois",
    monthlyAmountEur: 450,
    description: "Pour les équipes qui répondent en volume.",
    features: ["10 AO traités par mois", "Génération PDF/PPTX", "Priorité support"],
    priceId: "price_TODO_assistant_business_450",
  },

  // === Chef de projet AO (offres mixtes fixe + % → contact) ===
  {
    id: "expert_under_1m",
    category: "expert",
    name: "Accompagnement < 1 M€",
    priceLabel: "500 € HT + 1 % du marché gagné",
    monthlyAmountEur: 500,
    description: "Un chef de projet AO + l'IA pour rédiger et déposer un dossier complet.",
    features: [
      "Fixe : 500 € HT à la signature",
      "Incentive : 1 % uniquement si le marché est remporté",
      "Pilotage de A à Z par un expert humain",
    ],
    priceId: "price_TODO_expert_under_1m",
    contactOnly: true,
    cta: "Demander un devis",
  },
  {
    id: "expert_over_1m",
    category: "expert",
    name: "Accompagnement > 1 M€",
    priceLabel: "2 000 € HT + 0,5 % du marché gagné",
    monthlyAmountEur: 2000,
    description: "Même service, adapté aux grands comptes.",
    features: [
      "Fixe : 2 000 € HT couvrant la préparation",
      "Incentive : 0,5 % récompense la victoire",
      "Dédié grands comptes & marchés stratégiques",
    ],
    priceId: "price_TODO_expert_over_1m",
    contactOnly: true,
    cta: "Demander un devis",
  },
];

export const isPriceConfigured = (priceId: string) => !priceId.startsWith("price_TODO_");

export const plansByCategory = (cat: PlanCategory) =>
  PLANS.filter((p) => p.category === cat);

/**
 * Synonymes de procédure_type pour le filtre côté Recherche.
 * Les sources scrapées remontent plusieurs libellés bruts ; on les regroupe
 * sous une étiquette canonique pour offrir un filtre lisible.
 */
export const PROCEDURE_SYNONYMS: Record<string, string[]> = {
  "Appel d'offres ouvert": [
    "Appel d'offres ouvert",
    "Appel d'Offres Ouvert",
    "Procédure Ouverte",
    "AOO",
    "open",
  ],
  "Appel d'offres restreint": [
    "Appel d'offres restreint",
    "Procédure Restreinte",
    "restricted",
  ],
  "Procédure adaptée (MAPA)": [
    "Procédure adaptée (MAPA)",
    "MAPA",
    "Procédure Adaptée",
    "Procédure adaptée ouverte",
    "Procédure adaptée à une enveloppe",
  ],
  "Dialogue compétitif": ["Dialogue compétitif", "comp-dial"],
  "Procédure négociée": [
    "Procédure négociée",
    "neg-w-call",
    "neg-wo-call",
  ],
  "Concours": ["Concours"],
  "Marché de gré à gré": ["Marché de gré à gré", "oth-single"],
  "Accord-cadre": ["Accord-cadre"],
};
