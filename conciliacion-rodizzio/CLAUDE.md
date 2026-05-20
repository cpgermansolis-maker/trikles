# CLAUDE.md — Conciliación Fogueira

Sistema de control de caja, conciliación operativa y reservaciones para el restaurante buffet/rodizio **Fogueira** del **Grupo Toda del Sureste**. Desarrollado como módulo independiente (no dentro de OAC), pensado para venderse a múltiples restaurantes.

---

## Qué es el proyecto

- **Cliente**: Fogueira (restaurante buffet/rodizio en Oaxaca)
- **Dueño técnico**: Germán Solís (cpgermansolis@gmail.com)
- **Propósito**: reemplazar el flujo manual de caja + reservaciones + recetario con un sistema web basado en Google Apps Script
- **Arquitectura**: frontend HTML estático + backend Apps Script + Google Sheets (sin Firebase, sin SQL directo)
- **Multi-empresa desde el diseño** — cada empresa tiene su catálogo, usuarios y branding propios

---

## Identificadores de producción

| Dato | Valor |
|---|---|
| Script ID | `1Wja60RtizVgc5KoCAAYQ_cl3f6S9_dLqfFV68Y0MOxHo0mxEqSelqj9Z` |
| deploymentId (fijo) | `AKfycbwYbhG9xyML1p7Yp3Il54f9wCN6qTXFSc696IVnpQ8IIxE2YGhKpbTP5gLe-tGkyXA` |
| URL pública | `https://script.google.com/macros/s/AKfycbwYbhG9xyML1p7Yp3Il54f9wCN6qTXFSc696IVnpQ8IIxE2YGhKpbTP5gLe-tGkyXA/exec` |
| URL reservas (pública) | `...exec?p=reservar` |
| Spreadsheet | "Conciliación Restaurante - DB" en Drive de cpgermansolis@gmail.com |
| Último deploy | v217 (2026-05-20) |

---

## Estructura del proyecto

```
conciliacion-rodizzio/
├── apps-script/          ← TODO el código que se despliega
│   ├── .clasp.json       ← apunta a este proyecto (no al de Trikles)
│   ├── appsscript.json
│   ├── recetario.gs      ← código principal + router handleRequest()
│   ├── recetario_handlers.gs
│   ├── sr12_handlers.gs
│   ├── inventario_churrasca_handlers.gs
│   ├── branding_handlers.gs
│   └── *.html            ← todas las pantallas del sistema
├── Inventarios SR12/     ← archivos XLS del POS para importación manual
├── RecetarioFogueira_PRD/← datos bootstrap del recetario
├── docs/                 ← checklist supervisión conciliación
└── CLAUDE.md             ← este archivo
```

---

## Deploy con clasp

**SIEMPRE desde `apps-script/`**, nunca desde el directorio raíz.

```powershell
cd apps-script

# Solo subir código (sin publicar):
npx clasp push

# Subir + publicar (mantiene URL fija):
npx clasp deploy --deploymentId "AKfycbwYbhG9xyML1p7Yp3Il54f9wCN6qTXFSc696IVnpQ8IIxE2YGhKpbTP5gLe-tGkyXA" --description "vN — descripción"
```

**Por qué:** el `.clasp.json` de Fogueira está en `apps-script/`. Desde el padre, clasp sube al proyecto Trikles/OAC que tiene su propio `.clasp.json` arriba en la jerarquía — los cambios se pierden silenciosamente.

**Lo que Claude puede hacer solo**: push + deploy. `clasp login` ya está guardado en el perfil de Germán.

**Lo que Germán debe ejecutar manualmente** (desde el editor de Apps Script, menú desplegable): `setupHojas`, `crearPrimerAdmin`, `crearPromocionesFogueira` y similares funciones administrativas que requieren OAuth interactivo.

---

## Reglas de desarrollo

### Patrón de comunicación — apiCall, no google.script.run

El sistema usa JSONP/fetch hacia `/exec`. **Nunca usar `google.script.run`**.

```javascript
// Pantallas internas (acceso, bitácora, admin, etc.) — JSONP:
apiCall({ action: 'login', email, password }, function(res) { ... });

// Pantallas públicas (reservar.html, mireserva.html) — fetch POST:
fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, ... }) })
```

Todo llega a `handleRequest(e)` → `switch(action)`. Si un handoff externo sugiere `google.script.run`, reemplazar por `apiCall` — no crear endpoints duplicados.

### Fecha local, no toISOString

`new Date().toISOString().slice(0,10)` da UTC y rompe la fecha en México después de las 18:00. Usar siempre:

```javascript
var d = new Date();
var fecha = d.getFullYear() + '-' +
            String(d.getMonth()+1).padStart(2,'0') + '-' +
            String(d.getDate()).padStart(2,'0');
```

### Día lógico del restaurante

Empieza a las **3:00 am hora MX** y termina a las 2:59 am del siguiente día. Función `diaLogicoRestaurante()` en backend. Los tokens de sesión se validan con este día — no caducan a medianoche durante operación nocturna.

### CSS — @media queries al final

En los HTMLs, las reglas `@media` sin `!important` deben ir al **final** del bloque `<style>`. Si van antes, las clases que se definen después las sobrescriben.

### Restricciones por rol — sincrónicas

Ocultar UI privilegiada (botones admin, Zona Peligro) **antes del primer pintado**, nunca con `setTimeout`. Usar la clase del `<body>` que se asigna al cargar la sesión.

### Sheets y columnas con listas CSV

En locale `es_MX`, columnas que almacenan strings tipo `"5,6,7"` deben tener `setNumberFormat('@')` al crear la hoja — de lo contrario Sheets los interpreta como números/fechas.

### Subtítulo del topbar — siempre visible

`.topbar-sub` (subtítulo debajo del nombre del módulo) **nunca se oculta en móvil**. Reducir tamaño (`font-size: 0.65rem`) pero mantenerlo visible.

### Distribución a usuarios

**Nunca mandar el `.html` como adjunto por WhatsApp** (se rompe en iPhone). Siempre compartir el link `?p=...` del Apps Script.

### Query params en Apps Script

`location.search` dentro del iframe sandbox de Apps Script no es confiable. Para páginas que necesiten leer params del URL principal, usar en `doGet`:

```javascript
template.queryParams = params; // después: var Q = <?!= JSON.stringify(queryParams||{}) ?>;
```

Las demás páginas pueden usar `createHtmlOutputFromFile` (más rápido).

---

## Identidad visual Fogueira

**Paleta v2 (oficial 2026-05-13):**

```css
:root {
  --ink:   #0c0907;   /* negro cálido */
  --ember: #c4322a;   /* rojo brasa */
  --cream: #f6f1e8;   /* crema fondo */
  --gold:  #c89a4a;   /* dorado */
}
```

**Fuentes**: Cormorant Garamond italic (títulos) + DM Sans (cuerpo) + DM Mono (datos)

**Sin border-radius** en ningún elemento.

**Sensación**: fine dining brasileño, premium, sobrio, elegante.

**Logos** (Google Drive público de Germán):
- `15ihydrIqyPzw3HPMH9YMZvcJ4ETJuB4v` — fondo negro + texto dorado (para login)
- `1f1FMkTROc29dCMpihRNAGOiN7FxLzdHC` — fondo blanco + texto negro + llama dorada (para topbar)

**Branding dinámico**: cada página carga `empresa_branding_get` al inicio para sobreescribir las vars CSS con los valores de la empresa activa. Solo llamar si hay `empresa_id` disponible — sin parámetro devuelve defaults OAC y sobrescribe Fogueira.

---

## Reglas de negocio Fogueira

### Propinas
- **Efectivo**: no se concilian — la mesera se las queda directo.
- **Tarjeta**: sí pasan por caja. Se retira efectivo equivalente del cajón el mismo día para entregarlo al personal de piso. El banco liquida con 1-2 días de delay.
- Comisión que sale del mesero: 7% (fondo de servicio) + 5%+IVA (retención bancaria).
- Fórmula efectivo teórico: `+ fondo_asignado + cobros_efectivo − retiro_propinas_tarjeta − depósito_1 − depósito_2 = efectivo_teórico`.

### Depósitos a tesorería — son DOS
1. Depósito de la venta del día (efectivo de la operación).
2. Depósito de comisiones bancarias.

### Charolas — son dos tipos
- **Cocina**: guarniciones, ensaladas, postres — responsable Marco/Sergio.
- **Churrasca**: carnes en espada — responsable separado.
- Se capturan **en vivo**, no al final del día.

### Tarifas vigentes
| Servicio | Días | Horario | Adulto | Niño 6-10 | 3a edad |
|---|---|---|---|---|---|
| Buffet completo | Lun–Jue | todo el día | $590 | $249 | $590 |
| Desayuno | Vie–Dom | 00:00–12:59 | $299 | $249 | $299 |
| Comida | Vie–Dom | 13:00–23:59 | $590 | $249 | $590 |

- 0-5 años → cortesía (autorización "Bebé/niño 0-5")
- 6-10 años → tarifa niño
- 11+ → tarifa adulto

