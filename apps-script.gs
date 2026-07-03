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
    const room = String(body.room || '').trim();
    const names = String(body.names || '').trim();
    const email = String(body.email || '').trim();
    const roommate = String(body.roommate || '').trim();
    const notes = String(body.notes || '').trim();

    if (!names || !email) {
      return respond({ ok: false, error: 'name and email required' });
    }
    // Room-mate name is required when a real room is chosen.
    const isRoomChoice = room && !/offsite/i.test(room);
    if (isRoomChoice && !roommate) {
      return respond({ ok: false, error: 'please name who you\'re sharing the room with' });
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

    ss.getSheetByName(RSVP_SHEET).appendRow([
      new Date(),
      names,
      email,
      room || '(none chosen)',
      roommate,
      notes,
      JSON.stringify(body)
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
