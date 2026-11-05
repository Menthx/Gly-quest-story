# Glyglyland et l'énergie ancienne

Jeu narratif façon Amour Sucré : des backgrounds interactifs (« maps »), des éléments cliquables, des textes en bas de l'écran et un cadre « Quête en cours ». Tout le contenu est décrit en JSON, sans toucher au code.

## Lancer le projet

Il faut **Node 22.22.3+ ou 24.15+** (exigence d'Angular 22).

```bash
npm install
npm start          # http://localhost:4200
npm test           # tests unitaires
npm run check      # vérifie le contenu JSON (à lancer après chaque modification de scène)
npm run build      # version de production dans dist/
```

`npm run check` signale les fautes de frappe qui, sinon, bloqueraient la partie sans aucune erreur : clé inconnue, map, dialogue, personnage ou image introuvable, flag testé (`if`, `ifNot`, `ifMore`, objectif de quête) mais jamais posé par un `setFlags`.

## Mise en ligne

À chaque PR, GitHub vérifie le contenu, lance les tests et construit le site. À chaque push sur `main`, le jeu est publié sur GitHub Pages : https://menthx.github.io/Gly-quest-story/

À faire une seule fois : dans le repo GitHub, **Settings › Pages › Source : GitHub Actions**.

Le joueur donne d'abord son pseudo sur l'écran titre. La partie est sauvegardée automatiquement dans le navigateur (localStorage) : au rechargement, l'écran titre propose **Reprendre la partie** ou **Nouvelle partie**. Si un dialogue était affiché, il reprend à son début. Le mode debug ne sauvegarde pas, pour ne pas écraser la vraie partie.

## Où est le contenu

```
public/
├── data/
│   ├── game.json                 ← titre, map de départ, personnages, quêtes, liste des maps
│   └── maps/
│       ├── train-interieur.json  ← scène 1
│       ├── train-exterieur.json  ← scène 1
│       ├── inter-scene-1-2.json  ← texte de transition vers la scène 2
│       ├── bibliotheque.json     ← scène 2 : vue d'ensemble (accueil de Naevys, accès aux lieux)
│       ├── biblio-*.json         ← scène 2 : foyer, bureau, coin douillet
│       ├── jardin-*.json         ← scène 2 : serre, cour, pergola (scène 5 : ingrédients du rituel)
│       ├── inter-scene-2-3.json  ← texte de transition vers le logement
│       ├── logement.json         ← scène 3 : mon logement le soir (nuit puis réveil en changements de plan)
│       ├── inter-scene-3-4.json  ← texte de transition vers la bibliothèque (scène 4 au foyer, scènes 5-6 au bureau)
│       ├── inter-scene-6.json    ← retour au logement
│       ├── logement-repos.json   ← scène 6 : se reposer avant le rituel
│       ├── inter-scene-6-7.json  ← trajet de nuit vers la bibliothèque
│       ├── bibliotheque-nuit.json← scène 7 : le rituel (vidéos du sort)
│       ├── inter-scene-7-final(-2,-3).json ← la nuit au coin du feu, en trois écrans
│       ├── bibliotheque-matin.json  ← scène finale avec Phyla, puis les crédits
│       └── credits.json          ← crédits et statistiques
└── assets/
    ├── backgrounds/              ← images de fond
    ├── characters/               ← portraits des personnages
    └── videos/                   ← vidéos (fonds, plans de dialogue)
schemas/                          ← schémas JSON : autocomplétion et vérification dans VS Code
```

Tous les chemins d'images et de vidéos sont relatifs à `public/`. Partout dans les textes, `{pseudo}` est remplacé par le pseudo du joueur.

### game.json

```json
{
  "title": "Glyglyland et l'énergie ancienne",
  "titleBackground": "assets/backgrounds/train-exterieur.jpg",
  "startMap": "train-interieur",
  "characters": {
    "joueur": { "name": "{pseudo}", "color": "#f2d48a" },
    "annonce": { "name": "Annonce" },
    "lea": { "name": "Léa", "portrait": "assets/characters/lea.png" }
  },
  "quests": [
    {
      "id": "avant-arrivee",
      "title": "Avant l'arrivée",
      "if": ["depart"],
      "ifNot": ["arrivee"],
      "objectives": [
        { "text": "Fouiller la valise", "done": "lettre-lue" },
        { "text": "Explorer l'extérieur du train", "done": "licorne-vue" }
      ]
    }
  ],
  "maps": [
    { "id": "train-interieur", "name": "Train (intérieur)", "file": "data/maps/train-interieur.json", "inMenu": false }
  ]
}
```

- Un personnage sans `portrait` parle sans image (le joueur, une annonce…). Avec un `portrait`, l'image s'affiche au-dessus de la zone de texte. Avec `"portraitFull": true`, le portrait est une image 16/9 transparente où le personnage est déjà placé (`naevys.png` à droite, `phyla.png` à gauche), posée sur le décor dès qu'il parle. Elle reste affichée jusqu'à la fin du dialogue (répliques du joueur comprises) ; plusieurs personnages peuvent être à l'écran ensemble, celui qui parle au premier plan. Les portraits sont masqués pendant une vidéo de réplique (`media`), qui montre déjà le personnage.
- Une quête s'affiche dans le cadre « Quête en cours » tant que sa condition est remplie ; chaque objectif se coche quand son flag `done` est posé.
- Un objectif peut être un compteur : `{ "text": "Jardin", "count": ["serre-vue", "cours-vu", "pergola-vue"] }` affiche « Jardin : 1/3 » et se coche quand tous les flags sont posés. Un objectif peut aussi porter `if` / `ifNot` pour n'apparaître qu'au bon moment (ex. « Retourne voir Naevys » quand tout est exploré).

### Une map

```json
{
  "id": "train-interieur",
  "name": "Train (intérieur)",
  "background": "assets/backgrounds/train-interieur.jpg",
  "triggers": [
    { "dialogue": "annonce-depart" },
    { "dialogue": "annonce-arrivee", "if": ["lettre-lue", "licorne-vue"] }
  ],
  "regions": [
    {
      "id": "valise",
      "label": "La valise",
      "shape": { "type": "polygon", "points": [[68.5, 50], [78.3, 50.7], [78.1, 64.1], [68.9, 61.9]] },
      "action": { "type": "dialogue", "dialogue": "valise" }
    },
    {
      "id": "vers-exterieur",
      "ifNot": ["arrivee"],
      "shape": { "type": "rect", "x": 0, "y": 25, "width": 5, "height": 50 },
      "action": { "type": "goto", "map": "train-exterieur" },
      "arrow": "left"
    }
  ],
  "dialogues": {
    "valise": {
      "setFlags": ["lettre-lue"],
      "lines": [{ "text": "À l'intérieur de la valise, il y a une lettre." }]
    },
    "annonce-arrivee": {
      "setFlags": ["arrivee"],
      "lines": [
        { "character": "annonce", "text": "« Le train arrive en gare de Glyglyland… »" },
        {
          "character": "joueur",
          "text": "Je rassemble mes affaires et je descends du train.",
          "choices": [{ "text": "Suite", "goto": "inter-scene-1-2" }]
        }
      ]
    }
  }
}
```

- **Coordonnées en % de l'image** (0 à 100) : les zones suivent l'image quelle que soit la taille de l'écran.
- **Formes** : `rect` (x, y, largeur, hauteur) ou `polygon` (`"points": [[x, y], ...]`) pour épouser un objet. La forme s'illumine au survol.
- **Actions** : `dialogue` ouvre un dialogue de la map, `goto` change de map. `arrow` affiche une flèche dans la zone, `button` un bouton toujours visible (ex. `"button": "Porte"`).
- **`setFlags` sur la map** : flags posés dès qu'on y arrive (ex. `"setFlags": ["serre-vue"]` pour compter un lieu visité).
- **Dialogues** : une suite de répliques ; `character` absent = narration. Une réplique peut proposer des `choices` (boutons) qui enchaînent sur un autre dialogue (`next`), changent de map (`goto`), posent des flags (`setFlags`) ou ferment le dialogue. Un dialogue peut aussi avoir son propre `next` : à la fin de sa dernière réplique, il enchaîne sur ce dialogue au lieu de se fermer (ex. revenir à la question de départ pour choisir une autre option). Ce `next` peut être une liste de branches : le premier dialogue dont la condition est remplie est choisi, ex. `"next": [{ "dialogue": "pensee-confiant", "ifMore": { "flags": [...], "than": [...] } }, { "dialogue": "pensee-peu-assure" }]`.

### Flags, conditions et triggers

C'est ce qui rend l'histoire conditionnelle :

- un dialogue (ou un choix) pose des **flags** avec `setFlags` ;
- une zone, une quête, un objectif, un choix ou un trigger peut porter une **condition** : `if` (tous ces flags posés) et/ou `ifNot` (aucun de ces flags), et/ou `ifMore` (plus de flags posés dans `flags` que dans `than`, pour les textes « si majorité de A ») ;
- les **triggers** d'une map lancent un dialogue tout seuls, une seule fois, dès que leur condition est remplie : à l'arrivée sur la map et après chaque dialogue.

### Vidéos

Partout où une image est attendue (`background` d'une map, `portrait`, `titleBackground`, `media` d'une réplique), on peut mettre une vidéo `.mp4` ou `.webm` : elle a le même cadrage que l'image, les zones cliquables restent par-dessus, et elle tourne en boucle.

- **Une liste** est jouée à la suite, la dernière en boucle : `"background": ["assets/videos/lancement-sort-naevys.mp4", "assets/videos/loop-sort-naevys.mp4"]`. Pour qu'une vidéo ne se joue qu'une fois, la faire suivre d'une image : `["assets/videos/lancement-sort-naevys.mp4", "assets/backgrounds/biblio-bureau-nuit.jpg"]`.
- **`media` sur une réplique** : image ou vidéo plein écran sur la scène à partir de cette réplique, jusqu'à la fin du dialogue (dialogues enchaînés compris). Pratique pour un changement de plan ou une cinématique en plein dialogue. Les portraits s'affichent par-dessus. `"media": ""` la retire.

```json
{ "text": "Naevys se dirige vers le sol arcanique…", "media": "assets/videos/loop-sort-naevys.mp4" }
```

- **`"waitMedia": true`** : la réplique ne peut pas être passée (ni clic ni touche) et avance seule à la fin de la vidéo. Le `media` doit être une liste où la vidéo est suivie d'une image, sinon elle tournerait en boucle (`npm run check` le vérifie).

```json
{
  "character": "naevys",
  "text": "« Que l'énergie ancienne soit scellée ! »",
  "waitMedia": true,
  "media": ["assets/videos/lancement-sort-naevys.mp4", "assets/backgrounds/biblio-bureau-nuit.jpg"]
}
```

Le son est joué si le navigateur l'autorise (c'est le cas après le clic sur « Jouer »), sinon la vidéo est lue sans le son. Pour un chargement rapide, garder les vidéos légères (1080p en H.264, quelques Mo).

