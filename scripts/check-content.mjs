/**
 * Vérifie le contenu du jeu (public/data) : `npm run check`.
 *
 * - chaque JSON respecte son schéma (schemas/) : une clé mal écrite est signalée ;
 * - chaque id référencé existe : maps, dialogues, personnages, images et vidéos ;
 * - chaque flag testé (`if`, `ifNot`, `ifMore`, objectifs de quête) est posé quelque part.
 *
 * Sans cette vérification, une faute de frappe ne provoque aucune erreur dans le jeu :
 * la suite de l'histoire ne se déclenche simplement jamais.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const errors = [];
const warnings = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${relative(root, path)} : JSON illisible (${e.message})`);
    return null;
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = {
  game: ajv.compile(readJson(join(root, 'schemas/game.schema.json'))),
  map: ajv.compile(readJson(join(root, 'schemas/map.schema.json'))),
};

function validate(kind, data, where) {
  if (validators[kind](data)) return;
  for (const e of validators[kind].errors) {
    const extra = e.params?.additionalProperty ? ` « ${e.params.additionalProperty} »` : '';
    errors.push(`${where}${e.instancePath || ''} : ${e.message}${extra}`);
  }
}

/** Image ou vidéo : un chemin, ou une liste de chemins (vidéos jouées à la suite). */
function checkMedia(media, where) {
  for (const path of Array.isArray(media) ? media : [media]) {
    if (path && !existsSync(join(pub, path)))
      errors.push(`${where} : image ou vidéo introuvable « ${path} »`);
  }
}

// --- game.json ---
const gameFile = 'public/data/game.json';
const game = readJson(join(root, gameFile));
if (!game) report();
validate('game', game, gameFile);

const mapIds = new Set((game.maps ?? []).map((m) => m.id));
const characters = game.characters ?? {};
checkMedia(game.titleBackground, `${gameFile} titleBackground`);
for (const [id, c] of Object.entries(characters))
  checkMedia(c.portrait, `${gameFile} personnage « ${id} »`);
if (!mapIds.has(game.startMap))
  errors.push(`${gameFile} : startMap « ${game.startMap} » n'est pas dans "maps"`);

/** Flags posés quelque part, et flags testés (avec l'endroit où ils le sont). */
const flagsSet = new Set();
const flagsUsed = [];
/** Flags comptés par les statistiques des crédits (avertissement seulement : la scène peut être à venir). */
const creditFlags = [];
const useFlags = (cond, where) => {
  const more = cond?.ifMore;
  for (const f of [
    ...(cond?.if ?? []),
    ...(cond?.ifNot ?? []),
    ...(more?.flags ?? []),
    ...(more?.than ?? []),
  ])
    flagsUsed.push({ flag: f, where });
};

for (const q of game.quests ?? []) {
  const where = `${gameFile} quête « ${q.id} »`;
  useFlags(q, where);
  for (const o of q.objectives ?? []) {
    const w = `${where}, objectif « ${o.text} »`;
    useFlags(o, w);
    for (const f of [...(o.done ? [o.done] : []), ...(o.count ?? [])])
      flagsUsed.push({ flag: f, where: w });
  }
}

