# 게임에 쓰는 그림을 한 장(아틀라스)으로 묶어 dev/src/js/art/atlas.js에 넣어요.
# 사용법: python3 dev/art_pack.py [Modern Interiors zip] [Modern Exteriors zip]
#   zip 경로를 안 주면 환경 변수 LIMEZU_INTERIORS·LIMEZU_EXTERIORS, 그것도 없으면 /mnt/user-data/uploads/에서 찾아요.
#
# LimeZu 원본 팩(zip)은 저장소에 올리지 않아요 (라이선스: 재배포 금지, 크레딧 필수 — limezu.itch.io).
# 이 스크립트가 게임에 실제로 쓰는 조각만 골라 묶고, 그 결과(atlas.js)만 저장소에 올려요.
# 우리가 직접 그리는 그림(분식 음식·계산대·표정 등)은 아래 OWN_* 함수에서 픽셀로 그려요.
import base64, colorsys, glob, io, json, os, sys, zipfile
from PIL import Image, ImageDraw

DEV = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DEV, 'src', 'js', 'art', 'atlas.js')


def find_zip(arg_i, env, pattern):
    if len(sys.argv) > arg_i:
        return sys.argv[arg_i]
    if os.environ.get(env):
        return os.environ[env]
    hits = sorted(glob.glob(pattern))
    if not hits:
        sys.exit(f'{env} zip을 찾지 못했어요 ({pattern}). 경로를 인자로 주세요.')
    return hits[-1]


INT = zipfile.ZipFile(find_zip(1, 'LIMEZU_INTERIORS', '/mnt/user-data/uploads/moderninteriors*.zip'))
INT_NAMES = set(INT.namelist())
EXT = zipfile.ZipFile(find_zip(2, 'LIMEZU_EXTERIORS', '/mnt/user-data/uploads/modernexteriors*.zip'))
_cache = {}


SHADOW = (0, 0, 0, 31)  # 그림자는 모두 검정 12% (v0.71 사용자 요청 — LimeZu 원래 그림자는 불투명 붉은 회색)


def shadowless_of(member):  # 같은 그림의 「그림자 없는」 판 경로 (LimeZu Interiors Theme_Sorter만 있어요)
    if '/Theme_Sorter_Singles/' in member:
        d, f = member.rsplit('/', 1)
        d = d.replace('/Theme_Sorter_Singles/', '/Theme_Sorter_Shadowless_Singles/') + '_Shadowless'
        return d + '/' + f.replace('_Singles_', '_Singles_Shadowless_')
    if '/Theme_Sorter/' in member:
        return member.replace('/Theme_Sorter/', '/Theme_Sorter_Shadowless/').replace('_16x16.png', '.png').replace('.png', '_Shadowless.png')
    return None


def img(z, member):
    key = (id(z), member)
    if key not in _cache:
        im = Image.open(io.BytesIO(z.read(member))).convert('RGBA')
        sm = shadowless_of(member) if z is INT else None
        if sm and sm in INT_NAMES:  # 그림자 없는 판에서 빠진 픽셀 = 그림자 → 검정 8%
            sl = Image.open(io.BytesIO(z.read(sm))).convert('RGBA')
            if sl.size == im.size:
                a, b = im.load(), sl.load()
                for y in range(im.height):
                    for x in range(im.width):
                        if a[x, y][3] and not b[x, y][3]:
                            a[x, y] = SHADOW
        _cache[key] = im
    return _cache[key]


def crop(z, member, x=0, y=0, w=None, h=None):
    im = img(z, member)
    return im.crop((x, y, x + (w or im.width), y + (h or im.height)))


def floor48(x, y):  # 바닥 48x32: 블록의 아래 가운데 한 칸만 이어 붙여요 (v0.71 — 블록 윗줄의 벽 그림자 때문에 줄무늬가 생겼어요)
    t = crop(INT, RB + 'Room_Builder_Floors_16x16.png', x + 16, y + 16, 16, 16)
    o = Image.new('RGBA', (48, 32), (0, 0, 0, 0))
    for tx in (0, 16, 32):
        for ty in (0, 16):
            o.alpha_composite(t, (tx, ty))
    return o


RB = '1_Interiors/16x16/Room_Builder_subfiles/'
KIT = '1_Interiors/16x16/Theme_Sorter_Singles/12_Kitchen_Singles/Kitchen_Singles_%d.png'
ICE = '1_Interiors/16x16/Theme_Sorter_Singles/24_Ice_Cream_Shop_Singles/Ice_Cream_Shop_Singles_%d.png'
CHAR = '2_Characters/Character_Generator/0_Premade_Characters/16x16/Premade_Character_%02d.png'
CITY = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/2_City_Terrains_16x16.png'

# ── 우리가 직접 그리는 그림 ──────────────────────────────────────────
INK = (58, 40, 44, 255)


def grid(rows, pal):
    h = len(rows); w = max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                im.putpixel((x, y), pal[ch])
    return im


def own_tteok(over=None):
    pal = {'k': INK, 'r': (216, 69, 47, 255), 'R': (165, 42, 31, 255), 't': (255, 241, 220, 255),
           'n': (95, 174, 74, 255), 'w': (244, 241, 236, 255), 'g': (207, 199, 189, 255)}
    pal.update(over or {})
    return grid([
        '................',
        '................',
        '................',
        '....kkkkkkkk....',
        '..kkrrrrrrrrkk..',
        '.krrtttrrnrrrrk.',
        '.krtttrrtttrrrk.',
        '.krrrrtttrrtnrk.',
        '.kRrtttrrrtttrk.',
        '.kRRrrrrrrrrRRk.',
        '.kwwRRRRRRRRwwk.',
        '..kwwwwwwwwwwk..',
        '..kgwwwwwwwwgk..',
        '...kggggggggk...',
        '....kkkkkkkk....',
        '................',
    ], pal)


def own_kimbap(cols=None, small=False):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((0, 7, 15, 15), fill=(230, 226, 222, 255), outline=INK)
    cols = cols or [(240, 200, 60, 255), (235, 120, 60, 255), (110, 170, 80, 255)]
    if small:  # 꼬마김밥: 작은 김밥 다섯 개
        for x, y in [(1, 7), (5, 5), (9, 7), (3, 2), (8, 1)]:
            d.ellipse((x, y, x + 5, y + 5), fill=(30, 36, 34, 255)); d.ellipse((x + 1, y + 1, x + 4, y + 4), fill=(250, 248, 240, 255))
            d.point((x + 2, y + 2), fill=cols[(x + y) % len(cols)]); d.point((x + 3, y + 3), fill=cols[(x + y + 1) % len(cols)])
        return im
    centers = [((2, 5), cols[0]), ((8, 3), cols[1]), ((7, 8), cols[2])]
    for (x, y), c in centers:
        d.ellipse((x, y, x + 6, y + 6), fill=(30, 36, 34, 255))
        d.ellipse((x + 1, y + 1, x + 5, y + 5), fill=(250, 248, 240, 255))
        d.rectangle((x + 3, y + 2, x + 3, y + 4), fill=c)
        d.point((x + 2, y + 3), fill=c); d.point((x + 4, y + 3), fill=cols[(cols.index(c) + 1) % 3])
    return im


def own_twigim(kind='veg'):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(1, 9), (14, 9), (12, 15), (3, 15)], fill=(236, 226, 200, 255), outline=INK)
    GOLD, EDGE, HI = (226, 160, 64, 255), (150, 90, 30, 255), (250, 210, 120, 255)
    if kind == 'squid':  # 오징어튀김: 고리 세 개
        for x0, y0 in [(1, 4), (6, 2), (9, 5)]:
            d.ellipse((x0, y0, x0 + 6, y0 + 6), fill=GOLD, outline=EDGE); d.ellipse((x0 + 2, y0 + 2, x0 + 4, y0 + 4), fill=(236, 226, 200, 255))
        return im
    if kind == 'gim':  # 김말이: 김에 싼 막대 (끝은 튀김옷)
        for x0, y0 in [(1, 5), (5, 3), (9, 6)]:
            d.rounded_rectangle((x0, y0, x0 + 5, y0 + 7), radius=2, fill=(40, 52, 40, 255), outline=EDGE)
            d.rectangle((x0 + 1, y0, x0 + 4, y0 + 1), fill=GOLD); d.point((x0 + 2, y0 + 4), fill=(80, 100, 70, 255))
        return im
    if kind == 'sweet':  # 고구마튀김: 노란 속 · 보라 껍질
        for x0, y0 in [(1, 5), (5, 3), (9, 6)]:
            d.ellipse((x0, y0, x0 + 6, y0 + 5), fill=(250, 200, 80, 255), outline=(130, 60, 110, 255)); d.point((x0 + 2, y0 + 2), fill=(255, 230, 150, 255))
        return im
    if kind == 'shrimp':  # 새우튀김: 길쭉한 튀김 + 빨간 꼬리
        for x0 in (2, 6, 10):
            d.rounded_rectangle((x0, 4, x0 + 3, 11), radius=1, fill=GOLD, outline=EDGE)
            d.polygon([(x0, 3), (x0 + 3, 3), (x0 + 1, 0)], fill=(230, 80, 50, 255), outline=INK)
            d.point((x0 + 1, 6), fill=HI)
        return im
    if kind == 'mandu':  # 만두튀김: 반달 만두 두 개
        for x0, y0 in [(1, 3), (7, 5)]:
            d.chord((x0, y0, x0 + 8, y0 + 8), 180, 360, fill=GOLD, outline=EDGE)
            for k in range(3): d.point((x0 + 2 + k * 2, y0 + 3), fill=HI)
        return im
    for x0, y0, w, h in [(2, 4, 5, 7), (6, 2, 5, 8), (9, 5, 5, 6)]:
        d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=2, fill=GOLD, outline=EDGE)
        d.point((x0 + 1, y0 + 2), fill=HI); d.point((x0 + 2, y0 + 4), fill=HI)
    return im


