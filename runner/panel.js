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
let revision;

function explainFailure(message) {
  const expected = message.match(/^\s*Expected(?: (?:value|length|string|substring|pattern|array|object))?:\s*([^\r\n]+)/im)?.[1]?.trim();
  const received = message.match(/^\s*Received(?: (?:value|length|string|array|object))?:\s*([^\r\n]+)/im)?.[1]?.trim();
  if (/One aggregate per number/i.test(message)) {
    if (/^\d+$/.test(expected) && /^\d+$/.test(received)) {
      return 'В распределении звонков номера повторяются. На ' + expected + ' строк приходится ' + received + ' уникальных номеров. Ожидалась одна строка на номер.';
    }
    return 'В распределении звонков ожидалась одна строка на каждый номер. Количество строк и уникальных номеров различается.';
  }
  if (/recovery (?:is )?required|requires recovery/i.test(message)) return 'Для тестового ресурса осталось незавершённое восстановление после предыдущего прогона. Подробности указывают, какой ресурс требует проверки.';
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/.test(message)) return 'Не удалось найти сервер по имени. Проверьте подключение к рабочей сети и адрес сервера.';
  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED/.test(message)) return 'Сервер отклонил подключение. Тест не смог продолжить работу.';
  if (/executable doesn't exist/i.test(message)) return 'Playwright не нашёл установленный браузер для этой версии тестов.';
  if (/strict mode violation/i.test(message)) return 'Вместо одного элемента на странице найдено несколько. Тест не смог однозначно выбрать элемент.';
  if (expected && received) return 'Проверка не прошла. Ожидалось: ' + expected + '. Получено: ' + received + '.';
  const duration = message.match(/(?:timeout(?: of)?|timed out(?: after)?)\s+(\d+)\s*ms/i)?.[1];
  if (/timeout|timed out/i.test(message)) return 'Истекло время ожидания' + (duration ? ' (' + Number(duration) / 1000 + ' с)' : '') + '. Проверяемое действие не завершилось вовремя.';
  const first = message.trim().split(/\r?\n/)[0].replace(/^(?:Error|Ошибка):\s*/, '');
  if (/[а-яё]/i.test(first)) return first;
  if (/expect\(/.test(message)) return 'Фактический результат не соответствует условию проверки. Точное условие приведено в технических подробностях.';
  return 'Playwright сообщил об ошибке. Точное сообщение и место сбоя приведены в технических подробностях.';
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
async function api(route, options) {
  const response = await fetch('/api/' + route, options);
  const result = await response.json();
  if (!response.ok) throw Object.assign(Error(result), { status: response.status });
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
  $('start').disabled = !revision || !selected.size || starting || active;
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
    run.revision ? 'Stash master · ' + run.revision.slice(0, 8) : 'Локальный прогон',
    'Всего: ' + run.rows.length,
    ...Object.entries(labels).filter(([key]) => counts[key]).map(([key, label]) => label + ': ' + counts[key])
  ].join(' · ');
  $('progress').max = run.rows.length;
  $('progress').value = run.rows.length - (counts.queued || 0) - (counts.running || 0) - (counts.unfinished || 0);
  const expanded = new Set(Array.from($('results').querySelectorAll('details[open]'), box => box.dataset.id));
  // Playwright groups tests by worker fixtures, even with one worker.
  // Keep completed attempts first, then the current test and the waiting queue.
  const phase = row => row.status === 'running' ? 1 : ['queued', 'unfinished'].includes(row.status) ? 2 : 0;
  const ordered = [...run.rows].sort((a, b) => phase(a) - phase(b) || (a.order ?? 0) - (b.order ?? 0));
  const nodes = ordered.map(row => {
    const line = element('div', '');
    line.className = 'result-row';
    const badge = element('span', labels[row.status]);
    badge.className = 'badge';
    badge.dataset.status = row.status;
    line.append(badge, element('span', row.title));
    if (Number.isFinite(row.duration)) line.append(element('time', (row.duration / 1000).toLocaleString('ru', { maximumFractionDigits: 2 }) + ' с'));
    if (row.error || row.status === 'failed') {
      const explanation = element('p', row.error ? explainFailure(row.error) : 'Итог сценария отличается от результата, заданного в тесте.');
      explanation.className = 'failure-summary';
      line.append(explanation);
    }
    if (row.error) {
      const details = element('details', '');
      details.dataset.id = row.id;
      details.open = expanded.has(row.id);
      details.append(element('summary', 'Технические подробности'), element('pre', row.error));
      line.append(details);
    }
    return line;
  });
  if (run.error) {
    const details = element('details', '');
    details.dataset.id = 'run-error';
    details.open = expanded.has(details.dataset.id);
    details.append(element('summary', 'Технические подробности прогона'), element('pre', run.error));
    nodes.unshift(element('p', explainFailure(run.error)), details);
  }
  $('results').replaceChildren(...nodes);
}
async function refresh() {
  clearTimeout(refreshTimer);
  try { display(await api('run')); }
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
  showError('');
  updateSelection();
  try {
    const run = await api('run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected], revision }) });
    display(run);
    $('report').scrollIntoView({ block: 'start' });
    await refresh();
  } catch (error) {
    showError(error.message);
    if (error.status === 412) {
      try { await loadCatalog(); } catch (cause) { showError(cause.message); }
    }
  }
  finally { starting = false; updateSelection(); }
};
async function loadCatalog() {
  const catalog = await api('catalog');
  const { tests, target } = catalog;
  revision = catalog.revision;
  const previous = $('section').value;
  const ids = new Set(tests.map(test => test.id));
  for (const id of selected) if (!ids.has(id)) selected.delete(id);
  groups.clear();
  $('section').replaceChildren();
  for (const test of tests) {
    if (!groups.has(test.group)) groups.set(test.group, []);
    groups.get(test.group).push(test);
  }
  for (const [key, items] of groups) $('section').add(new Option((groupNames[key] || key) + ' (' + items.length + ')', key));
  if (groups.has(previous)) $('section').value = previous;
  const version = revision ? 'Stash master · ' + revision.slice(0, 8) : 'Работает прежний пульт. После прогона закройте его и откройте обновлённый start.cmd.';
  $('inventory').textContent = [version, target && 'Стенд: ' + target, 'Разделов: ' + groups.size, 'Тестов: ' + tests.length].filter(Boolean).join(' · ');
  drawSection();
}
loadCatalog().catch(error => { $('inventory').textContent = 'Каталог недоступен'; showError(error.message); }).finally(refresh);
