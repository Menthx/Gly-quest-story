import { Component, computed, inject } from '@angular/core';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';

/** Cadre « Quête en cours » (en haut à droite) : quêtes dont la condition est remplie, objectifs cochés par flag. */
@Component({
  selector: 'app-quest-panel',
  templateUrl: './quest-panel.html',
  styleUrl: './quest-panel.scss',
})
export class QuestPanel {
  private readonly data = inject(GameDataService);
  private readonly state = inject(GameStateService);

  protected readonly quests = computed(() =>
    (this.data.config()?.quests ?? [])
      .filter((q) => this.state.check(q))
      .map((q) => ({
        ...q,
        objectives: q.objectives.map((o) => ({
          text: this.state.format(o.text),
          done: this.state.has(o.done),
        })),
      })),
  );
}
