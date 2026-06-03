import React, { useState, useEffect, useRef } from 'react';

const FIELD_LABELS = [
  '단과(초등)', '단과(중등)', '단과(고등)', '진학상담·지도', '어학',
  '음악(유초중고)', '음악(입시)', '미술(유초중고)', '미술(입시)',
  '무용(유초중고)', '무용(입시)', '정보(일반)', '기타(일반)',
];

const FIELD_RATES = [210, 222, 234, 234, 259, 224, 336, 212, 255, 212, 255, 230, 230];

const FIELD_FOOTER_LABELS = [
  '보습 - 단과(초등)',
  '보습 - 단과(중등)',
  '보습 - 단과(고등)',
  '진학상담, 지도',
  '어학 (실용외국어 포함)',
  '음악 - 유,초,중,고',
  '음악 - 입시',
  '미술 - 유,초,중,고',
  '미술 - 입시',
  '무용 - 유,초,중,고',
  '무용 - 입시',
  '정보 - 일반',
  '기타 - 일반',
];

// 2026-06-03 기준 박제 데이터 (기준단가 초과 행 제외)
const STATIC_STATS = [
  // 0: 단과(초등) - 210원/분
  [
    { totalMin: 1290, fee: 270000, rate: 209.3 },
    { totalMin: 1548, fee: 280000, rate: 180.9 },
    { totalMin: 774,  fee: 160000, rate: 206.7 },
    { totalMin: 1161, fee: 220000, rate: 189.5 },
    { totalMin: 1032, fee: 200000, rate: 193.8 },
  ],
  // 1: 단과(중등) - 222원/분
  [
    { totalMin: 1548, fee: 300000, rate: 193.8 },
    { totalMin: 1290, fee: 250000, rate: 193.8 },
    { totalMin: 1935, fee: 300000, rate: 155.0 },
    { totalMin: 2322, fee: 370000, rate: 159.3 },
  ],
  // 2: 단과(고등) - 234원/분
  [
    { totalMin: 2322, fee: 450000, rate: 193.8 },
    { totalMin: 1548, fee: 360000, rate: 232.6 },
    { totalMin: 1935, fee: 350000, rate: 180.9 },
    { totalMin: 1806, fee: 400000, rate: 221.5 },
    { totalMin: 2064, fee: 400000, rate: 193.8 },
  ],
  // 3: 진학상담·지도 - 234원/분
  [
    { totalMin: 1548, fee: 300000, rate: 193.8 },
    { totalMin: 2322, fee: 500000, rate: 215.3 },
    { totalMin: 800,  fee: 100000, rate: 125.0 },
    { totalMin: 1032, fee: 150000, rate: 145.3 },
    { totalMin: 1935, fee: 390000, rate: 201.6 },
  ],
  // 4: 어학 - 259원/분
  [
    { totalMin: 1548, fee: 325000, rate: 209.9 },
    { totalMin: 1677, fee: 380000, rate: 226.6 },
    { totalMin: 688,  fee: 170000, rate: 247.1 },
    { totalMin: 1935, fee: 350000, rate: 180.9 },
    { totalMin: 1032, fee: 242000, rate: 234.5 },
  ],
  // 5: 음악(유초중고) - 224원/분
  [
    { totalMin: 774,  fee: 160000, rate: 206.7 },
    { totalMin: 860,  fee: 160000, rate: 186.0 },
    { totalMin: 645,  fee: 140000, rate: 217.1 },
    { totalMin: 1260, fee: 140000, rate: 111.1 },
    { totalMin: 1032, fee: 220000, rate: 213.2 },
  ],
  // 6: 음악(입시) - 336원/분
  [
    { totalMin: 774,  fee: 210000, rate: 271.3 },
    { totalMin: 516,  fee: 170000, rate: 329.5 },
    { totalMin: 645,  fee: 180000, rate: 279.1 },
    { totalMin: 1290, fee: 300000, rate: 232.6 },
    { totalMin: 1548, fee: 250000, rate: 161.5 },
  ],
  // 7: 미술(유초중고) - 212원/분
  [
    { totalMin: 774,  fee: 130000, rate: 168.0 },
    { totalMin: 516,  fee: 80000,  rate: 155.0 },
    { totalMin: 1032, fee: 170000, rate: 164.7 },
    { totalMin: 387,  fee: 65000,  rate: 168.0 },
    { totalMin: 1260, fee: 130000, rate: 103.2 },
  ],
  // 8: 미술(입시) - 255원/분
  [
    { totalMin: 3096, fee: 530000, rate: 171.2 },
    { totalMin: 6192, fee: 990000, rate: 159.9 },
    { totalMin: 4128, fee: 700000, rate: 169.6 },
    { totalMin: 5160, fee: 850000, rate: 164.7 },
    { totalMin: 1032, fee: 210000, rate: 203.5 },
  ],
  // 9: 무용(유초중고) - 212원/분
  [
    { totalMin: 774, fee: 120000, rate: 155.0 },
    { totalMin: 645, fee: 110000, rate: 170.5 },
  ],
  // 10: 무용(입시) - 255원/분
  [
    { totalMin: 774,  fee: 197000, rate: 254.5 },
    { totalMin: 516,  fee: 110000, rate: 213.2 },
    { totalMin: 387,  fee: 98000,  rate: 253.2 },
    { totalMin: 1161, fee: 296000, rate: 255.0 },
    { totalMin: 258,  fee: 65000,  rate: 251.9 },
  ],
  // 11: 정보(일반) - 230원/분
  [
    { totalMin: 3600, fee: 397200, rate: 110.3 },
    { totalMin: 1890, fee: 350000, rate: 185.2 },
    { totalMin: 4128, fee: 400000, rate: 96.9  },
    { totalMin: 4800, fee: 480000, rate: 100.0 },
    { totalMin: 2580, fee: 200000, rate: 77.5  },
  ],
  // 12: 기타(일반) - 230원/분
  [
    { totalMin: 215,  fee: 45000,  rate: 209.3 },
    { totalMin: 1548, fee: 300000, rate: 193.8 },
    { totalMin: 258,  fee: 50000,  rate: 193.8 },
    { totalMin: 1935, fee: 320000, rate: 165.4 },
  ],
];

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

