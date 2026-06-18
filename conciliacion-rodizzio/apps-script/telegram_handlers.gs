/**
 * =====================================================================================
 * BOT DE TELEGRAM — entrega del Auditor Matutino por persona (v367)
 * =====================================================================================
 * Canal de entrega decidido 2026-06-09: Telegram (gratis, alta en minutos, UrlFetchApp).
 *
 * CÓMO FUNCIONA (3 piezas):
 *  1. REGISTRO: cada usuario abre su link personal https://t.me/<bot>?start=<codigo>
 *     (el código es un hash estable de su id). El bot recibe el /start vía webhook,
 *     encuentra al usuario por el código y guarda su telegram_chat_id en Usuarios.
 *  2. ENVÍO: telegramAuditoriaMatutinaDiaria() (trigger diario 8am) corre el motor
 *     auditoria_matutina de cada empresa con bot configurado y manda a cada persona
 *     CON pendientes su mensaje_texto; a los supervisores les manda el resumen.
 *  3. CONFIGURACIÓN: admin pega el token de BotFather en admin.html → telegram_configurar
 *     valida con getMe, guarda en ScriptProperties y registra el webhook (setWebhook).
 *
 * ENCENDIDO (lo que NO puedo hacer yo):
 *  - Germán crea el bot con @BotFather (/newbot) y pega el token en Configuración.
 *  - Germán corre instalarTriggerTelegramMatutino() desde el editor (abrir ESTE archivo;
 *    el menú de funciones muestra solo las del archivo abierto) y acepta el OAuth.
 *  - Cada responsable abre su link de registro (admin los copia de Configuración).
 *
 * Secretos en ScriptProperties (NUNCA en el Sheet ni devueltos al front):
 *  - telegram_bot_token_<empresa_id>    token del bot
 *  - telegram_bot_username_<empresa_id> @username del bot (para armar deep links)
 *  - telegram_webhook_secret            secreto del webhook (va en la URL; Apps Script
 *                                       no expone headers, por eso no usamos secret_token)
 * =====================================================================================
 */

// URL pública del deployment FIJO (misma que CLAUDE.md). ScriptApp.getService().getUrl()
// devuelve la URL /dev cuando se corre desde el editor, por eso va hardcodeada.
var TG_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwYbhG9xyML1p7Yp3Il54f9wCN6qTXFSc696IVnpQ8IIxE2YGhKpbTP5gLe-tGkyXA/exec';

// Roles que reciben el RESUMEN ejecutivo (además de que cada persona recibe lo suyo).
var TG_ROLES_RESUMEN = ['admin', 'auditoria', 'gerente_administrativo', 'gerente_restaurante', 'gerente_plaza'];

// v412 — Preguntas que la gente le escribe al bot. Claude las lee/responde en sesión y la
// respuesta sale pegada a los pendientes del día siguiente. estado: pendiente → respondida → enviada (o descartada).
var BOT_PREGUNTAS_COLS = ['id','empresa_id','usuario_email','usuario_nombre','chat_id','pregunta','creado_at','estado','respuesta','respondido_por_email','respondido_at','enviada_at'];

function _tgProps() { return PropertiesService.getScriptProperties(); }
function _tgToken(empresaId) { return String(_tgProps().getProperty('telegram_bot_token_' + empresaId) || '').trim(); }
function _tgBotUsername(empresaId) { return String(_tgProps().getProperty('telegram_bot_username_' + empresaId) || '').trim(); }
function _tgSecret() {
  var s = String(_tgProps().getProperty('telegram_webhook_secret') || '').trim();
  if (!s) { s = Utilities.getUuid().replace(/-/g, '').slice(0, 24); _tgProps().setProperty('telegram_webhook_secret', s); }
  return s;
}

// Llamada cruda a la Bot API. Devuelve el JSON parseado ({ok, result|description}).
function _tgApi(botToken, metodo, payload) {
  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/' + metodo, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  try { return JSON.parse(resp.getContentText()); }
  catch (e) { return { ok: false, description: 'Respuesta no-JSON de Telegram (HTTP ' + resp.getResponseCode() + ')' }; }
}

function _tgEnviar(botToken, chatId, texto) {
  // Telegram corta en 4096 chars; nuestros mensajes son cortos, pero por si acaso.
  return _tgApi(botToken, 'sendMessage', { chat_id: String(chatId), text: String(texto).slice(0, 4000) });
}

// Código de registro ESTABLE por usuario (no caduca por día lógico: es un identificador
// de alta, no una sesión). base64 web-safe → caracteres válidos para deep link de Telegram.
function _tgCodigoRegistro(usuario) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, usuario.id + '|telegram|' + SALT);
  return Utilities.base64EncodeWebSafe(bytes).slice(0, 12);
}

function _tgLinkRegistro(empresaId, usuario) {
  var bot = _tgBotUsername(empresaId);
  return bot ? ('https://t.me/' + bot + '?start=' + _tgCodigoRegistro(usuario)) : '';
}

