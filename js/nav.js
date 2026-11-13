'use strict';
/* Cointrol · botón «atrás» del móvil y gesto de deslizar.
   Mientras no estés en la pantalla Base sin nada abierto, se mantiene una entrada extra en el
   historial. Al pulsar atrás (o deslizar desde el borde), Android la consume y aquí se cierra lo
   que esté encima o se sube un nivel. En Base, atrás sale de la app como en cualquier otra. */

const Nav = { guard: false, pendingBack: false };

const topLayer = () => $('.lock') || $('.levelup') || (!$('#sheet').hidden ? $('#sheet') : null);
const atRoot = () => !topLayer() && ui.view === 'base' && !ui.sub && !ui.select;

function syncHistory() {
  if (Nav.pendingBack) return; // se vuelve a sincronizar al llegar el «popstate»
  const need = !atRoot();
  if (need && !Nav.guard) { history.pushState({ cointrol: 1 }, ''); Nav.guard = true; }
  else if (!need && Nav.guard) { Nav.pendingBack = true; Nav.guard = false; history.back(); }
}

function handleBack() {
  const layer = topLayer();
  if (layer) {
    if (layer.classList.contains('boot')) return;          // el PIN de inicio no se salta
    if (layer.id === 'sheet') return closeSheet();
    layer.remove(); return;                                 // subida de nivel, nuevo PIN…
  }
  if (ui.select) { ui.select = false; ui.selected.clear(); }
  else if (ui.sub) ui.sub = null;
  else ui.view = 'base';
  render(); window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => {
  if (Nav.pendingBack) { Nav.pendingBack = false; syncHistory(); return; } // retroceso nuestro
  Nav.guard = false; // el usuario ha pulsado atrás
  handleBack();
  syncHistory();
});

// Deslizar hacia abajo un formulario para cerrarlo
(() => {
  let y0 = null;
  document.addEventListener('touchstart', (e) => {
    const p = e.target.closest('.sheet-panel');
    y0 = p && p.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (y0 === null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    if (dy > 110 && !$('#sheet').hidden) closeSheet();
  }, { passive: true });
})();
