#!/usr/bin/env python3
"""Add a realm (one map inside a world) to docs/data/index.json.

Usage:
  add_realm.py --world b2 --name "Neuro Reach: Neuroscience" [--map m/map4.jpg] [--village 86,74] [--all]
Prints the new realm index, which chapters then use as --realm with add_chapter.py.
--all makes it a whole-world village realm (mixed questions from every map in the world, like Examinus).
Add a world first by editing "worlds" in index.json (id, name, sub, el, img, realms:[]).
"""
import argparse, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "docs", "data", "index.json")

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--world", required=True); ap.add_argument("--name", required=True)
ap.add_argument("--map", default="m/map1.jpg"); ap.add_argument("--village", default="86,74"); ap.add_argument("--all", action="store_true")
a = ap.parse_args()

d = json.load(open(INDEX))
w = next((x for x in d["worlds"] if x["id"] == a.world), None)
if not w:
    raise SystemExit("no world with id " + a.world + "; add it to index.json first")
d["realms"].append(a.name)
info = {"map": a.map, "village": [float(x) for x in a.village.split(",")]}
if a.all:
    info["villageAll"] = True
d.setdefault("realmInfo", []).append(info)
r = len(d["realms"]) - 1
w["realms"].append(r)
if r not in d.get("preload", []):
    d.setdefault("preload", []).append(r)
json.dump(d, open(INDEX, "w"), ensure_ascii=False, separators=(",", ":"))
print("realm", r, "added to world", a.world, "->", a.name)
