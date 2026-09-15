/**
 * 경기도 교육지원청별 교습비 기준단가 — 구글시트 + 웹앱
 *
 * [설치]
 * 1. 새 구글시트를 만든다 (아무에게도 공유하지 않는다).
 * 2. 확장 프로그램 › Apps Script → 이 파일 내용을 전부 붙여넣고 저장.
 * 3. 위쪽 함수 선택에서 setupSheet 실행 → 권한 허용. (탭·25개 지역이 만들어짐, 광주하남은 현재 단가로 채워짐)
 * 4. 시트를 새로고침하면 메뉴 "교습비 기준 관리"가 생긴다 → "① 비밀번호 직접 정하기"로 연 표에 지역별 비밀번호(예: 숫자 6자리)를 적고
 *    "② 표에 적은 비밀번호 적용"을 누른 뒤 주무관에게 전달. (메뉴 기능은 다시 배포하지 않아도 저장만 하면 바로 쓸 수 있다)
 * 5. 배포 › 새 배포 › 유형: 웹 앱 / 실행: 나 / 액세스 권한: 모든 사용자 → 배포 → 웹 앱 URL을 앱(src/utils/regionRates.js RATES_API_URL)에 넣는다.
 *    코드를 고친 뒤에는 배포 › 배포 관리 › 수정 › 버전: 새 버전 으로 다시 배포해야 반영된다.
 *
 * 비밀번호는 시트가 아니라 스크립트 속성(프로젝트 설정 › 스크립트 속성)에 해시로만 저장된다.
 */

var REGIONS = [
  '수원', '성남', '고양', '용인', '부천', '안산', '화성오산', '안양과천', '평택', '시흥', '광명', '군포의왕', '의정부',
  '구리남양주', '파주', '김포', '광주하남', '이천', '안성', '양평', '여주', '포천', '동두천양주', '가평', '연천'
];
var ALL_REGIONS_KEY = '전체';

var SHEET_INFO = '지역정보';
var SHEET_RATES = '기준단가';
var SHEET_LOG = '수정기록';
var INFO_HEADERS = ['지역', '교육지원청명', '개인과외시간당', '조정위원회개최일', '수정일시'];
var RATE_HEADERS = ['지역', '순서', 'ID', '분야', '교습과정', '교습과목', '분당단가', '키워드'];
var LOG_HEADERS = ['일시', '지역', '입력자', '내용'];

var MAX_ROWS = 50;
var MAX_FAILS = 5;
var BLOCK_SECONDS = 600;

var GWANGJU_HANAM_ROWS = [
  ['gh01', '입시·보습', '보습', '초등', 210],
  ['gh02', '입시·보습', '보습', '중등', 222],
  ['gh03', '입시·보습', '보습', '고등', 234],
  ['gh04', '입시·보습', '진학상담·지도', '', 234],
  ['gh05', '국제화', '어학', '', 259],
  ['gh06', '예능', '음악', '', 224],
  ['gh07', '예능', '음악', '입시', 336],
  ['gh08', '예능', '미술', '', 212],
  ['gh09', '예능', '미술', '입시', 255],
  ['gh10', '예능', '무용', '', 212],
  ['gh11', '예능', '무용', '입시', 255],
  ['gh12', '정보', '정보', '', 230],
  ['gh13', '기타', '기타', '', 230]
];

// ─── 설치·관리 (시트 편집기에서만 실행) ─────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('교습비 기준 관리')
    .addItem('① 비밀번호 직접 정하기 (표 열기)', 'openPasswordSheet')
    .addItem('② 표에 적은 비밀번호 적용', 'applyPasswordSheet')
    .addSeparator()
    .addItem('한 지역 비밀번호 직접 정하기', 'changeOnePassword')
    .addItem('지역별 비밀번호 무작위로 새로 만들기(전체)', 'resetAllPasswords')
    .addToUi();
}

var SHEET_PW = '비밀번호설정';
var MIN_PASSWORD_LENGTH = 4;

