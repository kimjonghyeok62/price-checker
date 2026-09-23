/**
 * 학원·교습소 교습비 실시간 조회 — 구글시트 + 웹앱
 *
 * 하는 일
 *  - 매일 새벽 4시: 경기도 학원·교습소 목록(나이스 교육정보 개방 포털 API)과 교육지원청 명단 시트를 합쳐 "검색목록"을 새로 만든다.
 *    (생년월일·전화번호 같은 개인정보는 옮기지 않는다)
 *  - 앱이 학원을 고르고 본인 확인 값을 넣으면, 맞을 때만 나이스 학원서비스에서 교습비를 실시간으로 가져와 돌려준다.
 *      · 명단 시트에 있는 학원·교습소(하남): 등록(신고)번호 또는 설립·운영자(교습자) 이름
 *      · 그 밖의 경기도 학원: 설립·운영자 이름 (분기마다 올리는 경기도교육청 학원 정보 파일 기준)
 *      · 확인할 자료가 없는 곳(다른 지역 교습소 등): 확인 없이 조회
 *    나이스가 응답하지 않으면 명단 시트에 보관된 과목·교습비(마지막 동기화 기준)를 대신 돌려준다.
 *
 * [설치]
 * 1. 새 구글시트를 만든다 (아무에게도 공유하지 않는다). 이 스크립트를 실행하는 계정이 원본 명단 시트를 볼 수 있어야 한다.
 * 2. 확장 프로그램 › Apps Script → 이 파일 내용을 전부 붙여넣고 저장.
 * 3. 위쪽 함수 선택에서 setup 실행 → 권한 허용. (검색목록 탭이 만들어지고, 매일 04시 자동 동기화가 켜진다)
 * 4. 배포 › 새 배포 › 유형: 웹 앱 / 실행: 나 / 액세스 권한: 모든 사용자 → 배포 → 웹 앱 URL을 앱(src/utils/academyLookup.js ACADEMY_API_URL)에 넣는다.
 *    코드를 고친 뒤에는 배포 › 배포 관리 › 수정 › 버전: 새 버전 으로 다시 배포해야 반영된다.
 *    (캐시 기능을 처음 넣을 때는 편집기에서 warmCache를 한 번 실행 — 캐시를 채우고 4시간마다 다시 채우는 트리거를 켠다)
 * 5. 앱이 새 주소로 동작하는 것을 확인한 뒤, 원본 명단 시트의 공유를 "제한됨"으로 바꾼다.
 *
 * [경기도 전체로 넓히기] 시트를 새로고침하면 메뉴 "교습비 조회 관리"가 생긴다.
 *  ① 나이스 인증키 넣기 — open.neis.go.kr 회원가입 › 인증키 신청(무료)으로 받은 키. 없으면 명단 시트(하남)만 검색된다.
 *  ② 경기도 학원 설립자 명단 올리기 — data.go.kr "경기도교육청_경기도 학원 정보" 엑셀(분기마다 갱신)을 받아 옆 창에서 고른다.
 *  ③ 지금 동기화 — 04시를 기다리지 않고 검색목록을 새로 만든다.
 */

var SOURCE_SHEET_ID = '158ZNBb88raJ1kzBL3eFcgPZS9CGs5in0YtPtiPWfdic';
var SOURCES = [
  { gid: 1863320151, kind: '학원', no: '등록번호', name: '학원명', addr: '학원주소', founder: '설립자-성명', type: '학원종류' },
  { gid: 1929773080, kind: '교습소', no: '신고번호', name: '교습소명', addr: '교습소주소', founder: '교습자-성명', type: '' }
];
var ACTIVE_STATUS = ['개원', '신고'];

// 교육지원청(앱의 지역 선택) → 시군
var OFFICE_SIGUN = {
  '수원': ['수원시'], '성남': ['성남시'], '고양': ['고양시'], '용인': ['용인시'], '부천': ['부천시'], '안산': ['안산시'],
  '화성오산': ['화성시', '오산시'], '안양과천': ['안양시', '과천시'], '평택': ['평택시'], '시흥': ['시흥시'], '광명': ['광명시'],
  '군포의왕': ['군포시', '의왕시'], '의정부': ['의정부시'], '구리남양주': ['구리시', '남양주시'], '파주': ['파주시'], '김포': ['김포시'],
  '광주하남': ['광주시', '하남시'], '이천': ['이천시'], '안성': ['안성시'], '양평': ['양평군'], '여주': ['여주시'], '포천': ['포천시'],
  '동두천양주': ['동두천시', '양주시'], '가평': ['가평군'], '연천': ['연천군']
};
var DEFAULT_OFFICE = '광주하남';

