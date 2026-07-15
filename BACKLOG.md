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
- [x] **Phase 4 — Guided path.** "Next up" recommender + ordered curriculum with done/current/locked markers. Milestones relabeled "words met" (honest vs. SRS "known").
- [x] **Look & feel.** Warm editorial light theme (first pass).
- [x] **CEFR labels + legend.** Lessons tagged by band (A1→B1) with color chips and a legend clarifying lesson difficulty vs. the word-count estimate.
- [x] **Level exams (per-CEFR mastery).** A1/A2/B1 exams (vocab + grammar), 85% to pass, unlock in order; the highest passed exam sets your official Level (source of truth), with readiness nudges on Home. New 🎓 Level tab.
- [x] **Shuffled answer options.** Lesson practice/test options now randomize each render (previously the correct answer was always first). Drill and exams shuffle too.

### Grammar units built
- [x] Prepositional case (предложный) — A1
- [x] Accusative case (винительный) — A1
- [x] Genitive case (родительный) — A2
- [x] Verb aspect (imperfective / perfective) — A2
- [x] Verbs of motion (идти/ходить, ехать/ездить, prefixes) — B1

---

## Grammar backlog (the rest of the cases + more)

Priority order roughly by everyday usefulness. Each slots into the guided path when built.

- [x] **Genitive (родительный)** — *shipped.* Possession/"of", absence (нет + gen), prepositions (из, от, до, у, без, для), after numbers 2–4 / 5+, quantities.
- [ ] **Dative (дательный)** — indirect object ("to/for someone"), age (мне 30 лет), нравится, нужно/надо, prepositions к, по.
- [ ] **Instrumental (творительный)** — "by/with" (means/tool), с + instr ("together with"), быть/стать + instrumental, professions.
- [ ] **Nominative overview** — short intro unit: what cases are, why they exist, the case "map." (Could go first as an orientation.)
- [ ] **Plural declensions** — how the case endings change in the plural.
- [ ] **Adjective agreement** — adjectives matching noun gender/number/case across the cases.
- [ ] **Pronoun declension** — я/ты/он… across cases (меня, тебе, о нём…).

## Verb / other grammar backlog
- [ ] Present-tense conjugation (1st & 2nd conjugation patterns)
- [ ] Past tense (gender/number agreement)
- [ ] Future tense (compound imperfective vs. perfective)
- [ ] Reflexive verbs (-ся)
- [ ] Imperative mood
- [ ] Numbers & counting (ties into genitive)

---

## Feature backlog (from the original wish list)

- [ ] **Pop quizzes** — surprise, probabilistic quiz on app open, drawn only from material already seen.
- [ ] **Conversation practice** — a launcher that seeds a Claude chat with level + recent vocab; converse in Russian, get a feedback report; optionally write new words back to a "to-learn" list.
- [ ] **Pronunciation check** — browser speech recognition to score spoken attempts (experimental; the weak piece).
- [ ] **Bundled neural audio** — offline Silero/Piper clips per word + example sentence, with stress marks, for consistent high-quality pronunciation. (Deferred — adds an `audio/` folder.)
- [x] **Level test** — *shipped as per-CEFR mastery exams* (A1/A2/B1). Replaces the word-count heuristic as the official Level. Next: add A2+ grammar depth (dative/instrumental/plurals) to the higher exams as those units ship; consider a B2 exam.
- [~] **More vocab** — *in progress.* At 470 words with themed decks (Emotions, Arts) + frequency tiers. Next: more themes (News/politics, Work/business, Science), and grow toward ~1,000+ for a legitimate A2 vocabulary. Exam word-thresholds bumped to A1 60 / A2 250 / B1 450 to match the bigger deck.

## Polish / nice-to-haves
- [ ] Look & feel iteration 2 (accent tuning, maybe two-column Home, progress rings on stat cards).
- [ ] Reinforce recently-learned vocab inside lesson examples automatically.
- [ ] Handle stress marks / ё more explicitly in typed grading.
- [ ] Per-unit review (re-drill a lesson's vocab).

---

## Suggested next steps
1. **Dative case** — next on the case path; unlocks indirect objects, нравится, age, к/по. Feeds the A2/B1 exams.
2. **Pop quizzes** — quick win, adds the "test me randomly" feel you wanted.
3. **Conversation practice** — the highest-value feature still missing.
