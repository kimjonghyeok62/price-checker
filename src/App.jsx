import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import TuitionReviewTab from './components/TuitionReviewTab';
import { printTuitionForm, printTuitionFormExternal } from './utils/generateTuitionPDF';
import { downloadTuitionInternalDOCX, downloadTuitionExternalDOCX } from './utils/generateTuitionDOCX';
import { downloadTuitionInternalJPG, downloadTuitionExternalJPG } from './utils/generateTuitionJPG';
import { downloadTuitionInternalHWPX, downloadTuitionExternalHWPX } from './utils/generateTuitionHWPX';
import { getRegNoText } from './utils/tuitionFormCommon';
import { parseExcelTuition } from './utils/parseExcelTuition';
import { fetchGoogleSheetData, transformAcademyData, attachRegNo, DATA_GID, GYOSEUPSO_GID } from './utils/googleSheets';
import StandardPriceTable from './components/StandardPriceTable';
import RegionAdmin from './components/RegionAdmin';
import { useRegion } from './RegionContext';
import { REGION_NAMES } from './utils/regionRates';
import { takeSharedFile, canPromptInstall, onInstallPromptChange, promptInstall, isAndroid, isInstalledApp } from './utils/pwa';
import { NeisHakwonCard, ExcelUploadCard, AcademyPickList, hasDraggedFiles } from './components/NeisExcelSteps';

