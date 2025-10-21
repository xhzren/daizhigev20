(function () {
  const root = document.documentElement;
  const body = document.body;

  const state = {
    theme: localStorage.getItem('dg_theme') || 'light',
    fontSize: parseInt(localStorage.getItem('dg_font_size') || '18', 10),
    readingFont: localStorage.getItem('dg_reading_font') || 'serif',
    pagingMode: localStorage.getItem('dg_paging_mode') || 'slide'
  };

  function applyPreferences() {
    body.setAttribute('data-theme', state.theme === 'light' ? '' : state.theme);
    root.style.setProperty('--font-size', state.fontSize + 'px');
    body.setAttribute('data-reading-font', state.readingFont);
  }

  function setTheme(t) {
    state.theme = t;
    localStorage.setItem('dg_theme', t);
    applyPreferences();
  }
  function setFontSize(px) {
    state.fontSize = Math.max(14, Math.min(24, px));
    localStorage.setItem('dg_font_size', String(state.fontSize));
    applyPreferences();
    if (pager) pager.repaginate();
  }
  function setReadingFont(kind) {
    state.readingFont = kind;
    localStorage.setItem('dg_reading_font', kind);
    applyPreferences();
    if (pager) pager.repaginate();
  }
  function setPagingMode(mode) {
    state.pagingMode = mode;
    localStorage.setItem('dg_paging_mode', mode);
    if (pager) pager.setMode(mode);
    updateModeButtons();
  }

  function updateModeButtons() {
    const ids = ['btn-mode-slide','btn-mode-sim','btn-mode-tap'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('active',
        (id === 'btn-mode-slide' && state.pagingMode === 'slide') ||
        (id === 'btn-mode-sim' && state.pagingMode === 'sim') ||
        (id === 'btn-mode-tap' && state.pagingMode === 'tap')
      );
    });
  }

  // Simple debounce
  function debounce(fn, delay) {
    let t = null;
    return function () {
      clearTimeout(t);
      const args = arguments;
      const ctx = this;
      t = setTimeout(() => fn.apply(ctx, args), delay);
    };
  }

  class ReaderPager {
    constructor(rootEl) {
      this.root = rootEl;
      this.viewport = rootEl ? rootEl.querySelector('.pager-viewport') : null;
      this.track = rootEl ? rootEl.querySelector('.pager-track') : null;
      this.source = document.getElementById('reader-source');
      this.pageIndicatorCur = document.getElementById('page-current');
      this.pageIndicatorTotal = document.getElementById('page-total');
      this.current = 0;
      this.total = 0;
      this.idToPage = {};
      this.touch = { active: false, startX: 0, baseX: 0, lastDX: 0 };
      this.onResize = debounce(() => this.repaginate(), 150);
      if (this.root && this.source) {
        this.setMode(state.pagingMode || 'slide');
        this.paginate();
        this.bind();
      }
    }

    setMode(mode) {
      this.root.classList.remove('mode-slide','mode-sim','mode-tap');
      if (mode === 'tap') this.root.classList.add('mode-tap');
      else if (mode === 'sim') this.root.classList.add('mode-sim');
      else this.root.classList.add('mode-slide');
    }

    clear() {
      if (!this.track) return;
      while (this.track.firstChild) this.track.removeChild(this.track.firstChild);
      this.current = 0;
      this.total = 0;
      this.idToPage = {};
    }

    // Try to split a long block node (e.g., <p>) to fit the remaining height.
    // Returns { fit: Element|null, rest: Element|null }
    _splitBlockToFit(node, inner, maxHeight) {
      const tag = (node.tagName || '').toLowerCase();
      const isHeading = /^h[1-6]$/.test(tag);
      const isGap = tag === 'p' && node.classList && node.classList.contains('gap');
      // Do not split headings or gap lines
      if (isHeading || isGap) return { fit: null, rest: null };
      // Only handle simple text paragraphs
      if (tag !== 'p') return { fit: null, rest: null };
      const text = node.textContent || '';
      if (text.length <= 1) return { fit: null, rest: null };

      // Binary search the max number of chars that fit
      let lo = 0;
      let hi = text.length;
      let best = 0;
      // Create a temporary measurement element
      const testEl = document.createElement(tag);
      for (const attr of node.attributes) {
        if (attr && attr.name !== 'id') testEl.setAttribute(attr.name, attr.value);
      }
      // Keep in normal flow for accurate height calculation, but invisible
      testEl.style.visibility = 'hidden';

      const canFit = (count) => {
        testEl.textContent = text.slice(0, count);
        inner.appendChild(testEl);
        const ok = inner.scrollHeight <= maxHeight;
        inner.removeChild(testEl);
        return ok;
      };

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (canFit(mid)) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }

      if (best <= 0 || best >= text.length) return { fit: null, rest: null };

      const fitEl = document.createElement(tag);
      for (const attr of node.attributes) {
        if (attr && attr.name !== 'id') fitEl.setAttribute(attr.name, attr.value);
      }
      fitEl.textContent = text.slice(0, best);

      const restEl = document.createElement(tag);
      for (const attr of node.attributes) {
        if (attr && attr.name !== 'id') restEl.setAttribute(attr.name, attr.value);
      }
      restEl.textContent = text.slice(best);

      return { fit: fitEl, rest: restEl };
    }

    paginate() {
      if (!this.viewport || !this.track || !this.source) return;
      this.clear();
      const viewportH = this.viewport.clientHeight || 600;
      const nodes = Array.from(this.source.childNodes)
        .filter(n => n.nodeType === 1) // element nodes only
        .map(n => n.cloneNode(true));

      const newPage = () => {
        const page = document.createElement('div');
        page.className = 'reader-page';
        const inner = document.createElement('div');
        inner.className = 'page-inner reader-content';
        page.appendChild(inner);
        this.track.appendChild(page);
        return { page, inner };
      };

      let { page, inner } = newPage();
      for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        inner.appendChild(node);
        if (inner.scrollHeight > viewportH) {
          // Too tall after adding this node
          inner.removeChild(node);

          // Try to split long paragraphs smartly
          const split = this._splitBlockToFit(node, inner, viewportH);
          if (split.fit) {
            inner.appendChild(split.fit);
            // Start a new page, push the remainder to process next
            ({ page, inner } = newPage());
            if (split.rest) {
              nodes.splice(i + 1, 0, split.rest);
            }
            continue;
          }

          // if nothing fits on this page, force append and move on to next page
          if (inner.childNodes.length === 0) {
            inner.appendChild(node);
            ({ page, inner } = newPage());
          } else {
            ({ page, inner } = newPage());
            inner.appendChild(node);
          }
        }
      }

      // Build id map
      const pages = Array.from(this.track.children);
      this.total = pages.length || 1;
      pages.forEach((p, idx) => {
        p.querySelectorAll('[id]').forEach((el) => {
          this.idToPage[el.id] = idx;
        });
      });

      this.snapTo(0, false);
      this.updateIndicator();
      this.root.classList.add('ready');
    }

    repaginate() {
      this.paginate();
    }

    updateIndicator() {
      if (this.pageIndicatorCur) this.pageIndicatorCur.textContent = String(this.current + 1);
      if (this.pageIndicatorTotal) this.pageIndicatorTotal.textContent = String(this.total);
    }

    snapTo(index, animate = true) {
      index = Math.max(0, Math.min(this.total - 1, index));
      this.current = index;
      if (!this.track) return;
      if (!animate) this.track.style.transition = 'none';
      const x = -index * 100;
      this.track.style.transform = `translateX(${x}%)`;
      // force reflow then restore transition
      if (!animate) {
        // eslint-disable-next-line no-unused-expressions
        this.track.offsetHeight; // force
        this.track.style.transition = '';
      }
      this.updateIndicator();
    }

    next() { this.snapTo(this.current + 1, true); }
    prev() { this.snapTo(this.current - 1, true); }

    goToAnchor(id) {
      if (!id) return;
      const clean = id.replace(/^#/, '');
      const pageIdx = this.idToPage[clean];
      if (typeof pageIdx === 'number') {
        this.snapTo(pageIdx, true);
        // highlight
        try {
          const page = this.track.children[pageIdx];
          const target = page.querySelector(`#${CSS.escape(clean)}`);
          if (target) {
            target.classList.add('target-highlight');
            setTimeout(() => target.classList.remove('target-highlight'), 1200);
          }
        } catch (e) {}
        history.replaceState(null, '', '#' + clean);
      }
    }

    bind() {
      // touch / mouse swipe
      const vp = this.viewport;
      if (!vp) return;
      const start = (clientX) => {
        if (this.root.classList.contains('mode-tap')) return; // tap mode disables drag
        this.touch.active = true;
        this.touch.startX = clientX;
        this.touch.baseX = -this.current * vp.clientWidth;
        this.touch.lastDX = 0;
        this.track.style.transition = 'none';
      };
      const move = (clientX) => {
        if (!this.touch.active) return;
        const dx = clientX - this.touch.startX;
        this.touch.lastDX = dx;
        const x = this.touch.baseX + dx;
        const pct = (x / vp.clientWidth) * 100;
        this.track.style.transform = `translateX(${pct}%)`;
      };
      const end = () => {
        if (!this.touch.active) return;
        this.touch.active = false;
        const dx = this.touch.lastDX;
        const threshold = Math.max(40, vp.clientWidth * 0.1);
        this.track.style.transition = '';
        if (dx < -threshold) this.next();
        else if (dx > threshold) this.prev();
        else this.snapTo(this.current, true);
      };

      vp.addEventListener('touchstart', (e) => start(e.touches[0].clientX), { passive: true });
      vp.addEventListener('touchmove', (e) => move(e.touches[0].clientX), { passive: true });
      vp.addEventListener('touchend', end, { passive: true });

      vp.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX); });
      window.addEventListener('mousemove', (e) => move(e.clientX));
      window.addEventListener('mouseup', end);

      // tap zones
      const zones = this.root.querySelectorAll('.tap-zones .zone');
      zones.forEach((z) => {
        z.addEventListener('click', () => {
          const dir = z.getAttribute('data-dir');
          if (dir === 'prev') this.prev();
          else if (dir === 'next') this.next();
        });
      });

      // keyboard
      window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') this.prev();
        else if (e.key === 'ArrowRight') this.next();
      });

      // window resize
      window.addEventListener('resize', this.onResize);
    }
  }

  let pager = null;

  document.addEventListener('DOMContentLoaded', function() {
    applyPreferences();
    // bind preference buttons
    const inc = document.getElementById('btn-font-inc');
    const dec = document.getElementById('btn-font-dec');
    const reset = document.getElementById('btn-font-reset');
    const serif = document.getElementById('btn-font-serif');
    const sans = document.getElementById('btn-font-sans');
    const light = document.getElementById('btn-theme-light');
    const dark = document.getElementById('btn-theme-dark');
    const sepia = document.getElementById('btn-theme-sepia');
    const modeSlide = document.getElementById('btn-mode-slide');
    const modeSim = document.getElementById('btn-mode-sim');
    const modeTap = document.getElementById('btn-mode-tap');
    const tocToggle = document.getElementById('btn-toc-toggle');

    if (inc) inc.addEventListener('click', () => setFontSize(state.fontSize + 1));
    if (dec) dec.addEventListener('click', () => setFontSize(state.fontSize - 1));
    if (reset) reset.addEventListener('click', () => setFontSize(18));
    if (serif) serif.addEventListener('click', () => setReadingFont('serif'));
    if (sans) sans.addEventListener('click', () => setReadingFont('sans'));
    if (light) light.addEventListener('click', () => setTheme('light'));
    if (dark) dark.addEventListener('click', () => setTheme('dark'));
    if (sepia) sepia.addEventListener('click', () => setTheme('sepia'));

    if (modeSlide) modeSlide.addEventListener('click', () => setPagingMode('slide'));
    if (modeSim) modeSim.addEventListener('click', () => setPagingMode('sim'));
    if (modeTap) modeTap.addEventListener('click', () => setPagingMode('tap'));
    updateModeButtons();

    if (tocToggle) tocToggle.addEventListener('click', () => {
      document.body.classList.toggle('toc-open');
    });

    // Initialize pager if present
    const pagerEl = document.getElementById('dg-pager');
    if (pagerEl && document.getElementById('reader-source')) {
      pager = new ReaderPager(pagerEl);
      pager.setMode(state.pagingMode || 'slide');

      // If URL has hash, jump to that anchor's page
      if (location.hash) {
        pager.goToAnchor(location.hash);
      }

      // TOC links: page jump and auto collapse
      document.querySelectorAll('.toc-list a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
          const id = a.getAttribute('href');
          if (!id) return;
          e.preventDefault();
          pager.goToAnchor(id);
          document.body.classList.remove('toc-open');
        });
      });
    } else {
      // fallback: smooth scroll for page without pager
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
    }
  });
})();
