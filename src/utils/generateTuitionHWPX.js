/**
 * 교습비등 게시표 HWPX 생성
 * JSZip으로 HWPML(HWP Open Format) ZIP 컨테이너를 생성
 * 단위: HWPUNIT = 1/100 mm (예: 10pt = 1000)
 */
import JSZip from 'jszip';

const ESC = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  return (period || '').replace(/0일$/, '').trim();
}
function formatChangeDateKo(dateStr) {
  if (!dateStr) return { year: '', month: '', day: '' };
  const parts = dateStr.split(/[-./]/);
  if (parts.length < 3) return { year: dateStr, month: '', day: '' };
  return { year: parts[0], month: String(parseInt(parts[1], 10)), day: String(parseInt(parts[2], 10)) };
}
function getSignLabel(academy) {
  const cat = (academy.category || '').trim();
  const name = academy.name || '';
  const founderName = academy.founder?.name || '';
  if (cat === '과외') return { label: '개인과외교습자', signerName: founderName };
  if (cat.includes('교습소')) return { label: `${name} 교습자`, signerName: founderName };
  return { label: `${name} 설립운영자`, signerName: founderName };
}

// ─── HWPX 정적 파일들 ────────────────────────────────────────────

const MIMETYPE = 'application/hwp+zip';

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container">
  <ocf:rootfiles>
    <ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwp+zip"/>
  </ocf:rootfiles>
</ocf:container>`;

const CONTENT_HPF = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="HWPDocumentID">
  <opf:metadata/>
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="application/xml"/>
    <opf:item id="section0" href="section0.xml" media-type="application/xml"/>
    <opf:item id="settings" href="settings.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`;

const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:settings xmlns:hh="http://www.hancom.co.kr/hwpml/2011/settings">
  <hh:noChangeFileFormat>0</hh:noChangeFileFormat>