### Interlude (fond uni)

```json
{
  "id": "inter-scene-1-2",
  "name": "Vers la bibliothèque",
  "backgroundColor": "#1c1730",
  "interlude": { "text": "À la sortie du train…", "next": "bibliotheque" }
}
```

`next` affiche un bouton « Suite » vers la map indiquée. Une ligne vide dans `text` (`\n\n`) sépare deux paragraphes. Comme toute map, un interlude peut poser des flags avec `setFlags` (ex. `nouvelle-journee` pour lancer la scène 4).

### Crédits et statistiques

La map `credits.json` affiche les crédits sur son `background` flouté, puis les statistiques du joueur comparées à celles des autres joueurs. La scène finale y mène par un choix `"goto": "credits"`.

```json
"credits": {
  "text": "Glyglyland et l'énergie ancienne\n\nHistoire : Phyla_Miila",
  "thanks": "Merci d'avoir joué !",
  "stats": [
    {
      "id": "jour-1",
      "answers": [
        { "id": "confiant", "flags": ["jour1-confiant-1", "jour1-confiant-2", "jour1-confiant-3"], "text": "Vous avez été confiant·e comme {pct} % des joueurs, contre {pct:peu-assure} %…" },
        { "id": "peu-assure", "flags": ["jour1-peu-assure-1", "jour1-peu-assure-2", "jour1-peu-assure-3"], "text": "…" }
      ]
    }
  ]
}
```

