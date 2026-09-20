/**
 * 교습비등 게시표 → 네이버 플레이스 소개글용 텍스트 변환
 *
 * 플레이스 소개글은 고정폭 폰트가 아니라 공백으로 맞춘 표가 깨진다.
 * 과정 하나를 슬래시로 구분한 한 줄로 만든다.
 */

import {
    getRegNoText,
    fmtNum,
    parseNum,
    formatChangeDateKo,
    OTHER_FEE_ITEMS,
} from './tuitionFormCommon';

/** 과정 1개 → '■ 초등부 / 수학A / 월 640분 / 160,000원 (재료비 10,000원 / 합계 170,000원)' */
function _courseLine(c) {
    const parts = [c.process, c.subject].filter(Boolean);

    const time = fmtNum(c.totalTime);
    if (time) parts.push(`월 ${time}분`);

    const tuitionNum = parseNum(c.tuitionFee || c.totalFee);
    const tuition = fmtNum(c.tuitionFee || c.totalFee);
    if (tuition) parts.push(`${tuition}원`);

    if (parts.length === 0) return '';

    let line = `■ ${parts.join(' / ')}`;

    // 금액이 0보다 큰 기타경비만 괄호로 덧붙이고, 그때만 합계를 표시한다
    const activeItems = OTHER_FEE_ITEMS.filter(it => parseNum(c[it.key]) > 0);
    if (activeItems.length > 0) {
        const feeStr = activeItems.map(it => `${it.label} ${fmtNum(c[it.key])}원`).join(', ');
        const total = tuitionNum + activeItems.reduce((s, it) => s + parseNum(c[it.key]), 0);
        line += ` (${feeStr} / 합계 ${total.toLocaleString('ko-KR')}원)`;
    }

    return line;
}

export function buildTuitionPlaceText(academy) {
    const courses = academy?.courses || [];
    const lines = [];

    lines.push(`${academy?.name || ''} 교습비 안내`);

    const regNoText = getRegNoText(academy);
    if (regNoText) lines.push(regNoText);

    const baseDate = formatChangeDateKo(academy?.changeDate || academy?.regDate || '');
    if (baseDate.year && baseDate.month && baseDate.day) {
        lines.push(`${baseDate.year}. ${baseDate.month}. ${baseDate.day}. 기준`);
    }

    const courseLines = courses.map(_courseLine).filter(Boolean);
    if (courseLines.length > 0) {
        lines.push('');
        lines.push(...courseLines);
    }

    const notes = [...new Set(courses.map(c => (c.note || '').trim()).filter(Boolean))];
    if (notes.length > 0) {
        lines.push('');
        lines.push(`※ 비고: ${notes.join(' / ')}`);
    }

    return lines.join('\n');
}
