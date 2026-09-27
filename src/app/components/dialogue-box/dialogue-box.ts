import { Component, computed, inject, output } from '@angular/core';
import { DialogueChoice } from '../../models/game.models';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';

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

  /** Demande un changement de map (choix avec `goto`). */
  readonly goto = output<string>();

  protected readonly line = this.dialogue.currentLine;
  protected readonly character = computed(() => {
    const id = this.line()?.character;
    return id ? (this.data.config()?.characters[id] ?? { name: id, portrait: '' }) : null;
  });

  protected choose(choice: DialogueChoice): void {
    if (choice.next) {
      this.dialogue.jumpTo(choice.next);
    } else {
      this.dialogue.close();
    }
    if (choice.goto) this.goto.emit(choice.goto);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Ignoré si une zone vient d'ouvrir le dialogue avec Entrée, ou si des choix sont affichés (boutons).
    if (!this.dialogue.isOpen() || event.defaultPrevented || this.line()?.choices?.length) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.dialogue.next();
    }
  }
}
