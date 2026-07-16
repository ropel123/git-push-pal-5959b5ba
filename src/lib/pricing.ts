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
  /** Palier de volume pour la gamme Assistant IA (AO traités / mois). */
  aoPerMonth?: number;
  /** Commission au succès (offres Chef de projet AO), ex. "1 %". */
  successFeeLabel?: string;
}

/**
 * Socle commun aux paliers Assistant IA — seul le volume d'AO varie
 * (le palier Business ajoute en plus le support prioritaire).
 */
export const ASSISTANT_FEATURES = [
  "Analyse IA du DCE + recommandation Go / No-Go",
  "Mémoire technique rédigé depuis vos documents",
  "Assistant chiffrage",
  "Export PDF / PPTX",
];

/** Contenu commun aux deux paliers Chef de projet AO. */
export const EXPERT_FEATURES = [
  "Analyse du DCE et stratégie de réponse",
  "Rédaction complète du dossier",
  "Dépôt sur la plateforme acheteur",
  "Interlocuteur dédié de A à Z",
];

/** Mention affichée une seule fois sous chaque grille de tarifs. */
export const PRICING_FOOTNOTE =
  "Tous les prix s'entendent HT · Abonnements sans engagement, annulables à tout moment · Paiement sécurisé Stripe";

export const PLANS: Plan[] = [
  // === Veille ===
  {
    id: "sourcing_monthly",
    category: "sourcing",
    name: "Veille",
    monthlyAmountEur: 99,
    description: "Toute votre veille AO, automatique et en temps réel.",
    features: [
      "Alertes illimitées, en temps réel",
      "Les principales plateformes acheteurs surveillées en continu",
      "Filtres intelligents par profil entreprise",
      "Accès complet à la plateforme HackAO",
      "1 utilisateur inclus",
    ],
    priceId: "price_TODO_sourcing_99",
  },
  {
    id: "sourcing_extra_email",
    category: "sourcing",
    name: "Destinataire supplémentaire",
    monthlyAmountEur: 20,
    description: "Option de l'offre Veille : ajoutez des destinataires aux alertes.",
    features: [
      "Quantité ajustable au moment du paiement",
      "Mêmes filtres que l'abonnement principal",
    ],
    priceId: "price_TODO_sourcing_extra_email_20",
    quantityAdjustable: true,
  },

  // === Assistant IA (une offre, trois paliers de volume) ===
  {
    id: "assistant_starter",
    category: "assistant",
    name: "Starter",
    monthlyAmountEur: 99,
    aoPerMonth: 1,
    description: "Pour tester la rédaction IA sur un AO.",
    features: ["1 AO traité par mois", ...ASSISTANT_FEATURES],
    priceId: "price_TODO_assistant_starter_99",
  },
  {
    id: "assistant_pro",
    category: "assistant",
    name: "Pro",
    monthlyAmountEur: 250,
    aoPerMonth: 3,
    description: "Le bon équilibre pour les TPE/PME qui répondent régulièrement.",
    features: ["3 AO traités par mois", ...ASSISTANT_FEATURES],
    priceId: "price_TODO_assistant_pro_250",
    highlight: true,
  },
  {
    id: "assistant_business",
    category: "assistant",
    name: "Business",
    monthlyAmountEur: 450,
    aoPerMonth: 10,
    description: "Pour les équipes qui répondent en volume.",
    features: ["10 AO traités par mois", ...ASSISTANT_FEATURES, "Support prioritaire"],
    priceId: "price_TODO_assistant_business_450",
  },

  // === Chef de projet AO (forfait + commission au succès → contact) ===
  {
    id: "expert_under_1m",
    category: "expert",
    name: "Marché jusqu'à 1 M€",
    monthlyAmountEur: 500,
    description: "Un chef de projet AO + l'IA pour rédiger et déposer un dossier complet.",
    features: EXPERT_FEATURES,
    priceId: "price_TODO_expert_under_1m",
    contactOnly: true,
    cta: "Demander un devis",
    successFeeLabel: "1 %",
  },
  {
    id: "expert_over_1m",
    category: "expert",
    name: "Marché au-delà de 1 M€",
    monthlyAmountEur: 2000,
    description: "Le même accompagnement, dimensionné pour les grands comptes et marchés stratégiques.",
    features: EXPERT_FEATURES,
    priceId: "price_TODO_expert_over_1m",
    contactOnly: true,
    cta: "Demander un devis",
    successFeeLabel: "0,5 %",
  },
];

export const isPriceConfigured = (priceId: string) => !priceId.startsWith("price_TODO_");

export const plansByCategory = (cat: PlanCategory) =>
  PLANS.filter((p) => p.category === cat);

/** Récupère un plan par id, en échouant explicitement si le catalogue change. */
export const getPlan = (id: string): Plan => {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Plan inconnu dans le catalogue pricing : ${id}`);
  return plan;
};

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
