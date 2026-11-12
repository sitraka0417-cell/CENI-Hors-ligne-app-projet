// Pont natif minimal (Android / Capacitor). N'est actif QUE dans l'application Android.
// Raison : la WebView Android ne sait pas « télécharger » un fichier blob (<a download>) ni navigator.share({files}).
// Sans ce pont, le bouton « Exporter TOUT » ne produirait aucun fichier. Aucune autre fonction de l'application n'est modifiée.
(function () {
  var C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;

  function call(plugin, method, opts) {
    if (C.Plugins && C.Plugins[plugin] && typeof C.Plugins[plugin][method] === 'function') return C.Plugins[plugin][method](opts);
    if (typeof C.nativePromise === 'function') return C.nativePromise(plugin, method, opts);
    return Promise.reject(new Error('Pont natif indisponible'));
  }
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result || ''); res(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { rej(r.error || new Error('Lecture impossible')); };
      r.readAsDataURL(blob);
    });
  }
  async function saveAndShare(href, name) {
    try {
      var blob = await (await fetch(href)).blob();
      var data = await toBase64(blob);
      var w = await call('Filesystem', 'writeFile', { path: name, data: data, directory: 'CACHE', recursive: true });
      await call('Share', 'share', { title: name, dialogTitle: 'Enregistrer / envoyer ' + name, url: w.uri });
    } catch (e) {
      var m = String((e && (e.message || e)) || '');
      if (/cancel/i.test(m)) return;
      alert('Export impossible : ' + m);
    }
  }

  // <a download href="blob:..."> .click()  ->  feuille de partage Android (Enregistrer dans Fichiers, Drive, WhatsApp, e-mail...)
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') && /^blob:/.test(this.href)) { saveAndShare(this.href, this.download || 'export.json'); return; }
    return origClick.apply(this, arguments);
  };
  // l'application essaie d'abord navigator.share ; on la renvoie vers le téléchargement ci-dessus (même résultat, fiable)
  try { Object.defineProperty(navigator, 'canShare', { value: function () { return false; }, configurable: true }); } catch (e) { /* ignore */ }
})();