// --- maps ---
const seenIds = new Set();
for (const entry of game.maps ?? []) {
  if (seenIds.has(entry.id)) errors.push(`${gameFile} : map « ${entry.id} » listée deux fois`);
  seenIds.add(entry.id);

  const file = `public/${entry.file}`;
  if (!existsSync(join(root, file))) {
    errors.push(`${gameFile} : fichier introuvable pour la map « ${entry.id} » (${file})`);
    continue;
  }
  const map = readJson(join(root, file));
  if (!map) continue;
  validate('map', map, file);
  if (map.id !== entry.id)
    errors.push(`${file} : id « ${map.id} » différent de celui de game.json (« ${entry.id} »)`);
  checkMedia(map.background, `${file} background`);
  for (const f of map.setFlags ?? []) flagsSet.add(f);

  const dialogues = map.dialogues ?? {};
  const referenced = new Set();
  const refDialogue = (id, where) => {
    referenced.add(id);
    if (!(id in dialogues))
      errors.push(`${file} ${where} : dialogue « ${id} » introuvable dans cette map`);
  };
  const refMap = (id, where) => {
    if (!mapIds.has(id)) errors.push(`${file} ${where} : map « ${id} » introuvable dans game.json`);
  };

  const regionIds = new Set();
  for (const r of map.regions ?? []) {
    const where = `zone « ${r.id} »`;
    if (regionIds.has(r.id)) errors.push(`${file} : zone « ${r.id} » définie deux fois`);
    regionIds.add(r.id);
    useFlags(r, `${file} ${where}`);
    if (r.action?.type === 'dialogue') refDialogue(r.action.dialogue, where);
    if (r.action?.type === 'goto') refMap(r.action.map, where);
  }
  for (const t of map.triggers ?? []) {
    useFlags(t, `${file} trigger « ${t.dialogue} »`);
    refDialogue(t.dialogue, 'trigger');
  }
  if (map.interlude?.next) refMap(map.interlude.next, 'interlude');
  for (const stat of map.credits?.stats ?? []) {
    const where = `${file} statistique « ${stat.id} »`;
    const ids = new Set((stat.answers ?? []).map((a) => a.id));
    for (const a of stat.answers ?? []) {
      for (const f of a.flags ?? [])
        creditFlags.push({ flag: f, where: `${where}, réponse « ${a.id} »` });
      for (const [, id] of (a.text ?? '').matchAll(/\{pct:([^}]+)\}/g))
        if (!ids.has(id))
          errors.push(`${where}, réponse « ${a.id} » : {pct:${id}}, réponse introuvable`);
    }
  }

  for (const [id, d] of Object.entries(dialogues)) {
    for (const f of d.setFlags ?? []) flagsSet.add(f);
    if (typeof d.next === 'string') refDialogue(d.next, `dialogue « ${id} », fin`);
    else
      for (const b of d.next ?? []) {
        useFlags(b, `${file} dialogue « ${id} », fin vers « ${b.dialogue} »`);
        refDialogue(b.dialogue, `dialogue « ${id} », fin`);
      }
    (d.lines ?? []).forEach((line, i) => {
      const where = `dialogue « ${id} », réplique ${i + 1}`;
      checkMedia(line.media, `${file} ${where}, media`);
      if (line.waitMedia) {
        const list = Array.isArray(line.media) ? line.media : [];
        if (!list.slice(0, -1).some((path) => /\.(mp4|webm|ogv|m4v|mov)$/i.test(path)))
          errors.push(
            `${file} ${where} : waitMedia attend une liste de media dont une vidéo n'est pas la dernière (sinon elle tourne en boucle et la réplique ne finit jamais)`,
          );
      }
      if (line.character && !(line.character in characters)) {
        errors.push(`${file} ${where} : personnage « ${line.character} » absent de game.json`);
      }
      for (const c of line.choices ?? []) {
        useFlags(c, `${file} ${where}, choix « ${c.text} »`);
        for (const f of c.setFlags ?? []) flagsSet.add(f);
        if (c.next) refDialogue(c.next, `${where}, choix « ${c.text} »`);
        if (c.goto) refMap(c.goto, `${where}, choix « ${c.text} »`);
      }
    });
  }
  for (const id of Object.keys(dialogues)) {
    if (!referenced.has(id)) warnings.push(`${file} : dialogue « ${id} » jamais utilisé`);
  }
}

for (const { flag, where } of flagsUsed) {
  if (!flagsSet.has(flag))
    errors.push(`${where} : flag « ${flag} » testé mais jamais posé (setFlags)`);
}

for (const { flag, where } of creditFlags) {
  if (!flagsSet.has(flag)) warnings.push(`${where} : flag « ${flag} » jamais posé (setFlags)`);
}

report();

function report() {
  for (const w of warnings) console.warn(`⚠ ${w}`);
  for (const e of errors) console.error(`✗ ${e}`);
  if (errors.length) {
    console.error(`\n${errors.length} erreur(s) dans le contenu du jeu.`);
    process.exit(1);
  }
  console.log(`✓ Contenu du jeu cohérent (${mapIds.size} maps, ${flagsSet.size} flags).`);
  process.exit(0);
}
