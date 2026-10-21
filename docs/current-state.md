# Estado técnico actual de BandaBase

**Última actualización:** 2026-10-21, Argentina.  
**Último cambio funcional documentado:** PR #134 (actualizaciones en tiempo real, iconos SVG propios y paridad del editor Materiales); la CI funcional pasó en el run #618. Los flujos de GitHub Actions anteriores para las PR #123, #124, #126–#132 también pasaron. Comprobar la CI más reciente después de modificar estos documentos. No se infiere por eso que se probaron todas las funciones con cuentas reales.  
**Supabase:** evuwcikuxptrgzdzejov.  
Este documento es una fotografía. Revalidar PR, CI, esquema y advertencias antes de una actuación; especialmente después de nuevas conversaciones o commits.

## 1. Código y despliegue

- La PR #103 integró AGENTS.md, AI_CONTEXT.md y cuatro documentos de contexto el 2026-10-14 (Argentina). Fue documentación únicamente y pasó CI y deploy.

- Repo: Teliu-p/BandaBase; rama principal main.
- Aplicación publicada: https://teliu-p.github.io/BandaBase/.
- Stack: HTML/CSS, JavaScript en scripts clásicos, Supabase JS v2, PostgreSQL/RLS/Storage.
- Base funcional previa a PR #113: `611043389f58a962152f16cabdedd5c18b165865` (PR #112 fusionada).
- PR #113 fusionada en `3c6588dc282c3337f7dba2a78e38a19511a59b9a`; para este commit pasaron Tests y Pages: [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39358153888) · [Pages build/deployment](https://github.com/Teliu-p/BandaBase/actions/runs/39358153266). Tests incluye npm test, ESLint no-undef y smoke tests Playwright/Chromium.
- Los smoke tests usan un stub de Auth; no son una prueba autenticada integral con cuentas reales.

## 2. Corrección de sangría y audio en Materiales (2026-10-19)

- Solicitud de corrección: la sangría tipo `blockquote.material-indent` añadida en PR #107 desplazaba demasiado el texto. La PR #108 la reemplazó por espacios reales de a uno, con repetición acelerada al mantener pulsado; la selección de varias líneas se procesa línea por línea.
- Al guardar, los bloques de texto se renderizaban como `div` y los audios como tarjetas grandes separadas, aunque en edición se veían como chips inline. La vista ahora devuelve texto y adjuntos como elementos inline; el audio muestra nombre + reproducir/pausar y, al tocar el nombre, un panel flotante con tiempo, duración y seek, sin empujar el resto del texto.
- Se eliminó el wrapper de indentación anterior del serializador/sanitizador para que no reaparezca como bloque con margen al reabrir contenido antiguo.
- PR #108: https://github.com/Teliu-p/BandaBase/pull/108 fue fusionada en `a553d7ecb3b9621fd85dc7a74e9c3fd7b2c721a9`. Tests y despliegue de Pages pasaron (enlaces en la sección 1).
- No se modificó el volumen de los audios, el esquema, los permisos, los datos ni Storage de Supabase. La CI usa stubs y smoke tests; falta la comprobación manual de guardar/reabrir un material con audio en una canción real.

## 3. Revisión de herramientas musicales del editor (2026-10-19)

