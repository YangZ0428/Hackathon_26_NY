import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from oklch import oklch_hex, HEX

FONT = '"Manrope",-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif'
GFONT = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Manrope:wght@400;500;600;700;800&display=swap">')

INK    = HEX["foreground"]        # #111E16
GREEN  = HEX["primary"]           # #1A6936
MUTED  = HEX["muted_foreground"]  # #5C6A60
BGWARM = HEX["background"]        # #FEFDFB
# a blue tuned to sit at the same lightness/chroma as their green, so the
# palette reads as one family rather than two systems
BLUE   = oklch_hex(0.50, 0.105, 245)
BLUEMD = oklch_hex(0.66, 0.090, 245)
BLUELT = oklch_hex(0.86, 0.045, 243)

# ---------------- hero geometry, viewBox 1200 x 430 ----------------
W, H     = 1200.0, 400.0
TX1, TX2 = 128.0, 1072.0
TWD      = 62.0
TTOP     = 44.0
ATTACH   = 72.0
SAGMIN   = 112.0
DECK     = 318.0
TBASE    = 358.0
WATER    = 338.0
PANEL    = (258.0, 116.0, 684.0, 140.0)

def cable_y(x):
    t = (x - (TX1+TX2)/2) / ((TX2-TX1)/2)
    return ATTACH + (SAGMIN - ATTACH) * (1 - t*t)

def hero_svg(walkers):
    p = []; a = p.append
    a(f'<svg class="art" viewBox="0 0 {W:.0f} {H:.0f}" xmlns="http://www.w3.org/2000/svg">')

    # water + tower reflections
    a(f'<rect x="0" y="{WATER}" width="{W}" height="{H-WATER}" fill="{BLUELT}" opacity=".34"/>')
    for tx in (TX1, TX2):
        a(f'<rect x="{tx-TWD/2:.0f}" y="{WATER}" width="{TWD:.0f}" height="{H-WATER:.0f}" '
          f'fill="{BLUEMD}" opacity=".13"/>')
    for i, y in enumerate([WATER+16, WATER+34, WATER+54]):
        x0 = 210 + i*150; wd = 300 - i*60
        a(f'<path d="M {x0} {y} L {x0+wd} {y}" stroke="{BLUEMD}" stroke-width="2" '
          f'opacity="{.20 - i*.05:.2f}" stroke-linecap="round"/>')
        a(f'<path d="M {W-x0-wd} {y} L {W-x0} {y}" stroke="{BLUEMD}" stroke-width="2" '
          f'opacity="{.20 - i*.05:.2f}" stroke-linecap="round"/>')

    # suspenders run the whole span; the glass panel blurs the middle ones
    a(f'<g stroke="{BLUEMD}" stroke-width="1.5" opacity=".62" stroke-linecap="round">')
    x = TX1 + TWD/2 + 14
    while x <= TX2 - TWD/2 - 14:
        a(f'<path d="M {x:.1f} {cable_y(x):.1f} L {x:.1f} {DECK:.1f}"/>')
        x += 34.0
    a('</g>')

    # side spans, exiting the frame rather than flopping down to the deck
    a(f'<g fill="none" stroke="{GREEN}" stroke-width="2.8" stroke-linecap="round">')
    a(f'<path d="M {TX1:.0f} {ATTACH:.0f} Q 58 122 0 196"/>')
    a(f'<path d="M {TX2:.0f} {ATTACH:.0f} Q {W-58:.0f} 122 {W:.0f} 196"/>')
    a('</g>')

    # main cable
    a(f'<path d="M {TX1:.0f} {ATTACH:.0f} Q {(TX1+TX2)/2:.0f} {2*SAGMIN-ATTACH:.0f} '
      f'{TX2:.0f} {ATTACH:.0f}" fill="none" stroke="{GREEN}" stroke-width="3.4" '
      f'stroke-linecap="round"/>')

    # towers
    for tx in (TX1, TX2):
        hw = TWD/2
        a(f'<path d="M {tx-hw} {TBASE} L {tx-hw} {TTOP+6} L {tx-hw+5} {TTOP} '
          f'L {tx+hw-5} {TTOP} L {tx+hw} {TTOP+6} L {tx+hw} {TBASE} Z" '
          f'fill="#FFFFFF" stroke="{BLUE}" stroke-width="2.6" stroke-linejoin="round"/>')
        a(f'<path d="M {tx-hw} 138 L {tx+hw} 138" stroke="{BLUE}" stroke-width="2.6"/>')
        a(f'<path d="M {tx-hw} 232 L {tx+hw} 232" stroke="{BLUE}" stroke-width="1.8" opacity=".8"/>')
        aw, gap = 19.0, 6.0
        for ax in (tx-gap/2-aw, tx+gap/2):
            cx = ax+aw/2; apex = 236.0 - aw*math.sqrt(3)/2
            a(f'<path d="M {ax:.1f} {DECK-4:.1f} L {ax:.1f} 236 '
              f'A {aw} {aw} 0 0 1 {cx:.1f} {apex:.1f} '
              f'A {aw} {aw} 0 0 1 {ax+aw:.1f} 236 L {ax+aw:.1f} {DECK-4:.1f}" '
              f'fill="none" stroke="{BLUE}" stroke-width="2.2" stroke-linejoin="round"/>')

    # deck
    a(f'<path d="M 0 {DECK} L {W} {DECK}" stroke="{INK}" stroke-width="2.4"/>')
    a(f'<path d="M 0 {DECK+7} L {W} {DECK+7}" stroke="{INK}" stroke-width="1.2" opacity=".40"/>')

    # two walkers on the deck, near true scale
    for x, s in walkers:
        a(f'<g transform="translate({x},{DECK}) scale({s})">'
          f'<ellipse cx="-2" cy="3" rx="42" ry="6" fill="{INK}" opacity=".13"/>'
          f'<circle cx="1" cy="-170" r="16" fill="{INK}"/>'
          f'<g fill="none" stroke="{INK}" stroke-linecap="round" stroke-linejoin="round">'
          f'<path d="M 1 -140 L -13 -112 L -18 -92" stroke-width="14" opacity=".5"/>'
          f'<path d="M 2 -88 L -15 -52 L -27 -9" stroke-width="16" opacity=".5"/>'
          f'<path d="M 0 -148 L 2 -86" stroke-width="30"/>'
          f'<path d="M 2 -88 L 20 -48 L 17 -3" stroke-width="17"/>'
          f'<path d="M 1 -140 L 19 -112 L 30 -92" stroke-width="14"/>'
          f'</g></g>')
    a('</svg>')
    return "\n".join(p)

