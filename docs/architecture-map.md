# Mapa de arquitectura de BandaBase

**Base funcional de observación:** revisión de PR #135, inspeccionada el 2026-10-26. Los archivos de migración nuevos deben coincidir por prefijo con las versiones aplicadas en Supabase. Verificar siempre el HEAD real y el orden de scripts antes de futuros cambios.

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
- metronome.js: configuración de métrica, temporización de clics, acentos, subdivisiones, tap tempo, ganancia ajustable y sincronización opcional con el playhead de un audio de Materiales. Usa BPM/métrica conocidos y eventos de play/pause/seek/ratechange; no analiza la forma de onda. La calibración manual guarda fase en localStorage por canción/adjunto y, al capturarla, convierte el tiempo transcurrido según `playbackRate`; se invalida para el uso actual si no coinciden BPM/métrica. Mantener pruebas para fase, calibración a velocidad alterada, cancelación de clics y modo independiente.

### Materiales, comentarios y contenido enriquecido

- materials-data.js: materiales, adjuntos, bloques y RPC replace_material_blocks.
- materials-editor.js: compositor enriquecido, inserción de archivos/enlaces, cinco figuras musicales, cinco silencios y puntillo de la siguiente inserción. Agrupa visualmente las parejas consecutivas sin puntillo de corcheas y semicorcheas mediante nodos canónicos de notación. Conserva marcadores temporales inline y gestiona selección/caret y atajos Alt+1–6, Q/W/E/R/T, A/S/D/F/G, Z, X, C/V y 0.
- materials-formatting.js: sanitización y serialización/renderizado de texto enriquecido, enlaces, marcadores temporales y notación. Las figuras/silencios se almacenan como `span` con una clave permitida y se dibujan con SVG generado localmente; los caracteres musicales antiguos se convierten al renderizarlos/editar para no depender de fuentes instaladas. No se inserta SVG arbitrario desde el contenido guardado.
- materials-save.js: proceso de guardado, carga de adjuntos, compensación ante fallos y restauración parcial.
- materials-view.js: renderizado en flujo de bloques, chips compactos de adjuntos, reproducción nativa `<audio>` bajo demanda mediante URL firmada y panel flotante de tiempo/posición. El panel permite velocidades del 25% al 200% (presets y porcentaje personalizado), solicitando conservación de afinación con `preservesPitch` y alias compatibles, y descarga de cada archivo de Materiales. Los marcadores posicionan todos los audios de la canción, incluso en Materiales plegados. El reloj de reproducción lo gestiona el navegador; la app no usa un temporizador propio para avanzar muestras de audio.
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

El editor representa texto, enlaces y archivos como bloques ordenados. Guardar material puede involucrar registro base, objetos en Storage, filas de adjuntos y reemplazo de bloques. materials-save.js implementa compensación/rollback para pasos parciales; no reducir este flujo a un INSERT simple. Audio usa URLs firmadas bajo demanda para evitar cargarlo hasta que el usuario quiera reproducirlo.

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

