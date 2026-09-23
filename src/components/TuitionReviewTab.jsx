import React, { useState, useRef, useEffect } from 'react';
import { parseExcelTuition } from '../utils/parseExcelTuition';
import { lookupAcademy, rememberAcademy, readMyAcademies, forgetAcademy, attachRememberedRegNo } from '../utils/academyLookup';
import { useAcademyList } from '../utils/useAcademyList';
import { printRegistrationForm, printTutoringForm } from '../utils/generateRegistrationPDF';
import { NeisHakwonCard, ExcelUploadCard, AcademyPickList, hasDraggedFiles } from './NeisExcelSteps';
import RegistrationSheet, { newSheetSubject, padSheetSubjects, rateFields, newExtraFee, padExtraFees } from './RegistrationSheet';
import { guessRateId } from '../utils/regionRates';
import { OTHER_FEE_ITEMS } from '../utils/tuitionFormCommon';
import { useRegion } from '../RegionContext';

const EMPTY_INFO = { academyName: '', operator: '', regNumber: '', phone: '', address: '' };
const IDLE = { status: 'idle' };

// 고른 학원의 본인 확인 방법 — check: 'N' 번호, 'P' 이름, 'NP' 둘 중 하나, '' 확인 없음
function askOf(item) {
  const isGyo = item.kind === '교습소';
  const no = isGyo ? '신고번호' : '등록번호';
  const person = isGyo ? '교습자' : '운영자';
  if (item.check === 'N') return { fields: ['regNumber'], label: `등록(신고)번호 칸에 ${no}를` };
  if (item.check === 'P') return { fields: ['operator'], label: `운영자 칸에 ${person} 성명(법인은 법인명)을` };
  if (item.check === 'NP') return { fields: ['operator', 'regNumber'], label: `운영자 성명 또는 ${no}를` };
  return { fields: [], label: '' };
}

// 나이스 교습기간 "1개월0일" → "1개월", "0개월1일" → "1일"
function periodText(raw) {
  const text = String(raw || '').trim();
  const m = /^(\d+)\s*개월\s*(\d+)\s*일$/.exec(text);
  if (!m) return text || '1개월';
  const parts = [];
  if (+m[1]) parts.push(`${+m[1]}개월`);
  if (+m[2]) parts.push(`${+m[2]}일`);
  return parts.join(' ') || '1개월';
}

function answerOf(item, info) {
  const no = String(info.regNumber || '').trim();
  const person = String(info.operator || '').trim();
  if (item.check === 'P') return person || no;
  if (item.check === 'N' || item.check === 'NP') return no || person;
  return '';
}

