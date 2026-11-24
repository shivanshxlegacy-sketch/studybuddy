// Connects the StudyBuddy page to the server. The app asks window.claude for AI,
// and this file also keeps each student's data in the cloud.
(function () {
  const KEY = 'studybuddy-v5';
  const token = () => localStorage.getItem('sb_access_token');
  const hdr = () => ({ 'content-type': 'application/json', authorization: 'Bearer ' + token() });
  const realSet = Storage.prototype.setItem;
  let pulled = !token(), timer = null, lastSent = '';

  // Save to the cloud after the app saves locally (debounced). Nothing is sent before the first load finishes.
  Storage.prototype.setItem = function (k, v) {
    realSet.call(this, k, v);
    if (this === window.localStorage && k === KEY && token() && pulled) {
      clearTimeout(timer);
      timer = setTimeout(() => push(false), 1500);
    }
  };
  async function push(keepalive) {
    const v = localStorage.getItem(KEY);
    if (!v || v === lastSent || !token()) return;
    try {
      const r = await fetch('/api/state', { method: 'PUT', headers: hdr(), keepalive: !!keepalive, body: JSON.stringify({ state: JSON.parse(v) }) });
      if (r.ok) lastSent = v;
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) push(true); });

  // On a new device (nothing saved locally), restore the student's data and reload once.
  async function pull() {
    if (!token()) return;
    try {
      const r = await fetch('/api/state', { headers: hdr() });
      if (r.ok) {
        const j = await r.json();
        if (j.data && !localStorage.getItem(KEY)) {
          realSet.call(localStorage, KEY, JSON.stringify(j.data));
          location.reload();
          return;
        }
      }
    } catch (e) {}
    pulled = true;
  }
  pull();

  // Official chapter list for a class and subject. Returns null until someone has verified it.
  window.syllabusGet = async function (cls, subject) {
    try {
      const r = await fetch('/api/syllabus?' + new URLSearchParams({ cls, subject }), { headers: hdr() });
      if (!r.ok) return null;
      return (await r.json()).chapters || null;
    } catch (e) { return null; }
  };

  // Pre-made notes and papers, when a teacher has reviewed them. Returns null if none.
  window.packGet = async function (kind, chapter, subject, cls) {
    if (!token()) return null;
    try {
      const q = new URLSearchParams({ cls, subject, chapter, kind });
      const r = await fetch('/api/pack?' + q, { headers: hdr() });
      if (!r.ok) return null;
      return (await r.json()).data || null;
    } catch (e) { return null; }
  };

  function toDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  async function sample(input, opts = {}) {
    if (!token()) { location.href = '/login'; throw { code: 'not_granted' }; }
    const prompt = typeof input === 'string' ? input : input.map(m => m.content).join('\n');
    const images = [];
    for (const b of (opts.images || [])) images.push(await toDataURL(b));
    const r = await fetch('/api/sample', { method: 'POST', headers: hdr(), body: JSON.stringify({ prompt, images, search: !!opts.search }) });
    if (r.status === 401) { location.href = '/login'; throw { code: 'not_granted' }; }
    if (r.status === 403) { location.href = '/login'; throw { code: 'consent_required' }; }
    if (r.status === 402) {
      alert('You have used today\'s free AI actions. They reset tomorrow. For unlimited use, go to /pricing to upgrade to Pro.');
      throw { code: 'rate_limited' };
    }
    if (!r.ok) throw new Error('ai_error');
    const j = await r.json();
    return { text: j.text, truncated: false };
  }
  sample.limits = async () => ({ images: true });
  window.claude = { use: async (name) => (name === 'sample' ? sample : null) };
})();