// =====================================================================================
// FAQ / AYUDA — guías paso a paso por rol (curadas, NO IA). v371.
// Cada tema: id (corto, va en callback_data ≤64 bytes), titulo (texto del botón),
// roles (qué roles lo ven; 'todos' = cualquiera) y cuerpo (la guía). Se entrega con
// botones inline al escribir /ayuda. Contenido basado en los manuales y tooltips reales
// del sistema (manual_existencias/compras, tooltips de charolas, sugeridor, instructivo).
// =====================================================================================
var TG_FAQ = [
  // --- Cocina / Churrasca ---
  { id:'charola', roles:['cocina','churrasca'], titulo:'🍽️ Registrar una charola',
    cuerpo:'Entra a Charolas (tile en tu inicio). Cada vez que una charola sale de tu área al salón, tócala en la lista para registrarla. Si salieron varias iguales al mismo tiempo, pon la cantidad (ej. 3).\n\nUna charola que NO registras = un faltante sin explicación en el inventario.' },
  { id:'repomerma', roles:['cocina','churrasca'], titulo:'♻️ Reposición y merma',
    cuerpo:'• Reposición: una charola que ya estaba en el salón y la recargas y vuelve a salir. Regístrala igual (también gasta ingredientes).\n• Merma: lo que NO llegó al cliente (se cayó, se quemó, se preparó de más, salió con mala calidad). Regístrala en Charolas con el tipo Merma.\n\nLas mermas son normales; el problema es NO registrarlas. Una merma registrada te protege.' },
  { id:'sello_chef', roles:['cocina','churrasca'], titulo:'✍️ Sellar apertura/cierre',
    cuerpo:'• Apertura: certifica que empezaste desde el inicio del servicio. Séllala antes de que salga la primera charola (si dice "Esperando al host", espera a que el host abra el servicio).\n• Cierre: confirma que ya no saldrán más charolas de tu área. Séllalo al terminar.\n\nEl sello no se puede deshacer.' },
  { id:'receta_nueva', roles:['cocina','churrasca','barman','panadero'], titulo:'📝 Cargar una receta nueva',
    cuerpo:'En Recetas → "Nueva receta" (o desde Charolas). Captura:\n1. Nombre (como lo conoce el equipo)\n2. Área\n3. Rendimiento (cuántas porciones rinde)\n4. Ingredientes con su cantidad y unidad\n\nAl guardar queda como PROPUESTA y el gerente la autoriza. Necesitas al menos 1 ingrediente.' },
  { id:'receta_fix', roles:['cocina','churrasca','barman','panadero'], titulo:'🔧 Corregir receta con costo raro',
    cuerpo:'Si una receta marca cantidad o costo absurdo (ej. "500 kg de miel" o miles de pesos), casi siempre es un error de unidad: pusiste kg donde iba g, o lt donde iba ml.\n\nEntra a Recetas, abre la receta, corrige la cantidad/unidad de la línea marcada y guarda (queda como propuesta para autorizar).' },
  { id:'vinc_charola', roles:['cocina','churrasca'], titulo:'🔗 Vincular charola a su receta',
    cuerpo:'Esto crea los botones que ves al registrar charolas. En Charolas → "Vincular":\n1. Charola: escribe el platillo/espada\n2. Receta: elige la misma\n3. Porciones: pon 1 para espadas del rodizio\n4. Guardar\n\nPara que descuente inventario, la receta debe tener el peso real por porción, rendimiento = 1 y la misma unidad que el inventario (todo en kg).' },
  // --- Cajera ---
  { id:'corte_abrir', roles:['cajera'], titulo:'💵 Abrir mi corte de caja',
    cuerpo:'Entra a Conciliación / Corte de caja (tile en tu inicio). Con tu usuario, abre el corte del día. Cada turno tuyo abres TU propio corte.' },
  { id:'corte_cap', roles:['cajera'], titulo:'🧮 Capturar efectivo y tarjetas',
    cuerpo:'En el corte captura:\n• El desglose de efectivo\n• Los cobros con tarjeta (estos sí se concilian)\n• Las cortesías (las autoriza un gerente)\n• Los depósitos a tesorería\n\nRevisa que el arqueo cuadre antes de cerrar.' },
  { id:'corte_sello', roles:['cajera'], titulo:'✅ Cerrar y sellar mi corte',
    cuerpo:'IMPORTANTE: el corte NO queda válido hasta que lo SELLAS. Al terminar, en tu tarjeta de cajero toca "Sellar mi cierre" y confirma.\n\nSi vas a sellar un corte de un día anterior: primero cierra sesión y vuelve a entrar (la sesión vence cada día a las 3am), elige la FECHA de ese día, toca "🔄 Auto-llenar del día" y ahí aparece el botón de sellar.' },
  { id:'cancelacion', roles:['cajera','admin'], titulo:'🚫 Documentar una cancelación',
    cuerpo:'Cuando se cancela una venta en el POS, documéntala en la conciliación, sección 07: folio, qué se canceló, monto, a qué cambió, tipo de pago y motivo. Un gerente la autoriza.\n\nEsto evita que el tablero la marque como sospechosa.' },
  // --- Comprador ---
  { id:'sr12_exist', roles:['comprador'], titulo:'📦 Subir Existencias del SR12',
    cuerpo:'En el SR12: Reportes → Almacén → Existencias. Marca TODOS los grupos ("Incluir"). MUY IMPORTANTE: "Imprimir costos" = SÍ (si va en NO, el archivo NO sirve). Ejecuta (tarda varios minutos), exporta a Excel y guárdalo.\n\nLuego en Fogueira: Importadores → Existencias → arrastra el archivo.\n\n📷 Guía con capturas: ' + TG_WEBAPP_URL + '?p=manual-existencias' },
  { id:'sr12_comp', roles:['comprador'], titulo:'🧾 Subir Compras del SR12',
    cuerpo:'En el SR12: Reportes → Compras → "Compras, órdenes de compra y pedidos" (NO "por insumo"). Elige el rango de fechas y en "Reporte" selecciona DETALLADO (el Resumido no trae fecha y no sirve). Destino Excel → Ejecutar.\n\nLuego en Fogueira: Importadores → Compras → sube el archivo.\n\n📷 Guía con capturas: ' + TG_WEBAPP_URL + '?p=manual-compras' },
  { id:'vinc_insumo', roles:['comprador'], titulo:'🪄 Vincular insumos (huérfanos)',
    cuerpo:'En Recetas → Ingredientes → botón 🪄 (sugeridor). El sistema te propone, para cada insumo sin vincular, el producto más parecido del SR12. Confirma "Es este" o marca "No está en SR12" si es sub-receta/decoración.\n\nPara bajar muchos de un jalón: "Vincular todas las de alta confianza".' },
  { id:'precio_ins', roles:['comprador'], titulo:'💲 Corregir precio/unidad de insumo',
    cuerpo:'En Recetas → Ingredientes, da CLIC DIRECTO sobre el número del costo (o sobre la unidad) y escribe el valor correcto.\n\nEl "precio real" se calcula solo, no lo edites. El lápiz ✏️ es para vincular con SR12, no para el precio.' },
  { id:'precio_carne', roles:['admin','churrasca','comprador'], titulo:'🥩 De dónde sale el precio de una carne',
    cuerpo:'El precio real de cada insumo lo MANDA el SR12 (se actualiza con las compras reales). NO se captura a mano ni se rearma en Excel.\n\n• Para ACTUALIZAR precios: el comprador re-sube el reporte de Existencias del SR12 con "Imprimir costos = SÍ" (Importadores → Existencias). Eso recorre los costos solo.\n• En Recetas → Ingredientes puedes VER el "Último costo" de cada carne. Las entradas tipo "NOMBRE X KG" vienen del SR12 y son las buenas.\n• Editar el precio a mano (clic en el número) es SOLO para arreglar un dato roto puntual que el SR12 no resuelve — no es el camino normal.\n• ¿Ves una carne duplicada (dos veces con precios distintos)? No la edites: avisa a Germán/Luis para fusionarlas (el sistema re-apunta las recetas a la del SR12 y retira la duplicada).' },
  { id:'diag', roles:['comprador'], titulo:'🩺 Diagnóstico de datos',
    cuerpo:'En Recetas → Ingredientes → botón 🩺 Diagnóstico de datos. Te lista los insumos con problemas: sin unidad, sin precio, etc. Corrige cada uno con clic directo en su celda.' },
  // --- Host ---
  { id:'host_serv', roles:['host'], titulo:'📋 Registrar un servicio',
    cuerpo:'Entra a Bitácora del día. Registra cada servicio: comensales por tarifa (adulto/niño/3a edad), grupos y walk-ins.\n\nEn fin de semana abres DOS bitácoras (Desayuno y Comida): a las 12:30 cierras Desayuno y abres Comida.' },
  { id:'host_resv', roles:['host'], titulo:'🪑 Llegadas y reservas',
    cuerpo:'En Reservaciones marca las llegadas conforme entran los clientes, confirma por WhatsApp los grupos grandes, y si alguien no llega en la tolerancia (10 min) márcalo.\n\nLos grupos de más de 10 quedan pendientes de confirmar (no se cancelan solos).' },
  { id:'host_cierre', roles:['host'], titulo:'🔒 Cerrar un servicio',
    cuerpo:'Al terminar el servicio, cierra la bitácora del día. La apertura de la conciliación se llena al cerrar el primer servicio.\n\nNo dejes servicios de días pasados abiertos (el sistema te avisa si hay).' },
  // --- Admin ---
  { id:'adm_user', roles:['admin'], titulo:'👤 Crear un usuario',
    cuerpo:'En Configuración → Usuarios → Nuevo usuario. Pon nombre, correo, rol y contraseña. El rol define qué ve y qué puede hacer. Guarda y pásale sus datos.' },
  { id:'adm_cancel', roles:['admin'], titulo:'🚫 Subir cancelaciones SR12',
    cuerpo:'Baja del SR12 el reporte de Cancelaciones y súbelo en Importadores → Cancelaciones. Es la prueba independiente del POS; se cruza con lo que documentas en la conciliación por el número de cheque (folio).' },
  // --- Todos ---
  { id:'sesion', roles:['todos'], titulo:'🔑 Mi sesión se cerró sola',
    cuerpo:'Es normal: por seguridad la sesión vence cada día a las 3am. Solo vuelve a abrir el link de Fogueira e inicia sesión otra vez.\n\nSi una pantalla se queda en "Cargando…", casi siempre es esto: vuelve a entrar.' },
  { id:'password', roles:['todos'], titulo:'🔐 Cambiar mi contraseña',
    cuerpo:'Entra a tu pantalla de inicio → tu cuenta → "Cambiar contraseña". Pon la actual y la nueva.' },
  { id:'pantalla', roles:['todos'], titulo:'📱 Pantalla rara / no carga',
    cuerpo:'Cierra por completo la pestaña/app y vuelve a abrir el link (no basta con refrescar). En iPhone, ábrela en Safari.\n\nSi sigue igual, avísale a Luis o a Germán.' }
];