def widen_top(top):  # 윗판(x1~27)을 앞면(x2~30) 너비에 맞춰요 — 가운데 기둥을 두 줄 더 넣어요 (v0.71 사용자 지적: 상판·서랍 너비가 안 맞음)
    bb = top.getbbox()
    if not bb or (bb[0], bb[2]) != (1, 28):
        return top
    src = top.crop((1, 0, 28, top.height)); o = Image.new('RGBA', top.size, (0, 0, 0, 0)); x = 2
    for part in (src.crop((0, 0, 14, src.height)), src.crop((13, 0, 14, src.height)), src.crop((13, 0, 14, src.height)), src.crop((14, 0, src.width, src.height))):
        o.alpha_composite(part, (x, 0)); x += part.width
    return o


def stack_counter(top, gap, front=None):
    """윗판 top을 앞면(Kitchen 121) 위에 얹어 바닥에 붙는 32x32 조리대 한 장으로 (gap: 윗판과 앞면의 세로 간격)"""
    top = widen_top(top)
    front = front or crop(INT, KIT % 121)
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    fy = 32 - 20          # 앞면 아래 끝(20)이 칸 바닥에 오게
    im.alpha_composite(top, (0, fy - gap)) if fy - gap >= 0 else im.alpha_composite(top.crop((0, gap - fy, top.width, top.height)), (0, 0))
    im.alpha_composite(front, (0, fy))
    return im


# 탁자 위에 놓는 작은 음식 (8~9px) — 주문 말풍선·손에 든 그림은 큰 것(16px)을 써요
SMALL_PAL = {'k': INK, 'r': (216, 69, 47, 255), 'R': (165, 42, 31, 255), 't': (255, 241, 220, 255),
             'n': (95, 174, 74, 255), 'w': (244, 241, 236, 255), 'g': (207, 199, 189, 255),
             'y': (240, 200, 60, 255), 'o': (235, 120, 60, 255), 'b': (30, 36, 34, 255),
             'O': (226, 160, 64, 255), 'L': (250, 210, 120, 255), 'p': (236, 226, 200, 255)}


def own_tteok_s(over=None):
    return grid([
        '.kkkkkk.',
        'krrtrrRk',
        'krtrnrtk',
        'kRrrtrRk',
        '.kwwwwk.',
        '..kggk..',
    ], {**SMALL_PAL, **(over or {})})


def own_kimbap_s(over=None):
    return grid([
        '.bbb.bbb.',
        'bwywbwowb',
        'bwnwbwnwb',
        '.bbb.bbb.',
        'kgwwwwwgk',
        '.kkkkkkk.',
    ], {**SMALL_PAL, **(over or {})})


def own_twigim_s(over=None):
    return grid([
        '..kk.kk.',
        '.kOLkOOk',
        'kOOOOLOk',
        'kOLOOOOk',
        '.kppppk.',
        '..kkkk..',
    ], {**SMALL_PAL, **(over or {})})


# 새 메뉴 (2장 · data/menu.js VARIANTS): 기본 메뉴 그림의 색을 바꾸거나 모양을 조금 바꿔요
T_OVER = {
    'tteok_hot': {'r': (190, 30, 22, 255), 'R': (120, 14, 10, 255), 'n': (60, 150, 50, 255)},
    'tteok_cheese': {'n': (250, 214, 70, 255), 'R': (240, 190, 50, 255)},
    'tteok_rose': {'r': (238, 128, 100, 255), 'R': (198, 88, 70, 255)},
    'tteok_jjajang': {'r': (92, 62, 40, 255), 'R': (60, 40, 28, 255), 'n': (110, 180, 90, 255)},
    'tteok_cream': {'r': (240, 222, 180, 255), 'R': (214, 190, 140, 255), 't': (255, 255, 255, 255), 'n': (110, 170, 80, 255)},
}
K_COLS = {
    'kimbap_tuna': [(228, 210, 170, 255), (240, 200, 60, 255), (110, 170, 80, 255)],
    'kimbap_mini': [(235, 120, 60, 255), (110, 170, 80, 255), (240, 200, 60, 255)],
    'kimbap_cheese': [(252, 214, 50, 255), (252, 214, 50, 255), (110, 170, 80, 255)],
    'kimbap_hot': [(60, 150, 50, 255), (220, 60, 40, 255), (222, 176, 104, 255)],
    'kimbap_katsu': [(196, 128, 60, 255), (240, 200, 60, 255), (110, 170, 80, 255)],
}
K_SMALL = {'kimbap_tuna': {'y': (228, 210, 170, 255)}, 'kimbap_mini': {'y': (235, 120, 60, 255)}, 'kimbap_cheese': {'y': (252, 214, 50, 255), 'o': (252, 214, 50, 255)},
           'kimbap_hot': {'y': (60, 150, 50, 255), 'o': (220, 60, 40, 255)}, 'kimbap_katsu': {'y': (196, 128, 60, 255)}}
F_SMALL = {'twigim_squid': {'L': (236, 226, 200, 255)}, 'twigim_gim': {'O': (40, 52, 40, 255), 'L': (226, 160, 64, 255)}, 'twigim_sweet': {'O': (250, 200, 80, 255), 'L': (130, 60, 110, 255)},
           'twigim_shrimp': {'L': (230, 80, 50, 255)}, 'twigim_mandu': {'O': (214, 160, 90, 255)}}


def variant_sprites():
    out = {}
    for k, o in T_OVER.items():
        out[k] = tight(own_tteok(o)); out[k + '_s'] = own_tteok_s(o)
    for k, c in K_COLS.items():
        out[k] = tight(own_kimbap(c, small=(k == 'kimbap_mini'))); out[k + '_s'] = own_kimbap_s(K_SMALL[k])
    for k, o in F_SMALL.items():
        out[k] = tight(own_twigim(k.split('_')[1])); out[k + '_s'] = own_twigim_s(o)
    return out


def tight(im):
    """빈 테두리를 잘라 내요 (말풍선 가운데에 놓기 쉽게)"""
    return im.crop(im.getbbox())


def own_register():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((2, 7, 13, 14), fill=(90, 96, 110, 255), outline=INK)
    d.rectangle((3, 8, 12, 9), fill=(120, 128, 145, 255))
    for x in (4, 7, 10):
        d.point((x, 11), fill=(220, 220, 225, 255)); d.point((x, 13), fill=(220, 220, 225, 255))
    d.rectangle((6, 2, 13, 6), fill=(60, 66, 80, 255), outline=INK)
    d.rectangle((7, 3, 12, 5), fill=(120, 220, 140, 255))
    d.point((8, 4), fill=(40, 120, 60, 255)); d.point((10, 4), fill=(40, 120, 60, 255))
    return im


def own_pot():  # 화구 위 떡볶이 냄비 (16x10)
    im = Image.new('RGBA', (16, 10), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((1, 1, 14, 9), fill=(70, 70, 80, 255), outline=INK)
    d.ellipse((3, 2, 12, 7), fill=(216, 69, 47, 255))
    d.point((5, 4), fill=(255, 241, 220, 255)); d.point((6, 4), fill=(255, 241, 220, 255))
    d.point((9, 5), fill=(255, 241, 220, 255)); d.point((10, 5), fill=(255, 241, 220, 255))
    d.point((8, 3), fill=(95, 174, 74, 255))
    return im


def own_mat():  # 김밥 마는 김발 + 김밥 한 줄 (16x10)
    im = Image.new('RGBA', (16, 10), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, 1, 15, 9), fill=(196, 186, 110, 255), outline=(120, 110, 50, 255))
    for x in range(2, 15, 2):
        d.line((x, 2, x, 8), fill=(160, 150, 80, 255))
    d.rounded_rectangle((2, 4, 13, 7), radius=2, fill=(30, 36, 34, 255))
    d.point((13, 5), fill=(250, 248, 240, 255)); d.point((13, 6), fill=(240, 200, 60, 255))
    return im


