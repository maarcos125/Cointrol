'use strict';
/* Cointrol · pantallas y gráficos. */

const ui = {
  view: 'base', ym: curYM(), statsMode: 'month', year: +today().slice(0, 4),
  filter: 'all', q: '', fCat: '', fAcc: '', select: false, selected: new Set(),
  sub: null, questTab: 'goals', exYM: curYM(),
};
const VIEW_TITLES = { base: 'Base', diario: 'Diario', stats: 'Estadísticas', misiones: 'Misiones', mochila: 'Mochila' };
const SUBTITLES = {
  excel: 'Pasar al Excel', import: 'Importar del Excel', budgets: 'Presupuestos', recurring: 'Recurrentes',
  loans: 'Préstamos y deudas', accounts: 'Cuentas', cats: 'Categorías', settings: 'Ajustes',
};

function render() {
  const views = { base: viewBase, diario: viewDiario, stats: viewStats, misiones: viewMisiones, mochila: viewMochila };
  $('#view').innerHTML = views[ui.view]();
  $('#title').textContent = ui.view === 'mochila' && ui.sub ? SUBTITLES[ui.sub] : VIEW_TITLES[ui.view];
  $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.nav === ui.view));
  $('#fab').hidden = !['base', 'diario'].includes(ui.view) || ui.select;
  renderHud();
}

// Barra superior: nivel y oro siempre visibles
function renderHud() {
  const p = player();
  const span = p.to - p.from;
  $('#hud').innerHTML = `<span class="hud-lv">NV${p.lv}</span>
    <span class="hud-xp"><i style="width:${Math.min(100, ((p.xp - p.from) / span) * 100)}%"></i></span>
    <span class="hud-gold">🪙 ${esc(eur(totalGold()).replace(/\s?€/, ''))}</span>`;
}

// ================================================================ piezas comunes
const ico = (c, size) => `<span class="cat-ico" style="--c:${c ? c.color : '#566c86'}${size ? `;--s:${size}px` : ''}">${c ? c.icon : '❔'}</span>`;
const periodNav = (label, action) => `<div class="period">
  <button class="icon-btn" data-action="${action}" data-d="-1" aria-label="Anterior">◀</button>
  <strong>${label}</strong>
  <button class="icon-btn" data-action="${action}" data-d="1" aria-label="Siguiente">▶</button></div>`;
const seg = (items, cur, action) => `<div class="seg">${items.map(([k, l]) =>
  `<button class="${cur === k ? 'on' : ''}" data-action="${action}" data-v="${k}">${l}</button>`).join('')}</div>`;
function pbar(frac, cls = '', mark) {
  const w = Math.max(0, Math.min(1, frac || 0)) * 100;
  return `<div class="pbar ${cls}"><i style="width:${w}%"></i>${mark !== undefined ? `<b class="mark" style="left:${Math.min(100, mark * 100)}%"></b>` : ''}</div>`;
}
const empty = (e, t) => `<div class="empty"><span class="e">${e}</span>${t}</div>`;

