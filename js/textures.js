// טעינת תמונות מדפים עם fallback ל-placeholder מצויר, ו-override לתצוגה מקדימה מהעורך

import * as THREE from 'three';

const cache = new Map();          // path -> THREE.Texture
const previewOverrides = new Map(); // "photos/xxx.jpg" -> objectURL (מהעורך, לפני העתקה לתיקייה)

export function setPreviewOverride(path, objectUrl) {
  previewOverrides.set(path, objectUrl);
  // תמונה חדשה לאותו נתיב — לנקות מטמון כדי שהבנייה הבאה תיטען מחדש
  const old = cache.get(path);
  if (old) { old.dispose?.(); cache.delete(path); }
}

export function makePlaceholderTexture(shelfName, levels, colorHex) {
  const w = 512, h = 384;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // רקע
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#e8ecf0');
  grad.addColorStop(1, '#cdd5dd');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // מסגרת מדף
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, w - 14, h - 14);

  // קומות + ארגזים
  const n = Math.max(1, Math.min(levels || 3, 8));
  const boxColors = ['#b5713b', '#8a8f96', '#4a8a5c', '#a05c5c', '#5c7ba0'];
  for (let i = 0; i < n; i++) {
    const yTop = 20 + (i * (h - 40)) / n;
    const yBot = 20 + ((i + 1) * (h - 40)) / n;
    // לוח הקומה
    ctx.fillStyle = colorHex;
    ctx.fillRect(14, yBot - 8, w - 28, 8);
    // ארגזים אקראיים-דטרמיניסטיים
    let x = 26;
    let k = i * 7 + (shelfName ? shelfName.length : 0);
    while (x < w - 70) {
      const bw = 45 + ((k * 37) % 50);
      const bh = Math.min(yBot - yTop - 18, 40 + ((k * 53) % 30));
      ctx.fillStyle = boxColors[k % boxColors.length];
      ctx.fillRect(x, yBot - 10 - bh, bw, bh);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, yBot - 10 - bh, bw, bh);
      x += bw + 12;
      k++;
    }
  }

  // שם המדף
  ctx.fillStyle = 'rgba(20,30,40,0.82)';
  const label = shelfName || '';
  ctx.font = 'bold 52px Arial, sans-serif';
  const tw = ctx.measureText(label).width;
  ctx.fillRect(w / 2 - tw / 2 - 18, h / 2 - 38, tw + 36, 76);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// טוען טקסטורת חזית: תמונה אם קיימת, אחרת placeholder. מחליף על ה-material כשהתמונה מוכנה.
export function loadFaceTexture(path, shelfName, levels, colorHex, onReady) {
  const placeholder = makePlaceholderTexture(shelfName, levels, colorHex);
  if (!path) return placeholder;

  const src = previewOverrides.get(path) || path;
  const cacheKey = path;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const loader = new THREE.TextureLoader();
  loader.load(
    src,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      cache.set(cacheKey, tex);
      onReady?.(tex);
    },
    undefined,
    () => { /* 404 או שגיאה — נשארים עם ה-placeholder */ }
  );
  return placeholder;
}

export function clearTextureCache() {
  for (const t of cache.values()) t.dispose?.();
  cache.clear();
}
