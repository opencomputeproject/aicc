/**
 * OCP AICC · NeoCloud Deployment Requirements Survey – response receiver (Google Apps Script web app)
 *
 * This project has TWO script files:
 *   Code.gs    this file
 *   Survey.gs  a copy of forms/neocloud-requirements/survey.js (the questions, shared with the page)
 *
 * Set up (once): open the Survey Results Sheet → Extensions → Apps Script, paste both files, run `setup`,
 * then Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone. Copy the /exec URL
 * into forms/neocloud-requirements/config.js as `endpoint`.
 * After ANY change: Deploy → Manage deployments → pencil → Version: New version → Deploy (the URL stays the same).
 */

// ---- 1. Settings ------------------------------------------------------------------------
const CONFIG = {
  sheetId: '1D51otB94V_2Vx5AuIHR-jgwDH20cFB3OggVk5jGuj2s',   // "Survey Results" in the AICC Drive folder
  tab: 'Responses',              // rows go here; don't rename it once responses arrive
  codebookTab: 'Codebook',       // written by setup: every code and its wording
  refPrefix: 'NC',               // references look like NC-3F9A1C
  closes: '',                    // deadline in UTC, e.g. '2027-01-31T07:59:00Z'; '' = open (match config.js)
  closesLabel: '',               // the deadline in words, e.g. 'January 30, 2027 at 11:59 PM PT'
  site: 'https://opencomputeproject.github.io/aicc/',
  page: 'forms/neocloud-requirements/',
  projectUrl: 'https://www.opencompute.org/projects/aicc/',
  mailingList: 'https://ocp-all.groups.io/g/ocp-aicc',
  senderName: 'OCP AI Computing Continuum',
  replyTo: '',                   // where replies to the confirmation go; '' = the deploying account
  notifyStaff: [],               // e.g. ['aicc-leads@example.org']: emailed on every new response
  rate: { perEmailPerHour: 5, allPerMinute: 20 },  // submissions + edits allowed
  staffColumns: ['Status', 'Notes'],
  statusOptions: ['New', 'Reviewed', 'Follow up', 'Exclude from analysis'],
};
const LOGOS = { ocpLogo: CONFIG.site + 'assets/ocp-logo.png', aiccLogo: CONFIG.site + 'assets/aicc-icon.png' };

// Values written for answers that were not asked or left empty (explained in the Codebook tab).
const SKIP = 'SKIP';   // not asked: tier not offered (Q3 = NA) or hidden by display logic (Q21–Q22)
const NONE = 'NONE';   // asked, and nothing was selected in an optional select-all list

// ---- Everything below works as is ------------------------------------------------------

const CONTACT = [
  ['firstName', 'First name', true, 100], ['lastName', 'Last name', true, 100], ['email', 'Email', true, 254],
  ['company', 'Organization', false, 150], ['jobTitle', 'Job title', false, 150]];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Questions in order, with an index of option labels.
function questions_() {
  const out = [];
  SURVEY.sections.forEach((s, si) => s.questions.forEach(q => {
    const label = {};
    q.options.forEach(o => { label[o[0]] = o[1]; });
    out.push(Object.assign({ section: si, label: label }, q));
  }));
  return out;
}
const pad_ = n => (n < 10 ? '0' : '') + n;
const tierName_ = k => SURVEY.tiers.filter(t => t[0] === k)[0][1];

