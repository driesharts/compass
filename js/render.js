function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function frequencyLabel(habit) {
  if (habit && habit.frequency) {
    if (habit.frequency.type === 'weekly') return `${habit.frequency.timesPerWeek}x/week`;
    if (habit.frequency.type === 'monthly') return `${habit.frequency.timesPerMonth}x/month`;
  }
  return '';
}

function targetDateInfo(goal) {
  if (!goal.targetDate) return '';
  if (goal.status === 'achieved') {
    return `<div class="goal-date">Target: ${escapeHtml(goal.targetDate)}</div>`;
  }
  const diff = daysBetween(todayISO(), goal.targetDate);
  let label;
  if (diff > 1) label = `${diff} days left`;
  else if (diff === 1) label = '1 day left';
  else if (diff === 0) label = 'today';
  else if (diff === -1) label = '1 day past';
  else label = `${Math.abs(diff)} days past`;
  const overdue = diff < 0;
  return `<div class="goal-date${overdue ? ' goal-date--overdue' : ''}">Target: ${escapeHtml(goal.targetDate)} (${label})</div>`;
}

function consistencyDots(state, habitId, dateISO, windowSize, label) {
  const { done, days } = consistency(state, habitId, dateISO, windowSize);
  const habit = state.habits.find((h) => h.id === habitId);
  const target = habitTarget(habit, windowSize || 7);
  const dots = days
    .map((d) => `<span class="dot ${isLoggedOn(state, habitId, d) ? 'dot--on' : ''}" title="${d}"></span>`)
    .join('');
  const wrapClass = windowSize && windowSize > 7 ? 'dots dots--wrap' : 'dots';
  return `<div class="consistency"><div class="${wrapClass}">${dots}</div><span class="consistency-label">${done}/${target} ${label || 'this week'}</span></div>`;
}

function buildClaudePrompt(state, goal) {
  const value = state.values.find((v) => v.id === goal.valueId);
  const habits = habitsForGoal(state, goal.id);

  const lines = [];
  lines.push("I'd like research-grounded feedback on a personal goal from my habit-tracking app.");
  lines.push('');
  lines.push(`Goal: ${goal.title}`);
  if (value) lines.push(`Value it serves: ${value.name}`);
  if (goal.why) lines.push(`Why it matters to me: ${goal.why}`);
  if (goal.targetDate) lines.push(`Target date: ${goal.targetDate}`);
  if (habits.length) {
    lines.push('');
    lines.push('Habits toward it:');
    habits.forEach((h) => {
      lines.push(`- ${h.name}${h.trigger ? ` (trigger: ${h.trigger})` : ''}`);
    });
  }
  lines.push('');
  lines.push("Questions I'd like help with:");
  lines.push('1. Is this goal well-formed (specific, realistic, well-scoped for me)?');
  lines.push('2. Is there real research on the best approach for this kind of goal that I should know about?');
  lines.push('3. Is there anything about how I’ve set this up that seems off or worth reconsidering?');
  lines.push('');
  lines.push('(Note: if this touches health/medical/financial decisions, treat this as informational, not professional advice.)');
  return lines.join('\n');
}

