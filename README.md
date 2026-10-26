# Russian Trainer

A personal, single-file Russian tutor. Guided daily vocabulary drilling with spaced
repetition, structured grammar lessons, audio, and a curriculum that always tells you
what to do next. Built to run for free with no backend and no API — the app is plain
offline HTML; progress backs up to this repo.

## Run it

Open `russian-trainer.html` in any modern browser (double-click it). No install, no server.
Everything runs locally; progress is saved in the browser and synced to GitHub.

**Day to day it runs from a home-screen icon on the phone, off a hosted copy served from
this repo — not from a local clone.** Two things follow, and both have already bitten:

- **A source edit does not reach the phone until it is pushed.** Editing the working copy
  fixes nothing on the device that's actually being used. Push, then reload on the phone,
  then confirm the **App version** line in Settings matches what you just shipped.
- **That device's storage is the only copy of the live state**, and iOS can reclaim it
  without asking. The backup in this repo is the safety net — see cold-start restore in
  `BACKLOG.md`.

## What's inside

- **Home** — a "Next up" recommender and a guided path (vocab milestones + grammar units).
- **Drill** — spaced repetition over a 160-word deck (50 nouns w/ gender, 50 verbs w/ aspect,
  60 adjectives). 5 new + 40 review per day (see the load invariant below); reviews are served
  most-overdue-first, due dates are load-balanced so cohorts don't all return on the same day,
  and misses come back until answered. "I know this" on a review word counts as finishing that review (it used to count for nothing, so the home card's "Review N" never cleared); on a brand-new word it doesn't, so a genuinely new word takes its place. The home card's review number and the drill's review queue both come from `todaysReviewIds()`, so they always agree. "Extra practice" serves overdue reviews before new
  words, and won't introduce new words into an already-overloaded tomorrow. The card shows only
  the part of speech before the answer — gender, aspect and the partner verb were giving it away —
  and spells them out on the feedback panel afterwards. Wrong options never include the word's
  aspect partner or a word sharing one of its meanings (`choiceClash`). Audio via browser TTS.
  **Answer mode "Mixed" (the default since 2026-10-26) is an exercise ladder:** the format is
  chosen per word from its box (`exerciseFor()`), so each word gets harder until it can be
  produced cold — new words are met and then matched (one spare look-alike, so the last pair
  is never free), box 0–2 alternates "hear it, pick the meaning" with look-alike multiple
  choice (`smartDistractors()`), box `LADDER_TILES_BOX`+ is spelled from letter tiles, box
  `LADDER_TYPE_BOX`+ is typed — Latin letters accepted (`gradeTyped()`, live Cyrillic preview).
  A same-day miss comes back in an easier format. Every format scores through the same
  `resolve()`, so the scheduler is unchanged. "Multiple choice only" and "Type it only" remain.
- **Lessons** — explain → practice → scored test (75% to pass). Units: Prepositional case,
  Accusative case, Verb aspect, Verbs of motion. A lesson carrying too much for one screen can
  instead declare `steps`: a sequence of one-idea chunks, each immediately practising the point
  it just taught, followed by a `recap` and then the same graded test. Lessons without `steps`
  keep the original single-screen flow untouched.
  A lesson can also carry **`sentences`** (3–7 everyday sentences, each with `ru`, `en`, `why` and
  near-miss `wrong` versions) and **`faq`** (the follow-up questions people always ask). The
  sentences are shown with audio before the recap, listed on the **📝 My sentences** page once the
  lesson is passed, and folded into grammar review as "say it in Russian" items (review ids
  `lesson#s0…`). Lessons with sentences must explain every test answer (`why`, shown only after the
  pick is scored) and make at least half the test whole-sentence choices, so the test checks the
  decision rather than spotting the one option with the right-looking ending. Any passed lesson
  has **↻ Refresh**: its summary, sentences and a quick unscored quiz from its review pool.
  The Instrumental is the first lesson in this shape (2026-10-06), modelled on a Gemini lesson that
  worked: majority rules only, one idea at a time, five sentences to keep. "Prefixes That Change
  Meaning" followed on 2026-10-22, split into three: the core lesson (the everyday direction
  prefixes), "Prefixes: One Root, Many Verbs" (the писа́ть family and -ыва- habit partners) and
  "Prefixes: How Much of It" (по-/за-/до- and the empty-or-not catch).
  Numbers followed on 2026-10-23, split in two and moved after the Genitive it leans on:
  "Numbers: One, Two, Five" (the three groups, with five-and-up taught as the handful of words
  you actually count — years, roubles, hours, minutes, days) and "Numbers: Big Numbers & “How
  Many”" (the last-digit rule, 11–14, ско́лько, мно́го/ма́ло/не́сколько).

## Data & sync

- **`progress.json`** holds all learning state (words, scheduling, streak, lesson scores).
- The app writes it **directly to this repo from the browser** via the GitHub API
  (Settings → GitHub sync). Learning state lives in the browser's localStorage and is
  pushed as `progress.json`.
- **A day must never live on one device.** Pushing used to happen only when a session
  reached a finish screen, so closing the app on card 39 of 40 left that day's only copy
  in one browser's storage. Now every local write marks the state dirty and a push
  follows: forced on the first credit of a new day, debounced ~15s after any later
  change, and flushed on `visibilitychange`/`pagehide` — the last moment a phone can
  send anything. `ghSave()` calls `save(true)` so it never re-arms the scheduler it is
  already servicing.
- **The home screen states the backup's health** and says so in orange when it is bad:
  never pushed from this device, sync not configured here, pushes failing (with the real
  error), or local changes not yet sent. A device that silently never backs up was how
  2026-09-14 was lost: a second copy of the app has its own localStorage, and the token
  lives in that same storage, so an unconfigured copy pushed nothing and said nothing.
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
   reset on every sync. Device-local facts (when this browser last pushed) deliberately live
   in their own localStorage key, NOT in the saved state, so they never travel through merge.
5. **Never write through `localStorage.setItem(KEY, …)` directly; go through `save()`.** It runs
   `saveGuard()`, which refuses a blank state on top of a populated one — the exact shape of the
   wipe — and it reports write failures instead of swallowing them. Likewise `load()` never lets
   an unreadable save be silently replaced: the bytes are copied aside under `rt_state_corrupt_*`
   and `LOCAL_FAULT` is set so the UI can say the device is not actually brand-new.
6. **`REVIEW_PER_DAY` and `NEW_PER_DAY` are not independent.** With the `INTERVALS` ladder,
   every new word costs `INTERVALS.length - 2` reviews on its way to the top box, so N new
   words a day generates that many times N reviews a day *forever*. The original 10/20 pair
   was a 3x deficit — it could only ever sustain ~3.3 new words a day, and the difference
   piled up as a backlog no daily cap could clear. If you raise `NEW_PER_DAY`, raise
   `REVIEW_PER_DAY` with it; `tests/backlog-invariants.mjs` fails if you don't.

## Tests

    node tests/streak-invariants.mjs
    node tests/backlog-invariants.mjs
    node tests/lesson-invariants.mjs
    node tests/sync-invariants.mjs
    node tests/ladder-invariants.mjs

All five read the real code out of `russian-trainer.html` and run it in a Node vm, so they
exercise what ships rather than a copy that can drift. Run the first two after touching the
SRS engine, the daily caps, or `mergeStates`; the third after touching lesson content or the
lesson runner; the fourth after touching `save`/`load`, `saveGuard`, the sync scheduler, or
anything that decides when progress leaves the device; the fifth after touching the drill's
exercise formats, Latin-typing grading, or look-alike wrong answers.

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
