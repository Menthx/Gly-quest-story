import { Injectable, computed, signal } from '@angular/core';

/** Onglet du panneau de debug : tester la partie, ou tracer des zones. */
export type DebugTab = 'partie' | 'zones';

/**
 * Mode debug : affiche toutes les zones, permet de modifier les flags, de sauter d'une map ou d'un
 * dialogue à l'autre, et de tracer de nouvelles zones.
 * Activation : touche `D`, ou `?debug` dans l'URL (`?debug=zones` pour ouvrir directement le traçage).
 */
@Injectable({ providedIn: 'root' })
export class DebugService {
  private readonly param = new URLSearchParams(location.search).get('debug');

  readonly enabled = signal(this.param !== null);
  readonly tab = signal<DebugTab>(this.param === 'zones' ? 'zones' : 'partie');
  /** Onglet « Zones » : les clics sur l'image tracent une zone au lieu de jouer. */
  readonly drawing = computed(() => this.enabled() && this.tab() === 'zones');

  toggle(): void {
    this.enabled.update((v) => !v);
  }
}
