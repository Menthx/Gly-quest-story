import { CreditStat } from '../models/game.models';

/** Réponse du joueur à chaque statistique (`{ "jour-1": "confiant", ... }`). */
export type Profile = Record<string, string>;

/** Nombre de joueurs par réponse, pour chaque statistique (renvoyé par le script Google). */
export type StatsCounts = Record<string, Record<string, number>>;

/**
 * Réponse du joueur à chaque statistique : la réponse dont il a posé le plus de flags (égalité : la
 * première), sinon la réponse sans flags. Une statistique sans réponse possible est absente du profil.
 */
export function profile(stats: CreditStat[], flags: ReadonlySet<string>): Profile {
  const result: Profile = {};
  for (const stat of stats) {
    let best: string | null = null;
    let bestCount = 0;
    for (const answer of stat.answers) {
      const count = (answer.flags ?? []).filter((f) => flags.has(f)).length;
      if (count > bestCount) {
        best = answer.id;
        bestCount = count;
      }
    }
    best ??= stat.answers.find((a) => !a.flags?.length)?.id ?? null;
    if (best) result[stat.id] = best;
  }
  return result;
}

/**
 * Phrases des statistiques pour ce joueur : `{pct}` et `{pct:<id>}` sont remplacés par le pourcentage de
 * joueurs ayant cette réponse. Une statistique sans réponse du joueur, sans joueurs comptés ou dont la
 * réponse a un texte vide est omise.
 */
export function statLines(stats: CreditStat[], player: Profile, counts: StatsCounts): string[] {
  const lines: string[] = [];
  for (const stat of stats) {
    const answer = stat.answers.find((a) => a.id === player[stat.id]);
    const byAnswer = counts[stat.id] ?? {};
    const total = Object.values(byAnswer).reduce((sum, n) => sum + n, 0);
    if (!answer?.text || !total) continue;
    const pct = (id: string) => String(Math.round(((byAnswer[id] ?? 0) / total) * 100));
    lines.push(
      answer.text
        .replaceAll('{pct}', pct(answer.id))
        .replace(/\{pct:([^}]+)\}/g, (_, id: string) => pct(id)),
    );
  }
  return lines;
}
