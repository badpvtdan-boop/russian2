/* Streak-crediting invariant tests for russian-trainer.html.
 *
 * The app is a single non-modular HTML file, so rather than copy its functions
 * (which would drift from the source), we EXTRACT the real function bodies from
 * russian-trainer.html and run them in a Node vm sandbox with minimal stubs.
 * This exercises the actual shipped code.
 *
 * Run: node tests/streak-invariants.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "russian-trainer.html"), "utf8");

/* Brace-match a `function NAME(...) { ... }` out of the source by name. */
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

const FNS = [
  "today", "daysAdd", "hasStudy", "laterDate", "betterCard", "newestActivity",
  "blank", "mergeStates", "creditStudyDay", "logDay", "logGrammarDay",
  "studyDays", "lastStudyDay", "streakEndingAt", "healStreak", "stateLooksEmpty",
  "card", "gcard", "resolve", "gradeGrammarCard",
  "loadOn", "projectedLoad", "balancedDue",
];

// Sandbox globals the extracted functions reference.
const sandbox = {
  S: null,
  A1_THEME_KEYS: [],
  // Read straight from the app so these can never drift from the shipped ladder.
  MIG_VERSION: Number(/\bMIG_VERSION\s*=\s*(\d+)/.exec(src)[1]),
  INTERVALS: JSON.parse(/\bINTERVALS\s*=\s*(\[[^\]]*\])/.exec(src)[1]),
  KNOWN_BOX: Number(/\bKNOWN_BOX\s*=\s*(\d+)/.exec(src)[1]),
  save() {},            // no localStorage in Node
  refreshBadges() {},   // no DOM in Node
  renderProgress() {},  // no DOM
  renderGProgress() {}, // no DOM
  showFeedback() {},    // no DOM (resolve() calls it at the end)
  // drill/grammar session globals the real review functions read/mutate:
  cur: null, queue: [], sessionDone: 0,
  gq: [], gcur: null, gDoneN: 0,
  DECK_BY_ID: {},
  console,
};
vm.createContext(sandbox);
vm.runInContext(FNS.map(extractFn).join("\n"), sandbox);

// today() reads the real clock; make it deterministic for tests.
let FAKE_TODAY = "2026-08-16";
sandbox.today = () => FAKE_TODAY;

/* ---- tiny test harness ---- */
let pass = 0, fail = 0;
const fails = [];
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); }
}
function freshState(over = {}) {
  return Object.assign(sandbox.blank(), over);
}
// Build a dailyLog spanning [startISO .. endISO] inclusive, all "studied".
function studiedRange(startISO, endISO) {
  const log = {};
  let d = startISO;
  for (let cap = 0; cap < 3650; cap++) {
    log[d] = { newDone: 10, reviewDone: 0, studied: true };
    if (d === endISO) break;
    d = sandbox.daysAdd(d, 1);
  }
  return log;
}

/* ===== 1. Abandoned session still credits the day ===== */
// Simulate: only the FIRST item got logged (no finish screen reached).
(function abandonedDrill() {
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState({ streak: 5, lastCompleted: "2026-08-15" });
  sandbox.logDay(true);  // first new card of a session, then user bails
  const l = sandbox.S.dailyLog["2026-08-16"];
  check("abandoned drill: day marked studied", l && l.studied === true);
  check("abandoned drill: newDone incremented", l && l.newDone === 1);
  check("abandoned drill: lastCompleted advanced", sandbox.S.lastCompleted === "2026-08-16");
  check("abandoned drill: streak incremented 5->6", sandbox.S.streak === 6);
})();

(function abandonedGrammar() {
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState({ streak: 5, lastCompleted: "2026-08-15" });
  sandbox.logGrammarDay(); // one grammar item, then bail
  const l = sandbox.S.dailyLog["2026-08-16"];
  check("abandoned grammar: gDone incremented", l && l.gDone === 1);
  check("abandoned grammar: day credited (streak 5->6)", sandbox.S.streak === 6 && sandbox.S.lastCompleted === "2026-08-16");
})();