### Bitácoras de fin de semana
El host abre **dos bitácoras separadas** (Desayuno y Comida), no una mezclada. A las 12:30 cierra Desayuno y abre Comida.

### Cupo de reservas online
- Máximo **50 personas** por servicio (los walk-ins no cuentan).
- Slots de **15 minutos**.
- Grupo >10 personas → estado `pendiente_confirmacion`.
- Tolerancia: 0 pública, 10 min interna. **No auto-cancelar** — el host decide manualmente.

### Roles del sistema (9 activos)
| Rol | Acceso |
|---|---|
| `host` | solo bitácora |
| `cocina` | charolas cocina + merma |
| `churrasca` | charolas churrasca + merma |
| `cajera` | corte de caja + eventos de control |
| `encargado_piso` | confirmación de fondo + propinas tarjeta |
| `gerente_restaurante` | autoriza cortesías + hereda `host` (Gabriel Rodríguez) |
| `gerente_administrativo` | autoriza cortesías + hereda `admin` (Mónica Solís) |
| `observador` | solo lectura; `body.solo-lectura` deshabilita inputs |
| `auditoria` | todo en lectura + sello auditor (Germán) |
| `admin` | todo + usuarios + configuración |

Solo `gerente_restaurante` y `gerente_administrativo` aparecen en el select "Autorizó" de cortesías. `admin` y `auditoria` NO.

### Sellos autenticados
Cada rol sella desde su propia pantalla con su sesión activa. Override (firmar por otro): solo `admin` o `gerente_administrativo`, requiere motivo ≥5 chars, queda auditado en hoja `Sellos`.

---

## Arquitectura de datos (hojas del Spreadsheet)

| Hoja | Propósito |
|---|---|
| `Empresas` | catálogo multi-empresa |
| `Sucursales` | multi-sucursal por empresa |
| `Usuarios` | usuarios con roles |
| `Tarifas` | histórico de tarifas (nunca sobrescribir, agregar con `fecha_desde`) |
| `Reservas` | reservaciones de clientes |
| `Bitacoras` | registros de servicio (meta + cierre; sin rows) |
| `BitacoraFilas` | filas individuales de bitácora (guardado por fila para evitar pérdidas) |
| `Conciliaciones` | conciliaciones de caja |
| `Sellos` | sellos autenticados por sesión |
| `Horarios` | 10 renglones por día/servicio |
| `Configuracion` | parámetros clave-valor por empresa+sucursal |
| `EmpresaConfig` | config operativa + branding por empresa (cols 1-6 operativas, 7-18 branding) |
| `Ingredientes` | catálogo de insumos (schema V3, 27 cols) |
| `IngredientesSR12` | espejo del catálogo POS con existencias |
| `IngredientesSR12Match` | vínculo Fogueira↔SR12 |
| `ImportacionesSR12` | log maestro de importaciones |
| `ImportacionDetalleSR12` | detalle por producto |
| `Ingredientes_backup_2026-05-12_1055` | backup pre-migración schema V3 |

**Patrón `matchSucursal`**: fila con `sucursal_id` vacío aplica a cualquier sucursal de la empresa (global). Útil para multi-sucursal.

---

## Integración SR12 (SoftRestaurant 12)

**Filosofía**: SR12 es el espejo, Fogueira es el reflejo. Los costos del SR12 sobrescriben sin pedir confirmación (excepto sospechosos >50%).

**No hay SQL directo** — la cajera sube archivos XLS manualmente desde el POS. Esto hace el módulo POS-agnóstico para otros clientes.

**Estado actual** (v211):
- Schema legacy migrado (492 ingredientes alineados a V3). Backup: `Ingredientes_backup_2026-05-12_1055`.
- Importador funcional (endpoint `sr12_import_aplicar`). Fases A y B completadas.
- Rol `comprador` ya tiene acceso completo: tile "📥 Importar SR12" visible en su inicio + endpoints habilitados en backend.
- **Pendiente Fase C**: importar historial de compras SR12 (precios reales por transacción, para análisis de tendencias). Diferente al inventario — es el log cronológico de cada compra con proveedor y precio de factura.

**Reglas de matching** (orden de prioridad):
1. A1: clave SR12 en `IngredientesSR12Match`
2. A2: clave SR12 en `Ingredientes.clave_sr12`
3. B: nombre exacto normalizado
4. C: containment asimétrico ≥75% con regla del anchor (1ra palabra SR12 en Fog)
5. D: igual B+C contra `aliases`

---

## Backlog pendiente

