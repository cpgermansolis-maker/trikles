// =====================================================================================
// F3 — IMPORTADOR SOFTRESTAURANT 12 (v128 · 2026-05-08)
// =====================================================================================
// Filosofía: "SR12 es el espejo, Fogueira el reflejo".
//
// Flujo:
//   1. Weslley (o admin) sube los 6 archivos EXISTENCIAS del SR12 (uno por área física)
//   2. Backend parsea: extrae catálogo + costos + existencia por área
//   3. Filtra por familias configurables (default: ABARROTES, CARNES, AVES, PESCADOS Y
//      MARISCOS, CARNES FRIAS Y EMBUTIDOS, ESPECIES Y SEMILLAS, LACTEOS, FRUTAS, VERDURAS)
//   4. Match contra catálogo Fogueira por: clave SR12 (ya ligado) → nombre exacto → similar
//   5. Genera preview (dry-run) con: nuevos, actualizados, sin cambio, divergencias >50%,
//      huérfanos Fogueira sin equivalente, productos sin parser de unidad
//   6. Usuario confirma → se aplican: costos en Ingredientes, existencias en IngredientesSR12,
//      log en ImportacionesSR12 + ImportacionDetalleSR12, links en IngredientesSR12Match
//   7. Reversa disponible: cada importación es revertible
//
// Estructura de archivos del SR12 (validada con datos reales 2026-05-08):
//   Filas 0-5: encabezado del reporte (empresa, fecha, almacén)
//   Fila intercalada "GRUPO:XXX FAMILIA" — separa grupos
//   Header: CLAVE | DESCRIPCION | IMPUESTO1 | EXISTENCIA | UNIDAD | ULTIMO COSTO | SALDO
//   Datos: ~562 productos (mismo catálogo en los 6 archivos, varía solo EXISTENCIA)
//   Filas finales "REGISTROS / TOTAL" con sumatoria — se ignoran
//   ⚠ Columna UNIDAD viene VACÍA → se parsea de la DESCRIPCIÓN
// =====================================================================================

// Familias por default. Se puede sobrescribir por config en hoja Configuracion.
var SR12_FAMILIAS_DEFAULT = [
  'ABARROTES',
  'AVES', 'CARNES', 'CARNES FRIAS Y EMBUTIDOS', 'PESCADOS Y MARISCOS',
  'ESPECIES Y SEMILLAS', 'LACTEOS', 'FRUTAS', 'VERDURAS'
];

// Mapeo de área (nombre del archivo o título de la hoja) → columna de existencia.
// El parser detecta el área del título: "INVENTARIO AL ... ALMACÉN: 04 (ALMACEN GENERAL)"
var SR12_AREAS_NORMALIZACION = {
  'almacen': 'almacen', 'almacen general': 'almacen', '04': 'almacen',
  'barra de bebidas': 'barra', 'barra': 'barra', '14': 'barra',
  'cava': 'cava', '12': 'cava',
  'churrasca': 'churrasca', '09': 'churrasca',
  'cocina': 'cocina', '10': 'cocina',
  'piso': 'piso', '11': 'piso'
};

// =====================================================================================
// PARSER DE UNIDADES (extracción de unidad+presentación de la descripción del SR12)
// =====================================================================================
// El SR12 NO exporta la unidad como columna separada. La unidad está embebida en la
// descripción del producto. Ejemplos típicos:
//   "ACEITE DE OLIVA 20LTS"         → unidad: ml, presentacion: 20, factor: 20000
//   "TOP SIRLOIN X KG"              → unidad: g,  presentacion: 1,  factor: 1000
//   "ACEITUNAS X 442GR"             → unidad: g,  presentacion: 442, factor: 442
//   "PALILLOS X 100PZ"              → unidad: pza, presentacion: 100, factor: 100
//   "JAMON X 6KG"                   → unidad: g,  presentacion: 6,   factor: 6000
//   "MANZANA POR KG"                → unidad: g,  presentacion: 1,   factor: 1000
//   "QUESO POR KILO"                → unidad: g,  presentacion: 1,   factor: 1000
//   "CREMA X LITROS"                → unidad: ml, presentacion: 1,   factor: 1000
//
// Regla en orden de especificidad. La PRIMERA que matchea gana — por eso las reglas
// más específicas (con número delante) van antes que las genéricas.
//
// Casos "sin parser" típicos (3-5% del catálogo):
//   "MANTEQUILLA EUGENIA" (sin unidad clara) → se importa con factor=1, parser_ok=false
//                                              y Weslley lo liga manualmente la primera vez.
function sr12ParsearUnidad(descripcion) {
  if (!descripcion) return null;
  var D = String(descripcion).toUpperCase().trim();
  // Normalizar separadores: "PEREJILX KG" → "PEREJIL X KG" (typo del SR12)
  D = D.replace(/([A-ZÑ])X\s+(KG|KILO|GR|LTS?)/g, '$1 X $2');
  // Typos comunes del SR12 en la unidad (el POS captura los nombres a mano, con errores):
  D = D.replace(/(\d)\s*KH(?:S)?\b/g, '$1KG');    // "4.25KH" → "4.25KG"  (KH por KG)
  D = D.replace(/(\d)\s*KL(?:S)?\b/g, '$1KG');    // "25KL"   → "25KG"
  D = D.replace(/(\d)\s*LTR(?:S)?\b/g, '$1LT');   // "20LTR"  → "20LT"
  D = D.replace(/(\d)\s*MLT(?:S)?\b/g, '$1ML');   // "500MLT" → "500ML"

  // ── Presentaciones COMPUESTAS: "<volumen/peso unitario> X [CAJA] <N>PZS" ──
  // El SR12 trae el precio de la CAJA completa. Hay que multiplicar el volumen/peso UNITARIO
  // por las PIEZAS para obtener el factor_a_base correcto; si no, el costo por ml/g sale N veces
  // inflado (origen del desastre de costos en barra: refrescos/cervezas/aguas en "caja de 12").
  //   "355ML X CAJA 12PZS"  = 12 × 355 ml  = 4260 ml  → costo/ml = precio_caja / 4260
  //   "CERVEZA 355ML X 24PZS" = 24 × 355 ml = 8520 ml
  //   "YOGURT 150GR X 6PZS" = 6 × 150 g    = 900 g
  // OJO: solo aplica cuando hay PIEZAS (PZS/PZ). "2LT X 8 CAJAS" (sin piezas, no sabemos cuántas
  // botellas trae cada caja) queda AMBIGUO a propósito → no se toca (cae a las reglas normales).
  var _mPzs = D.match(/X\s*(?:CAJA\s*(?:DE\s*)?)?(\d+)\s*PZS?\b/);
  if (_mPzs) {
    var _piezas = parseInt(_mPzs[1], 10);
    if (_piezas > 1) {
      var _antes = D.slice(0, _mPzs.index), _mu;
      if ((_mu = _antes.match(/(\d+(?:[.,]\d+)?)\s*ML\b/))) {
        return { unidad_base:'ml', presentacion:_piezas, factor_a_base: parseFloat(String(_mu[1]).replace(',', '.')) * _piezas, regla:'compuesta_ml_x_pzs' };
      }
      if ((_mu = _antes.match(/(\d+(?:[.,]\d+)?)\s*LTS?\b/))) {
        return { unidad_base:'ml', presentacion:_piezas, factor_a_base: parseFloat(String(_mu[1]).replace(',', '.')) * 1000 * _piezas, regla:'compuesta_lt_x_pzs' };
      }
      if ((_mu = _antes.match(/(\d+(?:[.,]\d+)?)\s*GR(?:S)?\b/))) {
        return { unidad_base:'g', presentacion:_piezas, factor_a_base: parseFloat(String(_mu[1]).replace(',', '.')) * _piezas, regla:'compuesta_gr_x_pzs' };
      }
      if ((_mu = _antes.match(/(\d+(?:[.,]\d+)?)\s*KGS?\b/))) {
        return { unidad_base:'g', presentacion:_piezas, factor_a_base: parseFloat(String(_mu[1]).replace(',', '.')) * 1000 * _piezas, regla:'compuesta_kg_x_pzs' };
      }
    }
  }

  var reglas = [
    // Gramos con cantidad: "X 442GR", "X 500 GR", "X 442 GRS"
    { re: /(?:^|\s)X\s*(\d+(?:[.,]\d+)?)\s*GR(?:S)?\b/, unidad: 'g',  factor: 1 },
    // Kilos con cantidad: "X 1.5KG", "X 25KG", "BULTO DE 25KG", "X 6KG", "X 2.27KGS"
    { re: /(?:DE|X)\s*(\d+(?:[.,]\d+)?)\s*KGS?\b/,      unidad: 'g',  factor: 1000 },
    { re: /(\d+(?:[.,]\d+)?)\s*KGS?\b/,                 unidad: 'g',  factor: 1000 },
    // Kilo unitario (presentación = 1 kg): "X KG", "X KILO", "X KILOS", "POR KG", "POR KILO", "POR KILOS"
    { re: /\b(?:X|POR)\s*KGS?\b/,                        unidad: 'g',  factor: 1000, presDefault: 1 },
    { re: /\b(?:X|POR)\s*KILOS?\b/,                      unidad: 'g',  factor: 1000, presDefault: 1 },
    // Litros con cantidad: "20LT", "20LTS", "5LT"
    { re: /(\d+(?:[.,]\d+)?)\s*LTS?\b/,                  unidad: 'ml', factor: 1000 },
    // Litros unitarios: "X LTS", "X LITROS", "POR LITROS", "POR LITRO"
    { re: /\b(?:X|POR)\s*LTS?\b/,                        unidad: 'ml', factor: 1000, presDefault: 1 },
    { re: /\b(?:X|POR)\s*LITROS?\b/,                     unidad: 'ml', factor: 1000, presDefault: 1 },
    // Litros con número (poco común): "1L"
    { re: /(\d+(?:[.,]\d+)?)\s*L\b(?!T)/,                unidad: 'ml', factor: 1000 },
    // Mililitros: "750ML", "500 ML"
    { re: /(\d+(?:[.,]\d+)?)\s*ML\b/,                    unidad: 'ml', factor: 1 },
    // Piezas con cantidad: "100PZ", "144PZ", "24PZS", "12 PZS"
    { re: /(\d+)\s*PZS?\b/,                              unidad: 'pza', factor: 1 },
    // Sobres / caja de N sobres: "X CAJA 50 SOBRES", "X 80 SOBRES"
    { re: /(\d+)\s*SOBRES?\b/,                           unidad: 'pza', factor: 1 },
    // Pieza unitaria: "X PIEZA", "X PZ", "POR PIEZA"
    { re: /\b(?:X|POR)\s*PIEZAS?\b/,                     unidad: 'pza', factor: 1, presDefault: 1 },
    { re: /\b(?:X|POR)\s*PZS?\b/,                        unidad: 'pza', factor: 1, presDefault: 1 },
    // Solo gramos al final (sin "X"): "350GR", "390 GR"
    { re: /(\d+(?:[.,]\d+)?)\s*GR(?:S)?\b/,              unidad: 'g',  factor: 1 },
    // Gramos abreviado con sola "G": "120G", "500 G" (al final, menor prioridad)
    { re: /(\d+(?:[.,]\d+)?)\s*G\b/,                     unidad: 'g',  factor: 1 }
  ];

  for (var i = 0; i < reglas.length; i++) {
    var r = reglas[i];
    var m = D.match(r.re);
    if (m) {
      var pres = r.presDefault;
      if (m[1]) pres = parseFloat(String(m[1]).replace(',', '.'));
      if (pres == null || isNaN(pres)) continue;
      return {
        unidad_base: r.unidad,
        presentacion: pres,
        factor_a_base: pres * r.factor,
        regla: r.re.toString()
      };
    }
  }
  return null;
}

// Costo por unidad base. Si parser falló o costo es 0, retorna 0.
function sr12CostoPorBase(parsed, costoTotal) {
  if (!parsed || !costoTotal || parsed.factor_a_base === 0) return 0;
  return costoTotal / parsed.factor_a_base;
}

// Normaliza un nombre para matching (mayúsculas, sin acentos, sin signos extra, sin espacios dobles)
function sr12NormalizarNombre(s) {
  if (!s) return '';
  return String(s)
    .toUpperCase()
    .replace(/[ÁÀÄÂÃ]/g, 'A')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔÕ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U')
    .replace(/[Ñ]/g, 'N')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// SR12 pega la presentación dentro del nombre. Esta función la quita para que el matching
// pueda comparar contra el nombre limpio de Fogueira.
// Ejemplos:
//   "ACEITE DE OLIVA 20LTS"                       → "ACEITE DE OLIVA"
//   "ABLANDADOR DE CARNES X 155GR"                → "ABLANDADOR DE CARNES"
//   "ACEITUNAS NEGRAS SIN HUES X 442GR (MD 170GR)"→ "ACEITUNAS NEGRAS SIN HUES"
function sr12LimpiarPresentacion(s) {
  if (!s) return '';
  var t = String(s);
  // 1) Paréntesis con cualquier contenido — típicamente sub-presentaciones tipo (MD 170GR), (MS 595GR)
  t = t.replace(/\s*\([^)]*\)/g, '');
  // 2) "X 442GR", "X 1KG", "X 20LT", etc.
  t = t.replace(/\s+X\s*\d+(\.\d+)?\s*(KGS?|GRS?|G|L|LTS?|LITROS?|ML|CC|PZS?|PZAS?|UN[DE]?S?|UNIDADES?|CJAS?|CAJAS?|TIRAS?|PAQ|PAQUETES?)\b/gi, '');
  // 3) Sufijos pegados al final: "20LTS", "5KG", "1L", "330ML", etc.
  t = t.replace(/\s+\d+(\.\d+)?\s*(KGS?|GRS?|LTS?|LITROS?|ML|CC|PZS?|PZAS?|UN[DE]?S?)\b/gi, '');
  // 4) Punto final suelto y espacios dobles
  t = t.replace(/\s*\.\s*$/g, '').replace(/\s+/g, ' ').trim();
  return t;
}

// Tokeniza un nombre normalizado descartando palabras cortas (<3 chars) que no aportan al matching.
function sr12Tokenizar(nombreNormalizado) {
  if (!nombreNormalizado) return [];
  return nombreNormalizado.split(' ').filter(function(t){ return t.length >= 3; });
}

// Levenshtein "≤1" optimizado: true si dos strings difieren en a lo más 1 edición (insertar/borrar/sustituir).
// Mucho más rápido que Levenshtein completo porque sale temprano.
function sr12EditDistanceLeq1(a, b) {
  var diff = a.length - b.length;
  if (diff < -1 || diff > 1) return false;
  if (diff === 0) { // misma longitud: sustitución
    var d = 0;
    for (var i = 0; i < a.length; i++) {
      if (a.charAt(i) !== b.charAt(i)) { d++; if (d > 1) return false; }
    }
    return true; // d === 0 (iguales) o d === 1
  }
  // Longitud difiere por 1: una inserción/borrado
  var corto = diff < 0 ? a : b;
  var largo = diff < 0 ? b : a;
  var ci = 0, li = 0, gap = false;
  while (ci < corto.length && li < largo.length) {
    if (corto.charAt(ci) === largo.charAt(li)) { ci++; li++; }
    else { if (gap) return false; gap = true; li++; }
  }
  return true;
}

// True si dos tokens son "equivalentes": iguales, o con 1 edición Y ambos ≥4 chars
// (cubre olivo↔oliva, papa↔papas, cebolla↔cebollas, blanco↔blanca, etc.)
function sr12TokensSimilares(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return sr12EditDistanceLeq1(a, b);
}

// Containment asimétrico: % de tokens del "lado corto" (Fog) que están presentes en el "lado largo" (SR12).
// Tolera typos vía sr12TokensSimilares. Retorna 0-1.
function sr12ContainmentScore(tokensFog, tokensSR12) {
  if (!tokensFog.length) return 0;
  var encontrados = 0;
  for (var i = 0; i < tokensFog.length; i++) {
    for (var j = 0; j < tokensSR12.length; j++) {
      if (sr12TokensSimilares(tokensFog[i], tokensSR12[j])) { encontrados++; break; }
    }
  }
  return encontrados / tokensFog.length;
}

// La hoja Ingredientes preexiste en instalaciones < v130 sin la columna clave_sr12.
// Esta función la agrega al final si falta. Idempotente — segura de llamar siempre.
function sr12AsegurarColumnaClaveEnIngredientes() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ingredientes');
  if (!sh) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === 'clave_sr12') return;
  }
  var col = headers.length + 1;
  sh.getRange(1, col)
    .setValue('clave_sr12')
    .setFontWeight('bold')
    .setBackground('#b8472a')
    .setFontColor('#FFFFFF');
}

// =====================================================================================
// CONFIG (familias activas)
// =====================================================================================
var SR12_CLAVE_FAMILIAS_CONFIG = 'sr12_familias_importar';

function sr12FamiliasActivas(empresa_id) {
  var sheet = getSheet('Configuracion');
  if (!sheet) return SR12_FAMILIAS_DEFAULT.slice();
  var fila = rowsToObjects(sheet).find(function(r){
    return r.empresa_id === empresa_id && String(r.clave) === SR12_CLAVE_FAMILIAS_CONFIG;
  });
  if (!fila || !fila.valor) return SR12_FAMILIAS_DEFAULT.slice();
  // v402 — separador '|' (no ','): hay familias con coma EN el nombre ("JUGOS, AGUAS Y REFRESCOS")
  // que el split(',') partía en dos y rompía el filtro. Compat: si no hay '|', es config vieja CSV.
  var sep = String(fila.valor).indexOf('|') !== -1 ? '|' : ',';
  return String(fila.valor).split(sep).map(function(s){ return s.trim(); }).filter(function(s){ return s; });
}
function sr12GuardarFamiliasActivas(empresa_id, familias) {
  var sheet = asegurarHoja('Configuracion', ['empresa_id','sucursal_id','clave','valor']);
  var existing = rowsToObjects(sheet).find(function(r){
    return r.empresa_id === empresa_id && String(r.clave) === SR12_CLAVE_FAMILIAS_CONFIG;
  });
  var valor = (familias || []).join('|');  // v402 — '|' soporta familias con coma en el nombre
  if (existing) {
    sheet.getRange(existing._row, 4).setValue(valor);
  } else {
    sheet.appendRow([empresa_id, '', SR12_CLAVE_FAMILIAS_CONFIG, valor]);
  }
}

function handleSr12ConfigGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };
  return {
    ok: true,
    familias_activas: sr12FamiliasActivas(u.empresa_id),
    familias_default: SR12_FAMILIAS_DEFAULT.slice(),
    todas_familias: [
      'ABARROTES','AGUA Y HIELO','AVES','CARNES','CARNES FRIAS Y EMBUTIDOS',
      'CERVEZAS','DESTILADOS','ESPECIES Y SEMILLAS','FRUTAS','JUGOS, AGUAS Y REFRESCOS',
      'LACTEOS','LICORES','PESCADOS Y MARISCOS','SUMIN DE LIMPIEZA',
      'SUMINISTRO GENERAL','VERDURAS','VINOS'
    ]
  };
}
function handleSr12ConfigSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  if (!Array.isArray(data.familias)) return { ok:false, error:'familias debe ser array' };
  sr12GuardarFamiliasActivas(u.empresa_id, data.familias);
  return { ok:true, familias_activas: data.familias };
}

// =====================================================================================
// PROCESAMIENTO DEL PAYLOAD (lo que manda el frontend tras parsear los .XLS)
// =====================================================================================
// Estructura esperada del payload (data):
// {
//   archivos: [
//     {
//       nombre: "ALMACEN EXISTENCIAS.XLS",
//       area: "almacen" | "barra" | "cava" | "churrasca" | "cocina" | "piso",
//       productos: [
//         { clave: "1001", descripcion: "ABLANDADOR DE CARNES X 155GR",
//           grupo: "ABARROTES", impuesto: 0, existencia: 2.48,
//           ultimo_costo: 121, saldo: 300.08 },
//         ...
//       ]
//     },
//     ...
//   ]
// }
//
// Consolida los archivos en un mapa por clave_sr12, sumando existencia por área.
// Retorna { productos: { CLAVE: { ...datos consolidados... } }, archivosVistos: [...] }
function sr12ConsolidarArchivos(archivos) {
  var consolidado = {};
  var archivosVistos = [];
  archivos.forEach(function(arch){
    var area = arch.area || '';
    archivosVistos.push({ nombre: arch.nombre, area: area, productos: (arch.productos || []).length });
    (arch.productos || []).forEach(function(p){
      var clave = String(p.clave || '').trim();
      if (!clave) return;
      if (!consolidado[clave]) {
        var parsed = sr12ParsearUnidad(p.descripcion);
        var costo = parseFloat(p.ultimo_costo) || 0;
        consolidado[clave] = {
          clave_sr12: clave,
          nombre_sr12: String(p.descripcion || '').trim(),
          familia_sr12: String(p.grupo || '').trim(),
          impuesto_pct: parseFloat(p.impuesto) || 0,
          costo_total_sr12: costo,
          unidad_base: parsed ? parsed.unidad_base : '',
          presentacion_descripcion: parsed ? ('Pres ' + parsed.presentacion) : 'sin parser',
          factor_a_base: parsed ? parsed.factor_a_base : 1,
          costo_por_base_sr12: parsed ? sr12CostoPorBase(parsed, costo) : 0,
          parser_unidad_ok: !!parsed,
          existencia_almacen: 0, existencia_barra: 0, existencia_cava: 0,
          existencia_churrasca: 0, existencia_cocina: 0, existencia_piso: 0,
          existencia_total: 0, saldo_total: 0
        };
      }
      var c = consolidado[clave];
      var ex = parseFloat(p.existencia) || 0;
      var saldo = parseFloat(p.saldo) || 0;
      // Asignar existencia al área correcta
      if (area === 'almacen')   c.existencia_almacen   += ex;
      if (area === 'barra')     c.existencia_barra     += ex;
      if (area === 'cava')      c.existencia_cava      += ex;
      if (area === 'churrasca') c.existencia_churrasca += ex;
      if (area === 'cocina')    c.existencia_cocina    += ex;
      if (area === 'piso')      c.existencia_piso      += ex;
      c.existencia_total += ex;
      c.saldo_total += saldo;
    });
  });
  return { productos: consolidado, archivosVistos: archivosVistos };
}

// =====================================================================================
// MATCHING SR12 ↔ Fogueira
// =====================================================================================
// Reglas en orden (v130 — refactor):
//   A1) Clave SR12 ya ligada en la tabla puente IngredientesSR12Match (matches previos)
//   A2) Clave SR12 escrita directamente en Ingredientes.clave_sr12 (vínculo manual o auto-creado)
//   B)  Nombre exacto normalizado, comparando nombre Fog vs nombre SR12 LIMPIO (sin presentación)
//   C)  Containment asimétrico ≥75%: % de tokens del Fog presentes en el SR12 limpio, tolerando typos
//   D)  Lo mismo que B+C pero también contra los aliases del ingrediente Fog (si están definidos)
//   Sin match → producto nuevo, se va a auto-crear en Fogueira con su clave_sr12 ya ligada
function sr12HacerMatch(productoSR12, ingredientesFog, matchesYaLigados) {
  // A1 — clave en tabla puente
  if (matchesYaLigados[productoSR12.clave_sr12]) {
    var idFog = matchesYaLigados[productoSR12.clave_sr12].ingrediente_id_fogueira;
    var ingFog = ingredientesFog.find(function(x){ return x.id === idFog; });
    if (ingFog) return { tipo_match: 'clave', score: 1, ingrediente_fogueira: ingFog };
  }
  // A2 — clave_sr12 directa en Ingredientes (nueva col v130)
  var claveStr = String(productoSR12.clave_sr12);
  var ingDirecto = ingredientesFog.find(function(x){ return x.clave_sr12 && String(x.clave_sr12) === claveStr; });
  if (ingDirecto) return { tipo_match: 'clave_directa', score: 1, ingrediente_fogueira: ingDirecto };

  // Pre-procesar SR12: limpiar presentación + normalizar + tokenizar
  var normSR  = sr12NormalizarNombre(sr12LimpiarPresentacion(productoSR12.nombre_sr12));
  var tokSR   = sr12Tokenizar(normSR);
  if (!normSR || !tokSR.length) return { tipo_match: 'sin_match', score: 0, ingrediente_fogueira: null };

  // v137 — "regla del anchor": la PRIMERA palabra significativa del SR12 es el "tipo del producto"
  // (ABLANDADOR, ACEITE, CARNE, PASTA…). Un match contra Fog es válido solo si el anchor está
  // en los tokens del Fog. Filtra falsos positivos como "Carne" Fog vs "ABLANDADOR DE CARNES" SR12.
  var anchorSR = tokSR[0];

  // B/C/D — recorrer ingredientes Fog: por nombre principal Y por cada alias.
  var mejor = null, mejorScore = 0, mejorTipo = 'sin_match', mejorPrioridad = 0;
  for (var i = 0; i < ingredientesFog.length; i++) {
    var ing = ingredientesFog[i];
    // Lista de "candidatos" para este ingrediente: nombre + aliases (separados por coma/punto-coma/salto-de-línea)
    var candidatos = [ing.nombre];
    if (ing.aliases) {
      String(ing.aliases).split(/[,;\n]/).forEach(function(a){
        var t = a.trim(); if (t) candidatos.push(t);
      });
    }
    for (var c = 0; c < candidatos.length; c++) {
      var normFog = sr12NormalizarNombre(candidatos[c]);
      if (!normFog) continue;
      // B — nombre exacto (sobre el nombre SR12 ya limpio)
      if (normFog === normSR) {
        var tipoB = c === 0 ? 'nombre_exacto' : 'alias_exacto';
        return { tipo_match: tipoB, score: 1, ingrediente_fogueira: ing };
      }
      // C — containment asimétrico (Fog ⊂ SR12, tolerando typos)
      var tokFog = sr12Tokenizar(normFog);
      if (!tokFog.length) continue;
      // Regla del anchor: la 1ra palabra del SR12 debe aparecer entre los tokens del Fog.
      var tieneAnchor = false;
      for (var ta = 0; ta < tokFog.length; ta++) {
        if (sr12TokensSimilares(tokFog[ta], anchorSR)) { tieneAnchor = true; break; }
      }
      if (!tieneAnchor) continue;
      var score = sr12ContainmentScore(tokFog, tokSR);
      if (score < 0.75) continue; // bajo umbral mínimo
      // Desempate: ante misma cobertura, ganar el más específico (más tokens).
      var prioridad = score * 1000 + tokFog.length; // tie-breaker
      if (prioridad > mejorPrioridad) {
        mejorPrioridad = prioridad;
        mejorScore = score;
        mejor = ing;
        mejorTipo = c === 0 ? 'nombre_similar' : 'alias_similar';
      }
    }
  }
  if (mejor && mejorScore >= 0.75) {
    return { tipo_match: mejorTipo, score: mejorScore, ingrediente_fogueira: mejor };
  }
  return { tipo_match: 'sin_match', score: 0, ingrediente_fogueira: null };
}