/** 지역 | 새 비밀번호 표를 연다 — 바꿀 지역만 적고 ② 적용을 누른다 */
function openPasswordSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PW);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PW);
    sheet.getRange(1, 1, 1, 3).setValues([['지역', '새 비밀번호', '안내']]).setFontWeight('bold').setBackground('#fef3c7');
    sheet.setFrozenRows(1);
    var names = [ALL_REGIONS_KEY].concat(REGIONS);
    sheet.getRange(2, 1, names.length, 1).setValues(names.map(function (n) { return [n]; }));
    sheet.getRange(2, 2, names.length, 1).setNumberFormat('@'); // 0으로 시작하는 숫자도 그대로
    sheet.getRange(2, 3).setValue('"전체"는 모든 지역을 고칠 수 있는 운영자용입니다.');
    sheet.getRange(3, 3).setValue('바꿀 지역만 ' + MIN_PASSWORD_LENGTH + '자리 이상 적고 메뉴 ② 적용을 누르세요. 적용하면 칸이 지워집니다.');
    sheet.setColumnWidth(3, 460);
  }
  ss.setActiveSheet(sheet);
}

function applyPasswordSheet() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PW);
  if (!sheet || sheet.getLastRow() < 2) { ui.alert('먼저 메뉴 ① 비밀번호 직접 정하기로 표를 여세요.'); return; }

  var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
  var values = range.getValues();
  var done = [], problems = [];
  values.forEach(function (v, i) {
    var region = String(v[0]).trim();
    var pw = String(v[1]).trim();
    if (!pw) return;
    if (region !== ALL_REGIONS_KEY && REGIONS.indexOf(region) < 0) { problems.push((i + 2) + '행: 지역 이름 확인 (' + region + ')'); return; }
    if (pw.length < MIN_PASSWORD_LENGTH) { problems.push(region + ': ' + MIN_PASSWORD_LENGTH + '자리 이상'); return; }
    setPasswordHash_(region, pw);
    sheet.getRange(i + 2, 2).clearContent();
    done.push(region);
  });
  ui.alert(
    '비밀번호 적용',
    (done.length ? '바꾼 지역: ' + done.join(', ') : '바꾼 지역이 없습니다.') + (problems.length ? '\n\n적용 안 됨:\n' + problems.join('\n') : ''),
    ui.ButtonSet.OK
  );
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var info = ensureSheet_(ss, SHEET_INFO, INFO_HEADERS);
  if (info.getLastRow() < 2) {
    info.getRange(2, 4, REGIONS.length, 2).setNumberFormat('@');
    info.getRange(2, 1, REGIONS.length, INFO_HEADERS.length).setValues(REGIONS.map(function (r) {
      return r === '광주하남'
        ? [r, officeNameOf_(r), 20000, '2024-12-26', '']
        : [r, officeNameOf_(r), '', '', ''];
    }));
  }

  var rates = ensureSheet_(ss, SHEET_RATES, RATE_HEADERS);
  if (rates.getLastRow() < 2) {
    rates.getRange(2, 1, GWANGJU_HANAM_ROWS.length, RATE_HEADERS.length).setValues(GWANGJU_HANAM_ROWS.map(function (row, i) {
      return ['광주하남', i + 1, row[0], row[1], row[2], row[3], row[4], ''];
    }));
  }

  ensureSheet_(ss, SHEET_LOG, LOG_HEADERS);

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid());

  var sheet1 = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);

  onOpen();
}

/** 25개 지역 + 전체(운영자용) 비밀번호를 새로 만들어 한 번만 보여준다 */
function resetAllPasswords() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('비밀번호 새로 만들기', '모든 지역의 비밀번호가 바뀌고, 이전 비밀번호는 더 이상 쓸 수 없습니다. 계속할까요?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;

  var lines = [];
  [ALL_REGIONS_KEY].concat(REGIONS).forEach(function (region) {
    var pw = randomPassword_();
    setPasswordHash_(region, pw);
    lines.push(region + '\t' + pw);
  });
  showPasswords_(lines);
}

function changeOnePassword() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('한 지역 비밀번호 직접 정하기', '지역 이름을 입력하세요. (예: 수원, 광주하남 / 운영자용은 "전체")', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var region = res.getResponseText().trim();
  if (region !== ALL_REGIONS_KEY && REGIONS.indexOf(region) < 0) {
    ui.alert('지역 이름이 목록에 없습니다: ' + region);
    return;
  }
  var pwRes = ui.prompt(region + ' 새 비밀번호', MIN_PASSWORD_LENGTH + '자리 이상 입력하세요. (예: 숫자 6자리)', ui.ButtonSet.OK_CANCEL);
  if (pwRes.getSelectedButton() !== ui.Button.OK) return;
  var pw = pwRes.getResponseText().trim();
  if (pw.length < MIN_PASSWORD_LENGTH) {
    ui.alert(MIN_PASSWORD_LENGTH + '자리 이상 입력하세요.');
    return;
  }
  setPasswordHash_(region, pw);
  ui.alert(region + ' 비밀번호를 바꿨습니다.');
}

