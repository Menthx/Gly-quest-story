import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Media } from '../../models/game.models';
import { MediaView } from './media';

@Component({
  imports: [MediaView],
  template: `<app-media
    [src]="src()"
    alt="Décor"
    (ratio)="ratio = $event"
    (ended)="ended = ended + 1"
  />`,
})
class Host {
  readonly src = signal<Media | undefined>(undefined);
  ratio = 0;
  ended = 0;
}

describe('MediaView', () => {
  let play: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom ne lit pas les vidéos : on simule play() / pause().
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, 'paused', { value: false, configurable: true });
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, 'paused', { value: true, configurable: true });
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function render(src: Media | undefined) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.src.set(src);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('affiche une image', async () => {
    const { el } = await render('assets/backgrounds/train.jpg');
    const img = el.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('assets/backgrounds/train.jpg');
    expect(img.alt).toBe('Décor');
    expect(el.querySelector('video')).toBeNull();
  });

  it('lit une vidéo seule en boucle', async () => {
    const { el } = await render('assets/videos/sort.mp4');
    const video = el.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('assets/videos/sort.mp4');
    expect(video.loop).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('enchaîne une liste de vidéos, la dernière en boucle', async () => {
    const { fixture, el } = await render(['lancement.mp4', 'loop.mp4']);
    const [first, second] = Array.from(el.querySelectorAll('video'));
    expect(first.loop).toBe(false);
    expect(second.loop).toBe(true);
    // La suivante est déjà chargée mais cachée, et pas lancée.
    expect(first.classList.contains('hidden')).toBe(false);
    expect(second.classList.contains('hidden')).toBe(true);
    expect(play.mock.contexts).toEqual([first]);

    first.dispatchEvent(new Event('ended'));
    await fixture.whenStable();
    expect(first.classList.contains('hidden')).toBe(true);
    expect(second.classList.contains('hidden')).toBe(false);
    expect(play.mock.contexts).toEqual([first, second]);

    // La vidéo en boucle ne déclenche plus rien.
    second.dispatchEvent(new Event('ended'));
    await fixture.whenStable();
    expect(second.classList.contains('hidden')).toBe(false);
  });

  it('lance la nouvelle vidéo quand le média change pendant la lecture', async () => {
    const { fixture, el } = await render('loop.mp4');
    const loop = el.querySelector('video')!;
    expect(loop.paused).toBe(false);

    // Dans un navigateur, changer la source d'une vidéo en lecture la met en pause : chaque
    // chemin a donc son propre élément, lancé à son tour.
    fixture.componentInstance.src.set(['lancement.mp4', 'fond.jpg']);
    await fixture.whenStable();
    const lancement = el.querySelector<HTMLVideoElement>('video[src="lancement.mp4"]')!;
    expect(lancement).not.toBe(loop);

    // La boucle finit son tour (elle ne reboucle plus) avant que la suite démarre : la vidéo
    // suivante commence là où la boucle recommence, sans saut d'image.
    expect(loop.classList.contains('held')).toBe(true);
    expect(loop.loop).toBe(false);
    expect(loop.paused).toBe(false);
    expect(lancement.classList.contains('hidden')).toBe(true);
    expect(play.mock.contexts).toEqual([loop]);

    loop.dispatchEvent(new Event('ended'));
    await fixture.whenStable();
    expect(lancement.classList.contains('hidden')).toBe(false);
    expect(play.mock.contexts).toEqual([loop, lancement]);

    // L'ancienne vidéo reste dessous jusqu'à la première image de la nouvelle : pas d'écran vide.
    expect(loop.isConnected).toBe(true);
    lancement.dispatchEvent(new Event('playing'));
    await fixture.whenStable();
    expect(loop.isConnected).toBe(false);
    expect(el.querySelectorAll('video')).toHaveLength(1);

    expect(fixture.componentInstance.ended).toBe(0);
    lancement.dispatchEvent(new Event('ended'));
    await fixture.whenStable();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('fond.jpg');
    expect(fixture.componentInstance.ended).toBe(1);
  });

  it('garde la dernière image affichée sous la nouvelle tant qu’elle n’est pas chargée', async () => {
    const { fixture, el } = await render(['lancement.mp4', 'fond.jpg']);
    el.querySelector('video')!.dispatchEvent(new Event('ended'));
    await fixture.whenStable();
    const fond = el.querySelector('img')!;

    fixture.componentInstance.src.set('loop.mp4');
    await fixture.whenStable();
    expect(fond.isConnected).toBe(true);
    expect(fond.classList.contains('held')).toBe(true);
    expect(el.querySelectorAll('video')).toHaveLength(1);

    el.querySelector('video')!.dispatchEvent(new Event('playing'));
    await fixture.whenStable();
    expect(fond.isConnected).toBe(false);
  });

  it("n'attend pas la fin d'une boucle qui ne joue plus", async () => {
    const { fixture, el } = await render('loop.mp4');
    const loop = el.querySelector('video')!;
    loop.pause();
    fixture.componentInstance.src.set('lancement.mp4');
    await fixture.whenStable();
    const lancement = el.querySelector<HTMLVideoElement>('video[src="lancement.mp4"]')!;
    expect(lancement.classList.contains('hidden')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 600));
    await fixture.whenStable();
    expect(lancement.classList.contains('hidden')).toBe(false);
    expect(play.mock.contexts.at(-1)).toBe(lancement);
  });

  it('ne garde rien quand le média disparaît', async () => {
    const { fixture, el } = await render('loop.mp4');
    fixture.componentInstance.src.set(undefined);
    await fixture.whenStable();
    expect(el.querySelector('img, video')).toBeNull();
  });

  it('passe au média suivant si une vidéo ne peut pas être lue', async () => {
    const { fixture, el } = await render(['absente.mp4', 'fond.jpg']);
    el.querySelector('video')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('fond.jpg');
    expect(fixture.componentInstance.ended).toBe(1);
  });

  it('relance sans le son si le navigateur refuse la lecture', async () => {
    play.mockRejectedValueOnce(new DOMException('refusé', 'NotAllowedError'));
    const { el } = await render('assets/videos/sort.mp4');
    await Promise.resolve();
    const video = el.querySelector('video')!;
    expect(video.muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('donne le ratio de la vidéo', async () => {
    const { fixture, el } = await render('assets/videos/sort.mp4');
    const video = el.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 1920 });
    Object.defineProperty(video, 'videoHeight', { value: 1080 });
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(fixture.componentInstance.ratio).toBeCloseTo(16 / 9);
  });

  it("n'affiche rien sans média", async () => {
    const { el } = await render('');
    expect(el.querySelector('img, video')).toBeNull();
  });
});
