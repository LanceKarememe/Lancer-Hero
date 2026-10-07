(async function(){
"use strict";
/* ---------- data loading ----------
   data/index.json  : realms, chapters (ids only), heroes, prompts, image map  (small, always loaded)
   data/ch/<id>.json: {cards:{cid:card}, brief:html}  for one chapter       (loaded per chapter)
   Chapters whose realm is listed in index.preload are fetched at start; the rest load when first opened. */
const ROOT = document.getElementById("root");
ROOT.innerHTML = '<div class="wrap"><div class="pane"><p class="pixs" id="boot">Loading…</p></div></div>';
async function getJSON(url){ const r = await fetch(url, {cache:"no-cache"}); if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }
let D;
try { D = await getJSON("data/index.json"); }
catch (e) { document.getElementById("boot").textContent = "Could not load the game data (" + e.message + "). Check your connection and reload."; return; }
const CARDS = {}, LOADED = {}, LOADING = {};
D.briefs = D.briefs || {};
function loadChapter(id){
  if (LOADED[id]) return Promise.resolve();
  if (!LOADING[id]) LOADING[id] = getJSON("data/ch/" + id + ".json").then(x => { Object.assign(CARDS, x.cards || {}); if (x.brief) D.briefs[id] = x.brief; LOADED[id] = true; }).catch(e => { delete LOADING[id]; throw e; });
  return LOADING[id];
}
function ensure(ids){ return Promise.all(ids.filter(id => CH[id] && !CH[id].imported && !LOADED[id]).map(loadChapter)); }
function realmChapters(r){ const w = (D.realmInfo || [])[r] && D.realmInfo[r].villageAll ? (D.worlds || []).find(x => x.realms.includes(r)) : null; return D.chapters.filter(c => !c.imported && (w ? w.realms.includes(c.realm) : c.realm === r)).map(c => c.id); }
const HERO = {}; D.heroes.forEach(x => HERO[x.id] = x);
HERO.militia = {id:"militia", n:"Militia", c:"Recruit", r:0, role:"M", el:null, img:"u/militia.png"};
const CH = {}; D.chapters.forEach(c => CH[c.id] = c);
const RI = D.realmInfo || [], WORLDS = D.worlds || [{id:"all", name:D.title || "Campaign", sub:"", realms:D.realms.map((_, i) => i).filter(i => !(RI[i] && RI[i].packs))}];
const PACKR = RI.findIndex(r => r && r.packs);            // the realm index of Guild Packs (shared by every world)
function worldOfRealm(r){ return WORLDS.find(w => w.realms.includes(r)) || null; }
function worldById(id){ return WORLDS.find(w => w.id === id) || WORLDS[0]; }
function curWorld(){ return worldById(V.world || (S && S.world)); }
function worldRealms(w){ return w.realms.concat(PACKR >= 0 ? [PACKR] : []); }
function villagePos(r){ return RI[r] && RI[r].village; }
function villageAll(r){ return !!(RI[r] && RI[r].villageAll); }
function worldChapters(w){ return D.chapters.filter(c => !c.imported && w.realms.includes(c.realm)); }
function worldState(w){ const chs = worldChapters(w).filter(c => c.exam); return {n: chs.filter(c => chapStatus(c).cls === "clear").length, of: chs.length}; }
try { await ensure(D.chapters.filter(c => (D.preload || []).includes(c.realm)).map(c => c.id)); }
catch (e) { document.getElementById("boot").textContent = "Could not load the question data (" + e.message + "). Check your connection and reload."; return; }
const KEY = D.saveKey || "exam3-campaign-v2", L = "ABCDE", COLS = 12, ROWS = 7, FIELD = 14, SUMMON = 10, ENEMY_SECS = 30, PLAYER_SECS = 60, ENEMY_ATTACKS = 5;
const REMATCH_N = 30, LONG_N = 50, VIL = {rounds:8, wave:7, hearts:5, cap:16, x:1, y:3};
const RAR = ["Common", "Rare", "Legendary"], STARS = ["★★★", "★★★★", "★★★★★"], HEARTS = [3, 6, 10], ODDS = [0.80, 0.18, 0.02];
const ROLE = {
  V:{n:"Vanguard", rng:1, mv:3, d:"Armor blocks the first hit each battle"},
  S:{n:"Striker", rng:1, mv:5, d:"Fast melee"},
  F:{n:"Flyer", rng:1, mv:6, d:"Flies over other units"},
  R:{n:"Ranger", rng:3, mv:4, d:"Attacks from 3 tiles away"},
  C:{n:"Caster", rng:2, mv:4, d:"Attacks from 2 tiles; its element effect is stronger"},
  H:{n:"Healer", rng:2, mv:4, d:"Attacks from 2 tiles; a correct answer heals the most hurt ally by half a heart"},
  M:{n:"Militia", rng:1, mv:4, d:"One heart. Fights when no hero is left"}
};
const SKILL = {
  V:{n:"Taunt", cd:3, d:"Until your next turn every foe goes for this hero, and it gains armor"},
  S:{n:"Adrenaline", cd:4, d:"This hero acts twice this turn"},
  F:{n:"Rescue", cd:3, d:"Swap places with any ally", t:"ally"},
  R:{n:"Pin down", cd:3, d:"A foe within 3 tiles skips the next enemy phase", t:"foe"},
  C:{n:"Focus", cd:3, d:"Its next question gets 30 extra seconds and a miss costs no heart"},
  H:{n:"Mend", cd:3, d:"Heal any hero by 1 heart", t:"ally"}
};
function isElite(cid){ return hash(cid + "|elite") % 5 === 0; }
const TILE = {Fire:"burn", Ice:"frost", Nature:"bloom", Light:"ward"};
const TILEINFO = {burn:["BURN", "A foe on it cannot attack"], frost:["ICE", "Foes cannot pass"], bloom:["HEAL", "Heals a hero standing here at the start of your turn"], ward:["WARD", "Blocks the next hit on a hero standing here"]};
const FX = {Storm:["SHOCK", "Stuns the nearest other foe, which skips the next enemy phase"], Water:["TIDE", "Pushes foes within 2 tiles of the defeated foe back 2 tiles"], Sand:["HOURGLASS", "The next question, whoever takes it, gets 15 extra seconds"],
  Shadow:["SHADOWSTEP", "After its own attack: swap places with any foe you click, then attack again that turn"], Earth:["EARTHSHAPER", "After its own attack: pick up any tile on the field and put it down on any square"], Steam:["SALVAGE", "Every correct answer has a 1 in 4 chance of dropping an orb"]};
function elName(el){ return TILE[el] ? TILEINFO[TILE[el]][0] + " tile" : FX[el] ? FX[el][0] : ""; }
function elDesc(el){ return TILE[el] ? TILEINFO[TILE[el]][1] : FX[el] ? FX[el][1] : ""; }
const RESK_MS = 2 * 3600 * 1000, REALM_PRIZE = r => Math.max(15, 5 * r);
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const root = ROOT;

function hash(s){ let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
function chestCode(seed){ let x = hash("exam3|" + seed + "|chest"), s = ""; const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < 5; i++) { s += A[x % 32]; x = Math.floor(x / 32); } return s; }
function rng(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmt(t){ t = Math.max(0, Math.floor(t || 0)); const m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); }
function foeHero(cid){ return D.heroes[hash(cid) % D.heroes.length].id; }
function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function h(tag, attrs, kids){
  const e = document.createElement(tag);
  for (const k in (attrs || {})) { const v = attrs[k]; if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k === "html") e.innerHTML = v; else if (k === "on") for (const ev in v) e.addEventListener(ev, v[ev]); else e.setAttribute(k, v === true ? "" : v); }
  (kids || []).forEach(c => c && e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return e;
}
function hearts(halves){ const n = halves / 2; return "♥" + (Number.isInteger(n) ? n : n.toFixed(1)); }

/* ---------- state ---------- */
const SAVE_V = 4;
// Each entry upgrades a save from version k to k+1. Add a new function here whenever the save shape changes; never edit old ones.
const MIGRATIONS = {
  3: s => { s.v = 4; s.meta = {created: s.meta && s.meta.created || Date.now(), site: 1}; return s; }
};
function upgrade(x){ if (!x || typeof x.v !== "number" || x.v < 3 || x.v > SAVE_V) return null; while (x.v < SAVE_V) { const m = MIGRATIONS[x.v]; if (!m) return null; x = m(x); } return x; }
function fresh(){ return {v:SAVE_V, meta:{created:Date.now(), site:1}, cards:{}, orbs:60, heroes:{}, team:[], exams:{}, stats:{ans:0, ok:0}, sk:0, pulls:0, fallen:[], skw:{}, rem:{}, rsk:{}, rw:{}, vil:{}, vx:{}, gifts:{}, started:false}; }
function migrate(x){ const s = fresh(); s.cards = x.cards || {}; s.sk = x.sk || 0; return s; }
function load(){
  let s = null;
  try { s = upgrade(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) {}
  if (!s) s = fresh();
  for (const k of ["cards", "heroes", "exams", "skw", "rem", "rsk", "rw", "vil", "vx", "gifts"]) s[k] = s[k] || {};
  s.team = s.team || []; s.fallen = s.fallen || []; s.stats = s.stats || {ans:0, ok:0};
  if (!s.started) { D.starters.forEach(id => { if (!s.heroes[id]) s.heroes[id] = {exp:0, mg:0}; }); s.started = true; }
  return s;
}
let S = load();
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function C(id){ return S.cards[id] || (S.cards[id] = {s:0, m:false, n:0, w:0}); }
function grant(hid){ if (S.heroes[hid]) { S.heroes[hid].mg = Math.min(3, (S.heroes[hid].mg || 0) + 1); return true; } S.heroes[hid] = {exp:0, mg:0}; return false; }
function nm(hid){ const x = S.heroes[hid]; return (x && x.nm) || (HERO[hid] ? HERO[hid].n : String(hid)); }
function fname(x){ return HERO[x] ? HERO[x].n : String(x); }
function lv(hid){ const x = S.heroes[hid]; return x ? Math.min(20, 1 + Math.floor((x.exp || 0) / 100)) : 1; }
function addExp(hid, n){ if (S.heroes[hid]) S.heroes[hid].exp = (S.heroes[hid].exp || 0) + n; }
function maxHalves(hid){ if (hid === "militia") return 2; const l = lv(hid), x = S.heroes[hid] || {}; return 2 * (HEARTS[HERO[hid].r] + (l >= 5 ? 1 : 0) + (l >= 10 ? 1 : 0) + (x.mg || 0)); }
function owned(){ return Object.keys(S.heroes).filter(id => HERO[id] && id !== "militia"); }
function team(){
  const own = owned(); let t = (S.team || []).filter(id => own.includes(id)).slice(0, 4);
  const rest = own.filter(id => !t.includes(id)).sort((a, b) => HERO[b].r - HERO[a].r || (S.heroes[b].exp || 0) - (S.heroes[a].exp || 0));
  while (t.length < 4 && rest.length) t.push(rest.shift());
  return t;
}
function exam(c){ return S.exams[c.id]; }
function chestOpen(c){ const ex = exam(c); return !!(ex && ex.done && (ex.chest || ex.chest === undefined)); }
function poolNote(c){
  const ex = exam(c); if (!(c.exam && ex && ex.done)) return "";
  let m = 0, f = 0; c.exam.forEach((id, i) => { if (!CARDS[id]) return; if (ex.a[i] !== CARDS[id].a) m++; else if (ex.f[i]) f++; });
  const r = pool(c).length - m - f;
  return " (" + m + " missed" + (f ? ", " + f + " flagged" : "") + (r > 0 ? ", " + r + " from rematches and the village" : "") + ")";
}
function pool(c){
  const ids = (c.seeds || []).slice(); const ex = exam(c);
  if (c.exam && ex && ex.done) c.exam.forEach((id, i) => { if (CARDS[id] && (ex.a[i] !== CARDS[id].a || ex.f[i])) ids.push(id); });
  const r = S.rem[c.id]; ((r && r.x) || []).concat(S.vx[c.id] || []).forEach(id => { if (CARDS[id] && !ids.includes(id)) ids.push(id); });
  return ids;
}
function bankOf(c){ return (c.exam || []).concat((c.bank || []).filter(id => CARDS[id])); }
function chOf(cid){ return D.chapters.find(c => (c.exam || []).includes(cid) || (c.bank || []).includes(cid)); }
function pct(a, n){ return n ? Math.round(100 * a / n) : 0; }
function answered(ex, n){ let k = 0; for (let i = 0; i < n; i++) if (ex.a[i] != null) k++; return k; }
function imgSrc(card){ return card.src || D.imgs[card.img]; }

/* ---------- imported packs (IndexedDB) ---------- */
const PACKS = {};
function idb(){ return new Promise((res, rej) => { try { const r = indexedDB.open("exam3-campaign-packs", 1); r.onupgradeneeded = () => r.result.createObjectStore("packs", {keyPath:"id"}); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
function idbAll(){ return idb().then(db => new Promise((res, rej) => { const q = db.transaction("packs").objectStore("packs").getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); })); }
function idbPut(p){ return idb().then(db => new Promise((res, rej) => { const t = db.transaction("packs", "readwrite"); t.objectStore("packs").put(p); t.oncomplete = res; t.onerror = () => rej(t.error); })); }
function idbDel(id){ return idb().then(db => new Promise((res, rej) => { const t = db.transaction("packs", "readwrite"); t.objectStore("packs").delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); })); }
function mdToHtml(md){
  const inline = t => esc(t).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const lines = String(md || "").replace(/\r/g, "").split("\n"); let out = "", i = 0;
  const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(x => x.trim());
  while (i < lines.length) { const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const hm = /^(#{1,4})\s+(.*)$/.exec(l); if (hm) { const n = Math.min(3, hm[1].length); out += "<h" + n + ">" + inline(hm[2]) + "</h" + n + ">"; i++; continue; }
    if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      out += '<div class="tw"><table><thead><tr>' + cells(l).map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>"; i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) { out += "<tr>" + cells(lines[i]).map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>"; i++; }
      out += "</tbody></table></div>"; continue; }
    if (/^\s*(\d+\.|[-*])\s+/.test(l)) { const ol = /^\s*\d+\./.test(l); out += ol ? "<ol>" : "<ul>";
      while (i < lines.length && /^\s*(\d+\.|[-*])\s+/.test(lines[i])) { out += "<li>" + inline(lines[i].replace(/^\s*(\d+\.|[-*])\s+/, "")) + "</li>"; i++; }
      out += ol ? "</ol>" : "</ul>"; continue; }
    let para = l; i++; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*\||\s*(\d+\.|[-*])\s)/.test(lines[i])) { para += " " + lines[i]; i++; }
    out += "<p>" + inline(para) + "</p>";
  }
  return out;
}
function validatePack(p){
  if (!p || p.format !== "exam-campaign-pack") return "This file is not a quiz pack (format must be exam-campaign-pack).";
  if (!p.id || !/^[\w-]{1,40}$/.test(p.id)) return "The pack needs an id made of letters, digits, hyphens or underscores.";
  if (!Array.isArray(p.questions) || !p.questions.length) return "The pack has no questions.";
  for (let i = 0; i < p.questions.length; i++) { const q = p.questions[i], n = "Question " + (i + 1) + ": ";
    if (!q || typeof q.stem !== "string" || !q.stem.trim()) return n + "missing stem.";
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5 || q.options.some(o => typeof o !== "string")) return n + "needs 2 to 5 text options.";
    if (typeof q.correct !== "string" || q.correct.trim().length !== 1 || L.indexOf(q.correct.trim().toUpperCase()) < 0 || L.indexOf(q.correct.trim().toUpperCase()) >= q.options.length) return n + "correct must be the letter of one of its options.";
    if (q.image && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(q.image)) return n + "image must be a data URI.";
  }
  return null;
}
function dropBank(pid){ const pre = "pk_" + pid + ":"; D.chapters.forEach(c => { if (c.bank) c.bank = c.bank.filter(id => id.indexOf(pre) !== 0); }); D.misc = (D.misc || []).filter(id => id.indexOf(pre) !== 0); }
function registerPack(p, shared){
  if (PACKS[p.id]) unregisterPack(p.id);
  const id = "pk_" + p.id, ids = [];
  p.questions.forEach((q, i) => { const cid = id + ":" + (i + 1);
    CARDS[cid] = {q:q.stem, o:q.options, a:L.indexOf(q.correct.trim().toUpperCase()), r:String(q.rule || ""), p:q.page == null ? "-" : q.page, lo:q.lo == null ? null : q.lo, src:q.image || null, alt:q.alt || ""}; ids.push(cid); });
  if (p.bank) { const by = {}; D.misc = D.misc || [];
    p.questions.forEach((q, i) => { const c = CH[q.chapter] && !CH[q.chapter].imported ? CH[q.chapter] : (CH[p.chapter] && !CH[p.chapter].imported ? CH[p.chapter] : null);
      if (c) { (c.bank = c.bank || []).push(ids[i]); by[c.short] = (by[c.short] || 0) + 1; } else { D.misc.push(ids[i]); by.Unsorted = (by.Unsorted || 0) + 1; } });
    PACKS[p.id] = {id:p.id, name:String(p.name || p.id), n:ids.length, author:String(p.author || ""), shared:!!shared, bank:true, by};
    return; }
  const n = Object.keys(PACKS).length, cand = D.heroes.filter(x => x.r < 2);
  const c = {id, name:String(p.name || p.id), short:String(p.short || p.name || p.id).slice(0, 16), realm:2, pos:[14 + (n % 5) * 18, 24 + Math.floor(n / 5) % 4 * 17], brief: p.tables_md ? id : null, seeds:[], exam:ids, emblem:cand[hash(id) % cand.length].id, imported:true, author:String(p.author || "")};
  if (p.tables_md) D.briefs[id] = mdToHtml(p.tables_md);
  if (!CH[id]) D.chapters.push(c); else D.chapters[D.chapters.findIndex(x => x.id === id)] = c;
  CH[id] = c; PACKS[p.id] = {id:p.id, name:c.name, n:ids.length, author:c.author, shared:!!shared};
}
/* shared pack library: Firestore (config in index.json "firebase"). Everyone signed in anonymously can read; writing needs the guild passphrase,
   whose SHA-256 is checked by the Firestore rules (see firestore.rules in the repo). A pack is stored as meta doc + text chunks. */
let SDB = null, FS = null, canShare = null, UID = null; const SHARED = {}, CHUNK = 80000, GKEY = "gr-guild";
function guildPhrase(){ try { return localStorage.getItem(GKEY) || ""; } catch (e) { return ""; } }
function setGuildPhrase(v){ try { if (v) localStorage.setItem(GKEY, v); else localStorage.removeItem(GKEY); } catch (e) {} canShare = !!v; }
async function sha256(t){ const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join(""); }
async function sharedInit(){
  try {
    if (!D.firebase) return;
    const ver = "10.14.1", base = "https://www.gstatic.com/firebasejs/" + ver + "/";
    const [app, auth, fs] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]);
    const a = app.initializeApp(D.firebase); FS = fs; SDB = fs.getFirestore(a);
    const u = await auth.signInAnonymously(auth.getAuth(a)); UID = u.user.uid;
    canShare = !!guildPhrase();
    fs.onSnapshot(fs.query(fs.collection(SDB, "packs"), fs.limit(300)), snap => { syncShared(snap); }, () => {});
  } catch (e) { SDB = null; }
}
async function syncShared(snap){
  const seen = {}; let changed = false;
  for (const d of snap.docs) { const meta = d.data(); if (!meta || meta.deleted) continue; seen[d.id] = true; if (!meta.chunks || SHARED[d.id] === meta.rev) continue;
    try { const q = await FS.getDocs(FS.collection(SDB, "packs", d.id, "chunks")); if (q.docs.length < meta.chunks) continue;
      const text = q.docs.slice().sort((x, y) => x.id < y.id ? -1 : 1).slice(0, meta.chunks).map(x => (x.data() || {}).d || "").join("");
      const p = JSON.parse(text); if (validatePack(p) || p.id !== d.id) continue; registerPack(p, true); PACKS[p.id].uid = meta.by; SHARED[d.id] = meta.rev; changed = true; } catch (e) {} }
  for (const id in SHARED) if (!seen[id]) { delete SHARED[id]; if (PACKS[id] && PACKS[id].shared) { unregisterPack(id); changed = true; } }
  if (changed && V.name === "world" && !B) render();
}
async function sharePack(p){
  if (!SDB) return "offline"; const ph = guildPhrase(); if (!ph) return "nokey";
  const key = await sha256(ph), text = JSON.stringify(p), n = Math.ceil(text.length / CHUNK);
  if (n > 40) return "big";
  try {
    for (let i = 0; i < n; i++) await FS.setDoc(FS.doc(SDB, "packs", p.id, "chunks", "c" + String(i).padStart(4, "0")), {d:text.slice(i * CHUNK, (i + 1) * CHUNK), key});
    await FS.setDoc(FS.doc(SDB, "packs", p.id), {name:String(p.name || p.id).slice(0, 80), n:p.questions.length, author:String(p.author || "").slice(0, 60), chunks:n, rev:Date.now(), by:UID, key, deleted:false});
    SHARED[p.id] = null; return "shared";
  } catch (e) { return e && /permission/i.test(String(e.code || e.message)) ? "denied" : "error"; }
}
async function unsharePack(pid){
  if (!SDB) return false; const ph = guildPhrase(); if (!ph) return false;
  try { await FS.setDoc(FS.doc(SDB, "packs", pid), {deleted:true, rev:Date.now(), key:await sha256(ph), by:UID, name:"", n:0, author:"", chunks:0}); return true; } catch (e) { return false; }
}
function unregisterPack(pid){ dropBank(pid); const id = "pk_" + pid; const k = D.chapters.findIndex(x => x.id === id); if (k >= 0) D.chapters.splice(k, 1); delete CH[id]; delete PACKS[pid]; }
/* ---------- views ---------- */
let V = {name:"worlds", world:null, realm:0, ch:null, focus:null}, B = null, Q = null, lastSum = null, lastRem = null, lastVil = null, lastPull = null, realmNote = "", armed = null, note = "";
function go(name, extra){
  const nx = Object.assign({}, V, {name}, extra || {});
  if (name === "world") { const w = worldById(nx.world || S.world); nx.world = w.id; if (S.world !== w.id) { S.world = w.id; save(); } if (!worldRealms(w).includes(nx.realm) || (!(extra && extra.realm != null) && (w.id !== V.world || V.name === "worlds"))) nx.realm = worldRealms(w)[0]; }
  const need = nx.ch && CH[nx.ch] && !LOADED[nx.ch] && !CH[nx.ch].imported ? [nx.ch] : name === "world" && nx.realm != null ? realmChapters(nx.realm).filter(id => !LOADED[id]) : [];
  if (need.length) { note = "Loading…"; render(); ensure(need).then(() => { V = nx; armed = null; note = ""; render(); window.scrollTo(0, 0); }).catch(() => { note = "Could not load that chapter. Check your connection."; render(); }); return; }
  V = nx; armed = null; note = ""; render(); window.scrollTo(0, 0);
}
function realmState(r){ const chs = D.chapters.filter(c => c.realm === r && !c.imported); return {n: chs.filter(c => chapStatus(c).cls === "clear").length, of: chs.length, prize: REALM_PRIZE(chs.length)}; }
function checkRealms(){ D.realms.forEach((_, r) => { if (RI[r] && RI[r].packs) return; if (!D.realms[r] || S.rw[r]) return; const st = realmState(r); if (st.of && st.n === st.of) { S.rw[r] = Date.now(); S.orbs += st.prize; realmNote = D.realms[r].split(":")[0] + " is fully cleared: ◆ " + st.prize + " orbs collected."; save(); } }); }
function render(){
  if (!B) checkRealms();
  root.textContent = "";
  const wrap = h("div", {class:"wrap"});
  wrap.appendChild(topbar());
  wrap.appendChild(VIEWS[V.name]());
  root.appendChild(wrap);
  if (V.name === "battle") drawField();
}
function topbar(){
  const acc = S.stats.ans ? Math.round(100 * S.stats.ok / S.stats.ans) + "%" : "-";
  const tabs = [["worlds","Worlds"],["world","Map"],["roster","Roster"],["summon","Summon"],["report","Report"]];
  return h("div", {class:"top"}, [
    h("div", {}, [h("h1", {text:D.title || "Campaign"}),
      h("div", {class:"stats"}, [
        h("span", {}, ["Orbs ", h("b", {class:"orb", text:"◆ " + S.orbs})]),
        h("span", {}, ["Heroes ", h("b", {text:owned().length + "/" + D.heroes.length})]),
        h("span", {}, ["Fallen ", h("b", {text:String(S.fallen.length)})]),
        h("span", {}, ["Accuracy ", h("b", {text:acc})])])]),
    h("nav", {}, tabs.map(([k, t]) => h("button", {class:V.name === k ? "on" : "", text:t, on:{click:() => leaveTo(k)}})))
  ]);
}
function leaveTo(k){ if (B) { if (Q && Q.timer) clearInterval(Q.timer); save(); B = null; Q = null; } go(k); }
function emblemChip(c){ const hr = HERO[c.emblem]; return h("span", {class:"emb", title:hr.n + ", " + hr.c}, [h("img", {src:hr.img, alt:""}), h("span", {text: (S.skw[c.id] ? "Recruited: " : "Emblem: ") + hr.n})]); }
function chapStatus(c){
  const ex = exam(c), p = pool(c);
  if (c.exam && !(ex && ex.done)) { const k = ex ? answered(ex, c.exam.length) : 0; return {cls:"", tag: k ? ["In progress " + k + "/" + c.exam.length, "g"] : ["New battle", "r"], p}; }
  if (S.skw[c.id] || (c.exam && !p.length)) return {cls:"clear", tag:[c.exam ? ex.score + "/" + c.exam.length + " · cleared" : "Cleared", ""], p};
  return {cls:"done", tag: c.exam ? [ex.score + "/" + c.exam.length, "g"] : ["Graded in chat", "d"], p};
}
function world(){
  const box = h("div", {class:"list"}), W = curWorld(), wr = worldRealms(W);
  box.appendChild(h("div", {class:"row wname"}, [h("button", {text:"‹ Worlds", on:{click:() => go("worlds")}}), h("span", {class:"wttl", text:W.name})]));
  box.appendChild(h("div", {class:"row"}, wr.filter(i => D.realms[i]).map(i => h("button", {class:V.realm === i ? "on" : "", text:D.realms[i], on:{click:() => go("world", {realm:i, focus:null})}}))));
  if (!W.realms.length && V.realm === PACKR) box.appendChild(h("div", {class:"chap"}, [h("div", {class:"nm", text:"Nothing here yet"}), h("div", {class:"muted", text:"Maps for this chapter appear as lectures are added. Guild packs are available everywhere."})]));
  if (realmNote) { box.appendChild(h("div", {class:"fb", text:realmNote})); realmNote = ""; }
  if (V.realm !== PACKR) { const rs = realmState(V.realm); if (rs.of) box.appendChild(h("div", {class:"pixs", text: S.rw[V.realm] ? "Realm cleared. ◆ " + rs.prize + " collected." : rs.n + " of " + rs.of + " battles cleared (green). Clear them all for ◆ " + rs.prize + "."})); }
  const map = h("div", {class:"wmap", role:"group", "aria-label":"World map"}); map.style.backgroundImage = "url(" + ((RI[V.realm] && RI[V.realm].map) || "m/map1.jpg") + ")";
  const chs = D.chapters.filter(c => c.realm === V.realm);
  if (V.realm === PACKR) chs.slice().sort((x, y) => x.id < y.id ? -1 : 1).forEach((c, i) => { c.pos = [14 + (i % 5) * 18, 24 + (Math.floor(i / 5) % 4) * 17]; });
  chs.forEach(c => { const st = chapStatus(c);
    const n = h("button", {class:"node " + st.cls + (V.focus === c.id ? " focus" : ""), on:{click:() => { V.focus = c.id; render(); const el = document.getElementById("ch-" + c.id); if (el) el.scrollIntoView({block:"center"}); }}}, [h("span", {class:"flag"}), h("span", {class:"lbl", text:c.short})]);
    n.style.left = c.pos[0] + "%"; n.style.top = c.pos[1] + "%"; map.appendChild(n); });
  if (villagePos(V.realm)) { const n = h("button", {class:"node vil", on:{click:() => { const e2 = document.getElementById("ch-vil"); if (e2) e2.scrollIntoView({block:"center"}); }}}, [h("span", {class:"flag"}), h("span", {class:"lbl", text:"Village"})]); n.style.left = villagePos(V.realm)[0] + "%"; n.style.top = villagePos(V.realm)[1] + "%"; map.appendChild(n); }
  D.locked.filter(c => c.realm === V.realm).forEach(c => { const n = h("div", {class:"node lock"}, [h("span", {class:"flag"}), h("span", {class:"lbl", text:c.short})]); n.style.left = c.pos[0] + "%"; n.style.top = c.pos[1] + "%"; map.appendChild(n); });
  box.appendChild(map);
  if (V.realm === PACKR) box.appendChild(importPanel());
  if (villagePos(V.realm)) { const v = S.vil[V.realm] || {n:0, wins:0}, nq = villageIds(V.realm).length, all = villageAll(V.realm);
    box.appendChild(h("div", {class:"chap", id:"ch-vil"}, [
      h("div", {class:"nm"}, ["Village defense", h("span", {class:"tag " + (v.wins ? "" : "g"), text: v.n ? "Held " + v.wins + " of " + v.n : "New"})]),
      h("div", {class:"muted", text:"Hold the village for " + VIL.rounds + " rounds while " + VIL.wave + " foes a round march on it. Questions are mixed from " + (all ? "every battle in this chapter, weighted like the exam" : "every battle on this map") + ". Reward for holding: ◆ " + (all ? 20 : 15) + " plus 1 per village heart left."}),
      h("div", {class:"row"}, [h("button", {class:"go", text:"Defend the village", disabled:!nq, on:{click:() => startVillage(V.realm)}})])])); }
  chs.forEach(c => { const st = chapStatus(c), ex = exam(c), done = c.exam && ex && ex.done;
    const btns = [];
    if (c.brief) btns.push(h("button", {text:"Briefing", on:{click:() => go("brief", {ch:c.id})}}));
    if (c.exam && !done) btns.push(h("button", {class:"go", text: ex && answered(ex, c.exam.length) ? "Resume battle" : "Battle: " + c.exam.length + " questions", on:{click:() => startExam(c.id)}}));
    if (done) btns.push(h("button", {class: chestOpen(c) ? "" : "go", text: chestOpen(c) ? "Results" : "Results and chest", on:{click:() => go("after", {ch:c.id})}}));
    const canSk = st.p.length && (!c.exam || chestOpen(c));
    if (canSk) { btns.push(h("button", {class: S.skw[c.id] ? "" : "go", text: S.skw[c.id] ? "Re-skirmish: " + st.p.length + " foes" + (reskWait(c) ? " · pays in " + waitText(reskWait(c)) : " · up to ◆ " + Math.min(5, Math.ceil(st.p.length / 3))) : "Skirmish: " + st.p.length + " foes" + poolNote(c), on:{click:() => startSkirmish(c.id)}})); }
    if (done && chestOpen(c)) { const r = S.rem[c.id], bank = bankOf(c).length, bp = r && r.n ? (r.bestp != null ? r.bestp : pct(r.best || 0, c.exam.length)) : null;
      btns.push(h("button", {text:"Rematch: " + Math.min(REMATCH_N, bank) + " of " + bank + (bp != null ? " · best " + bp + "%" : ""), on:{click:() => startRematch(c.id)}}));
      if (bank > REMATCH_N + 5) btns.push(h("button", {text:"Long rematch: " + Math.min(LONG_N, bank), on:{click:() => startRematch(c.id, LONG_N)}})); }
    if (st.p.length || (c.exam && !done)) btns.push(emblemChip(c));
    const sub = c.exam && !done ? "Read the briefing, then fight. Every answer is graded on the spot."
      : done && !chestOpen(c) ? "Chest locked. Paste the report into the chat; the debrief ends with the code."
      : st.p.length ? (S.skw[c.id] ? "Skirmish cleared. Re-skirmishes and rematches pay a few orbs." : "Clear every missed question, and every one you flagged unsure or guessed, in one skirmish to recruit the emblem hero.") : (done && chestOpen(c) ? "No misses or flags. A rematch is open." : "No misses or flags. Nothing left to fight here.");
    box.appendChild(h("div", {class:"chap" + (V.focus === c.id ? " focus" : ""), id:"ch-" + c.id}, [
      h("div", {class:"nm"}, [c.name, h("span", {class:"tag " + st.tag[1], text:st.tag[0]})]),
      h("div", {class:"muted", text:sub}),
      h("div", {class:"row"}, btns)]));
  });
  const lk = D.locked.filter(c => c.realm === V.realm);
  if (lk.length) box.appendChild(h("div", {class:"chap lock"}, [h("div", {class:"nm", text:"Not scouted yet"}), h("div", {class:"muted", text:lk.map(c => c.name).join(", ")})]));
  return box;
}
function importFiles(input, asBank, defCh){
  const fs = Array.from(input.files || []); let msgs = [];
  Promise.all(fs.map(f => f.text().then(t => { let p; try { p = JSON.parse(t); } catch (e) { msgs.push(f.name + ": not valid JSON."); return; }
    const err = validatePack(p); if (err) { msgs.push(f.name + ": " + err); return; }
    if (asBank) { p.bank = true; if (!p.name) p.name = p.id; p.questions.forEach(q => { if (!(CH[q.chapter] && !CH[q.chapter].imported) && defCh) q.chapter = defCh; }); }
    else if (p.bank) delete p.bank;
    const local = idbPut(p).then(() => true, () => false);
    return local.then(kept => { registerPack(p); return sharePack(p).then(r => { if (r === "shared") { PACKS[p.id].shared = true; PACKS[p.id].uid = UID; }
      const by = PACKS[p.id].by, where = by ? " Sorted into: " + Object.keys(by).map(k => k + " " + by[k]).join(", ") + "." : "";
      const tail = r === "shared" ? "Shared with the guild: everyone who opens the game gets it." : r === "nokey" ? "Saved on this device only. Enter the guild passphrase below to share it with everyone." : r === "denied" ? "Saved on this device only: the guild passphrase is wrong." : r === "big" ? "Saved on this device only: too large to share (shrink the images)." : r === "offline" ? "Saved on this device only (the shared library could not be reached)." : kept ? "Saved on this device only." : "Kept for this visit only (browser storage refused it).";
      msgs.push(f.name + ": " + (asBank ? "added " + p.questions.length + " questions to the bank." + where + " " : "imported " + p.questions.length + " questions. ") + tail); }); }); })))
    .then(() => { note = msgs.join(" "); const n = note; render(); note = n; });
}
function importPanel(){
  const file = h("input", {type:"file", accept:".json,application/json", multiple:true, "aria-label":"Pack files"});
  file.addEventListener("change", () => importFiles(file, false));
  const lect = D.chapters.filter(c => !c.imported && c.exam);
  const sel = h("select", {"aria-label":"Lecture for questions that name none"}, [h("option", {value:"", text:"Unsorted (mixed village only)"})].concat(lect.map(c => h("option", {value:c.id, text:c.short}))));
  const bfile = h("input", {type:"file", accept:".json,application/json", multiple:true, "aria-label":"Question bank files"});
  bfile.addEventListener("change", () => importFiles(bfile, true, sel.value));
  const packs = Object.values(PACKS), extra = D.chapters.reduce((a, c) => a + (c.imported ? 0 : (c.bank || []).length), 0) + (D.misc || []).length;
  const who = !SDB ? "Files stay in this browser." : canShare ? "Files you add are shared with the guild and appear for everyone who opens the game." : "Shared guild files appear here for everyone. To share your own, enter the guild passphrase.";
  const gp = h("input", {type:"password", placeholder:"Guild passphrase", value:guildPhrase(), "aria-label":"Guild passphrase", autocomplete:"off"});
  const gbtn = h("button", {text:guildPhrase() ? "Change" : "Save", on:{click:() => { setGuildPhrase(gp.value.trim()); note = gp.value.trim() ? "Passphrase saved on this device. New uploads will be shared." : "Passphrase cleared. Uploads stay on this device."; const n = note; render(); note = n; }}});
  const guildRow = SDB ? h("div", {class:"row"}, [gp, gbtn, h("span", {class:"pixs", text:"Needed only to share or delete shared files. Ask the game's owner for it."})]) : null;
  return h("div", {class:"chap"}, [
    h("div", {class:"nm"}, ["Question bank", h("span", {class:"tag g", text:extra + " extra questions"})]),
    h("div", {class:"muted", text:"Upload questions in bulk. They are sorted into lectures by each question's chapter field and feed rematches and village defense; first battles do not change. Any AI can turn raw questions into a bank file with the prompt below. " + who}),
    h("div", {class:"row"}, [bfile, h("label", {class:"pixs"}, ["Questions with no lecture go to ", sel]), copyBtn(() => D.bankPrompt, "Copy bank-maker prompt")]),
    h("div", {class:"nm", text:"Import quiz packs"}),
    h("div", {class:"muted", text:"A pack is one file with a lecture's questions, answer key, tables and images. It becomes its own battle on this map. Anyone can make one with their own AI using the prompt below."}),
    h("div", {class:"row"}, [file, copyBtn(() => D.packPrompt, "Copy pack-maker prompt")]),
    guildRow,
    note ? h("div", {class:"fb", text:note}) : null,
    packs.length ? h("div", {class:"row"}, packs.map(p => { const label = (p.bank ? "bank: " : "pack: ") + p.name + (p.bank ? " (" + p.n + ")" : "");
      const mine = !p.shared || p.uid === UID || canShare;
      return !mine ? h("span", {class:"emb", text:"Shared " + label + (p.author ? " by " + p.author : "")}) : h("button", {text: armed === "del:" + p.id ? "Click again to delete " + p.name + (p.shared ? " for everyone" : "") : "Delete " + (p.shared ? "shared " : "") + label, on:{click:() => { if (armed === "del:" + p.id) { const sh = p.shared; idbDel(p.id).catch(() => {}).then(() => sh ? unsharePack(p.id) : true).then(ok => { if (sh && !ok) { note = "Could not delete the shared copy (check the guild passphrase); removed from this device only."; } delete SHARED[p.id]; unregisterPack(p.id); armed = null; const n = note; render(); note = n; }); } else { armed = "del:" + p.id; render(); } }}}); })) : null]);
}
function brief(){
  const c = CH[V.ch], ex = exam(c);
  const act = c.exam && !(ex && ex.done) ? h("button", {class:"go", text:"Begin battle", on:{click:() => startExam(c.id)}}) : null;
  return h("div", {class:"panel"}, [
    h("div", {class:"brief", html:D.briefs[c.brief]}),
    h("div", {class:"sticky"}, [h("button", {text:"World map", on:{click:() => go("world")}}), act])]);
}

