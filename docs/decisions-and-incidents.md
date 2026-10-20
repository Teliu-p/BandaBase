# Decisiones, incidentes y disciplina de cambios

Este log registra reglas del proyecto y experiencias que deben guiar el trabajo futuro. La información heredada de conversaciones se marca como antecedente; el estado vigente se confirma en current-state.md y en las fuentes actuales.

## Decisiones vigentes

### Scripts clásicos y modularización gradual

BandaBase se ha dividido de un index.html históricamente grande en archivos de src, pero los archivos siguen cargándose como scripts clásicos y comparten globals. Conservar este modelo en cambios puntuales. Si se desea pasar a import/export, plantear una refactorización separada con baseline, estrategia de rollback, pruebas y despliegue verificable.

### Cambios mínimos y revisión de estado

Preferencia explícita del usuario: leer el estado existente, explicar causa raíz, modificar lo mínimo, evitar cambios no relacionados, ejecutar regresiones y verificar commit/CI/deploy. Ante cambios arquitectónicos, mantener una referencia de cómo estaba antes y una reversión clara.

### Supabase sin migraciones a ciegas

No tratar los archivos SQL como prueba suficiente del esquema real ni el esquema real como prueba de cuáles comandos se ejecutaron históricamente. Las discrepancias deben clasificarse por objeto, dependencia y efecto en datos. No crear una rama de Supabase con coste sin autorización explícita.

### Permisos del lado servidor

RLS, funciones y triggers hacen cumplir las reglas del negocio. Ocultar botones no es seguridad. Revisar todas las políticas permissive para la misma tabla/acción porque se combinan de forma permisiva; aun así, no borrar políticas sin confirmar la intención de cada una.

### El repertorio deriva de Listas activas

Decisión de producto: songs.in_repertoire debe corresponder a pertenecer al menos a una Lista activa. Hay una migración registrada que instala triggers de sincronización. No introducir actualizaciones independientes que creen estados divergentes.

### El contexto debe evolucionar junto al código

Los documentos AI_CONTEXT.md, architecture-map.md, product-spec.md, current-state.md y este log deben actualizarse en la misma PR que cambie comportamiento, arquitectura, permisos o estado operativo. Para una funcionalidad nueva, escribir también qué prueba demuestra que funciona.

## Incidentes históricos y regresiones a vigilar

Estos son reportes históricos de iteraciones previas. No significan necesariamente que el error siga presente hoy:

- canManageComment is not defined al intentar comentar desde Canciones.
- toggleSongrepertoire is not defined al manipular repertorio.
- load.songs is not defined y populateColorfilter is not defined, relacionados con funciones globales y refactors.
- handleAuthSession is not defined y un flujo de login que parecía no hacer nada, relacionados con orden/alcance de scripts.
- Recursión infinita de RLS en band_members.
- permission denied para is_valid_band_list_instrument_slots.
- Violación RLS al insertar canciones.
- Fallos guardando materiales con adjuntos, pérdida/desaparición de audio o controles de reproducción que desaparecían.
- Error SQL: WITH ORDINALITY cannot be used with a column definition list; se añadieron migraciones posteriores de corrección de ordinalidad/recordset.
- Avisos de actualización repetidos en móvil aun después de actualizar.

Regla: no revivir automáticamente estos problemas; comprobar el código y reproducir el error antes de editar. Después de editar, agregar una prueba que hubiera detectado el caso original cuando sea viable.

## Registro operativo de hechos recientes

### 2026-10-12 — informe de reconciliación de migraciones

- PR #102 fue fusionada en main en 0d4cad4846d0f00ffa8ffe7fc645046a138d05e3.
- El informe detalla doce archivos SQL presentes localmente pero sin fila de igual versión en el historial remoto; los objetos/efectos actuales y las dependencias posteriores impiden clasificarlos como archivos desechables en bloque.
- La migración 20261007190000 normaliza estados de participación; 20261007200000 convierte genre a array. Evitar reejecutar ambas a ciegas.
- El grupo antiguo de doce migraciones que estaba en remoto pero faltaba en GitHub se recuperó anteriormente; no confundir las dos discrepancias.
- Evidencia: docs/database-migration-history-reconciliation-followup.md.

### 2026-10-11 — PR #98 de integridad de lista

- PR #98 quedó abierta como draft, no fusionada.
- En producción siguen apareciendo band_list_items_update_control y band_list_items_update_control_v2 como políticas UPDATE permissive.
- La PR intenta cerrar el hueco de integridad y limitar edición de instrumentos de participantes. Antes de actuar, leer el diff/estado actual de la PR y volver a inspeccionar políticas y trigger remotos.