// Every answer column: [header, question, part], part = tier key | 'other' | 'comment' | rank index | ''.
function answerColumns_() {
  const cols = [];
  questions_().forEach(q => {
    const h = `Q${pad_(q.n)} ${q.title}`;
    if (q.type === 'grid1' || q.type === 'gridN') SURVEY.tiers.forEach(t => cols.push([`${h} – ${t[1]}`, q, t[0]]));
    else if (q.type === 'rank') for (let i = 0; i < q.count; i++) cols.push([`${h} – rank ${i + 1}`, q, i]);
    else cols.push([h, q, '']);
    if (q.other) cols.push([`Q${pad_(q.n)} Other (described)`, q, 'other']);
    if (q.comment) cols.push([`Q${pad_(q.n)} Final comment`, q, 'comment']);
  });
  return cols;
}
function headers_() {
  return ['Submitted', 'Reference'].concat(CONTACT.map(c => c[1]), answerColumns_().map(c => c[0]),
    ['Survey version', 'Privacy consent', 'Last edited'], CONFIG.staffColumns);
}
const formColumnCount_ = () => headers_().length - CONFIG.staffColumns.length;   // through "Last edited"

/** Run once from the editor. Creates the Responses and Codebook tabs, headers, formatting and the edit-link secret. */
function setup() {
  const ss = book_();
  let sh = ss.getSheetByName(CONFIG.tab);
  if (!sh) {
    const first = ss.getSheets()[0];
    sh = (ss.getSheets().length === 1 && first.getLastRow() === 0) ? first.setName(CONFIG.tab) : ss.insertSheet(CONFIG.tab, 0);
  }
  editSecret_();
  writeCodebook();
  if (sh.getLastRow() > 0) { Logger.log(`"${CONFIG.tab}" already has headers; left as is. ` + (columnProblem_(sh) || 'Columns match the survey.')); return; }

  const h = headers_(), n = h.length, nForm = formColumnCount_();
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  const head = sh.getRange(1, 1, 1, n);
  head.setValues([h]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#19194D').setWrap(true).setVerticalAlignment('middle');
  // Alternate the header color by survey section so the 150 columns are easier to scan.
  const cols = answerColumns_(), first = 2 + CONTACT.length + 1;
  cols.forEach((c, i) => { if (c[1].section % 2) sh.getRange(1, first + i).setBackground('#343895'); });
  sh.getRange(1, nForm + 1, 1, CONFIG.staffColumns.length).setBackground('#5F6062');
  sh.setRowHeight(1, 64); sh.setFrozenRows(1); sh.setFrozenColumns(2);
  h.forEach((x, i) => sh.setColumnWidth(i + 1, i < 2 ? 130 : /comment|Notes|Other/.test(x) ? 320 : 150));
  const rows = sh.getMaxRows() - 1;
  sh.getRange(2, 1, rows, n).setVerticalAlignment('top').setWrap(true);
  sh.getRange(2, 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(2, nForm, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(2, nForm + 1, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.statusOptions, true).setAllowInvalid(false).build());
  Logger.log(`Set up "${CONFIG.tab}" (${n} columns) and "${CONFIG.codebookTab}" in "${ss.getName()}". Next: Deploy → New deployment → Web app.`);
}

/** Rewrites the Codebook tab from the survey (run it after changing survey wording). */
function writeCodebook() {
  const ss = book_();
  const sh = ss.getSheetByName(CONFIG.codebookTab) || ss.insertSheet(CONFIG.codebookTab);
  sh.clear();
  const type = { single: 'Single choice', multi: 'Select all', grid1: 'S/M/L single matrix', gridN: 'S/M/L checkbox matrix', rank: 'Ranking' };
  const colsBy = {};
  answerColumns_().forEach(c => { (colsBy[c[1].id] = colsBy[c[1].id] || []).push(c[0]); });
  const rows = [['Question', 'Title', 'Type', 'Sheet columns', 'Code', 'Answer']];
  rows.push(['', 'How to read the Responses tab', '', '', SKIP, 'Not asked: that tier is not offered (Q3 = Not applicable), or Q21–Q22 were hidden because Q20 had no liquid, rear-door or immersion cooling.']);
  rows.push(['', '', '', '', NONE, 'Asked, and nothing was selected (optional select-all lists and S/M/L checkbox matrices).']);
  rows.push(['', '', '', '', '(several)', 'Select-all answers list every selected code, separated by "; ".']);
  rows.push(['', '', '', '', '(blank)', 'No answer to an optional free-text box.']);
  questions_().forEach(q => {
    q.options.forEach((o, i) => rows.push(i ? ['', '', '', '', o[0], o[1]]
      : [`Q${pad_(q.n)}`, q.title, type[q.type] + (q.max ? ` (max ${q.max})` : '') + (q.count ? ` (top ${q.count})` : '') + (q.required ? ', required' : ''),
        colsBy[q.id].join('\n'), o[0], o[1]]));
  });
  sh.getRange(1, 1, rows.length, 6).setValues(rows).setVerticalAlignment('top').setWrap(true);
  sh.getRange(1, 1, 1, 6).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#19194D');
  sh.setFrozenRows(1);
  [70, 260, 170, 300, 100, 420].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  Logger.log(`Wrote ${rows.length - 1} rows to "${CONFIG.codebookTab}" (survey version ${SURVEY.version}).`);
}

/** Run once after pasting a new version, so Google asks for any new permission before a live response needs it. */
function authorize() {
  book_(); editSecret_();
  try { UrlFetchApp.fetch(LOGOS.ocpLogo); } catch (e) { Logger.log('Logos not reachable yet (GitHub Pages off?): ' + e); }
  Logger.log('Permissions OK. Emails left today: ' + MailApp.getRemainingDailyQuota());
}

/** Checks that the Sheet's columns still match the survey (run after changing questions). */
function checkColumns() {
  const sh = book_().getSheetByName(CONFIG.tab);
  Logger.log(sh ? columnProblem_(sh) || 'Columns match the survey.' : `No tab named "${CONFIG.tab}" yet: run setup.`);
}

/** Logs every response's private edit link (to resend one by hand). Visible only to you in the log. */
function listEditLinks() {
  const sh = book_().getSheetByName(CONFIG.tab);
  if (!sh || sh.getLastRow() < 2) return;
  sh.getRange(2, 2, sh.getLastRow() - 1, 4).getValues().forEach(r => { if (r[0]) Logger.log(`${r[0]}  ${r[3]}  ${editLink_(r[0])}`); });
}

// ---- Web entry points (functions without a trailing _ are public; every helper ends in _) ----
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action !== 'load') return json_({ ok: true, survey: SURVEY.id, version: SURVEY.version });
    if (p.formId !== SURVEY.id || !p.ref || !tokenOk_(p.ref, p.t)) return json_({ ok: false, error: 'This edit link is not valid.' });
    if (isClosed_()) return json_({ ok: false, error: 'The survey has closed, so responses can no longer be changed.' });
    const sh = book_().getSheetByName(CONFIG.tab);
    const r = sh ? findRow_(sh, p.ref) : 0;
    if (!r) return json_({ ok: false, error: 'We could not find this response.' });
    if (columnProblem_(sh)) return json_({ ok: false, error: 'The survey is being updated. Please try again later.' });
    const v = sh.getRange(r, 1, 1, formColumnCount_()).getValues()[0];
    return json_({ ok: true, ref: p.ref, data: rowToData_(v) });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong on our side.' });
  }
}

