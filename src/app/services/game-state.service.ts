import { Injectable, signal } from '@angular/core';
import { Condition } from '../models/game.models';

/** Progression de la partie : pseudo du joueur et flags posés par les dialogues. */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  readonly pseudo = signal('');
  readonly flags = signal<ReadonlySet<string>>(new Set());

  /** Nouvelle partie. */
  start(pseudo: string): void {
    this.pseudo.set(pseudo.trim());
    this.flags.set(new Set());
  }

  setFlags(flags: string[] | undefined): void {
    if (!flags?.length) return;
    this.flags.update((current) => new Set([...current, ...flags]));
  }

  has(flag: string): boolean {
    return this.flags().has(flag);
  }

  /** Vrai si tous les flags de `if` sont posés et aucun de `ifNot`. */
  check(condition: Condition | undefined): boolean {
    if (!condition) return true;
    const flags = this.flags();
    return (
      (condition.if ?? []).every((f) => flags.has(f)) &&
      !(condition.ifNot ?? []).some((f) => flags.has(f))
    );
  }

  /** Remplace `{pseudo}` dans un texte. */
  format(text: string): string {
    return text.replaceAll('{pseudo}', this.pseudo());
  }
}
