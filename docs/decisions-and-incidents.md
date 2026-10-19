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
- El serializador/sanitizador de Materiales es el contrato para cualquier formato persistente. La sangría nueva se limita a `blockquote.material-indent`, no a estilos inline arbitrarios; las figuras se insertan como caracteres Unicode.
- Los atajos requieren Alt+número para no interferir con dígitos normales. La amplificación del metrónomo tendrá un control acotado y probado. Marcadores y sincronización son hitos separados.
- No enrutar audio almacenado a Web Audio sin verificar CORS y un fallback funcional: una conexión cross-origin no permitida puede hacer que la reproducción se silencie.
- Primera tanda en PR #107: https://github.com/Teliu-p/BandaBase/pull/107. CI pasó regresiones, ESLint/no-undef y smoke tests de Chromium en https://github.com/Teliu-p/BandaBase/actions/runs/39212456802. Los marcadores persistentes y la sincronización con audio quedan como requisitos pendientes de implementar y verificar.

## Formato recomendado para agregar incidentes

Registrar fecha, síntoma visible, causa raíz confirmada (o marcarla como hipótesis), archivos/funciones/policies implicados, fix/commit/PR, pruebas ejecutadas y limitaciones no cubiertas. Registrar también si se modificaron datos o esquema remoto; nunca insinuar que una comprobación estática equivale a una prueba real.