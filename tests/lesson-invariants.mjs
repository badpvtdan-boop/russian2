/* Lesson-structure invariant tests for russian-trainer.html.
 *
 * A lesson may be taught two ways: the original single screen (`explanation` +
 * `practice` + `test`), or as `steps` — a sequence of one-idea chunks, each with
 * its own practice, followed by a `recap` and then the same graded test. Both
 * shapes have to stay well-formed, and a stepped lesson has extra requirements
 * the runner depends on (every step needs teaching text; every practice item
 * needs a `why`, since the whole point of stepping is feedback at each idea).
 *
 * Like the other suites here, this reads the REAL array out of the HTML rather
 * than a copy, so it can't drift from what ships.
 *
 * Run: node tests/lesson-invariants.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "russian-trainer.html"), "utf8");

/* Bracket-match a top-level `const NAME=[...]` array literal out of the source.
   Skips over strings, template literals and comments so a `]` inside prose
   (or inside a Russian example) can't end the match early. */
function extractArray(name) {
  const m = new RegExp("const\\s+" + name + "\\s*=\\s*\\[").exec(src);
  if (!m) throw new Error("array not found: " + name);
  let i = m.index + m[0].length - 1, depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i], prev = src[i - 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      for (i++; i < src.length; i++) {
        if (src[i] === "\\") { i++; continue; }
        if (src[i] === quote) break;
      }
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (ch === "/" && src[i + 1] === "/" && prev !== ":") { i = src.indexOf("\n", i); continue; }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(m.index + m[0].length - 1, i);
}

const LESSONS = vm.runInNewContext("(" + extractArray("LESSONS") + ")");
const PASS = Number(/const\s+PASS\s*=\s*([\d.]+)/.exec(src)[1]);

let pass = 0;
const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };

ok(LESSONS.length > 0, "LESSONS extracted from the HTML");
ok(PASS > 0 && PASS <= 1, "PASS threshold parsed");

/* Shared checks for any multiple-choice item. */
function checkQ(where, q, needWhy) {
  ok(typeof q.q === "string" && q.q.length > 0, where + ": has question text");
  ok(Array.isArray(q.opts) && q.opts.length >= 2, where + ": has at least two options");
  ok(Number.isInteger(q.a) && q.a >= 0 && q.a < (q.opts || []).length, where + ": answer index in range");
  ok(new Set(q.opts || []).size === (q.opts || []).length, where + ": options are unique");
  ok((q.opts || []).every(o => typeof o === "string" && o.trim().length > 0), where + ": no blank options");
  if (needWhy) ok(typeof q.why === "string" && q.why.length > 0, where + ": practice item explains itself");
}

const ids = new Set();
for (const L of LESSONS) {
  const w = "lesson " + L.id;
  ok(!!L.id && !ids.has(L.id), w + ": id is present and unique");
  ids.add(L.id);
  ok(!!L.title && !!L.level, w + ": has a title and CEFR level");

  /* The graded test is the gate, and it is identical in both shapes. */
  ok(Array.isArray(L.test) && L.test.length > 0, w + ": has a graded test");
  (L.test || []).forEach((q, i) => checkQ(w + " test q" + (i + 1), q, false));
  ok(Math.ceil(PASS * (L.test || []).length) <= (L.test || []).length,
     w + ": pass mark is reachable");

  if (L.steps) {
    /* --- stepped lesson --- */
    ok(L.steps.length >= 2, w + ": a stepped lesson has more than one step");
    ok(typeof L.recap === "string" && L.recap.length > 0,
       w + ": stepped lesson has a recap before the test");
    let practiceCount = 0;
    L.steps.forEach((s, i) => {
      const sw = w + " step " + (i + 1);
      ok(typeof s.title === "string" && s.title.length > 0, sw + ": has a title");
      ok(typeof s.html === "string" && s.html.trim().length > 30, sw + ": teaches something");
      ok(Array.isArray(s.practice) && s.practice.length > 0,
         sw + ": practises the idea it just taught");
      (s.practice || []).forEach((q, j) => checkQ(sw + " q" + (j + 1), q, true));
      practiceCount += (s.practice || []).length;
    });
    /* The reason this shape exists: more checkpoints than the single test. */
    ok(practiceCount >= L.test.length,
       w + ": at least as many practice checkpoints as graded questions");
  } else {
    /* --- classic single-screen lesson --- */
    ok(typeof L.explanation === "string" && L.explanation.length > 0,
       w + ": has an explanation");
    ok(Array.isArray(L.practice) && L.practice.length > 0, w + ": has a practice round");
    (L.practice || []).forEach((q, i) => checkQ(w + " practice q" + (i + 1), q, true));
  }
}

