const STORAGE_KEY = 'compass-app-state-v1';

const VALUE_SUGGESTIONS = [
  { name: 'Growth', note: 'Learning, mastering skills, becoming more capable.' },
  { name: 'Connection', note: 'Relationships, family, friendship, community.' },
  { name: 'Health', note: 'Physical and mental wellbeing.' },
  { name: 'Contribution', note: 'Helping others, giving back, being useful.' },
  { name: 'Creativity', note: 'Making things, self-expression.' },
  { name: 'Independence', note: 'Autonomy, self-reliance, freedom to choose.' },
  { name: 'Achievement', note: 'Accomplishment, mastery, being recognized for results.' },
  { name: 'Adventure', note: 'New experiences, exploration, novelty.' },
];

const MOTIVE_PROMPT_TEMPLATES = [
  'Think about "{goal}" — how much of it is about what you value, versus what you imagine others would think?',
  'If you would feel guilty or anxious giving up on "{goal}", what would that guilt actually be protecting?',
  'Would you still want to pursue "{goal}" if you were the only person who would ever know about it? What does your answer tell you?',
  'Is the effort you put into "{goal}" toward something you enjoy, or something you feel you should want?',
  'Who, if anyone, would be disappointed if you dropped "{goal}"? Is that a reason to keep it, or not?',
];

const PROMPT_CATEGORIES = {
  retro: [
    'One thing today future-you will be glad about?',
    'What did you let slide today — and is that okay?',
    "What's one small thing tomorrow-you would thank you for?",
    'Anything today that felt like autopilot rather than a choice?',
    'What gave you energy today?',
    'What felt boring but mattered anyway?',
  ],
  future: [
    'Picture yourself one year from today, in a specific moment — what are you doing?',
    "What's one thing you're doing right now that future-you will wish you'd stopped sooner?",
    'If future-you could send one sentence back to today, what would it say?',
    'What would you regret not having tried, looking back from five years out?',
  ],
  socratic: [
    "What am I currently assuming that I haven't actually checked?",
    "What's a question about my own goals that I've been avoiding?",
    'If a close friend described my week back to me, what would they notice that I haven’t?',
    'What evidence would change my mind about the goal I’m most attached to right now?',
    'Where am I optimizing for looking good instead of being good?',
    'What’s the boring, obvious answer I’m overlooking because it doesn’t feel interesting enough?',
  ],
  values: [
    'Which of your values got the least attention this week — and are you okay with that?',
    'If you had to drop one active goal today, which would you keep — and what does that tell you?',
    'Is there a value you claim but haven’t actually built a goal around yet?',
    'What would you do differently today if no one you know would ever find out?',
    'Which of today’s choices actually matched what you say matters to you?',
  ],
};

const PROMPT_CATEGORY_ORDER = ['retro', 'future', 'socratic', 'values', 'motive'];

function dateToLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return dateToLocalISO(new Date());
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateToLocalISO(d);
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function dayIndex(dateISO) {
  return Math.floor(new Date(dateISO + 'T00:00:00').getTime() / 86400000);
}

function dataAwarePrompts(state, dateISO) {
  const prompts = [];
  state.habits
    .filter((h) => h.status !== 'completed' && daysBetween(h.createdAt, dateISO) >= 7)
    .forEach((h) => {
      const { done } = consistency(state, h.id, dateISO, 7);
      const target = habitTarget(h, 7);
      if (done <= Math.floor(target * 0.3)) {
        prompts.push(`"${h.name}" has been slipping — what's actually getting in the way, specifically?`);
      }
    });
  return prompts;
}

function motivePrompts(state, dateISO) {
  const activeGoals = state.goals.filter((g) => g.status !== 'achieved');
  if (activeGoals.length === 0) return [];
  const goal = activeGoals[hashString(dateISO + 'motive-goal') % activeGoals.length];
  return MOTIVE_PROMPT_TEMPLATES.map((t) => t.replace('{goal}', goal.title));
}

