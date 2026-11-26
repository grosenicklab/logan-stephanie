// Budget page: an audit of Cocolia's buyout quote for 7–10 Jan 2027 against
// Cocolia's own public prices for the same rooms, meals and reception.
// All prices were read off the hotel's sites on 26 Nov 2026; the switches at
// the top only change assumptions, and are remembered in this browser.

const STORE_KEY = 'ls-wedding-audit-v1';
const RESEARCH_FX = 19.37;   // MXN per USD used in the written audit
const TAX = 1.19;            // 16% VAT + 3% lodging tax, excluded on both booking sites
const NIGHTS = 3;
const BUNGALOWS = 28;

// Room block (agreement p. 1), quote in USD per person for the stay, and
// public prices: Cocolia direct 5–7 Jan (MXN/night), Booking.com 5–7 Jan
// (USD for both nights), Cocolia direct 11–13 Jan before and after the sale.
const ROOMS = [
  { type: 'Nature View',          count: 15, quote: 741,  direct: 7066, booking: 717,  pre: 6209, sale: 3725.40 },
  { type: 'Premium Nature View',  count: 4,  quote: 790,  direct: 7494, booking: 761,  pre: 6638, sale: 3982.80 },
  { type: 'Premium Ocean View',   count: 4,  quote: 960,  direct: 8993, booking: 913,  pre: 8136, sale: 4881.60 },
  { type: 'Horizon View',         count: 3,  quote: 985,  direct: 9207, booking: 934,  pre: 8351, sale: 5010.60 },
  { type: 'Premium Horizon View', count: 2,  quote: 1058, direct: 9849, booking: 1000, pre: 8993, sale: 5395.80 }
];
const QUOTE = ROOMS.reduce((s, r) => s + r.quote * 2 * r.count, 0);   // 46,372

// Regular meals from the menu proposal, priced on Cacao's 2026 menu (MXN, VAT included).
const MEALS = [
  { meal: 'Thu 7 dinner', kind: 'dinner', items: [
    ['Cream of melon', 'Crema de esquites', 'sub', 195],
    ['Catch of the day, three-chile sauce', 'Pesca del día', 'exact', 360],
    ['Roasted plantains', 'Average dessert', 'sub', 200]] },
  { meal: 'Fri 8 breakfast', kind: 'breakfast', items: [
    ['Fruit bowl and seeds', 'Frutas de temporada', 'exact', 160],
    ['Red chilaquiles with two eggs', 'Chilaquiles', 'exact', 190]] },
  { meal: 'Fri 8 lunch (buffet)', kind: 'lunch', items: [
    ['Guacamole, salad, chickpea dip, bean soup', 'Sopa de frijol', 'sub', 185],
    ['Pizzas, achiote chicken, pork, pasta', 'Pizza margarita', '½', 160],
    ['Mango mousse, chia', 'Mousse de frutos rojos', 'sub', 195]] },
  { meal: 'Sat 9 breakfast (buffet)', kind: 'breakfast', items: [
    ['Fruit, yogurt, seeds', 'Frutas de temporada', 'exact', 160],
    ['Eggs, alambre, chilaquiles, tasajo…', 'Huevos a la mexicana', 'exact', 195]] },
  { meal: 'Sat 9 lunch', kind: 'lunch', items: [
    ['Coconut ceviche', 'Ceviche de coco', 'exact', 280],
    ['Chicken mole tamal', 'Tlayuda (Mezcalería)', 'sub', 250],
    ['Red berry mousse', 'Mousse de frutos rojos', 'exact', 195]] },
  { meal: 'Sat 9 dinner', kind: 'dinner', items: [
    ['Corn sope with nopales and chicken', 'Tostadas de garbanzo', 'sub', 180],
    ['Catch of the day, fine herbs', 'Pesca del día', 'exact', 360],
    ['Chocolate panna cotta', 'Panacota oaxaqueña', 'exact', 205]] },
  { meal: 'Sun 10 breakfast', kind: 'breakfast', items: [
    ['Fruit, granola, pancakes', 'Frutas de temporada', 'exact', 160],
    ['Huevos a la cazuela, quesadillas', 'Huevos (any style)', 'sub', 195]] }
];
const GALA = [
  ['1. Cold starter', 'Tuna tartare', 'Sashimi de atún', 'sub', 360],
  ['2. Soup', 'Cream of charred corn', 'Crema de esquites', 'exact', 195],
  ['3. Main', 'Chicken mole negro', 'Mole negro con pollo', 'exact', 360],
  ['4. Dessert', 'Vanilla flan', 'Panacota oaxaqueña', 'sub', 205]
];
const GALA_MXN = GALA.reduce((s, g) => s + g[4], 0);
const DRINKS = [
  ['House cocktails', 'Mezcalitas, margaritas, cuba libre', '240'],
  ['Mezcal tasting', 'Espadín, tobalá, tepeztate', '270 / 350 / 350'],
  ['House wine', 'White and red', 'not listed'],
  ['Mocktail', 'Hibiscus-rosemary tonic', '130 (kombucha)'],
  ['Hot drinks', 'Café de olla, infusions', '110 (cacao drinks)'],
  ['Average used', '', '242']
];
const DRINK_MXN = 242;
// Hotel meal plans on the 5–7 Jan booking page, MXN per bungalow per night before tax.
const BREAKFAST_PLAN = 490;
const SECOND_MEAL_PLAN = 1184 - 490;

