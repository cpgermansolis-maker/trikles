/**
 * Inventario Churrasca — Handlers de la API (Fase 4)
 *
 * Réplica fiel del Excel semanal de Marcos. Vista por semana, día por día.
 * 3 secciones: Congelador (carnes), Bodega (consumibles secos), Refrigerador (frescos).
 *
 * Flujo:
 *   1. Una vez (setup): cargar configuración con ingredientes a inventariar (vía endpoint setup)
 *   2. Cada lunes: el sistema crea una nueva semana automáticamente, copiando inv_final del domingo previo como inv_inicial
 *   3. Diariamente: Marcos/cocina/admin captura entradas y salidas (edición inline)
 *   4. inv_final se calcula al vuelo: inicial + entrada - salida
 *   5. Si la salida del día excede el promedio histórico en >20%, se levanta alerta_consumo
 */

// Roles autorizados a ver el inventario churrasca
var INV_CHURRASCA_LECTURA = ['admin','gerente_administrativo','auditoria','churrasca','cocina','encargado_piso','gerente_restaurante','almacen'];
// Roles que pueden capturar movimientos
var INV_CHURRASCA_EDITA = ['admin','gerente_administrativo','churrasca','cocina','almacen'];

// Helper: nombre del día en español
function _diaSemanaEs(date) {
  var dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return dias[date.getDay()];
}

// Helper: ISO week (YYYY-Www) — cálculo manual sin libs
function _isoWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

// Helper: lunes de una semana ISO
function _lunesDeSemana(semanaIso) {
  var m = semanaIso.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  var year = Number(m[1]), week = Number(m[2]);
  // Encuentra el primer jueves del año (siempre está en la semana 1)
  var jan4 = new Date(Date.UTC(year, 0, 4));
  var diasDesdeLunes = (jan4.getUTCDay() + 6) % 7; // 0=lunes
  var lunesSem1 = new Date(jan4);
  lunesSem1.setUTCDate(jan4.getUTCDate() - diasDesdeLunes);
  var lunesObjetivo = new Date(lunesSem1);
  lunesObjetivo.setUTCDate(lunesSem1.getUTCDate() + (week - 1) * 7);
  return lunesObjetivo;
}

function _formatFecha(date) {
  return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
}

// Helper: día 'YYYY-MM-DD' robusto desde una celda de fecha.
// Sheets a veces devuelve un objeto Date en lugar del texto (lección v279) → siempre
// pasar por fechaToString. Acepta Date, 'YYYY-MM-DD' o 'YYYY-MM-DD HH:MM'.
function _invDiaStr(x) {
  if (x == null || x === '') return '';
  if (Object.prototype.toString.call(x) === '[object Date]') return fechaToString(x);
  var m = String(x).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

// =============== Configuración de qué ingredientes inventariar ===============
function handleInvChurrascaConfigList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, INV_CHURRASCA_LECTURA)) return { ok:false, error:'Sin permiso' };
  var config = rowsToObjects(getSheet('InventarioChurrascaConfig')).filter(function(r){
    return r.empresa_id === u.empresa_id && (r.activo === true || r.activo === 'TRUE' || r.activo === 'true');
  });
  // Resolver con datos del ingrediente
  var ingredientes = rowsToObjects(getSheet('Ingredientes'));
  var mapa = {};
  ingredientes.forEach(function(i){ mapa[i.id] = i; });

  var lista = config.map(function(c){
    var ing = mapa[c.ingrediente_id];
    return {
      ingrediente_id: c.ingrediente_id,
      seccion: c.seccion,
      orden: Number(c.orden) || 0,
      nombre: ing ? ing.nombre : '(no encontrado)',
      unidad: ing ? ing.unidad_base : '',
      ultimo_costo: ing ? Number(ing.ultimo_costo) || 0 : 0
    };
  });
  // Ordenar por sección y luego por orden
  var ordenSecciones = { 'Congelador': 0, 'Bodega': 1, 'Refrigerador': 2 };
  lista.sort(function(a, b){
    var sa = ordenSecciones[a.seccion] !== undefined ? ordenSecciones[a.seccion] : 99;
    var sb = ordenSecciones[b.seccion] !== undefined ? ordenSecciones[b.seccion] : 99;
    if (sa !== sb) return sa - sb;
    if (a.orden !== b.orden) return a.orden - b.orden;
    return String(a.nombre).localeCompare(String(b.nombre));
  });
  return { ok: true, config: lista };
}

function handleInvChurrascaConfigSave(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria'])) return { ok:false, error:'Solo Admin/Auditoría configura el inventario' };
  if (!p.ingrediente_id || !p.seccion) return { ok:false, error:'Faltan ingrediente_id y seccion' };
  if (['Congelador','Bodega','Refrigerador'].indexOf(p.seccion) === -1) return { ok:false, error:'Sección inválida' };

  var sh = getSheet('InventarioChurrascaConfig');
  var rows = rowsToObjects(sh);
  var existing = rows.find(function(r){ return r.empresa_id === u.empresa_id && r.ingrediente_id === p.ingrediente_id; });
  var ahora = new Date();
  if (existing) {
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var colSec = headers.indexOf('seccion') + 1;
    var colOrd = headers.indexOf('orden') + 1;
    var colAct = headers.indexOf('activo') + 1;
    if (colSec > 0) sh.getRange(existing._row, colSec).setValue(p.seccion);
    if (colOrd > 0 && p.orden !== undefined) sh.getRange(existing._row, colOrd).setValue(Number(p.orden) || 0);
    if (colAct > 0) sh.getRange(existing._row, colAct).setValue(p.activo === false ? false : true);
  } else {
    sh.appendRow([u.empresa_id, p.ingrediente_id, p.seccion, Number(p.orden) || 0, true, ahora, u.email]);
  }
  return { ok: true };
}

