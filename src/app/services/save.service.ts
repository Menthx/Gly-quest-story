import { Injectable, effect, inject } from '@angular/core';
import { DebugService } from './debug.service';
import { DialogueService } from './dialogue.service';
import { GameStateService } from './game-state.service';

const STORAGE_KEY = 'gly-quest-story/save';
const VERSION = 1;

/** Partie sauvegardée dans le navigateur (localStorage). */
export interface SaveData {
  version: number;
  pseudo: string;
  flags: string[];
  triggersPlayed: string[];
  map: string | null;
  /** Dialogue affiché au moment de la sauvegarde : il est rouvert au début à la reprise. */
  dialogue: string | null;
  savedAt: string;
}

/**
 * Sauvegarde automatique : à chaque changement (flag, map, dialogue), la partie est écrite dans le
 * localStorage. Au rechargement, l'écran titre propose de la reprendre ou d'en commencer une nouvelle.
 */
@Injectable({ providedIn: 'root' })
export class SaveService {
  private readonly state = inject(GameStateService);
  private readonly dialogue = inject(DialogueService);
  private readonly debug = inject(DebugService);

  constructor() {
    effect(() => {
      const pseudo = this.state.pseudo();
      // Pas de sauvegarde en mode debug, pour ne pas écraser la vraie partie avec celle du « Testeur ».
      if (!pseudo || this.debug.enabled()) return;
      this.write({
        version: VERSION,
        pseudo,
        flags: [...this.state.flags()],
        triggersPlayed: [...this.dialogue.triggersPlayed()],
        map: this.state.currentMap(),
        dialogue: this.dialogue.openId(),
        savedAt: new Date().toISOString(),
      });
    });
  }

  /** Sauvegarde existante, ou `null` (aucune, illisible ou d'une ancienne version). */
  load(): SaveData | null {
    try {
      const save = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as SaveData | null;
      return save?.version === VERSION && save.pseudo ? save : null;
    } catch {
      return null;
    }
  }

  /** Remet la partie dans l'état de la sauvegarde ; renvoie la map où reprendre. */
  restore(save: SaveData): string | null {
    this.state.start(save.pseudo, save.flags, save.map);
    this.dialogue.reset(
      save.triggersPlayed,
      save.map && save.dialogue ? { mapId: save.map, dialogueId: save.dialogue } : null,
    );
    return save.map;
  }

  private write(save: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      // Stockage indisponible (navigation privée, quota) : le jeu continue sans sauvegarde.
    }
  }
}
