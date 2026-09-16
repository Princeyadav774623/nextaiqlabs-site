/**
 * nextaiQlabs - campus visit request handler
 *
 * Receives a POST from the website form, appends a row to this spreadsheet,
 * and emails you a copy so you do not have to keep the sheet open.
 *
 * SETUP (once, about three minutes):
 *  1. Make a new Google Sheet. Name it "nextaiQlabs requests".
 *  2. Extensions > Apps Script. Delete whatever is in the editor.
 *  3. Paste this whole file in. Save.
 *  4. Deploy > New deployment > gear icon > Web app
 *       Execute as:        Me
 *       Who has access:    Anyone
 *     Deploy. Authorise when Google asks (it will warn because the script
 *     is yours and unverified - that is expected, click through Advanced).
 *  5. Copy the Web app URL it gives you. It ends in /exec
 *  6. In index.html find SHEET_ENDPOINT and paste the URL between the quotes.
 *  7. FORM_TOKEN below must match FORM_TOKEN in index.html. Change both
 *     to the same random string if you ever start getting junk.
 */

var SHEET_NAME = 'Requests';
var NOTIFY_EMAIL = 'prince324yadav@gmail.com';

// Shared token. Must match FORM_TOKEN in index.html.
// Change both to any random string you like.
var FORM_TOKEN = 'nq-8f3d2a';

// Abuse limits
var MAX_PER_10_MIN = 25;   // total submissions accepted in any 10 minute window
var MAX_FIELD = 400;       // characters kept per short field
var MAX_NOTE  = 2000;      // characters kept from the notes box
var MOBILE_RE = /^[6-9][0-9]{9}$/;   // Indian mobile, 10 digits
var DEDUPE_MINUTES = 10;   // same school + phone inside this window is a double-tap

function digits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

function normalisePhone(v) {
  var d = digits(v);
  if (d.length > 10 && d.indexOf('91') === 0) d = d.slice(2);
  if (d.length > 10 && d.charAt(0) === '0')   d = d.slice(1);
  return d.slice(0, 10);
}

function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }

// Accept urlencoded, JSON or query-string bodies - whatever the browser sends.
function readParams(e) {
  var p = {}, k;
  if (e && e.parameter) { for (k in e.parameter) p[k] = e.parameter[k]; }
  if (!p.t && e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      var j = JSON.parse(raw);
      for (k in j) p[k] = j[k];
    } catch (err) {
      raw.split('&').forEach(function(pair) {
        var i = pair.indexOf('=');
        if (i > 0) {
          p[decodeURIComponent(pair.slice(0, i))] =
            decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
        }
      });
    }
  }
  return p;
}

function doPost(e) {
  try {
    var p = readParams(e);

    // 1. honeypot - a bot filled the hidden field, so drop it silently
    if (p.hp) {
      return ContentService.createTextOutput('ignored');
    }

    // 2. shared token - stops anyone who scrapes the bare /exec URL
    if (p.t !== FORM_TOKEN) {
      return ContentService.createTextOutput('ignored');
    }

    // 3. rate limit - caps a flood before it fills your sheet or your inbox
    var cache = CacheService.getScriptCache();
    var hits = Number(cache.get('rate') || 0);
    if (hits >= MAX_PER_10_MIN) {
      return ContentService.createTextOutput('busy');
    }
    cache.put('rate', String(hits + 1), 600);

    // 4. server-side validation - the browser checks are bypassable
    var school = clip(p.school, MAX_FIELD).trim();
    var phone  = normalisePhone(p.phone);
    if (!school || !MOBILE_RE.test(phone)) {
      return ContentService.createTextOutput('ignored');
    }

    // 5. de-duplicate an accidental double submit
    var dkey = 'dup_' + phone + '_' + school.toLowerCase().replace(/\s+/g, '');
    if (cache.get(dkey)) {
      return ContentService.createTextOutput('duplicate');
    }
    cache.put(dkey, '1', DEDUPE_MINUTES * 60);

    // readable slot line, rebuilt here if the browser did not send one
    var when = clip(p.when, MAX_FIELD).trim();
    if (!when) {
      when = (clip(p.vdate, 40) + ' ' + clip(p.slot, 40)).trim();
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    if (sh.getLastRow() === 0) {
      sh.appendRow(['Received', 'School', 'Name', 'Phone', 'Best time to visit', 'Notes', 'Status']);
      sh.getRange(1, 1, 1, 7).setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 150);
      sh.setColumnWidth(2, 220);
      sh.setColumnWidth(6, 380);
    }

    sh.appendRow([
      new Date(),
      school,
      clip(p.name, MAX_FIELD),
      "'+91 " + phone,
      when,
      clip(p.note,   MAX_NOTE),
      'New'
    ]);

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Campus visit request - ' + school,
      body: [
        'School:   ' + school,
        'Name:     ' + clip(p.name, MAX_FIELD),
        'Phone:    +91 ' + phone,
        'Visit:    ' + when,
        '',
        'Notes:',
        clip(p.note, MAX_NOTE) || '(none)',
        '',
        '---',
        'Logged in your nextaiQlabs requests sheet.'
      ].join('\n')
    });

    return ContentService.createTextOutput('ok');

  } catch (err) {
    // still try to reach you if the sheet write failed
    try {
      MailApp.sendEmail(NOTIFY_EMAIL,
        'nextaiQlabs form error',
        'A request came in but could not be saved.\n\n' + String(err) +
        '\n\nRaw data:\n' + JSON.stringify((e && e.parameter) || {}, null, 2));
    } catch (ignored) {}
    return ContentService.createTextOutput('error');
  }
}

function doGet() {
  return ContentService.createTextOutput('nextaiQlabs form endpoint is live.');
}
