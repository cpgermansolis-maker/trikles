# Handoff · OAC Sistema

Sistema de gestión empresarial multi-módulo para PYMEs mexicanas. Incluye 3 direcciones de landing, login multi-empresa, dashboard ejecutivo, módulos de Costos / P.E. y Panel multi-empresa, dos módulos IA (Denuncias con dictamen + Transcripción de juntas), y un deck de inversionistas/clientes.

---

## ⚠️ Sobre los archivos de este paquete

Los archivos en `designs/` son **prototipos de referencia visuales escritos en HTML/CSS plano** — describen el look & feel y el comportamiento esperado, **no son código de producción para copiar tal cual**.

La tarea es **recrear estos diseños en el stack del equipo** (probablemente React/Next.js + Tailwind o el sistema que ya tengan). Si no hay codebase aún, elegir el framework más apropiado y replicar los diseños usando sus patrones idiomáticos.

## Fidelidad

**Hi-fi.** Colores, tipografía, espaciado y jerarquía están finalizados. Las decisiones de marca y sistema visual están tomadas. El developer debe replicar pixel-cercano usando el sistema de diseño/librería UI del codebase destino, sin reinterpretar.

---

## Marca & Sistema visual

### Tipografía
- **Sans · cuerpo / UI** — `Geist` (Google Fonts), pesos 300/400/500/600/700
- **Serif · acentos editoriales** — `Instrument Serif` (Google Fonts), siempre `font-style: italic`, weight 400. Se usa en remates ("…su empresa.", "…en un lienzo."), números hero (gauges, stats grandes) y en títulos de slide para crear ritmo
- **Mono · etiquetas, números tabulares, metadata** — `Geist Mono`, pesos 400/500. Usado para crumbs, KPIs, tags, captions y todo lo que sea letra pequeña con tracking

### Paleta (tokens canónicos — usar exactamente)
```css
--navy:     #0E2A4E   /* primario, fondos hero, headers */
--navy-2:   #163962   /* hover/secundario navy */
--sky:      #9FCDE6   /* acento sobre navy, brand secondary */
--sky-2:    #C9E3F1   /* fondos suaves, badges */
--mist:     #DCE2E7   /* fills neutros, divider donuts */
--ink:      #0A1A30   /* texto principal */
--muted:    #5A6A7E   /* texto secundario, captions */
--line:     #E6E9EE   /* bordes UI */
--paper:    #FAFBFC   /* fondo app */
--accent:   #E07A3E   /* CTA cálido, badge "más vendido" */
--good:     #1E7F5C   /* positivo / OK */
--warn:     #B97A1B   /* alerta media */
--bad:      #9F2B1E   /* negativo / pérdida */
--purple:   #7C5BD9   /* IA / categorías */
```

### Escala
- Border radius: 4 / 6 / 7 / 10 / 12 / 14 px
- Sombras: solo en hover de cards (`0 12px 28px -16px rgba(14,42,78,.18)`)
- Spacing principal: 6 / 8 / 10 / 12 / 14 / 18 / 20 / 24 / 32 / 48 / 64 px
- Tracking de mono uppercase: `letter-spacing: .12em–.18em` (más cuanto más grande la etiqueta)

### Logo OAC
SVG inline en cada archivo. Tres formas con `mix-blend-mode: multiply`: círculo sky, triángulo gris claro y arco navy. Usar el código SVG tal cual de cualquiera de los HTMLs (`<svg width="40" height="22" viewBox="0 0 400 220">…`).

---

## Pantallas / Vistas

Numeración en `designs/` corresponde al orden de implementación sugerido.

### 00 · Sistema canvas (`00-sistema-canvas.html`)
Lienzo de presentación interna que envuelve todos los demás. Usa `design-canvas.jsx` (componente React custom). **No replicar en producción** — es solo navegación design-time.

### 01 · Landings (A / B / C)
Tres direcciones exploratorias. La **A es la definitiva** (`01-landing.html`); B y C se conservan como referencia.

**Estructura A:**
- Header sticky · logo + nav (Producto / Pricing / Acceso) + CTA
- Hero · titular grande (Geist 500 + Instrument Serif italic en remate) + 4 stats en mono
- Sección de módulos (7 cards en grid)
- Pricing (4 tiers — ver módulo 07)
- Comparativa vs Contpaqi/Aspel/EthicsPoint
- Footer

### 02 · Acceso (`02-acceso.html`)
Login multi-empresa. Layout 50/50: panel izquierdo navy con marca + tagline; panel derecho blanco con tabs (Email / SSO Google / Magic link), preview de empresas disponibles y CTA.

### 03 · Dashboard (`03-dashboard.html`)
Pantalla principal del producto. Topbar con logo + nav horizontal (`Captura · Nómina · CxC · Costos · Panel · IA Transcribir · Denuncias`) + selector empresa + avatar.

5 tabs internos: **Financiero · Nómina · Flujo · Reserva · Bancos**. Cada tab tiene fila de KPIs (5 cards), uno o dos charts y bitácora de movimientos. Layout: max-width 1480, padding 24px lateral, grid 14px gap.