var SHEET_INDEX = '검색목록';
var INDEX_HEADERS = ['ID', '지역', '구분', '번호', '명칭', '시군', '동', '주소', '학원종류', '대표자', '변경일', '과목', '나이스번호'];
var SHEET_REGION_LISTS = '지역별목록';
var SHEET_FOUNDERS = '경기설립자';
var FOUNDER_HEADERS = ['학원명', '시군', '설립자', '기준일'];

var NEIS_OPEN_URL = 'https://open.neis.go.kr/hub/acaInsTiInfo';
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
var OPEN_PAGE_SIZE = 1000;
var OPEN_PARALLEL = 10;

var MAX_FAILS = 5;
var BLOCK_SECONDS = 600;
var LOOKUP_CACHE_SECONDS = 600;
var SYNC_HOUR = 4;

// 웹앱이 시트를 열지 않고 캐시(메모리)에서 바로 답하도록 — 캐시는 최대 6시간이라 4시간마다 다시 채운다
var CACHE_SECONDS = 21600;
var CACHE_CHUNK_CHARS = 30000; // 캐시 값 하나 100KB 제한 (한글 3바이트 기준)
var WARM_EVERY_HOURS = 4;

// ─── 설치·관리 (시트 편집기에서 실행) ─────────────────────────

function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid());

  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'syncAcademyList'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncAcademyList').timeBased().atHour(SYNC_HOUR).nearMinute(0).everyDays(1).inTimezone('Asia/Seoul').create();

  syncAcademyList();
  ensureWarmTrigger_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet1 = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('교습비 조회 관리')
    .addItem('① 나이스 인증키 넣기', 'promptNeisKey')
    .addItem('② 경기도 학원 설립자 명단 올리기', 'openFounderUpload')
    .addItem('③ 지금 동기화', 'syncNowFromMenu')
    .addToUi();
}

function promptNeisKey() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('나이스 인증키', 'open.neis.go.kr에서 받은 인증키를 붙여넣으세요. (비우고 확인하면 키를 지웁니다)', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var key = res.getResponseText().trim();
  var props = PropertiesService.getScriptProperties();
  if (!key) { props.deleteProperty('NEIS_API_KEY'); ui.alert('인증키를 지웠습니다. 명단 시트(하남)만 검색됩니다.'); return; }
  try {
    var total = fetchOpenPage_(key, 1, 1).total;
    props.setProperty('NEIS_API_KEY', key);
    ui.alert('인증키를 저장했습니다. (경기도 학원·교습소 ' + total + '곳) 메뉴 ③ 지금 동기화를 누르세요.');
  } catch (err) {
    ui.alert('인증키를 확인하지 못했습니다: ' + err.message);
  }
}

function syncNowFromMenu() {
  var n = syncAcademyList();
  SpreadsheetApp.getUi().alert('검색목록 ' + n + '곳을 새로 만들었습니다.');
}