// =============== Vista semanal (corazón del módulo) ===============
function handleInvChurrascaGetSemana(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, INV_CHURRASCA_LECTURA)) return { ok:false, error:'Sin permiso' };

  var semana = p.semana_iso || _isoWeek(new Date());

  // 1. Resolver fechas de la semana (lunes a domingo)
  var lunes = _lunesDeSemana(semana);
  if (!lunes) return { ok:false, error:'Semana inválida (formato: YYYY-Www)' };
  var fechas = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lunes);
    d.setUTCDate(lunes.getUTCDate() + i);
    fechas.push({
      fecha: _formatFecha(d),
      dia_semana: ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i]
    });
  }

  // 2. Obtener config (qué ingredientes inventariar)
  var configReq = handleInvChurrascaConfigList({ token: p.token });
  if (!configReq.ok) return configReq;
  var config = configReq.config;

  // 2b. Vínculo SR12 por ingrediente: clave + si está vinculado + cuántas compras tiene registradas.
  // Es el "puente" que permite auto-llenar las ENTRADAS desde Compras (Paso 1 del inventario teórico).
  var claveDeIng = {};
  rowsToObjects(getSheet('Ingredientes')).forEach(function(i){
    if (i.empresa_id === u.empresa_id && i.clave_sr12) {
      var c = String(i.clave_sr12).trim();
      if (c) claveDeIng[i.id] = c;
    }
  });
  var shMatch = getSheet('IngredientesSR12Match');
  if (shMatch) {
    rowsToObjects(shMatch).forEach(function(m){
      if (m.empresa_id === u.empresa_id && m.clave_sr12 && m.ingrediente_id_fogueira && !claveDeIng[m.ingrediente_id_fogueira]) {
        claveDeIng[m.ingrediente_id_fogueira] = String(m.clave_sr12).trim();
      }
    });
  }
  // Contamos compras por CLAVE SR12 (no por ingrediente_id): así, aunque la carne se vincule
  // DESPUÉS de importar las compras, sus compras históricas aparecen igual (la clave vive en cada línea).
  // comprasPorClaveYDia: suma de cantidad por clave+día → es la ENTRADA sugerida (Paso 1 teórico).
  var comprasPorClave = {};
  var comprasPorClaveYDia = {};
  var shCompras = getSheet('ComprasSR12');
  if (shCompras) {
    rowsToObjects(shCompras).forEach(function(r){
      if (r.empresa_id === u.empresa_id && r.clave_sr12) {
        var ck = sr12NormalizarClave(r.clave_sr12);
        comprasPorClave[ck] = (comprasPorClave[ck] || 0) + 1;
        var dia = _invDiaStr(r.fecha_dia);
        if (dia) {
          if (!comprasPorClaveYDia[ck]) comprasPorClaveYDia[ck] = {};
          comprasPorClaveYDia[ck][dia] = (comprasPorClaveYDia[ck][dia] || 0) + (Number(r.cantidad) || 0);
        }
      }
    });
  }

  // 3. Obtener movimientos de la semana
  var movs = rowsToObjects(getSheet('InventarioChurrasca')).filter(function(r){
    return r.empresa_id === u.empresa_id && r.semana_iso === semana;
  });

  // 4. Construir grid: por cada ingrediente, por cada día, devolver {inv_inicial, entrada, salida, inv_final, id}
  var grid = config.map(function(c){
    var claveIng = claveDeIng[c.ingrediente_id] || '';
    var claveNorm = claveIng ? sr12NormalizarClave(claveIng) : '';
    var comprasDias = claveNorm ? (comprasPorClaveYDia[claveNorm] || {}) : {};
    var dias = fechas.map(function(f){
      var mov = movs.find(function(m){ return m.ingrediente_id === c.ingrediente_id && m.fecha === f.fecha; });
      var inicial = mov ? Number(mov.inv_inicial) || 0 : 0;
      var entrada = mov ? Number(mov.entrada) || 0 : 0;
      var salida = mov ? Number(mov.salida) || 0 : 0;
      // Entrada sugerida = suma de compras del SR12 de ese día para la clave vinculada.
      var sugerida = Number(comprasDias[f.fecha] || 0);
      return {
        id: mov ? mov.id : null,
        fecha: f.fecha,
        dia_semana: f.dia_semana,
        inv_inicial: inicial,
        entrada: entrada,
        salida: salida,
        inv_final: inicial + entrada - salida,
        entrada_sugerida: sugerida,
        alerta_consumo: mov ? (mov.alerta_consumo === true || mov.alerta_consumo === 'TRUE' || mov.alerta_consumo === 'true') : false,
        responsable_email: mov ? mov.responsable_email : ''
      };
    });
    var totalEnt = dias.reduce(function(s, d){ return s + d.entrada; }, 0);
    var totalSal = dias.reduce(function(s, d){ return s + d.salida; }, 0);
    var totalSug = dias.reduce(function(s, d){ return s + (d.entrada_sugerida || 0); }, 0);
    var invInicialSemana = dias[0].inv_inicial;
    var invFinalSemana = dias[6].inv_final;
    return {
      ingrediente_id: c.ingrediente_id,
      nombre: c.nombre,
      unidad: c.unidad,
      ultimo_costo: c.ultimo_costo,
      seccion: c.seccion,
      orden: c.orden,
      clave_sr12: claveIng,
      vinculado: !!claveIng,
      n_compras: claveNorm ? (comprasPorClave[claveNorm] || 0) : 0,
      dias: dias,
      total_entradas: totalEnt,
      total_salidas: totalSal,
      total_sugerido: totalSug,
      inv_inicial_semana: invInicialSemana,
      inv_final_semana: invFinalSemana
    };
  });

  return { ok: true, semana_iso: semana, fechas: fechas, grid: grid };
}

// =============== Helper: propagar herencia inv_inicial a días posteriores ===============
// Cuando cambia un campo del día N, los días N+1, N+2, ... heredan: inv_inicial(N+1) = inv_final(N).
// Solo afecta filas existentes (no crea nuevas).
// Esto recorre todas las filas del ingrediente ordenadas por fecha y recalcula desde fechaDesde en adelante.
function _propagarHerenciaIngrediente(empresaId, ingredienteId, fechaDesde) {
  var sh = getSheet('InventarioChurrasca');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = rowsToObjects(sh);
  var filas = rows.filter(function(r){
    return r.empresa_id === empresaId && r.ingrediente_id === ingredienteId;
  });
  filas.sort(function(a, b){ return String(a.fecha).localeCompare(String(b.fecha)); });

  var idxDesde = filas.findIndex(function(r){ return r.fecha === fechaDesde; });
  if (idxDesde < 0 || idxDesde >= filas.length - 1) return 0; // no hay siguiente

  var colInicial = headers.indexOf('inv_inicial') + 1;
  if (colInicial <= 0) return 0;

  var actualizados = 0;
  // Empezar desde el día siguiente al modificado
  for (var i = idxDesde + 1; i < filas.length; i++) {
    var anterior = filas[i - 1];
    var actual = filas[i];
    var invFinalAnt = (Number(anterior.inv_inicial) || 0) + (Number(anterior.entrada) || 0) - (Number(anterior.salida) || 0);
    if ((Number(actual.inv_inicial) || 0) !== invFinalAnt) {
      sh.getRange(actual._row, colInicial).setValue(invFinalAnt);
      actual.inv_inicial = invFinalAnt;
      actualizados++;
    }
  }
  return actualizados;
}

// ============================================================================
//  CONTROL DE MERMAS (por insumo) — gemelo digital de la hoja del chef. Fase 1.
//  Registra merma de un INSUMO crudo (producto + cantidad + motivo), la valoriza
//  en $ (precio_real × cantidad × conversión de unidad) y la descuenta del
//  inventario TEÓRICO (InventarioChurrasca.salida, marcada 'merma:') SOLO si el
//  insumo está configurado como inventariable. NO toca las existencias del SR12.
//  (La merma de PLATILLO sigue por charolas tipo='merma'.)
// ============================================================================
var MERMAS_COLS = ['id','empresa_id','sucursal_id','fecha','hora','area','motivo',
  'ingrediente_id','ingrediente_nombre','cantidad','unidad','cant_descontada',
  'costo_unitario','costo_total','observacion','responsable_email','responsable_nombre',
  'descuento_aplicado','creado_at'];
var MERMA_ROLES = ['admin','gerente_administrativo','auditoria','cocina','churrasca','barman','panadero'];

// Suma una cantidad (ya en la unidad del inventario) a la salida del día del insumo.
// Mismo mecanismo que el descuento de charolas; tag 'merma:<id>' para auditar.
function _mermaDescontarInsumo(empresaId, sucursalId, fecha, ingredienteId, cantInv, origenTag, userEmail){
  if (!cantInv || cantInv <= 0) return false;
  var sh = getSheet('InventarioChurrasca');
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var rows = rowsToObjects(sh);
  var d = new Date(fecha);
  var diaSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
  var dUtc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = dUtc.getUTCDay() || 7;
  dUtc.setUTCDate(dUtc.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(dUtc.getUTCFullYear(), 0, 1));
  var weekNum = Math.ceil(((dUtc - yearStart) / 86400000 + 1) / 7);
  var semanaIso = dUtc.getUTCFullYear() + '-W' + String(weekNum).padStart(2,'0');
  var ahora = new Date();
  var fila = rows.find(function(r){ return r.empresa_id===empresaId && r.ingrediente_id===ingredienteId && r.fecha===fecha; });
  if (fila){
    var colSal = headers.indexOf('salida')+1;
    var nuevaSalida = (Number(fila.salida)||0) + cantInv;
    sh.getRange(fila._row, colSal).setValue(Number(nuevaSalida.toFixed(4)));
    var colAct = headers.indexOf('actualizado_at')+1; if (colAct>0) sh.getRange(fila._row,colAct).setValue(ahora);
    var colActPor = headers.indexOf('actualizado_por')+1; if (colActPor>0) sh.getRange(fila._row,colActPor).setValue(origenTag);
    _propagarHerenciaIngrediente(empresaId, ingredienteId, fecha);
  } else {
    var fila2 = {}; headers.forEach(function(h){ fila2[h]=''; });
    var nueva = { id:uuid(), empresa_id:empresaId, sucursal_id:sucursalId, semana_iso:semanaIso,
      fecha:fecha, dia_semana:diaSemana, ingrediente_id:ingredienteId, inv_inicial:0, entrada:0,
      salida:Number(cantInv.toFixed(4)), alerta_consumo:false, responsable_email:userEmail,
      actualizado_at:ahora, actualizado_por:origenTag };
    Object.keys(nueva).forEach(function(k){ fila2[k]=nueva[k]; });
    sh.appendRow(headers.map(function(h){ return fila2[h]; }));
  }
  return true;
}
// Resta de vuelta una cantidad ya descontada (al borrar una merma).
function _mermaRevertirInsumo(empresaId, ingredienteId, fecha, cantInv){
  if (!cantInv || cantInv <= 0) return false;
  var sh = getSheet('InventarioChurrasca');
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var fila = rowsToObjects(sh).find(function(r){ return r.empresa_id===empresaId && r.ingrediente_id===ingredienteId && r.fecha===fecha; });
  if (!fila) return false;
  var colSal = headers.indexOf('salida')+1;
  var nuevaSalida = Math.max(0, (Number(fila.salida)||0) - cantInv);
  sh.getRange(fila._row, colSal).setValue(Number(nuevaSalida.toFixed(4)));
  _propagarHerenciaIngrediente(empresaId, ingredienteId, fecha);
  return true;
}

