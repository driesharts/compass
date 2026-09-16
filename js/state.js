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
    .filter((h) => daysBetween(h.createdAt, dateISO) >= 7)
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
    logs: [],
    journal: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
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

function goalsForValue(state, valueId) {
  return state.goals.filter((g) => g.valueId === valueId);
}

function valueHasActiveHabit(state, valueId) {
  const goalIds = new Set(goalsForValue(state, valueId).map((g) => g.id));
  return state.habits.some((h) => goalIds.has(h.goalId));
}

function habitTarget(habit, windowSize) {
  const days = windowSize || 7;
  if (habit && habit.frequency && habit.frequency.type === 'weekly') {
    return Math.max(1, Math.round(habit.frequency.timesPerWeek * (days / 7)));
  }
  return days;
}

function deleteHabit(state, habitId) {
  state.habits = state.habits.filter((h) => h.id !== habitId);
  state.logs = state.logs.filter((l) => l.habitId !== habitId);
}

function deleteGoal(state, goalId) {
  state.habits.filter((h) => h.goalId === goalId).forEach((h) => deleteHabit(state, h.id));
  state.goals = state.goals.filter((g) => g.id !== goalId);
}

function deleteValue(state, valueId) {
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

// ---- Stats helpers ----

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function valueActivityCount(state, valueId, dateISO, windowSize) {
  const days = new Set(lastNDays(dateISO, windowSize || 30));
  const goalIds = new Set(goalsForValue(state, valueId).map((g) => g.id));
  const habitIds = state.habits.filter((h) => goalIds.has(h.goalId)).map((h) => h.id);
  return state.logs.filter((l) => habitIds.includes(l.habitId) && days.has(l.date)).length;
}

function journalCountInRange(state, dateISO, windowSize) {
  const days = new Set(lastNDays(dateISO, windowSize || 30));
  return state.journal.filter((j) => days.has(j.date)).length;
}