### 04 · Costos & P.E. (`04-costos.html`)
- 5 KPIs (ventas, costo fijo diario, margen, P.E., % logro)
- **Bloque hero navy con gauge circular** (conic-gradient) + 4 pasos del cálculo del P.E.
- Bar chart de tendencia diaria 25 días con línea P.E. en `--accent`
- Pie chart estructura de costos
- Tabla de productos con barras de % logro (estrella / marginal / pérdida)
- Lista de costos fijos mensuales con %

### 05 · Panel multi-empresa (`05-panel-multiempresa.html`)
- Hero consolidado navy con 3 stats grandes (ventas / utilidad / P.E. promedio)
- Grid de 4 cards de empresas (cada una con tier `Business`/`Pro`/`Starter`, KPIs y status)
- Tabla comparativa consolidada con totalización
- Lista de usuarios con avatares de color y badges de rol (`ADMIN HOLDING` / `CFO` / `EDITOR` / `VIEWER`)
- Matriz módulos × empresas (●/○/PARCIAL)
- Bitácora cross-empresa

### 06 · Denuncias IA (`06-denuncias-ia.html`)
Módulo estrella. Lista de denuncias + detail view del dictamen IA con razonamiento auditable paso a paso.

### 07 · Transcripción IA (`07-transcripcion-ia.html`)
Sube audio → minuta + decisiones + pendientes asignados.

### 08 · Deck inversionistas (`08-deck-inversionistas.html`)
10 slides 1920×1080 (Title · Problema · Solución · Diferencial · Mercado · Producto · Pricing · Tracción · Equipo · Ask). Usa `deck-stage.js` (web component custom). En producción esto puede quedarse como HTML estándalone o convertirse a Reveal.js / Spectacle.

---

## Pricing canónico (4 tiers)

| Tier | Precio MXN/mes | Empresas | Usuarios | Highlights |
|---|---|---|---|---|
| Starter | $2,500 | 1 | 5 | Financiero + nómina hasta 15 |
| Professional | $6,500 | 2 | 12 | + Costos/P.E., transcripción 20h |
| **Business ★** | **$12,000** | **5** | **ilimitados** | **+ Denuncias IA, controller 8h** |
| Enterprise | $30,000+ | ilimitadas | ilimitados | + SSO, API, controller in-house |

---

## Interacciones & estado

- **Tabs del dashboard:** swap de contenido sin recarga; URL params para deeplink
- **Hover de cards:** `border-color: var(--navy)` + sombra suave + `transition: .15s`
- **Inputs:** focus ring sky (`--sky-2`) sin shadow blue del browser
- **Tablas:** hover en row con fondo `--paper`
- **Selector empresa (topbar):** dropdown con búsqueda; persiste en localStorage
- **Botones primarios:** `background: var(--navy)`, hover `var(--navy-2)`
- **Charts:** estáticos en mocks (CSS puro). En producción usar la librería del codebase (Recharts, Chart.js, etc.)

## Estado / data

- Auth multi-empresa: usuario puede pertenecer a N empresas con rol distinto en cada una
- Roles: `ADMIN_HOLDING`, `CFO`, `MANAGER`, `EDITOR`, `VIEWER`
- Cada vista filtra por `currentCompanyId` excepto Panel (que es cross-empresa)
- Denuncias y Transcripciones llaman a un servicio LLM externo — abstraer detrás de `/api/ai/*`

---

## Assets / dependencias

- **Fuentes:** Google Fonts (Geist, Instrument Serif, Geist Mono) — autohospedar en producción
- **Iconos:** emoji nativos en mocks (📊 👥 🎙️ 🔒 🏦 ⚖️). Reemplazar por set consistente del codebase (Lucide/Phosphor recomendados)
- **Logo:** SVG inline (incluido en cada HTML)
- **Sin imágenes raster** — todo SVG/CSS

## Archivos del paquete

```
design_handoff_oac_sistema/
├── README.md                              ← este archivo
└── designs/
    ├── 00-sistema-canvas.html             ← navegador interno (referencia)
    ├── 01-landing.html                    ← landing definitiva (A)
    ├── 01-landing-b.html                  ← exploración bento (referencia)
    ├── 01-landing-c.html                  ← exploración corporativa (referencia)
    ├── 02-acceso.html
    ├── 03-dashboard.html
    ├── 04-costos.html
    ├── 05-panel-multiempresa.html
    ├── 06-denuncias-ia.html
    ├── 07-transcripcion-ia.html
    ├── 08-deck-inversionistas.html
    ├── design-canvas.jsx                  ← solo para 00-sistema-canvas
    └── deck-stage.js                      ← solo para 08-deck
```

## Recomendaciones de implementación

- **Stack sugerido:** Next.js 14 (App Router) + Tailwind con tokens custom + shadcn/ui para primitivos + Recharts para gráficas
- **Tokens primero:** definir variables CSS (`--navy`, `--sky`, etc.) en `globals.css` antes de tocar componentes
- **Tipografía:** configurar las 3 familias en `next/font` con `display: swap`
- **Multi-tenant:** usar middleware para resolver `companyId` desde subdomain o path; cachear en cookie httpOnly
