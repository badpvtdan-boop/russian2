# Russian Trainer — Backlog

Roadmap for the personal Russian tutor app (`russian-trainer.html`). Living document — update as things ship.

Legend: `[x]` done · `[~]` in progress · `[ ]` not started

---

## Shipped

- [x] **Phase 1 — Vocab drill.** Spaced repetition (Leitner/SM-2-lite), relentless requeue on misses, daily 10 new + 20 review, streak & debt tracking.
- [x] **Rich deck (470 words).** Original 160 (Core tier 1) plus 310 added: Core frequency tiers 2–3, an Emotions/psychology/relationships deck (80), and an Arts/culture/literature deck (80). Every word tagged with `theme` + `tier`.
- [x] **Deck picker + "I know this" skip.** Choose which themed decks feed daily new words (Drill tab); new words draw from active decks, easiest tier first. A per-word "✓ I know this" button banks a word straight to Known without drilling — lets an experienced learner burn past easy vocab.
- [x] **Answer modes.** Multiple choice (5 options) and typed input with on-screen Cyrillic keyboard. Lenient grading (ё/е, stress marks, small typos).
- [x] **Audio.** Browser TTS with a voice picker that prefers higher-quality voices.
- [x] **Phase 2 — GitHub sync.** Token-in-browser, auto-save on session finish + manual Save/Load. Token kept out of committed `progress.json`.
- [x] **Phase 3 — Lessons engine.** Explain → practice → scored test, 75% to pass, results synced.
- [x] **Phase 4 — Guided path.** "Next up" recommender + ordered curriculum with done/current markers. Milestones relabeled "words met" (honest vs. SRS "known").
- [x] **Data-driven path.** The Home "Your path" is now **generated** from the real data (`buildCurriculum()` reads EXAMS → BAND_LESSONS + BAND_WORDS + LESSONS) instead of a hand-maintained list — grouped by level (A1→A2→B1), each showing its word goal, its lessons, then its exam. Adding a lesson now places it automatically. Anything built but not wired to a level is **flagged on the path** (`PATH_WARNINGS`), so nothing silently drops off (which is how Instrumental briefly went missing). Retired the stale "Meet all 160 starter words" milestone.
- [x] **Look & feel.** Warm editorial light theme (first pass).
- [x] **CEFR labels + legend.** Lessons tagged by band (A1→B1) with color chips and a legend clarifying lesson difficulty vs. the word-count estimate.
- [x] **Level exams (per-CEFR mastery).** A1/A2/B1 exams (vocab + grammar), 85% to pass, unlock in order; the highest passed exam sets your official Level (source of truth), with readiness nudges on Home. New 🎓 Level tab.
- [x] **Shuffled answer options.** Lesson practice/test options now randomize each render (previously the correct answer was always first). Drill and exams shuffle too.
- [x] **Phase 5 — Grammar Review (spaced).** Completed lessons no longer end cold: each finished lesson feeds a **fresh** pool of ~12 review questions (distinct from the lesson's own practice/test items) into the same Leitner SRS as vocab, under a new `gcards` state map. A "🧠 Grammar review" section on the Drill tab shows what's due, capped at 15/day, mirrors vocab box logic (correct → advance box + interval; miss → box 0 + requeue in-session), and auto-seeds retroactively for already-completed lessons. Covers all topics, not just cases (aspect, verbs of motion included). Locked until you finish your first lesson; "review anyway" path when nothing's due.
- [x] **Phase 6 — Proficiency-driven path overhaul.** The Home path was rebuilt around a real **A1→B1 proficiency sequence** (the intended course), not just "whatever we'd built." New word goals per level: **A1 200 / A2 750 / B1 1,500** (was 60/250/450). Lessons are ordered pedagogically within each level. Lessons that belong on the path but **aren't built yet are shown as "· gap" steps** (greyed, non-clickable) via a new `PLANNED_LESSONS` registry — so the path itself surfaces exactly what's left to build. The "Next up" recommender and the → current-step marker skip gaps (a not-yet-built lesson can't be the next thing to *do*), while the path display still lists them. Passing a level's exam still requires that level's lessons + word goal, so gaps correctly block the exam until filled.
  - New A1 lessons built this pass: **Noun Gender** and **Present Conjugations** (see grammar units below).
  - Remaining gaps surfaced on the path: ~~Past & Future (A2)~~ *(built, Phase 8)*, ~~Numbers & Quantifiers (A2)~~ *(built, Phase 9)*, **Reflexive Verbs** (B1) — the last gap.
- [x] **Phase 8 — Past & Future lesson (A2).** Built the `past-future` unit (moved out of `PLANNED_LESSONS` into `LESSONS` + `GRAMMAR`, so it flipped from a path "gap" to a live A2 step automatically). Covers past-tense formation (drop -ть → -л/-ла/-ло/-ли, agreeing with gender/number not person), быть in the past, aspect in the past, common irregulars (шёл, мог), and both futures — perfective simple future (напишу́) vs. imperfective compound future (бу́ду + infinitive). Explanation + 8 practice + 8 test + a 12-item grammar-review pool. Added 2 past/future questions to the A2 exam.
- [x] **Phase 9 — Numbers & Quantifiers lesson (A2).** Built the `numbers` unit (same flip from gap → live A2 step). Covers the three counting buckets (1 → nominative singular; 2–4 → genitive singular; 5+ → genitive plural), the gender of оди́н / два-две, compound numbers (last-digit rule + the 11–14 trap), and quantity words (мно́го / ма́ло / ско́лько + genitive, plural for countable / singular for uncountable). Explanation + 8 practice + 8 test + 12-item review pool. Added 2 number questions to the A2 exam (now **30 Q**). This completes all A2 grammar units.
- [x] **Phase 7 — A1 vocabulary rebuilt into 8 beginner categories.** The deck (now **581 words**) is organized into the concrete A1 foundation Danny asked for, replacing the old flat "Core frequency" grouping as the *starting* layer. Eight new theme decks, each ~its target size: **Greetings & Etiquette (20), Personal Pronouns (10), Family Members (15), Everyday Objects (40), Common Places (25), High-Frequency Verbs (50), Core Adjectives (30), Numbers & Time (22)** — ~212 A1 words vs. the 200 goal. Built by re-tagging fitting existing words (verbs, adjectives, concrete nouns — ids unchanged, so **all drilling progress is preserved**) and authoring **111 new beginner words** (ids 471–581: greetings, pronouns, family, numbers, more objects/places). Leftover abstract frequency words + the Emotions/Arts decks remain as the **A2+ "broader" pool** (still selectable in the deck picker, now grouped A1-foundation vs. A2+). New word types carry their own `pos` (`phrase`, `pron`, `num`, `adv`) so multiple-choice distractors stay same-type (e.g. numbers vs numbers). A **one-time migration** (`migrate()`, keyed by `S.migv`) runs on first open: points daily new words at the A1 categories and **resets the A1 exam** so it's re-earned — without touching cards, streak, or completed lessons. Danny's call: keep all progress, reset just the A1 exam.

### Grammar units built
- [x] Noun gender (род существи́тельных) — A1 *(new)*
- [x] Present conjugations (настоя́щее вре́мя, 1st & 2nd) — A1 *(new)*
- [x] Past & future tense (прошедшее / будущее) — A2 *(new)*
- [x] Numbers & quantifiers (числительные + много/мало/сколько) — A2 *(new)*
- [x] Prepositional case (предложный) — A1
- [x] Accusative case (винительный) — A1
- [x] Genitive case (родительный) — A2
- [x] Verb aspect (imperfective / perfective) — A2
- [x] Verbs of motion (идти/ходить, ехать/ездить, prefixes) — B1
- [x] Dative case (дательный) — A2
- [x] Instrumental case (творительный) — A2

That completes all six everyday cases plus aspect and motion — the core grammar spine.

---

## Grammar backlog (the rest of the cases + more)

Priority order roughly by everyday usefulness. Each slots into the guided path when built.

- [x] **Genitive (родительный)** — *shipped.* Possession/"of", absence (нет + gen), prepositions (из, от, до, у, без, для), after numbers 2–4 / 5+, quantities.
- [x] **Dative (дательный)** — *shipped (A2).* Indirect object / recipient verbs (incl. звонить, помогать), нравится + feelings, need/permission/age (мне нужно, мне 30 лет), prepositions к / по, pronoun table. Folded into the A2 exam + A2 mastery requirement.
- [x] **Instrumental (творительный)** — *shipped (A2).* Means/tool (bare instrumental, no preposition), с + instr ("together with"), быть/стать/работать + instrumental for professions/roles, position prepositions (с, над, под, перед, за, между), verbs занима́ться / интересова́ться / горди́ться, pronoun table. **Now required for the A2 level** (added to `BAND_LESSONS.A2`); its 3 "get-ahead" questions were moved out of the B1 exam into the A2 exam (A2 now 26 Q, B1 refilled to 18). Feeds a 12-question grammar-review pool.
- [ ] **Nominative overview** — short intro unit: what cases are, why they exist, the case "map." (Could go first as an orientation.)
- [ ] **Plural declensions** — how the case endings change in the plural.
- [ ] **Adjective agreement** — adjectives matching noun gender/number/case across the cases.
- [ ] **Pronoun declension** — я/ты/он… across cases (меня, тебе, о нём…).

## Verb / other grammar backlog
- [x] **Present-tense conjugation (1st & 2nd conjugation patterns)** — *shipped (A1)* as the **Present Conjugations** lesson.
- [x] **Past & Future** — *shipped (A2).* Past tense (gender/number agreement, быть, aspect in the past, irregulars шёл/мог) + both futures (perfective simple vs. imperfective compound бу́ду + infinitive). Lesson id `past-future` + 12-item review pool; 2 questions added to the A2 exam.
- [x] **Numbers & Quantifiers** — *shipped (A2).* Counting rules (1 / 2–4 / 5+ noun forms), gender of оди́н/два-две, compound numbers + the 11–14 trap, and quantity words (много/мало/сколько + genitive). Id `numbers` + 12-item review pool; 2 questions added to the A2 exam.
- [ ] **Reflexive verbs (-ся / -сь)** — *B1 path gap (next to build).* Id `reflexive`.
- [ ] Imperative mood
- [ ] Noun gender — *shipped (A1)* (see grammar units built).

---

## Feature backlog (from the original wish list)

- [ ] **Pop quizzes** — surprise, probabilistic quiz on app open, drawn only from material already seen.
- [ ] **Conversation practice** — a launcher that seeds a Claude chat with level + recent vocab; converse in Russian, get a feedback report; optionally write new words back to a "to-learn" list.
- [ ] **Pronunciation check** — browser speech recognition to score spoken attempts (experimental; the weak piece).
- [ ] **Bundled neural audio** — offline Silero/Piper clips per word + example sentence, with stress marks, for consistent high-quality pronunciation. (Deferred — adds an `audio/` folder.)
- [x] **Level test** — *shipped as per-CEFR mastery exams* (A1/A2/B1). Replaces the word-count heuristic as the official Level. Next: add A2+ grammar depth (dative/instrumental/plurals) to the higher exams as those units ship; consider a B2 exam.
- [~] **More vocab** — *in progress.* At **581 words**. A1 is now organized into 8 concrete beginner categories (~212 words, Phase 7); the rest is the A2+ pool (abstract frequency tiers 2–3 + Emotions/Arts). Next: grow the A2+ layer toward the **A2 750 / B1 1,500** goals — more themes (News/politics, Work/business, Science) and mid-frequency fill. Exam word-thresholds are **A1 200 / A2 750 / B1 1,500**; the path shows the shortfall honestly.

## Polish / nice-to-haves
- [ ] Look & feel iteration 2 (accent tuning, maybe two-column Home, progress rings on stat cards).
- [ ] Reinforce recently-learned vocab inside lesson examples automatically.
- [ ] Handle stress marks / ё more explicitly in typed grading.
- [x] Per-unit review (re-drill a lesson) — *shipped as Grammar Review* (spaced, fresh questions). Vocab-specific per-unit re-drill still open if wanted.
- [ ] Grammar Review polish: fold a "grammar due" count into the Home "Next up" recommender (currently Drill-tab only, by design); add more review questions per topic over time; extend to future units (instrumental, plurals, tenses) automatically as they ship.

---

## Suggested next steps
The path now defines the plan. Fill the remaining path gaps (in path order), then grow the deck to match the new word goals.
1. **Fill the A2 path gaps** — build **Past & Future** (`past-future`), then **Numbers & Quantifiers** (`numbers`). Same lesson format as the cases (explanation + 8 practice + 8 test + a 12-item grammar-review pool). Wire is already in place (`BAND_LESSONS.A2`, `PLANNED_LESSONS`); moving each id from `PLANNED_LESSONS` into a real `LESSONS`/`GRAMMAR` entry flips it from "gap" to a live step automatically.
2. **Fill the B1 gap** — build **Reflexive Verbs** (`reflexive`).
3. **Grow the deck toward the new word goals** — themed decks (News/politics, Work/business, Science) toward ~1,500 words, so the A2/B1 word goals become reachable.
4. **Pop quizzes** and **conversation practice** — still the biggest missing *features* (vs. curriculum).
