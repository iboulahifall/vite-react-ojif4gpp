# Études de Prix CFO/CFA — V1.9

Application de pilotage des études de prix électricité (courants forts / courants faibles).

## Démarrer

```bash
cd etudes-prix
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (logique métier)
npm run build      # vérification TypeScript + build de production
```

Au premier lancement, un portefeuille fictif est créé automatiquement
(**PROJET DÉMONSTRATION — IMMEUBLE TERTIAIRE** + 13 études « Démo »).
Il peut être réinitialisé ou supprimé depuis **Paramètres**.

## Contenu de la V1.1

- **Navigation** : barre latérale fixe (menu en tiroir sur tablette), recherche globale,
  notifications (échéances, retards, risques critiques, études prêtes), aide, menu utilisateur.
- **Tableau de bord** : 5 indicateurs cliquables, graphique « Études par étape »,
  liste « À traiter » (ce qui bloque), tableau « Priorités » avec la prochaine action.
- **Mes études** : recherche, filtres (étape, échéance, risque, prix en attente), tri par colonne,
  en-têtes fixes, total en pied de tableau.
- **Nouvelle étude** : assistant en 6 étapes (Projet → DCE → Analyse → Postes → Travail → Étude),
  avec pré-analyse des pièces déclarées et rétro-planning calculé depuis la date de remise.
- **Fiche étude** : informations, avancement, workflow en 7 étapes, prochaine action, indicateurs,
  plan de travail, périmètre CFO/CFA, pièces DCE, historique (ancienne / nouvelle valeur,
  utilisateur, date, motif). Toute action importante demande une confirmation.
- **Mode guidé / mode expert**, aide « À quoi ça sert ? » sur chaque écran.
- **Impression** : mise en page A4 dédiée (en-tête, pied de page, numéro de page, référence, version)
  pour le tableau de bord, la liste et la fiche étude.

## Contenu de la V1.2 — DCE

- **Import** par glisser-déposer ou sélection (PDF, Excel, Word, images, DWG, ZIP — 50 Mo max),
  depuis la page DCE ou dès l'étape 2 de l'assistant « Nouvelle étude ».
- **Classement automatique** d'après le nom du fichier (RC, CCAP, CCTP, DPGF, plans CFO / CFA,
  autres pièces), modifiable à tout moment ; les fichiers non reconnus sont signalés « à classer ».
- **Visualisation** intégrée : PDF (pages, zoom), Excel (feuilles, largeurs de colonnes), Word (.docx),
  images, texte. Téléchargement de tout fichier.
