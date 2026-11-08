# BandaBase — punto de entrada para asistentes de IA

**Última inspección:** 2026-11-08 (zona horaria de Argentina)  
**Rama de referencia:** main  
**Trabajo funcional reciente:** PR #135 incorporó pegado enriquecido seguro, comparación compartida y reproducción agrupada. PR #136 integró el acceso local a adjuntos de audio con fallback a Supabase Storage. PR #137 configuró el hostname HTTPS de Tailscale Funnel y se fusionó en `main` como `678c218ac591f25d022d760280249158cfddefd8`. PR #138 corrigió el fallback ante HTTP 5xx de Funnel/servidor local y se fusionó como `28cbe3141ea6924d7c2562b65c33f6edd7325d5e`; Tests [#41955423709](https://github.com/Teliu-p/BandaBase/actions/runs/41955423709) y Pages [#41955423316](https://github.com/Teliu-p/BandaBase/actions/runs/41955423316) pasaron. El usuario confirmó reproducción desde el reproductor habitual de Materiales en el host; el acceso autenticado desde una segunda PC sigue pendiente. PR #140 integró el audio de Materiales local-only como `55ebb0ebc141f32c7276820617c74567d922650e`; PR #141 incorporó selector múltiple y movimiento inicial de chips de audio como `f65735cdf3d5f1a92b4e9d68363d57284df484c1`; PR #142 integró un primer cálculo por caracteres con guía de destino como `f902f0e8287fcb879ea1f582a3b85ade561c94ca`; PR #143 (`e3830846b478004bb8d1611910cc58007ffeb785`) fue un primer intento de vista previa sombreada inline limitado a audio. Tras la aclaración final del usuario, PR #144 generalizó el movimiento a todos los adjuntos de archivo: copia visual que sigue al puntero, espacio sombreado en el destino, redistribución del texto y commit del mismo nodo original; cancelación o drop externo restaura el origen. PR #144 quedó fusionada como `858271ba90576ba3211305c17f06ec7285eeb29d`. CI de PR [#42085812268](https://github.com/Teliu-p/BandaBase/actions/runs/42085812268), Tests de main [#42085984629](https://github.com/Teliu-p/BandaBase/actions/runs/42085984629) y Pages [#42085984089](https://github.com/Teliu-p/BandaBase/actions/runs/42085984089) pasaron. Luego, el usuario detectó que el placeholder podía caer al comienzo del renglón. PR #145 corrigió esto priorizando el caret nativo bajo `clientX/clientY` y recalculando en `pointerup`; fue fusionada como `7a736fde56c84d2c945e6d0bfac24a87312d1ddd`. Tests de PR [#42088181209](https://github.com/Teliu-p/BandaBase/actions/runs/42088181209), Tests de main [#42088380247](https://github.com/Teliu-p/BandaBase/actions/runs/42088380247) y Pages [#42088379801](https://github.com/Teliu-p/BandaBase/actions/runs/42088379801) pasaron. El usuario confirmó que PR #145 todavía dejaba el audio al extremo izquierdo en el uso real. El usuario informó que el arrastre siguió fallando tras las PR #141–#146. PR #147 quedó fusionada en main como `2d0af16f527fc29d4b840ff9a2f2d884b8af55fb`. PR #150 corrigió el cálculo de inserción para que el adjunto quede exactamente donde se suelta; el usuario confirmó manualmente en Chrome para Windows que funciona tanto en renglones vacíos como después de texto. PR #151 integró los reintentos de refresco Realtime y el aislamiento de la vista previa de comentarios; el usuario confirmó el comportamiento con dos sesiones autenticadas. PR #149 añadió la protección de autoedición en Listas y se fusionó en `5d003055e5067cb3bfdb53c8c54bcdd9b073eaf9`.
**Aplicación:** https://teliu-p.github.io/BandaBase/  
**Repositorio:** https://github.com/Teliu-p/BandaBase  
**Proyecto Supabase:** evuwcikuxptrgzdzejov
**Cambio funcional reciente (2026-11-08):** PR #155 añade BPM con precisión de 0,01 en alta/edición/original/metrónomo y Tap tempo, migración de producción `20261108055107_support_decimal_song_bpm.sql` (`songs.bpm` y `songs.original_bpm` a `numeric(5,2)`), y regresión Chromium móvil 360×800. CI #42452516755 pasó con 26 smoke tests y prueba PostgreSQL de migración. La prueba física en un teléfono y desde otra red no está realizada; el test de viewport no equivale a ello.

Este archivo es la puerta de entrada para cualquier conversación nueva sobre BandaBase. No reemplaza la inspección del código y del estado remoto: las notas pueden quedar desactualizadas cuando main, Supabase o las PR cambien.

## Actualización de auditoría (2026-10-20)

Se fusionaron PR #123, #124, #126, #127, #128, #129, #130 y #131. Los cambios abarcan la sangría inversa de varias líneas y Alt+1–6; endurecimiento de lectura de archivos asociados a registros activos en Storage; consolidación de las dos políticas UPDATE de `band_list_items`; índices faltantes en claves foráneas; guardados atómicos de listas/responsables, asignaciones canción-lista, campos/cantantes de canciones y papelera múltiple de comentarios; serialización de inicializaciones de sesión y captura de errores de red de Auth; límite preventivo de 50 MiB en los selectores de archivo; y versión fijada de Supabase JS en el CDN (`2.118.0`).

Las tres migraciones nuevas ya se aplicaron a Supabase. Sus versiones remotas son `20261020232312`, `20261020232328` y `20261020232333`; los archivos SQL deben conservar exactamente esos prefijos. La prueba conjunta de las migraciones y las RPC se ejecutó con rol `authenticated` dentro de una transacción revertida. El chequeo posterior encontró 0 claves foráneas sin índice y una sola política SELECT de Storage para el bucket `materials`.