function showPasswords_(lines) {
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif;font-size:13px">이 창을 닫으면 다시 볼 수 없습니다. 복사해서 안전하게 보관하세요.</p>' +
    '<textarea style="width:100%;height:340px;font-size:14px" readonly>' + lines.join('\n') + '</textarea>'
  ).setWidth(420).setHeight(440);
  SpreadsheetApp.getUi().showModalDialog(html, '지역별 비밀번호');
}

// ─── 웹앱 ───────────────────────────────────────────────────

function doGet() {
  try {
    return json_({ ok: true, regions: readAll_() });
  } catch (err) {
    return json_({ ok: false, error: '기준단가를 읽지 못했습니다: ' + err.message });
  }
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var region = String(req.region || '').trim();
    if (REGIONS.indexOf(region) < 0) return json_({ ok: false, error: '지역을 선택하세요.' });

    var check = checkPassword_(region, String(req.password || ''));
    if (!check.ok) return json_({ ok: false, error: check.error });

    if (req.action === 'verify') return json_({ ok: true });
    if (req.action === 'save') return json_(saveRegion_(region, req, check.by));
    return json_({ ok: false, error: '알 수 없는 요청입니다.' });
  } catch (err) {
    return json_({ ok: false, error: '처리 중 오류가 발생했습니다: ' + err.message });
  }
}

// ─── 내부 함수 ───────────────────────────────────────────────

function readAll_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var infoValues = dataRows_(ss.getSheetByName(SHEET_INFO), INFO_HEADERS.length);
  var rateValues = dataRows_(ss.getSheetByName(SHEET_RATES), RATE_HEADERS.length);

  var rowsByRegion = {};
  rateValues
    .filter(function (v) { return String(v[4]).trim(); })
    .sort(function (a, b) { return (Number(a[1]) || 0) - (Number(b[1]) || 0); })
    .forEach(function (v) {
      var region = String(v[0]).trim();
      (rowsByRegion[region] = rowsByRegion[region] || []).push({
        id: String(v[2] || ''),
        field: String(v[3] || ''),
        process: String(v[4]).trim(),
        subject: String(v[5] || '').trim(),
        rate: Number(v[6]) || 0,
        keywords: String(v[7] || '')
      });
    });

  return infoValues
    .filter(function (v) { return REGIONS.indexOf(String(v[0]).trim()) >= 0; })
    .map(function (v) {
      var region = String(v[0]).trim();
      return {
        region: region,
        officeName: String(v[1] || '') || officeNameOf_(region),
        tutoringHourly: Number(v[2]) || 0,
        effectiveDate: dateText_(v[3]),
        updatedAt: dateText_(v[4], true),
        rows: rowsByRegion[region] || []
      };
    });
}

