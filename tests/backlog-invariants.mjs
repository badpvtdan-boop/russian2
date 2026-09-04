/* Backlog / daily-quota invariant tests for russian-trainer.html.
 *
 * Same technique as streak-invariants.mjs: EXTRACT the real function bodies out of the
 * single-file app and run them in a Node vm sandbox with minimal stubs, so these tests
 * exercise the shipped code rather than a copy that can drift.
 *
 * Covers the four things that made "Review 20 words due today" repeat forever:
 *   1. the daily review cap actually terminating within a day
 *   2. a missed NEW word no longer consuming a review slot
 *   3. the due queue being ordered most-overdue-first, not by word id
 *   4. spreadBacklog() turning an unclearable pile into a clearable schedule
 * ...plus the new-word pause and the bounded extra-practice fallback.
 *
 * Run: node tests/backlog-invariants.mjs
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
/* Pull a `const NAME = <number>;` straight out of the source so the tests can never
   disagree with the app about what the caps are. */
function constNum(name) {
  const m = new RegExp("\\b" + name + "\\s*=\\s*(\\d+)").exec(src);
  if (!m) throw new Error("const not found: " + name);
  return Number(m[1]);
}

const NEW_PER_DAY = constNum("NEW_PER_DAY");
const REVIEW_PER_DAY = constNum("REVIEW_PER_DAY");
const BACKLOG_PAUSE_NEW = constNum("BACKLOG_PAUSE_NEW");
const BACKLOG_CATCHUP_PER_DAY = constNum("BACKLOG_CATCHUP_PER_DAY");
const BACKLOG_MAX_HORIZON = constNum("BACKLOG_MAX_HORIZON");
/* Parsed from the app, never restated here: a sandbox that hardcodes the ladder silently
   tests a version of the scheduler that no longer ships. */
const INTERVALS_SRC = JSON.parse(/\bINTERVALS\s*=\s*(\[[^\]]*\])/.exec(src)[1]);

const FNS = [
  "today", "daysAdd", "blank", "shuffle", "activeThemes", "deckActive",
  "card", "creditStudyDay", "logDay", "resolve", "loadOn", "projectedLoad", "balancedDue",
  "rebalanceSchedule",
  "spreadBacklog", "dueReviewIds", "dueReviewCount", "newAllowedToday",
  "buildQueue", "owedToday", "availNewCount", "startSession",
];

const sandbox = {
  S: null,
  A1_THEME_KEYS: ["core"],
  MIG_VERSION: 3,
  INTERVALS: INTERVALS_SRC,
  KNOWN_BOX: constNum("KNOWN_BOX"),
  NEW_PER_DAY, REVIEW_PER_DAY,
  BACKLOG_PAUSE_NEW, BACKLOG_CATCHUP_PER_DAY, BACKLOG_MAX_HORIZON,
  DECK: [], DECK_BY_ID: {},
  cur: null, queue: [], sessionDone: 0, sessionTotal: 0,
  save() {}, refreshBadges() {}, renderProgress() {}, showFeedback() {},
  nextCard() {}, finishSession() {},
  $: () => ({ classList: { add() {}, remove() {} }, style: {}, focus() {} }),
  console,
};
vm.createContext(sandbox);
vm.runInContext(FNS.map(extractFn).join("\n"), sandbox);

let FAKE_TODAY = "2026-08-22";
sandbox.today = () => FAKE_TODAY;

let pass = 0, fail = 0; const fails = [];
const check = (name, cond) => { if (cond) pass++; else { fail++; fails.push(name); } };

/* Build a synthetic deck of n words, all in the one active theme. */
function makeDeck(n) {
  const deck = [];
  for (let i = 1; i <= n; i++) deck.push({ id: i, ru: "w" + i, en: "w" + i, pos: "noun", theme: "core", tier: 1, ex: "" });
  sandbox.DECK = deck;
  sandbox.DECK_BY_ID = Object.fromEntries(deck.map(w => [w.id, w]));
  return deck;
}
/* State where cards [1..introduced] are introduced; `dueSpec(i)` returns each card's due date. */
function stateWith(introduced, dueSpec, box = 3) {
  const S = sandbox.blank();
  S.activeThemes = ["core"];
  for (let i = 1; i <= introduced; i++) {
    S.cards[i] = { box, due: dueSpec(i), lapses: 0, reps: 5, introduced: true };
  }
  return S;
}
/* Drive a real drill session to completion: answer every queued card correctly. */
function drillAll(alwaysCorrect = true) {
  let guard = 0;
  while (sandbox.queue.length && guard++ < 5000) {
    sandbox.cur = sandbox.queue[0];
    sandbox.resolve(alwaysCorrect);
  }
  return guard;
}

