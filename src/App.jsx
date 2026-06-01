import React, { useState, useRef } from 'react';
import './App.css';
import TuitionReviewTab from './components/TuitionReviewTab';
import { printTuitionForm, printTuitionFormExternal } from './utils/generateTuitionPDF';
import { downloadTuitionInternalDOCX, downloadTuitionExternalDOCX } from './utils/generateTuitionDOCX';
import { parseExcelTuition } from './utils/parseExcelTuition';
import { fetchGoogleSheetData, transformAcademyData, DATA_GID, GYOSEUPSO_GID } from './utils/googleSheets';

export default function App() {
  const [tab, setTab] = useState('review'); // 'review' | 'tutoring' | 'excel'

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

  async function loadAcademyData() {
    if (searchLoaded || searchLoading) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      const [academyData, gyoseupsoData] = await Promise.all([
        fetchGoogleSheetData(DATA_GID),
        fetchGoogleSheetData(GYOSEUPSO_GID),
      ]);
      setAcademies(transformAcademyData([...academyData, ...gyoseupsoData]));
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
    try {
      const result = await parseExcelTuition(file);
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

  const tabStyle = (active) => ({
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1.02rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    backgroundColor: active ? '#ffffff' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  });

  return (
    <div className="container">
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div className="app-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <h1 className="app-title">교습비 변경 및 출력</h1>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex',
        backgroundColor: '#f1f5f9',
        padding: '4px',
        borderRadius: '10px',
        marginBottom: '24px',
        gap: '4px',
        alignItems: 'stretch'
      }}>
        <button style={tabStyle(tab === 'review')} onClick={() => setTab('review')}>교습비 변경<br />(학원,교습소)</button>
        <button style={tabStyle(tab === 'tutoring')} onClick={() => setTab('tutoring')}>교습비 변경<br />(과외)</button>
        <button style={tabStyle(tab === 'excel')} onClick={() => setTab('excel')}>게시표 출력<br /><span style={{ fontSize: '0.72rem', fontWeight: '500', opacity: 0.75 }}>(PC용)</span></button>
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

      <footer className="app-footer">
        <div>본 계산기는 교습비 신고·변경신청 전 자체 검토 목적으로만 활용하세요.</div>
        <div>실제 신청은 관할 교육지원청에 문의하시기 바랍니다.</div>
      </footer>
    </div>
  );
}

function ExcelUploadTab({ excelLoading, excelError, excelAcademies, excelSelected, setExcelSelected, fileInputRef, handleFile }) {
  const [dragOver, setDragOver] = React.useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile({ target: { files: [file], value: '' } });
  }

  return (
    <>
      {/* 안내 박스 */}
      <div style={{
        backgroundColor: '#f8fafc', border: '1.5px solid var(--border-color)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '16px',
        fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-main)'
      }}>
        <div style={{ fontWeight: '700', marginBottom: '8px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          나이스 엑셀 파일 다운로드 방법 안내
        </div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '650' }}>
          방법: 나이스 학원 방문 ➔ 경기도교육청 선택 ➔ 학원 교습소 정보 조회
        </div>
        <ol style={{ paddingLeft: '20px', margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          <li>
            <a href="https://hakwon.neis.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'underline' }}>
              나이스 대국민 학원 서비스
            </a>에 접속합니다.
          </li>
          <li>본인 지역 교육청(예: 경기도교육청)을 선택합니다.</li>
          <li>[학원 교습소 정보 조회] 메뉴에서 학원 검색 후 교습비 정보를 엑셀 파일로 다운로드합니다.</li>
          <li>아래 업로드 영역에 다운로드한 엑셀 파일을 선택하거나 끌어다 놓으세요.</li>
        </ol>
        {/* 모바일 경고 */}
        <div style={{
          backgroundColor: '#fff7ed', border: '1px solid #fed7aa',
          borderRadius: '8px', padding: '10px 12px',
          display: 'flex', gap: '8px', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: '1.6' }}>
            <strong>PC 전용 기능입니다.</strong><br />
            나이스 모바일 앱·모바일 웹에서 받은 엑셀 파일은 열 구조가 달라 <strong>교습과정·교습비가 올바르게 출력되지 않습니다.</strong><br />
            반드시 <strong>PC에서 나이스 접속 후 파일을 다운로드</strong>하여 사용하세요.
          </div>
        </div>
      </div>

      {/* 드래그앤드롭 + 파일 선택 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border-color)'}`,
          borderRadius: '12px', padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
          backgroundColor: dragOver ? '#eef2ff' : 'var(--bg-card)',
          marginBottom: '20px', transition: 'border-color 0.15s, background-color 0.15s',
        }}
        onMouseEnter={e => { if (!dragOver) e.currentTarget.style.borderColor = 'var(--primary)'; }}
        onMouseLeave={e => { if (!dragOver) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', marginBottom: '10px' }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
          {excelLoading ? '파일 분석 중...' : dragOver ? '여기에 놓으세요!' : '엑셀 파일 선택 또는 여기에 끌어다 놓기'}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          교육청 표준 학원교습비 목록 파일 (.xlsx) · PC 버전 나이스 파일만 지원
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {excelError && (
        <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {excelError}
        </div>
      )}

      {excelAcademies.length > 1 && !excelSelected && (
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '10px' }}>
            파일에서 {excelAcademies.length}개 학원을 찾았습니다. 출력할 학원을 선택하세요.
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {excelAcademies.map((a, i) => (
              <li key={i}
                onClick={() => setExcelSelected(a)}
                style={{ padding: '12px 16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{a.name}</div>
                {a.address && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{a.address}</div>}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>교습과정 {a.courses.length}개</div>
              </li>
            ))}
          </ul>
        </div>
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

      {!excelAcademies.length && !excelLoading && !excelError && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '8px', lineHeight: '1.6' }}>
          교육청에서 제공하는<br />학원 교습비 목록 엑셀 파일을 업로드하세요.<br />
          <span style={{ fontSize: '0.78rem' }}>(성명·비고 등 누락된 항목은 빈칸으로 출력됩니다)</span>
        </div>
      )}
    </>
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

  function BtnDOCX({ onClick, label, busy, size = 'normal' }) {
    const isLarge = size === 'large';
    return (
      <button
        onClick={onClick}
        disabled={!!downloading}
        style={{
          padding: isLarge ? '14px 10px' : '12px 8px',
          backgroundColor: busy ? '#dbeafe' : '#eff6ff',
          color: '#1d4ed8',
          border: '2px solid #93c5fd',
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
        <DocxIcon busy={busy} size={isLarge ? 16 : 14} /> {busy ? '생성중...' : label}
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
        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>{academy.name}</div>
        {academy.address && <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{academy.address}</div>}
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
          <BtnDOCX onClick={() => withLoading('int-docx', () => downloadTuitionInternalDOCX(academy))} label="DOCX 저장" busy={downloading === 'int-docx'} size="large" />
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
          <BtnDOCX onClick={() => withLoading('ext-docx', () => downloadTuitionExternalDOCX(academy))} label="DOCX 저장" busy={downloading === 'ext-docx'} size="large" />
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
function DocxIcon({ busy, size = 13 }) {
  return busy
    ? <span style={{ fontSize: '0.9rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
    : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
}
