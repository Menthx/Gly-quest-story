import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';
import { SaveService } from '../../services/save.service';

/** Écran titre : reprendre la partie sauvegardée, ou en commencer une en donnant son pseudo. */
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
  private readonly saves = inject(SaveService);
  protected readonly config = inject(GameDataService).config;

  /** Partie sauvegardée proposée à la reprise (masquée quand on choisit « Nouvelle partie »). */
  protected readonly save = signal(this.saves.load());
  protected readonly saveMapName = computed(() => {
    const id = this.save()?.map;
    return this.config()?.maps.find((m) => m.id === id)?.name ?? null;
  });
  protected readonly pseudo = signal(this.state.pseudo());

  protected resume(): void {
    const save = this.save();
    const config = this.config();
    if (!save || !config) return;
    const map = this.saves.restore(save);
    this.router.navigate(['/map', map ?? config.startMap]);
  }

  protected newGame(): void {
    this.pseudo.set(this.save()?.pseudo ?? '');
    this.save.set(null);
  }

  protected play(): void {
    const config = this.config();
    const pseudo = this.pseudo().trim();
    if (!config || !pseudo) return;
    this.state.start(pseudo);
    this.dialogue.reset();
    this.router.navigate(['/map', config.startMap]);
  }
}
