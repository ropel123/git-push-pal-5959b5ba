

# Section "Nos Offres" sur la Landing Page

## Objectif
Ajouter une section pricing/services entre ProcessSection et FAQSection sur la landing page, presentant les deux packs : **Pack IA** et **Pack Accompagnement Premium**.

## Nouvelle section : `PricingSection.tsx`

Section avec deux cartes cote a cote (responsive : empilees sur mobile) :

### Carte 1 — Pack IA (400-600€)
- Icone `Bot` ou `Sparkles`
- Titre : "Pack IA"
- Prix : "A partir de 490€ / dossier"
- Liste de features :
  - Analyse automatique de l'AO par l'IA
  - Generation du memoire technique
  - Recommandations strategiques
  - Revue par notre equipe
- CTA : "Demander un devis" (lien vers Calendly ou formulaire)

### Carte 2 — Pack Accompagnement Premium (mise en avant)
- Icone `Users` ou `Handshake`
- Badge "Populaire" ou "Recommande"
- Titre : "Accompagnement Premium"
- Prix : "Sur mesure"
- Liste de features :
  - Tout le Pack IA inclus
  - Chef de projet dedie
  - Coaching personnalise avec un expert
  - Rendez-vous de suivi reguliers
  - Mise en page professionnelle
  - Relecture et optimisation finale
- CTA : "Planifier un echange" (lien vers Calendly)

### Design
- Style coherent avec le reste de la landing (fond sombre, accents orange/primary, animations au scroll via `useScrollAnimation`)
- La carte Premium a une bordure `border-primary` pour la mettre en avant
- Label "Nos offres" en haut, titre "Choisissez l'accompagnement adapte a vos ambitions"

## Fichiers modifies
- `src/components/PricingSection.tsx` — nouveau composant
- `src/pages/Index.tsx` — import + ajout entre ProcessSection et FAQSection

