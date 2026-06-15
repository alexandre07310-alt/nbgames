import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { auth, db, storage } from "./firebase";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, GoogleAuthProvider, OAuthProvider, signInWithPopup,
  updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  fr:{appTag:"LE JEU NBA ULTIME",login:"Connexion",signup:"Inscription",connect:"SE CONNECTER",createAccount:"CRÉER MON COMPTE",loading:"Chargement...",email:"Email",password:"Mot de passe",stayConnected:"Rester connecté",forgotPwd:"Mot de passe oublié ?",reset:"Réinitialiser",or:"OU",google:"Google",apple:"Apple",welcome:"Bienvenue sur",tagline:"Le jeu NBA ultime. Pronostiquez chaque soir le match du jour, défiez vos amis et grimpez dans le classement mondial.",start:"Commencer",next:"Suivant",letsgo:"C'est parti !",skip:"Passer",betsClose:"Paris clôturés 1h avant",betsCloseDesc:"Chaque soir, un match NBA tiré au sort. Vos pronostics se ferment 1h avant le début. Les points sont attribués automatiquement après le match !",yourProfile:"Votre profil",chooseTeam:"Choisissez votre équipe NBA et votre pseudo.",save:"Sauvegarde...",pseudoPlaceholder:"Votre pseudo...",match:"Match",minigames:"Mini-Jeux",ranking:"Classement",history:"Historique",profile:"Profil",nextMatch:"Prochain match dans",nightResult:"Résultat de la nuit",sessionEnd:"SESSION TERMINÉE · FINAL",sessionPrev:"SESSION PRÉCÉDENTE",program:"Programme à venir",noMatch:"PAS DE MATCH CE SOIR",selected:"Match sélectionné",playoffs:"PLAYOFFS",betsOpen:"PARIS OUVERTS",betsWarning:"FERMETURE IMMINENTE !",betsClosed:"PARIS FERMÉS",closingAt:"Fermeture des paris à",closedAt:"Clôturés · Tip-off à",drawnAt:"Tiré au sort",tipoff:"Tip-off",live:"EN DIRECT",final:"FINAL",winner:"WINNER",inProgress:"EN COURS",vs:"vs",q1:"Question 1/4",q2:"Question 2/4",q3:"Question 3/4",q4:"Question 4/4",modify:"Modifier",cancelEdit:"← Annuler",editMode:"MODIFIER MA RÉPONSE",q1Text:"Quelle équipe remporte ce match ?",q2Text:"Quel sera le score final ?",q3Text:"Qui sera le meilleur scoreur du match ?",q4Text:"Combien de points va marquer le meilleur scoreur ?",pts:"pts",validate:"VALIDER",validateScore:"VALIDER LE SCORE",choosePlayer:"Choisir un joueur...",loadingPlayers:"Chargement des joueurs...",betsRegistered:"PRONOSTICS ENREGISTRÉS",modifyHint:"Appuyez sur une réponse pour la modifier",lockedHint:"🔒 Paris clôturés — plus de modifications possibles",waitingResult:"Les points seront attribués automatiquement après le match.",myBets:"Vainqueur",myScore:"Score",myScorer:"Meilleur scoreur",myScorerPts:"Points du scoreur",results:"RÉSULTATS !",totalWon:"Total gagné",bonusAllCorrect:"🏆 BONUS TOUT PARFAIT × 2 !",betsClosed2:"PARIS FERMÉS",betsClosedHint:"Revenez après le match !",lockedFull:"PARIS FERMÉS",comingSoon:"BIENTÔT DISPONIBLE",comingSoonDesc:"Les mini-jeux arrivent très prochainement.\nRestez connectés !",globalRanking:"CLASSEMENT GLOBAL",realtime:"Temps réel · Firebase",firstToPlay:"Soyez le premier à jouer ! 🏀",noHistory:"AUCUN HISTORIQUE",noHistoryDesc:"Vos résultats apparaîtront ici après chaque match.",matchesPlayed:"match joué",matchesPlayedP:"matchs joués",myProfile:"MON PROFIL",points:"POINTS",streak:"STREAK",rank:"RANG",settings:"Paramètres",lang:"Langue",darkMode:"Mode sombre",lightMode:"Mode clair",franchiseTheme:"Thème franchise",notifications:"Notifications",notifDesc:"Nouveau match + fermeture des paris",logout:"🚪 Se déconnecter",errFill:"Veuillez remplir tous les champs.",errEmail:"Email invalide.",errPwd:"Mot de passe trop court (6 min).",errUsed:"Cet email est déjà utilisé.",errNotFound:"Aucun compte avec cet email.",errWrongPwd:"Mot de passe incorrect.",errInvalid:"Email ou mot de passe incorrect.",errTooMany:"Trop de tentatives.",errGeneric:"Une erreur est survenue.",errPseudoTaken:"Ce pseudo est déjà utilisé.",alertClose:"Paris fermant dans 30 minutes !",alertClosing:"fermeture à",notifNewMatch:"Nouveau match NBgAmes !",notifBets:"Faites vos pronostics !",notifClosing:"Paris bientôt fermés !",notifClosingDesc:"fermeture dans 30 min !",editProfile:"Modifier le profil",editPhoto:"Changer la photo",editPseudo:"Pseudo",editEmail:"Email",editPwd:"Mot de passe",editTeam:"Équipe favorite",currentPwd:"Mot de passe actuel",newPwd:"Nouveau mot de passe",confirmPwd:"Confirmer",saveChanges:"ENREGISTRER",cancel:"Annuler",pwdMismatch:"Les mots de passe ne correspondent pas.",pwdTooShort:"Mot de passe trop court.",reauthRequired:"Entrez votre mot de passe actuel pour confirmer.",profileUpdated:"Profil mis à jour !",checkingPseudo:"Vérification...",pseudoAvailable:"✓ Pseudo disponible",pseudoTaken:"✗ Pseudo déjà pris",trendTitle:"Tendance des joueurs",trendWinner:"Pronostics vainqueur",trendScore:"Tranches de score",trendScorer:"Meilleur scoreur choisi",trendScorerPts:"Tranches de points",players:"joueurs",rankingGlobal:"🌍 Global",rankingLastMatch:"🏀 Dernier match",rankingWeek:"📆 Semaine",rankingMonth:"🗓️ Mois",noRankingData:"Aucun résultat pour cette période.",matchDetails:"Détail du match",communityBets:"Paris de la communauté",noCommunityData:"Aucun paris enregistré.",close:"Fermer",},
  en:{appTag:"THE ULTIMATE NBA GAME",login:"Login",signup:"Sign up",connect:"SIGN IN",createAccount:"CREATE ACCOUNT",loading:"Loading...",email:"Email",password:"Password",stayConnected:"Stay connected",forgotPwd:"Forgot password?",reset:"Reset",or:"OR",google:"Google",apple:"Apple",welcome:"Welcome to",tagline:"The ultimate NBA game. Predict each night's match, challenge your friends and climb the global leaderboard.",start:"Get started",next:"Next",letsgo:"Let's go!",skip:"Skip",betsClose:"Bets close 1h before",betsCloseDesc:"Every night a random NBA game is selected. Your predictions close 1 hour before tip-off. Points are awarded automatically!",yourProfile:"Your profile",chooseTeam:"Choose your NBA team and username.",save:"Saving...",pseudoPlaceholder:"Your username...",match:"Match",minigames:"Mini-Games",ranking:"Ranking",history:"History",profile:"Profile",nextMatch:"Next match in",nightResult:"Last night's result",sessionEnd:"SESSION ENDED · FINAL",sessionPrev:"PREVIOUS SESSION",program:"Tonight's games",noMatch:"NO GAME TONIGHT",selected:"Selected match",playoffs:"PLAYOFFS",betsOpen:"BETS OPEN",betsWarning:"CLOSING SOON!",betsClosed:"BETS CLOSED",closingAt:"Bets close at",closedAt:"Closed · Tip-off at",drawnAt:"Randomly selected",tipoff:"Tip-off",live:"LIVE",final:"FINAL",winner:"WINNER",inProgress:"IN PROGRESS",vs:"vs",q1:"Question 1/4",q2:"Question 2/4",q3:"Question 3/4",q4:"Question 4/4",modify:"Edit",cancelEdit:"← Cancel",editMode:"EDIT YOUR ANSWER",q1Text:"Which team wins this game?",q2Text:"What will the final score be?",q3Text:"Who will be the top scorer?",q4Text:"How many points will the top scorer get?",pts:"pts",validate:"CONFIRM",validateScore:"CONFIRM SCORE",choosePlayer:"Choose a player...",loadingPlayers:"Loading players...",betsRegistered:"BETS SAVED",modifyHint:"Tap a prediction to edit it",lockedHint:"🔒 Bets closed — no more edits",waitingResult:"Points will be awarded automatically after the game.",myBets:"Winner",myScore:"Score",myScorer:"Top scorer",myScorerPts:"Scorer points",results:"RESULTS!",totalWon:"Total earned",bonusAllCorrect:"🏆 PERFECT BONUS × 2!",betsClosed2:"BETS CLOSED",betsClosedHint:"Come back after the game!",lockedFull:"BETS CLOSED",comingSoon:"COMING SOON",comingSoonDesc:"Mini-games coming soon.\nStay tuned!",globalRanking:"GLOBAL RANKING",realtime:"Real-time · Firebase",firstToPlay:"Be the first to play! 🏀",noHistory:"NO HISTORY",noHistoryDesc:"Your results will appear here after each game.",matchesPlayed:"game played",matchesPlayedP:"games played",myProfile:"MY PROFILE",points:"POINTS",streak:"STREAK",rank:"RANK",settings:"Settings",lang:"Language",darkMode:"Dark mode",lightMode:"Light mode",franchiseTheme:"Franchise theme",notifications:"Notifications",notifDesc:"New match + bet closing",logout:"🚪 Sign out",errFill:"Please fill in all fields.",errEmail:"Invalid email.",errPwd:"Password too short (min 6).",errUsed:"Email already in use.",errNotFound:"No account with this email.",errWrongPwd:"Wrong password.",errInvalid:"Invalid email or password.",errTooMany:"Too many attempts.",errGeneric:"An error occurred.",errPseudoTaken:"Username already taken.",alertClose:"Bets closing in 30 minutes!",alertClosing:"closes at",notifNewMatch:"New NBgAmes match!",notifBets:"Make your predictions!",notifClosing:"Bets closing soon!",notifClosingDesc:"closes in 30 min!",editProfile:"Edit profile",editPhoto:"Change photo",editPseudo:"Username",editEmail:"Email",editPwd:"Password",editTeam:"Favorite team",currentPwd:"Current password",newPwd:"New password",confirmPwd:"Confirm",saveChanges:"SAVE CHANGES",cancel:"Cancel",pwdMismatch:"Passwords don't match.",pwdTooShort:"Password too short.",reauthRequired:"Enter your current password to confirm.",profileUpdated:"Profile updated!",checkingPseudo:"Checking...",pseudoAvailable:"✓ Username available",pseudoTaken:"✗ Username taken",trendTitle:"Player trends",trendWinner:"Winner predictions",trendScore:"Score ranges",trendScorer:"Top scorer picks",trendScorerPts:"Points ranges",players:"players",rankingGlobal:"🌍 Global",rankingLastMatch:"🏀 Last match",rankingWeek:"📆 Week",rankingMonth:"🗓️ Month",noRankingData:"No results for this period.",matchDetails:"Match details",communityBets:"Community bets",noCommunityData:"No bets recorded.",close:"Close",},
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
const ESPN_TEAM_IDS={ATL:"1",BOS:"2",BKN:"17",CHA:"30",CHI:"4",CLE:"5",DAL:"6",DEN:"7",DET:"8",GSW:"9",GS:"9",HOU:"10",IND:"11",LAC:"12",LAL:"13",MEM:"29",MIA:"14",MIL:"15",MIN:"16",NOP:"3",NO:"3",NYK:"18",NY:"18",OKC:"25",ORL:"19",PHI:"20",PHX:"21",POR:"22",SAC:"23",SAS:"24",SA:"24",TOR:"28",UTA:"26",UTAH:"26",WAS:"27"};
function getTeam(abbr){if(!abbr)return NBA_TEAMS[0];const map={"GS":"GSW","SA":"SAS","NO":"NOP","NY":"NYK","UTAH":"UTA"};return NBA_TEAMS.find(t=>t.abbr===(map[abbr]||abbr))||NBA_TEAMS[0];}
function getLogoUrl(abbr){const m={"GS":"gs","SA":"sa","NO":"no","NY":"ny","UTAH":"utah","GSW":"gs","SAS":"sa","NOP":"no","NYK":"ny","UTA":"utah"};return`https://a.espncdn.com/i/teamlogos/nba/500/${m[abbr]||abbr?.toLowerCase()}.png`;}

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
function AppleIcon({size=20}){return <svg width={size} height={size} viewBox="0 0 814 1000" fill="var(--txt)" style={{flexShrink:0}}><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.1 135.4-316.6 269.1-316.6 70.7 0 129.5 46.4 173.1 46.4 42.8 0 109.4-49.8 188.3-49.8zm-232-206.7c35.1-41.4 65.2-105 65.2-168.7 0-8.9-.6-17.9-2.2-25.5-61.6 2.3-135 41.4-177.6 89.5-33.5 37.8-67.9 101.1-67.9 165.4 0 9.5 1.7 19 2.6 22.1 3.9.6 10.4 1.7 16.8 1.7 55.4 0 126.1-37.2 163.1-84.5z"/></svg>;}

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
  try{const comp=event.competitions[0];const home=comp.competitors.find(c=>c.homeAway==="home");const away=comp.competitors.find(c=>c.homeAway==="away");if(!home||!away)return null;const isFinished=comp.status?.type?.completed===true;const isLive=comp.status?.type?.state==="in";let topScorers=[],topScorerPts=0;for(const competitor of comp.competitors){const pl=competitor.leaders?.find(l=>l.name==="points");if(pl?.leaders?.[0]){const pts=pl.leaders[0].value;const name=pl.leaders[0].athlete?.displayName||null;if(pts>topScorerPts){topScorerPts=pts;topScorers=[name];}else if(pts===topScorerPts&&pts>0&&name&&!topScorers.includes(name)){topScorers.push(name);}}}const topScorer=topScorers[0]||null;return{id:event.id,home:home.team.abbreviation,away:away.team.abbreviation,homeName:home.team.displayName,awayName:away.team.displayName,tipoff:event.date,homeScore:parseInt(home.score)||0,awayScore:parseInt(away.score)||0,isFinished,isLive,isPostseason:event.season?.type===3,topScorer:isFinished?topScorer:null,topScorerPts:isFinished?topScorerPts:null,topScorers:isFinished?topScorers:[]};}catch(e){return null;}
}
async function fetchLiveScore(espnId){
  try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`);const j=await r.json();const ev=(j.events||[]).find(e=>e.id===espnId);if(!ev)return null;return espnToMatch(ev);}catch(e){return null;}
}
async function fetchMatchResult(espnId){
  try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`);const j=await r.json();let topScorers=[],topScorerPts=0;for(const team of(j.boxscore?.players||[])){for(const stat of(team.statistics||[])){for(const athlete of(stat.athletes||[])){const ptsIdx=stat.labels?.indexOf("PTS");if(ptsIdx>=0){const pts=parseInt(athlete.stats?.[ptsIdx])||0;const name=athlete.athlete?.displayName||null;if(pts>topScorerPts){topScorerPts=pts;topScorers=[name];}else if(pts===topScorerPts&&pts>0&&name&&!topScorers.includes(name)){topScorers.push(name);}}}}}const topScorer=topScorers[0]||null;return{topScorer,topScorerPts,topScorers};}catch(e){return null;}
}
async function fetchTeamRoster(espnTeamId){try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnTeamId}/roster`);const j=await r.json();return(j.athletes||[]).map(a=>a.displayName).filter(Boolean);}catch(e){return[];}}
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
function computePronosticScore(pronostics,match,t){
  const{w,homeScore:hG,awayScore:aG,scorer,scorerPts:spG}=pronostics;
  const realWinner=match.homeScore>match.awayScore?match.home:match.away;
  const breakdown=[];let total=0;
  const wOk=w===realWinner,wPts=wOk?50:0;
  breakdown.push({label:t.myBets,guess:w,real:realWinner,pts:wPts,ok:wOk,exact:wOk});total+=wPts;
  const hOk=parseInt(hG)===match.homeScore,aOk=parseInt(aG)===match.awayScore;
  let sPts=0;
  if(hOk&&aOk){sPts=500;}
  else if(hOk||aOk){sPts=200;if(!hOk)sPts+=proximityPts(hG,match.homeScore,0,SCORE_RANGES);if(!aOk)sPts+=proximityPts(aG,match.awayScore,0,SCORE_RANGES);}
  else{sPts=proximityPts(hG,match.homeScore,0,SCORE_RANGES)+proximityPts(aG,match.awayScore,0,SCORE_RANGES);}
  const sExact=hOk&&aOk;
  breakdown.push({label:t.myScore,guess:`${hG}-${aG}`,real:`${match.homeScore}-${match.awayScore}`,pts:sPts,ok:sPts>0,exact:sExact});total+=sPts;
  const topScorersArr=match.topScorers&&match.topScorers.length>0?match.topScorers:(match.topScorer?[match.topScorer]:[]);
  const scrOk=scorer&&topScorersArr.length>0&&topScorersArr.includes(scorer),scrPts=scrOk?100:0;
  const realScorerDisplay=topScorersArr.length>1?topScorersArr.join(" / "):topScorersArr[0]||"N/A";
  breakdown.push({label:t.myScorer,guess:scorer,real:realScorerDisplay,pts:scrPts,ok:scrOk,exact:scrOk});total+=scrPts;
  const spPts=proximityPts(spG,match.topScorerPts||0,200,SCORER_RANGES),spExact=parseInt(spG)===(match.topScorerPts||0);
  breakdown.push({label:t.myScorerPts,guess:spG,real:match.topScorerPts||"N/A",pts:spPts,ok:spPts>0,exact:spExact});total+=spPts;
  const allPerfect=wOk&&sExact&&scrOk&&spExact;
  if(allPerfect)total*=2;
  return{breakdown,total,allPerfect};
}

async function autoCalculateAllUsers(match,t){
  try{
    // Récupère les données complètes (summary API) pour une détection précise des égalités
    let enrichedMatch=match;
    if(match.id&&!match.id.startsWith("f")){
      const result=await fetchMatchResult(match.id);
      if(result?.topScorer)enrichedMatch={...match,...result};
    }
    const usersSnap=await getDocs(collection(db,"users"));
    const key="pronostic_"+enrichedMatch.id;
    const weekKey=getWeekKey(),monthKey=getMonthKey();
    const updates=[];
    for(const userDoc of usersSnap.docs){
      const userData=userDoc.data();const pron=userData[key];
      if(!pron?.done)continue;
      const docUpdate={lastMatchId:enrichedMatch.id};
      if(!pron.scoring){
        // Pas encore scoré : on calcule et on met tout à jour
        const sr=computePronosticScore(pron,enrichedMatch,t);
        const newPts=(userData.points||0)+sr.total;
        const weekPts={...((userData.weekPts)||{})};weekPts[weekKey]=(weekPts[weekKey]||0)+sr.total;
        const monthPts={...((userData.monthPts)||{})};monthPts[monthKey]=(monthPts[monthKey]||0)+sr.total;
        Object.assign(docUpdate,{[key]:{...pron,scoring:sr},points:newPts,weekPts,monthPts,lastMatchPts:sr.total});
      } else {
        // Déjà scoré : on met juste à jour lastMatchId + lastMatchPts pour le classement
        docUpdate.lastMatchPts=pron.scoring.total;
      }
      updates.push(updateDoc(doc(db,"users",userDoc.id),docUpdate));
    }
    await Promise.all(updates);
  }catch(e){console.error(e);}
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
        if(result?.topScorer){
          matchCache[matchId]={
            topScorer:result.topScorer||null,
            topScorerPts:result.topScorerPts||0,
            topScorers:(result.topScorers||[result.topScorer]).filter(Boolean),
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
        const realScore=(bd[1]?.real||"0-0").split("-");
        const homeScore=parseInt(realScore[0])||0;
        const awayScore=parseInt(realScore[1])||0;
        const fallbackScorerPts=parseInt(bd[3]?.real)||0;
        const matchObj={
          id:matchId,
          home:pron.home||"",
          away:pron.away||"",
          homeScore,awayScore,
          topScorer:matchResult.topScorer,
          topScorerPts:matchResult.topScorerPts||fallbackScorerPts,
          topScorers:matchResult.topScorers,
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
        if(p.scorer)scorer[p.scorer]=(scorer[p.scorer]||0)+1;
        if(p.scorerPts!=null){const b=Math.floor(parseInt(p.scorerPts)/10)*10;scorerPts[b]=(scorerPts[b]||0)+1;}
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

const NBA_CHAMPIONS_DATA=[
  {year:1947,team:"Philadelphia Warriors",city:"Philadelphia",nick:"Warriors",abbr:"PHI"},
  {year:1948,team:"Baltimore Bullets",city:"Baltimore",nick:"Bullets",abbr:"BAL"},
  {year:1949,team:"Minneapolis Lakers",city:"Minneapolis",nick:"Lakers",abbr:"MIN"},
  {year:1950,team:"Minneapolis Lakers",city:"Minneapolis",nick:"Lakers",abbr:"MIN"},
  {year:1951,team:"Rochester Royals",city:"Rochester",nick:"Royals",abbr:"ROC"},
  {year:1952,team:"Minneapolis Lakers",city:"Minneapolis",nick:"Lakers",abbr:"MIN"},
  {year:1953,team:"Minneapolis Lakers",city:"Minneapolis",nick:"Lakers",abbr:"MIN"},
  {year:1954,team:"Minneapolis Lakers",city:"Minneapolis",nick:"Lakers",abbr:"MIN"},
  {year:1955,team:"Syracuse Nationals",city:"Syracuse",nick:"Nationals",abbr:"SYR"},
  {year:1956,team:"Philadelphia Warriors",city:"Philadelphia",nick:"Warriors",abbr:"PHI"},
  {year:1957,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1958,team:"St. Louis Hawks",city:"St. Louis",nick:"Hawks",abbr:"STL"},
  {year:1959,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1960,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1961,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1962,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1963,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1964,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1965,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1966,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1967,team:"Philadelphia 76ers",city:"Philadelphia",nick:"76ers",abbr:"PHI"},
  {year:1968,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1969,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1970,team:"New York Knicks",city:"New York",nick:"Knicks",abbr:"NYK"},
  {year:1971,team:"Milwaukee Bucks",city:"Milwaukee",nick:"Bucks",abbr:"MIL"},
  {year:1972,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:1973,team:"New York Knicks",city:"New York",nick:"Knicks",abbr:"NYK"},
  {year:1974,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1975,team:"Golden State Warriors",city:"Golden State",nick:"Warriors",abbr:"GSW"},
  {year:1976,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1977,team:"Portland Trail Blazers",city:"Portland",nick:"Trail Blazers",abbr:"POR"},
  {year:1978,team:"Washington Bullets",city:"Washington",nick:"Bullets",abbr:"WSB"},
  {year:1979,team:"Seattle SuperSonics",city:"Seattle",nick:"SuperSonics",abbr:"SEA"},
  {year:1980,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:1981,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1982,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:1983,team:"Philadelphia 76ers",city:"Philadelphia",nick:"76ers",abbr:"PHI"},
  {year:1984,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1985,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:1986,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:1987,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:1988,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:1989,team:"Detroit Pistons",city:"Detroit",nick:"Pistons",abbr:"DET"},
  {year:1990,team:"Detroit Pistons",city:"Detroit",nick:"Pistons",abbr:"DET"},
  {year:1991,team:"Chicago Bulls",city:"Chicago",nick:"Bulls",abbr:"CHI"},
  {year:1992,team:"Chicago Bulls",city:"Chicago",nick:"Bulls",abbr:"CHI"},
  {year:1993,team:"Chicago Bulls",city:"Chicago",nick:"Bulls",abbr:"CHI"},
  {year:1994,team:"Houston Rockets",city:"Houston",nick:"Rockets",abbr:"HOU"},
  {year:1995,team:"Houston Rockets",city:"Houston",nick:"Rockets",abbr:"HOU"},
  {year:1996,team:"Chicago Bulls",city:"Chicago",nick:"Bulls",abbr:"CHI"},
  {year:1997,team:"Chicago Bulls",city:"Chicago",nick:"Bulls",abbr:"CHI"},
  {year:1998,team:"Chicago Bulls",city:"Chicago",nick:"Bulls",abbr:"CHI"},
  {year:1999,team:"San Antonio Spurs",city:"San Antonio",nick:"Spurs",abbr:"SAS"},
  {year:2000,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:2001,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:2002,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:2003,team:"San Antonio Spurs",city:"San Antonio",nick:"Spurs",abbr:"SAS"},
  {year:2004,team:"Detroit Pistons",city:"Detroit",nick:"Pistons",abbr:"DET"},
  {year:2005,team:"San Antonio Spurs",city:"San Antonio",nick:"Spurs",abbr:"SAS"},
  {year:2006,team:"Miami Heat",city:"Miami",nick:"Heat",abbr:"MIA"},
  {year:2007,team:"San Antonio Spurs",city:"San Antonio",nick:"Spurs",abbr:"SAS"},
  {year:2008,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
  {year:2009,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:2010,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:2011,team:"Dallas Mavericks",city:"Dallas",nick:"Mavericks",abbr:"DAL"},
  {year:2012,team:"Miami Heat",city:"Miami",nick:"Heat",abbr:"MIA"},
  {year:2013,team:"Miami Heat",city:"Miami",nick:"Heat",abbr:"MIA"},
  {year:2014,team:"San Antonio Spurs",city:"San Antonio",nick:"Spurs",abbr:"SAS"},
  {year:2015,team:"Golden State Warriors",city:"Golden State",nick:"Warriors",abbr:"GSW"},
  {year:2016,team:"Cleveland Cavaliers",city:"Cleveland",nick:"Cavaliers",abbr:"CLE"},
  {year:2017,team:"Golden State Warriors",city:"Golden State",nick:"Warriors",abbr:"GSW"},
  {year:2018,team:"Golden State Warriors",city:"Golden State",nick:"Warriors",abbr:"GSW"},
  {year:2019,team:"Toronto Raptors",city:"Toronto",nick:"Raptors",abbr:"TOR"},
  {year:2020,team:"Los Angeles Lakers",city:"Los Angeles",nick:"Lakers",abbr:"LAL"},
  {year:2021,team:"Milwaukee Bucks",city:"Milwaukee",nick:"Bucks",abbr:"MIL"},
  {year:2022,team:"Golden State Warriors",city:"Golden State",nick:"Warriors",abbr:"GSW"},
  {year:2023,team:"Denver Nuggets",city:"Denver",nick:"Nuggets",abbr:"DEN"},
  {year:2024,team:"Boston Celtics",city:"Boston",nick:"Celtics",abbr:"BOS"},
];

async function fetchRecentChampions(fromYear){
  const results=[];const now=new Date().getFullYear();
  for(let y=fromYear+1;y<=now;y++){
    try{
      const r=await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${y}`);
      const j=await r.json();
      const ch=j?.champions?.[0];
      if(ch?.team?.displayName){
        const tm=ch.team;
        results.push({year:y,team:tm.displayName,city:tm.location||tm.displayName,nick:tm.name||tm.displayName,abbr:tm.abbreviation||''});
      }
    }catch(e){}
  }
  return results;
}
function mkRng(seed){let s=Math.abs(Math.round(seed*1000))%2147483647||1;return()=>{s=s*16807%2147483647;return(s-1)/2147483646;};}
function rngSample(arr,n,rng){const pool=[...arr];const out=[];while(out.length<n&&pool.length>0){const i=Math.floor(rng()*pool.length);out.push(pool.splice(i,1)[0]);}return out;}
function rngShuffle(arr,rng){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

// Année à partir de laquelle chaque franchise existe en NBA sous ce nom
const TEAM_NBA_FROM={
  "Minneapolis Lakers":1948,"Rochester Royals":1948,"Syracuse Nationals":1949,
  "Philadelphia Warriors":1946,"Boston Celtics":1946,"St. Louis Hawks":1946,
  "New York Knicks":1946,"Detroit Pistons":1948,"Atlanta Hawks":1946,
  "Philadelphia 76ers":1963,"Los Angeles Lakers":1960,
  "Milwaukee Bucks":1968,"Chicago Bulls":1966,
  "Seattle SuperSonics":1967,"Houston Rockets":1967,
  "Portland Trail Blazers":1970,"Cleveland Cavaliers":1970,
  "Golden State Warriors":1971,"Washington Bullets":1973,
  "San Antonio Spurs":1976,"Denver Nuggets":1976,
  "Dallas Mavericks":1980,"Miami Heat":1988,
  "Toronto Raptors":1995,"Oklahoma City Thunder":2008,
  "Memphis Grizzlies":2001,"New Orleans Pelicans":2013,
  "Brooklyn Nets":2012,"Charlotte Hornets":1988,
  "Minnesota Timberwolves":1989,"Orlando Magic":1989,
  "Sacramento Kings":1985,"Phoenix Suns":1968,"Utah Jazz":1974,
};

function buildChampionQuestions(champs,dateStr){
  const base=seedFromDate(dateStr);
  // RNG séparé par niveau → plus d'indépendance entre les groupes
  const rngE=mkRng(base);
  const rngM=mkRng(base+7919);
  const rngH=mkRng(base+104729);

  const nba=champs.filter(c=>c.year>=1950);
  const latest=Math.max(...nba.map(c=>c.year));

  // Pool dédupliqué par équipe (une seule entrée par franchise)
  const uniqueTeams=nba.filter((c,i,arr)=>arr.findIndex(x=>x.team===c.team)===i);

  const easyPool=nba.filter(c=>c.year>latest-10);
  const medPool=nba.filter(c=>c.year>latest-20&&c.year<=latest-10);
  const hardPool=nba.filter(c=>c.year<=latest-20);

  const mkQ=(champ,diff,rng)=>{
    const eraYear=TEAM_NBA_FROM[champ.team]||champ.year;
    // Mauvaises réponses : équipes différentes, qui existaient à l'époque, sans doublon
    const eraPool=uniqueTeams.filter(c=>
      c.team!==champ.team&&
      (TEAM_NBA_FROM[c.team]||c.year)<=champ.year
    );
    // Fallback si pas assez d'équipes de l'époque
    const pool=eraPool.length>=3?eraPool:uniqueTeams.filter(c=>c.team!==champ.team);
    const wrongs=rngSample(pool,3,rng);
    return{year:champ.year,answer:champ,diff,
      opts2:rngShuffle([champ,wrongs[0]],rng),
      opts4:rngShuffle([champ,...wrongs],rng)};
  };

  const mk=(pool,diff,fallback,rng)=>{
    const p=pool.length>=2?pool:fallback;
    // Éviter les doublons d'années dans les 2 questions du même niveau
    const picked=rngSample(p,2,rng);
    return picked.map(c=>mkQ(c,diff,rng));
  };

  return[
    ...mk(easyPool,'easy',nba.slice(-10),rngE),
    ...mk(medPool,'medium',nba.slice(-20,-10),rngM),
    ...mk(hardPool,'hard',nba.slice(0,Math.max(1,nba.length-20)),rngH),
  ];
}
function checkChampText(input,champ){
  const n=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim().replace(/\s+/g,' ');
  const inp=n(input);if(!inp)return false;
  const valid=[n(champ.team),n(champ.city),n(champ.nick),n(champ.city+' '+champ.nick),n(champ.abbr)];
  if(champ.nick==='Trail Blazers')valid.push('blazers','portland blazers');
  if(champ.nick==='SuperSonics')valid.push('sonics','seattle sonics');
  if(champ.nick==='Mavericks')valid.push('mavs','dallas mavs');
  if(champ.nick==='Cavaliers')valid.push('cavs','cleveland cavs');
  if(champ.nick==='Nationals')valid.push('nats');
  if(champ.city==='Golden State')valid.push('golden state','san francisco','oakland');
  if(champ.city==='Los Angeles'&&champ.nick==='Lakers')valid.push('la lakers','la');
  return valid.some(v=>v===inp);
}

function MiniGameChampion({firebaseUser,profile,setProfile}){
  const [phase,setPhase]=useState('loading');
  const [questions,setQuestions]=useState([]);
  const [currentQ,setCurrentQ]=useState(0);
  const [mode,setMode]=useState(null);
  const [answers,setAnswers]=useState([]);
  const [textInput,setTextInput]=useState('');
  const [feedback,setFeedback]=useState(null);
  const [todayResult,setTodayResult]=useState(null);
  const [champLeaderboard,setChampLeaderboard]=useState([]);
  const [selectedChampPlayer,setSelectedChampPlayer]=useState(null);

  const today=getMiniGameDate();
  const playKey='minigame_champion_'+today;
  const DIFF_MULT={easy:1,medium:2,hard:3};
  const DIFF_LABEL={easy:'🟢 Facile',medium:'🟡 Intermédiaire',hard:'🔴 Difficile'};
  const DIFF_COLOR={easy:'#22c55e',medium:'#eab308',hard:'#ef4444'};
  const MODE_PTS=(m,d)=>({double:1,quad:2,text:3}[m]*DIFF_MULT[d]);
  const MAX_SCORE=2*(3+6+9);

  useEffect(()=>{
    (async()=>{
      let champs=[...NBA_CHAMPIONS_DATA];
      const latest=Math.max(...champs.map(c=>c.year));
      const currY=new Date().getFullYear();
      if(latest<currY){const recent=await fetchRecentChampions(latest);champs=[...champs,...recent];}
      const existing=profile?.[playKey];
      if(existing?.completed){
        if(firebaseUser&&!existing.pointsAdded&&existing.score>0){
          try{
            const weekKey=getWeekKey(),monthKey=getMonthKey();
            const userRef=doc(db,'users',firebaseUser.uid);
            const userSnap=await getDoc(userRef);
            const userData=userSnap.exists()?userSnap.data():{};
            const total=existing.score;
            const newPoints=(userData.points||0)+total;
            const weekPts={...(userData.weekPts||{})};weekPts[weekKey]=(weekPts[weekKey]||0)+total;
            const monthPts={...(userData.monthPts||{})};monthPts[monthKey]=(monthPts[monthKey]||0)+total;
            const updated={...existing,pointsAdded:true};
            await updateDoc(userRef,{[playKey]:updated,points:newPoints,weekPts,monthPts});
            if(setProfile)setProfile(p=>({...p,[playKey]:updated,points:newPoints,weekPts,monthPts}));
            setTodayResult(updated);
          }catch(e){setTodayResult(existing);}
        }else{
          setTodayResult(existing);
        }
        setPhase('result');return;
      }
      setQuestions(buildChampionQuestions(champs,today));
      setPhase('intro');
    })();
  },[]);

  useEffect(()=>{
    if(phase!=='result')return;
    (async()=>{
      try{
        const snap=await getDocs(collection(db,'users'));
        const players=[];
        snap.forEach(d=>{
          const data=d.data();
          const entry=data[playKey];
          if(entry?.completed){
            players.push({id:d.id,pseudo:data.username||data.pseudo||'Joueur',score:entry.score||0,answers:entry.answers||[]});
          }
        });
        players.sort((a,b)=>b.score-a.score);
        setChampLeaderboard(players);
      }catch(e){}
    })();
  },[phase]);

  function handleChoice(chosen){
    if(feedback)return;
    const q=questions[currentQ];
    const ok=chosen.team===q.answer.team;
    const pts=ok?MODE_PTS(mode,q.diff):0;
    setFeedback({ok,pts,answer:q.answer});
    setAnswers(prev=>[...prev,{ok,pts,mode,diff:q.diff,year:q.year}]);
  }

  function handleTextSubmit(){
    if(feedback)return;
    const q=questions[currentQ];
    const ok=checkChampText(textInput,q.answer);
    const pts=ok?MODE_PTS('text',q.diff):0;
    setFeedback({ok,pts,answer:q.answer});
    setAnswers(prev=>[...prev,{ok,pts,mode:'text',diff:q.diff,year:q.year}]);
  }

  async function next(){
    if(currentQ+1>=questions.length){
      const total=answers.reduce((s,a)=>s+a.pts,0);
      const result={completed:true,score:total,date:today,answers,pointsAdded:true};
      setTodayResult(result);
      if(firebaseUser){
        try{
          const weekKey=getWeekKey(),monthKey=getMonthKey();
          const userRef=doc(db,'users',firebaseUser.uid);
          const userSnap=await getDoc(userRef);
          const userData=userSnap.exists()?userSnap.data():{};
          const newPoints=(userData.points||0)+total;
          const weekPts={...(userData.weekPts||{})};weekPts[weekKey]=(weekPts[weekKey]||0)+total;
          const monthPts={...(userData.monthPts||{})};monthPts[monthKey]=(monthPts[monthKey]||0)+total;
          await updateDoc(userRef,{[playKey]:result,points:newPoints,weekPts,monthPts});
          if(setProfile)setProfile(p=>({...p,[playKey]:result,points:newPoints,weekPts,monthPts}));
        }catch(e){}
      }
      setPhase('result');
    }else{
      setCurrentQ(c=>c+1);setMode(null);setFeedback(null);setTextInput('');
    }
  }

  if(phase==='loading')return<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>⏳ Chargement…</div>;

  if(phase==='result'){
    const score=todayResult?.score||0;
    const pct=Math.round((score/MAX_SCORE)*100);
    const medal=pct>=90?'🏆':pct>=70?'🥇':pct>=50?'🥈':pct>=30?'🥉':'💪';
    const resultAnswers=todayResult?.answers||answers;
    return(
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,color:'var(--gold)',letterSpacing:1}}>🏆 TROUVE LE CHAMPION</div>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:2}}>Résultat du jour</div>
        </div>
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:20,textAlign:'center'}}>
          <div style={{fontSize:56,marginBottom:8}}>{medal}</div>
          <div style={{fontSize:48,fontWeight:900,color:'var(--gold)',lineHeight:1}}>{score}</div>
          <div style={{fontSize:14,color:'var(--muted)',marginBottom:16}}>/ {MAX_SCORE} pts</div>
          <div style={{background:'var(--s2)',borderRadius:8,height:10,overflow:'hidden'}}>
            <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,var(--gold),var(--gold2))',borderRadius:8,transition:'width .6s ease'}}/>
          </div>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:8}}>{pct}% du score maximum</div>
        </div>
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16}}>
          <div style={{fontSize:12,color:'var(--gold)',fontWeight:800,letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>Détail des réponses</div>
          {resultAnswers.map((a,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<resultAnswers.length-1?'1px solid var(--bdr)':'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:18}}>{a.ok?'✅':'❌'}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--txt)'}}>NBA {a.year}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{DIFF_LABEL[a.diff]}</div>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:15,fontWeight:800,color:a.ok?'var(--green)':'var(--red)'}}>{a.ok?'+'+a.pts+' pts':'0 pt'}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>{a.mode==='double'?'2 choix':a.mode==='quad'?'4 choix':'Texte libre'}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16}}>
          <div style={{fontSize:12,color:'var(--gold)',fontWeight:800,letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>🏅 Classement du jour</div>
          {champLeaderboard.length===0?(
            <div style={{textAlign:'center',color:'var(--muted)',fontSize:13,padding:'12px 0'}}>Chargement…</div>
          ):champLeaderboard.map((p,i)=>{
            const isMe=firebaseUser&&p.id===firebaseUser.uid;
            const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':null;
            return(
              <div key={p.id} onClick={()=>setSelectedChampPlayer(selectedChampPlayer?.id===p.id?null:p)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:i<champLeaderboard.length-1?'1px solid var(--bdr)':'none',cursor:'pointer'}}>
                <div style={{width:28,textAlign:'center',fontSize:medal?18:13,fontWeight:800,color:'var(--muted)',flexShrink:0}}>{medal||('#'+(i+1))}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:isMe?'var(--gold)':'var(--txt)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.pseudo}{isMe?' (moi)':''}</div>
                </div>
                <div style={{fontSize:16,fontWeight:900,color:isMe?'var(--gold)':'var(--txt)',flexShrink:0}}>{p.score} <span style={{fontSize:11,color:'var(--muted)',fontWeight:500}}>pts</span></div>
                <div style={{fontSize:14,color:'var(--muted)',flexShrink:0,transition:'transform .2s',transform:selectedChampPlayer?.id===p.id?'rotate(90deg)':'none'}}>›</div>
              </div>
            );
          })}
        </div>

        {selectedChampPlayer&&(
          <div style={{background:'var(--s2)',border:'1.5px solid var(--gold)',borderRadius:16,padding:16}}>
            <div style={{fontSize:13,fontWeight:800,color:'var(--gold)',marginBottom:12}}>Réponses de {selectedChampPlayer.pseudo}</div>
            {selectedChampPlayer.answers.length===0?(
              <div style={{fontSize:12,color:'var(--muted)'}}>Aucun détail disponible</div>
            ):selectedChampPlayer.answers.map((a,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:i<selectedChampPlayer.answers.length-1?'1px solid var(--bdr)':'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{a.ok?'✅':'❌'}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--txt)'}}>NBA {a.year}</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{DIFF_LABEL[a.diff]}</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:14,fontWeight:800,color:a.ok?'var(--green)':'var(--red)'}}>{a.ok?'+'+a.pts+' pts':'0 pt'}</div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>{a.mode==='double'?'2 choix':a.mode==='quad'?'4 choix':'Texte libre'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{textAlign:'center',fontSize:13,color:'var(--muted)',padding:'4px 0 8px'}}>Reviens demain pour une nouvelle partie !</div>
      </div>
    );
  }

  if(phase==='intro')return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:22,fontWeight:800,color:'var(--gold)',letterSpacing:1}}>🏆 TROUVE LE CHAMPION</div>
        <div style={{fontSize:13,color:'var(--muted)',marginTop:4}}>1 partie par jour · 6 questions</div>
      </div>
      <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16}}>
        <div style={{fontSize:12,color:'var(--gold)',fontWeight:800,letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>Comment jouer</div>
        <div style={{fontSize:13,color:'var(--txt)',lineHeight:1.7,marginBottom:12}}>Devine quelle équipe a remporté le titre NBA pour chaque année. Pour chaque question, choisis ton mode de réponse avant de voir les options.</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {[
            {ico:'🎯',label:'2 choix',desc:'2 équipes proposées — moins de risque'},
            {ico:'🎲',label:'4 choix',desc:'4 équipes proposées — risque moyen'},
            {ico:'✍️',label:'Texte libre',desc:'Tape la réponse toi-même — haut risque'},
          ].map((m,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:'var(--s2)',borderRadius:12,padding:'10px 14px'}}>
              <span style={{fontSize:20}}>{m.ico}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--txt)'}}>{m.label}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16}}>
        <div style={{fontSize:12,color:'var(--gold)',fontWeight:800,letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>Barème des points</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:0,textAlign:'center'}}>
          <div/>
          <div style={{fontSize:11,color:'#22c55e',fontWeight:800,paddingBottom:8}}>🟢 Facile</div>
          <div style={{fontSize:11,color:'#eab308',fontWeight:800,paddingBottom:8}}>🟡 Inter.</div>
          <div style={{fontSize:11,color:'#ef4444',fontWeight:800,paddingBottom:8}}>🔴 Difficile</div>
          {[
            {ico:'🎯',label:'2 choix',pts:[1,2,3]},
            {ico:'🎲',label:'4 choix',pts:[2,4,6]},
            {ico:'✍️',label:'Texte',pts:[3,6,9]},
          ].map((row,i)=>[
            <div key={i+'l'} style={{fontSize:12,color:'var(--txt)',fontWeight:700,display:'flex',alignItems:'center',gap:5,padding:'9px 0',borderTop:'1px solid var(--bdr)'}}>{row.ico} {row.label}</div>,
            ...row.pts.map((p,j)=>(
              <div key={i+'p'+j} style={{fontSize:15,fontWeight:800,color:'var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',padding:'9px 0',borderTop:'1px solid var(--bdr)'}}>{p} pt{p>1?'s':''}</div>
            ))
          ])}
        </div>
        <div style={{marginTop:12,fontSize:12,color:'var(--muted)',textAlign:'center'}}>Score maximum · <span style={{color:'var(--gold)',fontWeight:800}}>{MAX_SCORE} pts</span></div>
      </div>
      <button onClick={()=>setPhase('playing')} style={{width:'100%',padding:'15px 0',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:14,color:'#000',fontSize:16,fontWeight:800,cursor:'pointer',letterSpacing:1}}>
        JOUER
      </button>
    </div>
  );

  const q=questions[currentQ];
  const diff=q.diff;
  const mult=DIFF_MULT[diff];
  const diffColor=DIFF_COLOR[diff];

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>Question {currentQ+1} / 6</div>
        <div style={{fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:20,background:`color-mix(in srgb,${diffColor} 15%,var(--s2))`,color:diffColor}}>{DIFF_LABEL[diff]}</div>
        <div style={{fontSize:13,fontWeight:800,color:'var(--gold)'}}>{answers.reduce((s,a)=>s+a.pts,0)} pts</div>
      </div>
      <div style={{background:'var(--s2)',borderRadius:4,height:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:(currentQ/6*100)+'%',background:'linear-gradient(90deg,var(--gold),var(--gold2))',borderRadius:4,transition:'width .4s'}}/>
      </div>

      <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:20,textAlign:'center'}}>
        <div style={{fontSize:11,color:'var(--muted)',letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>Champion NBA</div>
        <div style={{fontSize:64,fontWeight:900,color:'var(--gold)',letterSpacing:2,lineHeight:1}}>{q.year}</div>
        <div style={{fontSize:13,color:'var(--muted)',marginTop:8}}>Quelle équipe a remporté le titre ?</div>
      </div>

      {!mode&&!feedback&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:12,color:'var(--muted)',textAlign:'center',fontWeight:600,letterSpacing:.5}}>Choisis ton mode de réponse</div>
          {[
            {id:'double',ico:'🎯',label:'2 choix',pts:1*mult,risk:'Moins de risque',detail:'2 équipes te sont proposées, dont la bonne'},
            {id:'quad',ico:'🎲',label:'4 choix',pts:2*mult,risk:'Risque moyen',detail:'4 équipes te sont proposées, dont la bonne'},
            {id:'text',ico:'✍️',label:'Texte libre',pts:3*mult,risk:'Haut risque',detail:'Ville, surnom ou nom complet acceptés'},
          ].map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'var(--s1)',border:'1.5px solid var(--bdr)',borderRadius:14,cursor:'pointer',textAlign:'left',width:'100%'}}>
              <span style={{fontSize:24}}>{m.ico}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--txt)'}}>{m.label} <span style={{fontSize:11,color:'var(--muted)',fontWeight:500}}>— {m.risk}</span></div>
                <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{m.detail}</div>
              </div>
              <div style={{fontSize:20,fontWeight:900,color:'var(--gold)',whiteSpace:'nowrap'}}>+{m.pts} pts</div>
            </button>
          ))}
        </div>
      )}

      {mode&&!feedback&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {mode==='text'?(
            <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16}}>
              <input
                type="text" value={textInput} onChange={e=>setTextInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&textInput.trim()&&handleTextSubmit()}
                placeholder="Tape ta réponse…"
                style={{width:'100%',boxSizing:'border-box',padding:'14px 16px',background:'var(--s2)',border:'1.5px solid var(--bdr)',borderRadius:12,color:'var(--txt)',fontSize:15,outline:'none',marginBottom:12}}
                autoFocus
              />
              <button onClick={handleTextSubmit} disabled={!textInput.trim()} style={{width:'100%',padding:'13px 0',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:12,color:'#000',fontSize:15,fontWeight:800,cursor:'pointer',opacity:textInput.trim()?1:.4}}>
                VALIDER
              </button>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {(mode==='double'?q.opts2:q.opts4).map((opt,i)=>(
                <button key={i} onClick={()=>handleChoice(opt)} style={{padding:'16px',background:'var(--s1)',border:'1.5px solid var(--bdr)',borderRadius:14,color:'var(--txt)',fontSize:15,fontWeight:700,cursor:'pointer',textAlign:'center',width:'100%'}}>
                  {opt.city} {opt.nick}
                </button>
              ))}
            </div>
          )}
          <button onClick={()=>setMode(null)} style={{width:'100%',padding:'10px 0',background:'none',border:'1px solid var(--bdr)',borderRadius:12,color:'var(--muted)',fontSize:12,cursor:'pointer'}}>
            ← Changer de mode
          </button>
        </div>
      )}

      {feedback&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{textAlign:'center',padding:'22px 16px',background:feedback.ok?'color-mix(in srgb,#22c55e 10%,var(--s1))':'color-mix(in srgb,#ef4444 10%,var(--s1))',borderRadius:16,border:`1.5px solid ${feedback.ok?'#22c55e':'#ef4444'}`}}>
            <div style={{fontSize:44,marginBottom:8}}>{feedback.ok?'✅':'❌'}</div>
            <div style={{fontSize:17,fontWeight:800,color:feedback.ok?'#22c55e':'#ef4444',marginBottom:4}}>{feedback.ok?'Bonne réponse !':'Mauvaise réponse'}</div>
            {!feedback.ok&&<div style={{fontSize:15,color:'var(--txt)',marginBottom:4}}>{feedback.answer.team}</div>}
            <div style={{fontSize:26,fontWeight:900,color:'var(--gold)'}}>{feedback.ok?'+'+feedback.pts+' pts':'0 pt'}</div>
          </div>
          <button onClick={next} style={{width:'100%',padding:'14px 0',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:14,color:'#000',fontSize:15,fontWeight:800,cursor:'pointer'}}>
            {currentQ+1>=questions.length?'Voir mes résultats →':'Question suivante →'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Culture NBA ─── */
const NBA_CULTURE_DB=[
  // champion
  {q:'Quel équipe a remporté le titre NBA en 2016 ?',a:'Cleveland Cavaliers',cat:'champion',opts:['Golden State Warriors','Cleveland Cavaliers','San Antonio Spurs','Miami Heat']},
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
  {q:'Qui a remporté le DPOY 2025 ?',a:'Victor Wembanyama',cat:'dpoy',opts:['Rudy Gobert','Jaren Jackson Jr.','Bam Adebayo','Victor Wembanyama']},
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
  {q:'Qui a remporté le Coach de l\'Année 2025 ?',a:'Joe Mazzulla',cat:'coach_year',opts:['Mark Daigneault','Rick Carlisle','Ime Udoka','Joe Mazzulla']},
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
];

const CAT_LABEL={champion:'🏆 Champion',mvp:'🌟 MVP',finals_mvp:'🏅 MVP Finals',draft:'🎓 Draft',scoring:'📊 Scoreur',record:'📖 Record',roty:'🌱 Rookie',dpoy:'🛡️ Défenseur',coach:'👨‍💼 Coach',surnom:'🎭 Surnom',pays:'🌍 International',finales:'🥈 Finaliste',slam_dunk:'💥 Dunk Contest',coach_year:'📋 Coach of Year',arena:'🏟️ Arène'};

function MiniGameCulture({firebaseUser,profile,setProfile}){
  const today=getMiniGameDate();
  const playKey='minigame_culture_'+today;
  const [phase,setPhase]=useState('loading');
  const [questions,setQuestions]=useState([]);
  const [idx,setIdx]=useState(0);
  const [selected,setSelected]=useState(null);
  const [score,setScore]=useState(0);
  const [todayResult,setTodayResult]=useState(null);
  const PTS_Q=10;
  const NB_Q=10;

  useEffect(()=>{
    const existing=profile?.[playKey];
    if(existing?.completed){setTodayResult(existing);setPhase('result');return;}
    const shuffled=[...NBA_CULTURE_DB].sort(()=>Math.random()-.5).slice(0,NB_Q);
    setQuestions(shuffled);
    setPhase('play');
  },[]);

  async function handleAnswer(opt){
    if(selected!==null)return;
    setSelected(opt);
    const ok=opt===questions[idx].a;
    const newScore=score+(ok?PTS_Q:0);
    setTimeout(async()=>{
      if(idx+1>=NB_Q){
        const result={completed:true,score:newScore,date:today,pointsAdded:false};
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
        setIdx(i=>i+1);setSelected(null);setScore(newScore);
      }
    },900);
  }

  if(phase==='loading')return<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>⏳ Chargement…</div>;

  if(phase==='result'){
    const s=todayResult?.score||0;
    const pct=Math.round((s/(NB_Q*PTS_Q))*100);
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
          <div style={{fontSize:14,color:'var(--muted)',marginBottom:16}}>/ {NB_Q*PTS_Q} pts</div>
          <div style={{background:'var(--s2)',borderRadius:8,height:10,overflow:'hidden'}}>
            <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,var(--gold),var(--gold2))',borderRadius:8,transition:'width .6s ease'}}/>
          </div>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:8}}>{pct}% du score maximum</div>
        </div>
        <div style={{background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:16,padding:16,textAlign:'center'}}>
          <div style={{fontSize:13,color:'var(--muted)'}}>Revenez demain pour un nouveau quiz !</div>
        </div>
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