// =====================================================================================
// HANDLER: DRY-RUN (preview del import sin aplicar)
// =====================================================================================
function handleSr12ImportDryRun(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  if (!Array.isArray(data.archivos) || !data.archivos.length) return { ok:false, error:'No se recibieron archivos' };

  // 1. Consolidar productos por clave SR12
  var consolidacion = sr12ConsolidarArchivos(data.archivos);
  var todosProductos = Object.keys(consolidacion.productos).map(function(k){ return consolidacion.productos[k]; });

  // 2. Filtrar por familia activa
  var familiasActivas = sr12FamiliasActivas(u.empresa_id);
  var familiasSet = {}; familiasActivas.forEach(function(f){ familiasSet[f.toUpperCase()] = true; });
  var importables = todosProductos.filter(function(p){ return familiasSet[String(p.familia_sr12 || '').toUpperCase()]; });
  var ignoradosFamilia = todosProductos.length - importables.length;

  // 3. Cargar catálogos para matching
  // v130: aseguramos la columna clave_sr12 en Ingredientes ANTES de leer (auto-migración).
  sr12AsegurarColumnaClaveEnIngredientes();
  var ingredientesFogTodos = rowsToObjects(getSheet('Ingredientes'));
  var empresasDistintas = {};
  ingredientesFogTodos.forEach(function(x){ if (x.empresa_id) empresasDistintas[x.empresa_id] = (empresasDistintas[x.empresa_id]||0) + 1; });
  var ingredientesFog = ingredientesFogTodos.filter(function(x){
    // Solo descartamos si está EXPLÍCITAMENTE marcado como inactivo. Históricamente la columna
    // 'activo' no se carga al crear ingredientes desde recetario (queda vacía y funciona OK
    // en recetas/charolas porque NO filtran por activo). Aplicamos el mismo criterio aquí.
    if (x.empresa_id !== u.empresa_id) return false;
    if (x.activo === false) return false;
    var av = String(x.activo).trim().toLowerCase();
    if (av === 'false' || av === '0' || av === 'no') return false;
    return true;
  });
  var matches = rowsToObjects(asegurarHoja('IngredientesSR12Match',
    ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at']));
  var matchesYaLigados = {};
  matches.forEach(function(m){ if (m.empresa_id === u.empresa_id) matchesYaLigados[m.clave_sr12] = m; });

  // 4. Cargar IngredientesSR12 actual para detectar diff de costos
  var sr12Actual = rowsToObjects(asegurarHoja('IngredientesSR12',
    ['clave_sr12','empresa_id','nombre_sr12','familia_sr12','presentacion_descripcion','unidad_base','factor_a_base','costo_total_sr12','costo_por_base_sr12','impuesto_pct','existencia_almacen','existencia_barra','existencia_cava','existencia_churrasca','existencia_cocina','existencia_piso','existencia_total','saldo_total','parser_unidad_ok','creado_at','actualizado_at','ultima_importacion_id']));
  var sr12PorClave = {};
  sr12Actual.forEach(function(s){ if (s.empresa_id === u.empresa_id) sr12PorClave[s.clave_sr12] = s; });

  // 5. Procesar cada producto importable: clasificar y armar detalles
  var detalles = [];
  var contadores = {
    nuevos_creados: 0, actualizados: 0, sin_cambio: 0,
    divergencias_grandes: 0, parser_fallos: 0,
    creados_fogueira: 0
  };

  importables.forEach(function(prod) {
    if (!prod.parser_unidad_ok) contadores.parser_fallos++;

    var anteriorSR12 = sr12PorClave[prod.clave_sr12];
    var costoAnterior = anteriorSR12 ? parseFloat(anteriorSR12.costo_por_base_sr12) || 0 : 0;
    var costoNuevo = prod.costo_por_base_sr12;
    var variacion = costoAnterior > 0 ? ((costoNuevo - costoAnterior) / costoAnterior) * 100 : 0;

    var match = sr12HacerMatch(prod, ingredientesFog, matchesYaLigados);

    var accion;
    if (!anteriorSR12) {
      accion = 'nuevo_sr12';
      contadores.nuevos_creados++;
      if (!match.ingrediente_fogueira) contadores.creados_fogueira++;
    } else if (Math.abs(variacion) < 0.01) {
      accion = 'sin_cambio';
      contadores.sin_cambio++;
    } else {
      accion = 'actualizado_costo';
      contadores.actualizados++;
      if (Math.abs(variacion) >= 50) {
        contadores.divergencias_grandes++;
        accion = 'sospechoso';
      }
    }

    detalles.push({
      clave_sr12: prod.clave_sr12,
      nombre_sr12: prod.nombre_sr12,
      familia_sr12: prod.familia_sr12,
      presentacion_descripcion: prod.presentacion_descripcion,
      unidad_base: prod.unidad_base,
      factor_a_base: prod.factor_a_base,
      parser_unidad_ok: prod.parser_unidad_ok,
      costo_total_sr12: prod.costo_total_sr12,
      costo_por_base_sr12: prod.costo_por_base_sr12,
      costo_anterior_base: costoAnterior,
      variacion_pct: Math.round(variacion * 100) / 100,
      existencia_almacen: prod.existencia_almacen,
      existencia_barra: prod.existencia_barra,
      existencia_cava: prod.existencia_cava,
      existencia_churrasca: prod.existencia_churrasca,
      existencia_cocina: prod.existencia_cocina,
      existencia_piso: prod.existencia_piso,
      existencia_total: prod.existencia_total,
      saldo_total: prod.saldo_total,
      accion: accion,
      tipo_match: match.tipo_match,
      score_match: match.score,
      ingrediente_fogueira_id: match.ingrediente_fogueira ? match.ingrediente_fogueira.id : null,
      ingrediente_fogueira_nombre: match.ingrediente_fogueira ? match.ingrediente_fogueira.nombre : null
    });
  });

  // 6. Calcular huérfanos Fogueira (ingredientes Fogueira sin equivalente SR12 en este import)
  var clavesImportablesSet = {};
  importables.forEach(function(p){ clavesImportablesSet[p.clave_sr12] = true; });
  var clavesYaLigadasSet = {};
  Object.keys(matchesYaLigados).forEach(function(k){ clavesYaLigadasSet[k] = matchesYaLigados[k].ingrediente_id_fogueira; });
  var idsFogQueQuedanLigados = {};
  detalles.forEach(function(d){ if (d.ingrediente_fogueira_id) idsFogQueQuedanLigados[d.ingrediente_fogueira_id] = true; });

  var huerfanos = ingredientesFog.filter(function(x){
    return !idsFogQueQuedanLigados[x.id];
  }).map(function(x){
    return { id: x.id, nombre: x.nombre, ultimo_costo: x.ultimo_costo, dato_incompleto: x.dato_incompleto };
  });

  return {
    ok: true,
    resumen: {
      total_archivos: data.archivos.length,
      archivos_vistos: consolidacion.archivosVistos,
      total_productos_archivos: todosProductos.length,
      productos_filtrados_familia: importables.length,
      productos_ignorados_familia: ignoradosFamilia,
      familias_activas: familiasActivas,
      nuevos_creados: contadores.nuevos_creados,
      actualizados: contadores.actualizados,
      sin_cambio: contadores.sin_cambio,
      divergencias_grandes: contadores.divergencias_grandes,
      parser_fallos: contadores.parser_fallos,
      creados_fogueira: contadores.creados_fogueira,
      huerfanos_fogueira: huerfanos.length
    },
    detalles: detalles,
    huerfanos: huerfanos
  };
}

// =====================================================================================
// HANDLER: APLICAR (toma el mismo payload, ejecuta cambios reales)
// =====================================================================================
function handleSr12ImportAplicar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }

  // Reusar el dry-run para tener detalles consistentes
  var dryRun = handleSr12ImportDryRun(p);
  if (!dryRun.ok) return dryRun;

  // Si hay cambios >50% requiere aprobación previa de gerente_administrativo
  if (dryRun.resumen.divergencias_grandes > 0) {
    var aprobacion = _getAprobacionValida(u.empresa_id);
    if (!aprobacion) {
      return { ok:false, requiere_aprobacion:true,
        error:'Esta importación tiene ' + dryRun.resumen.divergencias_grandes + ' cambios sospechosos (>50%). Requiere aprobación del Gerente Administrativo. Usa "Enviar a Gerencia" para solicitar autorización.' };
    }
  }

  var ahora = new Date();
  var importacionId = uuid();
  var resumen = dryRun.resumen;

  // 1. Crear fila en ImportacionesSR12 (estado preview → aplicada)
  var sheetImp = asegurarHoja('ImportacionesSR12',
    ['id','empresa_id','usuario_email','usuario_nombre','subido_at','aplicado_at','estatus','archivos_count','archivos_nombres','total_productos_archivos','productos_filtrados_familia','nuevos_creados','actualizados','sin_cambio','divergencias_grandes','huerfanos_fogueira','parser_fallos','notas','familias_activas_csv']);
  var archivosNombres = (resumen.archivos_vistos || []).map(function(a){ return a.nombre; }).join(' | ');
  sheetImp.appendRow([
    importacionId, u.empresa_id, u.email, u.nombre || u.email,
    ahora, ahora, 'aplicada',
    resumen.total_archivos, archivosNombres,
    resumen.total_productos_archivos, resumen.productos_filtrados_familia,
    resumen.nuevos_creados, resumen.actualizados, resumen.sin_cambio,
    resumen.divergencias_grandes, resumen.huerfanos_fogueira, resumen.parser_fallos,
    String(data.notas || ''), (resumen.familias_activas || []).join(',')
  ]);

  // 2. Cargar IngredientesSR12 actual y construir map para upsert
  var sheetSR12 = asegurarHoja('IngredientesSR12',
    ['clave_sr12','empresa_id','nombre_sr12','familia_sr12','presentacion_descripcion','unidad_base','factor_a_base','costo_total_sr12','costo_por_base_sr12','impuesto_pct','existencia_almacen','existencia_barra','existencia_cava','existencia_churrasca','existencia_cocina','existencia_piso','existencia_total','saldo_total','parser_unidad_ok','creado_at','actualizado_at','ultima_importacion_id']);
  var sr12Actual = rowsToObjects(sheetSR12).filter(function(s){ return s.empresa_id === u.empresa_id; });
  var sr12PorClave = {};
  sr12Actual.forEach(function(s){ sr12PorClave[s.clave_sr12] = s; });

  // 3. Cargar Ingredientes y matches (para crear nuevos / actualizar costos)
  // v130: aseguramos la columna clave_sr12 antes de leer (idempotente).
  sr12AsegurarColumnaClaveEnIngredientes();
  var sheetIng = getSheet('Ingredientes');
  // Detectar el índice de la columna clave_sr12 en la hoja real (puede no ser exactamente 27
  // si en futuro se agregan columnas intermedias). Buscamos por nombre del header.
  var ingHeaders = sheetIng.getRange(1, 1, 1, sheetIng.getLastColumn()).getValues()[0];
  var colClaveSr12 = -1;
  for (var ih = 0; ih < ingHeaders.length; ih++) {
    if (String(ingHeaders[ih]) === 'clave_sr12') { colClaveSr12 = ih + 1; break; }
  }
  // v322 — columna del precio que usan las recetas (precio_real_unitario): se recalcula al
  // actualizar costos para que el costo nuevo del SR12 llegue hasta el costeo de los platillos.
  var colPru = -1;
  for (var ip = 0; ip < ingHeaders.length; ip++) {
    if (String(ingHeaders[ip]) === 'precio_real_unitario') { colPru = ip + 1; break; }
  }
  var ingredientesFog = rowsToObjects(sheetIng).filter(function(x){ return x.empresa_id === u.empresa_id; });
  var ingredientesPorId = {};
  ingredientesFog.forEach(function(x){ ingredientesPorId[x.id] = x; });

  var sheetMatch = asegurarHoja('IngredientesSR12Match',
    ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at']);
  var matchesActuales = rowsToObjects(sheetMatch).filter(function(m){ return m.empresa_id === u.empresa_id; });
  var matchesYaLigados = {};
  matchesActuales.forEach(function(m){ matchesYaLigados[m.clave_sr12] = m; });

  // 4. ACUMULAR cambios en memoria. NO escribir todavía — todas las escrituras van al final
  //    en batch (1 llamada grande por hoja en vez de ~2,300 individuales). v138.
  var sheetDet = asegurarHoja('ImportacionDetalleSR12',
    ['id','importacion_id','clave_sr12','nombre_sr12','accion','costo_anterior','costo_nuevo','variacion_pct','existencia_total','ingrediente_fogueira_id','tipo_match','recetas_afectadas']);

  // Para conteo de recetas afectadas (cuántas recetas usan cada ingrediente Fogueira)
  var lineasReceta = rowsToObjects(getSheet('IngredientesReceta'));
  var recetasPorIngrediente = {};
  lineasReceta.forEach(function(l){
    if (l.ingrediente_id) {
      recetasPorIngrediente[l.ingrediente_id] = (recetasPorIngrediente[l.ingrediente_id] || 0) + 1;
    }
  });

  // Acumuladores
  var sr12NuevosFilas = [];          // appendRows IngredientesSR12 (productos nuevos)
  var sr12UpdatesPorRow = {};        // row → array de 22 valores (productos ya existentes)
  var ingNuevasFilas = [];           // appendRows Ingredientes (auto-creados)
  var ingCostoUpdates = [];          // [{row, costo, poblarClave, clave}]
  var ingUnidadUpdates = [];         // [{row, unidad_base}] — corrección de unidad (SR12 manda)
  var matchNuevasFilas = [];         // appendRows IngredientesSR12Match
  var detalleNuevasFilas = [];       // appendRows ImportacionDetalleSR12

  dryRun.detalles.forEach(function(d) {
    // 4.a — Upsert en IngredientesSR12 (acumular, no escribir)
    var ya = sr12PorClave[d.clave_sr12];
    if (ya) {
      // Reescribimos la fila entera preservando solo creado_at e impuesto_pct previos.
      sr12UpdatesPorRow[ya._row] = [
        d.clave_sr12, u.empresa_id, d.nombre_sr12, d.familia_sr12,
        d.presentacion_descripcion, d.unidad_base, d.factor_a_base,
        d.costo_total_sr12, d.costo_por_base_sr12,
        ya.impuesto_pct || 0,
        d.existencia_almacen, d.existencia_barra, d.existencia_cava,
        d.existencia_churrasca, d.existencia_cocina, d.existencia_piso,
        d.existencia_total, d.saldo_total, d.parser_unidad_ok,
        ya.creado_at || ahora, ahora, importacionId
      ];
    } else {
      sr12NuevosFilas.push([
        d.clave_sr12, u.empresa_id, d.nombre_sr12, d.familia_sr12,
        d.presentacion_descripcion, d.unidad_base, d.factor_a_base,
        d.costo_total_sr12, d.costo_por_base_sr12, 0,
        d.existencia_almacen, d.existencia_barra, d.existencia_cava,
        d.existencia_churrasca, d.existencia_cocina, d.existencia_piso,
        d.existencia_total, d.saldo_total, d.parser_unidad_ok,
        ahora, ahora, importacionId
      ]);
    }

    // 4.b — Si NO había match, crear nuevo Ingrediente Fogueira (acumular)
    var ingFogId = d.ingrediente_fogueira_id;
    if (!ingFogId && d.tipo_match === 'sin_match') {
      ingFogId = uuid();
      ingNuevasFilas.push([
        ingFogId, u.empresa_id, d.nombre_sr12, d.nombre_sr12, d.familia_sr12,
        '', false, false, true,
        d.unidad_base || 'pza',
        d.costo_por_base_sr12, d.costo_por_base_sr12, false,
        'sr12', 0, 0, 0, 0, 1, 'sr12', d.costo_por_base_sr12,
        true, ahora, u.email, ahora, u.email,
        d.clave_sr12
      ]);
      matchNuevasFilas.push([
        uuid(), u.empresa_id, d.clave_sr12, ingFogId,
        'auto_creado', 1, u.email, ahora
      ]);
    } else if (ingFogId && !matchesYaLigados[d.clave_sr12] && d.tipo_match !== 'sin_match' && d.tipo_match !== 'nombre_similar') {
      matchNuevasFilas.push([
        uuid(), u.empresa_id, d.clave_sr12, ingFogId,
        d.tipo_match, d.score_match || 1, u.email, ahora
      ]);
    }

    // 4.c + 4.c-bis (FIX v400) — UNIDAD y PRECIO deben moverse SIEMPRE juntos. El SR12 manda y
    // `costo_por_base_sr12` ya viene EN la unidad `d.unidad_base`. Antes la unidad se corregía
    // (kg→g) aunque el costo fuera 'sin_cambio', pero el precio NO se re-derivaba → el costo por-kilo
    // quedaba leído por-gramo → ×1000 (reventó ~100 recetas el 2026-06-15). Ahora: si va a cambiar
    // la unidad O el costo, re-derivamos el precio desde el SR12; y la unidad SOLO cambia si hay un
    // costo válido (>0) con el cual quede consistente (nunca la unidad sola).
    var ingFog = ingFogId ? ingredientesPorId[ingFogId] : null;
    var _unidadCambia = !!(ingFog && d.parser_unidad_ok && d.unidad_base &&
                           String(ingFog.unidad_base || '') !== String(d.unidad_base));
    var _costoCambia  = (d.accion === 'actualizado_costo' || d.accion === 'nuevo_sr12');
    if (ingFog && (_costoCambia || _unidadCambia) && d.costo_por_base_sr12 > 0) {
      // v322 — precio_real_unitario con la MISMA fórmula que el botón manual (handleIngredienteUpdate):
      // costo × max(1 + merma_pct/100, factor_rendimiento). Así el costo del SR12 llega al costeo de recetas.
      var _merma = Number(ingFog.merma_pct) || 0;
      var _fr = Number(ingFog.factor_rendimiento) || 1;
      var _factorRend = Math.max(1 + _merma / 100, _fr);
      var _pru = Number((d.costo_por_base_sr12 * _factorRend).toFixed(4));
      ingCostoUpdates.push({
        row: ingFog._row,
        costo: d.costo_por_base_sr12,
        pru: _pru,
        poblarClave: !ingFog.clave_sr12 && colClaveSr12 > 0,
        clave: d.clave_sr12
      });
    }
    if (_unidadCambia && d.costo_por_base_sr12 > 0) {
      ingUnidadUpdates.push({ row: ingFog._row, unidad_base: d.unidad_base });
    }

    // 4.d — Acumular detalle
    detalleNuevasFilas.push([
      uuid(), importacionId, d.clave_sr12, d.nombre_sr12, d.accion,
      d.costo_anterior_base, d.costo_por_base_sr12, d.variacion_pct,
      d.existencia_total, ingFogId || '', d.tipo_match,
      ingFogId ? (recetasPorIngrediente[ingFogId] || 0) : 0
    ]);
  });

  // 5. ESCRITURAS BATCH — minimiza llamadas a la API de Sheets
  var ncolsSR12 = 22, ncolsIng = 27, ncolsMatch = 8, ncolsDet = 12;

  // 5.a — Updates IngredientesSR12: leemos todo el rango, mergeamos en memoria, escribimos 1 vez
  var rowsUpdateSR12 = Object.keys(sr12UpdatesPorRow);
  if (rowsUpdateSR12.length) {
    var lastRowSR12 = sheetSR12.getLastRow();
    if (lastRowSR12 >= 2) {
      var rangoSR12 = sheetSR12.getRange(2, 1, lastRowSR12 - 1, ncolsSR12);
      var valoresSR12 = rangoSR12.getValues();
      rowsUpdateSR12.forEach(function(rowNum) {
        valoresSR12[parseInt(rowNum) - 2] = sr12UpdatesPorRow[rowNum];
      });
      rangoSR12.setValues(valoresSR12);
    }
  }
  // 5.b — Appends IngredientesSR12 (nuevos)
  if (sr12NuevosFilas.length) {
    sheetSR12.getRange(sheetSR12.getLastRow() + 1, 1, sr12NuevosFilas.length, ncolsSR12).setValues(sr12NuevosFilas);
  }

  // 5.c — Updates de costos en Ingredientes (filas existentes): mismo patrón merge-in-memory
  if (ingCostoUpdates.length) {
    var lastRowIng = sheetIng.getLastRow();
    // Bloque 1: cols 11-14 (ultimo_costo, costo_promedio, estimado, precio_origen)
    var rangoCostos = sheetIng.getRange(2, 11, lastRowIng - 1, 4);
    var valoresCostos = rangoCostos.getValues();
    // Bloque 2: cols 25-26 (actualizado_at, actualizado_por)
    var rangoActual = sheetIng.getRange(2, 25, lastRowIng - 1, 2);
    var valoresActual = rangoActual.getValues();
    // Bloque 3: col clave_sr12 (si corresponde)
    var rangoClave = null, valoresClave = null;
    if (colClaveSr12 > 0) {
      rangoClave = sheetIng.getRange(2, colClaveSr12, lastRowIng - 1, 1);
      valoresClave = rangoClave.getValues();
    }
    // Bloque 4: col precio_real_unitario (v322) — el costo que usan las recetas
    var rangoPru = null, valoresPru = null;
    if (colPru > 0) {
      rangoPru = sheetIng.getRange(2, colPru, lastRowIng - 1, 1);
      valoresPru = rangoPru.getValues();
    }
    ingCostoUpdates.forEach(function(upd) {
      var idx = upd.row - 2;
      valoresCostos[idx] = [upd.costo, upd.costo, false, 'sr12'];
      valoresActual[idx] = [ahora, u.email];
      if (upd.poblarClave && valoresClave) valoresClave[idx] = [upd.clave];
      if (valoresPru && upd.pru > 0) valoresPru[idx] = [upd.pru];
    });
    rangoCostos.setValues(valoresCostos);
    rangoActual.setValues(valoresActual);
    if (rangoClave) rangoClave.setValues(valoresClave);
    if (rangoPru) rangoPru.setValues(valoresPru);
  }
  // 5.c-bis — Corrección de UNIDAD (col 10), independiente del costo (el SR12 manda).
  if (ingUnidadUpdates.length) {
    var lastRowU = sheetIng.getLastRow();
    var rangoUnidad = sheetIng.getRange(2, 10, lastRowU - 1, 1);
    var valoresUnidad = rangoUnidad.getValues();
    ingUnidadUpdates.forEach(function(upd) {
      var idx = upd.row - 2;
      if (idx >= 0 && idx < valoresUnidad.length) valoresUnidad[idx] = [upd.unidad_base];
    });
    rangoUnidad.setValues(valoresUnidad);
  }
  // 5.d — Appends Ingredientes (nuevos del SR12)
  if (ingNuevasFilas.length) {
    sheetIng.getRange(sheetIng.getLastRow() + 1, 1, ingNuevasFilas.length, ncolsIng).setValues(ingNuevasFilas);
  }

  // 5.e — Appends Match
  if (matchNuevasFilas.length) {
    sheetMatch.getRange(sheetMatch.getLastRow() + 1, 1, matchNuevasFilas.length, ncolsMatch).setValues(matchNuevasFilas);
  }
  // 5.f — Appends Detalle
  if (detalleNuevasFilas.length) {
    sheetDet.getRange(sheetDet.getLastRow() + 1, 1, detalleNuevasFilas.length, ncolsDet).setValues(detalleNuevasFilas);
  }

  return {
    ok: true,
    importacion_id: importacionId,
    resumen: resumen
  };
}

// =====================================================================================
// HANDLERS AUXILIARES (list, get, revertir, huerfanos)
// =====================================================================================
function handleSr12ImportacionesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };
  var sheet = asegurarHoja('ImportacionesSR12',
    ['id','empresa_id','usuario_email','usuario_nombre','subido_at','aplicado_at','estatus','archivos_count','archivos_nombres','total_productos_archivos','productos_filtrados_familia','nuevos_creados','actualizados','sin_cambio','divergencias_grandes','huerfanos_fogueira','parser_fallos','notas','familias_activas_csv']);
  var filas = rowsToObjects(sheet).filter(function(f){ return f.empresa_id === u.empresa_id; });
  filas.sort(function(a,b){
    var ta = a.subido_at instanceof Date ? a.subido_at.getTime() : new Date(a.subido_at).getTime();
    var tb = b.subido_at instanceof Date ? b.subido_at.getTime() : new Date(b.subido_at).getTime();
    return tb - ta;
  });
  return { ok:true, importaciones: filas.map(function(f){
    return {
      id: f.id, usuario_email: f.usuario_email, usuario_nombre: f.usuario_nombre,
      subido_at: f.subido_at instanceof Date ? f.subido_at.toISOString() : (f.subido_at || ''),
      aplicado_at: f.aplicado_at instanceof Date ? f.aplicado_at.toISOString() : (f.aplicado_at || ''),
      estatus: f.estatus, archivos_count: f.archivos_count,
      archivos_nombres: f.archivos_nombres,
      total_productos_archivos: f.total_productos_archivos,
      productos_filtrados_familia: f.productos_filtrados_familia,
      nuevos_creados: f.nuevos_creados, actualizados: f.actualizados,
      sin_cambio: f.sin_cambio, divergencias_grandes: f.divergencias_grandes,
      huerfanos_fogueira: f.huerfanos_fogueira, parser_fallos: f.parser_fallos
    };
  })};
}

