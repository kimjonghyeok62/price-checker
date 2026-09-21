/**
 * 학원·교습소 교습비 실시간 조회 — 구글시트 + 웹앱
 *
 * 하는 일
 *  - 매일 새벽 4시: 교육지원청 명단 시트(원본)에서 학원·교습소 이름·번호만 골라 이 시트의 "검색목록"에 옮긴다.
 *    (생년월일·전화번호·주소 같은 개인정보는 옮기지 않는다)
 *  - 앱이 학원명을 고르고 등록(신고)번호를 넣으면, 번호가 맞을 때만 나이스 학원서비스에서 교습비를 실시간으로 가져와 돌려준다.
 *    나이스가 응답하지 않으면 검색목록에 보관된 과목·교습비(마지막 동기화 기준)를 대신 돌려준다.
 *
 * [설치]
 * 1. 새 구글시트를 만든다 (아무에게도 공유하지 않는다). 이 스크립트를 실행하는 계정이 원본 명단 시트를 볼 수 있어야 한다.
 * 2. 확장 프로그램 › Apps Script → 이 파일 내용을 전부 붙여넣고 저장.
 * 3. 위쪽 함수 선택에서 setup 실행 → 권한 허용. (검색목록 탭이 만들어지고, 매일 04시 자동 동기화가 켜진다)
 * 4. 배포 › 새 배포 › 유형: 웹 앱 / 실행: 나 / 액세스 권한: 모든 사용자 → 배포 → 웹 앱 URL을 앱(src/utils/academyLookup.js ACADEMY_API_URL)에 넣는다.
 *    코드를 고친 뒤에는 배포 › 배포 관리 › 수정 › 버전: 새 버전 으로 다시 배포해야 반영된다.
 * 5. 앱이 새 주소로 동작하는 것을 확인한 뒤, 원본 명단 시트의 공유를 "제한됨"으로 바꾼다. (링크만 알면 누구나 개인정보를 받을 수 있는 상태를 막는다)
 */

var SOURCE_SHEET_ID = '158ZNBb88raJ1kzBL3eFcgPZS9CGs5in0YtPtiPWfdic';
var SOURCE_REGION = '광주하남';
var SOURCES = [
  { gid: 1863320151, kind: '학원', no: '등록번호', name: '학원명', addr: '학원주소', founder: '설립자-성명', type: '학원종류' },
  { gid: 1929773080, kind: '교습소', no: '신고번호', name: '교습소명', addr: '교습소주소', founder: '교습자-성명', type: '' }
];
var ACTIVE_STATUS = ['개원', '신고'];

var SHEET_INDEX = '검색목록';
var INDEX_HEADERS = ['ID', '지역', '구분', '번호', '명칭', '시군', '동', '주소', '학원종류', '대표자', '변경일', '과목'];

var NEIS_URL = 'https://hakwon.neis.go.kr/hes_ics_sl00_002.do';
var NEIS_OFFICE = 'J10'; // 경기도교육청
// 나이스 학원서비스 행정구역 코드 (hes_ics_sl00_001.do)
var ZONE_CODES = {
  '가평군': '4182', '고양시': '4128', '과천시': '4129', '광명시': '4121', '광주시': '4179', '구리시': '4131',
  '군포시': '4141', '김포시': '4187', '남양주시': '4136', '동두천시': '4125', '부천시': '4119', '성남시': '4113',
  '수원시': '4111', '시흥시': '4139', '안산시': '4127', '안성시': '4186', '안양시': '4117', '양주시': '4171',
  '양평군': '4183', '여주시': '4173', '연천군': '4180', '오산시': '4137', '용인시': '4147', '의왕시': '4143',
  '의정부시': '4115', '이천시': '4151', '파주시': '4149', '평택시': '4122', '포천시': '4181', '하남시': '4145',
  '화성시': '4175'
};

// 과목 칸은 이름 없이 이 순서의 배열로 저장한다 (셀 하나 50,000자 제한 — 과목이 수백 개인 곳이 있다)
var COURSE_FIELDS = ['process', 'subject', 'period', 'totalTime', 'tuitionFee', 'mockExamFee', 'materialFee', 'mealFee', 'dormitoryFee', 'clothingFee', 'vehicleFee'];
var MAX_CELL_CHARS = 49000;

