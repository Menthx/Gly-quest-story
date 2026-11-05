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
    final: {
      lines: [
        { character: 'phyla', text: 'Le rituel a fonctionné !' },
        { character: 'naevys', text: 'Dame Phyla, c’est vous !' },
        { character: 'joueur', text: '…' },
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

    // Le joueur parle : personne n'est au second plan.
    dialogue.next();
    await fixture.whenStable();
    expect(portraits()).toEqual(['phyla.png', 'naevys.png']);

    dialogue.close();
    await fixture.whenStable();
    expect(portraits()).toEqual([]);
  });
});