function handleSr12HuerfanosFogueira(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };
  var ingredientesFog = rowsToObjects(getSheet('Ingredientes')).filter(function(x){
    // Solo descartamos si está EXPLÍCITAMENTE marcado como inactivo. Históricamente la columna
    // 'activo' no se carga al crear ingredientes desde recetario (queda vacía y funciona OK
    // en recetas/charolas porque NO filtran por activo). Aplicamos el mismo criterio aquí.
    if (x.empresa_id !== u.empresa_id) return false;
    if (x.activo === false) return false;
    var av = String(x.activo).trim().toLowerCase();
    if (av === 'false' || av === '0' || av === 'no') return false;
    return true;
  });
  var matches = rowsToObjects(asegurarHoja('IngredientesSR12Match',
    ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at']));
  var ligados = {};
  matches.forEach(function(m){ if (m.empresa_id === u.empresa_id) ligados[m.ingrediente_id_fogueira] = true; });
  var lineas = rowsToObjects(getSheet('IngredientesReceta'));
  var recetasPorIng = {};
  lineas.forEach(function(l){ if (l.ingrediente_id) recetasPorIng[l.ingrediente_id] = (recetasPorIng[l.ingrediente_id] || 0) + 1; });
  var ahora = new Date();
  var huerfanos = ingredientesFog.filter(function(x){ return !ligados[x.id]; }).map(function(x){
    var creadoAt = x.creado_at ? new Date(x.creado_at) : null;
    var diasSinVincular = creadoAt ? Math.floor((ahora - creadoAt) / 86400000) : null;
    return {
      id: x.id, nombre: x.nombre, categoria: x.categoria,
      ultimo_costo: x.ultimo_costo, ultimo_costo_estimado: x.ultimo_costo_estimado,
      dato_incompleto: x.dato_incompleto,
      recetas_que_lo_usan: recetasPorIng[x.id] || 0,
      creado_at: x.creado_at ? String(x.creado_at).slice(0,10) : '',
      dias_sin_vincular: diasSinVincular
    };
  });
  huerfanos.sort(function(a,b){ return (b.recetas_que_lo_usan || 0) - (a.recetas_que_lo_usan || 0); });
  return { ok:true, huerfanos: huerfanos };
}

// =====================================================================================
// SUGERIDOR DE VÍNCULOS (v321)
// =====================================================================================
// Para cada ingrediente "huérfano" (Fogueira sin clave SR12), busca en el catálogo espejo
// IngredientesSR12 los productos POS cuyo nombre se parece más, y los devuelve como
// candidatos ordenados por confianza. El humano solo CONFIRMA ("Es") o DESCARTA ("No aplica").
//   - Confirmar  → reusa handleSr12IngredienteVincular (crea el match) → deja de ser huérfano.
//   - Descartar  → handleSr12SugerenciaDescartar (hoja SugerenciasSR12Descartadas) → no reaparece.
// Reusa los mismos helpers de parecido que el matcher del import (anchor + containment + typos).
function handleSr12SugerirVinculos(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','comprador','auditoria'])) return { ok:false, error:'Sin permisos' };

  // 1) Ingredientes Fogueira activos de la empresa (mismo criterio que huérfanos)
  var ingredientesFog = rowsToObjects(getSheet('Ingredientes')).filter(function(x){
    if (x.empresa_id !== u.empresa_id) return false;
    if (x.activo === false) return false;
    var av = String(x.activo).trim().toLowerCase();
    if (av === 'false' || av === '0' || av === 'no') return false;
    return true;
  });

  // 2) Qué ingredientes YA están ligados (tabla puente + clave directa) y qué claves SR12 ya se usan
  var matches = rowsToObjects(asegurarHoja('IngredientesSR12Match',
    ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at']));
  var ligados = {}, claveUsadaPor = {};
  matches.forEach(function(m){
    if (m.empresa_id !== u.empresa_id) return;
    ligados[m.ingrediente_id_fogueira] = true;
    claveUsadaPor[String(m.clave_sr12)] = m.ingrediente_id_fogueira;
  });
  ingredientesFog.forEach(function(x){
    if (x.clave_sr12) { ligados[x.id] = true; claveUsadaPor[String(x.clave_sr12)] = x.id; }
  });

  // 3) Descartados ("no aplica" — no reaparecen)
  var shDesc = asegurarHoja('SugerenciasSR12Descartadas',
    ['id','empresa_id','ingrediente_id','descartado_por_email','descartado_at']);
  var descartados = {};
  rowsToObjects(shDesc).forEach(function(d){ if (d.empresa_id === u.empresa_id) descartados[String(d.ingrediente_id)] = true; });

  // 4) Catálogo SR12 espejo (todos los productos POS de la empresa)
  var shSr12 = SpreadsheetApp.getActive().getSheetByName('IngredientesSR12');
  if (!shSr12) {
    return { ok:true, total_huerfanos:0, con_sugerencia:[], sin_candidato:[], descartados_count:0,
             mensaje:'El catálogo SR12 todavía no está cargado. Sube primero un reporte de Existencias.' };
  }
  var catalogo = rowsToObjects(shSr12).filter(function(s){ return s.empresa_id === u.empresa_id; });
  // Precalcular tokens de cada producto SR12 una sola vez (nombre limpio sin presentación)
  var cat = [];
  catalogo.forEach(function(s){
    var limpio = sr12LimpiarPresentacion(s.nombre_sr12);
    var tokens = sr12Tokenizar(sr12NormalizarNombre(limpio));
    if (!tokens.length) return;
    cat.push({
      clave: String(s.clave_sr12), nombre_sr12: String(s.nombre_sr12 || ''),
      familia: String(s.familia_sr12 || ''), unidad_base: String(s.unidad_base || ''),
      existencia_total: Number(s.existencia_total) || 0, tokens: tokens
    });
  });

  // 5) Cuántas recetas usan cada ingrediente (para priorizar lo importante arriba)
  var lineas = rowsToObjects(getSheet('IngredientesReceta'));
  var recetasPorIng = {};
  lineas.forEach(function(l){ if (l.ingrediente_id) recetasPorIng[l.ingrediente_id] = (recetasPorIng[l.ingrediente_id] || 0) + 1; });

  // 6) Para cada huérfano: armar candidatos
  var conSugerencia = [], sinCandidato = [], descCount = 0;
  ingredientesFog.forEach(function(ing){
    if (ligados[ing.id]) return;
    if (descartados[ing.id]) { descCount++; return; }

    // tokens del nombre + aliases (unión)
    var nombres = [ing.nombre];
    if (ing.aliases) String(ing.aliases).split(/[,;\n]/).forEach(function(a){ var t=a.trim(); if (t) nombres.push(t); });
    var fogTokens = [];
    nombres.forEach(function(nm){
      sr12Tokenizar(sr12NormalizarNombre(nm)).forEach(function(t){ if (fogTokens.indexOf(t) === -1) fogTokens.push(t); });
    });

    var item = {
      id: ing.id, nombre: String(ing.nombre || ''), categoria: String(ing.categoria || ''),
      recetas_que_lo_usan: recetasPorIng[ing.id] || 0, candidatos: []
    };
    if (!fogTokens.length) { sinCandidato.push(item); return; }

    // "anchor" = 1ra palabra significativa del nombre principal
    var anchor = (sr12Tokenizar(sr12NormalizarNombre(ing.nombre))[0]) || fogTokens[0];

    var cands = [];
    for (var k = 0; k < cat.length; k++) {
      var c = cat[k];
      // anchor suave: la 1ra palabra del ingrediente debe aparecer (igual o con 1 typo) en el SR12
      var tieneAnchor = false;
      for (var z = 0; z < c.tokens.length; z++) {
        if (sr12TokensSimilares(c.tokens[z], anchor)) { tieneAnchor = true; break; }
      }
      if (!tieneAnchor) continue;
      var scoreA = sr12ContainmentScore(fogTokens, c.tokens);  // ¿cuánto del nombre Fog está en el SR12?
      if (scoreA < 0.5) continue;
      var scoreB = sr12ContainmentScore(c.tokens, fogTokens);  // ¿cuánto del SR12 está en el Fog? (penaliza ruido)
      var combinado = scoreA * 0.7 + scoreB * 0.3;
      cands.push({
        clave: c.clave, nombre_sr12: c.nombre_sr12, familia: c.familia, unidad_base: c.unidad_base,
        existencia_total: c.existencia_total, score: combinado,
        ya_usada_por_otro: !!(claveUsadaPor[c.clave] && claveUsadaPor[c.clave] !== ing.id)
      });
    }
    cands.sort(function(a,b){ return (b.score - a.score) || (a.nombre_sr12.length - b.nombre_sr12.length); });
    item.candidatos = cands.slice(0, 3).map(function(c){
      return {
        clave: c.clave, nombre_sr12: c.nombre_sr12, familia: c.familia, unidad_base: c.unidad_base,
        existencia_total: c.existencia_total, score: Math.round(c.score * 100),
        confianza: c.score >= 0.85 ? 'alta' : (c.score >= 0.65 ? 'media' : 'baja'),
        ya_usada_por_otro: c.ya_usada_por_otro
      };
    });
    if (item.candidatos.length) conSugerencia.push(item); else sinCandidato.push(item);
  });

  // Orden: primero los que se usan en más recetas, luego por confianza del mejor candidato
  conSugerencia.sort(function(a,b){
    var ra = (b.recetas_que_lo_usan || 0) - (a.recetas_que_lo_usan || 0); if (ra) return ra;
    return (b.candidatos[0].score || 0) - (a.candidatos[0].score || 0);
  });
  sinCandidato.sort(function(a,b){ return (b.recetas_que_lo_usan || 0) - (a.recetas_que_lo_usan || 0); });

  return {
    ok: true,
    total_huerfanos: conSugerencia.length + sinCandidato.length,
    catalogo_count: cat.length,
    descartados_count: descCount,
    con_sugerencia: conSugerencia,
    sin_candidato: sinCandidato
  };
}

// Marca (o quita) un ingrediente huérfano como "no aplica" (no existe en el SR12) para que el
// sugeridor deje de mostrarlo. data.deshacer = true lo quita de la lista de descartados.
function handleSr12SugerenciaDescartar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','comprador','auditoria'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var ingId = String(data.ingrediente_id || '').trim();
  if (!ingId) return { ok:false, error:'ingrediente_id requerido' };
  var deshacer = data.deshacer === true || String(data.deshacer) === 'true';

  var headers = ['id','empresa_id','ingrediente_id','descartado_por_email','descartado_at'];
  var sh = asegurarHoja('SugerenciasSR12Descartadas', headers);
  var lastRow = sh.getLastRow();
  var existingRow = -1;
  if (lastRow > 1) {
    var datos = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][2]) === ingId && datos[i][1] === u.empresa_id) { existingRow = i + 2; break; }
    }
  }
  if (deshacer) {
    if (existingRow > 0) sh.deleteRow(existingRow);
    return { ok:true, descartado:false, ingrediente_id:ingId };
  }
  if (existingRow > 0) return { ok:true, descartado:true, ingrediente_id:ingId, ya:true };
  sh.appendRow([Utilities.getUuid(), u.empresa_id, ingId, u.email, new Date()]);
  return { ok:true, descartado:true, ingrediente_id:ingId };
}

// Vincula de un jalón TODOS los huérfanos cuyo mejor candidato es de "alta confianza" (≥85%) y
// cuya clave SR12 no está usada por otro ingrediente. El humano solo revisa después las dudosas.
// Reusa handleSr12SugerirVinculos para no duplicar la lógica de parecido. MUTATING. Reversible
// (desvincular manual). v328.
function handleSr12VincularAltaConfianza(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','comprador','auditoria'])) return { ok:false, error:'Sin permisos' };

  var sug = handleSr12SugerirVinculos({ token: p.token });
  if (!sug.ok) return sug;

  // Elegibles: top candidato alta confianza, no usado por otro, y sin repetir clave dentro del lote.
  var aLigar = [], claveBatch = {};
  (sug.con_sugerencia || []).forEach(function(it){
    var c = it.candidatos && it.candidatos[0];
    // v416 — el AUTO-lote exige score ≥ 90. El tramo 85 ('alta' por similitud de tokens) produce
    // FALSOS POSITIVOS peligrosos (Jamón→Jabón, Cerveza→Cereza, Canela→Té, Ejote→Elote) → se deja
    // para revisión MANUAL en el sugeridor (ahí el humano confirma). No tocar el display, solo el auto-link.
    if (!c || c.confianza !== 'alta' || (Number(c.score) || 0) < 90 || c.ya_usada_por_otro) return;
    if (claveBatch[c.clave]) return; // dos huérfanos al mismo SR12 → dejar para revisión manual
    claveBatch[c.clave] = true;
    aLigar.push({ ingrediente_id: it.id, clave_sr12: c.clave, nombre: it.nombre, nombre_sr12: c.nombre_sr12 });
  });
  if (!aLigar.length) return { ok:true, vinculados:0, detalle:[] };

  // Upsert en lote en IngredientesSR12Match
  var headers = ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at'];
  var shMatch = asegurarHoja('IngredientesSR12Match', headers);
  var lastRow = shMatch.getLastRow();
  var existingRowDe = {};
  if (lastRow > 1) {
    var datos = shMatch.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var i = 0; i < datos.length; i++) { if (datos[i][1] === u.empresa_id) existingRowDe[String(datos[i][3])] = { row: i + 2, id: datos[i][0] }; }
  }
  var now = new Date();
  var nuevos = [];
  aLigar.forEach(function(x){
    var ex = existingRowDe[x.ingrediente_id];
    var fila = [ ex ? ex.id : Utilities.getUuid(), u.empresa_id, x.clave_sr12, x.ingrediente_id, 'auto_alta', 0.9, u.email, now ];
    if (ex) shMatch.getRange(ex.row, 1, 1, headers.length).setValues([fila]);
    else nuevos.push(fila);
  });
  if (nuevos.length) shMatch.getRange(shMatch.getLastRow() + 1, 1, nuevos.length, headers.length).setValues(nuevos);

  return { ok:true, vinculados: aLigar.length, detalle: aLigar.slice(0, 300) };
}

// =====================================================================================
// CUADRE DE BARRA (tubería) — enlace receta de bebida → producto de venta del SR12 — v332
// Esto es lo que faltaba para Vista B (detector de fuga): saber qué receta corresponde a cada
// producto vendido en el POS, para luego comparar teórico (ventas × receta) vs real (inventario).
// =====================================================================================
// Lista de productos vendidos (distintos) del SR12 — para el selector al enlazar una receta.
function handleSr12VentasProductos(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria','barman','comprador'])) return { ok:false, error:'Sin permisos' };
  var sh = getSheet('VentasSR12');
  if (!sh) return { ok:true, productos: [], nota:'Aún no hay ventas SR12 importadas.' };
  var byClave = {};
  rowsToObjects(sh).forEach(function(r){
    if (r.empresa_id !== u.empresa_id) return;
    var clave = String(r.clave || '').trim();
    if (!clave || byClave[clave]) return;
    byClave[clave] = { clave: clave, descripcion: String(r.descripcion || ''), grupo: String(r.grupo || '') };
  });
  var productos = Object.keys(byClave).map(function(k){ return byClave[k]; });
  productos.sort(function(a,b){ return String(a.descripcion).localeCompare(String(b.descripcion)); });
  return { ok:true, productos: productos };
}

// Enlaza (o quita) el producto de venta del SR12 a una receta. Escribe Recetas.clave_venta_sr12.
function handleRecetaVincularVenta(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria','barman'])) return { ok:false, error:'Tu rol no puede enlazar productos de venta' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var recetaId = String(data.receta_id || '').trim();
  var claveVenta = String(data.clave_venta_sr12 || '').trim();
  if (!recetaId) return { ok:false, error:'receta_id requerido' };

  var sh = getSheet('Recetas');
  var receta = rowsToObjects(sh).find(function(r){ return String(r.id) === recetaId && r.empresa_id === u.empresa_id; });
  if (!receta) return { ok:false, error:'Receta no encontrada' };

  var desc = '';
  if (claveVenta) {
    var shV = getSheet('VentasSR12');
    var prod = shV ? rowsToObjects(shV).find(function(v){ return String(v.clave) === claveVenta && v.empresa_id === u.empresa_id; }) : null;
    if (!prod) return { ok:false, error:'La clave de venta ' + claveVenta + ' no existe en Ventas SR12' };
    desc = String(prod.descripcion || '');
  }
  var col = _getOrCreateCol(sh, 'clave_venta_sr12');
  sh.getRange(receta._row, col).setValue(claveVenta);
  return { ok:true, receta_id: recetaId, clave_venta_sr12: claveVenta, descripcion: desc };
}

// Lista detalle de una importación específica (para el modal de auditoría).
function handleSr12ImportacionGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };
  var importacion_id = String(p.importacion_id || '');
  if (!importacion_id) return { ok:false, error:'importacion_id requerido' };
  var sheetImp = asegurarHoja('ImportacionesSR12',
    ['id','empresa_id','usuario_email','usuario_nombre','subido_at','aplicado_at','estatus','archivos_count','archivos_nombres','total_productos_archivos','productos_filtrados_familia','nuevos_creados','actualizados','sin_cambio','divergencias_grandes','huerfanos_fogueira','parser_fallos','notas','familias_activas_csv']);
  var imp = rowsToObjects(sheetImp).find(function(f){ return f.id === importacion_id && f.empresa_id === u.empresa_id; });
  if (!imp) return { ok:false, error:'Importación no encontrada' };
  var sheetDet = asegurarHoja('ImportacionDetalleSR12',
    ['id','importacion_id','clave_sr12','nombre_sr12','accion','costo_anterior','costo_nuevo','variacion_pct','existencia_total','ingrediente_fogueira_id','tipo_match','recetas_afectadas']);
  var detalles = rowsToObjects(sheetDet).filter(function(d){ return d.importacion_id === importacion_id; });
  return { ok:true, importacion: imp, detalles: detalles };
}

// Revierte la ÚLTIMA importación aplicada. Si la quieres revertir y hay otras posteriores,
// debes revertirlas primero en orden inverso (patrón undo-stack).
// Restaura costos en Ingredientes Fogueira al `costo_anterior` de cada detalle.
// Marca la importación como 'revertida'.
// NO borra IngredientesSR12 ni los matches (datos de catálogo persisten); solo retrocede precios.
// v139 — Reversa COMPLETA (rewrite). La versión anterior solo funcionaba si había un costo
// previo en IngredientesSR12 (segunda importación en adelante). Esta versión:
//   1) Vacía cols 11-14 (ultimo_costo, costo_promedio, ultimo_costo_estimado, precio_origen) y la col
//      clave_sr12 de los ingredientes Fogueira PREEXISTENTES que fueron matcheados (cols que YO escribí).
//      Esto los devuelve a su estado original (los datos viejos en otras cols quedan intactos).
//   2) Borra los ingredientes Fogueira AUTO-CREADOS (los 142 nuevos del import).
//   3) Borra las filas de IngredientesSR12 (catálogo espejo) de la empresa.
//   4) Borra las filas de IngredientesSR12Match de la empresa.
//   5) Marca la importación como 'revertida'.
// Usa deleteRows en bloques para evitar timeout (en vez de N llamadas individuales).
function handleSr12ImportacionRevertir(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin o gerente_administrativo pueden revertir' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var importacion_id = String(data.importacion_id || '');
  if (!importacion_id) return { ok:false, error:'importacion_id requerido' };

  var sheetImp = asegurarHoja('ImportacionesSR12',
    ['id','empresa_id','usuario_email','usuario_nombre','subido_at','aplicado_at','estatus','archivos_count','archivos_nombres','total_productos_archivos','productos_filtrados_familia','nuevos_creados','actualizados','sin_cambio','divergencias_grandes','huerfanos_fogueira','parser_fallos','notas','familias_activas_csv']);
  var imps = rowsToObjects(sheetImp).filter(function(f){ return f.empresa_id === u.empresa_id; });
  imps.sort(function(a,b){
    var ta = a.aplicado_at instanceof Date ? a.aplicado_at.getTime() : new Date(a.aplicado_at).getTime();
    var tb = b.aplicado_at instanceof Date ? b.aplicado_at.getTime() : new Date(b.aplicado_at).getTime();
    return tb - ta;
  });
  var ultimaAplicada = imps.find(function(f){ return f.estatus === 'aplicada'; });
  if (!ultimaAplicada || ultimaAplicada.id !== importacion_id) {
    return { ok:false, error:'Solo se puede revertir la última importación aplicada. Primero revierte las posteriores en orden inverso.' };
  }
  var imp = ultimaAplicada;

  var sheetDet = asegurarHoja('ImportacionDetalleSR12',
    ['id','importacion_id','clave_sr12','nombre_sr12','accion','costo_anterior','costo_nuevo','variacion_pct','existencia_total','ingrediente_fogueira_id','tipo_match','recetas_afectadas']);
  var detalles = rowsToObjects(sheetDet).filter(function(d){ return d.importacion_id === importacion_id; });

  // Cargar Ingredientes Fog y detectar col clave_sr12
  var sheetIng = getSheet('Ingredientes');
  var ingHeaders = sheetIng.getRange(1, 1, 1, sheetIng.getLastColumn()).getValues()[0];
  var colClaveSr12 = -1;
  for (var ih = 0; ih < ingHeaders.length; ih++) {
    if (String(ingHeaders[ih]) === 'clave_sr12') { colClaveSr12 = ih + 1; break; }
  }
  var ingredientesFog = rowsToObjects(sheetIng).filter(function(x){ return x.empresa_id === u.empresa_id; });
  var ingPorId = {};
  ingredientesFog.forEach(function(x){ ingPorId[x.id] = x; });
  var ahora = new Date();

  // 1) Clasificar detalles: ¿el ingrediente Fog fue auto-creado (borrar) o matcheado (vaciar)?
  var rowsAVaciar = [];   // _row de Fog matcheados con preexistentes
  var rowsABorrarIng = []; // _row de Fog auto-creados
  detalles.forEach(function(d) {
    var ingId = d.ingrediente_fogueira_id;
    if (!ingId) return;
    var ing = ingPorId[ingId];
    if (!ing) return;
    if (d.tipo_match === 'sin_match') {
      rowsABorrarIng.push(ing._row);
    } else {
      rowsAVaciar.push(ing._row);
    }
  });

  // 2) Vaciar cols 11-14 y 27 (clave_sr12) de los matcheados — usando batch con merge-in-memory
  if (rowsAVaciar.length) {
    var lastRowIng = sheetIng.getLastRow();
    // Cols 11-14
    var rangoCostos = sheetIng.getRange(2, 11, lastRowIng - 1, 4);
    var valoresCostos = rangoCostos.getValues();
    var rangoActual = sheetIng.getRange(2, 25, lastRowIng - 1, 2);
    var valoresActual = rangoActual.getValues();
    var rangoClave = null, valoresClave = null;
    if (colClaveSr12 > 0) {
      rangoClave = sheetIng.getRange(2, colClaveSr12, lastRowIng - 1, 1);
      valoresClave = rangoClave.getValues();
    }
    rowsAVaciar.forEach(function(rowNum) {
      var idx = rowNum - 2;
      if (idx < 0 || idx >= valoresCostos.length) return;
      valoresCostos[idx] = ['', '', '', ''];
      valoresActual[idx] = [ahora, u.email + ' (revert)'];
      if (valoresClave) valoresClave[idx] = [''];
    });
    rangoCostos.setValues(valoresCostos);
    rangoActual.setValues(valoresActual);
    if (rangoClave) rangoClave.setValues(valoresClave);
  }

  // 3) Borrar filas de Ingredientes auto-creados (de mayor a menor row para preservar índices)
  rowsABorrarIng.sort(function(a,b){ return b - a; });
  // Optimización: si las rows son contiguas, una sola llamada deleteRows. Si no, una por bloque contiguo.
  var bloquesIng = agruparContiguos(rowsABorrarIng);
  bloquesIng.forEach(function(b){ sheetIng.deleteRows(b.start, b.count); });

  // 4) Borrar filas de IngredientesSR12 de la empresa (todas las que pertenecen a este import).
  //    En la primera importación, son TODAS las filas con esta empresa_id.
  var sheetSR12 = asegurarHoja('IngredientesSR12',
    ['clave_sr12','empresa_id','nombre_sr12','familia_sr12','presentacion_descripcion','unidad_base','factor_a_base','costo_total_sr12','costo_por_base_sr12','impuesto_pct','existencia_almacen','existencia_barra','existencia_cava','existencia_churrasca','existencia_cocina','existencia_piso','existencia_total','saldo_total','parser_unidad_ok','creado_at','actualizado_at','ultima_importacion_id']);
  var sr12Rows = rowsToObjects(sheetSR12)
    .filter(function(s){ return s.empresa_id === u.empresa_id && s.ultima_importacion_id === importacion_id; })
    .map(function(s){ return s._row; })
    .sort(function(a,b){ return b - a; });
  var bloquesSR12 = agruparContiguos(sr12Rows);
  bloquesSR12.forEach(function(b){ sheetSR12.deleteRows(b.start, b.count); });

  // 5) Borrar filas de IngredientesSR12Match (por clave_sr12 presente en los detalles de este import)
  var clavesImport = {};
  detalles.forEach(function(d){ clavesImport[String(d.clave_sr12)] = true; });
  var sheetMatch = asegurarHoja('IngredientesSR12Match',
    ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at']);
  var matchRows = rowsToObjects(sheetMatch)
    .filter(function(m){ return m.empresa_id === u.empresa_id && clavesImport[String(m.clave_sr12)]; })
    .map(function(m){ return m._row; })
    .sort(function(a,b){ return b - a; });
  var bloquesMatch = agruparContiguos(matchRows);
  bloquesMatch.forEach(function(b){ sheetMatch.deleteRows(b.start, b.count); });

  // 6) Marcar importación como revertida (la dejamos en histórico, no la borramos)
  sheetImp.getRange(imp._row, 7).setValue('revertida');

  return {
    ok: true,
    importacion_id: importacion_id,
    ingredientes_vaciados: rowsAVaciar.length,
    ingredientes_borrados: rowsABorrarIng.length,
    sr12_borrados: sr12Rows.length,
    matches_borrados: matchRows.length
  };
}

// v140 — Rescate de precios legacy. Bug histórico: el bootstrap inicial cargó datos con un
// schema viejo de 20 cols. Después se agregaron 6 columnas al schema (aliases, costo_promedio,
// mermas, factor_rendimiento*, precio_real_unitario) pero los DATOS no se migraron — quedaron
// en sus columnas originales. Resultado: el campo `precio_real_unitario` (col 21 nuevo) está
// vacío para los ingredientes del bootstrap. El recetario lee por nombre de header, no encuentra
// precio → calcula $0 para todas las recetas con ingredientes del bootstrap.
// Este endpoint copia el valor de col 15 (donde está el precio_real_unitario viejo, ahora con
// header 'merma_deshielo_pct') a col 21 (donde debería estar). Solo afecta filas con col 21 VACÍA
// y col 15 con número > 0. Idempotente.
function handleSr12RescatarPreciosLegacy(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin puede ejecutar este rescate' };

  var sheetIng = getSheet('Ingredientes');
  if (!sheetIng) return { ok:false, error:'No existe hoja Ingredientes' };

  // Detectar índices reales de las columnas por header (defensivo, por si el sheet difiere del schema)
  var headers = sheetIng.getRange(1, 1, 1, sheetIng.getLastColumn()).getValues()[0];
  var colMermaDeshielo = -1, colPrecioReal = -1, colEmpresaId = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]);
    if (h === 'merma_deshielo_pct') colMermaDeshielo = i + 1;
    if (h === 'precio_real_unitario') colPrecioReal = i + 1;
    if (h === 'empresa_id') colEmpresaId = i + 1;
  }
  if (colMermaDeshielo < 0 || colPrecioReal < 0 || colEmpresaId < 0) {
    return { ok:false, error:'Headers esperados no encontrados (merma_deshielo_pct, precio_real_unitario, empresa_id)' };
  }

  var lastRow = sheetIng.getLastRow();
  if (lastRow < 2) return { ok:true, mensaje:'Hoja vacía, nada que hacer', rescatados:0 };

  // Leer las 3 columnas relevantes
  var empresaIds = sheetIng.getRange(2, colEmpresaId, lastRow - 1, 1).getValues();
  var rangoLegacy = sheetIng.getRange(2, colMermaDeshielo, lastRow - 1, 1);
  var valoresLegacy = rangoLegacy.getValues();
  var rangoNuevo = sheetIng.getRange(2, colPrecioReal, lastRow - 1, 1);
  var valoresNuevo = rangoNuevo.getValues();

  var rescatados = 0, ignoradosYaTienePrecio = 0, ignoradosLegacyInvalido = 0, ignoradosOtraEmpresa = 0;
  var muestras = [];
  for (var i = 0; i < valoresLegacy.length; i++) {
    if (empresaIds[i][0] !== u.empresa_id) { ignoradosOtraEmpresa++; continue; }
    var legacy = valoresLegacy[i][0];
    var nuevo = valoresNuevo[i][0];
    // No tocar si col 21 ya tiene precio (probablemente cargado correctamente después del bootstrap)
    if (nuevo !== '' && nuevo !== null && nuevo !== undefined && !isNaN(parseFloat(nuevo)) && parseFloat(nuevo) > 0) {
      ignoradosYaTienePrecio++;
      continue;
    }
    // Validar legacy es número > 0
    var legacyNum = parseFloat(String(legacy).replace(',', '.'));
    if (isNaN(legacyNum) || legacyNum <= 0) {
      ignoradosLegacyInvalido++;
      continue;
    }
    valoresNuevo[i][0] = legacyNum;
    rescatados++;
    if (muestras.length < 5) muestras.push({ fila: i + 2, valor: legacyNum });
  }

  if (rescatados > 0) {
    rangoNuevo.setValues(valoresNuevo);
  }

  return {
    ok: true,
    rescatados: rescatados,
    ignorados_ya_tiene_precio: ignoradosYaTienePrecio,
    ignorados_legacy_invalido: ignoradosLegacyInvalido,
    ignorados_otra_empresa: ignoradosOtraEmpresa,
    muestras: muestras
  };
}

