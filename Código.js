// ════════════════════════════════════════════════════════════════════════
// TRIKLES — GOOGLE APPS SCRIPT BACKEND
// ════════════════════════════════════════════════════════════════════════
// INSTRUCCIONES:
// 1. Abre Google Sheets → Extensiones → Apps Script
// 2. Borra todo el código existente y pega este archivo completo
// 3. Guarda (Ctrl+S)
// 4. Clic en "Implementar" → "Nueva implementación"
// 5. Tipo: Aplicación web | Ejecutar como: Yo | Acceso: Cualquier persona
// 6. Copia la URL generada y pégala en login.html donde dice 'https://script.google.com/macros/s/AKfycbzPY1Wz75vD38aK6NMMDG6HdMAUWcpg9SGGUTOm2AvoA7LWZuw3iRlhnC4MmlcGRBg9Hw/exec'
// ════════════════════════════════════════════════════════════════════════

// ── ID de tu Google Spreadsheet ──────────────────────────────────────────
// Lo encuentras en la URL de tu Sheets: docs.google.com/spreadsheets/d/ESTE_ID/edit
const SPREADSHEET_ID = '1r-c6ryq4dXeFNgnP2YZAzfHYiKT2HZgM0OV59_oOe2A';

// ── Nombres de hojas ──────────────────────────────────────────────────────
const SHEETS = {
  USUARIOS:        'Usuarios',
  EMPRESAS:        'Empresas',
  CAPTURA_FIN:     'Captura_Financiera',
  CORTE_CAJA:      'Corte_Caja',
  NOMINA:          'Nomina_Captura',
  NOMINA_CONFIG:   'Config_Nomina',
  LOG_ACCESOS:     'Log_Accesos',
  COSTOS_FIJOS:    'Costos_Fijos',
  CXC:             'CxC',
  TRANSCRIPCIONES: 'Transcripciones',
  SOLICITUDES_TR:  'Solicitudes_Transcripcion',
  CASOS:           'Casos_Denuncia',
  ENTREVISTAS:     'Entrevistas_Denuncia',
};

// ── Claves de PropertiesService para API keys del transcriptor ────────────
const TR_KEYS = {
  GEMINI:   'TR_GEMINI_API_KEY',
  CLAUDE:   'TR_CLAUDE_API_KEY',
  DRIVE_ID: 'TR_DRIVE_FOLDER_ID', // Carpeta raíz donde se guardan todas las transcripciones
};

// ════════════════════════════════════════════════════════════════════════
// PUNTO DE ENTRADA — Maneja todas las peticiones GET
// ════════════════════════════════════════════════════════════════════════
function doGet(e) {
  const p        = e.parameter;
  const action   = p.action   || '';
  const empresa  = p.empresa  || '';
  const callback = p.callback || null;

  try {
    let result;

    switch(action) {
      case 'login':           result = handleLogin(p);        break;
      case 'guardar_captura': result = guardarCaptura(p);     break;
      case 'getCaptura':       result = getCaptura(p);          break;
      case 'guardar_corte':   result = guardarCorteCaja(p);   break;
      case 'guardar_nomina':  result = guardarNomina(p);      break;
      case 'get_registros':   result = getRegistros(p);       break;
      case 'get_usuarios':
      case 'getUsuarios':     result = getUsuarios(empresa);  break;
      case 'get_empresas':
      case 'getEmpresas':     result = getEmpresas();         break;
      case 'getDatos':        result = getDatos(p);           break;
      case 'getNominaTotal':        result = getNominaTotal(p);           break;
      case 'getPassword':           result = getPassword(p);               break;
      case 'getNominaTotalUltimo':  result = getNominaTotalUltimo(p);      break;
      case 'getCxC':               result = getCxC(p);                    break;
      case 'guardarCxC':           result = guardarCxC(p);                break;
      case 'getCxCClientes':       result = getCxCClientes(p);            break;
      case 'vaciarEmpresa':        result = vaciarEmpresa(p);             break;
      case 'getCorteEfectivo':   result = getCorteEfectivo(p);      break;
      case 'getCorteCompleto':   result = getCorteCompleto(p);      break;
      case 'getNominaConfig':    result = getNominaConfig(p);       break;
      case 'guardarNominaConfig':result = guardarNominaConfig(p);   break;
      case 'getSalarioMinimo':   result = getSalarioMinimo(p);      break;
      case 'guardarNominaRegistro': result = guardarNominaRegistro(p); break;
      case 'getNominaRegistros':       result = getNominaRegistros(p);        break;
      case 'getUltimoRegistroNomina': result = getUltimoRegistroNomina(p);  break;
      case 'getCostosFijos':     result = getCostosFijos(p);        break;
      case 'guardarCostoFijo':   result = guardarCostoFijo(p);      break;
      case 'getPuntoEquilibrio': result = getPuntoEquilibrio(p);    break;
      case 'setup':           result = setupSheets();         break;
      case 'resetHojas':      result = resetHojas();          break;
      // ── Panel de Control (via GET + JSONP para evitar CORS) ──
      case 'alta_empresa':    result = altaEmpresa(p);        break;
      case 'baja_empresa':      result = bajaEmpresa(p);        break;
      case 'reactivar_empresa': result = reactivarEmpresa(p);   break;
      case 'alta_usuario':    result = altaUsuario(p);        break;
      case 'baja_usuario':    result = bajaUsuario(p);        break;
      case 'editar_usuario':  result = editarUsuario(p);      break;
      // ── Transcripción de Audio ────────────────────────────────
      case 'tr_getConfig':       result = trGetConfig(p);              break;
      case 'tr_setKeys':         result = trSetKeys(p);                break;
      case 'tr_requestAccess':   result = trRequestAccess(p);          break;
      case 'tr_listSolicitudes': result = trListSolicitudes(p);        break;
      case 'tr_resolveSolicitud':result = trResolveSolicitud(p);       break;
      case 'tr_save':            result = trSave(p);                   break;
      case 'tr_list':            result = trList(p);                   break;
      case 'tr_get':             result = trGet(p);                    break;
      case 'tr_delete':          result = trDelete(p);                 break;
      // ── Denuncias (casos + entrevistas) ──────────────────────
      case 'caso_list':          result = casoList(p);                 break;
      case 'caso_create':        result = casoCreate(p);               break;
      case 'caso_get':           result = casoGet(p);                  break;
      case 'caso_update':        result = casoUpdate(p);               break;
      case 'caso_delete':        result = casoDelete(p);               break;
      case 'caso_close':         result = casoClose(p);                break;
      case 'caso_reopen':        result = casoReopen(p);               break;
      case 'entrevista_add':     result = entrevistaAdd(p);            break;
      case 'entrevista_delete':  result = entrevistaDelete(p);         break;
      case 'ping':
        result = { success: true, message: 'API TRIKLES activa v2.0' };
        break;
      default:
        result = { success: false, error: 'Acción no reconocida: ' + action };
    }

    const json = JSON.stringify(result);

    // JSONP — responde con callback(data) para llamadas desde el navegador
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // JSON normal con headers CORS
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    const errJson = JSON.stringify({ success: false, error: err.toString() });
    if (p.callback) {
      return ContentService
        .createTextOutput(p.callback + '(' + errJson + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(errJson)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ════════════════════════════════════════════════════════════════════════
// doOptions — Permite solicitudes CORS preflight desde cualquier origen
// ════════════════════════════════════════════════════════════════════════
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ── POST también soportado para datos más grandes ─────────────────────────
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action || '';
    let result;

    switch(action) {
      case 'guardar_captura': result = guardarCaptura(params); break;
      case 'guardar_corte':   result = guardarCorteCaja(params); break;
      case 'guardar_nomina':  result = guardarNomina(params); break;
      case 'alta_usuario':    result = altaUsuario(params); break;
      case 'alta_empresa':    result = altaEmpresa(params); break;
      case 'baja_usuario':    result = bajaUsuario(params); break;
      case 'baja_empresa':    result = bajaEmpresa(params); break;
      case 'editar_usuario':  result = editarUsuario(params); break;
      case 'tr_save':         result = trSave(params); break;
      case 'tr_setKeys':      result = trSetKeys(params); break;
      case 'caso_create':     result = casoCreate(params); break;
      case 'caso_update':     result = casoUpdate(params); break;
      case 'caso_close':      result = casoClose(params); break;
      case 'entrevista_add':  result = entrevistaAdd(params); break;
      default: result = { success: false, error: 'Acción no reconocida' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ════════════════════════════════════════════════════════════════════════
// 1. LOGIN
// ════════════════════════════════════════════════════════════════════════
function handleLogin(params) {
  const { usuario, pass } = params;
  // Soporte legacy: si viene empresa en params se ignora, se detecta automáticamente
  if (!usuario || !pass) {
    return { success: false, error: 'Faltan datos de acceso' };
  }

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);

  if (!sheet) {
    return { success: false, error: 'Hoja de usuarios no encontrada. Ejecuta /setup primero.' };
  }

  const data = sheet.getDataRange().getValues();
  // Columnas: [0]Empresa [1]Usuario [2]Password [3]Rol [4]Nombre [5]Email [6]Activo [7]UltimoAcceso [8]FechaAlta [9]TranscripcionAuth

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (
      String(row[1]).toLowerCase() === String(usuario).toLowerCase() &&
      String(row[2]).trim() === String(pass).trim() &&
      String(row[6]).toUpperCase() === 'SI'
    ) {
      // Actualizar último acceso
      sheet.getRange(i + 1, 8).setValue(new Date().toISOString());

      const empresa = String(row[0]);
      const rol = String(row[3]);
      // SuperAdmin siempre puede transcribir; Admin y otros requieren el flag
      const trAuth = rol === 'SUPER_ADMIN'
        ? true
        : String(row[9] || '').toUpperCase() === 'SI';

      // Registrar en log
      registrarAcceso(empresa, usuario, rol, 'LOGIN_OK');

      return {
        success: true,
        user: {
          empresa: empresa,
          usuario: row[1],
          rol:     rol,
          nombre:  row[4],
          email:   row[5],
          transcripcionAuth: trAuth,
        }
      };
    }
  }

  // Registrar intento fallido
  registrarAcceso('DESCONOCIDO', usuario, 'DESCONOCIDO', 'LOGIN_FAIL');
  return { success: false, error: 'Credenciales incorrectas' };
}

// ════════════════════════════════════════════════════════════════════════
// 2. GUARDAR CAPTURA FINANCIERA DIARIA
// ════════════════════════════════════════════════════════════════════════
// ── Obtener captura existente de un día ──
function getCaptura(params) {
  const empresa = params.empresa || '';
  const fecha   = params.fecha   || '';
  if (!empresa || !fecha) return { success: false, error: 'Empresa y fecha requeridas' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CAPTURA_FIN);
  if (!sheet) return { success: false, error: 'Hoja no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fechaRow = row[1] instanceof Date
      ? Utilities.formatDate(row[1], 'America/Mexico_City', 'yyyy-MM-dd')
      : String(row[1]).slice(0, 10);
    if (String(row[0]).toLowerCase() === empresa.toLowerCase() && fechaRow === fecha) {
      return {
        success: true,
        data: {
          ventas:      parseFloat(row[6])  || 0,
          vtaEfectivo: parseFloat(row[7])  || 0,
          vtaTarjeta:  parseFloat(row[8])  || 0,
          vtaCredito:  parseFloat(row[9])  || 0,
          producto1:   parseFloat(row[10]) || 0,
          producto2:   parseFloat(row[11]) || 0,
          producto3:   parseFloat(row[12]) || 0,
          otros:       parseFloat(row[13]) || 0,
          ganancia:    parseFloat(row[14]) || 0,
          saldoInicial:parseFloat(row[16]) || 0,
          cobros:      parseFloat(row[17]) || 0,
          anticipo:    parseFloat(row[18]) || 0,
          entregaMcia: parseFloat(row[19]) || 0,
          compras:     parseFloat(row[20]) || 0,
          comprasExt:  parseFloat(row[21]) || 0,
          gastoTienda: parseFloat(row[22]) || 0,
          gastoCasa:   parseFloat(row[23]) || 0,
          pagoCompras: parseFloat(row[24]) || 0,
          retiroUtil:  parseFloat(row[25]) || 0,
          retiroEfvo:  parseFloat(row[26]) || 0,
          efvoCaja:    parseFloat(row[27]) || 0,
          b1000: parseFloat(row[28])||0, b500: parseFloat(row[29])||0,
          b200:  parseFloat(row[30])||0, b100: parseFloat(row[31])||0,
          b50:   parseFloat(row[32])||0, b20:  parseFloat(row[33])||0,
          b10:   parseFloat(row[34])||0, b5:   parseFloat(row[35])||0,
          b2:    parseFloat(row[36])||0, b1:   parseFloat(row[37])||0,
          b050:  parseFloat(row[38])||0,
          comprasCredito: parseFloat(row[21]) || 0,
          pagoComprasForma:   String(row[50] || 'EFECTIVO'),
          reservaUso:         parseFloat(row[51]) || 0,
          reservaUsoConcepto: String(row[52] || ''),
          sueldoEfvoForma:    String(row[53] || 'EFECTIVO'),
          sueldo:     parseFloat(row[39]) || 0,
          sueldoEfvo: parseFloat(row[40]) || 0,
          reserva:    parseFloat(row[41]) || 0,
          gastosAnt:  parseFloat(row[42]) || 0,
          terminado:  String(row[45] || 'NADA'),
          faltante:   String(row[46] || 'NINGUNO'),
          notas:      String(row[47] || ''),
        }
      };
    }
  }
  return { success: false, error: 'Sin registro para esta fecha' };
}

function guardarCaptura(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CAPTURA_FIN);

  if (!sheet) return { success: false, error: 'Hoja Captura_Financiera no existe' };

  // Verificar si ya existe registro para esa fecha y empresa
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    // Normalizar fecha de Sheets: puede ser Date object o string
    const fechaSheet = data[i][1] instanceof Date
      ? Utilities.formatDate(data[i][1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(data[i][1] || '').slice(0, 10);
    if (
      String(data[i][0]).toLowerCase() === String(params.empresa).toLowerCase() &&
      fechaSheet === params.fecha
    ) {
      // Actualizar registro existente
      const row = buildCapturaRow(params);
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { success: true, action: 'actualizado', fila: i + 1 };
    }
  }

  // Insertar nuevo registro
  const row = buildCapturaRow(params);
  sheet.appendRow(row);

  return { success: true, action: 'creado', fila: sheet.getLastRow() };
}

function buildCapturaRow(p) {
  const ts = new Date().toISOString();
  const gan  = parseFloat(p.ganancia)   || 0;
  const gT   = parseFloat(p.gastoTienda)|| 0;
  const gC   = parseFloat(p.gastoCasa)  || 0;
  const sue  = parseFloat(p.sueldo)     || 0;
  const res  = parseFloat(p.reserva)    || 0;
  const gA   = parseFloat(p.gastosAnt)  || 0;
  const totalG   = gT + gC + sue + res + gA;
  const utilidad = gan - totalG;
  return [
    p.empresa           || '',          // 0
    p.fecha             || '',          // 1
    parseFloat(p.anio)  || 0,          // 2
    parseFloat(p.mes)   || 0,          // 3
    parseFloat(p.diaSemana) || 0,      // 4
    parseFloat(p.dia)   || 0,          // 5
    // Ventas
    parseFloat(p.ventas)        || 0,  // 6  ventas totales
    parseFloat(p.vtaEfectivo)   || 0,  // 7  ventas efectivo
    parseFloat(p.vtaTarjeta)    || 0,  // 8  ventas tarjeta
    parseFloat(p.vtaCredito)    || 0,  // 9  ventas crédito
    parseFloat(p.producto1)     || 0,  // 10 producto 1
    parseFloat(p.producto2)     || 0,  // 11 producto 2
    parseFloat(p.producto3)     || 0,  // 12 producto 3
    parseFloat(p.otros)         || 0,  // 13 otros
    gan,                               // 14 ganancia
    parseFloat(p.costo)         || 0,  // 15 costo
    // Flujo efectivo
    parseFloat(p.saldoInicial)  || 0,  // 16 saldo inicial
    parseFloat(p.cobros)        || 0,  // 17 cobros
    parseFloat(p.anticipo)      || 0,  // 18 anticipo
    parseFloat(p.entregaMcia)   || 0,  // 19 entrega mercancía
    parseFloat(p.compras)       || 0,  // 20 compras
    parseFloat(p.comprasCredito)|| 0,  // 21 compras a crédito
    gT,                                // 22 gastos propios
    gC,                                // 23 gastos ajenos
    parseFloat(p.pagoCompras)   || 0,  // 24 pago compras
    parseFloat(p.retiroUtil)    || 0,  // 25 retiro utilidades
    parseFloat(p.retiroEfvo)    || 0,  // 26 retiro efectivo caja
    parseFloat(p.efvoCaja)      || 0,  // 27 efectivo contado
    // Denominaciones
    parseFloat(p.b1000) || 0,          // 28
    parseFloat(p.b500)  || 0,          // 29
    parseFloat(p.b200)  || 0,          // 30
    parseFloat(p.b100)  || 0,          // 31
    parseFloat(p.b50)   || 0,          // 32
    parseFloat(p.b20)   || 0,          // 33
    parseFloat(p.b10)   || 0,          // 34
    parseFloat(p.b5)    || 0,          // 35
    parseFloat(p.b2)    || 0,          // 36
    parseFloat(p.b1)    || 0,          // 37
    parseFloat(p.b050)  || 0,          // 38
    // Cierre
    sue,                               // 39 sueldo nómina
    parseFloat(p.sueldoEfvo)    || 0,  // 40 sueldo pagado en efectivo
    res,                               // 41 reserva
    gA,                                // 42 gastos días anteriores
    totalG,                            // 43 total gastos
    utilidad,                          // 44 utilidad neta
    // Observaciones
    p.terminado  || 'NADA',            // 45
    p.faltante   || 'NINGUNO',         // 46
    p.notas      || '',                // 47
    p.usuario    || '',                // 48
    ts,                                // 49 timestamp
    // Compras a crédito y reserva
    p.pagoComprasForma    || 'EFECTIVO', // 50 forma de pago compras crédito
    parseFloat(p.reservaUso) || 0,       // 51 uso de reserva hoy (otros gastos)
    p.reservaUsoConcepto  || '',          // 52 concepto uso reserva (texto libre)
    p.sueldoEfvoForma     || 'EFECTIVO', // 53 forma de pago nómina
  ];
}

// ════════════════════════════════════════════════════════════════════════
// 3. GUARDAR CORTE DE CAJA
// ════════════════════════════════════════════════════════════════════════
function guardarCorteCaja(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CORTE_CAJA);

  if (!sheet) return { success: false, error: 'Hoja Corte_Caja no existe' };

  const row = [
    params.empresa        || '',
    params.fecha          || '',
    // Denominaciones
    parseFloat(params.b1000)  || 0,
    parseFloat(params.b500)   || 0,
    parseFloat(params.b200)   || 0,
    parseFloat(params.b100)   || 0,
    parseFloat(params.b50)    || 0,
    parseFloat(params.b20)    || 0,
    parseFloat(params.b10)    || 0,
    parseFloat(params.b5)     || 0,
    parseFloat(params.b2)     || 0,
    parseFloat(params.b1)     || 0,
    parseFloat(params.b050)   || 0,
    // Totales
    parseFloat(params.totalEfectivo)  || 0,
    parseFloat(params.totalSistema)   || 0,
    parseFloat(params.diferencia)     || 0,
    // Flujo
    parseFloat(params.ventaTotal)     || 0,
    parseFloat(params.ganancia)       || 0,
    parseFloat(params.costoVtas)      || 0,
    parseFloat(params.totalGastos)    || 0,
    parseFloat(params.utilidadNeta)   || 0,
    parseFloat(params.puntoEquilibrio)|| 0,
    // PE
    parseFloat(params.peVentasDia)    || 0,
    // Flujo efectivo
    parseFloat(params.cobranza)       || 0,
    parseFloat(params.vtaCredito)     || 0,
    parseFloat(params.vtaEfectivo)    || 0,
    parseFloat(params.compras)        || 0,
    parseFloat(params.gastoTienda)    || 0,
    parseFloat(params.gastoCasa)      || 0,
    parseFloat(params.ingresoEfvo)    || 0,
    parseFloat(params.egresos)        || 0,
    parseFloat(params.efvoSistema)    || 0,
    parseFloat(params.efvoCaja)      || 0,  // col 32 → efvoCaja (contado físico)
    // Retiros y crédito
    parseFloat(params.retiroUtil)    || 0,  // col 33 → Retiro Utilidades
    parseFloat(params.comprasCredito)|| 0,  // col 34 → Compras a Crédito
    parseFloat(params.pagoCompras)   || 0,  // col 35 → Pago de Compras
    parseFloat(params.ctasPagar)     || 0,  // col 36 → Cuentas por Pagar
    parseFloat(params.anticipo)      || 0,  // col 37 → Anticipo de Ventas
    parseFloat(params.entrega)       || 0,  // col 38 → Entrega de Mercancía
    // Observaciones
    params.productosTerminados  || 'NADA',
    params.productosPedidos     || 'NINGUNO',
    // Meta
    params.usuario              || '',
    new Date().toISOString(),
  ];

  // Verificar si ya existe ese día
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === params.empresa && data[i][1] === params.fecha) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { success: true, action: 'actualizado' };
    }
  }

  sheet.appendRow(row);
  return { success: true, action: 'creado' };
}