function handleMermaCreate(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, MERMA_ROLES)) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var ingId = String(data.ingrediente_id||'').trim();
  if (!ingId) return { ok:false, error:'Elige el insumo mermado' };
  var cantidad = Number(data.cantidad) || 0;
  if (cantidad <= 0) return { ok:false, error:'La cantidad debe ser mayor a 0' };
  var unidad = String(data.unidad||'').trim();
  var motivo = String(data.motivo||'').trim();
  if (!motivo) return { ok:false, error:'Elige el motivo de la merma' };
  var observacion = String(data.observacion||'').trim().slice(0,300);
  var area = String(data.area||'').trim().toLowerCase();
  var fecha = String(data.fecha||'').trim() || fechaToString(new Date());
  var hora = String(data.hora||'').trim() || nowHHMM();
  var sucursal_id = data.sucursal_id || ((rowsToObjects(getSheet('Sucursales')).find(function(s){ return s.empresa_id === u.empresa_id; })||{}).id || '');

  var ing = rowsToObjects(getSheet('Ingredientes')).find(function(r){ return r.id === ingId && r.empresa_id === u.empresa_id; });
  if (!ing) return { ok:false, error:'Insumo no encontrado' };

  // Valorización en $: precio por unidad_base × (cantidad convertida a unidad_base).
  var precioBase = Number(ing.precio_real_unitario || ing.ultimo_costo || ing.costo_promedio || 0) || 0;
  var costoTotal = precioBase * cantidad * _unidadFactorBase(unidad, ing.unidad_base);
  var costoUnit = cantidad > 0 ? costoTotal / cantidad : 0;

  var id = uuid();
  // Descuento al inventario teórico SOLO si el insumo está configurado como inventariable.
  var cantDescontada = 0, descontado = false;
  try {
    var cfg = rowsToObjects(getSheet('InventarioChurrascaConfig')).find(function(c){
      return c.empresa_id === u.empresa_id && c.ingrediente_id === ingId && _truthy(c.activo);
    });
    if (cfg){
      cantDescontada = cantidad * _unidadFactorBase(unidad, cfg.unidad || ing.unidad_base);
      _mermaDescontarInsumo(u.empresa_id, sucursal_id, fecha, ingId, cantDescontada, 'merma:' + id, u.email);
      descontado = true;
    }
  } catch(e){}

  var sh = asegurarHoja('Mermas', MERMAS_COLS);
  sh.appendRow([id, u.empresa_id, sucursal_id, fecha, hora, area, motivo, ingId, ing.nombre,
    Number(cantidad.toFixed(4)), unidad, Number(cantDescontada.toFixed(4)),
    Number(costoUnit.toFixed(4)), Number(costoTotal.toFixed(2)),
    observacion, u.email, u.nombre||u.email, descontado, new Date()]);
  return { ok:true, id:id, costo_total: Number(costoTotal.toFixed(2)), descontado: descontado,
    aviso: descontado ? '' : 'Registrada. Este insumo no está en el inventario configurado, así que no descontó stock (solo queda anotada y valorizada).' };
}

// ============================================================================
//  PRODUCTOS DIRECTOS (descuento por gramaje, SIN receta) — solicitud Estefanía
//  (RecetarioFogueira_PRD/Solicitud_Boton_Productos_Directos_Fogueira.docx).
//
//  Quesos / fiambres / complementos / curtidos que salen a la barra de buffet TAL
//  CUAL, sin transformación ni receta. El de cocina pesa el montaje real (p.ej.
//  "850 g de Queso Manchego") y el sistema descuenta EXACTAMENTE esos gramos del
//  inventario de ese insumo. No es merma (es consumo servido).
//
//  Diseño ADITIVO — no toca handleCharolasCreate ni handleMermaCreate:
//   - Deja constancia en la hoja `Charolas` con un tipo NUEVO 'directo'
//     (descripcion = nombre del insumo, cantidad = gramos capturados, receta_id vacío),
//     para que aparezca en la lista del día de Charolas con su etiqueta.
//   - Reusa _mermaDescontarInsumo (mismo motor que charola/merma: suma a la salida
//     del día en InventarioChurrasca) SOLO si el insumo está configurado como
//     inventariable en InventarioChurrascaConfig. Si no, se registra igual (sin
//     descontar) con aviso, como hace handleMermaCreate.
//   - NO toca las existencias del SR12 (eso es "la foto" del POS).
// ============================================================================
var PRODUCTO_DIRECTO_ROLES = ['cocina','churrasca','admin','gerente_administrativo','auditoria'];

function handleProductoDirectoCreate(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rol = String(u.rol||'').toLowerCase();
  if (PRODUCTO_DIRECTO_ROLES.indexOf(rol) === -1) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }

  // Por ahora SOLO cocina (la solicitud es exclusiva del área de cocina). Si más
  // adelante se habilita en churrasca, basta ampliar esta validación.
  var area = String(data.area || 'cocina').toLowerCase();
  if (['cocina','churrasca'].indexOf(area) === -1) return { ok:false, error:'Área inválida' };
  // Un rol de área solo registra en SU área (igual candado que las charolas).
  if (rol === 'cocina'   && area !== 'cocina')   return { ok:false, error:'Solo productos directos de cocina' };
  if (rol === 'churrasca' && area !== 'churrasca') return { ok:false, error:'Solo productos directos de churrasca' };

  var ingId = String(data.ingrediente_id || '').trim();
  if (!ingId) return { ok:false, error:'Elige el producto' };
  var gramos = Number(data.gramos);
  if (!(gramos > 0)) return { ok:false, error:'Captura el peso en gramos (mayor a 0)' };

  var fecha = String(data.fecha||'').trim() || fechaToString(new Date());
  var hora  = String(data.hora||'').trim()  || nowHHMM();
  var sucursal_id = data.sucursal_id || ((rowsToObjects(getSheet('Sucursales')).find(function(s){ return s.empresa_id === u.empresa_id; })||{}).id || '');

  var ing = rowsToObjects(getSheet('Ingredientes')).find(function(r){ return r.id === ingId && r.empresa_id === u.empresa_id; });
  if (!ing) return { ok:false, error:'Producto no encontrado' };

  // Dejar constancia en la hoja Charolas con tipo 'directo'.
  // 13 columnas: id,empresa_id,sucursal_id,fecha,hora,area,tipo,descripcion,cantidad,
  //              responsable_email,creado_at,receta_id,descuento_aplicado
  var newId = uuid();
  var nombreProd = String(ing.nombre || '').trim() || ingId;

  // Descuento directo al inventario teórico SOLO si el insumo está configurado como
  // inventariable. Se capturan gramos; se convierten a la unidad del inventario.
  var cantDescontada = 0, descontado = false;
  try {
    var cfg = rowsToObjects(getSheet('InventarioChurrascaConfig')).find(function(c){
      return c.empresa_id === u.empresa_id && c.ingrediente_id === ingId && _truthy(c.activo);
    });
    if (cfg){
      // Gramos → unidad del inventario (config) o, si no la trae, la unidad_base del insumo.
      cantDescontada = gramos * _unidadFactorBase('g', cfg.unidad || ing.unidad_base);
      if (cantDescontada > 0){
        _mermaDescontarInsumo(u.empresa_id, sucursal_id, fecha, ingId, cantDescontada, 'directo:' + newId, u.email);
        descontado = true;
      }
    }
  } catch(e){ try { Logger.log('Producto directo: descuento falló: ' + e); } catch(_){} }

  // cantidad = gramos capturados (la unidad del registro de producto directo es SIEMPRE gramos).
  getSheet('Charolas').appendRow([newId, u.empresa_id, sucursal_id, fecha, hora, area, 'directo',
    nombreProd, Number(gramos.toFixed(2)), u.email, new Date(), '', descontado]);

  return { ok:true, id:newId, gramos:Number(gramos.toFixed(2)), descontado:descontado,
    aviso: descontado ? '' : 'Registrado. Este producto aún no está en el inventario configurado, así que quedó anotado pero no descontó stock. Pide a almacén/Estefanía marcarlo como inventariable.' };
}