(function abandonedReviewOnly() {
  // Review-only day: reviews now log via logDay(false); must still credit.
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState({ streak: 5, lastCompleted: "2026-08-15" });
  sandbox.logDay(false); // a completed review
  const l = sandbox.S.dailyLog["2026-08-16"];
  check("review-only: reviewDone incremented (not dead)", l && l.reviewDone === 1);
  check("review-only: day credited (streak 5->6)", sandbox.S.streak === 6 && sandbox.S.lastCompleted === "2026-08-16");
})();

/* ===== 2. Same-day repeat calls don't double-increment the streak ===== */
(function idempotentSameDay() {
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState({ streak: 5, lastCompleted: "2026-08-15" });
  sandbox.logDay(true);   // streak 5 -> 6, lastCompleted -> 08-16
  sandbox.logDay(false);  // another item same day
  sandbox.logDay(true);   // and another
  sandbox.creditStudyDay(); // and a direct call
  const l = sandbox.S.dailyLog["2026-08-16"];
  check("same-day: streak bumped exactly once (==6)", sandbox.S.streak === 6);
  check("same-day: per-item counters still add up (new=2, rev=1)", l.newDone === 2 && l.reviewDone === 1);
})();

/* ===== 3. mergeStates recovers a studied day newer than a stale lastCompleted ===== */
(function mergeRecoversNewerDay() {
  // 08-04..08-13 studied (10 days), plus 08-14 logged with gDone but NEVER credited
  // (no studied flag, lastCompleted stuck at 08-13) — the exact 08-14 bug fingerprint.
  const log = studiedRange("2026-08-04", "2026-08-13");
  log["2026-08-14"] = { newDone: 0, reviewDone: 0, gDone: 5 }; // hasStudy via gDone, but not "studied"
  const stale = freshState({ streak: 10, lastCompleted: "2026-08-13", dailyLog: log });
  const merged = sandbox.mergeStates(stale, sandbox.blank());
  check("merge: lastCompleted moves to newest studied day 08-14", merged.lastCompleted === "2026-08-14");
  check("merge: streak recomputed to 11 (08-04..08-14)", merged.streak === 11);
})();

/* ===== sanity: idempotence + blank-identity (merge invariants relied on elsewhere) ===== */
(function mergeIdempotent() {
  const log = studiedRange("2026-08-10", "2026-08-16");
  const s = freshState({ streak: 7, lastCompleted: "2026-08-16", dailyLog: log,
    cards: { 1: { reps: 3, box: 2, due: "2026-08-20", introduced: true } },
    lessons: { prep: { done: true, best: 0.9 } } });
  const once = sandbox.mergeStates(s, sandbox.blank());
  const twice = sandbox.mergeStates(once, once);
  check("merge idempotent: merge(merge(s,blank),self) stable", JSON.stringify(once) === JSON.stringify(twice));
})();

(function blankIdentity() {
  const s = freshState({ streak: 4, lastCompleted: "2026-08-16",
    dailyLog: studiedRange("2026-08-13", "2026-08-16"),
    cards: { 42: { reps: 5, box: 3, due: "2026-09-01", introduced: true } },
    exams: { A1: { passed: true, best: 0.88, date: "2026-08-01" } } });
  const merged = sandbox.mergeStates(s, sandbox.blank());
  check("blank-identity: card progress preserved", merged.cards["42"] && merged.cards["42"].reps === 5);
  check("blank-identity: exam pass preserved", merged.exams.A1 && merged.exams.A1.passed === true);
})();

