/**
 * Gaston — tout le contenu du site vitrine (/ et /credits).
 *
 * Source : spécification fournie par le propriétaire du site
 * (gaston.base44.app), inaccessible depuis l'environnement de build.
 * Les textes marqués « À VÉRIFIER » n'ont pas pu être relevés sur
 * l'original : les remplacer ici suffit, aucun composant à toucher.
 */

/** Destination des CTA d'essai. À remplacer par l'URL d'inscription réelle. */
export const SIGNUP_URL = "/auth";

export const CONTACT_EMAIL = "contact@enchantier-pro.fr";
export const COMPANY_URL = "https://enchantier-pro.fr";

/* ── Header ── */
export const NAV = {
  pricingLabel: "Tarif",
  ctaLabel: "Essayer gratuitement",
};

/* ── Hero ── */
export const HERO = {
  badge: "Pour les artisans du BTP",
  titleStart: "Fini la paperasse le soir :",
  titleHighlight: "le devis commence sur le chantier.",
  // À VÉRIFIER — paragraphe d'introduction exact de l'original.
  intro:
    "Dictez ou notez vos observations sur place : Gaston les transforme en devis professionnel, prêt à envoyer. Vous restez concentré sur le chantier, il s'occupe du bureau.",
  cta: "Essayer gratuitement",
};

/* ── Bandeau promotionnel ── */
export const PROMO_BAND = {
  title: "Phase gratuite jusqu'au 15 septembre",
  note: "Sans carte bancaire",
  cta: "J'en profite",
};

/* ── Problèmes ── */
export const PROBLEMS_SECTION = {
  title: "Vous perdez du temps là où vous devez en gagner",
  items: [
    {
      title: "La double saisie",
      // À VÉRIFIER — texte exact de l'original.
      text: "Vous notez sur le chantier, puis vous retapez tout le soir dans un logiciel. Deux fois le même travail, zéro valeur ajoutée.",
    },
    {
      title: "Les oublis de chiffrage",
      // À VÉRIFIER — texte exact de l'original.
      text: "Une ligne oubliée, une fourniture non comptée, et c'est votre marge qui disparaît sur le chantier.",
    },
    {
      title: "La mise en forme",
      // À VÉRIFIER — texte exact de l'original.
      text: "Un devis propre et professionnel prend du temps à mettre en page — du temps que vous n'avez pas après une journée de travail.",
    },
  ],
};

export const SEPARATOR_TEXT = "Avec votre assistant chiffrage Gaston";

/* ── Étapes ── */
export const STEPS_SECTION = {
  title: "De vos notes au devis client en 4 étapes",
  steps: [
    {
      title: "Prenez vos notes, comme d'habitude",
      // À VÉRIFIER — texte exact de l'original.
      text: "Sur papier, au téléphone, en vocal : décrivez le chantier avec vos mots, comme vous l'avez toujours fait.",
    },
    {
      title: "Gaston prépare votre devis",
      // À VÉRIFIER — texte exact de l'original.
      text: "L'IA structure vos notes en postes chiffrés : ouvrages, quantités, main-d'œuvre et fournitures.",
    },
    {
      title: "Ajustez les détails",
      // À VÉRIFIER — texte exact de l'original.
      text: "Modifiez librement les prix, quantités et descriptions. Les modifications manuelles sont toujours gratuites.",
    },
    {
      title: "Envoyez puis facturez en 1 clic",
      // À VÉRIFIER — texte exact de l'original.
      text: "Votre client reçoit un devis professionnel. Une fois accepté, transformez-le en facture en un clic.",
    },
  ],
};

/* ── Encadré IA ── */
export const AI_CALLOUT = {
  title: "Une IA qui parle chantier.",
  // À VÉRIFIER — paragraphe exact de l'original.
  text: "Gaston comprend le vocabulaire du BTP : les ouvrages, les unités, les lots et les tournures de métier. Pas besoin de traduire votre travail en langage informatique — parlez-lui comme à un collègue.",
};

