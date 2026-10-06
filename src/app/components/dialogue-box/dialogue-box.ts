import { Component, computed, inject, output } from '@angular/core';
import { DialogueChoice } from '../../models/game.models';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';

/** Popup de dialogue : portrait du personnage, nom, texte et choix éventuels. */
@Component({
  selector: 'app-dialogue-box',
  templateUrl: './dialogue-box.html',
  styleUrl: './dialogue-box.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class DialogueBox {
  protected readonly dialogue = inject(DialogueService);
  private readonly data = inject(GameDataService);
  private readonly state = inject(GameStateService);

  /** Demande un changement de map (choix avec `goto`). */
  readonly goto = output<string>();

  protected readonly line = this.dialogue.currentLine;
  protected readonly text = computed(() => this.state.format(this.line()?.text ?? ''));
  /** Choix de la réplique dont la condition (`if` / `ifNot`) est remplie. */
  protected readonly choices = computed(() =>
    (this.line()?.choices ?? []).filter((c) => this.state.check(c)),
  );
  protected readonly character = computed(() => {
    const id = this.line()?.character;
    if (!id) return null;
    const character = this.data.config()?.characters[id] ?? { name: id };
    return { ...character, name: this.state.format(character.name) };
  });

  protected choose(choice: DialogueChoice): void {
    this.state.setFlags(choice.setFlags);
    if (choice.next) {
      this.dialogue.jumpTo(choice.next);
    } else {
      this.dialogue.close();
    }
    if (choice.goto) this.goto.emit(choice.goto);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Ignoré si une zone vient d'ouvrir le dialogue avec Entrée, ou si des choix sont affichés (boutons).
    if (!this.dialogue.isOpen() || event.defaultPrevented || this.choices().length) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.dialogue.next();
    }
  }
}