def own_face(kind):
    im = Image.new('RGBA', (11, 11), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fill = {'love': (255, 170, 190, 255), 'happy': (255, 214, 90, 255), 'meh': (210, 210, 200, 255), 'angry': (240, 96, 80, 255)}[kind]
    d.ellipse((0, 0, 10, 10), fill=fill, outline=INK)
    if kind == 'love':
        for cx in (3, 7):
            d.point((cx - 1, 3), fill=(210, 40, 70, 255)); d.point((cx + 1, 3), fill=(210, 40, 70, 255))
            d.line((cx - 1, 4, cx + 1, 4), fill=(210, 40, 70, 255)); d.point((cx, 5), fill=(210, 40, 70, 255))
        d.line((3, 7, 7, 7), fill=INK); d.point((4, 8), fill=INK); d.point((5, 8), fill=INK); d.point((6, 8), fill=INK)
    elif kind == 'happy':
        d.point((3, 4), fill=INK); d.point((7, 4), fill=INK)
        d.point((3, 6), fill=INK); d.line((4, 7, 6, 7), fill=INK); d.point((7, 6), fill=INK)
    elif kind == 'meh':
        d.point((3, 4), fill=INK); d.point((7, 4), fill=INK); d.line((3, 7, 7, 7), fill=INK)
    else:
        d.line((2, 3, 4, 4), fill=INK); d.line((6, 4, 8, 3), fill=INK)
        d.point((3, 5), fill=INK); d.point((7, 5), fill=INK)
        d.line((4, 7, 6, 7), fill=INK); d.point((3, 8), fill=INK); d.point((7, 8), fill=INK)
    return im


def own_doormat():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((1, 3, 14, 13), fill=(150, 70, 60, 255), outline=(100, 40, 35, 255))
    for y in range(5, 12, 2):
        d.line((3, y, 12, y), fill=(180, 100, 80, 255))
    return im


# 「분식」 간판 (30x12) — 프롤로그 연출에서 가게 앞 STORE 판을 덮어요
HANGUL = {
    '분': ['..#...#..', '..#####..', '..#...#..', '..#####..', '#########', '....#....', '.#.......', '.#.......', '.#######.'],
    '식': ['..#....#.', '..#....#.', '.#.#...#.', '#...#..#.', '.......#.', '.........', '.######..', '......#..', '......#..'],
    '세': ['..#..#.#.', '..#..#.#.', '.#.#.###.', '#...##.#.', '.....#.#.', '.....#.#.', '.....#.#.', '.....#.#.', '.....#.#.'],
    '탁': ['####.#...', '#....#...', '####.##..', '#....#...', '####.#...', '.........', '#######..', '......#..', '......#..'],
    '꽃': ['###.###..', '..#...#..', '..#...#..', '....#....', '#########', '...###...', '..#####..', '...#.#...', '..#...#..'],
    '집': ['#####.#..', '..#...#..', '.#.#..#..', '#...#.#..', '.........', '.#...#...', '.#####...', '.#...#...', '.#####...'],
    '임': ['.###..#..', '#...#.#..', '#...#.#..', '.###..#..', '.........', '.######..', '.#....#..', '.#....#..', '.######..'],
    '대': ['####.#.#.', '#....#.#.', '#....###.', '#....#.#.', '####.#.#.', '.....#.#.', '.....#.#.', '.....#.#.', '.....#.#.'],
    '자': ['#####..#.', '..#....#.', '..#....#.', '.#.#...##', '#...#..#.', '.......#.', '.......#.', '.......#.', '.......#.'],
    '가': ['#####..#.', '....#..#.', '....#..#.', '....#..##', '...#...#.', '..#....#.', '.#.....#.', '.......#.', '.......#.'],
    '구': ['.######..', '......#..', '......#..', '......#..', '.........', '#########', '....#....', '....#....', '....#....'],
    '카': ['#####..#.', '....#..#.', '#####..#.', '....#..##', '...#...#.', '..#....#.', '.#.....#.', '.......#.', '.......#.'],
    '페': ['#####.#.#', '.#.#..#.#', '.#.#.##.#', '.#.#..#.#', '#####.#.#', '......#.#', '......#.#', '......#.#', '......#.#'],
    '약': ['.###..#..', '#...#.##.', '#...#.#..', '#...#.##.', '.###..#..', '.........', '#######..', '......#..', '......#..'],
    '국': ['#######..', '......#..', '......#..', '#########', '....#....', '.........', '#######..', '......#..', '......#..'],
    '학': ['..#...#..', '#####.#..', '.###..##.', '#...#.#..', '.###..#..', '.........', '#######..', '......#..', '......#..'],
    '원': ['.###...#.', '#...#..#.', '#...#..#.', '.###...#.', '#####.##.', '..#....#.', '.......#.', '#........', '#######..'],
    '철': ['..#...#..', '#####.#..', '.#.#.##..', '#...#.#..', '#######..', '......#..', '#######..', '#........', '#######..'],
    '물': ['.#####...', '.#...#...', '.#####...', '#########', '#######..', '......#..', '#######..', '#........', '#######..'],
    '재': ['####.#.#.', '.#...#.#.', '.#...###.', '#.#..#.#.', '#..#.#.#.', '.....#.#.', '.....#.#.', '.....#.#.', '.....#.#.'],
}


def own_sign(text='분식', bg=(200, 56, 42, 255), hi=(232, 104, 80, 255)):
    im = Image.new('RGBA', (30, 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 29, 11), fill=bg, outline=INK)
    d.line((1, 1, 28, 1), fill=hi)
    for k, ch in enumerate(text):
        for y, row in enumerate(HANGUL[ch]):
            for x, c in enumerate(row):
                if c == '#':
                    im.putpixel((5 + k * 11 + x, 2 + y), (255, 248, 230, 255))
    return im


# 「식자재」 간판 (48x20) — 골목 끝 정 사장 식자재 마트 (그림의 MARKET 판 자리를 덮어요: 판 왼쪽 위 x32 · y70)
TW_CUT = {'store': (16, 46), 'home': (32, 60), 'market': (16, 52)}  # 빼는 지붕 줄 (src/js/data/town.js 건물 높이와 맞춰요)


def squash(im, y0, y1):  # 지붕 가운데 줄(y0~y1)을 빼서 낮게 — 마을 지도에서 건물이 너무 크지 않게 (포켓몬 하트골드 느낌)
    out = Image.new('RGBA', (im.width, im.height - (y1 - y0)), (0, 0, 0, 0))
    out.paste(im.crop((0, 0, im.width, y0)), (0, 0))
    out.paste(im.crop((0, y1, im.width, im.height)), (0, y0))
    return out


def dull(im, k):  # 채도를 k만큼 빼고 살짝 어둡게
    from PIL import ImageEnhance
    a = im.split()[3]
    rgb = ImageEnhance.Brightness(ImageEnhance.Color(im.convert('RGB')).enhance(1 - k)).enhance(0.88)
    out = rgb.convert('RGBA'); out.putalpha(a)
    return out


def own_sign_mart():
    im = Image.new('RGBA', (48, 20), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 47, 19), fill=(46, 120, 80, 255), outline=INK)
    d.line((1, 1, 46, 1), fill=(90, 170, 120, 255)); d.line((1, 18, 46, 18), fill=(30, 84, 56, 255))
    for k, ch in enumerate('식자재'):
        for y, row in enumerate(HANGUL[ch]):
            for x, c in enumerate(row):
                if c == '#':
                    im.putpixel((8 + k * 11 + x, 5 + y), (255, 248, 230, 255))
    return im


# 골목 게시판 (20x26) — 전단지 붙이는 곳
def own_board():
    im = Image.new('RGBA', (20, 26), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((2, 12, 3, 25), fill=(110, 72, 44, 255)); d.rectangle((16, 12, 17, 25), fill=(110, 72, 44, 255))  # 다리
    d.rectangle((0, 0, 19, 15), fill=(196, 150, 96, 255), outline=(96, 60, 36, 255))   # 코르크 판
    d.rectangle((2, 2, 8, 8), fill=(252, 250, 240, 255)); d.line((3, 4, 7, 4), fill=(216, 69, 47, 255))
    d.rectangle((10, 3, 17, 10), fill=(240, 236, 200, 255)); d.line((11, 5, 16, 5), fill=(80, 110, 170, 255)); d.line((11, 7, 15, 7), fill=(150, 140, 120, 255))
    d.rectangle((4, 10, 9, 13), fill=(250, 220, 120, 255))
    return im


def own_notice():  # 창문에 붙은 「알바 구함」 종이 (12x14)
    im = Image.new('RGBA', (12, 14), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, 2, 11, 13), fill=(252, 250, 240, 255), outline=(150, 140, 120, 255))
    d.rectangle((4, 0, 7, 3), fill=(240, 220, 150, 200))  # 테이프
    d.line((2, 5, 9, 5), fill=(216, 69, 47, 255)); d.line((2, 6, 9, 6), fill=(216, 69, 47, 255))  # 빨간 제목
    for y in (8, 10): d.line((2, y, 9 if y == 8 else 7, y), fill=(120, 110, 100, 255))
    return im


