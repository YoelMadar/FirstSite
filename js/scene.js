// בניית הסצנה: רצפה, קירות, תאורה, מדפים מתוך ה-layout, colliders ומידע לחיפוש

import * as THREE from 'three';
import { loadFaceTexture } from './textures.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ef);
  scene.fog = new THREE.Fog(0xdfe7ef, 30, 80);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a97a5, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(12, 25, 8);
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const world = {
    renderer, scene, camera,
    group: null,          // כל מה שנבנה מה-layout (מוחלף ב-rebuild)
    colliders: [],        // AABBs דו-מימדיים {minX,maxX,minZ,maxZ}
    shelfById: new Map(), // id -> {shelf, aisle, mesh, center:Vector3, frontDir:Vector3, size}
    bounds: { width: 30, depth: 20 },
    beacon: null,
    highlight: { mesh: null, until: 0 },
    rebuild(layout) { rebuild(world, layout); },
  };
  return world;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      // טקסטורות תמונה נשמרות במטמון של textures.js — לא מוחקים אותן כאן
      if (m.map && m.map.isCanvasTexture) m.map.dispose();
      m.dispose();
    }
  });
}

function makeLabelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(34,48,63,0.85)';
  ctx.beginPath();
  ctx.roundRect(6, 6, 500, 116, 26);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

function rebuild(world, layout) {
  const { scene } = world;
  if (world.group) {
    scene.remove(world.group);
    disposeGroup(world.group);
  }
  const group = new THREE.Group();
  world.group = group;
  world.colliders = [];
  world.shelfById = new Map();
  world.highlight = { mesh: null, until: 0 };

  const W = layout.warehouse.width;
  const D = layout.warehouse.depth;
  const H = layout.warehouse.wallHeight;
  world.bounds = { width: W, depth: D };

  // רצפה
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshLambertMaterial({ color: 0xb8bfc7 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  group.add(floor);

  const grid = new THREE.GridHelper(Math.max(W, D), Math.max(W, D), 0x9aa4ae, 0xa8b1ba);
  grid.position.set(W / 2, 0.01, D / 2);
  group.add(grid);

  // קירות
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xd6dde4 });
  const walls = [
    { w: W, d: 0.2, x: W / 2, z: 0 },
    { w: W, d: 0.2, x: W / 2, z: D },
    { w: 0.2, d: D, x: 0, z: D / 2 },
    { w: 0.2, d: D, x: W, z: D / 2 },
  ];
  for (const wl of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wl.w, H, wl.d), wallMat);
    mesh.position.set(wl.x, H / 2, wl.z);
    group.add(mesh);
  }

  // מדפים
  for (const aisle of layout.aisles) {
    let cursor = 0;
    let firstCenter = null, lastCenter = null;
    for (const shelf of aisle.shelves) {
      const { w, h, d } = shelf.size;
      const alongZ = aisle.direction === 'z';
      const cx = alongZ ? aisle.origin.x : aisle.origin.x + cursor + w / 2;
      const cz = alongZ ? aisle.origin.z + cursor + w / 2 : aisle.origin.z;
      cursor += w + aisle.shelfGap;

      const sideMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(shelf.color) });
      const topMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(shelf.color).multiplyScalar(0.8) });

      const makeFaceMat = (photoPath) => {
        const mat = new THREE.MeshLambertMaterial();
        mat.map = loadFaceTexture(photoPath, shelf.name, shelf.levels, shelf.color, (tex) => {
          mat.map = tex;
          mat.needsUpdate = true;
        });
        return mat;
      };
      const frontMat = makeFaceMat(shelf.faces.front);
      const backMat = makeFaceMat(shelf.faces.back);

      // סדר חומרים ב-BoxGeometry: +x, -x, +y, -y, +z, -z
      let geo, mats, frontDir;
      if (alongZ) {
        geo = new THREE.BoxGeometry(d, h, w);
        mats = [frontMat, backMat, topMat, sideMat, sideMat, sideMat];
        frontDir = new THREE.Vector3(1, 0, 0);
      } else {
        geo = new THREE.BoxGeometry(w, h, d);
        mats = [sideMat, sideMat, topMat, sideMat, frontMat, backMat];
        frontDir = new THREE.Vector3(0, 0, 1);
      }
      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(cx, h / 2, cz);
      mesh.userData.shelfId = shelf.id;
      group.add(mesh);

      const halfX = alongZ ? d / 2 : w / 2;
      const halfZ = alongZ ? w / 2 : d / 2;
      world.colliders.push({ minX: cx - halfX, maxX: cx + halfX, minZ: cz - halfZ, maxZ: cz + halfZ });
      world.shelfById.set(shelf.id, {
        shelf, aisle, mesh, frontDir,
        center: new THREE.Vector3(cx, h / 2, cz),
        halfDepth: alongZ ? d / 2 : d / 2,
      });

      if (!firstCenter) firstCenter = new THREE.Vector3(cx, 0, cz);
      lastCenter = new THREE.Vector3(cx, 0, cz);
    }
    // שלט שם מעבר מעל מרכז השורה
    if (firstCenter && lastCenter) {
      const label = makeLabelSprite(aisle.name);
      label.position.set(
        (firstCenter.x + lastCenter.x) / 2,
        layout.warehouse.wallHeight - 0.6,
        (firstCenter.z + lastCenter.z) / 2
      );
      group.add(label);
    }
  }

  // Beacon הדגשה (עמוד אור) — נבנה פעם אחת, מוסתר כברירת מחדל
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 8, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  beacon.visible = false;
  group.add(beacon);
  world.beacon = beacon;

  scene.add(group);
}

// הדגשת מדף: עמוד אור + פעימת emissive למשך 10 שניות
export function highlightShelf(world, shelfId) {
  const info = world.shelfById.get(shelfId);
  if (!info) return;
  clearHighlight(world);
  world.beacon.position.set(info.center.x, 4, info.center.z);
  world.beacon.visible = true;
  world.highlight = { mesh: info.mesh, until: performance.now() + 10000 };
}

export function clearHighlight(world) {
  const { mesh } = world.highlight;
  if (mesh) {
    for (const m of mesh.material) m.emissive?.setHex(0x000000);
  }
  world.beacon.visible = false;
  world.highlight = { mesh: null, until: 0 };
}

// נקרא בכל פריים מלולאת הרינדור
export function updateHighlight(world, now) {
  const h = world.highlight;
  if (!h.mesh) return;
  if (now > h.until) { clearHighlight(world); return; }
  const pulse = 0.25 + 0.2 * Math.sin(now / 180);
  for (const m of h.mesh.material) m.emissive?.setRGB(0, pulse, pulse * 0.45);
  world.beacon.material.opacity = 0.2 + 0.15 * Math.sin(now / 250);
}
