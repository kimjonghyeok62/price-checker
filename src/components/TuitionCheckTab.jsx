import React, { useState } from 'react';

// ── 원본 참고값 데이터 (모든 분야) ─────────────────────────────
const ALL_STATS_RAW = [
  // 0: 단과(초등) - 210
  [
    { totalMin: 1290, fee: 270000, rate: 209.3 },
    { totalMin: 1548, fee: 280000, rate: 180.9 },
    { totalMin:  774, fee: 160000, rate: 206.7 },
    { totalMin: 1161, fee: 220000, rate: 189.5 },
    { totalMin: 1032, fee: 200000, rate: 193.8 },
  ],
  // 1: 단과(중등) - 222
  [
    { totalMin: 1548, fee: 300000, rate: 193.8 },
    { totalMin: 1290, fee: 250000, rate: 193.8 },
    { totalMin: 1935, fee: 300000, rate: 155.0 },
    { totalMin: 2322, fee: 370000, rate: 159.3 },
  ],
  // 2: 단과(고등) - 234
  [
    { totalMin: 2322, fee: 450000, rate: 193.8 },
    { totalMin: 1548, fee: 360000, rate: 232.6 },
    { totalMin: 1935, fee: 350000, rate: 180.9 },
    { totalMin: 1806, fee: 400000, rate: 221.5 },
    { totalMin: 2064, fee: 400000, rate: 193.8 },
  ],
  // 3: 진학상담·지도 - 234
  [
    { totalMin: 1548, fee: 300000, rate: 193.8 },
    { totalMin: 2322, fee: 500000, rate: 215.3 },
    { totalMin:  800, fee: 100000, rate: 125.0 },
    { totalMin: 1032, fee: 150000, rate: 145.3 },
    { totalMin: 1935, fee: 390000, rate: 201.6 },
  ],
  // 4: 어학 - 259
  [
    { totalMin: 1548, fee: 325000, rate: 209.9 },
    { totalMin: 1677, fee: 380000, rate: 226.6 },
    { totalMin:  688, fee: 170000, rate: 247.1 },
    { totalMin: 1935, fee: 350000, rate: 180.9 },
    { totalMin: 1032, fee: 242000, rate: 234.5 },
  ],
  // 5: 음악(유초중고) - 224
  [
    { totalMin:  774, fee: 160000, rate: 206.7 },
    { totalMin:  860, fee: 160000, rate: 186.0 },
    { totalMin:  645, fee: 140000, rate: 217.1 },
    { totalMin: 1260, fee: 140000, rate: 111.1 },
    { totalMin: 1032, fee: 220000, rate: 213.2 },
  ],
  // 6: 음악(입시) - 336
  [
    { totalMin:  774, fee: 210000, rate: 271.3 },
    { totalMin:  516, fee: 170000, rate: 329.5 },
    { totalMin:  645, fee: 180000, rate: 279.1 },
    { totalMin: 1290, fee: 300000, rate: 232.6 },
    { totalMin: 1548, fee: 250000, rate: 161.5 },
  ],
  // 7: 미술(유초중고) - 212
  [
    { totalMin:  774, fee: 130000, rate: 168.0 },
    { totalMin:  516, fee:  80000, rate: 155.0 },
    { totalMin: 1032, fee: 170000, rate: 164.7 },
    { totalMin:  387, fee:  65000, rate: 168.0 },
    { totalMin: 1260, fee: 130000, rate: 103.2 },
  ],
  // 8: 미술(입시) - 255
  [
    { totalMin: 3096, fee: 530000, rate: 171.2 },
    { totalMin: 6192, fee: 990000, rate: 159.9 },
    { totalMin: 4128, fee: 700000, rate: 169.6 },
    { totalMin: 5160, fee: 850000, rate: 164.7 },
    { totalMin: 1032, fee: 210000, rate: 203.5 },
  ],
  // 9: 무용(유초중고) - 212
  [
    { totalMin: 774, fee: 120000, rate: 155.0 },
    { totalMin: 645, fee: 110000, rate: 170.5 },
  ],
  // 10: 무용(입시) - 255
  [
    { totalMin:  774, fee: 197000, rate: 254.5 },
    { totalMin:  516, fee: 110000, rate: 213.2 },
    { totalMin:  387, fee:  98000, rate: 253.2 },
    { totalMin: 1161, fee: 296000, rate: 255.0 },
    { totalMin:  258, fee:  65000, rate: 251.9 },
  ],
  // 11: 정보(일반) - 230
  [
    { totalMin: 3600, fee: 397200, rate: 110.3 },
    { totalMin: 1890, fee: 350000, rate: 185.2 },
    { totalMin: 4128, fee: 400000, rate:  96.9 },
    { totalMin: 4800, fee: 480000, rate: 100.0 },
    { totalMin: 2580, fee: 200000, rate:  77.5 },
  ],
  // 12: 기타(일반) - 230
  [
    { totalMin:  215, fee:  45000, rate: 209.3 },
    { totalMin: 1548, fee: 300000, rate: 193.8 },
    { totalMin:  258, fee:  50000, rate: 193.8 },
    { totalMin: 1935, fee: 320000, rate: 165.4 },
  ],
];