Actualización de Storage (2026-10-20): el bucket `materials` sigue privado y ahora tiene límite por bucket de `52428800` bytes (50 MiB); la lectura posterior confirmó el valor guardado. La interfaz conserva el mismo tope. `allowed_mime_types = null` se mantiene para no bloquear formatos legítimos sin inventariar; no se debe interpretar como una lista MIME validada. El proyecto está en el plan Free, cuyo límite global no puede superar 50 MB; el menor entre el límite global y el del bucket es el efectivo. Para admitir archivos mayores hace falta pasar a un plan compatible, aumentar el límite global y revisar subidas reanudables para archivos mayores de 6 MB. Los asesores aún marcan protección contra contraseñas filtradas deshabilitada y dos funciones SECURITY DEFINER accesibles a `authenticated` (`is_band_member` y `get_proposal_vote_stats`); revisarlas por separado, sin alterar su comportamiento de autorización sin pruebas. El registro de migraciones mantiene la discrepancia histórica documentada de doce archivos locales sin versión remota; no ejecutar `supabase db push`, ni insertar/borrar historial manualmente como solución rápida.

## Actualización de auditoría (2026-10-21): Realtime, instrumentos y Materiales

- Se comprobó que la publicación PostgreSQL `supabase_realtime` existía pero no incluía ninguna tabla. La migración `20261021224042_enable_realtime_for_bandabase.sql` ya se aplicó y la consulta posterior confirmó 20 tablas en la publicación. No se modificaron registros de canciones, comentarios ni materiales.
- `src/app-realtime.js` crea una única suscripción por banda/sesión y usa cada evento como señal para volver a consultar con el cliente autorizado por RLS. Refresca canciones/cantantes, materiales, comentarios, listas, propuestas e integrantes; informa errores de conexión y difiere ciertas vistas mientras hay formularios abiertos para no pisar borradores. No se debe asumir entrega garantizada cuando se corta la red: Realtime no reemplaza la consulta de datos como fuente de verdad.
- Los instrumentos de perfil/listas/participación se dibujan con SVG definido en `src/utils.js`; no depender de emoji/fuentes del sistema operativo para guitarra, voz, teclado, bajo y batería.
- En Materiales, Enter inserta saltos explícitos, la serialización aplana los `DIV/P` del `contenteditable` preservando líneas vacías y el orden de chips de adjuntos, y la vista guardada comparte `white-space: pre-wrap` con el editor. Se añadió una prueba de regresión de texto–audio–texto con una línea vacía.
- Límite de la evidencia: CI pasó con Auth simulado y la publicación remota quedó verificada. Falta la comprobación manual desde dos PCs con sesiones reales, y confirmar el despliegue de Pages de este cambio.

## Actualización funcional (2026-10-26): pegado enriquecido, comparación y grupos de audio

- La PR #135 añade `createMaterialClipboardFragment` en `materials-formatting.js`: al pegar se prioriza `text/html`, se sanitiza con la allowlist del compositor y se conserva texto plano como respaldo. El formato válido incluye negrita, cursiva, tamaños admitidos, enlaces, figuras SVG de notación y marcadores temporales. Los adjuntos de audio copiados como chips no se convierten en referencias DB cruzadas a otro material.
- “Comparación con original” usa `renderMaterialViewBlock` y `bindMaterialViewEvents`, igual que los materiales normales. Su botón abre el editor compartido; `createMaterial` debe conservar `COMPARISON_MATERIAL_TYPE` si el caller lo pasa. Al cambiar de canción se vacía de inmediato la comparación anterior.
- La calibración manual del metrónomo queda guardada por canción y se reutiliza al elegir cualquier pista alineada. La lectura puede migrar un ajuste antiguo por adjunto si encuentra alguno entre las pistas cargadas. Sigue validando BPM y métrica.
- Clic derecho sobre una pista de audio alterna la selección de grupo. Al pulsar Play en una pista seleccionada, se cargan todas las URLs/metadatos, se alinean al mismo tiempo (incluidos milisegundos) y se llama a `play()` para todas. Con el metrónomo sincronizado, la transición de grupo evita reaccionar de manera independiente a cada evento play/pause.
- Las pruebas incluyen pegado HTML enriquecido con contenido activo descartado, comparación usando el renderizador/editor compartido y selección/alineación de pistas en Chromium. Hace falta todavía probar de oído la alineación con originales/splits reales y verificar el despliegue de GitHub Pages después de la integración.

## Actualización 2026-11-05: adjuntos múltiples y movimiento de audio en Materiales

- PR #141 (`feat/materials-multi-file-audio-reorder-20261105`) incorpora el atributo `multiple` y la inserción secuencial de archivos tras validar la selección completa.
- Los chips de audio se mueven dentro de `materialComposerEditor` con Pointer Events, sin `draggable` HTML5; el objetivo es mover el mismo nodo y persistir su orden mediante `collectMaterialComposerBlocks`.
- Al reportarse que ambas funciones no actuaban en la web, se comprobó que `main` seguía en `7b48607925b638a5cf2f061bbf09bb71d4563cc8` y PR #141 no estaba fusionada. La selección múltiple aún no había llegado a Pages. La prueba inicial de HTML5 drag no representaba el gesto real y fue reemplazada por una prueba mouse down/move/up que exige identidad del mismo nodo.
- Verificar HEAD, CI y Pages después de integrar antes de pedir validación manual.

## Instrucciones de arranque para cada chat nuevo

1. Leer este archivo completo.
2. Leer docs/architecture-map.md, docs/product-spec.md, docs/current-state.md y docs/decisions-and-incidents.md.
3. Verificar el HEAD real de main, la fecha del último commit, las PR abiertas y el resultado reciente de CI. No asumir que el SHA indicado arriba sigue siendo HEAD.
4. Si el trabajo toca Supabase, inspeccionar el esquema y las políticas actuales además de revisar las migraciones Git. El historial de migraciones y el estado de la base no siempre cuentan la misma historia.
5. Antes de editar, describir el flujo afectado, las dependencias y la prueba de regresión que se ejecutará. Mantener cambios acotados.
6. Al terminar, actualizar la documentación afectada y la sección de estado de este archivo si cambió una decisión, un riesgo o una PR importante.

