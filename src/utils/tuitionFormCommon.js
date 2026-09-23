/**
 * 교습비등 게시표 출력(PDF / JPG / HWPX / TEXT) 공통 헬퍼
 */

/**
 * 학원명 옆에 붙는 등록번호 문구
 *  - 학원   : [등록번호: 제 하남285호]
 *  - 교습소 : [신고번호: 제 하남102호]
 *  - 번호가 없거나 개인과외교습자면 '' (문구 자체를 생략)
 */
export function getRegNoText(academy) {
    const cat = (academy?.category || '').trim();
    if (cat === '과외') return '';
    const no = String(academy?.regNo || '')
        .replace(/\s+/g, '')
        .replace(/^제/, '')
        .replace(/호$/, '');
    if (!no) return '';
    const label = cat.includes('교습소') ? '신고번호' : '등록번호';
    return `[${label}: 제 ${no}호]`;
}

export function fmtNum(val) {
    if (!val && val !== 0) return '';
    const n = parseInt(String(val).replace(/,/g, ''), 10);
    return isNaN(n) || n === 0 ? '' : n.toLocaleString('ko-KR');
}

export function parseNum(val) {
    if (!val) return 0;
    const n = parseInt(String(val).replace(/,/g, ''), 10);
    return isNaN(n) ? 0 : n;
}

export function formatPeriod(period) {
    if (!period) return '';
    return period.replace(/0일$/, '').trim();
}

export function formatChangeDateKo(dateStr) {
    if (!dateStr) return { year: '', month: '', day: '' };
    const parts = dateStr.split(/[-./]/);
    if (parts.length < 3) return { year: dateStr, month: '', day: '' };
    return {
        year: parts[0],
        month: String(parseInt(parts[1], 10)),
        day: String(parseInt(parts[2], 10)),
    };
}

export function getSignLabel(academy) {
    const cat = (academy.category || '').trim();
    const name = academy.name || '';
    const founderName = academy.founder?.name || '';
    if (cat === '과외') return { label: '개인과외교습자', signerName: founderName };
    if (cat.includes('교습소')) return { label: `${name} 교습자`, signerName: founderName };
    return { label: `${name} 설립운영자`, signerName: founderName };
}

export const OTHER_FEE_ITEMS = [
    { label: '모의고사비', key: 'mockExamFee' },
    { label: '재료비', key: 'materialFee' },
    { label: '피복비', key: 'clothingFee' },
    { label: '급식비', key: 'mealFee' },
    { label: '기숙사비', key: 'dormitoryFee' },
    { label: '차량비', key: 'vehicleFee' },
];

/**
 * 신청서 과목 줄의 총교습시간(분) = 일 분 × 주 회 × 주
 * 나이스에서 불러온 값이 일·주 횟수로 나눠지지 않아 칸이 비어 있으면 나이스 총교습시간(neisTotal)을 그대로 씀
 */
export function sheetTotalMinutes(sub) {
    const num = (v) => parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;
    const t = Math.round(num(sub?.dm) * num(sub?.wc) * num(sub?.wk));
    return t > 0 ? t : Math.round(num(sub?.neisTotal));
}

/**
 * 변경신청: 나이스에서 불러온 줄(sub.orig = 불러올 때 값)과 지금 값을 칸별로 비교
 * - orig가 없는 줄은 새로 더한 줄(isNew)
 * - 총교습시간은 분·회·주가 아니라 합계(분)가 달라졌을 때만 변경
 */
export function sheetChanges(sub) {
    const o = sub?.orig;
    if (!o) return { isNew: true, any: false };
    const str = (v) => String(v ?? '').trim();
    const n = (v) => parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    const ch = {
        isNew: false,
        process: str(sub.processLabel) !== str(o.processLabel),
        subject: str(sub.subjectName) !== str(o.subjectName),
        period: str(sub.period) !== str(o.period),
        time: sheetTotalMinutes(sub) !== o.total,
        capacity: n(sub.capacity) !== n(o.capacity),
        fee: n(sub.fee) !== n(o.fee),
    };
    ch.any = ch.process || ch.subject || ch.period || ch.time || ch.capacity || ch.fee;
    return ch;
}

/** 불러올 때 값 기억 — sheetChanges 비교 기준 */
export function sheetOrig(sub, extras) {
    return {
        processLabel: sub.processLabel, subjectName: sub.subjectName, period: sub.period,
        dm: sub.dm, wc: sub.wc, wk: sub.wk, total: sheetTotalMinutes(sub),
        capacity: sub.capacity, fee: sub.fee,
        extras, // 이 과정의 나이스 기타경비 { mockExamFee: 0, … } — 엑셀에서 기타경비 칸 비교용
    };
}

/** 기타경비 줄: 불러올 때 값(row.orig)과 칸별 비교 — orig가 없으면 새로 더한 줄 */
export function extraFeeChanges(row) {
    const o = row?.orig;
    if (!o) return { isNew: true, any: false };
    const n = (v) => parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    const ch = { isNew: false, subjectName: String(row.subjectName ?? '').trim() !== String(o.subjectName ?? '').trim() };
    for (const it of OTHER_FEE_ITEMS) ch[it.key] = n(row[it.key]) !== n(o[it.key]);
    ch.any = ch.subjectName || OTHER_FEE_ITEMS.some(it => ch[it.key]);
    return ch;
}

export function getWeeklyTotalMinutes(weeklyStr) {
    if (!weeklyStr) return null;
    const sessionsMatch = weeklyStr.match(/주(\d+)회/);
    const minsMatch = weeklyStr.match(/회당(\d+)분/);
    if (!sessionsMatch || !minsMatch) return null;
    return parseInt(sessionsMatch[1], 10) * parseInt(minsMatch[1], 10);
}

export function calcWeeklyMinutes(totalTimeVal) {
    const total = parseInt(String(totalTimeVal || '').replace(/,/g, ''), 10);
    if (isNaN(total) || total === 0) return null;

    const combinations = [];
    for (const weeks of [4.3, 4.2, 4.1, 4.0]) {
        for (let sessions = 1; sessions <= 7; sessions++) {
            const minutes = Math.round((total / weeks) / sessions);
            if (minutes < 30 || minutes > 300) continue;
            const diffFromTotal = Math.abs(minutes * sessions * weeks - total);
            if (diffFromTotal > 8) continue;
            let roundScore = 0;
            if (minutes % 60 === 0) roundScore += 30;
            else if (minutes % 30 === 0) roundScore += 20;
            else if (minutes % 10 === 0) roundScore += 10;
            else if (minutes % 5 === 0) roundScore += 5;
            if (sessions >= 3 && sessions <= 5) roundScore += 20;
            combinations.push({ sessions, minutes, diffFromTotal, roundScore });
        }
    }
    combinations.sort((a, b) =>
        Math.abs(a.diffFromTotal - b.diffFromTotal) > 0.5
            ? a.diffFromTotal - b.diffFromTotal
            : b.roundScore - a.roundScore
    );
    return combinations.length > 0 ? combinations[0].minutes * combinations[0].sessions : null;
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    // iOS Safari는 <a download> 미지원 → window.open으로 대체
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        const w = window.open(url, '_blank');
        if (!w) window.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }
}
