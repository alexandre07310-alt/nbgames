/* Vérifie que le barème serveur (functions/scoring.js) donne exactement les
   mêmes points que celui de l'app (src/App.js). Lancer : cd functions && npm test */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const server = require("../scoring");

// Extrait du code source de l'app le barème et ses dépendances
const appSrc = fs.readFileSync(path.join(__dirname, "../../src/App.js"), "utf8");
// Du marqueur de début jusqu'au marqueur de fin (exclu), ou jusqu'à la fin
// de la fonction (première ligne « } » seule) si aucun marqueur de fin.
function slice(startMarker, endMarker = "\n}\n") {
  const a = appSrc.indexOf(startMarker);
  const b = appSrc.indexOf(endMarker, a);
  assert.ok(a >= 0 && b > a, `bloc introuvable dans App.js : ${startMarker}`);
  return appSrc.slice(a, endMarker === "\n}\n" ? b + 3 : b);
}
const clientCode = [
  slice("function proximityPts(", "function getStatForDate("),
  slice("function computePronosticScore("),
].join("\n") + "\nthis.computePronosticScore=computePronosticScore;";
const client = {};
vm.runInNewContext(clientCode, client);

const T_FR = { myBets: "Vainqueur", myScore: "Score", myScorer: "Meilleur scoreur", myScorerPts: "Points du scoreur" };

const match = {
  id: "401", home: "LAL", away: "BOS", homeScore: 112, awayScore: 108,
  topScorer: "LeBron James", topScorerPts: 31, topScorers: ["LeBron James"],
  statLeaders: {
    PTS: { player: "LeBron James", value: 31 }, AST: { player: "Jayson Tatum", value: 9 },
    REB: { player: "Anthony Davis", value: 14 }, BLK: { player: "Anthony Davis", value: 3 },
    STL: { player: "Jrue Holiday", value: 2 },
  },
};

const cases = [
  { name: "tout juste (bonus x2)", p: { w: "LAL", statKey: "PTS", statPlayer: "LeBron James", statVal: "31", done: true } },
  { name: "vainqueur seul", p: { w: "LAL", statKey: "AST", statPlayer: "Luka Doncic", statVal: "4", done: true } },
  { name: "joueur + nombre, mauvais vainqueur", p: { w: "BOS", statKey: "REB", statPlayer: "Anthony Davis", statVal: "14", done: true } },
  { name: "rien de juste", p: { w: "BOS", statKey: "STL", statPlayer: "X", statVal: "0", done: true } },
  { name: "stat inconnue", p: { w: "LAL", statKey: "ZZZ", statPlayer: "LeBron James", statVal: "31", done: true } },
  { name: "ancien format parfait", p: { w: "LAL", homeScore: "112", awayScore: "108", scorer: "LeBron James", scorerPts: "31", done: true } },
  { name: "ancien format proche", p: { w: "BOS", homeScore: "110", awayScore: "108", scorer: "Jayson Tatum", scorerPts: "29", done: true } },
];

for (const c of cases) {
  test(`barème identique app/serveur : ${c.name}`, () => {
    const a = client.computePronosticScore(c.p, match, T_FR);
    const b = server.computePronosticScore(c.p, match);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a)));
  });
}

test("valeurs attendues", () => {
  assert.strictEqual(server.computePronosticScore(cases[0].p, match).total, 120);
  assert.strictEqual(server.computePronosticScore(cases[1].p, match).total, 10);
  assert.strictEqual(server.computePronosticScore(cases[2].p, match).total, 50);
  assert.strictEqual(server.computePronosticScore(cases[3].p, match).total, 0);
});

test("semaine et mois du match, heure de Paris", () => {
  // Mardi 18 nov. 2025 à 2h (Paris) → semaine du lundi 17
  assert.strictEqual(server.getWeekKeyForDate("2025-11-18T01:00:00Z"), "20251117");
  // Dimanche 23 nov. 2025 → toujours la semaine du lundi 17
  assert.strictEqual(server.getWeekKeyForDate("2025-11-23T12:00:00Z"), "20251117");
  // 31 déc. 23h30 UTC = 1er janv. 0h30 à Paris
  assert.strictEqual(server.getMonthKeyForDate("2025-12-31T23:30:00Z"), "202601");
});

test("stripUndefined retire les undefined en profondeur", () => {
  assert.deepStrictEqual(server.stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: [1, { f: undefined }] } }), { a: 1, c: { e: [1, {}] } });
});
