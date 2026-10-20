import { Condition, GameConfig, GameMap } from '../models/game.models';

/**
 * Tous les flags du jeu : posés par un `setFlags` ou testés par une condition, un objectif ou un compteur.
 * Sert au mode debug pour proposer la liste complète, à cocher ou décocher.
 */
export function collectFlags(config: GameConfig, maps: GameMap[]): string[] {
  const flags = new Set<string>();
  const add = (list: string[] | undefined) => list?.forEach((f) => flags.add(f));
  const cond = (c: Condition | undefined) => {
    add(c?.if);
    add(c?.ifNot);
  };

  for (const quest of config.quests ?? []) {
    cond(quest);
    for (const o of quest.objectives) {
      cond(o);
      if (o.done) flags.add(o.done);
      add(o.count);
    }
  }
  for (const map of maps) {
    add(map.setFlags);
    map.regions?.forEach(cond);
    map.triggers?.forEach(cond);
    for (const dialogue of Object.values(map.dialogues ?? {})) {
      add(dialogue.setFlags);
      for (const line of dialogue.lines) {
        for (const choice of line.choices ?? []) {
          cond(choice);
          add(choice.setFlags);
        }
      }
    }
  }
  return [...flags].sort((a, b) => a.localeCompare(b));
}