var MAX_FAILS = 5;
var BLOCK_SECONDS = 600;
var LOOKUP_CACHE_SECONDS = 600;
var SYNC_HOUR = 4;

// ─── 설치·동기화 (시트 편집기에서 실행) ─────────────────────────

function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid());

  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'syncAcademyList'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncAcademyList').timeBased().atHour(SYNC_HOUR).nearMinute(0).everyDays(1).inTimezone('Asia/Seoul').create();

  syncAcademyList();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet1 = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);
}

/** 원본 명단 → 검색목록 (매일 04시 트리거) */
function syncAcademyList() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var source = SpreadsheetApp.openById(SOURCE_SHEET_ID);
    var rows = [];
    SOURCES.forEach(function (src) {
      var sheet = sheetByGid_(source, src.gid);
      if (!sheet) throw new Error('원본 시트에서 ' + src.kind + ' 탭을 찾지 못했습니다 (gid ' + src.gid + ')');
      rows = rows.concat(buildIndexRows_(src, sheet.getDataRange().getDisplayValues()));
    });
    if (!rows.length) throw new Error('원본 명단에서 운영 중인 학원·교습소를 찾지 못했습니다.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var index = ss.getSheetByName(SHEET_INDEX) || ss.insertSheet(SHEET_INDEX);
    index.clearContents();
    index.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS]).setFontWeight('bold').setBackground('#eef2ff');
    index.setFrozenRows(1);
    index.getRange(2, 1, rows.length, INDEX_HEADERS.length).setNumberFormat('@').setValues(rows);

    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC', now);
    CacheService.getScriptCache().remove('list');
    Logger.log('검색목록 ' + rows.length + '곳 동기화 (' + now + ')');
  } finally {
    lock.releaseLock();
  }
}

function buildIndexRows_(src, values) {
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h).trim(); });
  var col = function (name) { return head.indexOf(name); };
  var c = {
    no: col(src.no), name: col(src.name), addr: col(src.addr), founder: col(src.founder), type: src.type ? col(src.type) : -1,
    status: col('등록상태'), changed: col('변경일'),
    process: col('교습과정'), subject: col('교습과목(반)'),
    period: col('교습기간'), months: col('교습기간(개월)'), days: col('교습기간(일)'),
    minutes: col('총교습기간(분)') >= 0 ? col('총교습기간(분)') : col('총교습시간(분)'),
    fee: col('교습비'), mock: col('모의고사비'), material: col('재료비'), meal: col('급식비'),
    dorm: col('기숙사비'), clothing: col('피복비'), vehicle: col('차량비')
  };
  if (c.no < 0 || c.name < 0 || c.status < 0) throw new Error(src.kind + ' 탭의 머리글(번호·명칭·등록상태)을 찾지 못했습니다.');
  var get = function (row, i) { return i >= 0 ? String(row[i] == null ? '' : row[i]).trim() : ''; };

  var byKey = {};
  var order = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var no = get(row, c.no), name = get(row, c.name);
    if (!no || !name || ACTIVE_STATUS.indexOf(get(row, c.status)) < 0) continue;

    var key = no + '|' + name;
    var item = byKey[key];
    if (!item) {
      var addr = get(row, c.addr);
      item = byKey[key] = {
        no: no, name: name, addr: addr, sigun: sigunOf_(addr), dong: dongOf_(addr),
        type: get(row, c.type) || (src.kind === '교습소' ? '교습소' : ''),
        founder: get(row, c.founder), changed: '', courses: []
      };
      order.push(key);
    }
    var changed = digits_(get(row, c.changed));
    if (changed > item.changed) item.changed = changed;

    var subject = get(row, c.subject);
    var process = get(row, c.process);
    if (!subject && !process) continue;
    // 원본은 보험 등으로 같은 과목 줄이 되풀이된다 — 과목·시간·교습비가 모두 같을 때만 한 줄로
    var minutes = get(row, c.minutes), fee = get(row, c.fee);
    if (item.courses.some(function (x) { return x.subject === subject && x.process === process && x.totalTime === minutes && x.tuitionFee === fee; })) continue;
    item.courses.push({
      process: process,
      subject: subject,
      period: get(row, c.period) || periodText_(get(row, c.months), get(row, c.days)),
      totalTime: minutes,
      tuitionFee: fee,
      mockExamFee: get(row, c.mock),
      materialFee: get(row, c.material),
      mealFee: get(row, c.meal),
      dormitoryFee: get(row, c.dorm),
      clothingFee: get(row, c.clothing),
      vehicleFee: get(row, c.vehicle),
      note: ''
    });
  }

  return order.map(function (key) {
    var x = byKey[key];
    return [idOf_(src.kind, x.no), SOURCE_REGION, src.kind, x.no, x.name, x.sigun, x.dong, x.addr, x.type, x.founder, x.changed, packCourses_(x.courses, x.name)];
  });
}