## Qué es BandaBase

Aplicación web para una banda de iglesia. Gestiona miembros y perfiles, catálogo de canciones, cantantes y tonalidades, materiales mixtos de texto/archivo/enlace, listas y participación de músicos, propuestas con votación, comentarios, administración, papelera e historial/auditoría.

Stack actual: HTML/CSS y JavaScript modular organizado en archivos separados, cargados como scripts clásicos desde index.html; Supabase para Auth, PostgreSQL, Row Level Security y Storage; GitHub Pages para publicar. Los módulos comparten nombres globales. El orden de carga en HTML es una dependencia real: no convertir un script en módulo ES ni cambiar el orden sin una migración arquitectónica explícita.

## Documentación del proyecto

- docs/architecture-map.md: módulos, orden de carga, flujos, tablas y puntos de acoplamiento.
- docs/product-spec.md: comportamiento deseado acordado con el usuario.
- docs/current-state.md: evidencia técnica comprobada, CI, diferencias Git/Supabase y asuntos abiertos.
- docs/decisions-and-incidents.md: decisiones, fallos históricos y reglas para no repetir regresiones.
- docs/database-migration-history-audit.md: auditoría anterior del historial.
- docs/database-migration-history-reconciliation-followup.md: conclusión más reciente sobre las doce migraciones locales sin registro remoto equivalente.

## Reglas de trabajo no negociables

- Inspeccionar el estado vigente antes de modificarlo; no trabajar de memoria cuando se puede leer el código.
- Priorizar la causa raíz y un diff mínimo. No refactorizar funciones no relacionadas como parte de un arreglo puntual.
- No declarar una función rota o corregida sin inspeccionar sus referencias y comprobar las pruebas pertinentes.
- Mantener compatibilidad entre módulos y el orden de scripts. Las funciones compartidas son globales.
- Para Supabase: inspección de solo lectura primero; distinguir SQL versionado, estado real del esquema y filas de schema_migrations. Nunca ejecutar db push, reparar el historial, insertar filas de tracking ni aplicar migraciones no verificadas en bloque.
- No modificar datos o permisos de producción como parte de una investigación. Para cambios SQL preparar migración revisable, evaluar efecto y rollback, probar todo lo posible sin producción y dejar explícito lo que no se pudo probar.
- No crear ramas de desarrollo de Supabase que puedan generar coste. El usuario prioriza permanecer en el plan gratuito.
- No afirmar que existe acceso al navegador/sesión del usuario: las herramientas de repositorio o base no equivalen a controlar su pestaña.
- No pedir ni almacenar contraseñas, tokens privados ni secretos. La clave publicable de Supabase que usa el cliente no es una credencial privilegiada; nunca documentar claves o tokens innecesarios.
- Después de un cambio: ejecutar pruebas existentes, lint y smoke tests aplicables; consultar CI; revisar diff; probar flujos vecinos y documentar resultados reales.

## Rutina de actualización de esta documentación

En cada PR que cambie comportamiento, arquitectura, esquema, permisos o flujos de usuario:

1. Actualizar la sección correspondiente de product-spec o architecture-map si cambió el comportamiento o el diseño.
2. Registrar en decisions-and-incidents la decisión nueva o la incidencia y su resolución, con fecha, commit/PR y prueba realizada.
3. Actualizar current-state para reflejar PR abiertas/cerradas, migraciones, advertencias, pruebas y limitaciones actuales.
4. Corregir SHA/fecha de inspección en este archivo si se cambia el estado de referencia.
5. No convertir una hipótesis en hecho. Etiquetar cada afirmación importante como verificada en código, verificada en remoto, prueba automatizada, información de conversación pendiente de verificar o hipótesis.

## Resumen del estado conocido al escribir esta línea de base

