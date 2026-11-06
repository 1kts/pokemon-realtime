#!/usr/bin/env python3
# Pasa las hojas de sprites de public/sprites (PNG de SpriteCollab, tools/import-sprites.js) a WebP sin pérdida: los mismos
# píxeles en un 37 % del peso (Charizard: 197 KB -> 73 KB). Cada animación sigue en su archivo, para que el menú solo baje
# la que enseña (Idle) y el combate las suyas. Borra el PNG de cada una que convierte; las que ya son WebP las deja.
#   python3 tools/sprites-webp.py                        todas las hojas de sprites
#   python3 tools/sprites-webp.py 6 25                   solo esas especies
#   python3 tools/sprites-webp.py --carpeta portraits    otra carpeta de public/ entera (retratos, iconos…)
import os, sys, glob
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites')

def one(png):
    webp = png[:-4] + '.webp'
    with Image.open(png) as im:
        im = im.convert('RGBA')
        im.save(webp, 'WEBP', lossless=True, method=4, quality=100, exact=True)
    # (comprobación: los mismos píxeles, también los transparentes)
    with Image.open(png) as a, Image.open(webp) as b:
        if a.convert('RGBA').tobytes() != b.convert('RGBA').tobytes():
            os.remove(webp)
            return (png, 0, 0, 'distinto')
    before, after = os.path.getsize(png), os.path.getsize(webp)
    os.remove(png)
    return (png, before, after, None)

def main():
    args = sys.argv[1:]
    if args[:1] == ['--carpeta']:
        base = os.path.join(os.path.dirname(__file__), '..', 'public', args[1])
        pngs, dexes = sorted(glob.glob(os.path.join(base, '**', '*.png'), recursive=True)), []
    else:
        dexes = args
        pngs = sorted(glob.glob(os.path.join(ROOT, '*', '*.png')) + glob.glob(os.path.join(ROOT, '*', 's', '*.png')))
    if dexes:
        pngs = [p for p in pngs if p.split(os.sep)[-2] in dexes or (p.split(os.sep)[-2] == 's' and p.split(os.sep)[-3] in dexes)]
    total_b = total_a = 0
    bad = []
    with ProcessPoolExecutor() as ex:
        for png, b, a, err in ex.map(one, pngs, chunksize=32):
            if err: bad.append(png)
            total_b += b; total_a += a
    print(f'{len(pngs) - len(bad)} hojas a WebP: {total_b / 1e6:.1f} MB -> {total_a / 1e6:.1f} MB ({round(100 * total_a / max(1, total_b))} %)')
    if bad:
        print('No se han podido pasar sin cambiar píxeles (se quedan en PNG):', *bad, sep='\n  ')
        sys.exit(1)

if __name__ == '__main__':
    main()