/** 과목 → 칸 하나. 그래도 너무 길면 비워 둔다 (그 학원은 나이스 실시간 조회만 된다) */
function packCourses_(courses, name) {
  var text = JSON.stringify(courses.map(function (c) {
    return COURSE_FIELDS.map(function (f) { return c[f] || ''; });
  }));
  if (text.length <= MAX_CELL_CHARS) return text;
  Logger.log('과목이 너무 많아 보관본을 저장하지 않음: ' + name + ' (' + courses.length + '개)');
  return '';
}

function unpackCourses_(text) {
  if (!text) return [];
  return JSON.parse(text).map(function (row) {
    var c = { note: '' };
    COURSE_FIELDS.forEach(function (f, i) { c[f] = row[i] || ''; });
    return c;
  });
}

// ─── 웹앱 ───────────────────────────────────────────────────

/** 검색 추천용 목록 — 번호·대표자·교습비는 내보내지 않는다 */
function doGet() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('list');
    if (cached) return textJson_(cached);

    var items = readIndex_().map(function (x) { return [x.id, x.kind, x.name, x.sigun, x.dong]; });
    var body = JSON.stringify({
      ok: true,
      region: SOURCE_REGION,
      syncedAt: PropertiesService.getScriptProperties().getProperty('LAST_SYNC') || '',
      items: items
    });
    try { cache.put('list', body, 3600); } catch (e) { /* 100KB 넘으면 캐시 없이 */ }
    return textJson_(body);
  } catch (err) {
    return json_({ ok: false, error: '학원 목록을 읽지 못했습니다: ' + err.message });
  }
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'lookup') return json_(lookup_(String(req.id || ''), String(req.regNo || '')));
    if (req.action === 'verify') return json_(verifyByName_(String(req.name || ''), String(req.regNo || '')));
    return json_({ ok: false, error: '알 수 없는 요청입니다.' });
  } catch (err) {
    return json_({ ok: false, error: '처리 중 오류가 발생했습니다: ' + err.message });
  }
}

// ─── 내부 함수 ───────────────────────────────────────────────

/** 학원 하나 — 번호가 맞으면 나이스 실시간 교습비, 안 되면 검색목록 보관본 */
function lookup_(id, regNo) {
  var item = readIndex_().filter(function (x) { return x.id === id; })[0];
  if (!item) return { ok: false, error: '학원을 찾지 못했습니다. 목록을 새로 불러와 다시 선택하세요.' };

  var check = checkRegNo_('id_' + id, [item], regNo);
  if (!check.ok) return check;

  var cache = CacheService.getScriptCache();
  var cacheKey = 'neis_' + id;
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var result;
  try {
    var neis = fetchNeis_(item);
    if (neis) result = { ok: true, source: 'neis', basis: nowText_(), academy: toAcademy_(item, neis) };
  } catch (err) {
    Logger.log('나이스 조회 실패 (' + item.name + '): ' + err.message);
  }
  if (!result && !item.courses) {
    return { ok: false, error: '나이스가 응답하지 않습니다. 잠시 후 다시 시도하거나, 아래 "나이스에서 엑셀을 받아 올리기"를 이용하세요.' };
  }
  if (!result) {
    result = {
      ok: true, source: 'sheet',
      basis: PropertiesService.getScriptProperties().getProperty('LAST_SYNC') || '',
      academy: toAcademy_(item, null)
    };
  }
  if (result.source === 'neis') {
    try { cache.put(cacheKey, JSON.stringify(result), LOOKUP_CACHE_SECONDS); } catch (e) { /* 너무 크면 캐시 없이 */ }
  }
  return result;
}