function doPost(e) {
  try {
    let d;
    try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'The response could not be read.' }); }
    d = d || {};
    if (d.website) return json_({ ok: true, ref: CONFIG.refPrefix + '-000000' });   // honeypot: bots fill the hidden field
    if (d.formId !== SURVEY.id) return json_({ ok: false, error: 'This survey is not recognised.' });
    if (isClosed_()) return json_({ ok: false, error: 'The survey has closed.' });
    if (d.version !== SURVEY.version)
      return json_({ ok: false, error: 'The survey was updated while you were answering. Reload the page (your answers are kept in this browser), check them and submit again.' });
    const editing = !!d.editRef;
    if (editing && !tokenOk_(d.editRef, d.editToken)) return json_({ ok: false, error: 'This edit link is not valid.' });

    const checked = check_(d);
    if (checked.error) return json_({ ok: false, error: checked.error });
    const c = checked.contact, cells = checked.cells;

    const ref = editing ? String(d.editRef) : CONFIG.refPrefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const limited = rateLimited_(c.email);
      if (limited) return json_(limited);
      const sh = book_().getSheetByName(CONFIG.tab);
      if (!sh || sh.getLastRow() === 0) return json_({ ok: false, error: 'The survey is not set up yet (run setup).' });
      const problem = columnProblem_(sh);
      if (problem) { console.error(problem); return json_({ ok: false, error: 'The survey is being updated. Please try again later.' }); }
      const values = CONTACT.map(x => text_(c[x[0]])).concat(cells, [text_(SURVEY.version), 'Yes']);
      if (editing) {
        const r = findRow_(sh, ref);
        if (!r) return json_({ ok: false, error: 'We could not find this response.' });
        sh.getRange(r, 3, 1, values.length + 1).setValues([values.concat([new Date()])]);   // answers + Last edited
      } else {
        sh.getRange(nextRow_(sh), 1, 1, values.length + 4)
          .setValues([[new Date(), ref].concat(values, [''], [CONFIG.statusOptions[0]])]);
      }
    } finally {
      lock.releaseLock();
    }

    // The row is saved; an email problem must not turn that into a failure for the respondent.
    try { sendReceipt_(c, checked.answers, ref, editing); } catch (err) { console.error('Receipt failed: ' + err); }
    if (!editing && CONFIG.notifyStaff.length) { try { notifyStaff_(c, checked.answers, ref); } catch (err) { console.error('Staff email failed: ' + err); } }
    return json_({ ok: true, ref: ref });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong on our side.' });
  }
}

