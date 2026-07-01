/* RSVP wiring — fetches live room availability from a Google Apps
   Script Web App backed by a Google Sheet, updates the "X bungalows
   remaining" strings in the Stay section, and submits the form to
   the same endpoint. Paste the deployment URL into RSVP_URL below. */

(function () {
  const RSVP_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!configured) {
        if (status) status.textContent = 'RSVP endpoint not yet configured.';
        return;
      }
      if (status) status.textContent = 'Sending…';
      btn.disabled = true;

      const payload = Object.fromEntries(new FormData(form));
      try {
        // Use text/plain to avoid a CORS preflight to Apps Script.
        const r = await fetch(RSVP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (data && data.ok) {
          if (status) status.textContent = 'Thank you — your RSVP is in. We\'ll be in touch by email.';
          form.reset();
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
