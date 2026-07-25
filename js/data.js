// טעינת layout.json + מיזוג טיוטה מ-localStorage + ברירות מחדל + ייצוא

const DRAFT_KEY = 'warehouse.layoutDraft';

const shelfDefaults = () => ({
  id: '', name: '', size: { w: 3, h: 2.4, d: 1.2 }, levels: 3,
  faces: { front: null, back: null }, color: '#3b6ea5',
});

export function normalizeLayout(raw) {
  const l = raw && typeof raw === 'object' ? raw : {};
  const wh = l.warehouse || {};
  const out = {
    version: 1,
    warehouse: {
      name: wh.name || 'המחסן שלי',
      width: Number(wh.width) > 4 ? Number(wh.width) : 30,
      depth: Number(wh.depth) > 4 ? Number(wh.depth) : 20,
      wallHeight: Number(wh.wallHeight) > 2 ? Number(wh.wallHeight) : 4.5,
    },
    aisles: [],
    products: [],
    spawn: {
      x: Number(l.spawn?.x) || 0,
      z: Number(l.spawn?.z) || 0,
      yaw: Number(l.spawn?.yaw) || 0,
    },
  };
  for (const a of Array.isArray(l.aisles) ? l.aisles : []) {
    const aisle = {
      id: String(a.id ?? `aisle${out.aisles.length + 1}`),
      name: a.name || `מעבר ${a.id ?? ''}`,
      origin: { x: Number(a.origin?.x) || 0, z: Number(a.origin?.z) || 0 },
      direction: a.direction === 'x' ? 'x' : 'z',
      shelfGap: Number.isFinite(Number(a.shelfGap)) ? Number(a.shelfGap) : 0.15,
      shelves: [],
    };
    for (const s of Array.isArray(a.shelves) ? a.shelves : []) {
      const d = shelfDefaults();
      aisle.shelves.push({
        id: String(s.id ?? `${aisle.id}${aisle.shelves.length + 1}`),
        name: s.name || `מדף ${s.id ?? ''}`,
        size: {
          w: Number(s.size?.w) > 0 ? Number(s.size.w) : d.size.w,
          h: Number(s.size?.h) > 0 ? Number(s.size.h) : d.size.h,
          d: Number(s.size?.d) > 0 ? Number(s.size.d) : d.size.d,
        },
        levels: Number(s.levels) >= 1 ? Math.round(Number(s.levels)) : d.levels,
        faces: { front: s.faces?.front || null, back: s.faces?.back || null },
        color: /^#[0-9a-fA-F]{6}$/.test(s.color || '') ? s.color : d.color,
      });
    }
    out.aisles.push(aisle);
  }
  for (const p of Array.isArray(l.products) ? l.products : []) {
    out.products.push({
      id: String(p.id ?? `p${Date.now()}_${out.products.length}`),
      name: p.name || '',
      shelfId: p.shelfId ? String(p.shelfId) : '',
      level: Number(p.level) >= 1 ? Math.round(Number(p.level)) : 1,
      note: p.note || '',
      keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
    });
  }
  if (!out.spawn.x && !out.spawn.z) {
    out.spawn = { x: out.warehouse.width - 3, z: out.warehouse.depth - 3, yaw: 135 };
  }
  return out;
}

export async function loadLayout() {
  let fileLayout = null;
  try {
    const res = await fetch('data/layout.json', { cache: 'no-cache' });
    if (res.ok) fileLayout = await res.json();
  } catch (e) {
    console.warn('layout.json לא נטען:', e);
  }
  let draft = null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) draft = JSON.parse(raw);
  } catch { /* טיוטה פגומה — מתעלמים */ }
  return {
    layout: normalizeLayout(draft || fileLayout),
    hasDraft: !!draft,
  };
}

export function saveDraft(layout) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(layout));
    return true;
  } catch (e) {
    console.warn('שמירת טיוטה נכשלה:', e);
    return false;
  }
}

export function discardDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function exportLayout(layout) {
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'layout.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function allShelves(layout) {
  const list = [];
  for (const a of layout.aisles) for (const s of a.shelves) list.push({ aisle: a, shelf: s });
  return list;
}
