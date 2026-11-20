/* Talk (spoken conversation practice) invariants for russian-trainer.html.
 *
 * Covers the pure pieces the conversation depends on: reading the partner's labelled reply,
 * knowing when the spoken line is finished, cutting finished sentences off a growing stream
 * so speech can start early, the fading-help rule, and the kept-sentence record that travels
 * through sync. Like the other suites, the real function bodies are extracted from the
 * shipped HTML and run in a Node vm.
 *
 * Run: node tests/talk-invariants.mjs
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
const FNS = ["laterDate", "talkParse", "talkSayComplete", "talkSpeakable", "talkSplitSentences",
             "talkNextHelp", "talkKeepKey", "talkDedupe", "talkMergeTopic"];
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(FNS.map(extractFn).join("\n"), sandbox);
const X = sandbox;

let pass = 0, fail = 0; const fails = [];
function check(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }

/* ---- 1. Reading a reply ---- */
const REPLY = [
  "SAY: Отли́чно! С кем ты гуля́ешь ве́чером?",
  "EN: Great! Who do you walk with in the evening?",
  "FIX: Я гуля́ю с соба́кой. || с takes the Instrumental: соба́ка → соба́кой.",
  "EASY: С Са́шей или с Ро́кки?",
  "WORDS: гуля́ть = to walk ; ве́чером = in the evening ; с = with",
  "START: Я гуля́ю с…",
  "ANSWER: Я гуля́ю с Са́шей и с Ро́кки.",
  "ANSWER_EN: I walk with Sasha and Rocky.",
  "END: no",
].join("\n");
(function parseFull() {
  const p = X.talkParse(REPLY);
  check("parse: SAY", p.SAY === "Отли́чно! С кем ты гуля́ешь ве́чером?");
  check("parse: EN", p.EN === "Great! Who do you walk with in the evening?");
  check("parse: FIX splits into the sentence and the reason", p.FIX_RU === "Я гуля́ю с соба́кой." && /Instrumental/.test(p.FIX_NOTE));
  check("parse: EASY", p.EASY === "С Са́шей или с Ро́кки?");
  check("parse: word bank becomes pairs", p.WORDS_LIST.length === 3 && p.WORDS_LIST[1].ru === "ве́чером" && p.WORDS_LIST[1].en === "in the evening");
  check("parse: ANSWER and ANSWER_EN are kept apart", p.ANSWER === "Я гуля́ю с Са́шей и с Ро́кки." && p.ANSWER_EN === "I walk with Sasha and Rocky.");
  check("parse: END no → not the end", p.isEnd === false);
  check("parse: END yes → the end", X.talkParse(REPLY.replace("END: no", "END: yes")).isEnd === true);
})();
(function parseEdges() {
  check("parse: FIX none means no correction", !X.talkParse("SAY: Привет\nFIX: none\nEND: no").FIX);
  check("parse: FIX none. (with a full stop) means no correction", !X.talkParse("SAY: Привет\nFIX: None.\nEND: no").FIX_RU);
  check("parse: FIX with no reason still corrects", X.talkParse("SAY: x\nFIX: Я живу́ с Са́шей.").FIX_RU === "Я живу́ с Са́шей.");
  check("parse: a reply that ignores the format is still spoken", X.talkParse("Приве́т! Как дела́?").SAY === "Приве́т! Как дела́?");
  check("parse: a field running onto a second line is joined", X.talkParse("SAY: Приве́т!\nКак дела́?\nEN: Hi").SAY === "Приве́т! Как дела́?");
  check("parse: markdown bold labels are tolerated", X.talkParse("**SAY:** Приве́т!\n**EN:** Hi").SAY === "Приве́т!");
  check("parse: missing word bank is an empty list", X.talkParse("SAY: x").WORDS_LIST.length === 0);
})();

/* ---- 2. Knowing when the spoken line is done ---- */
check("stream: SAY alone is not finished", X.talkSayComplete("SAY: Приве́т! Как") === false);
check("stream: SAY followed by EN is finished", X.talkSayComplete("SAY: Приве́т!\nEN: Hi") === true);
check("stream: SAY followed by FIX (no EN) is finished", X.talkSayComplete("SAY: Приве́т!\nFIX: none") === true);
check("stream: the word EN inside SAY doesn't count", X.talkSayComplete("SAY: EN: что это") === false);