function _tgFaqParaRol(rol) {
  var jefe = ['admin','auditoria','gerente_administrativo','gerente_restaurante','gerente_plaza'].indexOf(rol) !== -1;
  return TG_FAQ.filter(function(t){
    if (t.roles.indexOf('todos') !== -1) return true;
    if (jefe) return true; // los jefes ven todas las guías (referencia)
    return t.roles.indexOf(rol) !== -1;
  });
}
function _tgFaqPorId(id){ for (var i=0;i<TG_FAQ.length;i++){ if (TG_FAQ[i].id === id) return TG_FAQ[i]; } return null; }
function _tgUsuarioPorChat(empresaId, chatId) {
  return rowsToObjects(getSheet('Usuarios')).find(function(x){
    return x.empresa_id === empresaId && esActivo(x.activo) && String(x.telegram_chat_id||'') === String(chatId);
  });
}
function _tgMandarMenuAyuda(botToken, empresaId, chatId) {
  var u = _tgUsuarioPorChat(empresaId, chatId);
  var rol = u ? String(u.rol||'').toLowerCase() : '';
  var temas = _tgFaqParaRol(rol);
  if (!temas.length) { _tgEnviar(botToken, chatId, 'Aún no tengo guías para tu perfil. Pregúntale a Luis.'); return { ok:true }; }
  var teclado = temas.map(function(t){ return [{ text: t.titulo, callback_data: 'faq:' + t.id }]; });
  _tgApi(botToken, 'sendMessage', {
    chat_id: String(chatId),
    text: '📖 ¿Con qué te ayudo? Toca un tema:',
    reply_markup: { inline_keyboard: teclado }
  });
  return { ok:true };
}

