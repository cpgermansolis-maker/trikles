/**
 * Recetario Fogueira — Handlers de la API (Fase 2)
 *
 * Funciones server-side para list/get/update de ingredientes y recetas.
 * Ruta de acceso: las acciones del switch en handleRequest() de Código.js.
 *
 * Reglas de seguridad:
 * - Toda edición de precio queda en HistorialPrecios (email + fecha + valor anterior + nuevo)
 * - Toda edición de receta queda en HistorialRecetas con snapshot completo
 * - Solo Auditoría puede desactivar/reactivar recetas (no se borran físicamente)
 * - Guardrail: si un usuario edita >20 precios en <5 min, se levanta alerta_masiva=true
 *
 * Roles que acceden:
 * - admin / gerente_administrativo: lee y edita todo (config, precios, recetas)
 * - auditoria: lee todo, ve historial completo
 * - cocina (Sergio): edita recetas de área 'cocina'
 * - churrasca (Marcos): edita recetas de área 'churrasca'
 * - comprador (Weslley): solo lectura + importar SR12 + responder justificaciones (NO edita precios ni catálogo)
 */

// Wrapper: ejecutar migración vía URL admin (Claude Sprint 1)
function handleRecetarioMigrarV2(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  try { return migrarIngredientesMarcosV2(); }
  catch(e) { return { ok:false, error: String(e.message || e) }; }
}

// =============== Migración V3: SoftRestaurant-style costos (último + promedio) ===============
// Renombra ultimo_costo → ultimo_costo, ultimo_costo_estimado → ultimo_costo_estimado, agrega costo_promedio.
// Idempotente: si ya está en V3, no hace nada.
function migrarIngredientesMarcosV3() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ingredientes');
  if (!sh) throw new Error('Hoja Ingredientes no existe.');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  var ESPERADO = ['id','empresa_id','nombre','aliases','categoria','tipo_abc','es_subreceta_catalogo','dato_incompleto','inventariable','unidad_base','ultimo_costo','costo_promedio','ultimo_costo_estimado','precio_origen','merma_deshielo_pct','merma_aprovechable_pct','merma_no_aprovechable_pct','merma_pct','factor_rendimiento','factor_rendimiento_origen','precio_real_unitario','activo','creado_at','creado_por','actualizado_at','actualizado_por'];

  if (headers.length === ESPERADO.length && headers.every(function(h, i){ return h === ESPERADO[i]; })) {
    console.log('✓ Ingredientes ya está en V3.');
    return { ok: true, ya_migrada: true };
  }

  // Buscar columnas viejas (V2) y nuevas (V3) — la migración V3 puede correr sobre V2
  var idxPrecioViejo   = headers.indexOf('precio_compra');
  var idxPrecioEstViejo = headers.indexOf('precio_compra_estimado');
  var idxUltimoCostoNuevo = headers.indexOf('ultimo_costo');

  if (idxPrecioViejo < 0 && idxUltimoCostoNuevo < 0) {
    throw new Error('No se encontró columna precio_compra (V2) ni ultimo_costo (V3).');
  }

  var ultFila = sh.getLastRow();
  var ultCol = sh.getLastColumn();
  var datos = ultFila > 1 ? sh.getRange(2, 1, ultFila - 1, ultCol).getValues() : [];

  function valor(headerNombre, fila) {
    var i = headers.indexOf(headerNombre);
    return i >= 0 ? fila[i] : null;
  }
  var datosNuevos = datos.map(function(fila){
    var nueva = {};
    ESPERADO.forEach(function(h){ nueva[h] = valor(h, fila); });
    // Migrar precio_compra (V2) → ultimo_costo (V3)
    if ((nueva.ultimo_costo === null || nueva.ultimo_costo === '') && idxPrecioViejo >= 0) {
      nueva.ultimo_costo = fila[idxPrecioViejo];
    }
    // costo_promedio: arranca = ultimo_costo (en futuro lo recalculará el módulo de compras)
    if (nueva.costo_promedio === null || nueva.costo_promedio === '') {
      nueva.costo_promedio = nueva.ultimo_costo;
    }
    // ultimo_costo_estimado: hereda de precio_compra_estimado (V2)
    if ((nueva.ultimo_costo_estimado === null || nueva.ultimo_costo_estimado === '') && idxPrecioEstViejo >= 0) {
      nueva.ultimo_costo_estimado = fila[idxPrecioEstViejo];
    }
    return ESPERADO.map(function(h){ return nueva[h]; });
  });

  sh.clear();
  var range = sh.getRange(1, 1, 1, ESPERADO.length);
  range.setValues([ESPERADO]);
  range.setFontWeight('bold').setBackground('#b8472a').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  if (datosNuevos.length) {
    sh.getRange(2, 1, datosNuevos.length, ESPERADO.length).setValues(datosNuevos);
  }

  console.log('✓ Migrada V3:', datosNuevos.length, 'filas (ultimo_costo → ultimo_costo + costo_promedio).');
  return { ok: true, filas_migradas: datosNuevos.length };
}

function handleRecetarioMigrarV3(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  try { return migrarIngredientesMarcosV3(); }
  catch(e) { return { ok:false, error: String(e.message || e) }; }
}

// =============== Crear insumos nuevos en lote (Sprint 1.5) ===============
// Recibe payload: { insumos: [{nombre, categoria, unidad_base, ultimo_costo, ...}] }
// Genera ID nuevo (ING-XXXX), inserta fila nueva. Idempotente: si ya existe nombre, no duplica.
function handleRecetarioCrearInsumos(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  var payload;
  try { payload = JSON.parse(p.payload || p.data || '{}'); }
  catch(e) { return { ok:false, error:'JSON inválido: ' + e.message }; }
  if (!payload.insumos || !payload.insumos.length) return { ok:false, error:'Falta payload.insumos' };

  var EMPRESA_ID = '521aef3c-7df7-49ad-b1af-583a95233cd0';
  var sh = getSheet('Ingredientes');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = rowsToObjects(sh);

  // Calcular siguiente ID
  function maxId() {
    var max = 0;
    rows.forEach(function(r){
      var m = String(r.id || '').match(/^ING-(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return max;
  }
  var contador = maxId();
  var ahora = new Date();
  var creados = 0, duplicados = 0;
  var filasNuevas = [];
  var nombresExistentes = new Set();
  rows.forEach(function(r){
    nombresExistentes.add(String(r.nombre || '').toLowerCase().trim());
    String(r.aliases || '').split('|').forEach(function(a){ if (a.trim()) nombresExistentes.add(a.toLowerCase().trim()); });
  });

  payload.insumos.forEach(function(ins){
    var nombre = (ins.nombre || '').trim();
    if (!nombre) return;
    if (nombresExistentes.has(nombre.toLowerCase())) { duplicados++; return; }
    contador++;
    var id = 'ING-' + String(contador).padStart(4, '0');
    var ultimoCosto = Number(ins.ultimo_costo) || 0;
    var merma = Number(ins.merma_no_aprovechable_pct) || 0;
    var factor = 1 + merma / 100;
    var precioReal = ultimoCosto > 0 ? Number((ultimoCosto * factor).toFixed(4)) : null;
    var fila = {};
    headers.forEach(function(h){ fila[h] = ''; });
    Object.assign(fila, {
      id: id,
      empresa_id: EMPRESA_ID,
      nombre: nombre,
      aliases: (ins.aliases || []).join('|'),
      categoria: ins.categoria || 'Otros',
      tipo_abc: ins.tipo_abc || '',
      es_subreceta_catalogo: false,
      dato_incompleto: false,
      inventariable: ins.inventariable !== false,
      unidad_base: ins.unidad_base || 'kg',
      ultimo_costo: ultimoCosto,
      costo_promedio: Number(ins.costo_promedio) || ultimoCosto,
      ultimo_costo_estimado: !!ins.ultimo_costo_estimado,
      precio_origen: ins.precio_origen || 'softrestaurant_marcos',
      merma_deshielo_pct: Number(ins.merma_deshielo_pct) || 0,
      merma_aprovechable_pct: Number(ins.merma_aprovechable_pct) || 0,
      merma_no_aprovechable_pct: merma,
      merma_pct: merma + (Number(ins.merma_deshielo_pct) || 0) + (Number(ins.merma_aprovechable_pct) || 0),
      factor_rendimiento: Number(ins.factor_rendimiento) || 1,
      factor_rendimiento_origen: ins.factor_rendimiento_origen || 'default',
      precio_real_unitario: precioReal,
      activo: true,
      creado_at: ahora,
      creado_por: 'sistema@sprint1.5_marcos',
      actualizado_at: ahora,
      actualizado_por: 'sistema@sprint1.5_marcos'
    });
    filasNuevas.push(headers.map(function(h){ return fila[h]; }));
    nombresExistentes.add(nombre.toLowerCase());
    creados++;
  });

  if (filasNuevas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, filasNuevas.length, headers.length).setValues(filasNuevas);
  }
  return { ok: true, creados: creados, duplicados: duplicados };
}

// =============== Renombrar recetas en lote (Sprint 1.5b — resolver duplicados Cocina/Churrasca) ===============
// Recibe { renombres: [{id_actual O nombre_actual, nombre_nuevo}] }
// Por cada uno, busca la receta y actualiza su columna `nombre`. Idempotente.
function handleRecetarioRenombrarRecetas(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  var payload;
  try { payload = JSON.parse(p.payload || p.data || '{}'); }
  catch(e) { return { ok:false, error:'JSON inválido: ' + e.message }; }
  if (!payload.renombres || !payload.renombres.length) return { ok:false, error:'Falta payload.renombres' };

  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' '); }
  var sh = getSheet('Recetas');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = rowsToObjects(sh);
  var colNombre = headers.indexOf('nombre') + 1;
  var colAct = headers.indexOf('actualizado_at') + 1;
  var colActPor = headers.indexOf('actualizado_por') + 1;

  var renombrados = 0;
  var ahora = new Date();
  payload.renombres.forEach(function(rn){
    var receta = null;
    if (rn.id_actual) receta = rows.find(function(r){ return r.id === rn.id_actual; });
    else if (rn.nombre_actual) receta = rows.find(function(r){ return normalizar(r.nombre) === normalizar(rn.nombre_actual); });
    if (!receta || !rn.nombre_nuevo) return;
    if (normalizar(receta.nombre) === normalizar(rn.nombre_nuevo)) return; // ya tiene ese nombre
    sh.getRange(receta._row, colNombre).setValue(rn.nombre_nuevo);
    if (colAct > 0) sh.getRange(receta._row, colAct).setValue(ahora);
    if (colActPor > 0) sh.getRange(receta._row, colActPor).setValue('sistema@sprint1.5b_resolve_dup');
    renombrados++;
  });
  return { ok: true, renombrados: renombrados, recibidos: payload.renombres.length };
}

// =============== Reconciliar líneas IR sin ingrediente_id (Sprint 1.5) ===============
// Recorre todas las líneas IR donde ingrediente_id e subreceta_id están vacíos.
// Para cada una, busca en catálogo (incluyendo aliases) la advertencia "No resuelto: XXX"
// y le asigna el ID si lo encuentra.
function handleRecetarioReconciliarIR(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };

  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' '); }

  var ingredientes = rowsToObjects(getSheet('Ingredientes'));
  var recetas = rowsToObjects(getSheet('Recetas'));
  var mapaIng = {};
  ingredientes.forEach(function(i){
    mapaIng[normalizar(i.nombre)] = i;
    String(i.aliases || '').split('|').forEach(function(a){ if (a.trim()) mapaIng[normalizar(a)] = i; });
  });
  var mapaRec = {};
  recetas.forEach(function(r){
    mapaRec[normalizar(r.nombre)] = r;
    String(r.aliases || '').split('|').forEach(function(a){ if (a.trim()) mapaRec[normalizar(a)] = r; });
  });

  var sh = getSheet('IngredientesReceta');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = rowsToObjects(sh);
  var colIng = headers.indexOf('ingrediente_id') + 1;
  var colSub = headers.indexOf('subreceta_id') + 1;
  var colUni = headers.indexOf('unidad') + 1;
  var colAdv = headers.indexOf('advertencia') + 1;

  var resueltos = 0, sinResolver = [];
  rows.forEach(function(r){
    var sinId = !r.ingrediente_id && !r.subreceta_id;
    if (!sinId) return;
    var adv = String(r.advertencia || '');
    var m = adv.match(/^No resuelto:\s*(.+)$/i);
    if (!m) return;
    var nombreBuscado = normalizar(m[1]);
    var ing = mapaIng[nombreBuscado];
    var sub = mapaRec[nombreBuscado];
    if (ing) {
      if (colIng > 0) sh.getRange(r._row, colIng).setValue(ing.id);
      if (colUni > 0 && !r.unidad) sh.getRange(r._row, colUni).setValue(ing.unidad_base);
      if (colAdv > 0) sh.getRange(r._row, colAdv).setValue('reconciliado: ' + ing.nombre);
      resueltos++;
    } else if (sub) {
      if (colSub > 0) sh.getRange(r._row, colSub).setValue(sub.id);
      if (colAdv > 0) sh.getRange(r._row, colAdv).setValue('reconciliado: sub ' + sub.nombre);
      resueltos++;
    } else {
      sinResolver.push({ ir_id: r.id, receta_id: r.receta_id, buscado: m[1] });
    }
  });

  return { ok: true, resueltos: resueltos, sin_resolver: sinResolver.length, ejemplos_no_resueltos: sinResolver.slice(0, 20) };
}

