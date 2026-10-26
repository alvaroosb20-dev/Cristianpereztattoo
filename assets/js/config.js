window.CP_CONFIG = { GA_ID: '' }; // Pon aquí tu ID de Google Analytics (G-XXXXXXX). Solo se carga si el visitante lo acepta en el aviso de cookies.
window.CP_loadGA = function () {
  var id = window.CP_CONFIG.GA_ID;
  if (!id || window.__gaLoaded) return;
  window.__gaLoaded = true;
  var s = document.createElement('script'); s.async = 1; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id; document.head.appendChild(s);
  window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date()); gtag('config', id, { anonymize_ip: true });
};
