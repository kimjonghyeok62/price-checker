import { ACADEMY_API_URL } from './academyLookup';
import { readSelectedRegion } from './regionRates';

// 사용 기록 — 학원 조회 시트의 "사용기록" 탭에 한 줄씩 쌓는다 (apps-script/academyLookup.gs logUsage_)
// 기기번호는 이 기기에서 만든 무작위 값이라 사람을 알아볼 수 없고, 같은 기기를 한 번으로 셀 때만 쓴다
// 기록이 실패해도 앱 동작에는 영향이 없다 (응답을 기다리지 않음)

const DEVICE_KEY = 'usage:device:v1';
const VISIT_KEY = 'usage:visit:v1';

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 12);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/**
 * event: '접속' | '학원조회' | '신청서출력' | '일괄등록엑셀' | '게시표' | '나이스엑셀올리기' | '반환기준게시표' | '기준단가수정'
 * detail: 세부(예: '일부변경', '내부용 PDF'), academy: 학원명, region: 지역(없으면 고른 지역)
 */
export function logUsage(event, { detail = '', academy = '', region } = {}) {
  if (!ACADEMY_API_URL || import.meta.env.DEV) return; // 개발 중에는 기록하지 않음
  const body = JSON.stringify({
    action: 'log', event, detail: String(detail), academy: String(academy || ''),
    region: region || readSelectedRegion(), device: deviceId(),
  });
  try {
    // 페이지를 떠나거나 인쇄 창이 열려도 보내지도록 beacon 먼저
    if (navigator.sendBeacon?.(ACADEMY_API_URL, new Blob([body], { type: 'text/plain;charset=utf-8' }))) return;
  } catch { /* fetch로 */ }
  fetch(ACADEMY_API_URL, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }).catch(() => {});
}

/** 접속 — 기기마다 하루 한 번만 */
export function logVisit() {
  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD (이 기기 시간)
  try {
    if (localStorage.getItem(VISIT_KEY) === today) return;
    localStorage.setItem(VISIT_KEY, today);
  } catch { /* 저장 못 해도 기록은 */ }
  logUsage('접속');
}