function MiniGameTrades({firebaseUser,profile,setProfile}){
  const isDev=process.env.NODE_ENV==='development';
  const now=new Date();
  const canPredict=isDev||(now>=new Date('2025-05-15')&&now<new Date('2025-06-15'));
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
        if(snap.exists())setAdminData(snap.data());
      }catch(e){}
    })();
  },[canSeeResults,firebaseUser]);

  function openPlayer(player){
    if(locked[player.id])return;
    if(!canPredict)return;
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

  return(
    <div>
      <div style={{fontSize:13,color:'var(--muted)',marginBottom:12,lineHeight:1.5,padding:'10px 14px',background:'var(--s1)',border:'1px solid var(--bdr)',borderRadius:12}}>
        {canPredict&&<span>🟢 Pronostics ouverts · Cliquez sur un joueur pour parier</span>}
        {!canPredict&&!canSeeResults&&<span>🔒 Pronostics fermés · Résultats le 1er septembre</span>}
        {canSeeResults&&<span>📊 Résultats disponibles</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {TRADES_PLAYERS.map(player=>{
          const isLocked=!!locked[player.id];
          const pred=predictions[player.id];
          return(
            <button key={player.id} onClick={()=>openPlayer(player)} disabled={isLocked||!canPredict} style={{padding:'10px 12px',background:'var(--s1)',border:`1.5px solid ${isLocked?'var(--gold)':'var(--bdr)'}`,borderRadius:12,cursor:isLocked||!canPredict?'default':'pointer',textAlign:'left',opacity:!canPredict&&!isLocked?.5:1,transition:'border-color .2s'}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--txt)',marginBottom:2,lineHeight:1.3}}>{player.name}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginBottom:isLocked?4:0}}>{player.team}</div>
              {isLocked&&pred&&(
                <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,marginTop:2}}>
                  {pred.stayed?'✅ Reste':'🔄 Part'}
                  {!pred.stayed&&pred.franchise&&<span> → {pred.franchise.split(' ').slice(-1)[0]}</span>}
                  {isLocked&&<span style={{marginLeft:4}}>🔒</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {overlay&&createPortal(
        <div ref={overlayRef} style={{position:'fixed',inset:0,background:'var(--bg)',zIndex:9999,overflowY:'auto',animation:'slideUp .3s ease'}}>
          <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px',paddingBottom:'max(32px,env(safe-area-inset-bottom))'}}>
            <button onClick={closeOverlay} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 20px',letterSpacing:.3}}>
              ← Retour
            </button>
            <div style={{fontSize:20,fontWeight:800,color:'var(--txt)',marginBottom:4}}>{overlay.player.name}</div>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:20}}>{overlay.player.team}</div>

            {confirmMsg&&<div style={{padding:'12px 16px',background:'var(--s1)',border:'1px solid var(--gold)',borderRadius:12,color:'var(--gold)',fontWeight:700,textAlign:'center',marginBottom:16}}>{confirmMsg}</div>}

            {overlay.step===1&&(
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--txt)',marginBottom:16}}>Ce joueur va-t-il rester dans sa franchise cet été ?</div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={()=>setOverlay(o=>({...o,stayed:true,step:3}))} style={{flex:1,padding:'16px',background:'color-mix(in srgb,var(--green) 10%,var(--s1))',border:'1.5px solid var(--green)',borderRadius:14,color:'var(--green)',fontSize:16,fontWeight:800,cursor:'pointer'}}>✅ Reste</button>
                  <button onClick={()=>setOverlay(o=>({...o,stayed:false,step:2}))} style={{flex:1,padding:'16px',background:'color-mix(in srgb,var(--red) 10%,var(--s1))',border:'1.5px solid var(--red)',borderRadius:14,color:'var(--red)',fontSize:16,fontWeight:800,cursor:'pointer'}}>🔄 Part</button>
                </div>
              </div>
            )}

            {overlay.step===2&&(
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

            {overlay.step===3&&(
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

function AdminTradesPanel({onClose}){
  const ADMIN_PWD='NBgAmes07310!';
  const [pwd,setPwd]=useState('');
  const [auth2,setAuth2]=useState(false);
  const [tab,setTab]=useState('answers');
  const [answers,setAnswers]=useState({});
  const [leaderboard,setLeaderboard]=useState([]);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState('');

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
  },[auth2]);

  async function saveAnswers(){
    setSaving(true);setMsg('');
    try{
      await setDoc(doc(db,'tradesAdmin','2025'),{answers,updatedAt:Date.now()},{merge:true});
      setMsg('✅ Sauvegardé !');
    }catch(e){setMsg('❌ Erreur');}
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
              {['answers','leaderboard'].map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'10px',background:tab===t?'var(--gold)':'var(--s1)',border:'none',borderRadius:10,color:tab===t?'#000':'var(--muted)',fontWeight:700,fontSize:13,cursor:'pointer'}}>
                  {t==='answers'?'Réponses':'Classement'}
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
                          <select value={a.franchise||''} onChange={e=>setAnswers(ans=>({...ans,[p.id]:{...ans[p.id],franchise:e.target.value}}))} style={{width:'100%',padding:'8px',background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,color:'var(--txt)',fontSize:12}}>
                            <option value=''>-- Destination --</option>
                            {NBA_TEAMS_LIST.map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={saveAnswers} disabled={saving} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',borderRadius:12,color:'#000',fontWeight:800,fontSize:15,cursor:saving?'default':'pointer'}}>
                  {saving?'Sauvegarde…':'💾 Sauvegarder'}
                </button>
                {msg&&<div style={{marginTop:8,textAlign:'center',fontSize:13,color:msg.startsWith('✅')?'var(--green)':'var(--red)'}}>{msg}</div>}
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
:root{--bg:#07090E;--s1:#0E1520;--s2:#141D2B;--bdr:#1A2640;--gold:#F5B800;--gold2:#FF8C00;--red:#E8365D;--green:#00D084;--blue:#4A9EFF;--orange:#FF6B35;--txt:#EEF2F7;--muted:#52677F;--c1:#552583;--c2:#FDB927;}
html,body{height:100%;background:#07090E;}
body{background:var(--bg);color:var(--txt);font-family:'Barlow',sans-serif;overscroll-behavior:none;}
#root{min-height:100%;background:var(--bg);}
input,button,select{font-family:'Barlow',sans-serif;}
.shell{display:flex;flex-direction:column;height:100vh;max-width:480px;margin:0 auto;position:relative;}
.scrollarea{flex:1;overflow-y:auto;padding-top:calc(56px + env(safe-area-inset-top, 0px));padding-bottom:82px;}
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
.auth-body{position:relative;z-index:1;display:flex;flex-direction:column;flex:1;padding:0 24px 36px;}
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
.ainput{width:100%;background:var(--s1);border:1.5px solid var(--bdr);color:var(--txt);font-size:15px;padding:14px 14px 14px 42px;border-radius:12px;outline:none;transition:border-color .2s;}
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
.aerr{background:color-mix(in srgb,var(--red) 12%,transparent);border:1px solid color-mix(in srgb,var(--red) 35%,transparent);color:var(--red);font-size:13px;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:8px;}
.aok{background:color-mix(in srgb,var(--green) 12%,transparent);border:1px solid color-mix(in srgb,var(--green) 35%,transparent);color:var(--green);font-size:13px;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:8px;}
.flink{text-align:center;font-size:13px;color:var(--muted);cursor:pointer;}
.flink span{color:var(--gold);}
.ob-wrap{min-height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;}
.ob-bg{position:absolute;inset:0;background:var(--bg);}
.ob-body{position:relative;z-index:1;display:flex;flex-direction:column;flex:1;padding:36px 24px 32px;}
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
.roster-select{width:100%;background:var(--s2);border:1.5px solid var(--bdr);color:var(--txt);font-size:14px;padding:12px 14px;border-radius:12px;outline:none;cursor:pointer;}
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
.modal-sheet{background:var(--bg);border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;animation:slideUp .3s ease;}
.modal-sheet::-webkit-scrollbar{display:none;}
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
  const [pronostics,setPronostics]=useState(null);
  const [pronosticStep,setPronosticStep]=useState(0);
  const [pronosticDone,setPronosticDone]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [sg,setSg]=useState({home:"",away:"",scorerPts:""});
  const [scoring,setScoring]=useState(null);
  const [scoringDone,setScoringDone]=useState(false);
  const [notifEnabled,setNotifEnabled]=useState(false);
  const [history,setHistory]=useState([]);
  const [showConfetti,setShowConfetti]=useState(false);
  const [openHistoryId,setOpenHistoryId]=useState(null);
  const [communityData,setCommunityData]=useState({});
  const [rankingPeriod,setRankingPeriod]=useState("global");
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
        if(p.scorer)scorer[p.scorer]=(scorer[p.scorer]||0)+1;
        if(p.homeScore!=null)homeScore[p.homeScore]=(homeScore[p.homeScore]||0)+1;
        if(p.awayScore!=null)awayScore[p.awayScore]=(awayScore[p.awayScore]||0)+1;
        if(p.scorerPts!=null)scorerPts[p.scorerPts]=(scorerPts[p.scorerPts]||0)+1;
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
        setPeriodLeaderboard(sorted.map((u,i)=>({...u,rank:i+1,displayPts:u[lastKey]?.scoring?.total||0})));
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

  useEffect(()=>{"Notification"in window&&Notification.permission==="granted"&&setNotifEnabled(true);},[]);
  async function toggleNotif(){if(notifEnabled){setNotifEnabled(false);return;}const g=await requestNotifPermission();setNotifEnabled(g);if(!g)alert("Autorisez les notifications dans les réglages.");}

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
        const snap=await getDoc(doc(db,"users",fbUser.uid));
        if(snap.exists()){
          setProfile(snap.data());
          setProfileLoadVersion(v=>v+1);
          // Si biométrie activée → écran de verrouillage (uniquement au premier chargement)
          const hasBiometric=!!localStorage.getItem("nbgames_biometric");
          setScreen(prev=>prev==="app"?"app":hasBiometric?"biometric":"app");
        }else setScreen("onboard");
      }
      else{setFirebaseUser(null);setProfile(null);setScreen("auth");}
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
    if(featured?.home&&featured?.away){
      const homeId=ESPN_TEAM_IDS[featured.home],awayId=ESPN_TEAM_IDS[featured.away];
      if(homeId&&awayId){setRosterLoading(true);const[homeR,awayR]=await Promise.all([fetchTeamRoster(homeId),fetchTeamRoster(awayId)]);setRosterHome(homeR.sort((a,b)=>a.localeCompare(b)));setRosterAway(awayR.sort((a,b)=>a.localeCompare(b)));setRosterLoading(false);}
    }
    setMatchLoading(false);
  },[notifEnabled,t]);

  const updateLiveScore=useCallback(async()=>{
    if(!featuredMatch?.id)return;
    const updated=await fetchLiveScore(featuredMatch.id);if(!updated)return;
    const prev=prevScoreRef.current;
    if(prev&&(updated.homeScore!==prev.home||updated.awayScore!==prev.away))setLiveScoreKey(k=>k+1);
    prevScoreRef.current={home:updated.homeScore,away:updated.awayScore};
    setFeaturedMatch(p=>p?{...p,homeScore:updated.homeScore,awayScore:updated.awayScore,isFinished:updated.isFinished,isLive:updated.isLive,topScorer:updated.topScorer,topScorerPts:updated.topScorerPts}:p);
    setLastMatch(p=>p?.id===updated.id?{...p,homeScore:updated.homeScore,awayScore:updated.awayScore,isFinished:updated.isFinished,isLive:updated.isLive,topScorer:updated.topScorer,topScorerPts:updated.topScorerPts,topScorers:updated.topScorers||[]}:p);
    if(updated.isFinished&&!autoCalcDoneRef.current[updated.id]){autoCalcDoneRef.current[updated.id]=true;autoCalculateAllUsers(updated,t);}
  },[featuredMatch?.id,t]);

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
    else{setPronostics(null);setPronosticStep(0);setPronosticDone(false);setEditMode(false);setScoring(null);setScoringDone(false);setSg({home:"",away:"",scorerPts:""});}
  },[featuredMatch?.id,firebaseUser?.uid,profileLoadVersion]); // eslint-disable-line

  useEffect(()=>{
    if(!pronosticDone||scoringDone||!featuredMatch?.isFinished||!pronostics)return;
    async function go(){
      let match=featuredMatch;
      if(match.id&&!match.id.startsWith("f")){const r=await fetchMatchResult(match.id);if(r?.topScorer){match={...match,...r};setFeaturedMatch(m=>({...m,...r}));}}
      const sr=computePronosticScore(pronostics,match,t);
      setScoring(sr);setScoringDone(true);
      if(sr.total>0){setShowConfetti(true);setTimeout(()=>setShowConfetti(false),4000);}
      if(firebaseUser){
        const key="pronostic_"+match.id;const newPts=(profile?.points||0)+sr.total;
        const weekKey=getWeekKey(),monthKey=getMonthKey();
        const weekPts={...(profile?.weekPts||{})};weekPts[weekKey]=(weekPts[weekKey]||0)+sr.total;
        const monthPts={...(profile?.monthPts||{})};monthPts[monthKey]=(monthPts[monthKey]||0)+sr.total;
        const updated={[key]:{...pronostics,scoring:sr},points:newPts,weekPts,monthPts,lastMatchPts:sr.total,lastMatchId:match.id};
        await updateDoc(doc(db,"users",firebaseUser.uid),updated);
        setProfile(p=>({...p,...updated}));
      }
    }
    go();
  },[featuredMatch,pronosticDone,scoringDone,pronostics,firebaseUser,profile,t]);

  useEffect(()=>{const iv=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(iv);},[]);

  const match=canReveal?featuredMatch:lastMatch;
  const lockTime=match?.tipoff?getLockTime(match.tipoff):null;
  const alertTime=match?.tipoff?getAlertTime(match.tipoff):null;
  const tipoffTime=match?.tipoff?new Date(match.tipoff):null;
  const msToLock=lockTime?lockTime-now:Infinity;
  const isLocked=lockTime?now>=lockTime:false;
  const isFinished=match?.isFinished||(tipoffTime?now>=tipoffTime:false);
  const isLive=match?.isLive||false;
  const isWarning=alertTime?(!isLocked&&now>=alertTime):false;
  const currentScoring=(pronosticDone&&scoring&&featuredMatch?.id===match?.id)?scoring:null;

  useEffect(()=>{
    if(isWarning&&!isLocked&&!alertShownRef.current&&!alertDismissed&&screen==="app"&&match){
      alertShownRef.current=true;setShowAlert(true);
      if(notifEnabled)sendNotif(t.notifClosing,`${match.home} vs ${match.away}`);
      setTimeout(()=>setShowAlert(false),6000);
    }
  },[isWarning,isLocked,screen,alertDismissed,match,notifEnabled,t]);

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
    if(!form.email||!form.password){setErr(t.errFill);doShake();return;}
    if(!form.email.includes("@")){setErr(t.errEmail);doShake();return;}
    if(form.password.length<6){setErr(t.errPwd);doShake();return;}
    setLoading(true);
    try{
      await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence);
      if(mode==="signup")await createUserWithEmailAndPassword(auth,form.email,form.password);
      else await signInWithEmailAndPassword(auth,form.email,form.password);
      if(remember&&rememberDays>0){
        const expiry=Date.now()+(rememberDays*24*60*60*1000);
        localStorage.setItem("nbgames_session_expiry",String(expiry));
      }else{
        localStorage.removeItem("nbgames_session_expiry");
      }
    }
    catch(e){const msgs={"auth/email-already-in-use":t.errUsed,"auth/user-not-found":t.errNotFound,"auth/wrong-password":t.errWrongPwd,"auth/invalid-credential":t.errInvalid,"auth/too-many-requests":t.errTooMany};setErr(msgs[e.code]||t.errGeneric);doShake();}
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
    setErr("");setLoading(true);
    try{
      const provider=new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      await signInWithPopup(auth,provider);
    }
    catch(e){
      if(e.code!=="auth/popup-closed-by-user")setErr("Connexion Apple échouée.");
    }
    setLoading(false);
  }

  async function doReset(){
    setResetErr("");setResetMsg("");
    if(!resetEmail||!resetEmail.includes("@")){setResetErr(t.errEmail);return;}
    setResetLoading(true);
    try{
      await sendPasswordResetEmail(auth,resetEmail);
      setResetMsg("📬 Email envoyé ! Vérifie ta boîte mail.");
    }catch(e){
      const msgs={"auth/user-not-found":t.errNotFound,"auth/too-many-requests":t.errTooMany};
      setResetErr(msgs[e.code]||t.errGeneric);
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

  async function doLogout(){await signOut(auth);setTab("match");setPronostics(null);setPronosticStep(0);setEditMode(false);setPronosticDone(false);setSg({home:"",away:"",scorerPts:""});setScoring(null);setScoringDone(false);setRosterHome([]);setRosterAway([]);setHistory([]);}

  async function persistStep(data){
    if(!firebaseUser||!match)return;
    const key="pronostic_"+match.id;const enriched={...data,home:match.home,away:match.away,tipoff:match.tipoff};
    await updateDoc(doc(db,"users",firebaseUser.uid),{[key]:enriched});setProfile(p=>({...p,[key]:enriched}));
  }

  function doneEditing(){setEditMode(false);setPronosticDone(true);}
  function submitWinner(team){const d={...pronostics,w:team,step:1};setPronostics(d);persistStep(d);if(editMode){doneEditing();}else{setPronosticStep(1);}}
  function submitScore(){const d={...pronostics,homeScore:sg.home,awayScore:sg.away,step:2};setPronostics(d);persistStep(d);if(editMode){doneEditing();}else{setPronosticStep(2);}}
  function submitScorer(n){const d={...pronostics,scorer:n,step:3};setPronostics(d);persistStep(d);if(editMode){doneEditing();}else{setPronosticStep(3);}}
  function submitScorerPts(){
    const d={...pronostics,scorerPts:sg.scorerPts,step:4,done:true};setPronostics(d);setPronosticDone(true);setEditMode(false);
    const alreadyDone=pronostics?.done===true;
    const newStreak=alreadyDone?(profile?.streak||0):(profile?.streak||0)+1;
    const key="pronostic_"+match.id;const enriched={...d,home:match.home,away:match.away,tipoff:match.tipoff};
    if(firebaseUser){updateDoc(doc(db,"users",firebaseUser.uid),{[key]:enriched,streak:newStreak,lastBetDate:getSessionDate()});setProfile(p=>({...p,[key]:enriched,streak:newStreak,lastBetDate:getSessionDate()}));}
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
          <div className="ig"><span className="iico">✉️</span><input className="ainput" type="email" placeholder={t.email} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doAuth()}/></div>
          <div className="ig"><span className="iico">🔒</span><input className="ainput" type={showPwd?"text":"password"} placeholder={t.password} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doAuth()}/><button className="ptoggle" onClick={()=>setShowPwd(p=>!p)}>{showPwd?"🙈":"👁️"}</button></div>
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
          <div className="divrow"><div className="divline"/><span className="divtxt">{t.or}</span><div className="divline"/></div>
          <div style={{display:"flex"}}><button className="sbtn" style={{flex:1}} onClick={doGoogle} disabled={loading}><GoogleIcon size={18}/> {t.google}</button></div>
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
          <div><div className="topnav-pseudo">{profile?.username}</div><div className="topnav-streak">🔥 {myStreak}</div></div>
        </div>
        <span style={{fontWeight:900,fontSize:24,letterSpacing:2,color:"var(--gold)"}}>NBgAmes</span>
        <div className={"ptsbadge "+(franchiseMode?"franchise":"")}>⭐ {globalPts.toLocaleString()} {t.pts}</div>
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

                    {(!isLocked||editMode)&&!pronosticDone&&match.tipoff&&(
                      <div>
                        {!editMode&&<div className="pbar"><div className={"pfill "+(franchiseMode?"franchise-fill":"")} style={{width:((pronosticStep/4)*100)+"%"}}/></div>}
                        {editMode&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><button onClick={()=>{setEditMode(false);setPronosticDone(true);}} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:13}}>{t.cancelEdit}</button><span style={{fontSize:12,color:"var(--gold)",fontWeight:700}}>{t.editMode}</span></div>}

                        {/* Tendances toujours visibles */}
                        {showQ0&&(
                          <div className="qcard ani">
                            <TrendSection matchId={match.id} match={match} step={0} t={t}/>
                            <div className="qlbl">{editMode?t.modify:t.q1}</div><div className="ppill">+50 {t.pts}</div><div className="qq">{t.q1Text}</div>
                            <div className="qopts">{[match.home,match.away].map(tm=><button key={tm} className="qopt" onClick={()=>submitWinner(tm)}><TeamBadge team={getTeam(tm)} size={24}/><span style={{marginLeft:6}}>{getTeam(tm).name}</span></button>)}</div>
                          </div>
                        )}
                        {showQ1&&(
                          <div className="qcard ani">
                            <TrendSection matchId={match.id} match={match} step={1} t={t}/>
                            <div className="qlbl">{editMode?t.modify:t.q2}</div><div className="ppill">2 exacts +500 · 1 exact +200 · ±1 +100</div><div className="qq">{t.q2Text}</div>
                            <div className="sinrow">
                              <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{match.home}</div><input className="sin" type="number" placeholder="0" value={sg.home} onChange={e=>setSg(s=>({...s,home:e.target.value}))}/></div>
                              <div className="sdash">-</div>
                              <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{match.away}</div><input className="sin" type="number" placeholder="0" value={sg.away} onChange={e=>setSg(s=>({...s,away:e.target.value}))}/></div>
                            </div>
                            <button className={"sbmit "+(franchiseMode?"franchise-btn":"")} onClick={submitScore} disabled={!sg.home||!sg.away}>{t.validateScore}</button>
                          </div>
                        )}
                        {showQ2&&(
                          <div className="qcard ani">
                            <TrendSection matchId={match.id} match={match} step={2} t={t}/>
                            <div className="qlbl">{editMode?t.modify:t.q3}</div><div className="ppill">+100 {t.pts}</div><div className="qq">{t.q3Text}</div>
                            {rosterLoading?<div style={{color:"var(--muted)",textAlign:"center",padding:16,fontSize:14}}>{t.loadingPlayers}</div>:(
                              <div>
                                <div className="roster-block"><div className="roster-label"><TeamBadge team={homeTeam} size={20}/><span style={{fontSize:12,fontWeight:700,color:"var(--muted)",letterSpacing:1}}>{match.home}</span></div><select className="roster-select" defaultValue="" onChange={e=>{if(e.target.value)submitScorer(e.target.value);}}><option value="" disabled>{t.choosePlayer}</option>{rosterHome.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
                                <div className="roster-block"><div className="roster-label"><TeamBadge team={awayTeam} size={20}/><span style={{fontSize:12,fontWeight:700,color:"var(--muted)",letterSpacing:1}}>{match.away}</span></div><select className="roster-select" defaultValue="" onChange={e=>{if(e.target.value)submitScorer(e.target.value);}}><option value="" disabled>{t.choosePlayer}</option>{rosterAway.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
                              </div>
                            )}
                          </div>
                        )}
                        {showQ3&&(
                          <div className="qcard ani">
                            <TrendSection matchId={match.id} match={match} step={3} t={t}/>
                            <div className="qlbl">{editMode?t.modify:t.q4}</div><div className="ppill">Exact +200 · ±1 +100 · ±2 +50 · ±3 +30</div><div className="qq">{t.q4Text}</div>
                            <div className="sinrow"><div style={{textAlign:"center"}}><div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{t.pts}</div><input className="sin-pts" type="number" placeholder="0" value={sg.scorerPts} onChange={e=>setSg(s=>({...s,scorerPts:e.target.value}))}/></div></div>
                            <button className={"sbmit "+(franchiseMode?"franchise-btn":"")} onClick={submitScorerPts} disabled={!sg.scorerPts}>{t.validate}</button>
                          </div>
                        )}
                      </div>
                    )}

                    {pronosticDone&&!currentScoring&&(
                      <div className="qcard ani">
                        <div style={{fontSize:36,marginBottom:8,textAlign:"center"}}>⏳</div>
                        <div style={{fontSize:22,fontWeight:800,color:"var(--gold)",marginBottom:4,textAlign:"center"}}>{t.betsRegistered}</div>
                        <div style={{fontSize:12,color:isLocked?"var(--red)":"var(--muted)",marginBottom:14,textAlign:"center"}}>{isLocked?t.lockedHint:t.modifyHint}</div>
                        <div style={{background:"var(--s2)",borderRadius:12,overflow:"hidden"}}>
                          {[{l:t.myBets,v:pronostics?.w,step:0},{l:t.myScore,v:(pronostics?.homeScore||"?")+" - "+(pronostics?.awayScore||"?"),step:1},{l:t.myScorer,v:pronostics?.scorer,step:2},{l:t.myScorerPts,v:pronostics?.scorerPts,step:3}].map((r,i)=>(
                            <div key={i} className="edit-row" style={isLocked?{cursor:"default"}:{}} onClick={!isLocked?()=>{setEditMode(true);setPronosticDone(false);setPronosticStep(r.step);}:undefined}>
                              <span style={{color:"var(--muted)",fontSize:13}}>{r.l}</span>
                              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:600,fontSize:13}}>{r.v||"—"}</span><span style={{fontSize:12}}>{isLocked?"🔒":"✏️"}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          {/* Bouton historique */}
          <button onClick={()=>{setShowHistory(true);setOpenHistoryId(null);setCommunityData({});}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",marginTop:16,padding:"13px 0",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:14,color:"var(--txt)",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:.5}}>
            📋 {t.history} <span style={{fontSize:12,color:"var(--muted)",fontWeight:500}}>({history.length} {history.length<=1?t.matchesPlayed:t.matchesPlayedP})</span>
          </button>
          </div>
        )}

        {/* MINI-JEUX */}
        {tab==="minigames"&&(
          <div className="sec ani">
            {miniGamePage==="champion"?(
              <div>
                <button onClick={()=>setMiniGamePage(null)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 16px',letterSpacing:.3}}>
                  ← Mini-jeux
                </button>
                <MiniGameChampion firebaseUser={firebaseUser} profile={profile} setProfile={setProfile}/>
              </div>
            ):miniGamePage==="culture"?(
              <div>
                <button onClick={()=>setMiniGamePage(null)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 16px',letterSpacing:.3}}>
                  ← Mini-jeux
                </button>
                <MiniGameCulture firebaseUser={firebaseUser} profile={profile} setProfile={setProfile}/>
              </div>
            ):miniGamePage==="trades"?(
              <div>
                <button onClick={()=>setMiniGamePage(null)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:600,cursor:'pointer',padding:'0 0 16px',letterSpacing:.3}}>
                  ← Mini-jeux
                </button>
                <MiniGameTrades firebaseUser={firebaseUser} profile={profile} setProfile={setProfile}/>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:12,color:'var(--muted)',fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',marginBottom:4}}>Mini-jeux</div>
                {[
                  {id:'champion',ico:'🏆',title:'Trouve le Champion',desc:'Retrouve le champion NBA de chaque année · 6 questions · 1 fois par jour',pts:'36 pts max',color:'var(--gold)'},
                  {id:'culture',ico:'🧠',title:'Culture NBA',desc:'Quiz culture générale NBA · 10 questions · 1 fois par jour',pts:'100 pts max',color:'var(--blue)'},
                  {id:'trades',ico:'🔄',title:"Trades de l'été",desc:"Pronostique les trades de l'été 2025 · 50 joueurs · Résultats en septembre",pts:'Classement',color:'var(--orange)'},
                ].map(g=>{
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
              {[{id:"global",lbl:t.rankingGlobal},{id:"lastmatch",lbl:t.rankingLastMatch},{id:"week",lbl:t.rankingWeek},{id:"month",lbl:t.rankingMonth}].map(rp=>(
                <button key={rp.id} className={"ranking-tab "+(rankingPeriod===rp.id?"on":"")} onClick={()=>setRankingPeriod(rp.id)}>{rp.lbl}</button>
              ))}
            </div>
            <div className="card">
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:12,fontWeight:600}}>{t.realtime}</div>
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
              {rankingPeriod!=="global"&&(
                periodLeaderboard.length===0
                  ?<div style={{textAlign:"center",color:"var(--muted)",padding:"20px 0",fontSize:14}}>{t.noRankingData}</div>
                  :periodLeaderboard.map((p,i)=>{
                    const isClickable=rankingPeriod==="lastmatch";
                    const betKey=p.lastMatchId?"pronostic_"+p.lastMatchId:null;
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
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:18,fontWeight:800,letterSpacing:1,color:"var(--gold)"}}>{t.history.toUpperCase()}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,color:"var(--muted)"}}>{history.length} {history.length<=1?t.matchesPlayed:t.matchesPlayedP}</span>
                <button onClick={()=>setShowHistory(false)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:20,cursor:"pointer",padding:"0 4px",lineHeight:1}}>✕</button>
              </div>
            </div>
            {history.length===0&&<div className="no-games"><div style={{fontSize:36,marginBottom:10}}>📋</div><div style={{fontSize:18,fontWeight:800,color:"var(--gold)",marginBottom:6}}>{t.noHistory}</div><div style={{fontSize:13,color:"var(--muted)"}}>{t.noHistoryDesc}</div></div>}
            {history.map((entry,i)=>{
              const hasResult=!!entry.scoring,total=entry.scoring?.total||0;
              const lm=lastMatch?.id===entry.matchId?lastMatch:null;
              const home=entry.home||lm?.home||"?",away=entry.away||lm?.away||"?";
              const matchDate=entry.tipoff?fmtDate(entry.tipoff):"";
              const realScore=entry.scoring?.breakdown?.[1]?.real||"";
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
        {tab==="profile"&&(
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
          </div>
        )}
      </div>

      {showAdminTrades&&<AdminTradesPanel onClose={()=>setShowAdminTrades(false)}/>}

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
              {icon:"🏀",title:"Le principe",body:"Chaque soir, un match NBA est tiré au sort. Tu as jusqu'à 1h avant le tip-off pour poser tes 4 pronostics. Les points sont calculés automatiquement une fois le match terminé."},
              {icon:"🔒",title:"Clôture des paris",body:"Les paris ferment exactement 1 heure avant le début du match. Passé ce délai, aucune modification n'est possible. Une alerte te prévient 30 minutes avant la fermeture."},
              {icon:"🏆",title:"Question 1 — Vainqueur",body:"Choisis l'équipe qui remporte le match.\n✅ Bonne réponse : +50 pts"},
              {icon:"🎯",title:"Question 2 — Score final",body:"Pronostique le score exact des deux équipes.\n✅ Score exact des deux : +500 pts\n✅ Un seul score exact : +200 pts (+ bonus proximité sur l'autre)\n~ Proximité ±1 pt : +100 · ±2 : +50 · ±3 : +30 · ±4 : +20 · ±5 : +10"},
              {icon:"⭐",title:"Question 3 — Meilleur scoreur",body:"Désigne le joueur qui marquera le plus de points dans le match.\n✅ Bonne réponse : +100 pts"},
              {icon:"📊",title:"Question 4 — Points du scoreur",body:"Estime le total de points du meilleur scoreur.\n✅ Exact : +200 pts\n~ Proximité ±1 pt : +100 · ±2 : +50 · ±3 : +30 · ±4 : +20 · ±5 : +10"},
              {icon:"🌟",title:"Bonus PARFAIT",body:"Si tu réussis les 4 questions à la perfection (scores exacts + bon scoreur + pts exacts), ton total est multiplié par ×2 !"},
              {icon:"🔥",title:"Streak",body:"Ta flamme augmente de 1 à chaque paris posé. Elle repart à 0 si tu rates un match sans parier."},
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