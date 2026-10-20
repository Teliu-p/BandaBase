# Mapa de arquitectura de BandaBase

**Base funcional de observación:** main 611043389f58a962152f16cabdedd5c18b165865, inspeccionada el 2026-10-19 tras integrar la PR #112. Verificar el HEAD real y el orden de scripts antes de futuros cambios.

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
- metronome.js: configuración de métrica, temporización de clics, acentos, subdivisiones, tap tempo, ganancia ajustable y sincronización opcional con el playhead de un audio de Materiales. Usa BPM/métrica conocidos y eventos de play/pause/seek/ratechange; no analiza la forma de onda. Una calibración manual de fase se guarda en localStorage por canción y adjunto, y se invalida para el uso actual si no coinciden BPM/métrica. Mantener pruebas para la fase del compás, calibración, cancelación de clics programados y modo independiente.

### Materiales, comentarios y contenido enriquecido

- materials-data.js: materiales, adjuntos, bloques y RPC replace_material_blocks.
- materials-editor.js: compositor enriquecido, inserción de archivos/enlaces/figuras musicales y marcadores temporales inline; la herramienta de marcador captura el tiempo del control de audio enfocado o del único reproductor activo y conserva la entrada manual como alternativa. Gestiona selección/caret, atajos numéricos y sangría mediante espacios reales con repetición al mantener presionado.
- materials-formatting.js: sanitización y serialización/renderizado de texto enriquecido, enlaces y marcadores temporales permitidos. El marcador se persiste como un `span` canónico dentro del rich text, no como HTML arbitrario.
- materials-save.js: proceso de guardado, carga de adjuntos, compensación ante fallos y restauración parcial.
- materials-view.js: renderizado en flujo de bloques, chips compactos de adjuntos, reproducción de audio bajo demanda con panel flotante de tiempo/progreso y salto a todos los adjuntos de audio de la canción (también en Materiales plegados) al pulsar un marcador.
- comments-data.js: comentarios de canción/generales, adjuntos, bloques, borrado y RPC replace_comment_blocks.
- comments-view.js y comments-general.js: renderizado y eventos de comentarios asociados a canciones y comentarios generales.
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
- proposals-view.js: tarjetas, controles de voto y resultados.
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