function fmtNum(n) {
  return Math.round(n).toLocaleString('ko-KR');
}

export default function FieldStatistics({ selectedRateIdx, onSelect }) {
  const [selectedField, setSelectedField] = useState(0);
  const tabsRef = useRef(null);
  const prevRateIdx = useRef('');

  useEffect(() => {
    if (selectedRateIdx === '' || selectedRateIdx === prevRateIdx.current) return;
    prevRateIdx.current = selectedRateIdx;
    const idx = Number(selectedRateIdx);
    if (!isNaN(idx) && idx >= 0 && idx < 13) {
      setSelectedField(idx);
      setTimeout(() => {
        const btn = tabsRef.current?.children[idx];
        if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 50);
    }
  }, [selectedRateIdx]);

  const rows = STATIC_STATS[selectedField];

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
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem', padding: '14px 0' }}>해당 분야 데이터 없음</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {rows.map(({ totalMin, fee, rate }, rowIdx) => {
            const combo = factorizeMinutes(totalMin);
            const canFill = combo !== null;

            return (
              <div
                key={totalMin}
                onClick={() => {
                  if (!canFill || !onSelect) return;
                  onSelect({ rateIdx: selectedField, dm: combo.dm, wc: combo.wc, wk: '4.3', fee });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 6px',
                  borderBottom: rowIdx < rows.length - 1 ? '1px solid #f3f4f6' : 'none',
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
                </div>

                {/* 교습비 */}
                <div style={{ flexShrink: 0, fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                  {fmtNum(fee)}원
                </div>

                {/* 분당단가 */}
                <div style={{
                  flexShrink: 0,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: rate === null ? '#9ca3af' : '#4338ca',
                  minWidth: '68px',
                  textAlign: 'right',
                }}>
                  {rate !== null ? `${rate.toFixed(1)}원/분` : '—'}
                </div>
              </div>
            );
          })}

          {/* 기준단가 안내 */}
          <div style={{
            marginTop: '10px',
            textAlign: 'center',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: '#4338ca',
            backgroundColor: '#eef2ff',
            border: '1.5px solid #c7d2fe',
            borderRadius: '8px',
            padding: '7px 12px',
          }}>
            {FIELD_FOOTER_LABELS[selectedField]} : {FIELD_RATES[selectedField]}원/분
          </div>
        </div>
      )}
    </div>
  );
}