const OPTIONS = {
  rooms:     { label: 'Room benchmark', choices: [['direct', 'Cocolia 5–7 Jan'], ['booking', 'Booking.com 5–7 Jan'], ['pre', '11–13 Jan, before sale'], ['sale', '11–13 Jan, 40% sale']] },
  meals:     { label: 'Regular meals priced', choices: [['dish', 'Dish by dish'], ['plan', "Hotel's meal plans"]] },
  breakfast: { label: 'Breakfast in public rate', choices: [['no', 'No (booking page)'], ['yes', 'Yes (homepage)']] },
  residents: { label: 'Residents', choices: [[56, '56 (agreement)'], [47, '47 (our roster)']] },
  guests:    { label: 'Reception guests', choices: [[65, '65'], [70, '70'], [80, '80 (hotel)']] },
  drinks:    { label: 'Drinks per guest', choices: [[0, 'None'], [2, '2'], [3.5, '3½'], [5, '5']] },
  fx:        { label: 'MXN per USD', choices: [['research', '19.37 (audit)'], ['live', 'Today']] }
};
const DEFAULTS = { rooms: 'direct', meals: 'dish', breakfast: 'no', residents: 56, guests: 70, drinks: 3.5, fx: 'research' };

let state = load();
let liveFx = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) return Object.assign({}, DEFAULTS, saved);
  } catch (e) { /* private window: defaults */ }
  return Object.assign({}, DEFAULTS);
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not saved */ }
}

const fx = () => state.fx === 'live' && liveFx ? liveFx : RESEARCH_FX;
const usd = n => (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
const mxn = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  });
  kids.forEach(k => e.append(k));
  return e;
}

// ── Calculations ────────────────────────────────────────

// Retail cost of one bungalow for three nights, tax included, per benchmark.
function roomRetail(r) {
  if (state.rooms === 'booking') return r.booking * TAX / 2 * NIGHTS;
  return r[state.rooms] * TAX / fx() * NIGHTS;
}

