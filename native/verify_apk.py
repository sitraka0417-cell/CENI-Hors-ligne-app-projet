#!/usr/bin/env python3
"""Contrôle final : chaque fichier de l'APK (assets/public) est IDENTIQUE à web/ (index.html = original + 2 lignes <script>)."""
import hashlib, sys, zipfile
apk = sys.argv[1]
z = zipfile.ZipFile(apk)
ADDED = [b'<script src="native-shim.js"></script>\n', b'<script src="native-folder.js"></script>\n']
bad = 0
for line in open('SHA256SUMS.txt'):
    h, n = line.split()
    if n == 'LISEZ-MOI.txt': continue
    d = z.read('assets/public/' + n)
    if n == 'index.html':
        if any(d.count(a) != 1 for a in ADDED): print('KO index.html (lignes ajoutées)'); bad += 1; continue
        for a in ADDED: d = d.replace(a, b'')
    ok = hashlib.sha256(d).hexdigest() == h
    print('OK ' if ok else 'KO ', n); bad += (not ok)
if bad: sys.exit('DIFFÉRENCES DÉTECTÉES')
print('Tous les fichiers de l\'application sont identiques à l\'original.')
