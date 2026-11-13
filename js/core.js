'use strict';
/* Cointrol · núcleo: utilidades, datos, almacenamiento y cálculos.
   Todo vive en el almacenamiento local del móvil; nada sale del dispositivo. */

// ================================================================ utilidades
// Las apps de prueba (gratis / Pro) definen window.EDITION antes de cargar este archivo.
const EDITION = window.EDITION || null;
const BASE = EDITION ? '../' : ''; // ruta a los archivos compartidos (iconos)
const KEY = EDITION ? EDITION.key : 'cointrol.v1'; // misma clave que la v1 para conservar tus datos
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const eur = (n) => eurFmt.format(round2(n || 0));
const signed = (n) => (round2(n) > 0 ? '+' : round2(n) < 0 ? '−' : '') + eurFmt.format(Math.abs(round2(n)));
const pct = (n) => (isFinite(n) ? (n * 100).toFixed(1).replace('.', ',') : '0,0') + '%';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MON3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => new Date(s + 'T12:00:00');
const today = () => isoDate(new Date());
const curYM = () => today().slice(0, 7);
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
const addMonths = (ym, n) => {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = ((((m - 1) % 12) + 12) % 12) + 1;
  return `${y}-${pad(m)}`;
};
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const monthEnd = (ym) => `${ym}-${pad(daysInMonth(ym))}`;
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const ymLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
const dateLabel = (d) => parseDate(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (d) => parseDate(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const ddmmyyyy = (d) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function parseAmount(s) {
  if (typeof s === 'number') return round2(s);
  s = String(s ?? '').trim().replace(/[\s€]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? round2(n) : NaN;
}
const amountStr = (n) => (typeof n === 'string' ? n : n ? String(round2(n)).replace('.', ',') : '');

// ================================================================ datos por defecto
// Los nombres de las categorías de gasto son EXACTAMENTE los del Excel, para poder pegar los datos.
const GROUPS = {
  necesario: { name: 'Necesarios', icon: '🧾', color: '#41a6f6' },
  ocio: { name: 'Ocio y vida social', icon: '🎉', color: '#ef7d57' },
  ahorro: { name: 'Ahorro', icon: '🐷', color: '#38b764' },
};

const DEFAULT_CATS = [
  { id: 'salud', name: 'SALUD', icon: '💊', color: '#5089BC', group: 'necesario', subs: ['Medicamentos', 'Médico / dentista', 'Óptica', 'Otros salud'] },
  { id: 'deporte', name: 'DEPORTE', icon: '🏋️', color: '#2E8B57', group: 'ocio', subs: ['Gimnasio', 'Material deportivo', 'Actividades / competiciones'] },
  { id: 'comida', name: 'COMIDA (SÚPER)', icon: '🛒', color: '#D26E2A', group: 'necesario', subs: ['Supermercado', 'Snacks / otros'] },
  { id: 'cafes', name: 'CAFÉS Y MÁQUINA CURRO', icon: '☕', color: '#8B5A2B', group: 'ocio', subs: ['Cafés', 'Máquina curro'] },
  { id: 'restaurantes', name: 'RESTAURANTES Y TOMAR ALGO', icon: '🍻', color: '#C0392B', group: 'ocio', subs: ['Restaurante', 'Tomar algo', 'Comida a domicilio'] },
  { id: 'servicios', name: 'SERVICIOS', icon: '🧾', color: '#7E7E7E', group: 'necesario', subs: ['Transporte', 'Suscripciones', 'Facturas (luz, móvil...)', 'Impuestos'] },
  { id: 'ocio', name: 'OCIO', icon: '🎮', color: '#62993E', group: 'ocio', subs: ['Videojuegos', 'Cine / conciertos', 'Fiesta / salidas', 'Otros ocio'] },
  { id: 'ropa', name: 'ROPA', icon: '👕', color: '#B565A7', group: 'ocio', subs: ['Ropa', 'Calzado', 'Accesorios'] },
  { id: 'electronica', name: 'ELECTRÓNICA', icon: '💻', color: '#6F9BD1', group: 'ocio', subs: ['Dispositivos', 'Accesorios / periféricos'] },
  { id: 'casa', name: 'CASA', icon: '🏠', color: '#E8896A', group: 'necesario', subs: ['Reformas', 'Muebles / decoración', 'Limpieza / hogar'] },
  { id: 'regalos', name: 'REGALOS', icon: '🎁', color: '#E2AA00', group: 'ocio', subs: ['Cumpleaños', 'Navidad', 'Otros regalos'] },
  { id: 'estudio', name: 'ESTUDIO', icon: '📚', color: '#D9A520', group: 'necesario', subs: ['Cursos', 'Libros / material', 'Herramientas IA / software'] },
  { id: 'varios', name: 'VARIOS', icon: '✈️', color: '#8FA2D4', group: 'ocio', subs: ['Viajes', 'Otros'] },
  { id: 'inversion', name: 'INVERSIÓN', icon: '📈', color: '#3B64AD', group: 'ahorro', subs: ['Fondos / acciones', 'Cripto', 'Otros inversión'] },
].map((c) => ({ ...c, kind: 'expense', builtin: true }));
const EXCEL_NAMES = new Set(DEFAULT_CATS.map((c) => c.name));

const DEFAULT_INCOME_CATS = [
  { id: 'nomina', name: 'Nómina', icon: '💼', color: '#38b764', principal: true, subs: ['Nómina', 'Paga extra'] },
  { id: 'otros_ingresos', name: 'Otros ingresos', icon: '💰', color: '#a7f070', principal: false, subs: ['Venta (Wallapop, etc.)', 'Trabajo extra', 'Regalo / Bizum', 'Intereses', 'Otros'] },
].map((c) => ({ ...c, kind: 'income', builtin: true }));

const DEFAULT_ACCOUNTS = [
  { id: 'banco', name: 'Cuenta principal', icon: '🏦', color: '#41a6f6', initial: 0 },
  { id: 'efectivo', name: 'Efectivo', icon: '💶', color: '#38b764', initial: 0 },
];

const FALLBACK = { expense: 'varios', income: 'otros_ingresos' };

const EMOJIS = ('💊🩺🦷👓🏋️⚽🚴🏊🛒🍎🥖☕🍩🍽️🍻🍷🍕🍔🚌🚗⛽🚆✈️🏨🧳📱💻🎮🎬🎵🎟️🎉👕👟👜💇🏠🛋️🔧🧹💡💧📶🧾🎁🎂🎄📚🎓🐶🐱👶💼💰💵📈🏦🐷🏡💍🏖️🎸📷❤️⭐📦🚬🍼🧴🗡️🛡️🏹🧪💎👑🐉🍄')
  .match(/\p{Extended_Pictographic}️?/gu);
const GOAL_EMOJIS = ['🚗', '📱', '🏠', '🏡', '🛠️', '🏖️', '✈️', '💍', '🎓', '💻', '🛵', '🐷', '🏦', '🎸', '👶', '🐉'];
const ACCOUNT_EMOJIS = ['🏦', '💶', '💳', '🐷', '📈', '🪙', '💰', '👛', '🏧', '💎'];
const AVATARS = ['🧙', '🧝', '🦸', '🥷', '🧛', '🤖', '👾', '🐉', '🦊', '🐸', '🐱', '🦁'];
const COLORS = ['#5089BC', '#2E8B57', '#D26E2A', '#8B5A2B', '#C0392B', '#7E7E7E', '#62993E', '#B565A7', '#6F9BD1', '#E8896A', '#E2AA00', '#3B64AD', '#14B8A6', '#EC4899', '#8B5CF6', '#64748B'];

function defaultBudget() {
  return { id: 'b_mes', name: 'Presupuesto del mes', icon: '🗡️', period: 'month', auto: true, amount: 0, cats: [], catLimits: {}, start: '', end: '' };
}

function freshDB() {
  return {
    version: 2,
    settings: {
      savingsTarget: 0.7, decimalComma: true, xlHeader: false, sound: true,
      playerName: 'Jugador', avatar: '🧙', pinHash: '',
      home: { budget: true, saving: true, upcoming: true, quests: true, recent: true },
    },
    categories: [...DEFAULT_CATS, ...DEFAULT_INCOME_CATS].map((c) => ({ ...c, subs: [...c.subs] })),
    accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })),
    movements: [],
    goals: [],
    budgets: [defaultBudget()],
    recurring: [],
    loans: [],
    titles: {},
    meta: { exported: 0, backups: 0, unlocked: {}, level: 1 },
  };
}

