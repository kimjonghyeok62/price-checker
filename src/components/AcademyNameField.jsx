import React, { useState } from 'react';
import { searchAcademyList } from '../utils/academyLookup';

// 등록신청서의 "학원(교습소)명" 칸 — 적는 대로 목록에서 추천하고, 고르면 onPick(item)
// 목록이 없으면(지역 미선택·목록 없음) 평범한 입력칸
export default function AcademyNameField({ value, onChange, list, onPick, placeholder, className = 'reg-input' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const items = list?.items || [];
  const suggestions = open && items.length ? searchAcademyList(items, value, 12) : [];
  const showBox = open && items.length > 0 && String(value || '').trim() !== '';

  function pick(item) {
    setOpen(false);
    onPick(item);
  }

  function onKeyDown(e) {
    if (e.nativeEvent.isComposing || !showBox || !suggestions.length) return; // 한글 조합 중 Enter는 글자 확정용
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[active] || suggestions[0]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="reg-name-field">
      <input
        className={className}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        aria-label="학원(교습소)명"
      />
      {showBox && (
        <ul className="reg-suggest" role="listbox">
          {suggestions.length === 0 && <li className="reg-suggest-empty">찾는 이름이 없습니다. 일부만 적어 보세요. (초성도 됩니다: ㅂㄹㅈ)</li>}
          {suggestions.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={e => { e.preventDefault(); pick(a); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="reg-suggest-name">{a.name}</span>
              <span className="reg-suggest-sub">{[a.kind, [a.sigun, a.dong].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
