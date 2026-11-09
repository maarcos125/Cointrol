'use strict';
/* Cointrol · capa de videojuego: experiencia, niveles, logros, sonidos y efectos. */

// ================================================================ experiencia y niveles
// La experiencia se calcula a partir de tus datos, así nunca se desajusta.
function closedMonths() {
  const yms = new Set(db.movements.filter(isReal).map((m) => m.date.slice(0, 7)));
  return [...yms].filter((ym) => ym < curYM()).sort();
}
function gameStats() {
  const real = db.movements.filter(isReal);
  const months = closedMonths().map(monthStats);
  const plan = goalPlan();
  const st = streaks();
  const b = db.budgets.find((x) => x.id === 'b_mes') || db.budgets[0];
  const budgetOk = b ? closedMonths().filter((ym) => { const s = budgetStatus(b, `${ym}-15`); return s.limit > 0 && s.spent <= s.limit; }).length : 0;
  return {
    movs: real.length,
    days: new Set(real.map((m) => m.date)).size,
    monthsTarget: months.filter((s) => s.inc > 0 && s.diff >= 0).length,
    monthsMonk: months.filter((s) => s.inc > 0 && s.byGroup.ocio < s.inc * 0.1).length,
    budgetOk,
    goals: db.goals.length,
    goalsDone: db.goals.filter((g) => plan.res[g.id] && plan.res[g.id].saved >= g.target).length,
    streak: st.cur, bestStreak: st.best,
    customCats: db.categories.filter((c) => !c.builtin).length,
    accounts: db.accounts.length,
    recurring: db.recurring.length,
    loans: db.loans.length,
    coffeeMax: Math.max(0, ...Object.values(real.filter((m) => m.catId === 'cafes').reduce((a, m) => ((a[m.date.slice(0, 7)] = (a[m.date.slice(0, 7)] || 0) + 1), a), {}))),
    exported: db.meta.exported, backups: db.meta.backups,
  };
}
function xpOf(g) {
  return g.movs * 10 + g.days * 15 + g.monthsTarget * 300 + g.budgetOk * 150 + g.goals * 50 + g.goalsDone * 250 + g.bestStreak * 5 + Object.keys(db.meta.unlocked).length * 40;
}
const levelOf = (xp) => Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2));
const xpFor = (lv) => 50 * lv * (lv - 1);
const TITLES = [
  [1, 'Bolsillo roto'], [3, 'Hucha de barro'], [5, 'Cofre de madera'], [8, 'Cofre de hierro'],
  [12, 'Cofre de oro'], [16, 'Cámara del tesoro'], [20, 'Dragón del ahorro'], [30, 'Leyenda de Cointrol'],
];
const titleOf = (lv) => TITLES.filter(([l]) => lv >= l).pop()[1];
function player() {
  const g = gameStats();
  const xp = xpOf(g);
  const lv = levelOf(xp);
  return { g, xp, lv, title: titleOf(lv), from: xpFor(lv), to: xpFor(lv + 1) };
}

