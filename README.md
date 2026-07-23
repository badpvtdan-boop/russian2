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
  60 adjectives). 10 new + 20 review per day; misses come back until answered. Multiple-choice
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
