// הקלטת סיור: canvas.captureStream + MediaRecorder, הורדה ושיתוף (ווצאפ)

import { showToast } from './ui.js';

const MIME_CHAIN = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm',
];

export function createRecorder(canvas) {
  const btn = document.getElementById('btn-record');
  const timerEl = document.getElementById('rec-timer');
  let recorder = null;
  let chunks = [];
  let startTime = 0;
  let timerInterval = null;

  const mimeType = MIME_CHAIN.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  const isMp4 = mimeType.startsWith('video/mp4');

  function fmtTime(s) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function start() {
    if (!window.MediaRecorder) {
      showToast('הדפדפן הזה לא תומך בהקלטה — נסו Chrome או Safari עדכניים');
      return;
    }
    const stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 2_500_000,
    });
    chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = onStop;
    recorder.start(1000);
    startTime = Date.now();
    btn.classList.add('recording');
    timerEl.hidden = false;
    timerEl.textContent = '0:00';
    timerInterval = setInterval(() => {
      timerEl.textContent = fmtTime((Date.now() - startTime) / 1000);
    }, 500);
    if (!isMp4) {
      showToast('שים לב: הדפדפן מקליט בפורמט webm. בווצאפ הוא עשוי להישלח כקובץ ולא כסרטון — עדיף להקליט מ-Chrome עדכני או מהטלפון.');
    }
  }

  function stop() {
    recorder?.stop();
    clearInterval(timerInterval);
    btn.classList.remove('recording');
    timerEl.hidden = true;
  }

  function onStop() {
    const ext = isMp4 ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    chunks = [];
    const file = new File([blob], `warehouse-tour.${ext}`, { type: blob.type });
    const sizeMb = (blob.size / 1048576).toFixed(1);

    // הורדה
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);

    // שיתוף ישיר (ווצאפ בטלפון)
    const canShare = navigator.canShare?.({ files: [file] });
    showToast(
      `🎥 הסרטון מוכן (${sizeMb}MB) והורד למכשיר.` + (sizeMb > 16 ? ' שים לב: מעל ~16MB ווצאפ עשוי לשלוח אותו כקובץ.' : ''),
      canShare ? {
        label: 'שתף בווצאפ',
        onClick: () => navigator.share({ files: [file], title: 'סיור במחסן' }).catch(() => {}),
      } : null,
      9000
    );
  }

  btn.addEventListener('click', () => {
    if (recorder && recorder.state === 'recording') stop();
    else start();
  });

  return { get mimeType() { return mimeType; } };
}
