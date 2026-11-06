import { Component, inject, resource } from '@angular/core';
import { GameDataService } from '../../services/game-data.service';
import { SaveService } from '../../services/save.service';
import { CreditsScreen } from '../credits-screen/credits-screen';

/**
 * Crédits revus depuis l'écran titre (bouton visible une fois le jeu terminé) : le générique et les
 * statistiques de la dernière fin de partie, sans toucher à la partie sauvegardée.
 */
@Component({
  selector: 'app-credits-page',
  imports: [CreditsScreen],
  template: `
    @if (map.value(); as m) {
      @if (m.credits) {
        <app-credits-screen
          [credits]="m.credits"
          [ending]="ending!"
          [background]="m.background"
          [backgroundColor]="m.backgroundColor"
        />
      }
    }
  `,
  styles: ':host { display: block; width: 100vw; height: 100dvh; background: #1c1730; }',
})
export class CreditsPage {
  private readonly data = inject(GameDataService);
  /** Toujours présente : la route est gardée par `requireEnding`. */
  protected readonly ending = inject(SaveService).loadEnding();

  protected readonly map = resource({
    params: () => this.ending?.map,
    loader: ({ params }) => this.data.loadMap(params),
  });
}