function monthLabel(dateISO) {
  const [y, m] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function barRow(label, value, max, colorVar) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:var(${colorVar || '--accent'})"></div></div>
      <span class="bar-value">${value}</span>
    </div>
  `;
}

function applyTheme(state) {
  const root = document.documentElement;
  if (state.theme === 'light' || state.theme === 'dark') {
    root.setAttribute('data-theme', state.theme);
  } else {
    root.removeAttribute('data-theme');
  }
  const isDark =
    state.theme === 'dark' ||
    (state.theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark ? '#1e1c18' : '#f6f4ef');
}

// ---------- Views ----------

function renderApp(state) {
  const container = document.getElementById('app');
  const header = document.getElementById('app-header');
  if (!state.onboarded) {
    header.classList.add('hidden');
    container.innerHTML = '';
    container.appendChild(renderOnboarding(state));
    return;
  }
  header.classList.remove('hidden');
  container.innerHTML = '';
  const view = state._view || 'today';
  document.querySelectorAll('.nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'today') container.appendChild(renderToday(state));
  else if (view === 'values') container.appendChild(renderValuesGoals(state));
  else if (view === 'journal') container.appendChild(renderJournal(state));
  else if (view === 'stats') container.appendChild(renderStats(state));
  else if (view === 'history') container.appendChild(renderHistory(state));
  else if (view === 'settings') container.appendChild(renderSettings(state));
}

function renderOnboarding(state) {
  const step = state._onboardStep || 1;
  const wrap = el(`<div class="onboarding"></div>`);

  if (step === 1) {
    wrap.appendChild(
      el(`
      <div class="onboard-card">
        <h1>Compass</h1>
        <p class="lede">A quiet place to track what you're actually trying to become — not just what you did today.</p>
        <p class="muted">You'll pick a few things that matter to you, turn one into a concrete goal when you're ready, and check in on whether it still feels like yours.</p>
        <button class="btn btn-primary" id="ob-start">Get started</button>
      </div>
    `)
    );
    wrap.querySelector('#ob-start').onclick = () => {
      state._onboardStep = 2;
      state._selectedValues = state._selectedValues || [];
      renderApp(state);
    };
    return wrap;
  }

  // step 2: pick values
  const selected = state._selectedValues || [];
  const customEntries = selected
    .filter((name) => !VALUE_SUGGESTIONS.some((v) => v.name === name))
    .map((name) => ({ name, note: 'Added by you.' }));
  const chips = [...VALUE_SUGGESTIONS, ...customEntries]
    .map(
      (v) => `
    <button type="button" class="value-pick ${selected.includes(v.name) ? 'selected' : ''}" data-name="${escapeHtml(v.name)}">
      <strong>${escapeHtml(v.name)}</strong>
      <span>${escapeHtml(v.note)}</span>
    </button>`
    )
    .join('');

  wrap.appendChild(
    el(`
    <div class="onboard-card">
      <h2>What matters to you right now?</h2>
      <p class="muted">Pick a few. You can add your own or change these later.</p>
      <div class="value-grid">${chips}</div>
      <div class="inline-form">
        <input type="text" id="ob-custom-value" placeholder="Add your own..." />
        <button class="btn btn-secondary" id="ob-add-custom">Add</button>
      </div>
      <button class="btn btn-primary" id="ob-finish" ${selected.length === 0 ? 'disabled' : ''}>Continue</button>
    </div>
  `)
  );

  wrap.querySelectorAll('.value-pick').forEach((btn) => {
    btn.onclick = () => {
      const name = btn.dataset.name;
      const i = state._selectedValues.indexOf(name);
      if (i >= 0) state._selectedValues.splice(i, 1);
      else state._selectedValues.push(name);
      renderApp(state);
    };
  });

  wrap.querySelector('#ob-add-custom').onclick = () => {
    const input = wrap.querySelector('#ob-custom-value');
    const name = input.value.trim();
    if (name && !state._selectedValues.includes(name)) {
      state._selectedValues.push(name);
      renderApp(state);
    }
  };

  const finishBtn = wrap.querySelector('#ob-finish');
  if (finishBtn) {
    finishBtn.onclick = () => {
      state._selectedValues.forEach((name) => {
        const suggestion = VALUE_SUGGESTIONS.find((v) => v.name === name);
        state.values.push({
          id: uid(),
          name,
          note: suggestion ? suggestion.note : '',
          createdAt: todayISO(),
        });
      });
      state.onboarded = true;
      state._view = 'values';
      delete state._onboardStep;
      delete state._selectedValues;
      saveState(state);
      renderApp(state);
    };
  }

  return wrap;
}

function renderToday(state) {
  const date = todayISO();
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Today</h1>`));

  const entry = journalEntryForDate(state, date);
  const { text: promptText, category: promptCategory } = promptForDate(state, date);
  const promptCard = el(`
    <div class="card prompt-card">
      <label class="prompt-label">${escapeHtml(promptText)}</label>
      <textarea id="today-journal" placeholder="Optional — a line or two is enough">${escapeHtml(entry ? entry.text : '')}</textarea>
    </div>
  `);
  const ta = promptCard.querySelector('#today-journal');
  ta.addEventListener('blur', () => {
    const text = ta.value.trim();
    let e = journalEntryForDate(state, date);
    if (!text) {
      if (e) state.journal = state.journal.filter((j) => j !== e);
    } else if (e) {
      e.text = text;
      e.prompt = promptText;
      e.category = promptCategory;
    } else {
      state.journal.push({ id: uid(), date, type: 'daily', prompt: promptText, category: promptCategory, text });
    }
    saveState(state);
  });
  wrap.appendChild(promptCard);

  const activeHabits = state.habits.filter((h) => h.status !== 'completed');
  const activeTodos = state.todos.filter((t) => t.status !== 'done');
  if (activeHabits.length === 0 && activeTodos.length === 0) {
    wrap.appendChild(
      el(`
      <div class="empty-state">
        <p>No habits yet.</p>
        <button class="btn btn-primary" id="goto-values">Set up a value and goal</button>
      </div>
    `)
    );
    wrap.querySelector('#goto-values').onclick = () => {
      state._view = 'values';
      renderApp(state);
    };
    return wrap;
  }

  function renderHabitCard(h) {
    const goal = h.goalId ? state.goals.find((g) => g.id === h.goalId) : null;
    const value = !h.goalId ? state.values.find((v) => v.id === h.valueId) : null;
    const logged = isLoggedOn(state, h.id, date);
    const row = el(`
      <div class="card habit-row">
        <div class="habit-main">
          <button class="log-toggle ${logged ? 'logged' : ''}" title="Mark done for today">${logged ? '✓' : ''}</button>
          <div class="habit-text">
            <div class="habit-name">${escapeHtml(h.name)} ${frequencyLabel(h) ? `<span class="chip chip--neutral">${frequencyLabel(h)}</span>` : ''}</div>
            ${h.trigger ? `<div class="habit-trigger">${escapeHtml(h.trigger)}</div>` : ''}
            ${goal ? `<div class="habit-goal">→ ${escapeHtml(goal.title)}</div>` : ''}
            ${value ? `<div class="habit-goal">→ ${escapeHtml(value.name)}</div>` : ''}
          </div>
        </div>
        ${consistencyDots(state, h.id, date)}
      </div>
    `);
    row.querySelector('.log-toggle').onclick = () => {
      if (isLoggedOn(state, h.id, date)) {
        state.logs = state.logs.filter((l) => !(l.habitId === h.id && l.date === date));
      } else {
        state.logs.push({ id: uid(), habitId: h.id, date });
      }
      saveState(state);
      renderApp(state);
    };
    return row;
  }

  function renderTodoCard(t) {
    const goal = state.goals.find((g) => g.id === t.goalId);
    const row = el(`
      <div class="card habit-row">
        <div class="habit-main">
          <button class="log-toggle" title="Mark done"></button>
          <div class="habit-text">
            <div class="habit-name">${escapeHtml(t.title)} <span class="chip chip--neutral">to-do</span></div>
            ${goal ? `<div class="habit-goal">→ ${escapeHtml(goal.title)}</div>` : ''}
          </div>
        </div>
      </div>
    `);
    row.querySelector('.log-toggle').onclick = () => {
      t.status = 'done';
      t.completedAt = todayISO();
      saveState(state);
      renderApp(state);
    };
    return row;
  }

  const groups = new Map();
  const groupFor = (valueId) => {
    const key = valueId || '_other';
    if (!groups.has(key)) groups.set(key, { habits: [], todos: [] });
    return groups.get(key);
  };
  activeHabits.forEach((h) => groupFor(ownerValueId(state, h)).habits.push(h));
  activeTodos.forEach((t) => groupFor(ownerValueId(state, t)).todos.push(t));

  const orderedKeys = [...state.values.map((v) => v.id), '_other'].filter((k) => groups.has(k));
  orderedKeys.forEach((key) => {
    const value = state.values.find((v) => v.id === key);
    const group = groups.get(key);
    wrap.appendChild(el(`<h2 class="today-group-heading">${escapeHtml(value ? value.name : 'Other')}</h2>`));
    const list = el(`<div class="habit-list"></div>`);
    group.habits.forEach((h) => list.appendChild(renderHabitCard(h)));
    group.todos.forEach((t) => list.appendChild(renderTodoCard(t)));
    wrap.appendChild(list);
  });

  return wrap;
}

