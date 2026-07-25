// מצב עריכה: עריכת מעברים/מדפים/מוצרים, טיוטה ב-localStorage, ייצוא layout.json

import { saveDraft, discardDraft, exportLayout } from './data.js';
import { setPreviewOverride } from './textures.js';
import { setDraftBadge, showToast } from './ui.js';

export function createEditor({ getLayout, onLayoutChanged }) {
  const panel = document.getElementById('editor-panel');
  const content = document.getElementById('editor-content');
  const tabs = document.getElementById('editor-tabs');
  let activeTab = 'shelves';
  const pendingFiles = []; // {fileName} — קבצים שנבחרו בעורך וצריך להעתיק ל-photos/

  document.getElementById('btn-editor').addEventListener('click', () => toggle(true));
  document.getElementById('btn-editor-close').addEventListener('click', () => toggle(false));
  document.getElementById('btn-discard-draft').addEventListener('click', () => {
    if (!confirm('לבטל את כל השינויים שלא נשמרו ולחזור לקובץ המקורי?')) return;
    discardDraft();
    location.reload();
  });
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    for (const b of tabs.querySelectorAll('button')) b.classList.toggle('active', b === btn);
    render();
  });
  if (location.hash === '#editor') toggle(true);

  function toggle(open) {
    panel.hidden = !open;
    if (open) render();
  }

  function changed({ structural = false } = {}) {
    saveDraft(getLayout());
    setDraftBadge(true);
    onLayoutChanged();
    if (structural) render();
  }

  // ---------- רינדור ----------
  function render() {
    content.innerHTML = '';
    if (activeTab === 'shelves') renderShelves();
    else if (activeTab === 'products') renderProducts();
    else renderExport();
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'value') node.value = v;
      else if (k === 'checked') node.checked = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function numInput(value, min, step, onchange) {
    return el('input', {
      type: 'number', value, min, step,
      oninput: (e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onchange(v); },
    });
  }

  // ---------- טאב מדפים ----------
  function renderShelves() {
    const layout = getLayout();

    content.appendChild(el('div', { class: 'ed-note' },
      'כאן בונים את מבנה המחסן. כל שינוי מוצג מיד בתלת־מימד ונשמר כטיוטה בדפדפן. ',
      'בסיום — עוברים לטאב "שמירה" כדי לייצא את הקובץ.'));

    // מידות המחסן
    const wh = layout.warehouse;
    content.appendChild(el('div', { class: 'ed-aisle' },
      el('div', { class: 'ed-row' },
        el('label', {}, 'שם המחסן:'),
        el('input', { type: 'text', value: wh.name, oninput: (e) => { wh.name = e.target.value; changed(); } })),
      el('div', { class: 'ed-row' },
        el('label', {}, 'רוחב (מ׳):'), numInput(wh.width, 5, 1, (v) => { wh.width = v; changed(); }),
        el('label', {}, 'עומק (מ׳):'), numInput(wh.depth, 5, 1, (v) => { wh.depth = v; changed(); }))));

    for (const aisle of layout.aisles) content.appendChild(renderAisle(layout, aisle));

    content.appendChild(el('button', {
      class: 'ed-btn big',
      onclick: () => {
        const n = layout.aisles.length + 1;
        const id = String.fromCharCode(64 + n); // A, B, C...
        layout.aisles.push({
          id, name: `מעבר ${id}`,
          origin: { x: 3 + (n - 1) * 6, z: 3 },
          direction: 'z', shelfGap: 0.15, shelves: [],
        });
        changed({ structural: true });
      },
    }, '+ הוסף מעבר'));
  }

  function renderAisle(layout, aisle) {
    const box = el('div', { class: 'ed-aisle' });
    box.appendChild(el('div', { class: 'ed-aisle-head' },
      el('input', { type: 'text', value: aisle.name, oninput: (e) => { aisle.name = e.target.value; changed(); } }),
      el('button', {
        class: 'ed-btn danger',
        onclick: () => {
          if (!confirm(`למחוק את ${aisle.name} על כל המדפים שבו?`)) return;
          layout.aisles = layout.aisles.filter((a) => a !== aisle);
          changed({ structural: true });
        },
      }, 'מחק')));
    box.appendChild(el('div', { class: 'ed-row' },
      el('label', {}, 'מיקום X:'), numInput(aisle.origin.x, 0, 0.5, (v) => { aisle.origin.x = v; changed(); }),
      el('label', {}, 'מיקום Z:'), numInput(aisle.origin.z, 0, 0.5, (v) => { aisle.origin.z = v; changed(); }),
      el('label', {}, 'כיוון:'),
      el('select', {
        onchange: (e) => { aisle.direction = e.target.value; changed(); },
      },
        el('option', { value: 'z', ...(aisle.direction === 'z' ? { selected: '' } : {}) }, 'לאורך (Z)'),
        el('option', { value: 'x', ...(aisle.direction === 'x' ? { selected: '' } : {}) }, 'לרוחב (X)'))));

    aisle.shelves.forEach((shelf, i) => box.appendChild(renderShelf(layout, aisle, shelf, i)));

    box.appendChild(el('button', {
      class: 'ed-btn',
      onclick: () => {
        const id = `${aisle.id}${aisle.shelves.length + 1}`;
        aisle.shelves.push({
          id, name: `מדף ${id}`,
          size: { w: 3, h: 2.4, d: 1.2 }, levels: 3,
          faces: { front: null, back: null }, color: '#3b6ea5',
        });
        changed({ structural: true });
      },
    }, '+ הוסף מדף'));
    return box;
  }

  function renderShelf(layout, aisle, shelf, index) {
    const box = el('div', { class: 'ed-shelf' });
    box.appendChild(el('div', { class: 'ed-shelf-head' },
      el('input', { type: 'text', value: shelf.name, oninput: (e) => { shelf.name = e.target.value; changed(); } }),
      el('button', { class: 'ed-btn ghost', title: 'הזז למעלה', onclick: () => { moveShelf(aisle, index, -1); } }, '▲'),
      el('button', { class: 'ed-btn ghost', title: 'הזז למטה', onclick: () => { moveShelf(aisle, index, 1); } }, '▼'),
      el('button', {
        class: 'ed-btn danger',
        onclick: () => {
          if (!confirm(`למחוק את ${shelf.name}?`)) return;
          aisle.shelves.splice(index, 1);
          changed({ structural: true });
        },
      }, '✕')));
    box.appendChild(el('div', { class: 'ed-row' },
      el('label', {}, 'רוחב:'), numInput(shelf.size.w, 0.5, 0.1, (v) => { shelf.size.w = v; changed(); }),
      el('label', {}, 'גובה:'), numInput(shelf.size.h, 0.5, 0.1, (v) => { shelf.size.h = v; changed(); }),
      el('label', {}, 'עומק:'), numInput(shelf.size.d, 0.3, 0.1, (v) => { shelf.size.d = v; changed(); })));
    box.appendChild(el('div', { class: 'ed-row' },
      el('label', {}, 'קומות:'), numInput(shelf.levels, 1, 1, (v) => { shelf.levels = Math.max(1, Math.round(v)); changed(); }),
      el('label', {}, 'צבע:'),
      el('input', { type: 'color', value: shelf.color, oninput: (e) => { shelf.color = e.target.value; changed(); } })));
    box.appendChild(renderFaceRow(shelf, 'front', 'תמונת חזית'));
    box.appendChild(renderFaceRow(shelf, 'back', 'תמונת גב'));
    return box;
  }

  function moveShelf(aisle, index, dir) {
    const j = index + dir;
    if (j < 0 || j >= aisle.shelves.length) return;
    const [s] = aisle.shelves.splice(index, 1);
    aisle.shelves.splice(j, 0, s);
    changed({ structural: true });
  }

  function renderFaceRow(shelf, face, label) {
    const current = shelf.faces[face];
    const row = el('div', { class: 'ed-row' }, el('label', {}, `${label}:`));
    const thumb = el('img', { class: 'ed-photo-thumb', alt: '' });
    if (current) thumb.src = current;
    const fileInput = el('input', {
      type: 'file', accept: 'image/*', hidden: '',
      onchange: (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const path = `photos/${f.name}`;
        const url = URL.createObjectURL(f);
        setPreviewOverride(path, url);
        shelf.faces[face] = path;
        thumb.src = url;
        if (!pendingFiles.some((p) => p.fileName === f.name)) pendingFiles.push({ fileName: f.name });
        changed();
        showToast(`התמונה שויכה למדף. אל תשכח להעתיק את "${f.name}" לתיקיית photos/ (רשימה בטאב "שמירה")`, null, 7000);
      },
    });
    row.appendChild(thumb);
    row.appendChild(el('button', { class: 'ed-btn', onclick: () => fileInput.click() }, current ? 'החלף תמונה' : 'בחר תמונה'));
    if (current) {
      row.appendChild(el('button', {
        class: 'ed-btn ghost',
        onclick: () => { shelf.faces[face] = null; changed({ structural: true }); },
      }, 'הסר'));
    }
    row.appendChild(fileInput);
    return row;
  }

  // ---------- טאב מוצרים ----------
  function renderProducts() {
    const layout = getLayout();
    const shelfOptions = [];
    for (const a of layout.aisles) for (const s of a.shelves) shelfOptions.push(s);

    content.appendChild(el('div', { class: 'ed-note' },
      'כל מוצר משויך למדף וקומה — כך החיפוש יודע להוביל אליו. אפשר להוסיף מילות חיפוש נוספות מופרדות בפסיק.'));

    for (const p of layout.products) {
      const row = el('div', { class: 'ed-product-row' });
      const fields = el('div', { class: 'ed-product-fields' },
        el('div', { class: 'ed-row' },
          el('input', { type: 'text', value: p.name, placeholder: 'שם המוצר', oninput: (e) => { p.name = e.target.value; changed(); } }),
          el('select', {
            onchange: (e) => { p.shelfId = e.target.value; changed(); },
          }, ...shelfOptions.map((s) =>
            el('option', { value: s.id, ...(s.id === p.shelfId ? { selected: '' } : {}) }, s.name))),
          el('label', {}, 'קומה:'), numInput(p.level, 1, 1, (v) => { p.level = Math.max(1, Math.round(v)); changed(); })),
        el('div', { class: 'ed-row' },
          el('input', { type: 'text', value: p.note, placeholder: 'הערה (למשל: צד ימין)', oninput: (e) => { p.note = e.target.value; changed(); } }),
          el('input', {
            type: 'text', value: (p.keywords || []).join(', '), placeholder: 'מילות חיפוש',
            oninput: (e) => { p.keywords = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); changed(); },
          })));
      row.appendChild(fields);
      row.appendChild(el('button', {
        class: 'ed-btn danger',
        onclick: () => {
          layout.products = layout.products.filter((x) => x !== p);
          changed({ structural: true });
        },
      }, '✕'));
      content.appendChild(row);
    }

    content.appendChild(el('button', {
      class: 'ed-btn big',
      onclick: () => {
        layout.products.push({
          id: `p${Date.now()}`, name: '', shelfId: shelfOptions[0]?.id || '', level: 1, note: '', keywords: [],
        });
        changed({ structural: true });
      },
    }, '+ הוסף מוצר'));
  }

  // ---------- טאב שמירה ----------
  function renderExport() {
    content.appendChild(el('div', { class: 'ed-note' },
      'השינויים נשמרים כרגע כטיוטה בדפדפן הזה בלבד. כדי שהם ייכנסו למערכת לכולם:',
      el('ol', { style: 'padding-inline-start:18px; margin-top:6px;' },
        el('li', {}, 'לחצו "ייצוא layout.json" והחליפו את הקובץ בתיקיית ', el('code', {}, 'data/'), ' בפרויקט.'),
        el('li', {}, 'העתיקו את התמונות החדשות לתיקיית ', el('code', {}, 'photos/'), ' (רשימה למטה).'),
        el('li', {}, 'אפשר גם פשוט לשלוח את הקובץ והתמונות ל-Claude ולבקש לעדכן את הפרויקט.'))));

    content.appendChild(el('button', {
      class: 'ed-btn big',
      onclick: () => { exportLayout(getLayout()); showToast('layout.json ירד — החלף את הקובץ בתיקיית data/ בפרויקט'); },
    }, '⬇ ייצוא layout.json'));

    if (pendingFiles.length) {
      content.appendChild(el('div', { class: 'ed-note', style: 'margin-top:12px;' },
        el('strong', {}, 'תמונות שנבחרו בעורך — יש להעתיק לתיקיית photos/:'),
        el('ul', { class: 'ed-files-list' },
          ...pendingFiles.map((p) => el('li', {}, el('code', {}, p.fileName))))));
    }

    content.appendChild(el('button', {
      class: 'ed-btn ghost big',
      onclick: () => {
        if (!confirm('לבטל את כל השינויים שלא יוצאו ולחזור לקובץ המקורי?')) return;
        discardDraft();
        location.reload();
      },
    }, 'שחזור מהקובץ המקורי (ביטול טיוטה)'));
  }

  return { toggle };
}
