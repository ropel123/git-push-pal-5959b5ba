## Contexte

Sur certaines plateformes AWS Solutions, il n'y a pas de ligne "DCE (ou Pièces communes)". À la place, le vrai dossier à récupérer est "Dossier principal" (souvent le plus volumineux, ici 18800 Ko). Aujourd'hui l'agent ne le détecte pas et abandonne.

## Plan

Modifier `jsClickDceRow` dans `supabase/functions/fetch-dce-agent/index.ts` (sans toucher au frontend) :

1. **Élargir les cibles acceptées**, par ordre de priorité strict :
   - Priorité 1 : `DCE (ou Pièces communes)` (regex actuelle).
   - Priorité 2 : `DCE` seul.
   - Priorité 3 : `Dossier principal` (nouvelle cible).
   - On garde la liste noire (Conditions d'accès, Information sur les dépôts, AAPC, Règlement de consultation, Pièces communes seul, lots).

2. **Sélection**: on prend le premier candidat de la priorité la plus haute présente sur la page. Si plusieurs lignes "Dossier principal" existent (rare), prendre celle dont le bouton Télécharger affiche la taille la plus grande, sinon la première.

3. **Clic**: réutiliser la logique existante (bouton dans le même `<tr>`, sinon bouton aligné verticalement à droite du libellé).

4. **Logs**: indiquer quelle priorité a été retenue (`matched: 'dce_exact' | 'dce_alone' | 'dossier_principal'`) pour debug.

5. **Fallback**: garder désactivé le "clique tout Télécharger" générique — inchangé.

## Validation attendue

Sur la page jointe (pas de ligne DCE), l'agent doit cliquer le bouton Télécharger de la ligne "Dossier principal" (~18800 Ko). Sur les pages avec DCE, le comportement reste identique (priorité 1).