// =====================================================================================
// CONFIGURAR (admin pega el token de BotFather) — valida getMe + registra webhook
// =====================================================================================
function handleTelegramConfigurar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, ['admin', 'auditoria'])) return { ok: false, error: 'Sin permisos' };
  var botToken = String(p.bot_token || '').trim();
  if (!botToken) return { ok: false, error: 'Falta el token del bot (te lo da @BotFather)' };

  var me = _tgApi(botToken, 'getMe', {});
  if (!me.ok) return { ok: false, error: 'Telegram rechazó el token: ' + (me.description || 'token inválido') };

  // El webhook lleva el secreto + la empresa en la URL (Apps Script no expone headers).
  var hookUrl = TG_WEBAPP_URL + '?action=telegram_webhook&tgsecret=' + _tgSecret() + '&e=' + encodeURIComponent(u.empresa_id);
  // max_connections=1: Telegram entrega los updates UNO a la vez y en orden — requisito
  // del candado por último update_id del webhook (y suficiente para un equipo chico).
  var hook = _tgApi(botToken, 'setWebhook', { url: hookUrl, allowed_updates: ['message','callback_query'], drop_pending_updates: true, max_connections: 1 });
  if (!hook.ok) return { ok: false, error: 'No se pudo registrar el webhook: ' + (hook.description || '') };

  _tgProps().setProperty('telegram_bot_token_' + u.empresa_id, botToken);
  _tgProps().setProperty('telegram_bot_username_' + u.empresa_id, String(me.result.username || ''));
  return { ok: true, bot_username: String(me.result.username || '') };
}

// Re-registra el webhook con el token YA guardado (sin volver a pegarlo) y PURGA los
// reintentos pendientes de Telegram (drop_pending_updates). Útil al cambiar parámetros
// del webhook o para cortar un bucle de mensajes repetidos. Admin/auditoría. v374.
function handleTelegramRepararWebhook(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, ['admin', 'auditoria'])) return { ok: false, error: 'Sin permisos' };
  var botToken = _tgToken(u.empresa_id);
  if (!botToken) return { ok: false, error: 'Bot de Telegram no configurado' };
  var hookUrl = TG_WEBAPP_URL + '?action=telegram_webhook&tgsecret=' + _tgSecret() + '&e=' + encodeURIComponent(u.empresa_id);
  var hook = _tgApi(botToken, 'setWebhook', { url: hookUrl, allowed_updates: ['message','callback_query'], drop_pending_updates: true, max_connections: 1 });
  if (!hook.ok) return { ok: false, error: 'setWebhook: ' + (hook.description || '') };
  return { ok: true };
}

// =====================================================================================
// ESTADO — para la sección de Configuración: bot, registrados, links por usuario
// =====================================================================================
function handleTelegramEstado(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, AUDIT_MATUTINA_ROLES)) return { ok: false, error: 'Sin permisos' };
  var configurado = !!_tgToken(u.empresa_id);
  var bot = _tgBotUsername(u.empresa_id);
  var usuarios = rowsToObjects(getSheet('Usuarios'))
    .filter(function(x) { return x.empresa_id === u.empresa_id && esActivo(x.activo); })
    .map(function(x) {
      return {
        nombre: String(x.nombre || x.email),
        email: String(x.email || '').toLowerCase(),
        rol: String(x.rol || ''),
        registrado: !!String(x.telegram_chat_id || '').trim(),
        link_registro: configurado ? _tgLinkRegistro(u.empresa_id, x) : ''
      };
    });
  return {
    ok: true,
    configurado: configurado,
    bot_username: bot,
    registrados: usuarios.filter(function(x) { return x.registrado; }).length,
    usuarios: usuarios
  };
}

// =====================================================================================
// PREGUNTAS AL BOT (v412) — la gente le escribe; Claude lee, responde y la respuesta
// sale pegada a los pendientes del día siguiente. No hay IA en vivo: el "cerebro" es
// Claude en sesión con dirección.
// =====================================================================================
function _botGuardarPregunta(empresaId, usuario, chatId, texto) {
  try {
    var sh = asegurarHoja('BotPreguntas', BOT_PREGUNTAS_COLS);
    var obj = {
      id: 'BP-' + Utilities.getUuid().slice(0, 8),
      empresa_id: empresaId,
      usuario_email: String(usuario.email || '').toLowerCase(),
      usuario_nombre: String(usuario.nombre || usuario.email || ''),
      chat_id: String(chatId),
      pregunta: String(texto || '').slice(0, 2000),
      creado_at: new Date(),
      estado: 'pendiente',
      respuesta: '', respondido_por_email: '', respondido_at: '', enviada_at: ''
    };
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    sh.appendRow(headers.map(function(h) { return obj[h] === undefined ? '' : obj[h]; }));
  } catch (e) { /* nunca tirar el webhook por esto */ }
}

// Lista para que Claude (dirección) lea las preguntas. Sin filtro = cola viva (pendientes + respondidas sin enviar).
function handleBotPreguntasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, PENDIENTE_MANUAL_ROLES)) return { ok: false, error: 'Sin permiso' };
  var sh = SpreadsheetApp.getActive().getSheetByName('BotPreguntas');
  if (!sh) return { ok: true, preguntas: [] };
  var filtro = String(p.estado || '').trim().toLowerCase();
  var lista = rowsToObjects(sh)
    .filter(function(m) {
      if (m.empresa_id !== u.empresa_id) return false;
      var est = String(m.estado || '').toLowerCase();
      if (filtro) return est === filtro;
      return est === 'pendiente' || est === 'respondida';
    })
    .map(function(m) {
      return { id: m.id, usuario_email: m.usuario_email, usuario_nombre: m.usuario_nombre,
        pregunta: m.pregunta, creado_at: fechaToString(m.creado_at), estado: String(m.estado || '').toLowerCase(),
        respuesta: m.respuesta, respondido_por_email: m.respondido_por_email,
        respondido_at: m.respondido_at ? fechaToString(m.respondido_at) : '' };
    });
  return { ok: true, preguntas: lista };
}

