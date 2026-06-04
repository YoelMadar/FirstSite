import { writeFileSync } from 'node:fs';

// Elegant, minimalist SVG placeholders so the gallery looks intentional
// before real photos are added. Soft, warm, neutral palette.
const palettes = [
  ['#f5efe8', '#e7dccd', '#b9a78f'],
  ['#efeae6', '#ddd0c4', '#a99784'],
  ['#f3ede9', '#e3d6cb', '#bba78f'],
  ['#eee9e3', '#d9cbbd', '#9f8e79'],
  ['#f4efe7', '#e0d3c2', '#b3a087'],
];

const demos = [
  { cat: 'preparations', label: 'הכנות', ar: [0.72] },
  { cat: 'preparations', label: 'הכנות', ar: [1.33] },
  { cat: 'ceremony', label: 'חופה', ar: [0.75] },
  { cat: 'ceremony', label: 'חופה', ar: [1.5] },
  { cat: 'ceremony', label: 'חופה', ar: [1.0] },
  { cat: 'reception', label: 'קבלת פנים', ar: [1.4] },
  { cat: 'reception', label: 'קבלת פנים', ar: [0.8] },
  { cat: 'dancing', label: 'ריקודים', ar: [1.33] },
  { cat: 'dancing', label: 'ריקודים', ar: [0.7] },
  { cat: 'dancing', label: 'ריקודים', ar: [1.0] },
  { cat: 'family', label: 'משפחה', ar: [1.5] },
  { cat: 'family', label: 'משפחה', ar: [0.78] },
  { cat: 'moments', label: 'רגעים', ar: [1.0] },
  { cat: 'moments', label: 'רגעים', ar: [1.33] },
  { cat: 'moments', label: 'רגעים', ar: [0.75] },
];

const W = 1200;
const manifest = [];

demos.forEach((d, i) => {
  const ratio = d.ar[0];
  const h = Math.round(W / ratio);
  const [bg, mid, ink] = palettes[i % palettes.length];
  const n = String(i + 1).padStart(2, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${mid}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${h}" fill="url(#g)"/>
  <rect x="40" y="40" width="${W-80}" height="${h-80}" fill="none" stroke="${ink}" stroke-opacity="0.35" stroke-width="2"/>
  <g fill="${ink}" fill-opacity="0.55" text-anchor="middle">
    <path transform="translate(${W/2-22},${h/2-90}) scale(1.1)" d="M22 12.5c0-3-2.4-5.5-5.5-5.5-1.9 0-3.6 1-4.5 2.5-.9-1.5-2.6-2.5-4.5-2.5C4.4 7 2 9.5 2 12.5c0 5.2 7.6 9.7 9.6 10.8.2.1.5.1.7 0C14.4 22.2 22 17.7 22 12.5z"/>
    <text x="${W/2}" y="${h/2+10}" font-family="Georgia, serif" font-size="64" letter-spacing="4">${d.label}</text>
    <text x="${W/2}" y="${h/2+70}" font-family="Georgia, serif" font-size="30" fill-opacity="0.4">תמונת הדגמה · ${n}</text>
  </g>
</svg>`;
  const file = `photos/demo/${d.cat}-${n}.svg`;
  writeFileSync(file, svg);
  manifest.push({ src: file, category: d.cat, label: d.label, alt: `${d.label} ${n}` });
});

console.log(`generated ${demos.length} demo images`);
