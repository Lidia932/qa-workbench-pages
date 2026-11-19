const planKey = 'roistat-qa.standup.plans.v1';
const review = document.querySelector('#review');
const reviewItems = document.querySelector('#review-items');
const previous = document.querySelector('#use-previous');
const manualYesterday = document.querySelector('#manual-yesterday');
let imported = [];

function dayKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function storedPlans() {
  return JSON.parse(localStorage.getItem(planKey) || '{}');
}
function savePlan() {
  const items = [];
  for (const row of plans.children) {
    if (row.hidden) continue;
    if (row.dataset.number) items.push({number: row.dataset.number});
    else {
      const title = row.querySelector('.task-name').value.trim();
      if (title) {
        const task = {title, href:row.querySelector('.url').value.trim(), qa:selectedPeople(row)};
        const action = row.querySelector('.work-action');
        if (action) Object.assign(task, {kind:'e2e', action:action.value});
        items.push(task);
      }
    }
  }
  try {
    const history = storedPlans();
    history[dayKey()] = items;
    const dates = Object.keys(history).sort().slice(-7);
    localStorage.setItem(planKey, JSON.stringify(Object.fromEntries(dates.map(date => [date,history[date]]))));
    return true;
  } catch { return false; }
}
function lastPlan() {
  try {
    const history = storedPlans();
    const date = Object.keys(history).sort().reverse().find(date => date < dayKey());
    return date && history[date]?.length ? {date, items: history[date]} : null;
  } catch { return null; }
}
function refreshPrevious() {
  const last = lastPlan();
  previous.hidden = !last;
  if (last) previous.textContent = 'Взять сохранённый план за ' + last.date.split('-').reverse().join('.');
}
function showReview(items, title) {
  imported = items;
  reviewItems.replaceChildren();
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'review-item';
    const label = document.createElement('label');
    const e2e = item.kind === 'e2e';
    label.append(item.number ? 'Релиз ' + item.number : (e2e ? 'E2E · ' + workActions[item.action] + ' ' : 'Приёмка · ') + item.title);
    const select = e2e ? e2eStatus() : document.createElement('select');
    if (!e2e) {
      for (const [value, text] of [['','Выберите итог'],['yes','Провели'],['no','Не провели']]) select.add(new Option(text,value));
    }
    label.append(select);
    row.append(label);
    if (!item.number && !taskHref(item.href)) {
      const field = document.createElement('label');
      field.append('Ссылка на задачу');
      const input = document.createElement('input');
      input.type = 'url';
      input.pattern = 'https?://.+';
      input.placeholder = 'https://';
      field.append(input);
      row.append(field);
    }
    if (!item.number) addAcceptancePeople(row, item.qa || [], e2e ? 'Исполнители' : 'Ведёт приёмку');
    reviewItems.append(row);
  }
  document.querySelector('#review-title').textContent = title;
  manualYesterday.hidden = true;
  review.hidden = false;
  document.querySelector('.import-bar').open = false;
  render();
}
function reviewedRows() {
  const rows = [];
  const selects = reviewItems.querySelectorAll('select');
  imported.forEach((item,index) => {
    const value = selects[index].value;
    const row = reviewItems.children[index];
    const field = row.querySelector('input[type=url]');
    let href = taskHref(item.href);
    if (field) {
      field.required = Boolean(value);
      href = checkTaskLink(field, Boolean(value));
    }
    if (!value) return;
    const verb = value === 'yes' ? 'Провели' : 'Не провели';
    if (item.number) rows.push([verb + ' релиз №' + item.number]);
    else {
      const e2e = item.kind === 'e2e';
      rows.push(taskParts(e2e ? e2eOutcomes[value] : verb + ' приемку', item.title, href, row, e2e));
    }
  });
  return rows;
}

