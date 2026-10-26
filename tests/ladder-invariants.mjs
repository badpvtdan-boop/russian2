/* Exercise-ladder invariant tests for russian-trainer.html (2026-10-26).
 *
 * Same technique as the other suites: the real functions are extracted from the shipped
 * single-file app and run in a Node vm, so nothing here can drift from what ships.
 *
 * Covers:
 *   1. which exercise each word gets (new → match, misses → easier, box → tiles → typing)
 *   2. typing in Latin letters is graded as Russian — forgiving of spelling systems, strict
 *      enough that a different word does not pass
 *   3. look-alike wrong answers are really wrong and never repeat the right meaning
 *   4. the scheduler is untouched: every format scores through resolve()
 *
 * Run: node tests/ladder-invariants.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "russian-trainer.html"), "utf8");

function extractFn(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("function not found: " + name);
  const braceOpen = src.indexOf("{", start);
  let depth = 0, i = braceOpen;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
function extractConst(name) {
  const start = src.indexOf("const " + name + "=") >= 0 ? src.indexOf("const " + name + "=") : src.indexOf("const " + name + " =");
  if (start < 0) throw new Error("const not found: " + name);
  const end = src.indexOf(";\n", start);
  return src.slice(start, end + 1).replace(/^const /, "var ");
}
function extractArray(name) {
  const start = src.indexOf("const " + name + " = [");
  const open = src.indexOf("[", start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(open, i);
}

const DECK = vm.runInNewContext("(" + extractArray("DECK") + ")");
const sandbox = {
  S: { answerMode: "ladder", direction: "en-ru", cards: {} },
  DECK, DECK_BY_ID: Object.fromEntries(DECK.map(w => [w.id, w])),
  ruVoice: { name: "test" },
  window: { speechSynthesis: {} },
  Math, console,
};
sandbox.window.speechSynthesis = {};
vm.createContext(sandbox);
vm.runInContext("var speechSynthesis={};", sandbox);
vm.runInContext(
  ["LADDER_TILES_BOX = 3, LADDER_TYPE_BOX = 5, MATCH_MAX = 5"].map(x => "var " + x + ";").join("\n") + "\n" +
  ["CHOICE_EX", "LAT_MULTI", "LAT_ONE", "CYR_SKEL"].map(extractConst).join("\n") + "\n" +
  ["shuffle", "norm", "lev", "grade", "glossParts", "choiceClash", "ttsReady", "easyEx", "exerciseFor",
   "stripStress", "lookScore", "smartDistractors", "latToCyr", "hasLatin", "cyrSkel", "latSkel", "gradeTyped", "skelClose"]
    .map(extractFn).join("\n"),
  sandbox);
// ttsReady checks `"speechSynthesis" in window`
vm.runInContext("var window=this; this.speechSynthesis={};", sandbox);

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log("FAIL: " + msg); } }
const run = code => vm.runInContext(code, sandbox);
const ru = s => DECK.find(w => w.ru === s);

// constants agree with the source
const tilesBox = Number(/LADDER_TILES_BOX\s*=\s*(\d+)/.exec(src)[1]);
const typeBox = Number(/LADDER_TYPE_BOX\s*=\s*(\d+)/.exec(src)[1]);
run(`LADDER_TILES_BOX=${tilesBox}; LADDER_TYPE_BOX=${typeBox};`);
ok(tilesBox < typeBox, "tiles come before typing on the ladder");

/* ---- 1. the ladder */
sandbox.S.cards = {};
ok(run(`exerciseFor({id:1,isNew:true,firstTry:true})`) === "match", "a brand-new word is met and matched");
sandbox.S.cards = { 1: { box: 0, introduced: true, reps: 3 } };
ok(["listen", "smart"].includes(run(`exerciseFor({id:1,isNew:false,firstTry:true})`)), "box 0 gets an easy format");
sandbox.S.cards = { 1: { box: tilesBox, introduced: true, reps: 3 } };
ok(run(`exerciseFor({id:1,isNew:false,firstTry:true})`) === "tiles", "middling word is spelled from tiles");
sandbox.S.cards = { 1: { box: typeBox, introduced: true, reps: 3 } };
ok(run(`exerciseFor({id:1,isNew:false,firstTry:true})`) === "type", "strong word is typed");
sandbox.S.cards = { 1: { box: 8, introduced: true, reps: 3 } };
ok(run(`exerciseFor({id:1,isNew:false,firstTry:true})`) === "type", "top box is typed");
ok(["listen", "smart"].includes(run(`exerciseFor({id:1,isNew:false,firstTry:false})`)), "a miss comes back the same day in an easier format");
sandbox.S.answerMode = "choice";
ok(run(`exerciseFor({id:1,isNew:false,firstTry:true})`) === "choice", "'Multiple choice only' still means multiple choice");
sandbox.S.answerMode = "type";
ok(run(`exerciseFor({id:1,isNew:true,firstTry:true})`) === "type", "'Type it only' still means typing");
sandbox.S.answerMode = "ladder";
// both easy formats show up across words when a voice exists
const easy = new Set(); for (let id = 1; id < 30; id++) { sandbox.S.cards = { [id]: { box: 1, introduced: true, reps: 0 } }; easy.add(run(`exerciseFor({id:${id},isNew:false,firstTry:true})`)); }
ok(easy.has("listen") && easy.has("smart"), "easy words alternate between listening and look-alike choice");
run("ruVoice=null;");
const noVoice = new Set(); for (let id = 1; id < 30; id++) { sandbox.S.cards = { [id]: { box: 1, introduced: true, reps: 0 } }; noVoice.add(run(`exerciseFor({id:${id},isNew:false,firstTry:true})`)); }
ok(!noVoice.has("listen"), "no Russian voice on the device → never a listening question");
run("ruVoice={name:'test'};");

