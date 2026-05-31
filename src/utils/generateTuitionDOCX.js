/**
 * 교습비등 게시표 DOCX 생성
 * docx 라이브러리로 내부용 / 외부용 Word 문서를 생성하여 다운로드
 */
import {
  Document, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, WidthType, AlignmentType, BorderStyle, ShadingType,
  convertMillimetersToTwip, HeightRule, VerticalAlign,
} from 'docx';

// ─── 공통 헬퍼 ───────────────────────────────────────────────────

function fmtNum(val) {
  if (!val && val !== 0) return '';
  const n = parseInt(String(val).replace(/,/g, ''), 10);
  return isNaN(n) || n === 0 ? '' : n.toLocaleString('ko-KR');
}

function parseNum(val) {
  if (!val) return 0;
  const n = parseInt(String(val).replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function formatPeriod(period) {
  if (!period) return '';
  return period.replace(/0일$/, '').trim();
}

function formatChangeDateKo(dateStr) {
  if (!dateStr) return { year: '', month: '', day: '' };
  const parts = dateStr.split(/[-./]/);
  if (parts.length < 3) return { year: dateStr, month: '', day: '' };
  return {
    year: parts[0],
    month: String(parseInt(parts[1], 10)),
    day: String(parseInt(parts[2], 10)),
  };
}

function getSignLabel(academy, external = false) {
  const cat = (academy.category || '').trim();
  const name = academy.name || '';
  const founderName = academy.founder?.name || '';
  if (cat === '과외') return { label: '개인과외교습자', signerName: founderName };
  if (cat.includes('교습소')) return { label: `${name} 교습자`, signerName: founderName };
  return { label: `${name} 설립운영자`, signerName: founderName };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SOLID_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = { top: SOLID_BORDER, bottom: SOLID_BORDER, left: SOLID_BORDER, right: SOLID_BORDER };
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 };
const FONT = '맑은 고딕';

function thCell(text, opts = {}) {
  const lines = text.split('\n');
  return new TableCell({
    children: [new Paragraph({
      children: lines.flatMap((line, i) => [
        new TextRun({ text: line, bold: true, size: 17, font: FONT }),
        ...(i < lines.length - 1 ? [new TextRun({ break: 1 })] : []),
      ]),
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
    })],
    shading: { type: ShadingType.SOLID, color: 'E8E8E8', fill: 'E8E8E8' },
    borders: ALL_BORDERS,
    rowSpan: opts.rowSpan,
    columnSpan: opts.colSpan,
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGINS,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
  });
}

function tdCell(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({
        text: String(text || ''),
        size: 17,
        font: FONT,
        bold: opts.bold || false,
      })],
      alignment: opts.left ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
    })],
    borders: ALL_BORDERS,
    rowSpan: opts.rowSpan,
    columnSpan: opts.colSpan,
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGINS,
    shading: opts.shade ? { type: ShadingType.SOLID, color: opts.shade, fill: opts.shade } : undefined,
  });
}

// ─── 내부용 DOCX ─────────────────────────────────────────────────