</hh:settings>`;

// charPr IDs: 0=본문10pt, 1=타이틀26pt굵게, 2=학원명15pt굵게, 3=헤더9pt굵게, 4=본문11pt
// paraPr IDs: 0=좌정렬, 1=가운데정렬, 2=우정렬
const HEADER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.4">
  <hh:beginNum>
    <hh:paraShape id="0"/>
    <hh:charShape id="0"/>
    <hh:tabDef id="0"/>
    <hh:numbering id="1"/>
    <hh:bullet id="0"/>
    <hh:style id="0"/>
    <hh:memo id="0"/>
    <hh:trackChange id="0"/>
    <hh:trackChangeAuthor id="0"/>
  </hh:beginNum>
  <hh:refList>
    <hh:fontFaces>
      <hh:fontFace id="0" lang="Hangul" fontName="맑은 고딕" type="TTF" isEmbedded="0" bstrBaseFont="" face="0"/>
      <hh:fontFace id="1" lang="Latin" fontName="Times New Roman" type="TTF" isEmbedded="0" bstrBaseFont="" face="0"/>
      <hh:fontFace id="2" lang="Hanja" fontName="맑은 고딕" type="TTF" isEmbedded="0" bstrBaseFont="" face="0"/>
      <hh:fontFace id="3" lang="Other" fontName="Times New Roman" type="TTF" isEmbedded="0" bstrBaseFont="" face="0"/>
      <hh:fontFace id="4" lang="Symbol" fontName="Symbol" type="TTF" isEmbedded="0" bstrBaseFont="" face="0"/>
      <hh:fontFace id="5" lang="User" fontName="맑은 고딕" type="TTF" isEmbedded="0" bstrBaseFont="" face="0"/>
    </hh:fontFaces>
    <hh:borderFills>
      <hh:borderFill id="0" threeD="0" shadow="0" centerLine="0" breakCellSeparateLine="0">
        <hh:slash type="NONE" isCounter="0" isCenter="0"/>
        <hh:backSlash type="NONE" isCounter="0" isCenter="0"/>
        <hh:leftBorder type="NONE" width="0.12mm" color="#000000"/>
        <hh:rightBorder type="NONE" width="0.12mm" color="#000000"/>
        <hh:topBorder type="NONE" width="0.12mm" color="#000000"/>
        <hh:bottomBorder type="NONE" width="0.12mm" color="#000000"/>
        <hh:diagonal type="NONE" width="0.12mm" color="#000000"/>
        <hh:fillBrush><hh:winBrush faceColor="#FFFFFF" hatchColor="#FFFFFF" hatchStyle="NONE"/></hh:fillBrush>
      </hh:borderFill>
      <hh:borderFill id="1" threeD="0" shadow="0" centerLine="0" breakCellSeparateLine="0">
        <hh:slash type="NONE" isCounter="0" isCenter="0"/>
        <hh:backSlash type="NONE" isCounter="0" isCenter="0"/>
        <hh:leftBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:rightBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:topBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:bottomBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:diagonal type="NONE" width="0.12mm" color="#000000"/>
        <hh:fillBrush><hh:winBrush faceColor="#FFFFFF" hatchColor="#FFFFFF" hatchStyle="NONE"/></hh:fillBrush>
      </hh:borderFill>
      <hh:borderFill id="2" threeD="0" shadow="0" centerLine="0" breakCellSeparateLine="0">
        <hh:slash type="NONE" isCounter="0" isCenter="0"/>
        <hh:backSlash type="NONE" isCounter="0" isCenter="0"/>
        <hh:leftBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:rightBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:topBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:bottomBorder type="SOLID" width="0.12mm" color="#000000"/>
        <hh:diagonal type="NONE" width="0.12mm" color="#000000"/>
        <hh:fillBrush><hh:winBrush faceColor="#E8E8E8" hatchColor="#E8E8E8" hatchStyle="NONE"/></hh:fillBrush>
      </hh:borderFill>
    </hh:borderFills>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" textColor="#000000" shadeColor="#FFFFFF" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:font hangul="0" latin="1" hanja="2" other="3" symbol="4" user="5"/>
        <hh:ratio hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:charShadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout type="NONE" shape="SOLID" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:emboss type="NONE"/>
        <hh:engrave type="NONE"/>
        <hh:sup type="NONE" size="58"/>
        <hh:shadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
      </hh:charPr>
      <hh:charPr id="1" height="2600" textColor="#000000" shadeColor="#FFFFFF" bold="1" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:font hangul="0" latin="1" hanja="2" other="3" symbol="4" user="5"/>
        <hh:ratio hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:charShadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout type="NONE" shape="SOLID" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:emboss type="NONE"/>
        <hh:engrave type="NONE"/>
        <hh:sup type="NONE" size="58"/>
        <hh:shadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
      </hh:charPr>
      <hh:charPr id="2" height="1500" textColor="#000000" shadeColor="#FFFFFF" bold="1" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:font hangul="0" latin="1" hanja="2" other="3" symbol="4" user="5"/>
        <hh:ratio hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:charShadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout type="NONE" shape="SOLID" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:emboss type="NONE"/>
        <hh:engrave type="NONE"/>
        <hh:sup type="NONE" size="58"/>
        <hh:shadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
      </hh:charPr>
      <hh:charPr id="3" height="900" textColor="#000000" shadeColor="#FFFFFF" bold="1" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:font hangul="0" latin="1" hanja="2" other="3" symbol="4" user="5"/>
        <hh:ratio hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:charShadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout type="NONE" shape="SOLID" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:emboss type="NONE"/>
        <hh:engrave type="NONE"/>
        <hh:sup type="NONE" size="58"/>
        <hh:shadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
      </hh:charPr>
      <hh:charPr id="4" height="1100" textColor="#000000" shadeColor="#FFFFFF" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="0">
        <hh:font hangul="0" latin="1" hanja="2" other="3" symbol="4" user="5"/>
        <hh:ratio hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" other="0" symbol="0" user="0"/>
        <hh:charShadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout type="NONE" shape="SOLID" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:emboss type="NONE"/>
        <hh:engrave type="NONE"/>
        <hh:sup type="NONE" size="58"/>
        <hh:shadow type="NONE" color="#000000" xDiff="0" yDiff="0"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" tabStop="4000" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="BOTH" vertical="TOP"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:margin left="0" right="0" prev="0" next="0" indent="0"/>
        <hh:lineSpacing type="PERCENT" value="160"/>
        <hh:border borderFillIDRef="0" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
      <hh:paraPr id="1" tabStop="4000" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="CENTER" vertical="TOP"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:margin left="0" right="0" prev="0" next="0" indent="0"/>
        <hh:lineSpacing type="PERCENT" value="160"/>
        <hh:border borderFillIDRef="0" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
      <hh:paraPr id="2" tabStop="4000" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="RIGHT" vertical="TOP"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:margin left="0" right="0" prev="0" next="0" indent="0"/>
        <hh:lineSpacing type="PERCENT" value="160"/>
        <hh:border borderFillIDRef="0" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
    </hh:paraProperties>
    <hh:styles>
      <hh:style id="0" type="para" name="본문" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/>
    </hh:styles>
    <hh:memoShapes/>
  </hh:refList>
  <hh:compatibleDocument targetProgram="HWP2007">
    <hh:layoutCompatibility/>
  </hh:compatibleDocument>
</hh:head>`;

