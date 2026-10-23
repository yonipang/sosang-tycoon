# 원본(dev/src/ → dev/build.py가 묶은 dev/index.html)을 홈 화면 앱용으로 바꿔 저장소 맨 위(index.html·sw.js·manifest.webmanifest)에 써요.
# 사용법: python3 dev/build_web.py   (앱 아이콘 icon-*.png가 없으면 아틀라스의 떡볶이 그림으로 만들어요 — Pillow 필요)
import base64, hashlib, io, json, os, re, sys
DEV = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(DEV, '..'))
sys.path.insert(0, DEV)
import build
path, _ = build.build()
s = open(path, encoding='utf-8').read()
i = s.index('<div id="app">')
ver = hashlib.md5(s.encode()).hexdigest()[:8]
BG = '#2b1d16'
head = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
        f'<meta name="theme-color" content="{BG}"><meta name="description" content="소상공인 키우기 — 골목 분식집에서 시작하는 픽셀 가게 경영 게임">'
        '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="소상공인 키우기">'
        '<link rel="apple-touch-icon" href="icon-180.png"><link rel="icon" type="image/png" href="icon-192.png"><link rel="manifest" href="manifest.webmanifest">'
        '<title>소상공인 키우기</title>')
pre = s[:i].replace('<title>소상공인 키우기</title>', '', 1)
reg = "<script>if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>"
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(head + pre + reg + '</head><body>' + s[i:] + '</body></html>')

json.dump({'name': '소상공인 키우기', 'short_name': '소상공인', 'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'portrait',
           'background_color': BG, 'theme_color': BG, 'lang': 'ko',
           'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                     {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]},
          open(os.path.join(ROOT, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8').write(f"""// 오프라인 실행용: 첫 접속 때 게임 파일을 저장해 두고, 인터넷 없이도 열려요. (dev/build_web.py가 만들어요)
const CACHE='sosang-{ver}';
const FILES=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))}});
self.addEventListener('fetch',e=>{{
  const r=e.request; if(r.method!=='GET')return;
  if(new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res}}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
}});
""")

# 앱 아이콘 (없을 때만)
if not all(os.path.exists(os.path.join(ROOT, f'icon-{n}.png')) for n in (180, 192, 512)):
    from PIL import Image
    a = open(os.path.join(DEV, 'src', 'js', 'art', 'atlas.js'), encoding='utf-8').read()
    atlas = Image.open(io.BytesIO(base64.b64decode(re.search(r"base64,([^']+)'", a).group(1)))).convert('RGBA')
    x, y, w, h = json.loads(re.search(r'"tteok":(\[[^\]]+\])', a).group(1))
    dish = atlas.crop((x, y, x + w, y + h))
    for n in (180, 192, 512):
        im = Image.new('RGBA', (n, n), BG)
        k = max(1, int(n * 0.6) // w)
        d = dish.resize((w * k, h * k), Image.NEAREST)
        im.alpha_composite(d, ((n - d.width) // 2, (n - d.height) // 2))
        im.convert('RGB').save(os.path.join(ROOT, f'icon-{n}.png'))
print('ok', ver)