// ════════════════════════════════════════════════════════════════════════
// 4. GUARDAR NÓMINA
// ════════════════════════════════════════════════════════════════════════
function guardarNomina(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.NOMINA);

  if (!sheet) return { success: false, error: 'Hoja Nomina_Captura no existe' };

  const row = [
    params.empresa      || '',
    params.nombre       || '',
    params.fecha        || '',
    params.año          || '',
    params.mes          || '',
    params.semana       || '',
    params.horaIngreso  || '',
    params.horaSalida   || '',
    parseFloat(params.hrsTrabajas)  || 0,
    params.puesto       || '',
    parseFloat(params.noFunciones)  || 0,
    parseFloat(params.sueldo)       || 0,
    parseFloat(params.descuento)    || 0,
    parseFloat(params.sueldoNeto)   || 0,
    params.notas        || '',
    params.usuarioCaptura || '',
    new Date().toISOString(),
  ];

  sheet.appendRow(row);
  return { success: true, action: 'creado', fila: sheet.getLastRow() };
}

// ════════════════════════════════════════════════════════════════════════
// 5. OBTENER REGISTROS (para el Dashboard)
// ════════════════════════════════════════════════════════════════════════
function getRegistros(params) {
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const empresa = params.empresa || '';
  const tipo    = params.tipo || 'financiero'; // financiero | nomina | corte
  const desde   = params.desde || '';
  const hasta   = params.hasta || '';

  const sheetName = tipo === 'nomina' ? SHEETS.NOMINA :
                    tipo === 'corte'  ? SHEETS.CORTE_CAJA : SHEETS.CAPTURA_FIN;

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Hoja no encontrada: ' + sheetName };

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (empresa && String(row[0]) !== empresa) continue;
    if (desde && String(row[1]) < desde) continue;
    if (hasta && String(row[1]) > hasta) continue;

    const record = {};
    headers.forEach((h, j) => record[h] = row[j]);
    records.push(record);
  }

  return { success: true, total: records.length, data: records };
}

// ════════════════════════════════════════════════════════════════════════
// 6. GESTIÓN DE USUARIOS (Panel de Control)
// ════════════════════════════════════════════════════════════════════════
function getUsuarios(empresa) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return { success: false, error: 'Hoja Usuarios no existe' };

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const users   = [];

  for (let i = 1; i < data.length; i++) {
    if (empresa && String(data[i][0]) !== empresa) continue;
    const u = {};
    headers.forEach((h, j) => { if (j !== 2) u[h] = data[i][j]; }); // Omitir password
    users.push(u);
  }

  return { success: true, data: users };
}

function altaUsuario(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);

  // Verificar unicidad GLOBAL — ningún usuario puede repetirse en todo el sistema
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(params.usuario).toLowerCase()) {
      return { success: false, error: 'El usuario "' + params.usuario + '" ya existe en el sistema. Elige un nombre diferente.' };
    }
  }

  sheet.appendRow([
    params.empresa,
    params.usuario,
    params.password,
    params.rol,
    params.nombre,
    params.email || '',
    'SI',
    '',
    new Date().toISOString(),
    toSINO(params.transcripcionAuth),
  ]);

  return { success: true, message: 'Usuario creado exitosamente' };
}

function bajaUsuario(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === params.empresa && data[i][1] === params.usuario) {
      sheet.getRange(i + 1, 7).setValue('NO'); // Desactivar
      return { success: true, message: 'Usuario desactivado' };
    }
  }

  return { success: false, error: 'Usuario no encontrado' };
}

// ════════════════════════════════════════════════════════════════════════
// 7. GESTIÓN DE EMPRESAS
// ════════════════════════════════════════════════════════════════════════
function getEmpresas() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.EMPRESAS);
  if (!sheet) return { success: false, error: 'Hoja Empresas no existe' };

  const data  = sheet.getDataRange().getValues();
  const empresas = data.slice(1).filter(r => r[0]).map(r => ({
    id:       r[0],
    nombre:   r[1],
    giro:     r[2],
    mision:   r[3],
    vision:   r[4],
    logo:     r[5],
    activa:   r[6],
    color1:    r[9]  || '#F5821F',
    color2:    r[10] || '#1a1a2e',
    producto1: r[11] || 'Producto 1',
    producto2: r[12] || 'Producto 2',
    producto3: r[13] || 'Producto 3',
    producto4: r[14] || '',
  }));

  return { success: true, data: empresas };
}

function altaEmpresa(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.EMPRESAS);
  if (!sheet) return { success: false, error: 'Hoja Empresas no existe. Ejecuta setup primero.' };

  // Generar ID limpio sin acentos ni caracteres especiales
  const sinAcentos = (params.id || params.nombre)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
  const id = sinAcentos || 'EMPRESA_' + Date.now();
  const data = sheet.getDataRange().getValues();

  // Check if editing existing empresa
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      // Update existing row
      sheet.getRange(i + 1, 1, 1, 14).setValues([[
        id,
        params.nombre,
        params.giro    || data[i][2] || '',
        params.mision  || data[i][3] || '',
        params.vision  || data[i][4] || '',
        params.logo    || data[i][5] || '',
        data[i][6] || 'SI',
        data[i][7] || new Date().toISOString(),
        new Date().toISOString(),
        params.color1    || data[i][9]  || '#F5821F',
        params.color2    || data[i][10] || '#1a1a2e',
        params.producto1 || data[i][11] || '',
        params.producto2 || data[i][12] || '',
        params.producto3 || data[i][13] || '',
      ]]);
      return { success: true, message: 'Empresa actualizada exitosamente' };
    }
  }

  // New empresa
  sheet.appendRow([
    id,
    params.nombre,
    params.giro    || '',
    params.mision  || '',
    params.vision  || '',
    params.logo    || '',
    'SI',
    new Date().toISOString(),
    new Date().toISOString(),
    params.color1    || '#F5821F',
    params.color2    || '#1a1a2e',
    params.producto1 || '',
    params.producto2 || '',
    params.producto3 || '',
  ]);

  return { success: true, message: 'Empresa creada exitosamente', id };
}

// ════════════════════════════════════════════════════════════════════════
// BAJA EMPRESA
// ════════════════════════════════════════════════════════════════════════
function bajaEmpresa(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.EMPRESAS);
  if (!sheet) return { success: false, error: 'Hoja Empresas no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === params.id) {
      sheet.getRange(i + 1, 7).setValue('NO');
      return { success: true, message: 'Empresa dada de baja correctamente' };
    }
  }
  return { success: false, error: 'Empresa no encontrada' };
}