/* ---------- battle engine ---------- */
function mkUnit(hid, x, y){ const hr = HERO[hid], ro = ROLE[hr.role]; return {hid, x, y, hp:maxHalves(hid), max:maxHalves(hid), mv:ro.mv, rng:ro.rng, role:hr.role, el:hr.el, acted:false, moved:false, out:false, armor:hr.role === "V", insight:hr.r === 2, cd:0, taunt:false, focus:false}; }
function mkUnits(mode){
  const spots = mode === "village" ? [[2,2],[2,4],[3,3],[1,2]] : [[1,1],[0,2],[0,4],[1,5]], t = team();
  if (!t.length) return spots.slice(0, 3).map(s => mkUnit("militia", s[0], s[1]));
  return t.map((hid, i) => mkUnit(hid, spots[i][0], spots[i][1]));
}
function newBattle(mode, c, ids, queue, rex){
  B = {mode, c, ids, queue, rematch:!!rex, extra:0, pend:null, vil: mode === "village" ? {x:VIL.x, y:VIL.y} : null, vhp:VIL.hearts, breach:0, drops:0, t0:Date.now(),
    ex: rex || (mode === "exam" ? S.exams[c.id] : null), units:mkUnits(mode), foes:[], tiles:[], turn:1, phase:"player", sel:null, busy:false, paused:false, log:[], cleared:{}, fell:[], el:null, used:new Set()};
  B.units.forEach(u => B.used.add(u.hid));
  if (mode === "village") spawnWave(VIL.wave); else spawnMore();
  go("battle"); banner(mode === "village" ? "Round 1 of " + VIL.rounds : "Turn 1");
}
function startExam(chId){
  const c = CH[chId]; const ex = S.exams[chId] || (S.exams[chId] = {a:[], f:[], x:[], t:0, done:false});
  ex.x = ex.x || [];
  const queue = []; c.exam.forEach((id, i) => { if (ex.a[i] == null) queue.push(i); });
  if (!queue.length) { B = {mode:"exam", c, ids:c.exam, ex, units:[]}; return finishExam(); }
  newBattle("exam", c, c.exam, queue);
}
function startRematch(chId, n){
  const c = CH[chId]; if (!c || !c.exam) return;
  const ids = shuffle(bankOf(c)).slice(0, n || REMATCH_N);
  newBattle("exam", c, ids, ids.map((_, i) => i), {a:[], f:[], x:[], t:0, done:false, ids});
}
function villageIds(r){
  const w = worldOfRealm(r), chs = D.chapters.filter(c => !c.imported && c.exam && (villageAll(r) && w ? w.realms.includes(c.realm) : c.realm === r)), need = VIL.rounds * VIL.wave + 30;
  const all = fn => shuffle([].concat(...chs.filter(fn).map(bankOf)));
  if (!villageAll(r)) return all(() => true).slice(0, need);
  // weighting comes from realmInfo[r].weights: [{ch:"anat", w:8}, {realm:0, w:39}, ...]; a chapter named in one group is left out of realm groups. Default: realms weighted equally.
  const wts = (RI[r] && RI[r].weights) || (w ? w.realms.map(x => ({realm:x, w:1})) : []), named = wts.filter(x => x.ch).map(x => x.ch);
  const grp = wts.map(x => ({ids: all(c => x.ch ? c.id === x.ch : c.realm === x.realm && !named.includes(c.id)), w:x.w}));
  if ((D.misc || []).length) grp.push({ids: shuffle(D.misc.filter(id => CARDS[id])), w:6});
  const out = [];
  while (out.length < need) { const live = grp.filter(g => g.ids.length); if (!live.length) break;
    let t = Math.random() * live.reduce((a, g) => a + g.w, 0), g = live[live.length - 1]; for (const x of live) { if (t < x.w) { g = x; break; } t -= x.w; }
    out.push(g.ids.pop()); }
  return out;
}
function startVillage(r){
  const ids = villageIds(r); if (!ids.length) return;
  const c = {id:"vil" + r, name:"Village defense: " + D.realms[r].split(":")[0], realm:r, pos:villagePos(r) || [50, 50], prize: villageAll(r) ? 20 : 15, village:true};
  S.sk++; save();
  newBattle("village", c, ids, ids.map((_, i) => i));
}
function spawnWave(n){
  let k = 0;
  while (k < n && B.queue.length && liveFoes().length < VIL.cap) {
    let x, y, g = 0; do { x = COLS - 1 - Math.floor(Math.random() * 3); y = Math.floor(Math.random() * ROWS); g++; } while ((occupied(x, y, null) || tileAt(x, y)) && g < 300);
    if (occupied(x, y, null)) break;
    const i = B.queue.shift(), cid = B.ids[i], hero = foeHero(cid), ro = ROLE[HERO[hero].role];
    B.foes.push({i, cid, hero, x, y, on:true, boss:false, elite:isElite(cid), rng:ro.rng, mv:isElite(cid) ? 4 : Math.min(3, ro.mv), stag:false, key:"f" + i + "_" + (B.spawned = (B.spawned || 0) + 1)}); k++;
  }
  return k;
}
function reskWait(c){ return Math.max(0, RESK_MS - (Date.now() - (S.rsk[c.id] || 0))); }
function waitText(ms){ const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min"; }


function fx(x, y, text, cls){ if (!B) return; (B.fxq = B.fxq || []).push({x, y, text, cls}); if (!Q) flushFx(); }
function flushFx(){
  if (!B || !B.el || !B.fxq || !B.fxq.length) return; const F = B.el.field;
  B.fxq.splice(0).forEach((e, k) => setTimeout(() => { if (!B || !B.el || B.el.field !== F) return;
    const fl = h("div", {class:"fxf " + e.cls}); fl.style.left = (e.x * 100 / COLS) + "%"; fl.style.top = (e.y * 100 / ROWS) + "%"; F.appendChild(fl); setTimeout(() => fl.remove(), 950);
    if (e.text) { const d = h("div", {class:"fxp " + e.cls, text:e.text}); d.style.left = ((e.x + 0.5) * 100 / COLS) + "%"; d.style.top = (e.y * 100 / ROWS) + "%"; F.appendChild(d); setTimeout(() => d.remove(), 1600); } }, k * 160));
}
function tide(f, steps){
  let n = 0;
  liveFoes().filter(o => o !== f && md(o, f) <= 2).sort((a, b) => b.x - a.x).forEach(o => { let mv = false;
    for (let k = 0; k < steps; k++) { if (inside(o.x + 1, o.y) && !occupied(o.x + 1, o.y, o)) { fx(o.x, o.y, "", "tide"); o.x++; mv = true; } else break; } if (mv) { n++; fx(o.x, o.y, "TIDE", "tide"); } });
  return n;
}
function applyEl(u, f, enemy){
  const el = u.el, big = u.role === "C";
  if (TILE[el]) { if (tileAt(f.x, f.y)) return ""; B.tiles.push({x:f.x, y:f.y, k:TILE[el], ttl: big ? 5 : 3}); fx(f.x, f.y, TILEINFO[TILE[el]][0], TILE[el]); return " " + TILEINFO[TILE[el]][0] + " tile left behind."; }
  if (el === "Storm") { const o = liveFoes().filter(x => x !== f && !x.stun).sort((a, b) => md(a, f) - md(b, f))[0]; if (!o) return ""; o.stun = (B.phase === "enemy" ? 2 : 1) + (big ? 1 : 0); fx(f.x, f.y, "", "shock"); fx(o.x, o.y, "SHOCK", "shock"); return " Shock: a nearby foe is stunned."; }
  if (el === "Water") { fx(f.x, f.y, "", "tide"); const n = tide(f, big ? 3 : 2); return n ? " Tide: " + n + (n === 1 ? " foe is" : " foes are") + " pushed back." : ""; }
  if (el === "Sand") { B.extra = big ? 25 : 15; fx(u.x, u.y, "HOURGLASS +" + B.extra + " s", "sand"); return " Hourglass: the next question, whoever takes it, gets " + B.extra + " extra seconds."; }
  if (el === "Steam") { if (B.mode === "skirmish" && S.skw[B.c.id]) return ""; if (Math.random() < (big ? 0.4 : 0.25)) { S.orbs++; B.drops++; fx(u.x, u.y, "+1 ORB", "steam"); return " Salvage: " + nm(u.hid) + " finds an orb."; } return ""; }
  if (enemy || B.phase !== "player") return "";
  if (el === "Shadow") { if (u.over) return ""; u.again = true; if (liveFoes().length) B.pend = {type:"swap", u}; fx(u.x, u.y, "SHADOWSTEP", "shadow"); return " Shadowstep: " + nm(u.hid) + " may swap places with a foe and attack again."; }
  if (el === "Earth") { if (!B.tiles.length) return ""; B.pend = {type:"tile", u, t:null}; fx(u.x, u.y, "EARTHSHAPER", "earth"); return " Earthshaper: " + nm(u.hid) + " may move one tile."; }
  return "";
}
function startSkirmish(chId){
  const c = CH[chId], p = pool(c); if (!p.length) return;
  S.sk++; save();
  newBattle("skirmish", c, p, shuffle(p.map((_, i) => i)));
}
function liveFoes(){ return B.foes.filter(f => f.on); }
function alive(){ return B.units.filter(u => !u.out); }
function tileAt(x, y){ return B.tiles.find(t => t.x === x && t.y === y); }
function occupied(x, y, me){ return B.units.some(u => !u.out && u !== me && u.x === x && u.y === y) || B.foes.some(f => f.on && f !== me && f.x === x && f.y === y); }
function inside(x, y){ return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
function spawnMore(){
  const r = rng(hash(B.c.id + ":" + B.turn + ":" + B.mode + ":" + S.sk + ":" + B.queue.length)); let n = 0;
  while (liveFoes().length < FIELD && B.queue.length) {
    const i = B.queue.shift(); let x, y, g = 0;
    do { x = COLS - 6 + Math.floor(r() * 6); y = Math.floor(r() * ROWS); g++; } while ((occupied(x, y, null) || tileAt(x, y)) && g < 400);
    if (occupied(x, y, null)) { B.queue.unshift(i); break; }
    const cid = B.ids[i], hero = foeHero(cid), ro = ROLE[HERO[hero].role];
    B.foes.push({i, cid, hero, x, y, on:true, boss: B.mode === "exam" && i === B.ids.length - 1, elite:isElite(cid), rng:ro.rng, mv:isElite(cid) ? 4 : Math.min(3, ro.mv), stag:false, key:"f" + i + "_" + (B.spawned = (B.spawned || 0) + 1)}); n++;
  }
  return n;
}
function reach(u){
  const fly = u.role === "F", start = u.x + "," + u.y, m = new Map([[start, 0]]);
  if (u.moved) return m;
  const dist = new Map([[start, 0]]), q = [[u.x, u.y]];
  while (q.length) { const [x, y] = q.shift(), d = dist.get(x + "," + y); if (d >= u.mv) continue;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = nx + "," + ny; if (!inside(nx, ny) || dist.has(k)) continue;
      if (B.vil && nx === B.vil.x && ny === B.vil.y) continue;
      const occ = occupied(nx, ny, u); if (occ && !fly) continue; dist.set(k, d + 1); if (!occ) m.set(k, d + 1); q.push([nx, ny]); } }
  return m;
}
function md(a, b){ return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function attackSpot(u, f){ let best = null; for (const [k, d] of reach(u)) { const [x, y] = k.split(",").map(Number), dist = Math.abs(x - f.x) + Math.abs(y - f.y); if (dist >= 1 && dist <= u.rng) { const score = (u.rng - dist) * 10 + d; if (!best || score < best.score) best = {x, y, d, score}; } } return best; }
function stepToward(u, f){ let best = null; for (const [k, d] of reach(u)) { const [x, y] = k.split(",").map(Number), dist = Math.abs(x - f.x) + Math.abs(y - f.y), score = dist * 10 + d; if (!best || score < best.score) best = {x, y, d, score}; } return best; }
function banner(t){ if (!B || !B.el) return; const p = B.el.phase; p.textContent = t; p.classList.add("show"); setTimeout(() => p.classList.remove("show"), 900); }
function engage(f){
  if (!B || B.busy || Q || B.paused || B.phase !== "player" || B.pend) return;
  const cands = alive().filter(u => !u.acted); if (!cands.length) return endPlayerPhase();
  const selU = B.sel != null ? B.units[B.sel] : null; let best = null;
  for (const u of cands) { const a = attackSpot(u, f); if (a) { const score = (u === selU ? -1000 : 0) + a.score; if (!best || score < best.score) best = {u, a, score}; } }
  if (!best) { for (const u of cands) { const a = stepToward(u, f); u.x = a.x; u.y = a.y; u.acted = true; } drawField(); return endPlayerPhase(); }
  const u = best.u; u.x = best.a.x; u.y = best.a.y; u.moved = true; B.sel = B.units.indexOf(u); B.busy = true; drawField();
  setTimeout(() => { if (!B) return; B.busy = false; openQ(f, u, false, () => finishAct(u)); }, 270);
}
function finishAct(u){
  if (u.again && !u.out) { u.again = false; u.over = true; u.moved = false; } else u.acted = true;
  B.sel = null; afterPlayerAction();
}
function useSkill(){
  if (!B || B.phase !== "player" || Q || B.busy || B.pend || B.sel == null) return; const u = B.units[B.sel], sk = SKILL[u.role];
  if (!sk || u.out || u.acted || u.cd) return;
  if (sk.t) { B.pend = {type:"skill", u, sk}; drawField(); return; }
  if (u.role === "V") { u.taunt = true; u.armor = true; } else if (u.role === "S") u.again = true; else if (u.role === "C") u.focus = true;
  u.cd = sk.cd; fx(u.x, u.y, sk.n.toUpperCase(), "skill"); drawField();
}
function skillTarget(kind, o){
  const p = B.pend, u = p.u;
  if (p.sk.t !== kind) return;
  if (u.role === "F") { if (o === u) return; const x = u.x, y = u.y; u.x = o.x; u.y = o.y; o.x = x; o.y = y; fx(u.x, u.y, "RESCUE", "skill"); fx(o.x, o.y, "", "skill"); }
  else if (u.role === "H") { if (o.hp >= o.max) { B.el.info.textContent = nm(o.hid) + " is already at full hearts."; return; } o.hp = Math.min(o.max, o.hp + 2); fx(o.x, o.y, "MEND +♥1", "bloom"); }
  else if (u.role === "R") { if (md(u, o) > 3) { B.el.info.textContent = "That foe is more than 3 tiles away."; return; } o.stun = Math.max(o.stun || 0, 1); fx(o.x, o.y, "PINNED", "shock"); }
  u.cd = p.sk.cd; pendDone();
}
function autoEnd(){ if (B && !B.pend && !alive().some(u => !u.acted)) setTimeout(() => { if (B && B.phase === "player" && !Q && !B.pend) endPlayerPhase(); }, 350); }
function pendDone(){ if (!B) return; B.pend = null; drawField(); autoEnd(); }
function tileClick(x, y){
  const p = B.pend; if (!p || p.type !== "tile") return;
  if (!p.t) { const t = tileAt(x, y); if (t) { p.t = t; drawField(); } return; }
  const here = tileAt(x, y); if (here && here !== p.t) return;
  fx(p.t.x, p.t.y, "", "earth"); p.t.x = x; p.t.y = y; p.t.ttl = Math.max(p.t.ttl, 2); fx(x, y, TILEINFO[p.t.k][0] + " MOVED", p.t.k); pendDone();
}
function afterPlayerAction(){
  if (!B) return; if (battleOver()) return;
  if (B.mode !== "village" && !liveFoes().length && B.queue.length && spawnMore()) banner("Reinforcements");
  if (B.pend && B.pend.type === "swap" && !liveFoes().length) B.pend = null;
  drawField(); autoEnd();
}
function clickUnit(ix){ if (!B || B.busy || Q || B.phase !== "player") return; const u = B.units[ix];
  if (B.pend) { if (B.pend.type === "tile") tileClick(u.x, u.y); else if (B.pend.type === "skill") skillTarget("ally", u); return; }
  if (u.acted) return; B.sel = B.sel === ix ? null : ix; drawField(); }
function moveTo(u, x, y){ if (!B || B.busy || B.phase !== "player") return; if (x !== u.x || y !== u.y) { u.x = x; u.y = y; u.moved = true; } else B.sel = null; drawField(); }
function clickFoe(f){ if (!B || B.busy || Q) return; const p = B.pend;
  if (p) { if (B.phase !== "player") return;
    if (p.type === "swap") { const u = p.u, x = u.x, y = u.y; u.x = f.x; u.y = f.y; f.x = x; f.y = y; u.moved = true; B.sel = B.units.indexOf(u); fx(u.x, u.y, "SWAP", "shadow"); fx(f.x, f.y, "", "shadow"); pendDone(); } else if (p.type === "skill") skillTarget("foe", f); else tileClick(f.x, f.y);
    return; }
  engage(f); }
function nextFoe(){ if (!B || B.phase !== "player" || B.pend) return; const us = alive().filter(u => !u.acted); if (!us.length) return endPlayerPhase();
  let best = null; liveFoes().forEach(f => { us.forEach(u => { const d = md(u, f); if (!best || d < best.d) best = {f, d}; }); }); if (best) engage(best.f); }
function endPlayerPhase(){
  if (!B || B.phase !== "player" || Q || B.busy) return;
  B.pend = null; B.phase = "enemy"; B.sel = null; drawField(); banner("Enemy Phase");
  setTimeout(() => { if (!B) return; moveFoes(); if (breach()) return; drawField();
    setTimeout(() => { if (!B) return;
      const us = alive(), inr = f => us.filter(u => md(u, f) <= f.rng), low = f => Math.min(...inr(f).map(u => u.taunt ? -1 : u.hp)), near = f => Math.min(...us.map(u => md(u, f)));
      const list = liveFoes().filter(f => !f.stag && !f.stun && inr(f).length).sort((a, b) => low(a) - low(b) || near(a) - near(b) || a.i - b.i).slice(0, ENEMY_ATTACKS);
      enemyAttacks(list, 0); }, 450); }, 800);
}
function breach(){
  if (B.mode !== "village") return false; let n = 0;
  liveFoes().forEach(f => { if (f.x === B.vil.x && f.y === B.vil.y) { f.on = false; B.vhp--; B.breach++; n++; fx(B.vil.x, B.vil.y, "VILLAGE -♥1", "dmg"); B.log.push({cid:f.cid, ok:false, pick:null, breach:true}); } });
  if (B.vhp <= 0) { drawField(); finishVillage(false); return true; }
  if (n) setTimeout(() => banner("The village is hit"), 950);
  return false;
}
function moveFoes(){
  const us = alive(), vil = B.vil; if (!us.length && !vil) return;
  const weakFor = f => us.slice().sort((a, b) => (b.taunt ? 1 : 0) - (a.taunt ? 1 : 0) || a.hp - b.hp || md(a, f) - md(b, f))[0];
  const goal = f => vil ? md(f, vil) : md(f, weakFor(f));
  liveFoes().filter(f => !f.stun).sort((a, b) => goal(a) - goal(b)).forEach(f => { const t0 = tileAt(f.x, f.y); f.stag = !!(t0 && t0.k === "burn");
    const weak = us.length ? weakFor(f) : null, hits = (p, u) => md(u, p) <= f.rng;
    if (!vil && hits(f, weak)) return;
    const m = new Map([[f.x + "," + f.y, 0]]), q = [[f.x, f.y]];
    while (q.length) { const [x, y] = q.shift(), d = m.get(x + "," + y); if (d >= f.mv) continue; const here = tileAt(x, y); if (here && here.k === "burn" && d > 0) continue;
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = nx + "," + ny; if (!inside(nx, ny) || m.has(k) || occupied(nx, ny, f)) continue; const t = tileAt(nx, ny); if (t && t.k === "frost") continue; m.set(k, d + 1); q.push([nx, ny]); } }
    let best = null;
    for (const [k, d] of m) { const [x, y] = k.split(",").map(Number), p = {x, y};
      const tb = tileAt(x, y), burn = tb && tb.k === "burn" ? 45 : 0;
      const score = burn + (vil ? md(p, vil) * 10 + d : hits(p, weak) ? d : us.some(u => hits(p, u)) ? 100 + d : 1000 + md(p, weak) * 10 + d);
      if (!best || score < best.score) best = {x, y, score}; }
    f.x = best.x; f.y = best.y; const t1 = tileAt(f.x, f.y); if (t1 && t1.k === "burn") f.stag = true; });
}
function enemyAttacks(list, k){
  if (!B) return; if (battleOver()) return;
  if (k >= list.length || !alive().length) return playerPhaseStart();
  const f = list[k]; if (!f.on || f.stun) return enemyAttacks(list, k + 1);
  const targets = alive().filter(u => md(u, f) <= f.rng).sort((a, b) => (b.taunt ? 1 : 0) - (a.taunt ? 1 : 0) || a.hp - b.hp || md(a, f) - md(b, f)); if (!targets.length) return enemyAttacks(list, k + 1);
  const u = targets[0]; banner(HERO[f.hero].c + " attacks " + nm(u.hid));
  setTimeout(() => { if (!B) return; openQ(f, u, true, () => enemyAttacks(list, k + 1)); }, 700);
}
function playerPhaseStart(){
  if (!B) return; if (battleOver()) return;
  B.phase = "player"; B.turn++;
  if (B.mode === "village" && B.turn > VIL.rounds) return finishVillage(true);
  B.tiles.forEach(t => t.ttl--); B.tiles = B.tiles.filter(t => t.ttl > 0);
  alive().forEach(u => { const t = tileAt(u.x, u.y); if (t && t.k === "bloom" && u.hp < u.max) { u.hp = Math.min(u.max, u.hp + 2); B.tiles = B.tiles.filter(x => x !== t); fx(u.x, u.y, "+♥1", "bloom"); } });
  let msg = B.mode === "village" ? "Round " + B.turn + " of " + VIL.rounds : "Turn " + B.turn;
  if (deploy()) msg = "Reserves arrive";
  if (B.mode === "village") spawnWave(VIL.wave);
  else if (liveFoes().length <= 6 && B.queue.length && spawnMore()) msg = "Reinforcements";
  B.units.forEach(u => { u.acted = false; u.moved = false; u.over = false; u.again = false; u.taunt = false; if (u.cd) u.cd--; }); B.sel = null;
  B.foes.forEach(f => { if (f.stun) f.stun--; });
  drawField(); banner(msg);
}
function deploy(){
  let n = 0; const spots = [[0,3],[1,2],[1,4],[0,2],[0,4],[0,1],[0,5],[2,3],[0,0],[0,6],[2,2],[2,4]];
  const freeSpot = () => spots.find(s => !occupied(s[0], s[1], null) && !(B.vil && s[0] === B.vil.x && s[1] === B.vil.y));
  const res = B.mode !== "skirmish";
  if (res) { const rs = owned().filter(id => !B.used.has(id)).sort((a, b) => HERO[b].r - HERO[a].r || (S.heroes[b].exp || 0) - (S.heroes[a].exp || 0));
    while (alive().length < 4 && rs.length) { const s = freeSpot(); if (!s) break; const id = rs.shift(); B.used.add(id); B.units.push(mkUnit(id, s[0], s[1])); n++; } }
  if (!alive().length || (res && alive().length < 2 && !owned().some(id => !B.used.has(id)))) { while (alive().length < 2) { const s = freeSpot(); if (!s) break; B.units.push(mkUnit("militia", s[0], s[1])); n++; } }
  return n;
}
function battleOver(){
  if (B.mode === "village") return false;
  if (B.mode === "exam") { if (answered(B.ex, B.ids.length) >= B.ids.length) { finishExam(); return true; } }
  else { if (!liveFoes().length && !B.queue.length) { finishSkirmish(true); return true; } if (!alive().length) { finishSkirmish(false); return true; } }
  return false;
}
function hurt(u, halves){
  const t = tileAt(u.x, u.y);
  if (t && t.k === "ward") { B.tiles = B.tiles.filter(x => x !== t); fx(u.x, u.y, "WARD BLOCKS", "ward"); return "The ward tile blocked the hit."; }
  if (u.armor) { u.armor = false; fx(u.x, u.y, "ARMOR BLOCKS", "ward"); return nm(u.hid) + "'s armor blocked the hit."; }
  u.hp -= halves; fx(u.x, u.y, u.hp > 0 ? "-" + hearts(halves) : "FALLEN", "dmg");
  if (u.hp > 0) return nm(u.hid) + " loses " + hearts(halves).slice(1) + (halves === 2 ? " heart." : " hearts.");
  u.out = true; u.hp = 0;
  if (u.hid === "militia") return "The militia recruit falls.";
  const was = nm(u.hid);
  const gone = S.heroes[u.hid] || {};
  B.fell.push(was); delete S.heroes[u.hid]; S.team = (S.team || []).filter(x => x !== u.hid); S.fallen.push({id:u.hid, nm:was, t:Date.now(), ch:B.c.id, exp:gone.exp || 0, mg:gone.mg || 0});
  return was + " has fallen and is lost. Summon or recruit " + HERO[u.hid].n + " again to bring them back.";
}

function battle(){
  const c = B.c, ex = B.ex, el = {pcs:{}};
  el.timer = h("b", {text: ex ? fmt(ex.t) : ""}); el.turn = h("b"); el.left = h("b"); el.ph = h("b"); el.vh = h("b"); el.buff = h("span", {class:"buff"});
  el.field = h("div", {class:"field map" + (c.realm === 2 ? 1 : c.realm)});
  el.field.style.backgroundPosition = c.pos[0] + "% " + c.pos[1] + "%";
  el.tl = h("div"); el.field.appendChild(el.tl);
  el.hl = h("div"); el.field.appendChild(el.hl);
  if (B.vil) { el.vt = h("div", {class:"vtile", title:"The village. A foe that walks in costs it a heart."}, [h("img", {src:"u/village.png", alt:"Village"}), h("span")]); el.field.appendChild(el.vt); }
  el.phase = h("div", {class:"phase"}); el.field.appendChild(el.phase);
  el.bar = h("div", {class:"row"}); el.msg = h("div", {class:"muted"}); el.info = h("div", {class:"pixs"}); el.modal = h("div");
  B.el = el;
  return h("div", {class:"panel"}, [
    h("div", {class:"hud"}, [
      h("span", {}, [h("b", {text:(B.rematch ? "Rematch: " : B.mode === "exam" ? "Battle: " : B.mode === "village" ? "" : "Skirmish: ") + c.name})]),
      h("span", {}, [el.ph]), h("span", {}, [B.vil ? "Round " : "Turn ", el.turn]), h("span", {}, [B.vil ? "Foes on field " : "Foes left ", el.left]),
      B.vil ? h("span", {}, ["Village ", el.vh]) : null, el.buff,
      ex ? h("span", {}, ["Time ", el.timer]) : null]),
    el.field, el.bar, el.info, el.msg, el.modal]);
}
function drawField(){
  if (!B || !B.el) return; const el = B.el, F = el.field, seen = new Set(), pend = B.phase === "player" ? B.pend : null;
  F.classList.toggle("paused", !!B.paused);
  const pos = (e, x, y) => { e.style.left = (x * 100 / COLS) + "%"; e.style.top = (y * 100 / ROWS) + "%"; };
  const place = (key, x, y, img) => { let e = el.pcs[key]; if (!e) { e = h("button", {class:"pc"}, [h("img", {src:img, alt:""}), h("span", {class:"tagn"}), h("span", {class:"tagr"}), h("span", {class:"tags"})]); F.appendChild(e); el.pcs[key] = e; } seen.add(key); pos(e, x, y); return e; };
  B.units.forEach((u, ix) => { if (u.out) return; const hr = HERO[u.hid], e = place("u" + ix, u.x, u.y, hr.img);
    e.className = "pc unit" + (u.acted ? " acted" : "") + (B.sel === ix ? " sel" : "") + (u.hid === "militia" ? " mil" : "") + (u.taunt ? " taunt" : "") + (pend && pend.type === "skill" && pend.sk.t === "ally" ? " pickme" : ""); e.onclick = () => clickUnit(ix);
    const info = nm(u.hid) + " · " + ROLE[u.role].n + (u.el ? " · " + u.el : "") + " · " + hearts(u.hp) + "/" + hearts(u.max).slice(1) + " · range " + u.rng + " · move " + u.mv + (u.armor ? " · armor up" : "") + (u.insight ? " · Insight ready" : "") + (u.el ? " · " + elName(u.el) + ": " + elDesc(u.el) : "") + (SKILL[u.role] ? " · skill " + SKILL[u.role].n + (u.cd ? " in " + u.cd + (u.cd === 1 ? " turn" : " turns") : " ready") : "") + (u.taunt ? " · taunting" : "") + (u.focus ? " · focused" : "");
    e.setAttribute("aria-label", info); e.title = info; e.onmouseenter = () => { el.info.textContent = info; };
    e.querySelector(".tagn").textContent = hearts(u.hp) + (u.armor ? "◆" : ""); e.querySelector(".tagr").textContent = u.rng > 1 ? "R" + u.rng : "";
    e.querySelector(".tags").textContent = [u.taunt ? "TAUNT" : "", u.focus ? "FOCUS" : "", u.again && !u.acted ? "x2" : ""].filter(Boolean).join(" "); });
  B.foes.forEach(f => { if (!f.on) return; const hr = HERO[f.hero], e = place(f.key, f.x, f.y, hr.img);
    e.className = "pc foe" + (f.boss ? " boss" : "") + (f.elite && !f.boss ? " elite" : "") + (f.stun ? " stun" : f.stag ? " stag" : "") + (pend && (pend.type === "swap" || (pend.type === "skill" && pend.sk.t === "foe")) ? " pickme" : ""); e.onclick = () => clickFoe(f);
    const info = (B.vil ? "Foe" : "Question " + (f.i + 1)) + " · foe range " + f.rng + " · move " + f.mv + (f.elite || f.boss ? " · " + (f.boss ? "boss" : "elite") + ": a miss costs 2 hearts" : "") + (f.stag ? " · burning, cannot attack" : "") + (f.stun ? " · stunned" : "");
    e.setAttribute("aria-label", info); e.title = info; e.onmouseenter = () => { el.info.textContent = info; };
    e.querySelector(".tagn").textContent = (B.vil ? "" : String(f.i + 1)) + (f.elite || f.boss ? "★" : ""); e.querySelector(".tagr").textContent = f.rng > 1 ? "R" + f.rng : "";
    e.querySelector(".tags").textContent = f.stun ? "STUN" : f.stag ? "BURN" : ""; });
  for (const k in el.pcs) if (!seen.has(k)) { const e = el.pcs[k]; e.classList.add("gone"); setTimeout(() => e.remove(), 320); delete el.pcs[k]; }
  el.tl.textContent = ""; const pickTile = pend && pend.type === "tile" && !pend.t;
  B.tiles.forEach(t => { const e = h(pickTile ? "button" : "div", {class:"tl " + t.k + (pickTile ? " pick" : "") + (pend && pend.t === t ? " held" : ""), title:TILEINFO[t.k][1] + " (" + t.ttl + " turns left)", "aria-label": pickTile ? "Pick up the " + TILEINFO[t.k][0] + " tile" : null}, [h("span", {text:TILEINFO[t.k][0] + " " + t.ttl})]);
    if (pickTile) e.onclick = () => tileClick(t.x, t.y); pos(e, t.x, t.y); el.tl.appendChild(e); });
  el.hl.textContent = "";
  if (pend && pend.type === "tile" && pend.t) {
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) { const o = tileAt(x, y); if (o && o !== pend.t) continue; const t = h("button", {class:"hl", "aria-label":"Put the tile on column " + (x + 1) + ", row " + (y + 1)}); pos(t, x, y); t.onclick = () => tileClick(x, y); el.hl.appendChild(t); } }
  else if (!pend && B.phase === "player" && B.sel != null && !B.units[B.sel].acted && !B.units[B.sel].out) { const u = B.units[B.sel];
    for (const k of reach(u).keys()) { const [x, y] = k.split(",").map(Number); if (x === u.x && y === u.y) continue; const t = h("button", {class:"hl", "aria-label":"Move to column " + (x + 1) + ", row " + (y + 1)}); pos(t, x, y); t.onclick = () => moveTo(u, x, y); el.hl.appendChild(t); } }
  if (B.vil) { pos(el.vt, B.vil.x, B.vil.y); el.vt.querySelector("span").textContent = "♥" + B.vhp; el.vh.textContent = "♥ " + B.vhp + "/" + VIL.hearts; }
  el.turn.textContent = B.vil ? Math.min(B.turn, VIL.rounds) + " of " + VIL.rounds : B.turn; el.ph.textContent = B.phase === "player" ? "Player phase" : "Enemy phase";
  el.left.textContent = B.mode === "exam" ? (B.ids.length - answered(B.ex, B.ids.length)) : B.vil ? liveFoes().length : (liveFoes().length + B.queue.length);
  el.buff.textContent = B.extra ? "Hourglass: next question +" + B.extra + " s" : "";
  el.bar.textContent = ""; const pl = B.phase === "player";
  if (pend) el.bar.appendChild(h("button", {class:"go", text: pend.type === "swap" ? "Skip the swap" : pend.type === "skill" ? "Cancel the skill" : "Skip the tile move", on:{click:pendDone}}));
  if (!pend && pl && B.sel != null && !B.units[B.sel].out && SKILL[B.units[B.sel].role]) { const u = B.units[B.sel], sk = SKILL[u.role];
    el.bar.appendChild(h("button", {text: u.cd ? sk.n + ": ready in " + u.cd + (u.cd === 1 ? " turn" : " turns") : "Skill: " + sk.n + " (S)", title:sk.d, disabled:!!u.cd || u.acted, on:{click:useSkill}})); }
  el.bar.appendChild(h("button", {class: pend ? "" : "go", text:"Engage nearest (N)", disabled:!pl || !!pend, on:{click:nextFoe}}));
  el.bar.appendChild(h("button", {text:"End turn (T)", disabled:!pl, on:{click:endPlayerPhase}}));
  if (B.mode === "exam") el.bar.appendChild(h("button", {text:B.paused ? "Resume" : "Pause", disabled:!pl, on:{click:() => { B.paused = !B.paused; save(); drawField(); }}}));
  else el.bar.appendChild(h("button", {text: armed === "retreat" ? "Click again to retreat" : "Retreat", disabled:!pl, on:{click:() => { if (armed === "retreat") { if (B.vil) finishVillage(false); else finishSkirmish(false); } else { armed = "retreat"; drawField(); } }}}));
  el.msg.textContent = pend && pend.type === "skill" ? pend.sk.n + ": " + pend.sk.d + ". " + (pend.sk.t === "foe" ? "Click a foe within 3 tiles of " + nm(pend.u.hid) + "." : "Click the hero.")
    : pend ? (pend.type === "swap" ? "Shadowstep: click any foe to swap places with " + nm(pend.u.hid) + ". After the swap it attacks from where it lands. Skip keeps the second attack without swapping."
      : !pend.t ? "Earthshaper: click a tile to pick it up." : "Now click any square, hero or foe to put the " + TILEINFO[pend.t.k][0] + " tile there.")
    : B.mode === "exam"
    ? (B.rematch ? "Rematch: leaving before the last question discards it. " : "") + "Click a foe to attack with the best-placed hero, or pick a hero and a tile first. A selected hero can also use its skill. When your heroes have acted, foes move toward your weakest hero and up to " + ENEMY_ATTACKS + " attack with a " + ENEMY_SECS + "-second question; your own attacks get " + PLAYER_SECS + " seconds. A wrong answer or timeout costs the fighting hero 1 heart, or 2 against a starred elite."
    : B.vil ? "Hold the village for " + VIL.rounds + " rounds. " + VIL.wave + " foes arrive each round and march on the village; one that walks in costs it a heart. A wrong answer costs your hero 1 heart and the foe stays with a new question. Heroes cannot stand on the village."
    : "Wrong answers cost 1.5 hearts here and the foe comes back. Answer every foe correctly once to win the emblem hero.";
}
/* ---------- question panel ---------- */
function openQ(f, u, enemy, cb){
  const ex = B.ex;
  Q = {f, u, enemy, cb, cid:f.cid, i:f.i, pick:null, flag:"", done:false, cut:[], ins:false, msg:"", total:0, left:0, timer:null};
  Q.bonus = [B.extra ? "Hourglass +" + B.extra : "", u.focus ? "Focus +30" : ""].filter(Boolean).join(", ");
  Q.total = Q.left = (enemy ? ENEMY_SECS : PLAYER_SECS) + (B.extra || 0) + (u.focus ? 30 : 0); B.extra = 0;
  if (ex && !ex.started) ex.started = true;
  Q.timer = setInterval(() => { if (!Q || Q.done) return; const off = navigator.onLine === false; if (!off) Q.left--; const t = B.el.modal.querySelector(".clock"); if (t) { t.querySelector("i").style.width = (100 * Q.left / Q.total) + "%"; t.querySelector("b").textContent = off ? "Offline · clock paused" : Q.left + " s" + (Q.bonus ? " · " + Q.bonus : ""); t.classList.toggle("low", Q.left <= 10); } if (Q.left <= 0) resolve(null); }, 1000);
  drawQ();
}
function drawQ(){
  const card = CARDS[Q.cid], hr = HERO[Q.f.hero], m = B.el.modal; m.textContent = "";
  const opts = h("div", {class:"opts", role:"group", "aria-label":"Answer options"}, card.o.map((t, k) => {
    let cls = ""; if (Q.done) { if (k === card.a) cls = "ok"; else if (k === Q.pick) cls = "no"; } else if (Q.cut.includes(k)) cls = "cut";
    return h("button", {class:cls, disabled:Q.done || Q.cut.includes(k), on:{click:() => choose(k)}}, [h("b", {text:L[k]}), h("span", {text:t})]); }));
  const kids = [
    h("div", {class:"qhead"}, [
      h("div", {class:"qfoe"}, [h("img", {src:hr.img, alt:""}), h("span", {text:(B.vil ? "Round " + Math.min(B.turn, VIL.rounds) + " of " + VIL.rounds : "Question " + (Q.i + 1) + " of " + B.ids.length) + (Q.f.boss ? " · Boss: a miss costs 2 hearts" : Q.f.elite ? " · Elite: a miss costs 2 hearts" : "")})]),
      h("div", {class:"qfoe"}, [h("span", {text: Q.enemy ? "attacks " + nm(Q.u.hid) + " (" + hearts(Q.u.hp) + ")" : nm(Q.u.hid) + " attacks (" + hearts(Q.u.hp) + ")"}), h("img", {src:HERO[Q.u.hid].img, alt:""})])]),
    !Q.done ? h("div", {class:"clock" + (Q.left <= 10 ? " low" : "") + (Q.bonus ? " bonus" : "")}, [(() => { const i = h("i"); i.style.width = (100 * Q.left / Q.total) + "%"; return i; })(), h("b", {text:Q.left + " s" + (Q.bonus ? " · " + Q.bonus : "")})]) : null,
    h("p", {class:"stem", text:card.q}),
    imgSrc(card) ? h("img", {class:"fig", src:imgSrc(card), alt:card.alt || "Question image"}) : null,
    opts];
  if (!Q.done) {
    kids.push(h("div", {class:"row"}, [
      B.mode === "exam" ? h("button", {class:Q.flag === "unsure" ? "on" : "", text:"Unsure (U)", "aria-pressed":String(Q.flag === "unsure"), on:{click:() => setFlag("unsure")}}) : null,
      B.mode === "exam" ? h("button", {class:Q.flag === "guessed" ? "on" : "", text:"Guessed (G)", "aria-pressed":String(Q.flag === "guessed"), on:{click:() => setFlag("guessed")}}) : null,
      Q.u.insight ? h("button", {text:"Insight: remove a wrong option (I)", on:{click:insight}}) : null,
      B.mode === "exam" ? h("span", {class:"pixs", text:"Set a flag first, then pick. Picking is final."}) : null]));
  } else {
    const ok = Q.pick === card.a;
    kids.push(h("div", {class:"fb" + (ok ? "" : " bad")}, [h("b", {text:Q.msg}), h("div", {text:card.r + " (p. " + card.p + ")"})]));
    kids.push(h("div", {class:"row"}, [h("button", {class:"go", text:"Continue (Enter)", on:{click:contQ}})]));
  }
  m.appendChild(h("div", {class:"qm", role:"dialog", "aria-modal":"true", "aria-label":"Question " + (Q.i + 1)}, [h("div", {class:"qcard"}, kids)]));
  const first = Q.done ? m.querySelector(".go") : m.querySelector(".qcard"); if (first) { if (!Q.done) first.tabIndex = -1; first.focus({preventScroll:true}); }
  if (Q.done) m.querySelector(".qm").scrollTop = m.querySelector(".qm").scrollHeight;
}
function choose(k){ if (!Q || Q.done || Q.cut.includes(k) || k >= CARDS[Q.cid].o.length) return; resolve(k); }
function setFlag(f){ if (!Q || Q.done || B.mode !== "exam") return; Q.flag = Q.flag === f ? "" : f; drawQ(); }
function insight(){ if (!Q || Q.done || !Q.u.insight) return; const card = CARDS[Q.cid], wrong = card.o.map((_, k) => k).filter(k => k !== card.a && !Q.cut.includes(k)); if (wrong.length < 2) return; Q.cut.push(wrong[Math.floor(Math.random() * wrong.length)]); Q.u.insight = false; Q.ins = true; drawQ(); }
function resolve(pick){
  if (!Q || Q.done) return; if (Q.timer) { clearInterval(Q.timer); Q.timer = null; }
  const f = Q.f, u = Q.u, cid = Q.cid, card = CARDS[cid], ok = pick === card.a, timeout = pick == null;
  Q.done = true; Q.pick = pick; S.stats.ans++; if (ok) S.stats.ok++;
  if (B.mode === "exam") { const ex = B.ex; ex.a[f.i] = timeout ? -1 : pick; ex.f[f.i] = Q.flag; ex.x[f.i] = (Q.enemy ? "e" : "") + (timeout ? "t" : "") + (Q.ins ? "i" : ""); }
  else { const st = C(cid); st.n++; if (ok) { st.s++; st.m = true; } else { st.s = 0; st.w++; } }
  B.log.push({cid, ok, pick});
  f.on = false; let msg; const foc = u.focus; u.focus = false;
  if (ok) {
    msg = "Hit. " + nm(u.hid) + " defeats the foe.";
    if (u.el) msg += applyEl(u, f, Q.enemy);
    if (u.hid !== "militia") addExp(u.hid, 20);
    if (u.role === "H") { const w = alive().filter(x => x !== u && x.hp < x.max).sort((a, b) => (a.hp / a.max) - (b.hp / b.max))[0]; if (w) { w.hp = Math.min(w.max, w.hp + 1); fx(w.x, w.y, "+♥0.5", "bloom"); msg += " " + nm(w.hid) + " is healed half a heart."; } }
    if (B.mode === "skirmish") B.cleared[f.i] = true;
  } else {
    msg = (timeout ? "Time ran out. " : "Miss. ") + (foc ? (fx(u.x, u.y, "FOCUS ABSORBS", "skill"), "Focus absorbs the blow.") : (Q.enemy ? "" : "The foe strikes back. ") + hurt(u, (B.mode === "skirmish" ? 3 : 2) + (f.elite || f.boss ? 2 : 0)));
    if (B.mode === "skirmish") { B.queue.push(f.i); msg += " This foe will return."; }
    else if (B.vil) { if (B.queue.length) { const ni = B.queue.shift(); f.i = ni; f.cid = B.ids[ni]; f.on = true; msg += " The foe holds its ground with a new question."; } else msg += " The foe falls back."; }
    else msg += " The foe escapes to the skirmish.";
  }
  Q.msg = msg; save(); drawField(); drawQ();
}
function hr(u){ return HERO[u.hid]; }
function contQ(){ if (!Q || !Q.done) return; const cb = Q.cb; Q = null; B.el.modal.textContent = ""; flushFx(); cb(); }

