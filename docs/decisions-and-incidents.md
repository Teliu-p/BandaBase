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

### 2026-11-05 — selección múltiple y reordenamiento de audio en Materiales

- Requisito: adjuntar más de un archivo por selección y poder mover un audio inline manteniendo pulsado y arrastrando, sin crear una referencia duplicada.
- La primera prueba solo usaba el drag-and-drop HTML5; no simulaba el gesto de puntero habitual del usuario. Se sustituye por Pointer Events: prevenir selección nativa, mover el mismo nodo y comprobar identidad de nodo + orden serializado en Chromium.
- La versión de main observada al reproducir el reporte era `7b48607925b638a5cf2f061bbf09bb71d4563cc8`; no contenía `multiple` ni el código nuevo porque PR #141 seguía abierta. No confundir pruebas de rama con despliegue en Pages.

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

### 2026-10-20 — figuras musicales, silencios y puntillo (PR #115 fusionada)

PR: https://github.com/Teliu-p/BandaBase/pull/115.

- La barra de Materiales pasa a incluir cinco figuras (semicorchea, corchea, negra, blanca y redonda), los cinco silencios equivalentes y un botón de puntillo.
- El puntillo queda activado de forma visual y accesible hasta insertar la próxima figura o silencio; tras la inserción se desactiva. Los símbolos se guardan como caracteres musicales Unicode en el bloque de rich text ya existente.
- Se conservan los IDs y atajos Alt+7/8/9 de negra, corchea y semicorchea. PR #115 fue fusionada como `b96bd579234c86f99d89c693bba9727fa21761c2`; Tests y Pages de main pasaron ([Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39386371929), [Pages](https://github.com/Teliu-p/BandaBase/actions/runs/39386371276)). No se modificó Supabase, esquema, datos, políticas, RLS, Storage ni migraciones. Queda por comprobar visualmente el renderizado real de los símbolos musicales.

### 2026-10-20 — agrupación visual de corcheas/semicorcheas y atajos (PR #117 fusionada)

- El cambio previo sustituyó los caracteres familiares por glifos Unicode de figura individual; además, el compositor inserta espacios de separación alrededor de cada figura, por lo que dos corcheas o semicorcheas dejaron de verse agrupadas. Se corrige al componer en el texto una pareja visual con `♫` (dos corcheas) o `♬` (dos semicorcheas), solo cuando son consecutivas y sin puntillo. No se agrupan negras, blancas, redondas ni silencios.
- Los botones de figuras de la barra aumentan de tamaño; el tamaño de las figuras en el propio renglón permanece igual.
- PR #117: https://github.com/Teliu-p/BandaBase/pull/117, fusionada como `5ab8c9960967a8ada41575ad5a2298a3db2a71da`. Tests y Pages de main pasaron ([Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39394884228), [Pages](https://github.com/Teliu-p/BandaBase/actions/runs/39394883455)). Renueva los atajos según la especificación y asigna Alt+0 al reinicio de formato/puntillo. La comprobación visual real de glifos queda pendiente. No se cambia Supabase, datos, políticas, RLS, Storage ni migraciones.

### 2026-10-20 — iconos musicales vectoriales para equipos sin fuente compatible (PR #119 fusionada)

- El reporte de figuras como rectángulos vacíos en una segunda computadora apunta a falta de cobertura de fuente para los caracteres musicales extendidos, no necesariamente a un problema del navegador. Referencia: Unicode explica que los rectángulos de sustitución aparecen cuando ninguna fuente disponible incluye el glifo: https://www.unicode.org/help/display_problems.html.
- La PR #119 (https://github.com/Teliu-p/BandaBase/pull/119) fue fusionada como `b4df67ce393a6d199fa1fa436c67b95dcf59ab78`. La visualización usa SVG generado a partir de claves permitidas. La serialización conserva la clave semántica y vuelve a generar el icono; la sanitización no admite SVG arbitrario. El texto viejo con caracteres Unicode se convierte al dibujar/editar.
- Los iconos de la línea miden 1,35 em para un interlineado de 1,6 em (≈85%); no se revierte el tamaño de los botones. No se modifican Supabase, Storage, datos, RLS ni migraciones.
- La CI de la PR pasó regresiones, ESLint y smoke tests. Los workflows de Tests y Pages de main están verificándose para el merge. Falta comprobar visualmente la computadora afectada; no se modifican Supabase, Storage, datos, RLS ni migraciones.

