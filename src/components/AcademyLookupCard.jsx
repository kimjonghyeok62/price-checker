import React, { useEffect, useRef, useState } from 'react';
import { useRegion } from '../RegionContext';
import {
  loadAcademyList, searchAcademyList, lookupAcademy, readMyAcademies, rememberAcademy, forgetAcademy,
} from '../utils/academyLookup';

// 게시표 출력 탭 맨 위 "학원명으로 바로 찾기" — 학원 고르기 → 본인 확인(번호·이름, 자료가 없으면 생략) → 나이스 실시간 교습비

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

// 고른 학원의 본인 확인 방법에 맞는 안내 — check: 'N' 번호, 'P' 이름, 'NP' 둘 중 하나, '' 없음
function answerPrompt(item) {
  const noLabel = item.kind === '교습소' ? '신고번호' : '등록번호';
  const person = item.kind === '교습소' ? '교습자' : '설립·운영자';
  if (item.check === 'NP') return { label: `${noLabel} 또는 ${person} 이름`, placeholder: '예) 하남159 또는 홍길동' };
  if (item.check === 'N') return { label: `${noLabel} (등록증·신고증에 있는 번호)`, placeholder: '예) 하남159' };
  if (item.check === 'P') return { label: `${person} 이름 (법인은 법인명)`, placeholder: '예) 홍길동' };
  return null;
}

export default function AcademyLookupCard({ onResult }) {
  const { region } = useRegion();
  const [list, setList] = useState(null);
  const [listError, setListError] = useState('');
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [picked, setPicked] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mine, setMine] = useState(readMyAcademies);
  const answerRef = useRef(null);
  const queryRef = useRef(null);
  const runSeqRef = useRef(0); // 지역을 바꾸거나 다시 조회하면 늦게 도착한 이전 결과는 버린다

  function fetchList() {
    setList(null);
    setListError('');
    if (!region) return;
    loadAcademyList(region)
      .then(setList)
      .catch(() => setListError('학원 목록을 불러오지 못했습니다.'));
  }
  // 교육지원청을 바꾸면 그 지역 목록으로
  useEffect(() => {
    fetchList();
    setPicked(null);
    setQuery('');
    setAnswer('');
    setError('');
    runSeqRef.current++;
    setBusy(false);
    onResult(null);
  }, [region]); // eslint-disable-line react-hooks/exhaustive-deps

  // 학원을 고르면 바로 확인 칸으로
  const pickedId = picked?.id;
  useEffect(() => { if (pickedId) answerRef.current?.focus(); }, [pickedId]);

  const suggestions = list && showSuggestions ? searchAcademyList(list.items, query) : [];
  const prompt = picked ? answerPrompt(picked) : null;
  const sigunText = list ? [...new Set(list.items.map(a => a.sigun).filter(Boolean))].join('·') : '';

  function pick(item) {
    setPicked(item);
    setQuery(item.name);
    setShowSuggestions(false);
    setAnswer('');
    setError('');
    onResult(null);
  }

  function reset() {
    setPicked(null);
    setQuery('');
    setAnswer('');
    setError('');
    onResult(null);
    setTimeout(() => queryRef.current?.focus(), 0);
  }

  async function run(id, value, name) {
    const seq = ++runSeqRef.current;
    setBusy(true);
    setError('');
    onResult(null);
    try {
      const res = await lookupAcademy(id, value);
      rememberAcademy({ id, name, answer: value, regNo: res.academy.regNo || '', category: res.academy.category || '' });
      setMine(readMyAcademies());
      if (seq === runSeqRef.current) onResult(res);
    } catch (e) {
      if (seq === runSeqRef.current) setError(e.message || '교습비를 불러오지 못했습니다.');
    } finally {
      if (seq === runSeqRef.current) setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!picked || busy) return;
    if (prompt && !answer.trim()) { setError(`${prompt.label}을(를) 입력하세요.`); answerRef.current?.focus(); return; }
    run(picked.id, prompt ? answer.trim() : '', picked.name);
  }

  function openMine(m) {
    const item = list?.items.find(x => x.id === m.id) || null;
    setPicked(item || { id: m.id, name: m.name, kind: '', sigun: '', dong: '', check: m.answer ? 'N' : '' });
    setQuery(m.name);
    setAnswer(m.answer);
    run(m.id, m.answer, m.name);
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
        엑셀을 받지 않아도 됩니다. 학원명을 고르고 본인 확인을 하면 나이스에 입력된 교습비로 게시표를 만듭니다.
        {list?.items.length > 0 && <> (현재 {sigunText} 학원·교습소)</>}
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

      {!region && (
        <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#b45309', padding: '10px 12px', backgroundColor: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '8px' }}>
          맨 위에서 교육지원청(지역)을 먼저 선택하세요.
        </div>
      )}

      {listError && (
        <div style={{ color: '#b91c1c', fontSize: '0.88rem', marginBottom: '10px' }}>
          {listError}{' '}
          <button type="button" onClick={fetchList} style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', padding: 0 }}>다시 시도</button>
        </div>
      )}

      {region && list && list.items.length === 0 && (
        <div style={{ fontSize: '0.88rem', color: '#92400e', padding: '10px 12px', backgroundColor: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '8px', wordBreak: 'keep-all' }}>
          {region}교육지원청 관내는 아직 검색 목록이 없습니다. 아래 "나이스에서 엑셀을 받아 올리기"를 이용하세요.
        </div>
      )}

      {region && !(list && list.items.length === 0) && (
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
              {prompt ? (
                <label htmlFor="academy-answer" style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#065f46', marginBottom: '6px' }}>
                  {prompt.label}
                </label>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#065f46', marginBottom: '8px', wordBreak: 'keep-all' }}>
                  {picked.kind === '교습소' ? '이 교습소는' : '이 학원은'} 본인 확인 자료가 없어 확인 없이 불러옵니다.
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {prompt && (
                  <div style={{ ...inputBoxStyle, flex: 1, minWidth: 0 }}>
                    <input
                      id="academy-answer"
                      ref={answerRef}
                      type="text"
                      value={answer}
                      onChange={e => { setAnswer(e.target.value); setError(''); }}
                      placeholder={prompt.placeholder}
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </div>
                )}
                <button type="submit" disabled={busy}
                  style={{
                    flex: prompt ? '0 0 auto' : 1, padding: prompt ? '0 16px' : '13px 16px', borderRadius: '10px', whiteSpace: 'nowrap',
                    border: 'none', backgroundColor: '#059669', color: '#fff',
                    fontSize: '1rem', fontWeight: '800', cursor: busy ? 'wait' : 'pointer', boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
                    opacity: busy ? 0.7 : 1,
                  }}>
                  {busy ? '불러오는 중…' : '교습비 불러오기'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {error && (
        <div style={{ marginTop: '10px', color: '#b91c1c', fontSize: '0.88rem', padding: '9px 12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
    </div>
  );
}