/** 나이스 엑셀을 올린 경우 — 이름·번호가 맞으면 게시표에 넣을 번호와 학원종류만 돌려준다 */
function verifyByName_(name, regNo) {
  var key = nameKey_(name);
  if (!key) return { ok: false, error: '학원명이 없습니다.' };
  var items = readIndex_().filter(function (x) { return nameKey_(x.name) === key; });
  if (!items.length) return { ok: false, error: '명단에서 이 학원을 찾지 못했습니다.' };
  var check = checkRegNo_('name_' + key, items, regNo);
  if (!check.ok) return check;
  return { ok: true, regNo: check.item.no, category: check.item.type, kind: check.item.kind };
}

function checkRegNo_(failId, items, regNo) {
  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + failId;
  var fails = Number(cache.get(failKey)) || 0;
  if (fails >= MAX_FAILS) return { ok: false, error: '번호를 여러 번 틀려 10분 동안 입력할 수 없습니다.' };

  var input = normNo_(regNo);
  var hit = input && items.filter(function (x) { return sameNo_(normNo_(x.no), input); })[0];
  if (hit) { cache.remove(failKey); return { ok: true, item: hit }; }

  cache.put(failKey, String(fails + 1), BLOCK_SECONDS);
  return { ok: false, error: '등록(신고)번호가 맞지 않습니다. 등록증의 번호를 확인하세요. (' + (MAX_FAILS - fails - 1) + '번 남음)' };
}

// 제 하남159호 / 하남-159 / 159 모두 같은 번호로 본다
function normNo_(v) {
  return String(v || '').replace(/[\s\-]/g, '').replace(/^제/, '').replace(/호$/, '').toLowerCase();
}
function sameNo_(stored, input) {
  if (!stored || !input) return false;
  if (stored === input) return true;
  return /^\d+$/.test(input) && stored.replace(/\D/g, '') === input;
}

function fetchNeis_(item) {
  var zone = ZONE_CODES[item.sigun];
  if (!zone) return null;
  var body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Parameters/>' +
    '<Dataset id="dsSearch"><ColumnInfo>' +
    '<Column id="searchAcaNm" type="STRING" size="256"/><Column id="searchAdtzoCd" type="STRING" size="256"/>' +
    '<Column id="searchAcaInstiScCd" type="STRING" size="256"/><Column id="cddcOrgCd" type="STRING" size="256"/>' +
    '</ColumnInfo><Rows><Row>' +
    '<Col id="searchAcaNm">' + escapeXml_(item.name) + '</Col>' +
    '<Col id="searchAdtzoCd">' + zone + '</Col>' +
    '<Col id="searchAcaInstiScCd">' + (item.kind === '교습소' ? '2' : '1') + '</Col>' +
    '<Col id="cddcOrgCd">' + NEIS_OFFICE + '</Col>' +
    '</Row></Rows></Dataset>' +
    '<Dataset id="dsPageInfo"><ColumnInfo><Column id="pageIndex" type="INT" size="256"/><Column id="pageSize" type="INT" size="256"/></ColumnInfo>' +
    '<Rows><Row><Col id="pageIndex">1</Col><Col id="pageSize">200</Col></Row></Rows></Dataset></Root>';

  var res = UrlFetchApp.fetch(NEIS_URL, {
    method: 'post',
    contentType: 'text/xml; charset=UTF-8',
    headers: { 'X-Requested-With': 'Fetch', 'Accept': 'text/xml', 'UI': 'nexacro' },
    payload: Utilities.newBlob(body).getBytes(),
    muteHttpExceptions: true,
    followRedirects: false
  });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  var text = res.getContentText('UTF-8');
  var err = /<Parameter id="ErrorCode"[^>]*>(-?\d+)</.exec(text);
  if (err && err[1] !== '0') throw new Error('ErrorCode ' + err[1]);

  var dataset = text.split('<Dataset id="dsList">')[1] || '';
  dataset = dataset.split('</Dataset>')[0];
  var rows = dataset.split('<Row>').slice(1).map(function (chunk) {
    var o = {};
    var re = /<Col id="(\w+)">([^<]*)<\/Col>/g, m;
    while ((m = re.exec(chunk))) o[m[1]] = decodeXml_(m[2]).trim();
    return o;
  });

  var key = nameKey_(item.name);
  rows = rows.filter(function (r) { return nameKey_(r.acaNm) === key; });
  if (!rows.length) return null;

  // 같은 이름이 둘 이상이면 주소가 같은 쪽만
  var ids = uniq_(rows.map(function (r) { return r.acaDsgnNo; }));
  if (ids.length > 1) {
    var addrKey = addrKey_(item.addr);
    rows = rows.filter(function (r) { return addrKey_(r.faAddr) === addrKey; });
    if (uniq_(rows.map(function (r) { return r.acaDsgnNo; })).length !== 1) return null;
  }
  return rows;
}

