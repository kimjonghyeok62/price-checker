import * as XLSX from 'xlsx';

/**
 * 교육청 표준 엑셀(acaInstiList_*.xlsx)을 파싱하여
 * printTuitionForm / printTuitionFormExternal 이 기대하는
 * academy 객체 배열로 변환한다.
 */
export function parseExcelTuition(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

                const dataRows = raw.slice(5);
                const academyMap = new Map();

                for (let i = 0; i + 2 < dataRows.length; i += 3) {
                    const main = dataRows[i];
                    const sub1 = dataRows[i + 1] || [];
                    const sub2 = dataRows[i + 2] || [];

                    const name = str(main[1]);
                    if (!name) continue;

                    const address = str(main[3]);
                    const founderRaw = cleanFounderName(str(main[4]));
                    const category = str(main[5]);
                    const period = str(main[7]);
                    const totalTime = str(main[8]);
                    const tuitionFee = str(main[10]);
                    const dateRaw = str(main[12]);

                    const process = str(sub1[5]);
                    const mockExamFee = str(sub1[9]);
                    const materialFee = str(sub1[10]);
                    const mealFee = str(sub1[11]);

                    const subject = str(sub2[5]);
                    const dormitoryFee = str(sub2[9]);
                    const clothingFee = str(sub2[10]);
                    const vehicleFee = str(sub2[11]);

                    const course = {
                        process: [category, process].filter(Boolean).join(' '),
                        subject,
                        period,
                        totalTime,
                        tuitionFee,
                        mockExamFee,
                        materialFee,
                        mealFee,
                        dormitoryFee,
                        clothingFee,
                        vehicleFee,
                        note: '',
                    };

                    if (!academyMap.has(name)) {
                        academyMap.set(name, {
                            name,
                            address,
                            changeDate: formatDate(dateRaw),
                            regDate: formatDate(dateRaw),
                            category: '',
                            founder: { name: founderRaw || '' },
                            courses: [],
                        });
                    }

                    const academy = academyMap.get(name);
                    academy.courses.push(course);

                    if (dateRaw) {
                        const d = formatDate(dateRaw);
                        if (!academy.changeDate || d > academy.changeDate) {
                            academy.changeDate = d;
                            academy.regDate = d;
                        }
                    }
                }

                resolve(Array.from(academyMap.values()));
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
        reader.readAsArrayBuffer(file);
    });
}

function cleanFounderName(v) {
    if (!v) return '';
    if (/^\d+$/.test(v)) return '';
    if (v.length < 3) return '';
    return v;
}

function str(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

function formatDate(raw) {
    if (!raw) return '';
    const s = String(raw).replace(/\D/g, '');
    if (s.length === 8) {
        return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
    }
    return raw;
}