### Pendiente verificar (esperando confirmación en producción)
- **nrModal desde detalleModal** (charolas.html v204): el botón abre encima ✅, pero pendiente que Marco o Sergio confirmen que el formulario se llena y envía correctamente (typeahead ingredientes + "Enviar para autorización" crea pendiente en recetas.html).

### Backlog técnico activo
1. **[PRIORIDAD COMERCIAL] Migrar pantallas internas a `?p=...`** — El sessionStorage de Apps Script es no confiable entre subdominios. Con `?p=pantalla&t=TOKEN` el backend inyecta el token vía template antes de servir el HTML: la sesión nunca depende de sessionStorage. Orden recomendado: `bitacora.html` → `conciliacion.html` → `charolas.html` → `recetas.html` → resto. Sin esta migración, cada página nueva añadida al sistema reproduce silenciosamente el bug de "Cargando módulos…" si el desarrollador olvida el snippet de propagación de token.
2. **F3 Fase C** — Importador de Compras SR12 (historial de precios reales por transacción). En pausa — requiere archivos de compras de Estefanía/Raúl.
3. **Branding** — Aplicar identidad Fogueira a las pantallas restantes (orden: `bitacora.html` → `charolas.html` → `recetas.html` → `conciliacion.html` → resto).
4. **Isotipo Fogueira** — Recortar la llama dorada con fondo transparente para favicon y topbar móvil.

### Completado en sesiones anteriores
- ✅ Fix curso.html — quiz de capacitación funciona correctamente (v217, 2026-05-20). Tres bugs encadenados resueltos:
  1. **v212** — Pantalla en blanco al enviar quiz: `quizResultado` solo existía si había preguntas; null-checks en `mostrarResultadoQuiz`; `detalle`/`preguntas` declarados antes del `if (tiene_quiz)` en backend para evitar TypeError; try-catch en `pintarModulo`.
  2. **v213** — Links en contenido del módulo abrían `createOAuthDialog`: se agregó soporte markdown `[texto](url)` con token inyectado en links internos y `target="_blank"` en externos.
  3. **v217** — Bug raíz definitivo: el contenido del módulo 5 admin (Troubleshooting) tiene `` `<a href>` `` en backtick code. `renderMarkdown` lo convertía a `<code><a href></code>` — un elemento `<a>` real con `href=""`. El **HTML Adoption Agency Algorithm** mantiene el `<a>` en la lista de "active formatting elements" incluso después de que el `</div>` del `.contenido-md` lo saca del stack, y lo **reconstituye automáticamente** envolviendo el `<div class="quiz-section">` siguiente. Con `<base target="_top">`, cualquier clic navegaba el frame superior a `href=""` (exec URL sin params → `createOAuthDialog`). **Fix**: el inline code de `renderMarkdown` ahora escapa `&`, `<`, `>` dentro del contenido antes de envolverlo en `<code>`, convirtiendo `` `<a href>` `` en `<code>&lt;a href&gt;</code>` — texto, no elemento HTML.
- ✅ Fix quiz blank screen (v212): `quizResultado` siempre presente en módulos con quiz; null-checks en `mostrarResultadoQuiz` y reintentar; backend `detalle`/`preguntas` declarados fuera del `if` para evitar TypeError en ruta `marcarCompleto`; try-catch en `pintarModulo` para fallos visibles
- ✅ F3 Fase A — SR12 importado sobre datos limpios
- ✅ F3 Fase B — Stock SR12 visible en recetas.html
- ✅ T4 — Editor visual de cursos/preguntas en admin.html (v206)
- ✅ T2 fase 3 — `conciliacion_auditoria_get` + diff visual en historico.html (v207)
- ✅ Bug fecha 1899-12-30 — `fechaToString` retorna '' para años < 1970 (v208)
- ✅ Limpieza — debug block eliminado del dry-run SR12 (v209)
- ✅ Curso comprador — Módulo 5 actualizado: SR12 ya existe, instrucciones reales (v210)
- ✅ Fix SyntaxError admin.html — `});` sobrante de v206 roto hasta v211

### Fase del plan general
1. ✅ Correcciones a HTMLs iniciales
2. Vista en vivo cocina y churrasca (tablets) — pendiente
3. ✅ Backend Apps Script + login + permisos + trazabilidad
4. ✅ Reservaciones tipo OpenTable
5. ✅ Lector de reportes Excel POS
6. Integración opcional con OAC (Fase futura)

---

## Personas del restaurante

| Nombre | Rol en sistema |
|---|---|
| Mónica Solís | `gerente_administrativo` — autoriza cancelaciones/cortesías/descuentos, firma cierre |
| Gabriel Rodríguez | `gerente_restaurante` — revisa cierre, escalación de banderas |
| Marco / Sergio | `cocina` — cuenta charolas y mermas |
| Farid | Almacén |
| Estefanía / Raúl | Compras |
| Germán Solís | `auditoria` — arqueos sorpresa, muestreos |
| Saúl + Elías | IT (futuro, integración POS) |

