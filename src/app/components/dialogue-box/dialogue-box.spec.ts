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
    naevys: { name: 'Naevys', portrait: 'naevys.jpg', portraitFull: true },
    phyla: { name: 'Phyla', portrait: 'phyla.png' },
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
        { character: 'phyla', text: 'Bravo !' },
        { text: 'Le cercle disparaît.', media: '' },
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

  it('affiche le media d’une réplique par-dessus les portraits plein écran, puis le retire avec ""', async () => {
    const fixture = TestBed.createComponent(DialogueBox);
    const dialogue = TestBed.inject(DialogueService);
    const el = fixture.nativeElement as HTMLElement;
    const shown = () =>
      Array.from(el.querySelectorAll('.portrait.full img, .portrait.full video'))
        .filter((e) => !e.classList.contains('hidden'))
        .map((e) => e.getAttribute('src'));

    dialogue.open(map, 'rituel');
    await fixture.whenStable();
    expect(shown()).toEqual(['naevys.jpg']);

    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['lancement.mp4']);

    // Naevys parle : la vidéo reste affichée.
    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['lancement.mp4']);

    // Un portrait classique s'affiche par-dessus la vidéo.
    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['lancement.mp4']);
    expect(el.querySelector('.portrait:not(.full) img')?.getAttribute('src')).toBe('phyla.png');

    // media "" : retour au portrait plein écran de Naevys, qui a déjà parlé.
    dialogue.next();
    await fixture.whenStable();
    expect(shown()).toEqual(['naevys.jpg']);
  });
});