export default function TuitionReviewTab({ mode = 'academy' }) {
  const isTutoring = mode === 'tutoring';
  const { region, rows: rateRows, officeName } = useRegion();

  // ── 신규/변경 서브탭 ──
  const [subTab, setSubTab] = useState('신규');

  // ── 신규 탭 등록신청서(학원·교습소) / 개인과외 신고 내용 ──
  const [newInfo, setNewInfo] = useState(EMPTY_INFO);
  const [newSheetSubjects, setNewSheetSubjects] = useState(() => padSheetSubjects([]));
  const [newDiscount, setNewDiscount] = useState('');
  const [newExtraFees, setNewExtraFees] = useState(() => padExtraFees([]));

  // ── 변경 탭 상태 ──
  const [changeInfo, setChangeInfo] = useState(EMPTY_INFO);
  const [changeRegType, setChangeRegType] = useState('일부변경');
  const changeFileInputRef = useRef(null);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeDragOver, setChangeDragOver] = useState(false);
  const [changeAcademies, setChangeAcademies] = useState([]);
  const [changeSubjects, setChangeSubjects] = useState(() => padSheetSubjects([]));
  const [changeDiscount, setChangeDiscount] = useState('');
  const [changeExtraFees, setChangeExtraFees] = useState(() => padExtraFees([]));

  // ── 변경 탭: 학원명으로 찾아 나이스 교습비 채우기 ──
  const { list: academyList, error: academyListError, reload: reloadAcademyList } = useAcademyList(isTutoring ? '' : region);
  const [picked, setPicked] = useState(null);
  const [lookup, setLookup] = useState(IDLE);
  const [mine, setMine] = useState(readMyAcademies);
  const runSeqRef = useRef(0); // 다시 고르거나 지역을 바꾸면 늦게 도착한 이전 응답은 버린다

  useEffect(() => {
    runSeqRef.current++;
    setPicked(null);
    setLookup(IDLE);
  }, [region]);

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

  // 나이스(실시간·엑셀)에서 받은 학원을 변경 서식에 채움 — keepTyped: 운영자가 적은 운영자·번호·위치는 나이스에 없는 칸만 대신함
  function fillFromAcademy(academy, keepTyped) {
    const subs = academy.courses.map((c, i) => {
      const label = c.subject || c.process;
      const rate = rateFields(rateRows, guessRateId(`${c.process} ${c.subject || ''}`, rateRows));
      const { dm, wc, wk } = reverseCalcTime(c.totalTime);
      return newSheetSubject({ id: i + 1, subjectName: label || '', ...rate, dm, wc, wk, period: periodText(c.period), fee: parseFeeStr(c.tuitionFee) });
    });
    setChangeSubjects(padSheetSubjects(subs));
    // 나이스에 적힌 기타경비가 있는 과정만 기타경비 표로 옮김
    const extras = academy.courses
      .filter(c => OTHER_FEE_ITEMS.some(it => parseFeeStr(c[it.key])))
      .map(c => {
        const fees = {};
        for (const it of OTHER_FEE_ITEMS) fees[it.key] = parseFeeStr(c[it.key]);
        return newExtraFee({ subjectName: c.subject || c.process || '', ...fees });
      });
    setChangeExtraFees(padExtraFees(extras));
    setChangeDiscount('');
    setChangeInfo(prev => {
      const typed = keepTyped ? prev : EMPTY_INFO;
      return {
        ...EMPTY_INFO,
        phone: typed.phone,
        academyName: academy.name || typed.academyName,
        operator: typed.operator.trim() || academy.founder?.name || '',
        regNumber: academy.regNo || typed.regNumber,
        address: academy.address || typed.address,
      };
    });
  }

  async function runLookup(item, answer) {
    const seq = ++runSeqRef.current;
    setLookup({ status: 'busy' });
    try {
      const res = await lookupAcademy(item.id, answer, region);
      rememberAcademy({ id: item.id, name: item.name, answer, regNo: res.academy.regNo || '', category: res.academy.category || '' });
      setMine(readMyAcademies());
      if (seq !== runSeqRef.current) return;
      fillFromAcademy(res.academy, true);
      setLookup({ status: 'done', from: res.source, basis: res.basis, academy: res.academy });
    } catch (e) {
      if (seq === runSeqRef.current) setLookup({ status: 'error', message: e.message || '교습비를 불러오지 못했습니다.' });
    }
  }

  const focusAskField = () => setTimeout(() => document.querySelector('.reg-info .is-ask')?.focus(), 50);

  function pickAcademy(item) {
    runSeqRef.current++;
    setPicked(item);
    setLookup(IDLE);
    setChangeInfo(prev => ({ ...prev, academyName: item.name }));
    if (item.check) focusAskField(); // 확인할 칸(운영자·번호)으로 바로
    else runLookup(item, '');
  }

  function loadPicked() {
    if (!picked || lookup.status === 'busy') return;
    const answer = answerOf(picked, changeInfo);
    if (picked.check && !answer) {
      setLookup({ status: 'error', message: `${askOf(picked).label} 먼저 적으세요.` });
      focusAskField();
      return;
    }
    runLookup(picked, answer);
  }

  // 학원명을 고치면 고른 학원을 놓는다
  function handleChangeInfo(next) {
    if (picked && next.academyName !== picked.name) {
      runSeqRef.current++;
      setPicked(null);
      setLookup(IDLE);
    }
    setChangeInfo(next);
  }

  function openMine(m) {
    const item = academyList?.items.find(x => x.id === m.id) || { id: m.id, name: m.name, kind: '', check: m.answer ? 'N' : '' };
    setPicked(item);
    setChangeInfo(prev => ({ ...prev, academyName: m.name }));
    runLookup(item, m.answer);
  }

  function removeMine(m) {
    forgetAcademy(m.name);
    setMine(readMyAcademies());
  }

  function selectExcelAcademy(academy) {
    runSeqRef.current++;
    setPicked(null);
    fillFromAcademy(academy, false);
    setLookup({ status: 'done', from: 'excel', academy });
  }

  function resetChange() {
    runSeqRef.current++;
    setPicked(null);
    setLookup(IDLE);
    setChangeInfo(EMPTY_INFO);
    setChangeRegType('일부변경');
    setChangeSubjects(padSheetSubjects([]));
    setChangeDiscount('');
    setChangeExtraFees(padExtraFees([]));
    setChangeAcademies([]);
    setChangeError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 서식 안내 띠 — 지금 무엇을 하면 되는지 한 줄로
  function changeNotice() {
    if (lookup.status === 'busy') return { tone: 'busy', content: '나이스 학원에서 교습비를 불러오는 중입니다…' };
    if (lookup.status === 'done') {
      const { from, basis, academy } = lookup;
      const count = academy.courses.length;
      if (from === 'excel') return { tone: 'ok', content: <>✔ 나이스 엑셀에서 <b>{academy.name}</b>의 교습과정 {count}개를 불러왔습니다. 바꿀 칸만 고치세요.</> };
      if (from === 'sheet') return { tone: 'warn', content: <>⚠ 나이스가 응답하지 않아 교육지원청 명단{basis && `(${basis} 동기화)`}의 교습비 {count}개를 채웠습니다. 최근에 바꾼 교습비가 빠졌을 수 있으니 확인하세요.</> };
      return { tone: 'ok', content: <>✔ 나이스 학원에 등록된 교습비 {count}개를 불러왔습니다{academy.changeDate && ` (적용일 ${academy.changeDate})`}. <b>바꿀 칸만 고치고</b>, 아래 일부변경·전체변경을 표시하세요.</> };
    }
    if (lookup.status === 'error') return { tone: 'error', content: lookup.message };
    if (picked) return { tone: 'info', content: <>② <b>{askOf(picked).label}</b> 적고 <b>[나이스에서 교습비 불러오기]</b>를 누르세요.</> };
    if (!region) return { tone: 'warn', content: <>화면 맨 위에서 <b>지역(교육지원청)</b>을 먼저 고르면 학원명으로 나이스 교습비를 불러올 수 있습니다. 칸에 직접 적어도 됩니다.</> };
    if (academyListError) return { tone: 'error', content: <>{academyListError} <button type="button" className="reg-lookup-link" onClick={reloadAcademyList}>다시 시도</button></> };
    if (!academyList) return { tone: 'busy', content: '학원 목록을 불러오는 중입니다…' };
    if (!academyList.items.length) return { tone: 'warn', content: <>이 지역은 아직 학원 검색 목록이 없습니다. 칸에 직접 적거나, 아래 <b>'나이스 엑셀 파일로 불러오기'</b>를 이용하세요.</> };
    return { tone: 'info', content: <>① <b>학원(교습소)명</b>을 적고 나오는 목록에서 고르세요. 나이스에 등록된 지금 교습비가 서식에 채워집니다.</> };
  }

  async function loadChangeFile(file) {
    if (!file) return;
    setChangeError('');
    setChangeLoading(true);
    setChangeAcademies([]);
    try {
      const result = attachRememberedRegNo(await parseExcelTuition(file));
      if (!result.length) {
        setChangeError('파싱된 학원 데이터가 없습니다. 파일 형식을 확인하세요.');
      } else {
        setChangeAcademies(result);
        if (result.length === 1) selectExcelAcademy(result[0]);
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

  const subTabStyle = (active) => ({
    flex: 1,
    padding: '11px 4px',
    border: 'none',
    borderRadius: '9px',
    cursor: 'pointer',
    backgroundColor: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    fontWeight: active ? '800' : '600',
    fontSize: '1.02rem',
    boxShadow: active ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none',
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

      {/* 신규 / 변경 서브탭 (학원·교습소만) */}
      {!isTutoring && (
        <div style={{ display: 'flex', gap: '6px', padding: '5px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '4px' }}>
          {['신규', '변경'].map(t => (
            <button key={t} style={subTabStyle(subTab === t)} onClick={() => setSubTab(t)}>{t}</button>
          ))}
        </div>
      )}

      {/* ── 과외 모드: 신규 탭과 같은 표 서식 ── */}
      {isTutoring && (
        <RegistrationSheet
          mode="tutoring"
          info={newInfo}
          onInfoChange={setNewInfo}
          subjects={newSheetSubjects}
          onSubjectsChange={setNewSheetSubjects}
          discount={newDiscount}
          onDiscountChange={setNewDiscount}
          onPrint={() => printTutoringForm({ ...newInfo, officeName, subjects: newSheetSubjects, discount: newDiscount })}
        />
      )}

      {/* ── 신규 탭: 등록신청서 서식 그대로 입력 ── */}
      {!isTutoring && subTab === '신규' && (
        <RegistrationSheet
          info={newInfo}
          onInfoChange={setNewInfo}
          regType="신규등록"
          regTypeOptions={['신규등록']}
          subjects={newSheetSubjects}
          onSubjectsChange={setNewSheetSubjects}
          discount={newDiscount}
          onDiscountChange={setNewDiscount}
          extraFees={newExtraFees}
          onExtraFeesChange={setNewExtraFees}
          onPrint={() => printRegistrationForm({ ...newInfo, officeName, regType: '신규등록', subjects: newSheetSubjects, discount: newDiscount, extraFees: newExtraFees })}
        />
      )}


      {/* ── 변경 탭: 신규와 같은 서식 — 학원명을 고르면 나이스 교습비가 채워짐 ── */}
      {!isTutoring && subTab === '변경' && (
        <div {...changeDropHandlers}>
          <div className="reg-toolbar">
            {mine.length > 0 && region && (
              <>
                <span className="reg-toolbar-label">최근 불러온 학원</span>
                {mine.map(m => (
                  <span key={m.id || m.name} className="reg-chip">
                    <button type="button" className="reg-chip-open" onClick={() => openMine(m)} disabled={!m.id || lookup.status === 'busy'}>★ {m.name}</button>
                    <button type="button" className="reg-chip-del" onClick={() => removeMine(m)} aria-label={`${m.name} 기억 지우기`}>×</button>
                  </span>
                ))}
              </>
            )}
            <button type="button" className="reg-reset" onClick={resetChange}>↺ 새로 작성</button>
          </div>

          <RegistrationSheet
            info={changeInfo}
            onInfoChange={handleChangeInfo}
            regType={changeRegType}
            regTypeOptions={['일부변경', '전체변경']}
            onRegTypeChange={setChangeRegType}
            subjects={changeSubjects}
            onSubjectsChange={setChangeSubjects}
            discount={changeDiscount}
            onDiscountChange={setChangeDiscount}
            extraFees={changeExtraFees}
            onExtraFeesChange={setChangeExtraFees}
            onPrint={() => printRegistrationForm({ ...changeInfo, officeName, regType: changeRegType, subjects: changeSubjects, discount: changeDiscount, extraFees: changeExtraFees })}
            lookup={{
              list: academyList,
              onPick: pickAcademy,
              onLoad: loadPicked,
              canLoad: !!picked && lookup.status !== 'busy' && lookup.status !== 'done',
              askFields: picked && lookup.status !== 'done' ? askOf(picked).fields : [],
              notice: changeNotice(),
            }}
          />

          <details className="reg-fallback">
            <summary>학원 목록에 없나요? 나이스 엑셀 파일로 불러오기</summary>
            <div className="reg-fallback-body">
              <NeisHakwonCard />
              <ExcelUploadCard loading={changeLoading} dragOver={changeDragOver} fileInputRef={changeFileInputRef} onFile={loadChangeFile} style={{ marginBottom: changeAcademies.length > 1 || changeError ? '16px' : 0 }} />
              {changeError && (
                <div style={{ color: '#dc2626', fontSize: '0.95rem', marginBottom: '16px', padding: '12px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  {changeError}
                </div>
              )}
              {changeAcademies.length > 1 && (
                <AcademyPickList academies={changeAcademies} onSelect={selectExcelAcademy} label="변경할" />
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
