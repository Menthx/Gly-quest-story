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
  /** Dialogue à rouvrir à l'arrivée sur la map, après une reprise de partie. */
  private pendingResume: { mapId: string; dialogueId: string } | null = null;

  /** Triggers déjà joués, sous la forme `map/dialogue` (sauvegardés avec la partie). */
  readonly triggersPlayed = signal<ReadonlySet<string>>(new Set());
  /** Id du dialogue ouvert, `null` si aucun (sauvegardé avec la partie). */
  readonly openId = signal<string | null>(null);

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
    this.openId.set(dialogueId);
    this.index.set(0);
    this.state.setFlags(dialogue.setFlags);
  }

  /** Reprise de partie : rouvre au début le dialogue qui était affiché au moment de la sauvegarde. */
  resumePending(map: GameMap): void {
    const pending = this.pendingResume;
    if (!pending || pending.mapId !== map.id) return;
    this.pendingResume = null;
    this.open(map, pending.dialogueId);
  }

  /**
   * Lance le premier trigger de la map dont la condition est remplie et qui n'a pas encore été joué.
   * Appelé à l'arrivée sur la map et à chaque fermeture de dialogue.
   */
  runTriggers(map: GameMap): void {
    if (this.isOpen()) return;
    const played = this.triggersPlayed();
    const trigger = map.triggers?.find(
      (t) => !played.has(`${map.id}/${t.dialogue}`) && this.state.check(t),
    );
    if (!trigger) return;
    this.triggersPlayed.set(new Set([...played, `${map.id}/${trigger.dialogue}`]));
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
    this.openId.set(null);
    this.index.set(0);
  }

  /** Nouvelle partie (sans argument) ou reprise d'une sauvegarde. */
  reset(
    triggersPlayed: string[] = [],
    resume: { mapId: string; dialogueId: string } | null = null,
  ): void {
    this.close();
    this.triggersPlayed.set(new Set(triggersPlayed));
    this.pendingResume = resume;
  }
}
