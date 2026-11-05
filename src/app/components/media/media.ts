import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  untracked,
  viewChildren,
} from '@angular/core';
import { Media } from '../../models/game.models';
import { isVideo, mediaList } from '../../utils/media';

/** Un média de la liste affichée, ou le dernier affiché de la liste précédente (`held`). */
interface Item {
  /** Identifiant stable : l'élément HTML reste le même tant que la clé ne change pas. */
  key: string;
  path: string;
  video: boolean;
  /** Position dans la liste. */
  i: number;
  /** Vidéo en boucle (la dernière de sa liste). */
  loop: boolean;
  held: boolean;
}

/**
 * Affiche une image ou une vidéo avec le même cadrage (l'élément remplit le composant ; le parent
 * règle `object-fit` / `object-position` sur `<app-media>`, ils sont hérités).
 *
 * Une vidéo tourne en boucle. Une liste de vidéos est jouée à la suite, la dernière en boucle : les
 * suivantes sont chargées à l'avance et la précédente reste sur sa dernière image le temps du passage.
 *
 * Quand le média change, l'ancien reste affiché en dessous jusqu'à ce que le nouveau ait sa première
 * image (vidéo lancée, image chargée) : pas d'écran vide pendant le chargement. Si l'ancien est une
 * vidéo en boucle et le nouveau une vidéo, la boucle termine son tour avant que la nouvelle démarre :
 * une vidéo qui prend la suite d'une boucle commence là où la boucle recommence, sans saut d'image.
 */
@Component({
  selector: 'app-media',
  template: `
    <!-- Un élément par chemin : une vidéo qui change de source en cours de lecture se met en pause. -->
    @for (item of items(); track item.key) {
      @if (item.video) {
        <video
          #video
          [attr.data-key]="item.key"
          [class.hidden]="!item.held && (item.i !== index() || waitLoop())"
          [class.held]="item.held"
          [src]="item.path"
          [loop]="item.held ? !waitLoop() : item.loop"
          [attr.aria-label]="alt() || null"
          playsinline
          preload="auto"
          disablepictureinpicture
          (loadedmetadata)="
            !item.held && item.i === 0 && emitRatio(video.videoWidth, video.videoHeight)
          "
          (playing)="!item.held && item.i === index() && release()"
          (ended)="item.held ? waitLoop.set(false) : onEnded(item.i)"
          (error)="!item.held && onError(item.i)"
        ></video>
      } @else if (item.held || item.i === index()) {
        <img
          #img
          [class.held]="item.held"
          [src]="item.path"
          [alt]="item.held ? '' : alt()"
          draggable="false"
          (load)="!item.held && onImageLoad(img)"
          (error)="!item.held && release()"
        />
      }
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }
    img,
    video {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: inherit;
      object-position: inherit;
      pointer-events: none;
      z-index: 1;
    }
    .held {
      z-index: 0;
    }
    .hidden {
      visibility: hidden;
    }
  `,
})
export class MediaView {
  /** Chemin (ou liste de chemins) relatif à `public/`. */
  readonly src = input<Media | null | undefined>();
  readonly alt = input('');
  /** Ratio largeur/hauteur du premier média, dès qu'il est connu. */
  readonly ratio = output<number>();
  /** Une vidéo jouée une seule fois (pas la dernière de la liste) est finie, ou n'a pas pu être lue. */
  readonly ended = output<void>();

  protected readonly paths = computed(() => mediaList(this.src()), {
    equal: (a, b) => a.length === b.length && a.every((p, i) => p === b[i]),
  });
  /** Média affiché dans la liste (on revient au premier quand la liste change). */
  protected readonly index = linkedSignal({ source: this.paths, computation: () => 0 });

  private generation = 0;
  /** Médias de la liste courante (nouvelles clés à chaque changement de liste). */
  private readonly current = computed<Item[]>(() => {
    const gen = ++this.generation;
    return this.paths().map((path, i) => ({
      key: `${gen}:${i}:${path}`,
      path,
      video: isVideo(path),
      i,
      loop: isVideo(path) && i === this.paths().length - 1,
      held: false,
    }));
  });
  /** Position du média affiché dans la liste courante (pour savoir lequel garder au changement). */
  private shownIndex = 0;
  /** Dernier média affiché de la liste précédente, gardé en dessous tant que le nouveau n'est pas prêt. */
  private readonly held = linkedSignal<Item[], Item | null>({
    source: this.current,
    computation: (items, previous) => {
      const shown = this.shownIndex;
      this.shownIndex = 0;
      if (!previous || !items.length) return null;
      // Changements rapprochés : on garde ce qui est encore à l'écran en dessous.
      const keep = previous.value ?? previous.source.find((it) => it.i === shown);
      return keep ? { ...keep, held: true } : null;
    },
  });
  /** La boucle gardée en dessous finit son tour avant que la nouvelle vidéo démarre. */
  protected readonly waitLoop = linkedSignal(
    () => !!this.held()?.loop && !!untracked(this.current)[0]?.video,
  );
  protected readonly items = computed(() => {
    const held = this.held();
    return held ? [held, ...this.current()] : this.current();
  });

  private readonly videos = viewChildren<ElementRef<HTMLVideoElement>>('video');

  constructor() {
    // Seule la vidéo affichée est lue (et l'ancienne gardée en dessous) ; les autres attendent au début.
    effect(() => {
      const index = this.index();
      const waiting = this.waitLoop();
      const items = new Map(this.items().map((it) => [it.key, it]));
      for (const { nativeElement: video } of this.videos()) {
        const item = items.get(video.dataset['key'] ?? '');
        if (!item || item.held) continue;
        if (item.i === index && !waiting) {
          play(video);
        } else if (!video.paused || video.currentTime) {
          video.pause();
          video.currentTime = 0;
        }
      }
    });
  }

  /** Filet de sécurité : si la boucle gardée ne va pas jusqu'au bout (en pause…), on n'attend pas. */
  private readonly waitLoopTimeout = effect((onCleanup) => {
    if (!this.waitLoop()) return;
    const key = this.held()?.key;
    const video = this.videos()
      .map((v) => v.nativeElement)
      .find((v) => v.dataset['key'] === key);
    const remaining = video && !video.paused ? (video.duration || 0) - video.currentTime : 0;
    const timer = setTimeout(() => this.waitLoop.set(false), Math.max(0, remaining) * 1000 + 500);
    onCleanup(() => clearTimeout(timer));
  });

  /** Le média affiché a sa première image : l'ancien, gardé en dessous, peut disparaître. */
  protected release(): void {
    if (this.held()) this.held.set(null);
  }

  protected onImageLoad(img: HTMLImageElement): void {
    this.emitRatio(img.naturalWidth, img.naturalHeight);
    this.release();
  }

  protected onError(i: number): void {
    this.release();
    this.onEnded(i);
  }

  protected emitRatio(width: number, height: number): void {
    if (width && height) this.ratio.emit(width / height);
  }

  protected onEnded(i: number): void {
    if (i !== this.index() || i + 1 >= this.paths().length) return;
    this.index.set(i + 1);
    this.shownIndex = i + 1;
    this.ended.emit();
  }
}

/** Lance la vidéo avec le son ; si le navigateur refuse (pas encore d'interaction), sans le son. */
function play(video: HTMLVideoElement): void {
  if (!video.paused) return;
  video.play()?.catch(() => {
    video.muted = true;
    video.play()?.catch(() => {});
  });
}
