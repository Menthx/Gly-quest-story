import { Injectable, computed, isDevMode, signal } from '@angular/core';

/** Onglet du panneau de debug : tester la partie, ou tracer des zones. */
export type DebugTab = 'partie' | 'zones';

/**
 * Mode debug : affiche toutes les zones, permet de modifier les flags, de sauter d'une map ou d'un
 * dialogue à l'autre, et de tracer de nouvelles zones.
 * Activation : touche `D`, ou `?debug` dans l'URL (`?debug=zones` pour ouvrir directement le traçage).
 * Disponible seulement en dev (`ng serve`, `ng build --configuration development`) : dans le build de
 * production, `isDevMode()` est faux, la touche `D` et `?debug` sont ignorés.
 */
@Injectable({ providedIn: 'root' })
export class DebugService {
  /** Faux dans le build de production : le mode debug y est inaccessible. */
  readonly available = isDevMode();
  private readonly param = this.available ? new URLSearchParams(location.search).get('debug') : null;

  readonly enabled = signal(this.param !== null);
  readonly tab = signal<DebugTab>(this.param === 'zones' ? 'zones' : 'partie');
  /** Onglet « Zones » : les clics sur l'image tracent une zone au lieu de jouer. */
  readonly drawing = computed(() => this.enabled() && this.tab() === 'zones');

  toggle(): void {
    if (!this.available) return;
    this.enabled.update((v) => !v);
  }
}