// =============== Crear sub-recetas nuevas en lote (Sprint 1.5) ===============
// Recibe: { recetas: [{nombre, area, rendimiento, unidad_rendimiento, ingredientes:[{nombre_ingrediente, cantidad, unidad}]}] }
// Genera REC-XXXX y crea las líneas IR. Resuelve nombre_ingrediente al ID buscando en catálogo.
function handleRecetarioCrearRecetas(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  var payload;
  try { payload = JSON.parse(p.payload || p.data || '{}'); }
  catch(e) { return { ok:false, error:'JSON inválido: ' + e.message }; }
  if (!payload.recetas || !payload.recetas.length) return { ok:false, error:'Falta payload.recetas' };

  var EMPRESA_ID = '521aef3c-7df7-49ad-b1af-583a95233cd0';
  var shR = getSheet('Recetas');
  var headersR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0];
  var rowsR = rowsToObjects(shR);
  var shIR = getSheet('IngredientesReceta');
  var headersIR = shIR.getRange(1, 1, 1, shIR.getLastColumn()).getValues()[0];
  var rowsIR = rowsToObjects(shIR);
  var ingredientes = rowsToObjects(getSheet('Ingredientes'));

  // Mapas para resolver nombres de ingredientes
  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' '); }
  var mapaIng = {};
  ingredientes.forEach(function(i){
    mapaIng[normalizar(i.nombre)] = i;
    String(i.aliases || '').split('|').forEach(function(a){ if (a.trim()) mapaIng[normalizar(a)] = i; });
  });
  var mapaRec = {};
  rowsR.forEach(function(r){ mapaRec[normalizar(r.nombre)] = r; });

  function maxId(rows, prefix) {
    var max = 0;
    rows.forEach(function(r){
      var m = String(r.id || '').match(new RegExp('^' + prefix + '-(\\d+)$'));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return max;
  }
  var recC = maxId(rowsR, 'REC');
  var irC = maxId(rowsIR, 'IR');

  var ahora = new Date();
  var resumen = { recetas_creadas: 0, recetas_duplicadas: 0, ir_creadas: 0, ingredientes_no_resueltos: [] };
  var filasRec = [];
  var filasIR = [];
  var nombresRecetaSet = new Set(rowsR.map(function(r){ return normalizar(r.nombre); }));

  payload.recetas.forEach(function(rec){
    var nombre = (rec.nombre || '').trim();
    if (!nombre) return;
    if (nombresRecetaSet.has(normalizar(nombre))) { resumen.recetas_duplicadas++; return; }
    recC++;
    var recId = 'REC-' + String(recC).padStart(4, '0');
    var fila = {};
    headersR.forEach(function(h){ fila[h] = ''; });
    Object.assign(fila, {
      id: recId,
      empresa_id: EMPRESA_ID,
      nombre: nombre,
      categoria_culinaria: rec.categoria_culinaria || 'Salsas y preparaciones',
      area: rec.area || 'churrasca',
      chef_responsable_email: rec.chef_responsable_email || 'churrasca@fogueira.test',
      rendimiento: Number(rec.rendimiento) || 1,
      unidad_rendimiento: rec.unidad_rendimiento || 'kg',
      instrucciones: rec.instrucciones || '',
      uso_aplicacion: rec.uso_aplicacion || '',
      decoracion_texto: '',
      es_elaborado: rec.es_elaborado !== false,  // default true (sub-receta)
      costo_indirecto_pct: '',
      pct_costo_ideal: '',
      activa: true,
      foto_url: '',
      foto_origen: '',
      creada_por: 'sistema@sprint1.5_marcos',
      creado_at: ahora,
      actualizado_por: 'sistema@sprint1.5_marcos',
      actualizado_at: ahora
    });
    filasRec.push(headersR.map(function(h){ return fila[h]; }));
    nombresRecetaSet.add(normalizar(nombre));
    resumen.recetas_creadas++;

    // Resolver ingredientes
    (rec.ingredientes || []).forEach(function(ing, idx) {
      var nIng = normalizar(ing.nombre_ingrediente || ing.nombre);
      var resuelto = mapaIng[nIng];
      var subResuelto = mapaRec[nIng];
      irC++;
      var irId = 'IR-' + String(irC).padStart(5, '0');
      var advertencia = '';
      var ingredienteId = '', subrecetaId = '';
      if (resuelto) ingredienteId = resuelto.id;
      else if (subResuelto) subrecetaId = subResuelto.id;
      else { advertencia = 'No resuelto: ' + (ing.nombre_ingrediente || ing.nombre); resumen.ingredientes_no_resueltos.push({ receta: nombre, ingrediente: ing.nombre_ingrediente }); }

      var filaIR = {};
      headersIR.forEach(function(h){ filaIR[h] = ''; });
      Object.assign(filaIR, {
        id: irId,
        receta_id: recId,
        ingrediente_id: ingredienteId,
        subreceta_id: subrecetaId,
        cantidad: Number(ing.cantidad) || 0,
        unidad: ing.unidad || 'kg',
        merma_extra_pct: 0,
        es_decoracion: false,
        orden: idx + 1,
        advertencia: advertencia
      });
      filasIR.push(headersIR.map(function(h){ return filaIR[h]; }));
      resumen.ir_creadas++;
    });
  });

  if (filasRec.length) shR.getRange(shR.getLastRow() + 1, 1, filasRec.length, headersR.length).setValues(filasRec);
  if (filasIR.length) shIR.getRange(shIR.getLastRow() + 1, 1, filasIR.length, headersIR.length).setValues(filasIR);

  return { ok: true, resumen: resumen };
}

// =============== Migración V2: Marcos-style (3 mermas + aliases + FR origen) ===============
// Idempotente: agrega columnas faltantes a Ingredientes sin perder datos.
// Migra `merma_pct` original → `merma_no_aprovechable_pct` (la merma "tradicional" es la no aprovechable).
function migrarIngredientesMarcosV2() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ingredientes');
  if (!sh) throw new Error('Hoja Ingredientes no existe.');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  // Schema esperado (orden importa)
  // V2 schema (sin costo_promedio aún) — esta migración solo agrega 3 mermas + aliases sobre la V1
  var ESPERADO = ['id','empresa_id','nombre','aliases','categoria','tipo_abc','es_subreceta_catalogo','dato_incompleto','inventariable','unidad_base','precio_compra','precio_compra_estimado','precio_origen','merma_deshielo_pct','merma_aprovechable_pct','merma_no_aprovechable_pct','merma_pct','factor_rendimiento','factor_rendimiento_origen','precio_real_unitario','activo','creado_at','creado_por','actualizado_at','actualizado_por'];

  // Si ya está migrada, salir
  if (headers.length === ESPERADO.length && headers.every(function(h, i){ return h === ESPERADO[i]; })) {
    console.log('✓ Ingredientes ya está en V2.');
    return { ok: true, ya_migrada: true };
  }

  // Detectar índices de columnas viejas
  var idxMermaVieja = headers.indexOf('merma_pct');
  var idxFRVieja    = headers.indexOf('factor_rendimiento');

  // Leer todos los datos actuales (sin header)
  var ultFila = sh.getLastRow();
  var ultCol = sh.getLastColumn();
  var datos = ultFila > 1 ? sh.getRange(2, 1, ultFila - 1, ultCol).getValues() : [];

  // Construir filas nuevas en el orden ESPERADO
  function valor(headerNombre, fila) {
    var i = headers.indexOf(headerNombre);
    return i >= 0 ? fila[i] : null;
  }
  var datosNuevos = datos.map(function(fila){
    var mermaVieja = idxMermaVieja >= 0 ? Number(fila[idxMermaVieja]) || 0 : 0;
    var nueva = {};
    ESPERADO.forEach(function(h){ nueva[h] = valor(h, fila); });
    // Inicializar campos nuevos con defaults
    if (nueva.aliases === null) nueva.aliases = '';
    if (nueva.merma_deshielo_pct === null) nueva.merma_deshielo_pct = 0;
    if (nueva.merma_aprovechable_pct === null) nueva.merma_aprovechable_pct = 0;
    // merma_no_aprovechable_pct: hereda del merma_pct viejo
    if (nueva.merma_no_aprovechable_pct === null) nueva.merma_no_aprovechable_pct = mermaVieja;
    // merma_pct: total recalculado (suma de los 3)
    nueva.merma_pct = (Number(nueva.merma_deshielo_pct) || 0)
                    + (Number(nueva.merma_aprovechable_pct) || 0)
                    + (Number(nueva.merma_no_aprovechable_pct) || 0);
    // factor_rendimiento_origen: 'pruebas' si Marcos lo confirmó, 'merma_calc' si viene de merma
    if (nueva.factor_rendimiento_origen === null) {
      var fr = Number(nueva.factor_rendimiento) || 1;
      nueva.factor_rendimiento_origen = fr > 1.001 ? 'merma_calc' : 'default';
    }
    return ESPERADO.map(function(h){ return nueva[h]; });
  });

  // Limpiar hoja y reescribir con nuevo schema
  sh.clear();
  var range = sh.getRange(1, 1, 1, ESPERADO.length);
  range.setValues([ESPERADO]);
  range.setFontWeight('bold').setBackground('#b8472a').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  if (datosNuevos.length) {
    sh.getRange(2, 1, datosNuevos.length, ESPERADO.length).setValues(datosNuevos);
  }

  console.log('✓ Migrada V2:', datosNuevos.length, 'filas.');
  return { ok: true, filas_migradas: datosNuevos.length };
}

// =============== Endpoint admin Sprint 1 (uso interno Claude) ===============
// Recibe payload con: { precios:[...], fotos:[...], factor_rendimiento:[...], mermas:[...], aliases:[...] }
// Cada categoría se aplica de forma independiente. Idempotente y blindada con secret.
function handleRecetarioActualizarLote(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  var payload;
  try { payload = JSON.parse(p.payload || p.data || '{}'); }
  catch(e) { return { ok:false, error:'JSON inválido: ' + e.message, raw: String(p.payload || '').substring(0, 200) }; }

  // DEBUG temporal
  if (p.debug) {
    return {
      ok: true, debug: true,
      tiene_payload: !!p.payload,
      payload_size: (p.payload || '').length,
      precios_count: (payload.precios || []).length,
      fotos_count: (payload.fotos || []).length,
      primer_precio: (payload.precios || [])[0] || null,
      ingrediente_existe: rowsToObjects(getSheet('Ingredientes')).find(function(r){ return r.id === ((payload.precios || [])[0] || {}).id; }) || null
    };
  }

  var ahora = new Date();
  var fechaStr = Utilities.formatDate(ahora, Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd');
  var horaStr = Utilities.formatDate(ahora, Session.getScriptTimeZone() || 'GMT', 'HH:mm:ss');
  var emailSistema = 'sistema@refresco-web';
  var resumen = { precios_actualizados: 0, precios_pisados_skip: 0, fotos_actualizadas: 0, fotos_pisadas_skip: 0 };

  // ---------- Precios ----------
  if (payload.precios && payload.precios.length) {
    var sh = getSheet('Ingredientes');
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var rows = rowsToObjects(sh);
    var hh = getSheet('HistorialPrecios');
    var filasHist = [];
    var actualizaciones = [];
    payload.precios.forEach(function(p){
      var ing = rows.find(function(r){ return r.id === p.id; });
      if (!ing) return;
      // Solo actualizar si era estimado (no pisar capturados reales)
      if (!_truthy(ing.ultimo_costo_estimado)) {
        resumen.precios_pisados_skip++;
        return;
      }
      var nuevo = Number(p.ultimo_costo);
      if (isNaN(nuevo) || nuevo <= 0) return;
      var anterior = ing.ultimo_costo === '' || ing.ultimo_costo == null ? null : Number(ing.ultimo_costo);
      if (anterior === nuevo) return;
      actualizaciones.push({ ing: ing, anterior: anterior, nuevo: nuevo, origen: p.precio_origen || 'web_busqueda' });
    });
    actualizaciones.forEach(function(a){
      var col = headers.indexOf('ultimo_costo') + 1;
      var colOri = headers.indexOf('precio_origen') + 1;
      var pruCol = headers.indexOf('precio_real_unitario') + 1;
      var aatCol = headers.indexOf('actualizado_at') + 1;
      var aapCol = headers.indexOf('actualizado_por') + 1;
      sh.getRange(a.ing._row, col).setValue(a.nuevo);
      if (colOri > 0) sh.getRange(a.ing._row, colOri).setValue(a.origen);
      // precio sigue siendo estimado (es de web, no de proveedor real) — Estefanía lo marca real al editar
      // Recalcular precio_real_unitario
      var merma = Number(a.ing.merma_pct) || 0;
      var fr = Number(a.ing.factor_rendimiento) || 1;
      var factor = Math.max(1 + merma / 100, fr);
      if (pruCol > 0) sh.getRange(a.ing._row, pruCol).setValue(Number((a.nuevo * factor).toFixed(4)));
      if (aatCol > 0) sh.getRange(a.ing._row, aatCol).setValue(ahora);
      if (aapCol > 0) sh.getRange(a.ing._row, aapCol).setValue(emailSistema);
      filasHist.push([uuid(), a.ing.id, '', 'ultimo_costo', a.anterior, a.nuevo, emailSistema, fechaStr, horaStr, 'refresco_web', false]);
      resumen.precios_actualizados++;
    });
    if (filasHist.length) hh.getRange(hh.getLastRow() + 1, 1, filasHist.length, filasHist[0].length).setValues(filasHist);
  }

  // ---------- Fotos ----------
  if (payload.fotos && payload.fotos.length) {
    var shR = getSheet('Recetas');
    var headersR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0];
    var rowsR = rowsToObjects(shR);
    var hhR = getSheet('HistorialRecetas');
    var filasHistR = [];
    payload.fotos.forEach(function(f){
      var rec = rowsR.find(function(r){ return r.id === f.receta_id; });
      if (!rec) return;
      // Solo actualizar si la foto actual es placeholder
      if (rec.foto_origen !== 'placeholder' && rec.foto_origen !== '') {
        resumen.fotos_pisadas_skip++;
        return;
      }
      var colFoto = headersR.indexOf('foto_url') + 1;
      var colOri = headersR.indexOf('foto_origen') + 1;
      var aatCol = headersR.indexOf('actualizado_at') + 1;
      var aapCol = headersR.indexOf('actualizado_por') + 1;
      var anterior = rec.foto_url || '';
      sh.getRange; // no-op para satisfacer linter
      shR.getRange(rec._row, colFoto).setValue(f.foto_url);
      if (colOri > 0) shR.getRange(rec._row, colOri).setValue(f.foto_origen || 'web');
      if (aatCol > 0) shR.getRange(rec._row, aatCol).setValue(ahora);
      if (aapCol > 0) shR.getRange(rec._row, aapCol).setValue(emailSistema);
      filasHistR.push([uuid(), rec.id, '', 'modificó',
        JSON.stringify({ campo: 'foto_url', anterior: anterior, fuente: 'refresco_web' }),
        emailSistema, fechaStr, horaStr, 'refresco_web', false]);
      resumen.fotos_actualizadas++;
    });
    if (filasHistR.length) hhR.getRange(hhR.getLastRow() + 1, 1, filasHistR.length, filasHistR[0].length).setValues(filasHistR);
  }

  // ---------- Factor de Rendimiento + Mermas (Sprint 1 — datos de Marcos) ----------
  if (payload.fr_mermas && payload.fr_mermas.length) {
    var sh3 = getSheet('Ingredientes');
    var headers3 = sh3.getRange(1, 1, 1, sh3.getLastColumn()).getValues()[0];
    var rows3 = rowsToObjects(sh3);
    var hh3 = getSheet('HistorialPrecios');
    var filasHist3 = [];
    payload.fr_mermas.forEach(function(item){
      var ing = rows3.find(function(r){ return r.id === item.id; });
      if (!ing) return;
      var cambios = [];
      ['merma_deshielo_pct','merma_aprovechable_pct','merma_no_aprovechable_pct','factor_rendimiento','factor_rendimiento_origen'].forEach(function(campo){
        if (item[campo] === undefined || item[campo] === null) return;
        var col = headers3.indexOf(campo) + 1;
        if (col <= 0) return;
        var anterior = ing[campo];
        var nuevo = item[campo];
        if (campo !== 'factor_rendimiento_origen') {
          nuevo = Number(nuevo);
          anterior = anterior === '' || anterior == null ? 0 : Number(anterior);
          if (isNaN(nuevo)) return;
        }
        if (String(anterior) === String(nuevo)) return;
        sh3.getRange(ing._row, col).setValue(nuevo);
        ing[campo] = nuevo;
        cambios.push({ campo: campo, anterior: anterior, nuevo: nuevo });
      });
      // Recalcular merma_pct total
      var colTot = headers3.indexOf('merma_pct') + 1;
      if (colTot > 0) {
        var total = (Number(ing.merma_deshielo_pct) || 0) + (Number(ing.merma_aprovechable_pct) || 0) + (Number(ing.merma_no_aprovechable_pct) || 0);
        sh3.getRange(ing._row, colTot).setValue(total);
        ing.merma_pct = total;
      }
      // Recalcular precio_real_unitario
      var precio = Number(ing.ultimo_costo) || 0;
      var fr = Number(ing.factor_rendimiento) || 1;
      var factorMerma = 1 + (Number(ing.merma_pct) || 0) / 100;
      var factor = Math.max(factorMerma, fr);
      var pruCol = headers3.indexOf('precio_real_unitario') + 1;
      if (pruCol > 0 && precio > 0) sh3.getRange(ing._row, pruCol).setValue(Number((precio * factor).toFixed(4)));

      cambios.forEach(function(c){
        filasHist3.push([uuid(), ing.id, '', c.campo, c.anterior, c.nuevo, emailSistema, fechaStr, horaStr, 'pruebas_marcos', false]);
      });
      if (cambios.length) resumen.fr_mermas_actualizados = (resumen.fr_mermas_actualizados || 0) + 1;
    });
    if (filasHist3.length) hh3.getRange(hh3.getLastRow() + 1, 1, filasHist3.length, filasHist3[0].length).setValues(filasHist3);
  }

  // ---------- Aliases (reconciliación de typos del inventario manual de Marcos) ----------
  if (payload.aliases && payload.aliases.length) {
    var sh4 = getSheet('Ingredientes');
    var headers4 = sh4.getRange(1, 1, 1, sh4.getLastColumn()).getValues()[0];
    var rows4 = rowsToObjects(sh4);
    var colA = headers4.indexOf('aliases') + 1;
    if (colA > 0) {
      payload.aliases.forEach(function(item){
        var ing = rows4.find(function(r){ return r.id === item.id; });
        if (!ing) return;
        var existente = String(ing.aliases || '').split('|').filter(function(x){ return x.trim(); });
        var nuevos = (item.aliases || []).filter(function(a){ return existente.indexOf(a) === -1; });
        if (!nuevos.length) return;
        var todos = existente.concat(nuevos).join('|');
        sh4.getRange(ing._row, colA).setValue(todos);
        resumen.aliases_actualizados = (resumen.aliases_actualizados || 0) + nuevos.length;
      });
    }
  }

  return { ok: true, resumen: resumen };
}

