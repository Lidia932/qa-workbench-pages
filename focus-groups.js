const commands = {
  account: [
    ['Добавить ФГ', 'add_user_to_focus_group', ['account', 'fg', 'reason']],
    ['Снять ФГ', 'remove_user_from_focus_group', ['account', 'fg', 'reason']]
  ],
  market: [
    ['Добавить ФГ', 'add_project_to_marketplace_focus_group', ['project', 'integration', 'fg', 'reason']],
    ['Снять ФГ', 'remove_project_from_marketplace_focus_group', ['project', 'integration', 'fg', 'reason']]
  ],
  all: [
    ['Снять у всех пользователей', 'remove_all_users_from_focus_groups', ['groups', 'reason']]
  ],
  other: [
    ['Посмотреть ФГ аккаунта', 'show_user_focus_groups', ['account']],
    ['Посмотреть ФГ проекта в маркетплейсе', 'show_project_marketplace_focus_groups', ['project', 'integration']],
    ['Найти пользователей с ФГ', 'get_users_with_focus_group', ['users', 'fg']],
    ['Найти пользователей без ФГ по визитам', 'get_users_without_focus_group_by_visits', ['users', 'fg', 'visits', 'date', 'reason']],
    ['Найти пользователей с рекламным каналом без ФГ', 'get_users_with_active_channel_without_focus_group', ['users', 'fg', 'channel', 'date']],
    ['Получить проекты пользователей', 'get_projects_by_users', ['accounts']],
    ['Найти проекты с интеграцией без ФГ', 'get_projects_with_integration', ['projects', 'integration', 'fg']],
    ['Найти проекты с ФГ маркетплейса', 'get_projects_with_marketplace_focus_group', ['projects', 'integration', 'fg', 'date']],
    ['Добавить пользователей в ФГ для теста', 'add_users_to_focus_group_for_test', ['users', 'fg', 'replace', 'date', 'integrationFilter', 'reason']],
    ['Добавить проекты в ФГ маркетплейса для теста', 'add_projects_to_marketplace_focus_group_for_test', ['projects', 'fg', 'date', 'integration', 'reason']],
    ['Снять ФГ у всех проектов с интеграцией', 'remove_all_project_from_marketplace_focus_group', ['integration', 'fg', 'reason']],
    ['Подготовить команду СМС', 'send_sms', ['account', 'phone', 'message']],
    ['Показать справку ERP', 'help', []]
  ]
};

const fields = {
  account: {label: 'ID аккаунта', type: 'ids'},
  project: {label: 'ID проекта', type: 'number'},
  integration: {label: 'ID интеграции', type: 'number'},
  integrationFilter: {label: 'ID интеграции', type: 'number', hint: 'Укажите 0, чтобы выбрать пользователей без фильтра по интеграции.'},
  fg: {label: 'Название ФГ', type: 'token'},
  groups: {label: 'Название ФГ', type: 'groups', hint: 'Несколько ФГ можно перечислить через запятую.'},
  reason: {label: 'Комментарий'},
  users: {label: 'Количество пользователей', type: 'number'},
  projects: {label: 'Количество проектов', type: 'number'},
  accounts: {label: 'ID аккаунтов через запятую', type: 'ids'},
  visits: {label: 'Минимум визитов', type: 'number'},
  date: {label: 'Дата последнего входа, начиная с', type: 'date'},
  channel: {label: 'Тип рекламного канала', type: 'token'},
  replace: {label: 'Заменить текущих участников ФГ', type: 'token', hint: 'Значение параметра IS_REMOVE_OLD_RELEASE.'},
  phone: {label: 'Номер телефона', type: 'token'},
  message: {label: 'Текст СМС'}
};