function compute() {
  const res = Number(state.residents);
  const guests = Number(state.guests);
  const mealUSD = kind => MEALS.filter(m => m.kind === kind)
    .reduce((s, m) => s + m.items.reduce((t, i) => t + i[3], 0), 0) * res / fx();

  const lodging = ROOMS.reduce((s, r) => s + roomRetail(r) * r.count, 0);
  let breakfasts, dinners;
  if (state.meals === 'plan') {
    breakfasts = BREAKFAST_PLAN * TAX / fx() * BUNGALOWS * 3;
    dinners = SECOND_MEAL_PLAN * TAX / fx() * BUNGALOWS * 2;
  } else {
    breakfasts = mealUSD('breakfast');
    dinners = mealUSD('dinner');
  }
  if (state.breakfast === 'yes') breakfasts = 0;
  const lunches = mealUSD('lunch');
  const gala = GALA_MXN * guests / fx();
  const drinks = DRINK_MXN * Number(state.drinks) * guests / fx();
  const quote = QUOTE;   // tax included, confirmed with the hotel
  const board = breakfasts + lunches + dinners;
  return { res, guests, lodging, breakfasts, lunches, dinners, board, gala, drinks, quote,
    retail: lodging + board + gala + drinks };
}

// ── Rendering ───────────────────────────────────────────

function renderControls() {
  const box = document.getElementById('controls');
  box.textContent = '';
  Object.entries(OPTIONS).forEach(([key, opt]) => {
    const group = el('div', { class: 'budget-control', role: 'group', 'aria-label': opt.label }, el('span', {}, opt.label));
    opt.choices.forEach(([value, text]) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(String(state[key]) === String(value)) }, text);
      b.addEventListener('click', () => { state[key] = value; save(); renderAll(); });
      group.append(b);
    });
    box.append(group);
  });
}

const BENCH = {
  direct: 'Cocolia direct, 5–7 Jan', booking: 'Booking.com, 5–7 Jan',
  pre: 'Cocolia, 11–13 Jan before sale', sale: 'Cocolia, 11–13 Jan, 40% sale'
};

// Side by side: what the agreement charges (it prices only the bungalows;
// everything else is bundled in) against the retail cost of each part.
function renderSummary(c) {
  const f = fx().toFixed(2);
  const diffCell = (charged, retail) => {
    if (typeof charged !== 'number' || retail == null) return el('td', { class: 'num' });
    const d = charged - retail;
    return el('td', { class: 'num ' + (d > 0 ? 'worse' : 'better') }, (d > 0 ? '+' : '') + usd(d));
  };
  const rows = ROOMS.map(r => [
    `${r.type} × ${r.count}`, r.quote * 2 * r.count, roomRetail(r) * r.count,
    `${BENCH[state.rooms]}, room only, + 19% tax, × 3 nights`, 'Public']);
  const bundled = 'Included';
  rows.push(
    ['3 breakfasts', bundled, c.breakfasts, state.breakfast === 'yes' ? 'Counted as already in the room rate'
      : state.meals === 'plan' ? `MXN 490 × 1.19 ÷ ${f} × 28 bungalows × 3` : `Cacao dishes × ${c.res} residents`, 'Model'],
    ['2 lunches', bundled, c.lunches, `Cacao dishes × ${c.res} residents`, 'Model'],
    ['2 regular dinners', bundled, c.dinners, state.meals === 'plan' ? `MXN 694 × 1.19 ÷ ${f} × 28 bungalows × 2` : `Cacao dishes × ${c.res} residents`, 'Model'],
    [`Gala dinner, ${c.guests} guests`, 'TBA, $0 *', c.gala, `MXN ${GALA_MXN.toLocaleString('en-US')} × ${c.guests} ÷ ${f}`, 'Model'],
    [`Cocktail party, ${c.guests} guests`, 'TBA, $0 *', c.drinks, `${state.drinks} drinks × MXN ${DRINK_MXN} × ${c.guests} ÷ ${f}`, 'Model'],
    ['VAT 16% + city tax 3%', 'Included', null, 'In the retail room rates above; Cacao prices include VAT', 'Quote'],
    ['Service charge, F&B tips', 'Mandatory, % not given', null, 'Not included (Cacao suggests 15%)', 'Open']
  );
  const body = document.querySelector('#summary tbody');
  body.textContent = '';
  rows.forEach(([item, charged, retail, how, type]) => body.append(el('tr', {},
    el('td', {}, item),
    el('td', { class: 'num' }, typeof charged === 'number' ? usd(charged) : charged),
    el('td', { class: 'num' }, retail == null ? '–' : usd(retail)),
    diffCell(charged, retail),
    el('td', { class: 'how' }, how),
    el('td', {}, el('span', { class: 'tag tag-' + type.toLowerCase() }, type)))));

  const diff = c.quote - c.retail;
  const afterLodging = c.quote - c.lodging;
  const afterBoard = afterLodging - c.board;
  const afterGala = afterBoard - c.gala;
  const foot = document.querySelector('#summary tfoot');
  foot.textContent = '';
  const line = (label, charged, retail, how, cls) => foot.append(el('tr', { class: cls || '' },
    el('th', {}, label),
    el('td', { class: 'num' }, charged == null ? '' : usd(charged)),
    el('td', { class: 'num' }, retail == null ? '' : usd(retail)),
    charged != null && retail != null ? diffCell(charged, retail) : el('td', {}),
    el('td', { class: 'how', colspan: 2 }, how)));
  line('Total', c.quote, c.retail, `Package ${diff <= 0 ? 'below' : 'above'} retail by ${Math.abs(diff / c.retail * 100).toFixed(1)}%`, diff <= 0 ? 'better' : 'worse');
  line('Left in the package after lodging', afterLodging, null, '');
  line('…after regular meals', afterBoard, null, '');
  line('…after the gala dinner', afterGala, null, `${usd(afterGala / c.guests)} per reception guest for drinks and service`);
  return { diff, afterGala };
}

