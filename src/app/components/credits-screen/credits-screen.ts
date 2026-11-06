import { Component, computed, inject, input, signal, untracked, effect } from '@angular/core';
import { Router } from '@angular/router';
import { Credits, Media } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { EndingData } from '../../services/save.service';
import { StatsService } from '../../services/stats.service';
import { profile, statLines } from '../../utils/credits';
import { MediaView } from '../media/media';

/** Durée du générique, en secondes. */
const ROLL_DURATION = 12;

/**
 * Écran de fin : les crédits défilent vers le haut sur le fond flouté, comme un générique de film
 * (on ne peut pas le passer), puis l'encadré « Merci d'avoir joué » affiche les statistiques du joueur
 * comparées à celles des autres joueurs (« … comme 62 % des joueurs ») et reste à l'écran.
 * Sans réponse du script, les statistiques sont omises.
 *
 * Avec `ending` (crédits revus depuis l'écran titre), le pseudo et les réponses viennent de la dernière
 * fin de partie mémorisée, et les statistiques sont seulement lues : la partie n'est pas comptée deux fois.
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
  /** Fin de partie mémorisée, quand les crédits sont revus depuis l'écran titre. */
  readonly ending = input<EndingData>();

  private readonly state = inject(GameStateService);
  private readonly stats = inject(StatsService);
  private readonly router = inject(Router);

  protected readonly paragraphs = computed(() =>
    this.format(this.credits().text).split(/\n\s*\n/),
  );
  protected readonly rollDuration = `${ROLL_DURATION}s`;
  /** Le générique est terminé : l'encadré des statistiques s'affiche. */
  protected readonly rolled = signal(
    !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  /** `null` : en attente du script ; liste vide : pas de statistiques à afficher. */
  protected readonly lines = signal<string[] | null>(null);

  constructor() {
    effect(() => {
      const credits = this.credits();
      const ending = this.ending();
      untracked(() => this.loadStats(credits, ending));
    });
  }

  private format(text: string): string {
    const ending = this.ending();
    return ending ? text.replaceAll('{pseudo}', ending.pseudo) : this.state.format(text);
  }

  private async loadStats(credits: Credits, ending: EndingData | undefined): Promise<void> {
    const stats = credits.stats ?? [];
    if (!stats.length) {
      this.lines.set([]);
      return;
    }
    this.lines.set(null);
    const answers = profile(stats, ending ? new Set(ending.flags) : this.state.flags());
    const counts = ending ? await this.stats.results() : await this.stats.finish(answers);
    if (this.credits() !== credits || this.ending() !== ending) return;
    this.lines.set(counts ? statLines(stats, answers, counts).map((l) => this.format(l)) : []);
  }

  protected endRoll(): void {
    this.rolled.set(true);
  }

  protected backToTitle(): void {
    this.router.navigate(['/start']);
  }
}
