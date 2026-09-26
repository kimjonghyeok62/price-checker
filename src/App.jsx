import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import TuitionReviewTab from './components/TuitionReviewTab';
import { printTuitionForm, printTuitionFormExternal } from './utils/generateTuitionPDF';
import { buildTuitionPlaceText } from './utils/generateTuitionText';
import { downloadTuitionInternalJPG, downloadTuitionExternalJPG } from './utils/generateTuitionJPG';
import { downloadTuitionInternalHWPX, downloadTuitionExternalHWPX } from './utils/generateTuitionHWPX';
import { getRegNoText } from './utils/tuitionFormCommon';
import { parseExcelTuition } from './utils/parseExcelTuition';
import { isAcademyLookupReady, attachRememberedRegNo, verifyAcademyRegNo, rememberAcademy } from './utils/academyLookup';
import AcademyLookupCard from './components/AcademyLookupCard';
import StandardPriceTable from './components/StandardPriceTable';
import RegionAdmin from './components/RegionAdmin';
import { useRegion } from './RegionContext';
import { REGION_NAMES } from './utils/regionRates';
import { takeSharedFile, canPromptInstall, onInstallPromptChange, promptInstall, isAndroid, isInstalledApp } from './utils/pwa';
import { NeisHakwonCard, ExcelUploadCard, AcademyPickList, hasDraggedFiles } from './components/NeisExcelSteps';
import TuitionTextModal from './components/TuitionTextModal';

// 왼쪽 메뉴 — 넓은 화면은 세로 메뉴, 좁은 화면은 머리띠 아래 가로 메뉴줄
const NAV = [
  {
    group: '신청서 작성',
    items: [
      { id: 'change', label: '교습비 변경신청', icon: 'edit' },
      { id: 'new', label: '신규 등록신청', icon: 'plus' },
      { id: 'tutoring', label: '개인과외 교습비 신고', icon: 'user' },
    ],
  },
  {
    group: '게시표',
    items: [
      { id: 'poster', label: '교습비 게시표 출력', icon: 'print' },
      { id: 'refund', label: '반환기준 게시표', icon: 'doc' },
    ],
  },
  {
    group: '참고',
    items: [{ id: 'rates', label: '지역 기준단가', icon: 'table' }],
  },
];

// 각 화면 머리 — 제목, 한 줄 설명, (있으면) 작성 순서 한 줄
const PAGE_HEAD = {
  change: {
    title: '교습비 변경신청서',
    desc: '나이스에 등록된 지금 교습비를 불러와서, 바꿀 칸만 고친 뒤 출력합니다.',
    steps: ['학원(교습소)명 고르기', '운영자 성명 또는 등록번호 적고 불러오기', '바꿀 칸 고치고 출력'],
  },
  new: {
    title: '교습비 등록신청서 (신규)',
    desc: '학원·교습소를 새로 등록할 때 교습비등을 적는 서식입니다.',
    steps: ['노란 칸 적기', '분당단가 적정 여부 확인', '등록신청서 출력'],
  },
  tutoring: {
    title: '개인과외 교습비 신고',
    desc: '개인과외교습자의 교습비 신고 내용을 적는 서식입니다.',
    steps: ['노란 칸 적기', '시간당단가 확인', '신고서 출력'],
  },
  poster: {
    title: '교습비 게시표 출력',
    desc: '나이스에 등록된 교습비로 학원에 붙이는 교습비등 게시표를 만듭니다.',
    steps: ['학원명 찾기', '본인 확인', 'PDF·JPG·HWPX로 출력'],
  },
  refund: {
    title: '교습비등 반환기준 게시표',
    desc: '학원·교습소에 함께 게시하는 반환기준 서식입니다.',
  },
  rates: {
    title: '지역 기준단가',
    desc: '교습비등 조정위원회에서 정한 교습과정별 분당 기준단가입니다.',
  },
};

const PAGE_KEY = 'app:page:v1';
const PAGE_IDS = NAV.flatMap(g => g.items.map(i => i.id));

