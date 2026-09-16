/* Backup / local-persistence invariants for russian-trainer.html.
 *
 * These cover the ways a study day can exist in only one place and then stop existing:
 * a blank state written over a populated save, an unreadable save written over rather
 * than kept, and a device that silently never pushes. Like the other suites, the real
 * function bodies are extracted from the shipped HTML and run in a Node vm — nothing
 * here is a copy that can drift.
 *
 * Run: node tests/sync-invariants.mjs
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

const FNS = [
  "today", "daysAdd", "hasStudy", "blank", "stateLooksEmpty",
  "studyDays", "lastStudyDay", "streakEndingAt", "healStreak",
  "saveGuard", "load", "save", "backupAge", "backupStatus",
];

// String constants read straight from the app so they can never drift.
const KEY = /\bconst KEY="([^"]+)"/.exec(src)[1];
const CORRUPT_PREFIX = /\bconst CORRUPT_PREFIX="([^"]+)"/.exec(src)[1];

let dirtyCalls = 0, lineRefreshes = 0;
function makeLS(opts = {}) {
  const m = new Map();
  return {
    _m: m,
    getItem(k) { if (opts.throwOnGet) throw new Error("denied"); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (opts.throwOnSet) throw new Error("quota exceeded"); m.set(k, String(v)); },
    keys() { return [...m.keys()]; },
  };
}

const sandbox = {
  S: null,
  KEY, CORRUPT_PREFIX,
  LOCAL_FAULT: null,
  A1_THEME_KEYS: [],
  MIG_VERSION: Number(/\bMIG_VERSION\s*=\s*(\d+)/.exec(src)[1]),
  migrate: (s) => s,                  // migrations are covered by their own suite
  markDirty() { dirtyCalls++; },
  refreshBackupLine() { lineRefreshes++; },
  localStorage: makeLS(),
  console,
};
vm.createContext(sandbox);
vm.runInContext(FNS.map(extractFn).join("\n"), sandbox);

let FAKE_TODAY = "2026-09-16";
sandbox.today = () => FAKE_TODAY;

/* ---- tiny test harness ---- */
let pass = 0, fail = 0;
const fails = [];
function check(name, cond) {
  if (cond) { pass++; } else { fail++; fails.push(name); }
}
function populated(over = {}) {
  return Object.assign(sandbox.blank(), {
    streak: 29,
    lastCompleted: "2026-09-13",
    dailyLog: { "2026-09-12": { newDone: 0, reviewDone: 40, studied: true },
                "2026-09-13": { newDone: 0, reviewDone: 40, studied: true } },
    cards: { 1: { box: 5, due: "2026-09-20", lapses: 0, reps: 9, introduced: true, lastReviewed: "2026-09-13" } },
  }, over);
}
function reset(lsOpts) {
  sandbox.localStorage = makeLS(lsOpts);
  sandbox.LOCAL_FAULT = null;
  dirtyCalls = 0; lineRefreshes = 0;
}

/* ===== 1. saveGuard, on its own ===== */
(function guardPure() {
  const empty = sandbox.blank(), full = populated();
  check("guard: writing over nothing is allowed", sandbox.saveGuard(empty, null).ok === true);
  check("guard: populated over populated is allowed", sandbox.saveGuard(full, JSON.stringify(full)).ok === true);
  check("guard: populated over blank is allowed", sandbox.saveGuard(full, JSON.stringify(empty)).ok === true);
  check("guard: blank over blank is allowed", sandbox.saveGuard(empty, JSON.stringify(empty)).ok === true);
  const refused = sandbox.saveGuard(empty, JSON.stringify(full));
  check("guard: BLANK OVER POPULATED IS REFUSED", refused.ok === false);
  check("guard: the refusal carries a reason", typeof refused.reason === "string" && refused.reason.length > 10);
  const corrupt = sandbox.saveGuard(empty, "{not json");
  check("guard: an unreadable stored save does not block the write", corrupt.ok === true);
  check("guard: ...but it is flagged for preservation", corrupt.preserve === true);
})();

/* ===== 2. save(): the wipe cannot happen ===== */
(function blankNeverOverwrites() {
  reset();
  const full = populated();
  sandbox.S = full;
  check("save: a populated state writes", sandbox.save() === true);
  const stored = sandbox.localStorage.getItem(KEY);
  check("save: it really landed", JSON.parse(stored).streak === 29);

  // Now the failure that ate 09-14: the app comes back blank and writes.
  sandbox.S = sandbox.blank();
  const ok = sandbox.save();
  check("save: the blank write is refused", ok === false);
  check("save: the populated save is still there", sandbox.localStorage.getItem(KEY) === stored);
  check("save: the refusal is recorded, not swallowed", typeof sandbox.LOCAL_FAULT === "string" && sandbox.LOCAL_FAULT.length > 10);
})();

(function dirtyMarking() {
  reset();
  sandbox.S = populated();
  sandbox.save();
  check("save: a successful write marks the state dirty", dirtyCalls === 1);
  dirtyCalls = 0;
  sandbox.save(true);
  check("save: quiet=true does not re-arm the scheduler", dirtyCalls === 0);
  dirtyCalls = 0;
  sandbox.S = sandbox.blank();
  sandbox.save();
  check("save: a refused write never marks dirty", dirtyCalls === 0);
})();

