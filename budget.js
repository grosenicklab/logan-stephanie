// Budget page: compares Cocolia's buyout quote with its public rates, and
// lines up competing vendor quotes. Nothing private is in this file — what
// you type is kept in this browser's localStorage only.

const STORE_KEY = 'ls-wedding-budget-v2';

// Rooms in the buyout (Inventory tab) and Cocolia's posted nightly rates in
// MXN before tax, read off their booking page on 25 Nov 2026.
const ROOMS = [
  { type: 'Nature View',     count: 15, pub: 6209, sale: 3725.40 },
  { type: 'Premium Nature',  count: 4,  pub: 6638, sale: 3982.80 },
  { type: 'Premium Ocean',   count: 4,  pub: 8136, sale: 4881.60 },
  { type: 'Horizon',         count: 3,  pub: 8351, sale: 5010.60 },
  { type: 'Premium Horizon', count: 2,  pub: 8993, sale: 5395.80 }
];
const TAX = 0.16 + 0.03;

const DEFAULTS = {
  nights: 3,
  fx: 18,
  tax: true,
  quote: {},
  items: [
    { name: 'Cocolia: gala dinner, 80 guests', cur: 'USD', a: '', b: '', c: '', pick: 'a', paid: '' },
    { name: 'Cocolia: cocktail party, 80 guests', cur: 'USD', a: '', b: '', c: '', pick: 'a', paid: '' },
    { name: 'F&B tips (mandatory per contract)', cur: 'USD', a: '', b: '', c: '', pick: 'a', paid: '' },
    { name: 'DJ and sound', cur: 'MXN', a: '', b: '', c: '', pick: 'a', paid: '' },
    { name: 'Flowers', cur: 'MXN', a: '', b: '', c: '', pick: 'a', paid: '' },
    { name: 'Decorations', cur: 'MXN', a: '', b: '', c: '', pick: 'a', paid: '' }
  ]
};

let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && Array.isArray(saved.items)) return Object.assign(structuredClone(DEFAULTS), saved);
  } catch (e) { /* private window or bad data: start fresh */ }
  return structuredClone(DEFAULTS);
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not saved */ }
}

const num = v => {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const fmt = (n, cur) => n == null ? '–' :
  (cur === 'USD' ? '$' : '') + Math.round(n).toLocaleString('en-US') + (cur === 'USD' ? '' : ' MXN');
const toMXN = (n, cur) => n == null ? null : cur === 'USD' ? n * state.fx : n;
const usd = mxn => mxn == null ? '' : '≈ $' + Math.round(mxn / state.fx).toLocaleString('en-US');
const withTax = n => n == null ? null : state.tax ? n * (1 + TAX) : n;

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  });
  kids.forEach(k => e.append(k));
  return e;
}

// ── Rooms ───────────────────────────────────────────────

// The buyout is priced in USD per person for the whole stay, full board, two
// people per bungalow; the website sells rooms by the night in MXN, room only.
// Both are turned into MXN per room per night to line them up.
const perRoomNight = usdPerPerson => usdPerPerson * 2 * state.fx / state.nights;

function renderRooms() {
  const body = document.querySelector('#rooms tbody');
  body.textContent = '';
  ROOMS.forEach(r => {
    const input = el('input', { type: 'text', inputmode: 'decimal', placeholder: '—', 'aria-label': r.type + ' contract price per person' });
    input.value = state.quote[r.type] ?? '';
    input.addEventListener('input', () => { state.quote[r.type] = input.value; save(); roomTotals(); });
    body.append(el('tr', { 'data-type': r.type },
      el('td', {}, r.type),
      el('td', { class: 'num' }, String(r.count)),
      el('td', { class: 'num' }, fmt(withTax(r.pub))),
      el('td', { class: 'num' }, fmt(withTax(r.sale))),
      el('td', { class: 'num' }, input),
      el('td', { class: 'num night' }),
      el('td', { class: 'num diff' })));
  });
  roomTotals();
}

function roomTotals() {
  let pub = 0, sale = 0, quote = 0, quoted = 0, people = 0;
  ROOMS.forEach(r => {
    const q = num(state.quote[r.type]);
    const tr = document.querySelector(`#rooms tr[data-type="${r.type}"]`);
    const night = tr.querySelector('.night');
    const diff = tr.querySelector('.diff');
    if (q == null) {
      night.textContent = diff.textContent = '';
      diff.className = 'num diff';
    } else {
      const rn = withTax(perRoomNight(q));
      const d = rn - withTax(r.sale);
      night.textContent = fmt(rn);
      diff.textContent = (d > 0 ? '+' : '') + fmt(d);
      diff.className = 'num diff ' + (d > 0 ? 'worse' : 'better');
      quote += q * 2 * r.count;
      people += 2 * r.count;
      quoted++;
    }
    pub += r.pub * r.count;
    sale += r.sale * r.count;
  });
  const n = state.nights;
  const foot = document.querySelector('#rooms tfoot');
  const rooms = ROOMS.reduce((s, r) => s + r.count, 0);
  const line = (label, mxn, note) => el('tr', {},
    el('th', { colspan: 5 }, label),
    el('td', { class: 'num' }, fmt(mxn)),
    el('td', { class: 'num' }, note || usd(mxn)));
  foot.textContent = '';
  foot.append(
    line(`Public rates, ${rooms} rooms × ${n} nights, room only`, withTax(pub * n)),
    line(`Sale rates, ${rooms} rooms × ${n} nights, room only`, withTax(sale * n)));
  if (quoted) {
    const total = withTax(quote * state.fx);
    const partial = quoted < ROOMS.length ? ` (${quoted} of ${ROOMS.length} room types)` : '';
    foot.append(line('Contract, full board' + partial, total));
    if (!partial) {
      // What the contract costs above booking the same rooms at the sale
      // price: in effect, what you are paying for the meals.
      const extra = total - withTax(sale * n);
      foot.append(line('Above the sale price', extra));
      foot.append(line('…per person per day, i.e. what full board is costing', extra / people / n));
    }
  }
}

