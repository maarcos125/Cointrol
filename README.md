# Cointrol

Hay dos versiones de la app en este repositorio:

- **Cointrol** (raíz): estilo de videojuego retro. https://maarcos125.github.io/Cointrol/
- **Cointrol Clásico** (`clasica/`): diseño limpio al estilo de Cashew (Material You, modo claro y oscuro, color de acento), sin niveles, logros ni misiones; las metas se llaman «Objetivos». https://maarcos125.github.io/Cointrol/clasica/

Las dos tienen las mismas funciones de control de gastos y exportación al Excel, se instalan por separado y guardan sus datos por separado. Cointrol Clásico puede copiar los datos de la versión videojuego (Más → Importar del Excel).

## Versión videojuego

App para el móvil para controlar gastos, ingresos y ahorro, con estilo de videojuego retro. Es una app web instalable (PWA): se instala desde Chrome en Android, funciona sin conexión y **guarda los datos solo en el móvil** (no hay cuentas ni servidores).

## Funciones

**Tu caso (el Excel)**
- Categorías y subcategorías con los mismos nombres que el Excel de gastos, cada una con icono, color y grupo (necesarios, ocio y vida social, ahorro).
- Panel «Ingresos y ahorro» igual que el del Excel: ingreso principal, secundarios, totales, ahorro real frente al objetivo del 70 % (verde y + si lo superas, rojo y − si no).
- **Pasar al Excel**: tabla idéntica (Fecha, Importe, Descripción, Categoría, Subcategoría) para copiar y pegar en `B23`; ingreso principal en `C5`; secundarios en `B7`.
- **Importar del Excel**: pega filas de la tabla de movimientos y se crean en la app (salta repetidos).

**Inspirado en Cashew**
- Presupuestos mensuales, semanales o con fechas (p. ej. un viaje), con categorías incluidas, límites por categoría, gasto diario disponible, ritmo ideal e historial. El del mes es automático: ingresos × 30 %.
- Pagos recurrentes y suscripciones (automáticos o «por pagar»), y movimientos pendientes con fecha futura.
- Varias cuentas con saldo inicial y transferencias entre ellas.
- Préstamos y deudas con pagos parciales.
- Autocompletado: recuerda la categoría de cada descripción.
- Búsqueda y filtros por tipo, categoría y cuenta; selección múltiple para borrar o recategorizar.
- Gráficos: gasto por categoría y subcategoría, gasto acumulado frente al mes anterior y al presupuesto, resumen anual mes a mes.
- Metas de ahorro con aportación mensual (si el balance no llega, se aparta menos) y prioridades.
- Bloqueo con PIN, pantalla de inicio configurable y copia de seguridad en `.json`.

**Videojuego**
- Nivel y experiencia según lo que apuntas y lo que ahorras, rachas de días, 21 logros.
- La «vida del mes» es tu presupuesto; el «maná» es tu ahorro; cada meta es un jefe cuya vida baja con cada aportación.
- Sonidos de 8 bits (desactivables) y fuentes pixeladas.

## Archivos

Web estática sin dependencias: `index.html`, `css/game.css`, `js/` (`core`, `game`, `views`, `forms`, `main`), `sw.js` (modo sin conexión), `manifest.webmanifest`, `icons/` y `fonts/`.
Se publica tal cual con GitHub Pages (rama `main`, carpeta raíz).

Fuentes: [VT323](https://fonts.google.com/specimen/VT323) y [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), con licencia SIL Open Font License 1.1.
