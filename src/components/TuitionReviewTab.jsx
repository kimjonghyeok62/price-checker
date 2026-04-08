import React, { useState } from 'react';

// ─── 기준단가 옵션 ───────────────────────────────────────────
const STANDARD_RATE_OPTIONS = [
  { label: '보습 — 단과(초등)', rate: 210 },
  { label: '보습 — 단과(중등)', rate: 222 },
  { label: '보습 — 단과(고등)', rate: 234 },
  { label: '진학상담, 지도', rate: 234 },
  { label: '어학 (실용외국어 포함)', rate: 259 },
  { label: '음악 — 유,초,중,고', rate: 224 },
  { label: '음악 — 입시', rate: 336 },
  { label: '미술 — 유,초,중,고', rate: 212 },
  { label: '미술 — 입시', rate: 255 },
  { label: '무용 — 유,초,중,고', rate: 212 },
  { label: '무용 — 입시', rate: 255 },
  { label: '정보 — 일반', rate: 230 },
  { label: '기타 — 일반', rate: 230 },
];

export default function TuitionReviewTab() {
  return (
    <div>
      <QuickCalcCard />
    </div>
  );
}

// ─── 프리셋 선택 + 직접입력 전환 컴포넌트 ─────────────────────
function PresetPicker({ value, onChange, presets, width = '72px', unit = '' }) {
  const [custom, setCustom] = useState(false);
  const SENTINEL = '__custom__';

  const inputStyle = {
    width, textAlign: 'center', padding: '2px 4px',
    border: 'none', borderBottom: '2px solid var(--primary)', borderRadius: 0,
    background: 'transparent', fontSize: '1.05rem', fontWeight: '700',
    color: 'var(--primary)', outline: 'none', fontFamily: 'inherit',
  };
  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
    width: `calc(${width} + 4px)`,
  };

  if (custom) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus
          style={inputStyle}
        />
        <button
          onClick={() => { setCustom(false); onChange(''); }}
          title="목록으로"
          style={{ padding: '0 4px', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1 }}
        >↩</button>
      </span>
    );
  }

  return (
    <select
      value={value === '' || value == null ? '' : String(value)}
      onChange={e => {
        if (e.target.value === SENTINEL) { setCustom(true); onChange(''); }
        else onChange(e.target.value);
      }}
      style={selectStyle}
    >
      <option value="" disabled>선택</option>
      {presets.map(p => (
        <option key={p} value={String(p)}>{p}{unit}</option>
      ))}
      <option value={SENTINEL}>직접입력</option>
    </select>
  );
}

