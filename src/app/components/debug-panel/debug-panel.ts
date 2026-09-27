import { Component, computed, input, output, signal } from '@angular/core';
import { Region, Shape } from '../../models/game.models';

export type DrawMode = 'rect' | 'polygon';

/** Panneau du mode debug : coordonnées du curseur et JSON de la zone dessinée, prêt à copier. */
@Component({
  selector: 'app-debug-panel',
  templateUrl: './debug-panel.html',
  styleUrl: './debug-panel.scss',
})
export class DebugPanel {
  readonly mapId = input.required<string>();
  readonly cursor = input<{ x: number; y: number } | null>(null);
  readonly draft = input<Shape | null>(null);
  readonly mode = input<DrawMode>('rect');

  readonly modeChange = output<DrawMode>();
  readonly clear = output<void>();

  protected readonly copied = signal(false);

  /** Zone complète au format du JSON de map, à coller dans `regions`. */
  protected readonly snippet = computed(() => {
    const shape = this.draft();
    if (!shape) return '';
    const region: Region = {
      id: 'nouvelle-zone',
      label: 'Nouvelle zone',
      shape,
      action: { type: 'dialogue', dialogue: 'id-du-dialogue' },
    };
    return JSON.stringify(region, null, 2)
      // Garde chaque point [x, y] sur une seule ligne.
      .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]');
  });

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.snippet());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
