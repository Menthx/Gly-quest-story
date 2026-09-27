import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { MapView } from './components/map-view/map-view';
import { GameDataService } from './services/game-data.service';

/** Redirige vers la map de départ définie dans game.json. */
const toStartMap = async () => {
  const router = inject(Router);
  const config = await inject(GameDataService).loadConfig();
  return router.createUrlTree(['/map', config.startMap]);
};

export const routes: Routes = [
  { path: 'map/:id', component: MapView },
  { path: '**', canActivate: [toStartMap], children: [] },
];
