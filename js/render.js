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

function monthLabel(dateISO) {
  const [y, m] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function percentBar(label, percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  return `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${clamped}%"></div></div>
      <span class="bar-value">${percent}%</span>
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

function goalTagLabel(state, item) {
  if (!item.goalId) return '';
  const goal = state.goals.find((g) => g.id === item.goalId);
  return goal ? `<span class="chip chip--neutral">→ ${escapeHtml(goal.title)}</span>` : '';
}

function backLinkEl(label, onClick) {
  const link = el(`<button type="button" class="back-link">${escapeHtml(label)}</button>`);
  link.onclick = onClick;
  return link;
}

// ---------- Navigation ----------

function goToValuesIndex(state) {
  state._view = 'values';
  renderApp(state);
}

function goToValue(state, valueId) {
  state._view = 'value-detail';
  state._currentValueId = valueId;
  renderApp(state);
}

function goToGoal(state, goalId, valueId) {
  state._view = 'goal-detail';
  state._currentGoalId = goalId;
  state._currentValueId = valueId;
  renderApp(state);
}

// ---------- Shared row renderers (Value detail + Goal detail) ----------

function renderValueHabitRow(state, h) {
  const date = todayISO();
  const logged = isLoggedOn(state, h.id, date);
  const row = el(`
    <div class="card habit-row">
      <div class="habit-main">
        <button class="log-toggle ${logged ? 'logged' : ''}" title="Mark done for today">${logged ? '✓' : ''}</button>
        <div class="habit-text">
          <div class="habit-name">${escapeHtml(h.name)} ${frequencyLabel(h) ? `<span class="chip chip--neutral">${frequencyLabel(h)}</span>` : ''} ${goalTagLabel(state, h)}</div>
          ${h.trigger ? `<div class="habit-trigger">${escapeHtml(h.trigger)}</div>` : ''}
        </div>
      </div>
      <div class="habit-row-end">
        ${consistencyDots(state, h.id, date)}
        <button class="btn btn-tiny" data-action="edit">Edit</button>
      </div>
    </div>
  `);
  row.querySelector('.log-toggle').onclick = () => {
    if (isLoggedOn(state, h.id, date)) {
      state.logs = state.logs.filter((l) => !(l.habitId === h.id && l.date === date));
      saveState(state);
      showToast('Unlogged');
    } else {
      state.logs.push({ id: uid(), habitId: h.id, date });
      saveState(state);
      showToast(`Logged "${h.name}"`);
    }
    renderApp(state);
  };
  row.querySelector('[data-action="edit"]').onclick = () => openHabitModal(state, h.valueId, h);
  return row;
}

function renderValueTodoRow(state, t) {
  const row = el(`
    <div class="card habit-row">
      <div class="habit-main">
        <button class="todo-toggle" data-action="complete" title="Mark done"></button>
        <div class="habit-text">
          <div class="habit-name">${escapeHtml(t.title)} ${goalTagLabel(state, t)}</div>
        </div>
      </div>
      <button class="btn btn-tiny" data-action="delete">Delete</button>
    </div>
  `);
  row.querySelector('[data-action="complete"]').onclick = () => {
    t.status = 'done';
    t.completedAt = todayISO();
    saveState(state);
    showToast(`"${t.title}" marked done`);
    renderApp(state);
  };
  row.querySelector('[data-action="delete"]').onclick = () => {
    openConfirmModal('Delete this to-do? This cannot be undone.', 'Delete', () => {
      deleteTodo(state, t.id);
      saveState(state);
      showToast('To-do deleted');
      renderApp(state);
    });
  };
  return row;
}

// ---------- Views ----------

const KNOWN_VIEWS = ['today', 'values', 'value-detail', 'goal-detail', 'journal', 'stats', 'achievements', 'settings'];

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
  const view = KNOWN_VIEWS.includes(state._view) ? state._view : 'today';
  const navHighlight = view === 'value-detail' || view === 'goal-detail' ? 'values' : view;
  document.querySelectorAll('.nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === navHighlight));

  if (view === 'today') container.appendChild(renderToday(state));
  else if (view === 'values') container.appendChild(renderValuesIndex(state));
  else if (view === 'value-detail') container.appendChild(renderValueDetail(state, state._currentValueId));
  else if (view === 'goal-detail') container.appendChild(renderGoalDetail(state, state._currentGoalId));
  else if (view === 'journal') container.appendChild(renderJournal(state));
  else if (view === 'stats') container.appendChild(renderStats(state));
  else if (view === 'achievements') container.appendChild(renderAchievements(state));
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

  const todaysPlan = dayPlanForDate(state, date);
  const todayPlanCard = el(`
    <div class="card">
      <label class="prompt-label">What did you want to get done today?</label>
      ${
        todaysPlan
          ? `
        <div class="plan-display">
          <button class="log-toggle ${todaysPlan.completed ? 'logged' : ''}" title="Mark as done">${todaysPlan.completed ? '✓' : ''}</button>
          <div class="plan-text ${todaysPlan.completed ? 'plan-text--done' : ''}">${escapeHtml(todaysPlan.text)}</div>
        </div>
      `
          : `<p class="muted small">You didn't write a plan for today yesterday.</p>`
      }
    </div>
  `);
  if (todaysPlan) {
    todayPlanCard.querySelector('.log-toggle').onclick = () => {
      todaysPlan.completed = !todaysPlan.completed;
      saveState(state);
      showToast(todaysPlan.completed ? 'Nice, stuck to your plan' : 'Marked not done');
      renderApp(state);
    };
  }
  wrap.appendChild(todayPlanCard);

  const tomorrowDate = tomorrowISO();
  const tomorrowsPlan = dayPlanForDate(state, tomorrowDate);
  const tomorrowPlanCard = el(`
    <div class="card">
      <label class="prompt-label">What do you want to get done tomorrow?</label>
      <textarea id="tomorrow-plan" placeholder="Optional — jot down a plan, whenever you write it">${escapeHtml(tomorrowsPlan ? tomorrowsPlan.text : '')}</textarea>
    </div>
  `);
  const tomorrowTa = tomorrowPlanCard.querySelector('#tomorrow-plan');
  tomorrowTa.addEventListener('blur', () => {
    const text = tomorrowTa.value.trim();
    let p = dayPlanForDate(state, tomorrowDate);
    if (!text) {
      if (p) state.dayPlans = state.dayPlans.filter((x) => x !== p);
    } else if (p) {
      p.text = text;
    } else {
      state.dayPlans.push({ id: uid(), date: tomorrowDate, text, completed: false });
    }
    saveState(state);
  });
  wrap.appendChild(tomorrowPlanCard);

  wrap.appendChild(el(`<h2 class="section-heading">Completed today</h2>`));

  const loggedToday = state.logs.filter((l) => l.date === date);
  const habitsCompletedToday = loggedToday.map((l) => state.habits.find((h) => h.id === l.habitId)).filter(Boolean);
  const todosCompletedToday = state.todos.filter((t) => t.status === 'done' && t.completedAt === date);

  if (habitsCompletedToday.length === 0 && todosCompletedToday.length === 0) {
    wrap.appendChild(
      el(`
      <div class="empty-state">
        <p>Nothing checked off yet today.</p>
        <button class="btn btn-primary" id="goto-values">Go to your values</button>
      </div>
    `)
    );
    wrap.querySelector('#goto-values').onclick = () => goToValuesIndex(state);
    return wrap;
  }

  const groups = new Map();
  const groupFor = (valueId) => {
    const key = valueId || '_other';
    if (!groups.has(key)) groups.set(key, { habits: [], todos: [] });
    return groups.get(key);
  };
  habitsCompletedToday.forEach((h) => groupFor(h.valueId).habits.push(h));
  todosCompletedToday.forEach((t) => groupFor(t.valueId).todos.push(t));

  const orderedKeys = [...state.values.map((v) => v.id), '_other'].filter((k) => groups.has(k));
  orderedKeys.forEach((key) => {
    const value = state.values.find((v) => v.id === key);
    const group = groups.get(key);
    wrap.appendChild(el(`<h3 class="today-group-heading">${escapeHtml(value ? value.name : 'Other')}</h3>`));
    const list = el(`<div class="habit-list"></div>`);
    group.habits.forEach((h) =>
      list.appendChild(el(`<div class="card habit-row habit-row--done"><span class="habit-name">✓ ${escapeHtml(h.name)}</span></div>`))
    );
    group.todos.forEach((t) =>
      list.appendChild(
        el(`<div class="card habit-row habit-row--done"><span class="habit-name">✓ ${escapeHtml(t.title)} <span class="chip chip--neutral">to-do</span></span></div>`)
      )
    );
    wrap.appendChild(list);
  });

  return wrap;
}

function renderValuesIndex(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Values</h1>`));

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

  if (state.values.length === 0) {
    wrap.appendChild(el(`<div class="empty-state"><p>No values yet. Add one above to get started.</p></div>`));
    return wrap;
  }

  const grid = el(`<div class="value-index-grid"></div>`);
  state.values.forEach((v) => {
    const goals = goalsForValue(state, v.id).filter((g) => g.status !== 'achieved');
    const habits = habitsForValue(state, v.id).filter((h) => h.status !== 'completed');
    const todos = todosForValue(state, v.id).filter((t) => t.status !== 'done');
    const summary = [`${goals.length} goal${goals.length === 1 ? '' : 's'}`, `${habits.length} habit${habits.length === 1 ? '' : 's'}`];
    if (todos.length > 0) summary.push(`${todos.length} to-do${todos.length === 1 ? '' : 's'}`);
    const card = el(`
      <button type="button" class="card value-index-card">
        <h2>${escapeHtml(v.name)}</h2>
        ${v.note ? `<p class="muted small">${escapeHtml(v.note)}</p>` : ''}
        <p class="muted small value-summary-count">${summary.join(' · ')}</p>
      </button>
    `);
    card.onclick = () => goToValue(state, v.id);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);

  return wrap;
}

