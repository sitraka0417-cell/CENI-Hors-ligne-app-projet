#!/usr/bin/env python3
"""Construit www/ : copie OCTET POUR OCTET les fichiers de web/ ; la SEULE modification est l'ajout d'une ligne
<script src="native-shim.js"></script> dans index.html (juste avant jszip.min.js). LISEZ-MOI.txt n'est pas copié."""
import os, shutil, sys
SHIM = '<script src="native-shim.js"></script>\n'
ANCHOR = '<script src="jszip.min.js"></script>\n'
if os.path.isdir('www'): shutil.rmtree('www')
os.makedirs('www')
for n in sorted(os.listdir('web')):
    if n == 'LISEZ-MOI.txt': continue
    shutil.copyfile(os.path.join('web', n), os.path.join('www', n))
shutil.copyfile('native/native-shim.js', 'www/native-shim.js')
p = 'www/index.html'
b = open(p, 'rb').read().decode('utf-8')
if b.count(ANCHOR) != 1: sys.exit('ERREUR : ligne jszip introuvable dans index.html')
open(p, 'wb').write(b.replace(ANCHOR, SHIM + ANCHOR).encode('utf-8'))
print('www/ prêt')