// ---- Validation (the page checks too, but never trust it alone) -------------------------
// Returns { contact, answers, cells } or { error }. `cells` are the answer columns in Sheet order.
function check_(d) {
  const contact = {};
  for (const [id, label, req, max] of CONTACT) {
    const v = String(d[id] == null ? '' : d[id]).trim();
    if (req && !v) return { error: `"${label}" is required.` };
    if (v.length > max) return { error: `"${label}" is too long.` };
    contact[id] = v;
  }
  if (!EMAIL_RE.test(contact.email)) return { error: 'The email address is not valid.' };
  if (d.consent !== true) return { error: 'Please accept the privacy terms.' };

  const a = (d.answers && typeof d.answers === 'object') ? d.answers : {};
  const qs = questions_(), by = {};
  qs.forEach(q => { by[q.id] = q; });
  const tierKeys = SURVEY.tiers.map(t => t[0]);
  const isCode = (q, v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(q.label, v);
  const list = v => Array.isArray(v) ? v : [];
  const name = q => `Question ${q.n}`;

  // Tiers offered: every tier not answered NA in the tier question.
  const tq = by[SURVEY.tierSource], tv = a[tq.id] || {};
  const active = tierKeys.filter(k => tv[k] !== 'NA');
  if (!active.length) return { error: `${name(tq)}: at least one profile must be offered.` };
  const shown = q => {
    const r = SURVEY.logic[q.id];
    if (!r) return true;
    const v = a[r.q] || {};
    return active.some(k => list(v[k]).some(c => r.any.indexOf(c) >= 0));
  };

  const clean = {};
  for (const q of qs) {
    if (!shown(q)) continue;
    const v = a[q.id], tiers = q.id === tq.id ? tierKeys : active;
    const many = (arr, where) => {
      if (arr.some(c => !isCode(q, c))) return `${name(q)}${where}: an answer is not one of the choices.`;
      if (new Set(arr).size !== arr.length) return `${name(q)}${where}: an answer is repeated.`;
      if (q.max && arr.length > q.max) return `${name(q)}${where}: select up to ${q.max}.`;
      if (q.exclusive && arr.length > 1 && arr.some(c => q.exclusive.indexOf(c) >= 0)) return `${name(q)}${where}: "${q.label[arr.filter(c => q.exclusive.indexOf(c) >= 0)[0]]}" can't be combined with other answers.`;
      return '';
    };
    if (q.type === 'single') {
      if (v === '' || v == null) { if (q.required) return { error: `${name(q)} is required.` }; clean[q.id] = ''; }
      else if (!isCode(q, v)) return { error: `${name(q)}: the answer is not one of the choices.` };
      else clean[q.id] = v;
      if (q.other && clean[q.id] === q.other) {
        const o = String(a[q.id + '_other'] || '').trim();
        if (!o) return { error: `${name(q)}: please describe your organization.` };
        if (o.length > 200) return { error: `${name(q)}: the description is over 200 characters.` };
        clean[q.id + '_other'] = o;
      }
    } else if (q.type === 'multi') {
      const arr = list(v), bad = many(arr, '');
      if (bad) return { error: bad };
      if (q.required && !arr.length) return { error: `${name(q)} is required.` };
      clean[q.id] = arr;
      if (q.comment) {
        const t = String(a[q.id + '_comment'] || '').trim();
        if (t.length > q.comment.max) return { error: `${name(q)}: the comment is over ${q.comment.max} characters.` };
        clean[q.id + '_comment'] = t;
      }
    } else if (q.type === 'grid1') {
      const o = {};
      for (const k of tiers) {
        const x = v && v[k];
        if (x === '' || x == null) { if (q.required) return { error: `${name(q)}: choose an answer for ${tierName_(k)}.` }; o[k] = ''; }
        else if (!isCode(q, x)) return { error: `${name(q)} (${tierName_(k)}): the answer is not one of the choices.` };
        else o[k] = x;
      }
      clean[q.id] = o;
    } else if (q.type === 'gridN') {
      const o = {};
      for (const k of tiers) {
        const arr = list(v && v[k]), bad = many(arr, ` (${tierName_(k)})`);
        if (bad) return { error: bad };
        if (q.required && !arr.length) return { error: `${name(q)}: select at least one answer for ${tierName_(k)}.` };
        o[k] = arr;
      }
      clean[q.id] = o;
    } else if (q.type === 'rank') {
      const arr = list(v).slice(0, q.count).map(x => x || '');
      const filled = arr.filter(Boolean);
      if (filled.some(c => !isCode(q, c))) return { error: `${name(q)}: a ranked item is not one of the choices.` };
      if (new Set(filled).size !== filled.length) return { error: `${name(q)}: each item can be ranked only once.` };
      if (q.required && filled.length < q.count) return { error: `${name(q)}: rank ${q.count} items.` };
      while (arr.length < q.count) arr.push('');
      clean[q.id] = arr;
    }
  }

  // Sheet cells, in column order.
  const cells = answerColumns_().map(col => {
    const q = col[1], part = col[2], v = clean[q.id];
    if (!shown(q)) return SKIP;
    if (part === 'other') return text_(clean[q.id + '_other'] || '');
    if (part === 'comment') return text_(clean[q.id + '_comment'] || '');
    if (q.type === 'single') return v;
    if (q.type === 'multi') return v.length ? v.join('; ') : NONE;
    if (q.type === 'rank') return v[part];
    if (q.id !== tq.id && active.indexOf(part) < 0) return SKIP;          // tier not offered
    if (q.type === 'grid1') return v[part];
    return v[part].length ? v[part].join('; ') : NONE;                  // gridN
  });
  return { contact: contact, answers: clean, cells: cells };
}

// Turns a stored row back into what the page needs to reopen it for editing.
function rowToData_(v) {
  const s = x => fromCell_(x);
  const contact = {};
  CONTACT.forEach((c, i) => { contact[c[0]] = s(v[2 + i]); });
  const answers = {}, start = 2 + CONTACT.length;
  answerColumns_().forEach((col, i) => {
    const q = col[1], part = col[2], x = s(v[start + i]);
    if (x === SKIP) return;
    if (part === 'other' || part === 'comment') { if (x) answers[q.id + '_' + part] = x; return; }
    const codes = x === NONE || x === '' ? [] : x.split('; ');
    if (q.type === 'single') answers[q.id] = x;
    else if (q.type === 'multi') answers[q.id] = codes;
    else if (q.type === 'rank') (answers[q.id] = answers[q.id] || [])[part] = x;
    else if (q.type === 'grid1') (answers[q.id] = answers[q.id] || {})[part] = x;
    else (answers[q.id] = answers[q.id] || {})[part] = codes;
  });
  return { contact: contact, answers: answers };
}

// ---- Formula injection and exact text ---------------------------------------------------
// Typed text is written with a leading apostrophe, so "=HYPERLINK(…)" stays text instead of running as a
// formula, and "0123" or "1/2" stay exactly as typed. The apostrophe is hidden and not part of the value.
// Answer codes need no guard: the server only accepts codes from the survey's own lists.
const text_ = v => (v === '' || v == null) ? '' : "'" + v;
function fromCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  v = String(v == null ? '' : v);
  return v.charAt(0) === "'" ? v.slice(1) : v;
}