// =============== Helpers ===============
// Roles con acceso de lectura completo al módulo
var RECETARIO_ROLES_LECTURA = ['admin','gerente_administrativo','auditoria','cocina','churrasca','barman','panadero','comprador'];
// Roles con acceso de edición de precios/ingredientes
var RECETARIO_ROLES_EDITA_PRECIOS = ['admin','gerente_administrativo','comprador'];
// Roles que pueden editar config global
var RECETARIO_ROLES_CONFIG = ['admin','gerente_administrativo','auditoria'];

// Helper para convertir valores que pueden venir como booleano string desde el Sheet
function _truthy(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === 'VERDADERO' || v === 'Sí' || v === 'Si';
}

// =============== Config del módulo ===============
function handleRecetarioConfigGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_LECTURA)) return { ok:false, error:'Sin permiso' };
  var conf = rowsToObjects(getSheet('EmpresaConfig')).find(function(r){ return r.empresa_id === u.empresa_id; });
  if (!conf) {
    return { ok: true, config: { costo_indirecto_pct: 10, pct_costo_ideal: 30, iva_default: 16 }, default_aplicado: true };
  }
  return { ok: true, config: {
    costo_indirecto_pct: Number(conf.costo_indirecto_pct) || 0,
    pct_costo_ideal:     Number(conf.pct_costo_ideal) || 30,
    iva_default:         Number(conf.iva_default) || 16
  }};
}

function handleRecetarioConfigSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_CONFIG)) return { ok:false, error:'Solo Admin/Auditoría pueden cambiar la configuración' };
  var sh = getSheet('EmpresaConfig');
  var rows = rowsToObjects(sh);
  var ahora = new Date();
  var ci = Number(p.costo_indirecto_pct);
  var pi = Number(p.pct_costo_ideal);
  var iva = Number(p.iva_default);
  if (isNaN(ci) || ci < 0 || ci > 100) return { ok:false, error:'costo_indirecto_pct inválido (0-100)' };
  if (isNaN(pi) || pi < 1 || pi > 100) return { ok:false, error:'pct_costo_ideal inválido (1-100)' };
  if (isNaN(iva) || iva < 0 || iva > 50) return { ok:false, error:'iva_default inválido (0-50)' };
  var existing = rows.find(function(r){ return r.empresa_id === u.empresa_id; });
  if (existing) {
    sh.getRange(existing._row, 1, 1, 6).setValues([[u.empresa_id, ci, pi, iva, u.email, ahora]]);
  } else {
    sh.appendRow([u.empresa_id, ci, pi, iva, u.email, ahora]);
  }
  return { ok: true };
}

// =============== Ingredientes ===============
function handleIngredientesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_LECTURA)) return { ok:false, error:'Sin permiso' };
  var rows = rowsToObjects(getSheet('Ingredientes')).filter(function(r){ return r.empresa_id === u.empresa_id; });
  if (p.categoria) rows = rows.filter(function(r){ return r.categoria === p.categoria; });
  if (p.solo_estimados === '1' || p.solo_estimados === 'true') {
    rows = rows.filter(function(r){ return _truthy(r.ultimo_costo_estimado); });
  }
  if (p.q) {
    var q = String(p.q).toLowerCase().trim();
    rows = rows.filter(function(r){ return String(r.nombre || '').toLowerCase().indexOf(q) !== -1; });
  }
  rows.sort(function(a, b){
    var c = String(a.categoria || '').localeCompare(String(b.categoria || ''));
    if (c !== 0) return c;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''));
  });

  // F3 Fase B (v149) — adjuntar stock SR12 a cada ingrediente.
  // Dos rutas de match:
  //   A) ing.clave_sr12 directo en hoja Ingredientes (v130)
  //   B) ingrediente_id_fogueira → clave_sr12 vía tabla puente IngredientesSR12Match
  // Si la hoja IngredientesSR12 no existe (instalación pre-F3), simplemente devolvemos sr12=null.
  var sr12PorClave = {};
  var claveSr12PorIngId = {};
  try {
    var ss = SpreadsheetApp.getActive();
    var shSr12 = ss.getSheetByName('IngredientesSR12');
    if (shSr12) {
      rowsToObjects(shSr12).forEach(function(s){
        if (s.empresa_id !== u.empresa_id) return;
        if (!s.clave_sr12) return;
        sr12PorClave[String(s.clave_sr12)] = s;
      });
    }
    var shMatch = ss.getSheetByName('IngredientesSR12Match');
    if (shMatch) {
      rowsToObjects(shMatch).forEach(function(m){
        if (m.empresa_id !== u.empresa_id) return;
        if (m.ingrediente_id_fogueira && m.clave_sr12) {
          claveSr12PorIngId[String(m.ingrediente_id_fogueira)] = String(m.clave_sr12);
        }
      });
    }
  } catch (e) {
    // No bloquear el endpoint si el lookup SR12 falla — log y seguir.
    try { Logger.log('Stock SR12 lookup falló: ' + e); } catch(_){}
  }
  function _sr12Para(r) {
    var clave = r.clave_sr12 ? String(r.clave_sr12) : (claveSr12PorIngId[String(r.id)] || '');
    if (!clave) return { clave_sr12: '', sr12: null };
    var s = sr12PorClave[clave];
    if (!s) return { clave_sr12: clave, sr12: null };
    var n = function(x){ var v = Number(x); return isNaN(v) ? 0 : v; };
    return {
      clave_sr12: clave,
      sr12: {
        clave: clave,
        nombre_sr12: s.nombre_sr12 || '',
        unidad_base: s.unidad_base || '',
        presentacion_descripcion: s.presentacion_descripcion || '',
        almacen:   n(s.existencia_almacen),
        barra:     n(s.existencia_barra),
        cava:      n(s.existencia_cava),
        churrasca: n(s.existencia_churrasca),
        cocina:    n(s.existencia_cocina),
        piso:      n(s.existencia_piso),
        total:     n(s.existencia_total),
        actualizado_at: s.actualizado_at || ''
      }
    };
  }

  var lista = rows.map(function(r){
    var sr = _sr12Para(r);
    return {
      id: r.id, nombre: r.nombre,
      aliases: String(r.aliases || '').split('|').filter(function(x){ return x.trim(); }),
      categoria: r.categoria,
      tipo_abc: r.tipo_abc || '',
      inventariable: r.inventariable === '' || r.inventariable == null ? true : _truthy(r.inventariable),
      unidad_base: r.unidad_base,
      ultimo_costo: r.ultimo_costo === '' ? null : Number(r.ultimo_costo),
      costo_promedio: r.costo_promedio === '' ? null : Number(r.costo_promedio),
      ultimo_costo_estimado: _truthy(r.ultimo_costo_estimado),
      precio_origen: r.precio_origen,
      merma_deshielo_pct:       r.merma_deshielo_pct === '' ? 0 : Number(r.merma_deshielo_pct),
      merma_aprovechable_pct:   r.merma_aprovechable_pct === '' ? 0 : Number(r.merma_aprovechable_pct),
      merma_no_aprovechable_pct: r.merma_no_aprovechable_pct === '' ? 0 : Number(r.merma_no_aprovechable_pct),
      merma_pct: r.merma_pct === '' ? 0 : Number(r.merma_pct),
      factor_rendimiento: r.factor_rendimiento === '' ? 1 : Number(r.factor_rendimiento),
      factor_rendimiento_origen: r.factor_rendimiento_origen || 'default',
      precio_real_unitario: r.precio_real_unitario === '' ? null : Number(r.precio_real_unitario),
      es_subreceta_catalogo: _truthy(r.es_subreceta_catalogo),
      dato_incompleto: _truthy(r.dato_incompleto),
      activo: _truthy(r.activo),
      clave_sr12: sr.clave_sr12,
      sr12: sr.sr12
    };
  });
  return { ok: true, ingredientes: lista, total: lista.length };
}

// Update de ingrediente con historial blindado + guardrail de edición masiva
function handleIngredienteUpdate(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_EDITA_PRECIOS)) return { ok:false, error:'Solo Admin/Comprador editan precios' };
  var sh = getSheet('Ingredientes');
  var rows = rowsToObjects(sh);
  var ing = rows.find(function(r){ return r.id === p.id && r.empresa_id === u.empresa_id; });
  if (!ing) return { ok:false, error:'Ingrediente no encontrado' };

  var ahora = new Date();
  var fechaStr = Utilities.formatDate(ahora, Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd');
  var horaStr = Utilities.formatDate(ahora, Session.getScriptTimeZone() || 'GMT', 'HH:mm:ss');
  var hh = getSheet('HistorialPrecios');
  var cambios = [];

  var editables = ['ultimo_costo','costo_promedio','merma_deshielo_pct','merma_aprovechable_pct','merma_no_aprovechable_pct','factor_rendimiento','unidad_base','inventariable','tipo_abc','aliases'];
  editables.forEach(function(campo){
    if (p[campo] === undefined || p[campo] === null || p[campo] === '') return;
    var nuevo = p[campo];
    var anterior = ing[campo];
    if (['ultimo_costo','costo_promedio','merma_deshielo_pct','merma_aprovechable_pct','merma_no_aprovechable_pct','factor_rendimiento'].indexOf(campo) !== -1) {
      nuevo = Number(nuevo);
      anterior = anterior === '' || anterior == null ? null : Number(anterior);
      if (isNaN(nuevo)) return;
    }
    if (campo === 'inventariable') {
      nuevo = _truthy(nuevo);
      anterior = anterior === '' || anterior == null ? true : _truthy(anterior);
    }
    if (campo === 'tipo_abc') {
      nuevo = String(nuevo).toUpperCase();
      if (['A','B','C',''].indexOf(nuevo) === -1) return; // solo A/B/C válidos
    }
    if (String(anterior) === String(nuevo)) return;
    cambios.push({ campo: campo, anterior: anterior, nuevo: nuevo });
  });

  if (!cambios.length) return { ok: true, sin_cambios: true };

  // Guardrail: ¿este usuario hizo >20 cambios en los últimos 5 min?
  var hace5min = new Date(ahora.getTime() - 5 * 60 * 1000);
  var historiales = rowsToObjects(hh);
  var recientesUsuario = historiales.filter(function(h){
    if (h.usuario_email !== u.email) return false;
    var f = h.fecha instanceof Date ? h.fecha : (h.fecha ? new Date(h.fecha) : null);
    if (!f || isNaN(f.getTime())) return false;
    var hr = String(h.hora || '0:0:0').split(':');
    var fc = new Date(f.getFullYear(), f.getMonth(), f.getDate(), Number(hr[0])||0, Number(hr[1])||0, Number(hr[2])||0);
    return fc >= hace5min;
  });
  var alertaMasiva = recientesUsuario.length >= 20;

  // Aplicar cambios
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cambios.forEach(function(c){
    var col = headers.indexOf(c.campo) + 1;
    if (col > 0) sh.getRange(ing._row, col).setValue(c.nuevo);
    ing[c.campo] = c.nuevo;
  });
  // Si capturó precio real, marcar como NO estimado
  if (cambios.some(function(c){ return c.campo === 'ultimo_costo'; })) {
    var colEst = headers.indexOf('ultimo_costo_estimado') + 1;
    var colOri = headers.indexOf('precio_origen') + 1;
    if (colEst > 0) sh.getRange(ing._row, colEst).setValue(false);
    if (colOri > 0) sh.getRange(ing._row, colOri).setValue('capturado_real');
  }
  // Recalcular merma_pct (total) si cambiaron alguno de los 3 sub-tipos
  if (cambios.some(function(c){ return c.campo.indexOf('merma_') === 0 && c.campo !== 'merma_pct'; })) {
    var totalMerma = (Number(ing.merma_deshielo_pct) || 0) + (Number(ing.merma_aprovechable_pct) || 0) + (Number(ing.merma_no_aprovechable_pct) || 0);
    var colTotMerma = headers.indexOf('merma_pct') + 1;
    if (colTotMerma > 0) sh.getRange(ing._row, colTotMerma).setValue(totalMerma);
    ing.merma_pct = totalMerma;
  }
  // Recalcular precio_real_unitario
  var precio = Number(ing.ultimo_costo) || 0;
  var merma = Number(ing.merma_pct) || 0;
  var fr = Number(ing.factor_rendimiento) || 1;
  var factor = Math.max(1 + merma / 100, fr);
  var pruCol = headers.indexOf('precio_real_unitario') + 1;
  if (pruCol > 0 && precio > 0) sh.getRange(ing._row, pruCol).setValue(Number((precio * factor).toFixed(4)));
  var aatCol = headers.indexOf('actualizado_at') + 1;
  var aapCol = headers.indexOf('actualizado_por') + 1;
  if (aatCol > 0) sh.getRange(ing._row, aatCol).setValue(ahora);
  if (aapCol > 0) sh.getRange(ing._row, aapCol).setValue(u.email);

  // Historial: una fila por campo cambiado
  var filasHist = cambios.map(function(c){
    return [uuid(), ing.id, '', c.campo, c.anterior, c.nuevo, u.email, fechaStr, horaStr, '', alertaMasiva];
  });
  if (filasHist.length) hh.getRange(hh.getLastRow() + 1, 1, filasHist.length, filasHist[0].length).setValues(filasHist);

  return { ok: true, cambios: cambios.length, alerta_masiva: alertaMasiva };
}

// =============== Fusionar insumos duplicados (v382) ===============
// Resuelve duplicados de catálogo: re-apunta TODAS las líneas de receta del insumo `from_id`
// (el duplicado a retirar) al insumo `to_id` (el bueno, normalmente la entrada del SR12) y
// DESACTIVA el duplicado. Atómico en el servidor (no pasa por propose/authorize). Respeta la
// regla "precio real = SR12": el destino debe ser el insumo correcto. Solo admin/gte_admin.
function handleIngredienteFusionar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin puede fusionar insumos' };
  var fromId = String(p.from_id||'').trim();
  var toId = String(p.to_id||'').trim();
  if (!fromId || !toId) return { ok:false, error:'Faltan from_id/to_id' };
  if (fromId === toId) return { ok:false, error:'from_id y to_id son el mismo' };

  var shI = getSheet('Ingredientes');
  var ings = rowsToObjects(shI);
  var from = ings.find(function(x){ return x.id === fromId && x.empresa_id === u.empresa_id; });
  var to   = ings.find(function(x){ return x.id === toId   && x.empresa_id === u.empresa_id; });
  if (!from) return { ok:false, error:'Insumo origen no encontrado' };
  if (!to)   return { ok:false, error:'Insumo destino no encontrado' };

  // 1) Re-apuntar líneas de receta from → to
  var shL = getSheet('IngredientesReceta');
  var headersL = shL.getRange(1,1,1,shL.getLastColumn()).getValues()[0];
  var colIng = headersL.indexOf('ingrediente_id') + 1;
  var reapuntadas = 0;
  if (colIng > 0) {
    rowsToObjects(shL).forEach(function(l){
      if (String(l.ingrediente_id) === fromId) { shL.getRange(l._row, colIng).setValue(toId); reapuntadas++; }
    });
  }

  // 2) Desactivar el duplicado + dejar rastro (aliases) de a dónde se fusionó
  var headersI = shI.getRange(1,1,1,shI.getLastColumn()).getValues()[0];
  var colAct = headersI.indexOf('activo') + 1;
  var colAli = headersI.indexOf('aliases') + 1;
  var colUpd = headersI.indexOf('actualizado_at') + 1;
  if (colAct > 0) shI.getRange(from._row, colAct).setValue(false);
  if (colAli > 0) { var ali = String(from.aliases||''); shI.getRange(from._row, colAli).setValue((ali ? ali+' | ' : '') + 'FUSIONADO→'+toId+' ('+(to.nombre||'')+')'); }
  if (colUpd > 0) shI.getRange(from._row, colUpd).setValue(new Date());

  return { ok:true, from:from.nombre, to:to.nombre, reapuntadas:reapuntadas };
}

