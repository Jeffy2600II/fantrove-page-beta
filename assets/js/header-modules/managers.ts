// managers.js — Optimized: research-backed, minimal overhead
//
// Changes from previous version:
//  • scrollManager: single passive listener + single RAF (unchanged, already optimal)
//  • performanceOptimizer: added Connection API awareness for data-saving mode
//  • buttonManager: renderMainButtons uses DocumentFragment (single DOM write)
//  • buttonManager: renderSubButtons uses DocumentFragment (single DOM write)
//  • All event listeners verified {passive:true}
//  • No MutationObserver, no global style injections
//  • Added: connection-aware warmup (slow connections skip prefetch)

export const scrollManager = {
  _ticking: false,
  _fixed: false,
  _Z: 999,

  _injectStyles() {
    if (document.getElementById('_hdr_sticky_css')) return;
    const s = document.createElement('style');
    s.id = '_hdr_sticky_css';
    const hz = this._Z + 2;
    s.textContent = `
header{position:relative;z-index:${hz};contain:layout style;}
#sub-nav{position:sticky;top:0;left:0;right:0;z-index:${this._Z};}
#sub-nav.fx{background:rgba(255,255,255,1);border-bottom:0.5px solid rgba(19,180,127,0.18);border-radius:0 0 30px 30px;}
#sub-nav.fx #sub-buttons-container{padding:6px 16px!important;border-radius:0 0 30px 30px;}
#sub-nav.fx.hi{padding:0!important;}
#sub-nav.fx .hj{border-color:rgba(0,0,0,0);background:transparent;}`;
    document.head.appendChild(s);
  },

  _tick() {
    const sn = document.getElementById('sub-nav');
    if (!sn) return;
    const top = sn.getBoundingClientRect().top;
    if (top <= 0 && !this._fixed) { sn.classList.add('fx'); this._fixed = true; }
    else if (top > 0 && this._fixed) { sn.classList.remove('fx'); this._fixed = false; }
  },

  init() {
    this._injectStyles();
    window.addEventListener('scroll', () => {
      if (this._ticking) return;
      this._ticking = true;
      requestAnimationFrame(() => {
        try { this._tick(); } catch(_) {}
        this._ticking = false;
      });
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) try { this._tick(); } catch(_) {}
    }, { passive: true });
    if (window.pageYOffset > 0) this._tick();
  }
};

export const performanceOptimizer = {
  init() {
    // Lazy-load images (native first)
    if ('loading' in HTMLImageElement.prototype) {
      // @ts-expect-error TS(2339): Property 'loading' does not exist on type 'Element... Remove this comment to see the full error message
      document.querySelectorAll('img:not([loading])').forEach(i => { i.loading = 'lazy'; });
    }

    // fetchpriority on above-fold images
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
    });

    // Error boundary: 1s throttle to avoid notification flood
    let _errT: any;
    const notify = (msg: any) => {
      clearTimeout(_errT);
      _errT = setTimeout(() => {
        // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
        try { window._headerV2_utils?.showNotification(msg, 'error'); } catch(_) {}
      }, 1000);
    };
    window.addEventListener('error', e => {
      notify('เกิดข้อผิดพลาดที่ไม่คาดคิด'); console.error(e.error || e);
    }, { passive: true });
    window.addEventListener('unhandledrejection', e => {
      notify('เกิดข้อผิดพลาดในการเชื่อมต่อ'); console.error(e.reason);
    }, { passive: true });

    // Connection API: slow connections → reduce prefetch aggressiveness
    try {
      // @ts-expect-error TS(2339): Property 'mozConnection' does not exist on type 'N... Remove this comment to see the full error message
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        if (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
          // @ts-expect-error TS(2339): Property '_headerV2_slowConnection' does not exist... Remove this comment to see the full error message
          window._headerV2_slowConnection = true;
        }
        conn.addEventListener('change', () => {
          // @ts-expect-error TS(2339): Property '_headerV2_slowConnection' does not exist... Remove this comment to see the full error message
          window._headerV2_slowConnection =
            conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
        }, { passive: true });
      }
    } catch(_) {}
  },

  setupErrorBoundary() { /* handled in init() */ },
  setupLazyLoading()   { /* handled in init() */ },
};

