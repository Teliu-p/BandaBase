# BandaBase — punto de entrada para asistentes de IA

**Última inspección:** 2026-10-19 (zona horaria de Argentina)  
**Rama de referencia:** main  
**Último cambio funcional fusionado y verificado en main:** 611043389f58a962152f16cabdedd5c18b165865 (PR #112, 2026-10-19). Tests y Pages pasaron; verificar el HEAD real antes de cada cambio.
**Aplicación:** https://teliu-p.github.io/BandaBase/  
**Repositorio:** https://github.com/Teliu-p/BandaBase  
**Proyecto Supabase:** evuwcikuxptrgzdzejov

Este archivo es la puerta de entrada para cualquier conversación nueva sobre BandaBase. No reemplaza la inspección del código y del estado remoto: las notas pueden quedar desactualizadas cuando main, Supabase o las PR cambien.

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
- PR #112 quedó fusionada como `611043389f58a962152f16cabdedd5c18b165865`: https://github.com/Teliu-p/BandaBase/pull/112. Añade sincronización opcional con un audio de Materiales usando BPM/métrica conocidos, sigue play/pause/seek/marcadores y reduce la anticipación inicial del clic. Tests y Pages pasaron: https://github.com/Teliu-p/BandaBase/actions/runs/39350807878 y https://github.com/Teliu-p/BandaBase/actions/runs/39350808799. La prueba manual de audio real sigue pendiente. No toca Supabase.
- El historial remoto registra 44 migraciones y main contiene 56 archivos SQL; doce archivos locales no tienen fila remota de igual versión. No se encontró ninguna versión remota que faltara como archivo local.
- La PR #98 sigue abierta como borrador y el esquema remoto aún muestra dos políticas UPDATE permisivas sobre band_list_items. Ver current-state antes de actuar: esto puede cambiar.
- La PR #103 quedó fusionada en main: https://github.com/Teliu-p/BandaBase/pull/103.
- No se modificó código ni datos de producción al crear esta documentación.

## Plantilla de traspaso para una conversación nueva

Estoy trabajando en BandaBase. Leé primero AI_CONTEXT.md y los cuatro documentos de contexto que enlaza. Después verificá el estado actual de main, PR abiertas, CI y, si aplica, esquema/políticas reales de Supabase. No asumas que los SHA ni los problemas abiertos de los documentos siguen vigentes. Antes de cambiar código, explicá el flujo exacto y las pruebas; hacé un diff mínimo, evitá producción a ciegas y actualizá la documentación en la misma PR. Confirmá con evidencia qué verificaste y qué no.