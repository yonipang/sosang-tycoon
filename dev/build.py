# 게임 원본(dev/src/)을 한 파일짜리 게임(dev/index.html)으로 묶어요.
# 사용법: python3 dev/build.py [출력 파일]   (안 주면 dev/index.html)
#
# dev/src/shell.html이 뼈대예요. 그 안의 「/* @include … */」·「// @include …」 줄을 그 파일 내용으로 바꿔 끼워요.
# 끼우는 순서 = shell.html에 적힌 순서. 자바스크립트는 모두 하나의 <script>, 하나의 함수 안에 차례로 들어가요.
#
# 모든 .js 파일은 모듈 모양으로 써요: import { a } from './x.js' · export function f() …
# 묶을 때 import 줄은 지우고 export 낱말만 떼어 내요. 묶기 전에 확인하는 것:
#   - 가져오는 파일이 shell.html에 있는지, 그 이름을 정말 내보내는지
#   - 맨 위 이름이 파일끼리 겹치지 않는지
#   - Math.random을 engine/random.js 밖에서 쓰지 않는지 (게임 결과는 rand(), 보이기만 하는 건 fxRand())
#   - 규칙 파일(data/·sim/·save/state·save/migrations)이 화면(document·DOM)을 직접 만지지 않는지 → emit('…')으로 사건만 남겨요
import os, re, sys

DEV = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(DEV, 'src')
INC = re.compile(r'^\s*(?:/\*|//)\s*@include\s+(\S+?)\s*(?:\*/)?\s*$')
IMP = re.compile(r'''^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?[ \t]*(?:\n|$)''', re.M)
EXP_DECL = re.compile(r'^export\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b)', re.M)
DECL = re.compile(r'^(?:export\s+)?(?:async\s+)?(?:function\*?\s*([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))', re.M)
RULES = ('js/data/', 'js/sim/', 'js/save/state.js', 'js/save/migrations.js')
DOM_USE = re.compile(r'(?<![\w$.])(document\s*\.|window\s*\.(?!__T)|localStorage\b|requestAnimationFrame\b)')


class BuildError(Exception):
    pass


def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'(?m)(^|[^:\\\'"])//.*$', r'\1', s)


def build(out=None):
    shell = open(os.path.join(SRC, 'shell.html'), encoding='utf-8').read()
    js_files = [m.group(1) for line in shell.splitlines() if (m := INC.match(line)) and m.group(1).endswith('.js')]
    exports, sources, errs = {}, {}, []
    for f in js_files:
        s = open(os.path.join(SRC, f), encoding='utf-8').read()
        sources[f] = s
        names = [m.group(1) or m.group(2) or m.group(3) for m in DECL.finditer(s)]
        exports[f] = {n for m in re.finditer(r'^export\s+(?:async\s+)?(?:function\*?|class|const|let)\s+([A-Za-z_$][\w$]*)', s, re.M) for n in [m.group(1)]}
        for m in re.finditer(r'^export\s*\{([^}]*)\}', s, re.M):
            exports[f] |= {x.strip() for x in m.group(1).split(',') if x.strip()}
        sources[f + '#names'] = names
    seen = {}
    for f in js_files:
        for n in sources[f + '#names']:
            if n in seen and seen[n] != f:
                errs.append(f'맨 위 이름 겹침: {n} ({seen[n]} · {f})')
            seen[n] = f
    for f in js_files:
        s = sources[f]
        base = os.path.dirname(f)
        for m in IMP.finditer(s):
            target = os.path.normpath(os.path.join(base, m.group(2))).replace(os.sep, '/')
            if target not in exports:
                errs.append(f'{f}: {m.group(2)}이(가) shell.html에 없어요'); continue
            for n in [x.strip() for x in m.group(1).split(',') if x.strip()]:
                if n not in exports[target]:
                    errs.append(f'{f}: {target}이(가) {n}을(를) 내보내지 않아요')
        code = strip_comments(s)
        if 'Math.random' in code and f != 'js/engine/random.js':
            errs.append(f'{f}: Math.random 대신 rand()(게임 결과)·fxRand()(보이기만)를 써요')
        if f.startswith(RULES) and DOM_USE.search(code):
            errs.append(f'{f}: 규칙 파일은 화면·저장소를 직접 만지지 않아요 (emit 사건으로) — {DOM_USE.search(code).group(0)}')
    if errs:
        raise BuildError('\n'.join(errs))

    def expand(text):
        out_lines = []
        for line in text.splitlines():
            m = INC.match(line)
            if not m:
                out_lines.append(line); continue
            f = m.group(1)
            s = sources.get(f) if f.endswith('.js') else open(os.path.join(SRC, f), encoding='utf-8').read()
            if f.endswith('.js'):
                s = IMP.sub('', s)
                s = EXP_DECL.sub('', s)
                s = re.sub(r'^export\s*\{[^}]*\}\s*;?[ \t]*$', '', s, flags=re.M)
                out_lines.append(f'// ── {f} ──')
            out_lines.append(s.rstrip())
        return '\n'.join(out_lines)

    html = expand(shell)
    # 문법 확인 (node가 있으면): 묶은 스크립트가 브라우저에서 바로 멈추지 않게
    import shutil, subprocess, tempfile
    if shutil.which('node'):
        js = html.split('<script>')[1].split('</script>')[0]
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tf:
            tf.write(js)
        r = subprocess.run(['node', '--check', tf.name], capture_output=True, text=True)
        os.unlink(tf.name)
        if r.returncode:
            raise BuildError('문법 오류:\n' + '\n'.join(r.stderr.strip().splitlines()[:5]))
    out = out or os.path.join(DEV, 'index.html')
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(html)
    return out, len(js_files)


if __name__ == '__main__':
    try:
        path, n = build(sys.argv[1] if len(sys.argv) > 1 else None)
        print(f'ok — 파일 {n}개 → {os.path.relpath(path)} ({os.path.getsize(path)//1024}KB)')
    except BuildError as e:
        print('묶기 실패:\n' + str(e)); sys.exit(1)
