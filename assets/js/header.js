// header.js
// ✅ ปรับปรุง: Parallel module loading, improved error handling, robust module base resolution and diagnostics
(function () {
    // Resolve module base reliably from the script tag that loaded this file.
    function detectModuleBase() {
        try {
            // Prefer document.currentScript (works for modern browsers / module loaders)
            // @ts-expect-error TS(2339): Property 'src' does not exist on type 'HTMLOrSVGSc... Remove this comment to see the full error message
            if (document.currentScript && document.currentScript.src) {
                // @ts-expect-error TS(2339): Property 'src' does not exist on type 'HTMLOrSVGSc... Remove this comment to see the full error message
                return document.currentScript.src.replace(/\/[^\/?#]*$/, '/header-modules/');
            }
            // Fallback: scan script tags with a robust regex (handles querystrings/hash)
            const scripts = document.getElementsByTagName('script');
            for (let i = 0; i < scripts.length; i++) {
                const s = scripts[i];
                if (!s.src)
                    continue;
                // match script file name like header.min.js or header.js (with optional query/hash)
                try {
                    if (/\/header(?:\.min)?\.js(\?|#|$)/.test(s.src)) {
                        return s.src.replace(/\/[^\/?#]*$/, '/header-modules/');
                    }
                }
                catch (e) { }
            }
        }
        catch (e) { }
        // Fallback absolute path (project convention)
        return '/assets/js/header-modules/';
    }
    const MODULE_BASE = detectModuleBase();
    const MODULES = [
        'overlay.js',
        'utils.js',
        'dataManager.js',
        'contentLoadingManager.js',
        'contentManager.js',
        'managers.js',
        'unifiedCopyToClipboard.js',
        'init.js'
    ];
    async function loadAll() {
        try {
            // Parallel module loading (relative to resolved MODULE_BASE)
            const imports = MODULES.map(m => import(MODULE_BASE + m));
            const mods = await Promise.all(imports);
            // Find and execute init
            const initMod = mods.find(m => m && typeof m.init === 'function');
            const init = initMod || mods[mods.length - 1];
            if (init && typeof init.init === 'function') {
                await init.init();
                // @ts-expect-error TS(2339): Property 'headerV2_initializeApp' does not exist o... Remove this comment to see the full error message
            }
            else if (typeof window.headerV2_initializeApp === 'function') {
                // @ts-expect-error TS(2339): Property 'headerV2_initializeApp' does not exist o... Remove this comment to see the full error message
                await window.headerV2_initializeApp();
            }
        }
        catch (err) {
            console.error('header.js bootstrap error', err);
            // Diagnostic: attempt to fetch each module to show status/snippet (helps find HTML 404)
            try {
                const diag = await Promise.all(MODULES.map(async (m) => {
                    const url = MODULE_BASE + m;
                    try {
                        const resp = await fetch(url, { cache: 'no-store' });
                        const text = await resp.text();
                        return {
                            url,
                            status: resp.status,
                            ok: resp.ok,
                            contentSnippet: (typeof text === 'string') ? text.slice(0, 400) : ''
                        };
                    }
                    catch (fetchErr) {
                        return { url, fetchError: String(fetchErr) };
                    }
                }));
                console.error('Module diagnostics:', diag);
            }
            catch (diagErr) {
                console.error('Diagnostics failed', diagErr);
            }
            try {
                // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
                if (window._headerV2_utils && window._headerV2_utils.showNotification) {
                    // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
                    window._headerV2_utils.showNotification('โหลด header modules ไม่สำเร็จ', 'error');
                }
            }
            catch { }
        }
        finally {
            try {
                // @ts-expect-error TS(2339): Property '__removeInstantLoadingOverlay' does not ... Remove this comment to see the full error message
                if (typeof window.__removeInstantLoadingOverlay === 'function' && window.__instantLoadingOverlayShown) {
                    // @ts-expect-error TS(2339): Property '__removeInstantLoadingOverlay' does not ... Remove this comment to see the full error message
                    window.__removeInstantLoadingOverlay();
                    // @ts-expect-error TS(2339): Property '__instantLoadingOverlayShown' does not e... Remove this comment to see the full error message
                    window.__instantLoadingOverlayShown = false;
                }
            }
            catch { }
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAll);
    }
    else {
        loadAll();
    }
})();