const patterns = {
  number: '[0-9]+',
  ids: '[0-9]+(,[0-9]+)*',
  token: '\\S+',
  groups: '[^,\\s]+(,[^,\\s]+)*'
};
const form = document.querySelector('#builder');
const operation = document.querySelector('#operation');
const args = document.querySelector('#arguments');
const preview = document.querySelector('#preview');
const status = document.querySelector('#status');
const drafts = new Map();
const lastAction = new Map();
let group;
let current;
const recentKey = 'roistat-qa.fg.recent.v1';
const accountKey = 'roistat-qa.fg.account.v1';
const defaultField = document.querySelector('#default-account');
const send = document.querySelector('#send-command');
let sentCommand = '';
let pendingGroups = null;

function readLocal(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
let defaultAccount = readLocal(accountKey) || '';
if (!/^\d+$/.test(defaultAccount)) defaultAccount = '';
defaultField.value = defaultAccount;

const savedKey = 'roistat-qa.fg.saved.v1';
const listStatus = document.querySelector('#list-status');
function readNames(key) {
  try {
    const value = JSON.parse(readLocal(key));
    return Array.isArray(value) ? value.filter(name => typeof name === 'string' && name && !/\s/.test(name)) : [];
  } catch { return []; }
}
let recent = readNames(recentKey).slice(0, 20);
let saved = readNames(savedKey);
const lookupId = document.querySelector('#lookup-id');
const lookupButton = document.querySelector('#lookup-button');
const lookupStatus = document.querySelector('#lookup-status');
const useDefaultId = document.querySelector('#use-default-id');
let accountGroups = [];
let selectedGroup = '';
const groupFilter = document.querySelector('#group-filter');
const groupButtons = document.querySelector('#account-list');
const stButton = document.querySelector('#st-button');
const stProject = document.querySelector('#st-project');
lookupId.value = defaultAccount;
useDefaultId.disabled = !defaultAccount;
function renderAccountGroups() {
  document.querySelector('#group-browser').hidden = !accountGroups.length;
  const query = groupFilter.value.trim().toLowerCase();
  const matches = accountGroups.filter(name => name.toLowerCase().includes(query));
  if (!matches.includes(selectedGroup)) selectedGroup = '';
  groupButtons.replaceChildren(...matches.map(name => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.setAttribute('aria-pressed', String(name === selectedGroup));
    return button;
  }));
  document.querySelector('#group-count').textContent = query
    ? 'Найдено: ' + matches.length + ' из ' + accountGroups.length
    : 'Выберите название для копирования, подстановки или сохранения.';
  renderGroupActions();
}
function renderGroupActions() {
  const actions = document.querySelector('#group-actions');
  actions.replaceChildren();
  if (selectedGroup) actions.append(listRow(selectedGroup, 'account'));
}
groupButtons.onclick = event => {
  if (event.target.tagName !== 'BUTTON') return;
  groupButtons.querySelector('[aria-pressed=true]')?.setAttribute('aria-pressed', 'false');
  selectedGroup = event.target.textContent;
  event.target.setAttribute('aria-pressed', 'true');
  renderGroupActions();
};
groupFilter.oninput = renderAccountGroups;
function clearLookup() {
  accountGroups = [];
  selectedGroup = '';
  groupFilter.value = '';
  lookupStatus.textContent = '';
  renderAccountGroups();
}
function resetLookupAccount() { stProject.value = ''; clearLookup(); }
lookupId.addEventListener('input', resetLookupAccount);
useDefaultId.onclick = () => { lookupId.value = defaultAccount; resetLookupAccount(); };
document.querySelector('#account-lookup').onsubmit = event => {
  event.preventDefault();
  if (!stButton.dataset.ready) lookupStatus.textContent = 'Для ST обновите QA Merge Checker до 1.4.0 и перезагрузите страницу.';
};
lookupButton.addEventListener('fg-lookup-start', () => {
  clearLookup();
  lookupStatus.textContent = 'Читаю карточку ST для аккаунта ' + lookupId.value + '…';
  stProject.disabled = stButton.disabled = lookupId.readOnly = lookupButton.disabled = useDefaultId.disabled = true;
});
lookupButton.addEventListener('fg-lookup-result', event => {
  const result = JSON.parse(event.detail);
  stProject.disabled = stButton.disabled = lookupId.readOnly = lookupButton.disabled = false;
  useDefaultId.disabled = !defaultAccount;
  if (result.account !== lookupId.value) { clearLookup(); return; }
  if (result.needProject) {
    document.querySelector('#st-settings').open = true;
    stProject.focus();
  }
  if (result.project) stProject.value = result.project;
  accountGroups = result.groups || [];
  renderAccountGroups();
  lookupStatus.textContent = result.error || ('Аккаунт ' + result.account + (accountGroups.length ? ' · ФГ: ' + accountGroups.length : ' · Нет ФГ') + (result.project ? ' · ST' : ' · tools-product'));
});
function usedGroups() {
  if (form.elements.groups) return form.elements.groups.value.split(',').map(name => name.trim()).filter(Boolean);
  return form.elements.fg ? [form.elements.fg.value.trim()] : [];
}
function remember(names) {
  if (!names.length) return;
  recent = [...new Set([...names, ...readNames(recentKey), ...recent])].slice(0, 20);
  try { localStorage.setItem(recentKey, JSON.stringify(recent)); } catch { /* Keep suggestions for this tab. */ }
  renderLibraries();
}

