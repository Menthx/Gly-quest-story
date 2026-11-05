import { Injectable, signal } from '@angular/core';
import { Condition } from '../models/game.models';

/** Progression de la partie : pseudo du joueur et flags posés par les dialogues. */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  readonly pseudo = signal('');
  readonly flags = signal<ReadonlySet<string>>(new Set());
  /** Map où se trouve le joueur. */
  readonly currentMap = signal<string | null>(null);
  /** Incrémenté à chaque nouvelle partie ou reprise de sauvegarde. */
  readonly run = signal(0);

  /** Nouvelle partie, ou reprise avec les flags et la map d'une sauvegarde. */
  start(pseudo: string, flags: string[] = [], currentMap: string | null = null): void {
    this.pseudo.set(pseudo.trim());
    this.flags.set(new Set(flags));
    this.currentMap.set(currentMap);
    this.run.update((n) => n + 1);
  }

  setFlags(flags: string[] | undefined): void {
    if (!flags?.length) return;
    this.flags.update((current) => new Set([...current, ...flags]));
  }

  /** Pose ou retire un flag (mode debug). */
  toggleFlag(flag: string, on = !this.has(flag)): void {
    this.flags.update((current) => {
      const next = new Set(current);
      if (on) next.add(flag);
      else next.delete(flag);
      return next;
    });
  }

  has(flag: string): boolean {
    return this.flags().has(flag);
  }

  /**
   * Vrai si tous les flags de `if` sont posés, aucun de `ifNot`, et (avec `ifMore`) plus de flags
   * posés parmi `ifMore.flags` que parmi `ifMore.than`.
   */
  check(condition: Condition | undefined): boolean {
    if (!condition) return true;
    const flags = this.flags();
    const count = (list: string[]) => list.filter((f) => flags.has(f)).length;
    return (
      (condition.if ?? []).every((f) => flags.has(f)) &&
      !(condition.ifNot ?? []).some((f) => flags.has(f)) &&
      (!condition.ifMore || count(condition.ifMore.flags) > count(condition.ifMore.than))
    );
  }

  /** Remplace `{pseudo}` dans un texte. */
  format(text: string): string {
    return text.replaceAll('{pseudo}', this.pseudo());
  }
}
