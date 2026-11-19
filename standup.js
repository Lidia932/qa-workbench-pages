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
    const numbers = Array.from(plans.querySelectorAll('.number'), input => Number(input.value));
    row.querySelector('.number').value = Math.max(0, ...numbers) + 1;
    row.querySelector('.number').required = true;
  }
  for (const [login, name] of people) {
    if (lead) lead.add(new Option(name, login));
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.value = login;
    label.append(check, name);
    row.querySelector('.people').append(label);
  }
  row.querySelector('.remove').onclick = () => {
    row.remove();
    document.querySelector('#add-' + kind).focus();
    render();
  };
  plans.append(row);
  if (focus) row.querySelector('input').focus();
  render();
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

function today() {
  const entries = [];
  for (const row of plans.children) {
    const selected = Array.from(row.querySelectorAll('input:checked'), el => el.value);
    const parts = [];
    if (row.classList.contains('release')) {
      const number = row.querySelector('.number').value;
      if (!number) continue;
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
      titleInput.setCustomValidity(!title && (url.value || selected.length) ? 'Введите название задачи' : '');
      if (!title) continue;
      parts.push('Проведем приемку ', url.value && url.validity.valid ? {title, href: url.value} : title);
      if (selected.length) {
        parts.push(' QA ');
        appendPeople(parts, selected);
      }
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
    chip.textContent = '@' + people.get(part.login);
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
  const sections = [['Вчера', lines('#yesterday')], ['Сегодня', today()], ['Проблемы', lines('#problems')]];
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

document.querySelector('#add-release').onclick = () => addPlan('release');
document.querySelector('#add-task').onclick = () => addPlan('task');
document.querySelector('#fields').addEventListener('input', render);
document.querySelector('#copy').onclick = async () => {
  const text = render();
  const invalid = plans.querySelector(':invalid');
  if (invalid) return invalid.reportValidity();
  try {
    await navigator.clipboard.writeText(text);
    statusLine.textContent = 'Скопировано';
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
addPlan('task', false);