function editSaved(name, remove = false) {
  const previous = readNames(savedKey);
  const next = remove ? previous.filter(item => item !== name) : [...new Set([name, ...previous])];
  try { localStorage.setItem(savedKey, JSON.stringify(next)); }
  catch { listStatus.textContent = 'Браузер не разрешил сохранить список.'; return false; }
  saved = next;
  listStatus.textContent = remove ? 'ФГ удалена из сохранённых.' : 'ФГ сохранена.';
  renderLibraries();
  return true;
}
function listRow(name, source) {
  const row = document.createElement('li');
  const code = document.createElement('code');
  code.textContent = name;
  row.append(code);
  function action(text, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', text + ' ' + name);
    button.onclick = handler;
    row.append(button);
    return button;
  }
  action('Копировать', async () => {
    try {
      await navigator.clipboard.writeText(name);
      listStatus.textContent = 'Скопировано: ' + name;
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      listStatus.textContent = 'Название выделено для ручного копирования.';
    }
  });
  const input = form.elements.fg || form.elements.groups;
  if (input) action('В команду', () => {
    input.value = input.name === 'groups'
      ? [...new Set([...usedGroups(), name])].join(',') : name;
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.focus();
  });
  if (source === 'saved') action('Убрать', () => editSaved(name, true));
  else if (!saved.includes(name)) action('Сохранить', () => editSaved(name));
  return row;
}
function renderLibraries() {
  for (const [source, names] of [['recent', recent], ['saved', saved]]) {
    document.querySelector('#' + source + '-list').replaceChildren(...names.map(name => listRow(name, source)));
    document.querySelector('#' + source + '-empty').hidden = Boolean(names.length);
  }
  renderAccountGroups();
}
document.querySelector('#save-group').onsubmit = event => {
  event.preventDefault();
  if (editSaved(event.target.elements.name.value.trim())) event.target.reset();
};

document.querySelector('#defaults').onsubmit = event => {
  event.preventDefault();
  const value = defaultField.value.trim();
  const note = document.querySelector('#default-status');
  try {
    localStorage.setItem(accountKey, value);
    if (!lookupId.readOnly && (!lookupId.value || lookupId.value === defaultAccount)) {
      lookupId.value = value;
      resetLookupAccount();
    }
    defaultAccount = value;
    useDefaultId.disabled = !value || lookupId.readOnly;
    showCommand();
    note.textContent = value ? 'ID сохранён в этом браузере.' : 'ID по умолчанию удалён.';
  } catch { note.textContent = 'Браузер не разрешил сохранить ID.'; }
};
window.addEventListener('storage', event => {
  if (event.key === recentKey || event.key === savedKey || event.key === null) {
    recent = readNames(recentKey).slice(0, 20);
    saved = readNames(savedKey);
    renderLibraries();
  }
  if (event.key === accountKey) {
    defaultAccount = /^\d+$/.test(event.newValue || '') ? event.newValue : '';
    useDefaultId.disabled = !defaultAccount || lookupId.readOnly;
    defaultField.value = defaultAccount;
    showCommand();
  }
});

