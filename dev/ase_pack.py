# 게임의 재료 · 음식 그림 전부 → Aseprite 파일 (프레임 하나에 그림 하나, 프레임마다 태그 = 게임 속 이름)
# 사용법: python3 dev/ase_pack.py  → dev/art_src/ings/ingredients.aseprite · dev/art_src/dishes/dishes.aseprite (게임은 PNG를 써요 — 고친 그림은 art_src/ings/<재료>.png로 넣고 art_pack.py)
import struct, zlib, sys
from PIL import Image

def s_str(t):
    b = t.encode('utf-8'); return struct.pack('<H', len(b)) + b
def chunk(typ, data):
    return struct.pack('<IH', len(data) + 6, typ) + data

def write(path, items, layer='재료', dur=200):
    imgs = [Image.open(p).convert('RGBA') for p, _ in items]
    W = max(i.width for i in imgs); H = max(i.height for i in imgs)
    cols = []
    for im in imgs:
        for c in (im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()):
            if c[3] and c not in cols: cols.append(c)
    cols = [(0, 0, 0, 0)] + cols[:255]
    frames = b''
    for fi, im in enumerate(imgs):
        chunks = []
        if fi == 0:
            chunks.append(chunk(0x2007, struct.pack('<HHI', 1, 0, 0) + b'\0' * 8))  # sRGB
            pal = struct.pack('<III', len(cols), 0, len(cols) - 1) + b'\0' * 8 + b''.join(struct.pack('<HBBBB', 0, *c) for c in cols)
            chunks.append(chunk(0x2019, pal))
            chunks.append(chunk(0x2004, struct.pack('<HHHHHHB', 3, 0, 0, 0, 0, 0, 255) + b'\0' * 3 + s_str(layer)))
            tags = struct.pack('<H', len(items)) + b'\0' * 8
            for ti, (_, name) in enumerate(items):
                tags += struct.pack('<HHBH', ti, ti, 0, 0) + b'\0' * 6 + bytes([0, 0, 0]) + b'\0' + s_str(name)
            chunks.append(chunk(0x2018, tags))
        px = zlib.compress(im.tobytes())
        cx, cy = (W - im.width) // 2, (H - im.height) // 2  # 작은 그림은 프레임 가운데에
        cel = struct.pack('<HhhBHh', 0, cx, cy, 255, 2, 0) + b'\0' * 5 + struct.pack('<HH', im.width, im.height) + px
        chunks.append(chunk(0x2005, cel))
        body = b''.join(chunks)
        n = len(chunks)
        frames += struct.pack('<IHHH', len(body) + 16, 0xF1FA, min(n, 0xFFFF), dur) + b'\0\0' + struct.pack('<I', n) + body
    header = struct.pack('<IHHHHHIHIIB', 128 + len(frames), 0xA5E0, len(imgs), W, H, 32, 1, 100, 0, 0, 0) + b'\0' * 3 \
        + struct.pack('<HBBhhHH', 0, 1, 1, 0, 0, 16, 16) + b'\0' * 84
    assert len(header) == 128, len(header)
    open(path, 'wb').write(header + frames)

def read_back(path, out_prefix):
    d = open(path, 'rb').read()
    size, magic, nf, W, H, depth = struct.unpack_from('<IHHHHH', d, 0)
    assert magic == 0xA5E0 and size == len(d) and depth == 32
    off = 128; names = []
    for f in range(nf):
        fsize, fm, _, dur, = struct.unpack_from('<IHHH', d, off); assert fm == 0xF1FA
        n = struct.unpack_from('<I', d, off + 12)[0]; p = off + 16
        for _ in range(n):
            cs, ct = struct.unpack_from('<IH', d, p)
            if ct == 0x2005:
                w, h = struct.unpack_from('<HH', d, p + 6 + 16)
                raw = zlib.decompress(d[p + 6 + 20:p + cs])
                Image.frombytes('RGBA', (w, h), raw).save(f'{out_prefix}{f}.png')
            if ct == 0x2018:
                q = p + 6; nt = struct.unpack_from('<H', d, q)[0]; q += 10
                for _ in range(nt):
                    q += 2 + 2 + 1 + 2 + 6 + 3 + 1
                    L = struct.unpack_from('<H', d, q)[0]; names.append(d[q + 2:q + 2 + L].decode()); q += 2 + L
            p += cs
        assert p == off + fsize, (p, off, fsize)
        off += fsize
    return nf, (W, H), names