// ─── XML 생성 헬퍼 ───────────────────────────────────────────────

let _id = 1;
const nid = () => _id++;

function resetId() { _id = 1; }

// paraPrId: 0=좌, 1=중앙, 2=우 / charPrId: 0=본문, 1=타이틀, 2=부제, 3=헤더, 4=본문11pt
function para(text, paraPrId = 0, charPrId = 0) {
  const pid = nid();
  const rid = nid();
  return `<hh:para id="${pid}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hh:paraPr paraPrIDRef="${paraPrId}" condense="0"/>
    <hh:run id="${rid}" charPrIDRef="${charPrId}">
      <hh:t>${ESC(text)}</hh:t>
    </hh:run>
  </hh:para>`;
}

function paraMultiRun(runs, paraPrId = 0) {
  const pid = nid();
  const runsXml = runs.map(r => {
    const rid = nid();
    return `<hh:run id="${rid}" charPrIDRef="${r.charPrId || 0}"><hh:t>${ESC(r.text)}</hh:t></hh:run>`;
  }).join('');
  return `<hh:para id="${pid}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hh:paraPr paraPrIDRef="${paraPrId}" condense="0"/>
    ${runsXml}
  </hh:para>`;
}

// cell: { text, isHeader, colSpan, rowSpan, width, height, col, row, alignLeft }
function cell(opts) {
  const cid = nid();
  const fillId = opts.isHeader ? 2 : 1;
  const charPrId = opts.isHeader ? 3 : 0;
  const paraPrId = opts.alignLeft ? 0 : 1;
  const h = opts.height || 1000;
  const w = opts.width || 1500;
  const colSpan = opts.colSpan || 1;
  const rowSpan = opts.rowSpan || 1;
  return `<hh:tc id="${cid}" name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${fillId}">
    <hh:tcPr colSpan="${colSpan}" rowSpan="${rowSpan}">
      <hh:cellAddr rowAddr="${opts.row || 0}" colAddr="${opts.col || 0}"/>
      <hh:cellSz width="${w}" height="${h}"/>
      <hh:cellMargin left="200" right="200" top="100" bottom="100"/>
    </hh:tcPr>
    ${para(opts.text || '', paraPrId, charPrId)}
  </hh:tc>`;
}

function row(cells, height = 1000) {
  const rid = nid();
  return `<hh:tr id="${rid}">${cells.join('')}</hh:tr>`;
}

