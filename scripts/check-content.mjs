/**
 * Vérifie le contenu du jeu (public/data) : `npm run check`.
 *
 * - chaque JSON respecte son schéma (schemas/) : une clé mal écrite est signalée ;
 * - chaque id référencé existe : maps, dialogues, personnages, images ;
 * - chaque flag testé (`if`, `ifNot`, objectifs de quête) est posé quelque part.
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

function checkImage(path, where) {
  if (path && !existsSync(join(pub, path))) errors.push(`${where} : image introuvable « ${path} »`);
}

// --- game.json ---
const gameFile = 'public/data/game.json';
const game = readJson(join(root, gameFile));
if (!game) report();
validate('game', game, gameFile);

const mapIds = new Set((game.maps ?? []).map((m) => m.id));
const characters = game.characters ?? {};
checkImage(game.titleBackground, `${gameFile} titleBackground`);
for (const [id, c] of Object.entries(characters))
  checkImage(c.portrait, `${gameFile} personnage « ${id} »`);
if (!mapIds.has(game.startMap))
  errors.push(`${gameFile} : startMap « ${game.startMap} » n'est pas dans "maps"`);

/** Flags posés quelque part, et flags testés (avec l'endroit où ils le sont). */
const flagsSet = new Set();
const flagsUsed = [];
const useFlags = (cond, where) => {
  for (const f of [...(cond?.if ?? []), ...(cond?.ifNot ?? [])]) flagsUsed.push({ flag: f, where });
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
  checkImage(map.background, `${file} background`);
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

  for (const [id, d] of Object.entries(dialogues)) {
    for (const f of d.setFlags ?? []) flagsSet.add(f);
    if (d.next) refDialogue(d.next, `dialogue « ${id} », fin`);
    (d.lines ?? []).forEach((line, i) => {
      const where = `dialogue « ${id} », réplique ${i + 1}`;
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
