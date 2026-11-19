(() => {
  const key = 'roistat-qa.theme.v1';
  const root = document.documentElement;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'theme-toggle';
  toggle.setAttribute('aria-label', 'Тёмная тема');
  toggle.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path class="moon" d="M20.5 14A8.6 8.6 0 0 1 10 3.5 8.6 8.6 0 1 0 20.5 14Z"/>
    <g class="sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></g>
  </svg>`;

  function apply(value) {
    const dark = value === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.title = dark ? 'Включить светлую тему' : 'Включить тёмную тему';
  }
  function restore() {
    try { apply(localStorage.getItem(key)); }
    catch { apply(root.dataset.theme); }
  }
  restore();
  toggle.addEventListener('click', () => {
    apply(root.dataset.theme === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem(key, root.dataset.theme); } catch { /* Use the selection in this tab. */ }
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) restore();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  document.addEventListener('DOMContentLoaded', () => document.querySelector('.brand').append(toggle));
})();
