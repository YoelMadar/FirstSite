/* =========================================================
   מסך כניסה עם סיסמה ("מנעול רך")
   ---------------------------------------------------------
   חשוב: זו אינה הגנה קריפטוגרפית מלאה. הסיסמה נשמרת כ-hash
   ולא כטקסט גלוי, אבל קבצי התמונות עדיין נגישים למי שיודע
   את הכתובת הישירה. לפרטיות אמיתית — הפעילו הגנת סיסמה
   ברמת האירוח (Vercel / Netlify). ראו README.
   ========================================================= */
(function () {
  'use strict';

  // SHA-256 של הסיסמה (לא הסיסמה עצמה)
  var PASS_HASH = '3448b2c1a4b97a6b87ce2d93aec13fafc034a8b745473aca3fa323b8bd9264be';
  var KEY = 'wedding_gallery_unlocked';

  var gate  = document.getElementById('gate');
  var form  = document.getElementById('gateForm');
  var input = document.getElementById('gateInput');
  var error = document.getElementById('gateError');

  function unlock() {
    window.__UNLOCKED__ = true;
    if (typeof window.__startGallery === 'function') window.__startGallery();
    if (gate) {
      gate.classList.add('is-open');
      setTimeout(function () { gate.remove(); }, 600);
    }
    document.body.classList.remove('is-locked');
  }

  // כבר נכנס בסשן הזה?
  try {
    if (sessionStorage.getItem(KEY) === '1') { unlock(); return; }
  } catch (e) { /* sessionStorage חסום — ממשיכים עם מסך הסיסמה */ }

  document.body.classList.add('is-locked');

  async function sha256Hex(str) {
    // Web Crypto זמין בכל דפדפן מודרני תחת https / localhost
    var data = new TextEncoder().encode(str);
    var buf = await crypto.subtle.digest('SHA-256', data);
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function fail() {
    error.hidden = false;
    gate.classList.add('shake');
    input.select();
    setTimeout(function () { gate.classList.remove('shake'); }, 500);
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.hidden = true;
      var val = (input.value || '').trim();
      if (!val) return;

      sha256Hex(val).then(function (hex) {
        if (hex === PASS_HASH) {
          try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
          unlock();
        } else {
          fail();
        }
      }).catch(function () {
        // נפילה חזרה אם crypto.subtle לא זמין (למשל http לא מאובטח)
        error.hidden = false;
        error.textContent = 'לא ניתן לאמת סיסמה בחיבור הזה. פתחו את האתר דרך https.';
      });
    });
    input.focus();
  }
})();