export async function downloadTuitionInternalDOCX(academy) {
  const baseDateStr = academy.changeDate || academy.regDate || '';
  const d = formatChangeDateKo(baseDateStr);
  const courses = academy.courses || [];
  const { label: signLabel, signerName } = getSignLabel(academy);

  // 열 너비 (DXA = 1/20 pt, 1mm ≈ 56.7 DXA)
  // A4 body ~186mm → ~10536 DXA (with 12mm margins each)
  const COL_W = [2600, 1100, 1100, 1000, 1000, 1000, 900, 900, 1100, 900, 1000];
  // Total = 12600 DXA

  const hRow1 = new TableRow({
    tableHeader: true,
    height: { value: 450, rule: HeightRule.ATLEAST },
    children: [
      thCell('교습과정', { rowSpan: 2, width: COL_W[0] }),
      thCell('총교습시간\n(분/월)', { rowSpan: 2, width: COL_W[1] }),
      thCell('교습비', { rowSpan: 2, width: COL_W[2] }),
      thCell('징수단위\n(월,분기)', { rowSpan: 2, width: COL_W[3] }),
      thCell('기타경비', { colSpan: 6, width: COL_W[4] }),
      thCell('합계', { rowSpan: 2, width: COL_W[10] }),
    ],
  });
  const hRow2 = new TableRow({
    tableHeader: true,
    height: { value: 420, rule: HeightRule.ATLEAST },
    children: [
      thCell('모의고사비', { width: COL_W[4] }),
      thCell('재료비', { width: COL_W[5] }),
      thCell('피복비', { width: COL_W[6] }),
      thCell('급식비', { width: COL_W[7] }),
      thCell('기숙사비', { width: COL_W[8] }),
      thCell('차량비', { width: COL_W[9] }),
    ],
  });

  const dataRows = courses.map(c => {
    const label = [c.process, c.subject].filter(Boolean).join(' / ');
    const t = parseNum(c.tuitionFee || c.totalFee);
    const s = parseNum(c.mockExamFee) + parseNum(c.materialFee) + parseNum(c.clothingFee) + parseNum(c.mealFee) + parseNum(c.dormitoryFee) + parseNum(c.vehicleFee);
    const total = t + s;
    return new TableRow({
      height: { value: 500, rule: HeightRule.ATLEAST },
      children: [
        tdCell(label, { left: true }),
        tdCell(fmtNum(c.totalTime)),
        tdCell(fmtNum(c.tuitionFee || c.totalFee)),
        tdCell(formatPeriod(c.period)),
        tdCell(fmtNum(c.mockExamFee)),
        tdCell(fmtNum(c.materialFee)),
        tdCell(fmtNum(c.clothingFee)),
        tdCell(fmtNum(c.mealFee)),
        tdCell(fmtNum(c.dormitoryFee)),
        tdCell(fmtNum(c.vehicleFee)),
        tdCell(total > 0 ? total.toLocaleString('ko-KR') : '', { bold: true }),
      ],
    });
  });

  const emptyRows = Array.from({ length: Math.max(0, 8 - courses.length) }, () =>
    new TableRow({
      height: { value: 500, rule: HeightRule.ATLEAST },
      children: Array.from({ length: 11 }, () => tdCell('')),
    })
  );

  const notes = [...new Set(courses.map(c => (c.note || '').trim()).filter(Boolean))];
  const noteRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [
            new TextRun({ text: '비고  ', bold: true, size: 17, font: FONT }),
            new TextRun({ text: notes.join('  /  '), size: 17, font: FONT }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { before: 40, after: 40 },
        })],
        columnSpan: 11,
        borders: ALL_BORDERS,
        margins: CELL_MARGINS,
        shading: { type: ShadingType.SOLID, color: 'FAFAFA', fill: 'FAFAFA' },
      }),
    ],
  });

  const table = new Table({
    width: { size: 12600, type: WidthType.DXA },
    rows: [hRow1, hRow2, ...dataRows, ...emptyRows, noteRow],
    columnWidths: COL_W,
  });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(15),
            right: convertMillimetersToTwip(12),
            bottom: convertMillimetersToTwip(15),
            left: convertMillimetersToTwip(12),
          },
          size: {
            width: convertMillimetersToTwip(210),
            height: convertMillimetersToTwip(297),
          },
        },
      },
      children: [
        new Paragraph({ children: [new TextRun({ text: '[별지 제4호서식]', size: 16, font: FONT })], spacing: { after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: '교습비등  게시표', bold: true, size: 48, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: academy.name, bold: true, size: 28, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({
          children: [
            new TextRun({ text: `${d.year}년  ${d.month}월  ${d.day}일  현재`, size: 20, font: FONT }),
            new TextRun({ text: '\t[단위: 원]', size: 20, font: FONT }),
          ],
          tabStops: [{ type: 'right', position: 12600 }],
          spacing: { after: 60 },
        }),
        table,
        new Paragraph({ children: [new TextRun({ text: '「경기도 학원의 설립·운영 및 과외교습에 관한 조례 시행규칙」 제8조의2에 따라 교습비등을 위와 같이 게시합니다.', size: 18, font: FONT })], spacing: { before: 160, after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: `${d.year}년  ${d.month}월  ${d.day}일`, size: 20, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `${signLabel}  ${signerName}  (서명 또는 인)`, size: 20, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
        new Paragraph({ children: [new TextRun({ text: '유 의 사 항', bold: true, size: 20, font: FONT })], alignment: AlignmentType.CENTER, border: { top: SOLID_BORDER, bottom: SOLID_BORDER, left: SOLID_BORDER, right: SOLID_BORDER }, spacing: { before: 80, after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '1. 교습비등 게시표는 관할 교육지원청에 등록 신청한 최종자료를 게시합니다.', size: 18, font: FONT })] }),
        new Paragraph({ children: [new TextRun({ text: '2. 글씨는 학습자의 확인이 쉬운 크기로 합니다.', size: 18, font: FONT })] }),
        new Paragraph({ children: [new TextRun({ text: '3. 게시는 학원 및 교습소, 개인과외교습장소(교습자의 주거지에 한함)의 내부와 외부에 학습자가 보기 쉬운 장소에 합니다.', size: 18, font: FONT })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `교습비게시표_내부용_${academy.name}.docx`);
}

// ─── 외부용 DOCX ─────────────────────────────────────────────────

export async function downloadTuitionExternalDOCX(academy) {
  const baseDateStr = academy.changeDate || academy.regDate || '';
  const d = formatChangeDateKo(baseDateStr);
  const courses = academy.courses || [];
  const { label: signLabel, signerName } = getSignLabel(academy);

  const otherFeeItems = [
    { label: '모의고사비', key: 'mockExamFee' },
    { label: '재료비', key: 'materialFee' },
    { label: '피복비', key: 'clothingFee' },
    { label: '급식비', key: 'mealFee' },
    { label: '기숙사비', key: 'dormitoryFee' },
    { label: '차량비', key: 'vehicleFee' },
  ];

  // 6-column external form
  const COL_W = [2800, 2200, 2400, 1400, 1800, 2000]; // total ~12600

  const hRow1 = new TableRow({
    tableHeader: true,
    height: { value: 450, rule: HeightRule.ATLEAST },
    children: [
      thCell('교습과목', { rowSpan: 2, width: COL_W[0] }),
      thCell('교습시간\n(주기준)', { rowSpan: 2, width: COL_W[1] }),
      thCell('교습비\n(월기준, 원)', { rowSpan: 2, width: COL_W[2] }),
      thCell('기타경비(월기준)', { colSpan: 2, width: COL_W[3] }),
      thCell('합계\n(최종납부금액)', { rowSpan: 2, width: COL_W[5] }),
    ],
  });
  const hRow2 = new TableRow({
    tableHeader: true,
    height: { value: 420, rule: HeightRule.ATLEAST },
    children: [
      thCell('항목', { width: COL_W[3] }),
      thCell('금액(원)', { width: COL_W[4] }),
    ],
  });

  const dataRows = [];
  courses.forEach(c => {
    const subject = [c.process, c.subject].filter(Boolean).join(' / ');
    const tuitionNum = parseNum(c.tuitionFee || c.totalFee);
    const activeItems = otherFeeItems.filter(it => parseNum(c[it.key]) > 0);
    const otherSum = activeItems.reduce((s, it) => s + parseNum(c[it.key]), 0);
    const total = tuitionNum + otherSum;
    const totalStr = total > 0 ? `월 ${total.toLocaleString('ko-KR')}원` : (tuitionNum > 0 ? `월 ${tuitionNum.toLocaleString('ko-KR')}원` : '');
    const tuitionStr = tuitionNum > 0 ? `월 ${tuitionNum.toLocaleString('ko-KR')}원` : '';
    const span = Math.max(1, activeItems.length);

    if (activeItems.length === 0) {
      dataRows.push(new TableRow({
        height: { value: 560, rule: HeightRule.ATLEAST },
        children: [
          tdCell(subject, { left: true, rowSpan: span }),
          tdCell('주    회, 회당        분'),
          tdCell(tuitionStr, { rowSpan: span }),
          tdCell(''),
          tdCell(''),
          tdCell(totalStr, { bold: true, rowSpan: span }),
        ],
      }));
    } else {
      activeItems.forEach((it, idx) => {
        const row = idx === 0
          ? new TableRow({
              height: { value: 560, rule: HeightRule.ATLEAST },
              children: [
                tdCell(subject, { left: true, rowSpan: span }),
                tdCell('주    회, 회당        분', { rowSpan: span }),
                tdCell(tuitionStr, { rowSpan: span }),
                tdCell(it.label),
                tdCell(fmtNum(c[it.key])),
                tdCell(totalStr, { bold: true, rowSpan: span }),
              ],
            })
          : new TableRow({
              height: { value: 560, rule: HeightRule.ATLEAST },
              children: [tdCell(it.label), tdCell(fmtNum(c[it.key]))],
            });
        dataRows.push(row);
      });
    }
  });

  const usedRows = courses.reduce((sum, c) => sum + Math.max(1, otherFeeItems.filter(it => parseNum(c[it.key]) > 0).length), 0);
  const emptyRows = Array.from({ length: Math.max(0, 6 - usedRows) }, () =>
    new TableRow({
      height: { value: 560, rule: HeightRule.ATLEAST },
      children: Array.from({ length: 6 }, () => tdCell('')),
    })
  );

  const notes = [...new Set(courses.map(c => (c.note || '').trim()).filter(Boolean))];
  const noteRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [
            new TextRun({ text: '비고  ', bold: true, size: 19, font: FONT }),
            new TextRun({ text: notes.join('  /  '), size: 19, font: FONT }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { before: 40, after: 40 },
        })],
        columnSpan: 6,
        borders: ALL_BORDERS,
        margins: CELL_MARGINS,
        shading: { type: ShadingType.SOLID, color: 'FAFAFA', fill: 'FAFAFA' },
      }),
    ],
  });

  const table = new Table({
    width: { size: 12600, type: WidthType.DXA },
    rows: [hRow1, hRow2, ...dataRows, ...emptyRows, noteRow],
    columnWidths: COL_W,
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(15),
            right: convertMillimetersToTwip(12),
            bottom: convertMillimetersToTwip(15),
            left: convertMillimetersToTwip(12),
          },
          size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
        },
      },
      children: [
        new Paragraph({ children: [new TextRun({ text: '■ 교육부「학원비 옥외가격표시제 가이드라인」[별첨1]<신설 2017. 8.> (옥외용)', size: 14, font: FONT })], spacing: { after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: '교습비등  게시표', bold: true, size: 52, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: academy.name, bold: true, size: 30, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: `${d.year}년  ${d.month}월  ${d.day}일`, size: 22, font: FONT })], alignment: AlignmentType.RIGHT, spacing: { after: 80 } }),
        table,
        new Paragraph({ children: [new TextRun({ text: '「학원의 설립·운영 및 과외교습에 관한 법률」제15조제3항에 따라 교습비등을 위와 같이 게시합니다.', size: 19, font: FONT })], spacing: { before: 160, after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: '「최종납부금액」은 관할 교육지원청에 등록한 교습비와 일치하며, 실제 납부금액을 표기한 것입니다.', size: 19, font: FONT })], spacing: { after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: `${signLabel}  ${signerName}  : (서명 또는 인)`, size: 22, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `교습비게시표_외부용_${academy.name}.docx`);
}
