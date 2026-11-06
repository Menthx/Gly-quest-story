import { Component, computed, inject, linkedSignal, output } from '@angular/core';
import { DialogueChoice, Media } from '../../models/game.models';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';
import { StatsService } from '../../services/stats.service';
import { MediaView } from '../media/media';
import { isVideo, mediaList } from '../../utils/media';

/** Popup de dialogue : portrait du personnage, nom, texte et choix éventuels. */
@Component({
  selector: 'app-dialogue-box',
  imports: [MediaView],
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
  private readonly stats = inject(StatsService);

  /** Demande un changement de map (choix avec `goto`). */
  readonly goto = output<string>();

  protected readonly line = this.dialogue.currentLine;
  protected readonly text = computed(() => this.state.format(this.line()?.text ?? ''));
  /** Choix de la réplique dont la condition (`if` / `ifNot`) est remplie. */
  protected readonly choices = computed(() =>
    (this.line()?.choices ?? []).filter((c) => this.state.check(c)),
  );
  protected readonly character = computed(() => {
    const line = this.line();
    const id = line?.character;
    if (!id) return null;
    const character = this.data.config()?.characters[id] ?? { name: id };
    return { ...character, name: this.state.format(line.name ?? character.name) };
  });
  /**
   * Image ou vidéo plein écran posée par le `media` d'une réplique : elle reste affichée sur les
   * répliques suivantes jusqu'à la fermeture du dialogue (`""` la retire). Les portraits s'affichent
   * par-dessus.
   */
  protected readonly sceneMedia = linkedSignal<ReturnType<typeof this.line>, Media | null>({
    source: this.line,
    computation: (line, previous) => {
      if (!line) return null;
      if (line.media !== undefined) return line.media || null;
      return previous?.value ?? null;
    },
  });
  /**
   * Portraits plein cadre (`portraitFull`) : images 16/9 transparentes où le personnage est déjà placé
   * (Naevys à droite, Phyla à gauche), affichées par-dessus le décor et le `media` de réplique. Une fois
   * qu'un personnage a parlé, son portrait reste affiché (répliques du joueur, narration, dialogues
   * enchaînés) jusqu'à la fermeture du dialogue. Plusieurs personnages peuvent être à l'écran ensemble.
   * Une réplique `hidePortraits` les retire, sans afficher celui de son personnage.
   */
  protected readonly fullPortraits = linkedSignal<
    ReturnType<typeof this.line>,
    { id: string; src: Media }[]
  >({
    source: this.line,
    computation: (line, previous) => {
      if (!line || line.hidePortraits) return [];
      const shown = previous?.value ?? [];
      const id = line.character;
      const character = id ? this.data.config()?.characters[id] : null;
      if (!id || !character?.portraitFull || !character.portrait) return shown;
      if (shown.some((p) => p.id === id)) return shown;
      return [...shown, { id, src: character.portrait }];
    },
  });
  /**
   * Une vidéo de réplique montre déjà le personnage (ex. le sort de Naevys) : les portraits plein cadre
   * sont masqués tant qu'elle est affichée. Une image de réplique (changement de plan) les garde.
   */
  protected readonly sceneIsVideo = computed(() => mediaList(this.sceneMedia()).some(isVideo));
  /**
   * Personnage à portrait plein cadre qui parle : les autres portraits affichés passent au second plan.
   * Quand le joueur parle ou pense (ou la narration), tous les portraits sont au second plan.
   */
  protected readonly fullSpeaker = computed(() => {
    const id = this.line()?.character;
    return id && this.data.config()?.characters[id]?.portraitFull ? id : null;
  });

  /** Réplique `waitMedia` : on attend la fin de la vidéo, le joueur ne peut pas la passer. */
  protected readonly waiting = computed(() => !!this.line()?.waitMedia);

  /** Clic ou touche : réplique suivante, sauf pendant une vidéo à regarder jusqu'au bout. */
  protected advance(): void {
    if (!this.waiting()) this.dialogue.next();
  }

  /** Fin de la vidéo de scène : une réplique `waitMedia` avance d'elle-même. */
  protected onSceneEnded(): void {
    if (this.waiting()) this.dialogue.next();
  }

  protected choose(choice: DialogueChoice): void {
    this.stats.choice(this.dialogue.openId(), choice.text);
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
    // Saisie dans le panneau de debug : ce n'est pas pour le dialogue.
    if (event.target instanceof Element && event.target.closest('app-debug-panel')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.advance();
    }
  }
}