/* ---------- finishing ---------- */
function finishRematch(){
  const ex = B.ex, ids = B.ids, c = B.c; let ok = 0; const miss = [];
  ids.forEach((id, i) => { if (CARDS[id] && ex.a[i] === CARDS[id].a) ok++; else miss.push(id); });
  const first = exam(c), r = S.rem[c.id] || (S.rem[c.id] = {n:0});
  const firstP = first && first.done ? pct(first.score, c.exam.length) : 0, bestP = r.bestp != null ? r.bestp : (r.best ? pct(r.best, c.exam.length) : 0);
  const prev = Math.max(firstP, bestP), now = pct(ok, ids.length), orbs = Math.floor(ok / 6) + (now > prev ? 2 : 0);
  ex.done = true; ex.score = ok;
  r.n = (r.n || 0) + 1; r.last = ok; r.bestp = Math.max(bestP, now); r.x = miss; r.t = ex.t; r.date = Date.now();
  S.orbs += orbs;
  lastRem = {ch:c.id, ex, orbs, prev, now, first:firstP, drops:B.drops, fell:(B.fell || []).slice()};
  save(); B = null; Q = null; go("rsum");
}
function finishVillage(win){
  const c = B.c, r = c.realm, right = B.log.filter(x => x.ok).length;
  const orbs = win ? c.prize + B.vhp : Math.floor(right / 8);
  S.orbs += orbs; const v = S.vil[r] || (S.vil[r] = {n:0, wins:0}); v.n++; if (win) v.wins++;
  const got = {}; B.log.forEach(x => { if (x.ok || got[x.cid]) return; got[x.cid] = 1; const ch = chOf(x.cid); if (ch && exam(ch) && exam(ch).done) { const a = S.vx[ch.id] || (S.vx[ch.id] = []); if (!a.includes(x.cid)) a.push(x.cid); } });
  lastVil = {name:c.name, realm:r, log:B.log, win, orbs, vhp:B.vhp, round:Math.min(B.turn, VIL.rounds), breach:B.breach, drops:B.drops, fell:B.fell.slice(), secs:Math.round((Date.now() - B.t0) / 1000)};
  if (Q && Q.timer) clearInterval(Q.timer);
  save(); B = null; Q = null; go("vsum");
}
function finishExam(){
  if (B.rematch) return finishRematch();
  const ex = B.ex, ids = B.ids, c = B.c; let ok = 0; ids.forEach((id, i) => { if (ex.a[i] === CARDS[id].a) ok++; });
  ex.done = true; ex.score = ok; ex.date = Date.now(); ex.chest = false; ex.orbs = Math.floor(ok / 3) + (ok / ids.length >= 0.9 ? 2 : 0); ex.fell = (B.fell || []).slice();
  save(); B = null; Q = null; go("after", {ch:c.id});
}
function finishSkirmish(win){
  const c = B.c, first = win && !S.skw[c.id]; let dup = false, orbs = 0, wait = 0;
  if (win) { if (S.rem[c.id]) S.rem[c.id].x = []; delete S.vx[c.id]; }
  if (first) { S.skw[c.id] = true; dup = grant(c.emblem); }
  else if (win) { wait = reskWait(c);
    if (!wait) { const got = {}; B.log.forEach(x => { if (!(x.cid in got)) got[x.cid] = x.ok; }); orbs = Math.min(5, Math.ceil(Object.keys(got).filter(k => got[k]).length / 3)); if (orbs) { S.orbs += orbs; S.rsk[c.id] = Date.now(); } } }
  lastSum = {ch:c.id, log:B.log, win, first, dup, orbs, wait, fell:B.fell.slice()};
  if (Q && Q.timer) clearInterval(Q.timer);
  save(); B = null; Q = null; go("sum");
}
function examRows(c, exx){ const ex = exx || exam(c); return (ex.ids || c.exam).map((id, i) => { const card = CARDS[id], x = (ex.x || [])[i] || ""; return {i, id, card, pick:ex.a[i], ok:ex.a[i] === card.a, flag:ex.f[i] || "", enemy:x.includes("e"), timeout:x.includes("t") || ex.a[i] === -1, ins:x.includes("i")}; }); }
function seedOf(c){ const ex = exam(c); return (c.id + "-" + ex.score + "-" + (ex.t || 0)).toUpperCase(); }
function pickText(r){ return r.timeout || r.pick == null || r.pick < 0 ? "timed out" : "picked " + L[r.pick]; }
function examReport(c, exx, head){
  const ex = exx || exam(c), rows = examRows(c, ex), miss = rows.filter(r => !r.ok), fl = rows.filter(r => r.ok && r.flag), un = rows.filter(r => !r.flag), fg = rows.filter(r => r.flag), en = rows.filter(r => r.enemy), ins = rows.filter(r => r.ins);
  const out = [(exx ? "[Campaign rematch] " : "[Campaign report] ") + c.name + ": " + ex.score + "/" + (ex.ids || c.exam).length + ", time " + fmt(ex.t) + (head || "")];
  out.push("Misses: " + (miss.length ? miss.map(r => (r.i + 1) + ") " + pickText(r) + ", correct " + L[r.card.a] + (r.flag ? " (" + r.flag + ")" : "") + (r.enemy ? " (enemy attack)" : "")).join("; ") : "none"));
  out.push("Flagged but correct: " + (fl.length ? fl.map(r => (r.i + 1) + " (" + r.flag + ")").join(", ") : "none"));
  out.push("Unflagged " + un.filter(r => r.ok).length + "/" + un.length + ", flagged " + fg.filter(r => r.ok).length + "/" + fg.length + ", enemy attacks " + en.filter(r => r.ok).length + "/" + en.length + (ins.length ? ", Insight used on " + ins.map(r => r.i + 1).join(", ") : ""));
  if ((ex.fell || []).length) out.push("Heroes lost: " + ex.fell.map(fname).join(", "));
  if (miss.length) { out.push("Miss details:"); miss.forEach(r => out.push((r.i + 1) + ") " + (imgSrc(r.card) ? "[image" + (r.card.alt ? ": " + r.card.alt : "") + "] " : "") + r.card.q + " | Mine: " + (r.timeout || r.pick == null || r.pick < 0 ? "timed out" : r.card.o[r.pick]) + " | Correct: " + r.card.o[r.card.a] + " | Rule: " + r.card.r + " (p. " + r.card.p + ")")); }
  if (!exx && ex.chest === false) out.push("Chest seed: " + seedOf(c));
  if (exx) out.push("Rematch: no chest and no code. Orbs were paid in the game.");
  return out.join("\n");
}
function copyBtn(getText, label){ const b = h("button", {text:label || "Copy report", on:{click:() => { const t = getText(); const done = () => { b.textContent = "Copied"; setTimeout(() => b.textContent = label || "Copy report", 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done)); else fallbackCopy(t, done); }}}); return b; }
function fallbackCopy(t, done){ const ta = h("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} ta.remove(); }
function tbl(head, body){ return h("div", {class:"tw"}, [h("table", {class:"res"}, [h("thead", {}, [h("tr", {}, head.map(t => h("th", {text:t})))]), h("tbody", {}, body.map(r => h("tr", {}, r.map(t => h("td", {class: typeof t === "number" || /^\d+$/.test(String(t)) ? "num" : "", text:String(t)})))))])]); }
function chestPanel(c){
  const ex = exam(c), emb = HERO[c.emblem], p = pool(c);
  if (chestOpen(c)) return h("div", {class:"chest open"}, [h("img", {src:"u/chest_open.png", alt:""}), h("div", {}, [h("h3", {text:"Chest opened"}), h("div", {class:"muted", text:"◆ " + (ex.orbs || 0) + " orbs collected." + (p.length ? " The skirmish is unlocked." : "")})])]);
  const inp = h("input", {type:"text", maxlength:"8", "aria-label":"Debrief code", placeholder:"CODE", autocomplete:"off"});
  const tryOpen = () => { if (inp.value.trim().toUpperCase() === chestCode(seedOf(c))) { ex.chest = true; S.orbs += ex.orbs || 0; save(); render(); } else { note = "That code does not open this chest."; const n = note; render(); note = n; } };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") tryOpen(); });
  return h("div", {class:"chest"}, [h("img", {src:"u/chest.png", alt:""}), h("div", {}, [
    h("h3", {text:"Locked chest: ◆ " + (ex.orbs || 0) + " orbs" + (p.length ? " and the skirmish for " + emb.n : "")}),
    h("div", {class:"muted", text:"Copy the report, paste it into the chat, and go through the debrief. The debrief ends with the code that opens this chest."}),
    h("div", {class:"row"}, [copyBtn(() => examReport(c)), inp, h("button", {class:"go", text:"Open chest", on:{click:tryOpen}})]),
    h("div", {class:"row"}, [copyBtn(() => D.tutorPrompt, "Copy tutor prompt"), h("span", {class:"pixs", text:"First time in a new chat: paste this once, then the report."})]),
    note ? h("div", {class:"fb bad", text:note}) : null])]);
}
function after(){
  const c = CH[V.ch], ex = exam(c); if (!ex || !ex.done) return h("div", {class:"panel"}, [h("p", {text:"No results yet."})]);
  const rows = examRows(c), miss = rows.filter(r => !r.ok), n = c.exam.length;
  const byLo = {}; rows.forEach(r => { const k = r.card.lo == null ? "-" : r.card.lo; (byLo[k] = byLo[k] || [0, 0])[1]++; if (r.ok) byLo[k][0]++; });
  const un = rows.filter(r => !r.flag), fg = rows.filter(r => r.flag), en = rows.filter(r => r.enemy), pa = rows.filter(r => !r.enemy);
  return h("div", {class:"panel"}, [
    h("h2", {text:"Aftermath: " + c.name}),
    h("div", {class:"big", text:ex.score + "/" + n + "  (" + Math.round(100 * ex.score / n) + "%)"}),
    h("div", {class:"muted", text:"Time " + fmt(ex.t) + ((ex.fell || []).length ? " · Lost: " + ex.fell.map(fname).join(", ") : " · No hero lost")}),
    chestPanel(c),
    h("h3", {text:"Score by learning objective"}),
    tbl(["Objective", "Right", "Of"], Object.keys(byLo).sort((a, b) => a - b).map(k => ["LO " + k, byLo[k][0], byLo[k][1]])),
    h("h3", {text:"How the answers split"}),
    tbl(["Group", "Right", "Of"], [["Unflagged", un.filter(r => r.ok).length, un.length], ["Flagged unsure or guessed", fg.filter(r => r.ok).length, fg.length],
      ["Your attacks, " + PLAYER_SECS + " seconds", pa.filter(r => r.ok).length, pa.length], ["Enemy attacks, " + ENEMY_SECS + " seconds", en.filter(r => r.ok).length, en.length], ["Timed out", 0, rows.filter(r => r.timeout).length]]),
    h("h3", {text:"Every miss (" + miss.length + ")"}),
    miss.length ? tbl(["Q", "Question", "You", "Correct", "Rule", "Page"], miss.map(r => [r.i + 1, r.card.q, (r.timeout || r.pick < 0 ? "Timed out" : L[r.pick] + ". " + r.card.o[r.pick]) + (r.flag ? " (" + r.flag + ")" : ""), L[r.card.a] + ". " + r.card.o[r.card.a], r.card.r, r.card.p])) : h("p", {text:"No misses."}),
    h("div", {class:"row"}, [copyBtn(() => examReport(c)),
      chestOpen(c) && pool(c).length && !S.skw[c.id] ? h("button", {class:"go", text:"Skirmish: " + pool(c).length + " foes" + poolNote(c), on:{click:() => startSkirmish(c.id)}}) : null,
      pool(c).length ? emblemChip(c) : null,
      chestOpen(c) ? h("button", {text:"Rematch: " + Math.min(REMATCH_N, bankOf(c).length) + " of " + bankOf(c).length, on:{click:() => startRematch(c.id)}}) : null,
      h("button", {text:"World map", on:{click:() => go("world")}})])]);
}
function heroCard(hid, opts){
  opts = opts || {}; const hr = HERO[hid], own = S.heroes[hid], show = own || opts.show, ro = ROLE[hr.role];
  return h(opts.click ? "button" : "div", {class:"hero r" + hr.r + (show ? "" : " un") + (opts.team ? " team" : ""), title: ro.n + ": " + ro.d + ". " + hr.el + ", " + elName(hr.el) + ": " + elDesc(hr.el) + (SKILL[hr.role] ? ". Skill, " + SKILL[hr.role].n + ": " + SKILL[hr.role].d : ""), on: opts.click ? {click:opts.click} : null}, [
    h("img", {src:hr.img, alt:""}), h("span", {class:"hn", text: show ? (own ? nm(hid) : hr.n) : "???"}), h("span", {class:"hc", text: show ? (own && own.nm ? hr.n + ", " + hr.c : hr.c) : RAR[hr.r]}), h("span", {class:"stars", text:STARS[hr.r]}),
    show ? h("span", {class:"hc", text:ro.n + " · " + hr.el + " · " + (own ? hearts(maxHalves(hid)) : "♥" + HEARTS[hr.r])}) : null,
    show ? h("span", {class:"hc", text:"Range " + ro.rng + " · Move " + ro.mv + " · " + elName(hr.el)}) : null,
    own ? h("span", {class:"pixs", text:"Lv " + lv(hid) + (own.mg ? " +" + own.mg : "") + (opts.team ? " · Team" : "")}) : null]);
}
function missTable(rows){ return tbl(["Q", "Question", "You", "Correct", "Rule", "Page"], rows.map(x => [x.i + 1, x.card.q, (x.timeout || x.pick == null || x.pick < 0 ? "Timed out" : L[x.pick] + ". " + x.card.o[x.pick]) + (x.flag ? " (" + x.flag + ")" : ""), L[x.card.a] + ". " + x.card.o[x.card.a], x.card.r, x.card.p])); }
function rsum(){
  const s = lastRem; if (!s) return world(); const c = CH[s.ch], ex = s.ex, n = ex.ids.length, rows = examRows(c, ex), miss = rows.filter(r => !r.ok), r = S.rem[c.id] || {}, bank = bankOf(c).length;
  const head = " (" + s.now + "%; first attempt " + s.first + "%, best before this " + s.prev + "%; " + n + " questions drawn from a bank of " + bank + ")";
  return h("div", {class:"panel"}, [
    h("h2", {text:"Rematch: " + c.name}),
    h("div", {class:"big", text:ex.score + "/" + n + "  (" + s.now + "%)"}),
    h("div", {class:"muted", text:"First attempt " + s.first + "% · best before this " + s.prev + "% · time " + fmt(ex.t) + " · rematches played " + (r.n || 1) + " · " + n + " drawn from a bank of " + bank}),
    h("div", {class:"chest open"}, [h("img", {src:"u/chest_open.png", alt:""}), h("div", {}, [h("h3", {text:"◆ " + s.orbs + " orbs" + (s.drops ? " plus " + s.drops + " salvaged" : "")}),
      h("div", {class:"muted", text:"1 orb per 6 right answers" + (s.now > s.prev ? ", plus 2 for beating your best." : ". Beat your best for 2 more.") + (miss.length ? " The misses below now join this battle's skirmish." : "")})])]),
    s.fell.length ? h("div", {class:"fb bad", text:"Lost for good: " + s.fell.join(", ")}) : null,
    h("h3", {text:"Every miss (" + miss.length + ")"}),
    miss.length ? missTable(miss) : h("p", {text:"No misses."}),
    h("div", {class:"row"}, [copyBtn(() => examReport(c, ex, head)),
      pool(c).length ? h("button", {class:"go", text:"Skirmish: " + pool(c).length + " foes", on:{click:() => startSkirmish(c.id)}}) : null,
      h("button", {text:"Rematch again", on:{click:() => startRematch(c.id)}}), h("button", {text:"World map", on:{click:() => go("world")}})])]);
}
function villageMisses(s){ const got = {}, out = []; s.log.forEach(x => { if (x.ok || got[x.cid]) return; got[x.cid] = 1; out.push({i:out.length, card:CARDS[x.cid], pick:x.pick, breach:x.breach, timeout:!x.breach && x.pick == null}); }); return out; }
function villageReport(s){
  const miss = villageMisses(s), right = s.log.filter(x => x.ok).length;
  const out = ["[Campaign village] " + s.name + ": " + (s.win ? "held for all " + VIL.rounds + " rounds" : "lost in round " + s.round + " of " + VIL.rounds) + ", " + right + "/" + s.log.length + " answers right, village hearts " + Math.max(0, s.vhp) + "/" + VIL.hearts + ", time " + fmt(s.secs)];
  if (s.fell.length) out.push("Heroes lost: " + s.fell.join(", "));
  if (miss.length) { out.push("Miss details:"); miss.forEach((r, k) => out.push((k + 1) + ") " + (imgSrc(r.card) ? "[image" + (r.card.alt ? ": " + r.card.alt : "") + "] " : "") + r.card.q + " | Mine: " + (r.breach ? "not answered, the foe reached the village" : r.pick == null ? "timed out" : r.card.o[r.pick]) + " | Correct: " + r.card.o[r.card.a] + " | Rule: " + r.card.r + " (p. " + r.card.p + ")")); }
  out.push("Village: mixed questions from the whole bank. No chest and no code.");
  return out.join("\n");
}
function vsum(){
  const s = lastVil; if (!s) return world(); const miss = villageMisses(s), right = s.log.filter(x => x.ok).length;
  return h("div", {class:"panel"}, [
    h("h2", {text:(s.win ? "Village held: " : "Village lost: ") + s.name.replace("Village defense: ", "")}),
    h("div", {class:"big", text:right + "/" + s.log.length + " answers right"}),
    h("div", {class:"muted", text:(s.win ? "All " + VIL.rounds + " rounds survived" : "Fell in round " + s.round + " of " + VIL.rounds) + " · village hearts " + Math.max(0, s.vhp) + "/" + VIL.hearts + " · foes that got in " + s.breach + " · time " + fmt(s.secs)}),
    h("div", {class:"chest open"}, [h("img", {src:"u/chest_open.png", alt:""}), h("div", {}, [h("h3", {text:"◆ " + s.orbs + " orbs" + (s.drops ? " plus " + s.drops + " salvaged" : "")}),
      h("div", {class:"muted", text: s.win ? "Reward for holding, plus 1 per village heart left." : "Consolation: 1 orb per 8 right answers. Hold all " + VIL.rounds + " rounds for the full reward."})])]),
    s.fell.length ? h("div", {class:"fb bad", text:"Lost for good: " + s.fell.join(", ")}) : null,
    h("h3", {text:"Every miss (" + miss.length + ")"}),
    miss.length ? tbl(["Question", "You", "Correct", "Rule", "Page"], miss.map(r => [r.card.q, r.breach ? "Reached the village" : r.pick == null ? "Timed out" : L[r.pick] + ". " + r.card.o[r.pick], L[r.card.a] + ". " + r.card.o[r.card.a], r.card.r, r.card.p])) : h("p", {text:"No misses."}),
    miss.length ? h("p", {class:"muted", text:"Misses from battles you have finished now join those battles' skirmishes."}) : null,
    h("div", {class:"row"}, [copyBtn(() => villageReport(s)), h("button", {class:"go", text:"Defend again", on:{click:() => startVillage(s.realm)}}), h("button", {text:"World map", on:{click:() => go("world")}})])]);
}
function sum(){
  const s = lastSum; if (!s) return world(); const c = CH[s.ch], miss = s.log.filter(x => !x.ok), ok = s.log.filter(x => x.ok).length;
  return h("div", {class:"panel"}, [
    h("h2", {text:(s.win ? "Skirmish cleared: " : "Skirmish lost: ") + c.name}),
    h("div", {class:"big", text:ok + "/" + s.log.length + " answers right"}),
    h("div", {class:"muted", text: s.win ? (s.first ? (s.dup ? HERO[c.emblem].n + " was already with you and gains 1 heart." : HERO[c.emblem].n + " joins your roster.") : (s.orbs ? "Re-skirmish reward: ◆ " + s.orbs + " (1 orb per 3 foes answered right the first time, up to 5)." : s.wait ? "No reward this time: this battle pays again in " + waitText(s.wait) + "." : "No foe was answered right on the first try, so no reward.")) : "The emblem hero stays out of reach until every foe is answered correctly in one skirmish."}),
    s.win && s.first ? h("div", {class:"reveal"}, [heroCard(c.emblem, {show:true})]) : null,
    s.fell.length ? h("div", {class:"fb bad", text:"Lost for good: " + s.fell.map(fname).join(", ")}) : null,
    miss.length ? h("h3", {text:"Missed during this skirmish"}) : null,
    miss.length ? tbl(["Question", "You", "Correct", "Rule", "Page"], miss.map(x => { const k = CARDS[x.cid]; return [k.q, x.pick == null ? "Timed out" : L[x.pick] + ". " + k.o[x.pick], L[k.a] + ". " + k.o[k.a], k.r, k.p]; })) : null,
    h("div", {class:"row"}, [!s.win ? h("button", {class:"go", text:"Try the skirmish again", on:{click:() => startSkirmish(c.id)}}) : null, h("button", {text:"World map", on:{click:() => go("world")}}), h("button", {text:"Roster", on:{click:() => go("roster")}})])]);
}
let renameMode = false, renaming = null;
function setName(hid, val){ const x = S.heroes[hid]; if (!x) return; const v = String(val || "").replace(/\s+/g, " ").trim().slice(0, 16); if (v && v !== HERO[hid].n) x.nm = v; else delete x.nm; save(); }
function renamePanel(){
  const hid = renaming, hr = HERO[hid];
  const inp = h("input", {type:"text", class:"nmin", maxlength:"16", "aria-label":"New name for " + hr.n, value:nm(hid), autocomplete:"off"});
  const done = () => { setName(hid, inp.value); renaming = null; render(); };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") done(); else if (e.key === "Escape") { renaming = null; render(); } });
  setTimeout(() => { inp.focus(); inp.select(); }, 0);
  return h("div", {class:"chest"}, [h("img", {src:hr.img, alt:"", style:"image-rendering:auto;object-fit:contain"}), h("div", {}, [
    h("h3", {text:"Name your " + hr.c}),
    h("div", {class:"row"}, [inp, h("button", {class:"go", text:"Save", on:{click:done}}),
      h("button", {text:"Use original (" + hr.n + ")", on:{click:() => { setName(hid, ""); renaming = null; render(); }}}),
      h("button", {text:"Cancel", on:{click:() => { renaming = null; render(); }}})]),
    h("div", {class:"pixs", text:"Up to 16 characters. The name is lost with the hero if it falls."})])]);
}
function roster(){
  const t = team();
  return h("div", {class:"panel"}, [
    h("h2", {text:"Roster"}),
    h("p", {class:"muted", text:"Click a hero you own to put it in or out of your team of four. Hearts: Common 3, Rare 6, Legendary 10, refilled after every battle. A hero that reaches 0 hearts is lost until you summon or recruit it again. Legendaries carry one Insight per battle."}),
    h("div", {class:"row"}, [h("button", {class: renameMode ? "on" : "", text: renameMode ? "Renaming: click a hero" : "Rename heroes", "aria-pressed":String(renameMode), on:{click:() => { renameMode = !renameMode; renaming = null; render(); }}}),
      renameMode ? h("button", {text:"Done", on:{click:() => { renameMode = false; renaming = null; render(); }}}) : null]),
    renaming && S.heroes[renaming] ? renamePanel() : null,
    h("div", {class:"grid"}, D.heroes.slice().sort((a, b) => (S.heroes[b.id] ? 1 : 0) - (S.heroes[a.id] ? 1 : 0) || b.r - a.r).map(x => heroCard(x.id, {team:t.includes(x.id), click: S.heroes[x.id] ? () => {
      if (renameMode) { renaming = x.id; render(); window.scrollTo(0, 0); return; }
      let cur = team(); if (cur.includes(x.id)) { if (cur.length > 1) cur = cur.filter(y => y !== x.id); } else { if (cur.length >= 4) cur.pop(); cur.push(x.id); } S.team = cur; save(); render(); } : null}))),
    S.fallen.length ? h("h3", {text:"Fallen"}) : null,
    S.fallen.length ? h("div", {class:"row"}, S.fallen.slice(-24).map(f => h("span", {class:"emb"}, [h("img", {src:"u/tomb.png", alt:""}), h("span", {text:f.nm || fname(f.id)})]))) : null,
    h("h3", {text:"Roles and tiles"}),
    tbl(["Role", "Range", "Move", "Perk", "Skill"], Object.keys(ROLE).filter(k => k !== "M").map(k => [ROLE[k].n, ROLE[k].rng, ROLE[k].mv, ROLE[k].d, SKILL[k].n + ": " + SKILL[k].d + ". Ready again after " + SKILL[k].cd + " turns."])),
    h("p", {class:"muted", text:"To use a skill, click a hero that has not acted yet and press Skill (S). A skill does not use up the hero's action."}),
    h("h3", {text:"Elements"}),
    h("p", {class:"muted", text:"Each hero's element fires when that hero answers correctly. Tiles appear where the foe stood and last 3 turns. Shadowstep and Earthshaper only fire on the hero's own attack, once per turn. A Caster's effect is stronger: tiles last 5 turns, Shock lasts one more phase, Tide pushes 3 tiles, Hourglass adds 25 seconds, Salvage drops 2 times in 5."}),
    tbl(["Element", "Effect", "What it does"], ["Fire", "Ice", "Nature", "Light", "Storm", "Water", "Sand", "Shadow", "Earth", "Steam"].map(e => [e, elName(e), elDesc(e)]))]);
}
function redeem(raw){
  const code = String(raw || "").trim().toUpperCase().replace(/\s+/g, ""), m = /^(\d{1,3})-([A-Z0-9]{1,12})-([A-Z0-9]{5})$/.exec(code);
  const rv = /^REVIVE-(\d{1,2})-([A-Z0-9]{1,14})-([A-Z0-9]{5})$/.exec(code);
  if (rv) {
    if (chestCode("REVIVE-" + rv[1] + "-" + rv[2]) !== rv[3]) return "That revive code is not valid.";
    if (S.gifts[code]) return "That revive code was already used on this device.";
    const hr = D.heroes.find(x => x.n.toUpperCase().replace(/[^A-Z0-9]/g, "") === rv[2]);
    if (!hr) return "No hero matches that revive code.";
    let at = -1; S.fallen.forEach((f, i) => { if (f.id === hr.id) at = i; });
    const old = at >= 0 ? S.fallen[at] : null, cur = S.heroes[hr.id] || {exp:0, mg:0}, L = Math.max(1, Math.min(20, +rv[1]));
    cur.exp = Math.max(cur.exp || 0, (L - 1) * 100, (old && old.exp) || 0); cur.mg = Math.max(cur.mg || 0, (old && old.mg) || 0);
    if (old && old.nm && old.nm !== hr.n && !cur.nm) cur.nm = old.nm;
    S.heroes[hr.id] = cur; if (old) S.fallen.splice(at, 1);
    S.gifts[code] = Date.now(); save(); return nm(hr.id) + " returns at level " + lv(hr.id) + ". Add them to your team on the Roster tab.";
  }
  if (!m) return "That is not a gift code.";
  if (chestCode("GIFT-" + m[1] + "-" + m[2]) !== m[3]) return "That gift code is not valid.";
  if (S.gifts[code]) return "That gift code was already used on this device.";
  S.gifts[code] = Date.now(); S.orbs += +m[1]; save(); return "Gift opened: ◆ " + (+m[1]) + " orbs added.";
}
function summon(){
  const feat = D.heroes.filter(x => x.r === 2).slice(0, 5);
  const pull = () => { if (S.orbs < SUMMON) return; S.orbs -= SUMMON; const r = Math.random(), tier = r < ODDS[2] ? 2 : r < ODDS[2] + ODDS[1] ? 1 : 0, opts = D.heroes.filter(x => x.r === tier), hr = opts[Math.floor(Math.random() * opts.length)];
    const dup = grant(hr.id); lastPull = [{id:hr.id, dup}]; S.pulls = (S.pulls || 0) + 1; save(); render(); };
  return h("div", {class:"panel"}, [
    h("h2", {text:"Summoning circle"}),
    h("div", {class:"banner"}, feat.map(x => h("img", {src:x.img, alt:""}))),
    h("p", {class:"muted", text:"Three correct first-attempt answers earn one orb, paid when a battle's chest is opened. A summon costs " + SUMMON + ". Odds: Legendary 2%, Rare 18%, Common 80%. Summoning a hero you already have adds 1 heart to it (up to 3)."}),
    h("div", {class:"row"}, [h("button", {class:"go", text:"Summon (◆ " + SUMMON + ")", disabled:S.orbs < SUMMON, on:{click:pull}}), h("span", {class:"pixs", text:"You have ◆ " + S.orbs})]),
    (() => { const inp = h("input", {type:"text", maxlength:"40", "aria-label":"Gift or revive code", placeholder:"GIFT OR REVIVE CODE", autocomplete:"off", style:"width:30ch"}); const go2 = () => { const msg = redeem(inp.value); note = msg; const n = note; render(); note = n; };
      inp.addEventListener("keydown", e => { if (e.key === "Enter") go2(); });
      return h("div", {class:"row"}, [inp, h("button", {text:"Redeem code", on:{click:go2}}), note ? h("span", {class:"pixs", text:note}) : null]); })(),
    lastPull ? h("div", {class:"reveal"}, lastPull.map(g => { const e = heroCard(g.id, {show:true}); e.appendChild(h("span", {class:"tag " + (g.dup ? "d" : ""), text:g.dup ? "+1 heart" : "New"})); return e; })) : null]);
}
function report(){
  const done = D.chapters.filter(c => c.exam && exam(c) && exam(c).done && LOADED[c.id]);
  const text = () => { const out = done.map(c => examReport(c));
    const hard = Object.keys(S.cards).filter(id => CARDS[id] && S.cards[id].w >= 2).sort((a, b) => S.cards[b].w - S.cards[a].w).slice(0, 12);
    if (hard.length) out.push("Missed twice or more in skirmishes: " + hard.map(id => id + " (" + S.cards[id].w + ")").join(", "));
    return out.join("\n\n") || "No finished battles yet."; };
  const ta = h("textarea", {readonly:true, "aria-label":"Report text"}); ta.value = text();
  const code = h("textarea", {"aria-label":"Save code", placeholder:"Paste a save code here to load it"});
  return h("div", {class:"panel"}, [
    h("h2", {text:"Report for the chat"}),
    h("p", {class:"muted", text:"All finished battles. Each battle's own report is also on its Results screen."}),
    ta, h("div", {class:"row"}, [copyBtn(text), copyBtn(() => D.tutorPrompt, "Copy tutor prompt")]),
    h("h3", {text:"Save code"}),
    h("p", {class:"muted", text:"Progress is kept in this browser. A save code moves it to another device. Imported packs are not included; import them again there."}),
    code,
    h("div", {class:"row"}, [
      h("button", {text:"Make save code", on:{click:() => { code.value = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); code.select(); }}}),
      h("button", {text:"Load save code", on:{click:() => { try { const x = JSON.parse(decodeURIComponent(escape(atob(code.value.trim())))); const u = upgrade(x); if (u) { S = u; save(); S = load(); go("world"); } else code.value = "That save code is from an older version of the game."; } catch (e) { code.value = "That code could not be read."; } }}}),
      h("button", {text: armed === "reset" ? "Click again to erase everything" : "Reset all progress", on:{click:() => { if (armed === "reset") { S = fresh(); save(); S = load(); go("world"); } else { armed = "reset"; render(); } }}})])]);
}
function worlds(){
  const box = h("div", {class:"list"});
  box.appendChild(h("div", {class:"pixs", text:"Choose a chapter. Each one is a world with its own maps; heroes, orbs and the guild library are shared across all of them."}));
  box.appendChild(h("div", {class:"wgrid"}, WORLDS.map(w => { const st = worldState(w), empty = !w.realms.length;
    const card = h("button", {class:"wcard" + (S.world === w.id ? " cur" : "") + (empty ? " soon" : ""), on:{click:() => go("world", {world:w.id, focus:null})}}, [
      h("img", {src:w.img, alt:""}),
      h("div", {class:"wbody"}, [
        h("div", {class:"nm"}, [w.name, h("span", {class:"tag " + (empty ? "d" : st.n === st.of ? "" : "g"), text: empty ? "Coming soon" : st.n + " / " + st.of + " cleared"})]),
        h("div", {class:"muted", text:w.sub || ""}),
        h("div", {class:"pixs", text:(w.el ? w.el + " world · " : "") + (empty ? "No maps yet" : w.realms.filter(r => D.realms[r]).map(r => D.realms[r].split(":")[0]).join(" · "))})])]);
    return card; })));
  return box;
}
const VIEWS = {worlds, world, brief, battle, after, sum, rsum, vsum, roster, summon, report};

/* ---------- input and timer ---------- */
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tg = e.target && e.target.tagName; if (tg === "TEXTAREA" || tg === "INPUT") return;
  if (!B || V.name !== "battle") return;
  const k = e.key.toLowerCase();
  if (Q) {
    if (Q.done) { if (k === "enter" || k === " ") { e.preventDefault(); contQ(); } return; }
    if (B.mode === "exam" && k === "u") { e.preventDefault(); setFlag("unsure"); return; }
    if (B.mode === "exam" && k === "g") { e.preventDefault(); setFlag("guessed"); return; }
    if (k === "i") { e.preventDefault(); insight(); return; }
    const n = "12345".indexOf(k) >= 0 ? "12345".indexOf(k) : "abcde".indexOf(k);
    if (n >= 0) { e.preventDefault(); choose(n); }
    return;
  }
  if (k === "s") { e.preventDefault(); useSkill(); }
  else if (k === "n") { e.preventDefault(); nextFoe(); }
  else if (k === "t") { e.preventDefault(); endPlayerPhase(); }
});
setInterval(() => {
  if (!B || B.mode !== "exam" || V.name !== "battle" || B.paused || document.hidden || !B.ex.started || B.ex.done) return;
  B.ex.t = (B.ex.t || 0) + 1; if (B.el && B.el.timer) B.el.timer.textContent = fmt(B.ex.t); if (B.ex.t % 10 === 0) save();
}, 1000);
window.addEventListener("pagehide", save);
render();
sharedInit();
idbAll().then(ps => { ps.forEach(p => { if (!validatePack(p) && !(PACKS[p.id] && PACKS[p.id].shared)) registerPack(p); }); if (ps.length && V.name === "world") render(); }).catch(() => {});
})();
