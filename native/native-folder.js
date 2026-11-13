// Dossier des carnets (Android) : choisir un dossier UNE fois ; à chaque ouverture, les carnets nouveaux sont proposés à l'import.
// Les images passent par l'import EXISTANT de l'application (même rotation, même contrôle d'images noires, mêmes doublons, mêmes feuilles sautées) :
// ce fichier ne fait que lui fournir les images, une par une (pas de ZIP, pas de limite de mémoire).
(function () {
  var C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform() || !window.KV) return;
  var ST = window.KV;
  var $ = function (id) { return document.getElementById(id); };
  var IMG_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

  function call(m, o) {
    var P = C.Plugins && C.Plugins.CeniFolder;
    if (P && typeof P[m] === 'function') return P[m](o || {});
    if (typeof C.nativePromise === 'function') return C.nativePromise('CeniFolder', m, o || {});
    return Promise.reject(new Error('Pont natif indisponible'));
  }
  // même règle que l'application (carnetGuess) : le plus long groupe de 4 chiffres ou plus, en remontant les dossiers
  function guess(dir) {
    var ds = String(dir).split('/').reverse();
    for (var i = 0; i < ds.length; i++) {
      var m = ds[i].match(/\d{4,}/g);
      if (m) return m.sort(function (a, b) { return b.length - a.length; })[0];
    }
    return '';
  }
  function natCmp(a, b) { return a.n.localeCompare(b.n, undefined, { numeric: true, sensitivity: 'base' }); }

  async function readBlob(f) {
    var r = await call('read', { id: f.id });
    var type = /\.png$/i.test(f.n) ? 'image/png' : /\.webp$/i.test(f.n) ? 'image/webp' : 'image/jpeg';
    try { var resp = await fetch('data:' + type + ';base64,' + r.data); return await resp.blob(); }
    catch (e) {
      var bin = atob(r.data), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Blob([u], { type: type });
    }
  }
  // objet « fichier » comme ceux d'un ZIP : le contenu n'est lu qu'au moment où l'application traite l'image
  function mk(f) {
    return { name: f.n, type: 'image/jpeg', size: f.s, webkitRelativePath: f.p + '/' + f.n, _entry: { async: function () { return readBlob(f); } } };
  }
  function startImport(files, auto) {
    var list = files.slice().sort(function (a, b) { return a.p === b.p ? natCmp(a, b) : a.p.localeCompare(b.p, undefined, { numeric: true }); }).map(mk);
    var inp = $('imgPick');
    Object.defineProperty(inp, 'files', { configurable: true, get: function () { return list; } });
    try { inp.onchange(); } finally { delete inp.files; }
    if (auto) setTimeout(function () { var b = $('impGo'); if (b && !b.disabled && $('impOv').classList.contains('open')) b.click(); }, 300);
  }

  async function getImages() {
    var r = await call('scan');
    return { name: r.name || '', files: (r.files || []).filter(function (f) { return IMG_RE.test(f.n); }) };
  }
  function byNumber(files) {
    var nums = {};
    files.forEach(function (f) { var n = guess(f.p); if (n) (nums[n] = nums[n] || []).push(f); });
    return nums;
  }
  // « nouveau » = carnet du dossier qui n'a AUCUNE image dans l'application et qui n'a jamais été vu (un carnet supprimé exprès ne revient pas)
  async function findNew(files) {
    var nums = byNumber(files), done = new Set(((await ST.get('hoFolderDone')).hoFolderDone) || []), fresh = {}, changed = false;
    var keys = Object.keys(nums);
    for (var i = 0; i < keys.length; i++) {
      var n = keys[i], has = (await ST.imgKeys(n + '|')).length > 0;
      if (has) { if (!done.has(n)) { done.add(n); changed = true; } }
      else if (!done.has(n)) fresh[n] = nums[n];
    }
    if (changed) await ST.set({ hoFolderDone: Array.from(done) });
    return fresh;
  }
  async function markDone(nums) {
    var done = new Set(((await ST.get('hoFolderDone')).hoFolderDone) || []);
    nums.forEach(function (n) { done.add(n); });
    await ST.set({ hoFolderDone: Array.from(done) });
  }
  function flat(fresh) { var a = []; Object.keys(fresh).forEach(function (n) { a = a.concat(fresh[n]); }); return a; }

  // ---------- vérification à l'ouverture ----------
  var busy = false, lastCheck = 0;
  async function check() {
    if (busy) return; busy = true;
    try {
      var fo = await call('getFolder'); if (!fo.uri) return;
      if (document.querySelector('.ov.open')) return;
      var im = await getImages();
      var fresh = await findNew(im.files);
      lastCheck = Date.now();
      var nums = Object.keys(fresh).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
      if (!nums.length || document.querySelector('.ov.open')) return;
      var lines = nums.slice(0, 15).map(function (n) { return '• carnet ' + n + ' : ' + fresh[n].length + ' image(s)'; });
      if (nums.length > 15) lines.push('• … et ' + (nums.length - 15) + ' autre(s)');
      if (!confirm(nums.length + ' carnet(s) vaovao ao amin\'ny dossier « ' + im.name + ' » :\n' + lines.join('\n') + '\n\nImporter maintenant ?')) return;
      await markDone(nums);
      startImport(flat(fresh), true);
    } catch (e) { /* silencieux au démarrage */ }
    finally { busy = false; }
  }
  setTimeout(check, 3500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - lastCheck > 30000) setTimeout(check, 800); });

  // ---------- panneau « Dossier des carnets » (remplace l'ancien bouton « Importer un dossier ») ----------
  var ov = null, info, bNew, bAll;
  function build() {
    ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'folderOv';
    ov.innerHTML = '<div class="pnl"><div class="hd"><b>📂 Dossier des carnets</b><button id="fdX">✕</button></div>' +
      '<div class="bd menu"><div class="help" id="fdInfo" style="white-space:pre-line;margin-bottom:8px"></div>' +
      '<button id="fdPick" class="pri">📂 Choisir / changer le dossier</button>' +
      '<button id="fdNew">⬇ Importer les carnets vaovao</button>' +
      '<button id="fdAll">🔄 Tout vérifier (importer les images manquantes de TOUS les carnets)</button>' +
      '<div class="help">Les feuilles déjà présentes sont sautées. Les noms de dossiers donnent les n° de carnet (4 chiffres ou plus).</div></div></div>';
    document.body.appendChild(ov);
    info = $('fdInfo'); bNew = $('fdNew'); bAll = $('fdAll');
    $('fdX').onclick = function () { ov.classList.remove('open'); };
    $('fdPick').onclick = async function () {
      try { var r = await call('pick'); if (!r.cancelled) refresh(); } catch (e) { alert('Dossier : ' + (e && e.message || e)); }
    };
    bNew.onclick = async function () {
      try {
        var im = await getImages(), fresh = await findNew(im.files), nums = Object.keys(fresh);
        if (!nums.length) return alert('Aucun carnet vaovao.');
        await markDone(nums); ov.classList.remove('open'); startImport(flat(fresh), false);
      } catch (e) { alert('Dossier : ' + (e && e.message || e)); }
    };
    bAll.onclick = async function () {
      try {
        var im = await getImages(); if (!im.files.length) return alert('Aucune image dans le dossier.');
        await markDone(Object.keys(byNumber(im.files))); ov.classList.remove('open'); startImport(im.files, false);
      } catch (e) { alert('Dossier : ' + (e && e.message || e)); }
    };
  }
  async function refresh() {
    bNew.disabled = bAll.disabled = true;
    try {
      var fo = await call('getFolder');
      if (!fo.uri) { info.textContent = 'Aucun dossier choisi.\nChoisissez le dossier qui contient les dossiers de carnets, puis « Utiliser ce dossier ».'; return; }
      info.textContent = 'Dossier : ' + fo.name + '\nAnalyse…';
      var im = await getImages(), nums = byNumber(im.files), fresh = await findNew(im.files);
      var nn = Object.keys(fresh).length;
      info.textContent = 'Dossier : ' + im.name + '\n' + Object.keys(nums).length + ' carnet(s) · ' + im.files.length + ' image(s)\n' + (nn ? '➜ ' + nn + ' carnet(s) vaovao (pas encore dans l\'application)' : 'Aucun carnet vaovao.');
      bNew.disabled = !nn; bAll.disabled = !im.files.length;
    } catch (e) { info.textContent = 'Erreur : ' + (e && e.message || e); }
  }
  function open() { if (!ov) build(); $('menuOv').classList.remove('open'); ov.classList.add('open'); refresh(); }
  var mf = $('miFolder');
  if (mf) {
    mf.textContent = '📂 Dossier des carnets (choisir un dossier, importer les carnets vaovao)'; mf.classList.add('pri');
    mf.addEventListener('click', function (e) { e.stopImmediatePropagation(); e.preventDefault(); open(); }, true);   // passe avant l'ancien gestionnaire
  }
})();