// Claude deja su respuesta en cola (estado → respondida). El envío matutino la entrega y la marca enviada.
function handleBotPreguntaResponder(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, PENDIENTE_MANUAL_ROLES)) return { ok: false, error: 'Sin permiso' };
  var id = String(p.id || '').trim();
  var resp = String(p.respuesta || '').trim();
  if (!id) return { ok: false, error: 'id requerido' };
  if (resp.length < 2) return { ok: false, error: 'La respuesta es muy corta' };
  var sh = SpreadsheetApp.getActive().getSheetByName('BotPreguntas');
  if (!sh) return { ok: false, error: 'No hay preguntas' };
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var fila = rowsToObjects(sh).find(function(m) { return m.id === id && m.empresa_id === u.empresa_id; });
  if (!fila) return { ok: false, error: 'Pregunta no encontrada' };
  function set(col, val) { var c = headers.indexOf(col) + 1; if (c > 0) sh.getRange(fila._row, c).setValue(val); }
  set('respuesta', resp.slice(0, 3500));
  set('respondido_por_email', u.email);
  set('respondido_at', new Date());
  set('estado', 'respondida');
  set('enviada_at', '');
  return { ok: true, id: id };
}

// Descartar una pregunta (spam / no aplica) sin responderla.
function handleBotPreguntaDescartar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, PENDIENTE_MANUAL_ROLES)) return { ok: false, error: 'Sin permiso' };
  var id = String(p.id || '').trim();
  if (!id) return { ok: false, error: 'id requerido' };
  var sh = SpreadsheetApp.getActive().getSheetByName('BotPreguntas');
  if (!sh) return { ok: false, error: 'No hay preguntas' };
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var fila = rowsToObjects(sh).find(function(m) { return m.id === id && m.empresa_id === u.empresa_id; });
  if (!fila) return { ok: false, error: 'Pregunta no encontrada' };
  var c = headers.indexOf('estado') + 1; if (c > 0) sh.getRange(fila._row, c).setValue('descartada');
  return { ok: true, id: id };
}

// =====================================================================================
// WEBHOOK — Telegram nos manda cada mensaje que recibe el bot. SIN token de sesión:
// se valida con el secreto de la URL. Siempre responde {ok:true} (Telegram reintenta
// los no-2xx y no queremos loops).
// =====================================================================================
function handleTelegramWebhook(params, e) {
  if (String(params.tgsecret || '') !== _tgSecret()) return { ok: true };
  var empresaId = String(params.e || '').trim();
  var botToken = _tgToken(empresaId);
  if (!botToken) return { ok: true };

  var update = {};
  try { update = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}

  // ⚠️ Apps Script SIEMPRE responde 302 (redirect a googleusercontent), y Telegram NO sigue
  // redirects en webhooks → lo toma como fallo y REINTENTA el mismo update durante HORAS.
  // El caché solo (v368, 10 min) no bastaba: al expirar, el reintento re-ejecutaba el
  // /ayuda y el menú reaparecía "cada determinado tiempo". Doble candado (v374):
  //  1) caché 6h (máximo de CacheService) — atrapa duplicados cercanos;
  //  2) último update_id procesado en ScriptProperties (persistente) — los update_id son
  //     crecientes y con max_connections=1 llegan EN ORDEN, así que todo id ≤ al último
  //     procesado es un reintento y se ignora PARA SIEMPRE.
  var uid = update.update_id;
  if (uid != null) {
    var uidN = parseInt(uid, 10) || 0;
    var cache = CacheService.getScriptCache();
    var ckey = 'tg_upd_' + empresaId + '_' + uid;
    if (cache.get(ckey)) return { ok: true };
    cache.put(ckey, '1', 21600);
    if (uidN) {
      var pkeyU = 'telegram_last_update_' + empresaId;
      var lastU = parseInt(_tgProps().getProperty(pkeyU) || '0', 10);
      if (lastU && uidN <= lastU) return { ok: true };
      _tgProps().setProperty(pkeyU, String(uidN));
    }
  }

  // Botones del FAQ → llegan como callback_query (no como message).
  if (update.callback_query) {
    var cq = update.callback_query;
    var cqChat = cq.message && cq.message.chat && cq.message.chat.id;
    var data = String(cq.data || '');
    _tgApi(botToken, 'answerCallbackQuery', { callback_query_id: cq.id }); // quita el "reloj" del botón
    if (cqChat && data.indexOf('faq:') === 0) {
      var tema = _tgFaqPorId(data.slice(4));
      if (tema) _tgEnviar(botToken, cqChat, tema.titulo + '\n\n' + tema.cuerpo + '\n\n— Escribe /ayuda para ver más temas.');
    }
    return { ok: true };
  }

  var msg = update.message;
  if (!msg || !msg.chat || !msg.chat.id) return { ok: true };
  var chatId = String(msg.chat.id);
  var texto = String(msg.text || '').trim();

  if (/^\/ayuda|^\/help/i.test(texto)) {
    return _tgMandarMenuAyuda(botToken, empresaId, chatId);
  }

  if (/^\/start/i.test(texto)) {
    var codigo = texto.split(/\s+/)[1] || '';
    if (codigo) {
      var sh = getSheet('Usuarios');
      var fila = rowsToObjects(sh).find(function(x) {
        return x.empresa_id === empresaId && esActivo(x.activo) && _tgCodigoRegistro(x) === codigo;
      });
      if (fila) {
        var col = _getOrCreateCol(sh, 'telegram_chat_id');
        sh.getRange(fila._row, col).setValue(chatId);
        var nom = String(fila.nombre || fila.email).trim().split(' ')[0];
        _tgEnviar(botToken, chatId, '✅ Listo, ' + nom + '. Quedaste registrado.\n\nCada mañana te llegarán por aquí tus pendientes del día anterior (si los hay).\n\n• /pendientes — ver tus pendientes cuando quieras\n• /ayuda — guías de cómo usar tus pantallas');
        return { ok: true };
      }
    }
    _tgEnviar(botToken, chatId, '👋 Hola. Para registrarte necesito tu link personal.\n\nPídele a tu administrador tu "link de registro de Telegram" (está en Configuración) y ábrelo de nuevo.');
    return { ok: true };
  }

  if (/^\/pendientes/i.test(texto)) {
    var shU = getSheet('Usuarios');
    var usr = rowsToObjects(shU).find(function(x) {
      return x.empresa_id === empresaId && esActivo(x.activo) && String(x.telegram_chat_id || '') === chatId;
    });
    if (!usr) { _tgEnviar(botToken, chatId, 'No te encuentro registrado. Pide tu link de registro a tu administrador.'); return { ok: true }; }
    var fecha = _agendaSumaDias(diaLogicoRestaurante(), -1);
    var aud = _auditoriaMatutinaCore(empresaId, fecha, '');
    var email = String(usr.email || '').toLowerCase();
    var pe = (aud.personas || []).find(function(x) { return x.usuario_email === email; });
    _tgEnviar(botToken, chatId, pe ? pe.mensaje_texto : ('✅ ' + String(usr.nombre || '').split(' ')[0] + ' — ' + fecha + ': sin pendientes registrados. 💪'));
    return { ok: true };
  }

  // Texto libre (no es comando): si la persona está REGISTRADA, GUARDAMOS su mensaje como
  // "pregunta" (v412). Claude la lee en sesión, la responde, y la respuesta le llega pegada a
  // sus pendientes del día siguiente. (No guardamos comandos sueltos "/algo" ni mensajes sin texto.)
  var usrLibre = (texto && texto.charAt(0) !== '/')
    ? rowsToObjects(getSheet('Usuarios')).find(function(x) {
        return x.empresa_id === empresaId && esActivo(x.activo) && String(x.telegram_chat_id || '') === chatId;
      })
    : null;
  if (usrLibre) {
    _botGuardarPregunta(empresaId, usrLibre, chatId, texto);
    var nomL = String(usrLibre.nombre || usrLibre.email).trim().split(' ')[0];
    _tgEnviar(botToken, chatId, '📩 Recibí tu mensaje, ' + nomL + '. Lo paso al sistema y te respondo junto con tus pendientes (normalmente al día siguiente). Si es algo urgente, coméntalo también con tu encargado.\n\nMientras, puedes usar:\n• /ayuda — guías de cómo usar tus pantallas\n• /pendientes — tus pendientes del día anterior');
    return { ok: true };
  }
  _tgEnviar(botToken, chatId, 'Soy el bot del sistema Fogueira. Te puedo ayudar con:\n\n• /ayuda — guías de cómo usar tus pantallas (cargar receta, subir SR12, vincular insumos…)\n• /pendientes — tus pendientes del día anterior');
  return { ok: true };
}

