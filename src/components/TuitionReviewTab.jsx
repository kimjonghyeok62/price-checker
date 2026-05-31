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

export default function TuitionReviewTab({ mode = 'academy' }) {
  const isTutoring = mode === 'tutoring';

  const [subjects, setSubjects] = useState([
    { id: 1, rateIdx: 0, dm: '', wc: '', wk: '', fee: '', isEditingRate: !isTutoring }
  ]);

  function addSubject() {
    setSubjects(prev => [
      ...prev,
      { id: Date.now(), rateIdx: 0, dm: '', wc: '', wk: '', fee: '', isEditingRate: !isTutoring }
    ]);
  }

  function updateSubject(id, key, val) {
    setSubjects(prev => prev.map(sub => {
      if (sub.id === id) {
        return { ...sub, [key]: val };
      }
      return sub;
    }));
  }

  function removeSubject(id) {
    if (subjects.length === 1) {
      setSubjects([{ id: 1, rateIdx: 0, dm: '', wc: '', wk: '', fee: '', isEditingRate: !isTutoring }]);
      return;
    }
    setSubjects(prev => prev.filter(sub => sub.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {subjects.map((sub, idx) => (
        <SubjectCard 
          key={sub.id} 
          index={idx}
          sub={sub} 
          mode={mode}
          onUpdate={updateSubject} 
          onRemove={removeSubject}
          isLast={idx === subjects.length - 1}
          onAdd={addSubject}
        />
      ))}
    </div>
  );
}

// ─── 프리셋 선택 + 직접입력 전환 컴포넌트 ─────────────────────
function PresetPicker({ value, onChange, presets, width = '55px' }) {
  const [custom, setCustom] = useState(false);
  const SENTINEL = '__custom__';

  const baseStyle = {
    width, textAlign: 'center', padding: '1px 2px',
    border: 'none', borderBottom: '2px solid var(--primary)', borderRadius: 0,
    background: 'transparent', fontSize: '0.9rem', fontWeight: '700',
    color: 'var(--primary)', outline: 'none', fontFamily: 'inherit',
    cursor: 'pointer', margin: '0 2px'
  };

  if (custom) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
        <input 
          type="number" 
          value={value} 
          onChange={e => onChange(e.target.value)}
          autoFocus 
          style={{
            width,
            textAlign: 'center',
            padding: '1px',
            border: 'none',
            borderBottom: '2px solid var(--primary)',
            background: 'transparent',
            fontSize: '0.9rem',
            fontWeight: '700',
            color: 'var(--primary)',
            outline: 'none'
          }} 
        />
        <button 
          onClick={() => { setCustom(false); onChange(''); }}
          style={{ padding: '0 2px', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1 }}
        >
          ↩
        </button>
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
      style={baseStyle}
    >
      <option value="" disabled>선택</option>
      {presets.map(p => <option key={p} value={String(p)}>{p}</option>)}
      <option value={SENTINEL} style={{ color: '#1d4ed8' }}>직접입력</option>
    </select>
  );
}

// ─── 개별 과목 카드 컴포넌트 ─────────────────────────────────
function SubjectCard({ index, sub, mode, onUpdate, onRemove, isLast, onAdd }) {
  const { id, rateIdx, dm, wc, wk, fee, isEditingRate } = sub;
  const isTutoring = mode === 'tutoring';

  const wkVal = parseFloat(wk) || 0;
  const totalMinutes = Math.round((parseFloat(dm)||0) * (parseFloat(wc)||0) * wkVal);
  const calcRate = totalMinutes > 0 ? (parseFloat(fee)||0) / totalMinutes : 0;
  const calcRatePrecision5 = totalMinutes > 0 ? calcRate.toFixed(5) : '0';
  const calcRateCeil1 = totalMinutes > 0 ? (Math.ceil(calcRate * 10) / 10).toFixed(1) : '0';
  
  // 시간당 단가 계산 (과외용)
  const calcHourlyRate = calcRate * 60;
  const calcHourlyRatePrecision5 = totalMinutes > 0 ? calcHourlyRate.toFixed(5) : '0';
  const calcHourlyRateCeil1 = totalMinutes > 0 ? (Math.ceil(calcHourlyRate * 10) / 10).toFixed(1) : '0';

  // 과외 모드일 때는 시간당 20,000원 기준(분당 333.333...)
  const standardRate = isTutoring ? (20000 / 60) : STANDARD_RATE_OPTIONS[rateIdx].rate;
  const canJudge = totalMinutes > 0 && (parseFloat(fee) || 0) > 0;
  
  // 과외는 실제 시간당 요금이 20,000원 이하여야 함
  const isCompliant = isTutoring 
    ? (calcRate * 60) <= 20000.01 
    : parseFloat(calcRateCeil1) <= standardRate;

  const maxAllowedFee = isTutoring
    ? Math.floor((totalMinutes / 60) * 20000)
    : Math.floor(standardRate * totalMinutes);

  const borderColor = !canJudge ? 'var(--border-color)' : isCompliant ? '#bbf7d0' : '#fca5a5';
  const bgColor     = !canJudge ? 'var(--bg-card)'     : isCompliant ? '#f0fdf4' : '#fff1f2';
  const badgeBg     = !canJudge ? '#94a3b8'            : isCompliant ? '#16a34a' : '#dc2626';

  const sectionLabel = (text, color = 'var(--text-muted)', barColor = 'var(--text-muted)') => (
    <div style={{ fontSize: '0.88rem', fontWeight: '700', color, letterSpacing: '0.02em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ display: 'inline-block', width: '2.5px', height: '12px', borderRadius: '1.5px', backgroundColor: barColor, flexShrink: 0 }} />
      {text}
    </div>
  );

  // 단계 선택 여부 플래그
  const isRateSelected = isTutoring || !isEditingRate;
  const isDmSelected = dm !== '';
  const isWcSelected = wc !== '';
  const isWkSelected = wk !== '';
  const showRightColumn = isDmSelected && isWcSelected && isWkSelected;

  return (
    <div className="tuition-card" style={{ borderRadius: '12px', overflow: 'hidden', border: `1.5px solid ${borderColor}`, boxShadow: 'var(--shadow-sm)' }}>
      {/* 헤더 */}
      <div style={{ padding: '8px 12px', backgroundColor: bgColor, borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-main)' }}>과목 {index + 1}</span>
          <span style={{ fontWeight: '700', fontSize: '0.8rem', padding: '2px 8px', borderRadius: '20px', backgroundColor: badgeBg, color: '#fff', whiteSpace: 'nowrap' }}>
            {!canJudge ? '입력중' : isCompliant ? '✅ 적합' : '❌ 부적합'}
          </span>
        </div>
        <button onClick={() => onRemove(id)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1rem', cursor: 'pointer', padding: '0 2px' }}>✕</button>
      </div>

      <div style={{ padding: '12px' }}>
        {/* 강제 2열 구조 (그리드 설정: 1fr 1fr) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: showRightColumn ? '1fr 1fr' : '1fr', 
          gap: '12px' 
        }}>
          
          {/* [왼쪽 열]: 교습분야 + 교습시간 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* 1. 교습 분야 선택 (학원/교습소만) */}
            {!isTutoring && (
              <div>
                {sectionLabel('1. 교습 분야 선택', 'var(--primary)', 'var(--primary)')}
                {!isEditingRate ? (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '6px 10px', 
                    border: '1.5px solid var(--border-color)', 
                    borderRadius: '8px', 
                    backgroundColor: '#f8fafc',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {STANDARD_RATE_OPTIONS[rateIdx].label} ({STANDARD_RATE_OPTIONS[rateIdx].rate}원/분)
                    </span>
                    <button 
                      onClick={() => {
                        onUpdate(id, 'isEditingRate', true);
                        onUpdate(id, 'dm', '');
                        onUpdate(id, 'wc', '');
                        onUpdate(id, 'wk', '');
                      }} 
                      style={{ padding: '2px 6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', marginLeft: '4px' }}
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <select 
                    size={6}
                    value={rateIdx} 
                    onChange={e => {
                      onUpdate(id, 'rateIdx', Number(e.target.value));
                      onUpdate(id, 'isEditingRate', false);
                    }}
                    style={{ width: '100%', padding: '4px 6px', border: '2px solid var(--primary)', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700', background: '#eff6ff', color: 'var(--primary)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                    {STANDARD_RATE_OPTIONS.map((o, i) => (
                      <option key={i} value={i} style={{ padding: '4px 6px', borderRadius: '4px', cursor: 'pointer' }}>{o.label} ({o.rate}원/분)</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 2. 월 교습시간 구성 */}
            {isRateSelected && (
              <div>
                {sectionLabel(isTutoring ? '1. 월 교습시간(분)' : '2. 월 교습시간(분)', 'var(--primary)', 'var(--primary)')}
                
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3px', padding: '6px 10px', borderRadius: '8px', backgroundColor: '#f0f4ff', border: '1.5px solid #c7d2fe', fontSize: '0.9rem', lineHeight: '1.8' }}>
                  <span style={{ fontWeight: '700', color: '#475569' }}>일</span>
                  
                  {!isDmSelected ? (
                    <PresetPicker value={dm} onChange={val => onUpdate(id, 'dm', val)} presets={[50, 60, 80, 90, 120]} width="52px" />
                  ) : (
                    <span 
                      onClick={() => {
                        onUpdate(id, 'dm', '');
                        onUpdate(id, 'wc', '');
                        onUpdate(id, 'wk', '');
                      }}
                      style={{ fontWeight: '800', color: 'var(--primary)', borderBottom: '1.5px dashed var(--primary)', cursor: 'pointer', padding: '0 1px' }}
                    >
                      {dm}분
                    </span>
                  )}

                  {isDmSelected && (
                    <>
                      <span style={{ fontWeight: '700', color: '#475569' }}>×주</span>
                      {!isWcSelected ? (
                        <PresetPicker value={wc} onChange={val => onUpdate(id, 'wc', val)} presets={[1, 2, 3, 4, 5]} width="45px" />
                      ) : (
                        <span 
                          onClick={() => {
                            onUpdate(id, 'wc', '');
                            onUpdate(id, 'wk', '');
                          }}
                          style={{ fontWeight: '800', color: 'var(--primary)', borderBottom: '1.5px dashed var(--primary)', cursor: 'pointer', padding: '0 1px' }}
                        >
                          {wc}회
                        </span>
                      )}
                    </>
                  )}

                  {isDmSelected && isWcSelected && (
                    <>
                      <span style={{ fontWeight: '700', color: '#475569' }}>×</span>
                      {!isWkSelected ? (
                        <PresetPicker value={wk} onChange={val => onUpdate(id, 'wk', val)} presets={[4, 4.2, 4.3]} width="48px" />
                      ) : (
                        <span 
                          onClick={() => onUpdate(id, 'wk', '')}
                          style={{ fontWeight: '800', color: 'var(--primary)', borderBottom: '1.5px dashed var(--primary)', cursor: 'pointer', padding: '0 1px' }}
                        >
                          {wk}주
                        </span>
                      )}
                    </>
                  )}

                  {isDmSelected && isWcSelected && isWkSelected && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '3px' }}>
                      <span style={{ fontWeight: '700', color: '#475569' }}>=</span>
                      <strong style={{ color: '#1e40af', fontSize: '0.98rem' }}>{totalMinutes.toLocaleString()}분</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* [오른쪽 열]: 교습비 + 단가출력 */}
          {showRightColumn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* 3. 교습비 */}
              <div>
                {sectionLabel(isTutoring ? '2. 교습비(원)' : '3. 교습비(원)', 'var(--primary)', 'var(--primary)')}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', padding: '6px 10px', border: '1.5px solid #bfdbfe', borderRadius: '8px', backgroundColor: '#eff6ff' }}>
                  <input type="text" inputMode="numeric"
                    value={fee === '' ? '' : Number(fee).toLocaleString()}
                    onChange={e => {
                      const raw = e.target.value.replace(/,/g, '');
                      if (raw === '' || /^\d+$/.test(raw)) onUpdate(id, 'fee', raw);
                    }}
                    placeholder="교습비 입력"
                    style={{ flex: 1, minWidth: '60px', textAlign: 'right', padding: '2px 4px', border: 'none', borderBottom: '2px solid var(--primary)', borderRadius: 0, background: 'transparent', fontSize: '0.98rem', fontWeight: '700', color: 'var(--primary)', outline: 'none', fontFamily: 'inherit' }}
                  />
                  <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>원</strong>
                  {totalMinutes > 0 && (
                    <span style={{ fontSize: '0.78rem', color: '#1e40af', backgroundColor: '#dbeafe', padding: '1.5px 5px', borderRadius: '4px', fontWeight: '750', marginLeft: 'auto' }}>
                      (상한: {maxAllowedFee.toLocaleString()}원)
                    </span>
                  )}
                </div>
              </div>

              {/* 4. 단가 출력 */}
              <div>
                {sectionLabel(isTutoring ? '3. 시간당단가' : '4. 분당단가', 'var(--primary)', 'var(--primary)')}
                <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {canJudge ? (
                      <>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          {isTutoring ? `${Number(calcHourlyRatePrecision5).toLocaleString(undefined, {minimumFractionDigits: 5, maximumFractionDigits: 5})}원/시간` : `${calcRatePrecision5}원/분`}
                        </strong>
                        <span style={{ color: 'var(--text-muted)' }}>➔</span>
                        <strong style={{ color: isCompliant ? '#16a34a' : '#dc2626', fontSize: '0.95rem' }}>
                          {isTutoring ? `${Number(calcHourlyRateCeil1).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}원/시간` : `${calcRateCeil1}원/분`} 
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(올림)</span>
                      </>
                    ) : (
                      <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {isTutoring ? '0원/시간' : '0원/분'} (금액 입력대기)
                      </strong>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* 다음 과목 계산 버튼 (마지막 카드에만 표시) */}
        {isLast && (
          <button
            onClick={onAdd}
            disabled={!canJudge}
            style={{ marginTop: '12px', width: '100%', padding: '9px', backgroundColor: canJudge ? 'var(--primary)' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '700', cursor: canJudge ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            ➕ 다음 과목 계산
          </button>
        )}
      </div>
    </div>
  );
}