function renderValueDetail(state, valueId) {
  const value = state.values.find((v) => v.id === valueId);
  const wrap = el(`<div class="view"></div>`);

  if (!value) {
    wrap.appendChild(backLinkEl('← All values', () => goToValuesIndex(state)));
    wrap.appendChild(el(`<p class="muted">This value no longer exists.</p>`));
    return wrap;
  }

  wrap.appendChild(backLinkEl('← All values', () => goToValuesIndex(state)));
  wrap.appendChild(el(`<h1>${escapeHtml(value.name)}</h1>`));
  if (value.note) wrap.appendChild(el(`<p class="muted">${escapeHtml(value.note)}</p>`));

  const actionsRow = el(`
    <div class="actions-row">
      <button class="btn btn-small" data-action="edit-value">Edit</button>
      <button class="btn btn-small" data-action="add-goal">+ Goal</button>
      <button class="btn btn-small" data-action="add-habit">+ Habit</button>
      <button class="btn btn-small" data-action="add-todo">+ To-do</button>
    </div>
  `);
  actionsRow.querySelector('[data-action="edit-value"]').onclick = () => openValueModal(state, value);
  actionsRow.querySelector('[data-action="add-goal"]').onclick = () => openGoalModal(state, value.id);
  actionsRow.querySelector('[data-action="add-habit"]').onclick = () => openHabitModal(state, value.id);
  actionsRow.querySelector('[data-action="add-todo"]').onclick = () => openTodoModal(state, value.id);
  wrap.appendChild(actionsRow);

  const todos = todosForValue(state, value.id).filter((t) => t.status !== 'done');
  wrap.appendChild(el(`<h2 class="section-heading">To-do's</h2>`));
  if (todos.length === 0) {
    wrap.appendChild(el(`<p class="muted small">No to-dos yet.</p>`));
  } else {
    const todoList = el(`<div class="habit-list"></div>`);
    todos.forEach((t) => todoList.appendChild(renderValueTodoRow(state, t)));
    wrap.appendChild(todoList);
  }

  const habits = habitsForValue(state, value.id)
    .filter((h) => h.status !== 'completed')
    .sort((a, b) => habitFrequencyRank(a) - habitFrequencyRank(b));
  wrap.appendChild(el(`<h2 class="section-heading">Habits</h2>`));
  if (habits.length === 0) {
    wrap.appendChild(el(`<p class="muted small">No habits yet.</p>`));
  } else {
    const habitList = el(`<div class="habit-list"></div>`);
    habits.forEach((h) => habitList.appendChild(renderValueHabitRow(state, h)));
    wrap.appendChild(habitList);
  }

  const goals = goalsForValue(state, value.id).filter((g) => g.status !== 'achieved');
  wrap.appendChild(el(`<h2 class="section-heading">Goals</h2>`));
  if (goals.length === 0) {
    wrap.appendChild(el(`<p class="muted small">No goals yet.</p>`));
  } else {
    const goalList = el(`<div class="goal-list"></div>`);
    goals.forEach((g) => {
      const card = el(`
        <button type="button" class="goal-card goal-card--link">
          <div class="goal-title">${escapeHtml(g.title)}</div>
          ${targetDateInfo(g)}
          ${g.why ? `<div class="goal-why">${escapeHtml(g.why)}</div>` : ''}
        </button>
      `);
      card.onclick = () => goToGoal(state, g.id, value.id);
      goalList.appendChild(card);
    });
    wrap.appendChild(goalList);
  }

  return wrap;
}