- Main observado al iniciar esta tarea: `e75c2d13e231bfe1c059ea92a7a82cbe53ef26cf`. La PR #107 (https://github.com/Teliu-p/BandaBase/pull/107) contiene la primera tanda de figuras musicales, sangría permitida en rich text, atajos numéricos, chips de adjuntos limitados a un renglón y ganancia ajustable del metrónomo. Revalidar PR/CI/deploy antes de afirmar que está publicada.
- El rich text tiene prefijo propio, serializador y sanitizador con lista permitida. No guardar HTML arbitrario ni confiar en `execCommand` sin incluir el formato en esa ruta de persistencia.
- PR #110 fue fusionada en `cd9cff753c2da3eb559f11b9d4a5071f979e81b6`: https://github.com/Teliu-p/BandaBase/pull/110. Los marcadores se persisten como rich text canónico dentro de `material_blocks.content`; el chip muestra solo el tiempo y salta a todos los audios de la canción, incluidos los adjuntos de Materiales plegados. Las pistas pausadas no arrancan automáticamente y el marcador elegido se aplica a reproductores abiertos después. No requiere tabla, columna ni migración de Supabase.
- CI y Pages para el commit de merge pasaron (enlaces en la sección 1). Sigue pendiente la prueba manual autenticada de guardar/reabrir un Material con audio y probar los saltos.
- PR #111 quedó fusionada: https://github.com/Teliu-p/BandaBase/pull/111. La herramienta ⏱ captura el tiempo del control de audio enfocado o del único reproductor que se está reproduciendo; cuando no puede identificar un punto sin ambigüedad, conserva el ingreso manual. No cambia Supabase, Storage, datos, RLS ni migraciones.
- Pendiente manual: con sesión autenticada, guardar/reabrir un Material que contenga audio y probar inserción/salto por marcador. La CI usa stubs y no cubre esa sesión real.
- PR #112 quedó fusionada en `611043389f58a962152f16cabdedd5c18b165865`: https://github.com/Teliu-p/BandaBase/pull/112. Añade modo opcional sincronizado con el audio de referencia usando BPM/métrica conocidos; sigue play/pause/seek, cambios de marcador y cancela clics futuros al cambiar la reproducción. Reduce la anticipación inicial de 50 ms a 10 ms y conserva el planificador a 120 ms para los siguientes clics.
- PR #113 quedó fusionada: https://github.com/Teliu-p/BandaBase/pull/113. «Guardar ajuste manual» captura la fase después de alinear de oído un único audio con el metrónomo independiente. La referencia se guarda en localStorage por canción y adjunto, se reutiliza al sincronizar y exige el mismo BPM/métrica. No altera la base de datos.
- Pendiente de verificación manual: probar la calibración y reanudación con una grabación real, idealmente con silencio al inicio o anacrusa. La CI usa stubs y no puede verificar alineación audible.
- No aumentar volumen de audio usando Web Audio sin comprobar CORS en las URLs firmadas de Storage: según el navegador, una fuente remota no autorizada para CORS puede producir silencio si se conecta a Web Audio. Conservar un fallback de `<audio>` nativo.

## 3A. Recuperar velocidad de audio y descarga de adjuntos (PR #114, rama de trabajo)

- PR #114 fusionada como `ddaf9a073b5fbf5def723e4bbab02781ba439800`: https://github.com/Teliu-p/BandaBase/pull/114. Los controles y pruebas están en main; confirmar los workflows actuales para el SHA fusionado.
- Materiales vuelve a disponer de velocidades 25%, 50%, 75%, 100%, 125%, 150%, 175% y 200%, más entrada porcentual personalizada de 25% a 200%. Se configura `HTMLMediaElement.playbackRate` y se solicita `preservesPitch`/alias del navegador. La velocidad recordada queda por ID de adjunto mientras la página siga abierta; no se almacena en Supabase.
- Se agrega descarga forzada por URL firmada a archivos de Materiales, comentarios de canción/generales y Propuestas. Se usan los metadatos de adjunto y una URL de corta duración; no se modifican objetos, filas, políticas, RLS o migraciones.
- La reproducción de audios usa el `<audio>` nativo bajo demanda. En el código inspeccionado no hay temporizador que vaya avanzando el audio ni reconstrucción de la señal en JavaScript; por eso no se identificó una fuente de deriva acumulativa dentro del reproductor. El metrónomo sincronizado sigue una cuadrícula de BPM conocido y `audio.currentTime`, no detecta golpes de la forma de onda. No hay prueba automatizada que mida deriva audible en un archivo real; queda pendiente comprobarlo con una grabación real.
- Corrige el cálculo del origen de calibración del metrónomo a partir de `elapsedContextSeconds * playbackRate`, necesario si se calibra con el audio a una velocidad distinta de 1×.
- CI comprobada para el estado de código previo a las actualizaciones documentales: https://github.com/Teliu-p/BandaBase/actions/runs/39364004244 (npm tests, ESLint/no-undef y smoke tests de Chromium, éxito). No equivale a prueba audible autenticada ni a una prueba de descarga contra una cuenta real. La comprobación más reciente se repetirá tras documentar.