// Re-apunta SOLO las líneas de receta de un insumo (from) a otro (to) cuya unidad pertenece a
// una familia dada (ej. solo las que están en "pza"). A diferencia de ingrediente_fusionar
// (re-apunta TODO y desactiva el origen), esto es PARCIAL y NO desactiva el origen — sirve para
// el caso recurrente de un duplicado que se usa BIEN por kg pero MAL por pieza (o viceversa):
// p.ej. "Huevo entero" ($62/kg) bien en kg pero mal con "60 pz" → re-apuntar solo las pz al
// "HUEVO X PIEZA" del SR12 ($4.16/pza) y dejar intactas las líneas en kg (v405).
// Solo cambia la celda ingrediente_id; conserva cantidad/unidad/merma/orden de cada línea.
function handleIngredienteRepuntarLineas(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin puede re-apuntar líneas' };
  var fromId = String(p.from_id||'').trim();
  var toId = String(p.to_id||'').trim();
  // familias: CSV de familias de unidad (gr|ml|kg|lt|pza) — solo se re-apuntan las líneas de esas familias
  var fams = String(p.familias||'').toLowerCase().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  if (!fromId || !toId) return { ok:false, error:'Faltan from_id/to_id' };
  if (fromId === toId) return { ok:false, error:'from_id y to_id son el mismo' };
  if (!fams.length) return { ok:false, error:'Falta familias (ej "pza")' };

  var shI = getSheet('Ingredientes');
  var ings = rowsToObjects(shI);
  var from = ings.find(function(x){ return x.id === fromId && x.empresa_id === u.empresa_id; });
  var to   = ings.find(function(x){ return x.id === toId   && x.empresa_id === u.empresa_id; });
  if (!from) return { ok:false, error:'Insumo origen no encontrado' };
  if (!to)   return { ok:false, error:'Insumo destino no encontrado' };

  var shL = getSheet('IngredientesReceta');
  var headersL = shL.getRange(1,1,1,shL.getLastColumn()).getValues()[0];
  var colIng = headersL.indexOf('ingrediente_id') + 1;
  var detalle = [];
  if (colIng > 0) {
    rowsToObjects(shL).forEach(function(l){
      if (String(l.ingrediente_id) === fromId && fams.indexOf(_recetaUnidadFamilia(l.unidad)) !== -1) {
        shL.getRange(l._row, colIng).setValue(toId);
        detalle.push({ receta_id: l.receta_id, cantidad: l.cantidad, unidad: l.unidad });
      }
    });
  }
  return { ok:true, from:from.nombre, to:to.nombre, familias:fams, reapuntadas:detalle.length, detalle:detalle };
}

// =============== Recetas ===============
// Helper: detecta si las instrucciones son solo placeholder vacío del Excel
// (numeración "1.- 2.- 3.-" sin contenido real). 141/219 recetas tienen este patrón.
function _instruccionesSonPlaceholder(txt) {
  var t = String(txt || '').trim();
  if (!t) return true; // vacío también cuenta como pendiente
  var limpio = t.replace(/[\d\.\-\s]/g, '');
  return limpio.length < 5;
}

// Área que le corresponde a un rol de chef. Vacío = ve todas (admin/gerente/auditoria/comprador).
// Áreas que cubre un rol de chef (puede ser más de una: el barman lleva barra + cava).
function _areasDeRol(rol){
  var r = String(rol || '').toLowerCase();
  if (r === 'cocina') return ['cocina'];
  if (r === 'churrasca') return ['churrasca'];
  if (r === 'barman') return ['barra','cava'];   // el encargado de barra también lleva la Cava
  if (r === 'panadero') return ['panaderia'];
  return [];  // admin/gerente/auditoria/comprador → ven todas las áreas
}
// Compat: área única (string) o '' si el rol cubre 0 o varias áreas.
function _areaDeRol(rol){ var a = _areasDeRol(rol); return a.length === 1 ? a[0] : ''; }

// ── Detector de cantidad ABSURDA en una línea de receta (errores de captura ×1000,
// tipo "500 kg de miel" en vez de 0.5). Umbrales generosos para NO molestar en lotes
// grandes legítimos. Devuelve true si la cantidad es físicamente improbable por su unidad.
// El detector de COSTO de línea (> $3000) vive donde ya se calcula el costo, no aquí.
var _RECETA_CANT_UMBRAL = { gr:100000, ml:100000, kg:100, lt:100, pza:500 };
function _recetaUnidadFamilia(unidad){
  var u = String(unidad||'').trim().toLowerCase();
  if (['gr','g','gramo','gramos','grs'].indexOf(u) !== -1) return 'gr';
  if (['ml','mililitro','mililitros','cc'].indexOf(u) !== -1) return 'ml';
  if (['kg','kilo','kilos','kilogramo','kilogramos','kgs'].indexOf(u) !== -1) return 'kg';
  if (['lt','l','litro','litros','lts'].indexOf(u) !== -1) return 'lt';
  if (['pza','pieza','piezas','pz','pzas','unidad','unidades','u','pieza(s)'].indexOf(u) !== -1) return 'pza';
  return '';
}
function _recetaCantidadSospechosa(cantidad, unidad){
  var c = parseFloat(cantidad) || 0;
  if (c <= 0) return false;
  var fam = _recetaUnidadFamilia(unidad);
  var umbral = _RECETA_CANT_UMBRAL[fam];
  return umbral != null && c > umbral;
}

function handleRecetasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_LECTURA)) return { ok:false, error:'Sin permiso' };
  var rows = rowsToObjects(getSheet('Recetas')).filter(function(r){ return r.empresa_id === u.empresa_id; });
  // Los chefs ven SOLO su área (cocina→cocina, churrasca→churrasca). Forzado en backend, no solo en UI.
  var _areasRol = _areasDeRol(u.rol);
  if (_areasRol.length) rows = rows.filter(function(r){ return _areasRol.indexOf(r.area) !== -1; });
  // KPI global ANTES de filtros de UI, pero SOLO sobre recetas ACTIVAS: una receta dada de baja
  // (o duplicado desactivado) NO debe contar como "pendiente sin instrucciones" — reporte de
  // Estefanía 2026-06-15. Antes contaba todas y inflaba el KPI con las inactivas. v403.
  var rowsActivas = rows.filter(function(r){ return _truthy(r.activa); });
  var totalAntes = rowsActivas.length;
  var conInstrReales = rowsActivas.filter(function(r){ return !_instruccionesSonPlaceholder(r.instrucciones); }).length;
  var sinInstrucciones = totalAntes - conInstrReales;
  // Aplicar filtros
  if (p.area) rows = rows.filter(function(r){ return r.area === p.area; });
  if (p.categoria) rows = rows.filter(function(r){ return r.categoria_culinaria === p.categoria; });
  if (p.tipo === 'subreceta') rows = rows.filter(function(r){ return _truthy(r.es_elaborado); });
  else if (p.tipo === 'platillo') rows = rows.filter(function(r){ return !_truthy(r.es_elaborado); });
  if (p.solo_activas === '1' || p.solo_activas === 'true') {
    rows = rows.filter(function(r){ return _truthy(r.activa); });
  }
  if (p.solo_sin_instrucciones === '1' || p.solo_sin_instrucciones === 'true') {
    rows = rows.filter(function(r){ return _instruccionesSonPlaceholder(r.instrucciones); });
  }
  if (p.q) {
    var q = String(p.q).toLowerCase().trim();
    rows = rows.filter(function(r){ return String(r.nombre || '').toLowerCase().indexOf(q) !== -1; });
  }
  rows.sort(function(a, b){ return String(a.nombre || '').localeCompare(String(b.nombre || '')); });
  var lista = rows.map(function(r){
    return {
      id: r.id, nombre: r.nombre,
      categoria_culinaria: r.categoria_culinaria, area: r.area,
      chef_responsable_email: r.chef_responsable_email,
      rendimiento: r.rendimiento === '' ? null : Number(r.rendimiento),
      unidad_rendimiento: r.unidad_rendimiento,
      es_elaborado: _truthy(r.es_elaborado),
      activa: _truthy(r.activa),
      foto_url: r.foto_url,
      sin_instrucciones: _instruccionesSonPlaceholder(r.instrucciones)
    };
  });
  return {
    ok: true,
    recetas: lista,
    total: lista.length,
    kpis: { total: totalAntes, con_instrucciones: conInstrReales, sin_instrucciones: sinInstrucciones }
  };
}

// ★ Conversión de unidades para el costeo ★
// El precio del ingrediente está por su `unidad_base` (kg/lt/pieza, ej. $40/kg), pero las
// recetas se capturan en la unidad práctica (350 gr, 355 ml…). Devuelve el FACTOR para
// convertir `cantidad` (en unidadReceta) a la unidad_base del precio, antes de multiplicar.
//   costo = precio_por_base × cantidad × _unidadFactorBase(unidadReceta, unidadBase)
// Ej: gr→kg = 0.001, ml→lt = 0.001, kg→kg = 1. Familias distintas o unidad desconocida → 1
// (no convierte, para no romper). Esto corrige el bug de costos inflados ×1000.
function _unidadFactorBase(unidadReceta, unidadBase){
  // El catálogo trae unidades muy inconsistentes (vacías, sal en "lt", líquidos en "kg"…),
  // pero el precio_real está bien (por kg/lt). Para costear robusto:
  //  · masa y volumen se tratan COMO EQUIVALENTES (densidad ≈ 1: 1 ml ≈ 1 gr, 1 lt ≈ 1 kg).
  //  · si la unidad_base viene vacía/rara, se ASUME kg/lt (la unidad de compra estándar).
  // canon() → { fam:'mv'(masa/volumen)|'p'(pieza), f: factor a la unidad chica gr/ml/pz }
  function canon(x){
    var s = String(x == null ? '' : x).trim().toLowerCase().replace(/\.$/,'');
    if (!s) return null;
    var MV = {
      'kg':1000,'kgs':1000,'kilo':1000,'kilos':1000,'kilogramo':1000,'kilogramos':1000,
      'lt':1000,'l':1000,'lts':1000,'litro':1000,'litros':1000,
      'gr':1,'g':1,'grs':1,'gramo':1,'gramos':1,'ml':1,'mililitro':1,'mililitros':1,'cc':1,
      'mg':0.001,
      // Barra/coctelería se mide en ONZAS: 1 oz ≈ 29.57 ml/gr. Sin esto el costo de las bebidas
      // en oz no se convertía (factor 1) y salía ~34× inflado.
      'oz':29.5735,'onza':29.5735,'onzas':29.5735,'onz':29.5735,'onz.':29.5735
    };
    if (MV[s] != null) return { fam:'mv', f:MV[s] };
    var P = { 'pieza':1,'piezas':1,'pza':1,'pzas':1,'pz':1,'unidad':1,'unidades':1,'u':1 };
    if (P[s] != null) return { fam:'p', f:P[s] };
    return null; // desconocida
  }
  var r = canon(unidadReceta), b = canon(unidadBase);
  if (!b) { if (r && r.fam === 'mv') b = { fam:'mv', f:1000 }; else return 1; } // base vacía → asumir kg/lt
  if (!r) return 1;                    // unidad de receta desconocida → no convertir
  if (r.fam !== b.fam) return 1;       // pieza vs masa/volumen → no convertir
  return r.f / b.f;                    // cantidad × (canónico_receta / canónico_base) = cantidad en base
}

// Detalle de receta con sus líneas resueltas + costo calculado en vivo
function handleRecetaGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_LECTURA)) return { ok:false, error:'Sin permiso' };
  if (!p.id) return { ok:false, error:'Falta id' };
  var receta = rowsToObjects(getSheet('Recetas')).find(function(r){
    return r.id === p.id && r.empresa_id === u.empresa_id;
  });
  if (!receta) return { ok:false, error:'Receta no encontrada' };

  // Cargar mapas una vez (más eficiente que repetir lookups)
  var ingMap = {}, recMap = {};
  rowsToObjects(getSheet('Ingredientes')).forEach(function(i){ ingMap[i.id] = i; });
  rowsToObjects(getSheet('Recetas')).forEach(function(r){ recMap[r.id] = r; });
  var todasIR = rowsToObjects(getSheet('IngredientesReceta'));

  var lineas = todasIR
    .filter(function(ir){ return ir.receta_id === p.id; })
    .sort(function(a,b){ return (Number(a.orden)||0) - (Number(b.orden)||0); });

  var conf = rowsToObjects(getSheet('EmpresaConfig')).find(function(c){ return c.empresa_id === u.empresa_id; }) || { costo_indirecto_pct: 10, pct_costo_ideal: 30, iva_default: 16 };
  var ciPct = receta.costo_indirecto_pct === '' || receta.costo_indirecto_pct == null ? Number(conf.costo_indirecto_pct) : Number(receta.costo_indirecto_pct);
  var pctIdeal = receta.pct_costo_ideal === '' || receta.pct_costo_ideal == null ? Number(conf.pct_costo_ideal) : Number(receta.pct_costo_ideal);

  function costoIngrediente(ing, cantidad, unidadLinea) {
    if (!ing) return 0;
    var precio = Number(ing.precio_real_unitario) || Number(ing.ultimo_costo) || 0;
    return precio * (Number(cantidad) || 0) * _unidadFactorBase(unidadLinea, ing.unidad_base);
  }
  function costoSubreceta(subId, cantidad, depth, unidadLinea) {
    if (depth > 5) return 0;
    var sub = recMap[subId];
    if (!sub) return 0;
    var subLineas = todasIR.filter(function(ir){ return ir.receta_id === subId; });
    var costoSub = 0;
    subLineas.forEach(function(sl){
      if (sl.ingrediente_id) costoSub += costoIngrediente(ingMap[sl.ingrediente_id], sl.cantidad, sl.unidad);
      else if (sl.subreceta_id) costoSub += costoSubreceta(sl.subreceta_id, sl.cantidad, depth + 1, sl.unidad);
    });
    var rend = Number(sub.rendimiento) || 1;
    return (costoSub / rend) * (Number(cantidad) || 0) * _unidadFactorBase(unidadLinea, sub.unidad_rendimiento);
  }

  var costoIngredientes = 0, costoDecoracion = 0;
  var lineasResueltas = lineas.map(function(ir){
    var resuelto = {
      id: ir.id, cantidad: ir.cantidad, unidad: ir.unidad,
      es_decoracion: _truthy(ir.es_decoracion),
      orden: ir.orden, advertencia: ir.advertencia
    };
    var costo = 0;
    if (ir.ingrediente_id && ingMap[ir.ingrediente_id]) {
      var i = ingMap[ir.ingrediente_id];
      resuelto.tipo = 'ingrediente';
      resuelto.referencia_id = i.id;
      resuelto.referencia_nombre = i.nombre;
      resuelto.referencia_categoria = i.categoria;
      resuelto.precio_unitario = Number(i.precio_real_unitario) || Number(i.ultimo_costo) || 0; // por unidad_base del ingrediente
      // v326 — precio expresado en la MISMA unidad que la línea de la receta, para que
      // PRECIO × CANTIDAD = COSTO se lea natural (antes mostraba el precio por gramo y confundía).
      resuelto.precio_unitario_linea = resuelto.precio_unitario * _unidadFactorBase(ir.unidad, i.unidad_base);
      resuelto.precio_estimado = _truthy(i.ultimo_costo_estimado);
      // Inventariable: si está marcado false, alertar (no debería estar en receta)
      resuelto.inventariable = i.inventariable === '' || i.inventariable == null ? true : _truthy(i.inventariable);
      costo = costoIngrediente(i, ir.cantidad, ir.unidad);
    } else if (ir.subreceta_id && recMap[ir.subreceta_id]) {
      var sub = recMap[ir.subreceta_id];
      resuelto.tipo = 'subreceta';
      resuelto.referencia_id = sub.id;
      resuelto.referencia_nombre = sub.nombre;
      costo = costoSubreceta(ir.subreceta_id, ir.cantidad, 0, ir.unidad);
    } else {
      resuelto.tipo = 'huerfano';
      resuelto.referencia_nombre = '(sin resolver)';
    }
    resuelto.costo_calc = Number(costo.toFixed(4));
    if (resuelto.es_decoracion) costoDecoracion += costo;
    else costoIngredientes += costo;
    return resuelto;
  });

  var costoIndirecto = costoIngredientes * (ciPct / 100);
  var costoTotalConDeco = costoIngredientes + costoIndirecto + costoDecoracion;
  var rend = Number(receta.rendimiento) || 1;
  var costoPorPorcion = costoTotalConDeco / rend;
  var precioVentaSinImp = pctIdeal > 0 ? costoPorPorcion / (pctIdeal / 100) : 0;
  var iva = Number(conf.iva_default) || 16;
  var precioVentaConImp = precioVentaSinImp * (1 + iva / 100);

  return {
    ok: true,
    receta: {
      id: receta.id, nombre: receta.nombre,
      categoria_culinaria: receta.categoria_culinaria, area: receta.area,
      chef_responsable_email: receta.chef_responsable_email,
      rendimiento: receta.rendimiento, unidad_rendimiento: receta.unidad_rendimiento,
      instrucciones: receta.instrucciones, uso_aplicacion: receta.uso_aplicacion,
      decoracion_texto: receta.decoracion_texto,
      es_elaborado: _truthy(receta.es_elaborado),
      activa: _truthy(receta.activa),
      foto_url: receta.foto_url, foto_origen: receta.foto_origen,
      clave_venta_sr12: receta.clave_venta_sr12 || ''
    },
    lineas: lineasResueltas,
    costos: {
      ingredientes:        Number(costoIngredientes.toFixed(2)),
      decoracion:          Number(costoDecoracion.toFixed(2)),
      indirecto:           Number(costoIndirecto.toFixed(2)),
      indirecto_pct:       ciPct,
      total_receta:        Number(costoTotalConDeco.toFixed(2)),
      por_porcion:         Number(costoPorPorcion.toFixed(2)),
      pct_costo_ideal:     pctIdeal,
      precio_venta_sin_imp: Number(precioVentaSinImp.toFixed(2)),
      precio_venta_con_imp: Number(precioVentaConImp.toFixed(2)),
      iva_pct:             iva
    }
  };
}

