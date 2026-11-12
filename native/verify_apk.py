#!/usr/bin/env python3
"""Contrôle final : chaque fichier de l'APK (assets/public) est IDENTIQUE à web/ (index.html = original + 1 ligne)."""
import hashlib, sys, zipfile
apk = sys.argv[1]
z = zipfile.ZipFile(apk)
SHIM = b'<script src="native-shim.js"></script>\n'
bad = 0
for line in open('SHA256SUMS.txt'):
    h, n = line.split()
    if n == 'LISEZ-MOI.txt': continue
    d = z.read('assets/public/' + n)
    if n == 'index.html':
        if d.count(SHIM) != 1: print('KO index.html (shim)'); bad += 1; continue
        d = d.replace(SHIM, b'')
    ok = hashlib.sha256(d).hexdigest() == h
    print('OK ' if ok else 'KO ', n); bad += (not ok)
if bad: sys.exit('DIFFÉRENCES DÉTECTÉES')
print('Tous les fichiers de l\'application sont identiques à l\'original.')