/* ---- 3. Cutting finished sentences off the stream ---- */
(function split() {
  let [s, rest] = X.talkSplitSentences("Приве́т! Как дела́? Я");
  check("split: two finished sentences", s.length === 2 && s[0] === "Приве́т!" && s[1] === "Как дела́?");
  check("split: the unfinished rest is held back", rest === "Я");
  [s, rest] = X.talkSplitSentences("Приве́т!");
  check("split: a sentence with nothing after it waits (more may still come)", s.length === 0 && rest === "Приве́т!");
  [s] = X.talkSplitSentences("Ну… хорошо́. Да");
  check("split: an ellipsis ends a sentence", s.length === 2);
  // Simulate the stream: speak pieces as they arrive and check nothing is lost or doubled.
  const say = "Отли́чно! С кем ты гуля́ешь ве́чером? А у́тром?";
  let spoken = 0; const out = [];
  for (let n = 1; n <= say.length; n++) {
    const [ss, r] = X.talkSplitSentences(say.slice(0, n).slice(spoken));
    if (ss.length) { out.push(...ss); spoken = n - r.length; }
  }
  const last = say.slice(spoken); if (last.trim()) out.push(last.trim());
  check("split: streamed in letter by letter, every word is spoken exactly once", out.join(" ") === say);
})();

/* ---- 4. What gets spoken ---- */
check("speech: stress marks are removed", X.talkSpeakable("ма́мой") === "мамой");
check("speech: й survives", X.talkSpeakable("мой") === "мой" && X.talkSpeakable("мой".normalize("NFD")).normalize("NFC") === "мой");

/* ---- 5. Help fades by rule ---- */
check("help: no help used → one step less", X.talkNextHelp(2, 0, 8) === 1);
check("help: a quarter of answers helped → one step less", X.talkNextHelp(2, 2, 8) === 1);
check("help: already at Little stays at Little", X.talkNextHelp(0, 0, 8) === 0);
check("help: in between → unchanged", X.talkNextHelp(1, 3, 8) === 1 && X.talkNextHelp(1, 4, 8) === 1);
check("help: more than half helped → one step more", X.talkNextHelp(1, 5, 8) === 2);
check("help: at Lots stays at Lots", X.talkNextHelp(2, 8, 8) === 2);
check("help: no answers → unchanged", X.talkNextHelp(1, 0, 0) === 1);
check("help: a brand-new topic starts at Lots", X.talkNextHelp(undefined, 0, 0) === 2);

/* ---- 6. Sentences to keep ---- */
(function keep() {
  const d = X.talkDedupe([{ ru: "Я пью ко́фе с молоко́м." }, { ru: "я пью кофе с молоком" }, { ru: "" }, null, { ru: "Я живу́ с Са́шей.", en: "I live with Sasha." }]);
  check("keep: duplicates ignore stress, case and punctuation", d.length === 2);
  check("keep: the first (newest) copy wins", d[0].ru === "Я пью ко́фе с молоко́м.");
  check("keep: English is carried", d[1].en === "I live with Sasha.");
  const many = Array.from({ length: 30 }, (_, i) => ({ ru: "Предложе́ние " + "а".repeat(i + 1) }));
  check("keep: at most 20", X.talkDedupe(many).length === 20);
  check("keep: ё and е are the same sentence", X.talkDedupe([{ ru: "Всё хорошо́" }, { ru: "Все хорошо" }]).length === 1);
})();

/* ---- 7. One topic's record across two devices ---- */
(function merge() {
  const phone = { n: 4, last: "2026-11-20", help: 0, keep: [{ ru: "Я гуля́ю с Ро́кки." }] };
  const mac = { n: 6, last: "2026-11-10", help: 2, keep: [{ ru: "Я пишу́ ру́чкой." }, { ru: "я гуляю с рокки" }] };
  const m = X.talkMergeTopic(phone, mac);
  check("merge: count is the max", m.n === 6);
  check("merge: help follows the most recent talk", m.help === 0);
  check("merge: latest date", m.last === "2026-11-20");
  check("merge: kept sentences unioned, newest side first", m.keep.length === 2 && m.keep[0].ru === "Я гуля́ю с Ро́кки.");
  check("merge: symmetric", JSON.stringify(X.talkMergeTopic(mac, phone)) === JSON.stringify(m));
  check("merge: idempotent", JSON.stringify(X.talkMergeTopic(m, m)) === JSON.stringify(m));
  const e = X.talkMergeTopic(undefined, undefined);
  check("merge: nothing on either side → empty record at Lots, no invented date", e.n === 0 && e.help === 2 && e.keep.length === 0 && !("last" in e));
  check("merge: help 0 is kept, not mistaken for missing", X.talkMergeTopic({ help: 0, last: "2026-11-20" }, {}).help === 0);
})();

/* ---- 8. The key never travels with progress ---- */
const blankSrc = extractFn("blank");
check("key: the saved state has no place for the API key", !/[{,]\s*(api)?(key|token)\s*:/i.test(blankSrc));
check("key: Talk settings live under their own storage name", /const TALKKEY="rt_talk_v1"/.test(src));
check("key: progress storage name is not the Talk one", !/const KEY="rt_talk/.test(src));

console.log("");
console.log(`Talk invariants: ${pass}/${pass + fail} passing`);
if (fail) { console.log("FAILED:"); for (const n of fails) console.log("  ✗ " + n); process.exit(1); }
console.log("All green.");
