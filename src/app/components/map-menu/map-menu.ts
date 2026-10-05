import { Component, computed, inject, input, output, signal } from '@angular/core';
import { GameDataService } from '../../services/game-data.service';

/** Bouton « Carte » ouvrant la liste des maps (celles de game.json avec `inMenu` ≠ false). */
@Component({
  selector: 'app-map-menu',
  templateUrl: './map-menu.html',
  styleUrl: './map-menu.scss',
})
export class MapMenu {
  private readonly data = inject(GameDataService);

  readonly currentId = input.required<string>();
  readonly selectMap = output<string>();

  protected readonly open = signal(false);
  protected readonly maps = computed(() => (this.data.config()?.maps ?? []).filter((m) => m.inMenu !== false));

  protected pick(id: string): void {
    this.open.set(false);
    if (id !== this.currentId()) this.selectMap.emit(id);
  }
}
