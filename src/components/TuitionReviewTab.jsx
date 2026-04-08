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
  return <QuickCalcCard />;
}

// ─── 프리셋 선택 + 직접입력 전환 컴포넌트 ─────────────────────
function PresetPicker({ value, onChange, presets, width = '60px' }) {
  const [custom, setCustom] = useState(false);
  const SENTINEL = '__custom__';

  const baseStyle = {
    width, textAlign: 'center', padding: '2px 2px',
    border: 'none', borderBottom: '2px solid var(--primary)', borderRadius: 0,
    background: 'transparent', fontSize: '0.92rem', fontWeight: '700',
    color: 'var(--primary)', outline: 'none', fontFamily: 'inherit',
  };

  if (custom) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          autoFocus style={baseStyle} />
        <button onClick={() => { setCustom(false); onChange(''); }}
          style={{ padding: '0 3px', fontSize: '0.9rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1 }}>↩</button>
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
      style={{ ...baseStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
    >
      <option value="" disabled>선택</option>
      {presets.map(p => <option key={p} value={String(p)}>{p}</option>)}
      <option value={SENTINEL}>직접입력</option>
    </select>
  );
}

// ─── 수동 계산 카드 ──────────────────────────────────────────
function QuickCalcCard() {
  const [dm, setDm] = useState('');
  const [wc, setWc] = useState('');
  const [wk, setWk] = useState('4.3');
  const [fee, setFee] = useState('');
  const [rateIdx, setRateIdx] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [records, setRecords] = useState([]);

  function reset() {
    setDm(''); setWc(''); setWk('4.3'); setFee(''); setRateIdx(0);
    setResetKey(k => k + 1);
  }

  function saveRecord() {
    if (!canJudge) return;
    setRecords(prev => [...prev, {
      no: prev.length + 1,
      label: STANDARD_RATE_OPTIONS[rateIdx].label,
      standardRate: STANDARD_RATE_OPTIONS[rateIdx].rate,
      dm: parseFloat(dm) || 0,
      wc: parseFloat(wc) || 0,
      wk: wkVal,
      totalMinutes,
      fee: parseFloat(fee) || 0,
      rate: calcRateRounded,
      rateDisplay: calcRateDisplay,
      isCompliant,
    }]);
    reset();
  }

  function deleteRecord(no) {
    setRecords(prev => prev.filter(r => r.no !== no));
  }

  const wkVal = parseFloat(wk) || 0;
  const totalMinutes = Math.round((parseFloat(dm)||0) * (parseFloat(wc)||0) * wkVal);
  const calcRate = totalMinutes > 0 ? (parseFloat(fee)||0) / totalMinutes : 0;
  const calcRateRounded = Math.round(calcRate * 10) / 10;
  const calcRateDisplay = calcRateRounded.toLocaleString('ko-KR');
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

  const sectionLabel = (text, color = 'var(--text-muted)', barColor = 'var(--text-muted)') => (
    <div style={{ fontSize: '0.95rem', fontWeight: '700', color, letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ display: 'inline-block', width: '3px', height: '14px', borderRadius: '2px', backgroundColor: barColor, flexShrink: 0 }} />
      {text}
    </div>
  );

  return (
    <div className="tuition-card" style={{ borderRadius: '14px', overflow: 'hidden', border: `2px solid ${borderColor}`, boxShadow: 'var(--shadow-sm)' }}>

      {/* 헤더 */}
      <div style={{ padding: '12px 14px', backgroundColor: bgColor, borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>분야별 교습비 검토</span>
          <span style={{ fontWeight: '700', fontSize: '1rem', padding: '4px 12px', borderRadius: '20px', backgroundColor: badgeBg, color: '#fff', whiteSpace: 'nowrap', marginLeft: '8px' }}>
            {!canJudge ? '입력중' : isCompliant ? '✅ 적합' : '❌ 부적합'}
          </span>
        </div>
      </div>

      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* 교습 분야 선택 */}
        <div>
          {sectionLabel('교습 분야 선택', 'var(--primary)', 'var(--primary)')}
          <select value={rateIdx} onChange={e => setRateIdx(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', border: '2.5px solid var(--primary)', borderRadius: '10px', fontSize: '1rem', fontWeight: '700', background: '#eff6ff', color: 'var(--primary)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' }}>
            {STANDARD_RATE_OPTIONS.map((o, i) => (
              <option key={i} value={i}>{o.label} ({o.rate}원/분)</option>
            ))}
          </select>
        </div>

        {/* 입력값 */}
        <div>
          {sectionLabel('입력값 (수정 가능)')}
          <div style={{ fontSize: '0.97rem', lineHeight: '2.3', padding: '12px 14px', borderRadius: '8px', backgroundColor: '#f0f4ff', border: '1px solid #c7d2fe', color: 'var(--text-main)' }}>

            {/* A: 교습시간 */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3px' }}>
              <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <strong style={{ color: 'var(--primary)' }}>A(분)</strong>
                <span> : 일</span>
                <PresetPicker key={`dm-${resetKey}`} value={dm} onChange={setDm} presets={[50, 60, 80, 90, 120]} width="46px" max={999} />
                <span>분</span>
              </span>
              <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <span>×</span>
                <span>주</span>
                <PresetPicker key={`wc-${resetKey}`} value={wc} onChange={setWc} presets={[1, 2, 3, 4, 5]} width="34px" max={7} />
                <span>회</span>
              </span>
              <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <span>×</span>
                <PresetPicker key={`wk-${resetKey}`} value={wk} onChange={setWk} presets={[4, 4.2, 4.3]} width="46px" />
                <span>주</span>
              </span>
              <span className="time-break" />
              <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '2px' }}>
                <span>=</span>
                <strong style={{ color: '#1e40af' }}>{totalMinutes.toLocaleString()}분</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>(자동계산)</span>
              </span>
            </div>

            {/* B: 교습비 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--primary)' }}>B(교습비)</strong>
              <span> : </span>
              <input type="text" inputMode="numeric"
                value={fee === '' ? '' : Number(fee).toLocaleString()}
                onChange={e => {
                  const raw = e.target.value.replace(/,/g, '');
                  if (raw === '' || /^\d+$/.test(raw)) setFee(raw);
                }}
                style={{ width: '130px', textAlign: 'right', padding: '2px 4px', border: 'none', borderBottom: '2px solid var(--primary)', borderRadius: 0, background: 'transparent', fontSize: '1.05rem', fontWeight: '700', color: 'var(--primary)', outline: 'none', fontFamily: 'inherit' }}
              />
              <span>원</span>
            </div>

            {/* 분당단가 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>분당단가 (B÷A):</span>
              <strong style={{ color: !canJudge ? 'var(--text-muted)' : isCompliant ? '#16a34a' : '#dc2626', fontSize: '1.1rem' }}>
                {calcRateDisplay}원
              </strong>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>(자동계산)</span>
            </div>
          </div>

          {/* 기록저장 버튼 */}
          <button
            onClick={saveRecord}
            disabled={!canJudge}
            style={{ marginTop: '10px', width: '100%', padding: '11px', backgroundColor: canJudge ? 'var(--primary)' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '700', cursor: canJudge ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            📋 기록저장 (저장 후 초기화)
          </button>
        </div>

        {/* 검토 결과 */}
        <div>
          {sectionLabel('검토 결과',
            !canJudge ? 'var(--text-muted)' : isCompliant ? '#166534' : '#991b1b',
            !canJudge ? 'var(--text-muted)' : isCompliant ? '#16a34a' : '#dc2626'
          )}
          <div style={{ fontSize: '1rem', lineHeight: '2', padding: '12px 14px', borderRadius: '8px', backgroundColor: !canJudge ? '#f8fafc' : isCompliant ? '#f0fdf4' : '#fff5f5', border: `1px solid ${!canJudge ? 'var(--border-color)' : isCompliant ? '#bbf7d0' : '#fca5a5'}`, color: 'var(--text-main)' }}>
            <div>실제 계산: {(parseFloat(fee)||0).toLocaleString()} ÷ {totalMinutes.toLocaleString()} = <strong>{calcRateDisplay}원/분</strong></div>
            <div>기준 단가: <strong>{standardRate}원/분</strong> <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>({standardLabel})</span></div>
            {canJudge && (
              <div style={{ fontWeight: '700', fontSize: '1.05rem', color: isCompliant ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                {calcRateDisplay}원 {isCompliant ? '≤' : '>'} {standardRate}원 → {isCompliant ? '✅ 적합' : '❌ 기준 초과'}
              </div>
            )}
          </div>
        </div>

        {/* 조정 방안 */}
        {!isCompliant && recDailyMin !== null && (
          <div>
            {sectionLabel('조정 방안', '#92400e', '#f59e0b')}
            <div style={{ backgroundColor: '#fff7ed', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fed7aa', fontSize: '1rem', lineHeight: '2', color: '#78350f' }}>
              <div>• 교습비 <strong>{(parseFloat(fee)||0).toLocaleString()}원</strong> 유지 시</div>
              <div style={{ paddingLeft: '14px', color: '#92400e' }}>→ 일 교습시간 <strong>{recDailyMin}분 이상</strong>으로 조정 필요 <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>(총 {recTotalMin?.toLocaleString()}분)</span></div>
              <div style={{ marginTop: '4px' }}>• 교습시간 <strong>{totalMinutes.toLocaleString()}분</strong> 유지 시</div>
              <div style={{ paddingLeft: '14px', color: '#92400e' }}>→ 교습비 <strong>{recMaxFee?.toLocaleString()}원 이하</strong>로 조정 필요</div>
            </div>
          </div>
        )}

        {/* 저장된 기록 목록 */}
        {records.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e40af', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '3px', height: '14px', borderRadius: '2px', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                저장된 기록
              </div>
              <button onClick={() => setRecords([])}
                style={{ padding: '3px 10px', fontSize: '0.88rem', fontWeight: '700', color: '#dc2626', background: 'transparent', border: '1.5px solid #fca5a5', borderRadius: '20px', cursor: 'pointer', lineHeight: '1.6' }}>
                🗑 기록 초기화
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {records.map(r => (
                <RecordRow key={r.no} record={r} onDelete={deleteRecord} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── 기록 행 컴포넌트 ────────────────────────────────────────
function RecordRow({ record: r, onDelete }) {
  const color = r.isCompliant ? '#166534' : '#991b1b';
  const bg    = r.isCompliant ? '#f0fdf4' : '#fff5f5';
  const border= r.isCompliant ? '#bbf7d0' : '#fca5a5';

  return (
    <div style={{ borderRadius: '10px', border: `1.5px solid ${border}`, backgroundColor: bg, padding: '10px 12px', position: 'relative' }}>
      {/* 번호 + 삭제 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontWeight: '800', fontSize: '0.88rem', color: '#64748b' }}>#{r.no}</span>
        <button onClick={() => onDelete(r.no)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
      </div>

      {/* PC: 한 줄 / 모바일: 두 줄 */}
      <div className="record-row-inner">
        <span className="record-chip field">{r.label}</span>
        <span className="record-chip time">{r.dm}분 × 주{r.wc}회 × {r.wk}주 = <strong>{r.totalMinutes.toLocaleString()}분</strong></span>
        <span className="record-chip fee">교습비 <strong>{r.fee.toLocaleString()}원</strong></span>
        <span className="record-chip rate" style={{ color, fontWeight: '700' }}>분당단가 <strong>{r.rateDisplay}원</strong> {r.isCompliant ? '✅' : '❌'}</span>
      </div>
    </div>
  );
}
