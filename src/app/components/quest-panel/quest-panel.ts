import { AnimationCallbackEvent, Component, Injectable, computed, inject } from '@angular/core';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';

/**
 * Ce que le joueur a déjà vu des quêtes. Le cadre est recréé à chaque changement de map : sans cette
 * mémoire, l'arrivée au centre de l'écran et le barré des objectifs se rejoueraient à chaque fois.
 */
@Injectable({ providedIn: 'root' })
class QuestMemory {
  run = -1;
  /** Quêtes déjà arrivées en haut à droite. */
  readonly arrived = new Set<string>();
  /** Par quête : objectifs déjà barrés à l'écran, ou déjà remplis quand la quête est apparue. */
  readonly struck = new Map<string, Set<number>>();
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cadre « Quête en cours » (en haut à droite) : quêtes dont la condition est remplie, objectifs cochés par flag. */
@Component({
  selector: 'app-quest-panel',
  templateUrl: './quest-panel.html',
  styleUrl: './quest-panel.scss',
})
export class QuestPanel {
  private readonly data = inject(GameDataService);
  private readonly state = inject(GameStateService);
  private readonly memory = inject(QuestMemory);

  protected readonly quests = computed(() => {
    const memory = this.memory;
    if (memory.run !== this.state.run()) {
      memory.run = this.state.run();
      memory.arrived.clear();
      memory.struck.clear();
    }
    const quests = (this.data.config()?.quests ?? [])
      .filter((q) => this.state.check(q))
      .map((q) => ({
        ...q,
        objectives: q.objectives
          .map((o, index) => {
            const text = this.state.format(o.text);
            if (!o.count?.length)
              return { index, o, text, done: !!o.done && this.state.has(o.done) };
            const n = o.count.filter((f) => this.state.has(f)).length;
            return {
              index,
              o,
              text: `${text} : ${n}/${o.count.length}`,
              done: n === o.count.length,
            };
          })
          .filter(({ o }) => this.state.check(o)),
      }));

    // Une quête qui n'est plus en cours est oubliée : si elle revient, elle refait son entrée.
    for (const id of memory.struck.keys()) {
      if (!quests.some((q) => q.id === id)) {
        memory.struck.delete(id);
        memory.arrived.delete(id);
      }
    }
    return quests.map((q) => {
      let struck = memory.struck.get(q.id);
      if (!struck) {
        // Objectifs déjà remplis quand la quête apparaît : barrés d'office, sans animation.
        struck = new Set(q.objectives.filter((o) => o.done).map((o) => o.index));
        memory.struck.set(q.id, struck);
      }
      return {
        ...q,
        objectives: q.objectives.map(({ index, text, done }) => ({
          index,
          text,
          done,
          striking: done && !struck.has(index),
        })),
      };
    });
  });

  /** Objectif barré : l'animation ne se rejouera pas au prochain affichage du cadre. */
  protected struck(questId: string, index: number): void {
    this.memory.struck.get(questId)?.add(index);
  }

  /** Nouvelle quête : apparaît au centre de l'écran, puis glisse jusqu'à sa place en haut à droite. */
  protected enter(event: AnimationCallbackEvent, questId: string): void {
    const el = event.target as HTMLElement;
    const known = this.memory.arrived.has(questId);
    this.memory.arrived.add(questId);
    if (known || reducedMotion()) {
      el.animate({ opacity: [0, 1] }, { duration: 300, easing: 'ease-out' });
      event.animationComplete();
      return;
    }
    // Mesure à l'image suivante : une quête qui disparaît au même moment a déjà quitté la mise en page.
    el.style.opacity = '0';
    requestAnimationFrame(() => {
      const box = el.getBoundingClientRect();
      const screen = (el.closest('.stage') ?? document.documentElement).getBoundingClientRect();
      el.style.setProperty(
        '--dx',
        `${screen.left + screen.width / 2 - (box.left + box.width / 2)}px`,
      );
      el.style.setProperty(
        '--dy',
        `${screen.top + screen.height / 2 - (box.top + box.height / 2)}px`,
      );
      el.style.opacity = '';
      el.classList.add('arriving');
      const done = (e: AnimationEvent) => {
        if (e.target !== el) return; // fin du barré d'un objectif
        el.removeEventListener('animationend', done);
        el.classList.remove('arriving');
        event.animationComplete();
      };
      el.addEventListener('animationend', done);
    });
  }

  /** Quête terminée : s'efface en fondu, sans pousser les autres cadres. */
  protected leave(event: AnimationCallbackEvent): void {
    const el = event.target as HTMLElement;
    const { offsetTop, offsetWidth } = el;
    Object.assign(el.style, {
      position: 'absolute',
      top: `${offsetTop}px`,
      width: `${offsetWidth}px`,
    });
    el.animate(
      { opacity: [1, 0] },
      { duration: reducedMotion() ? 200 : 900, easing: 'ease-out', fill: 'forwards' },
    ).finished.finally(() => event.animationComplete());
  }
}