function handleMermasList(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, MERMA_ROLES)) return { ok:false, error:'Sin permisos' };
  var sh = SpreadsheetApp.getActive().getSheetByName('Mermas');
  if (!sh) return { ok:true, mermas:[], total_costo:0 };
  var desde = String(p.fecha_desde||'').trim(), hasta = String(p.fecha_hasta||'').trim();
  var area = String(p.area||'').trim().toLowerCase();
  var lista = rowsToObjects(sh).filter(function(m){
    if (m.empresa_id !== u.empresa_id) return false;
    var f = fechaToString(m.fecha);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    if (area && String(m.area||'').toLowerCase() !== area) return false;
    return true;
  }).map(function(m){
    return { id:m.id, fecha:fechaToString(m.fecha), hora:horaToString(m.hora), area:m.area||'', motivo:m.motivo||'',
      ingrediente_nombre:m.ingrediente_nombre||'', cantidad:Number(m.cantidad)||0, unidad:m.unidad||'',
      costo_total:Number(m.costo_total)||0, observacion:m.observacion||'',
      responsable:m.responsable_nombre||m.responsable_email||'', descontado:_truthy(m.descuento_aplicado) };
  });
  lista.sort(function(a,b){ return (a.fecha+'T'+a.hora) < (b.fecha+'T'+b.hora) ? 1 : -1; }); // recientes arriba
  var total = lista.reduce(function(s,m){ return s + (m.costo_total||0); }, 0);
  return { ok:true, mermas:lista, total_costo: Number(total.toFixed(2)) };
}

function handleMermaDelete(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, MERMA_ROLES)) return { ok:false, error:'Sin permisos' };
  if (!p.id) return { ok:false, error:'id requerido' };
  var sh = getSheet('Mermas');
  if (!sh) return { ok:false, error:'No hay mermas' };
  var m = rowsToObjects(sh).find(function(x){ return x.id===p.id && x.empresa_id===u.empresa_id; });
  if (!m) return { ok:false, error:'Merma no encontrada' };
  var rol = String(u.rol||'').toLowerCase();
  if (['admin','gerente_administrativo','auditoria'].indexOf(rol) === -1 && String(m.responsable_email||'') !== u.email)
    return { ok:false, error:'Solo puedes borrar tus propios registros' };
  // Revertir el descuento de inventario si se había aplicado (deja el stock consistente).
  if (_truthy(m.descuento_aplicado) && Number(m.cant_descontada) > 0){
    try { _mermaRevertirInsumo(u.empresa_id, m.ingrediente_id, fechaToString(m.fecha), Number(m.cant_descontada)); } catch(e){}
  }
  sh.deleteRow(m._row);
  return { ok:true };
}

// =============== Guardar/actualizar movimiento de un día ===============
function handleInvChurrascaSaveCelda(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, INV_CHURRASCA_EDITA)) return { ok:false, error:'Sin permiso para editar' };

  if (!p.ingrediente_id || !p.fecha) return { ok:false, error:'Faltan ingrediente_id y fecha' };
  if (!p.campo || ['inv_inicial','entrada','salida'].indexOf(p.campo) === -1) return { ok:false, error:'Campo inválido (debe ser inv_inicial/entrada/salida)' };

  var fecha = new Date(p.fecha);
  if (isNaN(fecha.getTime())) return { ok:false, error:'Fecha inválida' };
  var semana = _isoWeek(fecha);
  var diaSemana = _diaSemanaEs(fecha);
  var nuevo = Number(p.valor);
  if (isNaN(nuevo) || nuevo < 0) return { ok:false, error:'Valor inválido (debe ser número >= 0)' };

  var sh = getSheet('InventarioChurrasca');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = rowsToObjects(sh);
  var existing = rows.find(function(r){
    return r.empresa_id === u.empresa_id && r.ingrediente_id === p.ingrediente_id && r.fecha === p.fecha;
  });
  var ahora = new Date();

  if (existing) {
    var col = headers.indexOf(p.campo) + 1;
    if (col <= 0) return { ok:false, error:'Columna no encontrada' };
    var anterior = Number(existing[p.campo]) || 0;
    if (anterior === nuevo) return { ok: true, sin_cambios: true };
    sh.getRange(existing._row, col).setValue(nuevo);
    existing[p.campo] = nuevo; // actualizar en memoria para propagación
    var colAct = headers.indexOf('actualizado_at') + 1;
    var colActPor = headers.indexOf('actualizado_por') + 1;
    var colResp = headers.indexOf('responsable_email') + 1;
    if (colAct > 0) sh.getRange(existing._row, colAct).setValue(ahora);
    if (colActPor > 0) sh.getRange(existing._row, colActPor).setValue(u.email);
    if (colResp > 0 && !existing.responsable_email) sh.getRange(existing._row, colResp).setValue(u.email);

    // === Propagar herencia de inv_inicial a días posteriores ===
    var diasPropagados = _propagarHerenciaIngrediente(u.empresa_id, p.ingrediente_id, p.fecha);

    // Alerta de consumo: si la salida del día es >120% del promedio histórico de ese ingrediente
    var alertaCons = false, promHist = null;
    if (p.campo === 'salida' && nuevo > 0) {
      var historicas = rows.filter(function(r){
        return r.ingrediente_id === p.ingrediente_id && r.salida && Number(r.salida) > 0 && r.fecha !== p.fecha;
      });
      if (historicas.length >= 5) {
        var promedio = historicas.reduce(function(s, r){ return s + Number(r.salida); }, 0) / historicas.length;
        alertaCons = nuevo > promedio * 1.20;
        promHist = Number(promedio.toFixed(3));
        var colAlerta = headers.indexOf('alerta_consumo') + 1;
        if (colAlerta > 0) sh.getRange(existing._row, colAlerta).setValue(alertaCons);
      }
    }
    return { ok: true, alerta_consumo: alertaCons, promedio_historico: promHist, dias_propagados: diasPropagados };
  } else {
    // Crear fila nueva
    var fila = {};
    headers.forEach(function(h){ fila[h] = ''; });
    Object.assign(fila, {
      id: uuid(),
      empresa_id: u.empresa_id,
      sucursal_id: '',  // por ahora vacío
      semana_iso: semana,
      fecha: p.fecha,
      dia_semana: diaSemana,
      ingrediente_id: p.ingrediente_id,
      inv_inicial: p.campo === 'inv_inicial' ? nuevo : 0,
      entrada: p.campo === 'entrada' ? nuevo : 0,
      salida: p.campo === 'salida' ? nuevo : 0,
      alerta_consumo: false,
      responsable_email: u.email,
      actualizado_at: ahora,
      actualizado_por: u.email
    });
    var nuevaFila = headers.map(function(h){ return fila[h]; });
    sh.appendRow(nuevaFila);
    // Propagar herencia también desde la fila recién creada
    var diasPropagados2 = _propagarHerenciaIngrediente(u.empresa_id, p.ingrediente_id, p.fecha);
    return { ok: true, dias_propagados: diasPropagados2 };
  }
  return { ok: true };
}