function readPage() {
  try {
    const saved = localStorage.getItem(PAGE_KEY);
    return PAGE_IDS.includes(saved) ? saved : 'change';
  } catch {
    return 'change';
  }
}

export default function App() {
  const [page, setPageState] = useState(readPage);
  const [showRegionAdmin, setShowRegionAdmin] = useState(false);
  const { region, setRegion, effectiveDate, officeName } = useRegion();

  function setPage(id) {
    setPageState(id);
    try { localStorage.setItem(PAGE_KEY, id); } catch { /* 저장 못 해도 동작 */ }
    window.scrollTo({ top: 0 });
  }

  // 학원명으로 찾기 (나이스 실시간) — { academy, source, basis }
  const [lookupResult, setLookupResult] = useState(null);

  // 게시표 엑셀 올리기
  const [excelAcademies, setExcelAcademies] = useState([]);
  const [excelSelected, setExcelSelected] = useState(null);
  const [excelError, setExcelError] = useState('');
  const [excelLoading, setExcelLoading] = useState(false);
  const fileInputRef = useRef(null);

  function handleLookupResult(result) {
    setLookupResult(result);
    if (result) {
      setExcelAcademies([]);
      setExcelSelected(null);
      setExcelError('');
    }
  }

  // 나이스 엑셀로 올린 학원에 등록번호를 붙인다 (번호 확인을 거친 경우만)
  function handleExcelRegNo(name, info) {
    const patch = a => (a.name === name ? { ...a, regNo: info.regNo, category: a.category || info.category || '' } : a);
    setExcelAcademies(list => list.map(patch));
    setExcelSelected(prev => (prev ? patch(prev) : prev));
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelError('');
    setExcelLoading(true);
    setExcelAcademies([]);
    setExcelSelected(null);
    setLookupResult(null);
    try {
      // 나이스 엑셀엔 등록번호가 없다 → 이 기기에서 번호를 확인했던 학원이면 붙이고, 아니면 게시표 위에서 입력받는다
      const result = attachRememberedRegNo(await parseExcelTuition(file));
      if (!result.length) {
        setExcelError('파싱된 학원 데이터가 없습니다. 파일 형식을 확인하세요.');
      } else {
        setExcelAcademies(result);
        if (result.length === 1) setExcelSelected(result[0]);
      }
    } catch (err) {
      setExcelError('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setExcelLoading(false);
      e.target.value = '';
    }
  }

  // 안드로이드 "공유 → 교습비 계산·게시표"로 열린 경우(/?shared=1): 공유받은 엑셀을 바로 불러온다
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('shared')) return;
    window.history.replaceState(null, '', window.location.pathname);
    setPage('poster');
    takeSharedFile()
      .then(file => { if (file) handleFile({ target: { files: [file], value: '' } }); })
      .catch(() => {});
  }, []);

  if (showRegionAdmin) {
    return <RegionAdmin onBack={() => setShowRegionAdmin(false)} />;
  }

  const head = PAGE_HEAD[page];
  const isForm = page === 'new' || page === 'change' || page === 'tutoring';

  return (
    <div className="shell">
      {/* 머리띠 */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-logo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
            </svg>
          </span>
          <span className="topbar-title">학원·교습소 교습비 도우미</span>
        </div>
        <div className="topbar-actions">
          <label className={`app-region${region ? '' : ' is-empty'}`} title={effectiveDate ? `교습비등 조정위원회 개최일 ${effectiveDate}` : undefined}>
            <svg className="app-region-pin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span className="app-region-text">경기도</span>
            <select className="app-region-select" value={region} onChange={e => setRegion(e.target.value)} aria-label="교육지원청 선택">
              <option value="">지역 선택</option>
              {REGION_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <span className="app-region-text">교육지원청</span>
          </label>
        </div>
      </header>

      <div className="shell-body">
        {/* 메뉴 */}
        <nav className="sidenav" aria-label="메뉴">
          {NAV.map(g => (
            <div key={g.group} className="sidenav-group">
              <div className="sidenav-label">{g.group}</div>
              {g.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidenav-item${page === item.id ? ' is-active' : ''}`}
                  aria-current={page === item.id ? 'page' : undefined}
                  onClick={() => setPage(item.id)}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* 내용 */}
        <main className={`page${isForm ? ' is-wide' : ''}`}>
          <div className="page-head">
            <h1 className="page-title">{page === 'rates' && region ? `${officeName} 기준단가` : head.title}</h1>
            <p className="page-desc">{head.desc}</p>
            {head.steps && (
              <ol className="page-steps">
                {head.steps.map((s, i) => <li key={s}><span className="page-step-no">{i + 1}</span>{s}</li>)}
              </ol>
            )}
          </div>

          {/* 학원·교습소 신규/변경은 한 화면이 두 서식을 들고 있다 — 메뉴를 오가도 적던 내용 유지 */}
          <div hidden={page !== 'new' && page !== 'change'}>
            <TuitionReviewTab mode="academy" subTab={page === 'new' ? '신규' : '변경'} />
          </div>

          {page === 'tutoring' && <TuitionReviewTab mode="tutoring" />}

          {page === 'poster' && (
            <ExcelUploadTab
              excelLoading={excelLoading}
              excelError={excelError}
              excelAcademies={excelAcademies}
              excelSelected={excelSelected}
              setExcelSelected={setExcelSelected}
              fileInputRef={fileInputRef}
              handleFile={handleFile}
              lookupResult={lookupResult}
              onLookupResult={handleLookupResult}
              onExcelRegNo={handleExcelRegNo}
            />
          )}

          {page === 'refund' && <RefundPage />}

          {page === 'rates' && <StandardPriceTable />}

          <footer className="app-footer">
            <div>본 화면은 교습비 신고·변경신청 전 자체 검토용입니다. 실제 신청은 관할 교육지원청에 문의하시기 바랍니다.</div>
            <button type="button" className="app-admin-link" onClick={() => setShowRegionAdmin(true)}>교육지원청 담당자 기준단가 입력</button>
          </footer>
        </main>
      </div>
    </div>
  );
}

function NavIcon({ name }) {
  const paths = {
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    plus: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
    doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></>,
    table: <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="12" y1="3" x2="12" y2="21" /></>,
  };
  return (
    <svg className="sidenav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// 교습비등 반환기준 게시표 [별지 제5호서식]
function RefundPage() {
  return (
    <div className="card">
      <div className="card-title">
        반환기준 게시표 <span className="tag">[별지 제5호서식]</span>
      </div>
      <p className="card-desc">경기도 학원의 설립·운영 및 과외교습에 관한 조례 시행규칙 서식입니다. 교습비등 게시표와 함께 게시하세요.</p>
      <a className="btn btn-primary btn-block" href="/refund-standard.pdf" target="_blank" rel="noopener noreferrer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
        반환기준 게시표 PDF 열기
      </a>
    </div>
  );
}

function ExcelUploadTab({ excelLoading, excelError, excelAcademies, excelSelected, setExcelSelected, fileInputRef, handleFile, lookupResult, onLookupResult, onExcelRegNo }) {
  const [dragOver, setDragOver] = React.useState(false);
  const dragDepthRef = useRef(0);
  const [installable, setInstallable] = useState(canPromptInstall());
  useEffect(() => onInstallPromptChange(() => setInstallable(canPromptInstall())), []);
  const showAndroidTip = isAndroid() && !isInstalledApp();

  const loadFile = (file) => { if (file) handleFile({ target: { files: [file], value: '' } }); };

  // 게시표 화면 어디에 끌어다 놓아도 업로드
  const dropHandlers = {
    onDragEnter: e => { if (!hasDraggedFiles(e)) return; e.preventDefault(); dragDepthRef.current++; setDragOver(true); },
    onDragOver: e => { if (hasDraggedFiles(e)) e.preventDefault(); },
    onDragLeave: () => { dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (!dragDepthRef.current) setDragOver(false); },
    onDrop: e => {
      if (!hasDraggedFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragOver(false);
      loadFile(e.dataTransfer.files?.[0]);
    },
  };

  return (
    <div {...dropHandlers}>
      {isAcademyLookupReady() && (
        <>
          <AcademyLookupCard onResult={onLookupResult} />
          {lookupResult && (
            <div className="animate-enter" style={{ marginBottom: '20px' }}>
              <LookupBasisNote result={lookupResult} />
              <PrintButtons academy={lookupResult.academy} />
            </div>
          )}
        </>
      )}
      {isAcademyLookupReady() ? (
        <details className="reg-fallback" style={{ marginTop: 0, marginBottom: '20px' }}>
          <summary>학원 목록에 없나요? 나이스 엑셀 파일로 불러오기</summary>
          <div className="reg-fallback-body">
            <NeisHakwonCard />
            <ExcelUploadCard loading={excelLoading} dragOver={dragOver} fileInputRef={fileInputRef} onFile={loadFile} style={{ marginBottom: showAndroidTip ? '12px' : 0 }} />
            {showAndroidTip && <AndroidInstallTip installable={installable} style={{ marginBottom: 0 }} />}
          </div>
        </details>
      ) : (
        <>
          <NeisHakwonCard />
          <ExcelUploadCard loading={excelLoading} dragOver={dragOver} fileInputRef={fileInputRef} onFile={loadFile} />
          {showAndroidTip && <AndroidInstallTip installable={installable} style={{ marginTop: '-6px' }} />}
        </>
      )}

      {excelError && <div className="alert is-error">{excelError}</div>}

      {excelAcademies.length > 1 && !excelSelected && (
        <AcademyPickList academies={excelAcademies} onSelect={setExcelSelected} />
      )}

      {excelSelected && (
        <div className="animate-enter">
          {excelAcademies.length > 1 && (
            <button type="button" className="btn-link" onClick={() => setExcelSelected(null)} style={{ marginBottom: '12px' }}>
              ‹ 목록으로 돌아가기
            </button>
          )}
          {isAcademyLookupReady() && !excelSelected.regNo && (
            <RegNoAttach key={excelSelected.name} academy={excelSelected} onDone={info => onExcelRegNo(excelSelected.name, info)} />
          )}
          <PrintButtons academy={excelSelected} />
        </div>
      )}
    </div>
  );
}

function AndroidInstallTip({ installable, style }) {
  return (
    <div style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', ...style }}>
      <span>📱 앱을 설치하면 받은 엑셀을 '공유 → 교습비 계산·게시표'로 바로 열 수 있어요</span>
      {installable && <button type="button" className="btn btn-outline btn-sm" onClick={promptInstall}>앱 설치</button>}
    </div>
  );
}

// 학원명 찾기 결과가 어디 기준인지 — 나이스 실시간 / (나이스 무응답 시) 교육지원청 명단 동기화본
function LookupBasisNote({ result }) {
  const { source, basis, academy, verified } = result;
  const live = source === 'neis';
  return (
    <div className={`alert ${live ? 'is-ok' : 'is-warn'}`}>
      {live
        ? <>✔ 나이스 학원서비스에서 방금 가져온 교습비입니다{basis && ` (${basis})`}.</>
        : <>⚠ 나이스가 응답하지 않아 교육지원청 명단{basis && `(${basis} 동기화)`}의 교습비로 표시합니다. 최근에 교습비를 바꿨다면 잠시 후 다시 불러오세요.</>}
      {academy.changeDate && <> 교습비 적용일 {academy.changeDate}.</>}
      {!academy.regNo && <> 명단에 등록(신고)번호가 없어 게시표에는 번호 없이 나옵니다.</>}
      {verified === false && <> (본인 확인 자료가 없어 확인 없이 불러왔습니다)</>}
    </div>
  );
}

// 나이스 엑셀엔 등록번호가 없다 — 학원장이 번호를 넣고 확인되면 게시표에 "[등록번호: 제 ○○호]"를 넣는다
function RegNoAttach({ academy, onDone }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const info = await verifyAcademyRegNo(academy.name, value.trim());
      rememberAcademy({ name: academy.name, answer: value.trim(), regNo: info.regNo, category: info.category || '' });
      onDone(info);
    } catch (err) {
      setError(err.message || '확인하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card card-muted" style={{ marginBottom: '12px' }}>
      <div className="card-desc" style={{ marginBottom: '8px' }}>
        게시표에 등록(신고)번호를 넣으려면 번호를 입력하세요. (넣지 않으면 번호 없이 출력됩니다)
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="field"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          placeholder="예) 하남159"
          aria-label="등록(신고)번호"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
          {busy ? '확인 중…' : '번호 넣기'}
        </button>
      </div>
      {error && <div style={{ marginTop: '8px', color: 'var(--over)', fontSize: '0.9rem' }}>{error}</div>}
    </form>
  );
}

// 게시표 내보내기 — 내부용·외부용 두 줄, 줄마다 PDF(주 버튼) + JPG·HWPX·TEXT
function PrintButtons({ academy }) {
  const [downloading, setDownloading] = useState('');
  const [placeText, setPlaceText] = useState(null);

  async function withLoading(key, fn) {
    setDownloading(key);
    try { await fn(); } catch (e) { alert('다운로드 중 오류가 발생했습니다: ' + e.message); }
    finally { setDownloading(''); }
  }

  const rows = [
    {
      key: 'int', title: '내부용', desc: '교습실 안에 붙이는 게시표',
      pdf: () => printTuitionForm(academy),
      jpg: () => downloadTuitionInternalJPG(academy),
      hwpx: () => downloadTuitionInternalHWPX(academy),
    },
    {
      key: 'ext', title: '외부용', desc: '출입문·외부에 붙이는 게시표',
      pdf: () => printTuitionFormExternal(academy),
      jpg: () => downloadTuitionExternalJPG(academy),
      hwpx: () => downloadTuitionExternalHWPX(academy),
    },
  ];

  return (
    <div className="card">
      <div className="print-academy">
        <div className="print-academy-name">
          {academy.name}
          {getRegNoText(academy) && <span className="print-academy-no">{getRegNoText(academy)}</span>}
        </div>
        {academy.address && <div className="print-academy-sub">{academy.address}</div>}
        {academy.courses?.length > 0 && <div className="print-academy-sub">교습과정 {academy.courses.length}개</div>}
      </div>

      {rows.map(r => (
        <div key={r.key} className="print-row">
          <div className="print-row-head">
            <span className="print-row-title">교습비등 게시표 · {r.title}</span>
            <span className="print-row-desc">{r.desc}</span>
          </div>
          <div className="print-btns">
            <button type="button" className="btn btn-primary print-btn" onClick={r.pdf}>
              PDF 출력<small>인쇄용</small>
            </button>
            <button type="button" className="btn btn-outline print-btn" disabled={!!downloading} onClick={() => withLoading(`${r.key}-jpg`, r.jpg)}>
              {downloading === `${r.key}-jpg` ? '만드는 중…' : 'JPG 저장'}<small>블로그용</small>
            </button>
            <button type="button" className="btn btn-outline print-btn" disabled={!!downloading} onClick={() => withLoading(`${r.key}-hwpx`, r.hwpx)}>
              {downloading === `${r.key}-hwpx` ? '만드는 중…' : 'HWPX 저장'}<small>편집용</small>
            </button>
            <button type="button" className="btn btn-outline print-btn" onClick={() => setPlaceText(buildTuitionPlaceText(academy))}>
              TEXT 복사<small>네이버 플레이스용</small>
            </button>
          </div>
        </div>
      ))}

      {placeText !== null && (
        <TuitionTextModal text={placeText} academyName={academy.name} onClose={() => setPlaceText(null)} />
      )}
    </div>
  );
}
