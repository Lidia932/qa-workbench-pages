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

function updatePreview() {
  const values = Array.from(args.querySelectorAll('input'), input => {
    const value = input.value.trim();
    return value || '‹' + fields[input.name].label + '›';
  });
  preview.value = ['/erp', current[1], ...values].join(' ');
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
    input.value = draft.get(key) ?? (key === 'reason' && group !== 'other' ? defaultReason : '');
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
      draft.set(key, input.value);
      updatePreview();
    });
    args.append(label);
  }
  args.hidden = !current[2].length;
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
form.addEventListener('submit', async event => {
  event.preventDefault();
  for (const input of args.querySelectorAll('input')) {
    input.setCustomValidity(input.value.trim() ? '' : 'Заполните поле.');
  }
  if (!form.reportValidity()) return;
  updatePreview();
  try {
    await navigator.clipboard.writeText(preview.value);
    status.textContent = 'Команда скопирована';
  } catch {
    preview.focus();
    preview.select();
    status.textContent = 'Команда выделена. Скопируйте её вручную.';
  }
});
showGroup();