function promptForDate(state, dateISO) {
  const idx = dayIndex(dateISO);
  const aware = dataAwarePrompts(state, dateISO);
  if (aware.length > 0 && idx % 3 === 0) {
    return { text: aware[hashString(dateISO + 'aware') % aware.length], category: 'aware' };
  }
  const category = PROMPT_CATEGORY_ORDER[idx % PROMPT_CATEGORY_ORDER.length];
  if (category === 'motive') {
    const pool = motivePrompts(state, dateISO);
    if (pool.length > 0) {
      return { text: pool[hashString(dateISO) % pool.length], category: 'motive' };
    }
    const fallback = PROMPT_CATEGORIES.values;
    return { text: fallback[hashString(dateISO) % fallback.length], category: 'values' };
  }
  const pool = PROMPT_CATEGORIES[category];
  return { text: pool[hashString(dateISO) % pool.length], category };
}

function defaultState() {
  return {
    onboarded: false,
    createdAt: todayISO(),
    theme: 'system',
    values: [],
    goals: [],
    habits: [],
    todos: [],
    logs: [],
    journal: [],
    dayPlans: [],
  };
}

// Habits/to-dos used to be owned by a goal (goalId required). They're now
// owned by a value (valueId required, goalId an optional tag). Back-fill
// valueId from the goal for anything saved under the old shape; a no-op
// once migrated, so it's safe to run on every load.
function migrateToValueOwnedItems(state) {
  [...state.habits, ...state.todos].forEach((item) => {
    if (!item.valueId && item.goalId) {
      const goal = state.goals.find((g) => g.id === item.goalId);
      if (goal) item.valueId = goal.valueId;
    }
  });
  return state;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const state = migrateToValueOwnedItems(Object.assign(defaultState(), parsed));
    if (state._view === 'history') state._view = 'achievements';
    return state;
  } catch (e) {
    console.error('Failed to load state, starting fresh', e);
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---- Derived helpers ----

function habitsForGoal(state, goalId) {
  return state.habits.filter((h) => h.goalId === goalId);
}

function habitsForValue(state, valueId) {
  return state.habits.filter((h) => h.valueId === valueId);
}

function todosForValue(state, valueId) {
  return state.todos.filter((t) => t.valueId === valueId);
}

function goalsForValue(state, valueId) {
  return state.goals.filter((g) => g.valueId === valueId);
}

function todosForGoal(state, goalId) {
  return state.todos.filter((t) => t.goalId === goalId);
}

function valueHasActiveHabit(state, valueId) {
  return habitsForValue(state, valueId).some((h) => h.status !== 'completed');
}

function ownerValueId(state, item) {
  return item.valueId || null;
}

const FREQUENCY_SORT_ORDER = { daily: 0, weekly: 1, monthly: 2 };

function habitFrequencyRank(habit) {
  const type = habit.frequency ? habit.frequency.type : 'daily';
  return FREQUENCY_SORT_ORDER[type] !== undefined ? FREQUENCY_SORT_ORDER[type] : 0;
}

function habitTarget(habit, windowSize) {
  const days = windowSize || 7;
  if (habit && habit.frequency) {
    if (habit.frequency.type === 'weekly') return Math.max(1, Math.round(habit.frequency.timesPerWeek * (days / 7)));
    if (habit.frequency.type === 'monthly') return Math.max(1, Math.round(habit.frequency.timesPerMonth * (days / 30)));
  }
  return days;
}

// Progress within the habit's OWN period (the current calendar week for
// daily/weekly habits, the current calendar month for monthly ones), used
// for the dot display on Value/Goal pages. Dot count = the frequency you
// set (7 for daily, timesPerWeek, or timesPerMonth) rather than a fixed
// rolling window. Deliberately separate from consistency()/habitTarget(),
// which Statistics' 30-day view still uses unchanged.
function habitPeriodProgress(state, habit, dateISO) {
  const type = habit && habit.frequency ? habit.frequency.type : 'daily';
  const periodType = type === 'monthly' ? 'month' : 'week';
  const target = type === 'weekly' ? Math.max(1, habit.frequency.timesPerWeek) : type === 'monthly' ? Math.max(1, habit.frequency.timesPerMonth) : 7;

  const current = new Date(dateISO + 'T00:00:00');
  let periodStart;
  if (periodType === 'month') {
    periodStart = new Date(current.getFullYear(), current.getMonth(), 1);
  } else {
    const day = current.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    periodStart = new Date(current);
    periodStart.setDate(current.getDate() - diffToMonday);
  }
  const periodStartISO = dateToLocalISO(periodStart);

  const days = [];
  for (let d = new Date(periodStart); d <= current; d.setDate(d.getDate() + 1)) {
    days.push(dateToLocalISO(d));
  }
  const done = days.filter((d) => isLoggedOn(state, habit.id, d)).length;

  return { done: Math.min(done, target), target, periodType, periodStartISO, days };
}

function deleteHabit(state, habitId) {
  state.habits = state.habits.filter((h) => h.id !== habitId);
  state.logs = state.logs.filter((l) => l.habitId !== habitId);
}

function deleteTodo(state, todoId) {
  state.todos = state.todos.filter((t) => t.id !== todoId);
}

// Habits/to-dos and journal entries belong to the value, not the goal — a
// goal is just an optional tag on them. Deleting a goal un-tags rather than
// deletes anything that references it.
function deleteGoal(state, goalId) {
  state.habits.forEach((h) => {
    if (h.goalId === goalId) h.goalId = null;
  });
  state.todos.forEach((t) => {
    if (t.goalId === goalId) t.goalId = null;
  });
  state.journal.forEach((j) => {
    if (j.goalId === goalId) j.goalId = null;
  });
  state.goals = state.goals.filter((g) => g.id !== goalId);
}

function deleteValue(state, valueId) {
  habitsForValue(state, valueId).forEach((h) => deleteHabit(state, h.id));
  todosForValue(state, valueId).forEach((t) => deleteTodo(state, t.id));
  state.goals.filter((g) => g.valueId === valueId).forEach((g) => deleteGoal(state, g.id));
  state.values = state.values.filter((v) => v.id !== valueId);
}

function isLoggedOn(state, habitId, dateISO) {
  return state.logs.some((l) => l.habitId === habitId && l.date === dateISO);
}

function lastNDays(dateISO, n) {
  const days = [];
  const base = new Date(dateISO + 'T00:00:00');
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    days.push(dateToLocalISO(d));
  }
  return days;
}

