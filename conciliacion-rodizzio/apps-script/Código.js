/**
 * Conciliación Restaurante — Backend
 * Setup, login, bitácoras, conciliaciones, usuarios, charolas, reservas
 */

// =============== Configuración ===============
var SALT = 'fogueira-conciliacion-salt-2026';
var ROLES_VALIDOS = ['admin','auditoria','cajera','host','cocina','churrasca','barman','panadero','encargado_piso','gerente_restaurante','gerente_administrativo','observador','comprador','gerente_plaza'];

// Acciones que mutan datos. Bloqueadas en handleRequest para el rol "observador" (read-only).
// Capa de defensa en profundidad: el frontend ya oculta los botones/forms por CSS, pero un
// usuario técnico podría burlar eso desde Inspector o lanzando requests directas con su token.
// Esta tabla blinda el backend para que aunque el frontend falle (o el token caiga en manos
// equivocadas), un observador NO pueda escribir.
// Excepciones DELIBERADAS (no bloqueadas):
//   - password_change       → el observador debe poder cambiar su propia contraseña
//   - reserva_publica_cancel → API pública con token de cancelación, no usa rol de sesión
//   - logout                → cerrar sesión propia es lectura/limpieza, no mutación de datos
var ACCIONES_WRITE_OBSERVADOR_BLOQUEADAS = {
  'horarios_save_all': true,
  'reservas_bloqueo_set': true,
  'sucursales_create': true,
  'sucursales_update': true,
  'tarifas_upsert': true,
  'tarifas_delete': true,
  'configuracion_set': true,
  'bitacora_save': true,
  'bitacora_fila_save': true,
  'bitacora_fila_delete': true,
  'bitacora_limpieza': true,
  'examen_iniciar': true,
  'examen_calificar': true,
  'certificacion_resetear': true,
  'examen_pregunta_save': true,
  'banco_preguntas_bootstrap': true,
  'banco_preguntas_actualizar': true,
  'curso_modulo_completar': true,
  'curso_desbloquear_modulo': true,
  'curso_modulo_save': true,
  'cursos_bootstrap': true,
  'cursos_quiz_actualizar': true,
  'sello_save': true,
  'conciliacion_save': true,
  'users_create': true,
  'users_update': true,
  'charolas_create': true,
  'charolas_delete': true,
  'merma_create': true,
  'merma_delete': true,
  'reservas_create': true,
  'reservas_update': true,
  'inv_churrasca_config_save': true,
  'inv_churrasca_save_celda': true,
  'inv_churrasca_autollenar_entradas': true,
  'inv_churrasca_nueva_semana': true,
  'inv_churrasca_setup_inicial': true,
  'recetario_config_set': true,
  'recetario_bootstrap': true,
  'recetario_bootstrap_desayuno': true,
  'recetario_bootstrap_espadas': true,
  'bootstrap_insumos_barra': true,
  'ingrediente_update': true,
  'receta_proponer_cambio': true,
  'receta_autorizar': true,
  'receta_rechazar': true,
  'receta_foto_upload': true,
  'charola_receta_set': true,
  // F3 — Importador SR12
  'sr12_config_set': true,
  'sr12_import_dry_run': true,
  'sr12_import_aplicar': true,
  'sr12_importacion_revertir': true,
  'sr12_rescatar_precios_legacy': true,
  'sr12_diagnostico_schema': true,
  'sr12_migrar_schema_legacy': true,
  'sr12_backup_ingredientes': true,
  'sr12_restaurar_ingredientes': true,
  // v382 — Fusionar insumos duplicados
  'ingrediente_fusionar': true,
  // v405 — Re-apuntar SOLO ciertas líneas (por familia de unidad) sin fusionar/desactivar
  'ingrediente_repuntar_lineas': true,
  // v406 — Pendientes manuales (dirección asigna tarea ad-hoc → Telegram)
  'pendiente_manual_add': true,
  'pendiente_manual_resolver': true,
  // v144 — Branding multi-empresa
  'empresa_branding_seed_fogueira': true,
  // v250 — Costos operativos
  'costo_config_set': true,
  // v251 — Auditoría IA de recetas
  'receta_auditar_ia': true,
  // v257 — Notificación de rechazo al chef
  'receta_notif_marcar_visto': true,
  // v261 — Configuración de umbrales de alertas de precios
  'sr12_alertas_config_set': true,
  // v265 — Justificaciones de precios
  'sr12_justificaciones_solicitar': true,
  'sr12_justificacion_set': true,
  // v267 — Aprobaciones de importación
  'sr12_solicitar_aprobacion': true,
  'sr12_aprobacion_aprobar': true,
  'sr12_aprobacion_aprobar_aplicar': true,
  'sr12_aprobacion_rechazar': true,
  // v270 — F3 Fase C: importador de compras (historial de precios reales)
  'sr12_compras_importar': true,
  // v296 — Importador de cancelaciones SR12 (prueba independiente del POS)
  'sr12_cancelaciones_importar': true,
  'sr12_cancelaciones_reset': true,
  // v306 — Importador de ventas SR12 (productos vendidos · insumo del Cuadre de Barra)
  'sr12_ventas_importar': true,
  'sr12_ventas_reset': true,
  // v278 — Tablero Directivo: cuestionar/responder cancelaciones (Mónica ↔ Luis)
  'cancelacion_cuestionar': true,
  'cancelacion_responder': true,
  // v281 — Curva de precios: cuestionar/responder al comprador (Mónica/auditoría ↔ comprador)
  'precio_cuestionar': true,
  'precio_responder': true,
  // v313 — Mensajes dirigidos del Tablero (dirección elige destinatario)
  'tablero_msg_crear': true,
  'tablero_msg_responder': true,
  // v315 — Aviso al que pregunta: marcar respuestas como vistas
  'tablero_respuestas_marcar_vistas': true,
  // v321 — Sugeridor de vínculos SR12: marcar un huérfano como "no aplica" (no está en SR12)
  'sr12_sugerencia_descartar': true,
  // v328 — Vincular en lote los huérfanos de alta confianza
  'sr12_vincular_alta_confianza': true,
  // v329 — Cerrar sesión en todos los dispositivos (invalida tokens previos del usuario)
  'cerrar_sesiones': true,
  // v332 — Cuadre de Barra: enlazar receta de bebida → producto de venta SR12
  'receta_vincular_venta': true,
  // v367 — Bot de Telegram (configurar bot, mandar mensajes, desvincular chat).
  // telegram_webhook NO va aquí: no usa token de sesión (valida con secreto propio).
  'telegram_configurar': true,
  'telegram_enviar_auditoria': true,
  'telegram_prueba': true,
  'telegram_desvincular': true,
  'telegram_reparar_webhook': true,
  // Agenda de responsables del día (Fase 1) — upsert de plantilla / excepción
  'agenda_responsables_set': true
};
// Roles que pueden autorizar cortesías (se muestran en el select de "Autorizó" en bitácora).
// SOLO los dos puestos de gerencia operativa — admin y auditoria NO autorizan cortesías.
var ROLES_AUTORIZA_CORTESIAS = ['gerente_restaurante','gerente_administrativo'];
// Cupo por SERVICIO (no por día): cuando los comensales reservados online de un servicio
// llegan a este número, el sistema bloquea automáticamente más reservas online.
// Walk-ins en bitácora no cuentan a este cupo (caben aparte hasta el aforo físico ~92).
var CUPO_POR_SERVICIO_DEFAULT = 50;
var SLOT_MINUTOS_DEFAULT = 15;          // las reservas online se hacen en slots de 15 min
var UMBRAL_GRUPO_GRANDE = 10;           // grupos de >10 personas no se confirman automático
var TOLERANCIA_MIN_DEFAULT = 10;        // minutos antes de marcar reserva como no_llego
var HORARIO_ESTELAR_DESDE = '15:00';
var HORARIO_ESTELAR_HASTA = '18:00';

// =============== Utilidades ===============
function hashPassword(password, salt) {
  salt = salt || SALT;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password) + salt);
  return bytes.map(function(b){ return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// ⚙️ EJECUTAR UNA VEZ desde este editor (Germán) y ACEPTAR el permiso de Drive.
// La subida de fotos de recetas guarda la imagen en Drive. Como antes la subida nunca llegaba
// al servidor (se caía en 'network' por mandarse vía JSONP), el permiso de Drive nunca se había
// autorizado. Correr esta función fuerza el consentimiento del scope Drive y deja las fotos listas.
function autorizarDriveFotos() {
  var carpeta = _obtenerCarpetaFotosRecetario();
  return 'OK — Drive autorizado. Carpeta de fotos: "' + carpeta.getName() + '" (id ' + carpeta.getId() + ')';
}
function uuid() { return Utilities.getUuid(); }
function getSheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
// Devuelve la hoja, creándola con su header si no existía. Útil cuando el spreadsheet
// existía antes de que se agregara la hoja al schema (no se necesita correr setupHojas).
function asegurarHoja(name, columnas) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  var range = sh.getRange(1, 1, 1, columnas.length);
  range.setValues([columnas]);
  range.setFontWeight('bold').setBackground('#b8472a').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  return sh;
}
function rowsToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0], result = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    obj._row = i + 1;
    result.push(obj);
  }
  return result;
}
function fechaToString(f) {
  if (f instanceof Date) {
    if (f.getFullYear() < 1970) return ''; // serial 0 de Sheets = 1899-12-30 → celda vacía
    return Utilities.formatDate(f, Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd');
  }
  return String(f || '');
}
function nowHHMM() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT', 'HH:mm');
}
// Sheets guarda strings tipo "18:00" como Date interno (Time). Al leer puede venir como Date.
function horaToString(h) {
  if (h instanceof Date) return Utilities.formatDate(h, Session.getScriptTimeZone() || 'GMT', 'HH:mm');
  return String(h || '');
}

// =============== Setup ===============
function setupHojas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = {
    'Empresas':       ['id','nombre','plan','creada_at','activa'],
    'Sucursales':     ['id','empresa_id','nombre','direccion','activa'],
    'Usuarios':       ['id','email','password_hash','empresa_id','rol','nombre','activo','creado_at'],
    'Tarifas':        ['empresa_id','sucursal_id','fecha_desde','servicio','dias_semana','hora_desde','hora_hasta','t_adulto','t_nino','t_3era'],
    'Reservas':       ['id','empresa_id','sucursal_id','fecha_reserva','hora_reserva','nombre','telefono','comensales','edades_ninos','evento','periquera','alergias','escaleras','estado','creada_at','adultos','ninos','tercera','promo_id','promo_nombre','ninos_0_5','ninos_6_10','ninos_11mas'],
    'Bitacoras':      ['id','empresa_id','sucursal_id','fecha','folio','servicio','host_email','estado','cerrada_at','payload_json'],
    // Cada fila de la bitácora se guarda como un registro independiente. Esto permite
    // recuperar pérdida granular (1 fila máximo si falla un save individual). Soft-delete.
    'BitacoraFilas':  ['id','bitacora_id','idx','creada_at','actualizada_at','borrada_at','borrada_motivo','borrada_por','host_email','payload_json'],
    // Cada sello es la firma autenticada de un usuario en un momento específico de un servicio.
    // Imposible firmar por otro: el sistema usa la sesión activa. Override admin con motivo.
    'Sellos':         ['id','bitacora_id','momento','rol_esperado','user_id','user_email','user_nombre','user_rol','sellado_at','es_override','motivo_override'],
    'Conciliaciones': ['id','empresa_id','sucursal_id','fecha','estado','cerrada_at','payload_json','actualizado_por','actualizado_at'],
    // Auditoría granular de cambios sobre Conciliaciones (T2 fase 2 · v126).
    // Cada entrada documenta un evento de save: quién (usuario), cuándo (ts), qué cambió
    // (secciones_modificadas — apertura, cierre, corte_caja, arqueo, depositos, cortesias,
    // terminales, resumen, etc.), y un snapshot completo del payload en ese momento.
    // Throttle: si el último evento de la misma conciliación es del mismo usuario hace <120s
    // se ACTUALIZA esa entrada (no se crea una nueva) — evita inflar la hoja en sesiones de
    // captura activa con debounce 200ms+2s. Cambios de estado (crear/cerrar/reabrir) siempre
    // crean una entrada nueva sin throttle.
    'ConciliacionAuditoria': ['id','conciliacion_id','empresa_id','sucursal_id','fecha','usuario_email','usuario_nombre','usuario_rol','ts','accion','secciones_modificadas','payload_snapshot_json'],
    // ───── F3 — Importador SoftRestaurant 12 (v128) ─────
    // Filosofía: "SR12 es el espejo, Fogueira el reflejo". El catálogo y costos del POS
    // sobrescriben a Fogueira. Las decisiones del modelado están en plan_f3_importador_sr12.md.
    //
    // IngredientesSR12: espejo del catálogo del SR12. Cada fila = 1 producto del POS con
    // su última presentación, costo, existencia por área (las 6 áreas del SR12) y unidad
    // base parseada de la descripción (g/ml/pza). Idempotente por clave_sr12.
    'IngredientesSR12': ['clave_sr12','empresa_id','nombre_sr12','familia_sr12','presentacion_descripcion','unidad_base','factor_a_base','costo_total_sr12','costo_por_base_sr12','impuesto_pct','existencia_almacen','existencia_barra','existencia_cava','existencia_churrasca','existencia_cocina','existencia_piso','existencia_total','saldo_total','parser_unidad_ok','creado_at','actualizado_at','ultima_importacion_id'],
    // IngredientesSR12Match: link Fogueira ↔ SR12. tipo_match indica cómo se ligó:
    //   'clave'         → ya tenía clave_sr12 explícita (Regla A)
    //   'nombre_exacto' → match exacto normalizado (Regla B)
    //   'nombre_similar'→ match >=85% (Regla C, requiere confirmación)
    //   'manual'        → Weslley/admin lo ligó a mano
    //   'auto_creado'   → ingrediente nuevo creado por el import (no había Fogueira previo)
    'IngredientesSR12Match': ['id','empresa_id','clave_sr12','ingrediente_id_fogueira','tipo_match','score_match','confirmado_por_email','confirmado_at'],
    // ImportacionesSR12: log maestro de cada importación (preview o aplicada).
    // Estatus: 'preview' (dry-run sin aplicar) → 'aplicada' / 'cancelada' / 'revertida'.
    'ImportacionesSR12': ['id','empresa_id','usuario_email','usuario_nombre','subido_at','aplicado_at','estatus','archivos_count','archivos_nombres','total_productos_archivos','productos_filtrados_familia','nuevos_creados','actualizados','sin_cambio','divergencias_grandes','huerfanos_fogueira','parser_fallos','notas','familias_activas_csv'],
    // ImportacionDetalleSR12: qué pasó con cada producto en cada importación. accion:
    //   'nuevo_sr12'       → nuevo producto que no estaba en IngredientesSR12 (primera vez)
    //   'actualizado_costo'→ ya existía, se cambió el costo
    //   'sin_cambio'       → existía y el costo no cambió
    //   'sospechoso'       → cambio >50% (alerta para Weslley revisar)
    //   'sin_parser'       → no se pudo parsear unidad de la descripción (manual)
    //   'creado_fogueira'  → además de actualizar SR12, se creó el ingrediente en Fogueira
    'ImportacionDetalleSR12': ['id','importacion_id','clave_sr12','nombre_sr12','accion','costo_anterior','costo_nuevo','variacion_pct','existencia_total','ingrediente_fogueira_id','tipo_match','recetas_afectadas'],
    // receta_id (Fase 4.2 — opcional): cuando la charola se sirve con base en una receta,
    //   el sistema descuenta automáticamente los ingredientes de InventarioChurrasca.
    // descuento_aplicado: true si ya se descontó (idempotencia, evitar doble descuento).
    'Charolas':       ['id','empresa_id','sucursal_id','fecha','hora','area','tipo','descripcion','cantidad','responsable_email','creado_at','receta_id','descuento_aplicado'],
    'Promociones':    ['id','empresa_id','sucursal_id','nombre','descripcion','dias_semana','hora_desde','hora_hasta','personas_requeridas','precio_normal','precio_promo','activa','creada_at'],
    'ReservasBloqueo':['id','empresa_id','sucursal_id','fecha','bloqueado','motivo','actualizado_at','actualizado_por'],
    // Configuración por empresa+sucursal en formato clave/valor (cupo, gerentes, tolerancia, etc.)
    'Configuracion':  ['empresa_id','sucursal_id','clave','valor'],
    // Horario operativo por día y servicio. Una reserva debe caer dentro de algún renglón activo.
    'Horarios':       ['empresa_id','sucursal_id','dia_semana','servicio','hora_apertura','hora_cierre','activo'],
    // Banco de preguntas para el examen de certificación. Una pregunta tiene 4 opciones (a-d) y una correcta.
    // Cada rol tiene su propio pool de ~25-30 preguntas; el examen sortea 15 al azar.
    'Examenes':       ['id','rol','pregunta','opcion_a','opcion_b','opcion_c','opcion_d','correcta','explicacion','activa','creada_at'],
    // Historial de intentos y certificaciones aprobadas. Cada intento es un registro.
    // vence_at solo se rellena en intentos aprobados (hoy + 6 meses).
    'Certificaciones':['id','user_id','user_email','user_nombre','rol','intento','fecha','calificacion','total','aprobado','vence_at','respuestas_json','reseteado_por','reseteado_at'],
    // Curso de capacitación por rol. Cada rol tiene N módulos en orden;
    // cada módulo tiene contenido (markdown) + opcional mini-quiz (preguntas en JSON).
    // El quiz es bloqueante: hay que aprobarlo (min_aprobatorio) para avanzar.
    'Cursos':         ['id','rol','modulo_orden','modulo_titulo','modulo_resumen','contenido_md','tiempo_estimado_min','tiene_quiz','quiz_preguntas_json','quiz_min_aprobatorio','activa','creada_at'],
    // Progreso individual del usuario en su curso. Una fila por (user, módulo).
    'ProgresoCursos': ['id','user_id','user_email','rol','modulo_id','modulo_orden','iniciado_at','completado_at','score_quiz','total_quiz','intentos_quiz','tiempo_real_min'],

    // ============ MÓDULO DE RECETAS Y COSTEO (Fase 1 - 2026-05-06) ============
    // Configuración global por empresa: % costo indirecto, % costo ideal, IVA default.
    // Una fila por empresa. Default: CI=10%, %costo=30%, IVA=16%.
    // EmpresaConfig (v144) extendida con branding multi-empresa. Cols originales 1-6 (operativas)
    // + cols 7-17 (branding por empresa). Cuando una empresa no tiene branding, el frontend usa defaults OAC.
    'EmpresaConfig':  ['empresa_id','costo_indirecto_pct','pct_costo_ideal','iva_default','actualizado_por','actualizado_at',
                       'nombre_comercial','tagline','logo_url_dark','logo_url_light','logo_url_isotipo',
                       'color_primario','color_secundario','color_acento','color_fondo','color_texto',
                       'font_titulo','font_cuerpo'],
    // Catálogo de materias primas. precio_origen indica si fue capturado_real,
    // tabla_especifica, categoria_unidad, categoria_default, calculado_de_subreceta o pendiente_capturar.
    // dato_incompleto=true cuando el insumo viene del .xlsm como sub-grupo sin unidad ni precio.
    // inventariable=false para insumos que NO se cuentan como ingrediente en recetas (aceite, gas, sal,
    //   especias raras de bote pequeño). Concepto del manual de SoftRestaurant: costos indirectos.
    // tipo_abc: clasificación 80/20 de insumos por impacto en costo total (A=20% que generan 80% del costo,
    //   B=medios, C=bajo impacto). Default null — Mónica/auditoría lo asigna después en su revisión mensual.
    // === Mermas estilo Marcos (chef churrasca) — basado en 200+ pruebas reales:
    //   merma_deshielo_pct:       agua perdida al descongelar (típico carnes congeladas)
    //   merma_aprovechable_pct:   recortes que se reusan en otras recetas (caldos, picadillos)
    //   merma_no_aprovechable_pct: lo que se tira (huesos, grasa no usable)
    //   merma_pct:                total = suma de los 3 (calculado al guardar)
    //   factor_rendimiento:       sobrescribe la merma cuando hay pruebas reales (ej. TOP-SIRLOIN: FR=1.17 con 107 pruebas)
    // === aliases: lista de nombres alternos (separados por '|') para reconciliar nombres con variantes
    //   ortográficas que llegan de los inventarios manuales (ej. "Tomahok|Tomahawk", "Calabreza|Calabresa")
    // === Costos estilo SoftRestaurant (V3 — 2026-05-06):
    //   ultimo_costo:        precio de la última compra (lo que en SR aparece como "costo unitario")
    //   costo_promedio:      promedio ponderado histórico (lo que en SR aparece como "costo promedio")
    //   ultimo_costo_estimado: true si fue estimado (web o categoría) y aún no hay compra real
    // clave_sr12 (col 27, v130): clave del producto en SoftRestaurant 12. Vínculo directo Fogueira↔SR12 (además de la tabla puente IngredientesSR12Match). Se rellena automáticamente al crear ingrediente desde SR12 o se puede editar manualmente en el Sheet para vincular ingredientes preexistentes.
    'Ingredientes':   ['id','empresa_id','nombre','aliases','categoria','tipo_abc','es_subreceta_catalogo','dato_incompleto','inventariable','unidad_base','ultimo_costo','costo_promedio','ultimo_costo_estimado','precio_origen','merma_deshielo_pct','merma_aprovechable_pct','merma_no_aprovechable_pct','merma_pct','factor_rendimiento','factor_rendimiento_origen','precio_real_unitario','activo','creado_at','creado_por','actualizado_at','actualizado_por','clave_sr12'],
    // Cómo se compra cada ingrediente. Un ingrediente puede tener N presentaciones (ej. Aceite en bidón 20 LT y bote 1 LT).
    // rendimiento = cuántas unidades base contiene (ej. bidón 20 LT con base lt → rendimiento 20).
    'Presentaciones': ['id','ingrediente_id','descripcion','unidad_compra','rendimiento','precio_presentacion','precio_unitario_calc','proveedor','es_default','activa','creado_at','creado_por'],
    // Recetas (la fórmula). es_elaborado=true significa sub-receta (se usa dentro de otras).
    // costo_indirecto_pct y pct_costo_ideal son NULL cuando se hereda del EmpresaConfig.
    'Recetas':        ['id','empresa_id','nombre','categoria_culinaria','area','chef_responsable_email','rendimiento','unidad_rendimiento','instrucciones','uso_aplicacion','decoracion_texto','es_elaborado','costo_indirecto_pct','pct_costo_ideal','activa','foto_url','foto_origen','creada_por','creado_at','actualizado_por','actualizado_at','montaje_buffet','clave_venta_sr12'],
    // Líneas de ingredientes/sub-recetas por receta. ingrediente_id O subreceta_id (no las dos).
    // es_decoracion=true marca decoración (cantidad usualmente en gr/ml, no en unidad base).
    'IngredientesReceta': ['id','receta_id','ingrediente_id','subreceta_id','cantidad','unidad','merma_extra_pct','es_decoracion','orden','advertencia'],
    // Productos de venta (lo que está en el menú). Uno apunta a una Receta. NO se eliminan, solo se suspenden.
    'Productos':      ['id','empresa_id','clave','receta_id','nombre_pos','grupo_venta','subgrupo_venta','precio_venta','iva_pct','precio_sin_imp','area_impresion','plu','utilizar_en','suspendido','creado_por','creado_at','actualizado_por','actualizado_at'],
    // Auditoría blindada de cambios de precio. NO se borra ni edita. alerta_masiva=true si se cambió >20 precios en <5 min (guardrail).
    'HistorialPrecios': ['id','ingrediente_id','presentacion_id','campo','valor_anterior','valor_nuevo','usuario_email','fecha','hora','ip_sesion','alerta_masiva'],
    // Auditoría blindada de cambios de receta. snapshot_json es el estado completo anterior (para restaurar).
    // accion: creó | modificó | desactivó | reactivó. NO se borra.
    'HistorialRecetas': ['id','receta_id','producto_id','accion','snapshot_json','usuario_email','fecha','hora','ip_sesion','alerta_masiva'],
    // Workflow de autorización Modelo B: chef propone → admin autoriza.
    // tipo_cambio: 'crear' | 'modificar' | 'desactivar'
    // estado: 'pendiente' | 'autorizada' | 'rechazada'
    // snapshot_propuesto_json: la receta como quedaría si se aprueba (campos modificables: instrucciones, uso_aplicacion, decoracion_texto, rendimiento, unidad_rendimiento, categoria_culinaria)
    // cambios_resumen: texto humano con qué cambió ("Instrucciones modificadas · Rendimiento: 5 → 8")
    'RecetasPendientes': ['id','tipo_cambio','receta_id','snapshot_propuesto_json','cambios_resumen','propuesto_por_email','propuesto_at','estado','autorizado_por_email','autorizado_at','motivo_rechazo'],

    // ============ MÓDULO INVENTARIO CHURRASCA (Sprint 2 - Fase 4 - 2026-05-06) ============
    // Réplica fiel del Excel de Marcos (chef churrasca): inventario semanal con día por día.
    // Estructura: 1 fila por (semana × día × ingrediente). 7 días por semana, ~50 ingredientes config = ~350 filas/sem.
    // === Configuración: qué ingredientes inventariar y en qué sección
    //   seccion: 'Congelador' (carnes) | 'Bodega' (consumibles secos) | 'Refrigerador' (frescos)
    //   orden: para mostrar en el orden que Marcos prefiere
    'InventarioChurrascaConfig': ['empresa_id','ingrediente_id','seccion','orden','activo','creado_at','creado_por'],
    // === Movimientos diarios. Una fila por ingrediente × día × semana.
    //   inv_inicial: peso/cantidad al INICIO del día
    //   entrada: lo que entró ese día (compras, traspasos, producciones)
    //   salida: lo que se consumió ese día
    //   inv_final: calculado = inicial + entrada - salida (NO se almacena, se calcula)
    //   alerta_consumo: bandera roja si salida > 20% del promedio histórico de ese ingrediente
    'InventarioChurrasca': ['id','empresa_id','sucursal_id','semana_iso','fecha','dia_semana','ingrediente_id','inv_inicial','entrada','salida','alerta_consumo','responsable_email','actualizado_at','actualizado_por'],

    // ============ AGENDA DE RESPONSABLES DEL DÍA (Fase 1 — 2026-06-09) ============
    // Modelo: PLANTILLA recurrente (AgendaPatron) + EXCEPCIONES por día (AgendaExcepcion).
    // El "quién es responsable hoy" se calcula expandiendo la plantilla para cada fecha
    // (cruzando dias_semana con el día de la semana) y aplicando encima las excepciones.
    // Áreas Fase 1: cajera|cocina|churrasca. Un solo turno por día (no se separa des/comida aún).
    //   tipo: titular|suplente · dias_semana CSV "1,2,3,4,5,6,7" (1=Lun..7=Dom) — ⚠️ TEXTO (es_MX corrompe CSV)
    //   vigente_hasta vacío = sigue vigente. activo=false da de baja la fila sin borrar histórico.
    'AgendaPatron':   ['id','empresa_id','sucursal_id','area','usuario_email','usuario_nombre','tipo','dias_semana','vigente_desde','vigente_hasta','activo','creado_at','creado_por','actualizado_at','actualizado_por'],
    //   estado: descansa|cubre|falta · fecha=yyyy-MM-dd (día lógico). descansa/falta QUITAN, cubre AGREGA.
    'AgendaExcepcion':['id','empresa_id','sucursal_id','fecha','area','usuario_email','usuario_nombre','tipo','estado','motivo','registrado_por','creado_at']
  };
  Object.keys(hojas).forEach(function(nombre) {
    var hoja = ss.getSheetByName(nombre);
    if (!hoja) hoja = ss.insertSheet(nombre);
    var cols = hojas[nombre];
    var range = hoja.getRange(1, 1, 1, cols.length);
    range.setValues([cols]);
    range.setFontWeight('bold');
    range.setBackground('#b8472a');
    range.setFontColor('#FFFFFF');
    hoja.setFrozenRows(1);
  });
  console.log('✓ Setup completado.');
}

// =============== Bootstrap ===============
function crearPrimerAdmin() {
  var ADMIN_EMAIL = 'cpgermansolis@gmail.com', ADMIN_PASSWORD = '87654321',
      ADMIN_NOMBRE = 'Germán Solís', EMPRESA_NOMBRE = 'Fogueira', SUCURSAL_NOMBRE = 'Matriz';
  if (rowsToObjects(getSheet('Usuarios')).some(function(u){ return String(u.email).toLowerCase() === ADMIN_EMAIL.toLowerCase(); })) {
    console.log('⚠ Usuario ya existe.'); return;
  }
  var now = new Date(), empresaId = uuid(), sucursalId = uuid(), userId = uuid();
  getSheet('Empresas').appendRow([empresaId, EMPRESA_NOMBRE, 'Pro', now, true]);
  getSheet('Sucursales').appendRow([sucursalId, empresaId, SUCURSAL_NOMBRE, '', true]);
  getSheet('Usuarios').appendRow([userId, ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD), empresaId, 'admin', ADMIN_NOMBRE, true, now]);
  console.log('✓ Bootstrap completado.');
}

// Migra la hoja Tarifas a la nueva estructura (servicio + dias_semana + horas + 3 tarifas)
// y carga los renglones reales de Fogueira. Borra los datos previos (eran de prueba).
// Ejecutar UNA VEZ desde el editor de Apps Script.
function setupTarifasFogueira() {
  var EMPRESA_ID = '521aef3c-7df7-49ad-b1af-583a95233cd0'; // Fogueira
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tarifas');
  if (!sheet) sheet = ss.insertSheet('Tarifas');
  // 1) Limpiar todo y reescribir header con la nueva estructura
  sheet.clear();
  var cols = ['empresa_id','sucursal_id','fecha_desde','servicio','dias_semana','hora_desde','hora_hasta','t_adulto','t_nino','t_3era'];
  var range = sheet.getRange(1, 1, 1, cols.length);
  range.setValues([cols]);
  range.setFontWeight('bold');
  range.setBackground('#b8472a');
  range.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  // 2) Forzar formato texto en columnas E,F,G (dias_semana, hora_desde, hora_hasta).
  //    Sin esto, Sheets en locales es_* convierte "5,6,7" a número decimal y se rompe.
  sheet.getRange('E:G').setNumberFormat('@');
  // 3) Cargar tarifas reales de Fogueira (vigentes desde 2026-04-28).
  //    Apóstrofe inicial fuerza texto literal: Sheets convierte "5,6,7" a fecha "5,6,2007"
  //    aún con setNumberFormat('@'). El apóstrofe no se guarda como contenido.
  var FECHA_DESDE = '2026-04-28';
  var filas = [
    [EMPRESA_ID, '', FECHA_DESDE, 'Buffet completo', "'1,2,3,4", "'00:00", "'23:59", 590, 249, 590],
    [EMPRESA_ID, '', FECHA_DESDE, 'Desayuno',        "'5,6,7",   "'00:00", "'12:59", 299, 249, 299],
    [EMPRESA_ID, '', FECHA_DESDE, 'Comida',          "'5,6,7",   "'13:00", "'23:59", 590, 249, 590]
  ];
  sheet.getRange(2, 1, filas.length, cols.length).setValues(filas);
  return 'Tarifas Fogueira cargadas: 3 renglones (Buffet Lun-Jue, Desayuno V-D, Comida V-D)';
}

// Vacía SOLO los datos transaccionales (actividad acumulada en pruebas).
// MANTIENE: Empresas, Sucursales, Usuarios, Tarifas, Configuracion, Horarios, Promociones.
// BORRA:    Reservas, Bitacoras, Conciliaciones, Charolas, ReservasBloqueo.
// Usar antes de iniciar operación real para empezar con la actividad en ceros.
function vaciarDatosTransaccionales() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojasABorrar = ['Reservas','Bitacoras','Conciliaciones','Charolas','ReservasBloqueo'];
  var resumen = [];
  hojasABorrar.forEach(function(nombre){
    var sh = ss.getSheetByName(nombre);
    if (!sh) { resumen.push(nombre + ': hoja no existe'); return; }
    var ultimaFila = sh.getLastRow();
    if (ultimaFila <= 1) { resumen.push(nombre + ': ya estaba vacía'); return; }
    // Borrar de la fila 2 hacia abajo (mantiene encabezado en fila 1)
    var filasABorrar = ultimaFila - 1;
    sh.deleteRows(2, filasABorrar);
    resumen.push(nombre + ': ' + filasABorrar + ' filas borradas');
  });
  return 'Vaciado completado:\n' + resumen.join('\n');
}

// Reactiva (estado='confirmada') TODAS las reservas del día especificado que estén
// en estado 'no_llego'. Útil para recuperar las que el auto-cancel agresivo marcó
// mal antes del fix del 2026-04-30. La host después marcará manualmente las que
// realmente no llegaron — esta vez con motivo escrito.
// Diagnóstico: dada una reserva por id, imprime los datos y el token de cancelación
// que el sistema CALCULA hoy. Útil para ver por qué un link de cancelación dice "Link inválido".
function diagnosticarReserva(id) {
  var sheet = getSheet('Reservas');
  if (!sheet) { Logger.log('No existe hoja Reservas'); return; }
  var r = rowsToObjects(sheet).find(function(x){ return x.id === id; });
  if (!r) { Logger.log('No se encontró reserva con id: ' + id); return; }
  var raw = String(r.id) + '|' + String(r.telefono || '') + '|' + fechaToString(r.fecha_reserva) + '|cancel';
  var tok = tokenCancelacion(r);
  var info =
    'Reserva ' + id + ':\n' +
    '  · nombre: ' + JSON.stringify(r.nombre) + '\n' +
    '  · telefono: ' + JSON.stringify(r.telefono) + ' (tipo: ' + typeof r.telefono + ')\n' +
    '  · fecha_reserva (raw): ' + JSON.stringify(r.fecha_reserva) + ' (instanceof Date: ' + (r.fecha_reserva instanceof Date) + ')\n' +
    '  · fecha_reserva (formateada): ' + fechaToString(r.fecha_reserva) + '\n' +
    '  · estado: ' + r.estado + '\n' +
    'Cadena raw para SHA-256:\n  "' + raw + '"\n' +
    'Token calculado AHORA: ' + tok + '\n' +
    'URL gestión que YO generaría: ' + ScriptApp.getService().getUrl() + '?p=mireserva&id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(tok);
  Logger.log(info);
  return info;
}
// Wrapper sin parámetros para correr desde el editor: diagnostica la reserva con id hardcodeado.
// Cambia el id manualmente si quieres diagnosticar otra.
function diagnosticarReservaProblema() {
  return diagnosticarReserva('e5590456-d3ff-4707-a286-8ca3272af1ae');
}

function revivirReservasDeHoy() {
  var r = revivirReservasDeFecha(fechaToString(new Date()));
  Logger.log(r);
  return r;
}
function revivirReservasDeAyer() {
  var ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  var r = revivirReservasDeFecha(fechaToString(ayer));
  Logger.log(r);
  return r;
}
// Recupera TODAS las reservas en estado "no_llego" de los últimos N días (default 7).
// Útil cuando no sabes exactamente la fecha de la reserva afectada por el bug del auto-cancel.
function revivirReservasUltimosDias(N) {
  N = parseInt(N, 10) || 7;
  var sheet = getSheet('Reservas');
  if (!sheet) { var e='⚠ Hoja Reservas no existe'; Logger.log(e); return e; }
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var hace = new Date(hoy.getTime() - N*24*60*60*1000);
  var hoyStr = fechaToString(hoy);
  var haceStr = fechaToString(hace);
  var reservas = rowsToObjects(sheet);
  var revividas = [];
  reservas.forEach(function(r){
    var fr = fechaToString(r.fecha_reserva);
    if (fr < haceStr || fr > hoyStr) return;
    if (String(r.estado || '') !== 'no_llego') return;
    sheet.getRange(r._row, 14).setValue('confirmada');
    revividas.push('  · [' + fr + ' ' + horaToString(r.hora_reserva) + '] ' + (r.nombre || '(sin nombre)') + ' — ' + r.comensales + ' personas');
  });
  var resumen = !revividas.length
    ? 'No se encontraron reservas en estado "no_llego" en los últimos ' + N + ' días (rango ' + haceStr + ' a ' + hoyStr + ').'
    : '✓ Revividas ' + revividas.length + ' reservas en los últimos ' + N + ' días (rango ' + haceStr + ' a ' + hoyStr + '):\n' + revividas.join('\n') + '\n\nLa host las verá en la bitácora del día correspondiente al refrescar.';
  Logger.log(resumen);
  return resumen;
}
function revivirReservasDeFecha(fecha) {
  fecha = String(fecha || '').trim();
  if (!fecha) { var e1='⚠ Falta parámetro fecha (formato yyyy-mm-dd). Ej: revivirReservasDeFecha("2026-04-30")'; Logger.log(e1); return e1; }
  var sheet = getSheet('Reservas');
  if (!sheet) { var e2='⚠ Hoja Reservas no existe'; Logger.log(e2); return e2; }
  var reservas = rowsToObjects(sheet);
  var totalReservasFecha = 0;
  var estadosEncontrados = {};
  var revividas = [];
  reservas.forEach(function(r){
    if (fechaToString(r.fecha_reserva) !== fecha) return;
    totalReservasFecha++;
    var st = String(r.estado || '');
    estadosEncontrados[st] = (estadosEncontrados[st] || 0) + 1;
    if (st !== 'no_llego') return;
    sheet.getRange(r._row, 14).setValue('confirmada'); // columna 14 = estado
    revividas.push('  · ' + (r.nombre || '(sin nombre)') + ' — ' + horaToString(r.hora_reserva) + ' — ' + r.comensales + ' personas');
  });
  var resumen;
  if (!revividas.length) {
    var estados = Object.keys(estadosEncontrados).map(function(k){ return k + '=' + estadosEncontrados[k]; }).join(', ') || '(ninguno)';
    resumen = 'No se encontraron reservas en estado "no_llego" para la fecha ' + fecha + '.\n' +
              'Total reservas en esa fecha: ' + totalReservasFecha + '\n' +
              'Estados encontrados: ' + estados;
  } else {
    resumen = '✓ Revividas ' + revividas.length + ' reservas del ' + fecha + ' (pasaron de no_llego → confirmada):\n' + revividas.join('\n') + '\n\nLa host las verá en la bitácora al refrescar (Ctrl+F5).';
  }
  Logger.log(resumen);
  return resumen;
}

// Bootstrap de configuración + horarios operativos — ejecutar UNA VEZ desde el editor.
// Borra y recrea las hojas Horarios y Configuracion con los datos reales de Fogueira.
function setupConfiguracionFogueira() {
  var EMPRESA_ID = '521aef3c-7df7-49ad-b1af-583a95233cd0'; // Fogueira
  var SUCURSAL_ID = ''; // global a la empresa por ahora (Matriz)
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- HORARIOS ----
  var sh = ss.getSheetByName('Horarios');
  if (!sh) sh = ss.insertSheet('Horarios');
  sh.clear();
  var colsH = ['empresa_id','sucursal_id','dia_semana','servicio','hora_apertura','hora_cierre','activo'];
  var rangeH = sh.getRange(1, 1, 1, colsH.length);
  rangeH.setValues([colsH]);
  rangeH.setFontWeight('bold').setBackground('#b8472a').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  sh.getRange('E:F').setNumberFormat('@'); // horas como texto
  // Lun-Jue: 1pm-11pm Buffet completo
  // Vie-Sáb: 8am-12pm Desayuno + 1pm-11pm Comida
  // Dom: 8am-12pm Desayuno + 1pm-9pm Comida (cierra 2h antes)
  var horarios = [
    [EMPRESA_ID, SUCURSAL_ID, 1, 'Buffet completo', "'13:00", "'23:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 2, 'Buffet completo', "'13:00", "'23:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 3, 'Buffet completo', "'13:00", "'23:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 4, 'Buffet completo', "'13:00", "'23:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 5, 'Desayuno',        "'08:00", "'12:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 5, 'Comida',          "'13:00", "'23:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 6, 'Desayuno',        "'08:00", "'12:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 6, 'Comida',          "'13:00", "'23:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 7, 'Desayuno',        "'08:00", "'12:00", true],
    [EMPRESA_ID, SUCURSAL_ID, 7, 'Comida',          "'13:00", "'21:00", true]
  ];
  sh.getRange(2, 1, horarios.length, colsH.length).setValues(horarios);

  // ---- CONFIGURACION (clave/valor) ----
  var cf = ss.getSheetByName('Configuracion');
  if (!cf) cf = ss.insertSheet('Configuracion');
  cf.clear();
  var colsC = ['empresa_id','sucursal_id','clave','valor'];
  var rangeC = cf.getRange(1, 1, 1, colsC.length);
  rangeC.setValues([colsC]);
  rangeC.setFontWeight('bold').setBackground('#b8472a').setFontColor('#FFFFFF');
  cf.setFrozenRows(1);
  // Gerentes de cortesías ya NO van aquí: se manejan creando usuarios con rol
  // gerente_restaurante o gerente_administrativo desde el panel admin.
  var configs = [
    [EMPRESA_ID, SUCURSAL_ID, 'cupo_por_servicio',     '50'],
    [EMPRESA_ID, SUCURSAL_ID, 'slot_minutos',          '15'],
    [EMPRESA_ID, SUCURSAL_ID, 'umbral_grupo_grande',   '10'],
    [EMPRESA_ID, SUCURSAL_ID, 'tolerancia_minutos',    '10'],
    [EMPRESA_ID, SUCURSAL_ID, 'horario_estelar_desde', "'15:00"],
    [EMPRESA_ID, SUCURSAL_ID, 'horario_estelar_hasta', "'18:00"],
    [EMPRESA_ID, SUCURSAL_ID, 'aforo_fisico',          '92'],
    [EMPRESA_ID, SUCURSAL_ID, 'mesas_salon',           'Salón:1:4,2:4,3:4,4:4,5:4,6:2,7:4,8:4,9:4,10:3,11:2,12:2,20:3,21:4,22:3,23:3,40:4,41:4|Terraza:30:4,31:4,32:4,33:4,34:4,35:4']
  ];
  cf.getRange(2, 1, configs.length, colsC.length).setValues(configs);

  return 'Configuración Fogueira cargada: ' + horarios.length + ' renglones de horarios + ' + configs.length + ' parámetros. Captura los nombres de gerentes en la hoja Configuracion.';
}

// Bootstrap del banco de preguntas para examen de certificación.
// Carga ~25 preguntas por rol. Idempotente: NO duplica si ya existen.
// Optimizado: escribe TODAS las filas de un solo golpe con setValues (rápido vs appendRow uno por uno).
function setupBancoPreguntasFogueira() {
  var sheet = asegurarHoja('Examenes', EXAMENES_COLS);
  var existentes = rowsToObjects(sheet);
  var clavesExistentes = {};
  existentes.forEach(function(p){
    var clave = String(p.rol||'').toLowerCase() + '||' + String(p.pregunta||'').trim();
    clavesExistentes[clave] = true;
  });
  var ahora = new Date();
  var nuevasFilas = [];
  var omitidas = 0;
  var BANCO = bancoPreguntasFogueira();
  Object.keys(BANCO).forEach(function(rol){
    BANCO[rol].forEach(function(q){
      var clave = rol + '||' + String(q.pregunta||'').trim();
      if (clavesExistentes[clave]) { omitidas++; return; }
      nuevasFilas.push([
        uuid(), rol, q.pregunta,
        q.a, q.b, q.c, q.d,
        String(q.correcta).toLowerCase(),
        q.explicacion || '',
        true, ahora
      ]);
    });
  });
  if (nuevasFilas.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, nuevasFilas.length, EXAMENES_COLS.length).setValues(nuevasFilas);
  }
  return 'Banco de preguntas: ' + nuevasFilas.length + ' creadas, ' + omitidas + ' omitidas (ya existían).';
}

// Bootstrap de cursos: carga los módulos del curso por rol.
// Idempotente: si ya existe un módulo (mismo rol + orden + título), NO duplica.
// Optimizado: setValues en batch.
function setupCursosFogueira() {
  var sheet = asegurarHoja('Cursos', CURSOS_COLS);
  var existentes = rowsToObjects(sheet);
  var clavesExistentes = {};
  existentes.forEach(function(c){
    var clave = String(c.rol||'').toLowerCase() + '||' + (parseInt(c.modulo_orden,10)||0) + '||' + String(c.modulo_titulo||'').trim();
    clavesExistentes[clave] = true;
  });
  var ahora = new Date();
  var nuevasFilas = [];
  var omitidos = 0;
  var CURSOS = cursosFogueira();
  Object.keys(CURSOS).forEach(function(rol){
    CURSOS[rol].forEach(function(m, idx){
      var orden = (idx + 1) * 10;
      var clave = rol + '||' + orden + '||' + String(m.titulo||'').trim();
      if (clavesExistentes[clave]) { omitidos++; return; }
      var preguntasConIds = (m.quiz || []).map(function(q, i){
        return Object.assign({}, q, { id: 'q-' + Math.random().toString(36).slice(2,10) + '-' + i });
      });
      nuevasFilas.push([
        uuid(), rol, orden, m.titulo, m.resumen,
        m.contenido, m.tiempo || 5,
        m.quiz && m.quiz.length > 0,
        JSON.stringify(preguntasConIds),
        m.minAprobatorio || (m.quiz ? m.quiz.length : 0),
        true, ahora
      ]);
    });
  });
  if (nuevasFilas.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, nuevasFilas.length, CURSOS_COLS.length).setValues(nuevasFilas);
  }
  return 'Cursos: ' + nuevasFilas.length + ' módulos creados, ' + omitidos + ' omitidos (ya existían).';
}
// Endpoint admin para correr el bootstrap desde UI
function handleCursosBootstrap(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  try {
    var msg = setupCursosFogueira();
    return { ok:true, mensaje: msg };
  } catch(e) {
    return { ok:false, error:'Error: ' + e.message };
  }
}

// Actualizar opciones y correctas del banco de preguntas sin recrear IDs.
// Marca las preguntas existentes como inactivas e inserta las versiones actualizadas del código.
function actualizarBancoPreguntasFogueira() {
  var sheet = asegurarHoja('Examenes', EXAMENES_COLS);
  var idxActiva = EXAMENES_COLS.indexOf('activa');
  var lr = sheet.getLastRow();
  if (lr > 1 && idxActiva >= 0) {
    var inactivos = [];
    for (var i = 0; i < lr - 1; i++) inactivos.push([false]);
    sheet.getRange(2, idxActiva + 1, lr - 1, 1).setValues(inactivos);
  }
  var ahora = new Date();
  var BANCO = bancoPreguntasFogueira();
  var nuevasFilas = [];
  Object.keys(BANCO).forEach(function(rol) {
    BANCO[rol].forEach(function(q) {
      nuevasFilas.push([uuid(), rol, q.pregunta, q.a, q.b, q.c, q.d,
        String(q.correcta).toLowerCase(), q.explicacion || '', true, ahora]);
    });
  });
  if (nuevasFilas.length > 0)
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevasFilas.length, EXAMENES_COLS.length).setValues(nuevasFilas);
  return 'Banco actualizado: ' + nuevasFilas.length + ' preguntas recargadas. Anteriores marcadas inactivas.';
}
function handleBancoPreguntasActualizar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  try { return { ok:true, mensaje: actualizarBancoPreguntasFogueira() }; }
  catch(e) { return { ok:false, error:'Error: ' + e.message }; }
}

// Actualizar quiz_preguntas_json de módulos de curso existentes (preserva IDs de preguntas).
// Matchea por (rol + modulo_orden). Solo actualiza los campos a/b/c/d/correcta; preserva IDs.
function actualizarCursosQuizFogueira() {
  var sheet = asegurarHoja('Cursos', CURSOS_COLS);
  var existentes = rowsToObjects(sheet);
  var CURSOS = cursosFogueira();
  var idxQuiz = CURSOS_COLS.indexOf('quiz_preguntas_json');
  var mapaFilas = {};
  existentes.forEach(function(m, idx) {
    var clave = String(m.rol || '').toLowerCase() + '||' + (parseInt(m.modulo_orden, 10) || 0);
    mapaFilas[clave] = { rowIdx: idx + 2, quizJson: m.quiz_preguntas_json };
  });
  var actualizados = 0;
  Object.keys(CURSOS).forEach(function(rol) {
    CURSOS[rol].forEach(function(modulo, idx) {
      var orden = (idx + 1) * 10;
      var clave = rol + '||' + orden;
      var fila = mapaFilas[clave];
      if (!fila || !modulo.quiz || modulo.quiz.length === 0) return;
      var quizExistente = [];
      try { quizExistente = JSON.parse(fila.quizJson || '[]'); } catch(e) {}
      var pregNuevo = modulo.quiz.map(function(q, i) {
        var prev = null;
        for (var k = 0; k < quizExistente.length; k++) {
          if (quizExistente[k].pregunta === q.pregunta) { prev = quizExistente[k]; break; }
        }
        var id = prev ? prev.id : ('q-' + Math.random().toString(36).slice(2, 10) + '-' + i);
        return { id: id, pregunta: q.pregunta, a: q.a, b: q.b, c: q.c, d: q.d, correcta: q.correcta, explicacion: q.explicacion || '' };
      });
      sheet.getRange(fila.rowIdx, idxQuiz + 1).setValue(JSON.stringify(pregNuevo));
      actualizados++;
    });
  });
  return 'Cursos: quiz actualizado en ' + actualizados + ' módulos.';
}
function handleCursosQuizActualizar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  try { return { ok:true, mensaje: actualizarCursosQuizFogueira() }; }
  catch(e) { return { ok:false, error:'Error: ' + e.message }; }
}

// Contenido del curso por rol. Formato: { rol: [{ titulo, resumen, contenido (markdown simple), tiempo, quiz [{pregunta, a, b, c, d, correcta, explicacion}], minAprobatorio }] }
// Markdown soportado en contenido: **bold**, *italic*, listas con "-", ## para subtítulos, líneas en blanco para párrafos.
function cursosFogueira() {
  return {
    host: modulosCursoHost(),
    // Gerente de Restaurante (Gabriel) — Opción A: hereda los 6 módulos del host + 4 módulos
    // específicos de su responsabilidad (cortesías, override, supervisión, cierre profundo).
    gerente_restaurante: modulosCursoHost().concat(modulosExtraGerenteRestaurante()),
    // Admin (técnico) — desarrollador/auditor que administra el sistema. Sin operación de
    // restaurante; foco en arquitectura, usuarios, config, bootstraps, troubleshooting y deploys.
    admin: modulosCursoAdmin(),
    // Gerente Administrativo (Mónica) — el rol más completo. Hereda admin completo +
    // operación administrativa día a día + autorización de cortesías + supervisión gerencial.
    gerente_administrativo: modulosCursoGerenteAdministrativo(),
    // Cajera — operativa crítica del manejo de dinero. Cobros, cierre profundo, captura de
    // cortesías (con autorización de gerente), banderas rojas. NO autoriza cortesías ella.
    cajera: modulosCursoCajera(),
    // Encargado de Piso (sub-gerente) — segundo a cargo después de Gabriel. 100% en piso
    // durante servicio. Coordina hosts/cocina/churrasca/cajera, destraba bloqueos en tiempo real.
    encargado_piso: modulosCursoEncargadoPiso(),
    // Cocina (Sergio) — chef ejecutivo. Recetario, costeo, charolas, mermas, workflow autorización.
    cocina: modulosCursoCocina(),
    // Churrasca (Marcos) — responsable de la zona de carnes/parrilla. Inventario semanal,
    // recetas churrasca, charolas, coordinación con cocina.
    churrasca: modulosCursoChurrasca(),
    // Auditoría — auditor interno (Germán u otra persona designada). Lectura sin modificación,
    // marcos COSO, banderas rojas, hallazgos, papeles de trabajo.
    auditoria: modulosCursoAuditoria(),
    // Comprador (Weslley) — responsable de proveedores y cotizaciones. Edición de precios
    // de ingredientes, validación de mermas, reporte semanal de variaciones.
    comprador: modulosCursoComprador()
  };
}

// Los 6 módulos del curso de Host. Reutilizables por gerente_restaurante (que supervisa).
function modulosCursoHost() {
  return [
      // ---------- Módulo 1: Bienvenida ----------
      {
        titulo: 'Bienvenida y acceso al sistema',
        resumen: 'Tu primera vez en el sistema: cómo entrar y qué encontrar adentro.',
        tiempo: 4,
        contenido: '## ¡Bienvenida al equipo!\n\nFogueira tiene un sistema digital donde tú vas a registrar TODO lo que pasa en el restaurante: las reservas que llegan, los walk-ins, las mesas, las cortesías. Esto reemplaza las hojas de papel que se usaban antes.\n\nEs **muy fácil** una vez que le agarras el ritmo. Cualquier cosa que captures aquí queda guardada al instante: si se va el internet o cierras el navegador, no se pierde nada.\n\n## Cómo iniciar sesión\n\n1. **Abre el link** que te mandó Mónica (es la URL del sistema).\n2. Captura tu **correo** y tu **contraseña**.\n3. Tap en **"Iniciar sesión"**.\n4. En PC y Android entras automático. En iPhone, después de capturar te aparece un botón **"→ Entrar al sistema"** — dale tap.\n\n## Tu sesión\n\nUna vez dentro, tu sesión dura **hasta las 3:00 am del día siguiente**. Esto cubre todo el turno aunque cierres tarde. No te va a "tirar" a media operación.\n\n## Si algo falla\n\n- Refresca la página (Ctrl+F5 en PC, cerrar/abrir Safari en iPhone)\n- Si no carga, copia el link y pégalo directo en Safari (no abras desde WhatsApp)\n- Para problemas técnicos: avísale a Mónica',
        quiz: [
          { pregunta:'¿Hasta qué hora dura tu sesión iniciada?',
            a:'1 hora', b:'8 horas', c:'Hasta las 3:00 am del día siguiente', d:'Hasta medianoche',
            correcta:'c', explicacion:'La sesión cubre el día operativo completo del restaurante.' },
          { pregunta:'En iPhone, después de capturar correo y contraseña, ¿qué pasa?',
            a:'Entra automático', b:'Aparece un botón "→ Entrar al sistema" que debes presionar', c:'Se reinicia el celular', d:'Hay que llamar a soporte',
            correcta:'b', explicacion:'Safari iOS bloquea el redirect automático; aparece un botón visible que debes presionar.' },
          { pregunta:'Si capturas algo y se va el internet, ¿qué pasa con tu información?',
            a:'Se pierde', b:'Queda guardada (el sistema reintenta automáticamente cuando vuelve la conexión)', c:'Hay que volver a capturar', d:'Se cobra una multa',
            correcta:'b', explicacion:'El sistema usa reintentos infinitos y respaldo de emergencia para no perder datos.' }
        ],
        minAprobatorio: 3
      },
      // ---------- Módulo 2: Reservaciones ----------
      {
        titulo: 'Reservaciones del día',
        resumen: 'La agenda de la jornada: cómo recibir clientes con reserva, marcar llegadas y manejar no-shows.',
        tiempo: 6,
        contenido: '## La pestaña Reservaciones\n\nEs **tu agenda del día**. Muestra todas las reservas que se hicieron por internet, ordenadas por hora. Cada reserva trae:\n\n- **Nombre del cliente**\n- **Teléfono** (para llamar/escribir si se atrasa)\n- **Hora reservada**\n- **Comensales** (cuántos vienen)\n- **Edades de niños** (importante para tarifa)\n- **Eventos especiales** (cumpleaños, alergias, periquera, etc.)\n\n## Cuando llega un cliente con reserva\n\n1. Pregunta su nombre.\n2. Búscalo en la lista.\n3. Tap el botón verde **"✓ Llegó"** — la reserva queda marcada como atendida.\n4. Asígnale mesa desde el plano del salón (eso lo veremos en otro módulo).\n\n## Si NO llega\n\n- **Tolerancia interna: 10 minutos.** Pasados 10 min de la hora, la reserva se ve en rojo (atrasada).\n- El sistema **NO** la cancela sola. Tú decides si marcarla como **"No llegó"** (te pedirá un motivo).\n\n## Confirmar reservas pendientes por WhatsApp\n\nEl sistema te muestra un botón verde **"📱 Confirmar (WA)"**. Tap → se abre WhatsApp con un mensaje listo. Solo dale enviar.\n\n## Pestaña "Futuras"\n\nA la derecha hay otra pestaña que muestra TODAS las reservas hacia adelante (sin importar el día). Útil cuando un cliente pregunta "¿tengo reserva para el sábado?".\n\n## Cuando un cliente CANCELA\n\nEl cliente puede cancelar él solo desde su WhatsApp **hasta 30 minutos antes** de su hora. Cuando lo hace, te aparece un toast rojo en pantalla con su nombre. La reserva pasa al filtro "Canceladas" y libera el cupo automáticamente.\n\n## Botón rojo "Pausar reservas"\n\nSi llenamos el restaurante o hay una emergencia, este botón **bloquea las reservas online del día** (las que ya están se respetan). Avísale a Mónica antes de usarlo.',
        quiz: [
          { pregunta:'¿Cuándo se considera una reserva "atrasada" visualmente?',
            a:'Después de 5 minutos de la hora reservada', b:'Nunca — el sistema no cambia colores', c:'Después de 10 minutos de la hora (tolerancia interna)', d:'Después de 1 hora exacta',
            correcta:'c', explicacion:'10 min de tolerancia interna; la reserva se ve roja pero NO se cancela sola.' },
          { pregunta:'¿Hasta cuánto antes puede el cliente cancelar su reserva online por su cuenta?',
            a:'5 minutos antes desde el link único', b:'30 minutos antes', c:'1 hora antes', d:'No puede cancelar — solo el host puede',
            correcta:'b', explicacion:'30 min antes desde su link único de WhatsApp.' },
          { pregunta:'¿Qué hace el botón rojo "Pausar reservas"?',
            a:'Cancela todas las reservas existentes del día', b:'Bloquea NUEVAS reservas online del día (las existentes se respetan)', c:'Cierra el restaurante definitivamente', d:'Manda WhatsApp masivo a todos los clientes con reserva',
            correcta:'b', explicacion:'Solo bloquea NUEVAS; usa con criterio y avisa a Mónica antes.' }
        ],
        minAprobatorio: 3
      },
      // ---------- Módulo 3: Bitácora apertura ----------
      {
        titulo: 'Apertura de la bitácora del servicio',
        resumen: 'Cómo abrir bitácora al empezar el servicio y qué datos prellena el sistema.',
        tiempo: 5,
        contenido: '## Qué es la Bitácora\n\nEs el **registro en vivo** de cada grupo que entra al restaurante durante un servicio. Cada grupo = una fila. Sirve para conciliar caja al cierre.\n\nUna bitácora cubre **un servicio**:\n\n- **Lun–Jue**: Buffet completo (1pm-11pm) → 1 bitácora al día\n- **Vie–Dom**: Desayuno (8am-12pm) y Comida (1pm-11pm) → 2 bitácoras al día\n\n## Cómo abrir una bitácora\n\n1. Abre la página **Bitácora** desde tu inicio.\n2. Tap en **"+ Nuevo servicio"**.\n3. El sistema te ayuda a elegir el tipo:\n   - Lun-Jue: prellena "Buffet completo" automáticamente\n   - Vie-Dom: te pregunta "Desayuno" o "Comida"\n4. Captura el folio del POS (si aplica).\n5. Confirma — la bitácora queda **abierta** y lista para registrar.\n\n## Qué se prellena solo\n\n- **Las tarifas** según el día y el servicio (sabe que Buffet completo es $590 adulto, Desayuno es $299, etc.)\n- **Las reservas del día** se cargan automáticamente como filas **"En espera"** (ya tienen reservación, falta que lleguen físicamente).\n- **Hora de entrada** se captura cuando agregas el primer walk-in.\n\n## Estados de cada fila\n\n- **🔴 Ocupada** — el grupo está sentado consumiendo\n- **⏳ En espera** — reserva confirmada pero el cliente aún no llega\n- **✨ Desocupada** — el grupo ya se fue, mesa lista para limpiar\n- **❌ Cancelada** — reserva que no llegó (no suma en totales)\n\n## Reglas importantes\n\n- **No abras dos bitácoras al mismo tiempo** del mismo servicio. Si ya abrió Marisol, captura tú en esa.\n- Si te equivocaste de tipo de servicio, avisa a Mónica para corregir desde admin.',
        quiz: [
          { pregunta:'En fines de semana, ¿cuántas bitácoras se abren al día?',
            a:'Una sola para todo el día', b:'Tres: Desayuno, Brunch y Comida', c:'Ninguna — el fin de semana es manual', d:'Dos: una para Desayuno y otra para Comida',
            correcta:'d', explicacion:'Vie-Dom hay dos servicios separados (Desayuno + Comida) = dos bitácoras.' },
          { pregunta:'Las reservas del día, ¿qué estado tienen al cargar la bitácora?',
            a:'Ocupada (ya están en el sistema)', b:'En espera (porque aún no llega físicamente el cliente)', c:'Cancelada por defecto hasta confirmación', d:'Desocupada hasta que llegue el cliente',
            correcta:'b', explicacion:'En espera = ya tienen reserva, falta que lleguen físicamente.' },
          { pregunta:'¿Qué tarifa prellena el sistema en Buffet completo Lun-Jue?',
            a:'$249 adulto (tarifa niño)', b:'$299 adulto (tarifa de desayuno)', c:'$590 adulto', d:'Vacío, el host debe capturarlo',
            correcta:'c', explicacion:'Lun-Jue Buffet $590 adulto. Niño 6-10 $249.' }
        ],
        minAprobatorio: 3
      },
      // ---------- Módulo 4: Plano del salón ----------
      {
        titulo: 'Plano del salón y asignación de mesas',
        resumen: 'Cómo usar el plano visual para ver el estado de las mesas y asignar grupos.',
        tiempo: 7,
        contenido: '## El Plano del salón\n\nDesde la bitácora, hay un botón **"📐 Plano del salón"** que abre un mapa visual con TODAS las mesas y su estado actual:\n\n- 🟢 **Verde "✓ LIBRE"** — mesa disponible para nuevo grupo\n- 🟠 **Naranja "🔴 OCUPADA"** — grupo activo en la mesa (muestra nombre, pax, hora entrada)\n- 🟡 **Ámbar "⏳ EN ESPERA"** — reserva confirmada, llega pronto\n- 🔵 **Teal "✨ DESOCUPADA"** — el grupo ya salió, hay que limpiar antes de reasignar\n\n## Zonas\n\nLas mesas están agrupadas por zona (Salón principal, Terraza, etc.). Cada zona tiene un encabezado con resumen: cuántas libres, cuántas ocupadas, cuántas en espera.\n\nEsto te ayuda a decir rápido: *"En terraza hay 4 mesas libres"* sin contar.\n\n## Asignar mesa a un walk-in (manera 1: desde el plano)\n\n1. Tap en una **mesa libre**.\n2. El sistema te pregunta cuántas personas vienen.\n3. Captura el número.\n4. Si es más gente de la capacidad de la mesa, te pide confirmar.\n5. Tap OK → se crea una fila nueva con la mesa asignada y el número de adultos prellenado.\n\n## Asignar mesa a un walk-in (manera 2: desde la tabla)\n\n1. Tap **"+ Agregar fila"** en la bitácora.\n2. Captura adultos/niños.\n3. **Aparece un botón naranja "💡 Mesa X (cap Y)"** — es la sugerencia automática (la mesa más chica disponible que les cabe).\n4. Tap en la sugerencia → se asigna automáticamente.\n\n## Tiempo promedio "⏱"\n\nCada tarjeta muestra el tiempo promedio que dura un grupo en esa mesa (calculado del histórico de 60 días). Útil para predecir cuándo se libera.',
        quiz: [
          { pregunta:'¿Qué color y texto aparece en una mesa que acaba de salir el grupo?',
            a:'Verde "✓ LIBRE" — pasa directo a libre', b:'Teal/azul "✨ DESOCUPADA"', c:'Rojo "Cerrada" hasta que llegue el siguiente grupo', d:'Gris sin texto (pendiente de limpieza)',
            correcta:'b', explicacion:'Cuando se captura hora de salida, la mesa pasa a teal "Desocupada" para limpiar y reasignar.' },
          { pregunta:'En la sugerencia automática "💡 Mesa X", ¿qué criterio usa el sistema?',
            a:'Aleatorio entre las mesas libres', b:'La mesa más chica disponible que cabe al grupo (no desperdicia mesas grandes)', c:'La primera mesa por orden de ID de mesa', d:'La mesa más nueva instalada en el salón',
            correcta:'b', explicacion:'Optimización: deja libres las mesas grandes para grupos más numerosos.' },
          { pregunta:'Si tap una mesa libre en el plano y dices "vienen 6", ¿qué pasa si la mesa es para 4?',
            a:'Lo asigna directo sin avisar — el host es responsable', b:'Te pide confirmar (advertencia: "Esta mesa es para 4, ¿asignar igual?")', c:'Lo rechaza automáticamente y no puedes asignarla', d:'Crea una nueva silla virtual para completar',
            correcta:'b', explicacion:'Te avisa por si quieres revisar otra mesa más grande, pero te deja decidir.' }
        ],
        minAprobatorio: 3
      },
      // ---------- Módulo 5: Walk-ins ----------
      {
        titulo: 'Walk-ins: capturar grupos en vivo',
        resumen: 'Cómo registrar grupos que llegan sin reserva, manejar tarifas, niños y cortesías.',
        tiempo: 8,
        contenido: '## Qué es un walk-in\n\nUn cliente que llega **sin reserva**. Se captura directo en la bitácora.\n\n## Pasos de captura\n\n1. Tap **"+ Agregar fila"** o asigna desde el plano.\n2. Captura **mesa**.\n3. Captura **adultos** (todos los de 11+ años).\n4. Captura **niños** (6-10 años — pagan tarifa niño $249).\n5. Captura **3a edad** si aplica (mismo precio adulto pero se separa para análisis).\n6. **Cortesías** (niños 0-5, autorizadas por gerente, etc.) — captura en la columna corte y pon AUTORIZA.\n7. **Origen**: Walk-in (default) o Reserva si vino con reserva.\n8. **Nombre del cliente** (opcional pero útil para ubicarlo).\n9. **Encuesta**: pregunta al final si la quieren contestar (opcional).\n\n## Mapeo de edades CRÍTICO\n\n| Edad | Tarifa |\n|------|--------|\n| 0-5 años | **Cortesía** (no pagan) |\n| 6-10 años | **Tarifa niño** ($249) |\n| **11+ años** | **Tarifa adulto** ($590 / $299 según servicio) |\n\nUn niño de 11 años PAGA TARIFA ADULTO. No te confundas.\n\n## Cortesías\n\nSolo dos personas pueden autorizar cortesías:\n\n- **Gerente Administrativo** (Mónica)\n- **Gerente de Restaurante** (Gabriel)\n\nEn la columna "AUTORIZA" debes seleccionar uno de los dos del menú desplegable. Si capturas una cortesía sin autorización, queda como **bandera roja** al cierre.\n\nLas cortesías de niños 0-5 son automáticas (no requieren firma de gerente).\n\n## Editar detalles de una fila\n\nTap el botón **✎** en la fila para abrir detalles: teléfono, observaciones, ticket POS, motivo de cortesía, etc.\n\n## Eliminar una fila\n\nTap **×** en la fila → el sistema te pide un **motivo de mínimo 5 caracteres**. Esto evita borrados accidentales y queda en auditoría.\n\n## Cancelar / No llegó\n\nSi cambias el estado a "Cancelada" o "No llegó", también te pide motivo.',
        quiz: [
          { pregunta:'Un niño de 11 años, ¿qué tarifa paga?',
            a:'Cortesía', b:'Tarifa niño $249', c:'Tarifa adulto ($590 o $299 según servicio)', d:'$199',
            correcta:'c', explicacion:'A partir de 11 años se paga TARIFA ADULTO. Solo 6-10 paga tarifa niño.' },
          { pregunta:'¿Quiénes son las únicas personas autorizadas para firmar cortesías?',
            a:'Cualquier host', b:'Gerente Administrativo (Mónica) y Gerente de Restaurante (Gabriel)', c:'La cajera', d:'Cocina',
            correcta:'b', explicacion:'Solo Mónica y Gabriel. Sin firma del autoriza = bandera roja al cierre.' },
          { pregunta:'¿Las cortesías de niños 0-5 años requieren firma de gerente?',
            a:'Sí, siempre', b:'No, son cortesías automáticas por edad', c:'Solo en domingo', d:'Solo arriba de 3 niños',
            correcta:'b', explicacion:'0-5 años es cortesía automática (no pagan). No requiere firma.' },
          { pregunta:'Para eliminar una fila, ¿qué te pide el sistema?',
            a:'Nada, se borra al instante', b:'Motivo de mínimo 5 caracteres (queda en auditoría)', c:'Tu contraseña', d:'Llamar a Mónica',
            correcta:'b', explicacion:'Soft-delete con motivo para evitar borrados accidentales y para auditoría.' },
          { pregunta:'En la sugerencia automática de mesa, si llega un grupo de 4, ¿qué mesa NO te recomendará?',
            a:'Mesa de 4', b:'Mesa de 6', c:'Mesa de 2 (no cabe)', d:'Mesa de 8',
            correcta:'c', explicacion:'El sistema filtra solo mesas con capacidad ≥ pax. Una mesa de 2 no cabe a 4 personas.' }
        ],
        minAprobatorio: 4
      },
      // ---------- Módulo 6: CIERRE DEL SERVICIO (CRÍTICO) ----------
      {
        titulo: '⚠ Cierre del servicio (CRÍTICO)',
        resumen: 'Cómo cerrar correctamente la bitácora al final del servicio. Lo más importante del curso.',
        tiempo: 12,
        contenido: '## Por qué este módulo es CRÍTICO\n\nEl cierre es donde todo lo capturado **se valida**: tarifas, cortesías, mesas, totales. Un cierre mal hecho = un cierre con errores que la cajera no podrá conciliar y banderas rojas para auditoría.\n\nLee con calma. Los errores aquí cuestan dinero al restaurante.\n\n## Pasos del cierre — orden correcto\n\n### 1. Verifica que TODAS las filas activas tengan hora de salida\n\nAntes de cerrar, recorre la tabla. Cada fila **Ocupada** debe tener **hora_sal** capturada cuando ese grupo se fue. Si quedan filas sin hora_sal, el sistema te avisa.\n\nTip: cuando capturas hora_sal, el estado pasa **automáticamente** a "Desocupada" (verde teal). No tienes que cambiarlo manualmente.\n\n### 2. Marca como "No llegó" las reservas que no llegaron\n\nSi quedan reservas en **"En espera"** (amarillas) y nunca llegaron, cámbialas a **"No llegó"** capturando un motivo (ej: "no contestó WhatsApp"). NO las dejes en "En espera" porque sumarán al total cuando no deberían.\n\n### 3. Verifica las cortesías\n\nCada fila con valor en **corte** (cortesía) debe tener:\n- **AUTORIZA** lleno (Mónica, Gabriel, o "Bebé/niño 0-5")\n- **Folio del ticket POS** (si aplica)\n- **Motivo** (en observaciones si fue por queja, evento, etc.)\n\nSi alguna cortesía está sin autorizante, el sistema lo marca como **bandera roja**. La cajera no podrá cerrar limpio.\n\n### 4. Captura tu sello de cierre\n\nEn la sección de cierre de la bitácora hay un **sello autenticado del host**. Debes firmarlo desde TU cuenta — no se puede firmar por otro.\n\nEl sistema registra: tu user_id, tu email, fecha y hora exacta. Es prueba de que tú revisaste y validaste.\n\n### 5. Para fines de semana: cierra Desayuno y abre Comida\n\nVie-Dom hay 2 servicios. Al final del Desayuno (12pm):\n\n1. Cierra la bitácora de Desayuno (todos los pasos anteriores).\n2. Abre **NUEVA bitácora de Comida** (no sigas en la misma).\n\nSon servicios independientes con tarifas distintas ($299 desayuno vs $590 comida).\n\n### 6. Antes de irte\n\nVerifica el **mini-resumen del salón**: ¿cuántas mesas quedaron libres / ocupadas / en espera? Idealmente, al cierre todas deberían estar en **Libre o Desocupada**. Si queda algo en "En espera" u "Ocupada", revisa y corrige.\n\n## Banderas rojas comunes (evítalas)\n\n- ❌ Cortesía sin **autoriza**\n- ❌ Cortesía sin **folio**\n- ❌ Filas Ocupadas sin **hora_sal** al cierre\n- ❌ Reservas en "En espera" que ya no van a llegar\n- ❌ Sello de cierre sin firmar\n\n## Si te equivocaste\n\nLas filas se pueden editar el mismo día. Después del cierre, solo el admin puede modificar (con motivo en auditoría). Por eso es **importante revisar antes de firmar**.\n\n## Resumen para llevarte\n\n1. **Hora_sal** en todas las activas\n2. **No-shows** marcados con motivo\n3. **Cortesías** con autoriza + folio\n4. **Tu sello** firmado desde tu cuenta\n5. Para fines de semana: **cerrar Desayuno → abrir nueva bitácora de Comida**',
        quiz: [
          { pregunta:'Al capturar hora_sal en una fila Ocupada, ¿qué pasa con el estado?',
            a:'Hay que cambiarlo manualmente a "Desocupada"', b:'Pasa automáticamente a "Desocupada" (azul teal)', c:'Pasa a "Cancelada" y ya no cuenta en el historial', d:'No cambia — queda en Ocupada hasta que limpies la mesa',
            correcta:'b', explicacion:'Auto-cambio: capturar hora_sal en Ocupada → Desocupada. Señal visual de que se libera la mesa.' },
          { pregunta:'En fin de semana, al terminar el Desayuno (12pm), ¿qué se hace?',
            a:'Continúas capturando la Comida en la misma bitácora', b:'Cierras la bitácora de Desayuno y abres una NUEVA de Comida', c:'No haces nada — el sistema lo detecta solo por la hora', d:'Borras todo y empiezas de cero',
            correcta:'b', explicacion:'Servicios independientes con tarifas distintas. Cada uno tiene su propia bitácora.' },
          { pregunta:'Una cortesía SIN nombre del autorizante en la columna AUTORIZA, ¿qué efecto tiene al cierre?',
            a:'Ninguno — el sistema la acepta igual', b:'Bandera roja (la cajera no puede cerrar limpio hasta resolverla)', c:'Se cobra directamente al cliente como si fuera tarifa normal', d:'Se borra automáticamente para no afectar el arqueo',
            correcta:'b', explicacion:'Toda cortesía debe llevar autorizante (Mónica, Gabriel, o Bebé 0-5). Sin firma = bandera roja.' },
          { pregunta:'¿Tu sello de cierre lo puede firmar otra persona desde su cuenta?',
            a:'Sí, cualquier host puede firmar por otro si están en el mismo turno', b:'No: cada quien firma desde SU cuenta autenticada (queda con tu user_id y email)', c:'Solo Mónica como gerente puede firmarlo por ti', d:'Solo puede hacerlo los lunes con autorización especial',
            correcta:'b', explicacion:'Sellos autenticados: imposible firmar por otro. Garantía de auditoría.' },
          { pregunta:'Una reserva quedó en "En espera" pero ya pasaron 2 horas y no llegó. ¿Qué haces antes de cerrar?',
            a:'La dejas como "En espera" — no importa para el total', b:'La eliminas del sistema para que no aparezca', c:'No haces nada — el sistema la detecta solo como expirada', d:'La cambias a "No llegó" capturando un motivo',
            correcta:'d', explicacion:'Si la dejas en "En espera" suma al total. Cámbiala a "No llegó" con motivo para que NO sume.' }
        ],
        minAprobatorio: 4
      }
  ];
}

// Módulos EXTRA para el rol Gerente de Restaurante (Gabriel).
// Vienen DESPUÉS de los 6 del host (que el gerente también debe dominar).
// Énfasis en: cortesías que él autoriza, override de sellos, supervisión, cierre profundo.
function modulosExtraGerenteRestaurante() {
  return [
    // ---------- Módulo 7: Cortesías y autorizaciones ----------
    {
      titulo: '⭐ Cortesías y autorizaciones (tu firma)',
      resumen: 'Tú eres uno de los DOS autorizados para firmar cortesías. Cuándo decir sí, cuándo decir no, y cómo se registra.',
      tiempo: 9,
      contenido: '## Tu rol como Gerente de Restaurante\n\nA partir de aquí los módulos son específicos de **tu responsabilidad como gerente**. Como gerente, tienes una autoridad que el host no tiene: **firmar cortesías**.\n\n## Quiénes pueden autorizar cortesías en Fogueira\n\nSolo **DOS personas**:\n\n- **Gerente Administrativo** (Mónica)\n- **Gerente de Restaurante** (tú, Gabriel)\n\nNadie más. Ni los hosts, ni la cajera, ni cocina. Si un host registra una cortesía en bitácora, **DEBE poner tu nombre o el de Mónica** en la columna "Autoriza". Si no, el sistema lo marca como **bandera roja** al cierre y la cajera no podrá conciliar limpio.\n\n## Cuándo SÍ firmar una cortesía\n\nLos casos legítimos típicos:\n\n- **Queja del cliente** validada (servicio lento, error en cuenta, comida no apta)\n- **Error operativo** del restaurante (mesa equivocada, espera excesiva por culpa nuestra)\n- **Detalle por evento** (cumpleaños, aniversario — conforme a la política Fogueira)\n- **Cortesía a invitados de la dirección** (autorizada formalmente por Mónica o Germán)\n- **Cliente VIP recurrente** con descuento aprobado\n\n## Cuándo NO firmar (bandera roja inmediata)\n\n- Por **presión social** del cliente o "amistad" del cuate\n- **Sin motivo documentable**\n- Para "cubrir" un error que se puede cobrar normal\n- **Cortesías masivas** sin autorización de Mónica para grupos grandes\n- Cuando el cliente lo pide directo "porque sí"\n\n## Cómo se registra una cortesía\n\nEl host es quien captura, pero **debe llevar 3 datos**:\n\n| Dato | Quién lo pone | Por qué |\n|------|---------------|---------|\n| **Autoriza** (tu nombre) | Host selecciona del menú | Trazabilidad: quién aprobó |\n| **Folio del ticket POS** | Host del ticket físico | Cruzar con el POS al cierre |\n| **Motivo** (en observaciones) | Host con tu indicación | Justificación para auditoría |\n\nSi falta cualquiera de los tres, la cajera reportará bandera roja al cierre.\n\n## Cortesías automáticas (sin tu firma)\n\nLas únicas que NO requieren tu firma son:\n\n- **Niños 0-5 años** — son cortesía automática por edad (no pagan, no necesitan autorización)\n\nTodo lo demás (queja, evento, descuento) requiere tu firma o la de Mónica.\n\n## Auditoría — qué pasa con lo que firmas\n\n- Cada cortesía con tu nombre queda en la bitácora\n- Al cierre del día se contabilizan en la conciliación\n- Auditoría revisa **periódicamente** las cortesías firmadas (cuántas, motivos repetidos, montos)\n- Si Mónica detecta un patrón sospechoso, te lo platica\n\n## Recomendación práctica\n\n- **Sé visible** en piso durante los servicios pico (3pm-6pm). Las quejas se atajan rápido si tú estás presente.\n- **Documenta el motivo verbalmente** al host cuando autorices ("escribe: error de cocina, plato 20 min tarde")\n- **Si tienes duda, llama a Mónica** antes de firmar. Mejor consultar que arrepentirse.\n- **No firmes cortesías genéricas** ("descuento por buen cliente") — siempre debe haber un evento específico.',
      quiz: [
        { pregunta:'¿Quiénes son los DOS únicos autorizados para firmar cortesías en Fogueira?',
          a:'Cualquier gerente del Grupo TODA', b:'Gerente de Restaurante (tú) y Gerente Administrativo (Mónica)', c:'La cajera y el host más antiguo', d:'Tú y el chef',
          correcta:'b', explicacion:'Solo Gabriel (tú) y Mónica. Es el control más importante para evitar fraude operativo.' },
        { pregunta:'Una cortesía DEBE llevar 3 datos para evitar bandera roja al cierre. ¿Cuáles son?',
          a:'Solo el monto', b:'Autoriza (tu nombre), folio del ticket POS y motivo en observaciones', c:'Solo nombre del cliente', d:'Mesa, hora y descuento',
          correcta:'b', explicacion:'Trazabilidad: quién aprobó + cruce con POS + justificación. Sin uno de los tres, la cajera reporta bandera.' },
        { pregunta:'¿Qué cortesías NO requieren tu firma?',
          a:'Las de fin de semana', b:'Solo las de niños 0-5 años (cortesía automática por edad)', c:'Las menores a $200', d:'Las que pide directamente el cliente',
          correcta:'b', explicacion:'0-5 años es cortesía automática. Todo lo demás (queja, evento, descuento) requiere tu firma o la de Mónica.' },
        { pregunta:'Un host te dice: "El cliente está pidiendo descuento porque viene seguido". ¿Qué haces?',
          a:'Firmas sin pensarlo', b:'NO firmas — no hay motivo documentable. Le explicas cordialmente al cliente que no aplica', c:'Le pasas la firma a la cajera', d:'Lo dejas pasar como cortesía automática',
          correcta:'b', explicacion:'"Cliente recurrente" sin política formal NO es motivo. Solo Mónica puede aprobar descuentos por VIP recurrente con política definida.' },
        { pregunta:'Si firmas una cortesía sin motivo justificable y auditoría detecta el patrón, ¿qué pasa?',
          a:'Nada, eres gerente', b:'Mónica te lo platica; queda en auditoría tu firma con el dato sospechoso (es trazable)', c:'Se elimina sola', d:'Solo aplica al host',
          correcta:'b', explicacion:'Cada cortesía con tu nombre queda registrada. Auditoría revisa patrones (motivos repetidos, montos altos). Trazabilidad personal.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 8: Override admin de sellos ----------
    {
      titulo: '🔐 Override admin de sellos',
      resumen: 'Cuándo y cómo firmar un sello por otra persona (con motivo). Excepción auditable.',
      tiempo: 7,
      contenido: '## Qué es un sello\n\nUn **sello** es la firma autenticada de un usuario en un momento específico de un servicio. El sistema registra automáticamente: tu user_id, email, rol, fecha y hora exacta. Es **prueba digital** de que esa persona revisó/validó algo.\n\n## Sellos del cierre — quién firma cada uno\n\nUn cierre típico tiene varios sellos esperados:\n\n| Sello | Quién firma |\n|-------|-------------|\n| Apertura · Host | Host de turno |\n| Apertura · Cajera | Cajera del turno |\n| Apertura · Cocina | Cocinero principal |\n| Apertura · Churrasca | Churrasquero |\n| Cierre · Host | Host (después de revisar bitácora) |\n| Cierre · Cajera | Cajera (después de conciliar) |\n\nCada uno firma desde **SU sesión activa**. Es imposible firmar por otro desde la pantalla normal.\n\n## Qué es un "override admin"\n\nUn override es una **firma de excepción** que tú puedes hacer **por otra persona** cuando hay imposibilidad operativa. Por ejemplo:\n\n- La **cajera cerró sesión** y se fue, y le faltó firmar el cierre\n- La **cocina olvidó firmar** la apertura y ya está en otro turno\n- **Falla de internet** en la sesión del host justo en el momento de firmar\n- El usuario está enfermo y nadie del rol está disponible\n\nEn esos casos, tú entras a la conciliación y haces override del sello pendiente.\n\n## Cómo se hace\n\n1. Entra al módulo **Conciliación** del día\n2. En la sección **05 (Sellos)** verás un tablero "Esperados vs Hechos"\n3. Identifica el sello pendiente (en rojo)\n4. Tap **"Override"** en ese sello\n5. **Captura un motivo** (mínimo 5 caracteres) explicando por qué tú firmas en lugar del responsable\n6. El sistema guarda con `es_override = true` + tu identidad + el motivo\n\n## Reglas de oro del override\n\n### NUNCA usar override para:\n\n- ❌ "Saltarse" controles (firmar sin revisar realmente)\n- ❌ Cubrir a alguien que olvidó firmar **por flojera** (mejor exigirle que entre y firme)\n- ❌ Cierres con banderas rojas sin resolver\n- ❌ Sin un motivo real (escribir "varios" o "ok" no cuenta)\n\n### SIEMPRE usar override:\n\n- ✓ Cuando es **realmente** imposible que la persona firme (turno cambiado, sesión cerrada, etc.)\n- ✓ **Documentando el motivo** específico: "cajera salió enferma a las 9pm, no pudo firmar cierre"\n- ✓ Después de **verificar tú mismo** lo que estás validando (no firmes a ciegas)\n\n## Auditoría revisa los overrides\n\n- Cada override queda con flag `es_override = true` y tu nombre + motivo\n- Mónica y auditoría **revisan periódicamente** los overrides\n- Si hay muchos overrides en poco tiempo → señal de problema operativo\n- Si los motivos son débiles → te lo platica\n\n## Recomendación\n\n- **Override = última opción**. Antes intenta que la persona firme aunque sea remoto\n- Si tienes que hacer override, **escribe motivo claro y verificable**\n- Mensual, revisa con Mónica los overrides del mes para detectar patrones\n- Si Yazmín o Marisol olvidan firmar seguido, no hagas override repetido — capacítalas otra vez',
      quiz: [
        { pregunta:'¿Qué es un override admin de sello?',
          a:'Una firma falsa', b:'Una firma de excepción donde tú firmas por otra persona, con motivo registrado en auditoría (es_override=true)', c:'Borrar un sello', d:'Cambiar la hora de un sello',
          correcta:'b', explicacion:'Override es excepción documentada. Queda registrado tu nombre, fecha y motivo para auditoría.' },
        { pregunta:'¿Cuál NO es un uso válido del override?',
          a:'Cajera salió enferma sin firmar cierre', b:'Falla de internet en la sesión del host', c:'Cocina olvidó firmar por flojera (puede entrar a firmar)', d:'Cocina ya cerró sesión y se fue del restaurante',
          correcta:'c', explicacion:'Si la persona PUEDE firmar (está disponible), debe firmar ella. Override solo cuando es imposible.' },
        { pregunta:'¿Qué información se guarda en un override?',
          a:'Solo la fecha', b:'Flag es_override=true, tu identidad (user_id, email, rol), fecha/hora exacta, y el motivo escrito', c:'Solo el motivo', d:'Nada, es anónimo',
          correcta:'b', explicacion:'Trazabilidad completa para auditoría. Imposible firmar override sin dejar huella.' },
        { pregunta:'Si hay un cierre con BANDERAS ROJAS sin resolver (cortesías sin folio, diferencias en arqueo), ¿debes hacer override del sello de la cajera?',
          a:'Sí, para cerrar el día', b:'NO. Las banderas se resuelven primero; override no debe usarse para "saltarse" controles', c:'Solo si Mónica te llama', d:'Sí, pero documenta',
          correcta:'b', explicacion:'Override no es atajo. Las banderas son señales que requieren explicación humana antes de firmar — incluso por override.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 9: Supervisión del piso ----------
    {
      titulo: '👁️‍🗨️ Supervisión del piso',
      resumen: 'Tu rol coordinando hosts, cocina, cajera, encargado de piso. Resolución de conflictos en tiempo real.',
      tiempo: 8,
      contenido: '## Tu posición en el organigrama\n\n```\nDirección (Germán + Mónica)\n          ↓\n  Tú (Gerente de Restaurante)\n          ↓\nEncargado de Piso → Hosts, meseros\nCocina + Churrasca\nCajera\n```\n\nTu rol es **operativo-supervisor**: estás en piso, ves todo, coordinas. No es solo "estar de adorno" — eres la primera línea de decisión cuando algo no fluye.\n\n## Tus 4 tableros principales del sistema\n\nDurante un servicio activo, **monitorea continuamente**:\n\n1. **Plano del salón** (en bitácora) — cuántas mesas libres, ocupadas, en espera\n2. **Reservaciones** del día — quién falta por llegar, quién está atrasado\n3. **Bitácora del servicio** — capturas en vivo de hosts, cortesías\n4. **Charolas** (cocina/churrasca) — qué está saliendo al buffet\n\nNo necesitas estar pegado al sistema, pero cada 15-20 min revisa.\n\n## Conflictos típicos y cómo resolverlos\n\n### Cliente esperando demasiado\n- Verifica el plano: ¿hay mesa libre que no se asignó?\n- Habla con la host: ¿hay reserva pendiente que llegue ya?\n- **Decisión rápida**: asigna mesa más chica si hay disponible, o explica honestamente al cliente cuánto le falta\n- Si la espera fue **culpa nuestra** (mesa libre no asignada por descuido) → considera firmar una cortesía pequeña como gesto\n\n### Mesa atorada (lleva mucho tiempo sin cerrar)\n- Revisa el plano — ¿lleva más del promedio histórico (⏱)?\n- Acércate sutil al equipo de la mesa: ¿ya pidieron cuenta? ¿esperan postre?\n- **Nunca apresures al cliente directamente**. Coordina con el host para destrabar.\n\n### Walk-in grande sin reserva\n- Ve al plano: ¿tienes 1-2 mesas grandes contiguas?\n- ¿Puedes juntar mesas físicas?\n- Si NO cabe → explica al cliente con honestidad y sugiere hora alternativa o reserva para otro día\n- **NO bloquees mesas reservadas** para acomodar walk-ins grandes\n\n### Reclamo del cliente sobre la comida\n- Escucha primero, no defiendas\n- Si tiene razón → **autoriza cortesía** o reposición (módulo de cortesías)\n- Si no tiene razón → **escucha igual**, ofrece detalle pequeño (postre cortesía) y documenta\n- Notifica a cocina si hay un problema de calidad recurrente\n\n### Equipo en conflicto interno (host vs cocina, etc.)\n- **Resuelve en piso**, no en frente del cliente\n- Identifica el origen del bloqueo\n- Si es operativo → tú decides\n- Si involucra **dinero o políticas** → escala a Mónica\n\n## Cuándo escalar a Mónica\n\nEscala SIEMPRE estos casos:\n\n- **Pérdida material** (caída de bandeja con mucha mercancía, accidente con cliente)\n- **Reclamo legal o sanitario** (cliente alega intoxicación, lesión)\n- **Cortesías masivas** (>5 cortesías en un grupo grande)\n- **Decisiones financieras** fuera de tu autoridad\n- **Conflictos con personal** que ameriten amonestación\n- Cualquier cosa que **pueda dañar la imagen** del restaurante\n\n## Tu sello al cierre\n\nAunque eres gerente, tu sello específico (Cierre · Host) lo firma quien estuvo de host ese día. **Tu rol al cierre es supervisar, no firmar todos los sellos**.\n\nSin embargo, cuando hagas override (módulo anterior), tu sello queda registrado por encima.\n\n## Hábito recomendado\n\nAl final de cada servicio (antes de irte), **revisa 3 cosas en el sistema**:\n\n1. **Bitácora del día** — ¿tiene cortesías raras? ¿faltan hora_sal?\n2. **Plano del salón** — ¿quedaron mesas en "Ocupada" sin cerrar?\n3. **Tablero de sellos** — ¿hay rojos pendientes que mañana auditoría reportará?\n\nSi hay algo raro, resuélvelo o escala. **No dejes problemas operativos para el día siguiente.**',
      quiz: [
        { pregunta:'Durante un servicio activo, ¿qué tableros del sistema debes monitorear continuamente?',
          a:'Solo el menú', b:'Plano del salón, Reservaciones del día, Bitácora del servicio, Charolas (cocina/churrasca)', c:'Solo la caja', d:'Ninguno, ese es trabajo del host',
          correcta:'b', explicacion:'Tus 4 tableros: ocupación visual, llegadas pendientes, capturas en vivo, salidas de buffet.' },
        { pregunta:'Un cliente espera demasiado por culpa nuestra (había mesa libre no asignada por descuido). ¿Qué haces?',
          a:'Le ignoras', b:'Considera firmar una cortesía pequeña como gesto, y ajusta con la host para que no se repita', c:'Le pides que se vaya', d:'Discutes con la host enfrente del cliente',
          correcta:'b', explicacion:'Reconocimiento del error + acción concreta. Las correcciones se discuten DESPUÉS, no enfrente del cliente.' },
        { pregunta:'¿Cuál de estos casos SIEMPRE debes escalar a Mónica?',
          a:'Cualquier cosa pequeña', b:'Reclamo legal o sanitario (cliente alega intoxicación), pérdidas materiales mayores, decisiones financieras grandes', c:'Reservas online', d:'Walk-ins normales',
          correcta:'b', explicacion:'Lo legal, financiero grande o que dañe imagen va a Mónica. Lo operativo del día tú lo manejas.' },
        { pregunta:'Antes de irte al cierre del día, ¿qué hábito recomendado tienes?',
          a:'Salir corriendo', b:'Revisar 3 cosas: bitácora (cortesías, hora_sal), plano (mesas sin cerrar), sellos (pendientes)', c:'Apagar el sistema', d:'Llamar a todos los clientes',
          correcta:'b', explicacion:'No dejes problemas operativos para el día siguiente. Si hay algo raro, resuélvelo o escala antes de irte.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 10: Cierre profundo y conciliación (CRÍTICO) ----------
    {
      titulo: '⚠ Cierre profundo y conciliación (CRÍTICO)',
      resumen: 'Lo más importante de tu rol: supervisar el cierre del día, validar banderas rojas, autorizar antes de que la cajera firme.',
      tiempo: 13,
      contenido: '## Por qué este módulo es CRÍTICO\n\nEl cierre del día NO es solo trabajo de la cajera. **Tú supervisas**. Si la cajera firma con banderas rojas y al día siguiente Mónica las descubre → la responsabilidad es compartida pero **principalmente tuya** por no haber supervisado.\n\nLee este módulo con calma. Es el más importante de tu curso.\n\n## Cuándo aplica tu supervisión del cierre\n\n- **Lun–Jue**: 1 cierre al día (al terminar el Buffet completo)\n- **Vie–Dom**: 2 cierres (Desayuno y Comida — cada uno tiene su propia conciliación)\n\n## El módulo Conciliación — qué tiene\n\nLa cajera entra a **Conciliación** del día y captura:\n\n1. **Apertura**: efectivo inicial en caja, cambio\n2. **Cierre profundo**: corte de caja por denominación, tarjetas (Débito, MC, AMEX, Visa), cortesías, **dos depósitos a tesorería** (venta del día + comisiones bancarias)\n3. **Resumen**: arqueo ciego (sistema compara contado vs teórico)\n\n## Banderas rojas que TÚ debes revisar\n\nAntes de que la cajera firme su sello, **acompáñala** y revisa estos puntos:\n\n### 1. Cortesías\n- ¿Cada cortesía tiene **autoriza** lleno (tu nombre o el de Mónica)?\n- ¿Cada una tiene **folio del ticket POS**?\n- ¿Hay alguna cortesía **sin motivo** o con motivo débil?\n- **Si hay una cortesía con tu nombre que TÚ no firmaste** → bandera roja gravísima (alguien la inventó). Reportar a Mónica.\n\n### 2. Arqueo de caja\n- ¿El **efectivo contado** coincide con el teórico?\n- Si hay **faltante** (lo contado < teórico) → ¿de cuánto? Si es <$50, generalmente es error de cambio. Si es más, investigar.\n- Si hay **sobrante** (contado > teórico) → también investigar; un sobrante grande puede ser tickets no capturados.\n\n### 3. Tarjetas\n- ¿La suma de tarjetas (Débito + MC + AMEX + Visa) coincide con el reporte del POS?\n- Si hay diferencia → algún cobro no se aplicó bien o se duplicó\n\n### 4. Depósitos a tesorería\n- ¿Se hicieron **los DOS depósitos**? (venta del día + comisiones bancarias)\n- ¿Coincide la suma con lo capturado?\n- Si falta uno → completar antes de firmar\n\n### 5. Sellos pendientes\n- ¿Está el sello de **Apertura · Host**? ¿Y los de cocina/churrasca?\n- ¿Está el **Cierre · Host**?\n- Si falta alguno → contactar a la persona o hacer override (con motivo válido)\n\n## El protocolo de cierre que recomiendo\n\n1. **30 min antes del cierre**, ve al sistema y revisa la bitácora del día\n2. Identifica si hay **walk-ins atípicos**: filas sin nombre, mesas raras, cortesías sin tu firma\n3. Cuando la cajera empiece a conciliar, **siéntate con ella** y supervisa\n4. **No la apures**. Es mejor 30 min de cierre limpio que 10 min con banderas\n5. Si hay banderas, **resuelvan juntos** antes de firmar\n6. Una vez todo limpio → **ella firma** su sello desde su sesión\n7. Tú revisas el resumen final y, si todo OK → **te despides hasta mañana**\n\n## NO firmes la conciliación si\n\n- ❌ Hay banderas rojas sin explicación\n- ❌ Faltan sellos sin motivo claro\n- ❌ El arqueo tiene diferencia significativa (>$200) sin explicación\n- ❌ Falta uno de los dos depósitos a tesorería\n- ❌ Una cortesía con tu nombre que tú no firmaste (¡reporta!)\n\n## Si hay banderas que no se pueden resolver\n\n- Si es **operativo** y se puede arreglar al día siguiente: documenta en observaciones, escala a Mónica por WhatsApp\n- Si es **dinero faltante grave** (>$1000): contacta a Mónica AHORA, no esperes\n- Si es **fraude sospechado** (cortesía falsificada): documenta y escala inmediato\n\n## Tu sello como supervisor\n\nTu sello específico de gerente NO es un sello obligatorio del cierre (los obligatorios son host, cajera, cocina, churrasca). PERO:\n\n- Cuando haces **override** de un sello faltante, tu firma queda registrada\n- Cuando autorizas cortesías, tu nombre queda en cada una\n- Auditoría revisa estos rastros para verificar que supervisaste\n\n## Hábitos para nunca olvidar\n\n1. **Cada cierre que se firma con tu visto bueno → te lleva a un día tranquilo mañana**\n2. **Cada bandera ignorada → te lleva a un problema más grande mañana** (Mónica, auditoría, dirección)\n3. **El tiempo invertido en cierre profundo es la mejor inversión** del día\n4. Si te tienes que ir antes del cierre por una emergencia → **avisa a Mónica** y deja por escrito qué quedó pendiente',
      quiz: [
        { pregunta:'¿Cuántos cierres hay en fin de semana en Fogueira?',
          a:'1 (todo el día)', b:'2 (Desayuno y Comida — cada uno con su propia conciliación)', c:'3', d:'Ninguno',
          correcta:'b', explicacion:'Vie-Dom hay dos servicios independientes con tarifas distintas, cada uno con su cierre.' },
        { pregunta:'¿Cuáles son los 5 puntos críticos que debes revisar ANTES de que la cajera firme su sello?',
          a:'Solo el dinero', b:'Cortesías (autoriza, folio, motivo), arqueo de caja, tarjetas vs POS, los DOS depósitos a tesorería, sellos pendientes', c:'Solo las propinas', d:'Nada, eso lo hace la cajera sola',
          correcta:'b', explicacion:'Tus 5 banderas: cortesías, arqueo, tarjetas, depósitos, sellos. Si pasas por alto uno, se te puede ir un problema.' },
        { pregunta:'Si descubres una cortesía con tu nombre que TÚ no firmaste, ¿qué haces?',
          a:'La dejas pasar, no es importante', b:'Bandera roja gravísima — reportas a Mónica inmediato; alguien la inventó', c:'La firmas para regularizar', d:'Le pides al host que la borre',
          correcta:'b', explicacion:'Esto es fraude. Cada cortesía con tu nombre debe ser tuya. Si no lo es, hay un problema serio que escalar.' },
        { pregunta:'La cajera te dice "ya me quiero ir, hay diferencia de $300 en arqueo, firmo y mañana lo revisamos". ¿Qué haces?',
          a:'OK, firma', b:'NO. Las banderas se resuelven HOY antes de firmar. Si hay $300 faltantes con causa desconocida, hay que investigar antes', c:'Le firmas tú por ella', d:'Llamas a Germán',
          correcta:'b', explicacion:'$300 sin explicación NO es residual. Hay que revisar tickets, denominaciones, posible error de captura. Firmar a ciegas = problema mañana.' },
        { pregunta:'Si te tienes que ir antes del cierre por una emergencia personal, ¿qué haces?',
          a:'Te vas sin avisar', b:'Avisas a Mónica, dejas por escrito qué quedó pendiente, y si es posible te reportas en la noche', c:'Cierras el restaurante temprano', d:'Le pides a un host que firme por ti',
          correcta:'b', explicacion:'Tu responsabilidad no se delega informalmente. Mónica debe saber para tomar decisiones; lo escrito permite continuidad.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Curso del Admin (técnico). 6 módulos puramente técnicos enfocados en operación del sistema,
// no operación del restaurante. Apto para Germán como auditor/desarrollador, y reutilizable
// cuando se venda el sistema a otra empresa con un admin técnico.
function modulosCursoAdmin() {
  return [
    // ---------- Módulo 1: Arquitectura ----------
    {
      titulo: 'Bienvenida y arquitectura del sistema',
      resumen: 'Visión general: qué es Apps Script, cómo está organizado el código, qué hojas viven en el Sheet, y cómo se conectan.',
      tiempo: 6,
      contenido: '## Tu rol como Admin\n\nA diferencia de los hosts, cajeras y gerentes — que **operan el restaurante** — tu rol es **operar el sistema** que el restaurante usa. Eres el desarrollador, auditor o responsable técnico. Tu trabajo es:\n\n- Mantener el sistema funcionando\n- Crear/modificar usuarios\n- Cargar configuración inicial\n- Atender problemas técnicos cuando surgen\n- Hacer deploys de nuevas versiones\n\nNO necesitas saber cómo se hace un cierre de caja o cómo se sirve una espada. Eso lo cubren los otros cursos.\n\n## Qué es Google Apps Script\n\nEl sistema Fogueira corre sobre **Google Apps Script** — una plataforma de Google que te deja correr código JavaScript del lado servidor, conectado a Google Sheets, Drive, Gmail, etc.\n\n**Ventajas:**\n- Sin costo de servidor (corre en infraestructura Google gratis)\n- Backup automático (todo vive en Drive)\n- Versionado integrado\n- Acceso restringido por cuenta Google\n\n**Limitaciones:**\n- Quotas diarias (correos, ejecuciones, ancho de banda)\n- Latencia mayor que un backend dedicado (~500ms-2s por llamada)\n- Sandbox restrictivo en frontend (iframe sandbox que afecta redirects)\n\n## Estructura del proyecto\n\nEl proyecto vive en **`/conciliacion-rodizzio/apps-script/`**. Los archivos:\n\n| Archivo | Función |\n|---------|---------|\n| `Código.js` | Backend completo: schemas, endpoints, lógica de negocio |\n| `acceso.html` | Página de login |\n| `inicio.html` | Dashboard principal post-login |\n| `bitacora.html` | Bitácora del servicio (host) |\n| `reservaciones.html` | Agenda del día (host) |\n| `conciliacion.html` | Cierre del día (cajera) |\n| `charolas.html` | Captura de charolas (cocina/churrasca) |\n| `historico.html` | Histórico PRO con filtros |\n| `admin.html` | Panel de configuración |\n| `instructivo.html` | Manual filtrado por rol |\n| `examen.html` | Examen de certificación |\n| `curso.html` | Curso de capacitación por módulos |\n| `mireserva.html` | Cancelación pública del cliente |\n| `reservar.html` | Formulario público de reserva |\n\n## Estructura de la base de datos (Sheets)\n\nTodo vive en **un solo Google Sheet** con varias pestañas:\n\n| Hoja | Contenido |\n|------|-----------|\n| `Empresas` | Empresas del sistema (multi-tenant futuro) |\n| `Sucursales` | Sucursales por empresa |\n| `Usuarios` | Login + roles + password hash |\n| `Tarifas` | Histórico de precios con `fecha_desde` |\n| `Reservas` | Reservas online de clientes |\n| `Bitacoras` | Servicios diarios (1 por servicio) |\n| `BitacoraFilas` | Cada captura es 1 fila independiente (anti-pérdida) |\n| `Sellos` | Firmas autenticadas con auditoría |\n| `Conciliaciones` | Cierres de caja del día |\n| `Charolas` | Salidas de buffet (cocina/churrasca) |\n| `Promociones` | Promociones tipo DUO con días/horas |\n| `ReservasBloqueo` | Días bloqueados (pausa reservas) |\n| `Configuracion` | Clave/valor por empresa+sucursal |\n| `Horarios` | Horarios operativos |\n| `Examenes` | Banco de preguntas para certificación |\n| `Certificaciones` | Historial de intentos de examen |\n| `Cursos` | Módulos del curso por rol |\n| `ProgresoCursos` | Avance del curso por usuario |\n\n## Filosofía de diseño\n\n- **Soft-delete con auditoría**: nada se borra físicamente; todo conserva motivo + quién + cuándo\n- **Sellos autenticados**: imposible firmar por otro desde su sesión\n- **Idempotencia en bootstraps**: los setup pueden correrse N veces sin duplicar\n- **Multi-tenant ready**: empresa_id + sucursal_id en casi todas las tablas; `matchSucursal()` permite global vs concreto\n- **Token con día lógico**: sesiones cubren día operativo del restaurante (3am MX cutoff)',
      quiz: [
        { pregunta:'¿Sobre qué plataforma corre el sistema Fogueira?',
          a:'Servidor dedicado en AWS con costo mensual de hosting', b:'Base de datos SQL directamente en Google Cloud', c:'Google Apps Script (sin costo, conectado a Google Sheets)', d:'Servidor local en el restaurante (Raspberry Pi)',
          correcta:'c', explicacion:'Apps Script corre en infraestructura Google gratis, con backup automático en Drive y sandbox restrictivo.' },
        { pregunta:'En la base de datos del sistema, ¿dónde se guarda cada captura individual de la bitácora del host?',
          a:'En la hoja BitacoraFilas (cada fila es un registro independiente para anti-pérdida)', b:'En localStorage del navegador del host (persiste entre sesiones)', c:'En la hoja Bitacoras (todo en una sola fila JSON consolidada por servicio)', d:'En una base de datos SQL externa sincronizada',
          correcta:'a', explicacion:'BitacoraFilas tiene 1 fila por captura. Si falla un save, máximo se pierde 1 fila — no toda la bitácora.' },
        { pregunta:'¿Qué significa la filosofía de "soft-delete con auditoría" del sistema?',
          a:'Las cosas se borran físicamente al instante cuando el admin lo pide', b:'Se exporta a Excel antes de borrar para tener backup', c:'Solo el admin puede borrar y deja log en Google Analytics', d:'Nada se borra físicamente: se marca borrado_at + motivo + quién, conservando trazabilidad completa',
          correcta:'d', explicacion:'Auditoría siempre puede revisar QUÉ se eliminó y POR QUÉ. Esto es crítico para auditoría operativa.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 2: Usuarios ----------
    {
      titulo: 'Gestión de usuarios y roles',
      resumen: 'CRUD de usuarios, roles disponibles, sistema de herencia de privilegios, contraseñas y desactivación.',
      tiempo: 8,
      contenido: '## Los 10 roles del sistema\n\n| Rol | Foco | Examen requerido |\n|-----|------|------------------|\n| `admin` | Técnico — administra el sistema | Sí |\n| `auditoria` | Revisión y verificación de controles | Sí |\n| `cajera` | Caja, conciliación, cortes | Sí |\n| `host` | Reservas, bitácora, plano del salón | Sí |\n| `cocina` | Charolas, mermas, sellos | Sí |\n| `churrasca` | Espadas, mermas, sellos | Sí |\n| `encargado_piso` | Coordinación operativa | Sí |\n| `gerente_restaurante` | Cortesías, override, supervisión | Sí |\n| `gerente_administrativo` | Admin completo + auditoría | Sí |\n| `observador` | Solo lectura, sin edición | **NO** (exento) |\n\n## Herencia de privilegios\n\nLa función clave es `rolEs(u, roles)` en `Código.js`. Implementa:\n\n```\ngerente_administrativo → hereda admin\ngerente_restaurante    → hereda host\nobservador             → hereda host (solo lectura)\n```\n\nEsto significa que cuando un endpoint hace `if (!rolEs(u, ["admin"]))` ya está cubriendo a gerente_administrativo automáticamente.\n\n## Crear un usuario nuevo\n\n**Admin → Usuarios → "+ Nuevo usuario"**\n\nCampos:\n- **Nombre completo**\n- **Email** (debe ser único en el sistema)\n- **Rol** (uno de los 10)\n- **Contraseña inicial**: el sistema la hashea con SHA-256 antes de guardar (nunca se almacena en texto plano)\n- **Empresa**: por defecto la del admin que crea\n- **Sucursal**: si vacío = global a la empresa\n- **Activo**: sí/no\n\n## Desactivar vs eliminar\n\n**NUNCA se elimina un usuario físicamente**. Solo se **desactiva** (`activo = false`):\n\n- ✅ El usuario no podrá iniciar sesión\n- ✅ Su histórico de capturas, sellos y cortesías se preserva\n- ✅ Auditoría puede revisar lo que hizo cuando estaba activo\n- ✅ Si lo necesitas de vuelta, lo reactivas\n\nNo desactives a un usuario "para borrarlo". Mantén su histórico intacto.\n\n## Cambiar contraseña\n\nDesde **Admin → Usuarios → botón 🔑** del usuario. La nueva contraseña se hashea y reemplaza. **No se envía por email automáticamente** — díselo en persona o por WhatsApp.\n\nFuturo: implementar cambio de password por el propio usuario desde su panel.\n\n## Cambiar rol de un usuario\n\nSe puede pero **OJO**: el progreso del curso del usuario está atado a `(user_id + modulo_id)` del rol viejo. Si cambias el rol, debe rehacer el curso del nuevo rol.\n\nPara casos de "ascenso" (host → gerente_restaurante), considerar que rehaga el curso completo es lo más limpio (los 6 módulos del host son los mismos que los primeros 6 del gerente, pero técnicamente son `modulo_id` distintos).\n\n## Tabla `Usuarios` — columnas técnicas\n\n```\nid, empresa_id, sucursal_id, email, nombre, rol, password_hash, activo, creado_at\n```\n\n- `password_hash`: SHA-256 del password\n- `activo`: BOOL (acepta "true", "VERDADERO", "Sí", "1" — tolerancia por locale)\n- Sin `eliminado_at` porque NO se eliminan físicamente',
      quiz: [
        { pregunta:'¿Qué rol del sistema está EXENTO del examen de certificación?',
          a:'admin', b:'host', c:'observador (solo lectura)', d:'auditoria',
          correcta:'c', explicacion:'Observador no edita, solo ve. No requiere certificarse.' },
        { pregunta:'¿Qué rol HEREDA todos los privilegios de admin?',
          a:'gerente_restaurante (Gabriel)', b:'cajera', c:'encargado_piso', d:'gerente_administrativo (Mónica)',
          correcta:'d', explicacion:'gerente_administrativo (Mónica) hereda todos los privilegios de admin. Por eso ella puede operar el panel admin.' },
        { pregunta:'¿Qué pasa cuando "eliminas" un usuario?',
          a:'Se borra físicamente del Sheet', b:'Se desactiva (activo=false): no puede entrar, pero su histórico se preserva', c:'Se cambia el password automáticamente', d:'Pierde sus capturas y sellos',
          correcta:'b', explicacion:'NUNCA se elimina físicamente. Soft-delete con auditoría: trazabilidad de lo que hizo cuando estaba activo.' },
        { pregunta:'¿Cómo se almacena la contraseña en la tabla Usuarios?',
          a:'En texto plano para facilitar recuperación', b:'Encriptada con clave AES-256 reversible', c:'En sessionStorage del navegador', d:'Como hash SHA-256 — imposible recuperar el password original, solo verificar coincidencia',
          correcta:'d', explicacion:'Hashing one-way. Si el usuario olvida su password, hay que cambiarlo (no recuperarlo).' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 3: Configuración y tarifas ----------
    {
      titulo: 'Configuración del restaurante y tarifas vigentes',
      resumen: 'Las claves de la hoja Configuracion, formato de mesas con zonas, y el sistema de versionamiento de tarifas.',
      tiempo: 9,
      contenido: '## La hoja `Configuracion`\n\nEs un **clave-valor** por empresa+sucursal. Las claves principales:\n\n| Clave | Tipo | Default Fogueira | Descripción |\n|-------|------|------------------|-------------|\n| `cupo_por_servicio` | int | 50 | Reservas online máximas por servicio |\n| `slot_minutos` | int | 15 | Granularidad de horarios reservables |\n| `umbral_grupo_grande` | int | 10 | Grupos > N requieren confirmación manual |\n| `tolerancia_minutos` | int | 10 | Min antes de marcar reserva como atrasada (visual) |\n| `horario_estelar_desde` | time | 15:00 | Horario más demandado (info al cliente) |\n| `horario_estelar_hasta` | time | 18:00 | Horario más demandado (info al cliente) |\n| `aforo_fisico` | int | 92 | Aforo total del restaurante |\n| `mesas_salon` | string | (formato zonas) | Mesas con capacidad y zonas |\n| `gerente_administrativo_nombre` | string | Mónica | Nombre del autoriza cortesías |\n| `gerente_restaurante_nombre` | string | Gabriel | Nombre del autoriza cortesías |\n\n## Formato de `mesas_salon`\n\n**Con zonas (recomendado):**\n```\nSalón:1:4,2:4,3:4|Terraza:30:4,31:4,32:6\n```\n\n**Sin zonas (legacy):**\n```\n1:4,2:4,3:6,4:8\n```\n\nReglas:\n- `mesa:capacidad` separado por coma\n- Zonas separadas por `|`, prefijo opcional `Nombre:`\n- Si solo pones `1` sin capacidad, default 4 pax\n- IDs pueden ser numéricos (1, 2, 3) o claves (A1, B1)\n\n## Auto-zonificación\n\nSi pones formato plano sin `|`, el frontend detecta saltos > 5 entre IDs consecutivos y agrupa automáticamente:\n\n- 1-12 → Zona 1\n- 20-23 → Zona 2\n- 30-35 → Terraza (auto-nombre por convención: decena 30s)\n- 40-41 → Zona 4\n\n## Helper `matchSucursal(filaSuc, querySuc)`\n\nClave para multi-sucursal:\n\n```\nfila.sucursal_id vacío  → aplica a CUALQUIER sucursal de la empresa (global)\nfila.sucursal_id = "X"  → solo aplica a sucursal X\n```\n\nÚtil para configuración común a todas las sucursales de una empresa.\n\n## Tarifas vigentes con versionamiento\n\nLa hoja `Tarifas` mantiene **histórico completo**:\n\n```\nid, empresa_id, sucursal_id, fecha_desde, servicio, dias_semana, hora_desde, hora_hasta, t_adulto, t_nino, t_3era\n```\n\n**Cada cambio de precio = nueva fila** con `fecha_desde` actualizada. La tarifa "vigente" en cualquier fecha se calcula buscando la fila con `fecha_desde` más cercana hacia atrás de esa fecha.\n\nEjemplo:\n- `2026-01-01`: t_adulto = $590 → fila 1\n- `2026-06-01`: t_adulto = $620 → fila 2 (sube precio)\n\nUna conciliación de mayo usará $590 (fila 1); una de julio usará $620 (fila 2). El histórico siempre se reconstruye correctamente.\n\n## CSV en Sheets — cuidado con el locale\n\nEn locale es-MX, las celdas con listas tipo `"5,6,7"` se interpretan como número 567. Para evitarlo, **prefija con apostrofe**: `"\'5,6,7"`. El apostrofe le dice a Sheets "esto es texto, no número".\n\nEsto aplica para `dias_semana` en Tarifas y otras columnas con listas CSV.\n\n## Endpoint `configuracion_get` y `configuracion_set`\n\n```\nGET → devuelve { config: { clave: valor, ... } } para empresa+sucursal del usuario\nPOST → recibe { clave, valor } y hace upsert (crea o actualiza)\n```\n\nUsa `matchSucursal` para encontrar la fila correcta.',
      quiz: [
        { pregunta:'¿Cuál es el formato CORRECTO de mesas_salon con zonas?',
          a:'Salón:1:4,2:4|Terraza:30:4,31:4', b:'1,2,3,4,5 (todas mezcladas)', c:'mesa1=4, mesa2=4 (clave=valor)', d:'{"salon":[1,2,3],"terraza":[30,31]} (JSON)',
          correcta:'a', explicacion:'Zonas separadas por |, mesas dentro de cada zona separadas por coma.' },
        { pregunta:'¿Cómo se mantiene el histórico de tarifas cuando cambian los precios?',
          a:'Se sobrescribe el precio anterior directamente en la fila existente', b:'Solo se guarda el precio actual; el histórico anterior se archiva en una hoja separada', c:'Se duplica la hoja completa con timestamp cada vez que hay cambio', d:'Cada cambio = nueva fila con fecha_desde; la vigente en cualquier fecha es la más reciente hacia atrás',
          correcta:'d', explicacion:'Versionamiento por fecha_desde permite reconstruir tarifas vigentes en cualquier fecha pasada.' },
        { pregunta:'¿Qué hace el helper matchSucursal(filaSuc, querySuc)?',
          a:'Verifica que la sucursal exista en la hoja Sucursales', b:'Crea una nueva sucursal si no existe', c:'Si fila.sucursal_id está vacío → aplica a CUALQUIER sucursal de la empresa (global). Si tiene id concreto → solo a esa', d:'Borra sucursales inactivas automáticamente',
          correcta:'c', explicacion:'Permite configuraciones globales (válidas para toda la empresa) vs específicas (una sucursal).' },
        { pregunta:'En Sheets locale es-MX, ¿qué precaución debes tomar con celdas tipo "5,6,7" (lista CSV)?',
          a:'Ninguna, Sheets lo maneja bien automáticamente', b:'Prefijar con apóstrofe ("\'5,6,7") para que Sheets no las convierta en número', c:'Usar punto y coma como separador en lugar de coma', d:'Encerrar el valor entre corchetes para indicar que es una lista',
          correcta:'b', explicacion:'Sheets interpreta "5,6,7" como número 567 en locale es. El apóstrofe lo fuerza a texto.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 4: Bootstraps y auditoría técnica ----------
    {
      titulo: 'Bootstraps, auditoría técnica y soft-deletes',
      resumen: 'Las funciones de carga inicial idempotente, sellos autenticados, override admin, y cómo se almacena la auditoría.',
      tiempo: 9,
      contenido: '## Bootstraps idempotentes\n\nFunciones que **se pueden correr N veces sin duplicar datos**. Comparan por clave natural antes de insertar.\n\n### `setupConfiguracionFogueira()`\n- Crea horarios operativos por día/servicio\n- Crea claves de Configuracion (cupo, slots, mesas, etc.)\n\n### `crearPromocionesFogueira()`\n- Crea las promociones tipo DUO\n- Idempotente por nombre + empresa\n\n### `setupBancoPreguntasFogueira()`\n- Carga las 225+ preguntas del examen final (25 × 9 roles)\n- Idempotente por (rol + texto exacto de pregunta)\n- Optimizado: setValues en batch (vs appendRow uno por uno)\n\n### `setupCursosFogueira()`\n- Carga los módulos de cursos por rol\n- Idempotente por (rol + orden + título)\n- Optimizado: setValues en batch\n\n## Cómo correr un bootstrap\n\nDos formas:\n\n1. **Desde el editor Apps Script**: abre el proyecto → función → Run\n2. **Desde admin.html (recomendado)**: hay endpoints `banco_preguntas_bootstrap` y `cursos_bootstrap` con botones en Admin → Certificaciones\n\n## Sellos autenticados\n\nLa hoja `Sellos` guarda:\n\n```\nid, bitacora_id, momento, rol_esperado, user_id, user_email, user_nombre, user_rol, sellado_at, es_override, motivo_override\n```\n\n**Cada sello es:**\n- **Autenticado**: viene de la sesión activa del usuario (token válido)\n- **Imposible falsificar**: el frontend NO puede mentir sobre el user_id (lo valida el backend)\n- **Trazable**: queda quién + cuándo + rol\n\n## Override admin\n\nCuando se detecta imposibilidad operativa (cajera salió enferma, cocina no firmó), un admin puede hacer override:\n\n- Endpoint `sello_save` con flag `es_override = true`\n- Requiere `motivo_override` (mínimo 5 caracteres)\n- Queda registrado quién hizo el override + motivo\n- Auditoría revisa overrides como excepción\n\n## Soft-delete en BitacoraFilas\n\nCuando un host elimina una fila:\n\n```\nborrada_at      = timestamp\nborrada_motivo  = motivo (mín 5 chars)\nborrada_por     = email del usuario\n```\n\nLa fila **NO se elimina físicamente**. El backend la filtra (`if (f.borrada_at) return false`) para que no aparezca en la bitácora, pero auditoría puede revisarla en el Sheet directo.\n\n## Endpoints de auditoría útiles\n\n- `bitacora_filas_list` (con filtro de borradas) → operación normal\n- Lectura directa del Sheet `BitacoraFilas` → auditoría completa (incluye borradas)\n- `Sellos` (sheet) → revisar quién firmó qué cuándo\n- `Certificaciones` (sheet) → historial de exámenes (intentos + reset)\n- `ProgresoCursos` (sheet) → avance del curso por usuario\n\n## Hoja `Configuracion` por sucursal\n\nLa misma clave puede tener distintos valores por sucursal:\n\n```\nempresa_id  | sucursal_id | clave            | valor\n---------------------------------------------------\nFogueira    |             | cupo_por_servicio| 50    ← global\nFogueira    | sucur-X     | cupo_por_servicio| 80    ← solo sucursal X\n```\n\nMatchSucursal() prefiere lo específico sobre lo global.',
      quiz: [
        { pregunta:'¿Qué significa que un bootstrap sea "idempotente"?',
          a:'Que solo se puede correr una vez de forma segura', b:'Que requiere privilegios de super-admin especiales para ejecutarse', c:'Que tarda más de 30 segundos porque verifica cada fila', d:'Que se puede correr N veces sin duplicar datos (compara por clave natural antes de insertar)',
          correcta:'d', explicacion:'Comparación por clave natural (rol + texto, rol + orden, etc.) evita duplicación. Útil para reanudar cargas parciales.' },
        { pregunta:'¿Dónde queda registrado un override admin?',
          a:'Solo en los logs del servidor de Google (no en el Sheet)', b:'Se manda email automático a la dirección con el detalle', c:'En la hoja Sellos con flag es_override=true + motivo + identidad de quien hizo override', d:'En ningún lado — override es transparente por diseño',
          correcta:'c', explicacion:'Override es excepción documentada. Auditoría revisa estos casos como señales de problema operativo si son frecuentes.' },
        { pregunta:'En BitacoraFilas, ¿qué pasa al eliminar una fila?',
          a:'Soft-delete: marca borrada_at + motivo + borrada_por; la fila sigue en el Sheet para auditoría, pero el endpoint la filtra', b:'Se borra físicamente para siempre y no hay recuperación posible', c:'Se duplica automáticamente en una hoja de respaldo llamada "Eliminados"', d:'Se exporta a Excel y luego se elimina del Sheet',
          correcta:'a', explicacion:'Auditoría siempre puede revisar lo borrado y por qué. Recuperable manualmente si fue error.' },
        { pregunta:'¿Cuál es la mejor forma de correr un bootstrap (banco de preguntas o cursos)?',
          a:'Siempre desde el editor de Apps Script abriendo la función manualmente', b:'Desde admin.html con los botones "Cargar banco" / "Cargar cursos" (idempotente, con UI clara)', c:'Editando la hoja de Sheets directamente fila por fila con los datos', d:'Enviando un parámetro especial en la URL del sistema',
          correcta:'b', explicacion:'Endpoints ya conectados a UI: 1 click + confirmación. Idempotente, así que no hay riesgo si lo corres dos veces.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: Troubleshooting ----------
    {
      titulo: 'Troubleshooting común del sistema',
      resumen: 'Los problemas más frecuentes que vas a encontrar y cómo resolverlos: sesiones, iPhone Safari, redirects Chrome, timeouts.',
      tiempo: 9,
      contenido: '## Problema 1 — Pantalla en blanco al iniciar sesión\n\n**Síntomas:**\n- Usuario llena correo + contraseña, da clic, queda blanco\n- En consola: *"Unsafe attempt to initiate navigation... allow-top-navigation-by-user-activation"*\n\n**Causa:**\nChrome moderno (e iOS Safari siempre) bloquean redirects programáticos (`window.top.location.href` en setTimeout) post-login. Solo permiten navegación con click humano (user activation).\n\n**Solución implementada:**\n- En `acceso.html`: NO hacemos redirect automático. Mostramos un botón visible "→ Entrar al sistema" que el usuario presiona. Su click cuenta como user activation válida.\n- Además, si ya tiene token guardado y va a `?p=acceso`, se muestra banner "Ya tienes sesión activa — Continuar al sistema" con botón.\n\n**Si vuelve a aparecer:**\n- Verifica que NO se haya colado un `setTimeout(function(){ window.top.location.href = ... })` post-login\n- Verifica que NO haya `_a.click()` programático sin gesto humano previo\n\n## Problema 2 — iPhone storage isolation\n\n**Síntomas:**\n- En iPhone, después de login el usuario "pierde" la sesión\n- O hace login pero al recargar la página queda como anónimo\n\n**Causa:**\niOS Safari aísla el `sessionStorage` entre subdominios `googleusercontent.com` distintos. Cada carga de Apps Script web app puede ir a un subdominio diferente, así que sessionStorage NO se comparte.\n\n**Solución implementada:**\n- El **token va en la URL** (`?t=ENCODED_TOKEN`) además de en sessionStorage\n- Cada página intenta primero leer de URL (`getQuery("t")`); si no, lee de sessionStorage\n- Cuando se navega entre páginas internas, siempre se incluye el token en el href\n\n**Si vuelve a aparecer:**\n- Verifica que los `<a href>` internos incluyan `&t=` con el token\n- Verifica que `urlInterna(pagina)` agregue el token\n\n## Problema 3 — Reservas online "Sin horarios disponibles"\n\n**Síntomas:**\n- Cliente entra a `?p=reservar` y no le aparecen horarios\n- En backend `horarios_disponibles_dia` devuelve array vacío\n\n**Causa común:**\nLa hoja Horarios no tiene filas activas para ese día/servicio, O las filas existen pero `sucursal_id` no coincide con la del cliente (ni es vacío/global).\n\n**Solución:**\n- Revisar Horarios: filtrar por empresa_id + dia_semana del cliente\n- Asegurar que las filas tengan `activo = true`\n- Si la fila tiene `sucursal_id` específico, asegurar que coincida con la del cliente; si quieres aplicar a todas, dejar vacío (matchSucursal global)\n\n## Problema 4 — Bitácora pierde datos\n\n**Síntomas:**\n- Host capturó N filas; al cerrar la página y volver, faltan algunas\n\n**Mitigación implementada (capas de protección):**\n1. **BitacoraFilas individual**: cada fila se guarda como registro independiente. Máximo se pierde 1 fila si falla un save\n2. **Reintentos infinitos** con backoff exponencial: si falla la red, reintenta hasta que funcione\n3. **sendBeacon en emergency**: al cerrar la página, dispara un beacon final para garantizar el último save\n\n**Si vuelve a pasar:**\n- Revisar consola: ¿hay errores de red persistentes?\n- Verificar que `scheduleSaveFila()` esté siendo llamado en cada cambio\n- Revisar Sheet `BitacoraFilas`: ¿están las filas que faltan? Pueden estar "borradas" (soft-delete) por error\n\n## Problema 5 — Timeout en bootstrap (banco de preguntas, cursos)\n\n**Síntomas:**\n- Botón "Cargar banco preguntas" da error "Tiempo de espera"\n- Pero al revisar Sheet, sí hay filas creadas (parcial)\n\n**Causa:**\n`appendRow()` en Apps Script es lento (~150ms cada uno). 225 preguntas × 150ms = ~33s, que pasa el timeout de 25s del cliente.\n\n**Solución implementada:**\n- Usar `setValues()` en batch (escribe todas las filas de un solo golpe)\n- Reduce 33s → <1s\n- Si vuelve a aparecer timeout en algún bootstrap, aplicar el mismo patrón\n\n## Problema 6 — "Sesión inválida" inesperada\n\n**Causa:**\nEl token expira a las **3am MX del día siguiente** (día lógico restaurante).\n\nFunción `validarToken(token)` reconstruye el token con la fórmula:\n```\nMath.floor((Date.now() - 3*60*60*1000) / día)\n```\n\nSi el cliente lleva más del cutoff abierto, su token deja de coincidir y queda inválido.\n\n**Solución:**\n- El cliente debe volver a iniciar sesión\n- Es comportamiento esperado, no bug\n\n## Hábito recomendado de admin\n\n1. **Cada deploy**: probar el flujo completo con un usuario de prueba\n2. **Cada vez que carguen al equipo nuevo**: confirmar que el primer login funciona\n3. **Mensual**: revisar el sheet de Sellos buscando overrides recurrentes\n4. **Cada cambio en config Sheets**: validar que las claves siguen siendo correctas',
      quiz: [
        { pregunta:'¿Por qué se quedaba la pantalla en blanco al hacer login en Chrome PC?',
          a:'El caché del navegador bloquea la cookie de sesión después del login', b:'Apps Script cae automáticamente después de los 30 segundos de ejecución', c:'Chrome bloquea redirects programáticos (window.top.location.href en setTimeout) post-login porque considera que ya pasó la "user activation". Solo permite navegación con click humano', d:'Falla de red al cargar el CSS del iframe de Apps Script',
          correcta:'c', explicacion:'Solución: NO hacer redirect automático; mostrar botón visible que el usuario presiona (su click es user activation válida).' },
        { pregunta:'¿Por qué el token se guarda EN LA URL (?t=...) además de en sessionStorage?',
          a:'Para mostrarlo al usuario en la barra del navegador y que pueda copiarlo', b:'Por seguridad: la URL encripta el token automáticamente en HTTPS', c:'sessionStorage funciona perfectamente en todos los casos; la URL es solo por compatibilidad', d:'Por iOS Safari storage isolation: aísla sessionStorage entre subdominios googleusercontent.com. URL es la única forma de pasar el token entre cargas confiablemente',
          correcta:'d', explicacion:'iOS no comparte sessionStorage entre subdominios. La URL sobrevive entre cargas; sessionStorage en iPhone no.' },
        { pregunta:'¿Cuáles son las 3 capas de protección anti-pérdida en BitacoraFilas?',
          a:'1) Save por fila individual (BitacoraFilas), 2) reintentos infinitos con backoff, 3) sendBeacon emergency al cerrar página', b:'1) Backup a Excel cada hora, 2) Email automático a Mónica, 3) Copia en localStorage', c:'Solo un auto-guardado cada 5 minutos con debouncing estándar', d:'Todo se guarda solo en memoria RAM del servidor hasta el cierre',
          correcta:'a', explicacion:'Triple capa de protección. Aún si fallan 2, la 3ra cubre. Máximo se pierde 1 fila individual.' },
        { pregunta:'¿Por qué un bootstrap con appendRow uno por uno se cae con timeout en 225 preguntas?',
          a:'El internet del restaurante es demasiado lento para esa cantidad de datos', b:'appendRow es ~150ms cada uno; 225 × 150ms = ~33s, que pasa el timeout de 25s del cliente. Solución: setValues en batch (1 sola operación, <1s)', c:'Apps Script tiene una cuota máxima de 100 filas por ejecución', d:'Google Sheets es inherentemente más lento que cualquier base de datos SQL',
          correcta:'b', explicacion:'Operaciones de Sheets una por una son lentas. Batch con setValues es órdenes de magnitud más rápido.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 6: Operaciones críticas (CRÍTICO) ----------
    {
      titulo: '⚠ Operaciones críticas y deploys (CRÍTICO)',
      resumen: 'Las operaciones más sensibles del admin: deploys, cargas iniciales, recargas de configuración, transferencia entre empresas.',
      tiempo: 13,
      contenido: '## Por qué este módulo es CRÍTICO\n\nLas operaciones aquí descritas afectan a TODOS los usuarios del sistema. Un error puede dejar el restaurante sin poder operar durante horas. Lee con calma.\n\n## Anatomía de un deploy de Apps Script\n\nEl proyecto Fogueira tiene **deployment fijo** con `deploymentId` constante:\n\n```\nAKfycbwYbhG9xyML1p7Yp3Il54f9wCN6qTXFSc696IVnpQ8IIxE2YGhKpbTP5gLe-tGkyXA\n```\n\nEsto significa que **todas las URLs públicas del sistema apuntan a este deploymentId**. Si lo cambiamos, las URLs en WhatsApp de clientes, links pegados en algún lado, etc., **dejan de funcionar**.\n\n### Comando de deploy\n\n```bash\ncd /apps-script/\nclasp push   # sube el código (no es deploy aún)\nclasp deploy --deploymentId "AKfycbwY..." --description "v85 — descripción del cambio"\n```\n\n**SIEMPRE usa el deploymentId fijo**. Si haces `clasp deploy` sin `--deploymentId`, crea uno nuevo y rompe los links existentes.\n\n## Antes de cada deploy\n\n1. **Push primero**: `clasp push` (sube el código sin liberar nueva versión)\n2. **Si el cambio es grande**: hacer push, probar desde editor Apps Script (HEAD), validar\n3. **Solo cuando esté listo**: `clasp deploy --deploymentId "..."` con descripción clara del cambio\n\n## Carga inicial de un sistema nuevo (multi-tenant futuro)\n\nCuando se vende a otra empresa, el flujo es:\n\n1. **Crear empresa nueva**: insertar fila en `Empresas`\n2. **Crear sucursal(es)**: en `Sucursales` con `empresa_id` de la nueva\n3. **Adaptar bootstraps**: hoy `setupConfiguracionFogueira()` tiene EMPRESA_ID hardcoded; para nueva empresa hay que parametrizar o crear `setupConfiguracion[NuevaEmpresa]()`\n4. **Cargar tarifas iniciales**: insertar filas en `Tarifas` con la nueva empresa\n5. **Crear usuarios**: admin de la empresa cliente, gerentes, hosts\n6. **Crear horarios**: en `Horarios` por día/servicio\n7. **Crear curso adaptado**: por ahora los cursos son específicos de Fogueira (mencionan a Mónica, Gabriel, etc.). Para vender, hay que generalizar el contenido o crear cursos por empresa.\n\n## Recargas peligrosas\n\n### Re-correr `setupConfiguracionFogueira()`\n- Esto reescribe Horarios y Configuracion\n- **Si el cliente ha cambiado horarios desde admin.html, los pierde** al re-correr (no es idempotente para esa hoja)\n- Solo correr en setup inicial. Después, NUNCA en producción\n\n### Re-correr `setupBancoPreguntasFogueira()`\n- Idempotente por (rol + texto exacto). Seguro de re-correr\n- Si modificas el texto de una pregunta y re-corres, crea una nueva (no actualiza la vieja)\n- Para "actualizar": editar directamente la fila en Sheet, o desactivar la vieja (`activa = false`) y crear nueva\n\n### Re-correr `setupCursosFogueira()`\n- Idempotente por (rol + orden + título). Seguro de re-correr\n- Si modificas el contenido pero mantienes el título, NO se actualiza (compara por título)\n- Para "actualizar": editar la fila en Sheet directamente\n\n## Operaciones con riesgo de pérdida de datos\n\n### NUNCA borres físicamente filas de:\n- `Bitacoras` / `BitacoraFilas` (auditoría operativa)\n- `Conciliaciones` (cierres firmados)\n- `Sellos` (firmas de auditoría)\n- `Certificaciones` (historial de exámenes)\n- `Reservas` (compromisos con clientes)\n\n**Si necesitas "limpiar" pruebas, cambia el `empresa_id` a una temporal o desactiva, no borres físico.**\n\n## Cambio de password de admin si se compromete\n\nSi sospechas que tu cuenta admin fue comprometida:\n\n1. **Inmediato**: cambia tu password desde admin.html\n2. **Revisa Sellos**: ¿hay overrides recientes que tú no hiciste?\n3. **Revisa Usuarios**: ¿hay usuarios nuevos que tú no creaste?\n4. **Revisa logs de Apps Script**: si hay accesos anormales\n5. **Si hay sospecha real**: rota el deploymentId (esto rompe links, pero es por seguridad)\n\n## Recordatorios de oro\n\n1. **Antes de tocar producción**: respira. Lo que vayas a hacer ahora no se puede deshacer en muchos casos.\n2. **Backup mental**: ¿puedes deshacer esto si sale mal? Si la respuesta es no, considera hacerlo en horario no operativo.\n3. **DeploymentId fijo SIEMPRE**: nunca lo cambies sin avisar a Mónica y Germán\n4. **Pruebas con usuario de prueba**: nunca pruebes flujos nuevos con un usuario operativo real\n5. **Documenta en commit/deploy description**: qué cambió y por qué',
      quiz: [
        { pregunta:'¿Por qué SIEMPRE se debe usar el deploymentId fijo en clasp deploy?',
          a:'El deploymentId es una contraseña que Google exige para validar los deploys', b:'Cambiarlo es opcional, solo afecta el historial de versiones', c:'Solo importa si usas el sistema desde fuera del restaurante', d:'Las URLs públicas (links de reservas, mireserva, etc.) apuntan a ese deploymentId. Si lo cambias, todos los links existentes dejan de funcionar',
          correcta:'d', explicacion:'Links en WhatsApp de clientes, en pestañas abiertas, en QRs impresos — todos apuntan al deploymentId. Cambiarlo = romperlos.' },
        { pregunta:'¿Qué pasa si re-corres setupConfiguracionFogueira() en producción?',
          a:'Reescribe Horarios y Configuracion. Si el cliente cambió horarios desde admin.html, los pierde. Solo correr en setup inicial', b:'Crea registros duplicados en la hoja Usuarios', c:'No pasa nada — es idempotente y seguro de correr siempre', d:'Genera un backup automático antes de sobreescribir y luego actualiza',
          correcta:'a', explicacion:'No es idempotente para horarios. Después del setup inicial, NUNCA volver a correr en producción.' },
        { pregunta:'¿En cuáles tablas NUNCA se debe hacer borrado físico de filas?',
          a:'Solo en la tabla Usuarios para proteger identidades', b:'Solo en Tarifas para conservar histórico de precios', c:'Bitacoras, BitacoraFilas, Conciliaciones, Sellos, Certificaciones, Reservas (todas tienen valor de auditoría/legal)', d:'Solo en Configuracion, porque sus claves son únicas',
          correcta:'c', explicacion:'Soft-delete o desactivación. Borrado físico de auditoría es peligroso y posiblemente ilegal en algunos casos (datos fiscales, compromisos con clientes).' },
        { pregunta:'Si sospechas que tu cuenta admin fue comprometida, ¿qué pasos sigues?',
          a:'Esperas 24 horas a ver si el problema se resuelve solo', b:'Cambias password inmediato, revisas Sellos por overrides extraños, revisas Usuarios por cuentas nuevas, revisas logs Apps Script', c:'Borras inmediatamente todos los datos del Sheet para que nadie más pueda acceder', d:'Revokas el deploymentId sin avisar a Mónica ni a Germán para actuar rápido',
          correcta:'b', explicacion:'Acción inmediata + auditoría de cambios recientes. Si hay sospecha real, considerar rotar deploymentId (con plan de comunicación).' },
        { pregunta:'¿Cuál es la mejor regla de oro antes de hacer cualquier cambio en producción?',
          a:'Pregúntate: "¿puedo deshacer esto si sale mal?". Si la respuesta es no, considera hacerlo en horario no operativo y con usuario de prueba primero', b:'Documenta el cambio después de aplicarlo, no antes, para no perder tiempo', c:'Hazlo rápido durante el servicio para que el equipo vea el resultado de inmediato', d:'Delega el cambio a la cajera para que tenga experiencia técnica adicional',
          correcta:'a', explicacion:'La cautela del admin protege a todo el restaurante. Una operación mal hecha puede dejar al equipo sin sistema durante horas.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 7: Conciliación corta (apertura) ----------
    {
      titulo: 'Conciliación corta — Apertura del servicio',
      resumen: 'Cómo abrir la conciliación al iniciar el servicio: efectivo inicial, fondo de cambio, sello de apertura.',
      tiempo: 7,
      contenido: '## Tu rol en la conciliación\n\nA diferencia del lado técnico, **tú también operas la conciliación financiera del día**. Cada servicio tiene 2 partes: **apertura (corta)** y **cierre profundo**.\n\nEste módulo cubre la apertura. El siguiente — el cierre profundo — es el más crítico del curso.\n\n## Cuándo se hace la apertura\n\n- **Lun–Jue**: 1 apertura por día — el Buffet completo tiene un solo bloque. La conciliación de apertura se llena al **cierre del servicio** cuando la bitácora ya tiene datos.\n- **Vie–Dom**: 2 servicios independientes (Desayuno y Comida). La apertura de Desayuno se llena a la **~1pm** — cuando el Desayuno cierra y los hosts sellan su bitácora. En ese momento el sistema ya puede consolidar los datos con "Auto-llenar". Después abres la apertura de Comida.\n\n**¿Por qué no al inicio del día?** La pestaña Apertura incluye datos financieros (cobros, comensales) que solo existen al cierre del primer servicio. Al abrir el restaurante a las 8am, la forma está vacía — no hay números aún. Los **sellos de apertura** (host, cajera, cocina, churrasca) sí se firman al inicio, pero la conciliación completa se llena cuando hay datos disponibles.\n\n**Momento correcto**: cuando los hosts cierran y sellan su bitácora de Desayuno (~1pm), usa "Auto-llenar" para consolidar y llena la apertura. Inmediatamente después, abre la bitácora de Comida para el siguiente servicio.\n\n## Pasos de la apertura\n\nEntra al módulo **Conciliación** del día. Verás 3 pestañas:\n\n1. **Apertura** ← aquí estás\n2. Cierre PROFUNDO\n3. Resumen\n\nEn la pestaña **Apertura** captura:\n\n### 1. Datos del servicio\n- **Fecha**: prellena con la del día\n- **Servicio**: Desayuno / Comida / Buffet completo (según día y hora)\n- **Folio**: si el POS asigna un folio único al servicio, captúralo\n- **Host del turno**: el nombre del host operando\n- **Cajero del turno**: nombre del cajero\n\n### 2. Fondo inicial de caja\n- **Efectivo inicial**: total del fondo de cambio que se le entregó a la cajera\n- **Desglose por denominación** (opcional pero recomendado): cuántos billetes de cada valor\n- **Cambio extra entregado durante el turno** (si aplica)\n\n### 3. Tarifas vigentes (se prellenan)\n- El sistema lee de la tabla `Tarifas` la fila vigente para ESA fecha\n- Muestra: t_adulto, t_nino, t_3era para el servicio\n- **Si no hay tarifa vigente**: error visible. Avisa a Mónica para crear la fila\n\n### 4. Sello de apertura\n- Tu firma como admin se hace desde TU sesión activa\n- Queda registrado: tu user_id, email, rol, sellado_at\n- **Imposible firmar por otro** desde la pantalla normal (solo override admin con motivo)\n\n## Sellos esperados al apertura\n\nAdemás del tuyo, el sistema espera estos otros sellos al iniciar:\n\n| Sello | Quién firma | Cuándo |\n|-------|-------------|--------|\n| Apertura · Host | Host del turno | Justo antes de abrir puertas |\n| Apertura · Cajera | Cajera del turno | Cuando recibe fondo de cambio |\n| Apertura · Cocina | Cocinero principal | Cuando setup de buffet listo |\n| Apertura · Churrasca | Churrasquero | Cuando rodizio listo |\n\nEl tablero "Esperados vs Hechos" en la sección 05 muestra cuáles ya firmaron.\n\n## Si falta un sello al inicio\n\n- El servicio puede empezar (no es bloqueante para operar)\n- Pero queda como **pendiente** y te avisará al cierre\n- Si la persona NO va a poder firmar (turno cambia, no llegó a tiempo), puedes hacer **override admin** capturando motivo\n\n## Hábito recomendado\n\n- **Llega 15-20 min antes** del inicio del servicio\n- Verifica: tarifas vigentes correctas, fondo de cambio recibido por la cajera, sellos de cocina/churrasca firmados\n- **Si algo no está**: resuelve antes de abrir puertas\n- Tu sello al final',
      quiz: [
        { pregunta:'En fines de semana, ¿cuántas conciliaciones se abren al día?',
          a:'2 (una por servicio: Desayuno y Comida — cada una con su propia apertura y cierre)', b:'1 (todo el día se maneja en una sola conciliación)', c:'3 (Desayuno, Comida y Cena)', d:'Se combinan en una sola al finalizar el fin de semana',
          correcta:'a', explicacion:'Vie-Dom hay dos servicios independientes con tarifas distintas, cada uno con su conciliación.' },
        { pregunta:'¿Qué pasa con las tarifas en la pestaña Apertura?',
          a:'Hay que capturarlas a mano cada día revisando la tabla de precios impresa', b:'Se heredan de la última conciliación cerrada sin verificar fecha', c:'Se prellenan automáticamente leyendo la fila vigente de la tabla Tarifas para ESA fecha', d:'La cajera las ingresa según lo que le indique el gerente en turno',
          correcta:'c', explicacion:'Versionamiento de Tarifas con fecha_desde permite reconstruir tarifas correctas en cualquier fecha.' },
        { pregunta:'Si un sello esperado de apertura falta (ej: cocina no firmó), ¿qué haces?',
          a:'Bloqueas la apertura hasta que todos los sellos estén firmados', b:'Lo ignoras sin documentar — no afecta el cierre si no es crítico', c:'Cancelas el servicio y reprogramas para otro día', d:'El servicio puede empezar (no es bloqueante); queda pendiente. Si la persona no podrá firmar, haces override admin con motivo',
          correcta:'d', explicacion:'Apertura no bloquea operación. Override admin para casos imposibles, con motivo registrado en auditoría.' },
        { pregunta:'¿Tu sello de apertura puede firmarlo otra persona desde su sesión?',
          a:'Sí, cualquier admin puede firmar por ti si es urgente', b:'No: cada sello es autenticado por la sesión activa. Imposible firmar por otro desde pantalla normal (solo override admin con motivo)', c:'Solo Mónica puede firmar por cualquier rol', d:'Cualquier gerente puede firmar si tú lo autorizas verbalmente',
          correcta:'b', explicacion:'Sellos autenticados garantizan trazabilidad. Override es la única excepción y queda registrado.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 8: Conciliación profunda (CRÍTICO) ----------
    {
      titulo: '⚠ Conciliación profunda — Cierre del servicio (CRÍTICO)',
      resumen: 'El módulo más importante del curso de admin: cómo cerrar correctamente un servicio. Banderas rojas, validaciones, sellos, firma final.',
      tiempo: 14,
      contenido: '## Por qué este módulo es CRÍTICO\n\nEl cierre profundo es donde **todo lo capturado se valida y se firma**. Errores aquí:\n- Cuestan dinero al restaurante (faltantes no detectados, cortesías mal autorizadas)\n- Dejan banderas para auditoría\n- Generan conflictos con el equipo (cajera vs admin sobre quién es responsable)\n\nLee con calma. **Este es el módulo más importante del curso de admin.**\n\n## Pestaña Cierre PROFUNDO — secciones\n\n1. **Auto-llenar** (consolida bitácoras)\n2. Corte de caja (efectivo)\n3. Tarjetas\n4. Cortesías\n5. Promociones\n6. Depósitos a tesorería (2)\n7. Arqueo ciego (sistema calcula)\n8. Banderas rojas\n9. Sellos\n10. Firma final\n\n## 1. Auto-llenar — consolidar bitácoras\n\nClick en **"Auto-llenar"**. El sistema:\n- Lee las bitácoras del día (Desayuno → ap; Comida → ci; Buffet → ap)\n- Suma adultos, niños, 3a edad, cortesías\n- Calcula totales por categoría\n- Te muestra los números consolidados\n\n**Verifica visualmente** que los números cuadren con la operación esperada (ej: si fue un servicio normal, ~50-80 personas; si veo 200, hay error).\n\n## 2. Corte de caja\n\nLa cajera captura el desglose por denominación:\n- 200, 500, 1000, 200, 100, 50, 20 (billetes)\n- 10, 5, 2, 1, 0.50 (monedas)\n\nEl sistema multiplica y suma. **Tú revisas** que el total contado tenga sentido.\n\n## 3. Tarjetas\n\nSeparadas por tipo:\n- Débito\n- Mastercard\n- AMEX\n- Visa (crédito)\n\n**Por qué se separan**: cada banco/tarjeta tiene comisiones distintas. La administradora analiza estos datos para optimizar costos bancarios.\n\nVerifica que la suma total de tarjetas coincida con el reporte del POS.\n\n## 4. Cortesías — TU RESPONSABILIDAD CRÍTICA\n\nCada cortesía debe tener:\n\n| Dato | Crítico |\n|------|---------|\n| Autoriza (Mónica o Gabriel) | **Sí** |\n| Folio del ticket POS | **Sí** |\n| Motivo en observaciones | **Sí** |\n\nSi falta alguno → **bandera roja**.\n\n**SI VES UNA CORTESÍA QUE NO RECONOCES O QUE TIENE DATOS RAROS** (motivo vago, sin folio, monto alto sin justificación) → **investígala antes de firmar**.\n\n## 5. Promociones aplicadas\n\nSi se aplicó alguna promoción (DUO, etc.):\n- Verificar que cumple las reglas (días/horas/personas)\n- Si fue mal aplicada → bandera roja\n\n## 6. Depósitos a tesorería — DOS depósitos OBLIGATORIOS\n\nReglas Fogueira:\n- **Depósito 1**: venta del día (efectivo + tarjetas)\n- **Depósito 2**: comisiones bancarias (separado para análisis contable)\n\nAmbos deben:\n- Coincidir en monto con lo capturado\n- Tener folio de tesorería\n- Estar firmados por quien depositó\n\n**Si falta uno → bandera roja**. NO firmes el cierre con un solo depósito.\n\n## 7. Arqueo ciego\n\nEl sistema calcula automáticamente:\n```\nVenta teórica = (adultos × t_adulto) + (niños × t_nino) + ... - cortesías\nDinero esperado en caja = Venta teórica - depósitos - tarjetas\n```\n\nLuego compara con lo CONTADO en caja. Diferencia:\n- **Faltante (contado < teórico)**: investigar\n- **Sobrante (contado > teórico)**: tickets no capturados o errores\n\nUmbrales típicos:\n- < $50: error de cambio normal\n- $50 - $200: revisar tickets\n- $200 - $1000: investigar antes de firmar\n- > $1000: **NO firmar**, escalar a Mónica\n\n## 8. Banderas rojas — TU CHECKLIST FINAL\n\nAntes de firmar, **revisa MANUAL Y SISTEMÁTICAMENTE**:\n\n- ❌ Cortesías sin autoriza (Mónica o Gabriel)\n- ❌ Cortesías sin folio del ticket POS\n- ❌ Cortesías con motivo débil ("varios", "ok", vacío)\n- ❌ Diferencias en arqueo > $200 sin explicación\n- ❌ Depósitos a tesorería incompletos (falta uno)\n- ❌ Sellos pendientes (host, cajera, cocina, churrasca)\n- ❌ Tarjetas que NO cuadran con el POS\n- ❌ Filas de bitácora SIN hora_sal al cierre\n- ❌ Reservas en "En espera" que ya no van a llegar\n- ❌ Promociones mal aplicadas\n\n**Cualquiera de estas SIN explicar → NO firmes.**\n\n## 9. Sellos pendientes\n\nEl tablero "Esperados vs Hechos" muestra los sellos del día. Si alguno está rojo:\n\n- Llama a la persona, si está disponible: que firme desde su sesión\n- Si imposible (turno cambió, salió enferma): **override admin** con motivo claro\n- Cada override queda con tu firma + motivo + flag `es_override = true`\n\n## 10. Firma final del admin\n\nUna vez que TODO esté limpio:\n\n1. **Guarda la conciliación** (botón "Cerrar conciliación")\n2. **Firma tu sello como admin**\n3. La conciliación queda **cerrada** con `cerrada_at = ahora`\n4. Después del cierre, solo override admin puede modificarla (con motivo)\n\n## Si HAY banderas que no se pueden resolver al cierre\n\n- **Documenta TODAS** en observaciones de la conciliación\n- **Escala a Mónica por WhatsApp** (texto + foto si aplica)\n- Si es **dinero faltante > $1000**: contacta inmediato, no esperes mañana\n- Si es **fraude sospechado**: documenta evidencia y escala\n\n## Tu firma significa\n\nCuando firmas el cierre, le estás diciendo al sistema y al restaurante:\n\n*"He revisado todo. Las banderas que están aquí están explicadas. Lo que no estaba bien fue corregido o escalado. Doy fe de que esta conciliación refleja la realidad operativa del día."*\n\n**Si firmas algo que NO revisaste, es responsabilidad tuya cuando aparezca el problema mañana.**\n\n## Hábitos para nunca olvidar\n\n1. **30-45 min antes del cierre**, ve al sistema y revisa la bitácora del día\n2. **Acompaña a la cajera durante el cierre**, no la dejes sola con un proceso crítico\n3. **NO la apures**: mejor 45 min de cierre limpio que 15 min con banderas\n4. **Cada bandera ignorada hoy → un problema mayor mañana** (Mónica, dirección, auditoría)\n5. **Backup de la conciliación**: si algo sale mal, debes poder reconstruir',
      quiz: [
        { pregunta:'¿Qué hace el botón "Auto-llenar" del Cierre PROFUNDO?',
          a:'Genera datos de prueba para verificar que el sistema funciona', b:'Copia los datos del cierre del día anterior automáticamente', c:'Consolida automáticamente las bitácoras del día (suma adultos, niños, 3a edad, cortesías) en los campos de cierre', d:'Cierra el restaurante y bloquea nuevas reservas hasta el siguiente turno',
          correcta:'c', explicacion:'Auto-llenar lee bitácoras del backend. Vie-Dom: Desayuno→ap, Comida→ci, Lun-Jue: Buffet→ap.' },
        { pregunta:'Una cortesía debe llevar 3 datos para evitar bandera roja al cierre. ¿Cuáles son?',
          a:'Solo el monto del descuento y la mesa donde se aplicó', b:'Nombre del cliente, número de personas y hora de salida', c:'Folio del ticket y número de mesa únicamente', d:'Autoriza (Mónica o Gabriel), folio del ticket POS, motivo en observaciones',
          correcta:'d', explicacion:'Estos 3 datos garantizan trazabilidad: quién aprobó + cruce con POS + justificación.' },
        { pregunta:'¿Cuántos depósitos a tesorería deben hacerse al día y por qué?',
          a:'DOS: venta del día y comisiones bancarias (separados para análisis contable). Si falta uno, bandera roja', b:'Uno solo con todo junto al final del turno (más eficiente)', c:'Tres: efectivo, tarjetas y propinas por separado', d:'El número que determine la cajera según el volumen del día',
          correcta:'a', explicacion:'Reglas Fogueira: separación contable obligatoria. Auditoría revisa que ambos estén con folio.' },
        { pregunta:'En el arqueo ciego, hay diferencia FALTANTE de $850 sin explicación clara. ¿Qué haces?',
          a:'Firmas igual porque es menor a $1,000', b:'NO firmas. Investigas (revisa tickets, denominaciones, posibles errores de captura). Si no se resuelve, escala a Mónica antes de firmar', c:'Lo ajustas en el sistema como "error de denominación" sin investigar', d:'Le pides a la cajera que revise solo los billetes grandes para agilizar',
          correcta:'b', explicacion:'$850 sin explicación NO es residual. Diferencias > $200 deben investigarse; > $1000 escalar inmediato a Mónica.' },
        { pregunta:'Cuando firmas el cierre del servicio, ¿qué estás diciendo formalmente?',
          a:'Que confías en que la cajera hizo su trabajo correctamente sin revisarlo', b:'Que el sistema generó el cierre automáticamente y tú solo lo validaste visualmente', c:'Que la conciliación puede revisarse en cualquier momento futuro por auditoría', d:'Que revisaste todo, las banderas están explicadas, lo no resuelto fue escalado, y das fe de que la conciliación refleja la realidad operativa',
          correcta:'d', explicacion:'Tu firma es un acto formal con responsabilidad. Si firmas algo no revisado y aparece un problema mañana, es responsabilidad tuya.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 9: Resumen del día y banderas rojas (CRÍTICO) ----------
    {
      titulo: '⚠ Resumen del día y semáforo de banderas rojas (CRÍTICO)',
      resumen: 'Cómo leer el tablero ejecutivo del día: 11 KPIs auto-calculados, 10 banderas rojas del semáforo, y conclusión del auditor.',
      tiempo: 15,
      contenido: '## Por qué este módulo es CRÍTICO\n\nLa pestaña **Resumen** es **tu tablero ejecutivo del día**. Aquí ves consolidado TODO lo que pasó: ingresos, comensales, banderas detectadas. Tu firma del cierre depende de lo que decidas aquí.\n\nNo es lectura pasiva — es **interpretación activa**. Cada KPI y cada bandera tiene un significado y una acción.\n\n## Estructura del Resumen — 3 secciones\n\nLa pestaña Resumen tiene 3 partes:\n\n1. **Grid de 11 KPIs** (arriba)\n2. **01 Semáforo de banderas rojas** (10 checks automáticos)\n3. **02 Conclusión del auditor / supervisor** (tu cierre formal)\n\n## Sección de KPIs — los 11 indicadores\n\n### Cobros del día\nSuma total de ingresos (efectivo + tarjetas) según POS. **Si sale $0 cuando hubo operación**: error de conexión con POS o no se cargaron tickets — investigar.\n\n### Comensales POS\nNúmero total de personas según los tickets del POS. **Compara con lo que tú esperas** del día (reservas + walk-ins).\n\n### Cobro promedio / comensal\nTicket promedio. Útil para detectar:\n- Si baja mucho un día → ¿descuentos no autorizados? ¿cortesías excesivas?\n- Si sube → ¿upsells exitosos? ¿menú especial?\n\n### Propina prom. / comensal\nIndicador de satisfacción. Caídas grandes = posible problema de servicio.\n\n### Δ Host vs POS (verde si OK)\nDiferencia entre comensales registrados por hosts en bitácora vs los del POS. **Debe ser cercano a 0**. Si diferencia > 2 → bandera roja.\n\n### Δ Arqueo ciego (verde si OK)\nDiferencia entre lo CONTADO en caja y lo TEÓRICO calculado por el sistema. **Si > $200 → bandera roja**.\n\n### Δ Terminal vs POS (verde si OK)\nDiferencia entre el cierre de lote bancario (terminal) y el reporte del POS. **Debe ser cero o cercano**. Si hay diferencia: cobro doble, devolución no registrada, voucher mal capturado.\n\n### % Cancelaciones\nPorcentaje de cobros que fueron cancelados. **Si > 3% → bandera roja**. Investigar por qué tantas cancelaciones (¿errores de captura? ¿servicio malo?).\n\n### No-sales día\nVeces que el cajón se abrió SIN venta. **Si > 2 → bandera roja**. No-sales repetidos = sospecha de manipulación de caja.\n\n### Cortesías día\nNúmero total de cortesías otorgadas. NO es bandera por sí solo, pero **si sube mucho contra promedio**, investigar.\n\n### Δ Folios\nDebe coincidir: `(folio_hasta − folio_desde + 1) = # tickets emitidos`. Si hay saltos → tickets faltantes (anulados sin documentar, o peor).\n\n## Sección 01 — Semáforo de banderas rojas\n\nCada bandera tiene **3 estados visuales**:\n\n- ✅ **Verde**: dentro del umbral, sin acción\n- ⚠ **Amarilla**: en el límite, revisar\n- ❌ **Roja**: fuera de umbral, requiere acción ANTES de firmar\n\n### Las 10 banderas, qué significan y qué hacer\n\n#### 1. Δ Comensales (Host vs POS) > 2\n**Significa**: la bitácora del host y los tickets del POS no coinciden en personas.\n\n**Causas típicas**:\n- Host olvidó capturar un grupo o lo capturó mal\n- POS tiene tickets duplicados\n- Un grupo se dividió y el host lo contó como uno\n\n**Qué hacer**: revisar bitácora vs tickets POS uno por uno. Identificar el grupo faltante o duplicado. Corregir antes de firmar.\n\n#### 2. Δ Arqueo ciego > $200\n**Significa**: lo que se contó en caja NO coincide con lo teórico.\n\n**Acción según monto**:\n- $200-$500: revisar tickets, denominaciones, posibles errores de captura\n- $500-$1000: investigar a fondo, capturar motivo\n- **>$1000: NO firmar, escalar a Mónica**\n\n#### 3. Δ Cierre de lote terminal vs POS\n**Significa**: el cierre del lote bancario (terminal) no coincide con lo que reporta el POS.\n\n**Causas**:\n- Cobro doble en una transacción\n- Devolución no registrada\n- Voucher capturado mal\n- Diferencia por propinas en tarjeta\n\n**Qué hacer**: cruzar terminal vs POS por transacción. Identificar la diferencia.\n\n#### 4. % Cancelaciones > 3% de cobros\n**Significa**: demasiadas cancelaciones de tickets ese día.\n\n**Causas**:\n- Errores de captura del POS\n- Servicio malo (cliente se fue antes de pagar)\n- Posible manipulación (cancelar para quedarse efectivo)\n\n**Qué hacer**: revisar las cancelaciones una por una. Cada una debe tener autorización documentada. Si no la tiene, otra bandera (#7).\n\n#### 5. No-sales (cajón sin venta) > 2 en el día\n**Significa**: el cajón se abrió más de 2 veces sin venta asociada.\n\n**Causas**:\n- Cambio de billete (legítimo pero debe ser raro)\n- **Manipulación** (sacar/poner efectivo sin registrar)\n\n**Qué hacer**: preguntar a la cajera por cada no-sale. Si más de 2 sin justificación → escalar.\n\n#### 6. Cortesías registradas SIN autorización documentada\n**Significa**: hay cortesías sin nombre del autoriza (Mónica o Gabriel).\n\n**Acción**: identificar las cortesías afectadas. Pedir al host o cajera que llenen el dato. Si no se sabe quién autorizó → escalar a Mónica.\n\n#### 7. Cancelaciones registradas SIN autorización documentada\n**Significa**: cancelaciones sin nombre de quien autorizó.\n\n**Por qué importa**: una cancelación sin autorización = posible fraude operativo.\n\n**Acción**: documentar quién autorizó cada cancelación. Si no se sabe → escalar.\n\n#### 8. Cierre de lote bancario no realizado\n**Significa**: alguna terminal NO tiene hora de cierre registrada.\n\n**Por qué**: si la terminal no se cerró, no hay corte bancario y mañana puede haber problemas con depósitos.\n\n**Acción**: cerrar la terminal antes de irte. Si ya no se puede → documentar y avisar a Mónica.\n\n#### 9. Δ Operaciones del lote vs Vouchers (por terminal)\n**Significa**: la cantidad de operaciones que reporta el lote no cuadra con los vouchers físicos contados.\n\n**Acción**: contar vouchers físicos uno por uno. Identificar diferencia.\n\n#### 10. Saltos en folios consecutivos\n**Significa**: los folios de tickets emitidos NO son consecutivos.\n\n**Causas**:\n- Tickets anulados sin documentar\n- Tickets perdidos (físicamente)\n- Manipulación (tickets emitidos no reportados)\n\n**Acción CRÍTICA**: identificar los folios faltantes y por qué. Esto es la bandera más sospechosa de fraude.\n\n## Sección 02 — Conclusión del auditor / supervisor\n\nDespués de revisar todo, capturas:\n\n### Estatus general del día\nDropdown con opciones (varían por implementación, típicamente):\n- **OK** — sin observaciones, todo cuadra\n- **Observaciones menores** — banderas pequeñas explicadas, no impacto material\n- **Observaciones graves** — banderas serias, requiere seguimiento\n- **Banderas críticas** — NO se debe firmar sin escalar\n\n### Comentarios y plan de acción\nTextarea libre. Escribe:\n- **Qué banderas se detectaron** (las que no cuadraron)\n- **Qué se investigó** (revisé tickets, conté vouchers, etc.)\n- **Qué se concluyó** (fue error de captura, cliente se fue sin pagar, etc.)\n- **Plan de acción** (capacitar a la cajera, ajustar proceso, escalar a dirección)\n\nEste comentario queda **en la conciliación firmada** y es revisable por dirección.\n\n## Workflow recomendado al cerrar\n\n1. **Antes de abrir Resumen**: completa Cierre PROFUNDO (módulo anterior)\n2. **Abre Resumen**: revisa los 11 KPIs primero (vista panorámica)\n3. **Si algo te llama la atención** en KPIs (ej: Δ Arqueo > $0): baja al semáforo a ver detalle\n4. **Recorre las 10 banderas una por una**. Cada roja → investiga ANTES de firmar\n5. **Si todo verde**: estatus OK, comentario breve "operación normal sin observaciones"\n6. **Si hay banderas amarillas**: estatus "observaciones menores", documenta cada una\n7. **Si hay rojas**: NO firmes. Escala lo necesario. Solo cuando estén explicadas o resueltas, firma\n\n## Cuándo NO firmar (NUNCA)\n\n- ❌ Δ Arqueo > $1000 sin explicación\n- ❌ Cortesía con tu nombre que tú NO firmaste (fraude)\n- ❌ Saltos en folios consecutivos sin explicación (fraude potencial)\n- ❌ No-sales > 2 sin justificación\n- ❌ Cancelaciones masivas sin autorización\n- ❌ Cualquier bandera roja con sospecha de manipulación intencional\n\nEn estos casos: documenta evidencia, escala a Mónica/dirección, NO firmes hasta resolución.\n\n## Tu firma del Resumen\n\nCuando das estatus "OK" o "Observaciones menores" y firmas, estás formalmente diciendo:\n\n*"Como auditor del día, doy fe de que las banderas que aparecen en este resumen están explicadas o son aceptables. La conciliación refleja la operación real."*\n\nSi firmas con banderas no explicadas y mañana aparece el problema → **es tu responsabilidad**.',
      quiz: [
        { pregunta:'¿Qué umbral marca como bandera roja la diferencia de Arqueo ciego?',
          a:'$50 (coincide con el máximo de error de cambio permitido)', b:'$1,000 (solo diferencias muy grandes se marcan)', c:'$0 — cualquier diferencia mínima ya es crítica y escala inmediato', d:'$200 (configurable). Si > $200 → bandera roja que requiere investigación',
          correcta:'d', explicacion:'Umbral default $200. Diferencias mayores requieren investigar tickets, denominaciones, errores de captura.' },
        { pregunta:'Si ves la bandera "% Cancelaciones > 3%" en rojo, ¿qué haces?',
          a:'Revisas las cancelaciones una por una y verificas que cada una tenga autorización documentada. Si alguna no la tiene, escalas', b:'La ignoras porque los errores del POS son normales en un turno completo', c:'Cancelas las cancelaciones del día para que el porcentaje baje', d:'Borras las cancelaciones del sistema para que desaparezca la bandera',
          correcta:'a', explicacion:'Cancelaciones masivas pueden indicar errores de POS, malo servicio, o manipulación. Cada una debe estar autorizada.' },
        { pregunta:'La bandera "Saltos en folios consecutivos" es CRÍTICA porque:',
          a:'Es solo decorativa, aparece cuando hay problemas de red', b:'Causa que el POS se desconecte automáticamente al siguiente turno', c:'Indica tickets faltantes — pueden ser anulados sin documentar, perdidos, o tickets emitidos no reportados (potencial fraude)', d:'Solo aparece cuando el sistema tiene atraso en sincronizar datos',
          correcta:'c', explicacion:'Es la bandera más sospechosa de fraude. Cada folio faltante debe tener explicación.' },
        { pregunta:'En la sección "Conclusión del auditor", si hay banderas rojas serias sin resolver, ¿qué estatus debes seleccionar?',
          a:'"OK" — ya lo resolverás mañana antes de que Germán lo revise', b:'"Banderas críticas" — NO firmar hasta escalar a Mónica/dirección y documentar evidencia', c:'"Observaciones menores" — aunque sean graves, ese estatus genera menos alarma', d:'Cualquiera — el estatus es solo informativo sin consecuencias reales',
          correcta:'b', explicacion:'El estatus debe reflejar la realidad. Firmar "OK" con banderas críticas = responsabilidad tuya cuando aparezca el problema.' },
        { pregunta:'Si descubres una cortesía firmada CON TU NOMBRE pero TÚ no la autorizaste, ¿qué haces?',
          a:'NO firmas la conciliación. Documentas evidencia (foto, captura) y escalas inmediato a Mónica/dirección — es fraude operativo grave', b:'La firmas para regularizarla y que no quede bandera roja en el cierre', c:'La borras del sistema antes de que Mónica lo vea en auditoría', d:'La dejas pasar si el monto es menor a $500 — puede ser error del host',
          correcta:'a', explicacion:'Cortesía con tu nombre que tú no firmaste = fraude. NUNCA encubrir. Escalar inmediato con evidencia.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 10: Recetas y costeo ----------
    {
      titulo: 'Recetas y costeo',
      resumen: 'Cómo está organizado el catálogo de ingredientes y recetas, cómo se calcula el costo en vivo, y quién puede editar qué.',
      tiempo: 10,
      contenido: '## Para qué sirve el módulo Recetas\n\nEs el **cerebro financiero de la cocina**. Aquí vive el catálogo completo de ingredientes con precios, mermas y factores de rendimiento — y encima de eso, las recetas que combinan esos ingredientes para calcular el **costo real de cada platillo**.\n\nComo admin, puedes ver y editar todo. Esto te permite:\n- Auditar que los precios estén actualizados\n- Verificar que las mermas sean razonables\n- Aprobar recetas nuevas propuestas por los chefs\n- Diagnosticar por qué el costo de algún platillo es alto o bajo\n\n## Las 3 pestañas del módulo\n\n### Pestaña Recetas\nLista de todas las preparaciones del restaurante: entradas, ensaladas, guarniciones, rodizios.\n\nEn cada receta ves:\n- **Nombre** y área (Cocina / Churrasca)\n- **Rendimiento**: cuántas porciones hace la receta\n- **Lista de ingredientes** con cantidad y unidad\n- **Costo por porción** → calculado en vivo (suma de ingredientes ÷ rendimiento)\n- **Precio sugerido** → costo ÷ food_cost_pct (porcentaje de costo objetivo configurado)\n\n### Pestaña Sub-recetas\nPreparaciones intermedias que sirven como ingrediente de otras recetas: caldos, salsas, marinadas. Funcionan igual que las recetas pero su "precio" se usa en las recetas que las incluyen.\n\n### Pestaña Ingredientes\nEl catálogo maestro. Cada ingrediente tiene:\n\n| Campo | Significado |\n|-------|-------------|\n| `precio_real_unitario` | Precio de la última compra real (en MXN por unidad_base) |\n| `ultimo_costo` | Costo según SR12 (se actualiza al importar) |\n| `costo_promedio` | Promedio de los últimos N movimientos |\n| `merma_deshielo_pct` | % de peso que se pierde al descongelar |\n| `merma_aprovechable_pct` | % que se recicla en otras preparaciones (caldos, etc.) |\n| `merma_no_aprovechable_pct` | % que se tira (huesos, cascara, grasa no usable) |\n| `factor_rendimiento` | = 1 − merma_no_aprovechable (cuánto del ingrediente termina en el plato) |\n| `unidad_base` | kg / lt / pza (unidad de precio) |\n\n## Cómo se calcula el costo en vivo\n\n```\nCosto línea = cantidad × precio_real_unitario ÷ factor_rendimiento\nCosto total porción = Σ costos de líneas ÷ rendimiento\n```\n\nEjemplo: Picaña · 0.25 kg · precio $280/kg · factor 0.85 → Costo línea = $0.25 × $280 ÷ 0.85 = **$82.35**\n\n## Badge de stock SR12\n\nEn la tabla de ingredientes, cada uno con existencia SR12 > 0 muestra un badge **📦 X.X kg** con el stock actual en almacén. Esto ayuda a detectar ingredientes con precio desactualizado o con stock crítico.\n\nEl filtro **"Con stock SR12"** muestra solo los ingredientes que ya tienen vínculo con el catálogo del POS.\n\n## Quién puede editar qué\n\n| Rol | Ingredientes | Recetas (editar) | Recetas (proponer) |\n|-----|-------------|-----------------|--------------------|\n| **Admin / Gte. Adm** | ✅ Edición directa | ✅ Edición directa | — |\n| **Comprador** | ✅ Solo precios y mermas | — | — |\n| **Cocina / Churrasca** | — | — | ✅ Proponer nueva o cambio |\n| **Auditoria** | Solo lectura | Solo lectura | — |\n\n## Workflow de propuesta de receta (Modelo B)\n\n1. Chef va a la charola activa → tap "🔗 Proponer receta nueva"\n2. Llena el formulario: nombre, área, rendimiento, instrucciones, ingredientes\n3. La propuesta queda en estado **pendiente de aprobación**\n4. Admin o Gte. Adm la revisa en Recetas → la activa o rechaza\n5. Una vez activa, entra al cálculo de costos normal\n\nEsto garantiza que los chefs pueden capturar lo que saben sin que ningún cambio llegue directo a costos sin revisión.',
      quiz: [
        { pregunta:'¿Qué campo determina el costo real por unidad de un ingrediente?',
          a:'precio_real_unitario (precio de la última compra real, en MXN por unidad_base)', b:'ultimo_costo (viene del SR12, puede estar desactualizado)', c:'costo_promedio (promedio de los últimos N movimientos)', d:'merma_no_aprovechable_pct (porcentaje de pérdida no aprovechable)',
          correcta:'a', explicacion:'precio_real_unitario es el que usa el sistema para calcular el costo en vivo de las recetas. Se puede actualizar manualmente o vía importación SR12.' },
        { pregunta:'¿Qué hace el factor_rendimiento en el cálculo del costo?',
          a:'Multiplica el precio por el número de porciones que rinde la receta', b:'Convierte el precio de kg a gramos automáticamente para porcionar', c:'Divide el precio entre lo que realmente termina en el plato (descuenta la merma no aprovechable). A menor factor → mayor costo real', d:'No tiene efecto en el cálculo, es campo meramente informativo',
          correcta:'c', explicacion:'factor_rendimiento = 1 − merma_no_aprovechable_pct. Ingrediente con 20% de merma no aprovechable tiene factor 0.80 → el costo sube ~25% vs precio bruto.' },
        { pregunta:'¿Qué rol puede editar precios y mermas de ingredientes directamente (sin propuesta)?',
          a:'Solo el chef ejecutivo de cocina (Sergio)', b:'Admin, Gerente Administrativo y Comprador (Weslley)', c:'Cualquier usuario autenticado puede editar precios', d:'Solo Auditoría para mantener control de costos',
          correcta:'b', explicacion:'Comprador actualiza precios de compra; admin/gte_adm tienen acceso total. Los chefs solo pueden proponer recetas nuevas.' },
        { pregunta:'Cuando un chef propone una receta nueva desde la charola, ¿qué pasa con el costo?',
          a:'Se activa de inmediato y empieza a calcular costo en vivo', b:'El chef puede activarla él solo si tiene el ingrediente vinculado al SR12', c:'Se borra automáticamente si no tiene instrucciones en 24 horas', d:'Queda en pendiente — alguien con rol admin/gte_adm debe aprobarla antes de que entre al cálculo de costos',
          correcta:'d', explicacion:'Modelo B de autorización: propuesta → revisión admin → activación. Ningún cambio llega a costos sin revisión.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 11: Inventario Churrasca ----------
    {
      titulo: 'Inventario Churrasca',
      resumen: 'Cómo funciona el ciclo de inventario semanal de la zona churrasca: registro, entradas, salidas y diferencias.',
      tiempo: 8,
      contenido: '## Qué es el Inventario Churrasca\n\nEs el control de stock de la **zona de carnes y parrilla**. A diferencia de la cocina (que controla mermas por charola), en churrasca existe un **inventario semanal formal** que registra cuánto hay de cada producto al inicio de la semana, qué entró (compras), qué salió (uso en servicio) y qué queda al cierre.\n\nComo admin, tu responsabilidad es:\n- Entender el módulo para diagnosticar errores\n- Verificar que el inventario semanal se esté cerrando correctamente\n- Detectar diferencias significativas entre teórico y físico\n\n## Ciclo semanal Lun–Dom\n\n```\nLunes (apertura)    → Inventario físico inicial (conteo real)\nLun a Dom (diario)  → Entradas (compras/recepción) y Salidas (uso en servicio)\nDomingo (cierre)    → Inventario físico final + diferencias\nSiguiente lunes     → El final se convierte en el inicial\n```\n\n## Las 3 operaciones diarias\n\n### Entradas (compras/recepción)\nCuando llega mercancía a churrasca (carnes, carbón, sal gruesa, etc.):\n- Producto\n- Cantidad\n- Unidad (kg, pza, costal)\n- Proveedor (opcional)\n\n### Salidas (uso en servicio)\nLo que se consumió durante el servicio del día:\n- Producto\n- Cantidad usada\n- Turno (Desayuno / Comida / Buffet)\n\n### Mermas\nPérdidas no en servicio: deshielo excesivo, producto que llega en mal estado, caída de bandeja, etc.:\n- Producto\n- Cantidad perdida\n- Motivo (deshielo, caducidad, accidente)\n- Esta info alimenta el análisis de mermas del módulo de recetas\n\n## Diferencia: físico vs teórico\n\nEl sistema calcula automáticamente:\n\n```\nTeórico final = Inventario inicial + Entradas − Salidas − Mermas\nFísico final  = Lo que cuenta el churrasquero al cierre\nDiferencia    = Físico − Teórico\n```\n\n- **Diferencia < 0 (faltante)**: se usó más de lo registrado, o se perdió sin reportar\n- **Diferencia > 0 (sobrante)**: entró más de lo registrado, o hubo error de conteo\n- **Diferencia = 0**: inventario cuadrado (ideal)\n\n## Banderas de diferencia significativa\n\nEl sistema marca bandera si la diferencia supera el umbral configurado (ej: >5% en carnes). Una diferencia sistemática semana a semana puede indicar:\n- Mermas no reportadas\n- Entradas no capturadas\n- Error de conteo\n- En casos extremos: producto que se lleva sin registrar\n\n## Quién captura qué\n\n| Rol | Responsabilidad |\n|-----|-----------------|\n| **Churrasca** (Marcos) | Entradas, salidas, mermas diarias + conteo físico semanal |\n| **Admin / Gte. Adm** | Supervisión, diagnóstico de diferencias, aprobación de correcciones |\n| **Auditoría** | Revisión de diferencias históricas, detección de patrones |\n\n## Lo que ves como admin\n\n- Tabla de inventarios semanales (fecha, estado, diferencias)\n- Detalle de entradas/salidas por día\n- Gráfica de tendencia de diferencias\n- Exportar a Excel para análisis externo\n\n## Cómo diagnosticar una diferencia grande\n\n1. Abre el inventario semanal con diferencia\n2. Revisa las salidas del día con más diferencia (¿hay un día que salió mucho más?)\n3. Cruza con las charolas de churrasca de ese día (¿registró mermas?)\n4. Habla con Marcos: ¿hubo una merma accidental no capturada?\n5. Si hay merma accidental válida → corrección con motivo\n6. Si no hay justificación → bandera para auditoría',
      quiz: [
        { pregunta:'¿Con qué frecuencia se hace el inventario formal de churrasca?',
          a:'Diario, al cierre de cada servicio', b:'Mensual, junto con la auditoría contable de contabilidad', c:'Semanal (Lun–Dom). El cierre del domingo es el inicial del lunes siguiente', d:'Cada vez que el proveedor trae mercancía nueva',
          correcta:'c', explicacion:'Ciclo semanal. Lunes = conteo inicial, Domingo = conteo final. La diferencia entre ambos más entradas/salidas da el cuadre.' },
        { pregunta:'Si el inventario teórico dice que debería haber 50 kg de picaña y el físico dice 43 kg, ¿qué indica?',
          a:'Sobrante de 7 kg (entró más de lo registrado en el sistema)', b:'Inventario cuadrado — la diferencia está dentro de la tolerancia normal', c:'Error del sistema que se corrige automáticamente al día siguiente', d:'Faltante de 7 kg — se consumió o perdió más de lo registrado (merma no capturada, error de captura, o algo más grave)',
          correcta:'d', explicacion:'Faltante = Físico < Teórico. Causas: merma sin reportar, entrada sin capturar, error de conteo, o producto que sale sin registrar.' },
        { pregunta:'¿Qué es una "entrada" en el inventario churrasca?',
          a:'Mercancía que llega a la zona: compras, recepciones (carnes, carbón, etc.)', b:'El inicio de sesión del churrasquero en el sistema cada turno', c:'Una espada de carne que se sirve al cliente en el rodizio', d:'El sello de apertura del churrasquero al inicio del servicio',
          correcta:'a', explicacion:'Entrada = algo físico que entra al inventario (compra, recepción). Sale = lo que se usa en servicio. Diferencia = lo que falta sin explicación.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 12: Importar SR12 ----------
    {
      titulo: 'Importar SR12',
      resumen: 'Cómo subir los archivos de existencias del SoftRestaurant para actualizar costos y stock del catálogo de ingredientes.',
      tiempo: 10,
      contenido: '## Qué es el SR12\n\n**SoftRestaurant 12** es el POS (sistema de punto de venta) que usa Fogueira para registrar consumos, tickets y — lo más importante para nosotros — **el inventario físico de almacén** con costos reales de compra.\n\nEl módulo **Importar SR12** conecta ese inventario del POS con el catálogo de Fogueira. Al importar, el sistema actualiza automáticamente el `ultimo_costo` de cada ingrediente con el precio real de la última compra según SR12.\n\n**Filosofía aprobada por Germán:**\n> *SR12 es el espejo. Fogueira es el reflejo.*\n\nSR12 tiene los costos reales. Fogueira los refleja. Si hay contradicción, SR12 manda.\n\n## Los 6 archivos XLS de EXISTENCIAS\n\nSR12 exporta un archivo XLS por almacén (área). Fogueira espera hasta 6 archivos:\n\n| Almacén SR12 | Área equivalente |\n|--------------|------------------|\n| Almacén General | Stock principal |\n| Almacén Cocina | Cocina |\n| Almacén Churrasca | Churrasca |\n| Almacén Bar | Bar (si aplica) |\n| Almacén Frio | Refrigeración |\n| Almacén Seco | Abarrotes |\n\nUbicación en la computadora: `Inventarios SR12/` con los archivos `.XLS` exportados desde SoftRestaurant.\n\n## El proceso de importación: 4 pasos\n\n### Paso 1 — Subir archivos\n\nAbre el módulo "📥 Importar SR12" desde el inicio. Arrastra los 6 archivos XLS a la zona de carga o usa el botón "Seleccionar archivos". El sistema los lee en el navegador (sin subir a internet) y hace el análisis.\n\n### Paso 2 — Dry-run (ensayo sin cambios)\n\nSiempre primero el dry-run. El sistema te muestra **sin modificar nada en la base de datos**:\n\n- Cuántos productos hay en los archivos SR12\n- Cuántos matchearon con ingredientes de Fogueira (y cómo)\n- Cuántos no matchearon (huérfanos SR12)\n- Cuántos ingredientes de Fogueira no tienen match en SR12 (huérfanos Fogueira)\n- Cuántos precios cambiarían y en cuánto\n\nRevisar el dry-run es **obligatorio** antes de aplicar. Si ves algo raro (un ingrediente con precio absurdo, un match equivocado), puedes corregirlo antes de que impacte costos.\n\n### Paso 3 — Aplicar\n\nCuando el dry-run se ve bien, tap **"Aplicar importación"**. El sistema:\n- Actualiza `ultimo_costo` en cada ingrediente matcheado\n- Actualiza las existencias por área (`IngredientesSR12`)\n- Registra la importación en el log (`ImportacionesSR12`) con fecha, quién la hizo y resumen\n- Registra el detalle producto por producto (`ImportacionDetalleSR12`)\n\n### Paso 4 — Revisar resultados\n\nDespués de aplicar, el sistema muestra el resumen:\n- N ingredientes con costo actualizado\n- N auto-creados (productos nuevos que no existían en Fogueira)\n- N huérfanos (sin match)\n\nRevisa los huérfanos Fogueira y decide si necesitas vincularlos manualmente.\n\n## Matching: cómo se vinculan SR12 ↔ Fogueira\n\nEl sistema usa 4 reglas en orden de prioridad:\n\n| Regla | Descripción |\n|-------|-------------|\n| **A1** | Clave SR12 guardada en `IngredientesSR12Match` (matches manuales previos) |\n| **A2** | Clave SR12 directa en `Ingredientes.clave_sr12` |\n| **B** | Nombre exacto normalizado: Fogueira === SR12 |\n| **C** | Containment: tokens de Fogueira ⊂ tokens de SR12, tolerancia typo Levenshtein-1 |\n\n## Huérfanos — qué son y qué hacer\n\n**Huérfanos SR12** — productos en SR12 sin match en Fogueira: probablemente son ingredientes que aún no se han cargado en el catálogo o tienen nombre muy diferente.\n\n**Huérfanos Fogueira** — ingredientes en Fogueira sin match en SR12: sub-recetas (no son insumos directos), ingredientes preparados internamente, o ingredientes que ya no compran.\n\nLos huérfanos importantes deben vincularse manualmente desde el catálogo de ingredientes (campo `clave_sr12`).\n\n## Reversa — deshacer una importación\n\nSi algo salió mal (match equivocado, archivo corrompido), puedes **revertir la importación**:\n\n- Abre el log de importaciones\n- Encuentra la importación reciente\n- Tap "Revertir"\n- El sistema restaura los `ultimo_costo` anteriores y vacía las existencias actualizadas\n\nLa reversa también queda en el log con fecha y quién la hizo.\n\n## Cuándo hacer la importación\n\nRecomendado: **una vez por semana**, al inicio de la semana operativa (Lunes). Los costos de SoftRestaurant se actualizan cada vez que hay una nueva compra. Si hay compras frecuentes de ingredientes caros, importar más seguido da costos más precisos.',
      quiz: [
        { pregunta:'¿Qué hace el dry-run antes de aplicar la importación SR12?',
          a:'Borra todos los costos actuales para hacer espacio a los nuevos', b:'Aplica los cambios directamente pero solo a ingredientes con flag 📍', c:'Muestra el preview completo de qué cambiaría SIN modificar nada en la base de datos — seguro de correr', d:'Descarga los archivos XLS del POS automáticamente desde el servidor',
          correcta:'c', explicacion:'Dry-run = ensayo sin consecuencias. Siempre hacerlo primero para detectar matches incorrectos o precios absurdos antes de que impacten costos.' },
        { pregunta:'¿Qué son los "huérfanos Fogueira"?',
          a:'Ingredientes en el catálogo Fogueira que no tienen match con ningún producto de SR12 (sub-recetas, preparados internamente, o ya no se compran)', b:'Ingredientes eliminados accidentalmente durante una importación anterior', c:'Archivos XLS corruptos que el importador rechazó automáticamente', d:'Ingredientes de SR12 que no tienen equivalente en el catálogo Fogueira',
          correcta:'a', explicacion:'Huérfanos Fogueira no reciben actualización de costos de SR12. Si son insumos reales, conviene vincularlos manualmente.' },
        { pregunta:'Si después de aplicar la importación notas que un ingrediente quedó vinculado al producto incorrecto, ¿qué haces?',
          a:'Lo dejas así porque la siguiente importación lo corregirá sola', b:'Editas el costo directamente en la celda del Sheet a mano', c:'Deshabilitas el ingrediente para que no afecte las recetas', d:'Usas la función de Reversa para deshacer la importación, corriges el vínculo manualmente, y vuelves a importar',
          correcta:'d', explicacion:'Reversa restaura los costos anteriores. Después de corregir el match (campo clave_sr12 o IngredientesSR12Match), la siguiente importación cuadrará bien.' },
        { pregunta:'¿Cuántos archivos XLS espera el módulo de importación?',
          a:'Exactamente 1 (el archivo consolidado de todos los almacenes)', b:'Hasta 6 (uno por almacén de SoftRestaurant: General, Cocina, Churrasca, Bar, Frío, Seco)', c:'Cualquier cantidad sin límite', d:'Solo 2 (uno de existencias y uno de costos)',
          correcta:'b', explicacion:'Cada almacén de SR12 es un archivo XLS independiente. La importación los lee todos y consolida existencias y costos por área.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 13: Flujo de conciliación ----------
    {
      titulo: 'Flujo de conciliación — mapa completo',
      resumen: 'Visión panorámica del flujo completo del dinero: desde la reserva hasta el banco. Para entender el sistema como un todo y comunicarlo a dirección.',
      tiempo: 8,
      contenido: '## Por qué este módulo\n\nComo admin necesitas entender el **flujo completo** — no solo la parte técnica, sino cómo fluye el dinero y la información desde que un cliente reserva hasta que el efectivo llega al banco. Esto te permite:\n\n- Diagnosticar dónde se rompe el flujo cuando algo falla\n- Explicar el sistema a Germán, Mónica o a un auditor externo\n- Detectar en qué punto puede haber fuga de información o de dinero\n\n## El flujo completo — 6 etapas\n\n### Etapa 1 · Reserva\n```\nCliente → reservar.html (formulario público)\n       ↓\nHoja Reservas (con folio único, link de cancelación)\n       ↓\nNotificación automática al restaurante\n```\nPunto de control: el sistema limita el cupo por servicio. No puede haber más reservas que `cupo_por_servicio`.\n\n### Etapa 2 · Apertura del servicio\n```\nHost → firma sello apertura (bitacora.html)\nCajera → firma sello apertura + registra fondo de cambio (conciliacion.html)\nCocina → firma sello apertura (charolas.html)\nChurrasca → firma sello apertura (charolas.html)\n```\nPunto de control: 4 sellos de apertura. Si falta alguno → bandera visual al cierre.\n\n### Etapa 3 · Operación del servicio\n```\nHost → bitácora en vivo (grupos, mesas, cortesías, tarifas)\nCocina/Churrasca → charolas (qué sale al buffet, mermas)\nCajera → tickets en el POS (cobros, cancelaciones, cortesías)\n```\nPunto de control clave: **Δ Host vs POS** — la bitácora del host debe cuadrar con los comensales del POS. Si no cuadran → alguien cobró de más o de menos.\n\n### Etapa 4 · Cierre del servicio\n```\nHost → cierre de bitácora (hora_sal de todas las filas, sello)\nCajera → cierre de caja (corte por denominación, tarjetas, cortesías)\nAdmin/Gte.Adm → conciliación profunda\n        ├── Auto-llenar (consolida bitácoras)\n        ├── Arqueo ciego (contado vs teórico)\n        ├── Banderas rojas (10 checks automáticos)\n        └── Firma de cierre\n```\nPunto de control: el arqueo ciego es el cruce definitivo entre lo que se cobró según el sistema y lo que físicamente hay en caja.\n\n### Etapa 5 · Depósitos a tesorería\n```\nCajera/Admin → 2 depósitos obligatorios\n  Depósito 1: venta del día (efectivo + tarjetas)\n  Depósito 2: comisiones bancarias (análisis contable separado)\n        ↓\nFolios de tesorería registrados en conciliación\n```\nPunto de control: si falta uno de los dos depósitos → bandera roja, cierre no puede firmarse.\n\n### Etapa 6 · Cierre de lote bancario\n```\nCajera → cierre de lote de cada terminal\n       ↓\nVouchers físicos contados\n       ↓\nΔ Terminal vs POS (debe ser cero)\n```\nPunto de control: el lote bancario debe cuadrar con lo que el POS reportó en tarjetas. Si no → algún cobro no se aplicó bien o hubo devolución no registrada.\n\n## Dónde puede haber fuga — mapa de riesgo\n\n| Punto | Riesgo | Cómo se detecta |\n|-------|--------|-----------------|\n| Etapa 3 · Cortesías sin autorización | Regalos no autorizados | Bandera: cortesía sin "autoriza" |\n| Etapa 3 · Cobros sin ticket | Efectivo que no entra a caja | Bandera: Δ Host vs POS |\n| Etapa 4 · Arqueo con faltante | Efectivo que salió de caja sin registro | Arqueo ciego |\n| Etapa 4 · No-sales | Cajón abierto sin venta | KPI "No-sales > 2" |\n| Etapa 4 · Saltos en folios | Tickets anulados o no reportados | Bandera: folios no consecutivos |\n| Etapa 5 · Depósito incompleto | Efectivo que no llega al banco | Bandera: falta depósito |\n| Etapa 6 · Δ Terminal vs POS | Cobro duplicado o devolución oculta | KPI Δ Terminal |\n\n## Para comunicarlo a dirección\n\nCuando Germán te pregunta "¿cómo sé que el sistema protege el dinero?", puedes responder:\n\n1. **Doble registro**: host captura comensales, POS registra cobros — ambos deben cuadrar\n2. **Sellos autenticados**: cada actor firma con su identidad en cada paso clave\n3. **Cortesías trazadas**: cada peso de cortesía lleva nombre del que autorizó\n4. **Arqueo ciego**: el sistema calcula lo teórico sin ver lo contado; la cajera cuenta sin saber qué espera el sistema\n5. **Depósitos obligatorios**: el efectivo tiene que llegar documentado al banco\n6. **Cierre bancario cruzado**: el lote de la terminal se cruza con el POS\n\nNingún punto es 100% infalible, pero cada uno requiere colusión de al menos 2 personas para saltarse sin dejar rastro.',
      quiz: [
        { pregunta:'¿Cuántos depósitos a tesorería se deben hacer por servicio y para qué?',
          a:'Solo uno con todo junto al final del turno (más eficiente)', b:'Tantos como tipos de tarjeta que se usaron en el día', c:'DOS: Depósito 1 (venta del día) y Depósito 2 (comisiones bancarias). Se separan para análisis contable diferenciado', d:'Ninguno si el banco hace el corte automáticamente al día siguiente',
          correcta:'c', explicacion:'Reglas Fogueira: separación contable obligatoria. Sin los dos → bandera roja, no se puede firmar el cierre.' },
        { pregunta:'El indicador "Δ Host vs POS" mide:',
          a:'La diferencia de tiempo en minutos entre el turno de apertura y cierre', b:'La diferencia de propinas entre hosts y cajera al final del día', c:'El tiempo promedio de atención por mesa según el POS durante el servicio', d:'La diferencia entre comensales registrados por el host en bitácora vs personas registradas en tickets del POS. Debe ser cercano a cero',
          correcta:'d', explicacion:'Si no cuadran → alguien cobró sin registrar en bitácora, o el host capturó sin que hubiera cobro. Es el cruce más importante anti-fraude.' },
        { pregunta:'¿Qué es el "arqueo ciego" y por qué se llama así?',
          a:'El sistema calcula el teórico sin que la cajera sepa el número; ella cuenta lo físico sin saber qué espera el sistema. Al comparar, ninguno pudo "ajustar" al otro', b:'La cajera cuenta el efectivo con los ojos cerrados para no distraerse', c:'Un formato de Excel que usa el banco para liquidar tarjetas al final del mes', d:'El nombre del turno nocturno cuando el restaurante está cerrado al público',
          correcta:'a', explicacion:'El "ciego" es intencional: si la cajera supiera el teórico, podría ajustar el conteo. Así el cruce es honesto e independiente.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 14: Mi manual (El instructivo) ----------
    {
      titulo: 'Mi manual — El instructivo del sistema',
      resumen: 'Cómo navegar el manual operativo del sistema. Como admin ves todos los manuales de todos los roles.',
      tiempo: 5,
      contenido: '## Qué es el Instructivo\n\nEl **Instructivo** (o "Mi manual") es la guía operativa del sistema, diseñada para **consulta rápida durante la operación**. No es para aprender — es para cuando ya sabes y necesitas recordar un detalle específico.\n\nDiferencia clave:\n\n| | Curso (capacitación) | Manual (instructivo) |\n|-|----------------------|---------------------|\n| **Cuándo usarlo** | Antes de empezar a trabajar | Durante la operación |\n| **Formato** | Módulos en secuencia, quiz | Consulta rápida por sección |\n| **Objetivo** | Aprender y certificarse | Recordar un paso específico |\n| **Duración** | ~90 min por rol | 1-2 min por consulta |\n\n## Cómo está organizado\n\nEl instructivo tiene secciones por tema operativo:\n\n1. **Bienvenida** — visible para todos los roles\n2. **Host / Reservaciones** — bitácora, plano, walk-ins, cierre\n3. **Cocina / Churrasca** — charolas, mermas, sellos\n4. **Cajera** — apertura, cobros, cierre, corte\n5. **Gerentes** — cortesías, override, conciliación, config\n6. **Reglas de tarifas** — tabla de edades y precios\n7. **FAQ** — preguntas frecuentes del equipo\n8. **Soporte** — qué hacer cuando algo falla\n\n## Filtrado por rol — solo ves lo tuyo\n\nCada sección tiene un atributo `data-roles` que controla quién la ve:\n\n- Un **host** solo ve las secciones de host + reglas + FAQ\n- Un **chef** solo ve cocina + reglas + FAQ\n- **Admin y Gte. Adm** ven **TODAS** las secciones de todos los roles\n\nEsto significa que como admin, el instructivo es también una forma de **auditar qué información tiene disponible cada rol** y detectar si falta algo.\n\n## Por qué el admin debe conocer TODOS los manuales\n\nCuando un host te llama porque "el sistema no le deja cerrar la bitácora", necesitas:\n1. Saber qué ve ese host en su instructivo\n2. Poder diagnosticar si el problema es operativo (el host se saltó un paso) o técnico (bug del sistema)\n\nSi solo conoces el instructivo de admin, no puedes diagnosticar el 80% de los problemas que te van a reportar.\n\n## El FAQ — las preguntas que más hacen\n\nLas preguntas frecuentes del instructivo están curadas con las dudas reales del equipo:\n\n- ¿Qué hago si el sistema no carga?\n- ¿Cómo cancelo una reserva que ya llegó?\n- ¿El sistema guarda si se va el internet?\n- ¿Cómo cambio mi contraseña?\n- ¿Qué hago si me equivoqué en una captura?\n\nComo admin, **conocer el FAQ de memoria** te ahorra el 60% de las llamadas de soporte.\n\n## Hábito recomendado\n\n- **Al dar de alta a un nuevo usuario**: que abra el instructivo el primer día, antes incluso de ver el curso. Le da contexto antes de sumergirse en módulos.\n- **Cuando algo falla**: abre el instructivo del rol del usuario que reporta el problema — ahí está el paso que probablemente se saltó.\n- **Mensual**: revisa el FAQ con Mónica para agregar nuevas preguntas frecuentes que el equipo esté preguntando repetidamente.',
      quiz: [
        { pregunta:'¿Cuál es la diferencia entre el Curso y el Manual (instructivo)?',
          a:'El manual es para certificarse y el curso para consulta rápida', b:'Ambos sirven para lo mismo; el manual es solo una versión comprimida del curso', c:'El manual es más largo y detallado que el curso de cada rol', d:'El Curso es para aprender y certificarse (módulos en secuencia, ~90 min). El Manual es para consulta rápida durante la operación (1-2 min por tema)',
          correcta:'d', explicacion:'Herramientas distintas para momentos distintos. El curso forma; el manual consulta. Ambos son necesarios.' },
        { pregunta:'Como admin, ¿qué secciones del instructivo puedes ver?',
          a:'TODAS las secciones de todos los roles (host, cocina, cajera, gerentes, FAQ, soporte) — para poder diagnosticar y dar soporte a cualquier usuario', b:'Solo la sección de admin y el FAQ general', c:'Solo FAQ y soporte técnico del sistema', d:'Solo la sección que corresponde al turno activo en ese momento',
          correcta:'a', explicacion:'data-roles="admin" incluye admin en todas las secciones. Conocer el instructivo de cada rol es clave para dar soporte efectivo.' },
        { pregunta:'Un host te llama porque "no puede cerrar la bitácora". ¿Cuál es tu primer paso?',
          a:'Hacer deploy inmediato del sistema para resolver el posible bug', b:'Pedirle que espere mientras investigas el código fuente del servidor', c:'Abrir el instructivo sección Host y revisar los pasos del cierre — en el 80% de los casos es un paso operativo que se saltó (no un bug)', d:'Reiniciar la sesión del host desde Admin → Usuarios de inmediato',
          correcta:'c', explicacion:'La mayoría de reportes de soporte son pasos operativos omitidos, no bugs. El instructivo del rol del usuario es tu primera herramienta de diagnóstico.' }
      ],
      minAprobatorio: 3
    }
  ];
}

// Curso del Gerente Administrativo (Mónica). El rol más completo del sistema.
// Hereda admin completo + operación administrativa día a día + autoriza cortesías junto con Gabriel +
// supervisa a los gerentes + auditoría operativa. 10 módulos puramente gerenciales/administrativos.
function modulosCursoGerenteAdministrativo() {
  return [
    // ---------- Módulo 1: Tu rol como Gerente Administrativo ----------
    {
      titulo: 'Tu rol como Gerente Administrativo',
      resumen: 'Quién eres en la organización, qué privilegios heredas, a quién supervisas y cuándo escalar.',
      tiempo: 5,
      contenido: '## Tu posición en Fogueira\n\nComo **Gerente Administrativo**, eres la **mano derecha de la dirección** (Germán) en la operación día a día del restaurante. Tu rol es el **más completo** del sistema porque:\n\n- **Heredas todos los privilegios de admin** — puedes operar el panel completo de Configuración\n- **Supervisas a Gabriel** (Gerente de Restaurante) en lo operativo\n- **Autorizas cortesías** junto con Gabriel — son los DOS únicos\n- **Operas la conciliación financiera** del día (apertura + cierre + resumen)\n- **Ejecutas auditoría operativa** detectando patrones sospechosos\n- **Eres el punto de escalación** para todos los demás roles\n\n## Organigrama\n\n```\n              Dirección (Germán)\n                      |\n         Gerente Administrativo (TÚ)\n          |                      |\n  Gerente de Restaurante    Auditoría / Admin técnico\n     (Gabriel)\n          |\n  Encargado de piso\n          |\n   Hosts, Cocina, Cajera, Churrasca\n```\n\n## Lo que heredas del rol "admin"\n\nLa función `rolEs(u, ["admin"])` del sistema **te incluye automáticamente**. Esto significa que cualquier endpoint que requiera admin, también te lo permite a ti. No hay restricción técnica — la única autoridad por encima de ti en el sistema es la dirección (Germán).\n\nEjemplos de privilegios que tienes:\n- Crear/editar/desactivar usuarios\n- Cambiar tarifas\n- Modificar configuración del restaurante\n- Resetear intentos de certificación de cualquiera\n- Override de cualquier sello\n- Ver y exportar histórico de conciliaciones\n\n## Tu autoridad sobre los gerentes\n\n- **Gabriel (Gerente Restaurante)** te reporta lo operativo. Si decide algo que tú no apruebas, tú decides arriba de él.\n- **Encargados de piso, hosts, cocina, cajera, churrasca** te reportan a través de Gabriel — pero tú puedes intervenir directamente cuando sea necesario.\n\n## Cuándo escalar a Germán\n\nEscala SIEMPRE estos casos:\n\n- **Pérdidas materiales > $5,000** (caída de mercancía, accidente con cliente)\n- **Reclamo legal o sanitario** (intoxicación, lesión, demanda)\n- **Sospecha de fraude operativo** (cortesías firmadas sin tu autorización, faltantes recurrentes)\n- **Decisiones financieras grandes** (cambios de tarifa, contrataciones)\n- **Problemas técnicos del sistema** que requieren acción de admin\n- **Conflictos serios con personal** que ameriten despido o amonestación formal\n\n## Tu día típico en el sistema\n\nUn día normal de Mónica:\n\n- **Mañana**: revisa banderas pendientes del día anterior, procesa overrides si aplica\n- **Apertura del servicio**: supervisa que cocina/churrasca firmen sello, verifica tarifas vigentes\n- **Durante operación**: disponible para autorizar cortesías cuando hosts te llaman\n- **Cierre del servicio**: supervisas a la cajera en cierre profundo, validas banderas, firmas resumen\n- **Cierre del día**: tu firma del resumen sella la operación del día\n\n## Habilidades que necesitas\n\n1. **Lectura de números** — los KPIs del Resumen son tu pan diario\n2. **Detección de patrones** — banderas frecuentes, cortesías repetidas, faltantes recurrentes\n3. **Autoridad firme pero amable** — eres líder operativo, no administrador distante\n4. **Comunicación con dirección** — Germán confía en ti para que filtres lo importante\n\n## Tu firma vale\n\nCada cosa que firmas (cortesías, conciliaciones, overrides) tiene **peso legal y de auditoría**. Tu nombre queda en el sistema con timestamp exacto. La dirección y auditoría externa pueden revisarlo.\n\nEsto NO es para asustar — es para que sepas que **tu firma es seria**. Firma con calidad, no con prisa.',
      quiz: [
        { pregunta:'¿Qué rol del sistema HEREDA todos los privilegios de admin (acceso técnico completo)?',
          a:'host', b:'cajera', c:'gerente_administrativo (TU rol)', d:'observador',
          correcta:'c', explicacion:'gerente_administrativo (Mónica) hereda admin completo. Por eso puedes operar todo el panel de Configuración.' },
        { pregunta:'¿Qué casos SIEMPRE debes escalar a la dirección (Germán)?',
          a:'Cualquier cosa pequeña del día a día', b:'Solo conflictos con el personal', c:'Solo si el cliente reclama en redes sociales', d:'Pérdidas materiales >$5K, reclamo legal/sanitario, sospecha de fraude, decisiones financieras grandes, problemas técnicos serios',
          correcta:'d', explicacion:'Lo legal, financiero grande o que dañe imagen va a dirección. Lo operativo del día tú lo manejas con tu autoridad.' },
        { pregunta:'¿Quiénes te reportan operativamente?',
          a:'Gabriel (Gerente Restaurante) y a través de él: encargado de piso, hosts, cocina, cajera, churrasca. Auditoría también está bajo tu radar', b:'Solo la cajera', c:'Solo los hosts del turno', d:'Solo Germán directamente',
          correcta:'a', explicacion:'Eres mano derecha de dirección con autoridad sobre gerentes y todo el equipo operativo.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 2: Gestión de usuarios ----------
    {
      titulo: 'Gestión de usuarios y permisos',
      resumen: 'Crear, editar, desactivar usuarios. Cambiar contraseñas. Resetear intentos de certificación. Dominio total del panel Usuarios.',
      tiempo: 8,
      contenido: '## Tu pantalla principal: Admin → Usuarios\n\nDesde Configuración → pestaña Usuarios accedes a todo el equipo. Como gerente_administrativo puedes:\n\n- Ver lista completa de usuarios\n- Crear nuevos\n- Editar (rol, sucursal, datos)\n- Cambiar contraseñas\n- Desactivar (soft-delete con auditoría)\n- Reactivar usuarios desactivados\n- Resetear intentos de certificación\n\n## Crear un usuario nuevo\n\n**+ Nuevo usuario** abre formulario:\n\n| Campo | Notas |\n|-------|-------|\n| Nombre completo | Como aparece en el sistema |\n| Email | Único en el sistema (único campo de identidad) |\n| Rol | Uno de los 10 disponibles |\n| Sucursal | Vacío = global a Fogueira; concreto = solo esa sucursal |\n| Contraseña inicial | El sistema la hashea SHA-256 |\n| Activo | Sí (default) |\n\nLa **contraseña la das tú al usuario** (en persona o WhatsApp). NO se manda por email automático.\n\n## Los 10 roles del sistema\n\n| Rol | Foco | Examen |\n|-----|------|--------|\n| `admin` | Técnico | Sí |\n| `auditoria` | Revisión y verificación | Sí |\n| `cajera` | Caja, conciliación | Sí |\n| `host` | Reservas, bitácora | Sí |\n| `cocina` | Charolas, mermas | Sí |\n| `churrasca` | Espadas, mermas | Sí |\n| `encargado_piso` | Coordinación operativa | Sí |\n| `gerente_restaurante` | Cortesías, supervisión | Sí |\n| `gerente_administrativo` | Tu rol | Sí |\n| `observador` | Solo lectura | **NO** (exento) |\n\n## Sistema de herencia\n\nLo que un rol "hereda" de otro significa que **automáticamente** tiene los permisos del padre:\n\n- `gerente_administrativo` (TÚ) → hereda `admin` completo\n- `gerente_restaurante` (Gabriel) → hereda `host`\n- `observador` → hereda **acceso de lectura** de host (no escritura)\n\n## NUNCA se elimina un usuario\n\nUsa **Desactivar** en lugar de eliminar:\n\n- ✅ El usuario no podrá iniciar sesión\n- ✅ Su histórico (capturas, sellos, cortesías) se preserva\n- ✅ Auditoría puede revisar lo que hizo cuando estaba activo\n- ✅ Si lo necesitas de vuelta, lo reactivas (en lugar de recrearlo)\n\nEjemplo: una host que se va por temporada → desactivar. Si vuelve en 3 meses → reactivar (mantiene su histórico).\n\n## Cambiar contraseña de un usuario\n\nDesde Admin → Usuarios → botón **🔑** del usuario. La nueva contraseña se hashea y reemplaza. **Avísale en persona o por WhatsApp** — el sistema NO le manda email automático.\n\n## Resetear intentos de certificación\n\nSi un usuario reprobó las 3 veces el examen (queda **bloqueado_por_intentos**), puedes resetear sus intentos desde **Admin → Certificaciones → tabla del equipo → botón "Resetear"** del usuario.\n\n**REGLA**: solo resetear DESPUÉS de capacitación real. Si solo reseteas porque el usuario te lo pidió, es como dar 3 oportunidades infinitas — pierde el sentido el examen.\n\nLa acción queda registrada con tu identidad y timestamp.\n\n## Cambiar el rol de un usuario\n\nSe puede pero **OJO**: el progreso del curso del usuario está atado al rol viejo. Si cambias el rol, debe rehacer el curso del nuevo rol completo. Lo más limpio para "ascensos":\n\n- host → gerente_restaurante: rehace los 6 módulos del host en rol nuevo + los 4 extra\n- O: lo dejas como host con un acuerdo de "después le abrimos el rol superior cuando se certifique"',
      quiz: [
        { pregunta:'¿Qué pasa al "desactivar" un usuario en lugar de eliminarlo?',
          a:'Se borra físicamente', b:'Pierde sus capturas previas en el sistema', c:'Se cambia el rol automáticamente', d:'Se desactiva (no puede entrar) pero su histórico se preserva. Reactivable después',
          correcta:'d', explicacion:'NUNCA borrar físicamente. Soft-delete con auditoría es la regla — si vuelve, reactivas y mantiene historial.' },
        { pregunta:'Un usuario reprobó las 3 veces el examen. ¿Cuándo es válido resetear sus intentos?',
          a:'SOLO después de capacitación real (con repaso del manual y curso). Sin capacitación, perderías el sentido del examen', b:'Cuando el usuario te lo pida por WhatsApp', c:'Cualquier viernes antes del servicio', d:'Nunca se puede resetear',
          correcta:'a', explicacion:'Resetear sin capacitación = oportunidades infinitas. La regla es: capacitar primero, resetear después.' },
        { pregunta:'Si una host se va por temporada (3 meses), ¿qué haces con su cuenta?',
          a:'La eliminas para liberar el email en el sistema', b:'La desactivas (mantienes histórico). Si vuelve, reactivas en 1 click', c:'Cambias su contraseña para que nadie entre', d:'No haces nada y la dejas activa',
          correcta:'b', explicacion:'Desactivar preserva su trabajo. Reactivar es 1 click. Si la eliminas, pierdes la trazabilidad de lo que hizo cuando estaba.' },
        { pregunta:'¿Cómo se almacenan las contraseñas en el sistema?',
          a:'En texto plano en la hoja Usuarios', b:'Encriptadas reversibles (se pueden descifrar)', c:'Hash SHA-256 (one-way). Imposible recuperar el password original; solo verificar coincidencia. Si olvida, hay que cambiarlo (no recuperarlo)', d:'En sessionStorage del navegador',
          correcta:'c', explicacion:'Hashing one-way para seguridad. Si olvida, le pones nueva contraseña — no se puede recuperar la vieja.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 3: Configuración del restaurante (énfasis pedido) ----------
    {
      titulo: '⚙ Configuración del restaurante',
      resumen: 'Tu pantalla más poderosa: las claves que controlan TODO el comportamiento del sistema. Mesas, horarios, cupos, gerentes.',
      tiempo: 11,
      contenido: '## Tu pantalla más poderosa\n\n**Admin → Configuración** controla CÓMO se comporta el sistema. Cada clave aquí afecta a todo el equipo. Cambios mal hechos pueden dejar al restaurante operando con reglas equivocadas (cupo doble, horarios cerrados, mesas faltantes).\n\nPor eso este módulo tiene énfasis especial. Lee con calma.\n\n## Las claves principales y qué controla cada una\n\n### 1. `cupo_por_servicio` (default: 50)\n**Qué controla**: cuántas reservas online se aceptan máximo POR servicio.\n\n**Ejemplo**: si pones 50, después de 50 reservas confirmadas en un día/servicio, el formulario público bloquea nuevas. Walk-ins NO se cuentan en este cupo (aforo físico aparte).\n\n**Cuándo cambiar**:\n- Si Fogueira amplía o reduce capacidad\n- Si quieres más walk-ins (bajar cupo de online)\n- Para servicios especiales (banquetes)\n\n### 2. `slot_minutos` (default: 15)\n**Qué controla**: granularidad de horarios reservables. Con 15, los clientes pueden reservar 1:00, 1:15, 1:30...\n\nNo recomendado bajar de 15 (carga de hosts) ni subir más de 30 (mala UX cliente).\n\n### 3. `umbral_grupo_grande` (default: 10)\n**Qué controla**: grupos > N personas NO se confirman automáticamente. Quedan en `pendiente_confirmacion` para que un host hable con el cliente.\n\nÚtil porque grupos grandes requieren preparación especial (mesas juntas, personal extra).\n\n### 4. `tolerancia_minutos` (default: 10)\n**Qué controla**: tiempo de tolerancia interno antes de marcar visualmente una reserva como atrasada (rojo en pantalla del host).\n\nNo cancela sola — es solo señal visual. El host decide marcarla "No llegó" con motivo.\n\n### 5. `horario_estelar_desde` y `horario_estelar_hasta`\n**Default**: 15:00 a 18:00 (3pm a 6pm)\n\n**Qué controla**: ventana de tiempo más demandada. Se muestra al cliente al reservar como aviso "Horario más demandado".\n\nNo bloquea reservas, solo informa para que el cliente decida.\n\n### 6. `aforo_fisico` (default: 92)\n**Qué controla**: capacidad TOTAL del restaurante. Suma de reservas + walk-ins. Es el límite duro.\n\n**Cuidado**: este número debe coincidir con la capacidad real (mesas + permisos). Cambiarlo sin razón es peligroso.\n\n### 7. `mesas_salon` (formato especial — ver abajo)\n**Qué controla**: las mesas físicas del salón con sus capacidades y zonas.\n\n### 8. `gerente_administrativo_nombre` (Mónica)\n### 9. `gerente_restaurante_nombre` (Gabriel)\n**Qué controlan**: aparecen como opciones en el dropdown "Autoriza" de cortesías. Si cambias el nombre, las cortesías históricas mantienen el nombre anterior (no se reescriben).\n\n## Formato de `mesas_salon`\n\n### Con zonas (recomendado)\n```\nSalón:1:4,2:4,3:4,4:4|Terraza:30:4,31:4,32:6\n```\n\nReglas:\n- Zonas separadas por `|`\n- Cada zona: `Nombre:mesas`\n- Cada mesa: `id:capacidad`\n- Si solo pones `1` sin capacidad → default 4 pax\n\n### Sin zonas (legacy)\n```\n1:4,2:4,3:6,4:8\n```\n\nEl sistema detecta saltos > 5 entre IDs y agrupa zonas automáticamente.\n\n### Ejemplo Fogueira completo\n```\nSalón:1:4,2:4,3:4,4:4,5:4,6:2,7:4,8:4,9:4,10:3,11:2,12:2,20:3,21:4,22:3,23:3,40:4,41:4|Terraza:30:4,31:4,32:4,33:4,34:4,35:4\n```\n\nIDs pueden ser numéricos (1, 2, 3) o claves alfanuméricas (A1, B1).\n\n## Pestaña Horarios operativos\n\nDentro de Admin → Configuración hay una **tabla de horarios** debajo de las claves. Una fila por (día_semana × servicio):\n\n| Día | Servicio | Apertura | Cierre | Activo |\n|-----|----------|----------|--------|--------|\n| Lun | Buffet completo | 13:00 | 23:00 | Sí |\n| ... | ... | ... | ... | ... |\n| Vie | Desayuno | 08:00 | 12:00 | Sí |\n| Vie | Comida | 13:00 | 23:00 | Sí |\n| Sáb | Desayuno | 08:00 | 12:00 | Sí |\n| ... | ... | ... | ... | ... |\n\n**Una reserva debe caer dentro de algún renglón ACTIVO** para ser aceptada. Si desactivas un día/servicio, no se aceptan reservas para ese momento.\n\n## Cómo cambiar configuración con seguridad\n\n### Reglas de oro\n\n1. **Antes de cambiar**: anota el valor actual en algún lado (por si tienes que revertir)\n2. **Cambios en horario operativo**: NUNCA durante un servicio activo (afecta reservas en vuelo)\n3. **Cambios en mesas**: hazlo en horario no operativo (puede confundir al equipo)\n4. **Cambios en gerente_nombre**: NO cambies el rol asignado a alguien sin avisar primero\n\n### Verifica después de cambiar\n\n1. Recarga el formulario público de reservas y verifica que se vea correctamente\n2. Recarga la bitácora del host y verifica el plano del salón\n3. Si algo se ve raro → revierte el cambio\n\n## Setup completo desde cero (cuando se vende a otra empresa)\n\nSi en el futuro vendemos el sistema y hay que configurar otra empresa, los pasos:\n\n1. Cargar todas las claves principales (cupo, slot, etc.)\n2. Cargar mesas_salon con la geometría real del nuevo restaurante\n3. Cargar todos los horarios operativos por día/servicio\n4. Cargar las tarifas iniciales en pestaña Tarifas (módulo siguiente)\n5. Cargar usuarios iniciales (admin, gerentes, hosts)\n\nEl sistema es **multi-tenant ready** (`empresa_id` + `sucursal_id` en casi todas las tablas), pero los bootstraps actuales son específicos de Fogueira. Para venta futura, hay que parametrizar.',
      quiz: [
        { pregunta:'¿Cuál es el formato CORRECTO para definir mesas con zonas en la configuración?',
          a:'1,2,3,4 (IDs separados por coma)', b:'Salón:1:4,2:4|Terraza:30:4,31:6', c:'mesa1=4, mesa2=6 (clave=valor)', d:'{"salon":[1,2],"terraza":[30,31]} (JSON)',
          correcta:'b', explicacion:'Zonas separadas por |, cada zona con nombre:mesas, mesas con id:capacidad separadas por coma.' },
        { pregunta:'La clave `cupo_por_servicio` (default 50), ¿qué controla exactamente?',
          a:'Cuántas RESERVAS ONLINE se aceptan máximo por servicio. Walk-ins NO se cuentan aquí (aforo aparte)', b:'Aforo físico total incluyendo walk-ins', c:'Total de comensales autorizados por la Secretaría de Salud', d:'Número de mesas activas por turno',
          correcta:'a', explicacion:'Cupo es solo de reservas online. Walk-ins suman aparte hasta el aforo_fisico (92).' },
        { pregunta:'¿En qué momento NUNCA debes cambiar horarios operativos?',
          a:'En lunes antes de la apertura', b:'Durante un servicio activo (afecta reservas en vuelo). Hazlo en horario no operativo', c:'De noche después del cierre', d:'Cualquier momento si lo haces rápido',
          correcta:'b', explicacion:'Cambios en horarios pueden bloquear reservas que estaban siendo procesadas. Hazlo cuando el restaurante esté cerrado.' },
        { pregunta:'Si cambias el valor de `gerente_administrativo_nombre` (de Mónica a otro nombre), ¿qué pasa con las cortesías históricas?',
          a:'Se reescriben automáticamente con el nuevo nombre', b:'Se borran y deben recapturarse', c:'Se duplican (histórico + nuevo nombre)', d:'Se mantienen con el nombre anterior (auditoría preserva el dato del momento de la firma)',
          correcta:'d', explicacion:'Las cortesías ya firmadas son evidencia histórica — no se reescriben. Solo las nuevas usarán el nombre actualizado.' },
        { pregunta:'¿Por qué el `umbral_grupo_grande` existe (default 10)?',
          a:'Para cobrar más caro a grupos grandes', b:'Para rechazar automáticamente reservas de grupos', c:'Grupos >N personas requieren preparación especial (mesas juntas, personal). NO se confirman automáticamente; quedan en pendiente_confirmacion para que host hable con cliente', d:'Para limitar la capacidad legal del restaurante',
          correcta:'c', explicacion:'Confirmar automáticamente un grupo de 15 personas sin verificar capacidad real puede causar problema operativo. Pendiente_confirmacion permite intervención humana.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 4: Tarifas y promociones ----------
    {
      titulo: 'Tarifas vigentes y promociones',
      resumen: 'Sistema de versionamiento de precios con histórico. Cómo cambiar tarifas sin perder el pasado. Promociones tipo DUO.',
      tiempo: 7,
      contenido: '## Sistema de versionamiento de tarifas\n\nLa hoja `Tarifas` mantiene **el histórico completo** de precios con un patrón inteligente:\n\n```\nid, empresa_id, sucursal_id, fecha_desde, servicio, dias_semana, hora_desde, hora_hasta, t_adulto, t_nino, t_3era\n```\n\n**Cada cambio de precio NO sobrescribe el anterior — crea una NUEVA fila** con el `fecha_desde` actualizado.\n\n### Ejemplo práctico\n\nFila 1 (vigente desde 2026-01-01):\n```\nfecha_desde=2026-01-01, servicio="Buffet completo", t_adulto=$590, t_nino=$249\n```\n\nEl 2026-06-01 sube precios. Creas fila 2:\n```\nfecha_desde=2026-06-01, servicio="Buffet completo", t_adulto=$620, t_nino=$269\n```\n\n**Fila 1 NO se borra**. Siguen ambas. La fila VIGENTE en cualquier fecha es la que tiene `fecha_desde` más cercano hacia atrás:\n- Conciliación de mayo 2026 → usa Fila 1 ($590)\n- Conciliación de julio 2026 → usa Fila 2 ($620)\n\n## Por qué este diseño\n\n1. **Auditoría perfecta**: cualquier conciliación pasada usa los precios correctos de su fecha\n2. **Reportes históricos correctos**: si haces análisis de mayo vs julio, los precios reales se aplican\n3. **Rollback seguro**: si te equivocaste subiendo el precio, agregas otra fila con la fecha actual revirtiendo\n\n## Cómo cambiar precios desde Admin\n\n**Admin → Tarifas vigentes**:\n\n1. Ves la lista de tarifas actuales\n2. Click en **+ Nueva tarifa**\n3. Captura:\n   - **Fecha desde**: cuándo entra en vigor (puede ser hoy o futura)\n   - **Servicio**: Buffet completo / Desayuno / Comida\n   - **Días semana**: 1-7 (lunes a domingo) — formato CSV con apóstrofe (`\'1,2,3,4` para Lun-Jue)\n   - **Hora desde / hora hasta**: ventana del servicio\n   - **t_adulto**: tarifa adulto\n   - **t_nino**: tarifa niño 6-10\n   - **t_3era**: tarifa 3a edad\n4. Guardar\n\n## Cuidado con el formato CSV en Sheets locale es-MX\n\nLas celdas `dias_semana` con valor `"1,2,3,4"` se interpretan como número 1234 en locale es. **Solución**: prefijar con apóstrofe: `\'1,2,3,4`. El apóstrofe le dice a Sheets "esto es texto, no número".\n\nEsto está MUY documentado porque ya hubo bug por esto.\n\n## Tarifas actuales de Fogueira\n\n| Día | Horario | Servicio | t_adulto | t_nino (6-10) | t_3era |\n|-----|---------|----------|----------|---------------|--------|\n| Lun-Jue | 1pm-11pm | Buffet completo | $590 | $249 | $590 |\n| Vie-Dom | 8am-12pm | Desayuno | $299 | $249 | $299 |\n| Vie-Dom | 1pm-11pm | Comida | $590 | $249 | $590 |\n\nCortesías automáticas:\n- **0-5 años**: Gratis (no pagan)\n- **11+ años**: tarifa adulto (NO niño)\n\n## Promociones (tabla aparte)\n\nLa hoja `Promociones` guarda promociones tipo DUO:\n\n```\nid, empresa_id, sucursal_id, nombre, descripcion, dias_semana, hora_desde, hora_hasta, personas_requeridas, precio_normal, precio_promo, activa, creada_at\n```\n\n**Ejemplo**: la promoción "DUO" Lun-Jue, 6pm-10pm: 2 personas pagan $890 ($445 c/u) en lugar de $1180 ($590 c/u).\n\n### Cómo crear una promoción\n\nPor ahora se crea desde código (función `crearPromocionesFogueira()` en backend) o editando directo el Sheet. Futuro: UI en admin.\n\n### Reglas\n\n- `activa = false` → no aparece a clientes pero queda en histórico\n- Las que el cliente aplica al reservar quedan registradas en su fila de Reservas (`promo_id`, `promo_nombre`)\n- En la bitácora aparecen como columna `promo`\n\n## NO modifiques tarifas con datos del día activo\n\nSi cambias un precio mientras hay servicio activo, las nuevas capturas usarán el precio nuevo y las viejas el anterior — confunde la conciliación.\n\nMejor cambiar **antes de iniciar el servicio** o al final del día.',
      quiz: [
        { pregunta:'En el sistema de tarifas, cuando cambias un precio, ¿qué pasa con el precio anterior?',
          a:'Se sobrescribe con el nuevo precio', b:'Se mantiene en su fila histórica; se crea una NUEVA fila con fecha_desde actualizada. La vigente en cualquier fecha es la más reciente hacia atrás', c:'Se borra automáticamente', d:'Se duplica y el sistema elige cuál usar',
          correcta:'b', explicacion:'Versionamiento por fecha_desde permite reconstruir tarifas correctas en cualquier fecha pasada. Auditoría perfecta.' },
        { pregunta:'¿Por qué la columna `dias_semana` debe tener valor con apóstrofe ("\'1,2,3,4")?',
          a:'Sheets locale es-MX interpreta "1,2,3,4" como número 1234. El apóstrofe lo fuerza a texto', b:'Es solo una convención de estilo de programación', c:'Para diferenciar días de mesas en la configuración', d:'El sistema lo exige para ordenar los días de mayor a menor',
          correcta:'a', explicacion:'Bug clásico de locale español. Sin apóstrofe, los días se corrompen y las tarifas se aplican mal.' },
        { pregunta:'Tarifa actual Fogueira para Buffet completo Lun-Jue, adulto:',
          a:'$299', b:'$249 (tarifa niño)', c:'$890 (promoción DUO por persona)', d:'$590',
          correcta:'d', explicacion:'$590 adulto. Niño 6-10 $249. 3a edad $590. 0-5 gratis. 11+ tarifa adulto.' },
        { pregunta:'¿Qué pasa con un niño de 11 años en términos de tarifa?',
          a:'Cortesía automática igual que 0-5', b:'Tarifa niño $249 por ser menor de edad', c:'Tarifa adulto ($590 o $299 según servicio)', d:'Tarifa especial $199 (pre-adolescente)',
          correcta:'c', explicacion:'A partir de 11 años se paga TARIFA ADULTO. Solo 6-10 paga tarifa niño. 0-5 cortesía.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: Cortesías y autorizaciones (TU FIRMA) ----------
    {
      titulo: '⭐ Cortesías y autorizaciones (tu firma)',
      resumen: 'Tú y Gabriel son los DOS únicos autorizados. Cuándo SÍ y cuándo NO firmar. Los 3 datos obligatorios. Auditoría.',
      tiempo: 9,
      contenido: '## Tu autoridad sobre cortesías\n\nSolo **DOS personas** pueden autorizar cortesías en Fogueira:\n\n- **Tú** (Gerente Administrativo)\n- **Gabriel** (Gerente de Restaurante)\n\nNadie más. Ni los hosts, ni la cajera, ni cocina. Si un host registra una cortesía sin uno de tus nombres en la columna "Autoriza", **bandera roja al cierre**.\n\n## Cuándo SÍ firmar\n\n### Casos legítimos típicos\n\n- **Queja del cliente** validada (servicio lento por nuestra culpa, error en cuenta, comida no apta)\n- **Error operativo** (mesa equivocada, espera excesiva por desorganización)\n- **Detalle por evento** (cumpleaños, aniversario — política Fogueira)\n- **Cliente VIP recurrente** con descuento pre-aprobado\n- **Eventos corporativos** con autorización formal (de la dirección)\n- **Compensación por incidente** (caída, mal trato del personal)\n\n### Casos que requieren tu juicio\n\n- Cliente que pide descuento "porque viene seguido": **NO automático**. Si tú lo conoces y consideras justificado por su frecuencia, sí; pero es excepción\n- Niño que rompió un plato y los papás se sienten mal: tu criterio\n- Cliente con problema de salud que come muy poco: cortesía parcial razonable\n\n## Cuándo NO firmar (bandera roja inmediata)\n\n- ❌ Por **presión social** del cliente o "amistad" del personal\n- ❌ **Sin motivo documentable**\n- ❌ Para "cubrir" un error que se puede cobrar normal\n- ❌ Cortesías masivas sin política formal previa\n- ❌ Cliente exigente que solo quiere "salirse con la suya"\n- ❌ Si el host te lo pide "para no perder la propina"\n\n## Cómo se registra una cortesía (los 3 datos)\n\nEl host es quien captura, pero **DEBE llevar**:\n\n| Dato | Quién lo pone | Por qué |\n|------|---------------|---------|\n| **Autoriza** (tu nombre) | Host del menú dropdown | Trazabilidad: quién aprobó |\n| **Folio del ticket POS** | Host del ticket físico | Cruzar con el POS al cierre |\n| **Motivo** (en observaciones) | Host con tu indicación | Justificación para auditoría |\n\nSi falta cualquiera de los tres → **bandera roja al cierre**. La cajera la verá y NO podrá conciliar limpio.\n\n## Cortesías automáticas (sin tu firma)\n\n**Niños 0-5 años**: cortesía automática por edad. NO requieren firma. El host solo selecciona "Bebé/niño 0-5" en el dropdown de Autoriza.\n\nTodo lo demás (queja, evento, descuento) requiere tu firma o la de Gabriel.\n\n## Tu rol como auditor de cortesías\n\nAdemás de firmar, **revisas las cortesías al cierre del día** desde el Resumen. Específicamente:\n\n- ¿Cuántas cortesías se otorgaron? Si se ve mucho contra promedio → investigar\n- ¿Hay cortesías repetidas a un mismo cliente o mesa? → revisar\n- ¿Algún host registra muchas cortesías con tu nombre? → verificar (¿realmente las autorizaste?)\n- ¿Motivos repetidos sin variedad ("queja", "queja", "queja")? → revisar credibilidad\n\n## Caso CRÍTICO — cortesía con tu nombre que TÚ no firmaste\n\nSi al revisar el resumen ves una cortesía con tu firma que **NO recuerdas haber autorizado**:\n\n1. **PARA**. No firmes la conciliación.\n2. Pregunta al host quién pidió esa cortesía.\n3. Verifica con la cajera el folio del ticket.\n4. Si **no se puede explicar** → es **fraude operativo**. Documenta evidencia (foto de pantalla, captura del sistema) y escala a la dirección (Germán) inmediato.\n\nEsto es la peor bandera de auditoría. Cada cortesía con tu nombre debe ser tuya — sin excepción.\n\n## Coordinación con Gabriel\n\nGabriel firma operativamente en piso (durante el servicio). Tú firmas administrativamente (más visión gerencial). Coordinen:\n\n- **Cortesías rutinarias del servicio** → Gabriel\n- **Cortesías mayores o con implicación financiera** → tú (consulta con dirección si es muy grande)\n- **Cualquier duda** → llama a Gabriel y deciden juntos\n\n## Auditoría mensual de cortesías\n\nRecomendado: una vez al mes (último viernes), exporta el histórico de cortesías y revisa:\n\n- Top 10 motivos\n- Top 5 montos\n- Cortesías por host (¿alguien tiene muchas?)\n- Cortesías por cliente (¿alguien repite?)\n- Cortesías firmadas por ti vs Gabriel (balance)\n\nReporta a dirección si detectas patrones sospechosos.',
      quiz: [
        { pregunta:'¿Quiénes son los DOS únicos autorizados para firmar cortesías en Fogueira?',
          a:'Gerente Administrativo (TÚ — Mónica) y Gerente de Restaurante (Gabriel)', b:'Cualquier gerente activo del turno', c:'La cajera cuando no hay gerentes disponibles', d:'Solo tú, Mónica',
          correcta:'a', explicacion:'Solo Mónica (tú) y Gabriel autorizan. Es el control más importante para evitar fraude operativo.' },
        { pregunta:'Una cortesía DEBE llevar 3 datos para evitar bandera roja al cierre. ¿Cuáles?',
          a:'Solo el monto y la mesa', b:'Autoriza (tu nombre o de Gabriel), folio del ticket POS, motivo en observaciones', c:'Solo nombre del cliente y hora', d:'Mesa, hora y tipo de descuento',
          correcta:'b', explicacion:'Estos 3 garantizan trazabilidad: quién aprobó + cruce con POS + justificación.' },
        { pregunta:'Al revisar el Resumen ves una cortesía con TU NOMBRE que tú NO recuerdas haber firmado. ¿Qué haces?',
          a:'La dejas pasar si el monto es pequeño', b:'La firmas para regularizar y evitar bandera', c:'PARAS la firma. Investigas (host, folio, cajera). Si no se explica → fraude operativo: escala a Germán inmediato con evidencia', d:'La borras discretamente del sistema',
          correcta:'c', explicacion:'Esta es la peor bandera. Cada cortesía con tu nombre debe ser tuya. Si no, escalar inmediato a dirección.' },
        { pregunta:'¿Las cortesías de niños 0-5 años requieren tu firma?',
          a:'Sí, siempre — cualquier cortesía necesita firma gerencial', b:'No, son cortesía automática por edad. El host selecciona "Bebé/niño 0-5" en el dropdown', c:'Solo si son más de 3 niños en la mesa', d:'Solo en domingo cuando hay mucha demanda',
          correcta:'b', explicacion:'0-5 = automático por edad. Todo lo demás (queja, evento, descuento) requiere tu firma o la de Gabriel.' },
        { pregunta:'Un host te dice: "El cliente pide descuento porque viene mucho". ¿Qué haces?',
          a:'Firmas de inmediato para conservar al cliente', b:'Aplicas tu juicio. Si tú lo conoces y consideras justificado, sí (excepcional). Si no hay política formal, NO firmas y le explicas al cliente cordialmente', c:'Le pides al host que lo firme él', d:'Llamas al chef para que tome la decisión',
          correcta:'b', explicacion:'"Cliente recurrente" sin política formal NO es motivo automático. Tu juicio gerencial decide; cuando dudes, NO firmes.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 6: Supervisión gerencial y override ----------
    {
      titulo: 'Supervisión gerencial y override admin',
      resumen: 'Tu relación con Gabriel y los demás gerentes. Cuándo escalar a Germán. Override de sellos pendientes con motivo.',
      tiempo: 8,
      contenido: '## Tu rol supervisor sobre los demás gerentes\n\nComo gerente_administrativo eres el escalón superior dentro de la operación diaria. Por encima de ti solo está la dirección (Germán). Por debajo:\n\n- **Gabriel** (Gerente de Restaurante) — tu reporte directo en operación\n- **Encargados de piso** — reportan a Gabriel pero tú puedes intervenir\n- **Hosts, cocina, cajera, churrasca** — vía Gabriel y encargados\n- **Auditoría / Admin técnico** — apoyo, no reporte (más bien colaboración)\n\n## Tu relación con Gabriel\n\nGabriel maneja la operación EN VIVO en piso. Tú manejas el aspecto ADMINISTRATIVO. Coordinación típica:\n\n- **Gabriel** firma cortesías rutinarias durante el servicio\n- **Tú** firmas cortesías mayores o pre-autorizadas\n- **Gabriel** maneja conflictos de mesa/cliente en tiempo real\n- **Tú** revisas el cierre con la cajera al final del día\n- **Ambos** coordinan: si Gabriel decide algo grande, te avisa primero\n\n### Cuándo intervenir directamente sobre Gabriel\n\n- Si Gabriel está autorizando demasiadas cortesías sin patrón claro\n- Si hay conflicto entre él y otros gerentes\n- Si toma decisiones que requieren autorización superior (cancelación de eventos, reembolsos grandes)\n- Si hay reclamo del cliente que Gabriel no resolvió bien\n\n**Cómo intervenir**: en privado, con respeto. Tú eres su jefe pero también su par operativo.\n\n## Cuándo escalar a Germán\n\nEscala SIEMPRE estos casos:\n\n- **Pérdidas materiales > $5,000** (mercancía dañada, caída, accidente)\n- **Reclamo legal o sanitario** (intoxicación alegada, demanda, lesión grave)\n- **Sospecha de fraude operativo confirmada**: cortesías falsificadas, faltantes recurrentes, manipulación de cajón\n- **Decisiones financieras grandes**: cambios de tarifa, descuentos masivos, contrataciones\n- **Problemas técnicos del sistema** que requieren acción de admin (deploys, recargas)\n- **Conflictos serios con personal** que ameriten despido formal\n- **Eventos públicos**: prensa, redes sociales con queja viral\n\nEscalación rápida — Germán prefiere enterarse temprano.\n\n## Override admin de sellos\n\nUn **override** es una firma de excepción donde tú firmas por otra persona cuando es **realmente imposible** que ella firme.\n\n### Casos válidos\n\n- Cajera salió enferma sin firmar cierre\n- Cocina cerró sesión y se fue del restaurante; olvidó firmar apertura\n- Falla de internet en el momento exacto en que iba a firmar la host\n- Persona de turno cambió y nadie del rol está disponible\n\n### Casos NO válidos\n\n- ❌ Persona presente que "no quiere" firmar (que firme ella)\n- ❌ Para "saltarse" controles o cubrir errores no resueltos\n- ❌ Cierres con banderas rojas sin resolver (resuelve primero, override después)\n- ❌ Sin motivo claro escrito\n\n### Cómo se hace\n\n1. Entra a **Conciliación → sección 05 (Sellos)**\n2. Identifica el sello pendiente (rojo)\n3. Tap **Override**\n4. Captura un **motivo claro** (mín 5 caracteres): *"Cajera salió enferma a las 9pm, no pudo firmar cierre"*\n5. Confirma\n\nEl sistema guarda con flag `es_override = true` + tu identidad + timestamp + motivo.\n\n### Auditoría revisa overrides\n\n- Cada override queda registrado en la hoja `Sellos`\n- Si tú haces muchos overrides en poco tiempo → señal de problema operativo (capacitar al equipo, revisar procesos)\n- Si los motivos son débiles → la dirección puede observarlo\n- Mensual, revisa contigo misma el conteo de overrides hechos por mes\n\n## Tu firma como supervisor\n\nAdemás de cortesías y overrides, firmas:\n\n- **Cierre del día (Resumen)** — tu sello final que valida toda la operación\n- **Configuraciones críticas** que afecten al equipo\n- **Eventos especiales** (banquetes, cenas privadas) que requieran auth gerencial\n\nCada firma queda con tu identidad, fecha y hora. Es **evidencia legal y de auditoría**.\n\n## Hábito recomendado\n\nAl inicio de cada semana (lunes), revisa:\n\n1. **Overrides hechos la semana anterior** — ¿cuántos? ¿por qué? ¿hay patrón?\n2. **Cortesías firmadas por ti** — ¿total? ¿coincide con lo que recuerdas?\n3. **Cortesías firmadas por Gabriel** — ¿están razonables?\n4. **Banderas rojas pendientes** — ¿se resolvieron las de la semana?\n\n5 min de revisión semanal te ahorran problemas grandes.',
      quiz: [
        { pregunta:'¿Cuándo es válido hacer un override admin de sello?',
          a:'Cuando la cajera no quiere firmar porque está cansada', b:'Para saltarse controles cuando hay prisa al cierre', c:'Cualquier momento que lo consideres necesario como gerente', d:'Solo cuando es REALMENTE imposible que la persona firme (turno cambió, salió enferma, falla de internet) — y SIEMPRE con motivo escrito',
          correcta:'d', explicacion:'Override = excepción documentada para casos imposibles. Si la persona puede firmar, debe firmar ella.' },
        { pregunta:'¿Qué casos SIEMPRE escalas a la dirección (Germán)?',
          a:'Solo problemas técnicos del sistema', b:'Solo si el cliente reclama en redes sociales', c:'Pérdidas >$5K, reclamo legal/sanitario, fraude operativo confirmado, decisiones financieras grandes, problemas técnicos serios, conflictos serios de personal', d:'Nunca, tú decides todo como gerente administrativo',
          correcta:'c', explicacion:'Lo legal, financiero grande o con impacto en imagen va a dirección. Lo operativo del día tú lo manejas.' },
        { pregunta:'Si Gabriel está autorizando demasiadas cortesías sin patrón claro, ¿cómo intervienes?',
          a:'Lo reportas directamente a Germán sin hablar con él', b:'En privado, con respeto. Te sientas con él, revisan juntos las cortesías, identifican el patrón. Si no se corrige, escalas', c:'Bloqueas sus sellos desde Admin para forzarlo a parar', d:'No intervienesy esperas que Germán lo note en auditoría',
          correcta:'b', explicacion:'Tu autoridad debe ejercerse con respeto profesional. Conversación privada antes de escalar.' },
        { pregunta:'Si tú haces muchos overrides admin en pocas semanas, ¿qué señala?',
          a:'Que eres eficiente y resuelves problemas con rapidez', b:'Posible problema operativo: el equipo no firma a tiempo, hay rotación, falta capacitación. Auditoría puede observarlo', c:'Nada, es parte normal del rol de gerente', d:'Que el sistema tiene bugs que deben reportarse',
          correcta:'b', explicacion:'Overrides frecuentes = señal de proceso roto. Hay que investigar la causa raíz: capacitación, herramientas, supervisión.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 7: Conciliación apertura ----------
    {
      titulo: 'Conciliación — Apertura del servicio',
      resumen: 'Cómo abrir cada servicio: efectivo inicial, fondo de cambio, sellos esperados, tarifas vigentes prellenadas.',
      tiempo: 6,
      contenido: '## Cuándo aplica tu apertura\n\nFogueira tiene 1 o 2 conciliaciones por día:\n\n- **Lun–Jue**: 1 conciliación al día (Buffet completo, ~1pm)\n- **Vie–Dom**: 2 conciliaciones (Desayuno y Comida, cada una con su propia apertura y cierre)\n\n## Pasos de la apertura\n\nEntra al módulo **Conciliación** del día. Tienes 3 pestañas:\n\n1. **Apertura** ← aquí estás\n2. Cierre PROFUNDO (módulo siguiente)\n3. Resumen (módulo después)\n\nEn **Apertura**, captura/verifica:\n\n### 1. Datos del servicio\n- **Fecha**: prellena con la del día\n- **Servicio**: Desayuno / Comida / Buffet completo (según día y hora)\n- **Folio**: si el POS asigna folio único al servicio, captúralo\n- **Host del turno**: nombre del host operando\n- **Cajero del turno**: nombre del cajero\n\n### 2. Fondo inicial de caja\n- **Efectivo inicial**: total del fondo de cambio entregado a la cajera\n- **Desglose por denominación** (recomendado): cuántos billetes de cada valor\n- **Cambio extra durante el turno** (si aplica)\n\n### 3. Tarifas vigentes (prellenadas)\nEl sistema lee de la tabla `Tarifas` la fila vigente para esa fecha. Verifica que:\n- t_adulto = correcto\n- t_nino = correcto\n- t_3era = correcto\n\nSi no hay tarifa vigente: **error visible**. Avísale al admin (o tú creas la fila desde Admin → Tarifas).\n\n### 4. Sello de apertura\nTu firma como gerente administrativo se hace desde TU sesión activa. Queda registrado: tu user_id, email, rol, timestamp.\n\n## Sellos esperados al apertura\n\nAdemás del tuyo, el sistema espera:\n\n| Sello | Quién firma | Cuándo |\n|-------|-------------|--------|\n| Apertura · Host | Host del turno | Justo antes de abrir puertas |\n| Apertura · Cajera | Cajera del turno | Cuando recibe fondo de cambio |\n| Apertura · Cocina | Cocinero principal | Cuando setup buffet listo |\n| Apertura · Churrasca | Churrasquero | Cuando rodizio listo |\n\nEl tablero "Esperados vs Hechos" en sección 05 muestra cuáles ya firmaron.\n\n## Si falta un sello al inicio\n\n- **NO bloquea operación** — el servicio puede empezar\n- Queda como **pendiente** en el tablero\n- Si la persona NO podrá firmar (turno cambió, no llegó), considera override admin con motivo\n- Si todos los sellos de un rol faltan al cierre → bandera roja\n\n## Hábito recomendado\n\n- **Llega 15-20 min antes** del inicio del servicio\n- Verifica:\n  - Tarifas vigentes correctas\n  - Fondo de cambio recibido por la cajera\n  - Sellos de cocina/churrasca firmados (puedes verlos en pantalla)\n  - Configuración del día sin cambios\n- Si algo no está → resuelve antes de abrir puertas\n- Tu sello al final\n\nLa apertura es tu **momento de control proactivo**. Si todo arranca bien, el cierre será más fácil.',
      quiz: [
        { pregunta:'En fines de semana, ¿cuántas conciliaciones se abren por día?',
          a:'2 (Desayuno y Comida — cada una con su propia apertura/cierre)', b:'1 (todo el fin de semana se maneja en una sola conciliación)', c:'3 (Desayuno, Comida y Cena)', d:'Ninguna (fines de semana no requieren conciliación)',
          correcta:'a', explicacion:'Vie-Dom hay dos servicios independientes con tarifas distintas, cada uno con su conciliación.' },
        { pregunta:'¿Las tarifas en la pestaña Apertura se capturan a mano cada día?',
          a:'Sí, la cajera las captura al inicio de cada turno', b:'No: se prellenan automáticamente leyendo la fila vigente de la tabla Tarifas para esa fecha', c:'Solo en sábado cuando hay promociones', d:'Solo si la cajera o el host lo solicitan',
          correcta:'b', explicacion:'Versionamiento de tarifas con fecha_desde permite reconstruir tarifas correctas en cualquier fecha.' },
        { pregunta:'¿Qué pasa si falta un sello esperado al inicio del servicio?',
          a:'Bloquea la apertura hasta que se firme', b:'Cancela la conciliación automáticamente', c:'NO bloquea — el servicio puede empezar. Queda como pendiente. Si la persona no podrá firmar, override admin con motivo', d:'Se firma automáticamente con el nombre del gerente disponible',
          correcta:'c', explicacion:'Apertura no bloquea operación. Override admin para casos imposibles, con motivo registrado.' },
        { pregunta:'Como hábito, ¿con cuánto tiempo de anticipación deberías llegar a la apertura?',
          a:'5 minutos (suficiente para ver el resumen rápido)', b:'15-20 min antes (verificar tarifas, fondo, sellos cocina/churrasca, config sin cambios)', c:'1 hora como mínimo para hacer recorrido completo', d:'No importa, la apertura es solo burocracia',
          correcta:'b', explicacion:'15-20 min de control proactivo. Si algo está mal, lo resuelves antes de abrir puertas.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 8: Conciliación profunda ----------
    {
      titulo: 'Conciliación profunda — Cierre del servicio',
      resumen: 'Las 10 secciones del cierre profundo: auto-llenar, corte, tarjetas, cortesías, depósitos, arqueo, banderas, sellos, firma.',
      tiempo: 12,
      contenido: '## Tu papel en el cierre\n\nEl Cierre Profundo es **donde se valida todo el día financieramente**. Tú supervisas a la cajera durante todo el proceso. **No firmes hasta que TODO esté revisado.**\n\n## Secciones del Cierre PROFUNDO\n\n1. **Auto-llenar** (consolida bitácoras del día)\n2. Corte de caja por denominación\n3. Tarjetas (Débito, MC, AMEX, Visa)\n4. Cortesías\n5. Promociones aplicadas\n6. Depósitos a tesorería (DOS)\n7. Arqueo ciego\n8. Banderas rojas\n9. Sellos\n10. Firma final\n\n## 1. Auto-llenar\n\nClick en **"Auto-llenar"**. El sistema:\n- Lee bitácoras del día (Desayuno→ap, Comida→ci, Buffet→ap)\n- Suma adultos, niños, 3a edad, cortesías\n- Calcula totales\n- Muestra números consolidados\n\n**Verifica visualmente** que cuadren con la operación esperada.\n\n## 2. Corte de caja\n\nLa cajera captura desglose por denominación (200, 500, 1000, etc.). Sistema multiplica y suma. **Tú revisas** que el total tenga sentido.\n\n## 3. Tarjetas\n\nSeparadas por:\n- Débito\n- Mastercard\n- AMEX\n- Visa (crédito)\n\nVerifica que la suma coincida con el reporte del POS. **Por qué se separan**: comisiones distintas por tarjeta — análisis de costos bancarios.\n\n## 4. Cortesías — TU RESPONSABILIDAD CRÍTICA\n\nCada cortesía debe tener:\n- **Autoriza** (tu nombre o de Gabriel)\n- **Folio del ticket POS**\n- **Motivo en observaciones**\n\n**Si ves una cortesía que no reconoces o que tiene datos raros** → investígala antes de firmar.\n\n## 5. Promociones\n\nVerificar que se aplicaron correctamente (días/horas/personas según reglas).\n\n## 6. Depósitos a tesorería — DOS OBLIGATORIOS\n\n**Reglas Fogueira**:\n- **Depósito 1**: venta del día (efectivo + tarjetas)\n- **Depósito 2**: comisiones bancarias (separado para análisis contable)\n\nAmbos deben:\n- Coincidir en monto con lo capturado\n- Tener folio de tesorería\n- Estar firmados por quien depositó\n\n**Si falta uno → bandera roja**. NO firmes con un solo depósito.\n\n## 7. Arqueo ciego\n\nSistema calcula:\n```\nVenta teórica = (adultos × t_adulto) + (niños × t_nino) + ... - cortesías\nDinero esperado = Venta teórica - depósitos - tarjetas\n```\n\nCompara con lo CONTADO en caja. Diferencia:\n\n| Diferencia | Acción |\n|-----------|--------|\n| < $50 | Error de cambio normal, OK |\n| $50-$200 | Revisar tickets |\n| $200-$1000 | Investigar antes de firmar |\n| **> $1000** | **NO firmar, escalar a Germán** |\n\n## 8. Banderas rojas — TU CHECKLIST FINAL\n\nAntes de firmar, revisa:\n\n- ❌ Cortesías sin autoriza (Mónica o Gabriel)\n- ❌ Cortesías sin folio del ticket POS\n- ❌ Cortesías con motivo débil\n- ❌ Diferencias en arqueo > $200 sin explicación\n- ❌ Depósitos a tesorería incompletos\n- ❌ Sellos pendientes sin override válido\n- ❌ Tarjetas que NO cuadran con POS\n- ❌ Filas de bitácora SIN hora_sal al cierre\n- ❌ Reservas en "En espera" que ya no van a llegar\n- ❌ Promociones mal aplicadas\n\n**Cualquiera de estas SIN explicar → NO firmes.**\n\n## 9. Sellos pendientes\n\nSección 05 muestra "Esperados vs Hechos". Si hay rojos:\n- Llama a la persona si está disponible\n- Si imposible: **override admin** con motivo claro\n- Cada override queda con tu firma + motivo + flag `es_override = true`\n\n## 10. Firma final\n\n1. Verifica que TODO esté limpio o explicado\n2. **Cierra la conciliación** (botón "Cerrar")\n3. **Firma tu sello** desde tu sesión\n4. Conciliación queda **cerrada** con `cerrada_at = ahora`\n5. Después del cierre, solo override admin la puede modificar (con motivo)\n\n## Si HAY banderas que no se resuelven\n\n- **Documenta TODAS** en observaciones de la conciliación\n- **Escala a Germán** por WhatsApp con foto si aplica\n- Si **dinero faltante > $1,000**: contacta inmediato, no esperes\n- Si **fraude sospechado**: documenta evidencia y escala\n\n## Tu firma significa\n\n*"Como gerente administrativa, he revisado todo. Las banderas que están aquí están explicadas. Lo que no estaba bien fue corregido o escalado. Doy fe de que esta conciliación refleja la realidad operativa."*\n\nSi firmas algo que NO revisaste, es responsabilidad tuya cuando aparezca el problema mañana.',
      quiz: [
        { pregunta:'¿Qué hace "Auto-llenar" en el Cierre PROFUNDO?',
          a:'Consolida automáticamente las bitácoras del día (suma adultos, niños, 3a edad, cortesías) en los campos de cierre', b:'Llena los campos con el promedio de los últimos 7 días', c:'Cierra automáticamente el restaurante y archiva la conciliación', d:'Copia los datos de ayer sin modificación',
          correcta:'a', explicacion:'Auto-llenar lee bitácoras del backend. Vie-Dom: Desayuno→ap, Comida→ci. Lun-Jue: Buffet→ap.' },
        { pregunta:'¿Cuántos depósitos a tesorería deben hacerse al día y por qué?',
          a:'Uno solo con el total del día', b:'DOS: venta del día + comisiones bancarias (separados para análisis contable)', c:'Tres: efectivo, tarjetas y propinas por separado', d:'Ninguno en días de poco aforo',
          correcta:'b', explicacion:'Reglas Fogueira: separación contable obligatoria. Auditoría revisa que ambos estén con folio.' },
        { pregunta:'En arqueo ciego hay diferencia FALTANTE de $850 sin explicación clara. ¿Qué haces?',
          a:'Firmas igual porque pudo ser error de cambio', b:'NO firmas. Investigas (revisa tickets, denominaciones, errores de captura). Si no se resuelve, escala a Germán antes de firmar', c:'Le pides a la cajera que ponga $850 de su bolsa para cuadrar', d:'Borras la diferencia del campo y capturas cero',
          correcta:'b', explicacion:'$850 sin explicación NO es residual. Diferencias > $200 deben investigarse; > $1000 escalar inmediato.' },
        { pregunta:'Cuando firmas el cierre del servicio, ¿qué estás diciendo formalmente?',
          a:'Solo que revisaste el resumen visualmente y parece bien', b:'Confías en que la cajera hizo su trabajo correctamente', c:'Que los números coinciden con el día anterior', d:'Que revisaste todo, las banderas están explicadas, lo no resuelto fue escalado, y das fe de que la conciliación refleja la realidad',
          correcta:'d', explicacion:'Tu firma es acto formal con responsabilidad. Si firmas no revisado y aparece problema mañana, es responsabilidad tuya.' },
        { pregunta:'Una cortesía debe llevar 3 datos para evitar bandera roja. ¿Cuáles?',
          a:'Solo el monto y la mesa', b:'Autoriza (Mónica o Gabriel), folio del ticket POS, motivo en observaciones', c:'Solo nombre del cliente y hora', d:'Mesa, hora y tipo de descuento aplicado',
          correcta:'b', explicacion:'Estos 3 datos garantizan trazabilidad: quién aprobó + cruce con POS + justificación.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 9: Resumen del día (CRÍTICO) ----------
    {
      titulo: '⚠ Resumen del día y semáforo de banderas rojas (CRÍTICO)',
      resumen: 'Tu tablero ejecutivo: 11 KPIs auto-calculados, 10 banderas con umbrales, conclusión del auditor. Lo más importante de tu rol.',
      tiempo: 14,
      contenido: '## Por qué este módulo es CRÍTICO\n\nLa pestaña **Resumen** es **tu tablero ejecutivo del día**. Aquí ves consolidado TODO: ingresos, comensales, banderas detectadas. **Tu firma del cierre depende de lo que decidas aquí.**\n\nNo es lectura pasiva — es **interpretación activa**. Cada KPI y cada bandera tiene un significado y una acción.\n\n## Estructura del Resumen — 3 secciones\n\n1. **Grid de 11 KPIs** (arriba)\n2. **01 Semáforo de banderas rojas** (10 checks automáticos)\n3. **02 Conclusión del auditor / supervisor** (tu cierre formal)\n\n## Sección de KPIs — los 11 indicadores\n\n### Cobros del día\nTotal de ingresos según POS. **Si sale $0 cuando hubo operación**: error de POS o no se cargaron tickets — investigar.\n\n### Comensales POS\nPersonas según tickets POS. Compara con lo que tú esperas (reservas + walk-ins).\n\n### Cobro promedio / comensal\nTicket promedio. Caídas grandes = ¿descuentos no autorizados? ¿cortesías excesivas?\n\n### Propina prom. / comensal\nIndicador de satisfacción. Caídas = posible problema de servicio.\n\n### Δ Host vs POS\nDiferencia de comensales registrados por hosts vs POS. **Debe ser ~0**. Si > 2 → bandera roja.\n\n### Δ Arqueo ciego\nDiferencia entre lo CONTADO y lo TEÓRICO. **Si > $200 → bandera roja**.\n\n### Δ Terminal vs POS\nDiferencia entre cierre de lote bancario y reporte POS. **Cero o cercano**.\n\n### % Cancelaciones\nPorcentaje de cobros cancelados. **Si > 3% → bandera roja**.\n\n### No-sales día\nVeces que el cajón se abrió SIN venta. **Si > 2 → bandera roja**. Sospecha de manipulación.\n\n### Cortesías día\nNúmero de cortesías. NO bandera por sí solo, pero si sube mucho contra promedio → investigar.\n\n### Δ Folios\n`(folio_hasta − folio_desde + 1) = # tickets emitidos`. Si hay saltos → tickets faltantes.\n\n## Sección 01 — Semáforo de 10 banderas\n\nCada bandera tiene 3 estados visuales:\n- ✅ **Verde**: dentro umbral, OK\n- ⚠ **Amarilla**: en el límite, revisar\n- ❌ **Roja**: fuera de umbral, requiere acción ANTES de firmar\n\n### Las 10 banderas y qué hacer con cada una\n\n#### 1. Δ Comensales (Host vs POS) > 2\nBitácora del host vs tickets POS no coinciden. Causas: host olvidó capturar, POS duplicó, división de grupo mal contada. **Acción**: revisar bitácora vs POS uno por uno.\n\n#### 2. Δ Arqueo ciego > $200\nLo contado no coincide con lo teórico.\n- $200-$500: revisar tickets, denominaciones\n- $500-$1000: investigar a fondo\n- **>$1000: NO firmar, escalar a Germán**\n\n#### 3. Δ Cierre de lote terminal vs POS\nLote bancario no coincide con POS. Causas: cobro doble, devolución no registrada, voucher mal capturado. **Acción**: cruzar transacción por transacción.\n\n#### 4. % Cancelaciones > 3%\nDemasiadas cancelaciones. Causas: errores POS, mal servicio, **posible manipulación**. **Acción**: revisar cada cancelación con su autorización.\n\n#### 5. No-sales > 2\nCajón abierto sin venta más de 2 veces. **Posible manipulación**. **Acción**: pregunta a la cajera por cada uno; si más de 2 sin justificación → escalar.\n\n#### 6. Cortesías SIN autorización\nCortesías sin nombre del autoriza (Mónica o Gabriel). **Acción**: identificar, completar dato; si no se sabe → escalar.\n\n#### 7. Cancelaciones SIN autorización\nCancelaciones sin nombre de quien autorizó. **Posible fraude operativo**. **Acción**: documentar quién autorizó cada una.\n\n#### 8. Cierre de lote bancario no realizado\nAlguna terminal sin hora de cierre registrada. **Acción**: cerrar terminal antes de irte; si ya no se puede → documentar y avisar.\n\n#### 9. Δ Operaciones del lote vs Vouchers\nOperaciones reportadas no cuadran con vouchers físicos. **Acción**: contar vouchers físicos uno por uno.\n\n#### 10. Saltos en folios consecutivos\nFolios NO consecutivos. **Causa más sospechosa de fraude**. **Acción CRÍTICA**: identificar folios faltantes y por qué.\n\n## Sección 02 — Conclusión del auditor\n\n### Estatus general del día\n- **OK** — sin observaciones, todo cuadra\n- **Observaciones menores** — banderas pequeñas explicadas, sin impacto material\n- **Observaciones graves** — banderas serias, requiere seguimiento\n- **Banderas críticas** — NO firmar sin escalar\n\n### Comentarios y plan de acción\nTextarea libre. Escribe:\n- Banderas detectadas\n- Qué se investigó\n- Qué se concluyó\n- Plan de acción\n\nEste comentario queda en la conciliación firmada y es revisable por dirección.\n\n## Workflow recomendado al cerrar\n\n1. Antes de abrir Resumen: completa Cierre PROFUNDO\n2. Abre Resumen: revisa los 11 KPIs primero (panorámica)\n3. Algo te llama la atención (ej: Δ Arqueo > $0): baja al semáforo\n4. Recorre las 10 banderas. Cada roja → investiga ANTES de firmar\n5. Si todo verde: estatus OK, comentario breve\n6. Si hay amarillas: estatus "observaciones menores", documenta cada una\n7. Si hay rojas: NO firmes. Escala lo necesario. Solo cuando estén explicadas o resueltas, firma\n\n## Cuándo NUNCA firmar\n\n- ❌ Δ Arqueo > $1,000 sin explicación\n- ❌ **Cortesía con tu nombre que tú NO firmaste** (fraude)\n- ❌ Saltos en folios sin explicación (fraude potencial)\n- ❌ No-sales > 2 sin justificación\n- ❌ Cancelaciones masivas sin autorización\n- ❌ Cualquier bandera con sospecha de manipulación intencional\n\nEn estos casos: documenta evidencia, escala a Germán, NO firmes hasta resolución.\n\n## Tu firma del Resumen\n\nCuando das estatus "OK" o "Observaciones menores" y firmas, formalmente dices:\n\n*"Como gerente administrativo, doy fe de que las banderas que aparecen están explicadas o son aceptables. La conciliación refleja la operación real."*\n\nSi firmas con banderas no explicadas y mañana aparece problema → **es tu responsabilidad**.',
      quiz: [
        { pregunta:'¿Qué umbral marca como bandera roja la diferencia de Arqueo ciego?',
          a:'$200 (configurable). Si > $200 → bandera roja que requiere investigación', b:'$0 — cualquier diferencia es crítica y escala inmediato', c:'$1,000 — diferencias menores son normales', d:'No hay umbral; la cajera decide si es grave',
          correcta:'a', explicacion:'Umbral default $200. Diferencias mayores requieren investigar tickets, denominaciones, errores.' },
        { pregunta:'¿Por qué la bandera "Saltos en folios consecutivos" es la más CRÍTICA?',
          a:'Es solo un error visual del POS sin importancia', b:'Indica tickets faltantes — anulados sin documentar, perdidos, o emitidos no reportados (potencial fraude)', c:'Es un problema técnico del sistema que no afecta la operación', d:'Significa que el POS necesita mantenimiento',
          correcta:'b', explicacion:'La más sospechosa de fraude. Cada folio faltante debe tener explicación.' },
        { pregunta:'Si descubres una cortesía con TU NOMBRE pero TÚ NO la firmaste, ¿qué haces?',
          a:'La dejas pasar si el monto es menor a $200', b:'La firmas para regularizar la conciliación del día', c:'NO firmas la conciliación. Documentas evidencia (foto, captura) y escalas inmediato a Germán — es fraude operativo grave', d:'La borras del sistema para que no quede registro',
          correcta:'c', explicacion:'Cortesía con tu nombre que tú no firmaste = fraude. NUNCA encubrir. Escalar inmediato con evidencia.' },
        { pregunta:'En la Conclusión del auditor, si hay banderas rojas serias sin resolver, ¿qué estatus seleccionas?',
          a:'"OK" para que el cierre avance y se resuelva después', b:'"Observaciones menores" para no alarmar a la dirección', c:'"Observaciones graves" si las banderas son moderadas', d:'"Banderas críticas" — NO firmar hasta escalar a Germán/dirección y documentar evidencia',
          correcta:'d', explicacion:'El estatus debe reflejar la realidad. Firmar "OK" con banderas críticas = responsabilidad tuya cuando aparezca el problema.' },
        { pregunta:'Si % Cancelaciones aparece > 3% en rojo, ¿qué haces?',
          a:'La ignoras porque cancelaciones son parte normal de la operación', b:'Revisas las cancelaciones una por una y verificas que cada una tenga autorización documentada. Si alguna no la tiene, escala', c:'Pides a la cajera que no registre las siguientes cancelaciones para bajar el porcentaje', d:'Reseteas el contador desde Admin para el siguiente servicio',
          correcta:'b', explicacion:'Cancelaciones masivas pueden indicar errores POS, mal servicio, o manipulación. Cada una debe tener autorización.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 10: Auditoría operativa mensual ----------
    {
      titulo: 'Auditoría operativa mensual',
      resumen: 'Hábitos de revisión periódica para detectar patrones: cortesías repetidas, faltantes recurrentes, overrides frecuentes, certificaciones vencidas.',
      tiempo: 8,
      contenido: '## Más allá del día a día\n\nLas banderas del día son señales puntuales. Pero **muchos problemas operativos solo se ven con vista mensual**: patrones que se repiten, comportamientos sospechosos, capacitación que falla.\n\nTu rol como gerente administrativo incluye **auditoría mensual** — un compromiso de tiempo que vale oro porque previene problemas grandes.\n\n## Tu checklist mensual (último viernes del mes)\n\n### 1. Histórico de Conciliaciones\nDesde **inicio → "Histórico de conciliaciones"** filtras el último mes. Revisa:\n\n- ¿Cuántas conciliaciones tuvieron banderas rojas?\n- ¿Qué tipos de banderas se repitieron?\n- ¿Diferencias de arqueo recurrentes? ¿de cuánto en promedio?\n- ¿Días con números atípicos (mucho mayor o menor que el promedio)?\n\nExporta el CSV para análisis externo si es necesario.\n\n### 2. Cortesías del mes\n\nDesde el sheet `BitacoraFilas`, exporta cortesías del mes y revisa:\n\n- **Top 10 motivos** — ¿hay variedad o se repiten los mismos?\n- **Top 5 montos** — ¿hay cortesías inusualmente altas?\n- **Cortesías por host** — ¿alguien acumula muchas? Ojo si una host tiene 20% de las cortesías del mes\n- **Cortesías por cliente** (si capturan nombre) — ¿alguien repite seguido?\n- **Balance Mónica vs Gabriel** — ¿está parejo o hay desbalance? Si Gabriel firma mucho más, ¿por qué?\n\n### 3. Overrides admin\n\nEn el sheet `Sellos`, filtra `es_override = true` del mes:\n\n- ¿Cuántos overrides hiciste?\n- ¿Por qué motivos?\n- ¿Hay un usuario al que repetidamente le tienes que hacer override (cocina, churrasca, cajera)?\n\nMuchos overrides = señal de proceso roto. Capacitar al equipo o revisar el flujo.\n\n### 4. Certificaciones del equipo\n\nDesde **Admin → Certificaciones** revisa:\n\n- ¿Hay certificaciones vencidas (más de 6 meses)?\n- ¿Quién está bloqueado por intentos?\n- ¿Quién aún no se ha certificado?\n\nProgramar capacitación + reseteo de intentos en bloque.\n\n### 5. No-sales y cancelaciones\n\nSi aparecieron muchos en el mes:\n\n- ¿Qué cajera tuvo más?\n- ¿En qué horarios?\n- ¿Coincide con cambios de personal?\n\n### 6. Faltantes recurrentes\n\nSi hubo varios días con faltantes pequeños ($50-$200):\n\n- ¿Es la misma cajera?\n- ¿Mismo turno?\n- ¿Mismo día de la semana?\n\nFaltantes pequeños recurrentes pueden ser sustracción sistemática. Investigar con calma pero sin demora.\n\n## Reporte mensual a dirección\n\nDespués de tu revisión, **envía a Germán un reporte breve** (WhatsApp o email):\n\n- Conciliaciones del mes (cuántas con banderas)\n- Cortesías del mes (total $ y cantidad)\n- Overrides admin del mes\n- Personas pendientes de certificarse\n- **Hallazgos sospechosos** (si hay) con evidencia\n- **Recomendaciones**: capacitaciones, ajustes de proceso, reorganización de turnos\n\n5-10 minutos de tiempo invertido = previene problemas grandes.\n\n## Auditoría externa\n\nFogueira puede recibir auditoría externa (legal, fiscal, contable). Tu trabajo es:\n\n- Mantener evidencia organizada (cortesías firmadas, overrides documentados, certificaciones al día)\n- Si llega auditor: facilitar acceso, no esconder nada, ser proactivo\n- El sistema **ya guarda toda la evidencia** automáticamente — solo hay que mostrarla\n\n## El valor de la prevención\n\nUn problema detectado en auditoría externa = costo grande (multa, demanda, daño reputacional).\n\nUn problema detectado por TI en auditoría mensual = costo bajo (corrección interna, capacitación, ajuste de proceso).\n\nLa diferencia se cuenta en miles, a veces millones de pesos.\n\n## Hábito final\n\n**Bloquea 30 min en tu calendario el último viernes de cada mes** para auditoría operativa. Sin excepciones. Tratalo como una junta no negociable contigo misma.\n\nLa dirección espera de ti **tu visión filtrada del mes** — no que reportes cada incidente, pero sí que captures lo importante. Eres los **ojos** de Germán en operación. Tu mes filtrado le permite tomar decisiones estratégicas con buena información.',
      quiz: [
        { pregunta:'¿Qué tipo de problemas se ven mejor con vista MENSUAL que diaria?',
          a:'Solo banderas obvias del semáforo rojo', b:'Los que pasan solo en lunes', c:'Ninguno — lo que no se ve diario no importa', d:'Patrones repetidos: cortesías recurrentes, faltantes pequeños sistemáticos, overrides frecuentes — señales que de a uno parecen normales pero juntas son sospechosas',
          correcta:'d', explicacion:'Patrones se ven con vista mensual. Faltantes de $50 cada lunes 4 semanas seguidas = $200 totales y posible sustracción sistemática.' },
        { pregunta:'En tu auditoría mensual de cortesías, ¿qué señal de alarma debes buscar?',
          a:'Que haya cortesías de cualquier tipo', b:'Que un host acumule muchas (ej: 20% del total mensual), o que un cliente se repita, o motivos sin variedad ("queja, queja, queja")', c:'Que el monto total sea mayor a $1,000 en el mes', d:'Solo el total mensual de cortesías',
          correcta:'b', explicacion:'Concentración en un host o motivos repetidos = señal de patrón. Investigar con calma sin acusar.' },
        { pregunta:'Si haces muchos overrides admin en el mes, ¿qué señal es?',
          a:'Que eres eficiente y resuelves rápido los bloqueos', b:'Posible proceso roto: equipo no firma a tiempo, falta capacitación, alta rotación. Causa raíz vs síntoma', c:'Nada en particular, es parte del rol', d:'Que la auditoría externa se acerca',
          correcta:'b', explicacion:'Overrides son síntoma. La causa raíz es proceso o capacitación. Resolver la causa elimina el síntoma.' },
        { pregunta:'¿Cuál es el valor de detectar problemas en auditoría INTERNA mensual vs auditoría externa?',
          a:'Ninguno — ambas opciones tienen el mismo costo', b:'Diferencia gigantesca: interno = corrección barata (capacitación, ajuste). Externo = costo alto (multa, demanda, daño reputacional)', c:'Solo cosmético — ambas producen los mismos resultados', d:'La auditoría externa es más barata porque no requiere tiempo de tu rol',
          correcta:'b', explicacion:'30 min al mes de auditoría preventiva ahorra miles o millones en problemas detectados externamente. Es la mejor inversión de tu rol.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Curso de la Cajera. Maneja directamente el dinero del restaurante. Foco operativo crítico:
// cobros, cierre de caja, captura de cortesías (sin autorizarlas), banderas rojas. 7 módulos.
function modulosCursoCajera() {
  return [
    // ---------- Módulo 1: Tu rol como cajera ----------
    {
      titulo: 'Tu rol como cajera',
      resumen: 'Tu posición en la operación: lo que controlas, lo que NO autorizas, y por qué tu honestidad y precisión son críticas.',
      tiempo: 5,
      contenido: '## Tu rol — el más sensible operativamente\n\nLa cajera es **la persona que maneja directamente el dinero** del restaurante. Cada moneda, cada billete, cada movimiento de tarjeta pasa por tus manos. Es por eso uno de los puestos de más confianza y más auditados del restaurante.\n\nNo te asustes. La operación es clara y el sistema te apoya. Solo necesitas ser **honesta, precisa y atenta**.\n\n## Lo que TÚ controlas\n\n- **Recepción del fondo de cambio** al apertura\n- **Cobros en efectivo** durante el servicio\n- **Cobros con tarjeta** (Débito, Mastercard, AMEX, Visa)\n- **Captura de cortesías** en bitácora (con autorización de gerente)\n- **Cancelaciones de tickets** (con autorización)\n- **Cierre de caja** al final del servicio\n- **Conteo de efectivo** y arqueo\n- **Depósitos a tesorería** (los DOS)\n\n## Lo que NO autorizas\n\n- ❌ **Cortesías** — solo Mónica (Gerente Administrativo) y Gabriel (Gerente de Restaurante) autorizan\n- ❌ **Cancelaciones masivas** sin aprobación gerencial\n- ❌ **Descuentos no documentados**\n- ❌ **Devoluciones grandes** sin Mónica/Gabriel\n\nSi alguien te presiona para "autorizar" algo: **NO** lo hagas. Llama a Mónica o Gabriel. Tu autoridad es operativa, no decisoria sobre dinero.\n\n## Tus tableros del sistema\n\n- **Inicio**: ves los módulos disponibles para tu rol\n- **Conciliación**: tu pantalla principal — apertura, cierre profundo, resumen\n- **Histórico de conciliaciones**: ver cierres anteriores (lectura)\n- **Mi manual**: guía operativa filtrada para ti\n\nNO tienes acceso a:\n- Crear/editar usuarios\n- Cambiar tarifas\n- Modificar configuración\n- Ver bitácoras de hosts en detalle (solo el resumen consolidado)\n\nEs **separación de funciones** intencional para proteger el sistema.\n\n## Tu sesión\n\nDura **hasta las 3:00 am del día siguiente** (día lógico restaurante). Cubre todo el turno aunque cierres tarde. No te va a tirar a media operación.\n\n## Tu firma vale\n\nCuando firmas un sello (apertura, cierre), queda registrado tu user_id, email, fecha y hora exacta. Es **evidencia legal y de auditoría**.\n\nSi firmas un cierre con banderas rojas sin explicar, mañana esa firma será revisada y pueden preguntarte por qué firmaste con problemas pendientes.\n\nLa regla es simple: **si no estás 100% segura, NO firmes**. Llama a Mónica o Gabriel y resuelvan juntas antes de firmar.\n\n## Tu honestidad es tu mayor herramienta\n\nUna cajera honesta y precisa es la **persona más valiosa del restaurante**. Quien maneja el dinero con cuidado evita problemas para todos. Quien manipula caja, aunque sea en montos pequeños, **siempre será descubierta** porque el sistema deja huella en cada paso.\n\nLa auditoría operativa mensual revisa patrones. Diferencias pequeñas recurrentes ($50 cada lunes 4 semanas seguidas) se detectan fácilmente.\n\nLo que ganas con tu honestidad: confianza, estabilidad laboral, recomendaciones futuras.\nLo que arriesgas con manipulación: tu trabajo, problemas legales, tu nombre.',
      quiz: [
        { pregunta:'¿Qué decisiones financieras tú como cajera NO autorizas?',
          a:'Cortesías (las firma Mónica o Gabriel), cancelaciones masivas, descuentos no documentados, devoluciones grandes', b:'Ninguna, eres la jefa de caja y decides todo', c:'Solo cortesías de más de $300', d:'Solo devoluciones mayores a $1,000',
          correcta:'a', explicacion:'Tu autoridad es operativa, no decisoria. Solo Mónica y Gabriel autorizan cortesías y excepciones financieras.' },
        { pregunta:'Si un cliente te presiona para "autorizar" un descuento sin aprobación, ¿qué haces?',
          a:'Lo autorizas para no quedar mal con el cliente', b:'NO lo autorizas. Llamas a Mónica o Gabriel. Tu trabajo es procesar pagos según las reglas, no decidir excepciones', c:'Le pides identificación oficial y procedes', d:'Le cobras de tu bolsa para cubrir la diferencia',
          correcta:'b', explicacion:'Nunca cedas a presión. Llamar al gerente es lo correcto y te protege.' },
        { pregunta:'¿Hasta qué hora dura tu sesión iniciada en el sistema?',
          a:'Solo 1 hora (se renueva cada hora)', b:'Exactamente 8 horas desde el inicio', c:'Hasta las 3:00 am del día siguiente (día lógico restaurante)', d:'Hasta medianoche del mismo día',
          correcta:'c', explicacion:'Día lógico cubre todo el turno operativo, aunque cierres tarde.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 2: Apertura ----------
    {
      titulo: 'Apertura del servicio',
      resumen: 'Recepción del fondo de cambio, captura de efectivo inicial, sello de apertura desde tu sesión.',
      tiempo: 6,
      contenido: '## Cuándo llegas\n\n**15-20 minutos antes** del inicio del servicio. Esto te da tiempo de:\n\n- Recibir el fondo de cambio\n- Contar y verificar denominaciones\n- Capturar tu efectivo inicial en el sistema\n- Firmar tu sello de apertura\n- Estar lista cuando entre el primer cliente\n\n## Recepción del fondo de cambio\n\nEl fondo es el efectivo inicial que tienes para dar cambio. Lo entrega Mónica (o quien designe).\n\n### Buenas prácticas\n\n1. **Cuenta delante de Mónica/quien entrega** — verifica que el monto coincida con lo declarado\n2. **Verifica denominaciones** — debes tener mezcla útil (billetes chicos, monedas)\n3. **Si falta cambio chico** → pide intercambio antes de empezar\n4. **Firma recibido** (papel o WhatsApp) — queda evidencia de cuánto te entregaron\n\nSi el fondo viene con monto distinto al declarado, **NO firmes recibido sin que se aclare**. Notifícale a Mónica inmediato.\n\n## Captura en el sistema\n\nEntra al módulo **Conciliación** del día. Pestaña **Apertura**. Captura:\n\n### 1. Datos del servicio\n- Fecha (prellenada)\n- Servicio (prellenado según día/hora)\n- Folio del POS (si aplica)\n- Tu nombre como cajero\n\n### 2. Fondo inicial de caja\n- **Efectivo inicial total** (la cantidad recibida)\n- **Desglose por denominación** (recomendado): cuántos billetes de 1000, 500, 200, 100, 50, 20, monedas\n\n### 3. Tu sello de apertura\n- Firma desde TU sesión activa\n- Queda registrado: user_id, email, fecha, hora\n- **Imposible firmar por otra cajera** — cada quien firma de su cuenta\n\n## Sellos esperados al apertura\n\nAdemás del tuyo, el sistema espera 4 sellos más:\n\n| Sello | Quién |\n|-------|-------|\n| Apertura · Host | Host del turno |\n| Apertura · Cocina | Cocinero principal |\n| Apertura · Churrasca | Churrasquero |\n| Apertura · Gerente o Admin | Mónica o Germán |\n\nNo es problema si alguno tarda — pueden firmar cuando puedan. Pero al final del día deben estar todos (o tener override admin con motivo).\n\n## Si te toca empezar el servicio sin haber capturado apertura\n\nA veces hay urgencia (cliente entra antes de la hora). En ese caso:\n\n1. Atiende al cliente primero (no lo dejes esperando)\n2. Captura la apertura **en cuanto puedas** (no se te olvide)\n3. Si pasó mucho tiempo sin firmar apertura, anota la hora real en observaciones\n\nUna apertura tardía es mejor que ninguna.\n\n## Antes de abrir puertas — checklist mental\n\n- [ ] Fondo de cambio recibido y contado\n- [ ] Efectivo capturado en sistema\n- [ ] Sello de apertura firmado\n- [ ] POS/terminal funcionando\n- [ ] Calculadora a la mano\n- [ ] Recibos del POS suficientes\n\nSi todo OK → estás lista.',
      quiz: [
        { pregunta:'Al recibir el fondo de cambio, ¿qué buena práctica debes seguir?',
          a:'Aceptar lo que te dan sin contar para no retrasar la apertura', b:'Contar delante de Mónica/quien entrega, verificar denominaciones, firmar recibido como evidencia', c:'Contar solo al final del servicio cuando cierras', d:'Siempre pedir $500 extra por si acaso',
          correcta:'b', explicacion:'Contar delante de quien entrega previene problemas. Tú firmas recibido, no asumas que el monto está bien sin verificar.' },
        { pregunta:'Tu sello de apertura, ¿lo puede firmar otra cajera por ti desde su sesión?',
          a:'Sí, si son del mismo turno y se ponen de acuerdo', b:'No: cada sello es autenticado por la sesión activa. Solo tu cuenta puede firmar tu sello (excepto override admin con motivo)', c:'Solo Mónica puede firmar por ti si lo autoriza', d:'Solo en domingo cuando hay dos cajeras en turno',
          correcta:'b', explicacion:'Sellos autenticados garantizan trazabilidad. Imposible firmar por otra persona desde su cuenta.' },
        { pregunta:'Si el fondo de cambio viene con un monto DISTINTO al declarado, ¿qué haces?',
          a:'Firmas recibido y al final del servicio aclaras la diferencia', b:'Cuentas otra vez y colocas lo que encontraste, aunque difiera', c:'Lo aceptas y empiezas el turno sin decir nada', d:'NO firmas recibido sin que se aclare. Notificas a Mónica inmediato',
          correcta:'d', explicacion:'Diferencia al inicio = problema desde la primera hora. Aclarar antes de firmar previene que la diferencia recaiga sobre ti.' },
        { pregunta:'Si tienes urgencia y un cliente entra antes de la apertura del sistema, ¿qué haces?',
          a:'Lo dejas esperar 15 minutos hasta capturar la apertura completa', b:'Atiendes al cliente primero. Capturas apertura en cuanto puedas. Si pasó mucho tiempo, anota hora real en observaciones', c:'Cierras la puerta hasta que el sistema esté listo', d:'Le pides al host que lo atienda mientras terminas apertura',
          correcta:'b', explicacion:'Cliente primero. Apertura tardía es mejor que ninguna; lo importante es capturarla con la verdad.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 3: Cobros durante el servicio ----------
    {
      titulo: 'Cobros durante el servicio',
      resumen: 'Cómo procesar pagos en efectivo y tarjeta. Cuándo abrir el cajón sin venta. Cancelaciones autorizadas.',
      tiempo: 7,
      contenido: '## Procesar pagos en efectivo\n\nEl flujo típico:\n\n1. Cliente pide la cuenta al host\n2. Host trae el ticket POS impreso\n3. Cliente entrega efectivo\n4. **Cuentas el efectivo recibido** en voz alta o en tu cabeza\n5. Calculas el cambio (POS te lo dice, o calculadora)\n6. **Cuentas el cambio** antes de entregar\n7. Entregas cambio + ticket\n\n### Buenas prácticas\n\n- **Nunca des cambio sin verificar el monto recibido**\n- **Cuenta dos veces** si el monto es alto\n- Si te entregan billetes nuevos o sospechosos, **revisa al trasluz** (marca de agua, hilo de seguridad)\n- Si dudas de un billete: pide a Mónica/Gabriel que lo verifique antes de aceptar\n\n## Procesar pagos con tarjeta\n\n1. Cliente entrega tarjeta\n2. La metes en la terminal\n3. Cliente captura PIN o firma\n4. Imprime voucher\n5. **Verifica que el voucher imprima correctamente** (importe, código de aprobación)\n6. Entregas tarjeta + voucher al cliente\n7. Guarda la copia del voucher (para conciliación)\n\n### Tipos de tarjeta\n\nLas separas mentalmente porque al cierre se reportan por tipo:\n- **Débito**\n- **Crédito**: Mastercard, AMEX, Visa\n\nLa terminal te dice qué es. Si es Visa débito → la cuentas como Débito. Visa crédito → Visa.\n\n### Si la tarjeta es rechazada\n\n1. Avisa cordialmente al cliente: "La transacción no se procesó"\n2. Sugiere que intente otra tarjeta o efectivo\n3. **NO insistas** ni juzgues. Hay muchas razones legítimas para que se rechace\n4. Si insiste con la misma tarjeta, dile que con su banco verifiquen\n\n### Si la terminal falla técnicamente\n\n1. Avisa a Mónica/Gabriel inmediato\n2. Acepta solo efectivo mientras se resuelve\n3. Si falla mucho tiempo, escala — no es problema tuyo solucionar la red\n\n## Abrir el cajón SIN venta (no-sale)\n\nEl cajón puede abrirse sin venta para:\n\n- **Cambio**: cliente pide cambio de billete grande\n- **Reabastecer monedas** del fondo\n\nReglas:\n- **Cada no-sale debe tener una razón documentable**\n- El sistema cuenta los no-sales del día\n- **Si haces más de 2 sin justificación clara → bandera roja en el resumen**\n- Si tu turno termina con muchos no-sales, Mónica te preguntará por cada uno\n\n**REGLA DE ORO**: si abres el cajón sin venta, debe haber motivo claro. Nunca para "ver" el efectivo o "guardar algo".\n\n## Cancelaciones de ticket\n\nUn ticket cancelado significa que se anuló un cobro. Razones:\n\n- Error de captura (mesa equivocada, item duplicado)\n- Cliente no pagó al final (escapó, queja sin pagar)\n- Cobro doble por error\n\n### Proceso correcto\n\n1. **Antes de cancelar**: notifica a Mónica o Gabriel\n2. **Cancelas en el POS** (no solo le dices al sistema, hay un proceso técnico)\n3. **Capturas el motivo** de la cancelación\n4. **Anotas quién autorizó** (gerente)\n5. **Bandera roja al cierre** si excede 3% del total de cobros del día\n\nCancelaciones SIN autorización documentada = bandera roja gravísima al cierre. Evítalas.\n\n## Propinas\n\n- En **efectivo**: el cliente las deja en la mesa o las pide procesar contigo\n- En **tarjeta**: se capturan al momento de la transacción\n- Reparto: según política Fogueira (al cierre del turno)\n\nLas propinas en tarjeta NO son tuyas individualmente — entran al pool de reparto.',
      quiz: [
        { pregunta:'Antes de entregar el cambio al cliente, ¿qué debes hacer?',
          a:'Contar el cambio en voz alta o silenciosamente, verificar monto antes de entregar', b:'Confiar en lo que calcula el POS y entregar sin verificar', c:'Pedirle al cliente que cuente su cambio él mismo', d:'Nada — si se equivocó el POS el cliente lo reportará después',
          correcta:'a', explicacion:'Contar dos veces evita errores. Tu responsabilidad incluye la precisión del cambio.' },
        { pregunta:'Si abres el cajón sin venta más de 2 veces sin justificación clara, ¿qué pasa?',
          a:'Nada, es parte de la operación normal de caja', b:'Bandera roja en el resumen del día. Mónica te preguntará por cada no-sale al cierre', c:'Se bloquea el cajón automáticamente desde el sistema', d:'El POS emite una alerta de seguridad al dueño',
          correcta:'b', explicacion:'No-sales repetidos sin justificación = sospecha de manipulación. Cada uno debe tener motivo claro.' },
        { pregunta:'Para cancelar un ticket de cobro, ¿qué debes hacer?',
          a:'Cancelar tú sola en el POS sin avisar para no retrasar a los clientes', b:'1) Notificar a Mónica o Gabriel, 2) Cancelar en POS, 3) Capturar motivo, 4) Anotar quién autorizó. Sin autorización = bandera roja gravísima', c:'Borrar el ticket del sistema Fogueira y seguir', d:'Cobrar de tu bolsa la diferencia para no generar cancelación',
          correcta:'b', explicacion:'Cancelaciones requieren autorización documentada. Sin ella, sospecha de fraude.' },
        { pregunta:'Si la tarjeta del cliente es rechazada, ¿cómo respondes?',
          a:'Le preguntas cuánto dinero tiene en su cuenta', b:'Avisas cordialmente "la transacción no se procesó", sugieres otra tarjeta o efectivo. NO insistes ni juzgas (hay razones legítimas)', c:'Insistes pasando la tarjeta 3-4 veces más', d:'Le pides que muestre identificación para verificar que sea suya',
          correcta:'b', explicacion:'Profesionalismo y discreción. Es problema del banco, no del cliente como persona.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 4: Captura de cortesías ----------
    {
      titulo: '⭐ Captura de cortesías (los 3 datos)',
      resumen: 'Cómo registras cortesías en bitácora con los 3 datos obligatorios. Quiénes pueden autorizar. Tu rol como verificadora.',
      tiempo: 8,
      contenido: '## TÚ NO autorizas, pero TÚ capturas\n\nLa cortesía la **autoriza** el gerente (Mónica o Gabriel). La **captura** se hace en bitácora — y muchas veces tú participas en esa captura junto con el host porque al final tienes el ticket POS.\n\nTu rol: **verificadora**. Antes de aceptar registrar una cortesía, debes verificar que tiene los 3 datos correctos.\n\n## Quiénes pueden autorizar cortesías en Fogueira\n\nSolo **DOS personas**:\n\n- **Gerente Administrativo** (Mónica)\n- **Gerente de Restaurante** (Gabriel)\n\nNadie más. Ni el host, ni la cocina, ni el cliente, ni TÚ.\n\nSi un host viene a decirte "autoriza Mónica" y tú no la viste autorizar, **PARA**:\n\n1. Llama a Mónica directamente\n2. Pregúntale: "¿Autorizaste cortesía a la mesa X por motivo Y?"\n3. Si dice sí → captura\n4. Si dice no → **fraude operativo en proceso**. Notifica inmediato\n\nEsta verificación de 30 segundos te puede ahorrar problemas grandes.\n\n## Los 3 datos obligatorios de cada cortesía\n\nEn la bitácora, cada cortesía debe tener:\n\n| Dato | Dónde | Por qué |\n|------|-------|---------|\n| **Autoriza** | Dropdown columna "Autoriza" | Trazabilidad: quién aprobó |\n| **Folio del ticket POS** | Columna "Ticket" | Cruzar con el POS al cierre |\n| **Motivo** | Columna "Observaciones" | Justificación para auditoría |\n\nSi falta cualquiera de los 3 → **bandera roja al cierre**. NO podrás conciliar limpio.\n\n## Tu papel concreto\n\nCuando un host registra una cortesía en bitácora, tú al cierre debes verificar:\n\n1. **¿Autoriza está lleno?** Si dice "Mónica" o "Gabriel" — OK\n2. **¿Folio del POS coincide?** Compara con el ticket físico\n3. **¿Motivo es claro?** Si dice "varios" o vacío → no aceptable\n\nSi algo falta → coordina con el host para completar ANTES de que termine el servicio. Mientras la operación esté activa, es fácil corregir. Una vez cerrado, complica.\n\n## Cortesías automáticas — niños 0-5\n\nLos niños de 0 a 5 años son cortesía automática por edad. NO requieren autorización de gerente.\n\nEn la bitácora, el host selecciona "Bebé/niño 0-5" en el dropdown de Autoriza. El sistema lo acepta sin firma porque la regla es la edad.\n\n## Casos comunes\n\n### "El gerente autoriza, pero no está aquí ahora"\n- **NO la registres como cortesía pendiente**\n- Pide al host que llame al gerente para confirmar verbalmente\n- Si el gerente no contesta → cobra normal y resuelvan después si fue válida\n\n### "El cliente exige cortesía pero ningún gerente la autoriza"\n- **Tú no la das**\n- Cobra normal. Si el cliente reclama, llama a Gabriel para que hable con él\n- Tu trabajo es procesar pagos según las reglas, no negociar\n\n### "El host se equivocó al capturar la cortesía"\n- Antes de cerrar la bitácora, el host puede editar la fila (botón ✎)\n- Si ya cerraste, solo el admin puede modificar (con motivo en auditoría)\n\n## Auditoría de cortesías\n\nAl cierre del día, en el Resumen, verás:\n\n- **Cortesías día** (KPI con número total)\n- **Bandera "Cortesías sin autorización documentada"** (si las hay)\n\nMónica revisa esto al firmar. Si encuentra cortesías inválidas, te puede preguntar.\n\n## Tu protección\n\nLa mejor protección es **siempre verificar** antes de aceptar registrar. Si capturas una cortesía falsa, parece que tú participaste en el fraude (aunque no la autorizaste).\n\nUna verificación de 30 segundos = tu protección laboral.',
      quiz: [
        { pregunta:'¿Quiénes son los DOS únicos autorizados para firmar cortesías en Fogueira?',
          a:'Gerente Administrativo (Mónica) y Gerente de Restaurante (Gabriel)', b:'Cualquier gerente activo del turno', c:'La cajera en turno para agilizar el servicio', d:'El host más antiguo o con mayor rango',
          correcta:'a', explicacion:'Solo Mónica y Gabriel autorizan cortesías. Tú las capturas pero NO las autorizas.' },
        { pregunta:'Una cortesía DEBE llevar 3 datos para evitar bandera roja al cierre. ¿Cuáles?',
          a:'Solo el monto de la cortesía y la mesa', b:'Autoriza (Mónica o Gabriel), folio del ticket POS, motivo en observaciones', c:'Solo nombre del cliente y hora del servicio', d:'Mesa, hora y tipo de descuento aplicado',
          correcta:'b', explicacion:'Estos 3 garantizan trazabilidad: quién aprobó + cruce con POS + justificación.' },
        { pregunta:'Un host te dice "Mónica autorizó cortesía" pero tú no la viste. ¿Qué haces?',
          a:'Capturas confiando en el host porque es su responsabilidad', b:'PARAS. Llamas a Mónica directamente para verificar. Si dice sí → captura. Si dice no → fraude operativo, notificas inmediato', c:'La capturas y luego preguntas al cierre del turno', d:'La rechazas sin más explicación al host',
          correcta:'b', explicacion:'Verificación de 30 segundos te protege. Capturar sin verificar = parecer cómplice si es fraude.' },
        { pregunta:'¿Las cortesías de niños 0-5 años requieren autorización de gerente?',
          a:'Sí, siempre — toda cortesía requiere firma gerencial', b:'No, son cortesía automática por edad. El host selecciona "Bebé/niño 0-5" en el dropdown', c:'Solo cuando hay más de 3 niños en la misma mesa', d:'Solo en domingo cuando la capacidad está al tope',
          correcta:'b', explicacion:'0-5 = cortesía automática. Todo lo demás (queja, evento, descuento) requiere firma de Mónica o Gabriel.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: Cierre profundo (CRÍTICO) ----------
    {
      titulo: '⚠ Cierre profundo — corte y conciliación (CRÍTICO)',
      resumen: 'El módulo más importante del curso: cómo cerrar correctamente el servicio. Las 10 secciones, los 2 depósitos, arqueo, sello.',
      tiempo: 12,
      contenido: '## Por qué este módulo es CRÍTICO\n\nEl cierre profundo es **donde validas todo lo que pasó financieramente** durante el servicio. Errores aquí cuestan dinero al restaurante y traen banderas para auditoría.\n\nLee con calma. **Este es el módulo más importante de tu rol.**\n\n## Cuándo se hace\n\nAl final de cada servicio:\n- **Lun–Jue**: 1 cierre al día (~11pm tras Buffet)\n- **Vie–Dom**: 2 cierres (Desayuno ~12pm, Comida ~11pm)\n\n## Las 10 secciones del Cierre PROFUNDO\n\n1. **Auto-llenar** (consolidación)\n2. Corte de caja (efectivo)\n3. Tarjetas\n4. Cortesías\n5. Promociones\n6. Depósitos a tesorería (DOS)\n7. Arqueo ciego\n8. Banderas rojas\n9. Sellos\n10. Firma final\n\n## 1. Auto-llenar\n\nClick en **"Auto-llenar"**. El sistema consolida las bitácoras del día (suma adultos, niños, 3a edad, cortesías, etc.). Verifica visualmente que los números cuadren con la operación esperada.\n\n## 2. Corte de caja\n\nCaptura **el desglose por denominación** del efectivo en caja:\n- Billetes: $1000, $500, $200, $100, $50, $20\n- Monedas: $10, $5, $2, $1, $0.50\n\nEl sistema multiplica y suma. **Verifica el total** — debe coincidir con tu conteo manual.\n\n### Buenas prácticas del conteo\n\n- **Cuenta dos veces** cada denominación\n- Si te confundes, **vuelve a empezar** (no asumas)\n- Si hay diferencia significativa → **antes de capturar**, recuenta\n\n## 3. Tarjetas\n\nSeparas por tipo:\n- **Débito** (Visa débito + otros débito)\n- **Mastercard** (crédito)\n- **AMEX** (crédito)\n- **Visa** (crédito)\n\n### Cómo separar\n\nLa terminal o el reporte del POS te dice qué fue cada cobro. Apunta en una hoja durante el día (o al cierre revisas vouchers físicos uno por uno).\n\n**Verifica que la suma total de tarjetas coincida con el reporte del POS**. Si hay diferencia → investiga voucher por voucher.\n\n## 4. Cortesías\n\nVerifica que **cada cortesía** capturada en bitácora tenga los 3 datos:\n- Autoriza (Mónica o Gabriel)\n- Folio del ticket POS\n- Motivo en observaciones\n\nSi alguna falta → coordina con host para completar ANTES de firmar.\n\n## 5. Promociones aplicadas\n\nSi se aplicó alguna (DUO, etc.):\n- Verifica que cumple las reglas (días/horas/personas)\n- Si fue mal aplicada → bandera roja\n\n## 6. Depósitos a tesorería — DOS OBLIGATORIOS\n\n**Reglas Fogueira**:\n- **Depósito 1**: venta del día (efectivo + tarjetas)\n- **Depósito 2**: comisiones bancarias (separado para análisis)\n\nAmbos deben:\n- Coincidir en monto con lo capturado\n- Tener folio de tesorería\n- Estar firmados por quien depositó (tú o quien autorice Mónica)\n\n**Si falta uno → bandera roja**. NO firmes el cierre con un solo depósito.\n\n## 7. Arqueo ciego\n\nEl sistema calcula automáticamente:\n```\nVenta teórica = (adultos × t_adulto) + (niños × t_nino) + (3era × t_3era) - cortesías\nDinero esperado en caja = Venta teórica - depósitos - tarjetas\n```\n\nLuego compara con lo CONTADO. Diferencia:\n\n| Diferencia | Acción |\n|-----------|--------|\n| < $50 | Error de cambio normal, OK |\n| $50-$200 | Revisar tickets, recontar |\n| $200-$1000 | Investigar; capturar motivo en observaciones |\n| **> $1000** | **NO firmar. Llamar a Mónica antes de cerrar** |\n\n## 8. Banderas rojas — TU CHECKLIST FINAL\n\nAntes de firmar, revisa:\n\n- ❌ Cortesías sin autoriza\n- ❌ Cortesías sin folio\n- ❌ Cortesías con motivo débil\n- ❌ Diferencias en arqueo > $200 sin explicación\n- ❌ Depósitos a tesorería incompletos\n- ❌ Sellos pendientes (host, cocina, churrasca)\n- ❌ Tarjetas que NO cuadran con POS\n- ❌ Filas de bitácora SIN hora_sal al cierre\n- ❌ Cancelaciones sin autorización\n- ❌ Promociones mal aplicadas\n\n**Cualquiera SIN explicar → NO firmes.**\n\n## 9. Sellos pendientes\n\nEn sección 05 verás "Esperados vs Hechos". Si hay rojos:\n- Llama a la persona si está disponible\n- Si imposible: que Mónica o Gabriel hagan **override admin** con motivo\n- Tú NO haces override (no tienes el privilegio)\n\n## 10. Firma final — TU SELLO\n\n1. Revisaste todo\n2. Banderas explicadas o resueltas\n3. **Firmas tu sello** desde tu sesión\n4. Conciliación queda **cerrada** con `cerrada_at = ahora`\n5. Después solo override admin la modifica\n\n## Tu firma significa\n\n*"Como cajera del turno, doy fe de que el corte de caja es correcto, las tarjetas cuadran, las cortesías están autorizadas, los depósitos se hicieron, el arqueo es razonable, y los sellos están firmados."*\n\nSi firmas sin revisar y aparece problema mañana → **es responsabilidad tuya**.\n\n## Si HAY banderas que no se resuelven\n\n- **Documenta TODAS** en observaciones\n- **Llama a Mónica** antes de firmar\n- Si **dinero faltante > $1,000**: llama inmediato\n- Si **fraude sospechado**: documenta y escala\n\nMejor tardar 30 min más en cerrar que firmar con problemas.\n\n## Hábito que te protege\n\n- Cuenta caja **antes de pedir el reporte POS** (vista limpia)\n- Captura **con calma**, no con prisa\n- **Pide a Mónica que te acompañe** si es tu primer cierre del mes — ella te valida\n- Al final del cierre, **despídete tranquila** sabiendo que firmaste algo correcto',
      quiz: [
        { pregunta:'¿Cuántos depósitos a tesorería deben hacerse al día y por qué?',
          a:'Uno solo con el total consolidado del día', b:'DOS: venta del día + comisiones bancarias (separados para análisis contable). Si falta uno, bandera roja', c:'Tres: efectivo, débito y crédito por separado', d:'Ninguno si el efectivo se queda en caja',
          correcta:'b', explicacion:'Reglas Fogueira: separación contable obligatoria. Cada depósito con folio.' },
        { pregunta:'En arqueo ciego hay diferencia FALTANTE de $1,200 sin explicación. ¿Qué haces?',
          a:'Firmas igual porque probablemente fue error de cambio', b:'NO firmas. Llamas a Mónica antes de cerrar. Diferencias > $1,000 escalan inmediato', c:'Pones el dinero de tu bolsa para cuadrar y reportas después', d:'Borras la diferencia del campo y capturas cero',
          correcta:'b', explicacion:'$1,200 sin explicación es bandera crítica. Mónica decide cómo proceder. NO firmar a ciegas.' },
        { pregunta:'Si un sello esperado falta al cierre (cocina no firmó), ¿quién hace el override?',
          a:'Tú como cajera, para no retrasar el cierre', b:'Mónica o Gabriel (admin/gerente_administrativo) — tú NO tienes ese privilegio', c:'El host del turno puede hacerlo desde su sesión', d:'Cualquier usuario activo con turno vigente',
          correcta:'b', explicacion:'Override admin requiere rol con privilegio admin. Tú no tienes; llama al gerente.' },
        { pregunta:'¿Qué información valida tu sello de cierre formalmente?',
          a:'Solo que viste el sistema y los números parecían bien', b:'Que confías en que el host y la cocina hicieron su parte', c:'Que el sistema no arrojó errores técnicos al cargar', d:'Que el corte es correcto, tarjetas cuadran, cortesías autorizadas, depósitos hechos, arqueo razonable, sellos firmados',
          correcta:'d', explicacion:'Tu firma es acto formal con responsabilidad. Si firmas no revisado, problemas mañana son tu responsabilidad.' },
        { pregunta:'¿Cuál es la mejor práctica al contar el efectivo del corte?',
          a:'Confiar en lo que diga el POS sin recontar', b:'Cuenta dos veces cada denominación. Si te confundes, vuelve a empezar. Si hay diferencia, recuenta antes de capturar', c:'Conta solo una vez rápido para no retrasar a Mónica', d:'Pídele al host que cuente mientras tú cierras el POS',
          correcta:'b', explicacion:'Doble conteo previene errores. Tu precisión vale más que tu velocidad en este momento.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 6: Resumen y banderas (CRÍTICO) ----------
    {
      titulo: '⚠ Resumen del día y semáforo de banderas (CRÍTICO)',
      resumen: 'Cómo se ve el resumen y qué hacer en cada bandera roja desde tu rol. Coordinación con Mónica/Gabriel para el cierre final.',
      tiempo: 10,
      contenido: '## Tu participación en el Resumen\n\nLa pestaña **Resumen** es el tablero ejecutivo del día. Aunque la firma final es de Mónica (o Gabriel), **tú eres la primera línea de defensa**. Si tú no detectaste banderas durante tu cierre profundo, llegan al resumen y son visibles para todos.\n\nEste módulo te enseña a **leer** el resumen para que cuando Mónica venga a firmar, **ya esté limpio**.\n\n## Estructura del Resumen — 3 secciones\n\n1. Grid de 11 KPIs (arriba)\n2. **01 Semáforo de banderas rojas** (10 checks automáticos)\n3. **02 Conclusión del auditor** (Mónica firma)\n\n## Los 11 KPIs y qué te dicen\n\n- **Cobros del día**: total ingresos. Si sale $0 con operación → error\n- **Comensales POS**: personas según POS. Compara con lo esperado\n- **Cobro promedio / comensal**: ticket promedio\n- **Propina prom. / comensal**: indicador de servicio\n- **Δ Host vs POS**: diferencia hosts vs POS. Debe ser ~0\n- **Δ Arqueo ciego**: tu cierre de efectivo vs teórico\n- **Δ Terminal vs POS**: tarjetas (lote bancario vs POS)\n- **% Cancelaciones**: cuántos tickets cancelaste\n- **No-sales día**: cuántas veces abriste cajón sin venta\n- **Cortesías día**: cuántas cortesías hubo\n- **Δ Folios**: tickets emitidos consecutivos o no\n\n## Las 10 banderas y qué hacer (DESDE TU ROL)\n\n### 1. Δ Comensales (Host vs POS) > 2\n**Tu rol**: confirmar con host que registraron a todos. Cruzar tickets POS con bitácora.\n\n### 2. Δ Arqueo ciego > $200\n**Tu rol CRÍTICO**: este eres tú. Si > $200, recontar dinero, revisar tickets, identificar diferencia.\n\n### 3. Δ Cierre de lote terminal vs POS\n**Tu rol**: revisar vouchers vs POS. Identificar cobros dobles o devoluciones no aplicadas.\n\n### 4. % Cancelaciones > 3%\n**Tu rol**: cada cancelación que tú hiciste debe tener autorización. Si no la tiene, completar antes de firmar.\n\n### 5. No-sales > 2\n**Tu rol**: justifica cada no-sale tuyo. Si fueron por cambio legítimo, anótalo en observaciones.\n\n### 6. Cortesías SIN autorización\n**Tu rol**: las verificaste al cierre profundo. Si llega bandera, regresar al cierre y completar.\n\n### 7. Cancelaciones SIN autorización\n**Tu rol**: similar al 4. Documentar autorización para cada cancelación.\n\n### 8. Cierre de lote bancario no realizado\n**Tu rol**: cerrar la terminal antes de irte. Si la terminal falla, avisa.\n\n### 9. Δ Operaciones del lote vs Vouchers\n**Tu rol**: contar vouchers físicos uno por uno. Identificar diferencia.\n\n### 10. Saltos en folios consecutivos\n**Tu rol CRÍTICO**: cada folio anulado debe tener motivo. Si hay saltos sin explicación, **señal de fraude**. Documenta y escala.\n\n## La pregunta que te define\n\nMónica viene a firmar. Le dices: **"Está limpio"** o **"Hay banderas, ya las explico"**.\n\n- Si dijiste "limpio" y hay banderas → mala señal (no las viste)\n- Si dijiste "hay banderas, ya las explico" → eres profesional (las viste y manejaste)\n\nMejor reportar 5 banderas explicadas que ocultar 1 sin notar.\n\n## Coordinación con Mónica/Gabriel al cierre\n\nDurante el cierre profundo, **avísale a Mónica si va a venir a firmar pronto**:\n\n- "Mónica, cerré caja. Voy a depositar y luego tú firmas, ¿OK?"\n- O por WhatsApp si está fuera: "Cierre listo, te mando captura del Resumen"\n\nEsto te permite:\n- Resolver cualquier duda con ella ANTES de que firme\n- No retenerla esperando si las banderas requieren su intervención\n\n## Conclusión del auditor (Mónica firma)\n\nLa sección 02 — Conclusión — la firma Mónica con:\n\n- **Estatus general**: OK / Observaciones menores / Graves / Críticas\n- **Comentarios y plan de acción**\n\nTu papel: **darle la información para que firme bien**. Si Mónica firma "OK" cuando había problemas, es responsabilidad compartida — pero tú también sabías y no le dijiste.\n\n## Tu protección profesional\n\n- **Documenta lo que viste**: si hay banderas que escapan a tu control, anótalo en observaciones\n- **Comunica claramente**: prefiere reportar exceso que ocultar\n- **No firmes "limpio" si no lo está**: tu sello respalda la realidad operativa\n\nUna buena cajera **que reporta banderas con honestidad** es más valiosa que una "perfecta" que oculta problemas. Mónica lo sabe.',
      quiz: [
        { pregunta:'En el Resumen del día, ¿quién tiene el rol PRINCIPAL en la bandera "Δ Arqueo ciego > $200"?',
          a:'TÚ (la cajera) — es tu cierre de efectivo vs teórico. Si > $200, debes recontar e investigar antes de que Mónica firme', b:'El host — él es quien captura los comensales en bitácora', c:'Cocina — el arqueo depende de los consumos de charolas', d:'Mónica — ella tiene la última palabra en arqueo',
          correcta:'a', explicacion:'El arqueo es directamente tu responsabilidad. Mónica solo valida lo que tú reportaste.' },
        { pregunta:'Saltos en folios consecutivos sin explicación pueden indicar:',
          a:'Error normal del POS que se autocorrige después', b:'Problema técnico menor que no afecta la operación', c:'Posible FRAUDE — tickets emitidos no reportados o anulados sin documentar. Cada folio faltante debe explicarse', d:'Que el POS necesita reiniciarse para alinear los folios',
          correcta:'c', explicacion:'Es la bandera más sospechosa de fraude. Documenta y escala cualquier salto sin explicación.' },
        { pregunta:'Cuando Mónica viene a firmar, ¿cuál es la mejor postura profesional?',
          a:'Decir "todo limpio" aunque haya algo para no preocuparla', b:'Si hay banderas: "Hay banderas, ya las explico" — reporta con honestidad y muestra que las viste y manejaste', c:'No decir nada y dejar que ella descubra lo que haya', d:'Pasarle la responsabilidad de revisarlo ella sola',
          correcta:'b', explicacion:'Reportar honestidad protege a todos. Una cajera que oculta problemas pierde confianza; una que los reporta gana respeto.' },
        { pregunta:'Si las banderas en el Resumen escapan a tu control inmediato (ej: cortesía sin autorización del host), ¿qué haces antes de que Mónica firme?',
          a:'Esperas que Mónica llegue y ella decida sola', b:'Documentas en observaciones, avisas a Mónica del problema, esperas su decisión antes de cerrar', c:'Firmas tú el resumen para que avance', d:'Borras la cortesía problemática del sistema',
          correcta:'b', explicacion:'Tu papel es darle a Mónica la información completa para que firme con conocimiento. Documentación + aviso = profesionalismo.' },
        { pregunta:'¿Cuál es tu mayor protección profesional al cierre?',
          a:'Firmar rápido para que Mónica no espere mucho', b:'Documentar lo que viste, comunicar claramente, no firmar "limpio" si no lo está. Honestidad > apariencia de perfección', c:'Esperar a que otros resuelvan los problemas primero', d:'Echar la culpa al POS para no cargar con la diferencia',
          correcta:'b', explicacion:'Una cajera que reporta banderas con honestidad es más valiosa que una "perfecta" que oculta problemas.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 7: Situaciones difíciles ----------
    {
      titulo: 'Situaciones difíciles y cómo manejarlas',
      resumen: 'Cliente con queja, tarjeta rechazada, falla del POS, presión para autorizar sin permiso, billete falso, falta de cambio.',
      tiempo: 7,
      contenido: '## La realidad operativa\n\nNo todo el día es perfecto. Habrá clientes molestos, tarjetas rechazadas, fallas técnicas. Tu trabajo es **manejar con calma y profesionalismo** sin asumir responsabilidades que no te corresponden.\n\nEste módulo te da el playbook para los casos más comunes.\n\n## Caso 1 — Cliente con queja\n\n**Síntoma**: cliente molesto reclama por servicio, comida, espera, etc.\n\n**Tu respuesta**:\n1. **Escucha primero** — no defiendas, no culpes\n2. **Ofrece llamar al gerente**: "Permíteme un momento, llamo a Gabriel para que platique con usted"\n3. **NO autorices descuentos por tu cuenta** — espera a Gabriel\n4. **NO discutas** con el cliente — tu trabajo es procesar pagos, no debatir\n\nGabriel decide la solución (cortesía, reposición, descuento). Tú ejecutas según su instrucción.\n\n## Caso 2 — Tarjeta rechazada\n\n**Síntoma**: la terminal devuelve "Transacción rechazada" o similar.\n\n**Tu respuesta**:\n1. **Calma**: "La transacción no se procesó, ¿pueden intentar otra tarjeta o efectivo?"\n2. NO juzgues al cliente (puede ser fondo, límite, banda magnética dañada)\n3. Si insiste con la misma → "Le sugiero verificar con su banco"\n4. Si no tiene otra opción → llama a Gabriel para que decida (cortesía? esperar? cobrar después?)\n\n## Caso 3 — Cliente con presión para autorizar algo sin permiso\n\n**Síntoma**: "Soy amigo del dueño", "Vengo siempre, dame descuento", "Conozco a Mónica, ella autoriza"\n\n**Tu respuesta**:\n1. **NO autorices** bajo ninguna circunstancia\n2. **NO te disculpes excesivamente**: "Aprecio mucho que sea cliente frecuente. La política es que solo el gerente puede autorizar descuentos. Permítame llamarlo"\n3. **Llama a Gabriel** y deja que decida\n4. Si Gabriel/Mónica dicen no → cobras normal con cordialidad\n\nEsto te protege: si algún día auditoría revisa cortesías, no aparece tu firma autorizando. Eres una procesadora, no decisora.\n\n## Caso 4 — Falla del POS\n\n**Síntoma**: el POS no abre, no imprime, no procesa cobros.\n\n**Tu respuesta**:\n1. **Avisa a Mónica/Gabriel inmediato**\n2. Mientras se resuelve: acepta solo efectivo, anota en papel cada transacción (mesa, monto, cliente si aplica)\n3. Cuando vuelva el POS: captura las transacciones pendientes\n4. NO atiendas más clientes con tarjeta hasta que funcione\n\n## Caso 5 — Falla de internet\n\n**Síntoma**: el sistema Fogueira no carga, las terminales no procesan.\n\n**Tu respuesta**:\n1. Avisa a Mónica/Gabriel\n2. Acepta solo efectivo (las terminales bancarias suelen tener fallback offline limitado)\n3. Anota en papel cada cobro\n4. Cuando vuelva el internet: captura todo\n\n**El sistema Fogueira tiene reintentos infinitos**. Si capturaste algo cuando no había internet, se subirá automáticamente cuando vuelva. No vuelvas a capturar.\n\n## Caso 6 — Billete falso o sospechoso\n\n**Síntoma**: cliente paga con billete que se siente extraño (textura, color, ausencia de marca de agua).\n\n**Tu respuesta**:\n1. **NO acuses al cliente directamente** (puede haberlo recibido sin saber)\n2. "Permítame un segundo a verificar" → llama a Mónica/Gabriel\n3. Mónica revisa al trasluz, marca de agua, hilo de seguridad\n4. Si es falso: Mónica habla con el cliente con tacto\n5. **Si es legítimo**: te disculpas y procedes normal\n\nUn billete falso aceptado = pérdida que recae sobre ti si no se detectó. Por eso vale la pena verificar.\n\n## Caso 7 — Falta de cambio chico\n\n**Síntoma**: te quedaste sin monedas o billetes pequeños para dar cambio.\n\n**Tu respuesta**:\n1. **Pide cambio a Mónica** o usa el fondo de reserva\n2. Si no hay solución inmediata, **redondea a favor del cliente** (nunca en tu favor)\n3. Anota en observaciones del cierre que hubo problema de cambio\n\nNunca le des "fiado" al cliente "te debo $5". O das cambio completo o redondeas a su favor.\n\n## Caso 8 — Cambio inesperado de turno\n\n**Síntoma**: la cajera del siguiente turno no llegó, o tú tienes que irte de emergencia.\n\n**Tu respuesta**:\n1. **Avisa inmediato a Mónica/Gabriel**\n2. **NO entregues el cajón sin firma** de quien lo recibe\n3. Si tienes que irte y no hay reemplazo: cuenta tu caja, captura cierre intermedio, deja documentado en observaciones\n4. Mónica decide si cierra el restaurante o si ella misma toma caja temporalmente\n\n## Caso 9 — Sospecha de robo o intento\n\n**Síntoma**: cliente sospechoso ronda la caja, intento de distracción, sospecha de robo en el cajón.\n\n**Tu respuesta**:\n1. **NO te enfrentes** — tu seguridad es lo primero\n2. Avisa al gerente discretamente (señal acordada o WhatsApp)\n3. **Si sucede el robo**: NO resistas. Da lo que pidan. La caja se recupera; tú no.\n4. Después: reporta a policía + documentación al sistema\n\n## Tu protección general\n\n- **Verifica antes de autorizar nada**\n- **Llama al gerente cuando dudes**\n- **Documenta excepciones** en observaciones\n- **No tomes decisiones que no te corresponden** (cortesías, descuentos, cancelaciones grandes)\n- **Tu seguridad personal > cualquier dinero**\n\nLa cajera más respetada en Fogueira es la que sabe **cuándo no es su decisión** y cuándo escalar.',
      quiz: [
        { pregunta:'Un cliente molesto te reclama por la cuenta. ¿Qué haces?',
          a:'Le bajas el precio para que se calme y no se vaya molesto', b:'Escuchas, ofreces llamar al gerente: "Permíteme, llamo a Gabriel para que platique con usted". NO autorizas descuentos por tu cuenta', c:'Discutes con él para defender los precios del restaurante', d:'Le pides que se vaya y vuelva cuando se calme',
          correcta:'b', explicacion:'Tu rol es procesar pagos. Las quejas y descuentos los maneja el gerente. Tú escalas con cordialidad.' },
        { pregunta:'Un cliente dice "soy amigo del dueño, dame descuento". ¿Qué haces?',
          a:'Le das descuento por si acaso es cierto', b:'NO autorizas. "Aprecio que sea cliente. La política es que solo el gerente autoriza descuentos. Permítame llamarlo". Llamas a Gabriel', c:'Lo ignoras y cobras normal sin explicar nada', d:'Le cobras de más para compensar el posible fraude',
          correcta:'b', explicacion:'Sin importar quién diga ser, tú no autorizas. Llamar al gerente protege a todos.' },
        { pregunta:'Si el POS falla y no procesa cobros, ¿qué haces?',
          a:'Cierras la caja y esperas que se arregle solo el POS', b:'Avisas a Mónica/Gabriel. Aceptas solo efectivo, anotas cada transacción en papel. Cuando vuelva el POS, capturas pendientes', c:'No haces nada hasta que llegue el técnico de SR12', d:'Cobras al doble en efectivo para compensar la pérdida de tarjetas',
          correcta:'b', explicacion:'Continuidad operativa con respaldo manual. Lo importante es no perder cobros y capturar después.' },
        { pregunta:'Sospechas que un billete es falso. ¿Cómo respondes?',
          a:'Acusas al cliente directamente frente a todos', b:'"Permítame un segundo a verificar" — llamas a Mónica/Gabriel para revisar al trasluz. NO acusas directamente al cliente', c:'Lo aceptas para no incomodar y reportas al final del turno', d:'Le pides identificación oficial como protocolo de seguridad',
          correcta:'b', explicacion:'Verificación discreta sin acusar. Si resulta falso, Mónica maneja con tacto. Si es legítimo, te disculpas.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Curso del Encargado de Piso (sub-gerente). Segundo a cargo después de Gabriel. 100% en piso
// durante servicio. Foco: monitoreo de tableros, resolución de bloqueos, coordinación de equipo. 5 módulos.
function modulosCursoEncargadoPiso() {
  return [
    // ---------- Módulo 1: Tu rol como sub-gerente ----------
    {
      titulo: 'Tu rol como sub-gerente / encargado de piso',
      resumen: 'Eres el segundo a cargo después de Gabriel. 100% en piso durante el servicio. Lo que sí y lo que no autorizas.',
      tiempo: 5,
      contenido: '## Tu posición\n\nEres el **sub-gerente** o **encargado de piso** — el segundo a cargo después de Gabriel (Gerente de Restaurante). Tu rol es 100% **frontline operativo**: estás en piso durante todo el servicio, viendo lo que pasa, coordinando al equipo, destrabando problemas en tiempo real.\n\nEs un rol **clave** porque mientras Gabriel atiende cosas estratégicas (reuniones, cortesías mayores, cierre con cajera), tú mantienes la operación fluyendo en cancha.\n\n## Organigrama\n\n```\n          Dirección (Germán)\n                 ↓\n   Gerente Administrativo (Mónica)\n                 ↓\n    Gerente de Restaurante (Gabriel)\n                 ↓\n   Encargado de Piso / Sub-gerente (TÚ)\n                 ↓\n        Hosts, meseros\n        Cocina, Churrasca\n        Cajera (apoyo, no jefatura)\n```\n\n## Comparado con Gabriel\n\n| Aspecto | Gabriel | Tú |\n|---|---|---|\n| Posición | Estratégico-operativo | 100% piso siempre |\n| Autoriza cortesías | **Sí** | **No** |\n| Salir del restaurante | A veces (administrativo) | Casi nunca durante servicio |\n| Override admin de sellos | Sí (con motivo) | No |\n| Decisiones financieras | Sí | No |\n| Foco | Supervisión + cortesías + cierre | Fluidez minuto a minuto |\n\n**Resumen**: Gabriel es el director técnico, tú eres el capitán en cancha.\n\n## Lo que TÚ controlas\n\n- **Coordinación operativa** de hosts, meseros, cocina, churrasca, cajera\n- **Asignación de mesas** cuando hay decisiones complejas (grupo grande, turnos pico)\n- **Resolución de bloqueos** durante el servicio\n- **Comunicación entre roles** (host avisa cocina, cocina avisa cajera, etc.)\n- **Decisiones operativas pequeñas** (mover una mesa, juntar grupos, cambiar de host de turno)\n\n## Lo que NO autorizas\n\n- ❌ **Cortesías** — solo Mónica y Gabriel\n- ❌ **Cancelaciones masivas** sin Gabriel/Mónica\n- ❌ **Override admin** de sellos\n- ❌ **Cambios financieros** (tarifas, descuentos)\n- ❌ **Decisiones de personal** (contratar, despedir, amonestar formalmente)\n\nSi alguien te presiona para autorizar algo que no te corresponde: **NO lo autorices**. Llama a Gabriel.\n\n## Tu hábito principal\n\n**Estar en piso, visible, atento**. No te encierres en oficina, no estés pegado al teléfono. Tu valor es que **te ven y resuelves**.\n\n- Camina el salón cada 15-20 min\n- Saluda a clientes recurrentes\n- Pregunta a hosts si necesitan algo\n- Verifica que cocina/churrasca tengan ritmo\n- Avisa a cajera si viene un cliente con cuenta grande\n\n## Tu sesión\n\nDura **hasta las 3:00 am del día siguiente** (día lógico restaurante). Cubre todo el turno.\n\n## Tu firma\n\nNo firmas sellos críticos del cierre (esos son de host, cajera, cocina, churrasca, gerente). Pero todo lo que documentas o registras en el sistema queda con tu user_id y timestamp.\n\nSi haces alguna intervención operativa importante (asignar mesa especial, autorizar movimiento), anótalo en observaciones de la bitácora.',
      quiz: [
        { pregunta:'¿Cuál es la diferencia clave entre Gabriel (Gerente Restaurante) y tú (Encargado de Piso)?',
          a:'Gabriel es estratégico-operativo y autoriza cortesías; tú estás 100% en piso siempre y NO autorizas cortesías. Él es director técnico, tú eres capitán en cancha', b:'Gabriel cocina y tú no cocinas', c:'Tú eres el jefe de Gabriel durante el servicio', d:'Ninguna, tienen las mismas responsabilidades',
          correcta:'a', explicacion:'Roles complementarios. Gabriel puede salir; tú estás siempre en piso. Tu valor está en presencia activa.' },
        { pregunta:'¿Qué decisiones financieras NO autorizas tú?',
          a:'Ninguna, tienes autoridad operativa completa', b:'Solo cortesías de más de $300', c:'Decides todas cuando Gabriel no está disponible', d:'Cortesías, cancelaciones masivas, override de sellos, cambios de tarifa, descuentos. Solo Mónica y Gabriel manejan dinero',
          correcta:'d', explicacion:'Tu autoridad es operativa, no financiera. Llamas a Gabriel para decisiones de dinero.' },
        { pregunta:'¿Cuál es tu hábito principal durante un servicio?',
          a:'Estar en oficina pegado a la computadora revisando el sistema', b:'Estar en piso, visible, atento. Caminar el salón cada 15-20 min, saludar clientes, preguntar a hosts si necesitan algo', c:'Esperar a que los hosts te reporten los problemas', d:'Solo atender el teléfono y WhatsApp del equipo',
          correcta:'b', explicacion:'Presencia activa = valor. No te encierres ni estés pegado al celular. Te ven y resuelves.' }
      ],
      minAprobatorio: 3
    },
    // ---------- Módulo 2: Los 4 tableros del sistema ----------
    {
      titulo: 'Tus 4 tableros del sistema en piso',
      resumen: 'Plano del salón, reservaciones, bitácora, charolas. Qué buscar en cada uno y con qué frecuencia revisarlos.',
      tiempo: 7,
      contenido: '## Tus 4 tableros operativos\n\nDurante el servicio, **monitoreas continuamente** cuatro pantallas del sistema. Cada una te da información distinta. Aprende a leerlas y revísalas con frecuencia.\n\n## Tablero 1 — Plano del salón\n\n**Cómo accederlo**: desde Bitácora → botón "📐 Plano del salón"\n\n**Qué muestra**: las mesas físicas con su estado actual, agrupadas por zona.\n\n### Estados visuales\n- 🟢 **Libre**: lista para asignar\n- 🟠 **Ocupada**: grupo activo, muestra nombre + pax + hora entrada\n- 🟡 **En espera**: reserva confirmada, llega pronto\n- 🔵 **Desocupada**: grupo se fue, hay que limpiar antes de reasignar\n\n### Información extra por mesa\n- Capacidad (👥 4 pax)\n- Tiempo promedio histórico (⏱ ~75 min) — útil para predecir liberación\n- Si el grupo lleva más del promedio → considerar acción\n\n### Por zona\n- Header con resumen: cuántas libres, ocupadas, en espera\n- Te permite decir rápido "en Terraza hay 4 libres"\n\n**Frecuencia de revisión**: cada 10-15 min durante el servicio\n\n## Tablero 2 — Reservaciones del día\n\n**Cómo accederlo**: desde inicio → módulo Reservaciones\n\n**Qué muestra**: agenda del día con todas las reservas.\n\n### Qué buscar\n- ¿Cuántas reservas faltan por llegar?\n- ¿Hay alguna **atrasada** (rojo, > 10 min de tolerancia)?\n- ¿Hay **grupos grandes** que llegan pronto y requieren preparación?\n- ¿Hay **eventos especiales** (cumpleaños, alergias, periquera)?\n\n**Frecuencia**: al inicio del servicio (overview), y cada hora durante\n\n## Tablero 3 — Bitácora del servicio\n\n**Cómo accederlo**: módulo Bitácora\n\n**Qué muestra**: cada grupo que entró, en tiempo real.\n\n### Qué buscar\n- ¿Hay filas raras (sin nombre, mesa vacía, datos incompletos)?\n- ¿Hay **cortesías** capturadas que tú no recuerdas haber visto autorizar a Mónica/Gabriel?\n- ¿Hay reservas en "En espera" que pasaron 30+ min sin llegar (deberían marcarse "No llegó")?\n- ¿Hosts capturando con calma o con prisa? (calidad de captura afecta el cierre)\n\n**Frecuencia**: cada 30 min, más al final del servicio\n\n## Tablero 4 — Charolas (cocina/churrasca)\n\n**Cómo accederlo**: módulo Charolas\n\n**Qué muestra**: cada salida de buffet en tiempo real.\n\n### Qué buscar\n- ¿Cocina/churrasca registran continuamente? (si pasaron 30 min sin captura → preguntar)\n- ¿Está saliendo lo que el equipo necesita? (si se acabó la carne y no hay registro de salida → bandera)\n- ¿Hay mucha merma siendo registrada? (puede ser señal de problema en cocina)\n\n**Frecuencia**: cada 30-45 min\n\n## Hábito de revisión\n\nUn ciclo recomendado durante un servicio:\n\n| Cada | Acción |\n|------|--------|\n| 10-15 min | Plano del salón (rápido scan) |\n| 30 min | Bitácora (revisar capturas) |\n| 30-45 min | Charolas (cocina trabajando) |\n| 1 hora | Reservaciones (próximas llegadas) |\n\nNo necesitas estar **pegado** a la pantalla. Hazlo entre rondas de piso. Camina, observa, regresa al puesto, revisa, repite.\n\n## Si ves algo raro en CUALQUIER tablero\n\n**Acción inmediata**:\n1. Confirma con la persona responsable (host, cocina, cajera)\n2. Si se puede resolver: hazlo\n3. Si requiere autorización: llama a Gabriel\n4. Si involucra dinero y no hay Gabriel: llama a Mónica\n\nNo dejes "para después" lo que viste raro. Las cosas raras crecen.',
      quiz: [
        { pregunta:'Si en el plano del salón ves una mesa Ocupada que lleva mucho más del promedio histórico (⏱), ¿qué haces?',
          a:'Considera acción: averiguar si ya pidieron cuenta, si esperan postre, o si hay algún problema. Coordina con el host', b:'Llamas a Germán para que tome la decisión operativa', c:'Le pides directamente al cliente que pida su cuenta', d:'No haces nada — el promedio es solo estadístico',
          correcta:'a', explicacion:'El promedio histórico te da señal de cuándo investigar. Coordinar con host para destrabar sin presionar al cliente.' },
        { pregunta:'En la bitácora ves una cortesía registrada con nombre de Mónica como "Autoriza" pero TÚ no la viste autorizar. ¿Qué haces?',
          a:'Lo dejas pasar porque Mónica es gerente y puede autorizar cuando quiera', b:'Confirmas con Mónica directamente. Si dice sí → OK. Si dice no → posible fraude, escala', c:'La firmas tú para regularizar', d:'La borras del registro para que no quede pendiente',
          correcta:'b', explicacion:'Tu rol es vigilancia operativa. Confirmar dudas en tiempo real previene problemas grandes al cierre.' },
        { pregunta:'¿Con qué frecuencia debes revisar el plano del salón durante un servicio?',
          a:'Una vez al inicio del servicio solamente', b:'Cada 10-15 minutos durante el servicio (entre rondas de piso)', c:'Solo al final para verificar mesas limpias', d:'Cuando un host o cocina te notifiquen un problema',
          correcta:'b', explicacion:'Vista panorámica frecuente. No estás pegado a la pantalla, pero la revisas regularmente entre rondas.' },
        { pregunta:'En charolas notas que cocina lleva 30 min sin registrar salidas, pero el buffet se ve activo. ¿Qué haces?',
          a:'Ignoras — es responsabilidad de cocina, no tuya', b:'Reportas a Germán para que regañe al equipo de cocina', c:'Cancelas las charolas sin registrar para que el cierre no quede descuadrado', d:'Vas a cocina y preguntas: "¿Están registrando? Lleva rato sin entrar nuevas". Recuerda capturar para que el cierre sea correcto',
          correcta:'d', explicacion:'Recordatorio amable, no regaño. La cajera necesita capturas correctas para el cierre. Tu rol es facilitarlo.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 3: Resolución de bloqueos ----------
    {
      titulo: 'Resolución de bloqueos típicos',
      resumen: 'Casos comunes que se presentan: cliente esperando, mesa atorada, walk-in grande, reclamo. Tu manual de respuesta rápida.',
      tiempo: 9,
      contenido: '## Tu valor: destrabar problemas en tiempo real\n\nUn buen sub-gerente **resuelve antes de que el problema crezca**. La mayoría de las situaciones se manejan en piso sin escalar; otras requieren llamar a Gabriel. Aquí están los casos más comunes.\n\n## Caso 1 — Cliente esperando demasiado\n\n**Síntoma**: grupo esperando mesa más tiempo del prometido.\n\n**Acción**:\n1. **Ve al plano del salón** rápido — ¿hay mesa libre que no se asignó?\n2. **Habla con la host** — ¿hay reserva que viene en breve para esa misma mesa?\n3. Si hay mesa libre y la host no la asignó por descuido → **asígnala tú** y avisa\n4. Si NO hay mesa todavía → **acércate al cliente con honestidad**: "Una disculpa, su mesa estará lista en X minutos. Le ofrezco una bebida cortesía mientras espera"\n5. **NO autorices la cortesía tú** — pídele a Gabriel que firme\n\n## Caso 2 — Mesa atorada (lleva mucho tiempo sin cerrar)\n\n**Síntoma**: en plano del salón ves una mesa que lleva > 1 hora más que el promedio histórico.\n\n**Acción**:\n1. **Acércate sutil al equipo de la mesa** (sin presionar al cliente):\n   - "¿Ya pidieron cuenta? ¿Esperan postre?"\n2. Si esperan postre → coordina con cocina para acelerar\n3. Si ya pidieron cuenta y la cajera tarda → ve a cajera y coordina\n4. Si quieren más tiempo → respétalo, pero asigna otras mesas para cubrir el flujo\n5. **NUNCA apresures al cliente directamente** — no es tu rol\n\n## Caso 3 — Walk-in grande sin reserva\n\n**Síntoma**: llega un grupo de 8-15 personas sin reserva.\n\n**Acción**:\n1. **Ve al plano** — ¿hay mesas grandes contiguas disponibles?\n2. **Calcula si caben juntando mesas** físicamente\n3. Si SÍ cabe:\n   - Asígnales (tú o el host)\n   - Avísale a cocina/churrasca para preparar suficiente\n4. Si NO cabe:\n   - Sé **honesto**: "Por hoy no podemos acomodar a 12 personas, pero les ofrezco hacer reserva para mañana o tomar algunos en barra ahora"\n   - **NO bloquees mesas reservadas** para acomodarlos\n5. Si hay duda → **llama a Gabriel** para decidir\n\n## Caso 4 — Reclamo del cliente sobre comida\n\n**Síntoma**: cliente molesto reclama por la comida (mal cocida, fría, sabe raro).\n\n**Acción**:\n1. **Escucha primero, no defiendas**: "Entiendo, una disculpa por la molestia"\n2. Pregunta detalles: "¿Me puede mostrar?"\n3. Si tiene razón:\n   - **Ofrece reposición inmediata** (sin cobro extra)\n   - Avisa a cocina para corregir\n   - Si fue grave → **llama a Gabriel** para que vaya a la mesa\n4. Si no tiene razón:\n   - **Escucha igual**, no contradigas\n   - Ofrece detalle pequeño (postre cortesía) — Gabriel lo autoriza\n5. Documenta: si hay un problema recurrente con cocina, repórtaselo a Gabriel después\n\n## Caso 5 — Conflicto interno entre roles\n\n**Síntoma**: host vs cocina, cocina vs cajera, etc. Discusión visible en operación.\n\n**Acción**:\n1. **Aparta a las personas** del cliente (no pelear en frente)\n2. **Escucha brevemente** ambos lados\n3. **Decide tú** si es operativo (tu autoridad)\n4. Si involucra **dinero o políticas** → llama a Gabriel\n5. Después del servicio, conversa con ambos por separado\n\nMantener la armonía del equipo es parte de tu rol. No tomes partido públicamente.\n\n## Caso 6 — Falta de personal\n\n**Síntoma**: una host no llegó, cocina con menos gente, etc.\n\n**Acción**:\n1. **Avisa a Gabriel inmediato**\n2. **Reorganiza** — distribuye carga entre los presentes\n3. Si es algo crítico (cajera no llegó), Gabriel/Mónica deben decidir\n4. **Tú puedes apoyar temporalmente** en piso (atender mesas, recibir clientes) pero NO en cajera ni cocina (separación de funciones)\n\n## Caso 7 — Cliente que se va sin pagar\n\n**Síntoma**: descubres que un grupo salió sin liquidar la cuenta.\n\n**Acción**:\n1. **Verifica con cajera** que efectivamente no pagaron\n2. **NO persigas al cliente físicamente** (riesgo de seguridad)\n3. **Documenta**: nombre si se sabe, descripción, mesa\n4. **Avisa a Gabriel** inmediato\n5. La cancelación del ticket requiere autorización gerencial\n\n## Caso 8 — Falla del POS o sistema\n\n**Síntoma**: el sistema no carga, terminales no procesan, internet caído.\n\n**Acción**:\n1. **Avisa a Gabriel** inmediato\n2. **Coordina manual**: hosts anotan en papel, cajera acepta solo efectivo\n3. Cuando vuelva el sistema: capturan todo lo pendiente\n4. **Tu rol es coordinar la transición**, no resolver el problema técnico\n\n## Cuándo llamar a Gabriel SIEMPRE\n\n- Cliente VIP con queja seria\n- Pérdida material grande (caída con mucha mercancía)\n- Reclamo legal o sanitario (cliente alega intoxicación, lesión)\n- Sospecha de fraude operativo\n- Cliente que se va sin pagar\n- Conflicto de personal serio\n- Falla del sistema mayor\n\n## Cuándo escalar directo a Mónica (sin pasar por Gabriel)\n\n- Si Gabriel **no está y no responde** (raro pero posible)\n- Si el problema es **financiero/legal** y Gabriel necesita autorización superior\n- Si **Gabriel mismo es parte del problema** (caso muy raro pero contemplado)\n\n## Tu protección\n\n- **Siempre documenta** lo que decides en piso (en observaciones de bitácora)\n- **No autorices nada** que no te corresponde\n- Si dudas → **llama**\n- Si presión del cliente → **respira y consulta**, no decidas a la presión',
      quiz: [
        { pregunta:'Llega un grupo de 12 personas sin reserva y NO caben en las mesas disponibles. ¿Qué haces?',
          a:'Bloqueas mesas reservadas para acomodarlos', b:'Sé honesto: "Por hoy no podemos, les ofrezco reserva para mañana o algunos en barra". Si dudas, llama a Gabriel', c:'Los echas con malos modos diciéndoles que se fueron sin reserva', d:'Aceptas y los acomodas en cualquier espacio aunque no sea mesa',
          correcta:'b', explicacion:'NUNCA bloquees mesas reservadas. Honestidad + alternativa. Gabriel decide si hay caso especial.' },
        { pregunta:'Un cliente reclama que su comida estaba fría. ¿Cómo respondes?',
          a:'Le explicas que el buffet no garantiza temperatura perfecta', b:'Escuchas, te disculpas, ofreces reposición sin cobro. Si fue grave, llamas a Gabriel para que vaya a la mesa', c:'Le cobras igual y le dices que así es el servicio', d:'Lo ignoras y esperas que se le pase el enojo',
          correcta:'b', explicacion:'Escucha + acción. Reposición inmediata = lo correcto cuando hay razón. Gabriel autoriza descuento si lo amerita.' },
        { pregunta:'Hay conflicto entre el host y cocina visible en operación. ¿Qué haces?',
          a:'Tomas partido públicamente del lado del host porque está de frente con el cliente', b:'Apartas a las personas del cliente, escuchas brevemente, decides si es operativo. Después del servicio, conversas con ambos por separado', c:'Los regañas en público para que los clientes vean que hay control', d:'Los ignoras y dejas que ellos lo resuelvan',
          correcta:'b', explicacion:'Manejo discreto. No pelear frente al cliente. Mantener armonía del equipo es parte de tu rol.' },
        { pregunta:'Si descubres que un cliente se fue sin pagar, ¿qué haces?',
          a:'Lo persigues físicamente para recuperar el dinero', b:'NO lo persigues (riesgo). Verificas con cajera, documentas, avisas a Gabriel inmediato. Cancelación de ticket requiere autorización gerencial', c:'Le cobras a la cajera porque es su responsabilidad', d:'No haces nada porque ya se fue y no hay remedio',
          correcta:'b', explicacion:'Tu seguridad > el dinero. Documenta y escala. La cancelación necesita autorización formal.' },
        { pregunta:'¿En qué casos SIEMPRE llamas a Gabriel sin intentar resolver tú?',
          a:'En cualquier cosa que se salga de lo normal', b:'Cliente VIP con queja seria, pérdida material grande, reclamo legal/sanitario, fraude sospechado, cliente que se fue sin pagar, falla del sistema mayor', c:'Solo si tienes ganas de consultar', d:'Nunca, porque toda la operación cae en tu autoridad',
          correcta:'b', explicacion:'Lo grave o que requiere autorización gerencial va a Gabriel. Lo operativo del flujo lo manejas tú.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 4: Coordinación con el equipo ----------
    {
      titulo: 'Coordinación con el equipo',
      resumen: 'Cómo dirigir hosts y meseros, coordinar con cocina/churrasca, apoyar a la cajera, cuándo escalar y a quién.',
      tiempo: 6,
      contenido: '## Tu equipo y cómo coordinarlo\n\nComo sub-gerente, **diriges sin micromanejar**. Tu autoridad viene de la posición + del respeto que ganes con presencia y decisiones justas.\n\n## Coordinación con HOSTS\n\nLas hosts (Yazmín, Marisol y demás) son tu primer canal con clientes. Tu rol con ellas:\n\n### Buenas prácticas\n- **Refuérzalas en piso**: cuando un host atiende bien, dilo ("buen movimiento, Yazmín")\n- **Apoya en momentos pico**: si están saturadas, recibe clientes tú momentáneamente\n- **Capacita en tiempo real**: si ves error, **enseña amable** sin regañar enfrente del cliente\n- **Comunica decisiones**: si decides cambiar asignación de mesa, avisa al host\n\n### Errores a evitar\n- ❌ Regañar al host enfrente del cliente\n- ❌ Tomar el celular del host para "hacerlo tú"\n- ❌ Asignar mesas sin avisar al host\n- ❌ Promesas a clientes sin coordinar primero\n\n## Coordinación con COCINA y CHURRASCA\n\nCocina y churrasca son **autónomos en su cocinar**, pero coordinas el ritmo del servicio.\n\n### Tu papel\n- **Avisa de grupos grandes** que llegan: "Vienen 12 a las 8pm, preparen para esa hora"\n- **Comunica reclamos**: "Mesa 5 dice que la carne llegó fría, ¿podemos reponer?"\n- **Verifica que registren charolas**: pasa por cocina cada 30-45 min, recuérdales si se les pasa\n- **Detecta problema temprano**: si la cocina se está rezagando, anticipas con clientes\n\n### NO interfieres con\n- Decisiones de menú o calidad (eso es de cocina)\n- Mermas legítimas\n- Pausas de personal (cocina decide rotación)\n\n## Coordinación con CAJERA\n\nLa cajera es **operativamente autónoma** pero la apoyas.\n\n### Tu apoyo (sin reemplazarla)\n- **Avisa de cuenta grande próxima**: "Mesa 12 pidió la cuenta, son 15 personas, prepárala"\n- **Coordina reclamos sobre cobro**: si cliente reclama precio, vas con cajera + Gabriel\n- **Si cajera está abrumada**: mandas un host a apoyar (sin tocar caja tú)\n- **Si hay falla del POS**: coordinas el manejo manual con todos\n\n### NO haces NUNCA\n- ❌ Operar la caja tú mismo (separación de funciones)\n- ❌ Autorizar descuentos a cliente directamente\n- ❌ Decirle a cajera que cancele ticket sin Gabriel\n\n## Coordinación con tu jefe (Gabriel)\n\nGabriel está disponible pero no necesariamente en piso todo el tiempo. Tu coordinación con él:\n\n- **Reporte breve al inicio del servicio**: "Hoy 50 reservas, 20 confirmadas, 30 pendientes"\n- **Avisa de cosas relevantes** durante el servicio (cortesías, decisiones grandes)\n- **Reporte breve al final**: "El servicio fluyó bien, hubo X situaciones"\n- **Pregunta antes de actuar** en zonas grises\n\nNO le reportes cada detalle (sería micromanejarse a ti mismo). Sí reporta lo importante.\n\n## Cuándo escalar a Gabriel\n\nVer M3 (Resolución de bloqueos). En general:\n- Decisiones financieras\n- Cliente VIP con queja seria\n- Pérdidas materiales o legales\n- Conflictos serios de personal\n- Falla mayor del sistema\n\n## Cuándo escalar directo a Mónica\n\nRaro pero posible:\n- Gabriel no está disponible y la decisión no puede esperar\n- Asunto financiero gerencial (ej: descuento masivo a evento)\n- Conflicto que involucra a Gabriel mismo\n\n**SIEMPRE avisa a Gabriel después** de haber escalado a Mónica (transparencia).\n\n## Tu liderazgo silencioso\n\nLa mejor frase que te describe como sub-gerente:\n\n> "Las cosas funcionan cuando él/ella está, pero NO se nota. La gente trabaja tranquila."\n\nNo es un rol para "lucirse". Es para **facilitar que todos hagan su trabajo bien**. El equipo lo notará. Los clientes también, aunque no sepan tu rol.',
      quiz: [
        { pregunta:'Una host comete un error de captura mientras atiende a un cliente. ¿Qué haces?',
          a:'La regañas enfrente del cliente para que aprenda', b:'Esperas a que termine la interacción, luego le enseñas amable. Capacitar en tiempo real sin avergonzar', c:'Tomas su celular y corriges tú mismo el error', d:'La despides porque el error afectó el servicio',
          correcta:'b', explicacion:'Capacitación discreta protege al equipo y al cliente. Regañar en público destruye autoridad propia y del host.' },
        { pregunta:'¿Operas la caja directamente cuando la cajera está abrumada?',
          a:'Sí, cuando hay urgencia ayudo en caja como apoyo temporal', b:'NO. Separación de funciones. Mandas un host a apoyar tareas que no toquen caja, pero tú no operas dinero', c:'Solo en domingo cuando hay más clientes', d:'Sí, todos los días si la situación lo requiere',
          correcta:'b', explicacion:'Separación de funciones es regla operativa de control. Tu rol es coordinar, no sustituir.' },
        { pregunta:'¿Cuándo escalas DIRECTO a Mónica sin pasar por Gabriel?',
          a:'Cualquier cosa que Gabriel no sepa resolver', b:'Cuando Gabriel no está disponible y la decisión no puede esperar, o cuando el asunto es gerencial-financiero, o cuando Gabriel mismo es parte del problema. SIEMPRE avisas a Gabriel después', c:'Nunca — siempre debes ir primero con Gabriel', d:'Cuando estás molesto con Gabriel y quieres bypass',
          correcta:'b', explicacion:'Excepción operativa con transparencia posterior. No saltarte a Gabriel rutinariamente, pero sí cuando es necesario.' },
        { pregunta:'¿Cuál es el mejor signo de que estás haciendo bien tu rol como sub-gerente?',
          a:'Que todos te aplauden y reconocen al final del servicio', b:'Las cosas funcionan cuando estás, pero no se nota. El equipo trabaja tranquilo, los clientes no notan tu rol pero todo fluye', c:'Que resuelves muchos conflictos visibles durante el servicio', d:'Que regañas con frecuencia para mantener disciplina',
          correcta:'b', explicacion:'Liderazgo silencioso. Tu valor está en facilitar, no en llamar atención. Equipo tranquilo + clientes contentos = éxito.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: Cierre del servicio ----------
    {
      titulo: 'Cierre del servicio desde tu rol',
      resumen: 'Última revisión del piso, apoyar a la cajera con dudas operativas, qué hacer si Gabriel no está al cierre.',
      tiempo: 7,
      contenido: '## Tu rol en el cierre\n\nNo firmas el sello principal del cierre (ese es de la cajera). Pero **tu trabajo durante el cierre es facilitar que todo cuadre**: revisar bitácora, apoyar a cajera, coordinar a hosts y cocina, verificar mesas.\n\nUn cierre limpio depende mucho de lo que tú hayas vigilado **durante** el servicio. Si las capturas estuvieron bien todo el día, el cierre es rápido.\n\n## 30-45 minutos antes del cierre del servicio\n\n### Tu checklist\n\n#### 1. Revisa la bitácora del día\n- ¿Hay filas con hora_sal pendiente? Coordina con hosts para capturar antes de cerrar\n- ¿Hay reservas en "En espera" que ya no van a llegar? Que el host las marque "No llegó" con motivo\n- ¿Hay capturas raras (sin nombre, mesa vacía, cortesías sin autoriza)?\n\n#### 2. Verifica el plano del salón\n- ¿Cuántas mesas siguen Ocupadas? (probablemente las últimas del servicio)\n- ¿Cuántas en Desocupada (acaban de salir)? Asegura que se limpien\n- ¿Mesas listas para limpiar al cierre?\n\n#### 3. Coordina con cocina/churrasca\n- ¿Ya están registrando últimas mermas?\n- ¿Hay charolas que sobran y se van a almacén/merma?\n- Pídeles que **firmen sus sellos de cierre** desde sus sesiones\n\n#### 4. Apoya a la cajera\n- Avísale que estás disponible para dudas\n- Si hay capturas en bitácora que no cuadran con su POS → ayúdala a cruzar\n- NO operas caja, pero **diagnosticas con ella**\n\n## Durante el cierre profundo de la cajera\n\n### Tu papel\n- **Estar disponible**, no encimado\n- Si la cajera te pide ayuda con un dato → bríndalo\n- Si surge una bandera roja:\n  - ¿Es operativa? Tú puedes ayudar a resolver (ej: completar autoriza de cortesía)\n  - ¿Es financiera? Llama a Gabriel\n\n### Lo que NO haces\n- ❌ Capturar números por la cajera\n- ❌ Decirle "firma ya, es tarde"\n- ❌ Asumir responsabilidad de su sello\n\n## Sellos del cierre\n\nLos sellos esperados al cierre:\n\n| Sello | Quién firma |\n|-------|-------------|\n| Cierre · Host | Host del turno |\n| Cierre · Cajera | Cajera |\n| Cierre · Cocina | Cocinero |\n| Cierre · Churrasca | Churrasquero |\n| Cierre · Gerente o Admin | Gabriel o Mónica |\n\n**Tú NO firmas un sello del cierre principal**. Pero coordinas que los demás firmen.\n\n## Si Gabriel no está al cierre\n\nA veces Gabriel no puede estar al cierre (junta, emergencia familiar, viaje). En ese caso:\n\n1. **Avisa a Mónica con anticipación** que vas a ser la persona presente al cierre\n2. **Ella decide**: ¿viene Mónica? ¿confía en ti para coordinar? ¿pospone el cierre?\n3. Si Mónica te confía: tu papel es **facilitar el cierre y reportarle por WhatsApp** lo que pasó\n4. Si la cajera necesita firma de gerente al final → Mónica firma remoto (o lo pospone para mañana)\n\n## Si surge bandera CRÍTICA al cierre\n\n- Cortesía con nombre de Mónica/Gabriel que no recuerdas haber visto\n- Faltante > $1,000 sin explicación\n- Saltos en folios sin razón\n- Cancelaciones masivas sospechosas\n\n**Acción**:\n1. **Documenta evidencia** (foto de pantalla, captura)\n2. **Llama a Mónica/Gabriel** inmediato\n3. **NO permitas que la cajera firme** mientras la bandera no esté explicada\n4. Espera instrucciones\n\nMejor que el cierre tarde 1 hora más que firmar con problemas.\n\n## Tu última ronda\n\nAntes de irte:\n\n1. **Recorre el salón**: ¿todas las mesas limpias? ¿luces apagadas en zonas no usadas?\n2. **Verifica con cocina/churrasca**: ¿todo guardado, refrigeradores cerrados?\n3. **Despídete del equipo**: "Bien trabajado hoy, hasta mañana"\n4. **Reporte breve a Gabriel** (si no estuvo): "Cerramos sin observaciones" o "Hubo X cosa, ya quedó"\n\n## Hábito que te define\n\nUn buen sub-gerente **deja todo en orden** antes de irse:\n- Bitácora cerrada y limpia\n- Cajera firmó cierre sin presión\n- Equipo se despidió tranquilo\n- Restaurante seguro y ordenado\n\nMañana, cuando vuelvas, sabes que el día anterior quedó bien — esa tranquilidad es tu mejor recompensa.',
      quiz: [
        { pregunta:'30-45 min antes del cierre del servicio, ¿qué revisas en la bitácora?',
          a:'Solo el total de comensales para reportar a Gabriel', b:'Filas sin hora_sal, reservas pendientes en "En espera" que ya no llegarán, capturas raras (sin nombre, cortesías sin autoriza)', c:'Solo cortesías para verificar que todas tengan autorización', d:'Nada — el cierre lo hace la cajera sin tu revisión previa',
          correcta:'b', explicacion:'Pre-revisión te permite resolver problemas antes que la cajera empiece su cierre profundo.' },
        { pregunta:'Durante el cierre profundo de la cajera, ¿cuál es tu rol?',
          a:'Operar la caja si la cajera te lo pide', b:'Estar disponible para dudas, NO operar caja, ayudar a diagnosticar banderas operativas (cortesías), llamar a Gabriel si son financieras', c:'Capturar los números de tarjetas por ella para agilizar', d:'Apurarla si ya es tarde para no quedarse hasta medianoche',
          correcta:'b', explicacion:'Apoyo sin sustituir. Separación de funciones intacta. Diagnóstico colaborativo cuando hay banderas.' },
        { pregunta:'Si Gabriel no estará al cierre y Mónica te confía coordinar, ¿qué haces?',
          a:'Tomas todas las decisiones financieras por tu cuenta', b:'Facilitas el cierre, reportas a Mónica por WhatsApp lo que pasa, si necesita firmar de gerente lo coordina remoto. SIEMPRE bajo su dirección', c:'Cierras solo sin reportar a nadie', d:'Postpones el cierre hasta que Gabriel regrese',
          correcta:'b', explicacion:'Tu autoridad está delegada por Mónica para esa noche. Reportar y consultar mantiene transparencia.' },
        { pregunta:'Surge una bandera crítica al cierre (cortesía con nombre de Mónica que no la viste autorizar). ¿Qué haces?',
          a:'Dejas que la cajera firme para que el cierre avance sin retraso', b:'Documentas evidencia (captura), llamas a Mónica inmediato, NO permites que cajera firme hasta que esté explicada', c:'La firmas tú como testigo del cierre', d:'La borras discretamente para que no bloquee el cierre',
          correcta:'b', explicacion:'Cortesía con nombre de gerente sin verificar = posible fraude. Mejor tardar 1 hora más que firmar con bandera crítica.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Curso de Cocina (Sergio). Chef ejecutivo: recetario, charolas, mermas, costeo, propuestas
// con autorización Modelo B (chef propone → admin aplica directo).
function modulosCursoCocina() {
  return [
    // ---------- Módulo 1: Tu rol como chef ejecutivo ----------
    {
      titulo: 'Tu rol como chef ejecutivo y tus pantallas',
      resumen: 'Eres responsable de la cocina caliente/fría: recetario, charolas que salen al buffet, mermas y costeo. Qué controlas y qué pantallas usas.',
      tiempo: 6,
      contenido: '## Tu posición\n\nEres el **chef ejecutivo** de Fogueira. Tu zona es la **cocina caliente y fría**: salsas, guarniciones, ensaladas, postres, sopas, masas. La **carne en espada / parrilla** la maneja Marcos (Churrasca), pero tú coordinas con él el ritmo del buffet.\n\nTu rol no es solo cocinar. En el sistema digital eres responsable de:\n\n1. **Mantener el recetario al día** (recetas, ingredientes, instrucciones)\n2. **Capturar charolas** que salen al buffet en tiempo real\n3. **Registrar mermas** con motivo cuando algo no se sirve\n4. **Firmar tu sello de apertura/cierre** del servicio\n5. **Proponer cambios** a recetas cuando ajustes algo (Mónica autoriza)\n\n## Organigrama operativo\n\n```\n          Dirección (Germán)\n                 ↓\n   Gerente Administrativo (Mónica)  →  autoriza tus cambios al recetario\n                 ↓\n   Gerente de Restaurante (Gabriel) →  coordina servicio contigo\n                 ↓\n         TÚ (Cocina · Sergio)  ←→  Marcos (Churrasca)\n                 ↓\n         Cocineros, ayudantes\n```\n\n## Tus pantallas en el sistema\n\nDesde tu inicio verás 5 cuadros principales:\n\n| Pantalla | Para qué |\n|----------|----------|\n| 🍲 **Charolas Cocina** | Registrar cada charola que sacas al buffet |\n| 📒 **Recetas y costeo** | Tu recetario completo: ver, editar, proponer cambios |\n| ❄️ **Inventario Churrasca** | Verlo (compartido con Marcos), no es tu pantalla principal |\n| 🎓 **Mi curso** | Este curso de capacitación |\n| 📖 **Mi manual** | Guía operativa para consulta rápida |\n\n## Lo que TÚ controlas\n\n- ✅ Recetas de **cocina** (no churrasca)\n- ✅ Salidas de charola al buffet (cocina)\n- ✅ Mermas de cocina con motivo\n- ✅ Tu sello autenticado de apertura y cierre\n- ✅ Propuestas de cambios al recetario\n- ✅ Subir fotos de los platillos terminados\n\n## Lo que NO autorizas\n\n- ❌ **No firmas cortesías** (eso es Mónica/Gabriel)\n- ❌ **No tocas caja** ni conciliación\n- ❌ **No editas usuarios** ni configuración del sistema\n- ❌ **No modificas recetas de churrasca** (eso es de Marcos)\n\n## Tu sesión\n\nTu sesión dura **hasta las 3:00 am del día siguiente** (día lógico restaurante). Cubre todo el turno aunque cierres tarde.\n\n## Tu firma\n\nCuando firmas tu sello (apertura o cierre), el sistema guarda **quién (tú), cuándo, desde qué cuenta**. Ningún otro rol puede firmar por ti — ni siquiera Marcos. Si no estás, queda **pendiente** y Mónica tendrá que hacer un override admin con motivo registrado.',
      quiz: [
        { pregunta:'¿Cuál es la diferencia clave entre tu zona y la de Marcos (Churrasca)?',
          a:'Ninguna, somos lo mismo', b:'Tú manejas cocina caliente/fría (salsas, guarniciones, ensaladas, postres). Marcos maneja la carne en espada / parrilla. Coordinan el ritmo del buffet juntos', c:'Marcos es tu jefe', d:'Tú cobras y él cocina',
          correcta:'b', explicacion:'Zonas complementarias. Tú cocina; él parrilla. Ambos sacan charolas al buffet pero cada uno es dueño de su área.' },
        { pregunta:'¿Qué NO autorizas tú como Cocina?',
          a:'Mermas de tu zona', b:'Cortesías a clientes, cobros en caja, edición de usuarios, recetas de churrasca', c:'Subir foto de un platillo', d:'Proponer cambios a una receta tuya',
          correcta:'b', explicacion:'Cortesías son solo de Mónica/Gabriel. Caja y usuarios no son tu rol. Recetas de churrasca son de Marcos.' },
        { pregunta:'Si tú no estás y debes firmar el sello de apertura de cocina, ¿qué pasa?',
          a:'Cualquier ayudante firma por ti', b:'El sello queda pendiente. Mónica puede hacer un override admin con motivo registrado en auditoría — pero NO puede otro cocinero firmar por ti', c:'No pasa nada', d:'Marcos firma por ti',
          correcta:'b', explicacion:'Sellos son autenticados por user_id. Override admin es la única salida y deja huella.' },
        { pregunta:'¿Hasta qué hora dura tu sesión iniciada en el sistema?',
          a:'1 hora', b:'8 horas', c:'Hasta las 3:00 am del día siguiente (día lógico restaurante)', d:'Hasta cerrar el navegador',
          correcta:'c', explicacion:'Día lógico de restaurante: cubre el cierre completo aunque sea tarde.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 2: El recetario ----------
    {
      titulo: 'El recetario: cómo navegarlo y cómo se costea',
      resumen: 'Tres tabs: Ingredientes, Recetas, Rentabilidad. Cómo el sistema calcula costos por porción y por qué los precios estimados (📍) son críticos.',
      tiempo: 8,
      contenido: '## Tu pantalla principal: 📒 Recetas y costeo\n\nEs la pantalla que más vas a usar. Tiene **3 tabs** arriba.\n\n## Tab 1 — Ingredientes\n\nEs el **catálogo maestro** de todo lo que se usa en cocina.\n\nCada renglón es un ingrediente (ejemplo: tomate, sal, aceite oliva, queso parmesano, harina) con:\n- Nombre\n- Unidad (kg, gr, ml, pza)\n- **Precio por unidad** (lo que costó al comprarlo)\n- Una bandera **📍 Estimado** si el precio fue puesto a ojo (no validado contra factura)\n\n### Importante — los 297 estimados\n\nCuando arrancamos el sistema, hubo **297 ingredientes con precio estimado** (📍). Eso significa que las recetas que los usan tienen un costo **aproximado**, no exacto. **Weslley (Comprador)** está validando esos 297 con factura real para que el costeo sea preciso.\n\nMientras haya estimados, los reportes de rentabilidad llevan una bandera amarilla 🟡. No es error tuyo, pero ten presente que el costo real puede mover.\n\n### Tu rol con ingredientes\n- Si necesitas un ingrediente nuevo (ej: añades un platillo y faltó un insumo) → **avisa a Weslley** para darlo de alta\n- Si una receta tuya tiene un ingrediente con precio raro (muy caro o muy barato) → **avisa a Weslley**\n- **Tú NO editas precios** — solo Weslley o Mónica\n\n## Tab 2 — Recetas\n\nAquí está tu **recetario completo**. Cada receta tiene:\n- Nombre\n- **Área**: cocina, churrasca, ambas, o postres\n- **Tipo**: salada, dulce, salsa, sub-receta\n- **Líneas**: cada ingrediente con cantidad, unidad y merma esperada (%)\n- **Sub-recetas**: una receta puede usar OTRA receta como ingrediente (ej: "Salsa chimichurri" se usa dentro de "Vacío con chimichurri")\n- **Instrucciones** (paso a paso)\n- **Foto** del platillo terminado\n- **Costo total** y **costo por porción** calculados automáticamente\n- **Precio sugerido** (con margen)\n\n### El cálculo de costo\n\nEl sistema hace el cálculo **recursivo**: si una receta usa otra sub-receta, el costo de la sub-receta entra al cálculo. Tú no haces matemáticas; el sistema lo hace solo cada vez que cambias algo.\n\nEjemplo:\n- Receta "Vacío con chimichurri" usa **400 g de vacío** + **1 porción de Salsa chimichurri** + **150 g de papas**\n- El sistema busca el costo del vacío (precio kg × 0.4), el costo de Salsa chimichurri (de su propia receta) y el costo de las papas, los suma → costo total\n- Lo divide entre las porciones (ej: 1) → costo por porción\n\n### Banderas en recetas\n- 📍 **Costo con estimados** — alguno de los ingredientes tiene precio estimado\n- 📝 **Sin instrucciones** — alguien tiene que documentar el paso a paso (ese eres tú)\n- 📷 **Sin foto** — falta subir foto del platillo\n- ⚠️ **Esqueleto** — la receta está creada pero sin líneas (raro, hay 3 actualmente: Chimichurri, Mantequilla crotones, Brazo de reina)\n\n## Tab 3 — 📊 Rentabilidad\n\nReporte que muestra qué tan rentable es cada receta. Útil para la dirección, pero también para ti como chef:\n\n- **Recetas con costo muy alto vs precio sugerido** → habría que ver si se puede simplificar la receta o usar ingrediente más barato\n- **Recetas con muchos estimados 📍** → el costo no es confiable hasta que Weslley valide\n- **Filtros**: por área, por tipo, por bandera (sin instrucciones, sin foto)\n\nNo necesitas vivir en este tab, pero **revísalo una vez por semana** para ver si hay alguna receta tuya con costo que se haya disparado (probablemente subió un ingrediente importante).\n\n## Lo que TÚ ves vs lo que ven otros\n\n- **Tú (Cocina)**: ves recetas de cocina (puedes proponer cambios). Ves churrasca (lectura).\n- **Marcos (Churrasca)**: ve recetas de churrasca (puede proponer). Ve cocina (lectura).\n- **Weslley (Comprador)**: edita precios de ingredientes. Ve todas las recetas (lectura) para entender qué se afecta cuando cambia un precio.\n- **Mónica/Gabriel**: ven todo y autorizan cambios.',
      quiz: [
        { pregunta:'¿Cuál es la diferencia entre el tab "Ingredientes" y el tab "Recetas"?',
          a:'Ingredientes = catálogo maestro de insumos (tomate, sal). Recetas = combinación de ingredientes con cantidad, instrucciones y costo calculado', b:'Son exactamente lo mismo con diferente nombre', c:'Ingredientes son las recetas ya costeadas', d:'No hay diferencia práctica entre ambos tabs',
          correcta:'a', explicacion:'Catálogo de insumos vs catálogo de recetas. Una receta usa varios ingredientes (y a veces sub-recetas).' },
        { pregunta:'Si una receta tuya tiene la bandera 📍 (costo con estimados), ¿qué significa?',
          a:'Que la receta está mal definida y hay que borrarla', b:'Que al menos uno de sus ingredientes tiene precio estimado (no validado con factura). Weslley está validando los 297 estimados pendientes', c:'Que se debe cobrar con precio estimado al cliente', d:'Que solo Mónica puede ver esa receta',
          correcta:'b', explicacion:'Bandera de costo aproximado. No es error; solo señal de que el costo puede mover cuando se valide.' },
        { pregunta:'Si necesitas usar un ingrediente nuevo (añades un platillo), ¿qué haces?',
          a:'Lo das de alta tú directamente en el catálogo', b:'Lo escribes a mano en la receta sin registrar el precio', c:'Lo ignoras y usas el ingrediente más parecido que ya exista', d:'Avisas a Weslley (Comprador) para que él lo dé de alta con su precio. TÚ no editas el catálogo de ingredientes',
          correcta:'d', explicacion:'Separación de funciones: ingredientes los administra Weslley/Mónica. Tú propones cambios a recetas, no editas el catálogo de insumos.' },
        { pregunta:'En el tab Rentabilidad notas que una receta tuya pasó de costar $40 a $90 por porción. ¿Qué haces?',
          a:'Ignoras — los precios siempre suben', b:'Investigas: probablemente un ingrediente importante subió de precio. Avisas a Weslley para confirmar; considera si la receta se puede simplificar', c:'Subes directamente el precio del menú para mantener margen', d:'Quitas la receta del menú sin avisar',
          correcta:'b', explicacion:'Movimiento grande de costo = señal. Investigar ingredientes y posiblemente simplificar la receta.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 3: Editar y proponer cambios al recetario ----------
    {
      titulo: 'Editar recetas y proponer cambios (Modelo B)',
      resumen: 'Cómo editas una receta tuya, agregas líneas, subes foto, creas una receta nueva. El sistema funciona en Modelo B: tú propones, Mónica/Gabriel aplican directo.',
      tiempo: 9,
      contenido: '## Modelo B: tú propones, gerencia aplica\n\nFogueira opera con **Modelo B**:\n- **TÚ (chef)** entras al recetario y haces cambios → quedan como **propuesta**\n- **Mónica o Gabriel** las revisan y, si aprueban, **aplican el cambio directo** (no espera otra firma)\n\nEsto es distinto al Modelo A donde tú aplicas y luego se audita. Aquí gerencia tiene la última palabra **antes** de que el cambio sea oficial.\n\n## Cómo editar una receta existente\n\n### Paso 1 — Abrir el modal de detalle\nEn el tab Recetas, **tap en el nombre de la receta**. Se abre un modal con todos los datos: líneas, instrucciones, foto, costo.\n\n### Paso 2 — Botón "Editar receta"\nEn el modal verás "Editar receta". Lo presionas y se vuelve editable.\n\n### Paso 3 — Edita lo que necesites\n- **Líneas (ingredientes y cantidades)**: hay una tabla con checkbox **"Quiero modificar ingredientes"**. Al activarlo se vuelve editable: puedes cambiar cantidad, unidad, % de merma, agregar línea con **+ Ingrediente** o **+ Sub-receta**, eliminar líneas\n- **Instrucciones**: campo de texto largo (markdown simple soportado)\n- **Tiempo de preparación**: si lo conoces\n- **Porciones rendidas**: cuántas porciones salen de la receta\n- **Área o tipo**: si la receta estaba mal categorizada\n\n### Paso 4 — Guardar como propuesta\nAl guardar, queda como **propuesta pendiente**. Mónica/Gabriel reciben aviso y deciden:\n- **Aprobar** → cambio aplicado al recetario\n- **Rechazar** → se descarta y te avisan por qué\n\n### Importante: reemplazo TOTAL\nSi modificas líneas, el sistema **reemplaza todas las líneas anteriores** con las nuevas (no es edición línea por línea, sino "esta es la nueva versión"). Por eso, antes de guardar, **verifica que la lista completa sea correcta**.\n\n## Subir foto del platillo (📷)\n\nEn el modal de detalle de la receta, hay un botón **📷**. Lo presionas y:\n- **En celular**: te abre la cámara directo (puedes tomar foto del platillo terminado)\n- **En PC**: te abre selector de archivo\n\nLa foto se sube a una carpeta de Drive llamada **"Fogueira · Fotos Recetario"**. Se asocia a la receta y queda visible en el modal y en los reportes.\n\n**Consejo**: foto desde arriba, plato sobre tabla blanca/madera, luz natural si se puede. Esto NO es publicidad — es **referencia visual** para que el equipo nuevo sepa cómo se ve un plato bien hecho.\n\n## Crear una receta NUEVA\n\nArriba del listado del tab Recetas verás botón **"+ Nueva receta"**.\n\n### Pasos\n1. Tap en **+ Nueva receta** → abre el mismo modal en modo crear\n2. Llenas:\n   - Nombre de la receta\n   - Área (cocina, churrasca, ambas, postres)\n   - Tipo (salada, dulce, salsa, sub-receta)\n   - Porciones rendidas (cuántas salen)\n   - **Líneas** (mínimo 1; agrega con + Ingrediente o + Sub-receta)\n   - Instrucciones (puedes dejarlo vacío al inicio y completar después)\n3. Guardar → queda como **propuesta** pendiente de aprobación\n\nUna receta sin líneas se llama **esqueleto** y no se puede costear. Por eso pedimos al menos 1 línea.\n\n## Pendientes que están a tu cargo (al día de hoy)\n\nMónica te pidió resolver:\n- 📝 Completar **instrucciones de 141 recetas** sin paso a paso\n- ⚠️ Resolver **3 esqueletos**: Chimichurri, Mantequilla crotones, Brazo de reina\n- 🤔 Resolver **3 líneas ambiguas**: Feijoada/cabeza, cáscaras camarón, yemas mayonesa\n- 🔄 Reasignar **área cocina/churrasca** de recetas mal heurísticadas (junto con Marcos)\n\nNo hay que hacerlo todo en un día. Resuélvelos cuando tengas un momento muerto entre servicios o un día calmado.\n\n## Errores comunes a evitar\n\n- ❌ **Editar una receta y dejar líneas a medias** — siempre revisa la lista completa antes de guardar (es reemplazo total)\n- ❌ **Cambiar área a "churrasca" sin avisar a Marcos** — coordinen, es su recetario\n- ❌ **Crear receta nueva con cantidades en gramos cuando deben ser kilos** — el costo se calcula con la unidad que pongas; revisa unidades\n- ❌ **Subir foto borrosa o con luz mala** — si no se ve bien el platillo, mejor no subirla',
      quiz: [
        { pregunta:'En Modelo B, ¿qué pasa cuando editas una receta?',
          a:'Se aplica directo al recetario sin revisión', b:'Queda como propuesta pendiente. Mónica/Gabriel revisan y, si aprueban, aplican el cambio directo. Si rechazan, te avisan por qué', c:'Se borra la receta anterior automáticamente', d:'Tienes que esperar 24 horas para que el sistema procese la propuesta',
          correcta:'b', explicacion:'Modelo B: chef propone, gerencia aplica. Tu cambio no es oficial hasta que Mónica o Gabriel lo aprueben.' },
        { pregunta:'Si modificas las líneas (ingredientes y cantidades) de una receta, ¿qué pasa con las líneas anteriores?',
          a:'Se conservan junto a las nuevas (quedan duplicadas)', b:'Se conservan como "versión anterior" para consulta histórica', c:'No pasa nada — editas solo la línea específica que tocas', d:'El sistema hace REEMPLAZO TOTAL: las líneas anteriores se sustituyen por la lista nueva completa. Por eso debes verificar que la lista completa esté bien antes de guardar',
          correcta:'d', explicacion:'Reemplazo total — no es edición línea por línea. Verifica la lista completa antes de guardar.' },
        { pregunta:'En el modal de la receta, presionas el botón 📷 desde tu celular. ¿Qué pasa?',
          a:'Se cierra el sistema y hay que volver a abrir la receta', b:'Te abre la cámara directo. Tomas foto del platillo terminado y se sube a la carpeta Drive "Fogueira · Fotos Recetario"', c:'Imprime la receta en la impresora de cocina', d:'Manda la receta por WhatsApp a Mónica automáticamente',
          correcta:'b', explicacion:'En celular abre cámara directo (capture=environment). Foto queda asociada a la receta para referencia visual.' },
        { pregunta:'Quieres crear una receta nueva pero solo tienes nombre, área y 2 ingredientes — todavía no sabes las instrucciones. ¿Puedes guardarla?',
          a:'Sí. Mínimo necesitas nombre, área y al menos 1 línea (ingrediente). Las instrucciones puedes completarlas después editando la receta', b:'No, las instrucciones paso a paso son obligatorias para guardar', c:'No, debe estar todo completo incluyendo foto', d:'Solo si Mónica autoriza que crees receta sin instrucciones',
          correcta:'a', explicacion:'Mínimo viable: nombre, área, 1 línea. Instrucciones se completan después editando la propuesta o ya aprobada.' },
        { pregunta:'¿Cuál es uno de los esqueletos pendientes que Mónica te pidió resolver?',
          a:'Pizza margarita y empanadas de pipián', b:'Chimichurri, Mantequilla crotones, Brazo de reina (3 esqueletos sin líneas)', c:'No hay pendientes actualmente', d:'Hamburguesa tradicional y guacamole',
          correcta:'b', explicacion:'3 esqueletos identificados que no se pueden costear hasta que les pongas líneas.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 4: Charolas y mermas en vivo ----------
    {
      titulo: 'Charolas: registro en vivo y mermas',
      resumen: 'Cada charola que sale al buffet = un registro. Cómo capturarlas, qué tipos hay, cuándo capturar merma y por qué es crítico.',
      tiempo: 6,
      contenido: '## Por qué capturas charolas\n\nCada vez que sacas una charola al buffet, **registras** la salida en el sistema. Eso permite a Mónica calcular:\n- **Cuánta comida realmente se sirvió** ese día\n- **Costo real del servicio** (charola × costo por porción)\n- **Qué se consume más / menos** → ajustar pedidos al almacén\n- **Mermas** justificadas (vs comida que "desapareció" sin registro)\n\nSin tu captura, no hay control de costo. Por eso es **crítico**.\n\n## Tu pantalla: 🍲 Charolas Cocina\n\nDesde tu inicio, tap en "Charolas Cocina". Te lleva a la pantalla `charolas` con filtro `area=cocina` (solo verás charolas de cocina, no las de Marcos).\n\nLa pantalla muestra:\n- Lista de charolas del servicio activo\n- Botón **"+ Nueva charola"** arriba\n- Resumen: total de charolas, total porciones, mermas\n\n## Cómo capturar una charola — paso a paso\n\n### 1. Tap en "+ Nueva charola"\nSe abre formulario.\n\n### 2. Selecciona el tipo\nLa charola se categoriza:\n- **Carne** (si fuera tuya, pero generalmente es de churrasca)\n- **Ensalada**\n- **Postre**\n- **Guarnición** (papas, arroz, frijoles)\n- **Sopa**\n- **Salsa** (si sale al buffet en fuente, no en plato)\n- **Otro** (libre)\n\n### 3. Cantidad\nEl número de **porciones** que estimaste sacaste, NO el peso. Si sacaste una charola de papas que rinde aproximadamente 20 porciones, escribes 20.\n\n### 4. Vincula a una receta (opcional pero recomendado)\nSi la charola corresponde a una receta del recetario, **selecciónala**. Eso permite al sistema:\n- Calcular costo de esa charola automáticamente (porciones × costo por porción)\n- Descontar de inventario si la receta tiene ingredientes vinculados a inventario\n\n### 5. Observaciones\nCualquier nota: "primera salida del día", "charola pequeña", "se acabó rápido".\n\n### 6. Guardar\nSe registra con tu user_id, hora exacta, área (cocina). No se puede borrar — solo editar el mismo día.\n\n## Frecuencia de captura\n\n**Cada vez que sacas una charola**. No esperes al final del servicio para capturar todo de una. Si lo haces así:\n- Se te olvida cuántas fueron\n- No puedes saber qué se acabó cuándo\n- El reporte gerencial se vuelve impreciso\n\nIdeal: capturas al momento o **máximo 5 minutos después** de sacar la charola al buffet.\n\n## Mermas — cuándo y cómo\n\nLa **merma** es comida preparada que **NO se sirvió**. Razones típicas:\n- Sobró del buffet al cierre\n- Se cayó / se contaminó\n- Se preparó de más\n- Se pasó (ej: ensalada que se calentó)\n\n### Cómo capturar merma\nEn el formulario de charola, marcas el toggle **"Es merma"** (o capturas una charola "merma" aparte, según UI). Te pide:\n- Tipo de merma (sobrante, daño, exceso preparación)\n- Motivo en texto: "se cayó la charola", "sobró del buffet último servicio"\n- Cantidad estimada de porciones\n\n### Por qué importa\nSin merma capturada, hay un hueco en el cálculo de costo que se interpreta como "comida perdida sin justificación". Eso eventualmente baja a Germán como bandera. Capturar merma = **proteger tu zona** y darle visibilidad real a la dirección.\n\n## Errores comunes\n\n- ❌ **Capturar todo al final del día de un jalón** — pierdes precisión y se te olvidan charolas\n- ❌ **No capturar merma** porque "no quiero que vean que sobró" — es PEOR no capturar; la dirección lee mejor "merma 5 porciones por sobrante" que un hueco sin explicar\n- ❌ **Capturar peso (kg) en lugar de porciones** — el sistema cuenta porciones; usa porciones siempre\n- ❌ **Capturar charolas de churrasca por error** — solo capturas las de cocina; las espadas las captura Marcos\n\n## Si te equivocaste capturando\n\nMismo día: puedes editar tu propio registro (queda en auditoría que lo editaste).\n\nDía siguiente: el registro queda fijo. Si necesitas corregir algo de ayer, avísale a Mónica para que lo ajuste con override admin.',
      quiz: [
        { pregunta:'¿Cada cuándo capturas una charola en el sistema?',
          a:'Una vez al final del servicio para hacerlo todo junto', b:'Solo cuando la charola se termina (cuando está vacía)', c:'Cada vez que sacas una charola al buffet (al momento o máximo 5 min después). Si esperas al final, pierdes precisión y se te olvidan charolas', d:'Una vez a la semana cuando Mónica revisa el inventario',
          correcta:'c', explicacion:'En vivo es la regla. Cada charola = un registro inmediato. Acumular pierde precisión.' },
        { pregunta:'Si una charola se cayó al piso o sobró del buffet, ¿qué haces?',
          a:'No la registras — ya no hay nada que costear', b:'La capturas como merma con tipo (daño / sobrante) y motivo. Sin captura, parece "comida perdida sin justificación" y eso es bandera para la dirección', c:'La cobras al cliente que estaba cerca como indemnización', d:'La metes al refrigerador y no dices nada',
          correcta:'b', explicacion:'Capturar merma protege tu zona. Hueco sin explicar es peor que merma documentada.' },
        { pregunta:'Sacaste una charola de papas que rinde aproximadamente 20 porciones. ¿Qué capturas en cantidad?',
          a:'El peso de la charola en kilos (2.5 kg por ejemplo)', b:'20 (porciones estimadas). El sistema cuenta porciones, no kilos', c:'1 (una charola, sin especificar más)', d:'No capturas cantidad — solo el tipo de platillo',
          correcta:'b', explicacion:'Porciones, no kilos ni "una charola". Permite calcular costo y consumo.' },
        { pregunta:'¿Por qué es recomendable vincular la charola a una receta del recetario?',
          a:'Es solo decorativo para que se vea más completo el registro', b:'Permite al sistema calcular costo de la charola automáticamente (porciones × costo por porción) y descontar inventario si aplica', c:'Es obligatorio — no puedes guardar sin vinculación', d:'Para que Weslley sepa qué ingredientes se consumen',
          correcta:'b', explicacion:'Vinculación = costeo automático y trazabilidad. Sin vincular, queda solo el conteo bruto.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: Sistema completo de mermas ----------
    {
      titulo: 'El sistema completo de mermas en cocina',
      resumen: 'Qué es merma, dos tipos (operativa vs natural de producción), cómo usar el selector de causas, merma parcial (0.5 charola) y por qué registrar te protege.',
      tiempo: 8,
      contenido: '## Qué es exactamente una merma\n\nUna merma es comida que **preparaste** pero que **no llegó al cliente**.\n\nNo confundas con el desperdicio del comensal en el buffet (lo que el cliente deja en el plato) — eso no lo registra el sistema. La merma que registras es **tuya**: salió de tu cocina, pero algo pasó antes de ser consumida.\n\n## Los dos tipos de merma en Fogueira\n\n### Tipo 1 — Merma operativa (la que registras activamente)\n\nSon eventos específicos que ocurren durante el servicio. El sistema tiene **7 causas** definidas:\n\n| Causa | Ejemplo real |\n|-------|-------------|\n| Sobrante al cierre del turno | Sobró media charola de papas al cerrar |\n| Se quemó / temperatura incorrecta | La plancha estaba muy alta |\n| No pasó control de calidad | Color, textura o presentación incorrecta |\n| Sobreproducción (se preparó de más) | Hiciste el doble de lo necesario |\n| Se cayó / accidente en cocina | Charola cayó al piso |\n| Tiempo límite superado en turno | Preparación llegó a su límite en buffet |\n| Otro | Escribes la causa libremente |\n\n### Tipo 2 — Merma natural de producción (ya está resuelta, no la registras)\n\nEs la pérdida que ocurre **simplemente por cocinar**: grasa que recortas, agua que se evapora, líquidos que pierde una carne al calentarse. No tienes que registrarla — está resuelta desde el recetario.\n\n**¿Cómo? Las recetas usan peso bruto.**\n\nLas cantidades de las recetas se capturaron en **peso bruto** (tal como llega del proveedor). El sistema ya contempla que parte de esos gramos se pierden en la cocción.\n\nEjemplo:\n```\nReceta "Salmón con ajo" → 300g de salmón (bruto, como llega)\nAl cocinarse pierde ~20% → quedan ~240g en el buffet\nEl sistema descuenta los 300g brutos del inventario → correcto\nNo hay que registrar esos 60g de pérdida por cocción — ya están contemplados\n```\n\nPeso bruto en receta = merma natural implícita. Solo registras la merma **operativa** (eventos inesperados).\n\n## Merma parcial: fracciones de charola\n\nNo siempre pierdes la charola completa. El sistema acepta **cantidades decimales**: 0.5, 1.5, 0.25.\n\nEjemplos:\n- Se cayó la mitad de la charola de ceviche → merma **0.5**\n- Sobró aproximadamente 1/3 del puré al cierre → merma **0.5** (aproximas al medio más cercano)\n- Una charola entera de sopa se contaminó → merma **1**\n\nUsa el criterio honesto. No necesitas báscula — una estimación razonable es suficiente. Lo que **no** puedes hacer es ignorar la merma completamente.\n\n## Cómo registrar una merma — paso a paso\n\n1. Tap en **"+ Merma"** (botón naranja/rojo en tu pantalla de charolas)\n2. **Receta** — si corresponde a una receta específica, selecciónala. El sistema descuenta ingredientes automáticamente\n3. **Cantidad** — charolas completas o fracciones (0.5, 1, 1.5…)\n4. **Causa** — elige del selector de 7 opciones. Si eliges "Otro", aparece un campo libre para escribir la causa específica\n5. **Guardar**\n\nEl registro queda con tu nombre, hora exacta, área (cocina) y causa. **No se puede borrar** — es parte de la auditoría del día.\n\n## El caso especial: sobrante al cierre del turno\n\nLo que sobró en el buffet al final del servicio también es merma que debes registrar.\n\n**¿Por qué?** Porque esa comida ya "salió" del inventario cuando registraste la charola que fue al buffet. Si sobró sin servirse, el sistema necesita saberlo para cuadrar el inventario.\n\n**Flujo correcto al cierre:**\n1. Revisas qué sobró por tipo de preparación\n2. Estimas las porciones no servidas\n3. Registras merma con causa **"Sobrante al cierre del turno"**\n4. Firmas tu sello de cierre\n\nNo esperes a que Mónica pregunte "¿por qué el inventario de papas tiene más de lo esperado?" — anticipa con el registro.\n\n## Por qué registrar una merma te protege\n\nSin registro de merma, el sistema ve esto al cierre del día:\n```\nInventario esperado:  100 unidades\nInventario real:       87 unidades\nDiferencia:          −13 sin explicación  ← BANDERA ROJA para dirección\n```\n\nCon merma documentada:\n```\nInventario esperado:  100 unidades\nCharolas servidas:    85 unidades\nMerma registrada:     13 unidades (sobrante 10 + accidente 2 + calidad 1)\nDiferencia:            0  ✓ cuadrado\n```\n\nUna merma documentada cierra la ecuación. Una merma sin registrar se convierte en "¿a dónde se fue esa comida?" — y esa pregunta llega a Germán como bandera de auditoría.\n\n**Registrar merma no te pone en riesgo. No registrarla sí.**\n\n## Preguntas frecuentes\n\n**¿Qué pasa si olvidé registrar una merma del mismo día?**\nPuedes hacerlo hasta cerrar sesión del día. Si ya pasó el día, avísale a Mónica — ella registra con override admin.\n\n**¿Puedo registrar merma sin vincular receta?**\nSí. El sistema guarda el evento. Sin receta no calcula qué ingredientes se perdieron, pero una merma sin receta es mejor que ningún registro.\n\n**¿Si registro muchas mermas me van a llamar la atención?**\nAl contrario. Una cocina con mermas bien documentadas demuestra control y honestidad. Cero mermas registradas con inventario descuadrado genera preguntas más serias.',
      quiz: [
        { pregunta:'¿Qué tipo de merma necesitas registrar manualmente en el sistema?',
          a:'La merma natural de producción (agua que se evapora, grasa que se recorta)', b:'La merma operativa: eventos específicos como accidentes, sobrantes al cierre, quemados. La merma natural ya está resuelta en el peso bruto de las recetas', c:'Ambas, siempre', d:'Ninguna — el sistema las calcula solo',
          correcta:'b', explicacion:'Solo registras la merma operativa. La natural ya está implícita porque las recetas usan peso bruto del proveedor.' },
        { pregunta:'Las recetas del sistema usan peso bruto del proveedor. ¿Qué beneficio tiene eso para la merma natural?',
          a:'Ninguno, solo es una convención de captura', b:'El peso bruto ya incluye la pérdida por cocción. Al descontar 300g de inventario por una charola, el sistema ya contempla los gramos que se pierden al cocinarse — no tienes que registrar esa pérdida por separado', c:'Que se cobra al cliente con el peso antes de cocinar', d:'Lo exige el proveedor para facturar por kilo bruto',
          correcta:'b', explicacion:'Peso bruto = merma natural implícita. Si usaran peso neto, el inventario quedaría sistemáticamente con excedentes falsos.' },
        { pregunta:'Sobró media charola de puré de papa al cierre del servicio. ¿Qué registras?',
          a:'Merma con causa "Sobrante al cierre del turno", cantidad 0.5. La fracción es válida y la causa cierra el inventario', b:'Nada — ya estaba servida en el buffet así que no necesitas registrar sobrante', c:'Una charola completa de merma (redondeas al entero más cercano)', d:'Lo registra Mónica al día siguiente cuando hace el cierre',
          correcta:'a', explicacion:'Merma parcial (0.5) con causa específica. Registrar el sobrante al cierre es parte del checklist obligatorio.' },
        { pregunta:'Al final del día el sistema muestra −13 unidades de diferencia en el inventario sin explicación. ¿Qué causó eso probablemente?',
          a:'Error del sistema que se autocorrige al día siguiente', b:'No se registraron las mermas del día. Sin registro, el inventario descuadra y aparece como bandera roja para la dirección', c:'El proveedor entregó de menos en la entrega de hoy', d:'Marcos (churrasca) capturó por error en tu pantalla',
          correcta:'b', explicacion:'Inventario descuadrado sin merma documentada = bandera roja. La merma registrada cierra la ecuación a cero.' },
        { pregunta:'¿Puedes registrar una merma sin vincularla a una receta específica?',
          a:'No, la receta es obligatoria o el sistema no guarda el registro', b:'Sí. El sistema guarda el evento igualmente. Sin receta no calcula qué ingredientes se perdieron, pero es mejor merma sin receta que dejar el hueco sin documentar', c:'Solo Mónica puede registrar mermas sin receta vinculada', d:'No existe esa opción en la pantalla de charolas',
          correcta:'b', explicacion:'Merma sin receta = registro incompleto pero válido. Siempre es mejor documentar que dejar el hueco.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 6: Cierre del servicio ----------
    {
      titulo: 'Cierre del servicio desde tu rol',
      resumen: 'Sello de cierre de cocina, mermas finales, propuestas pendientes, qué se ve en tu pantalla la siguiente vez. Tu papel cuando hay banderas rojas.',
      tiempo: 5,
      contenido: '## Tu rol en el cierre\n\nAl final del servicio, **firmas tu sello de cierre de cocina**. Es un acto autenticado: solo tú puedes firmarlo desde tu sesión.\n\nUn cierre limpio depende de que **durante el servicio** hayas:\n- Capturado todas las charolas a tiempo\n- Registrado mermas con motivo\n- Resuelto cualquier propuesta de receta urgente\n\n## 30 minutos antes del cierre\n\n### Tu checklist\n\n#### 1. Charolas finales\n- ¿Falta capturar alguna charola que sacaste al buffet pero no registraste todavía?\n- ¿Cuánto sobró del buffet? Captura como **merma sobrante** con motivo "sobrante final servicio"\n\n#### 2. Mermas del día\n- ¿Capturaste todas las mermas del día (caídas, daños, exceso)?\n- Si recuerdas alguna que no capturaste, hazlo ahora\n\n#### 3. Coordinación con Marcos (Churrasca)\n- ¿Está cerrando él también?\n- Si tienen sobrantes que se pueden almacenar para mañana, coordinen qué se guarda\n- Si hay merma compartida (ej: una salsa que estaba en buffet de carne), aclaren quién la captura para no duplicar\n\n#### 4. Propuestas de recetas pendientes\n- Si dejaste alguna propuesta sin guardar, decide: ¿la guardas hoy para que Mónica la vea, o la dejas para mañana?\n- No hay urgencia, pero **no acumules** propuestas en borrador\n\n## Firmar el sello de cierre\n\nDesde tu pantalla de Charolas Cocina, hay sección de **Sellos** al final del servicio. Verás:\n\n```\n[ Cierre · Cocina ]\n  Estado: pendiente\n  [ Firmar ]\n```\n\n### Antes de firmar\n- **Verifica** que tus charolas estén completas\n- **Verifica** que las mermas estén capturadas\n- Si firmas y descubres después que faltó algo, el sello queda con tu nombre y la mismo registro queda intacto. Mejor revisar antes.\n\n### Tap en "Firmar"\nEl sistema te confirma:\n- Tu nombre\n- Tu rol (cocina)\n- La hora exacta\n\nQueda registrado en la hoja `Sellos` con `user_id`, `user_email`, `user_nombre`, `user_rol`, `sellado_at`. Imposible firmar por otro.\n\n## Si descubres una bandera al cierre\n\nEjemplos:\n- Te das cuenta que un cocinero capturó 50 porciones cuando fueron 5 (dedazo)\n- Una merma quedó sin motivo\n- Una receta nueva quedó como esqueleto y se sirvió en el buffet\n\n### Acción\n1. **Si puedes corregir** (mismo día) → corriges directo en tu pantalla\n2. **Si NO puedes corregir** (día anterior, o falta admin) → avisas a Mónica antes de firmar\n3. **Mientras la bandera no esté explicada, NO firmes** el cierre\n\nMejor que el sello quede pendiente 1 hora más que firmar con problema sin explicar.\n\n## Después del cierre\n\nNo te tienes que quedar después del cierre operativo. Tu sello firmado = tu día concluido.\n\nLa cajera, Gabriel y Mónica hacen el **cierre de caja y conciliación** después. Si Mónica te necesita para aclarar algo, te llama. Pero rara vez.\n\n## Lo que verás mañana al volver\n\nAl iniciar sesión al día siguiente:\n- Tu sello de ayer queda como ✓ Firmado\n- Tus propuestas pendientes (si las hay) muestran si fueron aprobadas/rechazadas\n- Las charolas del servicio anterior quedan en histórico (no editables)\n- Empieza un servicio nuevo limpio\n\n## Hábito que te define\n\nUn buen chef en este sistema **no llega cojeando al cierre**. Captura en vivo, propone cambios cuando los hace, comunica con Marcos y deja todo en orden antes de irse.\n\nNo es burocracia: es la diferencia entre un restaurante con costos reales medibles y uno que "no sabe dónde se va el dinero".',
      quiz: [
        { pregunta:'Estás 30 min antes del cierre y notas que olvidaste capturar 2 charolas que sacaste a las 2pm. ¿Qué haces?',
          a:'Las dejas pasar — ya es muy tarde para capturarlas', b:'Las capturas ahora con observación "captura tardía" o las vinculas a la hora correspondiente. Mejor tarde que nunca', c:'Le dices a Marcos que las capture en su pantalla de churrasca', d:'Te vas y avisas a Mónica mañana',
          correcta:'b', explicacion:'Capturar tarde es mucho mejor que no capturar. Pones observación y se sigue.' },
        { pregunta:'Vas a firmar tu sello de cierre y descubres que un cocinero capturó 50 porciones en lugar de 5 (dedazo). ¿Qué haces?',
          a:'Firmas igual y lo aclaras mañana con Mónica', b:'NO firmas hasta corregirlo. Si puedes editar el registro mismo día, lo corriges. Si no, avisas a Mónica antes de firmar', c:'Borras la bitácora completa del día para empezar de cero', d:'Lo dejas pasar porque es problema del cocinero, no tuyo',
          correcta:'b', explicacion:'Sello con bandera roja sin explicar = problema mayor después. Mejor tardar 1 hora más.' },
        { pregunta:'¿Tu sello de cierre lo puede firmar otra persona desde su cuenta?',
          a:'Sí, cualquiera con sesión activa puede firmar', b:'No. Cada sello es autenticado por user_id. Solo tú firmas desde tu sesión. Si no estás, Mónica puede hacer override admin con motivo registrado', c:'Sí, Marcos puede firmarlo porque son el mismo equipo operativo', d:'Solo Germán desde la cuenta de administrador',
          correcta:'b', explicacion:'Sellos autenticados = imposible firmar por otra persona. Override admin es la única salida y deja huella.' },
        { pregunta:'Sobró comida del buffet al cierre del servicio. ¿Qué haces?',
          a:'No registras nada — si ya salió al buffet no hay merma que registrar', b:'Capturas como merma sobrante con motivo "sobrante final servicio". Coordina con Marcos si fue compartido', c:'Te lo llevas porque el restaurante no lo necesita más', d:'Lo tiras sin más sin dejar ningún registro',
          correcta:'b', explicacion:'Merma sobrante con motivo = trazabilidad. Coordina con Marcos para no duplicar capturas en buffet compartido.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Curso de Churrasca (Marcos). Responsable de la zona de carnes/parrilla. Inventario semanal,
// recetas churrasca, charolas (espadas), coordinación con cocina.
function modulosCursoChurrasca() {
  return [
    // ---------- Módulo 1: Tu rol como churrasquero ----------
    {
      titulo: 'Tu rol como churrasquero y tus pantallas',
      resumen: 'Eres el dueño de la parrilla y el rodizio. Recetario churrasca, charolas (espadas) e inventario semanal son tus pantallas principales.',
      tiempo: 6,
      contenido: '## Tu posición\n\nEres **el churrasquero**, responsable de la **zona de carnes y parrilla** de Fogueira. Tu trabajo principal es **el rodizio**: pasar las espadas de carne (picaña, fraldinha, costilla, chorizo, pollo, etc.) por las mesas.\n\nTu zona es distinta y complementaria a la de Sergio (Cocina). Él maneja salsas, ensaladas, guarniciones, postres. Tú manejas la carne en espada y la parrilla.\n\nEn el sistema digital eres responsable de:\n\n1. **Recetas de churrasca** (cortes, preparaciones, marinadas)\n2. **Inventario semanal** de proteína (esto es CRÍTICO en tu zona)\n3. **Capturar charolas / espadas** que sacas al rodizio\n4. **Mermas** de tu zona con motivo\n5. **Firmar sello de apertura/cierre** de churrasca\n\n## Organigrama operativo\n\n```\n          Dirección (Germán)\n                 ↓\n   Gerente Administrativo (Mónica)  →  autoriza tus cambios\n                 ↓\n   Gerente de Restaurante (Gabriel) →  coordina servicio contigo\n                 ↓\n   Sergio (Cocina)  ←→  TÚ (Churrasca · Marcos)\n                 ↓\n         Ayudantes de parrilla\n```\n\n## Tus pantallas en el sistema\n\n| Pantalla | Para qué |\n|----------|----------|\n| 🥩 **Charolas Churrasca** | Registrar cada espada que sacas al rodizio |\n| ❄️ **Inventario Churrasca** | Inventario semanal Lun-Dom de tu proteína. ESTA es tu pantalla central |\n| 📒 **Recetas y costeo** | Tu recetario de cortes, marinadas y preparaciones |\n| 🎓 **Mi curso** | Este curso de capacitación |\n| 📖 **Mi manual** | Guía operativa para consulta rápida |\n\n## Lo que TÚ controlas\n\n- ✅ Recetas de **churrasca** (no cocina)\n- ✅ **Inventario semanal** de proteínas\n- ✅ Salidas de espada al rodizio\n- ✅ Mermas de tu zona\n- ✅ Tu sello autenticado de apertura y cierre\n- ✅ Propuestas de cambios al recetario churrasca\n\n## Lo que NO autorizas\n\n- ❌ **No firmas cortesías**\n- ❌ **No tocas caja**\n- ❌ **No editas usuarios**\n- ❌ **No modificas recetas de cocina** (eso es de Sergio)\n\n## Tu sesión\n\nDura **hasta las 3:00 am del día siguiente** (día lógico restaurante).\n\n## Tu firma\n\nTu sello (apertura/cierre) es autenticado por tu cuenta. Imposible que otro firme por ti — ni Sergio, ni Gabriel sin override admin.',
      quiz: [
        { pregunta:'¿Cuál es la responsabilidad principal de Churrasca en Fogueira?',
          a:'Atender el rodizio: pasar carnes en espada por las mesas y registrar las salidas. También llevas el inventario semanal de tu zona', b:'Cobrar a los clientes de la zona del rodizio', c:'Conciliar caja al cierre del día', d:'Hacer las reservaciones online del restaurante',
          correcta:'a', explicacion:'Rodizio + inventario semanal de proteína. Tu zona es 100% carnes y parrilla.' },
        { pregunta:'¿Cuál es la diferencia entre tu zona y la de Sergio (Cocina)?',
          a:'Ninguna, ambos manejan el buffet por igual', b:'Sergio maneja cocina caliente/fría (salsas, ensaladas, guarniciones, postres). Tú manejas la carne en espada y parrilla. Coordinan el ritmo del buffet juntos', c:'Tú eres el jefe de Sergio porque la parrilla es más importante', d:'Sergio es chef titulado y tú no, esa es la diferencia principal',
          correcta:'b', explicacion:'Zonas complementarias. Cada uno dueño de su área; coordinan ritmo conjunto.' },
        { pregunta:'¿Cuál pantalla del sistema es la MÁS importante para ti?',
          a:'Solo Charolas Churrasca para registrar espadas', b:'Inventario Churrasca semanal — es la pantalla central de tu rol porque ahí controlas lo que entra y sale de proteína día por día', c:'Reservaciones para saber cuántos clientes vienen', d:'Conciliación para ver los cobros del día',
          correcta:'b', explicacion:'Inventario semanal Lun-Dom es tu tablero crítico: control de proteína, entradas/salidas/mermas.' },
        { pregunta:'¿Tu sello de cierre lo puede firmar Sergio (Cocina) por ti?',
          a:'Sí, pueden intercambiar sellos porque son el mismo equipo', b:'No. Cada sello es autenticado por user_id. Solo tú firmas desde tu sesión. Si no estás, Mónica puede hacer override admin con motivo', c:'Sí siempre y cuando le avises antes', d:'Solo si Gabriel lo autoriza antes del cierre',
          correcta:'b', explicacion:'Sellos individuales y autenticados. Override admin es la única excepción y deja huella en auditoría.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 2: Inventario Churrasca semanal ----------
    {
      titulo: 'Inventario Churrasca semanal (Lun-Dom)',
      resumen: 'Tu pantalla central. Cómo registras entradas, salidas y mermas día por día. La diferencia entre lo capturado y la realidad física del refrigerador.',
      tiempo: 9,
      contenido: '## Por qué hay un inventario aparte para Churrasca\n\nLa proteína (carnes) es el insumo **más caro** y **más controlado** de Fogueira. Por eso tiene su propio módulo de inventario semanal, separado del recetario general.\n\nEn esta pantalla, cada tipo de carne tiene su propia fila y se controla **día por día** durante toda la semana (Lunes a Domingo).\n\n## Tu pantalla: ❄️ Inventario Churrasca\n\nDesde tu inicio, tap en "Inventario Churrasca". Verás una tabla así:\n\n```\n     │ Lun │ Mar │ Mié │ Jue │ Vie │ Sáb │ Dom │ Total\n─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼──────\nPicaña\n  Inicial   8.0kg              \n  Entrada              5.0kg\n  Salida    1.5kg 1.8kg 2.0kg ...\n  Merma     0.1kg\n  Final     6.4kg ...\n```\n\nCada **carne** (picaña, fraldinha, costilla, chorizo, pollo, ribeye, alcatra, etc.) tiene una fila por movimiento.\n\n## Los 5 movimientos del inventario\n\n### 1. Inicial\nLo que tienes al comenzar el día (en kilos). Normalmente solo se captura el **lunes** (lo que arrancas la semana). De martes a domingo, el "inicial" es el "final" del día anterior automáticamente.\n\n### 2. Entrada\nCuando recibes una compra/entrega del proveedor. Capturas:\n- Cantidad en kilos\n- Opcional: notas (lote, proveedor, factura)\n\n### 3. Salida\nLo que **sale a la parrilla** del refrigerador. No es lo que sale al buffet (eso son charolas) — es **lo que dejas de tener crudo**.\n\nEjemplo: si descongelaste y mandaste a parrilla 1.5 kg de picaña, capturas salida = 1.5 kg.\n\n### 4. Merma\nMerma específica de la carne **antes de cocinarse** (por ejemplo: pieza con mal aspecto, descongelación que se contaminó, corte mal hecho que ya no se puede usar).\n\nNO es la merma de la espada al rodizio (esa va en Charolas).\n\n### 5. Final\nLo que queda en el refrigerador al cierre del día. Se calcula automáticamente:\n\n`Final = Inicial + Entrada - Salida - Merma`\n\nPero también puedes capturarlo manualmente si haces **conteo físico** y la realidad no cuadra con la fórmula. Esa diferencia es información valiosa.\n\n## Cómo capturar — paso a paso\n\n### Caso típico: arrancas el día\n1. Abres Inventario Churrasca\n2. Verificas el "Inicial" del día (lo que el sistema arrastró del día anterior)\n3. Si llegó proveedor → capturas **Entrada** con la cantidad recibida\n\n### Durante el servicio\n4. Cada vez que sacas carne del refri al área de parrilla → capturas **Salida** con cantidad\n5. Si una pieza viene mal o se contamina antes de cocinarse → capturas **Merma** con motivo\n\n### Al cierre\n6. Haces **conteo físico** de lo que queda en el refri\n7. Si la fórmula cuadra → no haces nada (Final ya está calculado)\n8. Si NO cuadra → capturas Final manual + observación explicando la diferencia\n\n## Diferencias entre fórmula y conteo físico\n\nUna **diferencia** entre lo calculado y lo contado puede significar:\n- **Captura faltante**: olvidaste capturar una salida o merma → corriges\n- **Robo / desperdicio sin documentar**: bandera para Mónica\n- **Error de captura previa** (ej: pusiste 5 kg cuando fueron 0.5)\n- **Pesaje inicial inexacto** (ej: el lunes contaste mal)\n\nNo se espera que cuadre siempre al gramo. Pero **diferencias grandes y recurrentes** sí son señal.\n\n## Coordinación con Sergio\n\nAlgunas recetas de Sergio usan proteína (ej: "Pollo a la mostaza" en cocina caliente, no en rodizio). Cuando él descuente esa proteína en su recetario, **NO se duplica** en tu inventario churrasca — ese pollo viene de un canal distinto (cocina, no parrilla).\n\nSi hay duda, **coordinen** quién captura qué para no duplicar movimientos.\n\n## Frecuencia\n\n- **Diario**: capturas entradas/salidas/mermas conforme pasan\n- **Cierre del día**: conteo físico y verificación\n- **Cierre de semana (domingo o lunes mañana)**: revisión completa de la semana\n\nNo se puede dejar el inventario "para el final de la semana". Pierde precisión y ya no es útil.',
      quiz: [
        { pregunta:'En el inventario churrasca, ¿qué capturas como "Salida"?',
          a:'Lo que sale al buffet en espada (lo que sirves a los comensales)', b:'Lo que dejas de tener crudo (sale del refrigerador al área de parrilla). Las espadas que pasan por las mesas se capturan en Charolas, no aquí', c:'Lo que cobró la cajera por consumo de carne del día', d:'No hay movimiento "Salida" en el inventario churrasca',
          correcta:'b', explicacion:'Salida = sale del refri al área de parrilla. Las espadas al rodizio van en Charolas Churrasca (otra pantalla).' },
        { pregunta:'Si recibes una entrega del proveedor de 5 kg de picaña, ¿dónde la capturas?',
          a:'En Charolas Churrasca como charola especial de entrada', b:'En Inventario Churrasca como "Entrada" del día con la cantidad y opcionalmente notas (lote, proveedor)', c:'En Recetas como nuevo ingrediente disponible', d:'No se captura — el proveedor lo registra en su sistema',
          correcta:'b', explicacion:'Entrada al inventario semanal con cantidad. Las notas opcionales ayudan a trazar el lote.' },
        { pregunta:'¿Cuál es la fórmula automática que el sistema usa para calcular el "Final" del día?',
          a:'Final = Inicial × Entrada (multiplicación de lo que había y lo que entró)', b:'Final = Inicial + Entrada - Salida - Merma. Pero puedes capturar Final manual si tu conteo físico no cuadra con la fórmula', c:'Final = Inicial + Total de espadas servidas al rodizio', d:'No hay fórmula — el sistema no calcula el final automáticamente',
          correcta:'b', explicacion:'Fórmula simple. Si conteo físico difiere = información valiosa para detectar capturas faltantes o problemas.' },
        { pregunta:'Una pieza de picaña te llegó con mal aspecto y la tiraste antes de cocinarla. ¿Cómo se captura?',
          a:'No se captura porque nunca salió a la parrilla', b:'Como Merma del día con motivo "pieza con mal aspecto descartada antes de cocinar"', c:'Como Salida normal ya que igual se consume del inventario', d:'Se cobra al proveedor y no entra al sistema',
          correcta:'b', explicacion:'Merma en inventario = pérdida antes de cocinarse, con motivo. Diferente a la merma del rodizio (Charolas).' },
        { pregunta:'Al cierre del día, tu conteo físico del refri NO cuadra con el "Final" calculado por fórmula. ¿Qué haces?',
          a:'Lo dejas como está — las diferencias pequeñas son normales y se acumulan', b:'Capturas Final manual con observación explicando la diferencia. Una diferencia puede ser captura faltante, error previo o algo a investigar', c:'Borras todas las capturas del día y empiezas de cero mañana', d:'Llamas al proveedor para que ajuste sus registros',
          correcta:'b', explicacion:'Diferencia documentada con observación = trazabilidad. Mónica puede revisar y entender qué pasó.' }
      ],
      minAprobatorio: 5
    },
    // ---------- Módulo 3: Recetas de churrasca ----------
    {
      titulo: 'Recetas de churrasca: cortes, marinadas, preparaciones',
      resumen: 'Tu recetario es distinto del de Sergio: enfocado en cortes, marinadas y tiempos de parrilla. Cómo proponer cambios.',
      tiempo: 6,
      contenido: '## Tu recetario\n\nEn el tab Recetas verás recetas con **área = "churrasca"** o **área = "ambas"** (si una receta involucra cocina y parrilla, como un acompañamiento que requiere ambas zonas).\n\nTípicamente tu catálogo incluye:\n- **Cortes**: picaña, fraldinha, ribeye, alcatra, chorizo, costilla, pollo, etc. con sus marinadas y tiempos\n- **Marinadas y rubs**: chimichurri, salmuera, pasta de ajo\n- **Salsas para acompañar**: si las haces tú (si las hace Sergio van en cocina)\n- **Sub-recetas**: una marinada usada en varios cortes se separa como sub-receta\n\n## Lo que va en cada receta\n\nMismo formato que cocina:\n- Nombre, área, tipo, porciones\n- **Líneas** (cada ingrediente con cantidad, unidad, % merma)\n- **Sub-recetas** (puedes meter una marinada como sub-receta)\n- **Instrucciones** (paso a paso, IMPORTANTE para tu zona — temperaturas, tiempos)\n- **Foto** del corte ya hecho\n\n## Lo que es distinto en churrasca\n\n### Tiempos de parrilla\nEn las **instrucciones** de cada corte, agrega siempre:\n- Temperatura (parrilla baja, media, alta)\n- Tiempo por lado\n- Punto deseado (rojo, medio, bien hecho)\n- Reposo después de salir de la parrilla\n\nEsto le sirve a tu ayudante cuando necesite hacer la receta sin ti.\n\n### % de merma\nLa carne pierde peso al cocinarse (líquidos, grasa). Captura un % de merma realista:\n- Picaña: ~25-30%\n- Costilla: ~35-40%\n- Pollo: ~20-25%\n\nEsto afecta el costo por porción servida.\n\n## Modelo B (igual que cocina)\n\nTus cambios al recetario son **propuestas**:\n1. Editas o creas una receta\n2. Queda como propuesta pendiente\n3. Mónica/Gabriel la aprueban → cambio aplicado\n\nNo hay diferencia con cocina en este punto.\n\n## Coordinación con Sergio\n\n### Recetas con área "ambas"\nSi una preparación involucra ambas zonas (ej: "Costilla con chimichurri y arroz" — costilla es tuya, arroz es de él), pónganse de acuerdo:\n- ¿Quién es responsable del costeo total?\n- ¿Quién captura la charola al buffet?\n\nNormalmente: cada uno captura su parte. Si la sirve mezclada, **coordinen** la captura para no duplicar porciones.\n\n### Reasignar área\nMónica te pidió a ti y a Sergio reasignar el área de algunas recetas que quedaron mal categorizadas en la heurística inicial. Cuando tengan un momento, revisen juntos el listado de recetas con área incorrecta y propongan los cambios.\n\n## Errores comunes\n\n- ❌ **Capturar % merma muy bajo** (ej: 5% en una costilla) — no refleja la realidad y subestima el costo\n- ❌ **No documentar tiempos de parrilla** — el ayudante no sabe cómo replicar la receta\n- ❌ **Crear receta con corte que ya existe** — duplica datos. Antes de crear, busca\n- ❌ **No coordinar con Sergio en recetas "ambas"** — ambos capturan o ninguno captura',
      quiz: [
        { pregunta:'¿Qué información ADICIONAL es muy importante incluir en las instrucciones de una receta de churrasca?',
          a:'Temperatura de parrilla, tiempo por lado, punto deseado y reposo después. Le sirve a tu ayudante para replicar sin ti', b:'Solo el nombre del corte y el precio por kg', c:'Solo la foto del platillo terminado', d:'Solo quién fue el primer chef que preparó esa receta',
          correcta:'a', explicacion:'Tiempos y temperatura son críticos en parrilla. Sin documentar, otros no pueden replicar.' },
        { pregunta:'Una receta nueva de costilla. ¿Qué % de merma capturas aproximadamente?',
          a:'5% (la costilla casi no pierde peso al cocinarse)', b:'~35-40% (la costilla pierde ~35% al cocinarse por grasa y líquidos)', c:'0% (el peso bruto ya incluye la pérdida)', d:'80% (la costilla tiene mucho hueso no aprovechable)',
          correcta:'b', explicacion:'Costilla pierde mucho peso al cocinarse. Un % bajo subestima el costo real por porción servida.' },
        { pregunta:'En el sistema, ¿qué pasa cuando editas una receta de churrasca?',
          a:'Se aplica directo al recetario sin revisión', b:'Queda como propuesta pendiente. Mónica/Gabriel revisan y aprueban → cambio aplicado. Modelo B (igual que cocina)', c:'Se borra la versión anterior automáticamente', d:'Solo Sergio (Cocina) puede aprobar cambios de churrasca',
          correcta:'b', explicacion:'Modelo B: chef propone, gerencia aplica. Igual mecánica que en cocina.' },
        { pregunta:'Una receta tiene área "ambas" (involucra cocina y churrasca). ¿Cómo se captura la charola al buffet?',
          a:'Sergio captura todo porque es el chef ejecutivo', b:'Tú capturas todo porque la proteína es lo más importante', c:'Coordinan: cada uno captura SU parte (la proteína tú, el acompañamiento Sergio). Sin coordinación pueden duplicar porciones', d:'No se captura la charola porque es receta compartida',
          correcta:'c', explicacion:'Recetas mixtas requieren coordinación explícita para no duplicar ni dejar hueco.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 4: Charolas (espadas) en vivo ----------
    {
      titulo: 'Charolas Churrasca: registro de espadas en vivo',
      resumen: 'Cada espada que sacas al rodizio = un registro. Cómo capturar, qué tipo, cuándo merma. Diferencia con la merma del inventario.',
      tiempo: 6,
      contenido: '## Por qué capturas espadas\n\nCada vez que **sacas una espada al rodizio** y la pasas por las mesas, registras la salida. Esto permite:\n- **Cuantificar el rodizio del día** (cuántas espadas, qué tipo)\n- **Calcular costo real** del rodizio\n- **Analizar consumo** por tipo (qué carne se consume más)\n- **Justificar mermas** (si una espada no se acabó)\n\nSin tu captura, no hay control. Es **crítico**.\n\n## Tu pantalla: 🥩 Charolas Churrasca\n\nDesde tu inicio, tap en "Charolas Churrasca". Te lleva a la pantalla `charolas` con filtro `area=churrasca` (solo verás tus espadas, no las charolas de Sergio).\n\nVerás:\n- Lista de espadas del servicio activo\n- Botón **"+ Nueva charola"** arriba\n- Resumen del día: total espadas, total porciones, mermas\n\n## Cómo capturar una espada — paso a paso\n\n### 1. Tap en "+ Nueva charola"\nFormulario.\n\n### 2. Tipo de carne\nSelecciona: picaña, fraldinha, ribeye, alcatra, chorizo, costilla, pollo, etc.\n\n### 3. Cantidad de espadas\nNormalmente **1** (una espada). Si sacas 2 espadas iguales casi al mismo tiempo, puedes capturar 2.\n\n### 4. Porciones estimadas\nCuántas porciones rinde esa espada. Ejemplo: una espada de picaña puede rendir 12 porciones aproximadamente.\n\nEsto se usa para calcular costo (porciones × costo por porción según receta vinculada).\n\n### 5. Vincular a receta (recomendado)\nSi seleccionas la receta correspondiente del recetario (ej: "Picaña al carbón"), el sistema:\n- Calcula costo de la espada automáticamente\n- Identifica el corte para análisis\n\n### 6. Observaciones\nNotas: "primera espada del día", "espada chica", "se acabó en mesa 5".\n\n### 7. Guardar\nSe registra con tu user_id, hora exacta, área (churrasca).\n\n## Frecuencia\n\n**Cada vez que sacas una espada al rodizio**. No al final del día.\n\nIdeal: capturas en el momento o **máximo 5 minutos después**.\n\n## Mermas en Charolas (DIFERENTE a merma de inventario)\n\nEsto confunde mucho. Hay **2 tipos de merma** en tu rol:\n\n### Merma de inventario (en pantalla Inventario Churrasca)\nCarne que se perdió **antes de cocinarse** (mal aspecto, descongelación contaminada, corte mal hecho).\n\n### Merma de charolas (en pantalla Charolas Churrasca)\nEspada que **ya cocinaste** pero NO se sirvió completa al buffet:\n- Sobrante final del servicio (espada que no se acabó)\n- Espada que se cayó al piso\n- Espada que se quemó (ya cocinada, ya no servible)\n\n### Cómo capturar merma de charola\nEn el formulario, marcas "Es merma" y capturas:\n- Tipo (sobrante, daño, quemado)\n- Motivo en texto\n- Porciones estimadas no servidas\n\n## Errores comunes\n\n- ❌ **Capturar todo al final del día** — pierdes precisión\n- ❌ **No capturar merma** porque "no quiero que vean que sobró" — peor: hueco sin explicar\n- ❌ **Confundir merma de inventario con merma de charolas** — son distintas. Pre-cocción vs post-cocción\n- ❌ **No vincular la receta** — la espada queda sin costeo automático\n- ❌ **Capturar peso (kg) en porciones** — el sistema cuenta porciones; usa porciones siempre\n\n## Si te equivocaste\n\nMismo día: editas tu propio registro (queda en auditoría).\nDía siguiente: avisas a Mónica para corregir con override admin.',
      quiz: [
        { pregunta:'¿Cuál es la diferencia entre merma en Inventario Churrasca y merma en Charolas?',
          a:'Son exactamente lo mismo, solo están en pantallas distintas por conveniencia', b:'Inventario = carne perdida ANTES de cocinarse (mal aspecto, contaminación). Charolas = espada YA COCINADA que no se sirvió completa (sobrante, se cayó, se quemó)', c:'La de Charolas es para Sergio, no para ti', d:'Solo hay un tipo de merma que aplica a todo',
          correcta:'b', explicacion:'Pre-cocción (Inventario) vs post-cocción (Charolas). Diferentes tipos, diferentes pantallas.' },
        { pregunta:'Sacas una espada de picaña que rinde aproximadamente 12 porciones. ¿Qué capturas en cantidades?',
          a:'12 espadas (una por porción que se sirve)', b:'Cantidad de espadas = 1, Porciones estimadas = 12. El sistema usa porciones para calcular costo', c:'Solo el peso de la espada en kilos (1.2 kg por ejemplo)', d:'No capturas cantidad — solo el tipo de carne',
          correcta:'b', explicacion:'1 espada con sus 12 porciones estimadas. Porciones permiten costeo y análisis de consumo.' },
        { pregunta:'¿Por qué es recomendable vincular cada charola a una receta del recetario?',
          a:'Es solo decorativo para que se vea más formal el registro', b:'Permite al sistema calcular el costo de la espada automáticamente (porciones × costo por porción) e identificar el tipo de corte para análisis', c:'No sirve de nada — el costo lo calcula Mónica por separado', d:'Es obligatorio — no puedes guardar sin vinculación',
          correcta:'b', explicacion:'Vinculación = costeo automático + análisis por tipo. Sin vincular, queda solo conteo bruto.' },
        { pregunta:'Una espada de chorizo se cayó al piso y ya no se puede servir. ¿Dónde la registras?',
          a:'Inventario Churrasca como merma de proteína cruda', b:'Charolas Churrasca como merma tipo "daño" con motivo "espada cayó al piso después de cocinar"', c:'En ningún lado porque el accidente no tiene control posible', d:'En el recetario como actualización del % de merma esperado',
          correcta:'b', explicacion:'Es merma POST-cocción (la carne ya se cocinó), entonces va en Charolas, no en Inventario.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: El sistema completo de mermas en churrasca ----------
    {
      titulo: 'El sistema completo de mermas en churrasca',
      resumen: 'En tu zona hay DOS tipos de merma: la del inventario (antes de cocinar) y la de charolas (espada ya cocinada que no se sirvió). Ambas se capturan en pantallas distintas y con lógica distinta.',
      tiempo: 10,
      contenido: '## Las mermas en Fogueira — concepto base\n\nUna **merma** es cualquier pérdida de producto o insumo. En Fogueira se registra porque:\n- Sin registro, el sistema no puede explicar por qué el inventario no cuadra\n- Sin registro, el costo real del rodizio queda inflado o subestimado\n- Sin registro, una merma puede confundirse con robo o pérdida oculta\n\nRegistrar una merma **NO es un problema**. Ocultarla SÍ lo es.\n\n## Los DOS tipos de merma en tu rol\n\nEste es el punto más importante del módulo. En churrasca existen **dos mermas distintas**, en dos pantallas distintas:\n\n| | Merma de Inventario | Merma de Charolas |\n|--|---------------------|-------------------|\n| **Cuándo** | Antes de cocinar | Después de cocinar |\n| **Qué se perdió** | Carne cruda (proteína) | Espada ya cocinada |\n| **Por qué** | Mal aspecto, contaminación, corte inservible | Sobrante no servido, caída, quemado al rodizio |\n| **Pantalla** | ❄️ Inventario Churrasca | 🥩 Charolas Churrasca |\n| **Ejemplo** | Pieza de picaña con mal olor antes de cocinar | Espada de fraldinha que sobró al cierre |\n\nNunca mezcles las dos. Si la carne ya entró a la parrilla, ya es merma de charola.\n\n## Tipo A: Merma de Inventario (pre-cocción)\n\nEs la carne que se perdió **antes de cocinarse**. Causas típicas:\n- Pieza con mal aspecto o descomposición\n- Descongelación contaminada\n- Corte tan mal hecho que ya no es aprovechable\n- Lote del proveedor rechazado\n\n### Cómo se captura\n1. Abre **❄️ Inventario Churrasca**\n2. Busca el tipo de carne (ej: "Picaña")\n3. Captura una fila de **Merma** con la cantidad en kilos\n4. Agrega observaciones con el motivo (ej: "pieza con mal aspecto descartada antes de cocinar")\n\nEsta merma **reduce el inventario** y queda documentada con tu user_id y hora.\n\n## Tipo B: Merma de Charolas (post-cocción)\n\nEs la espada que **ya cocinaste** pero no se sirvió completa. Causas típicas:\n- Sobrante final del servicio (espada que nadie pidió más)\n- Espada que se cayó al piso después de cocinar\n- Espada que se quemó al pasarla por las mesas\n- Temperatura cayó y ya no es presentable\n\n### Cómo se captura\n1. Abre **🥩 Charolas Churrasca**\n2. Tap en **"+ Nueva charola"** y activa la opción **"Es merma"**\n3. Selecciona el tipo de carne / receta vinculada\n4. Cantidad de espadas (usa 0.5 si solo se perdió la mitad)\n5. Selecciona la **causa** del selector:\n   - Sobrante al cierre del turno\n   - Se quemó / temperatura incorrecta\n   - No pasó control de calidad\n   - Sobreproducción (se preparó de más)\n   - Se cayó / accidente en cocina\n   - Tiempo límite superado en turno\n   - Otro (escribes la causa específica)\n\n### Mermas parciales — usa 0.5\n\nSi solo se perdió la mitad de una espada (la primera mitad se sirvió, la segunda no), capturas **0.5 espadas** como merma. El sistema acepta decimales. Esto es más preciso que redondear a "0" o "1".\n\nEjemplo: espada de fraldinha a la que le sirvieron 6 de 12 porciones → merma de 0.5 espadas.\n\n## La merma natural de producción (ya incluida en recetas)\n\nHay un tercer tipo de merma que **no capturas explícitamente**: la pérdida de peso al cocinar. La carne pierde líquidos y grasa cuando se cocina:\n- Picaña: ~25-30%\n- Fraldinha: ~30-35%\n- Costilla: ~35-40%\n- Pollo: ~20-25%\n\nEsta merma ya está incluida en el **peso bruto** de cada receta en el recetario. El sistema ya sabe que si la receta dice "1.2 kg de picaña (peso bruto)", al servirla pesa ~0.85 kg. No necesitas capturar esta pérdida — el costo ya la contempla.\n\n¿Cuándo capturas merma explícita entonces? Solo cuando algo sale MAL (Tipo A o Tipo B). La pérdida normal de cocción ya está en las recetas.\n\n## Por qué registrar mermas te protege\n\nSin tu registro, el sistema ve un hueco:\n\n```\nInventario inicial:  10 kg picaña\nSalidas registradas:  8 kg\nInventario final:     0.5 kg\n\n¿Diferencia de 1.5 kg sin explicar? → BANDERA ROJA → Mónica investiga\n```\n\nCon tu registro:\n\n```\nMerma tipo A: 1.0 kg (pieza contaminada, documentado)\nMerma tipo B: 0.5 kg (espada sobrante al cierre, documentado)\n\n¿Diferencia de 1.5 kg? → EXPLICADA → sin bandera\n```\n\nLa merma documentada es tu evidencia. Sin ella, esa diferencia parece pérdida oculta o robo, aunque sea completamente legítima.\n\n## Preguntas frecuentes\n\n**¿Qué pasa si olvido registrar una merma el mismo día?**\nEl mismo día: regístrala y agrega en observaciones la hora real del evento. Si ya pasó el cierre: avisa a Mónica para registrar con override y observación.\n\n**¿Qué tan exactas tienen que ser las cantidades?**\nTu mejor estimado es suficiente. Si una espada pesaba unos 600g y toda se perdió: 1 espada merma. Si se perdió la mitad: 0.5. No necesitas una báscula en el momento de la caída.\n\n**¿Puedo registrar dos mermas del mismo tipo de carne en un día?**\nSí. Si tuviste 3 eventos (una caída, un sobrante al cierre, una espada quemada), capturas 3 registros distintos con su causa cada uno. La granularidad ayuda.\n\n**¿La merma de inventario y la merma de charolas se suman en algún reporte?**\nMónica las ve por separado. Son dos controles distintos. La de inventario afecta el control de proteína. La de charolas afecta el costo del rodizio del día.\n\n**¿Tengo que pedir permiso para registrar una merma?**\nNo. Es una captura operativa tuya. Solo se requiere aprobación si corriges una merma de un día anterior (eso lo hace Mónica con override).',
      quiz: [
        { pregunta:'Una espada de picaña se cayó al piso después de salir de la parrilla. ¿Qué tipo de merma es y dónde la capturas?',
          a:'Merma de inventario en Inventario Churrasca porque reduce la carne disponible', b:'Merma de charolas (post-cocción) en Charolas Churrasca: activo "Es merma", causa "Se cayó / accidente en cocina"', c:'No se captura — los accidentes no tienen registro', d:'Merma natural ya incluida en la receta, no requiere acción',
          correcta:'b', explicacion:'Ya estaba cocinada → merma de charolas (post-cocción). Pantalla: Charolas Churrasca. Causa: accidente en cocina.' },
        { pregunta:'Una pieza de fraldinha cruda llegó con mal olor del proveedor y la descartaste. ¿Dónde la registras?',
          a:'En Charolas Churrasca como merma de espada no servida', b:'En Inventario Churrasca como Merma del día con observación "pieza con mal olor descartada antes de cocinar"', c:'No se registra porque el proveedor es responsable', d:'En el recetario como actualización del rendimiento del corte',
          correcta:'b', explicacion:'Antes de cocinar = merma de inventario (pre-cocción). Pantalla: Inventario Churrasca. Reduce el inventario de ese tipo de carne.' },
        { pregunta:'Al cierre del servicio sobró media espada de costilla que ya no se puede guardar. ¿Cuántas espadas capturas como merma de charola?',
          a:'1 espada entera (siempre se redondea al entero)', b:'0 — no se captura si la pérdida es menor a una espada completa', c:'0.5 espadas — el sistema acepta decimales para mermas parciales', d:'2 espadas para compensar las que no se sirvieron antes',
          correcta:'c', explicacion:'Mermas parciales se capturan con 0.5. Más preciso que redondear a 0 o 1. El sistema acepta step=0.5.' },
        { pregunta:'¿Por qué la pérdida de peso de la carne al cocinarse (picaña pierde ~25-30%) NO se captura como merma explícita?',
          a:'Porque es demasiado pequeña para importar en el costo total', b:'Porque ya está incluida en el peso bruto de la receta. El sistema contempla ese porcentaje en el costeo. Solo capturas merma explícita cuando algo sale MAL (caída, quemado, sobrante)', c:'Porque la registra Sergio en la pantalla de cocina', d:'Porque el proveedor garantiza ese porcentaje y lo repone',
          correcta:'b', explicacion:'Merma natural de cocción = implícita en peso bruto de la receta. Merma explícita = evento anormal.' },
        { pregunta:'Terminaste el turno y el sistema muestra 1.5 kg de picaña sin explicar (inventario no cuadra). ¿Qué habría pasado si hubieras registrado tus mermas?',
          a:'El resultado sería exactamente igual con o sin registro de mermas', b:'Esa diferencia quedaría explicada por tus registros de merma, sin bandera roja. Sin registro, Mónica ve un hueco que parece pérdida oculta aunque sea legítima', c:'El sistema corrige las diferencias automáticamente al día siguiente', d:'No importa el cuadre porque la proteína siempre tiene variación',
          correcta:'b', explicacion:'Merma documentada = diferencia explicada = sin bandera. Sin documentar = hueco = bandera roja e investigación.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 6: Cierre del servicio ----------
    {
      titulo: 'Cierre del servicio desde tu rol',
      resumen: 'Sello de cierre churrasca, conteo físico de inventario, mermas finales, coordinación con Sergio. Tu papel cuando hay banderas.',
      tiempo: 6,
      contenido: '## Tu rol en el cierre\n\nAl cierre, **firmas tu sello de churrasca** desde tu sesión. Solo tú puedes firmarlo.\n\nUn cierre limpio depende de que **durante el servicio** hayas:\n- Capturado todas las espadas a tiempo\n- Registrado mermas con motivo\n- Llevado el inventario al día\n\n## 30 minutos antes del cierre\n\n### Tu checklist\n\n#### 1. Charolas pendientes\n- ¿Falta capturar alguna espada que sacaste pero no registraste?\n- Si una espada quedó incompleta y no se sirvió todo → captura merma sobrante con motivo\n\n#### 2. Mermas del día\n- ¿Capturaste todas las mermas del día (caídas, quemados, sobrantes)?\n- Si recuerdas alguna, hazlo ahora\n\n#### 3. Inventario Churrasca — conteo físico\n- Esta es la **diferencia clave** de tu rol vs Sergio\n- **Ve al refri** y cuenta físicamente lo que queda de cada tipo de carne\n- Compara con el "Final" calculado por fórmula\n- Si no cuadra → captura Final manual con observación\n- Si cuadra → no haces nada\n\n#### 4. Coordinación con Sergio\n- ¿Hay sobrantes de carne ya cocinada que se pueden almacenar para mañana?\n- Si una receta es "ambas" (cocina + churrasca), aclaren quién captura la merma compartida\n\n## Firmar el sello de cierre\n\nDesde tu pantalla de Charolas Churrasca, sección Sellos:\n\n```\n[ Cierre · Churrasca ]\n  Estado: pendiente\n  [ Firmar ]\n```\n\nAntes de firmar:\n- Charolas completas\n- Mermas capturadas\n- Inventario revisado (conteo físico)\n\nTap en "Firmar". Sistema confirma tu nombre, rol, hora exacta. Queda en hoja `Sellos`.\n\n## Si descubres una bandera al cierre\n\nEjemplos:\n- Conteo físico difiere mucho del calculado (>2 kg sin explicación)\n- Una espada quedó sin capturar y ya pasó tiempo\n- Sospecha de robo o desperdicio sin documentar\n\n### Acción\n1. **Si puedes corregir** → corriges directo\n2. **Si NO puedes corregir** o hay sospecha → avisa a Mónica antes de firmar\n3. **Mientras la bandera no esté explicada, NO firmes**\n\nMejor que el sello quede pendiente 1 hora más que firmar con problema.\n\n## Cierre de semana (domingo o lunes mañana)\n\nAdemás del cierre diario, hay un **cierre semanal del inventario**:\n- Revisas la semana completa Lun-Dom\n- Verificas que cada día tenga sus capturas\n- Si hay una semana con mucha diferencia entre fórmula y conteo físico → es señal\n- Mónica revisa el cierre semanal contigo\n\nEste cierre semanal es lo que permite a Mónica calcular el **costo real de proteína** de la semana y planear la compra siguiente.\n\n## Después del cierre\n\nNo te tienes que quedar después del cierre operativo. Tu sello firmado = día concluido.\n\nLa cajera y Mónica hacen el cierre de caja después. Si te necesitan, te llaman. Pero rara vez.\n\n## Lo que verás mañana al volver\n\n- Tu sello de ayer queda como ✓ Firmado\n- Tu inventario semanal arrastra el "Final" como "Inicial" del nuevo día\n- Tus charolas del servicio anterior quedan en histórico\n- Empieza un servicio nuevo limpio\n\n## Hábito que te define\n\nUn buen churrasquero **lleva su inventario al día** y **captura sus espadas en vivo**. No es burocracia: es la diferencia entre un restaurante con costo de proteína controlado y uno donde "la carne se va y no sabemos por qué".',
      quiz: [
        { pregunta:'¿Cuál es la diferencia clave de tu cierre vs el de Sergio (Cocina)?',
          a:'Ninguna, ambos hacen el mismo proceso de cierre', b:'Tú haces conteo físico del refri (Inventario Churrasca) y comparas con el Final calculado. Esa verificación física es central a tu rol porque la proteína es el insumo más caro', c:'Tú no firmas sello porque Sergio lo hace por los dos', d:'Sergio hace el conteo físico por ti porque tú estás en parrilla',
          correcta:'b', explicacion:'Conteo físico al cierre es exclusivo de churrasca por el costo de la proteína. Sergio no hace conteo equivalente.' },
        { pregunta:'En tu conteo físico al cierre, encuentras 1.5 kg menos de picaña de lo que dice el "Final" calculado. ¿Qué haces?',
          a:'Lo dejas así — las diferencias de 1-2 kg son normales y no importan', b:'Capturas Final manual con la cantidad real (la del conteo físico) y agregas observación explicando: "Conteo físico difiere de fórmula en -1.5 kg, posible captura faltante o pérdida no documentada"', c:'Borras las capturas del día y empiezas el inventario desde cero', d:'Cobras los 1.5 kg al proveedor porque fue error de entrega',
          correcta:'b', explicacion:'Captura Final real + observación documentada. Mónica revisa y decide si investiga.' },
        { pregunta:'¿Tu sello de cierre lo puede firmar Sergio (Cocina) por ti?',
          a:'Sí, porque trabajan juntos en la misma zona', b:'No. Cada sello es autenticado por user_id. Solo tú firmas desde tu sesión. Si no estás, override admin de Mónica con motivo', c:'Solo los lunes cuando hay reunión de cocina', d:'Solo si Gabriel lo autoriza antes del cierre',
          correcta:'b', explicacion:'Sellos individuales y autenticados. Override admin es la única excepción y deja huella.' },
        { pregunta:'¿Qué es el "cierre semanal del inventario churrasca"?',
          a:'Es exactamente lo mismo que el cierre diario', b:'Adicional al diario: revisas la semana completa Lun-Dom, verificas capturas de cada día y comparas total con conteo físico. Mónica usa esto para calcular costo real de proteína y planear compra siguiente', c:'Solo ocurre cuando hay luna llena o festivo', d:'No existe — solo hay cierre diario en churrasca',
          correcta:'b', explicacion:'Cierre semanal = visión completa de la semana de proteína. Insumo crítico para compras del proveedor siguiente.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Curso de Auditoría. Auditor interno (Germán u otra persona designada). Lectura sin
// modificación, marcos COSO, banderas rojas, hallazgos, papeles de trabajo.
function modulosCursoAuditoria() {
  return [
    // ---------- Módulo 1: Tu rol como auditor interno ----------
    {
      titulo: 'Tu rol como auditor interno y el principio de no-operación',
      resumen: 'Auditoría revisa, NO opera. Tu acceso es read-only (con excepciones documentadas). Marcos conceptuales mínimos: COSO y separación de funciones.',
      tiempo: 7,
      contenido: '## Tu posición\n\nEres **auditor interno** de Fogueira (puedes ser Germán mismo o una persona designada). Tu rol es **revisar, no operar**.\n\nEsto significa que tu trabajo NO es:\n- Capturar reservas, charolas o cierre\n- Firmar sellos operativos\n- Aprobar cortesías\n- Cobrar o conciliar caja\n\nTu trabajo SÍ es:\n- **Leer** los registros del sistema\n- **Identificar** anomalías y banderas\n- **Documentar** hallazgos con evidencia\n- **Reportar** a la dirección con propuestas de mejora\n\n## El principio de no-operación\n\nEn auditoría hay un principio simple: **no auditas lo que tú operaste**. Si tú capturas reservas y luego las auditas, hay conflicto de interés. Por eso tu rol en el sistema es de **lectura**.\n\nExisten excepciones puntuales (puedes editar tu perfil, cambiar tu contraseña, tomar tu propio examen de certificación), pero las pantallas operativas (Bitácora, Charolas, Inventario, Conciliación, Recetas) son para ti **solo lectura**.\n\n## Marco COSO — versión rápida\n\nCOSO es el estándar internacional de control interno. No te lo vas a saber de memoria, pero estos 5 componentes te orientan en qué buscar:\n\n| Componente | Qué buscas en Fogueira |\n|------------|------------------------|\n| **Ambiente de control** | ¿Hay roles claros? ¿Se respeta la separación de funciones? |\n| **Evaluación de riesgo** | ¿Qué procesos manejan dinero o información sensible? Empieza por ahí |\n| **Actividades de control** | ¿Hay sellos, autorizaciones, trazabilidad? ¿Funcionan? |\n| **Información y comunicación** | ¿Las banderas rojas se ven? ¿Llegan a quien debe? |\n| **Monitoreo** | ¿Alguien revisa periódicamente? (eso eres tú) |\n\nNo necesitas memorizar nombres. Ten claro que tu trabajo es **verificar que los controles funcionan**.\n\n## Separación de funciones — clave de Fogueira\n\nEs uno de los controles más importantes. Significa: **una sola persona NO debe tener todo el control de un proceso**. En Fogueira esto se traduce a:\n\n| Proceso | Roles separados |\n|---------|-----------------|\n| Captura de reserva | Host captura · Cliente confirma |\n| Cobro | Cajera cobra · Mónica/Gabriel autorizan cortesías |\n| Recetario | Chef propone · Mónica/Gabriel aprueban |\n| Inventario churrasca | Marcos captura · Mónica revisa cierre semanal |\n| Cierre del día | Múltiples sellos: host, cajera, cocina, churrasca, gerente |\n\n**Lo que tú vigilas**: que esa separación se respete. Si descubres que alguien está saltándose un paso (ej: la cajera firmó sin Mónica revisando), es **hallazgo**.\n\n## Tus pantallas en el sistema\n\nDesde tu inicio verás múltiples cuadros (más que cualquier rol operativo, porque ves casi todo en lectura):\n\n| Pantalla | Tu uso |\n|----------|--------|\n| 📊 **Conciliación** | Lectura: revisar cierres del día, banderas, sellos |\n| 📊 **Histórico** | Lectura con filtros: análisis multi-fecha, exportar CSV |\n| 🍲 **Charolas Cocina** | Lectura: verificar capturas vs lógica |\n| 🥩 **Charolas Churrasca** | Lectura: verificar capturas e inventario |\n| ❄️ **Inventario Churrasca** | Lectura: revisar diferencias entre fórmula y conteo |\n| 📒 **Recetas y costeo** | Lectura: verificar propuestas, aprobaciones, costos |\n| 🎓 **Mi curso** y 📖 **Mi manual** | Tu capacitación |\n\nNo verás: bitácora operativa de hosts (esa es para hosts), reservaciones (para hosts), administración de usuarios (para admin).\n\n## Tu sesión\n\nDura **hasta las 3:00 am del día siguiente**.\n\n## Tu firma — limitada\n\nNo firmas sellos operativos (apertura/cierre). Pero todo lo que hagas en el sistema queda con tu user_id y timestamp para auditoría reversa (sí, hasta a ti te auditan).',
      quiz: [
        { pregunta:'¿Cuál es el principio fundamental de tu rol como auditor interno?',
          a:'NO operas lo que auditas. Tu acceso es de lectura (con excepciones puntuales). Tu trabajo es revisar, identificar anomalías, documentar hallazgos y reportar', b:'Verificar que los chefs sigan las recetas', c:'Cobrar al cliente en caso de faltante', d:'Cocinar cuando hay escasez de personal',
          correcta:'a', explicacion:'No-operación = principio core. Si tú operas y auditas hay conflicto de interés.' },
        { pregunta:'¿Qué es la "separación de funciones" en Fogueira?',
          a:'Que cada quien trabaje en su área física del restaurante', b:'Que se dividan los turnos en dos equipos distintos', c:'Que una sola persona NO tenga control total de un proceso. Ej: Chef propone receta, Mónica aprueba; cajera cobra, Mónica/Gabriel autorizan cortesías; etc.', d:'Solo aplica para personal de cocina',
          correcta:'c', explicacion:'Control clave: dividir responsabilidades evita fraude y errores no detectados.' },
        { pregunta:'Descubres que la cajera firmó el cierre sin que Mónica/Gabriel revisaran las cortesías del día. ¿Qué tipo de hallazgo es?',
          a:'No es hallazgo, las cajeras tienen permiso de hacerlo', b:'Solo un error operativo menor que se corrige al día siguiente', c:'No es tu problema, ese es asunto de Mónica directamente', d:'Hallazgo de control: violación de separación de funciones. Una sola persona controló el proceso. Documentas con evidencia y reportas',
          correcta:'d', explicacion:'Violación de separación = hallazgo serio. Documentas y escalas.' },
        { pregunta:'En el sistema, ¿puedes editar una conciliación cerrada?',
          a:'Sí, todas las que quieras', b:'No. Tu rol es read-only. La conciliación cerrada solo se modifica con override admin de gerencia con motivo registrado en auditoría', c:'Solo los lunes en horario administrativo', d:'Solo si tú la firmaste antes',
          correcta:'b', explicacion:'Read-only es la regla. Modificación de cierre = override admin (auditable).' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 2: Banderas rojas — dónde buscar ----------
    {
      titulo: 'Banderas rojas: dónde buscar y cómo interpretarlas',
      resumen: 'El sistema marca automáticamente algunas anomalías. Tu trabajo es revisarlas, entenderlas y decidir si son hallazgo.',
      tiempo: 8,
      contenido: '## Qué es una bandera roja\n\nUna **bandera roja** es una señal automática del sistema que indica: "aquí algo no cuadra, alguien debería revisar". El sistema no toma acciones por sí solo — solo marca para que **tú** revises.\n\nLas banderas no significan automáticamente "fraude". Pueden ser:\n- Error operativo de captura (lo más común)\n- Excepción legítima sin documentar\n- Problema real que requiere investigación\n\nTu trabajo: **interpretar** y **documentar**.\n\n## Banderas en Conciliación de caja\n\n### 1. Cortesía sin autorizante\nUn host capturó una cortesía pero la columna `autoriza` quedó vacía o sin nombre de Mónica/Gabriel.\n\n**Por qué es bandera**: solo Mónica y Gabriel autorizan cortesías. Sin firma, no hay trazabilidad → puede ser cortesía no autorizada (regalada por host por su cuenta) o fraude.\n\n**Cómo se ve**: en la pantalla Conciliación, fila roja con texto "⚠️ Cortesía sin autorización" y monto.\n\n**Acción**: revisar quién capturó, hablar con esa persona, revisar si efectivamente Mónica/Gabriel autorizaron pero olvidaron firmar.\n\n### 2. Diferencia entre POS y bitácora\nLo capturado en bitácora (folios, montos) NO coincide con lo del POS.\n\n**Por qué es bandera**: doble registro debe cuadrar. Si no cuadra hay error de captura, ticket cancelado sin registrar, o fraude.\n\n**Acción**: identificar diferencia exacta. Cruzar manualmente cada folio. La diferencia puede ser tan simple como un decimal mal capturado.\n\n### 3. Faltante en arqueo de caja\nLo que cajera registró como "efectivo en caja" es menor a lo que debió haber según ventas.\n\n**Por qué es bandera**: faltante = posible robo, error de cambio, o cobro no capturado.\n\n**Acción**: revisar arqueo. Faltantes <$100 son comunes (cambio mal calculado). Faltantes >$1,000 sin explicación = hallazgo serio.\n\n### 4. Sello pendiente al cierre\nUn sello (host, cajera, cocina, churrasca, gerente) quedó sin firmar.\n\n**Por qué es bandera**: cierre incompleto. Si la persona no estaba, debió haber override admin con motivo.\n\n**Acción**: verificar si fue override admin documentado. Si no, hallazgo.\n\n### 5. Saltos en folios\nLos folios del POS deberían ser secuenciales (101, 102, 103...). Un salto (101, 102, 105...) indica tickets cancelados.\n\n**Por qué es bandera**: cancelaciones requieren autorización gerencial. Saltos sin documentar = tickets cancelados sin trazabilidad.\n\n**Acción**: revisar cada salto. Cancelación legítima debe tener motivo y autorización registrada.\n\n## Banderas en Inventario Churrasca\n\n### Diferencia grande entre fórmula y conteo físico\nMarcos captura "Final" manual con observación, pero la diferencia es alta y recurrente.\n\n**Por qué es bandera**: pérdida de proteína sin documentar. Puede ser captura incompleta o pérdida real.\n\n**Acción**: revisar la semana completa. Comparar con días previos. Si patrón es repetitivo, hallazgo.\n\n## Banderas en Charolas\n\n### Mucha merma sin justificar\nSi un día tiene mermas muy por encima del promedio, puede ser:\n- Día malo (legítimo)\n- Captura para "cuadrar" inventario sin que sea real\n\n**Acción**: comparar con promedio histórico. Investigar si patrón.\n\n## Banderas en Recetas\n\n### Cambio de receta sin propuesta documentada\nUna receta cambió pero no hay registro de propuesta. Esto NO debería pasar (Modelo B), pero si se hace edición directa con override puede pasar.\n\n**Acción**: verificar tabla de propuestas vs receta actual.\n\n## Banderas en Sellos / Auditoría\n\n### Override admin sin motivo\nEs_override = true pero motivo_override está vacío o es genérico ("override").\n\n**Por qué es bandera**: override es excepción. Sin motivo claro, viola control.\n\n**Acción**: hablar con el admin. Documentar.\n\n### Acceso fuera de horario\nUn usuario operativo accedió al sistema a las 4 AM (fuera de horario operativo).\n\n**Por qué es bandera**: posible acceso no autorizado o uso de credenciales.\n\n**Acción**: revisar logs (sesiones), verificar con la persona.\n\n## Banderas en Certificaciones\n\n### Múltiples resets de examen\nUn usuario fue reseteado por admin más de 2 veces sin justificación clara.\n\n**Por qué es bandera**: posible que el reset se use como "atajo" en lugar de capacitación real.\n\n**Acción**: revisar quién resetea, cuándo. Hablar con admin.\n\n## Cómo NO interpretar las banderas\n\n- ❌ **Ignorarlas** porque "siempre pasan"\n- ❌ **Asumir fraude** sin investigar (la mayoría son errores operativos)\n- ❌ **Confrontar al equipo** sin tener evidencia documentada\n- ❌ **Acumularlas** sin reportarlas a la dirección\n\n## El proceso correcto\n\n1. **Detecta** bandera (revisión periódica)\n2. **Documenta** evidencia (captura de pantalla, fila exacta del sheet)\n3. **Investiga** (habla con la persona involucrada, revisa contexto)\n4. **Clasifica** severidad (info / observación / hallazgo / hallazgo crítico)\n5. **Reporta** a Mónica/Germán con propuesta de mejora',
      quiz: [
        { pregunta:'Encuentras una cortesía en bitácora sin nombre del autorizante. ¿Qué tipo de hallazgo es?',
          a:'Bandera roja: falta de control. Solo Mónica/Gabriel autorizan cortesías. Sin firma no hay trazabilidad → puede ser cortesía no autorizada o error de captura. Documentas y investigas', b:'Sin importancia, los hosts la capturan a veces sin ese dato', c:'Por culpa del cliente que no dio su nombre', d:'Sin clasificar, esperas a que se resuelva solo',
          correcta:'a', explicacion:'Cortesía sin autorización = control violado. Investigación obligatoria.' },
        { pregunta:'Los folios del POS muestran saltos (101, 102, 105). ¿Qué significa típicamente?',
          a:'Numeración aleatoria del POS', b:'Que se acabaron los rollos de papel en esos folios', c:'No significa nada relevante para auditoría', d:'Tickets cancelados. Cancelaciones requieren autorización gerencial. Saltos sin documentar = cancelaciones sin trazabilidad. Investigas cada salto',
          correcta:'d', explicacion:'Saltos en folios = tickets cancelados. Sin autorización registrada = bandera roja.' },
        { pregunta:'¿Cuál es la actitud INCORRECTA frente a una bandera roja?',
          a:'Investigar con calma y documentar los pasos', b:'Ignorarla porque "siempre pasan", asumir fraude sin investigar, confrontar al equipo sin evidencia, o acumularlas sin reportar', c:'Documentar la evidencia antes de hablar con alguien', d:'Hablar con la persona involucrada para entender el contexto',
          correcta:'b', explicacion:'Esos cuatro errores son los que invalidan la auditoría. Lo correcto: detectar, documentar, investigar, clasificar, reportar.' },
        { pregunta:'En la hoja Sellos ves un sello con es_override = true pero motivo_override vacío. ¿Qué haces?',
          a:'Lo dejas pasar porque los overrides son normales', b:'Lo borras para que no distorsione el reporte mensual', c:'Es bandera: override sin motivo viola el control. Hablas con el admin que firmó, documentas, escalas a Mónica si no hay justificación clara', d:'Felicitas al admin por haber cubierto el sello faltante',
          correcta:'c', explicacion:'Override sin motivo = excepción no documentada. Investigación obligatoria.' },
        { pregunta:'En el inventario churrasca de la semana, las diferencias entre fórmula y conteo físico son grandes y recurrentes (todos los días). ¿Qué hallazgo registras?',
          a:'Sin importancia, siempre hay diferencias en inventario', b:'Hallazgo de control: pérdida de proteína sin documentar. Patrón repetitivo descarta error puntual. Reportas a Mónica con evidencia (capturas de la semana)', c:'Le echas la culpa al proveedor de carne', d:'No es tu problema, ese es asunto de Marcos',
          correcta:'b', explicacion:'Patrón = no es error puntual. Pérdida sistemática de proteína es hallazgo de impacto financiero.' }
      ],
      minAprobatorio: 5
    },
    // ---------- Módulo 3: Hallazgos y papeles de trabajo ----------
    {
      titulo: 'Hallazgos: cómo documentarlos y clasificarlos',
      resumen: 'Severidad, evidencia, recomendación. Plantilla de papel de trabajo. Diferencia entre observación y hallazgo crítico.',
      tiempo: 7,
      contenido: '## Qué es un hallazgo\n\nUn **hallazgo** es una observación de auditoría documentada. NO es lo mismo que una bandera roja del sistema. La bandera es la señal automática; el hallazgo es **lo que tú concluiste tras investigar la bandera**.\n\nUna bandera puede resolverse en error de captura (no es hallazgo) o convertirse en hallazgo si confirma una falla de control.\n\n## Estructura de un hallazgo\n\nTodo hallazgo bien documentado tiene estos 5 elementos:\n\n### 1. Condición (qué encontraste)\nDescripción objetiva de lo observado. Sin opiniones, sin acusaciones.\n\nEjemplo: "En la hoja Conciliaciones, fila 47, la cortesía de $580 capturada el 2026-05-03 no tiene nombre del autorizante en la columna `autoriza`."\n\n### 2. Criterio (qué debía pasar)\nLa regla, política o control que se violó.\n\nEjemplo: "Por reglas operativas Fogueira, todas las cortesías deben tener firma de Mónica (Gerente Administrativo) o Gabriel (Gerente de Restaurante) en la columna autoriza. Cortesías sin autorización quedan como bandera roja en conciliación."\n\n### 3. Causa (por qué pasó)\nLa razón identificada en tu investigación.\n\nEjemplo: "El host del turno olvidó capturar el nombre del autorizante. Mónica confirmó que sí autorizó la cortesía verbalmente, pero no se registró en el sistema."\n\n### 4. Efecto (impacto)\nQué riesgo o pérdida implica.\n\nEjemplo: "Riesgo de control: cortesías capturadas sin trazabilidad pueden ser legítimas (como esta) o fraudulentas, y el sistema no permite distinguirlas. Si el patrón continúa, no hay forma de auditar autorización real de cortesías."\n\n### 5. Recomendación\nQué proponer para que no vuelva a pasar.\n\nEjemplo: "Implementar validación en el formulario de captura de cortesía: si el campo `autoriza` está vacío al guardar, mostrar advertencia bloqueante hasta que se llene. Capacitación recordatoria a hosts."\n\n## Severidad\n\n| Nivel | Cuándo aplicar | Ejemplo |\n|-------|----------------|---------|\n| **Información** | Observación menor sin riesgo | "Algunos campos opcionales raramente se llenan" |\n| **Observación** | Falla de control sin impacto material | "1-2 cortesías sin autorizante en el mes (errores aislados)" |\n| **Hallazgo** | Falla de control con impacto medible | "Patrón recurrente de cortesías sin autorización (>5 al mes)" |\n| **Hallazgo crítico** | Riesgo material o fraude probable | "Faltante en arqueo de caja >$5,000 sin explicación" |\n\nNo todo es hallazgo crítico. Si todo es crítico, nada es crítico. Calibra.\n\n## Evidencia — qué guardar\n\nUn hallazgo sin evidencia es opinión. Para cada hallazgo:\n\n- **Captura de pantalla** del sistema (la fila con la anomalía)\n- **Referencia exacta**: qué hoja, qué fila, qué fecha, qué campo\n- **Datos de respaldo**: extracto del CSV o copia de los registros relevantes\n- **Notas de la conversación** con la persona involucrada (si la hubo)\n\nGuarda todo en una **carpeta de auditoría** (Drive) por mes/trimestre.\n\n## Papel de trabajo — plantilla mínima\n\nUn "papel de trabajo" es el documento donde organizas tus hallazgos. No tiene que ser complicado. Plantilla:\n\n```\nAUDITORÍA · FOGUEIRA\nFecha de revisión: 2026-05-07\nAuditor: [tu nombre]\nPeríodo revisado: 2026-05-01 a 2026-05-06\n\nHALLAZGO #1\nÁrea: Conciliación de caja\nSeveridad: Hallazgo (no crítico)\n\nCondición: [descripción objetiva]\nCriterio: [regla violada]\nCausa: [por qué pasó]\nEfecto: [impacto/riesgo]\nRecomendación: [qué proponer]\n\nEvidencia: ver carpeta /Auditoría/2026-05/H1/\n\n---\n\nHALLAZGO #2\n[etc.]\n```\n\n## Frecuencia\n\n- **Revisión diaria**: solo banderas críticas (cortesías sin autoriza, faltantes grandes)\n- **Revisión semanal**: cierre semanal de inventario churrasca + conciliaciones\n- **Revisión mensual**: papel de trabajo formal con todos los hallazgos del mes\n- **Revisión trimestral**: tendencias y propuestas estratégicas\n\n## Reporte a la dirección\n\nUna vez al mes, presentas a Mónica y Germán:\n- Resumen de hallazgos del mes (por severidad)\n- Tendencias (mejorando, igual, empeorando)\n- Recomendaciones concretas\n- Pendientes de auditorías anteriores\n\nFormato corto: 1-2 páginas, tablas, gráficos simples. NO es presentación corporativa larga.\n\n## Lo que NO eres\n\n- ❌ **Policía**: no confrontas al equipo en su zona de trabajo\n- ❌ **Acusador**: documentas hechos, no juicios\n- ❌ **Operador**: no resuelves el problema, lo reportas\n- ❌ **Gerente**: no tomas decisiones de personal o financieras',
      quiz: [
        { pregunta:'¿Cuál es la diferencia entre una bandera roja y un hallazgo?',
          a:'Son lo mismo — bandera roja y hallazgo son términos sinónimos en auditoría', b:'La bandera es solo para informarle a Mónica; el hallazgo lo ves directamente con el equipo', c:'Bandera roja = señal automática del sistema. Hallazgo = conclusión documentada después de investigar la bandera. Una bandera puede resolverse en error de captura (no es hallazgo) o confirmarse como falla de control (sí es hallazgo)', d:'No hay diferencia práctica en el sistema Fogueira',
          correcta:'c', explicacion:'Bandera = automática. Hallazgo = tu conclusión investigada. No toda bandera se convierte en hallazgo.' },
        { pregunta:'¿Cuáles son los 5 elementos de un hallazgo bien documentado?',
          a:'Condición (qué pasó), Criterio (qué debió pasar), Causa (por qué pasó), Efecto (impacto), Recomendación (qué proponer)', b:'Solo descripción y opinión del auditor', c:'Evidencia fotográfica únicamente', d:'Solo la recomendación de mejora',
          correcta:'a', explicacion:'Estructura clásica de hallazgo de auditoría: 5 elementos en orden lógico.' },
        { pregunta:'Encuentras un faltante en arqueo de caja de $7,000 sin explicación. ¿Qué severidad asignas?',
          a:'Información — es normal tener diferencias en el arqueo', b:'Hallazgo crítico: faltante material >$1,000 sin explicación es riesgo financiero significativo. Reporte inmediato a dirección', c:'Observación menor, queda pendiente para el reporte mensual', d:'Sin importancia, la cajera siempre lo cuadra al día siguiente',
          correcta:'b', explicacion:'Faltante material y sin explicación = hallazgo crítico. Acción inmediata.' },
        { pregunta:'¿Qué es un "papel de trabajo" en auditoría?',
          a:'Cualquier documento digital que guardas', b:'Solo el nombre técnico de la hoja de Excel que usa Germán', c:'Solo la evidencia fotográfica de las pantallas del sistema', d:'Documento donde organizas tus hallazgos del período revisado, con plantilla mínima: condición/criterio/causa/efecto/recomendación + evidencia. Reporta hallazgos por severidad',
          correcta:'d', explicacion:'Papel de trabajo = entregable de tu revisión. Estructura clara, evidencia respaldada.' },
        { pregunta:'¿Qué NO es tu rol como auditor interno?',
          a:'Documentar hallazgos con evidencia concreta', b:'Ser policía que confronta al equipo, ser acusador con juicios, ser operador que resuelve el problema, ser gerente que toma decisiones. Tu rol es revisar, documentar, recomendar', c:'Identificar banderas rojas en el sistema', d:'Investigar el contexto antes de clasificar severidad',
          correcta:'b', explicacion:'Tu rol es de revisión y reporte. Las decisiones operativas y de personal son de la dirección.' }
      ],
      minAprobatorio: 5
    },
    // ---------- Módulo 4: Verificación de identidad y soft-delete ----------
    {
      titulo: 'Verificación de identidad de sellos y trazabilidad de cambios',
      resumen: 'Cómo el sistema garantiza que cada captura tiene autor verificable. Soft-delete: nada se borra de verdad.',
      tiempo: 6,
      contenido: '## Identidad en sellos\n\nCada sello del sistema (apertura, cierre, cualquier autorización) lleva **identidad verificable**:\n\n| Campo | Qué guarda |\n|-------|------------|\n| `user_id` | Identificador único del usuario que firmó |\n| `user_email` | Email al momento de firmar (snapshot) |\n| `user_nombre` | Nombre al momento de firmar (snapshot) |\n| `user_rol` | Rol al momento de firmar (snapshot) |\n| `sellado_at` | Fecha y hora exacta del sellado |\n| `es_override` | true si fue override admin |\n| `motivo_override` | Texto con motivo si es_override=true |\n\n### Por qué snapshots y no referencias\n\nSi el día 1 firmó "Sergio · cocina" y el día 30 lo cambian a "Sergio · admin", el sello del día 1 sigue diciendo "cocina" (snapshot del momento). Esto es importante para auditoría: **lo que firmó en su momento es lo que queda registrado**, aunque después su rol cambie.\n\n## Cómo verificar autenticidad de un sello\n\n### Caso típico\nVes un sello con `user_email = monica@fogueira.com`, `sellado_at = 2026-05-03 23:15`. ¿Cómo verificar que efectivamente fue Mónica?\n\n1. **Cruza con bitácora de sesiones** (si existe): ¿hubo login con monica@... en esa fecha/hora?\n2. **Cruza con WhatsApp/comunicación**: ¿Mónica reportó haber estado al cierre ese día?\n3. **Geolocalización** (si la tienes): IP de la sesión\n4. **Pregunta directa**: a Mónica si recuerda haber firmado a esa hora\n\nLa autenticidad fuerte viene del **conjunto** de evidencia, no de un solo campo.\n\n## Override admin — caso especial\n\nUn override es cuando un admin/gerente_admin firma **por otro rol** (ej: Mónica firma el cierre de churrasca porque Marcos no estaba). El sistema guarda:\n- `es_override = true`\n- `user_id` del admin que firmó (no de Marcos)\n- `motivo_override` con el texto\n\n### Banderas con override\n- Override **sin motivo** o motivo genérico ("override") → bandera\n- **Múltiples overrides** del mismo usuario en corto tiempo → patrón sospechoso\n- Override en horario inusual → revisar\n\n## Soft-delete — nada se borra de verdad\n\nEn Fogueira, **borrar no significa borrar físicamente**. Significa **marcar como borrado** en la misma fila.\n\n### Cómo se ve en BitacoraFilas\nSi un host borra una fila, queda:\n- La fila sigue ahí (no se elimina)\n- `borrada_at` se llena con fecha/hora\n- `borrada_motivo` con el texto que el host capturó (mín 5 caracteres)\n- `borrada_por` con el user_id\n\nEsto significa que **toda la información sigue accesible** para auditoría. Si un host "borró" una reserva, tú puedes verla con todos sus datos + saber quién y cuándo la borró + motivo.\n\n### Cómo identificar filas borradas\nFiltro: `borrada_at IS NOT NULL`. En la pantalla operativa NO aparecen, pero tú las ves siempre desde tu rol auditoría (con el filtro adecuado en el sheet).\n\n### Por qué importa\nUn fraude clásico es "borrar evidencia". El soft-delete previene eso: **lo borrado nunca desaparece**. Si alguien borra masivamente filas, eso mismo es bandera.\n\n## Acceso al sheet directamente\n\nComo auditor, además de las pantallas web del sistema, tienes acceso de **lectura al Google Sheet base** del sistema. Esto te permite:\n- Ver columnas que la UI no muestra (timestamps, user_ids, banderas internas)\n- Filtrar y ordenar libremente\n- Cruzar tablas (ej: BitacoraFilas + Sellos + Usuarios)\n- Exportar para análisis externo\n\n**Importante**: NO modificas el sheet directamente. Solo lees. Cualquier modificación tuya rompe el control.\n\n## Tu rastro como auditor\n\nIrónicamente, **tú también dejas huella**. Cada login tuyo, cada exportación de CSV, cada acceso a una pantalla queda registrado. Esto:\n- Te protege (puedes demostrar qué revisaste y cuándo)\n- Te audita a ti (otra persona puede verificar tu trabajo)\n\nNo te preocupa: si haces tu trabajo bien, tu rastro respalda tu reporte.',
      quiz: [
        { pregunta:'¿Por qué el sistema guarda "snapshot" del nombre, email y rol al momento del sello (no referencia)?',
          a:'Porque si después el usuario cambia de rol o nombre, el sello sigue diciendo lo que firmó EN SU MOMENTO. Esto es crítico para auditoría histórica', b:'Porque es técnicamente más fácil de programar', c:'No hay una razón operativa — es solo preferencia de diseño', d:'Solo por seguridad informática general',
          correcta:'a', explicacion:'Snapshot preserva integridad histórica. Lo que firmó en su momento queda registrado independientemente de cambios posteriores.' },
        { pregunta:'En BitacoraFilas, una fila tiene `borrada_at` llena con fecha. ¿Qué significa?',
          a:'Que se eliminó físicamente del sistema y ya no existe', b:'Soft-delete: la fila sigue accesible para auditoría con todos sus datos. Solo se marcó como borrada (UI operativa NO la muestra, pero tú sí la ves desde auditoría)', c:'Que se duplicó en otra fila', d:'Un error del sistema que genera filas fantasma',
          correcta:'b', explicacion:'Soft-delete preserva auditoría. Lo borrado nunca desaparece físicamente.' },
        { pregunta:'¿Cómo verificas la autenticidad fuerte de un sello "Mónica · 23:15"?',
          a:'Solo verificando el campo user_email en el sistema — eso es suficiente', b:'Por el conjunto de evidencia: bitácora de sesiones (login en esa hora), comunicación (Mónica reportó estar), IP, conversación directa con ella. Un solo campo no es prueba fuerte', c:'No se puede verificar en ningún caso', d:'Llamando al cliente que estaba en el restaurante ese día',
          correcta:'b', explicacion:'Autenticidad fuerte = múltiples fuentes coherentes. Un solo dato no es prueba.' },
        { pregunta:'¿Qué tipo de patrón con overrides admin es bandera?',
          a:'Cualquier override, incluso los bien documentados', b:'Override sin motivo o con motivo genérico ("override"), múltiples overrides del mismo usuario en corto tiempo, override en horario inusual', c:'Solo si ocurre en fin de semana', d:'No existen patrones de overrides que sean bandera',
          correcta:'b', explicacion:'Patrones específicos sugieren abuso del mecanismo de excepción.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: Reportes y herramientas ----------
    {
      titulo: 'Reportes y herramientas a tu disposición',
      resumen: 'Histórico de conciliaciones, exportaciones CSV, certificaciones del equipo, accesos. Cómo usar cada uno.',
      tiempo: 6,
      contenido: '## Tus herramientas principales\n\n### 1. Histórico de Conciliaciones\nDesde tu inicio, tap en "Histórico de Conciliaciones".\n\n**Qué hace**: muestra todas las conciliaciones cerradas en una tabla con KPIs.\n\n**Funciones**:\n- Filtrar por rango de fechas\n- Filtrar por estado (cerrada con banderas / cerrada sin banderas / pendiente)\n- Ver KPIs por día (ventas, cortesías, faltantes)\n- **Exportar CSV** para análisis externo (Excel, Sheets)\n- Abrir cualquier día específico (read-only)\n\n**Tu uso**:\n- Revisión semanal: tendencias\n- Revisión mensual: papel de trabajo\n- Investigación específica: cuando un hallazgo requiere ver más allá de un día\n\n### 2. Conciliación del día\nDesde tu inicio, tap en "Conciliación de caja".\n\n**Qué hace**: ver el día actual (o cualquier día abierto).\n\n**Tu uso**: revisión diaria — solo si hay banderas críticas, no es necesario hacerlo todos los días.\n\n### 3. Charolas (cocina y churrasca)\nLectura de cada captura del día.\n\n**Tu uso**: verificación cruzada cuando investigas una bandera de inventario.\n\n### 4. Inventario Churrasca\nVista de la semana Lun-Dom.\n\n**Tu uso**: revisar diferencias fórmula vs conteo físico, especialmente en cierre semanal.\n\n### 5. Recetas y costeo\nLectura de propuestas, aprobaciones y rentabilidad.\n\n**Tu uso**: verificar que el flujo Modelo B se respeta (chef propone, gerencia aprueba). Si una receta cambió sin propuesta documentada → bandera.\n\n### 6. Certificaciones (panel admin · pestaña visible para auditoría)\nLista de todos los usuarios con su estado de certificación: vigente, pendiente, bloqueado_por_intentos, vencido.\n\n**Tu uso**:\n- Verificar que el equipo está certificado\n- Detectar resets múltiples (bandera)\n- Detectar exámenes con calificaciones sospechosas (todos respondiendo igual, todos con tiempo idéntico)\n\n## Endpoints útiles del sistema\n\nSi haces análisis profundo, hay endpoints backend que puedes invocar (con tu token de auditoría):\n\n| Endpoint | Qué devuelve |\n|----------|--------------|\n| `certificaciones_list` | Estado actual de cada usuario |\n| `historico_conciliaciones_list` | Lista filtrable de cierres |\n| `recetario_reporte_rentabilidad` | Costeo recursivo de todas las recetas |\n| `examen_intentos_list` | Todos los intentos de examen (auditoría sobre el aprendizaje) |\n\nNo los necesitas usar al inicio — la pantalla web los usa por ti. Pero saber que existen te da poder analítico cuando necesitas profundizar.\n\n## Exportaciones CSV\n\nVarias pantallas ofrecen exportar CSV. Cuándo usar:\n- **Análisis cuantitativo**: tendencias mes a mes\n- **Cruce de datos**: en Excel/Sheets puedes hacer pivots y fórmulas que la UI no permite\n- **Respaldo**: para archivar antes de un cierre de período\n- **Compartir con dirección**: anexo de tu papel de trabajo mensual\n\nEl CSV es **read-only en su efecto**: aunque lo modifiques, el sistema no se actualiza con esos cambios.\n\n## Acceso al sheet base\n\nGermán te puede dar acceso de lectura al Google Sheet base (donde el sistema guarda todo). Eso te da:\n\n- Vista directa de hojas: Bitacoras, BitacoraFilas, Sellos, Conciliaciones, Charolas, Recetas, Ingredientes, Usuarios, Examenes, etc.\n- Filtros nativos de Google Sheets\n- Cruces con QUERY o filtros entre hojas\n- Acceso a columnas que la UI no muestra (timestamps internos, banderas técnicas)\n\n**Regla de oro**: solo lees. NO escribes en el sheet directamente. Si lo haces, rompes la integridad del sistema.\n\n## Frecuencia recomendada de tu trabajo\n\n| Actividad | Frecuencia |\n|-----------|------------|\n| Banderas críticas (faltantes >$5k, fraude probable) | **Inmediato** cuando detectas |\n| Revisión de conciliación del día | Diaria solo si hay banderas |\n| Inventario churrasca semanal | Lunes (cierre de semana anterior) |\n| Papel de trabajo formal | Mensual (primeros 5 días del mes siguiente) |\n| Reporte a dirección | Mensual (junto al papel de trabajo) |\n| Tendencias y propuestas estratégicas | Trimestral |\n\n## Lo que NO está disponible (todavía)\n\nFases futuras incluirán:\n- **Reporte automático de banderas** (hoy revisas manualmente)\n- **Alertas en tiempo real** por umbral de severidad\n- **Dashboard de KPIs auditables** con histórico\n\nPor ahora trabajas con las pantallas existentes + el sheet base + tus exportaciones.',
      quiz: [
        { pregunta:'¿Cuál es tu herramienta principal para análisis multi-fecha?',
          a:'Histórico de Conciliaciones — permite filtrar rangos, ver KPIs, exportar CSV y abrir cualquier día específico (read-only)', b:'Conciliación del día (que solo muestra el día en curso)', c:'Solo el Google Sheet directamente sin interfaz', d:'No hay herramienta de análisis multi-fecha en el sistema',
          correcta:'a', explicacion:'Histórico es vista PRO con filtros y export. Tu base para revisión semanal/mensual.' },
        { pregunta:'En el panel de Certificaciones, detectas que un usuario fue reseteado 4 veces en 2 meses. ¿Qué significa típicamente?',
          a:'Nada raro, los resets son parte normal del proceso de certificación', b:'Posible bandera: el reset puede estar usándose como atajo en lugar de capacitación real. Investigas quién resetea, por qué, y si hay capacitación real entre intentos', c:'Que el usuario es muy estudioso y dedicado', d:'Un error del sistema que duplica los intentos',
          correcta:'b', explicacion:'Reset es excepcional, no rutinario. Patrón = posible mal uso del mecanismo.' },
        { pregunta:'¿Cuál es la regla de oro al acceder al Google Sheet base directamente?',
          a:'Puedes modificar cualquier dato para corregir errores operativos evidentes', b:'Solo lees. NO escribes. Si modificas, rompes la integridad del sistema. Tu rol es de lectura', c:'Solo escribes los lunes con previa autorización de Germán', d:'Pides permiso a Sergio o Marcos antes de cada acceso',
          correcta:'b', explicacion:'Read-only es la regla. Cualquier escritura tuya invalida el control.' },
        { pregunta:'¿Cuál es la frecuencia recomendada para producir tu papel de trabajo formal?',
          a:'Diaria — hay que documentar cualquier bandera del día', b:'Mensual (primeros 5 días del mes siguiente), con revisión semanal de inventario churrasca y reporte a dirección mensual', c:'Anual, junto con el cierre fiscal', d:'Solo cuando alguien específico lo pide',
          correcta:'b', explicacion:'Cadencia mensual + revisiones específicas semanales. Diaria solo si hay banderas críticas.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Curso de Comprador (Weslley). Responsable de proveedores y precios. Edición inline de
// ingredientes, validación de los 297 estimados, reporte semanal de variaciones.
function modulosCursoComprador() {
  return [
    // ---------- Módulo 1: Tu rol como comprador ----------
    {
      titulo: 'Tu rol como comprador y por qué importa el costo del ingrediente',
      resumen: 'Cuidas el costo de los platillos cuidando el costo de los ingredientes. Cómo cada decisión tuya impacta la rentabilidad del restaurante.',
      tiempo: 6,
      contenido: '## Tu posición\n\nEres **el Comprador** de Fogueira. Eres responsable de:\n\n1. **Validar y mantener actualizados los precios** de todos los ingredientes\n2. **Negociar con proveedores** y reportar variaciones\n3. **Validar los 297 precios estimados** que arrancaron el sistema (📍)\n4. **Comunicarte con cocina y churrasca** sobre disponibilidad y costos\n\n## Por qué tu rol es estratégico\n\nEl costo de un platillo en Fogueira se calcula así:\n\n```\nCosto del platillo = Σ (cantidad × precio_ingrediente)\n```\n\nSi un ingrediente cambia de precio, **todos los platillos que lo usan cambian de costo**. Y si el costo sube y no actualizamos el precio del menú, el margen se va al piso.\n\nEjemplo simple:\n- Aceite oliva sube de $180/L a $250/L (+38%)\n- Una receta usa 50 ml por porción\n- Costo extra por porción: $3.50\n- Servimos 200 porciones al día → $700 diarios extra\n- Mensual: $21,000 que **no se traduce a más ingreso**\n\nSi tú detectas el cambio y lo capturas a tiempo, Mónica puede:\n- Ajustar precio del menú\n- Buscar proveedor alternativo\n- Cambiar la receta para usar menos aceite\n\n## Tu pantalla principal: 📒 Recetas y costeo\n\nDesde tu inicio, tap en "Recetas y costeo". Verás 3 tabs:\n\n| Tab | Tu uso |\n|-----|--------|\n| **Ingredientes** | TU TAB principal: catálogo de insumos, edición inline de precios |\n| **Recetas** | Lectura — entender qué recetas se afectan cuando cambias un precio |\n| **Rentabilidad** | Lectura — ver impacto de tus cambios en márgenes |\n\n## Lo que TÚ controlas\n\n- ✅ **Precios** de todos los ingredientes (editas directo)\n- ✅ **Validar estimados** (📍): cambiar de "estimado" a precio confirmado\n- ✅ **Crear ingredientes nuevos** cuando cocina/churrasca pide insumos nuevos\n- ✅ **Reporte semanal** de variaciones (qué subió, qué bajó)\n\n## Lo que NO autorizas\n\n- ❌ **No editas recetas** (eso es de Sergio/Marcos con Modelo B)\n- ❌ **No firmas cortesías**\n- ❌ **No tocas caja** ni conciliación\n- ❌ **No editas usuarios** ni configuración\n\n## Organigrama operativo\n\n```\n          Dirección (Germán)\n                 ↓\n   Gerente Administrativo (Mónica)  →  recibe tu reporte semanal\n                 ↓\n   Sergio (Cocina) y Marcos (Churrasca)  →  te avisan de ingredientes nuevos\n                 ↓\n         TÚ (Comprador · Weslley)\n                 ↓\n         Proveedores externos\n```\n\n## Tu sesión\n\nDura **hasta las 3:00 am del día siguiente**.\n\n## Distinción importante: TÚ vs el sistema POS\n\nFogueira opera con dos sistemas:\n- **Este sistema (Apps Script)**: catálogo de ingredientes y recetas para cocina, costeo, charolas\n- **SoftRestaurant POS**: sistema de cobro y operación de mesa\n\nAmbos llevan precios de ingredientes pero **es el POS quien tiene la verdad operativa de venta**. Tú trabajas en este sistema (Apps Script) para mantener el costeo de recetas. En el futuro habrá un importador automático: tú bajarás el Excel del POS con variaciones de precio y se subirá automático aquí (eso aún no existe — pendiente futuro).',
      quiz: [
        { pregunta:'¿Cuál es la responsabilidad principal del rol Comprador?',
          a:'Validar y mantener actualizados los precios de los ingredientes, negociar con proveedores, validar los 297 precios estimados (📍), reportar variaciones', b:'Cocinar junto con Sergio y Marcos', c:'Operar caja cuando la cajera falta', d:'Hacer reservas online y atender clientes en piso',
          correcta:'a', explicacion:'Tu rol es 100% sobre precios y proveedores. Sin ti, el costeo de recetas se vuelve impreciso.' },
        { pregunta:'¿Por qué es estratégico que tú actualices precios a tiempo?',
          a:'No importa demasiado si el precio está un poco desactualizado', b:'Si el aceite sube 38% y no actualizas, el costo del platillo aumenta sin reflejarse en el menú. Mónica no puede tomar decisiones (ajustar menú, cambiar proveedor, simplificar receta) si los precios están desactualizados', c:'Solo sirve para llevar orden en el catálogo', d:'Para presumir ante auditoría',
          correcta:'b', explicacion:'Tu trabajo permite a la dirección reaccionar. Precios desactualizados = margen perdido invisible.' },
        { pregunta:'¿Tú editas recetas (cantidades, ingredientes, instrucciones)?',
          a:'Sí, puedes editar todas las recetas que necesites', b:'Sí, pero solo las recetas que Mónica te asigne', c:'No. Tu rol edita PRECIOS de ingredientes. Las recetas las modifican Sergio (Cocina) o Marcos (Churrasca) con Modelo B (proponen → Mónica aprueba). Tú las ves en lectura para entender qué se afecta cuando cambias un precio', d:'Solo los lunes después de que Sergio las haya revisado',
          correcta:'c', explicacion:'Separación de funciones: precios eres tú; recetas son los chefs. Mantenes el catálogo de insumos, no las recetas.' },
        { pregunta:'¿Cuál es la pantalla del sistema que MÁS vas a usar?',
          a:'Conciliación de caja', b:'Recetas y costeo, especialmente el tab Ingredientes (donde editas precios directo)', c:'Bitácora del host', d:'Charolas de churrasca',
          correcta:'b', explicacion:'Tab Ingredientes es tu cabina de mando. Ahí pasarás la mayor parte del tiempo.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 2: Tab Ingredientes — edición inline ----------
    {
      titulo: 'Tab Ingredientes: cómo editas precios inline',
      resumen: 'Tu pantalla central. Búsqueda, edición rápida de precio, qué pasa con las recetas que usan ese ingrediente cuando cambias el precio.',
      tiempo: 7,
      contenido: '## Tu cabina de mando\n\nAbres "Recetas y costeo" → tab **Ingredientes**. Verás una tabla con todos los insumos.\n\n## Estructura de la tabla\n\nCada fila es un ingrediente. Columnas típicas:\n\n| Columna | Significa |\n|---------|-----------|\n| Nombre | Descripción del insumo (ej: "Aceite oliva extra virgen") |\n| Categoría | Grupo (proteína, lácteo, vegetal, abarrote, etc.) |\n| Unidad | kg, gr, ml, L, pza |\n| **Precio por unidad** | LO QUE TÚ EDITAS |\n| Bandera | 📍 si es estimado |\n| Notas | Marca, proveedor, lote (opcional) |\n| Recetas que lo usan | Conteo de cuántas recetas dependen de él |\n\n## Cómo editar un precio — inline\n\n### Paso 1 — Buscar el ingrediente\nUsa el buscador arriba de la tabla. Puedes filtrar por nombre, categoría, o flag estimado (📍).\n\n### Paso 2 — Tap en el campo de precio\nLa celda se vuelve editable. Capturas el nuevo precio.\n\n### Paso 3 — Si era estimado, quita el flag\nSi el ingrediente tenía 📍 (estimado) y ahora tienes precio confirmado por factura, **quita el flag**. El sistema entiende que ya es precio validado.\n\n### Paso 4 — Guardar\nTap fuera del campo o Enter. Se guarda automático.\n\n### Qué pasa después de guardar\n- El precio queda actualizado en el catálogo\n- **Todas las recetas que usan ese ingrediente** recalculan automáticamente su costo\n- El tab Rentabilidad refleja el cambio\n- Queda registro: quién editó, cuándo, valor anterior y nuevo\n\n## Importante: el cambio es INMEDIATO\n\nA diferencia de Sergio/Marcos que proponen y esperan aprobación (Modelo B), **tú editas precios directo**. Tu rol es operativo y crítico para que el costeo se mantenga al día.\n\nPero esto significa que **un error tuyo se propaga inmediato**. Si capturas $1,800 en lugar de $180, todas las recetas que usan ese ingrediente muestran un costo 10× más alto.\n\nPor eso:\n- ✅ Verifica el precio antes de capturar\n- ✅ Verifica la unidad (kg vs gr; L vs ml)\n- ✅ Si la diferencia es muy grande (>50%), **valida el dato** con la factura o el proveedor antes de capturar\n\n## Caso típico — cambio de proveedor\n\nLlega una nueva factura del proveedor de aceitunas. Antes pagabas $90/kg, ahora $108/kg (subió por temporada). Pasos:\n\n1. Buscas "Aceitunas" en el tab Ingredientes\n2. Verificas la unidad (kg, correcto)\n3. Tap en precio → cambias 90 a 108\n4. Si tenía flag 📍 → lo quitas (precio confirmado por factura)\n5. (Opcional) En notas, agregas: "Proveedor X · Factura #12345 · Mayo 2026"\n6. Guardas → enter o tap fuera\n\nResultado: las recetas que usan aceitunas (digamos 8 recetas) recalculan su costo automáticamente. Mónica puede ver el impacto en el tab Rentabilidad.\n\n## Caso típico — ingrediente nuevo\n\nSergio te avisa que va a probar una receta nueva con "queso provoleta", insumo que no existe en el catálogo.\n\n1. En el tab Ingredientes, botón **"+ Nuevo ingrediente"**\n2. Llenas:\n   - Nombre: "Queso provoleta"\n   - Categoría: Lácteo\n   - Unidad: kg\n   - Precio: lo que cuesta (si lo sabes — si no, captura estimado y marca 📍)\n   - Notas: marca, proveedor\n3. Guardas → ingrediente disponible para que Sergio lo use en su receta\n\n## Errores comunes\n\n- ❌ **Capturar precio en unidad equivocada** ($90 cuando es por gr y no por kg = 1000× error)\n- ❌ **Olvidar quitar flag 📍** después de validar el estimado\n- ❌ **Editar sin verificar diferencia grande** (>50% sin confirmar)\n- ❌ **Crear ingredientes duplicados** ("Aceite oliva" y "Aceite oliva extra virgen" como dos filas distintas cuando podrían ser la misma)\n- ❌ **Editar el nombre de un ingrediente** existente — eso confunde recetas. Si necesitas renombrar, avísale a Mónica\n\n## Tu rastro queda registrado\n\nCada edición tuya queda en auditoría:\n- Quién editó (tú · Weslley)\n- Cuándo\n- Valor anterior y nuevo\n- Si cambió flag estimado\n\nEsto te protege (si algún día se pregunta "quién subió este precio", la respuesta tiene fecha y motivo) y permite a Mónica/Auditoría revisar tendencias.',
      quiz: [
        { pregunta:'¿Tu edición de precio en el tab Ingredientes es inmediata o es propuesta?',
          a:'Es INMEDIATA. A diferencia de Sergio/Marcos (Modelo B), tú editas precios directo. El cambio se propaga al instante a todas las recetas que usan ese ingrediente', b:'Es propuesta que Mónica aprueba igual que Sergio/Marcos', c:'Solo los lunes tiene efecto inmediato', d:'Mónica debe aprobar cualquier cambio de precio',
          correcta:'a', explicacion:'Inmediato = tu poder operativo. También significa que tu error se propaga al instante: verifica antes de capturar.' },
        { pregunta:'¿Qué pasa con las recetas cuando cambias el precio de un ingrediente?',
          a:'Nada, las recetas tienen precio fijo', b:'Todas las recetas que usan ese ingrediente recalculan automáticamente su costo. El tab Rentabilidad refleja el cambio', c:'Solo las recetas nuevas recalculan', d:'Hay que recalcular manualmente cada receta afectada',
          correcta:'b', explicacion:'Sistema reactivo: cambio de precio de insumo = recálculo automático de todas las recetas dependientes.' },
        { pregunta:'¿Cuándo quitas el flag 📍 (estimado) de un ingrediente?',
          a:'Nunca hay que quitarlo, queda ahí para referencia', b:'Cuando ya tienes el precio confirmado por factura o proveedor real (lo dejas de "estimado"). Esto le dice al sistema que el costo de ese ingrediente ya es preciso, no aproximado', c:'Cada lunes como rutina de limpieza', d:'Solo si Mónica lo pide expresamente',
          correcta:'b', explicacion:'Quitar 📍 = precio validado contra factura. Una de tus tareas core: ir reduciendo los 297 estimados conforme validas.' },
        { pregunta:'Sergio te dice que necesita "queso provoleta" que no existe en el catálogo. ¿Qué haces?',
          a:'Le dices que no es tu rol crear ingredientes', b:'Le pides a Mónica que lo cree desde el panel admin', c:'Le dices que use otro ingrediente que sí existe', d:'En el tab Ingredientes, botón "+ Nuevo ingrediente", llenas nombre, categoría, unidad y precio (estimado si no lo sabes con factura todavía). Queda disponible para que Sergio lo use en su receta',
          correcta:'d', explicacion:'Crear ingredientes nuevos es tu rol. Sergio propone usar el insumo en una receta, pero tú lo das de alta en el catálogo.' },
        { pregunta:'Capturas un precio y al momento te das cuenta que pusiste $1,800 cuando era $180 (un cero de más). ¿Qué pasa?',
          a:'Nada grave, se corregirá en el siguiente reporte semanal', b:'El error se propaga inmediato a todas las recetas que usan ese ingrediente. Las verás 10× más caras en Rentabilidad. Lo corriges de inmediato (queda en auditoría) y revisas el tab Rentabilidad para confirmar que regresó a normal', c:'El sistema detecta el error y lo cancela solo', d:'No se puede corregir — hay que pedirle a Germán que lo revierta',
          correcta:'b', explicacion:'Inmediato = error inmediato. Corregir rápido y verificar es la forma de contenerlo. Por eso "verifica antes de capturar" es regla.' }
      ],
      minAprobatorio: 5
    },
    // ---------- Módulo 3: Validar los 297 estimados ----------
    {
      titulo: 'Validar los 297 precios estimados (📍)',
      resumen: 'Por qué hay tantos estimados, cómo priorizar cuáles validar primero, y qué hacer cuando un estimado resulta muy distinto del precio real.',
      tiempo: 6,
      contenido: '## Por qué hay 297 estimados\n\nCuando arrancamos el sistema con el recetario inicial, **muchos precios se pusieron de forma aproximada** porque:\n- No había factura disponible al momento\n- El precio dependía de proveedor variable\n- Era ingrediente raro/de uso ocasional\n- Faltaba acordar con el proveedor\n\nLos 297 ingredientes con flag 📍 son el "trabajo pendiente" del catálogo. **Tu misión es ir reduciendo ese número** validándolos contra factura real.\n\nNo es urgente hacerlo todo en una semana. Es un trabajo de fondo, mientras haces el día a día. Idealmente: validas 10-20 por semana → en ~6 meses están todos.\n\n## Cómo priorizar\n\nNo todos los 297 tienen el mismo impacto. Prioriza por:\n\n### Criterio 1 — Volumen de uso\nIngredientes que aparecen en **muchas recetas** y **muchas porciones diarias** afectan más al costo total. Ejemplos típicos:\n- Aceite (uso muy alto)\n- Sal (alto)\n- Cebolla, ajo, jitomate (alto)\n- Especias raras (bajo)\n\nFiltro útil en el tab Ingredientes: **ordenar por "Recetas que lo usan"** (descendente). Primero los que aparecen en más recetas.\n\n### Criterio 2 — Precio relativo\nIngredientes **caros** mueven más el costo cuando se descalibran:\n- Carnes premium (ribeye, picaña)\n- Aceite oliva extra virgen\n- Quesos especiales\n- Mariscos\n\nVs ingredientes baratos (sal, aceite común) cuyo error de precio impacta poco.\n\n### Criterio 3 — Volatilidad\nAlgunos precios cambian mucho con la temporada o el proveedor:\n- Verduras de temporada (jitomate, aguacate)\n- Mariscos (camarón, pulpo)\n- Algunos cortes de carne\n\nEsos vale la pena revalidarlos cada 2-3 meses, no solo una vez.\n\n## Proceso de validación\n\n### Paso 1 — Tomar el ingrediente y buscar factura real\n- Revisa facturas recientes del proveedor\n- Si no tienes factura, llama y pregunta precio actual\n- Si el insumo se compró hace mucho, considera pedir cotización fresca\n\n### Paso 2 — Comparar con el estimado actual\nQué tan diferente es el precio real del estimado:\n- Diferencia <10% → era buen estimado, lo cambias y quitas el flag\n- Diferencia 10-30% → estimado decente, ajustas\n- Diferencia >30% → estimado muy malo. **Avísale a Mónica** porque puede haber recetas con costo muy mal calculado durante meses\n\n### Paso 3 — Capturar el precio real\nEn el tab Ingredientes:\n- Editas el precio inline\n- Quitas el flag 📍\n- En notas, opcionalmente: "Validado contra factura · Proveedor X · Mayo 2026"\n\n### Paso 4 — Verificar impacto\n- Tab Rentabilidad: revisa si las recetas que usan ese ingrediente cambiaron mucho su costo\n- Si alguna receta cambió >20% → coméntale a Sergio o Marcos para que sepan\n\n## Caso especial — el precio cambió mucho\n\nSi descubres que un ingrediente está estimado en $50/kg pero el precio real es $150/kg (3x), pasa esto:\n- Las recetas que lo usaban estaban subestimadas hasta 3× el costo\n- Recetas que parecían rentables tal vez no lo son\n- Mónica necesita saberlo **inmediatamente** para ajustar precios de menú o reformular recetas\n\nProtocolo:\n1. Captura el precio real en el sistema\n2. Manda WhatsApp a Mónica: "Wesley aviso: ingrediente X estaba mal estimado (de $50 a $150/kg). Recetas afectadas: [lista]. Costo de [receta principal] subió de $40 a $90 por porción"\n3. Mónica decide acción\n\n## Cómo NO validar\n\n- ❌ **Validar al ojo sin factura** (defeats the purpose — sigue siendo estimado)\n- ❌ **Quitar el flag 📍 sin actualizar precio** (peor: dice que es validado pero no lo es)\n- ❌ **Validar todos rápido sin verificar** (errores se acumulan)\n- ❌ **No avisar a Mónica** cuando un estimado era muy malo\n\n## Tu progreso\n\nLleva tu propio registro (Excel personal o nota) de cuántos has validado por semana/mes. Sirve para:\n- Ver tu avance hacia 0 estimados\n- Reportar a Mónica en tu reporte semanal\n- Identificar bloqueos (ingredientes que no logras validar — Mónica te puede ayudar a contactar al proveedor)',
      quiz: [
        { pregunta:'¿Cuál es el criterio MÁS importante para priorizar qué estimados validar primero?',
          a:'Orden alfabético del nombre del ingrediente', b:'Combinación de volumen de uso (recetas que lo usan, porciones diarias), precio relativo (caros mueven más) y volatilidad (precios que cambian seguido)', c:'Por color del ingrediente en el catálogo', d:'Aleatorio — cualquier orden funciona igual',
          correcta:'b', explicacion:'Impacto = volumen × precio. Esos validados primero dan máximo retorno.' },
        { pregunta:'Validas un ingrediente y descubres que el precio real es 3× lo estimado ($150 vs $50). ¿Qué haces?',
          a:'Capturas el precio real, quitas flag 📍, y avisas a Mónica de inmediato porque las recetas que lo usaban estaban con costo muy subestimado y puede afectar decisiones de menú/recetas', b:'Lo cambias en silencio sin avisarle a nadie para no generar alarma', c:'No lo cambias — dejas el estimado para no afectar los costos actuales', d:'Esperas al fin de mes para incluirlo en el reporte',
          correcta:'a', explicacion:'Diferencia >30% es señal de mal estimado severo. Mónica necesita reaccionar (ajustar menú, reformular).' },
        { pregunta:'¿Cuál es el ritmo razonable para ir validando los 297 estimados?',
          a:'Todo en una semana para terminar rápido', b:'10-20 por semana, en paralelo al día a día. En ~6 meses se completan todos. No es urgente sino constante', c:'No validarlos — los estimados son suficientemente buenos', d:'Solo cuando alguien específico lo pide',
          correcta:'b', explicacion:'Trabajo de fondo constante. Apretar todo de un jalón no es realista; abandonar tampoco.' },
        { pregunta:'¿Qué NO debes hacer al validar estimados?',
          a:'Verificar el precio contra una factura real del proveedor', b:'Validar al ojo sin factura, quitar el flag 📍 sin actualizar el precio, validar todos rápido sin verificar, no avisar a Mónica cuando un estimado era muy malo', c:'Capturar el precio real después de revisar la factura', d:'Avisar a Mónica cuando hay diferencia mayor al 30%',
          correcta:'b', explicacion:'Esos atajos invalidan el proceso. La validación tiene sentido solo si es real (con factura/proveedor) y se comunica.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 4: Reporte semanal de variaciones ----------
    {
      titulo: 'Reporte semanal de variaciones',
      resumen: 'Cada semana entregas a Mónica un resumen: qué precios subieron, qué bajaron, qué nuevos ingredientes, qué se está negociando.',
      tiempo: 5,
      contenido: '## Por qué un reporte semanal\n\nMónica necesita una visión consolidada de **lo que está pasando con costos esta semana**. Sin reporte tuyo, ella tendría que entrar al sistema y revisar 800 ingredientes para detectar cambios — no es práctico.\n\nTu reporte es **el pulso de costos** del restaurante.\n\n## Qué incluye el reporte\n\n### 1. Resumen ejecutivo (1 párrafo)\nEjemplo: "Esta semana se actualizaron 23 precios. 5 subidas notables (>10%), 2 bajadas. 8 estimados validados. 3 ingredientes nuevos dados de alta. 2 negociaciones en curso."\n\n### 2. Tabla — Subidas notables (>10%)\n| Ingrediente | Precio anterior | Precio nuevo | Variación | Recetas afectadas | Acción sugerida |\n|-------------|-----------------|--------------|-----------|-------------------|-----------------|\n| Aceite oliva extra virgen | $180/L | $210/L | +17% | 12 recetas | Considerar alternar con aceite oliva común en algunas recetas |\n| Camarón | $320/kg | $380/kg | +19% | 4 recetas | Evaluar ajustar precio de menú o reducir porción |\n\n### 3. Tabla — Bajadas notables (>5%)\nMisma estructura. Bajadas son buenas noticias: ahorra costo.\n\n### 4. Estimados validados esta semana\nCuántos eran 📍 y ya no lo son. Lista con destacados (los que tuvieron >30% de diferencia con su estimado).\n\n### 5. Ingredientes nuevos\nAltas hechas esta semana, con motivo (ej: "Queso provoleta — pedido por Sergio para receta nueva XYZ").\n\n### 6. Negociaciones en curso\nProveedores con los que estás negociando y estado:\n- "Proveedor X — pedimos cotización por costilla fresca, esperando respuesta"\n- "Proveedor Y — bajada del 8% confirmada para junio si compramos volumen mensual"\n\n### 7. Riesgos y observaciones\n- Insumos con riesgo de subida (temporada, escasez)\n- Proveedores que no responden\n- Cualquier alerta que Mónica deba conocer\n\n## Cuándo entregarlo\n\n- **Ideal**: lunes por la mañana (cubre la semana anterior)\n- **Formato**: WhatsApp + correo con el reporte adjunto, o documento compartido en Drive\n- **Length**: 1-2 páginas. NO es un documento académico — es un brief operativo\n\n## Frecuencia variable\n\n- **Semanal**: el caso normal\n- **Quincenal**: si una semana hubo muy pocos cambios (típico fin de mes/quincenas calmadas)\n- **Inmediato (no semanal)**: cuando hay un cambio grande (ej: subida >30% en ingrediente importante) — en ese caso WhatsApp directo, sin esperar al lunes\n\n## Plantilla — empezar simple\n\nPrimera versión, no tienes que perfeccionarla:\n\n```\nREPORTE COMPRAS · Semana 2026-04-28 a 2026-05-04\nWeslley · Comprador\n\nResumen: 23 precios actualizados. 5 subidas, 2 bajadas, 8 estimados validados, 3 nuevos ingredientes.\n\nSUBIDAS NOTABLES (>10%):\n- Aceite oliva extra virgen: $180 → $210 (+17%) — 12 recetas afectadas\n- Camarón: $320 → $380 (+19%) — 4 recetas afectadas\n\nBAJADAS:\n- Jitomate: $32 → $26 (-19%) — temporada\n\nESTIMADOS VALIDADOS: 8\nDestacado: Pasta de chile guajillo estaba en $80/kg estimado → real $145 (+81%). Receta "Pasta base" pasó de $35 a $52 por porción.\n\nINGREDIENTES NUEVOS:\n- Queso provoleta — Sergio · receta nueva\n- Pulpo fresco — Sergio · receta de prueba\n- Vinagre balsámico añejo — Marcos · marinada nueva\n\nNEGOCIACIONES:\n- Proveedor de aceite: pedida cotización alternativa, esperando\n- Proveedor de carne: bajada 5% en costilla si compra mensual >50kg\n\nOBSERVACIONES:\n- Riesgo: jitomate subirá probablemente en mayo por fin de temporada\n- Camarón puede seguir subiendo (Pacífico bajo)\n```\n\n## Por qué importa\n\nMónica usa tu reporte para:\n- Decidir si ajustar precios de menú\n- Decidir si simplificar recetas (Sergio/Marcos)\n- Decidir cambio de proveedor\n- Reportar a Germán tendencias mensuales\n- Anticipar problemas (riesgos)\n\nUn reporte semanal bien hecho es **un acto de inteligencia operativa**. Convierte 800 cambios potenciales de precio en 5 líneas claras que la dirección puede actuar.\n\n## Lo que NO funciona\n\n- ❌ **Reporte sin números** ("hubo cambios esta semana") — sin variación %, sin recetas afectadas, no sirve\n- ❌ **Reporte demasiado largo** (>3 páginas) — Mónica no tiene tiempo\n- ❌ **Sin destacar lo importante** — burry the lede: si hubo subida del 30% en algo crítico, tiene que estar al inicio\n- ❌ **Sin acción sugerida** — no es solo dato, es propuesta',
      quiz: [
        { pregunta:'¿Por qué Mónica necesita un reporte semanal tuyo en vez de revisar el sistema directamente?',
          a:'No tiene acceso al sistema de recetas y costeo', b:'Sin tu reporte tendría que revisar 800 ingredientes para detectar cambios — no es práctico. Tu reporte es la visión consolidada de "qué está pasando con costos esta semana"', c:'Por reglas legales de separación de funciones', d:'Para presumir ante el comité directivo',
          correcta:'b', explicacion:'Reporte = visión consolidada. Inteligencia operativa que la dirección puede actuar.' },
        { pregunta:'¿Cuándo NO debes esperar al reporte semanal y avisar inmediato?',
          a:'Nunca — siempre esperas al reporte del lunes', b:'Cuando hay un cambio grande (ej: subida >30% en un ingrediente importante o bajada equivalente). En ese caso WhatsApp directo a Mónica sin esperar al lunes', c:'Solo si Mónica te pregunta directamente', d:'Cada cambio individual aunque sea pequeño',
          correcta:'b', explicacion:'Materialidad del cambio define urgencia. Cambios chicos esperan al reporte; grandes son inmediatos.' },
        { pregunta:'¿Qué información NO debe faltar en cada subida/bajada notable del reporte?',
          a:'Precio anterior, precio nuevo, variación % y recetas afectadas (al menos cuántas, idealmente cuáles). Idealmente también acción sugerida', b:'Solo el nombre del ingrediente que cambió', c:'Solo el ingrediente y el nuevo precio', d:'Solo la fecha del cambio y el proveedor',
          correcta:'a', explicacion:'Sin esos datos, Mónica no puede tomar decisión. El reporte tiene que ser actuable.' },
        { pregunta:'¿Qué longitud razonable tiene el reporte semanal?',
          a:'10 páginas con análisis detallado de cada ingrediente', b:'1-2 páginas. No es documento académico, es brief operativo. Lo importante es que destaque lo crítico al inicio (subidas grandes, alertas)', c:'Una sola línea de resumen', d:'No tiene límite, mientras más completo mejor',
          correcta:'b', explicacion:'Brief operativo: corto, claro, accionable. Mónica no tiene tiempo de leer 10 páginas semanales.' }
      ],
      minAprobatorio: 4
    },
    // ---------- Módulo 5: Importar SR12 ----------
    {
      titulo: 'Importar SR12: actualización masiva de precios desde el POS',
      resumen: 'Cómo subir los archivos de SoftRestaurant para actualizar los costos de 300+ ingredientes en minutos. Cuándo hacerlo, cómo revisar el preview y qué hacer con los huérfanos.',
      tiempo: 8,
      contenido: '## Esta herramienta ya existe — y tú tienes acceso\n\nDesde tu pantalla de inicio, tile **"📥 Importar SR12"**. Úsala cuando el POS tenga costos actualizados y quieras propagarlos masivamente al sistema de recetas.\n\n## Por qué existe esta herramienta\n\nFogueira opera con dos sistemas:\n- **SoftRestaurant (POS)**: el sistema de cobro y almacén físico. Aquí se registran todas las compras a proveedores, por lo que sus costos son los **más frescos y reales**.\n- **Este sistema (Fogueira)**: costeo de recetas, charolas, inventario de churrasca.\n\nSin el importador, tendrías que actualizar los costos de 500+ ingredientes uno por uno — varios días de trabajo. Con el importador: subes 6 archivos, revisas el preview y aplicas en 10 minutos.\n\n## Los archivos XLS\n\nSoftRestaurant genera un reporte de existencias en varios archivos XLS (`EXISTENCIAS1.XLS`, `EXISTENCIAS2.XLS`, etc.). Son los archivos que Saúl o Elías (IT) exportan del POS. **Pídelos a IT cada vez que vayas a importar.**\n\nNo son "archivos de compras" — son el catálogo de ingredientes con existencias y costos actuales del almacén SR12.\n\n## Pasos de la importación\n\n### Paso 1 — Abrir la pantalla\nInicio → tile "📥 Importar SR12"\n\n### Paso 2 — Arrastra los archivos XLS\nArrastra todos los archivos de golpe al área de carga, o usa el botón "Seleccionar archivos".\n\n### Paso 3 — Ver el DRY RUN (preview)\nAntes de aplicar nada, el sistema te muestra exactamente qué va a pasar:\n\n| Columna | Qué significa |\n|---------|---------------|\n| Ingrediente | Nombre en Fogueira ↔ nombre en SR12 |\n| Costo actual | Lo que tiene Fogueira ahora |\n| Costo SR12 | Lo que tiene el POS |\n| Variación | % de cambio |\n| Acción | Actualizar / Crear nuevo / Divergencia grande |\n\n**Revisa el preview antes de aplicar.** Si ves algo raro (ej: un ingrediente que bajó 80% o subió 200%), investiga antes de confirmar.\n\n### Paso 4 — Revisar divergencias grandes (>50%)\nEl sistema marca en amarillo/rojo los ingredientes donde el precio del SR12 difiere más del 50% del precio actual en Fogueira. Puede significar:\n- El precio del proveedor cambió drásticamente (real)\n- Error de captura en el POS (falso positivo)\n- Unidades distintas (ej: el POS tiene precio por gramo y Fogueira por kg)\n\n### Paso 5 — Aplicar\nSi el preview se ve bien, botón "✅ Aplicar importación". El sistema actualiza masivamente el `ultimo_costo` de cada ingrediente que haya matcheado.\n\n## Cómo funciona el matching\n\nEl sistema intenta ligar cada ingrediente del SR12 con el ingrediente correspondiente en Fogueira:\n\n1. Si ya hay un vínculo previo guardado (de una importación anterior)\n2. Por nombre exacto normalizado\n3. Por similitud de palabras (ej: "Aceite de oliva extra virgen" ↔ "Aceite oliva EV")\n\n**No todos van a matchear.** Los que no encuentran pareja se llaman **huérfanos**.\n\n## Los huérfanos — qué hacer\n\nLa pantalla muestra la lista de huérfanos al final del preview. Puedes:\n- **Ignorarlos** si son sub-recetas o artículos internos que no existen en el POS\n- **Vincularlos manualmente** usando el dropdown que aparece junto a cada huérfano\n- El vínculo queda guardado para la próxima importación (ya no tendrás que buscarlo)\n\n## Cuándo importar\n\n| Situación | Frecuencia sugerida |\n|-----------|--------------------|\n| Operación normal | Quincenal o mensual |\n| Volatilidad alta (mariscos, carne, temporada) | Semanal |\n| Después de negociación con proveedor | Inmediato |\n| Antes de que Mónica revise rentabilidad del mes | Siempre antes |\n\n## Qué cambia después de importar\n\n- El campo `ultimo_costo` de cada ingrediente se actualiza al precio del SR12\n- Las recetas recalculan su costo automáticamente\n- El tab Rentabilidad refleja los nuevos márgenes\n- Queda un log con fecha, quién lo hizo y resumen de cambios\n\n## Reversión (solo admin/gerente)\n\nSi después de aplicar detectas un error grave, **solo admin o Mónica pueden revertir** desde la misma pantalla. Tú puedes ver el historial de importaciones pero no puedes revertirlas — es control interno.\n\n## Resumen del flujo\n\n```\nIT (Saúl/Elías) exporta los XLS del POS\n         ↓\nTÚ los arrastras a "📥 Importar SR12"\n         ↓\nRevisas el dry-run (divergencias, huérfanos)\n         ↓\nVinculas manualmente los huérfanos que apliquen\n         ↓\nAplicas → los costos del POS llegan a Fogueira\n         ↓\nMónica ve rentabilidad actualizada\n```',
      quiz: [
        { pregunta:'¿Qué actualiza la importación SR12 en Fogueira?',
          a:'Las recetas completas con nuevos ingredientes y cantidades', b:'El campo ultimo_costo de cada ingrediente que matcheó con el POS. Las recetas recalculan su costo automáticamente a partir de eso', c:'Solo los ingredientes huérfanos sin pareja', d:'Los precios del menú que ve el cliente',
          correcta:'b', explicacion:'La importación actualiza costos de insumos, no recetas. El recálculo de recetas es automático como consecuencia.' },
        { pregunta:'¿Qué es el dry-run y por qué es importante revisarlo?',
          a:'Es un preview que muestra exactamente qué va a cambiar (ingrediente, costo actual vs SR12, variación %) ANTES de aplicar nada. Detectas divergencias raras antes de que se propaguen a recetas', b:'Es el log final que se genera después de aplicar la importación', c:'Es opcional — puedes saltarte el dry-run si tienes prisa', d:'Solo lo ve Germán como admin del sistema',
          correcta:'a', explicacion:'Dry-run = red de seguridad. No apliques sin revisarlo.' },
        { pregunta:'Un ingrediente en el dry-run aparece con variación de +180%. ¿Qué haces?',
          a:'Aplicas directo — el SR12 tiene los precios más frescos', b:'Lo ignoras — seguramente es un ingrediente poco importante', c:'Lo investigas antes de aplicar: puede ser un cambio de precio real, error de captura en el POS, o diferencia de unidades (kg vs gr). Si no se explica, consúltale a IT o a Mónica', d:'Lo eliminas del sistema Fogueira para evitar el conflicto',
          correcta:'c', explicacion:'Variación >50% es señal de alerta. Puede ser real o error. Verifica antes de propagar.' },
        { pregunta:'¿Qué son los "huérfanos" en la importación?',
          a:'Ingredientes que el sistema eliminó durante la importación', b:'Ingredientes del SR12 que el sistema no pudo ligar automáticamente a un ingrediente Fogueira. Puedes vincularlos manualmente — el vínculo queda guardado para importaciones futuras', c:'Errores del sistema que se reportan a Germán', d:'Ingredientes nuevos que SR12 crea automáticamente en Fogueira',
          correcta:'b', explicacion:'Huérfanos = sin pareja. Vincularlos manualmente mejora el matching de la próxima importación.' },
        { pregunta:'¿Con qué frecuencia deberías importar SR12 en operación normal?',
          a:'Cada hora para mantener costos al día', b:'Quincenal o mensual en operación normal; semanal cuando hay volatilidad alta; inmediato después de negociaciones importantes; siempre antes de que Mónica revise rentabilidad del mes', c:'Una sola vez al arrancar el sistema', d:'Solo Germán como admin puede decidir cuándo importar',
          correcta:'b', explicacion:'Frecuencia depende de qué tan rápido cambian los precios. Tú juzgas según el contexto.' }
      ],
      minAprobatorio: 5
    },
    // ====================================================================
    // CURSO ESPECIALIZADO — Mejores Prácticas de Compras Corporativas (México)
    // ====================================================================
    // Módulo 6: Comprador profesional, rol estratégico y ética
    {
      titulo: '🎓 Compras corporativas (1/5): el comprador profesional, rol estratégico y ética',
      resumen: 'Diferencia entre comprador transaccional y estratégico. Las 5 R de las compras. Triple objetivo: ahorro, calidad, riesgo. Ética, regalos, conflicto de interés, separación de funciones.',
      tiempo: 12,
      contenido: '## Bienvenido al curso de compras corporativas\n\nLos primeros 5 módulos de tu curso fueron sobre tu día a día operativo en Fogueira (precios, estimados, reporte semanal). Estos siguientes 5 son distintos: son sobre **el oficio** de comprador corporativo en México.\n\nLo que aprendes aquí aplica en cualquier empresa, restaurante, hotel u operación que compre insumos. Es la base profesional que te separa de un "comprador improvisado".\n\nEl autor de estos módulos: imagina a un Director de Compras con 20 años en restaurantes, hoteles y manufactura mexicana hablándote directo. Sin teoría académica — historias reales, errores costosos y lo que sí funciona.\n\n## Comprador transaccional vs comprador estratégico\n\n| | Transaccional | Estratégico |\n|---|---|---|\n| **Mentalidad** | "Procesa el pedido" | "Optimiza el costo total" |\n| **Foco** | Ejecutar la solicitud | Anticipar necesidades, negociar, mitigar riesgo |\n| **Métrica** | # de órdenes procesadas | Ahorro, OTIF, calidad, riesgo |\n| **Relación con proveedor** | Reactiva | Construye alianzas y backups |\n| **Salario MX (2026)** | $12-20k/mes | $35-80k+/mes |\n\nMuchas empresas mexicanas chicas confunden los dos roles y contratan al primero pensando que están comprando al segundo. Tú quieres ser el segundo.\n\n## Las 5 R clásicas de las compras\n\nUn comprador profesional asegura que cada compra cumpla las 5 R:\n\n1. **Right product** — el producto correcto (especificación exacta)\n2. **Right quality** — la calidad correcta (no más, no menos de la requerida)\n3. **Right quantity** — la cantidad correcta (sin sobrestock ni roturas)\n4. **Right time** — en el momento correcto (sin retrasos, sin exceso de inventario)\n5. **Right price** — al precio correcto (no necesariamente el más barato — ya verás)\n\nFalla cualquiera y la compra costó más de lo que parece.\n\nEjemplo Fogueira: si compras picaña de buena calidad, al precio correcto, pero llega 1 día tarde porque tu proveedor no es confiable → la compra falló en "Right time" y te costó: la cocina compró al menudeo a precio de pánico.\n\n## El triple objetivo del comprador\n\nTodo comprador profesional tiene 3 objetivos en tensión que debe equilibrar:\n\n### 1. AHORRO\nReducir el costo total de adquisición. No solo el precio unitario.\n\n### 2. CALIDAD\nMantener o mejorar la calidad del insumo. Un ahorro que destruye calidad no es ahorro — es mover el problema a otro lado (Sergio se queja, los clientes se quejan, el menú baja de prestigio).\n\n### 3. RIESGO\nEvitar interrupciones de suministro y riesgo financiero/operativo del proveedor. Un proveedor barato pero quebrando es un riesgo enorme.\n\n**Las decisiones difíciles surgen cuando los 3 chocan**. Ejemplo: el proveedor más barato (ahorro) tiene calidad inconsistente (calidad ↓) y reportes financieros débiles (riesgo ↑). ¿Vas con él? Esa es la pregunta del oficio.\n\n## Ética: la línea que no se cruza\n\nEsta es la sección más importante de TODO el curso. Sin ética, todo lo demás se vuelve fraude disfrazado.\n\n### Regalos y atenciones\n\nLos proveedores te van a regalar cosas. Pequeñas, grandes, navideñas, "para tu familia", "ya que te aprecio". Es parte de la cultura comercial mexicana.\n\n**Política sugerida (alineada con prácticas corporativas estándar)**:\n- Regalos institucionales bajo $500 MXN (calendario, pluma, agenda) → aceptables, se reportan a Mónica\n- Regalos personales >$500 (botella de vino, canasta navideña) → se reportan a Mónica antes de aceptar; si los aceptas se entregan a la empresa, no a casa\n- Regalos en efectivo, gift cards de monto significativo, viajes pagados, electrónica → **NO se aceptan jamás**. Son sobornos disfrazados\n\nLa regla mental: si tu regalo no lo aceptarías delante de Mónica y Germán, no lo aceptes en privado.\n\n### Comisiones (kickbacks)\n\nUn proveedor te ofrece "una comisión personal del 2% por cada compra" si lo eliges. Esto es:\n- Robo a tu empresa (sale de tu margen)\n- Delito (cohecho entre particulares, art. 218 Código Penal Federal)\n- Causa de despido inmediato sin liquidación (justa causa LFT art. 47)\n- En empresas grandes, denuncia penal\n\nResponde así: "No acepto comisiones personales. Si tu costo permite el 2% de descuento, aplícalo en factura". Y reporta el ofrecimiento a Mónica de inmediato (correo escrito, no verbal).\n\n### Conflicto de interés\n\nSi tienes parentesco o amistad cercana con un proveedor (familiar, expareja, amigo de toda la vida), **declaralo POR ESCRITO** a Mónica antes de iniciar cualquier proceso de cotización con esa empresa.\n\nNo es que no puedas comprarles. Es que la decisión NO la tomas tú solo — Mónica la valida. Y lo declarado por escrito es tu protección.\n\nEjemplo: tu primo tiene una distribuidora de carnes. Le quieres dar oportunidad. Está bien. Pero declaras: "Conflicto de interés: el proveedor X es mi primo Juan Pérez. Solicito que la decisión final de adjudicación la tome Mónica con base en las 3 cotizaciones objetivas".\n\nResultado: trabajas tranquilo, Mónica decide informada, tú quedas limpio.\n\n## Separación de funciones — el principio rector\n\nPrincipio fundamental de control interno corporativo: **ninguna persona controla un proceso completo de principio a fin**.\n\n### Las 3 manos de toda compra\n\n1. **Quien COTIZA y propone proveedor**: TÚ (comprador)\n2. **Quien AUTORIZA el pago**: Mónica (Gerente Administrativo)\n3. **Quien RECIBE la mercancía y firma evidencia**: cocina o churrasca\n\nSi una sola persona hace 2+ de esas funciones, hay riesgo de fraude:\n- Si tú cotizas Y autorizas pago: puedes pagar facturas inventadas\n- Si tú cotizas Y recibes: puedes recibir menos de lo facturado y quedarte la diferencia\n- Si tú haces las 3: tienes carta blanca para defraudar\n\nPor eso en Fogueira el sistema obliga 3 manos. No es burocracia — es **tu protección laboral** también: si nunca tienes acceso al pago ni al recibimiento, nadie puede acusarte de robo.\n\n### Excepciones reales\n\nEn empresas chicas a veces 1 persona hace 2 roles por necesidad (no hay quien). En esos casos, **la excepción se documenta y se compensa**:\n- Auditoría revisa con frecuencia\n- Se pide aprobación cruzada (alguien más firma cada compra)\n- Se rota el rol cada cierto tiempo\n\nNo es ideal pero es manejable si está documentado.\n\n## Caso real — el comprador que se hizo "amigo del proveedor"\n\nUn restaurante mediano del Pacífico mexicano (no Fogueira). El comprador llevaba 8 años. Excelente, todos lo querían. Eficiente.\n\nTenía 1 proveedor de mariscos al que le compraba el 90% del consumo. "Es el mejor", decía.\n\nUna auditoría externa descubrió:\n- 3 años sin solicitar cotizaciones alternativas\n- Precios 18% por encima del promedio del mercado\n- El comprador recibía depósitos mensuales de la esposa del proveedor "por consultoría"\n- Total estimado del fraude: $2.4M MXN en 3 años\n\nResultado: despido sin liquidación + denuncia penal + el comprador no volvió a conseguir empleo en el sector.\n\n¿La lección? El comprador no se "volvió malo de la nada". Empezó aceptando regalos navideños, después pagos pequeños "por orientación", después comisiones permanentes. Es una **pendiente resbaladiza**. Por eso la línea se traza temprano y no se cruza nunca.\n\n## Tu protección como comprador\n\nLa ética NO es solo ética. Es **tu protección laboral**:\n- Documenta todo (correos, no WhatsApp para decisiones importantes)\n- Pide siempre 3 cotizaciones\n- Si te ofrecen algo cuestionable, repórtalo por escrito antes de que alguien malinterprete\n- No mezcles relaciones personales con compras sin declarar\n- Conserva facturas y evidencia (el comprador siempre es el primer sospechoso si algo sale mal)\n\nUn comprador profesional es **paranoico ético**. Y eso lo hace dormir tranquilo.',
      quiz: [
        { pregunta:'¿Cuál es la diferencia clave entre un comprador transaccional y uno estratégico?',
          a:'El transaccional procesa pedidos según se le pidan; el estratégico anticipa, negocia, optimiza el costo total y mitiga riesgo. Su métrica es ahorro/OTIF/calidad/riesgo, no número de órdenes', b:'Solo el sueldo — hacen lo mismo pero uno gana más', c:'No hay diferencia práctica en un restaurante', d:'El estratégico solo trabaja de lunes a miércoles',
          correcta:'a', explicacion:'El estratégico genera valor; el transaccional ejecuta tareas. La empresa que confunde los dos sub-paga al rol estratégico.' },
        { pregunta:'Las 5 R de las compras son:',
          a:'Rápido, recio, rojo, raro, rico', b:'Right product, Right quality, Right quantity, Right time, Right price (producto correcto, calidad correcta, cantidad correcta, tiempo correcto y precio correcto)', c:'Solo el precio importa; las otras R son secundarias', d:'Solo aplica en empresas de exportación',
          correcta:'b', explicacion:'Falla cualquiera de las 5 y la compra costó más de lo que parece. Ejemplo: precio bajo pero entrega tardía = compra fallida.' },
        { pregunta:'Un proveedor te ofrece una comisión personal del 2% por cada compra que le adjudiques. ¿Qué haces?',
          a:'La aceptas si nadie se entera — es costumbre del sector', b:'Le respondes que no aceptas comisiones personales y le pides que aplique ese 2% como descuento en la factura. Reportas por escrito a Mónica el mismo día', c:'La aceptas si el monto es chico y no es recurrente', d:'La dejas pasar sin decir nada para no tensionar la relación',
          correcta:'b', explicacion:'Es cohecho entre particulares (delito federal) + causa de despido inmediato sin liquidación. Reportarlo por escrito te protege; aceptarlo te destruye laboralmente.' },
        { pregunta:'Tu primo tiene una distribuidora de carnes y quieres incluirlo entre las cotizaciones. ¿Cuál es la práctica correcta?',
          a:'No incluirlo nunca para evitar cualquier apariencia de conflicto', b:'Incluirlo directamente y darle el contrato si ofrece buen precio', c:'Declararlo POR ESCRITO a Mónica como conflicto de interés antes de iniciar la cotización, y pedir que ella tome la decisión final de adjudicación con base en las 3 cotizaciones objetivas', d:'Mentir en el expediente y decir que no es tu primo',
          correcta:'c', explicacion:'Declararlo por escrito te protege y permite competencia limpia. Si gana por mejor oferta, perfecto. Si pierde, también. Lo prohibido es ocultarlo.' },
        { pregunta:'¿Por qué el principio de "3 manos" (cotización / autorización / recepción) en cada compra?',
          a:'Es burocracia inútil que solo existe en empresas grandes', b:'Si una sola persona controla las 3 funciones tiene carta blanca para defraudar (pagar facturas inventadas, recibir menos de lo facturado, etc.). Separar funciones protege a la empresa Y al comprador (nadie puede acusarte si nunca tuviste acceso a pago/recepción)', c:'Es solo cuando Mónica no está disponible', d:'Solo aplica si lo decide Mónica caso por caso',
          correcta:'b', explicacion:'Control interno básico. Es protección de la empresa pero también del comprador: imposible acusarte de robo si nunca tuviste el dinero ni la mercancía en tus manos.' }
      ],
      minAprobatorio: 4
    },
    // Módulo 7: La regla de las 3 cotizaciones
    {
      titulo: '🎓 Compras corporativas (2/5): la regla de las 3 cotizaciones (cómo aplicarla bien)',
      resumen: 'Por qué 3 (no 1, no 5+). Cómo seleccionar a los candidatos. Cómo emitir un RFQ profesional. Cuadro comparativo manzana con manzana. Cuándo NO aplica. Documentación obligatoria.',
      tiempo: 13,
      contenido: '## La regla de oro\n\nPara toda compra corporativa relevante: **mínimo 3 cotizaciones** antes de adjudicar.\n\nNo es opinión. Es estándar internacional (ISO 9001, COSO), está exigido por contratos con empresas serias, lo pide auditoría externa, y tiene una razón muy concreta: **sin 3 cotizaciones no puedes saber si el precio que te dan es bueno o no**.\n\n## ¿Por qué 3 (y no 1, ni 5+)?\n\n### Por qué no 1\nUna sola cotización no te da nada. Es un precio en el aire. ¿Es caro? ¿Barato? ¿Justo? No tienes referencia. Estás aceptando lo que el proveedor decida ponerte.\n\n### Por qué no 2\nDos cotizaciones te dan un rango pero pueden ser colusión (proveedores que se ponen de acuerdo). 2 puntos no hacen patrón.\n\n### Por qué no 5+\n5 o más cotizaciones consume tiempo desproporcionado:\n- Tú tardas 1-2 horas por cotización (RFQ, seguimiento, comparativo)\n- Los proveedores invierten esfuerzo y si pierden todos, eventualmente dejan de cotizarte\n- 3 da suficiente triangulación; más es desperdicio\n\n**La regla de 3 es el equilibrio entre rigor y costo de proceso**.\n\n## Cuándo aplica la regla\n\n✅ **Aplica**:\n- Compras nuevas (proveedor o producto que no habías comprado antes)\n- Compras recurrentes que no se han cotizado en 6-12 meses\n- Cambios de proveedor existente\n- Contratos marco (acuerdos de 6-12 meses)\n- Toda compra >$5,000 MXN en empresa chica, >$25,000 en empresa mediana (Fogueira: tu umbral con Mónica)\n\n❌ **NO aplica (excepciones)**:\n- Emergencias documentadas (urgencia operativa real, ej: rotura de proteína un sábado)\n- Productos exclusivos de un solo proveedor (ej: una marca específica que solo distribuye 1 importador)\n- Compras spot bajo umbral ($500 - $1,000 según política de cada empresa)\n- Acuerdos marco vigentes (durante su vigencia ya cotizaste)\n- Servicios públicos regulados (luz, agua, gas natural)\n\n**Las excepciones SE DOCUMENTAN**. Email a Mónica: "Compra urgente sin 3 cotizaciones — motivo: rotura de chuleta sábado servicio. Compra única a Proveedor Y por $X. Adjunto evidencia". Eso te protege.\n\n## Cómo seleccionar a los 3 candidatos\n\nNo es "los 3 que tengo a la mano". Hay criterios para que la cotización sea legítima:\n\n### Criterio 1 — mezcla establecido + challenger\n- Mínimo **1 proveedor establecido** (incumbente, ya conocido)\n- Mínimo **1 challenger** (nuevo, no había trabajado contigo)\n- 1 más a tu juicio\n\nSi cotizas con 3 establecidos, pierdes la oportunidad de descubrir mejores opciones. Si cotizas con 3 nuevos, no tienes referencia confiable.\n\n### Criterio 2 — tamaño relativo coherente\nNo cotizar el suministro de carne de Fogueira con 1 mega-distribuidor + 2 carnicerías de barrio. El mega no atenderá tu volumen, las carnicerías no tienen capacidad. Resultado: cotización de fachada que no comparas.\n\n**Cotiza con proveedores que pueden realmente atender tu volumen**.\n\n### Criterio 3 — diversificación geográfica/origen\nSi tus 3 cotizaciones vienen de la misma central de abastos del mismo distribuidor mayorista (todos compran al mismo origen), no estás cotizando — estás triangulando una opacidad.\n\nVarias el origen: 1 local, 1 regional, 1 nacional. O 1 mercado tradicional, 2 distribuidores formales. Etc.\n\n### Criterio 4 — capacidad fiscal\nTodo proveedor cotizante debe poder facturar (CFDI 4.0). Sin factura no hay compra corporativa válida. Pregunta antes de pedir cotización: "¿facturan con CFDI 4.0 a régimen general?".\n\n## El RFQ — Request For Quotation\n\nUn RFQ profesional se manda **por escrito** (correo o documento), nunca solo por WhatsApp. Incluye:\n\n### 1. Especificación EXACTA del producto\nNo "carne de res". Sí: "Picaña vacuno, marmoleo medio, peso pieza 1.2-1.6 kg, refrigerada (no congelada), origen nacional, sin marinada".\n\nMientras más vaga la especificación, más diferentes serán las cotizaciones (y no podrás compararlas).\n\n### 2. Cantidad y frecuencia\n"50 kg semanales por 6 meses" es muy diferente de "50 kg en compra única". Define ambos.\n\n### 3. Lugar y horario de entrega\n"Entrega en Fogueira Restaurant, Av. X, lunes y jueves entre 7:00 y 10:00 am, en cocina con pesado en báscula calibrada".\n\n### 4. Condiciones de pago propuestas\n"Pago a crédito 30 días contados desde recepción de mercancía y CFDI". Pueden contraproponer 15 o 45 — eso es parte de la negociación.\n\n### 5. Plazo de respuesta\nMínimo **3 días hábiles**. Si pides cotización el lunes y la quieres el martes, vas a recibir números improvisados. Mínimo 3 días, ideal 5-7.\n\n### 6. Vigencia de la cotización\n"Vigencia: 30 días desde la fecha de la cotización". Sin esto, el proveedor puede cambiar el precio cuando le plazca.\n\n### 7. Datos de cumplimiento fiscal requeridos\n"Adjuntar Constancia de Situación Fiscal vigente y Opinión de Cumplimiento positiva 32D".\n\n### 8. Tu contacto\nNombre, correo, teléfono. Y tu rol: "Weslley Pérez · Comprador · Fogueira Restaurant".\n\n## Cuadro comparativo manzana con manzana\n\nCuando recibes las 3 cotizaciones, **NO te quedes con el menor precio unitario**. Compara así:\n\n```\n=================================================================\nRFQ: Picaña vacuno · 50 kg/semana · 6 meses\n-----------------------------------------------------------------\nCriterio              | Prov A   | Prov B   | Prov C   | Peso\n-----------------------------------------------------------------\nPrecio unitario       | $200/kg  | $185/kg  | $210/kg  | 25%\nCalidad (escala 1-5)  | 5        | 3        | 5        | 25%\nOTIF histórico        | 95%      | 75%      | 92%      | 15%\nCondiciones pago      | 30 días  | 15 días  | 45 días  | 10%\nCapacidad sostenible  | 5        | 3        | 4        | 10%\nGarantía/devolución   | Sí       | No       | Sí       | 10%\nFiscal (32D, 69-B OK) | Sí       | Sí       | Sí       |  5%\n-----------------------------------------------------------------\nPuntaje ponderado     | 4.45     | 3.10     | 4.20     |\n=================================================================\nDecisión: Prov A. Aunque no es el más barato, su confiabilidad,\ncalidad y plazo de pago lo hacen más rentable en costo total.\n```\n\nEste cuadro:\n- Te obliga a pensar más allá del precio\n- Documenta tu decisión (auditoría lo puede pedir)\n- Le explica a Mónica por qué NO escogiste el más barato\n- Te protege si después un proveedor descontento reclama\n\n## Documentación obligatoria — qué se archiva\n\nPara CADA proceso de cotización (decisión > umbral), archiva:\n\n1. **El RFQ enviado** (la solicitud original con specs y plazo)\n2. **Las 3 cotizaciones recibidas** (PDF, screenshot del correo)\n3. **El cuadro comparativo** (Excel con los criterios y pesos)\n4. **La decisión final escrita** ("Adjudicado a proveedor X por motivos Y, Z. Firmado: Weslley · 2026-MM-DD")\n5. **La autorización de Mónica** (correo firmando el OK)\n6. **El alta del proveedor** (constancia fiscal, 32D)\n7. **La orden de compra emitida**\n\nDuración de archivo: **mínimo 5 años** (artículo 30 Código Fiscal de la Federación).\n\nUbicación: carpeta Drive ordenada por año/mes/categoría. NO papeles sueltos. NO solo emails — descargar y archivar.\n\n## Caso Fogueira — cotizar la picaña\n\nMónica te pide cotizar el suministro de picaña para los próximos 6 meses (50kg/semana). Pasos:\n\n1. **Preparas el RFQ**: especificaciones, cantidad, plazo, condiciones, vigencia (30 días)\n2. **Identificas 3 candidatos**:\n   - Proveedor A: el que ya tienen (incumbente) — Carnes Premium SA\n   - Proveedor B: challenger nuevo — Distribuidora Federal de Carnes\n   - Proveedor C: alternativa local — Frigorífico La Sierra\n3. **Envías RFQ** por correo a los 3 con plazo 5 días hábiles\n4. **Reciibes cotizaciones** y completas el cuadro comparativo\n5. **Análisis**: discutes con Mónica el cuadro\n6. **Decisión documentada**: "Adjudicado a A. Justificación: aunque B es 7.5% más barato, su OTIF histórico (75%) representa riesgo operativo significativo. El costo de pánico al menudeo cuando B falla excede el ahorro"\n7. **Mónica autoriza por correo**\n8. **Alta y orden de compra**\n9. **Archivado** en Drive · 2026 · Compras · Carnes\n\nTotal del proceso: 7-10 días hábiles desde RFQ hasta primera entrega.\n\n## Errores comunes\n\n- ❌ **"El de siempre"**: comprar al mismo proveedor por años sin re-cotizar. Después de 2 años de pereza, suele descubrirse que estás 15-25% por encima del mercado\n- ❌ **3 cotizaciones de fachada**: 1 amigo y 2 de relleno con precios inflados artificialmente. Esto es fraude documental\n- ❌ **Especificación vaga**: "carne de res" sin más. Te cotizan distintos cortes y no puedes comparar\n- ❌ **Plazo de respuesta de 1 día**: improvisaciones, no cotizaciones serias\n- ❌ **No archivar**: si auditoría pide la documentación 1 año después y no la tienes, problema serio\n- ❌ **Decidir solo por precio**: ya verás en el siguiente módulo por qué eso suele ser caro',
      quiz: [
        { pregunta:'¿Por qué la regla es 3 cotizaciones específicamente y no 1, 2 o 5?',
          a:'Porque sí — es una convención arbitraria del mercado', b:'1 no da referencia (precio en el aire); 2 puede ser colusión; 5+ desperdicia tiempo (tuyo y del proveedor) y desincentiva que te coticen. 3 es el equilibrio entre rigor y costo de proceso, y es el estándar internacional (ISO 9001, COSO)', c:'Es decisión exclusiva de Mónica en cada caso', d:'Solo aplica en compras del gobierno, no en restaurantes',
          correcta:'b', explicacion:'3 = mínimo necesario para triangular un precio justo sin desperdiciar esfuerzo. Es estándar corporativo en todo el mundo.' },
        { pregunta:'¿Cuál es una situación legítima donde NO se aplica la regla de 3 cotizaciones?',
          a:'Nunca hay excepciones — siempre se piden 3 cotizaciones sin importar el caso', b:'Emergencias documentadas (urgencia operativa real), productos exclusivos de un solo proveedor, compras spot bajo umbral, acuerdos marco vigentes, servicios públicos regulados — todas con documentación escrita justificando la excepción', c:'Cuando el proveedor es amigo de Germán', d:'Cuando tienes prisa y el plazo no te da',
          correcta:'b', explicacion:'Las excepciones EXISTEN pero se documentan por escrito. Sin documentación, queda como compra dirigida (red flag de auditoría).' },
        { pregunta:'Vas a cotizar suministro mensual de picaña. ¿Qué combinación de candidatos es más adecuada?',
          a:'3 carnicerías del mismo barrio', b:'Mezcla: mínimo 1 proveedor establecido (incumbente) + 1 challenger nuevo + 1 más a tu juicio. Tamaño relativo coherente (los 3 deben poder atender tu volumen). Diversificación geográfica si es posible', c:'1 mega-distribuidor nacional + 2 carnicerías de barrio sin capacidad', d:'Los 3 que estén geográficamente más cerca del restaurante',
          correcta:'b', explicacion:'Establecido + challenger + adicional, todos con capacidad real. Si los 3 no pueden atenderte, las cotizaciones son ficción.' },
        { pregunta:'¿Qué NO debe faltar en un RFQ profesional?',
          a:'Solo el precio objetivo que estás dispuesto a pagar', b:'Solo el nombre del producto y la cantidad', c:'Una advertencia de consecuencias si no cotiza', d:'Especificación exacta del producto, cantidad y frecuencia, lugar y horario de entrega, condiciones de pago propuestas, plazo de respuesta (mín. 3 días hábiles), vigencia de la cotización, requisitos fiscales (CSF, 32D), tu contacto',
          correcta:'d', explicacion:'Sin especificación exacta y sin plazo, las 3 cotizaciones serán incomparables. Sin vigencia, el proveedor cambia el precio cuando le plazca.' },
        { pregunta:'Recibes las 3 cotizaciones y el más barato es Prov B con $185/kg. Pero su OTIF histórico es 75% y no ofrece garantía. ¿Cómo decides?',
          a:'Vas con B porque es el más barato — eso es lo que le importa a Mónica', b:'Construyes un cuadro comparativo ponderado (precio 25%, calidad 25%, OTIF 15%, condiciones pago 10%, capacidad 10%, garantía 10%, fiscal 5%). Calculas puntaje. Documentas la decisión por escrito explicando por qué NO el más barato. Mónica autoriza', c:'Le pides la opinión a Sergio nada más', d:'Vas automáticamente con el de mayor precio como señal de calidad',
          correcta:'b', explicacion:'Decidir solo por precio es un error de novato. El cuadro ponderado documenta tu juicio, te protege ante auditoría y le explica a Mónica el porqué.' }
      ],
      minAprobatorio: 4
    },
    // Módulo 8: Evaluar proveedores - TCO, OTIF, riesgo
    {
      titulo: '🎓 Compras corporativas (3/5): evaluar proveedores — precio NO es lo único (TCO, OTIF, riesgo)',
      resumen: 'Costo total de adquisición vs precio unitario. KPIs de proveedores (OTIF, fill rate, tasa de defectos). Riesgo financiero, operativo y de concentración. Cuándo el más barato es la peor opción.',
      tiempo: 12,
      contenido: '## La trampa del precio unitario\n\nEl error #1 del comprador novato: **decidir por precio unitario**. Es la métrica más visible, la más fácil de comparar — y la más engañosa.\n\nEl precio unitario es 1 de 7 criterios que importan. Los otros 6 son donde se gana o se pierde dinero real, y los novatos los ignoran.\n\nEste módulo te enseña a ver lo que un comprador profesional ve cuando mira a un proveedor: **el costo total** y **el riesgo total**, no solo el papelito con el precio.\n\n## Costo Total de Adquisición (TCO)\n\nEl TCO (Total Cost of Ownership) es el costo REAL de comprarle a un proveedor. Fórmula simplificada:\n\n```\nTCO = Precio + Costo de no-calidad + Costo de retraso + Costo de servicio + Costo financiero\n```\n\n### Precio\nLo que dice la factura. Es la parte visible.\n\n### Costo de no-calidad\nMercancía defectuosa, devoluciones, rechazos, producto que cumple "técnicamente" pero te obliga a re-trabajo.\n\nEjemplo Fogueira: picaña que llega con 5% de merma extra (mal corte) sobre lo normal. En 50 kg semanales son 2.5 kg "perdidos" por proveedor mal seleccionado. A $200/kg = $500/semana = $26k/año tirados.\n\n### Costo de retraso\nCuando el proveedor llega tarde o incompleto, tienes que improvisar:\n- Comprar al menudeo a precio de pánico (típicamente +30-40%)\n- Pagar horas extra al equipo\n- Cancelar pedidos a clientes (pérdida de venta + reputación)\n\nEjemplo Fogueira: si tu proveedor de carne falla 1 viernes con la picaña, tu cocina sale a comprar al supermercado a $260/kg en vez de los $200 contratados. La compra de pánico de 50kg te cuesta $3,000 extra. Eso es lo que un proveedor con bajo OTIF te cuesta.\n\n### Costo de servicio\nTiempo que tú o tu equipo invierte en gestionar problemas con ese proveedor:\n- Llamadas para reclamar entregas\n- Reuniones para resolver facturación\n- Correos para rastrear pedidos\n\nEs invisible en factura pero real. Un proveedor que requiere 5 horas/semana de tu tiempo para gestionarlo te cuesta tu salario por esas horas.\n\n### Costo financiero\nDías de crédito que te ofrece el proveedor.\n\nEjemplo: Prov A te da 30 días, Prov B 15 días. Si manejas $200k/mes de compra, los 15 días de diferencia son $100k de capital de trabajo extra que necesitas. Ese capital tiene costo (intereses bancarios o costo de oportunidad — ~12-15% anual). Diferencia real: ~$1,500/mes a favor del que da más plazo.\n\n## La fórmula extendida\n\nTCO real anual = (Precio × Volumen) + (% no-calidad × Volumen × Precio) + (% fallas × Costo pánico × Volumen) + (Horas gestión × Tu costo/hora) + (Días crédito faltantes × Costo capital)\n\nNo necesitas hacer esto cada vez. Pero entender que existe te cambia la perspectiva.\n\n## KPIs para medir proveedores\n\nUn proveedor profesional acepta ser medido. Si se ofende, malo señal.\n\n### OTIF (On-Time In-Full)\nEntregas a tiempo Y completas / total de entregas. Target Fogueira: **>90%**.\n\nCálculo: en el último trimestre, ¿cuántas entregas llegaron en la fecha pactada CON la cantidad completa? Si tuviste 12 entregas y 10 fueron OTIF, OTIF = 83%.\n\nLleva un Excel simple: fecha pedido / fecha pactada / fecha real / cantidad pedida / cantidad recibida / OTIF (sí/no). En 3 meses tienes datos para conversar con el proveedor.\n\n### Fill rate\nCantidad recibida / cantidad pedida. Target: **>97%**.\n\nUn proveedor que sistemáticamente entrega 95% de lo que pides tiene un fill rate de 95%. Eso significa que el 5% de tu compra no llega y tienes que conseguirla aparte. Evidente costo.\n\n### Tasa de defectos / devoluciones\n# de incidencias / # de entregas. Target: **<2%**.\n\n### Tiempo de respuesta a reclamos\nDesde que reportas un problema hasta que se resuelve. Target: **<24 horas para respuesta inicial, <72 horas para solución**.\n\n## Riesgo del proveedor — los 3 tipos\n\n### Riesgo financiero\n¿Está el proveedor sólido financieramente?\n\n- **Lista 69-B SAT**: SAT publica una lista de empresas que han emitido facturas falsas. Si tu proveedor está ahí, tus facturas con él son **deducibles cero** y puedes ser corresponsable. Verificar SIEMPRE antes de alta. URL: lista en sitio del SAT, actualizada periódicamente.\n- **Antigüedad**: una empresa de <2 años es más riesgo que una de 10. No es prohibitivo pero pondéralo.\n- **Concentración de clientes del proveedor**: si tu proveedor depende de 1-2 clientes grandes, su riesgo es alto. Ideal: distribución sana de clientes.\n\n### Riesgo operativo\n¿Puede entregar consistentemente?\n\n- **Capacidad de planta** vs tu volumen\n- **Backups del proveedor** (si su único camión se descompone, ¿qué pasa?)\n- **Personal clave** (si depende de 1 persona, riesgo)\n\n### Riesgo de concentración (tuyo)\n**Regla 70/30 mínima**: ningún insumo crítico debe depender en >70% de un solo proveedor.\n\nEjemplo Fogueira: si el 100% de tu picaña viene de Carnes Premium, una huelga, problema sanitario o pelea contractual te deja sin producto del día a la noche. Solución: 70% Carnes Premium (proveedor preferido) + 30% Distribuidora Federal (backup activo). Si el principal falla, el backup ya tiene relación contigo y puede subir su volumen rápido.\n\nEsto cuesta un poco más (no aprovechas 100% del descuento por volumen) pero la prima de seguro vale.\n\n## Cuándo el más barato es la peor opción\n\nCaso real Fogueira (numerado):\n\n```\nProv A: $200/kg picaña, OTIF 95%, calidad 5/5\nProv B: $185/kg picaña, OTIF 75%, calidad 3/5\n\nVolumen: 50 kg/semana × 52 semanas = 2,600 kg/año\n\nGasto base:\n  Prov A: $200 × 2,600 = $520,000/año\n  Prov B: $185 × 2,600 = $481,000/año\n  Aparente ahorro con B: $39,000/año\n\nCosto de fallas (B falla 25% del tiempo):\n  Compra pánico: 25% × 2,600 kg × ($260 pánico - $185 contrato) = $48,750/año\n  Tiempo gestión problemas: 5h/semana × 52 × $80/h = $20,800/año\n  No-calidad (3% merma extra por mala calidad): 3% × 2,600 × $185 = $14,430/año\n\nTCO anual:\n  Prov A: $520,000 (sin fallas)\n  Prov B: $481,000 + $48,750 + $20,800 + $14,430 = $564,980\n\nDiferencia real: Prov A es $44,980 MÁS BARATO al año\n```\n\nEl "ahorro" de B es ficticio. La realidad es que B te cuesta más, te genera estrés operativo, daña tu calidad y aumenta tu riesgo.\n\nUn comprador profesional ve esto. Un comprador novato no.\n\n## Tu reporte de evaluación de proveedores\n\nDos veces al año (cada 6 meses), entrega a Mónica un reporte de tus proveedores activos:\n\n```\nEVALUACIÓN PROVEEDORES · S1 2026\nWeslley · Comprador\n\n========================================\nProveedor          | Volumen $ | OTIF | Calidad | Defectos | Acción\n----------------------------------------\nCarnes Premium    | $260,000  | 95%  | 5/5     | 0%       | Mantener (pref)\nDist. Federal     | $108,000  | 92%  | 5/5     | 1%       | Mantener (backup)\nFrutas Verdes     | $84,000   | 78%  | 3/5     | 8%       | EVALUAR cambio\nQuesos del Centro | $42,000   | 96%  | 5/5     | 0%       | Mantener\n========================================\n\nObservaciones:\n- Frutas Verdes: 4 incidencias trimestre. Iniciando RFQ alterno.\n- Carnes Premium: ofrecen renovar contrato 6 meses con descuento 3% si\n  se compromete volumen. Recomiendo aceptar.\n- Backups identificados para 7 de 12 categorías. Faltan 5 (lista anexa).\n```\n\nEsto le da a Mónica visibilidad estratégica del proveedor base. Y a ti te obliga a llevar registro objetivo.\n\n## Errores comunes\n\n- ❌ **Decidir solo por precio unitario** — ya vimos por qué\n- ❌ **No medir OTIF** — sin medir no sabes qué proveedor falla\n- ❌ **Olvidar el costo del fallo** — el costo pánico es real, contabilízalo\n- ❌ **Concentración 100% en un solo proveedor de insumo crítico** — apuesta peligrosa\n- ❌ **No revisar lista 69-B SAT** — proveedores fantasma o con facturas falsas pueden meterte en problema fiscal\n- ❌ **Aceptar proveedor que se ofende cuando le pides KPIs** — bandera roja, no es profesional\n- ❌ **No revisar evaluación 2x/año** — sin ritmo, los proveedores se vuelven "como están" para siempre',
      quiz: [
        { pregunta:'¿Qué es el TCO (Total Cost of Ownership) en compras?',
          a:'Costo total real de comprarle a un proveedor: precio + costo de no-calidad + costo de retraso (compra pánico, horas extra) + costo de servicio (tiempo gestión problemas) + costo financiero (días de crédito)', b:'Solo el precio unitario de la factura', c:'Un impuesto especial sobre compras corporativas', d:'Algo que solo aplica a empresas grandes, no restaurantes',
          correcta:'a', explicacion:'TCO captura lo que el precio unitario esconde. Un proveedor 5% más barato puede ser 10% más caro en TCO si falla, daña calidad o requiere mucha gestión.' },
        { pregunta:'¿Cuál es el target razonable de OTIF (On-Time In-Full) para un proveedor de Fogueira?',
          a:'Cualquiera está bien — lo importante es el precio', b:'>90% (entrega a tiempo Y completa). Por debajo de 80%, el proveedor te está costando más en compras pánico y horas extra de lo que aparenta', c:'30% ya es un número aceptable', d:'No se mide — solo se observa informalmente',
          correcta:'b', explicacion:'OTIF es el indicador más útil de confiabilidad. <80% = proveedor que te genera caos operativo. >95% = excelente.' },
        { pregunta:'Prov A: $200/kg, OTIF 95%, calidad 5/5. Prov B: $185/kg, OTIF 75%, calidad 3/5. ¿Cuál es la decisión correcta?',
          a:'B porque es más barato — el ahorro de $15/kg es real y concreto', b:'Calculas TCO real (incluye costo pánico cuando B falla 25% del tiempo, no-calidad, gestión). En el ejemplo, A termina siendo $44,980/año MÁS BARATO en TCO que B. Decides A documentando el análisis', c:'Pides a Mónica que decida ella sin tu análisis', d:'Le tiras un volado para que sea decisión neutral',
          correcta:'b', explicacion:'TCO honesto siempre derrota al precio unitario. El "ahorro" del más barato suele ser ficción cuando incluyes el costo del fallo.' },
        { pregunta:'¿Por qué se recomienda no concentrar más del 70% del suministro de un insumo crítico en un solo proveedor?',
          a:'Es solo capricho operativo sin base técnica', b:'Si concentras 100% y ese proveedor falla (huelga, sanitario, pelea contractual), te quedas sin producto de un día a otro. Dividir 70/30 con un backup activo da continuidad operativa. La pequeña pérdida en descuento por volumen es prima de seguro', c:'No es necesario — los proveedores buenos no fallan', d:'Solo aplica en empresas grandes con más de 100 empleados',
          correcta:'b', explicacion:'Regla 70/30 mínima en insumos críticos. La continuidad operativa es más valiosa que el último 5% de descuento por volumen.' },
        { pregunta:'¿Qué es la lista 69-B del SAT y por qué importa antes de dar de alta a un proveedor?',
          a:'Una lista de mejores proveedores recomendados por el SAT', b:'Lista pública del SAT con empresas que han emitido facturas presuntamente falsas (EFOS — Empresas que Facturan Operaciones Simuladas). Si compras a alguien en lista 69-B definitiva, tus facturas con él pueden ser NO deducibles y puedes ser corresponsable. Hay que verificar SIEMPRE antes de alta', c:'No existe tal lista — es un rumor del sector', d:'Es secreta y solo pueden consultarla los contadores',
          correcta:'b', explicacion:'Verificar 69-B es paso obligatorio del alta de proveedor. Te protege a ti y a la empresa de problemas fiscales graves.' }
      ],
      minAprobatorio: 4
    },
    // Módulo 9: Negociación profesional
    {
      titulo: '🎓 Compras corporativas (4/5): negociación profesional y manejo de proveedores',
      resumen: 'BATNA, ZOPA, ancla. Preparación es 80% de la negociación. Tácticas de proveedores y cómo responder. Negociar más allá del precio. Acuerdos marco vs órdenes spot. Manejo de conflictos.',
      tiempo: 13,
      contenido: '## La verdad sobre la negociación\n\nLa mayoría de la gente cree que negociar es hablar bonito o presionar fuerte. Es falso. La negociación profesional **se gana antes de hablar**.\n\n80% del resultado viene de la preparación. 20% del manejo en la mesa. Si llegas mal preparado, ningún truco verbal te va a salvar.\n\nEste módulo te enseña la preparación que distingue a un profesional de un improvisado.\n\n## Tres conceptos que tienes que conocer\n\n### BATNA (Best Alternative to Negotiated Agreement)\nEs **tu plan B** si esta negociación no se cierra.\n\nSi tu BATNA es fuerte (tienes 2 alternativas decentes esperando), puedes negociar duro y caminarte si no te dan lo que quieres.\n\nSi tu BATNA es débil (solo tienes 1 opción y la urgencia operativa aprieta), tu poder de negociación es bajo.\n\n**Antes de toda negociación**: define tu BATNA por escrito. "Si no llego a acuerdo con A, mi alternativa es B con condiciones X". Sin BATNA, estás a merced del proveedor.\n\nLa regla de las 3 cotizaciones que viste antes ES TU BATNA: 2 alternativas reales en mano + el que estás negociando.\n\n### ZOPA (Zone of Possible Agreement)\nEs el **rango donde un acuerdo es posible** entre tu mínimo aceptable y el máximo del proveedor.\n\nEjemplo:\n- Tú: pagas máximo $200/kg\n- Proveedor: vende mínimo $185/kg\n- ZOPA = $185 a $200 (donde hay acuerdo)\n\nSi no hay ZOPA (tu máximo $180, su mínimo $190), no hay deal. Punto. Caminate.\n\nIdentificar la ZOPA temprano evita perder semanas en negociaciones imposibles.\n\n### Ancla\nEl **primer número marca el rango psicológico** de toda la negociación.\n\nSi el proveedor abre con $250/kg, todo lo que digas se va a percibir respecto a ese ancla. Aunque tú pidas $200, ya cediste mentalmente respecto al inicio.\n\nQuien lanza la primera ancla suele tener ventaja **si tiene buena información del mercado**. Si no la tiene, queda expuesto al ridículo.\n\nRecomendación práctica: **deja que el proveedor abra primero** salvo que tengas data sólida del mercado y quieras anclar agresivo.\n\n## Preparación — la lista de antes de negociar\n\nAntes de cada negociación importante, contesta por escrito:\n\n1. **¿Qué quiero exactamente?** (objetivo claro: precio X, plazo Y, condiciones Z)\n2. **¿Cuál es mi mínimo aceptable?** (la línea por debajo de la cual prefiero caminarme)\n3. **¿Cuál es mi aspiracional?** (lo mejor que podría conseguir realista)\n4. **¿Cuál es mi BATNA?** (qué hago si no hay acuerdo)\n5. **¿Qué necesita el proveedor?** (volumen, plazo de pago, marca, exclusividad — sus motivadores)\n6. **¿Cuáles son los costos del proveedor?** (research: ¿qué margen tiene? ¿está en buen año?)\n7. **¿Qué intercambios puedo ofrecer?** (volumen extra, plazo más largo, exclusividad parcial, pago de contado, referencias)\n8. **¿Quién más tiene voto?** (Mónica, Sergio — los consulto antes)\n\nEsta hoja toma 30 minutos llenarla. Te ahorra 10x ese tiempo en la negociación.\n\n## Tácticas comunes de proveedores y cómo responder\n\nLos proveedores experimentados usan tácticas. No por mala fe necesariamente — es su oficio. Reconócelas y responde profesional.\n\n### "Es nuestro mejor precio, no podemos bajar"\nTraducción: están midiendo tu firmeza. \nRespuesta: "Entiendo. ¿Pueden compartir el desglose para que entendamos dónde está el costo? Tal vez podamos identificar áreas donde alguno de los dos tenga flexibilidad". Pides desglose, no descuento. Mucho más efectivo.\n\n### Bundles ("si llevas A te incluyo B sin costo")\nTraducción: te quieren mover a B porque es donde tienen margen.\nRespuesta: "Gracias. ¿Podemos cotizar A solo, B solo, y A+B por separado? Quiero entender el valor real de cada opción". Si no necesitas B, no es regalo — es overstock que te cargan.\n\n### Urgencia falsa ("solo hoy", "última semana del precio")\nTraducción: presión psicológica para que decidas sin analizar.\nRespuesta: "Aprecio el ofrecimiento. Mi proceso requiere análisis con dirección antes de cerrar. Si la oferta vence hoy entiendo, podemos retomar cuando esté disponible". Casi nunca es real la urgencia.\n\n### Ataque a la persona ("¿no confías en mí?", "creí que éramos amigos")\nTraducción: están eludiendo el tema y apelando a emoción.\nRespuesta: "Lo personal no está en cuestión. Mi rol es asegurar la mejor decisión para Fogueira. Volvamos a los números". Mantente profesional. La fricción está bien, lo personal no.\n\n### Concesiones ladrillito ("aceptamos $5 menos pero queremos pago contado")\nTraducción: pequeña concesión visible a cambio de algo grande para ti.\nRespuesta: calcular antes de aceptar. ¿$5 menos × 2,600 kg = $13k al año vs el costo financiero de pagar contado vs 30 días con $200k mensuales? Probablemente no te conviene. Solo aceptas si los números te cuadran.\n\n### Buen poli / mal poli\nTraducción: 2 personas del proveedor, una rígida y otra "comprensiva".\nRespuesta: trata a ambos por igual. La concesión final no la das al "buen poli", la das a los datos.\n\n## Negociar más allá del precio (especialmente perecederos)\n\nEl precio es una palanca. Hay 7 más que los novatos olvidan:\n\n### 1. Plazos de pago\n15 vs 30 vs 45 días tiene impacto financiero real. Calcular.\n\n### 2. Condiciones de entrega\nFrecuencia (1×/sem vs 3×/sem afecta tu inventario), horario, lugar, presentación.\n\n### 3. Tamaño de lote mínimo\nSi el mínimo del proveedor es 100kg pero tú usas 50kg/semana, te obliga a sobrestock.\n\n### 4. Garantías de calidad y devoluciones\n¿Aceptan devolver mercancía defectuosa? ¿En cuánto tiempo? ¿Crédito o reposición?\n\n### 5. Precio escalonado por volumen\n"$200/kg primeros 50kg/sem, $192 los siguientes 50kg, $185 sobre 150kg".\n\n### 6. Compromiso de precio (lock)\n"Precio fijo por 6 meses, escalable solo si el costo del proveedor sube >5% comprobado en factura de su productor".\n\n### 7. Exclusividad parcial\n"Te damos 70% del volumen a cambio de descuento de 3% y prioridad cuando hay urgencia". Nunca exclusividad 100% (riesgo de concentración).\n\n### 8. Servicios adicionales\nCapacitación al equipo, muestras gratuitas, soporte técnico, devolución de empaque.\n\nUna negociación profesional toca varias de estas palancas. No solo "bájame el precio".\n\n## Acuerdos marco vs órdenes spot\n\n### Acuerdo marco\nContrato de 6-12 meses con condiciones fijas (precio, volumen, calidad, plazo, devoluciones). Cada compra dentro del marco es solo emitir orden de compra contra el contrato.\n\n**Ventajas**: predictibilidad de costo, descuento por compromiso, relación estable.\n**Desventajas**: te bloqueas de bajadas de mercado durante la vigencia.\n**Mitigación**: incluye cláusula de revisión cada 3 meses ("si el costo de mercado cambia >7% comprobado, ambas partes pueden renegociar").\n\n### Órdenes spot\nCompra a precio del día, sin compromiso futuro.\n\n**Ventajas**: aprovechas bajadas, flexibilidad.\n**Desventajas**: más volátil, más caro en promedio, más esfuerzo de cotización cada vez.\n\n### Cómo decidir\n- **Insumos volátiles** (mariscos, vegetales temporales, importados) → **spot** o marco corto (3 meses)\n- **Insumos estables y críticos** (carnes principales, lácteos, abarrotes core) → **marco 6-12 meses**\n- **Insumos one-shot** (compra única) → **spot** obviamente\n\n## Manejo de conflictos y reclamos\n\nVa a haber problemas. Mercancía defectuosa, retrasos, errores de facturación. La forma como se manejen define la relación.\n\n### Reclamo de calidad\n1. **Documenta inmediato**: foto, fecha, factura, cantidad, problema específico\n2. **Notifica al proveedor por escrito** (correo): "Folio X · Fecha Y · Producto Z · Problema A · Solicitamos B (devolución, reposición, crédito)"\n3. **Plazo de respuesta**: 24h para respuesta inicial, 72h para solución\n4. **Escalación**: si no responde en 24h, segundo correo con copia a Mónica\n5. **Registro**: anota en notas del catálogo que hubo incidencia con fecha\n\nNo grites. No amenaces. Documenta y exige profesional.\n\n### Reclamo de retraso\nSimilar. Documenta el costo del retraso para ti (si tuviste que comprar pánico).\n\nExige nota de crédito por la diferencia. Algunos proveedores aceptan, otros no — eso te dice mucho de su calidad como socio.\n\n### Conservar la relación\nMéxico opera con relaciones. Aún cuando reclamas, mantienes el respeto. Un proveedor que sabe que reclamas profesional pero no humillas, es proveedor que se esfuerza por servirte mejor.\n\nProvedor al que humillas es proveedor que te abandona en la siguiente urgencia.\n\n## Cuando termina la relación\n\nA veces hay que cerrar con un proveedor (calidad inaceptable, OTIF crónico, ética dudosa).\n\n**Cómo cerrar profesional**:\n1. Notifica por escrito con anticipación razonable (15-30 días)\n2. Liquida todo lo pendiente\n3. Cierra cuentas formalmente\n4. **Despedida cordial**: "Apreciamos los años de servicio. La decisión obedece a [razón objetiva: OTIF, calidad]. Les deseamos éxito en otros proyectos"\n5. **Documenta en el catálogo**: "Proveedor X — relación terminada 2026-04-15. Motivo: OTIF crónico <70% durante 2 trimestres consecutivos. Backup activado: Proveedor Y"\n\nNo quemes puentes. El proveedor de hoy puede mejorar; el rumor de cómo cerraste te sigue en la industria.\n\n## Caso Fogueira — acuerdo marco con proveedor de carnes\n\nEstás listo para cerrar acuerdo marco 6 meses con Carnes Premium tras la cotización 3-vías:\n\n**Tu preparación**:\n- Objetivo: $200/kg picaña × 50kg/sem × 26 semanas\n- Mínimo aceptable: $200, plazo 30 días, OTIF garantizado >95% con penalización 2% por mes que baje\n- Aspiracional: $192/kg si compromisos volumen escalonado, plazo 45 días, garantía calidad sin merma >2%\n- BATNA: Distribuidora Federal a $205 con OTIF 92%\n- Sus costos: research dice carnes premium tiene margen ~12% en este corte\n- Lo que necesitan: volumen estable, plazo no >45 días, pago puntual\n\n**Negociación cerrada**:\n- Precio: $196/kg (4% bajo apertura)\n- Volumen: 50kg/sem mínimo, 70kg/sem si servicio aumenta\n- Plazo de pago: 30 días\n- Garantía: 3% merma máxima aceptable, sobre 3% es nota crédito\n- Vigencia: 6 meses con cláusula revisión a 3 meses si costo mercado cambia >7%\n- Penalización OTIF: si baja <90% por trimestre, descuento 1% siguiente trimestre\n\nResultado: 2% mejor que tu objetivo, con cláusulas que te protegen.\n\n## Errores comunes en negociación\n\n- ❌ **Negociar sin BATNA** — el peor error. Siempre llega con plan B real\n- ❌ **Lanzar la primera ancla sin información** — quedas expuesto\n- ❌ **Negociar solo por precio** — pierdes 7+ palancas adicionales\n- ❌ **Aceptar bundles sin analizar** — pagar por lo que no necesitas\n- ❌ **Dejarse mover por urgencia falsa** — casi nunca es real\n- ❌ **Romper relación por trato puntual** — relación es activo a largo plazo\n- ❌ **No documentar acuerdos por escrito** — verbal no se cumple igual\n- ❌ **Confundir firmeza con grosería** — la firmeza profesional gana; la grosería destruye\n- ❌ **Ceder sin obtener algo a cambio** — toda concesión tiene contraprestación',
      quiz: [
        { pregunta:'¿Qué es el BATNA y por qué es crítico antes de toda negociación?',
          a:'Best Alternative to Negotiated Agreement: tu plan B real si esta negociación no se cierra. Si tu BATNA es fuerte (2 alternativas decentes en mano), puedes negociar duro y caminarte. Si es débil, estás a merced del proveedor. La regla de 3 cotizaciones ES tu BATNA', b:'Una técnica de presión psicológica que se usa para asustar al proveedor', c:'Un acrónimo legal que solo usan abogados de grandes corporaciones', d:'Algo que solo aplica en empresas grandes, no en restaurantes',
          correcta:'a', explicacion:'Sin BATNA estás a merced del proveedor. Por eso las 3 cotizaciones no son burocracia: son tu poder de negociación.' },
        { pregunta:'Un proveedor te dice "es nuestro mejor precio, no podemos bajar". ¿Cuál es la mejor respuesta profesional?',
          a:'Romper la negociación de inmediato', b:'"Entiendo. ¿Pueden compartir el desglose para que entendamos dónde está el costo? Tal vez podamos identificar áreas donde alguno tenga flexibilidad". Pides DESGLOSE, no descuento — abre conversación más productiva', c:'Aceptar sin más — si dijo que es su mejor precio, hay que creerle', d:'Insultarlo para que baje el precio por pena',
          correcta:'b', explicacion:'Pedir desglose desarma la táctica. Si abre el costo, encuentras palancas (volumen, plazo, exclusividad). Si no abre, sabes que la cifra es rígida y tú decides si te conviene.' },
        { pregunta:'Además del precio, ¿qué palancas puedes negociar con un proveedor?',
          a:'Solo el precio importa en una negociación de compras', b:'Solo la fecha de entrega y nada más', c:'No hay otras palancas — el precio lo es todo', d:'Plazos de pago (15/30/45 días tiene costo financiero real), condiciones de entrega (frecuencia/horario), tamaño de lote mínimo, garantías y devoluciones, precio escalonado por volumen, compromiso de precio fijo (lock), exclusividad parcial, servicios adicionales',
          correcta:'d', explicacion:'Una negociación profesional toca múltiples palancas. Bajar el precio 2% puede ser menos valioso que ganar 15 días extra de plazo o cláusula de garantía robusta.' },
        { pregunta:'Vas a comprar carne para los próximos 6 meses. ¿Acuerdo marco o spot?',
          a:'Spot siempre — más flexibilidad para aprovechar bajadas', b:'Acuerdo marco 6 meses con cláusula de revisión cada 3 meses (si el costo de mercado cambia >7% se renegocia). La carne es insumo crítico y relativamente estable; el marco te da predictibilidad de costo, descuento por compromiso de volumen, y la cláusula te protege de quedarte arriba del mercado', c:'Depende del clima y la temporada del momento', d:'Lo que el proveedor proponga — él sabe más del mercado',
          correcta:'b', explicacion:'Insumos críticos y estables → marco. Insumos volátiles (mariscos, vegetales temporales) → spot. La cláusula de revisión es la protección contra que el mercado baje y tú quedes arriba.' },
        { pregunta:'Vas a terminar relación con un proveedor por OTIF crónico bajo. ¿Cómo cierras profesionalmente?',
          a:'Lo bloqueas en WhatsApp y ya', b:'Notificas por escrito con anticipación 15-30 días, liquidas todo pendiente, cierras cuentas, despedida cordial citando razón objetiva ("OTIF crónico <70% en 2 trimestres"), documentas en catálogo. NO quemas puentes — el rumor de cómo cierras te sigue en la industria, y el proveedor puede mejorar mañana', c:'Le pones una demanda mercantil', d:'Le mandas WhatsApp diciéndole todo lo que salió mal',
          correcta:'b', explicacion:'Profesional significa firmeza con respeto. La industria es chica; reputación de cómo cierras vale más que el último golpe verbal.' }
      ],
      minAprobatorio: 4
    },
    // Módulo 10: Fiscal, control interno y KPIs
    {
      titulo: '🎓 Compras corporativas (5/5): fiscal básico (CFDI/SAT/IEPS), control interno y KPIs',
      resumen: 'Alta de proveedor (CSF, 32D, lista 69-B). CFDI 4.0 y complemento de pagos. Retenciones IVA/ISR. IEPS bebidas alcohólicas. Documentación obligatoria. Las 3 manos. KPIs y reporte mensual.',
      tiempo: 14,
      contenido: '## Bienvenido a la parte que distingue al profesional\n\nEsta es la sección que separa al comprador improvisado del comprador profesional mexicano. Sin esto:\n- Compras facturas no deducibles → la empresa pierde dinero\n- Trabajas con proveedores 69-B → puedes ser corresponsable de fraude fiscal\n- No conservas documentación → multas SAT por miles\n- Sin separación de funciones → riesgo de fraude operativo\n\nNo necesitas ser contador. Pero sí debes saber lo que un comprador en México TIENE QUE saber.\n\n## ALTA DE PROVEEDOR — checklist obligatorio\n\nAntes de hacer la primera compra a un proveedor nuevo, exige y archiva:\n\n### 1. Constancia de Situación Fiscal vigente (CSF)\nDocumento del SAT que indica:\n- Razón social o nombre completo\n- RFC\n- Régimen fiscal (Persona Moral, RIF, RESICO, etc.)\n- Dirección fiscal\n- Estado del contribuyente (activo)\n- Vigencia: la CSF no caduca pero pídela emitida en los últimos 30 días para asegurar datos vigentes\n\n**Verificación cruzada**: el RFC de la CSF debe coincidir EXACTO con el que recibas en facturas. Una letra distinta = factura no deducible.\n\n### 2. Opinión de Cumplimiento positiva (32D)\nDocumento del SAT que dice si el contribuyente está al corriente con sus obligaciones fiscales (declaraciones, impuestos).\n\nEstados:\n- **Positiva** ✅ → al corriente, puedes trabajar\n- **Negativa** ❌ → tiene adeudos o falta declaración → NO ALTA\n- **No localizado** ⚠ → no se encuentra en domicilio → NO ALTA\n\nLa 32D se renueva cada 30 días en el SAT. Pídela al proveedor para alta y cada 6 meses para renovación.\n\n### 3. NO está en lista 69-B SAT\nLista pública del SAT con dos categorías:\n- **Presuntos**: bajo investigación por emitir facturas presuntamente falsas\n- **Definitivos**: confirmado que emitieron facturas falsas (EFOS — Empresas que Facturan Operaciones Simuladas)\n\nSi un proveedor está en **definitivos**, sus facturas son **NO DEDUCIBLES** y la empresa puede ser corresponsable.\n\n**Cómo verificar**:\n- URL: sitio del SAT, sección "Listado de contribuyentes 69-B" (búsqueda actualizada periódicamente)\n- Frecuencia: alta + cada 6 meses para proveedores activos\n\n### 4. Carátula bancaria del proveedor\nPara confirmar a qué cuenta se le va a pagar. NUNCA pagues a una cuenta que no esté validada en el alta — es vector de fraude clásico.\n\n### 5. Datos de contacto operativo\nPersona de contacto para órdenes, persona de contacto para incidencias, persona de contacto para facturación. 3 distintas o la misma — pero documentadas.\n\n### 6. Contratos firmados (cuando aplica)\nAcuerdos marco, NDA si comparte info sensible, contrato de servicio. Firmados por ambas partes.\n\n### 7. Archivar todo\nCarpeta Drive: `Proveedores / Activos / [Nombre Proveedor]` con todos los documentos. Conservar mínimo 5 años.\n\n## CFDI 4.0 — qué tienes que validar tú\n\nEl proveedor te emite Comprobante Fiscal Digital por Internet (CFDI). Tú validas:\n\n### Datos esenciales\n- **RFC del receptor** (Fogueira) → debe ser EXACTO\n- **Nombre/Razón social del receptor** → debe ser exacto al de la CSF de Fogueira\n- **Régimen fiscal del receptor** → el de Fogueira\n- **Código postal del receptor** → el del domicilio fiscal de Fogueira\n- **Uso de CFDI** → habitualmente **G03 — Gastos en general** (en algunos casos G01 — Adquisición de mercancías)\n- **Método de pago** → ver siguiente sección\n- **Forma de pago** → 01 efectivo, 03 transferencia, 04 tarjeta crédito, 28 tarjeta débito, etc.\n- **Concepto detallado** → no solo "venta", sino "Picaña vacuno 50kg"\n\n### Si algo está mal\nPide cancelación y reemisión INMEDIATA, antes del cierre del mes. Después es engorroso (cancelación con aceptación, plazos del SAT).\n\n## Método de pago: PUE vs PPD\n\n### PUE — Pago en Una Exhibición\nPagas el total de la factura **antes del fin del mes** en que se emitió.\n\nEjemplo: factura emitida 5 mayo. Si pagas el 25 mayo, es PUE. Forma de pago real (efectivo, transferencia, etc.). NO requiere complemento de pagos.\n\n### PPD — Pago en Parcialidades o Diferido\nPagas total **después del fin del mes** en que se emitió, o pagas a parcialidades.\n\nEjemplo: factura emitida 5 mayo, pagas el 5 junio (más de un mes después). Es PPD. Forma de pago en factura debe ser **99 — Por definir**. Y aquí entra el complemento de pagos.\n\n## Complemento de pagos (cuando es PPD)\n\nCuando una factura es PPD y pagas (parcial o total), el proveedor DEBE emitir un **complemento de pagos** (también CFDI) que documenta:\n- Folio de la factura original\n- Fecha del pago\n- Monto pagado\n- Forma de pago real\n- Saldo pendiente (si aplica)\n\n**Sin complemento de pagos = no comprobante de pago = no deducible**.\n\n**Tu responsabilidad como comprador**:\n- Verificar que el complemento llegue dentro del mes siguiente al pago\n- Si no llega, pídelo formalmente\n- Sin complemento, no autorices el siguiente pago a ese proveedor\n\nEs el error más común que destruye deducibilidad en compras corporativas.\n\n## Retenciones (cuándo aplican)\n\nLa empresa que paga (Fogueira) retiene parte del impuesto y lo entera al SAT en lugar del proveedor.\n\n### Servicios profesionales / honorarios (Persona Física)\nSi contratas un servicio profesional de Persona Física (consultoría, asesoría, no productos), retienes:\n- **10% ISR** sobre la base\n- **10.667% IVA** (que es 2/3 del 16% IVA)\n\nLe pagas al proveedor el resto. Le entregas constancia de retención. SAT recibe la retención.\n\n### Comisiones mercantiles\nDependiendo del régimen del proveedor, puede haber retención de IVA. Consulta con el contador de Fogueira en cada caso.\n\n### Compras de bienes (productos)\nNORMALMENTE no hay retenciones. La factura es por monto total y pagas el monto total. Es lo más común en Fogueira (carnes, abarrotes, vegetales).\n\n### Caso especial: arrendamiento\nSi rentan local de Persona Física (no aplica directo a Fogueira, pero por cultura): retención del 10% ISR.\n\nEn duda, **siempre consulta con Mónica antes de pagar**. Una retención mal manejada genera problema fiscal.\n\n## IEPS en bebidas alcohólicas (relevante Fogueira)\n\nEl IEPS (Impuesto Especial sobre Producción y Servicios) lo paga el productor o importador. Cuando tú compras vino, cerveza o destilado al distribuidor:\n\n- El IEPS **ya viene incluido en el precio de compra** (no lo pagas tú extra)\n- Tú lo recibes facturado con el IEPS desglosado en la factura (es información, no obligación)\n- **NO retienes IEPS** (no es retención, es tributo del productor)\n- Sí debes **separarlo en tu sistema** para entender el costo real del producto vs costo del IEPS, y porque al venderlo tú vas a cobrar IEPS al consumidor (eso lo maneja la cajera/POS, no tú)\n\nQué pedir al proveedor:\n- Factura con IEPS desglosado\n- Si es importador, RFC de empresa importadora autorizada\n- Padrón de Importadores vigente (en caso de importados)\n\n## Documentación obligatoria por compra (PO + recepción + factura)\n\nCada compra debe tener trazabilidad completa:\n\n### 1. Orden de Compra (PO/OC)\nDocumento que TÚ emites antes de la compra:\n- # consecutivo\n- Fecha\n- Proveedor\n- Productos, cantidades, precios unitarios, total\n- Condiciones (plazo entrega, plazo pago, lugar)\n- **Firma de autorizado** (Mónica)\n- Tu firma como comprador\n\nNINGUNA compra debe iniciarse sin OC firmada por autorizado. Si recibes mercancía sin OC previa, bandera roja.\n\n### 2. Factura del proveedor (CFDI)\nLa que ya describimos.\n\n### 3. Evidencia de recepción\nQuien recibe (cocina o churrasca) firma:\n- Fecha y hora real de recepción\n- Cantidad recibida (puede diferir de la pedida)\n- Estado de la mercancía\n- Firma o iniciales\n\nSi cantidad real < pedida, se anota la diferencia y se inicia trámite de nota de crédito o reposición.\n\n### 4. Pago\n- Fecha del pago\n- Monto\n- Forma (transferencia, etc.)\n- Si PPD, complemento de pagos\n- Constancia de retención (si aplica)\n\n### 5. Conservación: 5 años (artículo 30 CFF)\nSi SAT te audita, te puede pedir cualquier compra de los últimos 5 años. Si no la encuentras, multa.\n\n## Las 3 manos — separación de funciones (recordatorio crítico)\n\n1. **TÚ (comprador)**: cotizas, propones proveedor, emites OC\n2. **Mónica (autoriza)**: firma OC, autoriza el pago\n3. **Cocina/Churrasca (recibe)**: firma evidencia de recepción\n\n**Si una sola persona hace 2+ → bandera roja**. \n\nExcepción real Fogueira: cuando opera en domingo y no hay Mónica, se puede recibir sin firma de ella, pero la OC ya estaba firmada de antemano (no se "salta" — solo se ejecuta). Y al lunes se reconstruye trazabilidad.\n\n## Banderas rojas internas — cómo te puedes proteger\n\nSi notas algo de esto, AVISA POR ESCRITO a Mónica:\n\n- ❌ Pedidos sin OC firmada\n- ❌ Recepciones sin firma de cocina\n- ❌ Pagos sin factura\n- ❌ Diferencias entre OC y factura sin justificación\n- ❌ Compras a proveedores nuevos sin haber pedido cotizaciones (sin justificación documentada)\n- ❌ Presión de "alguien" para acelerar pagos sin documentación\n- ❌ Solicitudes para cambiar la cuenta bancaria del proveedor sin proceso (vector clásico de fraude por correo apócrifo)\n\nDocumentar tu reporte de banderas rojas TE PROTEGE. Si después algo sale mal, tú ya habías avisado.\n\n## KPIs del comprador profesional\n\nLa dirección te va a medir con estos números. Conócelos para ti mismo, mídelos cada mes.\n\n### 1. Ahorro vs precio anterior\n(Precio anterior - Precio actual) × Volumen anual = ahorro absoluto\n**Target**: -2% a -5% anual ajustado por inflación. Si la inflación es 5%, mantener precio ya es ahorro de 5%.\n\n### 2. % de compras con 3 cotizaciones\n(# compras con 3 cotizaciones / # compras totales sobre umbral) × 100\n**Target**: >80%\n\n### 3. Lead time promedio\nDías entre solicitud interna y entrega de mercancía\n**Target**: <3 días para compras estándar; <7 días para compras nuevas con cotización 3-vías\n\n### 4. OTIF promedio de tus proveedores\nMedia ponderada por volumen\n**Target**: >90%\n\n### 5. # de proveedores activos por categoría\nIdeal ≥2 por insumo crítico (regla 70/30 de concentración)\n**Target**: ≥2 en TOP 10 categorías\n\n### 6. % de precios validados (sin flag 📍)\n(Ingredientes con precio validado / total ingredientes) × 100\n**Target Fogueira**: arrancamos en ~63% (492 - 297 estimados / 492). Meta 6 meses: 90%+\n\n### 7. Índice de incidencias\n(# devoluciones + # reclamos resueltos + # banderas rojas) / # entregas\n**Target**: <2%\n\n### 8. Cumplimiento del reporte semanal\n¿Lo entregas a tiempo, completo, accionable?\n**Target**: 100%\n\n## Reporte mensual a dirección\n\nUna vez al mes (primer lunes), entrega a Mónica reporte ejecutivo:\n\n```\nREPORTE MENSUAL · COMPRAS · ABRIL 2026\nWeslley · Comprador · Fogueira\n\n========================================\nKPIs vs Target\n----------------------------------------\nAhorro YTD             : -3.2% vs -2% target ✅\n% con 3 cotizaciones   : 78%   vs >80% target ⚠\nLead time promedio     : 2.8d  vs <3d target ✅\nOTIF promedio          : 88%   vs >90% target ⚠\n% precios validados    : 71%   vs 90% target (en progreso)\nÍndice incidencias     : 1.4%  vs <2% target ✅\n========================================\n\nNEGOCIACIONES CERRADAS:\n- Carnes Premium · acuerdo marco 6 meses · ahorro estimado $48k anual\n- Distribuidora Federal · activado como backup picaña\n\nRIESGOS IDENTIFICADOS:\n- Frutas Verdes: OTIF 78%, iniciado RFQ alterno\n- Posible alza de aceite oliva por temporada (mayo-junio)\n\nINICIATIVAS PRÓXIMO MES:\n- Cerrar 30 estimados (📍) más\n- Cotizar 3-vías para mariscos\n- Negociar precio fijo trimestral con principales 5 proveedores\n\nPENDIENTES DE DIRECCIÓN:\n- Aprobación umbral 3 cotizaciones (sugiero $5,000 MXN)\n- Política formal de regalos a comprador\n```\n\n## Carrera del comprador profesional\n\nPara cerrar este curso, una reflexión: el comprador profesional de carrera larga tiene 4 cualidades que no te enseña ningún manual:\n\n1. **Curiosidad por mercados** — lee tendencias macro, tipo de cambio, geopolítica, climatológico (afecta agros)\n2. **Ética inquebrantable** — la pendiente resbaladiza siempre empieza con un regalo "chiquito"\n3. **Networks profesionales** — tener varios proveedores conocidos por categoría te da poder de negociación y backups reales\n4. **Documentación obsesiva** — el comprador profesional documenta TODO. No por paranoia — porque sabe que es lo único que lo protege\n\nUn comprador con estos 4 atributos es contratable en cualquier empresa, en cualquier industria, y probablemente bien pagado.\n\nEste rol que estás aprendiendo es **mucho más valioso de lo que parece**. Bien hecho, eres el guardian del margen del restaurante.\n\nGracias por completar el curso. Ahora a aplicarlo.',
      quiz: [
        { pregunta:'Antes de dar de alta a un proveedor nuevo, ¿qué documentos fiscales SIEMPRE debes pedir y archivar?',
          a:'Solo el nombre y RFC verbal del representante', b:'Constancia de Situación Fiscal vigente (RFC, régimen, domicilio fiscal); Opinión de Cumplimiento positiva (32D); verificación de que NO está en lista 69-B SAT; carátula bancaria validada; datos de contacto. Renovar 32D cada 6 meses', c:'Solo una factura cualquiera de ellos', d:'No hace falta nada — si dan buena mercancía es suficiente',
          correcta:'b', explicacion:'Sin estos documentos, las facturas pueden ser no deducibles. Lista 69-B definitivos = facturas inválidas + posible corresponsabilidad fiscal. Es paso obligatorio del alta.' },
        { pregunta:'¿Qué es y cuándo debe emitirse el complemento de pagos?',
          a:'Es opcional si el monto de la factura es menor a $5,000', b:'Es un CFDI adicional que el proveedor DEBE emitir cuando una factura es PPD (Pago en Parcialidades o Diferido — pago después del mes de emisión) y tú pagas total o parcial. Documenta folio original, fecha de pago, monto. SIN complemento de pagos = no comprobante de pago = no deducible. Tú lo verificas y lo exiges si no llega', c:'Solo aplica en empresas con más de 50 empleados', d:'Lo emite el comprador, no el proveedor',
          correcta:'b', explicacion:'Error #1 que destruye deducibilidad en empresas mexicanas. Si el proveedor no emite el complemento dentro del mes siguiente al pago, exígelo formalmente.' },
        { pregunta:'Compras vino y cerveza para el bar de Fogueira. ¿Cómo manejas el IEPS?',
          a:'Lo retienes y lo enteras directamente al SAT', b:'NO retienes IEPS — el IEPS lo pagó el productor/importador y ya viene incluido en tu precio de compra. Tú validas que el proveedor lo desglose en factura, lo separas en tu sistema para conocer el costo real del producto, y verificas que el proveedor sea importador autorizado si es producto importado', c:'Lo absorbes sin analizarlo — es problema del proveedor', d:'Lo cobras directamente al cliente en la factura del restaurante',
          correcta:'b', explicacion:'IEPS no es retención. Es impuesto del productor que llega incluido en el precio. El comprador lo entiende para no confundir el costo real con el costo bruto.' },
        { pregunta:'¿Qué es la "regla de las 3 manos" en compras y por qué es crítica?',
          a:'Una superstición del sector que no tiene base real', b:'Separación obligatoria: (1) quien cotiza y propone proveedor — TÚ; (2) quien autoriza el pago — Mónica (Gerente Administrativo); (3) quien recibe la mercancía y firma evidencia — cocina o churrasca. Si una sola persona hace 2+ funciones hay riesgo de fraude operativo. Te protege a ti también: imposible acusarte de robo si nunca tuviste pago ni mercancía en tus manos', c:'Solo aplica en bancos y sector financiero', d:'Es una recomendación opcional que Mónica decide aplicar o no',
          correcta:'b', explicacion:'Control interno fundamental. Es protección de la empresa Y del comprador. Cualquier ruptura de esta separación es bandera roja a documentar.' },
        { pregunta:'¿Cuáles son KPIs típicos por los que la dirección mide al comprador profesional?',
          a:'Solo el ahorro nominal en pesos por mes', b:'Ahorro vs precio anterior (target -2% a -5% ajustado inflación), % compras con 3 cotizaciones (>80%), lead time promedio (<3d), OTIF promedio de proveedores (>90%), # proveedores activos por categoría (>=2 en críticos), % precios validados (sin flag 📍), índice de incidencias (<2%), cumplimiento de reporte semanal (100%)', c:'Cuántas órdenes de compra procesa por mes', d:'No hay KPIs definidos para el rol comprador',
          correcta:'b', explicacion:'Múltiples KPIs balanceados. Si te miden solo por ahorro, se incentiva sacrificar calidad/riesgo. Los KPIs balanceados protegen el costo total.' }
      ],
      minAprobatorio: 4
    }
  ];
}

// Banco maestro de preguntas. Cada rol tiene ≥20 preguntas (mínimo para sortear 15 con rotación).
// Formato: { rol: [{ pregunta, a, b, c, d, correcta, explicacion }] }
function bancoPreguntasFogueira() {
  return {
    // ==================== HOST ====================
    host: [
      { pregunta:'¿Cuál es la tarifa de adultos para el Buffet completo de Lunes a Jueves?',
        a:'$590', b:'$299', c:'$249', d:'$890', correcta:'a',
        explicacion:'Lun-Jue Buffet completo $590 adulto.' },
      { pregunta:'¿Cuál es la tarifa de adulto para Desayuno los fines de semana?',
        a:'$590', b:'$299', c:'$249', d:'Gratis', correcta:'b',
        explicacion:'Vie-Dom Desayuno (8am-12pm) $299 adulto.' },
      { pregunta:'¿A partir de qué edad un niño paga tarifa de adulto?',
        a:'8 años', b:'10 años', c:'11 años', d:'12 años', correcta:'c',
        explicacion:'0-5 cortesía, 6-10 tarifa niño, 11+ tarifa adulto.' },
      { pregunta:'Un niño de 4 años, ¿cuánto paga?',
        a:'$249', b:'$299', c:'$590', d:'Gratis (cortesía)', correcta:'d',
        explicacion:'Niños 0-5 años son cortesía, no pagan.' },
      { pregunta:'Un niño de 8 años, ¿qué tarifa aplica?',
        a:'Tarifa niño $249', b:'Cortesía (no paga)', c:'Tarifa adulto $590', d:'Tarifa especial $199 de 6-8 años', correcta:'a',
        explicacion:'Niños 6-10 pagan tarifa niño $249.' },
      { pregunta:'¿Hasta qué hora puede un cliente cancelar su reserva online?',
        a:'1 hora antes como mínimo desde el formulario', b:'30 minutos antes desde su link único', c:'No puede cancelar — debe llamar al restaurante', d:'En cualquier momento sin restricción hasta la hora de llegada', correcta:'b',
        explicacion:'El cliente cancela hasta 30 min antes desde su link único.' },
      { pregunta:'¿Cuál es el cupo máximo de personas reservadas online por servicio?',
        a:'30', b:'92', c:'50', d:'100', correcta:'c',
        explicacion:'50 personas reservadas online por servicio. Walk-ins caben aparte hasta el aforo de 92.' },
      { pregunta:'¿Cuál es el aforo físico máximo del restaurante?',
        a:'50', b:'75', c:'120', d:'92', correcta:'d',
        explicacion:'Aforo físico 92 personas, sumando reservas y walk-ins.' },
      { pregunta:'Si pasaron 10 minutos de la hora reservada y el cliente no llegó, ¿qué debes hacer?',
        a:'Marcar automáticamente como "No llegó"', b:'Cancelar al instante sin avisar', c:'Valorar y, si decides, marcarla como "No llegó" capturando un motivo', d:'Bloquear al cliente', correcta:'c',
        explicacion:'La tolerancia interna es 10 min, pero el sistema NO marca solo. El host decide y captura motivo.' },
      { pregunta:'En la pestaña Reservaciones, ¿qué hace el botón verde "✓ Llegó"?',
        a:'Cancela la reserva y libera el cupo', b:'Imprime el ticket de confirmación', c:'Manda WhatsApp de confirmación al cliente', d:'Marca la reserva como atendida (cliente ya llegó)', correcta:'d',
        explicacion:'Marca al cliente como atendido y libera ese turno operativamente.' },
      { pregunta:'¿Qué hace el botón rojo "Pausar reservas" en la página de Reservaciones?',
        a:'Cancela todas las reservas del día sin aviso', b:'Cierra el restaurante para siempre en el sistema', c:'Pausa las cocinas hasta que se reabra', d:'Bloquea las reservas online del día (no permite que entren nuevas)', correcta:'d',
        explicacion:'Bloquea NUEVAS reservas online del día. Se usa con criterio (lleno, emergencia) y avisando antes a la administradora.' },
      { pregunta:'En la Bitácora, ¿cuándo se cambia el estado a "Desocupada" automáticamente?',
        a:'Cuando capturas la hora de salida de una mesa Ocupada', b:'Cuando pasan 30 minutos', c:'Manualmente, nunca solo', d:'Al cerrar la bitácora', correcta:'a',
        explicacion:'Al capturar hora_sal en una fila Ocupada, el estado pasa solo a Desocupada para que la mesa aparezca libre.' },
      { pregunta:'Para eliminar una fila de la Bitácora, ¿qué te pide el sistema?',
        a:'Nada, se borra al instante', b:'Tu contraseña', c:'Un motivo de mínimo 5 caracteres', d:'Autorización del admin', correcta:'c',
        explicacion:'Para evitar borrados accidentales, pide motivo (mín 5 caracteres) y queda en auditoría.' },
      { pregunta:'Si llega un grupo de 2 personas y la bitácora muestra el botón "💡 Mesa 6 (2 pax)", ¿qué pasa al darle click?',
        a:'Muestra un mapa del salón para elegir otra mesa', b:'Cancela la fila actual para crear una nueva', c:'Asigna automáticamente la mesa 6 (la más chica disponible que les cabe)', d:'Imprime un ticket de confirmación de la asignación', correcta:'c',
        explicacion:'La sugerencia automática asigna la mesa más chica disponible para no desperdiciar mesas grandes.' },
      { pregunta:'Si los fines de semana cambias del servicio de Desayuno al de Comida, ¿qué se hace?',
        a:'Se sigue capturando en la misma bitácora del día', b:'Se cambia de pestaña en la misma bitácora', c:'Se cierra Desayuno y se abre una NUEVA bitácora de Comida', d:'Se borra todo y empieza de cero', correcta:'c',
        explicacion:'Cada servicio tiene bitácora independiente: cierras Desayuno y abres Comida.' },
      { pregunta:'¿Cuáles son los únicos puestos autorizados para firmar cortesías?',
        a:'Cualquier host del turno activo', b:'El encargado de piso cuando los gerentes no están', c:'La cajera junto con el encargado de piso', d:'Gerente Administrativo y Gerente de Restaurante', correcta:'d',
        explicacion:'Solo Gerente Administrativo (Mónica) y Gerente de Restaurante (Gabriel) pueden autorizar cortesías.' },
      { pregunta:'¿Cada cuánto tiempo se guarda automáticamente la bitácora?',
        a:'Solo al cerrarla', b:'Cada hora', c:'Cada cambio (debouncing 200ms-2s) más reintentos en caso de falla', d:'Manualmente con un botón', correcta:'c',
        explicacion:'El sistema guarda por fila individual con debouncing y reintentos infinitos para no perder datos.' },
      { pregunta:'¿Hasta qué hora dura tu sesión iniciada?',
        a:'Hasta las 3:00 am del día siguiente', b:'1 hora', c:'8 horas', d:'Hasta medianoche', correcta:'a',
        explicacion:'La sesión usa día lógico del restaurante: cubre hasta las 3 am del día siguiente para abarcar el cierre.' },
      { pregunta:'En iPhone, si después de iniciar sesión te aparece pantalla en blanco, ¿qué haces?',
        a:'Reinicias el iPhone y vuelves a iniciar sesión desde cero', b:'Tap en el botón "→ Entrar al sistema" que aparece visible', c:'Cierras la sesión y la abres desde Safari en modo privado', d:'Borras el caché del navegador antes de intentar de nuevo', correcta:'b',
        explicacion:'iOS Safari bloquea redirects automáticos; aparece un botón visible para que tú lo presiones.' },
      { pregunta:'¿Qué significa que una mesa esté en "En espera" en el plano del salón?',
        a:'Que tiene reserva confirmada pero el cliente aún no llega', b:'Que la mesa está sucia pendiente de limpiar', c:'Que está bloqueada por el admin', d:'Que falta capturar adultos y niños', correcta:'a',
        explicacion:'En espera = la reserva ya está, el cliente todavía no llegó.' },
      { pregunta:'Si capturas una cortesía sin asignar quién la autorizó, ¿qué pasa?',
        a:'Nada — se acepta sin firma', b:'Se borra automáticamente del sistema', c:'Se cobra al host que la capturó', d:'El sistema la guarda pero la marca como "bandera roja" al cierre', correcta:'d',
        explicacion:'Toda cortesía sin autorización es bandera roja al cierre — debe llevar nombre del gerente que aprobó.' },
      { pregunta:'¿Qué tipo de reservas NO se confirman automáticamente?',
        a:'Grupos mayores a 10 personas', b:'Las del fin de semana (desayuno y comida)', c:'Las de la noche después de las 8pm', d:'Todas se confirman automáticamente sin excepción', correcta:'a',
        explicacion:'Grupos >10 quedan en pendiente_confirmacion para que un host hable con el cliente.' },
      { pregunta:'¿Cuál es el horario "estelar" o más demandado de Fogueira?',
        a:'8am - 12pm', b:'12pm - 3pm', c:'3pm - 6pm', d:'7pm - 10pm', correcta:'c',
        explicacion:'El horario estelar configurado es 3pm-6pm; al cliente se le avisa "horario más demandado".' },
      { pregunta:'¿Qué columna de la bitácora marca como bandera roja si no se llena cuando hay cortesías?',
        a:'Encuesta', b:'Promo', c:'Autoriza', d:'Origen', correcta:'c',
        explicacion:'La columna "autoriza" debe llenarse si hay cortesía; si no, queda como bandera roja.' },
      { pregunta:'En el plano del salón, ¿qué significa "⏱ ~75 min" debajo de una mesa?',
        a:'Su capacidad', b:'El tiempo restante para cerrar', c:'Promedio histórico de duración de visitas en esa mesa (últimos 60 días)', d:'La hora de la próxima reserva', correcta:'c',
        explicacion:'Es el tiempo promedio de ocupación calculado del histórico (mínimo 3 muestras).' },
      { pregunta:'Si trabajas en varios dispositivos al mismo tiempo, ¿qué debes evitar?',
        a:'Usar reservas online desde más de uno', b:'Refrescar la página en ambos dispositivos', c:'Iniciar sesión en ambos con el mismo usuario', d:'Capturar el mismo walk-in en dos dispositivos a la vez (causa duplicados)', correcta:'d',
        explicacion:'Las reservas online sí se sincronizan, pero los walk-ins captúralos en UN dispositivo.' }
    ],
    // ==================== CAJERA ====================
    cajera: [
      { pregunta:'En el módulo de Conciliación, ¿qué se captura en el "Corte de Caja"?',
        a:'El desglose por denominación: cuántos billetes de $1000, $500, $200, etc.', b:'Solo el total en efectivo que hay en caja', c:'Las propinas de todos los meseros', d:'Los tickets cancelados del día', correcta:'a',
        explicacion:'Se captura el desglose por billete/moneda. El sistema suma y compara con la venta teórica.' },
      { pregunta:'¿Qué tipos de tarjetas se separan en la conciliación?',
        a:'Solo Visa y Mastercard juntas', b:'Débito y Crédito en general sin separar marcas', c:'Débito, Mastercard, AMEX, Visa', d:'Todas juntas en una sola línea', correcta:'c',
        explicacion:'Por análisis de comisiones se separan en Débito, Mastercard, AMEX y Visa.' },
      { pregunta:'¿Quiénes son los únicos autorizados para firmar cortesías?',
        a:'Cualquier mesero o cajera de turno', b:'La cajera y el encargado de piso juntos', c:'Gerente Administrativo y Gerente de Restaurante', d:'El admin del sistema', correcta:'c',
        explicacion:'Solo Mónica (Gerente Administrativo) y Gabriel (Gerente de Restaurante) autorizan cortesías.' },
      { pregunta:'¿Cuántos depósitos a tesorería se hacen al final del día?',
        a:'Uno solo con todo el efectivo', b:'Tres depósitos diferenciados', c:'Ninguno — va todo a caja grande', d:'Dos: uno de la venta del día y otro de las comisiones bancarias', correcta:'d',
        explicacion:'Reglas Fogueira: 2 depósitos separados — venta del día y comisiones bancarias.' },
      { pregunta:'¿Qué es el "arqueo ciego" que hace el sistema?',
        a:'Compara automáticamente lo contado contra el efectivo teórico calculado', b:'Es un sorteo de la diferencia entre cajeras', c:'Una multa automática si hay faltante', d:'Un descuento al cierre del mes', correcta:'a',
        explicacion:'El sistema compara contado vs teórico y muestra diferencia. Si hay sobrante/faltante grande, bandera roja.' },
      { pregunta:'Si al cierre hay banderas rojas, ¿qué debes hacer?',
        a:'NO firmar el cierre y avisar primero a la administradora', b:'Firmar igual y resolver al día siguiente antes de que lo vea el gerente', c:'Ignorarlas — siempre hay banderas en cualquier cierre', d:'Borrarlas manualmente para poder avanzar con el cierre', correcta:'a',
        explicacion:'Las banderas rojas (cortesías sin autorización, diferencias en arqueo) requieren explicación antes de firmar.' },
      { pregunta:'¿Qué pasa si capturas una cortesía sin folio del ticket?',
        a:'Nada, el sistema la acepta sin problemas', b:'Se borra automáticamente para no afectar el arqueo', c:'Queda como bandera roja al cierre', d:'Se cobra automáticamente a la cajera de turno', correcta:'c',
        explicacion:'Cortesías deben llevar folio y nombre del autoriza para tener trazabilidad.' },
      { pregunta:'En el módulo Conciliación, ¿qué hace el botón "Auto-llenar"?',
        a:'Cierra la caja y firma el sello automáticamente', b:'Crea una bitácora nueva para el día siguiente', c:'Borra todo lo capturado para empezar de cero', d:'Consolida automáticamente las bitácoras del backend en los datos de apertura/cierre', correcta:'d',
        explicacion:'Auto-llenar lee las bitácoras del día y consolida (Desayuno→ap, Comida→ci, Buffet→ap).' },
      { pregunta:'¿Qué pasa con las propinas de tarjeta según las reglas Fogueira?',
        a:'Se quedan permanentemente en caja', b:'Se cobran al patrón al fin de quincena', c:'Se anulan — Fogueira no acepta propinas en tarjeta', d:'Se retira efectivo equivalente del cajón el mismo día para entregarlo al personal', correcta:'d',
        explicacion:'Propinas en tarjeta: se retira efectivo equivalente del cajón para entregarlas al personal el mismo día.' },
      { pregunta:'¿Cuándo aparece el "Tablero de sellos" en Conciliación?',
        a:'En todas las pestañas de conciliación', b:'Solo en la pestaña de Apertura', c:'No aparece en la vista de cajera', d:'En la sección 05 del Cierre Profundo (lista lo esperado vs lo firmado)', correcta:'d',
        explicacion:'El tablero está en la sección 05 (read-only para cajera; admin puede hacer override con motivo).' },
      { pregunta:'¿Cuál es el cupo máximo de personas reservadas online por servicio?',
        a:'25 personas', b:'92 personas (aforo completo)', c:'50 personas', d:'100 personas', correcta:'c',
        explicacion:'50 reservadas online por servicio; walk-ins suman aparte hasta aforo 92.' },
      { pregunta:'Si una bitácora se cae o se pierde durante el servicio, ¿qué hace el sistema?',
        a:'Pierde todo y debes recapturar desde cero', b:'No tiene respaldo — es responsabilidad del host', c:'Manda email automático a la cajera y al gerente', d:'Reintenta guardar de manera infinita y al cerrar el navegador usa sendBeacon como respaldo', correcta:'d',
        explicacion:'Triple protección: BitacoraFilas individual + reintentos infinitos + sendBeacon emergencia.' },
      { pregunta:'¿Qué tarifa aplica un niño de 9 años?',
        a:'Tarifa niño $249', b:'Cortesía (gratuito)', c:'Tarifa adulto $590', d:'Mitad de la tarifa adulto ($295)', correcta:'a',
        explicacion:'6-10 años pagan tarifa niño. 0-5 cortesía. 11+ adulto.' },
      { pregunta:'En el corte, ¿cómo se deben capturar los billetes?',
        a:'Mezclados en un solo campo de total', b:'Solo el total sin desglose', c:'Sin contar — se captura después del cierre', d:'Por denominación, capturando cantidad de billetes de cada valor', correcta:'d',
        explicacion:'Captura por denominación; el sistema multiplica y suma para minimizar errores.' },
      { pregunta:'Si te equivocas al capturar una cortesía, ¿qué haces?',
        a:'Lo dejas así y lo explicas verbalmente al cierre del día', b:'Borras toda la bitácora para recapturar desde cero', c:'Editas la fila desde el detalle (botón ✎) o pides al admin que corrija', d:'Llamas a soporte técnico de Germán para que lo corrija él', correcta:'c',
        explicacion:'Cada fila se puede editar desde el detalle; el cambio queda en auditoría.' },
      { pregunta:'¿Qué significa "sello autenticado" en el cierre?',
        a:'La firma se hace desde el módulo del usuario logueado, imposible firmar por otro', b:'Una calcomanía física con código de colores', c:'Una contraseña adicional de 6 dígitos', d:'Un código QR que se escanea con el teléfono', correcta:'a',
        explicacion:'Cada quien firma desde su sesión autenticada; queda con su user_id y email. Override admin requiere motivo.' },
      { pregunta:'¿Cuál es el horario del Buffet completo (Lun-Jue)?',
        a:'8am - 12pm', b:'12pm - 6pm', c:'10am - 8pm', d:'1pm - 11pm', correcta:'d',
        explicacion:'Lun-Jue Buffet completo es de 1pm a 11pm.' },
      { pregunta:'Las cortesías para niños de 0 a 5 años, ¿necesitan autorización del gerente?',
        a:'No, son cortesías automáticas por edad', b:'Sí, siempre — toda cortesía requiere gerente', c:'Solo en fin de semana cuando aplica tarifa diferente', d:'Solo si hay más de 3 niños en el mismo grupo', correcta:'a',
        explicacion:'0-5 años es cortesía automática (no pagan). No requiere firma de gerente.' },
      { pregunta:'En el sistema, ¿qué información guarda la columna "ticket" de cortesías?',
        a:'El número de mesa donde estaba el grupo', b:'La hora de salida del grupo', c:'El nombre completo del cliente', d:'El folio físico del ticket POS asociado a esa cortesía', correcta:'d',
        explicacion:'Permite cruzar con el ticket POS para auditoría.' },
      { pregunta:'Al firmar tu sello de cierre como cajera, ¿qué pasa si te equivocaste?',
        a:'Solo el admin puede hacer override con motivo registrado en auditoría', b:'No se puede deshacer nada — el sello es permanente en todos los casos', c:'Cierras sesión y vuelves a firmar desde cero', d:'Llamas al soporte técnico para que lo borre del sistema', correcta:'a',
        explicacion:'Override admin requiere motivo y queda en auditoría como "es_override=true".' },
      { pregunta:'¿Qué se hace si el cliente paga con vale o cupón especial?',
        a:'Se ignora y se cobra como efectivo', b:'Se cobra siempre como efectivo para simplificar', c:'Se captura como una forma de pago específica según indique el procedimiento', d:'Se rechaza — Fogueira no acepta vales', correcta:'c',
        explicacion:'Hay categorías para vales/cupones; sigue el procedimiento del módulo de pagos.' },
      { pregunta:'¿Hasta qué hora del día siguiente puede durar tu sesión iniciada?',
        a:'Hasta medianoche del mismo día', b:'Hasta las 6 am del día siguiente', c:'Hasta las 3:00 am del día siguiente', d:'Hasta las 12 pm del día siguiente', correcta:'c',
        explicacion:'La sesión cubre día lógico de restaurante: hasta las 3 am.' },
      { pregunta:'Si en el cierre ves que el efectivo contado es MENOR al teórico, ¿qué se llama eso?',
        a:'Sobrante de caja (excedente)', b:'Cuadre neutro (sin diferencia)', c:'Diferencia positiva (ingreso extra)', d:'Faltante', correcta:'d',
        explicacion:'Faltante = lo contado es menor a lo teórico. Hay que investigar antes de firmar.' },
      { pregunta:'¿Qué significa una bandera roja en la conciliación?',
        a:'Que el día es feriado y aplican tarifas especiales', b:'Que la bitácora ya está cerrada y no se puede editar', c:'Una alerta del sistema (cortesía sin autorización, diferencia en arqueo, etc.) que requiere explicación', d:'Que hay un descuento aplicado al grupo', correcta:'c',
        explicacion:'Banderas rojas requieren atención y explicación antes de firmar el cierre.' },
      { pregunta:'¿Cuál es el orden correcto del cierre del día?',
        a:'Firmar primero y luego conciliar los detalles', b:'Solo firmar sin necesidad de capturar nada', c:'Borrar la bitácora primero y luego crear la conciliación', d:'Capturar corte de caja → tarjetas → cortesías → depósitos → arqueo → revisar banderas → firmar', correcta:'d',
        explicacion:'El orden lógico que valida arqueo y banderas antes de firmar.' }
    ],
    // ==================== COCINA ====================
    cocina: [
      { pregunta:'¿Cuál es el módulo principal que usa Cocina en el sistema?',
        a:'Bitácora del servicio', b:'Conciliación de caja', c:'Charolas', d:'Reservaciones', correcta:'c',
        explicacion:'Cocina usa el módulo Charolas para registrar cada salida de buffet.' },
      { pregunta:'¿Cada cuándo registras una charola en el sistema?',
        a:'Cada vez que sacas una charola al buffet', b:'Una vez al final del servicio (resumen del día)', c:'Solo cuando la charola se acaba completamente', d:'Una vez a la semana en el inventario', correcta:'a',
        explicacion:'Cada charola = un registro en vivo, con qué es y la cantidad.' },
      { pregunta:'Si una charola se daña o queda sobrante al final, ¿cómo se registra?',
        a:'Se ignora — no afecta el inventario', b:'Se cobra al cliente como cargo adicional', c:'Se regala sin registrar porque ya no hay tiempo', d:'Se captura como "Merma"', correcta:'d',
        explicacion:'Merma se registra para que la administradora calcule costo real y optimice pedidos.' },
      { pregunta:'¿Qué información se captura por cada charola?',
        a:'Solo el peso en kilogramos de la charola', b:'Qué es (carne, postre, ensalada, etc.) y la cantidad', c:'El precio de venta al cliente de ese platillo', d:'El número de mesa que la solicitó primero', correcta:'b',
        explicacion:'Tipo de platillo + cantidad. El sistema timestamp y responsable.' },
      { pregunta:'¿Para qué sirve la información que captura Cocina?',
        a:'La administradora calcula costo real del servicio y optimiza pedidos al almacén', b:'Para multar al equipo si hay mermas', c:'Para calcular la nómina del personal', d:'No se usa — es solo registro histórico', correcta:'a',
        explicacion:'Información valiosa para análisis de costo y planeación de inventario.' },
      { pregunta:'¿En qué momento debe firmarse el sello de apertura de Cocina?',
        a:'Al final del servicio cuando todo está cerrado', b:'Nunca — cocina no tiene sello de apertura', c:'A la mitad del turno cuando llegan las carnes', d:'Al inicio del servicio cuando ya está listo el setup', correcta:'d',
        explicacion:'Apertura: el sistema espera tu firma autenticada al inicio del servicio.' },
      { pregunta:'¿Tu sello de cocina lo puede firmar otra persona desde su cuenta?',
        a:'Sí, cualquiera del equipo puede firmar por ti', b:'No, cada quien firma desde SU sesión (sello autenticado por user_id)', c:'Solo el admin con override y motivo', d:'Solo la cajera si tiene doble rol', correcta:'b',
        explicacion:'Sellos son autenticados: imposible firmar por otra persona desde su cuenta.' },
      { pregunta:'Si te equivocaste al capturar la cantidad de una charola, ¿qué haces?',
        a:'Borras toda la bitácora para recapturar', b:'Lo dejas mal — no es tan importante', c:'Editas el registro o avisas al admin que corrija', d:'Cierras sesión y vuelves a entrar', correcta:'c',
        explicacion:'Cada captura se puede corregir; queda registro de auditoría.' },
      { pregunta:'¿Qué tipos de charola registras típicamente en Fogueira?',
        a:'Carnes, ensaladas, postres, guarniciones — todo lo que sale al buffet', b:'Solo carnes para el rodizio', c:'Solo bebidas y postres', d:'Solo lo que se cobra extra al cliente', correcta:'a',
        explicacion:'Todo lo que sale al buffet se registra para cuantificar el servicio.' },
      { pregunta:'¿Con qué frecuencia recargas el buffet?',
        a:'Cada 4 horas fijas sin importar demanda', b:'Solo al inicio del servicio una sola vez', c:'Una vez al día al mediodía en punto', d:'Según demanda y reposición visual del buffet', correcta:'d',
        explicacion:'Reposición continua según demanda; cada reposición = registro nuevo.' },
      { pregunta:'¿Hasta qué hora dura tu sesión iniciada en el sistema?',
        a:'Solo 1 hora después de iniciar', b:'Hasta el mediodía del mismo día', c:'Hasta las 3:00 am del día siguiente', d:'Hasta cerrar el navegador', correcta:'c',
        explicacion:'La sesión cubre todo el día operativo: hasta 3 am.' },
      { pregunta:'¿Quién es el responsable de capturar las charolas que salen?',
        a:'El cliente al llegar a servirse', b:'La persona de Cocina o Churrasca encargada del buffet', c:'El admin del sistema desde admin.html', d:'La cajera en el módulo de conciliación', correcta:'b',
        explicacion:'Cocina (platos calientes/fríos) y Churrasca (carnes en espada) son responsables cada uno de su área.' },
      { pregunta:'En tu pantalla Charolas, ¿qué hace el botón "+ Nueva charola"?',
        a:'Crea una nueva receta en el recetario', b:'Cierra el sistema hasta el siguiente turno', c:'Abre el formulario para registrar una charola que estás sacando ahora', d:'Imprime un ticket con el resumen del turno', correcta:'c',
        explicacion:'Cada salida de charola se registra con el botón + en vivo.' },
      { pregunta:'Si el sistema marca tu firma como "pendiente" pero ya pasó la apertura, ¿qué haces?',
        a:'Firmar tu sello de apertura desde tu pantalla cuando puedas', b:'Ignorarlo — el sistema lo firmará automáticamente pasada 1 hora', c:'Avisar a Germán para que firme por ti desde el código', d:'Cerrar el sistema y esperar al siguiente turno para firmarlo', correcta:'a',
        explicacion:'Tu sello lo firmas tú. Aparece pendiente hasta que vayas a tu pantalla y lo selles.' },
      { pregunta:'¿Por qué es crítico capturar las mermas correctamente?',
        a:'Para presumirle a la administradora el control que llevas', b:'No es importante — la merma es normal en cualquier cocina', c:'Para sacarla del inventario del POS automáticamente', d:'Para que no se pierda dinero al patrón sin justificar', correcta:'d',
        explicacion:'Mermas justifican lo no servido; sin captura, hay merma "fantasma" en costos.' },
      { pregunta:'¿Quién accede a la información que tú capturas de charolas?',
        a:'Solo tú desde tu cuenta', b:'Administradora, gerentes, auditoría — para análisis de costo y operación', c:'Nadie más — es privada de cocina', d:'Solo el cliente si la pide', correcta:'b',
        explicacion:'Es información gerencial para análisis y toma de decisiones.' },
      { pregunta:'Si capturas una charola y por error pones una cantidad muy alta (ejemplo: 50 en lugar de 5), ¿qué pasa?',
        a:'No pasa nada — el sistema detecta anomalías y las ignora', b:'Se cobra al cliente ese exceso', c:'Se cancela automáticamente el sistema de charolas', d:'Distorsiona el análisis de costo; debes corregirla cuanto antes', correcta:'d',
        explicacion:'Datos sesgados afectan análisis. Corrección rápida es importante.' },
      { pregunta:'En tu pantalla, ¿puedes editar un registro previo del día?',
        a:'Sí, mientras siga el día y queda registro de auditoría', b:'No, jamás — lo capturado es permanente', c:'Solo el admin puede editar registros de cocina', d:'Solo a las 3 am cuando se cierra el día lógico', correcta:'a',
        explicacion:'Se puede corregir el mismo día con auditoría; al día siguiente puede requerir intervención de admin.' },
      { pregunta:'¿Para qué sirve que captures el TIPO de charola (carne, postre, etc.)?',
        a:'Para fines decorativos del reporte visual', b:'No sirve — solo el nombre del platillo importa', c:'Permite analizar consumo por categoría y optimizar pedidos al almacén', d:'Para imprimir el menú del día automáticamente', correcta:'c',
        explicacion:'Categorización permite ver qué se consume más y planear inventario.' },
      { pregunta:'¿Qué pasa si NO firmas el sello de cocina al inicio del servicio?',
        a:'Nada — el sello es opcional para cocina', b:'Aparece como pendiente en el tablero de sellos y queda como bandera al cierre', c:'Se cobra al patrón como falta laboral', d:'No puedes salir del restaurante hasta firmarlo', correcta:'b',
        explicacion:'Falta de firma queda visible en tablero y es bandera para auditoría.' },
      { pregunta:'¿Quién puede ver tus capturas en tiempo real?',
        a:'Solo tú desde tu cuenta de cocina', b:'El cliente desde su teléfono personal', c:'La administradora, gerentes y auditoría desde sus paneles', d:'Nadie más — es info interna de cocina', correcta:'c',
        explicacion:'Información operativa visible para gerencia en tiempo real.' },
      { pregunta:'Si la administradora te dice "captura tal merma con motivo", ¿qué haces?',
        a:'Discutes porque tú decides qué se captura en cocina', b:'La ignoras — ese dato lo captura ella desde conciliación', c:'Llamas a otro turno para que lo haga', d:'Capturas la merma con el motivo en la columna correspondiente y avisas al cierre', correcta:'d',
        explicacion:'Sigue la indicación; el motivo queda registrado para trazabilidad.' },
      { pregunta:'¿Qué dispositivos puedes usar para capturar charolas?',
        a:'Solo PC de escritorio', b:'Cualquier dispositivo con navegador (PC, tablet, smartphone)', c:'Solo tablets con sistema Android', d:'Solo iPhone de la empresa', correcta:'b',
        explicacion:'El sistema es web y funciona en cualquier navegador moderno.' },
      { pregunta:'Tu rol como cocina, ¿puede ver la conciliación o caja?',
        a:'No, tu rol está limitado a Charolas y Manual', b:'Sí, cocina puede ver todo el sistema', c:'Solo en fin de semana para verificar ventas', d:'Solo si lo pide el patrón expresamente', correcta:'a',
        explicacion:'Por separación de funciones, cocina solo ve su módulo + manual.' },
      { pregunta:'¿Cada cuánto debes recertificarte (renovar el examen)?',
        a:'Cada año junto con la evaluación anual', b:'Cada 6 meses', c:'Una sola vez de por vida al ingresar', d:'Cada mes para mantener la certificación activa', correcta:'b',
        explicacion:'Vigencia 6 meses; el sistema te avisa cuando se acerque o se pase la fecha.' }
    ],
    // ==================== CHURRASCA ====================
    churrasca: [
      { pregunta:'¿Cuál es la principal responsabilidad de Churrasca en Fogueira?',
        a:'Atender el rodizio: pasar carnes en espada a las mesas y registrar lo que sale', b:'Cobrar a los clientes en la entrada', c:'Conciliar caja al cierre del día', d:'Hacer reservas y recibir clientes en la puerta', correcta:'a',
        explicacion:'Churrasca opera el rodizio (carnes en espada que se pasan a las mesas).' },
      { pregunta:'¿En qué módulo del sistema registras las espadas que sales?',
        a:'Bitácora del host', b:'Conciliación de caja', c:'Charolas', d:'Módulo de Caja', correcta:'c',
        explicacion:'El módulo Charolas se usa tanto para Cocina como para Churrasca.' },
      { pregunta:'¿Quién más debe firmar el sello de apertura junto contigo?',
        a:'Solo tú — churrasca firma su propio sello independiente', b:'El cliente más antiguo del día como testigo', c:'El admin del sistema (Germán)', d:'La cocina (los dos chefs firman: cocina y churrasca)', correcta:'d',
        explicacion:'Apertura requiere sello de cocina Y de churrasca, cada uno desde su sesión.' },
      { pregunta:'¿Tu sello lo puede firmar la cocina por ti?',
        a:'Sí, son del mismo equipo y comparten responsabilidades', b:'No, cada quien firma desde SU cuenta autenticada', c:'Sí, si te lo pide Mónica expresamente', d:'Solo el admin puede firmar por otro con override', correcta:'b',
        explicacion:'Cada sello es individual y autenticado: imposible firmar por otra persona.' },
      { pregunta:'Si una espada no se sirvió completa y queda merma, ¿qué haces?',
        a:'Tirarla sin registrar — es pérdida operativa normal', b:'Cobrarla aparte como costo extra', c:'Capturarla como Merma con el tipo correspondiente', d:'Comerla con el equipo sin registrar', correcta:'c',
        explicacion:'Merma siempre se registra para análisis de costo y optimización.' },
      { pregunta:'¿Cuál es la tarifa de adulto en Buffet completo (Lun-Jue)?',
        a:'$299 adulto (desayuno fin de semana)', b:'$590 adulto', c:'$249 adulto (tarifa niño)', d:'$890 adulto (tarifa premium)', correcta:'b',
        explicacion:'Lun-Jue Buffet completo $590 adulto.' },
      { pregunta:'¿Cuál es el horario del rodizio en fin de semana (Comida)?',
        a:'8am - 12pm (Desayuno)', b:'12pm - 6pm solamente', c:'8pm - 2am (horario nocturno)', d:'1pm - 11pm', correcta:'d',
        explicacion:'Vie-Dom comida 1pm-11pm/9pm. Es cuando el rodizio funciona a tope.' },
      { pregunta:'¿Cuál es el aforo físico máximo del restaurante?',
        a:'92 personas', b:'50 personas (igual al cupo online)', c:'150 personas', d:'120 personas', correcta:'a',
        explicacion:'Aforo físico 92 personas. El cupo de reservas online es 50 (deja espacio para walk-ins).' },
      { pregunta:'En tu pantalla Charolas, al sacar una espada de chorizo, ¿qué capturas?',
        a:'Tipo (chorizo) + cantidad de espadas', b:'Solo el peso en gramos de la espada', c:'El precio de venta al público', d:'La mesa exacta donde se sirvió', correcta:'a',
        explicacion:'Tipo + cantidad. El sistema registra automáticamente quién y cuándo.' },
      { pregunta:'¿A partir de qué edad un niño paga tarifa de adulto?',
        a:'8 años', b:'10 años', c:'11 años', d:'12 años', correcta:'c',
        explicacion:'11+ años pagan tarifa adulto. 0-5 cortesía. 6-10 niño.' },
      { pregunta:'Si capturas mal una espada, ¿se puede corregir?',
        a:'No, jamás — lo capturado es permanente', b:'Sí, editas o pides al admin que corrija; queda en auditoría', c:'Solo el cliente puede solicitar la corrección', d:'Solo en horario nocturno después de las 10pm', correcta:'b',
        explicacion:'Editable con auditoría. La trazabilidad nunca se pierde.' },
      { pregunta:'¿Por qué es importante registrar TODAS las salidas?',
        a:'No es importante — es solo un formalismo', b:'Solo importa para el cliente que puede reclamar', c:'Para calcular el bono del churrasquero', d:'Es info crítica para costos, control de inventario y análisis del servicio', correcta:'d',
        explicacion:'Sin registro, no hay control de costo ni de inventario.' },
      { pregunta:'¿Hasta qué hora dura tu sesión iniciada?',
        a:'Solo 30 minutos por seguridad', b:'Hasta las 3:00 am del día siguiente', c:'Exactamente 8 horas después de iniciar', d:'Hasta que cierras el navegador', correcta:'b',
        explicacion:'Día lógico de restaurante: hasta 3 am.' },
      { pregunta:'¿Qué pasa si NO firmas tu sello de apertura?',
        a:'Aparece como pendiente en el tablero; queda bandera al cierre', b:'Nada — el sello es opcional para churrasca', c:'El sistema lo firma automáticamente a la hora de apertura', d:'Se cobra al patrón como penalización', correcta:'a',
        explicacion:'Tu sello aparece pendiente y la cajera/admin lo verán al cerrar.' },
      { pregunta:'¿Tu rol puede ver el módulo de conciliación de caja?',
        a:'Sí, churrasca ve todo el sistema completo', b:'Solo si Mónica te da acceso especial', c:'Solo en fines de semana para verificar sus horas', d:'No, churrasca solo ve Charolas y su Manual', correcta:'d',
        explicacion:'Por separación de funciones, churrasca tiene acceso limitado.' },
      { pregunta:'Si te das cuenta a media jornada que olvidaste registrar 3 espadas previas, ¿qué haces?',
        a:'Las dejas pasar — ya es tarde para capturarlas', b:'Te vas a buscar a Mónica para que las capture', c:'Capturas las 3 ahora con la hora correspondiente o con nota; mejor ahora que nunca', d:'Avisas al cliente de la mesa', correcta:'c',
        explicacion:'Capturarlas tarde es mejor que no capturarlas; avisa al cierre si fueron muchas.' },
      { pregunta:'¿Qué información permite el análisis de "qué tipo de carne se consume más"?',
        a:'Una adivinanza basada en experiencia', b:'El reporte automático del POS SoftRestaurant', c:'Las capturas tuyas y de cocina por tipo y cantidad', d:'La cámara de seguridad del restaurante', correcta:'c',
        explicacion:'Tu data alimenta los reportes gerenciales de consumo por tipo.' },
      { pregunta:'¿Quién analiza tu data al cierre del día?',
        a:'Nadie la analiza — es solo registro', b:'El cliente si lo solicita', c:'Solo el cocinero principal Marco', d:'Administradora, gerentes y auditoría', correcta:'d',
        explicacion:'Es información operativa-gerencial.' },
      { pregunta:'Tu rol, ¿puede modificar usuarios o tarifas del sistema?',
        a:'No, eso solo lo hace el admin/gerente administrativo', b:'Sí, churrasca tiene acceso completo', c:'Solo en navidad hay permisos especiales', d:'Solo en mayo al arranque del sistema', correcta:'a',
        explicacion:'Cambios de configuración están restringidos al rol admin.' },
      { pregunta:'¿Para qué sirve la columna "responsable_email" en charolas?',
        a:'Decoración del reporte PDF', b:'Auditoría: identifica quién registró cada salida', c:'Para enviar publicidad al churrasquero', d:'No sirve para nada — es campo heredado', correcta:'b',
        explicacion:'Trazabilidad: cada captura queda asociada al usuario que la hizo.' },
      { pregunta:'Si trabajas en varios dispositivos, ¿hay riesgo de duplicar?',
        a:'No, el sistema detecta duplicados automáticamente', b:'Solo en iPhone porque Safari tiene bugs', c:'No aplica para churrasca — son espadas distintas', d:'Sí, evita capturar la MISMA salida en dos dispositivos a la vez', correcta:'d',
        explicacion:'Misma indicación que para hosts: una salida = un dispositivo a la vez.' },
      { pregunta:'En el tablero de sellos del cierre, ¿qué significa que tu sello aparezca en verde "✓ Firmado"?',
        a:'Que firmaste correctamente desde tu cuenta autenticada', b:'Que estás de vacaciones ese día', c:'Que el sello está pendiente de revisión', d:'Una alerta de sello próximo a vencer', correcta:'a',
        explicacion:'Verde = sello completado por la persona correcta en su sesión.' },
      { pregunta:'¿Cada cuánto necesitas renovar tu certificación?',
        a:'Una sola vez al ingresar a la empresa', b:'Cada 6 meses', c:'Cada año con la evaluación de desempeño', d:'Cada semana con quiz corto', correcta:'b',
        explicacion:'Vigencia 6 meses; antes el sistema te avisa.' },
      { pregunta:'En el examen actual, ¿cuántas preguntas tendrás?',
        a:'5 preguntas básicas', b:'10 preguntas estándar', c:'15 preguntas sorteadas del banco', d:'20 preguntas completas', correcta:'c',
        explicacion:'15 preguntas sorteadas del banco de tu rol.' },
      { pregunta:'¿Cuál es la calificación mínima para aprobar el examen?',
        a:'10/15 (67%)', b:'12/15 (80%)', c:'14/15 (90%)', d:'15/15 (100% perfecto)', correcta:'c',
        explicacion:'Mínimo 14/15 (≥90%) para aprobar y certificarte.' }
    ],
    // ==================== ENCARGADO DE PISO ====================
    encargado_piso: [
      { pregunta:'¿Cuál es la responsabilidad principal del Encargado de Piso?',
        a:'Coordinar la operación en piso: hosts, meseros, fluidez del servicio', b:'Conciliar caja al cierre del día', c:'Gestionar la nómina del personal', d:'Supervisar la cocina durante el rodizio', correcta:'a',
        explicacion:'Encargado de piso supervisa la operación frontline en tiempo real.' },
      { pregunta:'Si una host detecta que el cliente está esperando demasiado, ¿qué haces?',
        a:'Ignorarlo — es responsabilidad de la cajera', b:'Acercarte, identificar el bloqueo y coordinar para destrabarlo', c:'Anular la reserva y liberar la mesa', d:'Llamar a Germán de soporte técnico', correcta:'b',
        explicacion:'Tu rol es destrabar problemas operativos en piso en tiempo real.' },
      { pregunta:'¿Qué información del sistema necesitas monitorear continuamente?',
        a:'Solo el menú del día y recetas activas', b:'Solo el módulo de caja en tiempo real', c:'Plano del salón, reservaciones, bitácora del servicio', d:'Solo los ingresos del día en conciliación', correcta:'c',
        explicacion:'Plano (mesas y estados), reservas (llegadas), bitácora (capturas) son tus tableros.' },
      { pregunta:'Si una mesa lleva mucho tiempo sin terminar y hay gente esperando, ¿qué pasos sigues?',
        a:'Echarlos a la fuerza con el apoyo de seguridad', b:'Cancelar al cliente que espera y ofrecerle otra fecha', c:'No hacer nada — respetar el tiempo del cliente sin límite', d:'Verificar el plano, hablar con la host, si necesario coordinar otra solución (mesa más chica, espera, etc.)', correcta:'d',
        explicacion:'El sistema te muestra duración promedio y tiempo en mesa; coordina con criterio.' },
      { pregunta:'¿Cuál es el cupo máximo de personas reservadas online por servicio?',
        a:'30', b:'92', c:'100', d:'50', correcta:'d',
        explicacion:'50 reservadas online + walk-ins hasta aforo de 92.' },
      { pregunta:'¿Quiénes son los únicos que pueden autorizar cortesías?',
        a:'Gerente Administrativo (Mónica) y Gerente de Restaurante (Gabriel)', b:'El encargado de piso y el host de turno', c:'La cajera junto con el encargado de piso', d:'Cualquier mesero con más de 6 meses en la empresa', correcta:'a',
        explicacion:'Solo Mónica y Gabriel autorizan cortesías; tú no.' },
      { pregunta:'Si un host tiene problemas con el sistema, ¿qué haces tú primero?',
        a:'Llamar a Germán de inmediato', b:'Apoyarlo, verificar si es problema de captura o real, y escalar si es técnico', c:'Anular la jornada y reabrir desde cero', d:'Pedir disculpas al cliente y ofrecerle descuento', correcta:'b',
        explicacion:'Primer apoyo eres tú; si es técnico real, escalas a soporte.' },
      { pregunta:'¿Qué hace el botón "Pausar reservas" del módulo Reservaciones?',
        a:'Cancela todas las reservas ya confirmadas del día', b:'Cierra el restaurante en el sistema hasta el siguiente turno', c:'Bloquea NUEVAS reservas online del día (lleno o emergencia)', d:'Pausa al equipo en el tablero de sellos', correcta:'c',
        explicacion:'Bloqueo del flujo de reservas online del día. Avisa antes a la administradora.' },
      { pregunta:'¿En qué horario es el "estelar" o más demandado?',
        a:'8am - 12pm', b:'12pm - 3pm', c:'3pm - 6pm', d:'9pm - 12am', correcta:'c',
        explicacion:'3pm-6pm es horario estelar configurado.' },
      { pregunta:'Cuando llega un grupo grande sin reserva, ¿qué consideras?',
        a:'Ignorarlos y pedirles que hagan reserva online', b:'Verificar mesas disponibles en plano, pax, capacidad y coordinar con host', c:'Enviarlos a otro restaurante hermano del grupo', d:'Cancelar la reserva más pequeña para acomodarlos', correcta:'b',
        explicacion:'Tu rol es asignar bien con criterio operativo.' },
      { pregunta:'Si la sugerencia automática de mesa propone "Mesa 6 (2 pax)" para un grupo de 4, ¿es correcta?',
        a:'No: la mesa 6 (2 pax) no cabe a 4 personas; el sistema NO la sugeriría', b:'Solo en domingo aplica la sugerencia por capacidad', c:'Sí, si están delgados caben en mesa de 2', d:'Sí, el sistema siempre tiene razón', correcta:'a',
        explicacion:'La sugerencia filtra por capacidad ≥ pax: Mesa 6 cap 2 NO se sugeriría para 4 personas.' },
      { pregunta:'¿Cómo se considera "Desocupada" una mesa?',
        a:'Solo cuando se limpia físicamente y el mesero lo reporta', b:'Manualmente desde el panel de admin', c:'Cuando pasan 30 minutos de inactividad automáticamente', d:'Cuando la host captura la hora_sal de la fila, el estado pasa solo a Desocupada', correcta:'d',
        explicacion:'Auto-cambio del sistema al capturar hora salida; señal para limpiar y reasignar.' },
      { pregunta:'¿Qué pasa si una reserva pasa 10 min de tolerancia y no llega el cliente?',
        a:'Se cancela sola automáticamente para liberar el cupo', b:'Queda visualmente atrasada (rojo) pero NO se cancela; el host decide', c:'Se duplica como segunda reserva de respaldo', d:'Se cobra al cliente la mitad de la tarifa', correcta:'b',
        explicacion:'Tolerancia interna 10 min visual; tu/host decide marcarla como "No llegó" con motivo.' },
      { pregunta:'¿Cuáles son los dos depósitos a tesorería que se hacen al día?',
        a:'Solo uno con todo el efectivo del día', b:'Venta del día y propinas de tarjeta (separados)', c:'Venta del día y comisiones bancarias (separados)', d:'Tres depósitos: venta, tarjeta y propinas', correcta:'c',
        explicacion:'Reglas Fogueira: 2 depósitos diferenciados.' },
      { pregunta:'Hasta qué hora del día siguiente dura tu sesión iniciada?',
        a:'Medianoche del mismo día', b:'6:00 am del día siguiente', c:'12:00 pm del día siguiente', d:'3:00 am del día siguiente', correcta:'d',
        explicacion:'Día lógico de restaurante: 3 am del día siguiente.' },
      { pregunta:'En el plano del salón, ¿qué significa "🟡 En espera"?',
        a:'Reserva confirmada con cliente que aún no llega', b:'Mesa libre lista para asignar', c:'Mesa sucia pendiente de limpieza', d:'Cliente que ya comió y espera su cuenta', correcta:'a',
        explicacion:'Reserva confirmada pero el cliente no ha entrado físicamente.' },
      { pregunta:'¿Cuál es la prioridad #1 cuando hay banderas rojas en el cierre?',
        a:'Resolverlas/explicarlas antes de firmar el cierre', b:'Firmar igual para no retrasar el proceso', c:'Borrar la bitácora y recriar desde cero', d:'Llamar al cliente para que aclare el problema', correcta:'a',
        explicacion:'Banderas rojas requieren explicación; nunca firmar a la ligera.' },
      { pregunta:'¿Qué tarifa aplica un niño de 7 años?',
        a:'Cortesía (0-5 años)', b:'$249 (tarifa niño)', c:'$299 (desayuno adulto)', d:'$590 (adulto)', correcta:'b',
        explicacion:'6-10 años → tarifa niño $249.' },
      { pregunta:'Si la administradora te pide pausar reservas porque están llenos, ¿qué pasa con las que ya están?',
        a:'Se cancelan automáticamente para liberar aforo', b:'Se borran del sistema hasta el día siguiente', c:'Las existentes se respetan; solo se bloquean las NUEVAS', d:'Se duplican para dar aviso a los clientes', correcta:'c',
        explicacion:'Pausa solo afecta nuevas reservas online; las ya creadas se mantienen.' },
      { pregunta:'¿Qué tipo de eventos los gerentes deben aprobar antes de cualquier acción del host?',
        a:'Cualquier acción mínima del host', b:'Solo si el cliente paga con tarjeta', c:'Ninguno — el host puede decidir todo', d:'Cancelaciones masivas, cortesías, cambios de tarifa', correcta:'d',
        explicacion:'Eventos sensibles requieren autorización de gerente con registro.' },
      { pregunta:'¿Qué información sirve para predecir cuándo se libera una mesa?',
        a:'El nombre del cliente que está sentado', b:'El total de la cuenta del grupo en el POS', c:'Tiempo promedio histórico (⏱) + tiempo transcurrido en la mesa actual', d:'El menú que pidió cada persona', correcta:'c',
        explicacion:'El sistema muestra promedio histórico de la mesa para que estimes liberación.' },
      { pregunta:'Si necesitas saber cuántas personas están actualmente comiendo, ¿dónde lo ves?',
        a:'Llamando al cliente directamente', b:'En la bitácora del servicio activo o en el mini-resumen del salón', c:'Revisando el ticket del POS en caja', d:'En la configuración del sistema', correcta:'b',
        explicacion:'Mini-resumen del salón muestra ocupadas, libres, en espera, total pax.' },
      { pregunta:'¿Cómo te enteras si un cliente cancela su reserva online?',
        a:'No te enteras hasta el cierre del día', b:'Por WhatsApp directo del cliente', c:'Por email automático enviado a tu cuenta', d:'Aparece un toast/aviso visual en la pantalla del host (y la reserva pasa a "Canceladas")', correcta:'d',
        explicacion:'Aviso visual inmediato para que reasignen el cupo.' },
      { pregunta:'Si tu rol detecta una emergencia (incendio, lesión), ¿qué primero?',
        a:'Atender la emergencia física primero; el sistema espera', b:'Capturarla en el sistema antes de actuar', c:'Llamar a soporte técnico de Germán', d:'Cerrar el sistema para evitar pérdida de datos', correcta:'a',
        explicacion:'Sentido común: emergencias físicas tienen prioridad sobre captura.' },
      { pregunta:'Si el sistema te avisa "Tu certificación venció", ¿qué pasa?',
        a:'Aparece banner suave; puedes seguir trabajando pero debes recertificarte cuando puedas', b:'Te bloquean el acceso al sistema inmediatamente', c:'Se borra tu sesión activa y debes volver a iniciar', d:'Se notifica automáticamente a Mónica para que te suspenda', correcta:'a',
        explicacion:'No bloquea entrada; solo te recuerda renovar.' }
    ],
    // ==================== GERENTE DE RESTAURANTE ====================
    gerente_restaurante: [
      { pregunta:'¿Junto con quién es el Gerente de Restaurante uno de los autorizados a firmar cortesías?',
        a:'El Gerente Administrativo (Mónica)', b:'Cualquier host de turno', c:'La cajera junto con el encargado de piso', d:'El admin del sistema (Germán)', correcta:'a',
        explicacion:'Solo Mónica (G. Admin) y tú (G. Restaurante) autorizan cortesías.' },
      { pregunta:'¿De qué rol heredas privilegios técnicos en el sistema?',
        a:'Admin', b:'Host', c:'Auditoría', d:'Cajera', correcta:'b',
        explicacion:'Gerente_restaurante hereda los privilegios de host (puedes operar bitácora, reservas, plano).' },
      { pregunta:'Si una cortesía aparece sin tu nombre como "autoriza", ¿qué pasa?',
        a:'Nada — se acepta sin firma si el monto es menor a $100', b:'Se cobra automáticamente al host que la capturó', c:'Es bandera roja al cierre — debe llevar nombre del autorizante', d:'Se ignora en el arqueo final', correcta:'c',
        explicacion:'Toda cortesía sin firma es bandera roja en conciliación.' },
      { pregunta:'¿Cuál es el cupo máximo de personas reservadas online por servicio?',
        a:'25', b:'92', c:'100', d:'50', correcta:'d',
        explicacion:'50 reservadas online por servicio.' },
      { pregunta:'¿Cuál es la tarifa de adulto en Buffet completo Lun-Jue?',
        a:'$299 (desayuno fin de semana)', b:'$249 (tarifa niño)', c:'$890 (tarifa premium)', d:'$590', correcta:'d',
        explicacion:'$590 adulto en Buffet completo.' },
      { pregunta:'¿A partir de qué edad un niño paga tarifa de adulto?',
        a:'10', b:'11', c:'12', d:'15', correcta:'b',
        explicacion:'11+ años paga tarifa adulto. 0-5 cortesía. 6-10 niño.' },
      { pregunta:'¿Hasta cuánto antes de la reserva puede cancelar el cliente desde su link?',
        a:'30 minutos antes', b:'1 hora antes', c:'No puede cancelar; debe llamar', d:'5 minutos antes', correcta:'a',
        explicacion:'30 minutos antes desde su link único de WhatsApp.' },
      { pregunta:'¿Qué información tiene cada sello autenticado en el sistema?',
        a:'Solo el nombre del firmante', b:'Solo la hora exacta del sello', c:'user_id, email, nombre, rol, fecha/hora exacta y si es override (con motivo)', d:'Una imagen o foto del firmante', correcta:'c',
        explicacion:'Auditoría completa: quién, cuándo, su rol y si fue override admin.' },
      { pregunta:'Si vas a hacer un override admin de un sello, ¿qué te pide el sistema?',
        a:'Nada adicional — es tu rol', b:'Tu contraseña de admin nuevamente', c:'Un código de 6 dígitos enviado por SMS', d:'Un motivo escrito que queda en auditoría como es_override=true', correcta:'d',
        explicacion:'Motivo obligatorio + queda registrado para auditoría.' },
      { pregunta:'¿Cuáles son los dos depósitos a tesorería del día?',
        a:'Uno solo con todo el efectivo', b:'Venta del día + comisiones bancarias', c:'Tres depósitos diferenciados', d:'Ninguno — va directo a tesorería central', correcta:'b',
        explicacion:'Reglas Fogueira: 2 depósitos separados.' },
      { pregunta:'En el plano del salón, una mesa con "⏱ ~75 min", ¿qué representa?',
        a:'Su capacidad máxima de personas', b:'Tiempo restante hasta el cierre del servicio', c:'Promedio histórico de duración (60 días)', d:'Hora de la próxima reserva asignada', correcta:'c',
        explicacion:'Promedio histórico para predecir disponibilidad.' },
      { pregunta:'En la pestaña Reservaciones, "Pausar reservas", ¿qué hace?',
        a:'Bloquea NUEVAS reservas online del día', b:'Cancela todas las reservas del día', c:'Cierra el restaurante en el sistema', d:'Anula a los clientes en lista de espera', correcta:'a',
        explicacion:'Solo bloquea nuevas; las existentes siguen respetadas.' },
      { pregunta:'Si capturas una cortesía, ¿qué información debes asegurar que vaya en la fila?',
        a:'Nombre del autoriza, folio del ticket, motivo', b:'Solo el monto de la cortesía', c:'Solo el número de mesa', d:'Solo el nombre del cliente', correcta:'a',
        explicacion:'Trazabilidad: autoriza + folio + motivo es lo mínimo para evitar bandera roja.' },
      { pregunta:'¿Cuál es el horario "estelar" o más demandado?',
        a:'8am-12pm (desayuno)', b:'12pm-3pm (comida temprana)', c:'3pm-6pm', d:'7pm-10pm (noche)', correcta:'c',
        explicacion:'3pm-6pm. Se muestra al cliente al reservar.' },
      { pregunta:'Si los hosts borran una fila, ¿qué se requiere?',
        a:'Solo dar click y confirmar', b:'Motivo de mínimo 5 caracteres y queda en auditoría (soft-delete)', c:'Tu autorización como gerente', d:'Llamar al admin para que lo haga', correcta:'b',
        explicacion:'Soft-delete con motivo para auditoría. Lo borrado nunca se pierde físicamente.' },
      { pregunta:'¿Qué pasa con grupos mayores a 10 personas?',
        a:'Se confirman solos al instante por ser grupo grande', b:'Se cobran con cargo extra por grupo grande', c:'No pueden reservar online — deben llamar', d:'NO se confirman automáticamente; quedan en pendiente_confirmacion para que un host hable con el cliente', correcta:'d',
        explicacion:'Grupos grandes requieren confirmación manual.' },
      { pregunta:'¿Cuántos intentos tiene cada usuario en el examen de certificación?',
        a:'3', b:'1 solo intento por ventana', c:'Infinitos hasta aprobar', d:'10 intentos máximo', correcta:'a',
        explicacion:'3 intentos por ventana de 6 meses; admin puede resetear.' },
      { pregunta:'¿Qué rol está EXENTO del examen de certificación?',
        a:'Host (solo operación básica)', b:'Cajera (ya firmó contrato)', c:'Observador (solo lectura)', d:'Cocina (no usa el sistema)', correcta:'c',
        explicacion:'Observador no edita, solo ve; no requiere examen.' },
      { pregunta:'¿Cuántas preguntas hay que contestar correctamente para aprobar el examen?',
        a:'8 de 10 (80%)', b:'10 de 10 (100% perfecto)', c:'7 de 15 (50%)', d:'14 de 15 (90%)', correcta:'d',
        explicacion:'14/15 mínimo (≥90%).' },
      { pregunta:'¿Cuál es la duración de la certificación una vez aprobada?',
        a:'De por vida', b:'6 meses', c:'5 años', d:'1 año', correcta:'b',
        explicacion:'Vigencia 6 meses; se renueva con nuevo examen.' },
      { pregunta:'Si el sistema sugiere "Mesa 6 (2 pax)" para un grupo de 2, ¿qué tipo de optimización es?',
        a:'Aleatoria para distribuir uso de mesas', b:'Por orden de llegada de las reservas', c:'Asignar la mesa más chica disponible que cabe (deja libres las grandes)', d:'Por zona del salón que el cliente prefirió', correcta:'c',
        explicacion:'Optimiza ocupación: no desperdicia mesa de 8 con grupo de 2.' },
      { pregunta:'En el sistema, ¿quién puede resetear los intentos de un examen reprobado?',
        a:'Cualquiera con acceso al panel', b:'Solo admin / gerente_administrativo', c:'El propio usuario desde "Mi cuenta"', d:'La cajera si tiene doble rol', correcta:'b',
        explicacion:'Reset solo lo hace admin con confirmación; queda en auditoría.' },
      { pregunta:'Hasta qué hora del día siguiente dura tu sesión activa?',
        a:'3:00 am del día siguiente', b:'6:00 am del día siguiente', c:'Medianoche del mismo día', d:'10 am del día siguiente', correcta:'a',
        explicacion:'Día lógico restaurante: 3 am.' },
      { pregunta:'En la pestaña Histórico de conciliaciones, ¿qué puedes hacer?',
        a:'Solo ver la fecha del último cierre', b:'Modificar registros ya cerrados', c:'Borrar todo el historial antiguo', d:'Ver KPIs por día, filtrar por fecha/estado, exportar CSV, abrir conciliación de ese día', correcta:'d',
        explicacion:'Histórico es read-only con filtros y exportación.' },
      { pregunta:'¿Cuál es el aforo físico máximo de Fogueira?',
        a:'50 (igual al cupo de reservas)', b:'120 personas', c:'200 personas', d:'92 personas', correcta:'d',
        explicacion:'92 personas. Reservas online tope 50 + walk-ins.' }
    ],
    // ==================== GERENTE ADMINISTRATIVO ====================
    gerente_administrativo: [
      { pregunta:'¿De qué rol heredas todos los privilegios administrativos?',
        a:'Host', b:'Cajera', c:'Cocina', d:'Admin', correcta:'d',
        explicacion:'Gerente_administrativo hereda TODOS los privilegios de admin (Mónica = mano derecha).' },
      { pregunta:'En el panel Admin, ¿qué pestañas puedes administrar?',
        a:'Solo Usuarios y Certificaciones', b:'Solo Tarifas vigentes', c:'Usuarios, Sucursales, Tarifas vigentes, Configuración, Certificaciones', d:'Solo Configuración y Sucursales', correcta:'c',
        explicacion:'Acceso completo al panel admin.' },
      { pregunta:'Si un usuario agotó sus 3 intentos del examen, ¿quién puede resetearlos?',
        a:'Nadie — debe esperar la siguiente ventana de 6 meses', b:'Tú (Gerente Admin) o admin', c:'El propio usuario desde "Mi cuenta"', d:'Cualquier gerente del sistema', correcta:'b',
        explicacion:'Solo admin / gerente_administrativo pueden resetear; con confirmación y auditoría.' },
      { pregunta:'¿Qué pasa antes de resetear los intentos de un usuario?',
        a:'Asegurarte de haber realizado capacitación primero', b:'Pagar una multa en el sistema', c:'Llamar a soporte técnico de Germán', d:'Que el usuario firme una carta', correcta:'a',
        explicacion:'Sentido operativo: el reset debe acompañarse de capacitación real, no solo dar más oportunidades.' },
      { pregunta:'¿Junto con quién eres autorizado para firmar cortesías?',
        a:'La cajera junto con el encargado de piso', b:'Gerente de Restaurante (Gabriel)', c:'Cualquier mesero senior', d:'El admin del sistema (Germán)', correcta:'b',
        explicacion:'Solo Mónica (tú) y Gabriel (Gerente Restaurante) firman cortesías.' },
      { pregunta:'En el módulo Tarifas vigentes, ¿qué se mantiene cuando cambias precios?',
        a:'Solo el precio más reciente (sobrescribe)', b:'Nada — se borra el historial anterior', c:'Solo la última hora en que se cambió', d:'Todo el histórico (cada cambio es una nueva fila con fecha_desde)', correcta:'d',
        explicacion:'Histórico completo permite reconstruir tarifas vigentes en cualquier fecha pasada.' },
      { pregunta:'¿Qué pasa cuando creas un usuario nuevo desde Admin?',
        a:'Le mandas tu contraseña para que entre', b:'Solo le mandas un correo de bienvenida', c:'Le asignas rol, das alta y le defines password inicial; él puede cambiarla luego', d:'Lo creas sin contraseña hasta que él la defina', correcta:'c',
        explicacion:'Alta con rol + password inicial. Cambio de password disponible.' },
      { pregunta:'¿Cuántos depósitos a tesorería se hacen al día y por qué motivo?',
        a:'Dos: venta del día + comisiones bancarias (separados para análisis)', b:'Tres: venta, tarjeta y propinas', c:'Ninguno — va directo a tesorería central', d:'Uno solo con todo el efectivo', correcta:'a',
        explicacion:'Reglas Fogueira: 2 depósitos separados para trazabilidad.' },
      { pregunta:'¿Cuál es el aforo físico máximo del restaurante?',
        a:'92', b:'50 (igual al cupo de reservas online)', c:'120', d:'200', correcta:'a',
        explicacion:'Aforo 92. Reservas online cap 50.' },
      { pregunta:'¿Qué configuración define las mesas del salón con zonas?',
        a:'No existe ninguna config de mesas', b:'A mano en cada bitácora', c:'mesas_salon en formato Salón:1:4|Terraza:30:4', d:'Solo se define en Excel, no en el sistema', correcta:'c',
        explicacion:'Formato Zona:mesas|Zona:mesas en config; bitácora lo lee y muestra zonas con headers.' },
      { pregunta:'En la pestaña Configuración, ¿qué claves importantes administras?',
        a:'Solo el nombre de la empresa y su logo', b:'Cupo por servicio, slot, tolerancia, horario estelar, mesas, gerentes', c:'Solo emails de los empleados', d:'No hay nada configurable en esa pestaña', correcta:'b',
        explicacion:'Variables operativas core del sistema.' },
      { pregunta:'¿Qué es un "sello override admin" y cuándo se usa?',
        a:'Una calcomanía física de seguridad', b:'Un descuento especial que admin puede aplicar al cierre', c:'Una emoción registrada en el histórico de conciliaciones', d:'Cuando admin firma por otro rol con motivo (queda en auditoría como es_override=true)', correcta:'d',
        explicacion:'Override permite firmar por otro rol cuando hay imposibilidad operativa; con motivo siempre.' },
      { pregunta:'En el examen de certificación del equipo, ¿cuántas preguntas se sortean del banco?',
        a:'10 preguntas fijas siempre', b:'20 preguntas del banco completo', c:'25 preguntas sin sorteo', d:'15', correcta:'d',
        explicacion:'15 al azar del banco activo del rol.' },
      { pregunta:'¿Cuál es la calificación mínima para aprobar el examen?',
        a:'70%', b:'80%', c:'90% (14/15)', d:'100%', correcta:'c',
        explicacion:'≥90% (14/15) para aprobar.' },
      { pregunta:'¿Cada cuánto tiempo se renueva la certificación?',
        a:'1 mes', b:'6 meses', c:'1 año', d:'5 años', correcta:'b',
        explicacion:'Vigencia 6 meses.' },
      { pregunta:'¿Qué rol está EXENTO del examen?',
        a:'Observador (solo ve, no edita)', b:'Host', c:'Admin', d:'Auditoría', correcta:'a',
        explicacion:'Observador no opera, solo lee; no requiere certificarse.' },
      { pregunta:'Si una cortesía aparece sin nombre del autorizante en una bitácora, ¿qué efecto tiene en el cierre?',
        a:'Ninguno — se acepta igual si el monto es razonable', b:'Se cobra automáticamente al patrón', c:'Bandera roja en conciliación', d:'Se cierra el sistema hasta que se resuelva', correcta:'c',
        explicacion:'Sin firma del autoriza = bandera roja al cerrar.' },
      { pregunta:'En conciliación, las cortesías capturadas en bitácora deben coincidir con:',
        a:'Los folios del POS y nombres autorizantes', b:'El menú del día para validar tipo de cortesía', c:'Solo con el total de efectivo en caja', d:'La nómina del personal de piso', correcta:'a',
        explicacion:'Reconciliación: lo registrado = lo del POS = autorizado.' },
      { pregunta:'En el módulo Histórico de Conciliaciones, ¿qué puedes hacer?',
        a:'Solo ver la fecha del último cierre', b:'Filtrar rangos, ver KPIs, exportar CSV, abrir cualquier día', c:'Modificar registros ya cerrados', d:'Eliminar el historial anterior a 6 meses', correcta:'b',
        explicacion:'Vista PRO con filtros y export.' },
      { pregunta:'Si te das cuenta que un host borró una fila incorrectamente, ¿se puede recuperar?',
        a:'No, se pierde permanentemente', b:'Solo si el cliente reclama en los 3 días siguientes', c:'Solo los lunes cuando se hace respaldo manual', d:'Sí, soft-delete: la fila sigue en BitacoraFilas con borrada_at + motivo + quién', correcta:'d',
        explicacion:'Soft-delete preserva todo. Recuperable manualmente desde el sheet.' },
      { pregunta:'¿Cuáles datos personales del usuario quedan asociados a sus capturas?',
        a:'Ninguno — por privacidad no se guarda identidad', b:'user_id, email y rol al momento de captura — para auditoría', c:'Domicilio y teléfono personal', d:'Cuenta bancaria para retenciones', correcta:'b',
        explicacion:'Auditoría minimal: identidad funcional sin invadir privacidad.' },
      { pregunta:'¿Qué tipo de reservas requieren tu confirmación manual antes de aceptarlas?',
        a:'Todas sin excepción', b:'Solo los desayunos de fin de semana', c:'Ninguna — todas se confirman automáticamente', d:'Grupos mayores a 10 personas', correcta:'d',
        explicacion:'Grupos >10 = pendiente_confirmacion hasta que host hable y confirme.' },
      { pregunta:'En la página de inicio, si un usuario tiene certificación vencida, ¿qué le aparece?',
        a:'Banner suave amarillo: "Tu certificación venció — Tomar examen"', b:'Bloqueo total del sistema hasta recertificarse', c:'Una multa automática en la pantalla', d:'Cierre de sesión forzado inmediato', correcta:'a',
        explicacion:'Aviso suave, no bloqueante; el usuario sigue trabajando pero queda recordado.' },
      { pregunta:'¿Hasta qué hora del día siguiente dura una sesión iniciada?',
        a:'Medianoche del mismo día', b:'6:00 am del día siguiente', c:'3:00 am del día siguiente', d:'12:00 pm del día siguiente', correcta:'c',
        explicacion:'Día lógico de restaurante.' },
      { pregunta:'¿Qué cumple el sistema de sellos vs firmas tradicionales en papel?',
        a:'Las hace decorativas y opcionales', b:'Imposibilita firmar por otra persona, captura quién/cuándo y permite override admin con motivo', c:'Elimina completamente la necesidad de firmas', d:'Las imprime para archivarlas en papel', correcta:'b',
        explicacion:'Autenticación + auditoría + override controlado.' }
    ],
    // ==================== ADMIN ====================
    admin: [
      { pregunta:'¿Quién hereda los privilegios de admin?',
        a:'Solo Gerente Administrativo (Mónica)', b:'Cualquier gerente del sistema', c:'Todos los roles con nivel superior', d:'Nadie — admin no se puede heredar', correcta:'a',
        explicacion:'Gerente_administrativo hereda TODOS los privilegios de admin.' },
      { pregunta:'En el panel Admin, ¿qué se hace en la pestaña Usuarios?',
        a:'Borrar reservas antiguas del sistema', b:'Crear, editar, activar/desactivar y cambiar contraseña de usuarios', c:'Imprimir tickets de caja', d:'Pedir comida para el equipo', correcta:'b',
        explicacion:'CRUD completo de usuarios + cambio de password.' },
      { pregunta:'¿Qué pasa al desactivar un usuario?',
        a:'Se borra permanentemente del sistema', b:'Pierde toda su data histórica', c:'No puede iniciar sesión, pero su histórico de capturas se preserva', d:'Se cobra una multa al restaurante', correcta:'c',
        explicacion:'Desactivación funcional: bloquea login pero mantiene auditoría.' },
      { pregunta:'¿Qué información NO debe estar nunca en el sistema?',
        a:'Nombres y emails del personal', b:'Roles asignados a cada usuario', c:'ID de empresa y sucursal', d:'Contraseñas en texto plano (siempre hash)', correcta:'d',
        explicacion:'Passwords se hashean; nunca se guardan en plano.' },
      { pregunta:'En la pestaña Tarifas vigentes, ¿qué se mantiene cuando cambias precios?',
        a:'Solo el precio más reciente (sobrescribe)', b:'Se borra todo el historial previo', c:'Solo el monto sin fecha', d:'Histórico completo (cada cambio = nueva fila con fecha_desde)', correcta:'d',
        explicacion:'Auditoría de cambios de precio para reconstruir cualquier fecha pasada.' },
      { pregunta:'En Configuración, ¿qué clave define el cupo máximo de reservas online por servicio?',
        a:'aforo_fisico (92)', b:'cupo_por_servicio', c:'umbral_grupo_grande', d:'tolerancia_minutos', correcta:'b',
        explicacion:'cupo_por_servicio (default 50). Aforo_fisico es 92.' },
      { pregunta:'En Configuración, formato correcto para mesas con zonas:',
        a:'1,2,3,4 separados por coma', b:'mesa1=4 estilo clave=valor', c:'Salón:1:4,2:4|Terraza:30:4,31:4', d:'JSON libre con objetos', correcta:'c',
        explicacion:'Zona:mesa:cap separadas por |. Compatible con formato legacy plano.' },
      { pregunta:'¿Qué parámetro define en cuántos minutos se considera atraso una reserva?',
        a:'tolerancia_minutos (default 10)', b:'slot_minutos (intervalo de reservas)', c:'aforo_fisico (92 personas)', d:'cupo_por_servicio', correcta:'a',
        explicacion:'Después de 10 min de la hora reservada, marca visualmente atrasada (rojo); el host decide.' },
      { pregunta:'¿Qué rol está EXENTO de la certificación?',
        a:'Admin', b:'Host', c:'Observador', d:'Cajera', correcta:'c',
        explicacion:'Observador es solo lectura, no requiere examen.' },
      { pregunta:'¿Cuántas preguntas tiene el examen de certificación?',
        a:'10 preguntas fijas', b:'20 preguntas del banco completo', c:'25 preguntas sin sorteo', d:'15 sorteadas del banco activo', correcta:'d',
        explicacion:'15 sorteadas del banco activo.' },
      { pregunta:'¿Calificación mínima para aprobar el examen?',
        a:'90% (14/15)', b:'80%', c:'70%', d:'100%', correcta:'a',
        explicacion:'≥14/15.' },
      { pregunta:'¿Cuántos intentos tiene cada usuario antes de bloquearse?',
        a:'1 solo intento', b:'3', c:'5 intentos', d:'Ilimitados', correcta:'b',
        explicacion:'3 intentos por ventana; admin resetea con motivo.' },
      { pregunta:'¿Cada cuánto se renueva la certificación?',
        a:'6 meses', b:'Mensual con mini-quiz', c:'Anual junto con evaluación', d:'Nunca — es de por vida', correcta:'a',
        explicacion:'Vigencia 6 meses; sistema avisa al vencer.' },
      { pregunta:'En BitacoraFilas, cuando se "elimina" una fila, ¿qué pasa físicamente?',
        a:'Se borra para siempre sin rastro', b:'Se duplica como respaldo antes de borrar', c:'Soft-delete: borrada_at + motivo + borrada_por; el row sigue para auditoría', d:'Se exporta automáticamente a un CSV', correcta:'c',
        explicacion:'Soft-delete preserva auditoría. Lo borrado nunca se pierde.' },
      { pregunta:'¿Qué endpoint backend calcula el promedio de ocupación de cada mesa?',
        a:'mesa_get (info básica de la mesa)', b:'ocupacion_promedio_mesas (60 días, filtros 5-240 min)', c:'reserva_get (reservas del día)', d:'tarifa_get (tarifas vigentes)', correcta:'b',
        explicacion:'Filtra hora_ent→hora_sal con cordura, excluye Cancelada/No llegó/borradas.' },
      { pregunta:'En el módulo de sellos, ¿qué hace un override admin?',
        a:'Borra el sello y deja sin firma', b:'Cambia la hora del sello a la actual', c:'Cancela el cierre del día', d:'Permite firmar por otro rol con motivo registrado en auditoría (es_override=true)', correcta:'d',
        explicacion:'Override = firmar por terceros cuando hay imposibilidad operativa, con motivo.' },
      { pregunta:'En la hoja Sellos, ¿qué columnas garantizan auditoría?',
        a:'solo nombre del firmante', b:'user_id, user_email, user_nombre, user_rol, sellado_at, es_override, motivo_override', c:'solo fecha y hora', d:'solo contraseña hasheada', correcta:'b',
        explicacion:'Trazabilidad completa de identidad y momento.' },
      { pregunta:'En el endpoint examen_iniciar, ¿qué pasa si el banco tiene menos de 15 preguntas activas para un rol?',
        a:'Continúa con menos preguntas de las habituales', b:'Inventa preguntas básicas genéricas', c:'Devuelve error: "Banco insuficiente"', d:'Llama al admin por correo automáticamente', correcta:'c',
        explicacion:'Si el banco no tiene mínimo 15 preguntas, no se puede iniciar el examen.' },
      { pregunta:'En conciliación, ¿qué pasa con cortesías sin autorizante?',
        a:'Bandera roja al cierre — debe llevar nombre del autoriza', b:'Pasan sin problema al arqueo', c:'Se borran solas al procesar', d:'No impactan el resultado del arqueo', correcta:'a',
        explicacion:'Cortesía sin firma = bandera roja en arqueo.' },
      { pregunta:'¿Cuáles son los dos depósitos a tesorería diarios?',
        a:'Uno solo con todo el efectivo', b:'Tres depósitos distintos por tipo', c:'No se hacen — van a caja grande', d:'Venta del día + comisiones bancarias (separados)', correcta:'d',
        explicacion:'Reglas Fogueira: separación contable.' },
      { pregunta:'Cuando el admin resetea los intentos de un usuario, ¿qué se guarda?',
        a:'Nada — el reset borra el historial', b:'Solo la fecha del reset', c:'reseteado_por (email del admin) y reseteado_at en cada intento previo no aprobado', d:'El nombre del usuario y motivo', correcta:'c',
        explicacion:'Auditoría completa del reset; los intentos resetados ya no cuentan.' },
      { pregunta:'¿Qué hace matchSucursal(filaSuc, querySuc) en el backend?',
        a:'Cierra sucursales inactivas del sistema', b:'Borra la sucursal y sus usuarios', c:'No existe — es función privada', d:'Si fila tiene sucursal_id vacío, aplica a CUALQUIER sucursal de la empresa (global). Si tiene un id concreto, solo a esa', correcta:'d',
        explicacion:'Helper para configuraciones global vs por sucursal.' },
      { pregunta:'¿Qué pasa cuando se cambia la contraseña de un usuario desde admin?',
        a:'Se imprime en pantalla para el admin', b:'Se hashea y guarda en password_hash; el usuario debe usar la nueva al siguiente login', c:'Se manda automáticamente por email al usuario', d:'Se queda en texto plano hasta que el usuario la cambie', correcta:'b',
        explicacion:'Hash + uso inmediato.' },
      { pregunta:'¿Hasta qué hora del día siguiente dura un token de sesión?',
        a:'Hasta las 3:00 am del día siguiente (día lógico restaurante)', b:'1 hora después de creado por seguridad', c:'Indefinido — no caduca hasta logout', d:'Hasta cerrar el navegador (sesión de browser)', correcta:'a',
        explicacion:'Token con cutoff a 3 am MX para cubrir el cierre.' },
      { pregunta:'¿Qué tabla guarda el banco maestro de preguntas del examen?',
        a:'Bitacoras (bitácoras del servicio)', b:'Examenes (cols: id, rol, pregunta, opcion_a-d, correcta, explicacion, activa, creada_at)', c:'Tarifas (tarifas vigentes)', d:'Conciliaciones (cierres de caja)', correcta:'b',
        explicacion:'Hoja Examenes contiene el banco; el cliente nunca ve la columna correcta.' }
    ],
    // ==================== AUDITORIA ====================
    auditoria: [
      { pregunta:'¿Cuál es el principal objetivo del rol Auditoría en el sistema?',
        a:'Revisar registros, sellos y conciliaciones para verificar integridad y controles', b:'Operar caja cuando la cajera falta', c:'Cocinar cuando hay escasez de personal', d:'Capturar reservas en horario pico', correcta:'a',
        explicacion:'Auditoría revisa, NO opera; verifica controles y rastrea anomalías.' },
      { pregunta:'¿Qué tipo de "delete" usa el sistema para filas de bitácora?',
        a:'Borrado físico permanente sin rastro', b:'No permite borrar nada', c:'Solo se borran los lunes en mantenimiento', d:'Soft-delete (borrada_at + motivo + borrada_por)', correcta:'d',
        explicacion:'Soft-delete preserva auditoría completa.' },
      { pregunta:'¿Qué información identifica unívocamente quién firmó un sello?',
        a:'Una imagen o foto del firmante', b:'Solo el nombre del usuario', c:'user_id + user_email + user_nombre + user_rol + sellado_at', d:'Solo la hora exacta del sello', correcta:'c',
        explicacion:'Identidad funcional + momento exacto.' },
      { pregunta:'Si un sello tiene es_override=true, ¿qué significa?',
        a:'Que el sello falló y no se procesó', b:'Admin firmó por otro rol con motivo registrado en motivo_override', c:'Que es un sello antiguo de más de 6 meses', d:'Que se duplicó por error del sistema', correcta:'b',
        explicacion:'Override es excepción documentada — auditable.' },
      { pregunta:'¿Qué bandera roja debes vigilar en conciliaciones?',
        a:'Solo el clima y aforo del día', b:'Cortesías sin autorización, diferencias en arqueo, sellos pendientes', c:'Las recetas del menú del día', d:'No existen banderas en conciliación', correcta:'b',
        explicacion:'Banderas rojas son tu primera señal de revisión.' },
      { pregunta:'¿Cuál es el aforo máximo del restaurante?',
        a:'92 personas físicas', b:'50 personas (igual al cupo online)', c:'120 personas', d:'200 personas', correcta:'a',
        explicacion:'92 personas físicas. 50 reservadas online cap.' },
      { pregunta:'¿Cuáles son los dos depósitos a tesorería que esperas ver al cierre?',
        a:'Uno solo con todo el efectivo', b:'Ninguno — van directo a tesorería', c:'Cuatro depósitos diferenciados', d:'Venta del día + comisiones bancarias (separados)', correcta:'d',
        explicacion:'Reglas Fogueira: separación contable obligatoria.' },
      { pregunta:'Si una cortesía no tiene "autoriza" registrado, ¿qué tipo de hallazgo es?',
        a:'Sin importancia para el arqueo', b:'Sin clasificar hasta que Mónica lo revise', c:'Hallazgo de control: falta firma del autorizante (bandera roja)', d:'Por culpa del cliente que no solicitó firma', correcta:'c',
        explicacion:'Falta de control sobre cortesías = hallazgo serio.' },
      { pregunta:'En la hoja BitacoraFilas, ¿cómo identificas filas eliminadas?',
        a:'No se pueden identificar — se borraron', b:'Tienen color rojo en la hoja de cálculo', c:'Se identifican por la hora impar de registro', d:'Tienen valor en borrada_at + borrada_motivo + borrada_por', correcta:'d',
        explicacion:'Soft-delete con campos llenos.' },
      { pregunta:'En auditoría, ¿qué tablas son tu fuente principal de evidencia?',
        a:'Bitacoras + BitacoraFilas + Sellos + Conciliaciones + Charolas', b:'Solo Usuarios y Tarifas', c:'Solo Reservas del día', d:'Solo Tarifas vigentes', correcta:'a',
        explicacion:'Conjunto operativo donde se capturan transacciones y sellos.' },
      { pregunta:'¿Quiénes son los únicos autorizados para firmar cortesías?',
        a:'Cualquier mesero con antigüedad', b:'Gerente Administrativo y Gerente de Restaurante', c:'La cajera cuando los gerentes no están', d:'Auditoría puede firmar en revisiones de campo', correcta:'b',
        explicacion:'Solo Mónica y Gabriel. Auditoría no firma cortesías; las verifica.' },
      { pregunta:'¿Qué endpoint te lista todas las certificaciones del equipo?',
        a:'examen_iniciar (inicia el examen del usuario)', b:'reserva_get (reservas del día)', c:'certificaciones_list (admin/auditoria/gerentes)', d:'No existe ningún endpoint de certificaciones', correcta:'c',
        explicacion:'Lista estado actual de cada usuario: vigente/pendiente/bloqueado.' },
      { pregunta:'¿Qué pasa si un usuario reprueba 3 veces el examen?',
        a:'Lo despiden automáticamente del sistema', b:'Se borran los intentos solos al mes siguiente', c:'Se firma su certificación solo para que pueda operar', d:'Queda "bloqueado_por_intentos"; admin debe resetear tras capacitación', correcta:'d',
        explicacion:'Sin reset, no puede tomar nuevo examen; queda en banner rojo.' },
      { pregunta:'¿Cuál es la calificación mínima para aprobar el examen?',
        a:'70% (10/15)', b:'100% (15/15)', c:'80% (12/15)', d:'90% (14/15)', correcta:'d',
        explicacion:'14/15 mínimo.' },
      { pregunta:'¿Cuántas preguntas presenta el examen?',
        a:'15 sorteadas del banco', b:'10 preguntas fijas siempre', c:'25 del banco completo', d:'5 preguntas de repaso', correcta:'a',
        explicacion:'15 al azar; rotación entre intentos.' },
      { pregunta:'¿Qué rol está exento del examen?',
        a:'Admin (ya tiene todos los privilegios)', b:'Cajera (firmó contrato de capacitación)', c:'Observador (solo lectura)', d:'Auditoría (ya tiene acceso total)', correcta:'c',
        explicacion:'Observador no opera, no requiere certificarse.' },
      { pregunta:'¿Vigencia de la certificación?',
        a:'1 mes', b:'6 meses', c:'1 año', d:'Permanente de por vida', correcta:'b',
        explicacion:'6 meses; sistema avisa antes/después de vencimiento.' },
      { pregunta:'¿Qué columna identifica si un usuario pasó override en su sello?',
        a:'es_override (booleano)', b:'No existe esa columna en el sistema', c:'estado (campo de texto)', d:'fecha (timestamp del sello)', correcta:'a',
        explicacion:'Flag bool y motivo asociado para auditoría.' },
      { pregunta:'¿Hasta qué hora dura una sesión iniciada?',
        a:'1 hora por seguridad', b:'3:00 am del día siguiente (día lógico restaurante)', c:'12 horas exactas desde el inicio', d:'Indefinido hasta hacer logout', correcta:'b',
        explicacion:'Cubre operación completa hasta cierre.' },
      { pregunta:'En el reporte Histórico de Conciliaciones, ¿qué puedes hacer?',
        a:'Modificar registros históricos incorrectos', b:'Reabrir conciliaciones ya cerradas', c:'Filtrar fechas/estado, ver KPIs, exportar CSV — solo lectura', d:'Borrar conciliaciones antiguas para liberar espacio', correcta:'c',
        explicacion:'Vista PRO read-only con filtros y export.' },
      { pregunta:'¿Cuántos depósitos a tesorería esperarías ver y por qué motivo?',
        a:'Uno solo por simplicidad contable', b:'Variable según el día de la semana', c:'Tres diferenciados', d:'Dos: venta del día y comisiones bancarias (separación contable)', correcta:'d',
        explicacion:'Regla Fogueira para análisis.' },
      { pregunta:'En los sellos, ¿quién puede firmar por otro?',
        a:'Cualquiera si hay motivo urgente', b:'La cajera si tiene doble rol activo', c:'Cualquier gerente con autorización de Germán', d:'Solo admin/g_admin con override y motivo (excepción auditable)', correcta:'d',
        explicacion:'Excepción controlada con motivo y registro.' },
      { pregunta:'¿Qué efecto tiene en el sistema una bandera roja sin explicar?',
        a:'Ninguno — es solo visual informativa', b:'Multas automáticas aplicadas al turno', c:'Visible al cierre — auditoría puede observar y exigir explicación', d:'Cierre automático del local hasta resolverse', correcta:'c',
        explicacion:'Banderas son señales para revisión humana, no acciones automáticas.' },
      { pregunta:'En el sistema, ¿quién puede MODIFICAR una conciliación ya cerrada?',
        a:'Solo admin con override y motivo (auditable)', b:'Auditoría como parte de su rol revisor', c:'Nadie — los cierres son inmutables', d:'Cualquiera con acceso al histórico', correcta:'a',
        explicacion:'Cierres requieren override admin para modificarse.' },
      { pregunta:'¿Cuál es el rol del banner "Tu certificación venció" en inicio?',
        a:'Bloquear acceso hasta recertificarse', b:'Recordatorio suave no bloqueante; el usuario sigue trabajando', c:'Cierre de sesión forzado inmediato', d:'Multa automática de $500', correcta:'b',
        explicacion:'No bloquea operación, solo recuerda renovar.' }
    ],
    // ==================== COMPRADOR ====================
    comprador: [
      { pregunta:'¿Cuál es la responsabilidad principal del rol Comprador?',
        a:'Validar y mantener actualizados los precios de los ingredientes, negociar con proveedores, validar los 297 precios estimados (📍), reportar variaciones', b:'Cocinar junto con Sergio y Marcos en el rodizio', c:'Operar caja cuando la cajera falta', d:'Hacer reservas y atender clientes en piso',
        correcta:'a', explicacion:'Tu rol es 100% sobre precios y proveedores. Sin ti, el costeo de recetas se vuelve impreciso.' },
      { pregunta:'¿En qué pantalla del sistema editas precios de ingredientes?',
        a:'Bitácora del servicio activo', b:'Módulo de Conciliación', c:'Pantalla de Charolas', d:'Recetas y costeo, tab Ingredientes (edición inline)',
        correcta:'d', explicacion:'Tab Ingredientes es tu cabina de mando. Búsqueda y edición rápida de precio.' },
      { pregunta:'¿Tu edición de precio es inmediata o queda como propuesta esperando aprobación?',
        a:'Es propuesta como Sergio/Marcos — Mónica debe aprobar', b:'INMEDIATA. A diferencia del Modelo B, tú editas precios directo y el cambio se propaga al instante a todas las recetas que usan ese ingrediente', c:'Solo aplica los lunes de cada semana', d:'Mónica aprueba antes de que se propague',
        correcta:'b', explicacion:'Inmediato = poder operativo. También significa que un error tuyo se propaga al instante.' },
      { pregunta:'¿Qué significa el flag 📍 en un ingrediente?',
        a:'Que es un ingrediente nuevo dado de alta este mes', b:'Que se acabó el stock en almacén', c:'Que el precio es estimado (no validado contra factura). Hay 297 estimados pendientes de validar', d:'Que está marcado como caro por Mónica',
        correcta:'c', explicacion:'📍 = costo aproximado, no exacto. Tu misión es ir reduciendo ese número.' },
      { pregunta:'¿Cuándo quitas el flag 📍 de un ingrediente?',
        a:'Nunca — el flag es permanente', b:'Cada lunes automáticamente', c:'Cuando ya tienes el precio confirmado por factura o proveedor real', d:'Cuando Mónica lo aprueba desde su panel',
        correcta:'c', explicacion:'Quitar 📍 = precio validado. Reducir los 297 estimados es trabajo de fondo.' },
      { pregunta:'Sergio te pide usar "queso provoleta" que no existe en el catálogo. ¿Qué haces?',
        a:'Le dices que no se puede agregar por ahora', b:'Lo dejas como pendiente hasta que Mónica lo autorice', c:'Le pides a Mónica que lo agregue desde su panel de admin', d:'Botón "+ Nuevo ingrediente" en tab Ingredientes. Llenas nombre, categoría, unidad, precio (estimado si no tienes factura). Queda disponible para que Sergio lo use',
        correcta:'d', explicacion:'Crear ingredientes nuevos es tu rol. Sergio propone su uso; tú lo das de alta.' },
      { pregunta:'Capturaste un precio mal por un dedazo (pusiste $1,800 en lugar de $180). ¿Qué pasa?',
        a:'Nada grave — el sistema detecta errores extremos', b:'El error se propaga inmediato a todas las recetas que usan ese ingrediente — las verás 10× más caras en Rentabilidad. Lo corriges de inmediato y verificas el tab Rentabilidad', c:'Se cancela solo después de 10 minutos', d:'Se llama al proveedor para confirmar',
        correcta:'b', explicacion:'Inmediato = error inmediato. Por eso "verifica antes de capturar" es regla.' },
      { pregunta:'¿Qué criterio NO sirve para priorizar la validación de los 297 estimados?',
        a:'Orden alfabético — ese criterio NO ayuda', b:'Precio relativo (ingredientes caros primero)', c:'Volatilidad (precios que cambian seguido)', d:'Volumen de uso del ingrediente',
        correcta:'a', explicacion:'Impacto = volumen × precio × volatilidad. Alfabético no aporta valor.' },
      { pregunta:'Validas un ingrediente y descubres que el precio real es $150/kg cuando estaba estimado en $50/kg (3×). ¿Qué haces?',
        a:'Cambias en silencio y esperas al reporte del lunes', b:'No lo cambias hasta tener tres cotizaciones de respaldo', c:'Esperas al fin de mes para procesar cambios grandes', d:'Capturas el precio real, quitas flag 📍, y avisas a Mónica de inmediato porque las recetas que lo usaban estaban con costo muy subestimado',
        correcta:'d', explicacion:'Diferencia >30% = mal estimado severo. Mónica necesita reaccionar.' },
      { pregunta:'¿Cuál es el ritmo razonable para validar los 297 estimados?',
        a:'Solo cuando alguien lo pide expresamente', b:'Todo en una semana de sprint intenso', c:'10-20 por semana, en paralelo al día a día. En ~6 meses se completan todos. Trabajo de fondo constante', d:'No validarlos — los estimados son suficientemente precisos',
        correcta:'c', explicacion:'Trabajo de fondo. Apretar todo de un jalón no es realista; abandonar tampoco.' },
      { pregunta:'¿Qué incluye tu reporte semanal a Mónica?',
        a:'Solo el número total de cambios realizados', b:'Resumen ejecutivo, subidas notables (>10%), bajadas, estimados validados, ingredientes nuevos, negociaciones en curso, riesgos. Cada subida con precio anterior/nuevo, variación % y recetas afectadas', c:'Lista de quejas sobre proveedores', d:'Solo la lista de precios actualizada',
        correcta:'b', explicacion:'Reporte = visión consolidada accionable. Inteligencia operativa que la dirección puede actuar.' },
      { pregunta:'¿Cuándo NO debes esperar al reporte semanal y avisar inmediato?',
        a:'Cuando hay un cambio grande (subida >30% en ingrediente importante). WhatsApp directo a Mónica sin esperar al lunes', b:'Nunca — todo espera al reporte del lunes', c:'Siempre que haya cualquier cambio de precio', d:'Solo si Mónica pregunta explícitamente',
        correcta:'a', explicacion:'Materialidad define urgencia. Cambios chicos esperan al reporte; grandes son inmediatos.' },
      { pregunta:'¿Editas recetas (cantidades, ingredientes, instrucciones)?',
        a:'Sí, puedes editar todas las recetas que necesites', b:'No. Tu rol edita PRECIOS de ingredientes. Las recetas las modifican Sergio/Marcos con Modelo B (proponen → Mónica aprueba). Tú las ves en lectura', c:'Sí, pero solo las que Mónica te asigne', d:'Solo los lunes después de que Sergio las haya revisado',
        correcta:'b', explicacion:'Separación de funciones: precios eres tú; recetas son los chefs.' },
      { pregunta:'¿Tu rol puede ver el módulo de conciliación de caja?',
        a:'Sí, comprador ve el sistema completo', b:'Solo en fines de semana cuando hay rodizio', c:'Solo si Mónica te da acceso especial', d:'No. Comprador solo ve Recetas y costeo, Mi curso, Mi manual',
        correcta:'d', explicacion:'Por separación de funciones, tu acceso es estrictamente al catálogo de costos.' },
      { pregunta:'¿Cuál es el peor error al validar estimados?',
        a:'Validar contra factura física del proveedor', b:'Quitar el flag 📍 sin actualizar el precio (peor: dice "validado" pero no lo es), validar al ojo sin factura, validar todos rápido sin verificar', c:'Avisar a Mónica de cada cambio realizado', d:'Capturar el precio real con respaldo de factura',
        correcta:'b', explicacion:'Esos atajos invalidan el proceso. La validación tiene sentido solo si es real.' },
      { pregunta:'En el futuro habrá un importador Excel del POS. ¿Qué hará?',
        a:'Te permitirá subir un Excel exportado de SoftRestaurant y aplicar masivamente cambios de precios al sistema, después de que TÚ revises y confirmes. Convierte 100 cambios manuales en 5 minutos vs 1 hora', b:'Reemplazará completamente al comprador', c:'Solo lo verá Germán desde el backend', d:'No hará nada útil',
        correcta:'a', explicacion:'Importador acelera lo masivo, pero tú sigues siendo el filtro de control.' },
      { pregunta:'¿Qué puedes hacer AHORA para que el importador funcione bien cuando llegue?',
        a:'Nada, solo esperar a que esté listo', b:'Borrar el catálogo y empezar de cero', c:'Mantener nombres consistentes entre Fogueira y SoftRestaurant, mantener unidades consistentes (kg/gr/L/ml), documentar tu workflow actual', d:'Construirlo tú mismo en Excel',
        correcta:'c', explicacion:'Preparar el terreno hoy = importador eficaz mañana. Consistencia entre sistemas es responsabilidad operativa.' },
      { pregunta:'¿Cuál es el TIPO de información de respaldo que dejas como "notas" en un ingrediente?',
        a:'Cualquier cosa que se te ocurra', b:'No se permiten notas — el campo es solo para precio', c:'Solo el precio anterior para comparar', d:'Marca, proveedor, lote, número de factura. Ej: "Validado contra factura · Proveedor X · Mayo 2026"',
        correcta:'d', explicacion:'Trazabilidad: las notas permiten reconstruir de dónde vino el precio cuando se audita.' },
      { pregunta:'¿Hasta qué hora dura tu sesión iniciada?',
        a:'1 hora por seguridad', b:'12 horas exactas desde el inicio', c:'Hasta las 3:00 am del día siguiente (día lógico restaurante)', d:'Hasta que cierras el navegador',
        correcta:'c', explicacion:'Día lógico de restaurante: cubre operación completa hasta cierre.' },
      { pregunta:'¿Cada cuánto necesitas renovar tu certificación?',
        a:'Cada año con la evaluación de desempeño', b:'Cada 6 meses; el sistema te avisa cuando se acerque o se pase la fecha', c:'Cada mes para mantener la certificación activa', d:'Una sola vez al ingresar a la empresa',
        correcta:'b', explicacion:'Vigencia 6 meses; renovación con nuevo examen.' },
      // === Banco extendido — Compras corporativas profesionales ===
      { pregunta:'¿Cuál es la diferencia clave entre comprador transaccional y estratégico?',
        a:'El transaccional procesa pedidos como se le piden; el estratégico anticipa, negocia, optimiza el costo total y mitiga riesgo. Métricas distintas: # de órdenes vs ahorro/OTIF/calidad/riesgo', b:'Solo el sueldo que perciben', c:'No hay diferencia práctica', d:'Solo el horario de trabajo',
        correcta:'a', explicacion:'El estratégico genera valor; el transaccional ejecuta tareas. Tu rol en Fogueira es estratégico.' },
      { pregunta:'¿Cuáles son las "5 R" clásicas de las compras corporativas?',
        a:'Rápido, rico, rojo, raro, recio', b:'No existe ese marco en compras', c:'Right product, Right quality, Right quantity, Right time, Right price (producto, calidad, cantidad, tiempo y precio correctos)', d:'Recibir, revisar, reclamar, reportar, repetir',
        correcta:'c', explicacion:'Las 5 R aseguran que la compra sea integralmente correcta. Falla cualquiera y la compra fracasó (aunque el precio fuera bueno).' },
      { pregunta:'Un proveedor te ofrece 2% de "comisión personal" si lo eliges. ¿Qué haces?',
        a:'Lo aceptas en privado — es práctica común', b:'Pides 5% en lugar de 2%', c:'Lo aceptas solo si el monto es menor a $500', d:'Le respondes que no aceptas comisiones personales y le pides que aplique ese 2% como descuento en factura. Reportas por escrito a Mónica el mismo día',
        correcta:'d', explicacion:'Aceptar es delito federal + despido inmediato sin liquidación. Reportar por escrito te protege.' },
      { pregunta:'¿Por qué la regla es 3 cotizaciones (no 1, 2 o 5)?',
        a:'Es número mágico de buena suerte en compras', b:'1 no da referencia; 2 puede ser colusión; 5+ desperdicia tiempo y desincentiva al proveedor. 3 es el equilibrio internacional (ISO 9001, COSO) entre rigor y costo de proceso', c:'Es decisión personal del comprador', d:'Lo decide la cocina según cuántos proveedores conoce',
        correcta:'b', explicacion:'3 = mínimo que triangula precio justo sin desperdiciar esfuerzo. Estándar corporativo global.' },
      { pregunta:'¿Qué es el TCO (Total Cost of Ownership) y por qué importa más que el precio unitario?',
        a:'Costo total real de comprarle a un proveedor: precio + costo de no-calidad + costo de retraso + costo de servicio + costo financiero. Captura lo que el precio unitario esconde — un proveedor barato puede ser más caro en TCO si falla', b:'Es solo otro nombre para precio unitario', c:'Es una marca de software de compras', d:'Solo aplica en empresas grandes con miles de proveedores',
        correcta:'a', explicacion:'TCO honesto suele derrotar al precio unitario. El "ahorro" del más barato es ficción cuando incluyes costo del fallo.' },
      { pregunta:'¿Qué es el OTIF y cuál es el target razonable para un proveedor de Fogueira?',
        a:'No se mide en restaurantes — solo en manufactura', b:'Solo aplica en exportación de productos', c:'On-Time In-Full = entregas a tiempo Y completas / total de entregas. Target Fogueira: >90%. Por debajo de 80%, el proveedor cuesta más en compras pánico y horas extra de lo que aparenta', d:'Es una hormona relacionada con el estrés del comprador',
        correcta:'c', explicacion:'OTIF es indicador clave de confiabilidad. Llevar registro objetivo permite conversación profesional con el proveedor.' },
      { pregunta:'¿Qué es el BATNA y por qué es crítico antes de toda negociación?',
        a:'Best Alternative to Negotiated Agreement: tu plan B real si esta negociación no se cierra. La regla de 3 cotizaciones ES tu BATNA — sin alternativas reales en mano, estás a merced del proveedor', b:'Una técnica de presión psicológica agresiva', c:'Un acrónimo legal de contratos', d:'Un software especializado de compras corporativas',
        correcta:'a', explicacion:'Sin BATNA tu poder de negociación es mínimo. Por eso las 3 cotizaciones no son burocracia: son tu palanca real.' },
      { pregunta:'¿Qué documentos fiscales SIEMPRE pides antes de dar de alta a un proveedor?',
        a:'Solo el RFC del proveedor', b:'Solo el nombre comercial y teléfono', c:'Nada — basta con que facturen', d:'Constancia de Situación Fiscal vigente; Opinión de Cumplimiento positiva (32D); verificación de NO estar en lista 69-B SAT; carátula bancaria validada; datos de contacto. Renovar 32D cada 6 meses',
        correcta:'d', explicacion:'Sin estos documentos las facturas pueden ser no deducibles. Lista 69-B definitivos = facturas inválidas + corresponsabilidad fiscal.' },
      { pregunta:'Una factura es PPD (Pago en Parcialidades o Diferido). Pagas el monto total. ¿Qué documento adicional necesitas del proveedor?',
        a:'Ninguno — la factura original es suficiente', b:'Complemento de pagos (CFDI adicional) que documenta folio de la factura original, fecha de pago, monto y forma de pago real. Sin complemento = no comprobante de pago = no deducible. Tú lo verificas y lo exiges si no llega', c:'Una nota de venta adicional en papel', d:'Solo el WhatsApp del proveedor confirmando el pago',
        correcta:'b', explicacion:'Error #1 que destruye deducibilidad en empresas mexicanas. Sin complemento de pagos en PPD, el gasto no es deducible.' },
      { pregunta:'¿Por qué el principio de "3 manos" (cotización / autorización / recepción) en compras?',
        a:'Si una sola persona controla las 3 funciones tiene carta blanca para defraudar. Separación: tú cotizas y propones; Mónica autoriza pago; cocina/churrasca recibe y firma. Te protege a TI también', b:'Es burocracia innecesaria que retrasa pedidos', c:'Solo aplica en bancos y empresas financieras', d:'Es opcional — cada empresa decide si lo implementa',
        correcta:'a', explicacion:'Control interno básico. Es protección de la empresa Y del comprador.' },
      { pregunta:'Tu primo tiene una distribuidora y quieres incluirlo en cotizaciones. ¿Práctica correcta?',
        a:'Excluirlo siempre — no puede participar por ser familiar', b:'Declararlo POR ESCRITO a Mónica como conflicto de interés ANTES de iniciar la cotización. Pedir que ella tome la decisión final con base en las 3 cotizaciones objetivas', c:'Incluirlo y darle el contrato porque es de confianza', d:'Mentir y decir que no lo conoces para simplificar',
        correcta:'b', explicacion:'Declararlo por escrito te protege y permite competencia limpia. Lo prohibido es ocultar el vínculo.' }
    ]
  };
}

// Bootstrap de promociones — ejecutar una vez (o cuando se agregue una nueva).
// dias_semana en formato ISO: 1=lunes, 2=martes, ..., 7=domingo.
function crearPromocionesFogueira() {
  var EMPRESA_ID = '521aef3c-7df7-49ad-b1af-583a95233cd0'; // Fogueira
  var sheet = getSheet('Promociones');
  var existing = rowsToObjects(sheet);
  var crearSiNoExiste = function(nombre, datos){
    if (existing.some(function(p){ return p.empresa_id === EMPRESA_ID && p.nombre === nombre; })) {
      console.log('• Promo "' + nombre + '" ya existe, no se duplica.');
      return;
    }
    sheet.appendRow([uuid(), EMPRESA_ID, '', nombre, datos.descripcion, datos.dias_semana,
                     datos.hora_desde, datos.hora_hasta, datos.personas_requeridas,
                     datos.precio_normal, datos.precio_promo, true, new Date()]);
    console.log('✓ Promo "' + nombre + '" creada.');
  };
  crearSiNoExiste('DUO', {
    descripcion: 'Disfruta el rodizio en pareja por menos. En lugar de pagar $590 cada uno, ¡pagan $890 los dos juntos!',
    dias_semana: '1,2,3,4',     // Lunes a Jueves
    hora_desde: '18:00',
    hora_hasta: '22:00',
    personas_requeridas: 2,
    precio_normal: 590,
    precio_promo: 890
  });
}

// =============== Sesiones ===============
// Calcula el "día lógico del restaurante": empieza a las 3:00 am hora local de México
// y termina a las 2:59 am del día siguiente. Esto evita que el token de un host se
// caduque a media operación nocturna (la operación va hasta las 11pm o 9pm domingo).
// Operativamente: el host se loguea al iniciar su turno y la sesión le dura todo el
// día de servicio hasta el cierre + horas extra de cierre.
function diaLogicoRestaurante() {
  var ahora = new Date();
  // Restamos 3 horas para "alinear" el corte del día con las 3am hora MX.
  // Después formateamos en zona MX (Session.getScriptTimeZone() devuelve America/Mexico_City
  // por el timeZone del appsscript.json).
  var alineado = new Date(ahora.getTime() - (3 * 60 * 60 * 1000));
  return Utilities.formatDate(alineado, Session.getScriptTimeZone() || 'America/Mexico_City', 'yyyy-MM-dd');
}
function generarToken(usuario) {
  var diaLogico = diaLogicoRestaurante();
  // v329 — "candado" por usuario (token_nonce): al cambiarlo, TODOS los tokens previos de ese
  // usuario dejan de validar → "cerrar sesión en todos lados". Arranca vacío para ser
  // retro-compatible (sin nonce, el raw es idéntico al de antes y las sesiones vivas no se cortan).
  var nonce = String(usuario.token_nonce || '');
  var raw = usuario.id + '|' + String(usuario.email).toLowerCase() + '|' + diaLogico + (nonce ? '|' + nonce : '');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw + SALT);
  return Utilities.base64EncodeWebSafe(bytes).slice(0, 32) + '.' + usuario.id;
}
// Invalida TODAS las sesiones del usuario autenticado (cualquier link/dispositivo con su token
// previo queda muerto al instante). No afecta a otros usuarios. v329.
function handleCerrarSesiones(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = getSheet('Usuarios');
  var col = _getOrCreateCol(sh, 'token_nonce');
  var fila = rowsToObjects(sh).find(function(x){ return x.id === u.id; });
  if (!fila) return { ok:false, error:'Usuario no encontrado' };
  sh.getRange(fila._row, col).setValue(Utilities.getUuid().slice(0, 8));
  try { CacheService.getScriptCache().remove('me_' + String(p.token).slice(0, 40)); } catch(e){}
  return { ok:true };
}
function validarToken(token) {
  if (!token) return null;
  var parts = String(token).split('.');
  if (parts.length !== 2) return null;
  var u = rowsToObjects(getSheet('Usuarios')).find(function(x){ return x.id === parts[1] && esActivo(x.activo); });
  if (!u) return null;
  return generarToken(u) === token ? u : null;
}
function rolEs(u, roles) {
  if (!u) return false;
  var rolUsuario = String(u.rol || '').toLowerCase();
  if (roles.indexOf(rolUsuario) !== -1) return true;
  // gerente_administrativo hereda TODOS los privilegios de admin (Mónica = mano derecha)
  if (rolUsuario === 'gerente_administrativo' && roles.indexOf('admin') !== -1) return true;
  // gerente_restaurante hereda los privilegios de host (Gabriel = supervisor de operación)
  if (rolUsuario === 'gerente_restaurante' && roles.indexOf('host') !== -1) return true;
  // observador hereda el ACCESO de host (puede ver, no editar — bloqueo blando en frontend)
  if (rolUsuario === 'observador' && roles.indexOf('host') !== -1) return true;
  return false;
}
// Acepta true / "TRUE" / "VERDADERO" / "Sí" / "1" como activo. Sheets en español
// a veces guarda los booleanos como string según el locale, por eso necesitamos tolerancia.
function esActivo(v) {
  if (v === true) return true;
  if (v === false || v == null || v === '') return false;
  if (typeof v === 'string') {
    var s = v.trim().toLowerCase();
    return s === 'true' || s === 'verdadero' || s === 'sí' || s === 'si' || s === '1';
  }
  return !!v;
}

// =============== Auth ===============
// === Registro de accesos para el panel "Mi actividad de supervisión" (v389) ===
// Solo registramos a los roles SUPERVISORES (los que vigilan el Tablero) para no encarecer
// el hot-path de `me` con escrituras de cajeras/chefs. 1 fila por (usuario, día lógico):
// dedup best-effort por CacheService (6h) + el conteo lee DISTINCT día_lógico (robusto a dupes).
// NOTA: no hay historia previa — empieza a contar desde el deploy.
var ACCESOS_COLS = ['id','empresa_id','usuario_id','email','rol','dia_logico','creado_at'];
var SUPERVISOR_ROLES_ACTIVIDAD = ['admin','gerente_plaza','auditoria','gerente_administrativo'];
function _registrarAcceso(u){
  try {
    if (!u || SUPERVISOR_ROLES_ACTIVIDAD.indexOf(String(u.rol||'').toLowerCase()) === -1) return;
    var dia = diaLogicoRestaurante();
    var ckey = 'acc_' + u.empresa_id + '_' + u.id + '_' + dia;
    var cache = CacheService.getScriptCache();
    if (cache.get(ckey)) return;          // ya registrado hoy (ventana de 6h)
    cache.put(ckey, '1', 21600);
    var sh = asegurarHoja('Accesos', ACCESOS_COLS);
    sh.appendRow([Utilities.getUuid(), u.empresa_id, u.id, String(u.email||'').toLowerCase(), String(u.rol||''), dia, new Date()]);
  } catch(e){ /* nunca tirar `me` por el registro de actividad */ }
}

function handleLogin(p) {
  var email = String(p.email || '').toLowerCase().trim(), password = p.password || '';
  if (!email || !password) return { ok:false, error:'Email y contraseña requeridos' };
  var u = rowsToObjects(getSheet('Usuarios')).find(function(x){ return String(x.email).toLowerCase() === email && esActivo(x.activo); });
  if (!u || u.password_hash !== hashPassword(password)) return { ok:false, error:'Credenciales incorrectas' };
  var empresa = rowsToObjects(getSheet('Empresas')).find(function(e){ return e.id === u.empresa_id; });
  var sucursales = rowsToObjects(getSheet('Sucursales')).filter(function(s){ return s.empresa_id === u.empresa_id && esActivo(s.activa); });
  return {
    ok:true, token: generarToken(u),
    user: { id:u.id, email:u.email, nombre:u.nombre, rol:u.rol, empresa_id:u.empresa_id },
    empresa: empresa ? { id:empresa.id, nombre:empresa.nombre, plan:empresa.plan } : null,
    sucursales: sucursales.map(function(s){ return {id:s.id, nombre:s.nombre}; })
  };
}
function handleMe(p) {
  var token = String(p.token || '');
  if (!token) return { ok:false, error:'Sesión inválida o expirada' };
  // Cache por token (5 min). Evita releer 3 Sheets en cada navegación entre pantallas.
  var cache = CacheService.getScriptCache();
  var cacheKey = 'me_' + token.slice(0, 40);
  var hit = cache.get(cacheKey);
  if (hit) { try { return JSON.parse(hit); } catch(e){} }
  var u = validarToken(token);
  if (!u) return { ok:false, error:'Sesión inválida o expirada' };
  _registrarAcceso(u);  // panel "Mi actividad" (v389): registra el acceso de roles supervisores (1/día)
  var empresa = rowsToObjects(getSheet('Empresas')).find(function(e){ return e.id === u.empresa_id; });
  var sucursales = rowsToObjects(getSheet('Sucursales')).filter(function(s){
    return s.empresa_id === u.empresa_id && esActivo(s.activa);
  });
  var resultado = {
    ok: true,
    user: { id:u.id, email:u.email, nombre:u.nombre, rol:u.rol, empresa_id:u.empresa_id },
    empresa: empresa ? { id:empresa.id, nombre:empresa.nombre, plan:empresa.plan } : null,
    sucursales: sucursales.map(function(s){ return { id:s.id, nombre:s.nombre }; })
  };
  try { cache.put(cacheKey, JSON.stringify(resultado), 300); } catch(e){}
  return resultado;
}
function handleLogout(p) { return { ok:true }; }

// =============== Bitácoras ===============
function handleBitacoraList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  // cocina/churrasca: necesitan LISTAR (solo metadata: id/estado) para anclar su sello del día
  // desde la pantalla de Charolas. Sin esto, el chef recibía "Sin permisos" → falso "no hay bitácora".
  if (!rolEs(u, ['host','admin','auditoria','cajera','cocina','churrasca'])) return { ok:false, error:'Sin permisos' };
  var fecha = p.fecha || '', sucursal_id = p.sucursal_id || '';
  var hoyLogico = diaLogicoRestaurante();
  var bitacoras = [], abiertasPasadas = [];
  rowsToObjects(getSheet('Bitacoras')).forEach(function(b){
    if (b.empresa_id !== u.empresa_id) return;
    // sucursal_id VACÍO en la bitácora = global (aplica a cualquier sucursal), igual que matchSucursal.
    // Antes: una sesión con sucursal NO veía los servicios guardados con sucursal vacía → el host
    // creía que no había servicio y abría OTRO el mismo día (duplicados) y los 'abierta' quedaban
    // invisibles/inalcanzables. Esto alimenta 3 consumidores: el selector, el guard de "una abierta"
    // a la vez, y el cálculo del siguiente folio — los tres necesitan ver los servicios globales.
    if (sucursal_id && b.sucursal_id && b.sucursal_id !== sucursal_id) return;
    var fb = fechaToString(b.fecha);
    var item = { id:b.id, folio:b.folio, fecha:fb, servicio:b.servicio, host_email:b.host_email, estado:b.estado,
                 cerrada_at: b.cerrada_at instanceof Date ? b.cerrada_at.toISOString() : (b.cerrada_at || '') };
    if (!fecha || fb === fecha) bitacoras.push(item);
    // Recordatorio de cierre: servicios 'abierta' de días lógicos ANTERIORES a hoy (olvidados sin cerrar).
    // Comparación lexicográfica de YYYY-MM-DD = cronológica. No incluye el día de hoy (servicio en curso).
    if (String(b.estado || '') === 'abierta' && fb && fb < hoyLogico) abiertasPasadas.push(item);
  });
  abiertasPasadas.sort(function(a, c){ return a.fecha < c.fecha ? -1 : (a.fecha > c.fecha ? 1 : 0); });
  return { ok:true, bitacoras: bitacoras, abiertas_pasadas: abiertasPasadas };
}
function handleBitacoraGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria','cajera'])) return { ok:false, error:'Sin permisos' };
  if (!p.id) return { ok:false, error:'id requerido' };
  var b = rowsToObjects(getSheet('Bitacoras')).find(function(x){ return x.id === p.id && x.empresa_id === u.empresa_id; });
  if (!b) return { ok:false, error:'Bitácora no encontrada' };
  var payload = {}; try { payload = JSON.parse(b.payload_json || '{}'); } catch(e){}
  // Las filas viven en BitacoraFilas (guardadas individualmente por el host).
  // Reconstruir payload.rows desde ahí para que conciliacion.html tenga los datos reales.
  var sheetFilas = asegurarHoja('BitacoraFilas', BITACORA_FILAS_COLS);
  var filas = rowsToObjects(sheetFilas).filter(function(f){
    return f.bitacora_id === b.id && !f.borrada_at;
  });
  filas.sort(function(a, c){ return parseFloat(a.idx) - parseFloat(c.idx); });
  payload.rows = filas.map(function(f){
    var datos = {}; try { datos = JSON.parse(f.payload_json || '{}'); } catch(e){}
    datos._id  = f.id;
    datos._idx = parseFloat(f.idx);
    return datos;
  });
  return { ok:true, bitacora: {
    id:b.id, empresa_id:b.empresa_id, sucursal_id:b.sucursal_id,
    fecha:fechaToString(b.fecha), folio:b.folio, servicio:b.servicio,
    host_email:b.host_email, estado:b.estado,
    cerrada_at: b.cerrada_at instanceof Date ? b.cerrada_at.toISOString() : (b.cerrada_at || ''),
    payload: payload
  }};
}
// =============== BitacoraFilas: save por fila individual (protección anti-pérdida) ===============
var BITACORA_FILAS_COLS = ['id','bitacora_id','idx','creada_at','actualizada_at','borrada_at','borrada_motivo','borrada_por','host_email','payload_json'];

// Construye mapa email→nombre desde la hoja Usuarios de la empresa dada.
// Se llama una vez por invocación de list/sync para evitar lecturas repetidas.
function _buildHostNombreMap(empresa_id) {
  var map = {};
  try {
    rowsToObjects(getSheet('Usuarios')).forEach(function(usr){
      if (empresa_id && usr.empresa_id !== empresa_id) return;
      if (usr.email && usr.nombre) map[String(usr.email).toLowerCase()] = String(usr.nombre);
    });
  } catch(e) {}
  return map;
}

// Encuentra el número de fila (1-based) de una fila de BitacoraFilas por su id, SIN leer toda la
// hoja. Usa TextFinder sobre la columna A (id) — nativo y rápido aunque la hoja tenga miles de filas.
// Antes se hacía rowsToObjects(toda la hoja).find() en CADA guardado → O(n) lento al crecer el histórico.
function _bitacoraFilaRowPorId(sheet, fila_id) {
  if (!fila_id) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  try {
    var cell = sheet.getRange(2, 1, last - 1, 1).createTextFinder(String(fila_id)).matchEntireCell(true).findNext();
    return cell ? cell.getRow() : 0;
  } catch(e) { return 0; }
}

// Marcador "último cambio" por bitácora en caché compartida (entre tablets). Permite que el sync de
// 8s conteste "sin cambios" al instante SIN leer la hoja completa. La caché puede expirar; el fallback
// siempre es leer la hoja (correcto) y el full-reload de 30s es la red de seguridad.
function _bitacoraSetMaxTs(bitacora_id, tsMs) {
  if (!bitacora_id) return;
  try { CacheService.getScriptCache().put('bf_maxts_' + bitacora_id, String(tsMs), 21600); } catch(e){}
}
function _bitacoraGetMaxTs(bitacora_id) {
  try { var v = CacheService.getScriptCache().get('bf_maxts_' + bitacora_id); return v ? parseInt(v, 10) : 0; } catch(e){ return 0; }
}

function handleBitacoraFilasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var bitacora_id = String(p.bitacora_id || '');
  if (!bitacora_id) return { ok:false, error:'bitacora_id requerido' };
  var sheet = asegurarHoja('BitacoraFilas', BITACORA_FILAS_COLS);
  var filas = rowsToObjects(sheet).filter(function(f){
    if (f.bitacora_id !== bitacora_id) return false;
    if (f.borrada_at) return false;
    return true;
  });
  filas.sort(function(a,b){ return parseFloat(a.idx) - parseFloat(b.idx); });
  var maxTs = 0;
  filas.forEach(function(f){
    var ts = (f.actualizada_at && f.actualizada_at.getTime) ? f.actualizada_at.getTime() : new Date(f.actualizada_at).getTime();
    if (!isNaN(ts) && ts > maxTs) maxTs = ts;
  });
  var hostNombreMap = _buildHostNombreMap(u.empresa_id);
  return { ok:true, max_ts: maxTs, filas: filas.map(function(f){
    var datos = {}; try { datos = JSON.parse(f.payload_json || '{}'); } catch(e){}
    datos._id = f.id;
    datos._idx = parseFloat(f.idx);
    var ts = (f.actualizada_at && f.actualizada_at.getTime) ? f.actualizada_at.getTime() : new Date(f.actualizada_at).getTime();
    datos._actualizada_at = isNaN(ts) ? 0 : ts;
    datos._host_email = String(f.host_email || '');
    datos._host_nombre = hostNombreMap[datos._host_email.toLowerCase()] || datos._host_nombre || '';
    return datos;
  })};
}

// Sync incremental: solo devuelve cambios desde `since_ts`. Mucho más barato que list completo.
// Si nada cambió → { ok:true, sin_cambios:true, max_ts }. Si hubo cambios → filas modificadas
// (incluye borradas como { _id, _borrada:true } para que el cliente las quite del state local).
function handleBitacoraFilasSync(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var bitacora_id = String(p.bitacora_id || '');
  var sinceMs = parseInt(p.since_ts, 10) || 0;
  if (!bitacora_id) return { ok:false, error:'bitacora_id requerido' };
  // ATAJO RÁPIDO: si la caché compartida dice que no hubo cambios desde since_ts, contestar al
  // instante SIN leer la hoja completa. (La caché la actualizan todos los saves/deletes de ambas
  // tablets.) Si la caché expiró/está vacía → caemos al camino normal de leer la hoja.
  if (sinceMs > 0) {
    var cachedMax = _bitacoraGetMaxTs(bitacora_id);
    if (cachedMax > 0 && Math.floor(cachedMax / 1000) <= Math.floor(sinceMs / 1000)) {
      return { ok:true, sin_cambios:true, max_ts: cachedMax };
    }
  }
  var sheet = asegurarHoja('BitacoraFilas', BITACORA_FILAS_COLS);
  var todas = rowsToObjects(sheet).filter(function(f){ return f.bitacora_id === bitacora_id; });
  // Calcular max_ts — considera tanto actualizada_at como borrada_at
  var maxTs = 0;
  todas.forEach(function(f){
    var ts1 = (f.actualizada_at && f.actualizada_at.getTime) ? f.actualizada_at.getTime() : new Date(f.actualizada_at).getTime();
    var ts2 = f.borrada_at ? ((f.borrada_at.getTime) ? f.borrada_at.getTime() : new Date(f.borrada_at).getTime()) : 0;
    var t = Math.max(ts1 || 0, ts2 || 0);
    if (!isNaN(t) && t > maxTs) maxTs = t;
  });
  _bitacoraSetMaxTs(bitacora_id, maxTs);   // refrescar la caché con el valor real de la hoja
  // Normalizar a segundos: el cliente envía since_ts ms-preciso (del campo actualizada_at
  // que devuelve ahora.getTime()), pero Sheets puede almacenar con precisión de segundos.
  // Sin normalización, since_ts podría ser mayor que maxTs del mismo segundo → falso sin_cambios.
  var sinceS = Math.floor(sinceMs / 1000);
  var maxTsS = Math.floor(maxTs / 1000);
  // Si el cliente está al día, retornar sin payload (rápido — solo cabecera)
  if (sinceMs > 0 && sinceS >= maxTsS) {
    return { ok:true, sin_cambios:true, max_ts: maxTs };
  }
  // Filtrar filas modificadas o borradas después de since_ts
  var hostNombreMapSync = _buildHostNombreMap(u.empresa_id);
  var deltas = [];
  todas.forEach(function(f){
    var tsMod = (f.actualizada_at && f.actualizada_at.getTime) ? f.actualizada_at.getTime() : new Date(f.actualizada_at).getTime();
    var tsDel = f.borrada_at ? ((f.borrada_at.getTime) ? f.borrada_at.getTime() : new Date(f.borrada_at).getTime()) : 0;
    var maxFila = Math.max(tsMod || 0, tsDel || 0);
    if (sinceMs > 0 && Math.floor(maxFila / 1000) <= sinceS) return;
    if (f.borrada_at) {
      deltas.push({ _id: f.id, _borrada: true, _borrada_at: tsDel, _borrada_por: String(f.borrada_por||''), _borrada_motivo: String(f.borrada_motivo||'') });
      return;
    }
    var datos = {}; try { datos = JSON.parse(f.payload_json || '{}'); } catch(e){}
    datos._id = f.id;
    datos._idx = parseFloat(f.idx);
    datos._actualizada_at = isNaN(tsMod) ? 0 : tsMod;
    datos._host_email = String(f.host_email || '');
    datos._host_nombre = hostNombreMapSync[datos._host_email.toLowerCase()] || datos._host_nombre || '';
    deltas.push(datos);
  });
  return { ok:true, sin_cambios:false, max_ts: maxTs, deltas: deltas };
}

// Crea o actualiza UNA fila. Si data.id existe → update. Si no → insert con UUID nuevo.
function handleBitacoraFilaSave(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var bitacora_id = String(data.bitacora_id || '');
  var fila_id = String(data.id || '');
  var idx = parseFloat(data.idx);
  if (isNaN(idx)) idx = Date.now();
  if (!bitacora_id) return { ok:false, error:'bitacora_id requerido' };
  var sheet = asegurarHoja('BitacoraFilas', BITACORA_FILAS_COLS);
  var datos = data.datos || {};
  // Limpiar campos internos de los datos
  if (datos._id) delete datos._id;
  if (datos._idx) delete datos._idx;
  var ahora = new Date();
  var row = fila_id ? _bitacoraFilaRowPorId(sheet, fila_id) : 0;   // búsqueda directa (no lee toda la hoja)
  if (row) {
    sheet.getRange(row, 3).setValue(idx);
    sheet.getRange(row, 5).setValue(ahora);
    sheet.getRange(row, 10).setValue(JSON.stringify(datos));
    _bitacoraSetMaxTs(bitacora_id, ahora.getTime());
    return { ok:true, id: fila_id, action:'updated', actualizada_at: ahora.getTime(), host_email: u.email };
  }
  var newId = fila_id || uuid();
  sheet.appendRow([newId, bitacora_id, idx, ahora, ahora, '', '', '', u.email, JSON.stringify(datos)]);
  _bitacoraSetMaxTs(bitacora_id, ahora.getTime());
  return { ok:true, id: newId, action:'created', actualizada_at: ahora.getTime(), host_email: u.email };
}

// Soft-delete: marca borrada_at + motivo + quien borró. NO elimina la fila físicamente
// (auditoría siempre puede revisar qué se eliminó y por qué).
function handleBitacoraFilaDelete(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var fila_id = String(data.id || '');
  var motivo = String(data.motivo || '').trim();
  if (!fila_id) return { ok:false, error:'id requerido' };
  if (motivo.length < 5) return { ok:false, error:'Motivo mínimo 5 caracteres' };
  var sheet = asegurarHoja('BitacoraFilas', BITACORA_FILAS_COLS);
  var row = _bitacoraFilaRowPorId(sheet, fila_id);   // búsqueda directa (no lee toda la hoja)
  if (!row) return { ok:false, error:'Fila no encontrada' };
  var ahora = new Date();
  sheet.getRange(row, 6).setValue(ahora);
  sheet.getRange(row, 7).setValue(motivo);
  sheet.getRange(row, 8).setValue(u.email);
  // Actualizar el marcador de cambios con el bitacora_id de la fila (col 2) para que el borrado
  // se propague rápido a la otra tablet vía el sync.
  try { _bitacoraSetMaxTs(String(sheet.getRange(row, 2).getValue() || ''), ahora.getTime()); } catch(e){}
  return { ok:true };
}

// Migra una bitácora vieja (que tenía rows en payload_json) a registros individuales.
// Se llama automáticamente al cargar una bitácora antigua por primera vez.
function migrarBitacoraAFilas(bitacora_id, payloadRows) {
  if (!Array.isArray(payloadRows) || !payloadRows.length) return [];
  var sheet = asegurarHoja('BitacoraFilas', BITACORA_FILAS_COLS);
  var ahora = new Date();
  var resultados = [];
  payloadRows.forEach(function(r, i){
    var datos = JSON.parse(JSON.stringify(r)); // deep copy
    if (datos._id) delete datos._id;
    if (datos._idx) delete datos._idx;
    var newId = uuid();
    var idx = (i + 1) * 1000; // espacios para inserciones futuras
    sheet.appendRow([newId, bitacora_id, idx, ahora, ahora, '', '', '', '', JSON.stringify(datos)]);
    datos._id = newId;
    datos._idx = idx;
    resultados.push(datos);
  });
  return resultados;
}

// =============== Ocupación promedio por mesa (histórico) ===============
// Calcula, para cada mesa, el promedio de duración (en minutos) de cada visita basado en
// hora_ent → hora_sal de las filas históricas (BitacoraFilas).
// Filtra: últimos N días, empresa+sucursal del usuario, estados válidos, duraciones plausibles.
// Excluye Cancelada / No llegó / borradas.
function handleOcupacionPromedioMesas(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var dias = parseInt(p.dias, 10);
  if (isNaN(dias) || dias <= 0 || dias > 365) dias = 60;
  // Calcular fecha mínima (YYYY-MM-DD) en zona local
  var d = new Date();
  d.setDate(d.getDate() - dias);
  var pad = function(n){ return n < 10 ? '0'+n : ''+n; };
  var fechaDesde = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  // 1) Set de bitacora_id válidas (empresa, sucursal, fecha en rango)
  var shB = getSheet('Bitacoras');
  if (!shB) return { ok:true, mesas:{}, dias: dias, muestrasTotales: 0 };
  var bitacoras = rowsToObjects(shB).filter(function(b){
    if (b.empresa_id !== u.empresa_id) return false;
    if (!matchSucursal(b.sucursal_id, u.sucursal_id)) return false;
    var f = String(b.fecha || '');
    return f >= fechaDesde;
  });
  var bitsValidas = {};
  bitacoras.forEach(function(b){ bitsValidas[b.id] = true; });
  // 2) Recorrer BitacoraFilas y acumular por mesa
  var shF = asegurarHoja('BitacoraFilas', BITACORA_FILAS_COLS);
  var filas = rowsToObjects(shF);
  var acc = {}; // mesa → {sum, count}
  var totalMuestras = 0;
  function diffMin(he, hs){
    // formato HH:MM
    var ph = String(he||'').match(/^(\d{1,2}):(\d{2})$/);
    var ps = String(hs||'').match(/^(\d{1,2}):(\d{2})$/);
    if (!ph || !ps) return null;
    var m1 = parseInt(ph[1],10) * 60 + parseInt(ph[2],10);
    var m2 = parseInt(ps[1],10) * 60 + parseInt(ps[2],10);
    var diff = m2 - m1;
    if (diff < 0) diff += 24*60; // cruzó medianoche (raro pero posible)
    return diff;
  }
  filas.forEach(function(f){
    if (f.borrada_at) return;
    if (!bitsValidas[f.bitacora_id]) return;
    var datos = {}; try { datos = JSON.parse(f.payload_json || '{}'); } catch(e){ return; }
    var mesa = String(datos.mesa || '').trim();
    if (!mesa) return;
    var estado = String(datos.estado || '').trim();
    if (estado === 'Cancelada' || estado === 'No llegó') return;
    var min = diffMin(datos.hora_ent, datos.hora_sal);
    if (min === null) return;
    // Filtros de cordura: < 5 min es error de captura, > 240 min (4h) es residual o error
    if (min < 5 || min > 240) return;
    if (!acc[mesa]) acc[mesa] = { sum:0, count:0 };
    acc[mesa].sum += min;
    acc[mesa].count++;
    totalMuestras++;
  });
  var result = {};
  Object.keys(acc).forEach(function(m){
    result[m] = {
      promedio: Math.round(acc[m].sum / acc[m].count),
      muestras: acc[m].count
    };
  });
  return { ok:true, mesas: result, dias: dias, muestrasTotales: totalMuestras };
}

// =============== Sellos: firmas autenticadas por bitácora ===============
var SELLOS_COLS = ['id','bitacora_id','momento','rol_esperado','user_id','user_email','user_nombre','user_rol','sellado_at','es_override','motivo_override'];

// Roles esperados por sello en cada momento.
// Se usa para construir el tablero "esperados vs hechos" en la conciliación.
function selloEsperadosPorBitacora(servicio) {
  return [
    { momento:'apertura', rol:'host',                  label:'Apertura · Host' },
    { momento:'apertura', rol:'cajera',                label:'Apertura · Cajero' },
    { momento:'apertura', rol:'cocina',                label:'Apertura · Cocina' },
    { momento:'apertura', rol:'churrasca',             label:'Apertura · Churrasca' },
    { momento:'apertura', rol:'gerente_restaurante',   label:'Apertura · Gerente de Restaurante' },
    { momento:'cierre',   rol:'host',                  label:'Cierre · Host' },
    { momento:'cierre',   rol:'cajera',                label:'Cierre · Cajero' },
    { momento:'cierre',   rol:'cocina',                label:'Cierre · Cocina' },
    { momento:'cierre',   rol:'churrasca',             label:'Cierre · Churrasca' },
    { momento:'cierre',   rol:'gerente_restaurante',   label:'Cierre · Gerente de Restaurante' },
    { momento:'cierre',   rol:'gerente_administrativo',label:'Cierre · Administradora' }
  ];
}

function handleSellosList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var bitacora_id = String(p.bitacora_id || '');
  if (!bitacora_id) return { ok:false, error:'bitacora_id requerido' };
  var sheet = asegurarHoja('Sellos', SELLOS_COLS);
  var sellos = rowsToObjects(sheet).filter(function(s){ return s.bitacora_id === bitacora_id; });
  return { ok:true, sellos: sellos.map(function(s){
    return {
      id: s.id, momento: s.momento, rol_esperado: s.rol_esperado,
      user_email: s.user_email, user_nombre: s.user_nombre, user_rol: s.user_rol,
      sellado_at: s.sellado_at instanceof Date ? s.sellado_at.toISOString() : (s.sellado_at || ''),
      es_override: esActivo(s.es_override),
      motivo_override: String(s.motivo_override || '')
    };
  })};
}

// Crea un sello firmado por el usuario logueado.
// - Si rol del usuario === rol_esperado: sello directo, sin motivo.
// - Si NO: requiere ser admin/gerente_administrativo + motivo (override auditado).
// - Si ya existe sello para esa bitácora+momento+rol: rechaza duplicado.
function handleSelloSave(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var bitacora_id  = String(data.bitacora_id  || '');
  var momento      = String(data.momento      || '');
  var rol_esperado = String(data.rol_esperado || '').toLowerCase();
  var motivo       = String(data.motivo_override || '').trim();
  if (!bitacora_id) return { ok:false, error:'bitacora_id requerido' };
  if (['apertura','cierre'].indexOf(momento) === -1) return { ok:false, error:'momento inválido' };
  if (!rol_esperado) return { ok:false, error:'rol_esperado requerido' };
  var rolUsuario = String(u.rol || '').toLowerCase();
  // Validar permiso: el rol debe coincidir, o ser admin/gerente_administrativo (override)
  var puedeSellarPropio = (rolUsuario === rol_esperado);
  // gerente_restaurante puede sellar como host (hereda)
  if (!puedeSellarPropio && rolUsuario === 'gerente_restaurante' && rol_esperado === 'host') puedeSellarPropio = true;
  // gerente_administrativo puede sellar como admin (hereda)
  if (!puedeSellarPropio && rolUsuario === 'gerente_administrativo' && rol_esperado === 'admin') puedeSellarPropio = true;
  var esOverride = !puedeSellarPropio;
  if (esOverride) {
    if (['admin','gerente_administrativo'].indexOf(rolUsuario) === -1) {
      return { ok:false, error:'No puedes sellar como ' + rol_esperado + '. Solo el dueño del rol o admin pueden.' };
    }
    if (motivo.length < 5) return { ok:false, error:'Override requiere motivo (mínimo 5 caracteres) explicando por qué firmas tú en lugar del rol esperado.' };
  }
  var sheet = asegurarHoja('Sellos', SELLOS_COLS);
  var existing = rowsToObjects(sheet).find(function(s){
    return s.bitacora_id === bitacora_id && s.momento === momento && String(s.rol_esperado||'').toLowerCase() === rol_esperado;
  });
  if (existing) return { ok:false, error:'Ya existe un sello para este servicio (' + momento + ' · ' + rol_esperado + '). Lo selló ' + existing.user_nombre + '.' };
  var ahora = new Date();
  var newId = uuid();
  sheet.appendRow([newId, bitacora_id, momento, rol_esperado, u.id, u.email, u.nombre || u.email, rolUsuario, ahora, esOverride, motivo]);
  return { ok:true, id: newId, sello: {
    id: newId, momento: momento, rol_esperado: rol_esperado,
    user_email: u.email, user_nombre: u.nombre || u.email, user_rol: rolUsuario,
    sellado_at: ahora.toISOString(), es_override: esOverride, motivo_override: motivo
  }};
}

// Devuelve el tablero "esperados vs hechos" de una bitácora.
function handleSellosEstado(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var bitacora_id = String(p.bitacora_id || '');
  if (!bitacora_id) return { ok:false, error:'bitacora_id requerido' };
  var sheet = asegurarHoja('Sellos', SELLOS_COLS);
  var hechos = rowsToObjects(sheet).filter(function(s){ return s.bitacora_id === bitacora_id; });
  var esperados = selloEsperadosPorBitacora();
  var tablero = esperados.map(function(e){
    var hecho = hechos.find(function(h){
      return h.momento === e.momento && String(h.rol_esperado||'').toLowerCase() === e.rol;
    });
    return {
      momento: e.momento, rol: e.rol, label: e.label,
      sellado: !!hecho,
      por: hecho ? (hecho.user_nombre || hecho.user_email) : '',
      sellado_at: hecho ? (hecho.sellado_at instanceof Date ? hecho.sellado_at.toISOString() : hecho.sellado_at) : '',
      es_override: hecho ? esActivo(hecho.es_override) : false,
      motivo_override: hecho ? String(hecho.motivo_override || '') : ''
    };
  });
  return { ok:true, tablero: tablero };
}

function handleBitacoraSave(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var sheet = getSheet('Bitacoras'), bitacoras = rowsToObjects(sheet);
  var existing = data.id ? bitacoras.find(function(x){ return x.id === data.id && x.empresa_id === u.empresa_id; }) : null;
  var nuevoEstado = data.estado || (existing ? existing.estado : 'abierta');
  var ahora = new Date();
  if (existing) {
    if (existing.estado === 'cerrada' && !rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Bitácora cerrada' };
    var row = existing._row;
    sheet.getRange(row, 4).setValue(data.fecha || existing.fecha);
    sheet.getRange(row, 5).setValue(data.folio || existing.folio);
    sheet.getRange(row, 6).setValue(data.servicio || existing.servicio);
    sheet.getRange(row, 7).setValue(data.host_email || existing.host_email);
    sheet.getRange(row, 8).setValue(nuevoEstado);
    sheet.getRange(row, 9).setValue(nuevoEstado === 'cerrada' ? ahora : (existing.cerrada_at || ''));
    sheet.getRange(row, 10).setValue(JSON.stringify(data.payload || {}));
    return { ok:true, id: existing.id, action:'updated' };
  } else {
    var newId = data.id || uuid();
    var sucursal_id = data.sucursal_id || ((rowsToObjects(getSheet('Sucursales')).find(function(s){ return s.empresa_id === u.empresa_id; }) || {}).id || '');
    sheet.appendRow([newId, u.empresa_id, sucursal_id, data.fecha || '', data.folio || '', data.servicio || '',
      data.host_email || u.email, nuevoEstado, nuevoEstado === 'cerrada' ? ahora : '', JSON.stringify(data.payload || {})]);
    return { ok:true, id: newId, action:'created' };
  }
}

// === Limpieza de Bitácoras dañadas por el bug "se corrompe al ver" (preparada en v337) ===
// Repara SOLO lo estructural y reversible: (1) cierra servicios de días PASADOS que quedaron
// 'abierta' (fantasmas), (2) MARCA como 'anulada' los duplicados de un mismo folio dejando como
// bueno el que tiene MÁS filas (empate → el 'cerrada' → el más antiguo). NO borra nada físicamente
// (soft, recuperable) y NO corrige tipos Desayuno/Comida/Buffet (eso requiere decisión humana por día).
// Modo SIMULACIÓN por defecto: devuelve el plan sin escribir. Solo ejecuta con confirm='true', y en
// ese caso hace BACKUP de la hoja (Bitacoras_backup_<fecha_hora>) ANTES de tocar nada. Solo admin/auditoría.
function handleBitacoraLimpieza(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Solo admin/auditoría' };
  var ejecutar = (p.confirm === 'true' || p.confirm === '1');

  // Modo DIRIGIDO: anular ids específicos (casos de revisión manual aprobados por el dueño).
  // Acepta id completo o prefijo. Requiere confirm=true y hace backup antes.
  if (p.anular_ids) {
    var pedidos = String(p.anular_ids).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if (!ejecutar) return { ok:true, modo:'simulacion_dirigida', anular_ids: pedidos, nota:'Manda confirm=true para anular estos ids (hace backup primero).' };
    var shD = getSheet('Bitacoras');
    var todasD = rowsToObjects(shD).filter(function(b){ return b.empresa_id === u.empresa_id; });
    var ssD = shD.getParent();
    var stampD = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Mexico_City', 'yyyy-MM-dd_HHmm');
    shD.copyTo(ssD).setName('Bitacoras_backup_' + stampD);
    var hechos = [], noEncontrados = [];
    pedidos.forEach(function(pid){
      var b = todasD.find(function(x){ return x.id === pid || x.id.indexOf(pid) === 0; });
      if (b) { shD.getRange(b._row, 8).setValue('anulada'); hechos.push(b.folio + ' · ' + (b.servicio||'') + ' · ' + b.id); }
      else noEncontrados.push(pid);
    });
    return { ok:true, modo:'ejecutado_dirigido', backup:'Bitacoras_backup_' + stampD, anulados: hechos, no_encontrados: noEncontrados };
  }

  var sh = getSheet('Bitacoras');
  var todas = rowsToObjects(sh).filter(function(b){ return b.empresa_id === u.empresa_id; });
  // Filas vivas por bitacora_id (para elegir el "bueno" de cada duplicado).
  var filasPorBit = {};
  rowsToObjects(getSheet('BitacoraFilas')).forEach(function(f){
    if (f.borrada_at) return;
    filasPorBit[f.bitacora_id] = (filasPorBit[f.bitacora_id] || 0) + 1;
  });
  var hoyLogico = diaLogicoRestaurante();

  // 1) Duplicados por folio. SOLO se anula automáticamente lo que es claramente un fantasma VACÍO
  //    (0 filas). Si DOS o más filas del mismo folio tienen datos reales, puede ser una colisión de
  //    folio entre servicios DISTINTOS (ej. Desayuno + Comida del mismo viernes) → NO se toca, va a
  //    "revisar_manual" para que un humano decida. Nunca se anula nada con filas reales.
  var porFolio = {};
  todas.forEach(function(b){ if (b.estado === 'anulada') return; (porFolio[b.folio] = porFolio[b.folio] || []).push(b); }); // ya anulados: no re-procesar (idempotente)
  var anular = [], anuladoSet = {}, revisarManual = [], revSet = {};
  Object.keys(porFolio).forEach(function(fol){
    var grupo = porFolio[fol];
    if (grupo.length <= 1) return;
    var conFilas = grupo.filter(function(b){ return (filasPorBit[b.id] || 0) > 0; });
    if (conFilas.length >= 2) {                                         // ambiguo: 2+ con datos → humano
      grupo.forEach(function(b){ if (!revSet[b.id]) { revisarManual.push(b); revSet[b.id] = true; } });
      return;
    }
    // 0 ó 1 con datos: el "bueno" es el de filas (si hay), si no el 'cerrada'/más antiguo.
    grupo.sort(function(a, b){
      var fa = filasPorBit[a.id] || 0, fb = filasPorBit[b.id] || 0;
      if (fa !== fb) return fb - fa;                                    // más filas primero
      var ca = a.estado === 'cerrada' ? 0 : 1, cb = b.estado === 'cerrada' ? 0 : 1;
      if (ca !== cb) return ca - cb;                                    // 'cerrada' antes que 'abierta'
      return String(a.creada_at || a.id).localeCompare(String(b.creada_at || b.id)); // más antiguo
    });
    for (var i = 1; i < grupo.length; i++) {
      if ((filasPorBit[grupo[i].id] || 0) === 0) { anular.push(grupo[i]); anuladoSet[grupo[i].id] = true; }
      else if (!revSet[grupo[i].id]) { revisarManual.push(grupo[i]); revSet[grupo[i].id] = true; } // con filas → no tocar
    }
  });

  // 2) Servicios de días PASADOS aún 'abierta' (que NO sean los que vamos a anular) → cerrar.
  var cerrar = todas.filter(function(b){
    return !anuladoSet[b.id] && b.estado === 'abierta' && fechaToString(b.fecha) < hoyLogico;
  });

  function resumen(b){ return { id:b.id, folio:b.folio, fecha:fechaToString(b.fecha), servicio:b.servicio, estado:b.estado, host:b.host_email, filas: filasPorBit[b.id] || 0 }; }
  var plan = { anular: anular.map(resumen), cerrar: cerrar.map(resumen), revisar_manual: revisarManual.map(resumen) };

  if (!ejecutar) {
    return { ok:true, modo:'simulacion', total_servicios: todas.length,
             a_anular: plan.anular.length, a_cerrar: plan.cerrar.length, a_revisar_manual: plan.revisar_manual.length, plan: plan,
             nota:'SIMULACIÓN: no se escribió nada. Solo se anularían duplicados VACÍOS (0 filas). Para ejecutar manda confirm=true (hace backup primero).' };
  }

  // EJECUTAR — backup de la hoja completa ANTES de cualquier cambio.
  var ss = sh.getParent();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Mexico_City', 'yyyy-MM-dd_HHmm');
  var backupName = 'Bitacoras_backup_' + stamp;
  sh.copyTo(ss).setName(backupName);

  var ahora = new Date(), idRow = {};
  todas.forEach(function(b){ idRow[b.id] = b._row; });
  anular.forEach(function(b){ sh.getRange(idRow[b.id], 8).setValue('anulada'); });   // col 8 = estado
  cerrar.forEach(function(b){ sh.getRange(idRow[b.id], 8).setValue('cerrada'); sh.getRange(idRow[b.id], 9).setValue(ahora); });

  return { ok:true, modo:'ejecutado', backup: backupName,
           anulados: plan.anular.length, cerrados: plan.cerrar.length, plan: plan };
}

// =============== Certificación de uso (manual + examen por rol) ===============
// Cada usuario debe certificarse en su rol cada 6 meses. Examen de 15 preguntas (sorteadas
// de un banco mayor por rol), mínimo 90% (≥14/15). 3 intentos por ventana.
// El rol "observador" está exento — solo lee, no edita, no necesita examen.
var EXAMENES_COLS = ['id','rol','pregunta','opcion_a','opcion_b','opcion_c','opcion_d','correcta','explicacion','activa','creada_at'];
var CERTIFICACIONES_COLS = ['id','user_id','user_email','user_nombre','rol','intento','fecha','calificacion','total','aprobado','vence_at','respuestas_json','reseteado_por','reseteado_at'];
var EXAMEN_PREGUNTAS_X_INTENTO = 15;
var EXAMEN_MIN_APROBATORIO = 14; // ≥14/15 = 93% (mínimo 90%)
var EXAMEN_MAX_INTENTOS = 3;
var EXAMEN_VIGENCIA_MESES = 6;
var ROLES_EXENTOS_CERTIFICACION = ['observador','barman','panadero'];

// Hereda el rol "efectivo" del usuario para fines de examen
// (gerente_administrativo y admin tienen su propio examen distintos)
function rolParaExamen(u) {
  return String(u.rol || '').toLowerCase();
}
// Folio determinístico de un certificado a partir del id de la fila Certificaciones
// y la fecha de aprobación. Mismo certificado → mismo folio siempre. Estable, único, legible.
// Formato: CERT-{año}-{primeros 8 chars del UUID en mayúsculas}.
function folioDeCertificacion(c) {
  if (!c || !c.id) return '';
  var anio = String(c.fecha || '').slice(0,4) || new Date().getFullYear();
  var corto = String(c.id || '').replace(/-/g,'').slice(0,8).toUpperCase();
  return 'CERT-' + anio + '-' + corto;
}
// Calcula intentos disponibles del usuario en la ventana de 6 meses actual.
// Si tiene certificación vigente (aprobado y no vencido) → 0 intentos pendientes.
// Si tiene 3 intentos en la ventana sin aprobar → bloqueado por intentos (admin debe resetear).
function calcularEstadoCertificacion(user_id, rol) {
  var resultado = {
    rol: rol,
    exento: ROLES_EXENTOS_CERTIFICACION.indexOf(rol) !== -1,
    requiere_examen: false,
    aprobado_vigente: false,
    vence_at: '',
    ultimo_intento_fecha: '',
    ultima_calificacion: null,
    intentos_usados: 0,
    intentos_disponibles: EXAMEN_MAX_INTENTOS,
    bloqueado_por_intentos: false
  };
  if (resultado.exento) return resultado;
  var sh = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
  var hist = rowsToObjects(sh).filter(function(c){ return c.user_id === user_id && String(c.rol||'') === rol; });
  // Ordenar por fecha asc
  hist.sort(function(a,b){ return String(a.fecha||'').localeCompare(String(b.fecha||'')); });
  // Buscar última aprobación VIGENTE y también la última APROBADA (aunque haya vencido)
  // — para que el usuario pueda reimprimir su último certificado aunque ya esté vencido.
  var hoyISO = new Date().toISOString().slice(0,10);
  var ultimaAprobada = null; // vigente
  var ultimaAprobadaCualquiera = null; // vigente o vencida (la más reciente aprobada)
  hist.forEach(function(c){
    if (esActivo(c.aprobado)) {
      // Tracking de la última aprobada (sin importar vigencia) — para reimpresión histórica
      if (!ultimaAprobadaCualquiera || String(c.fecha||'') > String(ultimaAprobadaCualquiera.fecha||'')) {
        ultimaAprobadaCualquiera = c;
      }
      // Tracking de la última aprobada VIGENTE — para mostrar como "certificado activo"
      var ven = String(c.vence_at || '').slice(0,10);
      if (ven && ven >= hoyISO) {
        if (!ultimaAprobada || String(c.fecha||'') > String(ultimaAprobada.fecha||'')) {
          ultimaAprobada = c;
        }
      }
    }
  });
  // Siempre adjuntar el último certificado aprobado del usuario (aunque haya vencido)
  // para reimpresión / consulta histórica desde la pantalla principal.
  if (ultimaAprobadaCualquiera) {
    var venUltimo = String(ultimaAprobadaCualquiera.vence_at || '').slice(0,10);
    resultado.ultimo_cert = {
      id: ultimaAprobadaCualquiera.id,
      folio: folioDeCertificacion(ultimaAprobadaCualquiera),
      fecha: String(ultimaAprobadaCualquiera.fecha || '').slice(0,10),
      vence_at: venUltimo,
      calificacion: parseInt(ultimaAprobadaCualquiera.calificacion, 10) || 0,
      total: parseInt(ultimaAprobadaCualquiera.total, 10) || 0,
      porcentaje: ultimaAprobadaCualquiera.total ? Math.round((parseInt(ultimaAprobadaCualquiera.calificacion,10) / parseInt(ultimaAprobadaCualquiera.total,10)) * 100) : 0,
      user_nombre: ultimaAprobadaCualquiera.user_nombre || '',
      rol: rol,
      vigente: !!(venUltimo && venUltimo >= hoyISO)
    };
  }
  if (ultimaAprobada) {
    resultado.aprobado_vigente = true;
    resultado.vence_at = String(ultimaAprobada.vence_at || '').slice(0,10);
    resultado.ultima_calificacion = parseInt(ultimaAprobada.calificacion, 10) || 0;
    resultado.ultimo_intento_fecha = String(ultimaAprobada.fecha || '').slice(0,10);
    resultado.requiere_examen = false;
    // Datos del certificado vigente para reimpresión/consulta
    resultado.cert = {
      id: ultimaAprobada.id,
      folio: folioDeCertificacion(ultimaAprobada),
      fecha: String(ultimaAprobada.fecha || '').slice(0,10),
      vence_at: String(ultimaAprobada.vence_at || '').slice(0,10),
      calificacion: parseInt(ultimaAprobada.calificacion, 10) || 0,
      total: parseInt(ultimaAprobada.total, 10) || 0,
      porcentaje: ultimaAprobada.total ? Math.round((parseInt(ultimaAprobada.calificacion,10) / parseInt(ultimaAprobada.total,10)) * 100) : 0,
      user_nombre: ultimaAprobada.user_nombre || '',
      rol: rol
    };
    return resultado;
  }
  // No aprobado vigente: contar intentos en la ventana actual (desde último reset o desde vencimiento)
  // Una "ventana" es: desde la fecha del último reset, o desde el último vencimiento, o desde el principio.
  var inicioVentana = '';
  // Buscar último reset
  var ultimoReset = null;
  hist.forEach(function(c){
    if (c.reseteado_at) {
      var rs = String(c.reseteado_at || '').slice(0,10);
      if (!ultimoReset || rs > ultimoReset) ultimoReset = rs;
    }
  });
  if (ultimoReset) inicioVentana = ultimoReset;
  // Contar intentos desde inicioVentana
  var intentosVentana = hist.filter(function(c){
    if (esActivo(c.aprobado)) return false; // los aprobados ya fueron procesados
    if (inicioVentana && String(c.fecha||'') < inicioVentana) return false;
    if (c.reseteado_at) return false; // los reseteados no cuentan
    return true;
  });
  resultado.intentos_usados = intentosVentana.length;
  resultado.intentos_disponibles = Math.max(0, EXAMEN_MAX_INTENTOS - intentosVentana.length);
  resultado.bloqueado_por_intentos = resultado.intentos_disponibles === 0;
  resultado.requiere_examen = !resultado.bloqueado_por_intentos;
  if (intentosVentana.length > 0) {
    var ult = intentosVentana[intentosVentana.length - 1];
    resultado.ultimo_intento_fecha = String(ult.fecha || '').slice(0,10);
    resultado.ultima_calificacion = parseInt(ult.calificacion, 10) || 0;
  }
  return resultado;
}

function handleExamenEstado(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rol = rolParaExamen(u);
  return { ok:true, estado: calcularEstadoCertificacion(u.id, rol) };
}

// Inicia un examen: sortea 15 preguntas activas del banco para el rol y las devuelve sin la respuesta correcta.
function handleExamenIniciar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rol = rolParaExamen(u);
  if (ROLES_EXENTOS_CERTIFICACION.indexOf(rol) !== -1) {
    return { ok:false, error:'Tu rol no requiere certificación' };
  }
  var estado = calcularEstadoCertificacion(u.id, rol);
  if (estado.aprobado_vigente) return { ok:false, error:'Ya estás certificado y vigente hasta ' + estado.vence_at };
  if (estado.bloqueado_por_intentos) return { ok:false, error:'Agotaste los ' + EXAMEN_MAX_INTENTOS + ' intentos. Pide a un admin resetear tu certificación.' };
  // Requisito de curso completo (estricto): si hay módulos publicados para este rol,
  // el usuario debe haberlos completado todos antes de tomar el examen final.
  var shC = asegurarHoja('Cursos', CURSOS_COLS);
  var modulosRol = rowsToObjects(shC).filter(function(m){
    return String(m.rol||'').toLowerCase() === rol && esActivo(m.activa);
  });
  if (modulosRol.length > 0) {
    var shP = asegurarHoja('ProgresoCursos', PROGRESO_COLS);
    var miPr = rowsToObjects(shP).filter(function(pr){ return pr.user_id === u.id && !!pr.completado_at; });
    var idsCompletados = {};
    miPr.forEach(function(pr){ idsCompletados[pr.modulo_id] = true; });
    var pendientes = modulosRol.filter(function(m){ return !idsCompletados[m.id]; });
    if (pendientes.length > 0) {
      return { ok:false, error:'Debes completar tu curso antes del examen. Te faltan ' + pendientes.length + ' de ' + modulosRol.length + ' módulos.', requiere_curso: true, modulos_total: modulosRol.length, modulos_completados: modulosRol.length - pendientes.length };
    }
  }
  var sh = asegurarHoja('Examenes', EXAMENES_COLS);
  var bancoTodos = rowsToObjects(sh).filter(function(q){
    return String(q.rol||'').toLowerCase() === rol && esActivo(q.activa);
  });
  if (bancoTodos.length < EXAMEN_PREGUNTAS_X_INTENTO) {
    return { ok:false, error:'Banco insuficiente: hay '+bancoTodos.length+' preguntas activas para "'+rol+'", se requieren al menos '+EXAMEN_PREGUNTAS_X_INTENTO+'. Pide a un admin agregar preguntas.' };
  }
  // Sortear sin reemplazo
  bancoTodos.sort(function(){ return Math.random() - 0.5; });
  var sorteadas = bancoTodos.slice(0, EXAMEN_PREGUNTAS_X_INTENTO);
  // Devolver sin opción correcta (cliente NO debe verla)
  var preguntas = sorteadas.map(function(q){
    return {
      id: q.id,
      pregunta: q.pregunta,
      opcion_a: q.opcion_a,
      opcion_b: q.opcion_b,
      opcion_c: q.opcion_c,
      opcion_d: q.opcion_d
    };
  });
  return {
    ok: true,
    rol: rol,
    intento: estado.intentos_usados + 1,
    intentos_max: EXAMEN_MAX_INTENTOS,
    min_aprobatorio: EXAMEN_MIN_APROBATORIO,
    total: EXAMEN_PREGUNTAS_X_INTENTO,
    preguntas: preguntas
  };
}

// Recibe respuestas {pregunta_id: 'a'|'b'|'c'|'d'}, califica, guarda y devuelve resultado.
function handleExamenCalificar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rol = rolParaExamen(u);
  if (ROLES_EXENTOS_CERTIFICACION.indexOf(rol) !== -1) {
    return { ok:false, error:'Tu rol no requiere certificación' };
  }
  // Lock global para evitar carreras de doble-click. Si la red tarda + el usuario hace
  // varios clicks en "Calificar", llegan N requests simultáneas — sin lock, cada una
  // crea un intento y agota la cuenta del usuario. Con lock, solo una procesa a la vez;
  // las otras (que entran después) ven que el intento ya fue registrado y reciben el
  // resultado idempotente en lugar de crear uno nuevo.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) {
    return { ok:false, error:'El sistema está procesando. Espera unos segundos y refresca.' };
  }

  try {
    var estado = calcularEstadoCertificacion(u.id, rol);
    if (estado.aprobado_vigente) return { ok:false, error:'Ya estás certificado y vigente' };

    // Idempotencia: si la última certificación de este usuario+rol fue HOY y ya pasaron
    // todas las preguntas (15 respuestas en respuestas_json), probablemente es un re-disparo
    // del mismo intento. Devolvemos esa calificación en lugar de crear una nueva.
    // Esto se evalúa DESPUÉS del lock — significa que la otra request ya terminó y escribió.
    var shCertCheck = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
    var hoyISOcheck = new Date().toISOString().slice(0,10);
    var reciente = rowsToObjects(shCertCheck).filter(function(c){
      if (c.user_id !== u.id || String(c.rol||'') !== rol) return false;
      if (c.reseteado_at) return false;
      return String(c.fecha || '').slice(0,10) === hoyISOcheck;
    });
    if (reciente.length > 0) {
      // Tomar la más reciente por ID (los IDs son UUIDs sortable por inserción, así que la
      // que está en el último appendRow tiene la fila más alta)
      reciente.sort(function(a,b){ return (b._row||0) - (a._row||0); });
      var ult = reciente[0];
      // Si la calificación actual EXACTAMENTE coincide con las respuestas que el usuario
      // está enviando ahora, es claramente el mismo intento — devolvemos idempotente.
      var respCheck; try { respCheck = JSON.parse(p.respuestas || '{}'); } catch(e){ respCheck = {}; }
      var respUlt = {}; try { respUlt = JSON.parse(ult.respuestas_json || '[]'); } catch(e){}
      // El detalle guardado incluye {id, marcada, ...} — extraemos solo los marcados
      var marcadasUlt = {};
      if (Array.isArray(respUlt)) {
        respUlt.forEach(function(d){ if (d && d.id) marcadasUlt[d.id] = String(d.marcada||'').toLowerCase(); });
      }
      var mismas = true;
      var keysCheck = Object.keys(respCheck);
      if (keysCheck.length === 0 || keysCheck.length !== Object.keys(marcadasUlt).length) {
        mismas = false;
      } else {
        for (var i = 0; i < keysCheck.length; i++) {
          var k = keysCheck[i];
          if (String(respCheck[k]||'').toLowerCase() !== marcadasUlt[k]) { mismas = false; break; }
        }
      }
      if (mismas) {
        var califUlt = parseInt(ult.calificacion, 10) || 0;
        var totalUlt = parseInt(ult.total, 10) || EXAMEN_PREGUNTAS_X_INTENTO;
        var aprUlt = esActivo(ult.aprobado);
        return {
          ok: true,
          idempotente: true,
          aprobado: aprUlt,
          calificacion: califUlt,
          total: totalUlt,
          porcentaje: Math.round((califUlt/totalUlt)*100),
          min_aprobatorio: EXAMEN_MIN_APROBATORIO,
          vence_at: String(ult.vence_at || '').slice(0,10),
          intento: parseInt(ult.intento, 10) || estado.intentos_usados,
          intentos_max: EXAMEN_MAX_INTENTOS,
          detalle: Array.isArray(respUlt) ? respUlt : [],
          cert_id: aprUlt ? ult.id : '',
          cert_folio: aprUlt ? folioDeCertificacion(ult) : '',
          cert_fecha: String(ult.fecha || '').slice(0,10)
        };
      }
    }

    if (estado.bloqueado_por_intentos) return { ok:false, error:'Sin intentos disponibles. Pide reset al admin.' };
  var respuestas; try { respuestas = JSON.parse(p.respuestas || '{}'); } catch(e){ return { ok:false, error:'respuestas inválidas' }; }
  var preguntaIds = Object.keys(respuestas);
  if (preguntaIds.length !== EXAMEN_PREGUNTAS_X_INTENTO) {
    return { ok:false, error:'Debes contestar las '+EXAMEN_PREGUNTAS_X_INTENTO+' preguntas (recibidas: '+preguntaIds.length+')' };
  }
  var sh = asegurarHoja('Examenes', EXAMENES_COLS);
  var banco = {};
  rowsToObjects(sh).forEach(function(q){ banco[q.id] = q; });
  // Calificar
  var correctas = 0;
  var detalle = [];
  preguntaIds.forEach(function(pid){
    var preg = banco[pid];
    if (!preg) return; // pregunta no existe
    var marcada = String(respuestas[pid] || '').trim().toLowerCase();
    var correcta = String(preg.correcta || '').trim().toLowerCase();
    var fueCorrecta = marcada === correcta && marcada !== '';
    if (fueCorrecta) correctas++;
    detalle.push({ id: pid, marcada: marcada, correcta: correcta, ok: fueCorrecta });
  });
  var aprobado = correctas >= EXAMEN_MIN_APROBATORIO;
  var ahora = new Date();
  var ahoraISO = ahora.toISOString().slice(0,10);
  var venceAt = '';
  if (aprobado) {
    var v = new Date(ahora);
    v.setMonth(v.getMonth() + EXAMEN_VIGENCIA_MESES);
    venceAt = v.toISOString().slice(0,10);
  }
    var shCert = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
    var newId = uuid();
    shCert.appendRow([
      newId, u.id, u.email, u.nombre || '', rol,
      estado.intentos_usados + 1, ahoraISO, correctas, EXAMEN_PREGUNTAS_X_INTENTO,
      aprobado ? true : false, venceAt, JSON.stringify(detalle), '', ''
    ]);
    // Folio determinístico para el certificado recién creado (se reutiliza en re-impresión)
    var certFolio = aprobado ? folioDeCertificacion({ id: newId, fecha: ahoraISO }) : '';
    return {
      ok: true,
      aprobado: aprobado,
      calificacion: correctas,
      total: EXAMEN_PREGUNTAS_X_INTENTO,
      porcentaje: Math.round((correctas/EXAMEN_PREGUNTAS_X_INTENTO)*100),
      min_aprobatorio: EXAMEN_MIN_APROBATORIO,
      vence_at: venceAt,
      intento: estado.intentos_usados + 1,
      intentos_max: EXAMEN_MAX_INTENTOS,
      detalle: detalle,
      cert_id: aprobado ? newId : '',
      cert_folio: certFolio,
      cert_fecha: aprobado ? ahoraISO : ''
    };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

// Lista certificaciones de TODOS los usuarios (admin/gerentes/auditoría).
function handleCertificacionesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_restaurante','gerente_administrativo','auditoria'])) return { ok:false, error:'Sin permisos' };
  var users = rowsToObjects(getSheet('Usuarios')).filter(function(usr){
    return usr.empresa_id === u.empresa_id && esActivo(usr.activo);
  });
  var resumen = users.map(function(usr){
    var rol = String(usr.rol||'').toLowerCase();
    var est = calcularEstadoCertificacion(usr.id, rol);
    return {
      user_id: usr.id,
      email: usr.email,
      nombre: usr.nombre,
      rol: rol,
      exento: est.exento,
      aprobado_vigente: est.aprobado_vigente,
      vence_at: est.vence_at,
      ultimo_intento_fecha: est.ultimo_intento_fecha,
      ultima_calificacion: est.ultima_calificacion,
      intentos_usados: est.intentos_usados,
      intentos_disponibles: est.intentos_disponibles,
      bloqueado_por_intentos: est.bloqueado_por_intentos
    };
  });
  return { ok:true, certificaciones: resumen };
}

// Histórico personal del usuario logueado (todos sus intentos)
function handleCertificacionesMias(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
  var hist = rowsToObjects(sh).filter(function(c){ return c.user_id === u.id; });
  hist.sort(function(a,b){ return String(b.fecha||'').localeCompare(String(a.fecha||'')); });
  // También devuelve nombre del usuario para reconstruir el certificado en frontend
  var userNombre = u.nombre || u.email || '';
  return { ok:true, user_nombre: userNombre, intentos: hist.map(function(c){
    var aprobado = esActivo(c.aprobado);
    var total = parseInt(c.total,10) || 0;
    var calif = parseInt(c.calificacion,10) || 0;
    return {
      id: c.id,
      rol: c.rol,
      intento: parseInt(c.intento,10) || 0,
      fecha: String(c.fecha||'').slice(0,10),
      calificacion: calif,
      total: total,
      porcentaje: total ? Math.round((calif/total)*100) : 0,
      aprobado: aprobado,
      vence_at: String(c.vence_at||'').slice(0,10),
      reseteado_at: String(c.reseteado_at||'').slice(0,10),
      // Folio determinístico — solo aplica a aprobados (un certificado real)
      folio: aprobado ? folioDeCertificacion(c) : ''
    };
  })};
}

// Admin resetea los intentos de un usuario (re-capacitación). Marca todos los intentos previos como reseteados.
function handleCertificacionResetear(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin puede resetear' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var target_user_id = String(data.user_id || '');
  if (!target_user_id) return { ok:false, error:'user_id requerido' };
  var sh = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
  var datos = sh.getDataRange().getValues();
  var headers = datos[0];
  var iUser = headers.indexOf('user_id');
  var iAprob = headers.indexOf('aprobado');
  var iReset = headers.indexOf('reseteado_at');
  var iResetPor = headers.indexOf('reseteado_por');
  var ahora = new Date();
  var ahoraISO = ahora.toISOString().slice(0,10);
  var marcados = 0;
  for (var r = 1; r < datos.length; r++) {
    if (datos[r][iUser] !== target_user_id) continue;
    if (esActivo(datos[r][iAprob])) continue; // no tocar aprobados (esos NO se resetean)
    if (datos[r][iReset]) continue;
    sh.getRange(r+1, iReset+1).setValue(ahoraISO);
    sh.getRange(r+1, iResetPor+1).setValue(u.email);
    marcados++;
  }
  return { ok:true, intentos_reseteados: marcados };
}

// =============================================================================
// HERRAMIENTAS DE EMERGENCIA — CERTIFICACIONES
// Correr DIRECTO desde el editor de Apps Script (NO son endpoints HTTP).
// Útiles cuando el reset normal falla o hay datos huérfanos.
// =============================================================================

// Diagnóstico: muestra TODOS los intentos de un usuario (por email) con detalles.
// Uso: en editor → seleccionar función `diagnosticarCertificacionPorEmail` → Run.
//      Cambiar el email aquí abajo antes de correr. Resultado en Logs.
function diagnosticarCertificacionPorEmail() {
  var EMAIL = 'cambia_aqui@ejemplo.com';  // ← cambia esto
  var sh = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
  var todos = rowsToObjects(sh).filter(function(c){
    return String(c.user_email||'').toLowerCase() === EMAIL.toLowerCase();
  });
  if (!todos.length) { console.log('No hay intentos para', EMAIL); return; }
  console.log('=== INTENTOS DE ' + EMAIL + ' ===');
  console.log('Total registros:', todos.length);
  todos.sort(function(a,b){ return String(a.fecha||'').localeCompare(String(b.fecha||'')); });
  todos.forEach(function(c, i){
    console.log('---');
    console.log('Intento', i+1, '· ID', c.id);
    console.log('  Rol:', c.rol, '· Fecha:', c.fecha, '· Calificación:', c.calificacion + '/' + c.total);
    console.log('  Aprobado:', c.aprobado, '· Vence:', c.vence_at);
    console.log('  Reseteado_at:', c.reseteado_at || '(no)', '· Reseteado_por:', c.reseteado_por || '(no)');
  });
  // Calcular estado actual
  var u = rowsToObjects(getSheet('Usuarios')).find(function(x){ return String(x.email||'').toLowerCase() === EMAIL.toLowerCase(); });
  if (u) {
    var rol = String(u.rol || '').toLowerCase();
    var estado = calcularEstadoCertificacion(u.id, rol);
    console.log('---');
    console.log('=== ESTADO CALCULADO POR EL SISTEMA ===');
    console.log('  intentos_usados:', estado.intentos_usados);
    console.log('  intentos_disponibles:', estado.intentos_disponibles);
    console.log('  bloqueado_por_intentos:', estado.bloqueado_por_intentos);
    console.log('  aprobado_vigente:', estado.aprobado_vigente);
    console.log('  requiere_examen:', estado.requiere_examen);
  } else {
    console.log('⚠ No se encontró usuario con ese email en hoja Usuarios');
  }
}

// Reset agresivo: marca TODOS los intentos del usuario como reseteados (incluso aprobados
// vencidos). Usar si el reset normal no surtió efecto. Idempotente.
// Uso: en editor → función `resetCertificacionAgresivoPorEmail` → Run. Cambiar email arriba.
function resetCertificacionAgresivoPorEmail() {
  var EMAIL = 'cambia_aqui@ejemplo.com';  // ← cambia esto
  var sh = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
  var datos = sh.getDataRange().getValues();
  var headers = datos[0];
  var iEmail = headers.indexOf('user_email');
  var iAprob = headers.indexOf('aprobado');
  var iReset = headers.indexOf('reseteado_at');
  var iResetPor = headers.indexOf('reseteado_por');
  var hoyISO = new Date().toISOString().slice(0,10);
  var marcados = 0;
  for (var r = 1; r < datos.length; r++) {
    if (String(datos[r][iEmail]||'').toLowerCase() !== EMAIL.toLowerCase()) continue;
    if (esActivo(datos[r][iAprob])) continue; // no tocar aprobados vigentes
    sh.getRange(r+1, iReset+1).setValue(hoyISO);
    sh.getRange(r+1, iResetPor+1).setValue('emergencia_admin');
    marcados++;
  }
  console.log('✓ ' + marcados + ' intento(s) marcados como reseteados para ' + EMAIL);
  console.log('La host puede entrar al examen y tendrá los 3 intentos disponibles.');
}

// Borra DEFINITIVAMENTE todos los intentos no aprobados del usuario. Usar SOLO
// como último recurso (cuando incluso el reset agresivo no resuelve por algún
// edge case con fechas). Idempotente. NO borra aprobados (auditoría).
function borrarIntentosNoAprobadosPorEmail() {
  var EMAIL = 'cambia_aqui@ejemplo.com';  // ← cambia esto
  var sh = asegurarHoja('Certificaciones', CERTIFICACIONES_COLS);
  var datos = sh.getDataRange().getValues();
  var headers = datos[0];
  var iEmail = headers.indexOf('user_email');
  var iAprob = headers.indexOf('aprobado');
  // Recorrer al revés para no romper índices
  var borrados = 0;
  for (var r = datos.length - 1; r >= 1; r--) {
    if (String(datos[r][iEmail]||'').toLowerCase() !== EMAIL.toLowerCase()) continue;
    if (esActivo(datos[r][iAprob])) continue; // no tocar aprobados
    sh.deleteRow(r + 1);
    borrados++;
  }
  console.log('✓ ' + borrados + ' intento(s) borrados para ' + EMAIL);
}

// Admin: lista preguntas del banco para un rol (incluye respuestas correctas — solo admin).
function handleExamenPreguntasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  var rol = String(p.rol || '').toLowerCase();
  var sh = asegurarHoja('Examenes', EXAMENES_COLS);
  var preg = rowsToObjects(sh).filter(function(q){
    return !rol || String(q.rol||'').toLowerCase() === rol;
  });
  return { ok:true, preguntas: preg.map(function(q){
    return {
      id: q.id, rol: q.rol,
      pregunta: q.pregunta,
      opcion_a: q.opcion_a, opcion_b: q.opcion_b, opcion_c: q.opcion_c, opcion_d: q.opcion_d,
      correcta: q.correcta, explicacion: q.explicacion,
      activa: esActivo(q.activa)
    };
  })};
}
// Admin: ejecuta el bootstrap del banco de preguntas (idempotente: no duplica)
function handleBancoPreguntasBootstrap(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  try {
    var msg = setupBancoPreguntasFogueira();
    return { ok:true, mensaje: msg };
  } catch(e) {
    return { ok:false, error:'Error: ' + e.message };
  }
}

// Admin: agrega/edita una pregunta del banco
function handleExamenPreguntaSave(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  if (!data.rol || !data.pregunta || !data.correcta) return { ok:false, error:'Campos requeridos: rol, pregunta, correcta' };
  if (['a','b','c','d'].indexOf(String(data.correcta).toLowerCase()) === -1) return { ok:false, error:'correcta debe ser a, b, c o d' };
  var sh = asegurarHoja('Examenes', EXAMENES_COLS);
  var ahora = new Date();
  if (data.id) {
    // Update
    var existing = rowsToObjects(sh).find(function(q){ return q.id === data.id; });
    if (!existing) return { ok:false, error:'Pregunta no encontrada' };
    var row = existing._row;
    sh.getRange(row, 2).setValue(String(data.rol).toLowerCase());
    sh.getRange(row, 3).setValue(data.pregunta);
    sh.getRange(row, 4).setValue(data.opcion_a || '');
    sh.getRange(row, 5).setValue(data.opcion_b || '');
    sh.getRange(row, 6).setValue(data.opcion_c || '');
    sh.getRange(row, 7).setValue(data.opcion_d || '');
    sh.getRange(row, 8).setValue(String(data.correcta).toLowerCase());
    sh.getRange(row, 9).setValue(data.explicacion || '');
    sh.getRange(row,10).setValue(data.activa === false ? false : true);
    return { ok:true, id: data.id, action:'updated' };
  }
  var newId = uuid();
  sh.appendRow([newId, String(data.rol).toLowerCase(), data.pregunta,
    data.opcion_a||'', data.opcion_b||'', data.opcion_c||'', data.opcion_d||'',
    String(data.correcta).toLowerCase(), data.explicacion||'',
    data.activa === false ? false : true, ahora]);
  return { ok:true, id: newId, action:'created' };
}

// Admin: lista todos los módulos de un rol para edición (sin filtro de progreso)
function handleCursosAdminList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  var rol = String(p.rol || '').toLowerCase();
  var sh = asegurarHoja('Cursos', CURSOS_COLS);
  var modulos = rowsToObjects(sh).filter(function(m){
    return !rol || String(m.rol||'').toLowerCase() === rol;
  });
  modulos.sort(function(a,b){ return (parseInt(a.modulo_orden,10)||0) - (parseInt(b.modulo_orden,10)||0); });
  return { ok:true, modulos: modulos.map(function(m){
    return {
      id: m.id, rol: m.rol,
      orden: parseInt(m.modulo_orden,10)||0,
      titulo: m.modulo_titulo,
      resumen: m.modulo_resumen,
      contenido_md: m.contenido_md || '',
      tiempo: parseInt(m.tiempo_estimado_min,10)||5,
      tiene_quiz: esActivo(m.tiene_quiz),
      quiz_json: m.quiz_preguntas_json || '[]',
      quiz_min: parseInt(m.quiz_min_aprobatorio,10)||0,
      activa: esActivo(m.activa)
    };
  })};
}

// Admin: crea o actualiza un módulo del curso
function handleCursoModuloSave(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  if (!data.rol || !data.titulo) return { ok:false, error:'Campos requeridos: rol, titulo' };
  var sh = asegurarHoja('Cursos', CURSOS_COLS);
  var quizJson = data.quiz_json || '[]';
  var tieneQuiz = false;
  try { tieneQuiz = (JSON.parse(quizJson)||[]).length > 0; } catch(e){}
  if (data.id) {
    var existing = rowsToObjects(sh).find(function(m){ return m.id === data.id; });
    if (!existing) return { ok:false, error:'Módulo no encontrado' };
    var row = existing._row;
    sh.getRange(row, 2).setValue(String(data.rol).toLowerCase());
    sh.getRange(row, 3).setValue(parseInt(data.orden,10)||1);
    sh.getRange(row, 4).setValue(data.titulo);
    sh.getRange(row, 5).setValue(data.resumen || '');
    sh.getRange(row, 6).setValue(data.contenido_md || '');
    sh.getRange(row, 7).setValue(parseInt(data.tiempo,10)||5);
    sh.getRange(row, 8).setValue(tieneQuiz);
    sh.getRange(row, 9).setValue(quizJson);
    sh.getRange(row,10).setValue(parseInt(data.quiz_min,10)||0);
    sh.getRange(row,11).setValue(data.activa !== false);
    return { ok:true, id:data.id, action:'updated' };
  }
  var newId = uuid();
  sh.appendRow([newId, String(data.rol).toLowerCase(), parseInt(data.orden,10)||1,
    data.titulo, data.resumen||'', data.contenido_md||'',
    parseInt(data.tiempo,10)||5, tieneQuiz, quizJson,
    parseInt(data.quiz_min,10)||0, data.activa!==false, new Date()]);
  return { ok:true, id:newId, action:'created' };
}

// =============== Cursos de capacitación (tipo Coursera) ===============
// Cada rol tiene un curso de N módulos. El usuario los completa en orden;
// cada módulo puede tener mini-quiz bloqueante (debe aprobar para avanzar).
// El examen final solo se desbloquea cuando completa el 100% del curso.
var CURSOS_COLS = ['id','rol','modulo_orden','modulo_titulo','modulo_resumen','contenido_md','tiempo_estimado_min','tiene_quiz','quiz_preguntas_json','quiz_min_aprobatorio','activa','creada_at'];
var PROGRESO_COLS = ['id','user_id','user_email','rol','modulo_id','modulo_orden','iniciado_at','completado_at','score_quiz','total_quiz','intentos_quiz','tiempo_real_min'];

// Devuelve los módulos del curso del rol del usuario, ordenados, con mi progreso anexado.
// El cliente NO recibe quiz_preguntas_json para módulos no completados (anti-spoiler).
function handleCursoGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var rol = String(u.rol || '').toLowerCase();
  if (ROLES_EXENTOS_CERTIFICACION.indexOf(rol) !== -1) return { ok:true, exento:true, modulos:[], progreso_pct:100 };
  var sh = asegurarHoja('Cursos', CURSOS_COLS);
  var modulos = rowsToObjects(sh).filter(function(m){
    return String(m.rol||'').toLowerCase() === rol && esActivo(m.activa);
  });
  modulos.sort(function(a,b){ return (parseInt(a.modulo_orden,10)||0) - (parseInt(b.modulo_orden,10)||0); });
  if (!modulos.length) return { ok:true, exento:false, rol:rol, modulos:[], progreso_pct:0, mensaje:'Curso no disponible — pide al admin que cargue el contenido.' };
  // Mi progreso
  var shP = asegurarHoja('ProgresoCursos', PROGRESO_COLS);
  var miProgreso = rowsToObjects(shP).filter(function(p){ return p.user_id === u.id; });
  var mapaP = {};
  // Robusto contra duplicados (race conditions de Apps Script): si hay 2+ filas para
  // el mismo modulo_id, prefiere SIEMPRE la que tenga completado_at lleno sobre la vacía.
  miProgreso.forEach(function(p){
    var existente = mapaP[p.modulo_id];
    if (!existente) { mapaP[p.modulo_id] = p; return; }
    // Si la existente NO está completada y la nueva SÍ → cambiar
    if (!existente.completado_at && p.completado_at) { mapaP[p.modulo_id] = p; return; }
    // Si ambas están completadas o ambas no, conservar la primera (orden de aparición)
  });
  // Construir respuesta
  var completados = 0;
  var siguienteIdx = -1;
  var modulosOut = modulos.map(function(m, idx){
    var pr = mapaP[m.id] || null;
    var completado = !!(pr && pr.completado_at);
    if (completado) completados++;
    if (siguienteIdx === -1 && !completado) siguienteIdx = idx;
    var anteriorCompletado = idx === 0 || (mapaP[modulos[idx-1].id] && mapaP[modulos[idx-1].id].completado_at);
    var desbloqueado = idx === 0 || anteriorCompletado;
    return {
      id: m.id,
      orden: parseInt(m.modulo_orden,10) || 0,
      titulo: m.modulo_titulo,
      resumen: m.modulo_resumen,
      tiempo_estimado: parseInt(m.tiempo_estimado_min,10) || 5,
      tiene_quiz: esActivo(m.tiene_quiz),
      quiz_total: m.quiz_preguntas_json ? (function(){ try { return (JSON.parse(m.quiz_preguntas_json)||[]).length; } catch(e){ return 0; } })() : 0,
      quiz_min_aprobatorio: parseInt(m.quiz_min_aprobatorio,10) || 0,
      completado: completado,
      desbloqueado: desbloqueado,
      score_quiz: pr ? (parseInt(pr.score_quiz,10) || 0) : null,
      total_quiz: pr ? (parseInt(pr.total_quiz,10) || 0) : null,
      intentos_quiz: pr ? (parseInt(pr.intentos_quiz,10) || 0) : 0,
      iniciado_at: pr ? String(pr.iniciado_at||'') : '',
      completado_at: pr ? String(pr.completado_at||'') : ''
    };
  });
  return {
    ok: true,
    rol: rol,
    exento: false,
    modulos: modulosOut,
    completados: completados,
    total: modulosOut.length,
    progreso_pct: modulosOut.length ? Math.round((completados / modulosOut.length) * 100) : 0,
    siguiente_idx: siguienteIdx
  };
}

// Devuelve el contenido completo de UN módulo (incluye preguntas del quiz SIN la correcta).
function handleCursoModuloGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var modulo_id = String(p.modulo_id || '');
  if (!modulo_id) return { ok:false, error:'modulo_id requerido' };
  var sh = asegurarHoja('Cursos', CURSOS_COLS);
  var m = rowsToObjects(sh).find(function(x){ return x.id === modulo_id; });
  if (!m) return { ok:false, error:'Módulo no encontrado' };
  if (String(m.rol||'').toLowerCase() !== String(u.rol||'').toLowerCase()) return { ok:false, error:'Este módulo no es de tu rol' };
  // Verificar desbloqueo (módulos anteriores deben estar completados)
  var modulos = rowsToObjects(sh).filter(function(x){
    return String(x.rol||'').toLowerCase() === String(u.rol||'').toLowerCase() && esActivo(x.activa);
  });
  modulos.sort(function(a,b){ return (parseInt(a.modulo_orden,10)||0) - (parseInt(b.modulo_orden,10)||0); });
  var miOrden = parseInt(m.modulo_orden,10) || 0;
  var shP = asegurarHoja('ProgresoCursos', PROGRESO_COLS);
  var prev = modulos.filter(function(x){ return (parseInt(x.modulo_orden,10)||0) < miOrden; });
  var miProgreso = rowsToObjects(shP).filter(function(pr){ return pr.user_id === u.id; });
  var mapaP = {};
  // Robusto contra duplicados: prefiere fila completada sobre vacía
  miProgreso.forEach(function(pr){
    var existente = mapaP[pr.modulo_id];
    if (!existente) { mapaP[pr.modulo_id] = pr; return; }
    if (!existente.completado_at && pr.completado_at) { mapaP[pr.modulo_id] = pr; return; }
  });
  var todosPrevCompletos = prev.every(function(x){ return mapaP[x.id] && mapaP[x.id].completado_at; });
  if (!todosPrevCompletos) return { ok:false, error:'Debes completar los módulos anteriores primero' };
  // Registrar inicio si no existe
  var miPr = mapaP[m.id];
  if (!miPr) {
    var newId = uuid();
    shP.appendRow([newId, u.id, u.email, String(u.rol||'').toLowerCase(), m.id, miOrden, new Date(), '', 0, 0, 0, 0]);
  }
  // Preguntas del quiz SIN la correcta (anti-trampa)
  var preguntas = [];
  if (esActivo(m.tiene_quiz) && m.quiz_preguntas_json) {
    try {
      var raw = JSON.parse(m.quiz_preguntas_json);
      preguntas = (raw || []).map(function(q){
        return { id: q.id, pregunta: q.pregunta, a: q.a, b: q.b, c: q.c, d: q.d };
      });
    } catch(e){}
  }
  return {
    ok: true,
    modulo: {
      id: m.id,
      orden: miOrden,
      titulo: m.modulo_titulo,
      resumen: m.modulo_resumen,
      contenido_md: m.contenido_md || '',
      tiempo_estimado: parseInt(m.tiempo_estimado_min,10) || 5,
      tiene_quiz: esActivo(m.tiene_quiz),
      preguntas: preguntas,
      quiz_min_aprobatorio: parseInt(m.quiz_min_aprobatorio,10) || 0
    }
  };
}

// Recibe respuestas del quiz, califica, marca módulo completado si aprueba.
// Si NO aprueba, registra intento pero NO completa (debe reintentar).
// Si el módulo no tiene quiz, simplemente marca como completado al confirmar lectura.
function handleCursoModuloCompletar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var modulo_id = String(p.modulo_id || '');
  if (!modulo_id) return { ok:false, error:'modulo_id requerido' };
  var sh = asegurarHoja('Cursos', CURSOS_COLS);
  var m = rowsToObjects(sh).find(function(x){ return x.id === modulo_id; });
  if (!m) return { ok:false, error:'Módulo no encontrado' };
  if (String(m.rol||'').toLowerCase() !== String(u.rol||'').toLowerCase()) return { ok:false, error:'Este módulo no es de tu rol' };
  var shP = asegurarHoja('ProgresoCursos', PROGRESO_COLS);
  // Robusto contra duplicados: si hay 2+ filas para (user, modulo), prefiere la
  // que tenga completado_at (no perder progreso) o la primera disponible.
  var todasMisFilas = rowsToObjects(shP).filter(function(pr){ return pr.user_id === u.id && pr.modulo_id === modulo_id; });
  var miPr = todasMisFilas.find(function(pr){ return pr.completado_at; }) || todasMisFilas[0];
  // Si no hay registro previo, crearlo (caso raro: completar sin haber abierto el módulo)
  if (!miPr) {
    var newId = uuid();
    shP.appendRow([newId, u.id, u.email, String(u.rol||'').toLowerCase(), m.id, parseInt(m.modulo_orden,10)||0, new Date(), '', 0, 0, 0, 0]);
    var nuevasFilas = rowsToObjects(shP).filter(function(pr){ return pr.user_id === u.id && pr.modulo_id === modulo_id; });
    miPr = nuevasFilas[nuevasFilas.length - 1]; // la recién creada
  }
  var ahora = new Date();
  var aprobado = true;
  var score = 0, total = 0;
  var detalle = [], preguntas = [];
  if (esActivo(m.tiene_quiz)) {
    // Calificar el quiz
    var respuestas; try { respuestas = JSON.parse(p.respuestas || '{}'); } catch(e){ return { ok:false, error:'respuestas inválidas' }; }
    try { preguntas = JSON.parse(m.quiz_preguntas_json || '[]'); } catch(e){}
    total = preguntas.length;
    preguntas.forEach(function(q){
      var marcada = String(respuestas[q.id] || '').trim().toLowerCase();
      var correcta = String(q.correcta || '').trim().toLowerCase();
      var ok = marcada === correcta && marcada !== '';
      if (ok) score++;
      detalle.push({ id: q.id, marcada: marcada, correcta: correcta, ok: ok });
    });
    var min = parseInt(m.quiz_min_aprobatorio,10) || 0;
    aprobado = score >= min;
  }
  // Update progreso row
  var row = miPr._row;
  var shPP = asegurarHoja('ProgresoCursos', PROGRESO_COLS);
  // Cols: id(1), user_id(2), user_email(3), rol(4), modulo_id(5), modulo_orden(6), iniciado_at(7), completado_at(8), score_quiz(9), total_quiz(10), intentos_quiz(11), tiempo_real_min(12)
  shPP.getRange(row, 11).setValue((parseInt(miPr.intentos_quiz,10) || 0) + 1);
  if (esActivo(m.tiene_quiz)) {
    shPP.getRange(row, 9).setValue(score);
    shPP.getRange(row, 10).setValue(total);
  }
  if (aprobado) {
    shPP.getRange(row, 8).setValue(ahora);
    // Calcular tiempo real (minutos desde iniciado_at)
    if (miPr.iniciado_at) {
      var inicio = new Date(miPr.iniciado_at);
      var min = Math.max(1, Math.round((ahora.getTime() - inicio.getTime()) / 60000));
      shPP.getRange(row, 12).setValue(min);
    }
  }
  // Enriquecer detalle con texto de opciones para feedback en UI
  var detalleConTexto = detalle.map(function(d){
    var q = preguntas.find(function(x){ return x.id === d.id; }) || {};
    return {
      id: d.id,
      pregunta: q.pregunta || '',
      marcada: d.marcada,
      correcta: d.correcta,
      ok: d.ok,
      texto_marcada: q[d.marcada] || '',
      texto_correcta: q[d.correcta] || '',
      explicacion: q.explicacion || ''
    };
  });
  return {
    ok: true,
    aprobado: aprobado,
    score: score,
    total: total,
    min_aprobatorio: parseInt(m.quiz_min_aprobatorio,10) || 0,
    intentos: (parseInt(miPr.intentos_quiz,10) || 0) + 1,
    completado_at: aprobado ? ahora.toISOString().slice(0,10) : '',
    detalle: detalleConTexto
  };
}

// Admin fuerza la compleción de un módulo específico para cualquier usuario de su empresa.
function handleCursoModuloDesbloquear(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo admin puede destrabar módulos' };
  var user_id = String(p.user_id || '').trim();
  var modulo_id = String(p.modulo_id || '').trim();
  if (!user_id || !modulo_id) return { ok:false, error:'user_id y modulo_id requeridos' };
  var shC = asegurarHoja('Cursos', CURSOS_COLS);
  var m = rowsToObjects(shC).find(function(x){ return x.id === modulo_id; });
  if (!m) return { ok:false, error:'Módulo no encontrado' };
  // Verificar que el usuario pertenece a la misma empresa
  var targetUser = rowsToObjects(getSheet('Usuarios')).find(function(usr){ return usr.id === user_id && usr.empresa_id === u.empresa_id; });
  if (!targetUser) return { ok:false, error:'Usuario no encontrado en esta empresa' };
  var shP = asegurarHoja('ProgresoCursos', PROGRESO_COLS);
  var todasFilas = rowsToObjects(shP).filter(function(pr){ return pr.user_id === user_id && pr.modulo_id === modulo_id; });
  var miPr = todasFilas.find(function(pr){ return pr.completado_at; }) || todasFilas[0];
  var ahora = new Date();
  if (miPr) {
    shP.getRange(miPr._row, 8).setValue(ahora);
  } else {
    shP.appendRow([uuid(), user_id, targetUser.email || '', String(m.rol||'').toLowerCase(), m.id, parseInt(m.modulo_orden,10)||0, ahora, ahora, 0, 0, 0, 0]);
  }
  return { ok:true, mensaje:'Módulo desbloqueado correctamente para ' + (targetUser.nombre || targetUser.email) + '.' };
}

// Admin/gerentes ven el progreso del equipo
function handleProgresoEquipo(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo','gerente_restaurante','auditoria'])) return { ok:false, error:'Sin permisos' };
  var users = rowsToObjects(getSheet('Usuarios')).filter(function(usr){
    return usr.empresa_id === u.empresa_id && esActivo(usr.activo);
  });
  var shC = asegurarHoja('Cursos', CURSOS_COLS);
  var shP = asegurarHoja('ProgresoCursos', PROGRESO_COLS);
  var todosCursos = rowsToObjects(shC).filter(function(c){ return esActivo(c.activa); });
  var todosProgresos = rowsToObjects(shP);
  var resumen = users.map(function(usr){
    var rol = String(usr.rol||'').toLowerCase();
    if (ROLES_EXENTOS_CERTIFICACION.indexOf(rol) !== -1) {
      return { user_id: usr.id, email: usr.email, nombre: usr.nombre, rol: rol, exento: true, completados:0, total:0, pct:100 };
    }
    var modulosRol = todosCursos.filter(function(c){ return String(c.rol||'').toLowerCase() === rol; });
    var miProg = todosProgresos.filter(function(pr){ return pr.user_id === usr.id; });
    var completados = miProg.filter(function(pr){ return !!pr.completado_at; }).length;
    var total = modulosRol.length;
    var mapaP2 = {};
    miProg.forEach(function(pr){ if (pr.completado_at) mapaP2[pr.modulo_id] = true; });
    var modulosDetalle = modulosRol.map(function(mod){
      return { id: mod.id, orden: parseInt(mod.modulo_orden,10)||0, titulo: mod.modulo_titulo||'', completado: !!mapaP2[mod.id] };
    }).sort(function(a,b){ return a.orden - b.orden; });
    return {
      user_id: usr.id, email: usr.email, nombre: usr.nombre, rol: rol, exento: false,
      completados: completados, total: total,
      pct: total ? Math.round((completados/total)*100) : 0,
      modulos: modulosDetalle
    };
  });
  return { ok:true, equipo: resumen };
}

// =============== Conciliaciones ===============
// Lista las conciliaciones de un rango de fechas con KPIs precalculados.
// Útil para el panel de "Histórico de conciliaciones".
function handleConciliacionesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria','cajera'])) return { ok:false, error:'Sin permisos' };
  var desde = String(p.fecha_desde || '').trim();
  var hasta = String(p.fecha_hasta || '').trim();
  var sucursal_id = p.sucursal_id || '';
  var conciliaciones = rowsToObjects(getSheet('Conciliaciones')).filter(function(c){
    if (c.empresa_id !== u.empresa_id) return false;
    if (sucursal_id && c.sucursal_id !== sucursal_id) return false;
    var f = fechaToString(c.fecha);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });
  // Ordenar por fecha descendente (más reciente arriba)
  conciliaciones.sort(function(a,b){ return String(fechaToString(b.fecha)).localeCompare(String(fechaToString(a.fecha))); });

  var resultado = conciliaciones.map(function(c){
    var payload = {}; try { payload = JSON.parse(c.payload_json || '{}'); } catch(e){}
    // KPIs reales desde _banderasDeConciliacion (fuente única, alineada con el Resumen del día).
    // Antes usaba calcularKpisConciliacion, que leía campos inexistentes → siempre 0 (bug Histórico).
    var bc = _banderasDeConciliacion(payload);
    var k = bc.kpis || {};
    return {
      id: c.id,
      sucursal_id: c.sucursal_id || '',
      fecha: fechaToString(c.fecha),
      estado: c.estado,
      cerrada_at: c.cerrada_at instanceof Date ? c.cerrada_at.toISOString() : (c.cerrada_at || ''),
      kpis: {
        total_comensales: k.total_comensales || 0,
        total_venta: k.total_venta || 0,
        total_cortesias: k.total_cortesias || 0,
        total_canceladas: k.total_canceladas || 0,
        diferencia_caja: k.diferencia_caja || 0,
        servicios: bc.servicio || '—'
      }
    };
  });
  return { ok:true, conciliaciones: resultado };
}

// Extrae KPIs útiles del payload de la conciliación. Tolerante a estructuras parciales.
function calcularKpisConciliacion(payload) {
  payload = payload || {};
  // Intentar leer Mix POS (apertura + cierre)
  var totalComensales = 0, totalVenta = 0, totalCortesias = 0, totalCanceladas = 0;
  var ap = payload.apertura || {};
  var ci = payload.cierre || {};
  ['ap_mix_pos_adulto','ap_mix_pos_nino','ap_mix_pos_3era','ci_mix_pos_adulto','ci_mix_pos_nino','ci_mix_pos_3era'].forEach(function(k){
    totalComensales += parseFloat(payload[k]) || 0;
  });
  // Si hay venta total registrada
  ['ap_venta_total','ci_venta_total','venta_total'].forEach(function(k){
    if (payload[k]) totalVenta += parseFloat(payload[k]) || 0;
  });
  // Cortesías y cancelaciones
  if (Array.isArray(payload.cortesias)) totalCortesias = payload.cortesias.length;
  if (Array.isArray(payload.cancelaciones)) totalCanceladas = payload.cancelaciones.length;
  // Diferencia de caja (arqueo)
  var diferenciaCaja = parseFloat(payload.ci_diferencia_caja || payload.diferencia_caja || 0);
  // Servicios involucrados (Desayuno/Comida según existan datos)
  var servicios = [];
  if (payload.ap_mix_pos_adulto || payload.ap_venta_total) servicios.push('Apertura');
  if (payload.ci_mix_pos_adulto || payload.ci_venta_total) servicios.push('Cierre');
  return {
    total_comensales: totalComensales,
    total_venta: totalVenta,
    total_cortesias: totalCortesias,
    total_canceladas: totalCanceladas,
    diferencia_caja: diferenciaCaja,
    servicios: servicios.join(' + ') || '—'
  };
}

// =============== Tablero Directivo (Gerente de Plaza · Mónica) ===============
// Agrega las cancelaciones documentadas en las conciliaciones (sección 07 · ci_cancelaciones)
// para la VIGILANCIA del gerente de plaza. Solo lectura — NO en MUTATING_ACTIONS.
//   - "Solicitadas" = cancelaciones documentadas por Luis en la conciliación (cada fila real).
//   - "Autorizadas" = las que llevan sello (campo autoriza con valor).
//   - "Roja" = baja el monto cobrado (Δ<0) Y se pagó en efectivo (patrón de fuga).
// Cuando llegue la Capa 3 (importar cancelaciones del SR12), "solicitadas" se tomará del POS
// para que sea independiente de lo que Luis transcribe.
function handleDireccionCancelaciones(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_plaza','auditoria'])) return { ok:false, error:'Sin permisos' };

  var desde = String(p.fecha_desde || '').trim();
  var hasta = String(p.fecha_hasta || '').trim();

  var conc = rowsToObjects(getSheet('Conciliaciones')).filter(function(c){
    if (c.empresa_id !== u.empresa_id) return false;
    var f = fechaToString(c.fecha);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });

  function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function cancReal(x){ return !!((x.folio||'').toString().trim() || (x.prod_orig||'').toString().trim() || num(x.monto_orig) > 0); }

  var resumen = { solicitadas:0, autorizadas:0, rojas:0, rojas_sin_aut:0, total_baja:0, por_cajera:{}, dias:0, cuestionamientos_pendientes:0 };
  var diasSet = {};
  var detalle = [];

  // Hilos de "cuestionamiento" agrupados por cancel_id (vigilancia: Gerente de Plaza ↔ administración).
  var hilosPorCancel = {};
  (function(){
    var shQ = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CancelacionesCuestionamientos');
    if (!shQ) return;
    rowsToObjects(shQ).forEach(function(q){
      if (q.empresa_id !== u.empresa_id) return;
      var k = String(q.cancel_id||'');
      if (!hilosPorCancel[k]) hilosPorCancel[k] = [];
      hilosPorCancel[k].push({
        id: q.id, pregunta: q.pregunta, preguntado_por: q.preguntado_por, preguntado_at: String(q.preguntado_at||''),
        respuesta: q.respuesta||'', respondido_por: q.respondido_por||'', respondido_at: String(q.respondido_at||''),
        estado: q.estado||'pendiente'
      });
      if ((q.estado||'pendiente') === 'pendiente') resumen.cuestionamientos_pendientes++;
    });
  })();

  conc.forEach(function(c){
    var payload = {}; try { payload = JSON.parse(c.payload_json || '{}'); } catch(e){ return; }
    var fecha = fechaToString(c.fecha);
    var arr = Array.isArray(payload.ci_cancelaciones) ? payload.ci_cancelaciones : [];
    arr.forEach(function(x){
      if (!cancReal(x)) return;
      var montoOrig = num(x.monto_orig), montoNuevo = num(x.monto_nuevo);
      var delta = montoNuevo - montoOrig;
      var autorizada = !!(x.autoriza && String(x.autoriza).trim());
      var roja = montoOrig > 0 && delta < 0 && x.forma_pago === 'Efectivo';
      resumen.solicitadas++;
      if (autorizada) resumen.autorizadas++;
      if (roja) { resumen.rojas++; if (!autorizada) resumen.rojas_sin_aut++; }
      if (delta < 0) resumen.total_baja += -delta;
      var caj = (x.cajera||'').toString().trim() || '(sin cajera)';
      resumen.por_cajera[caj] = (resumen.por_cajera[caj]||0) + 1;
      diasSet[fecha] = true;
      // cancel_id estable: el id de la fila si existe (v278+), si no un compuesto determinista.
      var cancelId = (x.id && String(x.id).trim()) ? String(x.id)
        : (fecha + '|' + String(x.folio||'') + '|' + String(x.prod_orig||'') + '|' + montoOrig);
      detalle.push({
        cancel_id: cancelId,
        fecha: fecha,
        folio: String(x.folio||''),
        hora: String(x.hora||''),
        cajera: String(x.cajera||''),
        prod_orig: String(x.prod_orig||''),
        monto_orig: montoOrig,
        prod_nuevo: String(x.prod_nuevo||''),
        monto_nuevo: montoNuevo,
        delta: delta,
        forma_pago: String(x.forma_pago||''),
        motivo: String(x.motivo||''),
        autoriza: String(x.autoriza||''),
        autoriza_at: String(x.autoriza_at||''),
        roja: roja,
        autorizada: autorizada,
        cuestionamientos: hilosPorCancel[cancelId] || []
      });
    });
  });
  resumen.dias = Object.keys(diasSet).length;

  // Orden: más reciente primero; dentro del día, las rojas-sin-autorizar arriba.
  detalle.sort(function(a,b){
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
    var sa = (a.roja && !a.autorizada) ? 0 : 1, sb = (b.roja && !b.autorizada) ? 0 : 1;
    return sa - sb;
  });

  return { ok:true, resumen: resumen, detalle: detalle, fecha_desde: desde, fecha_hasta: hasta };
}

// =====================================================================================
// ★ BANDERAS DEL CIERRE — sube al Tablero Directivo las 15 banderas de cada conciliación ★
// =====================================================================================
// La conciliación profunda calcula 15 banderas rojas EN PANTALLA (renderFlags en
// conciliacion.html), pero solo viven dentro de cada cierre del día. Aquí las RECALCULAMOS
// en el backend desde el `payload_json` guardado (mismas fórmulas, portadas 1:1) para que
// dirección vea la matriz día × bandera de TODAS las conciliaciones. Solo lectura.
// IMPORTANTE: si se cambia un umbral o una fórmula en conciliacion.html, hay que reflejarlo aquí.
function _bcNum(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function _bcTrim(v){ return String(v == null ? '' : v).trim(); }
function _bcMon(n){
  var x = Math.round(_bcNum(n)); var neg = x < 0; x = Math.abs(x);
  var s = String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-$' : '$') + s;
}
var BANDERAS_CIERRE_DEF = [
  { key:'comensales', abbr:'Comen.',   title:'Δ Comensales (Host vs POS) > 2' },
  { key:'arqueo',     abbr:'Arqueo',   title:'Δ Arqueo ciego > $200' },
  { key:'terminal',   abbr:'Termin.',  title:'Δ Cierre de lote terminal vs POS' },
  { key:'pct_canc',   abbr:'%Canc',    title:'% Cancelaciones > 3% de cobros' },
  { key:'nosales',    abbr:'No-sale',  title:'No-sales (cajón sin venta) > 2 en el día' },
  { key:'cort_sinaut',abbr:'Cort.s/a', title:'Cortesías registradas sin autorización documentada' },
  { key:'cort_docum', abbr:'Cort.doc', title:'Cortesías declaradas ≠ documentadas (faltan folio/nombre/importe)' },
  { key:'canc_sinaut',abbr:'Canc.s/a', title:'Cancelaciones registradas sin autorización documentada' },
  { key:'fuga',       abbr:'Fuga',     title:'Cancelación con baja en EFECTIVO sin autorización del Gerente Admin (patrón de fuga)' },
  { key:'prop_serv',  abbr:'Prop.sv',  title:'% Propinas con tarjeta fuera de rango 8–20% (por servicio)' },
  { key:'prop_dia',   abbr:'Prop.día', title:'% Propina tarjeta del día fuera de rango 3–15% sobre cobros' },
  { key:'retiro',     abbr:'Retiro',   title:'Δ Retiro de efectivo vs Propina tarjeta del servicio > $10' },
  { key:'lote',       abbr:'Lote',     title:'Cierre de lote bancario no realizado' },
  { key:'vouchers',   abbr:'Vouch.',   title:'Δ Operaciones del lote vs Vouchers (por terminal)' },
  { key:'folios',     abbr:'Folios',   title:'Saltos en folios consecutivos' }
];

// Recalcula las 15 banderas desde el payload de UNA conciliación. Devuelve sev por bandera:
// 'rojo' (encendida), 'ok' (evaluada, sin problema), 'na' (sin datos para evaluarla).
function _banderasDeConciliacion(payload) {
  var P = payload || {};
  function n(k){ return _bcNum(P[k]); }

  function mix(prefix){
    var keys = ['adulto','nino','3era','promo','corte']; var h = 0, p = 0;
    keys.forEach(function(k){ h += _bcNum(P[prefix+'_mix_'+k+'_host']); p += _bcNum(P[prefix+'_mix_'+k+'_pos']); });
    return { host:h, pos:p, delta:h-p };
  }
  var apMix = mix('ap'), ciMix = mix('ci');

  function ppct(prefix){ var pt = _bcNum(P[prefix+'_propina_tar']), ct = _bcNum(P[prefix+'_cobro_tarjeta']); return ct > 0 ? pt/ct*100 : 0; }
  var apPct = ppct('ap'), ciPct = ppct('ci');

  function com(prefix){ var propTar = _bcNum(P[prefix+'_propina_tar']), retiro = _bcNum(P[prefix+'_retiro_propinas']); return { propTar:propTar, retiro:retiro, deltaRetiro:retiro-propTar }; }
  var apCom = com('ap'), ciCom = com('ci');

  // Arqueo del cajón
  var DENOMS = [1000,500,200,100,50,20,10,5,2,1]; var sumDenoms = 0;
  DENOMS.forEach(function(d){ sumDenoms += _bcNum(P['ci_corte_d'+d+'_cant']) * d; });
  var efeFinal = _bcNum(P.ci_corte_retiros) + sumDenoms + _bcNum(P.ci_corte_comision);
  var dep1 = _bcNum(P.ci_dep1_monto), dep2 = _bcNum(P.ci_dep2_monto);
  var teorico = _bcNum(P.ci_corte_fondo) + _bcNum(P.ap_cobro_efectivo) + _bcNum(P.ci_cobro_efectivo)
              - _bcNum(P.ap_retiro_propinas) - _bcNum(P.ci_retiro_propinas) - dep1 - dep2;
  var arqDelta = efeFinal - teorico;

  // Terminales (con migración del schema viejo de campo único)
  var terms = Array.isArray(P.ci_terminales) ? P.ci_terminales : [];
  if (!terms.length) {
    var hadOld = P.ci_term_lote || P.ci_term_ops || P.ci_term_hora || P.ci_term_vouch_fis || P.ci_term_vouch_dig || P.ci_term_banco;
    if (hadOld) terms = [{ banco:P.ci_term_banco||'', lote:P.ci_term_lote||'', ops:P.ci_term_ops||'', hora:P.ci_term_hora||'', vfis:P.ci_term_vouch_fis||'', vdig:P.ci_term_vouch_dig||'' }];
  }
  var sumLote = 0, probCierre = 0, probOps = 0;
  terms.forEach(function(t){
    var lote = _bcNum(t.lote), ops = _bcNum(t.ops), vouch = _bcNum(t.vfis) + _bcNum(t.vdig), hora = _bcTrim(t.hora);
    sumLote += lote;
    if (lote > 0 && !hora) probCierre++;
    if ((ops > 0 || vouch > 0) && Math.abs(ops - vouch) > 0) probOps++;
  });
  var termDelta = sumLote - _bcNum(P.ci_term_pos);

  // Folios
  var fd = _bcNum(P.ci_folio_desde), fh = _bcNum(P.ci_folio_hasta), fe = _bcNum(P.ci_folio_emitidos);
  var fDelta = (fh > 0 || fd > 0) ? (fh - fd + 1) - fe : 0;

  // Totales del día
  var cobrosDia = _bcNum(P.ap_cobro_efectivo) + _bcNum(P.ap_cobro_tarjeta) + _bcNum(P.ap_cobro_transfer)
                + _bcNum(P.ci_cobro_efectivo) + _bcNum(P.ci_cobro_tarjeta) + _bcNum(P.ci_cobro_transfer);
  var cancMontoDia = _bcNum(P.ap_canc_monto) + _bcNum(P.ci_canc_monto);
  var pctCanc = cobrosDia > 0 ? (cancMontoDia / cobrosDia * 100) : 0;
  var nosalesDia = _bcNum(P.ap_nosales) + _bcNum(P.ci_nosales);
  var propTarDia = _bcNum(P.ap_propina_tar) + _bcNum(P.ci_propina_tar);
  var pctPropTotal = cobrosDia > 0 ? (propTarDia / cobrosDia * 100) : 0;

  // Cancelaciones (§07)
  var cancs = Array.isArray(P.ci_cancelaciones) ? P.ci_cancelaciones : [];
  var rojas = 0, rojasSinAut = 0;
  cancs.forEach(function(c){
    var real = !!(_bcTrim(c.folio) || _bcTrim(c.prod_orig) || _bcNum(c.monto_orig) > 0);
    if (!real) return;
    var esRoja = _bcNum(c.monto_orig) > 0 && (_bcNum(c.monto_nuevo) - _bcNum(c.monto_orig)) < 0 && c.forma_pago === 'Efectivo';
    if (esRoja) { rojas++; if (!_bcTrim(c.autoriza)) rojasSinAut++; }
  });

  // Cortesías / cancelaciones sin autorización (§04)
  var apCorteNum = _bcNum(P.ap_corte_num), ciCorteNum = _bcNum(P.ci_corte_num);
  var corteSinAut = (apCorteNum > 0 && !_bcTrim(P.ap_corte_autor)) || (ciCorteNum > 0 && !_bcTrim(P.ci_corte_autor));
  var apCancN = _bcNum(P.ap_canc_num), ciCancN = _bcNum(P.ci_canc_num);
  var cancSinAut = (apCancN > 0 && !_bcTrim(P.ap_canc_autor)) || (ciCancN > 0 && !_bcTrim(P.ci_canc_autor));
  // Cortesías declaradas (conteo) vs documentadas (renglones con folio/nombre/importe).
  // Diferencia = cortesía sin papel (posible fuga). cortDocum se reusa abajo para el KPI total_cortesias.
  var _cortsDoc = (Array.isArray(P.ci_cortesias) ? P.ci_cortesias : []).concat(Array.isArray(P.ap_cortesias) ? P.ap_cortesias : []);
  var cortDocum = _cortsDoc.filter(function(c){ return c && (_bcTrim(c.folio) || _bcTrim(c.nombre) || _bcNum(c.importe) > 0); }).length;
  var cortDeclar = apCorteNum + ciCorteNum;

  function sev(fired, hayDato){ return fired ? 'rojo' : (hayDato === false ? 'na' : 'ok'); }

  var B = {};
  B.comensales  = { sev: sev(Math.abs(apMix.delta) > 2 || Math.abs(ciMix.delta) > 2, (apMix.host+apMix.pos+ciMix.host+ciMix.pos) > 0),
                    val: 'Ap '+(apMix.delta>0?'+':'')+apMix.delta+' · Ci '+(ciMix.delta>0?'+':'')+ciMix.delta };
  B.arqueo      = { sev: sev(Math.abs(arqDelta) > 200, !(efeFinal === 0 && teorico === 0)), val: _bcMon(arqDelta) };
  B.terminal    = { sev: sev(Math.abs(termDelta) > 0.5, !(sumLote === 0 && _bcNum(P.ci_term_pos) === 0)), val: _bcMon(termDelta) };
  B.pct_canc    = { sev: sev(pctCanc > 3, cobrosDia > 0), val: pctCanc.toFixed(1)+'%' };
  B.nosales     = { sev: sev(nosalesDia > 2, true), val: String(nosalesDia) };
  B.cort_sinaut = { sev: sev(corteSinAut, true), val: corteSinAut ? 'sin autorizar' : 'ok' };
  B.cort_docum  = { sev: sev(cortDeclar !== cortDocum, (cortDeclar > 0 || cortDocum > 0)), val: cortDeclar + ' decl · ' + cortDocum + ' doc' };
  B.canc_sinaut = { sev: sev(cancSinAut, true), val: cancSinAut ? 'sin autorizar' : 'ok' };
  B.fuga        = { sev: sev(rojasSinAut > 0, true), val: rojasSinAut > 0 ? (rojasSinAut+' sin sello') : (rojas > 0 ? (rojas+' autorizadas') : '0') };
  B.prop_serv   = { sev: sev((apPct>0 && (apPct<8||apPct>20)) || (ciPct>0 && (ciPct<8||ciPct>20)), (apPct>0 || ciPct>0)),
                    val: 'Ap '+apPct.toFixed(0)+'% · Ci '+ciPct.toFixed(0)+'%' };
  B.prop_dia    = { sev: sev(cobrosDia>0 && (pctPropTotal<3||pctPropTotal>15), cobrosDia > 0), val: pctPropTotal.toFixed(1)+'%' };
  var retFired = (Math.abs(apCom.deltaRetiro)>10 && (apCom.retiro>0||apCom.propTar>0)) || (Math.abs(ciCom.deltaRetiro)>10 && (ciCom.retiro>0||ciCom.propTar>0));
  var retHay = (apCom.retiro>0||apCom.propTar>0||ciCom.retiro>0||ciCom.propTar>0);
  B.retiro      = { sev: sev(retFired, retHay), val: 'Ap '+_bcMon(apCom.deltaRetiro)+' · Ci '+_bcMon(ciCom.deltaRetiro) };
  B.lote        = { sev: sev(probCierre > 0, sumLote > 0), val: probCierre>0 ? (probCierre+' sin cerrar') : 'ok' };
  B.vouchers    = { sev: sev(probOps > 0, terms.length > 0), val: probOps>0 ? (probOps+' con Δ') : 'ok' };
  B.folios      = { sev: sev(Math.abs(fDelta) > 0, (fd>0||fh>0)), val: 'Δ '+fDelta };

  var banderas = BANDERAS_CIERRE_DEF.map(function(d){ var b = B[d.key] || { sev:'na', val:'' }; return { key:d.key, sev:b.sev, val:b.val }; });

  var servSet = {}; [P.ap_servicio, P.ci_servicio].forEach(function(s){ s = _bcTrim(s); if (s) servSet[s] = true; });
  var vacia = (cobrosDia === 0 && efeFinal === 0 && cancs.length === 0 && (apMix.host+apMix.pos+ciMix.host+ciMix.pos) === 0);
  // KPIs reales del día (mismas fórmulas que renderKPIs de conciliacion.html) — fuente única para
  // el Histórico (handleConciliacionesList). Evita la función vieja calcularKpisConciliacion que
  // leía campos inexistentes (ap_mix_pos_adulto / venta_total) y devolvía 0 en todo.
  var totCort = cortDocum; // renglones documentados (calculado arriba; reuso para que KPI == bandera)
  var totCanc = cancs.filter(function(c){ return _bcTrim(c.folio) || _bcTrim(c.prod_orig) || _bcNum(c.monto_orig) > 0; }).length;
  var kpis = {
    total_comensales: apMix.pos + ciMix.pos,
    total_venta: cobrosDia,
    total_cortesias: totCort,
    total_canceladas: totCanc,
    diferencia_caja: arqDelta
  };
  return { banderas: banderas, servicio: Object.keys(servSet).join(' + '), vacia: vacia, kpis: kpis };
}

function handleDireccionBanderasCierre(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_plaza','auditoria'])) return { ok:false, error:'Sin permisos' };

  var desde = String(p.fecha_desde || '').trim();
  var hasta = String(p.fecha_hasta || '').trim();

  var vacio = { conciliaciones:0, total_rojas:0, dias_con_roja:0, sin_cerrar:0 };
  var sh = getSheet('Conciliaciones');
  if (!sh) return { ok:true, banderas_def:BANDERAS_CIERRE_DEF, dias:[], kpis:vacio, resumen_por_bandera:[] };

  var rows = rowsToObjects(sh).filter(function(r){ return r.empresa_id === u.empresa_id; });
  var dias = [];
  rows.forEach(function(r){
    var fecha = String(fechaToString(r.fecha) || r.fecha || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    if (desde && fecha < desde) return;
    if (hasta && fecha > hasta) return;
    var payload = {};
    try { payload = JSON.parse(r.payload_json || '{}'); } catch(e){ payload = {}; }
    var b = _banderasDeConciliacion(payload);
    var rojas = 0;
    b.banderas.forEach(function(x){ if (x.sev === 'rojo') rojas++; });
    dias.push({
      fecha: fecha,
      estado: r.estado || '',
      cerrada: String(r.estado || '').toLowerCase() === 'cerrada',
      servicio: b.servicio,
      vacia: b.vacia,
      rojas: rojas,
      banderas: b.banderas
    });
  });
  dias.sort(function(a,b){ return String(b.fecha).localeCompare(String(a.fecha)); });

  var totalRojas = 0, diasConRoja = 0, sinCerrar = 0;
  var porBandera = {};
  BANDERAS_CIERRE_DEF.forEach(function(d){ porBandera[d.key] = { key:d.key, abbr:d.abbr, title:d.title, rojas:0 }; });
  dias.forEach(function(dia){
    if (dia.rojas > 0) diasConRoja++;
    if (!dia.cerrada) sinCerrar++;
    dia.banderas.forEach(function(x){ if (x.sev === 'rojo') { totalRojas++; if (porBandera[x.key]) porBandera[x.key].rojas++; } });
  });

  return {
    ok:true,
    banderas_def: BANDERAS_CIERRE_DEF,
    dias: dias,
    kpis: { conciliaciones: dias.length, total_rojas: totalRojas, dias_con_roja: diasConRoja, sin_cerrar: sinCerrar },
    resumen_por_bandera: BANDERAS_CIERRE_DEF.map(function(d){ return porBandera[d.key]; })
  };
}

// =====================================================================================
// ★ PORTADA EJECUTIVA — rollup semaforizado de las 6 áreas del Tablero ★ (v324)
// =====================================================================================
// Junta los KPIs de las 6 pestañas en tarjetas con luz 🔴🟡🟢 + lista "requiere tu decisión".
// REUSA los handlers existentes (no duplica lógica) para que los umbrales no se desincronicen.
// Solo lectura. `tab` de cada tarjeta = id de la vista del front (canc/cuadre/sr12/barra/banderas/justif).
var BANDERAS_CRITICAS = ['fuga','cort_sinaut','canc_sinaut'];
function _fmtMonEjec(n){
  var x = Math.round(Number(n) || 0), neg = x < 0; var s = String(Math.abs(x)), out = '';
  while (s.length > 3){ out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
  return '$' + (neg ? '-' : '') + s + out;
}
function _tarjEjecErr(idTab, icono, titulo, e){
  return { key:idTab, tab:idTab, icono:icono, titulo:titulo, sev:'info', valor:'—',
           valor_sub:'no disponible', lineas:['No se pudo calcular', String((e && e.message) || e).slice(0,70)] };
}
// ── Tendencias del Tablero (Fase 2) — comparar el periodo actual contra el periodo
// inmediatamente anterior de la MISMA duración. Todas las métricas son "más alto = peor".
// (Fechas en local YYYY-MM-DD, nunca toISOString — rompe MX tras las 18:00.)
function _ejecParseYmd(s){
  var m = String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); // local
}
function _ejecYmd(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function _periodoAnterior(desde, hasta){
  var d1 = _ejecParseYmd(desde), d2 = _ejecParseYmd(hasta);
  if (!d1 || !d2 || d2 < d1) return null;
  var MS = 86400000;
  var len = Math.round((d2 - d1) / MS) + 1; // días inclusive
  var prevDesde, prevHasta;
  if (len <= 7) {
    // Vista semanal: comparar contra los MISMOS días de la semana pasada (lun–mié vs lun–mié),
    // no contra la ventana pegada anterior (evita comparar lunes contra domingo).
    prevDesde = new Date(d1.getTime() - 7 * MS);
    prevHasta = new Date(prevDesde.getTime() + (len - 1) * MS);
  } else {
    // Periodos largos (mes / 30 días): ventana equivalente inmediatamente anterior.
    prevHasta = new Date(d1.getTime() - MS);
    prevDesde = new Date(prevHasta.getTime() - (len - 1) * MS);
  }
  return { desde: _ejecYmd(prevDesde), hasta: _ejecYmd(prevHasta), len: len };
}
// fuga $ = cancelaciones rojas, sin autorizar y con delta negativo (lo mismo que la tarjeta).
function _fugaSinAutorizar(c){
  var f = 0;
  ((c && c.detalle) || []).forEach(function(d){ if (d.roja && !d.autorizada && d.delta < 0) f += -d.delta; });
  return f;
}
// Construye el objeto de tendencia para una métrica donde "más alto = peor".
// dir: 'up' (subió, peor) | 'down' (bajó, mejor) | 'flat'. Devuelve null si no hay base.
function _tendPeor(actual, anterior, etiqueta){
  if (anterior == null || actual == null) return null;
  var a = Number(actual) || 0, b = Number(anterior) || 0;
  if (a === 0 && b === 0) return null; // sin señal en ningún periodo → no pintar flecha
  var dir = a > b ? 'up' : (a < b ? 'down' : 'flat');
  return { dir: dir, peor: (dir === 'up'), actual: a, anterior: b, etiqueta: etiqueta || 'vs. periodo anterior' };
}

function handleDireccionResumen(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_plaza','auditoria'])) return { ok:false, error:'Sin permisos' };

  var desde = String(p.fecha_desde || '').trim();
  var hasta = String(p.fecha_hasta || '').trim();
  var pp = { token: p.token, fecha_desde: desde, fecha_hasta: hasta };

  // Periodo anterior (misma duración) para las flechas de tendencia. null si el periodo es "todo".
  var prev = _periodoAnterior(desde, hasta);
  var ppPrev = prev ? { token: p.token, fecha_desde: prev.desde, fecha_hasta: prev.hasta } : null;
  var etiqTend = (prev && prev.len <= 7) ? 'vs. semana pasada' : 'vs. periodo anterior';
  var curScal = {}, ccData = null; // escalares del periodo actual, por key de tarjeta

  var tarjetas = [], decisiones = [], focos = 0, dinero = 0;
  function rank(s){ return s === 'rojo' ? 3 : (s === 'amarillo' ? 2 : (s === 'verde' ? 1 : 0)); }

  // 1) CANCELACIONES
  try {
    var c = handleDireccionCancelaciones(pp);
    if (c.ok){
      var r = c.resumen || {};
      var fuga = _fugaSinAutorizar(c);
      curScal.canc = fuga;
      var sev = r.rojas_sin_aut > 0 ? 'rojo' : ((r.rojas > 0 || r.total_baja > 0) ? 'amarillo' : 'verde');
      if (sev === 'rojo'){ focos++; dinero += fuga; decisiones.push({ tab:'canc', sev:'rojo', texto: r.rojas_sin_aut + ' cancelación(es) en efectivo SIN autorizar — ' + _fmtMonEjec(fuga) }); }
      tarjetas.push({
        key:'canc', tab:'canc', icono:'🧾', titulo:'Cancelaciones', sev:sev,
        valor: r.rojas_sin_aut > 0 ? _fmtMonEjec(fuga) : String(r.solicitadas || 0),
        valor_sub: r.rojas_sin_aut > 0 ? 'fuga sin autorizar' : 'cancelaciones del periodo',
        lineas: [
          (r.solicitadas || 0) + ' solicitadas · ' + (r.autorizadas || 0) + ' autorizadas',
          (r.rojas_sin_aut > 0 ? (r.rojas_sin_aut + ' rojas sin autorizar') : (r.rojas > 0 ? (r.rojas + ' rojas (ya autorizadas)') : 'sin patrón de fuga'))
        ]
      });
    }
  } catch(e){ tarjetas.push(_tarjEjecErr('canc','🧾','Cancelaciones', e)); }

  // 2) CUADRE DE CARNE (cadencia semanal — miramos la última semana cerrada)
  try {
    var cc = handleDireccionCuadreCarne({ token:p.token, n_semanas:8 });
    if (cc.ok){
      ccData = cc;
      var sevC = 'verde', arriba = [];
      if (cc.cortes && cc.cortes.length && cc.semanas && cc.semanas.length){
        cc.cortes.forEach(function(corte){
          var ult = corte.celdas[corte.celdas.length - 1];
          if (ult && ult.sev === 'rojo'){ if (rank('rojo') > rank(sevC)) sevC = 'rojo'; arriba.push(corte.nombre); }
          else if (ult && ult.sev === 'amarillo'){ if (rank('amarillo') > rank(sevC)) sevC = 'amarillo'; }
        });
      } else { sevC = 'info'; }
      if (sevC === 'rojo'){ focos++; decisiones.push({ tab:'cuadre', sev:'rojo', texto: 'Consumo de carne disparado: ' + arriba.slice(0,3).join(', ') }); }
      var ultSem = (cc.semanas && cc.semanas.length) ? cc.semanas[cc.semanas.length - 1].etiqueta : '';
      tarjetas.push({
        key:'cuadre', tab:'cuadre', icono:'🥩', titulo:'Consumo de carne', sev:sevC,
        valor: sevC === 'info' ? '—' : (arriba.length > 0 ? (arriba.length + ' corte' + (arriba.length > 1 ? 's' : '')) : 'Normal'),
        valor_sub: sevC === 'info' ? 'sin datos de inventario' : (arriba.length > 0 ? 'arriba de su normal' : 'vs. semana típica'),
        lineas: [ (ultSem ? ('última semana: ' + ultSem) : 'sin semanas capturadas'), (arriba.length ? ('Revisar: ' + arriba.slice(0,3).join(', ')) : 'kg/comensal dentro de rango') ]
      });
    }
  } catch(e){ tarjetas.push(_tarjEjecErr('cuadre','🥩','Consumo de carne', e)); }

  // 3) SR12 VS DOCUMENTADO
  try {
    var sd = handleDireccionCancelacionesSr12(pp);
    if (sd.ok){
      var rs = sd.resumen || {};
      curScal.sr12 = rs.caras_sin_documentar || 0;
      var sevS = rs.caras_sin_documentar > 0 ? 'rojo' : (rs.sin_documentar > 0 ? 'amarillo' : (rs.total > 0 ? 'verde' : 'info'));
      if (sevS === 'rojo'){ focos++; decisiones.push({ tab:'sr12', sev:'rojo', texto: rs.caras_sin_documentar + ' cancelación(es) caras del POS sin documentar' }); }
      tarjetas.push({
        key:'sr12', tab:'sr12', icono:'🚫', titulo:'Canc. POS sin documentar', sev:sevS,
        valor: sevS === 'info' ? '—' : String(rs.caras_sin_documentar || 0),
        valor_sub: sevS === 'info' ? 'sin importar SR12' : 'caras sin papel',
        lineas: [ (rs.total || 0) + ' del POS · ' + (rs.documentadas || 0) + ' documentadas', (rs.sin_documentar || 0) + ' sin documentar (' + (rs.caras_sin_documentar || 0) + ' caras)' ]
      });
    }
  } catch(e){ tarjetas.push(_tarjEjecErr('sr12','🚫','Canc. POS sin documentar', e)); }

  // 4) BANDERAS DEL CIERRE
  try {
    var bc = handleDireccionBanderasCierre(pp);
    if (bc.ok){
      var k = bc.kpis || {};
      curScal.banderas = k.total_rojas || 0;
      var critSet = {}, critN = 0;
      (bc.dias || []).forEach(function(dia){ (dia.banderas || []).forEach(function(x){ if (x.sev === 'rojo' && BANDERAS_CRITICAS.indexOf(x.key) !== -1){ critN++; critSet[x.key] = true; } }); });
      var sevB = critN > 0 ? 'rojo' : (k.total_rojas > 0 ? 'amarillo' : 'verde');
      if (sevB === 'rojo'){
        focos++;
        var critNombres = BANDERAS_CIERRE_DEF.filter(function(d){ return critSet[d.key]; }).map(function(d){ return d.abbr; });
        decisiones.push({ tab:'banderas', sev:'rojo', texto: 'Bandera crítica en el cierre: ' + critNombres.join(', ') });
      }
      tarjetas.push({
        key:'banderas', tab:'banderas', icono:'🚩', titulo:'Banderas del cierre', sev:sevB,
        valor: String(k.dias_con_roja || 0), valor_sub: 'día(s) con foco rojo',
        lineas: [ (k.conciliaciones || 0) + ' cierres · ' + (k.total_rojas || 0) + ' banderas', (critN > 0 ? (critN + ' crítica(s)') : (k.total_rojas > 0 ? 'solo leves' : 'sin focos')) ]
      });
    }
  } catch(e){ tarjetas.push(_tarjEjecErr('banderas','🚩','Banderas del cierre', e)); }

  // 5) BARRA (informativo — el detector de fuga es Fase B futura)
  try {
    var ba = handleDireccionVentasBarra({ token:p.token, periodo:'todos' });
    if (ba.ok){
      var kb = ba.kpis || { venta:0, unidades:0, productos:0 };
      tarjetas.push({
        key:'barra', tab:'barra', icono:'🍸', titulo:'Barra', sev:'info',
        valor: ba.sin_datos ? '—' : _fmtMonEjec(kb.venta),
        valor_sub: ba.sin_datos ? 'sin ventas importadas' : 'ventas acumuladas',
        lineas: [ (ba.sin_datos ? 'sube ventas SR12' : ((kb.productos || 0) + ' productos · ' + Math.round(kb.unidades || 0) + ' uds')), 'detector de fuga: próximamente' ]
      });
    }
  } catch(e){ tarjetas.push(_tarjEjecErr('barra','🍸','Barra', e)); }

  // 6) PENDIENTES DE TU GENTE
  try {
    var cuestCanc = 0;
    try { var c2 = handleDireccionCancelaciones(pp); if (c2.ok) cuestCanc = c2.resumen.cuestionamientos_pendientes || 0; } catch(e2){}
    var just = 0;
    try { var j = handleSr12JustificacionesPendientesCount({ token:p.token }); if (j.ok) just = j.pendientes || 0; } catch(e3){}
    var msgPend = 0;
    var shMsg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TableroMensajes');
    if (shMsg){
      rowsToObjects(shMsg).forEach(function(m){
        if (m.empresa_id === u.empresa_id && String(m.estado || '') === 'pendiente'){
          msgPend++;
          if (decisiones.length < 8) decisiones.push({ tab:'justif', sev:'amarillo', texto: (m.destinatario_nombre || 'Tu equipo') + ' no ha respondido: ' + String(m.item_label || m.pregunta || '').slice(0,42) });
        }
      });
    }
    var pend = cuestCanc + just + msgPend;
    tarjetas.push({
      key:'justif', tab:'justif', icono:'📨', titulo:'Pendientes de tu gente', sev: pend > 0 ? 'amarillo' : 'verde',
      valor: String(pend), valor_sub: pend > 0 ? 'sin responder' : 'todo respondido',
      lineas: [ cuestCanc + ' cuestionamientos · ' + just + ' justificaciones', msgPend + ' mensajes del tablero' ]
    });
  } catch(e){ tarjetas.push(_tarjEjecErr('justif','📨','Pendientes de tu gente', e)); }

  // ── TENDENCIAS (Fase 2): comparar contra el periodo anterior y adjuntar flecha por tarjeta.
  // Best-effort: cualquier fallo simplemente deja la tarjeta sin flecha (no rompe el resumen).
  var tendByKey = {};
  // cuadre de carne: semana-vs-semana (cuenta de cortes "arriba" la última semana vs la anterior).
  function _cuadreArribaSemana(cc, idxFromEnd){
    if (!cc || !cc.cortes || !cc.semanas) return null;
    var col = cc.semanas.length - 1 - idxFromEnd;
    if (col < 0) return null;
    var cnt = 0, hayDato = false;
    cc.cortes.forEach(function(corte){
      var cel = (corte.celdas || [])[col];
      // Solo cuenta si la celda tiene semáforo REAL (no 'gris' = aún sin base estadística).
      if (cel && (cel.sev === 'rojo' || cel.sev === 'amarillo' || cel.sev === 'verde')){
        hayDato = true;
        if (cel.sev === 'rojo' || cel.sev === 'amarillo') cnt++;
      }
    });
    return hayDato ? cnt : null;
  }
  var arrLast = _cuadreArribaSemana(ccData, 0), arrPrev = _cuadreArribaSemana(ccData, 1);
  if (arrLast != null && arrPrev != null) tendByKey['cuadre'] = _tendPeor(arrLast, arrPrev, 'vs. semana anterior');
  // canc / sr12 / banderas: re-correr los handlers para el periodo anterior (si hay rango).
  if (ppPrev){
    if (curScal.canc != null){ try { var cP = handleDireccionCancelaciones(ppPrev); if (cP.ok) tendByKey['canc'] = _tendPeor(curScal.canc, _fugaSinAutorizar(cP), etiqTend); } catch(e){} }
    if (curScal.sr12 != null){ try { var sP = handleDireccionCancelacionesSr12(ppPrev); if (sP.ok) tendByKey['sr12'] = _tendPeor(curScal.sr12, (sP.resumen && sP.resumen.caras_sin_documentar) || 0, etiqTend); } catch(e){} }
    if (curScal.banderas != null){ try { var bP = handleDireccionBanderasCierre(ppPrev); if (bP.ok) tendByKey['banderas'] = _tendPeor(curScal.banderas, (bP.kpis && bP.kpis.total_rojas) || 0, etiqTend); } catch(e){} }
  }
  tarjetas.forEach(function(t){ if (tendByKey[t.key]) t.tendencia = tendByKey[t.key]; });

  return {
    ok:true,
    periodo: { desde: desde, hasta: hasta },
    periodo_anterior: prev ? { desde: prev.desde, hasta: prev.hasta } : null,
    focos_rojos: focos,
    dinero_riesgo: dinero,
    tarjetas: tarjetas,
    decisiones: decisiones.slice(0, 8)
  };
}

// =====================================================================================
// ★ MENSAJES DEL TABLERO — comunicación dirigida dirección → responsable (genérico) ★
// =====================================================================================
// A diferencia de los cuestionamientos por-rol (precios → comprador, cancelaciones → admin),
// aquí dirección (Mónica/Germán/Luis) ELIGE a la persona específica a quien preguntar, desde
// cualquier pestaña del Tablero. Esa persona ve y responde desde su bandeja (?p=mensajes).
var TABLERO_MSG_COLS = [
  'id','empresa_id','modulo','item_ref','item_label',
  'destinatario_email','destinatario_nombre','destinatario_rol',
  'pregunta','preguntado_por','preguntado_por_email','preguntado_at',
  'respuesta','respondido_por','respondido_por_email','respondido_at',
  'estado','creado_at'
];
// Roles elegibles como destinatario, por módulo (pestaña del Tablero).
var TABLERO_MSG_DESTINOS = {
  'cuadre_carne': ['cocina','churrasca','comprador'],
  'banderas':     ['cajera','gerente_administrativo'],
  'sr12_doc':     ['admin']
};
var TABLERO_MSG_PREGUNTAN = ['gerente_plaza','auditoria','admin'];

function handleTableroMsgDestinatarios(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, TABLERO_MSG_PREGUNTAN)) return { ok:false, error:'Sin permisos' };
  var roles = TABLERO_MSG_DESTINOS[String(p.modulo||'')];
  if (!roles) return { ok:false, error:'Módulo desconocido' };
  var users = rowsToObjects(getSheet('Usuarios')).filter(function(x){
    return x.empresa_id === u.empresa_id && esActivo(x.activo) && roles.indexOf(String(x.rol||'').toLowerCase()) !== -1;
  }).map(function(x){ return { email:x.email, nombre:x.nombre||x.email, rol:x.rol }; });
  users.sort(function(a,b){ return (a.rol+'|'+a.nombre).localeCompare(b.rol+'|'+b.nombre); });
  return { ok:true, destinatarios: users };
}

function handleTableroMsgCrear(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, TABLERO_MSG_PREGUNTAN)) return { ok:false, error:'Sin permisos' };
  var modulo = String(p.modulo||'');
  var roles = TABLERO_MSG_DESTINOS[modulo];
  if (!roles) return { ok:false, error:'Módulo desconocido' };
  var dest = String(p.destinatario_email||'').toLowerCase().trim();
  var pregunta = String(p.pregunta||'').trim();
  if (!dest) return { ok:false, error:'Elige a quién enviar el mensaje' };
  if (pregunta.length < 3) return { ok:false, error:'Escribe tu pregunta (mínimo 3 caracteres)' };
  var destUser = rowsToObjects(getSheet('Usuarios')).find(function(x){
    return x.empresa_id === u.empresa_id && String(x.email||'').toLowerCase() === dest;
  });
  if (!destUser) return { ok:false, error:'Destinatario no encontrado' };
  if (roles.indexOf(String(destUser.rol||'').toLowerCase()) === -1) return { ok:false, error:'Ese destinatario no aplica para este módulo' };
  var sh = asegurarHoja('TableroMensajes', TABLERO_MSG_COLS);
  var ahora = _ahoraLocalStr();
  var id = uuid();
  sh.appendRow([
    id, u.empresa_id, modulo, String(p.item_ref||''), String(p.item_label||''),
    dest, destUser.nombre||dest, destUser.rol||'',
    pregunta, (u.nombre||u.email||''), u.email, ahora,
    '', '', '', '', 'pendiente', ahora
  ]);
  return { ok:true, id:id };
}

function handleTableroMsgResponder(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var id = String(p.id||'').trim();
  var respuesta = String(p.respuesta||'').trim();
  if (!id) return { ok:false, error:'Falta el id del mensaje' };
  if (respuesta.length < 2) return { ok:false, error:'Escribe la respuesta' };
  var sh = asegurarHoja('TableroMensajes', TABLERO_MSG_COLS);
  var rows = rowsToObjects(sh);
  var idx = -1;
  for (var i=0;i<rows.length;i++){ if (rows[i].id===id && rows[i].empresa_id===u.empresa_id){ idx=i; break; } }
  if (idx === -1) return { ok:false, error:'Mensaje no encontrado' };
  var msg = rows[idx];
  var esDest = String(msg.destinatario_email||'').toLowerCase() === String(u.email||'').toLowerCase();
  if (!esDest && !rolEs(u, ['admin'])) return { ok:false, error:'Solo el destinatario puede responder este mensaje' };
  var hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var shRow = idx+2;
  function setCol(name,val){ var c=hdrs.indexOf(name)+1; if(c) sh.getRange(shRow,c).setValue(val); }
  setCol('respuesta', respuesta);
  setCol('respondido_por', u.nombre||u.email||'');
  setCol('respondido_por_email', u.email);
  setCol('respondido_at', _ahoraLocalStr());
  setCol('estado', 'respondida');
  return { ok:true };
}

function _tableroMsgMap(r){
  return { id:r.id, modulo:r.modulo, item_ref:r.item_ref, item_label:r.item_label,
    destinatario_email:r.destinatario_email, destinatario_nombre:r.destinatario_nombre, destinatario_rol:r.destinatario_rol,
    pregunta:r.pregunta, preguntado_por:r.preguntado_por, preguntado_at:String(r.preguntado_at||'').slice(0,16),
    respuesta:r.respuesta||'', respondido_por:r.respondido_por||'', respondido_at:String(r.respondido_at||'').slice(0,16),
    estado:String(r.estado||'pendiente') };
}

// Hilos de un módulo (para las pestañas del Tablero). Lectura para dirección.
function handleTableroMsgList(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, TABLERO_MSG_PREGUNTAN)) return { ok:false, error:'Sin permisos' };
  var sh = getSheet('TableroMensajes');
  if (!sh) return { ok:true, mensajes:[] };
  var modulo = String(p.modulo||'');
  var itemRef = (p.item_ref != null && p.item_ref !== '') ? String(p.item_ref) : null;
  var rows = rowsToObjects(sh).filter(function(r){
    if (r.empresa_id !== u.empresa_id) return false;
    if (modulo && r.modulo !== modulo) return false;
    if (itemRef != null && String(r.item_ref) !== itemRef) return false;
    return true;
  }).map(_tableroMsgMap);
  rows.sort(function(a,b){ return String(b.preguntado_at).localeCompare(String(a.preguntado_at)); });
  return { ok:true, mensajes: rows };
}

// Conteo de mensajes por fila (item_ref) de un módulo — para pintar el badge 💬 N en cada
// renglón de las pestañas del Tablero (Cuadre/Banderas/SR12), igual que Cancelaciones/Justif. v378.
// Lectura ligera: devuelve { ref: { total, pend } } sin traer los textos.
function handleTableroMsgRefCounts(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, TABLERO_MSG_PREGUNTAN)) return { ok:false, error:'Sin permisos' };
  var sh = getSheet('TableroMensajes');
  if (!sh) return { ok:true, counts:{} };
  var modulo = String(p.modulo||'');
  var counts = {};
  rowsToObjects(sh).forEach(function(r){
    if (r.empresa_id !== u.empresa_id) return;
    if (modulo && r.modulo !== modulo) return;
    var ref = String(r.item_ref==null?'':r.item_ref);
    if (!counts[ref]) counts[ref] = { total:0, pend:0 };
    counts[ref].total++;
    if (String(r.estado||'pendiente') !== 'respondida') counts[ref].pend++;
  });
  return { ok:true, counts:counts };
}

// Bandeja del destinatario (cualquier usuario): mensajes dirigidos a MÍ.
function handleTableroMsgMis(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = getSheet('TableroMensajes');
  if (!sh) return { ok:true, mensajes:[] };
  var rows = rowsToObjects(sh).filter(function(r){
    return r.empresa_id === u.empresa_id && String(r.destinatario_email||'').toLowerCase() === String(u.email||'').toLowerCase();
  }).map(_tableroMsgMap);
  rows.sort(function(a,b){
    var pa = a.estado==='pendiente'?0:1, pb = b.estado==='pendiente'?0:1;
    if (pa !== pb) return pa - pb;
    return String(b.preguntado_at).localeCompare(String(a.preguntado_at));
  });
  return { ok:true, mensajes: rows };
}

// Conteo de mensajes pendientes dirigidos a MÍ (para el badge de inicio).
function handleTableroMsgCount(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = getSheet('TableroMensajes');
  if (!sh) return { ok:true, pendientes:0 };
  var n = rowsToObjects(sh).filter(function(r){
    return r.empresa_id === u.empresa_id
      && String(r.destinatario_email||'').toLowerCase() === String(u.email||'').toLowerCase()
      && String(r.estado||'pendiente') === 'pendiente';
  }).length;
  return { ok:true, pendientes:n };
}

// =====================================================================================
// ★ AVISO AL QUE PREGUNTA — badge cuando le responden (los 3 sistemas de mensajes) ★
// =====================================================================================
// Cuenta las preguntas que YO hice (preguntado_por_email == mi email) que ya están
// 'respondida' y cuya respuesta es posterior a la última vez que abrí el Tablero.
// Cubre CancelacionesCuestionamientos + PreciosCuestionamientos + TableroMensajes.
function _fhComparable(x){
  if (x == null || x === '') return '';
  if (Object.prototype.toString.call(x) === '[object Date]'){
    function z(n){ return ('0'+n).slice(-2); }
    return x.getFullYear()+'-'+z(x.getMonth()+1)+'-'+z(x.getDate())+' '+z(x.getHours())+':'+z(x.getMinutes());
  }
  return String(x).slice(0,16);
}
function _ultimaVistaRespuestas(empresaId, email){
  var sh = getSheet('RespuestasVistas');
  if (!sh) return '';
  var r = rowsToObjects(sh).find(function(x){
    return x.empresa_id === empresaId && String(x.email||'').toLowerCase() === String(email||'').toLowerCase();
  });
  return r ? _fhComparable(r.last_seen_at) : '';
}

function handleTableroRespuestasCount(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var lastSeen = _ultimaVistaRespuestas(u.empresa_id, u.email);
  var emailLc = String(u.email||'').toLowerCase();
  var det = [];
  function rev(sheetName, sistema, labelFn){
    var sh = getSheet(sheetName); if (!sh) return;
    rowsToObjects(sh).forEach(function(r){
      if (r.empresa_id !== u.empresa_id) return;
      if (String(r.preguntado_por_email||'').toLowerCase() !== emailLc) return;
      if (String(r.estado||'') !== 'respondida') return;
      var rat = _fhComparable(r.respondido_at);
      if (!rat) return;
      if (lastSeen && rat <= lastSeen) return;
      det.push({ sistema:sistema, label:labelFn(r), respondido_por:r.respondido_por||'', respondido_at:rat });
    });
  }
  rev('CancelacionesCuestionamientos', 'Cancelaciones', function(r){ return String(r.producto||'cancelación')+(r.folio?(' · folio '+r.folio):''); });
  rev('PreciosCuestionamientos', 'Precios', function(r){ return String(r.producto||r.clave_sr12||'precio'); });
  rev('TableroMensajes', 'Tablero', function(r){ return String(r.item_label||r.modulo||'mensaje'); });
  det.sort(function(a,b){ return String(b.respondido_at).localeCompare(String(a.respondido_at)); });
  return { ok:true, pendientes: det.length, detalle: det.slice(0,30) };
}

// === Panel "Mi actividad de supervisión" (v389) ===
// Para un usuario supervisor: entradas (días activos) en los últimos 7 días + total,
// observaciones hechas (preguntas en las 3 hojas de cuestionamientos) + desglose,
// última actividad y días sin entrar (para la alerta de inactividad).
function _actividadDeUsuario(empresaId, usr, hoyLog){
  var emailLc = String(usr.email||'').toLowerCase();
  var obs = { cancelaciones:0, precios:0, tablero:0, total:0, ultima:'' };
  function cnt(sheetName, key){
    var sh = getSheet(sheetName); if (!sh) return;
    rowsToObjects(sh).forEach(function(r){
      if (r.empresa_id !== empresaId) return;
      if (String(r.preguntado_por_email||'').toLowerCase() !== emailLc) return;
      obs[key]++; obs.total++;
      var pat = _fhComparable(r.preguntado_at);
      if (pat > obs.ultima) obs.ultima = pat;
    });
  }
  cnt('CancelacionesCuestionamientos','cancelaciones');
  cnt('PreciosCuestionamientos','precios');
  cnt('TableroMensajes','tablero');

  var hace7 = _agendaSumaDias(hoyLog, -6); // ventana de 7 días lógicos (hoy incluido)
  var diasTotal = {}, diasSemana = {}, ultimoAcceso = '';
  var shA = getSheet('Accesos');
  if (shA) rowsToObjects(shA).forEach(function(r){
    if (r.empresa_id !== empresaId) return;
    if (String(r.usuario_id||'') !== String(usr.id)) return;
    // ⚠ Sheets (es_MX) convierte "2026-06-13" a Date al guardar → usar fechaToString al leer.
    var d = fechaToString(r.dia_logico); if (!d) return;
    diasTotal[d] = 1;
    if (d >= hace7 && d <= hoyLog) diasSemana[d] = 1;
    var ts = _fhComparable(r.creado_at);
    if (ts > ultimoAcceso) ultimoAcceso = ts;
  });

  var ultimaAct = ultimoAcceso > obs.ultima ? ultimoAcceso : obs.ultima;
  return {
    usuario_id: usr.id, nombre: usr.nombre || usr.email, email: usr.email, rol: usr.rol,
    entradas_semana: Object.keys(diasSemana).length,
    entradas_total: Object.keys(diasTotal).length,
    obs_total: obs.total, obs_cancelaciones: obs.cancelaciones, obs_precios: obs.precios, obs_tablero: obs.tablero,
    ultima_obs: obs.ultima, ultimo_acceso: ultimoAcceso, ultima_actividad: ultimaAct,
    dias_sin_entrar: ultimoAcceso ? _diasEntre(ultimoAcceso.slice(0,10), hoyLog) : null,
    nunca_ha_entrado: !ultimoAcceso
  };
}

function handleSupervisionActividad(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_plaza','auditoria','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var hoyLog = diaLogicoRestaurante();
  var resp = {
    ok:true, hoy: hoyLog,
    mi_actividad: _actividadDeUsuario(u.empresa_id, { id:u.id, email:u.email, rol:u.rol, nombre:u.nombre }, hoyLog),
    ver_todos: false
  };
  // Tabla de TODOS los supervisores: solo dirección/auditoría (decisión Germán 2026-06-13).
  if (rolEs(u, ['admin','auditoria'])) {
    resp.ver_todos = true;
    var sups = rowsToObjects(getSheet('Usuarios')).filter(function(x){
      return x.empresa_id === u.empresa_id && esActivo(x.activo)
        && SUPERVISOR_ROLES_ACTIVIDAD.indexOf(String(x.rol||'').toLowerCase()) !== -1;
    });
    resp.supervisores = sups.map(function(x){
      return _actividadDeUsuario(u.empresa_id, { id:x.id, email:x.email, rol:x.rol, nombre:x.nombre }, hoyLog);
    }).sort(function(a,b){ return (b.entradas_semana - a.entradas_semana) || (b.obs_total - a.obs_total); });
  }
  return resp;
}

function handleTableroRespuestasMarcarVistas(p){
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = asegurarHoja('RespuestasVistas', ['empresa_id','email','last_seen_at']);
  var ahora = _ahoraLocalStr();
  var rows = rowsToObjects(sh);
  var idx = -1;
  for (var i=0;i<rows.length;i++){
    if (rows[i].empresa_id===u.empresa_id && String(rows[i].email||'').toLowerCase()===String(u.email||'').toLowerCase()){ idx=i; break; }
  }
  if (idx === -1){ sh.appendRow([u.empresa_id, u.email, ahora]); }
  else {
    var hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    var c = hdrs.indexOf('last_seen_at')+1;
    if (c) sh.getRange(idx+2, c).setValue(ahora);
  }
  return { ok:true };
}

// Hoja de hilos de cuestionamiento sobre cancelaciones (Gerente de Plaza ↔ administración).
var CANC_CUESTIONAMIENTOS_COLS = [
  'id','empresa_id','cancel_id','conciliacion_fecha','folio','producto','monto_orig','monto_nuevo',
  'pregunta','preguntado_por','preguntado_por_email','preguntado_at',
  'respuesta','respondido_por','respondido_por_email','respondido_at','estado','creado_at'
];
function _ahoraLocalStr(){
  var d = new Date();
  function z(n){ return ('0'+n).slice(-2); }
  return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes());
}

// El Gerente de Plaza (o auditoría/admin) cuestiona una cancelación → queda como hilo PENDIENTE.
function handleCancelacionCuestionar(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['gerente_plaza','auditoria','admin'])) return { ok:false, error:'Sin permisos' };
  var cancelId = String(p.cancel_id || '').trim();
  var pregunta = String(p.pregunta || '').trim();
  if (!cancelId) return { ok:false, error:'Falta la referencia de la cancelación' };
  if (pregunta.length < 3) return { ok:false, error:'Escribe tu pregunta (mínimo 3 caracteres)' };
  var sh = asegurarHoja('CancelacionesCuestionamientos', CANC_CUESTIONAMIENTOS_COLS);
  var ahora = _ahoraLocalStr();
  var id = uuid();
  sh.appendRow([
    id, u.empresa_id, cancelId, String(p.conciliacion_fecha||''), String(p.folio||''), String(p.producto||''),
    String(p.monto_orig||''), String(p.monto_nuevo||''),
    pregunta, (u.nombre||u.email||''), u.email, ahora,
    '', '', '', '', 'pendiente', ahora
  ]);
  return { ok:true, id:id };
}

// La administración (admin / gerente administrativo) responde un cuestionamiento → estado RESPONDIDA.
function handleCancelacionResponder(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo la administración puede responder' };
  var id = String(p.id || '').trim();
  var respuesta = String(p.respuesta || '').trim();
  if (!id) return { ok:false, error:'Falta el id del cuestionamiento' };
  if (respuesta.length < 3) return { ok:false, error:'Escribe la respuesta (mínimo 3 caracteres)' };
  var sh = asegurarHoja('CancelacionesCuestionamientos', CANC_CUESTIONAMIENTOS_COLS);
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
  setCol('respondido_at', _ahoraLocalStr());
  setCol('estado', 'respondida');
  return { ok:true };
}

// Conteo ligero de cuestionamientos de cancelaciones PENDIENTES (para el badge de Luis en inicio).
function handleCancelacionCuestCount(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CancelacionesCuestionamientos');
  if (!sh) return { ok:true, pendientes:0 };
  var n = rowsToObjects(sh).filter(function(r){ return r.empresa_id===u.empresa_id && String(r.estado||'pendiente')==='pendiente'; }).length;
  return { ok:true, pendientes:n };
}

function handleConciliacionGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria','cajera'])) return { ok:false, error:'Sin permisos' };
  if (!p.fecha) return { ok:false, error:'fecha requerida' };
  var sucursal_id = p.sucursal_id || '';
  var c = rowsToObjects(getSheet('Conciliaciones')).find(function(x){
    if (x.empresa_id !== u.empresa_id) return false;
    if (sucursal_id && x.sucursal_id !== sucursal_id) return false;
    return fechaToString(x.fecha) === p.fecha;
  });
  if (!c) return { ok:true, conciliacion: null };
  var payload = {}; try { payload = JSON.parse(c.payload_json || '{}'); } catch(e){}
  return { ok:true, conciliacion: {
    id: c.id, empresa_id: c.empresa_id, sucursal_id: c.sucursal_id,
    fecha: fechaToString(c.fecha), estado: c.estado,
    cerrada_at: c.cerrada_at instanceof Date ? c.cerrada_at.toISOString() : (c.cerrada_at || ''),
    actualizado_por: c.actualizado_por || '',
    actualizado_at: c.actualizado_at instanceof Date ? c.actualizado_at.toISOString() : (c.actualizado_at || ''),
    payload: payload
  }};
}
function handleConciliacionSave(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria','cajera'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var sheet = getSheet('Conciliaciones'), conciliaciones = rowsToObjects(sheet);
  var existing = null;
  if (data.id) existing = conciliaciones.find(function(x){ return x.id === data.id && x.empresa_id === u.empresa_id; });
  if (!existing && data.fecha) {
    existing = conciliaciones.find(function(x){
      if (x.empresa_id !== u.empresa_id) return false;
      if (data.sucursal_id && x.sucursal_id !== data.sucursal_id) return false;
      return fechaToString(x.fecha) === data.fecha;
    });
  }
  var nuevoEstado = data.estado || (existing ? existing.estado : 'abierta');
  var ahora = new Date();
  // Capturamos el payload anterior ANTES del update, para diff de auditoría (T2 fase 2)
  var payloadAnterior = {};
  if (existing) {
    try { payloadAnterior = JSON.parse(existing.payload_json || '{}'); } catch(e){}
  }
  var payloadNuevo = data.payload || {};
  if (existing) {
    if (existing.estado === 'cerrada' && !rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Conciliación cerrada' };
    var row = existing._row;
    sheet.getRange(row, 4).setValue(data.fecha || existing.fecha);
    sheet.getRange(row, 5).setValue(nuevoEstado);
    sheet.getRange(row, 6).setValue(nuevoEstado === 'cerrada' ? ahora : (existing.cerrada_at || ''));
    sheet.getRange(row, 7).setValue(JSON.stringify(payloadNuevo));
    // v407 — registrar quién capturó/editó (Moni: "no se observa quién rellenó datos")
    sheet.getRange(row, _getOrCreateCol(sheet, 'actualizado_por')).setValue(u.email);
    sheet.getRange(row, _getOrCreateCol(sheet, 'actualizado_at')).setValue(ahora);
    // Auditoría: detectar cambio de estado o cambios de secciones
    var accionAud = 'editar';
    if (nuevoEstado === 'cerrada' && existing.estado !== 'cerrada') accionAud = 'cerrar';
    else if (nuevoEstado !== 'cerrada' && existing.estado === 'cerrada') accionAud = 'reabrir';
    registrarAuditoriaConciliacion(existing.id, u, fechaToString(data.fecha || existing.fecha),
      existing.sucursal_id, accionAud, payloadAnterior, payloadNuevo);
    return { ok:true, id: existing.id, action:'updated' };
  } else {
    var newId = data.id || uuid();
    var sucursal_id = data.sucursal_id || ((rowsToObjects(getSheet('Sucursales')).find(function(s){ return s.empresa_id === u.empresa_id; }) || {}).id || '');
    sheet.appendRow([newId, u.empresa_id, sucursal_id, data.fecha || '', nuevoEstado,
      nuevoEstado === 'cerrada' ? ahora : '', JSON.stringify(payloadNuevo)]);
    // v407 — registrar quién capturó (Moni: "no se observa quién rellenó datos")
    var _nr = sheet.getLastRow();
    sheet.getRange(_nr, _getOrCreateCol(sheet, 'actualizado_por')).setValue(u.email);
    sheet.getRange(_nr, _getOrCreateCol(sheet, 'actualizado_at')).setValue(ahora);
    // Auditoría: primer save = "crear"
    registrarAuditoriaConciliacion(newId, u, fechaToString(data.fecha || ''),
      sucursal_id, 'crear', {}, payloadNuevo);
    return { ok:true, id: newId, action:'created' };
  }
}

// =============== ConciliacionAuditoria (T2 fase 2) ===============
// Mapeo de prefijo de campo → sección lógica de la conciliación.
// El orden importa: las reglas más específicas van ANTES de la genérica `^ci_` para que
// p.ej. `ci_corte_d1000_cant` caiga en "corte_caja", no en "cierre_general".
var CONCILIACION_SECCIONES = [
  ['apertura',         /^ap_/],
  ['corte_caja',       /^ci_corte_/],
  ['arqueo',           /^ci_arq_/],
  ['depositos',        /^ci_dep/],
  ['cfdi',             /^ci_cfdi/],
  ['apps',             /^ci_app/],
  ['extras',           /^ci_(extra|merma|repos|charolas)/],
  ['cortesias',        /^ci_cortesias$/],
  ['terminales',       /^ci_terminales$/],
  ['cancelaciones',    /^ci_canc/],
  ['cierre_general',   /^ci_/],   // catch-all para `ci_hora_*`, `ci_servicio`, `ci_mix_*`, `ci_cobro_*`, etc.
  ['resumen',          /^res_/],
  ['folios',           /^folio_/]
];
function seccionFromKey(k) {
  for (var i = 0; i < CONCILIACION_SECCIONES.length; i++) {
    if (CONCILIACION_SECCIONES[i][1].test(k)) return CONCILIACION_SECCIONES[i][0];
  }
  return 'otros';
}
// Devuelve un array ordenado de secciones cuyos campos cambiaron entre 2 payloads.
// Compara por valor con JSON.stringify (suficiente para los tipos del payload: number, string, array de objetos).
function seccionesQueCambiaronConciliacion(antiguo, nuevo) {
  antiguo = antiguo || {}; nuevo = nuevo || {};
  var keys = {};
  Object.keys(antiguo).forEach(function(k){ keys[k] = true; });
  Object.keys(nuevo).forEach(function(k){ keys[k] = true; });
  var seccionesSet = {};
  Object.keys(keys).forEach(function(k){
    var va = antiguo[k], vb = nuevo[k];
    var ja, jb;
    try { ja = JSON.stringify(va == null ? '' : va); } catch(e){ ja = String(va); }
    try { jb = JSON.stringify(vb == null ? '' : vb); } catch(e){ jb = String(vb); }
    if (ja !== jb) seccionesSet[seccionFromKey(k)] = true;
  });
  return Object.keys(seccionesSet).sort();
}
// Registra evento en la hoja ConciliacionAuditoria.
// Throttle: si la última entrada para esta conciliación es del mismo usuario y hace <120s
// y la accion actual es 'editar' (no cambio de estado), ACTUALIZA esa fila en lugar de
// crear una nueva — evita inflar la hoja en sesiones de captura activa con debounce.
// Cambios de estado (crear/cerrar/reabrir) siempre crean entrada nueva.
function registrarAuditoriaConciliacion(conciliacion_id, u, fechaStr, sucursal_id, accion, payloadAntiguo, payloadNuevo) {
  try {
    var secciones = seccionesQueCambiaronConciliacion(payloadAntiguo, payloadNuevo);
    // No registrar si fue un save sin cambios reales (evita ruido por recálculos auto del frontend)
    if (accion === 'editar' && secciones.length === 0) return;
    var sheet = asegurarHoja('ConciliacionAuditoria',
      ['id','conciliacion_id','empresa_id','sucursal_id','fecha','usuario_email','usuario_nombre','usuario_rol','ts','accion','secciones_modificadas','payload_snapshot_json']);
    var ahora = new Date();
    var snapshotJson = JSON.stringify(payloadNuevo || {});
    var seccionesStr = secciones.join(',');
    if (accion === 'editar') {
      // Throttle: buscar la entrada más reciente para esta conciliación
      var todasFilas = rowsToObjects(sheet);
      var ultima = null;
      for (var i = todasFilas.length - 1; i >= 0; i--) {
        if (todasFilas[i].conciliacion_id === conciliacion_id) { ultima = todasFilas[i]; break; }
      }
      if (ultima && ultima.usuario_email === u.email && ultima.accion === 'editar') {
        var ultimaTs = ultima.ts instanceof Date ? ultima.ts.getTime() : new Date(ultima.ts).getTime();
        if (!isNaN(ultimaTs) && (ahora.getTime() - ultimaTs) < 120 * 1000) {
          // Mergear secciones (la nueva entrada acumula las del intervalo throttle)
          var seccionesAcc = String(ultima.secciones_modificadas || '').split(',').filter(function(s){return s;});
          secciones.forEach(function(s){ if (seccionesAcc.indexOf(s) === -1) seccionesAcc.push(s); });
          seccionesAcc.sort();
          var rowU = ultima._row;
          sheet.getRange(rowU, 9).setValue(ahora);
          sheet.getRange(rowU, 11).setValue(seccionesAcc.join(','));
          sheet.getRange(rowU, 12).setValue(snapshotJson);
          return;
        }
      }
    }
    sheet.appendRow([
      uuid(), conciliacion_id, u.empresa_id, sucursal_id || '', fechaStr || '',
      u.email || '', u.nombre || '', u.rol || '',
      ahora, accion, seccionesStr, snapshotJson
    ]);
  } catch(e) {
    // Auditoría es defensiva — si falla, NO debe romper el save principal de Conciliación.
    // El error queda en logs de Apps Script para revisión posterior.
    console.log('Error registrarAuditoriaConciliacion: ' + (e && e.message));
  }
}
// Endpoint: lista las entradas de auditoría para una conciliación o fecha.
// Permitido: admin, auditoria, gerente_administrativo. NO la cajera (es histórico de control).
function handleConciliacionAuditoriaList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var conciliacion_id = String(p.conciliacion_id || '');
  var fecha = String(p.fecha || '');
  if (!conciliacion_id && !fecha) return { ok:false, error:'Debes pasar conciliacion_id o fecha' };
  var sheet = asegurarHoja('ConciliacionAuditoria',
    ['id','conciliacion_id','empresa_id','sucursal_id','fecha','usuario_email','usuario_nombre','usuario_rol','ts','accion','secciones_modificadas','payload_snapshot_json']);
  var filas = rowsToObjects(sheet).filter(function(f){
    if (f.empresa_id !== u.empresa_id) return false;
    if (conciliacion_id && f.conciliacion_id !== conciliacion_id) return false;
    if (fecha && fechaToString(f.fecha) !== fecha) return false;
    return true;
  });
  // Más reciente primero
  filas.sort(function(a,b){
    var ta = a.ts instanceof Date ? a.ts.getTime() : new Date(a.ts).getTime();
    var tb = b.ts instanceof Date ? b.ts.getTime() : new Date(b.ts).getTime();
    return tb - ta;
  });
  // No devolvemos el snapshot completo en la lista (puede ser MB) — solo metadata.
  // Si el cliente quiere el snapshot, llamará un endpoint detail (futuro).
  var resultado = filas.map(function(f){
    return {
      id: f.id,
      conciliacion_id: f.conciliacion_id,
      fecha: fechaToString(f.fecha),
      usuario_email: f.usuario_email,
      usuario_nombre: f.usuario_nombre,
      usuario_rol: f.usuario_rol,
      ts: f.ts instanceof Date ? f.ts.toISOString() : (f.ts || ''),
      accion: f.accion,
      secciones_modificadas: String(f.secciones_modificadas || '').split(',').filter(function(s){return s;})
    };
  });
  return { ok:true, auditoria: resultado };
}

// T2 fase 3: devuelve una entrada de auditoría con snapshot completo + diff respecto al anterior.
function handleConciliacionAuditoriaGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria','gerente_administrativo'])) return { ok:false, error:'Sin permisos' };
  var id = String(p.id || '');
  if (!id) return { ok:false, error:'id requerido' };
  var sheet = asegurarHoja('ConciliacionAuditoria',
    ['id','conciliacion_id','empresa_id','sucursal_id','fecha','usuario_email','usuario_nombre','usuario_rol','ts','accion','secciones_modificadas','payload_snapshot_json']);
  var todas = rowsToObjects(sheet).filter(function(f){ return f.empresa_id === u.empresa_id; });
  var entrada = null;
  for (var i = 0; i < todas.length; i++) { if (todas[i].id === id) { entrada = todas[i]; break; } }
  if (!entrada) return { ok:false, error:'Entrada no encontrada' };
  // Misma conciliación ordenada cronológicamente
  var mismaConcil = todas.filter(function(f){ return f.conciliacion_id === entrada.conciliacion_id; });
  mismaConcil.sort(function(a,b){
    var ta = a.ts instanceof Date ? a.ts.getTime() : new Date(a.ts||0).getTime();
    var tb = b.ts instanceof Date ? b.ts.getTime() : new Date(b.ts||0).getTime();
    return ta - tb;
  });
  var miIdx = -1;
  for (var j = 0; j < mismaConcil.length; j++) { if (mismaConcil[j].id === id) { miIdx = j; break; } }
  var snapAnteriorJson = miIdx > 0 ? (mismaConcil[miIdx-1].payload_snapshot_json || '{}') : '{}';
  var snapActualJson   = entrada.payload_snapshot_json || '{}';
  var antes = {}, despues = {};
  try { antes   = JSON.parse(snapAnteriorJson); } catch(e){}
  try { despues = JSON.parse(snapActualJson);   } catch(e){}
  // Calcular diff campo a campo
  var keysAll = {};
  Object.keys(antes).forEach(function(k){ keysAll[k]=true; });
  Object.keys(despues).forEach(function(k){ keysAll[k]=true; });
  var diff = [];
  Object.keys(keysAll).forEach(function(k){
    var va = antes[k]==null?'':antes[k], vb = despues[k]==null?'':despues[k];
    var ja, jb;
    try { ja = JSON.stringify(va); } catch(e){ ja=String(va); }
    try { jb = JSON.stringify(vb); } catch(e){ jb=String(vb); }
    if (ja !== jb) diff.push({ campo:k, seccion:seccionFromKey(k), antes:va, despues:vb });
  });
  diff.sort(function(a,b){
    if (a.seccion<b.seccion) return -1; if (a.seccion>b.seccion) return 1;
    if (a.campo<b.campo) return -1;     if (a.campo>b.campo) return 1;
    return 0;
  });
  return {
    ok: true,
    entrada: {
      id: entrada.id, conciliacion_id: entrada.conciliacion_id,
      fecha: fechaToString(entrada.fecha),
      usuario_nombre: entrada.usuario_nombre, usuario_email: entrada.usuario_email, usuario_rol: entrada.usuario_rol,
      ts: entrada.ts instanceof Date ? entrada.ts.toISOString() : (entrada.ts||''),
      accion: entrada.accion,
      secciones_modificadas: String(entrada.secciones_modificadas||'').split(',').filter(Boolean)
    },
    diff: diff,
    es_primera_entrada: miIdx === 0
  };
}

// =============== Usuarios ===============
function handleUsersList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var users = rowsToObjects(getSheet('Usuarios')).filter(function(x){ return x.empresa_id === u.empresa_id; });
  return { ok:true, users: users.map(function(x){
    return { id:x.id, email:x.email, nombre:x.nombre, rol:x.rol, activo:esActivo(x.activo),
             creado_at: x.creado_at instanceof Date ? x.creado_at.toISOString() : (x.creado_at || '') };
  })};
}
function handleUsersCreate(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin puede crear usuarios' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var email = String(data.email || '').toLowerCase().trim();
  var password = data.password || '', nombre = String(data.nombre || '').trim(), rol = String(data.rol || '').toLowerCase();
  if (!email || !password || !nombre || !rol) return { ok:false, error:'Faltan datos' };
  if (password.length < 6) return { ok:false, error:'La contraseña debe tener al menos 6 caracteres' };
  if (ROLES_VALIDOS.indexOf(rol) === -1) return { ok:false, error:'Rol inválido' };
  if (rowsToObjects(getSheet('Usuarios')).some(function(x){ return String(x.email).toLowerCase() === email; })) {
    return { ok:false, error:'Ya existe un usuario con ese email' };
  }
  var newId = uuid();
  getSheet('Usuarios').appendRow([newId, email, hashPassword(password), u.empresa_id, rol, nombre, true, new Date()]);
  return { ok:true, id: newId };
}
function handleUsersUpdate(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  if (!data.id) return { ok:false, error:'id requerido' };
  var sheet = getSheet('Usuarios');
  var existing = rowsToObjects(sheet).find(function(x){ return x.id === data.id && x.empresa_id === u.empresa_id; });
  if (!existing) return { ok:false, error:'Usuario no encontrado' };
  if (existing.id === u.id && data.activo === false) return { ok:false, error:'No puedes desactivarte a ti mismo' };
  var row = existing._row;
  if (data.nombre !== undefined && String(data.nombre).trim()) sheet.getRange(row, 6).setValue(String(data.nombre).trim());
  if (data.email !== undefined) {
    var emailNuevo = String(data.email).toLowerCase().trim();
    if (!emailNuevo) return { ok:false, error:'Email no puede quedar vacío' };
    if (emailNuevo !== String(existing.email).toLowerCase()) {
      // Verificar que no exista otro usuario con ese email
      var dup = rowsToObjects(sheet).find(function(x){
        return x.id !== existing.id && String(x.email).toLowerCase() === emailNuevo;
      });
      if (dup) return { ok:false, error:'Ya existe otro usuario con ese email' };
      sheet.getRange(row, 2).setValue(emailNuevo);
    }
  }
  if (data.rol !== undefined) {
    var rolNuevo = String(data.rol).toLowerCase();
    if (ROLES_VALIDOS.indexOf(rolNuevo) === -1) return { ok:false, error:'Rol inválido' };
    sheet.getRange(row, 5).setValue(rolNuevo);
  }
  if (data.activo !== undefined) sheet.getRange(row, 7).setValue(!!data.activo);
  return { ok:true, id: existing.id };
}
// Endpoint accesible por cualquier usuario logueado: lista los usuarios activos con rol
// gerente_restaurante / gerente_administrativo / admin (para popular el select de cortesías).
function handleGerentesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var users = rowsToObjects(getSheet('Usuarios')).filter(function(x){
    if (x.empresa_id !== u.empresa_id) return false;
    if (!esActivo(x.activo)) return false;
    return ROLES_AUTORIZA_CORTESIAS.indexOf(String(x.rol || '').toLowerCase()) !== -1;
  });
  return { ok:true, gerentes: users.map(function(x){
    return { id:x.id, nombre:x.nombre || x.email, rol: String(x.rol || '').toLowerCase() };
  })};
}
function handlePasswordChange(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var targetId = data.user_id || u.id, newPassword = data.new_password || '';
  if (!newPassword || newPassword.length < 6) return { ok:false, error:'Mínimo 6 caracteres' };
  if (targetId === u.id) {
    if (hashPassword(data.old_password || '') !== u.password_hash) return { ok:false, error:'Contraseña actual incorrecta' };
  } else {
    if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin' };
  }
  var sheet = getSheet('Usuarios');
  var target = rowsToObjects(sheet).find(function(x){ return x.id === targetId && x.empresa_id === u.empresa_id; });
  if (!target) return { ok:false, error:'Usuario no encontrado' };
  sheet.getRange(target._row, 3).setValue(hashPassword(newPassword));
  return { ok:true };
}

// =============== Charolas ===============
function handleCharolasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['cocina','churrasca','admin','auditoria','cajera'])) return { ok:false, error:'Sin permisos' };
  var fecha = p.fecha || '', sucursal_id = p.sucursal_id || '', area = p.area || '';
  var charolas = rowsToObjects(getSheet('Charolas')).filter(function(c){
    if (c.empresa_id !== u.empresa_id) return false;
    if (sucursal_id && c.sucursal_id !== sucursal_id) return false;
    if (fecha && fechaToString(c.fecha) !== fecha) return false;
    if (area && c.area !== area) return false;
    return true;
  });
  return { ok:true, charolas: charolas.map(function(c){
    return { id:c.id, fecha:fechaToString(c.fecha), hora:horaToString(c.hora), area:c.area, tipo:c.tipo,
             descripcion:c.descripcion, cantidad:c.cantidad, responsable_email:c.responsable_email,
             creado_at: c.creado_at instanceof Date ? c.creado_at.toISOString() : (c.creado_at || '') };
  })};
}
function handleCharolasCreate(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var area = String(data.area || '').toLowerCase();
  if (['cocina','churrasca'].indexOf(area) === -1) return { ok:false, error:'Área inválida' };
  var rol = String(u.rol || '').toLowerCase();
  if (rol === 'cocina' && area !== 'cocina') return { ok:false, error:'Solo charolas de cocina' };
  if (rol === 'churrasca' && area !== 'churrasca') return { ok:false, error:'Solo charolas de churrasca' };
  if (['cocina','churrasca','admin','auditoria'].indexOf(rol) === -1) return { ok:false, error:'Sin permisos' };
  var tipo = String(data.tipo || 'charola').toLowerCase();
  if (['charola','reposicion','merma'].indexOf(tipo) === -1) return { ok:false, error:'Tipo inválido' };
  var fecha = data.fecha || fechaToString(new Date()), hora = data.hora || nowHHMM();
  var descripcion = String(data.descripcion || '').trim(), cantidad = Number(data.cantidad) || 1;
  var sucursal_id = data.sucursal_id || ((rowsToObjects(getSheet('Sucursales')).find(function(s){ return s.empresa_id === u.empresa_id; }) || {}).id || '');
  var receta_id = String(data.receta_id || '').trim();
  var newId = uuid();
  // 11 columnas históricas + receta_id + descuento_aplicado
  getSheet('Charolas').appendRow([newId, u.empresa_id, sucursal_id, fecha, hora, area, tipo, descripcion, cantidad, u.email, new Date(), receta_id, false]);

  // === Si la charola tiene receta vinculada, descontar ingredientes en InventarioChurrasca ===
  // - charola/reposicion: ingredientes salen al cliente (se sirvieron)
  // - merma: ingredientes salieron del inventario pero NO al cliente (se tiraron). La pérdida queda
  //   marcada con prefijo 'merma:' en actualizado_por para distinguirla en auditoría.
  // Churrasca Y cocina descuentan (construyen el "consumo teórico"). Solo se descuentan los
  // ingredientes que estén marcados como inventariables en InventarioChurrascaConfig; el resto
  // se ignora. No toca las existencias del SR12 (eso es la "foto" del POS, otra hoja).
  var descuento = null;
  if (receta_id && (area === 'churrasca' || area === 'cocina') && (tipo === 'charola' || tipo === 'reposicion' || tipo === 'merma')) {
    descuento = _aplicarDescuentoCharola(u.empresa_id, sucursal_id, fecha, receta_id, cantidad, newId, u.email, tipo);
  }
  return { ok:true, id: newId, descuento: descuento };
}

// Helper: aplica descuento de ingredientes a InventarioChurrasca cuando una charola se sirve con base en una receta.
// Recibe receta_id, cantidad de charolas, fecha, tipo (charola/reposicion/merma).
// Calcula los ingredientes a descontar y los suma a la salida del día.
// El prefijo del actualizado_por permite distinguir descuentos por venta vs. por pérdida en auditoría.
function _aplicarDescuentoCharola(empresaId, sucursalId, fecha, recetaId, cantidadCharolas, charolaId, userEmail, tipo) {
  var prefijoOrigen = tipo === 'merma' ? 'merma:' : 'charola:';
  // 1. Buscar receta y sus líneas
  var receta = rowsToObjects(getSheet('Recetas')).find(function(r){ return r.id === recetaId && r.empresa_id === empresaId; });
  if (!receta) return { ok:false, error:'Receta no encontrada', descontados: 0 };
  var rendimiento = Number(receta.rendimiento) || 1;  // ej. 1 charola = N porciones según receta
  var lineas = rowsToObjects(getSheet('IngredientesReceta')).filter(function(ir){ return ir.receta_id === recetaId; });
  if (!lineas.length) return { ok:false, error:'Receta sin ingredientes', descontados: 0 };

  // 2. Verificar config de inventario churrasca para saber cuáles ingredientes inventariar
  var config = rowsToObjects(getSheet('InventarioChurrascaConfig')).filter(function(c){
    return c.empresa_id === empresaId && (c.activo === true || c.activo === 'TRUE' || c.activo === 'true');
  });
  var ingsInventariar = new Set(config.map(function(c){ return c.ingrediente_id; }));

  // 3. Para cada línea de la receta, si el ingrediente está inventariado, descontar (salida += cantidad × N charolas / rendimiento)
  var sh = getSheet('InventarioChurrasca');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = rowsToObjects(sh);
  var diaSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date(fecha).getDay()];
  var d = new Date(fecha);
  var dUtc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = dUtc.getUTCDay() || 7;
  dUtc.setUTCDate(dUtc.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(dUtc.getUTCFullYear(), 0, 1));
  var weekNum = Math.ceil(((dUtc - yearStart) / 86400000 + 1) / 7);
  var semanaIso = dUtc.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');

  var ahora = new Date();
  var descontados = [];
  lineas.forEach(function(linea){
    if (!linea.ingrediente_id) return;  // sub-recetas se ignoran para descuento (TODO: recursivo en futuro)
    if (!ingsInventariar.has(linea.ingrediente_id)) return;  // no se inventaría
    var cantPorPorcion = Number(linea.cantidad) / rendimiento;
    var cantTotal = cantPorPorcion * cantidadCharolas;
    if (!cantTotal || cantTotal <= 0) return;

    // Buscar fila del día en InventarioChurrasca
    var fila = rows.find(function(r){
      return r.empresa_id === empresaId && r.ingrediente_id === linea.ingrediente_id && r.fecha === fecha;
    });
    if (fila) {
      // Sumar a salida existente
      var colSal = headers.indexOf('salida') + 1;
      var nuevaSalida = (Number(fila.salida) || 0) + cantTotal;
      sh.getRange(fila._row, colSal).setValue(Number(nuevaSalida.toFixed(4)));
      var colAct = headers.indexOf('actualizado_at') + 1;
      var colActPor = headers.indexOf('actualizado_por') + 1;
      if (colAct > 0) sh.getRange(fila._row, colAct).setValue(ahora);
      if (colActPor > 0) sh.getRange(fila._row, colActPor).setValue(prefijoOrigen + charolaId);
      // Propagar herencia
      _propagarHerenciaIngrediente(empresaId, linea.ingrediente_id, fecha);
    } else {
      // Crear fila nueva
      var fila2 = {};
      headers.forEach(function(h){ fila2[h] = ''; });
      Object.assign(fila2, {
        id: uuid(), empresa_id: empresaId, sucursal_id: sucursalId,
        semana_iso: semanaIso, fecha: fecha, dia_semana: diaSemana,
        ingrediente_id: linea.ingrediente_id,
        inv_inicial: 0, entrada: 0, salida: Number(cantTotal.toFixed(4)),
        alerta_consumo: false,
        responsable_email: userEmail,
        actualizado_at: ahora, actualizado_por: prefijoOrigen + charolaId
      });
      sh.appendRow(headers.map(function(h){ return fila2[h]; }));
    }
    descontados.push({ ingrediente_id: linea.ingrediente_id, cantidad: cantTotal });
  });

  // Marcar la charola como descuento_aplicado=true
  var shCh = getSheet('Charolas');
  var headersCh = shCh.getRange(1, 1, 1, shCh.getLastColumn()).getValues()[0];
  var colDescAplic = headersCh.indexOf('descuento_aplicado') + 1;
  if (colDescAplic > 0) {
    var rowsCh = rowsToObjects(shCh);
    var charola = rowsCh.find(function(c){ return c.id === charolaId; });
    if (charola) shCh.getRange(charola._row, colDescAplic).setValue(true);
  }

  return { ok: true, descontados: descontados.length, lineas: descontados };
}
function handleCharolasDelete(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!p.id) return { ok:false, error:'id requerido' };
  var sheet = getSheet('Charolas');
  var c = rowsToObjects(sheet).find(function(x){ return x.id === p.id && x.empresa_id === u.empresa_id; });
  if (!c) return { ok:false, error:'Charola no encontrada' };
  var rol = String(u.rol || '').toLowerCase();
  if (['admin','auditoria'].indexOf(rol) === -1 && c.responsable_email !== u.email) {
    return { ok:false, error:'Solo puedes borrar tus propios registros' };
  }
  sheet.deleteRow(c._row);
  return { ok:true };
}

// =============== Reservas ===============
// Token determinista de cancelación: deriva de id+telefono+fecha+SALT.
// Cliente sin saber esos 3 datos + el SALT del servidor no puede cancelar reservas ajenas.
function tokenCancelacion(reserva) {
  var raw = String(reserva.id) + '|' + String(reserva.telefono || '') + '|' + fechaToString(reserva.fecha_reserva) + '|cancel';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw + SALT);
  return Utilities.base64EncodeWebSafe(bytes).slice(0, 24);
}
// Endpoint público: lee los datos de UNA reserva con id + token de cancelación.
// Retorna info amigable para mostrar al cliente en `?p=mireserva`.
function handleReservaPublicaGet(p) {
  var id = String(p.id || '').trim();
  var tok = String(p.t || '').trim();
  if (!id || !tok) return { ok:false, error:'Faltan parámetros' };
  var r = rowsToObjects(getSheet('Reservas')).find(function(x){ return x.id === id; });
  if (!r) return { ok:false, error:'Reserva no encontrada' };
  if (tokenCancelacion(r) !== tok) return { ok:false, error:'Link inválido' };
  // Empresa para mostrar nombre
  var emp = rowsToObjects(getSheet('Empresas')).find(function(e){ return e.id === r.empresa_id; });
  return { ok:true, reserva: {
    id: r.id,
    empresa_nombre: emp ? emp.nombre : 'Restaurante',
    fecha_reserva: fechaToString(r.fecha_reserva),
    hora_reserva: horaToString(r.hora_reserva),
    nombre: r.nombre, telefono: r.telefono, comensales: r.comensales,
    adultos: parseInt(r.adultos, 10) || 0,
    ninos:   parseInt(r.ninos,   10) || 0,
    ninos_0_5:   parseInt(r.ninos_0_5,   10) || 0,
    ninos_6_10:  parseInt(r.ninos_6_10,  10) || 0,
    ninos_11mas: parseInt(r.ninos_11mas, 10) || 0,
    tercera: parseInt(r.tercera, 10) || 0,
    evento: r.evento, periquera: esActivo(r.periquera),
    alergias: r.alergias, escaleras: esActivo(r.escaleras),
    estado: r.estado, promo_nombre: String(r.promo_nombre || '')
  }};
}
// Endpoint público: cancela una reserva si faltan ≥30 minutos para la hora reservada.
function handleReservaPublicaCancel(p) {
  var id = String(p.id || '').trim();
  var tok = String(p.t || '').trim();
  if (!id || !tok) return { ok:false, error:'Faltan parámetros' };
  var sheet = getSheet('Reservas');
  var r = rowsToObjects(sheet).find(function(x){ return x.id === id; });
  if (!r) return { ok:false, error:'Reserva no encontrada' };
  if (tokenCancelacion(r) !== tok) return { ok:false, error:'Link inválido' };
  // Estados que no se pueden cancelar (ya está cancelada, no llegó, o ya llegó)
  var st = String(r.estado || '');
  if (st === 'cancelada') return { ok:false, error:'Esta reserva ya estaba cancelada' };
  if (st === 'no_llego')  return { ok:false, error:'Esta reserva ya fue marcada como no llegó' };
  if (st === 'llego')     return { ok:false, error:'Ya estás registrado como llegado al restaurante' };
  // Validar tiempo: ≥30 min antes de la hora reservada
  var fechaStr = fechaToString(r.fecha_reserva);
  var horaStr  = horaToString(r.hora_reserva);
  var dtReserva = new Date(fechaStr + 'T' + horaStr + ':00');
  var minutosFaltantes = Math.floor((dtReserva.getTime() - Date.now()) / 60000);
  if (minutosFaltantes < 30) {
    return { ok:false, error:'Ya no se puede cancelar online (debe ser al menos 30 min antes de la hora reservada). Por favor llama al restaurante.' };
  }
  // Cancelar: estado = cancelada
  sheet.getRange(r._row, 14).setValue('cancelada'); // columna 14 = estado
  return { ok:true, mensaje: 'Tu reserva fue cancelada. ¡Esperamos verte pronto!' };
}

// Endpoint público: crear reserva sin token (la web pública del cliente la usa)
function handleReservasCreate(p) {
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var empresa_id = String(data.empresa_id || '').trim();
  if (!empresa_id) return { ok:false, error:'empresa_id requerido' };
  var empresa = rowsToObjects(getSheet('Empresas')).find(function(e){ return e.id === empresa_id && esActivo(e.activa); });
  if (!empresa) return { ok:false, error:'Empresa no encontrada' };
  var sucursal_id = data.sucursal_id || ((rowsToObjects(getSheet('Sucursales')).find(function(s){ return s.empresa_id === empresa_id && esActivo(s.activa); }) || {}).id || '');
  var fechaRes = String(data.fecha_reserva || '').trim();
  var horaRes  = String(data.hora_reserva  || '').trim();
  var nombre   = String(data.nombre        || '').trim();
  var telefono = String(data.telefono      || '').trim();
  var adultos      = parseInt(data.adultos, 10) || 0;
  var ninos_0_5    = parseInt(data.ninos_0_5,   10) || 0;
  var ninos_6_10   = parseInt(data.ninos_6_10,  10) || 0;
  var ninos_11mas  = parseInt(data.ninos_11mas, 10) || 0;
  var ninos        = ninos_0_5 + ninos_6_10 + ninos_11mas; // total niños = suma de subgrupos
  if (!ninos) ninos = parseInt(data.ninos, 10) || 0; // fallback si llega solo el total
  var tercera      = parseInt(data.tercera, 10) || 0;
  var comensales = adultos + ninos + tercera;
  if (!comensales) comensales = parseInt(data.comensales, 10) || 0;
  if (!fechaRes || !horaRes || !nombre || !telefono || !comensales) {
    return { ok:false, error:'Faltan datos: fecha, hora, nombre, teléfono y # personas' };
  }
  // Si pidió periquera, debe haber al menos 1 niño en el rango 0-5
  if (!!data.periquera && ninos_0_5 < 1) {
    return { ok:false, error:'La periquera es para un bebé/niño 0-5 años. Indica al menos 1 niño en ese rango.' };
  }
  // Validar slot: la hora debe estar alineada al slot configurado (default 15 min)
  var slotMin = leerConfigInt(empresa_id, sucursal_id, 'slot_minutos', SLOT_MINUTOS_DEFAULT);
  var horaParts = horaRes.split(':');
  if (horaParts.length < 2 || isNaN(parseInt(horaParts[1], 10)) || parseInt(horaParts[1], 10) % slotMin !== 0) {
    return { ok:false, error:'Las reservaciones se hacen en slots cada ' + slotMin + ' minutos (ej. 13:00, 13:15, 13:30...). Selecciona una hora válida.' };
  }
  // Validar horario operativo + determinar servicio
  var servicioInfo = obtenerServicioParaHora(empresa_id, sucursal_id, fechaRes, horaRes);
  if (!servicioInfo) {
    return { ok:false, error:'Esa hora está fuera del horario de operación. Por favor revisa los horarios disponibles para el día seleccionado.' };
  }
  // Validar bloqueo manual del día
  var estadoBloqueo = obtenerEstadoReservas(empresa_id, sucursal_id, fechaRes);
  if (estadoBloqueo.bloqueado_manual) {
    return { ok:false, error:'Por el momento las reservaciones para esta fecha están pausadas. Te invitamos a llamar al restaurante o intentar más tarde.', bloqueado: true };
  }
  // Validar cupo del SERVICIO específico
  var estadoRes = obtenerEstadoReservas(empresa_id, sucursal_id, fechaRes, servicioInfo.servicio);
  if (estadoRes.total_reservado + comensales > estadoRes.cupo_maximo) {
    return {
      ok: false,
      error: 'Por el momento tenemos cupo lleno en el horario seleccionado, sin embargo seguimos atendiendo conforme a llegada en el restaurante, te invitamos a visitarnos.',
      sin_cupo: true,
      servicio: servicioInfo.servicio
    };
  }
  // Grupos > umbral: NO se confirman automáticamente, pasan a "pendiente_confirmacion"
  var umbralGrupo = leerConfigInt(empresa_id, sucursal_id, 'umbral_grupo_grande', UMBRAL_GRUPO_GRANDE);
  var esGrupoGrande = comensales > umbralGrupo;
  var estadoInicial = esGrupoGrande ? 'pendiente_confirmacion' : 'creada';
  var newId = uuid();
  getSheet('Reservas').appendRow([
    newId, empresa_id, sucursal_id, fechaRes, horaRes, nombre, telefono, comensales,
    String(data.edades_ninos || ''), String(data.evento || ''),
    !!data.periquera, String(data.alergias || ''), !!data.escaleras,
    estadoInicial, new Date(), adultos, ninos, tercera,
    String(data.promo_id || ''), String(data.promo_nombre || ''),
    ninos_0_5, ninos_6_10, ninos_11mas
  ]);
  // Token de gestión para que el cliente pueda cancelar desde su link público
  var reservaParaToken = { id: newId, telefono: telefono, fecha_reserva: fechaRes };
  var tokenCancel = tokenCancelacion(reservaParaToken);
  var urlGestion = ScriptApp.getService().getUrl() + '?p=mireserva&id=' + encodeURIComponent(newId) + '&t=' + encodeURIComponent(tokenCancel);
  return {
    ok: true,
    id: newId,
    empresa_nombre: empresa.nombre,
    servicio: servicioInfo.servicio,
    grupo_grande: esGrupoGrande,
    mensaje_grupo: esGrupoGrande
      ? 'Recibimos tu solicitud para un grupo de ' + comensales + ' personas. Tu anfitrión se pondrá en contacto contigo para afinar detalles, o te enviará la confirmación de tu evento.'
      : '',
    url_gestion: urlGestion,
    token_cancel: tokenCancel
  };
}
// =============== Sucursales (CRUD) ===============
function handleSucursalesList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var sucursales = rowsToObjects(getSheet('Sucursales')).filter(function(s){ return s.empresa_id === u.empresa_id; });
  return { ok:true, sucursales: sucursales.map(function(s){
    return { id:s.id, nombre:s.nombre, direccion:s.direccion || '', activa: esActivo(s.activa) };
  })};
}
function handleSucursalesCreate(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin puede crear sucursales' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var nombre = String(data.nombre || '').trim();
  if (!nombre) return { ok:false, error:'Nombre requerido' };
  var newId = uuid();
  getSheet('Sucursales').appendRow([newId, u.empresa_id, nombre, String(data.direccion || ''), true]);
  return { ok:true, id: newId };
}
function handleSucursalesUpdate(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  if (!data.id) return { ok:false, error:'id requerido' };
  var sheet = getSheet('Sucursales');
  var existing = rowsToObjects(sheet).find(function(s){ return s.id === data.id && s.empresa_id === u.empresa_id; });
  if (!existing) return { ok:false, error:'Sucursal no encontrada' };
  var row = existing._row;
  if (data.nombre !== undefined && String(data.nombre).trim()) sheet.getRange(row, 3).setValue(String(data.nombre).trim());
  if (data.direccion !== undefined) sheet.getRange(row, 4).setValue(String(data.direccion));
  if (data.activa !== undefined) sheet.getRange(row, 5).setValue(!!data.activa);
  return { ok:true, id: existing.id };
}

// =============== Tarifas (CRUD + vigente por fecha) ===============
function handleTarifasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var sucursal_id = p.sucursal_id || '';
  var tarifas = rowsToObjects(getSheet('Tarifas')).filter(function(t){
    if (t.empresa_id !== u.empresa_id) return false;
    if (sucursal_id && t.sucursal_id !== sucursal_id) return false;
    return true;
  });
  // Ordenar por fecha_desde descendente (más reciente arriba)
  tarifas.sort(function(a,b){ return String(fechaToString(b.fecha_desde)).localeCompare(String(fechaToString(a.fecha_desde))); });
  return { ok:true, tarifas: tarifas.map(function(t){
    return {
      empresa_id: t.empresa_id, sucursal_id: t.sucursal_id || '',
      fecha_desde: fechaToString(t.fecha_desde),
      servicio:    String(t.servicio    || ''),
      dias_semana: String(t.dias_semana || ''),
      hora_desde:  horaToString(t.hora_desde),
      hora_hasta:  horaToString(t.hora_hasta),
      t_adulto: parseFloat(t.t_adulto) || 0,
      t_nino:   parseFloat(t.t_nino)   || 0,
      t_3era:   parseFloat(t.t_3era)   || 0
    };
  })};
}
// Crea o sobreescribe una tarifa (upsert por (empresa, sucursal, fecha_desde, servicio))
function handleTarifasUpsert(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var fecha_desde = String(data.fecha_desde || '').trim();
  if (!fecha_desde) return { ok:false, error:'fecha_desde requerida' };
  var sucursal_id = String(data.sucursal_id || '');
  var servicio    = String(data.servicio    || '').trim();
  var dias_semana = String(data.dias_semana || '').trim();
  var hora_desde  = String(data.hora_desde  || '00:00').trim();
  var hora_hasta  = String(data.hora_hasta  || '23:59').trim();
  var t_adulto = parseFloat(data.t_adulto) || 0;
  var t_nino   = parseFloat(data.t_nino)   || 0;
  var t_3era   = parseFloat(data.t_3era)   || 0;
  var sheet = getSheet('Tarifas');
  var existing = rowsToObjects(sheet).find(function(t){
    if (t.empresa_id !== u.empresa_id) return false;
    if (String(t.sucursal_id || '') !== sucursal_id) return false;
    if (fechaToString(t.fecha_desde) !== fecha_desde) return false;
    return String(t.servicio || '') === servicio;
  });
  if (existing) {
    var row = existing._row;
    sheet.getRange(row, 5).setValue(dias_semana);
    sheet.getRange(row, 6).setValue(hora_desde);
    sheet.getRange(row, 7).setValue(hora_hasta);
    sheet.getRange(row, 8).setValue(t_adulto);
    sheet.getRange(row, 9).setValue(t_nino);
    sheet.getRange(row, 10).setValue(t_3era);
    return { ok:true, action:'updated' };
  }
  // Prefijar con apóstrofe: fuerza texto en Sheets (sino convierte "5,6,7" a fecha "5,6,2007").
  // El apóstrofe no se guarda en el contenido, solo es una directiva al parser.
  sheet.appendRow([u.empresa_id, sucursal_id, fecha_desde, servicio,
                   "'" + dias_semana, "'" + hora_desde, "'" + hora_hasta,
                   t_adulto, t_nino, t_3era]);
  return { ok:true, action:'created' };
}
// Borrar una tarifa (por empresa+sucursal+fecha_desde+servicio)
function handleTarifasDelete(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var fecha_desde = String(data.fecha_desde || '').trim();
  if (!fecha_desde) return { ok:false, error:'fecha_desde requerida' };
  var sucursal_id = String(data.sucursal_id || '');
  var servicio    = String(data.servicio    || '').trim();
  var sheet = getSheet('Tarifas');
  var existing = rowsToObjects(sheet).find(function(t){
    if (t.empresa_id !== u.empresa_id) return false;
    if (String(t.sucursal_id || '') !== sucursal_id) return false;
    if (fechaToString(t.fecha_desde) !== fecha_desde) return false;
    return String(t.servicio || '') === servicio;
  });
  if (!existing) return { ok:false, error:'Tarifa no encontrada' };
  sheet.deleteRow(existing._row);
  return { ok:true, action:'deleted' };
}
// Tarifa vigente para una fecha + servicio (o día+hora si no se especifica servicio).
// Devuelve la más reciente con fecha_desde <= fecha.
// Si se pasa `servicio`, filtra por ese servicio.
// Si NO se pasa servicio pero sí `hora`, filtra por día de la semana de `fecha` + rango horario.
function handleTarifaVigente(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var fecha = String(p.fecha || fechaToString(new Date())).trim();
  var sucursal_id = p.sucursal_id || '';
  var servicio    = String(p.servicio || '').trim();
  var hora        = String(p.hora     || '').trim(); // "HH:mm"
  // Día de la semana 1=Lun..7=Dom (a partir de la fecha)
  var d = new Date(fecha + 'T12:00:00');
  var dia = d.getDay(); dia = dia === 0 ? 7 : dia;

  var tarifas = rowsToObjects(getSheet('Tarifas')).filter(function(t){
    if (t.empresa_id !== u.empresa_id) return false;
    if (sucursal_id && String(t.sucursal_id || '') !== sucursal_id) return false;
    if (fechaToString(t.fecha_desde) > fecha) return false;
    if (servicio) {
      if (String(t.servicio || '') !== servicio) return false;
    } else if (hora) {
      // Filtrar por día de la semana incluido y hora dentro del rango
      var diasArr = String(t.dias_semana || '').split(',').map(function(s){ return parseInt(s.trim(),10); });
      if (diasArr.indexOf(dia) === -1) return false;
      var hd = horaToString(t.hora_desde) || '00:00';
      var hh = horaToString(t.hora_hasta) || '23:59';
      if (hora < hd || hora > hh) return false;
    }
    return true;
  });
  // Ordenar por fecha_desde descendente (la más reciente vigente gana)
  tarifas.sort(function(a,b){ return String(fechaToString(b.fecha_desde)).localeCompare(String(fechaToString(a.fecha_desde))); });
  if (!tarifas.length) return { ok:true, tarifa: null };
  var t = tarifas[0];
  return { ok:true, tarifa: {
    fecha_desde: fechaToString(t.fecha_desde),
    servicio:    String(t.servicio    || ''),
    dias_semana: String(t.dias_semana || ''),
    hora_desde:  horaToString(t.hora_desde),
    hora_hasta:  horaToString(t.hora_hasta),
    t_adulto: parseFloat(t.t_adulto) || 0,
    t_nino:   parseFloat(t.t_nino)   || 0,
    t_3era:   parseFloat(t.t_3era)   || 0
  }};
}

// =============== Configuración (lectura) ===============
// Match de sucursal: si la fila tiene sucursal_id vacío, aplica a CUALQUIER sucursal
// de la empresa (global). Si tiene sucursal_id concreto, solo a esa sucursal.
function matchSucursal(filaSuc, querySuc) {
  var fs = String(filaSuc || '');
  var qs = String(querySuc || '');
  if (fs === '') return true;     // fila global → aplica siempre
  if (qs === '') return true;     // query global → acepta cualquier fila
  return fs === qs;               // ambas concretas → match exacto
}
function leerConfig(empresa_id, sucursal_id, clave, defaultValor) {
  try {
    var cf = getSheet('Configuracion');
    if (!cf) return defaultValor;
    var row = rowsToObjects(cf).find(function(c){
      if (c.empresa_id !== empresa_id) return false;
      if (!matchSucursal(c.sucursal_id, sucursal_id)) return false;
      return String(c.clave) === clave;
    });
    if (!row) return defaultValor;
    var v = String(row.valor == null ? '' : row.valor);
    return v === '' ? defaultValor : v;
  } catch(e) { return defaultValor; }
}
function leerConfigInt(empresa_id, sucursal_id, clave, defaultNum) {
  var v = leerConfig(empresa_id, sucursal_id, clave, '');
  var n = parseInt(v, 10);
  return isNaN(n) ? defaultNum : n;
}

// =============== Horarios operativos ===============
// Devuelve {servicio, hora_apertura, hora_cierre} si la hora cae dentro de algún servicio
// activo del día; null si está fuera de operación.
function obtenerServicioParaHora(empresa_id, sucursal_id, fecha, hora) {
  var d = new Date(fecha + 'T12:00:00');
  var dia = d.getDay(); dia = dia === 0 ? 7 : dia; // 1=Lun..7=Dom
  var sh = getSheet('Horarios');
  if (!sh) return null;
  var match = rowsToObjects(sh).find(function(h){
    if (h.empresa_id !== empresa_id) return false;
    if (!matchSucursal(h.sucursal_id, sucursal_id)) return false;
    if (parseInt(h.dia_semana, 10) !== dia) return false;
    if (!esActivo(h.activo)) return false;
    var ha = horaToString(h.hora_apertura);
    var hc = horaToString(h.hora_cierre);
    return hora >= ha && hora <= hc;
  });
  if (!match) return null;
  return {
    servicio:      String(match.servicio || ''),
    hora_apertura: horaToString(match.hora_apertura),
    hora_cierre:   horaToString(match.hora_cierre)
  };
}
// Devuelve los servicios activos del día (ej. "Desayuno" + "Comida" para fines de semana).
function obtenerServiciosDelDia(empresa_id, sucursal_id, fecha) {
  var d = new Date(fecha + 'T12:00:00');
  var dia = d.getDay(); dia = dia === 0 ? 7 : dia;
  var sh = getSheet('Horarios');
  if (!sh) return [];
  return rowsToObjects(sh).filter(function(h){
    if (h.empresa_id !== empresa_id) return false;
    if (!matchSucursal(h.sucursal_id, sucursal_id)) return false;
    if (parseInt(h.dia_semana, 10) !== dia) return false;
    return esActivo(h.activo);
  }).map(function(h){
    return {
      servicio:      String(h.servicio || ''),
      hora_apertura: horaToString(h.hora_apertura),
      hora_cierre:   horaToString(h.hora_cierre)
    };
  });
}

// =============== Estado de reservas (cupo POR SERVICIO + bloqueo) ===============
// Si recibe `servicio`, calcula cupo de ese servicio específico.
// Si no, devuelve total del día (compatibilidad con UI vieja).
function obtenerEstadoReservas(empresa_id, sucursal_id, fecha, servicio) {
  var cupoMax = leerConfigInt(empresa_id, sucursal_id, 'cupo_por_servicio', CUPO_POR_SERVICIO_DEFAULT);
  // Filtrar reservas activas del día (no canceladas/no_llego)
  var reservasDia = rowsToObjects(getSheet('Reservas')).filter(function(r){
    if (r.empresa_id !== empresa_id) return false;
    if (sucursal_id && r.sucursal_id !== sucursal_id) return false;
    if (fechaToString(r.fecha_reserva) !== fecha) return false;
    var st = String(r.estado || '');
    return st !== 'cancelada' && st !== 'no_llego';
  });
  // Si filtramos por servicio, contar solo reservas cuya hora caiga en ese servicio
  var reservasContadas = reservasDia;
  if (servicio) {
    reservasContadas = reservasDia.filter(function(r){
      var hr = horaToString(r.hora_reserva);
      var svc = obtenerServicioParaHora(empresa_id, sucursal_id, fecha, hr);
      return svc && svc.servicio === servicio;
    });
  }
  var total = 0;
  reservasContadas.forEach(function(r){ total += parseInt(r.comensales, 10) || 0; });
  // Bloqueo manual de la fecha
  var bloqueoSheet = getSheet('ReservasBloqueo');
  var bloqueo = bloqueoSheet ? rowsToObjects(bloqueoSheet).find(function(b){
    if (b.empresa_id !== empresa_id) return false;
    if (sucursal_id && b.sucursal_id !== sucursal_id) return false;
    return fechaToString(b.fecha) === fecha;
  }) : null;
  var bloqueadoManual = bloqueo ? esActivo(bloqueo.bloqueado) : false;
  var motivo = bloqueo ? String(bloqueo.motivo || '') : '';
  var cupoLleno = total >= cupoMax;
  return {
    servicio: servicio || '',
    cupo_maximo: cupoMax,
    total_reservado: total,
    disponible: Math.max(0, cupoMax - total),
    bloqueado_manual: bloqueadoManual,
    motivo_bloqueo: motivo,
    cupo_lleno: cupoLleno,
    bloqueado: bloqueadoManual || cupoLleno
  };
}

// Endpoint público: estado de reservas (la web pública lo consulta antes de mostrar el form).
// Devuelve: bloqueo manual del día, servicios disponibles del día (con horarios y cupo de cada uno),
// horario estelar, slot_minutos, umbral_grupo_grande.
function handleReservasStatus(p) {
  var empresa_id = String(p.empresa_id || '').trim();
  if (!empresa_id) return { ok:false, error:'empresa_id requerido' };
  var fecha = String(p.fecha || '').trim();
  if (!fecha) return { ok:false, error:'fecha requerida' };
  var sucursal_id = String(p.sucursal_id || '');
  if (!sucursal_id) {
    var s = rowsToObjects(getSheet('Sucursales')).find(function(x){ return x.empresa_id === empresa_id && esActivo(x.activa); });
    if (s) sucursal_id = s.id;
  }
  var estadoBase = obtenerEstadoReservas(empresa_id, sucursal_id, fecha); // sin servicio = global del día
  var servicios = obtenerServiciosDelDia(empresa_id, sucursal_id, fecha).map(function(s){
    var est = obtenerEstadoReservas(empresa_id, sucursal_id, fecha, s.servicio);
    return {
      servicio:      s.servicio,
      hora_apertura: s.hora_apertura,
      hora_cierre:   s.hora_cierre,
      cupo_maximo:   est.cupo_maximo,
      reservados:    est.total_reservado,
      disponible:    est.disponible,
      cupo_lleno:    est.cupo_lleno
    };
  });
  return {
    ok: true,
    estado: estadoBase, // compatibilidad con UI vieja
    servicios: servicios,
    horario_estelar_desde: leerConfig(empresa_id, sucursal_id, 'horario_estelar_desde', HORARIO_ESTELAR_DESDE),
    horario_estelar_hasta: leerConfig(empresa_id, sucursal_id, 'horario_estelar_hasta', HORARIO_ESTELAR_HASTA),
    slot_minutos:          leerConfigInt(empresa_id, sucursal_id, 'slot_minutos', SLOT_MINUTOS_DEFAULT),
    umbral_grupo_grande:   leerConfigInt(empresa_id, sucursal_id, 'umbral_grupo_grande', UMBRAL_GRUPO_GRANDE)
  };
}

// Endpoint para leer toda la configuración de la empresa+sucursal del usuario logueado.
// Devuelve un objeto plano: { cupo_por_servicio: '50', gerente_restaurante: '...', ... }.
function handleConfiguracionGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var sucursal_id = String(p.sucursal_id || '');
  var cf = getSheet('Configuracion');
  if (!cf) return { ok:true, config: {} };
  var rows = rowsToObjects(cf).filter(function(c){
    if (c.empresa_id !== u.empresa_id) return false;
    return matchSucursal(c.sucursal_id, sucursal_id);
  });
  var config = {};
  // Las globales (sucursal_id='') primero, las específicas sobrescriben
  rows.sort(function(a,b){ return String(a.sucursal_id||'').length - String(b.sucursal_id||'').length; });
  rows.forEach(function(r){ config[String(r.clave)] = String(r.valor == null ? '' : r.valor); });
  return { ok:true, config: config };
}
// Endpoint para que el admin actualice claves de configuración (multi-clave en un solo call).
function handleConfiguracionSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var sucursal_id = String(data.sucursal_id || '');
  var cf = getSheet('Configuracion');
  if (!cf) return { ok:false, error:'Hoja Configuracion no existe — corre setupConfiguracionFogueira() primero' };
  var existing = rowsToObjects(cf).filter(function(c){
    if (c.empresa_id !== u.empresa_id) return false;
    return String(c.sucursal_id || '') === sucursal_id;
  });
  var updates = data.config || {};
  var creadas = 0, actualizadas = 0;
  Object.keys(updates).forEach(function(clave){
    var valor = String(updates[clave] == null ? '' : updates[clave]);
    var found = existing.find(function(r){ return String(r.clave) === clave; });
    if (found) {
      cf.getRange(found._row, 4).setValue(valor);
      actualizadas++;
    } else {
      cf.appendRow([u.empresa_id, sucursal_id, clave, valor]);
      creadas++;
    }
  });
  return { ok:true, creadas: creadas, actualizadas: actualizadas };
}

// Lee las 3 claves de costo estimado por tipo de servicio desde Configuracion.
function handleCostoConfigGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  var cf = getSheet('Configuracion');
  var config = {};
  if (cf) {
    rowsToObjects(cf).filter(function(c){ return c.empresa_id === u.empresa_id; })
      .forEach(function(r){ config[String(r.clave)] = r.valor; });
  }
  return {
    ok: true,
    costos: {
      buffet:   parseFloat(config['costo_est_buffet']   || 0) || 0,
      desayuno: parseFloat(config['costo_est_desayuno'] || 0) || 0,
      comida:   parseFloat(config['costo_est_comida']   || 0) || 0
    }
  };
}

// Escribe las 3 claves de costo estimado. Permitido para admin y gerente_administrativo.
function handleCostoConfigSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','gerente_administrativo'])) return { ok:false, error:'Solo Admin o Gerente Administrativo' };
  var cf = getSheet('Configuracion');
  if (!cf) return { ok:false, error:'Hoja Configuracion no existe' };
  var campos = { buffet:'costo_est_buffet', desayuno:'costo_est_desayuno', comida:'costo_est_comida' };
  var updates = {};
  Object.keys(campos).forEach(function(k){
    if (p[k] !== undefined && p[k] !== null && p[k] !== '') {
      var v = parseFloat(p[k]);
      if (!isNaN(v) && v >= 0) updates[campos[k]] = String(v);
    }
  });
  if (!Object.keys(updates).length) return { ok:false, error:'Sin valores válidos para actualizar' };
  var existing = rowsToObjects(cf).filter(function(c){ return c.empresa_id === u.empresa_id; });
  var actualizadas = 0, creadas = 0;
  Object.keys(updates).forEach(function(clave){
    var valor = updates[clave];
    var found = existing.find(function(r){ return String(r.clave) === clave; });
    if (found) { cf.getRange(found._row, 4).setValue(valor); actualizadas++; }
    else { cf.appendRow([u.empresa_id, '', clave, valor]); creadas++; }
  });
  return { ok:true, actualizadas:actualizadas, creadas:creadas };
}

// Calcula el costo total de una ronda de servicio desde el recetario.
// Retorna costo_total: { desayuno, otros } en $ (sin dividir por comensales — el frontend divide).
// Filtro: 'desayuno' = categoria_culinaria = 'Desayuno'; 'otros' = todo lo demás.
// Solo recetas activas con montaje_buffet > 0.
function handleCostoRecetarioCalc(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  try {
    var ings = {};
    var shIng = getSheet('Ingredientes');
    if (shIng) {
      rowsToObjects(shIng).forEach(function(i){
        if (String(i.empresa_id) === String(u.empresa_id)) ings[String(i.id)] = i;
      });
    }
    var lineasPor = {};
    var shIR = getSheet('IngredientesReceta');
    if (shIR) {
      rowsToObjects(shIR).forEach(function(l){
        var rid = String(l.receta_id || '');
        if (!rid) return;
        if (!lineasPor[rid]) lineasPor[rid] = [];
        lineasPor[rid].push(l);
      });
    }
    var totalDesayuno = 0, totalOtros = 0, hayEstimados = false;
    var shRec = getSheet('Recetas');
    if (shRec) {
      rowsToObjects(shRec).forEach(function(r){
        if (String(r.empresa_id) !== String(u.empresa_id)) return;
        var activa = r.activa;
        if (activa === false || activa === 0 || String(activa) === 'false' || String(activa) === '0' || activa === '') return;
        var mb = parseFloat(r.montaje_buffet || '') || 0;
        if (!(mb > 0)) return;
        var rend = parseFloat(r.rendimiento || '') || 1;
        var costoReceta = 0;
        (lineasPor[String(r.id)] || []).forEach(function(l){
          if (!l.ingrediente_id) return;
          var ing = ings[String(l.ingrediente_id)];
          if (!ing) return;
          var pru = parseFloat(ing.precio_real_unitario || '') || parseFloat(ing.ultimo_costo || '') || 0;
          costoReceta += (parseFloat(l.cantidad || '') || 0) * pru * _unidadFactorBase(l.unidad, ing.unidad_base);
          var est = ing.ultimo_costo_estimado;
          if (est === true || est === 1 || String(est) === 'true' || String(est) === '1') hayEstimados = true;
        });
        var costoCharola = (costoReceta / rend) * mb;
        if (String(r.categoria_culinaria || '').toLowerCase() === 'desayuno') totalDesayuno += costoCharola;
        else totalOtros += costoCharola;
      });
    }
    return {
      ok: true,
      costo_total: {
        desayuno: Math.round(totalDesayuno * 100) / 100,
        otros:    Math.round(totalOtros    * 100) / 100
      },
      tiene_estimados: hayEstimados
    };
  } catch(e) {
    return { ok:false, error: String((e && e.message) || e) };
  }
}

// Endpoint para listar horarios operativos (admin/auditoría).
function handleHorariosList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var sucursal_id = String(p.sucursal_id || '');
  var sh = getSheet('Horarios');
  if (!sh) return { ok:true, horarios: [] };
  var horarios = rowsToObjects(sh).filter(function(h){
    if (h.empresa_id !== u.empresa_id) return false;
    return matchSucursal(h.sucursal_id, sucursal_id);
  });
  // Ordenar por día y hora apertura para que la UI los muestre en orden natural
  horarios.sort(function(a,b){
    var da = parseInt(a.dia_semana,10), db = parseInt(b.dia_semana,10);
    if (da !== db) return da - db;
    return horaToString(a.hora_apertura).localeCompare(horaToString(b.hora_apertura));
  });
  return { ok:true, horarios: horarios.map(function(h){
    return {
      sucursal_id:   String(h.sucursal_id || ''),
      dia_semana:    parseInt(h.dia_semana, 10),
      servicio:      String(h.servicio || ''),
      hora_apertura: horaToString(h.hora_apertura),
      hora_cierre:   horaToString(h.hora_cierre),
      activo:        esActivo(h.activo)
    };
  })};
}
// Reescribe TODOS los horarios de una empresa+sucursal en un solo call (más simple que CRUD por fila).
function handleHorariosSaveAll(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['admin'])) return { ok:false, error:'Solo admin' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var sucursal_id = String(data.sucursal_id || '');
  var horarios    = Array.isArray(data.horarios) ? data.horarios : [];
  var sh = getSheet('Horarios');
  if (!sh) return { ok:false, error:'Hoja Horarios no existe — corre setupConfiguracionFogueira() primero' };
  // Borrar filas existentes de esta empresa+sucursal (de abajo hacia arriba para no desfasar índices)
  var rowsAEliminar = rowsToObjects(sh).filter(function(h){
    if (h.empresa_id !== u.empresa_id) return false;
    return String(h.sucursal_id || '') === sucursal_id;
  }).sort(function(a,b){ return b._row - a._row; });
  rowsAEliminar.forEach(function(r){ sh.deleteRow(r._row); });
  // Asegurar formato texto en columnas E,F (horas)
  sh.getRange('E:F').setNumberFormat('@');
  // Insertar nuevos
  if (horarios.length) {
    var nuevas = horarios.map(function(h){
      return [
        u.empresa_id, sucursal_id,
        parseInt(h.dia_semana, 10) || 0,
        String(h.servicio || '').trim(),
        "'" + String(h.hora_apertura || '00:00'),
        "'" + String(h.hora_cierre   || '23:59'),
        h.activo === false ? false : true
      ];
    });
    sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, 7).setValues(nuevas);
  }
  return { ok:true, total: horarios.length };
}

// Endpoint host/admin: pausar/reactivar reservas para una fecha
function handleReservasBloqueoSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  var fecha = String(data.fecha || '').trim();
  if (!fecha) return { ok:false, error:'fecha requerida' };
  var bloqueado = !!data.bloqueado;
  var motivo = String(data.motivo || '').trim();
  var sucursal_id = data.sucursal_id || ((rowsToObjects(getSheet('Sucursales')).find(function(s){ return s.empresa_id === u.empresa_id; }) || {}).id || '');
  var sheet = asegurarHoja('ReservasBloqueo', ['id','empresa_id','sucursal_id','fecha','bloqueado','motivo','actualizado_at','actualizado_por']);
  var existing = rowsToObjects(sheet).find(function(b){
    if (b.empresa_id !== u.empresa_id) return false;
    if (b.sucursal_id !== sucursal_id) return false;
    return fechaToString(b.fecha) === fecha;
  });
  var ahora = new Date();
  if (existing) {
    var row = existing._row;
    sheet.getRange(row, 5).setValue(bloqueado);
    sheet.getRange(row, 6).setValue(motivo);
    sheet.getRange(row, 7).setValue(ahora);
    sheet.getRange(row, 8).setValue(u.email);
  } else {
    sheet.appendRow([uuid(), u.empresa_id, sucursal_id, fecha, bloqueado, motivo, ahora, u.email]);
  }
  return { ok:true, bloqueado: bloqueado };
}

// Endpoint público: lista promociones activas de la empresa (para mostrar en la web pública)
function handlePromocionesList(p) {
  var empresa_id = String(p.empresa_id || '').trim();
  if (!empresa_id) return { ok:false, error:'empresa_id requerido' };
  var promos = rowsToObjects(getSheet('Promociones')).filter(function(pr){
    return pr.empresa_id === empresa_id && esActivo(pr.activa);
  });
  return { ok:true, promociones: promos.map(function(pr){
    return {
      id: pr.id, nombre: pr.nombre, descripcion: pr.descripcion,
      dias_semana: String(pr.dias_semana || ''),
      hora_desde: horaToString(pr.hora_desde),
      hora_hasta: horaToString(pr.hora_hasta),
      personas_requeridas: parseInt(pr.personas_requeridas, 10) || 0,
      precio_normal: parseFloat(pr.precio_normal) || 0,
      precio_promo:  parseFloat(pr.precio_promo)  || 0
    };
  })};
}

// Endpoint público: info de empresa (para que la web pública sepa el nombre)
function handleEmpresaInfo(p) {
  var empresa_id = String(p.empresa_id || '').trim();
  if (!empresa_id) return { ok:false, error:'empresa_id requerido' };
  var empresa = rowsToObjects(getSheet('Empresas')).find(function(e){ return e.id === empresa_id && esActivo(e.activa); });
  if (!empresa) return { ok:false, error:'Empresa no encontrada' };
  var sucursales = rowsToObjects(getSheet('Sucursales')).filter(function(s){ return s.empresa_id === empresa_id && esActivo(s.activa); });
  return { ok:true, empresa: { id:empresa.id, nombre:empresa.nombre, plan:empresa.plan },
           sucursales: sucursales.map(function(s){ return {id:s.id, nombre:s.nombre}; }) };
}
// Listar reservas (host/admin/auditoría)
function handleReservasList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var fecha = p.fecha || '', sucursal_id = p.sucursal_id || '';
  // solo_futuras: ignora `fecha` y devuelve reservas con fecha_reserva > hoy
  // (ordenadas por fecha+hora ascendente para "Reservas futuras" del host).
  var soloFuturas = String(p.solo_futuras || '') === 'true';
  var hoy = fechaToString(new Date());
  return { ok:true, reservas: rowsToObjects(getSheet('Reservas')).filter(function(r){
    if (r.empresa_id !== u.empresa_id) return false;
    if (sucursal_id && r.sucursal_id !== sucursal_id) return false;
    var fr = fechaToString(r.fecha_reserva);
    if (soloFuturas) {
      if (fr <= hoy) return false;
      // Excluir canceladas y no_llego en la vista de futuras (no son útiles para el host)
      var st = String(r.estado || '');
      if (st === 'cancelada' || st === 'no_llego') return false;
    } else if (fecha && fr !== fecha) {
      return false;
    }
    return true;
  }).map(function(r){
    return { id:r.id, fecha_reserva:fechaToString(r.fecha_reserva), hora_reserva:horaToString(r.hora_reserva),
             nombre:r.nombre, telefono:r.telefono, comensales:r.comensales,
             adultos: parseInt(r.adultos, 10) || 0,
             ninos:   parseInt(r.ninos,   10) || 0,
             ninos_0_5:   parseInt(r.ninos_0_5,   10) || 0,
             ninos_6_10:  parseInt(r.ninos_6_10,  10) || 0,
             ninos_11mas: parseInt(r.ninos_11mas, 10) || 0,
             tercera: parseInt(r.tercera, 10) || 0,
             edades_ninos:r.edades_ninos, evento:r.evento,
             periquera: esActivo(r.periquera), alergias:r.alergias, escaleras: esActivo(r.escaleras),
             estado:r.estado,
             promo_id: String(r.promo_id || ''),
             promo_nombre: String(r.promo_nombre || ''),
             url_gestion: ScriptApp.getService().getUrl() + '?p=mireserva&id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(tokenCancelacion(r)),
             creada_at: r.creada_at instanceof Date ? r.creada_at.toISOString() : (r.creada_at || '') };
  })};
}
// Conteo de reservas por día para un mes — alimenta la vista calendario del host.
// Devuelve { ok:true, mes:'YYYY-MM', dias: { 'YYYY-MM-DD': {n:<reservas no canceladas>, c:<comensales esperados>} } }
function handleReservasCalendario(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var mes = String(p.mes || '');                          // 'YYYY-MM'
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok:false, error:'Mes inválido (use YYYY-MM)' };
  var sucursal_id = p.sucursal_id || '';
  var dias = {};
  rowsToObjects(getSheet('Reservas')).forEach(function(r){
    if (r.empresa_id !== u.empresa_id) return;
    if (sucursal_id && r.sucursal_id !== sucursal_id) return;
    var fr = fechaToString(r.fecha_reserva);              // 'YYYY-MM-DD' o ''
    if (fr.slice(0,7) !== mes) return;
    var st = String(r.estado || 'creada');
    if (st === 'cancelada') return;                       // las canceladas no cuentan en el calendario
    if (!dias[fr]) dias[fr] = { n:0, c:0 };
    dias[fr].n++;
    if (st !== 'no_llego') dias[fr].c += parseInt(r.comensales, 10) || 0;
  });
  return { ok:true, mes: mes, dias: dias };
}
// Actualizar reserva (cambio estado, edición)
function handleReservasUpdate(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, ['host','admin','auditoria'])) return { ok:false, error:'Sin permisos' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch(e){ return { ok:false, error:'data inválido' }; }
  if (!data.id) return { ok:false, error:'id requerido' };
  var sheet = getSheet('Reservas');
  var existing = rowsToObjects(sheet).find(function(x){ return x.id === data.id && x.empresa_id === u.empresa_id; });
  if (!existing) return { ok:false, error:'Reserva no encontrada' };
  var row = existing._row;
  // Cols: 1 id · 2 empresa_id · 3 sucursal_id · 4 fecha · 5 hora · 6 nombre · 7 tel · 8 comensales
  // 9 edades_ninos · 10 evento · 11 periquera · 12 alergias · 13 escaleras · 14 estado · 15 creada_at
  // 16 adultos · 17 ninos · 18 tercera
  if (data.fecha_reserva !== undefined) sheet.getRange(row, 4).setValue(data.fecha_reserva);
  if (data.hora_reserva  !== undefined) sheet.getRange(row, 5).setValue(data.hora_reserva);
  if (data.nombre        !== undefined) sheet.getRange(row, 6).setValue(String(data.nombre));
  if (data.telefono      !== undefined) sheet.getRange(row, 7).setValue(String(data.telefono));
  if (data.comensales    !== undefined) sheet.getRange(row, 8).setValue(parseInt(data.comensales, 10) || 0);
  if (data.edades_ninos  !== undefined) sheet.getRange(row, 9).setValue(String(data.edades_ninos));
  if (data.evento        !== undefined) sheet.getRange(row, 10).setValue(String(data.evento));
  if (data.periquera     !== undefined) sheet.getRange(row, 11).setValue(!!data.periquera);
  if (data.alergias      !== undefined) sheet.getRange(row, 12).setValue(String(data.alergias));
  if (data.escaleras     !== undefined) sheet.getRange(row, 13).setValue(!!data.escaleras);
  if (data.estado        !== undefined) sheet.getRange(row, 14).setValue(String(data.estado));
  if (data.adultos       !== undefined) sheet.getRange(row, 16).setValue(parseInt(data.adultos, 10) || 0);
  if (data.ninos         !== undefined) sheet.getRange(row, 17).setValue(parseInt(data.ninos, 10) || 0);
  if (data.tercera       !== undefined) sheet.getRange(row, 18).setValue(parseInt(data.tercera, 10) || 0);
  return { ok:true, id: existing.id };
}

// =============== Router ===============
// Páginas servibles por ?p=<nombre>. La key es el query param, el value es el archivo .html.
var PAGINAS_HTML = {
  'reservar':      { archivo: 'reservar',      titulo: 'Reserva tu mesa' },
  'mireserva':     { archivo: 'mireserva',     titulo: 'Mi reservación · Fogueira' },
  'instructivo':   { archivo: 'instructivo',   titulo: 'Instructivo · Fogueira' },
  'examen':        { archivo: 'examen',        titulo: 'Examen de certificación · Fogueira' },
  'curso':         { archivo: 'curso',         titulo: 'Mi curso · Fogueira' },
  'historico':     { archivo: 'historico',     titulo: 'Histórico de Conciliaciones · Fogueira' },
  'acceso':        { archivo: 'acceso',        titulo: 'Iniciar sesión · Fogueira' },
  'inicio':        { archivo: 'inicio',        titulo: 'Inicio · Fogueira' },
  'bitacora':      { archivo: 'bitacora',      titulo: 'Bitácora del host · Fogueira' },
  'admin':         { archivo: 'admin',         titulo: 'Administración · Fogueira' },
  'charolas':      { archivo: 'charolas',      titulo: 'Charolas · Fogueira' },
  'conciliacion':  { archivo: 'conciliacion',  titulo: 'Conciliación · Fogueira' },
  'reservaciones': { archivo: 'reservaciones', titulo: 'Reservaciones · Fogueira' },
  // Módulo de recetas (Fase 2 — 2026-05-06)
  'recetas':            { archivo: 'recetas',            titulo: 'Recetas y costeo · Fogueira' },
  'reporte-recetario':  { archivo: 'reporte_recetario',  titulo: 'Reporte importación recetario · Fogueira' },
  // Inventario churrasca semanal estilo Marcos (Fase 4 — Sprint 2 — 2026-05-06)
  'inventario-churrasca': { archivo: 'inventario_churrasca', titulo: 'Inventario semanal · Churrasca · Fogueira' },
  // F3 — Importador SoftRestaurant 12 (v128 — 2026-05-08)
  'importar-sr12':       { archivo: 'importar_sr12',        titulo: 'Importar SR12 · Fogueira' },
  // Hub de importadores SR12 (existencias + compras)
  'importadores':        { archivo: 'importadores',         titulo: 'Importadores · Fogueira' },
  // F3 Fase C — Importador de compras SR12 (historial de precios reales) (v270)
  'importar-compras':    { archivo: 'importar_compras',     titulo: 'Importar Compras SR12 · Fogueira' },
  // Importador de cancelaciones SR12 (prueba independiente del POS) (v296)
  'importar-cancelaciones': { archivo: 'importar_cancelaciones', titulo: 'Importar Cancelaciones SR12 · Fogueira' },
  // Importador de ventas SR12 (productos vendidos · insumo del Cuadre de Barra) (v306)
  'importar-ventas':     { archivo: 'importar_ventas',      titulo: 'Importar Ventas SR12 · Fogueira' },
  // Manual: cómo bajar el reporte de Existencias costeado del SR12
  'manual-existencias':  { archivo: 'manual_existencias',   titulo: 'Cómo bajar el reporte SR12 · Fogueira' },
  // Manual: cómo bajar el reporte detallado de Compras del SR12 (v270)
  'manual-compras':      { archivo: 'manual_compras',       titulo: 'Cómo bajar Compras SR12 · Fogueira' },
  // Flujo visual de conciliación (v166 — 2026-05-15)
  'flujo':               { archivo: 'flujo',                titulo: 'Flujo de Conciliación · Fogueira' },
  // Dashboard de análisis de precios SR12 (v261)
  'reporte-precios':     { archivo: 'reporte_precios',      titulo: 'Análisis de Precios · Fogueira' },
  // Tablero Directivo del Gerente de Plaza (vigilancia de cancelaciones) — v276
  'direccion':           { archivo: 'direccion',            titulo: 'Tablero Directivo · Fogueira' },
  // F3 Fase C.2 — Curva de precios por proveedor (lee ComprasSR12) — v278
  'curva-precios':       { archivo: 'curva_precios',        titulo: 'Curva de Precios · Fogueira' },
  // Bandeja de mensajes dirigidos (dirección → responsable) — v313
  'mensajes':            { archivo: 'mensajes',             titulo: 'Mis mensajes · Fogueira' },
  // Sugeridor de vínculos SR12: empareja huérfanos con candidatos del catálogo POS — v321
  'sugerencias-sr12':    { archivo: 'sugerencias_sr12',     titulo: 'Sugerir vínculos SR12 · Fogueira' },
  // Control de Mermas por insumo (gemelo digital de la hoja del chef)
  'mermas':              { archivo: 'mermas',               titulo: 'Control de Mermas · Fogueira' },
  // Agenda de responsables del día (plantilla recurrente + excepciones) — Fase 1
  'agenda':              { archivo: 'agenda',               titulo: 'Agenda de responsables · Fogueira' },
  // Reporte de auditoría matutina: pendientes por persona + mensaje listo para WhatsApp
  'auditoria':           { archivo: 'auditoria',            titulo: 'Auditoría matutina · Fogueira' }
};
function doGet(e)  {
  var params = (e && e.parameter) ? e.parameter : {};
  var pagina = PAGINAS_HTML[params.p];
  if (pagina) {
    // Páginas que necesitan recibir query params inyectados server-side (location.search dentro del
    // iframe sandbox de Apps Script no es 100% confiable). Para estas usamos template.
    // - mireserva: recibe id + token de cancelación
    // - charolas: recibe area (cocina/churrasca) para filtrar la vista
    // - curso: recibe ?t=TOKEN (token de sesión) — fix para iOS y subdominios aislados
    if (params.p === 'mireserva' || params.p === 'charolas' || params.p === 'curso' || params.p === 'bitacora' || params.p === 'conciliacion' || params.p === 'recetas' || params.p === 'historico' || params.p === 'importar-sr12' || params.p === 'importadores' || params.p === 'importar-compras' || params.p === 'importar-cancelaciones' || params.p === 'importar-ventas' || params.p === 'manual-existencias' || params.p === 'manual-compras' || params.p === 'inventario-churrasca' || params.p === 'admin' || params.p === 'reporte-precios' || params.p === 'direccion' || params.p === 'curva-precios' || params.p === 'mensajes' || params.p === 'sugerencias-sr12' || params.p === 'mermas' || params.p === 'agenda' || params.p === 'auditoria') {
      var template = HtmlService.createTemplateFromFile(pagina.archivo);
      template.queryParams = params;
      return template.evaluate()
        .setTitle(pagina.titulo)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    return HtmlService.createHtmlOutputFromFile(pagina.archivo)
      .setTitle(pagina.titulo)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return handleRequest(e);
}
function doPost(e) { return handleRequest(e); }
function handleRequest(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (e && e.postData && e.postData.contents) {
    try { var body = JSON.parse(e.postData.contents); Object.keys(body).forEach(function(k){ params[k] = body[k]; }); } catch(err){}
  }
  var action = params.action || '', callback = params.callback || '', result;
  try {
    // Bloqueo duro: rol "observador" es read-only en backend.
    // El frontend ya oculta UI por CSS (clase role-observador), pero un técnico podría burlarlo.
    // Esta capa rechaza CUALQUIER mutación que un observador intente, sin importar qué
    // mande desde el frontend (Inspector, fetch directo, etc.). El throw lo captura el catch
    // de abajo y devuelve {ok:false, error:...} en formato estándar (incluye JSONP callback).
    if (ACCIONES_WRITE_OBSERVADOR_BLOQUEADAS[action]) {
      var _uObs = validarToken(params.token);
      if (_uObs && String(_uObs.rol||'').toLowerCase() === 'observador') {
        throw new Error('Tu rol observador es solo lectura. No puedes modificar datos.');
      }
    }
    switch(action) {
      case 'login':              result = handleLogin(params);             break;
      case 'logout':             result = handleLogout(params);            break;
      case 'cerrar_sesiones':    result = handleCerrarSesiones(params);    break;
      case 'me':                 result = handleMe(params);                break;
      case 'ping':               result = { ok:true, time: new Date().toISOString() }; break;
      case 'empresa_info':       result = handleEmpresaInfo(params);       break;
      case 'promociones_list':   result = handlePromocionesList(params);   break;
      case 'reservas_status':    result = handleReservasStatus(params);    break;
      case 'configuracion_get':  result = handleConfiguracionGet(params);  break;
      case 'configuracion_set':  result = handleConfiguracionSet(params);  break;
      case 'horarios_list':      result = handleHorariosList(params);      break;
      case 'horarios_save_all':  result = handleHorariosSaveAll(params);   break;
      case 'reservas_bloqueo_set': result = handleReservasBloqueoSet(params); break;
      case 'sucursales_list':    result = handleSucursalesList(params);    break;
      case 'sucursales_create':  result = handleSucursalesCreate(params);  break;
      case 'sucursales_update':  result = handleSucursalesUpdate(params);  break;
      case 'tarifas_list':       result = handleTarifasList(params);       break;
      case 'tarifas_upsert':     result = handleTarifasUpsert(params);     break;
      case 'tarifas_delete':     result = handleTarifasDelete(params);     break;
      case 'tarifa_vigente':     result = handleTarifaVigente(params);     break;
      case 'bitacora_list':      result = handleBitacoraList(params);      break;
      case 'bitacora_get':       result = handleBitacoraGet(params);       break;
      case 'bitacora_save':      result = handleBitacoraSave(params);      break;
      case 'bitacora_limpieza':  result = handleBitacoraLimpieza(params);  break;
      case 'bitacora_filas_list': result = handleBitacoraFilasList(params);  break;
      case 'bitacora_filas_sync': result = handleBitacoraFilasSync(params);  break;
      case 'bitacora_fila_save': result = handleBitacoraFilaSave(params);   break;
      case 'bitacora_fila_delete': result = handleBitacoraFilaDelete(params); break;
      case 'ocupacion_promedio_mesas': result = handleOcupacionPromedioMesas(params); break;
      case 'examen_estado':         result = handleExamenEstado(params);         break;
      case 'examen_iniciar':        result = handleExamenIniciar(params);        break;
      case 'examen_calificar':      result = handleExamenCalificar(params);      break;
      case 'certificaciones_list':  result = handleCertificacionesList(params);  break;
      case 'certificaciones_mias':  result = handleCertificacionesMias(params);  break;
      case 'certificacion_resetear':result = handleCertificacionResetear(params);break;
      case 'examen_preguntas_list': result = handleExamenPreguntasList(params);  break;
      case 'examen_pregunta_save':  result = handleExamenPreguntaSave(params);   break;
      case 'banco_preguntas_bootstrap': result = handleBancoPreguntasBootstrap(params); break;
      case 'banco_preguntas_actualizar': result = handleBancoPreguntasActualizar(params); break;
      case 'cursos_admin_list':     result = handleCursosAdminList(params);      break;
      case 'curso_modulo_save':     result = handleCursoModuloSave(params);      break;
      case 'curso_get':             result = handleCursoGet(params);             break;
      case 'curso_modulo_get':      result = handleCursoModuloGet(params);       break;
      case 'curso_modulo_completar':   result = handleCursoModuloCompletar(params);    break;
      case 'curso_desbloquear_modulo': result = handleCursoModuloDesbloquear(params);  break;
      case 'progreso_equipo':          result = handleProgresoEquipo(params);           break;
      case 'cursos_bootstrap':         result = handleCursosBootstrap(params);         break;
      case 'cursos_quiz_actualizar':   result = handleCursosQuizActualizar(params);    break;
      case 'sellos_list':        result = handleSellosList(params);        break;
      case 'sello_save':         result = handleSelloSave(params);         break;
      case 'sellos_estado':      result = handleSellosEstado(params);      break;
      case 'conciliacion_get':   result = handleConciliacionGet(params);   break;
      case 'conciliacion_save':  result = handleConciliacionSave(params);  break;
      case 'direccion_cancelaciones': result = handleDireccionCancelaciones(params); break;
      case 'direccion_cuadre_carne':  result = handleDireccionCuadreCarne(params);  break;
      case 'cancelacion_cuestionar':  result = handleCancelacionCuestionar(params);  break;
      case 'cancelacion_responder':   result = handleCancelacionResponder(params);   break;
      case 'precio_cuestionar':       result = handlePrecioCuestionar(params);       break;
      case 'precio_responder':        result = handlePrecioResponder(params);        break;
      case 'cancelacion_cuest_count': result = handleCancelacionCuestCount(params);   break;
      case 'precio_cuest_count':      result = handlePrecioCuestCount(params);        break;
      case 'conciliaciones_list':result = handleConciliacionesList(params);break;
      case 'conciliacion_auditoria_list': result = handleConciliacionAuditoriaList(params); break;
      case 'conciliacion_auditoria_get':  result = handleConciliacionAuditoriaGet(params);  break;
      case 'users_list':         result = handleUsersList(params);         break;
      case 'users_create':       result = handleUsersCreate(params);       break;
      case 'users_update':       result = handleUsersUpdate(params);       break;
      case 'password_change':    result = handlePasswordChange(params);    break;
      case 'gerentes_list':      result = handleGerentesList(params);      break;
      case 'charolas_list':      result = handleCharolasList(params);      break;
      case 'charolas_create':    result = handleCharolasCreate(params);    break;
      case 'charolas_delete':    result = handleCharolasDelete(params);    break;
      case 'merma_create':       result = handleMermaCreate(params);       break;
      case 'mermas_list':        result = handleMermasList(params);        break;
      case 'merma_delete':       result = handleMermaDelete(params);       break;
      // Agenda de responsables del día (Fase 1)
      case 'agenda_responsables_get': result = handleAgendaResponsablesGet(params); break;
      case 'agenda_responsables_set': result = handleAgendaResponsablesSet(params); break;
      case 'auditoria_matutina':      result = handleAuditoriaMatutina(params);     break;
      // Bot de Telegram (v367) — entrega del auditor matutino
      case 'telegram_webhook':          result = handleTelegramWebhook(params, e);      break;
      case 'telegram_estado':           result = handleTelegramEstado(params);          break;
      case 'pendiente_manual_add':      result = handlePendienteManualAdd(params);      break;
      case 'pendiente_manual_list':     result = handlePendienteManualList(params);     break;
      case 'pendiente_manual_resolver': result = handlePendienteManualResolver(params); break;
      case 'telegram_configurar':       result = handleTelegramConfigurar(params);      break;
      case 'telegram_enviar_auditoria': result = handleTelegramEnviarAuditoria(params); break;
      case 'telegram_prueba':           result = handleTelegramPrueba(params);          break;
      case 'telegram_desvincular':      result = handleTelegramDesvincular(params);     break;
      case 'telegram_reparar_webhook':  result = handleTelegramRepararWebhook(params);  break;
      case 'reservas_create':    result = handleReservasCreate(params);    break;
      case 'reserva_publica_get':    result = handleReservaPublicaGet(params);    break;
      case 'reserva_publica_cancel': result = handleReservaPublicaCancel(params); break;
      case 'reservas_list':      result = handleReservasList(params);      break;
      case 'reservas_calendario': result = handleReservasCalendario(params); break;
      case 'reservas_update':    result = handleReservasUpdate(params);    break;
      // Módulo de recetas (Fase 2 — 2026-05-06)
      // (Endpoints admin Sprint 1/1.5/1.5b retirados — cumplieron su propósito.)
      // === Inventario Churrasca (Fase 4 — Sprint 2) ===
      // (Endpoints admin temporales retirados — migración Charolas ya ejecutada)
      case 'inv_churrasca_config_list':    result = handleInvChurrascaConfigList(params);    break;
      case 'inv_churrasca_config_save':    result = handleInvChurrascaConfigSave(params);    break;
      case 'inv_churrasca_get_semana':     result = handleInvChurrascaGetSemana(params);     break;
      case 'inv_churrasca_save_celda':     result = handleInvChurrascaSaveCelda(params);     break;
      case 'inv_churrasca_autollenar_entradas': result = handleInvChurrascaAutollenarEntradas(params); break;
      case 'inv_churrasca_nueva_semana':   result = handleInvChurrascaNuevaSemana(params);   break;
      case 'inv_churrasca_setup_inicial':  result = handleInvChurrascaSetupInicial(params);  break;
      case 'recetario_config_get':  result = handleRecetarioConfigGet(params);  break;
      case 'recetario_config_set':  result = handleRecetarioConfigSet(params);  break;
      case 'recetario_bootstrap':          result = handleRecetarioBootstrap(params);         break;
      case 'recetario_bootstrap_desayuno': result = handleRecetarioBootstrapDesayuno(params); break;
      case 'recetario_bootstrap_espadas':  result = handleRecetarioBootstrapEspadas(params);  break;
      case 'bootstrap_insumos_barra':      result = handleBootstrapInsumosBarra(params);      break;
      case 'ingredientes_list':     result = handleIngredientesList(params);    break;
      case 'ingrediente_update':    result = handleIngredienteUpdate(params);   break;
      case 'ingrediente_fusionar':  result = handleIngredienteFusionar(params);  break;
      case 'ingrediente_repuntar_lineas': result = handleIngredienteRepuntarLineas(params); break;
      case 'recetas_list':          result = handleRecetasList(params);         break;
      case 'receta_get':            result = handleRecetaGet(params);           break;
      case 'receta_proponer_cambio':result = handleRecetaProponerCambio(params);break;
      case 'recetas_pendientes_list': result = handleRecetasPendientesList(params); break;
      case 'recetas_mis_propuestas':  result = handleRecetasMisPropuestas(params);  break;
      case 'receta_pendiente_get':  result = handleRecetaPendienteGet(params);  break;
      case 'receta_autorizar':      result = handleRecetaAutorizar(params);     break;
      case 'receta_rechazar':       result = handleRecetaRechazar(params);      break;
      case 'receta_foto_upload':    result = handleRecetaFotoUpload(params);    break;
      case 'recetario_reporte_rentabilidad': result = handleRecetarioReporteRentabilidad(params); break;
      case 'charolas_recetas_list': result = handleCharolasRecetasList(params); break;
      case 'charola_receta_set':    result = handleCharolaRecetaSet(params);    break;
      // F3 — Importador SR12 (v128)
      case 'sr12_config_get':            result = handleSr12ConfigGet(params);            break;
      case 'sr12_config_set':            result = handleSr12ConfigSet(params);            break;
      case 'sr12_import_dry_run':        result = handleSr12ImportDryRun(params);         break;
      case 'sr12_import_aplicar':        result = handleSr12ImportAplicar(params);        break;
      case 'sr12_importaciones_list':    result = handleSr12ImportacionesList(params);    break;
      case 'sr12_importacion_get':       result = handleSr12ImportacionGet(params);       break;
      case 'sr12_importacion_revertir':  result = handleSr12ImportacionRevertir(params);  break;
      case 'sr12_huerfanos_fogueira':    result = handleSr12HuerfanosFogueira(params);    break;
      case 'sr12_catalogo_list':         result = handleSr12CatalogoList(params);         break;
      case 'sr12_ingrediente_vincular':  result = handleSr12IngredienteVincular(params);  break;
      // v321 — Sugeridor de vínculos: candidatos SR12 para cada huérfano + descartar "no aplica"
      case 'sr12_sugerir_vinculos':      result = handleSr12SugerirVinculos(params);      break;
      case 'sr12_sugerencia_descartar':  result = handleSr12SugerenciaDescartar(params);  break;
      case 'sr12_vincular_alta_confianza': result = handleSr12VincularAltaConfianza(params); break;
      case 'ingredientes_diagnostico':   result = handleIngredientesDiagnostico(params);  break;
      case 'sr12_ventas_productos':      result = handleSr12VentasProductos(params);      break;
      case 'receta_vincular_venta':      result = handleRecetaVincularVenta(params);      break;
      case 'sr12_rescatar_precios_legacy': result = handleSr12RescatarPreciosLegacy(params); break;
      case 'sr12_diagnostico_schema':    result = handleSr12DiagnosticoSchema(params);    break;
      case 'sr12_migrar_schema_legacy':  result = handleSr12MigrarSchemaLegacy(params);   break;
      case 'sr12_backup_ingredientes':   result = handleSr12BackupIngredientes(params);   break;
      case 'sr12_restaurar_ingredientes': result = handleSr12RestaurarIngredientes(params); break;
      // v270 — F3 Fase C: importador de compras (historial de precios reales)
      case 'sr12_compras_importar':      result = handleSr12ComprasImportar(params);      break;
      case 'sr12_cancelaciones_importar': result = handleSr12CancelacionesImportar(params); break;
      case 'sr12_cancelaciones_resumen':  result = handleSr12CancelacionesResumen(params);  break;
      case 'sr12_cancelaciones_reset':    result = handleSr12CancelacionesReset(params);    break;
      // v306 — Importador de ventas SR12 (productos vendidos · insumo del Cuadre de Barra)
      case 'sr12_ventas_importar':        result = handleSr12VentasImportar(params);        break;
      case 'sr12_ventas_resumen':         result = handleSr12VentasResumen(params);         break;
      case 'barra_alerta_bajo_costo':     result = handleBarraAlertaBajoCosto(params);      break;
      case 'sr12_ventas_reset':           result = handleSr12VentasReset(params);           break;
      case 'direccion_ventas_barra':      result = handleDireccionVentasBarra(params);      break;
      case 'direccion_banderas_cierre':   result = handleDireccionBanderasCierre(params);    break;
      case 'direccion_resumen':           result = handleDireccionResumen(params);           break;
      case 'supervision_actividad':       result = handleSupervisionActividad(params);       break;
      // v313 — Mensajes dirigidos del Tablero
      case 'tablero_msg_destinatarios':   result = handleTableroMsgDestinatarios(params);    break;
      case 'tablero_msg_crear':           result = handleTableroMsgCrear(params);            break;
      case 'tablero_msg_responder':       result = handleTableroMsgResponder(params);        break;
      case 'tablero_msg_list':            result = handleTableroMsgList(params);             break;
      case 'tablero_msg_mis':             result = handleTableroMsgMis(params);              break;
      case 'tablero_msg_count':           result = handleTableroMsgCount(params);            break;
      case 'tablero_msg_ref_counts':      result = handleTableroMsgRefCounts(params);        break;
      // v315 — Aviso al que pregunta cuando le responden
      case 'tablero_respuestas_count':         result = handleTableroRespuestasCount(params);         break;
      case 'tablero_respuestas_marcar_vistas': result = handleTableroRespuestasMarcarVistas(params);   break;
      case 'direccion_cancelaciones_sr12': result = handleDireccionCancelacionesSr12(params); break;
      case 'sr12_compras_resumen':       result = handleSr12ComprasResumen(params);       break;
      // v144 — Branding multi-empresa
      case 'empresa_branding_get':           result = handleEmpresaBrandingGet(params);           break;
      case 'empresa_branding_seed_fogueira': result = handleEmpresaBrandingSeedFogueira(params);  break;
      // v250 — Costos operativos + margen
      case 'costo_config_get':     result = handleCostoConfigGet(params);     break;
      case 'costo_config_set':     result = handleCostoConfigSet(params);     break;
      case 'costo_recetario_calc': result = handleCostoRecetarioCalc(params); break;
      // v251 — Auditoría IA de recetas
      case 'receta_auditar_ia':         result = handleRecetaAuditarIA(params);         break;
      // v257 — Notificaciones rechazo chef
      case 'recetas_pendientes_notif':  result = handleRecetasPendientesNotif(params);  break;
      case 'receta_notif_marcar_visto': result = handleRecetaNotifMarcarVisto(params);  break;
      // v261 — Dashboard análisis de precios
      case 'sr12_reporte_precios':      result = handleSr12ReportePrecios(params);      break;
      case 'sr12_compras_curva':        result = handleSr12ComprasCurva(params);        break;
      case 'sr12_alertas_config_get':   result = handleSr12AlertasConfigGet(params);    break;
      case 'sr12_alertas_config_set':   result = handleSr12AlertasConfigSet(params);    break;
      // v264 — Informe ejecutivo con IA
      case 'sr12_generar_informe_ia':         result = handleSr12GenerarInformeIA(params);          break;
      // v267 — Aprobación de importaciones con alertas críticas
      case 'sr12_solicitar_aprobacion':       result = handleSr12SolicitarAprobacion(params);       break;
      case 'sr12_aprobaciones_list':          result = handleSr12AprobacionesList(params);          break;
      case 'sr12_aprobacion_aprobar':         result = handleSr12AprobacionAprobar(params);         break;
      case 'sr12_aprobacion_aprobar_aplicar': result = handleSr12AprobacionAprobarYAplicar(params); break;
      case 'sr12_aprobacion_rechazar':        result = handleSr12AprobacionRechazar(params);        break;
      case 'sr12_aprobaciones_count':         result = handleSr12AprobacionesCount(params);         break;
      // v265 — Justificaciones de variación de precios
      case 'sr12_justificaciones_solicitar':  result = handleSr12JustificacionesSolicitar(params);  break;
      case 'sr12_justificaciones_list':       result = handleSr12JustificacionesList(params);       break;
      case 'sr12_justificacion_set':          result = handleSr12JustificacionSet(params);          break;
      case 'sr12_justificaciones_count':      result = handleSr12JustificacionesPendientesCount(params); break;
      default:                   result = { ok:false, error:'Acción desconocida: ' + action };
    }
  } catch(err) { result = { ok:false, error: String((err && err.message) || err) }; }
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================================
// AGENDA DE RESPONSABLES DEL DÍA — Fase 1 (CRUD + expansión de plantilla)  · 2026-06-09
// Modelo: PLANTILLA recurrente (AgendaPatron) + EXCEPCIONES por día (AgendaExcepcion).
// Esta fase es SOLO la agenda: no cruza "quién operó" ni genera pendientes (eso es Fase 2).
// =====================================================================================
var AGENDA_PATRON_COLS = ['id','empresa_id','sucursal_id','area','usuario_email','usuario_nombre','tipo','dias_semana','vigente_desde','vigente_hasta','activo','creado_at','creado_por','actualizado_at','actualizado_por'];
var AGENDA_EXCEPCION_COLS = ['id','empresa_id','sucursal_id','fecha','area','usuario_email','usuario_nombre','tipo','estado','motivo','registrado_por','creado_at'];
var AGENDA_AREAS = ['cajera','cocina','churrasca','host'];
var AGENDA_ROLES_OPERATIVOS = ['cajera','cocina','churrasca','host']; // roles de personas que aparecen en la cuadrícula
var AGENDA_ROLES_EDITA = ['admin','gerente_administrativo','gerente_restaurante'];
var AGENDA_ROLES_LEE   = ['admin','gerente_administrativo','gerente_restaurante','auditoria'];

// Asegura la hoja AgendaPatron y deja la columna dias_semana como TEXTO (es_MX corrompe CSV "1,2,3").
function _agendaSheetPatron() {
  var sh = asegurarHoja('AgendaPatron', AGENDA_PATRON_COLS);
  try {
    var col = _getOrCreateCol(sh, 'dias_semana');
    sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  } catch (e) {}
  return sh;
}
function _agendaSheetExcepcion() { return asegurarHoja('AgendaExcepcion', AGENDA_EXCEPCION_COLS); }

// Genera un ID correlativo tipo PREFIJO-#### a partir de los IDs existentes en una lista.
function _agendaNextId(prefijo, filas) {
  var max = 0;
  (filas || []).forEach(function (f) {
    var m = String(f.id || '').match(new RegExp('^' + prefijo + '-(\\d+)$'));
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return prefijo + '-' + ('0000' + (max + 1)).slice(-4);
}

// Día de la semana (1=Lun..7=Dom) a partir de 'yyyy-MM-dd' SIN usar toISOString ni zonas.
function _agendaDowFromISO(iso) {
  var p = String(iso || '').split('-');
  if (p.length !== 3) return 0;
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  var js = d.getDay();          // 0=Dom..6=Sáb
  return js === 0 ? 7 : js;     // 1=Lun..7=Dom
}
function _agendaSumaDias(iso, n) {
  var p = String(iso || '').split('-');
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function _agendaDiasSet(csv) {
  var s = {};
  String(csv == null ? '' : csv).split(',').forEach(function (x) {
    var n = parseInt(String(x).trim(), 10);
    if (n >= 1 && n <= 7) s[n] = true;
  });
  return s;
}

// LECTURA — expande la plantilla en el rango y aplica las excepciones encima.
function handleAgendaResponsablesGet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, AGENDA_ROLES_LEE)) return { ok:false, error:'Sin permisos' };

  var desde = String(p.desde || '').trim(), hasta = String(p.hasta || '').trim();
  if (!desde) desde = diaLogicoRestaurante();
  if (!hasta) hasta = _agendaSumaDias(desde, 6);
  if (hasta < desde) { var t = hasta; hasta = desde; desde = t; }
  var areaFiltro = String(p.area || '').trim().toLowerCase();
  var sucFiltro  = String(p.sucursal_id || '').trim();

  // Personas: usuarios activos de la empresa con rol operativo (cajera/cocina/churrasca).
  var personas = rowsToObjects(getSheet('Usuarios')).filter(function (x) {
    return x.empresa_id === u.empresa_id && esActivo(x.activo) &&
           AGENDA_ROLES_OPERATIVOS.indexOf(String(x.rol || '').toLowerCase()) !== -1;
  }).map(function (x) {
    return { usuario_email: String(x.email || '').toLowerCase(), usuario_nombre: x.nombre || x.email, rol: String(x.rol || '').toLowerCase() };
  });

  var patronRaw = rowsToObjects(_agendaSheetPatron()).filter(function (r) {
    if (r.empresa_id !== u.empresa_id) return false;
    if (!_truthy(r.activo)) return false;
    if (!matchSucursal(r.sucursal_id, sucFiltro)) return false;
    if (areaFiltro && String(r.area || '').toLowerCase() !== areaFiltro) return false;
    return true;
  });
  var patron = patronRaw.map(function (r) {
    return {
      id: r.id, area: String(r.area || '').toLowerCase(),
      usuario_email: String(r.usuario_email || '').toLowerCase(), usuario_nombre: r.usuario_nombre || r.usuario_email,
      tipo: String(r.tipo || 'titular').toLowerCase(), dias_semana: String(r.dias_semana == null ? '' : r.dias_semana),
      vigente_desde: fechaToString(r.vigente_desde), vigente_hasta: fechaToString(r.vigente_hasta),
      _diasSet: _agendaDiasSet(r.dias_semana)
    };
  });

  var excepciones = rowsToObjects(_agendaSheetExcepcion()).filter(function (r) {
    if (r.empresa_id !== u.empresa_id) return false;
    if (!matchSucursal(r.sucursal_id, sucFiltro)) return false;
    var f = fechaToString(r.fecha);
    if (f < desde || f > hasta) return false;
    if (areaFiltro && String(r.area || '').toLowerCase() !== areaFiltro) return false;
    return true;
  }).map(function (r) {
    return {
      id: r.id, fecha: fechaToString(r.fecha), area: String(r.area || '').toLowerCase(),
      usuario_email: String(r.usuario_email || '').toLowerCase(), usuario_nombre: r.usuario_nombre || r.usuario_email,
      tipo: String(r.tipo || 'titular').toLowerCase(), estado: String(r.estado || '').toLowerCase(), motivo: r.motivo || ''
    };
  });

  // Recorre cada fecha del rango y arma las asignaciones.
  var dias = [];
  var iso = desde, guard = 0;
  while (iso <= hasta && guard < 400) {
    guard++;
    var dow = _agendaDowFromISO(iso);
    // clave persona+area → asignación (para que la excepción pise a la plantilla del mismo cupo)
    var mapa = {};
    patron.forEach(function (r) {
      if (!r._diasSet[dow]) return;
      if (r.vigente_desde && iso < r.vigente_desde) return;
      if (r.vigente_hasta && iso > r.vigente_hasta) return;
      mapa[r.area + '|' + r.usuario_email] = {
        area: r.area, usuario_email: r.usuario_email, usuario_nombre: r.usuario_nombre,
        tipo: r.tipo, estado: 'planeado', origen: 'plantilla'
      };
    });
    // Excepciones del día: descansa/falta quitan, cubre agrega.
    excepciones.forEach(function (e) {
      if (e.fecha !== iso) return;
      var k = e.area + '|' + e.usuario_email;
      if (e.estado === 'descansa' || e.estado === 'falta') {
        if (mapa[k]) { mapa[k].estado = e.estado; mapa[k].origen = 'excepcion'; mapa[k].motivo = e.motivo; }
        else mapa[k] = { area: e.area, usuario_email: e.usuario_email, usuario_nombre: e.usuario_nombre, tipo: e.tipo || 'titular', estado: e.estado, origen: 'excepcion', motivo: e.motivo };
      } else if (e.estado === 'cubre') {
        mapa[k] = { area: e.area, usuario_email: e.usuario_email, usuario_nombre: e.usuario_nombre, tipo: 'suplente', estado: 'cubre', origen: 'excepcion', motivo: e.motivo };
      }
    });
    var asignaciones = Object.keys(mapa).map(function (k) { return mapa[k]; });
    dias.push({ fecha: iso, asignaciones: asignaciones });
    iso = _agendaSumaDias(iso, 1);
  }

  return {
    ok: true,
    areas: AGENDA_AREAS,
    personas: personas,
    patron: patron.map(function (r) {
      return { id:r.id, area:r.area, usuario_email:r.usuario_email, usuario_nombre:r.usuario_nombre,
               tipo:r.tipo, dias_semana:r.dias_semana, vigente_desde:r.vigente_desde, vigente_hasta:r.vigente_hasta };
    }),
    dias: dias,
    puede_editar: rolEs(u, AGENDA_ROLES_EDITA)
  };
}

// ESCRITURA — dos modos dentro de data: { patron:[...] } y/o { excepcion:{...} }.
// Decisión Fase 1: el PATRÓN se hace UPSERT por id (con actualizado_at). Para "dar de baja"
// una asignación recurrente se manda activo:false (no se borra el histórico de la fila).
// No se cierra-y-recrea con vigente_hasta en esta fase (más simple y suficiente para el CRUD);
// los campos vigente_desde/hasta quedan disponibles para acotar manualmente cuando se requiera.
function handleAgendaResponsablesSet(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, AGENDA_ROLES_EDITA)) return { ok:false, error:'Sin permisos para editar la agenda' };
  var data; try { data = JSON.parse(p.data || '{}'); } catch (e) { return { ok:false, error:'data inválido' }; }

  var ultimoId = '';

  // ----- Modo PATRÓN (arreglo de filas a upsert/baja) -----
  if (data.patron) {
    var filasPatron = Array.isArray(data.patron) ? data.patron : [data.patron];
    var shP = _agendaSheetPatron();
    var existentes = rowsToObjects(shP);
    for (var i = 0; i < filasPatron.length; i++) {
      var d = filasPatron[i] || {};
      var area = String(d.area || '').toLowerCase();
      if (AGENDA_AREAS.indexOf(area) === -1) return { ok:false, error:'Área inválida: ' + area };
      var email = String(d.usuario_email || '').toLowerCase().trim();
      if (!email) return { ok:false, error:'Falta el correo de la persona' };
      var tipo = String(d.tipo || 'titular').toLowerCase();
      if (['titular','suplente'].indexOf(tipo) === -1) tipo = 'titular';
      // Normaliza dias_semana → CSV ordenado de 1..7 únicos.
      var setD = _agendaDiasSet(Array.isArray(d.dias_semana) ? d.dias_semana.join(',') : d.dias_semana);
      var diasCsv = Object.keys(setD).map(Number).sort(function (a, b) { return a - b; }).join(',');
      var nombre = d.usuario_nombre || '';
      if (!nombre) {
        var um = rowsToObjects(getSheet('Usuarios')).find(function (x) { return String(x.email || '').toLowerCase() === email && x.empresa_id === u.empresa_id; });
        nombre = um ? (um.nombre || um.email) : email;
      }
      var activo = (d.activo === undefined) ? true : !!d.activo;
      var suc = d.sucursal_id || '';
      var vDesde = d.vigente_desde ? String(d.vigente_desde) : '';
      var vHasta = d.vigente_hasta ? String(d.vigente_hasta) : '';

      var prev = d.id ? existentes.find(function (x) { return x.id === d.id && x.empresa_id === u.empresa_id; }) : null;
      if (prev) {
        var row = prev._row;
        shP.getRange(row, 3).setValue(suc);          // sucursal_id
        shP.getRange(row, 4).setValue(area);         // area
        shP.getRange(row, 5).setValue(email);        // usuario_email
        shP.getRange(row, 6).setValue(nombre);       // usuario_nombre
        shP.getRange(row, 7).setValue(tipo);         // tipo
        shP.getRange(row, 8).setNumberFormat('@');   // dias_semana como TEXTO
        shP.getRange(row, 8).setValue(diasCsv);
        shP.getRange(row, 9).setValue(vDesde);       // vigente_desde
        shP.getRange(row, 10).setValue(vHasta);      // vigente_hasta
        shP.getRange(row, 11).setValue(activo);      // activo
        shP.getRange(row, 14).setValue(new Date());  // actualizado_at
        shP.getRange(row, 15).setValue(u.email);     // actualizado_por
        ultimoId = prev.id;
      } else {
        var nuevoId = _agendaNextId('AGP', existentes);
        // Aplica formato TEXTO a dias_semana ANTES de escribir la fila nueva.
        var nuevaRow = shP.getLastRow() + 1;
        shP.getRange(nuevaRow, 8).setNumberFormat('@');
        shP.getRange(nuevaRow, 1, 1, AGENDA_PATRON_COLS.length).setValues([[
          nuevoId, u.empresa_id, suc, area, email, nombre, tipo, diasCsv,
          vDesde, vHasta, activo, new Date(), u.email, '', ''
        ]]);
        existentes.push({ id: nuevoId, empresa_id: u.empresa_id, _row: nuevaRow });
        ultimoId = nuevoId;
      }
    }
  }

  // ----- Modo EXCEPCIÓN (una fila por empresa+fecha+area+usuario_email) -----
  if (data.excepcion) {
    var x = data.excepcion;
    var fecha = String(x.fecha || '').trim();
    if (!fecha) return { ok:false, error:'Falta la fecha de la excepción' };
    var areaX = String(x.area || '').toLowerCase();
    if (AGENDA_AREAS.indexOf(areaX) === -1) return { ok:false, error:'Área inválida: ' + areaX };
    var emailX = String(x.usuario_email || '').toLowerCase().trim();
    if (!emailX) return { ok:false, error:'Falta el correo de la persona' };
    var estado = String(x.estado || '').toLowerCase();
    if (['descansa','cubre','falta'].indexOf(estado) === -1) return { ok:false, error:'Estado inválido: ' + estado };
    var tipoX = String(x.tipo || (estado === 'cubre' ? 'suplente' : 'titular')).toLowerCase();
    var motivoX = String(x.motivo || '').slice(0, 300);
    var sucX = x.sucursal_id || '';
    var nombreX = x.usuario_nombre || '';
    if (!nombreX) {
      var umx = rowsToObjects(getSheet('Usuarios')).find(function (z) { return String(z.email || '').toLowerCase() === emailX && z.empresa_id === u.empresa_id; });
      nombreX = umx ? (umx.nombre || umx.email) : emailX;
    }

    var shX = _agendaSheetExcepcion();
    var prevX = rowsToObjects(shX).find(function (z) {
      return z.empresa_id === u.empresa_id && fechaToString(z.fecha) === fecha &&
             String(z.area || '').toLowerCase() === areaX &&
             String(z.usuario_email || '').toLowerCase() === emailX;
    });
    if (prevX) {
      // cols: id,empresa_id,sucursal_id(3),fecha,area,usuario_email,usuario_nombre(7),tipo(8),estado(9),motivo(10)
      var rX = prevX._row;
      shX.getRange(rX, 3).setValue(sucX);     // sucursal_id
      shX.getRange(rX, 7).setValue(nombreX);  // usuario_nombre
      shX.getRange(rX, 8).setValue(tipoX);    // tipo
      shX.getRange(rX, 9).setValue(estado);   // estado
      shX.getRange(rX, 10).setValue(motivoX); // motivo
      ultimoId = prevX.id;
    } else {
      var idX = _agendaNextId('AGX', rowsToObjects(shX));
      shX.appendRow([idX, u.empresa_id, sucX, fecha, areaX, emailX, nombreX, tipoX, estado, motivoX, u.email, new Date()]);
      ultimoId = idX;
    }
  }

  // ----- Modo BORRAR EXCEPCIÓN (el día regresa a lo que diga la plantilla) -----
  if (data.excepcion_borrar) {
    var bx = data.excepcion_borrar;
    var fechaB = String(bx.fecha || '').trim();
    var areaB  = String(bx.area || '').toLowerCase();
    var emailB = String(bx.usuario_email || '').toLowerCase().trim();
    if (!fechaB || !emailB || AGENDA_AREAS.indexOf(areaB) === -1) return { ok:false, error:'Faltan datos para quitar la excepción' };
    var shB = _agendaSheetExcepcion();
    var prevB = rowsToObjects(shB).find(function (z) {
      return z.empresa_id === u.empresa_id && fechaToString(z.fecha) === fechaB &&
             String(z.area || '').toLowerCase() === areaB &&
             String(z.usuario_email || '').toLowerCase() === emailB;
    });
    if (!prevB) return { ok:false, error:'Ese día no tiene excepción registrada' };
    shB.deleteRow(prevB._row);
    ultimoId = prevB.id;
  }

  if (!data.patron && !data.excepcion && !data.excepcion_borrar) return { ok:false, error:'Nada que guardar (manda patron, excepcion o excepcion_borrar)' };
  return { ok:true, id: ultimoId };
}

// =====================================================================================
// MOTOR DE AUDITORÍA MATUTINA (Fase 2). Cruza la Agenda (quién DEBÍA estar) con quién
// OPERÓ realmente (ConciliacionAuditoria=cajera; Charolas=cocina/churrasca) y arma los
// pendientes por persona + un mensaje listo para reenviar. SOLO LECTURA (NO en MUTATING).
// =====================================================================================
var AUDIT_MATUTINA_ROLES = ['admin','auditoria','gerente_administrativo','gerente_restaurante','gerente_plaza'];
var AUDIT_MATUTINA_AREAS = ['cajera','cocina','churrasca'];

// Responsables ESPERADOS para (fecha, area): expande AgendaPatron + aplica AgendaExcepcion.
function _auditEsperados(empresaId, fecha, area, sucursalId) {
  var dow = _agendaDowFromISO(fecha);
  var mapa = {};
  rowsToObjects(_agendaSheetPatron()).forEach(function(r){
    if (r.empresa_id !== empresaId) return;
    if (!_truthy(r.activo)) return;
    if (String(r.area||'').toLowerCase() !== area) return;
    if (!matchSucursal(r.sucursal_id, sucursalId||'')) return;
    if (!_agendaDiasSet(r.dias_semana)[dow]) return;
    var vd = fechaToString(r.vigente_desde), vh = fechaToString(r.vigente_hasta);
    if (vd && fecha < vd) return;
    if (vh && fecha > vh) return;
    var email = String(r.usuario_email||'').toLowerCase();
    mapa[email] = { usuario_email: email, usuario_nombre: r.usuario_nombre||email, tipo: String(r.tipo||'titular').toLowerCase(), estado:'planeado' };
  });
  rowsToObjects(_agendaSheetExcepcion()).forEach(function(r){
    if (r.empresa_id !== empresaId) return;
    if (String(r.area||'').toLowerCase() !== area) return;
    if (fechaToString(r.fecha) !== fecha) return;
    if (!matchSucursal(r.sucursal_id, sucursalId||'')) return;
    var email = String(r.usuario_email||'').toLowerCase();
    var est = String(r.estado||'').toLowerCase();
    if (est === 'descansa' || est === 'falta') {
      if (mapa[email]) mapa[email].estado = est;
      else mapa[email] = { usuario_email:email, usuario_nombre:r.usuario_nombre||email, tipo:String(r.tipo||'titular').toLowerCase(), estado:est };
    } else if (est === 'cubre') {
      mapa[email] = { usuario_email:email, usuario_nombre:r.usuario_nombre||email, tipo:'suplente', estado:'cubre' };
    }
  });
  return Object.keys(mapa).map(function(k){ return mapa[k]; });
}

// Quién OPERÓ realmente en (fecha, area). Devuelve { email: cuenta }.
function _auditOperaron(empresaId, fecha, area, sucursalId) {
  var res = {};
  if (area === 'cajera') {
    var sh = getSheet('ConciliacionAuditoria');
    if (sh) rowsToObjects(sh).forEach(function(r){
      if (r.empresa_id !== empresaId) return;
      if (fechaToString(r.fecha) !== fecha) return;
      if (String(r.usuario_rol||'').toLowerCase() !== 'cajera') return;
      var em = String(r.usuario_email||'').toLowerCase();
      res[em] = (res[em]||0) + 1;
    });
  } else {
    var sh2 = getSheet('Charolas');
    if (sh2) rowsToObjects(sh2).forEach(function(r){
      if (r.empresa_id !== empresaId) return;
      if (String(r.area||'').toLowerCase() !== area) return;
      if (fechaToString(r.fecha) !== fecha) return;
      var em = String(r.responsable_email||'').toLowerCase();
      res[em] = (res[em]||0) + (Number(r.cantidad)||1);
    });
  }
  return res;
}

// De los esperados ACTIVOS (planeado/cubre) de un día, ¿quién es el responsable real?
// Regla (v377): si hay titular(es) activo(s), ellos responden; el suplente SÓLO responde
// cuando no queda ningún titular activo (el titular descansa/falta y el suplente cubre).
// Así dejamos de culpar al suplente cuando el titular sí estaba programado ese día.
function _auditResponsables(activos) {
  var tit = (activos || []).filter(function(a){ return String(a.tipo || 'titular').toLowerCase() === 'titular'; });
  return tit.length ? tit : (activos || []);
}

// Pendientes ACUMULADOS del comprador (rol 'comprador'). A diferencia de cajera/cocina/
// churrasca, NO dependen de la agenda ni de "operar un día": son el estado del catálogo de
// insumos (huérfanos SR12 sin vincular + datos sucios). Conteo ligero (números, no detalle).
// Criterios espejo de handleSr12SugerirVinculos (huérfano) y handleIngredientesDiagnostico
// (sin_unidad/sin_precio) — pequeñas divergencias de ±n son aceptables para un aviso. v369.
function _auditCompradorEstado(empresaId) {
  var ings = rowsToObjects(getSheet('Ingredientes')).filter(function(x){
    if (x.empresa_id !== empresaId) return false;
    var av = String(x.activo).trim().toLowerCase();
    if (x.activo === false || av === 'false' || av === '0' || av === 'no') return false;
    return true;
  });
  var ligados = {};
  var shM = getSheet('IngredientesSR12Match');
  if (shM) rowsToObjects(shM).forEach(function(m){ if (m.empresa_id === empresaId) ligados[m.ingrediente_id_fogueira] = true; });
  var descartados = {};
  var shD = getSheet('SugerenciasSR12Descartadas');
  if (shD) rowsToObjects(shD).forEach(function(d){ if (d.empresa_id === empresaId) descartados[String(d.ingrediente_id)] = true; });
  var hayCatalogoSr12 = !!getSheet('IngredientesSR12');
  function nNum(v){ var n = parseFloat(v); return isNaN(n) ? null : n; }
  function tru(v){ return v === true || String(v).trim().toLowerCase() === 'true'; }
  var huerfanos = 0, sinUnidad = 0, sinPrecio = 0;
  ings.forEach(function(x){
    if (hayCatalogoSr12 && !x.clave_sr12 && !ligados[x.id] && !descartados[String(x.id)]) huerfanos++;
    var unidad = String(x.unidad_base == null ? '' : x.unidad_base).trim().toLowerCase();
    var esSub = tru(x.es_subreceta_catalogo);
    var pru = nNum(x.precio_real_unitario), costo = nNum(x.ultimo_costo);
    var precioEf = (pru != null && pru > 0) ? pru : costo;
    var estimado = tru(x.ultimo_costo_estimado);
    if (!unidad) sinUnidad++;
    if (!esSub && (precioEf == null || precioEf <= 0) && !estimado) sinPrecio++;
  });
  return { huerfanos: huerfanos, sin_unidad: sinUnidad, sin_precio: sinPrecio };
}

// Recetas con avisos por ÁREA: cantidad/costo absurdo (lineas_sospechosas>0 || costo_total>3000).
// Pendiente acumulado del responsable del área, igual que el comprador con el catálogo. v369.
// v373: cubre las 5 áreas (cocina/churrasca/barra/cava/panaderia) para barman/panadero.
// Devuelve { cocina:{sosp:N, recetas:[...]}, barra:{...}, ... }. Reusa _reporteRentabilidadCore.
var AUDIT_RECETAS_AREAS = ['cocina','churrasca','barra','cava','panaderia'];
function _auditRecetasConAvisoPorArea(empresaId) {
  var out = {};
  try {
    var rep = _reporteRentabilidadCore(empresaId);
    (rep.recetas || []).forEach(function(r){
      if (r.activa === false || r.es_subreceta) return;
      var area = String(r.area||'').toLowerCase();
      if (AUDIT_RECETAS_AREAS.indexOf(area) === -1) return;
      var problema = (Number(r.lineas_sospechosas)||0) > 0 || (Number(r.costo_total)||0) > 3000;
      if (!problema) return;
      if (!out[area]) out[area] = { sosp:0, recetas:[] };
      out[area].sosp++;
      if (out[area].recetas.length < 4) out[area].recetas.push(r.nombre);
    });
  } catch(e){}
  return out;
}

function _auditBanderaLabel(key) {
  var m = { arqueo:'Arqueo no cuadra', terminal:'Terminal/lote', fuga:'Cancelación sospechosa (posible fuga)', canc_sinaut:'Cancelación sin autorizar', cort_sinaut:'Cortesía sin autorizar', pct_canc:'% cancelaciones alto', nosales:'Aperturas de cajón', comensales:'Comensales Host vs POS', prop_serv:'Propina por servicio fuera de rango', prop_dia:'Propina del día fuera de rango', retiro:'Retiro de propinas no cuadra', lote:'Lote bancario sin cerrar', vouchers:'Vouchers vs operaciones', folios:'Folios no consecutivos' };
  return m[key] || key;
}

function _auditMensaje(pe, fecha) {
  var nom = String(pe.usuario_nombre||'').trim().split(' ')[0] || pe.usuario_nombre;
  if (pe.ok) return '✅ ' + nom + ' — ' + fecha + ': todo en orden, sin pendientes. ¡Gracias! 💪';
  var ic = { critica:'🔴', alta:'🟠', media:'🟡' };
  var lin = pe.pendientes.map(function(x){
    var d = Number(x.dias_atraso) || 0;
    var suf = d >= 1 ? ' — ⏳ ' + d + (d === 1 ? ' día' : ' días') + ' de atraso' : '';
    return (ic[x.sev]||'•') + ' ' + x.titulo + suf;
  });
  return '🔔 ' + nom + ' — pendientes del ' + fecha + ':\n' + lin.join('\n') + '\n\nEn cuanto puedas, ponte al día. Cualquier duda, con Luis.';
}

// Días enteros entre dos fechas ISO (yyyy-mm-dd). Negativo o no parseable → 0.
function _diasEntre(isoDesde, isoHasta) {
  var a = String(isoDesde||'').split('-'), b = String(isoHasta||'').split('-');
  if (a.length < 3 || b.length < 3) return 0;
  var da = new Date(parseInt(a[0],10), parseInt(a[1],10)-1, parseInt(a[2],10));
  var db = new Date(parseInt(b[0],10), parseInt(b[1],10)-1, parseInt(b[2],10));
  if (isNaN(da) || isNaN(db)) return 0;
  var d = Math.round((db - da) / 86400000);
  return d > 0 ? d : 0;
}

// Estado de pendientes del gerente administrativo (Luis): cancelaciones §07 sin documentar
// (con la fecha de la cara sin documentar más vieja = evidencia para los días de atraso) +
// usuarios barman/panadero faltantes. Solo lectura.
function _auditGteAdminEstado(empresaId) {
  var canc = { total:0, sin_doc:0, caras_sin_doc:0, desde:'' };
  try {
    var cc = _cancelacionesSr12Core(empresaId, '', '');
    if (cc && cc.resumen) {
      canc.total = cc.resumen.total || 0;
      canc.sin_doc = cc.resumen.sin_documentar || 0;
      canc.caras_sin_doc = cc.resumen.caras_sin_documentar || 0;
      var fechas = (cc.detalle||[]).filter(function(d){ return d.es_caro && !d.documentado && d.fecha; })
        .map(function(d){ return d.fecha; }).sort();
      canc.desde = fechas.length ? fechas[0] : '';
    }
  } catch(e){}
  var roles = {};
  rowsToObjects(getSheet('Usuarios')).forEach(function(x){
    if (x.empresa_id !== empresaId || !esActivo(x.activo)) return;
    roles[String(x.rol||'').toLowerCase()] = true;
  });
  return { canc:canc, faltan_barman: !roles['barman'], faltan_panadero: !roles['panadero'] };
}

// REGISTRO de días de atraso (hoja SeguimientoPendientes). Para cada (persona, clave) abierto,
// guarda la PRIMERA vez que se detectó; los días de atraso = hoy − primera_detección. Si el
// pendiente trae evidencia de fecha (desde, ej. la cancelación más vieja), esa fecha es el piso.
// SIEMPRE atribuye dias_atraso a cada pendiente (aunque no escriba); solo PERSISTE si doWrite
// (la corrida oficial del bot), nunca al ver fechas históricas en la pantalla. v379.
function _seguimientoSync(empresaId, hoy, personasArr, doWrite) {
  var COLS = ['empresa_id','persona_email','clave','titulo','area','sev','primera_deteccion','ultima_deteccion','dias_atraso','activo','resuelto_en','actualizado'];
  var sh = asegurarHoja('SeguimientoPendientes', COLS);
  var rows = rowsToObjects(sh);
  var idx = {}; // empresa+email+clave (última fila gana) → fila
  rows.forEach(function(r){
    if (r.empresa_id !== empresaId) return;
    idx[String(r.persona_email||'').toLowerCase() + '|' + String(r.clave||'')] = r;
  });

  var activasHoy = {};
  (personasArr||[]).forEach(function(pe){
    (pe.pendientes||[]).forEach(function(pend){
      var clave = pend.clave || pend.titulo;
      var k = String(pe.usuario_email||'').toLowerCase() + '|' + clave;
      var ex = idx[k];
      var primera;
      if (ex && esActivo(ex.activo)) {
        primera = fechaToString(ex.primera_deteccion) || hoy;
      } else {
        primera = (pend.desde && String(pend.desde) < hoy) ? String(pend.desde) : hoy;
      }
      pend.dias_atraso = _diasEntre(primera, hoy);
      pend.desde_fecha = primera;
      activasHoy[k] = { email:pe.usuario_email, nombre:pe.usuario_nombre, area:pe.area, pend:pend, primera:primera };
    });
  });

  if (!doWrite) return;

  Object.keys(activasHoy).forEach(function(k){
    var a = activasHoy[k], ex = idx[k];
    var clave = a.pend.clave || a.pend.titulo;
    if (ex && esActivo(ex.activo)) {
      // Mantener primera_deteccion; refrescar el resto.
      sh.getRange(ex._row, 1, 1, COLS.length).setValues([[
        empresaId, a.email, clave, a.pend.titulo, a.area, a.pend.sev||'',
        fechaToString(ex.primera_deteccion) || a.primera, hoy, a.pend.dias_atraso, true, '', hoy
      ]]);
    } else {
      // Nuevo (o reaparece tras resolverse) → fila nueva, conservando el historial resuelto.
      sh.appendRow([ empresaId, a.email, clave, a.pend.titulo, a.area, a.pend.sev||'', a.primera, hoy, a.pend.dias_atraso, true, '', hoy ]);
    }
  });

  // Cerrar (resolver) los que estaban activos y hoy ya no aparecen.
  rows.forEach(function(r){
    if (r.empresa_id !== empresaId || !esActivo(r.activo)) return;
    var k = String(r.persona_email||'').toLowerCase() + '|' + String(r.clave||'');
    if (activasHoy[k]) return;
    sh.getRange(r._row, 10, 1, 3).setValues([[ false, hoy, hoy ]]); // activo, resuelto_en, actualizado
  });
}

function handleAuditoriaMatutina(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, AUDIT_MATUTINA_ROLES)) return { ok:false, error:'Sin permisos' };
  var fecha = String(p.fecha||'').trim() || _agendaSumaDias(diaLogicoRestaurante(), -1);  // default: AYER (día lógico)
  var suc = String(p.sucursal_id||'').trim();
  return _auditoriaMatutinaCore(u.empresa_id, fecha, suc, false); // ver = NO persiste el registro
}

// Núcleo del motor matutino, separado del handler para poderlo correr SIN token de
// sesión (trigger diario del bot de Telegram, v367). Solo lectura.
function _auditoriaMatutinaCore(empresaId, fecha, suc, doWrite) {
  fecha = String(fecha||'').trim() || _agendaSumaDias(diaLogicoRestaurante(), -1);
  suc = String(suc||'').trim();

  // Conciliación del día (para cajera): existe / estado / banderas rojas.
  var concExiste = false, concEstado = '', banderasRojas = [];
  rowsToObjects(getSheet('Conciliaciones')).forEach(function(c){
    if (c.empresa_id !== empresaId) return;
    if (suc && c.sucursal_id !== suc) return;
    if (fechaToString(c.fecha) !== fecha) return;
    concExiste = true; concEstado = String(c.estado||'');
    var pay = {}; try { pay = JSON.parse(c.payload_json||'{}'); } catch(e){}
    var bc = _banderasDeConciliacion(pay);
    banderasRojas = (bc.banderas||[]).filter(function(b){ return b.sev === 'rojo'; });
  });

  var personas = {};
  function ensure(email, nombre, area) {
    if (!personas[email]) personas[email] = { usuario_email:email, usuario_nombre:nombre||email, area:area, pendientes:[], ok:true };
    return personas[email];
  }
  function addPend(email, nombre, area, titulo, sev, clave, desde) {
    var pe = ensure(email, nombre, area);
    pe.pendientes.push({ titulo:titulo, sev:sev, clave:clave || ('pend:'+titulo), desde:desde || '' }); pe.ok = false;
  }

  var areasOut = [];
  AUDIT_MATUTINA_AREAS.forEach(function(area){
    var esperados = _auditEsperados(empresaId, fecha, area, suc);
    var activos = esperados.filter(function(e){ return e.estado === 'planeado' || e.estado === 'cubre'; });
    var descansan = esperados.filter(function(e){ return e.estado === 'descansa' || e.estado === 'falta'; });
    var operaron = _auditOperaron(empresaId, fecha, area, suc);
    var sinAgenda = esperados.length === 0;

    if (area === 'cajera') {
      // Responsables del día = titular-preferente (v377). Si no hay agenda, caemos a quien operó.
      var responsables = activos.length ? _auditResponsables(activos) : [];
      if (!concExiste) {
        // Nadie abrió el corte: culpa a los responsables programados (no a todos los activos).
        responsables.forEach(function(a){
          ensure(a.usuario_email, a.usuario_nombre, area);
          addPend(a.usuario_email, a.usuario_nombre, area, 'No se abrió el corte de caja del día.', 'critica', 'cajera:corte_no_abierto', fecha);
        });
      } else {
        // El corte existe: el dueño del pendiente es QUIEN lo operó (si lo sabemos); si no,
        // los responsables programados. Evita culpar a un titular que ese día no trabajó.
        var duenos = Object.keys(operaron).length
          ? Object.keys(operaron).map(function(em){
              var m = esperados.filter(function(e){ return e.usuario_email === em; })[0];
              return { usuario_email: em, usuario_nombre: m ? m.usuario_nombre : em };
            })
          : responsables;
        duenos.forEach(function(a){
          ensure(a.usuario_email, a.usuario_nombre, area);
          if (concEstado !== 'cerrada') {
            addPend(a.usuario_email, a.usuario_nombre, area, 'El corte de caja quedó SIN CERRAR (falta sellar tu cierre).', 'critica', 'cajera:corte_sin_cerrar', fecha);
          } else {
            banderasRojas.forEach(function(b){ addPend(a.usuario_email, a.usuario_nombre, area, 'Bandera roja: ' + _auditBanderaLabel(b.key) + (b.val ? (' (' + b.val + ')') : ''), 'alta', 'cajera:bandera:'+b.key, fecha); });
          }
        });
      }
    } else {
      // cocina / churrasca: el responsable (titular-preferente) debe haber registrado charolas.
      _auditResponsables(activos).forEach(function(e){
        ensure(e.usuario_email, e.usuario_nombre, area);
        if (!operaron[e.usuario_email]) addPend(e.usuario_email, e.usuario_nombre, area, 'No registró charolas de ' + area + ' este día.', 'critica', area+':sin_charolas', fecha);
      });
    }

    areasOut.push({
      area: area, sin_agenda: sinAgenda,
      esperados_activos: activos.map(function(a){ return a.usuario_nombre + (a.estado==='cubre'?' (cubre)':''); }),
      descansan: descansan.map(function(d){ return d.usuario_nombre; }),
      operaron: Object.keys(operaron),
      conciliacion: area === 'cajera' ? { existe:concExiste, estado:concEstado, banderas_rojas:banderasRojas.length } : undefined
    });
  });

  // Comprador (v369): pendientes ACUMULADOS del catálogo, no por agenda/día. Se avisa a
  // cada usuario activo con rol 'comprador'. Umbral: cualquier cantidad > 0 (es deuda que
  // arrastra hasta que la baje). No entra a areasOut (no es área de agenda).
  var compradores = rowsToObjects(getSheet('Usuarios')).filter(function(x){
    return x.empresa_id === empresaId && esActivo(x.activo) && String(x.rol||'').toLowerCase() === 'comprador';
  });
  if (compradores.length) {
    var cat = _auditCompradorEstado(empresaId);
    compradores.forEach(function(c){
      var em = String(c.email||'').toLowerCase();
      ensure(em, c.nombre, 'compras');
      if (cat.huerfanos > 0) addPend(em, c.nombre, 'compras', cat.huerfanos + ' insumos del POS sin vincular (Recetas → Ingredientes → 🪄 sugeridor, "Vincular todas las de alta confianza").', 'alta', 'compras:huerfanos_sr12', '');
      if (cat.sin_unidad > 0 || cat.sin_precio > 0) {
        var partes = [];
        if (cat.sin_unidad > 0) partes.push(cat.sin_unidad + ' sin unidad');
        if (cat.sin_precio > 0) partes.push(cat.sin_precio + ' sin precio');
        addPend(em, c.nombre, 'compras', 'Catálogo por limpiar: ' + partes.join(' y ') + ' (🩺 Diagnóstico de datos; corrige con clic directo en la celda).', 'media', 'compras:catalogo_sucio', '');
      }
    });
  }

  // Responsables "tipo chef" por rol: recetas de su(s) área(s) con cantidad/costo absurdo
  // por corregir (deuda que arrastra, no por día). v369; v373 suma barman (barra+cava) y
  // panadero (panaderia) — espeja _areasDeRol (recetario_handlers.gs). Si el rol aún no
  // tiene usuarios (barman/panadero pendientes de Luis), simplemente no atribuye a nadie.
  var recetasAviso = _auditRecetasConAvisoPorArea(empresaId);
  var ROL_AREAS_RECETAS = { cocina:['cocina'], churrasca:['churrasca'], barman:['barra','cava'], panadero:['panaderia'] };
  Object.keys(ROL_AREAS_RECETAS).forEach(function(rol){
    var areasRol = ROL_AREAS_RECETAS[rol];
    var sosp = 0, ejemplosArr = [];
    areasRol.forEach(function(area){
      var info = recetasAviso[area];
      if (!info || !info.sosp) return;
      sosp += info.sosp;
      ejemplosArr = ejemplosArr.concat(info.recetas || []);
    });
    if (!sosp) return;
    var resp = rowsToObjects(getSheet('Usuarios')).filter(function(x){
      return x.empresa_id === empresaId && esActivo(x.activo) && String(x.rol||'').toLowerCase() === rol;
    });
    var etiqueta = areasRol.join('/');
    var ejemplos = ejemplosArr.length ? ' (ej. ' + ejemplosArr.slice(0,2).join(', ') + ')' : '';
    resp.forEach(function(c){
      var em = String(c.email||'').toLowerCase();
      ensure(em, c.nombre, areasRol[0]);
      addPend(em, c.nombre, areasRol[0], sosp + ' receta(s) de ' + etiqueta + ' con cantidad o costo absurdo por corregir' + ejemplos + '.', 'alta', areasRol[0]+':recetas_absurdas', '');
    });
  });

  // Host (v373): servicios de días pasados que quedaron 'abierta' (sin cerrar). Deuda
  // acumulada atribuida al DUEÑO de cada bitácora (host_email) — no necesita agenda.
  // Mismo criterio que abiertas_pasadas de handleBitacoraList (sucursal vacía = global).
  var hoyLog = diaLogicoRestaurante();
  var abiertasPorHost = {}, abiertasDesde = {};
  rowsToObjects(getSheet('Bitacoras')).forEach(function(b){
    if (b.empresa_id !== empresaId) return;
    if (suc && b.sucursal_id && b.sucursal_id !== suc) return;
    if (String(b.estado||'') !== 'abierta') return;
    var fb = fechaToString(b.fecha);
    if (!fb || fb >= hoyLog) return;
    var emH = String(b.host_email||'').toLowerCase().trim();
    if (!emH) return;
    if (!abiertasPorHost[emH]) abiertasPorHost[emH] = [];
    abiertasPorHost[emH].push((b.folio || b.id) + ' del ' + fb);
    if (!abiertasDesde[emH] || fb < abiertasDesde[emH]) abiertasDesde[emH] = fb;
  });
  if (Object.keys(abiertasPorHost).length) {
    var nombresIdx = {};
    rowsToObjects(getSheet('Usuarios')).forEach(function(x){
      if (x.empresa_id === empresaId) nombresIdx[String(x.email||'').toLowerCase()] = x.nombre || x.email;
    });
    Object.keys(abiertasPorHost).forEach(function(emH){
      var lista = abiertasPorHost[emH];
      var ej = lista.slice(0,3).join(', ') + (lista.length > 3 ? '…' : '');
      var nomH = nombresIdx[emH] || emH;
      ensure(emH, nomH, 'host');
      addPend(emH, nomH, 'host', lista.length + ' servicio(s) de días pasados sin cerrar en Bitácora (' + ej + '). Ábrelo y ciérralo.', 'critica', 'host:servicios_abiertos', abiertasDesde[emH] || '');
    });
  }

  // Gerente administrativo (Luis): pendientes acumulados de dirección — documentar las
  // cancelaciones §07 y dar de alta los usuarios barman/panadero. Atribuido a cada usuario con
  // rol gerente_administrativo (en Fogueira = solo Luis; los demás jefes son admin). v379.
  var gteAdmins = rowsToObjects(getSheet('Usuarios')).filter(function(x){
    return x.empresa_id === empresaId && esActivo(x.activo) && String(x.rol||'').toLowerCase() === 'gerente_administrativo';
  });
  if (gteAdmins.length) {
    var ga = _auditGteAdminEstado(empresaId);
    gteAdmins.forEach(function(c){
      var em = String(c.email||'').toLowerCase();
      ensure(em, c.nombre, 'gte_admin');
      if (ga.canc.caras_sin_doc > 0) {
        addPend(em, c.nombre, 'gte_admin', ga.canc.caras_sin_doc + ' cancelación(es) caras del POS sin documentar en la conciliación §07 (de ' + ga.canc.sin_doc + ' sin documentar en total).', 'critica', 'gteadmin:cancelaciones_sin_doc', ga.canc.desde);
      }
      if (ga.faltan_barman || ga.faltan_panadero) {
        var faltan = [];
        if (ga.faltan_barman) faltan.push('barman');
        if (ga.faltan_panadero) faltan.push('panadero');
        addPend(em, c.nombre, 'gte_admin', 'Faltan crear los usuarios de ' + faltan.join(' y ') + ' (sin ellos no se enciende barra/panadería).', 'alta', 'gteadmin:usuarios_barra', '');
      }
    });
  }

  // Pendientes MANUALES (v406): tareas ad-hoc que dirección le asigna a una persona y deben
  // salir en su Telegram igual que las automáticas. Viven en PendientesManuales; aquí se inyectan
  // al dueño por email (clave estable 'manual:<id>' → días de atraso desde creado_at). Quedan en
  // pe.pendientes → fluyen a _auditMensaje, _seguimientoSync, el envío matutino y /pendientes.
  try {
    var shPM = SpreadsheetApp.getActive().getSheetByName('PendientesManuales');
    if (shPM) {
      var nomIdxPM = {};
      rowsToObjects(getSheet('Usuarios')).forEach(function(x){
        if (x.empresa_id === empresaId) nomIdxPM[String(x.email||'').toLowerCase()] = x.nombre || x.email;
      });
      rowsToObjects(shPM).forEach(function(m){
        if (m.empresa_id !== empresaId || !esActivo(m.activo)) return;
        var emPM = String(m.usuario_email||'').toLowerCase().trim();
        var txtPM = String(m.texto||'').trim();
        if (!emPM || !txtPM) return;
        var nomPM = nomIdxPM[emPM] || emPM;
        addPend(emPM, nomPM, 'tarea', txtPM, String(m.sev||'alta').toLowerCase(), 'manual:'+m.id, fechaToString(m.creado_at));
      });
    }
  } catch(e){}

  var personasArr = Object.keys(personas).map(function(k){ return personas[k]; });
  // Registro de días de atraso: atribuye dias_atraso a cada pendiente (y lo PERSISTE solo en la
  // corrida oficial del bot, doWrite=true). El mensaje se arma DESPUÉS para incluir los días.
  try { _seguimientoSync(empresaId, diaLogicoRestaurante(), personasArr, doWrite === true); } catch(e){}
  personasArr.forEach(function(pe){ pe.mensaje_texto = _auditMensaje(pe, fecha); });

  return {
    ok: true, fecha: fecha,
    areas: areasOut,
    personas: personasArr,
    resumen: {
      total_personas: personasArr.length,
      con_pendientes: personasArr.filter(function(x){ return !x.ok; }).length,
      sin_agenda_areas: areasOut.filter(function(a){ return a.sin_agenda; }).map(function(a){ return a.area; })
    }
  };
}

// =============================================================================
// PENDIENTES MANUALES (v406) — tareas ad-hoc que dirección asigna a una persona y
// salen en su Telegram (y /pendientes) igual que las del auditor automático.
// Roles que asignan/gestionan = dirección. La entrega la hace el motor matutino
// (se inyectan en _auditoriaMatutinaCore). Solo se "molesta" mientras activo=true.
// =============================================================================
var PENDIENTE_MANUAL_COLS = ['id','empresa_id','usuario_email','texto','sev','creado_por_email','creado_at','activo','resuelto_at','resuelto_por_email'];
var PENDIENTE_MANUAL_ROLES = ['admin','gerente_administrativo','gerente_plaza','auditoria'];

function handlePendienteManualAdd(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, PENDIENTE_MANUAL_ROLES)) return { ok:false, error:'Solo dirección puede asignar pendientes' };
  var emailDest = String(p.usuario_email||'').trim().toLowerCase();
  var texto = String(p.texto||'').trim();
  var sev = String(p.sev||'alta').trim().toLowerCase();
  if (['critica','alta','media'].indexOf(sev) === -1) sev = 'alta';
  if (!emailDest) return { ok:false, error:'usuario_email requerido' };
  if (texto.length < 5) return { ok:false, error:'El texto del pendiente es muy corto' };
  var dest = rowsToObjects(getSheet('Usuarios')).find(function(x){
    return String(x.email||'').toLowerCase() === emailDest && x.empresa_id === u.empresa_id;
  });
  if (!dest) return { ok:false, error:'No encuentro un usuario con ese correo en la empresa' };
  var sh = asegurarHoja('PendientesManuales', PENDIENTE_MANUAL_COLS);
  var id = 'PM-' + Utilities.getUuid().slice(0,8);
  var obj = { id:id, empresa_id:u.empresa_id, usuario_email:emailDest, texto:texto, sev:sev,
              creado_por_email:u.email, creado_at:new Date(), activo:true, resuelto_at:'', resuelto_por_email:'' };
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(function(h){ return obj[h] === undefined ? '' : obj[h]; }));
  return { ok:true, id:id, usuario_email:emailDest, nombre:dest.nombre || emailDest, texto:texto, sev:sev };
}

function handlePendienteManualList(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, PENDIENTE_MANUAL_ROLES)) return { ok:false, error:'Sin permiso' };
  var sh = SpreadsheetApp.getActive().getSheetByName('PendientesManuales');
  if (!sh) return { ok:true, pendientes:[] };
  var soloActivos = String(p.solo_activos||'1') !== '0';
  var lista = rowsToObjects(sh)
    .filter(function(m){ return m.empresa_id === u.empresa_id && (!soloActivos || esActivo(m.activo)); })
    .map(function(m){ return { id:m.id, usuario_email:m.usuario_email, texto:m.texto, sev:m.sev,
        creado_por_email:m.creado_por_email, creado_at:fechaToString(m.creado_at), activo:esActivo(m.activo),
        resuelto_at: m.resuelto_at ? fechaToString(m.resuelto_at) : '' }; });
  return { ok:true, pendientes:lista };
}

function handlePendienteManualResolver(p) {
  var u = validarToken(p.token);
  if (!u) return { ok:false, error:'Sesión inválida' };
  if (!rolEs(u, PENDIENTE_MANUAL_ROLES)) return { ok:false, error:'Sin permiso' };
  var id = String(p.id||'').trim();
  if (!id) return { ok:false, error:'id requerido' };
  var sh = SpreadsheetApp.getActive().getSheetByName('PendientesManuales');
  if (!sh) return { ok:false, error:'No hay pendientes manuales' };
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var fila = rowsToObjects(sh).find(function(m){ return m.id === id && m.empresa_id === u.empresa_id; });
  if (!fila) return { ok:false, error:'Pendiente no encontrado' };
  var cAct = headers.indexOf('activo')+1, cRes = headers.indexOf('resuelto_at')+1, cResP = headers.indexOf('resuelto_por_email')+1;
  if (cAct > 0)  sh.getRange(fila._row, cAct).setValue(false);
  if (cRes > 0)  sh.getRange(fila._row, cRes).setValue(new Date());
  if (cResP > 0) sh.getRange(fila._row, cResP).setValue(u.email);
  return { ok:true, id:id };
}