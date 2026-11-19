/* Cloud Functions NBgAmes.

   scorePronostics (toutes les 15 min) : crédite les points du match du jour
   pour TOUS les joueurs dès que le match est terminé, remet à zéro le streak
   de ceux qui n'ont pas parié, et rattrape les pronostics restés sans points.

   Avant, ce calcul tournait dans l'app du premier joueur connecté, ce qui
   obligeait les règles Firestore à laisser n'importe quel compte modifier le
   profil de n'importe quel autre. Le SDK Admin utilisé ici n'est pas soumis
   aux règles : on peut donc les fermer. */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  computePronosticScore, stripUndefined, fetchFinalMatch,
  getWeekKey, getMonthKey, getWeekKeyForDate, getMonthKeyForDate,
} = require("./scoring");

initializeApp();
const db = getFirestore();

// Mêmes bornes que le rattrapage de l'app : on ne reverse pas de points sur
// des matchs anciens (saison déjà clôturée, par exemple).
const CATCHUP_MAX_AGE_MS = 4 * 24 * 3600 * 1000;
const CATCHUP_EVERY_MS = 6 * 3600 * 1000;

/* Crédite UN pronostic terminé, dans une transaction. L'app du joueur peut
   faire le même calcul au même moment : le second à passer voit `scoring`
   déjà posé et n'ajoute rien. Même logique que scoreUserPronostic (App.js). */
async function scoreUserPronostic(uid, match) {
  const userRef = db.collection("users").doc(uid);
  const key = "pronostic_" + match.id;
  return db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return null;
    const data = snap.data();
    const pron = data[key];
    if (!pron?.done) return null;
    const tipoff = pron.tipoff || match.tipoff || null;
    // « Dernier match » : ne jamais revenir à un match plus ancien que celui enregistré
    const prev = data.lastMatchId && data.lastMatchId !== match.id ? data["pronostic_" + data.lastMatchId] : null;
    const isLatest = !prev?.tipoff || !tipoff || new Date(tipoff).getTime() >= new Date(prev.tipoff).getTime();
    if (pron.scoring) {
      if (isLatest && data.lastMatchId !== match.id) {
        tx.update(userRef, { lastMatchId: match.id, lastMatchPts: pron.scoring.total || 0 });
      }
      return { already: true };
    }
    const sr = computePronosticScore(pron, match);
    const wKey = tipoff ? getWeekKeyForDate(tipoff) : getWeekKey();
    const mKey = tipoff ? getMonthKeyForDate(tipoff) : getMonthKey();
    const weekPts = { ...(data.weekPts || {}) }; weekPts[wKey] = (weekPts[wKey] || 0) + sr.total;
    const monthPts = { ...(data.monthPts || {}) }; monthPts[mKey] = (monthPts[mKey] || 0) + sr.total;
    const upd = stripUndefined({ [key]: { ...pron, scoring: sr }, points: (data.points || 0) + sr.total, weekPts, monthPts });
    if (isLatest) { upd.lastMatchId = match.id; upd.lastMatchPts = sr.total; }
    tx.update(userRef, upd);
    return { already: false, total: sr.total };
  });
}

// Exécute les tâches par paquets pour ne pas lancer des centaines de
// transactions en même temps.
async function inChunks(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...await Promise.allSettled(items.slice(i, i + size).map(fn)));
  }
  results.filter(r => r.status === "rejected").forEach(r => logger.error(r.reason));
  return results;
}

/* Match du jour terminé : crédite ceux qui ont parié, remet le streak à 0 pour
   les autres (équivalent serveur de autoCalculateAllUsers). */
async function scoreDailyMatch(match, usersSnap) {
  const key = "pronostic_" + match.id;
  let credited = 0, resets = 0;
  const results = await inChunks(usersSnap.docs, 50, async d => {
    const u = d.data();
    if (u[key]?.done) {
      const res = await scoreUserPronostic(d.id, match);
      if (res && !res.already) credited++;
      return;
    }
    // Déjà traité pour ce match : inutile de réécrire
    if (u.lastMatchId === match.id && (u.streak || 0) === 0) return;
    await d.ref.update({ lastMatchId: match.id, streak: 0 });
    resets++;
  });
  const failed = results.filter(r => r.status === "rejected").length;
  return { credited, resets, failed };
}

/* Rattrapage : pronostics terminés restés sans points (match fini pendant une
   panne, ESPN indisponible au moment du calcul, etc.). */
async function catchUpUnscored(usersSnap, skipMatchId) {
  const pending = {}; // matchId → [uid]
  const now = Date.now();
  usersSnap.forEach(d => {
    const u = d.data();
    for (const k of Object.keys(u)) {
      if (!k.startsWith("pronostic_")) continue;
      const p = u[k];
      if (!p?.done || p.scoring || !p.tipoff) continue;
      const age = now - new Date(p.tipoff).getTime();
      if (!(age > 0 && age < CATCHUP_MAX_AGE_MS)) continue;
      const matchId = k.slice("pronostic_".length);
      if (!matchId || matchId.startsWith("f") || matchId === skipMatchId) continue;
      (pending[matchId] = pending[matchId] || []).push(d.id);
    }
  });
  let credited = 0;
  for (const [matchId, uids] of Object.entries(pending)) {
    const match = await fetchFinalMatch(matchId);
    if (!match) continue; // pas encore terminé : prochain passage
    const res = await inChunks(uids, 50, uid => scoreUserPronostic(uid, match));
    credited += res.filter(r => r.status === "fulfilled" && r.value && !r.value.already).length;
  }
  return credited;
}

exports.scorePronostics = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Europe/Paris",
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "256MiB",
    retryCount: 0,
  },
  async () => {
    const stateRef = db.doc("config/scoringState");
    const state = (await stateRef.get()).data() || {};
    const daily = (await db.doc("config/dailyMatch").get()).data() || {};
    const matchId = daily.matchId ? String(daily.matchId) : null;

    let usersSnap = null;
    const loadUsers = async () => (usersSnap = usersSnap || await db.collection("users").get());

    // 1. Match du jour : une seule fois, dès qu'ESPN le donne terminé.
    //    Lecture de tous les profils uniquement à ce moment-là.
    if (matchId && !matchId.startsWith("f") && state.lastScoredMatchId !== matchId) {
      const match = await fetchFinalMatch(matchId);
      if (match) {
        const res = await scoreDailyMatch(match, await loadUsers());
        logger.info("Match du jour crédité", { matchId, ...res });
        // En cas d'échec partiel, on retentera au prochain passage
        if (res.failed === 0) await stateRef.set({ lastScoredMatchId: matchId, lastScoredAt: Date.now() }, { merge: true });
      }
    }

    // 2. Rattrapage, au plus toutes les 6 h (il relit tous les profils)
    if (!state.lastCatchUpAt || Date.now() - state.lastCatchUpAt > CATCHUP_EVERY_MS) {
      const credited = await catchUpUnscored(await loadUsers(), matchId);
      if (credited) logger.info("Rattrapage", { credited });
      await stateRef.set({ lastCatchUpAt: Date.now() }, { merge: true });
    }
  }
);