function renderGoalDetail(state, goalId) {
  const goal = state.goals.find((g) => g.id === goalId);
  const wrap = el(`<div class="view"></div>`);

  if (!goal) {
    wrap.appendChild(backLinkEl('← All values', () => goToValuesIndex(state)));
    wrap.appendChild(el(`<p class="muted">This goal no longer exists.</p>`));
    return wrap;
  }

  const value = state.values.find((v) => v.id === goal.valueId);
  wrap.appendChild(backLinkEl(`← ${value ? value.name : 'Back'}`, () => goToValue(state, goal.valueId)));

  const achieved = goal.status === 'achieved';
  wrap.appendChild(
    el(`
    <div class="goal-detail-header">
      <h1>${escapeHtml(goal.title)} ${achieved ? '<span class="chip chip--achieved">✓ Achieved</span>' : ''}</h1>
      ${targetDateInfo(goal)}
    </div>
  `)
  );

  const actionsRow = el(`
    <div class="actions-row">
      ${!achieved ? '<button class="btn btn-small" data-action="achieve">Mark as achieved</button>' : ''}
      <button class="btn btn-small" data-action="edit-goal">Edit</button>
      <button class="btn btn-small" data-action="delete-goal">Delete</button>
    </div>
  `);
  const achieveBtn = actionsRow.querySelector('[data-action="achieve"]');
  if (achieveBtn) {
    achieveBtn.onclick = () => {
      goal.status = 'achieved';
      saveState(state);
      showToast(`"${goal.title}" achieved`);
      renderApp(state);
    };
  }
  actionsRow.querySelector('[data-action="edit-goal"]').onclick = () => openGoalModal(state, goal.valueId, goal);
  actionsRow.querySelector('[data-action="delete-goal"]').onclick = () => {
    openConfirmModal('Delete this goal? Its habits and to-dos stay under the value, just un-tagged.', 'Delete', () => {
      const valueId = goal.valueId;
      deleteGoal(state, goal.id);
      saveState(state);
      showToast('Goal deleted');
      goToValue(state, valueId);
    });
  };
  wrap.appendChild(actionsRow);

  if (goal.notes) wrap.appendChild(el(`<div class="goal-notes">${escapeHtml(goal.notes)}</div>`));

  const relatedHabits = habitsForGoal(state, goal.id).filter((h) => h.status !== 'completed');
  wrap.appendChild(el(`<h2 class="section-heading">Habits</h2>`));
  if (relatedHabits.length === 0) {
    wrap.appendChild(el(`<p class="muted small">No habits tagged to this goal yet.</p>`));
  } else {
    const list = el(`<div class="habit-list"></div>`);
    relatedHabits.forEach((h) => list.appendChild(renderValueHabitRow(state, h)));
    wrap.appendChild(list);
  }

  const relatedTodos = todosForGoal(state, goal.id).filter((t) => t.status !== 'done');
  wrap.appendChild(el(`<h2 class="section-heading">To-do's</h2>`));
  if (relatedTodos.length === 0) {
    wrap.appendChild(el(`<p class="muted small">No to-dos tagged to this goal yet.</p>`));
  } else {
    const list = el(`<div class="habit-list"></div>`);
    relatedTodos.forEach((t) => list.appendChild(renderValueTodoRow(state, t)));
    wrap.appendChild(list);
  }

  wrap.appendChild(el(`<h2 class="section-heading">Journal</h2>`));
  const composerCard = el(`
    <div class="card">
      <textarea id="goal-journal-text" placeholder="Write something about this goal..."></textarea>
      <button class="btn btn-primary" id="goal-journal-save" style="margin-top:10px;">Add entry</button>
    </div>
  `);
  composerCard.querySelector('#goal-journal-save').onclick = () => {
    const ta = composerCard.querySelector('#goal-journal-text');
    const text = ta.value.trim();
    if (!text) return;
    state.journal.push({ id: uid(), date: todayISO(), type: 'free', category: 'free', text, goalId: goal.id });
    saveState(state);
    showToast('Journal entry added');
    renderApp(state);
  };
  wrap.appendChild(composerCard);

  const goalEntries = state.journal.filter((j) => j.goalId === goal.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (goalEntries.length === 0) {
    wrap.appendChild(el(`<p class="muted small">No journal entries for this goal yet.</p>`));
  } else {
    const entryList = el(`<div class="journal-list"></div>`);
    goalEntries.forEach((e) => {
      const entryEl = el(`
        <div class="card journal-entry">
          <div class="journal-entry-header">
            <span class="journal-date">${escapeHtml(e.date)}</span>
            <button class="btn btn-tiny" data-action="edit-entry">Edit</button>
          </div>
          ${e.prompt ? `<div class="journal-prompt">${escapeHtml(e.prompt)}</div>` : ''}
          <div class="journal-text">${escapeHtml(e.text)}</div>
        </div>
      `);
      entryEl.querySelector('[data-action="edit-entry"]').onclick = () => openJournalEntryModal(state, e);
      entryList.appendChild(entryEl);
    });
    wrap.appendChild(entryList);
  }

  wrap.appendChild(el(`<h2 class="section-heading">Why this matters</h2>`));
  const whyCard = el(`
    <div class="card">
      <textarea id="goal-why" placeholder="Why do you want to achieve this?">${escapeHtml(goal.why || '')}</textarea>
    </div>
  `);
  const whyTa = whyCard.querySelector('#goal-why');
  whyTa.addEventListener('blur', () => {
    goal.why = whyTa.value.trim();
    saveState(state);
  });
  wrap.appendChild(whyCard);

  return wrap;
}

const JOURNAL_PROMPT_CATEGORIES = [
  { id: 'retro', label: 'Retrospective' },
  { id: 'future', label: 'Future-self' },
  { id: 'socratic', label: 'Socratic' },
  { id: 'values', label: 'Values' },
  { id: 'motive', label: 'Motive' },
  { id: 'aware', label: 'From your data' },
];

function journalGoalOptions(state) {
  return state.values.flatMap((v) => goalsForValue(state, v.id));
}

function goalChipLabel(g) {
  return `${g.status === 'achieved' ? '✓ ' : ''}${escapeHtml(g.title)}`;
}

function renderJournal(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Journal</h1>`));

  const journalGoals = journalGoalOptions(state);
  const date = todayISO();

  const dailyEntry = journalEntryForDate(state, date);
  const { text: promptText, category: promptCategory } = promptForDate(state, date);
  const promptCard = el(`
    <div class="card prompt-card">
      <label class="prompt-label">${escapeHtml(promptText)}</label>
      <textarea id="daily-journal" placeholder="Optional — a line or two is enough">${escapeHtml(dailyEntry ? dailyEntry.text : '')}</textarea>
    </div>
  `);
  const dailyTa = promptCard.querySelector('#daily-journal');
  dailyTa.addEventListener('blur', () => {
    const text = dailyTa.value.trim();
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

  const addCard = el(`
    <div class="card">
      <textarea id="new-entry-text" placeholder="Write freely..."></textarea>
      <button class="btn btn-primary" id="add-entry-btn" style="margin-top:12px;">Add entry</button>
    </div>
  `);
  addCard.querySelector('#add-entry-btn').onclick = () => {
    const ta = addCard.querySelector('#new-entry-text');
    const text = ta.value.trim();
    if (!text) return;
    state.journal.push({ id: uid(), date: todayISO(), type: 'free', category: 'free', text, goalId: null });
    saveState(state);
    showToast('Journal entry added');
    renderApp(state);
  };
  wrap.appendChild(addCard);

  if (state.journal.length === 0) {
    wrap.appendChild(el(`<div class="empty-state"><p>No entries yet.</p></div>`));
    return wrap;
  }

  const filter = { mode: 'all', value: null, search: '' };
  const entryCategory = (e) => e.category || (e.type === 'free' ? 'free' : 'retro');
  const matchesFilter = (e) => {
    if (filter.mode === 'category') return entryCategory(e) === filter.value;
    if (filter.mode === 'goal') return e.goalId === filter.value;
    if (filter.mode === 'freeform') return entryCategory(e) === 'free' && !e.goalId;
    return true;
  };

  const controls = el(`
    <div class="card journal-controls">
      <input type="text" id="journal-search" placeholder="Search entries..." />
      <p class="muted small journal-filter-heading">Prompts</p>
      <div class="filter-chips">
        <button type="button" class="filter-chip active" data-mode="all">All</button>
        ${JOURNAL_PROMPT_CATEGORIES.map((c) => `<button type="button" class="filter-chip" data-mode="category" data-value="${c.id}">${escapeHtml(c.label)}</button>`).join('')}
      </div>
      <p class="muted small journal-filter-heading">Goals</p>
      <div class="filter-chips">
        <button type="button" class="filter-chip" data-mode="freeform">Freeform</button>
        ${journalGoals.map((g) => `<button type="button" class="filter-chip" data-mode="goal" data-value="${g.id}">${goalChipLabel(g)}</button>`).join('')}
      </div>
    </div>
  `);
  wrap.appendChild(controls);

  const listContainer = el(`<div class="journal-list"></div>`);
  wrap.appendChild(listContainer);

  function setFilter(mode, value) {
    filter.mode = mode;
    filter.value = value || null;
    controls.querySelectorAll('.filter-chip').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode && (b.dataset.value || null) === (value || null));
    });
    update();
  }

  function update() {
    const searchLower = filter.search.trim().toLowerCase();
    const entries = [...state.journal]
      .filter(matchesFilter)
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
      const goal = e.goalId ? state.goals.find((g) => g.id === e.goalId) : null;
      const entryEl = el(`
        <div class="card journal-entry">
          <div class="journal-entry-header">
            <div class="journal-entry-meta">
              <span class="journal-date">${escapeHtml(e.date)}</span>
              ${goal ? `<button type="button" class="chip chip--neutral journal-goal-tag">→ ${escapeHtml(goal.title)}</button>` : ''}
            </div>
            <button class="btn btn-tiny" data-action="edit-entry">Edit</button>
          </div>
          ${e.prompt ? `<div class="journal-prompt">${escapeHtml(e.prompt)}</div>` : ''}
          <div class="journal-text">${escapeHtml(e.text)}</div>
        </div>
      `);
      if (goal) {
        entryEl.querySelector('.journal-goal-tag').onclick = () => setFilter('goal', goal.id);
      }
      entryEl.querySelector('[data-action="edit-entry"]').onclick = () => openJournalEntryModal(state, e);
      listContainer.appendChild(entryEl);
    });
  }

  controls.querySelector('#journal-search').addEventListener('input', (e) => {
    filter.search = e.target.value;
    update();
  });
  controls.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.onclick = () => setFilter(btn.dataset.mode, btn.dataset.value);
  });

  update();
  return wrap;
}

function renderStats(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Statistics</h1>`));

  if (state.values.length === 0 && state.habits.length === 0 && state.dayPlans.length === 0) {
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

  if (state.dayPlans.length > 0) {
    const sortedPlans = [...state.dayPlans].sort((a, b) => (a.date < b.date ? -1 : 1));
    const monthGroups = new Map();
    sortedPlans.forEach((p) => {
      const month = monthLabel(p.date);
      if (!monthGroups.has(month)) monthGroups.set(month, []);
      monthGroups.get(month).push(p);
    });
    const card = el(`
      <div class="card">
        <h2>Plan follow-through</h2>
        <p class="muted small">Whether you did what you told yourself you would, day by day.</p>
      </div>
    `);
    monthGroups.forEach((plans, month) => {
      const doneCount = plans.filter((p) => p.completed).length;
      card.appendChild(el(`<p class="stat-group-heading">${escapeHtml(month)}</p>`));
      const dotsHtml = plans
        .map((p) => `<span class="dot ${p.completed ? 'dot--on' : ''}" title="${escapeHtml(p.date)}: ${p.completed ? 'done' : 'not done'}"></span>`)
        .join('');
      card.appendChild(
        el(`
        <div class="consistency">
          <div class="dots dots--wrap">${dotsHtml}</div>
          <span class="consistency-label">${doneCount}/${plans.length} days followed</span>
        </div>
      `)
      );
    });
    wrap.appendChild(card);
  }

  if (state.values.length > 0) {
    const activity = state.values.map((v) => ({
      name: v.name,
      percent: valueAttentionPercent(state, v.id, date, 30),
    }));
    const rows = activity
      .map((a) =>
        a.percent === null
          ? `<div class="bar-row bar-row--empty"><span class="bar-label">${escapeHtml(a.name)}</span><span class="bar-empty-note">No active habit yet</span></div>`
          : percentBar(a.name, a.percent)
      )
      .join('');
    const card = el(`
      <div class="card">
        <h2>Where your attention went, last 30 days</h2>
        <p class="muted small">Each value scored against its own habits' targets — 100% means you hit everything you set out to, regardless of how many habits other values have.</p>
        <div class="bar-list">${rows}</div>
      </div>
    `);
    wrap.appendChild(card);
  }

  return wrap;
}