function reactivarEmpresa(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.EMPRESAS);
  if (!sheet) return { success: false, error: 'Hoja Empresas no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === params.id) {
      sheet.getRange(i + 1, 7).setValue('SI');
      return { success: true, message: 'Empresa reactivada correctamente' };
    }
  }
  return { success: false, error: 'Empresa no encontrada' };
}

// ════════════════════════════════════════════════════════════════════════
// EDITAR USUARIO
// ════════════════════════════════════════════════════════════════════════
function editarUsuario(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return { success: false, error: 'Hoja Usuarios no existe' };

  // Buscar por usuario_original si existe, sino por usuario
  const buscar = params.usuario_original || params.usuario;

  const data = sheet.getDataRange().getValues();

  // Si se está cambiando el nombre de usuario, verificar unicidad global
  if (params.usuario && params.usuario.toLowerCase() !== buscar.toLowerCase()) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).toLowerCase() === String(params.usuario).toLowerCase()) {
        return { success: false, error: 'El usuario "' + params.usuario + '" ya existe en el sistema. Elige un nombre diferente.' };
      }
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(params.empresa).toLowerCase() &&
        String(data[i][1]).toLowerCase() === String(buscar).toLowerCase()) {
      if (params.usuario)  sheet.getRange(i + 1, 2).setValue(params.usuario);
      if (params.nombre)   sheet.getRange(i + 1, 5).setValue(params.nombre);
      if (params.email)    sheet.getRange(i + 1, 6).setValue(params.email);
      if (params.rol)      sheet.getRange(i + 1, 4).setValue(params.rol);
      if (params.password) sheet.getRange(i + 1, 3).setValue(params.password);
      if (params.transcripcionAuth !== undefined && params.transcripcionAuth !== '') {
        sheet.getRange(i + 1, 10).setValue(toSINO(params.transcripcionAuth));
      }
      return { success: true, message: 'Usuario actualizado correctamente' };
    }
  }
  return { success: false, error: 'Usuario no encontrado' };
}

// ════════════════════════════════════════════════════════════════════════
// 8. LOG DE ACCESOS
// ════════════════════════════════════════════════════════════════════════
function registrarAcceso(empresa, usuario, rol, evento) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.LOG_ACCESOS);
    if (!sheet) return;

    // Convertir a hora México (UTC-6)
    const ahora = new Date();
    const mexicoOffset = -6 * 60;
    const mexicoTime = new Date(ahora.getTime() + (mexicoOffset - ahora.getTimezoneOffset()) * 60000);
    sheet.appendRow([
      mexicoTime.toISOString().replace('T',' ').slice(0,19),
      empresa, usuario, rol, evento,
      'Apps Script'
    ]);
  } catch(e) { /* No fallar si el log falla */ }
}

// ════════════════════════════════════════════════════════════════════════
// 9. SETUP INICIAL — Crea todas las hojas con sus encabezados
//    Accede a: TU_URL?action=setup  (solo la primera vez)
// ════════════════════════════════════════════════════════════════════════
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const creadas = [];

  // ── Hoja: Usuarios ────────────────────────────────────────────────────
  let sh = getOrCreateSheet(ss, SHEETS.USUARIOS);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 10).setValues([[
      'Empresa','Usuario','Password','Rol','Nombre','Email','Activo','UltimoAcceso','FechaAlta','TranscripcionAuth'
    ]]);
    // Usuario admin inicial
    sh.appendRow(['TRIKLES','admin','Admin2024!','ADMIN','Administrador','admin@trikles.com','SI','',new Date().toISOString(),'NO']);
    sh.appendRow(['TRIKLES','director','Dir2024!','DIR_GENERAL','Director General','','SI','',new Date().toISOString(),'NO']);
    sh.appendRow(['TRIKLES','finanzas','Fin2024!','DIR_FINANZAS','Dir. de Finanzas','','SI','',new Date().toISOString(),'NO']);
    sh.appendRow(['TRIKLES','analista','Ana2024!','ANALISTA_FIN','Analista','','SI','',new Date().toISOString(),'NO']);
    sh.appendRow(['TRIKLES','nomina','Nom2024!','ANALISTA_NOM','Analista Nómina','','SI','',new Date().toISOString(),'NO']);
    formatHeader(sh);
    creadas.push(SHEETS.USUARIOS);
  } else {
    // Migración: si la hoja existe pero sin la columna TranscripcionAuth, agregarla
    const lastCol = sh.getLastColumn();
    if (lastCol < 10) {
      sh.getRange(1, 10).setValue('TranscripcionAuth');
      const n = sh.getLastRow() - 1;
      if (n > 0) sh.getRange(2, 10, n, 1).setValue('NO');
      formatHeader(sh);
      creadas.push(SHEETS.USUARIOS + ' (migrada)');
    }
  }

  // ── Hoja: Empresas ────────────────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.EMPRESAS);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 8).setValues([[
      'ID','Nombre','Giro','Mision','Vision','Logo','Activa','FechaAlta'
    ]]);
    sh.appendRow(['TRIKLES','TRIKLES','Comercialización de alimentos deshidratados','','','','SI',new Date().toISOString()]);
    formatHeader(sh);
    creadas.push(SHEETS.EMPRESAS);
  }

  // ── Hoja: Captura Financiera ───────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.CAPTURA_FIN);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 50).setValues([[
      'Empresa','Fecha','Año','Mes','DiaSemana','Dia',
      'VentasTotal','VtaEfectivo','VtaTarjeta','VtaCredito',
      'Producto1','Producto2','Producto3','Otros',
      'Ganancia','Costo',
      'SaldoInicial','Cobros','Anticipo','EntregaMcia',
      'Compras','ComprasExt','GastoTienda','GastoCasa',
      'PagoCompras','RetiroUtil','RetiroEfvo','EfvoCaja',
      'B1000','B500','B200','B100','B50','B20','B10','B5','B2','B1','B050',
      'Sueldo','SueldoEfvo','Reserva','GastosAnt','TotalGastos','UtilidadNeta',
      'Terminado','Faltante','Notas','Usuario','Timestamp'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.CAPTURA_FIN);
  }

  // ── Hoja: Corte de Caja ───────────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.CORTE_CAJA);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 36).setValues([[
      'Empresa','Fecha',
      'B1000','B500','B200','B100','B50','B20','B10','B5','B2','B1','B050',
      'TotalEfectivo','TotalSistema','Diferencia',
      'VentaTotal','Ganancia','CostoVtas','TotalGastos','UtilidadNeta','PuntoEquilibrio',
      'PEVentasDia','Cobranza','VtaCredito','VtaEfectivo','Compras','GastoTienda','GastoCasa',
      'IngresoEfvo','Egresos','EfvoSistema',
      'ProductosTerminados','ProductosPedidos',
      'UsuarioCaptura','FechaCaptura'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.CORTE_CAJA);
  }

  // ── Hoja: Costos Fijos ───────────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.COSTOS_FIJOS);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 8).setValues([[
      'Empresa','Rubro','Tipo','Monto','Mes','Anio','FechaCaptura','Usuario'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.COSTOS_FIJOS);
  }

  // ── Hoja: Nómina Captura ──────────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.NOMINA);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 14).setValues([[
      'Empresa','Fecha','Empleado','Puesto','TipoPago',
      'HorasBase','HorasTrabajadas','MontoBase',
      'Ventas','PorcentajeComision','MontoComision',
      'Descuentos','PagoTotal','Notas'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.NOMINA);
  }

  // ── Hoja: Log de Accesos ──────────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.LOG_ACCESOS);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 6).setValues([[
      'Timestamp','Empresa','Usuario','Rol','Evento','Origen'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.LOG_ACCESOS);
  }

  // ── Hoja: Transcripciones ─────────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.TRANSCRIPCIONES);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 12).setValues([[
      'ID','Empresa','Fecha','Tipo','Titulo','UsuarioCaptura',
      'ArchivoAudioDriveId','DocMinutaDriveId','DuracionSeg','TamanioMB',
      'ResumenCorto','Timestamp'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.TRANSCRIPCIONES);
  }

  // ── Hoja: Solicitudes de Transcripción ───────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.SOLICITUDES_TR);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 8).setValues([[
      'Timestamp','Empresa','Usuario','Nombre','Email','Motivo','Estado','Respondido'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.SOLICITUDES_TR);
  }

  // ── Hoja: Casos de Denuncia ──────────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.CASOS);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 18).setValues([[
      'ID','Numero','Empresa','FechaApertura','Denunciante','Denunciado',
      'Descripcion','FolderDriveId','DenunciaDocId','DenunciaAudioId',
      'Estado','AbiertoPor','CerradoPor','FechaCierre','DictamenDocId',
      'DictamenVeredicto','DictamenResumen','Timestamp'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.CASOS);
  }

  // ── Hoja: Entrevistas de Denuncia ────────────────────────────────────
  sh = getOrCreateSheet(ss, SHEETS.ENTREVISTAS);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() === '') {
    sh.getRange(1, 1, 1, 13).setValues([[
      'ID','CasoID','Numero','FechaEntrevista','Entrevistado','Rol',
      'EntrevistadorUsuario','NotasPrevias','DocDriveId',
      'DuracionSeg','TamanioMB','ResumenCorto','Timestamp'
    ]]);
    formatHeader(sh);
    creadas.push(SHEETS.ENTREVISTAS);
  }

  return {
    success: true,
    message: 'Setup completado',
    hojasCreadas: creadas,
    spreadsheetId: SPREADSHEET_ID
  };
}

// ── Helpers internos ──────────────────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function formatHeader(sheet) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  range.setBackground('#F5821F');
  range.setFontColor('#FFFFFF');
  range.setFontWeight('bold');
  range.setFontSize(11);
  sheet.setFrozenRows(1);
}

// ════════════════════════════════════════════════════════════════
// GET DATOS FINANCIEROS POR EMPRESA
// ════════════════════════════════════════════════════════════════
function getDatos(params) {
  const empresa = params.empresa || '';
  const fechaIni = params.fecha_ini || '';
  const fechaFin = params.fecha_fin || '';
  
  if (!empresa) return { success: false, error: 'Empresa requerida' };
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CAPTURA_FIN);
  
  if (!sheet) return { success: true, data: [] };
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };
  
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    if (fechaIni && String(row[1]) < fechaIni) continue;
    if (fechaFin && String(row[1]) > fechaFin) continue;
    
    // Estructura real de buildCapturaRow (50 columnas):
    // 0=empresa,1=fecha,2=anio,3=mes,4=diaSemana,5=dia
    // 6=ventas,7=vtaEfectivo,8=vtaTarjeta,9=vtaCredito
    // 10=prod1,11=prod2,12=prod3,13=otros,14=ganancia,15=costo
    // 16=saldoInicial,17=cobros,18=anticipo,19=entregaMcia
    // 20=compras,21=comprasExt,22=gastoTienda,23=gastoCasa
    // 24=pagoCompras,25=retiroUtil,26=retiroEfvo,27=efvoCaja
    // 28=b1000,29=b500,30=b200,31=b100,32=b50,33=b20,34=b10,35=b5,36=b2,37=b1,38=b050
    // 39=sueldo,40=sueldoEfvo,41=reserva,42=gastosAnt,43=totalGastos,44=utilidadNeta
    // 45=terminado,46=faltante,47=notas,48=usuario,49=timestamp
    const fecha = row[1] instanceof Date
      ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(row[1] || '').slice(0,10);
    const terminado = String(row[45] || 'NADA');
    const faltante  = String(row[46] || 'NINGUNO');
    const notas     = String(row[47] || '');
    const entrega   = String(row[19] || 'NINGUNA');

    rows.push({
      f:   fecha,
      y:   parseFloat(row[2])  || 0,
      m:   parseFloat(row[3])  || 0,
      w:   0,
      iy:  parseFloat(row[2])  || 0,
      d:   parseFloat(row[5])  || 0,
      dow: parseFloat(row[4])  || 0,
      v:   parseFloat(row[6])  || 0,
      vef: parseFloat(row[7])  || 0,
      vtar:parseFloat(row[8])  || 0,
      vcr: parseFloat(row[9])  || 0,
      p1:  parseFloat(row[10]) || 0,
      p2:  parseFloat(row[11]) || 0,
      p3:  parseFloat(row[12]) || 0,
      p4:  parseFloat(row[13]) || 0,
      g:   parseFloat(row[14]) || 0,
      c:   parseFloat(row[15]) || 0,
      si:  parseFloat(row[16]) || 0,   // saldoInicial
      cob: parseFloat(row[17]) || 0,   // cobros
      ant: parseFloat(row[18]) || 0,   // anticipo
      com: parseFloat(row[20]) || 0,   // compras
      comcr:parseFloat(row[21])|| 0,   // compras a crédito
      comx:0,                          // comprasExt eliminado
      gti: parseFloat(row[22]) || 0,   // gastoTienda
      gca: parseFloat(row[23]) || 0,   // gastoCasa
      pac: parseFloat(row[24]) || 0,   // pagoCompras
      ref: parseFloat(row[26]) || 0,   // retiroEfvo
      efc: parseFloat(row[27]) || 0,   // efvoCaja
      pacF:String(row[50]||'EFECTIVO'), // forma pago compras crédito
      resUso:parseFloat(row[51])||0,    // uso reserva otros
      resConc:String(row[52]||''),      // concepto reserva otros
      sefF:String(row[53]||'EFECTIVO'),  // forma pago nómina
      su:  parseFloat(row[39]) || 0,
      sef: parseFloat(row[40]) || 0,   // sueldoEfvo — columna que faltaba
      res: parseFloat(row[41]) || 0,   // reserva (era row[40], corregido)
      gas: parseFloat(row[22]) || 0,
      gt:  parseFloat(row[43]) || 0,   // totalGastos (era row[42], corregido)
      u:   parseFloat(row[44]) || 0,   // utilidadNeta (era row[43], corregido)
      // Notas y observaciones
      terminado,
      faltante,
      notas,
      entrega,
    });
  }
  
  return { success: true, empresa, total: rows.length, data: rows };
}


// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// GET TOTAL NÓMINA DEL DÍA
// ════════════════════════════════════════════════════════════════
function getNominaTotal(params) {
  const empresa = params.empresa || '';
  const fecha   = params.fecha   || '';
  
  if (!empresa || !fecha) return { success: false, error: 'Empresa y fecha requeridas' };
  
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.NOMINA);
  
  if (!sheet) return { success: true, total: 0, registros: 0 };
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, total: 0, registros: 0 };
  
  let total = 0;
  let registros = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmpresa = String(row[0] || '').toLowerCase();
    // Normalizar fecha igual que en getNominaRegistros
    // Estructura guardarNominaRegistro: 0=Empresa,1=Fecha,2=Empleado,12=PagoTotal
    const rowFecha = row[1] instanceof Date
      ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(row[1] || '').slice(0, 10);
    
    if (rowEmpresa === empresa.toLowerCase() && rowFecha === fecha) {
      const pago = parseFloat(row[12] || 0);
      if (pago > 0) {
        total += pago;
        registros++;
      }
    }
  }
  
  return { success: true, total: Math.round(total * 100) / 100, registros, empresa, fecha };
}


// ── Obtener datos completos del Corte para pre-llenar Captura Financiera ──
function getCorteCompleto(params) {
  const empresa = params.empresa || '';
  const fecha   = params.fecha   || '';
  if (!empresa || !fecha) return { success: false, error: 'Empresa y fecha requeridas' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CORTE_CAJA);
  if (!sheet) return { success: false, error: 'Hoja Corte_Caja no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmpresa = String(row[0] || '').toLowerCase();
    const rowFecha   = row[1] instanceof Date
      ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(row[1] || '').slice(0, 10);

    if (rowEmpresa === empresa.toLowerCase() && rowFecha === fecha) {
      return {
        success: true,
        data: {
          cobranza:            parseFloat(row[23]) || 0,
          vtaCredito:          parseFloat(row[24]) || 0,
          compras:             parseFloat(row[26]) || 0,
          retiroGastos:        parseFloat(row[27]) || 0,
          retiroInv:           parseFloat(row[28]) || 0,
          retiroUtil:          parseFloat(row[33]) || 0,
          comprasCredito:      parseFloat(row[34]) || 0,
          pagoCompras:         parseFloat(row[35]) || 0,
          anticipo:            parseFloat(row[37]) || 0,
          entrega:             parseFloat(row[38]) || 0,
          productosTerminados: String(row[39] || 'NADA'),
          productosPedidos:    String(row[40] || 'NINGUNO'),
        }
      };
    }
  }
  return { success: false, error: 'No hay corte para esta fecha' };
}

// ── Obtener efectivo contado del Corte de Caja ──
function getCorteEfectivo(params) {
  const empresa = params.empresa || '';
  const fecha   = params.fecha   || '';
  if (!empresa || !fecha) return { success: false, error: 'Empresa y fecha requeridas' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Corte_Caja');
  if (!sheet) return { success: true, efvoCaja: 0 };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmpresa = String(row[0] || '').toLowerCase();
    const rowFecha   = row[1] instanceof Date
      ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(row[1] || '').slice(0, 10);
    if (rowEmpresa === empresa.toLowerCase() && rowFecha === fecha) {
      // efvoCaja is stored in the corte — find the column
      const efvoCaja = parseFloat(row[32] || 0); // col 32 = efvoCaja (contado físico)
      return { success: true, efvoCaja, fecha, empresa };
    }
  }
  return { success: true, efvoCaja: 0 };
}

// ════════════════════════════════════════════════════════════════
// MÓDULO DE NÓMINA — Configuración y Captura
// ════════════════════════════════════════════════════════════════

// ── Obtener configuración de nómina por empresa ──
function getNominaConfig(params) {
  const empresa = params.empresa || '';
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.NOMINA_CONFIG);

  // Crear hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.NOMINA_CONFIG);
    sheet.getRange(1, 1, 1, 12).setValues([[
      'Empresa', 'Puesto', 'TipoPago', 'MontoBase', 'Zona',
      'SalMinDia', 'SalMinHora', 'AnioSalMin',
      'ComisionActiva', 'TablaComisiones', 'Activo', 'FechaActualizacion'
    ]]);
  }

  const data = sheet.getDataRange().getValues();
  const configs = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    if (String(row[10]).toUpperCase() !== 'SI') continue;

    let tabla = [];
    try { tabla = JSON.parse(row[9] || '[]'); } catch(e) { tabla = []; }

    configs.push({
      empresa:          row[0],
      puesto:           row[1],
      tipoPago:         row[2], // DIA, HORA, COMISION, BASE_COMISION
      montoBase:        parseFloat(row[3]) || 0,
      zona:             row[4], // GENERAL, FRONTERA
      salMinDia:        parseFloat(row[5]) || 315.04,
      salMinHora:       parseFloat(row[6]) || 39.38,
      anioSalMin:       parseInt(row[7])   || 2026,
      comisionActiva:   String(row[8]).toUpperCase() === 'SI',
      tablaComisiones:  tabla,
    });
  }

  return { success: true, empresa, data: configs };
}

// ── Guardar configuración de nómina ──
function guardarNominaConfig(params) {
  const empresa = params.empresa || '';
  const puesto  = params.puesto  || '';
  if (!empresa || !puesto) return { success: false, error: 'Empresa y puesto requeridos' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEETS.NOMINA_CONFIG);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.NOMINA_CONFIG);
    sheet.getRange(1, 1, 1, 12).setValues([[
      'Empresa','Puesto','TipoPago','MontoBase','Zona',
      'SalMinDia','SalMinHora','AnioSalMin',
      'ComisionActiva','TablaComisiones','Activo','FechaActualizacion'
    ]]);
  }

  const data   = sheet.getDataRange().getValues();
  const tablaStr = JSON.stringify(params.tablaComisiones || []);
  const ahora  = new Date().toISOString().slice(0,10);

  // Buscar fila existente
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === empresa.toLowerCase() &&
        String(data[i][1]).toLowerCase() === puesto.toLowerCase()) {
      sheet.getRange(i + 1, 1, 1, 12).setValues([[
        empresa, puesto,
        params.tipoPago      || 'DIA',
        parseFloat(params.montoBase) || 0,
        params.zona          || 'GENERAL',
        parseFloat(params.salMinDia)  || 315.04,
        parseFloat(params.salMinHora) || 39.38,
        parseInt(params.anioSalMin)   || 2026,
        params.comisionActiva ? 'SI' : 'NO',
        tablaStr, 'SI', ahora
      ]]);
      return { success: true, accion: 'actualizado', puesto };
    }
  }

  // Nueva fila
  const lastRow = sheet.getLastRow() + 1;
  sheet.getRange(lastRow, 1, 1, 12).setValues([[
    empresa, puesto,
    params.tipoPago      || 'DIA',
    parseFloat(params.montoBase) || 0,
    params.zona          || 'GENERAL',
    parseFloat(params.salMinDia)  || 315.04,
    parseFloat(params.salMinHora) || 39.38,
    parseInt(params.anioSalMin)   || 2026,
    params.comisionActiva ? 'SI' : 'NO',
    tablaStr, 'SI', ahora
  ]]);
  return { success: true, accion: 'creado', puesto };
}

// ── Obtener salario mínimo (con actualización automática en enero) ──
function getSalarioMinimo(params) {
  const zona = params.zona || 'GENERAL';
  const anio = new Date().getFullYear();

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEETS.NOMINA_CONFIG);

  // Buscar fila de salario mínimo guardada
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === '_SAL_MIN' && parseInt(data[i][7]) === anio) {
        return {
          success: true,
          anio,
          zona,
          salMinDia:  parseFloat(zona === 'FRONTERA' ? data[i][5] : data[i][3]) || 315.04,
          salMinHora: parseFloat(zona === 'FRONTERA' ? data[i][6] : data[i][4]) || 39.38,
          fuente: 'sheets'
        };
      }
    }
  }

  // Valores por defecto 2026
  const defaults = {
    GENERAL:  { dia: 315.04, hora: 39.38 },
    FRONTERA: { dia: 440.87, hora: 55.11 }
  };
  const d = defaults[zona] || defaults.GENERAL;
  return { success: true, anio, zona, salMinDia: d.dia, salMinHora: d.hora, fuente: 'default' };
}

// ── Guardar registro de nómina diaria ──
function guardarNominaRegistro(params) {
  const empresa  = params.empresa  || '';
  const empleado = params.empleado || '';
  const fecha    = params.fecha    || '';
  if (!empresa || !empleado || !fecha) return { success: false, error: 'Datos incompletos' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEETS.NOMINA);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.NOMINA);
    sheet.getRange(1, 1, 1, 14).setValues([[
      'Empresa','Fecha','Empleado','Puesto','TipoPago',
      'HorasBase','HorasTrabajadas','MontoBase',
      'Ventas','PorcentajeComision','MontoComision',
      'Descuentos','PagoTotal','Notas'
    ]]);
  }

  // Buscar si ya existe registro del día para este empleado
  const data = sheet.getDataRange().getValues();
  const row = [
    empresa, fecha, empleado,
    params.puesto         || '',
    params.tipoPago       || 'DIA',
    parseFloat(params.horasBase)      || 8,
    parseFloat(params.horasTrabajadas)|| 0,
    parseFloat(params.montoBase)      || 0,
    parseFloat(params.ventas)         || 0,
    parseFloat(params.pctComision)    || 0,
    parseFloat(params.montoComision)  || 0,
    parseFloat(params.descuentos)     || 0,
    parseFloat(params.pagoTotal)      || 0,
    params.notas || ''
  ];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === empresa.toLowerCase() &&
        String(data[i][1]).slice(0,10) === fecha &&
        String(data[i][2]).toLowerCase() === empleado.toLowerCase()) {
      sheet.getRange(i + 1, 1, 1, 14).setValues([row]);
      return { success: true, accion: 'actualizado', empleado, pagoTotal: row[12] };
    }
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 14).setValues([row]);
  return { success: true, accion: 'guardado', empleado, pagoTotal: row[12] };
}

// ── Obtener registros de nómina por empresa y fecha ──
function getUltimoRegistroNomina(params) {
  const empresa  = params.empresa  || '';
  const empleado = params.empleado || '';
  if (!empresa || !empleado) return { success: false, error: 'Empresa y empleado requeridos' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.NOMINA);
  if (!sheet) return { success: true, data: null };

  const data = sheet.getDataRange().getValues();
  let ultimo = null;
  let ultimaFecha = '';

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    if (String(row[2]).toLowerCase() !== empleado.toLowerCase()) continue;

    const fechaNom = row[1] instanceof Date
      ? Utilities.formatDate(row[1], 'America/Mexico_City', 'yyyy-MM-dd')
      : String(row[1]).slice(0, 10);

    if (fechaNom >= ultimaFecha) {
      ultimaFecha = fechaNom;
      ultimo = {
        fecha:           fechaNom,
        puesto:          row[3],
        tipoPago:        row[4],
        horasBase:       parseFloat(row[5]) || 8,
        horasTrabajadas: parseFloat(row[6]) || 0,
        montoBase:       parseFloat(row[7]) || 0,
        descuentos:      parseFloat(row[11])|| 0,
      };
    }
  }
  return { success: true, data: ultimo };
}

function getNominaRegistros(params) {
  const empresa   = params.empresa   || '';
  const fecha     = params.fecha     || '';
  const fecha_ini = params.fecha_ini || '';
  const fecha_fin = params.fecha_fin || '';
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.NOMINA);
  if (!sheet) return { success: true, data: [], total: 0 };

  const data = sheet.getDataRange().getValues();
  const registros = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    // Formatear fecha correctamente antes de comparar
    const fechaNom = row[1] instanceof Date
      ? Utilities.formatDate(row[1], 'America/Mexico_City', 'yyyy-MM-dd')
      : String(row[1]).slice(0,10);
    if (fecha     && fechaNom !== fecha)     continue;
    if (fecha_ini && fechaNom < fecha_ini)   continue;
    if (fecha_fin && fechaNom > fecha_fin)   continue;
    registros.push({
      empresa:          row[0],
      fecha:            fechaNom,
      empleado:         row[2],
      puesto:           row[3],
      tipoPago:         row[4],
      horasBase:        parseFloat(row[5]) || 8,
      horasTrabajadas:  parseFloat(row[6]) || 0,
      montoBase:        parseFloat(row[7]) || 0,
      ventas:           parseFloat(row[8]) || 0,
      pctComision:      parseFloat(row[9]) || 0,
      montoComision:    parseFloat(row[10])|| 0,
      descuentos:       parseFloat(row[11])|| 0,
      pagoTotal:        parseFloat(row[12])|| 0,
      notas:            row[13] || '',
    });
  }

  const total = registros.reduce((s, r) => s + r.pagoTotal, 0);
  return { success: true, empresa, fecha, data: registros, total: Math.round(total*100)/100 };
}


// ════════════════════════════════════════════════════════════════════════
// MÓDULO CxC — CUENTAS POR COBRAR
// Hoja: CxC
// Columnas: Empresa | Tipo | Concepto | Monto | FormaPago | Fecha | Notas | Usuario
// Tipo: CREDITO_VENTA | OTRO_CARGO | COBRO_CLIENTE | COBRO_OTRO | SALIDA
// ════════════════════════════════════════════════════════════════════════

function getOrCreateCxC(ss) {
  let sheet = ss.getSheetByName(SHEETS.CXC);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CXC);
    sheet.appendRow(['Empresa','Tipo','Concepto','Monto','FormaPago','Fecha','Notas','Usuario']);
    formatHeader(sheet);
  }
  return sheet;
}

// ── Obtener estado de CxC ──
function getCxC(params) {
  const empresa = params.empresa || '';
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateCxC(ss);
  const data  = sheet.getDataRange().getValues();

  const movimientos = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    const fecha = row[5] instanceof Date
      ? Utilities.formatDate(row[5], 'America/Mexico_City', 'yyyy-MM-dd')
      : String(row[5]).slice(0, 10);
    movimientos.push({
      id:        i,
      tipo:      String(row[1]),
      concepto:  String(row[2]),
      monto:     parseFloat(row[3]) || 0,
      formaPago: String(row[4] || ''),
      fecha:     fecha,
      notas:     String(row[6] || ''),
      usuario:   String(row[7] || ''),
    });
  }

  return { success: true, data: movimientos };
}