function updatePreview() {
  const values = Array.from(args.querySelectorAll('input'), input => {
    const value = input.value.trim();
    return value || '‹' + fields[input.name].label + '›';
  });
  preview.value = ['/erp', current[1], ...values].join(' ');
  if (preview.value !== sentCommand) sentCommand = '';
  send.disabled = pendingGroups !== null || Boolean(sentCommand);
  status.textContent = '';
}

function showCommand() {
  current = commands[group][operation.selectedIndex];
  lastAction.set(group, operation.selectedIndex);
  // The add/remove pair shares a draft. Other commands keep their own arguments.
  const draftKey = group === 'other' ? current[1] : group;
  if (!drafts.has(draftKey)) drafts.set(draftKey, new Map());
  const draft = drafts.get(draftKey);
  args.replaceChildren();
  for (const key of current[2]) {
    const field = fields[key];
    const label = document.createElement('label');
    label.textContent = field.label;
    const input = document.createElement('input');
    input.name = key;
    input.type = field.type === 'date' ? 'date' : 'text';
    input.required = true;
    if (patterns[field.type]) input.pattern = patterns[field.type];
    if (field.type === 'number') input.inputMode = 'numeric';
    const defaultReason = group === 'all' ? 'релизнута' : 'тестирование';
    const initial = key === 'account' ? defaultAccount : (key === 'reason' && group !== 'other' ? defaultReason : '');
    input.value = draft.get(key) ?? initial;
    label.append(input);
    if (field.hint) {
      const hint = document.createElement('small');
      hint.id = 'hint-' + key;
      hint.textContent = field.hint;
      label.append(hint);
      input.setAttribute('aria-describedby', hint.id);
    }
    input.addEventListener('input', () => {
      input.setCustomValidity('');
      if (key === 'account' && input.value === defaultAccount) draft.delete(key);
      else draft.set(key, input.value);
      updatePreview();
    });
    args.append(label);
  }
  args.hidden = !current[2].length;
  renderLibraries();
  updatePreview();
}

function showGroup() {
  group = document.querySelector('[name="group"]:checked').value;
  operation.replaceChildren(...commands[group].map(([label, command]) => new Option(label, command)));
  operation.selectedIndex = lastAction.get(group) ?? 0;
  document.querySelector('#operation-label').hidden = operation.length === 1;
  showCommand();
}

document.querySelector('.groups').addEventListener('change', showGroup);
operation.addEventListener('change', showCommand);
function validCommand() {
  for (const input of args.querySelectorAll('input')) {
    input.setCustomValidity(input.value.trim() ? '' : 'Заполните поле.');
  }
  return form.reportValidity();
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validCommand()) return;
  updatePreview();
  const names = usedGroups();
  try {
    await navigator.clipboard.writeText(preview.value);
    remember(names);
    status.textContent = 'Команда скопирована';
  } catch {
    preview.focus();
    preview.select();
    status.textContent = 'Команда выделена. Скопируйте её вручную.';
  }
});
send.addEventListener('click', () => {
  if (!validCommand()) return;
  if (!send.dataset.ready) status.textContent = 'Для отправки обновите расширение и перезагрузите страницу.';
});
send.addEventListener('fg-sending', () => {
  pendingGroups = usedGroups();
  send.disabled = true;
  status.textContent = 'Отправка…';
});
send.addEventListener('fg-result', event => {
  if (pendingGroups === null) return;
  const result = JSON.parse(event.detail);
  if (result.ok) {
    remember(pendingGroups);
    sentCommand = result.command;
    window.setTimeout(() => {
      if (sentCommand === result.command) {
        sentCommand = '';
        send.disabled = pendingGroups !== null;
      }
    }, 1200);
  }
  pendingGroups = null;
  send.disabled = sentCommand === preview.value;
  status.textContent = result.ok ? 'Команда отправлена в tools-product.' : result.error;
});
showGroup();
