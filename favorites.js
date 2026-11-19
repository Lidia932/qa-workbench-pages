const storeKey = 'roistat-qa.favorites.v1';
const editor = document.querySelector('#editor');
const add = document.querySelector('#add');
const message = document.querySelector('#message');
const list = document.querySelector('#favorites');

function webUrl(value) {
  try {
    const parsed = new URL(value);
    if (['http:', 'https:'].includes(parsed.protocol)) return parsed.href;
  } catch {}
  return null;
}

function readLinks() {
  const data = JSON.parse(localStorage.getItem(storeKey) || '[]');
  return data.filter(item => item && webUrl(item.url) && typeof item.title === 'string');
}

function updateLinks(change) {
  try {
    const links = change(readLinks());
    localStorage.setItem(storeKey, JSON.stringify(links));
    drawLinks(links);
    return true;
  } catch {
    message.textContent = 'Не удалось сохранить избранное. Проверь доступ браузера к локальному хранилищу.';
    return false;
  }
}

function drawLinks(links) {
  list.replaceChildren();
  for (const {url, title} of links) {
    const row = document.createElement('li');
    const link = element('a', title);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const remove = element('button', '×');
    remove.title = 'Убрать из избранного: ' + title;
    remove.setAttribute('aria-label', remove.title);
    remove.onclick = () => {
      if (updateLinks(items => items.filter(item => item.url !== url))) {
        message.textContent = 'Вкладка удалена из избранного.';
        add.focus();
      }
    };
    row.append(link, remove);
    list.append(row);
  }
  document.querySelector('#no-favorites').hidden = links.length > 0;
}

function toggleEditor(open) {
  editor.hidden = !open;
  add.setAttribute('aria-expanded', String(open));
  if (open) editor.elements.url.focus();
  else {
    editor.reset();
    editor.elements.url.setCustomValidity('');
    add.focus();
  }
}
add.onclick = () => toggleEditor(editor.hidden);
document.querySelector('#cancel').onclick = () => toggleEditor(false);
editor.elements.url.oninput = () => editor.elements.url.setCustomValidity('');
editor.onsubmit = event => {
  event.preventDefault();
  const url = webUrl(editor.elements.url.value);
  if (!url) {
    editor.elements.url.setCustomValidity('Введи ссылку с https:// или http://');
    editor.elements.url.reportValidity();
    return;
  }
  const title = editor.elements.title.value.trim() || new URL(url).hostname;
  if (updateLinks(items => [{url, title}, ...items.filter(item => item.url !== url)])) {
    toggleEditor(false);
    message.textContent = 'Вкладка сохранена.';
  }
};
function refreshLinks() {
  try {
    drawLinks(readLinks());
  } catch {
    message.textContent = 'Не удалось прочитать локальное избранное.';
  }
}
window.addEventListener('storage', refreshLinks);
refreshLinks();
