# Modelo y operación del Sistema de Conciliación — Fogueira
### Documento de continuidad para Contraloría · Grupo Toda del Sureste
*22 de junio de 2026*

---

## 1. Para qué es este documento
Que el Grupo entienda **cómo está hecho el sistema, dónde vive cada pieza, cómo se
opera y se actualiza, y qué se necesita para que NO dependa de una sola persona.**
Responde directo a lo que pidió Contraloría: tener el modelo, ver cómo se ejecuta, y
poder retomarlo si quien lo construyó algún día no está.

## 2. De qué está hecho (tres piezas)
- **Pantallas (lo que ve el usuario):** páginas web (corte de caja, tablero,
  recetario, reservas, etc.). Se abren con un enlace, desde el teléfono o la
  computadora. No se instala nada.
- **Cerebro (backend):** Google Apps Script. Recibe cada acción, revisa permisos,
  calcula, y lee o escribe los datos.
- **Datos:** una hoja de cálculo de Google ("Conciliación Restaurante - DB") con
  todas las tablas (usuarios, cortes, recetas, inventario, mermas, etc.).

No usa servidores propios, ni base de datos tipo SQL, ni Firebase. Todo corre sobre
la nube de Google. Eso lo hace barato y fácil de mantener.

## 3. Dónde vive cada cosa (la nube)
| Pieza | Dónde vive hoy | Quién tiene acceso |
|---|---|---|
| **Código fuente** | GitHub: `github.com/cpgermansolis-maker/trikles` | Cuenta personal de Germán → **pasar a cuenta del Grupo / dar acceso a Contraloría** |
| **Backend (en ejecución)** | Google Apps Script, en el Drive de `cpgermansolis@gmail.com` | Cuenta de Germán |
| **Datos** | Google Sheets, mismo Drive | Cuenta de Germán |
| **Pantallas publicadas** | Se sirven desde el mismo Apps Script (una URL fija) | Públicas por enlace; el acceso real lo controla el login |

> El código **sí vive en la nube** (GitHub) y está al día. Lo que falta para
> "institucionalizarlo" es que viva bajo una cuenta del **Grupo**, no de una persona.

## 4. Cómo se ejecuta (el flujo, en simple)
1. El usuario abre el enlace de su pantalla.
2. Inicia sesión con correo y contraseña. El sistema le entrega un "pase" (token)
   que vale para la jornada del día.
3. Cada acción (guardar un corte, registrar una merma, autorizar una cortesía) viaja
   al cerebro, que revisa el pase y el rol, hace el cálculo y lo guarda en la hoja.
4. El tablero de dirección y los avisos automáticos (por Telegram cada mañana) leen
   esos mismos datos. Una sola fuente de verdad.

## 5. Cómo se actualiza (mantenimiento)
- El código se edita y se **versiona en GitHub**: queda el historial completo de
  cambios, con fecha y descripción de cada uno.
- Para publicar un cambio se "empuja" el código al proyecto de Apps Script y se
  libera una **versión nueva** (con una herramienta llamada `clasp`). La dirección
  (URL) es **fija**, así que los usuarios nunca cambian de enlace.
- Existe un **ambiente de pruebas** para validar cambios sin tocar los datos reales.

## 6. Seguridad y control de accesos
- Cada usuario tiene un **rol** (cajera, cocina, churrasca, barra, almacén, gerencia,
  dirección, auditoría, administrador) y **solo ve y firma lo suyo**.
- Las sesiones caducan solas cada día (corte a las 3am), por seguridad.
- **Pendiente recomendado:** una llave de seguridad (la del sistema de sesiones) está
  hoy dentro del código, que es público. Conviene **moverla a la configuración
  protegida** (donde ya se guardan las llaves de servicios externos) y **renovarla**.
  *Nota:* el repositorio se mantiene público a propósito, porque de él se publican
  también las pantallas de otro sistema del Grupo (OAC); por eso la protección
  correcta es **sacar los secretos del código**, no cerrar el repositorio.

## 7. Qué se necesita para que NO dependa de una persona (continuidad)
Este es el corazón de lo que pidió Contraloría. Para que **cualquier técnico del
Grupo** pueda retomar el sistema:

1. **Repositorio bajo control del Grupo.** Mover el código a una cuenta de Grupo
   TODA (o dar acceso a Contraloría como copropietario). Así el código nunca se
   pierde ni se queda con una persona.
2. **Cuentas de Google institucionales.** El backend y los datos viven hoy en el
   correo personal de Germán. Definir un **correo institucional dueño**, o accesos
   compartidos, para el proyecto Apps Script y la hoja de datos.
3. **Documentación.** Este documento, más las notas técnicas detalladas que ya viven
   en el repositorio, permiten que otro técnico entienda y continúe.
4. **Respaldos.** Ya hay cultura de respaldar antes de cualquier cambio de datos.
   Conviene formalizar un respaldo periódico de la hoja.

## 8. Cómo comprobar que funciona (demostración)
Se puede hacer una **demostración en vivo** de 30 minutos: abrir el sistema, hacer un
corte de prueba, registrar una merma, ver el tablero de dirección y un aviso de
Telegram. Se usa el ambiente de pruebas, sin tocar la operación real.

## 9. Siguientes pasos sugeridos para Contraloría
1. Definir bajo qué **cuenta institucional** vive el repositorio y dar acceso a
   Contraloría.
2. Definir el **correo institucional** dueño del backend y de los datos.
3. Agendar la **demostración en vivo**.
4. (Técnico, recomendado) **mover la llave de seguridad a configuración protegida y
   renovarla** — sacar todo secreto del código, dado que el repositorio es público.

---

*El sistema está en producción y funcionando todos los días. Este documento es la
base para que su control pase de una persona al Grupo, que es justo lo que se pidió.*
