/**
 * Statistiques des joueurs de Glyglyland : reçoit les événements envoyés par le jeu et les range
 * dans ce Google Sheet. À coller dans Extensions › Apps Script, puis à déployer en « Application Web ».
 *
 * Onglets :
 * - Événements : une ligne par événement (début de partie, map, flag, choix)
 * - Joueurs    : une ligne par partie, avec où elle en est
 * - Synthèse   : nombre de parties et de personnes, parties par map, par flag, et répartition des choix
 * - Fins       : une ligne par partie terminée, avec les réponses aux statistiques
 *                (une colonne par statistique, ajoutée automatiquement)
 *
 * « Joueur » identifie une partie (nouveau à chaque « Jouer »), « Navigateur » une personne (le même
 * d'une partie à l'autre). Les lignes envoyées avant l'ajout de « Navigateur » n'ont que « Joueur »,
 * qui était alors le même pour toutes les parties du navigateur.
 *
 * Les crédits du jeu affichent les pourcentages calculés sur l'onglet Fins.
 * Après avoir collé une nouvelle version du script : Déployer › Gérer les déploiements › modifier (crayon)
 * › Version : « Nouvelle version » › Déployer. L'URL reste la même.
 */

const EVENTS = 'Événements';
const PLAYERS = 'Joueurs';
const SUMMARY = 'Synthèse';
const ENDINGS = 'Fins';

const EVENT_HEADERS = [
  'Reçu le',
  'Date (joueur)',
  'Joueur',
  'Pseudo',
  'Type',
  'Valeur',
  'Map',
  'Navigateur',
];
const ENDING_HEADERS = ['Joueur', 'Pseudo', 'Terminé le'];
const PLAYER_HEADERS = [
  'Joueur',
  'Pseudo',
  'Première visite',
  'Dernière activité',
  'Map actuelle',
  'Flags (partie en cours)',
  'Dernier flag',
  'Parties',
  'Navigateur',
];
/** Colonne des Fins qui n'est pas une statistique (ajoutée après les statistiques existantes). */
const BROWSER = 'Navigateur';

/**
 * Le jeu envoie `?d={"events":[...]}` en GET : un POST peut être redirigé par Google avant
 * d'atteindre le script (plusieurs comptes connectés…) et perdre son contenu en route.
 *
 * Crédits : `?fin={"player","pseudo","answers":{...}}` enregistre les réponses du joueur dans l'onglet
 * Fins, puis renvoie les résultats en JSON ; `?resultats=1` renvoie seulement les résultats (mode debug).
 * Sans paramètre, la page affiche simplement « ok » (test de l'URL dans le navigateur).
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.d) record(JSON.parse(p.d).events || []);
  if (p.fin) recordEnding(JSON.parse(p.fin));
  if (p.fin || p.resultats) {
    return ContentService.createTextOutput(JSON.stringify(results())).setMimeType(
      ContentService.MimeType.JSON,
    );
  }
  return ContentService.createTextOutput('ok');
}

/** Ancien format d'envoi (POST), gardé pour compatibilité. */
function doPost(e) {
  record(JSON.parse(e.postData.contents).events || []);
  return ContentService.createTextOutput('ok');
}

/** Écrit les événements reçus dans les onglets Événements et Joueurs. */
function record(events) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheets = setup();
    const now = new Date();
    const rows = events.map((ev) => [
      now,
      ev.at ? new Date(ev.at) : '',
      ev.player,
      ev.pseudo,
      ev.type,
      ev.value,
      ev.map || '',
      ev.browser || '',
    ]);
    if (rows.length) {
      sheets.events
        .getRange(sheets.events.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length)
        .setValues(rows);
    }
    updatePlayers(sheets.players, events, now);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Réponses d'une partie arrivée aux crédits : une ligne par partie (identifiant « Joueur »). Une colonne
 * est ajoutée pour chaque nouvelle statistique, et pour « Navigateur ».
 */
function recordEnding(ending) {
  if (!ending || !ending.player) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const s = sheet(SpreadsheetApp.getActiveSpreadsheet(), ENDINGS, ENDING_HEADERS);
    const answers = ending.answers || {};
    const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    for (const stat of [BROWSER, ...Object.keys(answers)]) {
      if (headers.indexOf(stat) === -1) {
        headers.push(stat);
        s.getRange(1, headers.length).setValue(stat).setFontWeight('bold');
      }
    }
    const row = headers.map((h, i) => {
      if (i === 0) return ending.player;
      if (i === 1) return ending.pseudo || '';
      if (i === 2) return new Date();
      if (h === BROWSER) return ending.browser || '';
      return answers[h] || '';
    });
    const last = s.getLastRow();
    const ids =
      last > 1
        ? s
            .getRange(2, 1, last - 1, 1)
            .getValues()
            .map((r) => r[0])
        : [];
    const index = ids.indexOf(ending.player);
    const line = index === -1 ? last + 1 : index + 2;
    s.getRange(line, 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }
}

