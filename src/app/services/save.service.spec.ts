import { TestBed } from '@angular/core/testing';
import { DialogueService } from './dialogue.service';
import { GameStateService } from './game-state.service';
import { SaveService } from './save.service';

describe('SaveService', () => {
  beforeEach(() => localStorage.clear());

  it('sauvegarde automatiquement la partie et la restaure', () => {
    const saves = TestBed.inject(SaveService);
    const state = TestBed.inject(GameStateService);
    state.start('Gly');
    state.setFlags(['lettre-lue']);
    state.currentMap.set('train-exterieur');
    TestBed.tick();

    const save = saves.load();
    expect(save?.pseudo).toBe('Gly');
    expect(save?.flags).toEqual(['lettre-lue']);
    expect(save?.map).toBe('train-exterieur');

    state.start('Autre');
    expect(saves.restore(save!)).toBe('train-exterieur');
    expect(state.pseudo()).toBe('Gly');
    expect(state.has('lettre-lue')).toBe(true);
  });

  it('rouvre le dialogue en cours à la reprise', () => {
    const saves = TestBed.inject(SaveService);
    const dialogue = TestBed.inject(DialogueService);
    saves.restore({
      version: 1,
      pseudo: 'Gly',
      flags: [],
      triggersPlayed: ['m/intro'],
      map: 'm',
      dialogue: 'intro',
      savedAt: '',
    });
    dialogue.resumePending({
      id: 'm',
      name: 'M',
      dialogues: { intro: { lines: [{ text: 'Re' }] } },
    });
    expect(dialogue.currentLine()?.text).toBe('Re');
    expect(dialogue.triggersPlayed().has('m/intro')).toBe(true);
  });

  it('ignore une sauvegarde illisible ou d’une autre version', () => {
    const saves = TestBed.inject(SaveService);
    localStorage.setItem('gly-quest-story/save', '{pas du json');
    expect(saves.load()).toBeNull();
    localStorage.setItem('gly-quest-story/save', JSON.stringify({ version: 0, pseudo: 'x' }));
    expect(saves.load()).toBeNull();
  });
});