export default function App() {
  const [tab, setTab] = useState('excel'); // 'review' | 'tutoring' | 'excel'
  const [showStandardPrices, setShowStandardPrices] = useState(false);
  const [showRegionAdmin, setShowRegionAdmin] = useState(false);
  const { region, setRegion, effectiveDate } = useRegion();

  // 학원 검색 탭
  const [academies, setAcademies] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoaded, setSearchLoaded] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);

  // 업로드 탭
  const [excelAcademies, setExcelAcademies] = useState([]);
  const [excelSelected, setExcelSelected] = useState(null);
  const [excelError, setExcelError] = useState('');
  const [excelLoading, setExcelLoading] = useState(false);
  const fileInputRef = useRef(null);
  const uploadSeqRef = useRef(0);

  // 구글시트 학원·교습소 목록 (한 번만 받아서 재사용, 실패 시 다음에 다시 시도)
  const masterAcademiesRef = useRef(null);
  function loadMasterAcademies() {
    if (!masterAcademiesRef.current) {
      masterAcademiesRef.current = Promise.all([
        fetchGoogleSheetData(DATA_GID),
        fetchGoogleSheetData(GYOSEUPSO_GID),
      ])
        .then(([academyData, gyoseupsoData]) => transformAcademyData([...academyData, ...gyoseupsoData]))
        .catch(err => { masterAcademiesRef.current = null; throw err; });
    }
    return masterAcademiesRef.current;
  }

  async function loadAcademyData() {
    if (searchLoaded || searchLoading) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      setAcademies(await loadMasterAcademies());
      setSearchLoaded(true);
    } catch (err) {
      setSearchError('데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSearchLoading(false);
    }
  }

  function handleTabChange(newTab) {
    setTab(newTab);
    if (newTab === 'search') loadAcademyData();
  }

  const suggestions = query.trim()
    ? academies
        .filter(a =>
          ['개원', '신고'].includes(a.status) &&
          (a.name?.includes(query) || a.founder?.name?.includes(query) || a.address?.includes(query))
        )
        .slice(0, 20)
    : [];

  function handleSelect(academy) {
    setSelected(academy);
    setQuery(academy.name || '');
    setShowSuggestions(false);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelError('');
    setExcelLoading(true);
    setExcelAcademies([]);
    setExcelSelected(null);
    const seq = ++uploadSeqRef.current;
    try {
      const result = await parseExcelTuition(file);
      if (!result.length) {
        setExcelError('파싱된 학원 데이터가 없습니다. 파일 형식을 확인하세요.');
      } else {
        setExcelAcademies(result);
        if (result.length === 1) setExcelSelected(result[0]);
        // 나이스 엑셀엔 등록번호가 없어 구글시트에서 찾아 붙인다 (실패하면 등록번호 없이 출력)
        loadMasterAcademies()
          .then(master => {
            if (seq !== uploadSeqRef.current) return;
            const enriched = attachRegNo(result, master);
            setExcelAcademies(enriched);
            setExcelSelected(prev => (prev ? enriched.find(a => a.name === prev.name) || prev : prev));
          })
          .catch(() => {});
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
    setTab('excel');
    takeSharedFile()
      .then(file => { if (file) handleFile({ target: { files: [file], value: '' } }); })
      .catch(() => {});
  }, []);

  const tabStyle = (active) => ({
    flex: 1,
    padding: '12px 4px',
    border: '1px solid ' + (active ? 'rgba(79, 70, 229, 0.08)' : 'transparent'),
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: active ? '#ffffff' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    boxShadow: active ? '0 4px 10px rgba(79, 70, 229, 0.12), 0 2px 4px rgba(0, 0, 0, 0.02)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    lineHeight: '1.25',
    transform: active ? 'scale(1.02)' : 'scale(1)',
  });

  if (showStandardPrices) {
    return <StandardPriceTable onBack={() => setShowStandardPrices(false)} />;
  }
  if (showRegionAdmin) {
    return <RegionAdmin onBack={() => setShowRegionAdmin(false)} />;
  }

  return (
    <div className="container">
      {/* 헤더 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '22px', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="app-icon" style={{ width: '32px', height: '32px', borderRadius: '9px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 11 2 2 4-4"/>
            </svg>
          </div>
          <h1 className="app-title">교습비 계산·게시표</h1>
        </div>
        <div className="app-region-bar">
          <label className={`app-region${region ? '' : ' is-empty'}`} title={effectiveDate ? `교습비등 조정위원회 개최일 ${effectiveDate}` : undefined}>
            <svg className="app-region-pin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/>
              <circle cx="12" cy="10" r="2.5"/>
            </svg>
            <span className="app-region-text">경기도</span>
            <select className="app-region-select" value={region} onChange={e => setRegion(e.target.value)} aria-label="교육지원청 선택">
              <option value="">지역 선택</option>
              {REGION_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <span className="app-region-text">교육지원청 교습비 기준</span>
          </label>
          <button type="button" className="app-std-btn" onClick={() => setShowStandardPrices(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            기준단가 보기
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex',
        backgroundColor: '#f8fafc',
        padding: '5px',
        borderRadius: '12px',
        marginBottom: '26px',
        gap: '6px',
        alignItems: 'stretch',
        border: '1px solid #e2e8f0',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <button className="tab-btn" style={tabStyle(tab === 'review')} onClick={() => setTab('review')}>
          <svg className="tab-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="tab-maintext">학원·교습소</span>
          <span className="tab-subtext">교습비 변경</span>
        </button>
        <button className="tab-btn" style={tabStyle(tab === 'tutoring')} onClick={() => setTab('tutoring')}>
          <svg className="tab-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
          </svg>
          <span className="tab-maintext">개인과외</span>
          <span className="tab-subtext">교습비 변경</span>
        </button>
        <button className="tab-btn" style={tabStyle(tab === 'excel')} onClick={() => setTab('excel')}>
          <svg className="tab-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          <span className="tab-maintext">게시표 출력</span>
          <span className="tab-subtext">(나이스자료 이용)</span>
        </button>
      </div>

      {/* ── 탭: 교습비 변경(학원,교습소) ── */}
      {tab === 'review' && <TuitionReviewTab mode="academy" />}

      {/* ── 탭: 교습비 변경(과외) ── */}
      {tab === 'tutoring' && <TuitionReviewTab mode="tutoring" />}

      {/* ── 탭: 학원 검색 ── */}
      {tab === 'search' && (
        <>
          {searchLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--primary-glow)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              학원 데이터를 불러오는 중...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {searchError && (
            <div style={{ color: '#dc2626', fontSize: '0.85rem', padding: '12px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '16px' }}>
              {searchError}
              <button onClick={loadAcademyData} style={{ display: 'block', marginTop: '8px', padding: '6px 14px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                다시 시도
              </button>
            </div>
          )}

          {!searchLoading && searchLoaded && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>학원 선택</label>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSelected(null); setShowSuggestions(true); }}
                    onFocus={() => query && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="학원명, 운영자, 주소 입력..."
                    style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: '0.95rem', color: 'var(--text-main)' }}
                  />
                  {query && (
                    <button type="button" onClick={() => { setQuery(''); setSelected(null); setShowSuggestions(false); searchInputRef.current?.focus(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>×</button>
                  )}
                </div>

                {showSuggestions && suggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: '10px', boxShadow: 'var(--shadow-md)',
                    margin: 0, padding: '4px 0', listStyle: 'none', zIndex: 100,
                    maxHeight: '260px', overflowY: 'auto'
                  }}>
                    {suggestions.map(a => (
                      <li key={a.id || a.name} onMouseDown={() => handleSelect(a)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{a.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {a.founder?.name && <span style={{ marginRight: '8px' }}>{a.founder.name}</span>}
                          {a.address && <span>{a.address}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {selected && <PrintButtons academy={selected} />}

          {!selected && !searchLoading && searchLoaded && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '40px', lineHeight: '1.6' }}>
              학원을 검색하여 선택하면<br />교습비등 게시표를 출력할 수 있습니다.
            </div>
          )}
        </>
      )}

      {/* ── 탭: 업로드 ── */}
      {tab === 'excel' && (
        <ExcelUploadTab
          excelLoading={excelLoading}
          excelError={excelError}
          excelAcademies={excelAcademies}
          excelSelected={excelSelected}
          setExcelSelected={setExcelSelected}
          fileInputRef={fileInputRef}
          handleFile={handleFile}
        />
      )}

      {tab !== 'excel' && (
        <footer className="app-footer">
          <div>본 계산기는 교습비 신고·변경신청 전 자체 검토 목적으로만 활용하세요.</div>
          <div>실제 신청은 관할 교육지원청에 문의하시기 바랍니다.</div>
        </footer>
      )}

      <div className="app-admin-link-wrap">
        <button type="button" className="app-admin-link" onClick={() => setShowRegionAdmin(true)}>교육지원청 담당자 기준단가 입력</button>
      </div>
    </div>
  );
}

function ExcelUploadTab({ excelLoading, excelError, excelAcademies, excelSelected, setExcelSelected, fileInputRef, handleFile }) {
  const [dragOver, setDragOver] = React.useState(false);
  const dragDepthRef = useRef(0);
  const [installable, setInstallable] = useState(canPromptInstall());
  useEffect(() => onInstallPromptChange(() => setInstallable(canPromptInstall())), []);
  const showAndroidTip = isAndroid() && !isInstalledApp();

  const loadFile = (file) => { if (file) handleFile({ target: { files: [file], value: '' } }); };

  // 게시표 탭 어디에 끌어다 놓아도 업로드
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
      <NeisHakwonCard />
      <ExcelUploadCard loading={excelLoading} dragOver={dragOver} fileInputRef={fileInputRef} onFile={loadFile} />

      {showAndroidTip && (
        <div style={{ marginTop: '-10px', marginBottom: '20px', fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>📱 앱을 설치하면 받은 엑셀을 '공유 → 교습비 계산·게시표'로 바로 열 수 있어요</span>
          {installable && (
            <button onClick={promptInstall} style={{ padding: '4px 10px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer' }}>
              앱 설치
            </button>
          )}
        </div>
      )}

      {excelError && (
        <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {excelError}
        </div>
      )}

      {excelAcademies.length > 1 && !excelSelected && (
        <AcademyPickList academies={excelAcademies} onSelect={setExcelSelected} />
      )}

      {excelSelected && (
        <div className="animate-enter">
          {excelAcademies.length > 1 && (
            <button
              onClick={() => setExcelSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.83rem', marginBottom: '12px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              목록으로 돌아가기
            </button>
          )}
          <PrintButtons academy={excelSelected} />
        </div>
      )}


      {/* 교습비등 반환기준 게시표 — 위 게시표 카드와 같은 형식, 주황 계열로 구분 */}
      <div style={{
        marginTop: '20px', backgroundColor: '#fffbeb', border: '2px solid #fcd34d',
        borderRadius: '14px', padding: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <div style={{ width: '4px', height: '22px', backgroundColor: '#d97706', borderRadius: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#78350f', letterSpacing: '-0.01em' }}>
            교습비등 반환기준 게시표
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#b45309', backgroundColor: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: '20px', padding: '2px 10px' }}>
            [별지 제5호서식]
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#92400e', marginBottom: '12px', paddingLeft: '12px', wordBreak: 'keep-all' }}>
          경기도 학원의 설립·운영 및 과외교습에 관한 조례 시행규칙
        </div>
        <a
          href="/refund-standard.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '14px 18px', borderRadius: '10px', backgroundColor: '#d97706', color: '#fff',
            fontSize: '1rem', fontWeight: '800', textDecoration: 'none', boxShadow: '0 3px 10px rgba(217,119,6,0.3)',
            transition: 'filter 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
          반환기준 게시표 PDF 보기
        </a>
      </div>
    </div>
  );
}

function PrintButtons({ academy }) {
  const [downloading, setDownloading] = useState('');

  async function withLoading(key, fn) {
    setDownloading(key);
    try { await fn(); } catch (e) { alert('다운로드 중 오류가 발생했습니다: ' + e.message); }
    finally { setDownloading(''); }
  }

  function BtnPDF({ onClick, label, size = 'normal' }) {
    const isLarge = size === 'large';
    return (
      <button
        onClick={onClick}
        style={{
          padding: isLarge ? '14px 10px' : '12px 8px',
          backgroundColor: 'var(--primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          fontSize: isLarge ? '1rem' : '0.92rem',
          fontWeight: '700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          boxShadow: '0 2px 6px rgba(99,102,241,0.25)',
          transition: 'filter 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
        onMouseLeave={e => e.currentTarget.style.filter = ''}
      >
        <PrintIcon size={isLarge ? 16 : 14} /> {label}
      </button>
    );
  }

  const SAVE_THEMES = {
    jpg: { bg: '#ecfdf5', busyBg: '#d1fae5', color: '#047857', border: '#6ee7b7' },
    docx: { bg: '#eff6ff', busyBg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    hwpx: { bg: '#f0f9ff', busyBg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
  };

  function BtnSave({ onClick, label, busy, theme = 'docx', size = 'normal' }) {
    const isLarge = size === 'large';
    const t = SAVE_THEMES[theme];
    return (
      <button
        onClick={onClick}
        disabled={!!downloading}
        style={{
          padding: isLarge ? '14px 10px' : '12px 8px',
          backgroundColor: busy ? t.busyBg : t.bg,
          color: t.color,
          border: `2px solid ${t.border}`,
          borderRadius: '10px',
          fontSize: isLarge ? '1rem' : '0.92rem',
          fontWeight: '700',
          cursor: downloading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          opacity: downloading && !busy ? 0.55 : 1,
          transition: 'filter 0.15s',
        }}
        onMouseEnter={e => { if (!downloading) e.currentTarget.style.filter = 'brightness(0.95)'; }}
        onMouseLeave={e => e.currentTarget.style.filter = ''}
      >
        {theme === 'jpg'
          ? <ImageIcon busy={busy} size={isLarge ? 16 : 14} />
          : <DocxIcon busy={busy} size={isLarge ? 16 : 14} />} {busy ? '생성중...' : label}
      </button>
    );
  }

  const sectionCard = (color, bgColor, borderColor, iconColor) => ({
    backgroundColor: bgColor,
    border: `2px solid ${borderColor}`,
    borderRadius: '12px',
    padding: '18px 18px 16px',
    marginBottom: '12px',
  });

  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
      {/* 학원 정보 */}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1.5px solid var(--border-color)' }}>
        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>
          {academy.name}
          {getRegNoText(academy) && (
            <span style={{ marginLeft: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>{getRegNoText(academy)}</span>
          )}
        </div>
        {academy.address &&<div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{academy.address}</div>}
        {academy.courses?.length > 0 && (
          <div style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.78rem', color: '#6366f1', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '2px 8px', fontWeight: '600' }}>
            교습과정 {academy.courses.length}개
          </div>
        )}
      </div>

      {/* 내부용 */}
      <div style={sectionCard('#6366f1', '#f5f3ff', '#c4b5fd', '#7c3aed')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '4px', height: '22px', backgroundColor: '#7c3aed', borderRadius: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#4c1d95', letterSpacing: '-0.01em' }}>
            교습비등 게시표
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#7c3aed', backgroundColor: '#ede9fe', border: '1.5px solid #c4b5fd', borderRadius: '20px', padding: '2px 10px' }}>
            내부용
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <BtnPDF onClick={() => printTuitionForm(academy)} label="PDF 출력" size="large" />
          <BtnSave theme="jpg" onClick={() => withLoading('int-jpg', () => downloadTuitionInternalJPG(academy))} label="JPG 저장" busy={downloading === 'int-jpg'} size="large" />
          <BtnSave theme="docx" onClick={() => withLoading('int-docx', () => downloadTuitionInternalDOCX(academy))} label="DOCX 저장" busy={downloading === 'int-docx'} size="large" />
          <BtnSave theme="hwpx" onClick={() => withLoading('int-hwpx', () => downloadTuitionInternalHWPX(academy))} label="HWPX 저장" busy={downloading === 'int-hwpx'} size="large" />
        </div>
      </div>

      {/* 외부용 */}
      <div style={{ ...sectionCard('#0ea5e9', '#f0f9ff', '#7dd3fc', '#0369a1'), marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '4px', height: '22px', backgroundColor: '#0369a1', borderRadius: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0c4a6e', letterSpacing: '-0.01em' }}>
            교습비등 게시표
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0369a1', backgroundColor: '#e0f2fe', border: '1.5px solid #7dd3fc', borderRadius: '20px', padding: '2px 10px' }}>
            외부용
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <BtnPDF onClick={() => printTuitionFormExternal(academy)} label="PDF 출력" size="large" />
          <BtnSave theme="jpg" onClick={() => withLoading('ext-jpg', () => downloadTuitionExternalJPG(academy))} label="JPG 저장" busy={downloading === 'ext-jpg'} size="large" />
          <BtnSave theme="docx" onClick={() => withLoading('ext-docx', () => downloadTuitionExternalDOCX(academy))} label="DOCX 저장" busy={downloading === 'ext-docx'} size="large" />
          <BtnSave theme="hwpx" onClick={() => withLoading('ext-hwpx', () => downloadTuitionExternalHWPX(academy))} label="HWPX 저장" busy={downloading === 'ext-hwpx'} size="large" />
        </div>
      </div>
    </div>
  );
}

function PrintIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"></polyline>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8"></rect>
    </svg>
  );
}
function ImageIcon({ busy, size = 13 }) {
  return busy
    ? <span style={{ fontSize: '0.9rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
    : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>;
}
function DocxIcon({ busy, size = 13 }) {
  return busy
    ? <span style={{ fontSize: '0.9rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
    : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
}