// ---- Rate limits: sliding windows in the script cache (entries expire on their own) -----
function rateLimited_(email) {
  const cache = CacheService.getScriptCache(), now = Date.now();
  const recent = (key, ms) => { let a = []; try { a = JSON.parse(cache.get(key) || '[]'); } catch (e) { a = []; } return a.filter(t => now - t < ms); };
  const all = recent('rl:all', 60000);
  if (all.length >= CONFIG.rate.allPerMinute) return { ok: false, error: "We're receiving a lot of responses right now." };
  const key = 'rl:email:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(email || '').trim().toLowerCase()));
  const mine = recent(key, 3600000);
  if (mine.length >= CONFIG.rate.perEmailPerHour) {
    const mins = Math.max(1, Math.ceil((Math.min.apply(null, mine) + 3600000 - now) / 60000));
    return { ok: false, limited: true, error: `This email address has reached the limit of ${CONFIG.rate.perEmailPerHour} submissions or edits in an hour. Please try again in about ${mins} minute${mins === 1 ? '' : 's'}. Your answers are still saved in this browser.` };
  }
  all.push(now); mine.push(now);
  cache.put('rl:all', JSON.stringify(all), 120);
  cache.put(key, JSON.stringify(mine), 3600);
  return null;
}

// ---- Private edit links: ?edit=<reference>&t=<HMAC signature> -----------------------------
function editSecret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('EDIT_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('EDIT_SECRET', s); }
  return s;
}
function editToken_(ref) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(SURVEY.id + '|' + ref, editSecret_())).replace(/=+$/, '').slice(0, 32);
}
function tokenOk_(ref, t) {
  const want = editToken_(String(ref)), got = String(t || '');
  if (want.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);   // constant time
  return diff === 0;
}
const editLink_ = ref => CONFIG.site + CONFIG.page + '?edit=' + encodeURIComponent(ref) + '&t=' + editToken_(ref);

