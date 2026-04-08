import React from 'react';
import './App.css';
import TuitionReviewTab from './components/TuitionReviewTab';

export default function App() {
  return (
    <div className="container">
      <header className="app-header">
        <div className="app-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <h1 className="app-title">교습비 계산기</h1>
      </header>

      <TuitionReviewTab />

      <footer className="app-footer">
        <div>본 계산기는 교습비 신고·변경신청 전 자체 검토 목적으로만 활용하세요.</div>
        <div>실제 신청은 관할 교육지원청에 문의하시기 바랍니다.</div>
      </footer>
    </div>
  );
}