### 2026-10-14 — primera línea de base de handoff

- Se documentaron los mapas de arquitectura, especificación de producto, estado actual y decisiones/incidentes.
- Main inspeccionado: 0d4cad4846d0f00ffa8ffe7fc645046a138d05e3. Tests y Pages build/deploy pasaron para ese SHA.
- La base inspeccionada tenía 44 migraciones registradas y 56 archivos SQL locales; doce versiones son local-only y ninguna remote-only.
- Esta anotación solo se debe conservar como fotografía; después de fusionar esta documentación, la nueva SHA será distinta y debe actualizarse el estado de referencia.

### 2026-10-14 — contexto persistente integrado en main

- PR #103: https://github.com/Teliu-p/BandaBase/pull/103 fue fusionada como commit d1bb3f58a3f1bb95ed16c668a5a44476cf10d3ad.
- Añade AGENTS.md y AI_CONTEXT.md como puntos de entrada, más mapas de arquitectura, requisitos, estado actual y decisiones/incidentes.
- Tests y Pages build/deployment pasaron en el commit de merge: https://github.com/Teliu-p/BandaBase/actions/runs/38668782713 y https://github.com/Teliu-p/BandaBase/actions/runs/38668781565.
- La aplicación no cambió funcionalmente; el código descrito se inspeccionó en el padre de la documentación, 0d4cad4846d0f00ffa8ffe7fc645046a138d05e3.

### 2026-10-15 — guardado de Materiales con adjuntos de audio

- Síntoma reportado: al editar un Material e insertar audios, el botón Guardar podía dejar el formulario abierto sin indicar qué ocurría.
- La inspección estática detectó un retorno silencioso si faltaba currentBand/currentSong/currentUser, ausencia de progreso visible y falta de captura general/compensación para promesas rechazadas en operaciones async. Los logs consultados no mostraron una subida fallida correlacionable, por lo que no se atribuyó el fallo a RLS ni al bucket sin evidencia.
- PR #105: https://github.com/Teliu-p/BandaBase/pull/105; corrección y regresiones para excepciones de subida y contexto ausente. CI verde: https://github.com/Teliu-p/BandaBase/actions/runs/38807174499 (pruebas de regresión, ESLint y smoke tests Playwright/Chromium).
- El guardado muestra estados de progreso y bloquea envíos duplicados. Si una operación rechaza antes de iniciar el RPC de bloques, intenta compensar registros/objetos parciales y deja visible el error; si los bloques ya están guardados, no borra ese contenido por un fallo posterior de refresco. Si el RPC de bloques lanzó una excepción y no se sabe si el servidor confirmó la transacción, conserva los adjuntos en lugar de borrarlos a ciegas y pide verificar después de recargar.
- No hubo cambios SQL ni escrituras a producción. La sesión exacta reportada no se reprodujo; tras la integración, confirmar el despliegue y pedir una comprobación real de guardar un audio.

### 2026-10-19 — herramientas musicales del editor

- Requisitos expresados por el usuario: figuras musicales en Materiales, sangría persistente, atajos numéricos, chips de adjunto inline a la altura del renglón, más volumen del metrónomo, marcadores de estructura y metrónomo sincronizado con el audio.
- El serializador/sanitizador de Materiales es el contrato para cualquier formato persistente. Las figuras se insertan como caracteres Unicode. La implementación inicial de sangría mediante `blockquote.material-indent` resultó demasiado grande para la intención del usuario y se corrige con espacios reales de a uno y repetición acelerada al mantener presionado.
- Los atajos requieren Alt+número para no interferir con dígitos normales. La amplificación del metrónomo tendrá un control acotado y probado. Marcadores y sincronización son hitos separados.
- No enrutar audio almacenado a Web Audio sin verificar CORS y un fallback funcional: una conexión cross-origin no permitida puede hacer que la reproducción se silencie.
- Primera tanda en PR #107: https://github.com/Teliu-p/BandaBase/pull/107. CI pasó regresiones, ESLint/no-undef y smoke tests de Chromium en https://github.com/Teliu-p/BandaBase/actions/runs/39212456802. Los marcadores persistentes y la sincronización con audio quedan como requisitos pendientes de implementar y verificar.

### 2026-10-19 — corregir sangría y representación inline de audio

