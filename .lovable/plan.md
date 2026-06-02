# Sidebar enrichie — style DoubleTrade, DA HackAO

Refonte de `src/components/AppSidebar.tsx` pour passer d'une liste plate de 7 items à une navigation hiérarchique en groupes avec sous-menus collapsibles, en gardant 100% de notre identité visuelle (crème + navy + accent bleu, logo HackAO pinwheel).

## Nouvelle structure de navigation

```text
Accueil                          → /dashboard         (LayoutDashboard)

Recherche  ▾                     (Search)
  Moteur de recherche            → /tenders
  Mots-clés                      → /tenders?view=keywords
  Profils de veille              → /tenders?view=profiles

Mes affaires  ▾                  (Briefcase)
  Pipeline                       → /pipeline           (Kanban)
  Marchés suivis                 → /tenders?view=tracked
  Alertes                        → /settings#alerts    (Bell)
  DCE                            → /tenders?view=dce   (FileArchive)
  Archivés                       → /tenders?view=archived

Mes réponses  ▾                  (FileText)
  Mémoires techniques            → /tenders?view=memoir       (BookOpen)
  Chiffrages (DIE)               → /tenders?view=pricing      (Calculator)

Attributions                     → /awards            (Award)
Statistiques                     → /activity          (BarChart3)

Admin  ▾  (visible si isAdmin)
  Agent IA                       → /agent-monitor     (Bot)
  Sourcing                       → /sourcing          (Globe)
  Paramètres                     → /settings          (Settings)
```

Items inexistants côté routes (Mots-clés, Profils, Marchés suivis, Archivés, Mémoires, Chiffrages) pointent vers `/tenders?view=…` — le filtrage réel sera branché plus tard, mais la nav est en place dès maintenant. Aucune nouvelle page n'est créée.

## Comportement

- Groupes collapsibles via `Collapsible` shadcn imbriqué dans `SidebarMenuItem` + `SidebarMenuSub` / `SidebarMenuSubItem` / `SidebarMenuSubButton` (déjà exportés par `components/ui/sidebar.tsx`).
- Le groupe contenant la route active est **ouvert par défaut** (`defaultOpen` calculé depuis `location.pathname` + `search`).
- État actif : `isActive` sur le sous-item dont l'URL matche `pathname + search`.
- En mode collapsed (`collapsible="icon"`), seule l'icône du groupe est visible ; clic = ouvre le popover natif shadcn de `SidebarMenuSub`.

## Style (DA HackAO)

- Sidebar : `bg-sidebar` (crème déjà défini), border `border-sidebar-border`.
- Item actif : fond `bg-sidebar-accent` + texte `text-sidebar-accent-foreground` + barre gauche `bg-accent` (2px).
- Chevron `ChevronRight` qui tourne 90° quand ouvert (`data-[state=open]:rotate-90 transition-transform`).
- Group labels en `text-xs uppercase tracking-wider text-sidebar-foreground/50`.
- Sous-items : `pl-8`, `text-sm`, hover `bg-sidebar-accent/50`.
- Aucune couleur hardcodée — tout via tokens sémantiques.

## Fichier modifié

- `src/components/AppSidebar.tsx` — réécriture complète (structure + groupes collapsibles).

Aucun changement de routes, de logique métier, de hooks ou de schéma. Pure refonte de présentation.
