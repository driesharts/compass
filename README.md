# Compass

A quiet reflection app: values → goals → habits, with prompts designed to surface the reasoning you'd otherwise skip.

## How to run

No build step, no install. Open `index.html` in a browser, or run it via the Claude Code preview (`compass` entry in `.claude/launch.json`).

## How it works

- **Values** — a handful of directions that matter to you (growth, connection, health...). Rarely change. Editable and deletable (deleting cascades to its goals, habits, and to-dos). On the Values & Goals page, each value collapses to its name and a count of goals/habits/to-dos by default — click to expand it in place and see the full detail, so the page stays scannable as you add more. An "Expand all" / "Collapse all" toggle (once you have more than one value) switches every section at once.
- **Goals** — concrete, dated milestones under a value, e.g. "Watch a Netflix series in Spanish without subtitles by March 2027." Each goal has a title, a *why*, and a target date (with a "days left" / "days past" indicator). Editable, deletable, and markable as achieved (moves it to History instead of just sitting there).
- **Habits** — the action under a goal, defined as a trigger ("if it's 8pm, then I do 20 min of Spanish"), not just a name. Frequency is daily, a target number of times per week, or per month — a 2x/week habit is measured against "2 this week," not "7," so it doesn't read as failing on the days it's not supposed to happen (the consistency dots already show the target, so it isn't repeated as a separate label). Editable, deletable, and markable as completed (moves it to History, preserving its log history instead of erasing it). Habits and to-dos always attach to a goal — there's no "ongoing, no goal" option, so everything stays anchored to something concrete.
- **To-dos** — one-off action items under a goal (e.g. "sign up for the race"), distinct from recurring habits. Check one off and it moves to History; delete it if it's no longer relevant.
- **Today** — "What did you want to get done today?" is read-only, filled in from whatever you wrote in the tomorrow box the evening before, with a check button to mark it done once you have (no editing it same-day — the point is holding yourself to what past-you decided). "What do you want to get done tomorrow?" is the one free-text box you actually type into, fresh each day — a lightweight evening-planning loop, separate from habits/to-dos on purpose since those already have their own checkable tracking. Below that, a flat To-do's list (not grouped by value — there usually aren't enough of them at once to need it), a Habits section grouped by the value each habit serves with a rolling 7-day consistency view per habit (not a fragile streak — missing a day doesn't reset anything), and an optional one-line daily reflection prompt.
- **Journal** — free-form entries plus the daily prompts, grouped by month. The composer lets you tag a free-form entry to what it's about — Freeform, or one of your goals (achieved ones included, marked with a ✓, so you can still reflect on a goal right after finishing it) — as buttons, not a dropdown. The search/filter area mirrors that split: a "Prompts" row (Retrospective, Future-self, Socratic, Values, Motive, From your data) for the auto-generated daily entries, and a "Goals" row (Freeform + every goal) for your own notes. Clicking a "→ Goal" pill on any entry jumps straight to that goal's filter. Every entry has an Edit button — change the text (and, for your own notes, the goal tag) or delete it outright; deleting a goal un-tags rather than deletes any notes that referenced it.
- **Statistics** — stat tiles, 30-day consistency per habit (grouped by value), a "Plan follow-through" section showing month-by-month dots for how often you did what you told yourself you would the day before, and a "where your attention went" chart per value (distinguishing "no habit set up yet" from "habit exists but unused").
- **History** — achieved goals and completed habits/to-dos, grouped by value and goal instead of dumped in one flat list. Keeps the active views focused on what's still in progress; each entry can be permanently deleted from here once you're done with it.

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
