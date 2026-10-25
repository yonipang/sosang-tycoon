// 클라우드 저장 (구글 로그인 + Firestore). 등불나무와 같은 Firebase 프로젝트(lamp-tree)를 쓰고, 세이브는 따로 'sosang' 모음에 둬요.
//  - 웹앱 주소(https)에서만 켜져요. Claude 미리보기는 바깥 서버에 닿지 않아서 꺼 둬요(로그인 버튼은 보이고, 누르면 웹앱 안내).
//  - 같은 구글 계정이면 어느 기기에서든 같은 세이브: 로그인할 때·앱으로 돌아올 때 클라우드와 견줘서 더 최근 세이브를 저절로 써요.
//    진 쪽은 버리지 않고 백업(이 기기 sosang-tycoon-backup · 클라우드 문서 prev)해 둬요.
//  - 올리는 때: 이 기기에 저장할 때(새벽 준비 화면)마다, 3초 모아서 한 번.
//  - 클라우드 세이브로 바꾸는 건 처음 화면이나 새벽 준비 화면(대화·연출 중이 아닐 때)에서만. 영업 중이면 다음 준비 화면까지 기다려요.
//  - 시험: window.__cloudMock = { onAuth, google, out, get, put } 을 넣으면 Firebase 대신 써요 (dev/qa)
import { saveText, replaceSave, saveSummary } from './storage.js';

export const FB_CONFIG = { apiKey: 'AIzaSyCsGbKTF6oQiS9_Ow_sAZJBH2XfDfjABYw', authDomain: 'lamp-tree.firebaseapp.com', projectId: 'lamp-tree', storageBucket: 'lamp-tree.firebasestorage.app', messagingSenderId: '614596289531', appId: '1:614596289531:web:161d6a23c5eeb9da3ce15e' };
export const CLOUD_COLLECTION = 'sosang';
// st: off 시작 전 · na 못 씀 · loading 연결 중 · out 로그인 안 함 · in 로그인함
// pending: 바꿔 넣을 클라우드 세이브 (지금 바꿀 수 없어서 기다리는 중) — 기다리는 동안은 올리지 않아요
export const CLOUD = { st: 'off', err: '', user: null, api: null, doc: null, pending: null, busy: false, lastUp: 0 };

const FB_ERR = {
  'auth/popup-closed-by-user': '로그인 창이 닫혔습니다',
  'auth/cancelled-popup-request': '로그인 창이 닫혔습니다',
  'auth/popup-blocked': '로그인 창이 막혔습니다. 브라우저(사파리·크롬)에서 열어 로그인해 보세요',
  'auth/unauthorized-domain': '이 주소는 아직 로그인이 허용되지 않았습니다',
  'auth/network-request-failed': '인터넷 연결을 확인해 보세요',
  'permission-denied': '클라우드 저장 권한이 없습니다 (Firestore 규칙 확인)',
  'unavailable': '클라우드에 연결할 수 없습니다. 잠시 뒤 다시 해 보세요',
};
export const cloudErr = e => FB_ERR[e && e.code] || '클라우드 작업에 실패했습니다' + (e && e.code ? ` (${e.code})` : '');

const subs = [];
export function onCloud(fn) { subs.push(fn); }
const changed = (msg, kind) => { for (const f of subs) f(msg, kind); };
// 화면 쪽이 넣어 줘요: can() 지금 세이브를 바꿔도 되는지 · load(줄) 바꾼 세이브로 다시 열기
let applier = null;
export function setCloudApplier(a) { applier = a; }

export async function cloudInit() {
  if (window.__cloudMock) CLOUD.api = window.__cloudMock;
  else {
    if (window.claude || location.protocol !== 'https:') { CLOUD.st = 'na'; changed(); return; }
    CLOUD.st = 'loading'; changed();
    try {
      const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
      const [a, au, fs] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
      const app = a.initializeApp(FB_CONFIG, 'sosang'), auth = au.getAuth(app), db = fs.getFirestore(app);
      const ref = uid => fs.doc(db, CLOUD_COLLECTION, uid);
      CLOUD.api = {
        onAuth: cb => au.onAuthStateChanged(auth, cb),
        google: () => au.signInWithPopup(auth, new au.GoogleAuthProvider()),
        out: () => au.signOut(auth),
        get: async uid => { const d = await fs.getDoc(ref(uid)); return d.exists() ? d.data() : null; },
        put: (uid, d) => fs.setDoc(ref(uid), d),
      };
    } catch (e) { CLOUD.st = 'na'; CLOUD.err = 'load'; changed(); return; }
  }
  CLOUD.api.onAuth(u => {
    CLOUD.user = u ? { uid: u.uid, name: u.displayName || u.email || '구글 계정' } : null;
    CLOUD.st = u ? 'in' : 'out';
    CLOUD.doc = null; CLOUD.pending = null; CLOUD.lastUp = 0;
    changed();
    if (u) cloudCheck();
  });
}