// =============================================================================
// WORKFLOW DE AUTORIZACIÓN — Modelo B
// Chef propone cambios → Admin/Gerente Administrativo autoriza
// =============================================================================

var RECETAS_PENDIENTES_COLS = ['id','tipo_cambio','receta_id','snapshot_propuesto_json','cambios_resumen','propuesto_por_email','propuesto_at','estado','autorizado_por_email','autorizado_at','motivo_rechazo','auditoria_json','auditoria_at','chef_vio_rechazo'];

// Roles que pueden proponer cambios a recetas (chef + admin)
var RECETARIO_ROLES_PROPONE = ['admin','gerente_administrativo','cocina','churrasca','barman','panadero'];
// Roles que pueden autorizar/rechazar cambios (solo admin/gerente_administrativo)
var RECETARIO_ROLES_AUTORIZA = ['admin','gerente_administrativo'];

// === Endpoint: chef (o admin) propone un cambio ===
// Recibe:
//   receta_id (opcional si tipo=crear)
//   tipo_cambio: 'crear' | 'modificar' | 'desactivar'
//   cambios_json: { instrucciones, uso_aplicacion, decoracion_texto, rendimiento, unidad_rendimiento, categoria_culinaria, nombre, area }
//                 Solo se aceptan estos campos (lo demás se ignora)
function handleRecetaProponerCambio(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_PROPONE)) return { ok:false, error:'No tienes permisos para proponer cambios a recetas' };
  var tipo = String(p.tipo_cambio || 'modificar').toLowerCase();
  if (['crear','modificar','desactivar','reactivar'].indexOf(tipo) === -1) return { ok:false, error:'tipo_cambio inválido' };
  var motivoCambio = String(p.motivo || '').trim();
  var cambios; try { cambios = JSON.parse(p.cambios_json || '{}'); } catch(e){ return { ok:false, error:'cambios_json inválido' }; }
  var camposPermitidos = ['instrucciones','uso_aplicacion','decoracion_texto','rendimiento','unidad_rendimiento','categoria_culinaria','nombre','area','chef_responsable_email','foto_url','foto_origen'];
  // Limpiar: solo dejar campos permitidos
  var cambiosLimpios = {};
  camposPermitidos.forEach(function(k){ if (cambios.hasOwnProperty(k)) cambiosLimpios[k] = cambios[k]; });

  // Líneas opcionales (R1 — edición de ingredientes/cantidades, R6 — receta nueva con líneas)
  var lineasPropuestas = null;
  if (p.lineas_json) {
    try { lineasPropuestas = JSON.parse(p.lineas_json); }
    catch(e){ return { ok:false, error:'lineas_json inválido' }; }
    if (!Array.isArray(lineasPropuestas)) return { ok:false, error:'lineas_json debe ser array' };
    // Validar cada línea: debe tener ingrediente_id O subreceta_id, cantidad, unidad
    for (var i = 0; i < lineasPropuestas.length; i++) {
      var l = lineasPropuestas[i];
      if (!l || (typeof l !== 'object')) return { ok:false, error:'línea '+i+' inválida' };
      var hayRef = (l.ingrediente_id && String(l.ingrediente_id).trim()) || (l.subreceta_id && String(l.subreceta_id).trim());
      if (!hayRef) return { ok:false, error:'línea '+(i+1)+': falta ingrediente_id o subreceta_id' };
      if (l.ingrediente_id && l.subreceta_id) return { ok:false, error:'línea '+(i+1)+': solo uno de ingrediente_id o subreceta_id' };
      var c = parseFloat(l.cantidad);
      if (!(c > 0)) return { ok:false, error:'línea '+(i+1)+': cantidad debe ser > 0' };
      if (!l.unidad || !String(l.unidad).trim()) return { ok:false, error:'línea '+(i+1)+': unidad requerida' };
    }
  }

  // Validar receta existente para tipo modificar/desactivar
  var receta_id = String(p.receta_id || '').trim();
  var recetaActual = null;
  if (tipo === 'modificar' || tipo === 'desactivar' || tipo === 'reactivar') {
    if (!receta_id) return { ok:false, error:'receta_id requerido para tipo='+tipo };
    recetaActual = rowsToObjects(getSheet('Recetas')).find(function(r){ return r.id === receta_id && r.empresa_id === u.empresa_id; });
    if (!recetaActual) return { ok:false, error:'Receta no encontrada: '+receta_id };
    // Un chef solo puede proponer sobre recetas de SU área.
    var _areasRolP = _areasDeRol(u.rol);
    if (_areasRolP.length && _areasRolP.indexOf(recetaActual.area) === -1) {
      return { ok:false, error:'Esta receta es de ' + recetaActual.area + ', no de tu área. Solo puedes proponer sobre recetas de: ' + _areasRolP.join(', ') + '.' };
    }
    if (tipo === 'modificar' && _areasRolP.length === 1) cambiosLimpios.area = _areasRolP[0];   // chef de 1 área no la cambia
    // Suspender / reactivar requieren motivo del chef.
    if ((tipo === 'desactivar' || tipo === 'reactivar') && motivoCambio.length < 5) {
      return { ok:false, error:'Escribe el motivo (' + (tipo === 'desactivar' ? 'por qué suspender' : 'por qué reactivar') + ' la receta, mínimo 5 caracteres)' };
    }
  }
  // Para "crear": validar campos mínimos
  if (tipo === 'crear') {
    if (!cambiosLimpios.nombre || String(cambiosLimpios.nombre).trim().length < 3) {
      return { ok:false, error:'nombre requerido (mínimo 3 caracteres) para receta nueva' };
    }
    var _areasRolC = _areasDeRol(u.rol);
    if (_areasRolC.length === 1) cambiosLimpios.area = _areasRolC[0];                 // chef de 1 área: forzar
    else if (_areasRolC.length > 1) { if (_areasRolC.indexOf(cambiosLimpios.area) === -1) cambiosLimpios.area = _areasRolC[0]; }  // barman: barra/cava
    else if (!cambiosLimpios.area) cambiosLimpios.area = 'cocina';
    if (!cambiosLimpios.chef_responsable_email) cambiosLimpios.chef_responsable_email = u.email;
  }

  // Construir snapshot propuesto: receta actual + cambios limpios
  var snapshotPropuesto = recetaActual ? Object.assign({}, recetaActual) : {
    activa: true, area: 'cocina', rendimiento: 1, unidad_rendimiento: 'porciones',
    es_elaborado: false, costo_indirecto_pct: '', pct_costo_ideal: ''
  };
  Object.keys(cambiosLimpios).forEach(function(k){ snapshotPropuesto[k] = cambiosLimpios[k]; });
  if (tipo === 'desactivar') snapshotPropuesto.activa = false;
  if (tipo === 'reactivar') snapshotPropuesto.activa = true;
  // Adjuntar líneas si vienen
  if (lineasPropuestas) snapshotPropuesto.__lineas = lineasPropuestas;

  // Construir resumen humano de cambios
  var resumen = '';
  if (tipo === 'crear') {
    resumen = 'NUEVA RECETA: ' + (cambiosLimpios.nombre || '(sin nombre)') + (lineasPropuestas ? ' (' + lineasPropuestas.length + ' líneas)' : '');
  } else if (tipo === 'desactivar') {
    resumen = 'SUSPENDER: ' + (recetaActual ? recetaActual.nombre : receta_id) + (motivoCambio ? ' — Motivo: ' + motivoCambio : '');
  } else if (tipo === 'reactivar') {
    resumen = 'REACTIVAR: ' + (recetaActual ? recetaActual.nombre : receta_id) + (motivoCambio ? ' — Motivo: ' + motivoCambio : '');
  } else {
    var detalles = [];
    Object.keys(cambiosLimpios).forEach(function(k){
      var ant = recetaActual[k];
      var nuevo = cambiosLimpios[k];
      if (String(ant) !== String(nuevo)) {
        var antTxt = String(ant || '').slice(0, 30);
        var nuevoTxt = String(nuevo || '').slice(0, 30);
        if (antTxt.length > 28) antTxt += '…';
        if (nuevoTxt.length > 28) nuevoTxt += '…';
        detalles.push(k + ': "' + antTxt + '" → "' + nuevoTxt + '"');
      }
    });
    if (lineasPropuestas) detalles.push('ingredientes: ' + lineasPropuestas.length + ' líneas (reemplazo total)');
    resumen = detalles.length ? detalles.join(' · ') : 'sin cambios detectados';
  }
  // Observación/nota del chef (campo opcional al proponer) — se anexa al resumen para que la vea quien autoriza.
  if (motivoCambio && (tipo === 'crear' || tipo === 'modificar')) resumen += ' — 📝 Nota del chef: ' + motivoCambio;

  // Persistir en RecetasPendientes
  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var ahora = new Date();
  var nuevoId = uuid();
  sh.appendRow([
    nuevoId, tipo, receta_id || '',
    JSON.stringify(snapshotPropuesto),
    resumen,
    u.email, ahora,
    'pendiente', '', '', ''
  ]);
  return { ok:true, mensaje:'Cambio enviado para autorización', id: nuevoId, resumen: resumen };
}

// === Endpoint: el chef ve SUS PROPIAS propuestas (cualquier estado) ===
function handleRecetasMisPropuestas(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_PROPONE)) return { ok:false, error:'Sin permiso' };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RecetasPendientes');
  if (!sh) return { ok:true, propuestas:[] };
  var miEmail = String(u.email || '').toLowerCase();
  var rows = rowsToObjects(sh).filter(function(r){ return String(r.propuesto_por_email||'').toLowerCase() === miEmail; });
  var recetasMap = {};
  rowsToObjects(getSheet('Recetas')).forEach(function(r){ if (r.empresa_id === u.empresa_id) recetasMap[r.id] = r.nombre; });
  function fmt(d){ return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone()||'GMT', 'yyyy-MM-dd HH:mm') : String(d||''); }
  var lista = rows.map(function(r){
    var snap = {}; try { snap = JSON.parse(r.snapshot_propuesto_json||'{}'); } catch(e){}
    var nombre = (r.receta_id && recetasMap[r.receta_id]) || snap.nombre || '(receta nueva)';
    return {
      id: r.id,
      tipo: r.tipo_cambio,
      receta_id: r.receta_id || '',
      nombre: nombre,
      resumen: r.cambios_resumen || '',
      estado: String(r.estado || 'pendiente'),
      propuesto_at: fmt(r.propuesto_at),
      autorizado_por: r.autorizado_por_email || '',
      autorizado_at: fmt(r.autorizado_at),
      motivo_rechazo: r.motivo_rechazo || ''
    };
  });
  lista.sort(function(a,b){ return String(b.propuesto_at).localeCompare(String(a.propuesto_at)); });
  return { ok:true, propuestas: lista };
}

// === Endpoint: admin/gerente_admin lista pendientes ===
function handleRecetasPendientesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_AUTORIZA)) return { ok:false, error:'Solo Admin/Gerente Administrativo' };
  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var todos = rowsToObjects(sh);
  var estado = String(p.estado || 'pendiente').toLowerCase();
  var filtrados = todos;
  if (estado !== 'todos') filtrados = todos.filter(function(r){ return String(r.estado || '').toLowerCase() === estado; });
  // Ordenar: pendientes primero, después por fecha desc
  filtrados.sort(function(a,b){ return String(b.propuesto_at||'').localeCompare(String(a.propuesto_at||'')); });
  // Mapear receta_id → nombre actual (si existe)
  var nombrePorId = {};
  rowsToObjects(getSheet('Recetas')).forEach(function(r){ nombrePorId[r.id] = r.nombre; });
  var lista = filtrados.map(function(r){
    return {
      id: r.id,
      tipo_cambio: r.tipo_cambio,
      receta_id: r.receta_id,
      receta_nombre: nombrePorId[r.receta_id] || '(nueva)',
      cambios_resumen: r.cambios_resumen,
      propuesto_por_email: r.propuesto_por_email,
      propuesto_at: r.propuesto_at,
      estado: r.estado,
      autorizado_por_email: r.autorizado_por_email,
      autorizado_at: r.autorizado_at,
      motivo_rechazo: r.motivo_rechazo
    };
  });
  return { ok:true, pendientes: lista, total: lista.length };
}

// === Endpoint: admin obtiene detalle de un pendiente (incluye snapshot) ===
function handleRecetaPendienteGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_AUTORIZA)) return { ok:false, error:'Solo Admin/Gerente Administrativo' };
  var id = String(p.id || '');
  if (!id) return { ok:false, error:'id requerido' };
  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var pend = rowsToObjects(sh).find(function(r){ return r.id === id; });
  if (!pend) return { ok:false, error:'Pendiente no encontrado' };
  var snapshot = {}; try { snapshot = JSON.parse(pend.snapshot_propuesto_json || '{}'); } catch(e){}
  var actual = null;
  if (pend.receta_id) {
    actual = rowsToObjects(getSheet('Recetas')).find(function(r){ return r.id === pend.receta_id; }) || null;
  }
  return {
    ok:true,
    pendiente: {
      id: pend.id, tipo_cambio: pend.tipo_cambio, receta_id: pend.receta_id,
      cambios_resumen: pend.cambios_resumen,
      propuesto_por_email: pend.propuesto_por_email,
      propuesto_at: pend.propuesto_at,
      estado: pend.estado,
      autorizado_por_email: pend.autorizado_por_email,
      autorizado_at: pend.autorizado_at,
      motivo_rechazo: pend.motivo_rechazo,
      auditoria_json: pend.auditoria_json || '',
      auditoria_at:   pend.auditoria_at   || ''
    },
    snapshot_propuesto: snapshot,
    receta_actual: actual
  };
}