- **Documents manquants** : chaque pièce attendue est « Importée », « Reçue, non importée »,
  « Manquante » ou « Sans objet » (plans d'un lot non chiffré).
- Commentaire par fichier, suppression confirmée, traçabilité dans l'historique de l'étude,
  **bordereau des pièces** imprimable.
- Le projet de démonstration contient un DCE fictif consultable (RC, CCAP, CCTP, DPGF, plans CFO ;
  plans CFA volontairement manquants).

## Contenu de la V1.3 — Analyse CCTP / DPGF

- **Lecture des pièces** : texte des PDF (pdf.js) et Word (.docx) page par page, lignes de la DPGF Excel / CSV
  (repérage automatique des colonnes N°, Désignation, Unité, Quantité et des sections).
- **Prestations détectées** : environ 35 prestations CFO / CFA reconnues dans le CCTP (TGBT, BAES, SSI, VDI, IRVE…),
  rangées par famille avec leurs pages.
- **Comparaison CCTP / DPGF** : concordant, absent de la DPGF (oubli), non décrit au CCTP (spécifications manquantes),
  quantités à établir, lignes non rattachées, prestations hors périmètre retenu.
- **Clauses à risque** (RC, CCAP, CCTP) : hypothèses « à confirmer », pénalités sans plafond, site occupé,
  horaires décalés, amiante, PSE, variantes, annexes citées, clause d'exhaustivité…
- **Page Analyse** : cartes Points critiques / À vérifier / Confirmés / Questions, chaque point relié à sa source
  (ouverture du document à la bonne page), décisions « traité » / « écarté » avec motif, conservées après
  une nouvelle analyse, alerte si le DCE a changé, questions proposées copiables, rapport imprimable.
- L'analyse est **par règles métier** (déterministe, sans service externe) : elle propose des points à examiner
  et ne remplace pas la lecture du dossier. Les documents scannés (images) ne sont pas lus.

## Contenu de la V1.4 — Postes et métré

- **Postes** : arborescence CFO / CFA ; un clic sur une famille affiche ses lignes, avec l'avancement
  de validation, les écarts importants (▲) et les quantités à établir (⚠).
- **Métré type tableur** : colonnes Poste, Désignation, Unité, DPGF, Calculé, Retenu, Écart, État ;
  tri, filtres (écarts > 10 %, à établir, à valider, validées), recherche, colonnes redimensionnables,
  en-têtes fixes, saisie directe au clavier (Entrée / Échap).
- **Quantités** : la quantité calculée se saisit directement ou par un **détail** (quantité × coefficient) ;
  la quantité retenue est proposée (calculée, sinon DPGF) tant qu'elle n'est pas saisie.
- **Écarts** avec la DPGF affichés par symbole + valeur + pourcentage (▲ / ▼, rouge au-delà de 10 %).
- **Validation** ligne par ligne ou groupée (lignes sans écart important) ; modifier une quantité validée
  demande une confirmation avec motif et impose une revalidation. **Historique** propre à chaque ligne.
- Création depuis la DPGF, **mise à jour** sans perdre le travail fait, ajout de lignes manuelles et
  des prestations du CCTP absentes de la DPGF (issues de l'analyse), export **CSV** (Excel), impression.

## Contenu de la V1.5 — Consultations fournisseurs

- **Annuaire** des fournisseurs et sous-traitants (commun aux études) : contact, familles habituelles,
  taux de réponse ; **fiche fournisseur** avec toutes ses consultations et offres.
- **Consultation** par poste : familles et lignes du métré consultées, fournisseurs (les habituels proposés
  en premier), date de réponse attendue ; courriel de demande de prix prérempli.
- **Suivi** sous forme de cartes : à envoyer, en attente, en retard, relancée, offre reçue, décliné ;
  **relance** tracée (date, auteur, note) avec courriel prérempli ; familles du périmètre non consultées.
- **Offres** : prix unitaires sur les quantités retenues du métré (ou montant global), délai, validité,
  exclusions, commentaire, documents joints (devis).
- **Comparaison** : classement de la moins-disante à la plus chère, écart en %, offres expirées ou
  incomplètes signalées, comparaison ligne par ligne ; **offre retenue** (motif obligatoire si elle
  n'est pas la moins chère). Impression du suivi et de chaque consultation.
- Les **prix en attente** et les **fournisseurs à relancer** alimentent le tableau de bord et la prochaine action.

## Contenu de la V1.6 — Chiffrage

- **Déboursé sec** par ligne du métré : fourniture (€/u) + main-d'œuvre (h/u × taux horaire) + sous-traitance (€/u).
- **Prix de revient** = déboursé sec + frais de chantier + frais généraux + aléas ; **prix de vente** = prix de revient
  + marge (en % du prix de vente), ou **prix de vente visé** → marge calculée. Coefficient de vente affiché.
- **Tableau de chiffrage** groupé par famille (Qté, PU, Matériel, MO, ST, Total, Prix de vente, Source) : recherche,
  filtres, tri, sous-totaux, totaux ; le prix de vente est réparti sur chaque ligne (la somme redonne le total).
- **Trace du prix** (clic sur une ligne) : origine, fournisseur, référence, prix catalogue, remise, prix retenu,
  document, statut (🟢 confirmé, 🟠 à confirmer, 🟡 estimé, 🔴 manquant), commentaire, historique.
- **Report des offres retenues** des consultations (prix unitaires ou forfait) ; **base de prix indicative** pour
  pré-remplir les lignes sans prix (marquées « estimé »). Un prix confirmé à la main n'est jamais écrasé.
- Toute modification importante (prix confirmé, écart ≥ 1 000 €, paramètres) est confirmée avec son impact sur
  le prix de vente et tracée. **Export Excel** (détail + récapitulatif) et impression.
- Le tableau de bord et les listes affichent le prix de vente chiffré (sinon le montant estimé).

## Contenu de la V1.7 — Risques, questions et blocages

- **Registre des risques** en trois colonnes (🔴 critique, 🟠 important, 🟡 à surveiller) : description, source
  (lien vers la page du document), impact, montant potentiel, responsable, action, statut. Un risque critique
  exige une action. **Exposition** totale comparée à la **provision pour aléas** du chiffrage.
- **Questions au maître d'ouvrage** (Q-001…) : sujet, source, question, impact, question **bloquante** ;
  envoi groupé (courriel prérempli), relances, **réponse**, sans objet ; liste imprimable.
- Création en un clic depuis l'**analyse** : « → Question » et « → Risque » sur chaque constat, import de toutes
  les questions proposées ; les liens sont affichés sur les constats.
- **Ce qui bloque** : sur la fiche étude, liste unique des blocages de tous les modules (pièces manquantes,
  points critiques, écarts de métré, fournisseurs à relancer, prix manquants, risques critiques, questions
  bloquantes), chacun menant à la page où le traiter. Barre des modules avec l'état de chacun.
- Risques critiques et questions ouvertes sont calculés automatiquement (tableau de bord, alertes, prochaine action).

## Contenu de la V1.8 — Revue de prix

- **Lancer la revue** : une trentaine de contrôles de cohérence, en six familles (analyse CCTP, analyse DPGF,
  pièces et plans, quantités, prix, risques), déroulés à l’écran.
- **Anomalies détectées** : points critiques de l’analyse non traités, questions proposées non posées, lignes non rattachées
  ou hors périmètre, familles sans ligne, pièces manquantes, quantités à établir / non validées / nulles, écarts > 10 %
  sans commentaire, prix manquants, estimés ou à confirmer, déboursés unitaires hors norme (×3 par rapport à la base
  indicative), fourniture sans pose, marge et taux horaire hors plage, écart avec le montant estimé, offres en attente,
  non reportées ou expirant avant la remise, risques critiques, provision inférieure à l’exposition, questions bloquantes, délai.
- Chaque contrôle est 🔴 **bloquant**, 🟠 **à vérifier** ou 🟢 **réussi**, avec les éléments concernés et un bouton
  **Corriger** vers la page où agir. Un point à vérifier peut être **justifié** (motif obligatoire, tracé) ; la justification
  tombe si le constat change.
- **Score de contrôle** (réussis + justifiés / contrôles applicables) : il indique l’état des contrôles de l’application,
  ce n’est **pas une garantie de conformité**. Revue **périmée** signalée dès que l’étude change ; passage à la
  validation impossible tant qu’un contrôle est bloquant. Rapport de revue imprimable.

## Contenu de la V1.9 — Validation

- **Récapitulatif avant remise** : projet, déboursé sec, prix de revient, prix de vente, marge, risques critiques,
  questions ouvertes, prix fournisseurs manquants, lignes sans prix, résultat de la revue.
- **⚠️ Validation humaine** : six cases à cocher, nom de la personne de la direction ayant validé le prix, commentaire.
  Une revue de prix **à jour** est exigée ; s’il reste des contrôles bloquants, la validation n’est possible
  qu’« **avec réserves** » (case dédiée + motif obligatoire).
- **✅ Valider l’étude** : les chiffres sont figés, l’étude est **verrouillée** (bandeau sur toutes ses pages, métré, prix,
  offres, risques et questions en lecture seule). **Déverrouillage** tracé avec motif, puis nouvelle validation
  (versions V1, V2…). **Marquer l’offre comme remise** termine l’étude ; la remise passe obligatoirement par la validation.
- Page **Validation** du menu : quelle étude est **prête à valider** (revue à jour sans blocage), laquelle est validée.
  Fiche de validation imprimable avec cadres de signature.

Le module Rapports est visible dans le menu avec sa version prévue (V1.10).

## Architecture

```
src/
  domain/      logique métier pure et testée (workflow, planning, KPI, pré-analyse, analysis/ : règles d'analyse)
  data/        accès aux données (interface StudyRepository) + données de démonstration
  state/       état applicatif React (historique des modifications)
  components/  interface (layout, composants UI, blocs étude)
  pages/       écrans
  print/       mise en page d'impression A4
  lib/         lecture des fichiers (pdf.js, ExcelJS, mammoth), chargés à la demande
```

Les données sont enregistrées dans le navigateur : les études dans localStorage, le contenu
des fichiers dans IndexedDB. Elles ne sont donc pas partagées entre postes. Les interfaces
asynchrones `StudyRepository` et `FileStore` permettront de brancher le backend prévu
(FastAPI + SQLite, puis PostgreSQL) sans modifier les écrans.