---

## Notas técnicas importantes

### Pérdida de datos en bitácora — RESUELTO (v53-v57)
Problema: localStorage no sobrevive entre cargas en iframes de Apps Script (subdominios googleusercontent.com aislados en iOS). Solución: cada fila se guarda como registro individual en hoja `BitacoraFilas` con UUID propio. Pérdida máxima posible: 1 fila.

**CRÍTICO**: `doSave` en bitácora.html **NO envía `state.rows`** en el payload. Las filas viven solo en `BitacoraFilas`. Si se enviaran rows, la URL JSONP crece con el número de filas → Apps Script rechaza con `error:"network"` → los meta/cierre/firmas no se persisten.

### Token de sesión
Stateless, basado en SHA-256 de `id+email+día_lógico+SALT`. Salt: `fogueira-conciliacion-salt-2026`.

### Cancelación pública
Token determinista: `sha256(id+telefono+fecha+SALT)`. Página `?p=mireserva&id=...&t=...`. Política: hasta 30 minutos antes de la hora reservada.

### fechaToString — fechas inválidas de Sheets
Cuando Sheets guarda una celda de fecha con valor serial 0 (celda vacía en columna con formato Date), `getValues()` devuelve un objeto `Date` con año 1899. La función `fechaToString` (Código.js) retorna `''` para cualquier fecha con año < 1970 — nunca "1899-12-30". Aplica en todo el sistema, no solo charolas.

### Cursos — bootstrap desde el admin
Los cursos y el banco de preguntas se inicializan/actualizan desde **Admin → Certificaciones → botones "🎓 Cargar cursos" y "📚 Cargar banco preguntas"**. No requieren ejecutar nada desde el editor de Apps Script. Siempre correr el bootstrap después de modificar `modulosCursoAdmin()`, `modulosCursoComprador()` o similares en Código.js.

### admin.html — IIFE y llaves huérfanas
El script de admin.html está envuelto en un IIFE `(function(){ ... })();`. Al insertar bloques de código grandes, verificar que no queden `});` sobrantes al final. Un `});` sin par es un `SyntaxError` que silencia TODO el JS de la página (Mi cuenta muestra "—", tablas quedan en "Cargando..." indefinidamente, sin redirección ni alerta). El error aparece como `Uncaught SyntaxError: Unexpected token '}'` en la consola del navegador.

### admin.html — funciones en onclick deben ser `window.xxx`
Los atributos `onclick="miFuncion()"` en el HTML se ejecutan en el scope global, no dentro del IIFE. Si una función se define como `function miFuncion(){}` dentro del IIFE, el onclick no la encuentra y falla silenciosamente. **Solución**: exponer como `window.miFuncion = function(){}`. Aplica a cualquier función llamada desde `onclick`, `onchange`, o cualquier atributo de evento inline en admin.html.

### renderMarkdown — inline code debe escapar HTML (Adoption Agency Algorithm)
El inline code de cualquier `renderMarkdown` en el sistema **debe escapar `&`, `<`, `>`** dentro del contenido del backtick antes de envolverlo en `<code>`. Sin escape, un contenido como `` `<a href>` `` crea un elemento `<a href="">` real en el DOM. El **HTML Adoption Agency Algorithm** mantiene ese `<a>` en la lista de "active formatting elements" incluso después de que el `</div>` del contenedor lo saca del stack, y lo **reconstituye automáticamente** envolviendo el siguiente bloque hermano (por ejemplo, la sección de quiz). Con `<base target="_top">`, el resultado es que todo el bloque heredado aparece como hipervínculo subrayado y cualquier clic navega el frame superior.

**Patrón correcto:**
```javascript
out = out.replace(/`([^`]+)`/g, function(_, code) {
  return '<code>' + code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</code>';
});
```

### Sesión — sessionStorage no confiable entre páginas en Apps Script
Apps Script sirve cada página desde un subdominio diferente de `googleusercontent.com`. El sessionStorage se aísla por subdominio: cada navegación entre pantallas puede llegar a un subdominio nuevo y perder la sesión. **Workaround actual (v218)**: propagar `?t=TOKEN&urol=ROL&unom=NOMBRE` en todos los links "← Inicio". **Solución definitiva pendiente**: migrar a `?p=pantalla` donde `doGet` inyecta el token vía template, eliminando la dependencia de sessionStorage.