- El usuario aclaró que la sangría debe agregar/quitar un espacio real a la vez, también para cada línea seleccionada, y repetir más rápido si se mantiene el botón. No aplicar bloques de margen/blockquote.
- El audio debe permanecer alineado en línea igual que en el compositor. Guardarlo no debe convertirlo en una tarjeta grande debajo del texto. Mostrar nombre + play/pause y, al tocar el nombre, un panel flotante con tiempo/seek que no altere la maquetación.
- PR #108: https://github.com/Teliu-p/BandaBase/pull/108 fue fusionada en `a553d7ecb3b9621fd85dc7a74e9c3fd7b2c721a9`. Tests pasó: https://github.com/Teliu-p/BandaBase/actions/runs/39217970149. El despliegue de GitHub Pages pasó: https://github.com/Teliu-p/BandaBase/actions/runs/39217971029.
- No cambió el volumen del audio ni se hicieron cambios a base de datos, Storage, permisos o datos.
- Pendiente de verificación manual: probar guardar y reabrir un material real con audio; la CI cubre regresiones y smoke tests con stubs, no esa sesión autenticada específica.

### 2026-10-19 — marcadores temporales de audio en Materiales (PR #110 fusionada)

- Requisito acordado: el usuario escribe el texto de la sección («Coro») y, en el lugar del cursor, inserta un chip cuyo único texto visible es el tiempo, por ejemplo «0:30». El nombre de la sección queda escrito por el usuario como texto normal. El chip es parte del rich text persistido, no un objeto nuevo de base de datos.
- Al pulsar el chip, todos los adjuntos de audio de todos los Materiales de esa canción se posicionan en el instante indicado, también si la tarjeta está plegada. Un audio que ya sonaba continúa desde ese punto, pero las pistas pausadas no arrancan automáticamente; un Material abierto después hereda el último marcador elegido. Cambiar de canción limpia el estado temporal y libera motores auxiliares.
- El serializador/sanitizador solo acepta marcadores con segundos enteros en el intervalo permitido y genera HTML canónico; el contenido no se toma como HTML confiable. URL firmada y metadatos se cargan bajo demanda por el clic de marcador. No se modifica el volumen ni se cambia Supabase (esquema, RLS, Storage o datos).
- Implementación en PR #110: https://github.com/Teliu-p/BandaBase/pull/110. Merge `cd9cff753c2da3eb559f11b9d4a5071f979e81b6`; Tests y Pages pasaron en https://github.com/Teliu-p/BandaBase/actions/runs/39327396377 y https://github.com/Teliu-p/BandaBase/actions/runs/39327398433. Queda pendiente la comprobación manual autenticada de guardar, reabrir y saltar por marcadores.

### 2026-10-19 — captura del tiempo de reproducción al insertar marcadores (seguimiento en rama)

- La primera versión de la herramienta ⏱ pedía ingresar el tiempo siempre. El seguimiento intenta capturar el tiempo entero actual del reproductor con foco o del único audio que esté reproduciéndose, de modo que se pueda escribir «Coro» en el texto y colocar el chip temporal en el cursor sin duplicar etiquetas.
- Si no hay un reproductor identificable de forma inequívoca, se mantiene el ingreso manual del tiempo; los marcadores siguen mostrando solo el valor temporal. Se añaden pruebas de conversión de tiempos fraccionarios y límites (0–24 h), además de comprobaciones de integración del editor.
- Rama: `feat/material-audio-marker-playhead-20261019`, PR #111: https://github.com/Teliu-p/BandaBase/pull/111, fusionada como `2497e01ab23169936b49d7141672db7dab4e9904`. Tests y Pages pasaron: https://github.com/Teliu-p/BandaBase/actions/runs/39332251159 y https://github.com/Teliu-p/BandaBase/actions/runs/39332250632. Pendiente prueba manual autenticada de audio real. Sin cambios a Supabase, Storage, datos, RLS o migraciones.

### 2026-10-19 — sincronización opcional del metrónomo con Materiales (PR #112 fusionada)

- La revisión confirmó que el retraso inicial proviene de programar el primer clic a `AudioContext.currentTime + 0.05`; el horizonte de 120 ms se usa para preparar clics posteriores y evitar jitter. El seguimiento reduce solo el adelanto inicial a 10 ms.
- La sincronización no usa análisis de forma de onda ni detección automática de tempo. Reutiliza el BPM/métrica de la canción y el `currentTime` del audio de referencia; sigue reproducción, pausa, búsqueda, saltos de marcador y velocidad de reproducción. La opción es desactivable y el modo independiente se conserva.
- Solo se sincroniza con un audio de referencia a la vez para evitar una fase ambigua. Los clics futuros se cancelan al pausar o buscar para no producir golpes desfasados.
- PR #112: https://github.com/Teliu-p/BandaBase/pull/112, fusionada como `611043389f58a962152f16cabdedd5c18b165865`. Tests y Pages pasaron en https://github.com/Teliu-p/BandaBase/actions/runs/39350807878 y https://github.com/Teliu-p/BandaBase/actions/runs/39350808799. Falta prueba manual de reproducción real, especialmente con grabaciones que incluyen silencio inicial. No se cambian Supabase, Storage, datos, RLS ni migraciones.