// =====================================================================================
// ENVÍO de la auditoría matutina por Telegram
// =====================================================================================
// Manda a cada persona CON pendientes su mensaje, y el resumen a los supervisores
// registrados. Devuelve el detalle de qué se mandó y a quién no se pudo.
function _tgEnviarAuditoriaEmpresa(empresaId, fecha) {
  var botToken = _tgToken(empresaId);
  if (!botToken) return { ok: false, error: 'Bot de Telegram no configurado' };
  fecha = String(fecha || '').trim() || _agendaSumaDias(diaLogicoRestaurante(), -1);

  // doWrite=true: el envío oficial AVANZA el registro de días de atraso (SeguimientoPendientes).
  var aud = _auditoriaMatutinaCore(empresaId, fecha, '', true);
  var usuarios = rowsToObjects(getSheet('Usuarios')).filter(function(x) {
    return x.empresa_id === empresaId && esActivo(x.activo);
  });
  var chatPorEmail = {};
  usuarios.forEach(function(x) {
    var cid = String(x.telegram_chat_id || '').trim();
    if (cid) chatPorEmail[String(x.email || '').toLowerCase()] = cid;
  });

  // El PRIMER mensaje del día de cada persona arranca recordando qué hace el bot
  // (pedido de Germán 2026-06-10); después vienen sus pendientes. Una sola vez por
  // persona por envío (si también recibe el resumen, el intro no se repite).
  var TG_INTRO_DIA = '🤖 ¡Buen día! Soy el bot del sistema Fogueira. Por aquí te puedo ayudar con:\n• /pendientes — ver tus pendientes cuando quieras\n• /ayuda — guías de cómo usar tus pantallas (recetas, charolas, corte, SR12…)\n\n';
  var introYa = {};
  function _conIntro(cid, texto) {
    if (introYa[cid]) return texto;
    introYa[cid] = true;
    return TG_INTRO_DIA + texto;
  }

  // v412 — Respuestas que Claude dejó en cola (estado='respondida') → se entregan pegadas
  // al mensaje de pendientes (o solas si la persona no tiene pendientes hoy). Tras enviarlas,
  // se marcan 'enviada' para no repetirlas.
  var shPreg = SpreadsheetApp.getActive().getSheetByName('BotPreguntas');
  var respPorEmail = {}, headPreg = null;
  if (shPreg) {
    headPreg = shPreg.getRange(1, 1, 1, shPreg.getLastColumn()).getValues()[0];
    rowsToObjects(shPreg).forEach(function(m) {
      if (m.empresa_id !== empresaId) return;
      if (String(m.estado || '').toLowerCase() !== 'respondida') return;
      var em = String(m.usuario_email || '').toLowerCase();
      (respPorEmail[em] = respPorEmail[em] || []).push(m);
    });
  }
  function _bloqueRespuestas(email) {
    var arr = respPorEmail[email];
    if (!arr || !arr.length) return '';
    var l = ['\n\n— — — — —\n💬 Respuestas a lo que preguntaste:'];
    arr.forEach(function(m) { l.push('\n❓ ' + m.pregunta + '\n💡 ' + m.respuesta); });
    return l.join('');
  }
  var respEnviadas = [];
  function _marcarRespEnviadas(email) {
    if (!shPreg || !headPreg) return;
    var arr = respPorEmail[email]; if (!arr) return;
    var cEst = headPreg.indexOf('estado') + 1, cEnv = headPreg.indexOf('enviada_at') + 1;
    arr.forEach(function(m) {
      if (cEst > 0) shPreg.getRange(m._row, cEst).setValue('enviada');
      if (cEnv > 0) shPreg.getRange(m._row, cEnv).setValue(new Date());
      respEnviadas.push(m.id);
    });
  }

  var enviados = [], sinChat = [], errores = [], emailsConPend = {};
  (aud.personas || []).forEach(function(pe) {
    if (pe.ok) return; // solo se molesta a quien tiene pendientes
    emailsConPend[pe.usuario_email] = true;
    var cid = chatPorEmail[pe.usuario_email];
    if (!cid) { sinChat.push(pe.usuario_nombre); return; }
    var r = _tgEnviar(botToken, cid, _conIntro(cid, pe.mensaje_texto + _bloqueRespuestas(pe.usuario_email)));
    if (r.ok) { enviados.push(pe.usuario_nombre); _marcarRespEnviadas(pe.usuario_email); }
    else errores.push(pe.usuario_nombre + ': ' + (r.description || 'error'));
  });

  // Personas SIN pendientes hoy pero CON respuesta en cola → igual reciben su respuesta.
  Object.keys(respPorEmail).forEach(function(email) {
    if (emailsConPend[email]) return; // ya se le mandó junto con sus pendientes
    var cid = chatPorEmail[email];
    if (!cid) return;
    var nombre = (respPorEmail[email][0] && respPorEmail[email][0].usuario_nombre) || email;
    var saludo = '👋 ' + String(nombre).split(' ')[0] + ' — no tienes pendientes registrados hoy. 💪';
    var r = _tgEnviar(botToken, cid, _conIntro(cid, saludo + _bloqueRespuestas(email)));
    if (r.ok) { enviados.push(nombre + ' (respuesta)'); _marcarRespEnviadas(email); }
    else errores.push(nombre + ' (respuesta): ' + (r.description || 'error'));
  });

  // Resumen ejecutivo a supervisores registrados
  var conPend = (aud.personas || []).filter(function(x) { return !x.ok; });
  var lineas = ['🌅 Auditoría matutina — ' + fecha];
  if (!conPend.length) lineas.push('✅ Sin pendientes: todos al corriente.');
  else conPend.forEach(function(pe) {
    lineas.push('• ' + pe.usuario_nombre + ' (' + pe.area + '): ' + pe.pendientes.map(function(x) { return x.titulo; }).join(' · '));
  });
  if (sinChat.length) lineas.push('\n⚠️ Sin Telegram registrado (avisar a mano): ' + sinChat.join(', '));
  var sinAgenda = (aud.resumen && aud.resumen.sin_agenda_areas) || [];
  if (sinAgenda.length) lineas.push('⚠️ Áreas sin agenda (no se puede atribuir por persona): ' + sinAgenda.join(', '));
  var resumenTxt = lineas.join('\n');

  var resumenA = [];
  usuarios.forEach(function(x) {
    if (TG_ROLES_RESUMEN.indexOf(String(x.rol || '').toLowerCase()) === -1) return;
    var cid = String(x.telegram_chat_id || '').trim();
    if (!cid) return;
    var r = _tgEnviar(botToken, cid, _conIntro(cid, resumenTxt));
    if (r.ok) resumenA.push(String(x.nombre || x.email));
  });

  return { ok: true, fecha: fecha, enviados: enviados, sin_chat: sinChat, errores: errores, resumen_a: resumenA, respuestas_enviadas: respEnviadas };
}

