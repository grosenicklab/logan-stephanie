/* RSVP wiring — fetches live room availability from a Google Apps
   Script Web App backed by a Google Sheet, updates the "X bungalows
   remaining" strings in the Stay section, and submits the form to
   the same endpoint. Paste the deployment URL into RSVP_URL below. */

(function () {
  const RSVP_URL = 'https://script.google.com/macros/s/AKfycbyW9Wc44-48Mx8Hcxsi3JZCWgqBRMc6prPUIr8Py8yxmT9sF47dt890JXvW7Hb98Cc/exec';

  const configured = /^https?:\/\//.test(RSVP_URL);

  // ── Live room counts ────────────────────────────────────────
  async function loadCounts() {
    if (!configured) return;
    try {
      const r = await fetch(RSVP_URL + '?action=counts');
      const data = await r.json();
      if (data && data.ok) updateCounts(data.counts || {});
    } catch (_) { /* silent — DOM keeps the hard-coded numbers */ }
  }

  function updateCounts(counts) {
    // Update the "N bungalows remaining" line in each room row.
    document.querySelectorAll('.info-grid.rooms > div').forEach(el => {
      const dt = el.querySelector('dt');
      const sub = el.querySelector('.dd-sub');
      if (!dt || !sub) return;
      const name = dt.textContent.trim();
      const n = counts[name];
      if (typeof n === 'number') {
        sub.textContent = n === 1
          ? '1 bungalow remaining'
          : `${n} bungalows remaining`;
      }
    });

    // Disable sold-out options in the RSVP form dropdown.
    const select = document.querySelector('.rsvp-form select[name="room"]');
    if (!select) return;
    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;
      const n = counts[opt.value];
      if (typeof n !== 'number') return;
      opt.disabled = n <= 0;
      opt.textContent = n > 0
        ? `${opt.value} (${n} left)`
        : `${opt.value} — full`;
    });
  }

  // ── Form submission ─────────────────────────────────────────
  const form = document.querySelector('.rsvp-form');
  if (form) {
    const status = form.querySelector('.rsvp-status');
    const btn = form.querySelector('button[type="submit"]');

    if (!configured) {
      if (status) status.textContent = 'RSVP system is being set up — paste the endpoint into rsvp.js to activate.';
    }

    // ── Progressive disclosure ────────────────────────────────
    // "attending" radio drives visibility of the yes-only fields.
    // The roommate field only appears when a real room is chosen
    // AND no partner name has been filled in (partner IS the roommate).
    const partnerInput = form.querySelector('input[name="partner"]');
    const roomSelect   = form.querySelector('select[name="room"]');
    const attendingRadios = form.querySelectorAll('input[name="attending"]');

    const getAttending = () => {
      const r = form.querySelector('input[name="attending"]:checked');
      return r ? r.value : '';
    };
    const needsRoommate = () => {
      if (getAttending() !== 'yes') return false;
      const room = (roomSelect && roomSelect.value) || '';
      if (!room || /offsite/i.test(room)) return false;
      return !(partnerInput && partnerInput.value.trim());
    };
    const syncVisibility = () => {
      const attending = getAttending();
      form.querySelectorAll('[data-if-attending]').forEach(el => {
        el.hidden = el.dataset.ifAttending !== attending;
      });
      form.querySelectorAll('[data-if-roommate]').forEach(el => {
        el.hidden = !needsRoommate();
      });
    };

    attendingRadios.forEach(r => r.addEventListener('change', syncVisibility));
    if (partnerInput) partnerInput.addEventListener('input', syncVisibility);
    if (roomSelect)   roomSelect.addEventListener('change', syncVisibility);
    syncVisibility();

    // Client-side validation matched to the disclosure state — the form
    // has `novalidate` so browser required-attrs don't apply here.
    const validate = () => {
      const names = form.querySelector('[name="names"]').value.trim();
      const email = form.querySelector('[name="email"]').value.trim();
      if (!names) return 'Please enter your name.';
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email.';
      const attending = getAttending();
      if (!attending) return 'Please let us know if you can attend.';
      if (attending === 'yes') {
        if (!roomSelect.value) return 'Please pick a room preference (or "Offsite / decide later").';
        if (needsRoommate() && !form.querySelector('[name="roommate"]').value.trim()) {
          return 'Please name who you\'re sharing the room with.';
        }
      }
      return null;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!configured) {
        if (status) status.textContent = 'RSVP endpoint not yet configured.';
        return;
      }
      const err = validate();
      if (err) { if (status) status.textContent = err; return; }
      if (status) status.textContent = 'Sending…';
      btn.disabled = true;

      const payload = Object.fromEntries(new FormData(form));
      // Blank out yes-only fields when saying no, so the sheet doesn't
      // carry stale values a user may have typed before switching.
      if (payload.attending === 'no') {
        payload.partner = '';
        payload.room = '';
        payload.roommate = '';
      }
      try {
        // Use text/plain to avoid a CORS preflight to Apps Script.
        const r = await fetch(RSVP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (data && data.ok) {
          if (status) {
            status.textContent = payload.attending === 'no'
              ? 'Thank you for letting us know — we\'ll miss you.'
              : 'Thank you — your RSVP is in. We\'ll be in touch by email.';
          }
          form.reset();
          syncVisibility();
          loadCounts();
        } else {
          if (status) status.textContent = 'Sorry — ' + ((data && data.error) || 'something went wrong. Please email us directly.');
          btn.disabled = false;
        }
      } catch (err) {
        if (status) status.textContent = 'Network error — please try again in a moment.';
        btn.disabled = false;
      }
    });
  }

  loadCounts();
})();