/* ===== Change B: future/mis-dated entries can't hijack the anchor ===== */
(function futureDatedDoesNotHijack() {
  FAKE_TODAY = "2026-08-16";
  // 10 consecutive studied days ending today, plus a stray future entry (today+7).
  const log = studiedRange("2026-08-07", "2026-08-16"); // 08-07..08-16 inclusive = 10 days
  log["2026-08-23"] = { newDone: 10, reviewDone: 0, studied: true }; // clock-skew stray
  const s = freshState({ streak: 10, lastCompleted: "2026-08-16", dailyLog: log });
  const merged = sandbox.mergeStates(s, sandbox.blank());
  check("future stray: anchor stays at today (not 08-23)", merged.lastCompleted === "2026-08-16");
  check("future stray: 10-day streak not collapsed", merged.streak === 10);
})();

(function futureAlongsideValidNewerDay() {
  FAKE_TODAY = "2026-08-16";
  // 9 days 08-07..08-15, a VALID newest day today (08-16), and a future stray (08-23).
  const log = studiedRange("2026-08-07", "2026-08-15"); // 9 days
  log["2026-08-16"] = { newDone: 10, reviewDone: 0, studied: true }; // valid newest = today
  log["2026-08-23"] = { newDone: 10, reviewDone: 0, studied: true }; // future stray
  const s = freshState({ streak: 9, lastCompleted: "2026-08-15", dailyLog: log });
  const merged = sandbox.mergeStates(s, sandbox.blank());
  check("valid-vs-future: anchor is the valid 08-16, not 08-23", merged.lastCompleted === "2026-08-16");
  check("valid-vs-future: streak = 10 (08-07..08-16)", merged.streak === 10);
})();

(function healCaseStillPassesWithCap() {
  // Re-assert the 08-14 heal explicitly under the today()-cap (08-14 <= today).
  FAKE_TODAY = "2026-08-16";
  const log = studiedRange("2026-08-04", "2026-08-13");
  log["2026-08-14"] = { newDone: 0, reviewDone: 0, gDone: 5 };
  const stale = freshState({ streak: 10, lastCompleted: "2026-08-13", dailyLog: log });
  const merged = sandbox.mergeStates(stale, sandbox.blank());
  check("heal-with-cap: anchor 08-14", merged.lastCompleted === "2026-08-14");
  check("heal-with-cap: streak 11", merged.streak === 11);
})();

/* ===== Change A: counters still accumulate per card after the guard-move ===== */
(function countersAccumulateAfterGuardMove() {
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState({ streak: 5, lastCompleted: "2026-08-15" });
  let saves = 0;
  const realSave = sandbox.save;
  sandbox.save = () => { saves++; }; // count creditStudyDay's own save() calls
  sandbox.logDay(true);   // item 1: new  -> first credit of the day (guard fires -> 1 save)
  sandbox.logDay(true);   // item 2: new  -> same day (guard skips -> no creditStudyDay save)
  sandbox.logDay(false);  // item 3: review
  sandbox.logDay(true);   // item 4: new
  sandbox.save = realSave;
  const l = sandbox.S.dailyLog["2026-08-16"];
  check("guard-move: newDone accumulates per call (==3)", l.newDone === 3);
  check("guard-move: reviewDone accumulates (==1)", l.reviewDone === 1);
  check("guard-move: streak bumped exactly once (5->6)", sandbox.S.streak === 6);
  check("guard-move: creditStudyDay saved only on first credit (1 save)", saves === 1);
})();

/* ===== lastReviewed: reviewing a card stamps today's local date ===== */
(function reviewStampsLastReviewed() {
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState();
  sandbox.cur = { id: "v1", isNew: false, firstTry: false };
  sandbox.queue = [sandbox.cur];
  sandbox.sessionDone = 0;
  sandbox.DECK_BY_ID = { v1: { id: "v1", ru: "дом", en: "house", pos: "noun" } };
  sandbox.resolve(true); // a correct vocab review
  check("review (correct) stamps lastReviewed = today", sandbox.S.cards["v1"].lastReviewed === "2026-08-16");
})();

