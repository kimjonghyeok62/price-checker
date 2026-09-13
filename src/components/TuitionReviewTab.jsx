import React, { useState, useRef } from 'react';
import TuitionCheckTab from './TuitionCheckTab';
import { parseExcelTuition } from '../utils/parseExcelTuition';
import { printRegistrationForm } from '../utils/generateRegistrationPDF';
import { NeisHakwonCard, ExcelUploadCard, AcademyPickList, hasDraggedFiles } from './NeisExcelSteps';
// ─── 교습과정/과목명에서 분야 인덱스 추정 ────────────────────
function guessRateIdx(text) {
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

// 같은 분야의 입시/비입시 쌍인지 확인 (자동 전환 허용 범위)
function isSameCategoryPair(a, b) {
  const pairs = [[5, 6], [7, 8], [9, 10]];
  const na = Number(a); const nb = Number(b);
  return pairs.some(p => p.includes(na) && p.includes(nb));
}

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

  // ── 신설/변경 서브탭 ──
  const [subTab, setSubTab] = useState('신설');

  // ── 신설 탭 상태 ──
  const [subjects, setSubjects] = useState([
    { id: 1, rateIdx: '', dm: '', wc: '', wk: '4.3', fee: '', subjectName: '' }
  ]);

  function addSubject() {
    setSubjects(prev => {
      const last = prev[prev.length - 1];
      return [...prev, { id: Date.now(), rateIdx: '', dm: '', wc: '', wk: last?.wk || '4.3', fee: '', subjectName: '' }];
    });
  }
  function updateSubject(id, key, val) {
    setSubjects(prev => prev.map(sub => sub.id === id ? { ...sub, [key]: val } : sub));
  }
  function patchSubject(id, patch) {
    setSubjects(prev => prev.map(sub => sub.id === id ? { ...sub, ...patch } : sub));
  }
  function removeSubject(id) {
    if (subjects.length === 1) {
      setSubjects([{ id: 1, rateIdx: '', dm: '', wc: '', wk: '4.3', fee: '', subjectName: '' }]);
      return;
    }
    setSubjects(prev => prev.filter(sub => sub.id !== id));
  }

  // ── 변경 탭 상태 ──
  const [changeRegType, setChangeRegType] = useState('일부변경');
  const changeFileInputRef = useRef(null);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeDragOver, setChangeDragOver] = useState(false);
  const [changeAcademies, setChangeAcademies] = useState([]);
  const [changeSelected, setChangeSelected] = useState(null);
  const [changeSubjects, setChangeSubjects] = useState([]);

  function parseFeeStr(str) {
    if (!str) return '';
    const n = parseInt(String(str).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? '' : String(n);
  }


  // 총교습시간(분)에서 dm × wc × wk 역산
  // wk = 4.3 → 4.2 → 4.1 → 4 순으로 시도하여 dm×wc가 정수가 되는 첫 조합 반환
  function reverseCalcTime(totalTimeStr) {
    const total = parseFloat(String(totalTimeStr).replace(/[^0-9.]/g, ''));
    if (isNaN(total) || total <= 0) return { dm: '', wc: '', wk: '4.3' };

    const wkCandidates = [
      { val: 4.3, str: '4.3' },
      { val: 4.2, str: '4.2' },
      { val: 4.1, str: '4.1' },
      { val: 4.0, str: '4' },
    ];
    // wc 시도 순서: 일반적인 횟수(5,4,3,6) 우선
    const wcTryOrder = [5, 4, 3, 6, 2, 7, 1, 8, 10];

    // 패스 0: dm이 5의 배수인 조합 우선 / 패스 1: 임의 정수도 허용
    for (let pass = 0; pass < 2; pass++) {
      for (const { val: wkVal, str: wkStr } of wkCandidates) {
        const weekly = total / wkVal;
        for (const wc of wcTryOrder) {
          const dmFloat = weekly / wc;
          const dmInt = Math.round(dmFloat);
          if (dmInt < 30 || dmInt > 480) continue;
          if (Math.abs(dmFloat - dmInt) > 0.02) continue;
          if (pass === 0 && dmInt % 5 !== 0) continue; // 패스0: 5의 배수만
          // 실제 곱이 total과 0.3% 이내인지 검증
          if (Math.abs(dmInt * wc * wkVal - total) / total < 0.003) {
            return { dm: String(dmInt), wc: String(wc), wk: wkStr };
          }
        }
      }
    }
    return { dm: '', wc: '', wk: '4.3' };
  }

  function selectChangeAcademy(academy) {
    setChangeSelected(academy);
    const subs = academy.courses.map((c, i) => {
      const label = c.subject ? `${c.process}(${c.subject})` : c.process;
      const rateIdx = guessRateIdx(`${c.process} ${c.subject || ''}`);
      const { dm, wc, wk } = reverseCalcTime(c.totalTime);
      return { id: i + 1, subjectName: label || '', rateIdx, dm, wc, wk, fee: parseFeeStr(c.tuitionFee) };
    });
    setChangeSubjects(subs.length ? subs : [{ id: 1, subjectName: '', rateIdx: '', dm: '', wc: '', wk: '4.3', fee: '' }]);
  }

  async function loadChangeFile(file) {
    if (!file) return;
    setChangeError('');
    setChangeLoading(true);
    setChangeAcademies([]);
    setChangeSelected(null);
    setChangeSubjects([]);
    try {
      const result = await parseExcelTuition(file);
      if (!result.length) {
        setChangeError('파싱된 학원 데이터가 없습니다. 파일 형식을 확인하세요.');
      } else {
        setChangeAcademies(result);
        if (result.length === 1) selectChangeAcademy(result[0]);
      }
    } catch (err) {
      setChangeError('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setChangeLoading(false);
    }
  }

  // 변경 탭 어디에 끌어다 놓아도 업로드 (게시표 출력 탭과 같은 방식)
  const changeDragDepthRef = useRef(0);
  const changeDropHandlers = {
    onDragEnter: e => { if (!hasDraggedFiles(e)) return; e.preventDefault(); changeDragDepthRef.current++; setChangeDragOver(true); },
    onDragOver: e => { if (hasDraggedFiles(e)) e.preventDefault(); },
    onDragLeave: () => { changeDragDepthRef.current = Math.max(0, changeDragDepthRef.current - 1); if (!changeDragDepthRef.current) setChangeDragOver(false); },
    onDrop: e => {
      if (!hasDraggedFiles(e)) return;
      e.preventDefault();
      changeDragDepthRef.current = 0;
      setChangeDragOver(false);
      loadChangeFile(e.dataTransfer.files?.[0]);
    },
  };

  function removeChangeSubject(id) {
    if (changeSubjects.length === 1) return;
    setChangeSubjects(prev => prev.filter(sub => sub.id !== id));
  }

  const lastSub = subjects[subjects.length - 1];

  const subTabStyle = (active) => ({
    flex: 1,
    padding: '9px 4px',
    border: 'none',
    borderBottom: active ? '2.5px solid var(--primary)' : '2.5px solid transparent',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    fontWeight: active ? '700' : '500',
    fontSize: '0.97rem',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 탭 전용 안내 배너 */}
      {!isTutoring ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          fontSize: '0.95rem',
          color: '#1d4ed8',
          lineHeight: 1.4,
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
          <span>
            이 탭은 <strong>학원·교습소</strong> 전용입니다.&nbsp;
            개인과외는 상단 <strong>'개인과외'</strong> 탭을 이용해 주세요.
          </span>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          fontSize: '0.95rem',
          color: '#92400e',
          lineHeight: 1.4,
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
          <span>
            이 탭은 <strong>개인과외</strong> 전용입니다.&nbsp;
            학원·교습소는 상단 <strong>'학원·교습소'</strong> 탭을 이용해 주세요.
          </span>
        </div>
      )}

      {/* 검토 / 신설 / 변경 서브탭 (학원·교습소만) */}
      {!isTutoring && (
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '4px' }}>
          {['신설', '변경', '검토'].map(t => (
            <button key={t} style={subTabStyle(subTab === t)} onClick={() => setSubTab(t)}>{t}</button>
          ))}
        </div>
      )}

      {/* ── 검토 탭 ── */}
      {!isTutoring && subTab === '검토' && <TuitionCheckTab />}

      {/* ── 신설 탭 / 과외 모드 ── */}
      {(isTutoring || subTab === '신설') && (
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
            <PrintBar
              onPrint={() => printRegistrationForm({ regType: '신규등록', subjects })}
            />
          )}
        </div>
      )}

      {/* ── 변경 탭 — 게시표 출력 탭과 같은 ①②단계 카드 ── */}
      {!isTutoring && subTab === '변경' && (
        <div {...changeDropHandlers} style={{ display: 'flex', flexDirection: 'column' }}>

          {!changeSelected && (
            <>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '14px', wordBreak: 'keep-all' }}>
                나이스 학원에 등록된 교습비를 불러와서 바꿀 부분만 수정합니다.
              </div>
              <NeisHakwonCard />
              <ExcelUploadCard loading={changeLoading} dragOver={changeDragOver} fileInputRef={changeFileInputRef} onFile={loadChangeFile} />
            </>
          )}

          {changeError && (
            <div style={{ color: '#dc2626', fontSize: '0.95rem', marginBottom: '16px', padding: '12px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
              {changeError}
            </div>
          )}

          {/* 복수 학원 선택 */}
          {changeAcademies.length > 1 && !changeSelected && (
            <AcademyPickList academies={changeAcademies} onSelect={selectChangeAcademy} label="변경할" />
          )}

          {/* 선택된 학원 — 편집 가능한 과목 카드 */}
          {changeSelected && (
            <div className="animate-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px', wordBreak: 'keep-all' }}>
                      {changeSelected.name}
                    </div>
                    {changeSelected.address && <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{changeSelected.address}</div>}
                    <div style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.85rem', color: '#6366f1', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '2px 8px', fontWeight: '600' }}>
                      교습과정 {changeSubjects.length}개
                    </div>
                  </div>
                  <button
                    onClick={() => { setChangeSelected(null); setChangeSubjects([]); setChangeAcademies([]); }}
                    style={{ flexShrink: 0, padding: '8px 12px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontSize: '0.92rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    다시 선택
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '-4px' }}>
                바꿀 교습시간·교습비를 수정한 뒤 아래에서 등록신청서를 출력하세요.
              </div>
              {changeSubjects.map((sub, idx) => (
                <SubjectCard
                  key={sub.id}
                  index={idx}
                  sub={sub}
                  mode={mode}
                  onUpdate={(id, k, v) => setChangeSubjects(prev => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], [k]: v };
                    return next;
                  })}
                  onRemove={removeChangeSubject}
                  isLast={false}
                  onAdd={() => {}}
                />
              ))}
              <PrintBar
                regType={changeRegType}
                onRegTypeChange={setChangeRegType}
                showRegTypeSelector
                onPrint={() => printRegistrationForm({
                  academyName: changeSelected.name,
                  operator: changeSelected.founder?.name || '',
                  address: changeSelected.address || '',
                  regType: changeRegType,
                  subjects: changeSubjects,
                })}
              />
            </div>
          )}
        </div>
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