// Endpoint manual (botón "Enviar ahora" / pruebas). MUTATING (manda mensajes).
function handleTelegramEnviarAuditoria(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, AUDIT_MATUTINA_ROLES)) return { ok: false, error: 'Sin permisos' };
  return _tgEnviarAuditoriaEmpresa(u.empresa_id, p.fecha);
}

// Mensaje de prueba al propio usuario (para verificar registro/bot sin esperar a la mañana).
function handleTelegramPrueba(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, AUDIT_MATUTINA_ROLES)) return { ok: false, error: 'Sin permisos' };
  var botToken = _tgToken(u.empresa_id);
  if (!botToken) return { ok: false, error: 'Bot de Telegram no configurado' };
  var cid = String(u.telegram_chat_id || '').trim();
  if (!cid) return { ok: false, error: 'Tu usuario no tiene Telegram registrado: abre tu link de registro primero' };
  var r = _tgEnviar(botToken, cid, '🔔 Prueba del bot Fogueira: si lees esto, el canal funciona. ✅');
  return r.ok ? { ok: true } : { ok: false, error: 'Telegram: ' + (r.description || 'error al enviar') };
}

// Desvincular el Telegram de un usuario (cambió de teléfono / se registró otro). Admin.
function handleTelegramDesvincular(p) {
  var u = validarToken(p.token);
  if (!u) return { ok: false, error: 'Sesión inválida' };
  if (!rolEs(u, ['admin', 'auditoria'])) return { ok: false, error: 'Sin permisos' };
  var email = String(p.email || '').toLowerCase().trim();
  var sh = getSheet('Usuarios');
  var fila = rowsToObjects(sh).find(function(x) {
    return x.empresa_id === u.empresa_id && String(x.email || '').toLowerCase() === email;
  });
  if (!fila) return { ok: false, error: 'Usuario no encontrado' };
  sh.getRange(fila._row, _getOrCreateCol(sh, 'telegram_chat_id')).setValue('');
  return { ok: true };
}

