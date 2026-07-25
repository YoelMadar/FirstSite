// אתחול המערכת: טעינת נתונים → סצנה → שליטה → חיפוש → הקלטה → עורך → לולאת רינדור

import { loadLayout } from './data.js';
import { createScene, updateHighlight } from './scene.js';
import { createControls } from './controls.js';
import { createSearch } from './search.js';
import { createRecorder } from './recorder.js';
import { createEditor } from './editor.js';
import { initHelp, setDraftBadge } from './ui.js';

async function boot() {
  const canvas = document.getElementById('scene');
  const { layout, hasDraft } = await loadLayout();

  const world = createScene(canvas);
  world.rebuild(layout);

  const controls = createControls(world, canvas);
  controls.setSpawn(layout.spawn);

  const search = createSearch(world, controls, () => layout);
  createRecorder(canvas);
  createEditor({
    getLayout: () => layout,
    onLayoutChanged: () => {
      world.rebuild(layout);
      search.reindex();
    },
  });
  initHelp();
  setDraftBadge(hasDraft);

  // probe לבדיקות אוטומטיות
  window.__player = controls.state;
  window.__world = world;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    controls.update(dt);
    updateHighlight(world, now);
    world.renderer.render(world.scene, world.camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error('שגיאת אתחול:', e);
  document.body.insertAdjacentHTML('beforeend',
    '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#fff;z-index:99;font-size:18px;">שגיאה בטעינת המערכת — בדקו את ה-console</div>');
});
