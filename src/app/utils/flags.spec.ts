import { GameConfig, GameMap } from '../models/game.models';
import { collectFlags } from './flags';

describe('collectFlags', () => {
  it('rassemble les flags posés et testés, sans doublon, triés', () => {
    const config: GameConfig = {
      title: 'Test',
      startMap: 'a',
      maps: [],
      characters: {},
      quests: [
        {
          id: 'q',
          title: 'Quête',
          if: ['depart'],
          ifNot: ['fin'],
          objectives: [
            { text: 'Un', done: 'lettre' },
            { text: 'Lieux', count: ['serre', 'cour'], if: ['depart'] },
          ],
        },
      ],
    };
    const map: GameMap = {
      id: 'a',
      name: 'A',
      setFlags: ['serre'],
      triggers: [{ dialogue: 'intro', ifNot: ['vu'] }],
      regions: [
        {
          id: 'r',
          shape: { type: 'rect', x: 0, y: 0, width: 1, height: 1 },
          action: { type: 'goto', map: 'a' },
          if: ['porte'],
        },
      ],
      dialogues: {
        intro: {
          setFlags: ['vu'],
          lines: [{ text: '…', choices: [{ text: 'Oui', setFlags: ['oui'], ifNot: ['non'] }] }],
        },
      },
    };
    expect(collectFlags(config, [map])).toEqual([
      'cour',
      'depart',
      'fin',
      'lettre',
      'non',
      'oui',
      'porte',
      'serre',
      'vu',
    ]);
  });
});
