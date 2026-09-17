# Compass

A quiet reflection app: values → goals → habits, with prompts designed to surface the reasoning you'd otherwise skip.

## How to run

No build step, no install. Open `index.html` in a browser, or run it via the Claude Code preview (`compass` entry in `.claude/launch.json`).

## How it works

Compass is organized as a drill-down: **Values index → a Value's page → one of its Goals' pages.** Values and to-dos live on the value, and can optionally point at one of that value's goals — nothing is forced to have a goal.

- **Values** — a handful of directions that matter to you (growth, connection, health...). The Values tab is an index: each value is a card showing its name and a "N goals · N habits · N to-dos" count; tapping it opens that value's own page. A value's page has its note, then — in this order — its to-dos, its habits, and its goals (as cards linking to each goal's own page). Editable and deletable (deleting cascades to everything under it: goals, habits, to-dos).
- **Goals** — concrete, dated milestones under a value, e.g. "Watch a Netflix series in Spanish without subtitles by March 2027," each with its own page reached from the value's goal list. The *why* you set when creating (or editing) the goal shows as static text right under the title. That page also has its own "+ Habit"/"+ To-do" (pre-tagged to itself, so you don't have to go back to the value page and pick it from a list), shows the goal's related habits and to-dos, and a composer for journaling about this goal specifically — entries appear right there (and are the same entries visible from the main Journal), showing the 3 most recent with a "Show all" toggle for the rest. Markable as achieved (moves it to Achievements); deleting a goal un-tags its habits/to-dos/journal notes rather than deleting them, since they belong to the value, not the goal.
- **Habits** — the action itself, defined as a trigger ("if it's 8pm, then I do 20 min of Spanish"), not just a name. Frequency is daily, a target number of times per week, or per month. On a value's page, habits sort daily → weekly → monthly (least frequent at the bottom) and can optionally be tagged to one of that value's goals via a chip selector ("No tag" is a valid choice). Checking a habit off for today happens right there on the value (or goal) page, where its dots show progress toward *its own* frequency — a 4x/week habit gets 4 dots that fill in and reset each week; a 3x/month habit gets 3 dots resetting each month; daily gets 7, resetting weekly. (Statistics' 30-day consistency view is unaffected by this — it keeps its own fixed rolling-window math.) Markable as completed (moves it to Achievements, keeping its log history).
- **To-dos** — one-off action items, same optional goal-tag as habits. Check one off and it moves to Achievements; delete it if it's no longer relevant.
- **Today** — "What did you want to get done today?" is read-only, filled in from whatever you wrote in the tomorrow box the evening before, with a check button to mark it done (no editing it same-day — the point is holding yourself to what past-you decided). "What do you want to get done tomorrow?" is the one free-text box you actually type into, fresh each day. Below that, a "Completed today" recap — habits logged and to-dos finished today, grouped by value — since checking things off now happens on the value/goal pages rather than here.
- **Journal** — the daily prompt lives here (not on Today): a rotating research-grounded question with its own textarea, saved as that day's entry. Below it, a plain "write about anything" composer with no goal tag — pure freeform (tagging a note to a goal happens from that goal's own page instead). Entries are grouped by month, with search and two filter rows: "Prompts" (Retrospective, Future-self, Socratic, Values, Motive, From your data) for the auto-generated daily entries, and "Goals" (Freeform + every goal) for filtering your own notes, including ones written from a goal's page. Clicking a "→ Goal" pill on any entry jumps straight to that goal's filter. The list shows the 10 most recent matching entries by default, with a "Show all" toggle for the rest (same pattern as a goal's own journal history). Every entry has an Edit button — change the text (and, for goal-tagged notes, the tag) or delete it outright.
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
- Pinch/double-tap zoom is disabled and inputs use a 16px font so tapping into a field doesn't trigger iOS's auto-zoom — this is meant to feel like a fixed-layout app, not a zoomable web page. Focus rings and the mobile tap-highlight flash use the app's green accent instead of the browser default blue.
- Mobile Safari auto-detects dates/phone numbers in plain text and turns them into blue tappable links — since the app shows dates everywhere (target dates, journal entries, completion dates), a `format-detection` meta tag turns that off, with a CSS fallback in case a given OS version still does it anyway.
- `button`/`input`/`select`/`textarea` explicitly inherit the page's text color. Safari gives form controls their own default color tied to the system tint (blue) instead of inheriting like every other element does — invisible on desktop Chrome, but it turned the value/goal card buttons' text blue on an iPhone.
- The page scrollbar is hidden (scrolling itself still works) to keep the home-screen-app feel.

## Deferred to a later version

Periodic "does this still resonate?" review prompts for goals/values, a weekly retrospective template, and deeper data/insights (e.g. correlating journaling frequency with self-rated satisfaction).
