# Charolas — "Bocado 2": qué carnes contar para que el inventario descuente

**Fecha:** 2026-06-19 · **Para:** Estefanía (Supervisión de Operaciones) + almacén · **Decide:** Estefanía · **Ejecuta el marcado:** Claude (con respaldo previo)

---

## Para qué es esto (en simple)

Cuando la churrasca registra una **charola** (una espada que sale al buffet), el sistema **debería bajar la carne del inventario** automáticamente. Hoy **no lo hace bien**: baja la sal, el aceite y los condimentos, pero **no la carne** (que es lo caro y lo que de verdad importa para el cuadre).

Esto le quita sentido al control de fuga de carne: si no descuenta la proteína, no se puede comparar "lo que debió gastarse" contra "lo que el SR12 dice que hay".

---

## El hallazgo de fondo (importante)

El descuento solo ocurre cuando el **insumo de la receta** está marcado como "se cuenta en inventario" (`InventarioChurrascaConfig`). Revisando en vivo (2026-06-19) encontré que:

> **Las carnes que hoy están marcadas para contarse NO son las mismas que usan las recetas.** Son versiones/duplicados viejos.

Ejemplos reales:

| Está marcado para contarse | Pero las recetas usan… |
|---|---|
| Pechuga de pollo (ING-0145) | **PECHUGA FRESCA X KG** (otro id, del SR12) |
| Pierna y muslo de pollo (ING-0148) | **Pierna y muslo deshuesada** (ING-0508) y **MUSLO X KG** (otros ids) |
| Costilla de cerdo (ING-0140) | la espada GAUSHA usa **Costilla de res** (otro id) |
| Chorizo brasileño (ING-0150) | la espada de chorizo referencia **otro** chorizo, no ese id |

Por eso el sistema "cuenta" una pechuga y la receta "gasta" otra → nunca se cruzan → no descuenta.

**Conclusión: no basta con marcar más carnes. Hay que marcar los ids correctos (los que las recetas SÍ usan) y, aparte, limpiar los duplicados viejos.**

---

## Decisión que necesitamos de Estefanía

Para cada corte de abajo: **¿se cuenta físicamente en el almacén cada día (inventario inicial / final)?**
- **SÍ** → lo marcamos como inventariable (con el id correcto) y la espada empieza a descontar la carne.
- **NO** → no se marca (no tiene caso descontar algo que nadie cuenta).

> Regla simple: marcar **solo** lo que de verdad se pesa/cuenta a diario. Más vale empezar con pocas carnes bien contadas que con muchas a medias.

---

## GRUPO 1 — Carnes con vínculo SR12 (costo confiable, listas para marcar)

Estas ya jalan su costo del SR12, así que en cuanto se marquen, el descuento y el cuadre quedan completos.

| Carne | id en el sistema | Espada(s) que la usan | ¿Se cuenta a diario? (SÍ/NO) |
|---|---|---|---|
| Pierna de cerdo | ING-0147 (SR12 8008) | Cochinita Pibil | ☐ |
| Corazón de pollo | SR12 9001 | espadas de corazón | ☐ |
| Muslo de pollo | SR12 8012 | espada de muslo | ☐ |
| Pechuga fresca | SR12 9002 | espada de pechuga | ☐ |
| Pierna y muslo deshuesada | ING-0508 (SR12 9003) | espada pierna y muslo | ☐ |

## GRUPO 2 — Cortes premium SIN vínculo SR12 (costo estimado)

Se pueden marcar para que descuenten, **pero su costo no será confiable hasta darlos de alta en el SR12** (no pasan por el POS hoy). El descuento de cantidad sí funciona; el valor en $ quedará estimado.

| Corte | id en el sistema | Espada / platillo | ¿Se cuenta a diario? (SÍ/NO) |
|---|---|---|---|
| Arrachera | ING-0520 | Arrachera | ☐ |
| Tomahawk | ING-0521 | Tomahawk | ☐ |
| Corte Capitão | ING-0527 | Corte Capitão steak | ☐ |
| Costilla de res (Gausha) | ING-0526 | Costilla Gausha | ☐ |
| Lomo de cerdo | ING-0519 | Lomo de cerdo | ☐ |

## GRUPO 3 — Espadas que hoy NO descuentan NADA (falta identificar su carne)

Estas ni siquiera tienen un insumo contable. Hay que identificar su carne y marcarla (segunda tanda). La carne suele ser evidente por el nombre:

Baby beef · Costilla de res ahumada · Picaña de cerdo · Lomo de cerdo parmesano · Mamiña al ajo · Molleja de res · Pechuga con tocino · Pollo churrasca · Corte búfalo · Chistorra · Calabreza con chile · Chorizo brasileño · Espada de muslo a la cerveza · Espada de piña con canela · (+ pan/salsas: Pan con ajo, Crema de ajo, Nopales con queso asado)

> Cuando Estefanía confirme cuáles de estas se cuentan, Claude saca el id exacto de cada carne y se marcan igual que el Grupo 1/2.

## NO son carne (ignorar por ahora)

El sistema marcó como "principal" la salsa más cara de algunas recetas que en realidad son guisos/salsas, no espadas: **Mayonesa, Tomate, Perejil (chimichurri), Piña, Sal de espuma, Sal de mar.** No hay carne que contar en esas; se dejan fuera salvo que el almacén sí cuente, por ejemplo, el tomate.

---

## Limpieza de duplicados (revisar con calma)

Hoy están marcadas 8 "proteínas" que **ningún** espada parece usar (probablemente duplicados del arranque): Pechuga de pollo (ING-0145), Costilla de cerdo (ING-0140), Filete de res (ING-0141), Top sirlon (ING-0149), Picahna (ING-0146), Pierna y muslo de pollo (ING-0148), Lomo canadiense (ING-0156), Chorizo brasileño (ING-0150).

⚠️ **Antes de desmarcarlas/borrarlas hay que confirmar cuál es la "buena"** (la del SR12) de cada par, para no dejar la receta sin carne. Esto se hace junto con el marcado, con respaldo.

---

## Siguiente paso

1. Estefanía llena la columna **¿Se cuenta a diario?** de los Grupos 1 y 2 (y dice cuáles del Grupo 3 cuenta).
2. Claude **respalda** el catálogo y marca como inventariables los ids correctos de lo que ella diga SÍ.
3. Se verifica con el ✅ Validador de recetas que esas espadas pasen de rojo a verde en "Descarga".
4. Limpieza de los duplicados marcados que no se usan.

> Estado de partida (2026-06-19, validador churrasca): 54 recetas → 2 verdes / 7 amarillas / 45 rojas. 21 descuentan condimentos pero no su carne; 20 no descuentan nada.