// Helper: agrupa una lista de números de fila (ordenada DESCENDENTE) en bloques contiguos para deleteRows.
// Input: [635, 634, 633, 500, 499] → Output: [{start:633, count:3}, {start:499, count:2}]
// Crucial para eficiencia: borrar N filas individuales puede colapsar al timeout; deleteRows en bloque es 1 llamada.
function agruparContiguos(rowsDesc) {
  if (!rowsDesc.length) return [];
  var bloques = [];
  var actualStart = rowsDesc[0];
  var actualCount = 1;
  for (var i = 1; i < rowsDesc.length; i++) {
    if (rowsDesc[i] === actualStart - actualCount) {
      actualCount++;
    } else {
      bloques.push({ start: actualStart - actualCount + 1, count: actualCount });
      actualStart = rowsDesc[i];
      actualCount = 1;
    }
  }
  bloques.push({ start: actualStart - actualCount + 1, count: actualCount });
  return bloques;
}

// Lista el catálogo SR12 actual (con existencias por área). Para mostrar en frontend.
function handleSr12CatalogoList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria','cocina','churrasca'])) return { ok:false, error:'Sin permisos' };
  var sheet = asegurarHoja('IngredientesSR12',
    ['clave_sr12','empresa_id','nombre_sr12','familia_sr12','presentacion_descripcion','unidad_base','factor_a_base','costo_total_sr12','costo_por_base_sr12','impuesto_pct','existencia_almacen','existencia_barra','existencia_cava','existencia_churrasca','existencia_cocina','existencia_piso','existencia_total','saldo_total','parser_unidad_ok','creado_at','actualizado_at','ultima_importacion_id']);
  var filas = rowsToObjects(sheet).filter(function(s){ return s.empresa_id === u.empresa_id; });
  return { ok:true, productos: filas.map(function(s){
    return {
      clave_sr12: s.clave_sr12,
      nombre_sr12: s.nombre_sr12,
      familia_sr12: s.familia_sr12,
      presentacion_descripcion: s.presentacion_descripcion,
      unidad_base: s.unidad_base,
      factor_a_base: s.factor_a_base,
      costo_total_sr12: s.costo_total_sr12,
      costo_por_base_sr12: s.costo_por_base_sr12,
      existencia_almacen: s.existencia_almacen,
      existencia_barra: s.existencia_barra,
      existencia_cava: s.existencia_cava,
      existencia_churrasca: s.existencia_churrasca,
      existencia_cocina: s.existencia_cocina,
      existencia_piso: s.existencia_piso,
      existencia_total: s.existencia_total,
      saldo_total: s.saldo_total,
      parser_unidad_ok: s.parser_unidad_ok
    };
  })};
}

// ==========================================================================
// DIAGNÓSTICO DE SCHEMA (v141) — Solo lee, no escribe nada.
// Propósito: ANTES de migrar el schema legacy, confirmar con datos reales
// si los ingredientes del bootstrap del 7/05/2026 tienen sus valores
// desfasados respecto a los headers actuales.
//
// El rescate v140 ya confirmó que col 15 (header `merma_deshielo_pct`)
// contenía el valor de `precio_real_unitario` viejo. La pregunta es:
// ¿es un offset uniforme +6 desde col 4, o un offset variable por regiones,
// o algún otro patrón?
//
// Este endpoint reporta para varias filas distribuidas (fila 2, intermedia,
// última de la empresa) cada valor con su header y el TIPO detectado vs
// el TIPO ESPERADO por header. Las discordancias son la huella del desfase.
// ==========================================================================
function handleSr12DiagnosticoSchema(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin o gerente_administrativo' };

  var sheetIng = getSheet('Ingredientes');
  if (!sheetIng) return { ok:false, error:'No existe hoja Ingredientes' };

  var lastRow = sheetIng.getLastRow();
  var lastCol = sheetIng.getLastColumn();
  if (lastRow < 2) return { ok:true, mensaje:'Hoja vacía', total_filas:0 };

  // Headers actuales con índice
  var headersRaw = sheetIng.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = headersRaw.map(function(h, i){ return { col: i + 1, header: String(h) }; });

  // Tipo esperado por header (basado en schema V3 actual, 27 cols)
  var TIPO_ESPERADO = {
    'id': 'string',
    'empresa_id': 'string',
    'nombre': 'string',
    'aliases': 'string',                    // ej. "Tomahok|Tomahawk" o vacío
    'categoria': 'string',                  // ej. "Abarrotes y secos"
    'tipo_abc': 'string',                   // A | B | C
    'es_subreceta_catalogo': 'boolean',
    'dato_incompleto': 'boolean',
    'inventariable': 'boolean',
    'unidad_base': 'string',                // lt | kg | pza
    'ultimo_costo': 'number',
    'costo_promedio': 'number',
    'ultimo_costo_estimado': 'boolean',     // true/false flag (cuidado: el nombre suena a número)
    'precio_origen': 'string',              // 'web' | 'categoria' | 'compra' | etc.
    'merma_deshielo_pct': 'number',
    'merma_aprovechable_pct': 'number',
    'merma_no_aprovechable_pct': 'number',
    'merma_pct': 'number',
    'factor_rendimiento': 'number',
    'factor_rendimiento_origen': 'string',  // 'estimado' | 'real' | etc.
    'precio_real_unitario': 'number',
    'activo': 'boolean',
    'creado_at': 'date',
    'creado_por': 'email',
    'actualizado_at': 'date',
    'actualizado_por': 'email',
    'clave_sr12': 'string'                  // clave numérica como texto
  };

  function detectarTipo(v) {
    if (v === '' || v === null || v === undefined) return 'empty';
    if (v instanceof Date) return 'date';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    var s = String(v).trim();
    if (s === '') return 'empty';
    if (s === 'true' || s === 'TRUE' || s === 'false' || s === 'FALSE') return 'boolean';
    if (s.indexOf('@') > 0 && s.indexOf('.') > 0) return 'email';
    // Date como string ISO (raro en Sheets pero por si acaso)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'date';
    // Número como string
    if (/^-?\d+(\.\d+)?$/.test(s.replace(',', '.'))) return 'number';
    return 'string';
  }

  // Filas a muestrear: fila 2, fila ~25%, fila ~50%, fila ~75%, última
  var totalDatos = lastRow - 1;
  var indicesMuestrear = [];
  if (totalDatos > 0) indicesMuestrear.push(2);
  if (totalDatos > 4) indicesMuestrear.push(2 + Math.floor(totalDatos * 0.25));
  if (totalDatos > 4) indicesMuestrear.push(2 + Math.floor(totalDatos * 0.5));
  if (totalDatos > 4) indicesMuestrear.push(2 + Math.floor(totalDatos * 0.75));
  if (totalDatos > 1) indicesMuestrear.push(lastRow);
  // Dedupe
  var vistos = {};
  indicesMuestrear = indicesMuestrear.filter(function(f){ if (vistos[f]) return false; vistos[f] = true; return true; });

  // Leer las filas muestreadas + columna empresa_id de TODAS las filas (para contar legacy global)
  var colEmpresaId = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].header === 'empresa_id') { colEmpresaId = headers[i].col; break; }
  }

  // Análisis de cada fila muestreada
  var muestras = indicesMuestrear.map(function(filaNum) {
    var fila = sheetIng.getRange(filaNum, 1, 1, lastCol).getValues()[0];
    var celdas = headers.map(function(h, idx) {
      var v = fila[idx];
      var tipoDetectado = detectarTipo(v);
      var tipoEsperado = TIPO_ESPERADO[h.header] || '?';
      // Una celda es "sospechosa" si tipo detectado != esperado y no está vacía.
      // Excepción: tipo esperado 'string' acepta 'email' (algunos campos string podrían tener emails)
      var sospechoso = false;
      if (tipoDetectado !== 'empty' && tipoEsperado !== '?') {
        if (tipoEsperado === 'string' && (tipoDetectado === 'email' || tipoDetectado === 'string')) sospechoso = false;
        else if (tipoEsperado === tipoDetectado) sospechoso = false;
        else sospechoso = true;
      }
      // Truncar valor a 40 chars para no inflar el payload
      var valorStr = String(v);
      if (valorStr.length > 40) valorStr = valorStr.slice(0, 37) + '...';
      return {
        col: h.col,
        header: h.header,
        tipo_esperado: tipoEsperado,
        tipo_detectado: tipoDetectado,
        valor: valorStr,
        sospechoso: sospechoso
      };
    });
    var nCeldasSospechosas = celdas.filter(function(c){ return c.sospechoso; }).length;
    return {
      fila: filaNum,
      empresa_id: (colEmpresaId > 0) ? fila[colEmpresaId - 1] : null,
      celdas_sospechosas: nCeldasSospechosas,
      celdas: celdas
    };
  });

  // Hipótesis del mapeo viejo (V1 20 cols) → nuevo (V3 27 cols)
  // Si el desfase es de "headers reescritos sin migrar datos" (cols nuevas en posiciones específicas
  // del schema), el dato en col física X tiene el header viejo correspondiente al schema V1.
  var SCHEMA_V1_HIPOTESIS = [
    'id','empresa_id','nombre','categoria','tipo_abc','es_subreceta_catalogo','dato_incompleto',
    'inventariable','unidad_base','precio_compra','precio_compra_estimado','precio_origen',
    'merma_deshielo_pct','merma_aprovechable_pct','precio_real_unitario',
    'activo','creado_at','creado_por','actualizado_at','actualizado_por'
  ];

  // Resultado
  return {
    ok: true,
    total_filas_datos: totalDatos,
    headers_actuales: headers,
    schema_v1_hipotesis: SCHEMA_V1_HIPOTESIS,
    nota: 'Compara para cada celda sospechosa: ¿el header viejo (V1) en la misma col física explica el valor real?',
    muestras: muestras
  };
}

// ==========================================================================
// MIGRACIÓN SCHEMA LEGACY V1 → V3 (v142) — Confirmado por diagnóstico v141.
//
// El bootstrap inicial del 7/05/2026 escribió ingredientes con un schema V1
// de 20 columnas. Después se reescribieron SOLO los headers con el schema V3
// de 27 columnas (sin migrar los datos físicos). Resultado: cada celda tiene
// el valor del header V1[col] pero el header V3[col] encima.
//
// Mapeo V1 (col 1..20) → V3 (col 1..27) confirmado por datos reales (fila 2,
// 125, 248, 371, 493 todas con el mismo patrón):
//
//   V1 col  →  V3 col       (qué hacemos)
//   1       →  1            id
//   2       →  2            empresa_id
//   3       →  3            nombre
//   —       →  4            aliases (NUEVA, vacía)
//   4       →  5            categoria
//   5       →  6            tipo_abc
//   6       →  7            es_subreceta_catalogo
//   7       →  8            dato_incompleto
//   8       →  9            inventariable
//   9       →  10           unidad_base
//   10      →  11           ultimo_costo (era precio_compra)
//   —       →  12           costo_promedio (NUEVA — copiar de ultimo_costo, igual que migrarV3)
//   11      →  13           ultimo_costo_estimado (era precio_compra_estimado)
//   12      →  14           precio_origen
//   13      →  15           merma_deshielo_pct
//   14      →  16           merma_aprovechable_pct
//   —       →  17           merma_no_aprovechable_pct (NUEVA, vacía)
//   —       →  18           merma_pct (NUEVA, vacía)
//   —       →  19           factor_rendimiento (NUEVA, vacía)
//   —       →  20           factor_rendimiento_origen (NUEVA, vacía)
//   15      →  21           precio_real_unitario (ya rescatado por v140 — preservar)
//   16      →  22           activo
//   17      →  23           creado_at
//   18      →  24           creado_por
//   19      →  25           actualizado_at (preservar valor V3 si ya existe — escrito por revert)
//   20      →  26           actualizado_por (preservar valor V3 si ya existe)
//   —       →  27           clave_sr12 (NUEVA, preservar si ya tiene algo)
//
// Heurística de detección "fila legacy" (3 señales, cualquiera prende):
//   1. col 10 (V3 unidad_base) es número → es precio_compra viejo
//   2. col 18 (V3 merma_pct) contiene '@' → es creado_por viejo
//   3. col 20 (V3 factor_rendimiento_origen) contiene '@' → es actualizado_por viejo
//
// Idempotente: filas ya migradas pasan las 3 heurísticas como NO-legacy.
//
// Parámetros:
//   p.token      — sesión
//   p.dry_run    — 'true' / 'false'. Default 'true'. Si true, solo reporta.
// ==========================================================================
function handleSr12MigrarSchemaLegacy(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin o gerente_administrativo' };

  var dryRun = !(p.dry_run === 'false' || p.dry_run === false);  // default true (seguro)

  var sheetIng = getSheet('Ingredientes');
  if (!sheetIng) return { ok:false, error:'No existe hoja Ingredientes' };

  var lastRow = sheetIng.getLastRow();
  var lastCol = sheetIng.getLastColumn();
  if (lastRow < 2) return { ok:true, mensaje:'Hoja vacía', migradas:0 };

  // Validar headers actuales = V3 esperado (defensa: no migrar si el schema cambió)
  var ESPERADO_V3 = ['id','empresa_id','nombre','aliases','categoria','tipo_abc','es_subreceta_catalogo','dato_incompleto','inventariable','unidad_base','ultimo_costo','costo_promedio','ultimo_costo_estimado','precio_origen','merma_deshielo_pct','merma_aprovechable_pct','merma_no_aprovechable_pct','merma_pct','factor_rendimiento','factor_rendimiento_origen','precio_real_unitario','activo','creado_at','creado_por','actualizado_at','actualizado_por','clave_sr12'];
  var headers = sheetIng.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.length !== ESPERADO_V3.length) {
    return { ok:false, error:'Schema actual no es V3 (esperaba 27 cols, hay ' + headers.length + '). Aborto por seguridad.' };
  }
  for (var ih = 0; ih < ESPERADO_V3.length; ih++) {
    if (String(headers[ih]) !== ESPERADO_V3[ih]) {
      return { ok:false, error:'Header col ' + (ih+1) + ' es "' + headers[ih] + '" pero V3 espera "' + ESPERADO_V3[ih] + '". Aborto por seguridad.' };
    }
  }

  // Helpers
  function esEmail(v) {
    if (v === '' || v === null || v === undefined) return false;
    var s = String(v);
    return s.indexOf('@') > 0 && s.indexOf('.') > 0;
  }
  function esNumero(v) {
    if (v === '' || v === null || v === undefined) return false;
    if (typeof v === 'number') return !isNaN(v);
    var s = String(v).replace(',', '.').trim();
    if (s === '') return false;
    return /^-?\d+(\.\d+)?$/.test(s) && !isNaN(parseFloat(s));
  }
  function esLegacy(fila) {
    // Señal 1: col 10 (unidad_base V3) tiene número (era precio_compra V1)
    if (esNumero(fila[9])) return { si:true, motivo:'col10_es_numero' };
    // Señal 2: col 18 (merma_pct V3) tiene email (era creado_por V1)
    if (esEmail(fila[17])) return { si:true, motivo:'col18_es_email' };
    // Señal 3: col 20 (factor_rendimiento_origen V3) tiene email (era actualizado_por V1)
    if (esEmail(fila[19])) return { si:true, motivo:'col20_es_email' };
    return { si:false, motivo:null };
  }

  // Leer todas las filas de datos en un solo batch
  var rangoTodo = sheetIng.getRange(2, 1, lastRow - 1, lastCol);
  var valoresTodos = rangoTodo.getValues();

  var migradas = 0;
  var yaAlineadas = 0;
  var otraEmpresa = 0;
  var motivos = { col10_es_numero:0, col18_es_email:0, col20_es_email:0 };
  var muestras = [];  // 3 muestras antes/después para validar visualmente

  for (var r = 0; r < valoresTodos.length; r++) {
    var fila = valoresTodos[r];

    // Filtro por empresa (defensa multi-empresa, aunque hoy solo hay Fogueira)
    if (fila[1] !== u.empresa_id) { otraEmpresa++; continue; }

    var deteccion = esLegacy(fila);
    if (!deteccion.si) { yaAlineadas++; continue; }
    motivos[deteccion.motivo]++;

    // Construir fila NUEVA V3 (27 cols) — todo vacío excepto donde hay valor mapeado
    var nueva = new Array(27);
    for (var k = 0; k < 27; k++) nueva[k] = '';

    nueva[0]  = fila[0];                          // id
    nueva[1]  = fila[1];                          // empresa_id
    nueva[2]  = fila[2];                          // nombre
    nueva[3]  = '';                               // aliases (nueva — vacía)
    nueva[4]  = fila[3];                          // categoria      ← V1 col 4
    nueva[5]  = fila[4];                          // tipo_abc       ← V1 col 5
    nueva[6]  = fila[5];                          // es_subreceta_catalogo
    nueva[7]  = fila[6];                          // dato_incompleto
    nueva[8]  = fila[7];                          // inventariable
    nueva[9]  = fila[8];                          // unidad_base    ← V1 col 9 (lt/kg/pza)
    nueva[10] = fila[9];                          // ultimo_costo   ← V1 col 10 (precio_compra)
    // costo_promedio: igual a ultimo_costo (como hace migrarV3). Si ultimo_costo es número.
    nueva[11] = esNumero(fila[9]) ? parseFloat(String(fila[9]).replace(',','.')) : '';
    nueva[12] = fila[10];                         // ultimo_costo_estimado ← V1 col 11
    nueva[13] = fila[11];                         // precio_origen  ← V1 col 12
    nueva[14] = fila[12];                         // merma_deshielo_pct ← V1 col 13
    nueva[15] = fila[13];                         // merma_aprovechable_pct ← V1 col 14
    nueva[16] = '';                               // merma_no_aprovechable_pct (nueva)
    nueva[17] = '';                               // merma_pct (nueva)
    nueva[18] = '';                               // factor_rendimiento (nueva)
    nueva[19] = '';                               // factor_rendimiento_origen (nueva)

    // precio_real_unitario: preferir el rescatado por v140 (col 21 actual). Si no, tomar V1 col 15.
    var rescatadoPRU = fila[20];
    var legacyPRU    = fila[14];
    if (esNumero(rescatadoPRU) && parseFloat(String(rescatadoPRU).replace(',','.')) > 0) {
      nueva[20] = parseFloat(String(rescatadoPRU).replace(',','.'));
    } else if (esNumero(legacyPRU) && parseFloat(String(legacyPRU).replace(',','.')) > 0) {
      nueva[20] = parseFloat(String(legacyPRU).replace(',','.'));
    } else {
      nueva[20] = '';
    }

    nueva[21] = fila[15];                         // activo         ← V1 col 16
    nueva[22] = fila[16];                         // creado_at      ← V1 col 17
    nueva[23] = fila[17];                         // creado_por     ← V1 col 18

    // actualizado_at: preservar valor V3 actual (escrito por revert) si es válido; sino tomar V1 col 19.
    var actualAtV3 = fila[24];
    var actualAtV1 = fila[18];
    if (actualAtV3 instanceof Date) {
      nueva[24] = actualAtV3;
    } else if (actualAtV1 instanceof Date) {
      nueva[24] = actualAtV1;
    } else {
      nueva[24] = '';
    }

    // actualizado_por: preservar valor V3 actual (email) si es válido; sino tomar V1 col 20.
    var actualPorV3 = fila[25];
    var actualPorV1 = fila[19];
    if (esEmail(actualPorV3)) {
      nueva[25] = actualPorV3;
    } else if (esEmail(actualPorV1)) {
      nueva[25] = actualPorV1;
    } else {
      nueva[25] = '';
    }

    nueva[26] = fila[26];                         // clave_sr12 (conservar si tenía algo)

    // Recolectar muestras antes/después (las primeras 3)
    if (muestras.length < 3) {
      muestras.push({
        fila: r + 2,
        nombre: String(fila[2]),
        motivo_detectado: deteccion.motivo,
        antes: {
          col04_aliases: String(fila[3]),
          col05_categoria: String(fila[4]),
          col10_unidad_base: String(fila[9]),
          col18_merma_pct: String(fila[17]),
          col24_creado_por: String(fila[23])
        },
        despues: {
          col04_aliases: String(nueva[3]),
          col05_categoria: String(nueva[4]),
          col10_unidad_base: String(nueva[9]),
          col11_ultimo_costo: String(nueva[10]),
          col15_merma_deshielo_pct: String(nueva[14]),
          col21_precio_real_unitario: String(nueva[20]),
          col22_activo: String(nueva[21]),
          col24_creado_por: String(nueva[23]),
          col25_actualizado_at: String(nueva[24])
        }
      });
    }

    // Reemplazar en el batch
    valoresTodos[r] = nueva;
    migradas++;
  }

  // Escribir solo si NO es dry-run
  if (!dryRun && migradas > 0) {
    rangoTodo.setValues(valoresTodos);
  }

  return {
    ok: true,
    dry_run: dryRun,
    total_filas: valoresTodos.length,
    migradas: migradas,
    ya_alineadas: yaAlineadas,
    otra_empresa: otraEmpresa,
    motivos_deteccion: motivos,
    muestras_antes_despues: muestras,
    nota: dryRun
      ? 'DRY RUN: NO se escribió nada. Revisa muestras. Para aplicar de verdad: re-ejecutar con dry_run=false.'
      : 'APLICADO: ' + migradas + ' filas migradas, ' + yaAlineadas + ' ya estaban alineadas, ' + otraEmpresa + ' de otra empresa (ignoradas).'
  };
}

// ==========================================================================
// BACKUP DE HOJA Ingredientes (v142) — Duplica la hoja `Ingredientes` con
// nombre `Ingredientes_backup_YYYY-MM-DD_vXXX`. Para tener punto de reversa
// antes de la migración de schema legacy.
//
// Fecha en formato local México (NO toISOString — evita el bug de UTC).
// ==========================================================================
function handleSr12BackupIngredientes(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin o gerente_administrativo' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetIng = ss.getSheetByName('Ingredientes');
  if (!sheetIng) return { ok:false, error:'No existe hoja Ingredientes' };

  // Fecha local (no toISOString por bug UTC documentado en memoria)
  var ahora = new Date();
  var anio = ahora.getFullYear();
  var mes = String(ahora.getMonth() + 1).padStart(2, '0');
  var dia = String(ahora.getDate()).padStart(2, '0');
  var hh = String(ahora.getHours()).padStart(2, '0');
  var mm = String(ahora.getMinutes()).padStart(2, '0');
  var nombreBase = 'Ingredientes_backup_' + anio + '-' + mes + '-' + dia + '_' + hh + mm;

  // Si ya existe con ese nombre, sufijo numérico
  var nombreFinal = nombreBase;
  var sufijo = 0;
  while (ss.getSheetByName(nombreFinal)) {
    sufijo++;
    nombreFinal = nombreBase + '_' + sufijo;
  }

  // Copiar la hoja (copyTo crea una nueva tab con nombre "Copia de Ingredientes")
  var copia = sheetIng.copyTo(ss);
  copia.setName(nombreFinal);
  // Moverla al final para no estorbar
  ss.setActiveSheet(copia);
  ss.moveActiveSheet(ss.getNumSheets());

  return {
    ok: true,
    backup_creado: nombreFinal,
    filas_copiadas: sheetIng.getLastRow() - 1,
    cols_copiadas: sheetIng.getLastColumn(),
    timestamp: anio + '-' + mes + '-' + dia + ' ' + hh + ':' + mm
  };
}

