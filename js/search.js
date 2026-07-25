// חיפוש מוצרים ומדפים: נרמול עברית, תוצאות, טלפורט + הדגשה

import { highlightShelf } from './scene.js';
import { allShelves } from './data.js';
import { showToast } from './ui.js';

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')           // ניקוד וטעמים
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])     // אותיות סופיות
    .replace(/["'״׳]/g, '')
    .trim();
}

export function createSearch(world, controls, getLayout) {
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');
  let index = [];

  function reindex() {
    const layout = getLayout();
    index = [];
    const shelves = allShelves(layout);
    for (const { aisle, shelf } of shelves) {
      index.push({
        type: 'shelf',
        text: normalize(`${shelf.name} ${shelf.id} ${aisle.name}`),
        title: shelf.name,
        subtitle: aisle.name,
        shelfId: shelf.id,
      });
    }
    for (const p of layout.products) {
      const info = shelves.find((s) => s.shelf.id === p.shelfId);
      if (!info) continue;
      index.push({
        type: 'product',
        text: normalize(`${p.name} ${(p.keywords || []).join(' ')} ${info.shelf.name}`),
        title: p.name,
        subtitle: `${info.shelf.name}, קומה ${p.level}${p.note ? ' — ' + p.note : ''}`,
        shelfId: p.shelfId,
      });
    }
  }

  function query(q) {
    const nq = normalize(q);
    if (!nq) return [];
    return index.filter((item) => item.text.includes(nq)).slice(0, 8);
  }

  function goTo(item) {
    const info = world.shelfById.get(item.shelfId);
    if (!info) return;
    const dist = info.halfDepth + 2.5;
    const px = info.center.x + info.frontDir.x * dist;
    const pz = info.center.z + info.frontDir.z * dist;
    controls.teleport(px, pz, info.center.x, info.center.z);
    highlightShelf(world, item.shelfId);
    showToast(item.type === 'product'
      ? `📦 ${item.title} — ${item.subtitle}`
      : `📍 ${item.title} (${item.subtitle})`);
    closeResults();
    input.blur();
  }

  function renderResults(items) {
    resultsEl.innerHTML = '';
    if (!items.length) {
      const div = document.createElement('div');
      div.className = 'search-empty';
      div.textContent = 'לא נמצא — נסו שם אחר';
      resultsEl.appendChild(div);
    } else {
      for (const item of items) {
        const btn = document.createElement('button');
        btn.className = 'search-item';
        btn.innerHTML = `${item.type === 'product' ? '📦' : '🗄️'} ${escapeHtml(item.title)}<small>${escapeHtml(item.subtitle)}</small>`;
        btn.addEventListener('click', () => goTo(item));
        resultsEl.appendChild(btn);
      }
    }
    resultsEl.hidden = false;
  }

  function closeResults() {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
  }

  input.addEventListener('input', () => {
    const q = input.value;
    if (!q.trim()) { closeResults(); return; }
    renderResults(query(q));
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const items = query(input.value);
      if (items.length) goTo(items[0]);
    }
    if (e.key === 'Escape') closeResults();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#search-wrap')) closeResults();
  });

  reindex();
  return { reindex };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