# 게임의 재료 그림 전부(아틀라스의 ing_…) → 프레임 하나에 재료 하나 · 태그 = 게임 속 재료 이름 (data/menu.js INGREDIENTS 순서)
#  직접 그린 그림(art_src/ings/*.png)은 art_pack.py가 아틀라스에 이미 넣어 둬요 — art_pack.py 다음에 돌려요
def atlas_ings(root):
    import re, json, base64, io, tempfile, os
    a = open(os.path.join(root, 'src', 'js', 'art', 'atlas.js'), encoding='utf-8').read()
    spr = json.loads(re.search(r'export const SPR = (\{.*?\});', a, re.S).group(1))
    atlas = Image.open(io.BytesIO(base64.b64decode(re.search(r"ATLAS_URL = ['\"]data:image/png;base64,([^'\"]+)", a).group(1)))).convert('RGBA')
    m = open(os.path.join(root, 'src', 'js', 'data', 'menu.js'), encoding='utf-8').read()
    block = m[m.index('export const INGREDIENTS = {'):]
    block = block[:block.index('\n};')]
    order = re.findall(r"^\s+(\w+): \{ name: '([^']+)'", block, re.M)
    tmp = tempfile.mkdtemp()
    items = []
    for k, name in order:
        r = spr.get('ing_' + k)
        if not r: continue
        f = os.path.join(tmp, k + '.png')
        atlas.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])).save(f)
        items.append((f, name))
    return items

# 음식(메뉴) 그림 전부 → 기본 메뉴 3 + 메뉴 변형 15 (data/menu.js MENUS · VARIANTS 순서, 태그 = 메뉴 이름)
def atlas_dishes(root, small=False):  # small: 작은 그림(_s — 손에 든 그릇 · 막대 아이콘)
    import re, json, base64, io, tempfile, os
    a = open(os.path.join(root, 'src', 'js', 'art', 'atlas.js'), encoding='utf-8').read()
    spr = json.loads(re.search(r'export const SPR = (\{.*?\});', a, re.S).group(1))
    atlas = Image.open(io.BytesIO(base64.b64decode(re.search(r"ATLAS_URL = ['\"]data:image/png;base64,([^'\"]+)", a).group(1)))).convert('RGBA')
    m = open(os.path.join(root, 'src', 'js', 'data', 'menu.js'), encoding='utf-8').read()
    order = re.findall(r"^\s+(tteok|kimbap|twigim): \{ name: '([^']+)'", m, re.M)
    var = re.findall(r"^\s+\['(\w+)', '([^']+)', \d+", m, re.M)
    tmp = tempfile.mkdtemp()
    items = []
    for b, bname in order:
        for k, name in [(b, bname)] + [v for v in var if v[0].startswith(b + '_')]:
            r = spr.get(k + ('_s' if small else ''))
            if not r: continue
            f = os.path.join(tmp, k + '.png')
            atlas.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])).save(f)
            items.append((f, name))
    return items

if __name__ == '__main__':
    import os, tempfile
    root = os.path.dirname(os.path.abspath(__file__))
    for name, items, layer in (('ingredients', atlas_ings(root), '재료'), ('dishes', atlas_dishes(root), '음식'), ('dishes_small', atlas_dishes(root, True), '작은 음식')):
        out = os.path.join(root, 'art_src', 'ings' if name == 'ingredients' else 'dishes', name + '.aseprite')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        write(out, items, layer)
        print(out, read_back(out, os.path.join(tempfile.gettempdir(), f'ase_{name}_')))
