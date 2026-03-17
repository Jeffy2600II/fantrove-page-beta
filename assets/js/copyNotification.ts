(function(global) {
  const notificationTypeMessages = {
    emoji: { th: 'คัดลอกอีโมจิแล้ว', en: 'Emoji copied' },
    "special-characters": { th: 'คัดลอกอักษรพิเศษแล้ว', en: 'Character copied' }
  };

  function getCopyNotificationMessage({ typeId = 'emoji', lang = 'en' }) {
    return notificationTypeMessages[typeId]?.[lang] || notificationTypeMessages[typeId]?.en || notificationTypeMessages.emoji[lang] || notificationTypeMessages.emoji.en;
  }

  function dismissNotification(el, opts = {}) {
    if (!el || el._cnp_dismissing) return;
    el._cnp_dismissing = true;
    if (el._cn_hideTimeout) clearTimeout(el._cn_hideTimeout);
    el.style.pointerEvents = 'none';
    el.style.animation = 'cnp-fadeOut 0.36s cubic-bezier(.25,.8,.25,1) forwards';
    const removeAfter = opts.duration ?? 360;
    setTimeout(() => el.parentNode?.removeChild(el), removeAfter);
  }

  function tickSVG() {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="cnpTickGrad" x1="0" x2="1">
            <stop offset="0" stop-color="#A8F0DF"/>
            <stop offset="1" stop-color="#3FC07A"/>
          </linearGradient>
        </defs>
        <circle cx="18" cy="18" r="15.2" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>
        <path class="cnp-tick-path" d="M11.8 19.6l4.6 4.5L24.3 13.2" fill="none" stroke="url(#cnpTickGrad)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function showCopyNotification({ text, name, typeId = 'emoji', lang } = {}) {
    lang = lang || localStorage.getItem('selectedLang') || 'en';
    const mainMsg = getCopyNotificationMessage({ typeId, lang });

    Array.from(document.querySelectorAll('.copy-notification-topcenter')).forEach(el => dismissNotification(el));

    const n = document.createElement('div');
    n.className = 'copy-notification-topcenter';
    n.setAttribute('role', 'status');
    n.setAttribute('aria-live', 'polite');
    n.setAttribute('data-timestamp', Date.now());

    const container = document.createElement('div');
    container.className = 'copy-anim-container';

    const icon = document.createElement('div');
    icon.className = 'copy-icon';
    icon.innerHTML = tickSVG();

    const msg = document.createElement('div');
    msg.className = 'copy-message';
    msg.innerHTML = `
      <span class="copy-mainmsg">${mainMsg}</span>
      <span class="copy-emoji">${text || ''}</span>
      <span class="copy-name">${name ? '(' + name + ')' : ''}</span>
    `;

    container.appendChild(icon);
    container.appendChild(msg);
    n.appendChild(container);
    document.body.appendChild(n);

    if (!document.querySelector('#copy-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'copy-notification-styles';
      style.textContent = `
        :root{
          --cnp-bg: rgba(0,0,0,0.95);
          --cnp-border: rgba(255,255,255,0.05);
          --cnp-text: #FFFFFF;
          --cnp-muted: rgba(255,255,255,0.6);
          --cnp-radius: 12px;
        }

        .copy-notification-topcenter{
          position: fixed;
          bottom: calc(90px + env(safe-area-inset-bottom,0));
          left: 50%;
          transform: translateX(-50%) translateZ(0);
          background: var(--cnp-bg);
          color: var(--cnp-text);
          padding: 12px 16px;
          border-radius: var(--cnp-radius);
          z-index: 15000;
          opacity: 0;
          animation: cnp-slideIn 0.36s cubic-bezier(.25,.8,.25,1) forwards;
          max-width: 360px;
          min-width: 140px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          pointer-events: auto;
          user-select: none;
          font-family: inherit;
          border: 1px solid var(--cnp-border);
          backdrop-filter: blur(1px);
          -webkit-backdrop-filter: blur(1px);
          will-change: transform, opacity;
          box-shadow: 0 6px 18px rgba(0,0,0,0.3);
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
          backface-visibility: hidden;
        }

        .copy-anim-container{ display:flex; align-items:center; gap:12px; width:100%; min-width:0; }

        .copy-icon{
          width: 38px;
          height: 38px;
          min-width: 38px;
          min-height: 38px;
          border-radius: 9px;
          display:flex;
          align-items:center;
          justify-content:center;
          flex-shrink:0;
          background: rgba(255,255,255,0.02);
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          animation: cnp-iconPop 0.32s cubic-bezier(.25,.8,.25,1) forwards;
        }

        .copy-icon svg{ width:28px; height:28px; display:block; }

        .cnp-tick-path{
          stroke-dasharray: 34;
          stroke-dashoffset: 34;
        }

        .cnp-tick-animating{
          animation: cnp-tickDraw 0.8s cubic-bezier(.4,.0,.2,1) 0.1s forwards; /* ช้าลง & smooth */
        }

        .copy-message{ flex:1; display:flex; align-items:center; gap:10px; min-width:0; overflow:hidden; }

        .copy-mainmsg{
          font-weight:600;
          font-size:0.95em;
          white-space:nowrap;
          color:var(--cnp-text);
        }

        .copy-emoji{ font-size:1.02em; white-space:pre; }

        .copy-name{
          color:var(--cnp-muted);
          font-size:0.86em;
          margin-left:6px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          max-width:140px;
        }

        @keyframes cnp-slideIn{
          from{ opacity:0; transform: translateX(-50%) translateY(12px) scale(1); }
          to{ opacity:1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @keyframes cnp-fadeOut{
          from{ opacity:1; }
          to{ opacity:0; transform: translateX(-50%) translateY(10px) scale(1); }
        }

        @keyframes cnp-iconPop{
          from{ transform: scale(0.95); }
          70%{ transform: scale(1.05); }
          to{ transform: scale(1); }
        }

        @keyframes cnp-tickDraw{
          from { stroke-dashoffset: 34; }
          to { stroke-dashoffset: 0; }
        }

        @media (max-width:600px){
          .copy-notification-topcenter{ max-width:94vw; padding:10px 12px; font-size:13px; bottom: calc(90px + env(safe-area-inset-bottom,0)); }
          .copy-name{ max-width:88px; }
        }

        @media (prefers-reduced-motion: reduce){
          .copy-notification-topcenter, .copy-icon, .cnp-tick-path, .cnp-tick-animating { animation:none !important; transition:none !important; }
        }
      `;
      document.head.appendChild(style);
    }

    const tick = n.querySelector('.cnp-tick-path');
    if(tick){ void tick.offsetWidth; tick.classList.add('cnp-tick-animating'); }

    n.tabIndex = 0;
    n.onclick = n.onkeydown = (e) => {
      if(e.type==='click'||e.key==='Enter'||e.key==='Escape') dismissNotification(n);
    };

    n._cn_hideTimeout = setTimeout(()=> dismissNotification(n), 2400);
  }

  if(typeof module !== 'undefined' && typeof module.exports !== 'undefined'){
    module.exports = showCopyNotification;
  } else {
    global.showCopyNotification = showCopyNotification;
  }
})(typeof window !== "undefined"? window : this);