function renderValuesGoals(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Values &amp; Goals</h1>`));

  const existingNames = new Set(state.values.map((v) => v.name));

  const addValue = (name, note) => {
    if (!name || existingNames.has(name)) return;
    state.values.push({ id: uid(), name, note: note || '', createdAt: todayISO() });
    saveState(state);
    renderApp(state);
  };

  const addValueCard = el(`<div class="card add-value-card"></div>`);

  function renderAddValueCollapsed() {
    addValueCard.innerHTML = '';
    const btn = el(`<button class="btn btn-secondary" id="add-value-toggle">+ Add value</button>`);
    btn.onclick = renderAddValueExpanded;
    addValueCard.appendChild(btn);
  }

  function renderAddValueExpanded() {
    addValueCard.innerHTML = '';
    const available = VALUE_SUGGESTIONS.filter((v) => !existingNames.has(v.name));
    const suggestionChips = available
      .map(
        (v) => `
        <button type="button" class="value-pick" data-name="${escapeHtml(v.name)}">
          <strong>${escapeHtml(v.name)}</strong>
          <span>${escapeHtml(v.note)}</span>
        </button>`
      )
      .join('');
    const inner = el(`
      <div style="width:100%">
        ${available.length ? `<p class="muted small">Add a value</p><div class="value-grid">${suggestionChips}</div>` : ''}
        <div class="inline-form">
          <input type="text" id="new-value-name" placeholder="Add your own..." />
          <button class="btn btn-secondary" id="add-value-btn">Add</button>
        </div>
        <button class="btn btn-tiny" id="add-value-cancel">Cancel</button>
      </div>
    `);
    addValueCard.appendChild(inner);
    addValueCard.querySelectorAll('.value-pick').forEach((btn) => {
      btn.onclick = () => addValue(btn.dataset.name, VALUE_SUGGESTIONS.find((v) => v.name === btn.dataset.name)?.note);
    });
    addValueCard.querySelector('#add-value-btn').onclick = () => {
      const input = addValueCard.querySelector('#new-value-name');
      const name = input.value.trim();
      if (!name) return;
      addValue(name, 'Added by you.');
    };
    addValueCard.querySelector('#add-value-cancel').onclick = renderAddValueCollapsed;
  }

  renderAddValueCollapsed();
  wrap.appendChild(addValueCard);

  const visibleValues = state.values;
  if (visibleValues.length === 0) {
    wrap.appendChild(el(`<div class="empty-state"><p>No values yet. Add one above to get started.</p></div>`));
    return wrap;
  }

  function renderHabitRow(habit, parent) {
    const habitRowEl = el(`
      <div class="habit-sub-row">
        <div class="habit-sub-info">
          <span class="habit-name">${escapeHtml(habit.name)}</span>
          ${frequencyLabel(habit) ? `<span class="chip chip--neutral">${frequencyLabel(habit)}</span>` : ''}
          ${habit.trigger ? `<span class="habit-trigger">${escapeHtml(habit.trigger)}</span>` : ''}
        </div>
        <button class="btn btn-tiny" data-action="edit-habit">Edit</button>
      </div>
    `);
    habitRowEl.querySelector('[data-action="edit-habit"]').onclick = () => openHabitModal(state, parent, habit);
    return habitRowEl;
  }

  function renderTodoRow(todo) {
    const todoRowEl = el(`
      <div class="habit-sub-row todo-row">
        <div class="habit-sub-info">
          <button class="todo-toggle" data-action="complete-todo" title="Mark done"></button>
          <span class="habit-name">${escapeHtml(todo.title)}</span>
        </div>
        <button class="btn btn-tiny" data-action="delete-todo">Delete</button>
      </div>
    `);
    todoRowEl.querySelector('[data-action="complete-todo"]').onclick = () => {
      todo.status = 'done';
      todo.completedAt = todayISO();
      saveState(state);
      renderApp(state);
    };
    todoRowEl.querySelector('[data-action="delete-todo"]').onclick = () => {
      openConfirmModal('Delete this to-do? This cannot be undone.', 'Delete', () => {
        deleteTodo(state, todo.id);
        saveState(state);
        renderApp(state);
      });
    };
    return todoRowEl;
  }

  visibleValues.forEach((v) => {
    const goals = goalsForValue(state, v.id).filter((g) => g.status !== 'achieved');
    const directHabits = directHabitsForValue(state, v.id).filter((h) => h.status !== 'completed');
    const card = el(`
      <div class="card value-card">
        <h2>${escapeHtml(v.name)}</h2>
        ${v.note ? `<p class="muted">${escapeHtml(v.note)}</p>` : ''}
        <div class="actions-row">
          <button class="btn btn-small" data-action="edit-value">Edit</button>
          <button class="btn btn-small" data-action="add-goal">+ Goal</button>
          <button class="btn btn-small" data-action="add-direct-habit">+ Habit</button>
        </div>
        <div class="goal-list"></div>
        <div class="direct-habit-list"></div>
      </div>
    `);
    card.querySelector('[data-action="add-goal"]').onclick = () => openGoalModal(state, v.id);
    card.querySelector('[data-action="edit-value"]').onclick = () => openValueModal(state, v);
    card.querySelector('[data-action="add-direct-habit"]').onclick = () => openHabitModal(state, { valueId: v.id });

    const goalList = card.querySelector('.goal-list');
    if (goals.length === 0) {
      goalList.appendChild(el(`<p class="muted small">No goals under this value yet.</p>`));
    }
    goals.forEach((g) => {
      const habits = habitsForGoal(state, g.id).filter((h) => h.status !== 'completed');
      const todos = todosForGoal(state, g.id).filter((t) => t.status !== 'done');
      const goalEl = el(`
        <div class="goal-card">
          <div class="goal-title">${escapeHtml(g.title)}</div>
          ${targetDateInfo(g)}
          ${g.why ? `<div class="goal-why">${escapeHtml(g.why)}</div>` : ''}
          <div class="actions-row">
            <button class="btn btn-small" data-action="edit-goal">Edit</button>
            <button class="btn btn-small" data-action="copy-claude">Copy for Claude</button>
            <button class="btn btn-small" data-action="add-habit">+ Habit</button>
            <button class="btn btn-small" data-action="add-todo">+ To-do</button>
          </div>
          <div class="habit-sublist"></div>
          <div class="todo-sublist"></div>
        </div>
      `);
      goalEl.querySelector('[data-action="add-habit"]').onclick = () => openHabitModal(state, { goalId: g.id });
      goalEl.querySelector('[data-action="add-todo"]').onclick = () => openTodoModal(state, g.id);
      goalEl.querySelector('[data-action="edit-goal"]').onclick = () => openGoalModal(state, v.id, g);
      const copyBtn = goalEl.querySelector('[data-action="copy-claude"]');
      copyBtn.onclick = () => {
        const text = buildClaudePrompt(state, g);
        navigator.clipboard
          .writeText(text)
          .then(() => {
            const original = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.textContent = original;
            }, 1500);
          })
          .catch(() => {
            openMessageModal('Could not copy automatically. Here is the text:\n\n' + text);
          });
      };
      const sub = goalEl.querySelector('.habit-sublist');
      if (habits.length === 0) {
        sub.appendChild(el(`<p class="muted small">No habits yet.</p>`));
      }
      habits.forEach((h) => sub.appendChild(renderHabitRow(h, { goalId: g.id })));

      const todoSub = goalEl.querySelector('.todo-sublist');
      todos.forEach((t) => todoSub.appendChild(renderTodoRow(t)));

      goalList.appendChild(goalEl);
    });

    const directList = card.querySelector('.direct-habit-list');
    if (directHabits.length > 0) {
      directList.appendChild(el(`<p class="muted small direct-habit-heading">Ongoing habits (not tied to a specific goal)</p>`));
      directHabits.forEach((h) => directList.appendChild(renderHabitRow(h, { valueId: v.id })));
    }

    wrap.appendChild(card);
  });

  return wrap;
}

const JOURNAL_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'retro', label: 'Retrospective' },
  { id: 'future', label: 'Future-self' },
  { id: 'socratic', label: 'Socratic' },
  { id: 'values', label: 'Values' },
  { id: 'motive', label: 'Motive' },
  { id: 'aware', label: 'From your data' },
  { id: 'free', label: 'Free-form' },
];

function renderJournal(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Journal</h1>`));

  const addCard = el(`
    <div class="card">
      <textarea id="new-entry-text" placeholder="Write freely..."></textarea>
      <button class="btn btn-primary" id="add-entry-btn">Add entry</button>
    </div>
  `);
  addCard.querySelector('#add-entry-btn').onclick = () => {
    const ta = addCard.querySelector('#new-entry-text');
    const text = ta.value.trim();
    if (!text) return;
    state.journal.push({ id: uid(), date: todayISO(), type: 'free', category: 'free', text });
    saveState(state);
    renderApp(state);
  };
  wrap.appendChild(addCard);

  if (state.journal.length === 0) {
    wrap.appendChild(el(`<div class="empty-state"><p>No entries yet.</p></div>`));
    return wrap;
  }

  const filter = { category: 'all', search: '' };
  const entryCategory = (e) => e.category || (e.type === 'free' ? 'free' : 'retro');

  const controls = el(`
    <div class="card journal-controls">
      <input type="text" id="journal-search" placeholder="Search entries..." />
      <div class="filter-chips">
        ${JOURNAL_CATEGORIES.map((c) => `<button type="button" class="filter-chip ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.label)}</button>`).join('')}
      </div>
    </div>
  `);
  wrap.appendChild(controls);

  const listContainer = el(`<div class="journal-list"></div>`);
  wrap.appendChild(listContainer);

  function update() {
    const searchLower = filter.search.trim().toLowerCase();
    const entries = [...state.journal]
      .filter((e) => filter.category === 'all' || entryCategory(e) === filter.category)
      .filter((e) => !searchLower || (e.text || '').toLowerCase().includes(searchLower) || (e.prompt || '').toLowerCase().includes(searchLower))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    listContainer.innerHTML = '';
    if (entries.length === 0) {
      listContainer.appendChild(el(`<div class="empty-state"><p>No entries match.</p></div>`));
      return;
    }
    let currentMonth = '';
    entries.forEach((e) => {
      const month = monthLabel(e.date);
      if (month !== currentMonth) {
        currentMonth = month;
        listContainer.appendChild(el(`<div class="journal-month">${escapeHtml(month)}</div>`));
      }
      listContainer.appendChild(
        el(`
        <div class="card journal-entry">
          <div class="journal-date">${escapeHtml(e.date)}</div>
          ${e.prompt ? `<div class="journal-prompt">${escapeHtml(e.prompt)}</div>` : ''}
          <div class="journal-text">${escapeHtml(e.text)}</div>
        </div>
      `)
      );
    });
  }

  controls.querySelector('#journal-search').addEventListener('input', (e) => {
    filter.search = e.target.value;
    update();
  });
  controls.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.onclick = () => {
      filter.category = btn.dataset.cat;
      controls.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      update();
    };
  });

  update();
  return wrap;
}

function renderStats(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Statistics</h1>`));

  if (state.values.length === 0 && state.habits.length === 0) {
    wrap.appendChild(el(`<div class="empty-state"><p>Nothing to show yet — add a value, goal, and habit first.</p></div>`));
    return wrap;
  }

  const date = todayISO();
  const daysActive = Math.max(1, daysBetween(state.createdAt, date) + 1);

  const activeHabits = state.habits.filter((h) => h.status !== 'completed');
  const activeTodos = state.todos.filter((t) => t.status !== 'done');

  const tiles = el(`
    <div class="stat-tiles">
      <div class="stat-tile"><div class="stat-tile-value">${state.values.length}</div><div class="stat-tile-label">Values</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${state.goals.length}</div><div class="stat-tile-label">Goals</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${activeHabits.length}</div><div class="stat-tile-label">Habits</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${activeTodos.length}</div><div class="stat-tile-label">To-dos</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${journalCountInRange(state, date, 30)}</div><div class="stat-tile-label">Journal entries (30d)</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${daysActive}</div><div class="stat-tile-label">Days using Compass</div></div>
    </div>
  `);
  wrap.appendChild(tiles);

  if (activeHabits.length > 0) {
    const card = el(`<div class="card"><h2>Consistency, last 30 days</h2></div>`);
    const groups = new Map();
    activeHabits.forEach((h) => {
      const key = ownerValueId(state, h) || '_other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(h);
    });
    const orderedKeys = [...state.values.map((v) => v.id), '_other'].filter((k) => groups.has(k));
    orderedKeys.forEach((key) => {
      const value = state.values.find((v) => v.id === key);
      card.appendChild(el(`<p class="stat-group-heading">${escapeHtml(value ? value.name : 'Other')}</p>`));
      const list = el(`<div class="stat-habit-list"></div>`);
      groups.get(key).forEach((h) => {
        list.appendChild(
          el(`
          <div class="stat-habit-row">
            <span class="habit-name">${escapeHtml(h.name)} ${frequencyLabel(h) ? `<span class="chip chip--neutral">${frequencyLabel(h)}</span>` : ''}</span>
            ${consistencyDots(state, h.id, date, 30, 'last 30 days')}
          </div>
        `)
        );
      });
      card.appendChild(list);
    });
    wrap.appendChild(card);
  }

  const statsValues = state.values;
  if (statsValues.length > 0) {
    const activity = statsValues.map((v) => ({
      name: v.name,
      count: valueActivityCount(state, v.id, date, 30),
      hasHabit: valueHasActiveHabit(state, v.id),
    }));
    const max = Math.max(1, ...activity.filter((a) => a.hasHabit).map((a) => a.count));
    const rows = activity
      .map((a) =>
        a.hasHabit
          ? barRow(a.name, a.count, max, '--accent')
          : `<div class="bar-row bar-row--empty"><span class="bar-label">${escapeHtml(a.name)}</span><span class="bar-empty-note">No active habit yet</span></div>`
      )
      .join('');
    const card = el(`
      <div class="card">
        <h2>Where your attention went, last 30 days</h2>
        <p class="muted small">Habit check-ins per value. Not a score — just a mirror on balance.</p>
        <div class="bar-list">${rows}</div>
      </div>
    `);
    wrap.appendChild(card);
  }

  return wrap;
}

