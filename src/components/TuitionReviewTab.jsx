import React, { useState } from 'react';
import FieldStatistics from './FieldStatistics';

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
    { id: 1, rateIdx: '', dm: '', wc: '', wk: '4.3', fee: '' }
  ]);

  function addSubject() {
    setSubjects(prev => [
      ...prev,
      { id: Date.now(), rateIdx: '', dm: '', wc: '', wk: '', fee: '' }
    ]);
  }

  function updateSubject(id, key, val) {
    setSubjects(prev => prev.map(sub =>
      sub.id === id ? { ...sub, [key]: val } : sub
    ));
  }

  function patchSubject(id, patch) {
    setSubjects(prev => prev.map(sub => sub.id === id ? { ...sub, ...patch } : sub));
  }

  function removeSubject(id) {
    if (subjects.length === 1) {
      setSubjects([{ id: 1, rateIdx: '', dm: '', wc: '', wk: '4.3', fee: '' }]);
      return;
    }
    setSubjects(prev => prev.filter(sub => sub.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
      {!isTutoring && (
        <FieldStatistics
          selectedRateIdx={subjects[0]?.rateIdx ?? ''}
          onSelect={({ rateIdx, dm, wc, wk, fee }) => {
            const lastId = subjects[subjects.length - 1].id;
            patchSubject(lastId, {
              rateIdx: String(rateIdx),
              dm: String(dm),
              wc: String(wc),
              wk: wk,
              fee: String(fee),
            });
          }}
        />
      )}
    </div>
  );
}

// ─── 섹션 제목 ────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: '0.82rem',
      fontWeight: '700',
      color: '#374151',
      letterSpacing: '0.03em',
      marginBottom: '6px',
      paddingBottom: '4px',
      borderBottom: '1px solid #e5e7eb',
    }}>
      {children}
    </div>
  );
}

// ─── 폼 입력 행 ──────────────────────────────────────────────
function FormRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '36px' }}>
      {label && (
        <span style={{
          fontSize: '0.88rem',
          color: '#6b7280',
          fontWeight: '500',
          minWidth: '28px',
          textAlign: 'right',
        }}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

// ─── 밑줄 숫자 입력 ──────────────────────────────────────────
function UnderlineInput({ value, onChange, placeholder, width = '60px', unit, type = 'number' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      <input
        type={type}
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width,
          textAlign: 'center',
          padding: '3px 2px',
          border: 'none',
          borderBottom: '1.5px solid #9ca3af',
          background: 'transparent',
          fontSize: '1rem',
          fontWeight: '600',
          color: '#111827',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {unit && <span style={{ fontSize: '0.9rem', color: '#374151', fontWeight: '500' }}>{unit}</span>}
    </span>
  );
}

// ─── 드롭다운 + 직접 입력 ────────────────────────────────────
function DropdownSelect({ options, value, onChange, unit, placeholder, inputWidth = '60px' }) {
  const CUSTOM = '__custom__';
  const initialIsCustom = value !== '' && !options.includes(String(value));
  const [isCustomMode, setIsCustomMode] = useState(initialIsCustom);

  React.useEffect(() => {
    if (value !== '') {
      const isValInOptions = options.includes(String(value));
      setIsCustomMode(!isValInOptions);
    }
  }, [value, options]);

  function handleChange(e) {
    if (e.target.value === CUSTOM) {
      setIsCustomMode(true);
      onChange('');
    } else {
      setIsCustomMode(false);
      onChange(e.target.value);
    }
  }

  const selectVal = isCustomMode ? CUSTOM : (value === '' ? '' : String(value));

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {!isCustomMode ? (
        <select
          value={selectVal}
          onChange={handleChange}
          style={{
            padding: '3px 2px',
            border: 'none',
            borderBottom: '1.5px solid #9ca3af',
            borderRadius: '0',
            fontSize: '1rem',
            color: value === '' ? '#9ca3af' : '#111827',
            fontWeight: value === '' ? '400' : '600',
            background: 'transparent',
            outline: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
            appearance: 'auto',
            maxWidth: '62px',
          }}
        >
          <option value="">선택</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}{unit}</option>
          ))}
          <option value={CUSTOM}>입력</option>
        </select>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onBlur={() => {
              if (value === '') setIsCustomMode(false);
            }}
            style={{
              width: (parseFloat(inputWidth) - 8) + 'px',
              textAlign: 'center',
              padding: '3px 0px',
              border: 'none',
              borderBottom: '1.5px solid #9ca3af',
              background: 'transparent',
              fontSize: '1rem',
              fontWeight: '600',
              color: '#111827',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {unit && <span style={{ fontSize: '0.9rem', color: '#374151', fontWeight: '500', marginLeft: '1px' }}>{unit}</span>}
        </span>
      )}
    </span>
  );
}

