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
  "today", "daysAdd", "hasStudy", "betterCard", "newestActivity",
  "blank", "mergeStates", "creditStudyDay", "logDay", "logGrammarDay",
];

// Sandbox globals the extracted functions reference.
const sandbox = {
  S: null,
  A1_THEME_KEYS: [],
  MIG_VERSION: 2,
  save() {},          // no localStorage in Node
  refreshBadges() {}, // no DOM in Node
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

/* ---- report ---- */
console.log("");
console.log(`Streak invariants: ${pass}/${pass + fail} passing`);
if (fail) {
  console.log("FAILED:");
  for (const n of fails) console.log("  ✗ " + n);
  process.exit(1);
}
console.log("All green.");