// =============== Auto-llenar ENTRADAS desde Compras SR12 (Paso 1 del inventario teórico) ===============
// Llena la columna ENT de la semana con la suma de compras (hoja ComprasSR12) por ingrediente+día,
// usando la clave SR12 vinculada como puente. Por defecto SOLO llena casillas en 0 (no pisa lo
// capturado a mano); con p.sobrescribir=true reemplaza también las que tengan valor.
// Opera SOBRE FILAS EXISTENTES (la semana debe estar creada). Re-propaga la herencia de inv_inicial.
function handleInvChurrascaAutollenarEntradas(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, INV_CHURRASCA_EDITA)) return { ok:false, error:'Sin permiso para editar' };

  var semana = p.semana_iso || _isoWeek(new Date());
  var lunes = _lunesDeSemana(semana);
  if (!lunes) return { ok:false, error:'Semana inválida (formato: YYYY-Www)' };
  var sobrescribir = (p.sobrescribir === true || p.sobrescribir === 'true');

  // 1. Fechas de la semana (lunes a domingo)
  var fechasSemana = [];
  for (var i = 0; i < 7; i++) {
    var dd = new Date(lunes); dd.setUTCDate(lunes.getUTCDate() + i);
    fechasSemana.push(_formatFecha(dd));
  }
  var fechaLunes = fechasSemana[0];

  // 2. Clave SR12 por ingrediente (mismo puente que get_semana: Ingredientes.clave_sr12 + IngredientesSR12Match)
  var claveDeIng = {};
  rowsToObjects(getSheet('Ingredientes')).forEach(function(it){
    if (it.empresa_id === u.empresa_id && it.clave_sr12) {
      var c = String(it.clave_sr12).trim(); if (c) claveDeIng[it.id] = c;
    }
  });
  var shMatch = getSheet('IngredientesSR12Match');
  if (shMatch) {
    rowsToObjects(shMatch).forEach(function(m){
      if (m.empresa_id === u.empresa_id && m.clave_sr12 && m.ingrediente_id_fogueira && !claveDeIng[m.ingrediente_id_fogueira]) {
        claveDeIng[m.ingrediente_id_fogueira] = String(m.clave_sr12).trim();
      }
    });
  }

  // 3. Compras de la semana por clave normalizada + día
  var comprasPorClaveYDia = {};
  var shCompras = getSheet('ComprasSR12');
  if (shCompras) {
    rowsToObjects(shCompras).forEach(function(r){
      if (r.empresa_id !== u.empresa_id || !r.clave_sr12) return;
      var dia = _invDiaStr(r.fecha_dia);
      if (fechasSemana.indexOf(dia) === -1) return; // solo esta semana
      var ck = sr12NormalizarClave(r.clave_sr12);
      if (!comprasPorClaveYDia[ck]) comprasPorClaveYDia[ck] = {};
      comprasPorClaveYDia[ck][dia] = (comprasPorClaveYDia[ck][dia] || 0) + (Number(r.cantidad) || 0);
    });
  }

  // 4. Recorrer las filas existentes de la semana y llenar la ENTRADA
  var sh = getSheet('InventarioChurrasca');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colEnt = headers.indexOf('entrada') + 1;
  var colAct = headers.indexOf('actualizado_at') + 1;
  var colActPor = headers.indexOf('actualizado_por') + 1;
  var colResp = headers.indexOf('responsable_email') + 1;
  if (colEnt <= 0) return { ok:false, error:'Columna entrada no encontrada en InventarioChurrasca' };

  var rows = rowsToObjects(sh);
  var filasSemana = rows.filter(function(r){ return r.empresa_id === u.empresa_id && r.semana_iso === semana; });
  if (!filasSemana.length) {
    return { ok:false, error:'La semana ' + semana + ' no está creada todavía. Primero usa "Crear nueva semana".' };
  }

  var ahora = new Date();
  var celdasLlenas = 0, totalCant = 0, omitidasOcupadas = 0;
  var ingredientesTocados = {};

  filasSemana.forEach(function(r){
    var clave = claveDeIng[r.ingrediente_id];
    if (!clave) return; // no vinculado → no hay puente
    var dia = _invDiaStr(r.fecha) || String(r.fecha).slice(0, 10);
    var ck = sr12NormalizarClave(clave);
    var sugerida = (comprasPorClaveYDia[ck] && comprasPorClaveYDia[ck][dia]) || 0;
    if (sugerida <= 0) return; // ese día no hubo compras de este insumo
    var actual = Number(r.entrada) || 0;
    if (actual !== 0 && !sobrescribir) { omitidasOcupadas++; return; } // respeta lo capturado a mano
    if (actual === sugerida) return; // ya está igual, nada que hacer
    sh.getRange(r._row, colEnt).setValue(sugerida);
    if (colAct > 0) sh.getRange(r._row, colAct).setValue(ahora);
    if (colActPor > 0) sh.getRange(r._row, colActPor).setValue(u.email);
    if (colResp > 0 && !r.responsable_email) sh.getRange(r._row, colResp).setValue(u.email);
    celdasLlenas++;
    totalCant += sugerida;
    ingredientesTocados[r.ingrediente_id] = true;
  });

  // 5. Re-propagar la herencia de inv_inicial por cada ingrediente tocado (la entrada cambia el inv_final
  //    del día → el inicial de los días siguientes debe recalcularse).
  Object.keys(ingredientesTocados).forEach(function(ingId){
    _propagarHerenciaIngrediente(u.empresa_id, ingId, fechaLunes);
  });

  return {
    ok: true,
    celdas_llenas: celdasLlenas,
    total_cantidad: Number(totalCant.toFixed(3)),
    ingredientes_tocados: Object.keys(ingredientesTocados).length,
    omitidas_ocupadas: omitidasOcupadas
  };
}

// =============== Crear nueva semana (copia inv_final del domingo previo como inv_inicial del lunes) ===============
function handleInvChurrascaNuevaSemana(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, INV_CHURRASCA_EDITA)) return { ok:false, error:'Sin permiso' };

  var semanaNueva = p.semana_iso || _isoWeek(new Date());
  var lunesNueva = _lunesDeSemana(semanaNueva);
  if (!lunesNueva) return { ok:false, error:'Semana inválida' };
  var fechaLunes = _formatFecha(lunesNueva);

  // 1. Verificar que no existan ya filas de esa semana
  var sh = getSheet('InventarioChurrasca');
  var rows = rowsToObjects(sh);
  var existingSemana = rows.filter(function(r){ return r.empresa_id === u.empresa_id && r.semana_iso === semanaNueva; });
  if (existingSemana.length > 0) {
    return { ok: false, error: 'La semana ' + semanaNueva + ' ya tiene ' + existingSemana.length + ' filas. No se sobrescribe.' };
  }

  // 2. Obtener config
  var configReq = handleInvChurrascaConfigList({ token: p.token });
  if (!configReq.ok) return configReq;
  var config = configReq.config;
  if (!config.length) return { ok: false, error: 'No hay configuración de inventario. Configura ingredientes primero.' };

  // 3. Obtener inv_final del domingo de la semana anterior (si existe)
  var domingoAnterior = new Date(lunesNueva);
  domingoAnterior.setUTCDate(lunesNueva.getUTCDate() - 1);
  var fechaDomingoAnt = _formatFecha(domingoAnterior);
  var movsDomAnt = rows.filter(function(r){ return r.empresa_id === u.empresa_id && r.fecha === fechaDomingoAnt; });
  var mapaInvFinalAnt = {};
  movsDomAnt.forEach(function(m){
    var invFinal = (Number(m.inv_inicial) || 0) + (Number(m.entrada) || 0) - (Number(m.salida) || 0);
    mapaInvFinalAnt[m.ingrediente_id] = invFinal;
  });

  // 4. Crear 7 filas × N ingredientes para la nueva semana
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var ahora = new Date();
  var filasNuevas = [];
  for (var i = 0; i < 7; i++) {
    var fecha = new Date(lunesNueva);
    fecha.setUTCDate(lunesNueva.getUTCDate() + i);
    var fechaStr = _formatFecha(fecha);
    var diaStr = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i];
    config.forEach(function(c){
      var invInicial = i === 0 ? (mapaInvFinalAnt[c.ingrediente_id] || 0) : 0;
      var fila = {};
      headers.forEach(function(h){ fila[h] = ''; });
      Object.assign(fila, {
        id: uuid(),
        empresa_id: u.empresa_id,
        sucursal_id: '',
        semana_iso: semanaNueva,
        fecha: fechaStr,
        dia_semana: diaStr,
        ingrediente_id: c.ingrediente_id,
        inv_inicial: invInicial,
        entrada: 0,
        salida: 0,
        alerta_consumo: false,
        responsable_email: '',
        actualizado_at: ahora,
        actualizado_por: u.email
      });
      filasNuevas.push(headers.map(function(h){ return fila[h]; }));
    });
  }
  if (filasNuevas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, filasNuevas.length, headers.length).setValues(filasNuevas);
  }
  return { ok: true, semana_iso: semanaNueva, filas_creadas: filasNuevas.length, ingredientes_inventariar: config.length };
}

