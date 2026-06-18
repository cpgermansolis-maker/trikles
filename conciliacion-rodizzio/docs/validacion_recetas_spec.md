# Validación de recetas — auditoría + regla permanente

> Auditoría en vivo 2026-06-18 de churrasca + barra (110 recetas: 57 churrasca activas + 38 barra).
> Objetivo de Germán: que esto sea una **regla de validación permanente**, replicable a TODAS las recetas, que genere valor.

## Las 6 dimensiones (lo que pidió Germán)
1. Cantidades y modo de preparación lógicos.
2. Ingredientes vinculados a costos del SR12.
3. Costos lógicos.
4. Vinculadas correctamente a la descarga de charolas.
5. Que afecten al inventario.
6. Que con las nuevas existencias del SR12 se pueda comparar (incluso vs mermas).

## Hallazgos (estado real hoy)

### 🔴 Estructurales (afectan a casi todo)
- **Mitad de los insumos NO vienen del SR12.** Churrasca: 129/240 líneas vinculadas = **54%**. Barra: 79/136 = **58%**. El resto son precios estimados o a mano → costos/márgenes NO confiables (rompe la regla "precio = SR12").
- **Rendimientos inconsistentes** (churrasca): unas en gramos, otras en "porciones", otras en "1". El costo POR PORCIÓN queda incomparable y el precio sugerido sale mal. Ej.: "Arrachera" usa 4 kg de carne pero dice rendir **350 g**; "PICAÑA" rinde "1 porción" = $397; "Cochinita Pibil" rinde "13.5 porciones".
- **Solo 24 de 57 recetas de churrasca están vinculadas a charola** → las otras 33 NO descuentan inventario (salsas + carnes como Picaña, Pechuga, Lomo, Tomahawk, Pierna y muslo).
- **Solo 26 ingredientes están marcados inventariables** (InvChurrascaConfig). Aunque una receta esté vinculada, si ninguno de sus insumos está en esa lista, no mueve inventario → 11 recetas vinculadas que igual no descuentan.

### 🟡 Bugs puntuales de datos
- **"Sal" con unidad = litros** ($15/lt) — la sal no se mide en litros (debe ser kg). Revisar también "Sal de espuma" $300/kg (carísimo).
- **Barra: Albahaca $168 por "4 hojas"**, Fresa $40/pieza, Kiwi $52, Naranja/Limón/Manzana $46–60/pieza, Sprite $84/750ml (frutas/refresco ya en tarea de Weslley `PM-585bb3f5`).
- 3 recetas churrasca **sin instrucciones**: Cochinita Pibil, Legumbres a la parrilla, Nopales con queso asado.
- Recetas con costo absurdo conocido: Cochinita Pibil $3,721 · Cochinita pibil desayuno $3,670 · Tomahawk $3,199.
- Carajillos duplicados (barra) — ya en tarea del barman `PM-76b62a90`.

### Insumos sin vínculo SR12 (los que más pegan)
Carnes premium estimadas (quizá no pasan por el POS): Arrachera $315/kg, Baby beef $421/kg, Tomahawk $652/kg, Corte búfalo/Capitão $380/kg, Mamiña $304/kg, Costilla de res $222/kg, Pernil $176/kg, Lomo de cerdo $195/kg, Picaña.
Condimentos/básicos sin SR12: Sal, Azúcar, Aceite, Vinagre, Jugos (limón/naranja $42/lt est), Comino, Paprika, Achiote, Canela, etc.

### Barra (nota)
Barra NO entra a charolas/descuento (es servicio a la carta). Su cuadre es el **Cuadre de Barra** (ventas POS × receta vs inventario), que depende de las Ventas SR12 (tarea de Luis).

### Dimensión 6 (cuadre teórico vs real) — viabilidad
Las piezas existen (descuento por charola, hoja Mermas, existencia_* por área del SR12, y ya hay un "Cuadre de carne semanal" en el Tablero) PERO la cobertura es baja: 24/57 vinculadas + 26 inventariables. Hay que ampliar cobertura para que el cuadre sea real y no parcial.

## Propuesta — "Validador de recetas" (control permanente)
Endpoint read-only `recetas_validacion` (núcleo `_validacionRecetasCore`, reusable por el auditor) que por CADA receta corre 6 checks y da semáforo:

| # | Check | Verde | Amarillo | Rojo |
|---|---|---|---|---|
| 1 | Lógica | instrucciones reales + sin líneas sospechosas + rendimiento coherente | falta instrucciones | línea con cantidad absurda / sin ingredientes |
| 2 | SR12 | 100% insumos vinculados | parcial | <50% vinculados |
| 3 | Costo | costo/porción en rango de su categoría | estimado | línea con costo desproporcionado / unidad rara (Sal en lt) |
| 4 | Charola (cocina/churrasca) | vinculada | — | no vinculada |
| 5 | Inventario (cocina/churrasca) | ≥1 insumo inventariable | — | ninguno → no descuenta |
| 6 | Cuadre-ready | insumos inventariables con existencia SR12 | parcial | sin datos para comparar |

Salida: scorecard por receta + KPIs ("% recetas sanas" por área) + lista de **qué arreglar y quién**:
- **Comprador** (SR12/costos): vincular insumos, corregir unidades/precios en SR12.
- **Chef**: cantidades/instrucciones/rendimiento.
- **Admin**: vincular charola + marcar inventariables.

Se replica a todas las áreas. Puede **alimentar los pendientes de Telegram** (receta que falla → aviso al rol correcto) y vivir como panel (en Recetas, junto al 🩺 Diagnóstico, y/o en el Tablero Directivo).

## Estado
- Auditoría: HECHA (este doc).
- Validador: PROPUESTO, falta construir (esperando luz verde de Germán + decisiones de umbrales/dónde vive).
