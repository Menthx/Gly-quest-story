import { TestBed } from '@angular/core/testing';
import { DebugService } from './debug.service';
import { GameDataService } from './game-data.service';
import { GameStateService } from './game-state.service';
import { StatsEvent, StatsService } from './stats.service';

describe('StatsService', () => {
  const fetchSpy = vi.fn<typeof fetch>();

  beforeEach(() => {
    localStorage.clear();
    fetchSpy.mockReset().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup(statsUrl?: string) {
    TestBed.inject(GameDataService).config.set({
      title: 'Test',
      startMap: 'a',
      maps: [],
      characters: {},
      statsUrl,
    });
    return {
      stats: TestBed.inject(StatsService),
      state: TestBed.inject(GameStateService),
    };
  }

  /** Événements envoyés, sans la date. */
  function sent(): Omit<StatsEvent, 'at'>[] {
    return fetchSpy.mock.calls.flatMap(([, init]) =>
      (JSON.parse(init?.body as string).events as StatsEvent[]).map(({ at, ...event }) => event),
    );
  }

  it('envoie le début de partie, les maps, les nouveaux flags et les choix', () => {
    const { stats, state } = setup('https://script.google.com/macros/s/x/exec');
    state.start('Gly');
    TestBed.tick();
    state.currentMap.set('a');
    state.setFlags(['lettre-lue']);
    TestBed.tick();
    stats.choice('intro', 'Oui');
    stats.flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('https://script.google.com/macros/s/x/exec');
    const player = localStorage.getItem('gly-quest-story/player');
    expect(sent()).toEqual([
      { player, pseudo: 'Gly', type: 'partie', value: 'nouvelle', map: null },
      { player, pseudo: 'Gly', type: 'flag', value: 'lettre-lue', map: 'a' },
      { player, pseudo: 'Gly', type: 'map', value: 'a', map: 'a' },
      { player, pseudo: 'Gly', type: 'choix', value: 'intro : Oui', map: 'a' },
    ]);
  });

  it('ne renvoie pas les flags d’une sauvegarde reprise', () => {
    const { stats, state } = setup('https://exemple');
    state.start('Gly', ['lettre-lue'], 'a');
    TestBed.tick();
    stats.flush();
    expect(sent().map((e) => [e.type, e.value])).toEqual([
      ['partie', 'reprise'],
      ['map', 'a'],
    ]);
  });

  it('n’envoie rien sans statsUrl ni en mode debug', () => {
    const { stats, state } = setup();
    state.start('Gly');
    TestBed.tick();
    stats.flush();

    TestBed.inject(GameDataService).config.update(
      (c) => c && { ...c, statsUrl: 'https://exemple' },
    );
    TestBed.inject(DebugService).enabled.set(true);
    state.start('Testeur');
    TestBed.tick();
    stats.choice('intro', 'Oui');
    stats.flush();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