// =============== Endpoints admin temporales (uso Claude — Sprint 2) ===============
function handleAdminSetupHojas(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  try {
    setupHojas();
    return { ok: true, mensaje: 'setupHojas() ejecutado — hojas creadas/verificadas' };
  } catch(e) { return { ok:false, error: String(e.message || e) }; }
}

function handleAdminInvChurrascaSetup(p) {
  var SECRET = 'fogueira-refresco-web-2026-05-06-mQ8jK2rT9pL4';
  if (p.secret !== SECRET) return { ok:false, error:'Secret inválido' };
  // Llamar el handler como si fuera admin con un user fake
  var EMPRESA_ID = '521aef3c-7df7-49ad-b1af-583a95233cd0';
  var sh = getSheet('InventarioChurrascaConfig');
  if (!sh) return { ok:false, error:'Hoja InventarioChurrascaConfig no existe — corre admin_setup_hojas primero' };
  var rows = rowsToObjects(sh);
  var existing = rows.filter(function(r){ return r.empresa_id === EMPRESA_ID; });
  if (existing.length > 0) {
    return { ok: false, error: 'Ya hay ' + existing.length + ' filas de config — no se sobrescribe' };
  }

  function buscarPorNombre(nombre) {
    var ings = rowsToObjects(getSheet('Ingredientes'));
    var n = String(nombre).toLowerCase().trim();
    return ings.find(function(i){
      var nb = String(i.nombre || '').toLowerCase().trim();
      if (nb === n) return true;
      var aliases = String(i.aliases || '').split('|').map(function(x){ return x.toLowerCase().trim(); });
      return aliases.indexOf(n) !== -1;
    });
  }

  var lista = [
    { nombre: 'Pechuga de pollo',        seccion: 'Congelador', orden: 1 },
    { nombre: 'Costilla de cerdo',       seccion: 'Congelador', orden: 3 },
    { nombre: 'Top sirlon',              seccion: 'Congelador', orden: 6 },
    { nombre: 'Pierna y muslo de pollo', seccion: 'Congelador', orden: 8 },
    { nombre: 'Lomo canadiense',         seccion: 'Congelador', orden: 9 },
    { nombre: 'Chorizo brasileño',       seccion: 'Congelador', orden: 14 },
    { nombre: 'Picahna',                 seccion: 'Congelador', orden: 7 },
    { nombre: 'Filete de res',           seccion: 'Congelador', orden: 4 },
    { nombre: 'Vinagre blanco',          seccion: 'Bodega', orden: 1 },
    { nombre: 'Pimienta negra molida',   seccion: 'Bodega', orden: 2 },
    { nombre: 'Sal',                     seccion: 'Bodega', orden: 3 },
    { nombre: 'Aceite',                  seccion: 'Bodega', orden: 4 },
    { nombre: 'Aceite de olivo',         seccion: 'Bodega', orden: 5 },
    { nombre: 'Catsup',                  seccion: 'Bodega', orden: 6 },
    { nombre: 'Salsa Maggi',             seccion: 'Bodega', orden: 7 },
    { nombre: 'Salsa Tabasco',           seccion: 'Bodega', orden: 8 },
    { nombre: 'Salsa Inglesa',           seccion: 'Bodega', orden: 9 },
    { nombre: 'Azucar',                  seccion: 'Bodega', orden: 10 },
    { nombre: 'Romero',                  seccion: 'Bodega', orden: 11 },
    { nombre: 'Tomillo',                 seccion: 'Bodega', orden: 12 },
    { nombre: 'Ajo',                     seccion: 'Refrigerador', orden: 1 },
    { nombre: 'Cilantro',                seccion: 'Refrigerador', orden: 2 },
    { nombre: 'Limon',                   seccion: 'Refrigerador', orden: 3 },
    { nombre: 'Cebolla blanca',          seccion: 'Refrigerador', orden: 4 },
    { nombre: 'Cebolla morada',          seccion: 'Refrigerador', orden: 5 },
    { nombre: 'Tomate de segunda',       seccion: 'Refrigerador', orden: 6 },
  ];
  var ahora = new Date();
  var creados = 0, noEncontrados = [];
  var filasNuevas = [];
  lista.forEach(function(item){
    var ing = buscarPorNombre(item.nombre);
    if (!ing) { noEncontrados.push(item.nombre); return; }
    filasNuevas.push([EMPRESA_ID, ing.id, item.seccion, item.orden, true, ahora, 'sistema@fase4_setup']);
    creados++;
  });
  if (filasNuevas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, filasNuevas.length, 7).setValues(filasNuevas);
  }
  return { ok: true, creados: creados, no_encontrados: noEncontrados };
}