### 2026-10-19 — calibración manual de fase del metrónomo (PR #113 fusionada)

- La sincronización inicial asumía que el pulso cero de la canción coincidía con el segundo cero del archivo. El usuario propuso alinearlo manualmente una vez y reutilizar la fase.
- La PR #113 (`feat/metronome-manual-phase-calibration-20261019`) fue fusionada como `3c6588dc282c3337f7dba2a78e38a19511a59b9a`: https://github.com/Teliu-p/BandaBase/pull/113. Añade un control para guardar el ajuste mientras un único audio y el metrónomo independiente están en marcha y alineados de oído. Calcula el origen temporal relativo sin análisis de audio y persiste el resultado en localStorage por ID de canción y adjunto.
- El ajuste se usa al activar «Sincronizar con audio» y no se usa si el BPM o la métrica no coinciden con los guardados. El modo independiente y la referencia por segundo cero siguen disponibles si no hay ajuste compatible.
- Tests y Pages pasaron: https://github.com/Teliu-p/BandaBase/actions/runs/39358153888 y https://github.com/Teliu-p/BandaBase/actions/runs/39358153266. Falta prueba manual audible. No se modifica Supabase, Storage, datos, RLS ni migraciones.

### 2026-10-20 — velocidad de reproducción y descarga de adjuntos (PR #114)

- Se inspeccionó la reproducción de Materiales y se confirmó que usa un elemento `<audio>` nativo con URLs firmadas perezosas; la app actualiza la interfaz con eventos de medios, pero no ejecuta un reloj propio para mover la señal de audio. No se encontró un mecanismo que, por sí mismo, acumule retraso en la reproducción. Esto no determina si una grabación tiene tempo variable ni sustituye una prueba audible real.
- La sincronización del metrónomo toma `audio.currentTime` como posición de referencia y distribuye clics con el BPM conocido; no analiza la forma de onda para encontrar cada golpe. Una diferencia creciente puede corresponder al tempo/grid de la grabación, aunque queda pendiente validar con audio real.
- PR #114 fue fusionada como `ddaf9a073b5fbf5def723e4bbab02781ba439800`: https://github.com/Teliu-p/BandaBase/pull/114. Restaura velocidades de audio 25–200% con valores personalizados y conservación de afinación solicitada mediante `preservesPitch`, añade descargas de archivos adjuntos en Materiales, comentarios y Propuestas, y corrige la calibración cuando el audio corre a una velocidad distinta de 1×.
- CI de PR pasó `npm test`, ESLint/no-undef y los smoke tests de Chromium en https://github.com/Teliu-p/BandaBase/actions/runs/39364274394. Sigue pendiente una prueba manual autenticada de descarga y una prueba audible de sincronización durante varios minutos. No se modificó esquema, datos, políticas, RLS, migraciones ni los objetos de Storage de Supabase. Confirmar los workflows de main tras el merge.

### 2026-10-20 — figuras musicales, silencios y puntillo (rama de trabajo)

- La barra de Materiales pasa a incluir cinco figuras (semicorchea, corchea, negra, blanca y redonda), los cinco silencios equivalentes y un botón de puntillo.
- El puntillo queda activado de forma visual y accesible hasta insertar la próxima figura o silencio; tras la inserción se desactiva. Los símbolos se guardan como caracteres musicales Unicode en el bloque de rich text ya existente.
- Se conservan los IDs y atajos Alt+7/8/9 de negra, corchea y semicorchea. No se modifica Supabase, esquema, datos, políticas, RLS, Storage ni migraciones. Confirmar CI y estado de la PR antes de afirmar que está publicado.

## Formato recomendado para agregar incidentes

Registrar fecha, síntoma visible, causa raíz confirmada (o marcarla como hipótesis), archivos/funciones/policies implicados, fix/commit/PR, pruebas ejecutadas y limitaciones no cubiertas. Registrar también si se modificaron datos o esquema remoto; nunca insinuar que una comprobación estática equivale a una prueba real.