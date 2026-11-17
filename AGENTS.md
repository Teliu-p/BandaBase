# Instrucciones obligatorias para agentes que trabajen en BandaBase

Estas reglas aplican a cualquier tarea sobre el proyecto, incluso una corrección pequeña. El historial del chat y la memoria del modelo no son la fuente de contexto del proyecto.

## Puerta de entrada obligatoria

Antes de diagnosticar, recomendar un cambio técnico o editar:

1. Leer `AI_CONTEXT.md` y `docs/ai-work-protocol.md`.
2. Leer `docs/active-work.md` y la cabecera vigente de `docs/current-state.md`.
3. Leer las secciones relevantes de `docs/architecture-map.md`, `docs/product-spec.md` y `docs/decisions-and-incidents.md`; en tareas transversales, leerlos completos.
4. Consultar el GitHub real: HEAD de `main`, últimos commits, PR abiertas relevantes y CI/deploy aplicables. No reutilizar SHA de conversaciones previas.
5. Inspeccionar el código, dependencias y configuración del commit/branch afectado. Si el cambio afecta servicios remotos, consultar también su estado real en modo lectura.

Si el repositorio o un servicio no puede consultarse, declarar la limitación y no presentar una fotografía vieja como vigente.

## Durante el trabajo

- Respetar la jerarquía de fuentes y las etiquetas de evidencia definidas en `docs/ai-work-protocol.md`.
- Identificar criterios de aceptación, causa raíz, dependencias y regresiones antes de editar.
- Preferir el diff mínimo que resuelve la causa raíz. No eliminar funcionalidad existente sin autorización.
- Trabajar en rama y PR; no escribir directamente en `main` salvo instrucción expresa del usuario.
- Los JS se cargan como scripts clásicos y comparten globals: el orden de scripts en `index.html` es una dependencia real.
- Para Supabase: inspección de solo lectura primero; nunca ejecutar `db push`, `migration repair` ni SQL histórico a ciegas. Comprobar esquema real, RLS, funciones, triggers y tracking de migraciones cuando corresponda.
- No escribir directamente en `storage.objects`; usar Storage API. No crear ramas de Supabase que generen coste sin autorización.
- No afirmar que CI, preview o stubs equivalen a validación autenticada, producción o dispositivo físico.
- No solicitar ni guardar contraseñas, tokens privados o secretos.

## Cierre obligatorio

En la misma PR que modifica el comportamiento, actualizar los documentos especializados afectados y el handoff. Revisar el diff, ejecutar las regresiones pertinentes, verificar CI y, cuando corresponda, Pages y el estado remoto. Registrar qué se comprobó realmente, qué queda pendiente y el SHA/PR exactos. El siguiente asistente debe poder retomar leyendo GitHub sin depender de esta conversación.
