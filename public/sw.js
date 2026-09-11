/**
 * 서비스워커 — 안드로이드 "공유 → 교습비 관리"(Web Share Target) 전용.
 * 공유된 엑셀 파일을 잠시 캐시에 넣고 게시표 화면(/?shared=1)으로 넘긴다.
 * 그 밖의 요청은 가로채지 않는다(오프라인 캐싱 없음 → 배포하면 바로 반영).
 */
const SHARE_CACHE = 'share-target';
const SHARED_FILE_KEY = '/shared-file';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;

    event.respondWith((async () => {
        try {
            const formData = await event.request.formData();
            const file = formData.getAll('file').find(f => f && typeof f === 'object');
            if (file) {
                const cache = await caches.open(SHARE_CACHE);
                await cache.put(SHARED_FILE_KEY, new Response(file, {
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream',
                        'X-File-Name': encodeURIComponent(file.name || 'shared.xlsx'),
                    },
                }));
            }
        } catch (e) {
            // 파일을 못 받아도 화면은 연다 (사용자가 직접 올릴 수 있도록)
        }
        return Response.redirect('/?shared=1', 303);
    })());
});