/** 원본 명단 + 나이스 목록 + 설립자 명단 → 검색목록·지역별목록 (매일 04시 트리거) */
function syncAcademyList() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var t0 = Date.now();
    var took = function (label) { Logger.log(label + ' ' + Math.round((Date.now() - t0) / 1000) + '초'); };
    var local = readLocalSources_();
    took('명단 시트');
    var key = PropertiesService.getScriptProperties().getProperty('NEIS_API_KEY');
    var items = local;
    if (key) {
      var open = fetchOpenList_(key);
      took('나이스 목록 ' + open.length + '곳');
      items = mergeWithOpenList_(local, open, readFounders_());
      took('설립자 붙이기');
    }
    if (!items.length) throw new Error('검색목록에 넣을 학원·교습소가 없습니다.');

    var rows = items.map(function (x) {
      return [
        idOf_(x.kind, x.no ? x.no : 'N' + x.asnum), officeOf_(x.sigun), x.kind, x.no, x.name, x.sigun, x.dong, x.addr,
        x.type, x.founder, x.changed, x.courses ? packCourses_(x.courses, x.name) : '', x.asnum || ''
      ];
    });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var index = ss.getSheetByName(SHEET_INDEX) || ss.insertSheet(SHEET_INDEX);
    index.clearContents();
    index.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS]).setFontWeight('bold').setBackground('#eef2ff');
    index.setFrozenRows(1);
    took('ID 만들기');
    index.getRange(2, 1, rows.length, INDEX_HEADERS.length).setNumberFormat('@').setValues(rows);
    took('검색목록 쓰기');

    var lists = regionListsOf_(rows);
    writeRegionLists_(ss, lists);
    took('지역별목록 쓰기');

    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC', now);
    fillCache_(rows, lists, now);
    took('캐시 채우기');
    Logger.log('검색목록 ' + rows.length + '곳 동기화 (' + now + ')');
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

/** 교육지원청별 추천 목록(JSON)을 미리 만들어 둔다 — 앱 요청마다 수만 줄을 읽지 않도록 */
function writeRegionLists_(ss, lists) {
  var out = Object.keys(lists).map(function (office) {
    var json = lists[office];
    var cells = [office];
    for (var i = 0; i < json.length; i += MAX_CELL_CHARS) cells.push(json.slice(i, i + MAX_CELL_CHARS));
    return cells;
  });
  var width = out.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
  out = out.map(function (r) { while (r.length < width) r.push(''); return r; });

  var sheet = ss.getSheetByName(SHEET_REGION_LISTS) || ss.insertSheet(SHEET_REGION_LISTS);
  sheet.clearContents();
  if (out.length) sheet.getRange(1, 1, out.length, width).setNumberFormat('@').setValues(out);
}

/** 검색목록 행 → { 교육지원청: 추천 목록 JSON } */
function regionListsOf_(rows) {
  var byOffice = {};
  rows.forEach(function (r) {
    if (!r[1]) return;
    // [ID, 구분, 명칭, 시군, 동, 확인방법(N: 번호, P: 이름)]
    (byOffice[r[1]] = byOffice[r[1]] || []).push([r[0], r[2], r[4], r[5], r[6], (r[3] ? 'N' : '') + (r[9] ? 'P' : '')]);
  });
  var lists = {};
  Object.keys(byOffice).forEach(function (office) { lists[office] = JSON.stringify(byOffice[office]); });
  return lists;
}

function readLocalSources_() {
  var source = SpreadsheetApp.openById(SOURCE_SHEET_ID);
  var items = [];
  SOURCES.forEach(function (src) {
    var sheet = sheetByGid_(source, src.gid);
    if (!sheet) throw new Error('원본 시트에서 ' + src.kind + ' 탭을 찾지 못했습니다 (gid ' + src.gid + ')');
    items = items.concat(buildLocalItems_(src, sheet.getDataRange().getDisplayValues()));
  });
  return items;
}

function buildLocalItems_(src, values) {
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
        kind: src.kind, no: no, asnum: '', name: name, addr: addr, sigun: sigunOf_(addr), dong: dongOf_(addr),
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
  return order.map(function (key) { return byKey[key]; });
}