// ─── 개별 과목 카드 컴포넌트 ─────────────────────────────────
function SubjectCard({ index, sub, mode, onUpdate, onRemove, isLast, onAdd }) {
  const { id, rateIdx, dm, wc, wk, fee } = sub;
  const isTutoring = mode === 'tutoring';

  const wkVal = parseFloat(wk) || 0;
  const totalMinutes = Math.round((parseFloat(dm) || 0) * (parseFloat(wc) || 0) * wkVal);
  const calcRate = totalMinutes > 0 ? (parseFloat(fee) || 0) / totalMinutes : 0;
  const calcRatePrecision5 = totalMinutes > 0 ? calcRate.toFixed(5) : '0';
  const calcRateCeil1 = totalMinutes > 0 ? (Math.ceil(calcRate * 10) / 10).toFixed(1) : '0';

  const calcHourlyRate = calcRate * 60;
  const calcHourlyRatePrecision5 = totalMinutes > 0 ? calcHourlyRate.toFixed(5) : '0';
  const calcHourlyRateCeil1 = totalMinutes > 0 ? (Math.ceil(calcHourlyRate * 10) / 10).toFixed(1) : '0';

  const hasRateSelected = isTutoring || rateIdx !== '';
  const standardRate = isTutoring
    ? (20000 / 60)
    : (rateIdx !== '' ? STANDARD_RATE_OPTIONS[rateIdx].rate : 0);

  const canJudge = hasRateSelected && totalMinutes > 0 && (parseFloat(fee) || 0) > 0;

  const isCompliant = isTutoring
    ? (calcRate * 60) <= 20000.01
    : parseFloat(calcRateCeil1) <= standardRate;

  const maxAllowedFee = isTutoring
    ? Math.floor((totalMinutes / 60) * 20000)
    : Math.floor(standardRate * totalMinutes);

  const statusColor = !canJudge ? '#6b7280' : isCompliant ? '#16a34a' : '#dc2626';
  const headerBg = !canJudge ? '#f9fafb' : isCompliant ? '#f0fdf4' : '#fff1f2';
  const borderColor = !canJudge ? '#d1d5db' : isCompliant ? '#86efac' : '#fca5a5';

  return (
    <div style={{
      border: `1.5px solid ${borderColor}`,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    }}>
      {/* 카드 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 14px',
        backgroundColor: headerBg,
        borderBottom: `1px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '800', fontSize: '1rem', color: '#111827' }}>
            과목 {index + 1}
          </span>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: '700',
            color: '#fff',
            backgroundColor: statusColor,
            padding: '2px 9px',
            borderRadius: '20px',
          }}>
            {!canJudge ? '입력 중' : isCompliant ? '✓ 적합' : '✗ 부적합'}
          </span>
        </div>
        <button
          onClick={() => onRemove(id)}
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '1rem', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* 카드 본문 */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#fff' }}>

        {/* 1. 교습 분야 선택 (학원/교습소만) */}
        {!isTutoring && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
              1. 교습 분야 선택
            </span>
            <select
              value={rateIdx}
              onChange={e => onUpdate(id, 'rateIdx', e.target.value === '' ? '' : Number(e.target.value))}
              className="tuition-select"
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1.5px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.95rem',
                color: rateIdx === '' ? '#9ca3af' : '#111827',
                fontWeight: rateIdx === '' ? '400' : '600',
                background: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                appearance: 'auto',
              }}
            >
              <option value="">— 분야 선택 —</option>
              {STANDARD_RATE_OPTIONS.map((o, i) => (
                <option key={i} value={i}>{o.label} ({o.rate}원/분)</option>
              ))}
            </select>
          </div>
        )}

        {/* 2. 월 교습시간 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px 6px', fontSize: '0.95rem' }}>
          <span style={{ fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0, marginRight: '4px', minWidth: '115px' }}>
            {isTutoring ? '1. 월 교습시간(분)' : '2. 월 교습시간(분)'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px', flex: 1, minWidth: '200px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#374151', fontWeight: '500' }}>일</span>
              <DropdownSelect
                options={['50', '60', '70', '80', '90', '120', '180']}
                value={dm}
                onChange={val => onUpdate(id, 'dm', val)}
                unit="분"
                placeholder="0"
                inputWidth="52px"
              />
              <span style={{ color: '#4b5563', margin: '0 4px', fontSize: '1.15rem' }}>×</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#374151', fontWeight: '500' }}>주</span>
              <DropdownSelect
                options={['1', '2', '3', '4', '5']}
                value={wc}
                onChange={val => onUpdate(id, 'wc', val)}
                unit="회"
                placeholder="0"
                inputWidth="40px"
              />
              <span style={{ color: '#4b5563', margin: '0 4px', fontSize: '1.15rem' }}>×</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#374151', fontWeight: '500' }}>월</span>
              <DropdownSelect
                options={['4', '4.1', '4.2', '4.3']}
                value={wk}
                onChange={val => onUpdate(id, 'wk', val)}
                unit="주"
                placeholder="4.3"
                inputWidth="46px"
              />
              <span style={{ color: '#4b5563', margin: '0 4px', fontSize: '1.15rem' }}>=</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <strong style={{ fontWeight: '900', color: totalMinutes > 0 ? '#1d4ed8' : '#9ca3af', WebkitTextStroke: totalMinutes > 0 ? '0.4px #1d4ed8' : 'none' }}>
                {totalMinutes > 0 ? totalMinutes.toLocaleString() : '________'}
              </strong>
              <span style={{ color: '#374151', fontWeight: '500', marginLeft: '2px' }}>분</span>
            </span>
          </div>
        </div>

        {/* 3. 교습비 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
          <span style={{ fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {isTutoring ? '2. 교습비(원)' : '3. 교습비(원)'}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={fee === '' ? '' : Number(fee).toLocaleString()}
            onChange={e => {
              const raw = e.target.value.replace(/,/g, '');
              if (raw === '' || /^\d+$/.test(raw)) onUpdate(id, 'fee', raw);
            }}
            placeholder="금액 입력"
            style={{
              width: '120px',
              textAlign: 'right',
              padding: '4px 2px',
              border: 'none',
              borderBottom: '1.5px solid #9ca3af',
              background: 'transparent',
              fontSize: '1.05rem',
              fontWeight: '700',
              color: '#1d4ed8',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: '0.95rem', color: '#374151', fontWeight: '600', flexShrink: 0 }}>원</span>
          <span style={{ fontSize: '0.85rem', color: totalMinutes > 0 ? '#1d4ed8' : '#9ca3af', backgroundColor: totalMinutes > 0 ? '#eff6ff' : '#f1f5f9', padding: '2px 7px', borderRadius: '4px', fontWeight: '700', flexShrink: 0, border: `1px solid ${totalMinutes > 0 ? '#bfdbfe' : '#e2e8f0'}` }}>
            상한 {totalMinutes > 0 ? maxAllowedFee.toLocaleString() : '—'}원
          </span>
        </div>

        {/* 4. 분당단가 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {isTutoring ? '3. 시간당단가' : '4. 분당단가'}
          </span>
          {canJudge ? (
            <>
              <span style={{ color: '#374151', fontWeight: '500' }}>
                {isTutoring ? calcHourlyRatePrecision5 : calcRatePrecision5}원
              </span>
              <span style={{ color: '#9ca3af', fontWeight: '600' }}>→</span>
              <strong style={{ fontWeight: '900', color: '#1d4ed8', fontSize: '1rem', WebkitTextStroke: '0.4px #1d4ed8' }}>
                {isTutoring
                  ? `${Number(calcHourlyRateCeil1).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}원/시간`
                  : `${calcRateCeil1}원/분`}
              </strong>
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>(올림)</span>
            </>
          ) : (
            <span style={{ color: '#9ca3af' }}>_____ 원/분 (자동계산)</span>
          )}
        </div>


        {/* 다음 과목 버튼 */}
        {isLast && (
          <button
            onClick={onAdd}
            style={{
              marginTop: '2px',
              width: '100%',
              padding: '10px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1.5px dashed #d1d5db',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: '700',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            + 과목 추가
          </button>
        )}
      </div>
    </div>
  );
}
