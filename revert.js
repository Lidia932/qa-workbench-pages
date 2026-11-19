const defaultNames = new Map([
  ['@fedotov.a', 'Александр Федотов'],
  ['@govorov.v', 'Вадим Говоров-Калинюк'],
  ['@grigorieva.o', 'Ольга Григорьева'],
  ['@kharkov.p', 'Павел Харьков'],
  ['@kondratov.d', 'Дмитрий Кондратов'],
  ['@konnov.a', 'Александр Коннов'],
  ['@kozlov.n', 'Никита Козлов'],
  ['@odegov.a', 'Александр Одегов'],
  ['@okhotnikov.a', 'Артём Охотников'],
  ['@petrov.an', 'Андрей Петров'],
  ['@trubinov.a', 'Алексей Трубинов'],
  ['@zakharov.i', 'Илья Захаров']
]);
const retiredLogins = new Set(["@faust.v","@fedoseev.m","@gubkin.vi","@hi","@homyakov.a","@kn","@lg","@lobashkov.p","@mukhametshin.a","@panchenko.s","@petrunenkova.s","@plesheshnikova.a","@ponomarev.a","@safronova.d","@shironosova.a","@spitsyna.i","@unychenko.d","@usov.a","@yarullina.a"]);
const storageKey = 'revertForm.developers.v2';
const form = document.querySelector('#RevertForm');
const search = document.querySelector('#devSearchInput');
const picker = document.querySelector('#devSearch');
const list = document.querySelector('#devSearchList');
const editor = document.querySelector('#devListEditor');
const editorStatus = document.querySelector('#editor-status');
const copyStatus = document.querySelector('#copy-status');
let selected = '';
let developers = loadDirectory();

function parseDirectory(lines) {
  const result = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    const [handle, ...parts] = line.trim().split(/\s+/);
    const login = '@' + handle.replace(/^@/, '').toLowerCase();
    if (!/^@[a-z0-9._-]+$/.test(login)) throw new Error('Проверьте логин в строке «' + line.trim() + '».');
    const name = parts.join(' ') || defaultNames.get(login) || '';
    if (!result.has(login)) result.set(login, name);
  }
  return result;
}

function loadDirectory() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) return parseDirectory(saved);
    const old = JSON.parse(localStorage.getItem('revertForm.developers.v1'));
    if (Array.isArray(old) && old.length) {
      const migrated = parseDirectory(old);
      for (const login of retiredLogins) migrated.delete(login);
      return migrated;
    }
  } catch { /* Use the built-in directory when storage is unavailable. */ }
  return new Map(defaultNames);
}

function asLines(directory) {
  return Array.from(directory, ([login, name]) => name ? login + ' ' + name : login);
}

function renderList(query = '') {
  const filter = query.toLocaleLowerCase('ru').trim();
  const matches = [...developers].filter(([login, name]) =>
    (name + ' ' + login).toLocaleLowerCase('ru').includes(filter));
  matches.sort((a,b) => (a[1] || a[0]).localeCompare(b[1] || b[0], 'ru'));
  list.replaceChildren();
  for (const [login, name] of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'item';
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(selected === login));
    button.textContent = name || login;
    button.title = login;
    button.onclick = () => choose(login);
    list.append(button);
  }
  if (!matches.length) list.textContent = 'Никого не нашли';
}

function openList() {
  picker.dataset.open = '1';
  search.setAttribute('aria-expanded', 'true');
  renderList(search.value === (developers.get(selected) || selected) ? '' : search.value);
}
function closeList() {
  picker.dataset.open = '0';
  search.setAttribute('aria-expanded', 'false');
  search.value = developers.get(selected) || selected;
}
function choose(login) {
  selected = selected === login ? '' : login;
  search.setCustomValidity('');
  search.focus();
  closeList();
  updateMessage();
}
search.addEventListener('focus', openList);
search.addEventListener('click', openList);
search.addEventListener('input', () => {
  selected = '';
  search.setCustomValidity('');
  openList();
});
picker.addEventListener('keydown', event => {
  const options = [...list.querySelectorAll('.item')];
  if (event.key === 'Escape') {
    search.focus();
    closeList();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (picker.dataset.open !== '1') openList();
    const buttons = [...list.querySelectorAll('.item')];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? index + 1 : (index < 1 ? buttons.length - 1 : index - 1);
    buttons[next % buttons.length]?.focus();
  } else if (event.key === 'Enter' && event.target === search) {
    event.preventDefault();
    if (picker.dataset.open !== '1') { openList(); return; }
    if (options.length === 1) options[0].click();
    else options[0]?.focus();
  }
});
picker.addEventListener('focusout', event => {
  if (!picker.contains(event.relatedTarget)) closeList();
});
document.addEventListener('click', event => {
  if (!picker.contains(event.target)) closeList();
});

function saveDirectory(directory) {
  try { localStorage.setItem(storageKey, JSON.stringify(asLines(directory))); }
  catch { editorStatus.textContent = 'Браузер не разрешил сохранить список.'; return; }
  developers = directory;
  if (!developers.has(selected)) selected = '';
  editor.value = asLines(directory).join('\n');
  editorStatus.textContent = 'Список сохранён в этом браузере.';
  closeList();
  updateMessage();
}
function saveDevelopersFromEditor() {
  try { saveDirectory(parseDirectory(editor.value.split('\n'))); }
  catch (error) { editorStatus.textContent = error.message; }
}
function resetDevelopersToDefault() { saveDirectory(new Map(defaultNames)); }
function sortDevelopers() {
  try {
    const rows = [...parseDirectory(editor.value.split('\n'))];
    rows.sort((a,b) => (a[1] || a[0]).localeCompare(b[1] || b[0], 'ru'));
    editor.value = asLines(new Map(rows)).join('\n');
  } catch (error) { editorStatus.textContent = error.message; }
}
function dedupeDevelopers() {
  try { editor.value = asLines(parseDirectory(editor.value.split('\n'))).join('\n'); }
  catch (error) { editorStatus.textContent = error.message; }
}
function trimDevelopers() {
  editor.value = editor.value.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}

function clearField(id) {
  const field = document.getElementById(id);
  field.value = '';
  field.focus();
  updateMessage();
}
function updateMessage() {
  const fields = form.elements;
  for (const field of [fields.pr, fields.commit, fields.prichina]) {
    field.closest('.clearable').dataset.hasvalue = field.value ? '1' : '0';
  }
  const rows = [
    ['PR', fields.pr.value.trim()],
    ['Коммит', fields.commit.value.trim() || '-'],
    ['Разработчик', selected],
    ['Причина', fields.prichina.value.trim()],
    ['Где', fields.where.value]
  ];
  document.querySelector('#output').textContent = rows.map(([label,value]) => '**' + label + ':** ' + (value || '—')).join('\n');
  copyStatus.textContent = '';
}
form.addEventListener('input', updateMessage);
form.addEventListener('submit', event => event.preventDefault());
document.querySelector('#copy').onclick = async () => {
  search.setCustomValidity(selected ? '' : 'Выберите разработчика из списка.');
  if (!form.reportValidity()) return;
  try {
    await navigator.clipboard.writeText(document.querySelector('#output').textContent);
    copyStatus.textContent = 'Скопировано';
  } catch { copyStatus.textContent = 'Выделите сообщение и скопируйте вручную.'; }
};
editor.value = asLines(developers).join('\n');
updateMessage();
