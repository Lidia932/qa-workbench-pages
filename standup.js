const people = new Map([
  ['alekseeva.li', 'Лидия Алексеева'],
  ['chibrikin.a', 'Александр Чибрикин'],
  ['sukhanov.yu', 'Юрий Суханов'],
  ['smirnova.ksu', 'Ксения Смирнова']
]);
const plans = document.querySelector('#plans');
const preview = document.querySelector('#preview');
const statusLine = document.querySelector('#status');
const messageText = document.querySelector('#message-text');
const editMessage = document.querySelector('#edit-message');
let generatedMessage = '';
let manuallyEdited = false;
const workActions = {start:'Начнем работу по', continue:'Продолжим работу по'};
const e2eOutcomes = {yes:'Провели E2E-тест по', no:'Не провели E2E-тест по', review:'E2E-тест на ревью:'};

function e2eStatus() {
  const select = document.createElement('select');
  select.setAttribute('aria-label','Итог E2E-теста');
  for (const [value, label] of [['','Выберите итог'],['yes','Провели'],['no','Не провели'],['review','На ревью']]) select.add(new Option(label,value));
  return select;
}

function addPlan(kind, focus = true) {
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
    row.dataset.number = plans.querySelectorAll('.release').length + 1;
    row.querySelector('strong').textContent = 'Релиз ' + row.dataset.number;
  }
  populatePeople(row, new Map(), lead ? [...people.keys()] : []);
  if (!lead) row.querySelector('.remove').onclick = () => {
    row.remove();
    document.querySelector('#add-' + kind).focus();
    render();
  };
  plans.append(row);
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

function manualTask(container, e2e = false) {
  const row = document.createElement('div');
  row.className = 'manual-task';
  for (const [name, caption] of [['task-name','Название задачи'],['url','Ссылка на задачу']]) {
    const input = document.createElement('input');
    input.className = name;
    input.placeholder = caption;
    input.setAttribute('aria-label', caption);
    input.required = true;
    if (name === 'url') {input.type = 'url';input.pattern = 'https?://.+';}
    row.append(input);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '×';
  remove.setAttribute('aria-label','Убрать задачу');
  remove.onclick = () => {
    if (!e2e && container.querySelectorAll('.manual-task').length === 1) {
      document.getElementById(container.id.split('-')[0]).checked = false;
    }
    row.remove();
    render();
  };
  row.append(remove);
  if (e2e) row.prepend(e2eStatus());
  addAcceptancePeople(row, [], e2e ? 'Исполнители' : 'Ведёт приёмку');
  container.insertBefore(row, container.querySelector('.add-manual'));
  return row;
}

function validStandup() {
  const invalid = Array.from(document.querySelectorAll('#fields input, #fields textarea'))
    .find(input => !input.closest('[hidden]') && !input.validity.valid);
  if (!invalid) return true;
  invalid.reportValidity();
  return false;
}

function yesterday() {
  if (!document.querySelector('#review').hidden) return reviewedRows().concat(lines('#yesterday'));
  const rows = [];
  const n = document.querySelector('[name="past-count"]:checked').value;
  if (n !== '0') rows.push([n === '1' ? 'Провели 1 релиз' : 'Провели 2 релиза']);
  for (const [id, phrase] of [['accepted', 'Провели приемку'], ['deferred', 'Не провели приемку']]) {
    const active = document.getElementById(id).checked;
    const container = document.getElementById(id + '-tasks');
    container.hidden = !active;
    if (!active) continue;
    if (!container.querySelector('.manual-task')) manualTask(container);
    for (const row of container.querySelectorAll('.manual-task')) {
      const title = row.querySelector('.task-name').value.trim();
      row.querySelector('.task-name').setCustomValidity(title ? '' : 'Введите название задачи');
      const href = checkTaskLink(row.querySelector('.url'));
      if (title) rows.push(taskParts(phrase, title, href, row));
    }
  }
  for (const row of document.querySelectorAll('#past-e2e .manual-task')) {
    const phase = row.querySelector('select').value;
    const title = row.querySelector('.task-name');
    const url = row.querySelector('.url');
    title.required = url.required = Boolean(phase);
    title.setCustomValidity(phase && !title.value.trim() ? 'Введите название задачи' : '');
    const href = checkTaskLink(url, Boolean(phase));
    if (phase && title.value.trim()) rows.push(taskParts(e2eOutcomes[phase], title.value.trim(), href, row, true));
  }
  return rows.concat(lines('#yesterday'));
}

function today() {
  const entries = [];
  for (const row of plans.children) {
    const selected = Array.from(row.querySelectorAll('input:checked'), el => el.value);
    const parts = [];
    if (row.classList.contains('release')) {
      const number = row.dataset.number;
      row.hidden = Number(number) > Number(document.querySelector('[name="today-count"]:checked').value);
      if (row.hidden) continue;
      parts.push('Проведем ' + number + ' релиз');
      const lead = row.querySelector('.lead').value;
      if (lead) parts.push(' - ведет ', {login: lead});
      if (selected.length) {
        parts.push(lead ? ', участвуют ' : ' - участвуют ');
        appendPeople(parts, selected);
      }
    } else {
      const titleInput = row.querySelector('.task-name');
      const url = row.querySelector('.url');
      const title = titleInput.value.trim();
      titleInput.setCustomValidity(!title ? 'Введите название задачи' : '');
      const href = checkTaskLink(url);
      if (!title) continue;
      const action = row.querySelector('.work-action');
      parts.push(...taskParts(action ? workActions[action.value] : 'Проведем приемку', title, href, row, Boolean(action)));
    }
    entries.push(parts);
  }
  return entries.concat(lines('#other'));
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
  if (!messageText.hidden && !manuallyEdited) messageText.value = generatedMessage;
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

document.querySelector('#add-task').onclick = () => addPlan('task');
document.querySelector('#add-e2e').onclick = () => addPlan('e2e');
document.querySelector('#add-past-e2e').onclick = () => {
  manualTask(document.querySelector('#past-e2e'), true).querySelector('.task-name').focus();
  render();
};
document.querySelector('#reset-today').onclick = () => {
  plans.querySelectorAll('.task').forEach(row => row.remove());
  for (const lead of plans.querySelectorAll('.lead')) lead.value = '';
  for (const input of plans.querySelectorAll('.release .people input')) input.checked = true;
  document.querySelector('[name=today-count][value="1"]').checked = true;
  document.querySelector('#other').value = '';
  document.querySelector('.current details').open = false;
  render();
};
document.querySelector('#reset-problems').onclick = () => {
  document.querySelector('#problems').value = '';
  render();
};
for (const container of document.querySelectorAll('#accepted-tasks, #deferred-tasks')) {
  const add = document.createElement('button');
  add.textContent = '+ Ещё задача';
  add.className = 'add-manual';
  add.onclick = () => {manualTask(container).querySelector('input').focus();render();};
  container.append(add);
}
document.querySelector('#fields').addEventListener('input', render);
document.querySelector('#copy').onclick = async () => {
  const text = render();
  if (!text.trim()) {
    statusLine.textContent = 'Сообщение пустое.';
    messageText.focus();
    return;
  }
  if (!validStandup()) return;
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
