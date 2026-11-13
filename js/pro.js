'use strict';
/* Cointrol · ediciones Gratis / Pro (apps de prueba del modelo para Play Store).
   Sin window.EDITION (tu versión completa) todo está desbloqueado y no hay anuncios.
   En las demos, los anuncios son simulados y las compras no cobran nada. */

const FREE_LIMITS = { customCats: 3, accounts: 2, budgets: 1, goals: 1, recurring: 3, avatars: 4 };
const PLANS = [
  { id: 'year', name: 'Anual', price: '9,99 €', per: '/año', note: '0,83 €/mes · 7 días gratis', tag: 'Más elegido' },
  { id: 'month', name: 'Mensual', price: '1,99 €', per: '/mes', note: 'Cancela cuando quieras' },
  { id: 'life', name: 'Para siempre', price: '24,99 €', per: 'pago único', note: 'Lanzamiento: 14,99 €' },
];
const PRO_FEATURES = [
  ['∞', 'Categorías, cuentas, presupuestos, misiones y recurrentes sin límite'],
  ['📊', 'Estadísticas del año y comparativas mes a mes'],
  ['📋', 'Pasar al Excel cualquier mes e importar desde el Excel'],
  ['🗡️', 'Límites por categoría dentro de los presupuestos'],
  ['🤝', 'Préstamos y deudas'],
  ['🔐', 'Bloqueo con PIN'],
  ['🧙', 'Todos los avatares'],
  ['🚫', 'Sin anuncios'],
];
const REASONS = {
  customCats: `En la versión gratis puedes crear ${FREE_LIMITS.customCats} categorías propias.`,
  accounts: `En la versión gratis puedes tener ${FREE_LIMITS.accounts} cuentas.`,
  budgets: 'En la versión gratis tienes el presupuesto del mes. Con Pro, todos los que quieras (viajes, ocio…).',
  goals: `En la versión gratis puedes tener ${FREE_LIMITS.goals} misión activa.`,
  recurring: `En la versión gratis puedes tener ${FREE_LIMITS.recurring} pagos recurrentes.`,
  year: 'Las estadísticas del año son de Pro.',
  excelMonths: 'En la versión gratis puedes pasar al Excel el mes actual.',
  import: 'Importar desde el Excel es de Pro.',
  loans: 'Préstamos y deudas es de Pro.',
  pin: 'El bloqueo con PIN es de Pro.',
  avatars: 'Este avatar es de Pro.',
  catLimits: 'Los límites por categoría son de Pro.',
};

const isEdition = () => !!EDITION;
function isPro() {
  if (!EDITION || EDITION.tier === 'pro') return true;
  const m = db.meta;
  return !!m.demoPro || (m.trialUntil || 0) > Date.now();
}
const showAds = () => !!EDITION && !isPro();
function countOf(kind) {
  return {
    customCats: db.categories.filter((c) => !c.builtin).length, accounts: db.accounts.length,
    budgets: db.budgets.length, goals: db.goals.length, recurring: db.recurring.length,
  }[kind];
}
// ¿Se puede crear uno más? Si no, enseña la pantalla de Pro.
function canAdd(kind) {
  if (isPro() || countOf(kind) < FREE_LIMITS[kind]) return true;
  paywall(kind); return false;
}
function requirePro(reason) {
  if (isPro()) return true;
  paywall(reason); return false;
}
const lockTag = (reason) => (isPro() ? '' : ' <span class="pro-tag">PRO</span>');