# 원재료 아이콘 (정 사장 식자재 진열대 타일 · 16x16) — data/menu.js INGREDIENTS와 같은 이름 (ing_떡 …)
def own_ings():
    W = (246, 242, 232, 255); G = (210, 202, 188, 255)
    out = {}
    def new():
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
    im, d = new()  # 떡: 가래떡 두 줄
    for y in (4, 9):
        d.rounded_rectangle((1, y, 14, y + 4), radius=2, fill=W, outline=INK); d.line((3, y + 3, 12, y + 3), fill=G)
    out['ddeok'] = im
    im, d = new()  # 어묵: 꼬치에 접힌 어묵
    d.line((8, 0, 8, 15), fill=(150, 110, 70, 255))
    d.polygon([(3, 3), (13, 3), (11, 7), (13, 11), (3, 11), (5, 7)], fill=(222, 176, 104, 255), outline=INK)
    d.line((5, 5, 11, 5), fill=(246, 210, 150, 255)); d.line((5, 9, 11, 9), fill=(186, 130, 70, 255))
    out['fishcake'] = im
    im, d = new()  # 대파: 흰 줄기 + 초록 잎
    d.polygon([(2, 14), (5, 15), (11, 6), (8, 5)], fill=W, outline=INK)
    d.polygon([(8, 5), (11, 6), (15, 0), (12, 0)], fill=(80, 160, 70, 255), outline=INK)
    d.line((10, 4, 14, 0), fill=(130, 200, 100, 255)); d.point((3, 15), fill=(200, 190, 150, 255))
    out['scallion'] = im
    im, d = new()  # 당근
    d.polygon([(4, 4), (11, 4), (8, 15)], fill=(236, 120, 40, 255), outline=INK)
    d.line((6, 7, 8, 7), fill=(190, 80, 20, 255)); d.line((7, 10, 9, 10), fill=(190, 80, 20, 255))
    d.polygon([(5, 4), (6, 0), (8, 3), (10, 0), (10, 4)], fill=(80, 160, 70, 255), outline=INK)
    out['carrot'] = im
    im, d = new()  # 양파
    d.ellipse((2, 4, 13, 15), fill=(214, 168, 112, 255), outline=INK)
    d.arc((4, 6, 11, 15), 200, 340, fill=(240, 210, 160, 255)); d.line((7, 1, 8, 4), fill=INK); d.line((8, 1, 9, 4), fill=(120, 90, 60, 255))
    out['onion'] = im
    im, d = new()  # 계란
    d.ellipse((3, 1, 12, 15), fill=(250, 244, 228, 255), outline=INK); d.point((6, 5), fill=(255, 255, 255, 255)); d.point((5, 6), fill=(255, 255, 255, 255))
    d.arc((4, 3, 11, 14), 20, 120, fill=(220, 200, 170, 255))
    out['egg'] = im
    im, d = new()  # 고추장: 빨간 통
    d.rectangle((2, 5, 13, 15), fill=(196, 52, 40, 255), outline=INK); d.rectangle((1, 2, 14, 5), fill=(150, 30, 24, 255), outline=INK)
    d.rectangle((5, 8, 10, 12), fill=(246, 220, 120, 255)); d.point((7, 10), fill=(196, 52, 40, 255)); d.point((8, 10), fill=(196, 52, 40, 255))
    out['gochujang'] = im
    im, d = new()  # 쌀: 쌀자루
    d.polygon([(3, 3), (12, 3), (14, 15), (1, 15)], fill=(232, 220, 190, 255), outline=INK)
    d.line((4, 5, 11, 5), fill=(150, 110, 70, 255)); d.rectangle((5, 8, 10, 12), fill=(250, 248, 240, 255), outline=(170, 150, 110, 255))
    d.point((7, 10), fill=(120, 120, 120, 255)); d.point((8, 10), fill=(120, 120, 120, 255))
    out['rice'] = im
    im, d = new()  # 김: 겹친 김 두 장
    d.rectangle((1, 4, 11, 14), fill=(34, 56, 44, 255), outline=INK); d.rectangle((4, 1, 14, 11), fill=(46, 74, 56, 255), outline=INK)
    for y in (3, 6, 9): d.line((6, y, 12, y), fill=(70, 104, 80, 255))
    out['gim'] = im
    im, d = new()  # 튀김가루: 종이 봉투 + 노란 띠
    d.rectangle((3, 2, 12, 15), fill=(244, 236, 214, 255), outline=INK); d.line((3, 4, 12, 4), fill=(200, 190, 160, 255))
    d.rectangle((3, 8, 12, 11), fill=(240, 190, 60, 255)); d.point((6, 9), fill=(200, 120, 30, 255)); d.point((9, 10), fill=(200, 120, 30, 255))
    out['batter'] = im
    im, d = new()  # 식용유: 노란 병
    d.rectangle((6, 0, 9, 2), fill=(200, 60, 40, 255), outline=INK); d.rectangle((6, 3, 9, 4), fill=(240, 220, 120, 255), outline=INK)
    d.rounded_rectangle((3, 5, 12, 15), radius=2, fill=(244, 206, 70, 255), outline=INK)
    d.line((5, 7, 5, 13), fill=(252, 236, 150, 255)); d.rectangle((6, 9, 10, 12), fill=(250, 248, 240, 255))
    out['oil'] = im
    # 새 메뉴 재료 (2장)
    im, d = new()  # 청양고추: 초록 고추 둘
    for x0 in (3, 8):
        d.polygon([(x0, 3), (x0 + 3, 3), (x0 + 2, 15), (x0 + 1, 15)], fill=(70, 150, 50, 255), outline=INK)
        d.line((x0 + 1, 1, x0 + 2, 3), fill=(120, 90, 50, 255))
    d.point((4, 6), fill=(140, 210, 110, 255)); d.point((9, 6), fill=(140, 210, 110, 255))
    out['chili'] = im
    im, d = new()  # 우유: 흰 팩 + 파란 띠
    d.polygon([(4, 3), (8, 0), (12, 3)], fill=(240, 240, 245, 255), outline=INK)
    d.rectangle((4, 3, 12, 15), fill=(248, 248, 252, 255), outline=INK); d.rectangle((4, 8, 12, 11), fill=(70, 120, 200, 255))
    out['milk'] = im
    im, d = new()  # 치즈: 구멍 난 노란 조각
    d.polygon([(1, 12), (14, 12), (14, 6), (4, 3)], fill=(250, 210, 60, 255), outline=INK)
    d.ellipse((6, 7, 8, 9), fill=(220, 170, 40, 255)); d.ellipse((10, 8, 12, 10), fill=(220, 170, 40, 255)); d.point((4, 10), fill=(220, 170, 40, 255))
    out['cheese'] = im
    im, d = new()  # 춘장: 검은 통 + 노란 딱지
    d.rectangle((2, 5, 13, 15), fill=(60, 40, 30, 255), outline=INK); d.rectangle((1, 2, 14, 5), fill=(40, 28, 20, 255), outline=INK)
    d.rectangle((5, 8, 10, 12), fill=(246, 220, 120, 255)); d.point((7, 10), fill=(60, 40, 30, 255)); d.point((8, 10), fill=(60, 40, 30, 255))
    out['chunjang'] = im
    im, d = new()  # 참치: 납작한 캔
    d.ellipse((2, 4, 13, 8), fill=(200, 205, 215, 255), outline=INK); d.rectangle((2, 6, 13, 12), fill=(70, 110, 180, 255))
    d.line((2, 6, 2, 12), fill=INK); d.line((13, 6, 13, 12), fill=INK); d.ellipse((2, 10, 13, 14), fill=(70, 110, 180, 255), outline=INK)
    d.rectangle((5, 8, 10, 10), fill=(240, 200, 120, 255))
    out['tuna'] = im
    im, d = new()  # 돈까스: 튀김옷 입은 고기
    d.rounded_rectangle((1, 4, 14, 13), radius=3, fill=(214, 150, 70, 255), outline=INK)
    for x, y in [(4, 6), (8, 7), (11, 9), (5, 10)]: d.point((x, y), fill=(246, 200, 120, 255))
    out['katsu'] = im
    im, d = new()  # 오징어
    d.ellipse((4, 1, 11, 9), fill=(240, 236, 228, 255), outline=INK)
    for x in (4, 6, 8, 10): d.line((x + 1, 9, x, 15), fill=(220, 210, 200, 255))
    d.point((6, 5), fill=INK); d.point((9, 5), fill=INK)
    out['squid'] = im
    im, d = new()  # 당면: 묶은 투명 국수
    for k in range(5): d.arc((2 + k, 2, 13 - k, 14), 0, 360, fill=(200, 190, 170, 255))
    d.rectangle((6, 6, 9, 9), fill=(150, 110, 70, 255), outline=INK)
    out['dangmyeon'] = im
    im, d = new()  # 고구마
    d.ellipse((1, 4, 14, 12), fill=(150, 70, 120, 255), outline=INK); d.line((4, 7, 10, 6), fill=(190, 110, 160, 255))
    d.ellipse((11, 6, 14, 10), fill=(250, 200, 80, 255))
    out['sweetpotato'] = im
    im, d = new()  # 새우
    d.arc((2, 2, 13, 13), 40, 300, fill=(236, 110, 70, 255), width=3)
    d.polygon([(10, 10), (14, 12), (12, 15)], fill=(220, 70, 40, 255), outline=INK); d.point((4, 5), fill=INK)
    out['shrimp'] = im
    im, d = new()  # 만두: 반달 둘
    for x0, y0 in [(0, 5), (6, 3)]:
        d.chord((x0, y0, x0 + 9, y0 + 9), 180, 360, fill=(246, 240, 226, 255), outline=INK)
        for k in range(3): d.point((x0 + 2 + k * 2, y0 + 3), fill=(210, 200, 180, 255))
    out['mandu'] = im
    return out


# ── 미소 가구 (2장): 테마 4개 × 벽지·바닥·창문·화분·액자·식탁+의자 ─────────
#  LimeZu 그림을 잘라 쓰고, 식탁·의자는 지금 그림의 색만 바꿔요 (data/furniture.js FURN_THEMES와 이름을 맞춰요)
GEN = '1_Interiors/16x16/Theme_Sorter/1_Generic_16x16.png'
LIV = '1_Interiors/16x16/Theme_Sorter/2_LivingRoom_16x16.png'
FURN = {
    'retro': dict(wall=(176, 64), floor=(64, 320), win=(99, 695), plant=(97, 914, 14, 22), frame=(2, 490), tint=dict(hue=0.02, sat=1.15, val=0.85)),
    'wood': dict(wall=(176, 0), floor=(0, 384), win=(195, 695), plant=(212, 408, 23, 31), frame=(2, 458), tint=dict(sat=0.9, val=1.08)),
    'pastel': dict(wall=(352, 288), floor=(128, 128), win=(131, 695), plant=(133, 905, 22, 23), frame=(2, 522), tint=dict(hue=0.42, sat=0.45, add=0.12)),
    'minimal': dict(wall=(0, 64), floor=(192, 480), win=(163, 695), plant=(240, 457, 16, 31), frame=(34, 426), tint=dict(sat=0.12, add=0.18)),
}


def recolor(src, hue=None, sat=1.0, val=1.0, add=0.0):  # 색만 바꾸기 (채도가 있는 픽셀만 색상 hue로)
    o = src.copy(); px = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = px[x, y]
            if not a or (r, g, b, a) == SHADOW:  # 그림자(검정 8%)는 그대로
                continue
            h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if hue is not None and s_ > 0.12:
                h = hue
            s_ = min(1, s_ * sat); v = min(1, v * val + add)
            r2, g2, b2 = colorsys.hsv_to_rgb(h, s_, v)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return o


