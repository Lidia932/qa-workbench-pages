// Apply only the changes made in the form since its previous render.
function mergeStandup(previous, edited, next) {
  if (previous === next || edited === next) return edited;
  if (previous === edited) return next;

  function sections(text) {
    const result = new Map();
    const lines = text.split('\n');
    let current;
    for (let i = 0; i < lines.length; i++) {
      const heading = lines[i].match(/^\s*[#*_ ]*(Вчера|Сегодня|Проблемы)\s*:?\s*[*_]*\s*$/i);
      if (heading) {
        current = { start: i + 1, body: [] };
        result.set(heading[1].toLowerCase(), current);
      } else if (current) current.body.push(lines[i]);
    }
    for (const section of result.values()) {
      while (section.body.length && !section.body.at(-1).trim()) section.body.pop();
    }
    return result;
  }

  const before = sections(previous);
  const after = sections(next);
  const manual = sections(edited);
  const lines = edited.split('\n');
  const additions = [];
  const edits = [];
  for (const [name, section] of after) {
    const oldRows = before.get(name).body;
    const newRows = section.body;
    if (oldRows.join('\n') === newRows.join('\n')) continue;
    const target = manual.get(name);
    const withoutPlaceholder = rows => rows.length === 1 && rows[0] === '* —' ? [] : rows;
    const merged = mergeItems(withoutPlaceholder(oldRows), withoutPlaceholder(target?.body || []),
      withoutPlaceholder(newRows), mergeLine, true);
    if (target) {
      if (!merged.length && newRows[0] === '* —') merged.push('* —');
      edits.push({ start: target.start, count: target.body.length, merged });
    } else if (merged.length) {
      additions.push('**' + name[0].toUpperCase() + name.slice(1) + ':**', ...merged, '');
    }
  }
  for (const {start, count, merged} of edits.sort((a, b) => b.start - a.start)) {
    lines.splice(start, count, ...merged);
  }
  if (additions.length) lines.push('', ...additions.slice(0, -1));
  return lines.join('\n');
}

// Match unchanged items first. Between two matches, pair replacements in order.
// The indices distinguish repeated lines in different positions.
function standupSlots(base, variant) {
  const slots = [];
  let a = 0, b = 0;
  function gap(endA, endB) {
    while (a < endA && b < endB) slots[b++] = a++;
    while (b < endB) slots[b++] = -1;
    a = endA;
  }
  while (a < base.length && b < variant.length) {
    if (base[a] === variant[b]) { slots[b++] = a++; continue; }
    let bestA = base.length, bestB = variant.length, distance = Infinity;
    for (let i = a; i < base.length && i - a < distance; i++) {
      const j = variant.indexOf(base[i], b);
      if (j >= 0 && i - a + j - b < distance) {
        bestA = i; bestB = j; distance = i - a + j - b;
      }
    }
    gap(bestA, bestB);
  }
  gap(base.length, variant.length);
  return slots;
}

function mergeItems(base, edited, next, combine, matchAddedRows = false) {
  const slots = standupSlots(base, edited);
  const fresh = standupSlots(base, next);
  const output = edited.map((value, i) => ({value, slot: slots[i]}));
  const bySlot = new Map(output.filter(item => item.slot >= 0).map(item => [item.slot, item]));
  const manualRows = matchAddedRows ? output.filter(item => item.slot < 0) : [];
  const retained = new Set(fresh);
  // Insert new form items before the next surviving item in the edited message.
  let anchor = output.length;
  for (let i = next.length - 1; i >= 0; i--) {
    const slot = fresh[i];
    const item = bySlot.get(slot);
    if (item) {
      if (base[slot] !== next[i]) item.value = combine(base[slot], item.value, next[i]);
      anchor = output.indexOf(item);
    } else if (slot < 0 || base[slot] !== next[i]) {
      // A saved draft may already contain this row (e.g. after a page reload).
      const pastCount = /^\* Провели [12] релиз(?:а)?(?=\s|$)/;
      const release = matchAddedRows && next[i].match(/^\* Проведем \d+ релиз(?=\s|$)/)?.[0];
      const existing = manualRows.findIndex(row => row.value === next[i] ||
        (release && row.value.startsWith(release)) || (pastCount.test(next[i]) && pastCount.test(row.value)));
      if (existing >= 0) {
        const row = manualRows.splice(existing, 1)[0];
        if (pastCount.test(next[i])) row.value = row.value.replace(pastCount, next[i].match(pastCount)[0]);
        anchor = output.indexOf(row);
      } else output.splice(anchor, 0, {value: next[i], slot: -1});
    }
  }
  return output.filter(item => item.slot < 0 || retained.has(item.slot)).map(item => item.value);
}

function mergeLine(base, edited, next) {
  if (base === edited || edited === next) return next;
  const tokens = line => line.match(/[\p{L}\p{N}_]+|\s+|[^\s]/gu) || [];
  return mergeItems(tokens(base), tokens(edited), tokens(next), (_old, _edited, value) => value).join('');
}
