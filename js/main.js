'use strict';
/* Cointrol · eventos e inicio. */

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
  sfx('coin'); toast(okMsg);
}
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function markExported() { db.meta.exported = (db.meta.exported || 0) + 1; save(); checkProgress(); }

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return closeSheet();
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    ui.view = nav.dataset.nav; ui.sub = null; ui.select = false; ui.selected.clear();
    sfx('click'); render(); window.scrollTo(0, 0); return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action, id = el.dataset.id;
  const mov = () => db.movements.find((m) => m.id === id);
  switch (a) {
    case 'month': ui.ym = addMonths(ui.ym, +el.dataset.d); render(); break;
    case 'year': ui.year += +el.dataset.d; render(); break;
    case 'exmonth': ui.exYM = addMonths(ui.exYM, +el.dataset.d); render(); break;
    case 'filter': ui.filter = el.dataset.v; render(); break;
    case 'stats-mode': ui.statsMode = el.dataset.v; render(); break;
    case 'quest-tab': ui.questTab = el.dataset.v; render(); break;
    case 'edit-mov': movementForm(mov()); break;
    case 'select-mode': ui.select = !ui.select; ui.selected.clear(); render(); break;
    case 'toggle-sel': ui.selected.has(id) ? ui.selected.delete(id) : ui.selected.add(id); render(); break;
    case 'sel-all': filteredMovs().forEach((m) => ui.selected.add(m.id)); render(); break;
    case 'sel-cat': bulkCategory(); break;
    case 'sel-del':
      if (!confirm(`¿Borrar ${ui.selected.size} movimientos?`)) break;
      db.movements = db.movements.filter((m) => !ui.selected.has(m.id));
      save(); sfx('delete'); toast(ui.selected.size === 1 ? '1 movimiento borrado' : `${ui.selected.size} movimientos borrados`); ui.selected.clear(); ui.select = false; render();
      break;
    case 'pay': { const m = mov(); if (!m) break; m.pending = false; if (m.date > today()) m.date = today(); save(); sfx('coin'); render(); toast('Pagado ✔'); checkProgress(); break; }
    case 'skip': if (confirm('¿Saltar este pago? Se borrará de la lista.')) { db.movements = db.movements.filter((m) => m.id !== id); save(); render(); } break;
    case 'new-goal': goalForm(null); break;
    case 'edit-goal': goalForm(db.goals.find((g) => g.id === id)); break;
    case 'goal-up': moveGoal(id, -1); break;
    case 'goal-down': moveGoal(id, 1); break;
    case 'sub': ui.sub = el.dataset.sub || null; sfx('click'); render(); window.scrollTo(0, 0); break;
    case 'new-cat': categoryForm(null, 'expense'); break;
    case 'edit-cat': categoryForm(cat(id)); break;
    case 'new-budget': budgetForm(null); break;
    case 'edit-budget': budgetForm(db.budgets.find((b) => b.id === id)); break;
    case 'new-rec': recurringForm(null); break;
    case 'edit-rec': recurringForm(db.recurring.find((r) => r.id === id)); break;
    case 'new-loan': loanForm(null); break;
    case 'edit-loan': loanForm(db.loans.find((l) => l.id === id)); break;
    case 'new-acc': accountForm(null); break;
    case 'edit-acc': accountForm(account(id)); break;
    case 'new-transfer':
      if (db.accounts.length < 2) { toast('Necesitas al menos dos cuentas', 'bad'); break; }
      movementForm(null, { type: 'transfer' }); break;
    case 'copy-exp': {
      const { exp } = excelRows(ui.exYM);
      copyText(tsv(db.settings.xlHeader ? [XL_HEAD, ...exp] : exp), `${exp.length} gastos copiados · pégalos en B23`); markExported();
      break;
    }
    case 'copy-principal': { const { principal, num } = excelRows(ui.exYM); copyText(num(principal), 'Ingreso principal copiado · pégalo en C5'); markExported(); break; }
    case 'copy-sec': { const { sec } = excelRows(ui.exYM); copyText(tsv(sec), 'Ingresos secundarios copiados · pégalos en B7'); markExported(); break; }
    case 'csv': {
      const { exp } = excelRows(ui.exYM);
      const csv = '﻿' + [XL_HEAD, ...exp].map((r) => r.map((v) => `"${cleanCell(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
      download(`cointrol-gastos-${ui.exYM}.csv`, csv, 'text/csv;charset=utf-8'); markExported();
      break;
    }
    case 'imp-preview': importPreview(); break;
    case 'imp-commit': importCommit(); break;
    case 'avatar': db.settings.avatar = el.dataset.v; save(); render(); break;
    case 'save-name': db.settings.playerName = $('#set-name').value.trim() || 'Jugador'; save(); render(); toast('Guardado'); break;
    case 'save-target': {
      const v = Number($('#target').value);
      if (!(v >= 0 && v <= 100)) { toast('Pon un número entre 0 y 100', 'bad'); break; }
      db.settings.savingsTarget = v / 100; save(); toast('Objetivo guardado'); render();
      break;
    }
    case 'pin-on': setPin(); break;
    case 'pin-off': if (confirm('¿Quitar el PIN?')) { db.settings.pinHash = ''; save(); render(); } break;
    case 'backup':
      db.meta.backups = (db.meta.backups || 0) + 1; save();
      download(`cointrol-partida-${today()}.json`, JSON.stringify(db, null, 1), 'application/json');
      toast('💾 Partida guardada'); checkProgress();
      break;
    case 'restore': $('#restore-file').click(); break;
    case 'wipe':
      if (confirm('Se borrarán TODOS tus movimientos, metas, cuentas y categorías personalizadas. ¿Seguro?') && confirm('Última confirmación: ¿borrar todo?')) {
        db = freshDB(); save(); render(); toast('Datos borrados');
      }
      break;
    case 'install':
      if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; render(); }); }
      break;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.setting) { db.settings[t.dataset.setting] = t.checked; save(); render(); }
  if (t.dataset.home) { db.settings.home[t.dataset.home] = t.checked; save(); }
  if (t.dataset.filter) { ui[t.dataset.filter] = t.value; render(); }
  if (t.id === 'restore-file' && t.files[0]) {
    t.files[0].text().then((txt) => {
      const data = JSON.parse(txt);
      if (!data || !Array.isArray(data.movements) || !Array.isArray(data.categories)) throw new Error('formato');
      if (!confirm(`La copia tiene ${data.movements.length} movimientos. Sustituirá los datos actuales. ¿Continuar?`)) return;
      db = migrate(data); save(); render(); toast('📂 Partida cargada'); checkProgress(true);
    }).catch(() => toast('Ese archivo no es una copia de Cointrol', 'bad'));
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    ui.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const s = $('#search'); s.focus(); s.setSelectionRange(pos, pos);
  }
});

$('#fab').addEventListener('click', () => { sfx('click'); movementForm(null); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

// ---- instalación y modo sin conexión
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (ui.view === 'mochila') render(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---- arranque
const created = processRecurring();
render();
lockIfNeeded();
checkProgress(true); // los logros que ya tuvieras se marcan sin fanfarria
if (created) toast(`🔁 ${created} pago${created > 1 ? 's' : ''} recurrente${created > 1 ? 's' : ''} apuntado${created > 1 ? 's' : ''}`);
// Vuelve a mirar los recurrentes al volver a la app (por si cambió el día)
document.addEventListener('visibilitychange', () => { if (!document.hidden && processRecurring()) render(); });
