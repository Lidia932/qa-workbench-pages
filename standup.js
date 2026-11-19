const people = new Map([
  ['alekseeva.li', 'Лидия Алексеева'],
  ['chibrikin.a', 'Александр Чибрикин'],
  ['sukhanov.yu', 'Юрий Суханов'],
  ['smirnova.ksu', 'Ксения Смирнова']
]);
const plans = document.querySelector('#plans');
const preview = document.querySelector('#preview');
const statusLine = document.querySelector('#status');

function addPlan(kind, focus = true) {
  const row = document.querySelector('#' + kind + '-template').content.firstElementChild.cloneNode(true);
  const lead = row.querySelector('.lead');
  if (lead) {
    row.dataset.number = plans.querySelectorAll('.release').length + 1;
    row.querySelector('strong').textContent = 'Релиз ' + row.dataset.number;
  }
  populatePeople(row);
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

function addAcceptancePeople(row, initial = []) {
  const field = document.createElement('fieldset');
  field.className = 'people';
  const legend = document.createElement('legend');
  legend.textContent = 'Ведёт приёмку';
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

function acceptanceParts(phrase, title, href, row) {
  const parts = [phrase + ' ', {title, href}];
  const qa = selectedPeople(row);
  if (qa.length) {
    parts.push(' QA ');
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

function manualTask(container) {
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
    if (container.querySelectorAll('.manual-task').length === 1) {
      document.getElementById(container.id.split('-')[0]).checked = false;
    }
    row.remove();
    render();
  };
  row.append(remove);
  addAcceptancePeople(row);
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
      const href = taskHref(row.querySelector('.url').value);
      if (title && href) rows.push(acceptanceParts(phrase, title, href, row));
    }
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
      if (!title || !url.validity.valid) continue;
      parts.push(...acceptanceParts('Проведем приемку', title, url.value, row));
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
  return blocks.join('\n\n');
}

document.querySelector('#add-task').onclick = () => addPlan('task');
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
addPlan('release', false);
addPlan('release', false);