// ── Obtener CxC de clientes desde Captura Financiera ──
function getCxCClientes(params) {
  const empresa = params.empresa || '';
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const captura = ss.getSheetByName(SHEETS.CAPTURA_FIN);
  if (!captura) return { success: true, ventas: 0, cobros: 0, saldo: 0, movimientos: [] };

  const data = captura.getDataRange().getValues();
  const movimientos = [];
  let totalVentas = 0;
  let totalCobros = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;

    const fecha = row[1] instanceof Date
      ? Utilities.formatDate(row[1], 'America/Mexico_City', 'yyyy-MM-dd')
      : String(row[1]).slice(0, 10);

    const vcr = parseFloat(row[9]) || 0;   // Venta a crédito
    const cob = parseFloat(row[17]) || 0;  // Cobros del día

    if (vcr > 0) {
      totalVentas += vcr;
      movimientos.push({ fecha, tipo: 'VENTA_CREDITO', monto: vcr, concepto: 'Venta a crédito' });
    }
    if (cob > 0) {
      totalCobros += cob;
      movimientos.push({ fecha, tipo: 'COBRO', monto: cob, concepto: 'Cobro del día' });
    }
  }

  movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const saldo = totalVentas - totalCobros;
  const masAntiguo = movimientos.find(m => m.tipo === 'VENTA_CREDITO');

  return {
    success: true,
    totalVentas: Math.round(totalVentas * 100) / 100,
    totalCobros: Math.round(totalCobros * 100) / 100,
    saldo:       Math.round(saldo * 100) / 100,
    fechaMasAntigua: masAntiguo ? masAntiguo.fecha : null,
    movimientos
  };
}

// ── Guardar movimiento CxC ──
function guardarCxC(params) {
  const empresa   = params.empresa   || '';
  const tipo      = params.tipo      || '';
  const concepto  = params.concepto  || '';
  const monto     = parseFloat(params.monto) || 0;
  const formaPago = params.forma_pago || '';
  const notas     = params.notas     || '';
  const usuario   = params.usuario   || '';

  if (!empresa || !tipo || !monto) {
    return { success: false, error: 'Faltan datos requeridos' };
  }

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateCxC(ss);
  const fecha = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd');

  sheet.appendRow([empresa, tipo, concepto, monto, formaPago, fecha, notas, usuario]);

  // Determinar si afecta flujo de efectivo
  // SALDO_INICIAL nunca afecta caja — es solo un punto de partida
  const afectaCaja = tipo === 'SALDO_INICIAL' ? 'NO_CAJA'
    : (tipo === 'COBRO_OTRO' || tipo === 'COBRO_CLIENTE') && formaPago === 'EFECTIVO' ? 'ENTRADA'
    : tipo === 'OTRO_CARGO' ? 'SALIDA'
    : 'NO_CAJA';

  return { success: true, accion: 'guardado', tipo, monto, afectaCaja };
}


// ════════════════════════════════════════════════════════════════════════
// VACIAR EMPRESA — Solo SUPER_ADMIN
// Elimina todos los datos operativos de una empresa
// ════════════════════════════════════════════════════════════════════════
function vaciarEmpresa(params) {
  const empresa = params.empresa || '';
  const usuario = params.usuario || '';
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  // Verificar que el usuario sea SUPER_ADMIN
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usrSheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (usrSheet) {
    const usrData = usrSheet.getDataRange().getValues();
    for (let i = 1; i < usrData.length; i++) {
      if (String(usrData[i][1]).toLowerCase() === usuario.toLowerCase()) {
        if (String(usrData[i][3]) !== 'SUPER_ADMIN') {
          return { success: false, error: 'No autorizado' };
        }
        break;
      }
    }
  }

  let captura = 0, nomina = 0, costos = 0, cxc = 0;

  // Función auxiliar para eliminar filas de una empresa
  function limpiarHoja(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return 0;
    const data = sheet.getDataRange().getValues();
    let eliminadas = 0;
    // Recorrer de abajo hacia arriba para no afectar índices
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).toLowerCase() === empresa.toLowerCase()) {
        sheet.deleteRow(i + 1);
        eliminadas++;
      }
    }
    return eliminadas;
  }

  captura = limpiarHoja(SHEETS.CAPTURA_FIN);
  nomina  = limpiarHoja(SHEETS.NOMINA);
  costos  = limpiarHoja(SHEETS.COSTOS_FIJOS);
  cxc     = limpiarHoja(SHEETS.CXC);

  return { success: true, empresa, captura, nomina, costos, cxc };
}


function getPassword(params) {
  const solicitante = params.solicitante || '';
  const empresa     = params.empresa     || '';
  const usuario     = params.usuario     || '';

  // Solo SUPER_ADMIN puede consultar contraseñas
  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet    = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return { success: false, error: 'Hoja no existe' };

  const data = sheet.getDataRange().getValues();

  // Verificar que el solicitante es SUPER_ADMIN
  let esSuperAdmin = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === solicitante.toLowerCase() && String(data[i][3]) === 'SUPER_ADMIN') {
      esSuperAdmin = true;
      break;
    }
  }
  if (!esSuperAdmin) return { success: false, error: 'No autorizado' };

  // Buscar contraseña del usuario solicitado
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === usuario.toLowerCase() &&
        String(data[i][0]).toLowerCase() === empresa.toLowerCase()) {
      return { success: true, usuario, password: String(data[i][2]) };
    }
  }
  return { success: false, error: 'Usuario no encontrado' };
}

// ── Trigger automático: actualizar salario mínimo cada 1 de enero ──
function actualizarSalarioMinimoAnual() {
  const hoy  = new Date();
  const mes  = hoy.getMonth() + 1;
  const dia  = hoy.getDate();
  const anio = hoy.getFullYear();

  if (mes !== 1 || dia !== 1) return; // Solo el 1 de enero

  // Valores conocidos — en el futuro aquí iría la consulta web
  // Por ahora usa los valores oficiales CONASAMI publicados en diciembre
  const valoresConocidos = {
    2026: { general: { dia: 315.04, hora: 39.38 }, frontera: { dia: 440.87, hora: 55.11 } }
  };

  const valores = valoresConocidos[anio];
  if (!valores) {
    // No tenemos el dato — enviar alerta a admins
    alertarAdmins(anio);
    return;
  }

  // Guardar en Sheets
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEETS.NOMINA_CONFIG);
  if (!sheet) { sheet = ss.insertSheet(SHEETS.NOMINA_CONFIG); }

  const ahora = new Date().toISOString().slice(0,10);
  sheet.appendRow([
    '_SAL_MIN', 'Salario Mínimo', 'REFERENCIA',
    valores.general.dia, valores.general.hora,
    valores.frontera.dia, valores.frontera.hora,
    anio, 'NO', '[]', 'SI', ahora
  ]);

  Logger.log('✓ Salario mínimo actualizado para ' + anio);
}

function alertarAdmins(anio) {
  // Buscar emails de admins y super admins
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rol   = String(data[i][3] || '').toUpperCase();
    const email = String(data[i][4] || '');
    if ((rol === 'SUPER_ADMIN' || rol === 'ADMIN') && email.includes('@')) {
      MailApp.sendEmail({
        to: email,
        subject: '⚠️ TRIKLES — Verificar salario mínimo ' + anio,
        body: 'El sistema no pudo actualizar automáticamente el salario mínimo para ' + anio +
              '.\n\nPor favor actualiza el valor en Panel de Control → Configuración de Nómina.\n\n' +
              'Consulta el valor oficial en: https://www.gob.mx/conasami'
      });
    }
  }
}

// Para configurar el trigger automático (ejecutar UNA SOLA VEZ desde Apps Script):
// function configurarTriggerAnual() {
//   ScriptApp.newTrigger('actualizarSalarioMinimoAnual')
//     .timeBased().onMonthDay(1).atHour(6).create();
// }


// ════════════════════════════════════════════════════════════════════════
// RESET HOJAS — Borra datos y recrea encabezados correctos
// Ejecutar UNA SOLA VEZ después de limpiar Sheets manualmente
// Accede a: TU_URL?action=resetHojas
// ════════════════════════════════════════════════════════════════════════
function resetHojas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const resultado = [];

  // ── Captura_Financiera ────────────────────────────────────────────────
  let sh = ss.getSheetByName(SHEETS.CAPTURA_FIN);
  if (sh) {
    sh.clearContents();
    sh.getRange(1, 1, 1, 50).setValues([[
      'Empresa','Fecha','Año','Mes','DiaSemana','Dia',
      'VentasTotal','VtaEfectivo','VtaTarjeta','VtaCredito',
      'Producto1','Producto2','Producto3','Otros',
      'Ganancia','Costo',
      'SaldoInicial','Cobros','Anticipo','EntregaMcia',
      'Compras','ComprasExt','GastoTienda','GastoCasa',
      'PagoCompras','RetiroUtil','RetiroEfvo','EfvoCaja',
      'B1000','B500','B200','B100','B50','B20','B10','B5','B2','B1','B050',
      'Sueldo','SueldoEfvo','Reserva','GastosAnt','TotalGastos','UtilidadNeta',
      'Terminado','Faltante','Notas','Usuario','Timestamp'
    ]]);
    formatHeader(sh);
    resultado.push('Captura_Financiera: encabezado de 50 columnas creado');
  } else {
    resultado.push('Captura_Financiera: hoja no encontrada');
  }

  // ── Corte_Caja ────────────────────────────────────────────────────────
  sh = ss.getSheetByName(SHEETS.CORTE_CAJA);
  if (sh) {
    sh.clearContents();
    sh.getRange(1, 1, 1, 36).setValues([[
      'Empresa','Fecha',
      'B1000','B500','B200','B100','B50','B20','B10','B5','B2','B1','B050',
      'TotalEfectivo','TotalSistema','Diferencia',
      'VentaTotal','Ganancia','CostoVtas','TotalGastos','UtilidadNeta','PuntoEquilibrio',
      'PEVentasDia','Cobranza','VtaCredito','VtaEfectivo','Compras','GastoTienda','GastoCasa',
      'IngresoEfvo','Egresos','EfvoSistema',
      'ProductosTerminados','ProductosPedidos',
      'Usuario','Timestamp'
    ]]);
    formatHeader(sh);
    resultado.push('Corte_Caja: encabezado de 36 columnas creado');
  } else {
    resultado.push('Corte_Caja: hoja no encontrada');
  }

  // ── Costos_Fijos ──────────────────────────────────────────────────────
  sh = getOrCreateCostosFijos(ss);
  resultado.push('Costos_Fijos: lista');

  return { success: true, resultado };
}


// ════════════════════════════════════════════════════════════════════════
// MÓDULO COSTOS FIJOS
// Hoja: Costos_Fijos
// Columnas: Empresa | Rubro | Tipo | Monto | Mes | Anio | FechaCaptura | Usuario
// ════════════════════════════════════════════════════════════════════════

function getOrCreateCostosFijos(ss) {
  let sheet = ss.getSheetByName(SHEETS.COSTOS_FIJOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.COSTOS_FIJOS);
    sheet.getRange(1, 1, 1, 8).setValues([[
      'Empresa', 'Rubro', 'Tipo', 'Monto', 'Mes', 'Anio', 'FechaCaptura', 'Usuario'
    ]]);
    formatHeader(sheet);
  }
  return sheet;
}

function getCostosFijos(params) {
  const empresa = params.empresa || '';
  const mes     = parseInt(params.mes)  || 0;
  const anio    = parseInt(params.anio) || 0;
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateCostosFijos(ss);
  const data  = sheet.getDataRange().getValues();

  const registros = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    registros.push({
      empresa:      String(row[0]),
      rubro:        String(row[1]),
      tipo:         String(row[2]),
      monto:        parseFloat(row[3]) || 0,
      mes:          parseInt(row[4])   || 0,
      anio:         parseInt(row[5])   || 0,
      fechaCaptura: (function() {
        var v = row[6];
        Logger.log('row[6] tipo: ' + typeof v + ' valor: ' + v);
        if (v instanceof Date) return Utilities.formatDate(v, 'America/Mexico_City', 'yyyy-MM-dd');
        var s = String(v || '');
        // Si viene como "2026-04-05" ya está bien
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
        // Si viene como objeto Date serializado
        try { var d = new Date(s); if (!isNaN(d)) return Utilities.formatDate(d, 'America/Mexico_City', 'yyyy-MM-dd'); } catch(e) {}
        return s;
      })(),
      usuario:      String(row[7]),
    });
  }

  if (mes && anio) {
    const delMes = registros.filter(r => r.mes === mes && r.anio === anio);
    return { success: true, empresa, mes, anio, data: delMes, historial: registros };
  }

  const vigentes = {};
  registros.sort((a, b) => a.fechaCaptura.localeCompare(b.fechaCaptura));
  registros.forEach(r => { vigentes[r.rubro] = r; });
  return { success: true, empresa, data: Object.values(vigentes), historial: registros };
}

function guardarCostoFijo(params) {
  const empresa = params.empresa || '';
  const rubro   = params.rubro   || '';
  const tipo    = params.tipo    || 'predefinido';
  const monto   = parseFloat(params.monto) || 0;
  const mes     = parseInt(params.mes)     || (new Date().getMonth() + 1);
  const anio    = parseInt(params.anio)    || new Date().getFullYear();
  const usuario = params.usuario || '';
  if (!empresa || !rubro) return { success: false, error: 'Empresa y rubro requeridos' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateCostosFijos(ss);
  const ahora = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd');
  const data  = sheet.getDataRange().getValues();

  // Buscar si ya existe el rubro para ese mes/año y empresa — si existe, actualizar
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() === empresa.toLowerCase() &&
        String(row[1]).toLowerCase() === rubro.toLowerCase() &&
        parseInt(row[4]) === mes &&
        parseInt(row[5]) === anio) {
      sheet.getRange(i + 1, 4).setValue(monto);
      sheet.getRange(i + 1, 7).setValue(ahora);
      sheet.getRange(i + 1, 8).setValue(usuario);
      return { success: true, accion: 'actualizado', rubro, monto, mes, anio };
    }
  }

  // No existe — agregar nuevo
  sheet.appendRow([empresa, rubro, tipo, monto, mes, anio, ahora, usuario]);
  return { success: true, accion: 'registrado', rubro, monto, mes, anio };
}

