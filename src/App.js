import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { auth, db, storage } from "./firebase";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithCredential,
  updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  sendPasswordResetEmail, deleteUser, revokeAccessToken,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, getDocs, runTransaction,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { PARCOURS_PLAYERS, PARCOURS_LAST_SEASON } from "./parcoursData";
import { hapticTap, hapticSuccess, hapticError, shareText, requestNotificationPermission, notificationPermissionGranted, notificationsWanted, setNotificationsWanted, scheduleBetReminder, scheduleDailyReminders, cancelAllReminders } from "./native";

const IS_NATIVE = Capacitor.isNativePlatform();
const IS_IOS = Capacitor.getPlatform() === "ios";
// Connexion Apple dans l'app iOS : réactivée sur iPhone uniquement. Sur iPad (l'app
// iPhone y tourne en mode compatibilité), la feuille Apple a échoué trois fois chez
// App Review sans qu'on puisse le reproduire : l'iPad garde la connexion par e-mail,
// ce qui reste conforme (règle 4.8 : aucune connexion tierce n'est proposée sur iOS).
const APPLE_SIGNIN_IOS = true;

/* Apple exige un nonce : haché (SHA-256) dans la requête envoyée à Apple,
   brut dans le credential remis à Firebase. */
function makeNonce(len = 32) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a).map(x => chars[x % chars.length]).join("");
}
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const LANGS = [
  { code:"fr", label:"Français",  flag:"🇫🇷" },
  { code:"en", label:"English",   flag:"🇺🇸" },
  { code:"es", label:"Español",   flag:"🇪🇸" },
  { code:"pt", label:"Português", flag:"🇵🇹" },
  { code:"de", label:"Deutsch",   flag:"🇩🇪" },
  { code:"ru", label:"Русский",   flag:"🇷🇺" },
  { code:"zh", label:"中文",       flag:"🇨🇳" },
  { code:"ja", label:"日本語",      flag:"🇯🇵" },
  { code:"ar", label:"العربية",    flag:"🇸🇦" },
  { code:"hi", label:"हिन्दी",       flag:"🇮🇳" },
  { code:"it", label:"Italiano",  flag:"🇮🇹" },
];

const T = {
  fr:{appTag:"LE JEU NBA ULTIME",login:"Connexion",signup:"Inscription",connect:"SE CONNECTER",createAccount:"CRÉER MON COMPTE",loading:"Chargement...",email:"Email",password:"Mot de passe",stayConnected:"Rester connecté",forgotPwd:"Mot de passe oublié ?",reset:"Réinitialiser",or:"OU",google:"Google",apple:"Apple",welcome:"Bienvenue sur",tagline:"Le jeu NBA ultime. Pronostiquez chaque soir le match du jour, défiez vos amis et grimpez dans le classement mondial.",start:"Commencer",next:"Suivant",letsgo:"C'est parti !",skip:"Passer",betsClose:"Paris clôturés 1h avant",betsCloseDesc:"Chaque soir, un match NBA tiré au sort. Vos pronostics se ferment 1h avant le début. Les points sont attribués automatiquement après le match !",yourProfile:"Votre profil",chooseTeam:"Choisissez votre équipe NBA et votre pseudo.",save:"Sauvegarde...",pseudoPlaceholder:"Votre pseudo...",match:"Match",minigames:"Mini-Jeux",ranking:"Classement",history:"Historique",profile:"Profil",nextMatch:"Prochain match dans",nightResult:"Résultat de la nuit",sessionEnd:"SESSION TERMINÉE · FINAL",sessionPrev:"SESSION PRÉCÉDENTE",program:"Programme à venir",noMatch:"PAS DE MATCH CE SOIR",selected:"Match sélectionné",playoffs:"PLAYOFFS",betsOpen:"PARIS OUVERTS",betsWarning:"FERMETURE IMMINENTE !",betsClosed:"PARIS FERMÉS",closingAt:"Fermeture des paris à",closedAt:"Clôturés · Tip-off à",drawnAt:"Tiré au sort",tipoff:"Tip-off",live:"EN DIRECT",final:"FINAL",winner:"WINNER",inProgress:"EN COURS",vs:"vs",q1:"Question 1/4",q2:"Question 2/4",q3:"Question 3/4",q4:"Question 4/4",modify:"Modifier",cancelEdit:"← Annuler",editMode:"MODIFIER MA RÉPONSE",q1Text:"Quelle équipe remporte ce match ?",q2Text:"Quel sera le score final ?",q3Text:"Qui sera le meilleur scoreur du match ?",q4Text:"Combien de points va marquer le meilleur scoreur ?",pts:"pts",validate:"VALIDER",validateScore:"VALIDER LE SCORE",choosePlayer:"Choisir un joueur...",loadingPlayers:"Chargement des joueurs...",betsRegistered:"PRONOSTICS ENREGISTRÉS",modifyHint:"Appuyez sur une réponse pour la modifier",lockedHint:"🔒 Paris clôturés — plus de modifications possibles",waitingResult:"Les points seront attribués automatiquement après le match.",myBets:"Vainqueur",myScore:"Score",myScorer:"Meilleur scoreur",myScorerPts:"Points du scoreur",results:"RÉSULTATS !",totalWon:"Total gagné",bonusAllCorrect:"🏆 BONUS TOUT PARFAIT × 2 !",betsClosed2:"PARIS FERMÉS",betsClosedHint:"Revenez après le match !",lockedFull:"PARIS FERMÉS",comingSoon:"BIENTÔT DISPONIBLE",comingSoonDesc:"Les mini-jeux arrivent très prochainement.\nRestez connectés !",globalRanking:"CLASSEMENT GLOBAL",realtime:"Temps réel · Firebase",firstToPlay:"Soyez le premier à jouer ! 🏀",noHistory:"AUCUN HISTORIQUE",noHistoryDesc:"Vos résultats apparaîtront ici après chaque match.",matchesPlayed:"match joué",matchesPlayedP:"matchs joués",myProfile:"MON PROFIL",points:"POINTS",streak:"STREAK",rank:"RANG",settings:"Paramètres",lang:"Langue",darkMode:"Mode sombre",lightMode:"Mode clair",franchiseTheme:"Thème franchise",notifications:"Notifications",notifDesc:"Match du jour à 9h + fermeture des paris",logout:"🚪 Se déconnecter",errFill:"Veuillez remplir tous les champs.",errEmail:"Email invalide.",errPwd:"Mot de passe trop court (6 min).",errUsed:"Cet email est déjà utilisé.",errNotFound:"Aucun compte avec cet email.",errWrongPwd:"Mot de passe incorrect.",errInvalid:"Email ou mot de passe incorrect.",errTooMany:"Trop de tentatives.",errGeneric:"Une erreur est survenue.",errNetwork:"Pas de connexion internet. Vérifie ton réseau et réessaie.",guestBrowse:"Découvrir l'app sans compte",guestName:"Invité",guestSignIn:"Se connecter",guestCreate:"Créer un compte gratuit",guestCtaTitle:"Envie de jouer ?",guestCtaBet:"Crée ton compte gratuit pour pronostiquer ce match, gagner des points et entrer au classement.",guestCtaProfile:"Crée ton compte gratuit pour avoir ton profil, tes points, ton historique de pronostics et ta place au classement.",guestCtaQuiz:"Crée un compte gratuit pour ajouter ces points à ton score au classement.",guestCtaTrades:"Crée un compte gratuit pour enregistrer tes pronostics.",errPseudoTaken:"Ce pseudo est déjà utilisé.",alertClose:"Paris fermant dans 30 minutes !",alertClosing:"fermeture à",notifNewMatch:"Nouveau match NBgAmes !",notifBets:"Faites vos pronostics !",notifClosing:"Paris bientôt fermés !",notifClosingDesc:"fermeture dans 30 min !",editProfile:"Modifier le profil",editPhoto:"Changer la photo",editPseudo:"Pseudo",editEmail:"Email",editPwd:"Mot de passe",editTeam:"Équipe favorite",currentPwd:"Mot de passe actuel",newPwd:"Nouveau mot de passe",confirmPwd:"Confirmer",saveChanges:"ENREGISTRER",cancel:"Annuler",pwdMismatch:"Les mots de passe ne correspondent pas.",pwdTooShort:"Mot de passe trop court.",reauthRequired:"Entrez votre mot de passe actuel pour confirmer.",profileUpdated:"Profil mis à jour !",checkingPseudo:"Vérification...",pseudoAvailable:"✓ Pseudo disponible",pseudoTaken:"✗ Pseudo déjà pris",trendTitle:"Tendance des joueurs",trendWinner:"Pronostics vainqueur",trendScore:"Tranches de score",trendScorer:"Meilleur scoreur choisi",trendScorerPts:"Tranches de points",players:"joueurs",rankingGlobal:"🌍 Global",rankingLastMatch:"🏀 Dernier match",rankingWeek:"📆 Semaine",rankingMonth:"🗓️ Mois",noRankingData:"Aucun résultat pour cette période.",matchDetails:"Détail du match",communityBets:"Paris de la communauté",noCommunityData:"Aucun paris enregistré.",close:"Fermer",},
  en:{appTag:"THE ULTIMATE NBA GAME",login:"Login",signup:"Sign up",connect:"SIGN IN",createAccount:"CREATE ACCOUNT",loading:"Loading...",email:"Email",password:"Password",stayConnected:"Stay connected",forgotPwd:"Forgot password?",reset:"Reset",or:"OR",google:"Google",apple:"Apple",welcome:"Welcome to",tagline:"The ultimate NBA game. Predict each night's match, challenge your friends and climb the global leaderboard.",start:"Get started",next:"Next",letsgo:"Let's go!",skip:"Skip",betsClose:"Bets close 1h before",betsCloseDesc:"Every night a random NBA game is selected. Your predictions close 1 hour before tip-off. Points are awarded automatically!",yourProfile:"Your profile",chooseTeam:"Choose your NBA team and username.",save:"Saving...",pseudoPlaceholder:"Your username...",match:"Match",minigames:"Mini-Games",ranking:"Ranking",history:"History",profile:"Profile",nextMatch:"Next match in",nightResult:"Last night's result",sessionEnd:"SESSION ENDED · FINAL",sessionPrev:"PREVIOUS SESSION",program:"Tonight's games",noMatch:"NO GAME TONIGHT",selected:"Selected match",playoffs:"PLAYOFFS",betsOpen:"BETS OPEN",betsWarning:"CLOSING SOON!",betsClosed:"BETS CLOSED",closingAt:"Bets close at",closedAt:"Closed · Tip-off at",drawnAt:"Randomly selected",tipoff:"Tip-off",live:"LIVE",final:"FINAL",winner:"WINNER",inProgress:"IN PROGRESS",vs:"vs",q1:"Question 1/4",q2:"Question 2/4",q3:"Question 3/4",q4:"Question 4/4",modify:"Edit",cancelEdit:"← Cancel",editMode:"EDIT YOUR ANSWER",q1Text:"Which team wins this game?",q2Text:"What will the final score be?",q3Text:"Who will be the top scorer?",q4Text:"How many points will the top scorer get?",pts:"pts",validate:"CONFIRM",validateScore:"CONFIRM SCORE",choosePlayer:"Choose a player...",loadingPlayers:"Loading players...",betsRegistered:"BETS SAVED",modifyHint:"Tap a prediction to edit it",lockedHint:"🔒 Bets closed — no more edits",waitingResult:"Points will be awarded automatically after the game.",myBets:"Winner",myScore:"Score",myScorer:"Top scorer",myScorerPts:"Scorer points",results:"RESULTS!",totalWon:"Total earned",bonusAllCorrect:"🏆 PERFECT BONUS × 2!",betsClosed2:"BETS CLOSED",betsClosedHint:"Come back after the game!",lockedFull:"BETS CLOSED",comingSoon:"COMING SOON",comingSoonDesc:"Mini-games coming soon.\nStay tuned!",globalRanking:"GLOBAL RANKING",realtime:"Real-time · Firebase",firstToPlay:"Be the first to play! 🏀",noHistory:"NO HISTORY",noHistoryDesc:"Your results will appear here after each game.",matchesPlayed:"game played",matchesPlayedP:"games played",myProfile:"MY PROFILE",points:"POINTS",streak:"STREAK",rank:"RANK",settings:"Settings",lang:"Language",darkMode:"Dark mode",lightMode:"Light mode",franchiseTheme:"Franchise theme",notifications:"Notifications",notifDesc:"Daily match at 9am + bet closing",logout:"🚪 Sign out",errFill:"Please fill in all fields.",errEmail:"Invalid email.",errPwd:"Password too short (min 6).",errUsed:"Email already in use.",errNotFound:"No account with this email.",errWrongPwd:"Wrong password.",errInvalid:"Invalid email or password.",errTooMany:"Too many attempts.",errGeneric:"An error occurred.",errNetwork:"No internet connection. Check your network and try again.",guestBrowse:"Explore the app without an account",guestName:"Guest",guestSignIn:"Sign in",guestCreate:"Create a free account",guestCtaTitle:"Want to play?",guestCtaBet:"Create a free account to predict this match, earn points and join the leaderboard.",guestCtaProfile:"Create a free account to get your profile, points, prediction history and leaderboard rank.",guestCtaQuiz:"Create a free account to add these points to your leaderboard score.",guestCtaTrades:"Create a free account to save your predictions.",errPseudoTaken:"Username already taken.",alertClose:"Bets closing in 30 minutes!",alertClosing:"closes at",notifNewMatch:"New NBgAmes match!",notifBets:"Make your predictions!",notifClosing:"Bets closing soon!",notifClosingDesc:"closes in 30 min!",editProfile:"Edit profile",editPhoto:"Change photo",editPseudo:"Username",editEmail:"Email",editPwd:"Password",editTeam:"Favorite team",currentPwd:"Current password",newPwd:"New password",confirmPwd:"Confirm",saveChanges:"SAVE CHANGES",cancel:"Cancel",pwdMismatch:"Passwords don't match.",pwdTooShort:"Password too short.",reauthRequired:"Enter your current password to confirm.",profileUpdated:"Profile updated!",checkingPseudo:"Checking...",pseudoAvailable:"✓ Username available",pseudoTaken:"✗ Username taken",trendTitle:"Player trends",trendWinner:"Winner predictions",trendScore:"Score ranges",trendScorer:"Top scorer picks",trendScorerPts:"Points ranges",players:"players",rankingGlobal:"🌍 Global",rankingLastMatch:"🏀 Last match",rankingWeek:"📆 Week",rankingMonth:"🗓️ Month",noRankingData:"No results for this period.",matchDetails:"Match details",communityBets:"Community bets",noCommunityData:"No bets recorded.",close:"Close",},
};
function useT(lang){return T[lang]||T["en"];}

const NBA_TEAMS=[
  {abbr:"ATL",name:"Atlanta Hawks",c1:"#E03A3E",c2:"#C1D32F"},
  {abbr:"BOS",name:"Boston Celtics",c1:"#007A33",c2:"#BA9653"},
  {abbr:"BKN",name:"Brooklyn Nets",c1:"#000000",c2:"#CCCCCC"},
  {abbr:"CHA",name:"Charlotte Hornets",c1:"#1D1160",c2:"#00788C"},
  {abbr:"CHI",name:"Chicago Bulls",c1:"#CE1141",c2:"#000000"},
  {abbr:"CLE",name:"Cleveland Cavaliers",c1:"#860038",c2:"#FDBB30"},
  {abbr:"DAL",name:"Dallas Mavericks",c1:"#00538C",c2:"#B8C4CA"},
  {abbr:"DEN",name:"Denver Nuggets",c1:"#0E2240",c2:"#FEC524"},
  {abbr:"DET",name:"Detroit Pistons",c1:"#C8102E",c2:"#1D42BA"},
  {abbr:"GSW",name:"Golden State Warriors",c1:"#1D428A",c2:"#FFC72C"},
  {abbr:"HOU",name:"Houston Rockets",c1:"#CE1141",c2:"#000000"},
  {abbr:"IND",name:"Indiana Pacers",c1:"#002D62",c2:"#FDBB30"},
  {abbr:"LAC",name:"LA Clippers",c1:"#C8102E",c2:"#1D428A"},
  {abbr:"LAL",name:"Los Angeles Lakers",c1:"#552583",c2:"#FDB927"},
  {abbr:"MEM",name:"Memphis Grizzlies",c1:"#5D76A9",c2:"#12173F"},
  {abbr:"MIA",name:"Miami Heat",c1:"#98002E",c2:"#F9A01B"},
  {abbr:"MIL",name:"Milwaukee Bucks",c1:"#00471B",c2:"#EEE1C6"},
  {abbr:"MIN",name:"Minnesota Timberwolves",c1:"#0C2340",c2:"#236192"},
  {abbr:"NOP",name:"New Orleans Pelicans",c1:"#0C2340",c2:"#85714D"},
  {abbr:"NYK",name:"New York Knicks",c1:"#006BB6",c2:"#F58426"},
  {abbr:"OKC",name:"Oklahoma City Thunder",c1:"#007AC1",c2:"#EF3B24"},
  {abbr:"ORL",name:"Orlando Magic",c1:"#0077C0",c2:"#C4CED4"},
  {abbr:"PHI",name:"Philadelphia 76ers",c1:"#006BB6",c2:"#ED174C"},
  {abbr:"PHX",name:"Phoenix Suns",c1:"#1D1160",c2:"#E56020"},
  {abbr:"POR",name:"Portland Trail Blazers",c1:"#E03A3E",c2:"#000000"},
  {abbr:"SAC",name:"Sacramento Kings",c1:"#5A2D81",c2:"#63727A"},
  {abbr:"SAS",name:"San Antonio Spurs",c1:"#C4CED4",c2:"#000000"},
  {abbr:"TOR",name:"Toronto Raptors",c1:"#CE1141",c2:"#000000"},
  {abbr:"UTA",name:"Utah Jazz",c1:"#002B5C",c2:"#00471B"},
  {abbr:"WAS",name:"Washington Wizards",c1:"#002B5C",c2:"#E31837"},
];
const ESPN_TEAM_IDS={ATL:"1",BOS:"2",BKN:"17",CHA:"30",CHI:"4",CLE:"5",DAL:"6",DEN:"7",DET:"8",GSW:"9",GS:"9",HOU:"10",IND:"11",LAC:"12",LAL:"13",MEM:"29",MIA:"14",MIL:"15",MIN:"16",NOP:"3",NO:"3",NYK:"18",NY:"18",OKC:"25",ORL:"19",PHI:"20",PHX:"21",POR:"22",SAC:"23",SAS:"24",SA:"24",TOR:"28",UTA:"26",UTAH:"26",WAS:"27",WSH:"27"};
function getTeam(abbr){if(!abbr)return NBA_TEAMS[0];const map={"GS":"GSW","SA":"SAS","NO":"NOP","NY":"NYK","UTAH":"UTA","WSH":"WAS"};return NBA_TEAMS.find(t=>t.abbr===(map[abbr]||abbr))||NBA_TEAMS[0];}
function getLogoUrl(abbr){const m={"GS":"gs","SA":"sa","NO":"no","NY":"ny","UTAH":"utah","GSW":"gs","SAS":"sa","NOP":"no","NYK":"ny","UTA":"utah","WAS":"wsh"};return`https://a.espncdn.com/i/teamlogos/nba/500/${m[abbr]||abbr?.toLowerCase()}.png`;}

function buildThemeVars(dark,franchise,idx){
  const team=NBA_TEAMS[idx]||NBA_TEAMS[1];const c1=team.c1,c2=team.c2;
  if(dark&&!franchise)return{"--bg":"#07090E","--s1":"#0E1520","--s2":"#141D2B","--bdr":"#1A2640","--gold":"#F5B800","--gold2":"#FF8C00","--red":"#E8365D","--green":"#00D084","--blue":"#4A9EFF","--orange":"#FF6B35","--txt":"#EEF2F7","--muted":"#52677F","--c1":c1,"--c2":c2};
  if(!dark&&!franchise)return{"--bg":"#F0F2F7","--s1":"#FFFFFF","--s2":"#E8ECF4","--bdr":"#D0D7E8","--gold":"#D4870A","--gold2":"#E07000","--red":"#D42B50","--green":"#00A060","--blue":"#2070D0","--orange":"#E05020","--txt":"#1A2035","--muted":"#7080A0","--c1":c1,"--c2":c2};
  if(dark&&franchise)return{"--bg":"#050508","--s1":c1+"22","--s2":c1+"14","--bdr":c1+"44","--gold":c2,"--gold2":c1,"--red":"#E8365D","--green":"#00D084","--blue":"#4A9EFF","--orange":"#FF6B35","--txt":"#EEF2F7","--muted":"#8899BB","--c1":c1,"--c2":c2};
  return{"--bg":"#F5F5F8","--s1":"#FFFFFF","--s2":c1+"12","--bdr":c1+"30","--gold":c1,"--gold2":c2,"--red":"#D42B50","--green":"#00A060","--blue":"#2070D0","--orange":"#E05020","--txt":"#1A2035","--muted":"#708090","--c1":c1,"--c2":c2};
}

function Confetti({c1,c2,active}){
  const ref=useRef(null);
  useEffect(()=>{
    if(!active||!ref.current)return;
    const canvas=ref.current,ctx=canvas.getContext("2d");
    canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight;
    const pieces=Array.from({length:80},()=>({x:Math.random()*canvas.width,y:Math.random()*-canvas.height,w:Math.random()*8+4,h:Math.random()*12+6,color:Math.random()>0.5?c1:c2,r:Math.random()*360,dr:(Math.random()-0.5)*6,vy:Math.random()*3+2,vx:(Math.random()-0.5)*2}));
    let frame,opacity=1;
    function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=opacity;pieces.forEach(p=>{p.y+=p.vy;p.x+=p.vx;p.r+=p.dr;ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.rotate(p.r*Math.PI/180);ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();});if(pieces.some(p=>p.y<canvas.height)){opacity=Math.max(0,opacity-0.003);frame=requestAnimationFrame(draw);}}
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[active,c1,c2]);
  if(!active)return null;
  return <canvas ref={ref} style={{position:"fixed",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:999}}/>;
}

function TeamBadge({team,size=48,selected=false}){
  const [err,setErr]=useState(false);
  if(err)return <div style={{width:size,height:size,flexShrink:0,background:team.c1,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",border:selected?"2px solid var(--gold)":"none"}}><span style={{color:"#fff",fontSize:size*0.22,fontWeight:900}}>{team.abbr}</span></div>;
  return <div style={{width:size,height:size,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",outline:selected?"2.5px solid var(--gold)":"none",outlineOffset:"2px"}}><img src={getLogoUrl(team.abbr)} alt={team.abbr} width={size} height={size} style={{objectFit:"contain",display:"block"}} onError={()=>setErr(true)}/></div>;
}
function GoogleIcon({size=20}){return <svg width={size} height={size} viewBox="0 0 24 24" style={{flexShrink:0}}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;}
function AppleIcon({size=20,color="var(--txt)"}){return <svg width={size} height={size} viewBox="0 0 814 1000" fill={color} style={{flexShrink:0}}><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.1 135.4-316.6 269.1-316.6 70.7 0 129.5 46.4 173.1 46.4 42.8 0 109.4-49.8 188.3-49.8zm-232-206.7c35.1-41.4 65.2-105 65.2-168.7 0-8.9-.6-17.9-2.2-25.5-61.6 2.3-135 41.4-177.6 89.5-33.5 37.8-67.9 101.1-67.9 165.4 0 9.5 1.7 19 2.6 22.1 3.9.6 10.4 1.7 16.8 1.7 55.4 0 126.1-37.2 163.1-84.5z"/></svg>;}

async function requestNotifPermission(){if(!("Notification"in window))return false;if(Notification.permission==="granted")return true;return(await Notification.requestPermission())==="granted";}
function sendNotif(title,body){if(!("Notification"in window)||Notification.permission!=="granted")return;try{new Notification(title,{body,icon:"/favicon.ico"});}catch(e){}}
function getSessionDate(){const p=new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Paris"}));if(p.getHours()<9)p.setDate(p.getDate()-1);return`${p.getFullYear()}${String(p.getMonth()+1).padStart(2,"0")}${String(p.getDate()).padStart(2,"0")}`;}

function getMiniGameDate(){const p=new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Paris"}));return`${p.getFullYear()}${String(p.getMonth()+1).padStart(2,"0")}${String(p.getDate()).padStart(2,"0")}`;}
function getWeekKey(){const p=new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Paris"}));const day=p.getDay();const diff=p.getDate()-(day===0?6:day-1);const mon=new Date(p.setDate(diff));return`${mon.getFullYear()}${String(mon.getMonth()+1).padStart(2,"0")}${String(mon.getDate()).padStart(2,"0")}`;}
function getMonthKey(){const p=new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Paris"}));return`${p.getFullYear()}${String(p.getMonth()+1).padStart(2,"0")}`;}
function getWeekKeyForDate(dateStr){const p=new Date(new Date(dateStr).toLocaleString("en-US",{timeZone:"Europe/Paris"}));const day=p.getDay();const diff=p.getDate()-(day===0?6:day-1);const mon=new Date(p);mon.setDate(diff);return`${mon.getFullYear()}${String(mon.getMonth()+1).padStart(2,"0")}${String(mon.getDate()).padStart(2,"0")}`;}
function getMonthKeyForDate(dateStr){const p=new Date(new Date(dateStr).toLocaleString("en-US",{timeZone:"Europe/Paris"}));return`${p.getFullYear()}${String(p.getMonth()+1).padStart(2,"0")}`;}

async function fetchESPNGames(){
  const dateStr=getSessionDate();
  try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}&limit=30`);const j=await r.json();return{games:(j.events||[]).map(espnToMatch).filter(Boolean),sessionDate:dateStr};}
  catch(e){return{games:[],sessionDate:dateStr};}
}
function espnToMatch(event){
  try{const comp=event.competitions[0];const home=comp.competitors.find(c=>c.homeAway==="home");const away=comp.competitors.find(c=>c.homeAway==="away");if(!home||!away)return null;const isFinished=comp.status?.type?.completed===true;const isLive=comp.status?.type?.state==="in";let topScorers=[],topScorerPts=0;for(const competitor of comp.competitors){const pl=competitor.leaders?.find(l=>l.name==="points");if(pl?.leaders?.[0]){const pts=pl.leaders[0].value;const name=pl.leaders[0].athlete?.displayName||null;if(pts>topScorerPts){topScorerPts=pts;topScorers=[name];}else if(pts===topScorerPts&&pts>0&&name&&!topScorers.includes(name)){topScorers.push(name);}}}const topScorer=topScorers[0]||null;return{id:event.id,home:home.team.abbreviation,away:away.team.abbreviation,homeId:home.team.id,awayId:away.team.id,homeName:home.team.displayName,awayName:away.team.displayName,tipoff:event.date,homeScore:parseInt(home.score)||0,awayScore:parseInt(away.score)||0,isFinished,isLive,isPostseason:event.season?.type===3,topScorer:isFinished?topScorer:null,topScorerPts:isFinished?topScorerPts:null,topScorers:isFinished?topScorers:[]};}catch(e){return null;}
}
async function fetchLiveScore(espnId){
  try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`);const j=await r.json();const ev=(j.events||[]).find(e=>e.id===espnId);if(!ev)return null;return espnToMatch(ev);}catch(e){return null;}
}
async function fetchMatchResult(espnId){
  try{
    const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`);
    return parseSummaryLeaders(await r.json());
  }catch(e){return null;}
}
// Résultat définitif d'un match (score + meilleurs joueurs), via l'API summary.
// null tant que le match n'est pas terminé, ou si ESPN ne répond pas.
async function fetchFinalMatch(espnId){
  try{
    const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`);
    const j=await r.json();
    const comp=j.header?.competitions?.[0];
    if(comp?.status?.type?.completed!==true)return null;
    const home=comp.competitors?.find(c=>c.homeAway==="home"),away=comp.competitors?.find(c=>c.homeAway==="away");
    if(!home?.team||!away?.team)return null;
    const leaders=parseSummaryLeaders(j);
    if(!leaders)return null;
    return{id:espnId,home:home.team.abbreviation,away:away.team.abbreviation,homeScore:parseInt(home.score)||0,awayScore:parseInt(away.score)||0,tipoff:comp.date||"",isFinished:true,...leaders};
  }catch(e){return null;}
}
function parseSummaryLeaders(j){
  try{
    const best={PTS:0,AST:0,REB:0,BLK:0,STL:0};
    const statLeaders={PTS:null,AST:null,REB:null,BLK:null,STL:null};
    let topScorers=[],topScorerPts=0;
    for(const team of(j.boxscore?.players||[])){
      for(const stat of(team.statistics||[])){
        const lbl=stat.labels||[];
        const idx={PTS:lbl.indexOf('PTS'),AST:lbl.indexOf('AST'),REB:lbl.indexOf('REB'),BLK:lbl.indexOf('BLK'),STL:lbl.indexOf('STL')};
        for(const athlete of(stat.athletes||[])){
          const name=athlete.athlete?.displayName||null;if(!name)continue;
          const st=athlete.stats||[];
          for(const k of['PTS','AST','REB','BLK','STL']){
            if(idx[k]<0)continue;
            const v=parseInt(st[idx[k]])||0;
            if(v>best[k]){best[k]=v;statLeaders[k]={player:name,value:v};}
          }
          const pts=parseInt(st[idx.PTS])||0;
          if(pts>topScorerPts){topScorerPts=pts;topScorers=[name];}
          else if(pts===topScorerPts&&pts>0&&!topScorers.includes(name)){topScorers.push(name);}
        }
      }
    }
    return{topScorer:topScorers[0]||null,topScorerPts,topScorers,statLeaders};
  }catch(e){return null;}
}
async function fetchTeamRoster(espnTeamId){
  if(!espnTeamId)return[];
  const urls=[
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnTeamId}/roster`,
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnTeamId}?enable=roster`,
  ];
  for(let attempt=0;attempt<2;attempt++){
    for(const url of urls){
      try{
        const j=await (await fetch(url)).json();
        const list=(j.athletes||j.team?.athletes||[]).flatMap(a=>a.items?a.items:[a]).map(a=>a.displayName||a.fullName).filter(Boolean);
        if(list.length)return[...new Set(list)];
      }catch(e){}
    }
  }
  return[];
}
function seededRandom(s){let x=Math.sin(s)*10000;return x-Math.floor(x);}
function seedFromDate(s){return s.split("").reduce((a,c)=>a+c.charCodeAt(0),0);}
async function resolveFeaturedMatch(games,sessionDate){
  if(!games.length)return null;
  try{
    // Si le match du jour est déjà tiré, on le retourne directement
    const snap=await getDoc(doc(db,"config","dailyMatch"));
    const saved=snap.exists()?snap.data():null;
    if(saved?.sessionDate===sessionDate&&saved?.matchId){
      const m=games.find(g=>g.id===saved.matchId);
      if(m)return m;
      // Match introuvable dans le feed ESPN (ex: match tardif déplacé vers le scoreboard du lendemain)
      // On retourne un stub depuis Firestore pour garder le pronostic éditable
      if(saved.home&&saved.away){return{id:saved.matchId,home:saved.home,away:saved.away,homeName:saved.homeName||saved.home,awayName:saved.awayName||saved.away,tipoff:saved.tipoff||'',homeScore:0,awayScore:0,isFinished:false,isLive:false,isPostseason:false,topScorer:null,topScorerPts:null,topScorers:[]};}
    }

    // Charger l'historique des équipes récemment tirées (stocké dans Firestore)
    const histSnap=await getDoc(doc(db,"config","matchHistory"));
    const recentTeams=histSnap.exists()?(histSnap.data().recentTeams||[]):[];

    // Exclure les équipes des 5 derniers matchs (cooldown anti-répétition playoffs)
    const COOLDOWN=5;
    const recentEntries=recentTeams.slice(-COOLDOWN);
    const banned=new Set(recentEntries.flatMap(e=>e.teams||[]));

    // Candidats = matchs sans équipes bannies
    let candidates=games.filter(g=>!banned.has(g.home)&&!banned.has(g.away));

    // Fallback si tout est banni : réduire le cooldown progressivement
    if(candidates.length===0){
      for(let cooldown=COOLDOWN-1;cooldown>0;cooldown--){
        const b=new Set(recentTeams.slice(-cooldown).flatMap(e=>e.teams||[]));
        candidates=games.filter(g=>!b.has(g.home)&&!b.has(g.away));
        if(candidates.length>0)break;
      }
    }
    if(candidates.length===0)candidates=games;

    // Tirage parmi les candidats (seeded = même résultat pour tous les clients)
    const idx=Math.floor(seededRandom(seedFromDate(sessionDate))*candidates.length);
    const chosen=candidates[idx];

    // Sauvegarder le match du jour + mettre à jour l'historique (max 15 entrées)
    const newHistory=[...recentTeams,{teams:[chosen.home,chosen.away],date:sessionDate}].slice(-15);
    try{
      await setDoc(doc(db,"config","dailyMatch"),{sessionDate,matchId:chosen.id,home:chosen.home,away:chosen.away,homeName:chosen.homeName||chosen.home,awayName:chosen.awayName||chosen.away,tipoff:chosen.tipoff||'',pickedAt:serverTimestamp()});
      await setDoc(doc(db,"config","matchHistory"),{recentTeams:newHistory});
    }catch(e){}
    return chosen;
  }catch(e){return games[Math.floor(seededRandom(seedFromDate(sessionDate))*games.length)];}
}

function pad(n){return String(n).padStart(2,"0");}
function fmtCountdown(ms){if(ms<=0)return null;const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h>0?(h+"h "+pad(m)+"m"):(pad(m)+"m "+pad(sec)+"s");}
function fmtTime(d){if(!d)return"--:--";try{return new Date(d).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"});}catch(e){return"--:--";}}
function fmtDate(d){if(!d)return"";try{return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Paris"});}catch(e){return"";}}
function getLockTime(t){const d=new Date(t);d.setMinutes(d.getMinutes()-60);return d;}
function getAlertTime(t){const d=new Date(t);d.setMinutes(d.getMinutes()-90);return d;}

// Barème
function proximityPts(guess,real,exact,ranges){const diff=Math.abs(parseInt(guess)-parseInt(real));if(diff===0)return exact;for(const{d,p}of ranges){if(diff<=d)return p;}return 0;}
const SCORER_RANGES=[{d:1,p:100},{d:2,p:50},{d:3,p:30},{d:4,p:20},{d:5,p:10}];
const SCORE_RANGES=[{d:1,p:100},{d:2,p:50},{d:3,p:30},{d:4,p:20},{d:5,p:10}];
const STAT_TYPES=[
  {key:'PTS',label:'Meilleur scoreur',emoji:'🏀',unit:'points'},
  {key:'AST',label:'Meilleur passeur',emoji:'🎯',unit:'passes'},
  {key:'REB',label:'Meilleur rebondeur',emoji:'💪',unit:'rebonds'},
  {key:'BLK',label:'Meilleur contreur',emoji:'🛡️',unit:'contres'},
  {key:'STL',label:'Meilleur intercepteur',emoji:'⚡',unit:'interceptions'},
];
function getStatForDate(dateStr){const n=parseInt((dateStr||'20250101').replace(/-/g,''))||0;return STAT_TYPES[n%5];}
function computePronosticScore(pronostics,match,t){
  // Ancien format (legacy)
  if(pronostics.scorer!==undefined||pronostics.homeScore!==undefined){
    if(pronostics.scoring)return pronostics.scoring;
    // Pas encore scoré — calcul avec l'ancien algorithme
    const{w,homeScore:hG,awayScore:aG,scorer,scorerPts:spG}=pronostics;
    const realWinnerL=match.homeScore>match.awayScore?match.home:match.away;
    const bdL=[];let totL=0;
    const wOkL=w===realWinnerL,wPtsL=wOkL?50:0;
    bdL.push({label:t.myBets,guess:w,real:realWinnerL,pts:wPtsL,ok:wOkL});totL+=wPtsL;
    const hOkL=parseInt(hG)===match.homeScore,aOkL=parseInt(aG)===match.awayScore;
    let sPtsL=0;
    if(hOkL&&aOkL)sPtsL=500;
    else if(hOkL||aOkL){sPtsL=200;if(!hOkL)sPtsL+=proximityPts(hG,match.homeScore,0,SCORE_RANGES);if(!aOkL)sPtsL+=proximityPts(aG,match.awayScore,0,SCORE_RANGES);}
    else sPtsL=proximityPts(hG,match.homeScore,0,SCORE_RANGES)+proximityPts(aG,match.awayScore,0,SCORE_RANGES);
    bdL.push({label:t.myScore,guess:`${hG}-${aG}`,real:`${match.homeScore}-${match.awayScore}`,pts:sPtsL,ok:sPtsL>0});totL+=sPtsL;
    const topArr=match.topScorers?.length>0?match.topScorers:(match.topScorer?[match.topScorer]:[]);
    const scrOkL=scorer&&topArr.includes(scorer),scrPtsL=scrOkL?100:0;
    bdL.push({label:t.myScorer,guess:scorer,real:topArr.join(' / ')||'N/A',pts:scrPtsL,ok:scrOkL});totL+=scrPtsL;
    const spPtsL=proximityPts(spG,match.topScorerPts||0,200,SCORER_RANGES);
    bdL.push({label:t.myScorerPts,guess:spG,real:match.topScorerPts||'N/A',pts:spPtsL,ok:spPtsL>0});totL+=spPtsL;
    const apL=wOkL&&hOkL&&aOkL&&scrOkL&&parseInt(spG)===(match.topScorerPts||0);
    if(apL)totL*=2;
    return{breakdown:bdL,total:totL,allPerfect:apL};
  }
  const{w,statKey,statPlayer,statVal}=pronostics;
  const statDef=STAT_TYPES.find(s=>s.key===statKey)||STAT_TYPES[0];
  const realWinner=match.homeScore>match.awayScore?match.home:match.away;
  const breakdown=[];let total=0;
  // 1. Vainqueur — 10 pts
  const wOk=w===realWinner;const wPts=wOk?10:0;
  breakdown.push({label:'Vainqueur',guess:w,real:realWinner,pts:wPts,ok:wOk});total+=wPts;
  // 2. Joueur (stat leader) — 20 pts
  const leader=match.statLeaders?.[statKey];
  const playerOk=!!leader&&statPlayer===leader.player;const playerPts=playerOk?20:0;
  breakdown.push({label:statDef.label,guess:statPlayer,real:leader?.player||'N/A',pts:playerPts,ok:playerOk});total+=playerPts;
  // 3. Nombre — 30 pts
  const valOk=!!leader&&parseInt(statVal)===leader.value;const valPts=valOk?30:0;
  breakdown.push({label:`Nb de ${statDef.unit}`,guess:statVal,real:leader?.value??'N/A',pts:valPts,ok:valOk});total+=valPts;
  // Bonus ×2 si tout juste
  const allPerfect=wOk&&playerOk&&valOk;
  if(allPerfect)total*=2;
  return{breakdown,total,allPerfect};
}

async function autoCalculateAllUsers(match,t){
  try{
    // Récupère les données complètes (summary API) pour une détection précise des égalités
    let enrichedMatch=match;
    if(match.id&&!match.id.startsWith("f")){
      const result=await fetchMatchResult(match.id);
      if(result)enrichedMatch={...match,...result};
    }
    const usersSnap=await getDocs(collection(db,"users"));
    const key="pronostic_"+enrichedMatch.id;
    await Promise.allSettled(usersSnap.docs.map(userDoc=>{
      // L'utilisateur n'a pas parié sur ce match → streak reset
      if(!userDoc.data()[key]?.done)return updateDoc(doc(db,"users",userDoc.id),{lastMatchId:enrichedMatch.id,streak:0});
      return scoreUserPronostic(userDoc.id,enrichedMatch,t);
    }));
  }catch(e){console.error(e);}
}

/* Crédite UN pronostic terminé, dans une transaction Firestore. Plusieurs
   chemins calculent les points (le joueur lui-même, le premier client qui voit
   le match fini, le rattrapage) : grâce à la transaction, le second à passer
   voit `scoring` déjà posé et n'ajoute rien — pas de double comptage.
   Renvoie { sr, already, data } (data = document à jour) ou null sans pari. */
async function scoreUserPronostic(uid,match,t){
  const userRef=doc(db,"users",uid);const key="pronostic_"+match.id;
  return runTransaction(db,async tx=>{
    const snap=await tx.get(userRef);if(!snap.exists())return null;
    const data=snap.data();const pron=data[key];
    if(!pron?.done)return null;
    const tipoff=pron.tipoff||match.tipoff||null;
    // « Dernier match » : ne jamais revenir à un match plus ancien que celui enregistré
    const prev=data.lastMatchId&&data.lastMatchId!==match.id?data["pronostic_"+data.lastMatchId]:null;
    const isLatest=!prev?.tipoff||!tipoff||new Date(tipoff).getTime()>=new Date(prev.tipoff).getTime();
    if(pron.scoring){
      if(isLatest&&data.lastMatchId!==match.id){
        const upd={lastMatchId:match.id,lastMatchPts:pron.scoring.total||0};
        tx.update(userRef,upd);return{sr:pron.scoring,already:true,data:{...data,...upd}};
      }
      return{sr:pron.scoring,already:true,data};
    }
    const sr=computePronosticScore(pron,match,t);
    // Semaine / mois du match (et non du calcul) : un rattrapage tardif tombe au bon endroit
    const wKey=tipoff?getWeekKeyForDate(tipoff):getWeekKey();
    const mKey=tipoff?getMonthKeyForDate(tipoff):getMonthKey();
    const weekPts={...(data.weekPts||{})};weekPts[wKey]=(weekPts[wKey]||0)+sr.total;
    const monthPts={...(data.monthPts||{})};monthPts[mKey]=(monthPts[mKey]||0)+sr.total;
    const upd=stripUndefined({[key]:{...pron,scoring:sr},points:(data.points||0)+sr.total,weekPts,monthPts});
    if(isLatest){upd.lastMatchId=match.id;upd.lastMatchPts=sr.total;}
    tx.update(userRef,upd);
    return{sr,already:false,data:{...data,...upd}};
  });
}

/* Rattrapage : crédite les pronostics terminés restés sans points.
   Le calcul « en direct » n'a lieu que si quelqu'un a l'app ouverte entre la
   fin du match et le tirage du suivant (9h) ; sinon le pari restait à 0 pour
   toujours. Lancé à l'ouverture de l'app : le premier joueur qui se connecte
   crédite tout le monde. Limité aux matchs récents, pour ne pas reverser des
   points d'une saison déjà clôturée. */
const CATCHUP_MAX_AGE_MS=4*24*3600*1000;
async function catchUpUnscoredPronostics(t){
  const usersSnap=await getDocs(collection(db,"users"));
  const pending={}; // matchId → [uid]
  const now=Date.now();
  usersSnap.forEach(d=>{
    const u=d.data();
    for(const k of Object.keys(u)){
      if(!k.startsWith("pronostic_"))continue;
      const p=u[k];
      if(!p?.done||p.scoring||!p.tipoff)continue;
      const age=now-new Date(p.tipoff).getTime();
      if(!(age>0&&age<CATCHUP_MAX_AGE_MS))continue;
      const matchId=k.slice("pronostic_".length);
      if(!matchId||matchId.startsWith("f"))continue;
      (pending[matchId]=pending[matchId]||[]).push(d.id);
    }
  });
  let credited=0;
  for(const[matchId,uids]of Object.entries(pending)){
    const match=await fetchFinalMatch(matchId);
    if(!match)continue; // pas encore terminé : on réessaiera à la prochaine ouverture
    const res=await Promise.allSettled(uids.map(uid=>scoreUserPronostic(uid,match,t)));
    credited+=res.filter(r=>r.status==="fulfilled"&&r.value&&!r.value.already).length;
  }
  return credited;
}

/* ─── Clôture de saison ───
   Archive le classement final dans `seasonArchives/{id}` puis remet à zéro
   UNIQUEMENT les compteurs de score. L'historique des paris (pronostic_*),
   les mini-jeux quotidiens et les pronostics Trades sont conservés. */
async function archiveSeason(seasonName){
  const usersSnap=await getDocs(collection(db,"users"));
  const ranking=[];
  usersSnap.forEach(d=>{
    const u=d.data();
    if(!u.username)return;
    ranking.push({
      uid:d.id,
      username:u.username,
      teamIdx:u.teamIdx??1,
      points:u.points||0,
      streak:u.streak||0,
    });
  });
  ranking.sort((a,b)=>(b.points||0)-(a.points||0));
  ranking.forEach((r,i)=>{r.rank=i+1;});
  const name=seasonName.trim();
  const id=name.replace(/[^a-zA-Z0-9_-]/g,"_")||String(Date.now());
  await setDoc(doc(db,"seasonArchives",id),{
    name,endedAt:Date.now(),playerCount:ranking.length,ranking,
  });
  return{id,name,ranking};
}

async function resetSeasonScores(){
  const usersSnap=await getDocs(collection(db,"users"));
  await Promise.all(usersSnap.docs.map(d=>updateDoc(doc(db,"users",d.id),{
    points:0,streak:0,weekPts:{},monthPts:{},lastMatchPts:0,
  })));
  return usersSnap.size;
}

async function fetchSeasonArchives(){
  const snap=await getDocs(collection(db,"seasonArchives"));
  const rows=[];
  snap.forEach(d=>rows.push({id:d.id,...d.data()}));
  rows.sort((a,b)=>(b.endedAt||0)-(a.endedAt||0));
  return rows;
}

function stripUndefined(obj){
  // Firestore refuse les valeurs undefined — on les nettoie récursivement
  if(Array.isArray(obj))return obj.map(stripUndefined);
  if(obj&&typeof obj==="object"){const r={};for(const k of Object.keys(obj)){if(obj[k]!==undefined)r[k]=stripUndefined(obj[k]);}return r;}
  return obj;
}
async function recalculateAllPastMatches(t,onProgress){
  try{
    const usersSnap=await getDocs(collection(db,"users"));
    // Collect all unique match IDs from all users' scored pronostics
    const matchIds=new Set();
    for(const userDoc of usersSnap.docs){
      const data=userDoc.data();
      Object.keys(data).filter(k=>k.startsWith("pronostic_")&&data[k]?.scoring&&data[k]?.done).forEach(k=>matchIds.add(k.replace("pronostic_","")));
    }
    // Fetch match results (summary API, plus précise) pour chaque match
    const matchCache={};
    let mi=0;
    for(const matchId of matchIds){
      mi++;if(onProgress)onProgress(`Récupération match ${mi}/${matchIds.size}…`);
      if(!matchId||matchId.startsWith("f"))continue;
      try{
        const result=await fetchMatchResult(matchId);
        if(result){
          matchCache[matchId]={
            topScorer:result.topScorer||null,
            topScorerPts:result.topScorerPts||0,
            topScorers:(result.topScorers||[result.topScorer]).filter(Boolean),
            statLeaders:result.statLeaders||null,
          };
        }
      }catch(e){}
    }
    // Re-score all users
    let totalCorrected=0;
    const allUpdates=[];
    for(const userDoc of usersSnap.docs){
      const userData=userDoc.data();
      const pronKeys=Object.keys(userData).filter(k=>k.startsWith("pronostic_")&&userData[k]?.scoring&&userData[k]?.done);
      if(!pronKeys.length)continue;
      let ptsDelta=0;
      const weekPtsNew={...(userData.weekPts||{})};
      const monthPtsNew={...(userData.monthPts||{})};
      const docUpdates={};
      let lastMatchPtsNew=typeof userData.lastMatchPts==="number"?userData.lastMatchPts:0;
      let lastMatchIdNew=userData.lastMatchId||null;
      let lastMatchTipoff=null;
      for(const key of pronKeys){
        const pron=userData[key];
        if(!pron?.scoring)continue;
        const matchId=key.replace("pronostic_","");
        const matchResult=matchCache[matchId];
        if(!matchResult)continue;
        // Détecter le match le plus récent par tipoff
        const tipoffVal=pron.tipoff||null;
        if(tipoffVal&&(!lastMatchTipoff||tipoffVal>lastMatchTipoff)){
          lastMatchTipoff=tipoffVal;lastMatchIdNew=matchId;
        }
        // Reconstruit le match depuis le breakdown stocké
        const bd=pron.scoring.breakdown||[];
        const isNewFormat=pron.statKey!==undefined;
        let homeScore,awayScore,fallbackScorerPts=0;
        if(isNewFormat){
          // Nouveau format : bd[0].real = équipe gagnante
          const realWinnerTeam=bd[0]?.real||'';
          homeScore=(pron.home===realWinnerTeam)?1:0;
          awayScore=(pron.away===realWinnerTeam)?1:0;
        }else{
          const realScore=(bd[1]?.real||"0-0").split("-");
          homeScore=parseInt(realScore[0])||0;
          awayScore=parseInt(realScore[1])||0;
          fallbackScorerPts=parseInt(bd[3]?.real)||0;
        }
        const matchObj={
          id:matchId,
          home:pron.home||"",
          away:pron.away||"",
          homeScore,awayScore,
          topScorer:matchResult.topScorer,
          topScorerPts:matchResult.topScorerPts||fallbackScorerPts,
          topScorers:matchResult.topScorers,
          statLeaders:matchResult.statLeaders||null,
        };
        const oldTotal=pron.scoring.total||0;
        const newSr=computePronosticScore(pron,matchObj,t);
        const delta=newSr.total-oldTotal;
        // Mise à jour si les points changent OU si le real du scoreur a changé (égalité)
        const oldScorerReal=(pron.scoring.breakdown?.[2]?.real)||"";
        const newScorerReal=newSr.breakdown?.[2]?.real||"";
        const scorerChanged=oldScorerReal!==newScorerReal;
        if(delta===0&&!scorerChanged)continue;
        const tipoff=pron.tipoff||null;
        const wKey=tipoff?getWeekKeyForDate(tipoff):getWeekKey();
        const mKey=tipoff?getMonthKeyForDate(tipoff):getMonthKey();
        if(delta!==0){
          ptsDelta+=delta;
          weekPtsNew[wKey]=(weekPtsNew[wKey]||0)+delta;
          monthPtsNew[mKey]=(monthPtsNew[mKey]||0)+delta;
          if(matchId===lastMatchIdNew)lastMatchPtsNew=Math.max(0,lastMatchPtsNew+delta);
        }
        docUpdates[key]=stripUndefined({...pron,scoring:newSr});
        totalCorrected++;
      }
      // Toujours écrire lastMatchId si on a pu le déterminer (même sans changement de score)
      const hasChanges=Object.keys(docUpdates).length>0;
      const needsIdUpdate=lastMatchIdNew&&lastMatchIdNew!==userData.lastMatchId;
      if(hasChanges||needsIdUpdate){
        const newPts=hasChanges?Math.max(0,(userData.points||0)+ptsDelta):(userData.points||0);
        const payload=stripUndefined({...docUpdates,points:newPts,weekPts:weekPtsNew,monthPts:monthPtsNew,lastMatchPts:lastMatchPtsNew,lastMatchId:lastMatchIdNew});
        allUpdates.push(updateDoc(doc(db,"users",userDoc.id),payload));
      }
    }
    if(onProgress)onProgress(`Mise à jour de ${allUpdates.length} joueur(s)…`);
    await Promise.all(allUpdates);
    return{ok:true,corrected:totalCorrected};
  }catch(e){console.error(e);return{ok:false,error:e.message};}
}

async function checkUsernameAvailable(username,currentUserId=null){const snap=await getDoc(doc(db,"usernames",username.toLowerCase()));if(!snap.exists())return true;return snap.data().uid===currentUserId;}
async function reserveUsername(username,uid){await setDoc(doc(db,"usernames",username.toLowerCase()),{uid,username});}
async function releaseUsername(username){try{await deleteDoc(doc(db,"usernames",username.toLowerCase()));}catch(e){}}

// Tendances
function useTrend(matchId){
  const [trends,setTrends]=useState({winner:{},homeScore:{},awayScore:{},scorer:{},scorerPts:{}});
  useEffect(()=>{
    if(!matchId)return;
    const key="pronostic_"+matchId;
    const q2=query(collection(db,"users"),limit(200));
    const unsub=onSnapshot(q2,snap=>{
      const winner={},homeScore={},awayScore={},scorer={},scorerPts={};
      snap.docs.forEach(d=>{
        const p=d.data()[key];if(!p)return;
        if(p.w)winner[p.w]=(winner[p.w]||0)+1;
        if(p.homeScore!=null){const b=Math.floor(parseInt(p.homeScore)/10)*10;homeScore[b]=(homeScore[b]||0)+1;}
        if(p.awayScore!=null){const b=Math.floor(parseInt(p.awayScore)/10)*10;awayScore[b]=(awayScore[b]||0)+1;}
        const pl=p.statPlayer||p.scorer;if(pl)scorer[pl]=(scorer[pl]||0)+1;
        const sv=p.statVal??p.scorerPts;if(sv!=null){const b=Math.floor(parseInt(sv)/10)*10;scorerPts[b]=(scorerPts[b]||0)+1;}
      });
      setTrends({winner,homeScore,awayScore,scorer,scorerPts});
    });
    return()=>unsub();
  },[matchId]);
  return trends;
}

function TrendBar({label,pct,color="#F5B800"}){
  return(
    <div style={{marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
        <span style={{color:"var(--muted)"}}>{label}</span>
        <span style={{fontWeight:700,color}}>{pct}%</span>
      </div>
      <div style={{height:5,background:"var(--bdr)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:color,borderRadius:3,transition:"width .4s"}}/>
      </div>
    </div>
  );
}

function TrendWinner({trends,home,away,t}){
  const total=(trends.winner[home]||0)+(trends.winner[away]||0);
  if(total===0)return<div style={{fontSize:11,color:"var(--muted)",textAlign:"center",padding:"8px 0"}}>{t.players}: 0</div>;
  const ph=Math.round(((trends.winner[home]||0)/total)*100);
  const pa=100-ph;
  return(
    <div>
      <div style={{fontSize:10,color:"var(--muted)",marginBottom:6,textAlign:"right"}}>{total} {t.players}</div>
      <TrendBar label={home} pct={ph} color="var(--blue)"/>
      <TrendBar label={away} pct={pa} color="var(--orange)"/>
    </div>
  );
}

function TrendScoreBuckets({data,teamName,t}){
  const total=Object.values(data).reduce((a,b)=>a+b,0);
  if(total===0)return<div style={{fontSize:11,color:"var(--muted)",padding:"4px 0"}}>{t.players}: 0</div>;
  const sorted=Object.entries(data).sort((a,b)=>parseInt(a[0])-parseInt(b[0]));
  return(
    <div>
      <div style={{fontSize:10,color:"var(--muted)",marginBottom:4}}>{teamName} — {total} {t.players}</div>
      {sorted.map(([b,cnt])=>{
        const pct=Math.round((cnt/total)*100);
        return<TrendBar key={b} label={parseInt(b)+"-"+(parseInt(b)+9)} pct={pct} color="var(--blue)"/>;
      })}
    </div>
  );
}

function TrendScorer({data,t}){
  const total=Object.values(data).reduce((a,b)=>a+b,0);
  if(total===0)return<div style={{fontSize:11,color:"var(--muted)",textAlign:"center",padding:"8px 0"}}>{t.players}: 0</div>;
  const sorted=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return(
    <div>
      <div style={{fontSize:10,color:"var(--muted)",marginBottom:6,textAlign:"right"}}>{total} {t.players}</div>
      {sorted.map(([name,cnt])=>{
        const pct=Math.round((cnt/total)*100);
        return<TrendBar key={name} label={name} pct={pct} color="var(--green)"/>;
      })}
    </div>
  );
}

function TrendScorerPts({data,t}){
  const total=Object.values(data).reduce((a,b)=>a+b,0);
  if(total===0)return<div style={{fontSize:11,color:"var(--muted)",padding:"4px 0"}}>{t.players}: 0</div>;
  const sorted=Object.entries(data).sort((a,b)=>parseInt(a[0])-parseInt(b[0]));
  return(
    <div>
      <div style={{fontSize:10,color:"var(--muted)",marginBottom:4}}>{total} {t.players}</div>
      {sorted.map(([b,cnt])=>{
        const pct=Math.round((cnt/total)*100);
        const lo=parseInt(b),hi=lo===40?"+40":lo+"-"+(lo+9);
        return<TrendBar key={b} label={hi} pct={pct} color="var(--gold)"/>;
      })}
    </div>
  );
}

function TrendSection({matchId,match,step,t}){
  const trends=useTrend(matchId);
  if(!matchId||!match)return null;
  return(
    <div style={{background:"color-mix(in srgb,var(--gold) 5%,var(--s2))",border:"1px solid var(--gold)",borderRadius:"12px 12px 0 0",padding:"12px 14px",marginBottom:12,margin:"-0px -18px 12px -18px"}}>
      <div style={{fontSize:10,color:"var(--gold)",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>📊 {t.trendTitle}</div>
      {step===0&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:8}}>{t.trendWinner}</div>
          <TrendWinner trends={trends} home={match.home} away={match.away} t={t}/>
        </div>
      )}
      {step===1&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:8}}>{t.trendScore}</div>
          <TrendScoreBuckets data={trends.homeScore} teamName={match.home} t={t}/>
          <div style={{height:8}}/>
          <TrendScoreBuckets data={trends.awayScore} teamName={match.away} t={t}/>
        </div>
      )}
      {step===2&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:8}}>{t.trendScorer}</div>
          <TrendScorer data={trends.scorer} t={t}/>
        </div>
      )}
      {step===3&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:8}}>{t.trendScorerPts}</div>
          <TrendScorerPts data={trends.scorerPts} t={t}/>
        </div>
      )}
    </div>
  );
}

/* ─── Culture NBA ─── */
const NBA_CULTURE_DB=[
  // ─── CHAMPION ───
  {q:'Champion NBA 2024 ?',a:'Boston Celtics',cat:'champion',opts:['Dallas Mavericks','Minnesota Timberwolves','Indiana Pacers','Boston Celtics']},
  {q:'Champion NBA 2023 ?',a:'Denver Nuggets',cat:'champion',opts:['Miami Heat','Boston Celtics','Denver Nuggets','Golden State Warriors']},
  {q:'Champion NBA 2022 ?',a:'Golden State Warriors',cat:'champion',opts:['Boston Celtics','Memphis Grizzlies','Golden State Warriors','Miami Heat']},
  {q:'Champion NBA 2021 ?',a:'Milwaukee Bucks',cat:'champion',opts:['Phoenix Suns','Milwaukee Bucks','LA Clippers','Atlanta Hawks']},
  {q:'Champion NBA 2020 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Miami Heat','Boston Celtics','Los Angeles Lakers','Toronto Raptors']},
  {q:'Champion NBA 2019 ?',a:'Toronto Raptors',cat:'champion',opts:['Golden State Warriors','Toronto Raptors','Houston Rockets','Milwaukee Bucks']},
  {q:'Champion NBA 2018 ?',a:'Golden State Warriors',cat:'champion',opts:['Cleveland Cavaliers','Houston Rockets','Boston Celtics','Golden State Warriors']},
  {q:'Champion NBA 2017 ?',a:'Golden State Warriors',cat:'champion',opts:['Cleveland Cavaliers','San Antonio Spurs','Houston Rockets','Golden State Warriors']},
  {q:'Champion NBA 2016 ?',a:'Cleveland Cavaliers',cat:'champion',opts:['Golden State Warriors','Cleveland Cavaliers','San Antonio Spurs','Oklahoma City Thunder']},
  {q:'Champion NBA 2015 ?',a:'Golden State Warriors',cat:'champion',opts:['Cleveland Cavaliers','San Antonio Spurs','Houston Rockets','Golden State Warriors']},
  {q:'Champion NBA 2014 ?',a:'San Antonio Spurs',cat:'champion',opts:['Miami Heat','Oklahoma City Thunder','San Antonio Spurs','Indiana Pacers']},
  {q:'Champion NBA 2013 ?',a:'Miami Heat',cat:'champion',opts:['San Antonio Spurs','Indiana Pacers','Miami Heat','Chicago Bulls']},
  {q:'Champion NBA 2012 ?',a:'Miami Heat',cat:'champion',opts:['Oklahoma City Thunder','Indiana Pacers','Miami Heat','Boston Celtics']},
  {q:'Champion NBA 2011 ?',a:'Dallas Mavericks',cat:'champion',opts:['Miami Heat','Chicago Bulls','Dallas Mavericks','Oklahoma City Thunder']},
  {q:'Champion NBA 2010 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Boston Celtics','Phoenix Suns','Los Angeles Lakers','Orlando Magic']},
  {q:'Champion NBA 2009 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Orlando Magic','Denver Nuggets','Los Angeles Lakers','Cleveland Cavaliers']},
  {q:'Champion NBA 2008 ?',a:'Boston Celtics',cat:'champion',opts:['Los Angeles Lakers','Detroit Pistons','Boston Celtics','Cleveland Cavaliers']},
  {q:'Champion NBA 2007 ?',a:'San Antonio Spurs',cat:'champion',opts:['Cleveland Cavaliers','Detroit Pistons','Phoenix Suns','San Antonio Spurs']},
  {q:'Champion NBA 2006 ?',a:'Miami Heat',cat:'champion',opts:['Dallas Mavericks','Cleveland Cavaliers','Miami Heat','Detroit Pistons']},
  {q:'Champion NBA 2005 ?',a:'San Antonio Spurs',cat:'champion',opts:['Detroit Pistons','Miami Heat','Phoenix Suns','San Antonio Spurs']},
  {q:'Champion NBA 2004 ?',a:'Detroit Pistons',cat:'champion',opts:['Los Angeles Lakers','Indiana Pacers','New Jersey Nets','Detroit Pistons']},
  {q:'Champion NBA 2003 ?',a:'San Antonio Spurs',cat:'champion',opts:['New Jersey Nets','Dallas Mavericks','Sacramento Kings','San Antonio Spurs']},
  {q:'Champion NBA 2002 ?',a:'Los Angeles Lakers',cat:'champion',opts:['New Jersey Nets','Sacramento Kings','Los Angeles Lakers','Philadelphia 76ers']},
  {q:'Champion NBA 2001 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Philadelphia 76ers','Portland Trail Blazers','Los Angeles Lakers','Sacramento Kings']},
  {q:'Champion NBA 2000 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Indiana Pacers','Portland Trail Blazers','Los Angeles Lakers','Utah Jazz']},
  {q:'Champion NBA 1999 ?',a:'San Antonio Spurs',cat:'champion',opts:['New York Knicks','Portland Trail Blazers','Utah Jazz','San Antonio Spurs']},
  {q:'Champion NBA 1998 ?',a:'Chicago Bulls',cat:'champion',opts:['Utah Jazz','Indiana Pacers','New York Knicks','Chicago Bulls']},
  {q:'Champion NBA 1997 ?',a:'Chicago Bulls',cat:'champion',opts:['Utah Jazz','Seattle SuperSonics','Houston Rockets','Chicago Bulls']},
  {q:'Champion NBA 1996 ?',a:'Chicago Bulls',cat:'champion',opts:['Seattle SuperSonics','Utah Jazz','Orlando Magic','Chicago Bulls']},
  {q:'Champion NBA 1995 ?',a:'Houston Rockets',cat:'champion',opts:['Orlando Magic','Phoenix Suns','Houston Rockets','San Antonio Spurs']},
  {q:'Champion NBA 1994 ?',a:'Houston Rockets',cat:'champion',opts:['New York Knicks','Utah Jazz','Seattle SuperSonics','Houston Rockets']},
  {q:'Champion NBA 1993 ?',a:'Chicago Bulls',cat:'champion',opts:['Phoenix Suns','New York Knicks','Cleveland Cavaliers','Chicago Bulls']},
  {q:'Champion NBA 1992 ?',a:'Chicago Bulls',cat:'champion',opts:['Portland Trail Blazers','Cleveland Cavaliers','Utah Jazz','Chicago Bulls']},
  {q:'Champion NBA 1991 ?',a:'Chicago Bulls',cat:'champion',opts:['Los Angeles Lakers','Portland Trail Blazers','Boston Celtics','Chicago Bulls']},
  {q:'Champion NBA 1990 ?',a:'Detroit Pistons',cat:'champion',opts:['Portland Trail Blazers','Phoenix Suns','Boston Celtics','Detroit Pistons']},
  {q:'Champion NBA 1989 ?',a:'Detroit Pistons',cat:'champion',opts:['Los Angeles Lakers','Boston Celtics','Chicago Bulls','Detroit Pistons']},
  {q:'Champion NBA 1988 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Detroit Pistons','Boston Celtics','Dallas Mavericks','Los Angeles Lakers']},
  {q:'Champion NBA 1987 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Boston Celtics','Seattle SuperSonics','Houston Rockets','Los Angeles Lakers']},
  {q:'Champion NBA 1986 ?',a:'Boston Celtics',cat:'champion',opts:['Houston Rockets','Milwaukee Bucks','Los Angeles Lakers','Boston Celtics']},
  {q:'Champion NBA 1985 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Boston Celtics','Denver Nuggets','Houston Rockets','Los Angeles Lakers']},
  {q:'Champion NBA 1984 ?',a:'Boston Celtics',cat:'champion',opts:['Los Angeles Lakers','Milwaukee Bucks','Philadelphia 76ers','Boston Celtics']},
  // ─── MVP ───
  {q:'MVP NBA 2025 ?',a:'Shai Gilgeous-Alexander',cat:'mvp',opts:['Nikola Jokić','Giannis Antetokounmpo','Jayson Tatum','Shai Gilgeous-Alexander']},
  {q:'MVP NBA 2024 ?',a:'Nikola Jokić',cat:'mvp',opts:['Luka Dončić','Shai Gilgeous-Alexander','Nikola Jokić','Giannis Antetokounmpo']},
  {q:'MVP NBA 2023 ?',a:'Joel Embiid',cat:'mvp',opts:['Nikola Jokić','Giannis Antetokounmpo','Joel Embiid','Jayson Tatum']},
  {q:'MVP NBA 2022 ?',a:'Nikola Jokić',cat:'mvp',opts:['Stephen Curry','Kevin Durant','Devin Booker','Nikola Jokić']},
  {q:'MVP NBA 2021 ?',a:'Nikola Jokić',cat:'mvp',opts:['LeBron James','Stephen Curry','Luka Dončić','Nikola Jokić']},
  {q:'MVP NBA 2020 ?',a:'Giannis Antetokounmpo',cat:'mvp',opts:['LeBron James','James Harden','Luka Dončić','Giannis Antetokounmpo']},
  {q:'MVP NBA 2019 ?',a:'Giannis Antetokounmpo',cat:'mvp',opts:['James Harden','Kevin Durant','Stephen Curry','Giannis Antetokounmpo']},
  {q:'MVP NBA 2018 ?',a:'James Harden',cat:'mvp',opts:['LeBron James','Anthony Davis','Paul George','James Harden']},
  {q:'MVP NBA 2017 ?',a:'Russell Westbrook',cat:'mvp',opts:['James Harden','LeBron James','Kawhi Leonard','Russell Westbrook']},
  {q:'MVP NBA 2016 ?',a:'Stephen Curry',cat:'mvp',opts:['LeBron James','Russell Westbrook','Kawhi Leonard','Stephen Curry']},
  {q:'MVP NBA 2015 ?',a:'Stephen Curry',cat:'mvp',opts:['LeBron James','James Harden','Marc Gasol','Stephen Curry']},
  {q:'MVP NBA 2014 ?',a:'Kevin Durant',cat:'mvp',opts:['LeBron James','Blake Griffin','Joakim Noah','Kevin Durant']},
  {q:'MVP NBA 2013 ?',a:'LeBron James',cat:'mvp',opts:['Kevin Durant','Chris Paul','Carmelo Anthony','LeBron James']},
  {q:'MVP NBA 2012 ?',a:'LeBron James',cat:'mvp',opts:['Kevin Durant','Kobe Bryant','Chris Paul','LeBron James']},
  {q:'MVP NBA 2011 ?',a:'Derrick Rose',cat:'mvp',opts:['LeBron James','Dwight Howard','Kobe Bryant','Derrick Rose']},
  {q:'MVP NBA 2010 ?',a:'LeBron James',cat:'mvp',opts:['Kobe Bryant','Carmelo Anthony','Dwyane Wade','LeBron James']},
  {q:'MVP NBA 2009 ?',a:'LeBron James',cat:'mvp',opts:['Kobe Bryant','Dwight Howard','Dwyane Wade','LeBron James']},
  {q:'MVP NBA 2008 ?',a:'Kobe Bryant',cat:'mvp',opts:['LeBron James','Chris Paul','Dwight Howard','Kobe Bryant']},
  {q:'MVP NBA 2007 ?',a:'Dirk Nowitzki',cat:'mvp',opts:['Steve Nash','LeBron James','Kobe Bryant','Dirk Nowitzki']},
  {q:'MVP NBA 2006 ?',a:'Steve Nash',cat:'mvp',opts:['LeBron James','Dirk Nowitzki','Kobe Bryant','Steve Nash']},
  {q:'MVP NBA 2005 ?',a:'Steve Nash',cat:'mvp',opts:['Dirk Nowitzki','LeBron James','Shaquille O\'Neal','Steve Nash']},
  {q:'MVP NBA 2004 ?',a:'Kevin Garnett',cat:'mvp',opts:['Shaquille O\'Neal','Tim Duncan','Kobe Bryant','Kevin Garnett']},
  {q:'MVP NBA 2003 ?',a:'Tim Duncan',cat:'mvp',opts:['Kobe Bryant','Kevin Garnett','Dirk Nowitzki','Tim Duncan']},
  {q:'MVP NBA 2002 ?',a:'Tim Duncan',cat:'mvp',opts:['Shaquille O\'Neal','Kobe Bryant','Jason Kidd','Tim Duncan']},
  {q:'MVP NBA 2001 ?',a:'Allen Iverson',cat:'mvp',opts:['Shaquille O\'Neal','Kobe Bryant','Tim Duncan','Allen Iverson']},
  {q:'MVP NBA 2000 ?',a:'Shaquille O\'Neal',cat:'mvp',opts:['Allen Iverson','Kobe Bryant','Tim Duncan','Shaquille O\'Neal']},
  {q:'MVP NBA 1998 ?',a:'Michael Jordan',cat:'mvp',opts:['Shaquille O\'Neal','Karl Malone','Gary Payton','Michael Jordan']},
  {q:'MVP NBA 1997 ?',a:'Karl Malone',cat:'mvp',opts:['Michael Jordan','Shaquille O\'Neal','Patrick Ewing','Karl Malone']},
  {q:'MVP NBA 1996 ?',a:'Michael Jordan',cat:'mvp',opts:['Shaquille O\'Neal','David Robinson','Hakeem Olajuwon','Michael Jordan']},
  {q:'MVP NBA 1993 ?',a:'Charles Barkley',cat:'mvp',opts:['Michael Jordan','Patrick Ewing','Hakeem Olajuwon','Charles Barkley']},
  {q:'MVP NBA 1992 ?',a:'Michael Jordan',cat:'mvp',opts:['Clyde Drexler','Patrick Ewing','Magic Johnson','Michael Jordan']},
  {q:'MVP NBA 1988 ?',a:'Michael Jordan',cat:'mvp',opts:['Magic Johnson','Larry Bird','Charles Barkley','Michael Jordan']},
  {q:'MVP NBA 1987 ?',a:'Magic Johnson',cat:'mvp',opts:['Larry Bird','Michael Jordan','Kareem Abdul-Jabbar','Magic Johnson']},
  {q:'MVP NBA 1986 ?',a:'Larry Bird',cat:'mvp',opts:['Magic Johnson','Kareem Abdul-Jabbar','Michael Jordan','Larry Bird']},
  {q:'MVP NBA 1985 ?',a:'Larry Bird',cat:'mvp',opts:['Magic Johnson','Moses Malone','Kareem Abdul-Jabbar','Larry Bird']},
  // ─── MVP FINALES ───
  {q:'MVP des Finales 2024 ?',a:'Jaylen Brown',cat:'finals_mvp',opts:['Jayson Tatum','Jrue Holiday','Al Horford','Jaylen Brown']},
  {q:'MVP des Finales 2023 ?',a:'Nikola Jokić',cat:'finals_mvp',opts:['Jamal Murray','Michael Porter Jr.','Aaron Gordon','Nikola Jokić']},
  {q:'MVP des Finales 2022 ?',a:'Stephen Curry',cat:'finals_mvp',opts:['Klay Thompson','Jordan Poole','Draymond Green','Stephen Curry']},
  {q:'MVP des Finales 2021 ?',a:'Giannis Antetokounmpo',cat:'finals_mvp',opts:['Khris Middleton','Jrue Holiday','Bobby Portis','Giannis Antetokounmpo']},
  {q:'MVP des Finales 2020 ?',a:'LeBron James',cat:'finals_mvp',opts:['Anthony Davis','Rajon Rondo','Danny Green','LeBron James']},
  {q:'MVP des Finales 2019 ?',a:'Kawhi Leonard',cat:'finals_mvp',opts:['Pascal Siakam','Kyle Lowry','Fred VanVleet','Kawhi Leonard']},
  {q:'MVP des Finales 2018 ?',a:'Kevin Durant',cat:'finals_mvp',opts:['Stephen Curry','Klay Thompson','LeBron James','Kevin Durant']},
  {q:'MVP des Finales 2017 ?',a:'Kevin Durant',cat:'finals_mvp',opts:['Stephen Curry','Klay Thompson','Draymond Green','Kevin Durant']},
  {q:'MVP des Finales 2016 ?',a:'LeBron James',cat:'finals_mvp',opts:['Kyrie Irving','Kevin Love','J.R. Smith','LeBron James']},
  {q:'MVP des Finales 2015 ?',a:'Andre Iguodala',cat:'finals_mvp',opts:['Stephen Curry','Klay Thompson','Draymond Green','Andre Iguodala']},
  {q:'MVP des Finales 2014 ?',a:'Kawhi Leonard',cat:'finals_mvp',opts:['Tim Duncan','Tony Parker','Manu Ginobili','Kawhi Leonard']},
  {q:'MVP des Finales 2013 ?',a:'LeBron James',cat:'finals_mvp',opts:['Dwyane Wade','Chris Bosh','Ray Allen','LeBron James']},
  {q:'MVP des Finales 2012 ?',a:'LeBron James',cat:'finals_mvp',opts:['Dwyane Wade','Chris Bosh','Mario Chalmers','LeBron James']},
  {q:'MVP des Finales 2011 ?',a:'Dirk Nowitzki',cat:'finals_mvp',opts:['Jason Kidd','Jason Terry','Tyson Chandler','Dirk Nowitzki']},
  {q:'MVP des Finales 2010 ?',a:'Kobe Bryant',cat:'finals_mvp',opts:['Pau Gasol','Lamar Odom','Ron Artest','Kobe Bryant']},
  {q:'MVP des Finales 2009 ?',a:'Kobe Bryant',cat:'finals_mvp',opts:['Pau Gasol','Lamar Odom','Derek Fisher','Kobe Bryant']},
  {q:'MVP des Finales 2008 ?',a:'Paul Pierce',cat:'finals_mvp',opts:['Kevin Garnett','Ray Allen','Rajon Rondo','Paul Pierce']},
  {q:'MVP des Finales 2007 ?',a:'Tony Parker',cat:'finals_mvp',opts:['Tim Duncan','Manu Ginobili','Bruce Bowen','Tony Parker']},
  {q:'MVP des Finales 2006 ?',a:'Dwyane Wade',cat:'finals_mvp',opts:['Shaquille O\'Neal','Alonzo Mourning','Jason Williams','Dwyane Wade']},
  {q:'MVP des Finales 2005 ?',a:'Tim Duncan',cat:'finals_mvp',opts:['Tony Parker','Manu Ginobili','Brent Barry','Tim Duncan']},
  {q:'MVP des Finales 2004 ?',a:'Chauncey Billups',cat:'finals_mvp',opts:['Richard Hamilton','Ben Wallace','Rasheed Wallace','Chauncey Billups']},
  {q:'MVP des Finales 2003 ?',a:'Tim Duncan',cat:'finals_mvp',opts:['Tony Parker','Manu Ginobili','Stephen Jackson','Tim Duncan']},
  {q:'MVP des Finales 2000 ?',a:'Shaquille O\'Neal',cat:'finals_mvp',opts:['Kobe Bryant','Glen Rice','Robert Horry','Shaquille O\'Neal']},
  {q:'MVP des Finales 1999 ?',a:'Tim Duncan',cat:'finals_mvp',opts:['David Robinson','Avery Johnson','Mario Elie','Tim Duncan']},
  {q:'MVP des Finales 1998 ?',a:'Michael Jordan',cat:'finals_mvp',opts:['Scottie Pippen','Dennis Rodman','Toni Kukoč','Michael Jordan']},
  {q:'MVP des Finales 1997 ?',a:'Michael Jordan',cat:'finals_mvp',opts:['Scottie Pippen','Dennis Rodman','Karl Malone','Michael Jordan']},
  {q:'MVP des Finales 1996 ?',a:'Michael Jordan',cat:'finals_mvp',opts:['Scottie Pippen','Dennis Rodman','Gary Payton','Michael Jordan']},
  {q:'MVP des Finales 1993 ?',a:'Michael Jordan',cat:'finals_mvp',opts:['Scottie Pippen','Charles Barkley','Kevin Johnson','Michael Jordan']},
  {q:'MVP des Finales 1992 ?',a:'Michael Jordan',cat:'finals_mvp',opts:['Scottie Pippen','Clyde Drexler','Terry Porter','Michael Jordan']},
  {q:'MVP des Finales 1991 ?',a:'Michael Jordan',cat:'finals_mvp',opts:['Scottie Pippen','Magic Johnson','James Worthy','Michael Jordan']},
  {q:'MVP des Finales 1990 ?',a:'Isiah Thomas',cat:'finals_mvp',opts:['Joe Dumars','Dennis Rodman','Bill Laimbeer','Isiah Thomas']},
  {q:'MVP des Finales 1989 ?',a:'Joe Dumars',cat:'finals_mvp',opts:['Isiah Thomas','Dennis Rodman','James Edwards','Joe Dumars']},
  {q:'MVP des Finales 1988 ?',a:'James Worthy',cat:'finals_mvp',opts:['Magic Johnson','Kareem Abdul-Jabbar','Byron Scott','James Worthy']},
  {q:'MVP des Finales 1987 ?',a:'Magic Johnson',cat:'finals_mvp',opts:['Kareem Abdul-Jabbar','James Worthy','Larry Bird','Magic Johnson']},
  // ─── DRAFT ───
  {q:'1er choix draft 2023 ?',a:'Victor Wembanyama',cat:'draft',opts:['Scoot Henderson','Brandon Miller','Amen Thompson','Victor Wembanyama']},
  {q:'1er choix draft 2024 ?',a:'Zaccharie Risacher',cat:'draft',opts:['Alexandre Sarr','Reed Sheppard','Stephon Castle','Zaccharie Risacher']},
  {q:'1er choix draft 2022 ?',a:'Paolo Banchero',cat:'draft',opts:['Chet Holmgren','Jabari Smith Jr.','Jaden Ivey','Paolo Banchero']},
  {q:'1er choix draft 2021 ?',a:'Cade Cunningham',cat:'draft',opts:['Jalen Green','Evan Mobley','Scottie Barnes','Cade Cunningham']},
  {q:'1er choix draft 2020 ?',a:'Anthony Edwards',cat:'draft',opts:['LaMelo Ball','James Wiseman','Isaac Okoro','Anthony Edwards']},
  {q:'1er choix draft 2019 ?',a:'Zion Williamson',cat:'draft',opts:['Ja Morant','RJ Barrett','De\'Aaron Fox','Zion Williamson']},
  {q:'1er choix draft 2018 ?',a:'Deandre Ayton',cat:'draft',opts:['Marvin Bagley III','Luka Dončić','Jaren Jackson Jr.','Deandre Ayton']},
  {q:'1er choix draft 2017 ?',a:'Markelle Fultz',cat:'draft',opts:['Lonzo Ball','De\'Aaron Fox','Josh Jackson','Markelle Fultz']},
  {q:'1er choix draft 2016 ?',a:'Ben Simmons',cat:'draft',opts:['Brandon Ingram','Kris Dunn','Jaylen Brown','Ben Simmons']},
  {q:'1er choix draft 2015 ?',a:'Karl-Anthony Towns',cat:'draft',opts:['D\'Angelo Russell','Jahlil Okafor','Kristaps Porzingis','Karl-Anthony Towns']},
  {q:'1er choix draft 2014 ?',a:'Andrew Wiggins',cat:'draft',opts:['Jabari Parker','Joel Embiid','Marcus Smart','Andrew Wiggins']},
  {q:'1er choix draft 2012 ?',a:'Anthony Davis',cat:'draft',opts:['Michael Kidd-Gilchrist','Bradley Beal','Damian Lillard','Anthony Davis']},
  {q:'1er choix draft 2011 ?',a:'Kyrie Irving',cat:'draft',opts:['Derrick Williams','Enes Kanter','Tristan Thompson','Kyrie Irving']},
  {q:'1er choix draft 2010 ?',a:'John Wall',cat:'draft',opts:['Evan Turner','Derrick Favors','Wesley Johnson','John Wall']},
  {q:'1er choix draft 2009 ?',a:'Blake Griffin',cat:'draft',opts:['Hasheem Thabeet','James Harden','Stephen Curry','Blake Griffin']},
  {q:'1er choix draft 2008 ?',a:'Derrick Rose',cat:'draft',opts:['Michael Beasley','Kevin Love','Russell Westbrook','Derrick Rose']},
  {q:'1er choix draft 2007 ?',a:'Greg Oden',cat:'draft',opts:['Kevin Durant','Al Horford','Mike Conley Jr.','Greg Oden']},
  {q:'1er choix draft 2003 ?',a:'LeBron James',cat:'draft',opts:['Carmelo Anthony','Dwyane Wade','Chris Bosh','LeBron James']},
  {q:'1er choix draft 2004 ?',a:'Dwight Howard',cat:'draft',opts:['Emeka Okafor','Ben Gordon','Shaun Livingston','Dwight Howard']},
  {q:'À quel rang Kobe Bryant a-t-il été drafté en 1996 ?',a:'13e choix',cat:'draft',opts:['1er choix','8e choix','13e choix','17e choix']},
  {q:'À quel rang Stephen Curry a-t-il été drafté en 2009 ?',a:'7e choix',cat:'draft',opts:['3e choix','7e choix','10e choix','15e choix']},
  {q:'À quel rang Draymond Green a-t-il été drafté ?',a:'35e choix',cat:'draft',opts:['12e choix','22e choix','35e choix','48e choix']},
  {q:'À quel rang Giannis Antetokounmpo a-t-il été drafté ?',a:'15e choix',cat:'draft',opts:['1er choix','6e choix','15e choix','28e choix']},
  {q:'Par quelle équipe LeBron James a-t-il été drafté en 2003 ?',a:'Cleveland Cavaliers',cat:'draft',opts:['Miami Heat','Los Angeles Lakers','Orlando Magic','Cleveland Cavaliers']},
  {q:'Quelle équipe a drafté Kevin Durant en 2007 ?',a:'Seattle SuperSonics',cat:'draft',opts:['Portland Trail Blazers','Boston Celtics','Minnesota Timberwolves','Seattle SuperSonics']},
  // ─── SCOREUR ───
  {q:'Meilleur scoreur de carrière de l\'histoire NBA ?',a:'LeBron James',cat:'scoring',opts:['Kareem Abdul-Jabbar','Karl Malone','Kobe Bryant','LeBron James']},
  {q:'Record de points en un match (1962) ?',a:'Wilt Chamberlain (100 pts)',cat:'scoring',opts:['Michael Jordan (69 pts)','Kobe Bryant (81 pts)','Devin Booker (70 pts)','Wilt Chamberlain (100 pts)']},
  {q:'Quel joueur a scoré 81 points en un match (2006) ?',a:'Kobe Bryant',cat:'scoring',opts:['LeBron James','Allen Iverson','Tracy McGrady','Kobe Bryant']},
  {q:'Quel joueur a scoré 73 points en un match (2019) ?',a:'Devin Booker',cat:'scoring',opts:['James Harden','Donovan Mitchell','Trae Young','Devin Booker']},
  {q:'Meilleur scoreur de la saison 2024-25 ?',a:'Shai Gilgeous-Alexander',cat:'scoring',opts:['Jayson Tatum','LeBron James','Nikola Jokić','Shai Gilgeous-Alexander']},
  {q:'Meilleur scoreur de la saison 2023-24 ?',a:'Luka Dončić',cat:'scoring',opts:['Jayson Tatum','Kevin Durant','Shai Gilgeous-Alexander','Luka Dončić']},
  {q:'Meilleur scoreur de la saison 2021-22 ?',a:'Joel Embiid',cat:'scoring',opts:['Giannis Antetokounmpo','Trae Young','LeBron James','Joel Embiid']},
  {q:'Meilleur scoreur de la saison 2019-20 ?',a:'James Harden',cat:'scoring',opts:['Giannis Antetokounmpo','Bradley Beal','Damian Lillard','James Harden']},
  {q:'Meilleur scoreur de la saison 2017-18 ?',a:'James Harden',cat:'scoring',opts:['LeBron James','Stephen Curry','Kevin Durant','James Harden']},
  {q:'Quel joueur a scoré 69 points dans un match en 1990 ?',a:'Michael Jordan',cat:'scoring',opts:['Dominique Wilkins','Karl Malone','Charles Barkley','Michael Jordan']},
  {q:'Qui détient le record de points en playoffs en carrière ?',a:'LeBron James',cat:'scoring',opts:['Michael Jordan','Kareem Abdul-Jabbar','Kobe Bryant','LeBron James']},
  {q:'Moyenne de Michael Jordan en carrière en saison régulière ?',a:'30.1 pts/match',cat:'scoring',opts:['27.5 pts/match','28.7 pts/match','30.1 pts/match','32.3 pts/match']},
  // ─── RECORD ───
  {q:'Record de victoires en saison régulière ?',a:'73 victoires (Warriors 2015-16)',cat:'record',opts:['72 victoires (Bulls 1995-96)','70 victoires (Spurs 2015-16)','73 victoires (Warriors 2015-16)','69 victoires (Lakers 1971-72)']},
  {q:'Qui détient le record de passes en carrière ?',a:'John Stockton',cat:'record',opts:['Magic Johnson','Jason Kidd','Chris Paul','John Stockton']},
  {q:'Qui détient le record de steals en carrière ?',a:'John Stockton',cat:'record',opts:['Michael Jordan','Gary Payton','Jason Kidd','John Stockton']},
  {q:'Qui détient le record de blocks en carrière ?',a:'Hakeem Olajuwon',cat:'record',opts:['Kareem Abdul-Jabbar','Dikembe Mutombo','David Robinson','Hakeem Olajuwon']},
  {q:'Combien de titres les Boston Celtics ont-ils remportés (record all-time) ?',a:'17 titres',cat:'record',opts:['16 titres','17 titres','18 titres','15 titres']},
  {q:'Quel est le record de triple-doubles en une saison ?',a:'42 (Russell Westbrook 2016-17)',cat:'record',opts:['38 (Oscar Robertson)','42 (Russell Westbrook 2016-17)','36 (Magic Johnson)','40 (James Harden)']},
  {q:'Qui a le record de 3 points réussis en carrière ?',a:'Stephen Curry',cat:'record',opts:['Ray Allen','Reggie Miller','James Harden','Stephen Curry']},
  {q:'Qui détient le record de rebonds en carrière ?',a:'Wilt Chamberlain',cat:'record',opts:['Bill Russell','Dennis Rodman','Kareem Abdul-Jabbar','Wilt Chamberlain']},
  {q:'Plus longue série de victoires consécutives en NBA ?',a:'33 (Los Angeles Lakers 1971-72)',cat:'record',opts:['27 (Golden State Warriors)','33 (Los Angeles Lakers 1971-72)','29 (Chicago Bulls)','25 (San Antonio Spurs)']},
  {q:'Quel joueur a le record de 50 points ou + en un match le plus souvent ?',a:'Wilt Chamberlain',cat:'record',opts:['Michael Jordan','Kobe Bryant','LeBron James','Wilt Chamberlain']},
  {q:'Record de 3 points réussis en un match ?',a:'14 (Klay Thompson, 2018)',cat:'record',opts:['12 (Stephen Curry)','14 (Klay Thompson, 2018)','13 (Donyell Marshall)','11 (Dennis Scott)']},
  {q:'Quel joueur a le record de points en un match de playoffs ?',a:'Michael Jordan (63 pts, 1986)',cat:'record',opts:['LeBron James (51 pts)','Kobe Bryant (55 pts)','Kevin Durant (49 pts)','Michael Jordan (63 pts, 1986)']},
  // ─── ROOKIE ───
  {q:'Rookie de l\'année 2024 ?',a:'Victor Wembanyama',cat:'roty',opts:['Chet Holmgren','Brandon Miller','Scoot Henderson','Victor Wembanyama']},
  {q:'Rookie de l\'année 2023 ?',a:'Paolo Banchero',cat:'roty',opts:['Keegan Murray','Bennedict Mathurin','Jalen Williams','Paolo Banchero']},
  {q:'Rookie de l\'année 2022 ?',a:'Scottie Barnes',cat:'roty',opts:['Cade Cunningham','Evan Mobley','Josh Giddey','Scottie Barnes']},
  {q:'Rookie de l\'année 2021 ?',a:'LaMelo Ball',cat:'roty',opts:['Anthony Edwards','James Wiseman','Patrick Williams','LaMelo Ball']},
  {q:'Rookie de l\'année 2020 ?',a:'Ja Morant',cat:'roty',opts:['Zion Williamson','RJ Barrett','Darius Garland','Ja Morant']},
  {q:'Rookie de l\'année 2019 ?',a:'Luka Dončić',cat:'roty',opts:['Trae Young','Deandre Ayton','Marvin Bagley III','Luka Dončić']},
  {q:'Rookie de l\'année 2018 ?',a:'Ben Simmons',cat:'roty',opts:['Jayson Tatum','De\'Aaron Fox','Kyle Kuzma','Ben Simmons']},
  {q:'Rookie de l\'année 2017 ?',a:'Malcolm Brogdon',cat:'roty',opts:['Jaylen Brown','Brandon Ingram','Buddy Hield','Malcolm Brogdon']},
  {q:'Rookie de l\'année 2016 ?',a:'Karl-Anthony Towns',cat:'roty',opts:['D\'Angelo Russell','Kristaps Porzingis','Jahlil Okafor','Karl-Anthony Towns']},
  {q:'Rookie de l\'année 2012 ?',a:'Kyrie Irving',cat:'roty',opts:['Ricky Rubio','Klay Thompson','Kenneth Faried','Kyrie Irving']},
  {q:'Rookie de l\'année 2010 ?',a:'Tyreke Evans',cat:'roty',opts:['Stephen Curry','Brandon Jennings','DeJuan Blair','Tyreke Evans']},
  {q:'Rookie de l\'année 2009 ?',a:'Derrick Rose',cat:'roty',opts:['OJ Mayo','Brook Lopez','Kevin Love','Derrick Rose']},
  {q:'Rookie de l\'année 2004 ?',a:'LeBron James',cat:'roty',opts:['Carmelo Anthony','Dwyane Wade','Chris Bosh','LeBron James']},
  {q:'Rookie de l\'année 2003 ?',a:'Amar\'e Stoudemire',cat:'roty',opts:['Yao Ming','Caron Butler','Carlos Boozer','Amar\'e Stoudemire']},
  // ─── DPOY ───
  {q:'DPOY 2025 ?',a:'Evan Mobley',cat:'dpoy',opts:['Rudy Gobert','Evan Mobley','Dyson Daniels','Victor Wembanyama']},
  {q:'DPOY 2024 ?',a:'Rudy Gobert',cat:'dpoy',opts:['Bam Adebayo','Brook Lopez','Jaren Jackson Jr.','Rudy Gobert']},
  {q:'DPOY 2023 ?',a:'Jaren Jackson Jr.',cat:'dpoy',opts:['Draymond Green','Rudy Gobert','Brook Lopez','Jaren Jackson Jr.']},
  {q:'DPOY 2022 ?',a:'Marcus Smart',cat:'dpoy',opts:['Rudy Gobert','Mikal Bridges','Draymond Green','Marcus Smart']},
  {q:'DPOY 2021 ?',a:'Rudy Gobert',cat:'dpoy',opts:['Draymond Green','Ben Simmons','Anthony Davis','Rudy Gobert']},
  {q:'DPOY 2020 ?',a:'Giannis Antetokounmpo',cat:'dpoy',opts:['Rudy Gobert','Anthony Davis','Ben Simmons','Giannis Antetokounmpo']},
  {q:'DPOY 2019 ?',a:'Rudy Gobert',cat:'dpoy',opts:['Paul George','Kawhi Leonard','Myles Turner','Rudy Gobert']},
  {q:'DPOY 2018 ?',a:'Rudy Gobert',cat:'dpoy',opts:['Draymond Green','Anthony Davis','Paul George','Rudy Gobert']},
  {q:'DPOY 2017 ?',a:'Draymond Green',cat:'dpoy',opts:['Kawhi Leonard','Rudy Gobert','Paul Millsap','Draymond Green']},
  {q:'DPOY 2016 ?',a:'Kawhi Leonard',cat:'dpoy',opts:['Draymond Green','Rudy Gobert','DeAndre Jordan','Kawhi Leonard']},
  {q:'DPOY 2015 ?',a:'Kawhi Leonard',cat:'dpoy',opts:['Draymond Green','Marc Gasol','DeAndre Jordan','Kawhi Leonard']},
  {q:'DPOY 2014 ?',a:'Joakim Noah',cat:'dpoy',opts:['Roy Hibbert','Marc Gasol','Paul George','Joakim Noah']},
  {q:'DPOY 2013 ?',a:'Marc Gasol',cat:'dpoy',opts:['Joakim Noah','Roy Hibbert','Serge Ibaka','Marc Gasol']},
  {q:'DPOY 2009 ?',a:'Dwight Howard',cat:'dpoy',opts:['Kevin Garnett','Ben Wallace','Tim Duncan','Dwight Howard']},
  // ─── COACH ───
  {q:'Quel coach a le plus de titres NBA (11) ?',a:'Phil Jackson',cat:'coach',opts:['Gregg Popovich','Pat Riley','Larry Brown','Phil Jackson']},
  {q:'Quel coach a mené les Warriors à 4 titres (2015-2022) ?',a:'Steve Kerr',cat:'coach',opts:['Mark Jackson','Alvin Gentry','Luke Walton','Steve Kerr']},
  {q:'Quel coach a mené les Bucks au titre 2021 ?',a:'Mike Budenholzer',cat:'coach',opts:['Jason Kidd','Terry Stotts','Nate McMillan','Mike Budenholzer']},
  {q:'Quel coach a mené les Raptors au titre 2019 ?',a:'Nick Nurse',cat:'coach',opts:['Dwane Casey','Larry Drew','Lloyd Pierce','Nick Nurse']},
  {q:'Quel coach a le plus de victoires en carrière ?',a:'Don Nelson',cat:'coach',opts:['Gregg Popovich','Phil Jackson','Lenny Wilkens','Don Nelson']},
  {q:'Quel coach a mené les Bulls à 6 titres avec Michael Jordan ?',a:'Phil Jackson',cat:'coach',opts:['Doug Collins','Larry Brown','Jerry Sloan','Phil Jackson']},
  {q:'Quel coach a mené les Spurs à 5 titres ?',a:'Gregg Popovich',cat:'coach',opts:['Larry Brown','Doc Rivers','Jerry Sloan','Gregg Popovich']},
  {q:'Quel coach a mené les Lakers à 5 titres avec Shaq et Kobe ?',a:'Phil Jackson',cat:'coach',opts:['Pat Riley','Kurt Rambis','Mike D\'Antoni','Phil Jackson']},
  {q:'Quel coach a mené les Celtics au titre 2024 ?',a:'Joe Mazzulla',cat:'coach',opts:['Brad Stevens','Ime Udoka','Larry Brown','Joe Mazzulla']},
  {q:'Quel coach a mené les Nuggets au titre 2023 ?',a:'Michael Malone',cat:'coach',opts:['George Karl','Brian Shaw','Arturas Karnisovas','Michael Malone']},
  // ─── SURNOM ───
  {q:'Surnom de LeBron James ?',a:'The King',cat:'surnom',opts:['The Chosen One','Black Mamba','The Answer','The King']},
  {q:'Surnom de Kobe Bryant ?',a:'Black Mamba',cat:'surnom',opts:['The King','The Answer','Black Mamba','The Mailman']},
  {q:'Surnom de Kevin Durant ?',a:'Slim Reaper',cat:'surnom',opts:['KD Snake','The Servant','Slim Reaper','The Beard']},
  {q:'Surnom de James Harden ?',a:'The Beard',cat:'surnom',opts:['The Chef','Slim Reaper','The Beard','The Process']},
  {q:'Surnom de Joel Embiid ?',a:'The Process',cat:'surnom',opts:['The Big Fundamental','The Beard','The Process','The King']},
  {q:'Surnom de Giannis Antetokounmpo ?',a:'Greek Freak',cat:'surnom',opts:['The Big Fundamental','Greek Freak','The Answer','The Chosen One']},
  {q:'Surnom de Stephen Curry ?',a:'Chef Curry',cat:'surnom',opts:['Chef Curry','Slim Reaper','The Process','Baby-Faced Assassin']},
  {q:'Surnom de Tim Duncan ?',a:'The Big Fundamental',cat:'surnom',opts:['The Mailman','The Big Fundamental','The Answer','Spiderman']},
  {q:'Surnom de Allen Iverson ?',a:'The Answer',cat:'surnom',opts:['AI','The King','The Answer','The Truth']},
  {q:'Surnom de Paul Pierce ?',a:'The Truth',cat:'surnom',opts:['The Answer','The Truth','The Process','Black Mamba']},
  {q:'Surnom de Victor Wembanyama ?',a:'Wemby',cat:'surnom',opts:['The Alien','Spiderman','Wemby','The Giant']},
  {q:'Surnom de Shaquille O\'Neal ?',a:'The Diesel / Superman',cat:'surnom',opts:['The Big Show','The Diesel / Superman','Big O','The Giant']},
  {q:'Surnom de Karl Malone ?',a:'The Mailman',cat:'surnom',opts:['The Big Fundamental','The Mailman','The Postman','The Worker']},
  {q:'Surnom de Hakeem Olajuwon ?',a:'The Dream',cat:'surnom',opts:['The Shot','The Dream','Big H','The Sleep']},
  {q:'Surnom de David Robinson ?',a:'The Admiral',cat:'surnom',opts:['The Captain','The General','The Sailor','The Admiral']},
  {q:'Surnom de Charles Barkley ?',a:'Sir Charles',cat:'surnom',opts:['Round Mound','Sir Charles','The Chuckster','Big Chuck']},
  {q:'Surnom de Magic Johnson ?',a:'Magic',cat:'surnom',opts:['Showtime','Magic','The Magician','EJ']},
  {q:'Surnom de Julius Erving ?',a:'Dr. J',cat:'surnom',opts:['The Doctor','Dr. J','The Artist','Sir Julius']},
  {q:'Surnom de Wilt Chamberlain ?',a:'The Big Dipper',cat:'surnom',opts:['The Giant','Wilt the Stilt','The Big Dipper','The Dominator']},
  {q:'Surnom de Vince Carter ?',a:'Half-Man Half-Amazing',cat:'surnom',opts:['Air Canada','Vinsanity','Half-Man Half-Amazing','The Dunkmaster']},
  {q:'Surnom de Tracy McGrady ?',a:'T-Mac',cat:'surnom',opts:['The Machine','T-Mac','Mac Attack','Thriller']},
  {q:'Surnom de Dominique Wilkins ?',a:'The Human Highlight Film',cat:'surnom',opts:['The Dunker','Nique','The Human Highlight Film','The Atlanta Hawk']},
  {q:'Surnom de Damian Lillard ?',a:'Dame Time',cat:'surnom',opts:['The Clock','Dame Time','Blazer Baller','The Sheriff']},
  {q:'Surnom de Kawhi Leonard ?',a:'The Klaw',cat:'surnom',opts:['The Quiet One','Stone Face','The Klaw','The Robot']},
  {q:'Surnom de Dennis Rodman ?',a:'The Worm',cat:'surnom',opts:['The Rebounder','The Worm','Bad Boy','The Tattoo']},
  // ─── PAYS ───
  {q:'Nationalité de Giannis Antetokounmpo ?',a:'Grèce',cat:'pays',opts:['Nigeria','Cameroun','Grèce','Sénégal']},
  {q:'Nationalité de Luka Dončić ?',a:'Slovénie',cat:'pays',opts:['Croatie','Serbie','Slovénie','Bosnie']},
  {q:'Nationalité de Nikola Jokić ?',a:'Serbie',cat:'pays',opts:['Croatie','Slovénie','Bosnie','Serbie']},
  {q:'Nationalité de Victor Wembanyama ?',a:'France',cat:'pays',opts:['Belgique','Espagne','Suisse','France']},
  {q:'Nationalité de Rudy Gobert ?',a:'France',cat:'pays',opts:['Espagne','Belgique','France','Suisse']},
  {q:'Nationalité de Joel Embiid ?',a:'Cameroun',cat:'pays',opts:['Nigeria','Sénégal','Côte d\'Ivoire','Cameroun']},
  {q:'Nationalité de Dirk Nowitzki ?',a:'Allemagne',cat:'pays',opts:['Autriche','Pays-Bas','Suisse','Allemagne']},
  {q:'Nationalité de Pau Gasol ?',a:'Espagne',cat:'pays',opts:['Argentine','Brésil','France','Espagne']},
  {q:'Nationalité de Tony Parker ?',a:'France',cat:'pays',opts:['Belgique','Suisse','Canada','France']},
  {q:'Nationalité de Steve Nash ?',a:'Canada',cat:'pays',opts:['Australie','Afrique du Sud','États-Unis','Canada']},
  {q:'Nationalité de Manu Ginobili ?',a:'Argentine',cat:'pays',opts:['Brésil','Uruguay','Chili','Argentine']},
  {q:'Nationalité de Yao Ming ?',a:'Chine',cat:'pays',opts:['Japon','Corée du Sud','Taïwan','Chine']},
  {q:'Nationalité de Peja Stojaković ?',a:'Serbie',cat:'pays',opts:['Croatie','Slovénie','Bosnie','Serbie']},
  {q:'Nationalité de Hakeem Olajuwon ?',a:'Nigeria',cat:'pays',opts:['Ghana','Cameroun','Sénégal','Nigeria']},
  {q:'Nationalité de Kristaps Porzingis ?',a:'Lettonie',cat:'pays',opts:['Estonie','Lituanie','Finlande','Lettonie']},
  {q:'Nationalité de Ben Simmons ?',a:'Australie',cat:'pays',opts:['Nouvelle-Zélande','Canada','États-Unis','Australie']},
  {q:'Nationalité de Bogdan Bogdanović ?',a:'Serbie',cat:'pays',opts:['Croatie','Bosnie','Slovénie','Serbie']},
  {q:'Nationalité de Lauri Markkanen ?',a:'Finlande',cat:'pays',opts:['Suède','Norvège','Danemark','Finlande']},
  {q:'Nationalité de Dario Šarić ?',a:'Croatie',cat:'pays',opts:['Serbie','Bosnie','Slovénie','Croatie']},
  {q:'Nationalité de Bismack Biyombo ?',a:'République démocratique du Congo',cat:'pays',opts:['Cameroun','Nigeria','Angola','République démocratique du Congo']},
  // ─── FINALISTE ───
  {q:'Perdant des Finales 2024 face aux Celtics ?',a:'Dallas Mavericks',cat:'finales',opts:['Indiana Pacers','Minnesota Timberwolves','Golden State Warriors','Dallas Mavericks']},
  {q:'Perdant des Finales 2023 face aux Nuggets ?',a:'Miami Heat',cat:'finales',opts:['Boston Celtics','Golden State Warriors','Los Angeles Lakers','Miami Heat']},
  {q:'Perdant des Finales 2022 face aux Warriors ?',a:'Boston Celtics',cat:'finales',opts:['Miami Heat','Dallas Mavericks','Memphis Grizzlies','Boston Celtics']},
  {q:'Perdant des Finales 2021 face aux Bucks ?',a:'Phoenix Suns',cat:'finales',opts:['LA Clippers','Denver Nuggets','Atlanta Hawks','Phoenix Suns']},
  {q:'Perdant des Finales 2020 face aux Lakers ?',a:'Miami Heat',cat:'finales',opts:['Toronto Raptors','Houston Rockets','Denver Nuggets','Miami Heat']},
  {q:'Perdant des Finales 2019 face aux Raptors ?',a:'Golden State Warriors',cat:'finales',opts:['Milwaukee Bucks','Houston Rockets','Portland Trail Blazers','Golden State Warriors']},
  {q:'Perdant des Finales 2016 face aux Cavaliers ?',a:'Golden State Warriors',cat:'finales',opts:['Oklahoma City Thunder','San Antonio Spurs','Toronto Raptors','Golden State Warriors']},
  {q:'Perdant des Finales 2011 face aux Mavericks ?',a:'Miami Heat',cat:'finales',opts:['Oklahoma City Thunder','Boston Celtics','Chicago Bulls','Miami Heat']},
  {q:'Perdant des Finales 2010 face aux Lakers ?',a:'Boston Celtics',cat:'finales',opts:['Phoenix Suns','Orlando Magic','Cleveland Cavaliers','Boston Celtics']},
  {q:'Perdant des Finales 2004 face aux Pistons ?',a:'Los Angeles Lakers',cat:'finales',opts:['Indiana Pacers','New Jersey Nets','San Antonio Spurs','Los Angeles Lakers']},
  {q:'Perdant des Finales 1997 face aux Bulls ?',a:'Utah Jazz',cat:'finales',opts:['Seattle SuperSonics','Houston Rockets','Indiana Pacers','Utah Jazz']},
  {q:'Perdant des Finales 1998 face aux Bulls ?',a:'Utah Jazz',cat:'finales',opts:['Indiana Pacers','New York Knicks','Phoenix Suns','Utah Jazz']},
  {q:'Perdant des Finales 2007 face aux Spurs ?',a:'Cleveland Cavaliers',cat:'finales',opts:['Detroit Pistons','Phoenix Suns','Toronto Raptors','Cleveland Cavaliers']},
  // ─── DUNK CONTEST ───
  {q:'Vainqueur du Dunk Contest 2024 ?',a:'Mac McClung',cat:'slam_dunk',opts:['Jaylen Brown','Jacob Toppin','Obi Toppin','Mac McClung']},
  {q:'Vainqueur du Dunk Contest 2023 ?',a:'Mac McClung',cat:'slam_dunk',opts:['Jericho Sims','Trey Murphy III','KJ Martin','Mac McClung']},
  {q:'Vainqueur du Dunk Contest 2020 ?',a:'Derrick Jones Jr.',cat:'slam_dunk',opts:['Aaron Gordon','Pat Connaughton','Dwight Howard','Derrick Jones Jr.']},
  {q:'Vainqueur du Dunk Contest 2016 ?',a:'Zach LaVine',cat:'slam_dunk',opts:['Aaron Gordon','Andre Drummond','Will Barton','Zach LaVine']},
  {q:'Vainqueur du Dunk Contest 2015 ?',a:'Zach LaVine',cat:'slam_dunk',opts:['Mason Plumlee','Victor Oladipo','Eric Gordon','Zach LaVine']},
  {q:'Vainqueur du Dunk Contest 2011 ?',a:'Blake Griffin',cat:'slam_dunk',opts:['DeMar DeRozan','Serge Ibaka','JaVale McGee','Blake Griffin']},
  {q:'Vainqueur du Dunk Contest 2009 ?',a:'Nate Robinson',cat:'slam_dunk',opts:['DwightHoward','J.R. Smith','Rudy Fernandez','Nate Robinson']},
  {q:'Considéré comme le plus grand dunker de l\'histoire ?',a:'Vince Carter',cat:'slam_dunk',opts:['Michael Jordan','Dominique Wilkins','Julius Erving','Vince Carter']},
  {q:'Quel joueur a remporté 3 fois le Dunk Contest (record) ?',a:'Nate Robinson',cat:'slam_dunk',opts:['Michael Jordan','Vince Carter','Jason Richardson','Nate Robinson']},
  {q:'Lors du Dunk Contest 2000, quel joueur a scotché la planète ?',a:'Vince Carter',cat:'slam_dunk',opts:['Tracy McGrady','Steve Francis','Desmond Mason','Vince Carter']},
  // ─── COACH DE L\'ANNÉE ───
  {q:'Coach de l\'Année 2025 ?',a:'Kenny Atkinson',cat:'coach_year',opts:['Mark Daigneault','Kenny Atkinson','Ime Udoka','Joe Mazzulla']},
  {q:'Coach de l\'Année 2024 ?',a:'Mark Daigneault',cat:'coach_year',opts:['Joe Mazzulla','Monty Williams','Billy Donovan','Mark Daigneault']},
  {q:'Coach de l\'Année 2023 ?',a:'Mike Brown',cat:'coach_year',opts:['Monty Williams','Gregg Popovich','Doc Rivers','Mike Brown']},
  {q:'Coach de l\'Année 2022 ?',a:'Monty Williams',cat:'coach_year',opts:['Steve Kerr','Taylor Jenkins','Quin Snyder','Monty Williams']},
  {q:'Coach de l\'Année 2021 ?',a:'Tom Thibodeau',cat:'coach_year',opts:['Nate McMillan','Quin Snyder','Tyronn Lue','Tom Thibodeau']},
  {q:'Coach de l\'Année 2020 ?',a:'Nick Nurse',cat:'coach_year',opts:['Frank Vogel','Mike Malone','Erik Spoelstra','Nick Nurse']},
  {q:'Coach de l\'Année 2018 ?',a:'Dwane Casey',cat:'coach_year',opts:['Brad Stevens','Quin Snyder','Billy Donovan','Dwane Casey']},
  {q:'Coach de l\'Année 2017 ?',a:'Mike D\'Antoni',cat:'coach_year',opts:['Gregg Popovich','Brad Stevens','Tyronn Lue','Mike D\'Antoni']},
  {q:'Coach de l\'Année 2016 ?',a:'Steve Kerr',cat:'coach_year',opts:['Gregg Popovich','Doc Rivers','Rick Carlisle','Steve Kerr']},
  {q:'Coach de l\'Année 2014 ?',a:'Gregg Popovich',cat:'coach_year',opts:['Tom Thibodeau','Frank Vogel','Terry Stotts','Gregg Popovich']},
  // ─── ARÈNE ───
  {q:'Salle des Atlanta Hawks ?',a:'State Farm Arena',cat:'arena',opts:['State Farm Arena','Philips Arena','Gainbridge Fieldhouse','Spectrum Center']},
  {q:'Salle des Boston Celtics ?',a:'TD Garden',cat:'arena',opts:['Barclays Center','United Center','TD Garden','Fiserv Forum']},
  {q:'Salle des Brooklyn Nets ?',a:'Barclays Center',cat:'arena',opts:['Madison Square Garden','TD Garden','Barclays Center','Wells Fargo Center']},
  {q:'Salle des Charlotte Hornets ?',a:'Spectrum Center',cat:'arena',opts:['TD Garden','Spectrum Center','Kaseya Center','Gainbridge Fieldhouse']},
  {q:'Salle des Chicago Bulls ?',a:'United Center',cat:'arena',opts:['Gainbridge Fieldhouse','Fiserv Forum','United Center','Little Caesars Arena']},
  {q:'Salle des Cleveland Cavaliers ?',a:'Rocket Mortgage FieldHouse',cat:'arena',opts:['Gainbridge Fieldhouse','Little Caesars Arena','Target Center','Rocket Mortgage FieldHouse']},
  {q:'Salle des Dallas Mavericks ?',a:'American Airlines Center',cat:'arena',opts:['Toyota Center','Footprint Center','Paycom Center','American Airlines Center']},
  {q:'Salle des Denver Nuggets ?',a:'Ball Arena',cat:'arena',opts:['Delta Center','Moda Center','Ball Arena','Golden 1 Center']},
  {q:'Salle des Detroit Pistons ?',a:'Little Caesars Arena',cat:'arena',opts:['United Center','Rocket Mortgage FieldHouse','Gainbridge Fieldhouse','Little Caesars Arena']},
  {q:'Salle des Golden State Warriors ?',a:'Chase Center',cat:'arena',opts:['Crypto.com Arena','Intuit Dome','Chase Center','Ball Arena']},
  {q:'Salle des Houston Rockets ?',a:'Toyota Center',cat:'arena',opts:['FedExForum','American Airlines Center','Smoothie King Center','Toyota Center']},
  {q:'Salle des Indiana Pacers ?',a:'Gainbridge Fieldhouse',cat:'arena',opts:['Rocket Mortgage FieldHouse','Fiserv Forum','Little Caesars Arena','Gainbridge Fieldhouse']},
  {q:'Salle des LA Clippers ?',a:'Intuit Dome',cat:'arena',opts:['Crypto.com Arena','Chase Center','Staples Center','Intuit Dome']},
  {q:'Salle des Los Angeles Lakers ?',a:'Crypto.com Arena',cat:'arena',opts:['Chase Center','Intuit Dome','Ball Arena','Crypto.com Arena']},
  {q:'Salle des Memphis Grizzlies ?',a:'FedExForum',cat:'arena',opts:['Smoothie King Center','Toyota Center','Kaseya Center','FedExForum']},
  {q:'Salle des Miami Heat ?',a:'Kaseya Center',cat:'arena',opts:['Spectrum Center','FedExForum','Gainbridge Fieldhouse','Kaseya Center']},
  {q:'Salle des Milwaukee Bucks ?',a:'Fiserv Forum',cat:'arena',opts:['United Center','Gainbridge Fieldhouse','Target Center','Fiserv Forum']},
  {q:'Salle des Minnesota Timberwolves ?',a:'Target Center',cat:'arena',opts:['Fiserv Forum','Paycom Center','Ball Arena','Target Center']},
  {q:'Salle des New Orleans Pelicans ?',a:'Smoothie King Center',cat:'arena',opts:['FedExForum','Toyota Center','Kaseya Center','Smoothie King Center']},
  {q:'Salle des New York Knicks ?',a:'Madison Square Garden',cat:'arena',opts:['Barclays Center','Wells Fargo Center','TD Garden','Madison Square Garden']},
  {q:'Salle de l\'OKC Thunder ?',a:'Paycom Center',cat:'arena',opts:['American Airlines Center','Toyota Center','AT&T Center','Paycom Center']},
  {q:'Salle de l\'Orlando Magic ?',a:'Kia Center',cat:'arena',opts:['Spectrum Center','State Farm Arena','Smoothie King Center','Kia Center']},
  {q:'Salle des Philadelphia 76ers ?',a:'Wells Fargo Center',cat:'arena',opts:['Barclays Center','Madison Square Garden','TD Garden','Wells Fargo Center']},
  {q:'Salle des Phoenix Suns ?',a:'Footprint Center',cat:'arena',opts:['Toyota Center','American Airlines Center','Ball Arena','Footprint Center']},
  {q:'Salle des Portland Trail Blazers ?',a:'Moda Center',cat:'arena',opts:['Chase Center','Golden 1 Center','Ball Arena','Moda Center']},
  {q:'Salle des Sacramento Kings ?',a:'Golden 1 Center',cat:'arena',opts:['Ball Arena','Chase Center','Moda Center','Golden 1 Center']},
  {q:'Salle des San Antonio Spurs ?',a:'AT&T Center',cat:'arena',opts:['Toyota Center','American Airlines Center','Smoothie King Center','AT&T Center']},
  {q:'Salle des Toronto Raptors ?',a:'Scotiabank Arena',cat:'arena',opts:['Bell Centre','Rogers Centre','Air Canada Centre','Scotiabank Arena']},
  {q:'Salle des Utah Jazz ?',a:'Delta Center',cat:'arena',opts:['Ball Arena','Moda Center','Gainbridge Fieldhouse','Delta Center']},
  {q:'Salle des Washington Wizards ?',a:'Capital One Arena',cat:'arena',opts:['Wells Fargo Center','TD Garden','Barclays Center','Capital One Arena']},
  // ─── NUMÉRO ───
  {q:'Numéro de maillot de Michael Jordan aux Bulls ?',a:'#23',cat:'jersey',opts:['#10','#33','#23','#45']},
  {q:'Numéro de maillot de Kobe Bryant (Lakers) en fin de carrière ?',a:'#24',cat:'jersey',opts:['#8','#24','#33','#32']},
  {q:'Numéro de maillot de LeBron James aux Lakers ?',a:'#23',cat:'jersey',opts:['#6','#23','#2','#24']},
  {q:'Numéro de maillot de Magic Johnson aux Lakers ?',a:'#32',cat:'jersey',opts:['#33','#32','#6','#14']},
  {q:'Numéro de maillot de Larry Bird aux Celtics ?',a:'#33',cat:'jersey',opts:['#32','#34','#33','#6']},
  {q:'Numéro de maillot de Kareem Abdul-Jabbar ?',a:'#33',cat:'jersey',opts:['#34','#32','#33','#20']},
  {q:'Numéro de maillot de Tim Duncan aux Spurs ?',a:'#21',cat:'jersey',opts:['#23','#50','#21','#44']},
  {q:'Numéro retiré dans TOUTES les franchises NBA ?',a:'#6 (Bill Russell)',cat:'jersey',opts:['#23 (Jordan)','#13 (Wilt)','#6 (Bill Russell)','#24 (Kobe)']},
  {q:'Numéro de maillot de Stephen Curry ?',a:'#30',cat:'jersey',opts:['#3','#30','#23','#11']},
  {q:'Numéro de maillot de Giannis Antetokounmpo ?',a:'#34',cat:'jersey',opts:['#6','#34','#24','#13']},
  {q:'Numéro de maillot de Shaquille O\'Neal aux Lakers ?',a:'#34',cat:'jersey',opts:['#32','#33','#34','#50']},
  {q:'Numéro de maillot de Hakeem Olajuwon ?',a:'#34',cat:'jersey',opts:['#32','#33','#34','#50']},
  {q:'Numéro de maillot de Kevin Durant aux Warriors ?',a:'#35',cat:'jersey',opts:['#7','#35','#1','#23']},
  {q:'Numéro de maillot de Dennis Rodman aux Bulls ?',a:'#91',cat:'jersey',opts:['#10','#33','#91','#69']},
  {q:'Numéro de maillot de Allen Iverson ?',a:'#3',cat:'jersey',opts:['#1','#3','#21','#23']},
  // ─── TRADE ───
  {q:'En 2012, les Lakers acquièrent Dwight Howard contre qui ?',a:'Andrew Bynum + Arron Afflalo',cat:'trade',opts:['Pau Gasol + Steve Blake','Andrew Bynum + Arron Afflalo','Metta World Peace + Jordan Hill','Kobe Bryant + Chris Paul']},
  {q:'En 2019, les Nets envoient D\'Angelo Russell aux Warriors contre qui ?',a:'Kevin Durant',cat:'trade',opts:['Klay Thompson','Kyrie Irving','Kevin Durant','DeAndre Jordan']},
  {q:'En 2021, De\'Aaron Fox est-il échangé par Sacramento ?',a:'Non, il prolonge',cat:'trade',opts:['Oui, aux Warriors','Oui, aux Clippers','Non, il prolonge','Oui, aux Knicks']},
  {q:'Quel trade a envoyé Kawhi Leonard à Toronto en 2018 ?',a:'DeMar DeRozan + Jakob Poeltl → San Antonio',cat:'trade',opts:['Kyle Lowry + Norman Powell → San Antonio','DeMar DeRozan + Jakob Poeltl → San Antonio','Jonas Valančiūnas + Serge Ibaka → San Antonio','Fred VanVleet + OG Anunoby → San Antonio']},
  {q:'En 2004, Shaquille O\'Neal est envoyé de LA à Miami contre qui ?',a:'Lamar Odom + Brian Grant + Caron Butler',cat:'trade',opts:['Dwyane Wade + Udonis Haslem','Lamar Odom + Brian Grant + Caron Butler','Alonzo Mourning + Dwyane Wade','Jason Williams + James Posey']},
  {q:'En 2011, Chris Paul est envoyé aux Clippers par La Nouvelle-Orléans contre qui ?',a:'Eric Gordon + Al-Farouq Aminu + Chris Kaman',cat:'trade',opts:['Blake Griffin + Mo Williams','Eric Gordon + Al-Farouq Aminu + Chris Kaman','DeAndre Jordan + Jamal Crawford','Randy Foye + Gordon Hayward']},
  {q:'En 2022, Kevin Durant demande à être échangé. Il finit par aller où ?',a:'Phoenix Suns',cat:'trade',opts:['Los Angeles Lakers','Miami Heat','Boston Celtics','Phoenix Suns']},
  {q:'Quel joueur français a été échangé aux Spurs en 2022 puis aux Raptors ?',a:'Khem Birch',cat:'trade',opts:['Evan Fournier','Nicolas Batum','Khem Birch','Guerschon Yabusele']},
  {q:'Quel équipe a remporté le titre NBA en 2023 ?',a:'Denver Nuggets',cat:'champion',opts:['Miami Heat','Boston Celtics','Denver Nuggets','Golden State Warriors']},
  {q:'Quel équipe a remporté le titre NBA en 2021 ?',a:'Milwaukee Bucks',cat:'champion',opts:['Phoenix Suns','Milwaukee Bucks','LA Clippers','Atlanta Hawks']},
  {q:'Quel équipe a remporté le titre NBA en 2019 ?',a:'Toronto Raptors',cat:'champion',opts:['Golden State Warriors','Toronto Raptors','Houston Rockets','Milwaukee Bucks']},
  {q:'Quel équipe a remporté le titre NBA en 2020 ?',a:'Los Angeles Lakers',cat:'champion',opts:['Miami Heat','Boston Celtics','Los Angeles Lakers','Toronto Raptors']},
  {q:'Quel équipe a remporté le titre NBA en 2022 ?',a:'Golden State Warriors',cat:'champion',opts:['Boston Celtics','Memphis Grizzlies','Golden State Warriors','Miami Heat']},
  {q:'Quel équipe a remporté le titre NBA en 2014 ?',a:'San Antonio Spurs',cat:'champion',opts:['Miami Heat','Oklahoma City Thunder','San Antonio Spurs','Indiana Pacers']},
  {q:'Quel équipe a remporté le titre NBA en 2017 ?',a:'Golden State Warriors',cat:'champion',opts:['Cleveland Cavaliers','San Antonio Spurs','Houston Rockets','Golden State Warriors']},
  {q:'Quel équipe a remporté le titre NBA en 2018 ?',a:'Golden State Warriors',cat:'champion',opts:['Cleveland Cavaliers','Houston Rockets','Boston Celtics','Golden State Warriors']},
  {q:'Quel équipe a remporté le titre NBA en 2013 ?',a:'Miami Heat',cat:'champion',opts:['San Antonio Spurs','Indiana Pacers','Miami Heat','Chicago Bulls']},
  {q:'Quel équipe a remporté le titre NBA en 2024 ?',a:'Boston Celtics',cat:'champion',opts:['Dallas Mavericks','Minnesota Timberwolves','Indiana Pacers','Boston Celtics']},
  // mvp
  {q:'Qui a remporté le MVP 2024 ?',a:'Nikola Jokić',cat:'mvp',opts:['Luka Dončić','Shai Gilgeous-Alexander','Nikola Jokić','Giannis Antetokounmpo']},
  {q:'Qui a remporté le MVP 2023 ?',a:'Joel Embiid',cat:'mvp',opts:['Nikola Jokić','Giannis Antetokounmpo','Joel Embiid','Jayson Tatum']},
  {q:'Qui a remporté le MVP 2022 ?',a:'Nikola Jokić',cat:'mvp',opts:['Stephen Curry','Kevin Durant','Devin Booker','Nikola Jokić']},
  {q:'Qui a remporté le MVP 2021 ?',a:'Nikola Jokić',cat:'mvp',opts:['LeBron James','Stephen Curry','Luka Dončić','Nikola Jokić']},
  {q:'Qui a remporté le MVP 2020 ?',a:'Giannis Antetokounmpo',cat:'mvp',opts:['LeBron James','James Harden','Luka Dončić','Giannis Antetokounmpo']},
  {q:'Qui a remporté le MVP 2019 ?',a:'Giannis Antetokounmpo',cat:'mvp',opts:['James Harden','Kevin Durant','Stephen Curry','Giannis Antetokounmpo']},
  {q:'Qui a remporté le MVP 2018 ?',a:'James Harden',cat:'mvp',opts:['LeBron James','Anthony Davis','Paul George','James Harden']},
  {q:'Qui a remporté le MVP 2016 ?',a:'Stephen Curry',cat:'mvp',opts:['LeBron James','Russell Westbrook','Kawhi Leonard','Stephen Curry']},
  {q:'Qui a remporté le MVP 2017 ?',a:'Russell Westbrook',cat:'mvp',opts:['James Harden','LeBron James','Kawhi Leonard','Russell Westbrook']},
  {q:'Qui a remporté le MVP 2015 ?',a:'Stephen Curry',cat:'mvp',opts:['LeBron James','James Harden','Marc Gasol','Stephen Curry']},
  {q:'Qui a remporté le MVP 2025 ?',a:'Shai Gilgeous-Alexander',cat:'mvp',opts:['Nikola Jokić','Giannis Antetokounmpo','Jayson Tatum','Shai Gilgeous-Alexander']},
  // finals_mvp
  {q:'Qui a remporté le MVP des Finales 2023 ?',a:'Nikola Jokić',cat:'finals_mvp',opts:['Jamal Murray','Michael Porter Jr.','Aaron Gordon','Nikola Jokić']},
  {q:'Qui a remporté le MVP des Finales 2021 ?',a:'Giannis Antetokounmpo',cat:'finals_mvp',opts:['Khris Middleton','Jrue Holiday','Bobby Portis','Giannis Antetokounmpo']},
  {q:'Qui a remporté le MVP des Finales 2016 ?',a:'LeBron James',cat:'finals_mvp',opts:['Kyrie Irving','Kevin Love','J.R. Smith','LeBron James']},
  {q:'Qui a remporté le MVP des Finales 2019 ?',a:'Kawhi Leonard',cat:'finals_mvp',opts:['Pascal Siakam','Kyle Lowry','Fred VanVleet','Kawhi Leonard']},
  {q:'Qui a remporté le MVP des Finales 2020 ?',a:'LeBron James',cat:'finals_mvp',opts:['Anthony Davis','Rajon Rondo','Danny Green','LeBron James']},
  {q:'Qui a remporté le MVP des Finales 2022 ?',a:'Stephen Curry',cat:'finals_mvp',opts:['Klay Thompson','Jordan Poole','Draymond Green','Stephen Curry']},
  {q:'Qui a remporté le MVP des Finales 2024 ?',a:'Jaylen Brown',cat:'finals_mvp',opts:['Jayson Tatum','Jrue Holiday','Al Horford','Jaylen Brown']},
  {q:'Qui a remporté le MVP des Finales 2017 ?',a:'Kevin Durant',cat:'finals_mvp',opts:['Stephen Curry','Klay Thompson','Draymond Green','Kevin Durant']},
  {q:'Qui a remporté le MVP des Finales 2018 ?',a:'Kevin Durant',cat:'finals_mvp',opts:['Stephen Curry','Klay Thompson','LeBron James','Kevin Durant']},
  {q:'Qui a remporté le MVP des Finales 2014 ?',a:'Kawhi Leonard',cat:'finals_mvp',opts:['Tim Duncan','Tony Parker','Manu Ginobili','Kawhi Leonard']},
  // draft
  {q:'Qui a été sélectionné en 1er choix de la draft 2023 ?',a:'Victor Wembanyama',cat:'draft',opts:['Scoot Henderson','Brandon Miller','Amen Thompson','Victor Wembanyama']},
  {q:'Qui a été sélectionné en 1er choix de la draft 2024 ?',a:'Zaccharie Risacher',cat:'draft',opts:['Alexandre Sarr','Reed Sheppard','Stephon Castle','Zaccharie Risacher']},
  {q:'Qui a été sélectionné en 1er choix de la draft 2022 ?',a:'Paolo Banchero',cat:'draft',opts:['Chet Holmgren','Jabari Smith Jr.','Jaden Ivey','Paolo Banchero']},
  {q:'Qui a été sélectionné en 1er choix de la draft 2021 ?',a:'Cade Cunningham',cat:'draft',opts:['Jalen Green','Evan Mobley','Scottie Barnes','Cade Cunningham']},
  {q:'Qui a été sélectionné en 1er choix de la draft 2020 ?',a:'Anthony Edwards',cat:'draft',opts:['LaMelo Ball','James Wiseman','Isaac Okoro','Anthony Edwards']},
  {q:'Qui a été sélectionné en 1er choix de la draft 2003 ?',a:'LeBron James',cat:'draft',opts:['Carmelo Anthony','Dwyane Wade','Chris Bosh','LeBron James']},
  {q:'En quelle année LeBron James a-t-il été drafté en 1er ?',a:'2003',cat:'draft',opts:['2002','2003','2004','2005']},
  {q:'Qui a été sélectionné en 1er choix de la draft 2019 ?',a:'Zion Williamson',cat:'draft',opts:['Ja Morant','RJ Barrett','De\'Andre Hunter','Zion Williamson']},
  // scoring
  {q:'Qui détient le record NBA de points par match en carrière ?',a:'Michael Jordan',cat:'scoring',opts:['Wilt Chamberlain','LeBron James','Kevin Durant','Michael Jordan']},
  {q:'Qui est le meilleur scoreur de la saison 2023-24 ?',a:'Luka Dončić',cat:'scoring',opts:['Jayson Tatum','Kevin Durant','Shai Gilgeous-Alexander','Luka Dončić']},
  {q:'Quel joueur a scoré 100 points en un seul match ?',a:'Wilt Chamberlain',cat:'scoring',opts:['Michael Jordan','Kobe Bryant','Elgin Baylor','Wilt Chamberlain']},
  {q:'Qui est le meilleur scoreur de la saison 2024-25 ?',a:'Shai Gilgeous-Alexander',cat:'scoring',opts:['Jayson Tatum','LeBron James','Nikola Jokić','Shai Gilgeous-Alexander']},
  {q:'Quel joueur a scoré 81 points en un match en 2006 ?',a:'Kobe Bryant',cat:'scoring',opts:['LeBron James','Allen Iverson','Tracy McGrady','Kobe Bryant']},
  // record
  {q:'Quelle franchise détient le record de victoires consécutives (33) en NBA ?',a:'Los Angeles Lakers',cat:'record',opts:['Golden State Warriors','Chicago Bulls','Boston Celtics','Los Angeles Lakers']},
  {q:'Quel joueur détient le record NBA de points en carrière ?',a:'LeBron James',cat:'record',opts:['Kareem Abdul-Jabbar','Karl Malone','Kobe Bryant','LeBron James']},
  {q:'Quel joueur détient le record NBA de passes en carrière ?',a:'John Stockton',cat:'record',opts:['Magic Johnson','Jason Kidd','Chris Paul','John Stockton']},
  {q:'Quel joueur détient le record NBA de rebonds en carrière ?',a:'Wilt Chamberlain',cat:'record',opts:['Bill Russell','Dennis Rodman','Kareem Abdul-Jabbar','Wilt Chamberlain']},
  {q:'Combien de titres NBA les Boston Celtics ont-ils remportés (record) ?',a:'17',cat:'record',opts:['16','17','18','15']},
  {q:'Quel est le record de victoires en une saison régulière ?',a:'73 victoires (Warriors 2016)',cat:'record',opts:['72 victoires (Bulls 1996)','70 victoires (Lakers 2000)','73 victoires (Warriors 2016)','69 victoires (Spurs 2016)']},
  // roty
  {q:'Qui a remporté le trophée de Rookie de l\'année 2023 ?',a:'Paolo Banchero',cat:'roty',opts:['Victor Wembanyama','Keegan Murray','Bennedict Mathurin','Paolo Banchero']},
  {q:'Qui a remporté le trophée de Rookie de l\'année 2024 ?',a:'Victor Wembanyama',cat:'roty',opts:['Chet Holmgren','Brandon Miller','Scoot Henderson','Victor Wembanyama']},
  {q:'Qui a remporté le trophée de Rookie de l\'année 2021 ?',a:'LaMelo Ball',cat:'roty',opts:['Anthony Edwards','James Wiseman','Patrick Williams','LaMelo Ball']},
  {q:'Qui a remporté le trophée de Rookie de l\'année 2020 ?',a:'Ja Morant',cat:'roty',opts:['Zion Williamson','RJ Barrett','Darius Garland','Ja Morant']},
  {q:'Qui a remporté le trophée de Rookie de l\'année 2022 ?',a:'Scottie Barnes',cat:'roty',opts:['Cade Cunningham','Evan Mobley','Josh Giddey','Scottie Barnes']},
  // dpoy
  {q:'Qui a remporté le DPOY 2024 ?',a:'Rudy Gobert',cat:'dpoy',opts:['Bam Adebayo','Brook Lopez','Jaren Jackson Jr.','Rudy Gobert']},
  {q:'Qui a remporté le DPOY 2023 ?',a:'Jaren Jackson Jr.',cat:'dpoy',opts:['Draymond Green','Rudy Gobert','Brook Lopez','Jaren Jackson Jr.']},
  {q:'Qui a remporté le DPOY 2022 ?',a:'Marcus Smart',cat:'dpoy',opts:['Rudy Gobert','Mikal Bridges','Draymond Green','Marcus Smart']},
  {q:'Qui a remporté le DPOY 2021 ?',a:'Rudy Gobert',cat:'dpoy',opts:['Draymond Green','Ben Simmons','Anthony Davis','Rudy Gobert']},
  {q:'Qui est le joueur avec le plus de DPOY ?',a:'Rudy Gobert',cat:'dpoy',opts:['Dikembe Mutombo','Ben Wallace','Dwight Howard','Rudy Gobert']},
  {q:'Qui a remporté le DPOY 2025 ?',a:'Evan Mobley',cat:'dpoy',opts:['Draymond Green','Evan Mobley','Jaren Jackson Jr.','Victor Wembanyama']},
  // coach
  {q:'Quel entraîneur a le plus de titres NBA (11) ?',a:'Phil Jackson',cat:'coach',opts:['Gregg Popovich','Pat Riley','Larry Bird','Phil Jackson']},
  {q:'Quel entraîneur a mené les Warriors à 4 titres entre 2015 et 2022 ?',a:'Steve Kerr',cat:'coach',opts:['Mark Jackson','Alvin Gentry','Luke Walton','Steve Kerr']},
  {q:'Quel entraîneur a mené les Bucks au titre 2021 ?',a:'Mike Budenholzer',cat:'coach',opts:['Jason Kidd','Terry Stotts','Nate McMillan','Mike Budenholzer']},
  {q:'Quel entraîneur a mené les Raptors au titre 2019 ?',a:'Nick Nurse',cat:'coach',opts:['Dwane Casey','Larry Drew','Lloyd Pierce','Nick Nurse']},
  {q:'Quel entraîneur a le plus de victoires en NBA ?',a:'Don Nelson',cat:'coach',opts:['Gregg Popovich','Phil Jackson','Lenny Wilkens','Don Nelson']},
  // surnom
  {q:'Quel est le surnom de LeBron James ?',a:'The King',cat:'surnom',opts:['The Chosen One','Black Mamba','The Answer','The King']},
  {q:'Quel est le surnom de Kobe Bryant ?',a:'Black Mamba',cat:'surnom',opts:['The King','The Answer','Black Mamba','The Mailman']},
  {q:'Quel est le surnom de Kevin Durant ?',a:'Slim Reaper',cat:'surnom',opts:['KD','The Servant','Slim Reaper','The Beard']},
  {q:'Quel est le surnom de James Harden ?',a:'The Beard',cat:'surnom',opts:['The Chef','Slim Reaper','The Beard','The Process']},
  {q:'Quel est le surnom de Joel Embiid ?',a:'The Process',cat:'surnom',opts:['The Big Fundamental','The Beard','The Process','The King']},
  {q:'Quel est le surnom de Giannis Antetokounmpo ?',a:'Greek Freak',cat:'surnom',opts:['The Big Fundamental','Greek Freak','The Answer','The Chosen One']},
  {q:'Quel est le surnom de Stephen Curry ?',a:'Chef Curry',cat:'surnom',opts:['Chef Curry','Slim Reaper','The Process','Baby-Faced Assassin']},
  {q:'Quel est le surnom de Tim Duncan ?',a:'The Big Fundamental',cat:'surnom',opts:['The Mailman','The Big Fundamental','The Answer','Spiderman']},
  {q:'Quel est le surnom de Allen Iverson ?',a:'The Answer',cat:'surnom',opts:['AI','The King','The Answer','The Truth']},
  {q:'Quel est le surnom de Paul Pierce ?',a:'The Truth',cat:'surnom',opts:['The Answer','The Truth','The Process','Black Mamba']},
  {q:'Quel est le surnom de Victor Wembanyama ?',a:'Wemby',cat:'surnom',opts:['The Alien','Spiderman','Wemby','The Giant']},
  // pays
  {q:'De quel pays vient Giannis Antetokounmpo ?',a:'Grèce',cat:'pays',opts:['Nigeria','Cameroun','Grèce','Sénégal']},
  {q:'De quel pays vient Luka Dončić ?',a:'Slovénie',cat:'pays',opts:['Croatie','Serbie','Slovénie','Bosnie']},
  {q:'De quel pays vient Nikola Jokić ?',a:'Serbie',cat:'pays',opts:['Croatie','Slovénie','Bosnie','Serbie']},
  {q:'De quel pays vient Victor Wembanyama ?',a:'France',cat:'pays',opts:['Belgique','Espagne','Suisse','France']},
  {q:'De quel pays vient Rudy Gobert ?',a:'France',cat:'pays',opts:['Espagne','Belgique','France','Suisse']},
  {q:'De quel pays vient Joel Embiid ?',a:'Cameroun',cat:'pays',opts:['Nigeria','Sénégal','Côte d\'Ivoire','Cameroun']},
  {q:'De quel pays vient Dirk Nowitzki ?',a:'Allemagne',cat:'pays',opts:['Autriche','Pays-Bas','Suisse','Allemagne']},
  {q:'De quel pays vient Pau Gasol ?',a:'Espagne',cat:'pays',opts:['Argentine','Brésil','France','Espagne']},
  {q:'De quel pays vient Tony Parker ?',a:'France',cat:'pays',opts:['Belgique','Suisse','Canada','France']},
  {q:'De quel pays vient Steve Nash ?',a:'Canada',cat:'pays',opts:['Australie','Afrique du Sud','États-Unis','Canada']},
  {q:'De quel pays vient Manu Ginobili ?',a:'Argentine',cat:'pays',opts:['Brésil','Uruguay','Chili','Argentine']},
  // finales
  {q:'Quelle équipe a perdu les Finales 2023 face aux Nuggets ?',a:'Miami Heat',cat:'finales',opts:['Boston Celtics','Golden State Warriors','Los Angeles Lakers','Miami Heat']},
  {q:'Quelle équipe a perdu les Finales 2024 face aux Celtics ?',a:'Dallas Mavericks',cat:'finales',opts:['Indiana Pacers','Minnesota Timberwolves','Golden State Warriors','Dallas Mavericks']},
  {q:'Quelle équipe a perdu les Finales 2022 face aux Warriors ?',a:'Boston Celtics',cat:'finales',opts:['Miami Heat','Dallas Mavericks','Memphis Grizzlies','Boston Celtics']},
  {q:'Quelle équipe a perdu les Finales 2021 face aux Bucks ?',a:'Phoenix Suns',cat:'finales',opts:['LA Clippers','Denver Nuggets','Atlanta Hawks','Phoenix Suns']},
  {q:'Quelle équipe a perdu les Finales 2016 face aux Cavaliers ?',a:'Golden State Warriors',cat:'finales',opts:['Oklahoma City Thunder','San Antonio Spurs','Toronto Raptors','Golden State Warriors']},
  // slam_dunk
  {q:'Qui a remporté le Dunk Contest 2023 ?',a:'Mac McClung',cat:'slam_dunk',opts:['Jericho Sims','Trey Murphy III','KJ Martin','Mac McClung']},
  {q:'Qui a remporté le Dunk Contest 2024 ?',a:'Mac McClung',cat:'slam_dunk',opts:['Jaylen Brown','Jacob Toppin','Obi Toppin','Mac McClung']},
  {q:'Qui a remporté le Dunk Contest 2016 ?',a:'Zach LaVine',cat:'slam_dunk',opts:['Aaron Gordon','Andre Drummond','Will Barton','Zach LaVine']},
  {q:'Qui a remporté le Dunk Contest 2017 ?',a:'Glenn Robinson III',cat:'slam_dunk',opts:['Aaron Gordon','Derrick Jones Jr.','Larry Nance Jr.','Glenn Robinson III']},
  {q:'Qui est considéré comme le plus grand dunker de l\'histoire ?',a:'Vince Carter',cat:'slam_dunk',opts:['Michael Jordan','Dominique Wilkins','Julius Erving','Vince Carter']},
  // coach_year
  {q:'Qui a remporté le Coach de l\'Année 2024 ?',a:'Mark Daigneault',cat:'coach_year',opts:['Joe Mazzulla','Monty Williams','Billy Donovan','Mark Daigneault']},
  {q:'Qui a remporté le Coach de l\'Année 2023 ?',a:'Mike Brown',cat:'coach_year',opts:['Monty Williams','Gregg Popovich','Doc Rivers','Mike Brown']},
  {q:'Qui a remporté le Coach de l\'Année 2022 ?',a:'Monty Williams',cat:'coach_year',opts:['Steve Kerr','Taylor Jenkins','Quin Snyder','Monty Williams']},
  {q:'Qui a remporté le Coach de l\'Année 2021 ?',a:'Tom Thibodeau',cat:'coach_year',opts:['Nate McMillan','Quin Snyder','Tyronn Lue','Tom Thibodeau']},
  {q:'Qui a remporté le Coach de l\'Année 2025 ?',a:'Kenny Atkinson',cat:'coach_year',opts:['Mark Daigneault','Kenny Atkinson','Rick Carlisle','Joe Mazzulla']},
  // arena
  {q:'Dans quelle salle jouent les Atlanta Hawks ?',a:'State Farm Arena',cat:'arena',opts:['State Farm Arena','Philips Arena','Gainbridge Fieldhouse','Spectrum Center']},
  {q:'Dans quelle salle jouent les Boston Celtics ?',a:'TD Garden',cat:'arena',opts:['Barclays Center','United Center','TD Garden','Fiserv Forum']},
  {q:'Dans quelle salle jouent les Brooklyn Nets ?',a:'Barclays Center',cat:'arena',opts:['Madison Square Garden','TD Garden','Barclays Center','Wells Fargo Center']},
  {q:'Dans quelle salle jouent les Charlotte Hornets ?',a:'Spectrum Center',cat:'arena',opts:['TD Garden','Spectrum Center','Kaseya Center','Gainbridge Fieldhouse']},
  {q:'Dans quelle salle jouent les Chicago Bulls ?',a:'United Center',cat:'arena',opts:['Gainbridge Fieldhouse','Fiserv Forum','United Center','Little Caesars Arena']},
  {q:'Dans quelle salle jouent les Cleveland Cavaliers ?',a:'Rocket Mortgage FieldHouse',cat:'arena',opts:['Gainbridge Fieldhouse','Little Caesars Arena','Target Center','Rocket Mortgage FieldHouse']},
  {q:'Dans quelle salle jouent les Dallas Mavericks ?',a:'American Airlines Center',cat:'arena',opts:['Toyota Center','Footprint Center','Paycom Center','American Airlines Center']},
  {q:'Dans quelle salle jouent les Denver Nuggets ?',a:'Ball Arena',cat:'arena',opts:['Vivint Arena','Moda Center','Ball Arena','Golden 1 Center']},
  {q:'Dans quelle salle jouent les Detroit Pistons ?',a:'Little Caesars Arena',cat:'arena',opts:['United Center','Rocket Mortgage FieldHouse','Gainbridge Fieldhouse','Little Caesars Arena']},
  {q:'Dans quelle salle jouent les Golden State Warriors ?',a:'Chase Center',cat:'arena',opts:['Crypto.com Arena','Intuit Dome','Chase Center','Ball Arena']},
  {q:'Dans quelle salle jouent les Houston Rockets ?',a:'Toyota Center',cat:'arena',opts:['FedExForum','American Airlines Center','Smoothie King Center','Toyota Center']},
  {q:'Dans quelle salle jouent les Indiana Pacers ?',a:'Gainbridge Fieldhouse',cat:'arena',opts:['Bankers Life Fieldhouse','Fiserv Forum','Rocket Mortgage FieldHouse','Gainbridge Fieldhouse']},
  {q:'Dans quelle salle jouent les LA Clippers ?',a:'Intuit Dome',cat:'arena',opts:['Crypto.com Arena','Chase Center','Staples Center','Intuit Dome']},
  {q:'Dans quelle salle jouent les Los Angeles Lakers ?',a:'Crypto.com Arena',cat:'arena',opts:['Chase Center','Intuit Dome','Ball Arena','Crypto.com Arena']},
  {q:'Dans quelle salle jouent les Memphis Grizzlies ?',a:'FedExForum',cat:'arena',opts:['Smoothie King Center','Toyota Center','Kaseya Center','FedExForum']},
  {q:'Dans quelle salle jouent les Miami Heat ?',a:'Kaseya Center',cat:'arena',opts:['AmericanAirlines Arena','Spectrum Center','FedExForum','Kaseya Center']},
  {q:'Dans quelle salle jouent les Milwaukee Bucks ?',a:'Fiserv Forum',cat:'arena',opts:['United Center','Gainbridge Fieldhouse','Target Center','Fiserv Forum']},
  {q:'Dans quelle salle jouent les Minnesota Timberwolves ?',a:'Target Center',cat:'arena',opts:['Fiserv Forum','Paycom Center','Ball Arena','Target Center']},
  {q:'Dans quelle salle jouent les New Orleans Pelicans ?',a:'Smoothie King Center',cat:'arena',opts:['FedExForum','Toyota Center','Kaseya Center','Smoothie King Center']},
  {q:'Dans quelle salle jouent les New York Knicks ?',a:'Madison Square Garden',cat:'arena',opts:['Barclays Center','Wells Fargo Center','TD Garden','Madison Square Garden']},
  {q:'Dans quelle salle jouent les Oklahoma City Thunder ?',a:'Paycom Center',cat:'arena',opts:['American Airlines Center','Toyota Center','AT&T Center','Paycom Center']},
  {q:'Dans quelle salle jouent les Orlando Magic ?',a:'Kia Center',cat:'arena',opts:['Spectrum Center','State Farm Arena','Amway Center','Kia Center']},
  {q:'Dans quelle salle jouent les Philadelphia 76ers ?',a:'Wells Fargo Center',cat:'arena',opts:['Barclays Center','Madison Square Garden','TD Garden','Wells Fargo Center']},
  {q:'Dans quelle salle jouent les Phoenix Suns ?',a:'Footprint Center',cat:'arena',opts:['Toyota Center','American Airlines Center','Ball Arena','Footprint Center']},
  {q:'Dans quelle salle jouent les Portland Trail Blazers ?',a:'Moda Center',cat:'arena',opts:['Chase Center','Golden 1 Center','Ball Arena','Moda Center']},
  {q:'Dans quelle salle jouent les Sacramento Kings ?',a:'Golden 1 Center',cat:'arena',opts:['Ball Arena','Chase Center','Moda Center','Golden 1 Center']},
  {q:'Dans quelle salle jouent les San Antonio Spurs ?',a:'AT&T Center',cat:'arena',opts:['Toyota Center','American Airlines Center','Smoothie King Center','AT&T Center']},
  {q:'Dans quelle salle jouent les Toronto Raptors ?',a:'Scotiabank Arena',cat:'arena',opts:['Bell Centre','Rogers Centre','Air Canada Centre','Scotiabank Arena']},
  {q:'Dans quelle salle jouent les Utah Jazz ?',a:'Delta Center',cat:'arena',opts:['Vivint Arena','Ball Arena','Moda Center','Delta Center']},
  {q:'Dans quelle salle jouent les Washington Wizards ?',a:'Capital One Arena',cat:'arena',opts:['Wells Fargo Center','TD Garden','Barclays Center','Capital One Arena']},

  // ═══════════ AJOUTS ═══════════

  // ─── CHAMPION / FINALES ───
  {q:'Champion NBA 2025 ?',a:'Oklahoma City Thunder',cat:'champion',opts:['Indiana Pacers','Oklahoma City Thunder','Boston Celtics','New York Knicks']},
  {q:'Perdant des Finales 2025 face au Thunder ?',a:'Indiana Pacers',cat:'finales',opts:['New York Knicks','Minnesota Timberwolves','Indiana Pacers','Boston Celtics']},
  {q:'Perdant des Finales 2017 face aux Warriors ?',a:'Cleveland Cavaliers',cat:'finales',opts:['Boston Celtics','San Antonio Spurs','Houston Rockets','Cleveland Cavaliers']},
  {q:'Perdant des Finales 2015 face aux Warriors ?',a:'Cleveland Cavaliers',cat:'finales',opts:['Atlanta Hawks','Houston Rockets','Cleveland Cavaliers','Chicago Bulls']},
  {q:'Perdant des Finales 2014 face aux Spurs ?',a:'Miami Heat',cat:'finales',opts:['Oklahoma City Thunder','Miami Heat','Indiana Pacers','Los Angeles Clippers']},
  {q:'Perdant des Finales 2013 face au Heat ?',a:'San Antonio Spurs',cat:'finales',opts:['Indiana Pacers','Memphis Grizzlies','San Antonio Spurs','Chicago Bulls']},
  {q:'Perdant des Finales 2012 face au Heat ?',a:'Oklahoma City Thunder',cat:'finales',opts:['Boston Celtics','San Antonio Spurs','Oklahoma City Thunder','Indiana Pacers']},
  {q:'Perdant des Finales 2009 face aux Lakers ?',a:'Orlando Magic',cat:'finales',opts:['Cleveland Cavaliers','Denver Nuggets','Boston Celtics','Orlando Magic']},
  {q:'Perdant des Finales 2008 face aux Celtics ?',a:'Los Angeles Lakers',cat:'finales',opts:['Detroit Pistons','San Antonio Spurs','Los Angeles Lakers','Cleveland Cavaliers']},
  {q:'Perdant des Finales 2006 face au Heat ?',a:'Dallas Mavericks',cat:'finales',opts:['Detroit Pistons','Phoenix Suns','Dallas Mavericks','San Antonio Spurs']},
  {q:'Perdant des Finales 2002 face aux Lakers ?',a:'New Jersey Nets',cat:'finales',opts:['Sacramento Kings','Philadelphia 76ers','New Jersey Nets','Boston Celtics']},
  {q:'Perdant des Finales 2001 face aux Lakers ?',a:'Philadelphia 76ers',cat:'finales',opts:['Sacramento Kings','Milwaukee Bucks','Philadelphia 76ers','San Antonio Spurs']},
  {q:'Perdant des Finales 1996 face aux Bulls ?',a:'Seattle SuperSonics',cat:'finales',opts:['Utah Jazz','Orlando Magic','Seattle SuperSonics','Houston Rockets']},
  {q:'Combien de titres NBA les Chicago Bulls ont-ils remportés ?',a:'6',cat:'champion',opts:['5','6','7','8']},
  {q:'Quelle franchise possède le 2e plus grand nombre de titres NBA ?',a:'Los Angeles Lakers',cat:'champion',opts:['Chicago Bulls','Golden State Warriors','Los Angeles Lakers','San Antonio Spurs']},
  {q:'Combien de titres NBA les Golden State Warriors ont-ils remportés ?',a:'7',cat:'champion',opts:['5','6','7','8']},
  {q:'Quelle équipe a remporté son tout premier titre NBA en 2025 ?',a:'Oklahoma City Thunder',cat:'champion',opts:['Indiana Pacers','Oklahoma City Thunder','Minnesota Timberwolves','Denver Nuggets']},
  {q:'En quelle année les Denver Nuggets ont-ils gagné leur premier titre ?',a:'2023',cat:'champion',opts:['2021','2022','2023','2024']},
  {q:'En quelle année les Toronto Raptors ont-ils gagné leur seul titre ?',a:'2019',cat:'champion',opts:['2016','2018','2019','2020']},
  {q:'Quelle équipe a remporté le titre NBA en 1994 et 1995 ?',a:'Houston Rockets',cat:'champion',opts:['Chicago Bulls','New York Knicks','Houston Rockets','Orlando Magic']},

  // ─── MVP DES FINALES ───
  {q:'MVP des Finales 2025 ?',a:'Shai Gilgeous-Alexander',cat:'finals_mvp',opts:['Jalen Williams','Shai Gilgeous-Alexander','Tyrese Haliburton','Chet Holmgren']},
  {q:'MVP des Finales 1999, 2003 et 2005 ?',a:'Tim Duncan',cat:'finals_mvp',opts:['David Robinson','Tim Duncan','Tony Parker','Manu Ginóbili']},
  {q:'MVP des Finales 2000, 2001 et 2002 ?',a:'Shaquille O\'Neal',cat:'finals_mvp',opts:['Kobe Bryant','Shaquille O\'Neal','Derek Fisher','Robert Horry']},
  {q:'Qui détient le record de MVP des Finales (6) ?',a:'Michael Jordan',cat:'finals_mvp',opts:['LeBron James','Michael Jordan','Magic Johnson','Shaquille O\'Neal']},
  {q:'Qui fut MVP des Finales 1994 et 1995 avec Houston ?',a:'Hakeem Olajuwon',cat:'finals_mvp',opts:['Clyde Drexler','Hakeem Olajuwon','Sam Cassell','Robert Horry']},

  // ─── ROOKIE DE L'ANNÉE ───
  {q:'Rookie de l\'Année 2025 ?',a:'Stephon Castle',cat:'roty',opts:['Zaccharie Risacher','Stephon Castle','Jaylen Wells','Alex Sarr']},
  {q:'Rookie de l\'Année 2016 ?',a:'Karl-Anthony Towns',cat:'roty',opts:['Kristaps Porziņģis','Karl-Anthony Towns','Devin Booker','Jahlil Okafor']},
  {q:'Rookie de l\'Année 2014 ?',a:'Michael Carter-Williams',cat:'roty',opts:['Victor Oladipo','Michael Carter-Williams','Trey Burke','Giannis Antetokounmpo']},
  {q:'Rookie de l\'Année 2013 ?',a:'Damian Lillard',cat:'roty',opts:['Anthony Davis','Damian Lillard','Bradley Beal','Andre Drummond']},
  {q:'Rookie de l\'Année 2010 ?',a:'Tyreke Evans',cat:'roty',opts:['Stephen Curry','Tyreke Evans','James Harden','Brandon Jennings']},
  {q:'Rookie de l\'Année 2004 ?',a:'LeBron James',cat:'roty',opts:['Carmelo Anthony','LeBron James','Dwyane Wade','Chris Bosh']},
  {q:'Rookie de l\'Année 1997 ?',a:'Allen Iverson',cat:'roty',opts:['Kobe Bryant','Allen Iverson','Stephon Marbury','Ray Allen']},
  {q:'Rookie de l\'Année 2000 ?',a:'Elton Brand',cat:'roty',opts:['Steve Francis','Elton Brand','Lamar Odom','Wally Szczerbiak']},

  // ─── 6e HOMME & PROGRESSION ───
  {q:'Meilleur 6e homme 2025 ?',a:'Payton Pritchard',cat:'sixthman',opts:['Malik Beasley','Payton Pritchard','Naz Reid','Ty Jerome']},
  {q:'Meilleur 6e homme 2024 ?',a:'Naz Reid',cat:'sixthman',opts:['Malik Monk','Naz Reid','Bobby Portis','Norman Powell']},
  {q:'Meilleur 6e homme 2023 ?',a:'Malcolm Brogdon',cat:'sixthman',opts:['Immanuel Quickley','Malcolm Brogdon','Bobby Portis','Russell Westbrook']},
  {q:'Meilleur 6e homme 2022 ?',a:'Tyler Herro',cat:'sixthman',opts:['Kevin Love','Tyler Herro','Cameron Johnson','Jordan Clarkson']},
  {q:'Meilleur 6e homme 2021 ?',a:'Jordan Clarkson',cat:'sixthman',opts:['Derrick Rose','Jordan Clarkson','Joe Ingles','Montrezl Harrell']},
  {q:'Meilleur 6e homme 2012 ?',a:'James Harden',cat:'sixthman',opts:['Lou Williams','James Harden','Jamal Crawford','Jason Terry']},
  {q:'Quel joueur a remporté 3 fois le trophée de 6e homme ?',a:'Lou Williams',cat:'sixthman',opts:['Jamal Crawford','Lou Williams','Manu Ginóbili','Ricky Pierce']},
  {q:'Joueur ayant le plus progressé (MIP) 2025 ?',a:'Dyson Daniels',cat:'mip',opts:['Cade Cunningham','Dyson Daniels','Christian Braun','Ivica Zubac']},
  {q:'Joueur ayant le plus progressé (MIP) 2023 ?',a:'Lauri Markkanen',cat:'mip',opts:['Shai Gilgeous-Alexander','Lauri Markkanen','Jalen Brunson','Tyrese Haliburton']},
  {q:'Joueur ayant le plus progressé (MIP) 2022 ?',a:'Ja Morant',cat:'mip',opts:['Dejounte Murray','Ja Morant','Darius Garland','Miles Bridges']},
  {q:'Joueur ayant le plus progressé (MIP) 2020 ?',a:'Brandon Ingram',cat:'mip',opts:['Bam Adebayo','Brandon Ingram','Luka Dončić','Devonte\' Graham']},
  {q:'Joueur ayant le plus progressé (MIP) 2019 ?',a:'Pascal Siakam',cat:'mip',opts:['D\'Angelo Russell','Pascal Siakam','De\'Aaron Fox','Domantas Sabonis']},
  {q:'Joueur ayant le plus progressé (MIP) 2017 ?',a:'Giannis Antetokounmpo',cat:'mip',opts:['Rudy Gobert','Giannis Antetokounmpo','Nikola Jokić','C.J. McCollum']},

  // ─── ALL-STAR GAME ───
  {q:'MVP du All-Star Game 2025 ?',a:'Stephen Curry',cat:'allstar',opts:['Shai Gilgeous-Alexander','Stephen Curry','Jayson Tatum','LeBron James']},
  {q:'MVP du All-Star Game 2024 ?',a:'Damian Lillard',cat:'allstar',opts:['Karl-Anthony Towns','Damian Lillard','Tyrese Haliburton','Jalen Brunson']},
  {q:'MVP du All-Star Game 2023 ?',a:'Jayson Tatum',cat:'allstar',opts:['Donovan Mitchell','Jayson Tatum','Giannis Antetokounmpo','Kyrie Irving']},
  {q:'Qui détient le record de sélections au All-Star Game ?',a:'LeBron James',cat:'allstar',opts:['Kareem Abdul-Jabbar','LeBron James','Kobe Bryant','Tim Duncan']},
  {q:'Qui a remporté le concours à 3 points en 2015 et 2021 ?',a:'Stephen Curry',cat:'allstar',opts:['Klay Thompson','Stephen Curry','Devin Booker','Damian Lillard']},
  {q:'Quel joueur a gagné le concours de dunks en 2000 ?',a:'Vince Carter',cat:'allstar',opts:['Tracy McGrady','Vince Carter','Steve Francis','Kobe Bryant']},

  // ─── DRAFT ───
  {q:'1er choix draft 2025 ?',a:'Cooper Flagg',cat:'draft',opts:['Dylan Harper','Cooper Flagg','Ace Bailey','V.J. Edgecombe']},
  {q:'1er choix draft 2013 ?',a:'Anthony Bennett',cat:'draft',opts:['Victor Oladipo','Anthony Bennett','Otto Porter Jr.','Ben McLemore']},
  {q:'1er choix draft 2006 ?',a:'Andrea Bargnani',cat:'draft',opts:['LaMarcus Aldridge','Andrea Bargnani','Adam Morrison','Tyrus Thomas']},
  {q:'1er choix draft 2005 ?',a:'Andrew Bogut',cat:'draft',opts:['Marvin Williams','Andrew Bogut','Deron Williams','Chris Paul']},
  {q:'1er choix draft 2002 ?',a:'Yao Ming',cat:'draft',opts:['Jay Williams','Yao Ming','Mike Dunleavy Jr.','Amar\'e Stoudemire']},
  {q:'1er choix draft 2001 ?',a:'Kwame Brown',cat:'draft',opts:['Tyson Chandler','Kwame Brown','Pau Gasol','Jason Richardson']},
  {q:'1er choix draft 1997 ?',a:'Tim Duncan',cat:'draft',opts:['Keith Van Horn','Tim Duncan','Chauncey Billups','Tracy McGrady']},
  {q:'1er choix draft 1996 ?',a:'Allen Iverson',cat:'draft',opts:['Marcus Camby','Allen Iverson','Stephon Marbury','Ray Allen']},
  {q:'1er choix draft 1992 ?',a:'Shaquille O\'Neal',cat:'draft',opts:['Alonzo Mourning','Shaquille O\'Neal','Christian Laettner','Jim Jackson']},
  {q:'1er choix draft 1984 ?',a:'Hakeem Olajuwon',cat:'draft',opts:['Michael Jordan','Hakeem Olajuwon','Sam Bowie','Charles Barkley']},
  {q:'À quel rang Michael Jordan a-t-il été drafté en 1984 ?',a:'3e',cat:'draft',opts:['1er','2e','3e','5e']},
  {q:'À quel rang Nikola Jokić a-t-il été drafté ?',a:'41e',cat:'draft',opts:['15e','27e','41e','57e']},
  {q:'À quel rang Manu Ginóbili a-t-il été drafté ?',a:'57e',cat:'draft',opts:['28e','41e','57e','60e']},
  {q:'À quel rang Kawhi Leonard a-t-il été drafté ?',a:'15e',cat:'draft',opts:['9e','15e','21e','30e']},
  {q:'À quel rang Jimmy Butler a-t-il été drafté ?',a:'30e',cat:'draft',opts:['18e','24e','30e','41e']},
  {q:'À quel rang Luka Dončić a-t-il été drafté ?',a:'3e',cat:'draft',opts:['1er','2e','3e','5e']},
  {q:'À quel rang Damian Lillard a-t-il été drafté ?',a:'6e',cat:'draft',opts:['3e','6e','11e','15e']},
  {q:'Quelle équipe a sélectionné Luka Dončić à la draft 2018 avant de l\'échanger ?',a:'Atlanta Hawks',cat:'draft',opts:['Dallas Mavericks','Atlanta Hawks','Sacramento Kings','Orlando Magic']},
  {q:'Quelle équipe a drafté Kobe Bryant en 1996 avant de l\'échanger ?',a:'Charlotte Hornets',cat:'draft',opts:['Los Angeles Lakers','Charlotte Hornets','Philadelphia 76ers','New Jersey Nets']},
  {q:'Quelle équipe a drafté Victor Wembanyama en 2023 ?',a:'San Antonio Spurs',cat:'draft',opts:['Charlotte Hornets','San Antonio Spurs','Portland Trail Blazers','Houston Rockets']},
  {q:'Quelle équipe a drafté Cooper Flagg en 2025 ?',a:'Dallas Mavericks',cat:'draft',opts:['San Antonio Spurs','Dallas Mavericks','Utah Jazz','Charlotte Hornets']},
  {q:'Quelle équipe a drafté Stephen Curry en 2009 ?',a:'Golden State Warriors',cat:'draft',opts:['Sacramento Kings','Golden State Warriors','Minnesota Timberwolves','New York Knicks']},

  // ─── TRANSFERTS ───
  {q:'En février 2025, Luka Dončić est échangé à quelle équipe ?',a:'Los Angeles Lakers',cat:'trade',opts:['Golden State Warriors','Los Angeles Lakers','New York Knicks','Brooklyn Nets']},
  {q:'Quel joueur Dallas a-t-il reçu en échange de Luka Dončić en 2025 ?',a:'Anthony Davis',cat:'trade',opts:['LeBron James','Anthony Davis','Austin Reaves','Rui Hachimura']},
  {q:'En février 2025, Jimmy Butler est échangé à quelle équipe ?',a:'Golden State Warriors',cat:'trade',opts:['Phoenix Suns','Golden State Warriors','Milwaukee Bucks','Dallas Mavericks']},
  {q:'En 2025, De\'Aaron Fox est échangé à quelle équipe ?',a:'San Antonio Spurs',cat:'trade',opts:['Chicago Bulls','San Antonio Spurs','Houston Rockets','Orlando Magic']},
  {q:'En 2023, Damian Lillard est échangé à quelle équipe ?',a:'Milwaukee Bucks',cat:'trade',opts:['Miami Heat','Milwaukee Bucks','Brooklyn Nets','Toronto Raptors']},
  {q:'En 2023, Bradley Beal est échangé à quelle équipe ?',a:'Phoenix Suns',cat:'trade',opts:['Miami Heat','Phoenix Suns','Milwaukee Bucks','Chicago Bulls']},
  {q:'En 2022, Rudy Gobert est échangé à quelle équipe ?',a:'Minnesota Timberwolves',cat:'trade',opts:['Toronto Raptors','Minnesota Timberwolves','Atlanta Hawks','Portland Trail Blazers']},
  {q:'En 2019, Anthony Davis est échangé aux Lakers par quelle équipe ?',a:'New Orleans Pelicans',cat:'trade',opts:['Memphis Grizzlies','New Orleans Pelicans','Sacramento Kings','Charlotte Hornets']},
  {q:'En 2019, Russell Westbrook est échangé à Houston contre quel joueur ?',a:'Chris Paul',cat:'trade',opts:['James Harden','Chris Paul','Clint Capela','Eric Gordon']},
  {q:'En 2017, Jimmy Butler quitte Chicago pour quelle équipe ?',a:'Minnesota Timberwolves',cat:'trade',opts:['Philadelphia 76ers','Minnesota Timberwolves','Miami Heat','Boston Celtics']},
  {q:'En 2017, Kyrie Irving est échangé à quelle équipe ?',a:'Boston Celtics',cat:'trade',opts:['Brooklyn Nets','Boston Celtics','New York Knicks','Dallas Mavericks']},
  {q:'En 2013, Paul Pierce et Kevin Garnett sont échangés à quelle équipe ?',a:'Brooklyn Nets',cat:'trade',opts:['Los Angeles Clippers','Brooklyn Nets','New York Knicks','Washington Wizards']},
  {q:'En 2011, Carmelo Anthony quitte Denver pour quelle équipe ?',a:'New York Knicks',cat:'trade',opts:['Brooklyn Nets','New York Knicks','Chicago Bulls','Los Angeles Lakers']},
  {q:'En 2008, Pau Gasol rejoint les Lakers depuis quelle équipe ?',a:'Memphis Grizzlies',cat:'trade',opts:['Chicago Bulls','Memphis Grizzlies','San Antonio Spurs','Sacramento Kings']},
  {q:'En 2007, Kevin Garnett rejoint Boston depuis quelle équipe ?',a:'Minnesota Timberwolves',cat:'trade',opts:['Denver Nuggets','Minnesota Timberwolves','Phoenix Suns','Milwaukee Bucks']},
  {q:'En 2020, Chris Paul rejoint Phoenix depuis quelle équipe ?',a:'Oklahoma City Thunder',cat:'trade',opts:['Houston Rockets','Oklahoma City Thunder','LA Clippers','New Orleans Pelicans']},

  // ─── MAILLOTS ───
  {q:'Numéro de maillot de Luka Dončić ?',a:'77',cat:'jersey',opts:['7','11','77','41']},
  {q:'Numéro de maillot de Nikola Jokić ?',a:'15',cat:'jersey',opts:['5','15','25','11']},
  {q:'Numéro de maillot de Victor Wembanyama ?',a:'1',cat:'jersey',opts:['0','1','21','32']},
  {q:'Numéro de maillot de Jayson Tatum ?',a:'0',cat:'jersey',opts:['0','7','11','22']},
  {q:'Numéro de maillot de Bill Russell ?',a:'6',cat:'jersey',opts:['6','11','21','33']},
  {q:'Numéro de maillot de Wilt Chamberlain ?',a:'13',cat:'jersey',opts:['4','13','21','32']},
  {q:'Numéro de maillot de Scottie Pippen ?',a:'33',cat:'jersey',opts:['23','32','33','91']},
  {q:'Numéro de maillot de Patrick Ewing aux Knicks ?',a:'33',cat:'jersey',opts:['22','33','44','55']},
  {q:'Numéro de maillot de Kevin Garnett ?',a:'21',cat:'jersey',opts:['5','12','21','32']},
  {q:'Numéro de maillot de Dwyane Wade ?',a:'3',cat:'jersey',opts:['1','3','9','13']},
  {q:'Numéro de maillot de Chris Paul ?',a:'3',cat:'jersey',opts:['3','11','13','21']},
  {q:'Numéro de maillot de Kyrie Irving ?',a:'11',cat:'jersey',opts:['2','7','11','23']},
  {q:'Numéro de maillot de Kawhi Leonard ?',a:'2',cat:'jersey',opts:['2','13','15','22']},
  {q:'Numéro de maillot de Anthony Edwards ?',a:'5',cat:'jersey',opts:['1','5','11','22']},
  {q:'Numéro de maillot de Ja Morant ?',a:'12',cat:'jersey',opts:['1','12','22','32']},
  {q:'Numéro de maillot de Devin Booker ?',a:'1',cat:'jersey',opts:['0','1','3','11']},
  {q:'Numéro de maillot de Trae Young ?',a:'11',cat:'jersey',opts:['1','5','11','23']},
  {q:'Numéro de maillot de Jaylen Brown ?',a:'7',cat:'jersey',opts:['0','7','11','13']},
  {q:'Numéro de maillot de Klay Thompson aux Warriors ?',a:'11',cat:'jersey',opts:['3','11','23','30']},
  {q:'Numéro de maillot de Damian Lillard ?',a:'0',cat:'jersey',opts:['0','1','3','11']},
  {q:'Numéro de maillot de Russell Westbrook ?',a:'0',cat:'jersey',opts:['0','4','13','35']},
  {q:'Numéro de maillot de Zion Williamson ?',a:'1',cat:'jersey',opts:['0','1','2','21']},

  // ─── SURNOMS ───
  {q:'Surnom de Nikola Jokić ?',a:'The Joker',cat:'surnom',opts:['The Serbian Wall','The Joker','Big Honey','The Beast']},
  {q:'Surnom de Luka Dončić ?',a:'Luka Magic',cat:'surnom',opts:['El Matador','Luka Magic','The Wonder Boy','Slovenian Sniper']},
  {q:'Surnom de Anthony Edwards ?',a:'Ant-Man',cat:'surnom',opts:['AE1','Ant-Man','The Wolf','Edwards Air']},
  {q:'Surnom de Jimmy Butler ?',a:'Jimmy Buckets',cat:'surnom',opts:['Jimmy G','Jimmy Buckets','The Closer','Butler Time']},
  {q:'Surnom de Anthony Davis ?',a:'The Brow',cat:'surnom',opts:['AD23','The Brow','The Unibrow King','Big Easy']},
  {q:'Surnom de Chris Paul ?',a:'CP3',cat:'surnom',opts:['The Point God','CP3','The General','Lil Chris']},
  {q:'Surnom de Kyrie Irving ?',a:'Uncle Drew',cat:'surnom',opts:['Kai','Uncle Drew','Mr. Handles','The Wizard']},
  {q:'Surnom de Russell Westbrook ?',a:'Brodie',cat:'surnom',opts:['Russ Money','Brodie','Mr. Triple-Double','Westbrick']},
  {q:'Surnom de George Gervin ?',a:'The Iceman',cat:'surnom',opts:['The Finger','The Iceman','Big George','Silk']},
  {q:'Surnom de Kevin Garnett ?',a:'The Big Ticket',cat:'surnom',opts:['KG21','The Big Ticket','The Wolf','Da Kid']},
  {q:'Surnom de Ray Allen ?',a:'Jesus Shuttlesworth',cat:'surnom',opts:['Sugar Ray','Jesus Shuttlesworth','The Sniper','Triple R']},
  {q:'Surnom de Larry Bird ?',a:'Larry Legend',cat:'surnom',opts:['The Hick from French Lick','Larry Legend','Bird Man','The Sniper']},
  {q:'Surnom de Ben Wallace ?',a:'Big Ben',cat:'surnom',opts:['The Wall','Big Ben','Bad Ben','The Fro']},
  {q:'Surnom de Rudy Gobert ?',a:'Gobzilla',cat:'surnom',opts:['The French Tower','Gobzilla','Rudy Rim','The Wall']},
  {q:'Surnom de Tony Parker ?',a:'TP',cat:'surnom',opts:['Le Petit Prince','TP','Frenchie','The Blur']},
  {q:'Surnom de Jason Williams ?',a:'White Chocolate',cat:'surnom',opts:['J-Will','White Chocolate','The Magician','Sugar J']},
  {q:'Surnom de Earl Monroe ?',a:'The Pearl',cat:'surnom',opts:['The Duke','The Pearl','Earl the Wizard','Black Magic']},
  {q:'Surnom de Draymond Green ?',a:'Dray',cat:'surnom',opts:['The Enforcer','Dray','Money Green','The Motor']},

  // ─── NATIONALITÉS ───
  {q:'Nationalité de Shai Gilgeous-Alexander ?',a:'Canadien',cat:'pays',opts:['Américain','Canadien','Britannique','Jamaïcain']},
  {q:'Nationalité de Jamal Murray ?',a:'Canadien',cat:'pays',opts:['Américain','Canadien','Australien','Britannique']},
  {q:'Nationalité de Andrew Wiggins ?',a:'Canadien',cat:'pays',opts:['Américain','Canadien','Bahaméen','Jamaïcain']},
  {q:'Nationalité de Franz Wagner ?',a:'Allemand',cat:'pays',opts:['Autrichien','Allemand','Suisse','Néerlandais']},
  {q:'Nationalité de Dennis Schröder ?',a:'Allemand',cat:'pays',opts:['Allemand','Gambien','Autrichien','Belge']},
  {q:'Nationalité de Alperen Şengün ?',a:'Turc',cat:'pays',opts:['Grec','Turc','Géorgien','Bulgare']},
  {q:'Nationalité de Domantas Sabonis ?',a:'Lituanien',cat:'pays',opts:['Letton','Lituanien','Estonien','Polonais']},
  {q:'Nationalité de Jonas Valančiūnas ?',a:'Lituanien',cat:'pays',opts:['Letton','Lituanien','Ukrainien','Estonien']},
  {q:'Nationalité de Nikola Vučević ?',a:'Monténégrin',cat:'pays',opts:['Serbe','Monténégrin','Croate','Bosnien']},
  {q:'Nationalité de Goran Dragić ?',a:'Slovène',cat:'pays',opts:['Croate','Slovène','Serbe','Bosnien']},
  {q:'Nationalité de Ricky Rubio ?',a:'Espagnol',cat:'pays',opts:['Argentin','Espagnol','Portugais','Italien']},
  {q:'Nationalité de Marc Gasol ?',a:'Espagnol',cat:'pays',opts:['Italien','Espagnol','Portugais','Français']},
  {q:'Nationalité de Toni Kukoč ?',a:'Croate',cat:'pays',opts:['Serbe','Croate','Slovène','Bosnien']},
  {q:'Nationalité de Dražen Petrović ?',a:'Croate',cat:'pays',opts:['Serbe','Croate','Slovène','Monténégrin']},
  {q:'Nationalité de Vlade Divac ?',a:'Serbe',cat:'pays',opts:['Croate','Serbe','Monténégrin','Macédonien']},
  {q:'Nationalité de Steven Adams ?',a:'Néo-Zélandais',cat:'pays',opts:['Australien','Néo-Zélandais','Sud-Africain','Fidjien']},
  {q:'Nationalité de Josh Giddey ?',a:'Australien',cat:'pays',opts:['Néo-Zélandais','Australien','Britannique','Canadien']},
  {q:'Nationalité de Patty Mills ?',a:'Australien',cat:'pays',opts:['Néo-Zélandais','Australien','Fidjien','Papou']},
  {q:'Nationalité de Al Horford ?',a:'Dominicain',cat:'pays',opts:['Portoricain','Dominicain','Cubain','Vénézuélien']},
  {q:'Nationalité de Andrei Kirilenko ?',a:'Russe',cat:'pays',opts:['Ukrainien','Russe','Biélorusse','Lituanien']},
  {q:'Nationalité de Evan Fournier ?',a:'Français',cat:'pays',opts:['Belge','Français','Suisse','Canadien']},
  {q:'Nationalité de Nicolas Batum ?',a:'Français',cat:'pays',opts:['Camerounais','Français','Belge','Sénégalais']},
  {q:'Nationalité de Bilal Coulibaly ?',a:'Français',cat:'pays',opts:['Malien','Français','Sénégalais','Belge']},
  {q:'Nationalité de Zaccharie Risacher ?',a:'Français',cat:'pays',opts:['Belge','Français','Suisse','Espagnol']},
  {q:'Nationalité de Deni Avdija ?',a:'Israélien',cat:'pays',opts:['Serbe','Israélien','Turc','Grec']},

  // ─── UNIVERSITÉS ───
  {q:'Dans quelle université a joué Michael Jordan ?',a:'North Carolina',cat:'college',opts:['Duke','North Carolina','Kentucky','UCLA']},
  {q:'Dans quelle université a joué Stephen Curry ?',a:'Davidson',cat:'college',opts:['Duke','Davidson','Gonzaga','Villanova']},
  {q:'Dans quelle université a joué Kevin Durant ?',a:'Texas',cat:'college',opts:['Kansas','Texas','Oklahoma','Baylor']},
  {q:'Dans quelle université a joué Tim Duncan ?',a:'Wake Forest',cat:'college',opts:['Duke','Wake Forest','North Carolina','Georgetown']},
  {q:'Dans quelle université a joué Kareem Abdul-Jabbar ?',a:'UCLA',cat:'college',opts:['USC','UCLA','Stanford','Michigan']},
  {q:'Dans quelle université a joué Magic Johnson ?',a:'Michigan State',cat:'college',opts:['Michigan','Michigan State','Indiana','Ohio State']},
  {q:'Dans quelle université a joué Larry Bird ?',a:'Indiana State',cat:'college',opts:['Indiana','Indiana State','Purdue','Notre Dame']},
  {q:'Dans quelle université a joué Anthony Davis ?',a:'Kentucky',cat:'college',opts:['Duke','Kentucky','Kansas','Louisville']},
  {q:'Dans quelle université a joué Zion Williamson ?',a:'Duke',cat:'college',opts:['North Carolina','Duke','Kentucky','Clemson']},
  {q:'Dans quelle université a joué Jayson Tatum ?',a:'Duke',cat:'college',opts:['Kentucky','Duke','Kansas','Missouri']},
  {q:'Dans quelle université a joué Damian Lillard ?',a:'Weber State',cat:'college',opts:['Oregon','Weber State','Utah','Boise State']},
  {q:'Dans quelle université a joué Kawhi Leonard ?',a:'San Diego State',cat:'college',opts:['UCLA','San Diego State','Arizona','USC']},
  {q:'Dans quelle université a joué James Harden ?',a:'Arizona State',cat:'college',opts:['Arizona','Arizona State','UCLA','Texas']},
  {q:'Dans quelle université a joué Carmelo Anthony ?',a:'Syracuse',cat:'college',opts:['Georgetown','Syracuse','UConn','Villanova']},
  {q:'Dans quelle université a joué Dwyane Wade ?',a:'Marquette',cat:'college',opts:['DePaul','Marquette','Illinois','Wisconsin']},
  {q:'Dans quelle université a joué Chris Paul ?',a:'Wake Forest',cat:'college',opts:['Duke','Wake Forest','North Carolina','Clemson']},
  {q:'Dans quelle université a joué Russell Westbrook ?',a:'UCLA',cat:'college',opts:['USC','UCLA','Arizona','Stanford']},
  {q:'Dans quelle université a joué Cooper Flagg ?',a:'Duke',cat:'college',opts:['North Carolina','Duke','Kansas','Kentucky']},
  {q:'Dans quelle université LeBron James a-t-il joué ?',a:'Aucune',cat:'college',opts:['Ohio State','Aucune','Akron','Duke']},

  // ─── FRANCHISES / HISTOIRE ───
  {q:'Les Seattle SuperSonics sont devenus quelle franchise ?',a:'Oklahoma City Thunder',cat:'franchise',opts:['Memphis Grizzlies','Oklahoma City Thunder','Utah Jazz','New Orleans Pelicans']},
  {q:'Les Vancouver Grizzlies sont devenus quelle franchise ?',a:'Memphis Grizzlies',cat:'franchise',opts:['Toronto Raptors','Memphis Grizzlies','Charlotte Hornets','Oklahoma City Thunder']},
  {q:'Les New Jersey Nets sont devenus quelle franchise ?',a:'Brooklyn Nets',cat:'franchise',opts:['New York Knicks','Brooklyn Nets','Philadelphia 76ers','Washington Wizards']},
  {q:'Les Washington Bullets sont devenus quelle franchise ?',a:'Washington Wizards',cat:'franchise',opts:['Charlotte Hornets','Washington Wizards','Brooklyn Nets','Orlando Magic']},
  {q:'Les Minneapolis Lakers sont devenus quelle franchise ?',a:'Los Angeles Lakers',cat:'franchise',opts:['Minnesota Timberwolves','Los Angeles Lakers','Sacramento Kings','LA Clippers']},
  {q:'Les Syracuse Nationals sont devenus quelle franchise ?',a:'Philadelphia 76ers',cat:'franchise',opts:['New York Knicks','Philadelphia 76ers','Boston Celtics','Brooklyn Nets']},
  {q:'Les New Orleans Hornets sont devenus quelle franchise ?',a:'New Orleans Pelicans',cat:'franchise',opts:['Charlotte Hornets','New Orleans Pelicans','Memphis Grizzlies','Oklahoma City Thunder']},
  {q:'Les San Diego Clippers sont devenus quelle franchise ?',a:'LA Clippers',cat:'franchise',opts:['Sacramento Kings','LA Clippers','Phoenix Suns','Golden State Warriors']},
  {q:'Les Philadelphia Warriors sont devenus quelle franchise ?',a:'Golden State Warriors',cat:'franchise',opts:['Philadelphia 76ers','Golden State Warriors','Sacramento Kings','LA Clippers']},
  {q:'En quelle année la NBA a-t-elle été fondée ?',a:'1946',cat:'franchise',opts:['1936','1946','1950','1956']},
  {q:'Combien d\'équipes compte la NBA aujourd\'hui ?',a:'30',cat:'franchise',opts:['28','29','30','32']},
  {q:'Quelle est la seule franchise NBA basée au Canada ?',a:'Toronto Raptors',cat:'franchise',opts:['Detroit Pistons','Toronto Raptors','Minnesota Timberwolves','Buffalo Braves']},
  {q:'Quelle franchise a intégré la NBA en 1995 avec Toronto ?',a:'Vancouver Grizzlies',cat:'franchise',opts:['Orlando Magic','Vancouver Grizzlies','Charlotte Hornets','Miami Heat']},
  {q:'Dans quelle conférence jouent les Miami Heat ?',a:'Est',cat:'franchise',opts:['Est','Ouest','Centrale','Atlantique']},
  {q:'Dans quelle conférence jouent les Memphis Grizzlies ?',a:'Ouest',cat:'franchise',opts:['Est','Ouest','Sud','Centrale']},
  {q:'Dans quelle conférence jouent les Minnesota Timberwolves ?',a:'Ouest',cat:'franchise',opts:['Est','Ouest','Nord','Centrale']},

  // ─── RÈGLES ───
  {q:'Combien de minutes dure un quart-temps en NBA ?',a:'12',cat:'regles',opts:['10','12','15','20']},
  {q:'Combien de secondes dure la horloge des tirs en NBA ?',a:'24',cat:'regles',opts:['14','24','30','35']},
  {q:'Combien de fautes personnelles avant l\'exclusion en NBA ?',a:'6',cat:'regles',opts:['4','5','6','7']},
  {q:'Quelle est la hauteur d\'un panier de basket ?',a:'3,05 m',cat:'regles',opts:['2,95 m','3,05 m','3,15 m','3,25 m']},
  {q:'Combien de matchs compte une saison régulière NBA ?',a:'82',cat:'regles',opts:['72','78','82','86']},
  {q:'Combien de minutes dure une prolongation en NBA ?',a:'5',cat:'regles',opts:['3','5','7','10']},
  {q:'Combien d\'équipes se qualifient en playoffs par conférence ?',a:'8',cat:'regles',opts:['6','8','10','12']},
  {q:'Le play-in tournament concerne les équipes classées de quel rang à quel rang ?',a:'7e à 10e',cat:'regles',opts:['5e à 8e','7e à 10e','8e à 12e','9e à 12e']},
  {q:'Combien de joueurs par équipe sur le terrain ?',a:'5',cat:'regles',opts:['4','5','6','7']},
  {q:'Combien de secondes pour franchir la ligne médiane ?',a:'8',cat:'regles',opts:['5','8','10','12']},
  {q:'Une série de playoffs NBA se joue au meilleur de combien de matchs ?',a:'7',cat:'regles',opts:['3','5','7','9']},
  {q:'Combien de temps un joueur peut-il rester dans la raquette adverse ?',a:'3 secondes',cat:'regles',opts:['3 secondes','5 secondes','8 secondes','Illimité']},

  // ─── RECORDS ───
  {q:'Qui détient le record de triple-doubles en carrière ?',a:'Russell Westbrook',cat:'record',opts:['Oscar Robertson','Russell Westbrook','Magic Johnson','LeBron James']},
  {q:'Qui détient le record de rebonds en un match (55) ?',a:'Wilt Chamberlain',cat:'record',opts:['Bill Russell','Wilt Chamberlain','Dennis Rodman','Moses Malone']},
  {q:'Qui détient le record de passes en un match (30) ?',a:'Scott Skiles',cat:'record',opts:['John Stockton','Scott Skiles','Magic Johnson','Rajon Rondo']},
  {q:'Qui détient le record de points en un quart-temps (37) ?',a:'Klay Thompson',cat:'record',opts:['Stephen Curry','Klay Thompson','Kobe Bryant','George Gervin']},
  {q:'Qui a joué le plus de matchs en NBA (1611) ?',a:'Robert Parish',cat:'record',opts:['Kareem Abdul-Jabbar','Robert Parish','Vince Carter','Dirk Nowitzki']},
  {q:'Qui détient le record de matchs consécutifs joués (1192) ?',a:'A.C. Green',cat:'record',opts:['Karl Malone','A.C. Green','John Stockton','Randy Smith']},
  {q:'Quel est le plus jeune MVP de l\'histoire de la NBA ?',a:'Derrick Rose',cat:'record',opts:['LeBron James','Derrick Rose','Kevin Durant','Wes Unseld']},
  {q:'Quel joueur a été élu MVP à l\'unanimité en 2016 ?',a:'Stephen Curry',cat:'record',opts:['LeBron James','Stephen Curry','Kawhi Leonard','Russell Westbrook']},
  {q:'Combien de saisons LeBron James a-t-il jouées avant 2025 ?',a:'22',cat:'record',opts:['18','20','22','24']},
  {q:'Quel joueur détient le record de saisons consécutives à 25 points de moyenne ?',a:'LeBron James',cat:'record',opts:['Michael Jordan','LeBron James','Kevin Durant','Karl Malone']},
  {q:'Qui a réussi le plus de tirs à 3 points en une saison ?',a:'Stephen Curry',cat:'record',opts:['James Harden','Stephen Curry','Klay Thompson','Damian Lillard']},
  {q:'Quel joueur a réalisé un quadruple-double le plus récemment (1994) ?',a:'David Robinson',cat:'record',opts:['Hakeem Olajuwon','David Robinson','Shaquille O\'Neal','Dikembe Mutombo']},

  // ─── SCORING ───
  {q:'Combien de points LeBron James a-t-il marqués en carrière (record) ?',a:'Plus de 40 000',cat:'scoring',opts:['Plus de 30 000','Plus de 35 000','Plus de 40 000','Plus de 45 000']},
  {q:'Qui était le meilleur scoreur all-time avant LeBron James ?',a:'Kareem Abdul-Jabbar',cat:'scoring',opts:['Karl Malone','Kareem Abdul-Jabbar','Michael Jordan','Kobe Bryant']},
  {q:'Qui occupe la 3e place des meilleurs scoreurs all-time ?',a:'Karl Malone',cat:'scoring',opts:['Michael Jordan','Karl Malone','Kobe Bryant','Dirk Nowitzki']},
  {q:'Quel joueur a marqué 71 points dans un match en 2024 ?',a:'Joel Embiid',cat:'scoring',opts:['Luka Dončić','Joel Embiid','Devin Booker','Giannis Antetokounmpo']},
  {q:'Quel joueur a marqué 70 points dans un match en 2024 avec Minnesota ?',a:'Karl-Anthony Towns',cat:'scoring',opts:['Anthony Edwards','Karl-Anthony Towns','Devin Booker','Luka Dončić']},
  {q:'Combien de fois Michael Jordan a-t-il été meilleur scoreur de la saison ?',a:'10',cat:'scoring',opts:['7','8','10','12']},
];

const CAT_LABEL={champion:'🏆 Champion',mvp:'🌟 MVP',finals_mvp:'🏅 MVP Finals',draft:'🎓 Draft',scoring:'📊 Scoreur',record:'📖 Record',roty:'🌱 Rookie',dpoy:'🛡️ Défenseur',coach:'👨‍💼 Coach',surnom:'🎭 Surnom',pays:'🌍 International',finales:'🥈 Finaliste',slam_dunk:'💥 Dunk Contest',coach_year:'📋 Coach of Year',arena:'🏟️ Arène',jersey:'👕 Numéro',trade:'🔄 Trade'};

function MiniGameCulture({firebaseUser,profile,setProfile,guestCta}){
  const today=getMiniGameDate();
  const playKey='minigame_culture_'+today;
  const [phase,setPhase]=useState('loading');
  const [questions,setQuestions]=useState([]);
  const [idx,setIdx]=useState(0);
  const [selected,setSelected]=useState(null);
  const [score,setScore]=useState(0);
  const [todayResult,setTodayResult]=useState(null);
  // Barème en série : une bonne réponse vaut 1, la suivante 2, puis 3…
  // Une erreur fait retomber la valeur de la prochaine bonne réponse à 1.
  const [combo,setCombo]=useState(1);
  const NB_Q=10;
  const MAX_PTS=NB_Q*(NB_Q+1)/2; // 10 bonnes réponses d'affilée : 1+2+…+10 = 55

  useEffect(()=>{
    const existing=profile?.[playKey];
    if(existing?.completed){setTodayResult(existing);setPhase('result');return;}
    const seed=parseInt(today,10);
    let s=seed;
    const rng=()=>{s=(s*9301+49297)%233280;return s/233280;};
    const arr=[...NBA_CULTURE_DB];for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
    const shuffled=arr.slice(0,NB_Q);
    setQuestions(shuffled);
    setPhase('play');
  },[]);

  async function handleAnswer(opt){
    if(selected!==null)return;
    setSelected(opt);
    const ok=opt===questions[idx].a;
    if(ok)hapticSuccess();else hapticError();
    const newScore=score+(ok?combo:0);
    const nextCombo=ok?combo+1:1;
    setTimeout(async()=>{
      if(idx+1>=NB_Q){
        const result={completed:true,score:newScore,max:MAX_PTS,date:today,pointsAdded:false};
        setTodayResult(result);
        if(firebaseUser){
          try{
            const weekKey=getWeekKey(),monthKey=getMonthKey();
            const userRef=doc(db,'users',firebaseUser.uid);
            const userSnap=await getDoc(userRef);
            const userData=userSnap.exists()?userSnap.data():{};
            const newPoints=(userData.points||0)+newScore;
            const weekPts={...(userData.weekPts||{})};weekPts[weekKey]=(weekPts[weekKey]||0)+newScore;
            const monthPts={...(userData.monthPts||{})};monthPts[monthKey]=(monthPts[monthKey]||0)+newScore;
            const updated={...result,pointsAdded:true};
            await updateDoc(userRef,{[playKey]:updated,points:newPoints,weekPts,monthPts});
            if(setProfile)setProfile(p=>({...p,[playKey]:updated,points:newPoints,weekPts,monthPts}));
          }catch(e){}
        }
        setPhase('result');
      }else{
        setIdx(i=>i+1);setSelected(null);setScore(newScore);setCombo(nextCombo);
      }
    },900);
  }

  if(phase==='loading')return<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>⏳ Chargement…</div>;

  if(phase==='result'){
    const s=todayResult?.score||0;
    const pct=Math.min(100,Math.round((s/MAX_PTS)*100));
    const medal=pct>=90?'🏆':pct>=70?'🥇':pct>=50?'🥈':pct>=30?'🥉':'💪';
    return(
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,color:'var(--gold)',letterSpacing:1}}>🧠 CULTURE NBA</div>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:2}}>Résultat du jour</div>
        </div>
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:20,textAlign:'center'}}>
          <div style={{fontSize:56,marginBottom:8}}>{medal}</div>
          <div style={{fontSize:48,fontWeight:900,color:'var(--gold)',lineHeight:1}}>{s}</div>
          <div style={{fontSize:14,color:'var(--muted)',marginBottom:16}}>/ {todayResult?.max||MAX_PTS} pts</div>
          <div style={{background:'var(--s2)',borderRadius:8,height:10,overflow:'hidden'}}>
            <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,var(--gold),var(--gold2))',borderRadius:8,transition:'width .6s ease'}}/>
          </div>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:8}}>{pct}% du score maximum</div>
        </div>
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16,textAlign:'center'}}>
          <div style={{fontSize:13,color:'var(--muted)'}}>Revenez demain pour un nouveau quiz !</div>
        </div>
        {guestCta}
      </div>
    );
  }

  const q=questions[idx];
  if(!q)return null;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{textAlign:'center',marginBottom:4}}>
        <div style={{fontSize:22,fontWeight:800,color:'var(--gold)',letterSpacing:1}}>🧠 CULTURE NBA</div>
        <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>{CAT_LABEL[q.cat]||q.cat}</div>
      </div>
      <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:'10px 14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>Question {idx+1}/{NB_Q}</span>
          <span style={{fontSize:13,fontWeight:800,color:'var(--gold)'}}>{score} pts</span>
        </div>
        <div style={{fontSize:11,color:combo>1?'var(--orange)':'var(--muted)',fontWeight:700,marginTop:6}}>
          {combo>1?`🔥 Série de ${combo-1} · prochaine bonne réponse : +${combo} pts`:'Prochaine bonne réponse : +1 pt · enchaîne pour faire grimper la mise'}
        </div>
        <div style={{background:'var(--s2)',borderRadius:4,height:5,marginTop:8,overflow:'hidden'}}>
          <div style={{height:'100%',width:((idx)/NB_Q*100)+'%',background:'var(--gold)',borderRadius:4,transition:'width .3s'}}/>
        </div>
      </div>
      <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:'20px 16px',fontSize:16,fontWeight:700,color:'var(--txt)',lineHeight:1.4,textAlign:'center',minHeight:80,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {q.q}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {q.opts.map(opt=>{
          const isSelected=selected===opt;
          const isCorrect=opt===q.a;
          let bg='var(--s1)',border='1.5px solid var(--bdr)',color='var(--txt)';
          if(selected!==null){
            if(isCorrect){bg='color-mix(in srgb,var(--green) 15%,var(--s1))';border='1.5px solid var(--green)';color='var(--green)';}
            else if(isSelected){bg='color-mix(in srgb,var(--red) 15%,var(--s1))';border='1.5px solid var(--red)';color='var(--red)';}
          }
          return(
            <button key={opt} onClick={()=>handleAnswer(opt)} disabled={selected!==null} style={{padding:'14px 16px',background:bg,border,borderRadius:12,color,fontSize:14,fontWeight:600,cursor:selected!==null?'default':'pointer',textAlign:'left',transition:'all .2s',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>{opt}</span>
              {selected!==null&&isCorrect&&<span>✅</span>}
              {selected!==null&&isSelected&&!isCorrect&&<span>❌</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Parcours : retrouver un joueur à partir de ses franchises ───
   3 joueurs par jour, les mêmes pour tout le monde. Pour chacun, on choisit son
   niveau de risque avant de répondre : Cash (nom écrit, 5 pts), Carré (4 choix,
   3 pts) ou Duo (2 choix, 1 pt). */
const PARCOURS_MODES={
  cash:{label:'Cash',ico:'💰',pts:5,hint:'Tu écris le nom'},
  carre:{label:'Carré',ico:'🔲',pts:3,hint:'4 propositions'},
  duo:{label:'Duo',ico:'⚖️',pts:1,hint:'2 propositions'},
};
const PARCOURS_NB=3;
const PARCOURS_MAX=PARCOURS_NB*PARCOURS_MODES.cash.pts;
const posGroup=p=>/C/.test(p)?'C':/F/.test(p)?'F':'G';
const normName=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/[.'’-]/g,' ').replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/\s+/g,' ').trim();
function levenshtein(a,b){
  const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}
  return prev[n];
}
/* Réponse « Cash » acceptée : nom complet (fautes de frappe tolérées) ou nom de
   famille seul s'il n'appartient qu'à un joueur de la base. */
function cashMatches(input,player){
  const g=normName(input),full=normName(player.n);
  if(g.length<3)return false;
  if(g===full)return true;
  if(full.length>=8&&levenshtein(g,full)<=2)return true;
  const last=full.split(' ').slice(1).join(' ');
  if(!last)return false;
  const unique=PARCOURS_PLAYERS.filter(p=>normName(p.n).split(' ').slice(1).join(' ')===last).length===1;
  return unique&&(g===last||(last.length>=6&&levenshtein(g,last)<=1));
}
function parcoursOfDay(day){
  let s=(parseInt(day,10)*7+13)%233280;
  const rng=()=>{s=(s*9301+49297)%233280;return s/233280;};
  const pool=[...PARCOURS_PLAYERS];
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,PARCOURS_NB).map(player=>{
    // Leurres crédibles : même poste, carrière démarrée à la même époque
    const start=player.t[0].s;
    const near=pool.filter(p=>p.id!==player.id&&posGroup(p.p)===posGroup(player.p)&&Math.abs(p.t[0].s-start)<=8);
    const others=(near.length>=3?near:pool.filter(p=>p.id!==player.id)).slice(0,3);
    const carre=[player,...others].map(p=>p.n);
    for(let i=carre.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[carre[i],carre[j]]=[carre[j],carre[i]];}
    const duo=[player.n,others[0].n].sort(()=>rng()-0.5);
    return{player,carre,duo};
  });
}
function ParcoursCareer({player}){
  return(
    <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:'6px 14px'}}>
      {player.t.map((st,i)=>{
        const team=getTeam(st.f);
        const current=i===player.t.length-1&&st.e===PARCOURS_LAST_SEASON;
        const years=current?`depuis ${st.s}`:st.s===st.e?String(st.e):`${st.s} – ${st.e}`;
        return(
          <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<player.t.length-1?'1px solid var(--bdr)':'none'}}>
            <TeamBadge team={team} size={34}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--txt)'}}>{st.h?`${st.h}`:team.name}</div>
              {st.h&&<div style={{fontSize:11,color:'var(--muted)'}}>franchise devenue {team.name}</div>}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:'var(--gold)',whiteSpace:'nowrap'}}>{years}</div>
          </div>
        );
      })}
    </div>
  );
}
function MiniGameParcours({firebaseUser,profile,setProfile,guestCta}){
  const today=getMiniGameDate();
  const playKey='minigame_parcours_'+today;
  const rounds=useMemo(()=>parcoursOfDay(today),[today]);
  const existing=profile?.[playKey];
  const [idx,setIdx]=useState(0);
  const [mode,setMode]=useState(null);
  const [guess,setGuess]=useState('');
  const [answer,setAnswer]=useState(null); // {ok,given}
  const [answers,setAnswers]=useState([]);
  const [result,setResult]=useState(existing?.completed?existing:null);

  function submit(given){
    if(answer)return;
    const r=rounds[idx];
    const ok=mode==='cash'?cashMatches(given,r.player):given===r.player.n;
    if(ok)hapticSuccess();else hapticError();
    setAnswer({ok,given});
    setAnswers(a=>[...a,{id:r.player.id,n:r.player.n,mode,ok,pts:ok?PARCOURS_MODES[mode].pts:0}]);
  }
  async function next(){
    if(idx+1<rounds.length){setIdx(i=>i+1);setMode(null);setGuess('');setAnswer(null);return;}
    const score=answers.reduce((t,a)=>t+a.pts,0);
    const res={completed:true,score,max:PARCOURS_MAX,answers,date:today,pointsAdded:false};
    setResult(res);
    if(!firebaseUser)return;
    try{
      const weekKey=getWeekKey(),monthKey=getMonthKey();
      const userRef=doc(db,'users',firebaseUser.uid);
      const snap=await getDoc(userRef);const u=snap.exists()?snap.data():{};
      if(u[playKey]?.completed)return; // déjà joué depuis un autre appareil : pas de double crédit
      const weekPts={...(u.weekPts||{})};weekPts[weekKey]=(weekPts[weekKey]||0)+score;
      const monthPts={...(u.monthPts||{})};monthPts[monthKey]=(monthPts[monthKey]||0)+score;
      const saved={...res,pointsAdded:true};
      const upd={[playKey]:saved,points:(u.points||0)+score,weekPts,monthPts};
      await updateDoc(userRef,upd);
      if(setProfile)setProfile(p=>({...p,...upd}));
    }catch(e){console.error(e);}
  }

  const header=(sub)=>(
    <div style={{textAlign:'center',marginBottom:4}}>
      <div style={{fontSize:22,fontWeight:800,color:'var(--gold)',letterSpacing:1}}>🧭 PARCOURS</div>
      <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>{sub}</div>
    </div>
  );

  if(result){
    return(
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {header('Résultat du jour')}
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:20,textAlign:'center'}}>
          <div style={{fontSize:48,fontWeight:900,color:'var(--gold)',lineHeight:1}}>{result.score}</div>
          <div style={{fontSize:14,color:'var(--muted)'}}>/ {result.max||PARCOURS_MAX} pts</div>
        </div>
        {(result.answers||[]).map((a,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,padding:'12px 14px'}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--txt)'}}>{a.ok?'✅':'❌'} {a.n}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>{PARCOURS_MODES[a.mode]?.ico} {PARCOURS_MODES[a.mode]?.label}</div>
            </div>
            <div style={{fontSize:15,fontWeight:800,color:a.ok?'var(--green)':'var(--muted)'}}>+{a.pts}</div>
          </div>
        ))}
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16,textAlign:'center',fontSize:13,color:'var(--muted)'}}>Reviens demain pour 3 nouveaux parcours !</div>
        {guestCta}
      </div>
    );
  }

  const r=rounds[idx];
  if(!r)return null;
  const choices=mode==='carre'?r.carre:mode==='duo'?r.duo:null;
  const total=answers.reduce((t,a)=>t+a.pts,0);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {header('Qui a eu cette carrière ?')}
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700,color:'var(--muted)',padding:'0 4px'}}>
        <span>Joueur {idx+1}/{rounds.length}</span><span style={{color:'var(--gold)'}}>{total} pts</span>
      </div>
      <ParcoursCareer player={r.player}/>

      {!mode&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:13,color:'var(--muted)',textAlign:'center'}}>Choisis comment tu réponds :</div>
          {Object.entries(PARCOURS_MODES).map(([k,m])=>(
            <button key={k} onClick={()=>{hapticTap();setMode(k);}} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'var(--s1)',border:'1.5px solid var(--bdr)',borderRadius:12,cursor:'pointer',textAlign:'left',color:'var(--txt)'}}>
              <span style={{fontSize:24}}>{m.ico}</span>
              <span style={{flex:1}}><span style={{display:'block',fontSize:15,fontWeight:800}}>{m.label}</span><span style={{fontSize:12,color:'var(--muted)'}}>{m.hint}</span></span>
              <span style={{fontSize:14,fontWeight:800,color:'var(--gold)'}}>+{m.pts} pt{m.pts>1?'s':''}</span>
            </button>
          ))}
        </div>
      )}

      {mode==='cash'&&!answer&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <input className="ainput plain" autoFocus autoCapitalize="words" autoCorrect="off" spellCheck={false} placeholder="Nom du joueur" value={guess}
            onChange={e=>setGuess(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&guess.trim())submit(guess);}} style={{paddingLeft:14}}/>
          <button className="abtn" disabled={!guess.trim()} onClick={()=>submit(guess)}>Valider (+5 pts)</button>
        </div>
      )}

      {choices&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {choices.map(name=>{
            const done=!!answer,isRight=name===r.player.n,isPicked=answer?.given===name;
            let bg='var(--s1)',border='1.5px solid var(--bdr)',color='var(--txt)';
            if(done&&isRight){bg='color-mix(in srgb,var(--green) 15%,var(--s1))';border='1.5px solid var(--green)';color='var(--green)';}
            else if(done&&isPicked){bg='color-mix(in srgb,var(--red) 15%,var(--s1))';border='1.5px solid var(--red)';color='var(--red)';}
            return(
              <button key={name} disabled={done} onClick={()=>submit(name)} style={{padding:'14px 16px',background:bg,border,borderRadius:12,color,fontSize:14,fontWeight:600,cursor:done?'default':'pointer',textAlign:'left'}}>{name}</button>
            );
          })}
        </div>
      )}

      {answer&&(
        <div style={{background:'var(--s1)',border:`1.5px solid ${answer.ok?'var(--green)':'var(--red)'}`,borderRadius:14,padding:16,textAlign:'center'}}>
          <div style={{fontSize:18,fontWeight:800,color:answer.ok?'var(--green)':'var(--red)',marginBottom:4}}>
            {answer.ok?`Bravo ! +${PARCOURS_MODES[mode].pts} pt${PARCOURS_MODES[mode].pts>1?'s':''}`:'Raté !'}
          </div>
          <div style={{fontSize:14,color:'var(--txt)',marginBottom:12}}>C'était <strong>{r.player.n}</strong></div>
          <button className="abtn" onClick={next}>{idx+1<rounds.length?'Joueur suivant':'Voir mon résultat'}</button>
        </div>
      )}
    </div>
  );
}

/* ─── Trades de l'été ─── */
const TRADES_PLAYERS=[
  {id:'tp01',name:'Derrick White',team:'Boston Celtics'},
  {id:'tp02',name:'Karl-Anthony Towns',team:'New York Knicks'},
  {id:'tp03',name:'Mikal Bridges',team:'New York Knicks'},
  {id:'tp04',name:'Jordan Clarkson',team:'New York Knicks'},
  {id:'tp05',name:'Evan Mobley',team:'Cleveland Cavaliers'},
  {id:'tp06',name:'Dennis Schröder',team:'Cleveland Cavaliers'},
  {id:'tp07',name:'Jarrett Allen',team:'Cleveland Cavaliers'},
  {id:'tp08',name:'Brandon Ingram',team:'Toronto Raptors'},
  {id:'tp09',name:'Jakob Poeltl',team:'Toronto Raptors'},
  {id:'tp10',name:'Zaccharie Risacher',team:'Atlanta Hawks'},
  {id:'tp11',name:'Paul George',team:'Philadelphia 76ers'},
  {id:'tp12',name:'Joel Embiid',team:'Philadelphia 76ers'},
  {id:'tp13',name:'Jalen Suggs',team:'Orlando Magic'},
  {id:'tp14',name:'LaMelo Ball',team:'Charlotte Hornets'},
  {id:'tp15',name:'Tyler Herro',team:'Miami Heat'},
  {id:'tp16',name:'Jaime Jaquez Jr.',team:'Miami Heat'},
  {id:'tp17',name:'Andrew Wiggins',team:'Miami Heat'},
  {id:'tp18',name:'Giannis Antetokounmpo',team:'Milwaukee Bucks'},
  {id:'tp19',name:'Kyle Kuzma',team:'Milwaukee Bucks'},
  {id:'tp20',name:'Patrick Williams',team:'Chicago Bulls'},
  {id:'tp21',name:'Nic Claxton',team:'Brooklyn Nets'},
  {id:'tp22',name:'Michael Porter Jr.',team:'Brooklyn Nets'},
  {id:'tp23',name:'Andrew Nembhard',team:'Indiana Pacers'},
  {id:'tp24',name:"D'Angelo Russell",team:'Dallas Mavericks'},
  {id:'tp25',name:'Christian Braun',team:'Denver Nuggets'},
  {id:'tp26',name:'Cameron Johnson',team:'Denver Nuggets'},
  {id:'tp27',name:'Jamal Murray',team:'Denver Nuggets'},
  {id:'tp28',name:'Julius Randle',team:'Minnesota Timberwolves'},
  {id:'tp29',name:'Isaiah Hartenstein',team:'Oklahoma City Thunder'},
  {id:'tp30',name:'Luguentz Dort',team:'Oklahoma City Thunder'},
  {id:'tp31',name:'Jerami Grant',team:'Portland Trail Blazers'},
  {id:'tp32',name:'Shaedon Sharpe',team:'Portland Trail Blazers'},
  {id:'tp33',name:'Lauri Markkanen',team:'Utah Jazz'},
  {id:'tp34',name:'Draymond Green',team:'Golden State Warriors'},
  {id:'tp35',name:'Kristaps Porzingis',team:'Golden State Warriors'},
  {id:'tp36',name:'Kawhi Leonard',team:'Los Angeles Clippers'},
  {id:'tp37',name:'Austin Reaves',team:'Los Angeles Lakers'},
  {id:'tp38',name:'Jalen Green',team:'Phoenix Suns'},
  {id:'tp39',name:'DeMar DeRozan',team:'Sacramento Kings'},
  {id:'tp40',name:'Zach LaVine',team:'Sacramento Kings'},
  {id:'tp41',name:'Malik Monk',team:'Sacramento Kings'},
  {id:'tp42',name:'Domantas Sabonis',team:'Sacramento Kings'},
  {id:'tp43',name:'Daniel Gafford',team:'Dallas Mavericks'},
  {id:'tp44',name:'Dereck Lively II',team:'Dallas Mavericks'},
  {id:'tp45',name:'Kevin Durant',team:'Houston Rockets'},
  {id:'tp46',name:'Ja Morant',team:'Memphis Grizzlies'},
  {id:'tp47',name:'Herbert Jones',team:'New Orleans Pelicans'},
  {id:'tp48',name:'Trey Murphy III',team:'New Orleans Pelicans'},
  {id:'tp49',name:'Zion Williamson',team:'New Orleans Pelicans'},
  {id:'tp50',name:"De'Aaron Fox",team:'San Antonio Spurs'},
];
const NBA_TEAMS_LIST=['Atlanta Hawks','Boston Celtics','Brooklyn Nets','Charlotte Hornets','Chicago Bulls','Cleveland Cavaliers','Dallas Mavericks','Denver Nuggets','Detroit Pistons','Golden State Warriors','Houston Rockets','Indiana Pacers','Los Angeles Clippers','Los Angeles Lakers','Memphis Grizzlies','Miami Heat','Milwaukee Bucks','Minnesota Timberwolves','New Orleans Pelicans','New York Knicks','Oklahoma City Thunder','Orlando Magic','Philadelphia 76ers','Phoenix Suns','Portland Trail Blazers','Sacramento Kings','San Antonio Spurs','Toronto Raptors','Utah Jazz','Washington Wizards'];

function normTradeName(s){return s.toLowerCase().replace(/[^a-z0-9]/g,'');}

function normalizePred(pred){
  if(!pred)return null;
  // Nouveau format : stayed (bool), franchise (string), returnPlayers (IDs)
  if(pred.stayed!==undefined){
    return{
      stayed:pred.stayed,
      franchise:pred.franchise||null,
      returnNames:(pred.returnPlayers||[]).map(id=>TRADES_PLAYERS.find(p=>p.id===id)?.name).filter(Boolean),
    };
  }
  // Ancien format : decision ("stays"/"leaves"), team (string), returnPlayers (noms)
  return{
    stayed:pred.decision==='stays',
    franchise:pred.team||null,
    returnNames:(pred.returnPlayers||[]).filter(Boolean),
  };
}

/* Barème Trades : 10 pts si reste/part correct, +20 si la franchise est bonne,
   +10 par joueur en retour correctement deviné. */
/* Comparaison de noms tolérante (casse + espaces) : l'affichage du récap et
   le calcul des points doivent utiliser exactement le même comparateur. */
function sameName(list,name){
  if(!Array.isArray(list)||!name)return false;
  const t=String(name).trim().toLowerCase();
  return list.some(r=>String(r).trim().toLowerCase()===t);
}

const TRADES_PTS={decision:10,franchise:20,returnPlayer:10};

function computeTradesScore(predictions,locked,answers){
  let correct=0,score=0;
  TRADES_PLAYERS.forEach(p=>{
    if(!locked?.[p.id])return;
    const pred=predictions?.[p.id];
    const ans=answers?.[p.id];
    if(!pred||!ans||ans.stayed===undefined||ans.stayed===null)return;
    const norm=normalizePred(pred);
    if(!norm)return;
    if(norm.stayed===ans.stayed){
      correct++;
      score+=TRADES_PTS.decision;
      if(!norm.stayed&&norm.franchise&&ans.franchise&&norm.franchise===ans.franchise){
        score+=TRADES_PTS.franchise;
      }
    }
    if(!norm.stayed&&ans.returnPlayers?.length>0){
      norm.returnNames.forEach(n=>{
        if(sameName(ans.returnPlayers,n)){
          score+=TRADES_PTS.returnPlayer;
        }
      });
    }
  });
  return{correct,score};
}

/* Calcule et crédite les points Trades de TOUS les utilisateurs.
   Idempotent : seul l'écart avec `tradesGame2025.pointsAdded` est appliqué,
   donc un second passage ne double jamais les points et une correction admin
   ajuste à la baisse comme à la hausse. */
async function creditAllTradesUsers(answers){
  const answeredCount=Object.keys(answers||{}).filter(k=>answers[k]?.stayed!==undefined&&answers[k]?.stayed!==null).length;
  const isClosed=answeredCount>=TRADES_PLAYERS.length;
  const snap=await getDocs(collection(db,'users'));
  const rows=[];const writes=[];
  const weekKey=getWeekKey(),monthKey=getMonthKey();
  snap.forEach(d=>{
    const u=d.data();
    const tg=u?.tradesGame2025||{};
    const locked=tg.locked||{};
    if(Object.keys(locked).length===0)return;
    const{correct,score}=computeTradesScore(tg.predictions||{},locked,answers);
    const username=u.username||d.id;
    rows.push({id:d.id,username,correct,score});
    const already=tg.pointsAdded||0;
    const delta=score-already;
    const upd={
      'tradesGame2025.score':score,
      'tradesGame2025.correct':correct,
      'tradesGame2025.pointsAdded':score,
      'tradesGame2025.closed':isClosed,
    };
    if(delta!==0){
      const weekPts={...(u.weekPts||{})};weekPts[weekKey]=Math.max(0,(weekPts[weekKey]||0)+delta);
      const monthPts={...(u.monthPts||{})};monthPts[monthKey]=Math.max(0,(monthPts[monthKey]||0)+delta);
      upd.points=Math.max(0,(u.points||0)+delta);
      upd.weekPts=weekPts;
      upd.monthPts=monthPts;
    }
    writes.push(updateDoc(doc(db,'users',d.id),upd));
    writes.push(setDoc(doc(db,'tradesLeaderboard2025',d.id),{username,correct,score,closed:isClosed,updatedAt:Date.now()}));
  });
  await Promise.all(writes);
  rows.sort((a,b)=>(b.score||0)-(a.score||0));
  return{rows,isClosed,answeredCount};
}

/* Verrou transactionnel : garantit qu'un seul client effectue le calcul global
   pour une version donnée des résultats admin, même si plusieurs joueurs
   ouvrent l'app en même temps. */
async function claimTradesCalcLock(stamp){
  const lockRef=doc(db,'config','tradesCalc2025');
  try{
    return await runTransaction(db,async tx=>{
      const s=await tx.get(lockRef);
      if(s.exists()&&s.data()?.stamp===stamp)return false;
      tx.set(lockRef,{stamp,at:Date.now()},{merge:true});
      return true;
    });
  }catch(e){return false;}
}

/* Relâche le verrou : indispensable si le crédit échoue après la prise du
   verrou, sinon plus aucun client ne retenterait le calcul pour cette version. */
async function releaseTradesCalcLock(){
  try{
    await setDoc(doc(db,'config','tradesCalc2025'),{stamp:null,at:Date.now()},{merge:true});
  }catch(e){}
}

function MiniGameTrades({firebaseUser,profile,setProfile,guestCta}){
  const isDev=process.env.NODE_ENV==='development';
  const now=new Date();
  const canPredict=isDev||(now>=new Date('2025-05-15')&&now<new Date('2026-06-15'));
  const canSeeResults=isDev||(now>=new Date('2025-09-01'));
  const [overlay,setOverlay]=useState(null);
  const [saving,setSaving]=useState(false);
  const [confirmMsg,setConfirmMsg]=useState(null);
  const [adminData,setAdminData]=useState(null);
  const [scores,setScores]=useState(null);
  const overlayRef=useRef(null);

  useEffect(()=>{if(overlay&&overlayRef.current)overlayRef.current.scrollTop=0;},[overlay?.player?.id,overlay?.step]);

  const locked=profile?.tradesGame2025?.locked||{};
  const predictions=profile?.tradesGame2025?.predictions||{};

  useEffect(()=>{
    if(!canSeeResults||!firebaseUser)return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'tradesAdmin','2025'));
        if(!snap.exists())return;
        const data=snap.data();
        setAdminData(data);

      }catch(e){}
    })();
  },[canSeeResults,firebaseUser]);

  function openPlayer(player){
    if(locked[player.id])return;
    if(!canPredict||!firebaseUser)return;
    setOverlay({player,step:1,stayed:null,franchise:null,returnPlayers:[]});
    setConfirmMsg(null);
  }

  function closeOverlay(){setOverlay(null);}

  async function confirmPrediction(){
    if(!firebaseUser||!overlay)return;
    setSaving(true);
    const{player,stayed,franchise,returnPlayers}=overlay;
    const pred={stayed,franchise:stayed?null:franchise,returnPlayers:stayed?[]:returnPlayers,ts:Date.now()};
    const newPredictions={...predictions,[player.id]:pred};
    const newLocked={...locked,[player.id]:true};
    const update={'tradesGame2025.predictions':newPredictions,'tradesGame2025.locked':newLocked};
    try{
      await updateDoc(doc(db,'users',firebaseUser.uid),update);
      if(setProfile)setProfile(p=>({...p,tradesGame2025:{...p.tradesGame2025,predictions:newPredictions,locked:newLocked}}));
      setConfirmMsg('✅ Pronostic enregistré !');
      setTimeout(()=>{setOverlay(null);setConfirmMsg(null);},1200);
    }catch(e){setConfirmMsg('❌ Erreur, réessayez.');}
    setSaving(false);
  }

  const lockedCount=Object.keys(locked).length;
  const adminAnswers=adminData?.answers||{};
  const answersCount=Object.keys(adminAnswers).filter(k=>adminAnswers[k]?.stayed!==undefined&&adminAnswers[k]?.stayed!==null).length;
  const gameClosed=answersCount>=TRADES_PLAYERS.length;
  const myScore=gameClosed||answersCount>0
    ?computeTradesScore(predictions,locked,adminAnswers).score
    :null;

  return(
    <div>
      {/* Invité : les résultats restent consultables, les pronostics demandent un compte */}
      {guestCta&&canPredict&&<div style={{marginBottom:16}}>{guestCta}</div>}
      {/* ── Bandeau statut ── */}
      <div style={{fontSize:13,marginBottom:16,padding:'12px 14px',background:'var(--s1)',border:`1px solid ${gameClosed?'var(--gold)':'var(--bdr)'}`,borderRadius:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <span style={{color:'var(--muted)'}}>
          {canPredict&&lockedCount===0&&'🟢 Pronostics ouverts · Clique sur un joueur'}
          {canPredict&&lockedCount>0&&'🟢 Ouverts · Continue à remplir'}
          {!canPredict&&answersCount===0&&'🔒 Pronostics clôturés · Résultats le 1er sept.'}
          {!canPredict&&answersCount>0&&!gameClosed&&`📊 ${answersCount}/50 résultats validés`}
          {!canPredict&&gameClosed&&'🏁 Jeu terminé · Tous les résultats sont tombés'}
        </span>
        <span style={{fontSize:12,fontWeight:800,color:'var(--gold)'}}>
          {canPredict?`${lockedCount}/50`:`${answersCount}/50`}
        </span>
      </div>

      {/* ── Score final du joueur ── */}
      {!canPredict&&myScore!==null&&lockedCount>0&&(
        <div style={{marginBottom:16,padding:'16px',background:'var(--s1)',border:'1.5px solid var(--gold)',borderRadius:14,textAlign:'center'}}>
          <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',marginBottom:6}}>
            {gameClosed?'Score final':'Score provisoire'}
          </div>
          <div style={{fontSize:32,fontWeight:800,color:'var(--gold)',lineHeight:1}}>{myScore} pts</div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>
            {gameClosed?'Ajoutés à ton classement général':'Mis à jour à chaque résultat validé'}
          </div>
        </div>
      )}

      {/* ── Vue interactive (pronostics ouverts) ── */}
      {canPredict&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {TRADES_PLAYERS.map(player=>{
            const isLocked=!!locked[player.id];
            const pred=predictions[player.id];
            return(
              <button key={player.id} onClick={()=>isLocked?setOverlay({player,readOnly:true}):openPlayer(player)} style={{padding:'10px 12px',background:'var(--s1)',border:`1.5px solid ${isLocked?'var(--gold)':'var(--bdr)'}`,borderRadius:12,cursor:'pointer',textAlign:'left',transition:'border-color .2s'}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--txt)',marginBottom:2,lineHeight:1.3}}>{player.name}</div>
                <div style={{fontSize:10,color:'var(--muted)',marginBottom:isLocked?4:0}}>{player.team}</div>
                {isLocked&&pred&&(()=>{const norm=normalizePred(pred);return(
                  <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,marginTop:2}}>
                    {norm?.stayed?'✅ Reste':'🔄 Part'}
                    {!norm?.stayed&&norm?.franchise&&<span> → {norm.franchise.split(' ').slice(-1)[0]}</span>}
                    <span style={{marginLeft:4}}>🔒</span>
                  </div>
                );})()}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Vue récap (clôturé) ── */}
      {!canPredict&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {lockedCount===0&&(
            <div style={{textAlign:'center',padding:'32px 16px',color:'var(--muted)',fontSize:14}}>
              Tu n'as pronostiqué aucun joueur avant la clôture.
            </div>
          )}
          {TRADES_PLAYERS.map(player=>{
            const pred=predictions[player.id];
            const norm=normalizePred(pred);
            const isLocked=!!locked[player.id];
            const ans=adminData?.answers?.[player.id];
            const returnNames=norm?.returnNames||[];

            if(!isLocked){
              return(
                <div key={player.id} style={{padding:'10px 14px',background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,opacity:0.35,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--txt)'}}>{player.name}</div>
                    <div style={{fontSize:10,color:'var(--muted)'}}>{player.team}</div>
                  </div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>Non pronostiqué</div>
                </div>
              );
            }

            let stayOk=null,franchiseOk=null;
            if(canSeeResults&&ans){
              stayOk=norm?.stayed===ans.stayed;
              if(!norm?.stayed&&!ans.stayed&&norm?.franchise&&ans.franchise){
                franchiseOk=norm.franchise===ans.franchise;
              }
            }

            return(
              <div key={player.id} onClick={()=>setOverlay({player,readOnly:true})} style={{padding:'14px',background:'var(--s1)',border:`1.5px solid ${canSeeResults&&ans?stayOk?'var(--green)':'var(--red)':'var(--gold)'}`,borderRadius:14,cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:norm?.stayed?0:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:'var(--txt)'}}>{player.name}</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{player.team}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    {canSeeResults&&ans&&<span style={{fontSize:18}}>{stayOk?'✅':'❌'}</span>}
                    {!ans&&<span style={{fontSize:10,color:'var(--muted)',fontStyle:'italic'}}>⏳ En attente</span>}
                    <span style={{fontSize:11,color:'var(--gold)'}}>🔒</span>
                    <span style={{fontSize:14,color:'var(--muted)'}}>›</span>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'var(--s2)',borderRadius:8}}>
                    <span style={{fontSize:15}}>{norm?.stayed?'✅':'🔄'}</span>
                    <span style={{fontSize:13,fontWeight:700,color:norm?.stayed?'var(--green)':'var(--txt)'}}>
                      {norm?.stayed?'Reste à '+player.team:'Part'}
                    </span>
                    {canSeeResults&&ans&&<span style={{fontSize:11,color:'var(--muted)',marginLeft:'auto'}}>{ans.stayed?'→ A bien resté':'→ A bien quitté'}</span>}
                  </div>
                  {!norm?.stayed&&norm?.franchise&&(
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'var(--s2)',borderRadius:8}}>
                      <span style={{fontSize:15}}>🏀</span>
                      <span style={{fontSize:13,fontWeight:700,color:'var(--txt)'}}>→ {norm.franchise}</span>
                      {canSeeResults&&ans&&ans.franchise&&(
                        <span style={{fontSize:11,marginLeft:'auto',color:franchiseOk?'var(--green)':'var(--red)',fontWeight:700}}>
                          {franchiseOk?'✅':` ❌ ${ans.franchise}`}
                        </span>
                      )}
                    </div>
                  )}
                  {(returnNames.length>0||(canSeeResults&&ans?.returnPlayers?.length>0))&&(
                    <div style={{padding:'8px 10px',background:'var(--s2)',borderRadius:8}}>
                      <div style={{fontSize:10,color:'var(--muted)',marginBottom:4}}>Joueurs en retour</div>
                      {returnNames.map(n=>{
                        const ok=canSeeResults&&sameName(ans?.returnPlayers,n);
                        const miss=canSeeResults&&ans?.returnPlayers?.length>0&&!ok;
                        return<div key={n} style={{fontSize:12,fontWeight:600,color:ok?'var(--green)':miss?'var(--red)':'var(--txt)'}}>{ok?'✅ ':miss?'❌ ':''}{n}</div>;
                      })}
                      {canSeeResults&&ans?.returnPlayers?.length>0&&ans.returnPlayers.filter(n=>!sameName(returnNames,n)).map(n=>(
                        <div key={n} style={{fontSize:12,fontWeight:600,color:'var(--muted)'}}>→ Réel : {n}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {overlay&&createPortal(
        <div ref={overlayRef} style={{position:'fixed',inset:0,background:'var(--bg)',zIndex:9999,overflowY:'auto',animation:'slideUp .3s ease'}}>
          <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px',paddingBottom:'max(32px,env(safe-area-inset-bottom))'}}>
            <button onClick={closeOverlay} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 20px',letterSpacing:.3}}>
              ← Retour
            </button>
            <div style={{fontSize:20,fontWeight:800,color:'var(--txt)',marginBottom:4}}>{overlay.player.name}</div>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:20}}>{overlay.player.team}</div>

            {confirmMsg&&<div style={{padding:'12px 16px',background:'var(--s1)',border:'1px solid var(--gold)',borderRadius:12,color:'var(--gold)',fontWeight:700,textAlign:'center',marginBottom:16}}>{confirmMsg}</div>}

            {overlay.readOnly&&(()=>{
              const p=overlay.player;
              const norm=normalizePred(predictions[p.id]);
              const ans=adminData?.answers?.[p.id];
              const returnNames=norm?.returnNames||[];
              const stayOk=canSeeResults&&ans?norm?.stayed===ans.stayed:null;
              const franchiseOk=canSeeResults&&ans&&!norm?.stayed&&!ans.stayed?norm?.franchise===ans.franchise:null;
              return(
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{padding:'16px',background:'var(--s1)',border:'1.5px solid var(--gold)',borderRadius:16}}>
                    <div style={{fontSize:11,color:'var(--gold)',fontWeight:800,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Ton pronostic · Verrouillé 🔒</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px',background:'var(--s2)',borderRadius:10}}>
                        <span style={{fontSize:20}}>{norm?.stayed?'✅':'🔄'}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:800,color:norm?.stayed?'var(--green)':'var(--txt)'}}>
                            {norm?.stayed?`Reste à ${p.team}`:'Quitte sa franchise'}
                          </div>
                          {!norm?.stayed&&norm?.franchise&&(
                            <div style={{fontSize:13,color:'var(--muted)',marginTop:2}}>→ {norm.franchise}</div>
                          )}
                        </div>
                        {canSeeResults&&ans&&<span style={{fontSize:22}}>{stayOk?'✅':'❌'}</span>}
                      </div>
                      {!norm?.stayed&&norm?.franchise&&canSeeResults&&ans&&(
                        <div style={{padding:'10px 12px',background:'var(--s2)',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div style={{fontSize:13,color:'var(--muted)'}}>Destination</div>
                          <div style={{fontSize:13,fontWeight:700,color:franchiseOk?'var(--green)':'var(--red)'}}>
                            {franchiseOk?`✅ ${norm.franchise}`:`❌ → ${ans.franchise||'?'}`}
                          </div>
                        </div>
                      )}
                      {(returnNames.length>0||(canSeeResults&&ans?.returnPlayers?.length>0))&&(
                        <div style={{padding:'12px',background:'var(--s2)',borderRadius:10}}>
                          <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,letterSpacing:.8,textTransform:'uppercase',marginBottom:8}}>Joueurs en retour</div>
                          {returnNames.map(n=>{
                            const ok=canSeeResults&&sameName(ans?.returnPlayers,n);
                            const miss=canSeeResults&&ans?.returnPlayers?.length>0&&!ok;
                            return<div key={n} style={{fontSize:13,fontWeight:600,color:ok?'var(--green)':miss?'var(--red)':'var(--txt)',padding:'4px 0',borderBottom:'1px solid var(--bdr)'}}>{ok?'✅ ':miss?'❌ ':''}{n}</div>;
                          })}
                          {canSeeResults&&ans?.returnPlayers?.length>0&&ans.returnPlayers.filter(n=>!sameName(returnNames,n)).map(n=>(
                            <div key={n} style={{fontSize:12,color:'var(--muted)',padding:'4px 0',borderBottom:'1px solid var(--bdr)'}}>→ Réel : {n}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {canSeeResults&&ans&&(
                    <div style={{padding:'14px',background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:14}}>
                      <div style={{fontSize:11,color:'var(--muted)',fontWeight:800,letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>Résultat réel</div>
                      <div style={{fontSize:14,fontWeight:700,color:'var(--txt)'}}>
                        {ans.stayed?`✅ Reste à ${p.team}`:`🔄 Part → ${ans.franchise||'?'}`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {!overlay.readOnly&&overlay.step===1&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--txt)',marginBottom:16}}>Ce joueur va-t-il rester dans sa franchise cet été ?</div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={()=>setOverlay(o=>({...o,stayed:true,step:3}))} style={{flex:1,padding:'16px',background:'color-mix(in srgb,var(--green) 10%,var(--s1))',border:'1.5px solid var(--green)',borderRadius:14,color:'var(--green)',fontSize:16,fontWeight:800,cursor:'pointer'}}>✅ Reste</button>
                  <button onClick={()=>setOverlay(o=>({...o,stayed:false,step:2}))} style={{flex:1,padding:'16px',background:'color-mix(in srgb,var(--red) 10%,var(--s1))',border:'1.5px solid var(--red)',borderRadius:14,color:'var(--red)',fontSize:16,fontWeight:800,cursor:'pointer'}}>🔄 Part</button>
                </div>
              </div>
            )}

            {!overlay.readOnly&&overlay.step===2&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--txt)',marginBottom:4}}>Dans quelle franchise ?</div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Choisissez la destination</div>
                <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:'50vh',overflowY:'auto'}}>
                  {NBA_TEAMS_LIST.filter(t=>t!==overlay.player.team).map(team=>(
                    <button key={team} onClick={()=>setOverlay(o=>({...o,franchise:team,step:3,returnPlayers:[]}))} style={{padding:'12px 16px',background:overlay.franchise===team?'color-mix(in srgb,var(--gold) 15%,var(--s1))':'var(--s1)',border:`1.5px solid ${overlay.franchise===team?'var(--gold)':'var(--bdr)'}`,borderRadius:12,color:overlay.franchise===team?'var(--gold)':'var(--txt)',fontSize:14,fontWeight:600,cursor:'pointer',textAlign:'left'}}>
                      {team}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!overlay.readOnly&&overlay.step===3&&(
              <div>
                <div style={{marginBottom:16,padding:'12px 16px',background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12}}>
                  <div style={{fontSize:13,color:'var(--muted)',marginBottom:4}}>Votre pronostic :</div>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--txt)'}}>{overlay.stayed?'✅ Reste dans '+overlay.player.team:'🔄 Part vers '+overlay.franchise}</div>
                </div>
                {!overlay.stayed&&(
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--txt)',marginBottom:4}}>Joueurs en retour (optionnel)</div>
                    <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Qui revient dans l'échange ?</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:'35vh',overflowY:'auto'}}>
                      {TRADES_PLAYERS.filter(p=>p.id!==overlay.player.id).map(p=>{
                        const sel=(overlay.returnPlayers||[]).includes(p.id);
                        return(
                          <button key={p.id} onClick={()=>setOverlay(o=>{
                            const rp=o.returnPlayers||[];
                            return{...o,returnPlayers:sel?rp.filter(x=>x!==p.id):[...rp,p.id]};
                          })} style={{padding:'10px 12px',background:sel?'color-mix(in srgb,var(--gold) 12%,var(--s1))':'var(--s1)',border:`1.5px solid ${sel?'var(--gold)':'var(--bdr)'}`,borderRadius:10,color:sel?'var(--gold)':'var(--txt)',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span>{p.name} <span style={{color:'var(--muted)',fontWeight:400}}>({p.team})</span></span>
                            {sel&&<span>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button onClick={confirmPrediction} disabled={saving} style={{width:'100%',padding:'16px',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:14,color:'#000',fontSize:15,fontWeight:800,cursor:saving?'default':'pointer',marginTop:8}}>
                  {saving?'Enregistrement…':'🔒 CONFIRMER ET VERROUILLER'}
                </button>
                <div style={{fontSize:11,color:'var(--muted)',textAlign:'center',marginTop:8}}>Ce choix est définitif et ne pourra pas être modifié</div>
                {overlay.step===3&&overlay.stayed===false&&(
                  <button onClick={()=>setOverlay(o=>({...o,step:2}))} style={{width:'100%',padding:'12px',background:'none',border:'1px solid var(--bdr)',borderRadius:12,color:'var(--muted)',fontSize:13,cursor:'pointer',marginTop:8}}>
                    ← Changer de franchise
                  </button>
                )}
                <button onClick={()=>setOverlay(o=>({...o,step:1,stayed:null,franchise:null,returnPlayers:[]}))} style={{width:'100%',padding:'12px',background:'none',border:'1px solid var(--bdr)',borderRadius:12,color:'var(--muted)',fontSize:13,cursor:'pointer',marginTop:6}}>
                  ← Recommencer
                </button>
              </div>
            )}
          </div>
        </div>
      ,document.body)}
    </div>
  );
}

function AdminTradesPanel({onClose,onDataChanged}){
  const ADMIN_PWD='NBgAmes07310!';
  const [pwd,setPwd]=useState('');
  const [auth2,setAuth2]=useState(false);
  const [tab,setTab]=useState('answers');
  const [answers,setAnswers]=useState({});
  const [leaderboard,setLeaderboard]=useState([]);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState('');
  const [seasonName,setSeasonName]=useState('');
  const [archives,setArchives]=useState([]);

  function checkPwd(){if(pwd===ADMIN_PWD)setAuth2(true);else setMsg('Mot de passe incorrect');}

  useEffect(()=>{
    if(!auth2)return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'tradesAdmin','2025'));
        if(snap.exists())setAnswers(snap.data()?.answers||{});
      }catch(e){}
    })();
    (async()=>{
      try{
        const snap=await getDocs(collection(db,'tradesLeaderboard2025'));
        const rows=[];
        snap.forEach(d=>rows.push({id:d.id,...d.data()}));
        rows.sort((a,b)=>(b.score||0)-(a.score||0));
        setLeaderboard(rows);
      }catch(e){}
    })();
    (async()=>{
      try{setArchives(await fetchSeasonArchives());}catch(e){}
    })();
  },[auth2]);

  async function recalculateLeaderboard(currentAnswers,stamp){
    const{rows,isClosed,answeredCount}=await creditAllTradesUsers(currentAnswers);
    // On pose le verrou pour cette version : inutile que le premier joueur
    // qui ouvre l'app refasse le calcul qu'on vient de faire.
    if(stamp!==undefined)await claimTradesCalcLock(String(stamp));
    setLeaderboard(rows);
    return{isClosed,answeredCount};
  }

  async function saveAnswers(){
    setSaving(true);setMsg('');
    try{
      const answeredCount=Object.keys(answers).filter(k=>answers[k]?.stayed!==undefined&&answers[k]?.stayed!==null).length;
      const closed=answeredCount>=TRADES_PLAYERS.length;
      const stamp=Date.now();
      await setDoc(doc(db,'tradesAdmin','2025'),{answers,closed,answeredCount,updatedAt:stamp},{merge:true});
      await recalculateLeaderboard(answers,stamp);
      setMsg(closed
        ?`🏁 ${answeredCount}/${TRADES_PLAYERS.length} · Jeu clôturé, points crédités !`
        :`✅ Sauvegardé · ${answeredCount}/${TRADES_PLAYERS.length} · points crédités`);
    }catch(e){setMsg('❌ Erreur : '+(e.message||''));}
    setSaving(false);
  }

  return createPortal(
    <div style={{position:'fixed',inset:0,background:'var(--bg)',zIndex:9999,overflowY:'auto'}}>
      <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:800,color:'var(--gold)'}}>⚙️ Admin Trades</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--muted)',fontSize:22,cursor:'pointer'}}>✕</button>
        </div>
        {!auth2?(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <input type="password" placeholder="Mot de passe admin" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&checkPwd()} style={{padding:'14px 16px',background:'var(--s1)',border:'1.5px solid var(--bdr)',borderRadius:12,color:'var(--txt)',fontSize:15,outline:'none'}}/>
            <button onClick={checkPwd} style={{padding:'14px',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:12,color:'#000',fontWeight:800,fontSize:15,cursor:'pointer'}}>Accéder</button>
            {msg&&<div style={{color:'var(--red)',fontSize:13,textAlign:'center'}}>{msg}</div>}
          </div>
        ):(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              {['answers','leaderboard','season','reset'].map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'10px',background:tab===t?'var(--gold)':'var(--s1)',border:'none',borderRadius:10,color:tab===t?'#000':'var(--muted)',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                  {t==='answers'?'Réponses':t==='leaderboard'?'Classement':t==='season'?'🏁 Saison':'🔥 Reset'}
                </button>
              ))}
            </div>
            {tab==='answers'&&(
              <div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Pour chaque joueur, entrez : reste / part + franchise si part</div>
                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                  {TRADES_PLAYERS.map(p=>{
                    const a=answers[p.id]||{};
                    return(
                      <div key={p.id} style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,padding:'12px'}}>
                        <div style={{fontSize:13,fontWeight:700,color:'var(--txt)',marginBottom:8}}>{p.name} <span style={{color:'var(--muted)',fontWeight:400}}>({p.team})</span></div>
                        <div style={{display:'flex',gap:8,marginBottom:a.stayed===false?8:0}}>
                          <button onClick={()=>setAnswers(ans=>({...ans,[p.id]:{...ans[p.id],stayed:true,franchise:null}}))} style={{flex:1,padding:'8px',background:a.stayed===true?'color-mix(in srgb,var(--green) 20%,var(--s1))':'var(--s2)',border:`1px solid ${a.stayed===true?'var(--green)':'var(--bdr)'}`,borderRadius:8,color:a.stayed===true?'var(--green)':'var(--muted)',fontSize:12,fontWeight:700,cursor:'pointer'}}>✅ Reste</button>
                          <button onClick={()=>setAnswers(ans=>({...ans,[p.id]:{...ans[p.id],stayed:false}}))} style={{flex:1,padding:'8px',background:a.stayed===false?'color-mix(in srgb,var(--red) 20%,var(--s1))':'var(--s2)',border:`1px solid ${a.stayed===false?'var(--red)':'var(--bdr)'}`,borderRadius:8,color:a.stayed===false?'var(--red)':'var(--muted)',fontSize:12,fontWeight:700,cursor:'pointer'}}>🔄 Part</button>
                        </div>
                        {a.stayed===false&&(
                          <div style={{display:'flex',flexDirection:'column',gap:6}}>
                            <select value={a.franchise||''} onChange={e=>setAnswers(ans=>({...ans,[p.id]:{...ans[p.id],franchise:e.target.value}}))} style={{width:'100%',padding:'8px',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,color:'var(--txt)',fontSize:12}}>
                              <option value=''>-- Destination --</option>
                              {NBA_TEAMS_LIST.map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                            <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginTop:4}}>Joueurs en retour (optionnel)</div>
                            <div style={{display:'flex',gap:6}}>
                              <input
                                id={`rp-input-${p.id}`}
                                placeholder="Nom du joueur…"
                                style={{flex:1,padding:'6px 10px',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,color:'var(--txt)',fontSize:12}}
                                onKeyDown={e=>{if(e.key==='Enter'){const v=e.target.value.trim();if(v){setAnswers(ans=>{const cur=ans[p.id]?.returnPlayers||[];return{...ans,[p.id]:{...ans[p.id],returnPlayers:[...cur,v]}};});e.target.value='';}}}}
                              />

                              <button onClick={()=>{const inp=document.getElementById(`rp-input-${p.id}`);const v=inp?.value.trim();if(v){setAnswers(ans=>{const cur=ans[p.id]?.returnPlayers||[];return{...ans,[p.id]:{...ans[p.id],returnPlayers:[...cur,v]}};});if(inp)inp.value='';}}} style={{padding:'6px 12px',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,color:'var(--txt)',fontSize:12,cursor:'pointer',fontWeight:700}}>+</button>
                            </div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
                              {(a.returnPlayers||[]).map((name,i)=>(
                                <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:'color-mix(in srgb,var(--gold) 15%,var(--s1))',border:'1px solid var(--gold)',borderRadius:6,fontSize:11,color:'var(--gold)',fontWeight:600}}>
                                  {name}
                                  <button onClick={()=>setAnswers(ans=>{const cur=[...(ans[p.id]?.returnPlayers||[])];cur.splice(i,1);return{...ans,[p.id]:{...ans[p.id],returnPlayers:cur}};})} style={{background:'none',border:'none',color:'var(--gold)',cursor:'pointer',fontSize:12,padding:0,lineHeight:1}}>×</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={saveAnswers} disabled={saving} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:12,color:'#000',fontWeight:800,fontSize:15,cursor:saving?'default':'pointer'}}>
                  {saving?'Sauvegarde…':'💾 Sauvegarder'}
                </button>
                <button onClick={async()=>{
                  setSaving(true);setMsg('');
                  try{
                    const snap=await getDoc(doc(db,'tradesAdmin','2025'));
                    const stored=snap.exists()?(snap.data()?.answers||{}):{};
                    const r=await recalculateLeaderboard(stored,snap.data()?.updatedAt);
                    setMsg(`🔄 Recalcul effectué · ${r.answeredCount}/${TRADES_PLAYERS.length}${r.isClosed?' · jeu clôturé':''}`);
                  }catch(e){setMsg('❌ Erreur : '+(e.message||''));}
                  setSaving(false);
                }} disabled={saving} style={{width:'100%',marginTop:8,padding:'12px',background:'var(--s1)',border:'1.5px solid var(--gold)',borderRadius:12,color:'var(--gold)',fontWeight:700,fontSize:13,cursor:saving?'default':'pointer'}}>
                  🔄 Recalculer & créditer les points (rétroactif)
                </button>
                {msg&&<div style={{marginTop:8,textAlign:'center',fontSize:13,color:/^[✅🏁🔄]/.test(msg)?'var(--green)':'var(--red)'}}>{msg}</div>}
              </div>
            )}
            {tab==='season'&&(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.6,background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,padding:'12px 14px'}}>
                  Archive le <strong style={{color:'var(--txt)'}}>classement final</strong> de la saison, puis remet à zéro
                  les points, streaks et classements hebdo/mensuels de tous les joueurs.
                  <div style={{marginTop:8,color:'var(--green)'}}>✅ Conservé : historique des paris, mini-jeux, pronostics Trades.</div>
                  <div style={{marginTop:4,color:'var(--red)'}}>⚠️ Irréversible : les points remis à zéro ne peuvent pas être restaurés.</div>
                </div>
                <input
                  value={seasonName}
                  onChange={e=>setSeasonName(e.target.value)}
                  placeholder="Nom de la saison (ex : 2025-26)"
                  style={{padding:'12px 14px',background:'var(--s1)',border:'1.5px solid var(--bdr)',borderRadius:12,color:'var(--txt)',fontSize:14,outline:'none'}}
                />
                <button onClick={async()=>{
                  const name=seasonName.trim();
                  if(!name){setMsg('❌ Donne un nom à la saison');return;}
                  if(archives.some(a=>a.name===name)&&!window.confirm(`Une archive "${name}" existe déjà. L'écraser ?`))return;
                  if(!window.confirm(`Archiver la saison "${name}" puis remettre à zéro les points de TOUS les joueurs ?`))return;
                  if(!window.confirm('Dernière confirmation : cette remise à zéro est IRRÉVERSIBLE. Continuer ?'))return;
                  setSaving(true);setMsg('');
                  try{
                    const res=await archiveSeason(name);
                    const n=await resetSeasonScores();
                    setArchives(await fetchSeasonArchives());
                    if(onDataChanged)await onDataChanged();
                    setMsg(`🏁 Saison "${res.name}" archivée (${res.ranking.length} joueurs) · ${n} profils remis à zéro`);
                  }catch(e){setMsg('❌ Erreur : '+(e.message||''));}
                  setSaving(false);
                }} disabled={saving} style={{padding:'14px',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:12,color:'#000',fontWeight:800,fontSize:15,cursor:saving?'default':'pointer'}}>
                  {saving?'En cours…':'🏁 Clôturer la saison'}
                </button>
                {msg&&<div style={{textAlign:'center',fontSize:13,color:/^[✅🏁🔄]/.test(msg)?'var(--green)':'var(--red)'}}>{msg}</div>}
                <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginTop:8}}>Saisons archivées</div>
                {archives.length===0&&<div style={{textAlign:'center',color:'var(--muted)',fontSize:13,padding:'12px 0'}}>Aucune archive</div>}
                {archives.map(a=>(
                  <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,padding:'12px 14px'}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--txt)'}}>{a.name}</div>
                      <div style={{fontSize:11,color:'var(--muted)'}}>{a.playerCount||0} joueurs · {a.endedAt?new Date(a.endedAt).toLocaleDateString('fr-FR'):'—'}</div>
                    </div>
                    <div style={{fontSize:12,color:'var(--gold)',fontWeight:700}}>🥇 {a.ranking?.[0]?.username||'—'}</div>
                  </div>
                ))}
              </div>
            )}
            {tab==='reset'&&(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.5,background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,padding:'12px 14px'}}>
                  Remet le streak de <strong style={{color:'var(--txt)'}}>tous les utilisateurs</strong> à 0. Irréversible.
                </div>
                <button onClick={async()=>{
                  if(!window.confirm('Remettre TOUS les streaks à 0 ?'))return;
                  setSaving(true);setMsg('');
                  try{
                    const snap=await getDocs(collection(db,'users'));
                    const batch=[];
                    snap.forEach(d=>batch.push(updateDoc(doc(db,'users',d.id),{streak:0})));
                    await Promise.all(batch);
                    if(onDataChanged)await onDataChanged();
                    setMsg('✅ Tous les streaks remis à 0 !');
                  }catch(e){setMsg('❌ Erreur : '+e.message);}
                  setSaving(false);
                }} disabled={saving} style={{padding:'14px',background:'color-mix(in srgb,var(--red) 15%,var(--s1))',border:'1.5px solid var(--red)',borderRadius:12,color:'var(--red)',fontWeight:800,fontSize:15,cursor:saving?'default':'pointer'}}>
                  🔥 Remettre tous les streaks à 0
                </button>
                {msg&&<div style={{textAlign:'center',fontSize:13,color:msg.startsWith('✅')?'var(--green)':'var(--red)'}}>{msg}</div>}
              </div>
            )}
            {tab==='leaderboard'&&(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {leaderboard.length===0&&<div style={{textAlign:'center',color:'var(--muted)',padding:20}}>Aucun résultat</div>}
                {leaderboard.map((row,i)=>(
                  <div key={row.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,padding:'12px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:18,width:28}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:'var(--txt)'}}>{row.username||row.id}</div>
                        <div style={{fontSize:11,color:'var(--muted)'}}>{row.correct||0} / {TRADES_PLAYERS.length} corrects</div>
                      </div>
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:'var(--gold)'}}>{row.score||0} pts</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  ,document.body);
}

const css=`
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
/* Pas de zoom : ni double-tap, ni zoom automatique d'iOS sur les champs (police < 16 px) */
html{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%;}
input,select,textarea{font-size:max(16px,1em);}
:root{--bg:#07090E;--s1:#0E1520;--s2:#141D2B;--bdr:#1A2640;--gold:#F5B800;--gold2:#FF8C00;--red:#E8365D;--green:#00D084;--blue:#4A9EFF;--orange:#FF6B35;--txt:#EEF2F7;--muted:#52677F;--c1:#552583;--c2:#FDB927;}
html,body{height:100%;background:#07090E;}
html{overscroll-behavior:none;overflow-x:hidden;}
body{background:var(--bg);color:var(--txt);font-family:'Barlow',sans-serif;overscroll-behavior:none;overscroll-behavior-x:none;overflow-x:hidden;width:100%;max-width:100vw;}
#root{min-height:100%;background:var(--bg);}
/* App connectée : seul .scrollarea défile, jamais le document. */
html.app-locked,html.app-locked body{height:100%;overflow:hidden;}
input,button,select{font-family:'Barlow',sans-serif;}
.shell{display:flex;flex-direction:column;height:100vh;height:100dvh;max-width:480px;margin:0 auto;position:relative;}
.scrollarea{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-top:var(--topnav-h, calc(56px + env(safe-area-inset-top, 0px)));padding-bottom:var(--bnav-h, calc(82px + env(safe-area-inset-bottom, 0px)));}
.scrollarea::-webkit-scrollbar{display:none;}
.franchise-watermark{position:fixed;bottom:90px;right:0;width:200px;height:200px;opacity:.04;pointer-events:none;z-index:0;background-size:contain;background-repeat:no-repeat;background-position:center;}
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:var(--bg);border-top:1px solid var(--bdr);display:flex;z-index:200;padding-bottom:env(safe-area-inset-bottom,0px);}
.bnav.franchise{background:linear-gradient(180deg,var(--bg) 0%,color-mix(in srgb,var(--c1) 20%,var(--bg)) 100%);}
.bntab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:10px 4px 8px;border:none;background:none;color:var(--muted);cursor:pointer;position:relative;}
.bntab.on{color:var(--gold);}
.bntab-ico{font-size:20px;line-height:1;}
.bntab-lbl{font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;}
.bntab.on::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:24px;height:2px;background:var(--gold);border-radius:2px 2px 0 0;}
.topnav{background:var(--bg);border-bottom:1px solid var(--bdr);padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top, 0px));display:grid;grid-template-columns:1fr auto 1fr;align-items:center;position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;z-index:100;}
.topnav.franchise{background:linear-gradient(135deg,color-mix(in srgb,var(--c1) 30%,var(--bg)) 0%,var(--bg) 100%);}
.topnav-left{display:flex;align-items:center;gap:8px;}
.topnav-pseudo{font-size:12px;color:var(--muted);font-weight:600;line-height:1.2;}
.topnav-streak{font-size:11px;color:var(--orange);font-weight:700;line-height:1.2;margin-top:5px;}
.ptsbadge{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;font-weight:800;font-size:13px;padding:6px 14px;border-radius:20px;margin-left:auto;}
.ptsbadge.franchise{background:linear-gradient(135deg,var(--c1),var(--c2));}
.auth-wrap{min-height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;}
.auth-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 55% at 50% -5%,color-mix(in srgb,var(--gold) 20%,transparent) 0%,transparent 60%),var(--bg);}
.auth-body{position:relative;z-index:1;display:flex;flex-direction:column;flex:1;padding:env(safe-area-inset-top,0px) 24px calc(36px + env(safe-area-inset-bottom,0px));}
.auth-hero{display:flex;flex-direction:column;align-items:center;flex:1;padding:44px 0 22px;text-align:center;}
.ball{width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold2));display:flex;align-items:center;justify-content:center;font-size:38px;margin-bottom:16px;animation:float 3s ease-in-out infinite;}
.appname{font-size:44px;font-weight:900;letter-spacing:3px;color:var(--gold);}
.apptag{font-size:11px;color:var(--muted);margin-top:5px;letter-spacing:2.5px;font-weight:600;}
.atabs{display:flex;background:var(--s1);border:1px solid var(--bdr);border-radius:14px;padding:4px;margin-bottom:14px;}
.atab{flex:1;background:none;border:none;color:var(--muted);font-size:15px;font-weight:700;padding:10px;border-radius:10px;cursor:pointer;transition:all .2s;}
.atab.on{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;}
.aform{display:flex;flex-direction:column;gap:11px;}
.ig{position:relative;}
.iico{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none;}
.ainput{width:100%;background:var(--s1);border:1.5px solid var(--bdr);color:var(--txt);font-size:16px;padding:14px 14px 14px 42px;border-radius:12px;outline:none;transition:border-color .2s;}
.ainput:focus{border-color:var(--gold);}
.ainput::placeholder{color:var(--muted);}
.ainput.plain{padding-left:14px;}
.ptoggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px;}
.remrow{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:2px 0;}
.cbox{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--bdr);background:var(--s1);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.cbox.on{background:var(--gold);border-color:var(--gold);}
.rlabel{font-size:13px;color:var(--muted);font-weight:500;}
.abtn{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;border:none;padding:16px;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;letter-spacing:.5px;transition:transform .2s;width:100%;}
.abtn:hover{transform:scale(1.02);}
.abtn:disabled{opacity:.5;cursor:default;transform:none;}
.divrow{display:flex;align-items:center;gap:10px;}
.divline{flex:1;height:1px;background:var(--bdr);}
.divtxt{font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.sbtn{display:flex;align-items:center;justify-content:center;gap:9px;background:var(--s1);border:1.5px solid var(--bdr);color:var(--txt);padding:13px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;}
.anotice{background:color-mix(in srgb,var(--muted) 10%,transparent);border:1px solid var(--bdr);color:var(--muted);font-size:13px;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:8px;}
.aerr{background:color-mix(in srgb,var(--red) 12%,transparent);border:1px solid color-mix(in srgb,var(--red) 35%,transparent);color:var(--red);font-size:13px;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:8px;}
.aok{background:color-mix(in srgb,var(--green) 12%,transparent);border:1px solid color-mix(in srgb,var(--green) 35%,transparent);color:var(--green);font-size:13px;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:8px;}
.flink{text-align:center;font-size:13px;color:var(--muted);cursor:pointer;}
.flink span{color:var(--gold);}
.ob-wrap{min-height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;}
.ob-bg{position:absolute;inset:0;background:var(--bg);}
.ob-body{position:relative;z-index:1;display:flex;flex-direction:column;flex:1;padding:calc(36px + env(safe-area-inset-top,0px)) 24px calc(32px + env(safe-area-inset-bottom,0px));}
.dots{display:flex;gap:8px;justify-content:center;margin-bottom:28px;}
.dot{width:8px;height:8px;border-radius:50%;background:var(--bdr);transition:all .3s;}
.dot.on{background:var(--gold);width:24px;border-radius:4px;}
.ob-icon{font-size:58px;text-align:center;margin-bottom:20px;animation:float 3s ease-in-out infinite;}
.ob-title{font-size:28px;font-weight:800;text-align:center;line-height:1.1;margin-bottom:10px;}
.ob-title span{color:var(--gold);}
.ob-sub{text-align:center;color:var(--muted);font-size:15px;line-height:1.6;margin-bottom:auto;}
.ob-btn{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;border:none;padding:17px;border-radius:14px;font-size:17px;font-weight:800;cursor:pointer;width:100%;margin-top:28px;transition:transform .2s;}
.ob-btn:hover{transform:scale(1.02);}
.ob-btn:disabled{opacity:.4;cursor:default;transform:none;}
.ob-skip{text-align:center;color:var(--muted);font-size:13px;margin-top:12px;cursor:pointer;}
.ob-skip span{color:var(--gold);}
.tgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:14px 0;max-height:260px;overflow-y:auto;padding:2px;}
.tgrid::-webkit-scrollbar{width:3px;}
.tgrid::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:4px;}
.topt{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:5px 2px;border-radius:10px;border:1.5px solid transparent;transition:all .2s;}
.topt:hover{background:color-mix(in srgb,var(--gold) 8%,transparent);}
.topt.on{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 10%,transparent);}
.tlbl{font-size:8.5px;font-weight:700;color:var(--muted);letter-spacing:.4px;}
.topt.on .tlbl{color:var(--gold);}
.uninput{width:100%;background:var(--s1);border:1.5px solid var(--bdr);color:var(--txt);font-size:17px;padding:14px 16px;border-radius:12px;outline:none;transition:border-color .2s;text-align:center;font-weight:700;}
.uninput:focus{border-color:var(--gold);}
.uninput::placeholder{color:var(--muted);}
.sec{padding:14px 16px;position:relative;z-index:1;}
.card{background:var(--s1);border:1px solid var(--bdr);border-radius:16px;padding:16px;margin-bottom:12px;}
.matches-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none;margin-bottom:14px;}
.matches-strip::-webkit-scrollbar{display:none;}
.match-chip{flex-shrink:0;background:var(--s1);border:1.5px solid var(--bdr);border-radius:12px;padding:8px 12px;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:84px;}
.match-chip.featured{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 8%,transparent);}
.match-chip.live-chip{border-color:color-mix(in srgb,var(--green) 60%,transparent);background:color-mix(in srgb,var(--green) 6%,transparent);}
.match-chip.playoff{border-color:color-mix(in srgb,var(--red) 50%,transparent);}
.chip-tag{font-size:9px;font-weight:800;color:var(--gold);letter-spacing:1px;}
.chip-playoff{font-size:9px;font-weight:800;color:var(--red);}
.chip-live{font-size:9px;font-weight:800;color:var(--green);animation:pulse 1.5s infinite;}
.chip-teams{font-size:13px;font-weight:700;letter-spacing:1px;}
.chip-time{font-size:10px;color:var(--muted);font-weight:600;}
.match-hero{border-radius:20px;overflow:hidden;position:relative;margin-bottom:14px;background:var(--s1);border:1px solid var(--bdr);}
.match-hero.franchise-hero{background:linear-gradient(135deg,color-mix(in srgb,var(--c1) 25%,var(--bg)) 0%,var(--s1) 60%,color-mix(in srgb,var(--c2) 15%,var(--s1)) 100%);}
.match-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--gold) 8%,transparent) 0%,transparent 65%);pointer-events:none;}
.mhdr{text-align:center;padding:11px 16px 3px;font-size:11px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;}
.mteams{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;}
.tblk{text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;}
.tabbr{font-size:34px;font-weight:900;letter-spacing:2px;color:var(--txt);}
.tname{font-size:10px;color:var(--muted);}
.sblk{text-align:center;padding:0 14px;}
.sdisp{font-size:46px;font-weight:900;letter-spacing:4px;color:var(--gold);}
.sdisp.live-update{animation:scoreFlash .6s ease;}
@keyframes scoreFlash{0%{transform:scale(1);}50%{transform:scale(1.08);}100%{transform:scale(1);}}
.wbadge{background:linear-gradient(90deg,var(--green),#009960);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;display:inline-block;margin-top:4px;}
.live-badge{background:linear-gradient(90deg,var(--green),#00B060);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;display:inline-block;animation:pulse 1.5s infinite;}
.res-row{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-top:1px solid color-mix(in srgb,var(--bdr) 60%,transparent);}
.countdown-banner{border-radius:14px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;border:1.5px solid;}
.countdown-banner.open{background:color-mix(in srgb,var(--green) 8%,transparent);border-color:color-mix(in srgb,var(--green) 40%,transparent);}
.countdown-banner.warning{background:color-mix(in srgb,var(--orange) 12%,transparent);border-color:color-mix(in srgb,var(--orange) 60%,transparent);animation:warningpulse 1.5s ease-in-out infinite;}
.countdown-banner.locked{background:color-mix(in srgb,var(--red) 8%,transparent);border-color:color-mix(in srgb,var(--red) 40%,transparent);}
@keyframes warningpulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--orange) 30%,transparent);}50%{box-shadow:0 0 0 6px transparent;}}
.cb-ico{font-size:20px;flex-shrink:0;}
.cb-label{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px;}
.cb-label.open{color:var(--green);}
.cb-label.warning{color:var(--orange);}
.cb-label.locked{color:var(--red);}
.cb-time{font-size:22px;font-weight:800;letter-spacing:2px;}
.cb-time.open{color:var(--green);}
.cb-time.warning{color:var(--orange);}
.cb-sub{font-size:11px;color:var(--muted);margin-top:1px;}
.alert-toast{position:fixed;top:70px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--orange),#E53E1B);color:#fff;border-radius:14px;padding:12px 18px;display:flex;align-items:center;gap:10px;z-index:500;font-weight:700;font-size:14px;animation:toastin .4s cubic-bezier(.175,.885,.32,1.275);max-width:400px;width:calc(100% - 32px);}
@keyframes toastin{from{opacity:0;transform:translateX(-50%) translateY(-20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.locked-overlay{background:color-mix(in srgb,var(--red) 6%,transparent);border:1.5px solid color-mix(in srgb,var(--red) 30%,transparent);border-radius:16px;padding:20px;text-align:center;margin-bottom:14px;}
.pbar{height:3px;background:var(--bdr);border-radius:2px;margin-bottom:16px;}
.pfill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:2px;transition:width .4s;}
.pfill.franchise-fill{background:linear-gradient(90deg,var(--c1),var(--c2));}
.qcard{background:var(--s1);border:1px solid var(--bdr);border-radius:16px;padding:18px;margin-bottom:12px;padding-top:0;}
.qlbl{font-size:10px;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:7px;}
.qq{font-size:17px;font-weight:700;margin-bottom:16px;line-height:1.4;color:var(--txt);}
.qopts{display:flex;flex-direction:column;gap:9px;}
.qopt{background:var(--s2);border:1.5px solid var(--bdr);padding:12px 14px;border-radius:12px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:all .2s;font-size:14px;font-weight:500;color:var(--txt);text-align:left;}
.qopt:hover:not(:disabled){border-color:var(--blue);background:color-mix(in srgb,var(--blue) 8%,transparent);}
.ppill{background:color-mix(in srgb,var(--gold) 18%,transparent);border:1px solid var(--gold);color:var(--gold);font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;display:inline-block;margin-bottom:10px;}
.sinrow{display:flex;align-items:center;justify-content:center;gap:14px;margin:16px 0;}
.sin{width:76px;height:60px;background:var(--s2);border:2px solid var(--bdr);border-radius:12px;color:var(--txt);font-size:32px;font-weight:800;text-align:center;outline:none;}
.sin:focus{border-color:var(--gold);}
.sin-pts{width:100px;height:60px;background:var(--s2);border:2px solid var(--bdr);border-radius:12px;color:var(--txt);font-size:32px;font-weight:800;text-align:center;outline:none;}
.sin-pts:focus{border-color:var(--gold);}
.sdash{font-size:28px;font-weight:800;color:var(--muted);}
.sbmit{width:100%;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;border:none;padding:14px;border-radius:13px;font-size:16px;font-weight:800;cursor:pointer;transition:transform .2s;}
.sbmit:hover{transform:scale(1.02);}
.sbmit:disabled{opacity:.5;cursor:default;transform:none;}
.sbmit.franchise-btn{background:linear-gradient(135deg,var(--c1),var(--c2));}
.roster-select{width:100%;background:var(--s2);border:1.5px solid var(--bdr);color:var(--txt);font-size:16px;padding:12px 14px;border-radius:12px;outline:none;cursor:pointer;}
.roster-select:focus{border-color:var(--gold);}
.roster-select option{background:var(--s1);color:var(--txt);}
.roster-block{margin-bottom:14px;}
.roster-label{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.edit-row{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--bdr);transition:background .15s;}
.edit-row:last-child{border-bottom:none;}
.edit-row:hover{background:color-mix(in srgb,var(--gold) 6%,transparent);}
.ranking-tabs{display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;}
.ranking-tabs::-webkit-scrollbar{display:none;}
.ranking-tab{flex-shrink:0;background:var(--s1);border:1.5px solid var(--bdr);color:var(--muted);font-size:12px;font-weight:700;padding:8px 14px;border-radius:20px;cursor:pointer;transition:all .2s;white-space:nowrap;}
.ranking-tab.on{background:linear-gradient(135deg,var(--gold),var(--gold2));border-color:transparent;color:#fff;}
.lbrow{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--bdr);}
.lbrow:last-child{border-bottom:none;}
.lbrank{font-size:22px;font-weight:800;width:30px;text-align:center;}
.lbname{flex:1;font-weight:600;font-size:14px;}
.lbname.me{color:var(--gold);}
.lbpts{font-size:19px;font-weight:800;}
.lbstreak{font-size:11px;color:var(--muted);}
.pcard{background:var(--s1);border:1px solid var(--bdr);border-radius:20px;padding:22px;text-align:center;margin-bottom:12px;}
.pcard.franchise-card{background:linear-gradient(135deg,color-mix(in srgb,var(--c1) 20%,var(--s1)) 0%,var(--s1) 50%,color-mix(in srgb,var(--c2) 10%,var(--s1)) 100%);border-color:color-mix(in srgb,var(--c1) 40%,var(--bdr));}
.pname{font-size:27px;font-weight:800;letter-spacing:1px;margin-top:10px;}
.pemail{font-size:13px;color:var(--muted);margin-top:3px;}
.pstats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--bdr);border-radius:12px;overflow:hidden;margin-top:16px;}
.pstat{background:var(--s2);padding:12px 6px;text-align:center;}
.psval{font-size:22px;font-weight:800;color:var(--gold);}
.pslbl{font-size:10px;color:var(--muted);margin-top:2px;}
.logoutbtn{width:100%;background:none;border:1.5px solid var(--bdr);color:var(--muted);padding:13px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:10px;transition:all .2s;}
.logoutbtn:hover{border-color:var(--red);color:var(--red);}
.editprofile-btn{width:100%;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;border:none;padding:13px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:10px;transition:transform .2s;}
.editprofile-btn:hover{transform:scale(1.02);}
.no-games{background:var(--s1);border:1px solid var(--bdr);border-radius:16px;padding:32px;text-align:center;}
.loading-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;background:var(--bg);}
.spinner{width:40px;height:40px;border:3px solid var(--bdr);border-top-color:var(--gold);border-radius:50%;animation:spin 0.8s linear infinite;}
.toggle{width:44px;height:26px;border-radius:13px;cursor:pointer;position:relative;flex-shrink:0;}
.toggle-knob{position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;}
.hist-card{background:var(--s1);border:1px solid var(--bdr);border-radius:16px;overflow:hidden;margin-bottom:12px;cursor:pointer;transition:border-color .2s;}
.hist-card:hover{border-color:var(--gold);}
.hist-card.open{border-color:var(--gold);}
.hist-header{padding:12px 14px;display:flex;align-items:center;border-bottom:1px solid var(--bdr);gap:8px;}
.hist-body{padding:10px 14px;}
.hist-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;border-bottom:1px solid var(--bdr);}
.hist-row:last-child{border-bottom:none;}
.hist-label{color:var(--muted);}
.hist-pending{padding:14px;text-align:center;font-size:13px;color:var(--muted);}
.community-section{padding:12px 14px;background:color-mix(in srgb,var(--gold) 4%,var(--s2));border-top:1px solid var(--bdr);}
.franchise-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px;max-height:200px;overflow-y:auto;}
.franchise-grid::-webkit-scrollbar{width:3px;}
.franchise-grid::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:4px;}
.franchise-opt{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px 2px;border-radius:8px;border:1.5px solid transparent;transition:all .2s;}
.franchise-opt.on{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 10%,transparent);}
.franchise-opt:hover{background:color-mix(in srgb,var(--gold) 5%,transparent);}
.theme-section{padding:10px 0;border-top:1px solid var(--bdr);}
.theme-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;}
.photo-upload{width:90px;height:90px;border-radius:50%;border:2.5px dashed var(--bdr);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;position:relative;margin:0 auto;}
.photo-upload:hover{border-color:var(--gold);}
.photo-upload img{width:100%;height:100%;object-fit:cover;}
.photo-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;}
.photo-upload:hover .photo-overlay{opacity:1;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.modal-sheet{background:var(--bg);border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;max-height:calc(100dvh - env(safe-area-inset-top, 0px) - 64px);padding-bottom:calc(24px + env(safe-area-inset-bottom, 0px));overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;animation:slideUp .3s ease;}
.modal-sheet::-webkit-scrollbar{display:none;}
.sheet-head{position:sticky;top:-24px;z-index:2;display:flex;align-items:center;justify-content:space-between;background:var(--bg);margin:-24px -24px 12px;padding:16px 16px 10px 24px;border-bottom:1px solid var(--bdr);}
.sheet-close{width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:var(--s1);border:1px solid var(--bdr);border-radius:50%;color:var(--txt);font-size:18px;cursor:pointer;line-height:1;flex-shrink:0;}
.input-group{margin-bottom:14px;}
.input-label{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;}
.pseudo-check{font-size:12px;margin-top:4px;font-weight:600;}
.pseudo-check.ok{color:var(--green);}
.pseudo-check.no{color:var(--red);}
.pseudo-check.checking{color:var(--muted);}
.bonus-banner{background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 15%,transparent),color-mix(in srgb,var(--gold2) 10%,transparent));border:1.5px solid var(--gold);border-radius:14px;padding:14px;text-align:center;margin-top:10px;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
@keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}
.ani{animation:slideUp .3s ease forwards;}
@keyframes slideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
.shk{animation:shake .4s ease;}
`;

function BiometricScreen({profile,verifyBiometric,onSuccess,onLogout,css}){
  const [error,setError]=useState("");
  const [tried,setTried]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    async function autoVerify(){
      const ok=await verifyBiometric();
      if(cancelled)return;
      if(ok){onSuccess();}
      else{setError("Authentification échouée.");}
      setTried(true);
    }
    autoVerify();
    return()=>{cancelled=true;};
  },[]);// eslint-disable-line

  return(
    <><style>{css}</style>
    <div style={{"--bg":"#07090E","--gold":"#F5B800","--txt":"#EEF2F7","--muted":"#52677F","--bdr":"#1A2640","--red":"#E8365D",minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:20}}>
      <div style={{fontSize:56}}>🏀</div>
      <div style={{fontWeight:900,fontSize:28,color:"var(--gold)",letterSpacing:3}}>NBgAmes</div>
      {profile?.username&&<div style={{fontSize:16,color:"var(--txt)",fontWeight:600}}>Bonjour {profile.username} 👋</div>}
      {!tried&&<div style={{fontSize:13,color:"var(--muted)",marginTop:8}}>Vérification en cours...</div>}
      {tried&&(
        <>
          <button onClick={async()=>{
            setError("");
            const ok=await verifyBiometric();
            if(ok){onSuccess();}else{setError("Authentification échouée.");}
          }} style={{marginTop:8,width:"100%",maxWidth:320,padding:"18px",borderRadius:16,border:"1.5px solid color-mix(in srgb,var(--gold) 40%,var(--bdr))",background:"color-mix(in srgb,var(--gold) 10%,#0E1520)",color:"var(--gold)",fontWeight:800,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
            <span style={{fontSize:32}}>🔐</span> Réessayer
          </button>
          {error&&<div style={{fontSize:13,color:"var(--red)",textAlign:"center"}}>{error}</div>}
        </>
      )}
      <button onClick={onLogout} style={{background:"none",border:"none",color:"var(--muted)",fontSize:13,cursor:"pointer",textDecoration:"underline",marginTop:8}}>
        Se connecter avec un autre compte
      </button>
    </div></>
  );
}

export default function NBGames() {
  const [firebaseUser,setFirebaseUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [profile,setProfile]=useState(null);
  const [profileLoadVersion,setProfileLoadVersion]=useState(0);
  const [leaderboard,setLeaderboard]=useState([]);
  const [screen,setScreen]=useState("auth");
  const [biometricAvailable,setBiometricAvailable]=useState(false);
  const [biometricEnabled,setBiometricEnabled]=useState(false);
  const [biometricError,setBiometricError]=useState("");
  const [tab,setTab]=useState("match");
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({email:"",password:""});
  const [remember,setRemember]=useState(false);
  const [rememberDays,setRememberDays]=useState(30);
  const [showReset,setShowReset]=useState(false);
  const [resetEmail,setResetEmail]=useState("");
  const [resetMsg,setResetMsg]=useState("");
  const [resetErr,setResetErr]=useState("");
  const [resetLoading,setResetLoading]=useState(false);
  const [err,setErr]=useState("");
  const [appleNotice,setAppleNotice]=useState("");
  const [loading,setLoading]=useState(false);
  const [showPwd,setShowPwd]=useState(false);
  const [shake,setShake]=useState(false);
  const [obStep,setObStep]=useState(0);
  const [teamIdx,setTeamIdx]=useState(1);
  const [pseudo,setPseudo]=useState("");
  const [pseudoStatus,setPseudoStatus]=useState(null);
  const pseudoTimer=useRef(null);
  const [allGames,setAllGames]=useState([]);
  const [featuredMatch,setFeaturedMatch]=useState(null);
  const [lastMatch,setLastMatch]=useState(null);
  const [matchLoading,setMatchLoading]=useState(true);
  const [liveScoreKey,setLiveScoreKey]=useState(0);
  const [rosterHome,setRosterHome]=useState([]);
  const [rosterAway,setRosterAway]=useState([]);
  const [rosterLoading,setRosterLoading]=useState(false);
  const [now,setNow]=useState(new Date());
  const [showAlert,setShowAlert]=useState(false);
  const [alertDismissed,setAlertDismissed]=useState(false);
  const alertShownRef=useRef(false);
  const prevMatchIdRef=useRef(null);
  const prevScoreRef=useRef(null);
  const autoCalcDoneRef=useRef({});
  const scoringRunRef=useRef(null);
  const [pronostics,setPronostics]=useState(null);
  const [pronosticStep,setPronosticStep]=useState(0);
  const [pronosticDone,setPronosticDone]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [sg,setSg]=useState({statVal:""});
  const [scoring,setScoring]=useState(null);
  const [scoringDone,setScoringDone]=useState(false);
  const [notifEnabled,setNotifEnabled]=useState(false);
  const [history,setHistory]=useState([]);
  const [showConfetti,setShowConfetti]=useState(false);
  const [openHistoryId,setOpenHistoryId]=useState(null);
  const [communityData,setCommunityData]=useState({});
  const [rankingPeriod,setRankingPeriod]=useState("global");
  const [seasonArchives,setSeasonArchives]=useState([]);
  const [openArchive,setOpenArchive]=useState(null);
  const [showDeleteAccount,setShowDeleteAccount]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState("");
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [deleteErr,setDeleteErr]=useState("");
  const [periodLeaderboard,setPeriodLeaderboard]=useState([]);
  const [selectedUserBet,setSelectedUserBet]=useState(null);
  const [showHistory,setShowHistory]=useState(false);
  const [miniGamePage,setMiniGamePage]=useState(null);
  const [showAdminTrades,setShowAdminTrades]=useState(false);
  // Theme & lang
  const [lang,setLang]=useState("fr");
  const [darkMode,setDarkMode]=useState(true);
  const [franchiseMode,setFranchiseMode]=useState(false);
  const [themeTeamIdx,setThemeTeamIdx]=useState(1);
  // Edit profile
  const [showEditProfile,setShowEditProfile]=useState(false);
  const [showRules,setShowRules]=useState(false);

  /* Dans l'app connectée, seul .scrollarea doit défiler. Si le document défile
     aussi, les deux se disputent le geste : en bout de zone, le défilement
     extérieur prend le relais et décale toute l'app (l'« à-coup »).
     On ne verrouille PAS les écrans de connexion : ils ont besoin du
     défilement du document quand le clavier s'ouvre. */
  useEffect(()=>{
    const el=document.documentElement;
    if(screen==="app")el.classList.add("app-locked");
    else el.classList.remove("app-locked");
    return()=>el.classList.remove("app-locked");
  },[screen]);

  /* Verrouille le défilement de la page tant qu'une feuille est ouverte.
     Sans cela, le geste traverse la modale et fait défiler l'écran derrière,
     ce qui donne l'impression que la navigation déraille. */
  const modaleOuverte=showHistory||showRules||!!selectedUserBet||showDeleteAccount;
  useEffect(()=>{
    if(!modaleOuverte)return;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=prev;};
  },[modaleOuverte]);
  const [adminMsg,setAdminMsg]=useState("");
  const [editForm,setEditForm]=useState({pseudo:"",email:"",currentPwd:"",newPwd:"",confirmPwd:""});
  const [editTeamIdx,setEditTeamIdx]=useState(1);
  const [editPseudoStatus,setEditPseudoStatus]=useState(null);
  const editPseudoTimer=useRef(null);
  const [editPhotoFile,setEditPhotoFile]=useState(null);
  const [editPhotoPreview,setEditPhotoPreview]=useState(null);
  const [editErr,setEditErr]=useState("");
  const [editOk,setEditOk]=useState("");
  const [editLoading,setEditLoading]=useState(false);
  const photoInputRef=useRef(null);

  const t=useT(lang);
  const themeTeam=NBA_TEAMS[themeTeamIdx]||NBA_TEAMS[1];

  /* Mesure les hauteurs réelles de l'en-tête et de la barre du bas, et les expose
     en variables CSS. Les valeurs étaient codées en dur (56px / 82px) et ne
     tenaient pas compte du contenu ni des zones de sécurité : le haut et le bas
     des pages restaient inaccessibles. On remesure à chaque changement de taille. */
  useLayoutEffect(()=>{
    const root=document.documentElement;
    function mesurer(){
      const top=document.querySelector(".topnav");
      const bot=document.querySelector(".bnav");
      if(top)root.style.setProperty("--topnav-h",Math.ceil(top.getBoundingClientRect().height)+"px");
      if(bot)root.style.setProperty("--bnav-h",Math.ceil(bot.getBoundingClientRect().height)+"px");
    }
    mesurer();
    const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(mesurer):null;
    if(ro){
      const top=document.querySelector(".topnav");
      const bot=document.querySelector(".bnav");
      if(top)ro.observe(top);
      if(bot)ro.observe(bot);
    }
    window.addEventListener("resize",mesurer);
    window.addEventListener("orientationchange",mesurer);
    return()=>{
      ro&&ro.disconnect();
      window.removeEventListener("resize",mesurer);
      window.removeEventListener("orientationchange",mesurer);
    };
    // [] : on installe l'observateur UNE fois. Sans ce tableau, l'effet se
    // rejouait à chaque rendu — donc chaque seconde à cause du compte à rebours —
    // détruisant et recréant l'observateur en boucle, ce qui figeait l'interface.
  },[]);

  useEffect(()=>{
    const vars=buildThemeVars(darkMode,franchiseMode,themeTeamIdx);
    Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  },[darkMode,franchiseMode,themeTeamIdx]);

  useEffect(()=>{
    if(profile?.teamIdx!==undefined)setEditTeamIdx(profile.teamIdx);
    if(profile?.lang)setLang(profile.lang);
    if(profile?.darkMode!==undefined)setDarkMode(profile.darkMode);
    if(profile?.franchiseMode!==undefined)setFranchiseMode(profile.franchiseMode);
    if(profile?.themeTeamIdx!==undefined)setThemeTeamIdx(profile.themeTeamIdx);
  },[profile?.teamIdx,profile?.lang,profile?.darkMode,profile?.franchiseMode,profile?.themeTeamIdx]);

  // Au démarrage de l'app : le PREMIER joueur connecté déclenche le calcul et le
  // crédit des points Trades pour TOUS les joueurs (y compris ceux ayant
  // pronostiqué avant la mise en place du scoring). Un verrou transactionnel
  // garantit un seul calcul par version des résultats admin.
  const tradesCalcRef=useRef(false);
  useEffect(()=>{
    if(!firebaseUser||tradesCalcRef.current)return;
    tradesCalcRef.current=true;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'tradesAdmin','2025'));
        if(!snap.exists())return;
        const data=snap.data();
        const answers=data.answers||{};
        const answered=Object.keys(answers).filter(k=>answers[k]?.stayed!==undefined&&answers[k]?.stayed!==null).length;
        if(answered===0)return;
        const stamp=String(data.updatedAt||answered);
        const won=await claimTradesCalcLock(stamp);
        if(won){
          // Le verrou est posé avant le calcul : en cas d'échec il faut le
          // relâcher, sinon plus personne ne recréditerait cette version.
          try{await creditAllTradesUsers(answers);}
          catch(e){await releaseTradesCalcLock();}
        }
        // Rafraîchit le profil local pour afficher le score sans rechargement
        const userSnap=await getDoc(doc(db,'users',firebaseUser.uid));
        if(userSnap.exists()){
          const u=userSnap.data();
          setProfile(p=>p?{...p,points:u.points,weekPts:u.weekPts,monthPts:u.monthPts,tradesGame2025:u.tradesGame2025}:p);
        }
      }catch(e){}
    })();
  },[firebaseUser]);

  // Recharge le profil depuis Firestore (points, streak…) — utilisé après une
  // clôture de saison ou tout changement fait côté serveur, pour que la bannière
  // et l'onglet Profil ne restent pas sur des valeurs périmées.
  const refreshProfile=useCallback(async()=>{
    if(!firebaseUser)return;
    try{
      const snap=await getDoc(doc(db,"users",firebaseUser.uid));
      if(snap.exists())setProfile(snap.data());
    }catch(e){}
  },[firebaseUser]);

  // Rafraîchit le profil au retour au premier plan
  useEffect(()=>{
    if(!firebaseUser)return;
    function onVisible(){if(document.visibilityState==="visible")refreshProfile();}
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",onVisible);
    return()=>{
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("focus",onVisible);
    };
  },[firebaseUser,refreshProfile]);

  // Rattrapage des pronostics jamais crédités (voir catchUpUnscoredPronostics) :
  // à l'ouverture puis au retour au premier plan, au plus toutes les 10 min.
  const lastCatchUpRef=useRef(0);
  useEffect(()=>{
    if(screen!=="app"||!firebaseUser)return;
    async function run(){
      if(Date.now()-lastCatchUpRef.current<10*60*1000)return;
      lastCatchUpRef.current=Date.now();
      try{if(await catchUpUnscoredPronostics(t))refreshProfile();}catch(e){console.error(e);}
    }
    run();
    function onVisible(){if(document.visibilityState==="visible")run();}
    document.addEventListener("visibilitychange",onVisible);
    return()=>document.removeEventListener("visibilitychange",onVisible);
  },[screen,firebaseUser,refreshProfile,t]);

  // Vérifie périodiquement si une nouvelle version de l'app a été déployée
  // (contourne le cache agressif de Safari/PWA sur home screen) et recharge automatiquement.
  useEffect(()=>{
    const currentBundle=[...document.scripts].map(s=>s.src).find(src=>/\/static\/js\/main\.[^/]+\.js$/.test(src))||'';
    if(!currentBundle)return;
    let cancelled=false;
    async function checkVersion(){
      try{
        const res=await fetch('/index.html',{cache:'no-store'});
        const html=await res.text();
        const match=html.match(/\/static\/js\/main\.[^"']+\.js/);
        if(!cancelled&&match&&!currentBundle.endsWith(match[0])){
          window.location.reload();
        }
      }catch(e){}
    }
    const interval=setInterval(checkVersion,60000);
    function onVisible(){if(document.visibilityState==='visible')checkVersion();}
    document.addEventListener('visibilitychange',onVisible);
    return()=>{cancelled=true;clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);};
  },[]);

  async function savePref(key,val){if(!firebaseUser)return;await updateDoc(doc(db,"users",firebaseUser.uid),{[key]:val});setProfile(p=>({...p,[key]:val}));}

  const parisNow=new Date(now.toLocaleString("en-US",{timeZone:"Europe/Paris"}));
  const parisHour=parisNow.getHours();
  const canReveal=parisHour>=9;
  const next9h=new Date(parisNow);next9h.setHours(9,0,0,0);
  if(parisHour>=9)next9h.setDate(next9h.getDate()+1);
  const countdownTo9h=fmtCountdown(next9h-parisNow);

  useEffect(()=>{
    if(!profile)return;
    const entries=Object.entries(profile).filter(([k])=>k.startsWith("pronostic_")).map(([k,v])=>({matchId:k.replace("pronostic_",""),...v})).filter(e=>e.done).sort((a,b)=>{if(a.tipoff&&b.tipoff)return new Date(b.tipoff)-new Date(a.tipoff);return b.matchId.localeCompare(a.matchId);});
    setHistory(entries);
  },[profile]);

  // Charge les saisons archivées à l'ouverture de l'onglet Archives
  useEffect(()=>{
    if(tab!=="leaderboard"||rankingPeriod!=="archives")return;
    (async()=>{
      try{setSeasonArchives(await fetchSeasonArchives());}catch(e){}
    })();
  },[tab,rankingPeriod]);

  // Load community data for open history item
  useEffect(()=>{
    if(!openHistoryId)return;
    const key="pronostic_"+openHistoryId;
    const q=query(collection(db,"users"),limit(200));
    const unsub=onSnapshot(q,snap=>{
      const winner={},scorer={},homeScore={},awayScore={},scorerPts={};
      snap.docs.forEach(d=>{
        const p=d.data()[key];if(!p)return;
        if(p.w)winner[p.w]=(winner[p.w]||0)+1;
        // Nouveau format : statPlayer/statVal ; ancien : scorer/scorerPts
        const pl=p.statPlayer||p.scorer;
        if(pl)scorer[pl]=(scorer[pl]||0)+1;
        const sv=p.statVal??p.scorerPts;
        if(sv!=null)scorerPts[sv]=(scorerPts[sv]||0)+1;
        if(p.homeScore!=null)homeScore[p.homeScore]=(homeScore[p.homeScore]||0)+1;
        if(p.awayScore!=null)awayScore[p.awayScore]=(awayScore[p.awayScore]||0)+1;
      });
      setCommunityData({winner,scorer,homeScore,awayScore,scorerPts});
    });
    return()=>unsub();
  },[openHistoryId]);

  // Period leaderboard
  useEffect(()=>{
    if(tab!=="leaderboard")return;
    const weekKey=getWeekKey(),monthKey=getMonthKey();
    const q=query(collection(db,"users"),limit(200));
    const unsub=onSnapshot(q,snap=>{
      const users=snap.docs.map(d=>({id:d.id,...d.data(),isMe:firebaseUser&&d.id===firebaseUser.uid}));
      if(rankingPeriod==="lastmatch"){
        // Trouver le match scoré le plus récent via tipoff des pronostics (fiable même avec peu de joueurs)
        let bestMatchId=null,bestTipoff=null;
        users.forEach(u=>{
          Object.keys(u).filter(k=>k.startsWith("pronostic_")).forEach(k=>{
            const p=u[k];
            if(p?.done&&p?.scoring&&p?.tipoff){
              if(!bestTipoff||p.tipoff>bestTipoff){bestTipoff=p.tipoff;bestMatchId=k.replace("pronostic_","");}
            }
          });
        });
        if(!bestMatchId){setPeriodLeaderboard([]);return;}
        const lastKey="pronostic_"+bestMatchId;
        const played=users.filter(u=>u[lastKey]?.done&&u[lastKey]?.scoring);
        const sorted=played.sort((a,b)=>(b[lastKey]?.scoring?.total||0)-(a[lastKey]?.scoring?.total||0));
        setPeriodLeaderboard(sorted.map((u,i)=>({...u,rank:i+1,displayPts:u[lastKey]?.scoring?.total||0,betKey:lastKey})));
      }else if(rankingPeriod==="week"){
        const sorted=users.sort((a,b)=>((b.weekPts||{})[weekKey]||0)-((a.weekPts||{})[weekKey]||0));
        setPeriodLeaderboard(sorted.map((u,i)=>({...u,rank:i+1,displayPts:(u.weekPts||{})[weekKey]||0})));
      }else if(rankingPeriod==="month"){
        const sorted=users.sort((a,b)=>((b.monthPts||{})[monthKey]||0)-((a.monthPts||{})[monthKey]||0));
        setPeriodLeaderboard(sorted.map((u,i)=>({...u,rank:i+1,displayPts:(u.monthPts||{})[monthKey]||0})));
      }
    });
    return()=>unsub();
  },[tab,rankingPeriod,firebaseUser,lastMatch?.id]);

  /* Notifications. Dans l'app iOS/Android, l'API web Notification n'existe pas :
     on passe par les notifications locales natives (l'ancien code passait par l'API
     web, d'où le message « autorisez dans les réglages » alors qu'elles l'étaient). */
  useEffect(()=>{
    (async()=>{
      if(IS_NATIVE)setNotifEnabled(notificationsWanted()&&await notificationPermissionGranted());
      else setNotifEnabled("Notification"in window&&Notification.permission==="granted");
    })();
  },[]);
  async function toggleNotif(){
    if(notifEnabled){
      setNotifEnabled(false);
      if(IS_NATIVE){setNotificationsWanted(false);await cancelAllReminders();}
      return;
    }
    const g=IS_NATIVE?await requestNotificationPermission():await requestNotifPermission();
    if(IS_NATIVE)setNotificationsWanted(g);
    setNotifEnabled(g);
    if(!g)alert(IS_NATIVE?"Les notifications de NBgAmes sont bloquées par le téléphone : active-les dans Réglages → NBgAmes → Notifications.":"Autorisez les notifications dans les réglages du navigateur.");
  }
  // Rappel quotidien de 9h, reprogrammé à chaque ouverture tant qu'il est activé
  useEffect(()=>{if(IS_NATIVE&&notifEnabled&&screen==="app")scheduleDailyReminders();},[notifEnabled,screen]);

  /* Mode invité (App Store 5.1.1(v)) : sans compte, on peut voir le match du jour,
     les scores, le classement, les règles et jouer au quiz. Le compte n'est demandé
     que pour ce qui lui est lié : pronostiquer, enregistrer des points, le profil. */
  // Modèle réel de l'appareil (« iPhone15,3 », « iPad13,1 »…) : l'app iPhone sur iPad
  // se présente comme un iPhone au niveau de l'interface, pas du matériel.
  const [isIPhone,setIsIPhone]=useState(false);
  useEffect(()=>{
    if(!IS_IOS)return;
    Device.getInfo().then(i=>setIsIPhone(!/ipad/i.test(i.model||"")&&!/ipad/i.test(i.name||""))).catch(()=>{});
  },[]);
  const GUEST_KEY="nbgames_guest";
  const isGuest=!firebaseUser;
  function enterGuest(){
    try{localStorage.setItem(GUEST_KEY,"1");}catch(e){}
    setErr("");setTab("match");setScreen("app");
  }
  function goToAuth(m){setMode(m);setErr("");setScreen("auth");}
  function GuestCta({text}){
    return(
      <div className="qcard ani" style={{textAlign:"center"}}>
        <div style={{fontSize:34,marginBottom:6}}>🏀</div>
        <div style={{fontSize:20,fontWeight:800,color:"var(--gold)",marginBottom:6}}>{t.guestCtaTitle}</div>
        <div style={{fontSize:14,color:"var(--muted)",lineHeight:1.5,marginBottom:16}}>{text}</div>
        <button className="abtn" style={{marginBottom:10}} onClick={()=>goToAuth("signup")}>{t.guestCreate}</button>
        <button onClick={()=>goToAuth("login")} style={{width:"100%",padding:"12px 0",background:"none",border:"1px solid var(--bdr)",borderRadius:14,color:"var(--txt)",fontSize:14,fontWeight:700,cursor:"pointer"}}>{t.guestSignIn}</button>
      </div>
    );
  }

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async fbUser=>{
      if(fbUser){
        // Vérifier si la session a expiré
        const expiry=localStorage.getItem("nbgames_session_expiry");
        if(expiry&&Date.now()>parseInt(expiry)){
          localStorage.removeItem("nbgames_session_expiry");
          await signOut(auth);
          return;
        }
        setFirebaseUser(fbUser);
        localStorage.removeItem(GUEST_KEY);
        const snap=await getDoc(doc(db,"users",fbUser.uid));
        if(snap.exists()){
          setProfile(snap.data());
          setProfileLoadVersion(v=>v+1);
          // Si biométrie activée → écran de verrouillage (uniquement au premier chargement)
          const hasBiometric=!!localStorage.getItem("nbgames_biometric");
          setScreen(prev=>prev==="app"?"app":hasBiometric?"biometric":"app");
        }else setScreen("onboard");
      }
      // Sans compte : retour direct en mode invité si c'était le choix précédent
      else{setFirebaseUser(null);setProfile(null);setScreen(localStorage.getItem(GUEST_KEY)?"app":"auth");}
      setAuthLoading(false);
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{
    if(screen!=="app")return;
    const q=query(collection(db,"users"),orderBy("points","desc"),limit(20));
    const unsub=onSnapshot(q,snap=>{setLeaderboard(snap.docs.map((d,i)=>({id:d.id,rank:i+1,...d.data(),isMe:firebaseUser&&d.id===firebaseUser.uid})));});
    return()=>unsub();
  },[screen,firebaseUser]);

  const loadGamesStatic=useCallback(async()=>{
    setMatchLoading(true);
    const{games,sessionDate}=await fetchESPNGames();
    if(!games.length){
      try{const cs=await getDoc(doc(db,"config","dailyMatch"));if(cs.exists()){const s=cs.data();const m={id:s.matchId,home:s.home,away:s.away,homeName:s.home,awayName:s.away,tipoff:"",homeScore:0,awayScore:0,isFinished:false,isLive:false,isPostseason:false,topScorer:null,topScorerPts:null};setAllGames([]);setFeaturedMatch(m);setLastMatch(m);setMatchLoading(false);return;}}catch(e){}
      setAllGames([]);setFeaturedMatch(null);setMatchLoading(false);return;
    }
    setAllGames(games);
    const featured=await resolveFeaturedMatch(games,sessionDate);
    if(featured&&prevMatchIdRef.current&&prevMatchIdRef.current!==featured.id&&notifEnabled)sendNotif(t.notifNewMatch,`${featured.home} vs ${featured.away}`);
    prevMatchIdRef.current=featured?.id||null;
    setFeaturedMatch(featured);setLastMatch(featured);
    setMatchLoading(false);
  },[notifEnabled,t]);

  /* Effectifs des deux équipes du match du jour (question 2). Chargés dès qu'un match
     est connu, quel que soit le chemin qui l'a fourni (ESPN ou config Firestore). */
  const [rosterTry,setRosterTry]=useState(0);
  useEffect(()=>{
    const m=featuredMatch;if(!m?.home||!m?.away)return;
    const homeId=m.homeId||ESPN_TEAM_IDS[m.home],awayId=m.awayId||ESPN_TEAM_IDS[m.away];
    let cancelled=false;
    (async()=>{
      setRosterLoading(true);
      const[homeR,awayR]=await Promise.all([fetchTeamRoster(homeId),fetchTeamRoster(awayId)]);
      if(cancelled)return;
      setRosterHome(homeR.sort((a,b)=>a.localeCompare(b)));setRosterAway(awayR.sort((a,b)=>a.localeCompare(b)));
      setRosterLoading(false);
    })();
    return()=>{cancelled=true;};
  },[featuredMatch?.home,featuredMatch?.away,featuredMatch?.homeId,featuredMatch?.awayId,rosterTry]);

  const updateLiveScore=useCallback(async()=>{
    if(!featuredMatch?.id)return;
    const updated=await fetchLiveScore(featuredMatch.id);if(!updated)return;
    const prev=prevScoreRef.current;
    if(prev&&(updated.homeScore!==prev.home||updated.awayScore!==prev.away))setLiveScoreKey(k=>k+1);
    prevScoreRef.current={home:updated.homeScore,away:updated.awayScore};
    setFeaturedMatch(p=>p?{...p,homeScore:updated.homeScore,awayScore:updated.awayScore,isFinished:updated.isFinished,isLive:updated.isLive,topScorer:updated.topScorer,topScorerPts:updated.topScorerPts}:p);
    setLastMatch(p=>p?.id===updated.id?{...p,homeScore:updated.homeScore,awayScore:updated.awayScore,isFinished:updated.isFinished,isLive:updated.isLive,topScorer:updated.topScorer,topScorerPts:updated.topScorerPts,topScorers:updated.topScorers||[]}:p);
    if(updated.isFinished&&firebaseUser&&!autoCalcDoneRef.current[updated.id]){autoCalcDoneRef.current[updated.id]=true;autoCalculateAllUsers(updated,t);}
  },[featuredMatch?.id,t,firebaseUser]);

  useEffect(()=>{if(screen!=="app")return;setTimeout(()=>loadGamesStatic(),500);const iv=setInterval(loadGamesStatic,300000);return()=>clearInterval(iv);},[screen,loadGamesStatic]);
  useEffect(()=>{if(screen!=="app")return;const iv=setInterval(updateLiveScore,30000);return()=>clearInterval(iv);},[screen,updateLiveScore]);
  // Déclenche le chargement du nouveau match dès le passage à 9h Paris sans relancer l'app
  const prevCanRevealRef=useRef(canReveal);
  useEffect(()=>{
    if(canReveal&&!prevCanRevealRef.current&&screen==="app"){loadGamesStatic();}
    prevCanRevealRef.current=canReveal;
  },[canReveal,screen,loadGamesStatic]);

  useEffect(()=>{
    if(!featuredMatch||!firebaseUser||!profile)return;
    const key="pronostic_"+featuredMatch.id;const saved=profile[key];
    if(saved?.done){setPronostics(saved);setPronosticDone(true);setEditMode(false);if(saved.scoring){setScoring(saved.scoring);setScoringDone(true);}}
    else{setPronostics(null);setPronosticStep(0);setPronosticDone(false);setEditMode(false);setScoring(null);setScoringDone(false);setSg({statVal:""});}
  },[featuredMatch?.id,firebaseUser?.uid,profileLoadVersion]); // eslint-disable-line

  useEffect(()=>{
    if(!pronosticDone||scoringDone||!featuredMatch?.isFinished||!pronostics)return;
    async function go(){
      let match=featuredMatch;
      if(match.id&&!match.id.startsWith("f")){const r=await fetchMatchResult(match.id);if(r?.topScorer){match={...match,...r};setFeaturedMatch(m=>({...m,...r}));}}
      let sr=computePronosticScore(pronostics,match,t);
      if(firebaseUser){
        // Transaction : si un autre client a déjà crédité ce match, on reprend son résultat
        try{const res=await scoreUserPronostic(firebaseUser.uid,match,t);if(res){sr=res.sr;setProfile(p=>({...p,...res.data}));}}
        catch(e){console.error(e);scoringRunRef.current=null;return;}
      }
      setScoring(sr);setScoringDone(true);
      if(sr.total>0){setShowConfetti(true);setTimeout(()=>setShowConfetti(false),4000);}
    }
    // Un seul calcul à la fois par match (l'effet se relance quand featuredMatch change)
    if(scoringRunRef.current===featuredMatch.id)return;
    scoringRunRef.current=featuredMatch.id;
    go();
  },[featuredMatch,pronosticDone,scoringDone,pronostics,firebaseUser,profile,t]);

  useEffect(()=>{const iv=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(iv);},[]);

  const match=canReveal?featuredMatch:lastMatch;
  const lockTime=match?.tipoff?getLockTime(match.tipoff):null;
  const alertTime=match?.tipoff?getAlertTime(match.tipoff):null;
  const tipoffTime=match?.tipoff?new Date(match.tipoff):null;
  const msToLock=lockTime?lockTime-now:Infinity;
  const isLocked=lockTime?now>=lockTime:false;

  /* Rappel local 30 min avant la clôture des paris (iOS/Android uniquement).
     Reprogrammé à chaque nouveau match ; sans effet si l'échéance est passée. */
  useEffect(()=>{
    if(!IS_NATIVE||!firebaseUser||!lockTime||isLocked||!notifEnabled)return;
    (async()=>{
      const label=match?.home&&match?.away?`${match.home} – ${match.away}`:null;
      await scheduleBetReminder(lockTime,label);
    })();
  },[firebaseUser,match?.id,lockTime?.getTime?.()||lockTime,isLocked,notifEnabled]);
  const isFinished=match?.isFinished||(tipoffTime?now>=tipoffTime:false);
  const isLive=match?.isLive||false;
  const isWarning=alertTime?(!isLocked&&now>=alertTime):false;
  const currentScoring=(pronosticDone&&scoring&&featuredMatch?.id===match?.id)?scoring:null;

  useEffect(()=>{
    if(isWarning&&!isLocked&&!alertShownRef.current&&!alertDismissed&&screen==="app"&&match&&firebaseUser){
      alertShownRef.current=true;setShowAlert(true);
      if(notifEnabled)sendNotif(t.notifClosing,`${match.home} vs ${match.away}`);
      setTimeout(()=>setShowAlert(false),6000);
    }
  },[isWarning,isLocked,screen,alertDismissed,match,notifEnabled,t,firebaseUser]);

  const countdownStr=(!isLocked&&msToLock<Infinity)?fmtCountdown(msToLock):null;
  const tipoffStr=match?.tipoff?fmtTime(match.tipoff):"--:--";
  const lockStr=lockTime?fmtTime(lockTime):"--:--";
  const homeTeam=match?getTeam(match.home):NBA_TEAMS[1];
  const awayTeam=match?getTeam(match.away):NBA_TEAMS[0];
  const winner=isFinished&&match?(match.homeScore>match.awayScore?match.home:match.away):null;
  const showQ0=!pronosticDone&&pronosticStep===0;
  const showQ1=!pronosticDone&&pronosticStep===1;
  const showQ2=!pronosticDone&&pronosticStep===2;
  const showQ3=!pronosticDone&&pronosticStep===3;
  const globalPts=profile?.points||0;
  const myTeamIdx=profile?.teamIdx??1;
  const myTeam=NBA_TEAMS[myTeamIdx];
  const myStreak=profile?.streak||0;

  async function doAuth(){
    setErr("");
    // Espaces retirés : une espace finale (copier-coller, suggestion du clavier iPad)
    // fait échouer Firebase avec une erreur générique.
    const email=form.email.trim();
    if(!email||!form.password){setErr(t.errFill);doShake();return;}
    if(!email.includes("@")){setErr(t.errEmail);doShake();return;}
    if(form.password.length<6){setErr(t.errPwd);doShake();return;}
    setLoading(true);
    try{
      await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence);
      if(mode==="signup")await createUserWithEmailAndPassword(auth,email,form.password);
      else await signInWithEmailAndPassword(auth,email,form.password);
      if(remember&&rememberDays>0){
        const expiry=Date.now()+(rememberDays*24*60*60*1000);
        localStorage.setItem("nbgames_session_expiry",String(expiry));
      }else{
        localStorage.removeItem("nbgames_session_expiry");
      }
    }
    catch(e){
      console.error("Connexion",e);
      const msgs={"auth/email-already-in-use":t.errUsed,"auth/user-not-found":t.errNotFound,"auth/wrong-password":t.errWrongPwd,"auth/invalid-credential":t.errInvalid,"auth/invalid-email":t.errEmail,"auth/too-many-requests":t.errTooMany,"auth/network-request-failed":t.errNetwork};
      // Erreur inattendue : le code est affiché pour pouvoir la diagnostiquer
      setErr(msgs[e.code]||`${t.errGeneric} (${e.code||e.message||"inconnue"})`);doShake();
    }
    setLoading(false);
  }
  // ── Biométrie ──────────────────────────────────────────────
  const BIOMETRIC_KEY="nbgames_biometric";

  useEffect(()=>{
    (async()=>{
      if(window.PublicKeyCredential){
        const ok=await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvailable(ok);
      }
      const stored=localStorage.getItem(BIOMETRIC_KEY);
      if(stored)setBiometricEnabled(true);
    })();
  },[]);

  async function registerBiometric(){
    try{
      const challenge=crypto.getRandomValues(new Uint8Array(32));
      const uid=firebaseUser?.uid||"guest";
      const uname=profile?.username||firebaseUser?.email||"user";
      const cred=await navigator.credentials.create({publicKey:{
        challenge,
        rp:{name:"NBgAmes",id:window.location.hostname},
        user:{id:new TextEncoder().encode(uid),name:uname,displayName:uname},
        pubKeyCredParams:[{alg:-7,type:"public-key"},{alg:-257,type:"public-key"}],
        authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"preferred"},
        timeout:60000,
      }});
      const credId=btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem(BIOMETRIC_KEY,JSON.stringify({credId,uid}));
      // Quand biométrie active : supprimer l'expiration de session pour garder la connexion active
      localStorage.removeItem("nbgames_session_expiry");
      try{await setPersistence(auth,browserLocalPersistence);}catch(e){}
      setBiometricEnabled(true);
      return true;
    }catch(e){return false;}
  }

  async function verifyBiometric(){
    const stored=JSON.parse(localStorage.getItem(BIOMETRIC_KEY)||"null");
    if(!stored)return false;
    try{
      const challenge=crypto.getRandomValues(new Uint8Array(32));
      const credIdBytes=Uint8Array.from(atob(stored.credId),c=>c.charCodeAt(0));
      const assertion=await navigator.credentials.get({publicKey:{
        challenge,
        allowCredentials:[{id:credIdBytes,type:"public-key"}],
        userVerification:"required",
        timeout:60000,
      }});
      return!!assertion;
    }catch(e){return false;}
  }

  function disableBiometric(){
    localStorage.removeItem(BIOMETRIC_KEY);
    setBiometricEnabled(false);
  }

  // Pas d'auto-déclenchement sur l'écran auth (évite le double scan avec BiometricScreen)
  // ────────────────────────────────────────────────────────────

  async function doGoogle(){
    setErr("");setLoading(true);
    try{await signInWithPopup(auth,new GoogleAuthProvider());}
    catch(e){
      if(e.code!=="auth/popup-closed-by-user")setErr("Connexion Google échouée.");
    }
    setLoading(false);
  }

  async function doApple(){
    setErr("");setAppleNotice("");setLoading(true);
    try{
      if(IS_NATIVE){
        // Sur iOS, signInWithPopup ne fonctionne pas dans la WebView :
        // on passe par la feuille Apple native, puis on remet le jeton à Firebase.
        const rawNonce=makeNonce();
        const res=await SignInWithApple.authorize({
          clientId:"com.nbgames.app",
          redirectURI:"",
          scopes:"email name",
          nonce:await sha256Hex(rawNonce),
        });
        const idToken=res?.response?.identityToken;
        if(!idToken)throw new Error("no-identity-token");
        const credential=new OAuthProvider("apple.com").credential({idToken,rawNonce});
        await signInWithCredential(auth,credential);
      }else{
        const provider=new OAuthProvider("apple.com");
        provider.addScope("email");
        provider.addScope("name");
        await signInWithPopup(auth,provider);
      }
    }
    catch(e){
      // L'utilisateur qui ferme la feuille Apple ne doit pas voir d'erreur.
      const annule=e?.code==="auth/popup-closed-by-user"
        ||e?.code==="cancelled"||e?.code==="1001"
        ||/cancel/i.test(e?.message||"");
      // Dégradation silencieuse : si la feuille Apple n'aboutit pas, on oriente
      // simplement vers l'e-mail, sans présenter cela comme une panne. Le compte
      // reste accessible, aucune fonctionnalité n'est hors service.
      if(!annule){
        setMode("login");
        setAppleNotice("Tu peux aussi te connecter avec ton adresse e-mail ci-dessous.");
      }
    }
    setLoading(false);
  }

  async function doReset(){
    setResetErr("");setResetMsg("");
    const email=resetEmail.trim();
    if(!email||!email.includes("@")){setResetErr(t.errEmail);return;}
    setResetLoading(true);
    try{
      await sendPasswordResetEmail(auth,email);
      setResetMsg("📬 Email envoyé ! Vérifie ta boîte mail.");
    }catch(e){
      const msgs={"auth/user-not-found":t.errNotFound,"auth/invalid-email":t.errEmail,"auth/too-many-requests":t.errTooMany,"auth/network-request-failed":t.errNetwork};
      setResetErr(msgs[e.code]||`${t.errGeneric} (${e.code||e.message||"inconnue"})`);
    }
    setResetLoading(false);
  }
  function doShake(){setShake(true);setTimeout(()=>setShake(false),500);}

  function handlePseudoChange(val,isEdit=false){
    if(isEdit){setEditForm(f=>({...f,pseudo:val}));setEditPseudoStatus(null);clearTimeout(editPseudoTimer.current);if(val.trim().length>=3&&val.trim()!==profile?.username){setEditPseudoStatus("checking");editPseudoTimer.current=setTimeout(async()=>{const ok=await checkUsernameAvailable(val.trim(),firebaseUser?.uid);setEditPseudoStatus(ok?"ok":"taken");},600);}}
    else{setPseudo(val);setPseudoStatus(null);clearTimeout(pseudoTimer.current);if(val.trim().length>=3){setPseudoStatus("checking");pseudoTimer.current=setTimeout(async()=>{const ok=await checkUsernameAvailable(val.trim());setPseudoStatus(ok?"ok":"taken");},600);}}
  }

  async function finish(){
    if(!pseudo.trim()||!firebaseUser)return;
    if(pseudoStatus==="taken"){setErr(t.errPseudoTaken);return;}
    setLoading(true);
    try{await reserveUsername(pseudo.trim(),firebaseUser.uid);const pd={username:pseudo.trim(),teamIdx,teamAbbr:NBA_TEAMS[teamIdx].abbr,email:firebaseUser.email,points:0,streak:0,lang:"fr",darkMode:true,franchiseMode:false,themeTeamIdx:teamIdx,photoURL:null,createdAt:serverTimestamp()};await setDoc(doc(db,"users",firebaseUser.uid),pd);setProfile(pd);setScreen("app");}
    catch(e){setErr(t.errGeneric);}
    setLoading(false);
  }

  async function doLogout(){await signOut(auth);setTab("match");setPronostics(null);setPronosticStep(0);setEditMode(false);setPronosticDone(false);setSg({statVal:""});setScoring(null);setScoringDone(false);setRosterHome([]);setRosterAway([]);setHistory([]);}

  /* Suppression définitive du compte.
     Exigée dans l'app par Apple (App Store Review 5.1.1(v)) pour toute app
     permettant la création d'un compte. Ordre important : on efface les
     données AVANT le compte Auth, car les règles Firestore exigent d'être
     authentifié pour écrire. */
  async function doDeleteAccount(){
    if(!firebaseUser)return;
    setDeleteBusy(true);setDeleteErr("");
    try{
      const uid=firebaseUser.uid;
      // Compte « Se connecter avec Apple » : Apple exige de révoquer l'accès à la
      // suppression. Une nouvelle autorisation Apple fournit à la fois une connexion
      // récente (exigée par Firebase) et le code de révocation.
      if(IS_IOS&&firebaseUser.providerData?.some(p=>p.providerId==="apple.com")){
        const rawNonce=makeNonce();
        const res=await SignInWithApple.authorize({clientId:"com.nbgames.app",redirectURI:"",scopes:"",nonce:await sha256Hex(rawNonce)});
        const idToken=res?.response?.identityToken,code=res?.response?.authorizationCode;
        if(idToken)await reauthenticateWithCredential(firebaseUser,new OAuthProvider("apple.com").credential({idToken,rawNonce}));
        if(code){try{await revokeAccessToken(auth,code);}catch(e){console.error("Révocation Apple",e);}}
      }
      if(profile?.username)await releaseUsername(profile.username);
      // La photo est accessoire : le SDK Storage réessaie ~2 min avant d'abandonner,
      // ce qui figerait l'écran. On ne tente que s'il y en a une, avec un délai max.
      if(profile?.photoURL){
        try{
          await Promise.race([
            deleteObject(ref(storage,`avatars/${uid}`)),
            new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),5000)),
          ]);
        }catch(e){}
      }
      await deleteDoc(doc(db,"users",uid));
      try{await deleteDoc(doc(db,"tradesLeaderboard2025",uid));}catch(e){}
      await deleteUser(firebaseUser);
      setShowDeleteAccount(false);
      setProfile(null);setFirebaseUser(null);setScreen("auth");
      setTab("match");setHistory([]);
    }catch(e){
      // Firebase impose une connexion récente pour une opération sensible.
      if(/cancel|1001/i.test(String(e?.code||"")+String(e?.message||""))){
        setDeleteErr("Suppression annulée : la confirmation Apple a été fermée.");
      }else if(e?.code==="auth/requires-recent-login"){
        setDeleteErr("Par sécurité, reconnecte-toi puis réessaie la suppression.");
      }else{
        setDeleteErr("La suppression a échoué. Réessaie, ou écris-nous depuis la page d'assistance.");
      }
    }
    setDeleteBusy(false);
  }

  async function persistStep(data){
    if(!firebaseUser||!match)return;
    const key="pronostic_"+match.id;const enriched={...data,home:match.home,away:match.away,tipoff:match.tipoff};
    await updateDoc(doc(db,"users",firebaseUser.uid),{[key]:enriched});setProfile(p=>({...p,[key]:enriched}));
  }

  function doneEditing(){setEditMode(false);setPronosticDone(true);}
  function submitWinner(team){
    hapticTap();
    const statKey=getStatForDate(getSessionDate()).key;
    const d={...pronostics,w:team,statKey,step:1};
    setPronostics(d);persistStep(d);
    if(editMode){doneEditing();}else{setPronosticStep(1);}
  }
  function submitStatPlayer(name){hapticTap();const d={...pronostics,statPlayer:name,step:2};setPronostics(d);persistStep(d);if(editMode){doneEditing();}else{setPronosticStep(2);}}
  function submitStatVal(){
    hapticTap();
    const d={...pronostics,statVal:sg.statVal,step:3,done:true};setPronostics(d);setPronosticDone(true);setEditMode(false);
    const alreadyDone=pronostics?.done===true;
    const newStreak=alreadyDone?(profile?.streak||0):(profile?.streak||0)+1;
    const key="pronostic_"+match.id;const enriched={...d,home:match.home,away:match.away,tipoff:match.tipoff};
    if(firebaseUser){updateDoc(doc(db,"users",firebaseUser.uid),{[key]:enriched,streak:newStreak,lastBetDate:getSessionDate(),lastBetMatchId:match.id});setProfile(p=>({...p,[key]:enriched,streak:newStreak,lastBetDate:getSessionDate(),lastBetMatchId:match.id}));}
  }

  function openEditProfile(){setEditForm({pseudo:profile?.username||"",email:firebaseUser?.email||"",currentPwd:"",newPwd:"",confirmPwd:""});setEditTeamIdx(profile?.teamIdx??1);setEditPhotoFile(null);setEditPhotoPreview(profile?.photoURL||null);setEditPseudoStatus(null);setEditErr("");setEditOk("");setShowEditProfile(true);}
  function handlePhotoSelect(e){const file=e.target.files[0];if(!file)return;setEditPhotoFile(file);setEditPhotoPreview(URL.createObjectURL(file));}

  async function saveProfile(){
    setEditErr("");setEditOk("");
    if(editPseudoStatus==="taken"){setEditErr(t.errPseudoTaken);return;}
    if(editForm.newPwd&&editForm.newPwd!==editForm.confirmPwd){setEditErr(t.pwdMismatch);return;}
    if(editForm.newPwd&&editForm.newPwd.length<6){setEditErr(t.pwdTooShort);return;}
    if((editForm.newPwd||editForm.email!==firebaseUser.email)&&!editForm.currentPwd){setEditErr(t.reauthRequired);return;}
    setEditLoading(true);
    try{
      if(editForm.currentPwd){const cred=EmailAuthProvider.credential(firebaseUser.email,editForm.currentPwd);await reauthenticateWithCredential(firebaseUser,cred);}
      if(editForm.newPwd)await updatePassword(firebaseUser,editForm.newPwd);
      if(editForm.email!==firebaseUser.email)await updateEmail(firebaseUser,editForm.email);
      let photoURL=profile?.photoURL||null;
      if(editPhotoFile){const storRef=ref(storage,`avatars/${firebaseUser.uid}`);await uploadBytes(storRef,editPhotoFile);photoURL=await getDownloadURL(storRef);}
      const newPseudo=editForm.pseudo.trim();
      if(newPseudo!==profile?.username){await releaseUsername(profile?.username||"");await reserveUsername(newPseudo,firebaseUser.uid);}
      const updates={username:newPseudo,teamIdx:editTeamIdx,teamAbbr:NBA_TEAMS[editTeamIdx].abbr,photoURL,email:editForm.email||firebaseUser.email};
      await updateDoc(doc(db,"users",firebaseUser.uid),updates);setProfile(p=>({...p,...updates}));
      setEditOk(t.profileUpdated);setTimeout(()=>setShowEditProfile(false),1500);
    }catch(e){const msgs={"auth/wrong-password":t.errWrongPwd,"auth/email-already-in-use":t.errUsed,"auth/invalid-credential":t.errInvalid};setEditErr(msgs[e.code]||t.errGeneric);}
    setEditLoading(false);
  }

  const TABS=[{id:"match",ico:"🏀",lbl:t.match},{id:"minigames",ico:"🎮",lbl:t.minigames},{id:"leaderboard",ico:"🏆",lbl:t.ranking},{id:"profile",ico:"👤",lbl:t.profile}];

  if(authLoading)return(<><style>{css}</style><div className="loading-screen"><div style={{fontSize:48,animation:"float 2s ease-in-out infinite"}}>🏀</div><div className="spinner"/><span style={{fontWeight:900,fontSize:28,color:"var(--gold)",letterSpacing:3}}>NBgAmes</span></div></>);

  if(screen==="auth")return(
    <><style>{css}</style>
    <div className="auth-wrap"><div className="auth-bg"/>
      <div className="auth-body">
        <div style={{display:"flex",justifyContent:"flex-end",paddingTop:16}}>
          <select value={lang} onChange={e=>setLang(e.target.value)} style={{background:"var(--s1)",border:"1px solid var(--bdr)",borderRadius:8,padding:"6px 10px",color:"var(--txt)",fontSize:13,cursor:"pointer"}}>{LANGS.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}</select>
        </div>
        <div className="auth-hero"><div className="ball">🏀</div><div className="appname">NBgAmes</div><div className="apptag">{t.appTag}</div></div>
        <div className="atabs"><button className={"atab "+(mode==="login"?"on":"")} onClick={()=>{setMode("login");setErr("");}}>{t.login}</button><button className={"atab "+(mode==="signup"?"on":"")} onClick={()=>{setMode("signup");setErr("");}}>{t.signup}</button></div>
        <div className={"aform "+(shake?"shk":"")}>
          {err&&<div className="aerr">⚠️ {err}</div>}
          {appleNotice&&<div className="anotice">{appleNotice}</div>}
          <div className="ig"><span className="iico">✉️</span><input className="ainput" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t.email} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doAuth()}/></div>
          <div className="ig"><span className="iico">🔒</span><input className="ainput" type={showPwd?"text":"password"} autoComplete={mode==="signup"?"new-password":"current-password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t.password} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doAuth()}/><button className="ptoggle" onClick={()=>setShowPwd(p=>!p)}>{showPwd?"🙈":"👁️"}</button></div>
          {mode==="login"&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div className="remrow" onClick={()=>setRemember(r=>!r)}>
                <div className={"cbox "+(remember?"on":"")}>{remember&&<svg width="11" height="11" viewBox="0 0 11 11"><polyline points="1.5,5.5 4.5,8.5 9.5,2.5" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                <span className="rlabel">{t.stayConnected}</span>
              </div>
              {remember&&(
                <div style={{display:"flex",gap:6,paddingLeft:4}}>
                  {[{d:7,l:"7 jours"},{d:30,l:"30 jours"},{d:90,l:"90 jours"},{d:0,l:"Toujours"}].map(o=>(
                    <button key={o.d} onClick={()=>setRememberDays(o.d)} style={{flex:1,padding:"5px 0",fontSize:11,fontWeight:700,borderRadius:8,border:"1.5px solid "+(rememberDays===o.d?"var(--gold)":"var(--bdr)"),background:rememberDays===o.d?"color-mix(in srgb,var(--gold) 15%,var(--s1))":"var(--s1)",color:rememberDays===o.d?"var(--gold)":"var(--muted)",cursor:"pointer"}}>
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="abtn" onClick={doAuth} disabled={loading}>{loading?t.loading:mode==="login"?t.connect:t.createAccount}</button>
          {mode==="login"&&<div className="flink" onClick={()=>{setShowReset(true);setResetEmail(form.email);setResetMsg("");setResetErr("");}}>{t.forgotPwd} <span>{t.reset}</span></div>}
          {/* Sur iOS : Apple natif uniquement (signInWithPopup ne marche pas en WebView),
              sur iPhone uniquement (APPLE_SIGNIN_IOS). Sur Android natif : e-mail seul
              (Google bloque sa connexion dans les WebView). Sur le web : Google. */}
          {(!IS_NATIVE||(IS_IOS&&APPLE_SIGNIN_IOS&&isIPhone))&&<>
          <div className="divrow"><div className="divline"/><span className="divtxt">{t.or}</span><div className="divline"/></div>
          <div style={{display:"flex"}}>
            {IS_NATIVE?(
              <button className="sbtn" style={{flex:1,background:"#000",color:"#fff",borderColor:"#000"}}
                      onClick={doApple} disabled={loading}>
                <AppleIcon size={18} color="#fff"/> Continuer avec Apple
              </button>
            ):(
              <button className="sbtn" style={{flex:1}} onClick={doGoogle} disabled={loading}>
                <GoogleIcon size={18}/> {t.google}
              </button>
            )}
          </div>
          </>}
          {biometricAvailable&&!!localStorage.getItem(BIOMETRIC_KEY)&&(
            <>
              <div className="divrow"><div className="divline"/><span className="divtxt">{t.or}</span><div className="divline"/></div>
              <button style={{width:"100%",padding:"16px",borderRadius:16,border:"1.5px solid color-mix(in srgb,var(--gold) 50%,var(--bdr))",background:"color-mix(in srgb,var(--gold) 12%,var(--s1))",color:"var(--gold)",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}} onClick={async()=>{
                const ok=await verifyBiometric();
                if(ok){
                  const u=auth.currentUser;
                  if(u){
                    const snap=await getDoc(doc(db,"users",u.uid));
                    if(snap.exists()){setFirebaseUser(u);setProfile(snap.data());setProfileLoadVersion(v=>v+1);setScreen("app");}
                  }else{setErr("Session expirée. Reconnectez-vous avec email ou Google.");}
                }else{setErr("Authentification biométrique échouée.");}
              }}>
                <span style={{fontSize:26}}>🔐</span> Face ID / Empreinte digitale
              </button>
            </>
          )}
          <button onClick={enterGuest} style={{width:"100%",marginTop:14,padding:"14px 0",background:"none",border:"1px solid var(--bdr)",borderRadius:14,color:"var(--txt)",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            👀 {t.guestBrowse}
          </button>
        </div>
      </div>
    </div>

    {/* Modal Reset Password */}
    {showReset&&(
      <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowReset(false);}}>
        <div className="modal-sheet">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontWeight:800,fontSize:18,color:"var(--txt)"}}>🔑 {t.forgotPwd}</div>
            <button onClick={()=>setShowReset(false)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
          </div>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:16,lineHeight:1.5}}>Saisis ton adresse email, on t'envoie un lien pour réinitialiser ton mot de passe.</div>
          {resetErr&&<div className="aerr" style={{marginBottom:12}}>⚠️ {resetErr}</div>}
          {resetMsg&&<div className="aok" style={{marginBottom:12}}>{resetMsg}</div>}
          {!resetMsg&&(
            <>
              <div className="ig" style={{marginBottom:14}}><span className="iico">✉️</span><input className="ainput" type="email" placeholder={t.email} value={resetEmail} onChange={e=>setResetEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doReset()}/></div>
              <button className="abtn" onClick={doReset} disabled={resetLoading}>{resetLoading?t.loading:"Envoyer le lien"}</button>
            </>
          )}
          {resetMsg&&<button className="abtn" style={{marginTop:8}} onClick={()=>setShowReset(false)}>Fermer</button>}
        </div>
      </div>
    )}
    </>
  );

  if(screen==="biometric"){
    return <BiometricScreen profile={profile} verifyBiometric={verifyBiometric} onSuccess={async()=>{
      if(firebaseUser){
        const snap=await getDoc(doc(db,"users",firebaseUser.uid));
        if(snap.exists()){setProfile(snap.data());setProfileLoadVersion(v=>v+1);}
      }
      setScreen("app");
    }} onLogout={async()=>{await signOut(auth);disableBiometric();}} css={css}/>;
  }

  if(screen==="onboard"){
    const STEPS=[{icon:"🏀",title:<span>{t.welcome} <span style={{color:"var(--gold)"}}>NBgAmes</span></span>,sub:t.tagline,btn:t.start},{icon:"⏱️",title:<span>{t.betsClose}</span>,sub:t.betsCloseDesc,btn:t.next},{icon:null,title:<span>{t.yourProfile}</span>,sub:t.chooseTeam,btn:t.letsgo}];
    const step=STEPS[obStep];
    return(
      <><style>{css}</style>
      <div className="ob-wrap"><div className="ob-bg"/>
        <div className="ob-body">
          <div className="dots">{STEPS.map((_,i)=><div key={i} className={"dot "+(i===obStep?"on":"")}/>)}</div>
          {obStep<2&&(<div className="ani" style={{display:"flex",flexDirection:"column",flex:1}}><div className="ob-icon">{step.icon}</div><div className="ob-title">{step.title}</div><div className="ob-sub">{step.sub}</div><button className="ob-btn" onClick={()=>setObStep(s=>s+1)}>{step.btn}</button><div className="ob-skip" onClick={()=>setObStep(2)}>{t.skip} <span>→</span></div></div>)}
          {obStep===2&&(
            <div className="ani" style={{display:"flex",flexDirection:"column",flex:1}}>
              <div className="ob-title">{step.title}</div><div className="ob-sub" style={{marginBottom:0}}>{step.sub}</div>
              <div className="tgrid">{NBA_TEAMS.map((team,i)=><div key={team.abbr} className={"topt "+(teamIdx===i?"on":"")} onClick={()=>setTeamIdx(i)}><TeamBadge team={team} size={36} selected={teamIdx===i}/><span className="tlbl">{team.abbr}</span></div>)}</div>
              {err&&<div className="aerr" style={{marginBottom:8}}>⚠️ {err}</div>}
              <input className="uninput" placeholder={t.pseudoPlaceholder} value={pseudo} onChange={e=>handlePseudoChange(e.target.value)} maxLength={20}/>
              {pseudoStatus&&<div className={"pseudo-check "+(pseudoStatus==="ok"?"ok":pseudoStatus==="taken"?"no":"checking")}>{pseudoStatus==="checking"?t.checkingPseudo:pseudoStatus==="ok"?t.pseudoAvailable:t.pseudoTaken}</div>}
              <button className="ob-btn" onClick={finish} disabled={!pseudo.trim()||loading||pseudoStatus==="taken"||pseudoStatus==="checking"} style={{marginTop:12}}>{loading?t.save:step.btn}</button>
            </div>
          )}
        </div>
      </div></>
    );
  }

  return(
    <><style>{css}</style>
    <Confetti c1={themeTeam.c1} c2={themeTeam.c2} active={showConfetti&&franchiseMode}/>
    <Confetti c1="#F5B800" c2="#FF8C00" active={showConfetti&&!franchiseMode}/>
    <div className="shell">
      {franchiseMode&&<div className="franchise-watermark" style={{backgroundImage:`url(${getLogoUrl(themeTeam.abbr)})`}}/>}
      {showAlert&&match&&(
        <div className="alert-toast" onClick={()=>{setShowAlert(false);setAlertDismissed(true);}}>
          <span style={{fontSize:22}}>⚠️</span><div><div>{t.alertClose}</div><div style={{fontSize:12,fontWeight:400,opacity:.85}}>{match.home} vs {match.away} — {t.alertClosing} {lockStr}</div></div>
          <span style={{marginLeft:"auto",opacity:.7,fontSize:18}}>✕</span>
        </div>
      )}
      <div className={"topnav "+(franchiseMode?"franchise":"")}>
        <div className="topnav-left">
          <TeamBadge team={myTeam} size={30}/>
          <div><div className="topnav-pseudo">{isGuest?t.guestName:profile?.username}</div>{!isGuest&&<div className="topnav-streak">🔥 {myStreak}</div>}</div>
        </div>
        <span style={{fontWeight:900,fontSize:24,letterSpacing:2,color:"var(--gold)"}}>NBgAmes</span>
        {isGuest
          ?<button className={"ptsbadge "+(franchiseMode?"franchise":"")} style={{cursor:"pointer",fontSize:12,padding:"6px 12px",whiteSpace:"nowrap"}} onClick={()=>goToAuth("login")}>{t.guestSignIn}</button>
          :<div className={"ptsbadge "+(franchiseMode?"franchise":"")}>⭐ {globalPts.toLocaleString()} {t.pts}</div>}
      </div>

      <div className="scrollarea">

        {/* MATCH */}
        {tab==="match"&&(
          <div className="sec ani">
            {!canReveal&&(
              <div>
                <div style={{background:"var(--s1)",border:"1px solid var(--bdr)",borderRadius:16,padding:"18px",textAlign:"center",marginBottom:14}}>
                  <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t.nextMatch}</div>
                  <div style={{fontSize:44,fontWeight:900,color:"var(--gold)",letterSpacing:3}}>{countdownTo9h||"00m 00s"}</div>
                </div>
                {lastMatch&&(
                  <div>
                    <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1,fontWeight:700,marginBottom:8,textAlign:"center",textTransform:"uppercase"}}>{t.nightResult}</div>
                    <div className={"match-hero "+(franchiseMode?"franchise-hero":"")}>
                      <div className="mhdr">{lastMatch.isFinished?t.sessionEnd:lastMatch.isLive?<span style={{color:"var(--green)"}}>⬤ {t.live}</span>:t.sessionPrev}</div>
                      <div className="mteams">
                        <div className="tblk"><TeamBadge team={getTeam(lastMatch.home)} size={56}/><div className="tabbr">{lastMatch.home}</div><div className="tname">{getTeam(lastMatch.home).name}</div>{lastMatch.isFinished&&lastMatch.homeScore>lastMatch.awayScore&&<div className="wbadge">{t.winner}</div>}</div>
                        <div className="sblk">{lastMatch.isFinished&&(lastMatch.homeScore>0||lastMatch.awayScore>0)?<div className="sdisp" style={{fontSize:30,letterSpacing:2}}>{lastMatch.homeScore}<span style={{color:"var(--muted)",fontSize:20}}> - </span>{lastMatch.awayScore}</div>:lastMatch.isLive?<div style={{textAlign:"center"}}><div key={liveScoreKey} className={"sdisp "+(liveScoreKey>0?"live-update":"")} style={{fontSize:30,letterSpacing:2}}>{lastMatch.homeScore}<span style={{color:"var(--muted)",fontSize:20}}> - </span>{lastMatch.awayScore}</div><div className="live-badge" style={{marginTop:6}}>{t.live}</div></div>:!lastMatch.isFinished?<div style={{textAlign:"center"}}><div className="sdisp" style={{fontSize:24,color:"var(--muted)"}}>{t.vs.toUpperCase()}</div>{lastMatch.tipoff&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4,fontWeight:600}}>{fmtTime(lastMatch.tipoff)}</div>}</div>:<div className="sdisp" style={{fontSize:28,color:"var(--muted)"}}>{t.final}</div>}</div>
                        <div className="tblk"><TeamBadge team={getTeam(lastMatch.away)} size={56}/><div className="tabbr">{lastMatch.away}</div><div className="tname">{getTeam(lastMatch.away).name}</div>{lastMatch.isFinished&&lastMatch.awayScore>lastMatch.homeScore&&<div className="wbadge">{t.winner}</div>}</div>
                      </div>
                      {pronosticDone&&scoring&&scoring.breakdown.map((r,i)=>(
                        <div key={i} className="res-row" style={{background:r.ok?"color-mix(in srgb,var(--green) 8%,transparent)":"color-mix(in srgb,var(--red) 8%,transparent)"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <span style={{fontSize:10,fontWeight:700,color:r.ok?"var(--green)":"var(--red)",letterSpacing:.8,textTransform:"uppercase"}}>{r.label}</span>
                            {r.real&&typeof r.real==="string"&&r.real.includes(" / ")
                              ?<div style={{fontSize:11,color:"var(--muted)",marginTop:2,lineHeight:1.5}}>{r.guess} → <span style={{color:"var(--muted)",fontWeight:600}}>{r.real}</span><span style={{marginLeft:5,fontSize:9,background:"color-mix(in srgb,var(--muted) 20%,transparent)",color:"var(--muted)",borderRadius:4,padding:"1px 5px",fontWeight:700}}>🤝 Égalité</span></div>
                              :<span style={{fontSize:11,color:"var(--muted)",marginLeft:8}}>{r.guess} → {r.real}</span>}
                          </div>
                          <span style={{fontSize:16,fontWeight:800,color:r.ok?"var(--green)":"var(--red)",marginLeft:8,flexShrink:0}}>{r.ok?"+"+r.pts:"0"}</span>
                        </div>
                      ))}
                      {pronosticDone&&scoring?.allPerfect&&<div className="bonus-banner"><div style={{fontSize:14,fontWeight:800,color:"var(--gold)"}}>{t.bonusAllCorrect}</div></div>}
                      {pronosticDone&&scoring&&<div className="res-row" style={{borderTop:"1px solid var(--bdr)"}}><span style={{fontWeight:700,fontSize:14}}>{t.totalWon}</span><span style={{fontSize:20,fontWeight:800,color:scoring.total>0?"var(--green)":"var(--muted)"}}>+{scoring.total} {t.pts}</span></div>}
                      {pronosticDone&&!scoring&&pronostics&&(
                        <div>
                          <div style={{textAlign:"center",fontSize:11,color:"var(--muted)",fontWeight:700,letterSpacing:1,padding:"10px 0 4px",textTransform:"uppercase"}}>🔒 {t.betsRegistered}</div>
                          {[
                            {label:t.myBets,value:pronostics.w},
                            {label:t.myScore,value:`${pronostics.homeScore} - ${pronostics.awayScore}`},
                            {label:t.myScorer,value:pronostics.scorer},
                            {label:t.myScorerPts,value:pronostics.scorerPts+" "+t.pts},
                          ].map((row,i)=>(
                            <div key={i} className="res-row" style={{background:"color-mix(in srgb,var(--muted) 5%,transparent)"}}>
                              <span style={{fontSize:10,fontWeight:700,color:"var(--muted)",letterSpacing:.8,textTransform:"uppercase"}}>{row.label}</span>
                              <span style={{fontSize:13,fontWeight:700,color:"var(--txt)"}}>{row.value}</span>
                            </div>
                          ))}
                          <div style={{textAlign:"center",fontSize:11,color:"var(--muted)",padding:"8px 0 4px",fontStyle:"italic"}}>{t.waitingResult}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {canReveal&&(
              <div>
                {!matchLoading&&allGames.length>0&&(
                  <div>
                    <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1,fontWeight:700,marginBottom:8,textAlign:"center",textTransform:"uppercase"}}>{t.program}</div>
                    <div className="matches-strip">
                      {allGames.map(m=>(
                        <div key={m.id} className={"match-chip"+(m.id===match?.id?" featured":"")+(m.isLive?" live-chip":"")+(m.isPostseason?" playoff":"")}>
                          {m.id===match?.id&&<div className="chip-tag">{t.selected.toUpperCase()}</div>}
                          {m.isLive&&m.id!==match?.id&&<div className="chip-live">{t.live}</div>}
                          {m.isPostseason&&!m.isLive&&m.id!==match?.id&&<div className="chip-playoff">{t.playoffs}</div>}
                          <div className="chip-teams">{m.home} - {m.away}</div>
                          <div className="chip-time">{m.isLive?t.inProgress:m.isFinished?t.final:fmtTime(m.tipoff)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {matchLoading&&<div className="no-games"><div className="spinner" style={{margin:"0 auto 12px"}}/></div>}
                {!matchLoading&&!match&&<div className="no-games"><div style={{fontSize:36,marginBottom:10}}>😴</div><div style={{fontSize:20,fontWeight:800,color:"var(--gold)"}}>{t.noMatch}</div></div>}

                {!matchLoading&&match&&(
                  <div>
                    <div style={{fontSize:11,color:"var(--gold)",letterSpacing:1.5,fontWeight:700,marginBottom:8,textTransform:"uppercase",textAlign:"center"}}>{t.selected}{match.isPostseason?" · "+t.playoffs:""}</div>
                    {!editMode&&!isFinished&&match.tipoff&&!currentScoring&&(
                      <div className={"countdown-banner "+(isLocked?"locked":isWarning?"warning":"open")}>
                        <div className="cb-ico">{isLocked?"🔒":isWarning?"⚠️":"⏱️"}</div>
                        <div style={{flex:1,textAlign:"center"}}>
                          <div className={"cb-label "+(isLocked?"locked":isWarning?"warning":"open")}>{isLocked?t.betsClosed:isWarning?t.betsWarning:t.betsOpen}</div>
                          {!isLocked&&countdownStr&&<div className={"cb-time "+(isWarning?"warning":"open")}>{countdownStr}</div>}
                          <div className="cb-sub">{isLocked?t.closedAt+" "+tipoffStr:t.closingAt+" "+lockStr}</div>
                        </div>
                      </div>
                    )}
                    <div className={"match-hero "+(franchiseMode?"franchise-hero":"")}>
                      <div className="mhdr">{t.drawnAt}{match.tipoff?" · "+t.tipoff+" "+tipoffStr:""}</div>
                      <div className="mteams">
                        <div className="tblk"><TeamBadge team={homeTeam} size={56}/><div className="tabbr">{match.home}</div><div className="tname">{match.homeName||homeTeam.name}</div>{winner===match.home&&<div className="wbadge">{t.winner}</div>}</div>
                        <div className="sblk">
                          {(isFinished||isLive)&&(match.homeScore>0||match.awayScore>0)
                            ?<div key={liveScoreKey} className={"sdisp "+(liveScoreKey>0?"live-update":"")}>{match.homeScore}<span style={{color:"var(--muted)",fontSize:26}}> - </span>{match.awayScore}</div>
                            :<div style={{textAlign:"center"}}><div className="sdisp" style={{fontSize:24,color:"var(--muted)"}}>{t.vs.toUpperCase()}</div>{match.tipoff&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{tipoffStr}</div>}</div>}
                          {isLive&&<div className="live-badge">{t.live}</div>}
                        </div>
                        <div className="tblk"><TeamBadge team={awayTeam} size={56}/><div className="tabbr">{match.away}</div><div className="tname">{match.awayName||awayTeam.name}</div>{winner===match.away&&<div className="wbadge">{t.winner}</div>}</div>
                      </div>
                      {isFinished&&!isLive&&<div style={{textAlign:"center",fontSize:12,color:"var(--green)",fontWeight:600,paddingBottom:currentScoring?0:12}}>{t.final}</div>}
                      {currentScoring&&currentScoring.breakdown.map((r,i)=>(
                        <div key={i} className="res-row" style={{background:r.ok?"color-mix(in srgb,var(--green) 8%,transparent)":"color-mix(in srgb,var(--red) 8%,transparent)"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <span style={{fontSize:10,fontWeight:700,color:r.ok?"var(--green)":"var(--red)",letterSpacing:.8,textTransform:"uppercase"}}>{r.label}</span>
                            {r.real&&typeof r.real==="string"&&r.real.includes(" / ")
                              ?<div style={{fontSize:11,color:"var(--muted)",marginTop:2,lineHeight:1.5}}>{r.guess} → <span style={{color:"var(--muted)",fontWeight:600}}>{r.real}</span><span style={{marginLeft:5,fontSize:9,background:"color-mix(in srgb,var(--muted) 20%,transparent)",color:"var(--muted)",borderRadius:4,padding:"1px 5px",fontWeight:700}}>🤝 Égalité</span></div>
                              :<span style={{fontSize:11,color:"var(--muted)",marginLeft:8}}>{r.guess} → {r.real}</span>}
                          </div>
                          <span style={{fontSize:16,fontWeight:800,color:r.ok?"var(--green)":"var(--red)",marginLeft:8,flexShrink:0}}>{r.ok?"+"+r.pts:"0"}</span>
                        </div>
                      ))}
                      {currentScoring?.allPerfect&&<div className="bonus-banner"><div style={{fontSize:14,fontWeight:800,color:"var(--gold)"}}>{t.bonusAllCorrect}</div></div>}
                      {currentScoring&&<div className="res-row" style={{borderTop:"1px solid var(--bdr)"}}><span style={{fontWeight:700,fontSize:14}}>{t.totalWon}</span><span style={{fontSize:20,fontWeight:800,color:currentScoring.total>0?"var(--green)":"var(--muted)"}}>+{currentScoring.total} {t.pts}</span></div>}
                    </div>

                    {isLocked&&!pronosticDone&&!editMode&&!isFinished&&(
                      <div className="locked-overlay"><div style={{fontSize:36,marginBottom:8}}>🔒</div><div style={{fontSize:20,fontWeight:800,color:"var(--red)",marginBottom:6}}>{t.lockedFull}</div><div style={{fontSize:14,color:"var(--muted)",lineHeight:1.5}}>{t.tipoff} <strong style={{color:"var(--txt)"}}>{tipoffStr}</strong>.<br/>{t.betsClosedHint}</div></div>
                    )}

                    {isGuest&&!isLocked&&!isFinished&&<GuestCta text={t.guestCtaBet}/>}
                    {!isGuest&&(!isLocked||editMode)&&!pronosticDone&&match.tipoff&&(
                      <div>
                        {!editMode&&<div className="pbar"><div className={"pfill "+(franchiseMode?"franchise-fill":"")} style={{width:((pronosticStep/3)*100)+"%"}}/></div>}
                        {editMode&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><button onClick={()=>{setEditMode(false);setPronosticDone(true);}} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:13}}>{t.cancelEdit}</button><span style={{fontSize:12,color:"var(--gold)",fontWeight:700}}>{t.editMode}</span></div>}

                        {(()=>{
                          const statDef=getStatForDate(getSessionDate());
                          return(<>
                            {showQ0&&(
                              <div className="qcard ani">
                                <TrendSection matchId={match.id} match={match} step={0} t={t}/>
                                <div className="qlbl">{editMode?t.modify:'Question 1/3'}</div>
                                <div className="ppill">+10 {t.pts}</div>
                                <div className="qq">Quelle équipe va remporter ce match ?</div>
                                <div className="qopts">{[match.home,match.away].map(tm=><button key={tm} className="qopt" onClick={()=>submitWinner(tm)}><TeamBadge team={getTeam(tm)} size={24}/><span style={{marginLeft:6}}>{getTeam(tm).name}</span></button>)}</div>
                              </div>
                            )}
                            {showQ1&&(
                              <div className="qcard ani">
                                <div style={{textAlign:'center',fontSize:28,marginBottom:8}}>{statDef.emoji}</div>
                                <div className="qlbl">{editMode?t.modify:'Question 2/3'}</div>
                                <div className="ppill">+20 {t.pts}</div>
                                <div className="qq">{statDef.label} du match ?</div>
                                {rosterLoading?<div style={{color:"var(--muted)",textAlign:"center",padding:16,fontSize:14}}>{t.loadingPlayers}</div>:(!rosterHome.length&&!rosterAway.length)?(
                                  <div style={{textAlign:"center",padding:16}}>
                                    <div style={{fontSize:14,color:"var(--muted)",marginBottom:12}}>Impossible de charger les joueurs pour le moment.</div>
                                    <button className="abtn" onClick={()=>setRosterTry(n=>n+1)}>🔄 Réessayer</button>
                                  </div>
                                ):(
                                  <div>
                                    <div className="roster-block"><div className="roster-label"><TeamBadge team={homeTeam} size={20}/><span style={{fontSize:12,fontWeight:700,color:"var(--muted)",letterSpacing:1}}>{match.home}</span></div><select className="roster-select" defaultValue="" onChange={e=>{if(e.target.value)submitStatPlayer(e.target.value);}}><option value="" disabled>{t.choosePlayer}</option>{rosterHome.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
                                    <div className="roster-block"><div className="roster-label"><TeamBadge team={awayTeam} size={20}/><span style={{fontSize:12,fontWeight:700,color:"var(--muted)",letterSpacing:1}}>{match.away}</span></div><select className="roster-select" defaultValue="" onChange={e=>{if(e.target.value)submitStatPlayer(e.target.value);}}><option value="" disabled>{t.choosePlayer}</option>{rosterAway.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
                                  </div>
                                )}
                              </div>
                            )}
                            {showQ2&&(
                              <div className="qcard ani">
                                <div style={{textAlign:'center',fontSize:28,marginBottom:8}}>{statDef.emoji}</div>
                                <div className="qlbl">{editMode?t.modify:'Question 3/3'}</div>
                                <div className="ppill">+30 {t.pts} · ×2 si tout juste</div>
                                <div className="qq">Combien de {statDef.unit} va faire {pronostics?.statPlayer||'ce joueur'} ?</div>
                                <div className="sinrow"><div style={{textAlign:"center"}}><div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{statDef.unit}</div><input className="sin-pts" type="number" placeholder="0" min="0" max="99" value={sg.statVal} onChange={e=>setSg(s=>({...s,statVal:e.target.value}))}/></div></div>
                                <button className={"sbmit "+(franchiseMode?"franchise-btn":"")} onClick={submitStatVal} disabled={!sg.statVal}>{t.validate}</button>
                              </div>
                            )}
                          </>);
                        })()}
                      </div>
                    )}

                    {pronosticDone&&!currentScoring&&(()=>{
                      const statDef=getStatForDate(getSessionDate());
                      const rows=[
                        {l:'Vainqueur',v:pronostics?.w,step:0},
                        {l:statDef.label,v:pronostics?.statPlayer,step:1},
                        {l:`Nb de ${statDef.unit}`,v:pronostics?.statVal,step:2},
                      ];
                      return(
                      <div className="qcard ani">
                        <div style={{fontSize:36,marginBottom:8,textAlign:"center"}}>⏳</div>
                        <div style={{fontSize:22,fontWeight:800,color:"var(--gold)",marginBottom:4,textAlign:"center"}}>{t.betsRegistered}</div>
                        <div style={{fontSize:12,color:isLocked?"var(--red)":"var(--muted)",marginBottom:14,textAlign:"center"}}>{isLocked?t.lockedHint:t.modifyHint}</div>
                        <div style={{background:"var(--s2)",borderRadius:12,overflow:"hidden"}}>
                          {rows.map((r,i)=>(
                            <div key={i} className="edit-row" style={isLocked?{cursor:"default"}:{}} onClick={!isLocked?()=>{setEditMode(true);setPronosticDone(false);setPronosticStep(r.step);}:undefined}>
                              <span style={{color:"var(--muted)",fontSize:13}}>{r.l}</span>
                              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:600,fontSize:13}}>{r.v||"—"}</span><span style={{fontSize:12}}>{isLocked?"🔒":"✏️"}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          {/* Bouton historique */}
          {!isGuest&&<button onClick={()=>{setShowHistory(true);setOpenHistoryId(null);setCommunityData({});}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",marginTop:16,padding:"13px 0",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:14,color:"var(--txt)",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:.5}}>
            📋 {t.history} <span style={{fontSize:12,color:"var(--muted)",fontWeight:500}}>({history.length} {history.length<=1?t.matchesPlayed:t.matchesPlayedP})</span>
          </button>}
          </div>
        )}

        {/* MINI-JEUX */}
        {tab==="minigames"&&(
          <div className="sec ani">
            {miniGamePage==="culture"?(
              <div>
                <button onClick={()=>setMiniGamePage(null)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 16px',letterSpacing:.3}}>
                  ← Mini-jeux
                </button>
                <MiniGameCulture firebaseUser={firebaseUser} profile={profile} setProfile={setProfile} guestCta={isGuest?<GuestCta text={t.guestCtaQuiz}/>:null}/>
              </div>
            ):miniGamePage==="parcours"?(
              <div>
                <button onClick={()=>setMiniGamePage(null)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 16px',letterSpacing:.3}}>
                  ← Mini-jeux
                </button>
                <MiniGameParcours firebaseUser={firebaseUser} profile={profile} setProfile={setProfile} guestCta={isGuest?<GuestCta text={t.guestCtaQuiz}/>:null}/>
              </div>
            ):miniGamePage==="trades"?(
              <div>
                <button onClick={()=>setMiniGamePage(null)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 16px',letterSpacing:.3}}>
                  ← Mini-jeux
                </button>
                <MiniGameTrades firebaseUser={firebaseUser} profile={profile} setProfile={setProfile} guestCta={isGuest?<GuestCta text={t.guestCtaTrades}/>:null}/>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:12,color:'var(--muted)',fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',marginBottom:4}}>Mini-jeux</div>
                {(()=>{
                  const tg=profile?.tradesGame2025||{};
                  const tradesPlayed=Object.keys(tg.locked||{}).length>0;
                  const tradesScored=tradesPlayed&&tg.score!==undefined;
                  return[
                  {id:'culture',ico:'🧠',title:'Culture NBA',desc:'Quiz NBA · 10 questions par jour · les bonnes réponses en série valent de plus en plus',pts:'55 pts max',color:'var(--blue)'},
                  {id:'parcours',ico:'🧭',title:'Parcours',desc:'Retrouve 3 joueurs grâce à leurs franchises · Cash, Carré ou Duo · 1 fois par jour',pts:'15 pts max',color:'var(--green)'},
                  {id:'trades',ico:'🔄',title:"Trades de l'été",
                    desc:tg.closed
                      ?`Jeu terminé · ${tg.correct||0}/50 pronostics corrects`
                      :"Pronostique les trades de l'été 2025 · 50 joueurs · Résultats en septembre",
                    pts:tradesScored?`${tg.score} pts`:(tg.closed?'Terminé':'Classement'),
                    color:'var(--orange)'},
                ];})().map(g=>{
                  const isTradesLocked=g.id==='trades'&&!Object.keys(profile?.tradesGame2025?.locked||{}).length&&(process.env.NODE_ENV==='development'||(new Date()>=new Date('2025-05-15')&&new Date()<new Date('2025-06-15')));
                  return(
                  <button key={g.id} onClick={()=>setMiniGamePage(g.id)} style={{display:'flex',alignItems:'center',gap:14,padding:'16px',background:'var(--s1)',border:'1.5px solid var(--bdr)',borderRadius:16,cursor:'pointer',textAlign:'left',width:'100%',transition:'border-color .2s',position:'relative'}}>
                    {isTradesLocked&&<div style={{position:'absolute',top:-6,right:-6,width:12,height:12,background:'var(--red)',borderRadius:'50%',border:'2px solid var(--bg)'}}/>}
                    <div style={{fontSize:32,lineHeight:1,flexShrink:0}}>{g.ico}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:800,color:'var(--txt)',marginBottom:3}}>{g.title}</div>
                      <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.5}}>{g.desc}</div>
                    </div>
                    <div style={{flexShrink:0,textAlign:'right'}}>
                      <div style={{fontSize:12,fontWeight:800,color:g.color}}>{g.pts}</div>
                      <div style={{fontSize:18,color:'var(--muted)',marginTop:2}}>›</div>
                    </div>
                  </button>
                );})}
              </div>
            )}
          </div>
        )}

        {/* CLASSEMENT */}
        {tab==="leaderboard"&&(
          <div className="sec ani">
            <div style={{fontSize:22,fontWeight:800,letterSpacing:1,color:"var(--gold)",marginBottom:14,textAlign:"center"}}>{t.globalRanking}</div>
            <div className="ranking-tabs">
              {[{id:"global",lbl:t.rankingGlobal},{id:"lastmatch",lbl:t.rankingLastMatch},{id:"week",lbl:t.rankingWeek},{id:"month",lbl:t.rankingMonth},{id:"archives",lbl:"📚 Archives"}].map(rp=>(
                <button key={rp.id} className={"ranking-tab "+(rankingPeriod===rp.id?"on":"")} onClick={()=>{setRankingPeriod(rp.id);setOpenArchive(null);}}>{rp.lbl}</button>
              ))}
            </div>
            <div className="card">
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:12,fontWeight:600}}>
                {rankingPeriod==="archives"?(openArchive?`Classement final · ${openArchive.name}`:"Saisons terminées"):t.realtime}
              </div>

              {/* ── Archives des saisons ── */}
              {rankingPeriod==="archives"&&!openArchive&&(
                seasonArchives.length===0
                  ?<div style={{textAlign:"center",color:"var(--muted)",padding:"20px 0",fontSize:14}}>Aucune saison archivée pour le moment.</div>
                  :seasonArchives.map(a=>(
                    <div key={a.id} className="lbrow" onClick={()=>setOpenArchive(a)} style={{cursor:"pointer"}}>
                      <div style={{fontSize:22,width:34,textAlign:"center"}}>🏆</div>
                      <div style={{flex:1,marginLeft:8}}>
                        <div className="lbname">{a.name}</div>
                        <div className="lbstreak">🥇 {a.ranking?.[0]?.username||"—"} · {a.playerCount||0} joueurs</div>
                      </div>
                      <div style={{fontSize:16,color:"var(--muted)"}}>›</div>
                    </div>
                  ))
              )}
              {rankingPeriod==="archives"&&openArchive&&(
                <div>
                  <button onClick={()=>setOpenArchive(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"var(--muted)",fontSize:13,fontWeight:600,cursor:"pointer",padding:"0 0 12px"}}>
                    ← Toutes les saisons
                  </button>
                  {(openArchive.ranking||[]).map((p,i)=>{
                    const isMe=firebaseUser&&p.uid===firebaseUser.uid;
                    return(
                      <div key={p.uid||i} className="lbrow" style={isMe?{background:"color-mix(in srgb,var(--gold) 5%,transparent)",margin:"0 -16px",padding:"11px 16px"}:{}}>
                        <div className="lbrank" style={{color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"var(--muted)"}}>{i<3?["🥇","🥈","🥉"][i]:p.rank}</div>
                        <TeamBadge team={NBA_TEAMS[p.teamIdx||1]} size={32}/>
                        <div style={{flex:1,marginLeft:8}}><div className={"lbname"+(isMe?" me":"")}>{p.username}</div><div className="lbstreak">🔥 {p.streak||0}</div></div>
                        <div className="lbpts">{(p.points||0).toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {rankingPeriod==="global"&&(
                leaderboard.length===0
                  ?<div style={{textAlign:"center",color:"var(--muted)",padding:"20px 0",fontSize:14}}>{t.firstToPlay}</div>
                  :leaderboard.map((p,i)=>(
                    <div key={p.id} className="lbrow" style={p.isMe?{background:"color-mix(in srgb,var(--gold) 5%,transparent)",margin:"0 -16px",padding:"11px 16px"}:{}}>
                      <div className="lbrank" style={{color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"var(--muted)"}}>{i<3?["🥇","🥈","🥉"][i]:p.rank}</div>
                      <TeamBadge team={NBA_TEAMS[p.teamIdx||1]} size={32}/>
                      <div style={{flex:1,marginLeft:8}}><div className={"lbname"+(p.isMe?" me":"")}>{p.username}</div><div className="lbstreak">🔥 {p.streak||0}</div></div>
                      <div className="lbpts">{(p.points||0).toLocaleString()}</div>
                    </div>
                  ))
              )}
              {rankingPeriod!=="global"&&rankingPeriod!=="archives"&&(
                periodLeaderboard.length===0
                  ?<div style={{textAlign:"center",color:"var(--muted)",padding:"20px 0",fontSize:14}}>{t.noRankingData}</div>
                  :periodLeaderboard.map((p,i)=>{
                    const isClickable=rankingPeriod==="lastmatch";
                    // Le pari du match affiché (lastMatchId peut être en retard pour un joueur)
                    const betKey=p.betKey||(p.lastMatchId?"pronostic_"+p.lastMatchId:null);
                    const hasBet=betKey&&p[betKey]?.done;
                    return(
                    <div key={p.id} className="lbrow" onClick={isClickable&&hasBet?()=>setSelectedUserBet({user:p,bet:p[betKey]}):undefined} style={{...(p.isMe?{background:"color-mix(in srgb,var(--gold) 5%,transparent)",margin:"0 -16px",padding:"11px 16px"}:{}),cursor:isClickable&&hasBet?"pointer":"default"}}>
                      <div className="lbrank" style={{color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"var(--muted)"}}>{i<3?["🥇","🥈","🥉"][i]:p.rank}</div>
                      <TeamBadge team={NBA_TEAMS[p.teamIdx||1]} size={32}/>
                      <div style={{flex:1,marginLeft:8}}><div className={"lbname"+(p.isMe?" me":"")}>{p.username}</div><div className="lbstreak">🔥 {p.streak||0}</div></div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div className="lbpts">{p.displayPts.toLocaleString()}</div>
                        {isClickable&&hasBet&&<div style={{fontSize:16,color:"var(--muted)"}}>›</div>}
                      </div>
                    </div>
                  )})
              )}
            </div>
          </div>
        )}

        {/* HISTORIQUE MODAL */}
        {showHistory&&(
          <div className="modal-overlay" onClick={()=>setShowHistory(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            {/* En-tête collant : la croix reste accessible même après avoir
                défilé loin dans la liste. */}
            <div className="sheet-head">
              <div style={{fontSize:18,fontWeight:800,letterSpacing:1,color:"var(--gold)"}}>{t.history.toUpperCase()}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:12,color:"var(--muted)"}}>{history.length} {history.length<=1?t.matchesPlayed:t.matchesPlayedP}</span>
                <button className="sheet-close" aria-label="Fermer" onClick={()=>setShowHistory(false)}>✕</button>
              </div>
            </div>
            {history.length===0&&<div className="no-games"><div style={{fontSize:36,marginBottom:10}}>📋</div><div style={{fontSize:18,fontWeight:800,color:"var(--gold)",marginBottom:6}}>{t.noHistory}</div><div style={{fontSize:13,color:"var(--muted)"}}>{t.noHistoryDesc}</div></div>}
            {history.map((entry,i)=>{
              const hasResult=!!entry.scoring,total=entry.scoring?.total||0;
              const lm=lastMatch?.id===entry.matchId?lastMatch:null;
              const home=entry.home||lm?.home||"?",away=entry.away||lm?.away||"?";
              const matchDate=entry.tipoff?fmtDate(entry.tipoff):"";
              // Ancien format : breakdown[1].real = "112-108". Nouveau format :
              // c'est le nom du leader de la stat, il ne faut donc pas le lire
              // comme un score (sinon "Shai Gilgeous-Alexander" s'affiche en score).
              const isNewFmt=entry.statKey!==undefined;
              const realScore=isNewFmt?"":(entry.scoring?.breakdown?.[1]?.real||"");
              const[hScore,aScore]=realScore.split("-").map(s=>s?.trim());
              const isOpen=openHistoryId===entry.matchId;
              const cd=isOpen?communityData:{};
              const cdTotal=Object.values(cd.winner||{}).reduce((a,b)=>a+b,0);
              return(
                <div key={entry.matchId} className={"hist-card "+(isOpen?"open":"")} onClick={()=>{setOpenHistoryId(isOpen?null:entry.matchId);if(!isOpen)setCommunityData({});}}>
                  <div className="hist-header">
                    <div style={{minWidth:36,flexShrink:0}}><div style={{fontSize:11,fontWeight:800,color:"var(--gold)"}}>#{history.length-i}</div>{matchDate&&<div style={{fontSize:9,color:"var(--muted)",marginTop:2}}>{matchDate}</div>}</div>
                    <div style={{flex:1,textAlign:"center"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                        <TeamBadge team={getTeam(home)} size={26}/>
                        <div style={{fontSize:16,fontWeight:800,letterSpacing:1}}>{home} <span style={{color:"var(--muted)",fontSize:12,fontWeight:400}}>{t.vs}</span> {away}</div>
                        <TeamBadge team={getTeam(away)} size={26}/>
                      </div>
                      {hasResult&&hScore&&aScore&&<div style={{fontSize:20,fontWeight:800,color:"var(--txt)",marginTop:4}}>{hScore} - {aScore}</div>}
                    </div>
                    <div style={{minWidth:48,textAlign:"right",flexShrink:0}}>
                      {hasResult?<div style={{fontSize:16,fontWeight:800,color:total>0?"var(--green)":"var(--muted)"}}>{total>0?"+":""}{total}{t.pts}</div>:<div style={{fontSize:11,color:"var(--muted)"}}>⏳</div>}
                      {entry.scoring?.allPerfect&&<div style={{fontSize:10,color:"var(--gold)"}}>× 2 🏆</div>}
                      <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{isOpen?"▲":"▼"}</div>
                    </div>
                  </div>
                  {hasResult&&(
                    <div className="hist-body">
                      {entry.scoring.breakdown.map((r,j)=>{
                        const isTie=r.real&&typeof r.real==="string"&&r.real.includes(" / ");
                        return(
                        <div key={j} className="hist-row">
                          <span className="hist-label">{r.label}{isTie&&<span style={{marginLeft:4,fontSize:9,background:"color-mix(in srgb,var(--muted) 20%,transparent)",color:"var(--muted)",borderRadius:4,padding:"1px 4px",fontWeight:700}}>🤝</span>}</span>
                          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end",maxWidth:"62%"}}>
                            <span style={{fontWeight:600,color:r.ok?"var(--green)":"var(--red)",fontSize:12}}>{r.guess}</span>
                            <span style={{color:"var(--muted)",fontSize:10}}>→</span>
                            {isTie
                              ?<span style={{color:"var(--muted)",fontSize:11,fontWeight:600,textAlign:"right"}}>{r.real}</span>
                              :<span style={{color:"var(--muted)",fontSize:11}}>{r.real}</span>}
                            <span style={{fontSize:13,fontWeight:800,color:r.ok?"var(--green)":"var(--red)",minWidth:28,textAlign:"right"}}>{r.ok?"+"+r.pts:"0"}</span>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                  {!hasResult&&<div className="hist-pending">{t.waitingResult}</div>}

                  {/* Community data */}
                  {isOpen&&(
                    <div className="community-section" onClick={e=>e.stopPropagation()}>
                      <div style={{fontSize:11,color:"var(--gold)",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>👥 {t.communityBets}</div>
                      {cdTotal===0?<div style={{fontSize:12,color:"var(--muted)",textAlign:"center",padding:"8px 0"}}>{t.noCommunityData}</div>:(
                        <div>
                          {/* Vainqueur */}
                          {Object.keys(cd.winner||{}).length>0&&(
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:6}}>{t.myBets}</div>
                              {Object.entries(cd.winner).sort((a,b)=>b[1]-a[1]).map(([team,cnt])=>{
                                const pct=Math.round((cnt/cdTotal)*100);
                                return <TrendBar key={team} label={`${team} — ${cnt} joueur${cnt>1?"s":""}`} pct={pct} color="var(--blue)"/>;
                              })}
                            </div>
                          )}
                          {/* Scoreur */}
                          {Object.keys(cd.scorer||{}).length>0&&(
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:6}}>{t.myScorer}</div>
                              {Object.entries(cd.scorer).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,cnt])=>{
                                const stotal=Object.values(cd.scorer).reduce((a,b)=>a+b,0);
                                const pct=Math.round((cnt/stotal)*100);
                                return <TrendBar key={name} label={`${name} — ${cnt}`} pct={pct} color="var(--green)"/>;
                              })}
                            </div>
                          )}
                          {/* Scores */}
                          {(Object.keys(cd.homeScore||{}).length>0||Object.keys(cd.awayScore||{}).length>0)&&(
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:6}}>{t.myScore}</div>
                              {[{label:home,data:cd.homeScore},{label:away,data:cd.awayScore}].map(({label,data})=>{
                                if(!data||!Object.keys(data).length)return null;
                                const stotal=Object.values(data).reduce((a,b)=>a+b,0);
                                const top=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,3);
                                return <div key={label} style={{marginBottom:8}}><div style={{fontSize:10,color:"var(--muted)",marginBottom:3}}>{label}</div>{top.map(([score,cnt])=>{const pct=Math.round((cnt/stotal)*100);return<TrendBar key={score} label={`${score} pts — ${cnt}`} pct={pct} color="var(--orange)"/>;})}</div>;
                              })}
                            </div>
                          )}
                          {/* Points du scoreur */}
                          {Object.keys(cd.scorerPts||{}).length>0&&(
                            <div>
                              <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:6}}>{t.myScorerPts}</div>
                              {(()=>{const stotal=Object.values(cd.scorerPts).reduce((a,b)=>a+b,0);return Object.entries(cd.scorerPts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([pts,cnt])=>{const pct=Math.round((cnt/stotal)*100);return<TrendBar key={pts} label={`${pts} pts — ${cnt}`} pct={pct} color="var(--gold)"/>;});})()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        )}

        {/* PROFIL */}
        {tab==="profile"&&isGuest&&(
          <div className="sec ani">
            <GuestCta text={t.guestCtaProfile}/>
            <button onClick={()=>setShowRules(true)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",marginTop:14,padding:"14px 16px",background:"var(--s1)",border:"1px solid var(--bdr)",borderRadius:14,color:"var(--txt)",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:20}}>📖</span> Règles & Principe
            </button>
          </div>
        )}
        {tab==="profile"&&!isGuest&&(
          <div className="sec ani">
            <div style={{fontSize:22,fontWeight:800,letterSpacing:1,color:"var(--gold)",marginBottom:14,textAlign:"center"}}>{t.myProfile}</div>
            <div className={"pcard "+(franchiseMode?"franchise-card":"")}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
                {profile?.photoURL?<img src={profile.photoURL} alt="avatar" width={80} height={80} style={{borderRadius:"50%",objectFit:"cover",border:"2.5px solid var(--gold)"}}/>:<TeamBadge team={myTeam} size={76}/>}
              </div>
              <div className="pname">{profile?.username}</div>
              <div className="pemail">{firebaseUser?.email}</div>
              <div className="pstats">
                <div className="pstat"><div className="psval">{globalPts.toLocaleString()}</div><div className="pslbl">{t.points}</div></div>
                <div className="pstat"><div className="psval">{profile?.streak||0}</div><div className="pslbl">{t.streak} 🔥</div></div>
                <div className="pstat"><div className="psval">{leaderboard.findIndex(p=>p.isMe)+1||"—"}</div><div className="pslbl">{t.rank}</div></div>
              </div>
            </div>
            <button className="editprofile-btn" onClick={openEditProfile}>✏️ {t.editProfile}</button>
            <button className="editprofile-btn" style={{marginTop:8}} onClick={async()=>{
              hapticTap();
              const rang=leaderboard.findIndex(p=>p.isMe)+1;
              const r=await shareText({
                title:"NBgAmes",
                text:rang>0
                  ?`Je suis ${rang}${rang===1?"er":"e"} au classement NBgAmes avec ${globalPts.toLocaleString()} points 🏀`
                  :`Je joue à NBgAmes, le jeu de pronostics NBA 🏀`,
                url:"https://nbgames-ea27a.web.app",
              });
              if(r==="copied")setResetMsg("Lien copié !");
            }}>📤 Partager mon classement</button>
            <div className="card" style={{marginTop:12}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12,textAlign:"center"}}>⚙️ {t.settings}</div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--muted)",marginBottom:8}}>🌍 {t.lang}</div>
                <select className="roster-select" value={lang} onChange={e=>{setLang(e.target.value);savePref("lang",e.target.value);}}>{LANGS.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}</select>
              </div>
              <div className="theme-section">
                <div className="theme-row">
                  <div style={{display:"flex",gap:9,alignItems:"center"}}><span style={{fontSize:18}}>{darkMode?"🌑":"☀️"}</span><span style={{fontWeight:500,fontSize:14}}>{darkMode?t.darkMode:t.lightMode}</span></div>
                  <div className="toggle" style={{background:darkMode?"var(--green)":"var(--bdr)"}} onClick={()=>{const v=!darkMode;setDarkMode(v);savePref("darkMode",v);}}><div className="toggle-knob" style={{left:darkMode?21:3}}/></div>
                </div>
              </div>
              <div className="theme-section">
                <div className="theme-row">
                  <div style={{display:"flex",gap:9,alignItems:"center"}}><TeamBadge team={themeTeam} size={24}/><div><div style={{fontWeight:500,fontSize:14}}>{t.franchiseTheme}</div>{franchiseMode&&<div style={{fontSize:11,color:"var(--gold)"}}>{themeTeam.name}</div>}</div></div>
                  <div className="toggle" style={{background:franchiseMode?"var(--gold)":"var(--bdr)"}} onClick={()=>{const v=!franchiseMode;setFranchiseMode(v);savePref("franchiseMode",v);}}><div className="toggle-knob" style={{left:franchiseMode?21:3}}/></div>
                </div>
                {franchiseMode&&(
                  <div className="franchise-grid">{NBA_TEAMS.map((team,i)=><div key={team.abbr} className={"franchise-opt "+(themeTeamIdx===i?"on":"")} onClick={()=>{setThemeTeamIdx(i);savePref("themeTeamIdx",i);}}><TeamBadge team={team} size={28} selected={themeTeamIdx===i}/><span style={{fontSize:7,color:themeTeamIdx===i?"var(--gold)":"var(--muted)",fontWeight:700}}>{team.abbr}</span></div>)}</div>
                )}
              </div>
              <div className="theme-section">
                <div className="theme-row">
                  <div style={{display:"flex",gap:9,alignItems:"center"}}><span style={{fontSize:18}}>🔔</span><div><div style={{fontWeight:500,fontSize:14}}>{t.notifications}</div><div style={{fontSize:11,color:"var(--muted)"}}>{t.notifDesc}</div></div></div>
                  <div className="toggle" style={{background:notifEnabled?"var(--green)":"var(--bdr)"}} onClick={toggleNotif}><div className="toggle-knob" style={{left:notifEnabled?21:3}}/></div>
                </div>
              </div>
              {biometricAvailable&&(
                <div className="theme-section">
                  <div className="theme-row">
                    <div style={{display:"flex",gap:9,alignItems:"center"}}>
                      <span style={{fontSize:18}}>🔐</span>
                      <div>
                        <div style={{fontWeight:500,fontSize:14}}>Face ID / Empreinte</div>
                        <div style={{fontSize:11,color:"var(--muted)"}}>Connexion biométrique rapide</div>
                      </div>
                    </div>
                    <div className="toggle" style={{background:biometricEnabled?"var(--green)":"var(--bdr)"}} onClick={async()=>{
                      if(biometricEnabled){disableBiometric();}
                      else{const ok=await registerBiometric();if(!ok)alert("Échec de l'enregistrement biométrique.");}
                    }}><div className="toggle-knob" style={{left:biometricEnabled?21:3}}/></div>
                  </div>
                </div>
              )}
            </div>
            {/* Règles & Support */}
            <div className="card" style={{marginTop:12,padding:0,overflow:"hidden"}}>
              <div onClick={()=>setShowRules(true)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",cursor:"pointer",borderBottom:"1px solid var(--bdr)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>📖</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"var(--txt)"}}>Règles & Principe</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>Comment fonctionne NBgAmes ?</div>
                  </div>
                </div>
                <span style={{color:"var(--muted)",fontSize:18}}>›</span>
              </div>
              <a href="mailto:alexandre07310@icloud.com?subject=Support NBgAmes" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",textDecoration:"none",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>💬</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"var(--txt)"}}>Contacter le support</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>alexandre07310@icloud.com</div>
                  </div>
                </div>
                <span style={{color:"var(--muted)",fontSize:18}}>›</span>
              </a>
            </div>

<button onClick={()=>setShowAdminTrades(true)} style={{width:'100%',padding:'12px',background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12,color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:8}}>⚙️ Admin Trades</button>
            <button className="logoutbtn" onClick={doLogout}>{t.logout}</button>
            <button
              onClick={()=>{setShowDeleteAccount(true);setDeleteConfirm("");setDeleteErr("");}}
              style={{width:'100%',background:'none',border:'none',color:'var(--muted)',fontSize:13,
                      cursor:'pointer',marginTop:14,textDecoration:'underline',padding:8}}>
              Supprimer mon compte
            </button>
          </div>
        )}
      </div>

      {showAdminTrades&&<AdminTradesPanel onClose={()=>setShowAdminTrades(false)} onDataChanged={refreshProfile}/>}

      {/* Suppression de compte — double confirmation (exigence App Store 5.1.1(v)) */}
      {showDeleteAccount&&createPortal(
        <div className="modal-overlay" onClick={()=>!deleteBusy&&setShowDeleteAccount(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div style={{fontSize:18,fontWeight:800,color:'var(--red)',marginBottom:14}}>
              Supprimer définitivement mon compte
            </div>
            <div style={{fontSize:13,color:'var(--txt)',lineHeight:1.6,marginBottom:14}}>
              Cette action est <strong>irréversible</strong>. Seront effacés :
            </div>
            <ul style={{fontSize:13,color:'var(--muted)',lineHeight:1.8,margin:'0 0 16px',paddingLeft:20}}>
              <li>Ton compte et ton adresse e-mail</li>
              <li>Ton pseudo, ta photo et tes préférences</li>
              <li>Tous tes pronostics, points et ton streak</li>
              <li>Tes résultats aux mini-jeux</li>
            </ul>
            <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginBottom:16,
                         background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:10,padding:'10px 12px'}}>
              Les classements de saisons déjà archivées peuvent conserver ton pseudo et ton score
              final. Écris-nous si tu veux qu'il y soit anonymisé.
            </div>
            {deleteErr&&<div style={{fontSize:13,color:'var(--red)',marginBottom:12,lineHeight:1.5}}>{deleteErr}</div>}
            {/* Confirmation en deux temps : pas de saisie à taper, qui pouvait laisser
                le bouton désactivé sans que l'utilisateur comprenne pourquoi. */}
            <button
              onClick={()=>{ if(deleteConfirm==="armed"){doDeleteAccount();} else {setDeleteConfirm("armed");} }}
              disabled={deleteBusy}
              style={{width:'100%',padding:'16px',borderRadius:12,border:'none',fontSize:15,fontWeight:800,
                      marginBottom:8,cursor:deleteBusy?'default':'pointer',
                      background:deleteBusy?'var(--s2)':'var(--red)',
                      color:deleteBusy?'var(--muted)':'#fff'}}>
              {deleteBusy?'Suppression en cours…'
                : deleteConfirm==="armed" ? 'Confirmer : supprimer définitivement'
                : 'Supprimer mon compte'}
            </button>
            {deleteConfirm==="armed"&&!deleteBusy&&(
              <div style={{fontSize:12,color:'var(--red)',textAlign:'center',marginBottom:10}}>
                Appuie une seconde fois pour confirmer. Cette action est irréversible.
              </div>
            )}
            <button onClick={()=>setShowDeleteAccount(false)} disabled={deleteBusy}
              style={{width:'100%',padding:'12px',background:'none',border:'1px solid var(--bdr)',
                      borderRadius:12,color:'var(--muted)',fontSize:14,cursor:'pointer'}}>
              Annuler
            </button>
          </div>
        </div>,document.body)}

      <div className={"bnav "+(franchiseMode?"franchise":"")}>
        {TABS.map(tb=><button key={tb.id} className={"bntab "+(tab===tb.id?"on":"")} onClick={()=>setTab(tb.id)}><span className="bntab-ico">{tb.ico}</span><span className="bntab-lbl">{tb.lbl}</span></button>)}
      </div>

      {/* Modal Paris Utilisateur */}
      {selectedUserBet&&(()=>{
        const{user,bet}=selectedUserBet;
        const scoring=bet.scoring;
        const hasScoring=!!scoring?.breakdown?.length;
        const icons=["🏆","🎯","⭐","📊"];
        const labels=[t.myBets,t.myScore,t.myScorer,t.myScorerPts];
        // Si scoring dispo, on lit guess/real depuis le breakdown directement
        // Sinon on lit depuis les champs bruts du pari
        const rows=hasScoring
          ?scoring.breakdown.map((bd,i)=>({label:labels[i],icon:icons[i],guess:bd.guess,real:bd.real,bd}))
          :[
            {label:t.myBets,icon:"🏆",guess:bet.w,real:null,bd:null},
            {label:t.myScore,icon:"🎯",guess:bet.homeScore!=null&&bet.awayScore!=null?bet.homeScore+" - "+bet.awayScore:null,real:null,bd:null},
            {label:t.myScorer,icon:"⭐",guess:bet.scorer||null,real:null,bd:null},
            {label:t.myScorerPts,icon:"📊",guess:bet.scorerPts!=null?bet.scorerPts+" pts":null,real:null,bd:null},
          ];
        return(
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setSelectedUserBet(null);}}>
            <div className="modal-sheet">
              {/* En-tête */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <TeamBadge team={NBA_TEAMS[user.teamIdx||1]} size={36}/>
                  <div>
                    <div style={{fontWeight:800,fontSize:16,color:"var(--txt)"}}>{user.username}</div>
                    <div style={{fontSize:12,color:"var(--muted)"}}>{bet.home} {t.vs} {bet.away}</div>
                  </div>
                </div>
                <button onClick={()=>setSelectedUserBet(null)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
              </div>

              {/* Score total */}
              {hasScoring&&(
                <div style={{textAlign:"center",marginBottom:16,padding:"12px",background:"color-mix(in srgb,var(--gold) 10%,transparent)",borderRadius:12,border:"1px solid color-mix(in srgb,var(--gold) 30%,transparent)"}}>
                  <div style={{fontSize:11,color:"var(--muted)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{t.totalWon}</div>
                  <div style={{fontSize:30,fontWeight:900,color:"var(--gold)"}}>{scoring.total>0?"+":""}{scoring.total} {t.pts}</div>
                  {scoring.allPerfect&&<div style={{fontSize:12,color:"var(--gold)",marginTop:4}}>{t.bonusAllCorrect}</div>}
                </div>
              )}

              {/* Détail des 4 paris */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {rows.map((row,idx)=>{
                  const bd=row.bd;
                  const isCorrect=bd?.exact;
                  const isPartial=bd&&!isCorrect&&bd.pts>0;
                  const borderColor=!bd?"var(--bdr)":isCorrect?"var(--green)":isPartial?"var(--gold)":"var(--red)";
                  const bgColor=!bd?"var(--s2)":isCorrect?"color-mix(in srgb,var(--green) 8%,var(--s2))":isPartial?"color-mix(in srgb,var(--gold) 8%,var(--s2))":"color-mix(in srgb,var(--red) 8%,var(--s2))";
                  return(
                    <div key={idx} style={{padding:"12px 14px",background:bgColor,borderRadius:12,border:`1.5px solid ${borderColor}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:15}}>{row.icon}</span>
                          <span style={{fontSize:11,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{row.label}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          {bd&&(
                            <div style={{fontSize:11,fontWeight:900,padding:"2px 8px",borderRadius:20,background:isCorrect?"var(--green)":isPartial?"var(--gold)":"var(--red)",color:"#fff"}}>
                              {isCorrect?"✓ EXACT":isPartial?"~ PROCHE":"✗ FAUX"}
                            </div>
                          )}
                          {bd&&<div style={{fontSize:13,fontWeight:800,color:isCorrect?"var(--green)":isPartial?"var(--gold)":"var(--muted)",minWidth:50,textAlign:"right"}}>{bd.pts>0?"+":""}{bd.pts} {t.pts}</div>}
                        </div>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:"var(--txt)"}}>{row.guess||"—"}</div>
                      {bd&&row.real&&(()=>{
                        const isTie=typeof row.real==="string"&&row.real.includes(" / ");
                        if(isTie)return(
                          <div style={{fontSize:12,color:"var(--muted)",marginTop:3}}>
                            {isCorrect?"":"Réponse : "}<span style={{color:"var(--muted)",fontWeight:600}}>{row.real}</span>
                            <span style={{marginLeft:6,fontSize:10,background:"color-mix(in srgb,var(--muted) 20%,transparent)",color:"var(--muted)",borderRadius:4,padding:"2px 6px",fontWeight:700}}>🤝 Égalité</span>
                          </div>
                        );
                        if(!isCorrect)return(
                          <div style={{fontSize:12,color:"var(--muted)",marginTop:3}}>
                            Réponse : <span style={{color:"var(--txt)",fontWeight:600}}>{row.real}</span>
                          </div>
                        );
                        return null;
                      })()}
                      {/* Détail de proximité pour score et points scoreur */}
                      {isPartial&&(()=>{
                        if(idx===1){
                          // Score : guess="hG-aG", real="hR-aR"
                          const[hG,aG]=(row.guess||"").split("-").map(Number);
                          const[hR,aR]=(row.real||"").split("-").map(Number);
                          const lines=[];
                          if(!isNaN(hG)&&!isNaN(hR)&&hG!==hR)lines.push(`${hR>hG?"+":""}${hG-hR} sur score ${row.guess?.split("-")[0]?.trim()}`);
                          if(!isNaN(aG)&&!isNaN(aR)&&aG!==aR)lines.push(`${aR>aG?"+":""}${aG-aR} sur score ${row.guess?.split("-")[1]?.trim()}`);
                          return lines.length?<div style={{fontSize:11,color:"var(--gold)",marginTop:4}}>Écart : {lines.join(" · ")}</div>:null;
                        }
                        if(idx===3){
                          // Points du scoreur
                          const g=parseInt(row.guess),r=parseInt(row.real);
                          if(!isNaN(g)&&!isNaN(r)){
                            const diff=Math.abs(g-r);
                            return <div style={{fontSize:11,color:"var(--gold)",marginTop:4}}>Écart : ±{diff} pt{diff>1?"s":""} → +{bd.pts} pts</div>;
                          }
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Reset Password */}
      {showReset&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget){setShowReset(false);}}}>
          <div className="modal-sheet">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontWeight:800,fontSize:18,color:"var(--txt)"}}>🔑 {t.forgotPwd}</div>
              <button onClick={()=>setShowReset(false)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
            </div>
            <div style={{fontSize:13,color:"var(--muted)",marginBottom:16,lineHeight:1.5}}>Saisis ton adresse email, on t'envoie un lien pour réinitialiser ton mot de passe.</div>
            {resetErr&&<div className="aerr" style={{marginBottom:12}}>⚠️ {resetErr}</div>}
            {resetMsg&&<div className="aok" style={{marginBottom:12}}>{resetMsg}</div>}
            {!resetMsg&&(
              <>
                <div className="ig" style={{marginBottom:14}}><span className="iico">✉️</span><input className="ainput" type="email" placeholder={t.email} value={resetEmail} onChange={e=>setResetEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doReset()}/></div>
                <button className="abtn" onClick={doReset} disabled={resetLoading}>{resetLoading?t.loading:"Envoyer le lien"}</button>
              </>
            )}
            {resetMsg&&<button className="abtn" style={{marginTop:8}} onClick={()=>setShowReset(false)}>Fermer</button>}
          </div>
        </div>
      )}

      {/* Modal Règles */}
      {showRules&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowRules(false);}}>
          <div className="modal-sheet">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontWeight:800,fontSize:18,color:"var(--txt)"}}>📖 Règles & Principe</div>
              <button onClick={()=>setShowRules(false)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
            </div>

            {[
              {icon:"🏀",title:"Le principe",body:"Chaque soir, un match NBA est tiré au sort, ainsi qu'une statistique au hasard (points, passes, rebonds, contres ou interceptions). Tu as jusqu'à 1h avant le tip-off pour poser tes 3 pronostics. Les points sont calculés automatiquement une fois le match terminé."},
              {icon:"🔒",title:"Clôture des paris",body:"Les paris ferment exactement 1 heure avant le début du match. Passé ce délai, aucune modification n'est possible. Une alerte te prévient 30 minutes avant la fermeture."},
              {icon:"🏆",title:"Question 1 — Vainqueur",body:"Choisis l'équipe qui remporte le match.\n✅ Bonne réponse : +10 pts"},
              {icon:"⭐",title:"Question 2 — Le leader de la stat",body:"La statistique du jour est tirée au sort en même temps que le match : meilleur scoreur, passeur, rebondeur, contreur ou intercepteur.\nDésigne le joueur qui la dominera.\n✅ Bonne réponse : +20 pts"},
              {icon:"📊",title:"Question 3 — Le total",body:"Estime le nombre exact réalisé par ce joueur dans la stat du jour.\n✅ Nombre exact : +30 pts"},
              {icon:"🌟",title:"Bonus PARFAIT",body:"Si tu réussis les 3 questions (vainqueur + bon joueur + nombre exact), ton total est multiplié par ×2 — soit 120 pts !"},
              {icon:"🔥",title:"Streak",body:"Ta flamme augmente de 1 à chaque paris posé. Elle repart à 0 si tu rates un match sans parier."},
              {icon:"🧠",title:"Mini-jeu — Culture NBA",body:"10 questions par jour. La première bonne réponse vaut 1 pt, la suivante 2, puis 3… Une erreur fait retomber la valeur à 1.\n✅ Sans faute : 55 pts"},
              {icon:"🧭",title:"Mini-jeu — Parcours",body:"3 joueurs par jour à reconnaître grâce à leur parcours (franchises et années). Pour chacun, choisis ton niveau de risque :\n💰 Cash (tu écris le nom) : +5 pts\n🔲 Carré (4 propositions) : +3 pts\n⚖️ Duo (2 propositions) : +1 pt"},
              {icon:"📆",title:"Classements",body:"🌍 Global : total de tous tes points\n🏀 Dernier match : points du match précédent\n📆 Semaine : points de la semaine en cours (reset chaque lundi)\n🗓️ Mois : points du mois en cours (reset le 1er de chaque mois)"},
            ].map((s,i)=>(
              <div key={i} style={{marginBottom:16,padding:"12px 14px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--bdr)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:18}}>{s.icon}</span>
                  <span style={{fontWeight:800,fontSize:13,color:"var(--gold)"}}>{s.title}</span>
                </div>
                <div style={{fontSize:13,color:"var(--txt)",lineHeight:1.6,whiteSpace:"pre-line"}}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Edit Profile */}
      {showEditProfile&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowEditProfile(false);}}>
          <div className="modal-sheet">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:800,color:"var(--txt)"}}>✏️ {t.editProfile}</div>
              <button onClick={()=>setShowEditProfile(false)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            {editErr&&<div className="aerr" style={{marginBottom:12}}>⚠️ {editErr}</div>}
            {editOk&&<div className="aok" style={{marginBottom:12}}>✓ {editOk}</div>}
            <div style={{textAlign:"center",marginBottom:20}}>
              <input ref={photoInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoSelect}/>
              <div className="photo-upload" onClick={()=>photoInputRef.current?.click()}>
                {editPhotoPreview?<img src={editPhotoPreview} alt="preview"/>:<div style={{textAlign:"center"}}><div style={{fontSize:32}}>📷</div><div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{t.editPhoto}</div></div>}
                <div className="photo-overlay"><span style={{color:"#fff",fontSize:24}}>📷</span></div>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:6}}>{t.editPhoto}</div>
            </div>
            <div className="input-group">
              <div className="input-label">{t.editPseudo}</div>
              <input className="ainput plain" type="text" value={editForm.pseudo} maxLength={20} onChange={e=>handlePseudoChange(e.target.value,true)} style={{paddingLeft:14}}/>
              {editPseudoStatus&&<div className={"pseudo-check "+(editPseudoStatus==="ok"?"ok":editPseudoStatus==="taken"?"no":"checking")}>{editPseudoStatus==="checking"?t.checkingPseudo:editPseudoStatus==="ok"?t.pseudoAvailable:t.pseudoTaken}</div>}
            </div>
            <div className="input-group">
              <div className="input-label">{t.editEmail}</div>
              <input className="ainput plain" type="email" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))} style={{paddingLeft:14}}/>
            </div>
            <div className="input-group">
              <div className="input-label">{t.editTeam}</div>
              <div className="tgrid" style={{maxHeight:180}}>{NBA_TEAMS.map((team,i)=><div key={team.abbr} className={"topt "+(editTeamIdx===i?"on":"")} onClick={()=>setEditTeamIdx(i)}><TeamBadge team={team} size={32} selected={editTeamIdx===i}/><span className="tlbl">{team.abbr}</span></div>)}</div>
            </div>
            <div className="input-group">
              <div className="input-label">{t.editPwd}</div>
              <input className="ainput plain" type="password" placeholder={t.currentPwd} value={editForm.currentPwd} onChange={e=>setEditForm(f=>({...f,currentPwd:e.target.value}))} style={{paddingLeft:14,marginBottom:8}}/>
              <input className="ainput plain" type="password" placeholder={t.newPwd} value={editForm.newPwd} onChange={e=>setEditForm(f=>({...f,newPwd:e.target.value}))} style={{paddingLeft:14,marginBottom:8}}/>
              <input className="ainput plain" type="password" placeholder={t.confirmPwd} value={editForm.confirmPwd} onChange={e=>setEditForm(f=>({...f,confirmPwd:e.target.value}))} style={{paddingLeft:14}}/>
            </div>
            <button className="abtn" onClick={saveProfile} disabled={editLoading||editPseudoStatus==="taken"||editPseudoStatus==="checking"} style={{marginTop:8,maxWidth:280,margin:"8px auto 0",display:"block"}}>
              {editLoading?t.loading:t.saveChanges}
            </button>
            <button onClick={()=>setShowEditProfile(false)} style={{width:"100%",background:"none",border:"1px solid var(--bdr)",color:"var(--muted)",padding:"12px",borderRadius:12,fontSize:15,fontWeight:600,cursor:"pointer",marginTop:8}}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div></>
  );
}