function renderAchievements(state) {
  const wrap = el(`<div class="view"></div>`);
  wrap.appendChild(el(`<h1>Achievements</h1>`));
  wrap.appendChild(el(`<p class="muted small">Achieved goals, and habits or to-dos you've marked complete — kept here instead of cluttering the active views.</p>`));

  const totalGoalsAchieved = state.goals.filter((g) => g.status === 'achieved').length;
  const totalHabitsCompleted = state.habits.filter((h) => h.status === 'completed').length;
  const totalTodosCompleted = state.todos.filter((t) => t.status === 'done').length;

  if (totalGoalsAchieved > 0 || totalHabitsCompleted > 0 || totalTodosCompleted > 0) {
    wrap.appendChild(
      el(`
      <div class="stat-tiles">
        <div class="stat-tile"><div class="stat-tile-value">${totalGoalsAchieved}</div><div class="stat-tile-label">Goals achieved</div></div>
        <div class="stat-tile"><div class="stat-tile-value">${totalHabitsCompleted}</div><div class="stat-tile-label">Habits completed</div></div>
        <div class="stat-tile"><div class="stat-tile-value">${totalTodosCompleted}</div><div class="stat-tile-label">To-dos completed</div></div>
      </div>
    `)
    );
  }

  function historyRow(name, type, completedAt, goalTitle, onDelete) {
    const row = el(`
      <div class="habit-sub-row">
        <div class="habit-sub-main">
          <div class="habit-sub-info">
            <span class="habit-name">✓ ${escapeHtml(name)}</span>
            <span class="chip chip--neutral">${escapeHtml(type)}</span>
            ${goalTitle ? `<span class="chip chip--neutral">→ ${escapeHtml(goalTitle)}</span>` : ''}
            ${completedAt ? `<span class="muted small">completed ${escapeHtml(completedAt)}</span>` : ''}
          </div>
          <button class="btn btn-tiny" data-action="delete">Delete</button>
        </div>
      </div>
    `);
    row.querySelector('[data-action="delete"]').onclick = onDelete;
    return row;
  }

  let anySection = false;

  state.values.forEach((v) => {
    const achievedGoals = goalsForValue(state, v.id).filter((g) => g.status === 'achieved');
    const completedHabits = habitsForValue(state, v.id).filter((h) => h.status === 'completed');
    const doneTodos = todosForValue(state, v.id).filter((t) => t.status === 'done');
    const checkins = habitLogCountForValue(state, v.id);

    if (achievedGoals.length === 0 && completedHabits.length === 0 && doneTodos.length === 0) return;
    anySection = true;

    const card = el(`
      <div class="card value-card">
        <h2>${escapeHtml(v.name)}</h2>
        ${checkins > 0 ? `<p class="muted small">${checkins} total habit check-in${checkins === 1 ? '' : 's'}</p>` : ''}
        <div class="goal-list"></div>
        <div class="habit-sublist"></div>
        <div class="todo-sublist"></div>
      </div>
    `);

    const goalList = card.querySelector('.goal-list');
    achievedGoals.forEach((g) => {
      const goalEl = el(`
        <button type="button" class="goal-card goal-card--link">
          <div class="goal-header-row">
            <div class="goal-title">${escapeHtml(g.title)} <span class="chip chip--achieved">✓ Achieved</span></div>
          </div>
        </button>
      `);
      goalEl.onclick = () => goToGoal(state, g.id, v.id);
      goalList.appendChild(goalEl);
    });

    const habitSub = card.querySelector('.habit-sublist');
    completedHabits.forEach((h) => {
      const goal = h.goalId ? state.goals.find((g) => g.id === h.goalId) : null;
      habitSub.appendChild(
        historyRow(h.name, 'habit', h.completedAt, goal ? goal.title : null, () => {
          openConfirmModal('Delete this habit permanently?', 'Delete', () => {
            deleteHabit(state, h.id);
            saveState(state);
            showToast('Habit deleted permanently');
            renderApp(state);
          });
        })
      );
    });

    const todoSub = card.querySelector('.todo-sublist');
    doneTodos.forEach((t) => {
      const goal = t.goalId ? state.goals.find((g) => g.id === t.goalId) : null;
      todoSub.appendChild(
        historyRow(t.title, 'to-do', t.completedAt, goal ? goal.title : null, () => {
          openConfirmModal('Delete this to-do permanently?', 'Delete', () => {
            deleteTodo(state, t.id);
            saveState(state);
            showToast('To-do deleted permanently');
            renderApp(state);
          });
        })
      );
    });

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
          migrateToValueOwnedItems(state);
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

// ---------- Toasts ----------

let toastHideTimer = null;
let toastClearTimer = null;

function showToast(message) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  clearTimeout(toastHideTimer);
  clearTimeout(toastClearTimer);
  root.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
  const toastEl = root.querySelector('.toast');
  requestAnimationFrame(() => toastEl.classList.add('visible'));
  toastHideTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    toastClearTimer = setTimeout(() => {
      root.innerHTML = '';
    }, 250);
  }, 2200);
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
      <label>Target date</label>
      <input type="date" id="g-date" value="${isEdit ? escapeHtml(existingGoal.targetDate || '') : ''}" />
      <label>Notes <span class="muted small">(anything else worth keeping track of)</span></label>
      <textarea id="g-notes" placeholder="Optional">${isEdit ? escapeHtml(existingGoal.notes || '') : ''}</textarea>
      <div class="modal-actions modal-actions--split">
        <div class="modal-actions-left">
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
    const targetDate = content.querySelector('#g-date').value;
    const notes = content.querySelector('#g-notes').value.trim();
    if (isEdit) {
      Object.assign(existingGoal, { title, targetDate, notes });
    } else {
      state.goals.push({
        id: uid(),
        valueId,
        title,
        why: '',
        targetDate,
        notes,
        status: 'active',
        createdAt: todayISO(),
      });
    }
    saveState(state);
    closeModal();
    renderApp(state);
  };

  if (isEdit) {
    content.querySelector('#g-delete').onclick = () => {
      openConfirmModal('Delete this goal? Its habits and to-dos stay under the value, just un-tagged.', 'Delete', () => {
        deleteGoal(state, existingGoal.id);
        saveState(state);
        showToast('Goal deleted');
        renderApp(state);
      });
    };
  }

  openModal(content);
}

