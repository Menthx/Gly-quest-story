import { Component, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { GameDataService } from './services/game-data.service';
import { SaveService } from './services/save.service';
import { StatsService } from './services/stats.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: '<router-outlet />',
})
export class App {
  constructor() {
    const data = inject(GameDataService);
    const title = inject(Title);
    inject(SaveService); // démarre la sauvegarde automatique
    inject(StatsService); // démarre l'envoi des statistiques
    data.loadConfig();
    effect(() => {
      const config = data.config();
      if (config) title.setTitle(config.title);
    });
  }
}
