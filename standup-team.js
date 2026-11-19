const teamKey = 'roistat-qa.standup.team.v1';
const teamPanel = document.querySelector('#team-panel');
const teamRows = document.querySelector('#team-rows');
const teamStatus = document.querySelector('#team-status');

function setTeam(entries, rename = new Map()) {
  people.clear();
  for (const [login,name] of entries) people.set(login,name);
  for (const field of document.querySelectorAll('#fields .people')) populatePeople(field.parentElement,rename);
  render();
}
try {
  const saved = JSON.parse(localStorage.getItem(teamKey));
  if (Array.isArray(saved) && saved.every(item => Array.isArray(item) && item.length === 2 && item.every(v => typeof v === 'string'))) setTeam(saved);
} catch { /* Defaults remain available when storage is disabled. */ }

function teamRow(login = '', name = '') {
  const row = document.createElement('fieldset');
  row.dataset.original = login;
  for (const [key, caption, value] of [['name','Имя и фамилия',name],['login','Логин Platrum',login]]) {
    const label = document.createElement('label');
    label.append(caption);
    const input = document.createElement('input');
    input.required = true;
    input.name = key;
    input.value = value;
    label.append(input);
    row.append(label);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Удалить';
  remove.onclick = () => row.remove();
  row.append(remove);
  teamRows.append(row);
  return row;
}
document.querySelector('#edit-team').onclick = () => {
  teamRows.replaceChildren();
  teamStatus.textContent = '';
  for (const [login,name] of people) teamRow(login,name);
  teamPanel.showModal();
};
document.querySelector('#close-team').onclick = () => teamPanel.close();
document.querySelector('#new-person').onclick = () => teamRow().querySelector('input').focus();
document.querySelector('#team-form').onsubmit = event => {
  event.preventDefault();
  const next = new Map();
  // A removed login must not silently transfer its assignments to a newly added person.
  const rename = new Map(Array.from(people.keys(), login => [login,'']));
  for (const row of teamRows.children) {
    const name = row.querySelector('[name=name]').value.trim();
    const login = row.querySelector('[name=login]').value.trim().replace(/^@/,'').toLowerCase();
    if (!name || !/^[a-z0-9][a-z0-9._-]*$/.test(login) || next.has(login)) {
      teamStatus.textContent = 'Укажите имя и уникальный логин из латинских букв, цифр, точек, дефисов или подчёркиваний.';
      return;
    }
    next.set(login,name);
    if (row.dataset.original) rename.set(row.dataset.original,login);
  }
  try {localStorage.setItem(teamKey,JSON.stringify([...next]));}
  catch {teamStatus.textContent = 'Не удалось сохранить состав в браузере.';return;}
  setTeam(next, rename);
  teamPanel.close();
};
