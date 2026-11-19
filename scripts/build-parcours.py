"""Construit src/parcoursData.js : parcours (franchises + années) de joueurs NBA connus.
Source : ESPN (statistiques saison par saison). Relancer pour mettre à jour en début de saison :
    python3 scripts/build-parcours.py
"""
import json, re, sys, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

NAMES = """LeBron James|Kevin Durant|James Harden|Chris Paul|Russell Westbrook|Kyrie Irving|Paul George|Kawhi Leonard|Jimmy Butler|Anthony Davis|DeMar DeRozan|Damian Lillard|Carmelo Anthony|Dwight Howard|Rajon Rondo|Blake Griffin|Kevin Love|Kemba Walker|Al Horford|Kyle Lowry|Mike Conley|Jrue Holiday|Bradley Beal|Karl-Anthony Towns|Rudy Gobert|Zach LaVine|Brandon Ingram|Donovan Mitchell|Dejounte Murray|Pascal Siakam|Domantas Sabonis|Tyrese Haliburton|De'Aaron Fox|Lauri Markkanen|Jordan Clarkson|Dennis Schroder|Kristaps Porzingis|Luka Doncic|Jalen Brunson|Mikal Bridges|OG Anunoby|Julius Randle|Andrew Wiggins|D'Angelo Russell|Spencer Dinwiddie|Malcolm Brogdon|Fred VanVleet|Kentavious Caldwell-Pope|Danny Green|Kyle Korver|Lou Williams|Jamal Crawford|Jeff Green|Tobias Harris|Gordon Hayward|Nicolas Batum|Evan Fournier|Rudy Gay|Harrison Barnes|Eric Gordon|Derrick Rose|Isaiah Thomas|Victor Oladipo|Lonzo Ball|Bojan Bogdanovic|Bogdan Bogdanovic|Jusuf Nurkic|Jonas Valanciunas|Steven Adams|Clint Capela|Jarrett Allen|Myles Turner|Buddy Hield|CJ McCollum|Collin Sexton|Terry Rozier|Marcus Smart|Ben Simmons|Seth Curry|Patrick Beverley|Serge Ibaka|Marc Gasol|Pau Gasol|Tony Parker|Boris Diaw|Joakim Noah|Luol Deng|Tyson Chandler|Goran Dragic|Ricky Rubio|Kelly Oubre Jr.|Montrezl Harrell|DeAndre Jordan|Andre Drummond|Hassan Whiteside|Josh Smith|Paul Millsap|Joe Johnson|Vince Carter|Tracy McGrady|Allen Iverson|Shaquille O'Neal|Steve Nash|Jason Kidd|Ray Allen|Kevin Garnett|Paul Pierce|Chauncey Billups|Ben Wallace|Rasheed Wallace|Gilbert Arenas|Baron Davis|Amar'e Stoudemire|Shawn Marion|Jason Terry|Antawn Jamison|Elton Brand|Zach Randolph|Mike Bibby|Peja Stojakovic|Chris Webber|Grant Hill|Penny Hardaway|Gary Payton|Karl Malone|Hakeem Olajuwon|Scottie Pippen|Dennis Rodman|Patrick Ewing|Charles Barkley|Dikembe Mutombo|Alonzo Mourning|Glen Rice|Latrell Sprewell|Stephon Marbury|Jermaine O'Neal|Metta World Peace|Lamar Odom|Derek Fisher|Robert Horry|Richard Hamilton|Tayshaun Prince|Andre Iguodala|Monta Ellis|Stephen Jackson|Al Jefferson|Carlos Boozer|Deron Williams|Brook Lopez|Andre Miller|Mike Miller|Shane Battier|Kevin Martin|Corey Maggette|Marcus Camby|Ben Gordon|Kirk Hinrich|Danilo Gallinari|Nikola Vucevic|Aaron Gordon|Jerami Grant|Christian Wood|Malik Monk|Norman Powell|Terrence Ross|Kevin Huerter|John Collins|Michael Porter Jr.|DeMarcus Cousins|Lance Stephenson|Michael Beasley|Nick Young|JaVale McGee|JR Smith|Tim Hardaway Jr.|Dwyane Wade|Chris Bosh|Jordan Poole|Josh Hart|Kevin Porter Jr.|Jalen Green|Dillon Brooks|Kyle Kuzma|Desmond Bane|Jaren Jackson Jr.|Ja Morant|Anfernee Simons|Jerami Grant|Khris Middleton|Brook Lopez|Nikola Mirotic|Rodney Hood|Derrick Favors|Joe Ingles|Mike Scott|Wesley Matthews|Trevor Ariza|Thaddeus Young|Marvin Williams|Jeremy Lin|Brandon Jennings|Ty Lawson|Jameer Nelson|Tyreke Evans|Michael Carter-Williams|Elfrid Payton|Emmanuel Mudiay|Dante Exum|Andrew Bogut|Zaza Pachulia|David West|Roy Hibbert|George Hill|Darren Collison|Aaron Brooks|Mario Chalmers|Shabazz Muhammad|Jahlil Okafor|Nerlens Noel|Mason Plumlee|Cody Zeller|Kemba Walker|Frank Ntilikina|Rui Hachimura|Josh Giddey|Cam Reddish|Deandre Ayton|Marvin Bagley III|Jaren Jackson Jr.|Trae Young|Bam Adebayo|Jamal Murray|Nikola Jokic|Giannis Antetokounmpo|Stephen Curry|Klay Thompson|Draymond Green|Devin Booker|Chris Mullin|Mitch Richmond|Tim Hardaway|Kevin Johnson|Mark Jackson|Rod Strickland|Nick Van Exel|Sam Cassell|Steve Francis|Cuttino Mobley|Jalen Rose|Antoine Walker|Glenn Robinson|Juwan Howard|Rasheed Wallace|Shareef Abdur-Rahim|Jerry Stackhouse|Jamal Mashburn|Ron Harper|Horace Grant|Toni Kukoc|Vlade Divac|Detlef Schrempf|Clyde Drexler|Dominique Wilkins|Moses Malone|Kareem Abdul-Jabbar|Wilt Chamberlain|Oscar Robertson"""
NAMES = list(dict.fromkeys(n.strip() for n in NAMES.split("|") if n.strip()))