// ================================================================ anuncios simulados
const AD_SAMPLES = [
  ['🏦', 'Banco Ejemplo', 'Abre tu cuenta sin comisiones'],
  ['🛒', 'Supermercado Demo', 'Ofertas de la semana'],
  ['🎧', 'Música Demo', '3 meses gratis'],
  ['✈️', 'Viajes Demo', 'Vuelos desde 19 €'],
];
function adBanner() {
  if (!showAds()) return '';
  const [i, t, d] = AD_SAMPLES[Math.floor(Math.random() * AD_SAMPLES.length)];
  return `<div class="ad"><span class="ad-label">Anuncio · ejemplo</span><span class="ad-ico">${i}</span>
    <span class="grow"><b>${t}</b><span>${d}</span></span><button class="mini" data-action="paywall" data-v="ads">Quitar</button></div>`;
}
// Anuncio a pantalla completa: solo tras exportar y como mucho uno cada 3 minutos
let lastInterstitial = 0;
function maybeInterstitial(force = false) {
  if (!showAds() && !force) return;
  if (!force && Date.now() - lastInterstitial < 180000) return;
  lastInterstitial = Date.now();
  fullAd('Anuncio · ejemplo', 'Aquí iría un anuncio a pantalla completa de AdMob.', 5, () => {});
}
function fullAd(label, text, secs, onDone) {
  const el = document.createElement('div');
  el.className = 'levelup ad-full';
  const [i, t, d] = AD_SAMPLES[Math.floor(Math.random() * AD_SAMPLES.length)];
  el.innerHTML = `<div class="levelup-box"><div class="ad-label">${esc(label)}</div><div class="ad-big">${i}</div>
    <div class="lu-title">${esc(t)}</div><p>${esc(d)}</p><p class="muted small">${esc(text)}</p>
    <button class="btn" type="button" disabled>Cerrar en ${secs}</button></div>`;
  document.body.appendChild(el);
  syncHistory();
  const btn = el.querySelector('button');
  let n = secs;
  const t0 = setInterval(() => {
    n--;
    if (n > 0) { btn.textContent = `Cerrar en ${n}`; return; }
    clearInterval(t0); btn.disabled = false; btn.textContent = 'Cerrar';
    onDone();
  }, 1000);
  btn.onclick = () => { el.remove(); syncHistory(); };
}
function rewardedAd() {
  fullAd('Anuncio con recompensa · ejemplo', 'Al terminar tendrás Pro durante 24 horas.', 5, () => {
    db.meta.trialUntil = Date.now() + 24 * 3600 * 1000; db.meta.lastReward = today(); save(); render();
    toast('⭐ Pro desbloqueado durante 24 h');
  });
}

// ================================================================ pantalla de Pro (paywall)
let selectedPlan = 'year';
function proPanel(reason) {
  const pro = isPro();
  const trial = (db.meta.trialUntil || 0) > Date.now();
  const left = trial ? Math.ceil((db.meta.trialUntil - Date.now()) / 3600000) : 0;
  return `<div class="pro-head"><div class="pro-star">⭐</div><div class="lu-title">COINTROL PRO</div>
    ${reason && REASONS[reason] ? `<p class="warn">${esc(REASONS[reason])}</p>` : ''}
    ${pro ? `<p class="pos">${EDITION && EDITION.tier === 'pro' ? 'Tienes Pro (versión de prueba Pro).' : trial ? `Tienes Pro gratis durante ${left} h más.` : 'Tienes Pro activado (compra simulada).'}</p>` : ''}</div>
    <div class="pro-feats">${PRO_FEATURES.map(([i, t]) => `<div class="row item"><span class="pro-fi">${i}</span><span class="grow">${t}</span></div>`).join('')}</div>
    ${pro ? '' : `<div class="plans">${PLANS.map((p) => `<button type="button" class="plan ${selectedPlan === p.id ? 'on' : ''}" data-plan="${p.id}">
      ${p.tag ? `<span class="plan-tag">${p.tag}</span>` : ''}<b>${p.name}</b><span class="plan-price">${p.price}</span><small>${p.per}</small><span class="plan-note">${p.note}</span></button>`).join('')}</div>
    <button class="btn" data-action="buy">${selectedPlan === 'year' ? 'Empezar 7 días gratis' : 'Comprar'}</button>
    ${db.meta.lastReward !== today() ? '<button class="btn alt" data-action="reward">🎬 Ver un anuncio → Pro gratis 24 h</button>' : ''}
    <p class="muted small center">Demo: no se cobra nada. En Play Store el pago lo gestiona Google Play y se puede cancelar desde la propia tienda.</p>`}
    <button class="btn ghost" data-action="restore-buy">Restaurar compras</button>`;
}
function paywall(reason) {
  sfx('click');
  openSheet((root) => {
    root.innerHTML = proPanel(reason) + '<button class="btn ghost" data-close>Ahora no</button>';
    $$('[data-plan]', root).forEach((b) => (b.onclick = () => { selectedPlan = b.dataset.plan; paywall(reason); }));
  });
}
function viewPro() {
  return `<div class="card pro-card">${proPanel()}</div>${EDITION ? `<div class="card"><h2>📦 Esta app</h2><div class="lines">
    <div class="line"><span>Edición</span><b>${esc(EDITION.label)}</b></div><div class="line"><span>Estado</span><b class="${isPro() ? 'pos' : ''}">${isPro() ? 'Pro' : 'Gratis'}</b></div></div></div>` : ''}`;
}
function buyDemo() {
  const p = PLANS.find((x) => x.id === selectedPlan);
  if (!confirm(`DEMO · ${p.name} (${p.price} ${p.per})\n\nEsto es una simulación: no se cobra nada. ¿Activar Pro en esta app de prueba?`)) return;
  db.meta.demoPro = true; db.meta.plan = p.id; save(); closeSheet(); render();
  sfx('levelup'); banner('⭐ ¡Bienvenido a Pro!', p.name);
}