// ================================================================ gráficos SVG
function donut(items, center = '', sub = '') {
  const size = 200, stroke = 34, r = (size - stroke) / 2, C = 2 * Math.PI * r, cx = size / 2;
  const total = items.reduce((a, i) => a + Math.max(0, i.value), 0);
  let segs = `<circle r="${r}" cx="${cx}" cy="${cx}" fill="none" stroke="#333c57" stroke-width="${stroke}"/>`;
  let off = 0;
  if (total > 0) {
    for (const it of items) {
      if (it.value <= 0) continue;
      const len = (it.value / total) * C;
      segs += `<circle r="${r}" cx="${cx}" cy="${cx}" fill="none" stroke="${it.color}" stroke-width="${stroke}"
        stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})"/>`;
      off += len;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img">${segs}
    <text x="${cx}" y="${cx + 2}" text-anchor="middle" class="d-big">${esc(center)}</text>
    <text x="${cx}" y="${cx + 22}" text-anchor="middle" class="d-sub">${esc(sub)}</text></svg>`;
}
function monthBars(months) {
  const W = 340, H = 160, bottom = 22, top = 8;
  const max = Math.max(1, ...months.map((s) => Math.max(s.inc, s.exp + s.inv)));
  const bw = W / 12;
  let g = '';
  months.forEach((s, i) => {
    const x = i * bw, w = Math.floor(bw * 0.32);
    const hi = Math.round(((H - top - bottom) * s.inc) / max), he = Math.round(((H - top - bottom) * (s.exp + s.inv)) / max);
    g += `<rect x="${Math.round(x + bw * 0.14)}" y="${H - bottom - hi}" width="${w}" height="${hi}" fill="#38b764"/>`;
    g += `<rect x="${Math.round(x + bw * 0.52)}" y="${H - bottom - he}" width="${w}" height="${he}" fill="#b13e53"/>`;
    g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${MON3[i]}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
    <line x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}" stroke="#566c86"/>${g}</svg>
    <div class="chart-legend"><span><i style="background:#38b764"></i>Ingresos</span><span><i style="background:#b13e53"></i>Gastos + inversión</span></div></div>`;
}
// Gasto acumulado día a día: este mes, el anterior y el ritmo del presupuesto
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
  const isCur = ym === curYM();
  const upto = isCur ? +today().slice(8) : a.length;
  const W = 340, H = 170, L = 4, B = 20, T = 10;
  const max = Math.max(1, a[a.length - 1], b[b.length - 1], limit || 0);
  const X = (i, n) => L + (i / Math.max(1, n - 1)) * (W - L * 2);
  const Y = (v) => H - B - (v / max) * (H - B - T);
  const pts = (arr, n) => arr.slice(0, n).map((v, i) => `${X(i, arr.length).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">
    <line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" stroke="#566c86"/>
    ${limit > 0 ? `<line x1="${L}" y1="${Y(0)}" x2="${W - L}" y2="${Y(limit)}" stroke="#ffcd75" stroke-dasharray="6 5" stroke-width="2"/>` : ''}
    <polyline points="${pts(b, b.length)}" fill="none" stroke="#566c86" stroke-width="3"/>
    <polyline points="${pts(a, upto)}" fill="none" stroke="#73eff7" stroke-width="4" stroke-linejoin="bevel"/>
    <text x="${L}" y="${H - 5}">1</text><text x="${W - L}" y="${H - 5}" text-anchor="end">${a.length}</text></svg>
    <div class="chart-legend"><span><i style="background:#73eff7"></i>Este mes</span><span><i style="background:#566c86"></i>Mes anterior</span>
    ${limit > 0 ? '<span><i style="background:#ffcd75"></i>Ritmo presupuesto</span>' : ''}</div></div>`;
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
    return `<details><summary>${ico(c)}<span class="grow"><b>${esc(c.name)}</b><span class="cbar"><i style="width:${Math.min(100, (v / total) * 100)}%;background:${c.color}"></i></span></span>
      <span class="r"><b class="num">${eur(v)}</b><span class="pct">${pct(v / total)}</span></span></summary>
      <div class="subs">${subs.map((s) => `<div class="line"><span>${esc(s.name)}</span><b class="num">${eur(s.val)}</b></div>`).join('')}</div></details>`;
  }).join('')}</div>`;
}
function splitCard(s, title) {
  const saving = Math.max(0, s.saving);
  const base = s.inc > 0 ? s.inc : s.exp + s.inv;
  const parts = [
    { k: 'necesario', v: s.byGroup.necesario },
    { k: 'ocio', v: s.byGroup.ocio },
    { k: 'ahorro', v: saving, note: s.inv > 0 ? `incluye ${eur(s.inv)} invertidos` : '' },
  ];
  const sum = parts.reduce((a, p) => a + p.v, 0) || 1;
  return `<div class="card"><h2>${title}</h2>
    <div class="split-bar">${parts.map((p) => `<i style="width:${(p.v / sum) * 100}%;background:${GROUPS[p.k].color}"></i>`).join('')}</div>
    ${parts.map((p) => `<div class="row item"><span class="cat-ico" style="--c:${GROUPS[p.k].color}">${GROUPS[p.k].icon}</span>
      <span class="grow"><b>${GROUPS[p.k].name}</b>${p.note ? `<br><span class="muted">${p.note}</span>` : ''}</span>
      <span class="r"><b class="num">${eur(p.v)}</b><span class="pct">${base > 0 ? pct(p.v / base) : '–'}</span></span></div>`).join('')}
    ${s.saving < 0 ? `<div class="warn">Has gastado ${eur(-s.saving)} más de lo que has ingresado.</div>` : ''}
    <p class="muted small">Porcentajes sobre los ingresos. El grupo de cada categoría se cambia en Mochila → Categorías.</p></div>`;
}
// Panel igual que «Ingresos y ahorro» del Excel
function excelPanel(s) {
  const ok = s.diff >= 0;
  return `<div class="card"><h2>📒 Ingresos y ahorro</h2><div class="lines">
    <div class="line"><span>Ingreso principal</span><b>${eur(s.incP)}</b></div>
    <div class="line"><span>Ingresos secundarios</span><b>${eur(s.incS)}</b></div>
    <div class="line hl"><span>Ingresos totales</span><b class="pos">${eur(s.inc)}</b></div>
    <div class="line hl"><span>Gastos totales</span><b class="neg">${eur(s.exp)}</b></div>
    <div class="line"><span>Inversión</span><b>${eur(s.inv)}</b></div>
    <div class="line"><span>Objetivo de ahorro</span><b>${Math.round(db.settings.savingsTarget * 100)}%</b></div>
    <div class="line"><span>Ahorro objetivo</span><b>${eur(s.target)}</b></div>
    <div class="line"><span>Ahorro real</span><b class="${ok ? 'pos' : 'neg'}">${eur(s.saving)}</b></div>
    <div class="line"><span>% ahorro real</span><b class="${ok ? 'pos' : 'neg'}">${pct(s.rate)}</b></div></div>
    <div class="diffbox ${ok ? 'good' : 'bad'}"><span>DIFERENCIA VS OBJETIVO</span><b>${signed(s.diff)}</b></div></div>`;
}

function movRow(m) {
  const c = cat(m.catId);
  const tr = m.type === 'transfer';
  const inc = m.type === 'income';
  const a = account(m.accountId), to = account(m.toAccountId);
  const sel = ui.select ? `<span class="tick ${ui.selected.has(m.id) ? 'on' : ''}">${ui.selected.has(m.id) ? '✔' : ''}</span>` : '';
  const title = tr ? 'Transferencia' : m.desc || m.sub || (c ? c.name : '');
  const sub = tr ? `${a ? a.name : '?'} → ${to ? to.name : '?'}` : `${c ? c.name : 'Sin categoría'}${m.sub ? ' · ' + m.sub : ''}`;
  return `<button class="mov ${m.pending ? 'pending' : ''}" data-action="${ui.select ? 'toggle-sel' : 'edit-mov'}" data-id="${m.id}">${sel}
    ${tr ? '<span class="cat-ico" style="--c:#41a6f6">🔄</span>' : ico(c)}
    <span class="grow"><span class="t">${esc(title)}${m.recurringId ? ' 🔁' : ''}${m.pending ? ' <em class="tag">pendiente</em>' : ''}</span>
    <span class="s">${esc(sub)}</span></span>
    <span class="a ${tr ? '' : inc ? 'pos' : 'neg'}">${tr ? '' : inc ? '+' : '−'}${eur(m.amount)}</span></button>`;
}

// ================================================================ BASE (inicio)
function viewBase() {
  const p = player();
  const s = monthStats(curYM());
  const h = db.settings.home;
  const b = db.budgets[0];
  const bs = b ? budgetStatus(b) : null;
  const pend = pendingMovs().filter((m) => m.date <= today());
  const up = upcoming(10);
  const plan = goalPlan();
  const goals = [...db.goals].sort((a, b) => a.order - b.order).filter((g) => (plan.res[g.id]?.saved || 0) < g.target).slice(0, 2);
  const recent = db.movements.filter((m) => !m.pending).sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created)).slice(0, 5);
  const st = streaks();
  let html = `<div class="card player">
    <div class="avatar">${esc(db.settings.avatar)}</div>
    <div class="grow"><div class="pname">${esc(db.settings.playerName)}</div>
      <div class="ptitle">NV ${p.lv} · ${esc(p.title)}</div>
      ${pbar((p.xp - p.from) / (p.to - p.from), 'xp')}
      <div class="muted small">${p.xp - p.from} / ${p.to - p.from} XP para NV ${p.lv + 1}</div></div>
    <div class="streak" title="Racha de días apuntando"><span>🔥</span><b>${st.cur}</b><small>días</small></div></div>`;

  if (h.budget && bs) {
    const hp = bs.limit > 0 ? Math.max(0, bs.left) / bs.limit : 0;
    html += `<div class="card"><h2>❤️ Vida del mes <small>${esc(b.name)}</small></h2>
      ${bs.limit > 0 ? `${pbar(hp, hp < 0.25 ? 'hp low' : 'hp')}
      <div class="line big"><span>${eur(Math.max(0, bs.left))}</span><span class="muted">/ ${eur(bs.limit)}</span></div>
      ${bs.over ? `<div class="warn bad">💀 ¡Te has pasado ${eur(-bs.left)} del presupuesto!</div>`
        : `<p class="muted">Puedes gastar <b class="gold">${eur(bs.perDay)}/día</b> durante ${bs.daysLeft} días.
          ${bs.spent > bs.pace ? `Vas <b class="neg">${eur(bs.spent - bs.pace)}</b> por encima del ritmo.` : `Vas <b class="pos">${eur(bs.pace - bs.spent)}</b> por debajo del ritmo. ¡Bien!`}</p>`}`
        : `<p class="muted">${b.auto ? `Tu vida del mes es lo que puedes gastar para ahorrar el ${Math.round(db.settings.savingsTarget * 100)}%: añade tus ingresos del mes para calcularla.` : 'Pon una cantidad en Mochila → Presupuestos.'}</p>`}</div>`;
  }
  if (h.saving) {
    const ok = s.diff >= 0;
    html += `<div class="card"><h2>💧 Maná de ahorro <small>objetivo ${Math.round(db.settings.savingsTarget * 100)}%</small></h2>
      ${pbar(s.inc > 0 ? s.rate : 0, ok ? 'mp' : 'mp bad', db.settings.savingsTarget)}
      <div class="trio">
        <div><span>Ingresos</span><b class="pos">${eur(s.inc)}</b></div>
        <div><span>Gastos</span><b class="neg">${eur(s.exp)}</b></div>
        <div><span>Ahorro</span><b>${eur(s.saving)}</b></div></div>
      ${s.inc || s.exp ? `<div class="diffbox ${ok ? 'good' : 'bad'}"><span>${ok ? '▲ Por encima del objetivo' : '▼ Por debajo del objetivo'}</span><b>${signed(s.diff)}</b></div>`
        : '<p class="muted">Apunta tu nómina y tus gastos para llenar el maná.</p>'}</div>`;
  }
  if (h.upcoming && (pend.length || up.length)) {
    html += `<div class="card"><h2>⏳ Pagos</h2>
      ${pend.map((m) => `<div class="row item">${ico(cat(m.catId))}<span class="grow"><b>${esc(m.desc || cat(m.catId)?.name)}</b><br><span class="muted">${shortDate(m.date)} · </span><b class="num neg">${eur(m.amount)}</b></span>
        <button class="mini" data-action="pay" data-id="${m.id}">Pagar</button><button class="mini ghost" data-action="skip" data-id="${m.id}">✕</button></div>`).join('')}
      ${up.map(({ r, date }) => `<div class="row item">${ico(cat(r.catId))}<span class="grow"><b>${esc(r.desc)}</b><br><span class="muted">${shortDate(date)} · ${FREQS[r.freq].toLowerCase()}${r.auto ? ' · automático' : ''}</span></span>
        <b class="num">${eur(r.amount)}</b></div>`).join('')}</div>`;
  }
  if (h.quests && goals.length) {
    html += `<div class="card"><h2>⚔️ Misiones activas</h2>${goals.map((g) => bossMini(g, plan.res[g.id])).join('')}</div>`;
  }
  if (h.recent) {
    html += `<div class="card"><h2>📜 Últimos movimientos</h2>
      ${recent.length ? recent.map(movRow).join('') : empty('🪙', 'Aún no hay movimientos.<br>Pulsa <b>+</b> para añadir el primero y ganar tus primeros XP.')}</div>`;
  }
  return html;
}
function bossMini(g, r) {
  const saved = r ? r.saved : g.initial || 0;
  const hp = Math.max(0, g.target - saved);
  return `<div class="boss-mini"><span class="boss-ico">${g.icon}</span><div class="grow"><b>${esc(g.name)}</b>
    ${pbar(hp / g.target, 'boss')}<span class="muted small">Vida del jefe: ${eur(hp)}</span></div></div>`;
}

// ================================================================ DIARIO (movimientos)
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
function viewDiario() {
  const movs = filteredMovs();
  const days = {};
  movs.forEach((m) => (days[m.date] = days[m.date] || []).push(m));
  const dayTotal = (list) => list.reduce((a, m) => a + (!isReal(m) ? 0 : m.type === 'income' ? m.amount : -m.amount), 0);
  const tot = dayTotal(movs);
  return `${periodNav(ymLabel(ui.ym), 'month')}
  ${seg([['all', 'Todo'], ['expense', 'Gastos'], ['income', 'Ingresos'], ['transfer', 'Transf.'], ['pending', 'Pendientes']], ui.filter, 'filter')}
  <input class="input search" id="search" type="search" placeholder="🔎 Buscar texto, categoría o importe" value="${esc(ui.q)}">
  <div class="filters">
    <select class="input" data-filter="fCat"><option value="">Todas las categorías</option>
      ${db.categories.map((c) => `<option value="${c.id}" ${ui.fCat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select>
    <select class="input" data-filter="fAcc"><option value="">Todas las cuentas</option>
      ${db.accounts.map((a) => `<option value="${a.id}" ${ui.fAcc === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select></div>
  <div class="row between toolbar"><span class="muted">${movs.length} movimientos · ${signed(tot)}</span>
    <button class="mini ${ui.select ? 'on' : ''}" data-action="select-mode">${ui.select ? 'Cancelar' : '☑ Seleccionar'}</button></div>
  ${ui.select ? `<div class="selbar"><span>${ui.selected.size} seleccionados</span>
    <button class="mini" data-action="sel-all">Todos</button><button class="mini" data-action="sel-cat" ${ui.selected.size ? '' : 'disabled'}>Categoría</button>
    <button class="mini danger" data-action="sel-del" ${ui.selected.size ? '' : 'disabled'}>Borrar</button></div>` : ''}
  ${movs.length ? Object.entries(days).map(([d, list]) => `<div class="day"><span>${esc(dateLabel(d))}</span><span>${signed(dayTotal(list))}</span></div>${list.map(movRow).join('')}`).join('')
    : empty('🔍', 'No hay movimientos con estos filtros.')}`;
}

// ================================================================ ESTADÍSTICAS
function viewStats() {
  const top = seg([['month', 'Mes'], ['year', 'Año']], ui.statsMode, 'stats-mode');
  if (ui.statsMode === 'year') {
    const y = yearStats(ui.year);
    const rows = y.months.map((s, i) => (s.movs.length ? `<tr><td>${MON3[i]}</td><td class="pos">${eur(s.inc)}</td><td class="neg">${eur(s.exp)}</td>
      <td class="${s.diff >= 0 ? 'pos' : 'neg'}">${eur(s.saving)}</td></tr>` : '')).join('');
    return `${top}${periodNav(String(ui.year), 'year')}
      ${excelPanel(y)}
      <div class="card"><h2>📊 Mes a mes</h2>${monthBars(y.months)}</div>
      <div class="card"><h2>🥧 Gastos del año</h2><div class="chart-wrap">${donut(catDonutItems(y.byCat), eur(y.exp), 'gastado')}</div>
        ${categoryLegend(y.byCat, y.bySub, y.exp || 1)}</div>
      ${splitCard(y, '⚖️ Necesarios · Ocio · Ahorro')}
      ${rows ? `<div class="card"><h2>🗓️ Tabla por meses</h2><table class="tbl"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Ahorro</th></tr></thead>
        <tbody>${rows}<tr class="total"><td>Total</td><td>${eur(y.inc)}</td><td>${eur(y.exp)}</td><td class="${y.diff >= 0 ? 'pos' : 'neg'}">${eur(y.saving)}</td></tr></tbody></table>
        <p class="muted small">Ahorro en verde si llega al ${Math.round(db.settings.savingsTarget * 100)}% de los ingresos, en rojo si no.</p></div>` : ''}`;
  }
  const s = monthStats(ui.ym);
  const b = db.budgets[0];
  const lim = b ? budgetStatus(b, `${ui.ym}-15`).limit : 0;
  return `${top}${periodNav(ymLabel(ui.ym), 'month')}
    ${excelPanel(s)}
    <div class="card"><h2>🥧 Gastos por categoría</h2><div class="chart-wrap">${donut(catDonutItems(s.byCat), eur(s.exp), 'gastado')}</div>
      ${categoryLegend(s.byCat, s.bySub, s.exp || 1)}<p class="muted small">Toca una categoría para ver sus subcategorías.</p></div>
    <div class="card"><h2>📈 Gasto acumulado</h2>${spendLine(ui.ym, lim)}</div>
    ${splitCard(s, '⚖️ Necesarios · Ocio · Ahorro')}`;
}

// ================================================================ MISIONES (metas + logros)
function viewMisiones() {
  const top = seg([['goals', '⚔️ Metas'], ['ach', '🏆 Logros']], ui.questTab, 'quest-tab');
  if (ui.questTab === 'ach') {
    const n = Object.keys(db.meta.unlocked).length;
    return `${top}<div class="card"><h2>🏆 Logros <small>${n} / ${ACHIEVEMENTS.length}</small></h2>${pbar(n / ACHIEVEMENTS.length, 'xp')}</div>
      <div class="ach-grid">${ACHIEVEMENTS.map((a) => { const on = db.meta.unlocked[a.id];
        return `<div class="ach ${on ? 'on' : ''}"><span class="ach-ico">${on ? a.icon : '🔒'}</span><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>${on ? `<em>${shortDate(on)}</em>` : ''}</div>`; }).join('')}</div>`;
  }
  const plan = goalPlan();
  const goals = [...db.goals].sort((a, b) => a.order - b.order);
  const m = plan.months[curYM()];
  return `${top}<div class="card"><h2>📖 Cómo funcionan</h2><p class="muted">Cada meta es un <b>jefe</b>: su vida es lo que te falta.
    Cada mes se le aparta su cantidad del <b>balance libre</b> (ingresos − gastos − inversión) y le quita vida.
    Si el balance no llega, se aparta solo lo que haya, empezando por la meta de arriba.</p>
    ${m ? `<div class="lines"><div class="line"><span>Balance libre este mes</span><b>${eur(m.avail)}</b></div>
      <div class="line"><span>Para metas este mes</span><b class="${m.given < m.planned ? 'neg' : 'pos'}">${eur(m.given)} / ${eur(m.planned)}</b></div></div>` : ''}</div>
    ${goals.length ? goals.map((g, i) => bossCard(g, plan.res[g.id], i, goals.length)).join('')
      : empty('🐉', 'Crea tu primera misión: coche nuevo, móvil, reforma, entrada de la hipoteca…')}
    <button class="btn" data-action="new-goal">+ Nueva misión</button>`;
}
function bossCard(g, r, i, n) {
  const saved = r ? r.saved : g.initial || 0;
  const left = Math.max(0, g.target - saved);
  const done = left <= 0;
  const months = g.monthly > 0 ? Math.ceil(left / g.monthly) : Infinity;
  const eta = done ? '¡Derrotado! 🏆' : isFinite(months) ? `≈ ${months} ${months === 1 ? 'mes' : 'meses'} (${ymLabel(addMonths(curYM(), months))})` : 'Sin aportación mensual';
  const thisM = r && r.byMonth[curYM()];
  const want = Math.min(g.monthly, left + (thisM || 0));
  return `<div class="card boss ${done ? 'done' : ''}">
    <div class="row"><span class="boss-ico big">${g.icon}</span><div class="grow"><div class="pname">${esc(g.name)}${g.paused ? ' <em class="tag">pausa</em>' : ''}</div>
      <div class="muted small">Prioridad ${i + 1} · ${eur(g.monthly)}/mes</div></div></div>
    <div class="boss-hp"><span>VIDA</span>${pbar(left / g.target, 'boss')}<b>${eur(left)}</b></div>
    <div class="line"><span>Apartado</span><b class="pos">${eur(saved)} / ${eur(g.target)}</b></div>
    <div class="line muted"><span>${eta}</span><span>${pct(saved / g.target)}</span></div>
    ${!done && !g.paused && thisM !== undefined && thisM < want ? `<div class="warn">Este mes el balance solo da para ${eur(thisM)} de ${eur(want)}.</div>` : ''}
    <div class="actions"><button class="mini" data-action="edit-goal" data-id="${g.id}">✏️ Editar</button>
      <button class="mini" data-action="goal-up" data-id="${g.id}" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="mini" data-action="goal-down" data-id="${g.id}" ${i === n - 1 ? 'disabled' : ''}>▼</button></div></div>`;
}

// ================================================================ MOCHILA (más)
function viewMochila() {
  const subs = { excel: viewExcel, import: viewImport, budgets: viewBudgets, recurring: viewRecurring, loans: viewLoans, accounts: viewAccounts, cats: viewCats, settings: viewSettings };
  if (ui.sub && subs[ui.sub]) return `<button class="back" data-action="sub" data-sub="">◀ Mochila</button>` + subs[ui.sub]();
  const it = (sub, icon, t, d) => `<button class="slot" data-action="sub" data-sub="${sub}"><span class="slot-ico">${icon}</span><b>${t}</b><span>${d}</span></button>`;
  return `<div class="slots">
    ${it('excel', '📋', 'Pasar al Excel', 'Copia el mes y pégalo')}
    ${it('import', '📥', 'Importar', 'Del Excel a la app')}
    ${it('budgets', '🗡️', 'Presupuestos', 'Límites y vida')}
    ${it('recurring', '🔁', 'Recurrentes', 'Suscripciones y pagos fijos')}
    ${it('loans', '🤝', 'Préstamos', 'Lo que te deben y debes')}
    ${it('accounts', '🏦', 'Cuentas', 'Banco, efectivo…')}
    ${it('cats', '🏷️', 'Categorías', 'Iconos, grupos, nuevas')}
    ${it('settings', '⚙️', 'Ajustes', 'Jugador, sonido, copia')}</div>
    <div class="card"><h2>🔒 Privacidad</h2><p class="muted">Tus datos se guardan <b>solo en este móvil</b>. No hay cuentas ni servidores.
    Haz una copia de seguridad de vez en cuando (Ajustes → Guardar partida).</p></div>
    ${installCard()}`;
}
function installCard() {
  if (window.matchMedia('(display-mode: standalone)').matches) return '';
  return `<div class="card"><h2>📲 Instalar Cointrol</h2>${deferredInstall ? '<button class="btn" data-action="install">Instalar app</button>'
    : '<p class="muted">En Chrome: menú ⋮ → <b>Instalar aplicación</b>.</p>'}</div>`;
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
  <div class="card"><h2>1 · Gastos <small>${exp.length} filas</small></h2>
    <div class="xl-wrap"><table class="xl"><thead><tr>${XL_HEAD.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${exp.length ? exp.map((r) => `<tr><td>${esc(r[0])}</td><td class="r">${esc(r[1])} €</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join('')
      : '<tr><td colspan="5" class="c">Sin gastos este mes</td></tr>'}</tbody></table></div>
    <button class="btn" data-action="copy-exp" ${exp.length ? '' : 'disabled'}>📋 Copiar gastos</button>
    <ol class="steps"><li>En el Excel, clic en la celda <code>B23</code>.</li><li>Pega (Ctrl+V): se rellenan Fecha, Importe, Descripción, Categoría y Subcategoría.</li></ol>
    ${custom.length ? `<div class="warn">${custom.map(esc).join(', ')} no existe${custom.length > 1 ? 'n' : ''} en el Excel. Añáde${custom.length > 1 ? 'las' : 'la'} en su hoja «Listas» para que sume${custom.length > 1 ? 'n' : ''} en los totales.</div>` : ''}</div>
  <div class="card"><h2>2 · Ingreso principal</h2><div class="line"><span>Nómina</span><b>${eur(principal)}</b></div>
    <button class="btn alt" data-action="copy-principal" ${principal ? '' : 'disabled'}>📋 Copiar ingreso principal</button>
    <ol class="steps"><li>Pega en la celda <code>C5</code>.</li></ol></div>
  <div class="card"><h2>3 · Ingresos secundarios <small>${sec.length} filas</small></h2>
    ${sec.length ? `<div class="xl-wrap"><table class="xl"><tbody>${sec.map((r) => `<tr><td>${esc(r[0])}</td><td class="r">${esc(r[1])} €</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin ingresos secundarios este mes.</p>'}
    <button class="btn alt" data-action="copy-sec" ${sec.length ? '' : 'disabled'}>📋 Copiar ingresos secundarios</button>
    <ol class="steps"><li>Pega en la celda <code>B7</code> (hasta 4 filas).</li></ol></div>
  <div class="card"><h2>Opciones</h2>
    <label class="check"><input type="checkbox" data-setting="decimalComma" ${db.settings.decimalComma ? 'checked' : ''}> Decimales con coma (Excel en español)</label>
    <label class="check"><input type="checkbox" data-setting="xlHeader" ${db.settings.xlHeader ? 'checked' : ''}> Incluir fila de títulos al copiar gastos</label>
    <button class="btn alt" data-action="csv">⬇️ Descargar gastos en .csv</button>
    <p class="muted small">Así se copia un importe: ${esc(num(12.5))}. Los movimientos pendientes y las transferencias no se copian.</p></div>`;
}

// ---- Importar del Excel (de la tabla de movimientos, B23:F…)
function viewImport() {
  return `<div class="card"><h2>📥 Importar del Excel</h2>
    <p class="muted">Selecciona en el Excel las filas de la tabla de movimientos (de <code>B</code> a <code>F</code>: Fecha, Importe, Descripción, Categoría, Subcategoría), cópialas y pégalas aquí.</p>
    <textarea class="input" id="imp-text" rows="7" placeholder="01/11/2026	27,00	gym	DEPORTE	Gimnasio"></textarea>
    <div class="field"><label>Cuenta</label><select class="input" id="imp-acc">${db.accounts.map((a) => `<option value="${a.id}">${a.icon} ${esc(a.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Fecha si falta</label><input class="input" id="imp-date" type="date" value="${today()}"></div>
    <button class="btn" data-action="imp-preview">Revisar</button><div id="imp-out"></div></div>`;
}

// ---- Presupuestos
function viewBudgets() {
  return db.budgets.map((b) => {
    const s = budgetStatus(b);
    const hp = s.limit > 0 ? Math.max(0, s.left) / s.limit : 0;
    const limits = Object.entries(b.catLimits || {}).filter(([, v]) => v > 0);
    const hist = b.period === 'custom' ? [] : Array.from({ length: 5 }, (_, i) => {
      const ref = b.period === 'week' ? addDays(today(), -7 * (i + 1)) : `${addMonths(curYM(), -(i + 1))}-15`;
      return budgetStatus(b, ref);
    }).filter((h) => h.limit > 0 || h.spent > 0);
    return `<div class="card"><div class="row"><span class="boss-ico">${esc(b.icon)}</span><div class="grow"><div class="pname">${esc(b.name)}</div>
      <div class="muted small">${b.period === 'month' ? 'Mensual' : b.period === 'week' ? 'Semanal' : `${shortDate(s.from)} – ${shortDate(s.to)}`}
      · ${b.cats.length ? b.cats.length + ' categorías' : 'todas las categorías'}${b.auto ? ` · auto (${Math.round((1 - db.settings.savingsTarget) * 100)}% de ingresos)` : ''}</div></div>
      <button class="mini" data-action="edit-budget" data-id="${b.id}">✏️</button></div>
      ${pbar(hp, hp < 0.25 ? 'hp low' : 'hp', s.limit ? Math.min(1, s.pace / s.limit) : undefined)}
      <div class="line"><span>Gastado ${eur(s.spent)} de ${eur(s.limit)}</span><b class="${s.over ? 'neg' : 'pos'}">${s.over ? 'Te pasas ' + eur(-s.left) : 'Quedan ' + eur(s.left)}</b></div>
      ${!s.ended && s.limit > 0 && !s.over ? `<p class="muted small">${eur(s.perDay)}/día durante ${s.daysLeft} días. La marca indica el ritmo ideal a día de hoy.</p>` : ''}
      ${limits.length ? `<div class="label">Límites por categoría</div>${limits.map(([id, lim]) => { const c = cat(id); if (!c) return ''; const sp = s.byCat[id] || 0;
        return `<div class="row item">${ico(c)}<span class="grow"><b>${esc(c.name)}</b>${pbar(1 - sp / lim, sp > lim ? 'hp low' : 'hp')}</span>
          <span class="r"><b class="num ${sp > lim ? 'neg' : ''}">${eur(sp)}</b><span class="pct">de ${eur(lim)}</span></span></div>`; }).join('')}` : ''}
      ${hist.length ? `<details class="hist"><summary>Historial</summary>${hist.map((h) => `<div class="line"><span>${b.period === 'week' ? shortDate(h.from) : ymLabel(h.from.slice(0, 7))}</span>
        <b class="${h.over ? 'neg' : 'pos'}">${eur(h.spent)} / ${eur(h.limit)} ${h.over ? '✖' : '✔'}</b></div>`).join('')}</details>` : ''}</div>`;
  }).join('') + `<button class="btn" data-action="new-budget">+ Nuevo presupuesto</button>
    <p class="muted small center">El primero de la lista es la «vida del mes» de la pantalla Base. Puedes crear uno para un viaje con fechas personalizadas.</p>`;
}

// ---- Recurrentes
function viewRecurring() {
  const act = db.recurring.filter((r) => r.active);
  const monthly = act.filter((r) => r.type === 'expense').reduce((a, r) => a + monthlyCost(r), 0);
  const pend = pendingMovs();
  return `<div class="card"><h2>🔁 Suscripciones y pagos fijos</h2>
    <div class="line big"><span>Coste al mes</span><b class="neg">${eur(monthly)}</b></div><div class="line"><span>Coste al año</span><b>${eur(monthly * 12)}</b></div>
    <p class="muted small">En «automático» se apuntan solos el día que tocan. Si no, aparecen en Base como «por pagar» para que los confirmes.</p></div>
    ${pend.length ? `<div class="card"><h2>⏳ Por pagar</h2>${pend.map((m) => `<div class="row item">${ico(cat(m.catId))}<span class="grow"><b>${esc(m.desc)}</b><br><span class="muted">${shortDate(m.date)} · </span><b class="num neg">${eur(m.amount)}</b></span>
      <button class="mini" data-action="pay" data-id="${m.id}">Pagar</button><button class="mini ghost" data-action="skip" data-id="${m.id}">✕</button></div>`).join('')}</div>` : ''}
    ${db.recurring.length ? db.recurring.map((r) => `<button class="mov ${r.active ? '' : 'off'}" data-action="edit-rec" data-id="${r.id}">${ico(cat(r.catId))}
      <span class="grow"><span class="t">${esc(r.desc)}${r.active ? '' : ' <em class="tag">parado</em>'}</span><span class="s">${FREQS[r.freq]} · próximo ${shortDate(r.next)}${r.auto ? ' · auto' : ''}</span></span>
      <span class="a ${r.type === 'income' ? 'pos' : 'neg'}">${eur(r.amount)}</span></button>`).join('') : empty('🔁', 'Añade el gimnasio, Spotify, el bono bus, la nómina…')}
    <button class="btn" data-action="new-rec">+ Nuevo recurrente</button>`;
}

// ---- Préstamos y deudas
function viewLoans() {
  const open = db.loans.filter((l) => loanLeft(l) > 0);
  const owedToMe = open.filter((l) => l.dir === 'lent').reduce((a, l) => a + loanLeft(l), 0);
  const iOwe = open.filter((l) => l.dir === 'borrowed').reduce((a, l) => a + loanLeft(l), 0);
  const card = (l) => {
    const left = loanLeft(l);
    return `<button class="mov ${left <= 0 ? 'off' : ''}" data-action="edit-loan" data-id="${l.id}"><span class="cat-ico" style="--c:${l.dir === 'lent' ? '#38b764' : '#b13e53'}">${l.dir === 'lent' ? '🤝' : '🧾'}</span>
      <span class="grow"><span class="t">${esc(l.person)}${left <= 0 ? ' <em class="tag">saldado</em>' : ''}</span>
      <span class="s">${l.dir === 'lent' ? 'Te debe' : 'Le debes'} · ${shortDate(l.date)}${l.note ? ' · ' + esc(l.note) : ''}</span></span>
      <span class="a ${l.dir === 'lent' ? 'pos' : 'neg'}">${eur(left)}</span></button>`;
  };
  return `<div class="card"><div class="trio"><div><span>Te deben</span><b class="pos">${eur(owedToMe)}</b></div><div><span>Debes</span><b class="neg">${eur(iOwe)}</b></div>
    <div><span>Neto</span><b>${signed(owedToMe - iOwe)}</b></div></div>
    <p class="muted small">Los préstamos no cuentan como gasto ni como ingreso: así no te descuadran el ahorro del mes.</p></div>
    ${db.loans.length ? db.loans.slice().sort((a, b) => (loanLeft(b) > 0) - (loanLeft(a) > 0) || b.date.localeCompare(a.date)).map(card).join('') : empty('🤝', 'Apunta lo que prestas o te prestan.')}
    <button class="btn" data-action="new-loan">+ Nuevo préstamo o deuda</button>`;
}

// ---- Cuentas
function viewAccounts() {
  return `<div class="card"><div class="line big"><span>🪙 Oro total</span><b class="gold">${eur(totalGold())}</b></div></div>
    ${db.accounts.map((a) => `<button class="mov" data-action="edit-acc" data-id="${a.id}"><span class="cat-ico" style="--c:${a.color}">${a.icon}</span>
      <span class="grow"><span class="t">${esc(a.name)}</span><span class="s">Saldo inicial ${eur(a.initial)}</span></span>
      <span class="a">${eur(accountBalance(a))}</span></button>`).join('')}
    <button class="btn" data-action="new-acc">+ Nueva cuenta</button>
    <button class="btn alt" data-action="new-transfer">🔄 Transferir entre cuentas</button>
    <p class="muted small center">Pon en cada cuenta el saldo que tenía antes de empezar a usar Cointrol para que cuadre con el banco.</p>`;
}

// ---- Categorías
function viewCats() {
  const list = (kind) => catsOf(kind).map((c) => `<button class="mov" data-action="edit-cat" data-id="${c.id}">${ico(c)}
    <span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${kind === 'expense' ? GROUPS[c.group].name : c.principal ? 'Ingreso principal' : 'Ingreso secundario'} · ${c.subs.length} subcategorías</span></span></button>`).join('');
  return `<div class="label">Gastos</div>${list('expense')}<div class="label">Ingresos</div>${list('income')}
    <button class="btn" data-action="new-cat">+ Nueva categoría</button>`;
}

// ---- Ajustes
function viewSettings() {
  const s = db.settings;
  const homeOpts = [['budget', '❤️ Vida del mes'], ['saving', '💧 Maná de ahorro'], ['upcoming', '⏳ Pagos'], ['quests', '⚔️ Misiones'], ['recent', '📜 Últimos movimientos']];
  return `<div class="card"><h2>🧙 Jugador</h2>
    <div class="field"><label>Nombre</label><input class="input" id="set-name" maxlength="20" value="${esc(s.playerName)}"></div>
    <div class="field"><label>Avatar</label><div class="emoji-grid">${AVATARS.map((a) => `<button type="button" class="${a === s.avatar ? 'on' : ''}" data-action="avatar" data-v="${a}">${a}</button>`).join('')}</div></div>
    <button class="btn" data-action="save-name">Guardar</button></div>
  <div class="card"><h2>🎯 Objetivo de ahorro</h2>
    <div class="row"><input class="input" id="target" type="number" inputmode="numeric" min="0" max="100" step="1" value="${Math.round(s.savingsTarget * 100)}" style="max-width:110px">
    <span class="grow">% de los ingresos de cada mes</span></div><button class="btn" data-action="save-target">Guardar objetivo</button></div>
  <div class="card"><h2>🏠 Pantalla Base</h2>${homeOpts.map(([k, l]) => `<label class="check"><input type="checkbox" data-home="${k}" ${s.home[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
  <div class="card"><h2>🔊 Sonido</h2><label class="check"><input type="checkbox" data-setting="sound" ${s.sound ? 'checked' : ''}> Efectos de sonido 8 bits</label></div>
  <div class="card"><h2>🔐 Bloqueo con PIN</h2><p class="muted small">Pide un PIN de 4 cifras al abrir la app.</p>
    ${s.pinHash ? '<button class="btn alt" data-action="pin-off">Quitar PIN</button>' : '<button class="btn alt" data-action="pin-on">Poner PIN</button>'}</div>
  <div class="card"><h2>💾 Guardar partida</h2>
    <p class="muted small">${db.movements.length} movimientos, ${db.goals.length} metas, ${db.categories.length} categorías. Guarda la copia en Drive o en tu correo.</p>
    <button class="btn" data-action="backup">💾 Exportar copia (.json)</button><button class="btn alt" data-action="restore">📂 Cargar copia</button>
    <input type="file" id="restore-file" accept="application/json,.json" hidden></div>
  <div class="card"><h2>☠️ Zona peligrosa</h2><button class="btn danger" data-action="wipe">Borrar todos los datos</button></div>
  <p class="center muted small">Cointrol · versión 2.0</p>`;
}
