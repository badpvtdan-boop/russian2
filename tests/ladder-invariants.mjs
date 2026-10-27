/* Exercise-ladder invariant tests for russian-trainer.html (2026-10-26).
 *
 * Same technique as the other suites: the real functions are extracted from the shipped
 * single-file app and run in a Node vm, so nothing here can drift from what ships.
 *
 * Covers:
 *   1. which exercise each word gets (new → match, everything after → listening / look-alike
 *      choice; letter tiles and typing were taken out of the ladder 2026-10-27)
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
  S: { drillMode: "ladder", direction: "en-ru", cards: {} },
  DECK, DECK_BY_ID: Object.fromEntries(DECK.map(w => [w.id, w])),
  ruVoice: { name: "test" },
  window: { speechSynthesis: {} },
  Math, console,
};
sandbox.window.speechSynthesis = {};
vm.createContext(sandbox);
vm.runInContext("var speechSynthesis={};", sandbox);
vm.runInContext(
  ["MATCH_MAX = 5"].map(x => "var " + x + ";").join("\n") + "\n" +
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

// letter tiles are gone from the app entirely
ok(!/LADDER_TILES_BOX|LADDER_TYPE_BOX|buildTiles|id="tiles"/.test(src), "no letter-tile exercise left in the app");

/* ---- 1. the ladder */
sandbox.S.cards = {};
ok(run(`exerciseFor({id:1,isNew:true,firstTry:true})`) === "match", "a brand-new word is met and matched");
sandbox.S.cards = { 1: { box: 0, introduced: true, reps: 3 } };
ok(["listen", "smart"].includes(run(`exerciseFor({id:1,isNew:false,firstTry:true})`)), "box 0 gets an easy format");
for (let box = 0; box <= 10; box++) {
  sandbox.S.cards = { 1: { box, introduced: true, reps: 3 }, 2: { box, introduced: true, reps: 4 } };
  for (const id of [1, 2]) {
    const ex = run(`exerciseFor({id:${id},isNew:false,firstTry:true})`);
    ok(["listen", "smart"].includes(ex), `box ${box} gets listening or look-alike choice, never tiles or typing (got ${ex})`);
  }
}
ok(["listen", "smart"].includes(run(`exerciseFor({id:1,isNew:false,firstTry:false})`)), "a miss comes back the same day in an easier format");
sandbox.S.drillMode = "choice";
ok(run(`exerciseFor({id:1,isNew:false,firstTry:true})`) === "choice", "'Multiple choice only' still means multiple choice");
sandbox.S.drillMode = "type";
ok(run(`exerciseFor({id:1,isNew:true,firstTry:true})`) === "type", "'Type it only' still means typing");
sandbox.S.drillMode = "ladder";
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
ok(/gradeTyped\(cur\.typed, w\)/.test(src), "typing (Type it only) scores through resolve()");
ok(/drillMode:"ladder"/.test(extractFn("blank")), "a brand-new save starts on the ladder");

/* ---- 5. the merge must not switch the ladder back off (2026-10-26).
   The first release flipped answerMode; mergeStates() takes preferences from whichever copy
   studied more recently, and the GitHub backup (old code, answerMode "choice", newer study day)
   flipped it straight back. Run the real merge on exactly that pair. */
const msb = { A1_THEME_KEYS: ["core"], MIG_VERSION: Number(/\bMIG_VERSION\s*=\s*(\d+)/.exec(src)[1]), console };
vm.createContext(msb);
vm.runInContext(["today", "daysAdd", "blank", "hasStudy", "newestActivity", "betterCard", "laterDate",
  "studyDays", "lastStudyDay", "streakEndingAt", "healStreak", "mergeStates"].map(extractFn).join("\n"), msb);
msb.today = () => "2026-10-26";
const mrun = c => vm.runInContext(c, msb);
const local = { cards: {}, dailyLog: { "2026-10-20": { newDone: 1, reviewDone: 3 } }, lastCompleted: "2026-10-20", answerMode: "choice", migv: 5 };
const oldBackup = { cards: {}, dailyLog: { "2026-10-24": { newDone: 2, reviewDone: 9 } }, lastCompleted: "2026-10-24", answerMode: "choice", migv: 4 };
msb.A = local; msb.B = oldBackup;
ok(mrun("mergeStates(A,B).drillMode") === "ladder", "an old backup with newer study days does not switch the ladder off");
ok(mrun("mergeStates(B,A).drillMode") === "ladder", "...whichever side the merge starts from");
msb.C = Object.assign({}, oldBackup, { drillMode: "choice", dailyLog: { "2026-10-25": { newDone: 1, reviewDone: 1 } }, lastCompleted: "2026-10-25" });
ok(mrun("mergeStates(A,C).drillMode") === "choice", "a format Danny picks himself does travel between devices");
ok(/"drillMode"/.test(extractFn("mergeStates")), "drillMode is in mergeStates' preference list (README rule 4)");
ok(/S\.drillMode=e\.target\.value/.test(src), "the Settings picker writes drillMode");

console.log(`\nLadder invariants: ${pass}/${pass + fail} passing`);
if (fail) { console.log(fail + " failing."); process.exit(1); } else console.log("All green.");