/* ── Fonctionnalités ── */
export const FEATURES_SECTION = {
  title: "Tout ce qu'il faut pour gérer votre activité",
  items: [
    {
      icon: "FileText",
      title: "Devis professionnels",
      // À VÉRIFIER — texte exact de l'original.
      text: "Des devis clairs, détaillés et à votre image, générés en quelques minutes.",
    },
    {
      icon: "Receipt",
      title: "Factures & paiements",
      // À VÉRIFIER — texte exact de l'original.
      text: "Transformez un devis accepté en facture et suivez vos règlements.",
    },
    {
      icon: "Users",
      title: "Clients & chantiers",
      // À VÉRIFIER — texte exact de l'original.
      text: "Retrouvez l'historique de chaque client et de chaque chantier au même endroit.",
    },
    {
      icon: "Library",
      title: "Bibliothèque d'ouvrages",
      // À VÉRIFIER — texte exact de l'original.
      text: "Vos ouvrages et prix habituels, mémorisés et réutilisables d'un devis à l'autre.",
    },
    {
      icon: "ShieldCheck",
      title: "Conforme BTP",
      // À VÉRIFIER — texte exact de l'original.
      text: "Mentions légales, TVA du bâtiment et règles de facturation françaises respectées.",
    },
    {
      icon: "UsersRound",
      title: "Équipe",
      // À VÉRIFIER — texte exact de l'original.
      text: "Travaillez à plusieurs sur les mêmes devis, chantiers et clients.",
    },
  ],
};

/* ── Comparatif ── */
export const COMPARISON_SECTION = {
  title: "Un gain de temps réel",
  withoutLabel: "Sans Gaston",
  withLabel: "Avec Gaston",
  // À VÉRIFIER — durées exactes de l'original.
  rows: [
    { task: "Créer un devis", without: "45 min", with: "5 min" },
    { task: "Modifier un devis", without: "15 min", with: "1 min" },
    { task: "Mettre en facture", without: "20 min", with: "1 clic" },
    { task: "10 devis", without: "7 h 30", with: "50 min" },
  ],
  // À VÉRIFIER — messages exacts de l'original.
  gains: [
    "Plus de 6 heures gagnées tous les 10 devis.",
    "Du temps rendu au chantier — ou à votre soirée.",
  ],
};

/* ── Tarifs ── */
export const PRICING_SECTION = {
  title: "Comment travailler avec Gaston ?",
  // À VÉRIFIER — texte explicatif exact de l'original.
  intro:
    "Gaston fonctionne avec des crédits : chaque génération de devis ou modification automatique par l'IA consomme des crédits. Les modifications manuelles, elles, sont toujours gratuites et illimitées.",
  cta: "Essayez gratuitement",
  // À VÉRIFIER — listes de fonctionnalités exactes des cartes originales.
  tiers: [
    {
      name: "Starter",
      price: "19 €",
      period: "/mois",
      credits: "75 crédits/mois",
      popular: false,
      features: [
        "Devis & factures illimités en manuel",
        "Génération IA de devis",
        "Bibliothèque d'ouvrages",
        "Clients & chantiers",
      ],
    },
    {
      name: "Pro",
      price: "49 €",
      period: "/mois",
      credits: "200 crédits/mois",
      popular: true,
      popularBadge: "Le plus populaire",
      features: [
        "Tout Starter",
        "Volume d'IA pour un usage quotidien",
        "Relances de devis",
        "Support prioritaire",
      ],
    },
    {
      name: "Business",
      price: "99 €",
      period: "/mois",
      credits: "500 crédits/mois",
      popular: false,
      features: [
        "Tout Pro",
        "Pensé pour les équipes",
        "Plusieurs utilisateurs",
        "Accompagnement dédié",
      ],
    },
  ],
  notes: [
    // À VÉRIFIER — notes exactes de l'original.
    "-20 % avec l'abonnement annuel.",
    "✏️ Les modifications manuelles sont toujours gratuites et illimitées.",
  ],
};

/* ── Bloc crédits supplémentaires (accueil) ── */
export const CREDITS_TEASER = {
  title: "Besoin de crédits supplémentaires ?",
  // À VÉRIFIER — texte exact de l'original.
  text: "Des packs de crédits à la demande, sans changer d'abonnement.",
  linkLabel: "Comprendre les crédits Gaston",
};

/* ── FAQ accueil ── */
export type FaqItem = { question: string; answer: string };

