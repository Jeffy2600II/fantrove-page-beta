// overlay.js — v2
// ─────────────────────────────────────────────────────────────
// v2 changes:
//  - ลบ ensureStyles() ออกทั้งหมด
//  - ลบ STYLE_ID และ style injection ทุกจุด
//    CSS ของ #instant-loading-overlay อยู่ใน /assets/css/loading.css
//  - โค้ดเบาลง ~80 บรรทัด
//  - ยังคง backward-compatible proxy ไป contentLoadingManager
// ─────────────────────────────────────────────────────────────
const OVERLAY_ID = 'instant-loading-overlay';
const DEFAULT_ZINDEX = 15000;
const FADE_DURATION_MS = 360;
function buildOverlayElement(message = '', zIndex = DEFAULT_ZINDEX) {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.zIndex = String(zIndex ?? DEFAULT_ZINDEX);
    const spinnerWrap = document.createElement('div');
    spinnerWrap.className = 'content-loading-spinner';
    const spinnerSvgWrap = document.createElement('div');
    spinnerSvgWrap.className = 'spinner-svg';
    spinnerSvgWrap.setAttribute('aria-hidden', 'true');
    spinnerSvgWrap.innerHTML = `
<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true" role="img">
  <circle class="spinner-svg-bg" cx="24" cy="24" r="20"/>
  <circle class="spinner-svg-fg" cx="24" cy="24" r="20"/>
</svg>`.trim();
    const messageEl = document.createElement('div');
    messageEl.className = 'loading-message';
    messageEl.textContent = message || (localStorage.getItem('selectedLang') === 'th' ?
        'กำลังโหลดเนื้อหา...' : 'Loading content...');
    spinnerWrap.appendChild(spinnerSvgWrap);
    spinnerWrap.appendChild(messageEl);
    overlay.appendChild(spinnerWrap);
    return overlay;
}
export function showInstantLoadingOverlay(options = {}) {
    try {
        // Proxy to canonical manager if available
        if (typeof window !== 'undefined' &&
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            window._headerV2_contentLoadingManager &&
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            typeof window._headerV2_contentLoadingManager.show === 'function') {
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            return window._headerV2_contentLoadingManager.show(options);
        }
        // Legacy fallback — CSS comes from loading.css (no inline injection)
        // @ts-expect-error TS(2339): Property 'lang' does not exist on type '{}'.
        const lang = options.lang || localStorage.getItem('selectedLang') || 'en';
        // @ts-expect-error TS(2339): Property 'message' does not exist on type '{}'.
        const message = typeof options.message === 'string' && options.message.length > 0 ?
            // @ts-expect-error TS(2339): Property 'message' does not exist on type '{}'.
            options.message :
            (lang === 'th' ? 'กำลังโหลดเนื้อหา...' : 'Loading content...');
        // @ts-expect-error TS(2339): Property 'zIndex' does not exist on type '{}'.
        const zIndex = options.zIndex ?? DEFAULT_ZINDEX;
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            const msgEl = overlay.querySelector('.loading-message');
            if (msgEl && msgEl.textContent !== message)
                msgEl.textContent = message;
            overlay.style.zIndex = String(zIndex);
            overlay.classList.remove('hidden');
        }
        else {
            overlay = buildOverlayElement(message, zIndex);
            document.body.appendChild(overlay);
            overlay.offsetHeight; // force reflow
            overlay.classList.remove('hidden');
        }
        // @ts-expect-error TS(2339): Property 'autoHideAfterMs' does not exist on type ... Remove this comment to see the full error message
        if (options.autoHideAfterMs && Number(options.autoHideAfterMs) > 0) {
            // @ts-expect-error TS(2339): Property 'autoHideAfterMs' does not exist on type ... Remove this comment to see the full error message
            setTimeout(() => removeInstantLoadingOverlay(), Number(options.autoHideAfterMs));
        }
        // @ts-expect-error TS(2339): Property '__removeInstantLoadingOverlay' does not ... Remove this comment to see the full error message
        window.__removeInstantLoadingOverlay = removeInstantLoadingOverlay;
        // @ts-expect-error TS(2339): Property '__instantLoadingOverlayShown' does not e... Remove this comment to see the full error message
        window.__instantLoadingOverlayShown = true;
        return overlay;
    }
    catch (err) {
        console.error('showInstantLoadingOverlay error', err);
        return null;
    }
}
export function removeInstantLoadingOverlay() {
    try {
        if (typeof window !== 'undefined' &&
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            window._headerV2_contentLoadingManager &&
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            typeof window._headerV2_contentLoadingManager.hide === 'function') {
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            return window._headerV2_contentLoadingManager.hide();
        }
        // Legacy fallback
        const overlay = document.getElementById(OVERLAY_ID);
        // @ts-expect-error TS(2339): Property '__instantLoadingOverlayShown' does not e... Remove this comment to see the full error message
        if (!overlay) {
            window.__instantLoadingOverlayShown = false;
            return;
        }
        overlay.classList.add('hidden');
        setTimeout(() => {
            try {
                const el = document.getElementById(OVERLAY_ID);
                if (el?.parentNode)
                    el.parentNode.removeChild(el);
            }
            catch (_) { }
            // @ts-expect-error TS(2339): Property '__instantLoadingOverlayShown' does not e... Remove this comment to see the full error message
            window.__instantLoadingOverlayShown = false;
            // @ts-expect-error TS(2339): Property '__removeInstantLoadingOverlay' does not ... Remove this comment to see the full error message
            try {
                delete window.__removeInstantLoadingOverlay;
            }
            catch (_) { }
        }, FADE_DURATION_MS + 40);
    }
    catch (err) {
        console.error('removeInstantLoadingOverlay error', err);
    }
}
export function isOverlayShown() {
    try {
        if (typeof window !== 'undefined' &&
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            window._headerV2_contentLoadingManager &&
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            typeof window._headerV2_contentLoadingManager.isShown === 'function') {
            // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
            return window._headerV2_contentLoadingManager.isShown();
        }
        const overlay = document.getElementById(OVERLAY_ID);
        return !!overlay && !overlay.classList.contains('hidden');
    }
    catch (e) {
        return false;
    }
}
export default { showInstantLoadingOverlay, removeInstantLoadingOverlay, isOverlayShown };