/* ===== 1. The daily review cap terminates within a day ===== */
(function capTerminates() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(400);
  sandbox.S = stateWith(300, i => "2026-08-0" + (1 + (i % 9)));   // 300 cards, all long overdue
  const before = sandbox.owedToday();
  check("cap: starts by owing a full day of reviews", before.rev === REVIEW_PER_DAY);

  sandbox.queue = sandbox.buildQueue();
  const firstBatch = sandbox.queue.length;
  drillAll();
  const log = sandbox.S.dailyLog[FAKE_TODAY];
  check("cap: exactly REVIEW_PER_DAY reviews logged", log.reviewDone === REVIEW_PER_DAY);
  check("cap: owed reviews drop to 0 after one session", sandbox.owedToday().rev === 0);
  check("cap: a second buildQueue the same day serves nothing", sandbox.buildQueue().length === 0);
  check("cap: new words were paused (pile >> threshold)", firstBatch === REVIEW_PER_DAY);
})();

/* ===== 2. A missed NEW word must not eat a review slot ===== */
(function missedNewWord() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(50);
  sandbox.S = stateWith(0, () => FAKE_TODAY);       // nothing introduced yet
  sandbox.queue = [{ id: 1, isNew: true, firstTry: true }];
  sandbox.cur = sandbox.queue[0];
  sandbox.resolve(false);                            // miss it -> introduced, requeued
  sandbox.cur = sandbox.queue[0];
  sandbox.resolve(true);                             // now get it right
  const log = sandbox.S.dailyLog[FAKE_TODAY];
  check("missed new: counted as one new word", log.newDone === 1);
  check("missed new: did NOT consume a review slot", (log.reviewDone || 0) === 0);
})();

(function missedReviewLogsOnce() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(50);
  sandbox.S = stateWith(5, () => "2026-08-20");
  sandbox.queue = [{ id: 1, isNew: false, firstTry: true }];
  sandbox.cur = sandbox.queue[0]; sandbox.resolve(false);   // miss
  sandbox.cur = sandbox.queue[0]; sandbox.resolve(false);   // miss again
  sandbox.cur = sandbox.queue[0]; sandbox.resolve(true);    // finally right
  const log = sandbox.S.dailyLog[FAKE_TODAY];
  check("missed review: logs exactly one review", log.reviewDone === 1);
  check("missed review: logs no new word", (log.newDone || 0) === 0);
})();

/* ===== 3. Due queue is most-overdue-first, not word-id-first ===== */
(function orderingByUrgency() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(200);
  // low ids are barely due; high ids are ancient. Deck-order slicing would strand the ancient ones.
  sandbox.S = stateWith(100, i => (i <= 50 ? "2026-08-22" : "2026-07-01"));
  const served = sandbox.buildQueue().map(q => q.id);
  check("order: serves the most overdue first", served.every(id => id > 50));
  check("order: still capped at REVIEW_PER_DAY", served.length === REVIEW_PER_DAY);

  // weakest box breaks ties within the same due date
  sandbox.S = stateWith(40, () => "2026-08-01", 5);
  sandbox.S.cards[40].box = 0;
  check("order: weakest box first inside a day", sandbox.dueReviewIds()[0] === 40);
})();

/* ===== 4. spreadBacklog turns an unclearable pile into a clearable schedule ===== */
(function spread() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(400);
  const S = stateWith(255, i => "2026-08-" + String(1 + (i % 15)).padStart(2, "0"));
  const boxBefore = Object.fromEntries(Object.entries(S.cards).map(([k, c]) => [k, c.box]));
  const repsBefore = Object.fromEntries(Object.entries(S.cards).map(([k, c]) => [k, c.reps]));
  sandbox.S = S;
  sandbox.spreadBacklog(S);

  const dues = Object.values(S.cards).map(c => c.due);
  check("spread: nothing left overdue", dues.every(d => d >= FAKE_TODAY));
  check("spread: boxes untouched", Object.entries(S.cards).every(([k, c]) => c.box === boxBefore[k]));
  check("spread: reps untouched", Object.entries(S.cards).every(([k, c]) => c.reps === repsBefore[k]));

  const perDay = {};
  dues.forEach(d => { perDay[d] = (perDay[d] || 0) + 1; });
  const heaviest = Math.max(...Object.values(perDay));
  check("spread: no day exceeds the catch-up rate", heaviest <= Math.max(BACKLOG_CATCHUP_PER_DAY, Math.ceil(255 / BACKLOG_MAX_HORIZON)));
  check("spread: catch-up rate leaves room for cards coming due naturally", BACKLOG_CATCHUP_PER_DAY < REVIEW_PER_DAY);
  check("spread: leaves headroom under the daily cap", heaviest < REVIEW_PER_DAY);
  check("spread: horizon is bounded", dues.slice().sort().pop() <= sandbox.daysAdd(FAKE_TODAY, BACKLOG_MAX_HORIZON));
  check("spread: today's pile is now clearable in one session", sandbox.dueReviewCount() <= REVIEW_PER_DAY);

  // idempotent: running it again changes nothing
  const snapshot = JSON.stringify(S.cards);
  sandbox.spreadBacklog(S);
  check("spread: idempotent", JSON.stringify(S.cards) === snapshot);
})();