/** Nombre de parties par réponse pour chaque statistique : `{ joueurs, stats: { stat: { réponse: n } } }`. */
function results() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENDINGS);
  const stats = {};
  if (!s || s.getLastRow() < 2) return { joueurs: 0, stats };
  const data = s.getDataRange().getValues();
  const headers = data[0];
  for (let c = ENDING_HEADERS.length; c < headers.length; c++) {
    if (headers[c] === BROWSER) continue;
    const counts = {};
    for (let r = 1; r < data.length; r++) {
      const answer = data[r][c];
      if (answer !== '') counts[answer] = (counts[answer] || 0) + 1;
    }
    stats[headers[c]] = counts;
  }
  return { joueurs: data.length - 1, stats };
}

/** Met à jour la ligne de chaque joueur concerné. */
function updatePlayers(sheet, events, now) {
  const last = sheet.getLastRow();
  const data = last > 1 ? sheet.getRange(2, 1, last - 1, PLAYER_HEADERS.length).getValues() : [];
  const index = new Map(data.map((row, i) => [row[0], i]));

  for (const ev of events) {
    let i = index.get(ev.player);
    if (i === undefined) {
      i = data.length;
      data.push([ev.player, ev.pseudo, now, now, '', 0, '', 0, '']);
      index.set(ev.player, i);
    }
    const row = data[i];
    row[1] = ev.pseudo;
    row[3] = now;
    if (ev.browser) row[8] = ev.browser;
    if (ev.map) row[4] = ev.map;
    if (ev.type === 'partie' && ev.value === 'nouvelle') {
      row[5] = 0;
      row[6] = '';
    }
    if (ev.type === 'partie') row[7] = Number(row[7]) + 1;
    if (ev.type === 'flag') {
      row[5] = Number(row[5]) + 1;
      row[6] = ev.value;
    }
  }
  if (data.length) sheet.getRange(2, 1, data.length, PLAYER_HEADERS.length).setValues(data);
}

/**
 * Crée les onglets s'ils n'existent pas. Lancé automatiquement au premier événement ; peut aussi
 * être exécuté à la main depuis l'éditeur Apps Script pour préparer le classeur.
 */
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const events = sheet(book, EVENTS, EVENT_HEADERS);
  const players = sheet(book, PLAYERS, PLAYER_HEADERS);
  const ev = `'${EVENTS}'`;
  if (!book.getSheetByName(SUMMARY)) {
    const summary = book.insertSheet(SUMMARY, 0);
    summary
      .getRange('A1:H1')
      .setValues([
        ['Parties', 'Personnes', 'Parties par map', '', 'Parties par flag', '', 'Choix', ''],
      ]);
    summary.getRange('A1:H1').setFontWeight('bold');
    summary.getRange('A2').setFormula(`=COUNTA('${PLAYERS}'!A2:A)`);
    // Une paire (partie, valeur) unique par partie, puis comptée par valeur.
    const distinct = (type, label) =>
      `=IFERROR(QUERY(UNIQUE(QUERY(${ev}!C2:F, "select C, F where E = '${type}'", 0)),` +
      ` "select Col2, count(Col1) group by Col2 order by count(Col1) desc` +
      ` label Col2 '${label}', count(Col1) 'Parties'", 0), "")`;
    summary.getRange('C2').setFormula(distinct('map', 'Map'));
    summary.getRange('E2').setFormula(distinct('flag', 'Flag'));
    summary
      .getRange('G2')
      .setFormula(
        `=IFERROR(QUERY(${ev}!E2:F, "select F, count(E) where E = 'choix' group by F` +
          ` order by count(E) desc label F 'Choix', count(E) 'Fois'", 0), "")`,
      );
    summary.setFrozenRows(1);
  }
  // Parties et personnes uniques (ajouté aussi aux classeurs créés avant l'identifiant de navigateur).
  const summary = book.getSheetByName(SUMMARY);
  if (!summary.getRange('B2').getFormula()) {
    summary
      .getRange('A1:B1')
      .setValues([['Parties', 'Personnes']])
      .setFontWeight('bold');
    // Une personne = un navigateur ; avant l'identifiant de navigateur, l'identifiant de joueur en tenait lieu.
    summary
      .getRange('B2')
      .setFormula(
        `=IFERROR(COUNTUNIQUE(FILTER(IF(${ev}!H2:H <> "", ${ev}!H2:H, ${ev}!C2:C), ${ev}!C2:C <> "")), 0)`,
      );
  }
  return { events, players };
}

function sheet(book, name, headers) {
  let s = book.getSheetByName(name);
  if (!s) {
    s = book.insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    s.setFrozenRows(1);
  } else if (s.getRange(1, headers.length).getValue() !== headers[headers.length - 1]) {
    // Onglet créé par une version précédente : on ajoute les nouvelles colonnes en fin de ligne.
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }
  return s;
}
