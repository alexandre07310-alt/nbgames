/* Fonctions natives iOS/Android via Capacitor.
   Toutes sont sans effet sur le web : l'app reste identique dans un navigateur.
   Chaque appel est protégé — un plugin indisponible ne doit jamais casser l'UI. */
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { LocalNotifications } from "@capacitor/local-notifications";

export const IS_NATIVE = Capacitor.isNativePlatform();

/* ─── Retour haptique ─── */

export async function hapticTap() {
  if (!IS_NATIVE) return;
  try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (e) {}
}

/* Bonne réponse : impact franc (Heavy), nettement perceptible.
   NotificationType.Success produit un tapotement trop discret pour être remarqué. */
export async function hapticSuccess() {
  if (!IS_NATIVE) return;
  try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
}

/* Mauvaise réponse : vibration franche, impossible à confondre avec un succès. */
export async function hapticError() {
  if (!IS_NATIVE) return;
  try { await Haptics.vibrate({ duration: 250 }); }
  catch (e) { try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e2) {} }
}

/* ─── Partage ─── */

/** Feuille de partage native sur mobile, Web Share API sinon, presse-papiers en dernier recours. */
export async function shareText({ title, text, url }) {
  try {
    if (IS_NATIVE) {
      await Share.share({ title, text, url, dialogTitle: title });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch (e) {
    // L'utilisateur qui annule le partage ne doit pas voir d'erreur
    return "cancelled";
  }
}

/* ─── Notifications locales ─── */

export async function requestNotificationPermission() {
  if (!IS_NATIVE) return false;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === "granted") return true;
    const res = await LocalNotifications.requestPermissions();
    return res.display === "granted";
  } catch (e) { return false; }
}

/** Autorisation déjà accordée, sans rien demander (pour l'état initial de l'interrupteur). */
export async function notificationPermissionGranted() {
  if (!IS_NATIVE) return false;
  try { return (await LocalNotifications.checkPermissions()).display === "granted"; }
  catch (e) { return false; }
}

/* Choix de l'utilisateur dans l'app (interrupteur du profil). Par défaut : activé
   dès que le téléphone autorise les notifications. */
const NOTIF_PREF_KEY = "nbgames_notif";
export function notificationsWanted() {
  try { return localStorage.getItem(NOTIF_PREF_KEY) !== "off"; } catch (e) { return true; }
}
export function setNotificationsWanted(on) {
  try { localStorage.setItem(NOTIF_PREF_KEY, on ? "on" : "off"); } catch (e) {}
}

/* Rappel quotidien à 9h (heure de Paris) : tirage du match du soir et nouveaux
   mini-jeux. Programmé pour les 7 prochains jours à chaque ouverture de l'app
   (instants absolus, donc juste quel que soit le fuseau du téléphone). */
const DAILY_IDS = [4301, 4302, 4303, 4304, 4305, 4306, 4307];

function nextParisNineAm(dayOffset) {
  // 9h Paris = 7h ou 8h UTC selon l'heure d'été : on cherche l'heure UTC qui donne 9h à Paris.
  const base = new Date();
  for (let utcH = 6; utcH <= 9; utcH++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dayOffset, utcH, 0, 0));
    const h = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }).format(d);
    if (parseInt(h, 10) === 9) return d;
  }
  return null;
}

export async function scheduleDailyReminders() {
  if (!IS_NATIVE) return false;
  try {
    await LocalNotifications.cancel({ notifications: DAILY_IDS.map(id => ({ id })) });
    const notifications = [];
    for (let i = 0; i <= 7 && notifications.length < DAILY_IDS.length; i++) {
      const at = nextParisNineAm(i);
      if (!at || at.getTime() <= Date.now() + 60 * 1000) continue;
      notifications.push({
        id: DAILY_IDS[notifications.length],
        title: "🏀 Le match du soir est tiré !",
        body: "Pose tes 3 pronostics et joue aux mini-jeux du jour.",
        schedule: { at },
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return true;
  } catch (e) { return false; }
}

export async function cancelAllReminders() {
  if (!IS_NATIVE) return;
  try {
    await LocalNotifications.cancel({ notifications: [...DAILY_IDS, REMINDER_ID].map(id => ({ id })) });
  } catch (e) {}
}

const REMINDER_ID = 4201;

/** Programme un rappel 30 min avant la clôture des paris. Sans effet si la date est passée. */
export async function scheduleBetReminder(closeAt, matchLabel) {
  if (!IS_NATIVE || !closeAt) return false;
  try {
    const at = new Date(new Date(closeAt).getTime() - 30 * 60 * 1000);
    if (at.getTime() <= Date.now()) return false;
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: "Paris bientôt fermés !",
        body: matchLabel ? `${matchLabel} — fermeture dans 30 min` : "Fermeture dans 30 minutes",
        schedule: { at },
      }],
    });
    return true;
  } catch (e) { return false; }
}

export async function cancelBetReminder() {
  if (!IS_NATIVE) return;
  try { await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }); } catch (e) {}
}