- Le premier paragraphe de `text` s'affiche en titre.
- Pour chaque statistique, le joueur reçoit la réponse dont il a posé le plus de `flags` (majorité de choix A ou B) ; égalité : la première. Une réponse sans `flags` sert de réponse par défaut. Un `text` vide n'affiche rien pour cette réponse, mais le joueur est compté.
- `{pct}` = % des joueurs ayant la même réponse, `{pct:<id>}` = % ayant la réponse `<id>`.
- À l'arrivée sur les crédits, le jeu envoie les réponses au script Google (`stats/apps-script.gs`), qui les range dans l'onglet **Fins** (une ligne par joueur : seule sa dernière partie terminée compte) et renvoie les pourcentages. Sans réponse du script (hors ligne, pas de `statsUrl`), les crédits s'affichent sans les statistiques. En mode debug, la partie n'est pas comptée mais les pourcentages s'affichent.
- `npm run check` avertit quand un flag d'une statistique n'est posé par aucun choix.

## Le mode debug

Appuie sur **D** (ou ajoute `?debug` à l'URL, ex. `http://localhost:4200/?debug#/map/train-exterieur`, qui saute aussi l'écran titre ; `?debug=zones` ouvre directement l'onglet Zones). Toutes les zones s'affichent avec leur id, même celles masquées par une condition (bleu = dialogue, jaune = sortie, pointillés = condition non remplie). Le panneau en haut à gauche a deux onglets et peut être replié.

Le mode debug n'existe qu'en dev (`npm start`, ou `ng build --configuration development`). Dans le build de production, celui publié sur GitHub Pages, la touche **D** et `?debug` sont ignorés.

**Partie** : pour tester l'histoire sans la rejouer depuis le début. Le jeu reste jouable.

- **Aller à** : saute sur n'importe quelle map ;
- **Flags** : coche ou décoche n'importe quel flag du jeu ; le champ filtre la liste, **Entrée** pose un flag qui n'existe pas encore ;
- **Dialogues de la map** : ouvre directement n'importe quel dialogue ;
- **Triggers** : joué, prêt ou en attente (avec les flags qui manquent ou qui bloquent), et **Rejouer** pour relancer un trigger déjà vu ;
- **Quêtes** : en cours (avec la progression) ou pourquoi elles ne s'affichent pas ;
- **Recommencer la partie** : efface flags et triggers et revient à la map de départ.

**Zones** : pour définir les zones cliquables.

- la position du curseur s'affiche en % ;
- **Rectangle** : clique-glisse sur l'image ; **Polygone** : clique chaque sommet ;
- le JSON de la zone s'affiche, **Copier le JSON** puis colle-le dans `regions` et ajuste `id`, `label` et `action`.

**D** à nouveau pour revenir au jeu, **Échap** pour effacer le tracé. Le mode debug ne sauvegarde pas : la vraie partie reste intacte.

## Navigation entre les maps

1. **Flèches** : une zone `goto` avec `"arrow"`, placée où l'on veut (bord, porte…). C'est ce qu'utilise la scène 1.
2. **Menu « Carte »** en haut à droite : liste les maps de `game.json` sauf celles en `"inMenu": false`. Il est masqué pour l'instant (toutes les maps de la scène 1 sont en `false`), pour ne pas sauter des étapes de l'histoire.

## Ajouter un background

Dépose l'image dans `public/assets/backgrounds/` (JPG, PNG, WebP…) et mets son chemin dans `background`. Le ratio de l'écran s'adapte à celui de l'image (les deux images du train sont en 1920×1080). Trace ensuite les zones avec le mode debug (onglet Zones).