// === Endpoint: admin autoriza un pendiente ===
// Aplica los cambios al sheet Recetas y marca el pendiente como autorizado.
function handleRecetaAutorizar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_AUTORIZA)) return { ok:false, error:'Solo Admin/Gerente Administrativo pueden autorizar' };
  var id = String(p.id || '');
  if (!id) return { ok:false, error:'id requerido' };
  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var pend = rowsToObjects(sh).find(function(r){ return r.id === id; });
  if (!pend) return { ok:false, error:'Pendiente no encontrado' };
  if (String(pend.estado || '').toLowerCase() !== 'pendiente') return { ok:false, error:'Este pendiente ya fue procesado (estado: '+pend.estado+')' };

  var snapshot = {}; try { snapshot = JSON.parse(pend.snapshot_propuesto_json || '{}'); } catch(e){ return { ok:false, error:'snapshot inválido' }; }
  var ahora = new Date();
  var fechaStr = ahora.toISOString().slice(0,10);
  var horaStr = ahora.toTimeString().slice(0,8);
  var shR = getSheet('Recetas');
  var todasR = rowsToObjects(shR);

  var idRecetaAfectada = '';
  if (pend.tipo_cambio === 'crear') {
    // Generar nuevo ID de receta
    var maxNum = 0;
    todasR.forEach(function(r){ var m = String(r.id||'').match(/^REC-(\d+)$/); if (m) { var n = parseInt(m[1],10); if (n > maxNum) maxNum = n; } });
    var nuevoIdReceta = 'REC-' + String(maxNum + 1).padStart(4, '0');
    var nueva = Object.assign({}, snapshot);
    delete nueva.__lineas;  // no es columna
    nueva.id = nuevoIdReceta;
    nueva.empresa_id = u.empresa_id;
    nueva.activa = true;
    nueva.creada_por = pend.propuesto_por_email;
    nueva.creado_at = pend.propuesto_at;
    nueva.actualizado_por = u.email;
    nueva.actualizado_at = ahora;
    // Construir fila siguiendo el orden de columnas de Recetas
    var headers = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0];
    var fila = headers.map(function(h){ return nueva[h] === undefined ? '' : nueva[h]; });
    shR.appendRow(fila);
    pend.receta_id_creada = nuevoIdReceta;
    idRecetaAfectada = nuevoIdReceta;
  } else if (pend.tipo_cambio === 'modificar' || pend.tipo_cambio === 'desactivar' || pend.tipo_cambio === 'reactivar') {
    var idReceta = pend.receta_id;
    var existente = todasR.find(function(r){ return r.id === idReceta; });
    if (!existente) return { ok:false, error:'Receta a modificar no existe: '+idReceta };
    var headers = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0];
    headers.forEach(function(h, idx){
      // Solo actualizar si está en el snapshot
      if (snapshot.hasOwnProperty(h) && h !== 'id' && h !== 'empresa_id' && h !== 'creado_at' && h !== 'creada_por' && h !== '__lineas') {
        shR.getRange(existente._row, idx + 1).setValue(snapshot[h]);
      }
    });
    // Metadata
    var idxAct = headers.indexOf('actualizado_at');
    var idxActPor = headers.indexOf('actualizado_por');
    if (idxAct !== -1) shR.getRange(existente._row, idxAct + 1).setValue(ahora);
    if (idxActPor !== -1) shR.getRange(existente._row, idxActPor + 1).setValue(u.email);
    if (pend.tipo_cambio === 'desactivar' || pend.tipo_cambio === 'reactivar') {
      var idxActiva = headers.indexOf('activa');
      if (idxActiva !== -1) shR.getRange(existente._row, idxActiva + 1).setValue(pend.tipo_cambio === 'reactivar');
    }
    idRecetaAfectada = idReceta;
  }

  // Aplicar líneas si vienen en el snapshot (R1 — edición de ingredientes)
  if (snapshot.__lineas && Array.isArray(snapshot.__lineas) && idRecetaAfectada) {
    var shIR = getSheet('IngredientesReceta');
    var todasIR = rowsToObjects(shIR);
    // Borrar las existentes de esta receta (de abajo hacia arriba para no romper índices)
    var filasABorrar = todasIR.filter(function(ir){ return ir.receta_id === idRecetaAfectada; })
                              .map(function(ir){ return ir._row; })
                              .sort(function(a,b){ return b - a; });
    filasABorrar.forEach(function(row){ shIR.deleteRow(row); });
    // Insertar nuevas
    if (snapshot.__lineas.length) {
      var headersIR = shIR.getRange(1, 1, 1, shIR.getLastColumn()).getValues()[0];
      var nuevasFilas = snapshot.__lineas.map(function(l, idx){
        var obj = {
          id: uuid(),
          receta_id: idRecetaAfectada,
          ingrediente_id: l.ingrediente_id || '',
          subreceta_id: l.subreceta_id || '',
          cantidad: parseFloat(l.cantidad) || 0,
          unidad: l.unidad || '',
          merma_extra_pct: l.merma_extra_pct == null ? '' : parseFloat(l.merma_extra_pct),
          es_decoracion: !!l.es_decoracion,
          orden: l.orden != null ? parseInt(l.orden,10) : (idx + 1),
          advertencia: l.advertencia || ''
        };
        return headersIR.map(function(h){ return obj[h] === undefined ? '' : obj[h]; });
      });
      shIR.getRange(shIR.getLastRow() + 1, 1, nuevasFilas.length, headersIR.length).setValues(nuevasFilas);
    }
  }

  // Marcar pendiente como autorizado
  var shHeadersP = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idxEst = shHeadersP.indexOf('estado');
  var idxAutPor = shHeadersP.indexOf('autorizado_por_email');
  var idxAutAt = shHeadersP.indexOf('autorizado_at');
  sh.getRange(pend._row, idxEst + 1).setValue('autorizada');
  sh.getRange(pend._row, idxAutPor + 1).setValue(u.email);
  sh.getRange(pend._row, idxAutAt + 1).setValue(ahora);

  // Auditoría blindada
  var shHR = asegurarHoja('HistorialRecetas', ['id','receta_id','producto_id','accion','snapshot_json','usuario_email','fecha','hora','ip_sesion','alerta_masiva']);
  shHR.appendRow([uuid(), pend.receta_id || pend.receta_id_creada || '', '', 'autorizada_'+pend.tipo_cambio, JSON.stringify({ pendiente_id: pend.id, propuesto_por: pend.propuesto_por_email, snapshot: snapshot }), u.email, fechaStr, horaStr, '', false]);

  return { ok:true, mensaje:'Cambio autorizado y aplicado', tipo: pend.tipo_cambio, receta_id: pend.receta_id || pend.receta_id_creada };
}

// === Endpoint: admin rechaza un pendiente con motivo ===
function handleRecetaRechazar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_AUTORIZA)) return { ok:false, error:'Solo Admin/Gerente Administrativo pueden rechazar' };
  var id = String(p.id || '');
  var motivo = String(p.motivo || '').trim();
  if (!id) return { ok:false, error:'id requerido' };
  if (motivo.length < 5) return { ok:false, error:'Motivo mínimo 5 caracteres' };
  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var pend = rowsToObjects(sh).find(function(r){ return r.id === id; });
  if (!pend) return { ok:false, error:'Pendiente no encontrado' };
  if (String(pend.estado || '').toLowerCase() !== 'pendiente') return { ok:false, error:'Este pendiente ya fue procesado' };
  var ahora = new Date();
  var fechaStr = ahora.toISOString().slice(0,10);
  var horaStr = ahora.toTimeString().slice(0,8);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(pend._row, headers.indexOf('estado') + 1).setValue('rechazada');
  sh.getRange(pend._row, headers.indexOf('autorizado_por_email') + 1).setValue(u.email);
  sh.getRange(pend._row, headers.indexOf('autorizado_at') + 1).setValue(ahora);
  sh.getRange(pend._row, headers.indexOf('motivo_rechazo') + 1).setValue(motivo);
  // Auditoría
  var shHR = asegurarHoja('HistorialRecetas', ['id','receta_id','producto_id','accion','snapshot_json','usuario_email','fecha','hora','ip_sesion','alerta_masiva']);
  shHR.appendRow([uuid(), pend.receta_id || '', '', 'rechazada_'+pend.tipo_cambio, JSON.stringify({ pendiente_id: pend.id, propuesto_por: pend.propuesto_por_email, motivo: motivo }), u.email, fechaStr, horaStr, '', false]);
  return { ok:true, mensaje:'Cambio rechazado', motivo: motivo };
}

// =============================================================================
// UPLOAD DE FOTOS DE RECETAS — Drive
// Recibe imagen en base64 desde la UI (móvil o PC), la guarda en una carpeta de
// Drive del proyecto, y vincula la URL pública a la receta. Sustituye foto previa
// si existía y la nueva NO es placeholder.
// =============================================================================

// Carpeta en Drive donde se guardan las fotos. Si no existe, se crea.
function _obtenerCarpetaFotosRecetario() {
  var nombre = 'Fogueira · Fotos Recetario';
  var carpetas = DriveApp.getFoldersByName(nombre);
  if (carpetas.hasNext()) return carpetas.next();
  return DriveApp.createFolder(nombre);
}

// === Endpoint: subir foto a una receta ===
// Parámetros:
//   receta_id: id de la receta
//   base64: contenido de la imagen como data URL ("data:image/jpeg;base64,...")
//           o base64 puro
//   mime: 'image/jpeg' | 'image/png' (opcional, se infiere del data URL)
//   filename: nombre original (opcional)
function handleRecetaFotoUpload(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, RECETARIO_ROLES_PROPONE)) return { ok:false, error:'No tienes permisos para subir fotos' };
  var receta_id = String(p.receta_id || '').trim();
  if (!receta_id) return { ok:false, error:'receta_id requerido' };
  var b64 = String(p.base64 || '');
  if (!b64) return { ok:false, error:'base64 requerido' };
  // Aceptar data URL o base64 puro
  var mime = String(p.mime || 'image/jpeg');
  if (b64.indexOf('data:') === 0) {
    var match = b64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) { mime = match[1]; b64 = match[2]; }
    else return { ok:false, error:'base64 inválido (data URL malformada)' };
  }
  if (mime.indexOf('image/') !== 0) return { ok:false, error:'Solo se aceptan imágenes (jpeg/png/webp)' };
  // Validar tamaño máx ~5MB en base64
  if (b64.length > 5 * 1024 * 1024 * 4 / 3) return { ok:false, error:'Imagen demasiado grande (máx 5MB)' };
  try {
    var bytes = Utilities.base64Decode(b64);
    var ext = mime.split('/')[1] || 'jpg';
    var fileName = (p.filename ? String(p.filename).replace(/[^\w\.\-]/g, '_').slice(0, 80) : 'receta_' + receta_id + '_' + Date.now() + '.' + ext);
    if (fileName.indexOf('.') === -1) fileName += '.' + ext;
    var blob = Utilities.newBlob(bytes, mime, fileName);
    var carpeta = _obtenerCarpetaFotosRecetario();
    var archivo = carpeta.createFile(blob);
    // Hacer público (lectura) para que se vea en la UI
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // URL embebible (formato thumbnail de Drive)
    var fileId = archivo.getId();
    var fotoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';

    // Vincular a la receta — solo admin/gerente_admin pueden directo;
    // chef/cocina/churrasca crean propuesta de cambio (Modelo B)
    var shR = getSheet('Recetas');
    var receta = rowsToObjects(shR).find(function(r){ return r.id === receta_id && r.empresa_id === u.empresa_id; });
    if (!receta) return { ok:false, error:'Receta no encontrada' };
    var rolU = String(u.rol || '').toLowerCase();

    if (['admin','gerente_administrativo'].indexOf(rolU) !== -1) {
      // Admin: aplica directo
      var headersR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0];
      var colFoto = headersR.indexOf('foto_url') + 1;
      var colOri  = headersR.indexOf('foto_origen') + 1;
      var colAct  = headersR.indexOf('actualizado_at') + 1;
      var colActPor = headersR.indexOf('actualizado_por') + 1;
      var anterior = receta.foto_url || '';
      var ahora = new Date();
      if (colFoto > 0) shR.getRange(receta._row, colFoto).setValue(fotoUrl);
      if (colOri > 0)  shR.getRange(receta._row, colOri).setValue('upload');
      if (colAct > 0)  shR.getRange(receta._row, colAct).setValue(ahora);
      if (colActPor > 0) shR.getRange(receta._row, colActPor).setValue(u.email);
      // Auditoría
      var shHR = asegurarHoja('HistorialRecetas', ['id','receta_id','producto_id','accion','snapshot_json','usuario_email','fecha','hora','ip_sesion','alerta_masiva']);
      shHR.appendRow([uuid(), receta_id, '', 'modificó',
        JSON.stringify({ campo:'foto_url', anterior: anterior, nuevo: fotoUrl, file_id: fileId, fuente: 'upload_directo' }),
        u.email, ahora.toISOString().slice(0,10), ahora.toTimeString().slice(0,8), '', false]);
      return { ok:true, mensaje:'Foto subida y vinculada', file_id: fileId, foto_url: fotoUrl, aplicada_directamente: true };
    } else {
      // Chef: crear propuesta de cambio (Modelo B)
      var snapshot = Object.assign({}, receta);
      snapshot.foto_url = fotoUrl;
      snapshot.foto_origen = 'upload';
      var ahoraP = new Date();
      var shP = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
      var nuevoIdPend = uuid();
      shP.appendRow([
        nuevoIdPend, 'modificar', receta_id,
        JSON.stringify(snapshot),
        'Foto nueva subida (' + fileName + ')',
        u.email, ahoraP,
        'pendiente', '', '', ''
      ]);
      return { ok:true, mensaje:'Foto subida — esperando autorización del gerente', file_id: fileId, foto_url: fotoUrl, aplicada_directamente: false, pendiente_id: nuevoIdPend };
    }
  } catch(e) {
    return { ok:false, error:'Error al guardar archivo: ' + e.message };
  }
}