// ─── 수동 계산 카드 ──────────────────────────────────────────
function QuickCalcCard() {
  const [dm, setDm] = useState('');
  const [wc, setWc] = useState('');
  const [wk, setWk] = useState('');
  const [fee, setFee] = useState('');
  const [rateIdx, setRateIdx] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  function reset() {
    setDm(''); setWc(''); setWk(''); setFee(''); setRateIdx(0);
    setResetKey(k => k + 1);
  }

  const wkVal = wk === '' ? 4.3 : parseFloat(wk) || 0;
  const totalMinutes = Math.round((parseFloat(dm)||0) * (parseFloat(wc)||0) * wkVal);
  const calcRate = totalMinutes > 0 ? (parseFloat(fee)||0) / totalMinutes : 0;
  const calcRateRounded = Math.round(calcRate * 10) / 10;
  const standardRate = STANDARD_RATE_OPTIONS[rateIdx].rate;
  const standardLabel = STANDARD_RATE_OPTIONS[rateIdx].label;
  const canJudge = totalMinutes > 0 && (parseFloat(fee) || 0) > 0;
  const isCompliant = calcRate <= standardRate;

  let recDailyMin = null, recTotalMin = null, recMaxFee = null;
  if (canJudge && !isCompliant) {
    recTotalMin = Math.ceil((parseFloat(fee)||0) / standardRate);
    recDailyMin = Math.ceil(recTotalMin / ((parseFloat(wc)||1) * (wkVal||1)));
    recMaxFee = Math.floor(standardRate * totalMinutes);
  }

  const borderColor = !canJudge ? 'var(--border-color)' : isCompliant ? '#bbf7d0' : '#fca5a5';
  const bgColor     = !canJudge ? 'var(--bg-card)'     : isCompliant ? '#f0fdf4' : '#fff1f2';
  const badgeBg     = !canJudge ? '#94a3b8'            : isCompliant ? '#16a34a' : '#dc2626';

  return (
    <div style={{ borderRadius: '14px', overflow: 'hidden', border: `2px solid ${borderColor}`, boxShadow: 'var(--shadow-sm)' }}>
      {/* 헤더 */}
      <div style={{ padding: '11px 16px', backgroundColor: bgColor, borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-main)' }}>분야별 교습비 검토</span>
          <button onClick={reset}
            style={{ padding: '3px 12px', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-muted)', background: 'transparent', border: '1.5px solid var(--border-color)', borderRadius: '20px', cursor: 'pointer', lineHeight: '1.6', marginLeft: '6px' }}>
            🔄 초기화
          </button>
        </div>
        <span style={{ fontWeight: '700', fontSize: '1rem', padding: '3px 10px', borderRadius: '20px', backgroundColor: badgeBg, color: '#fff' }}>
          {!canJudge ? '입력중' : isCompliant ? '✅ 적합' : '❌ 부적합'}
        </span>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* 교습 분야 선택 */}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--primary)', flexShrink: 0 }} />
            교습 분야 선택
          </div>
          <select value={rateIdx} onChange={e => setRateIdx(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', border: '2.5px solid var(--primary)', borderRadius: '10px', fontSize: '1rem', fontWeight: '700', background: '#eff6ff', color: 'var(--primary)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' }}>
            {STANDARD_RATE_OPTIONS.map((o, i) => (
              <option key={i} value={i}>{o.label} ({o.rate}원/분)</option>
            ))}
          </select>
        </div>

        {/* 입력값 */}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--text-muted)', flexShrink: 0 }} />
            입력값 (수정 가능)
          </div>
          <div style={{ fontSize: '1rem', lineHeight: '2.3', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f0f4ff', border: '1px solid #c7d2fe', color: 'var(--text-main)' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
              <span>일</span>
              <PresetPicker key={`dm-${resetKey}`} value={dm} onChange={setDm}
                presets={[50, 60, 80, 90, 120]} width="60px" />
              <span>분 × 주</span>
              <PresetPicker key={`wc-${resetKey}`} value={wc} onChange={setWc}
                presets={[1, 2, 3, 4, 5]} width="48px" />
              <span>회 ×</span>
              <PresetPicker key={`wk-${resetKey}`} value={wk} onChange={setWk}
                presets={[4, 4.2, 4.3]} width="52px" />
              <span>주 =</span>
              <strong style={{ color: '#1e40af', marginLeft: '4px' }}>{totalMinutes.toLocaleString()}분</strong>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '4px' }}>(자동계산)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span>교습비</span>
              <input type="text" inputMode="numeric"
                value={fee === '' ? '' : Number(fee).toLocaleString()}
                onChange={e => {
                  const raw = e.target.value.replace(/,/g, '');
                  if (raw === '' || /^\d+$/.test(raw)) setFee(raw);
                }}
                style={{ width: '110px', textAlign: 'right', padding: '2px 4px', border: 'none', borderBottom: '2px solid var(--primary)', borderRadius: 0, background: 'transparent', fontSize: '1.05rem', fontWeight: '700', color: 'var(--primary)', outline: 'none', fontFamily: 'inherit' }}
              />
              <span>원</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>분당단가(B÷A):</span>
              <strong style={{ color: !canJudge ? 'var(--text-muted)' : isCompliant ? '#16a34a' : '#dc2626' }}>{calcRateRounded}원</strong>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>(자동계산)</span>
            </div>
          </div>
        </div>

        {/* 검토 결과 */}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '700', letterSpacing: '0.04em', marginBottom: '8px', color: !canJudge ? 'var(--text-muted)' : isCompliant ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '3px', height: '14px', borderRadius: '2px', backgroundColor: !canJudge ? 'var(--text-muted)' : isCompliant ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
            검토 결과
          </div>
          <div style={{ fontSize: '1rem', lineHeight: '1.9', padding: '10px 14px', borderRadius: '8px', backgroundColor: !canJudge ? '#f8fafc' : isCompliant ? '#f0fdf4' : '#fff5f5', border: `1px solid ${!canJudge ? 'var(--border-color)' : isCompliant ? '#bbf7d0' : '#fca5a5'}`, color: 'var(--text-main)' }}>
            <div>실제 계산: {(parseFloat(fee)||0).toLocaleString()} ÷ {totalMinutes.toLocaleString()} = <strong>{calcRateRounded}원/분</strong></div>
            <div>기준 단가: <strong>{standardRate}원/분</strong> <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({standardLabel})</span></div>
            {canJudge && (
              <div style={{ fontWeight: '700', fontSize: '1.05rem', color: isCompliant ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                {calcRateRounded}원 {isCompliant ? '≤' : '>'} {standardRate}원 → {isCompliant ? '✅ 적합' : '❌ 기준 초과'}
              </div>
            )}
          </div>
        </div>

        {/* 조정 방안 — 부적합일 때만 */}
        {!isCompliant && recDailyMin !== null && (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#92400e', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '3px', height: '14px', borderRadius: '2px', backgroundColor: '#f59e0b', flexShrink: 0 }} />
              조정 방안
            </div>
            <div style={{ backgroundColor: '#fff7ed', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fed7aa', fontSize: '1rem', lineHeight: '1.9', color: '#78350f' }}>
              <div>• 교습비 <strong>{(parseFloat(fee)||0).toLocaleString()}원</strong> 유지 시</div>
              <div style={{ paddingLeft: '14px', color: '#92400e' }}>→ 일 교습시간 <strong>{recDailyMin}분 이상</strong>으로 조정 필요 <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>(총 {recTotalMin?.toLocaleString()}분)</span></div>
              <div style={{ marginTop: '4px' }}>• 교습시간 <strong>{totalMinutes.toLocaleString()}분</strong> 유지 시</div>
              <div style={{ paddingLeft: '14px', color: '#92400e' }}>→ 교습비 <strong>{recMaxFee?.toLocaleString()}원 이하</strong>로 조정 필요</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
