

# Plan : Polissage et fonctionnalités avancées

## Récapitulatif de l'existant
Auth, Onboarding (wizard 4 étapes), Dashboard (charts + urgences + recherches sauvegardées), Tenders (liste paginée + filtres + scoring + recherches sauvegardées + CSV), TenderDetail (fiche complète + awards), Pipeline (Kanban + commentaires + CSV + deadline indicators), Awards, BuyerDetail, Settings (profil + alertes), Landing CTA, données de démo.

## Prochaines étapes

### 1. Notifications in-app (centre de notifications)
Composant cloche dans le header (`AppLayout.tsx`) affichant un popover avec les AO récemment ajoutés matchant les alertes actives de l'utilisateur. Requête côté client comparant les `alerts.filters.keywords` avec les tenders récents (< 7 jours). Badge rouge sur l'icône si notifications non lues.

### 2. Filtres serveur-side sur Tenders
Actuellement les filtres (région, statut, procédure) s'appliquent côté client sur la page en cours. Passer à des filtres dans la requête Supabase (`.eq()`, `.ilike()`) pour des résultats paginés corrects sur l'ensemble des données.

### 3. Dark/Light theme toggle
Le projet utilise `next-themes`. Ajouter un bouton toggle dans le header (soleil/lune) pour basculer entre thèmes. Configurer le `ThemeProvider` dans `App.tsx`.

### 4. Mobile responsive polish
- Sidebar : déjà gérée par le composant SidebarProvider
- Pipeline : passer les colonnes en stack vertical sur mobile (scrollable horizontalement)
- Header : ajouter le nom de la page courante
- Tender cards : ajuster les marges et tailles de texte

### 5. Page "Mon activité" (journal)
Nouvelle page `/activity` listant chronologiquement les actions de l'utilisateur : ajouts au pipeline, changements d'étape, commentaires. Basée sur les timestamps existants dans `pipeline_items` et `pipeline_comments`.

## Fichiers à créer/modifier
- Créer `src/components/NotificationBell.tsx` — composant notifications
- Modifier `src/components/AppLayout.tsx` — intégrer NotificationBell dans le header + ThemeToggle
- Modifier `src/App.tsx` — ajouter ThemeProvider + route `/activity`
- Modifier `src/pages/Tenders.tsx` — filtres serveur-side dans la requête Supabase
- Créer `src/components/ThemeToggle.tsx` — bouton dark/light
- Créer `src/pages/Activity.tsx` — journal d'activité
- Modifier `src/components/AppSidebar.tsx` — lien vers Activity
- Modifier `src/pages/Pipeline.tsx` — responsive mobile

## Ordre d'implémentation
1. Filtres serveur-side (Tenders)
2. Theme toggle (dark/light)
3. Notifications in-app
4. Responsive mobile polish
5. Page activité

