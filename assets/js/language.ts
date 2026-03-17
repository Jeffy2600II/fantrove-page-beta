type LangDecisionSource = 'url' | 'storage' | 'browser';

interface LangDecision {
  lang: string;
  source: LangDecisionSource;
}

interface LangConfig {
  buttonText?: string;
  label?: string;
  enSource?: string;
}

interface LanguagesConfig {
  [lang: string]: LangConfig;
}

type LanguageData = Record<string, string>;

interface WorkerNode {
  key: string | null;
}

interface WorkerJobData {
  nodes: WorkerNode[];
  langData: LanguageData;
  batchIdx: number;
}

interface WorkerResultItem {
  idx: number;
  parts: Part[];
}

interface WorkerResult {
  batchIdx: number;
  result: WorkerResultItem[];
}

type Part =
  | { type: 'text'; text: string }
  | { type: 'html'; html: string }
  | { type: 'lsvg'; id: string | null }
  | { type: 'svg'; id: string | null }
  | { type: 'slot'; name: string | null }
  | { type: 'a'; translate: boolean; text: string }
  | { type: 'br' }
  | { type: 'strong'; text: string };

type MarkerNode =
  | { __svgMarker: true; lsvg?: true; id: string | null; __predicted?: true }
  | { __slotMarker: true; name: string | null }
  | Node;

interface WorkerPoolJob {
  data: WorkerJobData;
  resolve: (value: WorkerResult) => void;
  reject: (reason?: unknown) => void;
}

const DB_NAME = 'LanguageCacheDB_v3';
const DB_STORE = 'langs';
const DB_META = 'meta';
const DB_VERSION = 4;

function openLangDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(DB_META)) {
        db.createObjectStore(DB_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function getLangCacheBatch(langKeys: string[]) {
  const db = await openLangDB();
  return await Promise.all(
    langKeys.map((langKey) => {
      return new Promise((resolve) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const req = store.get(langKey);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    }),
  );
}

async function setLangCacheBatch(langDatas: Array<{ langKey: string; data: unknown }>) {
  const db = await openLangDB();
  return await Promise.all(
    langDatas.map(({ langKey, data }) => {
      return new Promise<void>((resolve) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.put({ key: langKey, data, ts: Date.now() });
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => resolve(undefined);
      });
    }),
  );
}

async function getMeta(key: string) {
  const db = await openLangDB();
  return new Promise((resolve) => {
    const tx = db.transaction(DB_META, 'readonly');
    const store = tx.objectStore(DB_META);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

async function setMeta(key: string, value: unknown) {
  const db = await openLangDB();
  return new Promise<void>((resolve) => {
    const tx = db.transaction(DB_META, 'readwrite');
    const store = tx.objectStore(DB_META);
    store.put({ key, value });
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => resolve(undefined);
  });
}

class WorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private jobs: WorkerPoolJob[] = [];
  private jobMap = new Map<Worker, WorkerPoolJob>();

  constructor(workerCode: string, poolSize: number) {
    for (let i = 0; i < poolSize; ++i) {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      worker.onmessage = (e) => this._onMessage(worker, e);
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  execute(data: WorkerJobData): Promise<WorkerResult> {
    return new Promise<WorkerResult>((resolve, reject) => {
      const job: WorkerPoolJob = { data, resolve, reject };
      if (this.idle.length > 0) {
        const worker = this.idle.pop() as Worker;
        this._runJob(worker, job);
      } else {
        this.jobs.push(job);
      }
    });
  }

  private _runJob(worker: Worker, job: WorkerPoolJob) {
    this.jobMap.set(worker, job);
    worker.postMessage(job.data);
  }

  private _onMessage(worker: Worker, e: MessageEvent) {
    const job = this.jobMap.get(worker);
    if (!job) return;
    this.jobMap.delete(worker);
    job.resolve(e.data as WorkerResult);
    this.idle.push(worker);
    if (this.jobs.length > 0) {
      const nextJob = this.jobs.shift() as WorkerPoolJob;
      this._runJob(worker, nextJob);
    }
  }

  destroy() {
    this.workers.forEach((w) => w.terminate && w.terminate());
    this.workers = [];
    this.idle = [];
    this.jobs = [];
    this.jobMap.clear();
  }
}

class LanguageManager {
  private languagesConfig: LanguagesConfig = {};
  private selectedLang = '';
  private lastSelectedLang = '';
  private isLanguageDropdownOpen = false;
  private languageCache: Record<string, LanguageData> = {};
  private isUpdatingLanguage = false;
  private isNavigating = false;
  private mutationObserver: MutationObserver | null = null;
  private scrollPosition = 0;
  private isInitialized = false;
  private mutationThrottleTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly FADE_DURATION = 300;
  private readonly SUPPORTED_LANGS = ['en', 'th'];
  private readonly DEFAULT_LANG = 'en';
  private _userExplicitLang: string | null = null;
  private readonly maxWorker: number;
  private workerPool: WorkerPool;
  private readonly _prefetchPromise: Promise<void>;
  private _bc: BroadcastChannel | null = null;
  private languageButton: HTMLElement | null = null;
  private languageOverlay: HTMLElement | null = null;
  private languageDropdown: HTMLElement | null = null;
  private _dropdownWheelListener: ((e: WheelEvent) => void) | null = null;

  constructor() {
    this.maxWorker = navigator.hardwareConcurrency
      ? Math.max(4, Math.floor(navigator.hardwareConcurrency * 0.9))
      : 8;

    const workerCode = `
      function splitMarkersAndHtml(str) {
        const htmlSplit = str.split(/(<\\/?.+?>)/g);
        const parts = [];
        const markerRegex = /(@lsvg(?::([^@]+))?@)|(@svg(?::([^@]+))?@)|(@slot:([^@]+)@)|(@a(.*?)@)|(@br)|(@strong(.*?)@)/g;
        for (let segment of htmlSplit) {
          if (!segment) continue;
          if (/^<\\/?.+?>$/.test(segment)) {
            parts.push({ type: 'html', html: segment });
          } else {
            let lastIndex = 0;
            let m;
            while ((m = markerRegex.exec(segment)) !== null) {
              if (m.index > lastIndex) {
                parts.push({ type: 'text', text: segment.slice(lastIndex, m.index) });
              }
              if (m[1]) {
                const id = m[2] || null;
                parts.push({ type: 'lsvg', id });
              } else if (m[3]) {
                const id = m[4] || null;
                parts.push({ type: 'svg', id });
              } else if (m[5]) {
                const name = m[6] || null;
                parts.push({ type: 'slot', name });
              } else if (m[7]) {
                const inner = m[8] || '';
                parts.push({ type: 'a', translate: inner !== "", text: inner });
              } else if (m[9]) {
                parts.push({ type: 'br' });
              } else if (m[10]) {
                const s = m[11] || '';
                parts.push({ type: 'strong', text: s });
              }
              lastIndex = markerRegex.lastIndex;
            }
            if (lastIndex < segment.length) {
              parts.push({ type: 'text', text: segment.slice(lastIndex) });
            }
          }
        }
        return parts;
      }
      self.onmessage = function(e) {
        const { nodes, langData, batchIdx } = e.data;
        const result = [];
        for (let i=0;i<nodes.length;i++) {
          const { key } = nodes[i];
          let translation = langData[key] || '';
          let parts = splitMarkersAndHtml(translation);
          result.push({ idx: i, parts });
        }
        self.postMessage({ batchIdx, result });
      };
    `;

    this.workerPool = new WorkerPool(workerCode, this.maxWorker);
    this._prefetchPromise = this.prefetchEnterprise();

    try {
      this._bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fv-lang-v3') : null;
    } catch (e) {
      this._bc = null;
    }
    if (this._bc) {
      this._bc.onmessage = (ev) => this._onBroadcastLang(ev.data);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  private isLocalDev(): boolean {
    try {
      const host = location.hostname || '';
      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host.endsWith('.local')
      );
    } catch (e) {
      return false;
    }
  }

  private getLangFromURL(): string | null {
    if (this.isLocalDev()) return null;
    try {
      const path = location.pathname;
      const m = path.match(/^\/(en|th)(\/|$)/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  private getLangFromStorage(): string | null {
    try {
      const stored = localStorage.getItem('selectedLang');
      return stored && this.SUPPORTED_LANGS.includes(stored) ? stored : null;
    } catch (e) {
      return null;
    }
  }

  private detectBrowserLanguage(): string {
    try {
      const navigatorWithUserLang = navigator as Navigator & { userLanguage?: string };
      const languages =
        navigatorWithUserLang.languages ||
        [navigatorWithUserLang.language || navigatorWithUserLang.userLanguage];
      for (const lang of languages) {
        const code = lang.split('-')[0];
        if (this.SUPPORTED_LANGS.includes(code)) return code;
      }
    } catch (e) {
      // fall through
    }
    return this.DEFAULT_LANG;
  }

  private resolveCurrentLang(): LangDecision {
    if (this.isLocalDev()) {
      const storedLang = this.getLangFromStorage();
      if (storedLang) return { lang: storedLang, source: 'storage' };
      return { lang: this.detectBrowserLanguage(), source: 'browser' };
    }

    const urlLang = this.getLangFromURL();
    if (urlLang) {
      return { lang: urlLang, source: 'url' };
    }

    const storedLang = this.getLangFromStorage();
    if (storedLang) {
      return { lang: storedLang, source: 'storage' };
    }

    return { lang: this.detectBrowserLanguage(), source: 'browser' };
  }

  private updateURLForLanguage(lang: string) {
    if (this.isLocalDev()) return;
    try {
      const currentPath = location.pathname;
      const currentLang = this.getLangFromURL();
      if (currentLang === lang) return;

      let newPath: string;
      if (currentLang) {
        newPath = currentPath.replace(/^\/(en|th)(\/|$)/, '/' + lang + '$2');
      } else {
        newPath = '/' + lang + (currentPath === '/' ? '' : currentPath);
      }

      const newURL = newPath + location.search + location.hash;
      history.replaceState({ lang, ts: Date.now() }, '', newURL);
    } catch (e) {
      console.error('Error updating URL:', e);
    }
  }

  private async initialize() {
    try {
      const markerRaw = sessionStorage.getItem('fv-forcereload');
      if (markerRaw) {
        try {
          const marker = JSON.parse(markerRaw);
          const inflight = sessionStorage.getItem('fv-reload-inflight');
          const ack = sessionStorage.getItem('fv-reload-ack');

          if (ack === marker.id) {
            sessionStorage.removeItem('fv-forcereload');
            sessionStorage.removeItem('fv-reload-inflight');
          } else if (inflight === marker.id) {
            sessionStorage.setItem('fv-reload-ack', marker.id);
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }

    if (this.isInitialized) return;

    try {
      await this.loadLanguagesConfig();
      this.observeMutations();
      this.setupNavigationHandlers();
      this.isInitialized = true;
      setTimeout(() => {
        if (document.body && document.body.style.opacity === '0') {
          document.body.style.transition = 'opacity 0.28s cubic-bezier(.47,1.64,.41,.8)';
          document.body.style.opacity = '1';
        }
      }, 0);
    } catch (error) {
      console.error('Error during initialization:', error);
      this.showError('ไม่สามารถเริ่มต้นระบบได้');
      setTimeout(() => {
        if (document.body && document.body.style.opacity === '0') {
          document.body.style.opacity = '1';
        }
      }, 0);
    }
  }

  private async loadLanguagesConfig() {
    await this._prefetchPromise;

    if (!this.languagesConfig || !Object.keys(this.languagesConfig).length) {
      throw new Error('Config ไม่ถูกต้อง');
    }

    await this.prepareAllButtonTexts();
    await this.handleInitialLanguage();
    this.updateLanguageSelectorUI();
  }

  private async handleInitialLanguage() {
    this.storeOriginalContent();
    const decision = this.resolveCurrentLang();
    this.selectedLang = decision.lang;

    if (!this.isLocalDev()) {
      if (decision.source === 'storage' || decision.source === 'browser') {
        this.updateURLForLanguage(this.selectedLang);
      }
    }

    if (decision.source === 'url') {
      try {
        localStorage.setItem('selectedLang', this.selectedLang);
      } catch (e) {
      }
    }

    this.showButtonTextForLang(this.selectedLang);

    if (this.selectedLang !== 'en' || this.getEnSource() === 'json') {
      await this.updatePageLanguage(this.selectedLang, false);
    }
  }

  private async prefetchEnterprise() {
    if (typeof document !== 'undefined' && document.head) {
      ['//cdn.jsdelivr.net', '//fonts.googleapis.com'].forEach((href) => {
        if (!document.head.querySelector(`link[href^="${href}"]`)) {
          const l = document.createElement('link');
          l.rel = 'preconnect';
          l.href = href;
          l.crossOrigin = 'anonymous';
          document.head.appendChild(l);
        }
      });

      if (!document.head.querySelector('link[rel="preload"][as="fetch"]')) {
        const preload = document.createElement('link');
        preload.rel = 'preload';
        preload.as = 'fetch';
        preload.href = '/assets/lang/options/db.min.json';
        preload.crossOrigin = 'anonymous';
        document.head.appendChild(preload);
      }
    }

    let config: LanguagesConfig | null = null;
    try {
      const localConfig = localStorage.getItem('__lang_cfg');
      const sessionConfig = sessionStorage.getItem('__lang_cfg');
      if (localConfig) config = JSON.parse(localConfig);
      if (!config && sessionConfig) config = JSON.parse(sessionConfig);
    } catch (e) {
    }

    const url = '/assets/lang/options/db.min.json';
    try {
      const resp = await fetch(url, { cache: 'no-cache' });
      if (resp.ok) {
        const newConfig = await resp.json();
        config = newConfig;
        localStorage.setItem('__lang_cfg', JSON.stringify(config));
        sessionStorage.setItem('__lang_cfg', JSON.stringify(config));
      }
    } catch (e) {
    }

    if (config) this.languagesConfig = config;
  }

  private async loadLanguageData(lang: string): Promise<LanguageData | null> {
    if (this.languageCache[lang]) return this.languageCache[lang];

    const url = `/assets/lang/${lang}.min.json`;
    try {
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) throw new Error('Failed to load');
      const data = await resp.json();
      const flattened = this.flattenLanguageJson(data);
      this.languageCache[lang] = flattened;
      return flattened;
    } catch (e) {
      console.error(`Error loading language ${lang}:`, e);
      return null;
    }
  }

  private flattenLanguageJson(json: Record<string, unknown>): LanguageData {
    const result: LanguageData = {};
    const recur = (obj: Record<string, unknown>) => {
      Object.entries(obj).forEach(([k, v]) => {
        if (typeof v === 'object' && v !== null) {
          recur(v as Record<string, unknown>);
        } else {
          result[k] = v as string;
        }
      });
    };
    recur(json);
    return result;
  }

  private getEnSource(): 'json' | 'html' {
    if (this.languagesConfig?.en?.enSource === 'json') return 'json';
    return 'html';
  }

  async selectLanguage(language: string) {
    if (!this.languagesConfig[language]) {
      console.warn(`ไม่รองรับภาษา: ${language}`);
      language = 'en';
    }

    if (this.selectedLang === language) {
      await this.closeLanguageDropdown();
      return;
    }

    this._userExplicitLang = language;
    this.lastSelectedLang = this.selectedLang;
    this.updateURLForLanguage(language);
    await this.updatePageLanguage(language, false);
    await this.closeLanguageDropdown();
  }

  private async updatePageLanguage(language: string, shouldUpdateURL = true) {
    if (this.isUpdatingLanguage) return;

    try {
      this.isUpdatingLanguage = true;
      this.lastSelectedLang = this.selectedLang;

      if (shouldUpdateURL && !this.isLocalDev()) {
        this.updateURLForLanguage(language);
      }

      try {
        localStorage.setItem('selectedLang', language);
      } catch (e) {
      }

      document.documentElement.setAttribute('lang', language);

      if (language === this.detectBrowserLanguage()) {
        document.documentElement.setAttribute('translate', 'no');
        if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
          const meta = document.createElement('meta');
          meta.name = 'google';
          meta.content = 'notranslate';
          document.head.appendChild(meta);
        }
      } else {
        document.documentElement.removeAttribute('translate');
        const meta = document.querySelector('meta[name="google"][content="notranslate"]');
        if (meta) meta.remove();
      }

      if (language === 'en') {
        if (this.getEnSource() === 'json') {
          const languageData = await this.loadLanguageData('en');
          if (languageData) await this.parallelStreamingTranslate(languageData);
          else await this.resetToEnglishContent();
        } else {
          await this.resetToEnglishContent();
        }
      } else {
        const languageData = await this.loadLanguageData(language);
        if (languageData) await this.parallelStreamingTranslate(languageData);
        else await this.resetToEnglishContent();
      }

      this.selectedLang = language;
      this.showButtonTextForLang(language);

      if (this._bc) {
        try {
          this._bc.postMessage({ lang: language, url: location.href, ts: Date.now() });
        } catch (e) {
        }
      }

      try {
        window.dispatchEvent(
          new CustomEvent('languageChange', {
            detail: { language, previousLanguage: this.lastSelectedLang },
          }),
        );
      } catch (e) {
      }
    } catch (error) {
      console.error('Error updating page language:', error);
      this.showError('เกิดข้อผิดพลาดในการเปลี่ยนภาษา');
      await this.resetToEnglishContent();
    } finally {
      this.isUpdatingLanguage = false;
    }
  }

  private setupNavigationHandlers() {
    window.addEventListener('popstate', async (event) => {
      try {
        if (this.isLocalDev()) {
          return;
        }

        const preferredLang = this._userExplicitLang || this.getLangFromStorage();

        if (preferredLang) {
          if (preferredLang !== this.selectedLang) {
            await this.updatePageLanguage(preferredLang, true);
          } else {
            this.updateURLForLanguage(preferredLang);
          }
          return;
        }

        if (event.state && event.state.lang && event.state.lang !== this.selectedLang) {
          await this.updatePageLanguage(event.state.lang, false);
          return;
        }

        const urlLang = this.getLangFromURL();
        if (urlLang && urlLang !== this.selectedLang) {
          await this.updatePageLanguage(urlLang, false);
          try {
            localStorage.setItem('selectedLang', urlLang);
          } catch (e) {
          }
        }
      } catch (e) {
        console.error('Popstate handler error:', e);
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'selectedLang') {
        const newLang = e.newValue;
        const urlLang = this.getLangFromURL();

        if (!this.isLocalDev() && urlLang && urlLang !== newLang) {
          this.updateURLForLanguage(newLang || this.DEFAULT_LANG);
        }

        if (newLang && newLang !== this.selectedLang) {
          this.updatePageLanguage(newLang, false).catch(() => {
          });
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (this.isLocalDev()) return;

        const preferredLang = this._userExplicitLang || this.getLangFromStorage();
        if (preferredLang && preferredLang !== this.selectedLang) {
          this.updatePageLanguage(preferredLang, true).catch(() => {
          });
          return;
        }

        const urlLang = this.getLangFromURL();
        if (urlLang && urlLang !== this.selectedLang) {
          this.updatePageLanguage(urlLang, false).catch(() => {
          });
        }
      }
    });
  }

  private _onBroadcastLang(msg: { lang?: string; url?: string }) {
    try {
      if (!msg || typeof msg !== 'object') return;
      const { lang, url } = msg;
      if (!lang || lang === this.selectedLang) return;

      if (url && url === location.href) return;

      if (!this.isLocalDev()) {
        const currentUrlLang = this.getLangFromURL();
        if (currentUrlLang && currentUrlLang !== lang) {
          this.updateURLForLanguage(lang);
          this.updatePageLanguage(lang, false).catch(() => {
          });
        } else if (!currentUrlLang) {
          this.updatePageLanguage(lang, true).catch(() => {
          });
        } else {
          this.updatePageLanguage(lang, false).catch(() => {
          });
        }
      } else {
        this.updatePageLanguage(lang, false).catch(() => {
        });
      }
    } catch (e) {
    }
  }

  private async prepareAllButtonTexts() {
    this.languageButton = document.getElementById('language-button');
    if (!this.languageButton || !this.languagesConfig) return;

    Array.from(this.languageButton.querySelectorAll('.lang-btn-txt, .lang-btn-svg')).forEach((e) =>
      e.remove(),
    );

    let flexWrap = this.languageButton.querySelector<HTMLSpanElement>('.lang-btn-flex');
    if (!flexWrap) {
      flexWrap = document.createElement('span');
      flexWrap.className = 'lang-btn-flex';
      flexWrap.style.cssText =
        'display:inline-flex;align-items:center;gap:15px;vertical-align:middle;';
      this.languageButton.innerHTML = '';
      this.languageButton.appendChild(flexWrap);
    } else {
      flexWrap.innerHTML = '';
    }

    const svgWrap = document.createElement('span');
    svgWrap.className = 'lang-btn-svg';
    svgWrap.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18.5" height="18.5" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7"/><path d="M9 3v2c0 4.418 -2.239 8 -5 8"/><path d="M5 9c0 2.144 2.952 3.908 6.7 4"/><path d="M12 20l4 -9l4 9"/><path d="M19.1 18h-6.2"/></svg>';
    svgWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;';
    flexWrap.appendChild(svgWrap);

    Object.entries(this.languagesConfig).forEach(([lang, config]) => {
      const span = document.createElement('span');
      span.className = 'lang-btn-txt';
      span.dataset.lang = lang;
      span.textContent = config.buttonText || 'Language';
      span.style.display = 'none';
      span.style.lineHeight = '1';
      flexWrap.appendChild(span);
    });

    this.showButtonTextForLang(this.selectedLang || 'en');
  }

  private showButtonTextForLang(lang: string) {
    this.languageButton = document.getElementById('language-button');
    if (!this.languageButton) return;
    const flexWrap = this.languageButton.querySelector<HTMLSpanElement>('.lang-btn-flex');
    if (!flexWrap) return;

    Array.from(flexWrap.querySelectorAll<HTMLSpanElement>('.lang-btn-txt')).forEach((span) => {
      span.style.display = span.dataset.lang === lang ? '' : 'none';
    });
  }

  private updateLanguageSelectorUI() {
    this.initializeCustomLanguageSelector();
  }

  private initializeCustomLanguageSelector() {
    this.languageButton = document.getElementById('language-button');
    if (!this.languageButton) return;

    this.prepareAllButtonTexts();
    this.showButtonTextForLang(this.selectedLang || 'en');

    if (this.languageOverlay?.parentElement) {
      this.languageOverlay.parentElement.removeChild(this.languageOverlay);
    }
    if (this.languageDropdown?.parentElement) {
      this.languageDropdown.parentElement.removeChild(this.languageDropdown);
    }

    this.languageOverlay = document.createElement('div');
    this.languageOverlay.id = 'language-overlay';
    this.languageOverlay.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(this.languageOverlay);

    this.languageDropdown = document.createElement('div');
    this.languageDropdown.id = 'language-dropdown';
    this.languageDropdown.style.cssText =
      'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;z-index:9999;max-height:80vh;overflow-y:auto;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(this.languageDropdown);

    this.populateLanguageDropdown();
    this.setupEventListeners();
    this.setupDropdownScrollLock();
  }

  private populateLanguageDropdown() {
    if (!this.languageDropdown) return;
    const fragment = document.createDocumentFragment();
    Object.entries(this.languagesConfig).forEach(([lang, config]) => {
      const option = document.createElement('div');
      option.className = 'language-option';
      option.textContent = config.label;
      option.dataset.language = lang;
      option.style.cssText = 'padding:12px 24px;cursor:pointer;hover:bg-gray-100;';
      fragment.appendChild(option);
    });
    this.languageDropdown.innerHTML = '';
    this.languageDropdown.appendChild(fragment);
  }

  private setupEventListeners() {
    if (!this.languageButton || !this.languageOverlay || !this.languageDropdown) return;
    this.languageButton.onclick = () => this.toggleLanguageDropdown();
    this.languageOverlay.onclick = () => this.closeLanguageDropdown();
    this.languageDropdown.onclick = (e) => {
      const option = (e.target as HTMLElement).closest('.language-option') as HTMLElement | null;
      if (option) {
        const lang = option.dataset.language;
        if (lang) this.selectLanguage(lang);
      }
    };
  }

  private setupDropdownScrollLock() {
    if (!this.languageDropdown) return;

    this._dropdownWheelListener = (e: WheelEvent) => {
      const el = this.languageDropdown as HTMLElement;
      const delta = e.deltaY;
      const atTop = el.scrollTop === 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((atTop && delta < 0) || (atBottom && delta > 0)) e.preventDefault();
      e.stopPropagation();
    };

    this.languageDropdown.addEventListener('wheel', this._dropdownWheelListener, { passive: false });
  }

  private toggleLanguageDropdown() {
    this.isLanguageDropdownOpen ? this.closeLanguageDropdown() : this.openLanguageDropdown();
  }

  private async openLanguageDropdown() {
    if (this.isLanguageDropdownOpen || !this.languageOverlay || !this.languageDropdown) return;
    this.scrollPosition = window.scrollY || 0;
    this.isLanguageDropdownOpen = true;

    this.languageOverlay.style.display = 'block';
    this.languageDropdown.style.display = 'block';
    document.body.style.cssText = `position:fixed;left:0;right:0;overflow-y:scroll;top:-${this.scrollPosition}px;`;

    requestAnimationFrame(() => {
      this.languageOverlay.style.opacity = '1';
      this.languageDropdown.style.opacity = '1';
    });
  }

  private async closeLanguageDropdown() {
    if (!this.isLanguageDropdownOpen || !this.languageOverlay || !this.languageDropdown) return;
    this.isLanguageDropdownOpen = false;

    this.languageOverlay.style.opacity = '0';
    this.languageDropdown.style.opacity = '0';

    setTimeout(() => {
      this.languageOverlay.style.display = 'none';
      this.languageDropdown.style.display = 'none';
      document.body.style.cssText = '';
      window.scrollTo(0, this.scrollPosition);
    }, this.FADE_DURATION);
  }

  private async parallelStreamingTranslate(languageData: LanguageData, elements?: Element[]) {
    const elList = elements || Array.from(document.querySelectorAll('[data-translate]'));
    if (!elList.length) return;

    const chunkSize = Math.max(8, Math.ceil(elList.length / this.maxWorker));
    const batches: Element[][] = [];
    const nodeMeta: WorkerNode[][] = [];

    for (let i = 0; i < elList.length; i += chunkSize) {
      const batch = elList.slice(i, i + chunkSize);
      batches.push(batch);
      nodeMeta.push(batch.map((el) => ({ key: el.getAttribute('data-translate') })));
    }

    const jobs = nodeMeta.map((meta, i) =>
      this.workerPool.execute({ nodes: meta, langData: languageData, batchIdx: i }),
    );

    const results = await Promise.all(jobs);

    for (let j = 0; j < results.length; ++j) {
      const batch = batches[j];
      const resArr = results[j].result;
      for (let k = 0; k < resArr.length; ++k) {
        const el = batch[resArr[k].idx];
        if (!el) continue;
        this._replaceDOMWithMarkerReplace(el, resArr[k].parts);
      }
    }
  }

  private _replaceDOMWithMarkerReplace(el: Element, parts: Part[]) {
    const normalized: Part[] = [];
    let buffer = '';
    let bufferHasHtml = false;

    const pushBuffer = () => {
      if (!buffer) return;
      if (bufferHasHtml) {
        normalized.push({ type: 'html', html: buffer });
      } else {
        normalized.push({ type: 'text', text: buffer });
      }
      buffer = '';
      bufferHasHtml = false;
    };

    parts.forEach((p) => {
      if (p.type === 'text' || p.type === 'html') {
        if (!buffer) {
          buffer = p.type === 'text' ? p.text || '' : p.html || '';
          bufferHasHtml = p.type === 'html' || /<[^>]+>/.test(buffer);
        } else if (p.type === 'text') {
          buffer += p.text || '';
          if (bufferHasHtml || /<[^>]+>/.test(buffer)) bufferHasHtml = true;
        } else {
          buffer += p.html || '';
          bufferHasHtml = true;
        }
      } else {
        pushBuffer();
        normalized.push(p);
      }
    });
    pushBuffer();

    const newNodes: MarkerNode[] = [];
    const domParser = new DOMParser();
    let containsExplicitSvgOrLsvg = false;

    normalized.forEach((p) => {
      if (p.type === 'text') {
        newNodes.push(document.createTextNode(p.text));
      } else if (p.type === 'html') {
        const htmlStr = (p.html || '').trim();
        if (!htmlStr) return;
        if (/<svg[\s>]/i.test(htmlStr)) {
          try {
            const svgDoc = domParser.parseFromString(htmlStr, 'image/svg+xml');
            const svgRoot =
              svgDoc.documentElement && svgDoc.documentElement.nodeName !== 'parsererror'
                ? svgDoc.documentElement
                : null;
            if (svgRoot) {
              newNodes.push(document.importNode(svgRoot, true));
              containsExplicitSvgOrLsvg = true;
              return;
            }
          } catch (e) {
          }
        }
        const template = document.createElement('template');
        template.innerHTML = htmlStr;
        const frag = template.content.cloneNode(true);
        Array.from(frag.childNodes).forEach((n) => newNodes.push(n));
      } else if (p.type === 'svg') {
        newNodes.push({ __svgMarker: true, id: p.id || null });
        containsExplicitSvgOrLsvg = true;
      } else if (p.type === 'lsvg') {
        newNodes.push({ __svgMarker: true, lsvg: true, id: p.id || null });
        containsExplicitSvgOrLsvg = true;
      } else if (p.type === 'slot') {
        newNodes.push({ __slotMarker: true, name: p.name || null });
      } else {
        newNodes.push(this._createMarkerNode(p));
      }
    });

    const existingSvgsAll = Array.from(el.querySelectorAll<SVGElement>('svg'));
    if (!containsExplicitSvgOrLsvg && existingSvgsAll.length > 0) {
      newNodes.unshift({ __svgMarker: true, lsvg: true, id: null, __predicted: true });
    }

    const existing = Array.from(el.childNodes) as Node[];
    const existingSvgs = existingSvgsAll.slice();
    const existingSlotsAll = Array.from(
      el.querySelectorAll<HTMLElement>('[data-translate-slot],[data-slot]'),
    );
    const usedSvgs = new Set<SVGElement>();
    const usedSlots = new Set<HTMLElement>();
    const existingAnchorsAll = Array.from(el.querySelectorAll<HTMLAnchorElement>('a'));
    const usedAnchors = new Set<HTMLAnchorElement>();

    const resolveSvgMarkerGlobal = (id: string | null) => {
      if (id) {
        for (const s of existingSvgs) {
          if (usedSvgs.has(s)) continue;
          if (
            (s.getAttribute && s.getAttribute('id') === id) ||
            (s.getAttribute && s.getAttribute('data-svg-id') === id) ||
            (s.dataset && s.dataset.svgId === id)
          ) {
            usedSvgs.add(s);
            return s as Element;
          }
        }
      }
      const available = existingSvgs.filter((s) => !usedSvgs.has(s));
      if (available.length >= 1) {
        usedSvgs.add(available[0]);
        return available[0] as Element;
      }
      return null;
    };

    const resolveSlotMarkerGlobal = (name: string | null) => {
      if (name) {
        for (const s of existingSlotsAll) {
          if (usedSlots.has(s)) continue;
          if (
            (s.getAttribute && s.getAttribute('data-translate-slot') === name) ||
            (s.getAttribute && s.getAttribute('data-slot') === name) ||
            (s.dataset && (s.dataset.translateSlot === name || s.dataset.slot === name))
          ) {
            usedSlots.add(s);
            return s;
          }
        }
      }
      const available = existingSlotsAll.filter((s) => !usedSlots.has(s));
      if (!name && available.length === 1) {
        usedSlots.add(available[0]);
        return available[0];
      }
      return null;
    };

    const resolveAnchorMarkerGlobal = (newNode: HTMLElement) => {
      const id = newNode.getAttribute('id') || newNode.dataset?.id || null;
      if (id) {
        for (const a of existingAnchorsAll) {
          if (usedAnchors.has(a)) continue;
          if (
            (a.getAttribute && a.getAttribute('id') === id) ||
            (a.getAttribute && a.getAttribute('data-anchor-id') === id) ||
            (a.dataset && (a.dataset.anchorId === id || a.dataset.id === id))
          ) {
            usedAnchors.add(a);
            return a;
          }
        }
      }
      const available = existingAnchorsAll.filter((a) => !usedAnchors.has(a));
      if (available.length >= 1) {
        usedAnchors.add(available[0]);
        return available[0];
      }
      return null;
    };

    let readIndex = 0;
    for (let i = 0; i < newNodes.length; i++) {
      const newNode = newNodes[i];
      let currentOld = existing[readIndex];

      if (newNode && typeof newNode === 'object' && '__slotMarker' in newNode) {
        const slotNode = newNode as { __slotMarker: true; name: string | null };
        const slotEl = resolveSlotMarkerGlobal(slotNode.name);
        if (slotEl) {
          if (currentOld !== slotEl) {
            try {
              el.insertBefore(slotEl, currentOld || null);
            } catch (e) {
            }
            existing.splice(existing.indexOf(slotEl), 1);
            existing.splice(readIndex, 0, slotEl);
            currentOld = existing[readIndex];
          }
          readIndex++;
          continue;
        } else {
          const span = document.createElement('span');
          span.setAttribute('data-translate-slot', slotNode.name || 'slot');
          if (currentOld) el.insertBefore(span, currentOld);
          else el.appendChild(span);
          existing.splice(readIndex, 0, span);
          readIndex++;
          continue;
        }
      }

      if (newNode && typeof newNode === 'object' && '__svgMarker' in newNode) {
        const svgNode = newNode as MarkerNode & { id?: string; __predicted?: true };
        const svgRef = resolveSvgMarkerGlobal(svgNode.id || null);
        if (svgRef) {
          if (svgNode.__predicted) {
            try {
              if (el.firstChild !== svgRef) el.insertBefore(svgRef, el.firstChild);
              const idxOld = existing.indexOf(svgRef);
              if (idxOld !== -1) {
                existing.splice(idxOld, 1);
                existing.splice(0, 0, svgRef);
              }
              if (readIndex === 0) readIndex = 1;
            } catch (e) {
            }
            continue;
          }
          if (currentOld !== svgRef) {
            try {
              el.insertBefore(svgRef, currentOld || null);
            } catch (e) {
            }
            const prevIdx = existing.indexOf(svgRef);
            if (prevIdx !== -1) existing.splice(prevIdx, 1);
            existing.splice(readIndex, 0, svgRef);
            currentOld = existing[readIndex];
          }
          readIndex++;
          continue;
        } else {
          const ns = 'http://www.w3.org/2000/svg';
          const createdSvg = document.createElementNS(ns, 'svg');
          if (svgNode.id) {
            createdSvg.setAttribute('id', svgNode.id);
            createdSvg.setAttribute('data-svg-id', svgNode.id);
          }
          if (svgNode.__predicted) {
            if (el.firstChild) el.insertBefore(createdSvg, el.firstChild);
            else el.appendChild(createdSvg);
            existing.splice(0, 0, createdSvg);
            if (readIndex === 0) readIndex = 1;
            continue;
          } else {
            if (currentOld) el.insertBefore(createdSvg, currentOld);
            else el.appendChild(createdSvg);
            existing.splice(readIndex, 0, createdSvg);
            readIndex++;
            continue;
          }
        }
      }

      if (
        newNode &&
        (newNode as Node).nodeType === Node.ELEMENT_NODE &&
        ((newNode as Element).tagName || '').toLowerCase() === 'a'
      ) {
        const anchorElement = newNode as HTMLElement;
        const anchorRef = resolveAnchorMarkerGlobal(anchorElement);
        if (anchorRef) {
          if (currentOld !== anchorRef) {
            try {
              el.insertBefore(anchorRef, currentOld || null);
            } catch (e) {
            }
            const prevIdx = existing.indexOf(anchorRef);
            if (prevIdx !== -1) existing.splice(prevIdx, 1);
            existing.splice(readIndex, 0, anchorRef);
            currentOld = existing[readIndex];
          }
          try {
            if (anchorElement.textContent && anchorElement.textContent !== '') {
              if (anchorRef.textContent !== anchorElement.textContent)
                anchorRef.textContent = anchorElement.textContent;
            }
            const newAttrs = Array.from((anchorElement.attributes || []) as Attr[]);
            newAttrs.forEach((a) => {
              try {
                anchorRef.setAttribute(a.name, a.value);
              } catch (e) {
              }
            });
          } catch (e) {
          }
          readIndex++;
          continue;
        } else {
          if (currentOld) el.insertBefore(document.importNode(anchorElement, true), currentOld);
          else el.appendChild(document.importNode(anchorElement, true));
          existing.splice(readIndex, 0, el.childNodes[readIndex]);
          readIndex++;
          continue;
        }
      }

      if (currentOld) {
        if (
          currentOld.nodeType === Node.TEXT_NODE &&
          newNode &&
          (newNode as Node).nodeType === Node.TEXT_NODE
        ) {
          const newText = (newNode as Node).textContent || '';
          if (currentOld.textContent !== newText) currentOld.textContent = newText;
          readIndex++;
          continue;
        }

        if (
          currentOld.nodeType === Node.ELEMENT_NODE &&
          newNode &&
          (newNode as Node).nodeType === Node.ELEMENT_NODE
        ) {
          const currentOldEl = currentOld as Element;
          const newNodeEl = newNode as Element;
          try {
            if (currentOldEl.tagName === newNodeEl.tagName) {
              while (currentOldEl.firstChild) currentOldEl.removeChild(currentOldEl.firstChild);
              Array.from(newNodeEl.childNodes).forEach((c) =>
                currentOldEl.appendChild(document.importNode(c, true)),
              );
              const newAttrs = Array.from((newNodeEl.attributes || []) as Attr[]);
              const oldAttrs = Array.from((currentOldEl.attributes || []) as Attr[]);
              newAttrs.forEach((a) => {
                try {
                  currentOldEl.setAttribute(a.name, a.value);
                } catch (e) {
                }
              });
              oldAttrs.forEach((a) => {
                if (!newNodeEl.hasAttribute(a.name)) {
                  try {
                    currentOldEl.removeAttribute(a.name);
                  } catch (e) {
                  }
                }
              });
              readIndex++;
              continue;
            }
          } catch (e) {
          }
        }

        if (
          currentOld.nodeType === Node.ELEMENT_NODE &&
          ((currentOld as Element).tagName || '').toLowerCase() === 'svg'
        ) {
          readIndex++;
          i--;
          continue;
        }

        if (
          currentOld.nodeType === Node.ELEMENT_NODE &&
          (((currentOld as Element).hasAttribute('data-translate-slot') ||
            (currentOld as Element).hasAttribute('data-slot')))
        ) {
          readIndex++;
          i--;
          continue;
        }

        try {
          el.replaceChild(document.importNode(newNode as Node, true), currentOld);
          existing[readIndex] = el.childNodes[readIndex];
          readIndex++;
          continue;
        } catch (e) {
          try {
            el.insertBefore(document.importNode(newNode as Node, true), currentOld);
            el.removeChild(currentOld);
            existing[readIndex] = el.childNodes[readIndex];
            readIndex++;
            continue;
          } catch (e2) {
            readIndex++;
            continue;
          }
        }
      } else {
        try {
          el.appendChild(document.importNode(newNode as Node, true));
          const lastChild = el.lastChild;
          if (lastChild) existing.push(lastChild);
        } catch (e) {
          try {
            el.appendChild((newNode as Node).cloneNode(true));
            const lastChild = el.lastChild;
            if (lastChild) existing.push(lastChild);
          } catch (e2) {
          }
        }
        readIndex++;
        continue;
      }
    }

    for (let j = el.childNodes.length - 1; j >= readIndex; j--) {
      const node = el.childNodes[j];
      if (!node) continue;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const nodeEl = node as Element;
        if (nodeEl.tagName.toLowerCase() === 'svg') continue;
        if (nodeEl.hasAttribute('data-translate-slot') || nodeEl.hasAttribute('data-slot'))
          continue;
      }
      try {
        el.removeChild(node);
      } catch (e) {
      }
    }
  }

  private _createMarkerNode(marker: Part): Node {
    if (marker.type === 'text') return document.createTextNode(marker.text);
    if (marker.type === 'a') {
      const a = document.createElement('a');
      if (marker.translate) a.textContent = marker.text;
      return a;
    }
    if (marker.type === 'br') return document.createElement('br');
    if (marker.type === 'strong') {
      const s = document.createElement('strong');
      s.textContent = marker.text;
      return s;
    }
    if (marker.type === 'html') {
      const template = document.createElement('template');
      template.innerHTML = marker.html || '';
      return template.content.cloneNode(true);
    }
    return document.createTextNode('');
  }

  private storeOriginalContent() {
    document.querySelectorAll<HTMLElement>('[data-translate]').forEach((el) => {
      if (!el.hasAttribute('data-original-text')) {
        el.setAttribute('data-original-text', el.textContent?.trim() || '');
      }
      if (!el.hasAttribute('data-original-style')) {
        el.setAttribute('data-original-style', el.style.cssText);
      }
    });
  }

  private async resetToEnglishContent() {
    const elements = document.querySelectorAll<HTMLElement>('[data-translate]');
    for (let idx = 0; idx < elements.length; idx++) {
      const el = elements[idx];
      const original = el.getAttribute('data-original-text');
      if (original) {
        el.textContent = original;
      }
      const originalStyle = el.getAttribute('data-original-style');
      if (originalStyle) {
        el.style.cssText = originalStyle;
      }
    }
  }

  private observeMutations() {
    if (this.mutationObserver) this.mutationObserver.disconnect();

    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.mutationThrottleTimeout) return;

      this.mutationThrottleTimeout = setTimeout(() => {
        const added: Element[] = [];
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const translatable = (node as Element).querySelectorAll<HTMLElement>('[data-translate]');
              if (translatable.length) {
                added.push(...Array.from(translatable));
                translatable.forEach((el) => {
                  if (!el.hasAttribute('data-original-text')) {
                    el.setAttribute('data-original-text', el.textContent?.trim() || '');
                  }
                });
              }
            }
          });
        });

        if (added.length && this.selectedLang !== 'en') {
          this.parallelStreamingTranslate(this.languageCache[this.selectedLang], added);
        }
        this.mutationThrottleTimeout = null;
      }, 100);
    });

    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  private showError(message: string) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'language-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText =
      'position:fixed;top:20px;right:20px;background:#ff4444;color:white;padding:10px 20px;border-radius:4px;z-index:9999;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(errorDiv);

    requestAnimationFrame(() => {
      errorDiv.style.opacity = '1';
      setTimeout(() => {
        errorDiv.style.opacity = '0';
        setTimeout(() => errorDiv.remove(), 300);
      }, 3000);
    });
  }

  destroy() {
    if (this.languageOverlay) this.languageOverlay.remove();
    if (this.languageDropdown) this.languageDropdown.remove();
    if (this.mutationObserver) this.mutationObserver.disconnect();
    if (this.workerPool) this.workerPool.destroy();
    if (this._bc) {
      try {
        this._bc.close();
      } catch (e) {
      }
    }
  }
}

interface Window {
  languageManager: LanguageManager;
}

const languageManager = new LanguageManager();
window.languageManager = languageManager;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = languageManager;
}