// =============== Setup inicial: poblar config con ingredientes recomendados de Marcos ===============
// Solo se ejecuta una vez. Idempotente: si ya hay config, no sobrescribe.
function handleInvChurrascaSetupInicial(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','auditoria'])) return { ok:false, error:'Solo Admin/Auditoría' };

  var sh = getSheet('InventarioChurrascaConfig');
  var rows = rowsToObjects(sh);
  var existing = rows.filter(function(r){ return r.empresa_id === u.empresa_id; });
  if (existing.length > 0) {
    return { ok: false, error: 'Ya hay configuración (' + existing.length + ' filas). Si quieres re-inicializar, limpia la hoja primero.' };
  }

  // Lista de ingredientes a inventariar (basada en el Excel de Marcos — INVENTARIO FOGUEIRA.xlsx)
  // Mapeados a IDs por nombre (incluyendo aliases — el sistema ya los conoce gracias al Sprint 1.5)
  function buscarPorNombre(nombre) {
    var ings = rowsToObjects(getSheet('Ingredientes'));
    var n = String(nombre).toLowerCase().trim();
    return ings.find(function(i){
      var nb = String(i.nombre || '').toLowerCase().trim();
      if (nb === n) return true;
      var aliases = String(i.aliases || '').split('|').map(function(x){ return x.toLowerCase().trim(); });
      return aliases.indexOf(n) !== -1;
    });
  }

  var lista = [
    // Congelador (carnes principales — orden del Excel de Marcos)
    { nombre: 'Pechuga de pollo',        seccion: 'Congelador', orden: 1 },
    { nombre: 'Costilla de cerdo',       seccion: 'Congelador', orden: 3 },
    { nombre: 'Top sirlon',              seccion: 'Congelador', orden: 6 },
    { nombre: 'Pierna y muslo de pollo', seccion: 'Congelador', orden: 8 },
    { nombre: 'Lomo canadiense',         seccion: 'Congelador', orden: 9 },
    { nombre: 'Chorizo brasileño',       seccion: 'Congelador', orden: 14 },
    { nombre: 'Picahna',                 seccion: 'Congelador', orden: 7 }, // mantengo el typo del catálogo
    { nombre: 'Filete de res',           seccion: 'Congelador', orden: 4 },
    // Bodega (consumibles — los principales)
    { nombre: 'Vinagre blanco',          seccion: 'Bodega', orden: 1 },
    { nombre: 'Pimienta negra molida',   seccion: 'Bodega', orden: 2 },
    { nombre: 'Sal',                     seccion: 'Bodega', orden: 3 },
    { nombre: 'Aceite',                  seccion: 'Bodega', orden: 4 },
    { nombre: 'Aceite de olivo',         seccion: 'Bodega', orden: 5 },
    { nombre: 'Catsup',                  seccion: 'Bodega', orden: 6 },
    { nombre: 'Salsa Maggi',             seccion: 'Bodega', orden: 7 },
    { nombre: 'Salsa Tabasco',           seccion: 'Bodega', orden: 8 },
    { nombre: 'Salsa Inglesa',           seccion: 'Bodega', orden: 9 },
    { nombre: 'Azucar',                  seccion: 'Bodega', orden: 10 },
    { nombre: 'Romero',                  seccion: 'Bodega', orden: 11 },
    { nombre: 'Tomillo',                 seccion: 'Bodega', orden: 12 },
    // Refrigerador (frescos)
    { nombre: 'Ajo',                     seccion: 'Refrigerador', orden: 1 },
    { nombre: 'Cilantro',                seccion: 'Refrigerador', orden: 2 },
    { nombre: 'Limon',                   seccion: 'Refrigerador', orden: 3 },
    { nombre: 'Cebolla blanca',          seccion: 'Refrigerador', orden: 4 },
    { nombre: 'Cebolla morada',          seccion: 'Refrigerador', orden: 5 },
    { nombre: 'Tomate de segunda',       seccion: 'Refrigerador', orden: 6 },
  ];

  var ahora = new Date();
  var creados = 0, noEncontrados = [];
  var filasNuevas = [];
  lista.forEach(function(item){
    var ing = buscarPorNombre(item.nombre);
    if (!ing) { noEncontrados.push(item.nombre); return; }
    filasNuevas.push([u.empresa_id, ing.id, item.seccion, item.orden, true, ahora, u.email]);
    creados++;
  });
  if (filasNuevas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, filasNuevas.length, 7).setValues(filasNuevas);
  }
  return { ok: true, creados: creados, no_encontrados: noEncontrados };
}

// =============================================================================
// ★ CUADRE DE CARNE SEMANAL — detector de fuga (pestaña del Tablero Directivo) ★
// =============================================================================
// Triángulo de fuentes en manos DISTINTAS:
//   Inicial(W) + Compras(W) − Final(W) = Consumo real(W)   ÷ comensales(W) = g/comensal
//   · Inicial(W) = conteo físico de Marcos al abrir la semana = inv_inicial del LUNES de W.
//   · Final(W)   = conteo físico al cerrar = inv_inicial del LUNES de la semana SIGUIENTE (mismo
//                  momento físico que el cierre del domingo). Si aún no existe la semana siguiente,
//                  cae al inv_final CALCULADO del domingo (provisional, marcado final_fisico=false).
//   · Compras(W) = suma de ComprasSR12.cantidad por clave SR12 vinculada, en los días lun–dom de W.
//   · comensales(W) = total de comensales de RODIZIO (bitácoras de servicio ≠ 'Desayuno').
// El semáforo compara cada semana contra la MEDIANA del propio corte (no contra un absoluto):
//   sube > +15% → amarillo, > +30% → rojo (consumo/persona disparado = posible fuga/desperdicio).
// El total del periodo TELESCOPA: cancela inicial/final intermedios → inicial(1ª)+ΣCompras−final(últ).
// Roles: los mismos que vigilan la fuga (Tablero Directivo) + gerente administrativo. SOLO LECTURA.

var CUADRE_CARNE_ROLES = ['admin','gerente_plaza','auditoria','gerente_administrativo'];
var CUADRE_DEV_AMARILLO = 15; // % por encima de la mediana del corte
var CUADRE_DEV_ROJO = 30;

