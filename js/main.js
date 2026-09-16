let state = loadState();
applyTheme(state);

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(state));
}

function setView(view) {
  state._view = view;
  renderApp(state);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  renderApp(state);
});
