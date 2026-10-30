# 직접 그린 재료 그림(dev/art_src/ings/*.png, 16×16) → Aseprite 파일 하나 (프레임 하나에 재료 하나, 프레임마다 태그 = 재료 이름)
# 사용법: python3 dev/ase_pack.py  → dev/art_src/ings/ingredients.aseprite (게임은 PNG를 써요 — art_pack.py)
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
        cel = struct.pack('<HhhBHh', 0, 0, 0, 255, 2, 0) + b'\0' * 5 + struct.pack('<HH', im.width, im.height) + px
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

# 재료 파일 이름 → 태그 이름 (새 재료 그림을 넣으면 여기에도 더해요)
NAMES = {'scallion': '파', 'ddeok': '떡', 'fishcake': '오뎅'}

if __name__ == '__main__':
    import os, glob, tempfile
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'art_src', 'ings')
    files = sorted(glob.glob(os.path.join(src, '*.png')), key=lambda f: list(NAMES).index(os.path.splitext(os.path.basename(f))[0]) if os.path.splitext(os.path.basename(f))[0] in NAMES else 99)
    items = [(f, NAMES.get(os.path.splitext(os.path.basename(f))[0], os.path.splitext(os.path.basename(f))[0])) for f in files]
    out = os.path.join(src, 'ingredients.aseprite')
    write(out, items)
    print(out, read_back(out, os.path.join(tempfile.gettempdir(), 'ase_check_')))