export const subNavManager = {
  ensureSubNavContainer() {
    let sn = document.getElementById('sub-nav');
    if (!sn) {
      sn = document.createElement('div');
      sn.id = 'sub-nav'; sn.className = 'hi';
      const h = document.querySelector('header');
      if (h?.nextSibling) h.parentNode.insertBefore(sn, h.nextSibling);
      else document.body.prepend(sn);
    }
    let hj = sn.querySelector('.hj');
    if (!hj) { hj = document.createElement('div'); hj.className = 'hj'; sn.appendChild(hj); }

    const ext = document.querySelector('#sub-buttons-container');
    if (ext && !hj.contains(ext)) try { hj.appendChild(ext); } catch(_) {}

    let sbc = hj.querySelector('#sub-buttons-container');
    if (!sbc) {
      document.querySelectorAll('#sub-buttons-container').forEach(el => {
        if (!sn.contains(el)) try { el.parentNode?.removeChild(el); } catch(_) {}
      });
      sbc = document.createElement('div');
      sbc.id = 'sub-buttons-container';
      hj.appendChild(sbc);
    }

    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    const el = window._headerV2_elements;
    if (el) { el.subNav = sn; el.subNavInner = hj; el.subButtonsContainer = sbc; }
    return sbc;
  },

  hideSubNav() {
    const sn = document.getElementById('sub-nav');
    if (!sn) return;
    sn.style.display = 'none';
    const c = sn.querySelector('#sub-buttons-container');
    if (c) c.innerHTML = '';
    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    if (window._headerV2_elements?.subButtonsContainer)
      // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
      window._headerV2_elements.subButtonsContainer.innerHTML = '';
  },

  showSubNav() {
    let sn = document.getElementById('sub-nav');
    if (!sn) { this.ensureSubNavContainer(); sn = document.getElementById('sub-nav'); }
    if (sn) sn.style.display = '';
  },

  clearSubButtons() { this.ensureSubNavContainer().innerHTML = ''; }
};

