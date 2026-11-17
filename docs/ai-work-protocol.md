# Protocolo de continuidad y trabajo asistido por IA — BandaBase

**Propósito:** permitir que cualquier asistente o desarrollador retome BandaBase sin depender del historial de un chat, de memoria del modelo ni de un resumen informal. Este protocolo es parte del proceso de ingeniería del repositorio.

## 1. Fuente de verdad y jerarquía

El contexto duradero vive en este repositorio: [Teliu-p/BandaBase](https://github.com/Teliu-p/BandaBase). La rama `main` es la referencia integrada; una rama o PR solo describe un cambio candidato hasta que se compruebe su integración.

Cuando dos fuentes discrepen, resolver en este orden, respetando qué clase de verdad describe cada una:

1. **Código y configuración en el SHA exacto que se está inspeccionando:** describen lo implementado en ese commit. No describen por sí solos el estado de producción.
2. **Estado remoto real** (Supabase/PostgreSQL/RLS/Storage, GitHub Actions/Pages, servidor local y dispositivo): describe lo aplicado o desplegado. Consultarlo en modo lectura antes de cualquier cambio que lo afecte.
3. **Decisiones aprobadas del producto:** `docs/product-spec.md` y las aclaraciones expresas del usuario en la tarea actual determinan el comportamiento deseado. Una implementación existente puede estar incompleta o equivocada respecto de esa intención.
4. **Fotografía operativa:** `docs/active-work.md` y la cabecera vigente de `docs/current-state.md`. Son resúmenes fechados; verificar que su SHA/fecha todavía corresponda.
5. **Arquitectura e historial:** `docs/architecture-map.md` explica acoplamientos; `docs/decisions-and-incidents.md` conserva decisiones, incidentes y evidencia histórica. Las entradas posteriores pueden superseder a las anteriores.
6. **Conversaciones y memoria del asistente:** sirven para recuperar la intención y restricciones expresadas, pero nunca reemplazan las fuentes versionadas ni la comprobación actual. Si un detalle del chat no está documentado y será relevante en el futuro, documentarlo en el mismo cambio.

No mezclar estos conceptos: “está en main”, “CI pasó”, “Pages publicó”, “la migración está aplicada”, “el usuario lo probó en un dispositivo” son afirmaciones distintas y requieren evidencia distinta.

## 2. Arranque obligatorio de cada sesión

Antes de analizar una incidencia, recomendar una modificación o tocar archivos:

1. Leer completos `AGENTS.md`, `AI_CONTEXT.md`, este protocolo, `docs/active-work.md` y la cabecera vigente de `docs/current-state.md`.
2. Leer las secciones pertinentes de `docs/architecture-map.md`, `docs/product-spec.md` y `docs/decisions-and-incidents.md`. Para una tarea transversal, leerlos completos.
3. Consultar GitHub: SHA actual de `main`, últimos commits, PR abiertas relevantes y estado de CI. No reutilizar SHA de un chat anterior.
4. Comparar el SHA y la fecha de `docs/active-work.md` y `docs/current-state.md` con el estado real. Si están atrasados, no heredar sus afirmaciones como actuales.
5. Inspeccionar el código y las dependencias del flujo afectado. Para comportamiento publicado, comprobar además el despliegue correspondiente.
6. Si afecta Supabase, inspeccionar primero el proyecto correcto, el esquema, políticas, funciones, triggers y versiones aplicadas relevantes en modo lectura. El SQL versionado no prueba el estado remoto ni viceversa.
7. Formular el diagnóstico separando hechos comprobados, hipótesis y datos faltantes. No pedir de nuevo información que ya está en el repositorio o que el usuario ya proporcionó y sigue vigente.

Si GitHub o el entorno remoto no está accesible, decirlo explícitamente y limitar el alcance. No fingir que se consultó el repositorio.

## 3. Antes de implementar

- Traducir la petición en criterios verificables de aceptación.
- Identificar el flujo real, módulos dependientes, esquema/roles afectados, comportamientos vecinos y riesgos de regresión.
- Elegir una prueba que habría detectado el fallo reportado; añadir cobertura antes o junto con el arreglo.
- Preferir cambios mínimos de causa raíz. No eliminar ni debilitar funcionalidades existentes sin autorización.
- Trabajar en rama y PR; no cambiar `main` directamente salvo que el usuario lo solicite expresamente y el cambio sea apropiado.
- No introducir secretos, contraseñas, tokens privados, URLs temporales firmadas ni datos personales innecesarios en el repositorio.

## 4. Reglas técnicas específicas de BandaBase

### Frontend

- La aplicación es HTML/CSS y JavaScript cargado como scripts clásicos con globals compartidos. El orden de `<script>` en `index.html` es una dependencia real. No convertir módulos a ES Modules ni reordenar cargas como parte de una corrección puntual.
- Inspeccionar todos los consumidores/definiciones de funciones globales antes de renombrar, mover o eliminar una función.
- El editor de Materiales usa un formato persistente con serialización y sanitización propias. No introducir HTML arbitrario ni formatos que no sobrevivan el ciclo guardar–reabrir.
- Probar viewport móvil y flujos con adjuntos cuando el cambio los toque. Chromium simulado no equivale a un teléfono real.

### Supabase y seguridad

- RLS, funciones y triggers son la autoridad de permisos; la UI solo refleja esos permisos, no los hace cumplir.
- No ejecutar `supabase db push`, `migration repair`, ni SQL histórico a ciegas. No insertar, borrar ni editar manualmente el tracking de migraciones como atajo.
- Antes de una migración: comprobar estado real, versión remota, dependencias, comportamiento de datos, políticas permissive/restrictive y camino de rollback; probar en PostgreSQL aislado siempre que sea viable.
- El nombre del archivo de migración debe coincidir exactamente con la versión que Supabase registra. Después de aplicarla, verificar schema, policies/triggers/functions y registro de versión.
- No escribir directamente en `storage.objects`; usar Storage API. No crear ramas de Supabase con coste sin autorización explícita.

### Audio y servidor local

- El servidor Python de audio corre en el equipo anfitrión y su despliegue es independiente de GitHub Pages. Un cambio web no instala ni actualiza el archivo Python local.
- El audio de Materiales con clave `local:` sigue el flujo local-only; no inventar fallback a Supabase Storage. Los adjuntos no-audio de Materiales y los adjuntos de Comentarios/Propuestas mantienen sus flujos de Storage documentados.
- OPFS para “Preparar para reproducir” es una copia local por cuenta, origen, navegador y dispositivo. No afirmar que un audio está preparado en todos los dispositivos ni que funciona sin red hasta validar ese dispositivo.
- Para pruebas de reproducción real registrar dispositivo, navegador, red, cantidad de pistas, marcadores, seek, pausa/reanudación, velocidad y metrónomo.

## 5. Evidencia y lenguaje de estado

Etiquetar cada afirmación importante con su nivel de evidencia:

- **Verificado en código:** presente en el SHA/branch indicado.
- **Verificado en remoto:** consultado directamente en el servicio real, con fecha.
- **CI automatizada:** workflow y run exactos en éxito.
- **Prueba manual del usuario:** el usuario informó el resultado y se registra como tal.
- **Pendiente:** no ejecutado o no confirmado.
- **Hipótesis:** explicación posible todavía no demostrada.

Nunca convertir “test de fixture”, “stub Auth”, “preview”, “CI verde” o “código fusionado” en “validado en producción/dispositivo real”.

## 6. Cierre obligatorio de cada cambio

En la misma PR que implementa el cambio, actualizar lo que corresponda:

- `docs/product-spec.md`: comportamiento acordado por el usuario.
- `docs/architecture-map.md`: módulos, flujos, datos, dependencias y límites.
- `docs/current-state.md`: hechos técnicos verificados, estado de producción, CI/deploy, migraciones y limitaciones.
- `docs/decisions-and-incidents.md`: decisiones, causas, regresiones y evidencia histórica.
- `docs/active-work.md`: PR/commit actual, asuntos que quedan abiertos y siguiente paso concreto.
- `AI_CONTEXT.md`: solo si cambia la orientación, el riesgo principal, la arquitectura de alto nivel o el punto de entrada; mantenerlo breve.
- `AGENTS.md` y este protocolo: solo si cambia el proceso general.

Al completar:

1. Ejecutar tests, lint y pruebas específicas pertinentes; revisar el diff.
2. Verificar CI en el commit de la PR y, después del merge, en el SHA de `main`.
3. Verificar el workflow de Pages si el runtime cambia. No asumir que un merge equivale a deploy.
4. Confirmar cualquier migración/configuración remota por separado.
5. Actualizar la fotografía de `docs/active-work.md` con el nuevo SHA de `main`, pruebas y pendientes reales.
6. Dejar un handoff corto: qué cambió, qué no cambió, pruebas ejecutadas, qué falta comprobar y enlaces a PR/CI/deploy.

## 7. Regla para el contexto entre chats

El conocimiento exclusivo del chat se considera volátil. Las decisiones duraderas, requisitos, restricciones, incidencias, pruebas, estados externos y tareas pendientes deben quedar versionados en GitHub. El siguiente asistente debe poder retomar leyendo el repositorio sin tener acceso a esta conversación.

No escribir una transcripción de chat como documentación. Convertirla en decisiones, requisitos, procedimientos y evidencia concisa. Mantener el punto de entrada corto y dejar el detalle en el documento especializado correspondiente.
