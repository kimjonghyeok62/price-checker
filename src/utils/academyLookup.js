import { fetchWithTimeout } from './googleSheets';

// 학원명으로 찾아 등록(신고)번호를 넣으면 나이스 학원서비스의 교습비를 실시간으로 받아 온다 (apps-script/academyLookup.gs)
// 주소가 비어 있으면 검색 카드를 숨기고 기존 "나이스 엑셀 올리기"만 쓴다

export const ACADEMY_API_URL = 'https://script.google.com/macros/s/AKfycbx6HzWxIrExp1H-7HuHZtaaB1Td484h14FVGaysTdivpZxDekQ7xFuZ4eYtUORTkIJL/exec';

export const isAcademyLookupReady = () => !!ACADEMY_API_URL;

// ─── 서버 호출 ────────────────────────────────────────────────
// Apps Script 웹앱은 한동안 안 쓰다 처음 부르면 수십 초 걸릴 때가 있다 — 한 번 늦으면 한 번 더 부른다(두 번째는 대개 빠르다)
// 404·5xx는 대개 구글 쪽 일시 오류(재배포 직후, 응답 주소 만료 등)라 한 번 더 부르면 된다
const SLOW_MESSAGE = '서버 응답이 늦습니다. 잠시 후 다시 시도하세요.';
const TEMP_ERROR_MESSAGE = '일시적인 서버 오류입니다. 잠시 후 다시 눌러 주세요.';

const isTempStatus = (status) => status === 404 || status === 429 || status >= 500;

async function callApi(url, timeoutMs, options) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs, options);
      if (!res.ok) {
        if (!isTempStatus(res.status)) throw new Error(`서버 오류 (HTTP ${res.status})`);
        if (attempt >= 1) throw new Error(TEMP_ERROR_MESSAGE);
        continue;
      }
      return await res.json();
    } catch (err) {
      const slow = err.name === 'AbortError' || err.name === 'TypeError'; // 시간 초과·연결 끊김
      if (!slow) throw err;
      if (attempt >= 1) throw new Error(SLOW_MESSAGE);
    }
  }
}

// ─── 검색 목록 ────────────────────────────────────────────────
const listPromises = new Map();

// 받은 목록은 이 기기에 보관 — 하루 한 번(새벽 4시) 바뀌므로 6시간 안이면 서버에 묻지 않는다
const LIST_KEY = 'academyLookup:list:v1:';
const LIST_FRESH_MS = 6 * 60 * 60 * 1000;
const LIST_KEEP = 3;

function readSavedList(region) {
  try {
    const saved = JSON.parse(localStorage.getItem(LIST_KEY + region) || 'null');
    return saved && Array.isArray(saved.items) ? saved : null;
  } catch {
    return null;
  }
}

function saveList(region, json) {
  try {
    localStorage.setItem(LIST_KEY + region, JSON.stringify({ at: Date.now(), region: json.region, syncedAt: json.syncedAt, items: json.items }));
    // 최근 지역 몇 개만 남긴다 (수원 목록 하나가 300KB쯤)
    const keys = Object.keys(localStorage).filter(k => k.startsWith(LIST_KEY));
    keys
      .map(k => [k, readSavedList(k.slice(LIST_KEY.length))?.at || 0])
      .sort((a, b) => b[1] - a[1])
      .slice(LIST_KEEP)
      .forEach(([k]) => localStorage.removeItem(k));
  } catch { /* 저장 못 해도 동작 */ }
}

async function fetchList(region) {
  const saved = readSavedList(region);
  if (saved && Date.now() - saved.at < LIST_FRESH_MS) return saved;
  try {
    const json = await callApi(`${ACADEMY_API_URL}?region=${encodeURIComponent(region)}`, 20000);
    if (!json.ok) throw new Error(json.error || '목록을 불러오지 못했습니다.');
    saveList(region, json);
    return json;
  } catch (err) {
    if (saved) return saved; // 서버가 늦으면 전에 받아 둔 목록이라도
    throw err;
  }
}

/**
 * 교육지원청 하나의 추천 목록 — 한 번 받아서 재사용
 * { region, syncedAt, items: [{ id, kind, name, sigun, dong, check, key, bareKey, cho }] }
 * check: 'N' 등록(신고)번호, 'P' 설립·운영자 이름, 'NP' 둘 중 하나, '' 확인 자료 없음
 */
export function loadAcademyList(region) {
  if (!listPromises.has(region)) {
    listPromises.set(region, (async () => {
      const json = await fetchList(region);
      const items = (json.items || []).map(([id, kind, name, sigun, dong, check = '']) => ({
        id, kind, name, sigun, dong, check,
        key: nameKey(name),
        bareKey: nameKey(String(name).replace(/\([^)]*\)/g, '')),
        cho: toChosung(nameKey(name)),
      }));
      return { region: json.region || region, syncedAt: json.syncedAt || '', items };
    })().catch(err => { listPromises.delete(region); throw err; }));
  }
  return listPromises.get(region);
}

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function toChosung(text) {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    out += code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
  }
  return out;
}

