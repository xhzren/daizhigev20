(function () {
  const root = document.documentElement;
  const body = document.body;

  const state = {
    theme: localStorage.getItem('dg_theme') || 'light',
    fontSize: parseInt(localStorage.getItem('dg_font_size') || '18', 10),
    readingFont: localStorage.getItem('dg_reading_font') || 'serif'
  };

  function apply() {
    body.setAttribute('data-theme', state.theme === 'light' ? '' : state.theme);
    root.style.setProperty('--font-size', state.fontSize + 'px');
    body.setAttribute('data-reading-font', state.readingFont);
  }

  function setTheme(t) {
    state.theme = t;
    localStorage.setItem('dg_theme', t);
    apply();
  }
  function setFontSize(px) {
    state.fontSize = Math.max(14, Math.min(24, px));
    localStorage.setItem('dg_font_size', String(state.fontSize));
    apply();
  }
  function setReadingFont(kind) {
    state.readingFont = kind;
    localStorage.setItem('dg_reading_font', kind);
    apply();
  }

  document.addEventListener('DOMContentLoaded', function() {
    apply();
    const inc = document.getElementById('btn-font-inc');
    const dec = document.getElementById('btn-font-dec');
    const reset = document.getElementById('btn-font-reset');
    const serif = document.getElementById('btn-font-serif');
    const sans = document.getElementById('btn-font-sans');
    const light = document.getElementById('btn-theme-light');
    const dark = document.getElementById('btn-theme-dark');
    const sepia = document.getElementById('btn-theme-sepia');

    if (inc) inc.addEventListener('click', () => setFontSize(state.fontSize + 1));
    if (dec) dec.addEventListener('click', () => setFontSize(state.fontSize - 1));
    if (reset) reset.addEventListener('click', () => setFontSize(18));
    if (serif) serif.addEventListener('click', () => setReadingFont('serif'));
    if (sans) sans.addEventListener('click', () => setReadingFont('sans'));
    if (light) light.addEventListener('click', () => setTheme('light'));
    if (dark) dark.addEventListener('click', () => setTheme('dark'));
    if (sepia) sepia.addEventListener('click', () => setTheme('sepia'));

    // Smooth scroll for toc anchors
    document.querySelectorAll('a[href^="#"]').forEach(function(a){
      a.addEventListener('click', function(e){
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', id);
        }
      });
    });
  });
})();
