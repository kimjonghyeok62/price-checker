/**
 * 앱 설치(PWA) + 안드로이드 "공유 → 교습비 관리" 지원
 *  - 서비스워커(public/sw.js)가 공유받은 엑셀을 캐시에 넣고 /?shared=1 로 연다
 *  - takeSharedFile()로 그 파일을 꺼내 기존 업로드 처리에 넘긴다
 */
const SHARE_CACHE = 'share-target';
const SHARED_FILE_KEY = '/shared-file';

export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

/** 공유로 받은 파일이 있으면 File로 꺼내고 캐시에서 지운다 (없으면 null) */
export async function takeSharedFile() {
    if (!('caches' in window)) return null;
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(SHARED_FILE_KEY);
    if (!res) return null;
    await cache.delete(SHARED_FILE_KEY);
    const name = decodeURIComponent(res.headers.get('X-File-Name') || 'shared.xlsx');
    return new File([await res.blob()], name, { type: res.headers.get('Content-Type') || '' });
}

// ─── 앱 설치 안내 (안드로이드 크롬) ─────────────────────────────

let deferredInstallPrompt = null;
const installListeners = new Set();
const notifyInstall = () => installListeners.forEach(fn => fn());

// beforeinstallprompt는 화면이 뜨기 전에 올 수 있어 앱 시작 시 바로 등록
export function trackInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        notifyInstall();
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        notifyInstall();
    });
}

export const canPromptInstall = () => !!deferredInstallPrompt;

export function onInstallPromptChange(fn) {
    installListeners.add(fn);
    return () => installListeners.delete(fn);
}

export async function promptInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    notifyInstall();
}

export const isAndroid = () => /Android/i.test(navigator.userAgent);
export const isInstalledApp = () => window.matchMedia?.('(display-mode: standalone)').matches;