## 3B. Figuras, silencios y puntillo en Materiales (PR #115 fusionada)

- La PR #115 (https://github.com/Teliu-p/BandaBase/pull/115), rama `feat/material-note-rest-dotted`, fue fusionada como `b96bd579234c86f99d89c693bba9727fa21761c2`. Tests de main y Pages pasaron: [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39386371929) · [Pages](https://github.com/Teliu-p/BandaBase/actions/runs/39386371276).
- Los símbolos se insertan como texto musical Unicode en el rich text existente. La modificación no altera el esquema, los datos, las políticas, RLS, Storage ni las migraciones de Supabase.
- Se añadieron pruebas para los diez símbolos, sus formas con puntillo, el orden de controles y el restablecimiento del puntillo. La CI pasó tanto en la PR como en main. No se hizo una comprobación visual manual en el navegador del usuario; conviene verificar que los glifos se vean con la fuente disponible.

## 3C. Unión visual de figuras y nuevos atajos (PR #117 fusionada)

- La PR #117 (https://github.com/Teliu-p/BandaBase/pull/117), rama `feat/materials-note-beaming-shortcuts`, agrupa de a dos las corcheas y semicorcheas consecutivas sin puntillo usando los glifos Unicode de notas ligadas visualmente (`♫` y `♬`). No pretende ser un grabador de partituras completo: el compositor sigue siendo texto inline, sin pentagrama ni alturas.
- Aumenta los símbolos de la barra sin alterar el tamaño de las figuras insertadas en los renglones del material.
- Atajos: Alt+1–6 conserva funciones; Alt+Q/W/E/R/T inserta figuras; Alt+A/S/D/F/G inserta silencios; Alt+Z puntillo; Alt+X marcador; Alt+C/Alt+V agrega/quita sangría; Alt+0 restablece el formato normal y desactiva el puntillo.
- PR #117 fue fusionada como `5ab8c9960967a8ada41575ad5a2298a3db2a71da`. Pasaron Tests y Pages de main para ese SHA. Falta comprobar manualmente el renderizado real de los glifos; no se cambia Supabase ni sus migraciones.

## 3D. Notación musical vectorial y compatibilidad de fuentes (PR #119 fusionada)

- La PR #119 (https://github.com/Teliu-p/BandaBase/pull/119), rama `fix/materials-portable-notation-20261020`, fue fusionada como `b4df67ce393a6d199fa1fa436c67b95dcf59ab78`. Reemplaza la visualización de figuras y silencios por SVG inline generado desde una lista permitida para no depender de fuentes musicales instaladas.
- Los símbolos nuevos se guardan como `span` canónicos con una clave validada; el SVG no se acepta desde contenido arbitrario. El renderizador también convierte los caracteres Unicode viejos, incluidos puntillos y parejas de corcheas/semicorcheas, para que los materiales existentes sigan viéndose.
- El icono dentro del renglón mide 1,35 em frente a una línea de 1,6 em (aprox. 85%). Los botones conservan su tamaño actual. No se toca Supabase, Storage, políticas ni migraciones.
- La CI de la PR pasó las regresiones, ESLint y smoke tests de Chromium; Tests y Pages del merge de main están verificándose. La prueba de Chromium automatizada confirma que se generan los diez SVG, pero no sustituye la inspección visual en la computadora afectada.

## 3E. Ajuste de tamaño de figuras musicales al alto de una mayúscula (PR #121 y seguimiento #122)

