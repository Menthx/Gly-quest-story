import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';

/** Écran titre : le joueur donne son pseudo avant de jouer. */
@Component({
  selector: 'app-title-screen',
  imports: [FormsModule],
  templateUrl: './title-screen.html',
  styleUrl: './title-screen.scss',
})
export class TitleScreen {
  private readonly router = inject(Router);
  private readonly state = inject(GameStateService);
  private readonly dialogue = inject(DialogueService);
  protected readonly config = inject(GameDataService).config;

  protected readonly pseudo = signal(this.state.pseudo());

  protected play(): void {
    const config = this.config();
    const pseudo = this.pseudo().trim();
    if (!config || !pseudo) return;
    this.state.start(pseudo);
    this.dialogue.reset();
    this.router.navigate(['/map', config.startMap]);
  }
}
