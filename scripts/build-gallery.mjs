// ============================================================
//  בונה את רשימת התמונות (photos/manifest.js) מתוך התיקיות
// ============================================================
// שימוש:
//   1. שים את התמונות בתיקיות לפי קטגוריה בתוך photos/, למשל:
//        photos/preparations/IMG_001.jpg
//        photos/ceremony/IMG_120.jpg
//        photos/dancing/...
//   2. הרץ:  node scripts/build-gallery.mjs
//
// כל קובץ תמונה בתוך תת-תיקייה של photos/ ייכנס לגלריה.
// אם תשים תמונות ישירות בתוך photos/ (בלי תת-תיקייה) הן יסווגו כ"רגעים".
// ============================================================

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PHOTOS_DIR = join(ROOT, 'photos');
const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif|svg)$/i;

// שמות הקטגוריות בעברית + סדר התצוגה
const LABELS = {
  preparations: 'הכנות',
  ceremony: 'חופה',
  reception: 'קבלת פנים',
  dancing: 'ריקודים',
  family: 'משפחה',
  friends: 'חברים',
  moments: 'רגעים',
};
const ORDER = ['preparations', 'ceremony', 'reception', 'dancing', 'family', 'friends', 'moments'];

const labelFor = (cat) => LABELS[cat] || cat;
const sortKey = (cat) => {
  const i = ORDER.indexOf(cat);
  return i === -1 ? ORDER.length : i;
};

function listImages(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isFile() && IMAGE_RE.test(name)) out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const entries = [];

// תמונות ישירות בתוך photos/ -> "רגעים" (מתעלם מתיקיית demo)
for (const name of listImages(PHOTOS_DIR)) {
  entries.push({ cat: 'moments', file: `photos/${name}`, name });
}

// תת-תיקיות = קטגוריות
for (const name of readdirSync(PHOTOS_DIR)) {
  if (name.startsWith('.') || name === 'demo') continue;
  const full = join(PHOTOS_DIR, name);
  if (!statSync(full).isDirectory()) continue;
  for (const img of listImages(full)) {
    entries.push({ cat: name, file: `photos/${name}/${img}`, name: img });
  }
}

if (entries.length === 0) {
  console.log('לא נמצאו תמונות אמיתיות בתוך photos/. שומר על תמונות ההדגמה.');
  console.log('הוסף תמונות לתיקיות כמו photos/ceremony/ והרץ שוב.');
  process.exit(0);
}

entries.sort((a, b) => sortKey(a.cat) - sortKey(b.cat) || a.name.localeCompare(b.name, undefined, { numeric: true }));

const lines = entries.map((e) => {
  const label = labelFor(e.cat);
  return `  { src: ${JSON.stringify(e.file)}, category: ${JSON.stringify(e.cat)}, label: ${JSON.stringify(label)}, alt: ${JSON.stringify(label + ' · ' + e.name)} },`;
});

const content = `// ============================================================
//  רשימת התמונות של הגלריה  —  נוצר אוטומטית ע"י scripts/build-gallery.mjs
//  ${entries.length} תמונות  ·  עודכן ${new Date().toISOString().slice(0, 10)}
// ============================================================

window.WEDDING_PHOTOS = [
${lines.join('\n')}
];
`;

writeFileSync(join(PHOTOS_DIR, 'manifest.js'), content);

const byCat = entries.reduce((m, e) => ((m[e.cat] = (m[e.cat] || 0) + 1), m), {});
console.log(`נוצרה גלריה עם ${entries.length} תמונות:`);
for (const [cat, n] of Object.entries(byCat)) console.log(`  · ${labelFor(cat)} (${cat}): ${n}`);
console.log('\nהקובץ photos/manifest.js עודכן. רענן את הדפדפן כדי לראות.');
