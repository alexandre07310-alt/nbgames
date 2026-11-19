/* Barème des pronostics, côté serveur.
   COPIE de la logique de src/App.js (computePronosticScore, parseSummaryLeaders,
   fetchFinalMatch, getWeekKey…) : toute modification du barème doit être faite
   aux DEUX endroits, sinon le serveur et l'app n'afficheraient pas les mêmes points. */

// Libellés de l'ancien format de pronostic (avant le format « stat du jour »)
const LEGACY_LABELS = {
  myBets: "Vainqueur",
  myScore: "Score",
  myScorer: "Meilleur scoreur",
  myScorerPts: "Points du scoreur",
};

function parisNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}
function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
function getWeekKey() {
  const p = parisNow();
  const day = p.getDay();
  const diff = p.getDate() - (day === 0 ? 6 : day - 1);
  const mon = new Date(p.setDate(diff));
  return ymd(mon);
}
function getMonthKey() {
  const p = parisNow();
  return `${p.getFullYear()}${String(p.getMonth() + 1).padStart(2, "0")}`;
}
function getWeekKeyForDate(dateStr) {
  const p = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const day = p.getDay();
  const diff = p.getDate() - (day === 0 ? 6 : day - 1);
  const mon = new Date(p);
  mon.setDate(diff);
  return ymd(mon);
}
function getMonthKeyForDate(dateStr) {
  const p = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return `${p.getFullYear()}${String(p.getMonth() + 1).padStart(2, "0")}`;
}

function proximityPts(guess, real, exact, ranges) {
  const diff = Math.abs(parseInt(guess) - parseInt(real));
  if (diff === 0) return exact;
  for (const { d, p } of ranges) { if (diff <= d) return p; }
  return 0;
}
const SCORER_RANGES = [{ d: 1, p: 100 }, { d: 2, p: 50 }, { d: 3, p: 30 }, { d: 4, p: 20 }, { d: 5, p: 10 }];
const SCORE_RANGES = [{ d: 1, p: 100 }, { d: 2, p: 50 }, { d: 3, p: 30 }, { d: 4, p: 20 }, { d: 5, p: 10 }];
const STAT_TYPES = [
  { key: "PTS", label: "Meilleur scoreur", emoji: "🏀", unit: "points" },
  { key: "AST", label: "Meilleur passeur", emoji: "🎯", unit: "passes" },
  { key: "REB", label: "Meilleur rebondeur", emoji: "💪", unit: "rebonds" },
  { key: "BLK", label: "Meilleur contreur", emoji: "🛡️", unit: "contres" },
  { key: "STL", label: "Meilleur intercepteur", emoji: "⚡", unit: "interceptions" },
];

function computePronosticScore(pronostics, match, t = LEGACY_LABELS) {
  // Ancien format (legacy)
  if (pronostics.scorer !== undefined || pronostics.homeScore !== undefined) {
    if (pronostics.scoring) return pronostics.scoring;
    const { w, homeScore: hG, awayScore: aG, scorer, scorerPts: spG } = pronostics;
    const realWinnerL = match.homeScore > match.awayScore ? match.home : match.away;
    const bdL = []; let totL = 0;
    const wOkL = w === realWinnerL, wPtsL = wOkL ? 50 : 0;
    bdL.push({ label: t.myBets, guess: w, real: realWinnerL, pts: wPtsL, ok: wOkL }); totL += wPtsL;
    const hOkL = parseInt(hG) === match.homeScore, aOkL = parseInt(aG) === match.awayScore;
    let sPtsL = 0;
    if (hOkL && aOkL) sPtsL = 500;
    else if (hOkL || aOkL) {
      sPtsL = 200;
      if (!hOkL) sPtsL += proximityPts(hG, match.homeScore, 0, SCORE_RANGES);
      if (!aOkL) sPtsL += proximityPts(aG, match.awayScore, 0, SCORE_RANGES);
    } else sPtsL = proximityPts(hG, match.homeScore, 0, SCORE_RANGES) + proximityPts(aG, match.awayScore, 0, SCORE_RANGES);
    bdL.push({ label: t.myScore, guess: `${hG}-${aG}`, real: `${match.homeScore}-${match.awayScore}`, pts: sPtsL, ok: sPtsL > 0 }); totL += sPtsL;
    const topArr = match.topScorers?.length > 0 ? match.topScorers : (match.topScorer ? [match.topScorer] : []);
    const scrOkL = scorer && topArr.includes(scorer), scrPtsL = scrOkL ? 100 : 0;
    bdL.push({ label: t.myScorer, guess: scorer, real: topArr.join(" / ") || "N/A", pts: scrPtsL, ok: scrOkL }); totL += scrPtsL;
    const spPtsL = proximityPts(spG, match.topScorerPts || 0, 200, SCORER_RANGES);
    bdL.push({ label: t.myScorerPts, guess: spG, real: match.topScorerPts || "N/A", pts: spPtsL, ok: spPtsL > 0 }); totL += spPtsL;
    const apL = wOkL && hOkL && aOkL && scrOkL && parseInt(spG) === (match.topScorerPts || 0);
    if (apL) totL *= 2;
    return { breakdown: bdL, total: totL, allPerfect: apL };
  }
  const { w, statKey, statPlayer, statVal } = pronostics;
  const statDef = STAT_TYPES.find(s => s.key === statKey) || STAT_TYPES[0];
  const realWinner = match.homeScore > match.awayScore ? match.home : match.away;
  const breakdown = []; let total = 0;
  // 1. Vainqueur — 10 pts
  const wOk = w === realWinner; const wPts = wOk ? 10 : 0;
  breakdown.push({ label: "Vainqueur", guess: w, real: realWinner, pts: wPts, ok: wOk }); total += wPts;
  // 2. Joueur (stat leader) — 20 pts
  const leader = match.statLeaders?.[statKey];
  const playerOk = !!leader && statPlayer === leader.player; const playerPts = playerOk ? 20 : 0;
  breakdown.push({ label: statDef.label, guess: statPlayer, real: leader?.player || "N/A", pts: playerPts, ok: playerOk }); total += playerPts;
  // 3. Nombre — 30 pts
  const valOk = !!leader && parseInt(statVal) === leader.value; const valPts = valOk ? 30 : 0;
  breakdown.push({ label: `Nb de ${statDef.unit}`, guess: statVal, real: leader?.value ?? "N/A", pts: valPts, ok: valOk }); total += valPts;
  // Bonus ×2 si tout juste
  const allPerfect = wOk && playerOk && valOk;
  if (allPerfect) total *= 2;
  return { breakdown, total, allPerfect };
}

