import { Component, computed, inject, input, signal, untracked, effect } from '@angular/core';
import { Router } from '@angular/router';
import { Credits, Media } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { StatsService } from '../../services/stats.service';
import { profile, statLines } from '../../utils/credits';
import { MediaView } from '../media/media';

/** Durée du générique : une base, plus un temps par ligne de texte (en secondes). */
const ROLL_BASE = 6;
const ROLL_PER_LINE = 1.8;

/**
 * Écran de fin : les crédits défilent vers le haut sur le fond flouté, comme un générique de film
 * (on ne peut pas le passer), puis l'encadré « Merci d'avoir joué » affiche les statistiques du joueur
 * comparées à celles des autres joueurs (« … comme 62 % des joueurs ») et reste à l'écran.
 * Sans réponse du script, les statistiques sont omises.
 */
@Component({
  selector: 'app-credits-screen',
  imports: [MediaView],
  templateUrl: './credits-screen.html',
  styleUrl: './credits-screen.scss',
})
export class CreditsScreen {
  readonly credits = input.required<Credits>();
  readonly background = input<Media>();
  readonly backgroundColor = input<string>();

  private readonly state = inject(GameStateService);
  private readonly stats = inject(StatsService);
  private readonly router = inject(Router);

  protected readonly paragraphs = computed(() =>
    this.state.format(this.credits().text).split(/\n\s*\n/),
  );
  /** Durée du défilement, selon la longueur du texte. */
  protected readonly rollDuration = computed(
    () => `${ROLL_BASE + ROLL_PER_LINE * this.credits().text.split('\n').length}s`,
  );
  /** Le générique est terminé : l'encadré des statistiques s'affiche. */
  protected readonly rolled = signal(
    !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
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

  protected endRoll(): void {
    this.rolled.set(true);
  }

  protected backToTitle(): void {
    this.router.navigate(['/start']);
  }
}
