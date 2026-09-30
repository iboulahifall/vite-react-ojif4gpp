# Ibou Berger — site cinématique

Site d'un restaurant de cuisine de braise à Dakar, construit autour d'une visite en un seul plan continu, pilotée par le défilement.

```bash
cd ibou-berger
npm install
npm run dev          # http://localhost:5173  (planche de style : /style-tile.html)
npm run build        # dist/ prêt à héberger (site statique)
```

## Modifier le contenu

Tout est dans **`src/content.js`** :

| Quoi | Où |
|---|---|
| Nom, navigation, bouton principal | `site` |
| Textes de la visite (titres, paragraphes, boutons) | `chapters` |
| Rythme du défilement (vh par temps fort, secondes du clip) | `beats` |
| Carte, expérience, infos pratiques | `menu`, `experience`, `info` |
| Réservation (adresse d'envoi) | `reservation.endpoint` : `null` = mode démo, rien n'est envoyé |
| Images fixes et séquence du vol | `media` |

Les valeurs `[entre crochets]` sont à remplacer par les vraies informations. Passer `site.demo` à `false` retire les mentions « maquette ».

**Réservation** : indiquez une URL qui accepte un POST JSON (Formspree, un backend, etc.) dans `reservation.endpoint`. Le message « Demande envoyée » ne s'affiche que si le serveur répond OK.

## Remplacer le vol de prévisualisation par le vol Higgsfield

1. Générez les clips A, B et C avec les consignes de `docs/PRODUCTION.md`.
2. Lancez `scripts/pipeline.sh clipA.mp4 clipB.mp4 clipC.mp4` (ffmpeg requis). Il inspecte les clips, assemble le master, extrait les images et écrit le manifeste.
3. Copiez `work/frames/` et `work/manifest.json` dans `public/flight/`, puis lancez `npm run check:frames`.
4. Ajustez les secondes `from` / `to` des `beats` si la durée ou le minutage des manœuvres a changé.

## Accessibilité et repli

- Le défilement reste natif, dans les deux sens. Un lien « Passer la visite » est disponible, et le texte reste du HTML sélectionnable.
- Les chapitres masqués sont `inert`, donc absents de l'ordre du clavier.
- Si l'utilisateur a demandé moins d'animations (`prefers-reduced-motion`), ou si l'appareil est limité (économie de données, 2G, ≤ 2 Go de mémoire), chaque chapitre s'affiche en section fixe avec son image.
- Pour forcer un mode lors des tests : `?mode=static` ou `?mode=motion`.

## Vérifier

```bash
npm run build && npx vite preview --port 4173 &
node scripts/verify-flight.mjs      # ordinateur + téléphone : images, chapitres, fin, débordement, formulaire, mode statique
npm run check:frames                 # manifeste et fichiers
```

## Fichiers

- `src/flight.js` : timeline par morceaux, chargeur d'images borné (priorité dans le sens du défilement, annulation, tentatives, libération mémoire), rendu « cover ».
- `src/main.js` : assemblage du site et de la scène épinglée.
- `src/tokens.css`, `src/styles.css` : jetons de design et styles.
- `style-tile.html` : planche de style (logo, palette, typographie, boutons, carte, direction d'image).
- `brand/` : logo SVG (monogramme + logo complet).
- `scripts/previz/` et `scripts/render-previz.mjs` : prévisualisation Three.js de la trajectoire (`npm run previz`).
- `docs/PRODUCTION.md` : histoire visuelle, rythme, consignes Higgsfield, identifiants des jobs, crédits, limites.