/** 나이스 개방 포털 — 경기도 운영 중인 학원·교습소 전체 (1,000곳씩) */
/** 경기도 학원·교습소 전체(약 4만 곳) — 1,000곳씩 여러 쪽을 한꺼번에 받는다 (차례로 받으면 6분 실행 한도를 넘는다) */
function fetchOpenList_(key) {
  var first = fetchOpenPage_(key, 1, OPEN_PAGE_SIZE);
  var pages = Math.ceil(first.total / OPEN_PAGE_SIZE);
  var all = [first.rows];
  for (var start = 2; start <= pages; start += OPEN_PARALLEL) {
    var nums = [];
    for (var p = start; p < start + OPEN_PARALLEL && p <= pages; p++) nums.push(p);
    var res = UrlFetchApp.fetchAll(nums.map(function (n) {
      return { url: openPageUrl_(key, n, OPEN_PAGE_SIZE), muteHttpExceptions: true };
    }));
    res.forEach(function (r, i) {
      // 한꺼번에 받다 한 쪽이 실패하면 그 쪽만 다시 받는다
      all.push(r.getResponseCode() === 200 ? parseOpenPage_(r).rows : fetchOpenPage_(key, nums[i], OPEN_PAGE_SIZE).rows);
    });
  }

  var out = [];
  var seen = {};
  all.forEach(function (rows) {
    rows.forEach(function (r) {
      if (String(r.REG_STTUS_NM || '').trim() !== '개원') return;
      var asnum = String(r.ACA_ASNUM || '').trim();
      if (asnum && seen[asnum]) return;
      seen[asnum] = true;
      var addr = [String(r.FA_RDNMA || '').trim(), String(r.FA_RDNDA || '').trim()].filter(Boolean).join(' ');
      var kind = String(r.ACA_INSTI_SC_NM || '').indexOf('교습소') >= 0 ? '교습소' : '학원';
      out.push({
        kind: kind, no: '', asnum: asnum, name: String(r.ACA_NM || '').trim(),
        addr: addr, sigun: String(r.ADMST_ZONE_NM || '').trim() || sigunOf_(addr), dong: dongOf_(addr),
        type: kind, founder: '', changed: '', courses: null
      });
    });
  });
  return out;
}

function openPageUrl_(key, page, size) {
  return NEIS_OPEN_URL + '?KEY=' + encodeURIComponent(key) + '&Type=json&ATPT_OFCDC_SC_CODE=' + NEIS_OFFICE + '&pIndex=' + page + '&pSize=' + size;
}

function fetchOpenPage_(key, page, size) {
  var res = UrlFetchApp.fetch(openPageUrl_(key, page, size), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('나이스 개방 포털 HTTP ' + res.getResponseCode());
  return parseOpenPage_(res);
}

function parseOpenPage_(res) {
  var json = JSON.parse(res.getContentText('UTF-8'));
  var body = json.acaInsTiInfo;
  if (!body) {
    var code = json.RESULT && json.RESULT.CODE;
    if (code === 'INFO-200') return { total: 0, rows: [] };
    throw new Error((json.RESULT && json.RESULT.MESSAGE) || '응답을 읽지 못했습니다.');
  }
  return { total: Number(body[0].head[0].list_total_count) || 0, rows: (body[1] && body[1].row) || [] };
}

/** 나이스 목록을 기준으로, 명단 시트에 있는 곳은 번호·이름·보관 과목을, 없는 학원은 설립자 명단의 이름을 붙인다 */
function mergeWithOpenList_(local, open, founders) {
  var localByKey = {};
  local.forEach(function (x) { localByKey[x.kind + '|' + nameKey_(x.name) + '|' + x.sigun] = x; });
  var used = {};
  var out = open.map(function (o) {
    var k = o.kind + '|' + nameKey_(o.name) + '|' + o.sigun;
    var l = localByKey[k];
    if (l) {
      used[k] = true;
      return {
        kind: l.kind, no: l.no, asnum: o.asnum, name: o.name, addr: o.addr || l.addr, sigun: o.sigun, dong: o.dong || l.dong,
        type: l.type, founder: l.founder, changed: l.changed, courses: l.courses
      };
    }
    if (o.kind === '학원') o.founder = founders[nameKey_(o.name) + '|' + o.sigun] || '';
    return o;
  });
  // 나이스 목록에 아직 없는 명단 시트 학원(이름이 막 바뀐 곳 등)도 남긴다
  local.forEach(function (x) {
    if (!used[x.kind + '|' + nameKey_(x.name) + '|' + x.sigun]) out.push(x);
  });
  return out;
}

function readFounders_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FOUNDERS);
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getDisplayValues().forEach(function (v) {
    var k = nameKey_(v[0]) + '|' + String(v[1]).trim();
    var f = String(v[2]).trim();
    if (!f) return;
    map[k] = map[k] ? uniq_((map[k] + ',' + f).split(',')).join(',') : f;
  });
  return map;
}

