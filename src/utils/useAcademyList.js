import { useCallback, useEffect, useState } from 'react';
import { loadAcademyList } from './academyLookup';

// 교육지원청 하나의 학원·교습소 검색 목록 — { list, error, reload } (list가 null이면 불러오는 중)
export function useAcademyList(region) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState({ key: '', list: null, error: '' });
  const key = `${region}|${attempt}`;

  useEffect(() => {
    if (!region) return undefined;
    let alive = true; // 지역을 바꾸면 늦게 도착한 이전 목록은 버린다
    loadAcademyList(region)
      .then(list => { if (alive) setLoaded({ key, list, error: '' }); })
      .catch(e => { if (alive) setLoaded({ key, list: null, error: `학원 목록을 불러오지 못했습니다. ${e.message || ''}`.trim() }); });
    return () => { alive = false; };
  }, [region, key]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const current = region && loaded.key === key ? loaded : { list: null, error: '' };
  return { list: current.list, error: current.error, reload };
}
