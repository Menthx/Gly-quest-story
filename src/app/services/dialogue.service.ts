import { Injectable, computed, signal } from '@angular/core';
import { Dialogue, DialogueLine, GameMap } from '../models/game.models';

/** État du dialogue en cours (popup par-dessus la map). */
@Injectable({ providedIn: 'root' })
export class DialogueService {
  private readonly map = signal<GameMap | null>(null);
  private readonly dialogue = signal<Dialogue | null>(null);
  private readonly index = signal(0);
  private readonly introsPlayed = new Set<string>();

  readonly isOpen = computed(() => this.dialogue() !== null);
  readonly currentLine = computed<DialogueLine | null>(() => this.dialogue()?.lines[this.index()] ?? null);

  open(map: GameMap, dialogueId: string): void {
    const dialogue = map.dialogues[dialogueId];
    if (!dialogue) {
      console.error(`Dialogue "${dialogueId}" introuvable dans la map "${map.id}".`);
      return;
    }
    this.map.set(map);
    this.dialogue.set(dialogue);
    this.index.set(0);
  }

  /** Joue le dialogue `onEnter` de la map, seulement à la première visite. */
  playIntro(map: GameMap): void {
    if (!map.onEnter || this.introsPlayed.has(map.id)) return;
    this.introsPlayed.add(map.id);
    this.open(map, map.onEnter);
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
}