(function spreadLeavesSmallBacklogsAlone() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(100);
  const S = stateWith(REVIEW_PER_DAY, () => "2026-08-20");
  sandbox.S = S;
  const snapshot = JSON.stringify(S.cards);
  sandbox.spreadBacklog(S);
  check("spread: a normal day or two behind is left untouched", JSON.stringify(S.cards) === snapshot);
})();

/* ===== 5. New words pause while deep in review debt, and resume when clear ===== */
(function newWordPause() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(400);
  sandbox.S = stateWith(BACKLOG_PAUSE_NEW + 1, () => "2026-08-01");
  check("pause: no new words while over the threshold", sandbox.newAllowedToday() === 0);
  check("pause: owedToday reports the pause", sandbox.owedToday().newsPaused === true);
  check("pause: no new words enter the queue", sandbox.buildQueue().every(q => q.isNew === false));

  sandbox.S = stateWith(BACKLOG_PAUSE_NEW, () => "2026-08-01");
  check("pause: new words resume at the threshold", sandbox.newAllowedToday() === NEW_PER_DAY);
  const q = sandbox.buildQueue();
  check("pause: resumed queue is reviews + new", q.filter(x => x.isNew).length === NEW_PER_DAY);
})();

/* ===== 6. Extra practice serves the backlog, and respects the gate =====
   The deck holds ~2,000 words against a few hundred introduced, so "any unseen word left?"
   is true essentially forever. Extra practice must not let that starve overdue reviews, and
   must not quietly undo the new-word pause. */
(function extraPracticePrefersDue() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(2000);
  // today's plan already done; 30 cards still overdue; 1500+ unseen words available
  sandbox.S = stateWith(500, i => (i <= 30 ? "2026-08-01" : "2026-12-01"));
  sandbox.S.dailyLog[FAKE_TODAY] = { newDone: NEW_PER_DAY, reviewDone: REVIEW_PER_DAY };
  sandbox.startSession(true);
  const ids = sandbox.queue.map(q => q.id);
  check("extra: serves overdue reviews even with unseen words available",
        ids.slice(0, 30).every(id => id <= 30));
  check("extra: overdue cards are marked as reviews, not new",
        sandbox.queue.slice(0, 30).every(q => q.isNew === false));
  check("extra: bounded to one session", sandbox.queue.length <= REVIEW_PER_DAY + NEW_PER_DAY);
})();

(function extraPracticeSkipsTodaysPlan() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(2000);
  sandbox.S = stateWith(500, () => "2026-08-01");   // 500 overdue, nothing done yet
  sandbox.startSession(true);
  const planned = sandbox.dueReviewIds().slice(0, REVIEW_PER_DAY);
  check("extra: does not re-serve the cards today's own plan covers",
        sandbox.queue.every(q => planned.indexOf(q.id) < 0));
})();

(function extraPracticeRespectsPause() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(2000);
  sandbox.S = stateWith(BACKLOG_PAUSE_NEW + 1, () => "2026-08-01");
  check("extra: precondition — gate is closed", sandbox.owedToday().newsPaused === true);
  sandbox.startSession(true);
  check("extra: introduces no new words while the gate is closed",
        sandbox.queue.every(q => q.isNew === false));
})();

(function extraPracticeGivesNewWordsWhenClear() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(2000);
  sandbox.S = stateWith(100, () => "2026-12-01");   // nothing due, gate open
  sandbox.startSession(true);
  check("extra: offers new words once you're caught up",
        sandbox.queue.filter(q => q.isNew).length === NEW_PER_DAY);
  check("extra: and nothing but new words when nothing is due",
        sandbox.queue.every(q => q.isNew === true));
})();

