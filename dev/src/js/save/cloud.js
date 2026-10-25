// 클라우드 저장 (구글 로그인 + Firestore). 등불나무와 같은 Firebase 프로젝트(lamp-tree)를 쓰고, 세이브는 따로 'sosang' 모음에 둬요.
//  - 웹앱 주소(https)에서만 켜져요. Claude 미리보기는 바깥 서버에 닿지 않아서 꺼 둬요.
//  - 올리는 때: 이 기기에 저장할 때(새벽 준비 화면)마다, 3초 모아서 한 번.
//  - 클라우드와 이 기기 세이브가 다르면(다른 판이거나 클라우드가 더 최근) 고르기 전까지 올리지 않아요. 고르지 않은 쪽은 백업해 둬요.
//  - 시험: window.__cloudMock = { onAuth, google, out, get, put } 을 넣으면 Firebase 대신 써요 (dev/qa)
import { saveText, replaceSave, saveSummary } from './storage.js';

export const FB_CONFIG = { apiKey: 'AIzaSyCsGbKTF6oQiS9_Ow_sAZJBH2XfDfjABYw', authDomain: 'lamp-tree.firebaseapp.com', projectId: 'lamp-tree', storageBucket: 'lamp-tree.firebasestorage.app', messagingSenderId: '614596289531', appId: '1:614596289531:web:161d6a23c5eeb9da3ce15e' };
export const CLOUD_COLLECTION = 'sosang';
// st: off 시작 전 · na 못 씀 · loading 연결 중 · out 로그인 안 함 · in 로그인함
// ask: null | 'only'(이 기기엔 없고 클라우드에만) | 'newer'(같은 가게, 클라우드가 더 최근) | 'other'(다른 가게)
export const CLOUD = { st: 'off', err: '', user: null, api: null, doc: null, ask: null, busy: false, lastUp: 0 };

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
    CLOUD.doc = null; CLOUD.ask = null; CLOUD.lastUp = 0;
    changed();
    if (u) cloudCheck();
  });
}

export async function cloudLogin() {
  if (!CLOUD.api || CLOUD.st !== 'out') return;
  try { await CLOUD.api.google(); changed('구글 계정으로 로그인했습니다', 'good'); } catch (e) { changed(cloudErr(e), 'warn'); }
}
export async function cloudLogout() {
  if (!CLOUD.api || CLOUD.st !== 'in') return;
  try { await CLOUD.api.out(); changed('로그아웃했습니다. 이 기기 세이브는 그대로 있습니다', 'info'); } catch (e) { changed(cloudErr(e), 'warn'); }
}

// 로그인하면 클라우드 세이브와 견줘 봐요
export async function cloudCheck() {
  if (!CLOUD.user) return;
  let doc;
  try { doc = await CLOUD.api.get(CLOUD.user.uid); } catch (e) { changed(cloudErr(e), 'warn'); return; }
  CLOUD.doc = doc && doc.data ? doc : null;
  const local = saveSummary(saveText());
  if (!CLOUD.doc) { CLOUD.ask = null; if (local) cloudUpload(true); changed(); return; }
  CLOUD.lastUp = CLOUD.doc.at || 0;
  const cl = saveSummary(CLOUD.doc.data);
  if (!local) CLOUD.ask = 'only';
  else if (!cl || cl.id !== local.id) CLOUD.ask = 'other';
  else if (cl.at > local.at + 2000) CLOUD.ask = 'newer';
  else { CLOUD.ask = null; if (local.at > cl.at) cloudUpload(true); }
  changed(CLOUD.ask === 'newer' ? '클라우드에 더 최근 세이브가 있습니다. 설정에서 골라 보세요'
    : CLOUD.ask === 'other' ? '클라우드에 다른 가게 세이브가 있습니다. 설정에서 골라 보세요' : '', 'info');
}

// 이 기기에 저장한 뒤 불러요 (3초 모아서 한 번)
let upTimer = 0;
export function cloudSaved() {
  if (CLOUD.st !== 'in') return;
  if (CLOUD.ask === 'only') { CLOUD.ask = 'other'; changed(); } // 클라우드 것을 두고 새로 시작했어요: 고르기 전까지 덮어쓰지 않아요
  if (CLOUD.ask) return;
  clearTimeout(upTimer);
  upTimer = setTimeout(() => cloudUpload(false), 3000);
}
export function cloudFlush() { if (upTimer) { clearTimeout(upTimer); upTimer = 0; cloudUpload(false); } }

export async function cloudUpload(force, keepOld) {
  upTimer = 0;
  if (CLOUD.st !== 'in' || CLOUD.busy || CLOUD.ask) return false;
  const data = saveText(), sv = saveSummary(data);
  if (!sv) return false;
  if (!force && sv.at <= CLOUD.lastUp) return true;
  const doc = { data, at: sv.at || Date.now(), id: sv.id, day: sv.day, shop: sv.shop, ch: sv.ch, v: 1 };
  // 다른 가게를 덮어쓸 때는 그 세이브를 클라우드 백업으로 남겨요
  const old = CLOUD.doc;
  if (old && old.data && (keepOld || old.id !== sv.id)) doc.prev = { data: old.data, at: old.at || 0, id: old.id || '', day: old.day || 1, shop: old.shop || '' };
  else if (old && old.prev) doc.prev = old.prev;
  if (doc.prev && doc.prev.data.length + data.length > 900000) delete doc.prev; // 문서 한 개 한도(1MB) 안으로
  CLOUD.busy = true;
  try { await CLOUD.api.put(CLOUD.user.uid, doc); CLOUD.doc = doc; CLOUD.lastUp = doc.at; changed(); return true; }
  catch (e) { changed(cloudErr(e), 'warn'); return false; }
  finally { CLOUD.busy = false; }
}

// 고르기: 클라우드 것 불러오기 (이 기기 것은 백업) · 이 기기 것 쓰기 (클라우드 것은 클라우드 백업)
export function cloudTake() {
  const d = CLOUD.doc;
  if (!d || !saveSummary(d.data)) { changed('클라우드 세이브를 읽지 못했습니다', 'warn'); return false; }
  if (!replaceSave(d.data)) { changed('이 기기에 저장할 수 없습니다', 'warn'); return false; }
  CLOUD.ask = null; CLOUD.lastUp = d.at || 0;
  return true; // 부른 쪽에서 loadGame()으로 이어해요
}
export function cloudKeepLocal() { CLOUD.ask = null; cloudUpload(true, true); changed('이 기기 세이브를 클라우드에 올립니다', 'info'); }

// 한 줄 요약: 「3일차 · 오가네 분식 · 10월 25일 14:02」
export function summaryLine(text) {
  const s = saveSummary(text);
  if (!s) return '세이브 없음';
  const t = s.at ? new Date(s.at) : null;
  const when = t ? ` · ${t.getMonth() + 1}월 ${t.getDate()}일 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : '';
  return `${s.day}일차 · ${s.shop}${when}`;
}
