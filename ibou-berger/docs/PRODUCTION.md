# Ibou Berger — note de production

Statut : **site complet, vol en rendu 3D stylisé**. Le client ne peut pas acheter de crédits Higgsfield. Le vol affiché est donc un **rendu 3D fait sur place, sans coût** (Three.js, `scripts/previz/render.js`). Il suit exactement la trajectoire prévue, avec matières procédurales, feu en particules, halos lumineux, grain et vignettage. La vidéo Higgsfield reste une amélioration possible plus tard : les consignes et le pipeline ci-dessous sont prêts.

## Rendu 3D du vol

- Scène : `scripts/previz/render.js`. Trajectoire commune : `scripts/previz/route.js`. L'ancienne maquette grise reste disponible avec `--scene greybox`.
- Commande : `npm run previz -- --w 1440 --fps 20 --q 0.8`. Elle écrit `public/flight/frames/` et `public/flight/manifest.json`.
- Réglages : lumières et matières dans `render.js` ; manœuvres (secondes, positions, lacet, tangage) dans `route.js`. Après un changement de minutage, ajuster `beats` dans `src/content.js`.
- Le rendu est déterministe : deux passages produisent les mêmes images.
- Performance : environ 2 s par image en rendu logiciel (SwiftShader), donc environ 30 min pour 901 images.

## Direction choisie