// ── Rates by date ───────────────────────────────────────

// Standard Nature View, 2 adults, one night, before tax. Cocolia: its booking
// calendar's full public rate (MXN). Booking.com: the lowest price shown that
// night (USD), with the 40% sale where offered. null = sold out or full.
const CHART_START = Date.UTC(2026, 11, 1);
const DIRECT = [].concat(
  Array(3).fill(5567), [5995, 5995], Array(5).fill(5567), [5995, 5995], Array(5).fill(5567),
  Array(5).fill(6102), [7494, 7494], Array(4).fill(7708), [8750, 8750, 8750],             // Dec
  [8750, 8600, 8136, 7066, 7066, 7066, null, null, null], Array(5).fill(6209), [6531, 6531],
  Array(5).fill(6209), [6531, 6531], Array(5).fill(6209), [6531, 6531], [6209],            // Jan
  [6209]);                                                                                  // 1 Feb
const BOOKING = [].concat(
  [169, 169, 282, 183, 183], Array(5).fill(169), [183, 183], Array(5).fill(169), [186],
  Array(4).fill(310), [380, 380], Array(7).fill(null),                                      // Dec
  [null, null, null, 359, 359, 359, null, null, null, 315], Array(4).fill(189), [199, 199],
  Array(5).fill(189), [199, 199], Array(5).fill(189), [199, 199], [189],                   // Jan
  [189]);
const PACKAGE_NIGHT = 1482 / NIGHTS;   // Nature View bungalow's share, incl. meals and reception
const WEDDING = [37, 38, 39];          // day indexes of 7, 8, 9 Jan