(function extraPracticeFallsBackToEarlyReview() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(200);
  // whole deck introduced, nothing due, so there are no new words to give
  sandbox.S = stateWith(200, i => "2026-09-" + String(1 + (i % 28)).padStart(2, "0"));
  sandbox.startSession(true);
  check("extra: falls back to reviewing the nearest cards early",
        sandbox.queue.length === REVIEW_PER_DAY && sandbox.queue.every(q => q.isNew === false));
  const dues = sandbox.queue.map(q => sandbox.S.cards[q.id].due);
  check("extra: early review takes the soonest-due first",
        dues.every((d, i) => i === 0 || d >= dues[i - 1]));
})();

/* ===== 6b. Load balancing: cohorts must not come back as one lump ===== */
(function loadBalancing() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(400);
  const INTERVALS = INTERVALS_SRC;

  // 100 cards all answered together at box 3 would all land on the same day unbalanced.
  sandbox.S = stateWith(100, () => "2026-08-22", 2);
  for (let i = 1; i <= 100; i++) {
    const c = sandbox.S.cards[i];
    c.box = 3;
    c.due = sandbox.balancedDue(3);
  }
  const spread = new Set(Object.values(sandbox.S.cards).map(c => c.due));
  check("balance: a cohort is spread over several days, not one", spread.size > 1);

  const heaviest = Math.max(...[...spread].map(d => Object.values(sandbox.S.cards).filter(c => c.due === d).length));
  check("balance: no single day takes the whole cohort", heaviest < 100);

  // the nudge must stay small and never schedule into the past or today
  const iv = INTERVALS[3];
  const slack = Math.min(3, Math.max(1, Math.round(iv * 0.15)));
  const lo = sandbox.daysAdd(FAKE_TODAY, Math.max(1, iv - slack));
  const hi = sandbox.daysAdd(FAKE_TODAY, iv + slack);
  check("balance: stays within the allowed slack", [...spread].every(d => d >= lo && d <= hi));
  check("balance: never schedules earlier than tomorrow", [...spread].every(d => d > FAKE_TODAY));

  // short intervals are left exactly alone — moving a 1-day card changes the drill
  sandbox.S = stateWith(10, () => "2026-08-22", 0);
  check("balance: 1-day interval is not nudged", sandbox.balancedDue(1) === sandbox.daysAdd(FAKE_TODAY, 1));
})();

/* ===== 6d. One-time smoothing of an already-stacked schedule ===== */
(function rebalance() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(600);
  // 120 cards all parked on one future day, plus a normal tail
  const S = stateWith(300, i => (i <= 120 ? "2026-08-30" : "2026-09-" + String(1 + (i % 28)).padStart(2, "0")), 4);
  sandbox.S = S;
  const dueBefore = Object.fromEntries(Object.entries(S.cards).map(([k, c]) => [k, c.due]));
  const loadBefore = {};
  Object.values(S.cards).forEach(c => { loadBefore[c.due] = (loadBefore[c.due] || 0) + 1; });

  sandbox.rebalanceSchedule(S);

  const loadAfter = {};
  Object.values(S.cards).forEach(c => { loadAfter[c.due] = (loadAfter[c.due] || 0) + 1; });
  check("rebalance: the stacked day gets lighter",
        Math.max(...Object.values(loadAfter)) < Math.max(...Object.values(loadBefore)));
  check("rebalance: nothing is pulled into today or the past",
        Object.values(S.cards).every(c => c.due > FAKE_TODAY));
  check("rebalance: no card is moved further than its own slack",
        Object.entries(S.cards).every(([k, c]) => {
          const iv = INTERVALS_SRC[Math.min(c.box, INTERVALS_SRC.length - 1)] || 1;
          const slack = Math.min(3, Math.max(1, Math.round(iv * 0.15)));
          const lo = sandbox.daysAdd(dueBefore[k], -slack), hi = sandbox.daysAdd(dueBefore[k], slack);
          return c.due >= lo && c.due <= hi;
        }));
  check("rebalance: no card is lost or duplicated",
        Object.keys(S.cards).length === Object.keys(dueBefore).length);

  // days already under the cap are left exactly alone
  makeDeck(200);
  const calm = stateWith(60, i => "2026-09-" + String(1 + (i % 20)).padStart(2, "0"), 4);
  sandbox.S = calm;
  const snapshot = JSON.stringify(calm.cards);
  sandbox.rebalanceSchedule(calm);
  check("rebalance: an already-level schedule is untouched", JSON.stringify(calm.cards) === snapshot);

  // running it twice must not undo or worsen the first pass
  sandbox.S = S;
  const once = JSON.stringify(S.cards);
  sandbox.rebalanceSchedule(S);
  const twiceLoad = {};
  Object.values(S.cards).forEach(c => { twiceLoad[c.due] = (twiceLoad[c.due] || 0) + 1; });
  check("rebalance: a second pass does not make things worse",
        Math.max(...Object.values(twiceLoad)) <= Math.max(...Object.values(loadAfter)));
})();