/* ---- 2. Latin typing */
sandbox.S.direction = "en-ru";
const accept = [
  ["одеваться", "odevatsa"], ["одеваться", "odevatsya"], ["одеваться", "odevat'sya"],
  ["человек", "chelovek"], ["жизнь", "zhizn"], ["жизнь", "zhizn'"], ["время", "vremya"], ["время", "vremja"],
  ["хороший", "khoroshiy"], ["хороший", "horoshij"], ["хороший", "khoroshii"], ["новый", "novyy"], ["новый", "novyi"],
  ["щука", "shchuka"], ["ещё", "eshchyo"], ["ещё", "yeshcho"], ["семья", "semya"], ["семья", "sem'ya"],
  ["улица", "ulitsa"], ["улица", "ulica"], ["до свидания", "do svidaniya"], ["как дела", "kak dela"],
  ["человек", "человек"], ["человек", "chelovk"],   // one slip is forgiven on a long word
];
for (const [r, typed] of accept) {
  const w = ru(r) || { ru: r, en: "x" };
  ok(run(`gradeTyped(${JSON.stringify(typed)}, ${JSON.stringify(w)})`), `"${typed}" is accepted for ${r}`);
}
const reject = [
  ["дом", "dym"], ["дом", "dim"], ["год", "god'a"], ["кошка", "koshki"], ["человек", "chelovechek"],
  ["хороший", "plokhoy"], ["день", "den' i noch"], ["жизнь", ""], ["время", "vremennyy"],
];
for (const [r, typed] of reject) {
  const w = ru(r) || { ru: r, en: "x" };
  ok(!run(`gradeTyped(${JSON.stringify(typed)}, ${JSON.stringify(w)})`), `"${typed}" is NOT accepted for ${r}`);
}
ok(run(`latToCyr("odevatsa")`) === "одеваться", "preview reads -tsa as -ться");
ok(run(`latToCyr("zhizn'")`) === "жизнь", "preview: zhizn' → жизнь");
ok(run(`latToCyr("moy")`) === "мой", "preview: moy → мой");
ok(run(`latToCyr("novyy")`) === "новый", "preview: novyy → новый");
ok(run(`latToCyr("shchi")`) === "щи", "preview: shchi → щи");

/* ---- 3. look-alike wrong answers */
sandbox.S.cards = {};
let clash = 0, dupMeaning = 0, wrongPos = 0, short = 0;
const sample = DECK.filter((_, i) => i % 7 === 0);
for (const w of sample) {
  const d = run(`smartDistractors(DECK_BY_ID[${w.id}], 4)`);
  if (d.length < 4) short++;
  for (const x of d) {
    if (run(`choiceClash(DECK_BY_ID[${w.id}], DECK_BY_ID[${x.id}])`)) clash++;
    if (String(x.en).toLowerCase() === String(w.en).toLowerCase()) dupMeaning++;
    if (x.pos !== w.pos) wrongPos++;
    if (x.id === w.id) clash++;
  }
  const ens = d.map(x => String(x.en).toLowerCase());
  if (new Set(ens).size !== ens.length) dupMeaning++;
}
ok(clash === 0, "no wrong option is a defensible right answer (" + clash + ")");
ok(dupMeaning === 0, "no two options show the same English (" + dupMeaning + ")");
ok(wrongPos === 0, "wrong options share the part of speech (" + wrongPos + ")");
ok(short === 0, "every sampled word gets four wrong options (" + short + " short)");
const excl = run(`smartDistractors(DECK_BY_ID[${DECK[0].id}], 6, [${DECK.slice(1, 40).map(w => w.id).join(",")}])`);
ok(excl.every(x => !DECK.slice(1, 40).some(w => w.id === x.id)), "matching's spare word is never one of the words being matched");
// look-alikes actually look alike: on average they share more letters than random picks
let simSmart = 0, simRand = 0;
for (const w of sample.slice(0, 80)) {
  for (const x of run(`smartDistractors(DECK_BY_ID[${w.id}], 4)`)) simSmart += run(`lookScore(${JSON.stringify(w.ru)}, ${JSON.stringify(x.ru)})`);
  const same = DECK.filter(x => x.pos === w.pos && x.id !== w.id);
  for (let k = 0; k < 4; k++) { const x = same[Math.floor(Math.random() * same.length)]; simRand += run(`lookScore(${JSON.stringify(w.ru)}, ${JSON.stringify(x.ru)})`); }
}
ok(simSmart > simRand + 80, `look-alike options look more alike than random ones (${simSmart.toFixed(0)} vs ${simRand.toFixed(0)})`);

/* ---- 4. one scoring path */
const resolveCalls = (src.match(/resolve\(/g) || []).length;
ok(/function resolve\(ok, quiet\)/.test(src), "resolve() takes a quiet flag for the matching round");
ok(/finishMatch[\s\S]{0,600}resolve\(r\.ok, true\)/.test(src), "matching scores each word through resolve()");
ok(/tilesCorrect\(\)\);/.test(src) && /gradeTyped\(cur\.typed, w\)/.test(src), "tiles and typing score through resolve()");
ok(/MIG_VERSION=5/.test(src) && /s\.answerMode = "ladder"/.test(src), "existing saves move to the ladder once (migration v5)");
ok(/answerMode:"ladder"/.test(extractFn("blank")), "a brand-new save starts on the ladder");

console.log(`\nLadder invariants: ${pass}/${pass + fail} passing`);
if (fail) { console.log(fail + " failing."); process.exit(1); } else console.log("All green.");