function getNominaTotalUltimo(params) {
  const empresa = params.empresa || '';
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.NOMINA);
  if (!sheet) return { success: true, total: 0 };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, total: 0 };

  // Agrupar por fecha y sumar pagos
  const porFecha = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    const fechaNom = row[1] instanceof Date
      ? Utilities.formatDate(row[1], 'America/Mexico_City', 'yyyy-MM-dd')
      : String(row[1]).slice(0, 10);
    const pago = parseFloat(row[12] || 0);
    if (pago > 0) {
      if (!porFecha[fechaNom]) porFecha[fechaNom] = 0;
      porFecha[fechaNom] += pago;
    }
  }

  // Tomar la fecha más reciente
  const fechas = Object.keys(porFecha).sort();
  if (!fechas.length) return { success: true, total: 0 };
  const ultimaFecha = fechas[fechas.length - 1];
  return { success: true, total: Math.round(porFecha[ultimaFecha]*100)/100, fecha: ultimaFecha };
}

function getPuntoEquilibrio(params) {
  const empresa = params.empresa || '';
  const fecha   = params.fecha   || new Date().toISOString().slice(0, 10);
  if (!empresa) return { success: false, error: 'Empresa requerida' };

  const anio = parseInt(fecha.slice(0, 4));
  const mes  = parseInt(fecha.slice(5, 7));
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Costos fijos vigentes
  const cfSheet = getOrCreateCostosFijos(ss);
  const cfData  = cfSheet.getDataRange().getValues();
  const vigentes = {};
  for (let i = 1; i < cfData.length; i++) {
    const row = cfData[i];
    if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
    const rubro    = String(row[1]);
    const fechaCap = String(row[6]).slice(0, 10);
    // No filtrar por fecha — usar siempre el más reciente capturado
    if (!vigentes[rubro] || fechaCap >= vigentes[rubro].fechaCap) {
      vigentes[rubro] = { monto: parseFloat(row[3]) || 0, fechaCap };
    }
  }
  const totalCostosFijos = Object.values(vigentes).reduce((s, r) => s + r.monto, 0);
  const costoFijoDiario  = diasDelMes > 0 ? totalCostosFijos / diasDelMes : 0;

  // 2. Nómina del día (o última registrada)
  const nomSheet = ss.getSheetByName(SHEETS.NOMINA);
  let nominaDia = 0;
  if (nomSheet) {
    const nomData = nomSheet.getDataRange().getValues();
    let ultimaNomina = 0;
    let ultimaFecha  = '';
    for (let i = 1; i < nomData.length; i++) {
      const row  = nomData[i];
      if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
      // Estructura guardarNominaRegistro: 0=Empresa,1=Fecha,2=Empleado,12=PagoTotal
      const fNom = row[1] instanceof Date
        ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(row[1] || '').slice(0, 10);
      const pago = parseFloat(row[12]) || 0;
      if (fNom === fecha) { nominaDia += pago; }
      if (fNom <= fecha && fNom >= ultimaFecha) { ultimaFecha = fNom; ultimaNomina = pago; }
    }
    if (nominaDia === 0) nominaDia = ultimaNomina;
  }

  // 3. Margen mensual
  const capSheet = ss.getSheetByName(SHEETS.CAPTURA_FIN);
  let sumaVentas = 0, sumaGanancia = 0, diasOperados = 0;
  if (capSheet) {
    const capData = capSheet.getDataRange().getValues();
    for (let i = 1; i < capData.length; i++) {
      const row  = capData[i];
      if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
      const fCap = row[1] instanceof Date
        ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(row[1] || '').slice(0, 10);
      if (parseInt(fCap.slice(0,4)) !== anio || parseInt(fCap.slice(5,7)) !== mes) continue;
      const ventas   = parseFloat(row[6])  || 0;
      const ganancia = parseFloat(row[14]) || 0;
      if (ventas > 0) { sumaVentas += ventas; sumaGanancia += ganancia; diasOperados++; }
    }
  }

  const margenMensual = sumaVentas > 0 ? sumaGanancia / sumaVentas : 0;

  // 4. Gastos tienda y casa del día desde Captura_Financiera
  // col 22 = gastoTienda, col 23 = gastoCasa
  let gastoTiendaDia = 0;
  let gastoCasaDia   = 0;
  if (capSheet) {
    const capData2 = capSheet.getDataRange().getValues();
    for (let i = 1; i < capData2.length; i++) {
      const row = capData2[i];
      if (String(row[0]).toLowerCase() !== empresa.toLowerCase()) continue;
      const fCap2 = row[1] instanceof Date
        ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(row[1] || '').slice(0, 10);
      if (fCap2 === fecha) {
        gastoTiendaDia = parseFloat(row[22]) || 0;
        gastoCasaDia   = parseFloat(row[23]) || 0;
        break;
      }
    }
  }

  const totalGastosDia = costoFijoDiario + nominaDia + gastoTiendaDia + gastoCasaDia;
  const pe = margenMensual > 0 ? totalGastosDia / margenMensual : 0;

  return {
    success: true, empresa, fecha, mes, anio,
    diasDelMes, diasOperados,
    totalCostosFijos,
    costoFijoDiario:  Math.round(costoFijoDiario * 100) / 100,
    nominaDia:        Math.round(nominaDia * 100) / 100,
    gastoTiendaDia:   Math.round(gastoTiendaDia * 100) / 100,
    gastoCasaDia:     Math.round(gastoCasaDia * 100) / 100,
    totalGastosDia:   Math.round(totalGastosDia * 100) / 100,
    margenMensual:    Math.round(margenMensual * 10000) / 10000,
    margenPct:        Math.round(margenMensual * 10000) / 100,
    puntoEquilibrio:  Math.round(pe * 100) / 100,
    sumaVentas:       Math.round(sumaVentas * 100) / 100,
    sumaGanancia:     Math.round(sumaGanancia * 100) / 100,
    rubrosVigentes:   Object.keys(vigentes),
  };
}

// ════════════════════════════════════════════════════════════════════════
// HELPERS COMPARTIDOS
// ════════════════════════════════════════════════════════════════════════
function toSINO(v) {
  if (v === true || v === 'true' || v === 'SI' || v === 'si' || v === 'Si' ||
      v === 1 || v === '1' || v === 'on' || v === 'yes') return 'SI';
  return 'NO';
}

// ════════════════════════════════════════════════════════════════════════
// TRANSCRIPCIÓN DE AUDIO
// ════════════════════════════════════════════════════════════════════════
// Verifica que el usuario exista, esté activo y tenga autorización para
// transcribir (SuperAdmin siempre; otros solo si TranscripcionAuth = SI).
// Retorna {ok, user} o {ok:false, error}
function _trCheckAuth(usuario) {
  if (!usuario) return { ok: false, error: 'Usuario requerido' };
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return { ok: false, error: 'Hoja Usuarios no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).toLowerCase() === String(usuario).toLowerCase() &&
        String(row[6]).toUpperCase() === 'SI') {
      const rol = String(row[3]);
      const trAuth = rol === 'SUPER_ADMIN'
        ? true
        : String(row[9] || '').toUpperCase() === 'SI';
      return {
        ok: trAuth,
        user: {
          empresa: String(row[0]),
          usuario: row[1],
          rol:     rol,
          nombre:  row[4],
          email:   row[5],
          transcripcionAuth: trAuth,
        }
      };
    }
  }
  return { ok: false, error: 'Usuario no encontrado o inactivo' };
}

// Obtiene (o crea) la carpeta raíz del transcriptor en Drive
function _trGetRootFolder() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty(TR_KEYS.DRIVE_ID);
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); }
    catch(e) { folderId = null; } // si fue borrada, recrearla
  }
  const folder = DriveApp.createFolder('Trikles - Transcripciones');
  props.setProperty(TR_KEYS.DRIVE_ID, folder.getId());
  return folder;
}

// Obtiene (o crea) la carpeta de una empresa dentro de la raíz
function _trGetEmpresaFolder(empresa) {
  const root = _trGetRootFolder();
  const iter = root.getFoldersByName(empresa);
  if (iter.hasNext()) return iter.next();
  return root.createFolder(empresa);
}

// ── trGetConfig: devuelve las API keys al frontend (SOLO si está autorizado)
function trGetConfig(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.user) return { success: true, authorized: false, error: auth.error };

  const props = PropertiesService.getScriptProperties();
  const geminiKey = props.getProperty(TR_KEYS.GEMINI) || '';
  const claudeKey = props.getProperty(TR_KEYS.CLAUDE) || '';

  return {
    success: true,
    authorized: auth.ok,
    user: auth.user,
    keysConfigured: !!(geminiKey && claudeKey),
    // Las keys SOLO se exponen a usuarios autorizados
    geminiKey: auth.ok ? geminiKey : '',
    claudeKey: auth.ok ? claudeKey : '',
  };
}

// ── trSetKeys: el SuperAdmin guarda las 2 API keys
function trSetKeys(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.user || auth.user.rol !== 'SUPER_ADMIN') {
    return { success: false, error: 'Solo el SuperAdmin puede configurar las keys' };
  }
  const props = PropertiesService.getScriptProperties();
  if (params.geminiKey !== undefined) props.setProperty(TR_KEYS.GEMINI, String(params.geminiKey || '').trim());
  if (params.claudeKey !== undefined) props.setProperty(TR_KEYS.CLAUDE, String(params.claudeKey || '').trim());
  return { success: true, message: 'Keys actualizadas' };
}

// ── trRequestAccess: un usuario sin permiso solicita acceso
function trRequestAccess(params) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.SOLICITUDES_TR);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 8).setValues([[
      'Timestamp','Empresa','Usuario','Nombre','Email','Motivo','Estado','Respondido'
    ]]);
    formatHeader(sheet);
  }

  // Evitar solicitudes duplicadas pendientes del mismo usuario
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === String(params.usuario || '').toLowerCase() &&
        String(data[i][6]).toUpperCase() === 'PENDIENTE') {
      return { success: true, message: 'Ya tienes una solicitud pendiente', duplicate: true };
    }
  }

  sheet.appendRow([
    new Date().toISOString(),
    params.empresa || '',
    params.usuario || '',
    params.nombre  || '',
    params.email   || '',
    params.motivo  || '',
    'PENDIENTE',
    '',
  ]);
  registrarAcceso(params.empresa || '', params.usuario || '', params.rol || '', 'SOLICITUD_TRANSCRIPCION');
  return { success: true, message: 'Solicitud registrada. El SuperAdmin la revisará.' };
}

// ── trListSolicitudes: SuperAdmin ve solicitudes pendientes
function trListSolicitudes(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.user || auth.user.rol !== 'SUPER_ADMIN') {
    return { success: false, error: 'Solo el SuperAdmin puede ver las solicitudes' };
  }
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.SOLICITUDES_TR);
  if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };

  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({
      fila:       i + 1,
      timestamp:  data[i][0],
      empresa:    data[i][1],
      usuario:    data[i][2],
      nombre:     data[i][3],
      email:      data[i][4],
      motivo:     data[i][5],
      estado:     data[i][6],
      respondido: data[i][7],
    });
  }
  // Pendientes primero
  rows.sort((a, b) => {
    const ap = String(a.estado).toUpperCase() === 'PENDIENTE' ? 0 : 1;
    const bp = String(b.estado).toUpperCase() === 'PENDIENTE' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return String(b.timestamp).localeCompare(String(a.timestamp));
  });
  return { success: true, data: rows };
}

// ── trResolveSolicitud: aprobar o rechazar (auto-otorga permiso si aprueba)
function trResolveSolicitud(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.user || auth.user.rol !== 'SUPER_ADMIN') {
    return { success: false, error: 'Solo el SuperAdmin puede resolver solicitudes' };
  }

  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shSol    = ss.getSheetByName(SHEETS.SOLICITUDES_TR);
  const fila     = parseInt(params.fila);
  const decision = String(params.decision || '').toUpperCase(); // APROBADA | RECHAZADA
  if (!fila || !shSol) return { success: false, error: 'Solicitud no encontrada' };
  if (decision !== 'APROBADA' && decision !== 'RECHAZADA') {
    return { success: false, error: 'Decisión inválida' };
  }

  const row = shSol.getRange(fila, 1, 1, 8).getValues()[0];
  const usuarioSolicitante = row[2];

  shSol.getRange(fila, 7).setValue(decision);
  shSol.getRange(fila, 8).setValue(new Date().toISOString());

  // Si aprueba, otorgar permiso directamente en la hoja Usuarios
  if (decision === 'APROBADA' && usuarioSolicitante) {
    const shUsr  = ss.getSheetByName(SHEETS.USUARIOS);
    const dataU  = shUsr.getDataRange().getValues();
    for (let i = 1; i < dataU.length; i++) {
      if (String(dataU[i][1]).toLowerCase() === String(usuarioSolicitante).toLowerCase()) {
        shUsr.getRange(i + 1, 10).setValue('SI');
        break;
      }
    }
  }
  return { success: true, message: 'Solicitud ' + decision.toLowerCase() };
}

