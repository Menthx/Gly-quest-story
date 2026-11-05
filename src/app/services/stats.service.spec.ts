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
    return fetchSpy.mock.calls.flatMap(([url]) =>
      (JSON.parse(new URL(url as string).searchParams.get('d')!).events as StatsEvent[]).map(
        ({ at, ...event }) => event,
      ),
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
    expect(fetchSpy.mock.calls[0][0]).toMatch(
      /^https:\/\/script\.google\.com\/macros\/s\/x\/exec\?d=/,
    );
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

  it('répartit les événements en plusieurs requêtes quand l’URL serait trop longue', () => {
    const { stats, state } = setup('https://exemple/exec');
    state.start('Gly');
    TestBed.tick();
    for (let i = 0; i < 100; i++) stats.choice('dialogue', `choix numéro ${i}`);
    stats.flush();
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
    for (const [url] of fetchSpy.mock.calls) expect((url as string).length).toBeLessThan(6100);
    expect(sent()).toHaveLength(101);
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

  describe('finish', () => {
    const counts = { 'jour-1': { confiant: 3, 'peu-assure': 1 } };

    it('envoie les réponses du joueur et renvoie les résultats', async () => {
      const { stats, state } = setup('https://exemple/exec');
      state.start('Gly');
      TestBed.tick();
      fetchSpy.mockReset().mockResolvedValue(Response.json({ joueurs: 4, stats: counts }));

      expect(await stats.finish({ 'jour-1': 'confiant' })).toEqual(counts);
      const url = new URL(fetchSpy.mock.calls.at(-1)![0] as string);
      expect(JSON.parse(url.searchParams.get('fin')!)).toEqual({
        player: localStorage.getItem('gly-quest-story/player'),
        pseudo: 'Gly',
        answers: { 'jour-1': 'confiant' },
      });
    });

    it('en mode debug, lit les résultats sans enregistrer la partie', async () => {
      const { stats, state } = setup('https://exemple/exec');
      TestBed.inject(DebugService).enabled.set(true);
      state.start('Testeur');
      fetchSpy.mockResolvedValue(Response.json({ stats: counts }));

      expect(await stats.finish({ 'jour-1': 'confiant' })).toEqual(counts);
      expect(fetchSpy.mock.calls.at(-1)![0]).toBe('https://exemple/exec?resultats=1');
    });

    it('renvoie null sans statsUrl ou si le script ne répond pas', async () => {
      const { stats } = setup();
      expect(await stats.finish({})).toBeNull();
      TestBed.inject(GameDataService).config.update((c) => c && { ...c, statsUrl: 'https://x' });
      fetchSpy.mockRejectedValue(new TypeError('offline'));
      expect(await stats.finish({})).toBeNull();
    });
  });
});
