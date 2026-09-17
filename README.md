# Compass

A quiet reflection app: values → goals → habits, with prompts designed to surface the reasoning you'd otherwise skip.

## How to run

No build step, no install. Open `index.html` in a browser, or run it via the Claude Code preview (`compass` entry in `.claude/launch.json`).

## How it works

Compass is organized as a drill-down: **Values index → a Value's page → one of its Goals' pages.** Values and to-dos live on the value, and can optionally point at one of that value's goals — nothing is forced to have a goal.

- **Values** — a handful of directions that matter to you (growth, connection, health...). The Values tab is an index: each value is a card showing its name and a "N goals · N habits · N to-dos" count; tapping it opens that value's own page. A value's page has its note, its goals (as cards linking to each goal's own page), and — owned directly by the value — one habit list and one to-do list. Editable and deletable (deleting cascades to everything under it: goals, habits, to-dos).
- **Goals** — concrete, dated milestones under a value, e.g. "Watch a Netflix series in Spanish without subtitles by March 2027," each with its own page reached from the value's goal list. That page shows the goal's related habits and to-dos (whichever of the value's items are tagged to it), a composer for journaling about this goal specifically (entries appear right there, and are the same entries visible from the main Journal), and — deliberately placed at the bottom of the page, since it's the reflective part rather than the logistics — a "why does this matter" box that autosaves as you write. Markable as achieved (moves it to Achievements); deleting a goal un-tags its habits/to-dos/journal notes rather than deleting them, since they belong to the value, not the goal.
- **Habits** — the action itself, defined as a trigger ("if it's 8pm, then I do 20 min of Spanish"), not just a name. Frequency is daily, a target number of times per week, or per month — a 2x/week habit is measured against "2 this week," not "7." On a value's page, habits sort daily → weekly → monthly (least frequent at the bottom) and can optionally be tagged to one of that value's goals via a chip selector ("No tag" is a valid choice). Checking a habit off for today happens right there on the value (or goal) page — that's also where its 7-day consistency dots live. Markable as completed (moves it to Achievements, keeping its log history).
- **To-dos** — one-off action items, same optional goal-tag as habits. Check one off and it moves to Achievements; delete it if it's no longer relevant.
- **Today** — "What did you want to get done today?" is read-only, filled in from whatever you wrote in the tomorrow box the evening before, with a check button to mark it done (no editing it same-day — the point is holding yourself to what past-you decided). "What do you want to get done tomorrow?" is the one free-text box you actually type into, fresh each day. Below that, a "Completed today" recap — habits logged and to-dos finished today, grouped by value — since checking things off now happens on the value/goal pages rather than here.
- **Journal** — free-form entries plus the daily prompts, grouped by month. The composer lets you tag a free-form entry to what it's about — Freeform, or one of your goals (achieved ones included, marked with a ✓, so you can still reflect on a goal right after finishing it) — as buttons, not a dropdown. The search/filter area mirrors that split: a "Prompts" row (Retrospective, Future-self, Socratic, Values, Motive, From your data) for the auto-generated daily entries, and a "Goals" row (Freeform + every goal) for your own notes. Clicking a "→ Goal" pill on any entry jumps straight to that goal's filter. Every entry has an Edit button — change the text (and, for your own notes, the goal tag) or delete it outright.
- **Statistics** — stat tiles, 30-day consistency per habit (grouped by value), a "Plan follow-through" section showing month-by-month dots for how often you did what you told yourself you would the day before, and "where your attention went" — each value scored against its *own* habits' targets (percent of its own achievable check-ins over 30 days), not compared against other values' raw counts, so a value with one weekly habit and one with five daily habits are both scored fairly.
- **Achievements** (formerly "History") — an app-wide summary strip (total goals achieved / habits completed / to-dos completed), then per value: achieved goals (linking to their own page), completed habits and to-dos, and that value's lifetime total habit check-ins. Keeps the active views focused on what's still in progress; each entry can be permanently deleted from here once you're done with it. This is a lifetime record, distinct from Statistics' rolling 30-day view.

## Reflection prompts, not a scored audit

Early versions of this app tried to score each goal as intrinsically or extrinsically motivated, including a single "would you still want this with zero recognition?" test. That got dropped: it's a folk heuristic, not a validated instrument, it's vulnerable to social-desirability bias (people say "yes, of course" even when recognition matters), and it breaks on inherently relational goals (a friendship goal can't cleanly be evaluated "if the friend never knew"). Real motives are usually mixed, not resolvable to one category.

Instead, the **Motive** prompt category asks about a specific active goal using questions closer to Deci & Ryan's actual regulatory-style framework (is this guilt-driven, about others' opinions, genuinely chosen, or just enjoyable) — as an open journal reflection you write your own answer to, not a form field that gets tagged, scored, or flagged. Nothing here is stored as a metric; it's a question to sit with, revisited over time in the Journal.

## Design notes

- Everything is saved to `localStorage` — no account, no server, fully private.
- Appearance (Settings) supports System / Light / Dark, with the dark palette using the same warm, muted tones as light mode rather than stark black/white.
- No points, coins, or badges on purpose — the research this app is built on (self-determination theory) suggests external rewards can crowd out intrinsic motivation for things like language learning or exercise. Feedback (the consistency view) does the motivational work instead.
- Export strips internal UI state before download; import asks for confirmation before overwriting local data.
- Below ~640px wide, navigation moves to a fixed bottom tab bar (phone-style, sized for comfortable tapping) instead of the top row, since the app is meant to be added to an iOS home screen and used like a native app.
- Logging a habit, completing a to-do or habit, achieving a goal, or deleting something surfaces a brief toast confirming it happened.

## Deferred to a later version

Periodic "does this still resonate?" review prompts for goals/values, a weekly retrospective template, and deeper data/insights (e.g. correlating journaling frequency with self-rated satisfaction).