// ─── 설립자 명단 올리기 (옆 창에서 엑셀을 읽어 나눠 보낸다) ──────────

function openFounderUpload() {
  var html = HtmlService.createHtmlOutput(FOUNDER_UPLOAD_HTML).setTitle('경기도 학원 설립자 명단 올리기');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** 옆 창이 부른다 — rows: [[학원명, 시군, 설립자], …] */
function saveFounderChunk(rows, isFirst, baseDate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_FOUNDERS) || ss.insertSheet(SHEET_FOUNDERS);
  if (isFirst) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, FOUNDER_HEADERS.length).setValues([FOUNDER_HEADERS]).setFontWeight('bold').setBackground('#eef2ff');
    sheet.setFrozenRows(1);
  }
  var clean = (rows || []).map(function (r) {
    return [text_(r[0], 100), text_(r[1], 20), text_(r[2], 200), text_(baseDate, 20)];
  }).filter(function (r) { return r[0] && r[2]; });
  if (clean.length) sheet.getRange(sheet.getLastRow() + 1, 1, clean.length, FOUNDER_HEADERS.length).setNumberFormat('@').setValues(clean);
  return sheet.getLastRow() - 1;
}

var FOUNDER_UPLOAD_HTML =
  '<div style="font:14px sans-serif;line-height:1.5">' +
  '<p>data.go.kr <b>경기도교육청_경기도 학원 정보</b> 엑셀을 받아 고르세요. 학원명·시군·설립자 이름만 이 시트에 저장됩니다.</p>' +
  '<input type="file" id="f" accept=".xlsx"><p id="s" style="color:#334155"></p></div>' +
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>' +
  '<script>' +
  'var s=document.getElementById("s");function say(t){s.textContent=t;}' +
  'document.getElementById("f").onchange=function(e){var file=e.target.files[0];if(!file)return;say("파일 읽는 중… (1분 정도 걸릴 수 있습니다)");' +
  'file.arrayBuffer().then(function(buf){var wb=XLSX.read(buf,{type:"array",dense:true,cellText:false,cellHTML:false});' +
  'var seen={},rows=[],base="";wb.SheetNames.forEach(function(n){var a=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:""});' +
  'var h=-1;for(var i=0;i<Math.min(a.length,15);i++){var t=a[i].join("|");if(!base){var m=/\\((\\d{4})\\.\\s*(\\d{1,2})\\.\\s*(\\d{1,2})\\.?\\s*기준\\)/.exec(t);if(m)base=m[1]+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[3]).slice(-2);}if(a[i].indexOf("학원명")>=0&&a[i].indexOf("설립자-성명")>=0){h=i;break;}}' +
  'if(h<0)return;var ni=a[h].indexOf("학원명"),ai=a[h].indexOf("주소"),fi=a[h].indexOf("설립자-성명");' +
  'for(var r=h+1;r<a.length;r++){var nm=String(a[r][ni]||"").trim(),ad=String(a[r][ai]||"").trim(),fo=String(a[r][fi]||"").trim();if(!nm||!fo)continue;' +
  'var mm=/^\\S+\\s+(\\S+[시군])/.exec(ad),sg=mm?mm[1]:"";var k=nm+"|"+sg+"|"+fo;if(seen[k])continue;seen[k]=1;rows.push([nm,sg,fo]);}});' +
  'if(!rows.length){say("학원명·설립자-성명 열을 찾지 못했습니다. 파일을 확인하세요.");return;}send(rows,0,base);})' +
  '.catch(function(err){say("읽지 못했습니다: "+err.message);});};' +
  'function send(rows,i,base){var n=3000;if(i>=rows.length){say("저장 완료 ("+rows.length+"곳). 검색목록을 새로 만드는 중…");' +
  'google.script.run.withSuccessHandler(function(c){say("완료: 설립자 "+rows.length+"곳 저장, 검색목록 "+c+"곳 ("+(base||"기준일 모름")+" 기준)");})' +
  '.withFailureHandler(function(e){say("저장은 됐지만 동기화에 실패했습니다: "+e.message+" — 메뉴 ③ 지금 동기화를 눌러 주세요.");}).syncAcademyList();return;}' +
  'say("저장 중… "+Math.min(i+n,rows.length)+" / "+rows.length);' +
  'google.script.run.withSuccessHandler(function(){send(rows,i+n,base);}).withFailureHandler(function(e){say("저장 실패: "+e.message);})' +
  '.saveFounderChunk(rows.slice(i,i+n),i===0,base);}' +
  '</script>';