def furn_sprites():
    out = {}
    for th, d in FURN.items():
        mid = crop(INT, RB + 'Room_Builder_Walls_16x16.png', d['wall'][0] + 16, d['wall'][1], 16, 32)  # 가운데 한 칸만 이어 붙여 이음매 없이
        w = Image.new('RGBA', (48, 32), (0, 0, 0, 0))
        for i in range(3):
            w.paste(mid, (i * 16, 0))
        out['wall_' + th] = w
        out['floor_' + th] = floor48(d['floor'][0], d['floor'][1])
        out['win_' + th] = crop(INT, GEN, d['win'][0], d['win'][1], 25, 20)
        out['plant_' + th] = crop(INT, GEN, *d['plant'])
        out['frame_' + th] = crop(INT, LIV, d['frame'][0], d['frame'][1], 13, 14)
        out['table_' + th] = recolor(crop(INT, KIT % 289), **d['tint'])
        out['chair_' + th] = recolor(crop(INT, KIT % 280), **d['tint'])
    return out



# 고급 가구 (♥♥♥) · 친밀도 전용 (♥♥♥♥ 행운목·골목 옛 사진) · 미소 컬렉션 (♥♥♥♥♥)
#  벽지·바닥·화분·액자는 LimeZu에서, 커튼·식탁보·방석·꽃은 직접 그려 얹어요
FURN2 = {
    'retro': dict(wall=(352, 416), floor=(64, 224), plant=('LIV', 207, 345, 25, 30, None), frame=('GEN', 34, 219, 28, 9),
                  cloth=((200, 56, 42), (250, 244, 232), 'check'), curtain=(176, 48, 44), cushion=(200, 60, 48)),
    'wood': dict(wall=(176, 256), floor=(128, 160), plant=('LIV', 234, 348, 21, 29, (150, 98, 56)), frame=('GEN', 5, 218, 21, 10),
                 cloth=((232, 216, 184), (196, 160, 112), 'runner'), curtain=(206, 176, 132), cushion=(104, 140, 88)),
    'pastel': dict(wall=(352, 448), floor=(128, 384), plant=('LIV', 207, 345, 25, 30, (240, 160, 184)), frame=('GEN', 66, 219, 28, 9),
                   cloth=((246, 196, 206), (255, 250, 250), 'lace'), curtain=(190, 172, 232), cushion=(150, 220, 196)),
    'minimal': dict(wall=(0, 256), floor=(128, 512), plant=('LIV', 234, 348, 21, 29, (236, 236, 236)), frame=('LIV', 48, 390, 14, 22),
                    cloth=((242, 242, 242), (210, 210, 214), 'plain'), curtain=(176, 180, 190), cushion=(150, 152, 160)),
}


