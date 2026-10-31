"""Generates vertical.html (1080x1920, YouTube Shorts) from index.html.

Same timeline, soundtrack and animation code; only stage size, layout and
camera/motion coordinates change. Re-run after editing index.html.
"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(HERE, 'index.html')).read()

def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b)

rep("html, body { width: 1920px; height: 1080px;", "html, body { width: 1080px; height: 1920px;")
rep("<title>Televixo promo</title>", "<title>Televixo promo (vertical)</title>")
# motion coordinates for the portrait stage
rep("S('browser', { y: (1 - be) * 700, rx: (1 - be) * 28, s: lerp(1, .78, split) * lerp(1, .92, outz), x: lerp(0, -330, split), o: be });",
    "S('browser', { y: (1 - be) * 900 + lerp(0, -360, split), rx: (1 - be) * 28, s: lerp(.8, .74, split) * lerp(1, .92, outz), o: be });")
rep("S('phone', { x: lerp(560, 0, split), r: lerp(10, 0, split), s: lerp(1, .9, outz), o: split });",
    "S('phone', { y: lerp(900, 0, split), r: lerp(8, 0, split), s: .78 * lerp(1, .94, outz), o: split });")
rep("const cx = lerp(980, 1500, ck), cy = lerp(760, 880, ck);", "const cx = lerp(540, 948, ck), cy = lerp(1400, 1156, ck);")
rep("const A = [1050, 760], B = [1560, 470], C1 = [1300, 220];", "const A = [850, 760], B = [540, 1500], C1 = [1000, 1150];")
s = s.replace("bez([1600, 820], [1300, 1040], [1000, 820]", "bez([610, 1590], [80, 1150], [760, 690]")
rep("lerp(0, 960 - fx * sc, k) + (sc - 1) * 0, lerp(0, 560 - fy * sc, k)", "lerp(0, 540 - fx * sc, k), lerp(0, 940 - fy * sc, k)")
rep("focus(1385, 720, 1.85, zw)", "focus(878, 1009, 2.0, zw)")
rep("focus(1595, 690, 1.3, zp)", "focus(540, 1430, 1.35, zp)")
rep("focus(965, 660, 1.6, zr)", "focus(850, 650, 1.7, zr)")

# Portrait layout overrides. Key content stays within the Shorts safe area
# (roughly y 180–1500, away from the right-hand button column).
css = """
<style>
/* ---------- vertical (9:16) layout ---------- */
#s1a, #s1b { width: 1000px !important; margin-left: -500px !important; margin-top: -330px !important; font-size: 128px !important; }
#w4, #w8 { font-size: 150px !important; }
#logo { width: 1000px !important; margin-left: -500px !important; margin-top: -330px !important; }
#logoPill { height: 130px !important; font-size: 40px !important; }
#logoPill .arr { width: 102px !important; height: 102px !important; }
#wordmark { font-size: 176px !important; }
#tagline { font-size: 44px !important; }
#tagline .serif { font-size: 54px !important; }
#browser { left: -100px !important; top: 434px !important; }
#phone { left: 325px !important; top: 940px !important; }
#caption { top: 800px !important; font-size: 56px !important; }
#caption2 { top: 925px !important; bottom: auto !important; font-size: 56px !important; }
#cap3 { font-size: 66px !important; padding: 24px 40px !important; text-align: center; max-width: 940px; }
#brk { width: 1000px !important; margin-left: -500px !important; margin-top: -330px !important; font-size: 106px !important; }
#k2 { font-size: 118px !important; }
.feat > .abs:first-child { left: 80px !important; top: 230px !important; width: 900px; }
.ftitle { font-size: 86px !important; }
.fdesc { font-size: 30px !important; max-width: 880px !important; }
#f1a { left: 67px !important; top: 692px !important; }
#f1b { left: 450px !important; top: 760px !important; }
#f2shot { left: 80px !important; top: 830px !important; width: 900px !important; height: 563px !important; }
#fc0 { left: 80px !important; top: 1420px !important; }
#fc1 { left: 300px !important; top: 1450px !important; }
#fc2 { left: 560px !important; top: 1410px !important; }
#fc3 { left: 620px !important; top: 770px !important; }
#f3card { left: 80px !important; top: 800px !important; width: 900px !important; }
#f3teaser { left: 300px !important; top: 1260px !important; }
#f3launch { left: 700px !important; top: 1380px !important; }
#f4card { left: 80px !important; top: 830px !important; width: 900px !important; }
#f5card { left: 80px !important; top: 800px !important; width: 900px !important; height: 640px !important; }
#shield { left: 110px !important; top: 860px !important; width: 270px !important; height: 324px !important; }
#checks { left: 430px !important; top: 900px !important; font-size: 30px !important; }
.progress { left: 80px !important; right: 80px !important; bottom: auto !important; top: 150px !important; }
.tile { width: 430px !important; height: 520px !important; padding: 40px !important; }
.tile b { font-size: 118px !important; }
.tile span { font-size: 30px !important; }
#t1 { left: 75px !important; top: 360px !important; }
#t2 { left: 575px !important; top: 360px !important; }
#t3 { left: 75px !important; top: 920px !important; }
#t4 { left: 575px !important; top: 920px !important; }
#outro { width: 1000px !important; margin-left: -500px !important; margin-top: -400px !important; }
#oLogo span:last-child { font-size: 132px !important; }
#oLogo .btn-dark { width: 108px !important; height: 108px !important; }
#oTag { font-size: 56px !important; }
#oTag .serif { font-size: 66px !important; }
#oCta { font-size: 38px !important; height: 104px !important; }
#oFoot { font-size: 22px !important; line-height: 1.5; }
</style>
</head>"""
rep("</head>", css)
open(os.path.join(HERE, 'vertical.html'), 'w').write(s)
print('wrote vertical.html')
