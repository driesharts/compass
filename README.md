# Compass

A quiet reflection app: values → goals → habits, with prompts designed to surface the reasoning you'd otherwise skip.

## How to run

No build step, no install. Open `index.html` in a browser, or run it via the Claude Code preview (`compass` entry in `.claude/launch.json`).

## How it works

- **Values** — a handful of directions that matter to you (growth, connection, health...). Rarely change. Editable and deletable (deleting cascades to its goals/habits).
- **Goals** — concrete, dated milestones under a value, e.g. "Watch a Netflix series in Spanish without subtitles by March 2027." Each goal has a title, a *why*, and a target date (with a "days left" / "days past" indicator). Editable, deletable, and markable as achieved (closes the loop instead of just sitting there).
- **Habits** — the action under a goal, defined as a trigger ("if it's 8pm, then I do 20 min of Spanish"), not just a name. Frequency is either daily (default) or a target number of times per week — a 2x/week habit is measured against "2 this week," not "7," so it doesn't read as failing on the days it's not supposed to happen. Editable and deletable.
- **Today** — one-tap logging per habit, a rolling 7-day consistency view (not a fragile streak — missing a day doesn't reset anything), and an optional one-line daily reflection prompt.
- **Journal** — free-form entries plus the daily prompts, grouped by month, with search and category filters (Retrospective, Future-self, Socratic, Values, Motive, From your data, Free-form).
- **Statistics** — stat tiles, 30-day consistency per habit, and a "where your attention went" chart per value (distinguishing "no habit set up yet" from "habit exists but unused").
- **Copy for Claude** — on any goal, copies a formatted summary (title, why, target date, habits) to your clipboard, ready to paste into a Claude conversation for research-grounded feedback.

## Reflection prompts, not a scored audit

Early versions of this app tried to score each goal as intrinsically or extrinsically motivated, including a single "would you still want this with zero recognition?" test. That got dropped: it's a folk heuristic, not a validated instrument, it's vulnerable to social-desirability bias (people say "yes, of course" even when recognition matters), and it breaks on inherently relational goals (a friendship goal can't cleanly be evaluated "if the friend never knew"). Real motives are usually mixed, not resolvable to one category.

Instead, the **Motive** prompt category asks about a specific active goal using questions closer to Deci & Ryan's actual regulatory-style framework (is this guilt-driven, about others' opinions, genuinely chosen, or just enjoyable) — as an open journal reflection you write your own answer to, not a form field that gets tagged, scored, or flagged. Nothing here is stored as a metric; it's a question to sit with, revisited over time in the Journal.

## Design notes

- Everything is saved to `localStorage` — no account, no server, fully private.
- No points, coins, or badges on purpose — the research this app is built on (self-determination theory) suggests external rewards can crowd out intrinsic motivation for things like language learning or exercise. Feedback (the consistency view) does the motivational work instead.
- Export strips internal UI state before download; import asks for confirmation before overwriting local data.

## Deferred to a later version

Periodic "does this still resonate?" review prompts for goals/values, a weekly retrospective template, and deeper data/insights (e.g. correlating journaling frequency with self-rated satisfaction).