- main observado antes de la tanda de herramientas musicales: e75c2d13e231bfe1c059ea92a7a82cbe53ef26cf (fotografía histórica).
- PR #108 corrigió la sangría en espacios de a uno y el renderizado inline del audio en Materiales; merge `a553d7ecb3b9621fd85dc7a74e9c3fd7b2c721a9`. Tests y Pages deploy pasaron: https://github.com/Teliu-p/BandaBase/actions/runs/39217970149 y https://github.com/Teliu-p/BandaBase/actions/runs/39217971029.
- PR #110 quedó fusionada en `cd9cff753c2da3eb559f11b9d4a5071f979e81b6`: https://github.com/Teliu-p/BandaBase/pull/110. Tests y Pages pasaron: https://github.com/Teliu-p/BandaBase/actions/runs/39327396377 y https://github.com/Teliu-p/BandaBase/actions/runs/39327398433. El chip muestra solo el tiempo y salta a todos los audios de la canción, incluso Materiales plegados. La verificación manual autenticada sigue pendiente; no se modificó Supabase.
- PR #111 quedó fusionada como `2497e01ab23169936b49d7141672db7dab4e9904`: https://github.com/Teliu-p/BandaBase/pull/111. La herramienta ⏱ captura el tiempo del audio enfocado o del único reproductor activo y conserva la entrada manual como alternativa. Tests y Pages pasaron: https://github.com/Teliu-p/BandaBase/actions/runs/39332251159 y https://github.com/Teliu-p/BandaBase/actions/runs/39332250632. Sigue pendiente una prueba manual autenticada con audio real.
- PR #112 quedó fusionada como `611043389f58a962152f16cabdedd5c18b165865`: https://github.com/Teliu-p/BandaBase/pull/112. Añade sincronización opcional con un audio de Materiales usando BPM/métrica conocidos, sigue play/pause/seek/marcadores y reduce la anticipación inicial del clic. Tests y Pages pasaron: https://github.com/Teliu-p/BandaBase/actions/runs/39350807878 y https://github.com/Teliu-p/BandaBase/actions/runs/39350808799.
- PR #113 fusionada como `3c6588dc282c3337f7dba2a78e38a19511a59b9a`: https://github.com/Teliu-p/BandaBase/pull/113. Agrega «Guardar ajuste manual» al metrónomo y persiste la fase en localStorage por canción/adjunto. Tests y Pages pasaron; falta validación manual audible con audio real.
- PR #114 fusionada como `ddaf9a073b5fbf5def723e4bbab02781ba439800`: https://github.com/Teliu-p/BandaBase/pull/114. Restaura velocidad ajustable de los audios de Materiales con conservación de afinación, agrega descargas en Materiales/Comentarios/Propuestas y corrige la calibración del metrónomo cuando el audio no corre a 1×. CI de la rama pasó; no se modificó Supabase. Las pruebas de main y el despliegue de Pages del merge deben confirmarse con el HEAD actual. No se ha hecho prueba audible autenticada con una grabación real.
- PR #115 (https://github.com/Teliu-p/BandaBase/pull/115), rama `feat/material-note-rest-dotted`, fue fusionada como `b96bd579234c86f99d89c693bba9727fa21761c2`. Amplía las figuras de Materiales, añade los cinco silencios equivalentes y el puntillo de la siguiente inserción. Tests y Pages pasaron; no se modificó Supabase.
- PR #117 (https://github.com/Teliu-p/BandaBase/pull/117) fue fusionada como `5ab8c9960967a8ada41575ad5a2298a3db2a71da`. Agrupa visualmente las parejas de corcheas/semicorcheas, aumenta los botones musicales y actualiza los atajos. Tests y Pages de main pasaron. Falta la comprobación manual del renderizado de glifos.
- PR #119 (https://github.com/Teliu-p/BandaBase/pull/119), rama `fix/materials-portable-notation-20261020`, fue fusionada como `b4df67ce393a6d199fa1fa436c67b95dcf59ab78`. Sustituyó la dependencia de glifos Unicode por SVG inline permitido y convirtió símbolos antiguos al renderizarlos/editar. El primer seguimiento de tamaño (PR #121, fusionada como `d1c53a10c9d6ef459058c5e1e8ad4b2e9e923386`) dejó la caja en `0.72em`, pero el margen interno del `viewBox` hizo que la tinta visible quedara demasiado pequeña. La PR #122 (https://github.com/Teliu-p/BandaBase/pull/122) corrige la calibración: caja base `0.96em`/alineación `-0.145em`, ajustes de línea base específicos para la blanca y redonda, parejas `0.925em` × `0.82em`/alineación `-0.106em`, y trazos principales SVG de `2.8` unidades. La CI del commit con código final pasó ([Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39445031361)); tras la documentación, volver a verificar el último HEAD. La inspección visual manual todavía está pendiente.
- Nota histórica: esa fotografía de 44/56 quedó superada el 2026-11-06; el tracking actual fue reconciliado a 60/60. Ver docs/database-migration-history-reconciliation-followup.md.
- PR #98 sigue abierta como borrador histórico, pero su propuesta quedó desactualizada: la política UPDATE duplicada ya fue consolidada por la migración 20261020232312. No fusionar su SQL. La brecha restante del trigger se trabaja en PR #149; ver docs/current-state.md.
- La PR #103 quedó fusionada en main: https://github.com/Teliu-p/BandaBase/pull/103.
- No se modificó código ni datos de producción al crear esta documentación.

## Plantilla de traspaso para una conversación nueva

Estoy trabajando en BandaBase. Leé primero AI_CONTEXT.md y los cuatro documentos de contexto que enlaza. Después verificá el estado actual de main, PR abiertas, CI y, si aplica, esquema/políticas reales de Supabase. No asumas que los SHA ni los problemas abiertos de los documentos siguen vigentes. Antes de cambiar código, explicá el flujo exacto y las pruebas; hacé un diff mínimo, evitá producción a ciegas y actualizá la documentación en la misma PR. Confirmá con evidencia qué verificaste y qué no.

## Actualización de contexto (2026-11-03): biblioteca local de audio

Se probó el servidor local en Windows con un FLAC de 11.441.359 bytes. La prueba autenticada desde GitHub Pages obtuvo ticket HTTP 200, lectura HEAD 200, tipo audio/flac, descarga por rango HTTP 206 con 1024 bytes correctos y reproducción audible en un reproductor temporal. La integración cliente se fusionó en `main` como `e96712ee41de5599e36a58b1d1dd72d2919946bd`; Tests y Pages de ese commit pasaron. Mantiene fallback a Supabase Storage para audios no copiados o servidor local inaccesible, y no modifica datos ni `storage_path`. Ese primer estado quedó superado por la integración de Funnel descrita en la actualización posterior. El reproductor habitual de Materiales ya fue probado manualmente en el equipo anfitrión.


