# Estado técnico actual de BandaBase

**Última inspección:** 2026-10-14, Argentina.  
**main actual verificado tras la documentación:** d1bb3f58a3f1bb95ed16c668a5a44476cf10d3ad.  
**Commit base del código funcional inspeccionado:** 0d4cad4846d0f00ffa8ffe7fc645046a138d05e3 (el commit posterior solo añadió documentación).  
**Supabase:** evuwcikuxptrgzdzejov.  
Este documento es una fotografía. Revalidar PR, CI, esquema y advertencias antes de una actuación; especialmente después de nuevas conversaciones o commits.

## 1. Código y despliegue

- La PR #103 integró AGENTS.md, AI_CONTEXT.md y cuatro documentos de contexto el 2026-10-14 (Argentina). Fue documentación únicamente y pasó CI y deploy.

- Repo: Teliu-p/BandaBase; rama principal main.
- Aplicación publicada: https://teliu-p.github.io/BandaBase/.
- Stack: HTML/CSS, JavaScript en scripts clásicos, Supabase JS v2, PostgreSQL/RLS/Storage.
- Último commit observado de main: d1bb3f58a3f1bb95ed16c668a5a44476cf10d3ad (merge de la documentación de contexto; la línea base del código de aplicación es 0d4cad4846d0f00ffa8ffe7fc645046a138d05e3).
- Actions para d1bb3f58a3f1bb95ed16c668a5a44476cf10d3ad: Tests pasó y Pages build/deployment pasó. [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/38668782713) · [Pages build/deployment](https://github.com/Teliu-p/BandaBase/actions/runs/38668781565). Tests incluye npm test, ESLint no-undef y smoke tests Playwright/Chromium.
- Los smoke tests usan un stub de Auth; no son una prueba autenticada integral con cuentas reales.

## 2. Corrección de sangría y audio en Materiales (2026-10-19)

- Solicitud de corrección: la sangría tipo `blockquote.material-indent` añadida en PR #107 desplazaba demasiado el texto. La rama `fix/material-inline-audio-and-space-indent-20261019` la reemplaza por espacios reales a pasos de uno, con repetición acelerada durante una pulsación sostenida. En selección de varias líneas, la intención es aplicar el paso línea por línea.
- Al guardar, los bloques de texto eran renderizados como `div` y los audios como tarjetas grandes por separado, aunque en el editor el archivo se veía como chip inline. Esta rama devuelve texto como spans inline y archivos como chips compactos; audio usa botón reproducir/pausar y un panel flotante con tiempo, duración y seek, sin controles nativos grandes.
- La rama también elimina el wrapper de indentación anterior del serializador/sanitizador para que no vuelva a aparecer como bloque con margen al reabrir contenido antiguo.
- Esta rama no cambia el volumen del audio ni el esquema, permisos, datos o Storage de Supabase. Pendiente de validar en CI y en una canción real antes de considerar publicado el arreglo.

## 2. Revisión de herramientas musicales del editor (2026-10-19)

- Main observado al iniciar esta tarea: `e75c2d13e231bfe1c059ea92a7a82cbe53ef26cf`. La PR #107 (https://github.com/Teliu-p/BandaBase/pull/107) contiene la primera tanda de figuras musicales, sangría permitida en rich text, atajos numéricos, chips de adjuntos limitados a un renglón y ganancia ajustable del metrónomo. Revalidar PR/CI/deploy antes de afirmar que está publicada.
- El rich text tiene prefijo propio, serializador y sanitizador con lista permitida. No guardar HTML arbitrario ni confiar en `execCommand` sin incluir el formato en esa ruta de persistencia.
- Marcadores por instante y sincronización con audio no están incluidos en este primer lote: requieren definir un modelo compartido persistente, permisos para actualizar marcadores y comportamiento de seek/pause/resume. No introducir cambios de esquema ni escribir datos remotos a ciegas.
- No aumentar volumen de audio usando Web Audio sin comprobar CORS en las URLs firmadas de Storage: según el navegador, una fuente remota no autorizada para CORS puede producir silencio si se conecta a Web Audio. Conservar un fallback de `<audio>` nativo.

## 3. Incidente de guardado de Materiales con audios

- Reporte recibido el 2026-10-15: al editar Materiales e insertar audios, pulsar «Guardar material» deja el editor abierto sin feedback visible.
- Inspección de código encontró dos fallos de manejo defensivo: el guardado retornaba silenciosamente si faltaba el contexto de banda/canción y no tenía una captura general para promesas asíncronas rechazadas por Storage/RPC/red. Tampoco mostraba progreso durante el guardado.
- PR #105: https://github.com/Teliu-p/BandaBase/pull/105 añade estado de guardado, bloqueo de envíos duplicados, mensajes de progreso, notificación cuando falta el contexto y compensación ante excepciones inesperadas antes de persistir los bloques. Una vez persistidos los bloques, evita borrar el contenido ante un fallo posterior de refresco.
- PR #106: https://github.com/Teliu-p/BandaBase/pull/106 protege el caso ambiguo en que la conexión se pierde mientras se espera replace_material_blocks: no elimina automáticamente adjuntos porque la transacción pudo haberse confirmado aunque la respuesta no haya llegado al navegador. Pide recargar y verificar el contenido antes de reintentar.
- Regresiones añadidas: rechazo de promesa de subida, limpieza de carga parcial y contexto de guardado ausente. CI pasó npm test, ESLint no-undef y smoke tests de Chromium en https://github.com/Teliu-p/BandaBase/actions/runs/38807174499.
- La consulta de logs no aportó una subida fallida correlacionable; no hay evidencia suficiente para atribuir el síntoma a una política RLS o a una migración. El fallo exacto de la sesión del usuario no se reprodujo; esta corrección hace visibles esos caminos y evita silencios ante excepciones.
- No se modificó esquema, políticas, datos ni Storage de producción. Revisar el estado de PR/merge/deploy antes de afirmar que el arreglo ya está publicado.

## 4. Estado de Supabase observado en solo lectura

- Las tablas públicas devueltas por list_tables tenían RLS habilitada.
- Tablas principales presentes: bands, profiles, band_members, songs, song_singers, materials, material_blocks, material_attachments, comments, comment_blocks, comment_attachments, band_lists, band_list_items, band_list_managers, proposals, proposal_options, proposal_votes, proposal_blocks, proposal_attachments y audit_log, además de tablas heredadas de ensayos/listas/decisiones/problemas.
- Conteos aproximados devueltos por la herramienta: 15 canciones, 3 miembros en band_members, 3 listas, 4 propuestas, 7 votos y 983 filas de audit_log en el momento de la consulta. Los conteos son volátiles, no deben usarse para suponer que los datos no cambiaron.
- La columna songs.genre es actualmente text[]; songs incluye estado/preparación, estado activo, campos de repertorio y columnas de papelera.
- La función de creación de canción en el cliente hace INSERT en songs y atribuye created_by al usuario autenticado. La RLS songs_insert_own requiere pertenencia a banda y que created_by corresponda al auth.uid().

## 5. Diferencia del historial de migraciones

Comparación de los árboles de archivos y list_migrations el 2026-10-14:

- Archivos SQL locales en main: 56.
- Versiones registradas en Supabase: 44.
- Local-only (12): 20261007173000_comment_attachments_blocks; 20261007190000_band_list_participation_permissions; 20261007200000_song_genres_array; 20261007203000_proposal_attachments; 20261007210000_proposal_content_blocks; 20261007220000_permissions_audit_and_trash; 20261007221500_secure_anonymous_vote_stats; 20261007223000_permissions_hardening; 20261007224000_allow_member_soft_delete; 20261007225000_allow_users_to_complete_soft_delete; 20261007225500_remove_legacy_comment_access; 20261008180900_harden_material_comment_proposal_storage.
- Remote-only: ninguna en la comparación.
- El grupo viejo de versiones remotas sin archivos locales fue recuperado anteriormente y está resuelto. No volver a etiquetarlo como pendiente.
- Los doce archivos local-only no están obsoletos en bloque: algunos crean tablas/funciones o efectos de los que dependen migraciones registradas posteriores. Varias políticas fueron endurecidas después, pero eso no permite eliminar el archivo entero.
- Dos archivos tienen operaciones que escriben o transforman datos: normalización de estados de participación y conversión de genre a array. No volver a ejecutarlos completos sin análisis.
- No ejecutar supabase db push, no hacer migration repair en bloque, no insertar manualmente en schema_migrations ni mover/borrar migraciones para hacer coincidir conteos. Consultar docs/database-migration-history-reconciliation-followup.md para el razonamiento detallado.

## 6. PR y problema de permisos en listas

- PR #98: https://github.com/Teliu-p/BandaBase/pull/98
- Rama fix/band-list-update-policy-integrity, HEAD observado 9ff8d5b2bcf3bf3a272e47a4af770747aff9af52.
- Al último chequeo, la PR seguía abierta como draft; no estaba fusionada ni aplicada a producción.
- En Supabase están simultáneamente las políticas UPDATE band_list_items_update_control y band_list_items_update_control_v2. Las políticas permissive se combinan de forma que una política adicional puede ampliar acceso aunque la otra sea más estricta. La PR propone eliminar la política v2 y endurecer el trigger, pero debe revisarse contra el estado exacto y probarse antes de merge/aplicación.
- CI previo de la PR pasó pruebas de políticas Postgres aisladas y smoke tests, pero no es una prueba E2E completa contra producción.

## 7. Advertencias del asesor de Supabase observadas

### Seguridad

- get_proposal_vote_stats(uuid[]) y is_band_member(uuid) aparecen como funciones SECURITY DEFINER ejecutables por authenticated. Determinar si es intencional según el cuerpo, datos devueltos y consumo desde cliente; no cambiar permisos solo para silenciar el asesor.
- La protección de contraseñas filtradas de Auth está deshabilitada. Revisión de configuración recomendada; cambiarla afecta UX del signup.

### Rendimiento / RLS

- Se detectaron 26 claves foráneas sin índice de cobertura.
- Se listaron 12 índices no usados en la ventana/telemetría revisada; no eliminarlos sin carga representativa.
- El asesor informó 12 casos de múltiples políticas permissive. Varias son separaciones intencionales de flujo (p. ej. editar/restaurar/papelera), pero cada una debe analizarse; el caso de band_list_items UPDATE es un riesgo ya identificado.

## 8. Incidencias históricas para no reintroducir

Errores que aparecieron en iteraciones previas: canManageComment is not defined; toggleSongrepertoire is not defined; load.songs is not defined; handleAuthSession is not defined; populateColorfilter is not defined; login que parecía no reaccionar; error de save de material relacionado con WITH ORDINALITY. No se deben dar por actuales sin reproducir. Al corregir funciones compartidas o contratos de datos, ejecutar las regresiones relacionadas.

## 9. Qué falta para una comprensión más profunda

- Pruebas autenticadas contra un entorno seguro que ejerciten permisos con roles distintos y RLS real; la suite actual no cubre todo eso.
- Revisión completa de cada política y SECURITY DEFINER por su intención de negocio, no solo del inventario.
- Comparación periódica de las tablas/funciones/policies remotas con el estado esperado versionado, sin aplicar reparaciones automáticas.
- Matriz de cobertura funcional que relacione cada requisito con módulo, función, tabla/RPC/policy y prueba.

## 10. Actualización de este archivo

Cada cambio que modifique el estado abierto debe ajustar esta página en la misma PR. Una incidencia queda cerrada solo si existe evidencia concreta de su resolución. Los recuentos, SHA, estado de PR y lints son fotografías y se tienen que consultar de nuevo antes de actuar.