'use strict';
/* Cointrol · formularios (hojas inferiores), avisos, PIN e importación. */

// ================================================================ hoja inferior y avisos
function openSheet(draw) {
  $('#sheet').hidden = false;
  document.body.classList.add('noscroll');
  draw($('#sheet-body'));
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet-body').innerHTML = '';
  document.body.classList.remove('noscroll');
}
let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast ' + kind; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2400);
  if (kind === 'bad') sfx('error');
}
const fail = (msg) => { toast(msg, 'bad'); return false; };
const accSelect = (id, val, exclude) => `<select class="input" id="${id}">${db.accounts.filter((a) => a.id !== exclude)
  .map((a) => `<option value="${a.id}" ${a.id === val ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select>`;
const catGrid = (kind, sel) => `<div class="cat-grid">${catsOf(kind).map((k) =>
  `<button type="button" class="cat-pick ${k.id === sel ? 'on' : ''}" data-c="${k.id}">${ico(k)}<span>${esc(k.name)}</span></button>`).join('')}
  <button type="button" class="cat-pick" data-newcat="1"><span class="cat-ico" style="--c:#566c86">＋</span><span>Nueva</span></button></div>`;
const subChips = (c, sel) => (c && c.subs.length ? `<div class="field"><span class="label">Subcategoría</span><div class="chips">
  ${c.subs.map((s) => `<button type="button" class="chip ${s === sel ? 'on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>` : '');

// ================================================================ movimiento
function movementForm(existing, preset = {}) {
  const st = existing ? { ...existing, repeat: '' } : {
    type: 'expense', amount: '', desc: '', note: '', date: ui.ym === curYM() ? today() : ui.ym + '-01', catId: null, sub: '',
    accountId: db.accounts[0].id, toAccountId: (db.accounts[1] || db.accounts[0]).id, pending: false, repeat: '', ...preset,
  };
  const draw = (root) => {
    const c = cat(st.catId);
    const tr = st.type === 'transfer';
    const future = st.date > today();
    root.innerHTML = `<h3>${existing ? 'Editar movimiento' : 'Nuevo movimiento'}</h3>
      <div class="seg type field">
        <button type="button" class="${st.type === 'expense' ? 'on neg' : ''}" data-t="expense">Gasto</button>
        <button type="button" class="${st.type === 'income' ? 'on pos' : ''}" data-t="income">Ingreso</button>
        <button type="button" class="${tr ? 'on' : ''}" data-t="transfer">Transferir</button></div>
      <div class="field"><input class="input amount-input" id="f-amount" inputmode="decimal" placeholder="0,00 €" value="${esc(amountStr(st.amount))}" autocomplete="off"></div>
      ${tr ? `<div class="field"><label>Desde</label>${accSelect('f-acc', st.accountId)}</div>
        <div class="field"><label>Hacia</label>${accSelect('f-to', st.toAccountId, st.accountId)}</div>` : `
      <div class="field"><label for="f-desc">Descripción</label><input class="input" id="f-desc" maxlength="120" autocomplete="off"
        placeholder="${st.type === 'expense' ? 'p. ej. cañas con amigos' : 'p. ej. nómina'}" value="${esc(st.desc)}">
        <div class="suggest" id="f-suggest"></div></div>
      <div class="field"><span class="label">Categoría</span>${catGrid(st.type, st.catId)}</div>
      ${subChips(c, st.sub)}
      <div class="field"><label>Cuenta</label>${accSelect('f-acc', st.accountId)}</div>`}
      <div class="field"><label for="f-date">Fecha</label><input class="input" id="f-date" type="date" value="${esc(st.date)}"></div>
      ${!tr ? `<label class="check"><input type="checkbox" id="f-pending" ${st.pending ? 'checked' : ''}> Pendiente de pagar${future ? ' (fecha futura)' : ''}</label>` : ''}
      ${!existing && !tr ? `<div class="field"><label>Repetir</label><select class="input" id="f-repeat">
        <option value="">No repetir</option>${Object.entries(FREQS).map(([k, l]) => `<option value="${k}" ${st.repeat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="f-note">Nota</label><input class="input" id="f-note" maxlength="200" placeholder="Opcional" value="${esc(st.note)}"></div>
      <button class="btn" id="f-save">${existing ? 'Guardar cambios' : 'Añadir'}</button>
      ${existing ? '<div class="btn-row"><button class="btn alt" id="f-dup">Duplicar</button><button class="btn danger" id="f-del">Eliminar</button></div>' : ''}
      <button class="btn ghost" data-close>Cancelar</button>`;
    const keep = () => {
      st.amount = $('#f-amount', root).value; st.date = $('#f-date', root).value; st.note = $('#f-note', root).value;
      st.accountId = $('#f-acc', root).value;
      if (tr) st.toAccountId = $('#f-to', root).value;
      else { st.desc = $('#f-desc', root).value; st.pending = $('#f-pending', root).checked; }
      if ($('#f-repeat', root)) st.repeat = $('#f-repeat', root).value;
    };
    $$('[data-t]', root).forEach((b) => (b.onclick = () => { keep(); if (st.type !== b.dataset.t) { st.type = b.dataset.t; st.catId = null; st.sub = ''; } draw(root); }));
    if (tr) $('#f-acc', root).onchange = () => { keep(); if (st.toAccountId === st.accountId) st.toAccountId = (db.accounts.find((a) => a.id !== st.accountId) || {}).id; draw(root); };
    $('#f-date', root).onchange = () => { const was = st.date > today(); keep(); if (!was && st.date > today()) st.pending = true; if (was && st.date <= today()) st.pending = false; draw(root); };
    if (!tr) {
      $$('[data-c]', root).forEach((b) => (b.onclick = () => { keep(); if (st.catId !== b.dataset.c) st.sub = ''; st.catId = b.dataset.c; sfx('click'); draw(root); }));
      $$('[data-s]', root).forEach((b) => (b.onclick = () => { keep(); st.sub = st.sub === b.dataset.s ? '' : b.dataset.s; draw(root); }));
      $('[data-newcat]', root).onclick = () => { keep(); categoryForm(null, st.type, (id) => { st.catId = id; st.sub = ''; openSheet(draw); }); };
      // Autocompletar: si ya usaste esta descripción, propone su categoría (como Cashew)
      const showSuggest = () => {
        const list = suggestTitles($('#f-desc', root).value, st.type);
        $('#f-suggest', root).innerHTML = list.map((t, i) => { const k = cat(t.catId);
          return `<button type="button" class="chip" data-sug="${i}">${k.icon} ${esc(t.desc)} <small>${esc(t.sub || k.name)}</small></button>`; }).join('');
        $$('[data-sug]', root).forEach((b) => (b.onclick = () => {
          const t = list[+b.dataset.sug]; keep();
          st.desc = t.desc; st.catId = t.catId; st.sub = t.sub; if (!parseAmount(st.amount)) st.amount = amountStr(t.amount);
          sfx('click'); draw(root);
        }));
      };
      $('#f-desc', root).oninput = showSuggest;
      $('#f-desc', root).onblur = () => {
        keep();
        const t = db.titles[norm(st.desc)];
        if (t && t.type === st.type && !st.catId && cat(t.catId)) { st.catId = t.catId; st.sub = t.sub; draw(root); }
      };
    }
    $('#f-save', root).onclick = () => {
      keep();
      const amount = parseAmount(st.amount);
      if (!(amount > 0)) return fail('Escribe un importe mayor que 0');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(st.date)) return fail('Fecha no válida');
      if (tr) { if (st.accountId === st.toAccountId) return fail('Elige dos cuentas distintas'); }
      else if (!st.catId) return fail('Elige una categoría');
      const rec = {
        id: existing ? existing.id : uid(), type: st.type, amount, desc: tr ? '' : st.desc.trim(), note: st.note.trim(), date: st.date,
        catId: tr ? '' : st.catId, sub: tr ? '' : st.sub, accountId: st.accountId, toAccountId: tr ? st.toAccountId : undefined,
        pending: tr ? false : st.pending, recurringId: existing ? existing.recurringId : undefined, created: existing ? existing.created : new Date().toISOString(),
      };
      if (existing) db.movements[db.movements.findIndex((m) => m.id === existing.id)] = rec;
      else db.movements.push(rec);
      if (!existing && st.repeat && !tr) {
        const r = { id: uid(), type: st.type, amount, desc: rec.desc || cat(st.catId).name, catId: st.catId, sub: st.sub, accountId: st.accountId,
          freq: st.repeat, next: advance(st.date, st.repeat), auto: true, active: true };
        db.recurring.push(r); rec.recurringId = r.id;
      }
      learnTitle(rec);
      save(); closeSheet();
      ui.ym = st.date.slice(0, 7);
      if (!existing) { sfx(st.type === 'income' ? 'income' : 'coin'); floatText(st.type === 'transfer' ? '🔄' : '+10 XP'); }
      render(); toast(existing ? 'Cambios guardados' : st.type === 'expense' ? `Gasto añadido · −${eur(amount)}` : st.type === 'income' ? `Ingreso añadido · +${eur(amount)}` : 'Transferencia hecha');
      checkProgress();
    };
    if (existing) {
      $('#f-del', root).onclick = () => {
        if (!confirm('¿Eliminar este movimiento?')) return;
        db.movements = db.movements.filter((m) => m.id !== existing.id);
        save(); closeSheet(); sfx('delete'); render(); toast('Movimiento eliminado');
      };
      $('#f-dup', root).onclick = () => { keep(); const copy = { ...st, date: today(), pending: false }; delete copy.id; delete copy.recurringId; closeSheet(); movementForm(null, copy); };
    }
    if (!existing && !st.amount) setTimeout(() => { if (!root.contains(document.activeElement)) $('#f-amount', root)?.focus(); }, 250);
  };
  openSheet(draw);
}

// ================================================================ categoría
function categoryForm(existing, kind, onCreated) {
  const st = existing ? { ...existing, subs: [...existing.subs] }
    : { id: null, name: '', icon: '⭐', color: COLORS[12], kind: kind || 'expense', group: 'ocio', principal: false, subs: [] };
  const used = existing ? db.movements.filter((m) => m.catId === existing.id).length : 0;
  const draw = (root) => {
    root.innerHTML = `<h3>${existing ? 'Editar categoría' : 'Nueva categoría'}</h3>
      <div class="row field">${ico(st, 56)}<div class="grow"><input class="input" id="c-name" maxlength="40" placeholder="Nombre (p. ej. MASCOTAS)" value="${esc(st.name)}" ${existing && existing.builtin ? 'disabled' : ''}></div></div>
      ${existing ? '' : `<div class="seg field"><button type="button" class="${st.kind === 'expense' ? 'on' : ''}" data-k="expense">Gasto</button>
        <button type="button" class="${st.kind === 'income' ? 'on' : ''}" data-k="income">Ingreso</button></div>`}
      ${st.kind === 'expense' ? `<div class="field"><span class="label">Grupo</span><div class="chips">
        ${Object.entries(GROUPS).map(([k, g]) => `<button type="button" class="chip ${st.group === k ? 'on' : ''}" data-g="${k}">${g.icon} ${g.name}</button>`).join('')}</div></div>`
        : `<div class="field"><span class="label">Tipo de ingreso</span><div class="chips">
        <button type="button" class="chip ${st.principal ? 'on' : ''}" data-p="1">Principal</button>
        <button type="button" class="chip ${!st.principal ? 'on' : ''}" data-p="0">Secundario / otras fuentes</button></div></div>`}
      <div class="field"><span class="label">Icono</span><div class="emoji-grid">
        ${EMOJIS.map((e) => `<button type="button" class="${e === st.icon ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
        <input class="input" id="c-emoji" style="margin-top:8px" maxlength="4" placeholder="…o escribe cualquier emoji"></div>
      <div class="field"><span class="label">Color</span><div class="swatches">
        ${COLORS.map((c) => `<button type="button" class="${c === st.color ? 'on' : ''}" style="background:${c}" data-col="${c}" aria-label="${c}"></button>`).join('')}</div></div>
      <div class="field"><span class="label">Subcategorías</span><div class="chips" style="margin-bottom:8px">
        ${st.subs.map((s, i) => `<span class="chip">${esc(s)} <button type="button" class="x" data-rm="${i}" aria-label="Quitar">✕</button></span>`).join('') || '<span class="muted">Sin subcategorías</span>'}</div>
        <div class="row"><input class="input grow" id="c-sub" maxlength="40" placeholder="Nueva subcategoría"><button type="button" class="mini" id="c-addsub">Añadir</button></div></div>
      <button class="btn" id="c-save">${existing ? 'Guardar' : 'Crear categoría'}</button>
      ${existing && !existing.builtin ? '<button class="btn danger" id="c-del">Eliminar categoría</button>' : ''}
      ${existing && existing.builtin ? '<p class="muted small center">El nombre de las categorías base no cambia porque tiene que coincidir con el Excel.</p>' : ''}
      <button class="btn ghost" data-close>Cancelar</button>`;
    const keep = () => { st.name = $('#c-name', root).value; };
    $$('[data-k]', root).forEach((b) => (b.onclick = () => { keep(); st.kind = b.dataset.k; draw(root); }));
    $$('[data-g]', root).forEach((b) => (b.onclick = () => { keep(); st.group = b.dataset.g; draw(root); }));
    $$('[data-p]', root).forEach((b) => (b.onclick = () => { keep(); st.principal = b.dataset.p === '1'; draw(root); }));
    $$('[data-e]', root).forEach((b) => (b.onclick = () => { keep(); st.icon = b.dataset.e; draw(root); }));
    $('#c-emoji', root).oninput = (e) => { const m = e.target.value.match(/\p{Extended_Pictographic}️?/u); if (m) { keep(); st.icon = m[0]; draw(root); } };
    $$('[data-col]', root).forEach((b) => (b.onclick = () => { keep(); st.color = b.dataset.col; draw(root); }));
    $$('[data-rm]', root).forEach((b) => (b.onclick = () => { keep(); st.subs.splice(+b.dataset.rm, 1); draw(root); }));
    const addSub = () => { const v = $('#c-sub', root).value.trim(); if (!v) return; keep(); if (!st.subs.includes(v)) st.subs.push(v); draw(root); $('#c-sub', root).focus(); };
    $('#c-addsub', root).onclick = addSub;
    $('#c-sub', root).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } };
    $('#c-save', root).onclick = () => {
      keep();
      const name = st.name.trim();
      if (!name) return fail('Ponle un nombre');
      if (db.categories.some((c) => c.kind === st.kind && c.id !== st.id && norm(c.name) === norm(name))) return fail('Ya existe una categoría con ese nombre');
      const pending = $('#c-sub', root).value.trim();
      if (pending && !st.subs.includes(pending)) st.subs.push(pending);
      if (existing) Object.assign(cat(existing.id), { name: existing.builtin ? existing.name : name, icon: st.icon, color: st.color, group: st.group, principal: st.principal, subs: st.subs });
      else { st.id = 'c_' + uid(); db.categories.push({ id: st.id, name, icon: st.icon, color: st.color, kind: st.kind, group: st.group, principal: st.principal, subs: st.subs, builtin: false }); }
      save();
      if (onCreated && !existing) { onCreated(st.id); checkProgress(); return; }
      closeSheet(); render(); toast(existing ? 'Categoría guardada' : 'Categoría creada'); checkProgress();
    };
    if (existing && !existing.builtin) $('#c-del', root).onclick = () => {
      const fb = cat(FALLBACK[existing.kind]);
      if (!confirm(used ? `Hay ${used} movimientos en esta categoría. Pasarán a ${fb.name}. ¿Eliminar?` : '¿Eliminar esta categoría?')) return;
      db.movements.forEach((m) => { if (m.catId === existing.id) { m.catId = fb.id; m.sub = fb.subs.includes(m.sub) ? m.sub : ''; } });
      db.recurring.forEach((r) => { if (r.catId === existing.id) { r.catId = fb.id; r.sub = ''; } });
      db.categories = db.categories.filter((c) => c.id !== existing.id);
      save(); closeSheet(); render(); toast('Categoría eliminada');
    };
  };
  openSheet(draw);
}

// ================================================================ misión (meta de ahorro)
function goalForm(existing) {
  const st = existing ? { ...existing } : { name: '', icon: '🚗', target: '', monthly: '', initial: '', startMonth: curYM(), paused: false };
  const draw = (root) => {
    root.innerHTML = `<h3>${existing ? 'Editar misión' : 'Nueva misión'}</h3>
      <div class="field"><span class="label">Jefe</span><div class="emoji-grid">${GOAL_EMOJIS.map((e) => `<button type="button" class="${e === st.icon ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label for="g-name">Nombre</label><input class="input" id="g-name" maxlength="40" placeholder="Coche nuevo, móvil, reforma, hipoteca…" value="${esc(st.name)}"></div>
      <div class="field"><label for="g-target">¿Cuánto necesitas?</label><input class="input" id="g-target" inputmode="decimal" placeholder="p. ej. 12000" value="${esc(amountStr(st.target))}"></div>
      <div class="field"><label for="g-monthly">¿Cuánto apartar al mes?</label><input class="input" id="g-monthly" inputmode="decimal" placeholder="p. ej. 300" value="${esc(amountStr(st.monthly))}">
        <p class="muted small">Si un mes el balance no llega, se aparta solo lo que haya.</p></div>
      <div class="field"><label for="g-initial">¿Ya tienes algo ahorrado para esto?</label><input class="input" id="g-initial" inputmode="decimal" placeholder="0" value="${esc(amountStr(st.initial))}"></div>
      <div class="field"><label for="g-start">Empezar en</label><input class="input" id="g-start" type="month" value="${esc(st.startMonth)}"></div>
      <label class="check"><input type="checkbox" id="g-paused" ${st.paused ? 'checked' : ''}> En pausa (no se le aparta dinero)</label>
      <button class="btn" id="g-save">${existing ? 'Guardar' : 'Crear misión'}</button>
      ${existing ? '<button class="btn danger" id="g-del">Eliminar misión</button>' : ''}
      <button class="btn ghost" data-close>Cancelar</button>`;
    const keep = () => {
      st.name = $('#g-name', root).value; st.target = $('#g-target', root).value; st.monthly = $('#g-monthly', root).value;
      st.initial = $('#g-initial', root).value; st.startMonth = $('#g-start', root).value; st.paused = $('#g-paused', root).checked;
    };
    $$('[data-e]', root).forEach((b) => (b.onclick = () => { keep(); st.icon = b.dataset.e; draw(root); }));
    $('#g-save', root).onclick = () => {
      keep();
      const target = parseAmount(st.target), monthly = parseAmount(st.monthly || '0'), initial = parseAmount(st.initial || '0');
      if (!st.name.trim()) return fail('Ponle un nombre a la misión');
      if (!(target > 0)) return fail('Indica cuánto necesitas');
      if (!(monthly >= 0) || !(initial >= 0)) return fail('Revisa las cantidades');
      if (!/^\d{4}-\d{2}$/.test(st.startMonth)) st.startMonth = curYM();
      const rec = { id: existing ? existing.id : uid(), name: st.name.trim(), icon: st.icon, target, monthly, initial, startMonth: st.startMonth, paused: st.paused,
        order: existing ? existing.order : Math.max(0, ...db.goals.map((g) => g.order + 1)) };
      if (existing) db.goals[db.goals.findIndex((g) => g.id === existing.id)] = rec; else db.goals.push(rec);
      save(); closeSheet(); render(); toast(existing ? 'Misión guardada' : '⚔️ ¡Nueva misión!'); checkProgress();
    };
    if (existing) $('#g-del', root).onclick = () => {
      if (!confirm('¿Eliminar esta misión?')) return;
      db.goals = db.goals.filter((g) => g.id !== existing.id);
      save(); closeSheet(); sfx('delete'); render(); toast('Misión eliminada');
    };
  };
  openSheet(draw);
}
function moveGoal(id, d) {
  const goals = [...db.goals].sort((a, b) => a.order - b.order);
  const i = goals.findIndex((g) => g.id === id), j = i + d;
  if (j < 0 || j >= goals.length) return;
  [goals[i], goals[j]] = [goals[j], goals[i]];
  goals.forEach((g, k) => (g.order = k));
  save(); render();
}

// ================================================================ presupuesto
function budgetForm(existing) {
  const st = existing ? { ...existing, cats: [...existing.cats], catLimits: { ...existing.catLimits } }
    : { id: null, name: '', icon: '✈️', period: 'custom', auto: false, amount: '', cats: [], catLimits: {}, start: today(), end: addDays(today(), 7) };
  const expCats = catsOf('expense').filter((c) => c.group !== 'ahorro');
  const draw = (root) => {
    root.innerHTML = `<h3>${existing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h3>
      <div class="field"><div class="emoji-grid">${['🗡️', '🛡️', '✈️', '🏖️', '🎄', '🍻', '🛒', '🎮'].map((e) => `<button type="button" class="${e === st.icon ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Nombre</label><input class="input" id="b-name" maxlength="40" placeholder="p. ej. Viaje a Roma" value="${esc(st.name)}"></div>
      <div class="field"><span class="label">Periodo</span>${seg([['month', 'Mensual'], ['week', 'Semanal'], ['custom', 'Fechas']], st.period, 'b-period').replace(/data-action="b-period"/g, 'data-per')}</div>
      ${st.period === 'custom' ? `<div class="row field"><div class="grow"><label>Desde</label><input class="input" id="b-start" type="date" value="${esc(st.start)}"></div>
        <div class="grow"><label>Hasta</label><input class="input" id="b-end" type="date" value="${esc(st.end)}"></div></div>` : ''}
      ${st.period !== 'custom' ? `<label class="check"><input type="checkbox" id="b-auto" ${st.auto ? 'checked' : ''}> Automático: ingresos × ${Math.round((1 - db.settings.savingsTarget) * 100)}% (lo que puedes gastar para ahorrar el ${Math.round(db.settings.savingsTarget * 100)}%)</label>` : ''}
      <div class="field"><label>Límite</label><input class="input" id="b-amount" inputmode="decimal" placeholder="p. ej. 400" value="${esc(amountStr(st.amount))}" ${st.auto && st.period !== 'custom' ? 'disabled' : ''}></div>
      <div class="field"><span class="label">Categorías incluidas <small>(ninguna = todas)</small></span><div class="chips">
        ${expCats.map((c) => `<button type="button" class="chip ${st.cats.includes(c.id) ? 'on' : ''}" data-bc="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}</div></div>
      <details class="field"><summary class="label">Límites por categoría (opcional)</summary>
        ${expCats.filter((c) => !st.cats.length || st.cats.includes(c.id)).map((c) => `<div class="row item">${ico(c)}<span class="grow">${esc(c.name)}</span>
          <input class="input lim" data-lim="${c.id}" inputmode="decimal" placeholder="—" value="${esc(amountStr(st.catLimits[c.id] || ''))}"></div>`).join('')}</details>
      <button class="btn" id="b-save">${existing ? 'Guardar' : 'Crear presupuesto'}</button>
      ${existing && db.budgets.length > 1 ? '<button class="btn danger" id="b-del">Eliminar</button>' : ''}
      <button class="btn ghost" data-close>Cancelar</button>`;
    const keep = () => {
      st.name = $('#b-name', root).value; st.amount = $('#b-amount', root).value;
      if ($('#b-start', root)) { st.start = $('#b-start', root).value; st.end = $('#b-end', root).value; }
      if ($('#b-auto', root)) st.auto = $('#b-auto', root).checked;
      $$('[data-lim]', root).forEach((i) => { const v = parseAmount(i.value); if (v > 0) st.catLimits[i.dataset.lim] = v; else delete st.catLimits[i.dataset.lim]; });
    };
    $$('[data-e]', root).forEach((b) => (b.onclick = () => { keep(); st.icon = b.dataset.e; draw(root); }));
    $$('[data-per]', root).forEach((b) => (b.onclick = () => { keep(); st.period = b.dataset.v; if (st.period === 'custom') st.auto = false; draw(root); }));
    if ($('#b-auto', root)) $('#b-auto', root).onchange = () => { keep(); draw(root); };
    $$('[data-bc]', root).forEach((b) => (b.onclick = () => { keep(); const i = st.cats.indexOf(b.dataset.bc); if (i >= 0) st.cats.splice(i, 1); else st.cats.push(b.dataset.bc); draw(root); }));
    $('#b-save', root).onclick = () => {
      keep();
      const amount = parseAmount(st.amount || '0');
      if (!st.name.trim()) return fail('Ponle un nombre');
      if (!st.auto && !(amount > 0)) return fail('Indica el límite');
      if (st.period === 'custom' && !(st.start && st.end && st.start <= st.end)) return fail('Revisa las fechas');
      const rec = { id: st.id || 'b_' + uid(), name: st.name.trim(), icon: st.icon, period: st.period, auto: st.auto, amount: st.auto ? 0 : amount,
        cats: st.cats, catLimits: st.catLimits, start: st.start || '', end: st.end || '' };
      if (existing) db.budgets[db.budgets.findIndex((b) => b.id === existing.id)] = rec; else db.budgets.push(rec);
      save(); closeSheet(); render(); toast('Presupuesto guardado');
    };
    if ($('#b-del', root)) $('#b-del', root).onclick = () => {
      if (!confirm('¿Eliminar este presupuesto?')) return;
      db.budgets = db.budgets.filter((b) => b.id !== existing.id); save(); closeSheet(); render();
    };
  };
  openSheet(draw);
}

// ================================================================ recurrente
function recurringForm(existing) {
  const st = existing ? { ...existing } : { type: 'expense', amount: '', desc: '', catId: null, sub: '', accountId: db.accounts[0].id, freq: 'month', next: today(), auto: true, active: true };
  const draw = (root) => {
    const c = cat(st.catId);
    root.innerHTML = `<h3>${existing ? 'Editar recurrente' : 'Nuevo recurrente'}</h3>
      <div class="seg field"><button type="button" class="${st.type === 'expense' ? 'on neg' : ''}" data-t="expense">Gasto</button>
        <button type="button" class="${st.type === 'income' ? 'on pos' : ''}" data-t="income">Ingreso</button></div>
      <div class="field"><input class="input amount-input" id="r-amount" inputmode="decimal" placeholder="0,00 €" value="${esc(amountStr(st.amount))}"></div>
      <div class="field"><label>Nombre</label><input class="input" id="r-desc" maxlength="60" placeholder="p. ej. Spotify, gimnasio, nómina" value="${esc(st.desc)}"></div>
      <div class="field"><span class="label">Categoría</span>${catGrid(st.type, st.catId)}</div>${subChips(c, st.sub)}
      <div class="field"><label>Cuenta</label>${accSelect('r-acc', st.accountId)}</div>
      <div class="field"><span class="label">Cada</span><div class="seg">${Object.entries(FREQS).map(([k, l]) => `<button type="button" class="${st.freq === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Próximo cargo</label><input class="input" id="r-next" type="date" value="${esc(st.next)}"></div>
      <label class="check"><input type="checkbox" id="r-auto" ${st.auto ? 'checked' : ''}> Apuntar automáticamente</label>
      <label class="check"><input type="checkbox" id="r-active" ${st.active ? 'checked' : ''}> Activo</label>
      <button class="btn" id="r-save">${existing ? 'Guardar' : 'Crear recurrente'}</button>
      ${existing ? '<button class="btn danger" id="r-del">Eliminar</button>' : ''}
      <button class="btn ghost" data-close>Cancelar</button>`;
    const keep = () => {
      st.amount = $('#r-amount', root).value; st.desc = $('#r-desc', root).value; st.accountId = $('#r-acc', root).value;
      st.next = $('#r-next', root).value; st.auto = $('#r-auto', root).checked; st.active = $('#r-active', root).checked;
    };
    $$('[data-t]', root).forEach((b) => (b.onclick = () => { keep(); if (st.type !== b.dataset.t) { st.type = b.dataset.t; st.catId = null; st.sub = ''; } draw(root); }));
    $$('[data-c]', root).forEach((b) => (b.onclick = () => { keep(); if (st.catId !== b.dataset.c) st.sub = ''; st.catId = b.dataset.c; draw(root); }));
    $$('[data-s]', root).forEach((b) => (b.onclick = () => { keep(); st.sub = st.sub === b.dataset.s ? '' : b.dataset.s; draw(root); }));
    $$('[data-f]', root).forEach((b) => (b.onclick = () => { keep(); st.freq = b.dataset.f; draw(root); }));
    $('[data-newcat]', root).onclick = () => { keep(); categoryForm(null, st.type, (id) => { st.catId = id; openSheet(draw); }); };
    $('#r-save', root).onclick = () => {
      keep();
      const amount = parseAmount(st.amount);
      if (!(amount > 0)) return fail('Escribe un importe');
      if (!st.catId) return fail('Elige una categoría');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(st.next)) return fail('Fecha no válida');
      const rec = { ...st, id: st.id || uid(), amount, desc: st.desc.trim() || cat(st.catId).name };
      if (existing) db.recurring[db.recurring.findIndex((r) => r.id === existing.id)] = rec; else db.recurring.push(rec);
      const n = processRecurring();
      save(); closeSheet(); render(); toast(n ? `Guardado · ${n} cargo${n > 1 ? 's' : ''} apuntado${n > 1 ? 's' : ''}` : 'Recurrente guardado'); checkProgress();
    };
    if (existing) $('#r-del', root).onclick = () => {
      if (!confirm('¿Eliminar este recurrente? Los movimientos ya apuntados se quedan.')) return;
      db.recurring = db.recurring.filter((r) => r.id !== existing.id); save(); closeSheet(); render();
    };
  };
  openSheet(draw);
}

// ================================================================ préstamo / deuda
function loanForm(existing) {
  const st = existing ? { ...existing, payments: [...existing.payments] } : { dir: 'lent', person: '', amount: '', date: today(), note: '', payments: [] };
  const draw = (root) => {
    const left = existing ? loanLeft(st) : 0;
    root.innerHTML = `<h3>${existing ? esc(st.person) : 'Nuevo préstamo o deuda'}</h3>
      <div class="seg field"><button type="button" class="${st.dir === 'lent' ? 'on pos' : ''}" data-d="lent">He prestado</button>
        <button type="button" class="${st.dir === 'borrowed' ? 'on neg' : ''}" data-d="borrowed">Me han prestado</button></div>
      <div class="field"><label>Persona</label><input class="input" id="l-person" maxlength="40" value="${esc(st.person)}"></div>
      <div class="field"><label>Importe</label><input class="input" id="l-amount" inputmode="decimal" value="${esc(amountStr(st.amount))}"></div>
      <div class="field"><label>Fecha</label><input class="input" id="l-date" type="date" value="${esc(st.date)}"></div>
      <div class="field"><label>Nota</label><input class="input" id="l-note" maxlength="100" value="${esc(st.note)}"></div>
      ${existing ? `<div class="card inset"><div class="line"><span>Pendiente</span><b>${eur(left)}</b></div>
        ${st.payments.map((p, i) => `<div class="line"><span>${shortDate(p.date)}</span><span>${eur(p.amount)} <button type="button" class="x" data-rmp="${i}">✕</button></span></div>`).join('')}
        ${left > 0 ? `<div class="row"><input class="input grow" id="l-pay" inputmode="decimal" placeholder="Pago parcial"><button type="button" class="mini" id="l-addpay">Añadir</button></div>
          <button type="button" class="btn alt" id="l-settle">✔ Saldar todo (${eur(left)})</button>` : ''}</div>` : ''}
      <button class="btn" id="l-save">Guardar</button>
      ${existing ? '<button class="btn danger" id="l-del">Eliminar</button>' : ''}
      <button class="btn ghost" data-close>Cancelar</button>`;
    const keep = () => { st.person = $('#l-person', root).value; st.amount = $('#l-amount', root).value; st.date = $('#l-date', root).value; st.note = $('#l-note', root).value; };
    $$('[data-d]', root).forEach((b) => (b.onclick = () => { keep(); st.dir = b.dataset.d; draw(root); }));
    $$('[data-rmp]', root).forEach((b) => (b.onclick = () => { keep(); st.payments.splice(+b.dataset.rmp, 1); draw(root); }));
    const addPay = (v) => { keep(); st.amount = parseAmount(st.amount); if (v > 0) st.payments.push({ date: today(), amount: Math.min(v, loanLeft(st)) }); draw(root); };
    if ($('#l-addpay', root)) $('#l-addpay', root).onclick = () => addPay(parseAmount($('#l-pay', root).value));
    if ($('#l-settle', root)) $('#l-settle', root).onclick = () => { keep(); st.amount = parseAmount(st.amount); addPay(loanLeft(st)); };
    $('#l-save', root).onclick = () => {
      keep();
      const amount = parseAmount(st.amount);
      if (!st.person.trim()) return fail('¿Quién?');
      if (!(amount > 0)) return fail('Escribe un importe');
      const rec = { ...st, id: st.id || uid(), person: st.person.trim(), amount };
      if (existing) db.loans[db.loans.findIndex((l) => l.id === existing.id)] = rec; else db.loans.push(rec);
      save(); closeSheet(); render(); toast(loanLeft(rec) <= 0 ? '🤝 ¡Saldado!' : 'Guardado'); checkProgress();
    };
    if (existing) $('#l-del', root).onclick = () => { if (!confirm('¿Eliminar?')) return; db.loans = db.loans.filter((l) => l.id !== existing.id); save(); closeSheet(); render(); };
  };
  openSheet(draw);
}

// ================================================================ cuenta
function accountForm(existing) {
  const st = existing ? { ...existing } : { name: '', icon: '💳', color: COLORS[8], initial: '' };
  const used = existing ? db.movements.some((m) => m.accountId === existing.id || m.toAccountId === existing.id) : false;
  const draw = (root) => {
    root.innerHTML = `<h3>${existing ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
      <div class="field"><div class="emoji-grid">${ACCOUNT_EMOJIS.map((e) => `<button type="button" class="${e === st.icon ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Nombre</label><input class="input" id="a-name" maxlength="30" placeholder="p. ej. Tarjeta, Revolut, Hucha" value="${esc(st.name)}"></div>
      <div class="field"><label>Saldo inicial</label><input class="input" id="a-init" inputmode="decimal" placeholder="0" value="${esc(amountStr(st.initial))}"></div>
      <div class="field"><span class="label">Color</span><div class="swatches">${COLORS.map((c) => `<button type="button" class="${c === st.color ? 'on' : ''}" style="background:${c}" data-col="${c}"></button>`).join('')}</div></div>
      <button class="btn" id="a-save">Guardar</button>
      ${existing && db.accounts.length > 1 ? `<button class="btn danger" id="a-del" ${used ? 'disabled' : ''}>Eliminar${used ? ' (tiene movimientos)' : ''}</button>` : ''}
      <button class="btn ghost" data-close>Cancelar</button>`;
    const keep = () => { st.name = $('#a-name', root).value; st.initial = $('#a-init', root).value; };
    $$('[data-e]', root).forEach((b) => (b.onclick = () => { keep(); st.icon = b.dataset.e; draw(root); }));
    $$('[data-col]', root).forEach((b) => (b.onclick = () => { keep(); st.color = b.dataset.col; draw(root); }));
    $('#a-save', root).onclick = () => {
      keep();
      const initial = parseAmount(st.initial || '0');
      if (!st.name.trim()) return fail('Ponle un nombre');
      if (isNaN(initial)) return fail('Saldo no válido');
      const rec = { id: st.id || 'a_' + uid(), name: st.name.trim(), icon: st.icon, color: st.color, initial };
      if (existing) db.accounts[db.accounts.findIndex((a) => a.id === existing.id)] = rec; else db.accounts.push(rec);
      save(); closeSheet(); render(); toast('Cuenta guardada'); checkProgress();
    };
    if ($('#a-del', root)) $('#a-del', root).onclick = () => { if (used || !confirm('¿Eliminar la cuenta?')) return; db.accounts = db.accounts.filter((a) => a.id !== existing.id); save(); closeSheet(); render(); };
  };
  openSheet(draw);
}

// ================================================================ cambio de categoría en bloque
function bulkCategory() {
  const ids = [...ui.selected];
  const kinds = new Set(ids.map((id) => db.movements.find((m) => m.id === id)?.type));
  if (kinds.size !== 1 || kinds.has('transfer')) return fail('Selecciona solo gastos o solo ingresos');
  const kind = [...kinds][0];
  openSheet((root) => {
    root.innerHTML = `<h3>Cambiar categoría de ${ids.length}</h3>${catGrid(kind, null)}<button class="btn ghost" data-close>Cancelar</button>`;
    $('[data-newcat]', root).remove();
    $$('[data-c]', root).forEach((b) => (b.onclick = () => {
      db.movements.forEach((m) => { if (ui.selected.has(m.id)) { m.catId = b.dataset.c; m.sub = ''; } });
      save(); ui.select = false; ui.selected.clear(); closeSheet(); render(); toast('Categoría cambiada');
    }));
  });
}

// ================================================================ PIN
const hashPin = async (pin) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cointrol:' + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
function pinPad(title, onDone) {
  const el = document.createElement('div');
  el.className = 'lock';
  let code = '';
  const paint = () => {
    el.innerHTML = `<div class="lock-box"><img src="icons/logo-pixel.png" alt="" class="lock-logo"><div class="lu-title">${esc(title)}</div>
      <div class="pin-dots">${[0, 1, 2, 3].map((i) => `<i class="${i < code.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => `<button type="button" data-k="${k}" ${k === '' ? 'disabled' : ''}>${k}</button>`).join('')}</div></div>`;
    $$('[data-k]', el).forEach((b) => (b.onclick = async () => {
      const k = b.dataset.k;
      if (k === '⌫') code = code.slice(0, -1); else if (code.length < 4) code += k;
      sfx('click'); paint();
      if (code.length === 4) { const ok = await onDone(code); if (ok) el.remove(); else { code = ''; el.querySelector('.pin-dots').classList.add('shake'); sfx('error'); setTimeout(paint, 400); } }
    }));
  };
  paint();
  document.body.appendChild(el);
}
function lockIfNeeded() {
  if (!db.settings.pinHash) return;
  pinPad('Introduce tu PIN', async (code) => (await hashPin(code)) === db.settings.pinHash);
}
function setPin() {
  pinPad('Nuevo PIN', async (first) => {
    setTimeout(() => pinPad('Repite el PIN', async (second) => {
      if (second !== first) { toast('Los PIN no coinciden', 'bad'); return true; }
      db.settings.pinHash = await hashPin(first); save(); render(); toast('🔐 PIN activado'); return true;
    }), 50);
    return true;
  });
}

// ================================================================ importar del Excel
let importRows = [];
function parseImportDate(s, fallback) {
  s = String(s || '').trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + +s * 86400000); return d.toISOString().slice(0, 10); } // número de serie de Excel
  return fallback;
}
function importPreview() {
  const text = $('#imp-text').value;
  const acc = $('#imp-acc').value, fb = $('#imp-date').value || today();
  const byName = Object.fromEntries(catsOf('expense').map((c) => [norm(c.name), c]));
  const unknown = new Set();
  let dup = 0;
  importRows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = line.includes('\t') ? line.split('\t') : line.split(';');
    const amount = parseAmount(String(f[1] || '').replace(/"/g, ''));
    if (!(amount > 0)) continue;
    const date = parseImportDate(f[0], fb);
    const desc = (f[2] || '').trim();
    let c = byName[norm(f[3])];
    if (!c) { if (f[3] && f[3].trim()) unknown.add(f[3].trim()); c = cat('varios'); }
    const sub = (f[4] || '').trim();
    if (db.movements.some((m) => m.type === 'expense' && m.date === date && m.amount === amount && norm(m.desc) === norm(desc))) { dup++; continue; }
    importRows.push({ id: uid(), type: 'expense', amount, desc, note: '', date, catId: c.id, sub, accountId: acc, pending: false, created: new Date().toISOString() });
  }
  const total = importRows.reduce((a, r) => a + r.amount, 0);
  $('#imp-out').innerHTML = `<div class="card inset"><div class="line"><span>Gastos a importar</span><b>${importRows.length}</b></div>
    <div class="line"><span>Total</span><b>${eur(total)}</b></div>${dup ? `<div class="line"><span>Repetidos (se saltan)</span><b>${dup}</b></div>` : ''}
    ${unknown.size ? `<div class="warn">Categorías que no existen en la app (irán a VARIOS): ${[...unknown].map(esc).join(', ')}</div>` : ''}
    ${importRows.length ? '<button class="btn" data-action="imp-commit">📥 Importar</button>' : '<p class="muted">No se ha encontrado ninguna fila válida.</p>'}</div>`;
}
function importCommit() {
  if (!importRows.length) return;
  db.movements.push(...importRows);
  importRows.forEach((r) => learnTitle(r));
  const n = importRows.length; importRows = [];
  save(); sfx('income'); ui.sub = null; ui.view = 'diario'; render(); toast(`${n} gastos importados`); checkProgress();
}