function saveRegion_(region, req, by) {
  var rows = Array.isArray(req.rows) ? req.rows : [];
  if (!rows.length) return { ok: false, error: '교습과정을 한 줄 이상 입력하세요.' };
  if (rows.length > MAX_ROWS) return { ok: false, error: '교습과정은 ' + MAX_ROWS + '줄까지 입력할 수 있습니다.' };

  var clean = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || {};
    var process = text_(r.process, 40);
    var rate = Number(r.rate);
    if (!process) return { ok: false, error: (i + 1) + '번째 줄의 교습과정을 입력하세요.' };
    if (!(rate >= 1 && rate <= 9999 && Math.floor(rate) === rate)) return { ok: false, error: (i + 1) + '번째 줄의 분당단가가 올바르지 않습니다.' };
    clean.push([region, i + 1, text_(r.id, 40) || Utilities.getUuid().slice(0, 8), text_(r.field, 40), process, text_(r.subject, 40), rate, text_(r.keywords, 200)]);
  }
  var hourly = Number(req.tutoringHourly) || 0;
  if (hourly < 0 || hourly > 1000000) return { ok: false, error: '개인과외 시간당 기준이 올바르지 않습니다.' };
  var effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.effectiveDate || '')) ? String(req.effectiveDate) : '';
  var officeName = text_(req.officeName, 60) || officeNameOf_(region);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    // 기준단가: 이 지역 줄만 통째로 바꾸고 나머지 지역은 그대로
    var ratesSheet = ss.getSheetByName(SHEET_RATES);
    var others = dataRows_(ratesSheet, RATE_HEADERS.length).filter(function (v) {
      return String(v[0]).trim() && String(v[0]).trim() !== region;
    });
    var before = dataRows_(ratesSheet, RATE_HEADERS.length).filter(function (v) { return String(v[0]).trim() === region; }).length;
    var all = others.concat(clean).sort(function (a, b) {
      return (REGIONS.indexOf(String(a[0])) - REGIONS.indexOf(String(b[0]))) || (Number(a[1]) - Number(b[1]));
    });
    if (ratesSheet.getLastRow() > 1) ratesSheet.getRange(2, 1, ratesSheet.getLastRow() - 1, RATE_HEADERS.length).clearContent();
    ratesSheet.getRange(2, 1, all.length, RATE_HEADERS.length).setValues(all);

    // 지역정보
    var infoSheet = ss.getSheetByName(SHEET_INFO);
    var infoValues = dataRows_(infoSheet, INFO_HEADERS.length);
    var idx = -1;
    for (var j = 0; j < infoValues.length; j++) if (String(infoValues[j][0]).trim() === region) idx = j;
    var infoRow = idx >= 0 ? idx + 2 : infoSheet.getLastRow() + 1;
    infoSheet.getRange(infoRow, 4, 1, 2).setNumberFormat('@');
    infoSheet.getRange(infoRow, 1, 1, INFO_HEADERS.length).setValues([[region, officeName, hourly || '', effectiveDate, now]]);

    // 수정기록
    var summary = '교습과정 ' + before + '줄 → ' + clean.length + '줄 / 시간당 ' + (hourly || '미입력') + ' / 개최일 ' + (effectiveDate || '미입력') +
      ' / ' + clean.map(function (c) { return c[4] + (c[5] ? '(' + c[5] + ')' : '') + ' ' + c[6]; }).join(', ') +
      (by === ALL_REGIONS_KEY ? ' [운영자 비밀번호]' : '');
    ss.getSheetByName(SHEET_LOG).appendRow([now, region, text_(req.editor, 40), summary]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function checkPassword_(region, password) {
  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + region;
  var fails = Number(cache.get(failKey)) || 0;
  if (fails >= MAX_FAILS) return { ok: false, error: '비밀번호를 여러 번 틀려 10분 동안 입력할 수 없습니다.' };

  var props = PropertiesService.getScriptProperties();
  var regionHash = props.getProperty('PW_' + region);
  var allHash = props.getProperty('PW_' + ALL_REGIONS_KEY);
  if (!regionHash && !allHash) return { ok: false, error: '이 지역 비밀번호가 아직 만들어지지 않았습니다. 운영자에게 문의하세요.' };

  var hash = password ? hash_(password) : '';
  if (hash && hash === regionHash) { cache.remove(failKey); return { ok: true, by: region }; }
  if (hash && hash === allHash) { cache.remove(failKey); return { ok: true, by: ALL_REGIONS_KEY }; }

  cache.put(failKey, String(fails + 1), BLOCK_SECONDS);
  return { ok: false, error: '비밀번호가 맞지 않습니다.' };
}

function setPasswordHash_(region, password) {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid());
  props.setProperty('PW_' + region, hash_(password));
  CacheService.getScriptCache().remove('fail_' + region);
}

function hash_(password) {
  var salt = PropertiesService.getScriptProperties().getProperty('SALT') || '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function randomPassword_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var seed = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  var out = '';
  for (var i = 0; i < 10; i++) out += chars.charAt((seed[i] + 256) % chars.length);
  return out;
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eef2ff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function dataRows_(sheet, width) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
}

function officeNameOf_(region) {
  return '경기도' + region + '교육지원청';
}

function text_(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}

function dateText_(v, withTime) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', withTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  return String(v || '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
