const INV_SHEET = 'Inventory';
const RSVP_SHEET = 'RSVPs';

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === 'counts') {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INV_SHEET);
    const rows = sheet.getDataRange().getValues();
    const counts = {};
    for (let i = 1; i < rows.length; i++) {
      const type = rows[i][0];
      const total = Number(rows[i][1]) || 0;
      const booked = Number(rows[i][2]) || 0;
      if (type) counts[String(type).trim()] = Math.max(0, total - booked);
    }
    return respond({ ok: true, counts: counts });
  }
  return respond({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const attending = String(body.attending || '').trim().toLowerCase();
    const room = String(body.room || '').trim();
    const names = String(body.names || '').trim();
    const email = String(body.email || '').trim();
    const partner = String(body.partner || '').trim();
    const roommate = String(body.roommate || '').trim();
    const notes = String(body.notes || '').trim();

    if (!names || !email) {
      return respond({ ok: false, error: 'name and email required' });
    }
    if (attending !== 'yes' && attending !== 'no') {
      return respond({ ok: false, error: 'please indicate whether you can attend' });
    }

    // Only "attending: yes" submissions touch room inventory.
    // A "no" is logged and returns immediately.
    // A partner name means we don't need a separate roommate.
    const isRoomChoice = attending === 'yes' && room && !/offsite/i.test(room);
    if (isRoomChoice && !partner && !roommate) {
      return respond({ ok: false, error: 'please name who you\'re sharing the room with' });
    }
    if (attending === 'yes' && !room) {
      return respond({ ok: false, error: 'please pick a room preference' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const inv = ss.getSheetByName(INV_SHEET);

    let rowIndex = -1;
    let total = 0;
    let booked = 0;
    if (isRoomChoice) {
      const rows = inv.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === room) {
          rowIndex = i + 1;
          total = Number(rows[i][1]) || 0;
          booked = Number(rows[i][2]) || 0;
          break;
        }
      }
      if (rowIndex === -1) {
        return respond({ ok: false, error: 'unknown room' });
      }
      if (booked >= total) {
        return respond({ ok: false, error: 'that room type is fully booked' });
      }
    }

    // Trailing columns (attending, partner) appended so existing sheet
    // layout isn't disrupted — reorganise the header row in the sheet
    // to taste; row order here is:
    //   date, names, email, room, roommate, notes, raw, attending, partner
    ss.getSheetByName(RSVP_SHEET).appendRow([
      new Date(),
      names,
      email,
      attending === 'yes' ? (room || '(none chosen)') : '(not attending)',
      roommate,
      notes,
      JSON.stringify(body),
      attending,
      partner
    ]);

    if (isRoomChoice) {
      inv.getRange(rowIndex, 3).setValue(booked + 1);
    }

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─────────────────────────────────────────────────────────────
   Roster tab

   One row per party: plus-one, booking, location and where they
   stand. Everyone who said yes or maybe, plus everyone still to
   answer; the nine declines are deliberately left out.

   The form can't supply all of this — booking status and offsite
   locations live in the Notion guest list, and several parties
   (Stephanie's parents, Mom, Conor + Ben, Rafa, Felipe, Chris
   Hill) never came through the form at all — so the roster is
   reconciled by hand below rather than derived from the RSVPs
   tab.

   Run buildRoster() once to create the tab; run it again after
   editing ROSTER_ROWS to rebuild it. A rebuild overwrites the
   tab, tick boxes included, so make edits here, not in the sheet.
   ───────────────────────────────────────────────────────────── */

const ROSTER_SHEET = 'Roster';

// Party | Guest of | Status | Plus one | Heads | Booked | Where | Notes | Email
const ROSTER_ROWS = [
  // ── Coming ───────────────────────────────────────────────────
  ['Michelle Lee', 'Stephanie', 'Yes', 'Hyunsoo Choi', 2, false, 'Cocolia — Nature View', '', 'mishi93999@gmail.com'],
  ['Stephanie Parents', 'Stephanie', 'Yes', 'Couple', 2, false, 'Cocolia — Premium Horizon', 'Logged in RSVPs as "Jae-jeong"', ''],
  ['Arielle Knight', 'Stephanie', 'Yes', 'TBD', 1, false, 'Cocolia — Premium Nature', 'Roommate still TBD', 'acknight01@gmail.com'],
  ['Sara Haile', 'Stephanie', 'Yes', 'Simeon Marsalis', 2, false, 'Cocolia — Nature View', 'Vegan x1', 'sarathaile@gmail.com'],
  ['Rahel Haile', 'Stephanie', 'Yes', 'Nathan Santana', 2, false, 'Cocolia — Premium Nature', '', 'rahelthaile@gmail.com'],
  ['Camila Rodriguez', 'Stephanie', 'Yes', 'Lucas Turner-Owens', 2, false, 'Cocolia — Nature View', '', 'camilarodriguez2011@gmail.com'],
  ['Juanita Gyamera', 'Stephanie', 'Yes', 'None', 1, false, 'Cocolia — Nature View', 'No corn', 'jgyamera@gmail.com'],
  ['Franklin Collao', 'Stephanie', 'Yes', 'None', 1, false, 'Offsite', '', 'franklincollao@gmail.com'],
  ['Cora Lautze', 'Stephanie', 'Yes', 'Cooper Rogers', 2, false, 'Cocolia — Premium Nature', '', 'coralautze@gmail.com'],
  ['Julian Wellisz', 'Stephanie', 'Yes', 'Anna', 2, false, 'Cocolia — Premium Ocean', '', 'julian.wellisz@gmail.com'],
  ['Allegra Bianchini', 'Stephanie', 'Yes', 'Colt', 2, false, 'Offsite', '', 'bianchini.allegra@gmail.com'],
  ['Micah Piven', 'Stephanie', 'Yes', 'None', 1, false, 'Cocolia — Nature View', '', 'micahpiven@gmail.com'],
  ['Charlie Chung', 'Stephanie', 'Yes', 'Rubens', 2, false, 'Cocolia — Horizon', '', 'charlesqueensny@gmail.com'],
  ['Joyce Chung', 'Stephanie', 'Yes', 'None', 1, false, 'Cocolia — Premium Ocean', '', 'joycechung12@gmail.com'],
  ['Matt Ragazzo', 'Stephanie', 'Yes', 'TBD', 1, false, 'Cocolia — Nature View', 'Waiting on us — does he get a plus one?', 'mragazz@gmail.com'],
  ['Odetty Tineo', 'Stephanie', 'Yes', 'Shares with Eve', 1, false, 'Cocolia — Nature View', 'One bungalow with Eve Taylor', 'odetty.tineo@gmail.com'],
  ['Eve Taylor', 'Stephanie', 'Yes', 'Shares with Odetty', 1, false, 'Cocolia — Nature View', 'One bungalow with Odetty Tineo', 'evefrancestaylor@gmail.com'],
  ['Chris Hill', 'Stephanie', 'Yes', 'None', 1, false, 'Offsite', 'RSVP came in outside the website form', 'Christopher.bw.hill@gmail.com'],
  ['Steph Choi', 'Logan', 'Yes', 'TBD', 1, false, 'Cocolia — Premium Nature', 'Roommate "not sure"; dairy- and lobster-free', 'stephanie.choi@gmail.com'],
  ['Mom (Deb Grosenick)', 'Logan', 'Yes', 'None', 1, false, 'Cocolia — Premium Horizon', '', ''],
  ['Karl + Maurene', 'Logan', 'Yes', 'Couple', 2, true, 'Cocolia — Premium Ocean', 'No beef or veal', 'kmsorensen@proton.me'],
  ['David + Lexi', 'Logan', 'Yes', 'Couple', 2, false, 'Cocolia — Horizon', 'Logged as Alexandra Suppes; David allergic to crustaceans', 'suppes@gmail.com; david.brynjar@gmail.com'],
  ['Khalil + Robert', 'Logan', 'Yes', 'Couple', 2, false, 'Cocolia — Nature View', 'No beef or pork', 'khalil.bey@gmail.com'],
  ['Conor + Ben', 'Logan', 'Yes', 'Ben', 2, false, 'Cocolia — Nature View', 'Added by hand; Ben never came through the form', 'col2004@med.cornell.edu'],
  ['Day Wachell', 'Logan', 'Yes', 'TBD', 1, false, 'Cocolia — Premium Ocean', '"TBD! But yes!"', 'today@agentiv.ai'],
  ['JS + Nephisa', 'Logan', 'Yes', 'Nephisa', 2, false, 'Offsite', 'Form logged a decline — both confirmed coming', 'jaqi.sparro@gmail.com'],
  ['Ryan + Jinah', 'Logan', 'Yes', 'Jinah Kim', 2, false, 'Offsite', '', 'ryeguy@gmail.com'],
  ['Jeffrey Fare + 1', 'Logan', 'Yes', 'Natalie Stone (unlikely)', 1, false, 'Cocolia — Nature View', 'Logged as Jeffrey Paradise', 'jeffreyparadise@gmail.com'],
  ['Bianca Marlin Jones + 1', 'Logan', 'Yes', 'Joseph Jones Marlin', 2, false, 'Offsite', 'Dairy free', 'bjm2174@columbia.edu'],
  ['Rafa', 'Logan', 'Yes', 'None', 1, false, 'TBD', 'RSVP by WhatsApp', ''],
  ['Andrew Leonidas', 'Logan', 'Yes', 'Susan Leonidas', 2, false, 'Cocolia — Nature View', '', 'andrew78@gmail.com'],
  ['Felipe + 1', 'Logan', 'Yes', '+1', 2, false, 'TBD', 'RSVP by text', ''],
  ['Jesse Edgerton', 'Logan', 'Yes', 'None', 1, false, 'Offsite — wants a bungalow', 'Coming solo; Notion still lists "Jesse + Nora"', 'jesse.edgerton@gmail.com'],
  ['Nate Folkert + 1', 'Logan', 'Yes', 'TBD', 1, false, 'Cocolia — Nature View', 'Michelle not coming; asked how to book', 'nfolkert@gmail.com'],
  ['Mia Overall + 1', 'Logan', 'Yes', 'Brian Richter', 2, false, 'TBD', 'Named Brian as roommate; he never RSVPd separately', 'mia.overall@gmail.com'],
  ['Linda + Ron', 'Logan', 'Yes', 'Ron Wright', 2, false, 'Cocolia — Nature View', '', ''],
  ['Jerry + 1', 'Logan', 'Yes', 'Susan Drexler', 2, true, 'Cocolia — Nature View', '', 'iwantjerry@gmail.com'],
  ['Carol + Lisle', 'Logan', 'Yes', 'Lisle', 2, false, 'Cocolia — Nature View', 'Asked whether other room types will open up', ''],
  ['Kathy Duret', 'Logan', 'Yes', 'None', 1, false, 'Cocolia — Nature View', '', ''],

  // ── Maybe ────────────────────────────────────────────────────
  ['Vito Roccaforte + 1', 'Logan', 'Maybe', '+1', 2, false, 'Offsite (maybe)', 'Form logged a decline; since said maybe', 'vitoroccoforte@gmail.com'],

  // ── Invited, no reply yet ────────────────────────────────────
  ['Heryte Taquame', 'Stephanie', 'Awaiting reply', '?', 1, false, '—', '', 'herytetefery.tequame@gmail.com'],
  ['Nora + David', 'Stephanie', 'Awaiting reply', 'David', 2, false, '—', '', 'nora.karachatzi@posteo.de'],
  ['Ida', 'Stephanie', 'Awaiting reply', '?', 1, false, '—', 'No contact details on file', ''],
  ['서영', 'Stephanie', 'Awaiting reply', '?', 1, false, '—', 'No contact details on file', ''],
  ['정호', 'Stephanie', 'Awaiting reply', '?', 1, false, '—', 'No contact details on file', ''],
  ['Ko Hwe Jin', 'Stephanie', 'Awaiting reply', '?', 1, false, '—', 'No contact details on file', ''],
  ['Son JiYeon', 'Stephanie', 'Awaiting reply', '?', 1, false, '—', 'No contact details on file', ''],

  // ── On the list, invitation never sent ───────────────────────
  ['Alex Moffat + 1', 'Logan', 'Not yet invited', '+1', 2, false, '—', 'No invitation sent, no email on file', ''],
  ['Tina Kim + 1', 'Logan', 'Not yet invited', '+1', 2, false, '—', 'No invitation sent, no email on file', ''],
  ['Luke Biewald + Nora', 'Logan', 'Not yet invited', 'Nora', 2, false, '—', 'No invitation sent, no email on file', ''],
  ['Jayshree', 'Logan', 'Not yet invited', '?', 1, false, '—', 'Reach via Instagram', ''],
  ['Quinn', 'Mutual', 'Not yet invited', '?', 1, false, 'Triangulo (penciled in)', 'Reach via WhatsApp', ''],

  // ── Tagged "maybe" in Notion — invite not decided ────────────
  ['Thena Tak', 'Stephanie', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Tommy Yang', 'Stephanie', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Tuliza Sindi', 'Stephanie', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Vernelle Noel', 'Stephanie', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Jina', 'Stephanie', 'Possible invite', '?', 1, false, '—', 'Not the same person as Jinah Kim', ''],
  ['Isaac', 'Stephanie', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Don Christian', 'Stephanie', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Haben Michael', 'Logan', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Randall', 'Logan', 'Possible invite', '?', 1, false, '—', '', ''],
  ['Nick and Katie', 'Logan', 'Possible invite', 'Katie', 2, false, '—', '', ''],
  ['Zach Frenz', 'Logan', 'Possible invite', '?', 1, false, '—', '', ''],
  ['julian + jenne', 'Logan', 'Possible invite', 'jenne', 2, false, '—', 'Not the same Julian as Julian Wellisz', ''],
  ['Peter Thied + David', 'Logan', 'Possible invite', 'David', 2, false, '—', '', '']
];

function buildRoster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ROSTER_SHEET) || ss.insertSheet(ROSTER_SHEET);
  sheet.clear();

  const header = ['Party', 'Guest of', 'Status', 'Plus one', 'Heads', 'Booked', 'Where', 'Notes', 'Email'];
  const n = ROSTER_ROWS.length;
  const last = n + 1;

  sheet.getRange(1, 1, 1, header.length)
    .setValues([header])
    .setFontWeight('bold')
    .setBackground('#efefef');
  sheet.getRange(2, 1, n, header.length).setValues(ROSTER_ROWS);

  // Booked renders as a tick box so it can be kept current in place.
  sheet.getRange(2, 6, n, 1).insertCheckboxes();

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);

  // Heads are what each party would bring if they come, so the
  // pending rows are a ceiling rather than a count.
  const st = '$C$2:$C$' + last;
  const hd = '$E$2:$E$' + last;
  const sumif = status => '=SUMIF(' + st + ',"' + status + '",' + hd + ')';

  const sum = last + 2;
  const summary = [
    ['Parties listed', n],
    ['People — yes', sumif('Yes')],
    ['People — maybe', sumif('Maybe')],
    ['People — awaiting reply', sumif('Awaiting reply')],
    ['People — not yet invited', sumif('Not yet invited')],
    ['People — possible invite', sumif('Possible invite')],
    ['Ceiling if everyone comes', '=SUM(' + hd + ')'],
    ['Bookings confirmed', '=COUNTIF($F$2:$F$' + last + ',TRUE)'],
    ['Bungalows needed (yes only)', '=COUNTIF($G$2:$G$' + last + ',"Cocolia*")-1']
  ];
  sheet.getRange(sum, 1, summary.length, 2).setValues(summary);
  sheet.getRange(sum, 1, summary.length, 1).setFontWeight('bold');
  sheet.getRange(sum + 8, 3).setValue('less 1 — Eve and Odetty share a bungalow');
  sheet.getRange(sum + 7, 3).setValue('of 28 bungalows');
}

/* Adds the Email column to an existing Roster tab without
   rebuilding it, so edits made directly in the sheet survive.
   Rows are matched on Party (column A); an Email column is
   reused if present, otherwise added after the last header. */
function addRosterEmails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(h => String(h).trim());

  let col = header.indexOf('Email');
  if (col === -1) {
    col = header.length;
    while (col > 0 && !header[col - 1]) col--;
  }

  const emails = new Map(ROSTER_ROWS.map(r => [r[0], r[8]]));
  const found = new Set();
  const column = values.slice(1).map(row => {
    const party = String(row[0]).trim();
    if (emails.has(party)) {
      found.add(party);
      return [emails.get(party)];
    }
    return [col < row.length ? row[col] : ''];
  });

  sheet.getRange(1, col + 1)
    .setValue('Email')
    .setFontWeight('bold')
    .setBackground('#efefef');
  sheet.getRange(2, col + 1, column.length, 1).setValues(column);
  sheet.autoResizeColumn(col + 1);

  const missing = ROSTER_ROWS.map(r => r[0]).filter(p => emails.get(p) && !found.has(p));
  Logger.log(missing.length ? 'No row found for: ' + missing.join(', ') : 'All emails placed');
}
