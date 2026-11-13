#!/usr/bin/env python3
"""Construit www/ : copie OCTET POUR OCTET les fichiers de web/ ; les SEULES modifications sont deux lignes <script> ajoutées dans index.html :
  - native-shim.js   (avant jszip.min.js) : export de fichiers sous Android
  - native-folder.js (après app.js)       : choix d'un dossier de carnets + import automatique des carnets nouveaux
LISEZ-MOI.txt n'est pas copié."""
import os, shutil, sys
INSERTS = [  # (ligne d'ancrage, ligne ajoutée, 'before'|'after')
    ('<script src="jszip.min.js"></script>\n', '<script src="native-shim.js"></script>\n', 'before'),
    ('<script src="app.js"></script>\n', '<script src="native-folder.js"></script>\n', 'after'),
]
if os.path.isdir('www'): shutil.rmtree('www')
os.makedirs('www')
for n in sorted(os.listdir('web')):
    if n == 'LISEZ-MOI.txt': continue
    shutil.copyfile(os.path.join('web', n), os.path.join('www', n))
for n in ('native-shim.js', 'native-folder.js'):
    shutil.copyfile('native/' + n, 'www/' + n)
p = 'www/index.html'
b = open(p, 'rb').read().decode('utf-8')
for anchor, add, where in INSERTS:
    if b.count(anchor) != 1: sys.exit('ERREUR : ligne introuvable dans index.html : ' + anchor)
    b = b.replace(anchor, add + anchor if where == 'before' else anchor + add)
open(p, 'wb').write(b.encode('utf-8'))
print('www/ prêt')
