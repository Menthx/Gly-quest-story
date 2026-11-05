import { TestBed } from '@angular/core/testing';
import { GameMap } from '../models/game.models';
import { DialogueService } from './dialogue.service';
import { GameStateService } from './game-state.service';

const map: GameMap = {
  id: 'test',
  name: 'Test',
  triggers: [{ dialogue: 'intro' }, { dialogue: 'fin', if: ['a', 'b'] }],
  dialogues: {
    intro: {
      lines: [{ text: 'Un' }, { text: 'Deux', choices: [{ text: 'Suite', next: 'suite' }] }],
    },
    suite: { setFlags: ['a'], lines: [{ character: 'joueur', text: 'Trois' }] },
    autre: { setFlags: ['b'], lines: [{ text: 'Quatre' }] },
    fin: { lines: [{ text: 'Fin' }] },
    question: { next: 'intro', lines: [{ text: 'Réponse' }] },
    pensee: {
      next: [
        { dialogue: 'pensee-a', ifMore: { flags: ['a1', 'a2', 'a3'], than: ['b1', 'b2', 'b3'] } },
        { dialogue: 'pensee-b' },
      ],
      lines: [{ text: 'Je réfléchis.' }],
    },
    'pensee-a': { lines: [{ text: 'Confiant' }] },
    'pensee-b': { lines: [{ text: 'Inquiet' }] },
  },
};

describe('DialogueService', () => {
  let service: DialogueService;
  let state: GameStateService;

  beforeEach(() => {
    service = TestBed.inject(DialogueService);
    state = TestBed.inject(GameStateService);
    state.start('Gly');
  });

  it('avance réplique par réplique et attend un choix', () => {
    service.open(map, 'intro');
    expect(service.currentLine()?.text).toBe('Un');
    service.next();
    expect(service.currentLine()?.text).toBe('Deux');
    service.next(); // ignoré : la réplique propose des choix
    expect(service.currentLine()?.text).toBe('Deux');
    service.jumpTo('suite');
    expect(service.currentLine()?.text).toBe('Trois');
    service.next();
    expect(service.isOpen()).toBe(false);
  });

  it('enchaîne sur le dialogue `next` après la dernière réplique', () => {
    service.open(map, 'question');
    service.next();
    expect(service.isOpen()).toBe(true);
    expect(service.currentLine()?.text).toBe('Un');
  });

  it('joue chaque trigger une fois, quand sa condition est remplie', () => {
    service.runTriggers(map);
    expect(service.currentLine()?.text).toBe('Un');
    service.close();
    service.runTriggers(map);
    expect(service.isOpen()).toBe(false); // intro déjà jouée, « fin » attend a et b

    service.open(map, 'suite');
    service.close();
    service.open(map, 'autre');
    service.close();
    expect(state.check({ if: ['a', 'b'] })).toBe(true);
    service.runTriggers(map);
    expect(service.currentLine()?.text).toBe('Fin');
  });

  it("n'attend pas de choix quand aucun choix n'a sa condition remplie", () => {
    const m: GameMap = {
      id: 'choix',
      name: 'Choix',
      dialogues: {
        d: { lines: [{ text: 'Question', choices: [{ text: 'Fini', if: ['tout-vu'] }] }] },
      },
    };
    service.open(m, 'd');
    service.next();
    expect(service.isOpen()).toBe(false);

    state.setFlags(['tout-vu']);
    service.open(m, 'd');
    service.next(); // ignoré : le choix est proposé
    expect(service.currentLine()?.text).toBe('Question');
  });

  it('enchaîne sur la première branche de « next » dont la condition est remplie', () => {
    state.setFlags(['a1', 'b2', 'a3']);
    service.open(map, 'pensee');
    service.next();
    expect(service.currentLine()?.text).toBe('Confiant');

    state.start('Gly', ['b1', 'b2', 'a3']);
    service.open(map, 'pensee');
    service.next();
    expect(service.currentLine()?.text).toBe('Inquiet');
  });
});

describe('GameStateService', () => {
  it('remplace {pseudo} et évalue les conditions', () => {
    const state = TestBed.inject(GameStateService);
    state.start('  Gly ');
    expect(state.format('Salut {pseudo} !')).toBe('Salut Gly !');
    state.setFlags(['x']);
    expect(state.check({ if: ['x'] })).toBe(true);
    expect(state.check({ ifNot: ['x'] })).toBe(false);
    expect(state.check({ if: ['x', 'y'] })).toBe(false);
  });

  it('évalue ifMore : plus de flags posés dans « flags » que dans « than »', () => {
    const state = TestBed.inject(GameStateService);
    state.start('Gly', ['r1', 'r3', 'p2']);
    expect(state.check({ ifMore: { flags: ['r1', 'r2', 'r3'], than: ['p1', 'p2', 'p3'] } })).toBe(
      true,
    );
    expect(state.check({ ifMore: { flags: ['p1', 'p2', 'p3'], than: ['r1', 'r2', 'r3'] } })).toBe(
      false,
    );
    // Égalité : pas de majorité.
    expect(state.check({ ifMore: { flags: ['r1'], than: ['p2'] } })).toBe(false);
  });
});