export const HOME_FAQ: FaqItem[] = [
  {
    question: "Comment fonctionnent les crédits IA ?",
    // Réponse vérifiée sur l'original.
    answer:
      "Les crédits permettent de générer de nouveaux devis et d'effectuer des modifications automatiques via l'IA.",
  },
  {
    // À VÉRIFIER — question et réponse exactes de l'original.
    question: "Les modifications manuelles consomment-elles des crédits ?",
    answer:
      "Non. Les modifications manuelles sont toujours gratuites et illimitées : seules les générations et modifications effectuées par l'IA consomment des crédits.",
  },
  {
    // À VÉRIFIER — question et réponse exactes de l'original.
    question: "Que se passe-t-il si j'épuise mes crédits ?",
    answer:
      "Vous pouvez continuer à travailler en manuel sans limite, acheter un pack de crédits supplémentaires ou passer à l'offre supérieure.",
  },
  {
    // À VÉRIFIER — question et réponse exactes de l'original.
    question: "Mes données sont-elles en sécurité ?",
    answer:
      "Oui. Vos données (clients, devis, factures) restent les vôtres, sont hébergées de façon sécurisée et ne sont jamais revendues.",
  },
  {
    // À VÉRIFIER — question et réponse exactes de l'original.
    question: "Puis-je résilier à tout moment ?",
    answer:
      "Oui, l'abonnement est sans engagement : vous pouvez changer d'offre ou résilier à tout moment.",
  },
];

/* ── Offre exclusive ── */
export const OFFER_SECTION = {
  badge: "Jusqu'au 15 septembre",
  price: "0 €",
  priceLabel: "Gratuit",
  title: "Testez Gaston gratuitement jusqu'au 15 septembre",
  // À VÉRIFIER — texte exact de l'original.
  text: "Profitez de toutes les fonctionnalités de Gaston pendant la phase de lancement, sans limite et sans engagement.",
  cta: "Essayer gratuitement",
  note: "Sans carte bancaire",
};

/* ── Bandeau final ── */
export const FINAL_BAND = "La journée est terminée, votre devis aussi. Place au chantier !";

/* ── Page /credits ── */
export const CREDITS_PAGE = {
  backLabel: "Retour à l'accueil",
  title: "Comprendre les crédits Gaston",
  // À VÉRIFIER — introduction exacte de l'original.
  intro:
    "Les crédits sont la monnaie de l'IA de Gaston : ils servent à générer des devis et à effectuer des modifications automatiques. Voici comment ils fonctionnent, et comment en obtenir davantage.",
  packsTitle: "Besoin de crédits supplémentaires ?",
  packs: [
    { name: "Mini", price: "15 €", credits: "50 crédits", popular: false },
    { name: "Standard", price: "35 €", credits: "120 crédits", popular: true, popularBadge: "Le plus choisi" },
    { name: "Confort", price: "55 €", credits: "250 crédits", popular: false },
  ],
  // À VÉRIFIER — texte exact de l'original.
  packsNote: "Plus le pack est grand, plus le coût par crédit diminue.",
  faq: [
    {
      question: "Comment fonctionnent les crédits IA ?",
      answer:
        "Les crédits permettent de générer de nouveaux devis et d'effectuer des modifications automatiques via l'IA.",
    },
    {
      // À VÉRIFIER — question et réponse exactes de l'original.
      question: "Combien de crédits consomme un devis ?",
      answer:
        "La génération d'un devis complet consomme quelques crédits, selon sa taille ; une modification automatique en consomme moins.",
    },
    {
      // À VÉRIFIER — question et réponse exactes de l'original.
      question: "Les crédits non utilisés sont-ils reportés ?",
      answer:
        "Les crédits de votre abonnement se renouvellent chaque mois ; les crédits achetés en pack restent disponibles tant que votre compte est actif.",
    },
    {
      // À VÉRIFIER — question et réponse exactes de l'original.
      question: "Les modifications manuelles consomment-elles des crédits ?",
      answer:
        "Non, jamais. Les modifications manuelles sont gratuites et illimitées, quel que soit votre abonnement.",
    },
    {
      // À VÉRIFIER — question et réponse exactes de l'original.
      question: "Puis-je acheter plusieurs packs ?",
      answer:
        "Oui, vous pouvez acheter autant de packs que nécessaire : ils s'ajoutent à votre solde de crédits.",
    },
    {
      // À VÉRIFIER — question et réponse exactes de l'original.
      question: "Que se passe-t-il si je change d'abonnement ?",
      answer:
        "Vos crédits restants sont conservés : le changement d'offre ajuste simplement votre allocation mensuelle.",
    },
  ] satisfies FaqItem[],
  finalNote: "Tarifs HT · Sans engagement · ✏️ Modifications manuelles toujours gratuites et illimitées.",
};

/* ── Footer ── */
export const FOOTER = {
  email: CONTACT_EMAIL,
  site: COMPANY_URL,
  siteLabel: "enchantier-pro.fr",
  copyright: `© ${new Date().getFullYear()} Gaston`,
};
