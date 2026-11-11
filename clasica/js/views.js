'use strict';
/* Cointrol Clásico · pantallas y gráficos (estilo Cashew / Material You). */

const ui = {
  view: 'home', ym: curYM(), statsMode: 'month', year: +today().slice(0, 4),
  filter: 'all', q: '', fCat: '', fAcc: '', select: false, selected: new Set(),
  sub: null, exYM: curYM(), homeAcc: '',
};
const VIEW_TITLES = { home: 'Inicio', tx: 'Transacciones', budgets: 'Presupuestos', goals: 'Objetivos', more: 'Más' };
const SUBTITLES = {
  stats: 'Todos los gastos', excel: 'Pasar al Excel', import: 'Importar del Excel', recurring: 'Suscripciones',
  loans: 'Préstamos y deudas', accounts: 'Cuentas', cats: 'Categorías', settings: 'Ajustes',
};

function render() {
  const views = { home: viewHome, tx: viewTx, budgets: viewBudgets, goals: viewGoals, more: viewMore };
  $('#view').innerHTML = views[ui.view]();
  const sub = ui.view === 'more' && ui.sub;
  $('#title').textContent = sub ? SUBTITLES[ui.sub] : VIEW_TITLES[ui.view];
  $('#back').hidden = !sub;
  $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.nav === ui.view));
  $('#fab').hidden = !['home', 'tx'].includes(ui.view) || ui.select;
}

// ================================================================ piezas comunes
const ico = (c, size) => `<span class="cat-ico" style="--c:${c ? c.color : '#8a8f98'}${size ? `;--s:${size}px` : ''}">${c ? c.icon : '❔'}</span>`;
const seg = (items, cur, action) => `<div class="seg">${items.map(([k, l]) =>
  `<button class="${cur === k ? 'on' : ''}" data-action="${action}" data-v="${k}">${l}</button>`).join('')}</div>`;
function bar(frac, color, mark) {
  const w = Math.max(0, Math.min(1, frac || 0)) * 100;
  return `<div class="bar"><i style="width:${w}%;${color ? `background:${color}` : ''}"></i>${mark !== undefined ? `<b class="mark" style="left:${Math.min(100, mark * 100)}%"></b>` : ''}</div>`;
}
const empty = (e, t) => `<div class="empty"><span class="e">${e}</span>${t}</div>`;
function monthChips(action, cur) {
  // fila horizontal de meses, como la de Cashew
  const out = [];
  for (let i = -11; i <= 1; i++) {
    const ym = addMonths(curYM(), i);
    const [y, m] = ym.split('-');
    out.push(`<button class="mchip ${ym === cur ? 'on' : ''}" data-action="${action}" data-v="${ym}">${MONTHS[+m - 1]}${y !== today().slice(0, 4) ? ' ' + y : ''}</button>`);
  }
  return `<div class="mchips" id="mchips">${out.join('')}</div>`;
}
const periodNav = (label, action) => `<div class="period">
  <button class="icon-btn" data-action="${action}" data-d="-1" aria-label="Anterior">‹</button>
  <strong>${label}</strong>
  <button class="icon-btn" data-action="${action}" data-d="1" aria-label="Siguiente">›</button></div>`;