// ── 총교습시간(분)으로 조합 사례 생성 ────────────────────────────
// 학원 운영에서 실제 가능한 범위: dm 30~180분, wc 1~7회, wk 4/4.2/4.3주
const DM_COMMON = [30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180];
const WC_COMMON = [1, 2, 3, 4, 5, 6, 7];
const WK_OPTIONS = [
  { val: 4.3, label: '4.3주' },
  { val: 4.2, label: '4.2주' },
  { val: 4.0, label: '4주'   },
];

function buildCombos(totalMin) {
  const results = [];
  for (const { val: wk, label: wkLabel } of WK_OPTIONS) {
    const weeklyMin = totalMin / wk;
    for (const dm of DM_COMMON) {
      for (const wc of WC_COMMON) {
        if (Math.abs(dm * wc - weeklyMin) < 0.6) {
          results.push({ dm, wc, wkLabel, wk });
        }
      }
    }
  }
  // 중복 제거 후 최대 3개: wc 2~5 우선, 그 다음 wk 4.3 우선
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = `${r.dm}-${r.wc}-${r.wk}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a, b) => {
    const aOk = a.wc >= 2 && a.wc <= 5 ? 0 : 1;
    const bOk = b.wc >= 2 && b.wc <= 5 ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    return b.wk - a.wk;
  });
  return deduped.slice(0, 3);
}

// ── 전체 참고값을 중복 없이(totalMin 기준) 내림차순 정렬 ──────────
function buildUniqueRows() {
  const map = new Map();
  ALL_STATS_RAW.forEach(fieldArr =>
    fieldArr.forEach(({ totalMin, fee, rate }) => {
      if (!map.has(totalMin)) map.set(totalMin, { totalMin, fee, rate });
    })
  );
  return [...map.values()].sort((a, b) => b.totalMin - a.totalMin);
}

const BASE_ROWS = buildUniqueRows().map(r => ({
  ...r,
  combos: buildCombos(r.totalMin),
  weeklyMin: null, // 대표 주당 분: 첫 번째 combo 기준
}));

// ── 주당 분 대표값 (첫 번째 combo 기준) ──────────────────────────
BASE_ROWS.forEach(row => {
  if (row.combos.length > 0) {
    row.weeklyMin = row.combos[0].dm * row.combos[0].wc;
  } else {
    row.weeklyMin = Math.round(row.totalMin / 4.3);
  }
});

// ── 자주 인용되는 교습비 (fee 빈도 기준 Top) ─────────────────────
function buildFreqRows() {
  const feeMap = new Map();
  ALL_STATS_RAW.forEach(fieldArr =>
    fieldArr.forEach(({ totalMin, fee, rate }) => {
      if (!feeMap.has(fee)) feeMap.set(fee, { fee, totalMin, rate, count: 0 });
      feeMap.get(fee).count += 1;
    })
  );
  return [...feeMap.values()]
    .sort((a, b) => b.fee - a.fee);
}

const FREQ_ROWS = buildFreqRows();

// ── 숫자 포맷 ─────────────────────────────────────────────────
function fmtNum(n) { return Number(n).toLocaleString('ko-KR'); }

// ── 스타일 상수 ───────────────────────────────────────────────
const TH = {
  padding: '7px 10px',
  background: '#f1f5ff',
  color: '#374151',
  fontWeight: 700,
  fontSize: '0.82rem',
  borderBottom: '2px solid #c7d2fe',
  whiteSpace: 'nowrap',
  textAlign: 'center',
};
const TD_BASE = {
  padding: '6px 10px',
  fontSize: '0.83rem',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'middle',
  textAlign: 'center',
};
const TABLE_STYLE = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.83rem',
};

export default function TuitionCheckTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px' }}>

      {/* ── 섹션 1: 총교습시간별 참고표 ── */}
      <div>
        <SectionTitle>총 교습시간별 참고표</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE_STYLE}>
            <colgroup>
              <col style={{ width: '90px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '70px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={TH}>주당(분)</th>
                <th style={{ ...TH, background: '#e8f0fe' }}>일(분)</th>
                <th style={{ ...TH, background: '#e8f0fe' }}>주(회)</th>
                <th style={{ ...TH, background: '#e8f0fe' }}>월(주)</th>
                <th style={TH}>총교습시간<br />(분)</th>
              </tr>
            </thead>
            <tbody>
              {BASE_ROWS.map((row, idx) => {
                const bg = idx % 2 === 0 ? '#fff' : '#fafafa';
                const combo1 = row.combos[0];

                return (
                  <tr key={row.totalMin} style={{ background: bg }}>
                    <td style={{ ...TD_BASE, color: '#4b5563' }}>
                      {combo1 ? fmtNum(combo1.dm * combo1.wc) : Math.round(row.totalMin / 4.3)}
                    </td>
                    <td style={{ ...TD_BASE, background: '#f0f5ff', fontWeight: 600, color: '#1d4ed8' }}>
                      {combo1 ? combo1.dm : '-'}
                    </td>
                    <td style={{ ...TD_BASE, background: '#f0f5ff', fontWeight: 600, color: '#1d4ed8' }}>
                      {combo1 ? combo1.wc : '-'}
                    </td>
                    <td style={{ ...TD_BASE, background: '#f0f5ff', fontWeight: 600, color: '#1d4ed8' }}>
                      {combo1 ? combo1.wkLabel : '-'}
                    </td>
                    <td style={{ ...TD_BASE, fontWeight: 700, color: '#1e3a8a' }}>
                      {fmtNum(row.totalMin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 섹션 2: 교습비 기준 참고표 ── */}
      <div>
        <SectionTitle>교습비 기준 참고표 <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6b7280' }}>(교습비 높은 순)</span></SectionTitle>
        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 10px', lineHeight: 1.6 }}>
          학원 운영자가 제출한 교습비와 총교습시간을 빠르게 대조할 수 있습니다.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE_STYLE}>
            <colgroup>
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...TH, background: '#fef9ee' }}>교습비(원)</th>
                <th style={TH}>총교습시간(분)</th>
                <th style={TH}>분당단가(원/분)</th>
              </tr>
            </thead>
            <tbody>
              {FREQ_ROWS.map((row, idx) => (
                <tr key={row.fee} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...TD_BASE, fontWeight: 700, color: '#92400e', background: '#fefce8' }}>
                    {fmtNum(row.fee)}
                  </td>
                  <td style={{ ...TD_BASE, fontWeight: 600, color: '#1e3a8a' }}>
                    {fmtNum(row.totalMin)}
                  </td>
                  <td style={{
                    ...TD_BASE,
                    fontWeight: 600,
                    color: row.rate >= 200 ? '#dc2626' : row.rate >= 150 ? '#374151' : '#9ca3af',
                  }}>
                    {row.rate.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 섹션 3: 시간 조합 계산기 ── */}
      <ComboCalc />

    </div>
  );
}

// ── 섹션 제목 ─────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e3a8a', borderBottom: '2px solid #c7d2fe', paddingBottom: '5px', marginBottom: '10px' }}>
      {children}
    </div>
  );
}

// ── 섹션 3: 조합 계산기 ───────────────────────────────────────
function ComboCalc() {
  const [dm, setDm] = useState('60');
  const [wc, setWc] = useState('5');
  const [wk, setWk] = useState('4.3');

  const dmNum = parseFloat(dm) || 0;
  const wcNum = parseFloat(wc) || 0;
  const wkNum = parseFloat(wk) || 0;
  const totalMin = dmNum && wcNum && wkNum ? Math.round(dmNum * wcNum * wkNum) : null;
  const weeklyMin = dmNum && wcNum ? dmNum * wcNum : null;

  const inputStyle = {
    width: '70px', border: '1px solid #d1d5db', borderRadius: '6px',
    padding: '5px 8px', fontSize: '0.9rem', textAlign: 'center', outline: 'none',
  };
  const labelStyle = { fontSize: '0.85rem', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' };

  return (
    <div style={{ background: '#f0f5ff', borderRadius: '10px', border: '1px solid #c7d2fe', padding: '16px 20px' }}>
      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '12px' }}>
        총 교습시간 계산기
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={labelStyle}>일</span>
          <input value={dm} onChange={e => setDm(e.target.value)} style={inputStyle} placeholder="60" />
          <span style={labelStyle}>분</span>
        </div>
        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={labelStyle}>주</span>
          <input value={wc} onChange={e => setWc(e.target.value)} style={inputStyle} placeholder="5" />
          <span style={labelStyle}>회</span>
        </div>
        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select value={wk} onChange={e => setWk(e.target.value)} style={{ ...inputStyle, width: '80px' }}>
            <option value="4.3">4.3주</option>
            <option value="4.2">4.2주</option>
            <option value="4.0">4주</option>
          </select>
        </div>
        <span style={{ color: '#9ca3af', fontWeight: 700 }}>=</span>
        <div style={{
          background: totalMin ? '#1e3a8a' : '#e5e7eb',
          color: totalMin ? '#fff' : '#9ca3af',
          borderRadius: '8px', padding: '7px 18px',
          fontSize: '1.05rem', fontWeight: 700, minWidth: '110px', textAlign: 'center',
          transition: 'background 0.2s',
        }}>
          {totalMin ? <>{totalMin.toLocaleString('ko-KR')} <span style={{ fontSize: '0.78rem', fontWeight: 400 }}>분</span></> : '—'}
        </div>
        {weeklyMin && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280', alignSelf: 'center' }}>
            (주당 {weeklyMin}분)
          </div>
        )}
      </div>
    </div>
  );
}
