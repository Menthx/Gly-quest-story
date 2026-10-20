import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { Condition, GameMap, Region, Shape } from '../../models/game.models';
import { DebugService } from '../../services/debug.service';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';
import { collectFlags } from '../../utils/flags';

export type DrawMode = 'rect' | 'polygon';

/**
 * Panneau du mode debug, en deux onglets :
 * - « Partie » : flags à cocher, saut vers une map ou un dialogue, état des triggers et des quêtes ;
 * - « Zones » : coordonnées du curseur et JSON de la zone dessinée, prêt à copier.
 */
@Component({
  selector: 'app-debug-panel',
  templateUrl: './debug-panel.html',
  styleUrl: './debug-panel.scss',
})
export class DebugPanel {
  readonly mapId = input.required<string>();
  readonly map = input<GameMap | undefined>();
  readonly cursor = input<{ x: number; y: number } | null>(null);
  readonly draft = input<Shape | null>(null);
  readonly mode = input<DrawMode>('rect');

  readonly modeChange = output<DrawMode>();
  readonly clear = output<void>();
  /** Demande un changement de map. */
  readonly goto = output<string>();

  protected readonly debug = inject(DebugService);
  protected readonly state = inject(GameStateService);
  protected readonly dialogue = inject(DialogueService);
  private readonly data = inject(GameDataService);

  protected readonly copied = signal(false);
  /** Panneau replié sur son titre, pour dégager la scène. */
  protected readonly collapsed = signal(false);
  protected readonly config = this.data.config;

  // --- Onglet « Partie » ---

  /** Toutes les maps, pour connaître tous les flags du jeu (une map illisible est ignorée). */
  private readonly allMaps = resource({
    loader: async () => {
      const config = await this.data.loadConfig();
      const maps = await Promise.all(
        config.maps.map((m) => this.data.loadMap(m.id).catch(() => null)),
      );
      return maps.filter((m) => m !== null);
    },
  });

  protected readonly flagFilter = signal('');
  /** Flags du jeu, plus ceux posés à la main qui n'existent nulle part dans le contenu. */
  protected readonly flags = computed(() => {
    const config = this.config();
    const known = config ? collectFlags(config, this.allMaps.value() ?? []) : [];
    const all = [...new Set([...known, ...this.state.flags()])].sort((a, b) => a.localeCompare(b));
    const filter = this.flagFilter().trim().toLowerCase();
    return all
      .filter((f) => f.toLowerCase().includes(filter))
      .map((f) => ({ id: f, on: this.state.has(f), known: known.includes(f) }));
  });

  protected readonly dialogueIds = computed(() => Object.keys(this.map()?.dialogues ?? {}));

  protected readonly triggers = computed(() => {
    const map = this.map();
    const played = this.dialogue.triggersPlayed();
    return (map?.triggers ?? []).map((t) => {
      const key = `${map!.id}/${t.dialogue}`;
      return {
        key,
        dialogue: t.dialogue,
        played: played.has(key),
        blocked: this.why(t),
      };
    });
  });

  protected readonly quests = computed(() =>
    (this.config()?.quests ?? []).map((q) => {
      const objectives = q.objectives.filter((o) => this.state.check(o));
      const done = objectives.filter((o) =>
        o.count?.length
          ? o.count.every((f) => this.state.has(f))
          : !!o.done && this.state.has(o.done),
      ).length;
      return {
        id: q.id,
        title: q.title,
        active: this.state.check(q),
        progress: `${done}/${objectives.length}`,
        blocked: this.why(q),
      };
    }),
  );

  /** Pourquoi une condition n'est pas remplie (vide si elle l'est). */
  protected why(condition: Condition): string {
    const missing = (condition.if ?? []).filter((f) => !this.state.has(f));
    const forbidden = (condition.ifNot ?? []).filter((f) => this.state.has(f));
    return [
      missing.length ? `manque ${missing.join(', ')}` : '',
      forbidden.length ? `bloqué par ${forbidden.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected addFlag(): void {
    const flag = this.flagFilter().trim();
    if (!flag) return;
    this.state.toggleFlag(flag, true);
    this.flagFilter.set('');
  }

  protected clearFlags(): void {
    this.state.flags.set(new Set());
  }

  protected openDialogue(id: string): void {
    const map = this.map();
    if (map) this.dialogue.open(map, id);
  }

  /** Le trigger redevient « à jouer » ; il se lance tout de suite si sa condition est remplie. */
  protected replayTrigger(key: string): void {
    this.dialogue.forgetTrigger(key);
    const map = this.map();
    if (map) this.dialogue.runTriggers(map);
  }

  /** Nouvelle partie avec le même pseudo, sur la map de départ. */
  protected restart(): void {
    const config = this.config();
    if (!config) return;
    this.state.start(this.state.pseudo());
    this.dialogue.reset();
    this.goto.emit(config.startMap);
  }

  // --- Onglet « Zones » ---

  /** Zone complète au format du JSON de map, à coller dans `regions`. */
  protected readonly snippet = computed(() => {
    const shape = this.draft();
    if (!shape) return '';
    const region: Region = {
      id: 'nouvelle-zone',
      label: 'Nouvelle zone',
      shape,
      action: { type: 'dialogue', dialogue: 'id-du-dialogue' },
    };
    return (
      JSON.stringify(region, null, 2)
        // Garde chaque point [x, y] sur une seule ligne.
        .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')
    );
  });

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.snippet());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
