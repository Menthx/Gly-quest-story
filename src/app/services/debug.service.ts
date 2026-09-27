import { Injectable, signal } from '@angular/core';

/**
 * Mode debug : affiche toutes les zones et permet d'en dessiner de nouvelles.
 * Activation : touche `D`, ou `?debug` dans l'URL.
 */
@Injectable({ providedIn: 'root' })
export class DebugService {
  readonly enabled = signal(new URLSearchParams(location.search).has('debug'));

  toggle(): void {
    this.enabled.update((v) => !v);
  }
}
