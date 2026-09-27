import { TestBed } from '@angular/core/testing';
import { GameMap } from '../models/game.models';
import { DialogueService } from './dialogue.service';

const map: GameMap = {
  id: 'test',
  name: 'Test',
  background: '',
  regions: [],
  onEnter: 'intro',
  dialogues: {
    intro: { lines: [{ text: 'Un' }, { text: 'Deux', choices: [{ text: 'Suite', next: 'suite' }] }] },
    suite: { lines: [{ character: 'lea', text: 'Trois' }] },
  },
};

describe('DialogueService', () => {
  let service: DialogueService;

  beforeEach(() => {
    service = TestBed.inject(DialogueService);
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

  it('ne joue le dialogue d’arrivée qu’une fois', () => {
    service.playIntro(map);
    expect(service.isOpen()).toBe(true);
    service.close();
    service.playIntro(map);
    expect(service.isOpen()).toBe(false);
  });
});