function last7Days(dateISO) {
  return lastNDays(dateISO, 7);
}

function consistency(state, habitId, dateISO, windowSize) {
  const days = lastNDays(dateISO, windowSize || 7);
  const done = days.filter((d) => isLoggedOn(state, habitId, d)).length;
  return { done, total: days.length, days };
}

function journalEntryForDate(state, dateISO) {
  return state.journal.find((j) => j.date === dateISO && j.type === 'daily');
}

function dayPlanForDate(state, dateISO) {
  return state.dayPlans.find((p) => p.date === dateISO);
}

// ---- Stats helpers ----

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Percent of this value's own achievable check-ins over the window — e.g. a
// daily habit logged 6 of the last 7 days scores ~85% on its own, regardless
// of how many habits other values have. Returns null when there's nothing
// active to measure (caller shows a "no active habit yet" note instead).
function valueAttentionPercent(state, valueId, dateISO, windowSize) {
  const habits = habitsForValue(state, valueId).filter((h) => h.status !== 'completed');
  if (habits.length === 0) return null;
  const days = new Set(lastNDays(dateISO, windowSize || 30));
  const habitIds = new Set(habits.map((h) => h.id));
  const actual = state.logs.filter((l) => habitIds.has(l.habitId) && days.has(l.date)).length;
  const possible = habits.reduce((sum, h) => sum + habitTarget(h, windowSize || 30), 0);
  return possible > 0 ? Math.round((actual / possible) * 100) : null;
}

function habitLogCountForValue(state, valueId) {
  const habitIds = new Set(habitsForValue(state, valueId).map((h) => h.id));
  return state.logs.filter((l) => habitIds.has(l.habitId)).length;
}

function journalCountInRange(state, dateISO, windowSize) {
  const days = new Set(lastNDays(dateISO, windowSize || 30));
  return state.journal.filter((j) => days.has(j.date)).length;
}