// ─── 웹앱 ───────────────────────────────────────────────────

/** ?region=광주하남 — 그 교육지원청 추천 목록. 번호·대표자·교습비는 내보내지 않는다 */
function doGet(e) {
  try {
    var office = String((e && e.parameter && e.parameter.region) || DEFAULT_OFFICE);
    var cache = CacheService.getScriptCache();
    var items = getBig_(cache, 'L|' + office);
    if (items === null) {
      items = readRegionListFromSheet_(office);
      putBig_(cache, 'L|' + office, items);
    }
    var synced = cache.get('SYNC');
    if (synced === null) {
      synced = PropertiesService.getScriptProperties().getProperty('LAST_SYNC') || '';
      cache.put('SYNC', synced, CACHE_SECONDS);
    }
    return textJson_('{"ok":true,"region":' + JSON.stringify(office) + ',"syncedAt":' + JSON.stringify(synced) + ',"items":' + items + '}');
  } catch (err) {
    return json_({ ok: false, error: '학원 목록을 읽지 못했습니다: ' + err.message });
  }
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var answer = String(req.answer != null ? req.answer : (req.regNo || ''));
    if (req.action === 'lookup') return json_(lookup_(String(req.id || ''), answer, String(req.region || '')));
    if (req.action === 'verify') return json_(verifyByName_(String(req.name || ''), answer));
    return json_({ ok: false, error: '알 수 없는 요청입니다.' });
  } catch (err) {
    return json_({ ok: false, error: '처리 중 오류가 발생했습니다: ' + err.message });
  }
}

// ─── 내부 함수 ───────────────────────────────────────────────

