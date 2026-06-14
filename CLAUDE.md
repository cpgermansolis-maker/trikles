# OAC / Trikles — Sistema de gestión empresarial multi-empresa

## ⭐ Regla de oro (Germán)
**Si un movimiento no llega a los KPIs del tablero principal, no sirve.**
Todo lo que se captura debe estar relacionado y reflejarse en el dashboard (Ventas, Utilidad, Gastos, P.E., Bancos, Cuentas por Cobrar, etc.). Antes de dar por terminada una feature de captura, verificar que pega en el KPI correcto.

> Regla complementaria (global): **siempre respaldar antes de mutar datos/estructura** (copia con fecha de la hoja, modo simulación). Ver `prepararDeudores()`.

## Qué es
Sistema multi-empresa en **Google Apps Script**. Backend = `Código.js` (un solo archivo, ~2000 líneas). Una pantalla HTML por módulo (dashboard, bancos, cuentas, nomina, costos, registro, denuncias, transcripcion, panel, panel_nomina, acceso, manual, landing…). Datos en un Google Sheet (varias hojas).

## Patrones clave (no obvios)
- **Llamadas:** todo es `jsonp({action:'...'})` (JSONP GET a `/exec`). El nombre de `action` debe coincidir **EXACTO** con el `switch` de `doGet`/`doPost` en `Código.js`. Bug típico: enviar un action inexistente → *"Acción no reconocida"* (así fue el bug `saveCxC` vs `guardarCxC`). NO migrar a `google.script.run`.
- **Sesión:** `trikles_session` (sessionStorage/localStorage); gating de UI por rol con `reqAuth`.
- **Branding multi-empresa:** `getEmpresas` da nombre/logo/colores por empresa.
- **Empresa `CORPORATIVO` = ambiente de pruebas** (es de Germán, NO de cliente). Ahí se puede escribir/borrar datos de prueba con tranquilidad.

## Despliegue — ⚠️ ES PRODUCCIÓN, HAY CLIENTE EN VIVO
- **Backend:** desde la raíz → `clasp push` y luego
  `clasp deploy -i AKfycbzPY1Wz75vD38aK6NMMDG6HdMAUWcpg9SGGUTOm2AvoA7LWZuw3iRlhnC4MmlcGRBg9Hw -d "msg"`.
  Ese deployment (`@87`) es el que usan las pantallas (su URL `/exec` está hardcodeada como `API_URL`).
- **Pantallas:** `git push origin main` → **GitHub Pages** (`cpgermansolis-maker.github.io`). El cliente usa GitHub Pages, no la copia HTML de Apps Script. (`clasp push` igual sube las HTML al proyecto Apps Script.)
- **Probar por URL pública:** la deployment `@HEAD` pide login (no sirve para curl anónimo). Crear una temporal con `clasp deploy -d "PRUEBA"`, probar, y borrarla con `clasp undeploy <id>`. Web app = `ANYONE_ANONYMOUS` (sin auth en el endpoint; la seguridad real es el gating por rol en la UI).
- El cliente debe **recargar/reabrir la app** tras un deploy para bajar la versión nueva.

## Contabilidad / dónde aterriza cada cosa
- **Grid principal del tablero** (Ventas, Ganancia, Utilidad, Gastos, P.E., CxP) sale SOLO de la **captura diaria** (`registro.html` → `getDatos`). Un préstamo/gasto NO va aquí.
- **KPI Cuentas por Cobrar** = `getCxCClientes` (ventas a crédito de la captura) + suma de `OTRO_CARGO`/`SALDO_INICIAL` − `COBRO_OTRO` de la hoja `CxC` (sin importar forma de pago).
- **Bancos** (`bancos.html`): muestra `BANCO_*` (Caso 1) **y** movimientos de `CxC` cuyo `forma_pago` = BANCO1/BANCO2 (Caso 2, el "puente").
- **Efectivo/caja se cuadra por CONTEO FÍSICO diario**, no por libro. Un cobro/préstamo en efectivo NO se suma a un ledger de caja (se contaría doble).

## Módulo Préstamos / Deudores (jun 2026)
- Hoja `CxC` ampliada: columnas **Deudor / RefPrestamo / TasaInteres** (migración no destructiva en `getOrCreateCxC`; respaldo + columnas con `prepararDeudores()`, correr 1 vez).
- Acciones backend: **`guardarPrestamo`** (crea fila principal `OTRO_CARGO` con forma=banco/efectivo + fila de interés `OTRO_CARGO` forma=`INTERES`, ligadas por `RefPrestamo` tipo `PR-xxxx`), **`getDeudores`** (saldo por persona: prestado/interés/pagado/restante), **`borrarCxC`** (borra/corrige un movimiento; candados: misma empresa + verifica monto).
- Doble efecto: préstamo desde banco → baja Bancos + sube CxC. Interés → solo sube CxC (no toca banco). Cobro `COBRO_OTRO` → baja CxC y, si es banco, sube Bancos; si es efectivo, entra a caja (conteo).
- UI: en `bancos.html` (tipos *Préstamo / anticipo* y *Cobro de préstamo*) y en `cuentas.html` (captura por deudor + interés + tabla "Deudores" + botón 🗑 borrar).

## Por dónde retomar
- **Pendiente:** el cliente Tri-Urban debe registrar el préstamo real a Cineteca (~$1,202, Cuenta 1) desde la app — será la **primera ejecución real** de `guardarPrestamo` en producción (en CORPORATIVO ya se probó OK). Verificar que pega en el KPI de Cuentas por Cobrar y baja Bancos. Se le mandó guía por WhatsApp.
- **Opcional:** botón borrar movimiento solo está en `cuentas.html`; agregarlo a `bancos.html` si lo piden.

## Changelog (corto)
- **2026-06-14** — Módulo Préstamos/Deudores por persona con interés (banco/efectivo) + botón borrar movimiento (`borrarCxC`). Fix `saveCxC`→`guardarCxC` en bancos.html. Blindaje: `cuentas.html` ya no mezcla movimientos de banco en deudores. Backend en deploy `@93`.