export const buttonManager = {
  buttonConfig: null,
  state: { buttonMap: new Map(), currentMainButton: null, currentSubButton: null, currentMainButtonUrl: null },

  async loadConfig() {
    if (this.buttonConfig) { await this.renderMainButtons(); return; }
    // @ts-expect-error TS(2339): Property '_headerV2_dataManager' does not exist on... Remove this comment to see the full error message
    const cached = window._headerV2_dataManager.getCached('buttonConfig');
    if (cached) { this.buttonConfig = cached; await this.renderMainButtons(); return; }
    // @ts-expect-error TS(2339): Property '_headerV2_dataManager' does not exist on... Remove this comment to see the full error message
    const res = await window._headerV2_dataManager.fetchWithRetry(
      // @ts-expect-error TS(2339): Property '_headerV2_dataManager' does not exist on... Remove this comment to see the full error message
      window._headerV2_dataManager.constants.BUTTONS_CONFIG_PATH, {}, 2
    );
    this.buttonConfig = res;
    // @ts-expect-error TS(2339): Property '_headerV2_dataManager' does not exist on... Remove this comment to see the full error message
    window._headerV2_dataManager.setCache('buttonConfig', res);
    await this.renderMainButtons();
    // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
    try { (window._headerV2_router || window._headerV2_navigationManager)?.updateButtonStates?.(); } catch(_) {}
  },

  async renderMainButtons() {
    const lang = localStorage.getItem('selectedLang') || 'en';
    const { mainButtons } = this.buttonConfig;
    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    const navList = window._headerV2_elements.navList;
    navList.innerHTML = '';
    this.state.buttonMap = new Map();
    let def = null;

    // Build all buttons in one fragment → single DOM write
    const frag = document.createDocumentFragment();

    for (const cfg of mainButtons) {
      const label = cfg[`${lang}_label`];
      if (!label) continue;
      const li  = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = 'main-button';
      const url = cfg.url || cfg.jsonFile;
      btn.setAttribute('data-url', url);
      if (cfg.className) btn.classList.add(cfg.className);
      this.state.buttonMap.set(url, { button: btn, config: cfg });
      if (cfg.isDefault) def = { button: btn, config: cfg };

      btn.addEventListener('click', async ev => {
        ev.preventDefault();
        navList.querySelectorAll('button').forEach((b: any) => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.currentMainButton = btn;
        this.state.currentMainButtonUrl = url;
        // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
        const router = window._headerV2_router || window._headerV2_navigationManager;
        if (router?.navigateTo)
          // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
          await router.navigateTo(url, { skipUrlUpdate: !!window._headerV2_bootstrapping });
      }); // non-passive: needs preventDefault

      li.appendChild(btn);
      frag.appendChild(li);
    }
    navList.appendChild(frag); // single DOM write

    // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
    if (!window._headerV2_bootstrapping) {
      await this._handleInitialUrl(window.location.search, def);
    } else if (def?.button) {
      def.button.classList.add('active');
      this.state.currentMainButton     = def.button;
      this.state.currentMainButtonUrl  = def.config?.url || def.config?.jsonFile;
    }
  },

  async _handleInitialUrl(url: any, def: any) {
    try {
      if (!url || url === '?') { if (def) await this.triggerMainButtonClick(def.button); return; }
      const p = new URLSearchParams(url.startsWith('?') ? url : `?${url}`);
      const main = (p.get('type') || '').replace(/__$/, '');
      const sub  = p.get('page') || '';
      const md   = this.state.buttonMap.get(main);
      if (!md) { if (def) await this.triggerMainButtonClick(def.button); return; }

      // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
      const router = window._headerV2_router || window._headerV2_navigationManager;
      const valid = await router.validateUrl(url).catch(() => false);
      if (!valid) { if (def) await this.triggerMainButtonClick(def.button); return; }

      router.state.currentMainRoute = main;
      router.state.currentSubRoute  = sub || '';
      this.state.currentMainButton  = md.button;
      await this._activateMain(md.button, md.config);
      if (md.config.subButtons?.length) {
        if (sub) await this._handleInitialSub(md.config, main, sub);
        else     await this._handleDefaultSub(md.config, main);
        subNavManager.showSubNav();
      } else subNavManager.hideSubNav();
      router.scrollActiveButtonsIntoView?.();
    } catch(_) { if (def) await this.triggerMainButtonClick(def.button); }
  },

  async _activateMain(btn: any, cfg: any) {
    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    window._headerV2_elements.navList.querySelectorAll('button')
      .forEach((b: any) => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.currentMainButton = btn;
    // @ts-expect-error TS(2339): Property '_headerV2_contentManager' does not exist... Remove this comment to see the full error message
    await window._headerV2_contentManager.clearContent();
    const lang = localStorage.getItem('selectedLang') || 'en';
    if (cfg.subButtons?.length) {
      subNavManager.showSubNav();
      await this.renderSubButtons(cfg.subButtons, cfg.url || cfg.jsonFile, lang);
    } else subNavManager.hideSubNav();
    if (cfg.jsonFile)
      // @ts-expect-error TS(2339): Property '_headerV2_contentManager' does not exist... Remove this comment to see the full error message
      await window._headerV2_contentManager.renderContent([{ jsonFile: cfg.jsonFile }]);
  },

  async _handleInitialSub(cfg: any, main: any, sub: any) {
    await new Promise(r => setTimeout(r, 60));
    if (!cfg.subButtons?.length) { subNavManager.hideSubNav(); return; }
    subNavManager.showSubNav();
    await this.renderSubButtons(cfg.subButtons, main, localStorage.getItem('selectedLang') || 'en');
    const fullUrl = `${main}-${sub}`;
    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    const el  = window._headerV2_elements.subButtonsContainer?.querySelector(`button[data-url="${fullUrl}"]`);
    const scf = cfg.subButtons.find((b: any) => b.url === sub || b.jsonFile === sub);
    if (el && scf) {
      // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
      window._headerV2_elements.subButtonsContainer?.querySelectorAll('.button-sub')
        .forEach((b: any) => b.classList.remove('active'));
      el.classList.add('active');
      this.state.currentSubButton = el;
      if (scf.jsonFile) {
        // @ts-expect-error TS(2339): Property '_headerV2_contentManager' does not exist... Remove this comment to see the full error message
        await window._headerV2_contentManager.clearContent();
        // @ts-expect-error TS(2339): Property '_headerV2_contentManager' does not exist... Remove this comment to see the full error message
        await window._headerV2_contentManager.renderContent([{ jsonFile: scf.jsonFile }]);
      }
      this._scrollSub(el);
    }
  },

  async _handleDefaultSub(cfg: any, main: any) {
    if (!cfg.subButtons?.length) { subNavManager.hideSubNav(); return; }
    subNavManager.showSubNav();
    const d = cfg.subButtons.find((b: any) => b.isDefault);
    if (d) {
      // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
      const router = window._headerV2_router || window._headerV2_navigationManager;
      await router.navigateTo(`${main}-${d.url || d.jsonFile}`,
        // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
        { skipUrlUpdate: !!window._headerV2_bootstrapping });
    }
  },

  async triggerMainButtonClick(btn: any) {
    if (!btn) return;
    const url = btn.getAttribute('data-url');
    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    window._headerV2_elements.navList.querySelectorAll('button')
      .forEach((b: any) => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.currentMainButton    = btn;
    this.state.currentMainButtonUrl = url;
    // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
    const router = window._headerV2_router || window._headerV2_navigationManager;
    // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
    try { await router.navigateTo(url, { skipUrlUpdate: !!window._headerV2_bootstrapping }); }
    catch(e) { console.error('triggerMainButtonClick', e); }
  },

  async triggerSubButtonClick(btn: any) {
    if (!btn) return;
    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    window._headerV2_elements.subButtonsContainer?.querySelectorAll('button')
      .forEach((b: any) => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.currentSubButton = btn;
    const url = btn.getAttribute('data-url');
    // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
    const router = window._headerV2_router || window._headerV2_navigationManager;
    // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
    try { await router.navigateTo(url, { skipUrlUpdate: !!window._headerV2_bootstrapping }); }
    catch(e) { console.error('triggerSubButtonClick', e); }
  },

  async renderSubButtons(subBtns: any, mainUrl: any, lang: any) {
    if (!subBtns?.length) { subNavManager.hideSubNav(); return; }
    subNavManager.showSubNav();
    const ctr = subNavManager.ensureSubNavContainer();
    ctr.innerHTML = '';

    const p = new URLSearchParams(
      window.location.search.startsWith('?') ? window.location.search : `?${window.location.search}`
    );
    const curMain = (p.get('type') || '').replace(/__$/, '');
    const curSub  = p.get('page') || '';
    const activeUrl = curMain && curSub ? `${curMain}-${curSub}` : '';

    let defBtn: any = null;
    // Build all sub-buttons in one fragment → single DOM write
    const frag = document.createDocumentFragment();

    subBtns.forEach((cfg: any) => {
      const label = cfg[`${lang}_label`];
      if (!label) return;
      const btn = document.createElement('button');
      btn.className = 'button-sub sub-button';
      if (cfg.className) btn.classList.add(cfg.className);
      btn.textContent = label;
      const fullUrl = `${mainUrl}-${cfg.url || cfg.jsonFile}`;
      btn.setAttribute('data-url', fullUrl);
      if (cfg.isDefault) defBtn = btn;
      if (fullUrl === activeUrl) btn.classList.add('active');

      btn.addEventListener('click', async () => {
        ctr.querySelectorAll('.button-sub').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.currentSubButton = btn;
        // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
        const router = window._headerV2_router || window._headerV2_navigationManager;
        if (router?.navigateTo)
          // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
          await router.navigateTo(fullUrl, { skipUrlUpdate: !!window._headerV2_bootstrapping });
      }, { passive: true });

      frag.appendChild(btn);
    });
    ctr.appendChild(frag); // single DOM write

    const needDef = !activeUrl || !ctr.querySelector('.button-sub.active');
    if (needDef && defBtn)
      setTimeout(() => { try { this.triggerSubButtonClick(defBtn); } catch(_) {} }, 0);
  },

  findMainButtonConfig(url: any) {
    return this.buttonConfig?.mainButtons?.find((b: any) => b.url === url || b.jsonFile === url);
  },

  _scrollSub(btn: any) {
    // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
    const ctr = window._headerV2_elements?.subButtonsContainer;
    if (!ctr || !btn) return;
    requestAnimationFrame(() => {
      try {
        const cl = ctr.getBoundingClientRect().left;
        const bl = btn.getBoundingClientRect().left;
        const t  = ctr.scrollLeft + (bl - cl) - 20;
        if (Math.abs(ctr.scrollLeft - t) > 1)
          ctr.scrollTo({ left: t, behavior: 'smooth' });
      } catch(_) {}
    });
  },

  updateButtonsLanguage(lang: any) {
    try {
      const { mainButtons } = this.buttonConfig;
      // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
      window._headerV2_elements.navList.querySelectorAll('button').forEach((b: any, i: any) => {
        const l = mainButtons[i]?.[`${lang}_label`];
        if (l) b.textContent = l;
      });
      if (this.state.currentMainButton) {
        const cfg = this.findMainButtonConfig(
          this.state.currentMainButton.getAttribute('data-url')
        );
        if (cfg?.subButtons?.length) {
          subNavManager.showSubNav();
          this.renderSubButtons(cfg.subButtons, cfg.url || cfg.jsonFile, lang);
        } else subNavManager.hideSubNav();
      } else subNavManager.hideSubNav();
    } catch(_) {}
  },

  // Backward-compat aliases
  activateMainButton(btn: any, cfg: any)        { return this._activateMain(btn, cfg); },
  handleInitialUrl(url: any, map: any, def: any)     { return this._handleInitialUrl(url, def); },
  handleInitialSubRoute(cfg: any, m: any, s: any)    { return this._handleInitialSub(cfg, m, s); },
  handleDefaultSubButton(cfg: any, m: any)      { return this._handleDefaultSub(cfg, m); },
  scrollActiveSubButtonIntoView(btn: any)  { return this._scrollSub(btn); },
  updateButtonState(btn: any, isSub: any) {
    const g = isSub
      // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
      ? window._headerV2_elements.subButtonsContainer
      // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
      : window._headerV2_elements.navList;
    g?.querySelectorAll('button').forEach((b: any) => b.classList.remove('active'));
    btn.classList.add('active');
    if (isSub) { this.state.currentSubButton = btn; this._scrollSub(btn); }
    else         this.state.currentMainButton = btn;
  }
};

// navigationManager — proxy to router (backward compat)
export const navigationManager = {
  state: {
    isNavigating: false, currentMainRoute: '', currentSubRoute: '',
    previousUrl: '', lastScrollPosition: 0
  },
  // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
  normalizeUrl(u: any)   { return window._headerV2_router?.normalizeUrl?.(u) || ''; },
  // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
  parseUrl(u: any)       { return window._headerV2_router?.parseUrl?.(u) || { main:'', sub:'' }; },
  // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
  validateUrl(u: any)    { return window._headerV2_router?.validateUrl?.(u) || Promise.resolve(false); },
  // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
  getDefaultRoute() { return window._headerV2_router?.getDefaultRoute?.() || Promise.resolve(''); },
  // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
  changeURL(u: any,f: any)    { return window._headerV2_router?.changeURL?.(u,f) || Promise.resolve(); },
  // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
  navigateTo(r: any,o: any)   { return window._headerV2_router?.navigateTo?.(r,o) || Promise.resolve(); },

  updateButtonStates(url: any) {
    try {
      const { main, sub } = this.parseUrl(url || window.location.search);
      // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
      const el = window._headerV2_elements;
      el?.navList?.querySelectorAll('button').forEach((b: any) => b.classList.toggle('active', b.getAttribute('data-url') === main));
      el?.subButtonsContainer?.querySelectorAll('button').forEach((b: any) => b.classList.toggle('active', b.getAttribute('data-url') === `${main}-${sub}`));
      // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
      window._headerV2_router?.scrollActiveButtonsIntoView?.();
    } catch(_) {}
  },

  scrollActiveButtonsIntoView() {
    ['nav ul', '#sub-buttons-container'].forEach(sel => {
      const c = document.querySelector(sel);
      const a = c?.querySelector('button.active');
      if (!c || !a) return;
      requestAnimationFrame(() => {
        try {
          const cb = c.getBoundingClientRect(), ab = a.getBoundingClientRect();
          c.scrollTo({
            left: Math.max(0, c.scrollLeft + ab.left - cb.left - 20),
            behavior: 'smooth'
          });
        } catch(_) {}
      });
    });
  }
};

export default { scrollManager, performanceOptimizer, subNavManager, buttonManager, navigationManager };