// ─── 개별 과목 카드 컴포넌트 ─────────────────────────────────
function SubjectCard({ index, sub, mode, onUpdate, onRemove, isLast, onAdd }) {
  const { id, rateIdx, dm, wc, wk, fee, subjectName } = sub;
  const isTutoring = mode === 'tutoring';

  const [feeEditMode, setFeeEditMode] = useState(false);
  const [nameEditMode, setNameEditMode] = useState(false);
  const longPressTimer = useRef(null);
  const displayName = subjectName || `과목${index + 1}`;

  function handleFeePointerDown() {
    longPressTimer.current = setTimeout(() => setFeeEditMode(true), 500);
  }
  function handleFeePointerUp() {
    clearTimeout(longPressTimer.current);
    setFeeEditMode(true);
  }
  function handleFeePointerLeave() {
    clearTimeout(longPressTimer.current);
  }
  function handleFeeStep(delta) {
    const next = Math.max(0, (parseFloat(fee) || 0) + delta);
    onUpdate(id, 'fee', String(next));
  }

  const wkVal = parseFloat(wk) || 0;
  const totalMinutes = Math.round((parseFloat(dm) || 0) * (parseFloat(wc) || 0) * wkVal);
  const calcRate = totalMinutes > 0 ? (parseFloat(fee) || 0) / totalMinutes : 0;
  const calcRatePrecision5 = totalMinutes > 0 ? calcRate.toFixed(5) : '0';
  const calcRateCeil1 = totalMinutes > 0 ? String(Math.ceil(calcRate)) : '0';

  const calcHourlyRate = calcRate * 60;
  const calcHourlyRatePrecision5 = totalMinutes > 0 ? calcHourlyRate.toFixed(5) : '0';
  const calcHourlyRateCeil1 = totalMinutes > 0 ? String(Math.ceil(calcHourlyRate)) : '0';

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
        padding: '11px 16px',
        backgroundColor: headerBg,
        borderBottom: `1px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '800', fontSize: '1.15rem', color: '#111827', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            {index + 1}.{' '}
            {nameEditMode ? (
              <input
                type="text"
                autoFocus
                value={subjectName}
                onChange={e => {
                  const newName = e.target.value;
                  onUpdate(id, 'subjectName', newName);
                  const guessed = guessRateIdx(newName);
                  if (guessed !== '') onUpdate(id, 'rateIdx', guessed);
                }}
                onBlur={() => setNameEditMode(false)}
                onKeyDown={e => { if (e.key === 'Enter') setNameEditMode(false); }}
                placeholder={`과목${index + 1}`}
                style={{
                  fontSize: '1.15rem', fontWeight: '800', color: '#111827',
                  border: 'none', borderBottom: '1.5px solid #6366f1', background: 'transparent',
                  outline: 'none', fontFamily: 'inherit', width: '140px', padding: '0 2px',
                }}
              />
            ) : (
              <span
                onClick={() => setNameEditMode(true)}
                title="클릭하여 과목명 편집"
                style={{ cursor: 'text', borderBottom: '1px dashed #9ca3af', paddingBottom: '1px' }}
              >
                {displayName}
              </span>
            )}
          </span>
          <span style={{
            fontSize: '0.92rem',
            fontWeight: '700',
            color: '#fff',
            backgroundColor: statusColor,
            padding: '3px 11px',
            whiteSpace: 'nowrap',
            borderRadius: '20px',
          }}>
            {!canJudge ? '입력 중' : isCompliant ? '✓ 적합' : '✗ 부적합'}
          </span>
        </div>
        <button
          onClick={() => onRemove(id)}
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '1.3rem', cursor: 'pointer', padding: '4px 6px', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* 카드 본문 */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#fff' }}>

        {/* 1. 교습 분야 선택 (학원/교습소만) */}
        {!isTutoring && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
              1. 교습 분야 선택
            </span>
            <select
              value={rateIdx}
              onChange={e => onUpdate(id, 'rateIdx', e.target.value === '' ? '' : Number(e.target.value))}
              className="tuition-select"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: '44px',
                padding: '8px 10px',
                border: '1.5px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1.05rem',
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
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '1.05rem' }}>
          <span style={{ fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0, marginRight: '4px', minWidth: '115px' }}>
            {isTutoring ? '1. 월교습시간(분)' : '2. 월교습시간(분)'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px', flex: 1, minWidth: '200px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#374151', fontWeight: '500' }}>일</span>
              <DropdownSelect
                options={Array.from({ length: 34 }, (_, i) => String(30 + i * 10))}
                value={dm}
                onChange={val => onUpdate(id, 'dm', val)}
                unit="분"
                placeholder="0"
                inputWidth="52px"
              />
              <span style={{ color: '#4b5563', margin: '0 4px', fontSize: '1.3rem' }}>×</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#374151', fontWeight: '500' }}>주</span>
              <DropdownSelect
                options={['1', '2', '3', '4', '5', '6', '7']}
                value={wc}
                onChange={val => onUpdate(id, 'wc', val)}
                unit="회"
                placeholder="0"
                inputWidth="40px"
              />
              <span style={{ color: '#4b5563', margin: '0 4px', fontSize: '1.3rem' }}>×</span>
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
              <span style={{ color: '#4b5563', margin: '0 4px', fontSize: '1.3rem' }}>=</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
              <strong style={{ fontWeight: '900', fontSize: '1.2rem', color: totalMinutes > 0 ? '#1d4ed8' : '#9ca3af', WebkitTextStroke: totalMinutes > 0 ? '0.4px #1d4ed8' : 'none' }}>
                {totalMinutes > 0 ? totalMinutes.toLocaleString() : '____'}
              </strong>
              <span style={{ color: '#374151', fontWeight: '500', marginLeft: '2px' }}>분</span>
            </span>
          </div>
        </div>

        {/* 3. 교습비 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {isTutoring ? '2. 교습비(원)' : '3. 교습비(원)'}
          </span>
          {feeEditMode ? (
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={fee === '' ? '' : Number(fee).toLocaleString()}
              onChange={e => {
                const raw = e.target.value.replace(/,/g, '');
                if (raw === '' || /^\d+$/.test(raw)) onUpdate(id, 'fee', raw);
              }}
              onBlur={() => {
                if (fee === '') onUpdate(id, 'fee', '0');
                setFeeEditMode(false);
              }}
              style={{
                width: '130px',
                textAlign: 'right',
                padding: '4px 2px',
                border: 'none',
                borderBottom: '1.5px solid #6366f1',
                background: 'transparent',
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1d4ed8',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <span
              onPointerDown={handleFeePointerDown}
              onPointerUp={handleFeePointerUp}
              onPointerLeave={handleFeePointerLeave}
              title="클릭하면 직접 입력"
              style={{
                width: '130px',
                textAlign: 'right',
                padding: '4px 2px',
                borderBottom: '1.5px solid #9ca3af',
                fontSize: '1.25rem',
                fontWeight: '700',
                color: fee ? '#1d4ed8' : '#9ca3af',
                cursor: 'text',
                userSelect: 'none',
                display: 'inline-block',
              }}
            >
              {fee ? Number(fee).toLocaleString() : '금액 입력'}
            </span>
          )}
          <span style={{ fontSize: '1.05rem', color: '#374151', fontWeight: '600', flexShrink: 0 }}>원</span>
          {/* ▲▼ 스피너 버튼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
            {['▲', '▼'].map((arrow, i) => (
              <button
                key={arrow}
                onClick={() => handleFeeStep(i === 0 ? 10000 : -10000)}
                style={{
                  width: '32px',
                  height: '22px',
                  padding: 0,
                  fontSize: '0.72rem',
                  lineHeight: 1,
                  border: '1px solid #d1d5db',
                  borderRadius: i === 0 ? '4px 4px 0 0' : '0 0 4px 4px',
                  background: '#f9fafb',
                  color: '#374151',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.color = '#4338ca'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#374151'; }}
              >
                {arrow}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.98rem', color: totalMinutes > 0 ? '#1d4ed8' : '#9ca3af', backgroundColor: totalMinutes > 0 ? '#eff6ff' : '#f1f5f9', padding: '3px 9px', borderRadius: '6px', fontWeight: '700', flexShrink: 0, border: `1px solid ${totalMinutes > 0 ? '#bfdbfe' : '#e2e8f0'}` }}>
            상한 {totalMinutes > 0 ? maxAllowedFee.toLocaleString() : '—'}원
          </span>
        </div>

        {/* 4. 분당단가 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {isTutoring ? '3. 시간당단가' : '4. 분당단가'}
          </span>
          {canJudge ? (
            <>
              <span style={{ color: '#374151', fontWeight: '500' }}>
                {isTutoring ? calcHourlyRatePrecision5 : calcRatePrecision5}원
              </span>
              <span style={{ color: '#9ca3af', fontWeight: '600' }}>→</span>
              <strong style={{ fontWeight: '900', color: '#1d4ed8', fontSize: '1.2rem', WebkitTextStroke: '0.4px #1d4ed8' }}>
                {isTutoring
                  ? `${Number(calcHourlyRateCeil1).toLocaleString()}원/시간`
                  : `${Number(calcRateCeil1).toLocaleString()}원/분`}
              </strong>
              <span style={{ color: '#9ca3af', fontSize: '0.92rem' }}>(올림)</span>
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
              padding: '13px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1.5px dashed #d1d5db',
              borderRadius: '10px',
              fontSize: '1.05rem',
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

// ─── 등록신청서 출력 바 ─────────────────────────────────────────
function PrintBar({ onPrint, showRegTypeSelector = false, regType, onRegTypeChange }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '18px',
      backgroundColor: '#eff6ff',
      border: '2px solid #bfdbfe',
      borderRadius: '14px',
      marginTop: '4px',
    }}>
      <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e3a8a', borderBottom: '1px solid #bfdbfe', paddingBottom: '10px', wordBreak: 'keep-all' }}>
        학원(교습소) 교습비등 등록신청서
      </div>
      {showRegTypeSelector && (
        <div style={{ display: 'flex', gap: '10px', fontSize: '1.05rem' }}>
          {['일부변경', '전체변경'].map(t => (
            <label key={t} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', borderRadius: '10px', backgroundColor: '#fff', border: `2px solid ${regType === t ? '#2563eb' : '#dbeafe'}`, cursor: 'pointer', fontWeight: regType === t ? '700' : '500', color: regType === t ? '#1d4ed8' : '#6b7280' }}>
              <input
                type="radio"
                name="regType"
                value={t}
                checked={regType === t}
                onChange={() => onRegTypeChange(t)}
                style={{ accentColor: '#2563eb', width: '18px', height: '18px', margin: 0 }}
              />
              {t}
            </label>
          ))}
        </div>
      )}
      <button
        onClick={onPrint}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '15px 16px',
          backgroundColor: '#1d4ed8',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          fontSize: '1.1rem',
          fontWeight: '800',
          boxShadow: '0 3px 10px rgba(29,78,216,0.3)',
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1e40af'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        등록신청서 출력 (PDF)
      </button>
    </div>
  );
}
