# 배경음악을 웹게임용 MP3(80kbps, 소리 크기 맞춤)로 줄여 dev/src/js/audio/music.js에 넣어요.
# 사용법: python3 dev/audio_pack.py [오 사장님 테마 원본(wav 등)]
#   원본 경로를 안 주면 환경 변수 MUSIC_OH, 그것도 없으면 /mnt/user-data/uploads/에서 찾아요.
# 원본 음악 파일(wav)은 저장소에 올리지 않아요 — 용량이 커서. 이 스크립트가 만든 music.js만 올려요.
# 곡과 라이선스 (크레딧은 js/data/credits.js):
#   oh: lolurio 「Everyday Life」 (Comedy Anime Music) — CC BY 4.0 · https://lolurio.itch.io/comedy-anime-music
import base64, glob, os, subprocess, sys, tempfile

DEV = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DEV, 'src', 'js', 'audio', 'music.js')
TRACKS = {  # 이름 → (인자 순서, 환경 변수, 찾을 무늬)
    'oh': (1, 'MUSIC_OH', '/mnt/user-data/uploads/*Everyday_Life*'),
}


def find(i, env, pattern):
    if len(sys.argv) > i:
        return sys.argv[i]
    if os.environ.get(env):
        return os.environ[env]
    hits = sorted(glob.glob(pattern))
    if not hits:
        sys.exit(f'{env} 원본을 찾지 못했어요 ({pattern}). 경로를 인자로 주세요.')
    return hits[-1]


def encode(src):
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tf:
        dst = tf.name
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src,
                    '-af', 'loudnorm=I=-18:TP=-2', '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '80k', dst], check=True)
    data = open(dst, 'rb').read()
    os.remove(dst)
    return data


def main():
    lines = ['// dev/audio_pack.py가 자동으로 만드는 파일이에요. 손으로 고치지 않아요.',
             '// 곡 출처와 라이선스는 audio_pack.py 맨 위 · 크레딧은 js/data/credits.js']
    for name, (i, env, pat) in TRACKS.items():
        data = encode(find(i, env, pat))
        lines.append(f"export const MUSIC_{name.upper()} = 'data:audio/mpeg;base64,{base64.b64encode(data).decode()}';")
        print(f'{name}: {len(data)//1024}KB')
    lines.append('export const MUSIC = { oh: MUSIC_OH };')
    open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('→', os.path.relpath(OUT))


if __name__ == '__main__':
    main()
