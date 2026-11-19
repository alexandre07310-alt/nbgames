"""Captures store (lot 2) : titre + sous-titre + capture arrondie, fond de l'app."""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
SRC = sys.argv[1]
BG = (7, 9, 14); GOLD = (245, 184, 0); WHITE = (235, 238, 245); GREY = (150, 158, 172)
SHOTS = [
    ("1.jpg", "04-pronostics", "Modifie tes pronostics", "Tes 3 réponses restent modifiables jusqu'à 1h avant le match"),
    ("4.jpg", "05-tendances", "Compare-toi aux autres", "La tendance des joueurs sur chaque match du soir"),
    ("2.jpg", "06-stat-du-jour", "Trouve le leader du soir", "Passeur, scoreur, rebondeur… une stat différente chaque jour"),
    ("3.jpg", "07-quiz", "Un quiz NBA chaque jour", "10 questions piochées parmi plus de 650"),
]
FORMATS = {"screenshots-ios-65": (1284, 2778), "screenshots-ios": (1290, 2796), "screenshots-ios-63": (1206, 2622), "screenshots": (1170, 2000)}
def font(size, bold):
    return ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size, index=1 if bold else 0)
def fit_text(draw, text, max_w, size, bold):
    while size > 20:
        f = font(size, bold)
        if draw.textlength(text, font=f) <= max_w: return f
        size -= 2
    return font(size, bold)
for out_dir, (W, H) in FORMATS.items():
    for src, name, title, sub in SHOTS:
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        # léger halo doré en haut, comme l'écran d'accueil de l'app
        glow = Image.new("L", (W, H), 0); ImageDraw.Draw(glow).ellipse((W*0.15, -H*0.12, W*0.85, H*0.16), fill=60)
        glow = glow.filter(ImageFilter.GaussianBlur(W*0.12))
        img.paste(Image.new("RGB", (W, H), (60, 45, 5)), (0, 0), glow)
        d = ImageDraw.Draw(img)
        s = W / 1284
        # Taille de la capture d'abord, pour centrer verticalement titre + capture
        shot = Image.open(f"{SRC}/{src}").convert("RGB")
        head = int(300*s); gap = int(90*s); margin = int(110*s)
        k = min((W - margin) / shot.width, (H - head - gap - 2*margin) / shot.height)
        sw, sh = int(shot.width*k), int(shot.height*k)
        top = max(margin, (H - (head + gap + sh)) // 2)
        ft = fit_text(d, title, W - 120*s, int(92*s), True)
        d.text((W/2, top), title, font=ft, fill=WHITE, anchor="ma")
        fs = fit_text(d, sub, W - 120*s, int(44*s), False)
        y_sub = top + int(125*s)
        d.text((W/2, y_sub), sub, font=fs, fill=GREY, anchor="ma")
        y_line = y_sub + int(85*s)
        d.rounded_rectangle((W/2 - 80*s, y_line, W/2 + 80*s, y_line + 6*s), radius=3*s, fill=GOLD)
        # capture : agrandie, coins arrondis, bord fin
        area_top = y_line + gap
        shot = shot.resize((sw, sh), Image.LANCZOS)
        r = int(48*s)
        mask = Image.new("L", shot.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, *shot.size), radius=r, fill=255)
        x = (W - shot.width)//2; y = area_top
        d.rounded_rectangle((x-3, y-3, x+shot.width+3, y+shot.height+3), radius=r+3, fill=(38, 44, 60))
        img.paste(shot, (x, y), mask)
        img.save(f"{out_dir}/{name}.png", optimize=True)
        print(out_dir, name, img.size)
