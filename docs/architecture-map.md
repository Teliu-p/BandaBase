# Mapa de arquitectura de BandaBase

**Base funcional de observación:** PR #136 integrada el 2026-11-03 (merge `e96712ee41de5599e36a58b1d1dd72d2919946bd`). Los archivos de migración nuevos deben coincidir por prefijo con las versiones aplicadas en Supabase. Verificar siempre el HEAD real y el orden de scripts antes de futuros cambios.

## 1. Arquitectura a alto nivel

- index.html contiene la estructura de pantallas, formularios y etiquetas script.
- src/styles.css contiene el diseño visual y los estados responsive.
- src/*.js contiene la lógica de UI, estado, persistencia y renderizado.
- Supabase Auth autentica usuarios; PostgreSQL almacena la información; RLS valida acceso por usuario, banda, propiedad y rol; Storage guarda archivos adjuntos.
- GitHub Actions ejecuta pruebas, análisis ESLint y smoke tests de Chromium. GitHub Pages despliega main.

Los JS se cargan como scripts clásicos, no como módulos ES. Funciones y variables declaradas en un archivo pueden ser usadas por otros archivos. Esto hace crítico el orden de carga y la detección de referencias globales indefinidas.

## 2. Orden de carga del código

El orden de scripts relevante en index.html, resumido según el main inspeccionado:

1. Cliente Supabase desde CDN.
2. utils.js y app-state.js.
3. Datos y UI de canciones: songs-data.js, songs-singers.js, songs-view.js, songs-filters.js, songs-color.js, songs-forms.js.
4. Datos de materiales, comentarios y listas: materials-data.js, comments-data.js, lists-data.js, lists-view.js, lists-form.js.
5. app-dom.js y rich-text-composer.js.
6. Renderizado y guardado de comentarios, comentarios generales y menú contextual.
7. Datos, contenido, vista y formulario de propuestas.
8. Administración e inicialización de app-shell.js y app-band.js.
9. Formato, vista, editor y guardado de materiales.
10. Comparación de canciones, controlador de canciones, metrónomo, detalle de canciones, navegación, autenticación y actualización.

La lista exacta y el orden final deben leerse directamente de index.html antes de tocar cargas o dependencias. No confiar en esta lista como sustituto de la fuente.

## 3. Inventario de módulos

### Núcleo y autenticación

- utils.js: parseo/formato de duración, normalización de texto, instrumentos y utilidades compartidas.
- app-state.js: cliente Supabase y estado global; variables de usuario, banda, canciones, listas, selección y UI, además de escapeHtml y avisos.
- app-auth.js: recuperación de sesión, escucha de cambios de Auth, iniciar/cerrar sesión y llamar a la inicialización.
- app-band.js: banda activa, perfiles, instrumentos, integrantes y edición de perfil.
- app-shell.js: inicialización principal, carga de canción/listas y eventos para UI global.
- app-dom.js: referencias a elementos del DOM.
- app-navigation.js: navegación de secciones, estado de sección y vistas recientes en Inicio.
- app-update-state.js y app-update.js: detección de nueva compilación, caché y avisos/recarga controlada.
- attachment-access.js: resolución de URLs de adjuntos. Para audio de `material_attachments` exige ticket del servidor local y nunca recurre a Supabase Storage; para audio de Comentarios/Propuestas conserva el fallback anterior a Storage. Los adjuntos no-audio siguen firmándose desde Storage. También gestiona upload/delete local autenticado de audio de Materiales. Se carga inmediatamente después de app-state.js y antes de los consumidores.

### Canciones

- songs-data.js: normalización de géneros, lecturas y operaciones de escritura sobre songs, papelera y estado de repertorio.
- songs-singers.js: relación normalizada song_singers y RPC replace_song_singers.
- songs-view.js: tarjetas de canciones.
- songs-filters.js: filtros múltiples de género, artista, cantante, color u otros atributos.
- songs-color.js: selector de colores y filtro por color.
- songs-forms.js: lectura y normalización de formularios para crear/editar canciones y cantantes.
- songs-controller.js: carga de catálogo, control de filtros, creación, listas asociadas y coordinación de UI.
- songs-detail.js: detalle y edición de una canción, materiales y comentarios relacionados.
- songs-comparison.js: comparación de versión propia con original/material asociado.
- metronome.js: configuración de métrica, BPM con precisión de hasta dos decimales, temporización de clics, acentos, subdivisiones, tap tempo, ganancia ajustable y sincronización opcional con el playhead de un audio de Materiales. Usa BPM/métrica conocidos y eventos de play/pause/seek/ratechange; no analiza la forma de onda. La calibración manual guarda fase en localStorage por canción y, al capturarla, convierte el tiempo transcurrido según `playbackRate`; se invalida para el uso actual si no coinciden BPM/métrica. Mantener pruebas para BPM fraccionario, fase, calibración a velocidad alterada, cancelación de clics y modo independiente.

### Materiales, comentarios y contenido enriquecido

- materials-data.js: materiales, adjuntos, bloques y RPC replace_material_blocks.
- materials-editor.js: compositor enriquecido, inserción de archivos/enlaces, cinco figuras musicales, cinco silencios y puntillo de la siguiente inserción. Agrupa visualmente las parejas consecutivas sin puntillo de corcheas y semicorcheas mediante nodos canónicos de notación. Conserva marcadores temporales inline y gestiona selección/caret y atajos Alt+1–6, Q/W/E/R/T, A/S/D/F/G, Z, X, C/V y 0.
  El selector de archivos es múltiple. Los archivos se mueven con eventos nativos HTML Drag and Drop del navegador (`dragstart`, `dragover`, `drop`, `dragend`), no con un motor Pointer Events personalizado. La posición provisional se obtiene con el caret nativo (`caretPositionFromPoint` / `caretRangeFromPoint`) en las coordenadas del evento de arrastre. El archivo original permanece conectado al DOM como fuente del gesto pero se saca del flujo visual mediante `position: fixed`; un clon invisible mantiene reservado el espacio original, y un placeholder inline ocupa el destino. Al soltar, el mismo nodo original reemplaza el placeholder; si se cancela o se suelta fuera, `dragend` restaura nodo y separadores originales. Si el navegador no devuelve un caret válido, no se inventa una posición aproximada ni se confirma un destino incorrecto. Los bloques serializados determinan el orden persistido.
- materials-formatting.js: sanitización y serialización/renderizado de texto enriquecido, enlaces, marcadores temporales y notación. Las figuras/silencios se almacenan como `span` con una clave permitida y se dibujan con SVG generado localmente; los caracteres musicales antiguos se convierten al renderizarlos/editar para no depender de fuentes instaladas. No se inserta SVG arbitrario desde el contenido guardado.
- materials-save.js: proceso de guardado, carga de adjuntos, compensación ante fallos y restauración parcial. Los nuevos audios de Materiales se registran con `storage_path = local:<clave-opaca>` y se envían al endpoint local; los demás archivos siguen subiendo a Storage. Quitar un audio usa el endpoint local para eliminar archivo y fila bajo autorización; si el servidor no está disponible, puede quedar un archivo huérfano y se informa.
- materials-view.js: renderizado en flujo de bloques, chips compactos de adjuntos, reproducción nativa `<audio>` bajo demanda mediante ticket local y panel flotante de tiempo/posición. El panel permite velocidades del 25% al 200% (presets y porcentaje personalizado), solicitando conservación de afinación con `preservesPitch` y alias compatibles, y descarga de cada archivo de Materiales. Los marcadores posicionan todos los audios de la canción, incluso en Materiales plegados. El reloj de reproducción lo gestiona el navegador; la app no usa un temporizador propio para avanzar muestras de audio. Audio de Materiales nunca usa URLs firmadas de Storage.
- comments-data.js: comentarios de canción/generales, adjuntos, bloques, borrado y RPC replace_comment_blocks.
- comments-view.js y comments-general.js: renderizado/eventos de comentarios de canción y generales; comments-view.js también genera descarga explícita para todos sus adjuntos de tipo archivo.
- comments-save.js: guardado del compositor de comentarios y limpieza ante fallos.
- rich-text-composer.js: componentes reutilizables de texto, archivos y enlaces en comentarios.
- context-menu.js: selección, menú contextual, clic derecho y pulsación larga para acciones de borrado múltiple.

### Listas, propuestas y administración

- lists-data.js: CRUD de listas, elementos/participantes, responsables y RPC replace_band_list_items.
- lists-form.js: formulario y selector de responsables de listas.
- lists-view.js: renderizado, cupos, participación, confirmación, carga/guardado y sincronización visual del repertorio.
- proposals-data.js: propuestas, opciones, votos, adjuntos/bloques, estados y RPCs de votos/contenido.
- proposals-content.js: editor de contenido mixto de propuestas.
- proposals-form-ui.js: formulario de propuesta y lógica de opciones.
- proposals-view.js: tarjetas, controles de voto, resultados y descarga explícita de archivos adjuntos de propuestas (las URLs firmadas fuerzan descarga con el nombre del archivo).
- rehearsals-data.js: persistencia de ensayos heredados. Revisar las expectativas actuales de producto antes de extenderlo; la dirección de producto acordada ha sido organizar actividades y repertorio mediante Listas, no crear una sección separada de Ensayos.
- admin-data.js: historial de auditoría, papelera, restauración mediante restore_band_change y cambio de roles.
- admin-view.js: interfaz administrativa, etiquetas de acciones, historial y papelera.

## 4. Flujos de uso y puntos de acoplamiento

### Crear canción

index.html (#createSongForm, #newSongName y campos relacionados) → controlador de submit en songs-controller.js → readCreateSongForm en songs-forms.js → createSong en songs-data.js → INSERT en public.songs → si hay cantantes, createSongSingers en songs-singers.js → loadSongs → renderizar catálogo → abrir detalle de canción.

El título es obligatorio. Otros campos pueden quedar vacíos. La app asigna currentUser como creador, currentBand como banda y envía estado/preparación elegidos. Si hay exactamente un cantante, conserva además singer/song_key heredados. La creación puede ser parcialmente exitosa si la canción se guarda y falla después el guardado de cantantes; el controlador lo informa. No inventar que el flujo completo es transaccional.

Para carga masiva, una automatización segura debería usar una sesión autenticada propia y el mismo contrato de datos, revisar duplicados y verificar IDs/resultados. No usar service_role ni escritura privilegiada en el navegador. Como no hay herramienta disponible que controle la pestaña del usuario, explicar claramente cómo debe autorizarse/ejecutarse.

### Sesión e inicialización

app-auth.js lee sesión y escucha auth state changes → handleAuthSession → initializeApp en app-shell.js → loadCurrentBand/loadCurrentProfile/loadSongs, inicialización de navegación/listas/admin y sección guardada. El control initializedUserId/initializingUserId evita inicialización duplicada. Un error aquí puede hacer que el login parezca no responder o no cargue la app.

### Listas y repertorio

lists-view.js coordina UI con lists-data.js. public.band_list_items registra canciones y participantes; band_list_managers permite responsables por lista. El campo songs.in_repertoire se sincroniza desde listas activas en la base mediante triggers; no tratarlo como un checkbox manual. Las operaciones de reemplazo de colecciones usan RPC atómicas en algunos flujos; respetar las RPC existentes.

### Materiales y adjuntos

El editor representa texto, enlaces y archivos como bloques ordenados. Guardar material puede involucrar registro base, objetos en Storage, filas de adjuntos y reemplazo de bloques. materials-save.js implementa compensación/rollback para pasos parciales; no reducir este flujo a un INSERT simple. Audio usa URLs firmadas bajo demanda para evitar cargarlo hasta que el usuario quiera reproducirlo. Los audios de Materiales se guardan exclusivamente en la biblioteca local y `attachment-access.js` exige ticket del servidor local; no tienen fallback a Supabase Storage, incluso ante HTTP 409/5xx o desconexión. El servidor valida JWT, RLS y permiso de creador/admin antes de guardar, y vuelve a consultar bajo RLS antes de emitir tickets de reproducción. Los archivos no-audio de Materiales continúan en Storage. Los audios de Comentarios y Propuestas conservan el comportamiento previo con fallback a Storage.

### Propuestas y votos

Las propuestas pueden incluir tipo/configuración, opciones, votos y contenido con texto/adjuntos/enlaces. Las lecturas de estadísticas y sustitución de votos usan RPCs: get_proposal_vote_stats, replace_my_proposal_votes y replace_proposal_blocks. Las reglas de visibilidad del voto anónimo/público deben validarse con la función SQL y políticas actuales, no solo con la interfaz.

### Comentarios

Hay comentarios asociados a canciones y comentarios generales de banda. El contenido admite bloques/adjuntos y permisos diferentes según autor/administrador. La UI puede ocultar controles, pero la seguridad real depende también de RLS y storage policies.

## 5. Persistencia por tablas principales

El esquema remoto consultado incluye, como mínimo, estas tablas públicas:

- Identidad: bands, profiles, band_members.
- Canciones: songs, song_singers.
- Materiales: materials, material_blocks, material_attachments.
- Comentarios: comments, comment_blocks, comment_attachments.
- Listas: band_lists, band_list_items, band_list_managers.
- Propuestas: proposals, proposal_options, proposal_votes, proposal_blocks, proposal_attachments.
- Administración: audit_log.
- Estructuras heredadas/otras: rehearsals, rehearsal_songs, rehearsal_roles, problems, setlists, setlist_songs, decisions y parking_lot.

Todas las tablas públicas devueltas por la inspección de Supabase tenían RLS habilitada. Que RLS esté habilitada no demuestra por sí solo que las políticas sean correctas.

## 6. Pruebas

- tests/js-syntax.test.mjs: sintaxis de scripts, orden de carga, referencias/configuraciones y pruebas de lógica/regresión con stubs; el archivo tenía 219 llamadas de aserción en la versión examinada.
- tests/eslint.config.mjs: ESLint con no-undef y catálogo de globals del proyecto.
- tests/e2e/smoke.spec.cjs: tres smoke tests de navegador para arranque, validación previa al signup y diseño móvil; la autenticación se sustituye por un stub, por lo que no es E2E autenticado real contra Supabase.
- .github/workflows/tests.yml: ejecuta npm test, ESLint y Playwright/Chromium en pull request y push a main.

La CI verde es evidencia valiosa, pero no equivale a cubrir todos los flujos ni a probar permisos con varias cuentas reales.

## 10. Operaciones SQL transaccionales introducidas el 2026-10-20

- `save_band_list_with_managers(p_list_id, p_band_id, p_title, p_status, p_notes, p_instrument_slots, p_manager_user_ids)`: crea/actualiza una lista y reemplaza sus responsables dentro de una única transacción.
- `replace_song_list_assignments(p_song_id, p_add_list_ids, p_remove_list_ids)`: valida banda, permisos y listas activas antes de aplicar altas/bajas.
- `save_song_with_singers(p_song_id, p_song_data, p_singers)`: guarda campos escalares y relación de cantantes/tonalidades en una única transacción.
- `trash_comments_bulk(p_comment_ids)`: valida todos los comentarios seleccionados y mueve todo el conjunto a papelera, o falla sin actualizaciones parciales.

Las cuatro RPC usan SECURITY INVOKER y EXECUTE se concede a authenticated, no a anon. Sus migraciones remotas, por orden: `20261020232312`, `20261020232328`, `20261020232333`.

## Actualización: sincronización en tiempo real y paridad de Materiales (2026-10-21)

- `src/app-realtime.js` se carga después de `app-auth.js`. `app-shell.js` inicia la suscripción cuando la aplicación ya tiene banda/usuario; `app-auth.js` la detiene al limpiar la sesión. La suscripción cubre las tablas activas de canciones/cantantes, materiales y adjuntos, comentarios y adjuntos/bloques, listas/participación, propuestas/votos, perfiles/integrantes y auditoría.
- La publicación `supabase_realtime` estaba vacía. La migración aplicada `20261021224042_enable_realtime_for_bandabase.sql` registra 20 tablas; confirmar siempre `pg_publication_tables` y RLS cuando se agrega otro flujo a la app.
- El evento recibido es una señal para reconsultar con las consultas existentes, no una fuente de datos persistida en el cliente. Realtime puede perder eventos durante desconexiones; no duplicar permisos ni saltarse RLS para intentar resolver retrasos.
- Formularios de Materiales, Propuestas y edición de Listas pueden aplazar el refresco para preservar borradores y lo vuelven a intentar cuando se cierran. El detalle de canción también evita reemplazar campos locales mientras están modificados.
- `utils.js` dibuja instrumentos con SVG local. No volver a sustituir estos iconos por emoji/caracteres que dependan de la fuente instalada en el equipo.
- El editor de Materiales inserta saltos de línea explícitos en `beforeinput`; la serialización aplana bloques `DIV/P` para preservar líneas vacías y la posición de chips de adjuntos. Vista y edición deben compartir reglas de espacios en blanco. La prueba de regresión de Node confirma el orden texto–adjunto–texto; Chromium CI también pasó. Aun así, una prueba autenticada con dos equipos reales queda como validación de integración final.

## Actualización: portapapeles, comparación y grupo de pistas (2026-10-26)

- `materials-editor.js` captura HTML del portapapeles; `materials-formatting.js:createMaterialClipboardFragment` lo procesa con el sanitizador de Materiales. La notación musical se reconstruye desde claves permitidas y se dibuja en SVG; no se importan scripts, estilos ni referencias a adjuntos de otro material.
- `songs-comparison.js:renderOriginalComparisonMaterialView` usa los mismos renderizadores de bloques y bind de controles que la lista de Materiales. Su botón abre `openMaterialEditor(material, COMPARISON_MATERIAL_TYPE)`; `materials-save.js` persiste los bloques/adjuntos por la misma ruta. `materials-data.js:createMaterial` respeta el tipo pasado, usando `Texto` si falta.
- `metronome.js` persiste `audioZeroTime` por canción, valida BPM/métrica y migra offsets almacenados por adjunto. Los eventos play/pause del conjunto de pistas se agrupan con `window.bandabaseMaterialAudioGroupTransitionInProgress`; tras sincronizar los playheads, `syncMetronomeWithAudio` usa un reproductor del grupo como referencia.
- `materials-view.js` mantiene `materialAudioGroupSelectedIds`: clic derecho en el chip de audio cambia selección, un distintivo indica el grupo y Play en una pista seleccionada hace que los reproductores seleccionados carguen, se posicionen al mismo `currentTime` (milisegundos) y arranquen juntos. Los reproductores deben estar visibles en DOM; el grupo se puede formar incluyendo audio en la vista de comparación.
- Las pruebas de Chromium simulan las llamadas a `play()` y la alineación del playhead; esto no mide latencia audible ni deriva con archivos reales. Siempre hacer una prueba auditiva de original y stems antes de declarar sincronización práctica verificada.



## Actualización: acceso a la biblioteca local de audio (PR #136 integrada, 2026-11-03)

- `src/attachment-access.js` centraliza el acceso de Materiales, Comentarios y Propuestas. Para adjuntos con MIME `audio/*`, solicita `POST /api/ticket` con la tabla, el UUID del adjunto y el JWT de Supabase; el servidor local vuelve a consultar la fila con ese JWT, por lo que RLS sigue siendo la autoridad de permisos.
- Cuando el servidor devuelve un ticket, el navegador usa la URL `/api/media/` del propio servidor. HTTP 409 (adjunto todavía no copiado) y un servidor local inaccesible conservan el fallback firmado de Supabase Storage. Los rechazos HTTP de autorización/servidor se muestran al usuario en lugar de ocultarse con un fallback.
- Los adjuntos que no son audio no intentan usar el servidor local, porque el endpoint de medios local está diseñado para servir audio inline; sus aperturas y descargas siguen en Supabase Storage.
- El endpoint predeterminado es `http://127.0.0.1:8788`. Se puede sustituir en runtime con `window.BANDABASE_AUDIO_SERVER_URL`; para usuarios de otras computadoras hará falta configurar el hostname HTTPS de Tailscale Funnel. Ese paso no está realizado en esta rama.
- El cambio no modifica `storage_path`, filas de adjuntos, esquema, políticas, RLS, Storage ni migraciones.
- La verificación manual inicial del servidor local confirmó /health, ticket 200, HEAD 200, audio/flac, Range 206 y reproducción audible del FLAC de prueba. CI de la PR pasó en el commit `f6440040196e25553a5eb4ed73b6e11b300e028a`: `npm test`, ESLint `no-undef` y Playwright/Chromium (14 pruebas). Tras el merge funcional `e96712ee41de5599e36a58b1d1dd72d2919946bd`, Tests de main (#41721358288) y Pages (#41721358287) también pasaron. Queda pendiente una prueba autenticada de los controles finales desde la aplicación; la reproducción manual previa usó un reproductor temporal, no la interfaz final de Materiales.

## Actualización: configuración de Tailscale Funnel (2026-11-03)

- Se agregó `src/audio-server-config.js`, cargado después de `app-state.js` y antes de `attachment-access.js`. Define `window.BANDABASE_AUDIO_SERVER_URL` con el hostname HTTPS de Funnel del equipo anfitrión.
- El resolutor común sigue solicitando tickets con el JWT de Supabase; no se modificó su flujo de autorización ni el fallback a Storage. El hostname público no es una credencial.
- Pruebas manuales del host: `/health` por HTTPS respondió correctamente; el preflight CORS desde `https://teliu-p.github.io` devolvió 204 y permitió POST con Authorization/Content-Type. Un POST sin token respondió 403 tanto directo como vía Funnel con el mismo mensaje del servidor («Falta la sesión autenticada de BandaBase.»), confirmando que el proxy transmite el control de autenticación.
- El usuario confirmó que el reproductor habitual de Materiales reproduce normalmente en la PC anfitriona. Falta probar un audio con sesión real desde una segunda computadora; para ello el host, el servidor Python y Funnel deben permanecer activos.


## Resultado de integración Funnel (2026-11-03)

- La configuración se integró mediante PR #137 en `678c218ac591f25d022d760280249158cfddefd8`: `src/audio-server-config.js` establece el origen HTTPS de Funnel y se carga antes de `attachment-access.js`.
- Tests [#41723820635](https://github.com/Teliu-p/BandaBase/actions/runs/41723820635) y Pages [#41723820206](https://github.com/Teliu-p/BandaBase/actions/runs/41723820206) pasaron en main. El usuario confirmó reproducción del audio desde el reproductor habitual de Materiales en el host.
- La validación desde una segunda computadora sigue pendiente; la configuración del cliente y el CORS están listos según las pruebas descritas arriba.

## Ajuste de fallback ante errores HTTP del servidor local (2026-11-04)

- `requestLocalAttachmentUrl` trata cualquier respuesta HTTP 5xx del servidor local o del proxy Funnel como indisponibilidad de la ruta local y devuelve `null`; el resolutor continúa con la URL firmada de Supabase Storage.
- Se conservan como errores explícitos las respuestas 4xx distintas del 409 (en particular, 403 por autorización), para no ocultar rechazos de acceso.
- La regresión cubre 500, 502, 503 y 504, además del rechazo 403 y la desconexión/timeout que ya se probaban.


## Actualización: audio local-only en Materiales

- El flujo de Materiales clasifica audio por MIME/extensión y guarda los bytes nuevos mediante `POST /api/upload/<attachment_id>` al servidor local. La fila de `material_attachments` se registra con `storage_path = local:<clave-opaca>`; no se crea ningún objeto correspondiente en Supabase Storage.
- El servidor revalida JWT, la fila accesible por RLS, y que el usuario sea creador del Material o admin antes de aceptar el upload. Escribe por streaming a un temporal dentro de `LIBRARY_DIR` y hace reemplazo atómico. Las rutas upload/delete quedan serializadas por ID y una clave local ya existente no se sobrescribe.
- La lectura solicita un ticket HMAC del servidor local. Para `material_attachments`, los HTTP 409/5xx y la desconexión terminan en error visible; nunca llaman a `createSignedUrl`. Comentarios/Propuestas conservan Storage. Los adjuntos no-audio de Materiales también continúan en Storage.
- Quitar un audio llama `POST /api/delete/<attachment_id>`: la eliminación de la fila queda bajo RLS y el servidor elimina el archivo local si está presente. Si el servidor no responde durante una limpieza compensatoria, puede quedar un archivo huérfano local; no se elimina ningún objeto antiguo de Storage de forma automática.
- No requiere migración SQL ni cambios de esquema. La columna `storage_path` ya es texto y acepta la clave `local:`. El usuario debe instalar la nueva versión del servidor Python en `C:\\BandaBaseAudio\\bandabase_audio_server.py`; el despliegue web por sí solo no actualiza ese archivo local.


## Robustez de la ruta de audio local (2026-11-09)

- `requestLocalAttachmentUrl` ahora espera hasta 8 segundos y realiza un único reintento acotado ante errores de transporte (`AbortError` / `TypeError`) o respuestas HTTP 5xx transitorias. Las respuestas 4xx no se reintentan; en particular, un 403 sigue siendo un rechazo explícito.
- El reintento no cambia el modelo local-only de los audios de Materiales: tras agotar los intentos, el resolver muestra el error de biblioteca local y no genera una URL firmada de Supabase Storage. Comentarios/Propuestas conservan sus rutas anteriores.
- El servidor entregado por separado como versión 0.5 usa HTTP/1.1 con longitudes explícitas, conexiones persistentes, cola de aceptación ampliada para solicitudes concurrentes, `Range`/`If-Range` con validadores `ETag` y `Last-Modified`, y caché privada de 60 segundos para respuestas de audio. Los rangos múltiples o malformados se ignoran y reciben el recurso completo en vez de fallar con 416; los rangos válidos no satisfechos sí devuelven 416.
- Cada transferencia registra en la consola estado HTTP, rango solicitado, bytes enviados/esperados, duración, velocidad observada y resultado (`complete`, `client-disconnected`, `short-read` o `stream-io-error`), sin imprimir el ticket secreto de la URL.
- El servidor Python no forma parte del despliegue de Pages: debe instalarse manualmente en el equipo anfitrión y reiniciarse. La ruta de audio desde una red móvil real sigue pendiente de verificación física; las pruebas locales no demuestran el ancho de banda de subida del host ni la calidad de Tailscale Funnel.


## 2026-11-09 — precarga coordinada de audio agrupado

- Los reproductores inline de Materiales conservan `preload="none"` al renderizar y obtienen la URL autenticada bajo demanda. Abrir Materiales no debe iniciar descargas de audio.
- Cuando el usuario inicia explícitamente un grupo, cada reproductor pasa temporalmente a `preload="auto"`; después de alinear su `currentTime`, el coordinador espera `canplay` en esa posición para todas las pistas. Al completar el buffer inicial vuelve a `metadata` justo antes de lanzar `play()` en conjunto. La espera tiene un límite de 15 segundos y falla explícitamente si alguna pista no consigue datos suficientes.
- El control de búsqueda de posición previsualiza el tiempo mientras se arrastra y aplica `currentTime` al evento `change`, evitando emitir una sucesión de seeks/Range requests durante cada movimiento del dedo. Un blur cancela la vista previa no confirmada.
- La precarga sólo se activa al pulsar reproducción de grupo; no se hidratan reproductores ocultos ni se descargan audios al expandir una tarjeta. No modifica tickets, permisos, RLS, Storage, archivos locales ni el servidor.


## Preparación completa de audio para reproducción (PR #157)

- `src/material-audio-cache.js` ofrece el almacenamiento OPFS por origen para los audios de Materiales. El archivo binario se escribe en streaming y el registro JSON de finalización solo se crea después de cerrar y verificar el archivo.
- La preparación usa la URL autenticada obtenida por `getAttachmentAccessUrl("material_attachments", attachment)`, solicita HTTP GET completo (exige 200; no admite 206/Range como copia íntegra) y compara los bytes recibidos con `Content-Length` cuando está disponible. Los fallos eliminan los archivos parciales y no crean registro de preparado.
- `materials-view.js` mantiene los mismos elementos `audio`: al estar preparada una pista, `ensureAudioUrl` cambia su fuente a un Object URL de la copia OPFS. El resolver de marcadores también prioriza esa copia para reproductores visibles y temporales. Por ello los grupos, marcadores, control de velocidad y sincronización del metrónomo continúan leyendo el mismo playhead/eventos y no necesitan una ruta paralela.
- La preparación de un grupo se ejecuta de manera secuencial para no saturar la ruta de subida/Funnel del host. Reproducir pistas no preparadas conserva el modo de streaming anterior.
- La copia es por usuario autenticado, origen y dispositivo; el registro valida el ID del usuario actual, evitando reutilizar accidentalmente la copia de otra cuenta en el mismo navegador. El navegador puede borrar OPFS cuando se limpian los datos del sitio o por presión de almacenamiento si no concede persistencia. `navigator.storage.estimate()` ayuda a detectar falta de espacio; `persist()` se solicita como best-effort. No hay cambios en Supabase, migraciones, RLS, Storage ni en el servidor Python.
- La retirada de una copia pausa y libera las fuentes blob preparadas antes de revocar sus URLs y quitar el archivo/registro OPFS. Se rechaza retirar una pista mientras cualquiera del grupo seleccionado siga reproduciéndose.


## 2026-11-10 — cuota preventiva de Supabase Storage (PR en revisión)

- `src/storage-quota.js` consulta los bytes del proyecto mediante `public.get_storage_quota_status` y comprueba espacio antes de subir. Administración muestra bytes usados, disponibles, archivos y umbrales.
- Materiales no-audio, Comentarios y Propuestas usan el bucket privado `materials`. Audio de Materiales con `storage_path = local:...` sigue en la biblioteca local y no consume esta cuota.
- La migración `20261112204157_enforce_storage_quota.sql` agrega políticas RESTRICTIVE INSERT/UPDATE, combinadas con los permisos de banda/propiedad ya existentes. Usa advisory transaction lock para serializar subidas simultáneas. El tamaño enviado por el cliente solo ayuda al rechazo previo; al confirmar se prioriza `metadata.size` medido por Storage.
- Límite inicial: 700.000.000 bytes (700 MB decimales), advertencia 70 %, crítico 85 %. Abarca todos los buckets del proyecto. No protege operaciones privilegiadas con service_role ni nuevos proyectos agregados manualmente a la organización.
- `storage.objects` se consulta en solo lectura; nunca se modifican sus filas directamente. Las operaciones siguen pasando por Storage API.
- Migración aplicada en producción y registrada como `20261112204157`. CI de PR/main pasó; la consulta de cuota se verificó con el rol `authenticated`. El asesor de seguridad deja un WARN intencional por la RPC `SECURITY DEFINER`, limitada a integrantes activos y con `search_path` vacío y RLS desactivado solo dentro de la función.