function toAcademy_(item, neisRows) {
  var courses, changed = item.changed, address = item.addr;
  if (neisRows) {
    courses = neisRows.map(function (r) {
      return {
        process: [r.leOrdNm, r.leCrseNm].filter(Boolean).join(' '),
        subject: r.leSbjtNm || '',
        period: r.lePrd || '',
        totalTime: r.totlLeHrMCnt || '',
        tuitionFee: r.thccAmt || '',
        mockExamFee: r.moteEtcExps || '',
        materialFee: r.etcExpsTmc || '',
        mealFee: r.etcExpsLm || '',
        dormitoryFee: r.etcExpsBrhsCst || '',
        clothingFee: r.etcExpsClex || '',
        vehicleFee: r.etcExpsTrex || '',
        note: ''
      };
    });
    changed = neisRows.reduce(function (max, r) { var d = digits_(r.aplcnYmd); return d > max ? d : max; }, '');
    address = neisRows[0].faAddr || address;
  } else {
    courses = unpackCourses_(item.courses);
  }
  var date = dotDate_(changed);
  return {
    name: item.name,
    address: address,
    regNo: item.no,
    category: item.type,
    changeDate: date,
    regDate: date,
    founder: { name: item.founder },
    courses: courses
  };
}

function readIndex_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INDEX);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('검색목록이 비어 있습니다. 편집기에서 setup을 실행하세요.');
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, INDEX_HEADERS.length).getDisplayValues().map(function (v) {
    return {
      id: v[0], region: v[1], kind: v[2], no: v[3], name: v[4], sigun: v[5], dong: v[6],
      addr: v[7], type: v[8], founder: v[9], changed: v[10], courses: v[11]
    };
  });
}

function sheetByGid_(ss, gid) {
  return ss.getSheets().filter(function (s) { return s.getSheetId() === gid; })[0] || null;
}

function idOf_(kind, no) {
  var salt = PropertiesService.getScriptProperties().getProperty('SALT') || '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + kind + '|' + no, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).slice(0, 12);
}

// "경기도 하남시 미사강변대로 … (망월동, …)" → 하남시 / 망월동
function sigunOf_(addr) {
  var m = /^\S+\s+(\S+[시군])/.exec(String(addr || ''));
  return m ? m[1] : '';
}
function dongOf_(addr) {
  var m = /\(\s*([^,()\s]+?[동읍면리가])\s*[,)]/.exec(String(addr || ''));
  return m ? m[1] : '';
}

function nameKey_(name) {
  return String(name || '').replace(/&amp;/g, '&').replace(/\s+/g, '').toLowerCase();
}
function addrKey_(addr) {
  return String(addr || '').split(',')[0].replace(/\s+/g, '');
}
function periodText_(months, days) {
  if (!months && !days) return '';
  return (Number(months) || 0) + '개월' + (Number(days) || 0) + '일';
}
function digits_(v) {
  var d = String(v || '').replace(/\D/g, '');
  return d.length === 8 ? d : '';
}
function dotDate_(yyyymmdd) {
  return yyyymmdd ? yyyymmdd.slice(0, 4) + '.' + yyyymmdd.slice(4, 6) + '.' + yyyymmdd.slice(6, 8) : '';
}
function nowText_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
}
function uniq_(arr) {
  return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
}
function escapeXml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function decodeXml_(s) {
  return String(s)
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function json_(obj) {
  return textJson_(JSON.stringify(obj));
}
function textJson_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