// table: rowsXml = array of row XML strings, colWidths array, numCols
function table(rowsXml, numCols, numRows, colWidths) {
  const tid = nid();
  const colSzXml = colWidths.map(w => `<hh:colSz width="${w}"/>`).join('');
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  return `<hh:tbl id="${tid}" noSplit="0" repeatHeader="1" headingType="BOTH" isLastEmptyTr="0" lineWrap="BREAK">
    <hh:tblPr rowCount="${numRows}" colCount="${numCols}" cellSpacing="0" borderFillIDRef="1" noAdjust="0">
      <hh:insideMargin left="200" right="200" top="100" bottom="100"/>
      <hh:cellSpacing value="0"/>
      <hh:tblSz width="${totalW}" height="0"/>
      ${colSzXml}
    </hh:tblPr>
    ${rowsXml.join('')}
  </hh:tbl>`;
}

function section(bodyXml) {
  const sid = nid();
  return `<hh:sec xmlns:hh="http://www.hancom.co.kr/hwpml/2011/paragraph" id="${sid}" mustKeep="0">
  <hh:secPr textDirection="HORIZONTAL" spaceColumns="1134" tabStop="4000" outline="NONE" memoAttr="0" textVerticalWidthHead="0">
    <hh:masterPage>0</hh:masterPage>
    <hh:pageInfo landscape="0" width="21000" height="29700" gutterType="LEFT_ONLY">
      <hh:margin header="1500" footer="1500" gutter="0" left="1800" right="1800" top="1800" bottom="1800"/>
    </hh:pageInfo>
    <hh:footNoteShape lineDistance="567" startNumber="1" restartType="CONTINUOUS" numberType="DIGIT" userSymbol="" prefix="" suffix="" maxHeight="0">
      <hh:autoNumFormat numbering="0" startNum="1"/>
    </hh:footNoteShape>
    <hh:endNoteShape lineDistance="567" startNumber="1" restartType="DOCUMENT" numberType="DIGIT" userSymbol="" prefix="" suffix="">
      <hh:autoNumFormat numbering="0" startNum="1"/>
    </hh:endNoteShape>
    <hh:pageNumShape numberType="DIGIT" restartType="CONTINUOUS" startNumber="1" userSymbol="" prefix="" suffix=""/>
    <hh:pageBorderFill borderFillIDRef="0" textRef="0" headerRef="0" footerRef="0" fillArea="PAPER"/>
    <hh:masterPageID id="0"/>
  </hh:secPr>
  ${bodyXml}
</hh:sec>`;
}