/* ===== 6c. Extra practice must not feed an already-overloaded tomorrow ===== */
(function extraPracticeChecksTomorrow() {
  FAKE_TODAY = "2026-08-22";
  makeDeck(2000);
  // nothing due today, but tomorrow is already far past the cap
  sandbox.S = stateWith(500, i => (i <= REVIEW_PER_DAY * 3 ? "2026-08-23" : "2026-12-01"));
  check("tomorrow: precondition — nothing due today", sandbox.dueReviewCount() === 0);
  check("tomorrow: precondition — gate is open", sandbox.owedToday().newsPaused === false);
  sandbox.startSession(true);
  check("tomorrow: no new words when tomorrow is already over the cap",
        sandbox.queue.every(q => q.isNew === false));

  // ...but a genuinely clear tomorrow still gets new words
  sandbox.S = stateWith(500, () => "2026-12-01");
  sandbox.startSession(true);
  check("tomorrow: new words still flow when tomorrow is clear",
        sandbox.queue.filter(q => q.isNew).length === NEW_PER_DAY);
})();

/* ===== 7. The two caps must balance =====
   Every new word costs (INTERVALS.length - 2) reviews to reach the top box, so N new words
   per day generates that many times N reviews per day forever. If REVIEW_PER_DAY is below
   that, the backlog is not a bug to fix once — it regrows by construction. This test is the
   guard rail: change NEW_PER_DAY and it fails until REVIEW_PER_DAY follows. */
(function capsBalance() {
  const INTERVALS = INTERVALS_SRC;
  const reviewsPerWord = INTERVALS.length - 2;
  const generated = reviewsPerWord * NEW_PER_DAY;
  check(`caps: REVIEW_PER_DAY (${REVIEW_PER_DAY}) covers the ${generated}/day that ${NEW_PER_DAY} new words generate`,
        REVIEW_PER_DAY >= generated);
  check("caps: top interval is long enough for cheap maintenance", INTERVALS[INTERVALS.length - 1] >= 180);
})();

/* ===== 8. End-to-end: a 255-card backlog is actually clearable ===== */
(function endToEnd() {
  makeDeck(400);
  FAKE_TODAY = "2026-08-22";
  const S = stateWith(255, i => "2026-08-" + String(1 + (i % 15)).padStart(2, "0"), 2);
  sandbox.S = S;
  sandbox.spreadBacklog(S);

  let day = FAKE_TODAY, cleared = 0, sawOverCap = false, peakPile = 0;
  const piles = [];
  for (let n = 0; n < 120; n++) {
    FAKE_TODAY = day;
    if (sandbox.owedToday().rev > REVIEW_PER_DAY) sawOverCap = true;
    const pile = sandbox.dueReviewCount();
    piles.push(pile);
    peakPile = Math.max(peakPile, pile);
    sandbox.queue = sandbox.buildQueue();
    drillAll();                                  // perfect student: everything correct
    cleared += (sandbox.S.dailyLog[day] || {}).reviewDone || 0;
    day = sandbox.daysAdd(day, 1);
  }
  FAKE_TODAY = day;
  const settled = piles.slice(-30).reduce((a, b) => a + b, 0) / 30;
  check("e2e: never asks for more than a day's cap", !sawOverCap);
  /* Digging out of 255 cards is a transient: the pile bulges while old cohorts come back
     together, then settles. What must hold is that it stays bounded and converges on roughly
     one session's worth — not that it never exceeds the cap on any single day. */
  check("e2e: the pile stays bounded during catch-up", peakPile <= REVIEW_PER_DAY * 4);
  check("e2e: the pile settles to about one session", settled <= REVIEW_PER_DAY * 1.25);
  check("e2e: backlog is cleared, not just deferred", sandbox.dueReviewCount() <= REVIEW_PER_DAY);
  check("e2e: work actually happened", cleared > 250);
  check("e2e: cards actually matured", Object.values(sandbox.S.cards).filter(c => c.box >= 6).length > 100);
})();

console.log(`Backlog invariants: ${pass}/${pass + fail} passing`);
if (fail) { console.log("FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
console.log("All green.");