// ── Quotes ──────────────────────────────────────────────

function renderItems() {
  const body = document.querySelector('#items tbody');
  body.textContent = '';
  state.items.forEach((it, i) => {
    const text = (key, label, cls) => {
      const input = el('input', { type: 'text', 'aria-label': label, class: cls || '' });
      if (key !== 'name') input.setAttribute('inputmode', 'decimal');
      input.value = it[key];
      input.addEventListener('input', () => { it[key] = input.value; save(); itemTotals(); });
      return input;
    };
    const cur = el('select', { 'aria-label': 'Currency' }, el('option', {}, 'MXN'), el('option', {}, 'USD'));
    cur.value = it.cur;
    cur.addEventListener('change', () => { it.cur = cur.value; save(); itemTotals(); });
    const pick = el('select', { 'aria-label': 'Going with' },
      el('option', { value: 'a' }, 'A'), el('option', { value: 'b' }, 'B'), el('option', { value: 'c' }, 'C'));
    pick.value = it.pick;
    pick.addEventListener('change', () => { it.pick = pick.value; save(); itemTotals(); });
    const del = el('button', { type: 'button', class: 'remove', 'aria-label': 'Remove ' + (it.name || 'row') }, '×');
    del.addEventListener('click', () => { state.items.splice(i, 1); save(); renderItems(); });
    body.append(el('tr', { 'data-i': i },
      el('td', {}, text('name', 'Item', 'name')),
      el('td', {}, cur),
      el('td', { class: 'num opt-a' }, text('a', 'Option A')),
      el('td', { class: 'num opt-b' }, text('b', 'Option B')),
      el('td', { class: 'num opt-c' }, text('c', 'Option C')),
      el('td', {}, pick),
      el('td', { class: 'num' }, text('paid', 'Paid')),
      el('td', { class: 'num owed' }),
      el('td', {}, del)));
  });
  itemTotals();
}

function itemTotals() {
  let chosen = 0, paid = 0;
  state.items.forEach((it, i) => {
    const row = document.querySelector(`#items tr[data-i="${i}"]`);
    ['a', 'b', 'c'].forEach(k => row.querySelector('.opt-' + k).classList.toggle('picked', k === it.pick));
    const cost = num(it[it.pick]);
    const p = num(it.paid) || 0;
    row.querySelector('.owed').textContent = cost == null ? '' : fmt(cost - p, it.cur);
    chosen += toMXN(cost, it.cur) || 0;
    paid += toMXN(p, it.cur) || 0;
  });
  const foot = document.querySelector('#items tfoot');
  const line = (label, mxn) => el('tr', {},
    el('th', { colspan: 6 }, label),
    el('td', { class: 'num', colspan: 2 }, fmt(mxn)),
    el('td', { class: 'num usd' }, usd(mxn)));
  foot.textContent = '';
  foot.append(line('Total, options chosen', chosen), line('Paid so far', paid), line('Still owed', chosen - paid));
}

// ── Settings and actions ────────────────────────────────

function bindSettings() {
  const nights = document.getElementById('b-nights');
  const fx = document.getElementById('b-fx');
  const tax = document.getElementById('b-tax');
  nights.value = state.nights;
  fx.value = state.fx;
  tax.checked = state.tax;
  nights.addEventListener('input', () => { const v = num(nights.value); if (v > 0) { state.nights = v; save(); roomTotals(); } });
  fx.addEventListener('input', () => { const v = num(fx.value); if (v > 0) { state.fx = v; save(); roomTotals(); itemTotals(); } });
  tax.addEventListener('change', () => { state.tax = tax.checked; save(); renderRooms(); });
}

const status = msg => {
  const s = document.querySelector('.budget-status');
  s.textContent = msg;
  setTimeout(() => { if (s.textContent === msg) s.textContent = ''; }, 3000);
};

document.getElementById('b-add').addEventListener('click', () => {
  state.items.push({ name: '', cur: 'MXN', a: '', b: '', c: '', pick: 'a', paid: '' });
  save();
  renderItems();
  document.querySelector('#items tbody tr:last-child input').focus();
});

// Tab-separated so it pastes straight into a Google Sheet as columns.
document.getElementById('b-copy').addEventListener('click', async () => {
  const rows = [['Item', 'Currency', 'Option A', 'Option B', 'Option C', 'Going with', 'Paid']]
    .concat(state.items.map(it => [it.name, it.cur, it.a, it.b, it.c, it.pick.toUpperCase(), it.paid]))
    .concat([[], ['Room type', 'Rooms', 'Public / night (MXN)', 'Sale / night (MXN)', 'Contract (USD per person, stay)']])
    .concat(ROOMS.map(r => [r.type, r.count, r.pub, r.sale, state.quote[r.type] || '']));
  try {
    await navigator.clipboard.writeText(rows.map(r => r.join('\t')).join('\n'));
    status('Copied: paste into a sheet.');
  } catch (e) {
    status('Couldn’t reach the clipboard.');
  }
});

document.getElementById('b-clear').addEventListener('click', () => {
  if (!confirm('Clear everything you have entered on this page?')) return;
  state = structuredClone(DEFAULTS);
  save();
  bindSettings();
  renderRooms();
  renderItems();
});

bindSettings();
renderRooms();
renderItems();
