import { Injectable, computed, inject, signal } from '@angular/core';
import { Dialogue, DialogueLine, GameMap } from '../models/game.models';
import { GameStateService } from './game-state.service';

/** État du dialogue en cours (popup par-dessus la map). */
@Injectable({ providedIn: 'root' })
export class DialogueService {
  private readonly state = inject(GameStateService);
  private readonly map = signal<GameMap | null>(null);
  private readonly dialogue = signal<Dialogue | null>(null);
  private readonly index = signal(0);
  /** Triggers déjà joués, sous la forme `map/dialogue`. */
  private readonly triggersPlayed = new Set<string>();

  readonly isOpen = computed(() => this.dialogue() !== null);
  readonly currentLine = computed<DialogueLine | null>(
    () => this.dialogue()?.lines[this.index()] ?? null,
  );

  open(map: GameMap, dialogueId: string): void {
    const dialogue = map.dialogues?.[dialogueId];
    if (!dialogue) {
      console.error(`Dialogue "${dialogueId}" introuvable dans la map "${map.id}".`);
      return;
    }
    this.map.set(map);
    this.dialogue.set(dialogue);
    this.index.set(0);
    this.state.setFlags(dialogue.setFlags);
  }

  /**
   * Lance le premier trigger de la map dont la condition est remplie et qui n'a pas encore été joué.
   * Appelé à l'arrivée sur la map et à chaque fermeture de dialogue.
   */
  runTriggers(map: GameMap): void {
    if (this.isOpen()) return;
    const trigger = map.triggers?.find(
      (t) => !this.triggersPlayed.has(`${map.id}/${t.dialogue}`) && this.state.check(t),
    );
    if (!trigger) return;
    this.triggersPlayed.add(`${map.id}/${trigger.dialogue}`);
    this.open(map, trigger.dialogue);
  }

  /** Passe à la réplique suivante, ou ferme s'il n'y en a plus. Ignoré si la réplique propose des choix. */
  next(): void {
    const dialogue = this.dialogue();
    const line = this.currentLine();
    if (!dialogue || line?.choices?.length) return;
    if (this.index() + 1 < dialogue.lines.length) {
      this.index.update((i) => i + 1);
    } else {
      this.close();
    }
  }

  /** Enchaîne sur un autre dialogue de la même map (utilisé par les choix). */
  jumpTo(dialogueId: string): void {
    const map = this.map();
    if (map) this.open(map, dialogueId);
  }

  close(): void {
    this.dialogue.set(null);
    this.index.set(0);
  }

  /** Nouvelle partie : les triggers peuvent se rejouer. */
  reset(): void {
    this.close();
    this.triggersPlayed.clear();
  }
}
