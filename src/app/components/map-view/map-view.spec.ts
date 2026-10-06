import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signal } from '@angular/core';
import { routes } from '../../app.routes';
import { GameConfig, GameMap } from '../../models/game.models';
import { DialogueService } from '../../services/dialogue.service';
import { GameDataService } from '../../services/game-data.service';
import { GameStateService } from '../../services/game-state.service';

const config: GameConfig = {
  title: 'Test',
  startMap: 'a',
  characters: {},
  maps: [
    { id: 'a', name: 'A', file: 'a.json' },
    { id: 'b', name: 'B', file: 'b.json' },
  ],
};

const maps: Record<string, GameMap> = {
  a: {
    id: 'a',
    name: 'A',
    // Débloqué par le choix « Partir » : il ne doit pas se jouer pendant qu'on quitte la map.
    triggers: [{ dialogue: 'retour', if: ['parti'] }],
    dialogues: {
      depart: {
        lines: [
          { text: 'On y va ?', choices: [{ text: 'Partir', setFlags: ['parti'], goto: 'b' }] },
        ],
      },
      retour: { lines: [{ text: 'De retour sur A' }] },
    },
  },
  b: {
    id: 'b',
    name: 'B',
    triggers: [{ dialogue: 'arrivee' }],
    dialogues: { arrivee: { lines: [{ text: 'Sur B' }] } },
  },
};

describe('MapView', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        {
          provide: GameDataService,
          useValue: {
            config: signal(config),
            loadConfig: async () => config,
            loadMap: async (id: string) => maps[id],
          },
        },
      ],
    });
    TestBed.inject(GameStateService).start('Gly');
  });

  it("un choix avec goto ne lance pas les triggers de la map qu'on quitte", async () => {
    const harness = await RouterTestingHarness.create('/map/a');
    await harness.fixture.whenStable();
    const dialogue = TestBed.inject(DialogueService);

    dialogue.open(maps['a'], 'depart');
    harness.detectChanges();
    const button = harness.routeNativeElement!.querySelector<HTMLButtonElement>('.choices button')!;
    expect(button.textContent?.trim()).toBe('Partir');
    button.click();
    // Les effets passent avant la fin de la navigation (cas d'une navigation plus lente que d'habitude).
    TestBed.tick();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(GameStateService).currentMap()).toBe('b');
    expect(dialogue.triggersPlayed().has('a/retour')).toBe(false);
    expect(dialogue.currentLine()?.text).toBe('Sur B');
  });
});