function openHabitModal(state, valueId, existingHabit) {
  const isEdit = !!existingHabit;
  const freqType = isEdit && existingHabit.frequency ? existingHabit.frequency.type : 'daily';
  const timesPerWeek = freqType === 'weekly' ? existingHabit.frequency.timesPerWeek : 2;
  const timesPerMonth = freqType === 'monthly' ? existingHabit.frequency.timesPerMonth : 2;
  const valueGoals = goalsForValue(state, valueId).filter((g) => g.status !== 'achieved');
  let selectedGoalId = isEdit ? existingHabit.goalId || null : null;

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
      ${
        valueGoals.length > 0
          ? `
        <label class="small muted">Tag to a goal <span class="muted">(optional)</span></label>
        <div class="filter-chips" id="h-goal-chips">
          <button type="button" class="filter-chip ${!selectedGoalId ? 'active' : ''}" data-goal="">No tag</button>
          ${valueGoals.map((g) => `<button type="button" class="filter-chip ${g.id === selectedGoalId ? 'active' : ''}" data-goal="${g.id}">${escapeHtml(g.title)}</button>`).join('')}
        </div>
      `
          : ''
      }
      <label>Notes <span class="muted small">(optional)</span></label>
      <textarea id="h-notes" placeholder="Optional">${isEdit ? escapeHtml(existingHabit.notes || '') : ''}</textarea>
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
  const goalChips = content.querySelector('#h-goal-chips');
  if (goalChips) {
    goalChips.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.onclick = () => {
        selectedGoalId = btn.dataset.goal || null;
        goalChips.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });
  }
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
    const notes = content.querySelector('#h-notes').value.trim();
    if (isEdit) {
      Object.assign(existingHabit, { name, trigger, frequency, notes, goalId: selectedGoalId });
    } else {
      state.habits.push({
        id: uid(),
        valueId,
        goalId: selectedGoalId,
        name,
        trigger,
        frequency,
        notes,
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
        showToast(`"${existingHabit.name}" completed`);
        renderApp(state);
      };
    }
    content.querySelector('#h-delete').onclick = () => {
      openConfirmModal('Delete this habit? This cannot be undone — its log history will be deleted too.', 'Delete', () => {
        deleteHabit(state, existingHabit.id);
        saveState(state);
        showToast('Habit deleted');
        renderApp(state);
      });
    };
  }
  openModal(content);
}

