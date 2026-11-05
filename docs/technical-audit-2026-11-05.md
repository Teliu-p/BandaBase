# Auditoría integral de BandaBase — 2026-11-05

**Fecha:** 5 de noviembre de 2026 (Argentina)  
**Repositorio:** [Teliu-p/BandaBase](https://github.com/Teliu-p/BandaBase)  
**Rama inspeccionada:** `main`  
**HEAD observado al iniciar esta auditoría:** `2d0af16f527fc29d4b840ff9a2f2d884b8af55fb`  
**Supabase:** `evuwcikuxptrgzdzejov` — PostgreSQL 17.11, región `sa-east-1`, estado `ACTIVE_HEALTHY`  
**Alcance:** revisión documental, inspección de código y configuración en GitHub, consultas SQL de solo lectura, historial de migraciones y asesores de Supabase. No se modificaron datos, esquema, permisos ni lógica funcional durante esta auditoría.

> Este informe separa hechos comprobados, alertas automatizadas e hipótesis/recomendaciones. Una prueba automatizada no equivale a validación manual en una sesión real autenticada.

## 1. Resumen ejecutivo

BandaBase ya no es una página pequeña para listar canciones: es una aplicación colaborativa de banda con catálogo musical, preparación/repertorio, listas con cupos y participantes, propuestas/votaciones, comentarios, editor de materiales enriquecidos, adjuntos, papelera/restauración, auditoría, sincronización en tiempo real y un subsistema externo para audio local.

La arquitectura actual es coherente con el stack elegido (HTML/CSS + JavaScript clásico + Supabase Auth/Postgres/RLS/Storage), y el código está bastante más modularizado que una aplicación monolítica. Hay controles reales en el backend: RLS está habilitado en todas las tablas públicas devueltas, hay funciones transaccionales/atómicas para reemplazar colecciones y bloques, reglas de integridad para listas y votos, auditoría y políticas de Storage.

**Evaluación general:** base funcional avanzada y con un esfuerzo de seguridad considerable; todavía requiere cerrar la reconciliación del historial de migraciones, reducir la superficie de riesgo de funciones privilegiadas, ordenar las alertas de políticas/índices y validar flujos críticos en condiciones reales multiusuario. La mayor deuda de arquitectura no es visual: es la complejidad acumulada de permisos, dependencias entre scripts globales y el servicio externo de audio.

No recomiendo una reescritura. Recomiendo consolidar, probar y documentar la arquitectura existente antes de añadir más módulos.

## 2. Estado real de GitHub y despliegue

- `main` apunta a `2d0af16f527fc29d4b840ff9a2f2d884b8af55fb`.
- La PR [#147](https://github.com/Teliu-p/BandaBase/pull/147) está **fusionada** en ese SHA. Reconstruyó el movimiento de adjuntos de Materiales con HTML Drag and Drop nativo, reemplazando el motor Pointer Events personalizado.
- Para ese HEAD, el workflow de Tests terminó en éxito: [run 42098668867](https://github.com/Teliu-p/BandaBase/actions/runs/42098668867). Pages también terminó en éxito: [run 42098667320](https://github.com/Teliu-p/BandaBase/actions/runs/42098667320).
- La PR [#148](https://github.com/Teliu-p/BandaBase/pull/148) está abierta y propone diagnosticar el caret nativo sobre texto durante el arrastre. Su ejecución de Tests observada, [run 42101112706](https://github.com/Teliu-p/BandaBase/actions/runs/42101112706), terminó en **failure**. No forma parte de `main`.
- Por lo tanto, el cambio #147 está integrado y CI/Pages pasaron, pero el gesto de arrastre aún necesita confirmación manual del usuario. No confundir merge/deploy exitoso con resolución definitiva del problema de colocación del adjunto.

## 3. Arquitectura y frontend

### 3.1 Estructura

La aplicación mantiene scripts clásicos, cargados en un orden explícito desde `index.html`. La lógica está separada en módulos bajo `src/`:

- Núcleo: estado global, utilidades, DOM, navegación, shell, autenticación, banda y actualización.
- Canciones: datos, cantantes, vistas, filtros, color, formularios, controlador, detalle, comparación y metrónomo.
- Materiales: datos, editor, formato/sanitización, guardado, vista y resolución de adjuntos.
- Colaboración: comentarios, compositor enriquecido, listas, propuestas, votaciones y administración.
- Tiempo real: `app-realtime.js`.
- Audio local: `attachment-access.js` coordina el acceso al servidor externo para los audios de Materiales.

La separación por responsabilidades es una mejora importante frente a concentrar todo en `index.html`. Sin embargo, al usar scripts clásicos, las funciones y variables siguen siendo globales y el orden de carga es parte del contrato de ejecución. Un nombre global ausente o un archivo cargado fuera de orden puede romper un módulo en tiempo de ejecución aunque todos los archivos pasen el chequeo sintáctico.

### 3.2 Riesgos y mejoras de frontend

1. **Dependencias globales:** mantener un inventario de símbolos globales exportados/consumidos y una prueba de arranque que detecte referencias faltantes. Evitar seguir agregando funciones compartidas sin declarar claramente su propietario.
2. **Arranque y autenticación:** probar secuencias de sesión restaurada, sesión expirada, logout en otra pestaña, cambio de usuario y fallo de red. La inicialización no debe dejar secciones en estado parcialmente cargado.
3. **Estado y renderizado:** definir por módulo quién es dueño de los datos, quién renderiza y quién persiste. Evitar que varios módulos muten los mismos arrays globales sin una función coordinadora.
4. **Errores visibles:** mantener mensajes y estados de carga/error en todas las escrituras. Nunca convertir errores de RPC, Storage o red en retornos silenciosos.
5. **Rich text:** el patrón de serializador/sanitizador con lista permitida y nodos musicales canónicos es apropiado. Mantener una sola ruta canónica de lectura/escritura y pruebas de ida y vuelta (editar → guardar → recargar → editar). No aceptar SVG/HTML arbitrario del contenido almacenado.
6. **Arrastre de adjuntos:** #147 usa el mecanismo nativo solicitado. La CI confirma casos automatizados, pero #148 demuestra que todavía se investiga el comportamiento del caret en texto. No seguir agregando cálculos geométricos paralelos salvo que una limitación reproducible del navegador lo justifique.
7. **Móvil:** conservar pruebas de formularios y vistas de listas/canciones en viewport móvil, además de escritorio. La especificación de producto define orden de campos móvil y disposición de Integrantes.
8. **Accesibilidad/usabilidad:** revisar foco visible, navegación por teclado, etiquetas de botones solo con icono, contraste, mensajes de validación y controles de audio. Es una mejora transversal, no un rediseño urgente.

### 3.3 Pruebas

El paquete raíz tiene un script `npm test` que ejecuta `tests/js-syntax.test.mjs`. La estructura incluye además configuración ESLint y pruebas E2E/Chromium; el workflow de GitHub Actions integra pruebas, análisis estático y smoke tests de navegador.

Esto es una buena base, pero el conjunto no equivale a una prueba de integración de extremo a extremo contra Supabase real. Los antecedentes documentan que varios smoke tests usan stubs de Auth. Hay que complementar con un entorno de prueba aislado que cubra dos usuarios reales de una misma banda, un usuario ajeno, roles distintos y dos navegadores concurrentes. No usar datos de producción para pruebas destructivas.

## 4. Backend: Supabase y PostgreSQL

### 4.1 Estado observado

- Proyecto activo y saludable; PostgreSQL 17.11.
- Se devolvieron 28 tablas del esquema `public`; todas reportan RLS habilitada.
- Tablas y conteos observados: `bands` 1; `profiles` 3; `band_members` 3; `songs` 201; `materials` 29; `material_attachments` 53; `material_blocks` 133; `comments` 11; `comment_blocks` 8; `band_lists` 3; `band_list_items` 6; `proposals` 5; `proposal_options` 13; `proposal_votes` 9; `proposal_attachments` 2; `proposal_blocks` 9; `song_singers` 8; `audit_log` 2065. Otras tablas heredadas de ensayos/listas/decisiones/problemas estaban presentes con cero filas en la consulta. Los conteos son una fotografía y pueden cambiar.
- La publicación `supabase_realtime` contiene 20 tablas públicas, entre ellas canciones, materiales, adjuntos, comentarios, propuestas, listas, integrantes y auditoría.
- No se encontraron Edge Functions desplegadas.
- El bucket `materials` es privado, con límite de 52,428,800 bytes (50 MiB) y sin lista explícita de MIME types.

### 4.2 Modelo y reglas de negocio

La base refleja la evolución del producto: canciones, cantantes, materiales y bloques, comentarios, listas y participantes, propuestas/opciones/votos, papelera y auditoría. El backend aplica restricciones de pertenencia a banda, autoría, roles y estado activo. Hay funciones de reemplazo atómico para colecciones/bloques y validación de cupos/votos.

Reglas de producto que deben seguir tratándose como invariantes:
- Preparación (Lista/Pendiente), estado Activa/Inactiva y pertenencia al Repertorio son conceptos separados.
- Repertorio se deriva de pertenecer al menos a una Lista activa.
- Las listas controlan canciones, responsables, instrumentos, participantes y cupos; el backend debe validar pertenencia y capacidad, no confiar en la interfaz.
- Propuestas pueden ser generales o con opciones/votos; la visibilidad de resultados no debe revelar identidades si la votación es anónima.
- Comentarios y materiales admiten contenido mixto; un adjunto ausente no debe impedir guardar texto normal.
- Papelera y restauración son operaciones autorizadas, no simples ocultamientos visuales.

### 4.3 Seguridad y RLS

**Aspectos positivos comprobados**
- Todas las tablas públicas devueltas tienen RLS habilitada.
- Las políticas inspeccionadas incluyen comprobaciones de pertenencia a banda y restricciones de autor/administrador/responsable.
- Las funciones privilegiadas de triggers y validación tienen `EXECUTE` denegado a `anon` y `authenticated`.
- Las políticas de Storage del bucket privado distinguen rutas de materiales, comentarios y propuestas, con comprobaciones de banda/propietario/administrador.
- Las funciones de creación/entrada a banda no son ejecutables por roles cliente según los privilegios consultados.

**Alertas del asesor de seguridad**
- `get_proposal_vote_stats(uuid[])` es `SECURITY DEFINER` y ejecutable por `authenticated`. Su cuerpo filtra por pertenencia activa del usuario a la banda de cada propuesta y devuelve conteos agregados, no identidades. Parece una decisión funcional para estadísticas de votación, pero debe mantenerse bajo revisión y pruebas de anonimato.
- `is_band_member(uuid)` es `SECURITY DEFINER` y ejecutable por `authenticated`. Devuelve únicamente si el usuario actual pertenece activamente a la banda indicada; además es usado por políticas RLS. Su exposición debe considerarse deliberada y documentada, no revocarse a ciegas porque podría romper las políticas que la invocan.
- La protección de contraseñas filtradas de Supabase Auth está desactivada. Recomiendo activarla desde Auth cuando se haya comprobado el impacto esperado sobre los usuarios y el flujo de registro.

No apareció una alerta de tablas públicas sin RLS en el resultado consultado. Esto no sustituye una prueba de autorización negativa por tabla/operación.

**Prioridad de seguridad:** no hacer un cambio masivo de RLS. Preparar una matriz de acceso por entidad/acción/rol y ejecutar pruebas positivas y negativas con usuarios de prueba. Revisar especialmente: auto-registro, acceso a la banda, edición del perfil propio, modificación de integrantes ajenos, listas y cupos, votos anónimos, adjuntos y restauración de papelera.

### 4.4 Rendimiento

El asesor de rendimiento reporta:
- 33 índices sin uso observado. No significa que deban eliminarse: la base tiene poca actividad y algunos índices pueden proteger consultas poco frecuentes o claves foráneas.
- 11 casos de políticas permisivas múltiples para el mismo rol/acción. Esto puede hacer que Postgres evalúe más condiciones RLS de las necesarias. Algunas combinaciones son deliberadas (por ejemplo, actualizar como autor, administrador o usuario que retira su propia participación), por lo que cualquier consolidación debe preservar exactamente la semántica.
- No se debe eliminar índices o combinar políticas solo para hacer desaparecer el warning. Primero obtener consultas reales y planes de ejecución, revisar claves foráneas y medir con carga representativa.

### 4.5 Auditoría e integridad

`audit_log` contiene 2065 filas en la fotografía. Es un activo valioso para rastrear cambios, pero conviene revisar retención, tamaño de `before_data/after_data`, permisos de lectura y una estrategia de restauración coherente. La auditoría no reemplaza backups y no garantiza por sí sola que todos los objetos adjuntos puedan recuperarse.

## 5. Hallazgo crítico: historial de migraciones desincronizado

Conteo observado en esta auditoría:
- Archivos locales en `supabase/migrations/`: **60**.
- Versiones registradas en Supabase: **48**.
- Archivos locales cuyo timestamp no aparece en el historial remoto: **12**.
- Versiones remotas sin archivo local: **0**.

Las 12 versiones locales no registradas son:

```text
20261007173000_comment_attachments_blocks
20261007190000_band_list_participation_permissions
20261007200000_song_genres_array
20261007203000_proposal_attachments
20261007210000_proposal_content_blocks
20261007220000_permissions_audit_and_trash
20261007221500_secure_anonymous_vote_stats
20261007223000_permissions_hardening
20261007224000_allow_member_soft_delete
20261007225000_allow_users_to_complete_soft_delete
20261007225500_remove_legacy_comment_access
20261008180900_harden_material_comment_proposal_storage
```

Esto coincide con el problema inverso ya documentado en `database-migration-history-reconciliation-followup.md`: la discrepancia inicial de doce versiones remotas sin archivo local se había resuelto incorporando archivos a Git; persiste la discrepancia de doce archivos locales sin fila remota. El informe anterior contaba 56/44; cuatro migraciones nuevas están ahora presentes en ambos lados, por eso el conteo actualizado es 60/48. **No son doce migraciones remotas faltantes del repositorio.**

La arqueología previa identificó dependencias de objetos/efectos actuales en varios de esos archivos. No hay evidencia suficiente para afirmar que cada sentencia de los doce se ejecutó literalmente ni que sea seguro volver a ejecutarlas. No borrar archivos ni marcar las doce como aplicadas en bloque.

**Prohibido como procedimiento de reparación:** ejecutar `supabase db push` contra producción con esta divergencia, insertar/editar manualmente `supabase_migrations.schema_migrations`, borrar archivos para hacer coincidir conteos o ejecutar los SQL antiguos a ciegas.

**Siguiente procedimiento seguro:**
1. Congelar nuevas migraciones de producción hasta reconciliar.
2. Exportar un backup verificable del esquema y datos relevantes.
3. Comparar cada una de las doce migraciones con el esquema vivo: objetos, definiciones, restricciones, índices, políticas, grants, funciones, triggers y cambios de datos.
4. Probar el orden de reconstrucción en una base aislada; no asumir que el estado final equivalente significa que cada sentencia es repetible.
5. Para cada versión que se demuestre aplicada en términos de sus efectos, usar el mecanismo oficial `supabase migration repair --status applied <version> --remote` únicamente para corregir metadatos, sin volver a ejecutar SQL.
6. Volver a listar y comprobar la convergencia. Mantener el detalle de evidencias por versión.

La documentación oficial confirma que `migration repair` solo corrige el historial, no aplica ni revierte SQL; debe utilizarse únicamente cuando el estado real de la base ya está comprobado. Véase [Supabase: migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair) y [Database migrations / diagnosing sync errors](https://supabase.com/docs/guides/deployment/database-migrations).

## 6. Audio y almacenamiento: decisión arquitectónica con consecuencias operativas

La decisión actual es separar:
- Audio adjunto a Materiales: biblioteca local del equipo anfitrión, con `storage_path = local:<clave-opaca>`, servidor Python local y acceso HTTPS mediante Tailscale Funnel.
- Archivos no-audio de Materiales: Supabase Storage.
- Audio de Comentarios y Propuestas: flujo de Storage existente.
- Los audios antiguos de Materiales que estén en Storage no se migran ni eliminan automáticamente.

Es una solución válida para evitar que una biblioteca grande de audio consuma rápidamente el almacenamiento de Supabase, pero introduce un **punto único de disponibilidad**: si el equipo anfitrión está apagado, suspendido, desconectado o el servidor/Funnel no está disponible, los demás usuarios no podrán acceder a esos audios locales. El puerto local debe permanecer enlazado a loopback; no abrirlo directamente en el router.

Recomendaciones:
1. Documentar el procedimiento de inicio, actualización y recuperación del servidor Python y Tailscale.
2. Mantener backups automáticos de la biblioteca y del manifiesto, en otro disco o destino independiente.
3. Verificar integridad con tamaño/hash por archivo y reconciliación entre filas `local:`, manifiesto y archivos físicos.
4. Añadir una vista de diagnóstico que distinga servidor fuera de línea, archivo ausente, ticket vencido y error de autorización.
5. Definir política de restauración y migración del host antes de depender de esa biblioteca para ensayos/servicios.
6. No asumir que cerrar la tapa o suspender Windows mantiene el servicio disponible; la disponibilidad depende de que el host, red, proceso Python y Funnel sigan activos.

El límite de 50 MiB observado corresponde al bucket de Storage, no necesariamente al tamaño permitido por el servidor local. Deben validarse límites de carga por flujo y mensajes de error para evitar confundirlos.

## 7. Prioridades recomendadas

### P0 — antes de nuevas funciones grandes
- Reconciliar con evidencia las 12 versiones de migración pendientes de historial.
- Validar en uso real el arrastre de archivos de Materiales después de #147; seguir el resultado de #148, sin integrar una corrección que no pase CI y prueba manual.
- Hacer una ronda autenticada multiusuario de permisos/RLS con casos permitidos y denegados.
- Verificar backup y restauración de datos y biblioteca local de audio.

### P1 — robustez
- Añadir pruebas de integración para login/registro, permisos, papelera/restauración, listas/cupos, votos, comentarios y adjuntos.
- Auditar funciones `SECURITY DEFINER` y mantener inventario de las que deben ser invocables desde cliente y las que son solo triggers.
- Revisar la activación de protección de contraseñas filtradas.
- Añadir prueba de reconciliación de manifiesto de audio local y salud del host.
- Añadir pruebas de sincronización entre dos sesiones para Realtime, con reconexión y eventos perdidos.

### P2 — rendimiento y mantenimiento
- Medir consultas reales antes de tocar los 33 índices sin uso.
- Consolidar de forma controlada las 11 combinaciones de políticas permisivas, preservando reglas.
- Reducir dependencias globales mediante interfaces entre módulos y pruebas de orden de carga.
- Revisar retención/crecimiento de `audit_log` y tamaños de adjuntos.
- Generar tipos de base de datos o un contrato de esquema verificable para reducir errores de nombres/campos entre frontend y PostgreSQL.

### P3 — evolución de producto
- Mejorar accesibilidad y estados responsive sin cambiar los flujos ya acordados.
- Incorporar telemetría técnica no sensible para errores de carga, guardado, Realtime y audio (sin almacenar contenido musical privado).
- Considerar una migración gradual a ES modules solo cuando haya pruebas suficientes; no reescribir todo el frontend por estética.

## 8. Plan de validación manual

Usar dos cuentas autenticadas en dos navegadores/dispositivos, además de una cuenta ajena a la banda:

- Registro/login, cierre y recuperación de sesión.
- Integrante normal: leer, crear/editar lo que corresponda y comprobar denegaciones de acciones administrativas.
- Propietario/admin: gestionar integrantes y permisos sin poder saltarse restricciones de integridad.
- Canciones: Preparación, Activa/Inactiva, Repertorio derivado y filtros.
- Listas: crear, asignar canciones, responsables, varios instrumentos, cupos, anotarse, confirmarse y retirarse; probar carreras simultáneas.
- Propuestas: sí/no, opción única/múltiple, anonimato y estadísticas.
- Comentarios: texto sin adjunto, texto con archivo y permisos de edición/borrado.
- Materiales: formato, notación, marcadores, guardar/reabrir, selección múltiple, mover archivo entre líneas, cancelar arrastre y guardar en orden.
- Audio: host encendido/apagado, acceso desde segunda PC, velocidad, afinación, descarga, marcadores y fallback correcto.
- Realtime: cambios desde otra sesión, reconexión y ausencia de duplicados.
- Papelera: borrar, restaurar y verificar que los permisos se aplican también en backend.

Registrar resultado, cuenta/rol, navegador, commit y evidencia; no marcar como validado un caso que solo pasó en mocks.

## 9. Límites de esta auditoría

No se ejecutó una sesión manual en el navegador del usuario, no se probó el servidor Python desde una segunda PC, no se hicieron cargas/descargas reales autenticadas, no se ejecutaron pruebas de penetración ni se reconstruyó una base limpia con todas las migraciones. Tampoco se aplicaron cambios funcionales ni de esquema. Las alertas de Supabase son hallazgos de linter, no prueba automática de explotación.

La auditoría sí verificó HEAD, estado de PR #147/#148, resultados de CI/Pages, archivos de documentación y arquitectura, inventario de tablas/RLS, migraciones remotas/locales, funciones privilegiadas, privilegios de ejecución, políticas de Storage, bucket, publicación Realtime y asesores de seguridad/rendimiento.

## 10. Conclusión

BandaBase tiene una base más madura de lo que su stack sencillo podría sugerir. El mayor valor ahora no está en agregar más funciones, sino en garantizar que las funciones existentes sean seguras, recuperables y confiables para varios músicos trabajando a la vez.

La estrategia recomendada es **estabilizar antes de expandir**: migraciones, permisos, audio local y pruebas multiusuario primero; optimización de índices/políticas y mejoras de frontend después. No se justifica una reescritura ni una refactorización masiva. Cada cambio debe ser pequeño, probado, documentado y verificado contra el HEAD real.