// =============================================================================
// REPORTE DE RENTABILIDAD (R4)
// Devuelve un listado con: nombre, área, costo total, costo por porción,
// precio sugerido, rendimiento, advertencias (precios estimados, sin instrucciones).
// El frontend reporte_recetario.html lo consume y permite ordenar/filtrar.
// =============================================================================
function handleRecetarioReporteRentabilidad(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  // Solo roles operativos/admin pueden ver reporte
  var rolesOK = ['admin','gerente_administrativo','gerente_restaurante','cocina','churrasca','comprador'];
  if (rolesOK.indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Sin permisos' };
  return _reporteRentabilidadCore(u.empresa_id);
}

// Núcleo del reporte de rentabilidad, separado del handler para correrlo SIN token de
// sesión (lo usa el auditor matutino para contar recetas con avisos por área). v369.
function _reporteRentabilidadCore(empresaId) {
  var cfg = (typeof obtenerConfigRecetario === 'function') ? obtenerConfigRecetario() : { costo_indirecto_pct: 12, pct_costo_ideal: 35, iva_default: 16 };
  var todasR = rowsToObjects(getSheet('Recetas')).filter(function(r){ return r.empresa_id === empresaId; });
  var todasIR = rowsToObjects(getSheet('IngredientesReceta'));
  var todasIng = rowsToObjects(getSheet('Ingredientes')).filter(function(i){ return i.empresa_id === empresaId; });
  var ingPorId = {}; todasIng.forEach(function(i){ ingPorId[i.id] = i; });
  var recetaPorId = {}; todasR.forEach(function(r){ recetaPorId[r.id] = r; });
  var lineasPorReceta = {};
  todasIR.forEach(function(ir){
    if (!lineasPorReceta[ir.receta_id]) lineasPorReceta[ir.receta_id] = [];
    lineasPorReceta[ir.receta_id].push(ir);
  });

  // Costeo recursivo (sub-recetas)
  var memo = {};
  function costoReceta(rId, profundidad) {
    if (memo[rId] !== undefined) return memo[rId];
    if (profundidad > 6) return { ingredientes: 0, decoracion: 0, hayEstimado: true, advCircular: true };
    var r = recetaPorId[rId];
    if (!r) return { ingredientes: 0, decoracion: 0 };
    var lineas = lineasPorReceta[rId] || [];
    var totIng = 0, totDeco = 0, hayEst = false, sinPrecio = 0, sospechosas = 0;
    lineas.forEach(function(l){
      var costo = 0;
      var sospCant = _recetaCantidadSospechosa(l.cantidad, l.unidad); // por unidad, no depende del precio
      if (l.subreceta_id) {
        var sub = costoReceta(l.subreceta_id, profundidad + 1);
        var rSub = recetaPorId[l.subreceta_id];
        var rendSub = parseFloat(rSub && rSub.rendimiento) || 1;
        var costoUnitSub = (sub.ingredientes + sub.decoracion + (sub.ingredientes + sub.decoracion) * (parseFloat(cfg.costo_indirecto_pct)/100)) / rendSub;
        costo = costoUnitSub * (parseFloat(l.cantidad) || 0) * _unidadFactorBase(l.unidad, rSub && rSub.unidad_rendimiento);
        if (sub.hayEstimado) hayEst = true;
      } else if (l.ingrediente_id) {
        var ing = ingPorId[l.ingrediente_id];
        if (!ing) { if (sospCant) sospechosas++; sinPrecio++; return; }
        var pUnit = parseFloat(ing.precio_real_unitario || ing.ultimo_costo || ing.costo_promedio || 0);
        if (!pUnit && ing.ultimo_costo_estimado) { pUnit = parseFloat(ing.ultimo_costo_estimado); hayEst = true; }
        if (!pUnit) { if (sospCant) sospechosas++; sinPrecio++; return; }
        if (String(ing.precio_origen||'').toLowerCase() === 'estimado') hayEst = true;
        var merma = (parseFloat(l.merma_extra_pct) || 0) + (parseFloat(ing.merma_pct) || 0);
        var factor = 1 - (merma / 100);
        if (factor <= 0.05) factor = 0.05;
        costo = pUnit * (parseFloat(l.cantidad) || 0) / factor * _unidadFactorBase(l.unidad, ing.unidad_base);
      }
      // Línea sospechosa = cantidad absurda por su unidad O costo de línea desproporcionado (> $3000).
      if (sospCant || costo > 3000) sospechosas++;
      if (l.es_decoracion) totDeco += costo; else totIng += costo;
    });
    var resultado = { ingredientes: totIng, decoracion: totDeco, hayEstimado: hayEst, sinPrecio: sinPrecio, sospechosas: sospechosas };
    memo[rId] = resultado;
    return resultado;
  }

  var indir = parseFloat(cfg.costo_indirecto_pct) / 100;
  var pctIdeal = parseFloat(cfg.pct_costo_ideal) / 100;
  var iva = parseFloat(cfg.iva_default) / 100;
  var lista = todasR.map(function(r){
    var c = costoReceta(r.id, 0);
    var ingMasDeco = c.ingredientes + c.decoracion;
    var totalReceta = ingMasDeco + ingMasDeco * indir;
    var rend = parseFloat(r.rendimiento) || 1;
    var porPorcion = totalReceta / rend;
    var precioVenta = pctIdeal > 0 ? (porPorcion / pctIdeal) : 0;
    var precioVentaConIVA = precioVenta * (1 + iva);
    // Detectar si tiene instrucciones reales
    var instrTxt = String(r.instrucciones || '').trim();
    var instrLimpio = instrTxt.replace(/[\d\.\-\s]/g, '');
    var sinInstrucciones = !instrTxt || instrLimpio.length < 5;
    return {
      id: r.id,
      nombre: r.nombre,
      area: r.area,
      categoria: r.categoria_culinaria,
      es_subreceta: !!r.es_elaborado,
      activa: r.activa !== false,
      rendimiento: rend,
      unidad_rendimiento: r.unidad_rendimiento,
      costo_ingredientes: c.ingredientes,
      costo_decoracion: c.decoracion,
      costo_total: totalReceta,
      costo_por_porcion: porPorcion,
      precio_venta_sugerido: precioVenta,
      precio_venta_con_iva: precioVentaConIVA,
      tiene_estimado: !!c.hayEstimado,
      lineas_sin_precio: c.sinPrecio || 0,
      lineas_sospechosas: c.sospechosas || 0,
      sin_instrucciones: sinInstrucciones,
      sin_foto: !r.foto_url
    };
  });

  // Resumen agregado
  var resumen = {
    total_recetas: lista.length,
    activas: lista.filter(function(x){ return x.activa; }).length,
    inactivas: lista.filter(function(x){ return !x.activa; }).length,
    cocina: lista.filter(function(x){ return x.area === 'cocina' && !x.es_subreceta; }).length,
    churrasca: lista.filter(function(x){ return x.area === 'churrasca' && !x.es_subreceta; }).length,
    sub_recetas: lista.filter(function(x){ return x.es_subreceta; }).length,
    con_estimado: lista.filter(function(x){ return x.tiene_estimado; }).length,
    sin_instrucciones: lista.filter(function(x){ return x.sin_instrucciones; }).length,
    sin_foto: lista.filter(function(x){ return x.sin_foto; }).length,
    costo_promedio_porcion: lista.length ? (lista.reduce(function(s,x){ return s + x.costo_por_porcion; }, 0) / lista.length) : 0
  };

  return { ok:true, recetas: lista, resumen: resumen, config: cfg };
}

// =============================================================================
// VALIDADOR DE RECETAS (v413) — control permanente, 6 dimensiones por receta.
// Read-only. Reusa _reporteRentabilidadCore para costos+banderas y agrega:
//   1 Lógica (instrucciones/cantidades/rendimiento)  2 Vínculo SR12  3 Costo
//   4 Vinculada a charola  5 Afecta inventario  6 Cuadre-ready (SR12 vs mermas)
// Devuelve scorecard por receta + KPIs + pendientes agrupados por rol (los usa el auditor).
// =============================================================================
function handleRecetasValidacion(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rolesOK = ['admin','gerente_administrativo','gerente_restaurante','gerente_plaza','auditoria','comprador','cocina','churrasca','barman','panadero'];
  if (rolesOK.indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Sin permisos' };
  return _validacionRecetasCore(u.empresa_id, String(p.area||'').trim());
}

function _validacionRecetasCore(empresaId, areaFiltro) {
  var AREAS_INV = ['cocina','churrasca']; // las que descuentan inventario por charola
  var rep = _reporteRentabilidadCore(empresaId);
  var repById = {}; (rep.recetas||[]).forEach(function(r){ repById[r.id] = r; });

  // Catálogo de ingredientes: clave SR12 (directa o vía Match) + inventariable
  var ingById = {};
  rowsToObjects(getSheet('Ingredientes')).forEach(function(i){
    if (i.empresa_id !== empresaId) return;
    ingById[i.id] = {
      nombre: i.nombre,
      clave: i.clave_sr12 ? String(i.clave_sr12) : '',
      inventariable: (i.inventariable === '' || i.inventariable == null) ? true : _truthy(i.inventariable)
    };
  });
  try {
    var shM = SpreadsheetApp.getActive().getSheetByName('IngredientesSR12Match');
    if (shM) rowsToObjects(shM).forEach(function(m){
      if (m.empresa_id === empresaId && m.ingrediente_id_fogueira && m.clave_sr12) {
        var ig = ingById[m.ingrediente_id_fogueira];
        if (ig && !ig.clave) ig.clave = String(m.clave_sr12);
      }
    });
  } catch(e){}

  var lineasPorReceta = {};
  rowsToObjects(getSheet('IngredientesReceta')).forEach(function(ir){
    (lineasPorReceta[ir.receta_id] = lineasPorReceta[ir.receta_id] || []).push(ir);
  });
  var vincSet = {};
  try { rowsToObjects(asegurarHoja('CharolasRecetas', CHAROLAS_RECETAS_COLS)).forEach(function(cr){
    if (cr.empresa_id === empresaId && cr.activo !== false) vincSet[cr.receta_id] = true; }); } catch(e){}
  var invcfgSet = {};
  try { rowsToObjects(getSheet('InventarioChurrascaConfig')).forEach(function(c){
    if (c.empresa_id === empresaId && _truthy(c.activo)) invcfgSet[c.ingrediente_id] = true; }); } catch(e){}

  var recetas = rowsToObjects(getSheet('Recetas')).filter(function(r){
    return r.empresa_id === empresaId && _truthy(r.activa) && !_truthy(r.es_elaborado);
  });
  if (areaFiltro) recetas = recetas.filter(function(r){ return r.area === areaFiltro; });

  var chefFixPorArea = {}; // recetas por completar (instrucciones/rendimiento/ingredientes) por área → pendiente al chef
  var lista = recetas.map(function(r){
    var rr = repById[r.id] || {};
    var lineas = lineasPorReceta[r.id] || [];
    var ingLines = lineas.filter(function(l){ return l.ingrediente_id; });
    var esInv = AREAS_INV.indexOf(r.area) !== -1;

    // 1) LÓGICA
    var d1 = { estado:'verde', notas:[] };
    if (!lineas.length) { d1.estado='rojo'; d1.notas.push('sin ingredientes'); }
    var huerf = lineas.filter(function(l){ return !l.ingrediente_id && !l.subreceta_id; }).length;
    if (huerf) { d1.estado='rojo'; d1.notas.push(huerf+' línea(s) rota(s)'); }
    if (rr.lineas_sospechosas) { d1.estado='rojo'; d1.notas.push(rr.lineas_sospechosas+' cantidad/costo absurdo'); }
    if (rr.sin_instrucciones && d1.estado!=='rojo') { d1.estado='amarillo'; d1.notas.push('sin instrucciones'); }
    if (rr.sin_instrucciones && d1.estado==='rojo') d1.notas.push('sin instrucciones');
    if ((parseFloat(r.rendimiento)||0) <= 0) { if (d1.estado==='verde') d1.estado='amarillo'; d1.notas.push('rendimiento sin definir'); }
    // Tarea de CHEF a completar (distinta de "costo absurdo", que ya tiene su propio aviso): instrucciones / rendimiento / ingredientes.
    if (rr.sin_instrucciones || (parseFloat(r.rendimiento)||0) <= 0 || !lineas.length || huerf > 0) chefFixPorArea[r.area] = (chefFixPorArea[r.area]||0) + 1;

    // 2) VÍNCULO SR12
    var n = ingLines.length, linked = 0, faltan = [];
    ingLines.forEach(function(l){ var ig = ingById[l.ingrediente_id]; if (ig && ig.clave) linked++; else faltan.push(ig ? ig.nombre : l.ingrediente_id); });
    var d2 = { estado:'verde', pct: n ? Math.round(100*linked/n) : 100, faltan: faltan, notas:[] };
    if (n === 0) d2.estado = 'gris';
    else if (linked === n) d2.estado = 'verde';
    else if (linked*2 >= n) { d2.estado='amarillo'; d2.notas.push(faltan.length+' sin SR12'); }
    else { d2.estado='rojo'; d2.notas.push(faltan.length+' sin SR12'); }

    // 3) COSTO
    var d3 = { estado:'verde', notas:[], costo_total: rr.costo_total||0, costo_porcion: rr.costo_por_porcion||0 };
    if (rr.lineas_sin_precio) { d3.estado='rojo'; d3.notas.push(rr.lineas_sin_precio+' sin precio'); }
    if (rr.lineas_sospechosas) { d3.estado='rojo'; d3.notas.push('costo sospechoso'); }
    if (rr.tiene_estimado && d3.estado==='verde') { d3.estado='amarillo'; d3.notas.push('precio estimado'); }

    // 4) CHAROLA
    var d4;
    if (!esInv) d4 = { estado:'na', notas:[] };
    else d4 = vincSet[r.id] ? { estado:'verde', notas:[] } : { estado:'rojo', notas:['no vinculada → no descuenta'] };

    // 5) INVENTARIO
    var d5, tieneInv = ingLines.some(function(l){ return invcfgSet[l.ingrediente_id]; });
    if (!esInv) d5 = { estado:'na', notas:[] };
    else d5 = tieneInv ? { estado:'verde', notas:[] } : { estado:'rojo', notas:['ningún insumo inventariable'] };

    // 6) CUADRE-READY (SR12 vs mermas)
    var d6;
    if (!esInv) d6 = { estado:'na', notas:['vía Cuadre de Barra'] };
    else {
      var invConSr12 = ingLines.some(function(l){ return invcfgSet[l.ingrediente_id] && ingById[l.ingrediente_id] && ingById[l.ingrediente_id].clave; });
      if (d4.estado==='verde' && d5.estado==='verde' && invConSr12) d6 = { estado:'verde', notas:[] };
      else if (d5.estado==='verde') d6 = { estado:'amarillo', notas:['inventariable sin SR12 → comparación parcial'] };
      else d6 = { estado:'rojo', notas:['no comparable aún'] };
    }

    var checks = { logica:d1, sr12:d2, costo:d3, charola:d4, inventario:d5, cuadre:d6 };
    var rojo = 0, amar = 0;
    ['logica','sr12','costo','charola','inventario','cuadre'].forEach(function(k){
      if (checks[k].estado === 'rojo') rojo++; else if (checks[k].estado === 'amarillo') amar++;
    });
    var estado = rojo ? 'rojo' : (amar ? 'amarillo' : 'verde');
    var roles = {};
    if (d1.estado === 'rojo' || d1.estado === 'amarillo') roles['chef'] = true;
    if (d2.estado === 'rojo' || d2.estado === 'amarillo') roles['comprador'] = true;
    if (d3.estado === 'rojo' || d3.estado === 'amarillo') roles['comprador'] = true;
    if (d4.estado === 'rojo') roles['admin'] = true;
    if (d5.estado === 'rojo') roles['admin'] = true;

    return { id:r.id, nombre:r.nombre, area:r.area, categoria:r.categoria_culinaria, estado:estado, checks:checks, roles:Object.keys(roles) };
  });

  lista.sort(function(a,b){ var o={rojo:0,amarillo:1,verde:2}; if (o[a.estado]!==o[b.estado]) return o[a.estado]-o[b.estado]; return String(a.nombre||'').localeCompare(String(b.nombre||'')); });

  var resumen = { total:lista.length,
    verde: lista.filter(function(x){return x.estado==='verde';}).length,
    amarillo: lista.filter(function(x){return x.estado==='amarillo';}).length,
    rojo: lista.filter(function(x){return x.estado==='rojo';}).length };
  var porArea = {};
  lista.forEach(function(x){ var a=porArea[x.area]=porArea[x.area]||{total:0,verde:0,amarillo:0,rojo:0}; a.total++; a[x.estado]++; });

  // Pendientes AGRUPADOS para el auditor (rol_match = rol de Usuarios al que se le atribuye; area = etiqueta).
  var compr = lista.filter(function(x){ return x.checks.sr12.estado==='rojo' || x.checks.sr12.estado==='amarillo'; }).length;
  var invGap = lista.filter(function(x){ return x.checks.charola.estado==='rojo' || x.checks.inventario.estado==='rojo'; }).length;
  var pendientes = [];
  if (compr > 0) pendientes.push({ rol_match:'comprador', area:'compras', clave:'valida:sr12', sev:'alta',
    titulo: compr + ' receta(s) con insumos SIN vincular al SR12 (costo/margen no confiable). Vincúlalos en Recetas → 🪄 sugeridor y revisa el ✅ Validador de recetas.' });
  if (invGap > 0) pendientes.push({ rol_match:'gerente_administrativo', area:'gte_admin', clave:'valida:inventario', sev:'media',
    titulo: invGap + ' receta(s) de cocina/churrasca que NO descuentan inventario (sin vincular a charola o sin insumo inventariable). Revisa el ✅ Validador de recetas.' });
  // Chef de cada área: sus recetas por completar (instrucciones/rendimiento/ingredientes). Distinto del aviso "costo absurdo" que ya existe.
  var AREA_ROL = { cocina:'cocina', churrasca:'churrasca', barra:'barman', panaderia:'panadero' };
  Object.keys(chefFixPorArea).forEach(function(a){
    var rm = AREA_ROL[a]; if (!rm || chefFixPorArea[a] <= 0) return;
    pendientes.push({ rol_match: rm, area: a, clave:'valida:logica:'+a, sev:'media',
      titulo: chefFixPorArea[a] + ' receta(s) de ' + a + ' por COMPLETAR (instrucciones, rendimiento o ingredientes) — revisa el ✅ Validador de recetas.' });
  });

  return { ok:true, recetas:lista, resumen:resumen, por_area:porArea, validacion_pendientes:pendientes };
}

// =============================================================================
// CHAROLAS ↔ RECETAS (R5)
// Cada charola del buffet tiene N porciones de una receta. Permite vincular
// charola_id → receta_id + porciones para que el costeo de buffet sea automático.
// =============================================================================
var CHAROLAS_RECETAS_COLS = ['id','empresa_id','charola_id','receta_id','porciones','area','observaciones','activo','creado_at','creado_por','actualizado_at','actualizado_por'];

function handleCharolasRecetasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = asegurarHoja('CharolasRecetas', CHAROLAS_RECETAS_COLS);
  var todas = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  // Enriquecer con nombre de receta y de charola si las tablas existen
  var recetaPorId = {};
  rowsToObjects(getSheet('Recetas')).forEach(function(r){ recetaPorId[r.id] = r; });
  var charolaPorId = {};
  try {
    var shC = getSheet('Charolas');
    if (shC) rowsToObjects(shC).forEach(function(c){ charolaPorId[c.id] = c; });
  } catch(e){}
  var lista = todas.map(function(cr){
    var rec = recetaPorId[cr.receta_id] || {};
    var ch = charolaPorId[cr.charola_id] || {};
    return {
      id: cr.id, charola_id: cr.charola_id, receta_id: cr.receta_id,
      charola_nombre: ch.nombre || cr.charola_id,
      receta_nombre: rec.nombre || cr.receta_id,
      porciones: parseFloat(cr.porciones) || 0,
      area: cr.area || rec.area || '',
      observaciones: cr.observaciones || '',
      activo: cr.activo !== false
    };
  });
  // También devolvemos lista de charolas y recetas para que la UI tenga selectores
  var recetas = rowsToObjects(getSheet('Recetas'))
    .filter(function(r){ return r.empresa_id === u.empresa_id && r.activa !== false && !r.es_elaborado; })
    .map(function(r){ return { id: r.id, nombre: r.nombre, area: r.area, rendimiento: r.rendimiento }; });
  // Las "charolas" del selector son las mismas recetas: cada charola corresponde a una receta
  var charolas = recetas.map(function(r){ return { id: r.id, nombre: r.nombre, area: r.area }; });
  return { ok:true, vinculaciones: lista, recetas: recetas, charolas: charolas };
}

// =============================================================================
// VALIDACIÓN DE RECETAS CON IA (R6)
// El admin somete una propuesta pendiente a auditoría por Claude Haiku.
// La API key de Anthropic se guarda por empresa en hoja Configuracion.
// El dictamen se persiste en RecetasPendientes para no cobrar dos veces.
// =============================================================================

// Helper: encuentra una columna por nombre en la fila 1. Si no existe, la crea al final. Devuelve índice 1-based.
function _getOrCreateCol(sh, colName) {
  var lastCol = sh.getLastColumn();
  var headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var idx = headers.indexOf(colName);
  if (idx >= 0) return idx + 1;
  var newCol = lastCol + 1;
  sh.getRange(1, newCol).setValue(colName);
  return newCol;
}

// =====================================================================================
// DIAGNÓSTICO DE CALIDAD DEL CATÁLOGO (solo lectura) — v331
// Marca ingredientes con datos sospechosos para que compras sepa EXACTO qué limpiar.
// No toca nada. Heurísticas conservadoras (claras, accionables) para no llenar de ruido.
// =====================================================================================
function handleIngredientesDiagnostico(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','comprador','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };

  var ingredientes = rowsToObjects(getSheet('Ingredientes')).filter(function(x){
    if (x.empresa_id !== u.empresa_id) return false;
    var av = String(x.activo).trim().toLowerCase();
    if (x.activo === false || av === 'false' || av === '0' || av === 'no') return false;
    return true;
  });
  var usoPorIng = {};
  rowsToObjects(getSheet('IngredientesReceta')).forEach(function(l){
    if (l.ingrediente_id) usoPorIng[l.ingrediente_id] = (usoPorIng[l.ingrediente_id] || 0) + 1;
  });

  function nNum(v){ var n = parseFloat(v); return isNaN(n) ? null : n; }
  function tru(v){ return v === true || String(v).trim().toLowerCase() === 'true'; }
  var UNIDADES_OK = {kg:1,kgs:1,gr:1,g:1,grs:1,lt:1,l:1,lts:1,ml:1,cc:1,mg:1,pza:1,pzas:1,pz:1,pieza:1,piezas:1,unidad:1,unidades:1,porcion:1,porciones:1,porc:1};

  var flagged = [];
  var conteo = { sin_unidad:0, unidad_rara:0, sin_precio:0, precio_alto:0, precio_bajo_kg:0 };

  ingredientes.forEach(function(x){
    var motivos = [];
    var unidad = String(x.unidad_base == null ? '' : x.unidad_base).trim().toLowerCase();
    var costo = nNum(x.ultimo_costo);
    var pru = nNum(x.precio_real_unitario);
    var estimado = tru(x.ultimo_costo_estimado);
    var esSub = tru(x.es_subreceta_catalogo);
    var precioEf = (pru != null && pru > 0) ? pru : costo;

    if (!unidad) { motivos.push('sin_unidad'); conteo.sin_unidad++; }
    else if (!esSub && !UNIDADES_OK[unidad]) { motivos.push('unidad_rara'); conteo.unidad_rara++; }

    if (!esSub && (precioEf == null || precioEf <= 0) && !estimado) { motivos.push('sin_precio'); conteo.sin_precio++; }
    if (precioEf != null && precioEf > 5000) { motivos.push('precio_alto'); conteo.precio_alto++; }
    if (precioEf != null && precioEf > 0 && precioEf < 0.5 && (unidad === 'kg' || unidad === 'kgs' || unidad === 'lt' || unidad === 'l' || unidad === 'lts')) { motivos.push('precio_bajo_kg'); conteo.precio_bajo_kg++; }

    if (motivos.length) {
      flagged.push({
        id: x.id, nombre: x.nombre, categoria: x.categoria || '',
        unidad_base: x.unidad_base || '', ultimo_costo: costo, precio_real_unitario: pru,
        clave_sr12: x.clave_sr12 || '', usos: usoPorIng[x.id] || 0, motivos: motivos
      });
    }
  });

  // Primero los que se usan en recetas (impactan costos), luego los de más problemas.
  flagged.sort(function(a,b){ var r = b.usos - a.usos; if (r) return r; return b.motivos.length - a.motivos.length; });

  return { ok:true, total_ingredientes: ingredientes.length, total_flagged: flagged.length, conteo: conteo, flagged: flagged };
}