- **Lieu (hypothèse à confirmer)** : restaurant gastronomique de cuisine de braise à Dakar, en bord de Corniche. Bâtiment de plain-pied en pierre volcanique sombre, lames d'iroko, grandes portes pivotantes en bois, jardin arrière avec baobab.
- **Identité** : basalte (#141110), ivoire (#EFE6D8), braise (#C8663A), laiton (#B8955A), papier (#F4EDE2). Titres en Cormorant Garamond, texte en Manrope. Une seule couleur d'action : la braise.
- **Logo** : houlette de berger formant le « I », avec une flamme dans la crosse (`brand/mark.svg`, `brand/logo.svg`). Il est tracé à la main en SVG modifiable, à partir du concept Higgsfield « houlette & flamme » (job `13424d73…`). Les modèles vectoriels Higgsfield (Recraft) demandent un abonnement payant.
- **Rien d'inventé** : adresse, horaires, téléphone, plats, prix et nombre de couverts sont des emplacements `[entre crochets]` dans `src/content.js`.

## Histoire visuelle

| Scène | Histoire visuelle | Texte du site web |
|---|---|---|
| 01 — Arrivée (0–7 s) | Hauteur d'œil sur le parvis au crépuscule, arc devant le brasero allumé (0–2 s), alignement sur les portes ouvertes (2–6 s), entrée en ralentissant (6–7 s). | **Le feu, la mer, Dakar.** Table de braise au bord de l'Atlantique. · *Réserver une table* · *Voir la carte* |
| 02 — Salle (7–12,4 s) | Ralentit le long de la table d'hôtes (7–8,6 s), courbe en S autour du pilier de basalte (8,6–11,2 s), lacet vers les baies côté océan (11,2–12,4 s). | **Une salle pensée comme une soirée.** · *Voir la carte* |
| 03 — Comptoir (12,4–15 s) | Virage à droite le long du comptoir en laiton, bouteilles sans étiquette en contre-jour, face à la porte battante. | **Bissap, gingembre, grands crus.** |
| Transition — Cuisine (15–16,5 s) | La porte battante s'ouvre vers la cuisine, la caméra la traverse. | — |
| 04 — Braise (16,5–23 s) | Arc autour de la grille (16,5–17,6 s), plongée au ras des flammes (17,6–20,6 s), remontée au-dessus du passe et virage vers la porte latérale (20,6–23 s). | **Tout commence au feu.** · *Découvrir la carte* |
| 05 — Cave (23–30 s) | Porte latérale, allée entre les casiers (23–26,6 s), ralentit au bout, tourne à droite (26,6–29 s), franchit la porte de service ouverte sur le jardin (29–30 s). | **Une cave à traverser.** |
| Transition — Sortie et virage (30–35 s) | Sort dans le jardin (lanternes, baobab), continue d'avancer (30–31,6 s), lacet de 180° en mouvement pour faire face au bâtiment (31,6–35 s). | — |
| 06 — Révélation (35–45 s) | Recule et grimpe face à l'arrière du bâtiment. On découvre le jardin, le parking, la voie d'accès, la route de la Corniche, les immeubles voisins et l'océan. | **On vous garde une table.** Adresse · horaires · téléphone · *Réserver* · *Itinéraire* |

**Route** : le visiteur suit le chemin d'un invité (parvis → salle → comptoir), puis celui des coulisses (cuisine → cave). Il sort par l'arrière et découvre le lieu dans son quartier. Aucune coupe : chaque changement de pièce passe physiquement par une porte ou un angle.

## Rythme du défilement

Mesuré en hauteurs d'écran (vh). Le défilement actif de 1 210 vh est compté en plus de l'écran épinglé.

| Temps fort | vh | Clip | Mode | Texte |
|---|---|---|---|---|
| hero-hold | 70 | 0 → 0 s | image tenue | Chapitre 01 visible au repos |
| arrival | 120 | 0 → 7 s | continu | 01 disparaît en fondu à la fin |
| dining | 170 | 7 → 12,4 s | continu (manœuvres denses) | 02 entre, tient, sort |
| bar | 90 | 12,4 → 15 s | continu | 03 |
| kitchen-door | 55 | 15 → 16,5 s | temps propre (porte) | aucun texte |
| kitchen | 190 | 16,5 → 23 s | continu (le plus long) | 04 |
| cellar | 140 | 23 → 30 s | continu | 05 |
| exit | 60 | 30 → 33 s | continu | aucun texte |
| yaw-180 | 75 | 33 → 35 s | temps propre (lacet) | aucun texte |
| reveal | 150 | 35 → 45 s | continu | 06 entre |
| final-hold | 90 | 45 → 45 s | image tenue | 06 tenu jusqu'à la fin |

Modifier ce rythme revient à modifier le tableau `beats` de `src/content.js`. La distance de défilement ne dépend ni de la durée du clip ni du nombre d'images.

## Consignes vidéo Higgsfield (optionnel, si des crédits deviennent disponibles)

Le schéma du modèle a été vérifié en direct : `seedance_2_5`, modes `omni_reference` et `video_extension` (`extension_mode: forward`), durée de 4 à 30 s, rôles `start_image` / `image_references` / `video_references`, 480p/720p/1080p. Ne jamais écrire « drone » dans les consignes.

Commun aux trois segments : *A single continuous first-person camera move with no cuts; the camera itself flies; nothing flying is ever visible in frame. Every person, vehicle and object stays still unless described; nothing appears, disappears or changes. Warm amber interior light, cool blue-violet dusk outside, 16mm lens look, gentle motion blur. No text, no logos, no brand badges, no lettering on signage, unlabeled bottles.*

**Clip A — 15 s — omni_reference, start_image = image de départ choisie**
> 0–2 s: at eye height on the pale stone forecourt, drift left and arc past the round steel fire brazier so its flames pass close on the left, banking slightly. 2–5 s: straighten and line up with the tall open wooden pivot doors, accelerating. 5–7 s: slow down and glide through the doors into the candlelit dining room. 7–9 s: slow, low sweep along the long dark wooden table set with ivory linen and brass candles on the left. 9–12 s: S-curve around the thick round basalt column, passing it on the left then the right. 12–13 s: yaw left to look across the room at floor-to-ceiling windows showing the Atlantic at dusk. 13–15 s: bank right along the brass-topped bar with backlit unlabeled bottles, ending facing a wooden swinging kitchen door with a small round window.

**Clip B — 15 s — video_extension forward à partir du clip A**
> 0–1.5 s: a server's hand pushes the swinging door open and the camera passes through into the open kitchen. 1.5–3 s: arc left around a long wood-fired charcoal grill with glowing embers and low flames. 3–6 s: dip low and close to the grill, slow, looking at a rack of lamb and a whole fish over the coals, smoke catching the light. 6–8 s: rise over the steel pass with brass heat lamps, yaw left toward a side door. 8–11 s: through the side door into a narrow wine cellar corridor lined with dark timber racks of unlabeled bottles, flying steadily. 11–13 s: slow at the end of the aisle and turn right. 13–15 s: approach an open back service door; through it a lantern-lit tropical garden with a baobab tree and dusk sky is visible (not the front of the building).

**Clip C — 15 s — video_extension forward à partir du clip B + image_references = image de révélation**
> 0–3 s: exit through the back service door into the garden, keep moving forward under string lanterns past the baobab. 3–6 s: while still moving, yaw 180 degrees to face the building just exited: dark basalt walls, iroko timber slats, the glowing open back door. 6–15 s: fly backward and climb steadily, revealing the whole single-storey restaurant, its garden courtyard, the side parking lot and access lane, the coastal Corniche road in front with parked cars, low white neighbouring buildings and the Atlantic shore to the west. Hold the high aerial at the end. Same architecture, materials and scale as the start.

**Pipeline après génération** (sur une machine avec ffmpeg, ou dans le bac à sable Higgsfield) : `scripts/pipeline.sh` construit la planche contact, lance la détection de coupe, normalise en 1920×1080 à 24 i/s, assemble le master et extrait les images WebP avec le manifeste. Il suffit ensuite de remplacer `public/flight/frames/` et `public/flight/manifest.json`.

## Ressources Higgsfield

Projet : « Ibou Berger — Site cinématique » (`28840a8e-5b36-4252-b298-432d28f10846`). Modèle : `z_image`, le seul modèle d'image ouvert à l'offre gratuite. Toutes les images sont en 2048×1152 (16:9) ou 2048×2048 (logos).

| Rôle | Job | Consigne (résumé) |
|---|---|---|
| Départ A — basalte (retenu) | `6c863d73-a27b-44f0-a53d-a7ebe2592635` | Façade basalte et iroko au crépuscule, portes pivotantes ouvertes, brasero à gauche, palmiers |
| Départ B — terre sahélienne | `d67ab27d-b57a-447e-94cb-290f1901502e` | Architecture en banco ocre, arche, portes sculptées, brasero, lanternes |
| Départ C — béton & verre | `c63b4c13-4eb4-44f5-bfff-c99ad829ec99` | Pavillon en béton brut, porte en bronze, vasque de feu, bassin |
| Salle | `fa40b84e-6fd5-4f50-a8f5-2a79475ad853` | Table d'hôtes, pilier de basalte, baies sur l'océan |
| Comptoir | `117c07a2-bc4a-4763-b13f-1fe88137e955` | Comptoir en laiton, bouteilles sans étiquette, porte battante |
| Braise | `110bc9d4-d043-4500-9f75-faf0de42f83e` | Grille au feu de bois, agneau et poisson, passe en acier |
| Cave | `403b1cf7-3ce9-4cd2-8351-285cdfe3dd58` | Allée de casiers, porte arrière ouverte sur le jardin |
| Jardin (arrière) | `84801bc7-a7cc-47ae-894c-a9eaa4fa0a3b` | Arrière du bâtiment, baobab, lanternes |
| Révélation (référence aérienne) | `8edbbb09-822c-47f1-814b-a54889ba6120` | Vue aérienne haute de l'arrière, jardin, parking, Corniche, océan |
| Logo — houlette & flamme | `13424d73-6971-4868-b5cd-cefbcdf135fa` | Monogramme houlette-flamme, mot-symbole serif |
| Logo — sceau | `9ffe02e9-8565-4b56-b3ca-f410b58ead0e` | Sceau circulaire, spirale de corne de bélier |
| Logo — italique | `a7e7d120-be3a-435f-9fc5-e349c4477ecd` | Mot-symbole italique, flamme sur le « i » |

**Sélection validée par le client (30/09/2026)** : façade de départ **A — basalte & bois** (`6c863d73…`), qui sera l'image de départ exacte du clip A ; intérieurs salle (`fa40b84e…`), cave (`403b1cf7…`) et braise (`110bc9d4…`) ; logo **houlette & flamme** (`13424d73…`), sur lequel repose le SVG de `brand/`. Les façades B et C restent des pistes écartées. Ce choix garde la même matière (basalte et iroko) du départ à la révélation.

**Crédits** : 10,00 au départ, 8,20 restants. 1,80 crédit utilisé pour 12 images à 0,15 crédit. Aucune vidéo générée.

## Blocages observés

1. **Crédits** : un clip Seedance 2.5 de 15 s coûte 45 crédits en 480p et 105 crédits en 720p (prévol vérifié). Les extensions coûtent davantage. Il faut prévoir environ **350 à 450 crédits** pour A + B + C en 720p, sans compter les réparations. Le solde est de 8,20 crédits.
2. **Offre** : GPT Image 2.5, Nano Banana, Soul, Recraft (vectoriel), etc. renvoient « Requires basic plan or higher ». Seul `z_image` passe en offre gratuite.
3. **Réseau** : `d8j0ntlcm91z4.cloudfront.net` (CDN Higgsfield) est refusé par la politique réseau de l'environnement de travail. Les images fixes sont donc **référencées par URL** dans `src/content.js` au lieu d'être copiées dans le dépôt. Elles sont publiques, non signées et chargées par le navigateur des visiteurs. Si le CDN ne répond pas, une image de la maquette s'affiche en dessous.

## Vérifications effectuées

- `npm run build` : OK.
- `scripts/verify-flight.mjs` (Chromium, ordinateur 1440×900 et téléphone 390×844 @2x) : les 33 points (début, milieu, fin de chaque temps fort) atteignent l'image attendue à ±1 et elle est dessinée. Le chapitre 01 est visible au repos et le chapitre 06 tient à la fin. Le saut arrière est dessiné, les chapitres masqués sont `inert`, il n'y a aucun débordement horizontal, le formulaire en démo affiche « NON envoyée » et le mode statique affiche 6 chapitres.
- **Non vérifié** : la fluidité perçue au défilement réel (molette ou trackpad) sur un vrai appareil ; l'affichage des images Higgsfield et des polices Google dans le navigateur (tous deux bloqués dans l'environnement de test) ; le rendu du vol Higgsfield lui-même.
