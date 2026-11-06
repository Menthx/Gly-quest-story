import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GameConfig, GameMap } from '../../models/game.models';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';
import { DialogueBox } from './dialogue-box';

const config: GameConfig = {
  title: 'Test',
  startMap: 'a',
  maps: [],
  characters: {
    naevys: { name: 'Naevys', portrait: 'naevys.png', portraitFull: true },
    phyla: { name: 'Phyla', portrait: 'phyla.png', portraitFull: true },
    lea: { name: 'Léa', portrait: 'lea.png' },
  },
};

const map: GameMap = {
  id: 'a',
  name: 'A',
  dialogues: {
    rituel: {
      lines: [
        { character: 'naevys', text: 'Préparons le rituel.' },
        { text: 'Un cercle apparaît.', media: ['lancement.mp4', 'loop.mp4'] },
        { character: 'naevys', text: 'Que l’énergie soit scellée !' },
        { character: 'lea', text: 'Bravo !' },
        { text: 'Le cercle disparaît.', media: '' },
      ],
    },
    sort: {
      lines: [
        { character: 'naevys', text: 'Scellée !', waitMedia: true, media: ['lancement.mp4', 'fond.jpg'] },
        { text: 'Le cercle disparaît.', media: '' },
      ],
    },
    final: {
      lines: [
        { character: 'phyla', text: 'Le rituel a fonctionné !' },
        { character: 'naevys', text: 'Dame Phyla, c’est vous !' },
        { character: 'joueur', text: '…' },
      ],
    },
    annonce: {
      lines: [
        { character: 'naevys', text: 'Que l’énergie soit scellée !' },
        { text: 'Le cercle disparaît.', hidePortraits: true },
        { character: 'phyla', name: '???', hidePortraits: true, text: 'On dirait que le rituel a fonctionné !' },
        { character: 'naevys', text: 'Dame Phyla, c’est vous !' },
        { character: 'phyla', text: 'Bravo !' },
      ],
    },
  },
};

describe('DialogueBox', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    TestBed.configureTestingModule({
      providers: [{ provide: GameDataService, useValue: { config: signal(config) } }],
    });
    TestBed.inject(GameStateService).start('Gly');
  });

  afterEach(() => vi.restoreAllMocks());

  it('affiche le media d’une réplique (vidéo : portraits plein écran masqués), puis le retire avec ""', async () => {
    const fixture = TestBed.createComponent(DialogueBox);
    const dialogue = TestBed.inject(DialogueService);
    const el = fixture.nativeElement as HTMLElement;
    const shown = () =>
      Array.from(el.querySelectorAll('.portrait.full img, .portrait.full video'))
        .filter((e) => !e.classList.contains('hidden'))
        .map((e) => e.getAttribute('src'));

    dialogue.open(map, 'rituel');
    await fixture.whenStable();
    expect(shown()).toEqual(['naevys.png']);

    // Une vidéo montre déjà le personnage : les portraits plein écran sont masqués.
    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['lancement.mp4']);

    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['lancement.mp4']);

    // Un portrait classique s'affiche par-dessus.
    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['lancement.mp4']);
    expect(el.querySelector('.portrait:not(.full) img')?.getAttribute('src')).toBe('lea.png');

    // media "" : la vidéo est retirée, Naevys (qui a déjà parlé) réapparaît.
    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['naevys.png']);
  });

  it('garde à l’écran tous les portraits plein écran du dialogue, celui qui parle au premier plan', async () => {
    const fixture = TestBed.createComponent(DialogueBox);
    const dialogue = TestBed.inject(DialogueService);
    const el = fixture.nativeElement as HTMLElement;
    const portraits = () =>
      Array.from(el.querySelectorAll('.portrait.full')).map(
        (p) => `${p.querySelector('img')?.getAttribute('src')}${p.classList.contains('idle') ? ' (idle)' : ''}`,
      );

    dialogue.open(map, 'final');
    await fixture.whenStable();
    expect(portraits()).toEqual(['phyla.png']);

    dialogue.next();
    await fixture.whenStable();
    expect(portraits()).toEqual(['phyla.png (idle)', 'naevys.png']);

    // Le joueur parle ou pense : tous les portraits passent au second plan.
    dialogue.next();
    await fixture.whenStable();
    expect(portraits()).toEqual(['phyla.png (idle)', 'naevys.png (idle)']);

    dialogue.close();
    await fixture.whenStable();
    expect(portraits()).toEqual([]);
  });

  it('hidePortraits retire les portraits jusqu’à la prochaine réplique de leur personnage, name remplace le nom', async () => {
    const fixture = TestBed.createComponent(DialogueBox);
    const dialogue = TestBed.inject(DialogueService);
    const el = fixture.nativeElement as HTMLElement;
    const portraits = () =>
      Array.from(el.querySelectorAll('.portrait.full img')).map((img) => img.getAttribute('src'));
    const name = () => el.querySelector('.name')?.textContent?.trim();

    dialogue.open(map, 'annonce');
    await fixture.whenStable();
    expect(portraits()).toEqual(['naevys.png']);

    dialogue.next();
    await fixture.whenStable();
    expect(portraits()).toEqual([]);

    dialogue.next();
    await fixture.whenStable();
    expect(portraits()).toEqual([]);
    expect(name()).toBe('???');

    dialogue.next();
    await fixture.whenStable();
    expect(portraits()).toEqual(['naevys.png']);

    dialogue.next();
    await fixture.whenStable();
    expect(portraits()).toEqual(['naevys.png', 'phyla.png']);
    expect(name()).toBe('Phyla');
  });

  it('attend la fin de la vidéo d’une réplique waitMedia, sans pouvoir la passer', async () => {
    const fixture = TestBed.createComponent(DialogueBox);
    const dialogue = TestBed.inject(DialogueService);
    const el = fixture.nativeElement as HTMLElement;

    dialogue.open(map, 'sort');
    await fixture.whenStable();
    expect(el.querySelector('.continue')).toBeNull();

    (el.querySelector('.overlay') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(dialogue.currentLine()?.text).toBe('Scellée !');

    el.querySelector('.scene video')!.dispatchEvent(new Event('ended'));
    await fixture.whenStable();
    expect(dialogue.currentLine()?.text).toBe('Le cercle disparaît.');
    expect(el.querySelector('.continue')).not.toBeNull();
  });
});