(function writeFailureIsVisible() {
  reset({ throwOnSet: true });
  sandbox.S = populated();
  check("save: a storage that refuses writes returns false", sandbox.save() === false);
  check("save: and says so", /refused to save/.test(sandbox.LOCAL_FAULT || ""));
})();

/* ===== 3. load(): an unreadable save is kept, not written over ===== */
(function freshInstall() {
  reset();
  const s = sandbox.load();
  check("load: nothing stored gives a blank state", sandbox.stateLooksEmpty(s) === true);
  check("load: and that is not treated as a fault", sandbox.LOCAL_FAULT === null);
})();

(function roundTrip() {
  reset();
  sandbox.S = populated();
  sandbox.save();
  const s = sandbox.load();
  check("load: a good save comes back", s.cards["1"] && s.cards["1"].reps === 9);
  check("load: and the day log survives", !!s.dailyLog["2026-09-13"]);
})();

(function corruptSaveIsPreserved() {
  reset();
  const bytes = '{"cards":{"1":{"reps":9,"box":5 TRUNCATED';
  sandbox.localStorage.setItem(KEY, bytes);
  const s = sandbox.load();
  check("load: an unreadable save yields a blank state", sandbox.stateLooksEmpty(s) === true);
  check("load: the failure is reported", /could not be read/.test(sandbox.LOCAL_FAULT || ""));
  const kept = sandbox.localStorage.keys().filter(k => k.startsWith(CORRUPT_PREFIX));
  check("load: THE ORIGINAL BYTES ARE KEPT", kept.length === 1);
  check("load: kept verbatim", sandbox.localStorage.getItem(kept[0]) === bytes);

  // And the blank that follows must not destroy the copy.
  sandbox.S = s;
  sandbox.save();
  check("load: the kept copy survives the next save", sandbox.localStorage.getItem(kept[0]) === bytes);
})();

(function unreadableStorage() {
  reset({ throwOnGet: true });
  const s = sandbox.load();
  check("load: storage that refuses reads gives a blank state", sandbox.stateLooksEmpty(s) === true);
  check("load: and is reported as a fault", /will not let the app read/.test(sandbox.LOCAL_FAULT || ""));
})();

/* ===== 4. backupAge ===== */
(function ages() {
  const t = Date.parse("2026-09-16T12:00:00.000Z");
  const ago = (ms) => sandbox.backupAge(new Date(t - ms).toISOString(), t);
  check("age: never backed up is null", sandbox.backupAge(null, t) === null);
  check("age: under a minute", ago(30 * 1000) === "just now");
  check("age: one minute", ago(60 * 1000) === "1 min ago");
  check("age: 59 minutes", ago(59 * 60 * 1000) === "59 min ago");
  check("age: one hour", ago(60 * 60 * 1000) === "1 hour ago");
  check("age: 23 hours", ago(23 * 60 * 60 * 1000) === "23 hours ago");
  check("age: one day", ago(24 * 60 * 60 * 1000) === "1 day ago");
  check("age: two days (the 09-14 gap)", ago(48 * 60 * 60 * 1000) === "2 days ago");
  check("age: garbage in gives null, not NaN", sandbox.backupAge("not-a-date", t) === null);
})();

/* ===== 5. backupStatus: silence is never an option ===== */
(function statuses() {
  const now = Date.parse("2026-09-16T12:00:00.000Z");
  const recent = new Date(now - 120000).toISOString();
  const base = { localFault: null, configured: true, lastOk: recent, lastErr: null, dirty: false, now };

  const ok = sandbox.backupStatus(base);
  check("status: a healthy device reads ok", ok.level === "ok" && /Backed up/.test(ok.text));

  const unconf = sandbox.backupStatus(Object.assign({}, base, { configured: false, lastOk: null }));
  check("status: SYNC NOT SET UP HERE IS A WARNING", unconf.level === "warn" && /Not backed up on this device/.test(unconf.text));
  check("status: and says where to fix it", /Settings/.test(unconf.text));

  const never = sandbox.backupStatus(Object.assign({}, base, { lastOk: null }));
  check("status: configured but never pushed is a warning", never.level === "warn" && /Never backed up/.test(never.text));

  const failing = sandbox.backupStatus(Object.assign({}, base, { lastErr: { at: new Date(now - 7200000).toISOString(), msg: "401 Bad credentials" } }));
  check("status: a failing push is bad, not quiet", failing.level === "bad");
  check("status: and surfaces the real error", /401 Bad credentials/.test(failing.text));

  const dirty = sandbox.backupStatus(Object.assign({}, base, { dirty: true }));
  check("status: unpushed work is a warning even when the last push was fine", dirty.level === "warn");

  const faulted = sandbox.backupStatus(Object.assign({}, base, { localFault: "the save on this device could not be read" }));
  check("status: a local fault outranks everything", faulted.level === "bad" && /could not be read/.test(faulted.text));
})();

/* ---- report ---- */
console.log("");
console.log(`Sync invariants: ${pass}/${pass + fail} passing`);
if (fail) {
  console.log("FAILED:");
  for (const n of fails) console.log("  ✗ " + n);
  process.exit(1);
}
console.log("All green.");