// ================================================================ almacenamiento
let db = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.error(e); }
  return freshDB();
}
function migrate(d) {
  const base = freshDB();
  d.settings = { ...base.settings, ...(d.settings || {}) };
  d.settings.home = { ...base.settings.home, ...(d.settings.home || {}) };
  d.categories = Array.isArray(d.categories) && d.categories.length ? d.categories : base.categories;
  for (const c of base.categories) if (!d.categories.some((x) => x.id === c.id)) d.categories.push(c);
  d.accounts = Array.isArray(d.accounts) && d.accounts.length ? d.accounts : base.accounts;
  d.movements = (Array.isArray(d.movements) ? d.movements : []).map((m) => ({
    note: '', pending: false, ...m, accountId: m.accountId || d.accounts[0].id, created: m.created || new Date().toISOString(),
  }));
  d.goals = Array.isArray(d.goals) ? d.goals : [];
  d.budgets = Array.isArray(d.budgets) ? d.budgets : base.budgets;
  d.recurring = Array.isArray(d.recurring) ? d.recurring : [];
  d.loans = Array.isArray(d.loans) ? d.loans : [];
  d.meta = { ...base.meta, ...(d.meta || {}) };
  if (!d.titles || typeof d.titles !== 'object') {
    d.titles = {};
    for (const m of d.movements) learnTitle(m, d);
  }
  d.version = 2;
  return d;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('No se ha podido guardar: ' + e.message, 'bad'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const cat = (id) => db.categories.find((c) => c.id === id);
const catsOf = (kind) => db.categories.filter((c) => c.kind === kind);
const account = (id) => db.accounts.find((a) => a.id === id);

// ---- títulos: recuerda la categoría de cada descripción (como «Custom titles» de Cashew)
function learnTitle(m, d = db) {
  const k = norm(m.desc);
  if (!k || m.type === 'transfer') return;
  d.titles[k] = { desc: m.desc.trim(), type: m.type, catId: m.catId, sub: m.sub || '', amount: m.amount, n: ((d.titles[k] && d.titles[k].n) || 0) + 1 };
}
function suggestTitles(q, type) {
  const k = norm(q);
  if (!k) return [];
  return Object.values(db.titles)
    .filter((t) => t.type === type && cat(t.catId) && norm(t.desc).includes(k) && norm(t.desc) !== k)
    .sort((a, b) => (norm(a.desc).startsWith(k) ? 0 : 1) - (norm(b.desc).startsWith(k) ? 0 : 1) || b.n - a.n)
    .slice(0, 4);
}

// ================================================================ cálculos
const isReal = (m) => !m.pending && m.type !== 'transfer';

function monthStats(ym) {
  const movs = db.movements.filter((m) => m.date.startsWith(ym) && isReal(m));
  const s = { ym, movs, inc: 0, incP: 0, incS: 0, exp: 0, inv: 0, byCat: {}, bySub: {}, byGroup: { necesario: 0, ocio: 0, ahorro: 0 } };
  for (const m of movs) {
    const c = cat(m.catId);
    if (m.type === 'income') {
      s.inc += m.amount;
      if (c && c.principal) s.incP += m.amount; else s.incS += m.amount;
    } else {
      const g = (c && c.group) || 'ocio';
      s.byGroup[g] += m.amount;
      if (g === 'ahorro') s.inv += m.amount; else s.exp += m.amount;
      s.byCat[m.catId] = (s.byCat[m.catId] || 0) + m.amount;
      const k = m.catId + '|' + (m.sub || '');
      s.bySub[k] = (s.bySub[k] || 0) + m.amount;
    }
  }
  return finishStats(s);
}
function finishStats(s) {
  s.saving = s.inc - s.exp;                       // como el Excel: ingresos − gastos (la inversión cuenta como ahorro)
  s.target = s.inc * db.settings.savingsTarget;    // objetivo (70 % por defecto)
  s.diff = s.saving - s.target;
  s.balance = s.inc - s.exp - s.inv;               // lo que queda libre en la cuenta
  s.rate = s.inc > 0 ? s.saving / s.inc : 0;
  return s;
}
function yearStats(year) {
  const months = Array.from({ length: 12 }, (_, i) => monthStats(`${year}-${pad(i + 1)}`));
  const y = { months, inc: 0, incP: 0, incS: 0, exp: 0, inv: 0, byCat: {}, bySub: {}, byGroup: { necesario: 0, ocio: 0, ahorro: 0 }, movs: [] };
  for (const s of months) {
    y.inc += s.inc; y.incP += s.incP; y.incS += s.incS; y.exp += s.exp; y.inv += s.inv; y.movs.push(...s.movs);
    for (const [k, v] of Object.entries(s.byCat)) y.byCat[k] = (y.byCat[k] || 0) + v;
    for (const [k, v] of Object.entries(s.bySub)) y.bySub[k] = (y.bySub[k] || 0) + v;
    for (const [k, v] of Object.entries(s.byGroup)) y.byGroup[k] += v;
  }
  return finishStats(y);
}

// ---- cuentas
function accountBalance(a, upTo = '9999-12-31') {
  let b = a.initial || 0;
  for (const m of db.movements) {
    if (m.pending || m.date > upTo) continue;
    if (m.type === 'transfer') {
      if (m.accountId === a.id) b -= m.amount;
      if (m.toAccountId === a.id) b += m.amount;
    } else if (m.accountId === a.id) b += m.type === 'income' ? m.amount : -m.amount;
  }
  return round2(b);
}
const totalGold = () => round2(db.accounts.reduce((s, a) => s + accountBalance(a), 0));

// ---- presupuestos (como los de Cashew: periodo, categorías incluidas y límites por categoría)
function budgetRange(b, ref = today()) {
  if (b.period === 'custom' && b.start && b.end) return [b.start, b.end];
  if (b.period === 'week') {
    const d = parseDate(ref); const dow = (d.getDay() + 6) % 7;
    const from = addDays(ref, -dow); return [from, addDays(from, 6)];
  }
  const ym = ref.slice(0, 7); return [`${ym}-01`, monthEnd(ym)];
}
function budgetStatus(b, ref = today()) {
  const [from, to] = budgetRange(b, ref);
  const inCats = (id) => { const c = cat(id); return c && c.kind === 'expense' && c.group !== 'ahorro' && (!b.cats.length || b.cats.includes(id)); };
  const movs = db.movements.filter((m) => isReal(m) && m.type === 'expense' && m.date >= from && m.date <= to && inCats(m.catId));
  const byCat = {};
  let spent = 0;
  for (const m of movs) { spent += m.amount; byCat[m.catId] = (byCat[m.catId] || 0) + m.amount; }
  let limit = b.amount || 0;
  if (b.auto) {
    // automático: lo que puedes gastar para cumplir el objetivo de ahorro = ingresos × (1 − 70 %)
    const inc = monthStats(from.slice(0, 7)).inc;
    limit = inc * (1 - db.settings.savingsTarget);
    if (b.period === 'week') limit = (limit * 7) / daysInMonth(from.slice(0, 7));
  }
  const t = today();
  const total = daysBetween(from, to) + 1;
  const elapsed = t < from ? 0 : t > to ? total : daysBetween(from, t) + 1;
  const daysLeft = t > to ? 0 : t < from ? total : daysBetween(t, to) + 1;
  const left = limit - spent;
  return {
    b, from, to, movs, byCat, spent: round2(spent), limit: round2(limit), left: round2(left),
    total, elapsed, daysLeft, perDay: daysLeft > 0 ? Math.max(0, left) / daysLeft : 0,
    pace: total ? (limit * elapsed) / total : 0, over: spent > limit && limit > 0, ended: t > to,
  };
}

// ---- metas: cada mes se aparta a cada una su cantidad, o menos si el balance libre no llega
function goalPlan() {
  const goals = [...db.goals].sort((a, b) => a.order - b.order);
  const res = {};
  goals.forEach((g) => (res[g.id] = { saved: g.initial || 0, byMonth: {} }));
  const months = {};
  if (!goals.length) return { res, months };
  const start = goals.reduce((a, g) => (g.startMonth < a ? g.startMonth : a), '9999-12');
  const end = curYM();
  for (let ym = start; ym <= end; ym = addMonths(ym, 1)) {
    let avail = Math.max(0, round2(monthStats(ym).balance));
    months[ym] = { avail, planned: 0, given: 0 };
    for (const g of goals) {
      if (g.paused || ym < g.startMonth) continue;
      const r = res[g.id];
      const left = round2(g.target - r.saved);
      if (left <= 0) continue;
      const want = Math.min(g.monthly, left);
      months[ym].planned += want;
      const a = round2(Math.min(want, avail));
      r.byMonth[ym] = a;
      if (a > 0) { r.saved = round2(r.saved + a); avail = round2(avail - a); months[ym].given += a; }
    }
  }
  return { res, months };
}

// ---- recurrentes / suscripciones (como «subscriptions» y «upcoming» de Cashew)
function advance(date, freq) {
  if (freq === 'week') return addDays(date, 7);
  if (freq === 'year') return addMonths(date.slice(0, 7), 12) + date.slice(7);
  // mensual: conserva el día, ajustado si el mes es más corto
  const day = +date.slice(8);
  const ym = addMonths(date.slice(0, 7), 1);
  return `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;
}
function processRecurring() {
  const t = today();
  let created = 0;
  for (const r of db.recurring) {
    if (!r.active) continue;
    let guard = 0;
    while (r.next <= t && guard++ < 120) {
      db.movements.push({
        id: uid(), type: r.type, amount: r.amount, desc: r.desc, note: '', date: r.next, catId: r.catId, sub: r.sub || '',
        accountId: r.accountId, pending: !r.auto, recurringId: r.id, created: new Date().toISOString(),
      });
      created++;
      r.next = advance(r.next, r.freq);
    }
  }
  if (created) save();
  return created;
}
function upcoming(days = 30) {
  const t = today(), lim = addDays(t, days);
  return db.recurring.filter((r) => r.active && r.next <= lim).map((r) => ({ r, date: r.next })).sort((a, b) => a.date.localeCompare(b.date));
}
const pendingMovs = () => db.movements.filter((m) => m.pending).sort((a, b) => a.date.localeCompare(b.date));
const FREQS = { week: 'Semanal', month: 'Mensual', year: 'Anual' };
function monthlyCost(r) { return r.freq === 'week' ? (r.amount * 52) / 12 : r.freq === 'year' ? r.amount / 12 : r.amount; }

// ---- préstamos y deudas
const loanLeft = (l) => round2(l.amount - l.payments.reduce((s, p) => s + p.amount, 0));

// ---- racha de días registrando
function streaks() {
  const days = new Set(db.movements.filter((m) => !m.pending).map((m) => m.created.slice(0, 10)).concat(db.movements.filter((m) => !m.pending).map((m) => m.date)));
  const t = today();
  let cur = 0, d = days.has(t) ? t : addDays(t, -1);
  while (days.has(d)) { cur++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = null;
  for (const x of [...days].sort()) {
    run = prev && addDays(prev, 1) === x ? run + 1 : 1;
    best = Math.max(best, run); prev = x;
  }
  return { cur, best: Math.max(best, cur), days: days.size };
}