// ---- Emails -------------------------------------------------------------------------------
const esc_ = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function summary_(c, a) {
  const q1 = questions_()[0], tq = SURVEY.tierSource, offered = SURVEY.tiers.filter(t => (a[tq] || {})[t[0]] !== 'NA').map(t => t[1]);
  const org = a.q1 ? q1.label[a.q1] + (a.q1_other ? `: ${a.q1_other}` : '') : '';
  return [['Organization type', org], ['Organization', c.company || 'Not given'], ['Profiles', offered.join(', ')]];
}

function sendReceipt_(c, a, ref, updated) {
  const link = editLink_(ref);
  const until = CONFIG.closesLabel ? ` until ${CONFIG.closesLabel}` : ' while the survey is open';
  const when = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'MMMM d, yyyy');
  const images = {};
  for (const cid in LOGOS) { try { images[cid] = UrlFetchApp.fetch(LOGOS[cid]).getBlob().setName(cid + '.png'); } catch (e) { /* send without that logo */ } }
  const logo = (cid, w, h, alt) => images[cid] ? `<img src="cid:${cid}" width="${w}" height="${h}" alt="${alt}" style="display:block;border:0;">` : `<span style="font:bold 14px Arial,sans-serif;color:#5F6062;">${alt}</span>`;
  const label = 'font:bold 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#343895;';
  const rows = [['Reference', ref]].concat(summary_(c, a), [[updated ? 'Updated' : 'Submitted', when]]);
  const row = (r, i) => `<tr><td style="padding:6px 16px${i === rows.length - 1 ? ' 14px' : ''};color:#5F6062;width:140px;">${esc_(r[0])}</td><td style="padding:6px 16px${i === rows.length - 1 ? ' 14px' : ''};color:#19194D;${i === 0 ? 'font-weight:bold;' : ''}">${esc_(r[1])}</td></tr>`;
  const lead = updated ? 'Your changes are saved. This is now the version the AICC project will analyze.'
    : 'Thank you for taking the NeoCloud Deployment Requirements Survey. Your answers help the OCP AI Computing Continuum project compare requirements across Small, Medium and Large deployments.';

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9EBEF;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-collapse:collapse;">
<tr><td style="padding:16px 32px;border-bottom:1px solid #DADCDF;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left" valign="middle">${logo('ocpLogo', 100, 40, 'Open Compute Project')}</td>
<td align="right" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:8px;">${logo('aiccLogo', 44, 44, '')}</td>
<td valign="middle" style="font:bold 12px/1.3 Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#19194D;">AI Computing<br>Continuum</td></tr></table></td></tr></table></td></tr>
<tr><td style="background:#19194D;padding:28px 32px 26px;border-bottom:6px solid #8DC63F;">
<div style="font:bold 11px/1.4 Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#8DC63F;">OCP AI Computing Continuum · ${esc_(SURVEY.title)}</div>
<div style="font:bold 26px/1.2 'Franklin Gothic Medium','Arial Narrow',Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#FFFFFF;margin-top:10px;">${updated ? 'Response updated' : 'Response received'}</div></td></tr>
<tr><td style="padding:28px 32px 8px;font:15px/1.6 Arial,sans-serif;color:#3F4042;">
<p style="margin:0 0 14px;">Hi ${esc_(c.firstName)},</p><p style="margin:0 0 22px;">${esc_(lead)}</p></td></tr>
<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DADCDF;border-top:3px solid #343895;font:14px/1.5 Arial,sans-serif;">
<tr><td style="padding:12px 16px 4px;${label}" colspan="2">Your response</td></tr>${rows.map(row).join('')}</table></td></tr>
<tr><td style="padding:24px 32px 28px;font:14px/1.6 Arial,sans-serif;color:#3F4042;">
<p style="margin:0 0 14px;">Need to change an answer? You can reopen your response${esc_(until)}.</p>
<a href="${esc_(link)}" style="display:inline-block;background:#8DC63F;color:#19194D;font:bold 13px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;padding:12px 20px;border-radius:4px;">Change my answers</a>
<p style="margin:14px 0 0;font-size:12px;color:#5F6062;">This link is private to your response. Please don't forward it.</p></td></tr>
<tr><td style="background:#F3F4F5;padding:18px 32px;font:12px/1.6 Arial,sans-serif;color:#5F6062;border-top:1px solid #DADCDF;">Open Compute Project Foundation · <a href="${esc_(CONFIG.projectUrl)}" style="color:#343895;">AI Computing Continuum project</a> · <a href="${esc_(CONFIG.mailingList)}" style="color:#343895;">Mailing list</a><br>You are receiving this because this address was entered on the survey.</td></tr>
</table></td></tr></table>`;

  const text = `Hi ${c.firstName},\n\n${lead}\n\nYOUR RESPONSE\n` + rows.map(r => `${r[0]}: ${r[1]}`).join('\n') +
    `\n\nNeed to change an answer? Reopen your response${until}:\n${link}\n(This link is private to your response. Please don't forward it.)\n\n` +
    `OCP AI Computing Continuum project: ${CONFIG.projectUrl}\nMailing list: ${CONFIG.mailingList}`;
  const mail = { to: c.email, subject: `${SURVEY.title} – response ${updated ? 'updated' : 'received'} (${ref})`, body: text, htmlBody: html, inlineImages: images, name: CONFIG.senderName };
  if (CONFIG.replyTo) mail.replyTo = CONFIG.replyTo;
  MailApp.sendEmail(mail);
}