// =====================================================================================
// TRIGGER DIARIO — Germán lo instala UNA vez desde el editor (abrir este archivo →
// ejecutar instalarTriggerTelegramMatutino → aceptar OAuth). Corre a las 8am MX y
// audita AYER (día lógico) para cada empresa con bot configurado.
// =====================================================================================
function telegramAuditoriaMatutinaDiaria() {
  var empresas = rowsToObjects(getSheet('Empresas'));
  empresas.forEach(function(emp) {
    if (!_tgToken(emp.id)) return;
    try { _tgEnviarAuditoriaEmpresa(emp.id, ''); }
    catch (err) { console.error('Telegram auditoría ' + emp.id + ': ' + err); }
  });
}

function instalarTriggerTelegramMatutino() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'telegramAuditoriaMatutinaDiaria') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('telegramAuditoriaMatutinaDiaria').timeBased().atHour(8).everyDays(1).create();
  console.log('Trigger diario instalado: telegramAuditoriaMatutinaDiaria ~8am (hora MX del proyecto).');
}

// =====================================================================================
// DIAGNÓSTICO + REPARACIÓN DEL WEBHOOK (correr a mano desde el editor cuando el bot
// deja de responder a /start /ayuda /pendientes). Síntoma: el bot queda MUDO ante
// cualquier mensaje. Causa típica: Apps Script responde 302 → Telegram lo toma como
// fallo y se atasca reintentando el mismo update sin avanzar. Esta función:
//  1) muestra el estado actual (pending_update_count, último error),
//  2) re-registra el webhook con drop_pending_updates (vacía la cola atascada),
//  3) limpia el candado de último update_id (por si quedó en un valor que bloquea),
//  4) confirma el estado nuevo.
// Usa solo UrlFetchApp (scope ya autorizado) — Germán la corre y listo, sin re-OAuth.
// =====================================================================================
function repararBotTelegram() {
  var empresaId = '521aef3c-7df7-49ad-b1af-583a95233cd0'; // Fogueira
  var botToken = _tgToken(empresaId);
  if (!botToken) { console.log('⚠️ No hay bot configurado para esta empresa.'); return; }
  var antes = _tgApi(botToken, 'getWebhookInfo', {});
  console.log('ANTES → ' + JSON.stringify(antes.result || antes));
  var hookUrl = TG_WEBAPP_URL + '?action=telegram_webhook&tgsecret=' + _tgSecret() + '&e=' + encodeURIComponent(empresaId);
  var hook = _tgApi(botToken, 'setWebhook', { url: hookUrl, allowed_updates: ['message','callback_query'], drop_pending_updates: true, max_connections: 1 });
  console.log('setWebhook (reinicio) → ' + JSON.stringify(hook));
  _tgProps().deleteProperty('telegram_last_update_' + empresaId); // limpia el candado por si bloqueaba
  var despues = _tgApi(botToken, 'getWebhookInfo', {});
  console.log('DESPUÉS → ' + JSON.stringify(despues.result || despues));
  console.log('✅ Webhook reiniciado. Pide a la persona que abra SU link personal (?start=código) y toque INICIAR.');
}

// =====================================================================================
// AUTO-REPARADOR DEL WEBHOOK (trigger c/5 min) — para que el bot "jale al 100%" solo.
// =====================================================================================
// Raíz del problema (estructural en GAS): /exec SIEMPRE responde 302 → Telegram nunca
// recibe un 2xx, así que marca CADA entrega como fallida y reintenta. El handler SÍ
// corrió y respondió en la 1ª entrega (el usuario ve la respuesta), pero el "fantasma"
// de reintento queda pendiente. Esos fantasmas se acumulan y con max_connections:1 +
// entrega en orden, eventualmente tapan la cola → el bot queda MUDO ante mensajes nuevos.
//
// Este job, cada 5 min, lee getWebhookInfo y SOLO si hay cola pendiente o un último error
// re-registra el webhook con drop_pending_updates → vacía los fantasmas y nunca se atasca.
// Seguro: drop_pending solo descarta REINTENTOS (la acción ya ocurrió en la 1ª entrega);
// en estado ya atascado descarta updates que de todos modos no se iban a procesar (el
// usuario solo vuelve a tocar START). NO toca el candado telegram_last_update (ese protege
// contra re-procesar; los updates nuevos siempre traen id mayor).
// Multi-empresa: repara cada empresa que tenga bot configurado.
function autoRepararWebhookTelegram() {
  var empresas = rowsToObjects(getSheet('Empresas'));
  empresas.forEach(function(emp) {
    try {
      var botToken = _tgToken(emp.id);
      if (!botToken) return; // empresa sin bot → nada que reparar
      var info = _tgApi(botToken, 'getWebhookInfo', {});
      var r = (info && info.result) || {};
      var pending = Number(r.pending_update_count || 0);
      var lastErr = String(r.last_error_message || '');
      if (pending > 0 || lastErr) {
        var hookUrl = TG_WEBAPP_URL + '?action=telegram_webhook&tgsecret=' + _tgSecret() + '&e=' + encodeURIComponent(emp.id);
        _tgApi(botToken, 'setWebhook', { url: hookUrl, allowed_updates: ['message','callback_query'], drop_pending_updates: true, max_connections: 1 });
      }
    } catch (e) { /* nunca tirar el trigger por una empresa */ }
  });
}

// Instalar UNA vez desde el editor (requiere OAuth de ScriptApp + UrlFetch, como el matutino).
// Idempotente: borra el trigger previo de esta función antes de crear el nuevo.
function instalarAutoReparadorTelegram() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'autoRepararWebhookTelegram') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoRepararWebhookTelegram').timeBased().everyMinutes(5).create();
  console.log('✅ Auto-reparador del webhook instalado (cada 5 min). El bot ya no se quedará mudo.');
}