function handleRecetaAuditarIA(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (['admin','gerente_administrativo'].indexOf(String(u.rol||'').toLowerCase()) === -1) {
    return { ok:false, error:'Solo Admin/Gerente Administrativo puede auditar con IA' };
  }

  var id = String(p.id || '').trim();
  if (!id) return { ok:false, error:'id requerido' };

  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var todos = rowsToObjects(sh);
  var pend = null;
  for (var i = 0; i < todos.length; i++) { if (todos[i].id === id) { pend = todos[i]; break; } }
  if (!pend) return { ok:false, error:'Pendiente no encontrado' };

  // Si ya tiene dictamen guardado, devolverlo sin llamar a la API
  if (pend.auditoria_json) {
    try { return { ok:true, dictamen: JSON.parse(pend.auditoria_json), cached: true }; } catch(e){}
  }

  // Leer API key desde Script Properties (no del Sheet — nunca se expone por la API)
  var apiKey = String(PropertiesService.getScriptProperties().getProperty('anthropic_key_' + u.empresa_id) || '').trim();
  if (!apiKey) return { ok:false, error:'API key de Anthropic no configurada. El administrador técnico debe agregarla en Project Settings → Script properties.' };

  // Parsear snapshot propuesto
  var snapshot = {};
  try { snapshot = JSON.parse(pend.snapshot_propuesto_json || '{}'); } catch(e){}

  // Obtener ingredientes de la receta
  var shIR  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('IngredientesReceta');
  var shIng = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ingredientes');
  var shRec = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Recetas');
  var lineas = shIR ? rowsToObjects(shIR).filter(function(r){ return r.receta_id === pend.receta_id; }) : [];
  var ingNombres = {};
  if (shIng) rowsToObjects(shIng).forEach(function(ing){ ingNombres[ing.id] = ing.nombre; });
  var recNombres = {};
  if (shRec) rowsToObjects(shRec).forEach(function(r){ recNombres[r.id] = r.nombre; });

  var ingredientesTexto = lineas.map(function(ir){
    var nombreIng = ir.ingrediente_id
      ? (ingNombres[ir.ingrediente_id] || ir.ingrediente_id)
      : ('(subreceta) ' + (recNombres[ir.subreceta_id] || ir.subreceta_id));
    var extras = [];
    if (Number(ir.merma_extra_pct) > 0) extras.push('+' + ir.merma_extra_pct + '% merma');
    if (String(ir.es_decoracion) === 'true') extras.push('decoración');
    if (ir.advertencia) extras.push('⚠ ' + ir.advertencia);
    return '- ' + nombreIng + ': ' + ir.cantidad + ' ' + ir.unidad + (extras.length ? ' [' + extras.join(', ') + ']' : '');
  }).join('\n');

  var recetaNombre = snapshot.nombre || recNombres[pend.receta_id] || pend.receta_id;
  var instrucciones = String(snapshot.instrucciones || '').slice(0, 1500);

  var promptText = [
    'Eres un chef consultor experto en restaurantes tipo rodizzio/buffet. Audita la siguiente propuesta de receta para el restaurante Fogueira Oaxaca.',
    '',
    'Receta: ' + recetaNombre,
    'Categoría: ' + (snapshot.categoria_culinaria || ''),
    'Área: ' + (snapshot.area || ''),
    'Rendimiento: ' + (snapshot.rendimiento || '') + ' ' + (snapshot.unidad_rendimiento || ''),
    '',
    'Ingredientes:',
    ingredientesTexto || '(sin ingredientes registrados)',
    '',
    'Instrucciones:',
    instrucciones || '(sin instrucciones)',
    '',
    'Cambios propuestos: ' + (pend.cambios_resumen || ''),
    '',
    'Responde ÚNICAMENTE con un objeto JSON (sin markdown, sin texto adicional):',
    '{',
    '  "veredicto": "APROBADA" | "APROBADA_CON_OBSERVACIONES" | "RECHAZADA",',
    '  "resumen": "Una oración con el dictamen general (máx 120 caracteres)",',
    '  "hallazgos": [{ "severidad": "info" | "advertencia" | "critico", "titulo": "...", "descripcion": "..." }]',
    '}'
  ].join('\n');

  try {
    var options = {
      method: 'post',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: promptText }]
      }),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code !== 200) {
      var errBody;
      try { errBody = JSON.parse(body); } catch(e2) { errBody = {}; }
      var errMsg = (errBody.error && errBody.error.message) ? errBody.error.message : 'HTTP ' + code;
      return { ok:false, error:'Error de Anthropic: ' + errMsg };
    }
    var responseJson = JSON.parse(body);
    var textContent = responseJson.content && responseJson.content[0] && responseJson.content[0].text;
    if (!textContent) return { ok:false, error:'Respuesta vacía de Anthropic' };

    // Limpiar posible markdown
    var cleanText = textContent.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    var dictamen;
    try { dictamen = JSON.parse(cleanText); }
    catch(e3) { return { ok:false, error:'Respuesta IA no es JSON válido: ' + textContent.slice(0, 200) }; }
    if (!dictamen.veredicto || !dictamen.resumen) {
      return { ok:false, error:'Formato de respuesta IA inesperado' };
    }

    // Persistir en RecetasPendientes
    var ahora = new Date();
    var colAJ = _getOrCreateCol(sh, 'auditoria_json');
    var colAT = _getOrCreateCol(sh, 'auditoria_at');
    var sheetRow = -1;
    for (var k = 0; k < todos.length; k++) { if (todos[k].id === id) { sheetRow = k + 2; break; } }
    if (sheetRow > 1) {
      sh.getRange(sheetRow, colAJ).setValue(JSON.stringify(dictamen));
      sh.getRange(sheetRow, colAT).setValue(ahora);
    }

    return { ok:true, dictamen: dictamen };
  } catch(e) {
    return { ok:false, error:'Error al llamar Anthropic: ' + e.message };
  }
}

// =============================================================================
// NOTIFICACIONES DE RECHAZO AL CHEF (R7)
// El chef ve un banner en recetas.html por cada propuesta rechazada no vista.
// =============================================================================

// Devuelve las propuestas rechazadas que el usuario propuso y aún no ha visto.
function handleRecetasPendientesNotif(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rolesOK = ['cocina','churrasca','barman','panadero','admin','gerente_administrativo'];
  if (rolesOK.indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:true, notifs:[] };

  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var todos = rowsToObjects(sh);
  var pendientes = todos.filter(function(r){
    return r.propuesto_por_email === u.email &&
           String(r.estado).toLowerCase() === 'rechazado' &&
           !r.chef_vio_rechazo;
  });

  // Enriquecer con nombre de receta
  var shRec = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Recetas');
  var recNombres = {};
  if (shRec) rowsToObjects(shRec).forEach(function(r){ recNombres[r.id] = r.nombre; });

  var notifs = pendientes.map(function(r){
    return {
      id:            r.id,
      receta_id:     r.receta_id,
      receta_nombre: recNombres[r.receta_id] || r.receta_id,
      motivo:        r.motivo_rechazo || '',
      rechazado_at:  r.autorizado_at  || ''
    };
  });
  return { ok:true, notifs:notifs };
}

// Marca una propuesta rechazada como vista por el chef.
function handleRecetaNotifMarcarVisto(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var id = String(p.id || '').trim();
  if (!id) return { ok:false, error:'id requerido' };

  var sh = asegurarHoja('RecetasPendientes', RECETAS_PENDIENTES_COLS);
  var todos = rowsToObjects(sh);
  var rowIdx = -1;
  var pend = null;
  for (var i = 0; i < todos.length; i++) {
    if (todos[i].id === id) { pend = todos[i]; rowIdx = i; break; }
  }
  if (!pend) return { ok:false, error:'Pendiente no encontrado' };
  if (pend.propuesto_por_email !== u.email) return { ok:false, error:'Sin permisos' };

  var col = _getOrCreateCol(sh, 'chef_vio_rechazo');
  sh.getRange(rowIdx + 2, col).setValue(true);
  return { ok:true };
}

function handleCharolaRecetaSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rolesOK = ['admin','gerente_administrativo','gerente_restaurante','cocina','churrasca'];
  if (rolesOK.indexOf(String(u.rol||'').toLowerCase()) === -1) return { ok:false, error:'Sin permisos' };
  var charola_id = String(p.charola_id || '').trim();
  var receta_id = String(p.receta_id || '').trim();
  var porciones = parseFloat(p.porciones);
  if (!charola_id) return { ok:false, error:'charola_id requerido' };
  if (!receta_id) return { ok:false, error:'receta_id requerido' };
  if (!(porciones > 0)) return { ok:false, error:'porciones debe ser > 0' };
  var sh = asegurarHoja('CharolasRecetas', CHAROLAS_RECETAS_COLS);
  var todas = rowsToObjects(sh);
  var existente = todas.find(function(r){ return r.empresa_id === u.empresa_id && r.charola_id === charola_id; });
  var ahora = new Date();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (existente) {
    var idxRec = headers.indexOf('receta_id') + 1;
    var idxPor = headers.indexOf('porciones') + 1;
    var idxObs = headers.indexOf('observaciones') + 1;
    var idxAct = headers.indexOf('activo') + 1;
    var idxActAt = headers.indexOf('actualizado_at') + 1;
    var idxActPor = headers.indexOf('actualizado_por') + 1;
    if (idxRec) sh.getRange(existente._row, idxRec).setValue(receta_id);
    if (idxPor) sh.getRange(existente._row, idxPor).setValue(porciones);
    if (idxObs) sh.getRange(existente._row, idxObs).setValue(p.observaciones || '');
    if (idxAct) sh.getRange(existente._row, idxAct).setValue(p.activo !== false);
    if (idxActAt) sh.getRange(existente._row, idxActAt).setValue(ahora);
    if (idxActPor) sh.getRange(existente._row, idxActPor).setValue(u.email);
    return { ok:true, mensaje:'Vinculación actualizada', id: existente.id };
  } else {
    var nuevoId = uuid();
    sh.appendRow([
      nuevoId, u.empresa_id, charola_id, receta_id, porciones,
      String(p.area || ''), String(p.observaciones || ''),
      true, ahora, u.email, ahora, u.email
    ]);
    return { ok:true, mensaje:'Vinculación creada', id: nuevoId };
  }
}