function sectionXml(bodyParts) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${section(bodyParts.join('\n'))}`;
}

// ─── 내부용 HWPX ─────────────────────────────────────────────────

export async function downloadTuitionInternalHWPX(academy) {
  resetId();
  const baseDateStr = academy.changeDate || academy.regDate || '';
  const d = formatChangeDateKo(baseDateStr);
  const courses = academy.courses || [];
  const { label: signLabel, signerName } = getSignLabel(academy);

  // A4 본문 너비 17400 HU (18mm margin 양쪽)
  // 11열 배분
  const CW = [2700, 1500, 1500, 1300, 1500, 1400, 1200, 1200, 1500, 1200, 1400]; // 합계 = 17400
  const CELL_H = 1100;
  const HEAD_H = 900;

  // 헤더 행 1
  const hRow1Cells = [
    cell({ text: '교습과정', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[0], height: HEAD_H, col: 0, row: 0 }),
    cell({ text: '총교습시간(분/월)', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[1], height: HEAD_H, col: 1, row: 0 }),
    cell({ text: '교습비', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[2], height: HEAD_H, col: 2, row: 0 }),
    cell({ text: '징수단위(월,분기)', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[3], height: HEAD_H, col: 3, row: 0 }),
    cell({ text: '기타경비', isHeader: true, colSpan: 6, rowSpan: 1, width: CW[4], height: HEAD_H, col: 4, row: 0 }),
    cell({ text: '합계', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[10], height: HEAD_H, col: 10, row: 0 }),
  ];

  const hRow2Cells = [
    cell({ text: '모의고사비', isHeader: true, width: CW[4], height: HEAD_H, col: 4, row: 1 }),
    cell({ text: '재료비', isHeader: true, width: CW[5], height: HEAD_H, col: 5, row: 1 }),
    cell({ text: '피복비', isHeader: true, width: CW[6], height: HEAD_H, col: 6, row: 1 }),
    cell({ text: '급식비', isHeader: true, width: CW[7], height: HEAD_H, col: 7, row: 1 }),
    cell({ text: '기숙사비', isHeader: true, width: CW[8], height: HEAD_H, col: 8, row: 1 }),
    cell({ text: '차량비', isHeader: true, width: CW[9], height: HEAD_H, col: 9, row: 1 }),
  ];

  let rowIdx = 2;
  const dataRowsXml = courses.map(c => {
    const label = [c.process, c.subject].filter(Boolean).join(' / ');
    const t = parseNum(c.tuitionFee || c.totalFee);
    const s = parseNum(c.mockExamFee) + parseNum(c.materialFee) + parseNum(c.clothingFee) + parseNum(c.mealFee) + parseNum(c.dormitoryFee) + parseNum(c.vehicleFee);
    const total = t + s;
    const cells = [
      cell({ text: label, alignLeft: true, width: CW[0], height: CELL_H, col: 0, row: rowIdx }),
      cell({ text: fmtNum(c.totalTime), width: CW[1], height: CELL_H, col: 1, row: rowIdx }),
      cell({ text: fmtNum(c.tuitionFee || c.totalFee), width: CW[2], height: CELL_H, col: 2, row: rowIdx }),
      cell({ text: formatPeriod(c.period), width: CW[3], height: CELL_H, col: 3, row: rowIdx }),
      cell({ text: fmtNum(c.mockExamFee), width: CW[4], height: CELL_H, col: 4, row: rowIdx }),
      cell({ text: fmtNum(c.materialFee), width: CW[5], height: CELL_H, col: 5, row: rowIdx }),
      cell({ text: fmtNum(c.clothingFee), width: CW[6], height: CELL_H, col: 6, row: rowIdx }),
      cell({ text: fmtNum(c.mealFee), width: CW[7], height: CELL_H, col: 7, row: rowIdx }),
      cell({ text: fmtNum(c.dormitoryFee), width: CW[8], height: CELL_H, col: 8, row: rowIdx }),
      cell({ text: fmtNum(c.vehicleFee), width: CW[9], height: CELL_H, col: 9, row: rowIdx }),
      cell({ text: total > 0 ? total.toLocaleString('ko-KR') : '', width: CW[10], height: CELL_H, col: 10, row: rowIdx }),
    ];
    rowIdx++;
    return row(cells, CELL_H);
  });

  const emptyCount = Math.max(0, 8 - courses.length);
  const emptyRowsXml = Array.from({ length: emptyCount }, () => {
    const cells = CW.map((w, ci) => cell({ text: '', width: w, height: CELL_H, col: ci, row: rowIdx }));
    rowIdx++;
    return row(cells, CELL_H);
  });

  const notes = [...new Set(courses.map(c => (c.note || '').trim()).filter(Boolean))];
  const noteRowCells = [
    cell({ text: `비고  ${notes.join('  /  ')}`, alignLeft: true, colSpan: 11, width: CW[0], height: 900, col: 0, row: rowIdx }),
  ];
  const noteRowXml = row(noteRowCells, 900);
  rowIdx++;

  const totalRows = 2 + courses.length + emptyCount + 1;
  const tableXml = table(
    [row(hRow1Cells, HEAD_H), row(hRow2Cells, HEAD_H), ...dataRowsXml, ...emptyRowsXml, noteRowXml],
    11, totalRows, CW
  );

  const bodyParts = [
    para('[별지 제4호서식]', 0, 0),
    para('교습비등 게시표', 1, 1),
    para(academy.name, 1, 2),
    paraMultiRun([
      { text: `${d.year}년 ${d.month}월 ${d.day}일 현재`, charPrId: 0 },
      { text: '                    [단위: 원]', charPrId: 0 },
    ], 0),
    tableXml,
    para('「경기도 학원의 설립·운영 및 과외교습에 관한 조례 시행규칙」 제8조의2에 따라 교습비등을 위와 같이 게시합니다.', 0, 4),
    para(`${d.year}년 ${d.month}월 ${d.day}일`, 1, 0),
    para(`${signLabel}  ${signerName}  (서명 또는 인)`, 1, 0),
    para('유 의 사 항', 1, 2),
    para('1. 교습비등 게시표는 관할 교육지원청에 등록 신청한 최종자료를 게시합니다.', 0, 0),
    para('2. 글씨는 학습자의 확인이 쉬운 크기로 합니다.', 0, 0),
    para('3. 게시는 학원 및 교습소, 개인과외교습장소(교습자의 주거지에 한함)의 내부와 외부에 학습자가 보기 쉬운 장소에 합니다.', 0, 0),
  ];

  const zip = new JSZip();
  zip.file('mimetype', MIMETYPE, { compression: 'STORE' });
  zip.folder('META-INF').file('container.xml', CONTAINER_XML);
  const contents = zip.folder('Contents');
  contents.file('content.hpf', CONTENT_HPF);
  contents.file('header.xml', HEADER_XML);
  contents.file('settings.xml', SETTINGS_XML);
  contents.file('section0.xml', sectionXml(bodyParts));

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  downloadBlob(blob, `교습비게시표_내부용_${academy.name}.hwpx`);
}

// ─── 외부용 HWPX ─────────────────────────────────────────────────

export async function downloadTuitionExternalHWPX(academy) {
  resetId();
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

  // 6열
  const CW = [3000, 2400, 2600, 1600, 2000, 2200]; // 합계 = 13800 (6열)
  // 단 실제로는 헤더에서 5열로 만들어야 함 (기타경비는 colspan=2)
  const CELL_H = 1200;
  const HEAD_H = 950;

  const hRow1Cells = [
    cell({ text: '교습과목', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[0], height: HEAD_H, col: 0, row: 0 }),
    cell({ text: '교습시간(주기준)', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[1], height: HEAD_H, col: 1, row: 0 }),
    cell({ text: '교습비(월기준, 원)', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[2], height: HEAD_H, col: 2, row: 0 }),
    cell({ text: '기타경비(월기준)', isHeader: true, colSpan: 2, rowSpan: 1, width: CW[3], height: HEAD_H, col: 3, row: 0 }),
    cell({ text: '합계(최종납부금액)', isHeader: true, colSpan: 1, rowSpan: 2, width: CW[5], height: HEAD_H, col: 5, row: 0 }),
  ];
  const hRow2Cells = [
    cell({ text: '항목', isHeader: true, width: CW[3], height: HEAD_H, col: 3, row: 1 }),
    cell({ text: '금액(원)', isHeader: true, width: CW[4], height: HEAD_H, col: 4, row: 1 }),
  ];

  let rowIdx = 2;
  const dataRowsXml = [];
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
      const cells = [
        cell({ text: subject, alignLeft: true, colSpan: 1, rowSpan: 1, width: CW[0], height: CELL_H, col: 0, row: rowIdx }),
        cell({ text: '주   회, 회당       분', width: CW[1], height: CELL_H, col: 1, row: rowIdx }),
        cell({ text: tuitionStr, width: CW[2], height: CELL_H, col: 2, row: rowIdx }),
        cell({ text: '', width: CW[3], height: CELL_H, col: 3, row: rowIdx }),
        cell({ text: '', width: CW[4], height: CELL_H, col: 4, row: rowIdx }),
        cell({ text: totalStr, width: CW[5], height: CELL_H, col: 5, row: rowIdx }),
      ];
      dataRowsXml.push(row(cells, CELL_H));
      rowIdx++;
    } else {
      activeItems.forEach((it, idx) => {
        if (idx === 0) {
          const cells = [
            cell({ text: subject, alignLeft: true, colSpan: 1, rowSpan: span, width: CW[0], height: CELL_H, col: 0, row: rowIdx }),
            cell({ text: '주   회, 회당       분', colSpan: 1, rowSpan: span, width: CW[1], height: CELL_H, col: 1, row: rowIdx }),
            cell({ text: tuitionStr, colSpan: 1, rowSpan: span, width: CW[2], height: CELL_H, col: 2, row: rowIdx }),
            cell({ text: it.label, width: CW[3], height: CELL_H, col: 3, row: rowIdx }),
            cell({ text: fmtNum(c[it.key]), width: CW[4], height: CELL_H, col: 4, row: rowIdx }),
            cell({ text: totalStr, colSpan: 1, rowSpan: span, width: CW[5], height: CELL_H, col: 5, row: rowIdx }),
          ];
          dataRowsXml.push(row(cells, CELL_H));
        } else {
          const cells = [
            cell({ text: it.label, width: CW[3], height: CELL_H, col: 3, row: rowIdx }),
            cell({ text: fmtNum(c[it.key]), width: CW[4], height: CELL_H, col: 4, row: rowIdx }),
          ];
          dataRowsXml.push(row(cells, CELL_H));
        }
        rowIdx++;
      });
    }
  });

  const usedRows = courses.reduce((sum, c) => sum + Math.max(1, otherFeeItems.filter(it => parseNum(c[it.key]) > 0).length), 0);
  const emptyCount = Math.max(0, 6 - usedRows);
  const emptyRowsXml = Array.from({ length: emptyCount }, () => {
    const cells = CW.map((w, ci) => cell({ text: '', width: w, height: CELL_H, col: ci, row: rowIdx }));
    rowIdx++;
    return row(cells, CELL_H);
  });

  const notes = [...new Set(courses.map(c => (c.note || '').trim()).filter(Boolean))];
  const noteRowCells = [
    cell({ text: `비고  ${notes.join('  /  ')}`, alignLeft: true, colSpan: 6, width: CW[0], height: 900, col: 0, row: rowIdx }),
  ];
  const noteRowXml = row(noteRowCells, 900);
  rowIdx++;

  const totalRows = 2 + dataRowsXml.length + emptyCount + 1;
  const tableXml = table(
    [row(hRow1Cells, HEAD_H), row(hRow2Cells, HEAD_H), ...dataRowsXml, ...emptyRowsXml, noteRowXml],
    6, totalRows, CW
  );

  const bodyParts = [
    para('■ 교육부「학원비 옥외가격표시제 가이드라인」[별첨1]<신설 2017. 8.> (옥외용)', 0, 0),
    para('교습비등 게시표', 1, 1),
    para(academy.name, 1, 2),
    para(`${d.year}년 ${d.month}월 ${d.day}일`, 2, 0),
    tableXml,
    para('「학원의 설립·운영 및 과외교습에 관한 법률」제15조제3항에 따라 교습비등을 위와 같이 게시합니다.', 0, 4),
    para('「최종납부금액」은 관할 교육지원청에 등록한 교습비와 일치하며, 실제 납부금액을 표기한 것입니다.', 0, 4),
    para(`${signLabel}  ${signerName}  : (서명 또는 인)`, 1, 0),
  ];

  const zip = new JSZip();
  zip.file('mimetype', MIMETYPE, { compression: 'STORE' });
  zip.folder('META-INF').file('container.xml', CONTAINER_XML);
  const contents = zip.folder('Contents');
  contents.file('content.hpf', CONTENT_HPF);
  contents.file('header.xml', HEADER_XML);
  contents.file('settings.xml', SETTINGS_XML);
  contents.file('section0.xml', sectionXml(bodyParts));

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  downloadBlob(blob, `교습비게시표_외부용_${academy.name}.hwpx`);
}
