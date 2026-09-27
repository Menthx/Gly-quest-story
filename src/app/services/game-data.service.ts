import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GameConfig, GameMap } from '../models/game.models';

/** Charge `game.json` et les JSON des maps (avec cache). */
@Injectable({ providedIn: 'root' })
export class GameDataService {
  private readonly http = inject(HttpClient);
  private readonly mapCache = new Map<string, Promise<GameMap>>();
  private configPromise?: Promise<GameConfig>;

  /** Configuration du jeu, disponible une fois `loadConfig()` résolu. */
  readonly config = signal<GameConfig | null>(null);

  loadConfig(): Promise<GameConfig> {
    this.configPromise ??= firstValueFrom(this.http.get<GameConfig>('data/game.json')).then((config) => {
      this.config.set(config);
      return config;
    });
    return this.configPromise;
  }

  async loadMap(id: string): Promise<GameMap> {
    const config = await this.loadConfig();
    const entry = config.maps.find((m) => m.id === id);
    if (!entry) {
      throw new Error(`Map inconnue : "${id}". Vérifie la liste "maps" dans data/game.json.`);
    }
    let map = this.mapCache.get(id);
    if (!map) {
      map = firstValueFrom(this.http.get<GameMap>(entry.file));
      map.catch(() => this.mapCache.delete(id));
      this.mapCache.set(id, map);
    }
    return map;
  }
}