// v400 — RESTAURAR la hoja Ingredientes desde una tab de respaldo (recuperación de incidente).
// Respalda el estado ACTUAL antes de pisar. Admin/gte_admin. Pisa TODA la hoja Ingredientes con
// los valores del backup nombrado → deja exactamente N filas (quita duplicados/cambios posteriores).
function handleSr12RestaurarIngredientes(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var nombreBackup = String(p.backup || '').trim();
  if (!nombreBackup) return { ok:false, error:'backup requerido' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName(nombreBackup);
  if (!src) return { ok:false, error:'Respaldo no encontrado: ' + nombreBackup };
  var dst = ss.getSheetByName('Ingredientes');
  if (!dst) return { ok:false, error:'Hoja Ingredientes no encontrada' };
  var srcVals = src.getDataRange().getValues();
  if (!srcVals.length || srcVals[0].length < 5) return { ok:false, error:'El respaldo parece vacío o sin columnas' };
  // 1) Respaldar el estado ACTUAL antes de pisar (red de seguridad)
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd_HHmm');
  var preNombre = 'Ingredientes_pre-restore_' + stamp;
  var s = 0; while (ss.getSheetByName(preNombre)) { s++; preNombre = 'Ingredientes_pre-restore_' + stamp + '_' + s; }
  var preCopia = dst.copyTo(ss); preCopia.setName(preNombre);
  ss.setActiveSheet(preCopia); ss.moveActiveSheet(ss.getNumSheets());
  // 2) Pisar Ingredientes con los valores del respaldo
  var filasAntes = dst.getLastRow();
  dst.clearContents();
  dst.getRange(1, 1, srcVals.length, srcVals[0].length).setValues(srcVals);
  return { ok:true, restaurado_de:nombreBackup, filas_restauradas:srcVals.length - 1, filas_antes:filasAntes - 1, respaldo_previo:preNombre };
}

// ═══════════════════════════════════════════════════════════════════════════
// v163 — Vinculación manual de huérfanos SR12.
// Permite a admin/comprador ligar un ingrediente Fogueira a una clave SR12
// del catálogo. Upsert sobre IngredientesSR12Match con tipo_match='manual',
// score 1.0 y auditoría (email + timestamp). Si `clave_sr12` viene vacía,
// borra el match (desvincular). Devuelve el objeto sr12 completo para
// refrescar la fila en UI sin recargar.
// ═══════════════════════════════════════════════════════════════════════════
function handleSr12IngredienteVincular(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  // v164 — incluir cocina y churrasca: los chefs son quienes conocen la equivalencia
  // operativa entre el ingrediente de su receta y el producto exacto del SR12.
  // v288 — incluir auditoria: el dueño/auditor vincula desde el inventario de churrasca.
  if (!rolEs(u, ['admin','gerente_administrativo','cocina','churrasca','comprador','auditoria'])) return { ok:false, error:'Tu rol no puede vincular ingredientes a SR12' };

  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var ingredienteId = String(data.ingrediente_id || '').trim();
  var claveSr12     = String(data.clave_sr12 || '').trim();
  if (!ingredienteId) return { ok:false, error:'ingrediente_id requerido' };

  // Validar que el ingrediente existe y es de esta empresa
  var shIng = getSheet('Ingredientes');
  var ingExiste = rowsToObjects(shIng).find(function(r){
    return String(r.id) === ingredienteId && r.empresa_id === u.empresa_id;
  });
  if (!ingExiste) return { ok:false, error:'Ingrediente no encontrado' };

  // Si claveSr12 viene, validar que existe en el catálogo
  var sr12Detalle = null;
  if (claveSr12) {
    var shSr12 = SpreadsheetApp.getActive().getSheetByName('IngredientesSR12');
    if (!shSr12) return { ok:false, error:'Catálogo SR12 no cargado en esta empresa' };
    sr12Detalle = rowsToObjects(shSr12).find(function(s){
      return String(s.clave_sr12) === claveSr12 && s.empresa_id === u.empresa_id;
    });
    if (!sr12Detalle) return { ok:false, error:'Clave SR12 ' + claveSr12 + ' no existe en el catálogo' };
  }

  // Upsert en IngredientesSR12Match
  var headers = ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at'];
  var shMatch = asegurarHoja('IngredientesSR12Match', headers);
  var lastRow = shMatch.getLastRow();
  var existingRowIdx = -1;
  if (lastRow > 1) {
    var allData = shMatch.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var i = 0; i < allData.length; i++) {
      if (String(allData[i][3]) === ingredienteId && allData[i][1] === u.empresa_id) {
        existingRowIdx = i + 2; // 1-indexed + skip header
        break;
      }
    }
  }

  var now = new Date();

  // Desvincular: si no viene clave_sr12, borrar el match
  if (!claveSr12) {
    if (existingRowIdx > 0) shMatch.deleteRow(existingRowIdx);
    return { ok:true, vinculado:false, ingrediente_id:ingredienteId, clave_sr12:'', sr12:null };
  }

  // Upsert
  var existingId = (existingRowIdx > 0) ? shMatch.getRange(existingRowIdx, 1).getValue() : Utilities.getUuid();
  var newRow = [existingId, u.empresa_id, claveSr12, ingredienteId, 'manual', 1.0, u.email, now];

  if (existingRowIdx > 0) {
    shMatch.getRange(existingRowIdx, 1, 1, headers.length).setValues([newRow]);
  } else {
    shMatch.appendRow(newRow);
  }

  // Devolver el sr12 hidratado en el mismo formato que handleIngredientesList
  // para que el frontend refresque la fila sin recargar todo.
  var n = function(x){ var v = Number(x); return isNaN(v) ? 0 : v; };
  return {
    ok: true,
    vinculado: true,
    ingrediente_id: ingredienteId,
    clave_sr12: claveSr12,
    sr12: {
      clave: claveSr12,
      nombre_sr12: sr12Detalle.nombre_sr12 || '',
      unidad_base: sr12Detalle.unidad_base || '',
      presentacion_descripcion: sr12Detalle.presentacion_descripcion || '',
      almacen:   n(sr12Detalle.existencia_almacen),
      barra:     n(sr12Detalle.existencia_barra),
      cava:      n(sr12Detalle.existencia_cava),
      churrasca: n(sr12Detalle.existencia_churrasca),
      cocina:    n(sr12Detalle.existencia_cocina),
      piso:      n(sr12Detalle.existencia_piso),
      total:     n(sr12Detalle.existencia_total),
      actualizado_at: sr12Detalle.actualizado_at || ''
    }
  };
}

// =============================================================================
// APROBACIÓN DE IMPORTACIONES CON ALERTAS CRÍTICAS (v267)
// Cuando hay cambios >50% el comprador no puede aplicar solo.
// Debe solicitar aprobación al gerente_administrativo, quien revisa y autoriza.
// La autorización es válida 48 horas.
// =============================================================================

var APROBACIONES_SR12_COLS = ['id','empresa_id','solicitado_por_email','solicitado_at','divergencias_count','alertas_resumen','estado','aprobado_por_email','aprobado_at','valido_hasta','motivo_rechazo','detalle_json','payload_drive_id'];

function _getAprobacionValida(empresa_id) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AprobacionesSR12');
  if (!sh) return null;
  var ahora = new Date();
  var rows = rowsToObjects(sh).filter(function(r){
    return r.empresa_id === empresa_id && String(r.estado).toLowerCase() === 'aprobada';
  });
  for (var i = 0; i < rows.length; i++) {
    var valido = rows[i].valido_hasta ? new Date(rows[i].valido_hasta) : null;
    if (valido && valido > ahora) return rows[i];
  }
  return null;
}

function handleSr12SolicitarAprobacion(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var divergencias = parseInt(p.divergencias_count || 0);
  var resumen = String(p.alertas_resumen || '');
  if (!divergencias) return { ok:false, error:'No hay cambios críticos que requieran aprobación' };
  // v399: guardamos el detalle producto-por-producto (costo anterior→nuevo→%) que YA calculó el
  // dry-run, para que quien aprueba decida informado SIN tener el archivo. Backstop de tamaño:
  // la celda de Sheets aguanta 50k chars; el frontend ya capa el nº de items, esto solo evita reventar.
  var detalle = String(p.detalle_json || '');
  if (detalle.length > 45000) detalle = '';
  var sh = asegurarHoja('AprobacionesSR12', APROBACIONES_SR12_COLS);
  var colDet = _getOrCreateCol(sh, 'detalle_json');       // self-heal: la hoja vieja no tiene la columna
  var colPay = _getOrCreateCol(sh, 'payload_drive_id');   // v400 — id del archivo en Drive (para "aprobar y aplicar")
  var ahora = new Date();
  var aprobId = uuid();
  // v400 — guardamos el ARCHIVO parseado en Drive para poder "Aprobar y aplicar" sin que el comprador
  // vuelva a subirlo. El payload (cientos de productos) NO cabe en una celda → va a Drive. Si Drive no
  // está autorizado, seguimos sin payload (cae al flujo viejo: aprobar y que el comprador aplique).
  var driveId = '';
  try {
    var payload = String(p.payload || '');
    if (payload && payload.length > 10) {
      driveId = DriveApp.createFile('sr12_payload_' + aprobId + '.json', payload, 'application/json').getId();
    }
  } catch(e){ driveId = ''; }
  sh.appendRow([aprobId, u.empresa_id, u.email, ahora, divergencias, resumen, 'pendiente', '', '', '', '']);
  var fila = sh.getLastRow();
  var cel = sh.getRange(fila, colDet);
  cel.setNumberFormat('@');  // texto: el JSON trae comas y no debe convertirse por locale
  cel.setValue(detalle);
  if (driveId) sh.getRange(fila, colPay).setValue(driveId);
  return { ok:true, payload_guardado: !!driveId };
}

function handleSr12AprobacionesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };
  var sh = asegurarHoja('AprobacionesSR12', APROBACIONES_SR12_COLS);
  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  rows.sort(function(a,b){ return new Date(b.solicitado_at) - new Date(a.solicitado_at); });
  return {
    ok: true,
    aprobaciones: rows.map(function(r){
      var det = null; try { if (r.detalle_json) det = JSON.parse(r.detalle_json); } catch(e){ det = null; }
      return { id:r.id, solicitado_por:r.solicitado_por_email, solicitado_at:String(r.solicitado_at||'').slice(0,16),
        divergencias:r.divergencias_count, resumen:r.alertas_resumen, estado:r.estado,
        aprobado_por:r.aprobado_por_email||'', aprobado_at:String(r.aprobado_at||'').slice(0,16),
        valido_hasta:String(r.valido_hasta||'').slice(0,16), motivo:r.motivo_rechazo||'', detalle:det,
        tiene_payload: !!String(r.payload_drive_id||'') };
    })
  };
}

// v400 — APROBAR Y APLICAR en un paso (lo hace el aprobador, sin que el comprador re-suba el archivo).
// Lee el payload que se guardó en Drive al "Enviar a Gerencia", aprueba y aplica reusando el motor.
function handleSr12AprobacionAprobarYAplicar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo Admin o Gerente Administrativo pueden aprobar' };
  var id = String(p.id || '').trim();
  if (!id) return { ok:false, error:'id requerido' };
  var sh = asegurarHoja('AprobacionesSR12', APROBACIONES_SR12_COLS);
  var rows = rowsToObjects(sh);
  var row = null;
  for (var i=0;i<rows.length;i++){ if (rows[i].id===id && rows[i].empresa_id===u.empresa_id){ row=rows[i]; break; } }
  if (!row) return { ok:false, error:'Solicitud no encontrada' };
  if (String(row.estado).toLowerCase() !== 'pendiente') return { ok:false, error:'Esta solicitud ya está ' + row.estado };
  var driveId = String(row.payload_drive_id || '');
  if (!driveId) return { ok:false, error:'Esta solicitud no tiene el archivo guardado (se creó antes de esta mejora). Apruébala y pídele al comprador que la aplique, o que la reenvíe.' };
  var payloadStr;
  try { payloadStr = DriveApp.getFileById(driveId).getBlob().getDataAsString(); }
  catch(e){ return { ok:false, error:'No se pudo leer el archivo guardado en Drive: ' + (e && e.message) }; }
  // 1. Aprobar (deja estado=aprobada + valido_hasta → el gate de divergencias del aplicar pasa)
  var aprob = handleSr12AprobacionAprobar({ token:p.token, id:id });
  if (!aprob.ok) return aprob;
  // 2. Aplicar reusando el motor (ya hay aprobación válida)
  var res = handleSr12ImportAplicar({ token:p.token, data:payloadStr });
  if (!res.ok) return res;  // si falla, la aprobación queda 'aprobada' (48h) → se puede reintentar
  // 3. Marcar 'aplicada' (que no se reuse) y borrar el archivo temporal de Drive
  var hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var cE = hdrs.indexOf('estado')+1; if (cE>0) sh.getRange(row._row, cE).setValue('aplicada');
  try { DriveApp.getFileById(driveId).setTrashed(true); } catch(e){}
  return { ok:true, aplicada:true, resumen:res.resumen };
}

function handleSr12AprobacionAprobar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo Admin o Gerente Administrativo pueden aprobar' };
  var id = String(p.id || '').trim();
  if (!id) return { ok:false, error:'id requerido' };
  var sh = asegurarHoja('AprobacionesSR12', APROBACIONES_SR12_COLS);
  var rows = rowsToObjects(sh);
  var rowIdx = -1;
  for (var i=0; i<rows.length; i++) { if (rows[i].id===id && rows[i].empresa_id===u.empresa_id){ rowIdx=i; break; } }
  if (rowIdx===-1) return { ok:false, error:'Solicitud no encontrada' };
  var ahora = new Date();
  var validoHasta = new Date(ahora.getTime() + 48*60*60*1000);
  var hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var shRow = rowIdx+2;
  var set = function(col, val){ var c=hdrs.indexOf(col)+1; if(c) sh.getRange(shRow,c).setValue(val); };
  set('estado','aprobada'); set('aprobado_por_email',u.email); set('aprobado_at',ahora); set('valido_hasta',validoHasta); set('motivo_rechazo','');
  return { ok:true };
}

function handleSr12AprobacionRechazar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo Admin o Gerente Administrativo pueden rechazar' };
  var id = String(p.id||'').trim();
  var motivo = String(p.motivo||'').trim();
  if (!id) return { ok:false, error:'id requerido' };
  if (motivo.length < 5) return { ok:false, error:'Motivo mínimo 5 caracteres' };
  var sh = asegurarHoja('AprobacionesSR12', APROBACIONES_SR12_COLS);
  var rows = rowsToObjects(sh);
  var rowIdx = -1;
  for (var i=0; i<rows.length; i++) { if (rows[i].id===id && rows[i].empresa_id===u.empresa_id){ rowIdx=i; break; } }
  if (rowIdx===-1) return { ok:false, error:'Solicitud no encontrada' };
  var hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var shRow = rowIdx+2;
  var set = function(col, val){ var c=hdrs.indexOf(col)+1; if(c) sh.getRange(shRow,c).setValue(val); };
  set('estado','rechazada'); set('aprobado_por_email',u.email); set('aprobado_at',new Date()); set('motivo_rechazo',motivo);
  return { ok:true };
}

function handleSr12AprobacionesCount(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AprobacionesSR12');
  if (!sh) return { ok:true, pendientes:0, hay_aprobacion_valida:false };
  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id===u.empresa_id; });
  var pendientes = rows.filter(function(r){ return String(r.estado).toLowerCase()==='pendiente'; }).length;
  var ahora = new Date();
  var hayValida = rows.some(function(r){
    return String(r.estado).toLowerCase()==='aprobada' && r.valido_hasta && new Date(r.valido_hasta) > ahora;
  });
  return { ok:true, pendientes:pendientes, hay_aprobacion_valida:hayValida };
}

// =============================================================================
// JUSTIFICACIONES DE VARIACIÓN DE PRECIOS (v265)
// Flujo: admin solicita → comprador responde → admin ve con trazabilidad
// =============================================================================

var JUSTIFICACIONES_COLS = ['id','empresa_id','clave_sr12','nombre_sr12','periodo_ref','cambio_pct','severidad','categoria','justificacion','justificado_por_email','justificado_at','solicitado_at','solicitado_por_email'];

// Admin/auditoria: guarda las alertas actuales como pendientes de justificación
function handleSr12JustificacionesSolicitar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','auditoria'].indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Solo Admin o Auditoría' };

  var reporte = handleSr12ReportePrecios(p);
  if (!reporte.ok) return reporte;

  var alertas = reporte.ingredientes.filter(function(i){ return i.severidad !== 'verde'; });
  if (!alertas.length) return { ok:true, creadas:0, mensaje:'No hay alertas en este período' };

  var periodoRef = reporte.periodo.importaciones.map(function(i){ return i.id; }).sort().join(',');

  var sh = asegurarHoja('JustificacionesPrecios', JUSTIFICACIONES_COLS);
  var existentes = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id && r.periodo_ref === periodoRef; });
  var existentesPorClave = {};
  existentes.forEach(function(r){ existentesPorClave[r.clave_sr12] = true; });

  var ahora = new Date();
  var nuevas = [];
  alertas.forEach(function(ing){
    if (!existentesPorClave[ing.clave]) {
      nuevas.push([
        uuid(), u.empresa_id, ing.clave, ing.nombre, periodoRef,
        ing.cambio_ultimo, ing.severidad, ing.categoria,
        '', '', '',
        ahora, u.email
      ]);
    }
  });

  if (nuevas.length) {
    sh.getRange(sh.getLastRow()+1, 1, nuevas.length, JUSTIFICACIONES_COLS.length).setValues(nuevas);
  }
  return { ok:true, creadas:nuevas.length, ya_existian:alertas.length-nuevas.length, periodo_ref:periodoRef };
}

// Reconstruye, para un periodo_ref (IDs de importaciones SR12 unidos por coma), el comparativo
// de costos por clave SR12: la serie de {fecha, costo} por importación, en las MISMAS unidades del
// Excel ($/kg, $/lt, $/pza — costo_base × factor_a_base). Sirve para mostrarle al comprador QUÉ
// está comparando (de cuánto a cuánto y entre qué fechas) en cada justificación. Funciona también
// para justificaciones viejas, porque se calcula desde el periodo_ref que toda fila ya guarda.
function _sr12ComparativoPorPeriodo(empresa_id, periodoRef) {
  var map = {};
  if (!periodoRef) return map;
  var impIds = {};
  String(periodoRef).split(',').forEach(function(s){ s = String(s).trim(); if (s) impIds[s] = true; });

  // Fecha (aplicado_at) de cada importación
  var shImp = getSheet('ImportacionesSR12');
  var fechaPorImp = {};
  if (shImp) {
    rowsToObjects(shImp).forEach(function(r){ if (impIds[r.id]) fechaPorImp[r.id] = String(r.aplicado_at || ''); });
  }
  // factor_a_base + unidad por clave (para reconstruir el $ del Excel)
  var shSR12 = getSheet('IngredientesSR12');
  var factorPorClave = {}, unidadPorClave = {};
  if (shSR12) {
    rowsToObjects(shSR12).filter(function(r){ return r.empresa_id === empresa_id; }).forEach(function(r){
      var f = parseFloat(r.factor_a_base);
      var k = String(r.clave_sr12 || '');
      if (k && f > 0) factorPorClave[k] = f;
      if (k) unidadPorClave[k] = r.unidad_base || '';
    });
  }
  // Detalles de esas importaciones → serie de costos por clave
  var shDet = getSheet('ImportacionDetalleSR12');
  if (!shDet) return map;
  rowsToObjects(shDet).forEach(function(d){
    if (!impIds[d.importacion_id]) return;
    var clave = String(d.clave_sr12 || '').trim();
    var costoBase = parseFloat(d.costo_nuevo) || 0;
    if (!clave || costoBase <= 0) return;
    var factor = factorPorClave[clave] || 1;
    var costo = Math.round(costoBase * factor * 100) / 100;
    if (!map[clave]) map[clave] = { periodos: [], unidad: unidadPorClave[clave] || '' };
    if (!map[clave].periodos.find(function(pp){ return pp.imp_id === d.importacion_id; })) {
      map[clave].periodos.push({ imp_id: d.importacion_id, raw: fechaPorImp[d.importacion_id] || '', fecha: String(fechaPorImp[d.importacion_id] || '').slice(0,10), costo: costo });
    }
  });
  // Ordenar cronológicamente y derivar anterior/nuevo
  Object.keys(map).forEach(function(clave){
    var ps = map[clave].periodos.sort(function(a,b){ return String(a.raw).localeCompare(String(b.raw)); });
    var n = ps.length;
    map[clave].costo_nue = n ? ps[n-1].costo : null;
    map[clave].fecha_nue = n ? ps[n-1].fecha : '';
    map[clave].costo_ant = n >= 2 ? ps[n-2].costo : null;
    map[clave].fecha_ant = n >= 2 ? ps[n-2].fecha : '';
    map[clave].serie = ps.map(function(pp){ return { fecha: pp.fecha, costo: pp.costo }; });
  });
  return map;
}

// Listar justificaciones del período más reciente (o el especificado)
function handleSr12JustificacionesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','auditoria','gerente_administrativo','comprador','gerente_plaza'].indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Sin permisos' };

  var sh = asegurarHoja('JustificacionesPrecios', JUSTIFICACIONES_COLS);
  var todas = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var periodoRef = p.periodo_ref || null;
  if (!periodoRef) {
    var sorted = todas.slice().sort(function(a,b){ return new Date(b.solicitado_at)-new Date(a.solicitado_at); });
    periodoRef = sorted.length ? sorted[0].periodo_ref : null;
  }
  if (!periodoRef) return { ok:true, items:[], pendientes:0, respondidas:0, periodo_ref:'' };

  var items = todas.filter(function(r){ return r.periodo_ref === periodoRef; });
  var sevOrd = {rojo:0,amarillo:1,verde:2};
  items.sort(function(a,b){
    if (!!a.justificacion !== !!b.justificacion) return a.justificacion ? 1 : -1;
    return (sevOrd[a.severidad]||0)-(sevOrd[b.severidad]||0);
  });
  var pendientes = items.filter(function(i){ return !i.justificacion; }).length;
  // Reconstruir fechas y montos comparados (de cuánto a cuánto) para dar contexto al comprador.
  var comp = _sr12ComparativoPorPeriodo(u.empresa_id, periodoRef);

  // Hilos de preguntas al comprador (PreciosCuestionamientos), agrupados por clave normalizada.
  // Se comparten con la Curva de Precios (mismo producto = misma conversación con Weslley).
  var qByClave = {}, cuestPend = 0;
  var shQ = getSheet('PreciosCuestionamientos');
  if (shQ) {
    rowsToObjects(shQ).filter(function(r){ return r.empresa_id === u.empresa_id; }).forEach(function(r){
      var k = sr12NormalizarClave(r.clave_sr12 || '');
      if (!qByClave[k]) qByClave[k] = [];
      qByClave[k].push({
        id:r.id, pregunta:r.pregunta||'',
        preguntado_por:r.preguntado_por||'', preguntado_at:String(r.preguntado_at||'').slice(0,16),
        respuesta:r.respuesta||'', respondido_por:r.respondido_por||'', respondido_at:String(r.respondido_at||'').slice(0,16),
        estado:String(r.estado||'pendiente')
      });
      if (String(r.estado||'pendiente') === 'pendiente') cuestPend++;
    });
  }

  return {
    ok:true,
    items: items.map(function(r){
      var c = comp[String(r.clave_sr12)] || {};
      return { id:r.id, clave:r.clave_sr12, nombre:r.nombre_sr12, categoria:r.categoria,
        cambio_pct:r.cambio_pct, severidad:r.severidad, justificacion:r.justificacion||'',
        justificado_por:r.justificado_por_email||'', justificado_at:String(r.justificado_at||'').slice(0,16),
        costo_ant: (c.costo_ant!=null?c.costo_ant:null), costo_nue: (c.costo_nue!=null?c.costo_nue:null),
        fecha_ant: c.fecha_ant||'', fecha_nue: c.fecha_nue||'', unidad: c.unidad||'',
        serie: c.serie||[],
        cuestionamientos: qByClave[sr12NormalizarClave(r.clave_sr12||'')] || [] };
    }),
    pendientes:pendientes, respondidas:items.length-pendientes, periodo_ref:periodoRef,
    cuest_pendientes: cuestPend
  };
}

// Comprador/admin: guarda una justificación individual
function handleSr12JustificacionSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','auditoria','comprador'].indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Sin permisos' };
  var id = String(p.id||'').trim();
  var justificacion = String(p.justificacion||'').trim();
  if (!id) return { ok:false, error:'id requerido' };
  if (justificacion.length < 5) return { ok:false, error:'Justificación demasiado corta (mínimo 5 caracteres)' };
  var sh = asegurarHoja('JustificacionesPrecios', JUSTIFICACIONES_COLS);
  var rows = rowsToObjects(sh);
  var rowIdx = -1;
  for (var i=0; i<rows.length; i++) { if (rows[i].id===id && rows[i].empresa_id===u.empresa_id){ rowIdx=i; break; } }
  if (rowIdx===-1) return { ok:false, error:'Registro no encontrado' };
  var hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var ahora = new Date();
  var shRow = rowIdx+2;
  var cj=hdrs.indexOf('justificacion')+1, cp=hdrs.indexOf('justificado_por_email')+1, ca=hdrs.indexOf('justificado_at')+1;
  if (cj) sh.getRange(shRow,cj).setValue(justificacion);
  if (cp) sh.getRange(shRow,cp).setValue(u.email);
  if (ca) sh.getRange(shRow,ca).setValue(ahora);
  return { ok:true };
}