function openTodoModal(state, valueId) {
  const valueGoals = goalsForValue(state, valueId).filter((g) => g.status !== 'achieved');
  let selectedGoalId = null;

  const content = el(`
    <div class="modal-body">
      <h2>New to-do</h2>
      <label>What needs doing?</label>
      <input type="text" id="t-title" placeholder="e.g. Sign up for the race" />
      ${
        valueGoals.length > 0
          ? `
        <label class="small muted">Tag to a goal <span class="muted">(optional)</span></label>
        <div class="filter-chips" id="t-goal-chips">
          <button type="button" class="filter-chip active" data-goal="">No tag</button>
          ${valueGoals.map((g) => `<button type="button" class="filter-chip" data-goal="${g.id}">${escapeHtml(g.title)}</button>`).join('')}
        </div>
      `
          : ''
      }
      <div class="modal-actions">
        <button class="btn btn-secondary" id="t-cancel">Cancel</button>
        <button class="btn btn-primary" id="t-save">Save to-do</button>
      </div>
    </div>
  `);
  const goalChips = content.querySelector('#t-goal-chips');
  if (goalChips) {
    goalChips.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.onclick = () => {
        selectedGoalId = btn.dataset.goal || null;
        goalChips.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });
  }
  content.querySelector('#t-cancel').onclick = closeModal;
  content.querySelector('#t-save').onclick = () => {
    const title = content.querySelector('#t-title').value.trim();
    if (!title) return;
    state.todos.push({
      id: uid(),
      valueId,
      goalId: selectedGoalId,
      title,
      status: 'active',
      createdAt: todayISO(),
    });
    saveState(state);
    closeModal();
    renderApp(state);
  };
  openModal(content);
}