/* The runner branches on `steps`; a lesson must not half-declare the shape. */
for (const L of LESSONS) {
  ok(!(L.recap && !L.steps), "lesson " + L.id + ": no recap without steps");
}

/* ---- Reshaped lessons (2026-10-06): sentences to keep, common questions, and a test
   that explains every answer and tests the DECISION with whole sentences. ---- */
for (const L of LESSONS) {
  if (!L.sentences) continue;
  const w = "lesson " + L.id;
  ok(L.sentences.length >= 3 && L.sentences.length <= 7, w + ": hands over 3-7 sentences to keep");
  L.sentences.forEach((x, i) => {
    const sw = w + " sentence " + (i + 1);
    ok(typeof x.ru === "string" && x.ru.trim().length > 0, sw + ": has the Russian");
    ok(typeof x.en === "string" && x.en.trim().length > 0, sw + ": has the English");
    ok(typeof x.why === "string" && x.why.trim().length > 0, sw + ": says which rule it carries");
    const wr = x.wrong || [];
    ok(wr.length >= 2, sw + ": has near-misses for review");
    ok(new Set(wr.concat([x.ru])).size === wr.length + 1, sw + ": near-misses are distinct and never the answer");
  });
  (L.test || []).forEach((q, i) => ok(typeof q.why === "string" && q.why.length > 0,
    w + " test q" + (i + 1) + ": explains itself after the pick"));
  const whole = (L.test || []).filter(q => q.opts.every(o => o.trim().includes(" "))).length;
  ok(whole * 2 >= (L.test || []).length,
     w + ": at least half the test is whole-sentence choices (tests the decision, not the ending table)");
  ok(Array.isArray(L.faq) && L.faq.length > 0, w + ": answers the usual follow-up questions");
  (L.faq || []).forEach((f, i) => ok(!!f.q && !!f.a, w + " faq " + (i + 1) + ": has a question and an answer"));
}

/* Every lesson on the path exists, and every lesson exists on the path. */
const bandSrc = /const\s+BAND_LESSONS\s*=\s*(\{[\s\S]*?\});/.exec(src)[1];
const BAND_LESSONS = vm.runInNewContext("(" + bandSrc + ")");
const onPath = Object.values(BAND_LESSONS).flat();
const lessonIds = new Set(LESSONS.map(l => l.id));
onPath.forEach(id => ok(lessonIds.has(id), "path: lesson " + id + " exists"));
LESSONS.forEach(l => ok(onPath.includes(l.id), "path: lesson " + l.id + " is on the path"));

/* Grammar-review pools: each belongs to a real lesson, every item explains itself, and after
   the lessons' sentences are folded in (the app's own code, run here) every review id is unique. */
const GRAMMAR = vm.runInNewContext("(" + extractArray("GRAMMAR") + ")");
function extractFn(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("function not found: " + name);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } } }
  return src.slice(start, i);
}
const ctx = vm.createContext({ LESSONS, GRAMMAR });
vm.runInContext(extractFn("sentenceGrammarItems") + "\n" + extractFn("gItemId"), ctx);
const addSrc = /\(function addSentenceItems\(\)\{[\s\S]*?\}\)\(\);/.exec(src);
ok(!!addSrc, "grammar: sentence items are folded into review at load");
if (addSrc) vm.runInContext(addSrc[0], ctx);
const seen = new Set();
let dup = 0;
GRAMMAR.forEach(g => {
  ok(lessonIds.has(g.lesson), "grammar pool " + g.lesson + ": belongs to a real lesson");
  g.items.forEach((it, i) => {
    checkQ("grammar " + g.lesson + " #" + i, it, true);
    const id = ctx.gItemId(g, it, i);
    if (seen.has(id)) dup++; seen.add(id);
  });
});
ok(dup === 0, "grammar: every review id is unique (" + dup + " duplicates)");
LESSONS.filter(l => l.sentences).forEach(L => {
  const g = GRAMMAR.find(x => x.lesson === L.id);
  ok(!!g && g.items.filter(it => it.say).length === L.sentences.length,
     "grammar: lesson " + L.id + "'s sentences all come back in review");
});

console.log("\nLesson invariants: " + pass + "/" + (pass + fails.length) + " passing");
if (fails.length) {
  console.log("\nFAILED:");
  fails.forEach(f => console.log("  - " + f));
  process.exit(1);
}
const stepped = LESSONS.filter(l => l.steps);
console.log("All green. " + LESSONS.length + " lessons — " + stepped.length + " stepped ("
  + stepped.map(l => l.id + ":" + l.steps.length + " steps").join(", ") + ").");
