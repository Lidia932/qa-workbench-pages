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
      if (title) items.push({title, href:row.querySelector('.url').value.trim()});
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
    const label = document.createElement('label');
    label.className = 'review-item';
    label.append(item.number ? 'Релиз ' + item.number : 'Приёмка · ' + item.title);
    const select = document.createElement('select');
    for (const [value, text] of [['','Выберите итог'],['yes','Провели'],['no','Не провели']]) select.add(new Option(text,value));
    label.append(select);
    reviewItems.append(label);
  }
  document.querySelector('#review-title').textContent = title;
  manualYesterday.hidden = true;
  review.hidden = false;
  render();
}
function reviewedRows() {
  const rows = [];
  const selects = reviewItems.querySelectorAll('select');
  imported.forEach((item,index) => {
    const value = selects[index].value;
    if (!value) return;
    const verb = value === 'yes' ? 'Провели' : 'Не провели';
    if (item.number) rows.push([verb + ' релиз №' + item.number]);
    else rows.push([verb + ' приемку ', /^https?:\/\//i.test(item.href || '') ? {title:item.title,href:item.href} : item.title]);
  });
  return rows;
}

function parseToday(body) {
  const items = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[*•–-]\s*/, '').trim();
    if (/^(?:провед[её]м\s+)?(?:2|два)\s+релиза(?:\s|$|[.,-])/i.test(line)) {
      items.push({number:'1'},{number:'2'});
      continue;
    }
    const release = line.match(/^(?:провед[её]м\s+)?(\d+)(?:-й)?\s+релиз(?:\s|$|[.,-])/i);
    if (release) { items.push({number:release[1]}); continue; }
    const acceptance = line.match(/^(?:провед[её]м\s+)?при[её]мк[ау]\s*(.*)$/i);
    if (!acceptance) continue;
    const task = acceptance[1].replace(/(?:^|\s+)QA(?:\s|:|$).*$/i,'').trim();
    const link = task.match(/^\[(.+)\]\((https?:\/\/[^\s]+)\)$/i);
    let href = '';
    if (link) { try { href = new URL(link[2]).href; } catch {} }
    items.push({title:link?.[1] || task || 'Без названия', href});
  }
  return items;
}
function importBody(body, title, status) {
  const items = parseToday(body);
  if (!items.length) {status.textContent = 'В разделе «Сегодня» не найдены релизы или приёмки.';return;}
  showReview(items, title);
  status.textContent = 'Загружено пунктов: ' + items.length;
}
const loadPost = document.querySelector('#load-post');
const postStatus = document.querySelector('#post-status');
loadPost.onclick = () => {
  postStatus.textContent = loadPost.dataset.ready ? 'Читаю сообщение…' : 'Установите QA Merge Checker 1.1.0 из каталога и обновите вкладку. Для чтения нужен вход в Platrum.';
};
loadPost.addEventListener('qa-standup-result', event => {
  const result = JSON.parse(event.detail);
  if (result.error) {postStatus.textContent = result.error;return;}
  importBody(result.today, 'План из Platrum', postStatus);
});
document.querySelector('#parse-chat').onclick = () => {
  const text = document.querySelector('#chat-text').value.replace(/^[ \t#*_]*(Сегодня|Проблемы|Вчера)\s*:?[ \t*_]*$/gim, '$1:');
  const body = text.match(/^Сегодня:\s*\n([\s\S]*?)(?=^(?:Проблемы|Вчера):|(?![\s\S]))/im)?.[1];
  const status = document.querySelector('#parse-status');
  if (!body) {status.textContent = 'Не найден раздел «Сегодня».';return;}
  importBody(body, 'План из сообщения', status);
};
previous.onclick = () => {
  const last = lastPlan();
  if (last) showReview(last.items, previous.textContent.replace('Взять сохранённый план', 'План'));
};
document.querySelector('#manual-mode').onclick = () => {review.hidden = true;manualYesterday.hidden = false;render();};
document.querySelector('#save-plan').onclick = () => {
  const invalid = plans.querySelector(':invalid');
  if (invalid) return invalid.reportValidity();
  statusLine.textContent = savePlan() ? 'План на сегодня сохранён.' : 'Браузер не разрешил сохранить план.';
};
window.addEventListener('focus', refreshPrevious);
refreshPrevious();