function notifyStaff_(c, a, ref) {
  const url = book_().getUrl(), rows = [['Reference', ref], ['Name', `${c.firstName} ${c.lastName}`], ['Email', c.email]].concat(summary_(c, a));
  MailApp.sendEmail({
    to: CONFIG.notifyStaff.join(','), name: CONFIG.senderName, replyTo: c.email,
    subject: `New response: ${SURVEY.title} (${ref})`,
    body: rows.map(r => `${r[0]}: ${r[1]}`).join('\n') + `\n\nSheet: ${url}`,
    htmlBody: `<div style="font:14px/1.6 Arial,sans-serif;color:#3F4042;"><table>${rows.map(r => `<tr><td style="color:#5F6062;padding-right:12px;">${esc_(r[0])}</td><td>${esc_(r[1])}</td></tr>`).join('')}</table><p><a href="${esc_(url)}">Open the Sheet</a></p></div>`,
  });
}

// ---- Sheet helpers ------------------------------------------------------------------------
function book_() { return CONFIG.sheetId ? SpreadsheetApp.openById(CONFIG.sheetId) : SpreadsheetApp.getActiveSpreadsheet(); }
// '' when the form columns (A through "Last edited") match the survey; otherwise what differs.
function columnProblem_(sh) {
  const want = headers_().slice(0, formColumnCount_());
  if (sh.getMaxColumns() < want.length) return `The Sheet has ${sh.getMaxColumns()} columns; the survey needs ${want.length}. Run setup on a new tab.`;
  const have = sh.getRange(1, 1, 1, want.length).getValues()[0].map(String);
  const diffs = want.map((w, i) => w === have[i] ? '' : `column ${i + 1}: Sheet has "${have[i]}", survey expects "${w}"`).filter(String);
  return diffs.length ? 'Columns do not match the survey: ' + diffs.slice(0, 5).join('; ') + (diffs.length > 5 ? ` (and ${diffs.length - 5} more)` : '') +
    '. Fix the header (or survey.js) so they match, then run checkColumns.' : '';
}
function findRow_(sh, ref) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const refs = sh.getRange(2, 2, last - 1, 1).getValues();
  for (let i = 0; i < refs.length; i++) if (String(refs[i][0]) === String(ref)) return i + 2;
  return 0;
}
// The row after the last reference (dropdown cells can make getLastRow() point further down).
function nextRow_(sh) {
  const max = sh.getMaxRows();
  const refs = max > 1 ? sh.getRange(2, 2, max - 1, 1).getValues() : [];
  let last = 1;
  for (let i = refs.length - 1; i >= 0; i--) if (refs[i][0] !== '') { last = i + 2; break; }
  if (last + 1 > max) sh.insertRowsAfter(max, 100);
  return last + 1;
}
const isClosed_ = () => !!CONFIG.closes && new Date() > new Date(CONFIG.closes);
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
