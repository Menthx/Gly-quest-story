import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  viewChildren,
} from '@angular/core';
import { Media } from '../../models/game.models';
import { isVideo, mediaList } from '../../utils/media';

/**
 * Affiche une image ou une vidéo avec le même cadrage (l'élément remplit le composant ; le parent
 * règle `object-fit` / `object-position` sur `<app-media>`, ils sont hérités).
 *
 * Une vidéo tourne en boucle. Une liste de vidéos est jouée à la suite, la dernière en boucle : les
 * suivantes sont chargées à l'avance et la précédente reste sur sa dernière image le temps du passage.
 */
@Component({
  selector: 'app-media',
  template: `
    <!-- Un élément par chemin : une vidéo qui change de source en cours de lecture se met en pause. -->
    @for (path of paths(); track $index + ':' + path) {
      @if (isVideo(path)) {
        <video
          #video
          [class.hidden]="$index !== index()"
          [src]="path"
          [loop]="$index === paths().length - 1"
          [attr.aria-label]="alt() || null"
          playsinline
          preload="auto"
          disablepictureinpicture
          (loadedmetadata)="$index === 0 && emitRatio(video.videoWidth, video.videoHeight)"
          (ended)="onEnded($index)"
        ></video>
      } @else if ($index === index()) {
        <img
          #img
          [src]="path"
          [alt]="alt()"
          draggable="false"
          (load)="emitRatio(img.naturalWidth, img.naturalHeight)"
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

  protected readonly isVideo = isVideo;
  protected readonly paths = computed(() => mediaList(this.src()), {
    equal: (a, b) => a.length === b.length && a.every((p, i) => p === b[i]),
  });
  /** Média affiché dans la liste (on revient au premier quand la liste change). */
  protected readonly index = linkedSignal({ source: this.paths, computation: () => 0 });

  private readonly videos = viewChildren<ElementRef<HTMLVideoElement>>('video');

  constructor() {
    // Seule la vidéo affichée est lue ; les autres attendent au début.
    effect(() => {
      const index = this.index();
      const paths = this.paths();
      const videos = this.videos().map((v) => v.nativeElement);
      let v = 0;
      paths.forEach((path, i) => {
        if (!isVideo(path)) return;
        const video = videos[v++];
        if (!video) return;
        if (i === index) {
          play(video);
        } else if (!video.paused || video.currentTime) {
          video.pause();
          video.currentTime = 0;
        }
      });
    });
  }

  protected emitRatio(width: number, height: number): void {
    if (width && height) this.ratio.emit(width / height);
  }

  protected onEnded(i: number): void {
    if (i === this.index() && i + 1 < this.paths().length) this.index.set(i + 1);
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
