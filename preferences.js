/* Preferences form — posts meal times and activity picks to the
   same Apps Script Web App as the RSVP form, which logs them to the
   Preferences tab of the sheet. */

(function () {
  const PREFS_URL = 'https://script.google.com/macros/s/AKfycbyW9Wc44-48Mx8Hcxsi3JZCWgqBRMc6prPUIr8Py8yxmT9sF47dt890JXvW7Hb98Cc/exec';

  const form = document.querySelector('.prefs-form');
  if (!form) return;
  const status = form.querySelector('.rsvp-status');
  const btn = form.querySelector('button[type="submit"]');

  // Activities offered on several days show their day choices only
  // once ticked; unticking hides and clears them.
  const boxes = form.querySelectorAll('input[name="activities"]');
  const dayPick = value => Array.from(form.querySelectorAll('.day-pick'))
    .find(el => el.dataset.dayFor === value);
  const syncActivities = () => {
    boxes.forEach(b => {
      const pick = dayPick(b.value);
      if (pick) {
        pick.hidden = !b.checked;
        if (!b.checked) pick.querySelectorAll('input').forEach(r => { r.checked = false; });
      }
    });
  };
  boxes.forEach(b => b.addEventListener('change', syncActivities));

  // The Cocolia answer opens meal times ("Yes") or restaurant picks
  // ("No"); whichever is hidden has its inputs cleared.
  const syncMeals = () => {
    const r = form.querySelector('input[name="cocolia"]:checked');
    form.querySelectorAll('[data-if-cocolia]').forEach(el => {
      el.hidden = !r || r.value !== el.dataset.ifCocolia;
      if (el.hidden) el.querySelectorAll('input').forEach(i => { i.checked = false; });
    });
  };
  form.querySelectorAll('input[name="cocolia"]').forEach(r => r.addEventListener('change', syncMeals));

  const validate = () => {
    const names = form.querySelector('[name="names"]').value.trim();
    if (!names) return 'Please enter your name.';
    return null;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { if (status) status.textContent = err; return; }
    if (status) status.textContent = 'Sending…';
    btn.disabled = true;

    const data = new FormData(form);
    const payload = Object.fromEntries(data);
    // Checkboxes share a name, so collect them all rather than the last one.
    payload.activities = data.getAll('activities');
    // Day choices travel as { activity: day } instead of loose "day:…" keys.
    payload.days = {};
    for (const key of Object.keys(payload)) {
      if (key.startsWith('day:')) {
        payload.days[key.slice(4)] = payload[key];
        delete payload[key];
      }
    }
    payload.form = 'preferences';

    try {
      // Use text/plain to avoid a CORS preflight to Apps Script.
      const r = await fetch(PREFS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const res = await r.json();
      if (res && res.ok) {
        if (status) status.textContent = 'Thank you — got it! You can send this again any time if your plans change.';
        form.reset();
        syncActivities();
        syncMeals();
      } else {
        if (status) status.textContent = 'Sorry — ' + ((res && res.error) || 'something went wrong. Please email us directly.');
      }
    } catch (_) {
      if (status) status.textContent = 'Network error — please try again in a moment.';
    }
    btn.disabled = false;
  });
})();