def pot_tint(im, col, rows=10):  # 아래쪽(화분) 몇 줄만 색 바꾸기 — 잎은 그대로
    o = im.copy(); px = o.load(); h, s_, v = colorsys.rgb_to_hsv(*[c / 255 for c in col])
    for y in range(max(0, o.height - rows), o.height):
        for x in range(o.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if ss < 0.25 and vv < 0.35:  # 테두리 선은 그대로
                continue
            if 0.0 <= hh <= 0.13 or hh > 0.9:  # 흙빛(주황·갈색) 화분만
                r2, g2, b2 = colorsys.hsv_to_rgb(h, s_ * (0.6 + 0.4 * vv), min(1, v * (0.55 + 0.6 * vv)))
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return o


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def curtain_win(win, col):  # 창문 + 커튼(양옆 · 위 주름) 35x23
    o = Image.new('RGBA', (35, 23), (0, 0, 0, 0))
    o.paste(win, (5, 2), win)
    c, d, l = shade(col, 1), shade(col, 0.78), shade(col, 1.15)
    for x in range(1, 34):
        o.putpixel((x, 0), INK)
    for y in range(1, 22):
        for x0 in (1, 28):
            for k in range(6):
                if y > 14 and k == 5 - (0 if x0 == 1 else 5):
                    continue
                o.putpixel((x0 + k, y), d if k % 3 == 1 else (l if k % 3 == 0 else c))
        o.putpixel((1, y), INK); o.putpixel((33, y), INK)
    for x in range(2, 33):  # 위 주름 (가리개)
        for y in (1, 2):
            o.putpixel((x, y), c if (x // 3) % 2 else l)
        if (x // 3) % 2:
            o.putpixel((x, 3), d)
    for x0 in (1, 28):  # 커튼 끈
        for k in range(6):
            o.putpixel((x0 + k, 13), (240, 200, 90, 255))
    for x in range(1, 34):
        o.putpixel((x, 22), INK) if o.getpixel((x, 21))[3] else None
    return o


def cloth_table(tb, cloth):  # 식탁보 (위판 덮고 앞으로 늘어지게)
    base, alt, kind = cloth
    o = tb.copy(); px = o.load()
    for y in range(2, 15):
        for x in range(0, 16):
            if y == 2 or x in (0, 15) or y == 14:
                if y <= 13 or x % 3 != 1:
                    px[x, y] = INK
                continue
            if kind == 'check':
                c = base if ((x // 2) + (y // 2)) % 2 else alt
            elif kind == 'runner':
                c = alt if 6 <= x <= 9 else base
            elif kind == 'lace':
                c = alt if y >= 12 and x % 2 == 0 else base
            else:
                c = base
            if y >= 12 and kind != 'lace':
                c = tuple(int(v * 0.85) for v in c)
            px[x, y] = c + (255,) if len(c) == 3 else c
    for x in range(1, 15):
        if x % 3 == 1:
            px[x, 14] = (0, 0, 0, 0)
    return o


def cushion_chair(ch, col):  # 의자 위에 방석
    o = ch.copy(); px = o.load()
    c, l = shade(col, 1), shade(col, 1.2)
    for x in range(4, 14):
        px[x, 7] = INK if x > 5 else px[x, 7]
        px[x, 8] = l
        px[x, 9] = c
        px[x, 10] = shade(col, 0.8)
    return o


def own_lucky(gen):  # 「미소가 키운 행운목」: 야자 화분을 금빛 화분 + 빨간 리본으로
    o = pot_tint(gen, (236, 190, 70), 9); px = o.load()
    for x in range(8, 15):
        if px[x, o.height - 8][3]:
            px[x, o.height - 8] = (210, 40, 40, 255)
    return o


def sepia(im):
    o = im.copy(); px = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = px[x, y]
            if a:
                v = (r * 0.3 + g * 0.59 + b * 0.11)
                px[x, y] = (min(255, int(v * 1.07 + 20)), min(255, int(v * 0.9 + 10)), int(v * 0.7), a)
    return o


def own_miso_frame():  # 미소 컬렉션: 말린 꽃 액자 (22x16)
    o = Image.new('RGBA', (22, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    d.rectangle((0, 0, 21, 15), fill=(214, 168, 96, 255), outline=INK)
    d.rectangle((2, 2, 19, 13), fill=(252, 244, 228, 255))
    for (x, y, c) in ((6, 6, (232, 96, 130)), (11, 5, (246, 180, 60)), (15, 7, (220, 110, 170)), (8, 9, (240, 140, 160))):
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            o.putpixel((x + dx, y + dy), c + (255,))
        o.putpixel((x, y), (255, 236, 120, 255))
    for y in range(9, 13):
        o.putpixel((10, y), (90, 150, 80, 255)); o.putpixel((14, y - 1), (90, 150, 80, 255))
    return o


def flower_dots(im, cols, n=7, seed=3):  # 화분 잎에 꽃 몇 송이
    import random
    o = im.copy(); px = o.load(); rnd = random.Random(seed); leaves = []
    for y in range(o.height - 10):
        for x in range(o.width):
            r, g, b, a = px[x, y]
            if a and g > r and g > b:
                leaves.append((x, y))
    for i in range(min(n, len(leaves))):
        x, y = rnd.choice(leaves); px[x, y] = cols[i % len(cols)] + (255,)
    return o


def own_flower_box(win):  # 미소 컬렉션 창문: 창 아래 꽃 상자
    o = Image.new('RGBA', (29, 24), (0, 0, 0, 0)); o.paste(win, (2, 0), win); d = ImageDraw.Draw(o)
    d.rectangle((0, 18, 28, 23), fill=(176, 112, 70, 255), outline=INK)
    for i, x in enumerate(range(2, 27, 3)):
        c = [(232, 96, 130), (246, 190, 60), (220, 110, 170)][i % 3]
        o.putpixel((x, 17), c + (255,)); o.putpixel((x + 1, 16), (90, 150, 80, 255)); o.putpixel((x, 16), c + (255,))
    return o


def furn2_sprites():
    out = {}
    WALLS = RB + 'Room_Builder_Walls_16x16.png'; FLOORS = RB + 'Room_Builder_Floors_16x16.png'
    def wall48(x, y):
        mid = crop(INT, WALLS, x + 16, y, 16, 32); w = Image.new('RGBA', (48, 32), (0, 0, 0, 0))
        for i in range(3):
            w.paste(mid, (i * 16, 0))
        return w
    SH = {'GEN': GEN, 'LIV': LIV}
    for th, d in FURN2.items():
        g = FURN[th]
        out['wall_' + th + '2'] = wall48(*d['wall'])
        out['floor_' + th + '2'] = floor48(d['floor'][0], d['floor'][1])
        out['win_' + th + '2'] = curtain_win(crop(INT, GEN, g['win'][0], g['win'][1], 25, 20), d['curtain'])
        sh, x, y, w, h, pot = d['plant']
        pl = crop(INT, SH[sh], x, y, w, h)
        out['plant_' + th + '2'] = pot_tint(pl, pot) if pot else pl
        sh, x, y, w, h = d['frame']
        out['frame_' + th + '2'] = crop(INT, SH[sh], x, y, w, h)
        out['table_' + th + '2'] = cloth_table(recolor(crop(INT, KIT % 289), **g['tint']), d['cloth'])
        out['chair_' + th + '2'] = cushion_chair(recolor(crop(INT, KIT % 280), **g['tint']), d['cushion'])
    # 친밀도 전용 (♥♥♥♥): 행운목 · 골목 옛 사진
    out['plant_lucky'] = own_lucky(crop(INT, GEN, 212, 408, 23, 31))
    out['frame_old'] = sepia(crop(INT, LIV, 2, 458, 13, 14))  # 풍경 액자를 빛바랜 사진처럼
    # 미소 컬렉션 (♥♥♥♥♥)
    out['wall_miso'] = wall48(0, 0)
    out['floor_miso'] = floor48(64, 128)
    out['win_miso'] = own_flower_box(crop(INT, GEN, 131, 695, 25, 20))
    out['plant_miso'] = flower_dots(pot_tint(crop(INT, GEN, 133, 905, 22, 23), (240, 150, 176)), [(232, 96, 130), (246, 190, 60), (255, 255, 255)], 9)
    out['frame_miso'] = own_miso_frame()
    out['table_miso'] = cloth_table(recolor(crop(INT, KIT % 289), hue=0.95, sat=0.5, add=0.1), ((250, 214, 222), (232, 96, 130), 'lace'))
    out['chair_miso'] = cushion_chair(recolor(crop(INT, KIT % 280), hue=0.95, sat=0.5, add=0.1), (232, 120, 150))
    return out


# ── 미소 가구 주방 (v0.71 사용자 결정): 조리대(kc_) · 주방 바닥(kf_) · 조리 기구(stove_·fryer_) ──
#  조리대 = LimeZu 윗판 + 앞면(121)에 테마 색 · 조리 기구 = 회색 금속에만 색 · 바닥 = LimeZu 바닥 한 칸 이어 붙이기
def metal(src, hue, sat, val=1.0, add=0.0):  # 푸른 회색 금속 픽셀만 색을 입혀요 — 윤곽선·불꽃·기름·그림자는 그대로
    o = src.copy(); px = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = px[x, y]
            if a < 255:
                continue
            h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s_ > 0.25 or v < 0.28 or b < r:
                continue
            r2, g2, b2 = colorsys.hsv_to_rgb(hue, sat, min(1, v * val + add))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return o


def kitchen_sprites():
    out = {}

    def recolor(src, hue=None, sat=1.0, val=1.0, add=0.0):  # 주방용: 윤곽선(어두운 픽셀)·그림자는 그대로 두고 색만
        o = src.copy(); px = o.load()
        for y in range(o.height):
            for x in range(o.width):
                r, g, b, a = px[x, y]
                if a < 255:
                    continue
                h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if v < 0.3 and s_ < 0.5:
                    continue
                if hue is not None and s_ > 0.12:
                    h = hue
                s_ = min(1, s_ * sat); v = min(1, v * val + add)
                r2, g2, b2 = colorsys.hsv_to_rgb(h, s_, v)
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
        return o
    TOP, TOP_BEIGE, TOP_WHITE, FRONT = crop(INT, KIT % 126), crop(INT, KIT % 128), crop(INT, KIT % 132), crop(INT, KIT % 121)
    STOVE, FRYER = crop(INT, KIT % 148), crop(INT, KIT % 194)
    # 테마: (윗판, 앞면, 바닥 (x, y), 조리 기구 색 (hue, sat, val, add))
    K = {
        'retro': (recolor(TOP, hue=0.0, sat=1.6, val=0.95), recolor(FRONT, val=0.78, sat=1.1), (128, 32), (0.0, 0.55, 1.0, 0.05)),
        'retro2': (recolor(TOP_WHITE, sat=0), recolor(FRONT, hue=0.0, sat=1.5, val=0.85), (128, 160), (0.08, 0.35, 1.05, 0.1)),
        'wood': (recolor(TOP_BEIGE, sat=0.6), recolor(FRONT, sat=0.5, add=0.06), (64, 192), (0.1, 0.16, 1.05, 0.08)),
        'wood2': (TOP, recolor(FRONT, val=0.7, sat=1.1), (192, 416), (0.08, 0.3, 0.95, 0.0)),
        'pastel': (recolor(TOP, hue=0.42, sat=0.5, add=0.15), recolor(FRONT, hue=0.95, sat=0.35, add=0.18), (192, 448), (0.42, 0.28, 1.0, 0.12)),
        'pastel2': (TOP_WHITE, recolor(FRONT, hue=0.45, sat=0.45, add=0.15), (192, 512), (0.95, 0.22, 1.0, 0.15)),
        'minimal': (TOP_WHITE, recolor(FRONT, sat=0.1, add=0.15), (192, 64), (0.6, 0.02, 1.15, 0.15)),
        'minimal2': (recolor(TOP, sat=0.05, val=0.55), recolor(FRONT, sat=0.05, val=0.9, add=0.05), (64, 512), (0.6, 0.03, 0.55, 0.0)),
        'miso': (TOP_WHITE, recolor(FRONT, hue=0.95, sat=0.45, add=0.12), (128, 128), (0.95, 0.3, 1.0, 0.12)),
    }
    for k, (top, front, fl, eq) in K.items():
        out['kc_' + k] = stack_counter(top, 13, front)
        out['kf_' + k] = floor48(*fl)
        out['stove_' + k] = metal(STOVE, *eq)
        out['fryer_' + k] = metal(FRYER, *eq)
    return out


# ── 아틀라스에 넣을 것: 이름 → 그림 ───────────────────────────────────
def collect():
    s = {}
    s['floor_kitchen'] = floor48(0, 64)
    s['floor_dining'] = floor48(64, 192)
    s['wall'] = crop(INT, RB + 'Room_Builder_Walls_16x16.png', 0, 288, 48, 32)
    s['wall_front'] = crop(INT, RB + 'Room_Builder_Walls_16x16.png', 192, 224, 48, 32)
    s['sidewalk'] = crop(EXT, CITY, 128, 0, 32, 32)
    s['stove'] = crop(INT, KIT % 148)
    s['fryer'] = crop(INT, KIT % 194)
    # 조리대(카운터)는 윗판 + 앞면 두 장을 쌓아 만들어요 (낱장 하나만 쓰면 위가 잘린 것처럼 보여요)
    #  앞면 121(서랍장, 내용 y6~20)을 아래에, 윗판을 그 위에 이어 붙여 32x32 한 장으로
    s['counter'] = stack_counter(crop(INT, KIT % 126), 13)   # 나무 윗판 (내용 y9~19)
    s['sink'] = stack_counter(crop(INT, KIT % 141), 9)       # 개수대 윗판 (퇴식대, 내용 y1~15)
    s['fridge'] = crop(INT, KIT % 158)
    s['table'] = crop(INT, KIT % 289)
    s['table2'] = crop(INT, '1_Interiors/16x16/Theme_Sorter/12_Kitchen_16x16.png', 144, 304, 32, 16)  # 2인 탁자 (2칸)
    s['chair'] = crop(INT, KIT % 280)
    s['plate'] = crop(INT, KIT % 381)
    s['menuboard'] = crop(INT, ICE % 14)
    # 프롤로그 연출: 밤의 골목 (가게 셋 · 가로등 · 쓰레기봉투 · 둥근 의자 · 간판)
    STORE = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/9_Shopping_Center_and_Markets_16x16.png'
    PROPS = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/3_City_Props_16x16.png'
    s['st_flower'] = crop(EXT, STORE, 0, 409, 80, 118)    # 초록 차양 — 맞은편 꽃집 자리
    s['st_bunsik'] = crop(EXT, STORE, 176, 409, 80, 118)  # 주황 차양 — 오가네 분식 (문 x16~32)
    s['st_laundry'] = crop(EXT, STORE, 352, 409, 80, 118) # 줄무늬 차양 — 옆 세탁소
    s['lamp'] = crop(EXT, PROPS, 321, 4, 14, 60)
    s['pave'] = crop(EXT, CITY, 144, 0, 32, 32)  # 연출용 보도블록
    s['bag'] = crop(EXT, PROPS, 355, 324, 11, 11)
    s['stool'] = crop(INT, '1_Interiors/16x16/Theme_Sorter/1_Generic_16x16.png', 1, 284, 13, 13)
    s['sign'] = own_sign()
    s['sign_laundry'] = own_sign('세탁', (52, 96, 170, 255), (96, 140, 210, 255))  # 옆 세탁소 STORE 판 자리
    s['sign_flower'] = own_sign('꽃집', (56, 130, 70, 255), (100, 176, 110, 255))   # 맞은편 꽃집
    # 마을(밤·새벽 골목): 우리 집 빌라 · 정 사장 식자재 마트 · 게시판
    #  마을 지도용 건물은 지붕 가운데를 빼서 낮게 (tw_ — 연출의 st_ 가게 그림은 그대로)
    s['tw_home'] = squash(crop(EXT, 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/4_Generic_Buildings_16x16.png', 368, 573, 96, 113), TW_CUT['home'][0], TW_CUT['home'][1])
    s['tw_market'] = squash(crop(EXT, STORE, 240, 553, 112, 133), TW_CUT['market'][0], TW_CUT['market'][1])
    for k, x in (('flower', 0), ('bunsik', 176), ('laundry', 352)):
        s['tw_' + k] = squash(crop(EXT, STORE, x, 409, 80, 118), TW_CUT['store'][0], TW_CUT['store'][1])
    s['sign_mart'] = own_sign_mart()
    # 마을 지도(위에서 내려다본 골목): 빈 가게 · 잔디 · 나무 · 벤치 · 덤불
    s['tw_vacant'] = dull(squash(crop(EXT, STORE, 256, 409, 80, 118), TW_CUT['store'][0], TW_CUT['store'][1]), 0.65)  # 빈 가게: 색을 빼서 문 닫은 느낌
    s['sign_vacant'] = own_sign('임대', (120, 112, 104, 255), (160, 152, 144, 255))
    TER = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/1_Terrains_and_Fences_16x16.png'
    s['grass'] = crop(EXT, TER, 48, 128, 16, 16)
    s['tree'] = crop(EXT, PROPS, 387, 407, 42, 57)
    s['tree2'] = crop(EXT, PROPS, 387, 473, 42, 64)
    s['pine'] = crop(EXT, PROPS, 482, 363, 28, 53)
    s['bench'] = crop(EXT, PROPS, 339, 41, 42, 22)
    s['bush'] = crop(EXT, PROPS, 385, 257, 31, 23)
    s['board'] = own_board()
    s['notice'] = own_notice()
    s['plant'] = crop(INT, '1_Interiors/16x16/Theme_Sorter/1_Generic_16x16.png', 215, 457, 18, 31)  # 개업 축하 화분 (이야기 장식)
    for k, v in own_ings().items():
        s['ing_' + k] = v
    s.update(furn_sprites())
    s.update(furn2_sprites())
    s.update(kitchen_sprites())  # 미소 가구 주방 (v0.71)
    s['sign_furn'] = own_sign('가구', (150, 92, 56, 255), (196, 140, 96, 255))  # 2장: 미소 꽃집 → 미소 가구
    s['tteok'] = tight(own_tteok()); s['kimbap'] = tight(own_kimbap()); s['twigim'] = tight(own_twigim())
    s['tteok_s'] = own_tteok_s(); s['kimbap_s'] = own_kimbap_s(); s['twigim_s'] = own_twigim_s()
    s.update(variant_sprites())  # 새 메뉴 15가지 (2장)
    s['register'] = own_register(); s['pot'] = own_pot(); s['mat'] = own_mat(); s['doormat'] = own_doormat()
    for k in ('love', 'happy', 'meh', 'angry'):
        s['face_' + k] = own_face(k)
    # 캐릭터: 가만히(4)·숨쉬기(24)·걷기(24) 3줄 + 앉기(12) 1줄 → 384x128 한 장
    for i in range(1, 21):
        sheet = img(INT, CHAR % i)
        c = Image.new('RGBA', (384, 128), (0, 0, 0, 0))
        c.paste(sheet.crop((0, 0, 384, 96)), (0, 0))
        c.paste(sheet.crop((0, 128, 192, 160)), (0, 96))
        s['char%d' % (i - 1)] = c
    s['char20'] = own_moon()  # 문 회장 (2장 · 문 철물): 캐릭터 생성기 조각을 겹쳐 만들어요
    s['sign_hw'] = own_sign('철물', (88, 92, 104, 255), (130, 136, 150, 255))  # 세탁소 → 문 철물
    s.update(town2_sprites())  # 마을 동쪽 블록 · 가게 앞 꾸밈 · 상호작용 물건 (v0.48)
    s.update(market_sprites(s))  # 동네 탐방: 재래시장 (v0.78)
    return s


GARDEN = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/17_Garden_16x16.png'
GARAGE = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/6_Garage_Sales_16x16.png'
GENB = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/4_Generic_Buildings_16x16.png'


def own_vending():  # 음료 자판기 (16x26): 빨간 몸통 · 유리 속 캔 · 버튼
    im = Image.new('RGBA', (16, 26), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 15, 25), fill=(200, 50, 44, 255), outline=INK); d.rectangle((1, 1, 14, 2), fill=(232, 96, 80, 255))
    d.rectangle((2, 4, 10, 15), fill=(190, 220, 236, 255), outline=INK)
    for y, cols in ((6, [(240, 200, 60), (90, 160, 220), (230, 90, 80)]), (11, [(110, 180, 90), (240, 200, 60), (90, 160, 220)])):
        for k, c in enumerate(cols): d.rectangle((3 + k * 3, y, 4 + k * 3, y + 2), fill=c + (255,))
    for y in (5, 8, 11): d.point((12, y), fill=(250, 240, 200, 255))
    d.rectangle((3, 19, 12, 22), fill=(40, 30, 34, 255))
    return im


def town2_sprites():
    """마을 동쪽 블록(카페·약국·빌라·학원·놀이터·버스 정류장)과 가게마다 다른 앞모습 꾸밈 (src/js/data/town.js)"""
    STORE = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/9_Shopping_Center_and_Markets_16x16.png'
    PROPS = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/3_City_Props_16x16.png'
    o = {}
    o['tw_cafe'] = squash(crop(EXT, STORE, 432, 409, 80, 118), TW_CUT['store'][0], TW_CUT['store'][1])
    o['tw_pharm'] = squash(crop(EXT, STORE, 80, 409, 80, 118), TW_CUT['store'][0], TW_CUT['store'][1])
    acad = crop(EXT, GENB, 0, 16, 96, 192)
    acad = squash(acad, 12, 52)    # 지붕 가운데를 빼고
    acad = squash(acad, 64, 104)   # 층 하나를 빼서 2층 건물로
    o['tw_acad'] = acad
    o['sign_cafe'] = own_sign('카페', (120, 80, 50, 255), (170, 120, 80, 255))
    o['sign_pharm'] = own_sign('약국', (40, 140, 90, 255), (90, 190, 130, 255))
    o['sign_acad'] = own_sign('학원', (50, 80, 160, 255), (100, 130, 210, 255))
    # 놀이터 · 쉼터 물건
    o['slide'] = crop(EXT, PROPS, 388, 14, 38, 76)
    o['swing'] = crop(EXT, PROPS, 436, 18, 72, 46)
    o['cart'] = crop(EXT, PROPS, 336, 74, 48, 38)
    o['fountain'] = crop(EXT, PROPS, 176, 452, 33, 46)
    o['vending'] = own_vending()
    bs = img(EXT, 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Bus_Stop_1.png')
    o['busstop'] = bs.crop(bs.getbbox())
    # 가게 앞 꾸밈: 꽃집(화분·꽃수레) · 가구점(탁자·상자) · 세탁소(빨래) · 철물점(공구) · 분식(입간판·의자) · 마트(상자)
    o['fl_pots'] = crop(EXT, GARDEN, 386, 376, 60, 30)
    o['fl_cart'] = crop(EXT, GARDEN, 318, 474, 36, 44)
    o['gs_table'] = crop(EXT, GARAGE, 304, 484, 44, 26)
    o['gs_box'] = crop(EXT, GARAGE, 352, 484, 24, 24)
    o['gs_boxes'] = crop(EXT, GARAGE, 432, 500, 32, 42)
    o['tools'] = crop(EXT, GARDEN, 444, 236, 30, 32)
    o['clothes'] = crop(EXT, PROPS, 396, 604, 48, 50)
    o['aframe'] = crop(EXT, PROPS, 96, 3310, 22, 28)
    for k in list(o):
        if not k.startswith(('tw_', 'sign_')):
            bb = o[k].getbbox()
            if bb: o[k] = o[k].crop(bb)
    return o


# ── 동네 탐방: 재래시장 (v0.78) — 가게마다 다른 간판·진열 (사용자 요청: 시장 건물도 다 다르게, 개성 있게) ──
ME16 = 'Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/'
MKT_SMALL = ME16 + '9_Shopping_Center_and_Markets_Singles_16x16/ME_Singles_Shopping_Center_and_Markets_16x16_Market_Small_%d.png'
CAMP = ME16 + '11_Camping_Singles_16x16/ME_Singles_Camping_16x16_%s.png'
VEH = ME16 + '10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_%s.png'
GARD = ME16 + '17_Garden_Singles_16x16/ME_Singles_Garden_16x16_%s.png'
POOL = ME16 + '14_Swimming_Pool_Singles_16x16/ME_Singles_Swimming_Pool_16x16_%s.png'
_KFONT = {}


def kfont(size=16):  # 게임 글꼴(Neo둥근모 Pro — dev/src/font.css에 든 woff2)로 간판 글씨를 써요. fontTools + brotli 필요
    if size not in _KFONT:
        import re
        from fontTools.ttLib import TTFont
        from PIL import ImageFont
        css = open(os.path.join(DEV, 'src', 'font.css'), encoding='utf-8').read()
        raw = base64.b64decode(re.search(r"url\(data:font/woff2;base64,([^)]+)\)", css).group(1))
        f = TTFont(io.BytesIO(raw)); f.flavor = None
        buf = io.BytesIO(); f.save(buf); buf.seek(0)
        _KFONT[size] = ImageFont.truetype(buf, size)
    return _KFONT[size]


def tightb(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def mk_signboard(text, bg, fg=(255, 248, 230, 255), w=72, h=18):  # 시장 간판: 가게 앞면 위를 가로지르는 판
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    hi = tuple(min(255, c + 46) for c in bg[:3]) + (255,); lo = tuple(max(0, c - 50) for c in bg[:3]) + (255,)
    d.rectangle((0, 0, w - 1, h - 1), fill=bg, outline=INK)
    d.line((1, 1, w - 2, 1), fill=hi); d.line((1, h - 2, w - 2, h - 2), fill=lo)
    for x in (2, w - 3): d.point((x, 3), fill=(220, 210, 190, 255)); d.point((x, h - 4), fill=(220, 210, 190, 255))  # 나사
    fn = kfont(16)
    tw = int(d.textlength(text, font=fn))
    txt = Image.new('RGBA', (w, h + 4), (0, 0, 0, 0)); td = ImageDraw.Draw(txt)
    td.text(((w - tw) // 2, 0), text, font=fn, fill=fg)
    a = txt.split()[3].point(lambda v: 255 if v > 110 else 0)  # 글자는 또렷하게 (번짐 없이)
    solid = Image.new('RGBA', txt.size, fg); solid.putalpha(a)
    bb = a.getbbox()
    if bb:
        glyph = solid.crop((0, bb[1], w, bb[3]))
        y = (h - glyph.height) // 2
        sh = Image.new('RGBA', glyph.size, lo); sh.putalpha(glyph.split()[3])
        im.alpha_composite(sh, (0, y + 1)); im.alpha_composite(glyph, (0, y))
    return im


def mk_shutter(w=68, h=36):  # 문 닫은 가게: 회색 셔터
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, w - 1, h - 1), fill=(150, 156, 168, 255), outline=INK)
    for y in range(3, h - 3, 3): d.line((1, y, w - 2, y), fill=(118, 124, 138, 255))
    d.rectangle((w // 2 - 5, h - 5, w // 2 + 4, h - 3), fill=(90, 94, 104, 255))  # 손잡이
    d.line((1, 1, w - 2, 1), fill=(190, 196, 206, 255))
    return im


def mk_table_with(items, w=40):  # 진열 탁자 위에 물건 아이콘 (떡·반찬 …)
    tb = tightb(crop(EXT, GARAGE, 304, 484, 44, 26)).resize((w, 22), Image.NEAREST)
    im = Image.new('RGBA', (w, 30), (0, 0, 0, 0)); im.alpha_composite(tb, (0, 8))
    for k, ic in enumerate(items):
        x = 2 + k * ((w - 16) // max(1, len(items) - 1)) if len(items) > 1 else (w - 16) // 2
        im.alpha_composite(ic, (x, 0))
    return im


def mk_bowls():  # 반찬통 여러 개 (16x16 하나)
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for (x, y, c) in ((0, 6, (200, 60, 40)), (8, 6, (90, 150, 60)), (4, 0, (230, 180, 60))):
        d.rectangle((x, y + 2, x + 7, y + 9), fill=(236, 236, 240, 255), outline=INK)
        d.rectangle((x + 1, y + 3, x + 6, y + 5), fill=c + (255,))
    return im


def mk_sacks():  # 방앗간: 고춧가루·참깨 자루 (30x22)
    im = Image.new('RGBA', (30, 22), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for (x, top, c) in ((0, 4, (200, 50, 36)), (10, 0, (236, 220, 180)), (20, 5, (150, 110, 70))):
        d.rounded_rectangle((x, top + 2, x + 9, 21), radius=2, fill=(230, 214, 176, 255), outline=INK)
        d.ellipse((x + 1, top, x + 8, top + 5), fill=c + (255,), outline=INK)
    return im


def market_sprites(s):
    o = {}
    for i in range(1, 13):  # 가게 건물 12가지 색 — 지붕 가운데를 빼서 낮게
        im = crop(EXT, MKT_SMALL % i).crop((0, 9, 80, 128))
        o['mk_b%d' % i] = squash(im, 12, 44)
    SIGNS = {  # 간판 글씨 · 판 색 (src/js/data/explore.js SHOP_TYPES와 같은 이름)
        'fruit': ('싱싱과일', (220, 112, 36, 255)), 'veg': ('초록채소', (66, 136, 60, 255)), 'flower': ('꽃집', (196, 84, 136, 255)),
        'fish': ('바다수산', (44, 104, 176, 255)), 'tteok': ('할매떡집', (184, 52, 64, 255)), 'mill': ('참방앗간', (122, 80, 48, 255)),
        'banchan': ('엄마반찬', (210, 150, 30, 255)), 'dried': ('건어물', (56, 66, 100, 255)), 'gukbap': ('순대국밥', (140, 36, 36, 255)),
        'goods': ('만물잡화', (96, 98, 112, 255)),
    }
    for k, (t, bg) in SIGNS.items():
        o['mk_s_' + k] = mk_signboard(t, bg)
    o['mk_shut'] = mk_shutter()
    # 가게 앞 진열 (가게마다 달라요)
    o['mk_d_fruit'] = tightb(crop(EXT, VEH % 'Fruit_Flowers_Cart_2'))
    o['mk_d_veg'] = tightb(crop(EXT, VEH % 'Fruit_Flowers_Cart_3'))
    o['mk_d_flower'] = tightb(crop(EXT, VEH % 'Fruit_Flowers_Cart_4'))
    fish = Image.new('RGBA', (62, 26), (0, 0, 0, 0))
    fish.alpha_composite(tightb(crop(EXT, CAMP % 'Fish_Crate_5')), (0, 2)); fish.alpha_composite(tightb(crop(EXT, CAMP % 'Fish_Crate_7')), (31, 0))
    o['mk_d_fish'] = tightb(fish)
    o['mk_d_tteok'] = mk_table_with([s['ing_ddeok'], s['ing_ddeok'], s['ing_ddeok']])
    o['mk_d_banchan'] = mk_table_with([mk_bowls(), s['ing_egg'], mk_bowls()])
    mill = Image.new('RGBA', (48, 24), (0, 0, 0, 0)); mill.alpha_composite(mk_sacks(), (0, 2)); mill.alpha_composite(s['ing_gochujang'], (32, 8))
    o['mk_d_mill'] = tightb(mill)
    dried = Image.new('RGBA', (46, 30), (0, 0, 0, 0)); dried.alpha_composite(tightb(crop(EXT, CAMP % 'Pier_Crates_4')), (0, 3)); dried.alpha_composite(s['ing_gim'], (28, 12)); dried.alpha_composite(s['ing_gim'], (30, 0))
    o['mk_d_dried'] = tightb(dried)
    o['mk_d_gukbap'] = tightb(crop(EXT, VEH % 'Street_Food_Cart_4'))
    goods = Image.new('RGBA', (60, 40), (0, 0, 0, 0)); goods.alpha_composite(tightb(crop(EXT, GARD % 'Wood_Box_Full_3')), (0, 0)); goods.alpha_composite(tightb(crop(EXT, GARD % 'Wood_Box_Full_1')), (28, 10))
    o['mk_d_goods'] = tightb(goods)
    # 길 가운데 노점·물건
    for i in (1, 2, 3, 6):
        o['mk_cart%d' % i] = tightb(crop(EXT, VEH % ('Street_Food_Cart_%d' % i)))
    for i in (2, 3, 4):
        o['mk_umb%d' % i] = tightb(crop(EXT, POOL % ('Umbrella_%d' % i)))
    for i in (1, 2, 3):
        o['mk_bask%d' % i] = tightb(crop(EXT, CAMP % ('Basket_%d' % i)))
    o['mk_crate'] = tightb(crop(EXT, CAMP % 'Pier_Crates_5'))
    o['mk_lamp'] = tightb(crop(EXT, CAMP % 'Lantern_2'))
    return o


def own_moon():
    CG = '2_Characters/Character_Generator/'
    parts = ['Bodies/16x16/Body_03.png', 'Eyes/16x16/Eyes_01.png', 'Outfits/16x16/Outfit_23_01.png', 'Hairstyles/16x16/Hairstyle_12_05.png', 'Accessories/16x16/Accessory_15_Glasses_01.png']
    sheet = None
    for p in parts:
        im = img(INT, CG + p)
        if sheet is None:
            sheet = Image.new('RGBA', im.size, (0, 0, 0, 0))
        sheet.alpha_composite(im)
    c = Image.new('RGBA', (384, 128), (0, 0, 0, 0))
    c.paste(sheet.crop((0, 0, 384, 96)), (0, 0))
    c.paste(sheet.crop((0, 128, 192, 160)), (0, 96))
    return c


def pack(sprites, width=512):
    items = sorted(sprites.items(), key=lambda kv: (-kv[1].height, -kv[1].width))
    x = y = row_h = 0; pos = {}
    for name, im in items:
        if x + im.width > width:
            x = 0; y += row_h + 1; row_h = 0
        pos[name] = (x, y, im.width, im.height)
        x += im.width + 1; row_h = max(row_h, im.height)
    atlas = Image.new('RGBA', (width, y + row_h), (0, 0, 0, 0))
    for name, im in sprites.items():
        px, py, _, _ = pos[name]
        atlas.paste(im, (px, py))
    return atlas, pos


def main():
    sprites = collect()
    atlas, pos = pack(sprites)
    buf = io.BytesIO(); atlas.save(buf, 'PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    rects = json.dumps({k: list(v) for k, v in sorted(pos.items())}, separators=(',', ':'))
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// dev/art_pack.py가 자동으로 만드는 파일이에요. 손으로 고치지 않아요.\n')
        f.write('// 그림 출처: LimeZu Modern Interiors·Modern Exteriors (limezu.itch.io, 크레딧 필수) + 직접 그린 음식·계산대·표정\n')
        f.write(f'export const SPR = {rects};\n')
        f.write('export const CHAR_COUNT = 20;\n')
        f.write(f"export const ATLAS_URL = 'data:image/png;base64,{b64}';\n")
    print(f'atlas {atlas.width}x{atlas.height}, {len(buf.getvalue())//1024}KB, 그림 {len(pos)}개 → {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
