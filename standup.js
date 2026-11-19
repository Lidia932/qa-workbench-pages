const people = new Map([
  ['alekseeva.li', 'Лидия Алексеева'],
  ['chibrikin.a', 'Александр Чибрикин'],
  ['sukhanov.yu', 'Юрий Суханов'],
  ['smirnova.ksu', 'Ксения Смирнова']
]);
const plans = document.querySelector('#plans');
const pastPlans = document.querySelector('#past-plans');
const preview = document.querySelector('#preview');
const statusLine = document.querySelector('#status');
const messageText = document.querySelector('#message-text');
const editMessage = document.querySelector('#edit-message');
let generatedMessage = '';
let manuallyEdited = false;
const workActions = {start:'Начнем работу по', continue:'Продолжим работу по'};
const e2eOutcomes = {yes:'Провели E2E-тест по', no:'Не провели E2E-тест по', review:'E2E-тест на ревью:'};

function outcomeSelect(e2e) {
  const select = document.createElement('select');
  select.className = 'outcome-select';
  select.add(new Option('Выберите итог', ''));
  select.add(new Option('Провели', 'yes'));
  select.add(new Option('Не провели', 'no'));
  if (e2e) select.add(new Option('На ревью', 'review'));
  return select;
}

function addPlan(kind, container, focus = true) {
  const row = document.querySelector(kind === 'release' ? '#release-template' : '#task-template').content.firstElementChild.cloneNode(true);
  if (kind === 'e2e') {
    row.classList.add('e2e');
    row.querySelector('strong').textContent = 'E2E-тест';
    row.querySelector('.people legend').textContent = 'Исполнители';
    const remove = row.querySelector('.remove');
    remove.title = 'Удалить E2E-тест';
    remove.setAttribute('aria-label', remove.title);
    const label = document.createElement('label');
    label.append('План работы');
    const action = document.createElement('select');
    action.className = 'work-action';
    for (const [value,text] of Object.entries(workActions)) action.add(new Option(text,value));
    label.append(action);
    row.querySelector('.plan-head').after(label);
  }
  const lead = row.querySelector('.lead');
  if (lead) {
    row.dataset.number = container.querySelectorAll('.release').length + 1;
    row.querySelector('strong').textContent = 'Релиз ' + row.dataset.number;
  }
  populatePeople(row, new Map(), lead ? [...people.keys()] : []);
  if (!lead) row.querySelector('.remove').onclick = () => {
    row.remove();
    document.querySelector((container === pastPlans ? '#add-past-' : '#add-') + kind).focus();
    render();
  };
  if (container === pastPlans) {
    const label = document.createElement('label');
    label.append('Итог', outcomeSelect(kind === 'e2e'));
    row.append(label);
  }
  container.append(row);
  if (focus) row.querySelector('input').focus();
  render();
}

function selectedPeople(row) {
  return Array.from(row.querySelectorAll('.people input:checked'), el => el.value);
}

function addAcceptancePeople(row, initial = [], caption = 'Ведёт приёмку') {
  const field = document.createElement('fieldset');
  field.className = 'people';
  const legend = document.createElement('legend');
  legend.textContent = caption;
  field.append(legend);
  row.append(field);
  populatePeople(row, new Map(), initial);
}

function populatePeople(row, rename = new Map(), initial = selectedPeople(row)) {
  const lead = row.querySelector('.lead');
  const previous = lead?.value;
  const selected = new Set(initial.map(login => rename.get(login) ?? login).filter(Boolean));
  if (lead) lead.replaceChildren(new Option('Выбрать', ''));
  row.querySelectorAll('.people label').forEach(label => label.remove());
  for (const login of new Set([...people.keys(), ...selected])) {
    const name = people.get(login) || '@' + login;
    if (lead) lead.add(new Option(name, login));
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.value = login;
    check.checked = selected.has(login);
    label.append(check, name);
    row.querySelector('.people').append(label);
  }
  if (lead) lead.value = people.has(rename.get(previous) ?? previous) ? (rename.get(previous) ?? previous) : '';
}

function lines(id) {
  return document.querySelector(id).value.split(/\r?\n/)
    .map(line => line.trim().replace(/^[*-]\s+/, '')).filter(Boolean)
    .map(text => [text]);
}

function appendPeople(parts, logins) {
  logins.forEach((login, index) => {
    if (index) parts.push(', ');
    parts.push({login});
  });
}

