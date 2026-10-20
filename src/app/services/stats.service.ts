import { Injectable, effect, inject } from '@angular/core';
import { DebugService } from './debug.service';
import { GameDataService } from './game-data.service';
import { GameStateService } from './game-state.service';

const PLAYER_KEY = 'gly-quest-story/player';
/** Délai avant l'envoi groupé des événements. */
const FLUSH_DELAY = 3000;

/** Un événement de progression, écrit comme une ligne dans le Google Sheet. */
export interface StatsEvent {
  /** Identifiant anonyme du navigateur (le même d'une partie à l'autre). */
  player: string;
  pseudo: string;
  /** `partie` (valeur : nouvelle / reprise), `map`, `flag` ou `choix`. */
  type: 'partie' | 'map' | 'flag' | 'choix';
  value: string;
  /** Map où se trouve le joueur. */
  map: string | null;
  at: string;
}

/**
 * Statistiques des joueurs : début de partie, maps visitées, flags posés et choix de dialogue sont
 * envoyés à un Google Sheet (application Web Apps Script, `statsUrl` dans game.json).
 * Rien n'est envoyé sans `statsUrl` ni en mode debug. Un échec d'envoi n'affecte jamais la partie.
 */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly state = inject(GameStateService);
  private readonly debug = inject(DebugService);
  private readonly data = inject(GameDataService);

  private queue: StatsEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastRun = 0;
  private lastFlags: ReadonlySet<string> = new Set();
  private lastMap: string | null = null;
  /** Identifiant de secours quand le localStorage est indisponible (navigation privée). */
  private readonly sessionId = crypto.randomUUID();

  constructor() {
    effect(() => {
      const run = this.state.run();
      const flags = this.state.flags();
      const map = this.state.currentMap();
      if (run !== this.lastRun) {
        // Nouvelle partie ou reprise : les flags de la sauvegarde ne sont pas des nouveautés.
        this.lastRun = run;
        this.lastFlags = flags;
        this.lastMap = null;
        this.record('partie', flags.size ? 'reprise' : 'nouvelle');
      }
      for (const flag of flags) if (!this.lastFlags.has(flag)) this.record('flag', flag);
      this.lastFlags = flags;
      if (map && map !== this.lastMap) this.record('map', map);
      this.lastMap = map;
    });
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  /** Choix de dialogue fait par le joueur (`dialogue : texte du choix`). */
  choice(dialogueId: string | null, text: string): void {
    this.record('choix', dialogueId ? `${dialogueId} : ${text}` : text);
  }

  private record(type: StatsEvent['type'], value: string): void {
    const pseudo = this.state.pseudo();
    if (!pseudo || this.debug.enabled() || !this.data.config()?.statsUrl) return;
    this.queue.push({
      player: this.playerId(),
      pseudo,
      type,
      value,
      map: this.state.currentMap(),
      at: new Date().toISOString(),
    });
    this.timer ??= setTimeout(() => this.flush(), FLUSH_DELAY);
  }

  /** Envoie les événements en attente. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const url = this.data.config()?.statsUrl;
    if (!url || !this.queue.length) return;
    const events = this.queue;
    this.queue = [];
    // `no-cors` + texte brut : Apps Script n'accepte pas les requêtes CORS « préparées ».
    // `keepalive` : l'envoi aboutit même si l'onglet se ferme.
    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ events }),
    }).catch(() => {
      // Hors ligne ou script indisponible : ces statistiques sont perdues, la partie continue.
    });
  }

  private playerId(): string {
    try {
      let id = localStorage.getItem(PLAYER_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(PLAYER_KEY, id);
      }
      return id;
    } catch {
      return this.sessionId;
    }
  }
}
