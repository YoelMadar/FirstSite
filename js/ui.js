// רכיבי UI כלליים: toast, מסך עזרה, badge טיוטה

let toastTimeout = null;

export function showToast(text, action = null, duration = 5000) {
  const el = document.getElementById('toast');
  el.innerHTML = '';
  el.appendChild(document.createTextNode(text));
  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.addEventListener('click', () => { action.onClick(); hideToast(); });
    el.appendChild(btn);
  }
  el.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(hideToast, duration);
}

export function hideToast() {
  document.getElementById('toast').hidden = true;
}

export function setDraftBadge(visible) {
  document.getElementById('draft-badge').hidden = !visible;
}

export function initHelp() {
  const overlay = document.getElementById('help-overlay');
  document.getElementById('btn-help').addEventListener('click', () => { overlay.hidden = false; });
  document.getElementById('btn-help-close').addEventListener('click', () => { overlay.hidden = true; });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });
  // בביקור ראשון — מציגים את העזרה
  if (!localStorage.getItem('warehouse.helpSeen')) {
    overlay.hidden = false;
    localStorage.setItem('warehouse.helpSeen', '1');
  }
}