function openJournalEntryModal(state, entry) {
  const isFree = entry.type === 'free';
  const journalGoals = journalGoalOptions(state);
  let selectedGoalId = entry.goalId || null;

  const content = el(`
    <div class="modal-body">
      <h2>Edit entry</h2>
      ${entry.prompt ? `<div class="journal-prompt">${escapeHtml(entry.prompt)}</div>` : ''}
      <textarea id="je-text" placeholder="Write freely...">${escapeHtml(entry.text)}</textarea>
      ${
        isFree
          ? `
        <label class="small muted" style="margin-top:10px;">What's this about?</label>
        <div class="filter-chips" id="je-goal-chips">
          <button type="button" class="filter-chip ${!entry.goalId ? 'active' : ''}" data-goal="">Freeform</button>
          ${journalGoals.map((g) => `<button type="button" class="filter-chip ${g.id === entry.goalId ? 'active' : ''}" data-goal="${g.id}">${goalChipLabel(g)}</button>`).join('')}
        </div>
      `
          : ''
      }
      <div class="modal-actions modal-actions--split">
        <div class="modal-actions-left">
          <button class="btn btn-danger" id="je-delete">Delete</button>
        </div>
        <div class="modal-actions-right">
          <button class="btn btn-secondary" id="je-cancel">Cancel</button>
          <button class="btn btn-primary" id="je-save">Save changes</button>
        </div>
      </div>
    </div>
  `);

  if (isFree) {
    content.querySelectorAll('#je-goal-chips .filter-chip').forEach((btn) => {
      btn.onclick = () => {
        selectedGoalId = btn.dataset.goal || null;
        content.querySelectorAll('#je-goal-chips .filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });
  }

  content.querySelector('#je-cancel').onclick = closeModal;
  content.querySelector('#je-save').onclick = () => {
    const text = content.querySelector('#je-text').value.trim();
    if (!text) return;
    entry.text = text;
    if (isFree) entry.goalId = selectedGoalId;
    saveState(state);
    closeModal();
    showToast('Journal entry updated');
    renderApp(state);
  };
  content.querySelector('#je-delete').onclick = () => {
    openConfirmModal('Delete this journal entry? This cannot be undone.', 'Delete', () => {
      state.journal = state.journal.filter((j) => j !== entry);
      saveState(state);
      showToast('Journal entry deleted');
      renderApp(state);
    });
  };
  openModal(content);
}

function openValueModal(state, value) {
  const content = el(`
    <div class="modal-body">
      <h2>Edit value</h2>
      <label>Name</label>
      <input type="text" id="v-name" value="${escapeHtml(value.name)}" />
      <label>Notes</label>
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
    openConfirmModal('Delete this value? This cannot be undone — its goals, habits, and to-dos will be deleted too.', 'Delete', () => {
      deleteValue(state, value.id);
      saveState(state);
      showToast('Value deleted');
      goToValuesIndex(state);
    });
  };
  openModal(content);
}
