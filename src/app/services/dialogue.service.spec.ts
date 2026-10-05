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
});