// ISO week (YYYY-Www) a partir de un texto 'YYYY-MM-DD' — construye Date con partes locales
// para que _isoWeek extraiga el año/mes/día correctos sin sustos de zona horaria.
function _isoWeekDeStr(s) {
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return _isoWeek(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// Semana ISO siguiente a una dada (suma 7 días al lunes y recalcula).
function _isoWeekSiguiente(semIso) {
  var lun = _lunesDeSemana(semIso);
  if (!lun) return '';
  var sig = new Date(lun); sig.setUTCDate(lun.getUTCDate() + 7);
  return _isoWeek(new Date(sig.getUTCFullYear(), sig.getUTCMonth(), sig.getUTCDate()));
}

function _mediana(vals) {
  if (!vals || !vals.length) return 0;
  var s = vals.slice().sort(function(a, b){ return a - b; });
  var n = s.length, mid = Math.floor(n / 2);
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function handleDireccionCuadreCarne(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, CUADRE_CARNE_ROLES)) return { ok:false, error:'Sin permisos' };

  var nSemanas = Math.min(Math.max(parseInt(p.n_semanas || 8, 10), 2), 26);

  // 1. Carnes a cuadrar = config de la sección Congelador.
  var configReq = handleInvChurrascaConfigList({ token: p.token });
  if (!configReq.ok) return configReq;
  var carnes = configReq.config.filter(function(c){ return c.seccion === 'Congelador'; });
  if (!carnes.length) {
    return { ok:true, semanas:[], cortes:[], nota:'No hay carnes configuradas en el Congelador.' };
  }

  // 2. Puente clave SR12 por ingrediente (Ingredientes.clave_sr12 + IngredientesSR12Match).
  var claveDeIng = {};
  rowsToObjects(getSheet('Ingredientes')).forEach(function(it){
    if (it.empresa_id === u.empresa_id && it.clave_sr12) {
      var c = String(it.clave_sr12).trim(); if (c) claveDeIng[it.id] = c;
    }
  });
  var shMatch = getSheet('IngredientesSR12Match');
  if (shMatch) {
    rowsToObjects(shMatch).forEach(function(m){
      if (m.empresa_id === u.empresa_id && m.clave_sr12 && m.ingrediente_id_fogueira && !claveDeIng[m.ingrediente_id_fogueira]) {
        claveDeIng[m.ingrediente_id_fogueira] = String(m.clave_sr12).trim();
      }
    });
  }

  // 3. Inventario: por (ingrediente, semana) → inv_inicial del LUNES (conteo de apertura) y
  //    inv_final CALCULADO del domingo (último día). Detectamos lunes/domingo por fecha min/max.
  var invRows = rowsToObjects(getSheet('InventarioChurrasca')).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var inicialIngSem = {};   // ing -> sem -> { fecha, val }   (apertura física = inv_inicial del lunes)
  var finalCompIngSem = {}; // ing -> sem -> { fecha, val }   (cierre calculado del domingo)
  var semanasConInv = {};
  invRows.forEach(function(r){
    var sem = String(r.semana_iso || ''); if (!sem) return;
    var dia = _invDiaStr(r.fecha); if (!dia) return;
    semanasConInv[sem] = true;
    var ing = r.ingrediente_id;
    if (!inicialIngSem[ing]) inicialIngSem[ing] = {};
    if (!finalCompIngSem[ing]) finalCompIngSem[ing] = {};
    var curIni = inicialIngSem[ing][sem];
    if (!curIni || dia < curIni.fecha) inicialIngSem[ing][sem] = { fecha: dia, val: Number(r.inv_inicial) || 0 };
    var finCalc = (Number(r.inv_inicial) || 0) + (Number(r.entrada) || 0) - (Number(r.salida) || 0);
    var curFin = finalCompIngSem[ing][sem];
    if (!curFin || dia > curFin.fecha) finalCompIngSem[ing][sem] = { fecha: dia, val: finCalc };
  });

  // 4. Semanas a mostrar = las últimas nSemanas con filas de inventario (orden ascendente).
  var semanas = Object.keys(semanasConInv).sort();
  if (semanas.length > nSemanas) semanas = semanas.slice(semanas.length - nSemanas);
  if (!semanas.length) return { ok:true, semanas:[], cortes:[], nota:'Aún no hay semanas de inventario capturadas.' };

  // 5. Compras por clave SR12 normalizada y semana (suma de cantidad de lun–dom).
  var comprasClaveSem = {}; // clave_norm -> sem -> sum cantidad
  var shCompras = getSheet('ComprasSR12');
  if (shCompras) {
    rowsToObjects(shCompras).forEach(function(r){
      if (r.empresa_id !== u.empresa_id || !r.clave_sr12) return;
      var dia = _invDiaStr(r.fecha_dia); if (!dia) return;
      var sem = _isoWeekDeStr(dia); if (!sem) return;
      var ck = sr12NormalizarClave(r.clave_sr12);
      if (!comprasClaveSem[ck]) comprasClaveSem[ck] = {};
      comprasClaveSem[ck][sem] = (comprasClaveSem[ck][sem] || 0) + (Number(r.cantidad) || 0);
    });
  }

  // 6. Comensales de RODIZIO por semana (bitácoras servicio ≠ 'Desayuno', filas no canceladas).
  var bitas = {}; // bitacora_id -> { sem }
  rowsToObjects(getSheet('Bitacoras')).forEach(function(b){
    if (b.empresa_id !== u.empresa_id) return;
    if (String(b.servicio || '') === 'Desayuno') return; // el desayuno no sirve rodizio
    var f = fechaToString(b.fecha); if (!f) return;
    bitas[b.id] = { sem: _isoWeekDeStr(f) };
  });
  var comensalesSem = {};
  var shFilas = getSheet('BitacoraFilas');
  if (shFilas) {
    rowsToObjects(shFilas).forEach(function(f){
      if (f.borrada_at) return;
      var b = bitas[f.bitacora_id]; if (!b || !b.sem) return;
      var d = {}; try { d = JSON.parse(f.payload_json || '{}'); } catch(e){ return; }
      if (String(d.estado || '') === 'Cancelada') return;
      var pax = (parseInt(d.adulto,10)||0) + (parseInt(d.nino,10)||0) + (parseInt(d['3era'],10)||0) +
                (parseInt(d.promo,10)||0) + (parseInt(d.corte,10)||0);
      comensalesSem[b.sem] = (comensalesSem[b.sem] || 0) + pax;
    });
  }

  // 7. Etiquetas de semana (lunes–domingo) + comensales por semana para el encabezado.
  var MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function etiquetaSemana(sem) {
    var lun = _lunesDeSemana(sem); if (!lun) return sem;
    var dom = new Date(lun); dom.setUTCDate(lun.getUTCDate() + 6);
    return lun.getUTCDate() + '–' + dom.getUTCDate() + ' ' + MES[dom.getUTCMonth()];
  }
  var semanasOut = semanas.map(function(sem){
    return { sem: sem, etiqueta: etiquetaSemana(sem), comensales: comensalesSem[sem] || 0 };
  });

  // 8. Armar cada corte: celda por semana + estadística + total del periodo.
  var cortes = carnes.map(function(c){
    var ing = c.ingrediente_id;
    var clave = claveDeIng[ing] || '';
    var ckNorm = clave ? sr12NormalizarClave(clave) : '';
    var iniMap = inicialIngSem[ing] || {};
    var finMap = finalCompIngSem[ing] || {};

    var celdas = semanas.map(function(sem){
      var iniObj = iniMap[sem];
      var inicial = iniObj ? iniObj.val : null;
      var compras = (ckNorm && comprasClaveSem[ckNorm] && comprasClaveSem[ckNorm][sem]) || 0;
      // Final = apertura de la semana siguiente (conteo físico). Si no existe → domingo calculado.
      var semSig = _isoWeekSiguiente(sem);
      var finFis = (semSig && iniMap[semSig]) ? iniMap[semSig].val : null;
      var final, finalFisico;
      if (finFis !== null) { final = finFis; finalFisico = true; }
      else if (finMap[sem]) { final = finMap[sem].val; finalFisico = false; }
      else { final = null; finalFisico = false; }
      var comensales = comensalesSem[sem] || 0;
      var tieneDato = (inicial !== null && final !== null);
      var consumo = tieneDato ? (inicial + compras - final) : null;
      var gComensal = (consumo !== null && comensales > 0) ? (consumo * 1000 / comensales) : null;
      return {
        sem: sem, inicial: inicial, compras: Number(compras.toFixed(3)), final: final,
        final_fisico: finalFisico, consumo: consumo === null ? null : Number(consumo.toFixed(3)),
        comensales: comensales, g_comensal: gComensal === null ? null : Number(gComensal.toFixed(1)),
        tiene_dato: tieneDato, dev_pct: null, sev: 'gris'
      };
    });

    // Estadística sobre las semanas con g/comensal válido (consumo >= 0 y comensales > 0).
    var validos = celdas.filter(function(x){ return x.g_comensal !== null && x.consumo >= 0; })
                        .map(function(x){ return x.g_comensal; });
    var mediana = _mediana(validos);
    var cv = (validos.length >= 2 && mediana > 0) ? (_sr12Stddev(validos) / (validos.reduce(function(s,v){return s+v;},0)/validos.length) * 100) : 0;
    // Semáforo por celda vs mediana del corte (solo si hay ≥3 semanas para que la mediana valga).
    if (validos.length >= 3 && mediana > 0) {
      celdas.forEach(function(x){
        if (x.g_comensal === null || x.consumo < 0) return;
        var dev = (x.g_comensal - mediana) / mediana * 100;
        x.dev_pct = Number(dev.toFixed(1));
        x.sev = dev > CUADRE_DEV_ROJO ? 'rojo' : (dev > CUADRE_DEV_AMARILLO ? 'amarillo' : 'verde');
      });
    }

    // Total del periodo (telescopa): inicial de la 1ª semana + ΣCompras − final de la última.
    var prim = celdas[0], ult = celdas[celdas.length - 1];
    var totCompras = celdas.reduce(function(s,x){ return s + (x.compras || 0); }, 0);
    var totComensales = celdas.reduce(function(s,x){ return s + (x.comensales || 0); }, 0);
    var totInicial = prim.inicial, totFinal = ult.final;
    var totConsumo = (totInicial !== null && totFinal !== null) ? (totInicial + totCompras - totFinal) : null;
    var totG = (totConsumo !== null && totComensales > 0) ? (totConsumo * 1000 / totComensales) : null;

    return {
      ingrediente_id: ing, nombre: c.nombre, unidad: c.unidad || 'kg',
      clave_sr12: clave, vinculado: !!clave,
      celdas: celdas,
      mediana_g: Number(mediana.toFixed(1)), cv_pct: Number(cv.toFixed(1)), n_validos: validos.length,
      total: {
        inicial: totInicial, compras: Number(totCompras.toFixed(3)), final: totFinal,
        final_fisico: ult.final_fisico,
        consumo: totConsumo === null ? null : Number(totConsumo.toFixed(3)),
        comensales: totComensales,
        g_comensal: totG === null ? null : Number(totG.toFixed(1))
      }
    };
  });

  // Orden: por la magnitud de consumo del periodo (los cortes que más mueven, arriba).
  cortes.sort(function(a,b){ return (b.total.consumo || 0) - (a.total.consumo || 0); });

  return {
    ok: true,
    semanas: semanasOut,
    cortes: cortes,
    umbrales: { amarillo: CUADRE_DEV_AMARILLO, rojo: CUADRE_DEV_ROJO }
  };
}