# Franchise ESPN → abréviation de l'app (NBA_TEAMS)
FR = {"1":"ATL","2":"BOS","3":"NOP","4":"CHI","5":"CLE","6":"DAL","7":"DEN","8":"DET","9":"GSW","10":"HOU","11":"IND","12":"LAC","13":"LAL","14":"MIA","15":"MIL","16":"MIN","17":"BKN","18":"NYK","19":"ORL","20":"PHI","21":"PHX","22":"POR","23":"SAC","24":"SAS","25":"OKC","26":"UTA","27":"WAS","28":"TOR","29":"MEM","30":"CHA"}
# Noms historiques selon l'année de fin de saison (le logo reste celui de la franchise actuelle)
def label(fr, end):
    if fr == "OKC" and end <= 2008: return "Seattle"
    if fr == "BKN" and end <= 2012: return "New Jersey"
    if fr == "MEM" and end <= 2001: return "Vancouver"
    if fr == "NOP" and end <= 2002: return "Charlotte"   # Hornets 1988-2002 (franchise relocalisée)
    if fr == "WAS" and end <= 1997: return "Washington Bullets"
    if fr == "SAC" and end <= 1985: return "Kansas City"
    if fr == "LAC" and end <= 1984: return "San Diego"
    return None

UA = {"User-Agent": "Mozilla/5.0"}
def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)

def resolve(name):
    q = urllib.parse.quote(name)
    j = get(f"https://site.web.api.espn.com/apis/search/v2?query={q}&limit=5&type=player")
    for r in j.get("results", []):
        for c in r.get("contents", []):
            web = c.get("link", {}).get("web", "")
            m = re.search(r"/nba/player/_/id/(\d+)", web)
            if m: return m.group(1), c.get("displayName", name)
    return None, name

def career(pid):
    j = get(f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{pid}/stats?region=us&lang=en")
    rows = []
    for cat in j.get("categories", []):
        if cat.get("name") != "averages": continue
        for s in cat.get("statistics", []):
            tid = s.get("teamId"); yr = s.get("season", {}).get("year")
            if tid in FR and yr: rows.append((int(yr), FR[tid], s.get("position", "")))
    return rows

def build(name):
    try:
        pid, disp = resolve(name)
        if not pid: return None, f"introuvable : {name}"
        rows = career(pid)
        if not rows: return None, f"sans stats : {name}"
        stints = []
        for yr, fr, _ in rows:   # déjà dans l'ordre chronologique (transferts en cours de saison inclus)
            lb = label(fr, yr)   # un déménagement de franchise ouvre une nouvelle étape
            last = stints[-1] if stints else None
            if last and last["f"] == fr and last.get("h") == lb and yr - last["e"] <= 2:
                last["e"] = yr
                continue
            # Arrivée en cours de saison (transfert de décembre à février) : on date de l'année civile du transfert
            midseason = bool(last) and last["e"] == yr
            st = {"f": fr, "s": yr if midseason else yr - 1, "e": yr}
            if lb: st["h"] = lb
            stints.append(st)
        out = stints
        seasons = len({r[0] for r in rows})
        pos = rows[-1][2]
        return {"id": pid, "n": disp, "p": pos, "t": out, "seasons": seasons}, None
    except Exception as e:
        return None, f"erreur {name}: {e}"

with ThreadPoolExecutor(8) as ex: res = list(ex.map(build, NAMES))
players, seen = [], set()
for p, err in res:
    if err: print(err, file=sys.stderr); continue
    if p["id"] in seen: continue
    seen.add(p["id"])
    if len({s["f"] for s in p["t"]}) < 2 or p["seasons"] < 4: continue   # au moins 2 franchises
    del p["seasons"]; players.append(p)
players.sort(key=lambda p: p["n"])
LAST = max(s["e"] for p in players for s in p["t"])
with open("src/parcoursData.js", "w") as f:
    f.write("/* Généré par scripts/build-parcours.py (source : ESPN) — ne pas modifier à la main.\n")
    f.write("   f = franchise (abréviation actuelle), s/e = années de début/fin, h = nom historique. */\n")
    f.write(f"export const PARCOURS_LAST_SEASON = {LAST};\n")
    f.write("export const PARCOURS_PLAYERS = " + json.dumps(players, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(players), "joueurs, dernière saison", LAST)
