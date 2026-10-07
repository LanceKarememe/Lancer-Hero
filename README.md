# Grand Rounds

A tactics-style study game: every lecture is a battle, every attack is a multiple-choice question, and the
village stands or falls on what you know. Built for Georgetown SOM block exams; designed to grow one chapter
at a time across the whole MD curriculum.

The site is served from `docs/` by GitHub Pages. Everything in `docs/` is static: no server, no accounts.
Progress lives in the player's browser (local storage) and can be moved between devices with a save code.

## Layout

```
docs/                 the playable site (GitHub Pages root)
  index.html          page shell: loads app.css and app.js
  app.js              the game engine (hand-edited)
  app.css             styles (hand-edited)
  data/index.json     title, realms, chapter list (ids only), heroes, prompts, image map, preload list
  data/ch/<id>.json   one file per chapter: {cards:{cid:card}, brief:html}; loaded on demand
  h/ m/ u/ q/         hero sprites, world maps, utility sprites, question images
tools/
  add_chapter.py      add or replace one chapter from a quiz folder (see below)
  chest.py            compute the debrief chest code for a campaign-report seed
src/
  briefs/<id>.md      markdown source of each chapter's in-game tables (compiled into the chapter file)
  prompts/*.md        the pack-maker, bank-maker and tutor prompts shown in the game
story/
  bible.md            setting, factions, hero voices, chapter beats (the reference every session writes from)
```

## Worlds, realms, chapters

The game opens on a **worlds menu**: one world per chapter of the curriculum (`index.worlds`: id, name, sub, element,
cover image in `docs/w/`, and the list of realm indices it contains). A **realm** is one map inside a world
(`index.realms[i]` is its name; `index.realmInfo[i]` holds its map image, village position, `villageAll` for a
whole-world village with optional exam `weights`, or `packs: true` for the Guild Packs realm, which every world shows).
A **chapter** is one lecture: a node on a realm's map. Heroes, orbs and the shared library are global.

Adding a block: add a world entry to `index.json`, then `tools/add_realm.py --world <id> --name "..."` for each map,
then `tools/add_chapter.py --realm <index> ...` for each lecture.

## Mechanics added after the move

- **Missions.** Each lecture's first battle has a mission (`chapter.mission`: `hunt`, `escort` or `reach`, rotated by
  `add_chapter.py` so every map has a mix). Grading, report and chest are unchanged; the mission adds a bonus to the
  chest. Escort: a courier walks two tiles east per turn, foes beside her raid (the nearest hero answers; a miss costs her
  a heart); delivered alive = 2 + hearts bonus orbs. Reach: a banner behind enemy lines; a hero standing on it at the end
  of a turn within 6 turns = 4 orbs (5 if by turn 4). Rematches and skirmishes are always hunts.
- **Boss** (`world.boss`: hero id, name, hp, el). Opens when half the world's battles are cleared. Duel screen: pick a
  hero → question → hit (damage by role: Striker/Caster 3, Ranger/Flyer/Vanguard 2, Healer 1; +1 if the hero's element
  is in `BOSS_WEAK[boss.el]`; Ranger staggers, Vanguard arms, Healer heals). A miss is countered: a parry question.
  Below half HP the boss is enraged (two strikes a round, 1.5 hearts). First win: ◆ 30 and the boss joins the roster;
  later wins ◆ 10 once a week (`S.boss[worldId]`).
- **Home element** (`realmInfo[r].el`): heroes of that element earn 30 exp per hit instead of 20 and their skill
  cooldown drops an extra turn on each correct answer there.
- **Signatures** (`SIG` in app.js, keyed `role|element`): one intended combo per pair, covering all 60 heroes.

## How the data loads

`app.js` fetches `data/index.json` first, then every chapter whose realm is listed in `index.preload`.
Chapters in other realms load the first time the player opens that realm or chapter. This keeps the first
load small as the game grows: when a new block starts, put its realm in `preload` and take old ones out.

A card looks like this:

```json
{"q":"stem","o":["A","B","C","D"],"a":2,"r":"one-line rule shown after answering","p":862,"lo":"LO 3","img":"3f2a9c1e","alt":""}
```

`a` is the index of the correct option. `img` is a key into `index.imgs` (set by `add_chapter.py`).

## Adding a lecture (one chapter)

1. Build a quiz folder with `quiz.json` and `key.json` in the format the Exam 3 quizzes used
   (`quiz.json` = `{"questions":[{"stem","options","image"?,"alt"?}]}`, `key.json` = `[{"n","correct","answer","rule","page","lo"?}]`),
   plus any question images, and a tables markdown file for the brief.
2. Run, from the repo root:

   ```
   python3 tools/add_chapter.py --id met9 --name "Met 9: Nucleotide Metabolism" --short "Met 9" \
       --realm 1 --pos 40,60 --quiz path/to/quiz_met9 --brief src/briefs/met9.md
   ```

   Re-running with the same `--id` replaces the chapter; `--bank` dirs add questions that only rematches
   and the village draw from; `--exclude 3,7` leaves out question numbers.
3. Commit and push. Pages redeploys in about a minute.

Rules for questions (from the player): choices brief and length-matched; the right answer never longer or
carrying extra detail; one fact per question; histology questions image-heavy with answer labels censored;
most histology questions second-order (what the structure does), not plain identification.

## Saves and codes

Saves are versioned (`SAVE_V` in `app.js`). When the save shape changes, bump `SAVE_V` and add one
function to `MIGRATIONS` that upgrades version k to k+1; never edit an old one. Old save codes keep loading.

Chest codes: `python3 tools/chest.py MET5-22-431` (seed is printed in the campaign report).
Gift and revive codes are checked the same way: `chest.py GIFT-<amount>-<TAG>` and
`chest.py REVIVE-<level>-<HERONAME>`; the player enters `GIFT-<amount>-<TAG>-<CHECK>`.

## Local testing

```
cd docs && python3 -m http.server 8765
```

then open http://localhost:8765/. The page needs to be served (not opened as a file) because it fetches JSON.

## Shared library (Firestore)

Shared packs and question banks live in a Firebase project (`lancer-hero`, free Spark plan). The web config is
in `docs/data/index.json` under `firebase` (public by design). Access is controlled by `firestore.rules`:
anyone can read, writing needs the **guild passphrase**, whose SHA-256 hash is in the rules. Players enter the
passphrase once under Guild Packs; it is kept in their browser. To rotate it: pick a new phrase, put
`sha256(phrase)` in `firestore.rules`, paste the file into Firebase console → Firestore → Rules → Publish.
Storage layout: `packs/{id}` meta (`name, n, author, chunks, rev, by, key, deleted`) and `packs/{id}/chunks/cNNNN` (`d`).
Deleting a shared pack writes `deleted: true` (clients hide it); a true delete is allowed only to the uploader's uid.
