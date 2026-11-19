const $ = id => document.getElementById(id);
const groupNames = {
  project_analytics_new: 'Аналитика',
  project_call_tracking_dashboard: 'Коллтрекинг · Дашборд',
  project_call_tracking_history: 'Коллтрекинг · История звонков',
  project_call_tracking_scripts: 'Коллтрекинг · Сценарии',
  project_clients_segments_create: 'Клиенты · Сегменты',
  project_emailtracking_history: 'Email-трекинг · История',
  project_emailtracking_import: 'Email-трекинг · Импорт'
};
const labels = { queued: 'В очереди', running: 'Выполняется', passed: 'Пройден', failed: 'Ошибка',
  skipped: 'Пропущен', flaky: 'Пройден с повтора', unfinished: 'Не завершён' };
const groups = new Map();
const selected = new Set();
let active = false;
let starting = false;
let lastReport = '';
let refreshTimer;

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
async function api(route, options) {
  const response = await fetch('/api/' + route, options);
  const result = await response.json();
  if (!response.ok) throw Error(result);
  return result;
}
function showError(message) {
  $('error').hidden = !message;
  $('error').textContent = message;
}
function updateSelection() {
  const tests = groups.get($('section').value) || [];
  const checked = tests.filter(test => selected.has(test.id)).length;
  $('whole').checked = checked > 0 && checked === tests.length;
  $('whole').indeterminate = checked > 0 && checked < tests.length;
  $('count').textContent = 'Выбрано: ' + selected.size;
  $('clear').disabled = !selected.size;
  $('start').disabled = !selected.size || starting || active;
}
function drawSection() {
  const tests = groups.get($('section').value) || [];
  $('checks').replaceChildren(...tests.map(test => {
    const label = document.createElement('label');
    label.className = 'check';
    label.title = test.file;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = selected.has(test.id);
    check.onchange = () => {
      if (check.checked) selected.add(test.id); else selected.delete(test.id);
      updateSelection();
    };
    label.append(check, document.createTextNode(test.title));
    return label;
  }));
  updateSelection();
}
function display(run) {
  active = run?.status === 'running';
  updateSelection();
  const serialized = JSON.stringify(run);
  if (serialized === lastReport) return;
  lastReport = serialized;
  $('report').hidden = !run;
  if (!run) return;
  const counts = Object.create(null);
  for (const row of run.rows) counts[row.status] = (counts[row.status] || 0) + 1;
  $('heading').textContent = active ? 'Идёт прогон' : run.status === 'failed' ? 'Прогон завершился с ошибкой' : 'Прогон завершён';
  $('summary').textContent = [
    'Старт ' + new Date(run.started).toLocaleTimeString('ru'),
    'Всего: ' + run.rows.length,
    ...Object.entries(labels).filter(([key]) => counts[key]).map(([key, label]) => label + ': ' + counts[key])
  ].join(' · ');
  $('progress').max = run.rows.length;
  $('progress').value = run.rows.length - (counts.queued || 0) - (counts.running || 0) - (counts.unfinished || 0);
  const expanded = new Set(Array.from($('results').querySelectorAll('details[open]'), box => box.dataset.id));
  const nodes = run.rows.map(row => {
    const line = element('div', '');
    line.className = 'result-row';
    const badge = element('span', labels[row.status]);
    badge.className = 'badge';
    badge.dataset.status = row.status;
    line.append(badge, element('span', row.title));
    if (Number.isFinite(row.duration)) line.append(element('time', (row.duration / 1000).toLocaleString('ru', { maximumFractionDigits: 2 }) + ' с'));
    if (row.error) {
      const details = element('details', '');
      details.dataset.id = row.id;
      details.open = expanded.has(row.id);
      details.append(element('summary', 'Подробности'), element('pre', row.error));
      line.append(details);
    }
    return line;
  });
  if (run.error) {
    const reason = element('p', run.error);
    reason.className = 'run-error';
    nodes.unshift(reason);
  }
  $('results').replaceChildren(...nodes);
}
async function refresh() {
  clearTimeout(refreshTimer);
  try { display(await api('run')); showError(''); }
  catch { active = true; updateSelection(); showError('Потеряна связь с пультом. Проверьте окно start.cmd.'); }
  refreshTimer = setTimeout(refresh, active ? 1000 : 5000);
}
$('section').onchange = drawSection;
$('whole').onchange = () => {
  for (const test of groups.get($('section').value) || []) {
    if ($('whole').checked) selected.add(test.id); else selected.delete(test.id);
  }
  drawSection();
};
$('clear').onclick = () => { selected.clear(); drawSection(); };
$('start').onclick = async () => {
  if (starting || active || !selected.size) return;
  starting = true;
  updateSelection();
  try {
    const run = await api('run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([...selected]) });
    display(run);
    $('report').scrollIntoView({ block: 'start' });
    await refresh();
  } catch (error) { showError(error.message); }
  finally { starting = false; updateSelection(); }
};
async function init() {
  const { tests, target } = await api('catalog');
  for (const test of tests) {
    if (!groups.has(test.group)) groups.set(test.group, []);
    groups.get(test.group).push(test);
  }
  for (const [key, items] of groups) $('section').add(new Option((groupNames[key] || key) + ' (' + items.length + ')', key));
  $('inventory').textContent = [target && 'Стенд: ' + target, 'Разделов: ' + groups.size, 'Тестов: ' + tests.length].filter(Boolean).join(' · ');
  drawSection();
  await refresh();
}
init().catch(() => showError('Не удалось загрузить каталог. Проверьте окно start.cmd и обновите страницу.'));
