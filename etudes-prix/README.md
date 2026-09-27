# Études de Prix CFO/CFA — V1.1

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

Les modules DCE, Analyse, Métré, Consultations, Chiffrage, Risques, Questions, Revue et Rapports
sont visibles dans le menu avec leur version prévue (V1.2 à V1.10).

## Architecture

```
src/
  domain/      logique métier pure et testée (workflow, planning, KPI, pré-analyse)
  data/        accès aux données (interface StudyRepository) + données de démonstration
  state/       état applicatif React (historique des modifications)
  components/  interface (layout, composants UI, blocs étude)
  pages/       écrans
  print/       mise en page d'impression A4
```

La V1.1 enregistre les données dans le navigateur (localStorage). L'interface asynchrone
`StudyRepository` permettra de brancher le backend prévu (FastAPI + SQLite, puis PostgreSQL)
sans modifier les écrans. Le backend sera nécessaire à partir de la V1.2 pour l'import
et l'extraction des documents (PDF, Excel, Word).
