// init.js
// ✅ ปรับปรุง: Deferred initialization, phase-based loading, performance monitoring
import { _headerV2_utils, ErrorManager, showNotification } from './utils.js';
import dataManagerDefault from './dataManager.js';
import { contentLoadingManager } from './contentLoadingManager.js';
import { contentManager } from './contentManager.js';
import { scrollManager, performanceOptimizer, navigationManager, buttonManager, subNavManager } from './managers.js';
import unifiedCopy from './unifiedCopyToClipboard.js';
import router from './router.js';

export async function init() {
 // Bootstrapping flag: indicates initial app bootstrap / canonical navigation phase.
 // Other modules should avoid mutating history while this flag is true.
 // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
 if (typeof window !== 'undefined') window._headerV2_bootstrapping = true;
 
 // Expose contentLoadingManager early as canonical manager
 // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
 try { if (!window._headerV2_contentLoadingManager) window._headerV2_contentLoadingManager = contentLoadingManager; } catch (e) {}
 
 // ✅ Phase 1: Critical path initialization (synchronous binding)
 // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
 window._headerV2_utils = _headerV2_utils;
 // @ts-expect-error TS(2339): Property '_headerV2_errorManager' does not exist o... Remove this comment to see the full error message
 window._headerV2_errorManager = _headerV2_utils.errorManager;
 // @ts-expect-error TS(2339): Property '_headerV2_dataManager' does not exist on... Remove this comment to see the full error message
 window._headerV2_dataManager = dataManagerDefault;
 // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
 window._headerV2_contentLoadingManager = contentLoadingManager;
 // @ts-expect-error TS(2339): Property '_headerV2_contentManager' does not exist... Remove this comment to see the full error message
 window._headerV2_contentManager = contentManager;
 // @ts-expect-error TS(2339): Property '_headerV2_scrollManager' does not exist ... Remove this comment to see the full error message
 window._headerV2_scrollManager = scrollManager;
 // @ts-expect-error TS(2339): Property '_headerV2_performanceOptimizer' does not... Remove this comment to see the full error message
 window._headerV2_performanceOptimizer = performanceOptimizer;
 // @ts-expect-error TS(2339): Property '_headerV2_navigationManager' does not ex... Remove this comment to see the full error message
 window._headerV2_navigationManager = navigationManager; // temporary shim (will be overwritten by router below)
 // @ts-expect-error TS(2339): Property '_headerV2_buttonManager' does not exist ... Remove this comment to see the full error message
 window._headerV2_buttonManager = buttonManager;
 // @ts-expect-error TS(2339): Property '_headerV2_subNavManager' does not exist ... Remove this comment to see the full error message
 window._headerV2_subNavManager = subNavManager;
 // @ts-expect-error TS(2339): Property 'unifiedCopyToClipboard' does not exist o... Remove this comment to see the full error message
 window.unifiedCopyToClipboard = unifiedCopy;
 
 // Expose router as the canonical navigation core
 try {
  // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
  if (!window._headerV2_router) window._headerV2_router = router;
  // Also set navigationManager global pointer to router for compatibility
  // @ts-expect-error TS(2339): Property '_headerV2_navigationManager' does not ex... Remove this comment to see the full error message
  window._headerV2_navigationManager = window._headerV2_router;
 } catch (e) {}
 
 // ✅ Ensure DOM elements exist
 function ensureElement(selector: any, tag = 'div', id = '') {
  let el = document.querySelector(selector);
  if (!el) {
   el = document.createElement(tag);
   if (id) el.id = id;
   document.body.appendChild(el);
  }
  return el;
 }
 const header = ensureElement('header', 'header');
 const navList = ensureElement('#nav-list', 'ul', 'nav-list');
 const subButtonsContainer = ensureElement('#sub-buttons-container', 'div', 'sub-buttons-container');
 const contentLoading = ensureElement('#content-loading', 'div', 'content-loading');
 const logo = ensureElement('.logo', 'div', 'logo');
 
 // @ts-expect-error TS(2339): Property '_headerV2_elements' does not exist on ty... Remove this comment to see the full error message
 window._headerV2_elements = { header, navList, subButtonsContainer, contentLoading, logo };
 
 // ✅ Show overlay early via canonical manager
 // @ts-expect-error TS(2339): Property '_headerV2_contentLoadingManager' does no... Remove this comment to see the full error message
 try { window._headerV2_contentLoadingManager && window._headerV2_contentLoadingManager.show(); } catch {}
 
 // ✅ Phase 2: Setup core managers (critical for functionality)
 try {
  // @ts-expect-error TS(2339): Property '_headerV2_performanceOptimizer' does not... Remove this comment to see the full error message
  window._headerV2_performanceOptimizer.setupErrorBoundary();
  // @ts-expect-error TS(2339): Property '_headerV2_scrollManager' does not exist ... Remove this comment to see the full error message
  window._headerV2_scrollManager.init();
  // @ts-expect-error TS(2339): Property '_headerV2_performanceOptimizer' does not... Remove this comment to see the full error message
  window._headerV2_performanceOptimizer.init();
  
  // Network status events
  window.addEventListener('online', () => {
   // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
   window._headerV2_utils.showNotification('การเชื่อมต่อกลับมาแล้ว', 'success');
   // @ts-expect-error TS(2339): Property '_headerV2_buttonManager' does not exist ... Remove this comment to see the full error message
   window._headerV2_buttonManager.loadConfig().catch(() => {});
  }, { passive: true });
  
  window.addEventListener('offline', () => {
   // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
   window._headerV2_utils.showNotification('ขาดการเชื่อมต่ออินเทอร์เน็ต', 'warning');
  }, { passive: true });
  
  // History popstate is handled by router core; keep a fallback listener for legacy consumers
  window.addEventListener('popstate', async () => {
   try {
    const url = window.location.search;
    // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
    const navMgr = window._headerV2_router || window._headerV2_navigationManager;
    if (!navMgr) throw new Error('navigationManager missing');
    if (!url || url === '?') {
     const defaultRoute = await navMgr.getDefaultRoute();
     await navMgr.navigateTo(defaultRoute, { skipUrlUpdate: true, isPopState: true });
    } else {
     await navMgr.navigateTo(url, { skipUrlUpdate: true, isPopState: true });
    }
   } catch (e) {
    // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
    window._headerV2_utils.showNotification('เกิดข้อผิดพลาดในการนำทางย้อนกลับ', 'error');
    console.error('popstate error', e);
   }
  }, { passive: true });
  
  // Language change events
  window.addEventListener('languageChange', (event) => {
   // @ts-expect-error TS(2339): Property 'detail' does not exist on type 'Event'.
   const newLang = event.detail?.language || 'en';
   try {
    // @ts-expect-error TS(2339): Property '_headerV2_buttonManager' does not exist ... Remove this comment to see the full error message
    if (window._headerV2_buttonManager.updateButtonsLanguage)
     // @ts-expect-error TS(2339): Property '_headerV2_buttonManager' does not exist ... Remove this comment to see the full error message
     window._headerV2_buttonManager.updateButtonsLanguage(newLang);
    // @ts-expect-error TS(2339): Property '_headerV2_contentManager' does not exist... Remove this comment to see the full error message
    if (window._headerV2_contentManager.updateCardsLanguage)
     // @ts-expect-error TS(2339): Property '_headerV2_contentManager' does not exist... Remove this comment to see the full error message
     window._headerV2_contentManager.updateCardsLanguage(newLang);
   } catch (e) {
    // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
    window._headerV2_utils.showNotification('เกิดข้อผิดพลาดการเปลี่ยนภาษา', 'error');
   }
  }, { passive: true });
  
  // Resize events with debouncing
  let resizeTimeout: any;
  window.addEventListener('resize', () => {
   clearTimeout(resizeTimeout);
   resizeTimeout = setTimeout(() => {
    try {
     // @ts-expect-error TS(2339): Property '_headerV2_navigationManager' does not ex... Remove this comment to see the full error message
     if (window._headerV2_navigationManager.scrollActiveButtonsIntoView)
      // @ts-expect-error TS(2339): Property '_headerV2_navigationManager' does not ex... Remove this comment to see the full error message
      window._headerV2_navigationManager.scrollActiveButtonsIntoView();
    } catch (e) {
     // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
     window._headerV2_utils.showNotification('เกิดข้อผิดพลาด resize', 'error');
    }
   }, 150);
  }, { passive: true });
  
  // ✅ Load button config
  try {
   // @ts-expect-error TS(2339): Property '_headerV2_buttonManager' does not exist ... Remove this comment to see the full error message
   await window._headerV2_buttonManager.loadConfig();
  } catch (e) {
   // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
   window._headerV2_utils.showNotification('โหลดข้อมูลปุ่มไม่สำเร็จ', 'error');
   console.error('loadConfig error', e);
  }
  
  // Initialize router after button config loaded to ensure validate/getDefaultRoute work
  try {
   // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
   if (window._headerV2_router && typeof window._headerV2_router.init === 'function') {
    // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
    window._headerV2_router.init();
   }
  } catch (e) {}
  
  // Warmup dataManager (prefetch light assets + category indexes)
  try {
   // @ts-expect-error TS(2339): Property '_headerV2_dataManager' does not exist on... Remove this comment to see the full error message
   if (window._headerV2_dataManager && typeof window._headerV2_dataManager._warmup === 'function') {
    // @ts-expect-error TS(2339): Property '_headerV2_dataManager' does not exist on... Remove this comment to see the full error message
    window._headerV2_dataManager._warmup().catch(() => {});
   } else {
    dataManagerDefault._warmup && dataManagerDefault._warmup().catch(() => {});
   }
  } catch (e) {}
  
  // ✅ Initial navigation via router (router will pick default route if needed)
  try {
   // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
   const navMgr = window._headerV2_router || window._headerV2_navigationManager;
   const url = window.location.search;
   
   // At this point we are still bootstrapping; ensure router knows to use replaceState for first canonical navigation
   if (!url || url === '?') {
    const defaultRoute = await navMgr.getDefaultRoute();
    await navMgr.navigateTo(defaultRoute, { skipUrlUpdate: false, replace: false });
   } else {
    await navMgr.navigateTo(url, { skipUrlUpdate: false, replace: false });
   }
   
   // Mark that bootstrapping is done and let router finalize initial navigation behavior
   // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
   window._headerV2_bootstrapping = false;
   // @ts-expect-error TS(2339): Property '_headerV2_router' does not exist on type... Remove this comment to see the full error message
   try { window._headerV2_router && window._headerV2_router.markInitialNavigationHandled && window._headerV2_router.markInitialNavigationHandled(); } catch (e) {}
  } catch (e) {
   // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
   window._headerV2_utils.showNotification('เกิดข้อผิดพลาดในการนำทางเริ่มต้น', 'error');
   console.error('initial navigation error', e);
   // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
   window._headerV2_bootstrapping = false;
  }
 } catch (error) {
  console.error('init error', error);
  try {
   // @ts-expect-error TS(2339): Property '_headerV2_utils' does not exist on type ... Remove this comment to see the full error message
   window._headerV2_utils.showNotification('เกิดข้อผิดพลาดในการโหลดแอพพลิเคชัน กรุณารีเฟรชหน้า', 'error');
  } catch {}
 } finally {
  // ✅ Hide overlay when ready
  try {
   // @ts-expect-error TS(2339): Property '__removeInstantLoadingOverlay' does not ... Remove this comment to see the full error message
   if (typeof window.__removeInstantLoadingOverlay === "function" && window.__instantLoadingOverlayShown) {
    // @ts-expect-error TS(2339): Property '__removeInstantLoadingOverlay' does not ... Remove this comment to see the full error message
    window.__removeInstantLoadingOverlay();
    // @ts-expect-error TS(2339): Property '__instantLoadingOverlayShown' does not e... Remove this comment to see the full error message
    window.__instantLoadingOverlayShown = false;
   }
  } catch {}
  // Ensure bootstrapping flag cleared in any case
  // @ts-expect-error TS(2339): Property '_headerV2_bootstrapping' does not exist ... Remove this comment to see the full error message
  if (typeof window !== 'undefined') window._headerV2_bootstrapping = false;
 }
}

export default { init };