// ================================================================ panel de dueño / desarrollador
// Se abre tocando 7 veces la versión en Ajustes. La primera vez pide crear un código.
let devTaps = 0, devTimer;
function devTap(el) {
  if (!EDITION) return;
  devTaps++; clearTimeout(devTimer); devTimer = setTimeout(() => (devTaps = 0), 3000);
  if (devTaps >= 4 && devTaps < 7 && el) el.textContent = `${7 - devTaps} toques más para el modo dueño`;
  if (devTaps < 7) return;
  devTaps = 0;
  if (!db.meta.devHash) {
    pinPad('Crea tu código de dueño', async (a) => {
      setTimeout(() => pinPad('Repite el código', async (b) => {
        if (a !== b) { toast('No coinciden', 'bad'); return true; }
        db.meta.devHash = await hashPin(a); save(); setTimeout(devPanel, 50); return true;
      }), 50);
      return true;
    });
  } else {
    pinPad('Código de dueño', async (c) => { const ok = (await hashPin(c)) === db.meta.devHash; if (ok) setTimeout(devPanel, 50); return ok; });
  }
}
function devPanel() {
  openSheet((root) => {
    root.innerHTML = `<h3>🛠️ Modo dueño</h3>
      <div class="card inset"><div class="lines">
        <div class="line"><span>Edición</span><b>${esc(EDITION.label)}</b></div>
        <div class="line"><span>Estado</span><b>${isPro() ? 'Pro' : 'Gratis'}</b></div>
        <div class="line"><span>Datos</span><b>${esc(KEY)}</b></div>
        <div class="line"><span>Movimientos</span><b>${db.movements.length}</b></div></div></div>
      ${EDITION.tier === 'free' ? `<label class="check"><input type="checkbox" id="dv-pro" ${db.meta.demoPro ? 'checked' : ''}> Pro activado (simula una compra)</label>
        <button class="btn alt" id="dv-trial">Quitar el Pro de 24 h del anuncio</button>
        <button class="btn alt" id="dv-ad">Ver anuncio a pantalla completa</button>` : ''}
      <button class="btn alt" id="dv-seed">Cargar un mes de datos de ejemplo</button>
      <button class="btn danger" id="dv-reset">Empezar como usuario nuevo (borra todo)</button>
      <p class="muted small">En la app real de Play Store este panel no existe: el dueño entra con una cuenta de «prueba de licencias» de Google Play.</p>
      <button class="btn ghost" data-close>Cerrar</button>`;
    if ($('#dv-pro', root)) {
      $('#dv-pro', root).onchange = (e) => { db.meta.demoPro = e.target.checked; save(); render(); toast(e.target.checked ? 'Pro activado' : 'Vuelves a Gratis'); };
      $('#dv-trial', root).onclick = () => { db.meta.trialUntil = 0; db.meta.lastReward = ''; save(); render(); toast('Prueba de 24 h quitada'); };
      $('#dv-ad', root).onclick = () => { closeSheet(); maybeInterstitial(true); };
    }
    $('#dv-seed', root).onclick = () => { seedDemo(); closeSheet(); render(); toast('Datos de ejemplo cargados'); };
    $('#dv-reset', root).onclick = () => {
      if (!confirm('¿Borrar todos los datos de esta app de prueba?')) return;
      db = freshDB(); save(); closeSheet(); ui.view = 'base'; ui.sub = null; render(); toast('App como recién instalada');
    };
  });
}
function seedDemo() {
  const ym = curYM(), d = (n) => `${ym}-${pad(Math.min(n, +today().slice(8)))}`;
  const rows = [
    ['income', 1500, 'Nómina', 'nomina', 'Nómina', 1], ['income', 40, 'venta Wallapop', 'otros_ingresos', 'Venta (Wallapop, etc.)', 2],
    ['expense', 27, 'gym', 'deporte', 'Gimnasio', 2], ['expense', 8, 'bono bus', 'servicios', 'Transporte', 2],
    ['expense', 6.5, 'spoti premium', 'servicios', 'Suscripciones', 3], ['expense', 85, 'compra semanal', 'comida', 'Supermercado', 4],
    ['expense', 12.5, 'cañas con amigos', 'restaurantes', 'Tomar algo', 5], ['expense', 0.9, 'cafes curro', 'cafes', 'Cafés', 6],
    ['expense', 15.61, 'juego steam', 'ocio', 'Videojuegos', 7], ['expense', 6.95, 'ibuprofeno', 'salud', 'Medicamentos', 8],
    ['expense', 200, 'indexado', 'inversion', 'Fondos / acciones', 1],
  ];
  for (const [type, amount, desc, catId, sub, day] of rows) {
    const m = { id: uid(), type, amount, desc, note: '', date: d(day), catId, sub, accountId: db.accounts[0].id, pending: false, created: new Date().toISOString() };
    db.movements.push(m); learnTitle(m);
  }
  save(); checkProgress(true);
}