// ── trSave: guarda una transcripción completa (crea Doc en Drive con la minuta)
function trSave(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const empresa    = String(params.empresa || auth.user.empresa || '').trim();
  const tipo       = String(params.tipo || 'JUNTA').toUpperCase(); // JUNTA | DENUNCIA
  const titulo     = String(params.titulo || '').trim() || ('Transcripción ' + new Date().toISOString().slice(0,16));
  const minuta     = String(params.minuta || '');
  const transcript = String(params.transcripcion || '');
  const resumen    = String(params.resumen || '').slice(0, 500);
  const duracion   = parseInt(params.duracionSeg) || 0;
  const tamanioMB  = parseFloat(params.tamanioMB) || 0;

  if (!empresa) return { success: false, error: 'Empresa requerida' };
  if (!minuta && !transcript) return { success: false, error: 'Sin contenido que guardar' };

  // Crear Doc en Drive con la minuta
  const folder = _trGetEmpresaFolder(empresa);
  const fecha  = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm');
  const docName = fecha + ' - ' + (tipo === 'DENUNCIA' ? '🔒 Denuncia' : 'Junta') + ' - ' + titulo;

  const doc = DocumentApp.create(docName);
  const body = doc.getBody();
  body.appendParagraph(docName).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Empresa: ' + empresa);
  body.appendParagraph('Tipo: ' + tipo);
  body.appendParagraph('Capturado por: ' + auth.user.nombre + ' (' + auth.user.usuario + ')');
  body.appendParagraph('Fecha: ' + fecha);
  body.appendHorizontalRule();
  body.appendParagraph('MINUTA').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  minuta.split('\n').forEach(ln => body.appendParagraph(ln));
  if (transcript) {
    body.appendPageBreak();
    body.appendParagraph('TRANSCRIPCIÓN COMPLETA').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    transcript.split('\n').forEach(ln => body.appendParagraph(ln));
  }
  doc.saveAndClose();

  // Mover el Doc a la carpeta de la empresa
  const file = DriveApp.getFileById(doc.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // Registrar en la hoja Transcripciones
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.TRANSCRIPCIONES);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 12).setValues([[
      'ID','Empresa','Fecha','Tipo','Titulo','UsuarioCaptura',
      'ArchivoAudioDriveId','DocMinutaDriveId','DuracionSeg','TamanioMB',
      'ResumenCorto','Timestamp'
    ]]);
    formatHeader(sheet);
  }
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, empresa, fecha, tipo, titulo, auth.user.usuario,
    '', doc.getId(), duracion, tamanioMB,
    resumen, new Date().toISOString()
  ]);

  return {
    success: true,
    id: id,
    docId: doc.getId(),
    docUrl: doc.getUrl(),
    message: 'Transcripción guardada'
  };
}

// ── trList: lista transcripciones de una empresa
function trList(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const empresaFiltro = String(params.empresa || '').trim();
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.TRANSCRIPCIONES);
  if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };

  // Reglas de visibilidad:
  // - SuperAdmin: ve todo; si filtra por empresa, solo esa.
  // - Admin y otros autorizados: SOLO su empresa (ignora el filtro).
  const esSuperAdmin = auth.user.rol === 'SUPER_ADMIN';
  const empresaUser  = String(auth.user.empresa || '');
  const empresaUsar  = esSuperAdmin ? empresaFiltro : empresaUser;

  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (empresaUsar && String(row[1]) !== empresaUsar) continue;
    rows.push({
      id:       row[0],
      empresa:  row[1],
      fecha:    row[2],
      tipo:     row[3],
      titulo:   row[4],
      usuario:  row[5],
      docId:    row[7],
      docUrl:   row[7] ? ('https://docs.google.com/document/d/' + row[7] + '/edit') : '',
      duracion: row[8],
      tamanioMB: row[9],
      resumen:  row[10],
      timestamp: row[11],
    });
  }
  rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return { success: true, data: rows };
}

// ── trGet: trae una transcripción específica (lee el contenido del Doc)
function trGet(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const id = String(params.id || '');
  if (!id) return { success: false, error: 'ID requerido' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.TRANSCRIPCIONES);
  if (!sheet) return { success: false, error: 'Hoja no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const empresa = String(data[i][1]);
      if (auth.user.rol !== 'SUPER_ADMIN' && empresa !== auth.user.empresa) {
        return { success: false, error: 'No tienes acceso a esta transcripción' };
      }
      const docId = data[i][7];
      let contenido = '';
      try {
        if (docId) contenido = DocumentApp.openById(docId).getBody().getText();
      } catch(e) { contenido = '[Documento no accesible]'; }
      return {
        success: true,
        data: {
          id:       data[i][0],
          empresa:  empresa,
          fecha:    data[i][2],
          tipo:     data[i][3],
          titulo:   data[i][4],
          usuario:  data[i][5],
          docId:    docId,
          docUrl:   docId ? ('https://docs.google.com/document/d/' + docId + '/edit') : '',
          duracion: data[i][8],
          tamanioMB: data[i][9],
          resumen:  data[i][10],
          timestamp: data[i][11],
          contenido: contenido,
        }
      };
    }
  }
  return { success: false, error: 'Transcripción no encontrada' };
}

// ── trDelete: borra una transcripción (solo SuperAdmin o quien la creó)
function trDelete(params) {
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const id = String(params.id || '');
  if (!id) return { success: false, error: 'ID requerido' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.TRANSCRIPCIONES);
  if (!sheet) return { success: false, error: 'Hoja no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const creador = String(data[i][5]);
      const empresa = String(data[i][1]);
      const esCreador    = creador.toLowerCase() === String(auth.user.usuario).toLowerCase();
      const esSuperAdmin = auth.user.rol === 'SUPER_ADMIN';
      if (!esSuperAdmin && !esCreador) {
        return { success: false, error: 'Solo el SuperAdmin o quien creó la transcripción puede borrarla' };
      }
      // Borrar el Doc de Drive (a papelera)
      const docId = data[i][7];
      if (docId) {
        try { DriveApp.getFileById(docId).setTrashed(true); } catch(e) {}
      }
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Transcripción eliminada' };
    }
  }
  return { success: false, error: 'Transcripción no encontrada' };
}

// ════════════════════════════════════════════════════════════════════════
// DENUNCIAS INTERNAS: CASOS + ENTREVISTAS + DICTAMEN
// ════════════════════════════════════════════════════════════════════════
// Helpers
function _getDenunciasFolder(empresa){
  const empFolder = _trGetEmpresaFolder(empresa);
  const iter = empFolder.getFoldersByName('Denuncias');
  if (iter.hasNext()) return iter.next();
  return empFolder.createFolder('Denuncias');
}

function _getCasoFolder(empresa, casoNumero, descBreve){
  const parent = _getDenunciasFolder(empresa);
  const folderName = casoNumero + ' - ' + String(descBreve || '').slice(0, 60).replace(/[\\\/:*?"<>|]/g,' ').trim();
  const iter = parent.getFoldersByName(folderName);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(folderName);
}

function _generarNumeroCaso(empresa){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CASOS);
  const anio = new Date().getFullYear();
  let max = 0;
  if (sheet && sheet.getLastRow() > 1){
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++){
      const n = String(data[i][1] || ''); // Numero
      const emp = String(data[i][2] || '');
      if (emp.toLowerCase() !== String(empresa).toLowerCase()) continue;
      const m = n.match(/CASO-(\d{4})-(\d+)/);
      if (m && parseInt(m[1]) === anio) max = Math.max(max, parseInt(m[2]));
    }
  }
  return 'CASO-' + anio + '-' + String(max + 1).padStart(3, '0');
}

// Verifica que el usuario pueda ACCEDER al caso (SA=todos, Admin=su empresa con auth)
function _casoCheckAccess(usuario, empresaDelCaso){
  const auth = _trCheckAuth(usuario);
  if (!auth.user) return { ok: false, error: auth.error || 'No autorizado' };
  if (!auth.ok) return { ok: false, error: 'No tienes permiso para denuncias' };
  if (auth.user.rol === 'SUPER_ADMIN') return { ok: true, user: auth.user };
  // Admin autorizado: solo su empresa
  if (empresaDelCaso && String(empresaDelCaso).toLowerCase() !== String(auth.user.empresa).toLowerCase()){
    return { ok: false, error: 'Solo puedes ver casos de tu empresa' };
  }
  return { ok: true, user: auth.user };
}

// ── casoList: lista de casos visibles para el usuario
function casoList(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const esSA = auth.user.rol === 'SUPER_ADMIN';
  const empresaFiltro = String(params.empresa || '').trim();
  const empresaUsar = esSA ? empresaFiltro : String(auth.user.empresa);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CASOS);
  if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };

  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++){
    const emp = String(data[i][2]);
    if (empresaUsar && emp !== empresaUsar) continue;

    // Contar entrevistas del caso
    const casoId = String(data[i][0]);
    const entSheet = ss.getSheetByName(SHEETS.ENTREVISTAS);
    let nEnt = 0;
    if (entSheet && entSheet.getLastRow() > 1){
      const eData = entSheet.getDataRange().getValues();
      for (let j = 1; j < eData.length; j++){
        if (String(eData[j][1]) === casoId) nEnt++;
      }
    }

    rows.push({
      id:              data[i][0],
      numero:          data[i][1],
      empresa:         data[i][2],
      fechaApertura:   data[i][3],
      denunciante:     data[i][4],
      denunciado:      data[i][5],
      descripcion:     String(data[i][6] || '').slice(0, 200),
      folderUrl:       data[i][7]  ? 'https://drive.google.com/drive/folders/' + data[i][7] : '',
      estado:          data[i][10],
      abiertoPor:      data[i][11],
      cerradoPor:      data[i][12],
      fechaCierre:     data[i][13],
      dictamenUrl:     data[i][14] ? 'https://docs.google.com/document/d/' + data[i][14] + '/edit' : '',
      dictamenVeredicto: data[i][15],
      timestamp:       data[i][17],
      nEntrevistas:    nEnt,
    });
  }
  rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return { success: true, data: rows };
}

// ── casoCreate: crea caso nuevo + carpeta + Doc de denuncia inicial
function casoCreate(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const empresa      = String(params.empresa || auth.user.empresa || '').trim();
  const denunciante  = String(params.denunciante || '').trim() || 'ANONIMA';
  const denunciado   = String(params.denunciado || '').trim();
  const descripcion  = String(params.descripcion || '').trim();
  const minutaAudio  = String(params.minutaAudio || '').trim();       // si hubo grabación al capturar
  const transcripcionAudio = String(params.transcripcionAudio || ''); // transcripción de la grabación inicial

  if (!empresa)     return { success: false, error: 'Empresa requerida' };
  if (!denunciado)  return { success: false, error: 'Denunciado requerido (persona o área)' };
  if (!descripcion) return { success: false, error: 'Descripción de la denuncia requerida' };

  // Admin solo su empresa
  if (auth.user.rol !== 'SUPER_ADMIN' &&
      empresa.toLowerCase() !== String(auth.user.empresa).toLowerCase()){
    return { success: false, error: 'Solo puedes abrir casos en tu empresa' };
  }

  const numero = _generarNumeroCaso(empresa);
  const descBreve = descripcion.split('\n')[0].slice(0, 60);
  const folder = _getCasoFolder(empresa, numero, descBreve);

  // Crear Doc de denuncia inicial
  const fecha = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm');
  const doc = DocumentApp.create(numero + ' - 00 Denuncia Inicial');
  const body = doc.getBody();
  body.appendParagraph(numero + ' — DENUNCIA INICIAL').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Empresa: ' + empresa);
  body.appendParagraph('Fecha de apertura: ' + fecha);
  body.appendParagraph('Abierto por: ' + auth.user.nombre + ' (' + auth.user.usuario + ')');
  body.appendHorizontalRule();
  body.appendParagraph('Denunciante: ' + denunciante);
  body.appendParagraph('Denunciado: ' + denunciado);
  body.appendHorizontalRule();
  body.appendParagraph('DESCRIPCIÓN DE LA DENUNCIA').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  descripcion.split('\n').forEach(ln => body.appendParagraph(ln));
  if (minutaAudio){
    body.appendPageBreak();
    body.appendParagraph('MINUTA DE LA DECLARACIÓN INICIAL DEL DENUNCIANTE').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    minutaAudio.split('\n').forEach(ln => body.appendParagraph(ln));
  }
  if (transcripcionAudio){
    body.appendPageBreak();
    body.appendParagraph('TRANSCRIPCIÓN COMPLETA DE LA DECLARACIÓN INICIAL').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    transcripcionAudio.split('\n').forEach(ln => body.appendParagraph(ln));
  }
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // Registrar caso
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CASOS);
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, numero, empresa, fecha, denunciante, denunciado,
    descripcion, folder.getId(), doc.getId(), '',
    'ABIERTO', auth.user.usuario, '', '', '',
    '', '', new Date().toISOString()
  ]);

  return {
    success: true,
    id: id,
    numero: numero,
    folderUrl: 'https://drive.google.com/drive/folders/' + folder.getId(),
    docUrl: doc.getUrl(),
    message: 'Caso ' + numero + ' abierto'
  };
}