function stripUndefined(obj) {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj && typeof obj === "object") {
    const r = {};
    for (const k of Object.keys(obj)) { if (obj[k] !== undefined) r[k] = stripUndefined(obj[k]); }
    return r;
  }
  return obj;
}

function parseSummaryLeaders(j) {
  try {
    const best = { PTS: 0, AST: 0, REB: 0, BLK: 0, STL: 0 };
    const statLeaders = { PTS: null, AST: null, REB: null, BLK: null, STL: null };
    let topScorers = [], topScorerPts = 0;
    for (const team of (j.boxscore?.players || [])) {
      for (const stat of (team.statistics || [])) {
        const lbl = stat.labels || [];
        const idx = { PTS: lbl.indexOf("PTS"), AST: lbl.indexOf("AST"), REB: lbl.indexOf("REB"), BLK: lbl.indexOf("BLK"), STL: lbl.indexOf("STL") };
        for (const athlete of (stat.athletes || [])) {
          const name = athlete.athlete?.displayName || null; if (!name) continue;
          const st = athlete.stats || [];
          for (const k of ["PTS", "AST", "REB", "BLK", "STL"]) {
            if (idx[k] < 0) continue;
            const v = parseInt(st[idx[k]]) || 0;
            if (v > best[k]) { best[k] = v; statLeaders[k] = { player: name, value: v }; }
          }
          const pts = parseInt(st[idx.PTS]) || 0;
          if (pts > topScorerPts) { topScorerPts = pts; topScorers = [name]; }
          else if (pts === topScorerPts && pts > 0 && !topScorers.includes(name)) { topScorers.push(name); }
        }
      }
    }
    return { topScorer: topScorers[0] || null, topScorerPts, topScorers, statLeaders };
  } catch (e) { return null; }
}

// Résultat définitif d'un match (score + meilleurs joueurs). null tant que le
// match n'est pas terminé, ou si ESPN ne répond pas.
async function fetchFinalMatch(espnId) {
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(espnId)}`);
    const j = await r.json();
    const comp = j.header?.competitions?.[0];
    if (comp?.status?.type?.completed !== true) return null;
    const home = comp.competitors?.find(c => c.homeAway === "home"), away = comp.competitors?.find(c => c.homeAway === "away");
    if (!home?.team || !away?.team) return null;
    const leaders = parseSummaryLeaders(j);
    if (!leaders) return null;
    return { id: espnId, home: home.team.abbreviation, away: away.team.abbreviation, homeScore: parseInt(home.score) || 0, awayScore: parseInt(away.score) || 0, tipoff: comp.date || "", isFinished: true, ...leaders };
  } catch (e) { return null; }
}

module.exports = {
  computePronosticScore, stripUndefined, parseSummaryLeaders, fetchFinalMatch,
  getWeekKey, getMonthKey, getWeekKeyForDate, getMonthKeyForDate,
};