- La PR #121 (https://github.com/Teliu-p/BandaBase/pull/121) fue fusionada como `d1c53a10c9d6ef459058c5e1e8ad4b2e9e923386`. Tests y Pages de main pasaron: [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39444107185) · [Pages](https://github.com/Teliu-p/BandaBase/actions/runs/39444106008). Ese primer ajuste redujo la caja a `0.72em`, pero la revisión del `viewBox` mostró que el margen interno hacía que la tinta visible quedara más pequeña que una mayúscula.
- El seguimiento PR #122 (https://github.com/Teliu-p/BandaBase/pull/122), rama `fix/materials-notation-visual-cap-height-20261020`, usa para figuras con plica una caja de `0.96em` y `vertical-align: -0.145em`; la blanca (`noteHalf`) ajusta su caja a `0.9em`/`-0.096em` por el contorno exterior y la redonda usa `-0.133em` para alinear la cabeza. Las parejas usan `0.925em` de ancho, `0.82em` de alto y `vertical-align: -0.106em`. Los trazos principales suben a `2.8` unidades SVG para acercarse al grosor de las letras. Las regresiones verifican dimensiones, alineación y grosor.
- La regresión CSS fija estas dimensiones y la alineación; los botones de la barra permanecen intactos. No se modifica el dibujo SVG, el contenido guardado, Supabase, Storage, RLS ni migraciones. La CI pasó en el commit con las dimensiones finales (`becfc32f847e2a7160d7e5286b7739aafb9899c4`): [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39445031361). Se volverá a comprobar el último commit tras esta actualización documental; la inspección visual manual sigue pendiente.

## 4. Incidente de guardado de Materiales con audios

- Reporte recibido el 2026-10-15: al editar Materiales e insertar audios, pulsar «Guardar material» deja el editor abierto sin feedback visible.
- Inspección de código encontró dos fallos de manejo defensivo: el guardado retornaba silenciosamente si faltaba el contexto de banda/canción y no tenía una captura general para promesas asíncronas rechazadas por Storage/RPC/red. Tampoco mostraba progreso durante el guardado.
- PR #105: https://github.com/Teliu-p/BandaBase/pull/105 añade estado de guardado, bloqueo de envíos duplicados, mensajes de progreso, notificación cuando falta el contexto y compensación ante excepciones inesperadas antes de persistir los bloques. Una vez persistidos los bloques, evita borrar el contenido ante un fallo posterior de refresco.
- PR #106: https://github.com/Teliu-p/BandaBase/pull/106 protege el caso ambiguo en que la conexión se pierde mientras se espera replace_material_blocks: no elimina automáticamente adjuntos porque la transacción pudo haberse confirmado aunque la respuesta no haya llegado al navegador. Pide recargar y verificar el contenido antes de reintentar.
- Regresiones añadidas: rechazo de promesa de subida, limpieza de carga parcial y contexto de guardado ausente. CI pasó npm test, ESLint no-undef y smoke tests de Chromium en https://github.com/Teliu-p/BandaBase/actions/runs/38807174499.
- La consulta de logs no aportó una subida fallida correlacionable; no hay evidencia suficiente para atribuir el síntoma a una política RLS o a una migración. El fallo exacto de la sesión del usuario no se reprodujo; esta corrección hace visibles esos caminos y evita silencios ante excepciones.
- No se modificó esquema, políticas, datos ni Storage de producción. Revisar el estado de PR/merge/deploy antes de afirmar que el arreglo ya está publicado.

## 5. Estado de Supabase observado en solo lectura

- Las tablas públicas devueltas por list_tables tenían RLS habilitada.
- Tablas principales presentes: bands, profiles, band_members, songs, song_singers, materials, material_blocks, material_attachments, comments, comment_blocks, comment_attachments, band_lists, band_list_items, band_list_managers, proposals, proposal_options, proposal_votes, proposal_blocks, proposal_attachments y audit_log, además de tablas heredadas de ensayos/listas/decisiones/problemas.
- Conteos aproximados devueltos por la herramienta: 15 canciones, 3 miembros en band_members, 3 listas, 4 propuestas, 7 votos y 983 filas de audit_log en el momento de la consulta. Los conteos son volátiles, no deben usarse para suponer que los datos no cambiaron.
- La columna songs.genre es actualmente text[]; songs incluye estado/preparación, estado activo, campos de repertorio y columnas de papelera.
- La función de creación de canción en el cliente hace INSERT en songs y atribuye created_by al usuario autenticado. La RLS songs_insert_own requiere pertenencia a banda y que created_by corresponda al auth.uid().