Verificación de CI de la integración local (PR #136): commit `f6440040196e25553a5eb4ed73b6e11b300e028a`; workflow [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/41720921806) pasó `npm test`, ESLint `no-undef` y Playwright/Chromium (14 pruebas). La PR #136 se fusionó en `main` como `e96712ee41de5599e36a58b1d1dd72d2919946bd`; posteriormente PR #137 agregó la configuración de Funnel y se fusionó como `${finalSha}`. Tests y Pages de ambos cambios pasaron. Solo queda pendiente la reproducción autenticada desde una segunda computadora.

## Actualización de contexto (2026-11-03): Tailscale Funnel

Esta actualización reemplaza los estados anteriores que indicaban que Funnel seguía pendiente o que la PR #136 no estaba integrada.

- Estado de referencia al comenzar esta configuración: `main` en `08ff7b61550569c05c1a8ad0021df0312282abf7`; PR #136 ya integrada. La prueba manual del usuario confirmó que el reproductor habitual de Materiales reproduce normalmente en el equipo anfitrión.
- Tailscale 1.104.5 está conectado en Windows como `laptop-2pepu3jl`. Funnel publica `https://laptop-2pepu3jl.tail831d95.ts.net/` y reenvía a `http://127.0.0.1:8788`.
- Comprobaciones ejecutadas por el usuario: `/health` respondió bien por HTTPS; el preflight CORS desde `https://teliu-p.github.io` devolvió 204 con Authorization/Content-Type y POST permitidos; POST sin sesión dio 403 tanto local como público con el mismo mensaje «Falta la sesión autenticada de BandaBase.». Esto confirma el proxy y la barrera de sesión, no una prueba autenticada desde otro equipo.
- PR #137 (`funnel-audio-config-20261103`) se fusionó como `678c218ac591f25d022d760280249158cfddefd8`. Incluye `src/audio-server-config.js` antes de `src/attachment-access.js`, con el hostname HTTPS de Funnel, y una regresión que comprueba el orden y el uso del endpoint. Tests [#41723820635](https://github.com/Teliu-p/BandaBase/actions/runs/41723820635) y Pages [#41723820206](https://github.com/Teliu-p/BandaBase/actions/runs/41723820206) terminaron correctamente.
- Falta probar un audio real desde una segunda computadora con sesión de BandaBase. El equipo anfitrión debe estar encendido/despierto y mantener activos tanto `bandabase_audio_server.py` como el proceso `tailscale funnel 8788`. Si el host no responde, el cliente conservará el fallback a Supabase Storage.
- No se modificaron Supabase, datos, RLS, Storage, esquema, migraciones ni el servidor Python.


## Verificación final de configuración Funnel (2026-11-03)

- HEAD funcional de main: `678c218ac591f25d022d760280249158cfddefd8` (PR #137). Tests y despliegue de Pages pasaron en los workflows enlazados arriba.
- El archivo público `src/audio-server-config.js` contiene solo el hostname HTTPS, no secretos. La autorización sigue en el JWT de Supabase y RLS del servidor local.
- Próxima verificación: desde una segunda computadora, iniciar sesión en BandaBase y reproducir el FLAC de la biblioteca mientras el host Windows permanece despierto con el servidor Python y Funnel activos.

## Actualización de contexto (2026-11-04): fallback cuando el host local está apagado

- El usuario observó que los audios dejaron de reproducirse desde una segunda computadora después de apagar el host. No se capturó el código HTTP real; no se debe afirmar como hecho que Funnel devolvió 502.
- La inspección de `src/attachment-access.js` en main encontró una brecha: los fallos de red/timeout y 409 activaban Storage fallback, pero un HTTP 5xx del proxy era tratado como un error explícito y podía impedirlo.
- PR #138 (`fix/audio-storage-fallback-server-errors-20261104`) se fusionó en `main` como `28cbe3141ea6924d7c2562b65c33f6edd7325d5e`. Los HTTP 500–599 ahora permiten continuar a Storage; 4xx, incluido 403, siguen siendo explícitos. Tests de PR, Tests de main y Pages pasaron ([PR](https://github.com/Teliu-p/BandaBase/actions/runs/41901884137), [main](https://github.com/Teliu-p/BandaBase/actions/runs/41955423709), [Pages](https://github.com/Teliu-p/BandaBase/actions/runs/41955423316)).
- La causa HTTP exacta del incidente sigue sin capturarse; el cambio es una corrección defensiva del camino de fallback, no prueba retrospectiva de que el host devolvió 502.
- Revisión estática de la copia compartida de `bandabase_audio_server.py`: escucha en `127.0.0.1`, rutas desconocidas devuelven 404, no hay listado ni ruta arbitraria de archivos, y la entrega de medios exige ticket HMAC válido generado después de consultar la fila con el JWT del usuario/RLS. Los logs omiten el contenido del ticket. Los tickets duran 60 minutos; no hay rate limiting. No se comparó esta copia con el archivo actualmente instalado en Windows ni se verificaron ACL locales.


## Actualización de contexto (2026-11-05): audio de Materiales local-only en preparación

- Requisito nuevo: Materiales debe guardar/reproducir audios exclusivamente desde la biblioteca local del host. No Storage fallback para `material_attachments` audio. La prueba manual debe hacerse desde la misma PC anfitriona; no pedir como requisito otra computadora.
- Rama: `feat/material-audio-local-only-20261104`. Cambios de cliente en `src/attachment-access.js`, `src/materials-editor.js`, `src/materials-save.js`, `src/materials-view.js`; regresiones en `tests/js-syntax.test.mjs`. El estado aún no está fusionado ni desplegado.
- Nuevos adjuntos de audio se registran con `storage_path = local:<clave-opaca>`, luego se suben con JWT a `POST /api/upload/<attachment_id>`. Playback exige `/api/ticket` y URL local. 409/5xx/desconexión no deben llamar a Supabase Storage para Materiales. Eliminar usa `POST /api/delete/<attachment_id>`. No-audio de Materiales y audio de Comentarios/Propuestas mantienen Storage.
- Servidor Python versión 0.3 preparado como archivo para la PC: upload/delete, JWT + RLS, comprobación creador/admin, escritura streaming y temporal/atómica, no sobrescribe claves existentes y serializa upload/delete por ID. Copia actual en el entorno: `/mnt/data/bandabase-source/bandabase_audio_server.py`; debe entregarse al usuario. Aún no se instaló en `C:\\BandaBaseAudio\\bandabase_audio_server.py`.
- Tests Python aislados pasaron compile, 403 sin sesión, upload 201, ticket 200, GET 200, Range 206, overwrite rechazado 400 y delete 200; Supabase se simuló en esa prueba. Las regresiones JS y el CI de la rama todavía deben verificarse.
- Supabase en vivo: `material_attachments.storage_path` es text; RLS permite select a miembros y escritura al creador/admin; `is_band_admin(uuid)` se encuentra disponible para authenticated. No se aplicaron migraciones ni se tocaron datos/RLS/Storage al preparar el cambio.
- Los objetos antiguos de audio en Storage no se migran ni borran. Los audios antiguos que no estén ya en la biblioteca/manifest dejan de reproducirse en Materiales hasta re-adjuntarlos localmente. No borrar objetos cloud en bloque.


## Verificación final: audio de Materiales local-only (2026-11-05)

- PR #140 se fusionó en \`main\` como \`55ebb0ebc141f32c7276820617c74567d922650e\`. Tests [#41960155461](https://github.com/Teliu-p/BandaBase/actions/runs/41960155461) y Pages [#41960155134](https://github.com/Teliu-p/BandaBase/actions/runs/41960155134) pasaron en ese SHA.
- Estado definitivo: los audios de Materiales se guardan y reproducen exclusivamente desde la biblioteca local; no hay fallback a Supabase Storage ni ante host apagado. Archivos no-audio de Materiales y adjuntos de Comentarios/Propuestas mantienen Storage. No se migran ni eliminan objetos antiguos de Storage.
- Servidor local v0.3 actualizado: \`POST /api/upload/<attachment_id>\` y \`POST /api/delete/<attachment_id>\`, JWT/RLS y comprobación creador/admin para upload, escritura por streaming a temporal local, no sobrescritura de claves, serialización por ID y eliminación local. Archivo entregado en esta conversación como \`bandabase_audio_server.py\`; aún debe instalarse manualmente en \`C:\\BandaBaseAudio\\bandabase_audio_server.py\`.
- Validaciones: py_compile y prueba HTTP aislada con Supabase simulado: no-session 403, upload 201, ticket 200, Range 206, no-sobrescritura 400 y delete 200. CI de la rama y CI/Pages de main pasaron. La verificación autenticada final contra el proyecto real queda para cuando el usuario instale el .py y guarde un audio de prueba desde el host.
- Supabase: no hubo cambios de esquema, migraciones, RLS ni datos. \`material_attachments.storage_path\` ya era text y acepta claves \`local:\`. No es necesario usar otra computadora para validar el objetivo solicitado.

## Actualización funcional (2026-11-05): posición precisa al mover audios en Materiales

- PR #142 quedó integrada en `main` como `f902f0e8287fcb879ea1f582a3b85ade561c94ca`: https://github.com/Teliu-p/BandaBase/pull/142.
- El compositor calcula el destino entre caracteres/chips inline a partir de sus rectángulos visuales y muestra una guía vertical con una zona sombreada del ancho aproximado del audio. El mismo Range previsualizado se reutiliza al soltar.
- El movimiento conserva el mismo nodo del adjunto; el serializador existente registra el nuevo orden. No se cambió el flujo de carga/guardado.
- CI del commit de PR `3cba0dc69ed26a561762609779eae37eeb2730d4` pasó `npm test`, ESLint/no-undef y smoke tests de Chromium: https://github.com/Teliu-p/BandaBase/actions/runs/41982813856.
- No hubo cambios de Supabase (esquema, migraciones, RLS, Storage ni filas).
- Los workflows de Tests y Pages de main se dispararon luego del merge; revisar su resultado y el marker `bandabase-build` antes de declarar desplegada la versión pública.

## Aclaración funcional (2026-11-05): arrastre con redistribución real del renglón

- El usuario rechazó la vista previa flotante/cursor: necesita ver el chip en su ubicación provisional real dentro del compositor, ocupando su ancho y empujando las letras siguientes mientras arrastra. Al mover el chip, el texto debe recuperar el espacio que deja.
- Seguimiento en rama `fix/material-audio-live-drag-preview-20261105`: mover el mismo nodo DOM en cada evento Pointer, con resaltado; guardar marcador invisible + espacios originales para restaurar posición si ocurre `pointercancel`. Al soltar, conservar la posición visible.
- Nueva prueba E2E prevista: validar que el mismo nodo esté moviéndose antes de soltar, que el texto se desplace por el ancho del chip, que el commit conserve el lugar y que la cancelación restaure exactamente el origen. No afirmar implementación publicada hasta verificar CI y Pages.

## Resultado funcional (2026-11-05): vista previa sombreada inline de audios

- PR #143 integrada en `main` como `e3830846b478004bb8d1611910cc58007ffeb785`: https://github.com/Teliu-p/BandaBase/pull/143.
- Se muestra un placeholder sombreado inline en el flujo del editor. Su ancho equivale al chip y sus separaciones; mientras se arrastra, se mueve entre caracteres y chips, aparta el texto y libera el espacio anterior. Al soltar se coloca allí el mismo nodo DOM del adjunto original; al cancelar se restaura el origen.
- Se verificó con Playwright/Chromium: multiselección, mover chips entre otros adjuntos después de que el renglón se reacomoda, movimiento horizontal progresivo del placeholder en otro renglón, texto a ambos lados tras el commit, misma identidad DOM y restauración ante cancelación.
- Tests de PR: https://github.com/Teliu-p/BandaBase/actions/runs/42072480690. Tests de main: https://github.com/Teliu-p/BandaBase/actions/runs/42072659164. GitHub Pages build/deploy: https://github.com/Teliu-p/BandaBase/actions/runs/42072657702.
- No se hicieron cambios en Supabase (esquema, migraciones, RLS, Storage o datos).


## Resultado final — arrastre directo de cualquier archivo en Materiales (2026-11-05)

- PR #144: https://github.com/Teliu-p/BandaBase/pull/144. Integrada mediante squash como `858271ba90576ba3211305c17f06ec7285eeb29d`.
- Todos los chips de archivo se mueven con botón izquierdo. El objeto acompaña al puntero y el sombreado inline enseña el lugar que ocupará, reacomodando el texto mientras se arrastra. Al soltar dentro del editor se conserva el mismo nodo DOM; cancelar o soltar fuera restaura el origen.
- La regresión Chromium arrastra un PDF no-audio, verifica seguimiento del puntero, movimiento de la posición sombreada, texto a ambos lados y conservación de la identidad DOM. Se mantienen las pruebas de audio, orden y cancelación.
- Tests de la PR [#42085812268](https://github.com/Teliu-p/BandaBase/actions/runs/42085812268), Tests de main [#42085984629](https://github.com/Teliu-p/BandaBase/actions/runs/42085984629) y GitHub Pages [#42085984089](https://github.com/Teliu-p/BandaBase/actions/runs/42085984089) finalizaron correctamente en el commit integrado.
- No hubo cambios en Supabase, esquema, migraciones, RLS, Storage, datos ni servidor Python.


## Seguimiento urgente — posición del drop exactamente bajo el cursor (2026-11-05)

- El usuario detectó que la primera implementación genérica (#144) aún podía insertar el audio al comienzo del renglón, aunque se soltara sobre un punto horizontal posterior. No debe requerir espacios manuales después de soltar.
- La corrección en preparación hace hit-testing con las coordenadas finales del puntero usando primero el caret nativo del navegador (`caretPositionFromPoint` / `caretRangeFromPoint`), conserva la búsqueda geométrica como fallback y recalcula el destino al recibir `pointerup`.
- Pruebas nuevas deben comprobar la coordenada horizontal exacta: borde izquierdo del sombreado dentro de 2 px del caret bajo el mouse, tanto para audio como para archivo no-audio, y verificar el texto antes/después luego del commit. No considerar suficientes los tests anteriores de movimiento entre renglones.


## Resultado final — drop en el punto exacto del cursor (PR #145, 2026-11-05)

- La corrección para el error de inserción al comienzo del renglón está integrada en main mediante PR #145, commit `7a736fde56c84d2c945e6d0bfac24a87312d1ddd`.
- El hit-testing consulta primero el caret nativo del navegador bajo las coordenadas del puntero; la aproximación por geometría solo queda como alternativa. También se vuelve a calcular en `pointerup`.
- Tests PR [#42088181209](https://github.com/Teliu-p/BandaBase/actions/runs/42088181209), Tests main [#42088380247](https://github.com/Teliu-p/BandaBase/actions/runs/42088380247), Pages [#42088379801](https://github.com/Teliu-p/BandaBase/actions/runs/42088379801) pasaron. La cobertura exige un máximo de 2 px de diferencia entre caret y placeholder tanto para PDF como para audio y comprueba el texto tras el commit.
- La publicación Pages del SHA funcional fue verificada. Falta la validación manual final del usuario.


## Auditoría integral vigente (2026-11-05)

- Informe completo: [docs/technical-audit-2026-11-05.md](docs/technical-audit-2026-11-05.md). Leerlo antes de iniciar una refactorización amplia o nuevas migraciones.
- Último HEAD funcional inspeccionado: `2d0af16f527fc29d4b840ff9a2f2d884b8af55fb`. PR #147 está fusionada; Tests y Pages pasaron. La confirmación manual del arrastre de adjuntos sigue pendiente. PR #148 es diagnóstico y no está integrada.
- Supabase consultado en solo lectura: PostgreSQL 17.11, ACTIVE_HEALTHY. 28 tablas públicas con RLS habilitada; Realtime incluye 20 tablas públicas; bucket `materials` privado, límite 50 MiB. Asesores: dos funciones SECURITY DEFINER expuestas a authenticated (`get_proposal_vote_stats`, `is_band_member`), protección de contraseñas filtradas desactivada, 33 índices sin uso observado y 11 grupos de políticas permisivas múltiples. Ver informe para interpretación y cautelas.
- Migraciones: comparación exacta de origin/main (60 archivos) y Supabase (60 registros) completada el 2026-11-06. Las doce versiones se añadieron al tracking mediante migration repair --status applied --remote, sin ejecutar sus SQL. Cero faltantes en ambos sentidos, cero duplicados. La coincidencia del tracking no prueba por sí sola la secuencia histórica exacta de cada sentencia; no re-ejecutar SQL antiguo ni usar db push a ciegas.
- No se cambiaron datos, esquema, permisos ni código funcional durante la auditoría. Se agregaron únicamente documentos de auditoría/contexto; no se modificó código funcional.

## Actualización de contexto (2026-11-06): historial remoto alineado y protección UPDATE de Listas en revisión

- Reconciliación del tracking: origin/main en cc48a6bb172741878f000154066adec4fb3e1d94 tiene 60 archivos SQL y supabase_migrations.schema_migrations tiene las mismas 60 versiones. Las 12 versiones previamente ausentes se registraron con supabase migration repair --status applied --remote, sin ejecutar sus SQL. Comparación exacta: cero versiones faltantes en cualquiera de los lados y cero duplicados.
- Se verificaron de nuevo 28 tablas públicas con RLS, 74 políticas, 0 índices inválidos, 0 restricciones sin validar y los conteos de 18 tablas con datos, que suman 2.561 filas y coinciden con la restauración local. No se alteraron deliberadamente esquema ni datos de producción durante la reparación del historial.
- Límite importante: reparar el historial sincroniza metadatos; no demuestra por sí solo que cada sentencia histórica se ejecutara en el orden exacto. No volver a aplicar los 12 SQL ni ejecutar supabase db push a ciegas.
- PR #149, rama fix/band-list-self-service-guard-20261106, propone proteger la autoedición de band_list_items sin cambiar la política UPDATE ya consolidada en 20261020232312. La migración 20261106210000_harden_band_list_item_self_service_guard.sql usa pg_trigger_depth() para aceptar solo la actualización anidada de auto-confirmación; no reemplaza la función de auto-confirmación ni usa un marcador de sesión.
- La versión actual de PR #149 usa pg_trigger_depth() para preservar la auto-confirmación anidada y rechaza explícitamente status=NULL para responsables, porque producción permite NULL en band_list_items.status. CI del commit de código `1d38cac5d179fdb98ab97f21a9beb3c264b88401` pasó en run #42328986494: job `database-policy` (PostgreSQL 17 descartable) y job `test` (npm test, ESLint/no-undef y 18 smoke tests Chromium). La validación `tests/db/band_list_item_self_service_restore_validation.sql` también pasó en la restauración completa local y terminó con ROLLBACK. Además, el usuario completó la prueba E2E manual con dos sesiones Auth independientes: `saumerio40` como owner y `lopenzio50` como member; ambas iniciaron sesión y las operaciones de autoedición, confirmación y protección de participaciones ajenas se comportaron según lo esperado. Estado a 2026-11-06, antes del merge: PR #149 estaba lista para revisión. El estado vigente posterior se registra al final de este archivo.
- PR #98 es una propuesta antigua contra una base anterior de main; no fusionar su migración candidata tal cual. La investigación y el estado de PR #149 están desarrollados en docs/current-state.md y docs/decisions-and-incidents.md.


## Estado vigente confirmado (2026-11-07)

- HEAD de `main`: `5d003055e5067cb3bfdb53c8c54bcdd9b073eaf9`. PR #149 (guard de permisos de Listas), #150 (posición exacta al soltar adjuntos) y #151 (reintentos/aislamiento Realtime) están fusionadas.
- En ese HEAD, GitHub Actions confirmó Tests [#42417389301](https://github.com/Teliu-p/BandaBase/actions/runs/42417389301) y GitHub Pages [#42417389142](https://github.com/Teliu-p/BandaBase/actions/runs/42417389142) exitosos.
- Migración #149: `20261106210000_harden_band_list_item_self_service_guard.sql`. Producción contiene la función `private.prevent_manager_list_item_edit()` esperada y el trigger `manager_list_item_edit_guard` habilitado. `band_list_items` conserva una sola política UPDATE, `band_list_items_update_control`; no se cambió la política ni el esquema de columnas.
- La aplicación SQL ya se había realizado y verificado antes de corregir el tracking. El CLI había registrado por error `20261107214735`; se corrigió el historial remoto marcando esa versión como reverted y `20261106210000` como applied. La consulta final mostró coincidencia local/remota. No se volvió a ejecutar el SQL, no se revirtió el esquema y no se usó `db push`.
- Supabase está `ACTIVE_HEALTHY`, PostgreSQL 17.11. Inspección de solo lectura: 28 tablas públicas con RLS, 74 políticas, 20 tablas en `supabase_realtime`, 62 versiones distintas en `schema_migrations`, sin duplicados; bucket `materials` privado con límite 50 MiB.
- La validación automatizada de PR #149 pasó en CI #42328986494 (PostgreSQL 17 descartable y job general). La prueba contra la restauración completa local terminó con `ROLLBACK`; el usuario había confirmado las pruebas de permisos en dos sesiones Auth de la copia local. No equivale a una prueba funcional autenticada sobre las filas actuales de producción.
- Límite actual de prueba de producción: las tres listas existentes están en papelera, no hay listas activas ni responsables asignados; hay tres filas de participación, todas confirmadas. No reactivar listas ni insertar datos de prueba en producción para forzar la validación. Retomar una comprobación UI real cuando exista una lista activa y un responsable configurado para la prueba.
- Asesores vigentes: permanecen los avisos de `SECURITY DEFINER` para `get_proposal_vote_stats` e `is_band_member`. La segunda función aparece en 52 políticas RLS y la primera se invoca desde `src/proposals-data.js` para obtener conteos agregados; ambas filtran por pertenencia activa, `anon` no tiene EXECUTE y los roles de cliente no pueden crear objetos en `public`. No revocar ni cambiar `search_path` sin pruebas. La protección de contraseñas filtradas sigue desactivada. Rendimiento: 33 índices sin uso observado y 10 grupos de políticas permisivas múltiples; la política SELECT redundante de Canciones ya fue retirada después de comparar la visibilidad antes/después con RLS. Los otros grupos separan operaciones de edición, papelera/restauración o acceso de miembros/creadores/administradores. No borrar índices ni consolidar políticas a ciegas.
- PR #98 continúa abierta como borrador histórico y está desactualizada: su SQL no debe fusionarse, porque la política UPDATE duplicada que intentaba corregir ya fue consolidada por `20261020232312`. PR #148 sigue abierta y solo contiene diagnóstico del caret; su necesidad quedó superada por la corrección #150, pero no se cerró automáticamente.


## Actualización 2026-11-07 — limpieza RLS de Canciones aplicada (PR #153)

- PR #153 se fusionó en `main` como `73da35c32f1cfab99381e8a4d8d4347bb3b3d510`. La regresión PostgreSQL y el job general pasaron en CI [#42424616317](https://github.com/Teliu-p/BandaBase/actions/runs/42424616317).
- Supabase aplicó `DROP POLICY IF EXISTS songs_select_active_or_admin ON public.songs`. La consulta posterior confirmó que la única política SELECT restante es `songs_select_active_or_own_trash_or_admin`; no se cambió su expresión. La visibilidad efectiva de admin, miembros con papelera propia/ajena, otra banda e integrante inactivo se comparó antes/después en PostgreSQL 17 y quedó idéntica.
- Supabase asignó automáticamente la versión `20261107231924`; el archivo en main se renombró para usar ese prefijo: `supabase/migrations/20261107231924_remove_redundant_songs_select_policy.sql`. La entrada de tracking y el archivo deben coincidir; no se necesitó `migration repair` ni se alteró manualmente `schema_migrations`.
- El asesor de rendimiento redujo `multiple_permissive_policies` de 11 a 10; los 33 índices sin uso observado no cambiaron. El asesor de salud devolvió cero hallazgos. No se modificaron otras políticas, funciones, datos ni grants.
