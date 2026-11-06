import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { CreditsPage } from './components/credits-page/credits-page';
import { MapView } from './components/map-view/map-view';
import { TitleScreen } from './components/title-screen/title-screen';
import { DebugService } from './services/debug.service';
import { GameStateService } from './services/game-state.service';
import { SaveService } from './services/save.service';

/**
 * Pas de pseudo (nouvelle visite, page rechargée) : retour à l'écran titre.
 * En mode debug on entre directement, pour retoucher les zones d'une map sans repasser par le titre.
 */
const requirePseudo = () => {
  const state = inject(GameStateService);
  if (!state.pseudo() && inject(DebugService).enabled()) state.start('Testeur');
  return !!state.pseudo() || inject(Router).createUrlTree(['/start']);
};

/** Crédits revus depuis l'écran titre : seulement si le joueur a déjà terminé le jeu. */
const requireEnding = () =>
  !!inject(SaveService).loadEnding() || inject(Router).createUrlTree(['/start']);

export const routes: Routes = [
  { path: 'start', component: TitleScreen },
  { path: 'credits', component: CreditsPage, canActivate: [requireEnding] },
  { path: 'map/:id', component: MapView, canActivate: [requirePseudo] },
  { path: '**', redirectTo: 'start' },
];
