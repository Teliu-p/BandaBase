# Estado técnico actual de BandaBase

**Última actualización:** 2026-11-06, Argentina.  
**Último HEAD funcional inspeccionado:** `2d0af16f527fc29d4b840ff9a2f2d884b8af55fb` (PR #147 fusionada). Después se agregaron commits exclusivamente documentales; verificar el HEAD actual antes de trabajar. Tests [#42098668867](https://github.com/Teliu-p/BandaBase/actions/runs/42098668867) y Pages [#42098667320](https://github.com/Teliu-p/BandaBase/actions/runs/42098667320) pasaron. El arrastre de adjuntos requiere validación manual del usuario; PR #148 está abierta y su ejecución de Tests observada falló: [#42101112706](https://github.com/Teliu-p/BandaBase/actions/runs/42101112706).  
**Supabase:** `evuwcikuxptrgzdzejov`, PostgreSQL 17.11, ACTIVE_HEALTHY.  
**Auditoría integral vigente:** [technical-audit-2026-11-05.md](technical-audit-2026-11-05.md). La auditoría fue de solo lectura; no se tocaron datos, esquema, permisos ni lógica funcional.

## 0. Fotografía integral del 2026-11-05

- 28 tablas públicas observadas; todas con RLS habilitada. 20 tablas publicadas en Realtime.
- Storage: bucket `materials` privado, límite 50 MiB. Audio de Materiales usa la biblioteca local del host, servidor Python y Tailscale Funnel; no confundir disponibilidad del host con disponibilidad de Supabase.
- Migraciones: 60 archivos SQL en origin/main y 60 versiones en el historial remoto. Las 12 versiones que faltaban se marcaron como aplicadas mediante migration repair solo de metadatos, sin ejecutar sus SQL. Comparación exacta posterior: 0 faltantes en ambos sentidos y 0 duplicados. La reparación no demuestra por sí sola la ejecución histórica exacta de cada sentencia; no re-ejecutar SQL antiguo ni usar db push a ciegas.
- Asesores Supabase: 2 funciones SECURITY DEFINER ejecutables por authenticated (`get_proposal_vote_stats`, `is_band_member`); ambas parecen responder a necesidades funcionales/RLS y no deben revocarse sin revisar sus usos. Protección de contraseñas filtradas desactivada. Rendimiento: 33 índices sin uso observado y 11 combinaciones de políticas permisivas múltiples; medir antes de modificar.
- PR #147 está fusionada. CI y Pages pasaron. PR #148 sigue abierta; el run observado de Tests falló. Validación manual multiusuario y del gesto de arrastre sigue pendiente.
- Ver el informe integral para matriz de riesgos, límites de esta inspección y plan de validación.

---
## 0. PR #141 — adjuntos múltiples y reordenamiento de audio (2026-11-05)

- PR #141 quedó fusionada en `main` como `f65735cdf3d5f1a92b4e9d68363d57284df484c1`: https://github.com/Teliu-p/BandaBase/pull/141.
- Tests de la PR pasaron en el último commit probado `5baae327d662fc2e5d388ef22f200b5ecb55ffe2`, incluyendo npm test, ESLint/no-undef y Playwright/Chromium. La regresión inserta tres FLAC y comprueba con mouse down/move/up que se mueve el mismo nodo y que el orden serializado coincide.
- `index.html` marca `#materialPendingFile` como `multiple`; el handler valida toda la selección y la inserta en el cursor. El guardado conserva los flujos: audio a la biblioteca local; archivos no-audio a Storage.
- Los chips de audio usan Pointer Events, no `draggable=true` de HTML5. Se previene la selección nativa y se mueve el mismo nodo existente. No hay tablas, filas auxiliares, migraciones ni cambios en Supabase.
- Verificación del repositorio: `main` quedó en `f65735cdf3d5f1a92b4e9d68363d57284df484c1` y contiene el selector múltiple y los eventos Pointer. El estado final del deployment de GitHub Pages no pudo comprobarse desde el conector disponible; no afirmar que la versión pública ya refleja este commit hasta comprobarlo.

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
- La inspección de producción del 2026-11-06 muestra una sola política UPDATE: band_list_items_update_control, consolidada por 20261020232312_harden_storage_and_list_item_policies.sql. La antigua política band_list_items_update_control_v2 ya no existe. Por lo tanto, no fusionar la migración propuesta en PR #98: fue escrita contra un estado anterior de main y pretende volver a reemplazar una política que ya está consolidada.
- La brecha que sí persiste está en private.prevent_manager_list_item_edit(): un integrante anotado podía modificar campos de su propia fila además de sus instrumentos. PR #149 propone una migración trigger-only que no cambia la política RLS. Sigue en borrador; CI pasó en un PostgreSQL 17 descartable, pero falta validarla sobre una copia restaurada fiel al proyecto y hacer la prueba autenticada multiusuario.

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
- **Migraciones históricas (actualización 2026-11-06):** GitHub origin/main y Supabase tienen ahora 60/60 versiones idénticas. Las doce versiones fueron registradas con el CLI oficial en modo applied, sin ejecutar su contenido. No insertar filas manualmente, no borrar archivos SQL y no ejecutar db push para re-aplicar la historia. La igualdad de metadatos no prueba la secuencia exacta de cada transformación histórica de datos; ver el addendum de docs/database-migration-history-reconciliation-followup.md.
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

## 13. Pegado enriquecido, comparación compartida y reproducción agrupada (2026-10-26)

- **Portapapeles enriquecido:** `src/materials-editor.js` obtiene `text/html` y `text/plain`. `createMaterialClipboardFragment` normaliza bloques de lista/párrafo, pasa el HTML por la allowlist de Materiales y descarta scripts, estilos y contenido embebido activo. Conserva formatos admitidos, enlaces, símbolos musicales vectoriales y marcadores. Si la selección contiene un chip de audio renderizado, pega su nombre legible, no una referencia de adjunto que pertenezca a otro material.
- **Comparación con original:** `src/songs-comparison.js` presenta sus bloques con `renderMaterialViewBlock` y enlaza sus controles con `bindMaterialViewEvents`. El botón de edición abre `openMaterialEditor` en modo `COMPARISON_MATERIAL_TYPE`; `src/materials-save.js` usa el flujo normal de adjuntos/bloques y recarga la comparación al finalizar. `src/materials-data.js` conserva un tipo explícito al crear, con `Texto` como valor por defecto. El detalle de canción limpia la comparación anterior al cambiar de tema.
- **Calibración del metrónomo:** `src/metronome.js` guarda el desfase manual bajo una clave por canción y verifica BPM/métrica. Al leer puede migrar una calibración previa por adjunto desde cualquiera de las pistas disponibles. No requiere conservar activo el archivo que se calibró originalmente.
- **Grupo de pistas:** clic derecho alterna la selección de cada chip de audio; clicar Play en una de las pistas seleccionadas prepara URLs/metadatos, alinea los playheads con precisión de milisegundos, copia la velocidad de reproducción y llama a `play()` para las pistas juntas. Se aplica a los audios visibles tanto en Materiales normales como en comparación. Si se cierran/colapsan los materiales de una pista seleccionada, deben estar abiertos para que la app encuentre el reproductor.
- **Validación pendiente fuera de CI:** comprobar el comportamiento auditivo con un original y varios splits reales, la tolerancia de deriva después de varios minutos, y las restricciones de autoplay del navegador. No inferir que la prueba auditiva está completa a partir de la simulación de Playwright.



## 14. Integración de biblioteca local de audio (PR #136 integrada, 2026-11-03)

- PR #136 se fusionó en `main` como `e96712ee41de5599e36a58b1d1dd72d2919946bd`, basada en el HEAD anterior `f215f6222f8b0a4c590f0f60d0cd7742f0c2125e`.
- `src/attachment-access.js` centraliza la resolución de adjuntos. Para MIME `audio/*` pide un ticket al servidor local usando la tabla y el UUID del adjunto con el JWT del usuario; el servidor local verifica el registro con Supabase/RLS y entrega el archivo del manifiesto. Materiales (incluidos marcadores, reproducción y descarga), Comentarios (reproducción, apertura y descarga) y Propuestas (apertura y descarga) llaman al resolutor común.
- Si el adjunto no está copiado en la biblioteca (HTTP 409), el servidor local no está disponible o no hay token local utilizable, se mantiene el acceso firmado actual de Supabase Storage. Los rechazos HTTP del servidor, especialmente 403, no se silencian mediante fallback. Los adjuntos no-audio permanecen en Storage.
- El endpoint por defecto en la app es `http://127.0.0.1:8788`. `window.BANDABASE_AUDIO_SERVER_URL` permite configurarlo para un host HTTPS futuro. El valor de Funnel aún no se conoce/configura; mientras tanto, este modo solo apunta a un servidor en la misma computadora. El acceso desde dispositivos externos queda pendiente.
- Prueba manual previa de extremo a extremo del servidor (desde la página desplegada con sesión real): ticket HTTP 200, HEAD 200, MIME `audio/flac`, Content-Length 11.441.359, Range 206 y 1024 bytes recibidos; el FLAC se reprodujo audiblemente en un reproductor temporal. Esto no valida todavía los controles finales de la interfaz.
- No se cambiaron datos, tablas, `storage_path`, políticas, RLS, Storage ni migraciones.
- **CI de la PR aprobada:** workflow [Tests #41720921806](https://github.com/Teliu-p/BandaBase/actions/runs/41720921806) en `f6440040196e25553a5eb4ed73b6e11b300e028a`: `npm test`, ESLint `no-undef` y Playwright/Chromium (14 pruebas) pasaron. Tras el merge, [Tests de main #41721358288](https://github.com/Teliu-p/BandaBase/actions/runs/41721358288) y [Pages #41721358287](https://github.com/Teliu-p/BandaBase/actions/runs/41721358287) también pasaron.
- Pendiente: prueba autenticada con los controles finales de Materiales/Comentarios/Propuestas en la web desplegada y configuración de Funnel para probar el acceso desde una segunda computadora.

## 15. Configuración de acceso mediante Tailscale Funnel (2026-11-03)

- El host Windows tiene Tailscale 1.104.5 conectado como `laptop-2pepu3jl`. Funnel se inició en primer plano y publicó `https://laptop-2pepu3jl.tail831d95.ts.net/` como proxy de `http://127.0.0.1:8788`.
- Verificación manual: `/health` por HTTPS respondió `ok=true`; el POST sin credenciales a `/api/ticket` devolvió 403 local y público, con el mismo cuerpo «Falta la sesión autenticada de BandaBase.»; el preflight OPTIONS desde el origen de GitHub Pages respondió 204 y permitió los encabezados Authorization/Content-Type y el método POST.
- El usuario confirmó reproducción normal desde el reproductor habitual de Materiales en la computadora anfitriona. Esto valida la interfaz de esa computadora, no todavía el acceso desde otro equipo.
- PR #137 (`funnel-audio-config-20261103`) quedó fusionada en main como `678c218ac591f25d022d760280249158cfddefd8`. Añade `src/audio-server-config.js`, cargado antes de `attachment-access.js`, y configura el hostname HTTPS. La regresión comprueba el orden y el uso de ese hostname. Tests [#41723820635](https://github.com/Teliu-p/BandaBase/actions/runs/41723820635) y Pages [#41723820206](https://github.com/Teliu-p/BandaBase/actions/runs/41723820206) pasaron.
- Pendiente: verificar reproducción autenticada desde otra PC y fallback a Storage cuando el host esté apagado. Mantener abiertas las ventanas del servidor Python y de Funnel para la prueba.
- No se modificó Supabase, RLS, Storage, esquema, datos ni migraciones.


## 16. Resultado de integración y despliegue Funnel (2026-11-03)

- PR #137 quedó fusionada en main como `678c218ac591f25d022d760280249158cfddefd8`; el HEAD se verificó después del merge.
- Tests de main [#41723820635](https://github.com/Teliu-p/BandaBase/actions/runs/41723820635) pasaron incluyendo regresiones, ESLint no-undef y smoke tests con Chromium. GitHub Pages [#41723820206](https://github.com/Teliu-p/BandaBase/actions/runs/41723820206) completó build y deploy con éxito.
- La aplicación carga `src/audio-server-config.js` antes de `src/attachment-access.js`, por lo que el resolutor utiliza el hostname HTTPS de Funnel. Se mantiene el envío del JWT de sesión y la consulta con RLS del servidor.
- Pendiente exclusivamente la prueba autenticada de reproducción desde una segunda computadora. El usuario debe mantener encendidos/despiertos el equipo anfitrión, el servidor Python y Funnel.
- No se modificó Supabase, RLS, Storage, esquema, datos ni migraciones.

## 17. Fallback de Storage con Funnel/servidor local no disponible (2026-11-04)

- Al probar desde una segunda computadora cuando el host estaba apagado, el usuario observó que los audios dejaron de reproducirse. No se obtuvo el código HTTP real del intento que falló, por lo que no se afirma que el proxy haya respondido necesariamente 502.
- La inspección del resolver de main encontró que un fallo de red/timeout y HTTP 409 activaban el fallback a Supabase Storage, pero cualquier otro HTTP no exitoso (incluidos 5xx del proxy) se convertía en error explícito y cortaba el flujo.
- PR #138 integró el fallback a Storage para HTTP 500–599. Los 4xx (incluido 403) siguen siendo errores explícitos. Se agregaron pruebas para 500, 502, 503 y 504.
- La hipótesis de 5xx como causa concreta del incidente todavía requiere una prueba real con el host apagado. El cambio es una corrección defensiva del camino de fallback.
- PR #138 se fusionó en `main` como `28cbe3141ea6924d7c2562b65c33f6edd7325d5e`. Tests de la PR [#41901884137](https://github.com/Teliu-p/BandaBase/actions/runs/41901884137), Tests de main [#41955423709](https://github.com/Teliu-p/BandaBase/actions/runs/41955423709) y despliegue de Pages [#41955423316](https://github.com/Teliu-p/BandaBase/actions/runs/41955423316) finalizaron correctamente.
- Revisión estática de la copia de `bandabase_audio_server.py` compartida en Library: `127.0.0.1` como bind, lista cerrada de rutas, 404 para rutas no reconocidas, sin directory listing ni rutas arbitrarias; ticket de medios validado por HMAC y expiración, emitido solo después de consultar el adjunto con el JWT del usuario contra Supabase/RLS. `server-config.json` y `library-manifest.json` quedan fuera de `LIBRARY_DIR`; el endpoint de medios solo resuelve claves opacas dentro de esa carpeta. El registro oculta los tickets de `/api/media/`.
- Los logs compartidos muestran solicitudes de escaneo a `/.env`, `/.aws/credentials`, etc. y a `/`, todas con HTTP 404. No hay evidencia en esos registros de que se haya servido un archivo. La auditoría es de la copia compartida, no de una lectura directa del archivo en Windows; no se verificaron ACL NTFS ni igualdad de hash con la instalación actual.
- Riesgos residuales observados en código: los tickets son bearer URLs válidas durante 60 minutos y no existe rate limiting de aplicación. No se modificó el servidor local en esta PR ni se alteraron datos, esquema, RLS o Storage.
- No se modificó Supabase, RLS, Storage, datos ni migraciones.


## 18. Audio de Materiales solo en biblioteca local (rama en preparación)

- Decisión solicitada: que los audios de Materiales no utilicen Supabase Storage ni como destino de subida ni como respaldo de reproducción. Solo se requiere validar el flujo desde la PC anfitriona; no se hará una prueba obligatoria desde otra computadora.
- En la rama `feat/material-audio-local-only-20261104`, `src/materials-save.js` crea filas de `material_attachments` con `storage_path = local:<clave-opaca>` y envía el archivo por HTTPS al servidor local. No llama a `storage.from("materials").upload` para audio. Los archivos no-audio de Materiales mantienen Storage.
- `src/attachment-access.js` no recurre a Storage para audio de `material_attachments` ante 409, 5xx ni error de red; muestra un error explícito. Audio de Comentarios/Propuestas conserva el fallback previo. La vista identifica audios por MIME, extensión y prefijo `local:`.
- El nuevo servidor Python (versión 0.3) acepta `POST /api/upload/<attachment_id>` y `POST /api/delete/<attachment_id>`. Upload valida JWT, fila bajo RLS y creador/admin del Material; escritura por streaming, temporal y reemplazo atómico dentro de `LIBRARY_DIR`; una clave ya existente no se sobrescribe y upload/delete por adjunto se serializan. Delete aplica RLS a la eliminación de la fila y elimina la copia local si está presente.
- Verificación real actual: `python -m py_compile` pasó y una prueba local HTTP aislada con Supabase simulado comprobó rechazo 403 sin sesión, upload 201, ticket 200, reproducción 200, Range 206, rechazo de sobrescritura 400 y delete 200. Esto no sustituye una prueba con JWT/RLS reales contra el proyecto ni una prueba del archivo instalado en Windows.
- La columna real `public.material_attachments.storage_path` es text; no requiere migración. Las políticas RLS reales permiten select a miembros y escritura al creador/admin. `is_band_admin(uuid)` existe y `authenticated` puede ejecutarla. No se cambiaron RLS, esquema, datos ni objetos Storage durante la preparación.
- Los audios existentes en Storage no se migran ni borran automáticamente. Si no están ya en la biblioteca local/manifest, no se reproducirán desde Materiales hasta volver a adjuntarlos desde la PC anfitriona. Las copias antiguas de Storage quedan intactas. Al borrar desde Materiales, si el servidor local está apagado, la compensación puede quitar la fila y dejar un archivo local huérfano que deberá limpiarse más adelante.
- Pendiente: revisión final, CI/Pages de la PR y prueba manual desde la misma PC anfitriona. El usuario todavía debe reemplazar manualmente `C:\\BandaBaseAudio\\bandabase_audio_server.py` por el archivo Python entregado; no está instalado remotamente desde GitHub.


## 19. Resultado final: audio de Materiales local-only (2026-11-05)

- PR #140 integrada en \`main\` como \`55ebb0ebc141f32c7276820617c74567d922650e\`: [PR #140](https://github.com/Teliu-p/BandaBase/pull/140).
- Tests de main [#41960155461](https://github.com/Teliu-p/BandaBase/actions/runs/41960155461) y despliegue GitHub Pages [#41960155134](https://github.com/Teliu-p/BandaBase/actions/runs/41960155134) terminaron correctamente en ese SHA.
- Audio de Materiales: nuevo guardado en biblioteca local por servidor autenticado; lectura exclusivamente local, sin fallback a Storage en error de red, HTTP 409/5xx o host apagado. Eliminación local con RLS. Archivos no-audio de Materiales y audio de Comentarios/Propuestas continúan en Storage.
- El servidor actualizado v0.3 se entregó como archivo \`bandabase_audio_server.py\` en la conversación; requiere reemplazo manual en \`C:\\BandaBaseAudio\\bandabase_audio_server.py\`. Se debe conservar \`library/\`, \`library-manifest.json\`, \`server-config.json\` y \`backup/\`.
- Verificación del script entregado: \`py_compile\`; prueba HTTP aislada con Supabase simulado (403 sin sesión, upload 201, ticket 200, Range 206, clave existente no sobrescrita 400 y delete 200). Aún falta ejecutarlo instalado en Windows con la sesión real de Supabase; esa será la prueba final desde la PC anfitriona, sin requerir otro dispositivo.
- No se ejecutaron migraciones ni se modificaron esquema, RLS, filas ni objetos de Storage. Audios históricos subidos a Storage quedan intactos; si no tienen copia en biblioteca/manifest, hay que volver a adjuntarlos desde el host para usarlos en Materiales. No hacer borrado masivo del bucket.

## Resultado — arrastre de audio con vista previa inline real (2026-11-05)

- PR #143 quedó integrada en `main` mediante squash merge, commit `e3830846b478004bb8d1611910cc58007ffeb785`: [PR #143](https://github.com/Teliu-p/BandaBase/pull/143).
- La vista previa es un `span.material-audio-drop-placeholder` sombreado dentro del flujo editable. Su ancho incluye el tamaño del chip y las separaciones laterales; mientras se arrastra se mueve por el renglón y desplaza realmente el texto. Al cambiarlo de lugar, el texto recupera el espacio anterior.
- El audio original se conserva separado durante el gesto. Al soltar, se coloca el mismo nodo DOM donde estaba el sombreado; ante `pointercancel`, se restaura el audio y los espacios originales en el punto de origen.
- CI de la PR pasó `npm test`, ESLint/no-undef y los smoke tests de Chromium: [Tests #42072480690](https://github.com/Teliu-p/BandaBase/actions/runs/42072480690). Se verificaron selección múltiple, reordenamiento entre chips después de reacomodar el renglón de origen, desplazamiento progresivo del sombreado en el renglón destino, ubicación final entre caracteres, identidad del adjunto y restauración al cancelar.
- Los workflows del merge en main también pasaron: [Tests #42072659164](https://github.com/Teliu-p/BandaBase/actions/runs/42072659164) y [GitHub Pages #42072657702](https://github.com/Teliu-p/BandaBase/actions/runs/42072657702).
- No hay cambios de esquema, migraciones, RLS, Storage ni operaciones sobre datos de Supabase.


## 20. Resultado final — movimiento directo de cualquier archivo en Materiales (2026-11-05)

- PR #144 integrada en `main`: https://github.com/Teliu-p/BandaBase/pull/144. Squash merge `858271ba90576ba3211305c17f06ec7285eeb29d`.
- La implementación anterior (#143) movía únicamente audio y no expresaba bien el gesto pedido. La especificación final es arrastrar cualquier chip de archivo con el botón izquierdo hacia cualquier posición horizontal o vertical del editor, no simular teclas Espacio/Backspace.
- Durante el arrastre, una copia visual del chip acompaña al puntero y un placeholder sombreado ocupa el punto de destino dentro del flujo editable. El texto se redistribuye alrededor del espacio provisional. Al soltar dentro del editor se coloca el mismo nodo DOM original, sin duplicarlo; cancelar o soltar fuera restaura el punto de origen.
- Los enlaces web no entran en el movimiento; el alcance es cualquier adjunto de tipo archivo, incluidos audio y PDF.
- Regresión Chromium: arrastra un PDF no-audio y comprueba que el chip visual sigue al puntero, que el placeholder se desplaza y empuja el texto, que el archivo queda entre los caracteres esperados y que se conserva la identidad DOM. Se mantienen cobertura de audio, orden y restauración al cancelar.
- Tests de PR [#42085812268](https://github.com/Teliu-p/BandaBase/actions/runs/42085812268), Tests de main [#42085984629](https://github.com/Teliu-p/BandaBase/actions/runs/42085984629) y Pages [#42085984089](https://github.com/Teliu-p/BandaBase/actions/runs/42085984089) pasaron en los SHAs correspondientes.
- No se modificaron Supabase, esquema, migraciones, RLS, Storage, datos ni servidor Python. La validación de interacción automatizada pasó; falta únicamente la comprobación manual del usuario en la interfaz publicada.


## Resultado — alinear el sombreado con el cursor real (2026-11-05, PR #145 integrada)

- El usuario reportó que, pese a la generalización de PR #144, al arrastrar el audio el destino aparecía al comienzo del renglón, no en la coordenada horizontal del puntero; eso obligaba a insertar espacios después del drop. La validación anterior no había exigido coincidencia geométrica entre cursor y placeholder, por lo que esa regresión pudo pasar.
- Causa técnica abordada: el destino usaba primero una aproximación propia a partir de rectángulos de caracteres; la función puede elegir una posición distinta del caret real cuando el contenido está formado por spans/bloques o el renglón cambia durante el arrastre.
- Corrección propuesta: pedir primero al navegador el caret en `clientX/clientY` mediante `caretPositionFromPoint` o `caretRangeFromPoint`; usar la geometría antigua solo cuando no haya un caret nativo válido. Volver a calcular el destino en `pointerup` con las coordenadas finales.
- Pruebas reforzadas: se exige que el borde izquierdo del sombreado quede a no más de 2 px del caret objetivo, tanto al mover un PDF como al mover un audio FLAC; también se verifica que al soltar la separación real del texto coincide con ese caret.
- PR #145 integrada mediante squash en `main` como `7a736fde56c84d2c945e6d0bfac24a87312d1ddd`: https://github.com/Teliu-p/BandaBase/pull/145. Tests de la PR [#42088181209](https://github.com/Teliu-p/BandaBase/actions/runs/42088181209) y Tests de main [#42088380247](https://github.com/Teliu-p/BandaBase/actions/runs/42088380247) pasaron; Pages [#42088379801](https://github.com/Teliu-p/BandaBase/actions/runs/42088379801) completó el deploy sobre el mismo SHA.


- Validación automatizada final: la prueba de audio coloca el placeholder a no más de 2 px del caret elegido y verifica el texto exacto a ambos lados tras soltar; también se repite para un PDF no-audio. No se modificó Supabase, Storage, RLS, datos, migraciones ni el servidor Python. Falta únicamente la confirmación manual del usuario en la web ya publicada.


## Corrección del destino y estabilidad del renglón al arrastrar (2026-11-05, PR #146 abierta)

- El usuario confirmó que PR #145 no resolvía el caso real: el audio y el sombreado seguían yéndose al extremo izquierdo del renglón aunque el puntero estuviera más a la derecha.
- Se encontraron dos fallos complementarios. Primero, `getMaterialComposerDropTargetAtPoint` aceptaba cualquier caret nativo dentro del editor aunque no coincidiera horizontalmente con el puntero. Segundo, al comenzar el gesto, el chip original se reemplazaba por un marcador `display:none`: el renglón de origen colapsaba y el contenido siguiente cambiaba de posición vertical mientras el puntero seguía en las coordenadas originales.
- PR #146, rama `fix/material-drag-drop-geometric-hit-test-20261105`, corrige ambos: hit-testing geométrico primero con rectángulos reales de caracteres/chips; caret nativo solo como respaldo en zonas sin texto visible; y clon oculto del chip original que conserva su tamaño/huella inline durante el gesto. El clon de origen se excluye del hit-testing y la anchura reservada incluye solo los espacios literales que efectivamente se retiran.
- La regresión Chromium fuerza las APIs nativas a devolver falsamente el inicio del texto, usa contenido enriquecido con ajuste de línea, exige que el renglón de origen conserve su altura, comprueba la separación exacta de los caracteres antes/después y conserva la identidad DOM del audio. En el test, la altura del renglón quedó en 25,59375 px antes y durante el arrastre, y el placeholder quedó a 0,016 px del caret medido.
- CI de PR [#42092923727](https://github.com/Teliu-p/BandaBase/actions/runs/42092923727) pasó: 18 smoke tests de Chromium, incluidos los casos de archivos/audio, más pruebas existentes, sintaxis y ESLint/no-undef.
- Estado: PR #146 abierta, todavía no fusionada ni publicada. Pages queda pendiente de merge/deploy y la confirmación manual del usuario en su navegador todavía es necesaria. No se modificó Supabase, Storage, RLS, datos, migraciones ni servidor Python.


## Reconstrucción completa del arrastre de adjuntos (2026-11-05, rama nueva)

- El usuario confirmó que el comportamiento seguía incorrecto incluso después de las PR #141–#146 y pidió reiniciar la función. Las PR fusionadas no se borran del historial GitHub; esta rama reemplaza su implementación activa.
- Se conserva la selección múltiple de archivos de PR #141: `#materialPendingFile[multiple]` y validación/inserción secuencial siguen intactas.
- Se retiró el motor de movimiento con Pointer Events, su cálculo geométrico propio, el ghost movido por JavaScript y las variables asociadas. La nueva implementación usa el flujo nativo del navegador `dragstart/dragover/drop/dragend`; el caret se consulta en las coordenadas nativas del evento. Si no existe un rango válido, no se acepta el destino.
- Durante el gesto, el elemento original continúa conectado como fuente nativa del drag, fuera del flujo visual; un clon invisible conserva el ancho del origen y un placeholder inline reserva el destino. El mismo nodo original se inserta al soltar; `dragend` restaura el origen si no hubo drop válido.
- Pruebas E2E nuevas simulan gesto real con mouse down/move/up y comprueban `dragstart`, `dragover`, caret bajo puntero, separación de texto, identidad del nodo y restauración al cancelar. CI de PR [#42098206552](https://github.com/Teliu-p/BandaBase/actions/runs/42098206552) pasó con 18 pruebas de Chromium (incluyendo PDF, audio, cancelación y multiselección), más sintaxis y ESLint/no-undef.
- PR #147 está abierta y aún no está publicada; Pages y confirmación manual quedan pendientes. No se modificó Supabase, Storage, RLS, datos, migraciones ni servidor Python.

## 21. Protección de autoedición de participantes en Listas (PR #149, 2026-11-06)

- Revisión de producción en solo lectura: band_list_items tiene una única política UPDATE (band_list_items_update_control), consolidada por 20261020232312_harden_storage_and_list_item_policies.sql. No se debe volver a aplicar la antigua migración de PR #98 ni recrear la política duplicada.
- La función actual private.prevent_manager_list_item_edit() ya protegía algunos cambios hechos por responsables, pero no restringía todos los campos que un integrante normal podía modificar en su propia fila mientras estaba Anotado.
- PR #149 propone la migración 20261106210000_harden_band_list_item_self_service_guard.sql. No modifica la política RLS: limita la autoedición a participation_instruments, conserva el control de estado de responsables, y distingue la transición interna de auto-confirmación mediante un marcador transaccional. Un responsable que también participa conserva la edición de sus propios instrumentos.
- El test de PostgreSQL reproduce primero el cambio de título no autorizado con el trigger anterior. Después aplica la migración en un PostgreSQL 17 descartable y comprueba admin, creador, responsable, participante, usuario externo, papelera, confirmación manual y auto-confirmación. CI #42323742315 terminó correctamente: npm test, ESLint/no-undef, 18 smoke tests de Chromium y el job database-policy.
- La fixture de PostgreSQL reproduce la política UPDATE y los triggers relevantes observados en producción; no es una restauración completa de producción ni una prueba sobre datos reales.
- Estado: PR #149 abierta como borrador en fix/band-list-self-service-guard-20261106, HEAD 59a07a0904f09bb17fc590a10eeb38ce024e8340. No está fusionada ni desplegada. No se aplicó la migración a Supabase. PR #98 sigue siendo una propuesta antigua y no debe fusionarse tal cual.
- Próximo paso obligatorio antes de desplegar: validar la migración sobre una copia/entorno aislado fiel al esquema restaurado y hacer la prueba autenticada multiusuario. No ejecutar db push en producción ni marcar la PR como terminada por el solo hecho de que CI pasó.
