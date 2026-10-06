import {
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { Region, Shape } from '../../models/game.models';
import { DebugService } from '../../services/debug.service';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';
import { boundingBox, polygonPoints, round } from '../../utils/shapes';
import { DebugPanel, DrawMode } from '../debug-panel/debug-panel';
import { DialogueBox } from '../dialogue-box/dialogue-box';
import { MapMenu } from '../map-menu/map-menu';
import { QuestPanel } from '../quest-panel/quest-panel';

const ARROWS = { left: '◀', right: '▶', up: '▲', down: '▼' } as const;

/** Affiche une map : background, zones cliquables, dialogue, quête, menu et outils de debug (ou un interlude). */
@Component({
  selector: 'app-map-view',
  imports: [DialogueBox, MapMenu, DebugPanel, QuestPanel],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class MapView {
  /** Id de la map, lu depuis l'URL (`/map/:id`). */
  readonly id = input.required<string>();

  private readonly data = inject(GameDataService);
  private readonly router = inject(Router);
  private readonly state = inject(GameStateService);
  protected readonly dialogue = inject(DialogueService);
  protected readonly debug = inject(DebugService);

  protected readonly map = resource({
    params: () => this.id(),
    loader: ({ params }) => this.data.loadMap(params),
  });

  /** Ratio largeur/hauteur de l'image, lu au chargement (16/9 par défaut). */
  protected readonly aspectRatio = signal(16 / 9);
  protected readonly hovered = signal<Region | null>(null);

  protected readonly interludeText = computed(() => {
    const interlude = this.map.value()?.interlude;
    return interlude ? this.state.format(interlude.text) : '';
  });

  /** Zones visibles : en jeu, seulement celles dont la condition est remplie ; en debug, toutes. */
  protected readonly regions = computed(() =>
    (this.map.value()?.regions ?? [])
      .filter((region) => this.debug.enabled() || this.state.check(region))
      .map((region) => {
        const box = boundingBox(region.shape);
        return {
          region,
          points: region.shape.type === 'polygon' ? polygonPoints(region.shape.points) : '',
          centerX: box.x + box.width / 2,
          centerY: box.y + box.height / 2,
          arrow: region.arrow ? ARROWS[region.arrow] : null,
        };
      }),
  );

  // --- Outils de debug ---
  protected readonly cursor = signal<{ x: number; y: number } | null>(null);
  protected readonly drawMode = signal<DrawMode>('rect');
  protected readonly draft = signal<Shape | null>(null);
  protected readonly draftPoints = computed(() => {
    const d = this.draft();
    return d?.type === 'polygon' ? polygonPoints(d.points) : '';
  });
  private dragStart: { x: number; y: number } | null = null;
  /**
   * Map vers laquelle on part, le temps qu'elle s'affiche. Un choix « Suite » avec `goto` ferme le
   * dialogue avant le changement de map : sans ce verrou, les triggers de la map qu'on quitte se lanceraient.
   */
  private leavingTo: string | null = null;

  constructor() {
    // À l'arrivée sur la map puis à chaque fermeture de dialogue : position du joueur, reprise de partie, triggers.
    effect(() => {
      const map = this.map.value();
      if (map && this.map.status() === 'resolved' && !this.dialogue.isOpen()) {
        untracked(() => {
          if (this.leavingTo && this.leavingTo !== map.id) return;
          this.leavingTo = null;
          this.state.currentMap.set(map.id);
          this.dialogue.resumePending(map);
          this.dialogue.runTriggers(map);
        });
      }
    });
    // Nouvelle map : on oublie le survol et le tracé en cours.
    effect(() => {
      this.id();
      this.hovered.set(null);
      this.draft.set(null);
    });
  }

  protected onImageLoad(img: HTMLImageElement): void {
    if (img.naturalWidth && img.naturalHeight) {
      this.aspectRatio.set(img.naturalWidth / img.naturalHeight);
    }
  }

  protected activate(region: Region): void {
    if (this.debug.enabled() || this.dialogue.isOpen()) return;
    const map = this.map.value();
    if (!map) return;
    switch (region.action.type) {
      case 'dialogue':
        this.dialogue.open(map, region.action.dialogue);
        break;
      case 'goto':
        this.goTo(region.action.map);
        break;
    }
  }

  /** Entrée sur une zone ayant le focus. Si elle ouvre un dialogue, cette touche ne doit pas aussi le faire avancer. */
  protected onRegionEnter(event: Event, region: Region): void {
    if (this.debug.enabled() || this.dialogue.isOpen()) return;
    event.preventDefault();
    this.activate(region);
  }

  protected goTo(mapId: string): void {
    this.leavingTo = mapId;
    this.dialogue.close();
    // Navigation refusée ou annulée : on reste sur cette map, le verrou est levé.
    this.router.navigate(['/map', mapId]).then((ok) => {
      if (!ok && this.leavingTo === mapId) this.leavingTo = null;
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
      return;
    if (event.key === 'd' || event.key === 'D') {
      this.debug.toggle();
      this.draft.set(null);
    } else if (event.key === 'Escape' && this.debug.enabled()) {
      this.draft.set(null);
    }
  }

  /** Position du pointeur en % de l'image. */
  private toPercent(event: PointerEvent, stage: HTMLElement): { x: number; y: number } {
    const rect = stage.getBoundingClientRect();
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    return {
      x: round(clamp(((event.clientX - rect.left) / rect.width) * 100)),
      y: round(clamp(((event.clientY - rect.top) / rect.height) * 100)),
    };
  }

  protected onPointerMove(event: PointerEvent, stage: HTMLElement): void {
    if (!this.debug.enabled()) return;
    const p = this.toPercent(event, stage);
    this.cursor.set(p);
    if (this.dragStart) {
      const s = this.dragStart;
      this.draft.set({
        type: 'rect',
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        width: round(Math.abs(p.x - s.x)),
        height: round(Math.abs(p.y - s.y)),
      });
    }
  }

  protected onPointerDown(event: PointerEvent, stage: HTMLElement): void {
    if (!this.debug.enabled() || event.button !== 0) return;
    event.preventDefault();
    const p = this.toPercent(event, stage);
    if (this.drawMode() === 'rect') {
      this.dragStart = p;
      stage.setPointerCapture(event.pointerId);
      this.draft.set({ type: 'rect', x: p.x, y: p.y, width: 0, height: 0 });
    } else {
      const d = this.draft();
      const points = d?.type === 'polygon' ? d.points : [];
      this.draft.set({ type: 'polygon', points: [...points, [p.x, p.y]] });
    }
  }

  protected onPointerUp(): void {
    this.dragStart = null;
  }

  protected onPointerLeave(): void {
    if (!this.dragStart) this.cursor.set(null);
  }

  protected setDrawMode(mode: DrawMode): void {
    this.drawMode.set(mode);
    this.draft.set(null);
  }
}