// ================================================================ logros
const ACHIEVEMENTS = [
  { id: 'first', icon: '🪙', name: 'Primera moneda', desc: 'Registra tu primer movimiento', ok: (g) => g.movs >= 1 },
  { id: 'm50', icon: '📜', name: 'Cronista', desc: 'Registra 50 movimientos', ok: (g) => g.movs >= 50 },
  { id: 'm250', icon: '📚', name: 'Archivista', desc: 'Registra 250 movimientos', ok: (g) => g.movs >= 250 },
  { id: 's3', icon: '🔥', name: 'Calentando motores', desc: 'Racha de 3 días apuntando', ok: (g) => g.bestStreak >= 3 },
  { id: 's7', icon: '🔥', name: 'Racha de fuego', desc: 'Racha de 7 días apuntando', ok: (g) => g.bestStreak >= 7 },
  { id: 's30', icon: '☄️', name: 'Imparable', desc: 'Racha de 30 días apuntando', ok: (g) => g.bestStreak >= 30 },
  { id: 't1', icon: '🛡️', name: 'Escudo del 70%', desc: 'Cierra un mes cumpliendo el objetivo de ahorro', ok: (g) => g.monthsTarget >= 1 },
  { id: 't3', icon: '🏰', name: 'Fortaleza', desc: 'Cumple el objetivo de ahorro en 3 meses', ok: (g) => g.monthsTarget >= 3 },
  { id: 't12', icon: '👑', name: 'Rey del ahorro', desc: 'Cumple el objetivo de ahorro en 12 meses', ok: (g) => g.monthsTarget >= 12 },
  { id: 'b1', icon: '🗡️', name: 'Disciplina', desc: 'Termina un mes sin pasarte del presupuesto', ok: (g) => g.budgetOk >= 1 },
  { id: 'monk', icon: '🧘', name: 'Monje', desc: 'Un mes con ocio por debajo del 10% de tus ingresos', ok: (g) => g.monthsMonk >= 1 },
  { id: 'q1', icon: '🎯', name: 'Primera misión', desc: 'Crea una meta de ahorro', ok: (g) => g.goals >= 1 },
  { id: 'q1done', icon: '🏆', name: 'Jefe derrotado', desc: 'Completa una meta de ahorro', ok: (g) => g.goalsDone >= 1 },
  { id: 'q3done', icon: '🐉', name: 'Matadragones', desc: 'Completa 3 metas de ahorro', ok: (g) => g.goalsDone >= 3 },
  { id: 'excel', icon: '📋', name: 'Escriba del Excel', desc: 'Pasa un mes al Excel', ok: (g) => g.exported >= 1 },
  { id: 'alch', icon: '🧪', name: 'Alquimista', desc: 'Crea una categoría propia', ok: (g) => g.customCats >= 1 },
  { id: 'bank', icon: '🏦', name: 'Banquero', desc: 'Ten 3 cuentas', ok: (g) => g.accounts >= 3 },
  { id: 'auto', icon: '🔁', name: 'Piloto automático', desc: 'Crea un pago recurrente', ok: (g) => g.recurring >= 1 },
  { id: 'loan', icon: '🤝', name: 'Prestamista', desc: 'Apunta un préstamo o una deuda', ok: (g) => g.loans >= 1 },
  { id: 'coffee', icon: '☕', name: 'Adicto a la máquina', desc: '20 cafés o visitas a la máquina en un mes', ok: (g) => g.coffeeMax >= 20 },
  { id: 'save', icon: '💾', name: 'Guardar partida', desc: 'Haz una copia de seguridad', ok: (g) => g.backups >= 1 },
];

// Comprueba logros y subidas de nivel tras cada cambio
function checkProgress(silent = false) {
  const p = player();
  const fresh = ACHIEVEMENTS.filter((a) => !db.meta.unlocked[a.id] && a.ok(p.g));
  fresh.forEach((a) => (db.meta.unlocked[a.id] = today()));
  const p2 = fresh.length ? player() : p;
  const up = p2.lv > (db.meta.level || 1);
  db.meta.level = Math.max(db.meta.level || 1, p2.lv);
  if (fresh.length || up) save();
  if (silent) return;
  let delay = 0;
  fresh.forEach((a) => { setTimeout(() => { sfx('achievement'); banner(`${a.icon} ¡Logro desbloqueado!`, a.name); }, delay); delay += 1900; });
  if (up) setTimeout(() => levelUp(p2), delay);
}

// ================================================================ sonido 8 bits (WebAudio, sin archivos)
let actx;
function sfx(kind) {
  if (!db.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const seqs = {
      coin: [[988, 0.07], [1319, 0.18]],
      income: [[784, 0.07], [988, 0.07], [1319, 0.2]],
      click: [[660, 0.04]],
      error: [[196, 0.12], [147, 0.2]],
      achievement: [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.25]],
      levelup: [[392, 0.08], [523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.08], [1319, 0.35]],
      delete: [[440, 0.06], [330, 0.06], [220, 0.12]],
    };
    let t = actx.currentTime;
    for (const [f, d] of seqs[kind] || seqs.click) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d);
      t += d * 0.9;
    }
  } catch { /* sin audio */ }
  if (navigator.vibrate && ['error', 'levelup', 'achievement'].includes(kind)) navigator.vibrate(kind === 'error' ? 80 : [30, 40, 30]);
}

// ================================================================ efectos visuales
function floatText(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'float-xp ' + cls; el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
function banner(title, sub) {
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 1600);
  setTimeout(() => el.remove(), 2000);
}
function levelUp(p) {
  sfx('levelup');
  const el = document.createElement('div');
  el.className = 'levelup';
  el.innerHTML = `<div class="levelup-box"><div class="lu-stars">✦ ✦ ✦</div><div class="lu-title">¡SUBES DE NIVEL!</div>
    <div class="lu-level">NV ${p.lv}</div><div class="lu-sub">${esc(p.title)}</div><button class="btn" type="button">Continuar</button></div>`;
  document.body.appendChild(el);
  el.querySelector('button').onclick = () => el.remove();
}
