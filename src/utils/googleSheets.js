// 학원·교습소 명단 구글시트는 개인정보(생년월일·연락처·주소)가 있어 앱이 직접 읽지 않는다.
// 필요한 칸만 Apps Script 웹앱(apps-script/academyLookup.gs)이 골라서 준다.

export function fetchWithTimeout(url, timeoutMs = 15000, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}