def hero(path, panel, glass, title_px, sub_px, walkers):
    px, py, pw, ph = panel
    gbg, gborder, gshadow = glass
    html = f'''<!doctype html><html><head><meta charset="utf-8">{GFONT}<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1200px;height:400px;overflow:hidden;background:transparent}}
.stage{{position:relative;width:1200px;height:400px;overflow:hidden;font-family:{FONT};
 background:linear-gradient(172deg,{BGWARM} 0%,#F6FAFD 48%,#F1F8F3 100%)}}
.orb{{position:absolute;border-radius:50%;filter:blur(130px)}}
.o1{{right:2%;top:-200px;width:560px;height:560px;background:{BLUEMD};opacity:.24}}
.o2{{left:4%;bottom:-300px;width:620px;height:560px;background:{GREEN};opacity:.13}}
.art{{position:absolute;inset:0;width:1200px;height:400px}}
.panel{{position:absolute;left:{px:.0f}px;top:{py:.0f}px;width:{pw:.0f}px;height:{ph:.0f}px;
 border-radius:36px;background:{gbg};
 backdrop-filter:blur(28px) saturate(170%);-webkit-backdrop-filter:blur(28px) saturate(170%);
 border:{gborder};box-shadow:{gshadow};
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px}}
h1{{font-size:{title_px}px;line-height:1;letter-spacing:-.045em;font-weight:800;color:{INK}}}
h1 em{{font-style:normal;color:{GREEN}}}
p{{font-size:{sub_px}px;line-height:1.3;font-weight:500;color:{MUTED};letter-spacing:-.01em}}
</style></head><body><div class="stage">
<div class="orb o1"></div><div class="orb o2"></div>
{hero_svg(walkers)}
<div class="panel"><h1>CliMap <em>NYC</em></h1><p>The right route to go outside.</p></div>
</div></body></html>'''
    open(path, "w").write(html)

