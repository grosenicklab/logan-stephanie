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
