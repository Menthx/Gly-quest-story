/**
 * Types décrivant les fichiers JSON du jeu.
 *
 * - `public/data/game.json`        : index du jeu (personnages, liste des maps, map de départ)
 * - `public/data/maps/<id>.json`   : une map = un background + ses zones cliquables + ses dialogues
 *
 * Toutes les coordonnées sont en POURCENTAGE de l'image (0 à 100), pour que les zones
 * suivent l'image quelle que soit la taille de l'écran.
 */

/** Fichier `game.json`. */
export interface GameConfig {
  title: string;
  /** Id de la map affichée au lancement. */
  startMap: string;
  /** Liste des maps (sert aussi au menu de navigation). */
  maps: MapEntry[];
  /** Personnages pouvant parler dans les dialogues, indexés par id. */
  characters: Record<string, Character>;
}

export interface MapEntry {
  id: string;
  /** Nom affiché dans le menu. */
  name: string;
  /** Chemin du JSON de la map, relatif à `public/` (ex. `data/maps/cour.json`). */
  file: string;
  /** Si `false`, la map n'apparaît pas dans le menu (accessible seulement par une sortie). */
  inMenu?: boolean;
}

export interface Character {
  name: string;
  /** Image du personnage (relative à `public/`). */
  portrait: string;
  /** Couleur du nom dans la boîte de dialogue (optionnel). */
  color?: string;
}

/** Fichier `maps/<id>.json`. */
export interface GameMap {
  id: string;
  name: string;
  /** Image de fond (relative à `public/`). */
  background: string;
  regions: Region[];
  /** Dialogues de la map, indexés par id. */
  dialogues: Record<string, Dialogue>;
  /** Dialogue joué automatiquement à l'arrivée sur la map (optionnel). */
  onEnter?: string;
}

/** Rectangle : coin haut-gauche (x, y) + largeur/hauteur, en %. */
export interface RectShape {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Polygone : liste de points [x, y] en %. */
export interface PolygonShape {
  type: 'polygon';
  points: [number, number][];
}

export type Shape = RectShape | PolygonShape;

/** Ouvre un dialogue de la map courante. */
export interface DialogueAction {
  type: 'dialogue';
  dialogue: string;
}

/** Change de map. */
export interface GotoAction {
  type: 'goto';
  map: string;
}

export type RegionAction = DialogueAction | GotoAction;

export interface Region {
  id: string;
  /** Texte affiché au survol. */
  label?: string;
  shape: Shape;
  action: RegionAction;
  /** Affiche une flèche dans la zone (pratique pour les sorties sur les bords). */
  arrow?: 'left' | 'right' | 'up' | 'down';
}

export interface Dialogue {
  lines: DialogueLine[];
}

export interface DialogueLine {
  /** Id du personnage (clé de `characters` dans game.json). Absent = narrateur. */
  character?: string;
  text: string;
  /** Choix proposés après cette réplique : chaque choix enchaîne sur un autre dialogue ou change de map. */
  choices?: DialogueChoice[];
}

export interface DialogueChoice {
  text: string;
  /** Id du dialogue suivant (dans la même map). Absent = ferme le dialogue. */
  next?: string;
  /** Change de map après ce choix (optionnel). */
  goto?: string;
}
