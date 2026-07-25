// שליטת שחקן: דסקטופ (pointer lock + WASD) ומובייל (ג'ויסטיק + גרירת מבט), כולל התנגשויות

const EYE_HEIGHT = 1.65;
const RADIUS = 0.35;
const SPEED = 4; // מטר/שנייה

export function createControls(world, canvas) {
  const state = {
    x: 0, z: 0, yaw: 0, pitch: 0,
    keys: new Set(),
    joyX: 0, joyY: 0, // -1..1
    locked: false,
  };

  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const hint = document.getElementById('hint-look');

  function setSpawn(spawn) {
    state.x = spawn.x;
    state.z = spawn.z;
    state.yaw = (spawn.yaw || 0) * Math.PI / 180;
    state.pitch = 0;
  }

  // ---------- מקלדת ----------
  const keyMap = {
    KeyW: 'fwd', ArrowUp: 'fwd',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    const k = keyMap[e.code];
    if (k) { state.keys.add(k); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code];
    if (k) state.keys.delete(k);
  });

  // ---------- עכבר: pointer lock ----------
  if (!isCoarse) {
    hint.hidden = false;
    canvas.addEventListener('click', () => {
      if (!state.locked) canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      state.locked = document.pointerLockElement === canvas;
      hint.hidden = state.locked;
    });
    window.addEventListener('mousemove', (e) => {
      if (!state.locked) return;
      applyLook(e.movementX, e.movementY);
    });
  }

  function applyLook(dx, dy) {
    state.yaw -= dx * 0.0026;
    state.pitch -= dy * 0.0026;
    const lim = Math.PI / 2 - 0.05;
    state.pitch = Math.max(-lim, Math.min(lim, state.pitch));
  }

  // ---------- מגע: גרירה להסתכלות על ה-canvas ----------
  let lookPointer = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!lookPointer || e.pointerId !== lookPointer.id) return;
    applyLook((e.clientX - lookPointer.x) * 1.7, (e.clientY - lookPointer.y) * 1.7);
    lookPointer.x = e.clientX;
    lookPointer.y = e.clientY;
  });
  const endLook = (e) => { if (lookPointer && e.pointerId === lookPointer.id) lookPointer = null; };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  // ---------- ג'ויסטיק ----------
  const joy = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  let joyPointer = null;
  const JOY_R = 44;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  joy.addEventListener('pointerdown', (e) => {
    joyPointer = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    handleJoy(e);
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyPointer) handleJoy(e);
  });
  const endJoy = (e) => {
    if (e.pointerId !== joyPointer) return;
    joyPointer = null;
    state.joyX = 0; state.joyY = 0;
    setKnob(0, 0);
  };
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);

  function handleJoy(e) {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > JOY_R) { dx = (dx / len) * JOY_R; dy = (dy / len) * JOY_R; }
    setKnob(dx, dy);
    state.joyX = dx / JOY_R;
    state.joyY = dy / JOY_R;
  }

  // ---------- תנועה + התנגשויות ----------
  function collides(x, z) {
    const b = world.bounds;
    if (x < RADIUS || x > b.width - RADIUS || z < RADIUS || z > b.depth - RADIUS) return true;
    for (const c of world.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const ddx = x - nx, ddz = z - nz;
      if (ddx * ddx + ddz * ddz < RADIUS * RADIUS) return true;
    }
    return false;
  }

  function update(dt) {
    let mx = 0, mz = 0; // במרחב השחקן: x=ימינה, z=קדימה
    if (state.keys.has('fwd')) mz += 1;
    if (state.keys.has('back')) mz -= 1;
    if (state.keys.has('right')) mx += 1;
    if (state.keys.has('left')) mx -= 1;
    mz += -state.joyY;
    mx += state.joyX;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    if (len > 0.01) {
      const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
      // קדימה = כיוון המבט (בלי pitch); ימינה = ניצב לו
      const wx = (-sin * mz + cos * mx) * SPEED * dt;
      const wz = (-cos * mz - sin * mx) * SPEED * dt;
      // תזוזה ציר-ציר כדי להחליק לאורך מדפים
      if (!collides(state.x + wx, state.z)) state.x += wx;
      if (!collides(state.x, state.z + wz)) state.z += wz;
    }
    world.camera.position.set(state.x, EYE_HEIGHT, state.z);
    world.camera.rotation.set(state.pitch, state.yaw, 0);
  }

  // טלפורט: מציב את השחקן ומכוון את המבט לנקודה
  function teleport(x, z, lookAtX, lookAtZ) {
    state.x = x;
    state.z = z;
    state.yaw = Math.atan2(-(lookAtX - x), -(lookAtZ - z));
    state.pitch = 0;
    world.camera.position.set(state.x, EYE_HEIGHT, state.z);
    world.camera.rotation.set(state.pitch, state.yaw, 0);
  }

  return { state, setSpawn, update, teleport };
}