(function lapseAlsoStamps() {
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState();
  sandbox.cur = { id: "v2", isNew: false, firstTry: false };
  sandbox.queue = [sandbox.cur];
  sandbox.DECK_BY_ID = { v2: { id: "v2", ru: "х", en: "y", pos: "noun" } };
  sandbox.resolve(false); // a FAILED review — a review still happened
  check("lapse (wrong) also stamps lastReviewed", sandbox.S.cards["v2"].lastReviewed === "2026-08-16");
})();

(function grammarReviewStamps() {
  FAKE_TODAY = "2026-08-16";
  sandbox.S = freshState();
  sandbox.gcur = { id: "g1" };
  sandbox.gq = [{ id: "g1" }];
  sandbox.gDoneN = 0;
  sandbox.gradeGrammarCard(true); // grammar review stamps the gcard
  check("grammar review stamps gcard lastReviewed", sandbox.S.gcards["g1"].lastReviewed === "2026-08-16");
})();

/* ===== lastReviewed: merge is monotonic and never fabricates ===== */
(function mergeTakesLaterDate() {
  const a = freshState({ cards: { 1: { reps: 5, box: 2, due: "2026-08-20", lastReviewed: "2026-08-10" } } });
  const b = freshState({ cards: { 1: { reps: 5, box: 2, due: "2026-08-20", lastReviewed: "2026-08-14" } } });
  const m = sandbox.mergeStates(a, b);
  check("merge: takes the later lastReviewed (08-14)", m.cards["1"].lastReviewed === "2026-08-14");
  // commutative
  const m2 = sandbox.mergeStates(b, a);
  check("merge: later-date is order-independent", m2.cards["1"].lastReviewed === "2026-08-14");
})();

(function mergeOneSideUndefined() {
  const a = freshState({ cards: { 1: { reps: 5, box: 2, due: "2026-08-20", lastReviewed: "2026-08-12" } } });
  const b = freshState({ cards: { 1: { reps: 5, box: 2, due: "2026-08-20" } } }); // no lastReviewed
  const m = sandbox.mergeStates(a, b);
  check("merge: defined date wins over undefined (a,b)", m.cards["1"].lastReviewed === "2026-08-12");
  const m2 = sandbox.mergeStates(b, a);
  check("merge: defined date wins over undefined (b,a)", m2.cards["1"].lastReviewed === "2026-08-12");
})();

(function mergeBothUndefined() {
  const a = freshState({ cards: { 1: { reps: 5, box: 2, due: "2026-08-20" } } });
  const b = freshState({ cards: { 1: { reps: 3, box: 1, due: "2026-08-18" } } });
  const m = sandbox.mergeStates(a, b);
  check("merge: both undefined -> field absent (not fabricated)",
    !("lastReviewed" in m.cards["1"]) && m.cards["1"].lastReviewed === undefined);
})();

(function legacyCardSurvivesUnchanged() {
  // A pre-feature card (no lastReviewed) must survive a merge without gaining a date.
  const legacy = { reps: 8, box: 5, due: "2026-09-01", lapses: 1, introduced: true };
  const a = freshState({ cards: { 99: { ...legacy } } });
  const m = sandbox.mergeStates(a, sandbox.blank());
  check("legacy card: no lastReviewed fabricated by merge", !("lastReviewed" in m.cards["99"]));
  check("legacy card: scheduling fields preserved", m.cards["99"].reps === 8 && m.cards["99"].box === 5 && m.cards["99"].due === "2026-09-01");
})();

/* ===== daysAdd: pure date math, no local-time drift =====
   The old local getDate/setDate version returned 10-31 for daysAdd("2026-11-02",-1),
   so the day after every fall-back looked like a broken streak. */