## 6. Diferencia del historial de migraciones

Comparación de los árboles de archivos y list_migrations el 2026-10-14:

- Archivos SQL locales en main: 56.
- Versiones registradas en Supabase: 44.
- Local-only (12): 20261007173000_comment_attachments_blocks; 20261007190000_band_list_participation_permissions; 20261007200000_song_genres_array; 20261007203000_proposal_attachments; 20261007210000_proposal_content_blocks; 20261007220000_permissions_audit_and_trash; 20261007221500_secure_anonymous_vote_stats; 20261007223000_permissions_hardening; 20261007224000_allow_member_soft_delete; 20261007225000_allow_users_to_complete_soft_delete; 20261007225500_remove_legacy_comment_access; 20261008180900_harden_material_comment_proposal_storage.
- Remote-only: ninguna en la comparación.
- El grupo viejo de versiones remotas sin archivos locales fue recuperado anteriormente y está resuelto. No volver a etiquetarlo como pendiente.
- Los doce archivos local-only no están obsoletos en bloque: algunos crean tablas/funciones o efectos de los que dependen migraciones registradas posteriores. Varias políticas fueron endurecidas después, pero eso no permite eliminar el archivo entero.
- Dos archivos tienen operaciones que escriben o transforman datos: normalización de estados de participación y conversión de genre a array. No volver a ejecutarlos completos sin análisis.
- No ejecutar supabase db push, no hacer migration repair en bloque, no insertar manualmente en schema_migrations ni mover/borrar migraciones para hacer coincidir conteos. Consultar docs/database-migration-history-reconciliation-followup.md para el razonamiento detallado.

## 7. PR y problema de permisos en listas

- PR #98: https://github.com/Teliu-p/BandaBase/pull/98
- Rama fix/band-list-update-policy-integrity, HEAD observado 9ff8d5b2bcf3bf3a272e47a4af770747aff9af52.
- Al último chequeo, la PR seguía abierta como draft; no estaba fusionada ni aplicada a producción.
- En Supabase están simultáneamente las políticas UPDATE band_list_items_update_control y band_list_items_update_control_v2. Las políticas permissive se combinan de forma que una política adicional puede ampliar acceso aunque la otra sea más estricta. La PR propone eliminar la política v2 y endurecer el trigger, pero debe revisarse contra el estado exacto y probarse antes de merge/aplicación.
- CI previo de la PR pasó pruebas de políticas Postgres aisladas y smoke tests, pero no es una prueba E2E completa contra producción.

## 8. Advertencias del asesor de Supabase observadas

### Seguridad

- get_proposal_vote_stats(uuid[]) y is_band_member(uuid) aparecen como funciones SECURITY DEFINER ejecutables por authenticated. Determinar si es intencional según el cuerpo, datos devueltos y consumo desde cliente; no cambiar permisos solo para silenciar el asesor.
- La protección de contraseñas filtradas de Auth está deshabilitada. Revisión de configuración recomendada; cambiarla afecta UX del signup.

### Rendimiento / RLS

- Se detectaron 26 claves foráneas sin índice de cobertura.
- Se listaron 12 índices no usados en la ventana/telemetría revisada; no eliminarlos sin carga representativa.
- El asesor informó 12 casos de múltiples políticas permissive. Varias son separaciones intencionales de flujo (p. ej. editar/restaurar/papelera), pero cada una debe analizarse; el caso de band_list_items UPDATE es un riesgo ya identificado.