function renderChart() {
  const W = 760, H = 300, L = 48, R = 12, T = 16, B = 34, max = 550;
  const n = DIRECT.length;
  const x = i => L + (i + 0.5) * (W - L - R) / n;
  const y = v => T + (1 - v / max) * (H - T - B);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Nightly rates for a Nature View bungalow, 1 Dec 2026 to 1 Feb 2027');
  const add = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (text != null) e.textContent = text;
    svg.append(e);
    return e;
  };
  const band = (W - L - R) / n;
  add('rect', { x: x(WEDDING[0]) - band / 2, y: T, width: band * 3, height: H - T - B, class: 'c-wedding' });
  add('text', { x: x(38), y: T + 10, 'text-anchor': 'middle', class: 'c-label' }, 'Wedding');
  [0, 100, 200, 300, 400, 500].forEach(v => {
    add('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'c-grid' });
    add('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'c-axis' }, '$' + v);
  });
  [[0, '1 Dec'], [14, '15 Dec'], [31, '1 Jan'], [45, '15 Jan'], [62, '1 Feb']].forEach(([i, t]) =>
    add('text', { x: x(i), y: H - 12, 'text-anchor': 'middle', class: 'c-axis' }, t));

  const series = (values, cls, label) => {
    let d = '';
    values.forEach((v, i) => { if (v != null) d += (d && values[i - 1] != null ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
    add('path', { d, class: cls });
    values.forEach((v, i) => {
      if (v == null) return;
      const dot = add('circle', { cx: x(i), cy: y(v), r: 2.2, class: cls + '-dot' });
      const date = new Date(CHART_START + i * 864e5).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const t = document.createElementNS(NS, 'title');
      t.textContent = `${label}, ${date}: ${usd(v)}`;
      dot.append(t);
    });
  };
  series(DIRECT.map(v => v == null ? null : v / fx()), 'c-direct', 'Cocolia full rate');
  series(BOOKING, 'c-booking', 'Booking.com lowest');
  add('rect', { x: x(35) - band / 2, y: y(286), width: band * 2, height: y(238) - y(286), class: 'c-resell' });
  // The contract as a reference across every date, solid over our own nights.
  add('line', { x1: L, x2: W - R, y1: y(PACKAGE_NIGHT), y2: y(PACKAGE_NIGHT), class: 'c-package c-package-ref' });
  add('line', { x1: x(WEDDING[0]) - band / 2, x2: x(WEDDING[2]) + band / 2, y1: y(PACKAGE_NIGHT), y2: y(PACKAGE_NIGHT), class: 'c-package' });
  add('text', { x: L + 4, y: y(PACKAGE_NIGHT) - 6, class: 'c-label' }, `Our contract, Nature View: ${usd(PACKAGE_NIGHT)} a night with tax, meals, gala and bar`);
  add('text', { x: L + 4, y: y(PACKAGE_NIGHT / TAX) + 14, class: 'c-label c-label-soft' }, `Same, before its 19% tax (compare with the rates below): ${usd(PACKAGE_NIGHT / TAX)}`);
  add('line', { x1: L, x2: W - R, y1: y(PACKAGE_NIGHT / TAX), y2: y(PACKAGE_NIGHT / TAX), class: 'c-package-ref c-package-pretax' });

  const box = document.getElementById('chart');
  box.textContent = '';
  box.append(svg);
  const legend = el('div', { class: 'c-legend' });
  [['c-direct', 'Cocolia full public rate'], ['c-booking', 'Booking.com lowest (incl. 40% sale)'],
   ['c-resell', 'Resellers via Google, 5–7 Jan'], ['c-package', `Our package, Nature View: ${usd(PACKAGE_NIGHT)}/night, all-inclusive`]]
    .forEach(([cls, text]) => legend.append(el('span', {}, el('i', { class: cls + '-key' }), text)));
  box.append(legend);
}

function renderVerdict(c, d) {
  const pct = Math.abs(d.diff / c.retail * 100).toFixed(0);
  const v = document.getElementById('verdict');
  v.textContent = d.diff <= 0
    ? `At these assumptions the package is ${usd(-d.diff)} (${pct}%) below what the same stay costs at Cocolia's public prices: fair against retail. The hotel does sell rooms for much less, though (see “Group-price context” below).`
    : `At these assumptions the package is ${usd(d.diff)} (${pct}%) above what the same stay costs at Cocolia's public prices.`;
  v.className = 'budget-verdict ' + (d.diff <= 0 ? 'better' : 'worse');
}

// What one resident's stay costs at retail, day by day, against their share
// of the package. Meals land on the day the menu proposal serves them.
const DAYS = ['Thu 7', 'Fri 8', 'Sat 9', 'Sun 10'];

function renderPerDay(c) {
  const room = c.lodging / c.res / NIGHTS;
  const mealPrice = m => {
    if (state.breakfast === 'yes' && m.kind === 'breakfast') return 0;
    if (state.meals === 'plan' && m.kind === 'breakfast') return BREAKFAST_PLAN * TAX / fx() / 2;
    if (state.meals === 'plan' && m.kind === 'dinner') return SECOND_MEAL_PLAN * TAX / fx() / 2;
    return m.items.reduce((s, i) => s + i[3], 0) / fx();
  };
  const row = (label, values) => ({ label, values });
  const byKind = kind => DAYS.map(d => {
    const m = MEALS.find(x => x.kind === kind && x.meal.startsWith(d));
    return m ? mealPrice(m) : null;
  });
  const rows = [
    row('Room (share of bungalow, + tax)', [room, room, room, null]),
    row('Breakfast', byKind('breakfast')),
    row('Lunch', byKind('lunch')),
    row('Dinner', byKind('dinner')),
    row('Gala dinner', [null, GALA_MXN / fx(), null, null]),
    row(`Cocktail party (${state.drinks} drinks)`, [null, DRINK_MXN * Number(state.drinks) / fx(), null, null])
  ];
  const body = document.querySelector('#perday tbody');
  body.textContent = '';
  const totals = [0, 0, 0, 0];
  const cells = (values, stay) => [
    ...values.map(v => el('td', { class: 'num' }, v == null ? '' : usd(v))),
    el('td', { class: 'num' }, usd(stay)),
    el('td', { class: 'num' }, usd(stay / NIGHTS))];
  rows.forEach(r => {
    r.values.forEach((v, i) => { totals[i] += v || 0; });
    const stay = r.values.reduce((s, v) => s + (v || 0), 0);
    body.append(el('tr', {}, el('td', {}, r.label), ...cells(r.values, stay)));
  });
  const retailStay = totals.reduce((s, v) => s + v, 0);
  const pkg = c.quote / c.res;
  const foot = document.querySelector('#perday tfoot');
  foot.textContent = '';
  foot.append(
    el('tr', {}, el('th', {}, 'Retail per guest'), ...cells(totals, retailStay)),
    el('tr', {}, el('th', {}, `Our package ÷ ${c.res} residents`),
      el('td', { colspan: 4, class: 'how' }, '$46,372, tax and everything included'),
      el('td', { class: 'num' }, usd(pkg)), el('td', { class: 'num' }, usd(pkg / NIGHTS))),
    el('tr', { class: pkg <= retailStay ? 'better' : 'worse' },
      el('th', {}, pkg <= retailStay ? 'Package saves per guest' : 'Package costs more per guest by'),
      el('td', { colspan: 4 }),
      el('td', { class: 'num' }, usd(Math.abs(retailStay - pkg))),
      el('td', { class: 'num' }, usd(Math.abs(retailStay - pkg) / NIGHTS))));
}

function renderRooms() {
  const body = document.querySelector('#rooms tbody');
  body.textContent = '';
  let retail = 0;
  ROOMS.forEach(r => {
    const each = roomRetail(r);
    retail += each * r.count;
    body.append(el('tr', {},
      el('td', {}, r.type), el('td', { class: 'num' }, String(r.count)),
      el('td', { class: 'num' }, mxn(r.direct)), el('td', { class: 'num' }, '$' + r.booking),
      el('td', { class: 'num' }, mxn(r.pre) + ' → ' + mxn(r.sale)),
      el('td', { class: 'num' }, usd(each)), el('td', { class: 'num' }, usd(r.quote * 2)),
      el('td', { class: 'num' }, usd(each * r.count)), el('td', { class: 'num' }, usd(r.quote * 2 * r.count))));
  });
  const foot = document.querySelector('#rooms tfoot');
  foot.textContent = '';
  foot.append(el('tr', {}, el('th', { colspan: 7 }, `Total · ${BENCH[state.rooms]}`),
    el('td', { class: 'num' }, usd(retail)), el('td', { class: 'num' }, usd(QUOTE))));
}

function renderMeals(c) {
  const body = document.querySelector('#meals tbody');
  body.textContent = '';
  MEALS.forEach(m => {
    const total = m.items.reduce((s, i) => s + i[3], 0);
    m.items.forEach((i, n) => {
      const last = n === m.items.length - 1;
      body.append(el('tr', { class: n === 0 ? 'group-start' : '' },
        el('td', {}, n === 0 ? m.meal : ''), el('td', {}, i[0]), el('td', {}, i[1]),
        el('td', {}, i[2]), el('td', { class: 'num' }, String(i[3])),
        el('td', { class: 'num' }, last ? usd(total / fx()) : ''),
        el('td', { class: 'num' }, last ? usd(total * c.res / fx()) : '')));
    });
  });
}

function renderReception(c) {
  const body = document.querySelector('#gala tbody');
  body.textContent = '';
  GALA.forEach(g => body.append(el('tr', {}, ...g.map((v, i) => el('td', { class: i === 4 ? 'num' : '' }, String(v))))));
  const foot = document.querySelector('#gala tfoot');
  foot.textContent = '';
  foot.append(el('tr', {}, el('th', { colspan: 4 }, `Per guest ${usd(GALA_MXN / fx())} · × ${c.guests} guests = ${usd(c.gala)}`),
    el('td', { class: 'num' }, String(GALA_MXN))));
  const dbody = document.querySelector('#drinks tbody');
  dbody.textContent = '';
  DRINKS.forEach(d => dbody.append(el('tr', {}, el('td', {}, d[0]), el('td', {}, d[1]), el('td', { class: 'num' }, d[2]))));
  document.getElementById('coral').textContent =
    `${usd(2100 * c.guests / fx())} for ${c.guests} guests (${usd(2100 * 1.16 * c.guests / fx())} with IVA)`;
  const saleTotal = ROOMS.reduce((s, r) => s + r.sale * TAX / fx() * NIGHTS * r.count, 0);
  document.getElementById('sale').textContent = usd(saleTotal);
}

function renderAll() {
  renderControls();
  const c = compute();
  const d = renderSummary(c);
  renderVerdict(c, d);
  renderPerDay(c);
  renderRooms();
  renderChart();
  renderMeals(c);
  renderReception(c);
}

// ── Actions ─────────────────────────────────────────────

const status = msg => {
  const s = document.querySelector('.budget-status');
  s.textContent = msg;
  setTimeout(() => { if (s.textContent === msg) s.textContent = ''; }, 3000);
};

// Tab-separated so it pastes into a sheet or doc as a table.
document.getElementById('b-copy').addEventListener('click', async () => {
  const rows = [...document.querySelectorAll('#summary tr')].map(tr =>
    [...tr.children].map(td => td.textContent.trim()).join('\t'));
  try {
    await navigator.clipboard.writeText(rows.join('\n'));
    status('Copied.');
  } catch (e) {
    status('Couldn’t reach the clipboard.');
  }
});

// Today's rate, for the "Today" switch (free, no key, allows browser requests).
async function loadLiveFx() {
  try {
    const data = await (await fetch('https://open.er-api.com/v6/latest/USD')).json();
    if (!(data && data.rates && data.rates.MXN > 0)) throw new Error('no rate');
    liveFx = Math.round(data.rates.MXN * 100) / 100;
    OPTIONS.fx.choices[1][1] = 'Today ' + liveFx.toFixed(2);
  } catch (e) {
    OPTIONS.fx.choices[1][1] = 'Today (unavailable)';
  }
  renderAll();
}

renderAll();
loadLiveFx();