function renderHistory(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>History</h1>`));
  wrap.appendChild(el(`<p class="muted small">Achieved goals, and habits or to-dos you've marked complete — kept here instead of cluttering the active views.</p>`));

  function historyRow(name, type, completedAt, onDelete) {
    const row = el(`
      <div class="habit-sub-row">
        <div class="habit-sub-info">
          <span class="habit-name">✓ ${escapeHtml(name)}</span>
          <span class="chip chip--neutral">${escapeHtml(type)}</span>
          ${completedAt ? `<span class="muted small">completed ${escapeHtml(completedAt)}</span>` : ''}
        </div>
        <button class="btn btn-tiny" data-action="delete">Delete</button>
      </div>
    `);
    row.querySelector('[data-action="delete"]').onclick = onDelete;
    return row;
  }

  let anySection = false;

  state.values.forEach((v) => {
    const goals = goalsForValue(state, v.id);
    const relevantGoals = goals.filter(
      (g) =>
        g.status === 'achieved' ||
        habitsForGoal(state, g.id).some((h) => h.status === 'completed') ||
        todosForGoal(state, g.id).some((t) => t.status === 'done')
    );
    const directCompletedHabits = directHabitsForValue(state, v.id).filter((h) => h.status === 'completed');

    if (relevantGoals.length === 0 && directCompletedHabits.length === 0) return;
    anySection = true;

    const card = el(`
      <div class="card value-card">
        <h2>${escapeHtml(v.name)}</h2>
        <div class="goal-list"></div>
        <div class="direct-habit-list"></div>
      </div>
    `);
    const goalList = card.querySelector('.goal-list');

    relevantGoals.forEach((g) => {
      const achieved = g.status === 'achieved';
      const completedHabits = habitsForGoal(state, g.id).filter((h) => h.status === 'completed');
      const doneTodos = todosForGoal(state, g.id).filter((t) => t.status === 'done');
      const goalEl = el(`
        <div class="goal-card">
          <div class="goal-header-row">
            <div class="goal-title">${escapeHtml(g.title)} ${achieved ? '<span class="chip chip--achieved">✓ Achieved</span>' : ''}</div>
            <button class="btn btn-tiny" data-action="edit-goal">Edit</button>
          </div>
          <div class="habit-sublist"></div>
        </div>
      `);
      goalEl.querySelector('[data-action="edit-goal"]').onclick = () => openGoalModal(state, v.id, g);
      const sub = goalEl.querySelector('.habit-sublist');
      completedHabits.forEach((h) => {
        sub.appendChild(
          historyRow(h.name, 'habit', h.completedAt, () => {
            openConfirmModal('Delete this habit permanently?', 'Delete', () => {
              deleteHabit(state, h.id);
              saveState(state);
              renderApp(state);
            });
          })
        );
      });
      doneTodos.forEach((t) => {
        sub.appendChild(
          historyRow(t.title, 'to-do', t.completedAt, () => {
            openConfirmModal('Delete this to-do permanently?', 'Delete', () => {
              deleteTodo(state, t.id);
              saveState(state);
              renderApp(state);
            });
          })
        );
      });
      goalList.appendChild(goalEl);
    });

    const directList = card.querySelector('.direct-habit-list');
    if (directCompletedHabits.length > 0) {
      directList.appendChild(el(`<p class="muted small direct-habit-heading">Completed ongoing habits</p>`));
      directCompletedHabits.forEach((h) => {
        directList.appendChild(
          historyRow(h.name, 'habit', h.completedAt, () => {
            openConfirmModal('Delete this habit permanently?', 'Delete', () => {
              deleteHabit(state, h.id);
              saveState(state);
              renderApp(state);
            });
          })
        );
      });
    }

    wrap.appendChild(card);
  });

  if (!anySection) {
    wrap.appendChild(el(`<div class="empty-state"><p>Nothing here yet — achieved goals and completed habits or to-dos will show up here.</p></div>`));
  }

  return wrap;
}

