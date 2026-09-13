import React, { useState } from 'react';

// 교습비 입력 화면(과목 카드·등록신청서 표)이 함께 쓰는 기준단가·분야 추정·드롭다운

// ─── 교습과정/과목명에서 분야 인덱스 추정 ────────────────────
export function guessRateIdx(text) {
  if (!text) return '';
  const p = text.toLowerCase();
  if (p.includes('어학') || p.includes('외국어')) return 4;
  if (p.includes('음악')) return p.includes('입시') ? 6 : 5;
  if (p.includes('미술')) return p.includes('입시') ? 8 : 7;
  if (p.includes('무용') || p.includes('댄스') || p.includes('체육')) return p.includes('입시') ? 10 : 9;
  if (p.includes('정보') || p.includes('컴퓨터') || p.includes('코딩')) return 11;
  if (p.includes('진학') || p.includes('상담')) return 3;
  const isHabeop = p.includes('보습') || p.includes('단과') || p.includes('보통교과');
  if (isHabeop || p.includes('고등') || p.includes('고교') || p.includes('수능') ||
      p.includes('중등') || p.includes('중학') || p.includes('초등')) {
    if (p.includes('고등') || p.includes('고교') || p.includes('수능')) return 2;
    if (p.includes('중등') || p.includes('중학')) return 1;
    if (isHabeop) return 0;
  }
  return '';
}

// ─── 기준단가 옵션 ───────────────────────────────────────────
export const STANDARD_RATE_OPTIONS = [
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

// ─── 드롭다운 + 직접 입력 ────────────────────────────────────
export function DropdownSelect({ options, value, onChange, unit, placeholder, inputWidth = '60px' }) {
  const CUSTOM = '__custom__';
  const initialIsCustom = value !== '' && !options.includes(String(value));
  const [isCustomMode, setIsCustomMode] = useState(initialIsCustom);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (value !== '') {
      const isValInOptions = options.includes(String(value));
      setIsCustomMode(!isValInOptions);
    }
  }, [value, options]);

  React.useEffect(() => {
    if (isCustomMode && inputRef.current) {
      // autoFocus가 일부 모바일에서 동작 안 하는 경우를 대비해 ref로 직접 포커스
      const timer = setTimeout(() => {
        try { inputRef.current && inputRef.current.focus(); } catch (_) {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCustomMode]);

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
            padding: '6px 4px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '1.1rem',
            color: value === '' ? '#9ca3af' : '#111827',
            fontWeight: value === '' ? '400' : '600',
            background: '#fff',
            outline: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
            appearance: 'auto',
            WebkitAppearance: 'auto',
            maxWidth: '86px',
            minHeight: '42px',
            touchAction: 'manipulation',
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
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onClick={() => { try { inputRef.current && inputRef.current.focus(); } catch (_) {} }}
            onBlur={() => {
              if (value === '') setIsCustomMode(false);
            }}
            style={{
              width: (parseFloat(inputWidth) + 4) + 'px',
              textAlign: 'center',
              padding: '3px 0px',
              border: 'none',
              borderBottom: '1.5px solid #9ca3af',
              background: 'transparent',
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#111827',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {unit && <span style={{ fontSize: '1rem', color: '#374151', fontWeight: '500', marginLeft: '1px' }}>{unit}</span>}
        </span>
      )}
    </span>
  );
}
