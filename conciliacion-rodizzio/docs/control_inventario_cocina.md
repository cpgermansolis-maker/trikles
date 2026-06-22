# Control de inventario de COCINA — diagnóstico y lista de acción

> Generado 2026-06-22 cruzando las charolas reales de cocina (las que se sirvieron)
> contra el Validador de recetas (`recetas_validacion`) y la config de inventariables
> (`InventarioChurrascaConfig`). Mismo enfoque que el de churrasca (v417, "Bocado 2").

## ✅ HECHO 2026-06-22 (primera tanda, alta prioridad)
Se marcaron **6 insumos principales** inventariables (autorizado por Germán):
**Camarón cocido** (ING-0272), **Camarón 26/30** (ING-0197), **Mejillones**
(ING-0199), **Pechuga fresca x kg** (613cb519…) → Congelador; **Queso parmesano**
(ING-0193), **Tocino** (ING-0159) → Refrigerador. Impacto medido en el Validador:
recetas de cocina que descuentan su PRINCIPAL **11 → 25**; inventariables 26 → 32.
⚠️ **Almacén debe contar estos 6 físicamente cada día** o el teórico no tiene
contraparte. Reversible: `inv_churrasca_config_save` con `activo=false`.
⏭ **Falta segunda tanda:** los demás de la lista de abajo (Piña, Coliflor, Plátano
macho, Espinaca, Tomate, Nopales, etc.) + las 64 que no descuentan nada.

## El problema (con números)
De **127 recetas de cocina que de verdad se sirven** en charolas:

| Estado | Recetas | % |
|---|---|---|
| ✅ Descuentan su ingrediente **principal** | 11 | 9% |
| 🟠 Descuentan **solo condimentos**, no el principal | 39 | 31% |
| 🔴 No descuentan **nada** | 71 | 56% |
| Sin dato | 6 | 4% |

**El 91% de los platillos servidos NO baja su insumo principal del inventario.**
El teórico de cocina es casi ficción. La causa no es que falten recetas ligadas
(el 85% de las charolas SÍ traen receta), sino que **los insumos principales no
están marcados como "se cuenta físicamente"** en la config de inventario.

Cómo descuenta una charola (recordatorio): al registrarla con receta, el sistema
baja del inventario SOLO los insumos de esa receta que estén marcados
**inventariables** en `InventarioChurrascaConfig`. Si el principal (la proteína,
el caro) no está marcado, no baja, aunque la charola esté bien registrada.

## Acción (decisión de Estefanía + almacén)
Decidir **qué insumos principales de cocina se cuentan físicamente cada día** y
marcarlos inventariables (admin: pantalla Inventario churrasca →
`inv_churrasca_config_save`). ⚠️ Antes de marcar, verificar que el insumo sea el
del **SR12 correcto** (no un duplicado manual viejo) y con su unidad/costo bien.

> ⚠️ Regla de oro: solo marcar lo que almacén REALMENTE va a contar. Marcar algo
> que nadie cuenta crea un "teórico vs real" sin contraparte = ruido, no control.

### Lista priorizada (insumo principal → nº de charolas que lo usan)
Estos son los principales de las 39 recetas 🟠 (descuentan condimentos pero no el
principal). Marcar de arriba hacia abajo da el mayor control con menos esfuerzo:

| # charolas | Insumo principal a marcar |
|---|---|
| 35 + 32 = **67** | **Camarón** (cocido + 26/30) — caro, alta rotación, prioridad 1 |
| 20 | Queso parmesano |
| 19 | Piña |
| 19 | Coliflor |
| 19 | Plátano macho |
| 16 | Espinaca |
| 15 | Tomate (2da) |
| 12 | Nopales |
| 12 | Tocino |
| 12 | Tomate cherry |
| 11 | Pechuga fresca x kg |
| 10 | Fusilli |
| 10 | Mejillones |
| 9 | Pimiento verde |
| 7 | Huevo entero |
| 6 | Chicharrón · Media crema |
| ≤5 | Harina hot cakes, Pepino, Carne molida cerdo, Queso gouda, Elote, Leche, Tahine |

### Aparte: las 71 que no descuentan NADA
Necesitan revisión caso por caso (probablemente ningún insumo inventariable, o
receta incompleta / insumos sin vincular). Atacar después de las 🟠.

## Estado de la config actual (26 inventariables)
Hoy marcados: 8 proteínas de churrasca (Pechuga, Costilla cerdo, Filete res, Top
sirlon, Picahna, Pierna/muslo pollo, Lomo canadiense, Chorizo) + condimentos de
bodega (Sal, Aceite, Aceite olivo, Vinagre, Pimienta, Catsup, Salsas, Azúcar,
Romero, Tomillo) + refrigerador (Ajo, Cilantro, Limón, Cebolla blanca/morada,
Totopos). Por eso muchas cocina descuentan condimentos pero no su principal.
