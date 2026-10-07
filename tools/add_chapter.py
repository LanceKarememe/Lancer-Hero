#!/usr/bin/env python3
"""Add or replace one chapter (one lecture / battle) in the site.

Usage:
  add_chapter.py --id met9 --name "Met 9: Nucleotide Metabolism" --short "Met 9" --realm 1 --pos 40,60 \
                 --quiz path/to/quiz_met9 [--quiz path/to/quiz_met9_b ...] [--bank path/to/quiz_dir ...] \
                 [--brief tables.md] [--exclude 3,7,12]

A quiz dir holds quiz.json ({"questions":[{stem, options, image?, alt?}]}) and key.json
([{n, correct:"A".."E", answer, rule, page, lo?}]). Every --quiz dir's questions become the exam battle;
--bank dirs feed only rematches and the village. Images are compressed into docs/q/ and referenced by hash.
Writes docs/data/ch/<id>.json and updates the chapter entry in docs/data/index.json (keeps map position,
emblem and realm of an existing chapter unless you pass new ones).
"""
import argparse, base64, hashlib, io, json, os, re, sys
import markdown
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
INDEX = os.path.join(DOCS, "data", "index.json")


def img_key(path, imgs):
    k = hashlib.md5(os.path.abspath(path).encode()).hexdigest()[:8]
    if k in imgs:
        return k
    raw = open(path, "rb").read()
    im = Image.open(io.BytesIO(raw))
    ext = "jpg" if path.lower().endswith((".jpg", ".jpeg")) else "png"
    if len(raw) > 260_000 or im.width > 1300:
        im = im.convert("RGB")
        if im.width > 1200:
            im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=80, optimize=True); raw = buf.getvalue(); ext = "jpg"
    os.makedirs(os.path.join(DOCS, "q"), exist_ok=True)
    open(os.path.join(DOCS, "q", f"{k}.{ext}"), "wb").write(raw)
    imgs[k] = f"q/{k}.{ext}"
    return k


def load_cards(d, imgs, exclude=()):
    name = os.path.basename(os.path.normpath(d))
    quiz = json.load(open(os.path.join(d, "quiz.json")))["questions"]
    key = json.load(open(os.path.join(d, "key.json")))
    cards, ids = {}, []
    for k in key:
        n = k["n"]
        if n in exclude:
            continue
        q = quiz[n - 1]
        cid = f"{name}:{n}"
        assert q["options"]["ABCDE".index(k["correct"])] == k["answer"], f"{cid}: key answer text does not match option {k['correct']}"
        cards[cid] = {"q": q["stem"], "o": q["options"], "a": "ABCDE".index(k["correct"]),
                      "r": re.sub(r"\s*\[image:[^\]]*\]", "", k["rule"]).strip(), "p": k["page"], "lo": k.get("lo"),
                      "img": img_key(os.path.join(d, q["image"]), imgs) if q.get("image") else None, "alt": q.get("alt", "")}
        ids.append(cid)
    return cards, ids


def brief_html(path):
    html = markdown.markdown(open(path).read(), extensions=["tables", "sane_lists"])
    return html.replace("<table>", '<div class="tw"><table>').replace("</table>", "</table></div>")


def pick_emblem(index, chid):
    """One emblem hero per chapter: never legendary, never a starter, stable for a given chapter id."""
    used = {c.get("emblem") for c in index["chapters"] if c["id"] != chid}
    pool = sorted((h for h in index["heroes"] if h["r"] < 2 and h["id"] not in index["starters"]),
                  key=lambda h: hashlib.md5(("emblem" + h["id"]).encode()).hexdigest())
    free = [h for h in pool if h["id"] not in used] or pool
    return free[int(hashlib.md5(chid.encode()).hexdigest()[:6], 16) % len(free)]["id"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--id", required=True); ap.add_argument("--name"); ap.add_argument("--short")
    ap.add_argument("--realm", type=int); ap.add_argument("--pos", help="x,y in percent of the map")
    ap.add_argument("--quiz", action="append", default=[]); ap.add_argument("--bank", action="append", default=[])
    ap.add_argument("--brief"); ap.add_argument("--exclude", default="", help="question numbers to leave out, e.g. 3,7")
    a = ap.parse_args()

    index = json.load(open(INDEX))
    imgs = index.setdefault("imgs", {})
    old = next((c for c in index["chapters"] if c["id"] == a.id), None)
    if not old and not (a.name and a.short and a.realm is not None and a.pos):
        sys.exit("new chapter: --name, --short, --realm and --pos are required")
    exclude = {int(x) for x in a.exclude.split(",") if x.strip()}

    cards, exam, bank = {}, [], []
    for d in a.quiz:
        c, ids = load_cards(d, imgs, exclude); cards.update(c); exam += ids
    for d in a.bank:
        c, ids = load_cards(d, imgs); cards.update(c); bank += [i for i in ids if i not in exam]

    ch = dict(old or {})
    ch.update({"id": a.id, "name": a.name or ch["name"], "short": a.short or ch["short"],
               "realm": a.realm if a.realm is not None else ch["realm"],
               "pos": [float(x) for x in a.pos.split(",")] if a.pos else ch["pos"],
               "brief": a.id if (a.brief or ch.get("brief")) else None, "seeds": ch.get("seeds", []),
               "exam": exam or ch.get("exam"), "bank": bank or ch.get("bank", [])})
    ch.setdefault("emblem", pick_emblem(index, a.id))
    if "mission" not in ch:  # rotate hunt / escort / reach within the realm so every map has a mix
        n = sum(1 for c in index["chapters"] if c["realm"] == ch["realm"] and c["id"] != a.id)
        ch["mission"] = ["hunt", "escort", "reach"][n % 3]

    chpath = os.path.join(DOCS, "data", "ch", a.id + ".json")
    prev = json.load(open(chpath)) if os.path.exists(chpath) else {"cards": {}, "brief": None}
    if not exam:  # keep the old cards when only the brief or metadata changes
        cards = prev["cards"]
    out = {"cards": cards, "brief": brief_html(a.brief) if a.brief else prev.get("brief")}
    os.makedirs(os.path.dirname(chpath), exist_ok=True)
    json.dump(out, open(chpath, "w"), ensure_ascii=False, separators=(",", ":"))

    if old:
        index["chapters"][index["chapters"].index(old)] = ch
    else:
        index["chapters"].append(ch)
    index["locked"] = [l for l in index.get("locked", []) if l["short"] != ch["short"]]
    json.dump(index, open(INDEX, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{'updated' if old else 'added'} {a.id}: {len(exam)} exam questions, {len(bank)} bank questions, "
          f"{sum(1 for c in cards.values() if c['img'])} images, brief {'yes' if out['brief'] else 'no'}")


if __name__ == "__main__":
    main()