# ---------------- blue + white app icon ----------------
def logo_mark():
    TX, TOP_, BASE, HALF = 50.0, 13.0, 79.0, 10.4
    SADDLE = 28.0
    pier = (f"M {TX-HALF} {BASE} L {TX-HALF} {TOP_+4} L {TX-HALF+2.2} {TOP_} "
            f"L {TX+HALF-2.2} {TOP_} L {TX+HALF} {TOP_+4} L {TX+HALF} {BASE} Z")
    def arch(ax, aw, base_y, spring_y):
        cx = ax+aw/2.0; apex = spring_y - aw*math.sqrt(3)/2.0
        return (f"M {ax:.2f} {base_y:.2f} L {ax:.2f} {spring_y:.2f} "
                f"A {aw:.2f} {aw:.2f} 0 0 1 {cx:.2f} {apex:.2f} "
                f"A {aw:.2f} {aw:.2f} 0 0 1 {ax+aw:.2f} {spring_y:.2f} L {ax+aw:.2f} {base_y:.2f} Z")
    aw, gap = 6.8, 2.6
    arches = [arch(TX-gap/2-aw, aw, BASE, 50.0), arch(TX+gap/2, aw, BASE, 50.0)]
    L0,L1,L2 = (1.5,73.0),(17.0,67.0),(TX-2.0,SADDLE)
    R0,R1,R2 = (TX+2.0,SADDLE),(83.0,67.0),(98.5,73.0)
    cables = [f"M {L0[0]} {L0[1]} Q {L1[0]} {L1[1]} {L2[0]} {L2[1]}",
              f"M {R0[0]} {R0[1]} Q {R1[0]} {R1[1]} {R2[0]} {R2[1]}"]
    hang = []
    for (p0,p1,p2) in ((L0,L1,L2),(R0,R1,R2)):
        for k in (2,4,6):                       # simplified: three per side
            t=k/9.0; u=1-t
            x=u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0]; y=u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1]
            if abs(x-TX) < HALF+1.8 or y > BASE-4: continue
            hang.append(f"M {x:.2f} {y:.2f} L {x:.2f} {BASE}")
    g = ['<g fill="none" stroke-linecap="round">']
    g.append('<g stroke="#FFFFFF" stroke-width="2.0" opacity=".60">')
    g += [f'<path d="{d}"/>' for d in hang]
    g.append('</g><g stroke="#FFFFFF" stroke-width="3.8">')
    g += [f'<path d="{d}"/>' for d in cables]
    g.append('</g></g>')
    g.append(f'<path d="{pier}" fill="#FFFFFF"/>')
    ARCHDK = oklch_hex(0.32, 0.085, 250)
    g += [f'<path d="{a_}" fill="{ARCHDK}"/>' for a_ in arches]
    g.append('<g fill="none" stroke-linecap="round">')
    g.append(f'<path d="M 1 {BASE} L 99 {BASE}" stroke="#FFFFFF" stroke-width="3.6"/>')
    g.append(f'<path d="M 1 {BASE+5.4} L 99 {BASE+5.4}" stroke="#FFFFFF" '
             f'stroke-width="1.6" opacity=".55"/>')
    g.append('</g>')
    return "\n".join(g)

def logo(path):
    html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1024px;height:1024px;overflow:hidden;background:transparent}}
.icon{{position:relative;width:1024px;height:1024px;overflow:hidden;border-radius:230px;
 background:linear-gradient(150deg,{BLUEMD} 0%,{BLUE} 52%,{oklch_hex(0.40,0.10,250)} 100%)}}
.orb{{position:absolute;border-radius:50%;filter:blur(120px)}}
.o1{{left:-80px;top:-70px;width:560px;height:560px;background:{BLUELT};opacity:.55}}
.o2{{right:-110px;bottom:-120px;width:600px;height:600px;background:{oklch_hex(0.34,0.09,252)};opacity:.75}}
.o3{{right:130px;top:-30px;width:320px;height:320px;background:#FFFFFF;opacity:.24}}
.glass{{position:absolute;inset:0;border-radius:230px;
 background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.07));
 backdrop-filter:blur(44px) saturate(180%);-webkit-backdrop-filter:blur(44px) saturate(180%);
 border:3px solid rgba(255,255,255,.40);
 box-shadow:inset 0 2px 0 rgba(255,255,255,.55)}}
.mark{{position:absolute;inset:0;width:1024px;height:1024px}}
.sheen{{position:absolute;inset:0;border-radius:230px;
 background:linear-gradient(160deg,rgba(255,255,255,.32) 0%,rgba(255,255,255,0) 46%)}}
</style></head><body><div class="icon">
<div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>
<div class="glass"></div>
<svg class="mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(50 51.5) scale(0.78) translate(-50 -50)">{logo_mark()}</g>
</svg>
<div class="sheen"></div>
</div></body></html>'''
    open(path, "w").write(html)

SHADOW_SOFT = "0 18px 44px rgba(17,30,22,.06),inset 0 1px 0 rgba(255,255,255,.88)"
SHADOW_STD  = "0 22px 54px rgba(17,30,22,.08),inset 0 1px 0 rgba(255,255,255,.95)"

hero(os.path.join(HERE, "climap-hero.html"),
     panel=(258.0, 116.0, 684.0, 140.0),
     glass=("linear-gradient(150deg,rgba(255,255,255,.30),rgba(255,255,255,.12))",
            "1px solid rgba(255,255,255,.62)", SHADOW_SOFT),
     title_px=76, sub_px=23, walkers=((518, 0.268), (596, 0.230)))
