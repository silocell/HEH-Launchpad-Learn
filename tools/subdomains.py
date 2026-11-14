#!/usr/bin/env python3
"""Build the learning games' own-subdomain sites from this repo.

Each game lives here (learn.civilinitiatives.org) and ALSO at its own address,
e.g. maths.civilinitiatives.org. maths.chausima.com etc. are short links that take
you straight to that address. GitHub Pages serves one address per repo, so each address is a
small repo (silocell/heh-<name> and silocell/chausima-<name>) holding a copy of the
page and the few files it needs. This script makes those copies:

    python3 tools/subdomains.py OUTDIR

then each OUTDIR/<repo> is committed and pushed. Run it again after changing a game.
Links between games point at the civilinitiatives.org addresses, where the shared
sign-in works (a chausima.com page can't read a civilinitiatives.org sign-in cookie,
so there progress is kept on the device).
"""
import os, re, shutil, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEARN = "https://learn.civilinitiatives.org/"
# page -> subdomain name
SUBS = {"maths": "maths", "reader": "reader", "science": "science", "languages": "languages",
        "tables": "tables", "dragons": "dragons", "history": "history", "geo": "mapquest"}
SHARED = ["learn.js", "kit.js", "kit.css", "geo-facts.js", "favicon.png", "related.js"]
OTHER = ["homework", "cards", "progress", "levelup"]
# games that only work signed in (their data lives on the server): on chausima.com,
# where the Launchpad sign-in can't reach, their address just takes you to the real one
NEEDS_SIGNIN = {"tables", "dragons"}
CHAUSIMA_NOTE = (
  '<div style="background:#0f172a;color:#e2e8f0;font:600 14px/1.4 system-ui,sans-serif;padding:8px 14px;text-align:center">'
  'You\'re playing on chausima.com, so progress stays on this device. '
  '<a style="color:#93c5fd" href="%s">Play on civilinitiatives.org</a> to save it to your Launchpad account.</div>')
REDIRECT = """<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title><meta http-equiv="refresh" content="0; url=%s"><link rel="canonical" href="%s">
<script>location.replace("%s" + location.search + location.hash);</script></head>
<body style="font:16px system-ui,sans-serif;padding:24px"><p>%s lives at <a href="%s">%s</a>.</p></body></html>
"""

def url_for(page):
    if page in SUBS: return "https://%s.civilinitiatives.org/" % SUBS[page]
    return LEARN + page + ".html"

def rewrite(text):
    # links to other learning pages -> their real addresses
    for page in list(SUBS) + OTHER:
        text = re.sub(r'(["\'])%s\.html(["\'#?])' % page, lambda m: m.group(1) + url_for(page) + m.group(2), text)
    text = re.sub(r'href="\./"', 'href="%s"' % LEARN, text)
    text = text.replace('href: "./"', 'href: "%s"' % LEARN)
    return text

def build(out):
    made = []
    for page, sub in SUBS.items():
        for dom, prefix in (("civilinitiatives.org", "heh-"), ("chausima.com", "chausima-")):
            repo = prefix + sub
            d = os.path.join(out, repo); os.makedirs(d, exist_ok=True)
            html = open(os.path.join(HERE, page + ".html"), encoding="utf-8").read()
            title = re.search(r"<title>(.*?)</title>", html).group(1)
            if dom == "chausima.com":          # chausima.com addresses are short links to the real game
                real = url_for(page)
                for f in os.listdir(d):
                    if f not in (".git",): (shutil.rmtree if os.path.isdir(os.path.join(d, f)) else os.remove)(os.path.join(d, f))
                open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(REDIRECT % (title, real, real, real, title, real, real))
                open(os.path.join(d, "CNAME"), "w").write("%s.%s\n" % (sub, dom))
                made.append(repo); continue
            html = rewrite(html)
            if dom == "chausima.com":
                # no Launchpad sign-in here: don't lock the page, just say where progress goes
                html = re.sub(r'<script src="https://civilinitiatives.org/games-gate\.js[^"]*"[^>]*></script>\n?', "", html)
                html = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + CHAUSIMA_NOTE % url_for(page), html, count=1)
            html = html.replace("<head>", '<head>\n<!-- Built from silocell/HEH-Launchpad-Learn (%s.html) by tools/subdomains.py. Change it there, not here. -->' % page, 1)
            open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(html)
            for f in SHARED:
                src = os.path.join(HERE, f)
                if not os.path.exists(src): continue
                if f.endswith((".js", ".css")):
                    open(os.path.join(d, f), "w", encoding="utf-8").write(rewrite(open(src, encoding="utf-8").read()))
                else:
                    shutil.copy(src, os.path.join(d, f))
            open(os.path.join(d, "CNAME"), "w").write("%s.%s\n" % (sub, dom))
            open(os.path.join(d, "README.md"), "w").write("# %s.%s\n\nA copy of `%s.html` from [HEH-Launchpad-Learn](https://github.com/silocell/HEH-Launchpad-Learn), served at its own address. Built by `tools/subdomains.py` - change the game there.\n\nGPL-3.0.\n" % (sub, dom, page))
            lic = os.path.join(HERE, "LICENSE")
            if os.path.exists(lic): shutil.copy(lic, os.path.join(d, "LICENSE"))
            made.append(repo)
    return made

if __name__ == "__main__":
    print("\n".join(build(sys.argv[1] if len(sys.argv) > 1 else "subs")))
