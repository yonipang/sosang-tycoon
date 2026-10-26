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
EXT = zipfile.ZipFile(find_zip(2, 'LIMEZU_EXTERIORS', '/mnt/user-data/uploads/modernexteriors*.zip'))
_cache = {}


def img(z, member):
    key = (id(z), member)
    if key not in _cache:
        _cache[key] = Image.open(io.BytesIO(z.read(member))).convert('RGBA')
    return _cache[key]


def crop(z, member, x=0, y=0, w=None, h=None):
    im = img(z, member)
    return im.crop((x, y, x + (w or im.width), y + (h or im.height)))


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


def own_tteok():
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
    ], {'k': INK, 'r': (216, 69, 47, 255), 'R': (165, 42, 31, 255), 't': (255, 241, 220, 255),
        'n': (95, 174, 74, 255), 'w': (244, 241, 236, 255), 'g': (207, 199, 189, 255)})


def own_kimbap():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((0, 7, 15, 15), fill=(230, 226, 222, 255), outline=INK)
    centers = [((2, 5), (240, 200, 60, 255)), ((8, 3), (235, 120, 60, 255)), ((7, 8), (110, 170, 80, 255))]
    for (x, y), c in centers:
        d.ellipse((x, y, x + 6, y + 6), fill=(30, 36, 34, 255))
        d.ellipse((x + 1, y + 1, x + 5, y + 5), fill=(250, 248, 240, 255))
        d.rectangle((x + 3, y + 2, x + 3, y + 4), fill=c)
        d.point((x + 2, y + 3), fill=c); d.point((x + 4, y + 3), fill=(110, 170, 80, 255) if c[1] < 160 else (235, 120, 60, 255))
    return im


def own_twigim():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(1, 9), (14, 9), (12, 15), (3, 15)], fill=(236, 226, 200, 255), outline=INK)
    for x0, y0, w, h in [(2, 4, 5, 7), (6, 2, 5, 8), (9, 5, 5, 6)]:
        d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=2, fill=(226, 160, 64, 255), outline=(150, 90, 30, 255))
        d.point((x0 + 1, y0 + 2), fill=(250, 210, 120, 255)); d.point((x0 + 2, y0 + 4), fill=(250, 210, 120, 255))
    return im


def stack_counter(top, gap):
    """윗판 top을 앞면(Kitchen 121) 위에 얹어 바닥에 붙는 32x32 조리대 한 장으로 (gap: 윗판과 앞면의 세로 간격)"""
    front = crop(INT, KIT % 121)
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


def own_tteok_s():
    return grid([
        '.kkkkkk.',
        'krrtrrRk',
        'krtrnrtk',
        'kRrrtrRk',
        '.kwwwwk.',
        '..kggk..',
    ], SMALL_PAL)


def own_kimbap_s():
    return grid([
        '.bbb.bbb.',
        'bwywbwowb',
        'bwnwbwnwb',
        '.bbb.bbb.',
        'kgwwwwwgk',
        '.kkkkkkk.',
    ], SMALL_PAL)


def own_twigim_s():
    return grid([
        '..kk.kk.',
        '.kOLkOOk',
        'kOOOOLOk',
        'kOLOOOOk',
        '.kppppk.',
        '..kkkk..',
    ], SMALL_PAL)


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
            if not a:
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
        out['floor_' + th] = crop(INT, RB + 'Room_Builder_Floors_16x16.png', d['floor'][0], d['floor'][1], 48, 32)
        out['win_' + th] = crop(INT, GEN, d['win'][0], d['win'][1], 25, 20)
        out['plant_' + th] = crop(INT, GEN, *d['plant'])
        out['frame_' + th] = crop(INT, LIV, d['frame'][0], d['frame'][1], 13, 14)
        out['table_' + th] = recolor(crop(INT, KIT % 289), **d['tint'])
        out['chair_' + th] = recolor(crop(INT, KIT % 280), **d['tint'])
    return out


# ── 아틀라스에 넣을 것: 이름 → 그림 ───────────────────────────────────
def collect():
    s = {}
    s['floor_kitchen'] = crop(INT, RB + 'Room_Builder_Floors_16x16.png', 0, 64, 48, 32)
    s['floor_dining'] = crop(INT, RB + 'Room_Builder_Floors_16x16.png', 64, 192, 48, 32)
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
    s['sign_furn'] = own_sign('가구', (150, 92, 56, 255), (196, 140, 96, 255))  # 2장: 미소 꽃집 → 미소 가구
    s['tteok'] = tight(own_tteok()); s['kimbap'] = tight(own_kimbap()); s['twigim'] = tight(own_twigim())
    s['tteok_s'] = own_tteok_s(); s['kimbap_s'] = own_kimbap_s(); s['twigim_s'] = own_twigim_s()
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
    return s


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