// =====================================================================================
// F3 FASE C — IMPORTADOR DE COMPRAS SR12 (historial de precios reales por transacción)
// =====================================================================================
// Reporte fuente: "Compras detallado" del SR12 — un volcado encabezado+detalle (48 cols).
// El front (importar_compras.html) parsea el XLS con SheetJS y manda SOLO las columnas
// relevantes ya limpias. Aquí emparejamos cada línea con su ingrediente Fogueira por la
// clave SR12 y ACUMULAMOS en la hoja ComprasSR12 sin duplicar.
//
// Diferencia clave con el importador de EXISTENCIAS:
//   - Existencias = foto del inventario costeado → actualiza costos vigentes en Ingredientes.
//   - Compras     = transaccional (cada compra con fecha + proveedor + precio real pagado).
//                   NO toca costos vigentes; solo registra historial para la curva de precios.
//
// Dedup: una línea de compra única = idcompra + clave_sr12 + cantidad + costo_unitario.
// Re-subir el mismo archivo no duplica (modo acumular).

var COMPRAS_SR12_COLS = [
  'id','empresa_id','idcompra','folio','fecha','fecha_dia',
  'idproveedor','proveedor','clave_sr12','clave_sr12_raw','descripcion','grupo',
  'cantidad','costo_unitario','importe_sin_imp','impuesto','importe_con_imp',
  'foliofactura','ingrediente_id','tipo_match','dedup_key','importacion_id',
  'creado_at','creado_por'
];

var COMPRAS_SR12_IMPORT_COLS = [
  'id','empresa_id','archivo','lineas_archivo','lineas_nuevas','lineas_duplicadas',
  'lineas_sin_match','rango_desde','rango_hasta','importado_por','importado_at'
];

// Normaliza una clave SR12 quitando ceros a la izquierda, para que "001005" (reporte de
// compras) empate con "1005" (reporte de existencias / Ingredientes.clave_sr12). Ambas → "1005".
function sr12NormalizarClave(c) {
  var s = String(c == null ? '' : c).trim();
  if (!s) return '';
  return s.replace(/^0+(?=\d)/, '');
}

// Timestamp local 'YYYY-MM-DD HH:MM' (regla del proyecto: fecha local, no toISOString).
function _sr12AhoraLocalStr() {
  var d = new Date();
  function z(n){ return ('0' + n).slice(-2); }
  return d.getFullYear() + '-' + z(d.getMonth()+1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}

function handleSr12ComprasImportar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };

  var data;
  try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'Datos inválidos' }; }
  var lineas = data.lineas || [];
  var archivo = String(data.archivo || 'compras.xls');
  if (!lineas.length) return { ok:false, error:'El archivo no trae líneas de compra.' };

  // Hoja destino + dedup contra lo ya acumulado de esta empresa.
  var sh = asegurarHoja('ComprasSR12', COMPRAS_SR12_COLS);
  var existentes = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var dedupSet = {};
  existentes.forEach(function(r){ if (r.dedup_key) dedupSet[r.dedup_key] = true; });
  var totalAcumuladoPrevio = existentes.length;

  // Mapa de match: clave SR12 normalizada → ingrediente_id Fogueira.
  // Fuentes (en orden): tabla puente IngredientesSR12Match + clave_sr12 directa en Ingredientes.
  sr12AsegurarColumnaClaveEnIngredientes();
  var matchPorClave = {};
  rowsToObjects(asegurarHoja('IngredientesSR12Match',
    ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at']))
    .forEach(function(m){
      if (m.empresa_id === u.empresa_id && m.clave_sr12 && m.ingrediente_id_fogueira) {
        matchPorClave[sr12NormalizarClave(m.clave_sr12)] = m.ingrediente_id_fogueira;
      }
    });
  var shIng = getSheet('Ingredientes');
  if (shIng) {
    rowsToObjects(shIng).forEach(function(ing){
      if (ing.empresa_id === u.empresa_id && ing.clave_sr12) {
        var k = sr12NormalizarClave(ing.clave_sr12);
        if (!matchPorClave[k]) matchPorClave[k] = ing.id;
      }
    });
  }

  var importacionId = uuid();
  var creadoAt = _sr12AhoraLocalStr();
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  var nuevasFilas = [];
  var nuevas = 0, duplicadas = 0, canceladas = 0, conMatch = 0, sinMatchLineas = 0;
  var clavesSinMatch = {}, proveedores = {}, productos = {}, fechasDia = [];

  lineas.forEach(function(L){
    if (L.cancelado === true || String(L.cancelado).toUpperCase() === 'TRUE') { canceladas++; return; }
    var claveRaw = String(L.clave || '').trim();
    if (!claveRaw) return;
    var claveNorm = sr12NormalizarClave(claveRaw);
    var cantidad = num(L.cantidad), costo = num(L.costo);
    var idcompra = String(L.idcompra || '').trim();
    var dedupKey = idcompra + '|' + claveRaw + '|' + cantidad + '|' + costo;
    if (dedupSet[dedupKey]) { duplicadas++; return; }
    dedupSet[dedupKey] = true;

    var ingId = matchPorClave[claveNorm] || '';
    var tipoMatch = ingId ? 'clave' : 'sin_match';
    if (ingId) { conMatch++; } else { sinMatchLineas++; clavesSinMatch[claveNorm] = true; }

    var fecha = String(L.fecha || '').trim();      // 'YYYY-MM-DD HH:MM' (hora local, ya normalizada en el front)
    var fechaDia = fecha.slice(0,10);
    if (fechaDia) fechasDia.push(fechaDia);
    if (L.proveedor) proveedores[String(L.proveedor).trim()] = true;
    productos[claveNorm] = true;

    nuevasFilas.push([
      uuid(), u.empresa_id, idcompra, String(L.folio||''), fecha, fechaDia,
      String(L.idproveedor||''), String(L.proveedor||''), claveNorm, claveRaw,
      String(L.descripcion||''), String(L.grupo||''),
      cantidad, costo, num(L.importe_sin), num(L.impuesto), num(L.importe_con),
      String(L.foliofactura||''), ingId, tipoMatch, dedupKey, importacionId,
      creadoAt, u.email
    ]);
    nuevas++;
  });

  if (nuevasFilas.length) {
    sh.getRange(sh.getLastRow()+1, 1, nuevasFilas.length, COMPRAS_SR12_COLS.length).setValues(nuevasFilas);
  }

  fechasDia.sort();
  var rangoDesde = fechasDia.length ? fechasDia[0] : '';
  var rangoHasta = fechasDia.length ? fechasDia[fechasDia.length-1] : '';

  // Log de importación (para el historial y trazabilidad).
  var shLog = asegurarHoja('ComprasSR12Importaciones', COMPRAS_SR12_IMPORT_COLS);
  shLog.appendRow([
    importacionId, u.empresa_id, archivo, lineas.length, nuevas,
    duplicadas, sinMatchLineas, rangoDesde, rangoHasta, u.email, creadoAt
  ]);

  return {
    ok:true,
    resumen: {
      lineas_archivo: lineas.length,
      nuevas: nuevas,
      duplicadas: duplicadas,
      canceladas: canceladas,
      con_match: conMatch,
      sin_match_lineas: sinMatchLineas,
      sin_match_claves: Object.keys(clavesSinMatch).length,
      proveedores: Object.keys(proveedores).length,
      productos: Object.keys(productos).length,
      rango_desde: rangoDesde,
      rango_hasta: rangoHasta,
      total_acumulado: totalAcumuladoPrevio + nuevas
    }
  };
}

// Resumen (solo lectura) de lo ya acumulado en ComprasSR12 — para que la pantalla muestre el estado.
function handleSr12ComprasResumen(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };

  var sh = getSheet('ComprasSR12');
  if (!sh) return { ok:true, total:0, rango_desde:'', rango_hasta:'', proveedores:0, productos:0, sin_match_claves:0, ultimas_importaciones:[] };

  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var prov = {}, prod = {}, sinMatch = {}, fechas = [];
  rows.forEach(function(r){
    if (r.proveedor) prov[r.proveedor] = true;
    if (r.clave_sr12) prod[r.clave_sr12] = true;
    if (r.tipo_match === 'sin_match' && r.clave_sr12) sinMatch[r.clave_sr12] = true;
    var _fd = String(fechaToString(r.fecha_dia) || fechaToString(r.fecha) || '').slice(0,10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(_fd)) fechas.push(_fd);
  });
  fechas.sort();

  var ultimas = [];
  var log = getSheet('ComprasSR12Importaciones');
  if (log) {
    ultimas = rowsToObjects(log).filter(function(r){ return r.empresa_id === u.empresa_id; })
      .sort(function(a,b){ return String(b.importado_at).localeCompare(String(a.importado_at)); })
      .slice(0,6)
      .map(function(r){
        return { archivo:r.archivo, nuevas:r.lineas_nuevas, duplicadas:r.lineas_duplicadas,
          sin_match:r.lineas_sin_match, desde:_cancelDiaRobusto(r.rango_desde), hasta:_cancelDiaRobusto(r.rango_hasta),
          por:r.importado_por, at:String(r.importado_at).slice(0,16) };
      });
  }

  return {
    ok:true,
    total: rows.length,
    rango_desde: fechas.length ? fechas[0] : '',
    rango_hasta: fechas.length ? fechas[fechas.length-1] : '',
    proveedores: Object.keys(prov).length,
    productos: Object.keys(prod).length,
    sin_match_claves: Object.keys(sinMatch).length,
    ultimas_importaciones: ultimas
  };
}

// =====================================================================================
// ★ IMPORTADOR DE CANCELACIONES SR12 — prueba independiente del POS (Capa 3 del control de fuga) ★
// =====================================================================================
// El reporte de cancelaciones del SR12 (11 cols: seriefolio, numcheque, idmesero, mesero,
// comanda, cantidad, descripcion, razon, fecha, nombre, usuario) es el registro DURO de qué se
// canceló en el punto de venta — independiente de lo que la administración transcribe en la
// conciliación. NO trae monto en pesos ni el nombre de la persona (solo el rol SUBGERENTE/GERENTE).
// Se acumula sin duplicar (igual que compras) y luego se cruza con `ci_cancelaciones` por
// numcheque (= el "folio" que se captura en la conciliación). Lo sube Luis (admin).
var CANCEL_SR12_COLS = [
  'id','empresa_id','numcheque','idmesero','mesero','comanda','cantidad','descripcion',
  'razon','motivo','mesa','fecha','fecha_dia','usuario','autoriza_rol','es_caro',
  'dedup_key','importacion_id','creado_at','creado_por'
];
var CANCEL_SR12_IMPORT_COLS = [
  'id','empresa_id','archivo','lineas_archivo','lineas_nuevas','lineas_duplicadas',
  'caras','rango_desde','rango_hasta','importado_por','importado_at'
];

// Separa el motivo de la mesa: "ERROR DE CAPTURA Mesa: 23" → { motivo:'ERROR DE CAPTURA', mesa:'23' }.
function _cancelParseRazon(razon) {
  var r = String(razon == null ? '' : razon).trim();
  var mesa = '';
  var m = r.match(/mesa:\s*(\S+)\s*$/i);
  if (m) { mesa = m[1]; r = r.replace(/mesa:\s*\S+\s*$/i, '').trim(); }
  return { motivo: r || '(sin motivo)', mesa: mesa };
}
// Productos "caros" que importan para la fuga: rodizio, buffet, desayuno, duo.
function _cancelEsCaro(desc) {
  return /rodizio|buffet|bufet|desayuno|duo/i.test(String(desc || ''));
}

function handleSr12CancelacionesImportar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };

  var data;
  try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'Datos inválidos' }; }
  var lineas = data.lineas || [];
  var archivo = String(data.archivo || 'cancelaciones.xls');
  if (!lineas.length) return { ok:false, error:'El archivo no trae líneas de cancelación.' };

  var sh = asegurarHoja('CancelacionesSR12', CANCEL_SR12_COLS);
  var existentes = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var dedupSet = {};
  existentes.forEach(function(r){ if (r.dedup_key) dedupSet[r.dedup_key] = true; });
  var totalPrevio = existentes.length;

  var importacionId = uuid();
  var creadoAt = _sr12AhoraLocalStr();
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  var nuevasFilas = [];
  var nuevas = 0, duplicadas = 0, caras = 0, sinCheque = 0;
  var productos = {}, fechasDia = [];
  // El reporte SR12 lista cada UNIDAD cancelada en su propio renglón, así que un mismo cheque
  // puede traer N renglones idénticos (ej. 4 tragos iguales cancelados = 4 reales, no 1). Para no
  // colapsarlos, la dedup_key lleva un índice de ocurrencia DENTRO del archivo (#1, #2, …). Resubir
  // el mismo archivo regenera los mismos #1..#N → siguen empatando → idempotente (no duplica).
  var batchOcc = {};

  lineas.forEach(function(L){
    var numcheque = String(L.numcheque == null ? '' : L.numcheque).trim();
    var desc = String(L.descripcion == null ? '' : L.descripcion).trim();
    var fecha = String(L.fecha || '').trim();          // 'YYYY-MM-DD HH:MM' (normalizada en el front)
    if (!numcheque && !desc) return;                   // fila basura
    if (!numcheque) sinCheque++;
    var cantidad = num(L.cantidad);
    var razon = String(L.razon == null ? '' : L.razon).trim();
    var baseKey = numcheque + '|' + fecha + '|' + desc + '|' + cantidad + '|' + razon;
    batchOcc[baseKey] = (batchOcc[baseKey] || 0) + 1;
    var dedupKey = baseKey + '#' + batchOcc[baseKey];
    if (dedupSet[dedupKey]) { duplicadas++; return; }
    dedupSet[dedupKey] = true;

    var pr = _cancelParseRazon(razon);
    var esCaro = _cancelEsCaro(desc);
    if (esCaro) caras++;
    var fechaDia = fecha.slice(0, 10);
    if (fechaDia) fechasDia.push(fechaDia);
    productos[desc] = true;

    nuevasFilas.push([
      uuid(), u.empresa_id, numcheque,
      String(L.idmesero||''), String(L.mesero||''), String(L.comanda||''),
      cantidad, desc, razon, pr.motivo, pr.mesa,
      fecha, fechaDia, String(L.usuario||''), String(L.nombre||''), esCaro,
      dedupKey, importacionId, creadoAt, u.email
    ]);
    nuevas++;
  });

  if (nuevasFilas.length) {
    sh.getRange(sh.getLastRow()+1, 1, nuevasFilas.length, CANCEL_SR12_COLS.length).setValues(nuevasFilas);
  }

  fechasDia.sort();
  var rangoDesde = fechasDia.length ? fechasDia[0] : '';
  var rangoHasta = fechasDia.length ? fechasDia[fechasDia.length-1] : '';

  var shLog = asegurarHoja('CancelacionesSR12Importaciones', CANCEL_SR12_IMPORT_COLS);
  shLog.appendRow([
    importacionId, u.empresa_id, archivo, lineas.length, nuevas,
    duplicadas, caras, rangoDesde, rangoHasta, u.email, creadoAt
  ]);

  return {
    ok:true,
    resumen: {
      lineas_archivo: lineas.length,
      nuevas: nuevas,
      duplicadas: duplicadas,
      caras: caras,
      sin_cheque: sinCheque,
      productos: Object.keys(productos).length,
      rango_desde: rangoDesde,
      rango_hasta: rangoHasta,
      total_acumulado: totalPrevio + nuevas
    }
  };
}

// Resumen (solo lectura) de lo acumulado en CancelacionesSR12 — para la pantalla del importador.
function handleSr12CancelacionesResumen(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };

  var sh = getSheet('CancelacionesSR12');
  if (!sh) return { ok:true, total:0, caras:0, productos:0, rango_desde:'', rango_hasta:'', ultimas_importaciones:[] };

  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var prod = {}, fechas = [], caras = 0;
  rows.forEach(function(r){
    if (r.descripcion) prod[r.descripcion] = true;
    if (r.es_caro === true || String(r.es_caro).toUpperCase() === 'TRUE') caras++;
    var fd = String(fechaToString(r.fecha_dia) || '').slice(0,10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fd)) fechas.push(fd);
  });
  fechas.sort();

  var ultimas = [];
  var log = getSheet('CancelacionesSR12Importaciones');
  if (log) {
    ultimas = rowsToObjects(log).filter(function(r){ return r.empresa_id === u.empresa_id; })
      .sort(function(a,b){ return String(b.importado_at).localeCompare(String(a.importado_at)); })
      .slice(0,6)
      .map(function(r){
        return { archivo:r.archivo, nuevas:r.lineas_nuevas, duplicadas:r.lineas_duplicadas,
          caras:r.caras, desde:_cancelDiaRobusto(r.rango_desde), hasta:_cancelDiaRobusto(r.rango_hasta),
          por:r.importado_por, at:String(r.importado_at).slice(0,16) };
      });
  }

  return {
    ok:true,
    total: rows.length,
    caras: caras,
    productos: Object.keys(prod).length,
    rango_desde: fechas.length ? fechas[0] : '',
    rango_hasta: fechas.length ? fechas[fechas.length-1] : '',
    ultimas_importaciones: ultimas
  };
}

// Vacía el historial de cancelaciones SR12 de la empresa (para re-subir limpio). Solo admin/auditoría.
// Conserva filas de OTRAS empresas. Limpia también el log de importaciones.
function handleSr12CancelacionesReset(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Solo Admin o Auditoría puede vaciar el historial' };
  var borrados = 0;
  ['CancelacionesSR12','CancelacionesSR12Importaciones'].forEach(function(nombre){
    var sh = getSheet(nombre);
    if (!sh || sh.getLastRow() < 2) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var rows = rowsToObjects(sh);
    var keep = rows.filter(function(r){ return r.empresa_id !== u.empresa_id; });
    borrados += (rows.length - keep.length);
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    if (keep.length) {
      var vals = keep.map(function(r){ return headers.map(function(h){ return r[h] !== undefined ? r[h] : ''; }); });
      sh.getRange(2, 1, vals.length, headers.length).setValues(vals);
    }
  });
  return { ok:true, borrados: borrados };
}

// =====================================================================================
// ★ IMPORTADOR DE VENTAS SR12 (productos vendidos) — insumo del "Cuadre de Barra" ★
// =====================================================================================
// El reporte "Productos Vendidos" del SR12 lista, por periodo, cada producto con su CANTIDAD
// vendida y VENTA_TOTAL (cols: CLAVE, DESCRIPCION, GRUPO, PRECIO, CANTIDAD, VENTA_TOTAL, …).
// A diferencia de cancelaciones/compras (un renglón = una transacción), aquí cada renglón es el
// AGREGADO del producto en TODO el periodo del reporte (el rango va en el título, no por fila).
// Por eso el modelo es "REEMPLAZAR POR PERIODO": un archivo = un periodo (desde→hasta); al re-subir
// el mismo periodo se borran sus filas previas y se reinsertan (idempotente, no duplica ni suma 49+49).
// Subir cortes SEMANALES (lun→dom); NO mezclar con un corte mensual que los solape.
// Sirve para el Cuadre de Barra: ventas × receta (consumo teórico) vs inventario real.
var VENTAS_SR12_COLS = [
  'id','empresa_id','clave','clave_norm','descripcion','grupo','precio','cantidad','venta_total',
  'periodo_desde','periodo_hasta','importacion_id','creado_at','creado_por'
];
var VENTAS_SR12_IMPORT_COLS = [
  'id','empresa_id','archivo','lineas_archivo','productos','unidades','venta_total',
  'periodo_desde','periodo_hasta','reemplazadas','importado_por','importado_at'
];

function handleSr12VentasImportar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };

  var data;
  try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'Datos inválidos' }; }
  var lineas = data.lineas || [];
  var archivo = String(data.archivo || 'ventas.xls');
  var periodoDesde = String(data.periodo_desde || '').slice(0,10);
  var periodoHasta = String(data.periodo_hasta || '').slice(0,10);
  if (!lineas.length) return { ok:false, error:'El archivo no trae líneas de venta.' };
  if (!periodoDesde || !periodoHasta) {
    return { ok:false, error:'No se detectó el periodo del reporte (la fecha "DEL ... AL ..." del encabezado). Revisa que sea el reporte de Productos Vendidos completo.' };
  }

  var sh = asegurarHoja('VentasSR12', VENTAS_SR12_COLS);
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  // Modelo reemplazar-por-periodo: quitar filas previas de esta empresa con el MISMO periodo.
  var todas = rowsToObjects(sh);
  var conservar = todas.filter(function(r){
    if (r.empresa_id !== u.empresa_id) return true;                 // de otra empresa: intacto
    var d = String(fechaToString(r.periodo_desde) || r.periodo_desde || '').slice(0,10);
    var h = String(fechaToString(r.periodo_hasta) || r.periodo_hasta || '').slice(0,10);
    return !(d === periodoDesde && h === periodoHasta);             // mismo periodo: se reemplaza
  });
  var reemplazadas = todas.length - conservar.length;

  var importacionId = uuid();
  var creadoAt = _sr12AhoraLocalStr();

  var nuevasFilas = [];
  var unidades = 0, ventaTotal = 0;
  var claves = {};
  lineas.forEach(function(L){
    var clave = String(L.clave == null ? '' : L.clave).trim();
    var desc = String(L.descripcion == null ? '' : L.descripcion).trim();
    if (!clave || !/^\d+$/.test(clave)) return;     // sólo renglones con clave numérica (descarta totales/basura)
    if (!desc) return;
    var cant = num(L.cantidad);
    var venta = num(L.venta_total);
    unidades += cant; ventaTotal += venta; claves[clave] = true;
    nuevasFilas.push([
      uuid(), u.empresa_id, clave, sr12NormalizarClave(clave), desc,
      String(L.grupo||''), num(L.precio), cant, venta,
      periodoDesde, periodoHasta, importacionId, creadoAt, u.email
    ]);
  });

  if (!nuevasFilas.length) return { ok:false, error:'No se detectaron productos con clave válida en el archivo.' };

  // Reescribir la hoja: cabecera + (conservadas) + nuevas.
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow()-1, VENTAS_SR12_COLS.length).clearContent();
  var headers = VENTAS_SR12_COLS;
  var filasConservadas = conservar.map(function(r){ return headers.map(function(h){ return r[h] !== undefined ? r[h] : ''; }); });
  var todasFilas = filasConservadas.concat(nuevasFilas);
  if (todasFilas.length) sh.getRange(2, 1, todasFilas.length, headers.length).setValues(todasFilas);

  var shLog = asegurarHoja('VentasSR12Importaciones', VENTAS_SR12_IMPORT_COLS);
  shLog.appendRow([
    importacionId, u.empresa_id, archivo, lineas.length, Object.keys(claves).length,
    unidades, ventaTotal, periodoDesde, periodoHasta, reemplazadas, u.email, creadoAt
  ]);

  return {
    ok:true,
    resumen: {
      lineas_archivo: lineas.length,
      productos: Object.keys(claves).length,
      unidades: unidades,
      venta_total: ventaTotal,
      periodo_desde: periodoDesde,
      periodo_hasta: periodoHasta,
      reemplazadas: reemplazadas,
      total_acumulado: conservar.filter(function(r){ return r.empresa_id === u.empresa_id; }).length + nuevasFilas.length
    }
  };
}

// Resumen (solo lectura) de lo acumulado en VentasSR12 — para la pantalla del importador.
function handleSr12VentasResumen(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };

  var sh = getSheet('VentasSR12');
  if (!sh) return { ok:true, total:0, productos:0, unidades:0, venta_total:0, periodos:[], por_grupo:[], rango_desde:'', rango_hasta:'', ultimas_importaciones:[] };

  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var claves = {}, fechas = [], grupos = {}, periodos = {};
  var unidades = 0, ventaTotal = 0;
  rows.forEach(function(r){
    if (r.clave) claves[String(r.clave)] = true;
    var cant = parseFloat(r.cantidad)||0, venta = parseFloat(r.venta_total)||0;
    unidades += cant; ventaTotal += venta;
    var g = String(r.grupo||'(sin grupo)');
    if (!grupos[g]) grupos[g] = { grupo:g, productos:0, unidades:0, venta:0 };
    grupos[g].productos++; grupos[g].unidades += cant; grupos[g].venta += venta;
    var d = String(fechaToString(r.periodo_desde) || r.periodo_desde || '').slice(0,10);
    var h = String(fechaToString(r.periodo_hasta) || r.periodo_hasta || '').slice(0,10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) fechas.push(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(h)) fechas.push(h);
    var pk = d + '|' + h;
    if (!periodos[pk]) periodos[pk] = { desde:d, hasta:h, productos:0, unidades:0, venta:0 };
    periodos[pk].productos++; periodos[pk].unidades += cant; periodos[pk].venta += venta;
  });
  fechas.sort();

  var ultimas = [];
  var log = getSheet('VentasSR12Importaciones');
  if (log) {
    ultimas = rowsToObjects(log).filter(function(r){ return r.empresa_id === u.empresa_id; })
      .sort(function(a,b){ return String(b.importado_at).localeCompare(String(a.importado_at)); })
      .slice(0,6)
      .map(function(r){
        return { archivo:r.archivo, productos:r.productos, unidades:r.unidades,
          venta:r.venta_total, desde:_cancelDiaRobusto(r.periodo_desde), hasta:_cancelDiaRobusto(r.periodo_hasta),
          reemplazadas:r.reemplazadas, por:r.importado_por, at:String(r.importado_at).slice(0,16) };
      });
  }

  return {
    ok:true,
    total: rows.length,
    productos: Object.keys(claves).length,
    unidades: unidades,
    venta_total: ventaTotal,
    rango_desde: fechas.length ? fechas[0] : '',
    rango_hasta: fechas.length ? fechas[fechas.length-1] : '',
    por_grupo: Object.keys(grupos).sort().map(function(k){ return grupos[k]; }),
    periodos: Object.keys(periodos).sort().map(function(k){ return periodos[k]; }),
    ultimas_importaciones: ultimas
  };
}

