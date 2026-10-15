# Instrucciones para agentes que trabajen en BandaBase

Antes de modificar código, SQL, permisos, datos o configuración:

1. Leer AI_CONTEXT.md y los cuatro documentos enlazados: docs/architecture-map.md, docs/product-spec.md, docs/current-state.md y docs/decisions-and-incidents.md.
2. Verificar el estado actual de main, las PR abiertas y CI; confirmar si la fotografía documentada sigue vigente.
3. Inspeccionar las funciones y dependencias reales involucradas. Los archivos JS se cargan como scripts clásicos y comparten globals, por lo que el orden de index.html importa.
4. Mantener diffs mínimos y evitar cambios no relacionados. Nunca aplicar migraciones ni reparar el historial remoto a ciegas. Leer el esquema y las políticas reales de Supabase cuando el cambio los afecte.
5. Añadir o ampliar regresiones para el fallo corregido y probar las rutas vecinas. Distinguir pruebas aisladas/stub de pruebas autenticadas contra servicios reales.
6. En la misma PR, actualizar la documentación afectada y registrar hechos comprobados, pruebas, limitaciones, riesgos nuevos y asuntos resueltos. No describir hipótesis como hechos.
7. No afirmar que se controló la sesión del navegador del usuario si la herramienta utilizada no lo permite. No solicitar ni guardar contraseñas o tokens privados.

Objetivo de trabajo: corregir la causa raíz, preservar funciones fuera del alcance, tener un rollback claro y verificar el commit/CI/deploy antes de declarar que se terminó.