## 9. Incidencias históricas para no reintroducir

Errores que aparecieron en iteraciones previas: canManageComment is not defined; toggleSongrepertoire is not defined; load.songs is not defined; handleAuthSession is not defined; populateColorfilter is not defined; login que parecía no reaccionar; error de save de material relacionado con WITH ORDINALITY. No se deben dar por actuales sin reproducir. Al corregir funciones compartidas o contratos de datos, ejecutar las regresiones relacionadas.

## 10. Qué falta para una comprensión más profunda

- Pruebas autenticadas contra un entorno seguro que ejerciten permisos con roles distintos y RLS real; la suite actual no cubre todo eso.
- Revisión completa de cada política y SECURITY DEFINER por su intención de negocio, no solo del inventario.
- Comparación periódica de las tablas/funciones/policies remotas con el estado esperado versionado, sin aplicar reparaciones automáticas.
- Matriz de cobertura funcional que relacione cada requisito con módulo, función, tabla/RPC/policy y prueba.

## 11. Actualización de este archivo

Cada cambio que modifique el estado abierto debe ajustar esta página en la misma PR. Una incidencia queda cerrada solo si existe evidencia concreta de su resolución. Los recuentos, SHA, estado de PR y lints son fotografías y se tienen que consultar de nuevo antes de actuar.

## 12. Estado tras auditoría exhaustiva y correcciones (2026-10-20)

### Cambios fusionados y comprobados por CI

- **PR #123:** corrige la sangría inversa en varias líneas cuando el navegador divide nodos de texto; restaura Alt+1–6 para negrita, cursiva, paréntesis, corchetes, A+ y A++. Pruebas de regresión Playwright cubren tres líneas y los seis atajos.
- **PR #124:** reemplaza la política SELECT de Storage con comprobación del registro padre y su estado activo; consolida las políticas permisivas UPDATE de `band_list_items`; crea índices para las 26 claves foráneas que el asesor señalaba.
- **PR #126:** fija el CDN del cliente `@supabase/supabase-js@2.118.0`.
- **PR #127:** evita respuestas atrasadas de Materiales, Comentarios y Comparación que sobrescriban la canción activa; serializa sesión nueva y descarta el estado anterior.
- **PR #128:** añade RPC transaccionales para guardar los datos de la lista con sus responsables y cambiar una canción entre varias listas.
- **PR #129:** valida en el cliente el límite de 50 MiB antes de aceptar adjuntos en Materiales, Comentarios y Propuestas.
- **PR #130:** actualiza campos de canción y relación `song_singers` en una transacción; elimina comentarios múltiples en una sola operación que falla completa si un ID no es visible, ya fue borrado o no se puede modificar.
- **PR #131:** serializa `initializeApp()` entre cambios de usuario/logout y captura excepciones de red de login, signup y logout.

### Migraciones aplicadas a Supabase

La transacción de validación conjunta pasó con rol `authenticated` y acabó en `ROLLBACK`, sin mantener los datos de prueba. Después se aplicaron, en orden, estas tres migraciones:

- `20261020232312_harden_storage_and_list_item_policies.sql`
- `20261020232328_atomic_list_editor_and_song_assignments.sql`
- `20261020232333_atomic_song_and_comment_bulk_writes.sql`

Verificación post-aplicación: la política SELECT de Storage y la política UPDATE de `band_list_items` quedan cada una en una sola política con esos nombres; las cuatro RPC nuevas existen como SECURITY INVOKER y EXECUTE no se concede a `anon`/PUBLIC; las 26 claves foráneas señaladas ahora tienen un índice de cobertura. El asesor de rendimiento aún informa índices nunca usados (esperable en una base de muy poco volumen recién indexada) y políticas múltiples en otras entidades; no eliminar índices por el aviso de uso sin revisar volumen real y planes de consulta.

### Pendientes con evidencia actual