// 띄어쓰기·괄호·기호를 빼고 영문은 소문자로 — "브릿지(Bridge) 영어학원" → "브릿지bridge영어학원"
function nameKey(text) {
  return String(text || '').normalize('NFC').toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎ]/g, '');
}

/**
 * 철자가 조금 달라도 찾는다
 *  - 부분 일치: 브릿지 / bridge / 브릿지영어
 *  - 띄어 쓴 낱말은 모두 들어 있으면: "미사 영어"
 *  - 초성: ㅂㄹㅈ
 */
export function searchAcademyList(items, query, limit = 20) {
  const words = String(query || '').split(/\s+/).map(nameKey).filter(Boolean);
  if (!words.length) return [];
  const joined = words.join('');
  const isCho = /^[ㄱ-ㅎ]+$/.test(joined);

  const scored = [];
  for (const a of items) {
    let score;
    if (isCho) {
      const i = a.cho.indexOf(joined);
      if (i < 0) continue;
      score = i === 0 ? 0 : 2;
    } else if (a.key.startsWith(joined) || a.bareKey.startsWith(joined)) {
      score = 0;
    } else if (a.key.includes(joined) || a.bareKey.includes(joined)) {
      score = 1;
    } else if (words.every(w => a.key.includes(w))) {
      score = 2;
    } else {
      continue;
    }
    scored.push([score, a]);
  }
  return scored
    .sort((x, y) => x[0] - y[0] || x[1].name.length - y[1].name.length || x[1].name.localeCompare(y[1].name, 'ko'))
    .slice(0, limit)
    .map(x => x[1]);
}

// ─── 조회 ─────────────────────────────────────────────────────
async function postApi(body) {
  // text/plain으로 보내야 Apps Script 웹앱이 브라우저 사전 요청(CORS preflight) 없이 받는다
  const json = await callApi(ACADEMY_API_URL, 30000, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!json.ok) throw new Error(json.error || '처리하지 못했습니다.');
  return json;
}

/**
 * { academy, source: 'neis' | 'sheet', verified, basis }
 *  - answer: 등록(신고)번호 또는 설립·운영자 이름 (확인 자료가 없는 곳은 비워도 된다)
 *  - source가 sheet면 나이스가 응답하지 않아 마지막 동기화 자료를 쓴 것
 *  - region: 고를 때의 교육지원청 — 서버가 시트 대신 그 지역 캐시에서 학원을 찾는다
 */
export const lookupAcademy = (id, answer, region) => postApi({ action: 'lookup', id, answer, region });

/** 나이스 엑셀로 올린 학원에 게시표용 등록번호를 붙일 때 — { regNo, category, kind } */
export const verifyAcademyRegNo = (name, answer) => postApi({ action: 'verify', name, answer });

// ─── 이 기기에서 확인한 학원 (다음부터 번호 없이 바로) ───────────
const MINE_KEY = 'academyLookup:mine:v1';
const MINE_MAX = 5;

/**
 * [{ id?, name, answer, regNo, category? }]
 *  - answer: 조회할 때 넣은 본인 확인 값(번호·이름, 확인이 없던 곳은 '')
 *  - regNo: 게시표에 찍는 등록(신고)번호 — 명단에 번호가 없는 곳은 ''
 */
export function readMyAcademies() {
  try {
    const list = JSON.parse(localStorage.getItem(MINE_KEY) || '[]');
    return Array.isArray(list)
      ? list.filter(x => x && x.name).map(x => ({ ...x, answer: x.answer ?? x.regNo ?? '', regNo: x.regNo || '' }))
      : [];
  } catch {
    return [];
  }
}

/** 같은 이름은 최신 것으로 바꿔 맨 앞에 */
export function rememberAcademy(entry) {
  try {
    const rest = readMyAcademies().filter(x => nameKey(x.name) !== nameKey(entry.name));
    localStorage.setItem(MINE_KEY, JSON.stringify([entry, ...rest].slice(0, MINE_MAX)));
  } catch { /* 저장 못 해도 동작 */ }
}

export function forgetAcademy(name) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(readMyAcademies().filter(x => nameKey(x.name) !== nameKey(name))));
  } catch { /* 무시 */ }
}

/** 나이스 엑셀로 올린 학원 중 이 기기에서 확인했던 학원에 등록번호를 붙인다 */
export function attachRememberedRegNo(academies) {
  const mine = new Map(readMyAcademies().filter(x => x.regNo).map(x => [nameKey(x.name), x]));
  return academies.map(a => {
    const m = mine.get(nameKey(a.name));
    return m ? { ...a, regNo: m.regNo, category: a.category || m.category || '' } : a;
  });
}
