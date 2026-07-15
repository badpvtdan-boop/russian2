# Russian Trainer — Design Spec

**One-liner:** A personal Russian tutor. A free, offline web app does the daily drilling; Claude (on your Max subscription) acts as the content studio and live conversation partner; GitHub stores and syncs everything.

**Design principle:** Nothing in the app calls an AI at runtime, so there is zero API cost. Anything that genuinely needs a live model happens inside a Claude session, which your Max plan already covers. Claude generates content *ahead of time* and drops it into the repo; the app just serves and grades it.

---

## Architecture

Three parts, one shared data file:

- **The app** — a single-file web page (`index.html`) that runs in your browser. Handles drilling, lessons, quizzes, tests, audio, and level tracking. No server, no login, no cost.
- **The data** — `progress.json`, the single source of truth for your state (words, scheduling, lesson progress, level, streak, debt). Lives in the GitHub repo. `content/` holds Claude-generated decks, lessons, quizzes, and tests.
- **Claude** — in sessions like this one, generates new content into the repo and runs live conversation practice. A scheduled task sends your morning reminder.

```
Browser app  <->  progress.json  <->  GitHub  <->  Claude (content + conversation)
```

---

## Data model (`progress.json`)

- `profile`: `estimatedLevel` (A1–B2), `levelConfidence`, `createdAt`
- `words[]`: `id`, `ru`, `en`, `pos`, `notes`, `interval`, `ease`, `dueDate`, `lapses`, `status` (new / learning / known), `introducedAt`
- `dailyLog`: date → `{ newDone, reviewDone, debtCarried }`
- `streak`, `lastCompletedDate`, `debt` (reviews owed)
- `lessons[]`: `unitId`, `topic`, `status`, `score`, `completedAt`
- `quizHistory[]`

---

## Spaced-repetition engine

- **Algorithm:** modified SM-2 (or a 5-box Leitner system). Each answer is graded *again / hard / good / easy*; the interval and ease adjust from there.
- **"Drill relentlessly until known":** a new word must clear several correct answers in a row within the session, then survive its next scheduled reviews before it flips to `known`. Miss it and it drops back.
- **Daily quota:** 20 due reviews first, then 10 new words. New words are gated behind clearing the review backlog.
- **The debt mechanic:** anything you skip carries as `debt` to the next day, and the morning reminder names it ("you owe 10 new + 12 reviews").

## Grading typed answers

Normalize case, treat ё/е as equal, make stress marks optional, allow a synonyms list per word, and fuzzy-match near-misses. Recognition-phase words can use multiple choice; production-phase words require typing.

---

## Screens

1. **Today** — the drill (reviews + new), a progress ring, and a debt banner if you owe from yesterday.
2. **Lessons** — structured units by topic (cases, verb aspect, verbs of motion, etc.). Each unit = a plain-language explanation, examples that reuse *your* known/learning vocab, inline exercises, and an end-of-unit test.
3. **Pop quiz** — fires probabilistically when you open the app, pulling only from material you've already seen.
4. **Level** — your A1–B2 estimate and what it's based on, clearly labeled a guess.
5. **Conversation** — a launcher that hands you a pre-seeded prompt to paste into Claude, since the live chat lives there.

---

## Audio

- **Playback:** the browser's built-in `SpeechSynthesis` with a `ru-RU` voice. A play button on every word and example sentence, with an adjustable rate. Free and offline.
- **Pronunciation check (optional, experimental):** the browser's `SpeechRecognition` transcribes your attempt and compares it to the target for a rough score and a highlight of what missed. Flagged as approximate — this is the weakest piece and your stated non-deal-breaker.

## Level estimation

A heuristic, not a test: weight the count of `known` words against rough CEFR vocabulary bands (~A1 600 / A2 1200 / B1 2500 / B2 4000), plus units passed and test scores. Output a band and a confidence figure, explicitly labeled an estimate.

---

## Content generation (Claude's job)

Done in sessions, committed to `content/`:

- **Vocab decks** — themed, frequency-ranked lists with `ru / en / pos / example sentence`.
- **Lesson units** — explanation, examples (reusing your current vocab), 5–10 exercises, and a unit test.
- **Quiz bank** — question templates drawn from learned material.

## Conversation practice

The app shows a "start conversation" card with a prompt pre-filled with your level and recent vocab. You paste it into Claude; Claude converses in Russian at your level, then returns a feedback report — errors, corrections, and any new words, which can be written back to a "to-learn" list for the app to pick up.

## GitHub sync

The repo holds `progress.json` and `content/`. Two candidate methods, decided at build time: (a) the app reads/writes via the GitHub API using a personal token you paste once and store in the browser, or (b) you run the app from a local clone and a tiny script commits changes. Option (a) is more seamless; option (b) keeps zero credentials in the browser.

## Daily reminder

A scheduled morning task reads `progress.json` and messages you the day's quota plus any carried debt.

---

## Build phases

1. Vocab drill slice — SRS + audio + local save
2. GitHub sync
3. Lessons + unit tests
4. Pop quiz + level meter
5. Conversation launcher + morning reminder
6. Pronunciation check (experimental)

## Open decisions

- GitHub sync method: token-in-browser vs. local clone
- Stress-mark and ё handling strictness in grading
- How aggressive "relentless" is — the exact exit criteria for a drill session
- Whether to reuse the app you built a couple of months ago as a starting point (I haven't seen it — point me at the repo and I'll fold it in)
