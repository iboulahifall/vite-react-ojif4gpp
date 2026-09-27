# Études de Prix CFO/CFA — V1.4

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

Les modules Consultations, Chiffrage, Risques, Questions, Revue et Rapports
sont visibles dans le menu avec leur version prévue (V1.5 à V1.10).

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