export async function cloudLogin() {
  if (CLOUD.st === 'na') { changed(CLOUD.err === 'load' ? '클라우드에 연결하지 못했습니다. 인터넷 연결을 확인해 보세요' : 'Claude 안에서는 로그인할 수 없습니다. 웹앱 주소에서 열어 로그인해 보세요', 'info'); return; }
  if (!CLOUD.api || CLOUD.st !== 'out') return;
  try { await CLOUD.api.google(); changed('구글 계정으로 로그인했습니다', 'good'); } catch (e) { changed(cloudErr(e), 'warn'); }
}
export async function cloudLogout() {
  if (!CLOUD.api || CLOUD.st !== 'in') return;
  try { await CLOUD.api.out(); changed('로그아웃했습니다. 이 기기 세이브는 그대로 있습니다', 'info'); } catch (e) { changed(cloudErr(e), 'warn'); }
}

// 클라우드 세이브와 견줘서 더 최근 쪽을 써요 (로그인할 때 · 앱으로 돌아올 때)
let checking = false;
export async function cloudCheck() {
  if (!CLOUD.user || checking) return;
  checking = true;
  let doc;
  try { doc = await CLOUD.api.get(CLOUD.user.uid); } catch (e) { changed(cloudErr(e), 'warn'); return; } finally { checking = false; }
  CLOUD.doc = doc && doc.data ? doc : null;
  const local = saveSummary(saveText());
  const cl = CLOUD.doc && saveSummary(CLOUD.doc.data);
  if (!cl) { if (local) cloudUpload(true); changed(); return; }
  if (!local || cl.at > local.at + 2000) { CLOUD.pending = CLOUD.doc; tryApply(); changed(); return; } // 클라우드가 더 최근 (또는 이 기기엔 세이브 없음)
  CLOUD.lastUp = CLOUD.doc.at || 0;
  if (local.at > cl.at || local.id !== cl.id) cloudUpload(true); // 이 기기가 더 최근
  changed();
}

// 기다리던 클라우드 세이브를 지금 넣을 수 있으면 넣어요
export function tryApply() {
  const d = CLOUD.pending;
  if (!d || !applier || !applier.can()) return false;
  if (!replaceSave(d.data)) { changed('이 기기에 저장할 수 없습니다', 'warn'); return false; }
  CLOUD.pending = null; CLOUD.doc = d; CLOUD.lastUp = d.at || 0;
  applier.load(summaryLine(d.data));
  return true;
}

// 이 기기에 저장한 뒤 불러요 (3초 모아서 한 번)
let upTimer = 0;
export function cloudSaved() {
  if (CLOUD.st !== 'in') return;
  if (CLOUD.pending) { setTimeout(tryApply, 0); return; } // 기다리던 클라우드 세이브가 먼저
  clearTimeout(upTimer);
  upTimer = setTimeout(() => cloudUpload(false), 3000);
}
export function cloudFlush() { if (upTimer) { clearTimeout(upTimer); upTimer = 0; cloudUpload(false); } }

export async function cloudUpload(force) {
  upTimer = 0;
  if (CLOUD.st !== 'in' || CLOUD.busy || CLOUD.pending) return false;
  const data = saveText(), sv = saveSummary(data);
  if (!sv) return false;
  if (!force && sv.at <= CLOUD.lastUp && (!CLOUD.doc || CLOUD.doc.id === sv.id)) return true; // 이미 올린 것 (새 가게면 올려요)
  const doc = { data, at: sv.at || Date.now(), id: sv.id, day: sv.day, shop: sv.shop, ch: sv.ch, v: 1 };
  // 다른 가게를 덮어쓸 때는 그 세이브를 클라우드 백업으로 남겨요
  const old = CLOUD.doc;
  if (old && old.data && old.id !== sv.id) doc.prev = { data: old.data, at: old.at || 0, id: old.id || '', day: old.day || 1, shop: old.shop || '' };
  else if (old && old.prev) doc.prev = old.prev;
  if (doc.prev && doc.prev.data.length + data.length > 900000) delete doc.prev; // 문서 한 개 한도(1MB) 안으로
  CLOUD.busy = true;
  try { await CLOUD.api.put(CLOUD.user.uid, doc); CLOUD.doc = doc; CLOUD.lastUp = doc.at; changed(); return true; }
  catch (e) { changed(cloudErr(e), 'warn'); return false; }
  finally { CLOUD.busy = false; }
}

// 한 줄 요약: 「3일차 · 오가네 분식 · 10월 25일 14:02」
export function summaryLine(text) {
  const s = saveSummary(text);
  if (!s) return '세이브 없음';
  const t = s.at ? new Date(s.at) : null;
  const when = t ? ` · ${t.getMonth() + 1}월 ${t.getDate()}일 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : '';
  return `${s.day}일차 · ${s.shop}${when}`;
}
