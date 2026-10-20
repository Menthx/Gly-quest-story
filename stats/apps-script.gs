/**
 * Statistiques des joueurs de Glyglyland : reçoit les événements envoyés par le jeu et les range
 * dans ce Google Sheet. À coller dans Extensions › Apps Script, puis à déployer en « Application Web ».
 *
 * Onglets :
 * - Événements : une ligne par événement (début de partie, map, flag, choix)
 * - Joueurs    : une ligne par joueur, avec où il en est
 * - Synthèse   : nombre de joueurs par map, par flag, et répartition des choix (formules)
 */

const EVENTS = 'Événements';
const PLAYERS = 'Joueurs';
const SUMMARY = 'Synthèse';

const EVENT_HEADERS = ['Reçu le', 'Date (joueur)', 'Joueur', 'Pseudo', 'Type', 'Valeur', 'Map'];
const PLAYER_HEADERS = [
  'Joueur',
  'Pseudo',
  'Première visite',
  'Dernière activité',
  'Map actuelle',
  'Flags (partie en cours)',
  'Dernier flag',
  'Parties',
];

/**
 * Le jeu envoie `?d={"events":[...]}` en GET : un POST peut être redirigé par Google avant
 * d'atteindre le script (plusieurs comptes connectés…) et perdre son contenu en route.
 * Sans `d`, la page affiche simplement « ok » (test de l'URL dans le navigateur).
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.d) record(JSON.parse(e.parameter.d).events || []);
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

/** Met à jour la ligne de chaque joueur concerné. */
function updatePlayers(sheet, events, now) {
  const last = sheet.getLastRow();
  const data = last > 1 ? sheet.getRange(2, 1, last - 1, PLAYER_HEADERS.length).getValues() : [];
  const index = new Map(data.map((row, i) => [row[0], i]));

  for (const ev of events) {
    let i = index.get(ev.player);
    if (i === undefined) {
      i = data.length;
      data.push([ev.player, ev.pseudo, now, now, '', 0, '', 0]);
      index.set(ev.player, i);
    }
    const row = data[i];
    row[1] = ev.pseudo;
    row[3] = now;
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
  if (!book.getSheetByName(SUMMARY)) {
    const summary = book.insertSheet(SUMMARY, 0);
    const ev = `'${EVENTS}'`;
    summary
      .getRange('A1:H1')
      .setValues([['Joueurs', '', 'Joueurs par map', '', 'Joueurs par flag', '', 'Choix', '']]);
    summary.getRange('A1:H1').setFontWeight('bold');
    summary.getRange('A2').setFormula(`=COUNTA('${PLAYERS}'!A2:A)`);
    // Une paire (joueur, valeur) unique par joueur, puis comptée par valeur.
    const distinct = (type, label) =>
      `=IFERROR(QUERY(UNIQUE(QUERY(${ev}!C2:F, "select C, F where E = '${type}'", 0)),` +
      ` "select Col2, count(Col1) group by Col2 order by count(Col1) desc` +
      ` label Col2 '${label}', count(Col1) 'Joueurs'", 0), "")`;
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
  return { events, players };
}

function sheet(book, name, headers) {
  let s = book.getSheetByName(name);
  if (!s) {
    s = book.insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}
