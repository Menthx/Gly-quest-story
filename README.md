# Gly Quest Story

Jeu narratif façon Amour Sucré : des backgrounds interactifs (« maps »), des zones cliquables et des dialogues avec le portrait du personnage qui parle. Tout le contenu est décrit en JSON, sans toucher au code.

## Lancer le projet

Il faut **Node 22.22.3+ ou 24.15+** (exigence d'Angular 22).

```bash
npm install
npm start          # http://localhost:4200
npm test           # tests unitaires
npm run build      # version de production dans dist/
```

## Où est le contenu

```
public/
├── data/
│   ├── game.json            ← titre, map de départ, liste des maps, personnages
│   └── maps/
│       ├── chambre.json     ← une map = un background + ses zones + ses dialogues
│       └── ...
└── assets/
    ├── backgrounds/         ← images de fond (provisoires pour l'instant)
    └── characters/          ← portraits des personnages
schemas/                     ← schémas JSON : autocomplétion et vérification dans VS Code
```

Tous les chemins d'images sont relatifs à `public/`.

### game.json

```json
{
  "title": "Gly Quest Story",
  "startMap": "chambre",
  "characters": {
    "lea": { "name": "Léa", "portrait": "assets/characters/lea.svg", "color": "#ff8fbf" }
  },
  "maps": [
    { "id": "chambre", "name": "La chambre", "file": "data/maps/chambre.json" },
    { "id": "secret", "name": "Pièce secrète", "file": "data/maps/secret.json", "inMenu": false }
  ]
}
```

### Une map

```json
{
  "id": "couloir",
  "name": "Le couloir",
  "background": "assets/backgrounds/couloir.png",
  "onEnter": "arrivee",
  "regions": [
    {
      "id": "lea",
      "label": "Léa",
      "shape": { "type": "rect", "x": 42, "y": 25, "width": 14, "height": 60 },
      "action": { "type": "dialogue", "dialogue": "lea" }
    },
    {
      "id": "vers-cour",
      "label": "Aller dans la cour",
      "shape": { "type": "rect", "x": 92, "y": 20, "width": 8, "height": 70 },
      "action": { "type": "goto", "map": "cour" },
      "arrow": "right"
    }
  ],
  "dialogues": {
    "arrivee": { "lines": [{ "text": "Le couloir est désert." }] },
    "lea": {
      "lines": [
        { "character": "lea", "text": "Salut !" },
        {
          "character": "lea",
          "text": "Tu veux visiter ?",
          "choices": [
            { "text": "Oui", "next": "lea-oui" },
            { "text": "Non" },
            { "text": "Allons dans la cour", "goto": "cour" }
          ]
        }
      ]
    },
    "lea-oui": { "lines": [{ "character": "lea", "text": "Suis-moi !" }] }
  }
}
```

- **Coordonnées en % de l'image** (0 à 100) : les zones suivent l'image quelle que soit la taille de l'écran.
- **Formes** : `rect` (x, y, largeur, hauteur) ou `polygon` (`"points": [[x, y], ...]`) pour les formes irrégulières (un personnage, un arbre…).
- **Actions** : `dialogue` ouvre un dialogue de la map, `goto` change de map.
- **Dialogues** : une suite de répliques ; `character` absent = narrateur. Une réplique peut proposer des `choices` qui enchaînent sur un autre dialogue (`next`), changent de map (`goto`), ou ferment simplement le dialogue.
- **`onEnter`** : dialogue joué la première fois qu'on arrive sur la map.

## Définir les zones cliquables : le mode debug

Appuie sur **D** (ou ajoute `?debug` à l'URL, ex. `http://localhost:4200/?debug`) :

- toutes les zones s'affichent avec leur id (bleu = dialogue, jaune = sortie) ;
- la position du curseur s'affiche en % ;
- **Rectangle** : clique-glisse sur l'image ; **Polygone** : clique chaque sommet ;
- le JSON de la zone s'affiche, **Copier le JSON** puis colle-le dans `regions` et ajuste `id`, `label` et `action`.

**D** à nouveau pour revenir au jeu, **Échap** pour effacer le tracé.

## Navigation entre les maps

Deux moyens, tous deux pilotés par le JSON, qu'on peut garder ou supprimer indépendamment :

1. **Sorties sur les bords** : une zone `goto` avec une flèche (`"arrow": "left"`), placée où l'on veut (bord, porte…).
2. **Menu « Carte »** en haut à droite : liste les maps de `game.json` (sauf `"inMenu": false`).

Chaque map a sa propre URL (`#/map/cour`), donc le bouton Retour du navigateur fonctionne.

## Remplacer les backgrounds provisoires

Dépose ton image dans `public/assets/backgrounds/` (PNG, JPG, WebP…) et mets son chemin dans `background`. Le ratio de l'écran s'adapte automatiquement à celui de l'image. Pense à garder le même ratio pour toutes les maps (ex. 16:9) pour un rendu homogène, puis redéfinis les zones avec le mode debug.
