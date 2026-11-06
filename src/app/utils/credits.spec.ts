import { CreditStat } from '../models/game.models';
import { profile, statLines } from './credits';

const stats: CreditStat[] = [
  {
    id: 'jour-1',
    answers: [
      {
        id: 'confiant',
        flags: ['a1', 'a2', 'a3'],
        text: 'Confiant comme {pct}%, contre {pct:peu-assure}%.',
      },
      {
        id: 'peu-assure',
        flags: ['b1', 'b2', 'b3'],
        text: 'Peu assuré comme {pct}%, contre {pct:confiant}%.',
      },
    ],
  },
  {
    id: 'curiosite',
    answers: [
      { id: 'curieux', flags: ['curieux'], text: 'Curieux comme {pct}%.' },
      { id: 'pas-curieux', text: 'Pas curieux.' },
    ],
  },
  { id: 'attente', answers: [{ id: 'sieste', flags: ['sieste'], text: 'Sieste : {pct}%.' }] },
];

describe('profile', () => {
  it('prend la réponse dont le joueur a posé le plus de flags', () => {
    expect(profile(stats, new Set(['a1', 'b1', 'b3', 'sieste']))).toEqual({
      'jour-1': 'peu-assure',
      curiosite: 'pas-curieux',
      attente: 'sieste',
    });
  });

  it('égalité : la première réponse ; aucun flag et pas de réponse par défaut : statistique omise', () => {
    expect(profile(stats, new Set(['a1', 'b1', 'curieux']))).toEqual({
      'jour-1': 'confiant',
      curiosite: 'curieux',
    });
  });
});

describe('statLines', () => {
  it('remplace {pct} et {pct:id} par les pourcentages des joueurs', () => {
    const lines = statLines(
      stats,
      { 'jour-1': 'confiant', curiosite: 'curieux', attente: 'sieste' },
      { 'jour-1': { confiant: 2, 'peu-assure': 1 }, curiosite: { curieux: 1, 'pas-curieux': 3 } },
    );
    expect(lines).toEqual(['Confiant comme 67%, contre 33%.', 'Curieux comme 25%.']);
  });
});

describe('statLines : phrase négative', () => {
  const origines: CreditStat[] = [
    {
      id: 'origines',
      answers: [
        { id: 'livre-lu', flags: ['livre-histoire-lu'], text: 'Vous faites partie des {pct} %.' },
        { id: 'livre-pas-lu', text: 'Vous ne faites pas partie des {pct:livre-lu} %.' },
      ],
    },
  ];
  // 1 joueur sur 4 a lu le livre : 25 %, que le joueur l'ait lu ou non.
  const counts = { origines: { 'livre-lu': 1, 'livre-pas-lu': 3 } };

  it('affiche le % des joueurs qui ont fait l’action, dans les deux cas', () => {
    expect(statLines(origines, { origines: 'livre-lu' }, counts)).toEqual(['Vous faites partie des 25 %.']);
    expect(statLines(origines, { origines: 'livre-pas-lu' }, counts)).toEqual([
      'Vous ne faites pas partie des 25 %.',
    ]);
  });
});
