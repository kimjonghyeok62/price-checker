export const SHEET_ID = '158ZNBb88raJ1kzBL3eFcgPZS9CGs5in0YtPtiPWfdic';
export const DATA_GID = '1863320151';
export const GYOSEUPSO_GID = '1929773080';

function fetchWithTimeout(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function parseCSVRaw(text) {
    if (!text) return [];
    const rows = [];
    let currentField = '';
    let inQuotes = false;
    let currentRow = [];
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (char === '"' && inQuotes && nextChar === '"') { currentField += '"'; i++; }
        else if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { currentRow.push(currentField); currentField = ''; }
        else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (i > 0 && (text[i - 1] === '\r' || text[i - 1] === '\n')) { /* skip */ }
            else { currentRow.push(currentField); rows.push(currentRow); currentField = ''; currentRow = []; }
        } else { currentField += char; }
    }
    if (currentRow.length > 0 || currentField) { currentRow.push(currentField); rows.push(currentRow); }
    return rows;
}

function parseCSV(text) {
    const rows = parseCSVRaw(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (row[i] || '').trim().replace(/^"|"$/g, ''); });
        return obj;
    });
}

export async function fetchGoogleSheetData(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const txt = await response.text();
    return parseCSV(txt);
}

export function transformAcademyData(rawRows) {
    const academyMap = new Map();
    rawRows.forEach(row => {
        const name = (row['학원명'] || row['교습소명'] || '').trim();
        if (!name) return;
        const rowId = row['등록번호'] || row['신고번호'] || '';
        const rowStatus = row['등록상태'] || '';
        const ACTIVE = ['개원', '신고'];
        if (!academyMap.has(name)) {
            academyMap.set(name, {
                id: rowId,
                name,
                category: row['학원종류'] || '교습소',
                address: row['학원주소'] || row['교습소주소'] || '',
                regDate: row['등록일'] || '',
                status: rowStatus,
                changeDate: row['변경일'] || '',
                founder: { name: row['설립자-성명'] || row['교습자-성명'] || '' },
                courses: [],
            });
        } else {
            const existing = academyMap.get(name);
            if (rowId !== existing.id && ACTIVE.includes(rowStatus) && !ACTIVE.includes(existing.status)) {
                Object.assign(existing, {
                    id: rowId,
                    category: row['학원종류'] || existing.category,
                    address: row['학원주소'] || row['교습소주소'] || existing.address,
                    regDate: row['등록일'] || existing.regDate,
                    status: rowStatus,
                    changeDate: row['변경일'] || existing.changeDate,
                    founder: { name: row['설립자-성명'] || row['교습자-성명'] || existing.founder.name },
                    courses: [],
                });
            }
        }
        const academy = academyMap.get(name);
        const course = {
            process: row['교습과정'] || '',
            subject: row['교습과목(반)'] || '',
            period: row['교습기간'] || row['교습기간(개월)'] || '',
            totalTime: row['총교습시간(분)'] || row['총교습기간(분)'] || '',
            tuitionFee: row['교습비'] || '',
            mockExamFee: row['모의고사비'] || '',
            materialFee: row['재료비'] || '',
            clothingFee: row['피복비'] || '',
            mealFee: row['급식비'] || '',
            dormitoryFee: row['기숙사비'] || '',
            vehicleFee: row['차량비'] || '',
            note: row['비고(교습과정)'] || '',
        };
        if (course.subject && !academy.courses.some(c => c.subject === course.subject && c.process === course.process)) {
            academy.courses.push(course);
        }
    });
    return Array.from(academyMap.values());
}