/** 학원 하나 — 본인 확인이 맞으면(확인 자료가 없으면 바로) 나이스 실시간 교습비, 안 되면 명단 보관본 */
function lookup_(id, answer, office) {
  var item = cachedItem_(id, office) || findById_(id);
  if (!item) return { ok: false, error: '학원을 찾지 못했습니다. 목록을 새로 불러와 다시 선택하세요.' };

  var verified = !!(item.no || item.founder);
  if (verified) {
    var check = checkAnswer_('id_' + id, [item], answer);
    if (!check.ok) return check;
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = 'neis_' + id;
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var result;
  try {
    var neis = fetchNeis_(item);
    if (neis) result = { ok: true, source: 'neis', verified: verified, basis: nowText_(), academy: toAcademy_(item, neis) };
  } catch (err) {
    Logger.log('나이스 조회 실패 (' + item.name + '): ' + err.message);
  }
  // 캐시에는 과목 보관본이 있는지만 들어 있다 — 나이스가 안 될 때만 시트에서 다시 읽는다
  if (!result && item.fromCache && item.courses) item = findById_(id) || item;
  if (!result && !item.courses) {
    return { ok: false, error: '나이스가 응답하지 않습니다. 잠시 후 다시 시도하거나, 아래 "나이스에서 엑셀을 받아 올리기"를 이용하세요.' };
  }
  if (!result) {
    result = {
      ok: true, source: 'sheet', verified: verified,
      basis: PropertiesService.getScriptProperties().getProperty('LAST_SYNC') || '',
      academy: toAcademy_(item, null)
    };
  }
  if (result.source === 'neis') {
    try { cache.put(cacheKey, JSON.stringify(result), LOOKUP_CACHE_SECONDS); } catch (e) { /* 너무 크면 캐시 없이 */ }
  }
  return result;
}

/** 나이스 엑셀을 올린 경우 — 이름·번호(또는 설립자 이름)가 맞으면 게시표에 넣을 번호와 학원종류만 돌려준다 */
function verifyByName_(name, answer) {
  var key = nameKey_(name);
  if (!key) return { ok: false, error: '학원명이 없습니다.' };
  var items = numberedByName_(key);
  if (!items.length) return { ok: false, error: '등록(신고)번호가 있는 명단에서 이 학원을 찾지 못했습니다.' };
  var check = checkAnswer_('name_' + key, items, answer);
  if (!check.ok) return check;
  return { ok: true, regNo: check.item.no, category: check.item.type, kind: check.item.kind };
}

/** 등록(신고)번호가 있는 같은 이름의 학원들 — 캐시(N|)에서, 없으면 검색목록 시트 전체에서 */
function numberedByName_(key) {
  var text = getBig_(CacheService.getScriptCache(), 'N|');
  if (text !== null) return (JSON.parse(text)[key] || []).map(rowToItem_);
  return readIndex_().filter(function (x) { return x.no && nameKey_(x.name) === key; });
}

function checkAnswer_(failId, items, answer) {
  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + failId;
  var fails = Number(cache.get(failKey)) || 0;
  if (fails >= MAX_FAILS) return { ok: false, error: '여러 번 틀려 10분 동안 입력할 수 없습니다.' };

  var input = String(answer || '').trim();
  var hit = input && items.filter(function (x) {
    return sameNo_(normNo_(x.no), normNo_(input)) || sameName_(x.founder, input);
  })[0];
  if (hit) { cache.remove(failKey); return { ok: true, item: hit }; }

  cache.put(failKey, String(fails + 1), BLOCK_SECONDS);
  return { ok: false, error: '입력한 번호(이름)가 명단과 맞지 않습니다. (' + (MAX_FAILS - fails - 1) + '번 남음)' };
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

// 설립자가 여럿이면 한 명만 맞아도 된다. 법인은 "주식회사"·"(주)" 등을 빼고 법인명으로 비교
function personKey_(v) {
  return String(v || '')
    .replace(/주식회사|유한회사|\(주\)|㈜|\(유\)|사단법인|재단법인|학교법인|\(사\)|\(재\)/g, '')
    .replace(/[\s·.()\[\]]/g, '')
    .toLowerCase();
}
function sameName_(founders, input) {
  var want = personKey_(input);
  if (want.length < 2) return false;
  return String(founders || '').split(/[,\/]/).some(function (f) { return personKey_(f) === want; });
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

  // 같은 이름이 둘 이상이면 나이스 번호(없으면 주소)가 같은 쪽만
  var ids = uniq_(rows.map(function (r) { return r.acaDsgnNo; }));
  if (ids.length > 1) {
    if (item.asnum && ids.indexOf(item.asnum) >= 0) {
      rows = rows.filter(function (r) { return r.acaDsgnNo === item.asnum; });
    } else {
      var addrKey = addrKey_(item.addr);
      rows = rows.filter(function (r) { return addrKey_(r.faAddr) === addrKey; });
      if (uniq_(rows.map(function (r) { return r.acaDsgnNo; })).length !== 1) return null;
    }
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

function rowToItem_(v) {
  return {
    id: v[0], region: v[1], kind: v[2], no: v[3], name: v[4], sigun: v[5], dong: v[6],
    addr: v[7], type: v[8], founder: v[9], changed: v[10], courses: v[11], asnum: v[12]
  };
}

function findById_(id) {
  if (!id) return null;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INDEX);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var hit = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).matchCase(true).findNext();
  return hit ? rowToItem_(sheet.getRange(hit.getRow(), 1, 1, INDEX_HEADERS.length).getDisplayValues()[0]) : null;
}

/** 캐시에 있는 그 교육지원청 학원 정보 — 없으면 null (그러면 시트에서 찾는다) */
function cachedItem_(id, office) {
  if (!id || !office) return null;
  var text = getBig_(CacheService.getScriptCache(), 'D|' + office);
  if (!text) return null;
  var row = JSON.parse(text)[id];
  if (!row) return null;
  var item = rowToItem_(row);
  item.fromCache = true;
  return item;
}

function readRegionListFromSheet_(office) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_REGION_LISTS);
  if (!sheet || sheet.getLastRow() < 1) throw new Error('검색목록이 비어 있습니다. 편집기에서 setup을 실행하세요.');
  var hit = sheet.getRange(1, 1, sheet.getLastRow(), 1).createTextFinder(office).matchEntireCell(true).findNext();
  if (!hit) return '[]';
  return sheet.getRange(hit.getRow(), 2, 1, sheet.getLastColumn() - 1).getDisplayValues()[0].join('') || '[]';
}

function readIndexRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INDEX);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('검색목록이 비어 있습니다. 편집기에서 setup을 실행하세요.');
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, INDEX_HEADERS.length).getDisplayValues();
}

function readIndex_() {
  return readIndexRows_().map(rowToItem_);
}

// ─── 캐시 ───────────────────────────────────────────────────

/** 4시간마다 자동 실행 — 캐시 기능을 처음 넣을 때 편집기에서 한 번 실행하면 트리거도 켜진다 */
function warmCache() {
  ensureWarmTrigger_();
  var rows = readIndexRows_();
  fillCache_(rows, regionListsOf_(rows), PropertiesService.getScriptProperties().getProperty('LAST_SYNC') || '');
  Logger.log('캐시 채움: ' + rows.length + '곳');
}

function ensureWarmTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'warmCache'; });
  if (!has) ScriptApp.newTrigger('warmCache').timeBased().everyHours(WARM_EVERY_HOURS).create();
}

/** 교육지원청마다 추천 목록(L|)과 조회용 학원 정보(D|, 과목 칸은 보관본이 있으면 '1'만), 번호 확인용 명단(N|)을 캐시에 넣는다 */
function fillCache_(rows, lists, synced) {
  var cache = CacheService.getScriptCache();
  var detail = {};
  var numbered = {}; // 엑셀 올리기 번호 확인용 — 번호가 있는 곳(명단 시트)만, 이름별로
  rows.forEach(function (r) {
    var row = r.slice(0, INDEX_HEADERS.length);
    row[11] = row[11] ? '1' : '';
    if (r[3]) (numbered[nameKey_(r[4])] = numbered[nameKey_(r[4])] || []).push(row);
    if (r[1]) (detail[r[1]] = detail[r[1]] || {})[r[0]] = row;
  });
  Object.keys(lists).forEach(function (office) {
    try {
      putBig_(cache, 'L|' + office, lists[office]);
      if (detail[office]) putBig_(cache, 'D|' + office, JSON.stringify(detail[office]));
    } catch (err) {
      Logger.log('캐시 넣기 실패 (' + office + '): ' + err.message);
    }
  });
  try {
    putBig_(cache, 'N|', JSON.stringify(numbered));
  } catch (err) {
    Logger.log('캐시 넣기 실패 (번호 명단): ' + err.message);
  }
  cache.put('SYNC', synced || '', CACHE_SECONDS);
}

// 긴 글은 여러 조각으로 나눠 넣고, 한 조각이라도 빠지면 없는 것으로 본다
function putBig_(cache, key, text) {
  var k = encodeURIComponent(key);
  var map = {};
  var n = 0;
  for (var i = 0; i < text.length; i += CACHE_CHUNK_CHARS) map[k + '#' + (n++)] = text.slice(i, i + CACHE_CHUNK_CHARS);
  map[k + '#n'] = String(n);
  cache.putAll(map, CACHE_SECONDS);
}

function getBig_(cache, key) {
  var k = encodeURIComponent(key);
  var n = Number(cache.get(k + '#n'));
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(k + '#' + i);
  var got = cache.getAll(keys);
  var parts = [];
  for (var j = 0; j < n; j++) {
    if (got[keys[j]] == null) return null;
    parts.push(got[keys[j]]);
  }
  return parts.join('');
}

function sheetByGid_(ss, gid) {
  return ss.getSheets().filter(function (s) { return s.getSheetId() === gid; })[0] || null;
}

// 동기화 때 4만 번 불리므로 SALT는 한 번만 읽는다
var salt_ = null;

function idOf_(kind, no) {
  if (salt_ === null) salt_ = PropertiesService.getScriptProperties().getProperty('SALT') || '';
  var salt = salt_;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + kind + '|' + no, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).slice(0, 12);
}

function officeOf_(sigun) {
  for (var office in OFFICE_SIGUN) if (OFFICE_SIGUN[office].indexOf(sigun) >= 0) return office;
  return '';
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
  return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; });
}
function text_(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
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