// ================================================================ gráficos SVG
function donut(items, center = '', sub = '') {
  const size = 200, stroke = 26, r = (size - stroke) / 2, C = 2 * Math.PI * r, cx = size / 2;
  const total = items.reduce((a, i) => a + Math.max(0, i.value), 0);
  let segs = `<circle r="${r}" cx="${cx}" cy="${cx}" fill="none" style="stroke:var(--track)" stroke-width="${stroke}"/>`;
  let off = 0;
  if (total > 0) {
    for (const it of items) {
      if (it.value <= 0) continue;
      const len = (it.value / total) * C;
      segs += `<circle r="${r}" cx="${cx}" cy="${cx}" fill="none" stroke="${it.color}" stroke-width="${stroke}" stroke-linecap="butt"
        stroke-dasharray="${Math.max(0, len - 3)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})"/>`;
      off += len;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img">${segs}
    <text x="${cx}" y="${cx + 4}" text-anchor="middle" class="d-big">${esc(center)}</text>
    <text x="${cx}" y="${cx + 24}" text-anchor="middle" class="d-sub">${esc(sub)}</text></svg>`;
}
function monthBars(months) {
  const W = 340, H = 160, bottom = 22, top = 8;
  const max = Math.max(1, ...months.map((s) => Math.max(s.inc, s.exp + s.inv)));
  const bw = W / 12;
  let g = '';
  months.forEach((s, i) => {
    const x = i * bw, w = bw * 0.3;
    const hi = ((H - top - bottom) * s.inc) / max, he = ((H - top - bottom) * (s.exp + s.inv)) / max;
    g += `<rect x="${x + bw * 0.17}" y="${H - bottom - hi}" width="${w}" height="${hi}" rx="3" style="fill:var(--pos)"/>`;
    g += `<rect x="${x + bw * 0.53}" y="${H - bottom - he}" width="${w}" height="${he}" rx="3" style="fill:var(--neg)"/>`;
    g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${MON3[i]}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg>
    <div class="chart-legend"><span><i style="background:var(--pos)"></i>Ingresos</span><span><i style="background:var(--neg)"></i>Gastos + inversión</span></div></div>`;
}
function spendLine(ym, limit) {
  const cum = (y) => {
    const n = daysInMonth(y), arr = Array(n).fill(0);
    for (const m of db.movements) {
      if (!isReal(m) || m.type !== 'expense' || !m.date.startsWith(y)) continue;
      const c = cat(m.catId); if (c && c.group === 'ahorro') continue;
      arr[+m.date.slice(8) - 1] += m.amount;
    }
    for (let i = 1; i < n; i++) arr[i] += arr[i - 1];
    return arr;
  };
  const a = cum(ym), b = cum(addMonths(ym, -1));
  const upto = ym === curYM() ? +today().slice(8) : a.length;
  const W = 340, H = 170, L = 4, B = 20, T = 10;
  const max = Math.max(1, a[a.length - 1], b[b.length - 1], limit || 0);
  const X = (i, n) => L + (i / Math.max(1, n - 1)) * (W - L * 2);
  const Y = (v) => H - B - (v / max) * (H - B - T);
  const pts = (arr, n) => arr.slice(0, n).map((v, i) => `${X(i, arr.length).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${X(0, a.length)},${Y(0)} ${pts(a, upto)} ${X(upto - 1, a.length)},${Y(0)}`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">
    ${limit > 0 ? `<line x1="${L}" y1="${Y(0)}" x2="${W - L}" y2="${Y(limit)}" style="stroke:var(--muted)" stroke-dasharray="5 5" stroke-width="1.5"/>` : ''}
    <polyline points="${pts(b, b.length)}" fill="none" style="stroke:var(--outline)" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="${area}" style="fill:var(--accent-soft)"/>
    <polyline points="${pts(a, upto)}" fill="none" style="stroke:var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <text x="${L}" y="${H - 4}">1</text><text x="${W - L}" y="${H - 4}" text-anchor="end">${a.length}</text></svg>
    <div class="chart-legend"><span><i style="background:var(--accent)"></i>Este mes</span><span><i style="background:var(--outline)"></i>Mes anterior</span>
    ${limit > 0 ? '<span><i style="background:var(--muted)"></i>Ritmo del presupuesto</span>' : ''}</div></div>`;
}
function catDonutItems(byCat) {
  return Object.entries(byCat).map(([id, v]) => ({ c: cat(id), v }))
    .filter((r) => r.c && r.c.group !== 'ahorro').sort((a, b) => b.v - a.v).map((r) => ({ value: r.v, color: r.c.color }));
}
function categoryLegend(byCat, bySub, total) {
  const rows = Object.entries(byCat).map(([id, v]) => ({ c: cat(id), id, v }))
    .filter((r) => r.c && r.c.group !== 'ahorro' && r.v > 0).sort((a, b) => b.v - a.v);
  if (!rows.length) return '<p class="muted center">Sin gastos en este periodo.</p>';
  return `<div class="legend">${rows.map(({ c, id, v }) => {
    const subs = Object.entries(bySub).filter(([k]) => k.startsWith(id + '|'))
      .map(([k, val]) => ({ name: k.slice(id.length + 1) || 'Sin subcategoría', val })).sort((a, b) => b.val - a.val);
    return `<details><summary>${ico(c)}<span class="grow"><span class="t">${esc(c.name)}</span>${bar(v / total, c.color)}</span>
      <span class="r"><b class="num">${eur(v)}</b><span class="pct">${pct(v / total)}</span></span></summary>
      <div class="subs">${subs.map((s) => `<div class="line"><span>${esc(s.name)}</span><b class="num">${eur(s.val)}</b></div>`).join('')}</div></details>`;
  }).join('')}</div>`;
}
function splitCard(s) {
  const saving = Math.max(0, s.saving);
  const base = s.inc > 0 ? s.inc : s.exp + s.inv;
  const parts = [
    { k: 'necesario', v: s.byGroup.necesario },
    { k: 'ocio', v: s.byGroup.ocio },
    { k: 'ahorro', v: saving, note: s.inv > 0 ? `incluye ${eur(s.inv)} invertidos` : '' },
  ];
  const sum = parts.reduce((a, p) => a + p.v, 0) || 1;
  return `<div class="card"><h2>Necesarios · Ocio · Ahorro</h2>
    <div class="split-bar">${parts.map((p) => `<i style="width:${(p.v / sum) * 100}%;background:${GROUPS[p.k].color}"></i>`).join('')}</div>
    ${parts.map((p) => `<div class="row item"><span class="cat-ico" style="--c:${GROUPS[p.k].color}">${GROUPS[p.k].icon}</span>
      <span class="grow"><span class="t">${GROUPS[p.k].name}</span>${p.note ? `<span class="s">${p.note}</span>` : ''}</span>
      <span class="r"><b class="num">${eur(p.v)}</b><span class="pct">${base > 0 ? pct(p.v / base) : '–'}</span></span></div>`).join('')}
    ${s.saving < 0 ? `<div class="warn">Has gastado ${eur(-s.saving)} más de lo que has ingresado.</div>` : ''}
    <p class="muted small">Porcentajes sobre los ingresos. El grupo de cada categoría se cambia en Más → Categorías.</p></div>`;
}
// Panel igual que «Ingresos y ahorro» del Excel
function excelPanel(s) {
  const ok = s.diff >= 0;
  return `<div class="card"><h2>Ingresos y ahorro</h2><div class="lines">
    <div class="line"><span>Ingreso principal</span><b>${eur(s.incP)}</b></div>
    <div class="line"><span>Ingresos secundarios</span><b>${eur(s.incS)}</b></div>
    <div class="line strong"><span>Ingresos totales</span><b class="pos">${eur(s.inc)}</b></div>
    <div class="line strong"><span>Gastos totales</span><b class="neg">${eur(s.exp)}</b></div>
    <div class="line"><span>Inversión</span><b>${eur(s.inv)}</b></div>
    <div class="line"><span>Ahorro objetivo (${Math.round(db.settings.savingsTarget * 100)}%)</span><b>${eur(s.target)}</b></div>
    <div class="line"><span>Ahorro real</span><b>${eur(s.saving)} · ${pct(s.rate)}</b></div></div>
    <div class="diff ${ok ? 'good' : 'bad'}"><span>Diferencia vs objetivo</span><b>${signed(s.diff)}</b></div></div>`;
}

function txRow(m) {
  const c = cat(m.catId);
  const tr = m.type === 'transfer';
  const inc = m.type === 'income';
  const a = account(m.accountId), to = account(m.toAccountId);
  const sel = ui.select ? `<span class="tick ${ui.selected.has(m.id) ? 'on' : ''}">${ui.selected.has(m.id) ? '✓' : ''}</span>` : '';
  const title = tr ? 'Transferencia' : m.desc || m.sub || (c ? c.name : '');
  const sub = tr ? `${a ? a.name : '?'} → ${to ? to.name : '?'}` : `${c ? c.name : 'Sin categoría'}${m.sub ? ' · ' + m.sub : ''}`;
  return `<button class="tx ${m.pending ? 'pending' : ''}" data-action="${ui.select ? 'toggle-sel' : 'edit-mov'}" data-id="${m.id}">${sel}
    ${tr ? '<span class="cat-ico" style="--c:#5b8def">⇄</span>' : ico(c)}
    <span class="grow"><span class="t">${esc(title)}${m.recurringId ? ' <span class="badge">↻</span>' : ''}${m.pending ? ' <span class="badge warnb">Pendiente</span>' : ''}</span>
    <span class="s">${esc(sub)}</span></span>
    <span class="a ${tr ? '' : inc ? 'pos' : ''}">${tr ? '' : inc ? '+' : '−'}${eur(m.amount)}</span></button>`;
}

// ================================================================ INICIO
function viewHome() {
  const s = monthStats(curYM());
  const h = db.settings.home;
  const b = db.budgets[0];
  const bs = b ? budgetStatus(b) : null;
  const pend = pendingMovs().filter((m) => m.date <= today());
  const up = upcoming(14);
  const plan = goalPlan();
  const goals = [...db.goals].sort((a, b) => a.order - b.order).filter((g) => (plan.res[g.id]?.saved || 0) < g.target).slice(0, 3);
  const recent = db.movements.filter((m) => !m.pending).sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created)).slice(0, 6);
  const name = db.settings.playerName;
  const hour = new Date().getHours();
  const hello = hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  let html = `<div class="hello"><span class="muted">${hello}${name ? ',' : ''}</span><h1>${name ? esc(name) : 'Resumen'}</h1></div>
    <div class="acc-pills">${db.accounts.map((a) => `<button class="acc-pill" data-action="sub-go" data-sub="accounts"><span>${a.icon}</span>
      <span><small>${esc(a.name)}</small><b>${eur(accountBalance(a))}</b></span></button>`).join('')}</div>
    <div class="io">
      <div class="io-card"><span class="io-ico pos">↓</span><span><small>Ingresos</small><b>${eur(s.inc)}</b></span></div>
      <div class="io-card"><span class="io-ico neg">↑</span><span><small>Gastos</small><b>${eur(s.exp)}</b></span></div></div>
    <div class="card net"><span class="muted">Total neto · ${MONTHS[+curYM().slice(5) - 1].toLowerCase()}</span><b class="${s.balance >= 0 ? 'pos' : 'neg'}">${signed(s.balance)}</b></div>`;

  if (h.budget && bs) {
    const used = bs.limit > 0 ? bs.spent / bs.limit : 0;
    html += `<button class="card budget-card" data-action="nav" data-v="budgets"><div class="row between"><span class="t">${esc(b.icon)} ${esc(b.name)}</span><span class="muted small">${bs.daysLeft} días restantes</span></div>
      ${bs.limit > 0 ? `<div class="bud-amt"><b>${eur(Math.max(0, bs.left))}</b> <span class="muted">${bs.over ? 'de más' : 'restante'} de ${eur(bs.limit)}</span></div>
      ${bar(used, bs.over ? 'var(--neg)' : 'var(--accent)', Math.min(1, bs.elapsed / bs.total))}
      <p class="muted small">${bs.over ? `Te has pasado ${eur(-bs.left)}.` : `Puedes gastar ${eur(bs.perDay)} al día.`}
      ${!bs.over ? (bs.spent > bs.pace ? `Vas ${eur(bs.spent - bs.pace)} por encima del ritmo.` : `Vas ${eur(bs.pace - bs.spent)} por debajo del ritmo.`) : ''}</p>`
        : `<p class="muted small">${b.auto ? `Se calcula con tus ingresos del mes: lo que puedes gastar para ahorrar el ${Math.round(db.settings.savingsTarget * 100)}%. Añade tu nómina.` : 'Pon un límite en Presupuestos.'}</p>`}</button>`;
  }
  if (h.saving) {
    const ok = s.diff >= 0;
    html += `<div class="card"><div class="row between"><h2>Ahorro del mes</h2><span class="muted small">objetivo ${Math.round(db.settings.savingsTarget * 100)}%</span></div>
      ${bar(s.inc > 0 ? s.rate : 0, ok ? 'var(--pos)' : 'var(--neg)', db.settings.savingsTarget)}
      <div class="line"><span>Ahorrado ${eur(s.saving)} (${pct(s.rate)})</span><span class="muted">objetivo ${eur(s.target)}</span></div>
      ${s.inc || s.exp ? `<div class="diff ${ok ? 'good' : 'bad'}"><span>${ok ? 'Por encima del objetivo' : 'Por debajo del objetivo'}</span><b>${signed(s.diff)}</b></div>` : ''}</div>`;
  }
  if (h.spending && s.exp > 0) {
    html += `<div class="card"><div class="row between"><h2>Gastos</h2><button class="link" data-action="sub-go" data-sub="stats">Ver todo</button></div>
      ${spendLine(curYM(), bs ? bs.limit : 0)}</div>`;
  }
  if (h.upcoming && (pend.length || up.length)) {
    html += `<div class="card"><h2>Próximos pagos</h2>
      ${pend.map((m) => `<div class="row item">${ico(cat(m.catId))}<span class="grow"><span class="t">${esc(m.desc || cat(m.catId)?.name)}</span><span class="s">${eur(m.amount)} · ${shortDate(m.date)} · por pagar</span></span>
        <button class="tonal" data-action="pay" data-id="${m.id}">Pagar</button><button class="icon-x" data-action="skip" data-id="${m.id}" aria-label="Saltar">✕</button></div>`).join('')}
      ${up.map(({ r, date }) => `<div class="row item">${ico(cat(r.catId))}<span class="grow"><span class="t">${esc(r.desc)}</span><span class="s">${shortDate(date)} · ${FREQS[r.freq].toLowerCase()}</span></span>
        <b class="num">${eur(r.amount)}</b></div>`).join('')}</div>`;
  }
  if (h.goals && goals.length) {
    html += `<div class="card"><div class="row between"><h2>Objetivos</h2><button class="link" data-action="nav" data-v="goals">Ver todo</button></div>
      ${goals.map((g) => { const sv = plan.res[g.id]?.saved || 0; return `<div class="row item">${ico({ icon: g.icon, color: 'var(--accent)' })}
        <span class="grow"><span class="t">${esc(g.name)}</span>${bar(sv / g.target)}</span><span class="r"><b class="num">${pct(sv / g.target)}</b><span class="pct">${eur(sv)}</span></span></div>`; }).join('')}</div>`;
  }
  if (h.recent) {
    html += `<div class="card"><div class="row between"><h2>Recientes</h2><button class="link" data-action="nav" data-v="tx">Ver todo</button></div>
      ${recent.length ? recent.map(txRow).join('') : empty('🪙', 'Aún no hay transacciones.<br>Pulsa <b>+</b> para añadir la primera.')}</div>`;
  }
  return html;
}

// ================================================================ TRANSACCIONES
function filteredMovs() {
  const q = norm(ui.q);
  return db.movements.filter((m) => {
    if (!m.date.startsWith(ui.ym)) return false;
    if (ui.filter === 'pending' ? !m.pending : ui.filter !== 'all' && m.type !== ui.filter) return false;
    if (ui.fCat && m.catId !== ui.fCat) return false;
    if (ui.fAcc && m.accountId !== ui.fAcc && m.toAccountId !== ui.fAcc) return false;
    if (q) { const c = cat(m.catId); return [m.desc, m.sub, m.note, c && c.name, String(m.amount).replace('.', ',')].some((t) => norm(t).includes(q)); }
    return true;
  }).sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created));
}
function viewTx() {
  const movs = filteredMovs();
  const days = {};
  movs.forEach((m) => (days[m.date] = days[m.date] || []).push(m));
  const dayTotal = (list) => list.reduce((a, m) => a + (!isReal(m) ? 0 : m.type === 'income' ? m.amount : -m.amount), 0);
  const s = monthStats(ui.ym);
  return `${monthChips('pick-month', ui.ym)}
  <div class="io small-io">
    <div class="io-card"><span class="io-ico pos">↓</span><span><small>Ingresos</small><b>${eur(s.inc)}</b></span></div>
    <div class="io-card"><span class="io-ico neg">↑</span><span><small>Gastos</small><b>${eur(s.exp)}</b></span></div></div>
  <div class="searchbox"><span>🔍</span><input id="search" type="search" placeholder="Buscar transacciones" value="${esc(ui.q)}"></div>
  <div class="chips scroll">
    ${[['all', 'Todo'], ['expense', 'Gastos'], ['income', 'Ingresos'], ['transfer', 'Transferencias'], ['pending', 'Pendientes']]
      .map(([k, l]) => `<button class="chip ${ui.filter === k ? 'on' : ''}" data-action="filter" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="filters">
    <select class="input" data-filter="fCat"><option value="">Todas las categorías</option>
      ${db.categories.map((c) => `<option value="${c.id}" ${ui.fCat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select>
    <select class="input" data-filter="fAcc"><option value="">Todas las cuentas</option>
      ${db.accounts.map((a) => `<option value="${a.id}" ${ui.fAcc === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select></div>
  <div class="row between toolbar"><span class="muted small">${movs.length} transacciones · ${signed(dayTotal(movs))}</span>
    <button class="link" data-action="select-mode">${ui.select ? 'Cancelar' : 'Seleccionar'}</button></div>
  ${ui.select ? `<div class="selbar"><span>${ui.selected.size} seleccionadas</span>
    <button class="tonal" data-action="sel-all">Todas</button><button class="tonal" data-action="sel-cat" ${ui.selected.size ? '' : 'disabled'}>Categoría</button>
    <button class="tonal danger" data-action="sel-del" ${ui.selected.size ? '' : 'disabled'}>Borrar</button></div>` : ''}
  ${movs.length ? Object.entries(days).map(([d, list]) => `<div class="day"><span>${esc(dateLabel(d))}</span><span>${signed(dayTotal(list))}</span></div>
    <div class="group">${list.map(txRow).join('')}</div>`).join('')
    : empty('🔍', 'No hay transacciones con estos filtros.')}`;
}

// ================================================================ PRESUPUESTOS
function viewBudgets() {
  return db.budgets.map((b) => {
    const s = budgetStatus(b);
    const used = s.limit > 0 ? s.spent / s.limit : 0;
    const limits = Object.entries(b.catLimits || {}).filter(([, v]) => v > 0);
    const hist = b.period === 'custom' ? [] : Array.from({ length: 5 }, (_, i) => {
      const ref = b.period === 'week' ? addDays(today(), -7 * (i + 1)) : `${addMonths(curYM(), -(i + 1))}-15`;
      return budgetStatus(b, ref);
    }).filter((h) => h.limit > 0 || h.spent > 0);
    const perLabel = b.period === 'month' ? 'Mensual' : b.period === 'week' ? 'Semanal' : `${shortDate(s.from)} – ${shortDate(s.to)}`;
    return `<div class="card bcard">
      <div class="bhead"><span class="bico">${esc(b.icon)}</span><div class="grow"><div class="t big">${esc(b.name)}</div>
        <div class="s">${perLabel} · ${b.cats.length ? b.cats.length + ' categorías' : 'todas las categorías'}${b.auto ? ` · automático` : ''}</div></div>
        <button class="icon-btn" data-action="edit-budget" data-id="${b.id}" aria-label="Editar">✎</button></div>
      <div class="bud-amt"><b>${eur(Math.max(0, s.left))}</b> <span class="muted">${s.over ? 'de más' : 'restante'} de ${eur(s.limit)}</span></div>
      ${bar(used, s.over ? 'var(--neg)' : 'var(--accent)', s.total ? Math.min(1, s.elapsed / s.total) : undefined)}
      <div class="line small muted"><span>${shortDate(s.from)}</span><span>${s.ended ? 'Terminado' : `${s.daysLeft} días restantes`}</span><span>${shortDate(s.to)}</span></div>
      ${!s.ended && s.limit > 0 && !s.over ? `<p class="small">Puedes gastar <b>${eur(s.perDay)}</b> al día. ${s.spent > s.pace ? `<span class="neg">Vas ${eur(s.spent - s.pace)} por encima del ritmo.</span>` : `<span class="pos">Vas ${eur(s.pace - s.spent)} por debajo del ritmo.</span>`}</p>` : ''}
      ${s.over ? `<div class="warn">Te has pasado ${eur(-s.left)} del presupuesto.</div>` : ''}
      ${limits.length ? `<div class="label">Límites por categoría</div>${limits.map(([id, lim]) => { const c = cat(id); if (!c) return ''; const sp = s.byCat[id] || 0;
        return `<div class="row item">${ico(c)}<span class="grow"><span class="t">${esc(c.name)}</span>${bar(sp / lim, sp > lim ? 'var(--neg)' : c.color)}</span>
          <span class="r"><b class="num ${sp > lim ? 'neg' : ''}">${eur(sp)}</b><span class="pct">de ${eur(lim)}</span></span></div>`; }).join('')}` : ''}
      ${hist.length ? `<details class="hist"><summary>Historial</summary>${hist.map((h) => `<div class="line"><span>${b.period === 'week' ? shortDate(h.from) : ymLabel(h.from.slice(0, 7))}</span>
        <b class="${h.over ? 'neg' : 'pos'}">${eur(h.spent)} / ${eur(h.limit)}</b></div>`).join('')}</details>` : ''}</div>`;
  }).join('') + `<button class="btn tonal-btn" data-action="new-budget">+ Añadir presupuesto</button>
    <p class="muted small center">El primero es el que se muestra en Inicio. Crea otro para un viaje con fechas personalizadas.</p>`;
}

// ================================================================ OBJETIVOS
function viewGoals() {
  const plan = goalPlan();
  const goals = [...db.goals].sort((a, b) => a.order - b.order);
  const m = plan.months[curYM()];
  const total = goals.reduce((a, g) => a + (plan.res[g.id]?.saved || 0), 0);
  return `${goals.length ? `<div class="card net"><span class="muted">Ahorrado en objetivos</span><b>${eur(total)}</b>
      ${m ? `<span class="muted small">Este mes: ${eur(m.given)} de ${eur(m.planned)} previstos · balance libre ${eur(m.avail)}</span>` : ''}</div>` : ''}
    ${goals.length ? goals.map((g, i) => goalCard(g, plan.res[g.id], i, goals.length)).join('')
      : empty('🎯', 'Crea un objetivo de ahorro: coche nuevo, móvil, reforma, entrada de la hipoteca…')}
    <button class="btn tonal-btn" data-action="new-goal">+ Añadir objetivo</button>
    <p class="muted small center">Cada mes se aparta a cada objetivo su cantidad del balance libre (ingresos − gastos − inversión). Si no llega, se aparta lo que haya, empezando por el de arriba.</p>`;
}
function goalCard(g, r, i, n) {
  const saved = r ? r.saved : g.initial || 0;
  const left = Math.max(0, g.target - saved);
  const done = left <= 0;
  const months = g.monthly > 0 ? Math.ceil(left / g.monthly) : Infinity;
  const eta = done ? 'Completado' : isFinite(months) ? `${months} ${months === 1 ? 'mes' : 'meses'} · ${ymLabel(addMonths(curYM(), months))}` : 'Sin aportación mensual';
  const thisM = r && r.byMonth[curYM()];
  const want = Math.min(g.monthly, left + (thisM || 0));
  const p = Math.min(1, saved / g.target);
  const R = 30, C = 2 * Math.PI * R;
  return `<div class="card goal">
    <div class="row"><div class="ring"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="${R}" fill="none" style="stroke:var(--track)" stroke-width="7"/>
      <circle cx="36" cy="36" r="${R}" fill="none" style="stroke:${done ? 'var(--pos)' : 'var(--accent)'}" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${p * C} ${C}" transform="rotate(-90 36 36)"/></svg><span>${g.icon}</span></div>
      <div class="grow"><div class="t big">${esc(g.name)}${g.paused ? ' <span class="badge">En pausa</span>' : ''}</div>
        <div class="s">${eur(saved)} de ${eur(g.target)} · ${pct(p)}</div><div class="s">${eur(g.monthly)}/mes · ${eta}</div></div></div>
    ${!done && !g.paused && thisM !== undefined && thisM < want ? `<div class="warn">Este mes el balance solo da para ${eur(thisM)} de ${eur(want)}.</div>` : ''}
    <div class="actions"><button class="tonal" data-action="edit-goal" data-id="${g.id}">Editar</button>
      <button class="icon-btn" data-action="goal-up" data-id="${g.id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir prioridad">↑</button>
      <button class="icon-btn" data-action="goal-down" data-id="${g.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Bajar prioridad">↓</button></div></div>`;
}

// ================================================================ MÁS
function viewMore() {
  const subs = { stats: viewStats, excel: viewExcel, import: viewImport, recurring: viewRecurring, loans: viewLoans, accounts: viewAccounts, cats: viewCats, settings: viewSettings };
  if (ui.sub && subs[ui.sub]) return subs[ui.sub]();
  const it = (sub, icon, t, d) => `<button class="menu-row" data-action="sub" data-sub="${sub}"><span class="menu-ico">${icon}</span>
    <span class="grow"><span class="t">${t}</span><span class="s">${d}</span></span><span class="chev">›</span></button>`;
  return `<div class="card list">
    ${it('stats', '📊', 'Todos los gastos', 'Gráficos del mes y del año')}
    ${it('excel', '📋', 'Pasar al Excel', 'Copia el mes y pégalo en tu Excel')}
    ${it('import', '📥', 'Importar del Excel', 'Trae movimientos desde el Excel')}</div>
  <div class="card list">
    ${it('recurring', '↻', 'Suscripciones', 'Pagos recurrentes y próximos')}
    ${it('loans', '🤝', 'Préstamos y deudas', 'Lo que te deben y lo que debes')}
    ${it('accounts', '🏦', 'Cuentas', 'Banco, efectivo, transferencias')}
    ${it('cats', '🏷️', 'Categorías', 'Iconos, grupos y categorías propias')}</div>
  <div class="card list">${it('settings', '⚙️', 'Ajustes', 'Tema, color, objetivo, PIN y copia de seguridad')}</div>
  ${installCard()}
  <p class="muted small center">Tus datos se guardan solo en este móvil. Haz una copia de seguridad de vez en cuando.</p>`;
}
function installCard() {
  if (window.matchMedia('(display-mode: standalone)').matches) return '';
  return `<div class="card"><h2>Instalar Cointrol Clásico</h2>${deferredInstall ? '<button class="btn" data-action="install">Instalar app</button>'
    : '<p class="muted small">En Chrome: menú ⋮ → <b>Instalar aplicación</b>.</p>'}</div>`;
}

// ---- Todos los gastos
function viewStats() {
  const top = seg([['month', 'Mes'], ['year', 'Año']], ui.statsMode, 'stats-mode');
  if (ui.statsMode === 'year') {
    const y = yearStats(ui.year);
    const rows = y.months.map((s, i) => (s.movs.length ? `<tr><td>${MON3[i]}</td><td class="pos">${eur(s.inc)}</td><td>${eur(s.exp)}</td>
      <td class="${s.diff >= 0 ? 'pos' : 'neg'}">${eur(s.saving)}</td></tr>` : '')).join('');
    return `${top}${periodNav(String(ui.year), 'year')}${excelPanel(y)}
      <div class="card"><h2>Mes a mes</h2>${monthBars(y.months)}</div>
      <div class="card"><h2>Gastos del año</h2><div class="chart-wrap">${donut(catDonutItems(y.byCat), eur(y.exp), 'gastado')}</div>${categoryLegend(y.byCat, y.bySub, y.exp || 1)}</div>
      ${splitCard(y)}
      ${rows ? `<div class="card"><h2>Por meses</h2><table class="tbl"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Ahorro</th></tr></thead>
        <tbody>${rows}<tr class="total"><td>Total</td><td>${eur(y.inc)}</td><td>${eur(y.exp)}</td><td class="${y.diff >= 0 ? 'pos' : 'neg'}">${eur(y.saving)}</td></tr></tbody></table>
        <p class="muted small">Ahorro en verde si llega al ${Math.round(db.settings.savingsTarget * 100)}% de los ingresos.</p></div>` : ''}`;
  }
  const s = monthStats(ui.ym);
  const b = db.budgets[0];
  const lim = b ? budgetStatus(b, `${ui.ym}-15`).limit : 0;
  return `${top}${periodNav(ymLabel(ui.ym), 'month')}${excelPanel(s)}
    <div class="card"><h2>Por categoría</h2><div class="chart-wrap">${donut(catDonutItems(s.byCat), eur(s.exp), 'gastado')}</div>
      ${categoryLegend(s.byCat, s.bySub, s.exp || 1)}<p class="muted small">Toca una categoría para ver sus subcategorías.</p></div>
    <div class="card"><h2>Gasto acumulado</h2>${spendLine(ui.ym, lim)}</div>${splitCard(s)}`;
}

// ---- Pasar al Excel
function excelRows(ym) {
  const dec = db.settings.decimalComma;
  const num = (n) => { const s = round2(n).toFixed(2); return dec ? s.replace('.', ',') : s; };
  const real = db.movements.filter((m) => isReal(m) && m.date.startsWith(ym));
  const exp = real.filter((m) => m.type === 'expense').sort((a, b) => (a.date + a.created).localeCompare(b.date + b.created))
    .map((m) => { const c = cat(m.catId); return [ddmmyyyy(m.date), num(m.amount), m.desc || '', c ? c.name : '', m.sub || '']; });
  const incs = real.filter((m) => m.type === 'income');
  const principal = incs.filter((m) => cat(m.catId)?.principal).reduce((a, m) => a + m.amount, 0);
  let sec = incs.filter((m) => !cat(m.catId)?.principal).map((m) => [m.desc || m.sub || cat(m.catId)?.name || 'Ingreso', m.amount]);
  // El Excel tiene 4 filas para ingresos secundarios: si hay más, las últimas se agrupan.
  if (sec.length > 4) sec = [...sec.slice(0, 3), ['Otros ingresos', sec.slice(3).reduce((a, r) => a + r[1], 0)]];
  return { exp, principal, sec: sec.map(([c, v]) => [c, num(v)]), num };
}
const cleanCell = (s) => String(s).replace(/[\t\r\n]+/g, ' ');
const tsv = (rows) => rows.map((r) => r.map(cleanCell).join('\t')).join('\n');
const XL_HEAD = ['Fecha', 'Importe', 'Descripción', 'Categoría', 'Subcategoría'];
function viewExcel() {
  const { exp, principal, sec, num } = excelRows(ui.exYM);
  const custom = [...new Set(exp.map((r) => r[3]).filter((n) => n && !EXCEL_NAMES.has(n)))];
  return `${periodNav(ymLabel(ui.exYM), 'exmonth')}
  <div class="card"><h2>1 · Gastos <span class="muted small">${exp.length} filas</span></h2>
    <div class="xl-wrap"><table class="xl"><thead><tr>${XL_HEAD.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${exp.length ? exp.map((r) => `<tr><td>${esc(r[0])}</td><td class="r">${esc(r[1])} €</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join('')
      : '<tr><td colspan="5" class="c">Sin gastos este mes</td></tr>'}</tbody></table></div>
    <button class="btn" data-action="copy-exp" ${exp.length ? '' : 'disabled'}>Copiar gastos</button>
    <ol class="steps"><li>En el Excel, clic en la celda <code>B23</code>.</li><li>Pega (Ctrl+V): se rellenan Fecha, Importe, Descripción, Categoría y Subcategoría.</li></ol>
    ${custom.length ? `<div class="warn">${custom.map(esc).join(', ')} no existe${custom.length > 1 ? 'n' : ''} en el Excel. Añáde${custom.length > 1 ? 'las' : 'la'} en su hoja «Listas» para que sume${custom.length > 1 ? 'n' : ''} en los totales.</div>` : ''}</div>
  <div class="card"><h2>2 · Ingreso principal</h2><div class="line"><span>Nómina</span><b>${eur(principal)}</b></div>
    <button class="btn tonal-btn" data-action="copy-principal" ${principal ? '' : 'disabled'}>Copiar ingreso principal</button>
    <ol class="steps"><li>Pega en la celda <code>C5</code>.</li></ol></div>
  <div class="card"><h2>3 · Ingresos secundarios <span class="muted small">${sec.length} filas</span></h2>
    ${sec.length ? `<div class="xl-wrap"><table class="xl"><tbody>${sec.map((r) => `<tr><td>${esc(r[0])}</td><td class="r">${esc(r[1])} €</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin ingresos secundarios este mes.</p>'}
    <button class="btn tonal-btn" data-action="copy-sec" ${sec.length ? '' : 'disabled'}>Copiar ingresos secundarios</button>
    <ol class="steps"><li>Pega en la celda <code>B7</code> (hasta 4 filas).</li></ol></div>
  <div class="card"><h2>Opciones</h2>
    <label class="switch"><span>Decimales con coma (Excel en español)</span><input type="checkbox" data-setting="decimalComma" ${db.settings.decimalComma ? 'checked' : ''}></label>
    <label class="switch"><span>Incluir fila de títulos al copiar gastos</span><input type="checkbox" data-setting="xlHeader" ${db.settings.xlHeader ? 'checked' : ''}></label>
    <button class="btn tonal-btn" data-action="csv">Descargar gastos en .csv</button>
    <p class="muted small">Así se copia un importe: ${esc(num(12.5))}. Los pendientes y las transferencias no se copian.</p></div>`;
}

// ---- Importar del Excel
function viewImport() {
  const hasGame = (() => { try { return !!localStorage.getItem(GAME_KEY); } catch { return false; } })();
  return `<div class="card"><h2>Importar del Excel</h2>
    <p class="muted small">Selecciona en el Excel las filas de la tabla de movimientos (de <code>B</code> a <code>F</code>: Fecha, Importe, Descripción, Categoría, Subcategoría), cópialas y pégalas aquí.</p>
    <textarea class="input" id="imp-text" rows="7" placeholder="01/11/2026	27,00	gym	DEPORTE	Gimnasio"></textarea>
    <div class="field"><label>Cuenta</label><select class="input" id="imp-acc">${db.accounts.map((a) => `<option value="${a.id}">${a.icon} ${esc(a.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Fecha si falta</label><input class="input" id="imp-date" type="date" value="${today()}"></div>
    <button class="btn" data-action="imp-preview">Revisar</button><div id="imp-out"></div></div>
  ${hasGame ? `<div class="card"><h2>Traer datos de Cointrol (versión juego)</h2>
    <p class="muted small">En este móvil hay datos de la otra versión de Cointrol. Puedes copiarlos aquí; sustituirán los de esta app.</p>
    <button class="btn tonal-btn" data-action="import-game">Copiar datos de la versión juego</button></div>` : ''}`;
}

// ---- Suscripciones
function viewRecurring() {
  const act = db.recurring.filter((r) => r.active);
  const monthly = act.filter((r) => r.type === 'expense').reduce((a, r) => a + monthlyCost(r), 0);
  const pend = pendingMovs();
  return `<div class="io"><div class="io-card"><span class="io-ico neg">↻</span><span><small>Al mes</small><b>${eur(monthly)}</b></span></div>
      <div class="io-card"><span class="io-ico neg">↻</span><span><small>Al año</small><b>${eur(monthly * 12)}</b></span></div></div>
    <p class="muted small" style="margin:0 4px 14px">Las automáticas se apuntan solas el día que tocan. Las demás aparecen en Inicio como «por pagar».</p>
    ${pend.length ? `<div class="card"><h2>Por pagar</h2>${pend.map((m) => `<div class="row item">${ico(cat(m.catId))}<span class="grow"><span class="t">${esc(m.desc)}</span><span class="s">${eur(m.amount)} · ${shortDate(m.date)}</span></span>
      <button class="tonal" data-action="pay" data-id="${m.id}">Pagar</button><button class="icon-x" data-action="skip" data-id="${m.id}" aria-label="Saltar">✕</button></div>`).join('')}</div>` : ''}
    ${db.recurring.length ? `<div class="group">${db.recurring.map((r) => `<button class="tx ${r.active ? '' : 'off'}" data-action="edit-rec" data-id="${r.id}">${ico(cat(r.catId))}
      <span class="grow"><span class="t">${esc(r.desc)}${r.active ? '' : ' <span class="badge">Parada</span>'}</span><span class="s">${FREQS[r.freq]} · próximo ${shortDate(r.next)}${r.auto ? ' · automática' : ''}</span></span>
      <span class="a ${r.type === 'income' ? 'pos' : ''}">${eur(r.amount)}</span></button>`).join('')}</div>` : empty('↻', 'Añade el gimnasio, Spotify, el bono bus, la nómina…')}
    <button class="btn tonal-btn" data-action="new-rec">+ Añadir suscripción o pago fijo</button>`;
}

// ---- Préstamos
function viewLoans() {
  const open = db.loans.filter((l) => loanLeft(l) > 0);
  const owedToMe = open.filter((l) => l.dir === 'lent').reduce((a, l) => a + loanLeft(l), 0);
  const iOwe = open.filter((l) => l.dir === 'borrowed').reduce((a, l) => a + loanLeft(l), 0);
  const row = (l) => {
    const left = loanLeft(l);
    return `<button class="tx ${left <= 0 ? 'off' : ''}" data-action="edit-loan" data-id="${l.id}"><span class="cat-ico" style="--c:${l.dir === 'lent' ? '#2e9e5b' : '#d64545'}">${l.dir === 'lent' ? '🤝' : '🧾'}</span>
      <span class="grow"><span class="t">${esc(l.person)}${left <= 0 ? ' <span class="badge">Saldado</span>' : ''}</span>
      <span class="s">${l.dir === 'lent' ? 'Te debe' : 'Le debes'} · ${shortDate(l.date)}${l.note ? ' · ' + esc(l.note) : ''}</span></span>
      <span class="a ${l.dir === 'lent' ? 'pos' : 'neg'}">${eur(left)}</span></button>`;
  };
  return `<div class="io"><div class="io-card"><span class="io-ico pos">↓</span><span><small>Te deben</small><b>${eur(owedToMe)}</b></span></div>
      <div class="io-card"><span class="io-ico neg">↑</span><span><small>Debes</small><b>${eur(iOwe)}</b></span></div></div>
    <p class="muted small" style="margin:0 4px 14px">Los préstamos no cuentan como gasto ni como ingreso, así no descuadran el ahorro del mes.</p>
    ${db.loans.length ? `<div class="group">${db.loans.slice().sort((a, b) => (loanLeft(b) > 0) - (loanLeft(a) > 0) || b.date.localeCompare(a.date)).map(row).join('')}</div>` : empty('🤝', 'Apunta lo que prestas o te prestan.')}
    <button class="btn tonal-btn" data-action="new-loan">+ Añadir préstamo o deuda</button>`;
}

// ---- Cuentas
function viewAccounts() {
  return `<div class="card net"><span class="muted">Total en cuentas</span><b>${eur(db.accounts.reduce((s, a) => s + accountBalance(a), 0))}</b></div>
    <div class="group">${db.accounts.map((a) => `<button class="tx" data-action="edit-acc" data-id="${a.id}"><span class="cat-ico" style="--c:${a.color}">${a.icon}</span>
      <span class="grow"><span class="t">${esc(a.name)}</span><span class="s">Saldo inicial ${eur(a.initial)}</span></span>
      <span class="a">${eur(accountBalance(a))}</span></button>`).join('')}</div>
    <button class="btn tonal-btn" data-action="new-acc">+ Añadir cuenta</button>
    <button class="btn tonal-btn" data-action="new-transfer">⇄ Transferir entre cuentas</button>
    <p class="muted small center">Pon en cada cuenta el saldo que tenía antes de empezar a usar la app para que cuadre con el banco.</p>`;
}

// ---- Categorías
function viewCats() {
  const list = (kind) => `<div class="group">${catsOf(kind).map((c) => `<button class="tx" data-action="edit-cat" data-id="${c.id}">${ico(c)}
    <span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${kind === 'expense' ? GROUPS[c.group].name : c.principal ? 'Ingreso principal' : 'Ingreso secundario'} · ${c.subs.length} subcategorías</span></span><span class="chev">›</span></button>`).join('')}</div>`;
  return `<div class="label">Gastos</div>${list('expense')}<div class="label">Ingresos</div>${list('income')}
    <button class="btn tonal-btn" data-action="new-cat">+ Añadir categoría</button>`;
}

// ---- Ajustes
const ACCENTS = ['#7cb82f', '#2e9e5b', '#1e88e5', '#5b6ee1', '#8e5cd9', '#d81b60', '#e65100', '#f4a300', '#00897b', '#546e7a'];
function viewSettings() {
  const s = db.settings;
  const homeOpts = [['budget', 'Presupuesto'], ['saving', 'Ahorro del mes'], ['spending', 'Gráfico de gastos'], ['upcoming', 'Próximos pagos'], ['goals', 'Objetivos'], ['recent', 'Recientes']];
  return `<div class="card"><h2>Apariencia</h2>
    <div class="field"><span class="label">Tema</span>${seg([['auto', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']], s.theme, 'theme')}</div>
    <div class="field"><span class="label">Color de acento</span><div class="swatches">${ACCENTS.map((c) => `<button type="button" class="${c === s.accent ? 'on' : ''}" style="background:${c}" data-action="accent" data-v="${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="field"><label>Tu nombre (para el saludo)</label><div class="row"><input class="input grow" id="set-name" maxlength="20" value="${esc(s.playerName)}"><button class="tonal" data-action="save-name">Guardar</button></div></div></div>
  <div class="card"><h2>Objetivo de ahorro</h2>
    <div class="row"><input class="input" id="target" type="number" inputmode="numeric" min="0" max="100" step="1" value="${Math.round(s.savingsTarget * 100)}" style="max-width:100px">
    <span class="grow">% de los ingresos de cada mes</span><button class="tonal" data-action="save-target">Guardar</button></div></div>
  <div class="card"><h2>Pantalla de inicio</h2>${homeOpts.map(([k, l]) => `<label class="switch"><span>${l}</span><input type="checkbox" data-home="${k}" ${s.home[k] ? 'checked' : ''}></label>`).join('')}</div>
  <div class="card"><h2>Seguridad</h2><p class="muted small">Pide un PIN de 4 cifras al abrir la app.</p>
    ${s.pinHash ? '<button class="btn tonal-btn" data-action="pin-off">Quitar PIN</button>' : '<button class="btn tonal-btn" data-action="pin-on">Poner PIN</button>'}</div>
  <div class="card"><h2>Copia de seguridad</h2>
    <p class="muted small">${db.movements.length} transacciones, ${db.goals.length} objetivos, ${db.categories.length} categorías. Guarda la copia en Drive o en tu correo.</p>
    <button class="btn" data-action="backup">Exportar copia (.json)</button><button class="btn tonal-btn" data-action="restore">Importar copia</button>
    <input type="file" id="restore-file" accept="application/json,.json" hidden></div>
  <div class="card"><h2>Datos</h2><button class="btn danger" data-action="wipe">Borrar todos los datos</button></div>
  <p class="center muted small">Cointrol Clásico · versión 1.0</p>`;
}