### 2026-10-20 — ajustar las figuras musicales al alto de una mayúscula (PR #121)

- El usuario precisó que las figuras no deben superar el alto de una mayúscula y deben tener un tamaño visual equivalente. Seguimiento en PR #121: https://github.com/Teliu-p/BandaBase/pull/121.
- El CSS cambia la caja inline de `1.35em` a `0.72em`, quita el desplazamiento vertical anterior y alinea con la línea base; las parejas usan `0.86em` de ancho y el mismo alto. No se modifican los botones de la barra.
- La primera calibración (`0.72em`, en PR #121) midió la caja, no la tinta dibujada; el `viewBox` deja margen interno. La revisión posterior encontró que el trazo quedaba más chico que una mayúscula, por lo que PR #122 corrige la caja/posición. La CI y la inspección visual de esa revisión quedan pendientes. No se modifican Supabase, datos, Storage, políticas, RLS ni migraciones.

### 2026-10-20 — calibración de la altura visual del SVG musical (PR #122)

- Al revisar las coordenadas del `viewBox` se comprobó que las notas con plica ocupan aproximadamente el 78% de la caja SVG. Para que la tinta visible se aproxime a la altura de una mayúscula, el seguimiento usa una caja de `0.96em` con `vertical-align: -0.145em` para las figuras con plica; la blanca ajusta su caja a `0.9em`/`-0.096em` por el contorno, la redonda usa `-0.133em` y las parejas `0.925em` × `0.82em`/`-0.106em`. Los trazos principales suben a `2.8` unidades SVG para acercarse al grosor de las letras.
- Las regresiones comprueban caja, alineación y anchura de parejas. Los Tests y Pages de main para PR #121 pasaron. La CI de la revisión con las dimensiones finales de PR #122 pasó en `becfc32f847e2a7160d7e5286b7739aafb9899c4` ([Tests](https://github.com/Teliu-p/BandaBase/actions/runs/39445031361)); la actualización documental posterior vuelve a ejecutar CI. La verificación visual real sigue pendiente. No se cambian botones, contenido almacenado, Supabase, datos, Storage, políticas, RLS ni migraciones.

## Formato recomendado para agregar incidentes

Registrar fecha, síntoma visible, causa raíz confirmada (o marcarla como hipótesis), archivos/funciones/policies implicados, fix/commit/PR, pruebas ejecutadas y limitaciones no cubiertas. Registrar también si se modificaron datos o esquema remoto; nunca insinuar que una comprobación estática equivale a una prueba real.

### 2026-11-03 — integrar la biblioteca local de audio sin romper Storage

- Se verificó en la computadora anfitriona que el servidor local devuelve /health, genera un ticket autorizado con la sesión real y entrega el FLAC con soporte de rangos; el navegador pudo reproducirlo audiblemente en un reproductor temporal.
- Decisión de integración: mantener `storage_path` y los registros existentes sin cambios. Un nuevo resolutor cliente pide al servidor local un ticket por UUID/tabla solo para audio; el servidor consulta Supabase con el JWT y RLS antes de entregar el archivo indicado por el manifiesto.
- Compatibilidad: HTTP 409 (no copiado) y servidor local inaccesible usan el flujo anterior de URLs firmadas de Storage. Un 403 u otro error HTTP explícito no se oculta con un fallback. Adjuntos no-audio siguen en Storage.
- PR #136 se fusionó en `main` como `e96712ee41de5599e36a58b1d1dd72d2919946bd`. CI de la rama pasó en `f6440040196e25553a5eb4ed73b6e11b300e028a` ([Tests #41720921806](https://github.com/Teliu-p/BandaBase/actions/runs/41720921806)); Tests de main (#41721358288) y Pages (#41721358287) también pasaron. Sigue pendiente la verificación autenticada de los controles reales en la web desplegada.
- Límite abierto: el endpoint por defecto usa loopback y por tanto solo sirve en la misma computadora. Para que otras PCs accedan al equipo anfitrión se requiere configurar la URL HTTPS de Tailscale Funnel y validarla desde un segundo dispositivo. Funnel todavía no está activado.
- No se modificó Supabase: sin cambios en datos, esquema, políticas, RLS, Storage, migraciones o `storage_path`.

## 2026-11-03 — Publicación del servidor de audio mediante Funnel

- Se activó Tailscale Funnel en el host `laptop-2pepu3jl`, exponiendo HTTPS y reenviando al listener existente `127.0.0.1:8788`. El comando queda en primer plano: el proceso debe permanecer abierto junto con el servidor Python; no se configuró un servicio persistente.
- `/health` respondió correctamente por HTTPS. El preflight OPTIONS con origen GitHub Pages devolvió 204 y admitió POST, Authorization y Content-Type.
- El POST de prueba sin Authorization devolvió 403 tanto al endpoint loopback como al hostname HTTPS, con el mismo mensaje de sesión faltante. Se interpreta como rechazo intencional del servidor local; no se cambió a 401 ni se relajó la autorización.
- Decisión de cliente: guardar el hostname de Funnel en `src/audio-server-config.js`, separado del resolutor, y cargarlo antes de `attachment-access.js`. El endpoint solo entrega URLs de ticket tras validar el JWT y consultar la fila con RLS. Si el Funnel o el servidor no están disponibles, se mantiene el fallback previo a Storage. PR #137 se fusionó como `678c218ac591f25d022d760280249158cfddefd8`; Tests [#41723820635](https://github.com/Teliu-p/BandaBase/actions/runs/41723820635) y Pages [#41723820206](https://github.com/Teliu-p/BandaBase/actions/runs/41723820206) pasaron.
- El usuario confirmó que Materiales reproduce normalmente en el reproductor habitual de la PC anfitriona. La prueba de otra PC aún está pendiente. No se modificó Supabase ni el servidor Python.


## 2026-11-03 — Resultado de despliegue de la configuración Funnel

- PR #137 se fusionó en main como `678c218ac591f25d022d760280249158cfddefd8`. Los tests de main y el despliegue de GitHub Pages finalizaron correctamente: [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/41723820635), [Pages](https://github.com/Teliu-p/BandaBase/actions/runs/41723820206).
- La app ya carga el hostname Funnel antes del helper de adjuntos. La prueba manual del usuario confirmó la reproducción habitual en Materiales desde el host.
- Sigue pendiente una prueba de reproducción autenticada desde una segunda PC; eso no se considera validado por CI ni por los chequeos HTTP/CORS desde PowerShell.
- El proceso `tailscale funnel 8788` corre en primer plano, al igual que el servidor Python. No se configuró arranque automático ni persistencia tras cerrar sesión/suspender/apagar el host.

## 2026-11-04 — Robustecer el fallback cuando Funnel no alcanza al host

- Observación del usuario: desde la segunda PC, los audios dejaron de reproducirse después de que el equipo anfitrión se apagó. No se capturó el status HTTP de la solicitud fallida, así que no se atribuye definitivamente la causa a un 502.
- Inspección: el resolver ya hacía fallback ante TypeError/AbortError y HTTP 409; una respuesta 5xx de Funnel (o del servidor local) entraba en el bloque de error y detenía la solicitud antes de firmar la URL de Storage.
- Implementación integrada mediante PR #138: HTTP 500–599 se considera indisponibilidad de la ruta local y permite continuar a Supabase Storage. Se preservan los rechazos 4xx, especialmente 403, como errores visibles; no se relaja la autorización de los tickets locales.
- Pasaron las regresiones de PR, Tests de main y Pages en los workflows registrados en AI_CONTEXT/current-state. Sigue pendiente una comprobación manual desde otra PC con el host apagado. No hubo cambios en Supabase ni el servidor Python.


### 2026-11-04 — revisión estática de seguridad del servidor local

- Se revisó estáticamente la copia compartida de `bandabase_audio_server.py`: el servidor enlaza a `127.0.0.1`; solo atiende `/health`, `/api/ticket` y `/api/media/<ticket>`; rutas restantes devuelven 404. El ticket se genera después de consultar la fila usando el JWT del usuario, y la URL de medios requiere HMAC válido/expiración. Las claves de archivo se validan con patrón acotado y el destino se resuelve dentro de `LIBRARY_DIR`; no se encontró una ruta de listado ni de lectura arbitraria del sistema de archivos.
- Los registros del usuario muestran probes de `/.env`, `/.aws/credentials`, `/` y variantes con 404. Eso no aporta evidencia de acceso a esos archivos. El logger reemplaza el ticket por `[ticket]` para no escribirlo en consola.
- Limitaciones de la revisión: la copia compartida no se comparó por hash con el archivo real de Windows, no se inspeccionaron ACL NTFS, no hay rate limiting y el TTL del ticket es de 60 minutos. No se alteró el servidor local en este cambio.
- Sigue pendiente la prueba manual desde una segunda PC: reproducción con host encendido/Funnel activo y fallback a Storage con host apagado. El incidente original no capturó el status HTTP, así que 5xx sigue siendo una hipótesis explicativa, no un hecho observado.


### 2026-11-05 — Materiales: audios exclusivamente en biblioteca local

- Requisito del usuario: eliminar la dependencia de Supabase Storage para los audios de Materiales y probar desde la computadora anfitriona, sin exigir una segunda PC. Se decidió local-only para `material_attachments` audio; archivos no-audio de Materiales y adjuntos de Comentarios/Propuestas conservan Storage.
- Los nuevos audios crean la fila `material_attachments` con `storage_path = local:<clave-opaca>` y se envían a `POST /api/upload/<attachment_id>`. Playback solicita ticket local; no se hace fallback a Storage por ningún estado HTTP ni por desconexión. Se mantiene el acceso legacy a audios que ya tengan copia local en el manifiesto.
- El servidor Python añade upload/delete con JWT, consulta de fila vía RLS, verificación creador/admin para upload, escritura streaming temporal + replace atómico, claves no sobrescribibles y lock por ID para serializar upload/delete. Delete se ejecuta bajo RLS y borra archivo local. La aplicación no borra objetos históricos de Storage.
- La prueba local aislada del servidor pasó: sesión ausente 403, upload autorizado 201, emisión de ticket 200, descarga 200, Range 206, no-sobrescritura 400 y delete 200. Se usaron mocks para consultas Supabase; faltan una prueba autenticada real desde la PC anfitriona y confirmar que el .py actualizado quede instalado allí.
- Sin cambios de esquema/migraciones/RLS de Supabase. La columna `storage_path` ya era text; se consultaron las políticas reales de `material_attachments` (select por miembro; write por creador/admin) y la función `is_band_admin(uuid)` disponible para authenticated.
- Limitaciones: audios antiguos que solo estén en Storage dejan de reproducirse desde Materiales hasta copiarlos/volver a adjuntarlos localmente; los objetos cloud quedan intactos. Si la PC host no responde, no habrá reproducción de audio en Materiales. Si la limpieza local falla y se elimina el registro por RLS, puede quedar un archivo huérfano en la biblioteca. No se obliga a probar otro dispositivo.


### Resultado e integración — audio de Materiales local-only (2026-11-05)

- PR #140 fusionada en main como \`55ebb0ebc141f32c7276820617c74567d922650e\`; Tests [#41960155461](https://github.com/Teliu-p/BandaBase/actions/runs/41960155461) y Pages [#41960155134](https://github.com/Teliu-p/BandaBase/actions/runs/41960155134) pasaron.
- El servidor actualizado v0.3 se entrega al usuario como archivo. El deploy web no cambia la copia Python instalada localmente: el usuario debe detener el proceso anterior y reemplazar solo \`bandabase_audio_server.py\`, preservando biblioteca, manifiesto, secreto de tickets y backups.
- Prueba aislada final contra HTTP local con Supabase simulado pasó: upload 201; ticket 200; reproducción parcial 206; rechazo de sesión 403; rechazo de sobrescritura 400; delete 200.
- Pendiente final, solo desde el equipo anfitrión: instalar v0.3, iniciar el servidor y guardar/reproducir un audio nuevo en Materiales con la sesión normal. No se exige una segunda PC.

### 2026-11-05 — posición horizontal precisa al mover audios en Materiales

- El usuario reportó que el audio cambiaba de renglón, pero se insertaba al extremo izquierdo o junto al primer texto, sin respetar el punto horizontal elegido; tampoco podía anticipar dónde quedaría.
- La versión anterior resaltaba otro chip, pero no mostraba una posición de inserción sobre el texto y calculaba el destino al soltar con la API de caret del navegador. Eso no daba una referencia visible ni garantizaba la posición horizontal deseada.
- El seguimiento calcula el destino usando los rectángulos visuales de caracteres y chips inline; muestra una guía vertical y un sombreado del ancho aproximado del audio. Al soltar reutiliza el rango de destino que estaba previsualizando. Se conserva el mismo nodo y los espacios de separación del chip.
- La prueba de regresión arrastra un audio a mitad de un texto y comprueba que el rango queda entre dos caracteres concretos, que la guía coincide con ese punto y que el mismo nodo queda insertado allí.
- El cambio no requiere migraciones, RLS, Storage ni escrituras a Supabase.

### 2026-11-05 — vista previa sombreada inline al arrastrar audios (PR #143)

- El usuario aclaró que una guía/rectángulo flotante no sirve: necesita ver cómo se redistribuye el renglón mientras mueve el audio, como si el chip ocupara espacio real y empujara el texto a partir de su posición.
- La vista previa usa un único `span.material-audio-drop-placeholder` sombreado dentro del flujo del compositor. Su ancho comprende el chip y las separaciones laterales; cada movimiento Pointer lo quita de la posición previa y lo inserta en el destino actual, haciendo que las letras se aparten y luego recuperen el espacio al moverlo nuevamente.
- El audio original se conserva separado mientras dura el gesto. Al soltar reemplaza el placeholder en su posición actual, y ante `pointercancel` vuelve junto con los espacios originales al marcador de origen.
- PR #143 integrada en `main` como `e3830846b478004bb8d1611910cc58007ffeb785`. CI de PR pasó 17 smoke tests en Chromium junto con `npm test` y ESLint/no-undef: [Tests #42072480690](https://github.com/Teliu-p/BandaBase/actions/runs/42072480690). CI de main y despliegue Pages pasaron: [Tests #42072659164](https://github.com/Teliu-p/BandaBase/actions/runs/42072659164), [Pages #42072657702](https://github.com/Teliu-p/BandaBase/actions/runs/42072657702).
- No requiere cambios de esquema, migraciones, RLS, Storage ni escrituras a Supabase.


### 2026-11-05 — generalizar el arrastre de adjuntos y mostrar el objeto bajo el puntero (PR #144 integrada)

- Corrección de alcance aclarada por el usuario: el gesto debe servir para cualquier archivo de Materiales, no solo audio. No pidió simular teclas Espacio/Backspace; esas teclas solo describían el reacomodo visual del contenido al mover el adjunto.
- Durante el gesto, una copia visual del chip acompaña al puntero y el sombreado inline muestra la posición real de inserción. El hit-testing se hace sin el placeholder anterior para que la posición insertada no contamine la medición del siguiente movimiento.
- El commit final conserva y reposiciona el nodo DOM original. Los archivos no-audio también entran en el mismo flujo; enlaces web quedan excluidos. Cancelar o soltar fuera del editor restaura el origen.
- Se añade cobertura Chromium para un PDF no-audio y seguimiento del puntero, además de las regresiones de audio/orden/cancelación. No se modifican Supabase, Storage, RLS, datos, migraciones ni el servidor Python.


- Resultado final: PR #144 fusionada como `858271ba90576ba3211305c17f06ec7285eeb29d`. CI de PR [#42085812268](https://github.com/Teliu-p/BandaBase/actions/runs/42085812268), Tests de main [#42085984629](https://github.com/Teliu-p/BandaBase/actions/runs/42085984629) y Pages [#42085984089](https://github.com/Teliu-p/BandaBase/actions/runs/42085984089) pasaron. La implementación está publicada; la verificación manual en la sesión del usuario queda pendiente.


### 2026-11-05 — corregir destino al comienzo del renglón al arrastrar un archivo (PR #145 integrada)

- Reporte posterior a PR #144: el audio podía terminar al comienzo del renglón aunque el cursor estuviera en el medio, obligando a agregar espacios manualmente. El usuario especificó que el sombreado debe estar inmediatamente debajo del cursor y el archivo quedar en ese lugar.
- La versión anterior priorizaba una aproximación por geometría de caracteres. La corrección prioriza el caret nativo del navegador en las coordenadas exactas del puntero y recalcula también en `pointerup`; conserva la geometría como alternativa si no hay caret nativo válido.
- La regresión comprueba que el borde del placeholder coincide horizontalmente (tolerancia máxima 2 px) con el caret objetivo, con un archivo PDF y con un audio FLAC; al soltar se comprueba el texto a izquierda/derecha. No alcanza con confirmar solo que el placeholder se mueve o que el archivo cambia de renglón.
- PR #145 fue fusionada en `main` como `7a736fde56c84d2c945e6d0bfac24a87312d1ddd`. Tests de PR [#42088181209](https://github.com/Teliu-p/BandaBase/actions/runs/42088181209), Tests de main [#42088380247](https://github.com/Teliu-p/BandaBase/actions/runs/42088380247) y Pages [#42088379801](https://github.com/Teliu-p/BandaBase/actions/runs/42088379801) pasaron. La prueba exige correspondencia de hasta 2 px entre placeholder y caret y verifica texto antes/después al mover audio y PDF. No se cambió Supabase, Storage, RLS, datos, migraciones ni el servidor Python.


### 2026-11-05 — segundo fallo: caret nativo alejado del puntero y reflow al quitar el chip (PR #146)

- El usuario volvió a informar que el audio seguía insertándose al extremo izquierdo aun después de PR #145. No considerar resuelto el caso por los tests anteriores.
- Se encontraron dos causas: las APIs de caret podían devolver un punto válido dentro del editor pero en el inicio del renglón; además, el marcador de origen con `display:none` colapsaba el renglón del audio y desplazaba verticalmente el texto mientras se arrastraba.
- La implementación nueva prioriza los límites geométricos de caracteres/chips de la línea bajo el puntero y conserva el caret nativo como respaldo para líneas sin texto visible. En el origen coloca un clon oculto con la huella inline del chip y los espacios eliminados, preservando la distribución mientras se arrastra.
- La prueba nueva fuerza una respuesta nativa incorrecta, simula texto enriquecido/envuelto, verifica que la altura del renglón no cambie, mide el placeholder respecto del caret y comprueba texto antes/después e identidad del nodo. CI [#42092923727](https://github.com/Teliu-p/BandaBase/actions/runs/42092923727) pasó (18 smoke tests de Chromium).
- PR #146 sigue abierta en `fix/material-drag-drop-geometric-hit-test-20261105`. No declarar publicado hasta merge y Pages; el comportamiento real del navegador del usuario sigue pendiente de confirmación. Sin cambios a Supabase, datos, RLS, Storage, migraciones ni servidor local.


### 2026-11-05 — reconstrucción del movimiento de archivos desde cero

- Tras los intentos #141–#146, el usuario informó que el sombreado seguía apareciendo en posiciones arbitrarias y autorizó retirar esos intentos y rehacer la función.
- Decisión: conservar la multiselección de archivos, pero reemplazar completamente el motor de Pointer Events y sus heurísticas por HTML Drag and Drop nativo del navegador. El destino se obtiene del caret nativo en las coordenadas de `dragover/drop`; no se debe sustituir por aproximaciones manuales. Si no hay caret válido, se cancela en vez de dejar el adjunto en otro lugar.
- El archivo original permanece conectado al DOM para mantener el drag nativo; se saca temporalmente del flujo con posición fija, se conserva un clon invisible en el origen y se coloca un placeholder inline en el caret. Al cancelar, `dragend` restaura el mismo nodo y los separadores.
- Esta rama debe considerarse una reconstrucción en pruebas, no una corrección ya validada. CI, Pages y confirmación manual pendientes.


- Reconstrucción nueva en PR #147: CI [#42098206552](https://github.com/Teliu-p/BandaBase/actions/runs/42098206552) pasó con 18 smoke tests Chromium. Los tests usan movimientos reales de mouse y el flujo HTML Drag and Drop nativo, y cubren PDF/audio, ubicación de caret, orden, identidad del nodo y cancelación. PR sigue abierta; falta Pages y confirmación manual.

### 2026-11-06 — autoedición segura de participantes en Listas (fotografía previa al merge de PR #149)

- El historial remoto de migraciones ya quedó alineado con los 60 archivos de origin/main; no confundir tracking alineado con prueba histórica de cada sentencia. No ejecutar db push ni re-ejecutar SQL histórico.
- La política UPDATE de band_list_items en producción ya es una sola política, consolidada por 20261020232312_harden_storage_and_list_item_policies.sql. PR #98 quedó desactualizada porque pretendía volver a reemplazar esa política.
- La brecha actual se confirmó en private.prevent_manager_list_item_edit(): un integrante anotado podía modificar campos de su propia fila además de los instrumentos.
- PR #149 añade una migración que limita la autoedición, mantiene los permisos del creador/admin/responsable y conserva la auto-confirmación interna mediante pg_trigger_depth() para reconocer la actualización anidada del trigger. No modifica políticas RLS ni reemplaza la función actual de auto-confirmación.
- CI más reciente para el commit de código `1d38cac5d179fdb98ab97f21a9beb3c264b88401`: run #42328986494 con ambos jobs completados en `success` (PostgreSQL 17 descartable; npm test, ESLint/no-undef y 18 smoke tests Chromium).
- La validación sobre la restauración completa local pasó: RLS real, controles de responsable, rechazo de `status=NULL` y auto-confirmación anidada; el script terminó con `ROLLBACK`.
- E2E manual completada por el usuario en la aplicación local con dos sesiones Auth independientes: `saumerio40` (owner) y `lopenzio50` (member). Confirmó inicio de sesión y funcionamiento esperado de permisos, autoedición de instrumentos, rechazo de auto-confirmación directa y protección de participaciones ajenas.
- Estado al cierre del 2026-11-06: el candidato se había probado/instalado únicamente en restore-lab local; en ese momento producción aún no se había modificado y PR #149 seguía en revisión. Ese estado histórico fue superado el 2026-11-07; ver la entrada siguiente.


### 2026-11-07 — cierre de permisos de Listas, drag/drop y Realtime

- PR #149 quedó fusionada en `main` como `5d003055e5067cb3bfdb53c8c54bcdd9b073eaf9`. La migración `20261106210000_harden_band_list_item_self_service_guard.sql` ya está aplicada en producción. Inspección posterior de solo lectura confirmó la definición esperada de `private.prevent_manager_list_item_edit()`, el trigger `manager_list_item_edit_guard` habilitado y una sola política UPDATE de `band_list_items`.
- La primera aplicación de la migración generó el tracking automático `20261107214735` en vez de la versión del archivo. Se corrigió con CLI oficial: versión automática marcada reverted, versión `20261106210000` marcada applied. La lista final coincidió local/remoto en 61 versiones. No se reejecutó SQL, no se revirtió el esquema y no se usó `db push`.
- La suite específica de permisos pasó en CI #42328986494: PostgreSQL 17 descartable y suite general. La prueba de restauración completa local acabó en `ROLLBACK`; el usuario había probado el comportamiento con dos sesiones Auth en restore-lab. La inspección actual de producción encontró cero listas activas y cero responsables, por lo que no se hizo una prueba de escritura autenticada con datos productivos ni se insertaron datos artificiales.
- PR #150 se fusionó como `67a226a0e325fffd61fd60226e7e7c4c47267c54`. El usuario confirmó en Chrome para Windows que el adjunto se inserta donde se suelta, incluso en renglón vacío o después del texto. CI #42408553067 pasó con 23 smoke tests Chromium.
- PR #151 se fusionó como `e4a63fb65bf82c07b7fd7af00edae8603a77524e`. Reintenta refrescos fallidos de Realtime y separa el estado de vista previa de comentarios. El usuario confirmó el flujo en dos sesiones Auth; CI #42411975800 pasó con 21 smoke tests Chromium.
- Tests de main #42417389301 y Pages #42417389142 pasaron sobre HEAD `5d00305`. Supabase permaneció ACTIVE_HEALTHY; no hay hallazgos de asesor de salud. Persisten los avisos de SECURITY DEFINER/auth, índices sin uso y políticas permisivas múltiples ya descritos en `current-state.md`; no se modificaron.


### 2026-11-07 — política SELECT redundante de Canciones (PR #153 aplicada)

- Producción contenía las políticas permisivas `songs_select_active_or_admin` y `songs_select_active_or_own_trash_or_admin`. La condición de la segunda es una superconjunción: pertenencia activa y (registro activo, papelera propia o admin). Incluye todos los casos de la primera y agrega la papelera propia; retirar la política más estrecha no reduce acceso.
- La migración histórica `20261007225000_allow_users_to_complete_soft_delete.sql` ya contenía el DROP de la política antigua, pero ambas aparecían en el catálogo real. No se reejecutó el SQL histórico.
- PR #153 se fusionó como `73da35c32f1cfab99381e8a4d8d4347bb3b3d510`; aplicó solo `DROP POLICY IF EXISTS songs_select_active_or_admin ON public.songs`.
- Supabase generó tracking `20261107231924`. Se renombró el archivo versionado a `20261107231924_remove_redundant_songs_select_policy.sql` para hacerlo coincidir con remoto; no se manipuló manualmente `schema_migrations` ni se ejecutó `migration repair`.
- CI #42424616317 pasó en ambos jobs. La prueba compara las filas visibles por RLS antes/después para admin, miembros (papelera propia/ajena), otra banda e integrante inactivo y termina con ROLLBACK.
- Verificación productiva: la única política SELECT para songs que permanece es `songs_select_active_or_own_trash_or_admin`; asesor de rendimiento redujo sus grupos permisivos de 11 a 10 y el asesor de salud no devolvió hallazgos. No se modificaron datos ni otras políticas.

### 2026-11-08 — BPM con decimales y prueba de layout móvil (PR #155)

- Se añade precisión de hasta dos decimales para BPM en alta, edición, BPM original y metrónomo. El HTML usa `step="0.01"` e `inputmode="decimal"`; tap tempo conserva dos decimales a partir de la mediana de intervalos.
- La inspección de producción encontró `songs.bpm` y `songs.original_bpm` como `integer`. La migración `20261108055107_support_decimal_song_bpm.sql` los convierte a `numeric(5,2)` con `USING ...::numeric(5,2)`. El CHECK existente de 1–400 se mantiene. La conversión de los 20 valores BPM existentes y los NULLs de `original_bpm` no cambia su significado.
- La migración se aplicó mediante Supabase y la versión generada `20261108055107` se alineó con el prefijo del archivo. La prueba SQL en PostgreSQL descartable conserva enteros/NULLs, escribe valores con dos decimales, y confirma que `400.01` sigue rechazado. En producción, una escritura temporal de `123.45`/`121.75` se leyó correctamente y se revirtió con `ROLLBACK`.
- CI #42452516755 pasó en `test` y `database-policy`: 26 smoke tests Chromium, ESLint, sintaxis y regresión DB. El test móvil usa 360×800, verifica que los controles quedan dentro de viewport y que `123.45` fluye de la ficha al metrónomo.
- No se hizo una prueba en un teléfono físico ni se reprodujo desde otra red. El test de viewport no debe presentarse como validación real Android/iOS. El cambio tampoco altera el modelo de sincronización: BPM sigue siendo constante y no existe detección de tempo por forma de onda.


## 2026-11-09 — pausas al saltar de posición y reproducción en grupo

- El reproductor inline sólo solicita URL/metadata bajo demanda. El grupo esperaba metadata, alineaba todas las pistas y ejecutaba `play()` inmediatamente, sin comprobar que hubiese datos disponibles en el nuevo playhead.
- El deslizador aplicaba `currentTime` en cada evento `input`, lo que puede cancelar y reemplazar solicitudes Range durante el arrastre en pantallas táctiles.
- Cambio propuesto: el arrastre sólo actualiza una vista previa; el evento `change` confirma un seek. Para grupos, `preload="auto"` se activa únicamente tras el clic explícito de reproducción, se espera `canplay` en la posición común y luego se revierte a `metadata` antes de iniciar todas las pistas. Timeout de espera: 15 s.
- Los logs de servidor muestran interrupciones client-disconnected y respuestas parciales lentas; un cierre de Range tras un seek puede ser normal. La precarga no aumenta la velocidad de subida del host ni elimina el coste de transmitir pistas distintas en paralelo: su objetivo es evitar empezar a reproducir sin buffer y aprovechar la descarga anticipada durante la reproducción.
- La CI y la prueba física siguen pendientes al registrar esta decisión.


### 2026-11-09 — preparar audios completos antes del ensayo

- El usuario acepta una acción explícita para preparar las pistas y solicita conservar la sincronización del metrónomo, marcadores temporales, grupos y controles existentes.
- Decisión de arquitectura: no reemplazar el reproductor ni introducir un motor nuevo. Descargar el archivo completo por la ruta autenticada local y guardarlo en OPFS del navegador; una vez verificado, el mismo elemento `audio` reproduce una URL blob local. Así los listeners de play/pause/timeupdate/seeked, la velocidad, los grupos y el metrónomo siguen observando el mismo playhead.
- La preparación del grupo es secuencial para evitar solicitudes concurrentes pesadas al host/Funnel. Solo un HTTP 200 completo puede convertirse en copia preparada; 206/Range, tamaño recibido distinto de Content-Length, cuota agotada y errores de escritura no generan un registro de finalización.
- Los marcadores deben priorizar la copia preparada, incluso para motores temporales de materiales plegados. La eliminación pausa/libera primero los reproductores locales y luego elimina el binario/metadata y revoca el Object URL.
- Las copias son por usuario/dispositivo/browser origin. Se solicita `navigator.storage.persist()` sin asumir que el navegador la concede; limpiar datos del sitio elimina las copias. La reproducción no preparada conserva streaming existente.
- PR #157 queda en validación. No afirmar que la reproducción real está resuelta hasta que CI pase y se realice prueba audible con varios stems, marcadores, pausa/reanudación, velocidad y metrónomo; repetir en Android físico.
- No se modifican Supabase, RLS, Storage, migraciones ni el servidor de audio Python.
