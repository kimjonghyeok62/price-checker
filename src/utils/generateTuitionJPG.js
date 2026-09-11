/**
 * 교습비등 게시표 JPG 출력
 * PDF용 HTML(generateTuitionPDF.js)을 숨은 iframe에 그린 뒤
 * A4 한 장씩 나눠(표 머리글은 매 장 반복) html2canvas로 캡처한다.
 * 1장이면 JPG 1개, 여러 장이면 ZIP으로 묶어 다운로드.
 */
import JSZip from 'jszip';
import { buildTuitionFormHTML, buildTuitionFormExternalHTML } from './generateTuitionPDF';
import { downloadBlob } from './tuitionFormCommon';

const PX_PER_MM = 96 / 25.4;
// 브라우저 인쇄 시 .page(폭 210mm)를 A4 인쇄영역(210 - 여백 12mm×2 = 186mm)에 맞춰 축소하는 비율.
// JPG도 같은 비율로 배치해야 PDF와 같은 크기·같은 쪽 나눔이 된다.
const PRINT_SCALE = 186 / 210;
const SHEET_W = (210 / PRINT_SCALE) * PX_PER_MM;
const SHEET_H = (297 / PRINT_SCALE) * PX_PER_MM;
const SHEET_MARGIN = (12 / PRINT_SCALE) * PX_PER_MM;
const OUTPUT_WIDTH = 2480; // A4 300dpi 기준 가로 픽셀
const JPEG_QUALITY = 0.92;

export function downloadTuitionInternalJPG(academy) {
    return _downloadJPG(buildTuitionFormHTML(academy), `교습비게시표_내부용_${academy.name}`);
}

export function downloadTuitionExternalJPG(academy) {
    return _downloadJPG(buildTuitionFormExternalHTML(academy), `교습비게시표_외부용_${academy.name}`);
}

async function _downloadJPG(html, baseName) {
    const { default: html2canvas } = await import('html2canvas');
    const iframe = await _createRenderFrame(html);
    try {
        const sheets = _paginate(iframe.contentDocument);
        const blobs = [];
        for (const sheet of sheets) {
            const canvas = await html2canvas(sheet, {
                scale: OUTPUT_WIDTH / sheet.getBoundingClientRect().width,
                backgroundColor: '#ffffff',
                logging: false,
            });
            blobs.push(await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)));
        }

        if (blobs.length === 1) {
            downloadBlob(blobs[0], `${baseName}.jpg`);
            return;
        }
        const zip = new JSZip();
        blobs.forEach((blob, i) => zip.file(`${baseName}_${i + 1}.jpg`, blob));
        downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName}.zip`);
    } finally {
        iframe.remove();
    }
}

// 화면 밖 iframe에 게시표 HTML을 그린다 (앱 CSS와 섞이지 않도록 iframe 사용)
async function _createRenderFrame(html) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:fixed; left:-10000px; top:0; width:${Math.ceil(SHEET_W) + 40}px; height:${Math.ceil(SHEET_H) + 40}px; border:0;`;
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    if (doc.fonts?.ready) await doc.fonts.ready;
    return iframe;
}

// .page 내용을 A4 크기 sheet 여러 장으로 나눠 담고, sheet 요소 배열을 반환
function _paginate(doc) {
    doc.querySelectorAll('.no-print').forEach(el => el.remove());
    const source = doc.querySelector('.page');
    const blocks = Array.from(source.children);
    const colWidths = _measureColumnWidths(source.querySelector('table'));

    const container = doc.createElement('div');
    doc.body.appendChild(container);
    const sheets = [];
    let page;

    const newPage = () => {
        const sheet = doc.createElement('div');
        sheet.style.cssText = `width:${SHEET_W}px; height:${SHEET_H}px; padding:${SHEET_MARGIN}px; box-sizing:border-box; background:#fff; overflow:hidden;`;
        page = doc.createElement('div');
        page.className = 'page';
        page.style.cssText = 'width:100%; height:100%; min-height:0; margin:0; overflow:hidden;';
        sheet.appendChild(page);
        container.appendChild(sheet);
        sheets.push(sheet);
    };
    const overflows = () => page.scrollHeight > page.clientHeight + 1;

    // 머리글(thead)을 복제한 새 표를 현재 page에 추가하고 tbody를 반환
    const startTable = (table) => {
        const t = table.cloneNode(false);
        t.style.tableLayout = 'fixed';
        if (colWidths) {
            const colgroup = doc.createElement('colgroup');
            colWidths.forEach(w => {
                const col = doc.createElement('col');
                col.style.width = `${w}px`;
                colgroup.appendChild(col);
            });
            t.appendChild(colgroup);
        }
        if (table.tHead) t.appendChild(table.tHead.cloneNode(true));
        const tbody = doc.createElement('tbody');
        t.appendChild(tbody);
        page.appendChild(t);
        return tbody;
    };

    const placeTable = (table) => {
        let tbody = startTable(table);
        let groupsOnPage = 0;
        for (const group of _groupRows(Array.from(table.tBodies[0]?.rows || []))) {
            group.forEach(r => tbody.appendChild(r));
            if (overflows()) {
                group.forEach(r => r.remove());
                // 머리글만 남은 표는 지우고 통째로 다음 장에서 시작
                if (groupsOnPage === 0) tbody.parentNode.remove();
                if (groupsOnPage > 0 || page.childElementCount > 0) {
                    newPage();
                }
                tbody = startTable(table);
                groupsOnPage = 0;
                group.forEach(r => tbody.appendChild(r));
            }
            groupsOnPage++;
        }
    };

    newPage();
    for (const block of blocks) {
        if (block.tagName === 'TABLE') {
            placeTable(block);
            continue;
        }
        page.appendChild(block);
        if (overflows() && page.childElementCount > 1) {
            block.remove();
            newPage();
            page.appendChild(block);
        }
    }
    source.remove();
    return sheets;
}

// rowspan으로 묶인 행들은 한 그룹으로 (장 경계에서 쪼개지지 않도록)
function _groupRows(rows) {
    const groups = [];
    let lastCovered = -1;
    rows.forEach((row, i) => {
        if (i > lastCovered) groups.push([]);
        groups[groups.length - 1].push(row);
        const span = Math.max(1, ...Array.from(row.cells).map(c => c.rowSpan || 1));
        lastCovered = Math.max(lastCovered, i + span - 1);
    });
    return groups;
}

// 원본 표의 열 너비 — 장마다 표를 새로 만들어도 열 너비가 같도록 고정
function _measureColumnWidths(table) {
    if (!table) return null;
    const rows = Array.from(table.rows);
    const colCount = Math.max(...rows.map(r => Array.from(r.cells).reduce((s, c) => s + c.colSpan, 0)));
    const ref = rows.find(r => r.cells.length === colCount);
    return ref ? Array.from(ref.cells).map(c => c.getBoundingClientRect().width) : null;
}