function renderSettings(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Settings</h1>`));

  const theme = state.theme || 'system';
  const themeCard = el(`
    <div class="card">
      <h2>Appearance</h2>
      <div class="filter-chips">
        <button type="button" class="filter-chip ${theme === 'system' ? 'active' : ''}" data-theme-choice="system">System</button>
        <button type="button" class="filter-chip ${theme === 'light' ? 'active' : ''}" data-theme-choice="light">Light</button>
        <button type="button" class="filter-chip ${theme === 'dark' ? 'active' : ''}" data-theme-choice="dark">Dark</button>
      </div>
    </div>
  `);
  themeCard.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.onclick = () => {
      state.theme = btn.dataset.themeChoice;
      saveState(state);
      applyTheme(state);
      renderApp(state);
    };
  });
  wrap.appendChild(themeCard);

  const card = el(`
    <div class="card">
      <p class="muted">Everything is stored locally in this browser. No account, no server.</p>
      <div class="settings-actions">
        <button class="btn btn-secondary" id="export-btn">Export data (JSON)</button>
        <label class="btn btn-secondary file-btn">Import data
          <input type="file" id="import-input" accept="application/json" hidden />
        </label>
        <button class="btn btn-danger" id="reset-btn">Reset all data</button>
      </div>
    </div>
  `);

  card.querySelector('#export-btn').onclick = () => {
    const exportable = {};
    Object.keys(state).forEach((k) => {
      if (!k.startsWith('_')) exportable[k] = state[k];
    });
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compass-export-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  card.querySelector('#import-input').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    openConfirmModal('Importing will replace all current data in this browser with the contents of this file. Continue?', 'Import', () => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          Object.assign(state, defaultState(), imported);
          saveState(state);
          renderApp(state);
        } catch (e) {
          openMessageModal('Could not read that file.');
        }
      };
      reader.readAsText(file);
    });
  });

  card.querySelector('#reset-btn').onclick = () => {
    openConfirmModal('This deletes everything stored locally. Are you sure?', 'Delete everything', () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });
  };

  wrap.appendChild(card);
  return wrap;
}

// ---------- Modals ----------

function openModal(contentEl) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = el(`<div class="modal-overlay"><div class="modal"></div></div>`);
  overlay.querySelector('.modal').appendChild(contentEl);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  root.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

// Native confirm()/alert() are silently suppressed in some hosting contexts
// (e.g. the Claude Code browser pane), so destructive actions use these instead.
function openConfirmModal(message, confirmLabel, onConfirm) {
  const content = el(`
    <div class="modal-body">
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-yes">${escapeHtml(confirmLabel || 'Confirm')}</button>
      </div>
    </div>
  `);
  content.querySelector('#confirm-cancel').onclick = closeModal;
  content.querySelector('#confirm-yes').onclick = () => {
    closeModal();
    onConfirm();
  };
  openModal(content);
}

function openMessageModal(message) {
  const content = el(`
    <div class="modal-body">
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn btn-primary" id="message-ok">OK</button>
      </div>
    </div>
  `);
  content.querySelector('#message-ok').onclick = closeModal;
  openModal(content);
}

function openGoalModal(state, valueId, existingGoal) {
  const isEdit = !!existingGoal;

  const content = el(`
    <div class="modal-body">
      <h2>${isEdit ? 'Edit goal' : 'New goal'}</h2>
      <label>Title</label>
      <input type="text" id="g-title" placeholder="e.g. Watch a Netflix show in Spanish without subtitles" value="${isEdit ? escapeHtml(existingGoal.title) : ''}" />
      <label>Why does this matter to you?</label>
      <textarea id="g-why" placeholder="Write a sentence or two">${isEdit ? escapeHtml(existingGoal.why || '') : ''}</textarea>
      <label>Target date</label>
      <input type="date" id="g-date" value="${isEdit ? escapeHtml(existingGoal.targetDate || '') : ''}" />
      <div class="modal-actions modal-actions--split">
        <div class="modal-actions-left">
          ${isEdit && existingGoal.status !== 'achieved' ? '<button class="btn btn-secondary" id="g-achieve">Mark as achieved</button>' : ''}
          ${isEdit ? '<button class="btn btn-danger" id="g-delete">Delete</button>' : ''}
        </div>
        <div class="modal-actions-right">
          <button class="btn btn-secondary" id="g-cancel">Cancel</button>
          <button class="btn btn-primary" id="g-save">${isEdit ? 'Save changes' : 'Save goal'}</button>
        </div>
      </div>
    </div>
  `);

  content.querySelector('#g-cancel').onclick = closeModal;
  content.querySelector('#g-save').onclick = () => {
    const title = content.querySelector('#g-title').value.trim();
    if (!title) return;
    const why = content.querySelector('#g-why').value.trim();
    const targetDate = content.querySelector('#g-date').value;
    if (isEdit) {
      Object.assign(existingGoal, { title, why, targetDate });
    } else {
      state.goals.push({
        id: uid(),
        valueId,
        title,
        why,
        targetDate,
        status: 'active',
        createdAt: todayISO(),
      });
    }
    saveState(state);
    closeModal();
    renderApp(state);
  };

  if (isEdit) {
    const achieveBtn = content.querySelector('#g-achieve');
    if (achieveBtn) {
      achieveBtn.onclick = () => {
        existingGoal.status = 'achieved';
        saveState(state);
        closeModal();
        renderApp(state);
      };
    }
    content.querySelector('#g-delete').onclick = () => {
      openConfirmModal('Delete this goal? This cannot be undone — its habits will be deleted too.', 'Delete', () => {
        deleteGoal(state, existingGoal.id);
        saveState(state);
        renderApp(state);
      });
    };
  }

  openModal(content);
}

function openHabitModal(state, parent, existingHabit) {
  const isEdit = !!existingHabit;
  const freqType = isEdit && existingHabit.frequency ? existingHabit.frequency.type : 'daily';
  const timesPerWeek = freqType === 'weekly' ? existingHabit.frequency.timesPerWeek : 2;
  const timesPerMonth = freqType === 'monthly' ? existingHabit.frequency.timesPerMonth : 2;

  const content = el(`
    <div class="modal-body">
      <h2>${isEdit ? 'Edit habit' : 'New habit'}</h2>
      <label>Name</label>
      <input type="text" id="h-name" placeholder="e.g. Spanish practice" value="${isEdit ? escapeHtml(existingHabit.name) : ''}" />
      <label>Trigger <span class="muted small">(if-then plan)</span></label>
      <input type="text" id="h-trigger" placeholder="If it's 8pm, then I do 20 min of Spanish" value="${isEdit ? escapeHtml(existingHabit.trigger || '') : ''}" />
      <label>Frequency</label>
      <select id="h-frequency-type">
        <option value="daily" ${freqType === 'daily' ? 'selected' : ''}>Daily</option>
        <option value="weekly" ${freqType === 'weekly' ? 'selected' : ''}>A few times a week</option>
        <option value="monthly" ${freqType === 'monthly' ? 'selected' : ''}>A few times a month</option>
      </select>
      <div id="h-weekly-count" style="${freqType === 'weekly' ? '' : 'display:none;'}">
        <label>How many times a week?</label>
        <input type="number" id="h-times-per-week" min="1" max="7" value="${timesPerWeek}" />
      </div>
      <div id="h-monthly-count" style="${freqType === 'monthly' ? '' : 'display:none;'}">
        <label>How many times a month?</label>
        <input type="number" id="h-times-per-month" min="1" max="30" value="${timesPerMonth}" />
      </div>
      <div class="modal-actions modal-actions--split">
        <div class="modal-actions-left">
          ${isEdit && existingHabit.status !== 'completed' ? '<button class="btn btn-secondary" id="h-complete">Mark as completed</button>' : ''}
          ${isEdit ? '<button class="btn btn-danger" id="h-delete">Delete</button>' : ''}
        </div>
        <div class="modal-actions-right">
          <button class="btn btn-secondary" id="h-cancel">Cancel</button>
          <button class="btn btn-primary" id="h-save">${isEdit ? 'Save changes' : 'Save habit'}</button>
        </div>
      </div>
    </div>
  `);
  content.querySelector('#h-frequency-type').addEventListener('change', (e) => {
    content.querySelector('#h-weekly-count').style.display = e.target.value === 'weekly' ? '' : 'none';
    content.querySelector('#h-monthly-count').style.display = e.target.value === 'monthly' ? '' : 'none';
  });
  content.querySelector('#h-cancel').onclick = closeModal;
  content.querySelector('#h-save').onclick = () => {
    const name = content.querySelector('#h-name').value.trim();
    if (!name) return;
    const trigger = content.querySelector('#h-trigger').value.trim();
    const frequencyType = content.querySelector('#h-frequency-type').value;
    let frequency = { type: 'daily' };
    if (frequencyType === 'weekly') {
      frequency = { type: 'weekly', timesPerWeek: Math.max(1, Math.min(7, Number(content.querySelector('#h-times-per-week').value) || 1)) };
    } else if (frequencyType === 'monthly') {
      frequency = { type: 'monthly', timesPerMonth: Math.max(1, Math.min(30, Number(content.querySelector('#h-times-per-month').value) || 1)) };
    }
    if (isEdit) {
      Object.assign(existingHabit, { name, trigger, frequency });
    } else {
      state.habits.push({
        id: uid(),
        goalId: parent.goalId || null,
        valueId: parent.goalId ? null : parent.valueId,
        name,
        trigger,
        frequency,
        status: 'active',
        createdAt: todayISO(),
      });
    }
    saveState(state);
    closeModal();
    renderApp(state);
  };
  if (isEdit) {
    const completeBtn = content.querySelector('#h-complete');
    if (completeBtn) {
      completeBtn.onclick = () => {
        existingHabit.status = 'completed';
        existingHabit.completedAt = todayISO();
        saveState(state);
        closeModal();
        renderApp(state);
      };
    }
    content.querySelector('#h-delete').onclick = () => {
      openConfirmModal('Delete this habit? This cannot be undone — its log history will be deleted too.', 'Delete', () => {
        deleteHabit(state, existingHabit.id);
        saveState(state);
        renderApp(state);
      });
    };
  }
  openModal(content);
}

function openTodoModal(state, goalId) {
  const content = el(`
    <div class="modal-body">
      <h2>New to-do</h2>
      <label>What needs doing?</label>
      <input type="text" id="t-title" placeholder="e.g. Sign up for the race" />
      <div class="modal-actions">
        <button class="btn btn-secondary" id="t-cancel">Cancel</button>
        <button class="btn btn-primary" id="t-save">Save to-do</button>
      </div>
    </div>
  `);
  content.querySelector('#t-cancel').onclick = closeModal;
  content.querySelector('#t-save').onclick = () => {
    const title = content.querySelector('#t-title').value.trim();
    if (!title) return;
    state.todos.push({ id: uid(), goalId, title, status: 'active', createdAt: todayISO() });
    saveState(state);
    closeModal();
    renderApp(state);
  };
  openModal(content);
}

function openValueModal(state, value) {
  const content = el(`
    <div class="modal-body">
      <h2>Edit value</h2>
      <label>Name</label>
      <input type="text" id="v-name" value="${escapeHtml(value.name)}" />
      <label>Note</label>
      <textarea id="v-note">${escapeHtml(value.note || '')}</textarea>
      <div class="modal-actions modal-actions--split">
        <div class="modal-actions-left">
          <button class="btn btn-danger" id="v-delete">Delete</button>
        </div>
        <div class="modal-actions-right">
          <button class="btn btn-secondary" id="v-cancel">Cancel</button>
          <button class="btn btn-primary" id="v-save">Save changes</button>
        </div>
      </div>
    </div>
  `);
  content.querySelector('#v-cancel').onclick = closeModal;
  content.querySelector('#v-save').onclick = () => {
    const name = content.querySelector('#v-name').value.trim();
    if (!name) return;
    value.name = name;
    value.note = content.querySelector('#v-note').value.trim();
    saveState(state);
    closeModal();
    renderApp(state);
  };
  content.querySelector('#v-delete').onclick = () => {
    openConfirmModal('Delete this value? This cannot be undone — its goals and habits will be deleted too.', 'Delete', () => {
      deleteValue(state, value.id);
      saveState(state);
      renderApp(state);
    });
  };
  openModal(content);
}
