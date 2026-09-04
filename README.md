# Russian Trainer

A personal, single-file Russian tutor. Guided daily vocabulary drilling with spaced
repetition, structured grammar lessons, audio, and a curriculum that always tells you
what to do next. Built to run for free with no backend and no API — the app is plain
offline HTML; progress backs up to this repo.

## Run it

Open `russian-trainer.html` in any modern browser (double-click it). No install, no server.
Everything runs locally; progress is saved in the browser and synced to GitHub.

## What's inside

- **Home** — a "Next up" recommender and a guided path (vocab milestones + grammar units).
- **Drill** — spaced repetition over a 160-word deck (50 nouns w/ gender, 50 verbs w/ aspect,
  60 adjectives). 5 new + 40 review per day (see the load invariant below); reviews are served
  most-overdue-first, due dates are load-balanced so cohorts don't all return on the same day,
  and misses come back until answered. "Extra practice" serves overdue reviews before new
  words, and won't introduce new words into an already-overloaded tomorrow. Multiple-choice
  or typed input with an on-screen Cyrillic keyboard. Lenient grading. Audio via browser TTS.
- **Lessons** — explain → practice → scored test (75% to pass). Units: Prepositional case,
  Accusative case, Verb aspect, Verbs of motion.

## Data & sync

- **`progress.json`** holds all learning state (words, scheduling, streak, lesson scores).
- The app writes it **directly to this repo from the browser** via the GitHub API
  (Settings → GitHub sync; auto-saves on session finish). Learning state lives in the
  browser's localStorage and is pushed as `progress.json`.
- **Do not hand-edit or commit `progress.json` from a local clone.** The browser owns it.

## Working on the source (important)

Because the browser keeps pushing `progress.json`, a local clone goes stale as soon as you
use the app. So:

1. **`git pull` before you commit** source edits.
2. **Never force-push.** If a push is rejected as out-of-date, pull — don't force. A force-push
   would overwrite the browser's `progress.json` and destroy saved progress.
3. Stage source files **by name** (e.g. `git add russian-trainer.html`); avoid `git add .` so
   you never accidentally clobber `progress.json`.
4. **Any new field added to the saved state (`blank()`) MUST be added to `mergeStates()` in the
   same change** — merge is the only safety layer now; a field it doesn't handle is silently
   reset on every sync.
5. **`REVIEW_PER_DAY` and `NEW_PER_DAY` are not independent.** With the `INTERVALS` ladder,
   every new word costs `INTERVALS.length - 2` reviews on its way to the top box, so N new
   words a day generates that many times N reviews a day *forever*. The original 10/20 pair
   was a 3x deficit — it could only ever sustain ~3.3 new words a day, and the difference
   piled up as a backlog no daily cap could clear. If you raise `NEW_PER_DAY`, raise
   `REVIEW_PER_DAY` with it; `tests/backlog-invariants.mjs` fails if you don't.

## Tests

    node tests/streak-invariants.mjs
    node tests/backlog-invariants.mjs

Both extract the real function bodies out of `russian-trainer.html` and run them in a Node vm,
so they exercise the shipped code rather than a copy that can drift. Run them after touching
the SRS engine, the daily caps, or `mergeStates`.

## Authoring lesson & story content

Reading-story content must follow the **story authoring principles in `BACKLOG.md`** (search
"Story authoring principles"): natural, real-life Russian in a coherent scene; unambiguous
English glosses (no double-meaning words like "bright"); and grammatical gender surfaced rather
than smoothed over — он/она/оно pointing at an *object* is translated "it," with the gloss saying
*why*. Read those before writing any story.

## Files

- `russian-trainer.html` — the entire app (self-contained: HTML, CSS, JS, deck, lessons).
- `progress.json` — user progress, written by the app (do not edit by hand).
- `BACKLOG.md` — roadmap: remaining cases, grammar topics, and features.
- `russian-trainer-spec.md` — original design spec.

## Roadmap

See `BACKLOG.md`. Next up: the Genitive case.