(function daysAddAcrossDst() {
  /* The bug only shows outside UTC, and CI/dev machines here run UTC — so pin the
     process to Danny's zone for this check or it passes against the broken version. */
  const realTZ = process.env.TZ;
  process.env.TZ = "America/Chicago";
  const back = sandbox.daysAdd("2026-11-02", -1);
  check("daysAdd: day after DST fall-back steps back one real day", back === "2026-11-01");
  check("daysAdd: forward across the same boundary", sandbox.daysAdd("2026-11-01", 1) === "2026-11-02");
  // exhaustive: every day of 2026-2027 steps back exactly one calendar day
  let bad = 0, d = "2026-01-01";
  for (let i = 0; i < 730; i++) {
    const next = sandbox.daysAdd(d, 1);
    if (sandbox.daysAdd(next, -1) !== d) bad++;
    d = next;
  }
  check("daysAdd: round-trips on all 730 days of 2026-2027 (America/Chicago)", bad === 0);
  if (realTZ === undefined) delete process.env.TZ; else process.env.TZ = realTZ;
})();

(function dstDayDoesNotBreakStreak() {
  const realTZ = process.env.TZ;
  process.env.TZ = "America/Chicago";
  FAKE_TODAY = "2026-11-02";
  sandbox.S = freshState({ streak: 29, lastCompleted: "2026-11-01",
    dailyLog: studiedRange("2026-10-05", "2026-11-01") });
  sandbox.logDay(true);
  check("DST: streak continues into 11-02 (not reset to 1)", sandbox.S.streak === 30);
  if (realTZ === undefined) delete process.env.TZ; else process.env.TZ = realTZ;
})();

/* ===== Evidence: a card reviewed that day proves the day ===== */
(function cardStampIsEvidence() {
  FAKE_TODAY = "2026-09-15";
  const set = sandbox.studyDays(freshState({
    dailyLog: studiedRange("2026-09-10", "2026-09-13"),
    cards: { v1: { reps: 3, box: 2, lastReviewed: "2026-09-14" } },
  }));
  check("evidence: card lastReviewed counts as a studied day", set["2026-09-14"] === true);
  check("evidence: run walks through the card-only day", sandbox.streakEndingAt(set, "2026-09-14") === 5);
})();

(function futureStampIgnored() {
  FAKE_TODAY = "2026-09-15";
  const set = sandbox.studyDays(freshState({
    cards: { v1: { lastReviewed: "2026-09-22" } },   // clock skew on another device
  }));
  check("evidence: a future card stamp is ignored", set["2026-09-22"] === undefined);
})();

/* ===== Danny's 09-15 case: one uncredited day no longer wipes the streak =====
   09-14 was studied (cards stamped) but never credited — lastCompleted stuck at 09-13.
   Old behaviour: today's first answer reset the streak to 1. */
(function uncreditedDayDoesNotWipe() {
  FAKE_TODAY = "2026-09-15";
  const log = studiedRange("2026-08-16", "2026-09-13");   // 29 days ending 09-13
  sandbox.S = freshState({ streak: 29, lastCompleted: "2026-09-13", dailyLog: log,
    cards: { v1: { reps: 9, box: 3, lastReviewed: "2026-09-14" } } });
  sandbox.logDay(true);   // first answer of 09-15
  check("uncredited day: streak continues to 31, not 1", sandbox.S.streak === 31);
  check("uncredited day: anchor is today", sandbox.S.lastCompleted === "2026-09-15");
})();

(function loadTimeHeal() {
  FAKE_TODAY = "2026-09-15";
  const log = studiedRange("2026-08-16", "2026-09-13");
  const s = freshState({ streak: 1, lastCompleted: "2026-09-15", dailyLog: log,
    cards: { v1: { reps: 9, box: 3, lastReviewed: "2026-09-14" } } });
  s.dailyLog["2026-09-15"] = { newDone: 1, reviewDone: 0, studied: true };
  const changed = sandbox.healStreak(s);   // what load() does on the next reload
  check("heal: an already-reset streak is rebuilt to 31", s.streak === 31);
  check("heal: reports that it changed something", changed === true);
  check("heal: the card-only day is written back into the log",
    !!(s.dailyLog["2026-09-14"] && s.dailyLog["2026-09-14"].studied === true));
})();

