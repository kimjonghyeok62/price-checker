import React, { useState, useEffect, useRef } from 'react';
import { fetchFieldStats } from '../utils/googleSheets';

const FIELD_LABELS = [
  '단과(초등)', '단과(중등)', '단과(고등)', '진학상담·지도', '어학',
  '음악(유초중고)', '음악(입시)', '미술(유초중고)', '미술(입시)',
  '무용(유초중고)', '무용(입시)', '정보(일반)', '기타(일반)',
];

// STANDARD_RATE_OPTIONS 와 동일 순서
const FIELD_RATES = [210, 222, 234, 234, 259, 224, 336, 212, 255, 212, 255, 230, 230];

const DM_CANDIDATES = [30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180];
const WC_CANDIDATES = [1, 2, 3, 4, 5, 6, 7];

function factorizeMinutes(totalMin) {
  const weeklyMin = totalMin / 4.3;
  const matches = [];
  for (const dm of DM_CANDIDATES) {
    for (const wc of WC_CANDIDATES) {
      if (Math.abs(dm * wc - weeklyMin) < 0.6) matches.push({ dm, wc });
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const aMulti = a.wc >= 2 && a.wc <= 5 ? 0 : 1;
    const bMulti = b.wc >= 2 && b.wc <= 5 ? 0 : 1;
    if (aMulti !== bMulti) return aMulti - bMulti;
    const aDmOk = a.dm >= 40 && a.dm <= 90 ? 0 : 1;
    const bDmOk = b.dm >= 40 && b.dm <= 90 ? 0 : 1;
    if (aDmOk !== bDmOk) return aDmOk - bDmOk;
    return b.wc - a.wc;
  });
  return matches[0];
}

function modeValue(arr) {
  if (arr.length === 0) return 0;
  const freq = {};
  arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  let maxCount = 0, modeVal = arr[0];
  Object.entries(freq).forEach(([v, c]) => {
    if (c > maxCount) { maxCount = c; modeVal = Number(v); }
  });
  return modeVal;
}

function getTop5(rows) {
  const groups = {};
  rows.forEach(({ totalMin, fee }) => {
    const key = Math.round(totalMin);
    if (!groups[key]) groups[key] = { count: 0, fees: [] };
    groups[key].count++;
    groups[key].fees.push(fee);
  });
  return Object.entries(groups)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([totalMin, { count, fees }]) => ({
      totalMin: Number(totalMin),
      count,
      defaultFee: modeValue(fees),
    }));
}

function fmtNum(n) {
  return Math.round(n).toLocaleString('ko-KR');
}

export default function FieldStatistics({ selectedRateIdx, onSelect }) {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedField, setSelectedField] = useState(0);
  const tabsRef = useRef(null);
  const prevRateIdx = useRef('');

  useEffect(() => {
    setLoading(true);
    fetchFieldStats()
      .then(data => { setStatsData(data); setLoading(false); })
      .catch(e => { setError(`불러오기 실패 (${e.message})`); setLoading(false); });
  }, []);

  // 과목1에서 교습분야 선택 시 해당 탭으로 이동
  useEffect(() => {
    if (selectedRateIdx === '' || selectedRateIdx === prevRateIdx.current) return;
    prevRateIdx.current = selectedRateIdx;
    const idx = Number(selectedRateIdx);
    if (!isNaN(idx) && idx >= 0 && idx < 13) {
      setSelectedField(idx);
      // 해당 탭으로 스크롤
      setTimeout(() => {
        const btn = tabsRef.current?.children[idx];
        if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 50);
    }
  }, [selectedRateIdx]);

  const top5 = statsData ? getTop5(statsData[selectedField]) : [];

  return (
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      padding: '16px',
    }}>
      {/* 제목 */}
      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        <span style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: '#4338ca',
          letterSpacing: '0.08em',
          borderBottom: '2px solid #c7d2fe',
          paddingBottom: '3px',
        }}>
          교습비 조합 참고<span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#818cf8', letterSpacing: '0.02em' }}>(클릭시 반영)</span>
        </span>
      </div>

      {/* 분야 탭 */}
      <div
        ref={tabsRef}
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '10px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {FIELD_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setSelectedField(i)}
            style={{
              flexShrink: 0,
              padding: '5px 11px',
              fontSize: '0.78rem',
              fontWeight: selectedField === i ? 700 : 500,
              borderRadius: '20px',
              border: selectedField === i ? '1.5px solid #6366f1' : '1.5px solid #e5e7eb',
              background: selectedField === i ? '#eef2ff' : '#f9fafb',
              color: selectedField === i ? '#4338ca' : '#6b7280',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 데이터 */}
      {loading && (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem', padding: '14px 0' }}>
          데이터 불러오는 중…
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.8rem', padding: '14px 0' }}>
          {error}
        </div>
      )}

      {!loading && !error && statsData && (
        top5.length === 0
          ? <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem', padding: '14px 0' }}>해당 분야 데이터 없음</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {top5.map(({ totalMin, count, defaultFee }, rowIdx) => {
                const combo = factorizeMinutes(totalMin);
                const rate = defaultFee > 0 && totalMin > 0
                  ? Math.round((defaultFee / totalMin) * 10) / 10
                  : null;
                const isOver = rate !== null && rate > FIELD_RATES[selectedField];

                const canFill = combo !== null;

                return (
                  <div
                    key={totalMin}
                    onClick={() => {
                      if (!canFill || !onSelect) return;
                      onSelect({ rateIdx: selectedField, dm: combo.dm, wc: combo.wc, wk: '4.3', fee: defaultFee });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 6px',
                      borderBottom: rowIdx < top5.length - 1 ? '1px solid #f3f4f6' : 'none',
                      borderRadius: '8px',
                      cursor: canFill ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (canFill) e.currentTarget.style.background = '#f5f3ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* 시간 조합 */}
                    <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: '#1f2937', lineHeight: 1.3, minWidth: 0 }}>
                      {combo ? (
                        <>
                          <span style={{ color: '#4338ca' }}>일 {combo.dm}분×주 {combo.wc}회</span>
                          <span style={{ color: '#6b7280', fontWeight: 400 }}>×4.3주</span>
                          <span style={{ color: '#374151' }}> = </span>
                          <span>{fmtNum(totalMin)}분</span>
                        </>
                      ) : (
                        <span>월 {fmtNum(totalMin)}분</span>
                      )}
                      <span style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 400, marginLeft: '3px' }}>({count}건)</span>
                    </div>

                    {/* 교습비 */}
                    <div style={{ flexShrink: 0, fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                      {fmtNum(defaultFee)}원
                    </div>

                    {/* 분당단가 */}
                    <div style={{
                      flexShrink: 0,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: rate === null ? '#9ca3af' : isOver ? '#ef4444' : '#4338ca',
                      minWidth: '68px',
                      textAlign: 'right',
                    }}>
                      {rate !== null ? `${rate.toFixed(1)}원/분` : '—'}
                    </div>
                  </div>
                );
              })}

              <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '8px', textAlign: 'right' }}>
                * 개원 중인 학원 신고 데이터 기준
              </div>
            </div>
          )
      )}
    </div>
  );
}