// Vacía el historial de ventas SR12 de la empresa (para re-subir limpio). Solo admin/auditoría.
function handleSr12VentasReset(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Solo Admin o Auditoría puede vaciar el historial' };
  var borrados = 0;
  ['VentasSR12','VentasSR12Importaciones'].forEach(function(nombre){
    var sh = getSheet(nombre);
    if (!sh || sh.getLastRow() < 2) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var rows = rowsToObjects(sh);
    var keep = rows.filter(function(r){ return r.empresa_id !== u.empresa_id; });
    borrados += (rows.length - keep.length);
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    if (keep.length) {
      var vals = keep.map(function(r){ return headers.map(function(h){ return r[h] !== undefined ? r[h] : ''; }); });
      sh.getRange(2, 1, vals.length, headers.length).setValues(vals);
    }
  });
  return { ok:true, borrados: borrados };
}

// =====================================================================================
// ★ TABLERO DIRECTIVO — pestaña "Barra: ventas y mix" (Vista A del Cuadre de Barra) ★
// =====================================================================================
// Lee VentasSR12 y arma el resumen de ventas de bebidas para el Tablero Directivo: KPIs,
// desglose por grupo (alcohólicas/vinos/sin alcohol/modificadores) y top de productos.
// Esto es lo que se puede mostrar HOY (sin recetas); cuando lleguen las recetas crece a
// "Cuadre de Barra" (teórico vs real). Solo lectura. Roles del Tablero.
function handleDireccionVentasBarra(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_plaza','auditoria'])) return { ok:false, error:'Sin permisos' };

  var sh = getSheet('VentasSR12');
  if (!sh) return { ok:true, sin_datos:true, periodos:[], kpis:{venta:0,unidades:0,productos:0}, por_grupo:[], top:[] };

  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  if (!rows.length) return { ok:true, sin_datos:true, periodos:[], kpis:{venta:0,unidades:0,productos:0}, por_grupo:[], top:[] };

  function diaStr(x){ return String(fechaToString(x) || x || '').slice(0,10); }
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  // Lista de periodos cargados (para el selector) con sus totales.
  var periodosMap = {};
  rows.forEach(function(r){
    var d = diaStr(r.periodo_desde), h = diaStr(r.periodo_hasta);
    var pk = d + '|' + h;
    if (!periodosMap[pk]) periodosMap[pk] = { clave:pk, desde:d, hasta:h, unidades:0, venta:0 };
    periodosMap[pk].unidades += num(r.cantidad);
    periodosMap[pk].venta += num(r.venta_total);
  });
  var periodos = Object.keys(periodosMap).map(function(k){ return periodosMap[k]; })
    .sort(function(a,b){ return String(b.desde).localeCompare(String(a.desde)); });

  // Filtro de periodo: 'todos' (default) o 'desde|hasta'.
  var filtro = String(p.periodo || 'todos');
  var usar = rows;
  if (filtro && filtro !== 'todos' && filtro.indexOf('|') !== -1) {
    var parts = filtro.split('|'); var fd = parts[0], fh = parts[1];
    usar = rows.filter(function(r){ return diaStr(r.periodo_desde) === fd && diaStr(r.periodo_hasta) === fh; });
  }

  // Agregar por clave (un producto puede estar en varios periodos si el filtro es 'todos').
  var porClave = {}, grupos = {};
  var ventaTotal = 0, unidadesTotal = 0;
  usar.forEach(function(r){
    var clave = String(r.clave || '');
    var cant = num(r.cantidad), venta = num(r.venta_total);
    ventaTotal += venta; unidadesTotal += cant;
    var g = String(r.grupo || '(sin grupo)');
    if (!grupos[g]) grupos[g] = { grupo:g, productos:0, unidades:0, venta:0 };
    if (!porClave[clave]) {
      porClave[clave] = { clave:clave, descripcion:String(r.descripcion||''), grupo:g, unidades:0, venta:0 };
      grupos[g].productos++;
    }
    porClave[clave].unidades += cant;
    porClave[clave].venta += venta;
    grupos[g].unidades += cant;
    grupos[g].venta += venta;
  });

  var porGrupo = Object.keys(grupos).map(function(k){
    var x = grupos[k];
    x.pct = ventaTotal > 0 ? Math.round(x.venta / ventaTotal * 1000) / 10 : 0;
    return x;
  }).sort(function(a,b){ return b.venta - a.venta; });

  var topN = Math.min(Math.max(parseInt(p.top || 30, 10) || 30, 5), 100);
  var top = Object.keys(porClave).map(function(k){
    var x = porClave[k];
    x.precio_prom = x.unidades > 0 ? Math.round(x.venta / x.unidades) : 0;
    return x;
  }).sort(function(a,b){ return b.venta - a.venta; }).slice(0, topN);

  return {
    ok:true,
    sin_datos:false,
    filtro: filtro,
    periodos: periodos,
    kpis: { venta: ventaTotal, unidades: unidadesTotal, productos: Object.keys(porClave).length },
    por_grupo: porGrupo,
    top: top
  };
}

// =====================================================================================
// ★ ALERTA DE VENTA BAJO COSTO — bebidas embotelladas (v409) ★
// =====================================================================================
// Cruza VentasSR12 (precio de venta del POS) con el costo del INSUMO-botella (Ingredientes
// unit 'pza', cargado del SR12). Empata por nombre normalizado (token overlap). Marca:
//   🔴 rojo  = precio_venta <= costo (vende bajo costo)
//   🟡 bajo  = margen < umbral_bajo% (sospechoso; puede ser costo que subió)
//   🟡 alto  = margen > umbral_alto% (costo probablemente DESACTUALIZADO/mal — margen irreal)
// ⚠️ Usa el COSTO DEL SISTEMA: si el costo está viejo, un alza real NO se ve (hay que mantener
// los costos al día con el import de Existencias SR12). Por eso muestra el costo y su origen para
// verificar contra factura. Solo lectura. Roles del Tablero.
function _barraNormNombre(s){
  s = String(s||'').toLowerCase();
  s = s.replace(/v\.?\s*[a-z]\.?/g,' ');                          // prefijos V.T./V.E./V.R./V.B.
  s = s.replace(/\b(bot|botella|copa|jarra|750|375|1500|187|ml|cl|lt|the|de|la|el|con)\b/g,' ');
  s = s.replace(/[^a-z0-9 ]/g,' ');
  return s.replace(/\s+/g,' ').trim();
}
function handleBarraAlertaBajoCosto(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_plaza','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };
  function _n(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return _barraAlertaBajoCostoCore(u.empresa_id, _n(p.umbral_bajo) || 35, _n(p.umbral_alto) || 88);
}

// Núcleo sin token: cruza VentasSR12 vs costo del insumo-botella (pza) y marca las botellas
// vendidas bajo costo / margen sospechoso. Lo reusan el handler del Tablero y el auditor matutino
// (pendiente a gte_admin sobre botellas vendidas bajo costo). Solo lectura.
function _barraAlertaBajoCostoCore(empresaId, umbralBajo, umbralAlto){
  var shV = getSheet('VentasSR12');
  if (!shV) return { ok:true, sin_datos:true, items:[], sin_match:[], resumen:{} };
  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  umbralBajo = umbralBajo || 35;
  umbralAlto = umbralAlto || 88;

  // 1) Agregar ventas por clave → precio promedio.
  var porClave = {};
  rowsToObjects(shV).forEach(function(r){
    if (r.empresa_id !== empresaId) return;
    var clave = String(r.clave||'').trim(); if (!clave) return;
    if (!porClave[clave]) porClave[clave] = { clave:clave, descripcion:String(r.descripcion||''), grupo:String(r.grupo||''), unidades:0, venta:0 };
    porClave[clave].unidades += num(r.cantidad);
    porClave[clave].venta    += num(r.venta_total);
  });

  // 2) Insumos-botella (unit pza, activos) con su token-set normalizado.
  var ingNorm = rowsToObjects(getSheet('Ingredientes'))
    .filter(function(i){ return i.empresa_id === empresaId && esActivo(i.activo) && String(i.unidad_base||'').toLowerCase() === 'pza'; })
    .map(function(i){ return { ing:i, toks:_barraNormNombre(i.nombre).split(' ').filter(Boolean) }; });

  // 3) Por cada producto vendido que parezca botella, empatar + calcular margen.
  var items = [], sinMatch = [];
  Object.keys(porClave).forEach(function(k){
    var v = porClave[k];
    if (!/\bbot\b|\d+\s*ml|\d+\s*lt/i.test(v.descripcion)) return;   // solo botellas
    var precio = v.unidades > 0 ? v.venta / v.unidades : 0;
    var nb = _barraNormNombre(v.descripcion).split(' ').filter(Boolean);
    var saleAlc = /vinos|alcohol/i.test(v.grupo);   // venta es bebida alcohólica (vino/licor/cerveza)
    var cand = [];
    ingNorm.forEach(function(c){
      if (!c.toks.length || !nb.length) return;
      // Guardas anti-falso-positivo: una bebida alcohólica NO empata con agua, y un
      // refresco/agua NO empata con un vino (insumo que empieza con V.T./V.E./…).
      if (saleAlc && /agua/i.test(c.ing.nombre)) return;
      if (!saleAlc && /^v\.?\s*[a-z]/i.test(String(c.ing.nombre||''))) return;
      var setb = {}; nb.forEach(function(t){ setb[t] = 1; });
      var overlap = c.toks.filter(function(t){ return setb[t]; });
      // Un solo token en común solo cuenta si es distintivo (≥5 caracteres) — evita
      // empates frágiles por palabras cortas/genéricas.
      var maxLen = overlap.reduce(function(m,t){ return Math.max(m, t.length); }, 0);
      if (overlap.length < 2 && maxLen < 5) return;
      var score = overlap.length / Math.min(nb.length, c.toks.length);
      cand.push({ ing: c.ing, score: score });
    });
    cand.sort(function(a,b){ return b.score - a.score; });
    var best = cand.length ? cand[0].ing : null;
    var bestScore = cand.length ? cand[0].score : 0;
    if (!best || bestScore < 0.5) { sinMatch.push({ clave:v.clave, descripcion:v.descripcion, precio:Math.round(precio), unidades:v.unidades }); return; }
    // Guard de AMBIGÜEDAD (reporte de Luis 2026-06-19, caso "Catena Alta" vs "Catena Malbec"): si otro
    // insumo DISTINTO empata casi igual de bien (score dentro de 0.12) pero con costo muy diferente,
    // no se puede saber cuál se vendió → NO se levanta bandera (mejor callar que dar falsa alarma).
    var costoBest = num(best.precio_real_unitario);
    var ambiguo = cand.some(function(m){
      if (m.ing.id === best.id || (bestScore - m.score) > 0.12) return false;
      var cm = num(m.ing.precio_real_unitario);
      return Math.abs(cm - costoBest) > Math.max(50, costoBest * 0.15);
    });
    if (ambiguo) { sinMatch.push({ clave:v.clave, descripcion:v.descripcion, precio:Math.round(precio), unidades:v.unidades, nota:'varios productos con nombre parecido y costo distinto (no se sabe cuál se vendió)' }); return; }
    var costo = costoBest;
    if (costo <= 0) { sinMatch.push({ clave:v.clave, descripcion:v.descripcion, precio:Math.round(precio), unidades:v.unidades, nota:'insumo sin costo' }); return; }
    var margen = precio > 0 ? (precio - costo) / precio * 100 : 0;
    var sev = 'ok';
    if (precio <= costo)        sev = 'rojo';
    else if (margen < umbralBajo) sev = 'amarillo_bajo';
    else if (margen > umbralAlto) sev = 'amarillo_alto';
    items.push({ clave:v.clave, descripcion:v.descripcion, grupo:v.grupo, unidades:v.unidades,
      precio:Math.round(precio), insumo:best.nombre, insumo_id:best.id, costo:Math.round(costo*100)/100,
      margen:Math.round(margen), match:Math.round(bestScore*100),
      origen:String(best.precio_origen||''), sev:sev });
  });

  var rank = { rojo:0, amarillo_bajo:1, amarillo_alto:2, ok:3 };
  items.sort(function(a,b){ return (rank[a.sev]-rank[b.sev]) || (a.margen-b.margen); });
  var resumen = {
    total: items.length,
    rojo: items.filter(function(x){ return x.sev==='rojo'; }).length,
    amarillo: items.filter(function(x){ return x.sev.indexOf('amarillo')===0; }).length,
    ok: items.filter(function(x){ return x.sev==='ok'; }).length,
    sin_match: sinMatch.length
  };
  return { ok:true, items:items, sin_match:sinMatch, resumen:resumen, umbrales:{ bajo:umbralBajo, alto:umbralAlto } };
}

// =====================================================================================
// ★ CRUCE: cancelaciones SR12 (POS, independiente) vs documentadas en la conciliación ★
// =====================================================================================
// Para el Tablero Directivo (Paso 2 de la Capa 3). Lee `CancelacionesSR12` (la verdad del POS)
// y la cruza con `ci_cancelaciones` de `Conciliaciones` (lo que Luis documenta) por
// numcheque == folio (Germán confirmó que son el mismo número), con fecha cercana (±2 días, por
// el día lógico que arranca a las 3am). Marca en ROJO las CARAS (rodizio/buffet) NO documentadas
// — las sospechosas de fuga. Solo lectura. Roles: los del Tablero Directivo.
function _cancelDiaRobusto(x) {
  if (x == null || x === '') return '';
  if (Object.prototype.toString.call(x) === '[object Date]') return fechaToString(x);
  var m = String(x).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}
function _cancelHoraRobusta(x) {
  if (x == null || x === '') return '';
  if (Object.prototype.toString.call(x) === '[object Date]') {
    return ('0'+x.getHours()).slice(-2)+':'+('0'+x.getMinutes()).slice(-2);
  }
  var m = String(x).match(/(\d{2}:\d{2})/);
  return m ? m[1] : '';
}
function _cancelDiffDias(a, b) {
  if (!a || !b) return 9999;
  var da = new Date(a+'T00:00:00'), db = new Date(b+'T00:00:00');
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 9999;
  return Math.abs((da - db) / 86400000);
}

function handleDireccionCancelacionesSr12(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_plaza','auditoria'])) return { ok:false, error:'Sin permisos' };
  return _cancelacionesSr12Core(u.empresa_id, p.fecha_desde, p.fecha_hasta);
}
// Núcleo sin token del cruce de cancelaciones SR12 vs documentadas (§07). Lo reusa el auditor
// matutino para los pendientes del gerente administrativo (Luis). Solo lectura.
function _cancelacionesSr12Core(empresaId, desde, hasta) {
  desde = String(desde || '').trim();
  hasta = String(hasta || '').trim();

  var sh = getSheet('CancelacionesSR12');
  var resumenVacio = { total:0, caras:0, sin_documentar:0, caras_sin_documentar:0, documentadas:0, por_mesero:{}, por_producto:{}, rango_desde:'', rango_hasta:'' };
  if (!sh) return { ok:true, resumen: resumenVacio, detalle:[], nota:'Aún no se han importado cancelaciones del SR12. Súbelas desde el importador.' };

  var cancel = rowsToObjects(sh).filter(function(r){
    if (r.empresa_id !== empresaId) return false;
    var d = _cancelDiaRobusto(r.fecha_dia) || _cancelDiaRobusto(r.fecha);
    if (desde && d && d < desde) return false;
    if (hasta && d && d > hasta) return false;
    return true;
  });

  // Folios documentados (de ci_cancelaciones) → mapa folio normalizado → [ {fecha, detalle...} ].
  var docByFolio = {};
  rowsToObjects(getSheet('Conciliaciones')).forEach(function(c){
    if (c.empresa_id !== empresaId) return;
    var payload = {}; try { payload = JSON.parse(c.payload_json || '{}'); } catch(e){ return; }
    var arr = Array.isArray(payload.ci_cancelaciones) ? payload.ci_cancelaciones : [];
    var fconc = fechaToString(c.fecha);
    arr.forEach(function(x){
      var folio = String(x.folio||'').trim();
      if (!folio) return;
      var key = folio.replace(/^0+(?=\d)/, '');
      if (!docByFolio[key]) docByFolio[key] = [];
      docByFolio[key].push({
        fecha: fconc, prod_orig: String(x.prod_orig||''), monto_orig: Number(x.monto_orig)||0,
        prod_nuevo: String(x.prod_nuevo||''), monto_nuevo: Number(x.monto_nuevo)||0,
        forma_pago: String(x.forma_pago||''), motivo: String(x.motivo||''),
        autoriza: String(x.autoriza||''), autorizada: !!(x.autoriza && String(x.autoriza).trim())
      });
    });
  });

  var resumen = { total:0, caras:0, sin_documentar:0, caras_sin_documentar:0, documentadas:0, por_mesero:{}, por_producto:{}, rango_desde:'', rango_hasta:'' };
  var detalle = [];
  var fechasDia = [];
  cancel.forEach(function(r){
    var numcheque = String(r.numcheque||'').trim();
    var key = numcheque.replace(/^0+(?=\d)/, '');
    var diaR = _cancelDiaRobusto(r.fecha_dia) || _cancelDiaRobusto(r.fecha);
    if (diaR) fechasDia.push(diaR);
    var esCaro = (r.es_caro === true || String(r.es_caro).toUpperCase() === 'TRUE');
    var docs = docByFolio[key] || [];
    var matched = null;
    for (var i=0;i<docs.length;i++){ if (_cancelDiffDias(docs[i].fecha, diaR) <= 2) { matched = docs[i]; break; } }
    var documentado = !!matched;

    resumen.total++;
    if (esCaro) resumen.caras++;
    if (documentado) resumen.documentadas++; else resumen.sin_documentar++;
    if (esCaro && !documentado) resumen.caras_sin_documentar++;
    var mes = String(r.mesero||'').trim() || '(sin mesero)';
    resumen.por_mesero[mes] = (resumen.por_mesero[mes]||0)+1;
    if (esCaro) { var pd = String(r.descripcion||'').trim(); resumen.por_producto[pd] = (resumen.por_producto[pd]||0)+1; }

    detalle.push({
      fecha: diaR,
      hora: _cancelHoraRobusta(r.fecha),
      numcheque: numcheque,
      mesero: String(r.mesero||''),
      descripcion: String(r.descripcion||''),
      cantidad: Number(r.cantidad)||0,
      motivo: String(r.motivo||''),
      mesa: String(r.mesa||''),
      usuario: String(r.usuario||''),
      es_caro: esCaro,
      documentado: documentado,
      doc: matched
    });
  });

  fechasDia.sort();
  resumen.rango_desde = fechasDia.length ? fechasDia[0] : '';
  resumen.rango_hasta = fechasDia.length ? fechasDia[fechasDia.length-1] : '';

  // Orden: caras sin documentar primero; luego por fecha/hora desc.
  detalle.sort(function(a,b){
    var sa = (a.es_caro && !a.documentado) ? 0 : 1, sb = (b.es_caro && !b.documentado) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    if (a.fecha !== b.fecha) return String(b.fecha).localeCompare(String(a.fecha));
    return String(b.hora||'').localeCompare(String(a.hora||''));
  });

  return { ok:true, resumen: resumen, detalle: detalle, fecha_desde: desde, fecha_hasta: hasta };
}

// =====================================================================================
// F3 FASE C.2 — CURVA DE PRECIOS POR PROVEEDOR
// =====================================================================================
// Lee la hoja ComprasSR12 (historial transaccional acumulado por el importador de compras)
// y arma la serie de precios en el tiempo, separada por proveedor, para graficar la curva.
// Solo lectura — NO está en MUTATING_ACTIONS.
//
// El costo que guarda el importador de compras (costo_unitario) ya viene en la unidad de
// compra del SR12 (ej. $/kg), tal cual lo muestra el Excel — NO se divide por factor_a_base
// como en existencias. Por eso aquí se grafica directo, sin conversiones.
//
// Dos modos:
//   - sin 'clave'  → lista de productos (para el selector): un registro por clave_sr12 con
//                    resumen (n compras, n proveedores, primer/último costo, variación total).
//   - con 'clave'  → detalle de un producto: puntos {fecha, costo, cantidad} agrupados por
//                    proveedor + min/max/promedio/último por proveedor + resumen global.
function handleSr12ComprasCurva(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria','gerente_plaza'])) return { ok:false, error:'Sin permisos' };

  var sh = getSheet('ComprasSR12');
  if (!sh) return { ok:true, productos:[] };

  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  if (!rows.length) return { ok:true, productos:[] };

  // Hilos de "cuestionamiento de precios" por clave SR12 (Gerente de Plaza/auditoría ↔ comprador).
  var hilosPrecio = {};
  (function(){
    var shQ = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PreciosCuestionamientos');
    if (!shQ) return;
    rowsToObjects(shQ).forEach(function(q){
      if (q.empresa_id !== u.empresa_id) return;
      var k = sr12NormalizarClave(q.clave_sr12);
      if (!hilosPrecio[k]) hilosPrecio[k] = [];
      hilosPrecio[k].push({
        id: q.id, pregunta: q.pregunta, preguntado_por: q.preguntado_por, preguntado_at: String(q.preguntado_at||''),
        respuesta: q.respuesta||'', respondido_por: q.respondido_por||'', respondido_at: String(q.respondido_at||''),
        estado: q.estado||'pendiente'
      });
    });
  })();
  function pendDe(claveNorm){ return (hilosPrecio[claveNorm]||[]).filter(function(q){ return q.estado==='pendiente'; }).length; }
  var totalPendPrecio = 0;
  Object.keys(hilosPrecio).forEach(function(k){ totalPendPrecio += pendDe(k); });

  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  // Fecha robusta a 'YYYY-MM-DD': Sheets a veces devuelve la celda como objeto Date (no texto).
  // fechaToString convierte Date→ISO y deja strings como están; recortamos a 10 por si trae hora.
  function diaStr(v){
    var s = fechaToString(v);
    s = String(s || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  function fechaDeFila(r){ return diaStr(r.fecha_dia) || diaStr(r.fecha); }

  // Mapa ingrediente_id → nombre + unidad_base (para etiquetar productos vinculados a recetas).
  var ingMap = {};
  var shIng = getSheet('Ingredientes');
  if (shIng) {
    rowsToObjects(shIng).forEach(function(ing){
      if (ing.empresa_id === u.empresa_id) ingMap[ing.id] = { nombre: ing.nombre, unidad: ing.unidad_base };
    });
  }

  var claveSel = String(p.clave || '').trim();

  // ── MODO DETALLE: una clave concreta → serie por proveedor ──
  if (claveSel) {
    var claveNorm = sr12NormalizarClave(claveSel);
    var pts = rows.filter(function(r){
      return sr12NormalizarClave(r.clave_sr12) === claveNorm && num(r.costo_unitario) > 0 && fechaDeFila(r);
    });
    if (!pts.length) return { ok:false, error:'No hay compras registradas para este producto.' };

    pts.sort(function(a,b){ return fechaDeFila(a).localeCompare(fechaDeFila(b)); });
    var ult = pts[pts.length-1];
    var ingId = '';
    for (var i=pts.length-1; i>=0; i--){ if (pts[i].ingrediente_id){ ingId = pts[i].ingrediente_id; break; } }
    var ingInfo = ingId ? ingMap[ingId] : null;

    // Agrupar por proveedor.
    var provMap = {};
    var globalPts = [];
    pts.forEach(function(r){
      var prov = String(r.proveedor||'').trim() || '(sin proveedor)';
      var fecha = fechaDeFila(r);
      var costo = num(r.costo_unitario);
      var cant = num(r.cantidad);
      if (!provMap[prov]) provMap[prov] = { nombre: prov, puntos: [] };
      provMap[prov].puntos.push({ fecha: fecha, costo: costo, cantidad: cant, folio: String(r.folio||'') });
      globalPts.push({ fecha: fecha, costo: costo });
    });

    var proveedores = Object.keys(provMap).map(function(k){
      var pr = provMap[k];
      pr.puntos.sort(function(a,b){ return a.fecha.localeCompare(b.fecha); });
      var costos = pr.puntos.map(function(x){ return x.costo; });
      var sum = costos.reduce(function(a,b){ return a+b; }, 0);
      var primero = pr.puntos[0].costo, ultimo = pr.puntos[pr.puntos.length-1].costo;
      return {
        nombre: pr.nombre, puntos: pr.puntos, n: pr.puntos.length,
        min: Math.min.apply(null, costos), max: Math.max.apply(null, costos),
        avg: sum / costos.length, primero: primero, ultimo: ultimo,
        var_pct: primero > 0 ? ((ultimo - primero)/primero)*100 : 0,
        fecha_ultima: pr.puntos[pr.puntos.length-1].fecha
      };
    });
    proveedores.sort(function(a,b){ return (b.n-a.n) || a.nombre.localeCompare(b.nombre); });

    globalPts.sort(function(a,b){ return a.fecha.localeCompare(b.fecha); });
    var allCostos = globalPts.map(function(x){ return x.costo; });
    var gSum = allCostos.reduce(function(a,b){ return a+b; }, 0);
    var gPrim = globalPts[0].costo, gUlt = globalPts[globalPts.length-1].costo;

    return {
      ok:true,
      detalle: {
        clave: claveNorm,
        descripcion: String(ult.descripcion||''),
        grupo: String(ult.grupo||''),
        ingrediente_id: ingId,
        ingrediente_nombre: ingInfo ? ingInfo.nombre : '',
        unidad: ingInfo ? (ingInfo.unidad||'') : '',
        n_compras: pts.length,
        n_proveedores: proveedores.length,
        fecha_desde: globalPts[0].fecha,
        fecha_hasta: globalPts[globalPts.length-1].fecha,
        min: Math.min.apply(null, allCostos),
        max: Math.max.apply(null, allCostos),
        avg: gSum / allCostos.length,
        primero: gPrim, ultimo: gUlt,
        var_pct: gPrim > 0 ? ((gUlt - gPrim)/gPrim)*100 : 0,
        proveedores: proveedores,
        cuestionamientos: hilosPrecio[claveNorm] || []
      },
      cuestionamientos_pendientes: totalPendPrecio
    };
  }

  // ── MODO LISTA: resumen por producto (para el selector) ──
  var byClave = {};
  rows.forEach(function(r){
    var costo = num(r.costo_unitario);
    if (costo <= 0) return;
    var fecha = fechaDeFila(r);
    if (!fecha) return;
    var claveNorm = sr12NormalizarClave(r.clave_sr12);
    if (!claveNorm) return;
    if (!byClave[claveNorm]) byClave[claveNorm] = {
      clave: claveNorm, descripcion:'', grupo:'', ingrediente_id:'',
      proveedores:{}, puntos:[], ultima_fecha:'', ultimo_costo:0
    };
    var g = byClave[claveNorm];
    g.puntos.push({ fecha: fecha, costo: costo });
    if (r.proveedor) g.proveedores[String(r.proveedor).trim()] = true;
    if (fecha >= g.ultima_fecha) {
      g.ultima_fecha = fecha;
      if (r.descripcion) g.descripcion = String(r.descripcion);
      if (r.grupo) g.grupo = String(r.grupo);
      if (r.ingrediente_id) g.ingrediente_id = r.ingrediente_id;
      g.ultimo_costo = costo;
    }
  });

  var productos = Object.keys(byClave).map(function(k){
    var g = byClave[k];
    g.puntos.sort(function(a,b){ return a.fecha.localeCompare(b.fecha); });
    var costos = g.puntos.map(function(x){ return x.costo; });
    var primero = g.puntos[0].costo, ultimo = g.puntos[g.puntos.length-1].costo;
    var ingInfo = g.ingrediente_id ? ingMap[g.ingrediente_id] : null;
    return {
      clave: g.clave,
      descripcion: g.descripcion,
      grupo: g.grupo,
      ingrediente_id: g.ingrediente_id,
      ingrediente_nombre: ingInfo ? ingInfo.nombre : '',
      unidad: ingInfo ? (ingInfo.unidad||'') : '',
      n_compras: g.puntos.length,
      n_proveedores: Object.keys(g.proveedores).length,
      proveedores_txt: Object.keys(g.proveedores).join(' '),
      primero: primero, ultimo: ultimo,
      min: Math.min.apply(null, costos), max: Math.max.apply(null, costos),
      var_pct: primero > 0 ? ((ultimo - primero)/primero)*100 : 0,
      ultima_fecha: g.ultima_fecha,
      q_total: (hilosPrecio[g.clave]||[]).length,
      q_pend: pendDe(g.clave)
    };
  });
  productos.sort(function(a,b){ return String(a.descripcion).localeCompare(String(b.descripcion)); });

  return { ok:true, productos: productos, cuestionamientos_pendientes: totalPendPrecio };
}

// Hoja de hilos de cuestionamiento sobre la CURVA DE PRECIOS de un producto
// (Gerente de Plaza / auditoría preguntan → el comprador responde · registro histórico).
var PRECIOS_CUESTIONAMIENTOS_COLS = [
  'id','empresa_id','clave_sr12','producto',
  'pregunta','preguntado_por','preguntado_por_email','preguntado_at',
  'respuesta','respondido_por','respondido_por_email','respondido_at','estado','creado_at'
];
function handlePrecioCuestionar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['gerente_plaza','auditoria','admin','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var clave = sr12NormalizarClave(p.clave_sr12 || p.clave || '');
  var pregunta = String(p.pregunta || '').trim();
  if (!clave) return { ok:false, error:'Falta la clave del producto' };
  if (pregunta.length < 3) return { ok:false, error:'Escribe tu pregunta (mínimo 3 caracteres)' };
  var sh = asegurarHoja('PreciosCuestionamientos', PRECIOS_CUESTIONAMIENTOS_COLS);
  var ahora = _sr12AhoraLocalStr();
  var id = uuid();
  sh.appendRow([
    id, u.empresa_id, clave, String(p.producto||''),
    pregunta, (u.nombre||u.email||''), u.email, ahora,
    '', '', '', '', 'pendiente', ahora
  ]);
  return { ok:true, id:id };
}
function handlePrecioResponder(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['comprador','admin','gerente_administrativo'])) return { ok:false, error:'Solo el comprador (o administración) puede responder' };
  var id = String(p.id || '').trim();
  var respuesta = String(p.respuesta || '').trim();
  if (!id) return { ok:false, error:'Falta el id del cuestionamiento' };
  if (respuesta.length < 3) return { ok:false, error:'Escribe la respuesta (mínimo 3 caracteres)' };
  var sh = asegurarHoja('PreciosCuestionamientos', PRECIOS_CUESTIONAMIENTOS_COLS);
  var rows = rowsToObjects(sh);
  var idx = -1;
  for (var i=0;i<rows.length;i++){ if (rows[i].id===id && rows[i].empresa_id===u.empresa_id){ idx=i; break; } }
  if (idx === -1) return { ok:false, error:'Cuestionamiento no encontrado' };
  var hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var shRow = idx + 2;
  function setCol(name, val){ var c = hdrs.indexOf(name)+1; if (c) sh.getRange(shRow, c).setValue(val); }
  setCol('respuesta', respuesta);
  setCol('respondido_por', u.nombre||u.email||'');
  setCol('respondido_por_email', u.email);
  setCol('respondido_at', _sr12AhoraLocalStr());
  setCol('estado', 'respondida');
  return { ok:true };
}