function parseToday(body) {
  const items = [];
  const skipped = [];
  const normalized = body.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'')
    .replace(/\*\*/g,'').replace(/\r\n?|<br\s*\/?\s*>/gi,'\n')
    .replace(/\n[ \t]*(?=QA\s*:?\s*@)/gi,' ')
    .replace(/(при[её]мк[ау][ \t:–—-]*)\n[ \t]*(?=\[[^\]\n]+\]\(https?:)/gi,'$1 ');
  for (const raw of normalized.split(/\n|\s+(?=[*•]\s+(?:провед|при[её]м))/i)) {
    const line = raw.trim().replace(/^(?:>\s*|(?:[*•–—-]|\d+[.)])\s+)*/,'').trim();
    if (!line || line === '—') continue;
    if (/^(?:провед[её]м\s+)?(?:2|два)\s+релиза(?:\s|$|[.,-])/i.test(line)) {
      items.push({number:'1'},{number:'2'});
      continue;
    }
    const release = line.match(/^(?:провед[её]м\s+)?(\d+)(?:-й)?\s+релиз(?:\s|$|[.,-])/i);
    if (release) { items.push({number:release[1]}); continue; }
    const work = line.match(/^(начн[её]м|продолжим)\s+работу\s+по\s+(.+)$/i);
    const acceptance = line.match(/(?:^|\s)при[её]мк[а-яё]*[\s:–—-]*(.*)$/i);
    const taskLink = /https?:\/\/[^\s/)]+\/tasks\/task\/[^\s)]+/i.test(line);
    if (!work && !acceptance && !taskLink) {skipped.push(line);continue;}
    const description = work?.[2] || acceptance?.[1] || line;
    const assignment = work
      ? description.match(/\s+(?:QA\s*:?\s*)?((?:@[a-z0-9][a-z0-9._-]*[\s,;]*)+)$/i)
      : description.match(/(?:^|\s+)QA\s*:?\s*((?:@[a-z0-9][a-z0-9._-]*[\s,;]*)+)$/i);
    const qa = Array.from((assignment?.[1] || '').matchAll(/@([a-z0-9][a-z0-9._-]*)/gi),
      match => match[1].replace(/\.+$/,'').toLowerCase());
    const task = (assignment ? description.slice(0,assignment.index) : description).replace(/\s+QA\s*:?\s*—?$/i,'').trim();
    const link = line.match(/\[([^\]\n]+)\]\(<?(https?:\/\/[^\s>]+?)>?\)(?=\s|$|[.,;])/i);
    const rawUrl = task.match(/https?:\/\/[^\s<>]+/i)?.[0];
    const href = taskHref(link?.[2] || rawUrl);
    const title = link?.[1] || (rawUrl ? task.replace(rawUrl,'').trim() : task) || rawUrl || 'Без названия';
    const item = {title,href,qa};
    if (work) Object.assign(item,{kind:'e2e', action:/^нач/i.test(work[1]) ? 'start' : 'continue'});
    items.push(item);
  }
  return {items,skipped};
}
function importBody(body, title, status) {
  const {items,skipped} = parseToday(body);
  if (!items.length) {status.textContent = 'В разделе «Сегодня» не найдены релизы, приёмки или E2E-тесты. ' + skipped.join(' · ');return;}
  showReview(items, title);
  document.querySelector('#skipped-lines').textContent = skipped.length ? 'Не распознаны строки: ' + skipped.join(' · ') : '';
  status.textContent = 'Загружено пунктов: ' + items.length;
}
const loadPost = document.querySelector('#load-post');
const postStatus = document.querySelector('#post-status');
let discardPendingImport = false;
loadPost.onclick = () => {
  discardPendingImport = false;
  postStatus.textContent = loadPost.dataset.ready ? 'Читаю сообщение…' : 'Установите QA Merge Checker 1.1.0 из каталога и обновите вкладку. Для чтения нужен вход в Platrum.';
};
loadPost.addEventListener('qa-standup-result', event => {
  if (discardPendingImport) return;
  const result = JSON.parse(event.detail);
  if (result.error) {postStatus.textContent = result.error;return;}
  importBody(result.today, 'План из Platrum', postStatus);
});
document.querySelector('#parse-chat').onclick = () => {
  const pasted = document.querySelector('#chat-text').value;
  const message = pasted.includes('\\*\\*Сегодня:') ? pasted.replace(/\\([*():_])/g,'$1').replace(/\\[ \t]*$/gm,'') : pasted;
  const text = message.replace(/^[ \t#*_]*(Сегодня|Проблемы|Вчера)\s*:?[ \t*_]*$/gim, '$1:');
  const body = text.match(/^Сегодня:\s*\n([\s\S]*?)(?=^(?:Проблемы|Вчера):|(?![\s\S]))/im)?.[1];
  const status = document.querySelector('#parse-status');
  if (!body) {status.textContent = 'Не найден раздел «Сегодня».';return;}
  importBody(body, 'План из сообщения', status);
};
previous.onclick = () => {
  const last = lastPlan();
  if (last) {
    showReview(last.items, previous.textContent.replace('Взять сохранённый план', 'План'));
    document.querySelector('#skipped-lines').textContent = '';
  }
};
document.querySelector('#manual-mode').onclick = () => {review.hidden = true;manualYesterday.hidden = false;render();};
document.querySelector('#reset-yesterday').onclick = () => {
  const block = document.querySelector('.past');
  discardPendingImport = loadPost.disabled;
  imported = [];
  reviewItems.replaceChildren();
  review.hidden = true;
  manualYesterday.hidden = false;
  block.querySelectorAll('.manual-task').forEach(row => row.remove());
  block.querySelectorAll('input[type=checkbox]').forEach(input => input.checked = false);
  block.querySelector('[name=past-count][value="0"]').checked = true;
  block.querySelectorAll('textarea, input[type=url]').forEach(input => input.value = '');
  block.querySelectorAll('#review-title, #post-status, #parse-status, #skipped-lines').forEach(el => el.textContent = '');
  block.querySelectorAll('details').forEach(el => el.open = el.classList.contains('import-bar'));
  render();
};
document.querySelector('#save-plan').onclick = () => {
  const invalid = plans.querySelector(':invalid');
  if (invalid) return invalid.reportValidity();
  statusLine.textContent = savePlan() ? 'План на сегодня сохранён.' : 'Браузер не разрешил сохранить план.';
};
window.addEventListener('focus', refreshPrevious);
refreshPrevious();
