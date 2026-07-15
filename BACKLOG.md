# Russian Trainer — Backlog

Roadmap for the personal Russian tutor app (`russian-trainer.html`). Living document — update as things ship.

Legend: `[x]` done · `[~]` in progress · `[ ]` not started

---

## Shipped

- [x] **Phase 1 — Vocab drill.** Spaced repetition (Leitner/SM-2-lite), relentless requeue on misses, daily 10 new + 20 review, streak & debt tracking.
- [x] **Rich deck (160 words).** 50 nouns (with gender), 50 verbs (with aspect + partner), 60 adjectives.
- [x] **Answer modes.** Multiple choice (5 options) and typed input with on-screen Cyrillic keyboard. Lenient grading (ё/е, stress marks, small typos).
- [x] **Audio.** Browser TTS with a voice picker that prefers higher-quality voices.
- [x] **Phase 2 — GitHub sync.** Token-in-browser, auto-save on session finish + manual Save/Load. Token kept out of committed `progress.json`.
- [x] **Phase 3 — Lessons engine.** Explain → practice → scored test, 75% to pass, results synced.
- [x] **Phase 4 — Guided path.** "Next up" recommender + ordered curriculum with done/current/locked markers. Milestones relabeled "words met" (honest vs. SRS "known").
- [x] **Look & feel.** Warm editorial light theme (first pass).

### Grammar units built
- [x] Prepositional case (предложный)
- [x] Accusative case (винительный)
- [x] Verb aspect (imperfective / perfective)
- [x] Verbs of motion (идти/ходить, ехать/ездить, prefixes)

---

## Grammar backlog (the rest of the cases + more)

Priority order roughly by everyday usefulness. Each slots into the guided path when built.

- [ ] **Genitive (родительный)** — *high priority, arguably the most useful case.* Possession/"of", absence (нет + gen), prepositions (из, от, до, у, без, для), after numbers 2–4 / 5+, quantities.
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
- [ ] **Level test** — an optional real placement check, vs. the current heuristic estimate.
- [ ] **More vocab** — expand well past 160; themed decks (food, travel, work…).

## Polish / nice-to-haves
- [ ] Look & feel iteration 2 (accent tuning, maybe two-column Home, progress rings on stat cards).
- [ ] Reinforce recently-learned vocab inside lesson examples automatically.
- [ ] Handle stress marks / ё more explicitly in typed grading.
- [ ] Per-unit review (re-drill a lesson's vocab).

---

## Suggested next steps
1. **Genitive case** — biggest grammar payoff; extends the case set.
2. **Pop quizzes** — quick win, adds the "test me randomly" feel you wanted.
3. **Conversation practice** — the highest-value feature still missing.
