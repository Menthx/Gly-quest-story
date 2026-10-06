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

`npm run check` signale les fautes de frappe qui, sinon, bloqueraient la partie sans aucune erreur : clé inconnue, map, dialogue, personnage ou image introuvable, flag testé (`if`, `ifNot`, objectif de quête) mais jamais posé par un `setFlags`.

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
│       └── inter-scene-1-2.json  ← texte de transition vers la scène 2
└── assets/
    └── backgrounds/              ← images de fond
schemas/                          ← schémas JSON : autocomplétion et vérification dans VS Code
```

Tous les chemins d'images sont relatifs à `public/`. Partout dans les textes, `{pseudo}` est remplacé par le pseudo du joueur.

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

- Un personnage sans `portrait` parle sans image (le joueur, une annonce…). Avec un `portrait`, l'image s'affiche au-dessus de la zone de texte.
- Une quête s'affiche dans le cadre « Quête en cours » tant que sa condition est remplie ; chaque objectif se coche quand son flag `done` est posé.

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
- **Actions** : `dialogue` ouvre un dialogue de la map, `goto` change de map. `arrow` affiche une flèche dans la zone.
- **Dialogues** : une suite de répliques ; `character` absent = narration. Une réplique peut proposer des `choices` (boutons) qui enchaînent sur un autre dialogue (`next`), changent de map (`goto`), posent des flags (`setFlags`) ou ferment le dialogue.

### Flags, conditions et triggers

C'est ce qui rend l'histoire conditionnelle :

- un dialogue (ou un choix) pose des **flags** avec `setFlags` ;
- une zone, une quête ou un trigger peut porter une **condition** : `if` (tous ces flags posés) et/ou `ifNot` (aucun de ces flags) ;
- les **triggers** d'une map lancent un dialogue tout seuls, une seule fois, dès que leur condition est remplie : à l'arrivée sur la map et après chaque dialogue.

### Interlude (fond uni)

```json
{
  "id": "inter-scene-1-2",
  "name": "Vers la bibliothèque",
  "backgroundColor": "#1c1730",
  "interlude": { "text": "À la sortie du train…", "next": "bibliotheque" }
}
```

`next` affiche un bouton « Suite » vers la map indiquée.

## Définir les zones cliquables : le mode debug

Appuie sur **D** (ou ajoute `?debug` à l'URL, ex. `http://localhost:4200/?debug#/map/train-exterieur`, qui saute aussi l'écran titre) :

- toutes les zones s'affichent avec leur id, même celles masquées par une condition (bleu = dialogue, jaune = sortie) ;
- la position du curseur s'affiche en % ;
- **Rectangle** : clique-glisse sur l'image ; **Polygone** : clique chaque sommet ;
- le JSON de la zone s'affiche, **Copier le JSON** puis colle-le dans `regions` et ajuste `id`, `label` et `action`.

**D** à nouveau pour revenir au jeu, **Échap** pour effacer le tracé.

## Navigation entre les maps

1. **Flèches** : une zone `goto` avec `"arrow"`, placée où l'on veut (bord, porte…). C'est ce qu'utilise la scène 1.
2. **Menu « Carte »** en haut à droite : liste les maps de `game.json` sauf celles en `"inMenu": false`. Il est masqué pour l'instant (toutes les maps de la scène 1 sont en `false`), pour ne pas sauter des étapes de l'histoire.

## Ajouter un background

Dépose l'image dans `public/assets/backgrounds/` (JPG, PNG, WebP…) et mets son chemin dans `background`. Le ratio de l'écran s'adapte à celui de l'image (les deux images du train sont en 1920×1080). Trace ensuite les zones avec le mode debug.