// Conteo ligero de cuestionamientos de PRECIOS pendientes (para el badge del comprador en inicio).
function handlePrecioCuestCount(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PreciosCuestionamientos');
  if (!sh) return { ok:true, pendientes:0 };
  var n = rowsToObjects(sh).filter(function(r){ return r.empresa_id===u.empresa_id && String(r.estado||'pendiente')==='pendiente'; }).length;
  return { ok:true, pendientes:n };
}

// Contar pendientes para el tile de inicio del comprador
function handleSr12JustificacionesPendientesCount(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('JustificacionesPrecios');
  if (!sh) return { ok:true, pendientes:0 };
  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id===u.empresa_id && !r.justificacion; });
  return { ok:true, pendientes:rows.length };
}

// =============================================================================
// GENERADOR DE INFORME EJECUTIVO CON IA (v264)
// Corre el análisis de precios, carga usuarios activos y llama a Claude Haiku
// para redactar el memorándum ejecutivo en formato JSON estructurado.
// =============================================================================
function handleSr12GenerarInformeIA(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','auditoria','gerente_administrativo'].indexOf(String(u.rol||'').toLowerCase()) === -1) {
    return { ok:false, error:'Sin permisos' };
  }

  // API key desde Script Properties
  var apiKey = String(PropertiesService.getScriptProperties().getProperty('anthropic_key_' + u.empresa_id) || '').trim();
  if (!apiKey) return { ok:false, error:'API key de Anthropic no configurada.' };

  // Correr el reporte de precios
  var reporte = handleSr12ReportePrecios(p);
  if (!reporte.ok) return reporte;
  var data = reporte;

  // Usuarios activos del sistema
  var shUsr = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  var usuarios = [];
  if (shUsr) {
    rowsToObjects(shUsr).filter(function(uu){
      return uu.empresa_id === u.empresa_id && String(uu.activo||'true') !== 'false';
    }).forEach(function(uu){
      if (uu.nombre || uu.email) usuarios.push({ nombre: uu.nombre || uu.email, rol: uu.rol || '' });
    });
  }

  // Clasificar ingredientes
  var rojos    = data.ingredientes.filter(function(i){ return i.severidad==='rojo'; });
  var amarillos= data.ingredientes.filter(function(i){ return i.severidad==='amarillo'; });
  var extremos = rojos.filter(function(i){ return Math.abs(i.cambio_ultimo) >= 50; });
  var creibles = data.ingredientes.filter(function(i){ var a=Math.abs(i.cambio_ultimo); return a>=12 && a<50; });
  var sinCat   = data.ingredientes.filter(function(i){ return !i.categoria || i.categoria==='Sin categoría'; });

  // Recetas únicas afectadas
  var recSetKeys = {};
  rojos.concat(amarillos).forEach(function(i){ (i.recetas||[]).forEach(function(r){ recSetKeys[r.id||r.nombre]=r.nombre; }); });
  var totalRecetas = Object.keys(recSetKeys).length;

  var periodo = data.periodo.importaciones.map(function(i){ return i.fecha; }).join(' → ');

  // Top 8 extremos y top 10 creíbles para el prompt
  var listaExtremos = extremos.slice(0,8).map(function(i){
    return i.nombre + ': ' + (i.cambio_ultimo>0?'+':'') + i.cambio_ultimo + '%';
  }).join('; ');
  var listaCreibles = creibles.sort(function(a,b){ return Math.abs(b.cambio_ultimo)-Math.abs(a.cambio_ultimo); }).slice(0,10).map(function(i){
    var recs = (i.recetas||[]).slice(0,3).map(function(r){ return r.nombre; }).join(', ');
    return i.nombre + ': ' + (i.cambio_ultimo>0?'+':'') + i.cambio_ultimo + '%' + (recs?' ('+recs+')':'');
  }).join('; ');
  var listaUsuarios = usuarios.map(function(uu){ return uu.nombre + ' [' + uu.rol + ']'; }).join(', ');

  // Fecha local
  var ahora = new Date();
  var fechaLocal = ahora.getDate() + ' de ' + ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][ahora.getMonth()] + ' de ' + ahora.getFullYear();

  var promptText = [
    'Eres el auditor del restaurante Fogueira Oaxaca. Redacta un memorándum ejecutivo formal de análisis de precios de insumos para el Contralor General del Grupo Toda del Sureste.',
    'Usa tono ejecutivo, lenguaje directo y preciso, en español. Estructura: problema → hallazgo → acción.',
    '',
    'DATOS DEL ANÁLISIS:',
    'Período: ' + periodo,
    'Total insumos: ' + data.resumen.total + ' | Alertas críticas: ' + data.resumen.rojos + ' | Advertencias: ' + data.resumen.amarillos + ' | Estables: ' + data.resumen.verdes,
    'Recetas con insumos en alerta: ' + totalRecetas,
    'Casos extremos (≥50% cambio, probables errores de captura, ' + extremos.length + ' casos): ' + listaExtremos,
    'Movimientos creíbles (12–50%, ' + creibles.length + ' casos): ' + listaCreibles,
    'Insumos sin categoría asignada: ' + sinCat.length,
    '',
    'USUARIOS ACTIVOS DEL SISTEMA (solo estos como responsables): ' + listaUsuarios,
    'Auditor que firma: ' + (u.nombre || u.email),
    'Fecha: ' + fechaLocal,
    '',
    'Responde ÚNICAMENTE con JSON (sin markdown, sin texto extra):',
    '{',
    '  "para": "nombre y cargo del destinatario Contralor General",',
    '  "de": "' + (u.nombre||u.email) + ', Auditor",',
    '  "fecha": "' + fechaLocal + '",',
    '  "antecedentes": "2-3 oraciones: qué sistema se usó, qué período se comparó, cuántos insumos",',
    '  "proposito": "1-2 oraciones: qué se evaluó y para qué",',
    '  "conclusion": "3-4 oraciones: resumen ejecutivo, qué sirve, qué no sirve aún y por qué, qué se solicita autorizar",',
    '  "secciones": [',
    '    { "letra":"A", "titulo":"Calidad de los datos de precio",',
    '      "hallazgos":"párrafo con cifras de extremos, patrón de error (unidad/presentación), impacto",',
    '      "acciones":[{"descripcion":"...","responsable":"nombre de usuario activo","fecha":"DD Mon YYYY"}] },',
    '    { "letra":"B", "titulo":"Clasificación de insumos y topes de alerta",',
    '      "hallazgos":"párrafo sobre categorías inconsistentes y efecto en confiabilidad del semáforo",',
    '      "acciones":[...] },',
    '    { "letra":"C", "titulo":"Lo que sí es señal aprovechable",',
    '      "hallazgos":"párrafo sobre los movimientos creíbles, insumos clave, recetas impactadas",',
    '      "acciones":[...] }',
    '  ]',
    '}'
  ].join('\n');

  try {
    var options = {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      payload: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:2500, messages:[{ role:'user', content:promptText }] }),
      muteHttpExceptions: true
    };
    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    if (code !== 200) {
      var eb; try { eb=JSON.parse(body); } catch(e2){ eb={}; }
      return { ok:false, error:'Error Anthropic: ' + ((eb.error&&eb.error.message)||('HTTP '+code)) };
    }
    var rj = JSON.parse(body);
    var txt = rj.content && rj.content[0] && rj.content[0].text;
    if (!txt) return { ok:false, error:'Respuesta vacía de Anthropic' };
    var clean = txt.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
    var memo; try { memo=JSON.parse(clean); } catch(e3){ return { ok:false, error:'Respuesta IA no es JSON válido' }; }
    return { ok:true, memo:memo };
  } catch(e) {
    return { ok:false, error:'Error al llamar Anthropic: '+e.message };
  }
}

// =============================================================================
// DASHBOARD DE ANÁLISIS DE PRECIOS (v261)
// Compara costos por ingrediente entre N importaciones SR12 anteriores.
// Calcula variación %, coeficiente de variación (CV%), severidad por categoría.
// =============================================================================

var SR12_ALERTAS_CONFIG_CLAVE = 'sr12_alertas_precios_json';

var SR12_ALERTAS_DEFAULT = JSON.stringify({
  defaults: { amarillo: 7, rojo: 12, cv_volatil: 18, cv_muy_volatil: 30 },
  categorias: {
    'Carnes':    { amarillo: 8,  rojo: 15 },
    'Embutidos': { amarillo: 5,  rojo: 10 },
    'Verduras':  { amarillo: 15, rojo: 25 },
    'Frutas':    { amarillo: 12, rojo: 22 },
    'Lacteos':   { amarillo: 5,  rojo: 10 },
    'Huevo':     { amarillo: 10, rojo: 20 },
    'Aceites':   { amarillo: 6,  rojo: 12 },
    'Abarrotes': { amarillo: 4,  rojo: 8  },
    'Bebidas':   { amarillo: 3,  rojo: 6  },
    'Especias':  { amarillo: 6,  rojo: 15 }
  }
});

function sr12GetAlertasConfig(empresa_id) {
  var shCfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Configuracion');
  if (shCfg) {
    var rows = rowsToObjects(shCfg);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].empresa_id === empresa_id && rows[i].clave === SR12_ALERTAS_CONFIG_CLAVE) {
        try { return JSON.parse(rows[i].valor); } catch(e) {}
      }
    }
  }
  return JSON.parse(SR12_ALERTAS_DEFAULT);
}

function handleSr12AlertasConfigGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','auditoria','gerente_administrativo'].indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Sin permisos' };
  return { ok:true, config: sr12GetAlertasConfig(u.empresa_id), defaults: JSON.parse(SR12_ALERTAS_DEFAULT) };
}

function handleSr12AlertasConfigSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','auditoria'].indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Solo Admin o Auditoría puede modificar umbrales' };
  var config; try { config = JSON.parse(p.config || '{}'); } catch(e) { return { ok:false, error:'config inválido' }; }
  var shCfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Configuracion');
  if (!shCfg) return { ok:false, error:'Hoja Configuracion no existe' };
  var rows = rowsToObjects(shCfg);
  var existing = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].empresa_id === u.empresa_id && rows[i].clave === SR12_ALERTAS_CONFIG_CLAVE) { existing = rows[i]; break; }
  }
  var ahora = new Date(); var valor = JSON.stringify(config);
  if (existing) {
    var hdrs = shCfg.getRange(1,1,1,shCfg.getLastColumn()).getValues()[0];
    var cv = hdrs.indexOf('valor')+1, ca = hdrs.indexOf('actualizado_at')+1, cp = hdrs.indexOf('actualizado_por')+1;
    if (cv) shCfg.getRange(existing._row, cv).setValue(valor);
    if (ca) shCfg.getRange(existing._row, ca).setValue(ahora);
    if (cp) shCfg.getRange(existing._row, cp).setValue(u.email);
  } else {
    shCfg.appendRow([uuid(), u.empresa_id, '', SR12_ALERTAS_CONFIG_CLAVE, valor, ahora, u.email, ahora, u.email]);
  }
  return { ok:true };
}

function _sr12MatchCatUmbral(categoria, config) {
  var c = String(categoria || '').toLowerCase();
  var cats = config.categorias || {};
  var map = [
    ['Carnes',    /carne|res|cerdo|pollo|ave|pork|beef|proteina|embutido|chorizo|salchicha|jamon/],
    ['Embutidos', /embutido|chorizo|salchicha|jamon|mortadela/],
    ['Verduras',  /verdura|vegetal|hortaliza|jitomate|tomate|cebolla|chile|papa|zanahoria|lechuga|nopal|espinaca/],
    ['Frutas',    /fruta|mango|platano|fresa|melon|sandia|naranja|limon|aguacate|pina/],
    ['Lacteos',   /lacteo|queso|crema|leche|mantequilla|yogurt|butter/],
    ['Huevo',     /huevo/],
    ['Aceites',   /aceite|grasa|manteca/],
    ['Abarrotes', /abarrote|arroz|frijol|pasta|lata|conserva|seco/],
    ['Bebidas',   /bebida|refresco|agua|jugo|cerveza|vino|destilado|licor/],
    ['Especias',  /especia|condimento|sal |pimienta|comino|oregano|ajo|vinagre/]
  ];
  for (var i = 0; i < map.length; i++) {
    if (map[i][1].test(c)) return cats[map[i][0]] || config.defaults;
  }
  return config.defaults;
}

function _sr12Stddev(vals) {
  if (!vals || vals.length < 2) return 0;
  var mean = vals.reduce(function(s,v){ return s+v; }, 0) / vals.length;
  var variance = vals.reduce(function(s,v){ return s + Math.pow(v-mean, 2); }, 0) / vals.length;
  return Math.sqrt(variance);
}

function handleSr12ReportePrecios(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','auditoria','gerente_administrativo'].indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Sin permisos' };

  var nImp = Math.min(Math.max(parseInt(p.n_importaciones || 3), 2), 12);
  var fechaDesde = p.fecha_desde ? new Date(p.fecha_desde) : null;
  var fechaHasta = p.fecha_hasta ? new Date(p.fecha_hasta + 'T23:59:59') : null;

  // 1. Importaciones filtradas y ordenadas
  var shImp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ImportacionesSR12');
  if (!shImp) return { ok:false, error:'No hay importaciones registradas aún. Sube al menos 2 archivos SR12 primero.' };
  var todasImp = rowsToObjects(shImp).filter(function(r) {
    if (r.empresa_id !== u.empresa_id) return false;
    if (String(r.estatus||'').toLowerCase() !== 'aplicada') return false;
    if (fechaDesde || fechaHasta) {
      var f = r.aplicado_at ? new Date(r.aplicado_at) : null;
      if (!f) return false;
      if (fechaDesde && f < fechaDesde) return false;
      if (fechaHasta && f > fechaHasta) return false;
    }
    return true;
  });
  todasImp.sort(function(a,b){ return new Date(b.aplicado_at) - new Date(a.aplicado_at); });
  var importaciones = todasImp.slice(0, nImp).reverse();
  if (importaciones.length < 2) return { ok:false, error:'Se necesitan al menos 2 importaciones para comparar. Solo hay ' + importaciones.length + ' en el período seleccionado.' };

  var impIds = {}; importaciones.forEach(function(i){ impIds[i.id] = true; });

  // 2. Detalles de esas importaciones
  var shDet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ImportacionDetalleSR12');
  if (!shDet) return { ok:false, error:'No hay datos de detalle de importaciones' };
  var detalles = rowsToObjects(shDet).filter(function(r){ return impIds[r.importacion_id]; });

  // 2b. Mapa clave_sr12 → factor_a_base (para reconstruir costo original = costo_por_base × factor)
  // El parser convierte COSTO_PROMEDIO del SR12 a $/gramo o $/ml dividiendo por el factor.
  // Para mostrar en el dashboard los mismos $ que el Excel, multiplicamos de vuelta.
  var shSR12 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('IngredientesSR12');
  var factorPorClave = {};
  if (shSR12) {
    rowsToObjects(shSR12).filter(function(r){ return r.empresa_id === u.empresa_id; }).forEach(function(r){
      var f = parseFloat(r.factor_a_base);
      if (r.clave_sr12 && f > 0) factorPorClave[String(r.clave_sr12)] = f;
    });
  }

  // 3. Ingredientes Fogueira para enriquecer con categoría
  var shIng = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ingredientes');
  var ingPorId = {}, ingPorClave = {};
  if (shIng) {
    rowsToObjects(shIng).filter(function(i){ return i.empresa_id === u.empresa_id; }).forEach(function(i){
      ingPorId[i.id] = i;
      if (i.clave_sr12) ingPorClave[String(i.clave_sr12)] = i;
    });
  }

  // 4. Recetas afectadas
  var shIR = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('IngredientesReceta');
  var shRec = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Recetas');
  var recetasPorIngId = {}, recNombres = {};
  if (shIR && shRec) {
    rowsToObjects(shRec).forEach(function(r){ recNombres[r.id] = r.nombre; });
    rowsToObjects(shIR).forEach(function(ir){
      if (ir.ingrediente_id) {
        if (!recetasPorIngId[ir.ingrediente_id]) recetasPorIngId[ir.ingrediente_id] = [];
        recetasPorIngId[ir.ingrediente_id].push({ id: ir.receta_id, nombre: recNombres[ir.receta_id] || ir.receta_id });
      }
    });
  }

  // 5. Construir historial por clave_sr12
  var hist = {};
  importaciones.forEach(function(imp) {
    var fecha = String(imp.aplicado_at || '').slice(0,10);
    detalles.filter(function(d){ return d.importacion_id === imp.id; }).forEach(function(d){
      var clave = String(d.clave_sr12 || '').trim();
      var costoBase = parseFloat(d.costo_nuevo) || 0;
      if (!clave || costoBase <= 0) return;
      // Reconstruir costo en unidades del SR12 ($/kg, $/lt, $/pza) = costo_base × factor_a_base
      // Así el dashboard muestra los mismos $ que el Excel, no $/gramo
      var factor = factorPorClave[clave] || 1;
      var costo = Math.round(costoBase * factor * 10000) / 10000;
      if (!hist[clave]) {
        var ing = ingPorClave[clave] || (d.ingrediente_fogueira_id ? ingPorId[d.ingrediente_fogueira_id] : null);
        hist[clave] = { clave: clave, nombre: d.nombre_sr12, categoria: ing ? (ing.categoria||'') : '', ingId: d.ingrediente_fogueira_id || (ing ? ing.id : ''), periodos: [] };
      }
      // Solo un registro por importación
      if (!hist[clave].periodos.find(function(pp){ return pp.imp_id === imp.id; })) {
        hist[clave].periodos.push({ imp_id: imp.id, fecha: fecha, costo: costo, existencia: parseFloat(d.existencia_total)||0 });
      }
    });
  });

  // 6. Calcular estadísticas
  var alertasConfig = sr12GetAlertasConfig(u.empresa_id);
  var resultados = [];

  Object.keys(hist).forEach(function(clave) {
    var item = hist[clave];
    if (item.periodos.length < 2) return;
    var costos = item.periodos.map(function(pp){ return pp.costo; });
    var media = costos.reduce(function(s,v){ return s+v; },0) / costos.length;
    var std = _sr12Stddev(costos);
    var cv = media > 0 ? Math.round(std/media*1000)/10 : 0;
    var cambios = [];
    for (var i=1; i<costos.length; i++) {
      cambios.push(costos[i-1]>0 ? Math.round((costos[i]-costos[i-1])/costos[i-1]*1000)/10 : 0);
    }
    var cambioUltimo = cambios[cambios.length-1] || 0;
    var cambioAcum = costos[0]>0 ? Math.round((costos[costos.length-1]-costos[0])/costos[0]*1000)/10 : 0;
    var consAlza = 0; for (var j=cambios.length-1; j>=0; j--){ if(cambios[j]>0) consAlza++; else break; }
    var tendencia = Math.abs(cambioUltimo)<1 ? 'estable' : (cambioUltimo>0 ? 'alza' : 'baja');
    var thr = _sr12MatchCatUmbral(item.categoria, alertasConfig);
    var absU = Math.abs(cambioUltimo);
    var sev = 'verde';
    if (absU >= (thr.rojo || alertasConfig.defaults.rojo)) sev = 'rojo';
    else if (absU >= (thr.amarillo || alertasConfig.defaults.amarillo)) sev = 'amarillo';
    if (sev === 'verde' && cv >= (alertasConfig.defaults.cv_muy_volatil || 30)) sev = 'amarillo';
    var recetas = item.ingId && recetasPorIngId[item.ingId]
      ? recetasPorIngId[item.ingId].filter(function(r){ return r.nombre; }).slice(0,8)
      : [];
    resultados.push({
      clave: clave, nombre: item.nombre, categoria: item.categoria || 'Sin categoría', ing_id: item.ingId,
      periodos: item.periodos, media: Math.round(media*100)/100, cv: cv,
      cambios: cambios, cambio_ultimo: cambioUltimo, cambio_acum: cambioAcum,
      cons_alza: consAlza, tendencia: tendencia, severidad: sev, recetas: recetas
    });
  });

  var sevOrd = {rojo:0, amarillo:1, verde:2};
  resultados.sort(function(a,b){
    if (sevOrd[a.severidad] !== sevOrd[b.severidad]) return sevOrd[a.severidad]-sevOrd[b.severidad];
    return Math.abs(b.cambio_ultimo)-Math.abs(a.cambio_ultimo);
  });

  var rojos = resultados.filter(function(r){ return r.severidad==='rojo'; });
  var amarillos = resultados.filter(function(r){ return r.severidad==='amarillo'; });
  var cpy = resultados.slice();
  var topAlza = cpy.sort(function(a,b){ return b.cambio_ultimo-a.cambio_ultimo; })[0];
  var topBaja = resultados.slice().sort(function(a,b){ return a.cambio_ultimo-b.cambio_ultimo; })[0];
  var masVol  = resultados.slice().sort(function(a,b){ return b.cv-a.cv; })[0];

  return {
    ok: true,
    periodo: {
      importaciones: importaciones.map(function(i){ return { id:i.id, fecha:String(i.aplicado_at||'').slice(0,10), archivos:i.archivos_nombres||'' }; }),
      n: importaciones.length
    },
    resumen: {
      total: resultados.length,
      rojos: rojos.length, amarillos: amarillos.length, verdes: resultados.length-rojos.length-amarillos.length,
      top_alza: topAlza&&topAlza.cambio_ultimo>0 ? {nombre:topAlza.nombre, pct:topAlza.cambio_ultimo} : null,
      top_baja: topBaja&&topBaja.cambio_ultimo<0 ? {nombre:topBaja.nombre, pct:topBaja.cambio_ultimo} : null,
      mas_volatil: masVol ? {nombre:masVol.nombre, cv:masVol.cv} : null
    },
    ingredientes: resultados,
    config: alertasConfig
  };
}