// ── casoGet: detalle del caso + todas las entrevistas
function casoGet(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const id = String(params.id || '');
  if (!id) return { success: false, error: 'ID requerido' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shCasos = ss.getSheetByName(SHEETS.CASOS);
  if (!shCasos) return { success: false, error: 'Hoja Casos no existe' };

  const data = shCasos.getDataRange().getValues();
  let caso = null;
  let filaCaso = -1;
  for (let i = 1; i < data.length; i++){
    if (String(data[i][0]) === id){
      caso = {
        id:              data[i][0],
        numero:          data[i][1],
        empresa:         data[i][2],
        fechaApertura:   data[i][3],
        denunciante:     data[i][4],
        denunciado:      data[i][5],
        descripcion:     data[i][6],
        folderId:        data[i][7],
        denunciaDocId:   data[i][8],
        denunciaAudioId: data[i][9],
        estado:          data[i][10],
        abiertoPor:      data[i][11],
        cerradoPor:      data[i][12],
        fechaCierre:     data[i][13],
        dictamenDocId:   data[i][14],
        dictamenVeredicto: data[i][15],
        dictamenResumen: data[i][16],
        timestamp:       data[i][17],
      };
      filaCaso = i + 1;
      break;
    }
  }
  if (!caso) return { success: false, error: 'Caso no encontrado' };

  // Check acceso
  if (auth.user.rol !== 'SUPER_ADMIN' &&
      String(caso.empresa).toLowerCase() !== String(auth.user.empresa).toLowerCase()){
    return { success: false, error: 'No tienes acceso a este caso' };
  }

  caso.folderUrl      = caso.folderId      ? 'https://drive.google.com/drive/folders/' + caso.folderId : '';
  caso.denunciaDocUrl = caso.denunciaDocId ? 'https://docs.google.com/document/d/' + caso.denunciaDocId + '/edit' : '';
  caso.dictamenDocUrl = caso.dictamenDocId ? 'https://docs.google.com/document/d/' + caso.dictamenDocId + '/edit' : '';

  // Traer entrevistas del caso
  const shEnt = ss.getSheetByName(SHEETS.ENTREVISTAS);
  const entrevistas = [];
  if (shEnt && shEnt.getLastRow() > 1){
    const eData = shEnt.getDataRange().getValues();
    for (let i = 1; i < eData.length; i++){
      if (String(eData[i][1]) === id){
        const docId = eData[i][8];
        entrevistas.push({
          id:             eData[i][0],
          casoId:         eData[i][1],
          numero:         eData[i][2],
          fecha:          eData[i][3],
          entrevistado:   eData[i][4],
          rol:            eData[i][5],
          entrevistadorUsuario: eData[i][6],
          notasPrevias:   eData[i][7],
          docId:          docId,
          docUrl:         docId ? 'https://docs.google.com/document/d/' + docId + '/edit' : '',
          duracionSeg:    eData[i][9],
          tamanioMB:      eData[i][10],
          resumen:        eData[i][11],
          timestamp:      eData[i][12],
        });
      }
    }
    entrevistas.sort((a,b) => String(a.numero).localeCompare(String(b.numero)));
  }

  return { success: true, caso, entrevistas };
}

// ── casoUpdate: edita campos del caso (descripción, denunciante, denunciado)
function casoUpdate(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const id = String(params.id || '');
  if (!id) return { success: false, error: 'ID requerido' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CASOS);
  if (!sheet) return { success: false, error: 'Hoja no existe' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++){
    if (String(data[i][0]) === id){
      const empresa = String(data[i][2]);
      if (auth.user.rol !== 'SUPER_ADMIN' &&
          empresa.toLowerCase() !== String(auth.user.empresa).toLowerCase()){
        return { success: false, error: 'No tienes acceso a este caso' };
      }
      if (params.denunciante !== undefined) sheet.getRange(i+1, 5).setValue(params.denunciante);
      if (params.denunciado  !== undefined) sheet.getRange(i+1, 6).setValue(params.denunciado);
      if (params.descripcion !== undefined) sheet.getRange(i+1, 7).setValue(params.descripcion);
      return { success: true, message: 'Caso actualizado' };
    }
  }
  return { success: false, error: 'Caso no encontrado' };
}

// ── casoDelete: elimina caso y sus entrevistas (solo SuperAdmin)
function casoDelete(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok || auth.user.rol !== 'SUPER_ADMIN'){
    return { success: false, error: 'Solo el SuperAdmin puede borrar casos' };
  }
  const id = String(params.id || '');
  if (!id) return { success: false, error: 'ID requerido' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shCasos = ss.getSheetByName(SHEETS.CASOS);
  const shEnt = ss.getSheetByName(SHEETS.ENTREVISTAS);
  if (!shCasos) return { success: false, error: 'Hoja Casos no existe' };

  const data = shCasos.getDataRange().getValues();
  let folderId = '';
  for (let i = data.length - 1; i >= 1; i--){
    if (String(data[i][0]) === id){
      folderId = data[i][7];
      shCasos.deleteRow(i + 1);
      break;
    }
  }
  // Borrar entrevistas asociadas
  if (shEnt && shEnt.getLastRow() > 1){
    const eData = shEnt.getDataRange().getValues();
    for (let i = eData.length - 1; i >= 1; i--){
      if (String(eData[i][1]) === id) shEnt.deleteRow(i + 1);
    }
  }
  // Mover carpeta a papelera
  if (folderId){
    try { DriveApp.getFolderById(folderId).setTrashed(true); } catch(e) {}
  }
  return { success: true, message: 'Caso eliminado' };
}

// ── casoClose: cierra caso con dictamen (el dictamen viene procesado por Claude)
function casoClose(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const id        = String(params.id || '');
  const veredicto = String(params.veredicto || '').toUpperCase(); // PROCEDE | NO_PROCEDE | INCONCLUSO
  const dictamen  = String(params.dictamen || '');
  const resumen   = String(params.resumen || '').slice(0, 500);
  if (!id) return { success: false, error: 'ID requerido' };
  if (!['PROCEDE','NO_PROCEDE','INCONCLUSO'].includes(veredicto)){
    return { success: false, error: 'Veredicto inválido (PROCEDE/NO_PROCEDE/INCONCLUSO)' };
  }
  if (!dictamen) return { success: false, error: 'Dictamen requerido' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CASOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++){
    if (String(data[i][0]) === id){
      const empresa = String(data[i][2]);
      const numero  = String(data[i][1]);
      if (auth.user.rol !== 'SUPER_ADMIN' &&
          empresa.toLowerCase() !== String(auth.user.empresa).toLowerCase()){
        return { success: false, error: 'No tienes acceso a este caso' };
      }

      // Crear Doc del dictamen
      const fecha = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm');
      const doc = DocumentApp.create(numero + ' - 99 DICTAMEN FINAL - ' + veredicto);
      const body = doc.getBody();
      body.appendParagraph(numero + ' — DICTAMEN FINAL').setHeading(DocumentApp.ParagraphHeading.TITLE);
      const verLabel = veredicto === 'PROCEDE' ? '✅ PROCEDE' :
                       veredicto === 'NO_PROCEDE' ? '❌ NO PROCEDE' : '⚠️ INCONCLUSO';
      const p = body.appendParagraph('Veredicto: ' + verLabel);
      p.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph('Empresa: ' + empresa);
      body.appendParagraph('Fecha de cierre: ' + fecha);
      body.appendParagraph('Cerrado por: ' + auth.user.nombre + ' (' + auth.user.usuario + ')');
      body.appendHorizontalRule();
      dictamen.split('\n').forEach(ln => body.appendParagraph(ln));
      doc.saveAndClose();

      // Mover Doc a la carpeta del caso
      const folderId = data[i][7];
      if (folderId){
        try {
          const folder = DriveApp.getFolderById(folderId);
          const file = DriveApp.getFileById(doc.getId());
          folder.addFile(file);
          DriveApp.getRootFolder().removeFile(file);
        } catch(e) {}
      }

      // Actualizar la fila
      const estado = 'CERRADO_' + veredicto;
      sheet.getRange(i+1, 11).setValue(estado);            // Estado
      sheet.getRange(i+1, 13).setValue(auth.user.usuario); // CerradoPor
      sheet.getRange(i+1, 14).setValue(fecha);             // FechaCierre
      sheet.getRange(i+1, 15).setValue(doc.getId());       // DictamenDocId
      sheet.getRange(i+1, 16).setValue(veredicto);         // DictamenVeredicto
      sheet.getRange(i+1, 17).setValue(resumen);           // DictamenResumen

      return {
        success: true,
        docId: doc.getId(),
        docUrl: doc.getUrl(),
        estado: estado,
        message: 'Caso cerrado con veredicto ' + veredicto
      };
    }
  }
  return { success: false, error: 'Caso no encontrado' };
}

// ── casoReopen: reabrir un caso cerrado
function casoReopen(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const id = String(params.id || '');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CASOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++){
    if (String(data[i][0]) === id){
      const empresa = String(data[i][2]);
      if (auth.user.rol !== 'SUPER_ADMIN' &&
          empresa.toLowerCase() !== String(auth.user.empresa).toLowerCase()){
        return { success: false, error: 'No tienes acceso a este caso' };
      }
      sheet.getRange(i+1, 11).setValue('EN_INVESTIGACION');
      sheet.getRange(i+1, 13).setValue('');
      sheet.getRange(i+1, 14).setValue('');
      return { success: true, message: 'Caso reabierto' };
    }
  }
  return { success: false, error: 'Caso no encontrado' };
}

// ── entrevistaAdd: agrega entrevista al caso (minuta ya viene del cliente)
function entrevistaAdd(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const casoId       = String(params.casoId || '');
  const entrevistado = String(params.entrevistado || '').trim();
  const rol          = String(params.rol || '').toUpperCase();
  const notasPrev    = String(params.notasPrevias || '');
  const minuta       = String(params.minuta || '');
  const transcripcion= String(params.transcripcion || '');
  const duracionSeg  = parseInt(params.duracionSeg) || 0;
  const tamanioMB    = parseFloat(params.tamanioMB) || 0;
  const resumen      = String(params.resumen || '').slice(0, 500);

  if (!casoId)       return { success: false, error: 'CasoID requerido' };
  if (!entrevistado) return { success: false, error: 'Entrevistado requerido' };
  if (!['DENUNCIANTE','DENUNCIADO','TESTIGO','INVOLUCRADO'].includes(rol)){
    return { success: false, error: 'Rol inválido' };
  }
  if (!minuta && !transcripcion) return { success: false, error: 'Sin contenido que guardar' };

  // Traer caso
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shCasos = ss.getSheetByName(SHEETS.CASOS);
  const data = shCasos.getDataRange().getValues();
  let caso = null; let filaCaso = -1;
  for (let i = 1; i < data.length; i++){
    if (String(data[i][0]) === casoId){
      caso = {
        empresa: String(data[i][2]), numero: String(data[i][1]),
        folderId: data[i][7], estado: data[i][10]
      };
      filaCaso = i + 1;
      break;
    }
  }
  if (!caso) return { success: false, error: 'Caso no encontrado' };

  if (auth.user.rol !== 'SUPER_ADMIN' &&
      caso.empresa.toLowerCase() !== String(auth.user.empresa).toLowerCase()){
    return { success: false, error: 'No tienes acceso a este caso' };
  }
  if (String(caso.estado).startsWith('CERRADO_')){
    return { success: false, error: 'El caso está cerrado. Reábrelo antes de agregar entrevistas.' };
  }

  // Calcular número de entrevista
  const shEnt = ss.getSheetByName(SHEETS.ENTREVISTAS);
  let max = 0;
  if (shEnt && shEnt.getLastRow() > 1){
    const eData = shEnt.getDataRange().getValues();
    for (let j = 1; j < eData.length; j++){
      if (String(eData[j][1]) === casoId){
        const n = parseInt(String(eData[j][2]).replace(/^0+/,'')) || 0;
        max = Math.max(max, n);
      }
    }
  }
  const numero = String(max + 1).padStart(2, '0');

  // Crear Doc
  const fecha = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm');
  const docName = caso.numero + ' - ' + numero + ' Entrevista ' + rol + ' - ' + entrevistado;
  const doc = DocumentApp.create(docName);
  const body = doc.getBody();
  body.appendParagraph(caso.numero + ' — ENTREVISTA ' + numero).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Entrevistado: ' + entrevistado + ' (rol: ' + rol + ')');
  body.appendParagraph('Fecha: ' + fecha);
  body.appendParagraph('Entrevistador: ' + auth.user.nombre + ' (' + auth.user.usuario + ')');
  if (notasPrev){
    body.appendHorizontalRule();
    body.appendParagraph('NOTAS PREVIAS').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    notasPrev.split('\n').forEach(ln => body.appendParagraph(ln));
  }
  body.appendHorizontalRule();
  body.appendParagraph('MINUTA DE LA ENTREVISTA').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  minuta.split('\n').forEach(ln => body.appendParagraph(ln));
  if (transcripcion){
    body.appendPageBreak();
    body.appendParagraph('TRANSCRIPCIÓN COMPLETA').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    transcripcion.split('\n').forEach(ln => body.appendParagraph(ln));
  }
  doc.saveAndClose();

  // Mover a la carpeta del caso
  if (caso.folderId){
    try {
      const folder = DriveApp.getFolderById(caso.folderId);
      const file = DriveApp.getFileById(doc.getId());
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch(e) {}
  }

  // Registrar entrevista
  const id = Utilities.getUuid();
  shEnt.appendRow([
    id, casoId, numero, fecha, entrevistado, rol,
    auth.user.usuario, notasPrev, doc.getId(),
    duracionSeg, tamanioMB, resumen, new Date().toISOString()
  ]);

  // Actualizar estado del caso a EN_INVESTIGACION si estaba ABIERTO
  if (caso.estado === 'ABIERTO') shCasos.getRange(filaCaso, 11).setValue('EN_INVESTIGACION');

  return {
    success: true,
    id: id,
    numero: numero,
    docId: doc.getId(),
    docUrl: doc.getUrl(),
    message: 'Entrevista ' + numero + ' agregada'
  };
}

// ── entrevistaDelete: borrar una entrevista
function entrevistaDelete(params){
  const auth = _trCheckAuth(params.usuario);
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado' };

  const id = String(params.id || '');
  if (!id) return { success: false, error: 'ID requerido' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shEnt = ss.getSheetByName(SHEETS.ENTREVISTAS);
  if (!shEnt) return { success: false, error: 'Hoja Entrevistas no existe' };

  const data = shEnt.getDataRange().getValues();
  for (let i = 1; i < data.length; i++){
    if (String(data[i][0]) === id){
      const casoId = String(data[i][1]);
      const creador = String(data[i][6]);
      // Validar acceso: el caso debe ser de la empresa del admin, o ser SA
      const shCasos = ss.getSheetByName(SHEETS.CASOS);
      const cData = shCasos.getDataRange().getValues();
      let empresaCaso = '';
      for (let j = 1; j < cData.length; j++){
        if (String(cData[j][0]) === casoId){ empresaCaso = String(cData[j][2]); break; }
      }
      const esCreador = creador.toLowerCase() === String(auth.user.usuario).toLowerCase();
      const esSA = auth.user.rol === 'SUPER_ADMIN';
      const mismaEmpresa = empresaCaso.toLowerCase() === String(auth.user.empresa).toLowerCase();
      if (!esSA && !(esCreador && mismaEmpresa)){
        return { success: false, error: 'Solo el SuperAdmin o quien creó la entrevista puede borrarla' };
      }
      // Mover Doc a papelera
      const docId = data[i][8];
      if (docId){ try { DriveApp.getFileById(docId).setTrashed(true); } catch(e) {} }
      shEnt.deleteRow(i + 1);
      return { success: true, message: 'Entrevista eliminada' };
    }
  }
  return { success: false, error: 'Entrevista no encontrada' };
}
