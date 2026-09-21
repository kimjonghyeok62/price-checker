import React, { useEffect, useRef, useState } from 'react';
import {
  loadAcademyList, searchAcademyList, lookupAcademy, readMyAcademies, rememberAcademy, forgetAcademy,
} from '../utils/academyLookup';

// 게시표 출력 탭 맨 위 "학원명으로 바로 찾기" — 학원 고르기 → 등록(신고)번호 확인 → 나이스 실시간 교습비

const cardStyle = {
  backgroundColor: '#ecfdf5', border: '2px solid #6ee7b7', borderRadius: '14px', padding: '18px', marginBottom: '14px',
};
const inputBoxStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff',
  border: '1.5px solid #a7f3d0', borderRadius: '10px', padding: '11px 14px',
};
const inputStyle = {
  flex: 1, minWidth: 0, width: '100%', border: 'none', background: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text-main)',
};

export default function AcademyLookupCard({ onResult }) {
  const [list, setList] = useState(null);
  const [listError, setListError] = useState('');
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [picked, setPicked] = useState(null);
  const [regNo, setRegNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mine, setMine] = useState(readMyAcademies);
  const regNoRef = useRef(null);
  const queryRef = useRef(null);

  function fetchList() {
    setListError('');
    loadAcademyList()
      .then(setList)
      .catch(() => setListError('학원 목록을 불러오지 못했습니다.'));
  }
  useEffect(fetchList, []);

  // 학원을 고르면 바로 번호 칸으로
  const pickedId = picked?.id;
  useEffect(() => { if (pickedId) regNoRef.current?.focus(); }, [pickedId]);

  const suggestions = list && showSuggestions ? searchAcademyList(list.items, query) : [];

  function pick(item) {
    setPicked(item);
    setQuery(item.name);
    setShowSuggestions(false);
    setRegNo('');
    setError('');
    onResult(null);
  }

  function reset() {
    setPicked(null);
    setQuery('');
    setRegNo('');
    setError('');
    onResult(null);
    setTimeout(() => queryRef.current?.focus(), 0);
  }

  async function run(id, number, name) {
    setBusy(true);
    setError('');
    onResult(null);
    try {
      const res = await lookupAcademy(id, number);
      rememberAcademy({ id, name, regNo: number, category: res.academy.category || '' });
      setMine(readMyAcademies());
      onResult(res);
    } catch (e) {
      setError(e.message || '교습비를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!picked || busy) return;
    if (!regNo.trim()) { setError('등록(신고)번호를 입력하세요.'); regNoRef.current?.focus(); return; }
    run(picked.id, regNo.trim(), picked.name);
  }

  function openMine(m) {
    const item = list?.items.find(x => x.id === m.id) || null;
    setPicked(item || { id: m.id, name: m.name, kind: '', sigun: '', dong: '' });
    setQuery(m.name);
    setRegNo(m.regNo);
    run(m.id, m.regNo, m.name);
  }

  function removeMine(m) {
    forgetAcademy(m.name);
    setMine(readMyAcademies());
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#064e3b' }}>학원명으로 바로 찾기</span>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#047857', backgroundColor: '#d1fae5', border: '1.5px solid #6ee7b7', borderRadius: '20px', padding: '1px 9px' }}>
          나이스 실시간
        </span>
      </div>
      <div style={{ fontSize: '0.85rem', color: '#065f46', marginBottom: '12px', wordBreak: 'keep-all' }}>
        엑셀을 받지 않아도 됩니다. 학원명을 고르고 등록(신고)번호를 넣으면 나이스에 입력된 교습비로 게시표를 만듭니다.
        {list?.items.length > 0 && <> (현재 {[...new Set(list.items.map(a => a.sigun).filter(Boolean))].join('·')} 학원·교습소)</>}
      </div>

      {mine.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {mine.map(m => (
            <span key={m.id || m.name} style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#fff', border: '1.5px solid #6ee7b7', borderRadius: '20px', overflow: 'hidden' }}>
              <button type="button" onClick={() => openMine(m)} disabled={busy || !m.id}
                style={{ border: 'none', background: 'none', padding: '6px 4px 6px 12px', fontSize: '0.88rem', fontWeight: '700', color: '#047857', cursor: busy ? 'wait' : 'pointer' }}>
                ★ {m.name}
              </button>
              <button type="button" onClick={() => removeMine(m)} aria-label={`${m.name} 기억 지우기`}
                style={{ border: 'none', background: 'none', padding: '6px 10px 6px 4px', fontSize: '0.95rem', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {listError && (
        <div style={{ color: '#b91c1c', fontSize: '0.88rem', marginBottom: '10px' }}>
          {listError}{' '}
          <button type="button" onClick={fetchList} style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', padding: 0 }}>다시 시도</button>
        </div>
      )}

      <form onSubmit={submit}>
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <div style={inputBoxStyle}>
            <input
              ref={queryRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setPicked(null); setShowSuggestions(true); setError(''); onResult(null); }}
              onFocus={() => query && !picked && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={list ? '학원·교습소 이름 (예: 브릿지, ㅂㄹㅈ)' : '목록 불러오는 중...'}
              disabled={!list}
              aria-label="학원·교습소 이름"
              autoComplete="off"
              style={inputStyle}
            />
            {query && (
              <button type="button" onClick={reset} aria-label="지우기"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.15rem', padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>

          {showSuggestions && query.trim() && list && (
            <ul style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px',
              boxShadow: 'var(--shadow-md)', margin: 0, padding: '4px 0', listStyle: 'none', maxHeight: '280px', overflowY: 'auto',
            }}>
              {suggestions.length === 0 && (
                <li style={{ padding: '12px 14px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  찾는 이름이 없습니다. 일부만 입력해 보세요.
                </li>
              )}
              {suggestions.map(a => (
                <li key={a.id} onMouseDown={e => { e.preventDefault(); pick(a); }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
                  <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>{a.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {[a.kind, [a.sigun, a.dong].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {picked && (
          <div className="animate-enter">
            <label htmlFor="academy-regno" style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#065f46', marginBottom: '6px' }}>
              {picked.kind === '교습소' ? '신고번호' : '등록번호'} (등록증·신고증에 있는 번호)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ ...inputBoxStyle, flex: 1, minWidth: 0 }}>
                <input
                  id="academy-regno"
                  ref={regNoRef}
                  type="text"
                  value={regNo}
                  onChange={e => { setRegNo(e.target.value); setError(''); }}
                  placeholder="예) 하남159"
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>
              <button type="submit" disabled={busy}
                style={{
                  flexShrink: 0, padding: '0 16px', borderRadius: '10px', whiteSpace: 'nowrap', border: 'none', backgroundColor: '#059669', color: '#fff',
                  fontSize: '1rem', fontWeight: '800', cursor: busy ? 'wait' : 'pointer', boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
                  opacity: busy ? 0.7 : 1,
                }}>
                {busy ? '불러오는 중…' : '교습비 불러오기'}
              </button>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div style={{ marginTop: '10px', color: '#b91c1c', fontSize: '0.88rem', padding: '9px 12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
    </div>
  );
}