(function healIsIdempotent() {
  FAKE_TODAY = "2026-09-15";
  const s = freshState({ streak: 1, lastCompleted: "2026-09-13",
    dailyLog: studiedRange("2026-09-10", "2026-09-15") });
  sandbox.healStreak(s);
  const once = JSON.stringify(s);
  const changed = sandbox.healStreak(s);
  check("heal: second pass changes nothing", changed === false && JSON.stringify(s) === once);
})();

/* ===== A genuine miss still resets ===== */
(function realMissStillResets() {
  FAKE_TODAY = "2026-09-15";
  const log = studiedRange("2026-08-16", "2026-09-13");   // nothing at all on 09-14
  sandbox.S = freshState({ streak: 29, lastCompleted: "2026-09-13", dailyLog: log });
  sandbox.logDay(true);
  check("real miss: streak honestly resets to 1", sandbox.S.streak === 1);
})();

(function healNeverInventsAStreak() {
  FAKE_TODAY = "2026-09-15";
  const s = freshState({ streak: 0, lastCompleted: null });
  check("heal: blank state left alone", sandbox.healStreak(s) === false && s.streak === 0 && s.lastCompleted === null);
})();

/* ===== Cold-start restore: what counts as an empty save =====
   iOS can reclaim the web app's storage; the app then looks brand-new and the first
   answer writes a 1-day streak over a month of history. ghRestoreIfEmpty() pulls the
   backup first — but only when the save really is empty. */
(function emptyDetection() {
  check("empty: a fresh blank() save is empty", sandbox.stateLooksEmpty(sandbox.blank()) === true);
  check("empty: null/undefined treated as empty", sandbox.stateLooksEmpty(null) === true);
  check("empty: preferences alone don't count as progress",
    sandbox.stateLooksEmpty(freshState({ direction: "ru-en", voiceName: "Milena", answerMode: "type" })) === true);
  check("empty: untouched cards don't count as progress",
    sandbox.stateLooksEmpty(freshState({ cards: { v1: { box: 0, reps: 0, introduced: false } } })) === true);
})();

(function notEmptyDetection() {
  check("not empty: one logged day", sandbox.stateLooksEmpty(freshState({ dailyLog: studiedRange("2026-09-14", "2026-09-14") })) === false);
  check("not empty: an introduced card", sandbox.stateLooksEmpty(freshState({ cards: { v1: { box: 2, reps: 4, introduced: true } } })) === false);
  check("not empty: a card with reps but no introduced flag (legacy save)",
    sandbox.stateLooksEmpty(freshState({ cards: { v1: { box: 1, reps: 2 } } })) === false);
  check("not empty: a completed lesson", sandbox.stateLooksEmpty(freshState({ lessons: { prep: { done: true, best: 0.9 } } })) === false);
})();

(function restoredBackupRebuildsTheStreak() {
  // The wiped-phone path end to end: empty local save + the backup -> merge -> real streak.
  FAKE_TODAY = "2026-09-15";
  const backup = freshState({ streak: 29, lastCompleted: "2026-09-13",
    dailyLog: studiedRange("2026-08-16", "2026-09-13"),
    cards: { v1: { reps: 9, box: 3, introduced: true, lastReviewed: "2026-09-14" } } });
  const wiped = sandbox.blank();
  check("restore: the wiped save is detected as empty", sandbox.stateLooksEmpty(wiped) === true);
  const merged = sandbox.mergeStates(wiped, backup);
  check("restore: merged streak is 30, not 1", merged.streak === 30);
  check("restore: merged anchor is the card-stamped 09-14", merged.lastCompleted === "2026-09-14");
})();

/* ---- report ---- */
console.log("");
console.log(`Streak invariants: ${pass}/${pass + fail} passing`);
if (fail) {
  console.log("FAILED:");
  for (const n of fails) console.log("  ✗ " + n);
  process.exit(1);
}
console.log("All green.");