- **Límite real de Storage (2026-10-20):** bucket privado `materials` tiene `file_size_limit = 52428800` bytes (50 MiB); se verificó el valor guardado tras la actualización solicitada. La interfaz mantiene el mismo límite. `allowed_mime_types = null` sigue aceptando los formatos permitidos por el resto de la aplicación; no añadir una allowlist sin revisar primero todos los adjuntos de Materiales, Comentarios y Propuestas. El plan Free limita el máximo global a 50 MB, que prevalece si es menor que el valor del bucket. El cambio puntual se realizó en la configuración del bucket con SQL porque las herramientas conectadas no ofrecían una acción de actualización de Storage; para futuros cambios complejos, preferir Dashboard o Storage API. Para archivos mayores de 6 MB, Supabase recomienda uploads reanudables.
- **Auth:** sigue activo el aviso `auth_leaked_password_protection`. Los avisos de `is_band_member` y `get_proposal_vote_stats` como SECURITY DEFINER disponibles a usuarios autenticados permanecen sin cambios; inspeccionamos sus definiciones y no encontramos una vulnerabilidad confirmada, pero su superficie debe seguir revisándose.
- **Migraciones históricas:** los 44 registros remotos previos coincidían con el estado documentado; las tres nuevas versiones se registraron correctamente y su nombre local se alinea en esta rama con la versión remota. La discrepancia histórica anterior de 12 archivos locales sin una fila remota equivalente sigue abierta como asunto independiente; no ejecutar `db push`, no insertar versiones manualmente y no borrar SQL histórico para esconderla.
- **Prueba funcional real:** la CI usa un stub de Auth. Las pruebas simulan respuestas y transacciones autenticadas en SQL, pero aún conviene hacer una pasada manual con una cuenta de prueba para guardar una canción con cantantes, crear/editar una lista y responsables, asignar/quitar canciones, guardar/borrar comentarios con adjuntos y descargar archivos en registros activos/eliminados.
- **Asesores:** queda habilitar la protección contra contraseñas filtradas mediante Auth settings y revisar, por separado, las políticas múltiples restantes. No reducir permisos ni quitar índices automáticamente.

## 12. Corrección de sincronización entre dispositivos, instrumentos y Materiales (2026-10-21)

### Actualizaciones en tiempo real
La inspección de Supabase encontró la publicación `supabase_realtime` sin tablas. La migración `20261021224042_enable_realtime_for_bandabase.sql` se aplicó; una consulta posterior confirmó 20 tablas habilitadas. El cambio solo altera la publicación, no los datos de canciones, comentarios ni materiales.

`src/app-realtime.js` escucha eventos PostgreSQL y refresca las vistas con nuevas consultas bajo RLS. Cubre canciones/cantantes, materiales, comentarios (incluidos bloques y adjuntos), listas/participación, propuestas/votos e integrantes. Hay limpieza al cerrar sesión, avisos ante errores de conexión y protección para diferir actualizaciones cuando hay borradores abiertos. Las notificaciones Realtime son señales para reconsultar; no deben tratarse como una fuente de datos garantizada ante una desconexión.

### Iconos y editor
- Los instrumentos se renderizan con SVG local generado por `getBandInstrumentIconHtml`, en lugar de caracteres emoji. La vista de perfiles, las plazas de instrumentos de una lista, los contadores de capacidad y la participación usan la misma fuente gráfica.
- `src/materials-editor.js` intercepta Enter/Shift+Enter e inserta saltos `BR` explícitos. Antes de extraer bloques de texto y adjuntos, normaliza los `DIV/P` del DOM contenteditable, incluidos renglones vacíos. `src/styles.css` conserva el espacio en blanco en la vista guardada para que los saltos/sangrías coincidan mejor con la edición.
- Una prueba de regresión verifica el orden texto–adjunto de audio–texto y la preservación de dos saltos entre líneas.
- **Verificación:** CI #618 pasó npm test, ESLint y Chromium. Esto no prueba que WebSockets funcionen a través de las redes de dos PCs reales; queda la comprobación manual autenticada y la verificación del despliegue de Pages.

