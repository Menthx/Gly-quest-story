import { Component, computed, inject, input, signal, untracked, effect } from '@angular/core';
import { Router } from '@angular/router';
import { Credits } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { StatsService } from '../../services/stats.service';
import { profile, statLines } from '../../utils/credits';

/**
 * Écran de fin : crédits sur le fond flouté, puis les statistiques du joueur comparées à celles des
 * autres joueurs (« … comme 62 % des joueurs »). Sans réponse du script, les statistiques sont omises.
 */
@Component({
  selector: 'app-credits-screen',
  templateUrl: './credits-screen.html',
  styleUrl: './credits-screen.scss',
})
export class CreditsScreen {
  readonly credits = input.required<Credits>();
  readonly background = input<string>();
  readonly backgroundColor = input<string>();

  private readonly state = inject(GameStateService);
  private readonly stats = inject(StatsService);
  private readonly router = inject(Router);

  protected readonly paragraphs = computed(() =>
    this.state.format(this.credits().text).split(/\n\s*\n/),
  );
  /** `null` : en attente du script ; liste vide : pas de statistiques à afficher. */
  protected readonly lines = signal<string[] | null>(null);

  constructor() {
    effect(() => {
      const credits = this.credits();
      untracked(() => this.loadStats(credits));
    });
  }

  private async loadStats(credits: Credits): Promise<void> {
    const stats = credits.stats ?? [];
    if (!stats.length) {
      this.lines.set([]);
      return;
    }
    this.lines.set(null);
    const answers = profile(stats, this.state.flags());
    const counts = await this.stats.finish(answers);
    if (this.credits() !== credits) return;
    this.lines.set(
      counts ? statLines(stats, answers, counts).map((l) => this.state.format(l)) : [],
    );
  }

  protected backToTitle(): void {
    this.router.navigate(['/start']);
  }
}
