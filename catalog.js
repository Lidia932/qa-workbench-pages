const catalog = document.querySelector('#catalog');
const shortcuts = document.querySelector('#shortcuts');
const search = document.querySelector('#search');

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase('ru');
  const groups = new Map();
  const quickLinks = [];
  for (const [group, name, description, url, icon] of tools) {
    if (![group, name, description].join(' ').toLocaleLowerCase('ru').includes(query)) continue;
    const link = element('a', '');
    link.href = url;
    if (!url.startsWith('./downloads/')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    if (icon) {
      link.dataset.icon = icon;
      link.title = description;
      link.append(document.querySelector('#shortcut-' + icon).content.cloneNode(true), element('strong', name));
      quickLinks.push(link);
      continue;
    }
    if (!groups.has(group)) {
      const section = document.createElement('section');
      section.dataset.group = group;
      section.append(element('h2', group));
      groups.set(group, section);
    }
    if (url.startsWith('./downloads/')) {
      const row = element('div', '');
      row.className = 'extension-row';
      const info = element('div', '');
      info.append(element('strong', name), element('small', description));
      link.className = 'download';
      link.textContent = 'Скачать ZIP';
      link.setAttribute('aria-label', 'Скачать ZIP: ' + name);
      link.download = '';
      row.append(info, link);
      groups.get(group).append(row);
      continue;
    }
    link.append(element('strong', name), element('span', description));
    groups.get(group).append(link);
  }
  const extensions = groups.get('Расширения');
  if (extensions) {
    extensions.id = 'extensions';
    extensions.append(document.querySelector('#install-guide').content.cloneNode(true));
  }
  catalog.replaceChildren(...groups.values());
  shortcuts.replaceChildren(...quickLinks);
  shortcuts.hidden = quickLinks.length === 0;
  document.querySelector('#empty').hidden = groups.size + quickLinks.length > 0;
}
search.addEventListener('input', render);
render();