function taskParts(phrase, title, href, row, e2e = false) {
  const parts = [phrase + ' ', href ? {title, href} : title];
  const qa = selectedPeople(row);
  if (qa.length) {
    parts.push(e2e ? ' ' : ' QA ');
    appendPeople(parts, qa);
  }
  return parts;
}

function taskHref(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function checkTaskLink(input, active = true) {
  const href = taskHref(input.value);
  const invalid = active && (!href || input.validity.patternMismatch || input.validity.typeMismatch);
  const message = invalid ? 'Введите полную ссылку на задачу с https:// или http://.' : '';
  input.setCustomValidity(message);
  input.setAttribute('aria-invalid', String(invalid));
  let hint = input.nextElementSibling;
  if (invalid && !hint?.classList.contains('link-error')) {
    hint = document.createElement('small');
    hint.className = 'link-error';
    hint.id = 'task-link-error-' + (++linkErrorId);
    input.after(hint);
    input.setAttribute('aria-describedby', hint.id);
  }
  if (hint?.classList.contains('link-error')) {
    hint.textContent = message;
    hint.hidden = !invalid;
  }
  return invalid ? '' : href;
}
let linkErrorId = 0;

function validStandup() {
  const invalid = Array.from(document.querySelectorAll('#fields input, #fields textarea'))
    .find(input => !input.validity.valid && !input.closest('[hidden]') &&
      input.closest('.plan')?.querySelector('.outcome-select')?.value !== '');
  if (!invalid) return true;
  invalid.reportValidity();
  return false;
}

function yesterday() {
  if (!document.querySelector('#review').hidden) return reviewedRows().concat(lines('#yesterday'));
  const count = document.querySelector('[name="past-count"]:checked').value;
  const releases = count === '0' ? [] : [[count === '1' ? 'Провели 1 релиз' : 'Провели 2 релиза']];
  return releases.concat(planRows(pastPlans), lines('#yesterday'));
}

function today() {
  const count = Number(document.querySelector('[name="today-count"]:checked').value);
  return planRows(plans, count).concat(lines('#other'));
}

function planRows(container, releaseCount = 0) {
  const entries = [];
  for (const row of container.children) {
    if (row.classList.contains('release')) {
      const number = row.dataset.number;
      row.hidden = Number(number) > releaseCount;
      if (row.hidden) continue;
      const parts = ['Проведем ' + number + ' релиз'];
      const lead = row.querySelector('.lead').value;
      if (lead) parts.push(' - ведет ', {login: lead});
      const selected = selectedPeople(row);
      if (selected.length) {
        parts.push(lead ? ', участвуют ' : ' - участвуют ');
        appendPeople(parts, selected);
      }
      entries.push(parts);
      continue;
    }

    const outcome = row.querySelector('.outcome-select')?.value;
    const verb = outcome === 'no' ? 'Не провели' : 'Провели';
    const active = outcome !== '';
    const titleInput = row.querySelector('.task-name');
    const title = titleInput.value.trim();
    titleInput.setCustomValidity(active && !title ? 'Введите название задачи' : '');
    const url = row.querySelector('.url');
    url.required = active;
    const href = checkTaskLink(url, active);
    if (!active || !title) continue;

    const action = row.querySelector('.work-action');
    let phrase = outcome ? verb + ' приемку' : 'Проведем приемку';
    if (action) {
      phrase = workActions[action.value];
      if (outcome === 'review') phrase = e2eOutcomes.review;
      if (outcome === 'yes') phrase = action.value === 'start' ? 'Начали работу по' : 'Продолжили работу по';
      if (outcome === 'no') phrase = action.value === 'start' ? 'Не начали работу по' : 'Не продолжили работу по';
    }
    entries.push(taskParts(phrase, title, href, row, Boolean(action)));
  }
  return entries;
}

function previewPart(part) {
  if (typeof part === 'string') return part;
  if (part.login) {
    const chip = document.createElement('span');
    chip.className = 'mention';
    chip.textContent = '@' + (people.get(part.login) || part.login);
    return chip;
  }
  const link = document.createElement('a');
  link.href = part.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = part.title;
  return link;
}

function markdown(part) {
  if (typeof part === 'string') return part;
  if (part.login) return '@' + part.login;
  const title = part.title.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
  const href = new URL(part.href).href.replaceAll('(', '%28').replaceAll(')', '%29');
  return '[' + title + '](' + href + ')';
}

function render() {
  preview.replaceChildren();
  statusLine.textContent = '';
  document.querySelector('#manual-copy').hidden = true;
  const sections = [['Вчера', yesterday()], ['Сегодня', today()], ['Проблемы', lines('#problems')]];
  const blocks = [];
  for (const [name, rows] of sections) {
    const heading = document.createElement('strong');
    heading.textContent = name + ':';
    const list = document.createElement('ul');
    if (!rows.length) rows.push(['—']);
    for (const parts of rows) {
      const item = document.createElement('li');
      item.append(...parts.map(previewPart));
      list.append(item);
    }
    preview.append(heading, list);
    blocks.push('**' + name + ':**\n' + rows.map(parts => '* ' + parts.map(markdown).join('')).join('\n'));
  }
  generatedMessage = blocks.join('\n\n');
  if (!manuallyEdited) messageText.value = generatedMessage;
  return messageText.hidden ? generatedMessage : messageText.value;
}

editMessage.onclick = () => {
  if (!messageText.hidden && manuallyEdited && !window.confirm('Заменить ваши правки текущим текстом из формы?')) return;
  const editing = messageText.hidden;
  manuallyEdited = false;
  messageText.hidden = !editing;
  preview.hidden = editing;
  editMessage.textContent = editing ? 'Вернуться к тексту из формы' : 'Редактировать';
  editMessage.setAttribute('aria-expanded', String(editing));
  render();
  if (editing) messageText.focus();
};
messageText.oninput = () => {
  manuallyEdited = messageText.value !== generatedMessage;
  statusLine.textContent = '';
  document.querySelector('#manual-copy').hidden = true;
};

for (const kind of ['task', 'e2e']) {
  document.querySelector('#add-' + kind).onclick = () => addPlan(kind, plans);
  document.querySelector('#add-past-' + kind).onclick = () => addPlan(kind, pastPlans);
}
function resetPlanRows(container) {
  container.querySelectorAll('.task').forEach(row => row.remove());
  for (const select of container.querySelectorAll('select')) select.value = '';
  for (const input of container.querySelectorAll('.release .people input')) input.checked = true;
}
document.querySelector('#reset-today').onclick = () => {
  resetPlanRows(plans);
  document.querySelector('[name=today-count][value="1"]').checked = true;
  document.querySelector('#other').value = '';
  document.querySelector('.current details').open = false;
  render();
};
document.querySelector('#reset-problems').onclick = () => {
  document.querySelector('#problems').value = '';
  render();
};
document.querySelector('#fields').addEventListener('input', render);
function outgoingMessage() {
  const text = render();
  if (!text.trim()) {
    statusLine.textContent = 'Сообщение пустое.';
    messageText.focus();
    return;
  }
  if (validStandup()) return text;
}
document.querySelector('#copy').onclick = async () => {
  const text = outgoingMessage();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    statusLine.textContent = savePlan() ? 'Скопировано. План сохранён.' : 'Скопировано. Сохранить план в браузере не удалось.';
  } catch {
    const manual = document.querySelector('#manual-copy');
    manual.hidden = false;
    manual.value = text;
    manual.focus();
    manual.select();
    statusLine.textContent = 'Выделенный текст можно скопировать вручную.';
  }
};
const sendStandup = document.querySelector('#send-standup');
sendStandup.addEventListener('click', event => {
  if (!outgoingMessage()) {
    event.stopImmediatePropagation();
    return;
  }
  statusLine.textContent = sendStandup.dataset.ready
    ? 'Отправка в qa-standup…'
    : 'Для отправки установите QA Merge Checker 1.5.0 и обновите вкладку.';
}, {capture: true});
sendStandup.addEventListener('qa-standup-sent', event => {
  const result = JSON.parse(event.detail);
  if (!/^[a-z0-9]{26}$/.test(result.id)) {
    statusLine.textContent = result.error || 'Не удалось подтвердить отправку.';
    return;
  }
  const link = document.createElement('a');
  link.href = 'https://roistat.chat.platrum.ru/c9d2f3fa6bb6d63bbd9f589250d36698/pl/' + result.id;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Открыть сообщение';
  statusLine.replaceChildren('Отправлено в qa-standup. ', link);
});
