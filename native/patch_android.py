#!/usr/bin/env python3
"""Réglages Android après « cap add android » : plugin dossier, icônes, barre d'état, version."""
import glob, os, re, shutil, sys
res = 'android/app/src/main/res'
# 0) plugin natif « dossier des carnets » + MainActivity qui l'enregistre
jd = 'android/app/src/main/java/mg/ceni/horsligne'
if not os.path.isdir(jd): sys.exit('ERREUR : dossier Java introuvable : ' + jd)
for f in ('CeniFolderPlugin.java', 'MainActivity.java'): shutil.copyfile('native/android-java/' + f, jd + '/' + f)
# 1) icônes (celles de l'application web)
for d in glob.glob(res + '/mipmap-*'):
    for f in glob.glob(d + '/ic_launcher*'): os.remove(f)
shutil.rmtree(res + '/mipmap-anydpi-v26', ignore_errors=True)
for d in sorted(os.listdir('native/android-icons')):
    os.makedirs(res + '/' + d, exist_ok=True)
    for f in os.listdir('native/android-icons/' + d): shutil.copyfile('native/android-icons/%s/%s' % (d, f), '%s/%s/%s' % (res, d, f))
# 2) thème : pas de « bord à bord » (le contenu ne passe pas sous la barre d'état), barres sombres comme l'application
p = res + '/values/styles.xml'
s = open(p, encoding='utf-8').read()
extra = ('<item name="android:statusBarColor">#10141a</item>\n        <item name="android:navigationBarColor">#10141a</item>\n'
         '        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\n        ')
k = '<item name="android:background">@null</item>'
if s.count(k) != 1: sys.exit('ERREUR : styles.xml inattendu')
open(p, 'w', encoding='utf-8').write(s.replace(k, extra + k))
# 3) numéro de version
p = 'android/app/build.gradle'
g = open(p, encoding='utf-8').read()
g2 = re.sub(r'versionName\s+"[^"]*"', 'versionName "%s"' % os.environ.get('APP_VERSION', '2.6'), g)
g2 = re.sub(r'versionCode\s+\d+', 'versionCode %s' % os.environ.get('APP_CODE', '1'), g2)
if g2 == g: sys.exit('ERREUR : build.gradle inattendu')
open(p, 'w', encoding='utf-8').write(g2)
print('android patché')
