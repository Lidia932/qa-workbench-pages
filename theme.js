(() => {
  const key = 'roistat-qa.theme.v1';
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'theme-toggle';
  toggle.setAttribute('aria-label', 'Тёмная тема');
  toggle.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path class="moon" d="M20.5 14A8.6 8.6 0 0 1 10 3.5 8.6 8.6 0 1 0 20.5 14Z"/>
    <g class="sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></g>
  </svg>`;

  function apply() {
    const dark = preference === 'dark' || (preference !== 'light' && systemTheme.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.title = dark ? 'Включить светлую тему' : 'Включить тёмную тему';
  }
  function restore() {
    try { preference = localStorage.getItem(key); } catch { /* Keep the in-tab preference. */ }
    apply();
  }
  restore();
  systemTheme.addEventListener('change', apply);
  toggle.addEventListener('click', () => {
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply();
    try { localStorage.setItem(key, preference); } catch { /* Use the selection in this tab. */ }
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) restore();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  document.addEventListener('DOMContentLoaded', () => document.querySelector('.brand').append(toggle));
})();
